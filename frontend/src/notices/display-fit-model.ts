/**
 * TV-SETTINGS-2380 (Settings rows, release/2380-train): the two TV-fit options of a notice board as the Settings screen sees them -
 * `portrait_chips` (the portrait footer's building chips: two rows / one row with the healthy ones hidden first) and `safe_margin`
 * (the overscan margin, a whole percent 0..5 of each side). The server keeps them in the V2 group of TV options
 * (`services/notices/model.py`, `TV2_CHOICES`): the installation default is `tv2_defaults.<key>` and a board may hold its own value in
 * `display.<key>` (absent = follow the default; `null` in a PATCH removes it). Pure, no DOM: the rows (notices/display-fit.ts) and the
 * unit spec read the same rules.
 *
 * Unlike the string options of `Tv2Defaults`, `safe_margin` is a number and `0` is a real choice (a board turning an installation margin
 * off), so "own value" is "a valid value", never "a truthy value". The server takes a JSON integer only (`2.5`, `"3"`, `true` are 422).
 */
import type { Display } from '../notice-tv/tv-logic';

export type PortraitChips = 'rows' | 'drop';
export type SafeMargin = 0 | 1 | 2 | 3 | 4 | 5;
export const PORTRAIT_CHIPS: readonly PortraitChips[] = ['rows', 'drop'];
export const SAFE_MARGINS: readonly SafeMargin[] = [0, 1, 2, 3, 4, 5];

export interface TvFitDefaults { portrait_chips: PortraitChips; safe_margin: SafeMargin }
export type TvFitKey = keyof TvFitDefaults;
export const TV_FIT_KEYS: readonly TvFitKey[] = ['portrait_chips', 'safe_margin'];
/** The factory values (the server's `TV2_FACTORY` for the two keys). */
export const TVFIT_FACTORY: TvFitDefaults = { portrait_chips: 'rows', safe_margin: 0 };

const okChips = (v: unknown): v is PortraitChips => v === 'rows' || v === 'drop';
const okMargin = (v: unknown): v is SafeMargin => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 5;

/** A board's own value of one key, or null when it follows the installation default (absent, null or not a valid value). */
export function tvFitOwn<K extends TvFitKey>(d: Partial<Pick<Display, TvFitKey>> | null | undefined, k: K): TvFitDefaults[K] | null {
  const v: unknown = d?.[k];
  if (k === 'portrait_chips') return (okChips(v) ? v : null) as TvFitDefaults[K] | null;
  return (okMargin(v) ? v : null) as TvFitDefaults[K] | null;
}

/** The installation defaults as the API sent them (`settings.tv2_defaults`), each value checked; an older backend = the factory values. */
export function tvFitDefaultsOf(raw: Partial<Record<TvFitKey, unknown>> | null | undefined): TvFitDefaults {
  return {
    portrait_chips: okChips(raw?.portrait_chips) ? raw.portrait_chips : TVFIT_FACTORY.portrait_chips,
    safe_margin: okMargin(raw?.safe_margin) ? raw.safe_margin : TVFIT_FACTORY.safe_margin,
  };
}

/** The value in force on a board: its own value, else the installation default. */
export function effectiveTvFit(d: Partial<Pick<Display, TvFitKey>> | null | undefined, defaults: TvFitDefaults): TvFitDefaults {
  return { portrait_chips: tvFitOwn(d, 'portrait_chips') ?? defaults.portrait_chips, safe_margin: tvFitOwn(d, 'safe_margin') ?? defaults.safe_margin };
}

/** The text of one value as [i18n/notices.ts key, vars]: `portraitChips_rows` / `_drop`; `safeMargin_0` ("ללא"), else `safeMargin_pct` ("{n}%"). */
export function tvFitText(k: TvFitKey, v: PortraitChips | SafeMargin): ['portraitChips_rows' | 'portraitChips_drop' | 'safeMargin_0' | 'safeMargin_pct', Record<string, number>?] {
  if (k === 'portrait_chips') return [v === 'drop' ? 'portraitChips_drop' : 'portraitChips_rows'];
  return v === 0 ? ['safeMargin_0'] : ['safeMargin_pct', { n: v as number }];
}
