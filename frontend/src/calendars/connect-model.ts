/**
 * CALCONNECT-2330: the pure rules of the connect dialogs (Node-testable: tests/unit-calendars-connect-2330.spec.ts). The server decides
 * every one of them again; these only keep the screen from offering what the server would refuse.
 */
import { cardOf, type Connection, type ProviderCard } from '../api/calendars';

const GOOGLE_CLIENT = /^[0-9]{1,30}-[a-z0-9]{1,64}\.apps\.googleusercontent\.com$/;
const MS_CLIENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Google's installed-app flow lands the browser here after the approval (nothing listens there; the owner pastes the address). */
export const GOOGLE_LOOPBACK = 'http://127.0.0.1:8749/';

/** The directions a binding of this connection may take (iCal IN reads only; a read connection only imports). */
export function directionsFor(conn: Pick<Connection, 'provider' | 'scope'>): ('import' | 'export' | 'two_way')[] {
  if (cardOf(conn.provider) === 'ical') return ['import'];
  return conn.scope === 'read_write' ? ['export', 'import', 'two_way'] : ['import'];
}

/** The step a connect dialog opens on: the client (or the feed address) until it is set, then the provider's approval. */
export function firstStep(card: ProviderCard, conn: Pick<Connection, 'setup'> | null): 'client' | 'feed' | 'auth' {
  if (card === 'ical') return 'feed';
  return conn?.setup?.client_id_set ? 'auth' : 'client';
}

/** A client id that looks like the provider's own format (the server checks again). */
export function clientIdOk(card: ProviderCard, id: string): boolean {
  return card === 'google' ? GOOGLE_CLIENT.test(id.trim()) : card === 'microsoft' ? MS_CLIENT.test(id.trim()) : false;
}

/** Whether a pasted address can be Google's loopback answer (the server checks the state and the code). */
export function pasteLooksRight(text: string): boolean {
  const t = text.trim();
  return t.startsWith(GOOGLE_LOOPBACK) && /[?&]state=/.test(t) && /[?&](code|error)=/.test(t);
}
