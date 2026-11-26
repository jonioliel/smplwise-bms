/**
 * PLAYER-ERROR-TEXT-2530 (VIDEO-SECFIX-2520 question 1 a): what a live or recorded player says for the relay's error frame
 * (`{"type":"error","value":<code>}`). Since 2.52 the relay never forwards go2rtc's own text - only fixed codes - so every code is
 * a sentence here, and a code this table does not know gets the generic sentence: the raw value is never shown (it still reaches the
 * console and the `player-status` event's `code`).
 *
 * The codes a viewer's socket can carry (smplwise_vms/backend/smplwise):
 * - `upstream_error`: go2rtc reported an error on a recorder / manual-source camera's live socket, a playback socket or an intercom
 *   station (services/relay.sanitize_upstream_frame);
 * - `upstream_unavailable`: a Home Assistant camera's go2rtc error (services/ha_camera_streams.LIVE_ERROR_VALUE), or the relay could
 *   not reach go2rtc at all (routers/media and routers/playback, with the service's `media` state) - "the video service is down";
 * - `access_lost`: the viewer's permission was removed while watching (routers/media lease check);
 * - `presence_required`, `service_account`: the socket was refused for its caller (routers/media._refuse_socket, close 4403);
 * - `media_unavailable`, `media_not_configured` (routers/media.refuse_media), `remote_live_cap`, `h265_unsupported`, `transcode_cap`:
 *   each has its own state in the player before this table is asked (the video service watch, the cap view, the H.265 notices).
 */
import { tr } from '../i18n/msg/api-video';
import { VIDEO_SERVICE_DOWN_HE } from './video-service';

/** What the player plays: a camera live, or a recording (`wsUrl`, a playback session). */
export type StreamKind = 'live' | 'recording';

/** Codes that refuse this viewer: no retry can help, so no retry hint (the player does not retry them either). */
export const DENIAL_CODES: ReadonlySet<string> = new Set(['access_lost', 'presence_required', 'service_account']);

/** The sentence for an error frame's code. Never the code itself. */
export function streamErrorText(code: string | null | undefined, kind: StreamKind = 'live'): string {
  switch (code) {
    case 'upstream_error':
      return kind === 'recording' ? tr('שרת הווידאו לא הצליח לקבל את ההקלטה מהמקליט') : tr('שרת הווידאו לא הצליח לקבל את השידור מהמצלמה');
    case 'upstream_unavailable':
    case 'media_unavailable':
    case 'media_not_configured':
      return VIDEO_SERVICE_DOWN_HE;
    case 'access_lost':
      return tr('ההרשאה לצפייה במצלמה הזו הוסרה');
    case 'presence_required':
      return tr('כדי לצפות בווידאו מהאפליקציה יש להפעיל את שיתוף הנתונים הנדרש');
    case 'service_account':
      return tr('חשבון שירות אינו יכול לצפות בווידאו');
    default:
      return tr('שגיאה בזרם הווידאו');
  }
}

/** The retry hint under the sentence: `autoRetry` - the player reconnects by itself; otherwise the viewer tries again. Empty for a
 * denial and for "the video service is down" (that state has its own hint and button). */
export function streamErrorHint(code: string | null | undefined, kind: StreamKind, autoRetry: boolean): string {
  if (DENIAL_CODES.has(code ?? '') || streamErrorText(code, kind) === VIDEO_SERVICE_DOWN_HE) return '';
  if (code === 'upstream_error') {
    if (kind === 'recording') return autoRetry ? tr('ננסה שוב אוטומטית; אם זה נמשך, בדקו שהמקליט מחובר ופועל') : tr('נסו שוב בעוד רגע; אם זה נמשך, בדקו שהמקליט מחובר ופועל');
    return autoRetry ? tr('ננסה שוב אוטומטית; אם זה נמשך, בדקו שהמצלמה מחוברת ופועלת') : tr('נסו שוב בעוד רגע; אם זה נמשך, בדקו שהמצלמה מחוברת ופועלת');
  }
  return autoRetry ? tr('ננסה שוב אוטומטית; אם זה נמשך, פנו למנהל המערכת') : tr('נסו שוב בעוד רגע; אם זה נמשך, פנו למנהל המערכת');
}
