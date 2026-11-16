import{i as g,n as h,r as f,a as m,p as w,q as a,x}from"./index-C5kZ9jiu.js";var $=Object.defineProperty,y=Object.getOwnPropertyDescriptor,d=(t,e,i,n)=>{for(var s=n>1?void 0:n?y(e,i):e,r=t.length-1,l;r>=0;r--)(l=t[r])&&(s=(n?l(e,i,s):l(s))||s);return n&&s&&$(e,i,s),s};const v=[6,0,1,2,3,4,5],u=["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],c=t=>String(t).padStart(2,"0"),b=t=>Number(t.slice(0,2))+Number(t.slice(3,5))/60;function k(t){return Array.from({length:7},(e,i)=>{const n=Array.from({length:24},()=>"");for(const s of t[i]??[]){const r=Math.floor(b(s.begin)),l=Math.min(24,Math.ceil(b(s.end)));for(let p=r;p<l;p++)n[p]=s.mode??"on"}return n})}function D(t,e){return t.map(i=>{const n=[];let s=0;for(;s<24;){const r=i[s];if(!r){s++;continue}let l=s;for(;l<24&&i[l]===r;)l++;n.push(e?{begin:`${c(s)}:00:00`,end:`${c(l)}:00:00`,mode:r}:{begin:`${c(s)}:00:00`,end:`${c(l)}:00:00`}),s=l}return n})}let o=class extends m{constructor(){super(...arguments),this.days=Array.from({length:7},()=>[]),this.modes=[{id:"on",label:"פעיל",color:"var(--sw-accent)"}],this.mode="on",this.editable=!1,this.painting=null,this.cells=[],this.lastDays=null,this.end=()=>{this.painting=null},this.onDown=t=>{if(!this.editable||t.button!==0)return;const e=this.cellAt(t);e&&(t.preventDefault(),t.currentTarget.setPointerCapture(t.pointerId),this.paint(e[0],e[1],!0))},this.onMove=t=>{if(this.painting===null||!t.buttons)return;const e=this.cellAt(t);e&&this.paint(e[0],e[1],!1)}}sync(){this.lastDays!==this.days&&(this.cells=k(this.days),this.lastDays=this.days)}colorOf(t){return this.modes.find(e=>e.id===t)?.color??"var(--sw-accent)"}paint(t,e,i){if(!this.editable||(i&&(this.painting=this.cells[t][e]===this.mode?"":this.mode),this.painting===null)||this.cells[t][e]===this.painting)return;this.cells=this.cells.map((s,r)=>r===t?s.map((l,p)=>p===e?this.painting:l):s);const n=D(this.cells,this.modes.length>1||this.modes[0]?.id!=="on");this.lastDays=n,this.days=n,this.dispatchEvent(new CustomEvent("change",{detail:{days:n},bubbles:!0,composed:!0}))}cellAt(t){const e=this.renderRoot,n=(e.elementFromPoint?e.elementFromPoint(t.clientX,t.clientY):null)?.dataset?.cell;if(!n)return null;const[s,r]=n.split("-").map(Number);return Number.isFinite(s)&&Number.isFinite(r)?[s,r]:null}connectedCallback(){super.connectedCallback(),window.addEventListener("pointerup",this.end)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerup",this.end)}renderLegend(){const t=this.editable&&this.modes.length>1;return a`<div class="legend" data-week-legend>
      <span class="lbl">מקרא:</span>
      ${this.modes.map(e=>t?a`<button class=${e.id===this.mode?"on":""} data-week-mode=${e.id} @click=${()=>this.mode=e.id}><span class="sw" style="background:${e.color}"></span>${e.label}</button>`:a`<span class="chip"><span class="sw" style="background:${e.color}"></span>${e.label}</span>`)}
      <span class="chip muted"><span class="sw empty"></span>${this.modes.length>1?"ללא":"לא פעיל"}</span>
      ${t?a`<span class="hint">לחיצה על תא צבוע באותו צבע מנקה אותו</span>`:w}
    </div>`}render(){return this.sync(),a`
      <div class="grid" role="grid" aria-label="לוח שבועי" @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.end} @pointercancel=${this.end}>
        <span></span>
        ${Array.from({length:24},(t,e)=>a`<span class="h">${e%3===0?e:""}</span>`)}
        ${v.map((t,e)=>a`
          <span class="d">${u[e]}</span>
          ${this.cells[t].map((i,n)=>a`<div class="c ${i?"on":""}" data-cell=${`${t}-${n}`} data-mode=${i} style=${i?`--cell:${this.colorOf(i)}`:""} title=${`${u[e]} ${c(n)}:00–${c(n+1)}:00${i?` · ${this.modes.find(s=>s.id===i)?.label??i}`:""}`}></div>`)}
        `)}
      </div>
      ${this.renderLegend()}
    `}};o.styles=g`
    :host {
      display: block;
      direction: ltr;
      font-size: var(--sw-fs-xs);
      user-select: none;
    }
    .grid {
      display: grid;
      grid-template-columns: 28px repeat(24, minmax(0, 1fr));
      gap: 2px;
    }
    .h {
      color: var(--sw-text-3);
      text-align: center;
      font-size: var(--sw-fs-2xs);
    }
    .d {
      color: var(--sw-text-2);
      align-self: center;
      text-align: center;
      font-weight: var(--sw-fw-semibold);
    }
    .c {
      block-size: 18px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      border: 1px solid transparent;
    }
    .c.on {
      background: var(--cell, var(--sw-accent));
    }
    :host([editable]) .c {
      cursor: crosshair;
    }
    .legend {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 6px;
      direction: rtl;
      align-items: center;
    }
    .legend button {
      font: inherit;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      border-radius: 999px;
      padding: 2px 10px;
      cursor: pointer;
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .legend button.on {
      outline: 2px solid var(--sw-accent);
    }
    .legend .lbl {
      color: var(--sw-text-3);
    }
    .legend .chip {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .legend .chip.muted {
      color: var(--sw-text-3);
    }
    .legend .hint {
      color: var(--sw-text-3);
    }
    .sw {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 3px;
      display: inline-block;
    }
    .sw.empty {
      background: var(--sw-surface-3);
      border: 1px solid var(--sw-border-strong);
    }
  `;d([h({attribute:!1})],o.prototype,"days",2);d([h({attribute:!1})],o.prototype,"modes",2);d([h()],o.prototype,"mode",2);d([h({type:Boolean})],o.prototype,"editable",2);d([f()],o.prototype,"painting",2);o=d([x("sw-week-grid")],o);
//# sourceMappingURL=sw-week-grid-B8C3ddj4.js.map
