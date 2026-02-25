import Phaser from 'phaser'
import { ko } from '../../i18n/ko'
import { getGymTrainers, useGameStore } from '../../store/useGameStore'

const TILE_SIZE = 16
const WORLD_SCALE = 2
const BASE_CAMERA_ZOOM = 2
const PLAYER_SPEED = 140
const TEXT_SCALE_MULTIPLIER = 1.4

const TILE_GROUND = 1
const TILE_GRASS = 2
const TILE_WALL = 3

type NearbyNpc = 'shop' | 'pc' | 'oak' | null

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
  private wasInGrass = false
  private lastFacingDirection: 'down' | 'up' | 'left' | 'right' = 'down'
  private walkFrameCursor = 0
  private warpCooldownUntil = 0

  constructor() {
    super('overworld')
  }

  preload() {
    this.load.tilemapTiledJSON('overworld-map', '/maps/overworld.json')
  }

  create() {
    this.createTilesTexture()
    this.createPlayerFrameTextures()

    const map = this.make.tilemap({ key: 'overworld-map' })
    const tiles = map.addTilesetImage('overworld', 'overworld-tiles')

    if (!tiles) {
      throw new Error('Failed to load tileset for overworld map')
    }

    map.createLayer('Ground', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.blockedLayer = map.createLayer('Blocked', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.grassLayer = map.createLayer('Grass', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.npcLayer = map.createLayer('NPC', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.trainerVisionLayer = map.createLayer('TrainerVision', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.npcLayer?.setVisible(false)
    this.trainerVisionLayer?.setVisible(false)

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

    this.player.setOrigin(0.5, 1)
    this.player.setScale(WORLD_SCALE)
    this.player.setDepth(10)
    this.player.setCollideWorldBounds(true)

    this.debugMoveGraphics = this.add.graphics()
    this.debugMoveGraphics.setDepth(30)

    if (this.blockedLayer) {
      this.physics.add.collider(this.player, this.blockedLayer)
    }

    this.cameras.main.setBounds(0, 0, map.widthInPixels * WORLD_SCALE, map.heightInPixels * WORLD_SCALE)
    this.physics.world.setBounds(0, 0, map.widthInPixels * WORLD_SCALE, map.heightInPixels * WORLD_SCALE)
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2)
    this.cameras.main.roundPixels = true
    this.updateCameraZoom()
    this.applyOverworldTextScale()
    this.scale.on('resize', this.updateCameraZoom, this)
    this.scale.on('resize', this.applyOverworldTextScale, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.updateCameraZoom, this)
      this.scale.off('resize', this.applyOverworldTextScale, this)
      this.debugMoveGraphics?.destroy()
      this.debugMoveGraphics = undefined
      this.lastDebugTile = undefined
    })

    this.cursors = this.input.keyboard?.createCursorKeys() ?? ({} as Phaser.Types.Input.Keyboard.CursorKeys)
    this.interactKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A)

    useGameStore.getState().setSceneReady(true)
  }

  update() {
    if (!this.player || !this.cursors) {
      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0)

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

    let tileX = Math.floor(this.player.x / (TILE_SIZE * WORLD_SCALE))
    let tileY = Math.floor(this.player.y / (TILE_SIZE * WORLD_SCALE))

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

    const steppedTrainer = getGymTrainers().find((entry) => {
      const pos = trainerPositions[entry.id]
      return pos?.x === tileX && pos?.y === tileY
    })

    const visionTrainerId = this.getTrainerIdFromVision(tileX, tileY)
    const visionTrainer = visionTrainerId ? getGymTrainers().find((entry) => entry.id === visionTrainerId) : null
    const trainer = steppedTrainer ?? visionTrainer

    if (trainer && !state.defeatedTrainers.includes(trainer.id)) {
      state.triggerTrainerBattle(trainer)
    }

    if (inGrass && !this.wasInGrass) {
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

  private updateCameraZoom() {
    const targetWidth = 800
    const targetHeight = 480
    const scaleX = this.scale.width / targetWidth
    const scaleY = this.scale.height / targetHeight
    const zoom = Math.max(1.6, Math.min(2.8, Math.min(scaleX, scaleY) * BASE_CAMERA_ZOOM))
    this.cameras.main.setZoom(zoom)
  }

  private applyOverworldTextScale() {
    const responsiveScale = Math.min(this.scale.width / 800, this.scale.height / 480)
    const tileWidth = TILE_SIZE * WORLD_SCALE * responsiveScale
    const fontSize = Math.max(Math.round(10 * TEXT_SCALE_MULTIPLIER), Math.round(tileWidth * 0.55 * TEXT_SCALE_MULTIPLIER))
    this.shopLabelText?.setFontSize(fontSize)
    this.pcLabelText?.setFontSize(fontSize)
  }

  private createTilesTexture() {
    if (this.textures.exists('overworld-tiles')) {
      return
    }

    const graphics = this.add.graphics({ x: 0, y: 0 })

    const groundX = TILE_SIZE * (TILE_GROUND - 1)
    const grassX = TILE_SIZE * (TILE_GRASS - 1)
    const wallX = TILE_SIZE * (TILE_WALL - 1)

    // Ground tile (path)
    graphics.fillStyle(0x667a3e)
    graphics.fillRect(groundX, 0, TILE_SIZE, TILE_SIZE)
    graphics.fillStyle(0x748847)
    graphics.fillRect(groundX, TILE_SIZE / 2, TILE_SIZE, TILE_SIZE / 2)

    // Grass tile (encounter zone)
    graphics.fillStyle(0x2d8d43)
    graphics.fillRect(grassX, 0, TILE_SIZE, TILE_SIZE)
    graphics.lineStyle(1, 0x165a28)
    graphics.strokeRect(grassX + 1, 1, TILE_SIZE - 2, TILE_SIZE - 2)
    graphics.fillStyle(0x4ec262)
    graphics.fillRect(grassX + 2, 3, 2, 6)
    graphics.fillRect(grassX + 7, 5, 2, 7)
    graphics.fillRect(grassX + 11, 2, 2, 5)

    // Wall tile (blocked)
    graphics.fillStyle(0x5b4630)
    graphics.fillRect(wallX, 0, TILE_SIZE, TILE_SIZE)
    graphics.lineStyle(1, 0x2f2418)
    graphics.strokeRect(wallX + 1, 1, TILE_SIZE - 2, TILE_SIZE - 2)
    graphics.lineBetween(wallX, TILE_SIZE / 2, wallX + TILE_SIZE, TILE_SIZE / 2)
    graphics.lineBetween(wallX + TILE_SIZE / 2, 0, wallX + TILE_SIZE / 2, TILE_SIZE)

    graphics.generateTexture('overworld-tiles', TILE_SIZE * TILE_WALL, TILE_SIZE)
    graphics.destroy()
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
