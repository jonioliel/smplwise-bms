/**
 * Plan Studio 6, slices S4 / S5-A (CR-029 section 4.2): the walk's input and frame loop around a WalkController - the browser
 * half of the walk, kept out of the Lit element. Keyboard (W/A/S/D and arrows, Shift = run, Q/E = 45 deg turns, Esc,
 * Enter, 1-9 = saved positions), mouse look by drag (default) or pointer lock (opt-in, silently back to drag where the
 * frame refuses it - section 4.5), touch (S5-A: a floating joystick under the left thumb, a drag on the right looks with a
 * 120 ms ease, two fingers pinch the field of view, a tap walks there, a long press picks a device - walk-touch.ts is the
 * gesture machine, this class owns the real pointers and the real clock). Frames run only while something moves (a key held,
 * an auto-walk, the eye easing, a stick pushed, a look still easing): an idle walk draws nothing (the kiosk rule). A walk
 * under 24 fps for two seconds asks the element to drop a quality level in place (section 3.4: never to stills - a still
 * cannot be walked). The saved positions play as a route (walk-route.ts), one stop per dwell, until a hand touches the walk.
 *
 * Touch pointers are taken in the CAPTURE phase on the surface that holds the canvas and stopped there, so the view's own
 * click detection and the orbit controls never see a finger: the walk is the only owner of touch while it runs.
 */
import { NO_INPUT, WalkController, type WalkEvent, type WalkInput } from './walk-controller';
import type { WalkStart, WalkWorld } from './walk-world';
import type { MouseMode } from '../api/plan-view';
import { TouchGestures, type TouchAction } from './walk-touch';
import { LookEase } from './walk-look';
import { RoutePlayer, ROUTE_DWELL_MS, routeStops } from './walk-route';

export const LOOK_DEG_PER_PX = 0.22;
export const LOW_WALK_FPS = 24;
const LOW_FPS_WINDOW_MS = 2000;
/** The dim before a jump between two stops of a route. */
export const ROUTE_FADE_MS = 150;

export interface WalkRouteState {
  playing: boolean;
  index?: number;
  label?: string;
}

export interface WalkSessionHost {
  /** The element the keys are read on (its document), the canvas pointer events arrive on. */
  canvas: HTMLCanvasElement;
  /** The element that holds the canvas: touch is caught there in the capture phase (default: the canvas's parent). */
  surface?: HTMLElement;
  /** The pose changed: the view moves its eye (and redraws). */
  onPose(): void;
  onEvents(events: WalkEvent[]): void;
  /** Esc: leave the walk. */
  onExit(): void;
  /** Enter: act on the device under the crosshair. */
  onAct(): void;
  /** The walk ran under LOW_WALK_FPS for a while. */
  onLowFps(fps: number): void;
  /** S5-A: a tap (client coordinates) - the element resolves it to a walk (walk-tap.ts). */
  onTap?(x: number, y: number): void;
  /** S5-A: a long press - the element opens the device under the finger. */
  onLongPress?(x: number, y: number): void;
  /** S5-A: a pinch changed the field of view. */
  onFov?(fov: number): void;
  /** S5-A: the joystick for the HUD to draw (null = released). */
  onStick?(stick: { origin: [number, number]; knob: [number, number]; run: boolean } | null): void;
  /** S5-A: what the last input was (the crosshair is for the keyboard and the mouse, not for a finger). */
  onInput?(kind: 'touch' | 'mouse' | 'key'): void;
  /** S5-A: the dim between two stops of a route. */
  onFade?(on: boolean): void;
  /** S5-A: the route started, moved to a stop, or ended. */
  onRoute?(state: WalkRouteState): void;
}

export interface WalkSessionOptions {
  eye_m: number;
  mouseMode: MouseMode;
  start?: WalkStart | null;
  /** The field of view the touch look sensitivity and the pinch start from (degrees). */
  fov?: number;
  /** The 120 ms ease on touch turns (the motion setting; false = a turn is applied at once). */
  ease?: boolean;
  /** How long each stop of a route shows (default 4 s) and the dim between stops (0 = none). */
  routeDwellMs?: number;
  fadeMs?: number;
}

export class WalkSession {
  readonly ctrl: WalkController;
  private keys = new Set<string>();
  private raf = 0;
  private last = 0;
  private drag: { id: number; x: number; y: number } | null = null;
  private locked = false;
  private mode: MouseMode = 'drag';
  private fpsWindow: { t0: number; frames: number } | null = null;
  private disposed = false;
  private readonly surface: HTMLElement;
  private readonly touch: TouchGestures;
  private readonly ease: LookEase | null;
  private touchStick: { forward: number; strafe: number; run: boolean } | null = null;
  private longTimer = 0;
  private route: RoutePlayer | null = null;
  private routeTimer = 0;
  private fadeTimer = 0;
  private readonly routeDwellMs: number;
  private readonly fadeMs: number;

  constructor(world: WalkWorld, private readonly host: WalkSessionHost, opts: WalkSessionOptions) {
    this.ctrl = new WalkController(world, { eye_m: opts.eye_m });
    if (opts.start) this.ctrl.place(opts.start);
    this.mode = opts.mouseMode;
    this.routeDwellMs = opts.routeDwellMs ?? ROUTE_DWELL_MS;
    this.fadeMs = opts.fadeMs ?? ROUTE_FADE_MS;
    this.ease = opts.ease === false ? null : new LookEase();
    this.surface = host.surface ?? host.canvas.parentElement ?? host.canvas;
    this.touch = new TouchGestures(() => this.surface.getBoundingClientRect(), opts.fov);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onHidden);
    document.addEventListener('pointerlockchange', this.onLockChange);
    const c = host.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('mousemove', this.onLockedMove);
    c.addEventListener('contextmenu', this.onContextMenu);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) this.surface.addEventListener(t, this.onTouch, true);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.longTimer);
    window.clearTimeout(this.routeTimer);
    window.clearTimeout(this.fadeTimer);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onHidden);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    const c = this.host.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('mousemove', this.onLockedMove);
    c.removeEventListener('contextmenu', this.onContextMenu);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) this.surface.removeEventListener(t, this.onTouch, true);
    if (this.locked && document.pointerLockElement === c) document.exitPointerLock?.();
    this.host.onStick?.(null);
    this.host.onFade?.(false);
  }

  setMouseMode(mode: MouseMode): void {
    this.mode = mode;
    if (mode === 'drag' && this.locked) document.exitPointerLock?.();
  }

  setWorld(world: WalkWorld): void {
    const events = this.ctrl.setWorld(world);
    if (events.length) this.host.onEvents(events);
    this.kick();
  }

  /** The field of view the touch look and the next pinch start from (the element sets it when it enters the walk). */
  setFov(fov: number): void {
    this.touch.setFov(fov);
  }

  /** Whether pointer lock is worth asking for: `lock` always, `auto` only outside a frame (inside the Ingress frame the
   * permission policy usually refuses it - section 4.5). */
  private wantsLock(): boolean {
    if (this.mode === 'lock') return true;
    if (this.mode !== 'auto') return false;
    try {
      return window.self === window.top;
    } catch {
      return false;
    }
  }

  /** The current input from the keys and the touch stick. */
  input(): WalkInput {
    const k = this.keys;
    const on = (...codes: string[]): boolean => codes.some((c) => k.has(c));
    let forward = (on('KeyW', 'ArrowUp') ? 1 : 0) - (on('KeyS', 'ArrowDown') ? 1 : 0);
    let strafe = (on('KeyD') ? 1 : 0) - (on('KeyA') ? 1 : 0);
    const turn = (on('ArrowRight') ? 1 : 0) - (on('ArrowLeft') ? 1 : 0);
    if (this.touchStick) {
      forward = forward || this.touchStick.forward;
      strafe = strafe || this.touchStick.strafe;
    }
    return { forward, strafe, turn, run: on('ShiftLeft', 'ShiftRight') || !!(this.touchStick && (this.touchStick.forward || this.touchStick.strafe) && this.touchStick.run) };
  }

  private busy(): boolean {
    const i = this.input();
    return !!(i.forward || i.strafe || i.turn || this.ctrl.path || this.ease?.pending || Math.abs(this.ctrl.eye - this.ctrl.eyeTarget) > 1e-4);
  }

  /** Make sure the loop runs (a key went down, a path was set, the eye setting changed). */
  kick(): void {
    if (this.raf || this.disposed) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (t: number): void => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = this.last ? (t - this.last) / 1000 : 1 / 60;
    this.last = t;
    if (this.ease?.pending) {
      const [dh, dp] = this.ease.step(dt);
      if (dh || dp) this.ctrl.look(dh, dp);
    }
    const events = this.ctrl.step(dt, this.input());
    this.host.onPose();
    if (events.length) this.host.onEvents(events);
    this.watchFps(t);
    if (this.busy()) this.raf = requestAnimationFrame(this.tick);
    else this.fpsWindow = null;
  };

  private watchFps(t: number): void {
    const w = this.fpsWindow;
    if (!w) {
      this.fpsWindow = { t0: t, frames: 0 };
      return;
    }
    w.frames++;
    const span = t - w.t0;
    if (span < LOW_FPS_WINDOW_MS) return;
    const fps = (w.frames * 1000) / span;
    this.fpsWindow = { t0: t, frames: 0 };
    if (fps < LOW_WALK_FPS && !document.hidden) this.host.onLowFps(fps);
  }

  private typing(e: KeyboardEvent): boolean {
    const path = e.composedPath();
    return path.some((n) => n instanceof HTMLElement && (n.tagName === 'INPUT' || n.tagName === 'SELECT' || n.tagName === 'TEXTAREA' || n.isContentEditable));
  }

  /** The key went to a button or a link (through shadow roots): that control's own key handling stays. */
  private onControl(e: KeyboardEvent): boolean {
    return e.composedPath().some((n) => n instanceof HTMLElement && (n.tagName === 'BUTTON' || n.tagName === 'A'));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (code === 'Escape') {
      e.preventDefault();
      this.host.onExit();
      return;
    }
    if (code === 'Enter') {
      if (this.onControl(e)) return; // Enter on a focused button presses that button (the walk bar, the sheet): it is not "act"
      e.preventDefault();
      this.host.onAct();
      return;
    }
    if (code === 'KeyQ' || code === 'KeyE') {
      e.preventDefault();
      this.host.onInput?.('key');
      this.cancelRoute();
      this.ctrl.look(code === 'KeyQ' ? -45 : 45, 0);
      this.host.onPose();
      return;
    }
    const digit = /^Digit([1-9])$/.exec(code);
    if (digit) {
      const saved = this.ctrl.world.starts.filter((s) => s.kind === 'saved');
      const s = saved[Number(digit[1]) - 1];
      if (s) {
        e.preventDefault();
        this.host.onInput?.('key');
        this.goTo(s);
      }
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(code)) {
      e.preventDefault();
      this.host.onInput?.('key');
      this.cancelRoute();
      this.keys.add(code);
      this.kick();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear(); // a key released outside the window never sticks
    this.endTouches();
  };

  private onHidden = (): void => {
    if (document.hidden) this.endTouches();
  };

  /** Every finger is gone (the window blurred, the tab went away): no stick stays pushed. */
  private endTouches(): void {
    window.clearTimeout(this.longTimer);
    this.apply(this.touch.reset());
    this.touchStick = null;
    this.host.onStick?.(null);
  }

  /** Stand at a start point (a saved position, a door, a room, a camera): a hand takes over from a route. */
  goTo(s: WalkStart): void {
    this.cancelRoute();
    this.jump(s);
  }

  private jump(s: WalkStart): void {
    const events = this.ctrl.place(s);
    this.ease?.clear();
    this.host.onPose();
    if (events.length) this.host.onEvents(events);
    this.kick();
  }

  /** Walk to a floor point (tap-to-walk); false when no way leads there. */
  walkTo(x: number, z: number): boolean {
    const ok = !!this.ctrl.pathTo(x, z);
    if (ok) this.kick();
    return ok;
  }

  // ---- the route: the saved positions, one stop per dwell

  /** Play the saved positions in order, `routeDwellMs` each; false when the floor has fewer than two. Any input stops it. */
  playRoute(): boolean {
    const player = new RoutePlayer(routeStops(this.ctrl.world.starts), { dwellMs: this.routeDwellMs });
    const first = player.start(performance.now());
    if (!first) return false;
    this.cancelRoute();
    this.route = player;
    this.host.onRoute?.({ playing: true });
    this.showStop(first.stop, first.index);
    this.armRoute();
    return true;
  }

  get routePlaying(): boolean {
    return this.route !== null;
  }

  cancelRoute(): void {
    window.clearTimeout(this.routeTimer);
    window.clearTimeout(this.fadeTimer);
    if (!this.route) return;
    this.route.stop();
    this.route = null;
    this.host.onFade?.(false);
    this.host.onRoute?.({ playing: false });
  }

  private armRoute(): void {
    window.clearTimeout(this.routeTimer);
    const due = this.route?.dueAt;
    if (due === null || due === undefined) return;
    this.routeTimer = window.setTimeout(() => this.routeTick(), Math.max(0, due - performance.now()) + 1);
  }

  private routeTick(): void {
    const r = this.route;
    if (!r || this.disposed) return;
    const step = r.advance(performance.now());
    if (step === null) {
      this.armRoute();
      return;
    }
    if (step === 'end') {
      this.route = null;
      this.host.onRoute?.({ playing: false });
      return;
    }
    this.showStop(step.stop, step.index);
    this.armRoute();
  }

  /** Jump to a stop of the route: dim, jump, undim (when the dim is on), then say which stop it is. */
  private showStop(stop: WalkStart, index: number): void {
    const go = (): void => {
      if (!this.route || this.disposed) return;
      this.jump(stop);
      this.host.onFade?.(false);
      this.host.onRoute?.({ playing: true, index, label: stop.label });
    };
    window.clearTimeout(this.fadeTimer);
    if (this.fadeMs > 0 && this.host.onFade) {
      this.host.onFade(true);
      this.fadeTimer = window.setTimeout(go, this.fadeMs);
    } else go();
  }

  // ---- touch (S5-A): the gesture machine decides, this applies

  private onTouch = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    e.stopPropagation(); // the view's click detection and the orbit controls never see a finger
    if (e.type === 'pointerdown' || e.type === 'pointermove') e.preventDefault();
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    let actions: TouchAction[];
    if (e.type === 'pointerdown') {
      this.host.onInput?.('touch');
      this.cancelRoute();
      try {
        this.host.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer is gone already */
      }
      actions = this.touch.down(p);
    } else if (e.type === 'pointermove') actions = this.touch.move(p);
    else if (e.type === 'pointerup') actions = this.touch.up(p);
    else actions = this.touch.cancel(p);
    this.apply(actions);
    this.armLong();
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault(); // a long press on the canvas is a gesture of the walk, not the browser's menu
  };

  private apply(actions: TouchAction[]): void {
    for (const a of actions) {
      switch (a.type) {
        case 'stick':
          this.touchStick = { forward: a.forward, strafe: a.strafe, run: a.run };
          this.host.onStick?.({ origin: a.origin, knob: a.knob, run: a.run });
          this.kick();
          break;
        case 'stick-end':
          this.touchStick = null;
          this.host.onStick?.(null);
          break;
        case 'look':
          if (this.ease) {
            this.ease.add(a.dHeading, a.dPitch);
            this.kick();
          } else {
            this.ctrl.look(a.dHeading, a.dPitch);
            this.host.onPose();
          }
          break;
        case 'fov':
          this.host.onFov?.(a.fov);
          break;
        case 'tap':
          this.host.onTap?.(a.x, a.y);
          break;
        case 'long-press':
          this.host.onLongPress?.(a.x, a.y);
          break;
      }
    }
  }

  /** One timeout for the long press that is next due (re-armed after every finger event). */
  private armLong(): void {
    window.clearTimeout(this.longTimer);
    const due = this.touch.nextDeadline();
    if (due === null || this.disposed) return;
    this.longTimer = window.setTimeout(() => {
      this.apply(this.touch.tick(performance.now()));
      this.armLong();
    }, Math.max(0, due - performance.now()) + 1);
  }

  // ---- the mouse (touch and pen are the gesture machine's)

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    this.host.onInput?.('mouse');
    this.cancelRoute();
    const c = this.host.canvas;
    if (!this.locked && this.wantsLock()) {
      try {
        const req = c.requestPointerLock?.() as unknown;
        if (req && typeof (req as Promise<void>).catch === 'function') (req as Promise<void>).catch(() => { /* refused (the frame's policy): drag stays */ });
      } catch {
        /* refused: drag stays */
      }
    }
    if (!this.locked) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  private onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (e.pointerType !== 'mouse' || !d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    // drag the world: moving the pointer right turns the view left (grab-and-pull), down looks up
    this.ctrl.look(-dx * LOOK_DEG_PER_PX, dy * LOOK_DEG_PER_PX);
    this.host.onPose();
  };

  private onUp = (e: PointerEvent): void => {
    if (this.drag && e.pointerId === this.drag.id) this.drag = null;
  };

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.host.canvas;
  };

  private onLockedMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.ctrl.look(e.movementX * LOOK_DEG_PER_PX, -e.movementY * LOOK_DEG_PER_PX);
    this.host.onPose();
  };

  /** The stick as the HUD draws it (null = no stick). */
  get stickVector(): { forward: number; strafe: number } | null {
    return this.touchStick ? { forward: this.touchStick.forward, strafe: this.touchStick.strafe } : null;
  }

  get pointerLocked(): boolean {
    return this.locked;
  }
}

export { NO_INPUT };
