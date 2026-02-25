import Phaser from 'phaser'
import mapJsonUrl from '../../assets/maps/overworld.json?url'
import tilesetImageUrl from '../../assets/maps/overworld-tiles.png?url'

const MAP_KEY = 'overworld-map'
const TILESET_KEY = 'overworld-tiles'
const BASE_PATH = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
const MAP_URL = mapJsonUrl
const TILESET_URL = tilesetImageUrl
const MAP_FALLBACK_URL = `${BASE_PATH}maps/overworld.json`
const TILESET_FALLBACK_URL = `${BASE_PATH}maps/overworld-tiles.png`

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super('preloader')
  }

  preload() {
    const { width, height } = this.scale
    const loading = this.add.text(width / 2, height / 2, 'Loading assets...', {
      color: '#e2e8f0',
      fontSize: '16px',
    })
    loading.setOrigin(0.5)

    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key === MAP_KEY && file.src !== MAP_FALLBACK_URL) {
        this.load.tilemapTiledJSON(MAP_KEY, MAP_FALLBACK_URL)
      }

      if (file.key === TILESET_KEY && file.src !== TILESET_FALLBACK_URL) {
        this.load.image(TILESET_KEY, TILESET_FALLBACK_URL)
      }
    })

    if (!this.cache.tilemap.exists(MAP_KEY)) {
      this.load.tilemapTiledJSON(MAP_KEY, MAP_URL)
    }

    if (!this.textures.exists(TILESET_KEY)) {
      this.load.image(TILESET_KEY, TILESET_URL)
    }
  }

  create() {
    const mapReady = this.cache.tilemap.exists(MAP_KEY)
    const tilesReady = this.textures.exists(TILESET_KEY)

    if (!mapReady || !tilesReady) {
      console.warn('[preloader] assets missing after preload; overworld will attempt runtime fallback', {
        mapReady,
        tilesReady,
      })
    }

    this.scene.start('overworld')
  }
}

export default PreloaderScene
