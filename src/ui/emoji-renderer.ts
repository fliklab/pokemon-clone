export type AssetType = 'monster' | 'trainer' | 'item' | 'move' | 'unknown';

export interface EmojiAssetMap {
  monster?: string;
  trainer?: string;
  item?: string;
  move?: string;
  unknown?: string;
}

export interface EmojiRendererConfig {
  emojiMode: boolean;
  emojiMap: EmojiAssetMap;
  pixelArtResolver?: (assetKey: string, assetType: AssetType) => string;
}

const DEFAULT_EMOJI_MAP: Required<EmojiAssetMap> = {
  monster: '🐾',
  trainer: '🧢',
  item: '🎒',
  move: '✨',
  unknown: '❔',
};

export class EmojiAssetRenderer {
  private readonly config: EmojiRendererConfig;

  constructor(config: EmojiRendererConfig) {
    this.config = {
      ...config,
      emojiMap: {
        ...DEFAULT_EMOJI_MAP,
        ...config.emojiMap,
      },
    };
  }

  render(assetType: AssetType, assetKey?: string): string {
    const normalizedAssetKey = assetKey?.trim();

    if (this.config.emojiMode) {
      return this.resolveEmoji(assetType, normalizedAssetKey);
    }

    if (this.config.pixelArtResolver && normalizedAssetKey) {
      return this.config.pixelArtResolver(normalizedAssetKey, assetType);
    }

    return normalizedAssetKey ?? assetType;
  }

  private resolveEmoji(assetType: AssetType, assetKey?: string): string {
    const emojiMap = this.config.emojiMap;

    if (assetKey && emojiMap[assetKey as keyof EmojiAssetMap]) {
      return emojiMap[assetKey as keyof EmojiAssetMap] as string;
    }

    return emojiMap[assetType] ?? emojiMap.unknown ?? DEFAULT_EMOJI_MAP.unknown;
  }
}
