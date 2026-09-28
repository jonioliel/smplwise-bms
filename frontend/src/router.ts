// Minimal hash router. Hash routes survive the HA Ingress path prefix and iframe embedding without
// any server-side rewrite. Route: `#/explore/floors/f0?state=empty`.
// `devices` (CR-007, 2026-09-28): "חשמל והתקנים", a top-level area of its own like `wiskey` (see the ADR-009 notes in
// docs/architecture/DECISIONS.md).
export type Mode = 'live' | 'explore' | 'investigate' | 'system' | 'wiskey' | 'devices';

export interface RouteState {
  path: string;
  segments: string[];
  params: URLSearchParams;
  mode: Mode | null;
}

const MODES: Mode[] = ['live', 'explore', 'investigate', 'system', 'wiskey', 'devices'];

export function parseRoute(hash: string = window.location.hash): RouteState {
  const raw = hash.replace(/^#/, '') || '/explore/floors/f0';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const segments = path.split('/').filter(Boolean);
  const first = segments[0] as Mode | undefined;
  return {
    path,
    segments,
    params: new URLSearchParams(queryPart),
    mode: first && MODES.includes(first) ? first : null,
  };
}

export function navigate(path: string, params?: Record<string, string>): void {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  window.location.hash = `#${path}${query}`;
}

export function onRouteChange(handler: (route: RouteState) => void): () => void {
  const listener = () => handler(parseRoute());
  window.addEventListener('hashchange', listener);
  handler(parseRoute());
  return () => window.removeEventListener('hashchange', listener);
}
