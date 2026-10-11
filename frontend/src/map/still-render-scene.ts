/**
 * The level-2 still renderer (CR-029 S3; still-bake.ts `StillRenderer`): today's SceneView draws one level of the synthetic
 * all-off / all-on description on an off-screen mount of the still's size at pixel ratio 1, in the frozen palette of the
 * style, the band's night mode, from the preset's camera - the same path as the skin control image (renderControlImage). The
 * sunset band has no sun model at level 2: it is the day picture under a fixed warm grade (a canvas multiply), recorded in the
 * recipe id; the level-3 renderer of S1 / S2 (recipe `still-q3.*`) replaces it and every q2 bake is offered again.
 *
 * Nothing here changes SceneView. The view of the last render stays alive until the next render or dispose(), so the caller
 * can project the masks through the exact camera that drew the picture.
 */
import { SceneView } from './scene-three';
import type { SceneDescription } from './scene-builder';
import { STILL_RECIPE_Q2, bandScene, stillBackdrop, stillColor, stillDescription, type Project, type StillRenderRequest, type StillRenderResult, type StillRenderer, type StillVariant } from './still-bake';

/** The warm grade of the q2 sunset picture (multiply), fixed so the same description gives the same bytes. */
export const SUNSET_GRADE = { color: '#ffb98a', alpha: 0.42 } as const;
export const STILL_QUALITY = 0.9;

export class SceneStillRenderer implements StillRenderer {
  readonly recipe = STILL_RECIPE_Q2;
  readonly quality = 2;
  private view: SceneView | null = null;
  private mount: HTMLElement | null = null;

  async render(describe: (variant: StillVariant) => SceneDescription, req: StillRenderRequest): Promise<StillRenderResult> {
    this.release();
    const t0 = performance.now();
    const { width, height } = req;
    const desc = stillDescription(describe(req.variant), req.levelId, req.variant);
    const mount = document.createElement('div');
    mount.setAttribute('aria-hidden', 'true');
    mount.dataset.stillBake = '';
    mount.style.cssText = `position:fixed;left:${-(width + 64)}px;top:0;width:${width}px;height:${height}px;overflow:hidden;pointer-events:none;`;
    document.body.appendChild(mount);
    this.mount = mount;
    const view = new SceneView({ mount, color: stillColor(req.style), onSelect: () => undefined, onHover: () => undefined, onFrame: () => undefined, quality: 2, pixelRatio: 1,
      night: bandScene(req.band).night });
    this.view = view;
    view.setDescription(desc);
    if (!view.setPreset(req.preset)) throw new Error('המבט של התמונה המוכנה אינו זמין לקומה זו.');
    view.capture(); // renders now; the drawing buffer is read below in the same task
    const src = view.renderer.domElement;
    if (src.width !== width || src.height !== height) throw new Error('גודל הציור אינו תואם את גודל התמונה המוכנה.');
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('ציור דו־ממדי אינו זמין בדפדפן.');
    ctx.fillStyle = stillBackdrop(req.style, req.band);
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(src, 0, 0);
    if (req.band === 'sunset') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = SUNSET_GRADE.alpha;
      ctx.fillStyle = SUNSET_GRADE.color;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    const blob = await encode(out);
    const project: Project = (p) => {
      const q = view.projectPoint(p);
      return q ? [q.x, q.y] : null;
    };
    let renderer = '';
    try {
      const info = view.rendererInfo();
      renderer = `${info.vendor} ${info.renderer}`.trim().slice(0, 160);
    } catch {
      renderer = '';
    }
    return { blob, project, renderer, ms: Math.round(performance.now() - t0) };
  }

  private release(): void {
    this.view?.dispose();
    this.view = null;
    this.mount?.remove();
    this.mount = null;
  }

  dispose(): void {
    this.release();
  }
}

/** WebP where the browser encodes it, else JPEG (an older Safari answers PNG for an unsupported type: it is re-encoded). */
export function encode(canvas: HTMLCanvasElement): Promise<Blob> {
  const as = (type: string): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, STILL_QUALITY));
  return as('image/webp').then(async (b) => {
    if (b && b.type === 'image/webp') return b;
    const j = await as('image/jpeg');
    if (!j) throw new Error('קידוד התמונה נכשל.');
    return j;
  });
}

/** A lightmap's RGBA bytes as a PNG blob (lossless: the AO / lamp values must survive). */
export function encodePng(width: number, height: number, rgba: Uint8ClampedArray): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return Promise.reject(new Error('ציור דו־ממדי אינו זמין בדפדפן.'));
  const img = ctx.createImageData(width, height);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('קידוד מפת התאורה נכשל.'))), 'image/png'));
}
