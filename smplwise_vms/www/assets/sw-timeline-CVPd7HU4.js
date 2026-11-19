import{cv as n,g as S,ax as d,j as Y,i as B,eS as _,A as m,eT as D,b as f,a5 as v,eU as b,k as P}from"./index-DkcUEx2W.js";var A=Object.defineProperty,H=Object.getOwnPropertyDescriptor,l=(t,e,i,o)=>{for(var c=o>1?void 0:o?H(e,i):e,u=t.length-1,h;u>=0;u--)(h=t[u])&&(c=(o?h(e,i,c):h(c))||c);return o&&c&&A(e,i,c),c};const T={preserved:"#16a34a",preserving:"#d97706",nvr:"#7c3aed"},x=[{label:n("יום"),minutes:1440},{label:n("6 שע׳"),minutes:360},{label:n("שעה"),minutes:60},{label:n("10 דק׳"),minutes:10},{label:n("דקה"),minutes:1}];function W(t){return String(t).padStart(2,"0")}function $(t){const e=(t%1440+1440)%1440;return`${W(Math.floor(e/60))}:${W(Math.floor(e%60))}`}function N(t){const e=(t%1440+1440)%1440,i=Math.min(59,Math.round(e%1*60));return`${$(e)}:${W(i)}`}const R={motion:b("motion"),person:b("person"),vehicle:b("vehicle"),line:b("line"),offline:b("offline"),door:b("door")};let r=class extends B{constructor(){super(...arguments),this.segments=[],this.events=[],this.bookmarks=[],this.cursor=615,this.windowMinutes=360,this.precision="estimated",this.follow=!0,this.limit=1440,this.hover=null,this.lastHoverBucket=-1,this.viewStart=-1,this.compact=!1,this.dragging=!1}connectedCallback(){super.connectedCallback(),this.stopDisplay=_(()=>this.requestUpdate())}disconnectedCallback(){this.stopDisplay?.(),super.disconnectedCallback()}get start(){const t=Math.max(0,1440-this.windowMinutes);return this.viewStart>=0&&!this.follow?Math.max(0,Math.min(t,this.viewStart)):Math.max(0,Math.min(t,this.cursor-this.windowMinutes/2))}get step(){return this.windowMinutes>=360?1:this.windowMinutes>=60?1/6:1/60}snap(t){const e=this.step;return Math.max(0,Math.min(this.limit,Math.round(t/e)*e))}x(t,e){return(t-this.start)/this.windowMinutes*e}minuteAt(t){const e=t.currentTarget.getBoundingClientRect();return this.start+(t.clientX-e.left)/e.width*this.windowMinutes}onMove(t){const e=this.minuteAt(t);if(this.hover=e,!this.dragging){const i=Math.floor(e*6);if(i!==this.lastHoverBucket){this.lastHoverBucket=i;const o=t.currentTarget.getBoundingClientRect();this.dispatchEvent(new CustomEvent("hover",{detail:{minute:e,x:t.clientX-o.left,width:o.width},bubbles:!0,composed:!0}))}}if(this.dragging){const i=this.snap(e);this.cursor=i,this.dispatchEvent(new CustomEvent("scrub",{detail:{minute:i},bubbles:!0,composed:!0}))}}onDown(t){t.button===0&&(t.currentTarget.setPointerCapture(t.pointerId),this.dragging=!0,this.viewStart=this.start,this.follow=!1)}onUp(t){if(!this.dragging)return;this.dragging=!1;const e=this.snap(this.minuteAt(t));this.cursor=e,this.follow=!0,this.dispatchEvent(new CustomEvent("seek",{detail:{minute:e,alt:t.altKey},bubbles:!0,composed:!0}))}onWheel(t){t.preventDefault();const e=x.findIndex(o=>o.minutes===this.windowMinutes),i=Math.max(0,Math.min(x.length-1,e+(t.deltaY>0?-1:1)));i!==e&&this.setWindow(x[i].minutes,this.minuteAt(t))}setWindow(t,e=this.cursor){const i=Math.max(0,Math.min(1,(e-this.start)/this.windowMinutes));this.windowMinutes=t,this.viewStart=e-i*t,this.follow=!1,this.dispatchEvent(new CustomEvent("window-change",{detail:{minutes:t},bubbles:!0,composed:!0}))}buckets(t){const e=[],i=this.windowMinutes/t;for(let o=0;o<t;o++){const c=this.start+o*i,u=c+i;let h=0;for(const p of this.segments)p.endMin>c&&p.startMin<u&&(h=Math.max(h,p.kind==="motion"?2:1));h&&this.events.some(p=>p.minute>=c-i&&p.minute<=u+i)&&(h=3),e.push(h)}return e}tickEvery(){const t=this.windowMinutes;return t<=1?10/60:t<=10?1:t<=60?10:t<=360?60:180}label(t){return this.windowMinutes<=10?N(t):$(t)}render(){const u=this.tickEvery(),h=[];for(let s=Math.ceil(this.start/u-1e-9)*u;s<=this.start+this.windowMinutes+1e-9;s+=u)h.push(s);const p=[0,12,26,36],O={verified:n("זמן מאומת"),keyframe_limited:n("דיוק לפי פריים מפתח"),estimated:n("זמן משוער"),unknown:n("דיוק לא ידוע")}[this.precision],y=this.x(this.cursor,1e3),E=this.label(this.cursor),C=E.length>5?62:48,k=this.limit<this.start+this.windowMinutes?Math.max(0,this.x(this.limit,1e3)):null;return f`
      <div class="bar">
        ${D("helper_line")?f`<span class="precision" data-timeline-helper>${O} · ${n("לחיצה או גרירה = חיפוש · גלגלת = זום")}</span>`:f`<span></span>`}
        <div class="windows">
          ${x.map(s=>f`<button class=${s.minutes===this.windowMinutes?"on":""} @click=${()=>this.setWindow(s.minutes)}>${s.label}</button>`)}
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
        aria-label=${n("ציר זמן הקלטות")}>
        <line x1="0" x2=${1e3} y1=${58+.5} y2=${58+.5} stroke="var(--sw-border)" />
        ${k!==null?v`<rect x=${k} y="14" width=${Math.max(0,1e3-k)} height=${44} fill="var(--sw-surface-3)" opacity="0.7" />`:m}
        ${this.buckets(160).map((s,a)=>{if(!s)return m;const g=p[s];return v`<rect x=${a*6.25+1} y=${58-g} width=${Math.max(2,6.25-2)} height=${g} rx="1.5" fill="var(--sw-tl-recording)" opacity=${s===1?.45:s===2?.8:1} />`})}
        ${h.map(s=>v`<line x1=${this.x(s,1e3)} x2=${this.x(s,1e3)} y1=${58} y2=${63} stroke="var(--sw-border-strong)" /><text x=${this.x(s,1e3)} y=${78} font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${this.label(s)}</text>`)}
        ${this.events.map(s=>{const a=this.x(s.minute,1e3);return a<0||a>1e3?m:v`<g><circle cx=${a} cy=${58-p[3]-8} r="3.5" fill=${R[s.kind]} /><title>${s.label} · ${$(s.minute)}</title></g>`})}
        ${this.bookmarks.map(s=>{const a=this.x(s.minute,1e3),g=this.x(s.endMinute,1e3);if(g<0||a>1e3)return m;const M=T[s.preservation],z=w=>{w.stopPropagation(),this.cursor=s.minute,this.follow=!0,this.dispatchEvent(new CustomEvent("seek",{detail:{minute:s.minute,alt:!1},bubbles:!0,composed:!0})),this.dispatchEvent(new CustomEvent("bookmark-click",{detail:{id:s.id,minute:s.minute},bubbles:!0,composed:!0}))};return v`<g class="bm" data-bookmark=${s.id} role="button" tabindex="0" aria-label=${s.label} @pointerdown=${w=>w.stopPropagation()} @click=${z} @keydown=${w=>(w.key==="Enter"||w.key===" ")&&z(w)}>
            <rect x=${Math.max(0,a)} y="13" width=${Math.max(2,Math.min(1e3,g)-Math.max(0,a))} height="3" rx="1.5" fill=${M} opacity="0.55" />
            <line x1=${a} x2=${a} y1="3" y2=${58} stroke=${M} stroke-dasharray="2 3" opacity="0.6" />
            <polygon points=${`${a},2 ${a+9},6 ${a},10`} fill=${M} />
            <title>${s.label} · ${$(s.minute)}</title>
          </g>`})}
        ${this.hover!==null&&!this.dragging?v`<line pointer-events="none" x1=${this.x(this.hover,1e3)} x2=${this.x(this.hover,1e3)} y1="18" y2=${58} stroke="var(--sw-text-3)" stroke-dasharray="3 3" /><text pointer-events="none" x=${this.x(this.hover,1e3)} y="12" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font-mono)">${this.label(this.hover)}</text>`:m}
        ${y>=-60&&y<=1060?v`<g transform="translate(${y} 0)" pointer-events="none">
              <line x1="0" x2="0" y1="15" y2=${62} stroke="var(--sw-accent)" stroke-width="2" />
              <rect x=${-C/2} y="0" width=${C} height="16" rx="5" fill="var(--sw-accent)" />
              <text x="0" y="11.5" font-size="10.5" text-anchor="middle" fill="#fff" font-family="var(--sw-font-mono)" font-weight="600">${E}</text>
            </g>`:m}
      </svg>
      <div class="legend">
        <span style="--lg: var(--sw-tl-recording)">${n("הקלטה (גובה = פעילות)")}</span>
        <span style="--lg: var(--sw-tl-motion)">${n("תנועה")}</span>
        <span style="--lg: var(--sw-tl-person)">${n("אדם")}</span>
        <span style="--lg: var(--sw-tl-vehicle)">${n("רכב")}</span>
        <span style="--lg: var(--sw-tl-door)">${n("דלת")}</span>
        <span style="--lg: var(--sw-border-strong)">${n("ריק = אין הקלטה / לא נבדק")}</span>
        ${this.limit<1440?f`<span style="--lg: var(--sw-surface-3)">${n("אפור = עתיד")}</span>`:m}
      </div>
    `}};r.styles=S`
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
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
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
  `;l([d({attribute:!1})],r.prototype,"segments",2);l([d({attribute:!1})],r.prototype,"events",2);l([d({attribute:!1})],r.prototype,"bookmarks",2);l([d({type:Number})],r.prototype,"cursor",2);l([d({type:Number})],r.prototype,"windowMinutes",2);l([d()],r.prototype,"precision",2);l([d({type:Boolean})],r.prototype,"follow",2);l([d({type:Number})],r.prototype,"limit",2);l([Y()],r.prototype,"hover",2);l([d({type:Number})],r.prototype,"viewStart",2);l([d({type:Boolean,reflect:!0})],r.prototype,"compact",2);l([Y()],r.prototype,"dragging",2);r=l([P("sw-timeline")],r);export{$ as m,N as s};
