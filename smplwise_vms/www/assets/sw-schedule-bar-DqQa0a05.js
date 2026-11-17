import{i as u,n as a,a as h,p as w,q as i,x as v}from"./index-C5kZ9jiu.js";import{C as g,D as b,E as y}from"./schedules-logic-DVgW4Q3C.js";var $=Object.defineProperty,k=Object.getOwnPropertyDescriptor,r=(s,e,t,d)=>{for(var o=d>1?void 0:d?k(e,t):e,x=s.length-1,f;x>=0;x--)(f=s[x])&&(o=(d?f(e,t,o):f(o))||o);return d&&o&&$(e,t,o),o};const m={light:"var(--sw-obj-light)",switch:"var(--sw-live)",climate:"var(--sw-accent)",cover:"var(--sw-circuit-6)",fan:"var(--sw-purple)",alarm:"var(--sw-danger)",lock:"var(--sw-danger)",door:"var(--sw-danger)",script:"var(--sw-circuit-2)",scene:"var(--sw-circuit-4)",helper:"var(--sw-live)",humidifier:"var(--sw-accent)",vacuum:"var(--sw-circuit-5)",siren:"var(--sw-danger)",media:"var(--sw-circuit-3)",number:"var(--sw-circuit-1)",select:"var(--sw-circuit-1)",off:"var(--sw-offline)",other:"var(--sw-unknown)"};function B(s){return m[s]}let n=class extends h{constructor(){super(...arguments),this.slots=[],this.sun=null,this.now=!0,this.nowMinutes=null,this.compact=!1}minutesNow(){if(this.nowMinutes!==null)return this.nowMinutes;const s=new Date;return s.getHours()*60+s.getMinutes()}render(){const s=g(this.slots,this.sun),e=this.minutesNow();return i`
      <div class="track" role="img" aria-label=${s.map(t=>t.title).join("; ")||"ללא משבצות"}>
        ${s.map(t=>i`<i class=${t.point?"seg point":"seg"} style=${`left:${t.from}%;width:${Math.max(t.to-t.from,0)}%;--c:${m[t.tone]}`} title=${t.title} data-slot=${t.index}></i>`)}
        ${this.now?i`<i class="now" style=${`left:${e/1440*100}%`} data-now></i>`:w}
      </div>
      <div class="axis" aria-hidden="true">${[0,6,12,18,24].map(t=>i`<span style=${`left:${t/24*100}%`}>${String(t).padStart(2,"0")}</span>`)}</div>
    `}};n.styles=u`
    :host {
      display: block;
      direction: ltr;
      min-inline-size: 0;
    }
    .track {
      position: relative;
      block-size: 14px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    :host([compact]) .track {
      block-size: 10px;
    }
    .seg {
      position: absolute;
      inset-block: 0;
      background: var(--c);
      border-inline-end: 1px solid var(--sw-surface);
      box-sizing: border-box;
      min-inline-size: 2px;
    }
    .seg.point {
      inset-block: 2px;
      inline-size: 4px;
      min-inline-size: 4px;
      border: 0;
      border-radius: 2px;
    }
    .now {
      position: absolute;
      inset-block: -1px;
      inline-size: 2px;
      margin-inline-start: -1px;
      background: var(--sw-danger);
      border-radius: 1px;
    }
    .axis {
      position: relative;
      block-size: 14px;
      margin-block-start: 3px;
      font-size: var(--sw-fs-2xs);
      line-height: 14px;
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    :host([compact]) .axis {
      display: none;
    }
    .axis span {
      position: absolute;
      transform: translateX(-50%);
    }
    .axis span:first-child {
      transform: none;
    }
    .axis span:last-child {
      transform: translateX(-100%);
    }
  `;r([a({attribute:!1})],n.prototype,"slots",2);r([a({attribute:!1})],n.prototype,"sun",2);r([a({type:Boolean})],n.prototype,"now",2);r([a({type:Number})],n.prototype,"nowMinutes",2);r([a({type:Boolean,reflect:!0})],n.prototype,"compact",2);n=r([v("sw-schedule-bar")],n);let l=class extends h{constructor(){super(...arguments),this.days={tokens:["daily"],kind:"daily",days:[]},this.compact=!1}render(){const s=b(this.days);return s?i`<span class="w" data-days-word>${s}</span>`:i`${y(this.days).map(e=>i`<span class=${e.on?"d on":"d"} data-day=${e.id} aria-label=${e.on?`${e.short} פעיל`:`${e.short} לא פעיל`}>${e.short}</span>`)}`}};l.styles=u`
    :host {
      display: inline-flex;
      gap: 3px;
      align-items: center;
    }
    .d {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: 50%;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
      background: transparent;
      border: 1px solid var(--sw-border);
      box-sizing: border-box;
    }
    :host([compact]) .d {
      inline-size: 19px;
      block-size: 19px;
      font-size: var(--sw-fs-2xs);
    }
    .d.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .w {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-accent-text);
      background: var(--sw-accent-soft);
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
    }
  `;r([a({attribute:!1})],l.prototype,"days",2);r([a({type:Boolean,reflect:!0})],l.prototype,"compact",2);l=r([v("sw-day-chips")],l);let c=class extends h{constructor(){super(...arguments),this.conditions=null,this.compact=!1}render(){const s=this.conditions;if(!s||!s.items.length)return w;const e=s.summary??"בתנאי";return i`<span class=${s.preset?"chip preset":"chip"} data-condition-chip=${s.preset??"custom"} title=${e}><sw-icon name=${s.preset?"calendar":"sensor"} size=${12}></sw-icon><span class="txt">${e}</span></span>`}};c.styles=u`
    :host {
      display: inline-flex;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    :host([hidden]) {
      display: none;
    }
    span.chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 16px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    span.chip.preset {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    span.txt {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host([compact]) span.chip {
      padding: 1px 7px;
    }
  `;r([a({attribute:!1})],c.prototype,"conditions",2);r([a({type:Boolean,reflect:!0})],c.prototype,"compact",2);c=r([v("schedule-condition-chip")],c);let p=class extends h{constructor(){super(...arguments),this.sensitive=!1,this.lowering=!1}render(){return i`${this.sensitive?i`<span class="m sens" data-marker="sensitive"><sw-icon name="shield" size=${12}></sw-icon>רגיש</span>`:w}${this.lowering?i`<span class="m" data-marker="lowering"><sw-icon name="unlock" size=${12}></sw-icon>פותח / מנטרל</span>`:w}`}};p.styles=u`
    :host {
      display: inline-flex;
      gap: 5px;
      flex-wrap: wrap;
    }
    span.m {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 16px;
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    span.m.sens {
      background: var(--sw-stale-soft);
      color: var(--sw-warning-text);
    }
  `;r([a({type:Boolean})],p.prototype,"sensitive",2);r([a({type:Boolean})],p.prototype,"lowering",2);p=r([v("sw-schedule-markers")],p);export{B as t};
//# sourceMappingURL=sw-schedule-bar-DqQa0a05.js.map
