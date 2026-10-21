import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import { ticketsLang } from './text';
import {
  JPEG_QUALITY, VIDEO_CONSTRAINTS, cameraEnv, captureName, classifyCameraError, frameSize, stopStream, type CameraFailure,
} from './camera-viewfinder-model';

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
const en: typeof he = {
  open: 'Live camera',
  fail_denied: 'No camera permission. Use "Add" to take or pick a photo.',
  fail_no_camera: 'No camera found. Use "Add" to pick a photo.',
  fail_busy: 'The camera is busy. Use "Add" to take or pick a photo.',
  fail_insecure: 'The live camera is not available here. Use "Add" to take or pick a photo.',
  fail_failed: 'The camera could not be opened. Use "Add" to take or pick a photo.',
  set_label: 'Live camera in photos',
  set_sub: 'Take photos inside the page on a computer or phone. Off: only the "Add" button',
  set_on: 'On',
  set_off: 'Off',
  title: 'Camera',
  starting: 'Opening the camera…',
  shoot: 'Take photo',
  retake: 'Retake',
  use: 'Use photo',
  cancel: 'Cancel',
  live: 'Live camera preview',
  still: 'The photo taken',
};
export type ViewfinderTextKey = keyof typeof he;
export const vft = (k: ViewfinderTextKey): string => (ticketsLang() === 'en' ? en : he)[k];
/** One short line per failure, always pointing at the unchanged file-input tile ("הוספה"). */
export const vfFailText = (reason: CameraFailure): string => vft(`fail_${reason}` as ViewfinderTextKey);
export const VIEWFINDER_TEXT = { he, en };

type Phase = 'closed' | 'starting' | 'live' | 'review';

@customElement('ticket-camera-viewfinder')
export class TicketCameraViewfinder extends LitElement {
  /** The installation switch, checked again here (defence in depth: the owner does not render the tile while it is off). */
  @property({ type: Boolean }) enabled = false;
  @state() private phase: Phase = 'closed';
  @state() private previewUrl = '';
  @query('video') private video!: HTMLVideoElement | null;
  private stream: MediaStream | null = null;
  private blob: Blob | null = null;
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
    img {
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
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = '';
    this.blob = null;
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

  private async shoot(): Promise<void> {
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
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    canvas.width = canvas.height = 0;
    if (!blob || this.phase !== 'live') {
      if (!blob) this.fail('failed');
      return;
    }
    this.blob = blob;
    this.previewUrl = URL.createObjectURL(blob);
    this.phase = 'review';
  }

  private use(): void {
    const blob = this.blob;
    if (this.phase !== 'review' || !blob) return;
    const file = new File([blob], captureName(new Date()), { type: 'image/jpeg' });
    this.close();
    this.dispatchEvent(new CustomEvent('camera-photo', { detail: { file }, bubbles: true, composed: true }));
  }

  private body(): TemplateResult {
    if (this.phase === 'review') return html`<div class="frame"><img src=${this.previewUrl} alt=${vft('still')} data-camvf-still /></div>`;
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
      <sw-button slot="footer" variant="primary" icon=${review ? 'check' : 'camera'} data-camvf-primary ?disabled=${this.phase === 'starting'}
        @click=${() => (review ? this.use() : void this.shoot())}>${review ? vft('use') : vft('shoot')}</sw-button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-camera-viewfinder': TicketCameraViewfinder;
  }
}
