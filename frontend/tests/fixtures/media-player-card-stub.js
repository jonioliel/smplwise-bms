// CR-016 S3 test stub of S2's <media-player-card> (components/media-player-card.ts), used by tag until S2 merges.
// Same contract: `.device` (a PlayerDevice), `.size`, `.compact`; an "open-player" event { key } (composed, bubbling) from the card's
// "נגן" / "שלט" button. It draws a small tile (name, state line, play state) so the area card and the widget can be reviewed; it is NOT the
// real card and is never imported by the product. The specs add it with `addScriptTag` AFTER the app loaded, and it defines the tag only when the product has not (so it never collides with S2's real card).
(() => {
  if (customElements.get('media-player-card')) return;
  class MediaPlayerCardStub extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._device = null;
    }
    set device(d) {
      this._device = d;
      this.render();
    }
    get device() {
      return this._device;
    }
    set size(_v) {}
    set compact(_v) {}
    connectedCallback() {
      // elements created before this tag was defined carry `device` as an own property: move it to the setter
      if (Object.prototype.hasOwnProperty.call(this, 'device')) {
        const v = this.device;
        delete this.device;
        this.device = v;
      }
    }
    render() {
      const d = this._device;
      if (!d) return;
      const l = d.live;
      const playing = l.power === 'on' && l.play === 'playing';
      const state = l.power === 'unavailable' ? 'לא זמין' : l.power === 'off' ? 'כבוי' : d.kind === 'receiver' ? (l.now.label || 'דולק') : playing ? `מנגן · ${l.now.title ?? ''}` : l.play === 'paused' ? 'מושהה' : 'לא מנגן';
      this.shadowRoot.innerHTML = `<style>
        :host{display:block}
        .t{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:18px;border:1px solid rgba(60,60,67,.14);background:rgba(255,255,255,.55);font:14px system-ui,'Segoe UI','Noto Sans Hebrew',sans-serif;color:#1c1c1e}
        :host-context([data-devices-scheme=dark]) .t{background:rgba(44,44,46,.6);border-color:rgba(255,255,255,.12);color:#f5f5f7}
        .a{inline-size:48px;block-size:48px;border-radius:12px;flex:none;background:linear-gradient(135deg,#3b82c4,#6fb1ea)}
        .x{flex:1;min-inline-size:0;display:flex;flex-direction:column;line-height:1.3}
        b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        small{opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        button{min-block-size:44px;padding-inline:16px;border-radius:999px;border:0;background:rgba(0,122,255,.13);color:#0062cc;font:inherit;font-weight:600;cursor:pointer}
      </style><div class="t" data-stub-card><span class="a"></span><span class="x"><b>${d.name}</b><small>${state}</small></span><button type="button" data-stub-open>${d.kind === 'receiver' ? 'שלט' : 'נגן'}</button></div>`;
      this.shadowRoot.querySelector('[data-stub-open]').addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('open-player', { detail: { key: d.key }, bubbles: true, composed: true }));
      });
    }
  }
  customElements.define('media-player-card', MediaPlayerCardStub);
})();
