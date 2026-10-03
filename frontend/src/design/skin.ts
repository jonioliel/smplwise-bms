import { currentSkin, onDesign } from './apply';
import type { SkinId } from './skins';

/**
 * A screen that changes its STRUCTURE for a skin (Bubble phase C, 2026-10-02: the home, area and multimedia screens draw pill
 * rows and sheets in the bubble skin) reads the skin through this controller rather than through CSS alone: the skin sheet
 * (design/apply.ts) may only dress what is there, and the 50-rule budget keeps it that way. The controller mirrors the skin
 * in force onto the host as `data-skin`, so the screen's own styles can key on `:host([data-skin='bubble'])`, and re-renders
 * the host whenever the installation's skin (or a `?skin=` override) changes.
 */
export class SkinController {
  private stop?: () => void;
  constructor(private host: HTMLElement & { requestUpdate(): void; addController(c: unknown): void }) {
    host.addController(this);
  }
  get id(): SkinId {
    return currentSkin();
  }
  /** The bubble skin is in force: pills, sheets, the dock. */
  get bubble(): boolean {
    return currentSkin() === 'bubble';
  }
  private mirror() {
    const id = currentSkin();
    if (this.host.getAttribute('data-skin') !== id) this.host.setAttribute('data-skin', id);
  }
  hostConnected() {
    this.mirror();
    this.stop = onDesign(() => {
      this.mirror();
      this.host.requestUpdate();
    });
  }
  hostDisconnected() {
    this.stop?.();
  }
}

/** A stable decorative hue (1..8) for a name or id: icon rings of areas and devices (decoration only, never meaning). */
export function hueOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 8) + 1;
}
