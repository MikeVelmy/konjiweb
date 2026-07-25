import { useMemo } from 'react';

import {
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  cellColor,
  spriteRows,
  type AvatarConfig,
  type SpriteCell,
} from '../domain/avatar';

type Props = {
  config: AvatarConfig;
  /** Rendered height in px; width follows the sprite's 7:9 ratio. */
  size: number;
};

/**
 * Each sprite cell becomes a 1x1 rect in a 7x9 viewBox, so the avatar scales to
 * any size without blurring and without shipping raster assets.
 */
export function PixelAvatar({ config, size }: Props) {
  const rects = useMemo(() => {
    const rows = spriteRows(config);
    const out: { key: string; x: number; y: number; fill: string }[] = [];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const fill = cellColor(row[x] as SpriteCell, config);
        if (fill) out.push({ key: `${x}-${y}`, x, y, fill });
      }
    });
    return out;
  }, [config]);

  return (
    <svg
      className="pixel"
      width={(size * SPRITE_WIDTH) / SPRITE_HEIGHT}
      height={size}
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      role="img"
      aria-label="Avatar"
    >
      {rects.map((r) => (
        // 1.02 rather than 1 closes the hairline seams that appear between
        // adjacent rects at fractional scale factors.
        <rect key={r.key} x={r.x} y={r.y} width={1.02} height={1.02} fill={r.fill} />
      ))}
    </svg>
  );
}

export function AvatarFrame({
  config,
  size,
  accent,
}: {
  config: AvatarConfig;
  size: number;
  accent?: boolean;
}) {
  return (
    <div
      className="avatar-frame"
      style={{
        width: size,
        height: size,
        borderColor: accent ? 'var(--amber)' : undefined,
      }}
    >
      <PixelAvatar config={config} size={size * 0.7} />
    </div>
  );
}
