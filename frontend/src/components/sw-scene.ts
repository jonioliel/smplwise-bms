import { LitElement, html, css, svg, nothing, type SVGTemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Illustrated placeholder scenes for camera tiles, thumbnails and site cards. They give the boards'
 * "picture" feel before a real stream or snapshot exists (T017/T044) while staying obviously drawn:
 * every consumer overlays a "דמו" tag. Nothing here is derived from a customer camera.
 */
export type SceneKind = 'entrance' | 'lobby' | 'corridor' | 'hall' | 'parking' | 'warehouse' | 'backyard' | 'driveway' | 'night' | 'building' | 'house' | 'none';

let seq = 0;

@customElement('sw-scene')
export class SwScene extends LitElement {
  @property({ reflect: true }) kind: SceneKind = 'lobby';
  private uid = `sc${(seq += 1)}`;

  static styles = css`
    :host {
      display: block;
      inline-size: 100%;
      block-size: 100%;
      overflow: hidden;
      background: #0f1729;
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
  `;

  private grad(id: string, stops: [number, string][], vertical = true) {
    const u = `${id}-${this.uid}`;
    return svg`<linearGradient id=${u} x1="0" y1="0" x2=${vertical ? 0 : 1} y2=${vertical ? 1 : 0}>${stops.map(([o, c]) => svg`<stop offset=${o} stop-color=${c} />`)}</linearGradient>`;
  }

  private url(id: string) {
    return `url(#${id}-${this.uid})`;
  }

  private vignette() {
    const u = `vig-${this.uid}`;
    return svg`<defs><radialGradient id=${u} cx="50%" cy="45%" r="72%"><stop offset="0.55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity="0.38" /></radialGradient></defs><rect width="320" height="180" fill=${`url(#${u})`} />`;
  }

  private entrance(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('wall', [[0, '#f3f1ec'], [1, '#d8d4cc']])}${this.grad('floor', [[0, '#d2cdc2'], [1, '#a19a8c']])}${this.grad('glass', [[0, '#e3edf6'], [0.55, '#bfd2e6'], [1, '#8fa9c4']], false)}</defs>
      <rect width="320" height="180" fill=${this.url('wall')} />
      <polygon points="0,0 320,0 250,30 70,30" fill="#e9e6df" />
      <rect x="0" y="118" width="320" height="62" fill=${this.url('floor')} />
      ${[0, 1, 2, 3, 4, 5].map((i) => svg`<line x1=${-40 + i * 80} y1="180" x2=${100 + i * 24} y2="118" stroke="#fff" stroke-opacity="0.18" />`)}
      <rect x="0" y="30" width="70" height="88" fill="#8b6e4e" />
      ${[0, 1, 2, 3, 4, 5].map((i) => svg`<rect x=${4 + i * 11} y="30" width="4" height="88" fill="#6f563d" />`)}
      <rect x="250" y="30" width="70" height="88" fill="#ece9e3" />
      <rect x="118" y="32" width="114" height="86" fill="#2b2f36" />
      <rect x="124" y="38" width="48" height="74" fill=${this.url('glass')} />
      <rect x="178" y="38" width="48" height="74" fill=${this.url('glass')} />
      <polygon points="124,38 160,38 140,112 124,112" fill="#fff" fill-opacity="0.22" />
      <rect x="168" y="68" width="3" height="18" rx="1" fill="#d5dae2" />
      <rect x="179" y="68" width="3" height="18" rx="1" fill="#d5dae2" />
      <rect x="118" y="118" width="114" height="34" fill="#fff" fill-opacity="0.14" />
      <ellipse cx="276" cy="94" rx="19" ry="14" fill="#3f7d4b" /><ellipse cx="266" cy="85" rx="12" ry="10" fill="#4f9159" /><ellipse cx="288" cy="88" rx="11" ry="9" fill="#356d43" />
      <rect x="266" y="106" width="20" height="14" rx="2" fill="#6b6257" />
      <ellipse cx="100" cy="13" rx="11" ry="3" fill="#fff" fill-opacity="0.85" /><ellipse cx="220" cy="13" rx="11" ry="3" fill="#fff" fill-opacity="0.85" />
    `;
  }

  private lobby(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('wall', [[0, '#f5f0e7'], [1, '#e2d9ca']])}${this.grad('floor', [[0, '#dccdb2'], [1, '#b19973']])}</defs>
      <rect width="320" height="180" fill=${this.url('wall')} />
      <rect x="196" y="26" width="96" height="66" rx="2" fill="#d9e7f4" />
      <path d="M244 26v66M196 59h96" stroke="#fff" stroke-width="3" />
      <rect x="196" y="26" width="96" height="66" fill="none" stroke="#c8bfae" stroke-width="3" />
      <rect x="0" y="118" width="320" height="62" fill=${this.url('floor')} />
      ${[0, 1, 2, 3].map((i) => svg`<line x1="0" y1=${132 + i * 14} x2="320" y2=${132 + i * 14} stroke="#fff" stroke-opacity="0.14" />`)}
      <rect x="26" y="86" width="132" height="8" rx="2" fill="#7c6248" />
      <rect x="30" y="94" width="124" height="36" rx="3" fill="#5a4636" />
      <rect x="188" y="102" width="96" height="28" rx="7" fill="#4a5568" />
      <rect x="194" y="92" width="40" height="16" rx="5" fill="#5b6a82" /><rect x="238" y="92" width="40" height="16" rx="5" fill="#5b6a82" />
      <ellipse cx="172" cy="86" rx="14" ry="11" fill="#3f7d4b" /><ellipse cx="164" cy="78" rx="9" ry="8" fill="#4f9159" />
      <rect x="166" y="96" width="12" height="16" rx="2" fill="#7a6c5d" />
      ${[60, 120, 180, 240].map((x) => svg`<ellipse cx=${x} cy="9" rx="7" ry="2.5" fill="#fff" fill-opacity="0.9" />`)}
    `;
  }

  private corridor(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('floor', [[0, '#cfc9bd'], [1, '#9c9587']])}${this.grad('ceil', [[0, '#f3f1ec'], [1, '#e2ded6']])}</defs>
      <rect width="320" height="180" fill="#d6d0c5" />
      <polygon points="0,0 320,0 200,42 120,42" fill=${this.url('ceil')} />
      <polygon points="0,0 120,42 120,138 0,180" fill="#e6e1d8" />
      <polygon points="320,0 200,42 200,138 320,180" fill="#d2ccc0" />
      <rect x="120" y="42" width="80" height="96" fill="#cbc4b8" />
      <rect x="150" y="70" width="22" height="68" fill="#8b7a67" />
      <rect x="153" y="73" width="16" height="30" fill="#c5d5e3" />
      <polygon points="0,180 320,180 200,138 120,138" fill=${this.url('floor')} />
      ${[0, 1, 2].map((i) => svg`<line x1=${40 + i * 80} y1="180" x2=${140 + i * 20} y2="138" stroke="#fff" stroke-opacity="0.16" />`)}
      ${[0, 1, 2, 3].map((i) => svg`<rect x=${152 - i * 12} y=${24 - i * 6} width=${16 + i * 24} height="4" rx="2" fill="#fff" fill-opacity=${0.9 - i * 0.15} />`)}
      ${[0, 1, 2].map((i) => svg`<rect x=${22 + i * 30} y=${58 + i * 10} width="10" height=${60 - i * 10} fill="#c9d5e3" fill-opacity="0.9" />`)}
    `;
  }

  private hall(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('wall', [[0, '#f2eee6'], [1, '#ddd6c9']])}${this.grad('floor', [[0, '#c9c0b0'], [1, '#9a9081']])}</defs>
      <rect width="320" height="180" fill=${this.url('wall')} />
      <rect x="0" y="112" width="320" height="68" fill=${this.url('floor')} />
      ${[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => svg`<rect x=${28 + c * 40 + r * 4} y=${96 + r * 14} width="22" height="9" rx="2" fill="#3b4557" />`))}
      <rect x="40" y="40" width="240" height="50" rx="2" fill="#dfe8f2" />
      <rect x="40" y="40" width="240" height="50" fill="none" stroke="#c9c1b3" stroke-width="3" />
      ${[80, 140, 200, 240].map((x) => svg`<line x1=${x} y1="40" x2=${x} y2="90" stroke="#fff" stroke-width="2" />`)}
      ${[60, 130, 200, 260].map((x) => svg`<ellipse cx=${x} cy="12" rx="9" ry="3" fill="#fff" fill-opacity="0.9" />`)}
    `;
  }

  private parking(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('wall', [[0, '#d3d7de'], [1, '#a1a7b1']])}${this.grad('floor', [[0, '#8f959f'], [1, '#666c76']])}</defs>
      <rect width="320" height="180" fill=${this.url('wall')} />
      <rect x="0" y="0" width="320" height="26" fill="#b9bec7" />
      ${[0, 1, 2].map((i) => svg`<rect x="0" y=${8 + i * 6} width="320" height="2" fill="#98a0ab" />`)}
      <rect x="0" y="116" width="320" height="64" fill=${this.url('floor')} />
      ${[0, 1, 2, 3, 4, 5].map((i) => svg`<line x1=${-20 + i * 72} y1="180" x2=${90 + i * 28} y2="116" stroke="#e5e8ee" stroke-opacity="0.6" stroke-width="2" />`)}
      <rect x="34" y="26" width="20" height="100" fill="#7d8591" /><rect x="266" y="26" width="20" height="100" fill="#7d8591" />
      <rect x="110" y="102" width="72" height="24" rx="6" fill="#e8ebf0" /><polygon points="124,102 138,86 168,86 178,102" fill="#c6cfda" /><circle cx="126" cy="127" r="7" fill="#2c2f36" /><circle cx="170" cy="127" r="7" fill="#2c2f36" />
      <rect x="196" y="104" width="62" height="22" rx="6" fill="#3f4a5c" /><polygon points="208,104 220,90 244,90 252,104" fill="#5c6a80" /><circle cx="210" cy="127" r="6" fill="#1f232b" /><circle cx="246" cy="127" r="6" fill="#1f232b" />
      <rect x="130" y="30" width="60" height="5" rx="2" fill="#fff" fill-opacity="0.85" />
    `;
  }

  private warehouse(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('wall', [[0, '#e6e9ef'], [1, '#c6cbd3']])}${this.grad('floor', [[0, '#b7bcc4'], [1, '#7f8592']])}</defs>
      <rect width="320" height="180" fill=${this.url('wall')} />
      <rect x="0" y="104" width="320" height="76" fill=${this.url('floor')} />
      <line x1="118" y1="180" x2="150" y2="104" stroke="#e2b43a" stroke-width="3" /><line x1="202" y1="180" x2="170" y2="104" stroke="#e2b43a" stroke-width="3" />
      ${[[10, 96], [230, 316]].map(([a, b]) => svg`
        <rect x=${a} y="18" width="6" height="150" fill="#c9772f" /><rect x=${b - 6} y="40" width="6" height="128" fill="#c9772f" />
        ${[0, 1, 2].map((i) => svg`<polygon points="${a},${52 + i * 36} ${b},${64 + i * 30} ${b},${68 + i * 30} ${a},${56 + i * 36}" fill="#b96a22" />`)}
        ${[0, 1, 2].map((i) => [0, 1, 2].map((j) => svg`<rect x=${a + 10 + j * 26} y=${32 + i * 36 + j * 3} width="20" height="16" rx="1" fill=${j % 2 ? '#a8825d' : '#c7a17a'} />`))}
      `)}
      <rect x="130" y="8" width="60" height="6" rx="3" fill="#fff" fill-opacity="0.9" /><rect x="120" y="40" width="80" height="5" rx="2" fill="#fff" fill-opacity="0.6" />
    `;
  }

  private backyard(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('sky', [[0, '#c4d9ee'], [1, '#e9f1f8']])}${this.grad('lawn', [[0, '#86bb6f'], [1, '#4d8240']])}</defs>
      <rect width="320" height="180" fill=${this.url('sky')} />
      <rect x="0" y="62" width="320" height="50" fill="#b8905f" />
      ${Array.from({ length: 27 }, (_, i) => svg`<rect x=${i * 12} y="62" width="2" height="50" fill="#9c7749" />`)}
      <rect x="0" y="66" width="320" height="4" fill="#a37e51" /><rect x="0" y="100" width="320" height="4" fill="#a37e51" />
      <circle cx="42" cy="52" r="27" fill="#3f7f45" /><circle cx="72" cy="46" r="20" fill="#4f9552" /><circle cx="282" cy="48" r="32" fill="#36763f" /><circle cx="250" cy="58" r="18" fill="#4a8a4c" />
      <rect x="0" y="112" width="320" height="68" fill=${this.url('lawn')} />
      ${[0, 1, 2].map((i) => svg`<rect x="0" y=${118 + i * 20} width="320" height="10" fill="#fff" fill-opacity="0.07" />`)}
      <polygon points="150,180 320,180 300,128 172,128" fill="#c9c3b5" />
      <ellipse cx="238" cy="146" rx="28" ry="9" fill="#4a4f57" /><rect x="236" y="146" width="4" height="18" fill="#3a3f47" />
      <rect x="196" y="140" width="16" height="11" rx="3" fill="#565b64" /><rect x="262" y="140" width="16" height="11" rx="3" fill="#565b64" />
    `;
  }

  private driveway(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('sky', [[0, '#bfd6ee'], [1, '#eaf1f8']])}${this.grad('drive', [[0, '#b6bac2'], [1, '#868b95']])}${this.grad('lawn', [[0, '#8fbf72'], [1, '#5c8f47']])}</defs>
      <rect width="320" height="180" fill=${this.url('sky')} />
      <circle cx="20" cy="92" r="22" fill="#4f8d4f" /><circle cx="300" cy="96" r="18" fill="#437d47" />
      <polygon points="28,66 100,26 172,66" fill="#7d6e62" />
      <rect x="40" y="64" width="120" height="52" fill="#efe9df" />
      <rect x="55" y="76" width="22" height="18" fill="#9fb8d3" /><rect x="120" y="76" width="22" height="18" fill="#9fb8d3" /><rect x="92" y="84" width="18" height="32" fill="#5b4a3b" />
      <rect x="0" y="110" width="200" height="70" fill=${this.url('lawn')} />
      <rect x="0" y="98" width="200" height="14" rx="6" fill="#4b8248" />
      <polygon points="160,180 320,180 300,110 200,110" fill=${this.url('drive')} />
      <rect x="205" y="118" width="100" height="30" rx="8" fill="#f4f6f9" />
      <polygon points="226,118 246,100 286,100 300,118" fill="#dfe5ee" /><polygon points="231,117 248,103 283,103 296,117" fill="#8ea3bb" />
      <circle cx="226" cy="150" r="10" fill="#2c2f36" /><circle cx="226" cy="150" r="4" fill="#8a8f99" /><circle cx="290" cy="150" r="10" fill="#2c2f36" /><circle cx="290" cy="150" r="4" fill="#8a8f99" />
      <rect x="300" y="128" width="6" height="8" rx="2" fill="#fff3c4" />
    `;
  }

  private night(): SVGTemplateResult {
    const g = `glow-${this.uid}`;
    return svg`
      <defs>${this.grad('sky', [[0, '#0d1730'], [1, '#050912']])}<radialGradient id=${g} cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f5d78a" stop-opacity="0.55" /><stop offset="1" stop-color="#f5d78a" stop-opacity="0" /></radialGradient></defs>
      <rect width="320" height="180" fill=${this.url('sky')} />
      <rect x="0" y="120" width="320" height="60" fill="#0a1020" />
      <circle cx="251" cy="34" r="110" fill=${`url(#${g})`} />
      <rect x="250" y="30" width="3" height="92" fill="#2a3350" /><rect x="238" y="24" width="27" height="8" rx="3" fill="#3b4666" />
      <ellipse cx="251" cy="124" rx="70" ry="12" fill="#f5d78a" fill-opacity="0.16" />
      <rect x="60" y="100" width="92" height="24" rx="7" fill="#131b33" /><polygon points="78,100 94,84 124,84 138,100" fill="#1a2440" />
      <circle cx="80" cy="125" r="8" fill="#0a0f1f" /><circle cx="134" cy="125" r="8" fill="#0a0f1f" />
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => svg`<rect x=${i * 48} y="88" width="2" height="34" fill="#1b2440" />`)}
      <rect x="0" y="88" width="320" height="2" fill="#1b2440" />
    `;
  }

  private building(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('sky', [[0, '#c2d7ec'], [1, '#e9f0f7']])}${this.grad('face', [[0, '#e6eaf0'], [1, '#c8cfd9']], false)}</defs>
      <rect width="320" height="180" fill=${this.url('sky')} />
      <rect x="0" y="156" width="320" height="24" fill="#aab2be" />
      <rect x="92" y="28" width="136" height="130" fill=${this.url('face')} />
      <rect x="228" y="52" width="46" height="106" fill="#b9c1cd" />
      ${[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2, 3, 4].map((c) => svg`<rect x=${102 + c * 24} y=${38 + r * 19} width="16" height="12" rx="1" fill=${(r + c) % 3 ? '#8fa8c6' : '#c9dbee'} />`))}
      ${[0, 1, 2, 3, 4].map((r) => [0, 1].map((c) => svg`<rect x=${236 + c * 18} y=${62 + r * 19} width="12" height="10" rx="1" fill="#8ea3bd" />`))}
      <rect x="118" y="138" width="84" height="8" rx="2" fill="#4b5565" /><rect x="140" y="146" width="40" height="12" fill="#6d7f9a" />
      <circle cx="40" cy="132" r="26" fill="#4a8a4c" /><circle cx="292" cy="140" r="20" fill="#3f7d45" />
    `;
  }

  private house(): SVGTemplateResult {
    return svg`
      <defs>${this.grad('sky', [[0, '#c2d7ec'], [1, '#ebf1f7']])}${this.grad('lawn', [[0, '#8dbd70'], [1, '#5a8d46']])}</defs>
      <rect width="320" height="180" fill=${this.url('sky')} />
      <rect x="0" y="128" width="320" height="52" fill=${this.url('lawn')} />
      <polygon points="58,76 160,22 262,76" fill="#6e5f55" />
      <rect x="78" y="74" width="164" height="60" fill="#f2ede4" />
      <rect x="96" y="88" width="26" height="22" fill="#9fb8d3" /><rect x="148" y="90" width="20" height="44" fill="#5b4a3b" /><rect x="182" y="94" width="50" height="40" fill="#cfd4dc" />
      <path d="M182 104h50M182 114h50M182 124h50" stroke="#b9c0ca" stroke-width="2" />
      <polygon points="140,180 180,180 176,134 152,134" fill="#c7c1b4" />
      <circle cx="30" cy="112" r="24" fill="#4a8a4c" /><circle cx="296" cy="118" r="20" fill="#3f7d45" />
    `;
  }

  private scene(): SVGTemplateResult | typeof nothing {
    switch (this.kind) {
      case 'entrance':
        return this.entrance();
      case 'lobby':
        return this.lobby();
      case 'corridor':
        return this.corridor();
      case 'hall':
        return this.hall();
      case 'parking':
        return this.parking();
      case 'warehouse':
        return this.warehouse();
      case 'backyard':
        return this.backyard();
      case 'driveway':
        return this.driveway();
      case 'night':
        return this.night();
      case 'building':
        return this.building();
      case 'house':
        return this.house();
      default:
        return nothing;
    }
  }

  render() {
    if (this.kind === 'none') return html``;
    return html`<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${this.scene()}${this.vignette()}</svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-scene': SwScene;
  }
}
