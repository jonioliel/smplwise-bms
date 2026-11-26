// LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-10): when playwright.config.ts may reuse a server that already listens on its port.
// Only when the run names the server (SW_BASE_URL - the release gate starts its own preview on a free port and passes it) or asks for
// reuse explicitly (SW_REUSE_SERVER=1). Otherwise Playwright starts the preview itself and refuses a port that is already taken, so a
// run never tests another checkout's build (another worktree's preview, an orphan one) and reports the result for this one.
export function reuseServer(env: Record<string, string | undefined>): boolean {
  return Boolean(env.SW_BASE_URL) || env.SW_REUSE_SERVER === '1';
}
