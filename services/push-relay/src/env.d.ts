// The small slice of the Cloudflare Workers runtime this relay uses, declared locally so the service typechecks with a plain
// TypeScript install (`tsc --noEmit -p services/push-relay`). With `@cloudflare/workers-types` installed these declarations
// are compatible (same shapes); wrangler bundles the code the same way either way.

interface KVNamespaceGetOptions { type?: 'text' | 'json'; cacheTtl?: number }
interface KVNamespacePutOptions { expirationTtl?: number; expiration?: number }

interface KVNamespace {
  get(key: string, options?: KVNamespaceGetOptions | 'text'): Promise<string | null>;
  get<T>(key: string, options: { type: 'json'; cacheTtl?: number } | 'json'): Promise<T | null>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/** Bindings and secrets of the Worker (wrangler.toml + `wrangler secret put`). */
interface Env {
  RELAY_KV: KVNamespace;
  /** Comma-separated server keys (one per Arx installation), each `<server id>:<secret>`; `wrangler secret put SERVER_KEYS`. */
  SERVER_KEYS: string;
  /** Secret that makes the relay token stable per push token (contract: idempotent register). Without it every register issues a fresh token. wrangler secret put RELAY_TOKEN_SECRET. */
  RELAY_TOKEN_SECRET?: string;
  /** APNs: the .p8 key's PEM body (one line, no header lines is fine), the key id, the team id, the app's bundle id. */
  APNS_KEY_P8?: string;
  APNS_KEY_ID?: string;
  APNS_TEAM_ID?: string;
  APNS_BUNDLE_ID?: string;
  /** `production` (default) or `sandbox` (development builds). */
  APNS_ENV?: string;
  /** FCM: the Firebase service-account JSON (the whole file as one secret). */
  FCM_SERVICE_ACCOUNT?: string;
  /** Allowed bundle / package ids the app may register with (comma separated); default the two SmplWise ids. */
  ALLOWED_BUNDLE_IDS?: string;
}
