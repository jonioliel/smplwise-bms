/**
 * The floor map's side of Plan Studio 6 stills (CR-029 S3; docs/changes/CR-029-ST7-S3-NOTES.md): which level / style / band a
 * still view shows, the still view itself, and the editor's "prepare stills and lighting" flow - fetch the floor's bake state,
 * open (or join) the regenerate request, claim it, draw every slot in this browser (bake-runner.ts), close the request. Kept
 * apart from explore-floor-map.ts so the host only wires state and buttons. Hebrew texts, no internal codes on screen.
 */
import { html, nothing } from 'lit';
import type { MapBundle } from '../api/maps';
import type { GeometryDoc } from '../map/geometry';
import { buildScene, type Catalog3DLookup, type SceneDescription, type SceneInput } from '../map/scene-builder';
import { controlSceneInput } from '../map/skin-control';
import { bandAt, needsBake, type StillStyle, type StillVariant } from '../map/still-bake';
import type { RoomStateLayer } from '../map/room-state';
import type { PlanViewDials } from '../api/plan-view';
import { claimBake, finishBake, floorBakes, requestBake, uploadBake } from '../api/bakes';
import { describeError } from '../api/client';
import { webglAvailable } from '../map/webgl';
import '../map/sw-plan-stills';

/** The level a still view shows: the level filter, else the first level of the floor, else the default level. */
export function stillsLevel(b: MapBundle | null, levelFilter: string | null): string {
  return levelFilter ?? b?.levels[0]?.id ?? 'L0';
}

/** The shown level has a current still set (any picture of it). */
export function hasStills(b: MapBundle | null, level: string): boolean {
  const lv = b?.bakes?.levels[level];
  return !!lv && Object.keys(lv.stills).length > 0;
}

/** The style a still is shown in: the person's dial, `auto` = the UI theme (light -> architectural, dark -> digital twin). */
export function stillsStyle(style: PlanViewDials['style']): StillStyle {
  if (style === 'light' || style === 'dark') return style;
  const theme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The still view of a floor level with the live room states (lit rooms through their masks, open doors, presence). */
export function renderStills(b: MapBundle, level: string, layer: RoomStateLayer | null, dials: PlanViewDials, now: Date = new Date()) {
  const rooms: Record<string, { lit: boolean; presence: boolean }> = {};
  for (const [id, r] of Object.entries(layer?.rooms ?? {})) rooms[id] = { lit: r.lit === true, presence: r.presence === true || r.presenceFade > 0 };
  return html`<sw-plan-stills data-floor-stills .bakes=${b.bakes ?? null} .level=${level} .styleId=${stillsStyle(dials.style)} .band=${bandAt(now)}
    .rooms=${rooms} .openOpenings=${layer?.openOpenings ?? []}></sw-plan-stills>`;
}

export interface BakeContext {
  bundle: MapBundle;
  geometry: GeometryDoc;
  catalog: Catalog3DLookup | null;
  /** The live description of every level (cameras for the masks), when the 3D built one. */
  live: SceneDescription | null;
  onProgress: (text: string) => void;
  cancelled: () => boolean;
}

/** The editor's whole bake: returns the Hebrew line the host shows when it ends. Never throws. */
export async function runFloorBake(ctx: BakeContext): Promise<string> {
  const b = ctx.bundle;
  try {
    const info = await floorBakes(b.floorId);
    if (!info.bake_key) return 'לקומה אין מבנה מפורסם — תמונות מוכנות נוצרות מהמבנה המפורסם בלבד.';
    if (b.geometryRef?.doc_hash !== info.doc_hash) return 'המפה מציגה טיוטה — תמונות מוכנות נוצרות מהמבנה המפורסם בלבד.';
    const req = await requestBake(b.floorId, {});
    await claimBake(b.floorId, req.job.id);
    const base: SceneInput = { doc: ctx.geometry, width: b.width, height: b.height, entityStates: {}, circuitStates: {}, catalog: ctx.catalog, anchors: [],
      zones: b.zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null })) };
    const memo = new Map<StillVariant, SceneDescription>();
    const describe = (v: StillVariant): SceneDescription => {
      let d = memo.get(v);
      if (!d) {
        d = buildScene(controlSceneInput(base, v === 'on' ? 'all_on' : 'all_off'));
        memo.set(v, d);
      }
      return d;
    };
    const [{ runBake }, scene] = await Promise.all([import('../map/bake-runner'), import('../map/sw-plan-3d')]);
    const renderer = webglAvailable() ? new scene.SceneStillRenderer() : null;
    const outcome = await runBake({
      bakeKey: info.bake_key, levels: req.job.scope.levels, setting: { ...info.setting, presets: req.job.scope.presets as never, styles: req.job.scope.styles as never,
        bands: req.job.scope.bands as never, lightmap: req.job.scope.lightmap }, describe, live: ctx.live, renderer,
      upload: (u) => uploadBake(b.floorId, u), encodePng: scene.encodePng, only: new Set(req.expected),
      onProgress: (done, total) => ctx.onProgress(`מכין תמונות ותאורה… ${done}/${total}`), cancelled: ctx.cancelled,
      heartbeat: async () => { await claimBake(b.floorId, req.job.id); },
    });
    if (outcome.cancelled) {
      await finishBake(b.floorId, req.job.id, 'cancelled', 'left the page').catch(() => undefined);
      return 'ההכנה הופסקה; מה שנשמר נשאר.';
    }
    if (outcome.failed.length || outcome.left.length) {
      const why = outcome.left.length ? 'no WebGL in this browser' : outcome.failed[0].error;
      await finishBake(b.floorId, req.job.id, 'failed', why).catch(() => undefined);
      return outcome.left.length
        ? 'בדפדפן הזה אין תלת־ממד: נשמרה מפת התאורה בלבד; התמונות יוכנו בדפדפן של עורך אחר.'
        : `חלק מהקבצים לא נשמרו (${outcome.failed.length}): ${outcome.failed[0].error}`;
    }
    await finishBake(b.floorId, req.job.id, 'done');
    return `התמונות המוכנות ומפת התאורה נשמרו (${outcome.done.length} קבצים).`;
  } catch (err) {
    return describeError(err);
  }
}

/** The status line of the editor's tool, from the bundle alone (no request): nothing to show when the set is current. */
export function bakeStatus(b: MapBundle | null, recipe: string): string | null {
  const n = needsBake(b?.bakes ?? null, recipe);
  if (n === null) return 'התמונות המוכנות מעודכנות.';
  if (n === 'none') return 'לקומה אין עדיין תמונות מוכנות.';
  if (n === 'stale') return 'המבנה השתנה — התמונות המוכנות אינן מעודכנות.';
  if (n === 'incomplete') return 'חלק מהתמונות המוכנות חסרות.';
  return 'יש גרסה משופרת של התמונות המוכנות.';
}

export const BAKE_BUTTON_HE = 'הכן תמונות ותאורה';
export const BAKE_TITLE_HE = 'מצייר בדפדפן הזה את התמונות המוכנות של הקומה (לכל סגנון ושעה) ואת מפת התאורה, ושומר אותן במתקן — למכשירים חלשים, למסך קיר ולאפליקציה';
export { nothing };
