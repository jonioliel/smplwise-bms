/**
 * Plan Studio 6, slice S5-A (CR-029 section 4.2, touch row): what the walk's touch input becomes on screen - the glue between the
 * session's gesture callbacks (walk-session.ts), the HUD (walk-hud.ts), the minimap and the host element, kept out of `sw-plan-3d`
 * (which several slices edit) so the element carries only thin hooks. No Lit, no three at run time (the view is a type): the
 * element hands in a small host of closures.
 *
 * - tap / long press: walk-tap.ts decides (a tap walks to the foot of what was tapped or stops a walk under way and never
 *   operates a device; a long press hands the device under the finger to the host as `part-select`, exactly as a click does);
 * - the destination ring follows the camera while an auto-walk is under way;
 * - the saved positions' route: the HUD's play button, the note of the stop that is shown;
 * - the minimap under a finger or a mouse: a touch teleports, a drag follows, the point is held inside the level's extent;
 * - the numeric fields and the places list of the HUD;
 * - what the last input was (a finger has no crosshair and no "Enter" hint).
 */
import type { SceneView } from './scene-three';
import type { SwWalkHud, WalkHudField, WalkHudGoto, WalkHudRoute } from './walk-hud';
import type { MinimapFrame } from './walk-minimap';
import type { WalkRouteState, WalkSession, WalkSessionHost } from './walk-session';
import type { WalkWorld } from './walk-world';
import { EDGE_M } from './walk-controller';
import { resolveLongPress, resolveTap, type TapHit } from './walk-tap';
import { t } from '../i18n/he';

export interface WalkUiHost {
  view(): SceneView | null;
  walk(): WalkSession | null;
  hud(): SwWalkHud | null;
  world(): WalkWorld | null;
  minimap(): MinimapFrame | null;
  /** The device was long-pressed: the element emits `part-select`. */
  select(hit: TapHit): void;
  message(text: string, tone: 'info' | 'warn'): void;
  /** The last input became (or stopped being) a finger. */
  touching(on: boolean): void;
}

export class WalkTouchUi {
  private last: 'touch' | 'mouse' | 'key' | null = null;
  private ringShown = false;
  private minimapId: number | null = null;

  constructor(private readonly host: WalkUiHost) {}

  /** The last input was a finger (the crosshair and the aim hint are for a keyboard and a mouse). */
  get touch(): boolean {
    return this.last === 'touch';
  }

  /** The session's host callbacks for the touch walk (spread into WalkSessionHost). */
  hooks(): Pick<WalkSessionHost, 'onTap' | 'onLongPress' | 'onFov' | 'onStick' | 'onInput' | 'onFade' | 'onRoute'> {
    return {
      onTap: (x, y) => this.tap(x, y),
      onLongPress: (x, y) => this.longPress(x, y),
      onFov: (f) => this.host.view()?.setWalkFov(f),
      onStick: (s) => this.host.hud()?.setStick(s),
      onInput: (k) => this.input(k),
      onFade: (on) => this.host.hud()?.setFade(on),
      onRoute: (r) => this.route(r),
    };
  }

  /** The walk ended: nothing is left of the touch state. */
  reset(): void {
    this.last = null;
    this.ringShown = false;
    this.minimapId = null;
    this.host.touching(false);
  }

  input(kind: 'touch' | 'mouse' | 'key'): void {
    if (kind === this.last) return;
    this.last = kind;
    this.host.touching(kind === 'touch');
  }

  /** A tap: walk there (a tap while walking stops the walk); never a device (walk-tap.ts). */
  tap(x: number, y: number): void {
    const w = this.host.walk();
    const view = this.host.view();
    if (!w || !view) return;
    const r = resolveTap(view, w.ctrl, x, y);
    if (r.kind === 'walk') w.kick();
    else if (r.kind === 'unreachable') this.host.message(t('walk.noWay'), 'warn');
    this.updateTarget();
  }

  /** A long press: the device under the finger opens exactly as a click on it does - the host's own action path decides. */
  longPress(x: number, y: number): void {
    const view = this.host.view();
    const hit = view ? resolveLongPress(view, x, y) : null;
    if (!hit) return;
    try {
      navigator.vibrate?.(12);
    } catch {
      /* no haptics on this device */
    }
    this.host.select(hit);
  }

  route(r: WalkRouteState): void {
    const hud = this.host.hud();
    if (hud) hud.routePlaying = r.playing;
    if (r.label) this.host.message(r.label, 'info');
  }

  /** The ring where the auto-walk is heading, projected into the view after every pose (hidden when no walk is under way). */
  updateTarget(): void {
    const hud = this.host.hud();
    const w = this.host.walk();
    const view = this.host.view();
    if (!hud || !w || !view) return;
    const path = w.ctrl.path;
    if (!path || !path.length) {
      if (this.ringShown) {
        this.ringShown = false;
        hud.setTarget(null);
      }
      return;
    }
    const end = path[path.length - 1];
    const at = view.projectPoint([end[0], w.ctrl.pose().ground, end[1]]);
    this.ringShown = !!at;
    hud.setTarget(at);
  }

  // ---- the HUD's events

  goto(e: CustomEvent<WalkHudGoto>): void {
    const s = this.host.world()?.starts.find((q) => q.id === e.detail.id);
    if (s) this.host.walk()?.goTo(s);
  }

  /** The numeric walk fields (x, y in metres on the plan's axes, the heading in degrees): a keyboard alternative to every move. */
  field(e: CustomEvent<WalkHudField>): void {
    const w = this.host.walk();
    if (!w) return;
    const { key, value: v } = e.detail;
    const c = w.ctrl;
    w.goTo({ id: 'field', kind: 'centre', label: '', level: c.level, x: key === 'x' ? v : c.x, z: key === 'z' ? v : c.z, heading_deg: key === 'heading' ? v : c.heading, pitch_deg: c.pitch, eye_m: null });
  }

  routeToggle(e: CustomEvent<WalkHudRoute>): void {
    if (e.detail.play) this.host.walk()?.playRoute();
    else this.host.walk()?.cancelRoute();
  }

  // ---- the minimap under a finger or a mouse

  minimapDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.input(e.pointerType === 'mouse' ? 'mouse' : 'touch');
    this.minimapId = e.pointerId;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* the pointer is gone already */
    }
    e.preventDefault();
    this.minimapGo(e);
  }

  minimapMove(e: PointerEvent): void {
    if (e.pointerId === this.minimapId) this.minimapGo(e);
  }

  minimapUp(e: PointerEvent): void {
    if (e.pointerId === this.minimapId) this.minimapId = null;
  }

  private minimapGo(e: PointerEvent): void {
    const f = this.host.minimap();
    const w = this.host.walk();
    if (!f || !w) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let [x, z] = f.toM(e.clientX - rect.left, e.clientY - rect.top);
    const ex = this.host.world()?.levels.find((l) => l.id === w.ctrl.level)?.extent;
    if (ex) {
      x = Math.min(Math.max(x, ex.minX + EDGE_M), Math.max(ex.minX + EDGE_M, ex.maxX - EDGE_M));
      z = Math.min(Math.max(z, ex.minZ + EDGE_M), Math.max(ex.minZ + EDGE_M, ex.maxZ - EDGE_M));
    }
    w.goTo({ id: 'minimap', kind: 'centre', label: '', level: w.ctrl.level, x, z, heading_deg: w.ctrl.heading, pitch_deg: w.ctrl.pitch, eye_m: null });
  }
}
