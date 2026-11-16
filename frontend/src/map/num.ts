/**
 * The small number helpers of the map and 3D modules, one definition each (code review 08:F20). Before, `rad`, `deg`,
 * `isNum`, `clamp`, `round5` and three different `r4` were re-typed per file.
 *
 * The three 0.1 mm rounding rules are NOT interchangeable and stay apart on purpose: the scene description is hashed (the
 * AO volume cache, the still set, the determinism specs), so a value must not move by one ulp and a zero must keep its
 * sign. `Math.round(x)` and `Math.floor(x + 0.5)` differ at the largest double below a half (0.49999999999999994) and
 * in the sign of a zero (`Math.round(-0.2)` is -0, `Math.floor(-0.2 + 0.5)` is 0); `+ 0` turns -0 into 0.
 */

/** Degrees to radians. */
export const rad = (d: number): number => (d * Math.PI) / 180;

/** Radians to degrees. */
export const deg = (r: number): number => (r * 180) / Math.PI;

/** A finite number (not NaN, not an infinity, not a numeric string). */
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** `v` held inside [lo, hi] (a `lo` above `hi` answers `hi`). */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Five decimals of a normalised plan coordinate (the geometry document's precision). */
export const round5 = (v: number): number => Math.round(v * 1e5) / 1e5;

/** The scene description's rule: half-up to 0.1 mm, the r2 rule of the primitives one digit further (metres, not pixels). */
export const r4 = (v: number): number => Math.floor(v * 1e4 + 0.5) / 1e4;

/** The walk world's rule: `r4` with a negative zero made a plain zero. */
export const r4z = (v: number): number => Math.floor(v * 1e4 + 0.5) / 1e4 + 0;

/** The walk controller's rule: `Math.round` to 0.1 mm with a negative zero made a plain zero. */
export const r4round = (v: number): number => Math.round(v * 1e4) / 1e4 + 0;
