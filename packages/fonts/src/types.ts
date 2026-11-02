/** A single-line ("plotter") font: each glyph is the path a pen travels. */
export interface InkHand {
  key: string;
  name: string;
  /** Units per em. */
  upm: number;
  ascent: number;
  descent: number;
  xh: number;
  cap: number;
  /** char -> [advance width, SVG path data of centrelines] */
  g: Record<string, [number, string]>;
  /** Invisible webfont (data URI) with identical advances, for ink-written inputs. */
  metrics: string;
}
