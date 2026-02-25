import Phaser from 'phaser'
import { ko } from '../../i18n/ko'
import { getGymTrainers, useGameStore } from '../../store/useGameStore'

const TILE_SIZE = 16
const WORLD_SCALE = 2
const BASE_CAMERA_ZOOM = 2
const PLAYER_SPEED = 140
const TEXT_SCALE_MULTIPLIER = 1.4
const WILD_ENCOUNTER_CHANCE = 0.35

const TILE_GROUND = 1
const TILE_GRASS = 2
const TILE_WALL = 3

type NearbyNpc = 'shop' | 'pc' | 'oak' | null

type LayerDebugSnapshot = {
  name: string
  exists: boolean
  visible: boolean
  alpha: number
  depth: number
  tint: number
}

type CameraDebugSnapshot = {
  x: number
  y: number
  width: number
  height: number
}

type OverworldDebugSnapshot = {
  mapKey: string
  mapLoaded: boolean
  widthTiles: number
  heightTiles: number
  widthPixels: number
  heightPixels: number
  cameraZoom: number
  cameraScrollX: number
  cameraScrollY: number
  cameraBounds: CameraDebugSnapshot
  layers: LayerDebugSnapshot[]
}

declare global {
  interface Window {
    __overworldDebug?: OverworldDebugSnapshot
    __debugRouteMode?: 'map' | 'battle' | null
  }
}

const trainerPositions: Record<string, { x: number; y: number }> = {
  'junior-mia': { x: 9, y: 4 },
  'ace-ryu': { x: 10, y: 6 },
  'leader-nova': { x: 9, y: 7 },
}

const trainerVisionTiles: Record<string, string> = {
  '9,2': 'junior-mia',
  '9,3': 'junior-mia',
  '10,4': 'ace-ryu',
  '10,5': 'ace-ryu',
  '9,5': 'leader-nova',
  '9,6': 'leader-nova',
}

const MAP_KEY = 'overworld-map'
const TILESET_KEY = 'overworld-tiles'
const MAP_URL = `${import.meta.env.BASE_URL}maps/overworld.json`
const TILESET_URL = `${import.meta.env.BASE_URL}maps/overworld-tiles.png`

export class OverworldScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite
  private grassLayer?: Phaser.Tilemaps.TilemapLayer
  private blockedLayer?: Phaser.Tilemaps.TilemapLayer
  private npcLayer?: Phaser.Tilemaps.TilemapLayer
  private trainerVisionLayer?: Phaser.Tilemaps.TilemapLayer
  private debugMoveGraphics?: Phaser.GameObjects.Graphics
  private lastDebugTile?: { x: number; y: number }
  private interactKey?: Phaser.Input.Keyboard.Key
  private shopLabelText?: Phaser.GameObjects.Text
  private pcLabelText?: Phaser.GameObjects.Text
  private oakLabelText?: Phaser.GameObjects.Text
  private oakSprite?: Phaser.GameObjects.Image
  private wasInGrass = false
  private lastFacingDirection: 'down' | 'up' | 'left' | 'right' = 'down'
  private walkFrameCursor = 0
  private warpCooldownUntil = 0
  private mapDebug: OverworldDebugSnapshot = {
    mapKey: MAP_KEY,
    mapLoaded: false,
    widthTiles: 0,
    heightTiles: 0,
    widthPixels: 0,
    heightPixels: 0,
    cameraZoom: 0,
    cameraScrollX: 0,
    cameraScrollY: 0,
    cameraBounds: { x: 0, y: 0, width: 0, height: 0 },
    layers: [],
  }

  constructor() {
    super('overworld')
  }

  preload() {
    try {
      this.load.tilemapTiledJSON(MAP_KEY, MAP_URL)
      this.load.image(TILESET_KEY, TILESET_URL)
    } catch (error) {
      console.error('[overworld] preload failed', {
        error,
        mapUrl: MAP_URL,
        tilesetUrl: TILESET_URL,
      })
      throw error
    }
  }

  create() {
    try {
      this.cameras.main.setBackgroundColor('#1f2937')
      this.createPlayerFrameTextures()
      this.createOakNpcTexture()

    if (!this.textures.exists(TILESET_KEY)) {
      this.createTilesTexture()
    }

    if (!this.cache.tilemap.exists(MAP_KEY)) {
      throw new Error(`[overworld] Failed to load tilemap JSON: ${MAP_URL}`)
    }

    const map = this.make.tilemap({ key: MAP_KEY })
    const tiles = map.addTilesetImage('overworld', TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0, 1)

    if (!tiles) {
      const knownTextures = this.textures.getTextureKeys().join(',')
      throw new Error(`[overworld] Failed to resolve tileset image. name=overworld key=${TILESET_KEY} textures=${knownTextures}`)
    }

    const groundLayer = map.createLayer('Ground', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.blockedLayer = map.createLayer('Blocked', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.grassLayer = map.createLayer('Grass', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.npcLayer = map.createLayer('NPC', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.trainerVisionLayer = map.createLayer('TrainerVision', tiles, 0, 0)?.setScale(WORLD_SCALE)

    this.applyLayerRenderState(groundLayer, { visible: true, depth: 0, alpha: 1 })
    this.applyLayerRenderState(this.blockedLayer, { visible: true, depth: 1, alpha: 1 })
    this.applyLayerRenderState(this.grassLayer, { visible: true, depth: 2, alpha: 1 })
    this.applyLayerRenderState(this.npcLayer, { visible: false, depth: 4, alpha: 1 })
    this.applyLayerRenderState(this.trainerVisionLayer, { visible: false, depth: 5, alpha: 0.35 })

    this.blockedLayer?.setCollision([TILE_WALL])

    const currentTile = useGameStore.getState().playerTile
    const startTile = currentTile.x > 0 || currentTile.y > 0 ? currentTile : { x: 3, y: 2 }

    this.player = this.physics.add.sprite(
      (startTile.x + 0.5) * TILE_SIZE * WORLD_SCALE,
      (startTile.y + 1) * TILE_SIZE * WORLD_SCALE,
      'player-down-0',
    )

    const shopNpc = this.findNpcTile(1)
    const pcNpc = this.findNpcTile(2)
    const oakNpc = this.findNpcTile(4)

    if (shopNpc) {
      this.shopLabelText = this.add.text(
        (shopNpc.x - 0.1) * TILE_SIZE * WORLD_SCALE,
        (shopNpc.y - 0.2) * TILE_SIZE * WORLD_SCALE,
        ko.overworld.shopLabel,
        {
          color: '#fbbf24',
          fontSize: '10px',
          align: 'center',
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        },
      )
    }

    if (pcNpc) {
      this.pcLabelText = this.add.text(
        (pcNpc.x + 0.05) * TILE_SIZE * WORLD_SCALE,
        (pcNpc.y + 0.6) * TILE_SIZE * WORLD_SCALE,
        ko.overworld.pcLabel,
        {
          color: '#38bdf8',
          fontSize: '10px',
          align: 'center',
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        },
      )
    }


    if (oakNpc) {
      this.oakSprite = this.add.image(
        (oakNpc.x + 0.5) * TILE_SIZE * WORLD_SCALE,
        (oakNpc.y + 1) * TILE_SIZE * WORLD_SCALE,
        'npc-oak',
      )
      this.oakSprite.setOrigin(0.5, 1)
      this.oakSprite.setScale(WORLD_SCALE)
      this.oakSprite.setDepth(11)

      this.oakLabelText = this.add.text(
        (oakNpc.x - 0.2) * TILE_SIZE * WORLD_SCALE,
        (oakNpc.y - 0.45) * TILE_SIZE * WORLD_SCALE,
        ko.overworld.oakLabel,
        {
          color: '#f8fafc',
          fontSize: '10px',
          align: 'center',
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        },
      )
      this.oakLabelText.setDepth(20)
    }

    this.player.setOrigin(0.5, 1)
    this.player.setScale(WORLD_SCALE)
    this.player.setDepth(10)
    this.player.setCollideWorldBounds(true)

    this.debugMoveGraphics = this.add.graphics()
    this.debugMoveGraphics.setDepth(30)

    if (this.blockedLayer) {
      this.physics.add.collider(this.player, this.blockedLayer)
    }

    const worldWidth = map.widthInPixels * WORLD_SCALE
    const worldHeight = map.heightInPixels * WORLD_SCALE
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.setScroll(0, 0)
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight)
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2)
    this.cameras.main.roundPixels = true
    this.updateCameraZoom()
    this.applyOverworldTextScale()
    this.updateDebugSnapshot(map, [groundLayer, this.blockedLayer, this.grassLayer, this.npcLayer, this.trainerVisionLayer])
    this.scale.on('resize', this.updateCameraZoom, this)
    this.scale.on('resize', this.applyOverworldTextScale, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.updateCameraZoom, this)
      this.scale.off('resize', this.applyOverworldTextScale, this)
      this.debugMoveGraphics?.destroy()
      this.oakSprite?.destroy()
      this.oakLabelText?.destroy()
      this.debugMoveGraphics = undefined
      this.oakSprite = undefined
      this.oakLabelText = undefined
      this.lastDebugTile = undefined
      window.__overworldDebug = undefined
    })

      this.cursors = this.input.keyboard?.createCursorKeys() ?? ({} as Phaser.Types.Input.Keyboard.CursorKeys)
      this.interactKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A)

      useGameStore.getState().setSceneReady(true)
    } catch (error) {
      console.error('[overworld] create failed', {
        error,
        mapKey: MAP_KEY,
        tilesetKey: TILESET_KEY,
      })
      throw error
    }
  }

  update() {
    if (!this.player || !this.cursors) {
      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0)

    this.mapDebug.cameraZoom = this.cameras.main.zoom
    this.mapDebug.cameraScrollX = this.cameras.main.scrollX
    this.mapDebug.cameraScrollY = this.cameras.main.scrollY
    const cameraBounds = this.cameras.main.getBounds()
    this.mapDebug.cameraBounds = {
      x: cameraBounds.x,
      y: cameraBounds.y,
      width: cameraBounds.width,
      height: cameraBounds.height,
    }
    window.__overworldDebug = { ...this.mapDebug }

    const virtualInput = useGameStore.getState().virtualInput

    if (this.cursors.left?.isDown || virtualInput.left) {
      body.setVelocityX(-PLAYER_SPEED)
    } else if (this.cursors.right?.isDown || virtualInput.right) {
      body.setVelocityX(PLAYER_SPEED)
    }

    if (this.cursors.up?.isDown || virtualInput.up) {
      body.setVelocityY(-PLAYER_SPEED)
    } else if (this.cursors.down?.isDown || virtualInput.down) {
      body.setVelocityY(PLAYER_SPEED)
    }

    body.velocity.normalize().scale(PLAYER_SPEED)
    this.updatePlayerAnimation(body.velocity.x, body.velocity.y)

    const tileUnit = TILE_SIZE * WORLD_SCALE
    let tileX = Math.floor(body.center.x / tileUnit)
    let tileY = Math.floor((body.bottom - 1) / tileUnit)

    const warped = this.applyEdgeWarp(tileX, tileY)
    if (warped) {
      tileX = warped.x
      tileY = warped.y
    }

    const grassTile = this.grassLayer?.getTileAt(tileX, tileY)
    const inGrass = Boolean(grassTile && grassTile.index !== -1)

    const state = useGameStore.getState()

    state.setPlayerTile(tileX, tileY)

    if (state.debugMoveRange) {
      const movedTile = this.lastDebugTile?.x !== tileX || this.lastDebugTile?.y !== tileY
      if (movedTile) {
        this.drawDebugMoveRange(tileX, tileY)
        this.lastDebugTile = { x: tileX, y: tileY }
      }
    } else if (this.debugMoveGraphics && this.debugMoveGraphics.visible) {
      this.debugMoveGraphics.clear()
      this.debugMoveGraphics.setVisible(false)
      this.lastDebugTile = undefined
    }

    const nearbyNpc = this.getNearbyNpc(tileX, tileY)
    state.setNearbyNpc(nearbyNpc)

    const keyboardInteract = this.interactKey ? Phaser.Input.Keyboard.JustDown(this.interactKey) : false
    if (keyboardInteract && (nearbyNpc === 'shop' || nearbyNpc === 'pc' || nearbyNpc === 'oak')) {
      state.requestNpcInteract()
    }

    const debugRouteMode = window.__debugRouteMode ?? null
    const mapOnlyDebug = debugRouteMode === 'map'

    const steppedTrainer = getGymTrainers().find((entry) => {
      const pos = trainerPositions[entry.id]
      return pos?.x === tileX && pos?.y === tileY
    })

    const visionTrainerId = this.getTrainerIdFromVision(tileX, tileY)
    const visionTrainer = visionTrainerId ? getGymTrainers().find((entry) => entry.id === visionTrainerId) : null
    const trainer = steppedTrainer ?? visionTrainer

    if (!mapOnlyDebug && trainer && !state.defeatedTrainers.includes(trainer.id)) {
      state.triggerTrainerBattle(trainer)
    }

    if (!mapOnlyDebug && inGrass && !this.wasInGrass && Math.random() < WILD_ENCOUNTER_CHANCE) {
      state.triggerEncounter(tileX, tileY)
    }

    if (state.battle.active) {
      this.scene.start('battle')
      return
    }

    this.wasInGrass = inGrass
  }

  private findNpcTile(tileIndex: number): { x: number; y: number } | null {
    if (!this.npcLayer) {
      return null
    }

    for (let y = 0; y < this.npcLayer.layer.height; y += 1) {
      for (let x = 0; x < this.npcLayer.layer.width; x += 1) {
        const tile = this.npcLayer.getTileAt(x, y)
        if (tile?.index === tileIndex) {
          return { x, y }
        }
      }
    }

    return null
  }

  private getTrainerIdFromVision(tileX: number, tileY: number): string | null {
    if (!this.trainerVisionLayer) {
      return null
    }

    const tile = this.trainerVisionLayer.getTileAt(tileX, tileY)
    if (!tile || tile.index <= 0) {
      return null
    }

    return trainerVisionTiles[`${tileX},${tileY}`] ?? null
  }

  private applyEdgeWarp(tileX: number, tileY: number): { x: number; y: number } | null {
    if (!this.blockedLayer || this.time.now < this.warpCooldownUntil) {
      return null
    }

    const width = this.blockedLayer.layer.width
    const height = this.blockedLayer.layer.height

    let nextX = tileX
    let nextY = tileY
    let hasWarped = false

    if (tileX <= 0) {
      nextX = width - 2
      hasWarped = true
    } else if (tileX >= width - 1) {
      nextX = 1
      hasWarped = true
    }

    if (tileY <= 0) {
      nextY = height - 2
      hasWarped = true
    } else if (tileY >= height - 1) {
      nextY = 1
      hasWarped = true
    }

    if (!hasWarped) {
      return null
    }

    this.player.setPosition((nextX + 0.5) * TILE_SIZE * WORLD_SCALE, (nextY + 1) * TILE_SIZE * WORLD_SCALE)
    this.warpCooldownUntil = this.time.now + 240
    return { x: nextX, y: nextY }
  }

  private getNearbyNpc(tileX: number, tileY: number): NearbyNpc {
    if (!this.npcLayer) {
      return null
    }

    const offsets = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]

    for (const [dx, dy] of offsets) {
      const tile = this.npcLayer.getTileAt(tileX + dx, tileY + dy)
      if (tile?.index === 1) {
        return 'shop'
      }
      if (tile?.index === 2) {
        return 'pc'
      }
      if (tile?.index === 4) {
        return 'oak'
      }
    }

    return null
  }

  private drawDebugMoveRange(originX: number, originY: number) {
    if (!this.debugMoveGraphics) {
      return
    }

    const maxSteps = 3
    const keyFor = (x: number, y: number) => `${x},${y}`
    const queue: Array<{ x: number; y: number; steps: number }> = [{ x: originX, y: originY, steps: 0 }]
    const visited = new Set<string>([keyFor(originX, originY)])
    const reachable: Array<{ x: number; y: number }> = []

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        break
      }

      reachable.push({ x: current.x, y: current.y })

      if (current.steps >= maxSteps) {
        continue
      }

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ]

      for (const next of neighbors) {
        const key = keyFor(next.x, next.y)
        if (visited.has(key) || !this.isWalkableTile(next.x, next.y)) {
          continue
        }

        visited.add(key)
        queue.push({ x: next.x, y: next.y, steps: current.steps + 1 })
      }
    }

    this.debugMoveGraphics.clear()
    this.debugMoveGraphics.setVisible(true)

    this.debugMoveGraphics.lineStyle(1.5, 0x60a5fa, 0.5)
    this.debugMoveGraphics.fillStyle(0x22d3ee, 0.7)

    for (const tile of reachable) {
      if (tile.x === originX && tile.y === originY) {
        continue
      }

      const centerX = (tile.x + 0.5) * TILE_SIZE * WORLD_SCALE
      const centerY = (tile.y + 0.5) * TILE_SIZE * WORLD_SCALE

      this.debugMoveGraphics.fillCircle(centerX, centerY, 2.5)
      this.debugMoveGraphics.lineBetween(
        (originX + 0.5) * TILE_SIZE * WORLD_SCALE,
        (originY + 0.5) * TILE_SIZE * WORLD_SCALE,
        centerX,
        centerY,
      )
    }
  }

  private isWalkableTile(tileX: number, tileY: number): boolean {
    if (!this.blockedLayer || !this.npcLayer) {
      return false
    }

    if (tileX < 0 || tileY < 0 || tileX >= this.blockedLayer.layer.width || tileY >= this.blockedLayer.layer.height) {
      return false
    }

    const blockedTile = this.blockedLayer.getTileAt(tileX, tileY)
    if (blockedTile?.collides) {
      return false
    }

    const npcTile = this.npcLayer.getTileAt(tileX, tileY)
    return !(npcTile && npcTile.index > 0)
  }

  private applyLayerRenderState(
    layer: Phaser.Tilemaps.TilemapLayer | undefined,
    options: { visible: boolean; depth: number; alpha: number },
  ) {
    if (!layer) {
      return
    }

    layer.setVisible(options.visible)
    layer.setAlpha(options.alpha)
    layer.setDepth(options.depth)
  }

  private updateDebugSnapshot(
    map: Phaser.Tilemaps.Tilemap,
    layers: Array<Phaser.Tilemaps.TilemapLayer | undefined>,
  ) {
    const cameraBounds = this.cameras.main.getBounds()

    this.mapDebug = {
      mapKey: MAP_KEY,
      mapLoaded: true,
      widthTiles: map.width,
      heightTiles: map.height,
      widthPixels: map.widthInPixels * WORLD_SCALE,
      heightPixels: map.heightInPixels * WORLD_SCALE,
      cameraZoom: this.cameras.main.zoom,
      cameraScrollX: this.cameras.main.scrollX,
      cameraScrollY: this.cameras.main.scrollY,
      cameraBounds: {
        x: cameraBounds.x,
        y: cameraBounds.y,
        width: cameraBounds.width,
        height: cameraBounds.height,
      },
      layers: layers.map((layer, index) => ({
        name: layer?.layer.name ?? `unknown-${index}`,
        exists: Boolean(layer),
        visible: layer?.visible ?? false,
        alpha: layer?.alpha ?? 0,
        depth: layer?.depth ?? 0,
        tint: (layer as unknown as { tint?: number } | undefined)?.tint ?? 0xffffff,
      })),
    }

    window.__overworldDebug = { ...this.mapDebug }
  }

  private updateCameraZoom() {
    const targetWidth = 800
    const targetHeight = 480
    const scaleX = this.scale.width / targetWidth
    const scaleY = this.scale.height / targetHeight
    const zoom = Math.max(1.6, Math.min(2.8, Math.min(scaleX, scaleY) * BASE_CAMERA_ZOOM))
    this.cameras.main.setZoom(zoom)
    this.mapDebug.cameraZoom = zoom
  }

  private applyOverworldTextScale() {
    const responsiveScale = Math.min(this.scale.width / 800, this.scale.height / 480)
    const tileWidth = TILE_SIZE * WORLD_SCALE * responsiveScale
    const fontSize = Math.max(Math.round(10 * TEXT_SCALE_MULTIPLIER), Math.round(tileWidth * 0.55 * TEXT_SCALE_MULTIPLIER))
    this.shopLabelText?.setFontSize(fontSize)
    this.pcLabelText?.setFontSize(fontSize)
    this.oakLabelText?.setFontSize(fontSize)
  }

  private createTilesTexture() {
    if (this.textures.exists(TILESET_KEY)) {
      return
    }

    const textureWidth = TILE_SIZE * TILE_WALL
    const textureHeight = TILE_SIZE
    const texture = this.textures.createCanvas(TILESET_KEY, textureWidth, textureHeight)
    if (!texture) {
      throw new Error(`[overworld] Failed to create tiles texture canvas: ${TILESET_KEY}`)
    }

    const context = texture.context

    const groundX = TILE_SIZE * (TILE_GROUND - 1)
    const grassX = TILE_SIZE * (TILE_GRASS - 1)
    const wallX = TILE_SIZE * (TILE_WALL - 1)

    // Ground tile (path)
    context.fillStyle = '#667a3e'
    context.fillRect(groundX, 0, TILE_SIZE, TILE_SIZE)
    context.fillStyle = '#748847'
    context.fillRect(groundX, TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2)

    // Grass tile (encounter zone)
    context.fillStyle = '#2d8d43'
    context.fillRect(grassX, 0, TILE_SIZE, TILE_SIZE)
    context.strokeStyle = '#165a28'
    context.lineWidth = 1
    context.strokeRect(grassX + 1.5, 1.5, TILE_SIZE - 3, TILE_SIZE - 3)
    context.fillStyle = '#4ec262'
    context.fillRect(grassX + 2, 3, 2, 6)
    context.fillRect(grassX + 7, 5, 2, 7)
    context.fillRect(grassX + 11, 2, 2, 5)

    // Wall tile (blocked)
    context.fillStyle = '#5b4630'
    context.fillRect(wallX, 0, TILE_SIZE, TILE_SIZE)
    context.strokeStyle = '#2f2418'
    context.strokeRect(wallX + 1.5, 1.5, TILE_SIZE - 3, TILE_SIZE - 3)
    context.beginPath()
    context.moveTo(wallX, TILE_SIZE / 2)
    context.lineTo(wallX + TILE_SIZE, TILE_SIZE / 2)
    context.moveTo(wallX + TILE_SIZE / 2, 0)
    context.lineTo(wallX + TILE_SIZE / 2, TILE_SIZE)
    context.stroke()

    texture.refresh()
  }

  private createPlayerFrameTextures() {
    const drawFrame = (key: string, direction: 'down' | 'up' | 'left' | 'right', walkVariant: 0 | 1) => {
      if (this.textures.exists(key)) {
        return
      }

      const graphics = this.add.graphics({ x: 0, y: 0 })
      graphics.fillStyle(direction === 'up' ? 0x1e3a8a : 0x1d4ed8)
      graphics.fillRect(1, 4, 10, 8)

      graphics.fillStyle(0xf8fafc)
      graphics.fillRect(2, 1, 8, 4)

      graphics.fillStyle(0x111827)
      if (direction === 'left') {
        graphics.fillRect(2, 2, 1, 1)
      } else if (direction === 'right') {
        graphics.fillRect(8, 2, 1, 1)
      } else {
        graphics.fillRect(4, 2, 1, 1)
        graphics.fillRect(7, 2, 1, 1)
      }

      graphics.fillStyle(0x0f172a)
      if (walkVariant === 1) {
        graphics.fillRect(1, 12, 4, 4)
        graphics.fillRect(7, 11, 4, 5)
      } else {
        graphics.fillRect(2, 12, 3, 4)
        graphics.fillRect(7, 12, 3, 4)
      }

      if (direction !== 'up') {
        graphics.fillStyle(0x93c5fd)
        if (direction === 'left') {
          graphics.fillRect(0, 6, 1, 4)
        } else if (direction === 'right') {
          graphics.fillRect(10, 6, 1, 4)
        } else {
          graphics.fillRect(10, 6, 1, 4)
        }
      }

      graphics.generateTexture(key, 12, 16)
      graphics.destroy()
    }

    const directions: Array<'down' | 'up' | 'left' | 'right'> = ['down', 'up', 'left', 'right']
    for (const direction of directions) {
      drawFrame(`player-${direction}-0`, direction, 0)
      drawFrame(`player-${direction}-1`, direction, 1)
    }
  }


  private createOakNpcTexture() {
    if (this.textures.exists('npc-oak')) {
      return
    }

    const graphics = this.add.graphics({ x: 0, y: 0 })
    graphics.fillStyle(0x111827)
    graphics.fillRect(2, 2, 8, 4)

    graphics.fillStyle(0xe5e7eb)
    graphics.fillRect(1, 6, 10, 5)
    graphics.fillStyle(0x374151)
    graphics.fillRect(4, 7, 1, 1)
    graphics.fillRect(7, 7, 1, 1)

    graphics.fillStyle(0xffffff)
    graphics.fillRect(0, 10, 12, 4)

    graphics.fillStyle(0x1f2937)
    graphics.fillRect(1, 14, 4, 2)
    graphics.fillRect(7, 14, 4, 2)

    graphics.generateTexture('npc-oak', 12, 16)
    graphics.destroy()
  }

  private updatePlayerAnimation(velocityX: number, velocityY: number) {
    const threshold = 12
    if (Math.abs(velocityX) <= threshold && Math.abs(velocityY) <= threshold) {
      this.player.setTexture(`player-${this.lastFacingDirection}-0`)
      return
    }

    if (Math.abs(velocityX) > Math.abs(velocityY)) {
      this.lastFacingDirection = velocityX > 0 ? 'right' : 'left'
    } else {
      this.lastFacingDirection = velocityY > 0 ? 'down' : 'up'
    }

    this.walkFrameCursor += this.game.loop.delta
    const stepFrame: 0 | 1 = Math.floor(this.walkFrameCursor / 120) % 2 === 0 ? 0 : 1
    this.player.setTexture(`player-${this.lastFacingDirection}-${stepFrame}`)
  }
}
