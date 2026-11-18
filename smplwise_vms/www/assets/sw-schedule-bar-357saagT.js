import{g as h,ay as i,i as v,A as u,cy as l,b as r,k as x}from"./index-CkOaAZ0k.js";import{s as b,d as y,a as $}from"./schedules-logic-B1p4fKiz.js";var k=Object.defineProperty,z=Object.getOwnPropertyDescriptor,a=(s,e,t,w)=>{for(var o=w>1?void 0:w?z(e,t):e,f=s.length-1,m;f>=0;f--)(m=s[f])&&(o=(w?m(e,t,o):m(o))||o);return w&&o&&k(e,t,o),o};const g={light:"var(--sw-obj-light)",switch:"var(--sw-live)",climate:"var(--sw-accent)",cover:"var(--sw-circuit-6)",fan:"var(--sw-purple)",alarm:"var(--sw-danger)",lock:"var(--sw-danger)",door:"var(--sw-danger)",script:"var(--sw-circuit-2)",scene:"var(--sw-circuit-4)",helper:"var(--sw-live)",humidifier:"var(--sw-accent)",vacuum:"var(--sw-circuit-5)",siren:"var(--sw-danger)",media:"var(--sw-circuit-3)",number:"var(--sw-circuit-1)",select:"var(--sw-circuit-1)",off:"var(--sw-offline)",other:"var(--sw-unknown)"};function M(s){return g[s]}let n=class extends v{constructor(){super(...arguments),this.slots=[],this.sun=null,this.now=!0,this.nowMinutes=null,this.compact=!1}minutesNow(){if(this.nowMinutes!==null)return this.nowMinutes;const s=new Date;return s.getHours()*60+s.getMinutes()}render(){const s=b(this.slots,this.sun),e=this.minutesNow();return r`
      <div class="track" role="img" aria-label=${s.map(t=>t.title).join("; ")||l("ללא משבצות")}>
        ${s.map(t=>r`<i class=${t.point?"seg point":"seg"} style=${`left:${t.from}%;width:${Math.max(t.to-t.from,0)}%;--c:${g[t.tone]}`} title=${t.title} data-slot=${t.index}></i>`)}
        ${this.now?r`<i class="now" style=${`left:${e/1440*100}%`} data-now></i>`:u}
      </div>
      <div class="axis" aria-hidden="true">${[0,6,12,18,24].map(t=>r`<span style=${`left:${t/24*100}%`}>${String(t).padStart(2,"0")}</span>`)}</div>
    `}};n.styles=h`
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
  `;a([i({attribute:!1})],n.prototype,"slots",2);a([i({attribute:!1})],n.prototype,"sun",2);a([i({type:Boolean})],n.prototype,"now",2);a([i({type:Number})],n.prototype,"nowMinutes",2);a([i({type:Boolean,reflect:!0})],n.prototype,"compact",2);n=a([x("sw-schedule-bar")],n);let c=class extends v{constructor(){super(...arguments),this.days={tokens:["daily"],kind:"daily",days:[]},this.compact=!1}render(){const s=y(this.days);return s?r`<span class="w" data-days-word>${s}</span>`:r`${$(this.days).map(e=>r`<span class=${e.on?"d on":"d"} data-day=${e.id} aria-label=${e.on?l("{day} פעיל",{day:e.short}):l("{day} לא פעיל",{day:e.short})}>${e.short}</span>`)}`}};c.styles=h`
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
  `;a([i({attribute:!1})],c.prototype,"days",2);a([i({type:Boolean,reflect:!0})],c.prototype,"compact",2);c=a([x("sw-day-chips")],c);let p=class extends v{constructor(){super(...arguments),this.conditions=null,this.compact=!1}render(){const s=this.conditions;if(!s||!s.items.length)return u;const e=s.summary??l("בתנאי");return r`<span class=${s.preset?"chip preset":"chip"} data-condition-chip=${s.preset??"custom"} title=${e}><sw-icon name=${s.preset?"calendar":"sensor"} size=${12}></sw-icon><span class="txt">${e}</span></span>`}};p.styles=h`
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
  `;a([i({attribute:!1})],p.prototype,"conditions",2);a([i({type:Boolean,reflect:!0})],p.prototype,"compact",2);p=a([x("schedule-condition-chip")],p);let d=class extends v{constructor(){super(...arguments),this.sensitive=!1,this.lowering=!1}render(){return r`${this.sensitive?r`<span class="m sens" data-marker="sensitive"><sw-icon name="shield" size=${12}></sw-icon>${l("רגיש")}</span>`:u}${this.lowering?r`<span class="m" data-marker="lowering"><sw-icon name="unlock" size=${12}></sw-icon>${l("פותח / מנטרל")}</span>`:u}`}};d.styles=h`
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
  `;a([i({type:Boolean})],d.prototype,"sensitive",2);a([i({type:Boolean})],d.prototype,"lowering",2);d=a([x("sw-schedule-markers")],d);export{M as t};
