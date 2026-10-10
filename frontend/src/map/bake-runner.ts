/**
 * The bake job of an editor's browser (CR-029 S3; docs/changes/CR-029-ST7-S3-NOTES.md sections 1 and 4): draws every slot a
 * request asks for, one at a time, and uploads each file as soon as it exists - stills and masks per (level, preset), then the
 * level's lightmap. Bounded on both sides: one render in flight, the browser gets the event loop back between slots (and
 * between lightmap rows), the add-on decodes one upload at a time from this browser. The lease of the request is renewed
 * while the job runs. Everything it needs is injected, so node tests run it with fakes (unit-bake-runner.spec.ts).
 */
import type { SceneDescription } from './scene-builder';
import { buildMask, expectedSlots, isoCamera, isoProject, sizeOf, slotName, stillDescription, MASK_RECIPE, type BakeSetting, type BakeSlot, type Project,
  type StillRenderer, type StillVariant } from './still-bake';
import { BAKE_CANCELLED, LIGHTMAP_RECIPE, bakeLightmap, type BakeOptions } from './lightmap-bake';

export interface BakeUpload {
  slot: BakeSlot;
  bakeKey: string;
  recipe: string;
  meta?: Record<string, unknown>;
  file: Blob;
}
export interface BakeDeps {
  bakeKey: string;
  levels: string[];
  setting: Pick<BakeSetting, 'presets' | 'styles' | 'bands' | 'lightmap' | 'size'>;
  /** The floor's synthetic description for a lamp variant (every level; skin-control.controlSceneInput). */
  describe: (variant: StillVariant) => SceneDescription;
  /** The live description (cameras for the masks); null = no cameras in the masks. */
  live: SceneDescription | null;
  /** Null when this browser has no WebGL: the stills and masks are left for another editor, the lightmap still bakes. */
  renderer: StillRenderer | null;
  upload: (u: BakeUpload) => Promise<unknown>;
  encodePng: (w: number, h: number, rgba: Uint8ClampedArray) => Promise<Blob>;
  /** Slots to skip (already current with this recipe - a resumed job). */
  skip?: ReadonlySet<string>;
  /** Only these slots (a request's scope); absent = everything the setting lists. */
  only?: ReadonlySet<string>;
  onProgress?: (done: number, total: number, slot: string) => void;
  cancelled?: () => boolean;
  /** Renew the request's lease; called at most every `heartbeatMs`. */
  heartbeat?: () => Promise<void>;
  heartbeatMs?: number;
  /** Give the event loop back (default: a macrotask). */
  yieldNow?: () => Promise<void>;
  lightmap?: Pick<BakeOptions, 'samples' | 'texel_m' | 'maxSide'>;
  now?: () => number;
}
export interface BakeOutcome {
  done: string[];
  skipped: string[];
  failed: { slot: string; error: string }[];
  /** Slots this browser could not draw (no WebGL). */
  left: string[];
  cancelled: boolean;
}

const macrotask = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export async function runBake(d: BakeDeps): Promise<BakeOutcome> {
  const { w, h } = sizeOf(d.setting);
  const all = expectedSlots(d.levels, d.setting).filter((s) => !d.only || d.only.has(slotName(s)));
  const total = all.length;
  const out: BakeOutcome = { done: [], skipped: [], failed: [], left: [], cancelled: false };
  const yieldNow = d.yieldNow ?? macrotask;
  const now = d.now ?? (() => Date.now());
  let beat = now();
  let count = 0;
  const step = async (slot: BakeSlot, work: () => Promise<void>): Promise<boolean> => {
    const name = slotName(slot);
    if (d.cancelled?.()) {
      out.cancelled = true;
      return false;
    }
    if (d.skip?.has(name)) {
      out.skipped.push(name);
    } else {
      try {
        await work();
        out.done.push(name);
      } catch (err) {
        if (err instanceof Error && err.message === BAKE_CANCELLED) {
          out.cancelled = true;
          return false;
        }
        out.failed.push({ slot: name, error: err instanceof Error ? err.message : String(err) });
      }
    }
    count++;
    d.onProgress?.(count, total, name);
    if (d.heartbeat && now() - beat >= (d.heartbeatMs ?? 240_000)) {
      beat = now();
      await d.heartbeat();
    }
    await yieldNow();
    return true;
  };

  for (const level of d.levels) {
    for (const preset of d.setting.presets) {
      const group = all.filter((s) => s.level_id === level && s.preset === preset);
      const mask = group.find((s) => s.kind === 'mask');
      const stills = group.filter((s) => s.kind === 'still');
      let project: Project | null = null;
      let maskSent = false;
      const sendMask = async (): Promise<void> => {
        if (!mask || maskSent) return;
        maskSent = true;
        const proceed = await step(mask, async () => {
          let pr = project;
          if (!pr) {
            if (preset !== 'iso') throw new Error('אין מצלמה למסכות: התמונות של מבט זה לא צוירו בדפדפן הזה.');
            pr = isoProject(isoCamera(stillDescription(d.describe('off'), level, 'off'), w, h));
          }
          const doc = buildMask(d.describe('off'), level, { preset, width: w, height: h }, pr, d.live);
          await d.upload({ slot: mask, bakeKey: d.bakeKey, recipe: MASK_RECIPE, file: new Blob([JSON.stringify(doc)], { type: 'application/json' }) });
        });
        if (!proceed) throw new Error(BAKE_CANCELLED);
      };
      try {
        for (const s of stills) {
          if (!d.renderer) {
            out.left.push(slotName(s));
            continue;
          }
          const renderer = d.renderer;
          const proceed = await step(s, async () => {
            const r = await renderer.render(d.describe, { levelId: level, preset, style: s.style as never, band: s.band as never, variant: s.variant as never, width: w, height: h });
            project ??= r.project;
            await d.upload({ slot: s, bakeKey: d.bakeKey, recipe: renderer.recipe, meta: { renderer: r.renderer, ms: r.ms, quality: renderer.quality }, file: r.blob });
          });
          if (!proceed) throw new Error(BAKE_CANCELLED);
          await sendMask(); // right after the first picture: the masks share its camera
        }
        if (mask && !maskSent) {
          if (!d.renderer && preset !== 'iso') out.left.push(slotName(mask));
          else await sendMask();
        }
      } catch (err) {
        if (err instanceof Error && err.message === BAKE_CANCELLED) {
          out.cancelled = true;
          d.renderer?.dispose();
          return out;
        }
        throw err;
      }
    }
    const lm = all.find((s) => s.kind === 'lightmap' && s.level_id === level);
    if (lm) {
      const proceed = await step(lm, async () => {
        const res = await bakeLightmap(d.describe('on'), level, { ...d.lightmap, yieldRow: (r) => (r % 8 === 7 ? yieldNow() : undefined), cancelled: d.cancelled });
        const file = await d.encodePng(res.width, res.height, res.rgba);
        await d.upload({ slot: lm, bakeKey: d.bakeKey, recipe: LIGHTMAP_RECIPE, meta: { ...res.meta }, file });
      });
      if (!proceed) {
        out.cancelled = true;
        break;
      }
    }
  }
  d.renderer?.dispose();
  return out;
}
