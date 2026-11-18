import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { ticketsLang } from './text';
import {
  JPEG_QUALITY, VIDEO_CONSTRAINTS, cameraEnv, captureName, classifyCameraError, frameSize, stopStream, type CameraFailure,
} from './camera-viewfinder-model';
import { packTable } from '../i18n/lang-packs';

/**
 * CR-CAMVF-295 (docs/changes/CR-CAMVF-295-SECURITY.md): the live in-page camera viewfinder of a request's photos - OPT-IN, off by default
 * (`ui.camera_viewfinder`). The rules it keeps:
 * - the camera is asked for ONLY from `start()`, which the owner calls from a click handler (never on load, a timer or a route change);
 * - one owner of the stream; every exit stops every track (close, Escape, "use photo", an error, disconnect, pagehide, the page hidden,
 *   hashchange / popstate); after the shot the live tracks are already stopped - no persistent stream;
 * - nothing leaves the browser until "שימוש בתמונה": the frame is a canvas + a Blob in memory, handed to the owner as a File through the
 *   `camera-photo` event (the owner uploads it with the SAME function the file input uses);
 * - any failure ends with the stream stopped, the dialog closed and a `camera-failed` event; the owner's file input tile is the fallback.
 */

const he = {
  open: 'מצלמה חיה',
  fail_denied: 'אין הרשאה למצלמה. אפשר לצלם או לבחור תמונה בכפתור "הוספה".',
  fail_no_camera: 'לא נמצאה מצלמה. אפשר לבחור תמונה בכפתור "הוספה".',
  fail_busy: 'המצלמה תפוסה. אפשר לצלם או לבחור תמונה בכפתור "הוספה".',
  fail_insecure: 'המצלמה החיה לא זמינה כאן. אפשר לצלם או לבחור תמונה בכפתור "הוספה".',
  fail_failed: 'לא ניתן לפתוח את המצלמה. אפשר לצלם או לבחור תמונה בכפתור "הוספה".',
  set_label: 'מצלמה חיה בתמונות',
  set_sub: 'צילום מתוך הדף במחשב ובטלפון. כבוי: רק כפתור "הוספה"',
  set_on: 'פעיל',
  set_off: 'כבוי',
  title: 'מצלמה',
  starting: 'פותח את המצלמה…',
  shoot: 'צילום',
  retake: 'צילום מחדש',
  use: 'שימוש בתמונה',
  cancel: 'ביטול',
  live: 'תצוגה חיה מהמצלמה',
  still: 'התמונה שצולמה',
};
const en: typeof he = packTable<typeof import('../i18n/lang/en/tickets/camera-viewfinder').en>('en', 'tickets/camera-viewfinder', 'en');
type ViewfinderTextKey = keyof typeof he;
export const vft = (k: ViewfinderTextKey): string => (ticketsLang() === 'en' ? en : he)[k];
/** One short line per failure, always pointing at the unchanged file-input tile ("הוספה"). */
export const vfFailText = (reason: CameraFailure): string => vft(`fail_${reason}` as ViewfinderTextKey);

type Phase = 'closed' | 'starting' | 'live' | 'review';

/** The still as a JPEG (a canvas encode writes no EXIF), or null when the browser cannot encode it. `toBlob` copies the bitmap when it is
 * called, so the canvas can be shown (and later dropped) while the encode runs. */
function encodeJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    } catch {
      resolve(null); // e.g. a tainted canvas (never the case for a camera frame) - reported as a failure, like a null blob
    }
  });
}

@customElement('ticket-camera-viewfinder')
export class TicketCameraViewfinder extends LitElement {
  /** The installation switch, checked again here (defence in depth: the owner does not render the tile while it is off). */
  @property({ type: Boolean }) enabled = false;
  @state() private phase: Phase = 'closed';
  /** FIX-CAMVF-FLAKE-2443: the shot itself - the canvas the frame was drawn on, shown as the still the moment the shutter is pressed */
  @state() private still: HTMLCanvasElement | null = null;
  /** "שימוש בתמונה" pressed while the JPEG is still being encoded: the button waits (disabled) for it */
  @state() private using = false;
  @query('video') private video!: HTMLVideoElement | null;
  private stream: MediaStream | null = null;
  /** the JPEG of the still, encoded behind the review screen; resolves to null when the browser could not encode it */
  private encoding: Promise<Blob | null> | null = null;
  /** bumps on every start / close: a getUserMedia answer that arrives after the person closed is stopped at once */
  private generation = 0;
  private listening = false;

  static styles = css`
    .frame {
      position: relative;
      inline-size: 100%;
      aspect-ratio: 4 / 3;
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-media);
      overflow: hidden;
      display: grid;
      place-items: center;
    }
    video,
    canvas {
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
      display: block;
    }
    video[hidden] {
      display: none;
    }
    .wait {
      color: var(--sw-on-video);
      font-size: var(--sw-fs-sm);
    }
  `;

  get isOpen(): boolean {
    return this.phase !== 'closed';
  }

  /** Call ONLY from a click handler. Resolves when the preview is live, or after a failure was reported (`camera-failed`). */
  async start(): Promise<void> {
    if (this.phase === 'starting' || this.phase === 'live') return;
    const env = cameraEnv();
    if (!this.enabled || !env.secure || !env.hasGetUserMedia) {
      this.fail('insecure');
      return;
    }
    this.dropStill();
    const gen = ++this.generation;
    this.phase = 'starting';
    this.listen(true);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
    } catch (err) {
      if (gen === this.generation) this.fail(classifyCameraError(err));
      return;
    }
    if (gen !== this.generation || !this.isConnected) {
      stopStream(stream); // closed while the browser was asking: the camera never stays on
      return;
    }
    this.stream = stream;
    this.phase = 'live';
    await this.updateComplete;
    const v = this.video;
    if (!v) return;
    v.srcObject = stream;
    try {
      await v.play();
    } catch {
      // autoplay of a muted inline video is allowed everywhere we target; a refusal still shows the first frame on most browsers
    }
  }

  /** Ends everything: the tracks, the still, the listeners. Safe to call at any time. */
  close(): void {
    this.generation += 1;
    this.endStream();
    this.dropStill();
    this.listen(false);
    this.phase = 'closed';
  }

  disconnectedCallback(): void {
    this.close();
    super.disconnectedCallback();
  }

  private endStream(): void {
    stopStream(this.stream);
    this.stream = null;
    const v = this.video;
    if (v) v.srcObject = null;
  }

  private dropStill(): void {
    this.still = null;
    this.encoding = null;
    this.using = false;
  }

  private fail(reason: CameraFailure): void {
    this.close();
    this.dispatchEvent(new CustomEvent('camera-failed', { detail: { reason }, bubbles: true, composed: true }));
  }

  private readonly onLeave = (): void => {
    if (this.phase !== 'closed') this.close();
  };

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.onLeave();
  };

  private listen(on: boolean): void {
    if (on === this.listening) return;
    this.listening = on;
    const m = on ? 'addEventListener' : 'removeEventListener';
    window[m]('pagehide', this.onLeave);
    window[m]('hashchange', this.onLeave);
    window[m]('popstate', this.onLeave);
    document[m]('visibilitychange', this.onVisibility);
  }

  /**
   * FIX-CAMVF-FLAKE-2443: the shutter answers at once. The frame is drawn on a canvas, the camera goes off and the review shows THAT canvas
   * in the same click; the JPEG is encoded behind it. Before, the dialog stayed on a dead "live" preview with an active shutter until
   * `canvas.toBlob` called back - Chromium encodes a JPEG blob in idle time on the page's main thread (OffscreenCanvas.convertToBlob too,
   * measured) and forces it only after its own start / complete timeouts (about 1 s, then 5 s), so under load, with phone emulation, the
   * shot looked ignored for more than 5 s. The encode now overlaps the time the person looks at the still.
   */
  private shoot(): void {
    const v = this.video;
    if (this.phase !== 'live' || !v) return;
    const size = frameSize(v.videoWidth, v.videoHeight);
    if (!size.width) return;
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.fail('failed');
      return;
    }
    ctx.drawImage(v, 0, 0, size.width, size.height);
    this.endStream(); // the shot is taken: the camera goes off now, not when the dialog closes
    canvas.dataset.camvfStill = '';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', vft('still'));
    const gen = this.generation;
    const encoding = encodeJpeg(canvas);
    this.encoding = encoding;
    this.still = canvas;
    this.phase = 'review';
    // a frame the browser cannot encode ends like any other failure (stream already off, dialog closed, the file input tile remains)
    void encoding.then((blob) => {
      if (!blob && gen === this.generation) this.fail('failed');
    });
  }

  /** "שימוש בתמונה": the photo leaves the browser only now, through the owner. If the JPEG is not ready yet the button waits for it. */
  private async use(): Promise<void> {
    const encoding = this.encoding;
    if (this.phase !== 'review' || !encoding || this.using) return;
    const gen = this.generation;
    this.using = true;
    const blob = await encoding;
    if (gen !== this.generation || !blob) return; // retake, close or any exit while it was encoding: nothing is sent (a failure was reported)
    const file = new File([blob], captureName(new Date()), { type: 'image/jpeg' });
    this.close();
    this.dispatchEvent(new CustomEvent('camera-photo', { detail: { file }, bubbles: true, composed: true }));
  }

  private body(): TemplateResult {
    if (this.phase === 'review') return html`<div class="frame">${this.still}</div>`;
    return html`<div class="frame">
      <video playsinline muted autoplay aria-label=${vft('live')} data-camvf-video ?hidden=${this.phase !== 'live'}></video>
      ${this.phase === 'starting' ? html`<span class="wait" role="status" data-camvf-starting>${vft('starting')}</span>` : nothing}
    </div>`;
  }

  render(): TemplateResult {
    const review = this.phase === 'review';
    return html`<sw-dialog ?open=${this.phase !== 'closed'} heading=${vft('title')} data-camvf=${this.phase} @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
      ${this.phase === 'closed' ? nothing : this.body()}
      <sw-button slot="footer" data-camvf-secondary @click=${() => (review ? void this.start() : this.close())}>${review ? vft('retake') : vft('cancel')}</sw-button>
      <sw-button slot="footer" variant="primary" icon=${review ? 'check' : 'camera'} data-camvf-primary ?disabled=${this.phase === 'starting' || this.using}
        @click=${() => (review ? void this.use() : this.shoot())}>${review ? vft('use') : vft('shoot')}</sw-button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-camera-viewfinder': TicketCameraViewfinder;
  }
}
