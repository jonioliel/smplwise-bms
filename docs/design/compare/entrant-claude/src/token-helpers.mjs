// Helpers shared by the skin files. A token value is { light, dark }.
export const same = (v) => ({ light: v, dark: v });
export const lt = (light, dark) => ({ light, dark });

// Produce a full token set for a skin from a base set plus overrides. Every override must name a token that
// exists in the base (same names in every skin, by construction); the result keeps the base group order.
export function derive(baseGroups, overrides) {
  const known = new Set(baseGroups.flatMap((g) => Object.keys(g.tokens)));
  for (const k of Object.keys(overrides)) if (!known.has(k)) throw new Error(`unknown token in skin override: ${k}`);
  return baseGroups.map((g) => ({ ...g, tokens: Object.fromEntries(Object.entries(g.tokens).map(([k, v]) => [k, overrides[k] || v])) }));
}

export const flatten = (groups) => Object.fromEntries(groups.flatMap((g) => Object.entries(g.tokens)));

// Count the tokens whose light or dark value differs between two skins.
export function diffCount(aGroups, bGroups) {
  const a = flatten(aGroups), b = flatten(bGroups);
  return Object.keys(a).filter((k) => a[k].light !== b[k].light || a[k].dark !== b[k].dark).length;
}

export const ruleCount = (css) => (css.match(/\{[^{}]*\}/g) || []).length;
