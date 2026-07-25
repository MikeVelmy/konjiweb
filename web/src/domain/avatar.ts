/**
 * The avatar is the whole visual identity of a Konji user before a face reveal,
 * so it has to carry enough variation for two people to feel distinct without
 * ever encoding anything about how they actually look.
 *
 * A sprite is a 7x9 pixel grid, described here as rows of characters:
 *   h = skin, a = hair/accent, o = outfit, t = outfit trim, . = transparent
 *
 * Heads occupy rows 0-4 (the last row being the neck) and outfits rows 5-8.
 * Keeping the two halves separate is what lets a user recolour their outfit
 * without touching their skin tone.
 */

export const SPRITE_WIDTH = 7;
export const SPRITE_HEIGHT = 9;

export type SpriteCell = 'h' | 'a' | 'o' | 't' | '.';

export const skins = [
  {
    id: 'round',
    label: 'Round',
    rows: ['..hhh..', '.hhhhh.', '.hhhhh.', '..hhh..', '..hhh..'],
  },
  {
    id: 'crop',
    label: 'Crop',
    rows: ['..aaa..', '.aahaa.', '.hhhhh.', '..hhh..', '..hhh..'],
  },
  {
    id: 'locs',
    label: 'Locs',
    rows: ['..aaa..', '.ahhha.', '.ahhha.', '..hhh..', '..hhh..'],
  },
  {
    id: 'wrap',
    label: 'Wrap',
    rows: ['..aaa..', '.aaaaa.', '.hhhhh.', '..hhh..', '..hhh..'],
  },
] as const;

export const outfits = [
  {
    id: 'plain',
    label: 'Plain',
    rows: ['.ooooo.', 'ooooooo', 'ooooooo', 'ooooooo'],
  },
  {
    id: 'tank',
    label: 'Tank',
    rows: ['.ooooo.', 'hoooooh', 'hoooooh', '.ooooo.'],
  },
  {
    id: 'hoodie',
    label: 'Hoodie',
    rows: ['tooooot', 'ooooooo', 'otooooo', 'ooooooo'],
  },
  {
    id: 'jacket',
    label: 'Jacket',
    rows: ['.ooooo.', 'oootooo', 'oootooo', 'oootooo'],
  },
] as const;

export type SkinId = (typeof skins)[number]['id'];
export type OutfitId = (typeof outfits)[number]['id'];

export type AvatarConfig = {
  skin: SkinId;
  /** Colour of the skin pixels; also the user's signature colour across the app. */
  color: string;
  outfit: OutfitId;
  outfitColor: string;
  hairColor: string;
};

export const defaultAvatar: AvatarConfig = {
  skin: 'round',
  color: '#FF4438',
  outfit: 'plain',
  outfitColor: '#262320',
  hairColor: '#1A1512',
};

/** Flattens a config into the 9 sprite rows, head stacked on top of outfit. */
export function spriteRows(config: AvatarConfig): string[] {
  const skin = skins.find((s) => s.id === config.skin) ?? skins[0];
  const outfit = outfits.find((o) => o.id === config.outfit) ?? outfits[0];
  return [...skin.rows, ...outfit.rows];
}

export function cellColor(cell: SpriteCell, config: AvatarConfig): string | null {
  switch (cell) {
    case 'h':
      return config.color;
    case 'a':
      return config.hairColor;
    case 'o':
      return config.outfitColor;
    case 't':
      return config.color;
    default:
      return null;
  }
}

/** Deterministic avatar for seeded mock users, so the same id always looks the same. */
export function avatarFromSeed(seed: string, palette: string[]): AvatarConfig {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return {
    skin: skins[hash % skins.length].id,
    color: palette[hash % palette.length],
    // Unsigned shift: `>>` is signed, so seeds whose hash has the top bit set
    // would yield a negative index and blow up on a perfectly valid user id.
    outfit: outfits[(hash >>> 3) % outfits.length].id,
    outfitColor: '#262320',
    hairColor: '#1A1512',
  };
}
