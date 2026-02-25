export type AssetGroup = 'tiles' | 'char' | 'opening'

export type AssetEntry = {
  id: string
  group: AssetGroup
  label: string
  src: string
  note?: string
}

export const debugAssetManifest: AssetEntry[] = [
  {
    id: 'overworld-tiles',
    group: 'tiles',
    label: 'Overworld Tileset',
    src: `${import.meta.env.BASE_URL}maps/overworld-tiles.png`,
    note: 'Tilemap 렌더링에 사용되는 기본 타일셋',
  },
  {
    id: 'tree-tile',
    group: 'tiles',
    label: 'Tree Tile (editor)',
    src: `${import.meta.env.BASE_URL}assets/tile_tree_16x16.png`,
    note: '픽셀 에디터 샘플 타일',
  },
  {
    id: 'grass-tile',
    group: 'tiles',
    label: 'Grass Tile (editor)',
    src: `${import.meta.env.BASE_URL}assets/tile_grass_16x16.png`,
  },
  {
    id: 'path-tile',
    group: 'tiles',
    label: 'Path Tile (editor)',
    src: `${import.meta.env.BASE_URL}assets/tile_path_16x16.png`,
  },
  {
    id: 'water-tile',
    group: 'tiles',
    label: 'Water Tile (editor)',
    src: `${import.meta.env.BASE_URL}assets/tile_water_16x16.png`,
  },
  {
    id: 'embercub',
    group: 'char',
    label: 'Embercub (editor monster)',
    src: `${import.meta.env.BASE_URL}assets/monster_embercub_64x64.png`,
  },
  {
    id: 'leaflet',
    group: 'char',
    label: 'Leaflet (editor monster)',
    src: `${import.meta.env.BASE_URL}assets/monster_leaflet_64x64.png`,
  },
  {
    id: 'aquapup',
    group: 'char',
    label: 'Aquapup (editor monster)',
    src: `${import.meta.env.BASE_URL}assets/monster_aquapup_64x64.png`,
  },
  {
    id: 'og-opening',
    group: 'opening',
    label: 'Opening / OG Image',
    src: `${import.meta.env.BASE_URL}og-image.jpg`,
  },
]

export const assetGroupOrder: AssetGroup[] = ['tiles', 'char', 'opening']

export const assetGroupLabel: Record<AssetGroup, string> = {
  tiles: 'Tiles',
  char: 'Char',
  opening: 'Opening',
}
