/**
 * CR-015 S3 test stub: a stand-in for S2's `<media-screen-card .device .size .compact @open-remote>` (components/
 * media-screen-card.ts) until S2 merges. It draws the compact tile of the approved mockup (the area screen's `.mt`: the small
 * now-showing image, name and state, power, volume, mute, "שלט") so the area card and the home widget can be reviewed
 * in context. Plain browser JS (injected by the evidence specs); defined only when the real element does not exist.
 * It sends nothing - the buttons only raise `open-remote` (the real card owns power / volume / mute).
 */
(() => {
  if (customElements.get('media-screen-card')) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  class Stub extends HTMLElement {
    set device(v) {
      this._d = v;
      this.render();
    }
    get device() {
      return this._d;
    }
    connectedCallback() {
      this.attachShadow({ mode: 'open' });
      this.render();
    }
    render() {
      const d = this._d;
      if (!d || !this.shadowRoot) return;
      const l = d.live;
      const lit = l.power === 'on' || l.power === 'art';
      const state = l.power === 'unavailable' ? 'לא זמין' : l.power === 'off' || l.power === 'standby' ? 'כבוי' : l.power === 'art' ? 'מצב אמנות' : l.now.label || 'דולק';
      const hue = l.now.hue ?? 215;
      this.shadowRoot.innerHTML = `<style>
        :host{display:block}
        .mt{display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:10px 12px;align-items:center;padding:10px;border-radius:18px;background:rgba(255,255,255,.5);border:1px solid rgba(60,60,67,.12);font-family:inherit;color:#1c1c1e}
        .th{position:relative;inline-size:96px;aspect-ratio:16/10;border-radius:12px;overflow:hidden;background:${lit ? `linear-gradient(135deg,hsl(${hue} 55% 26%),hsl(${hue} 65% 52%))` : 'rgba(120,120,128,.18)'}}
        .tx b{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tx small{font-size:12.5px;color:#4c4c50}
        .pw{inline-size:44px;block-size:44px;border-radius:50%;border:0;background:${lit ? '#007aff' : 'rgba(120,120,128,.18)'};color:${lit ? '#fff' : '#4c4c50'}}
        .ctl{grid-column:1/-1;display:flex;gap:8px;align-items:center}.ctl span{flex:1}
        button.rm{min-block-size:44px;padding-inline:16px;border-radius:999px;border:1px solid rgba(60,60,67,.12);background:rgba(0,122,255,.13);color:#0062cc;font:inherit;font-weight:600}
        </style><div class="mt" data-stub-card="${esc(d.key)}"><span class="th"></span><div class="tx"><b>${esc(d.name)}</b><small>${esc(state)}</small></div><button class="pw" aria-label="הפעלה"></button>
        <div class="ctl"><span></span><button class="rm" data-open-remote>שלט</button></div></div>`;
      this.shadowRoot.querySelector('[data-open-remote]').addEventListener('click', () => this.dispatchEvent(new CustomEvent('open-remote', { detail: { key: d.key }, bubbles: true, composed: true })));
    }
  }
  customElements.define('media-screen-card', Stub);
})();
