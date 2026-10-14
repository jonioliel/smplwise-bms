/**
 * CR-038 slice 9 (spec 11A.6A): the page editor of a photographed invoice - a LAZILY loaded chunk of the public bundle (budget
 * <= 25 KB gzip), fetched only by the claim step (`import('./capture-editor')`). No third-party code, no innerHTML.
 *
 * Per page: rotate 90 degrees, crop (drag a rectangle), contrast (grayscale + auto-levels; a toggle - the original is kept until
 * the page is saved). Everything happens on a <canvas>, ONE page in memory at a time: the picked file is decoded once, drawn
 * downscaled to 2048 px on the long side, and the decoded bitmap is released. The saved page is a JPEG at quality 0.8
 * (canvas.toBlob). This is a convenience only: the server validates and re-encodes every page (10.6) - never a trust boundary.
 *
 * The module's top level touches no DOM, so its pure helpers are node-testable.
 */

export const LONG_SIDE = 2048;
export const JPEG_QUALITY = 0.8;
/** the preview canvas is smaller than the page itself (drawing cost on a phone) */
const PREVIEW_LONG_SIDE = 1024;
const MIN_CROP = 32;

export interface Size {
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The size that fits `max` on the long side (never enlarged). */
export function fitLongSide(w: number, h: number, max: number = LONG_SIDE): Size {
  const long = Math.max(w, h);
  if (long <= max || long <= 0) return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
  const k = max / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** A drag from `a` to `b` (image coordinates, any direction) clamped into the image; null when it is too small to be meant. */
export function dragRect(a: { x: number; y: number }, b: { x: number; y: number }, size: Size, min: number = MIN_CROP): Rect | null {
  const x0 = Math.max(0, Math.min(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y));
  const x1 = Math.min(size.w, Math.max(a.x, b.x));
  const y1 = Math.min(size.h, Math.max(a.y, b.y));
  const r = { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  return r.w >= min && r.h >= min ? r : null;
}

/** Grayscale + auto-levels, in place on RGBA data: the luminance is stretched so that the darkest 1 % become black and the
 * brightest 1 % white (a crumpled, grey-lit invoice reads like a scan). Alpha is left as it is. */
export function autoLevelsGray(data: Uint8ClampedArray, clip = 0.01): void {
  const n = Math.floor(data.length / 4);
  if (!n) return;
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    const y = (data[o] * 299 + data[o + 1] * 587 + data[o + 2] * 114 + 500) / 1000;
    const v = y > 255 ? 255 : y | 0;
    data[o] = v;
    hist[v] += 1;
  }
  const cut = Math.floor(n * clip);
  let lo = 0;
  let acc = 0;
  while (lo < 255 && acc + hist[lo] <= cut) acc += hist[lo++];
  let hi = 255;
  acc = 0;
  while (hi > 0 && acc + hist[hi] <= cut) acc += hist[hi--];
  const span = hi - lo;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) lut[v] = span <= 0 ? v : Math.round(((v - lo) * 255) / span);
  for (let i = 0; i < n; i += 1) {
    const o = i * 4;
    const v = lut[data[o]];
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
  }
}

// ---------------------------------------------------------------- canvas helpers (DOM)

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  return g;
}

function release(c: HTMLCanvasElement | null): void {
  if (c) {
    c.width = 0;
    c.height = 0;
  }
}

/** Decode the picked file (EXIF orientation applied by the browser) and draw it downscaled; the decoded image is released. */
export async function decodeToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        const s = fitLongSide(bmp.width, bmp.height);
        const c = canvas(s.w, s.h);
        const g = ctx2d(c);
        g.imageSmoothingQuality = 'high';
        g.drawImage(bmp, 0, 0, s.w, s.h);
        return c;
      } finally {
        bmp.close();
      }
    } catch {
      /* fall through to <img> (older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const s = fitLongSide(img.naturalWidth, img.naturalHeight);
    const c = canvas(s.w, s.h);
    const g = ctx2d(c);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, s.w, s.h);
    img.src = '';
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function rotate90(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(src.height, src.width);
  const g = ctx2d(c);
  g.translate(c.width, 0);
  g.rotate(Math.PI / 2);
  g.drawImage(src, 0, 0);
  return c;
}

export function cropTo(src: HTMLCanvasElement, r: Rect): HTMLCanvasElement {
  const c = canvas(r.w, r.h);
  ctx2d(c).drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return c;
}

export function enhanced(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  autoLevelsGray(img.data);
  g.putImageData(img, 0, 0);
  return c;
}

export function toJpeg(c: HTMLCanvasElement, quality: number = JPEG_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality);
  });
}

// ---------------------------------------------------------------- the editor UI

export type EditorTextKey = 'rotate' | 'crop' | 'crop_apply' | 'crop_cancel' | 'crop_hint' | 'contrast' | 'processing';

export interface EditorAction {
  label: string;
  primary?: boolean;
  /** runs synchronously inside the tap (a picker may be opened from here) */
  run: (editor: PageEditor) => void;
}

export interface PageEditorOptions {
  title: string;
  text: (key: EditorTextKey) => string;
  /** the step's own buttons (add page, finish document, retake, cancel ...) */
  actions: EditorAction[];
}

export interface PageEditor {
  /** the page as it is now (rotation, crop and the contrast toggle applied) as a JPEG */
  exportBlob(): Promise<Blob>;
  /** replace the picture (a retake) - edits are reset */
  load(file: Blob): Promise<void>;
  close(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** Open the editor for one picked picture inside `host`. Throws when the picture cannot be decoded (the step shows the error). */
export async function openPageEditor(host: HTMLElement, file: Blob, opts: PageEditorOptions): Promise<PageEditor> {
  let base: HTMLCanvasElement | null = await decodeToCanvas(file);
  let contrastOn = false;
  let enh: HTMLCanvasElement | null = null;
  let cropMode = false;
  let dragA: { x: number; y: number } | null = null;
  let dragB: { x: number; y: number } | null = null;
  let closed = false;

  const root = el('div', 'swc-editor');
  root.appendChild(el('h3', 'swc-editor-title', opts.title));
  const view = el('canvas', 'swc-editor-canvas');
  root.appendChild(view);
  const hint = el('p', 'swc-hint', opts.text('crop_hint'));
  hint.hidden = true;
  root.appendChild(hint);

  const tools = el('div', 'swc-row swc-tools');
  const rotateBtn = button(opts.text('rotate'), 'swc-btn', () => {
    if (!base) return;
    const next = rotate90(base);
    release(base);
    release(enh);
    enh = null;
    base = next;
    paint();
  });
  const cropBtn = button(opts.text('crop'), 'swc-btn', () => setCrop(true));
  const contrastBtn = button(opts.text('contrast'), 'swc-btn swc-toggle', () => {
    contrastOn = !contrastOn;
    contrastBtn.setAttribute('aria-pressed', String(contrastOn));
    paint();
  });
  contrastBtn.setAttribute('aria-pressed', 'false');
  tools.append(rotateBtn, cropBtn, contrastBtn);
  root.appendChild(tools);

  const cropTools = el('div', 'swc-row swc-tools');
  const applyBtn = button(opts.text('crop_apply'), 'swc-btn swc-primary', () => {
    if (base && dragA && dragB) {
      const r = dragRect(dragA, dragB, { w: base.width, h: base.height });
      if (r) {
        const next = cropTo(base, r);
        release(base);
        release(enh);
        enh = null;
        base = next;
      }
    }
    setCrop(false);
  });
  applyBtn.disabled = true;
  cropTools.append(applyBtn, button(opts.text('crop_cancel'), 'swc-btn', () => setCrop(false)));
  cropTools.hidden = true;
  root.appendChild(cropTools);

  const actions = el('div', 'swc-row swc-actions');
  const editor: PageEditor = {
    async exportBlob() {
      if (!base) throw new Error('closed');
      const src = contrastOn ? (enh ??= enhanced(base)) : base;
      return toJpeg(src);
    },
    async load(next: Blob) {
      const fresh = await decodeToCanvas(next);
      release(base);
      release(enh);
      enh = null;
      base = fresh;
      contrastOn = false;
      contrastBtn.setAttribute('aria-pressed', 'false');
      setCrop(false);
    },
    close() {
      if (closed) return;
      closed = true;
      release(base);
      release(enh);
      release(view);
      base = null;
      enh = null;
      root.remove();
    },
  };
  for (const a of opts.actions) actions.appendChild(button(a.label, a.primary ? 'swc-btn swc-primary' : 'swc-btn', () => a.run(editor)));
  root.appendChild(actions);

  function setCrop(on: boolean): void {
    cropMode = on;
    dragA = null;
    dragB = null;
    applyBtn.disabled = true;
    hint.hidden = !on;
    cropTools.hidden = !on;
    tools.hidden = on;
    actions.hidden = on;
    view.classList.toggle('swc-cropping', on);
    paint();
  }

  /** pointer position -> image coordinates */
  function toImage(ev: PointerEvent): { x: number; y: number } {
    const r = view.getBoundingClientRect();
    const w = base?.width ?? 1;
    const h = base?.height ?? 1;
    return { x: ((ev.clientX - r.left) / Math.max(1, r.width)) * w, y: ((ev.clientY - r.top) / Math.max(1, r.height)) * h };
  }

  view.addEventListener('pointerdown', (ev) => {
    if (!cropMode) return;
    ev.preventDefault();
    try {
      view.setPointerCapture(ev.pointerId);
    } catch {
      /* not capturable - the drag still works while the finger stays on the canvas */
    }
    dragA = toImage(ev);
    dragB = dragA;
    paint();
  });
  view.addEventListener('pointermove', (ev) => {
    if (!cropMode || !dragA) return;
    dragB = toImage(ev);
    paint();
  });
  const endDrag = (ev: PointerEvent) => {
    if (!cropMode || !dragA) return;
    dragB = toImage(ev);
    applyBtn.disabled = !(base && dragRect(dragA, dragB, { w: base.width, h: base.height }));
    paint();
  };
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);

  function paint(): void {
    if (!base) return;
    const src = contrastOn ? (enh ??= enhanced(base)) : base;
    const s = fitLongSide(src.width, src.height, PREVIEW_LONG_SIDE);
    if (view.width !== s.w || view.height !== s.h) {
      view.width = s.w;
      view.height = s.h;
    }
    const g = ctx2d(view);
    g.drawImage(src, 0, 0, s.w, s.h);
    if (cropMode && dragA && dragB) {
      const k = s.w / src.width;
      const r = dragRect(dragA, dragB, { w: src.width, h: src.height }, 1);
      if (r) {
        g.save();
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.beginPath();
        g.rect(0, 0, s.w, s.h);
        g.rect(r.x * k, r.y * k, r.w * k, r.h * k);
        g.fill('evenodd');
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2;
        g.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k);
        g.restore();
      }
    }
  }

  host.appendChild(root);
  paint();
  return editor;
}
