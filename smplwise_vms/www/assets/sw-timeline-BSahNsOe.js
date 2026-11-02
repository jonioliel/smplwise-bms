import{E as Y,F as u,G as z,a as B,rI as S,A as w,rO as _,e as g,w as m,rQ as b,H as D}from"./index-DmgaojPZ.js";var P=Object.defineProperty,H=Object.getOwnPropertyDescriptor,a=(t,e,i,r)=>{for(var l=r>1?void 0:r?H(e,i):e,h=t.length-1,c;h>=0;h--)(c=t[h])&&(l=(r?c(e,i,l):c(l))||l);return r&&l&&P(e,i,l),l};const A={preserved:"#16a34a",preserving:"#d97706",nvr:"#7c3aed"},f=[{label:"יום",minutes:1440},{label:"6 שע׳",minutes:360},{label:"שעה",minutes:60},{label:"10 דק׳",minutes:10},{label:"דקה",minutes:1}];function M(t){return String(t).padStart(2,"0")}function x(t){const e=(t%1440+1440)%1440;return`${M(Math.floor(e/60))}:${M(Math.floor(e%60))}`}function N(t){const e=(t%1440+1440)%1440,i=Math.min(59,Math.round(e%1*60));return`${x(e)}:${M(i)}`}const R={motion:b("motion"),person:b("person"),vehicle:b("vehicle"),line:b("line"),offline:b("offline"),door:b("door")};let n=class extends B{constructor(){super(...arguments),this.segments=[],this.events=[],this.bookmarks=[],this.cursor=615,this.windowMinutes=360,this.precision="estimated",this.follow=!0,this.limit=1440,this.hover=null,this.lastHoverBucket=-1,this.viewStart=-1,this.compact=!1,this.dragging=!1}connectedCallback(){super.connectedCallback(),this.stopDisplay=S(()=>this.requestUpdate())}disconnectedCallback(){this.stopDisplay?.(),super.disconnectedCallback()}get start(){const t=Math.max(0,1440-this.windowMinutes);return this.viewStart>=0&&!this.follow?Math.max(0,Math.min(t,this.viewStart)):Math.max(0,Math.min(t,this.cursor-this.windowMinutes/2))}get step(){return this.windowMinutes>=360?1:this.windowMinutes>=60?1/6:1/60}snap(t){const e=this.step;return Math.max(0,Math.min(this.limit,Math.round(t/e)*e))}x(t,e){return(t-this.start)/this.windowMinutes*e}minuteAt(t){const e=t.currentTarget.getBoundingClientRect();return this.start+(t.clientX-e.left)/e.width*this.windowMinutes}onMove(t){const e=this.minuteAt(t);if(this.hover=e,!this.dragging){const i=Math.floor(e*6);if(i!==this.lastHoverBucket){this.lastHoverBucket=i;const r=t.currentTarget.getBoundingClientRect();this.dispatchEvent(new CustomEvent("hover",{detail:{minute:e,x:t.clientX-r.left,width:r.width},bubbles:!0,composed:!0}))}}if(this.dragging){const i=this.snap(e);this.cursor=i,this.dispatchEvent(new CustomEvent("scrub",{detail:{minute:i},bubbles:!0,composed:!0}))}}onDown(t){t.button===0&&(t.currentTarget.setPointerCapture(t.pointerId),this.dragging=!0,this.viewStart=this.start,this.follow=!1)}onUp(t){if(!this.dragging)return;this.dragging=!1;const e=this.snap(this.minuteAt(t));this.cursor=e,this.follow=!0,this.dispatchEvent(new CustomEvent("seek",{detail:{minute:e,alt:t.altKey},bubbles:!0,composed:!0}))}onWheel(t){t.preventDefault();const e=f.findIndex(r=>r.minutes===this.windowMinutes),i=Math.max(0,Math.min(f.length-1,e+(t.deltaY>0?-1:1)));i!==e&&this.setWindow(f[i].minutes,this.minuteAt(t))}setWindow(t,e=this.cursor){const i=Math.max(0,Math.min(1,(e-this.start)/this.windowMinutes));this.windowMinutes=t,this.viewStart=e-i*t,this.follow=!1,this.dispatchEvent(new CustomEvent("window-change",{detail:{minutes:t},bubbles:!0,composed:!0}))}buckets(t){const e=[],i=this.windowMinutes/t;for(let r=0;r<t;r++){const l=this.start+r*i,h=l+i;let c=0;for(const d of this.segments)d.endMin>l&&d.startMin<h&&(c=Math.max(c,d.kind==="motion"?2:1));c&&this.events.some(d=>d.minute>=l-i&&d.minute<=h+i)&&(c=3),e.push(c)}return e}tickEvery(){const t=this.windowMinutes;return t<=1?10/60:t<=10?1:t<=60?10:t<=360?60:180}label(t){return this.windowMinutes<=10?N(t):x(t)}render(){const h=this.tickEvery(),c=[];for(let s=Math.ceil(this.start/h-1e-9)*h;s<=this.start+this.windowMinutes+1e-9;s+=h)c.push(s);const d=[0,12,26,36],O={verified:"זמן מאומת",keyframe_limited:"דיוק לפי פריים מפתח",estimated:"זמן משוער",unknown:"דיוק לא ידוע"}[this.precision],$=this.x(this.cursor,1e3),W=this.label(this.cursor),E=W.length>5?62:48,y=this.limit<this.start+this.windowMinutes?Math.max(0,this.x(this.limit,1e3)):null;return g`
      <div class="bar">
        ${_("helper_line")?g`<span class="precision" data-timeline-helper>${O} · לחיצה או גרירה = חיפוש · גלגלת = זום</span>`:g`<span></span>`}
        <div class="windows">
          ${f.map(s=>g`<button class=${s.minutes===this.windowMinutes?"on":""} @click=${()=>this.setWindow(s.minutes)}>${s.label}</button>`)}
        </div>
      </div>
      <svg
        class=${this.dragging?"dragging":""}
        viewBox="0 0 ${1e3} ${84}"
        preserveAspectRatio="none"
        @pointermove=${this.onMove}
        @pointerleave=${()=>{this.hover=null,this.lastHoverBucket=-1,this.dispatchEvent(new CustomEvent("hover-end",{bubbles:!0,composed:!0}))}}
        @pointerdown=${this.onDown}
        @pointerup=${this.onUp}
        @pointercancel=${()=>this.dragging=!1}
        @wheel=${this.onWheel}
        role="img"
        aria-label="ציר זמן הקלטות">
        <line x1="0" x2=${1e3} y1=${58+.5} y2=${58+.5} stroke="var(--sw-border)" />
        ${y!==null?m`<rect x=${y} y="14" width=${Math.max(0,1e3-y)} height=${44} fill="var(--sw-surface-3)" opacity="0.7" />`:w}
        ${this.buckets(160).map((s,o)=>{if(!s)return w;const v=d[s];return m`<rect x=${o*6.25+1} y=${58-v} width=${Math.max(2,6.25-2)} height=${v} rx="1.5" fill="var(--sw-tl-recording)" opacity=${s===1?.45:s===2?.8:1} />`})}
        ${c.map(s=>m`<line x1=${this.x(s,1e3)} x2=${this.x(s,1e3)} y1=${58} y2=${63} stroke="var(--sw-border-strong)" /><text x=${this.x(s,1e3)} y=${78} font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${this.label(s)}</text>`)}
        ${this.events.map(s=>{const o=this.x(s.minute,1e3);return o<0||o>1e3?w:m`<g><circle cx=${o} cy=${58-d[3]-8} r="3.5" fill=${R[s.kind]} /><title>${s.label} · ${x(s.minute)}</title></g>`})}
        ${this.bookmarks.map(s=>{const o=this.x(s.minute,1e3),v=this.x(s.endMinute,1e3);if(v<0||o>1e3)return w;const k=A[s.preservation],C=p=>{p.stopPropagation(),this.cursor=s.minute,this.follow=!0,this.dispatchEvent(new CustomEvent("seek",{detail:{minute:s.minute,alt:!1},bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("bookmark-click",{detail:{id:s.id,minute:s.minute},bubbles:!0,composed:!0}))};return m`<g class="bm" data-bookmark=${s.id} role="button" tabindex="0" aria-label=${s.label} @pointerdown=${p=>p.stopPropagation()} @click=${C} @keydown=${p=>(p.key==="Enter"||p.key===" ")&&C(p)}>
            <rect x=${Math.max(0,o)} y="13" width=${Math.max(2,Math.min(1e3,v)-Math.max(0,o))} height="3" rx="1.5" fill=${k} opacity="0.55" />
            <line x1=${o} x2=${o} y1="3" y2=${58} stroke=${k} stroke-dasharray="2 3" opacity="0.6" />
            <polygon points=${`${o},2 ${o+9},6 ${o},10`} fill=${k} />
            <title>${s.label} · ${x(s.minute)}</title>
          </g>`})}
        ${this.hover!==null&&!this.dragging?m`<line pointer-events="none" x1=${this.x(this.hover,1e3)} x2=${this.x(this.hover,1e3)} y1="18" y2=${58} stroke="var(--sw-text-3)" stroke-dasharray="3 3" /><text pointer-events="none" x=${this.x(this.hover,1e3)} y="12" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font-mono)">${this.label(this.hover)}</text>`:w}
        ${$>=-60&&$<=1060?m`<g transform="translate(${$} 0)" pointer-events="none">
              <line x1="0" x2="0" y1="15" y2=${62} stroke="var(--sw-accent)" stroke-width="2" />
              <rect x=${-E/2} y="0" width=${E} height="16" rx="5" fill="var(--sw-accent)" />
              <text x="0" y="11.5" font-size="10.5" text-anchor="middle" fill="#fff" font-family="var(--sw-font-mono)" font-weight="600">${W}</text>
            </g>`:w}
      </svg>
      <div class="legend">
        <span style="--lg: var(--sw-tl-recording)">הקלטה (גובה = פעילות)</span>
        <span style="--lg: var(--sw-tl-motion)">תנועה</span>
        <span style="--lg: var(--sw-tl-person)">אדם</span>
        <span style="--lg: var(--sw-tl-vehicle)">רכב</span>
        <span style="--lg: var(--sw-tl-door)">דלת</span>
        <span style="--lg: var(--sw-border-strong)">ריק = אין הקלטה / לא נבדק</span>
        ${this.limit<1440?g`<span style="--lg: var(--sw-surface-3)">אפור = עתיד</span>`:w}
      </div>
    `}};n.styles=Y`
    :host {
      display: block;
      direction: ltr;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-2);
      user-select: none;
      box-shadow: var(--sw-shadow-1);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      direction: rtl;
      margin-block-end: 6px;
      flex-wrap: wrap;
    }
    .windows {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-xs);
      padding: 2px;
    }
    .windows button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 4px 10px;
      border-radius: var(--sw-r-2xs);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .windows button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    :host([compact]) {
      border: 0;
      box-shadow: none;
      padding: 0;
      background: transparent;
    }
    :host([compact]) .bar,
    :host([compact]) .legend {
      display: none;
    }
    :host([compact]) svg {
      block-size: var(--sw-tl-h, 64px);
    }
    .precision {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    g.bm {
      cursor: pointer;
    }
    g.bm:focus-visible polygon {
      stroke: var(--sw-text);
      stroke-width: 1.5;
    }
    svg {
      inline-size: 100%;
      block-size: 84px;
      display: block;
      cursor: crosshair;
      touch-action: none;
    }
    svg.dragging {
      cursor: grabbing;
    }
    .legend {
      display: flex;
      gap: var(--sw-s-4);
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 4px;
      flex-wrap: wrap;
    }
    .legend span::before {
      content: '';
      display: inline-block;
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      margin-inline-end: 6px;
      vertical-align: middle;
      background: var(--lg);
    }
  `;a([u({attribute:!1})],n.prototype,"segments",2);a([u({attribute:!1})],n.prototype,"events",2);a([u({attribute:!1})],n.prototype,"bookmarks",2);a([u({type:Number})],n.prototype,"cursor",2);a([u({type:Number})],n.prototype,"windowMinutes",2);a([u()],n.prototype,"precision",2);a([u({type:Boolean})],n.prototype,"follow",2);a([u({type:Number})],n.prototype,"limit",2);a([z()],n.prototype,"hover",2);a([u({type:Number})],n.prototype,"viewStart",2);a([u({type:Boolean,reflect:!0})],n.prototype,"compact",2);a([z()],n.prototype,"dragging",2);n=a([D("sw-timeline")],n);export{x as m,N as s};
//# sourceMappingURL=sw-timeline-BSahNsOe.js.map
