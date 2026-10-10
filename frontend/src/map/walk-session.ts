/**
 * Plan Studio 6, slice S4 (CR-029 section 4.2): the walk's input and frame loop around a WalkController - the browser
 * half of the walk, kept out of the Lit element. Keyboard (W/A/S/D and arrows, Shift = run, Q/E = 45 deg turns, Esc,
 * Enter, 1-9 = saved positions), mouse look by drag (default) or pointer lock (opt-in, silently back to drag where the
 * frame refuses it - section 4.5), touch (the left half moves like a joystick with a 56 px dead zone, the right half
 * looks). Frames run only while something moves (a key held, an auto-walk, the eye easing, a look drag): an idle walk
 * draws nothing (the kiosk rule). A walk under 24 fps for two seconds asks the element to drop a quality level in place
 * (section 3.4: never to stills - a still cannot be walked).
 */
import { NO_INPUT, WalkController, type WalkEvent, type WalkInput } from './walk-controller';
import type { WalkStart, WalkWorld } from './walk-world';
import type { MouseMode } from '../api/plan-view';

export const LOOK_DEG_PER_PX = 0.22;
export const TOUCH_LOOK_DEG_PER_PX = 0.3;
export const JOYSTICK_PX = 56;
export const LOW_WALK_FPS = 24;
const LOW_FPS_WINDOW_MS = 2000;

export interface WalkSessionHost {
  /** The element the keys are read on (its document), the canvas pointer events arrive on. */
  canvas: HTMLCanvasElement;
  /** The pose changed: the view moves its eye (and redraws). */
  onPose(): void;
  onEvents(events: WalkEvent[]): void;
  /** Esc: leave the walk. */
  onExit(): void;
  /** Enter: act on the device under the crosshair. */
  onAct(): void;
  /** The walk ran under LOW_WALK_FPS for a while. */
  onLowFps(fps: number): void;
}

export class WalkSession {
  readonly ctrl: WalkController;
  private keys = new Set<string>();
  private raf = 0;
  private last = 0;
  private drag: { id: number; x: number; y: number; kind: 'look' | 'move'; ox: number; oy: number } | null = null;
  private secondLook: { id: number; x: number; y: number } | null = null;
  private stick: { forward: number; strafe: number } | null = null;
  private locked = false;
  private mode: MouseMode = 'drag';
  private fpsWindow: { t0: number; frames: number } | null = null;
  private disposed = false;

  constructor(world: WalkWorld, private readonly host: WalkSessionHost, opts: { eye_m: number; mouseMode: MouseMode; start?: WalkStart | null }) {
    this.ctrl = new WalkController(world, { eye_m: opts.eye_m });
    if (opts.start) this.ctrl.place(opts.start);
    this.mode = opts.mouseMode;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('pointerlockchange', this.onLockChange);
    const c = host.canvas;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('mousemove', this.onLockedMove);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    const c = this.host.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('mousemove', this.onLockedMove);
    if (this.locked && document.pointerLockElement === c) document.exitPointerLock?.();
  }

  setMouseMode(mode: MouseMode): void {
    this.mode = mode;
    if (mode === 'drag' && this.locked) document.exitPointerLock?.();
  }

  setWorld(world: WalkWorld): void {
    this.ctrl.setWorld(world);
    this.kick();
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
    if (this.stick) {
      forward = forward || this.stick.forward;
      strafe = strafe || this.stick.strafe;
    }
    return { forward, strafe, turn, run: on('ShiftLeft', 'ShiftRight') };
  }

  private busy(): boolean {
    const i = this.input();
    return !!(i.forward || i.strafe || i.turn || this.ctrl.path || Math.abs(this.ctrl.eye - this.ctrl.eyeTarget) > 1e-4);
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

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (code === 'Escape') {
      e.preventDefault();
      this.host.onExit();
      return;
    }
    if (code === 'Enter') {
      e.preventDefault();
      this.host.onAct();
      return;
    }
    if (code === 'KeyQ' || code === 'KeyE') {
      e.preventDefault();
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
        this.goTo(s);
      }
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(code)) {
      e.preventDefault();
      this.keys.add(code);
      this.kick();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear(); // a key released outside the window never sticks
    this.stick = null;
  };

  goTo(s: WalkStart): void {
    const events = this.ctrl.place(s);
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

  // ---- pointers

  private onDown = (e: PointerEvent): void => {
    const c = this.host.canvas;
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      if (!this.locked && this.wantsLock()) {
        try {
          const req = c.requestPointerLock?.() as unknown;
          if (req && typeof (req as Promise<void>).catch === 'function') (req as Promise<void>).catch(() => { /* refused (the frame's policy): drag stays */ });
        } catch {
          /* refused: drag stays */
        }
      }
      if (!this.locked) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, kind: 'look', ox: e.clientX, oy: e.clientY };
      return;
    }
    // touch / pen: the left half is the stick, the right half looks (a second finger on the right looks too)
    const rect = c.getBoundingClientRect();
    const left = e.clientX - rect.left < rect.width / 2;
    if (left && !this.drag) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, kind: 'move', ox: e.clientX, oy: e.clientY };
    else if (!left && !this.secondLook) this.secondLook = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  private onMove = (e: PointerEvent): void => {
    if (this.secondLook && e.pointerId === this.secondLook.id) {
      const dx = e.clientX - this.secondLook.x;
      const dy = e.clientY - this.secondLook.y;
      this.secondLook.x = e.clientX;
      this.secondLook.y = e.clientY;
      this.ctrl.look(-dx * TOUCH_LOOK_DEG_PER_PX, dy * TOUCH_LOOK_DEG_PER_PX);
      this.host.onPose();
      return;
    }
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (d.kind === 'look') {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      // drag the world: moving the pointer right turns the view left (grab-and-pull), down looks up
      this.ctrl.look(-dx * LOOK_DEG_PER_PX, dy * LOOK_DEG_PER_PX);
      this.host.onPose();
      return;
    }
    const vx = e.clientX - d.ox;
    const vy = e.clientY - d.oy;
    const len = Math.hypot(vx, vy);
    if (len < 8) {
      this.stick = null;
      return;
    }
    const k = Math.min(1, len / JOYSTICK_PX);
    this.stick = { forward: (-vy / len) * k, strafe: (vx / len) * k };
    this.kick();
  };

  private onUp = (e: PointerEvent): void => {
    if (this.secondLook && e.pointerId === this.secondLook.id) this.secondLook = null;
    if (this.drag && e.pointerId === this.drag.id) {
      if (this.drag.kind === 'move') this.stick = null;
      this.drag = null;
    }
  };

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.host.canvas;
  };

  private onLockedMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.ctrl.look(e.movementX * LOOK_DEG_PER_PX, -e.movementY * LOOK_DEG_PER_PX);
    this.host.onPose();
  };

  /** The stick as the element draws it (null = no stick). */
  get stickVector(): { forward: number; strafe: number; x: number; y: number } | null {
    return this.stick && this.drag?.kind === 'move' ? { ...this.stick, x: this.drag.ox, y: this.drag.oy } : null;
  }

  get pointerLocked(): boolean {
    return this.locked;
  }
}

export { NO_INPUT };
