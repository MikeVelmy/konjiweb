import { useMemo } from 'react';

/**
 * The Konji mark: a pixel head with its eyes redacted and its mouth left
 * visible — unseen, but talking, which is the whole product in one glyph.
 *
 * It is drawn on the same 1x1 rect grid as PixelAvatar so the logo and the
 * avatars read as one system rather than two unrelated pieces of art.
 */

const GRID = [
  '..########..',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.###....###.',
  '.##########.',
  '..########..',
];

const COLS = 12;
const ROWS = GRID.length;

/** The censor bar, in grid units. Overlaid rather than cut out of the grid so
 *  it can wipe shut on load without redrawing the head. */
const BAR = { x: 3, y: 4, w: 6, h: 2 };

type Props = {
  /** Rendered height in px; width follows the grid's 12:11 ratio. */
  size: number;
  /** The mark itself. */
  color?: string;
  /** The surface behind the mark — the censor bar is painted in it. */
  ground: string;
  /** Plays the redaction wipe once on mount. */
  animate?: boolean;
  /** Hides the mark from screen readers, for when a wordmark already names it. */
  decorative?: boolean;
};

export function KonjiMark({
  size,
  color = '#ff4438',
  ground,
  animate = false,
  decorative = false,
}: Props) {
  const rects = useMemo(() => {
    const out: { key: string; x: number; y: number }[] = [];
    GRID.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') out.push({ key: `${x}-${y}`, x, y });
      }
    });
    return out;
  }, []);

  return (
    <svg
      width={(size * COLS) / ROWS}
      height={size}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Konji'}
      aria-hidden={decorative || undefined}
      shapeRendering="crispEdges"
    >
      {rects.map((r) => (
        // 1.02 rather than 1 closes the hairline seams that appear between
        // adjacent rects at fractional scale factors.
        <rect key={r.key} x={r.x} y={r.y} width={1.02} height={1.02} fill={color} />
      ))}
      <rect
        className={animate ? 'mark__bar mark__bar--wipe' : 'mark__bar'}
        x={BAR.x}
        y={BAR.y}
        width={BAR.w}
        height={BAR.h}
        fill={ground}
      />
    </svg>
  );
}
