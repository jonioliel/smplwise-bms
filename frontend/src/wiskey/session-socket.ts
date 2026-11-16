import type { SocketLike } from './talk-session';

/**
 * CR-SOCKETS-2439 (review 08:F24): the socket-start block the WisKey listen and talk sessions shared line by line. Opens the session's
 * socket on `ws_path`; when the constructor throws, the server session is stopped (best effort) and `onFail` runs (the caller's
 * `fail('network')`), and null comes back. Frames are binary (`arraybuffer`): the station's audio.
 * Not a reconnecting socket on purpose: a listen / talk session that lost its socket ends (the server closes its side too).
 */
export function openSessionSocket(
  deps: { socket(wsPath: string): SocketLike; stop(session: string): Promise<unknown> },
  reply: { session: string; ws_path: string },
  onFail: () => void,
): SocketLike | null {
  let ws: SocketLike;
  try {
    ws = deps.socket(reply.ws_path);
  } catch {
    void deps.stop(reply.session).catch(() => undefined);
    onFail();
    return null;
  }
  ws.binaryType = 'arraybuffer';
  return ws;
}
