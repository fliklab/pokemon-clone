import Phaser from 'phaser'
import { getGymTrainers, useGameStore } from '../../store/useGameStore'

const TILE_SIZE = 16
const WORLD_SCALE = 2
const BASE_CAMERA_ZOOM = 2
const PLAYER_SPEED = 140

const trainerPositions: Record<string, { x: number; y: number }> = {
  'junior-mia': { x: 9, y: 4 },
  'ace-ryu': { x: 10, y: 6 },
  'leader-nova': { x: 9, y: 7 },
}

export class OverworldScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite
  private grassLayer?: Phaser.Tilemaps.TilemapLayer
  private wasInGrass = false

  constructor() {
    super('overworld')
  }

  preload() {
    this.load.tilemapTiledJSON('overworld-map', '/maps/overworld.json')
  }

  create() {
    this.createTilesTexture()
    this.createPlayerTexture()

    const map = this.make.tilemap({ key: 'overworld-map' })
    const tiles = map.addTilesetImage('overworld', 'overworld-tiles')

    if (!tiles) {
      throw new Error('Failed to load tileset for overworld map')
    }

    map.createLayer('Ground', tiles, 0, 0)?.setScale(WORLD_SCALE)
    const blockedLayer = map.createLayer('Blocked', tiles, 0, 0)?.setScale(WORLD_SCALE)
    this.grassLayer = map.createLayer('Grass', tiles, 0, 0)?.setScale(WORLD_SCALE)

    blockedLayer?.setCollisionByExclusion([-1, 0])

    this.player = this.physics.add.sprite(TILE_SIZE * WORLD_SCALE * 2.5, TILE_SIZE * WORLD_SCALE * 3, 'player')
    this.player.setOrigin(0.5, 1)
    this.player.setScale(WORLD_SCALE)
    this.player.setDepth(10)
    this.player.setCollideWorldBounds(true)

    if (blockedLayer) {
      this.physics.add.collider(this.player, blockedLayer)
    }

    this.cameras.main.setBounds(0, 0, map.widthInPixels * WORLD_SCALE, map.heightInPixels * WORLD_SCALE)
    this.physics.world.setBounds(0, 0, map.widthInPixels * WORLD_SCALE, map.heightInPixels * WORLD_SCALE)
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2)
    this.cameras.main.roundPixels = true
    this.updateCameraZoom()
    this.scale.on('resize', this.updateCameraZoom, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.updateCameraZoom, this)
    })

    this.cursors = this.input.keyboard?.createCursorKeys() ?? ({} as Phaser.Types.Input.Keyboard.CursorKeys)

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

    const tileX = Math.floor(this.player.x / (TILE_SIZE * WORLD_SCALE))
    const tileY = Math.floor(this.player.y / (TILE_SIZE * WORLD_SCALE))
    const inGrass = this.grassLayer?.hasTileAt(tileX, tileY) ?? false

    const state = useGameStore.getState()

    const trainer = getGymTrainers().find((entry) => {
      const pos = trainerPositions[entry.id]
      return pos?.x === tileX && pos?.y === tileY
    })

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

    state.setPlayerTile(tileX, tileY)
  }

  private updateCameraZoom() {
    const targetWidth = 800
    const targetHeight = 480
    const scaleX = this.scale.width / targetWidth
    const scaleY = this.scale.height / targetHeight
    const zoom = Math.max(1.6, Math.min(2.8, Math.min(scaleX, scaleY) * BASE_CAMERA_ZOOM))
    this.cameras.main.setZoom(zoom)
  }

  private createTilesTexture() {
    if (this.textures.exists('overworld-tiles')) {
      return
    }

    const graphics = this.add.graphics({ x: 0, y: 0 })

    graphics.fillStyle(0x5b7c3f)
    graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE)

    graphics.fillStyle(0x3f8c3c)
    graphics.fillRect(TILE_SIZE, 0, TILE_SIZE, TILE_SIZE)
    graphics.lineStyle(1, 0x266326)
    graphics.strokeRect(TILE_SIZE + 1, 1, TILE_SIZE - 2, TILE_SIZE - 2)

    graphics.fillStyle(0x6b4f2a)
    graphics.fillRect(TILE_SIZE * 2, 0, TILE_SIZE, TILE_SIZE)

    graphics.generateTexture('overworld-tiles', TILE_SIZE * 3, TILE_SIZE)
    graphics.destroy()
  }

  private createPlayerTexture() {
    if (this.textures.exists('player')) {
      return
    }

    const graphics = this.add.graphics({ x: 0, y: 0 })
    graphics.fillStyle(0x1d4ed8)
    graphics.fillRect(0, 0, 12, 16)
    graphics.fillStyle(0xf8fafc)
    graphics.fillRect(2, 2, 8, 4)
    graphics.generateTexture('player', 12, 16)
    graphics.destroy()
  }
}
