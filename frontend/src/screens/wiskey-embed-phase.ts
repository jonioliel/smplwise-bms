/** UXREST2-295: what a WisKey frame that loaded but is still "loading" after the settle limit becomes: the timeout state ("unreachable",
 * with its retry). Only a frame with no handshake and no verdict yet ('pending'); a waiting / legacy / v1 / failed frame keeps its own state.
 * Pure, so a Node spec can prove it (the screen itself needs a browser). */
export function settledPhase<P extends string>(phase: P, mode: string): P | 'unreachable' {
  return phase === 'loading' && mode === 'pending' ? 'unreachable' : phase;
}
