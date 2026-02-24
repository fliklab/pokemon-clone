import Phaser from 'phaser'
import { useGameStore } from '../../store/useGameStore'

const TILE_SIZE = 16
const SCALE = 2
const PLAYER_SPEED = 140

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

    map.createLayer('Ground', tiles, 0, 0)?.setScale(SCALE)
    const blockedLayer = map.createLayer('Blocked', tiles, 0, 0)?.setScale(SCALE)
    this.grassLayer = map.createLayer('Grass', tiles, 0, 0)?.setScale(SCALE)

    blockedLayer?.setCollisionByExclusion([-1, 0])

    this.player = this.physics.add.sprite(TILE_SIZE * SCALE * 2, TILE_SIZE * SCALE * 2, 'player')
    this.player.setCollideWorldBounds(true)

    if (blockedLayer) {
      this.physics.add.collider(this.player, blockedLayer)
    }

    this.cameras.main.setBounds(0, 0, map.widthInPixels * SCALE, map.heightInPixels * SCALE)
    this.physics.world.setBounds(0, 0, map.widthInPixels * SCALE, map.heightInPixels * SCALE)
    this.cameras.main.startFollow(this.player, true, 0.2, 0.2)
    this.cameras.main.setZoom(2)
    this.cameras.main.roundPixels = true

    this.cursors = this.input.keyboard?.createCursorKeys() ?? ({} as Phaser.Types.Input.Keyboard.CursorKeys)

    useGameStore.getState().setSceneReady(true)
  }

  update() {
    if (!this.player || !this.cursors) {
      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0)

    if (this.cursors.left?.isDown) {
      body.setVelocityX(-PLAYER_SPEED)
    } else if (this.cursors.right?.isDown) {
      body.setVelocityX(PLAYER_SPEED)
    }

    if (this.cursors.up?.isDown) {
      body.setVelocityY(-PLAYER_SPEED)
    } else if (this.cursors.down?.isDown) {
      body.setVelocityY(PLAYER_SPEED)
    }

    body.velocity.normalize().scale(PLAYER_SPEED)

    const tileX = Math.floor(this.player.x / (TILE_SIZE * SCALE))
    const tileY = Math.floor(this.player.y / (TILE_SIZE * SCALE))
    const inGrass = this.grassLayer?.hasTileAt(tileX, tileY) ?? false

    if (inGrass && !this.wasInGrass) {
      useGameStore.getState().triggerEncounter(tileX, tileY)
    }

    this.wasInGrass = inGrass

    useGameStore.getState().setPlayerTile(tileX, tileY)
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
