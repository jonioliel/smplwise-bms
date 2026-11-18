/**
 * CR-I18N-CORE (code review 07:F10): the two helpers every text catalogue repeated - the language the document asks for and the
 * `{name}` filling - plus a registry of the catalogues' tables, read by scripts/i18n_missing_keys.mjs (the missing-keys report)
 * and by the completeness specs. Behaviour is the one the 78 copies had: the language is read from `<html lang>` at call time
 * (the personal language switch sets it before the first render, i18n/ui-lang.ts), a key missing in the language falls back to
 * the Hebrew and then to the key itself, and a `{name}` without a value stays as written.
 */

/** The interface languages a catalogue may carry. Hebrew is the source and the fallback of every catalogue. */
type UiLangCode = 'he' | 'en' | 'ar' | 'ru';

/** Values for `{name}` placeholders. */
export type Vars = Record<string, string | number>;

/** The `<html lang>` prefix (lower case), '' outside a browser (also under a Node stub `document` without `documentElement`, as some specs install at module level). */
export function docLangRaw(): string {
  return typeof document !== 'undefined' ? (document.documentElement?.lang || '').toLowerCase() : '';
}

/** The first of `supported` that `<html lang>` starts with, else Hebrew. */
export function docLang<L extends string>(supported: readonly L[]): L | 'he' {
  const l = docLangRaw();
  for (const code of supported) if (l.startsWith(code)) return code;
  return 'he';
}

const PLACEHOLDER = /\{(\w+)\}/g;

/** `{name}` placeholders filled from `vars`; a name without a value is left as written. */
export function fill(text: string, vars?: Vars | null): string {
  if (!vars) return text;
  return text.replace(PLACEHOLDER, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** A nested catalogue (i18n/he.ts) or a flat one (every other module): string leaves under string keys. */
type CatalogueTable = { readonly [key: string]: string | CatalogueTable };

interface RegisteredCatalogue {
  /** The module's own name (its file under src/, without the extension). */
  readonly name: string;
  /** The tables by language; Hebrew is always present. */
  readonly tables: Readonly<Partial<Record<UiLangCode, CatalogueTable>>> & { readonly he: CatalogueTable };
  /** The languages whose table is an initial, unreviewed translation. */
  readonly devMarked: readonly UiLangCode[];
}

const REGISTRY = new Map<string, RegisteredCatalogue>();

/**
 * Records a catalogue's tables under its module name (idempotent; a later call for the same name replaces the entry). Report and
 * test use only: lookups never go through the registry.
 */
export function registerCatalogue(
  name: string,
  tables: Partial<Record<UiLangCode, object>> & { he: object },
  devMarked: readonly UiLangCode[] = [],
): void {
  REGISTRY.set(name, { name, tables: tables as RegisteredCatalogue['tables'], devMarked });
}

/** Every registered catalogue, in registration order. */
export function registeredCatalogues(): RegisteredCatalogue[] {
  return [...REGISTRY.values()];
}

/** A flat catalogue's lookup: the language's text, else the Hebrew, else the key; then `{name}` filling. */
export interface Catalogue<K extends string, L extends string> {
  t(key: K, vars?: Vars | null, lang?: L | 'he'): string;
  /** A key built at run time (`prefix + kind`): unknown keys fall back to `fallback`. */
  tDynamic(key: string, fallback: K, vars?: Vars | null, lang?: L | 'he'): string;
  lang(): L | 'he';
  readonly keys: K[];
  readonly tables: Record<L | 'he', Partial<Record<K, string>>>;
  readonly devMarked: readonly L[];
}

/**
 * The shared shape of a flat catalogue. `name` registers it (see `registerCatalogue`); `langs` are the non-Hebrew languages the
 * module offers (detected from `<html lang>` in this order).
 */
export function createCatalogue<K extends string, L extends Exclude<UiLangCode, 'he'>>(
  name: string,
  he: Record<K, string>,
  others: Partial<Record<L, Partial<Record<K, string>>>>,
  devMarked: readonly L[] = [],
): Catalogue<K, L> {
  const langs = Object.keys(others) as L[];
  const tables = { he, ...others } as Record<L | 'he', Partial<Record<K, string>>>;
  registerCatalogue(name, tables as never, devMarked);
  const lang = () => docLang(langs);
  const t = (key: K, vars?: Vars | null, l: L | 'he' = lang()) => fill(tables[l]?.[key] ?? he[key] ?? key, vars);
  return {
    t,
    tDynamic: (key, fallback, vars, l) => (key in he ? t(key as K, vars, l) : t(fallback, vars, l)),
    lang,
    keys: Object.keys(he) as K[],
    tables,
    devMarked,
  };
}
