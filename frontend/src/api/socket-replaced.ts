/** GO2RTC-STREAM-SYNC-2436 (lab 12.11): a playback socket of an old generation (another seek owns the session now) is closed 4410,
 * but HA ingress delivers that close as a plain 1000 - the player could not tell "replaced" from "the recording ended". The relay
 * now sends `{"type":"replaced"}` first (routers/playback.close_replaced); after that frame a non-application close code means 4410. */
export const REPLACED_CLOSE = 4410;

export function frameSaysReplaced(msg: { type?: string; value?: string } | null | undefined): boolean {
  return !!msg && msg.type === 'replaced';
}

/** The close code the player acts on: 4410 when the server said "replaced" and the code that arrived is not one of ours. */
export function replacedCloseCode(replacedSaid: boolean, code: number): number {
  return replacedSaid && code < 4000 ? REPLACED_CLOSE : code;
}
