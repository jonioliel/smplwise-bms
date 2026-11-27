import{av as s,cN as z,A as p,b as i,j as O,z as u,a as T,cO as F,aE as D,aw as y,aj as H,cP as g,cQ as j,m as _}from"./index-CoJbESCx.js";import"./sw-logo-art-PLtEZJxU.js";var I=Object.defineProperty,q=Object.getOwnPropertyDescriptor,x=(e,t,n,a)=>{for(var o=a>1?void 0:a?q(t,n):t,c=e.length-1,r;c>=0;c--)(r=e[c])&&(o=(a?r(t,n,o):r(o))||o);return a&&o&&I(t,n,o),o};const S=e=>e.nodata||e.temp===null?i`<span class="deg none">-</span>`:i`<span class="deg">${e.temp.toFixed(1)}<small>°</small></span>`,N=e=>e.lit===null||e.lights===null?"-":`${e.lit}/${e.lights}`,A={link:"matchLink",map:"matchMap",level:"matchLevel",name:"matchName"};function B(e){return e?e.how&&e.haFloors.length?{text:s("matchOf",{floor:e.haFloors.map(t=>t.name).join(", "),how:s(A[e.how])}),linked:!0}:e.areas.length?{text:e.areas.every(t=>t.source==="map")?s("matchMap"):s("matchManual"),linked:!0}:e.suggestion?{text:s("matchSuggest",{floor:e.suggestion.haFloorName,how:s(A[e.suggestion.why])}),linked:!1}:{text:e.ambiguous?s("matchAmbiguous"):s("matchNone"),linked:!1}:null}const P=e=>e.filter(t=>B(t.match)?.linked===!1);function E(e,t){const n=e.lights?Math.round((e.lit??0)/e.lights*t):0;return i`<span class="fac" aria-hidden="true">${Array.from({length:t},(a,o)=>i`<i class=${o<n?"on":""}></i>`)}</span>`}function K(e,t,n,a,o={temp:!0,light:!0}){const c=z(e,t.temp_threshold),r=e.level===0?s("ground").slice(0,1):e.level>0?String(e.level):`‎${e.level}`;return i`<button class="xtile" data-xs-tile=${e.id} aria-pressed=${n} aria-label=${s("tileFor",{name:e.name})} data-temp=${c??""} ?data-off=${e.nodata} @click=${a}>
    <span class="lv">${r}</span>${o.temp?i`<span class="tv">${e.nodata||e.temp===null?"-":`${e.temp.toFixed(1)}°`}</span>`:p}${e.nodata||!o.light?p:E(e,3)}
  </button>`}function C(e,t,n=!0){const a=j(e,t.temp_threshold),o=y(e,t);return i`<span class="chips">
    ${o.temp&&a.avg!==null?i`<span class="chip">${g("therm")}${s("avgTemp")} <b>${a.avg.toFixed(1)}°</b></span>`:p}
    ${o.light&&a.litKnown?i`<span class="chip warm">${g("light")}<b>${a.lit}/${a.lights}</b> ${s("lightsOn")}</span>`:p}
    ${a.hot?i`<span class="chip hot">${g("flame")}${s("hotCount",{n:a.hot})}</span>`:p}
    ${a.cold?i`<span class="chip cold">${g("snow")}${s("coldCount",{n:a.cold})}</span>`:p}
    ${n&&a.nodata?i`<span class="chip off">${g("offline")}${s("noDataCount",{n:a.nodata})}</span>`:p}
  </span>`}let m=class extends T{constructor(){super(...arguments),this.floors=[],this.links=[],this.opts={...F},this.selectedId=null,this.hoverId=null,this.sheet=!1,this.fire=null,this.rowBoxes=null,this.boxesHeight=0,this.canLink=!1,this.lightsOk=null}press(e,t){this.lightsOk?.(t)&&e.composedPath().some(a=>a instanceof Element&&a.classList.contains("lc"))?this.dispatchEvent(new CustomEvent("xs-lights",{detail:{id:t.id},bubbles:!0,composed:!0})):this.pick(t.id)}pick(e){this.dispatchEvent(new CustomEvent("xs-pick",{detail:{id:e},bubbles:!0,composed:!0}))}hover(e){this.dispatchEvent(new CustomEvent("xs-hover",{detail:{id:e},bubbles:!0,composed:!0}))}link(e){this.dispatchEvent(new CustomEvent("xs-link",{detail:{id:e},bubbles:!0,composed:!0}))}rowHtml(e,t,n){const a=z(e,this.opts.temp_threshold),c=this.fire?.[e.id]?.state==="alarm",r=B(e.match),h=e.nodata?i`<span class="s warn">${r?r.text:s("noDataSince")}${r?.linked?` · ${s("noDataQuiet")}`:""}</span>`:i`<span class="s">${r?r.text:s("level",{n:D(e.level)})}${e.target!==null?` · ${s("target",{n:`${e.target.toFixed(1)}°`})}`:""}</span>`,l=y(this.floors,this.opts),w=(l.temp&&l.light?s("floorLabel",{name:e.name,temp:e.nodata||e.temp===null?s("noTemp"):s("degrees",{n:e.temp.toFixed(1)}),lit:e.lit===null?s("noData"):s("litOf",{lit:e.lit,lights:e.lights??0}),alert:c?`, ${s("fireAlarm")} (${s("fireDemo")})`:""}):[e.name,l.temp?e.nodata||e.temp===null?s("noTemp"):s("degrees",{n:e.temp.toFixed(1)}):"",l.light&&e.lit!==null?s("litOf",{lit:e.lit,lights:e.lights??0}):"",c?`${s("fireAlarm")} (${s("fireDemo")})`:""].filter(Boolean).join(", "))+(r?` · ${r.text}`:""),d=this.selectedId===e.id,f=n?n.height>=64?"var(--sw-r-lg)":n.height>=40?"var(--sw-r-md)":"var(--sw-r-sm)":"",v=`--i:${t}${n?`;top:${n.top}px;block-size:${n.height}px;border-radius:${f}`:""}`;return i`<button class="row ${e.level<0?"below":""} ${d?"sel":""} ${this.hoverId===e.id?"hl":""}" style=${v} data-xs-row=${e.id} aria-pressed=${d} aria-label=${w}
        data-temp=${a??""} ?data-off=${e.nodata} data-fire=${c?"alarm":""} ?data-xs-lights=${!!this.lightsOk?.(e)} @click=${b=>this.press(b,e)} @pointerenter=${b=>b.pointerType==="mouse"&&this.hover(e.id)} @pointerleave=${b=>b.pointerType==="mouse"&&this.hover(null)}>
      <span class="nm"><span class="t" dir="auto" title=${e.name}>${H(e.name)}</span>${h}</span>
      ${e.nodata?i`<span class="quiet" title=${r?.text??""}>${s("noDataQuiet")}</span>`:l.light?E(e,10):i`<span></span>`}
      ${e.nodata&&!c?p:i`<span class="val">
        ${c?i`<span class="chip alarm">${g("flame")}<span class="w">${s("fireAlarm")}</span></span>`:p}
        ${e.nodata||!l.temp?p:a==="hot"?i`<span class="chip hot">${g("flame")}<span class="w">${s("hot")}</span></span>`:a==="cold"?i`<span class="chip cold">${g("snow")}<span class="w">${s("cold")}</span></span>`:p}
        ${e.nodata||!l.light?p:i`<span class="chip ${e.lit?"warm":""} lc">${g("light")}<b>${N(e)}</b></span>`}
        ${e.nodata||!l.temp?p:S(e)}
      </span>`}
    </button>`}shaftLinks(e){return this.opts.shafts?this.links.filter(t=>e.filter(n=>t.floors.includes(n.id)).length>=2):[]}shafts(e){const t=this.shaftLinks(e);if(!t.length)return p;const n=e.some(a=>a.level<0)&&e.some(a=>a.level>=0);return i`<div class="shafts" aria-hidden="true">${t.map(a=>{const o=e.map(w=>a.floors.includes(w.id)),c=o.indexOf(!0),r=o.lastIndexOf(!0);let h=!1;const l=[];return e.forEach((w,d)=>{n&&w.level<0&&!h&&(h=!0,l.push(i`<span class="c gnd ${d>c&&d<=r?"mid":""}"></span>`));const f=o[d],v=!f&&d>c&&d<r;l.push(i`<span class="c ${f?"in":v?"mid":""} ${d===c?"top":""} ${d===r?"bot":""} ${a.pending?.includes(w.id)?"pend":""}"></span>`)}),i`<div class="shaft" data-k=${a.kind} title=${a.label}>${l}</div>`})}</div>`}shaftsAligned(e,t){const n=this.shaftLinks(e);return n.length?i`<div class="shafts" aria-hidden="true">${n.map(a=>{const o=e.filter(l=>a.floors.includes(l.id)).map(l=>({f:l,b:t.get(l.id)})),c=l=>l.top+l.height/2,r=c(o[0].b),h=c(o[o.length-1].b);return i`<div class="shaft abs" data-k=${a.kind} title=${a.label}>
        <span class="ln" style=${`top:${r}px;block-size:${h-r}px`}></span>
        ${o.map(({f:l,b:w})=>i`<span class="stop ${a.pending?.includes(l.id)?"pend":""}" style=${`top:${c(w)}px`}></span>`)}
      </div>`})}</div>`:p}legend(e){const t=this.shaftLinks(e),n=y(e,this.opts);return i`<div class="legend">
      ${n.temp?i`<span><i class="cold"></i>${s("cold")}</span><span><i class="hot"></i>${s("hot")}</span>`:p}${n.light?i`<span><i class="lit"></i>${s("lightsOn")}</span>`:p}
      ${t.some(a=>a.kind==="stairs")?i`<span><i class="ln d"></i>${s("stairs")}</span>`:p}${t.some(a=>a.kind==="lift")?i`<span><i class="ln"></i>${s("lift")}</span>`:p}
    </div>`}hint(e){const t=P(e);if(!t.length)return p;const n=t.length===1?s("matchHintOne",{name:t[0].name}):s("matchHintMany",{n:t.length});return i`<div class="hint" data-xs-hint>${g("offline")}<span>${n}</span>${this.canLink?i`<button class="lnk" data-xs-link=${t[0].id} @click=${()=>this.link(t[0].id)}>${s("matchHintAction")}</button>`:p}</div>`}render(){const e=this.floors;if(!e.length)return i`<section class="card" aria-label=${s("sectionAria")}><div class="empty">${g("section")}<b>${s("sectionEmptyTitle")}</b><span>${s("sectionEmptyBody")}</span></div></section>`;const t=e.some(d=>d.level<0)&&e.some(d=>d.level>=0),n=new Map((this.rowBoxes??[]).map(d=>[d.id,d])),a=!this.sheet&&!!this.rowBoxes&&this.boxesHeight>0&&e.every(d=>n.has(d.id)),o=this.opts.animate?"rise":"fade",c=`--step:${Math.min(30,Math.round(360/Math.max(1,e.length)))}ms;--n:${e.length}`,r=i`<div class="head"><h2>${g("section")}${s("sectionTitle")}</h2>${C(e,this.opts,!1)}<slot name="tools"></slot></div>`;if(a){const d=Math.min(...e.map(b=>n.get(b.id).height)),f=d>=64?"l":d>=40?"m":"s",v=[];return e.forEach((b,$)=>{const L=n.get(b.id);if(t&&b.level<0&&$>0&&e[$-1].level>=0){const M=n.get(e[$-1].id);v.push(i`<div class="ground" aria-hidden="true" style=${`top:${Math.round((M.top+M.height+L.top)/2)-1}px`}></div>`)}v.push(this.rowHtml(b,e.length-$,L))}),i`<section class="card aligned" aria-label=${s("sectionAria")} data-xsection data-xs-aligned>
        <div class="body">
          <div class="stack abs" data-d=${f} data-enter=${o} style=${`${c};block-size:${this.boxesHeight}px`}>${v}</div>
          ${this.shaftsAligned(e,n)}
        </div>
        <div class="foot">${r}${this.hint(e)}${this.legend(e)}</div>
      </section>`}const h=e.length>14?"s":e.length>8?"m":"l";let l=!1;const w=[];return e.forEach((d,f)=>{t&&d.level<0&&!l&&(l=!0,w.push(i`<div class="ground" aria-hidden="true"></div>`)),w.push(this.rowHtml(d,e.length-f,null))}),i`<section class="card" aria-label=${s("sectionAria")} data-xsection>
      ${r}
      <div class="body">
        <div class="stack" data-d=${h} data-enter=${o} style=${c}>${w}</div>
        ${this.shafts(e)}
      </div>
      <div class="foot">${this.hint(e)}${this.legend(e)}</div>
    </section>`}};m.styles=[O`
      :host { display: block; min-inline-size: 0; min-block-size: 0; block-size: 100%; }
      .card { block-size: 100%; min-block-size: 0; box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px; padding: 16px 18px 14px; background: var(--sw-surface); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-1); border: 1px solid var(--sw-border); }
      :host([sheet]) .card { box-shadow: none; border: 0; padding: 4px 2px 0; }
      /* aligned beside the floor cards: no panel chrome - the rows are wells like the cards, so a card and its row read as one table line */
      .card.aligned { grid-template-rows: auto auto; align-content: start; gap: 14px; padding: 0; background: none; border: 0; box-shadow: none; border-radius: 0; }
      .head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-inline-size: 0; }
      h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); letter-spacing: -0.02em; color: var(--sw-heading); white-space: nowrap; }
      h2 .xi { inline-size: 20px; block-size: 20px; color: var(--sw-text-3); }
      .aligned h2 { font-size: var(--sw-fs-md); }
      .aligned h2 .xi { inline-size: 16px; block-size: 16px; }
      .foot { display: flex; flex-direction: column; gap: 10px; min-inline-size: 0; }
      .chips { display: inline-flex; gap: 6px; flex-wrap: wrap; min-inline-size: 0; }
      .chip { display: inline-flex; align-items: center; gap: 5px; block-size: 28px; padding: 0 10px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); font-size: 12.5px; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .chip b { color: var(--sw-text); font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; }
      .xi { inline-size: 14px; block-size: 14px; flex: none; }
      .chip.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); color: var(--sw-text); }
      .chip.hot { background: color-mix(in srgb, var(--sw-heat) 16%, var(--sw-surface)); color: var(--sw-text); }
      .chip.cold { background: color-mix(in srgb, var(--sw-cool) 16%, var(--sw-surface)); color: var(--sw-text); }
      .chip.off { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); color: var(--sw-text-3); }
      /* white on --sw-danger is 3.8:1; the darker mix is 5.3:1 (ui-ux-pro-max contrast pass) */
      .chip.alarm { background: color-mix(in srgb, var(--sw-danger) 80%, #000); color: #fff; font-weight: var(--sw-fw-bold); }
      .hint { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
      .hint .xi { color: var(--sw-text-3); }
      .hint span { min-inline-size: 0; overflow-wrap: anywhere; }
      .lnk { font: inherit; font-weight: var(--sw-fw-semibold); color: var(--sw-accent-text, var(--sw-accent)); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
      .body { min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
      .stack { container-type: size; position: relative; min-block-size: 0; display: flex; flex-direction: column; justify-content: flex-start; gap: 6px; }
      .stack.abs { display: block; container-type: normal; }
      .stack.abs > .row, .stack.abs > .ground { position: absolute; inset-inline: 0; box-sizing: border-box; }
      .row[data-xs-lights] .lc { cursor: pointer; }
      .row, .xtile { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
      .row { position: relative; flex: 1 1 0; min-block-size: 0; max-block-size: 132px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(150px, auto); align-items: center; gap: 14px; padding: 0 14px; border: 2px solid transparent; border-radius: 12px; background: var(--sw-surface-2); text-align: start; color: inherit; font: inherit; cursor: pointer; overflow: hidden; transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), border-color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); }
      .stack.abs > .row { max-block-size: none; }
      .row:active { transform: scale(var(--sw-press-scale, 0.98)); }
      @media (hover: hover) and (pointer: fine) { .row:hover:not(.sel), .row.hl:not(.sel) { background: var(--sw-surface-3); } }
      .nm { min-inline-size: 0; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
      .t { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .s { font-size: 12.5px; color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .s.warn { color: var(--sw-text-3); }
      .fac { position: relative; align-self: center; block-size: min(calc(100% - 20px), 36px); display: flex; align-items: stretch; gap: 3px; padding: 3px; border-radius: 7px; background: var(--sw-border); }
      .fac i { flex: 1 1 0; min-inline-size: 3px; border-radius: 3px; background: var(--sw-surface-2); }
      .fac i.on { background: color-mix(in srgb, var(--sw-lit) 82%, var(--sw-surface)); }
      .quiet { justify-self: start; font-size: 12.5px; color: var(--sw-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
      .val { min-inline-size: 0; display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
      .val .chip { block-size: 26px; }
      .deg { min-inline-size: 64px; text-align: end; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--sw-heading); line-height: 1; direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
      .deg small { font-size: 0.6em; font-weight: 700; color: var(--sw-text-3); }
      .deg.none { color: var(--sw-text-3); }
      .row[data-temp='hot'] .deg { color: color-mix(in srgb, var(--sw-heat) 62%, var(--sw-heading)); }
      .row[data-temp='cold'] .deg { color: color-mix(in srgb, var(--sw-cool) 62%, var(--sw-heading)); }
      .row[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 12%, var(--sw-surface-2)); }
      .row[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 12%, var(--sw-surface-2)); }
      /* no data: the same well, said once in muted words - no stripes, no extra edge, no empty facade */
      .row[data-off] .t { color: var(--sw-text-2); }
      .row[data-fire='alarm'] { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); border-color: var(--sw-danger); }
      .row.below:not([data-temp]):not([data-fire]):not(.sel) { background: color-mix(in srgb, var(--sw-surface-2) 70%, var(--sw-surface-3)); }
      .row.sel { background: var(--sw-accent-soft); border-color: var(--sw-accent); }
      .row.sel .t { color: var(--sw-accent-text, var(--sw-heading)); }
      .row.sel[data-fire='alarm'] { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sw-danger) 45%, transparent); }
      .ground { position: relative; flex: none; block-size: 2px; margin: 2px 6px; border-radius: 2px; background: var(--sw-border-strong); }
      .stack.abs > .ground { margin: 0; inset-inline: 6px; }
      .shafts { display: flex; gap: 6px; min-block-size: 0; }
      .shaft { position: relative; inline-size: 22px; display: flex; flex-direction: column; gap: 6px; }
      .shaft .c { position: relative; flex: 1 1 0; min-block-size: 0; max-block-size: 132px; }
      .shaft .c.gnd { flex: none; block-size: 6px; }
      .shaft .c.in::before { content: ''; position: absolute; inset-inline-start: 50%; top: -4px; bottom: -4px; border-inline-start: 2px solid var(--sw-accent); margin-inline-start: -1px; }
      .shaft .c.mid::before { content: ''; position: absolute; inset-inline-start: 50%; top: -4px; bottom: -4px; border-inline-start: 2px solid var(--sw-accent); margin-inline-start: -1px; }
      .shaft[data-k='stairs'] .c::before { border-inline-start-style: dashed; }
      .shaft .c.top::before { top: 50%; }
      .shaft .c.bot::before { bottom: 50%; }
      .shaft .c.in::after { content: ''; position: absolute; inset-inline-start: 50%; top: 50%; inline-size: 8px; block-size: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--sw-surface); box-shadow: inset 0 0 0 2px var(--sw-accent); }
      .shaft .c.in.pend::after { box-shadow: inset 0 0 0 2px var(--sw-text-3); background: var(--sw-surface-2); }
      /* aligned: one line from the first served row to the last, a stop on each served row */
      .shaft.abs { display: block; }
      .shaft.abs .ln { position: absolute; inset-inline-start: 50%; margin-inline-start: -1px; border-inline-start: 2px solid var(--sw-accent); }
      .shaft.abs[data-k='stairs'] .ln { border-inline-start-style: dashed; }
      .shaft.abs .stop { position: absolute; inset-inline-start: 50%; inline-size: 8px; block-size: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--sw-surface); box-shadow: inset 0 0 0 2px var(--sw-accent); }
      .shaft.abs .stop.pend { box-shadow: inset 0 0 0 2px var(--sw-text-3); background: var(--sw-surface-2); }
      .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--sw-text-3); }
      .legend span { display: inline-flex; align-items: center; gap: 5px; }
      .legend i { inline-size: 10px; block-size: 10px; border-radius: 3px; background: var(--sw-border-strong); }
      .legend i.cold { background: var(--sw-cool); }
      .legend i.hot { background: var(--sw-heat); }
      .legend i.lit { background: var(--sw-lit); }
      .legend i.ln { inline-size: 14px; block-size: 0; border-radius: 0; border-block-start: 2px solid var(--sw-accent); background: none; }
      .legend i.ln.d { border-block-start-style: dashed; }
      .empty { display: grid; place-items: center; gap: 6px; padding: 24px; text-align: center; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
      /* density: by the row height (aligned) or the number of floors (filling) - fewer pixels, fewer words. Never a scroll. */
      .quiet { display: none; }
      /* roomy rows: the second line may take two lines (the home-system floor and how it was matched); a floor without data has no
         facade or values, so its words take the row */
      @media (min-width: 1101px) {
        .stack[data-d='l'] .s, .stack[data-d='l'] .t { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow-wrap: anywhere; }
        .stack[data-d='l'] .row { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(150px, auto); }
        .stack[data-d='l'] .row[data-off]:not([data-fire='alarm']) .nm { grid-column: 1 / -1; }
      }
      .stack[data-d='m'] .s, .stack[data-d='s'] .s { display: none; }
      .stack[data-d='m'] .quiet, .stack[data-d='s'] .quiet { display: block; }
      .stack[data-d='m'] .deg { font-size: 19px; min-inline-size: 54px; }
      .stack[data-d='s'] .row { gap: 10px; padding-inline: 10px; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(110px, auto); }
      .stack[data-d='s'] .t { font-size: 13px; font-weight: 600; line-height: 1.1; }
      .stack[data-d='s'] .deg { font-size: 14.5px; font-weight: 700; min-inline-size: 44px; }
      .stack[data-d='s'] .fac { block-size: calc(100% - 8px); max-block-size: 22px; padding: 2px; gap: 2px; border-radius: 4px; }
      .stack[data-d='s'] .fac i { border-radius: 2px; }
      .stack[data-d='s'] .quiet { font-size: 11.5px; }
      .stack[data-d='s'] .val .chip { block-size: 20px; padding: 0 7px; font-size: 11.5px; gap: 3px; }
      .stack[data-d='s'] .val .chip .w, .stack[data-d='s'] .val .chip.lc { display: none; }
      .stack:not(.abs)[data-d='m'] .deg { font-size: clamp(10px, calc((100cqh - 6px * var(--n, 10)) / var(--n, 10) * 0.6), 19px); }
      .stack:not(.abs)[data-d='s'] .t { font-size: clamp(8px, calc((100cqh - 6px * var(--n, 16)) / var(--n, 16) * 0.55), 13px); }
      .stack:not(.abs)[data-d='s'] .deg { font-size: clamp(8px, calc((100cqh - 6px * var(--n, 16)) / var(--n, 16) * 0.6), 14.5px); }
      .stack:not(.abs)[data-d='s'] .row { border-radius: 8px; }
      /* entrance: fade only unless motion is allowed and the option is on */
      .stack[data-enter] .row { animation: xs-fade 160ms var(--sw-ease, ease) backwards; }
      @media (prefers-reduced-motion: no-preference) {
        .stack[data-enter='rise'] .row { animation: xs-rise 260ms var(--sw-ease, ease) backwards; animation-delay: calc(var(--i, 0) * var(--step, 20ms) * 0.4); }
      }
      @keyframes xs-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes xs-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      @media (max-width: 1100px) { .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10px; } .s { display: none; } .quiet { display: block; } }
      :focus-visible { outline: 2px solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; }
    `];x([u({attribute:!1})],m.prototype,"floors",2);x([u({attribute:!1})],m.prototype,"links",2);x([u({attribute:!1})],m.prototype,"opts",2);x([u()],m.prototype,"selectedId",2);x([u()],m.prototype,"hoverId",2);x([u({type:Boolean})],m.prototype,"sheet",2);x([u({attribute:!1})],m.prototype,"fire",2);x([u({attribute:!1})],m.prototype,"rowBoxes",2);x([u({type:Number})],m.prototype,"boxesHeight",2);x([u({type:Boolean})],m.prototype,"canLink",2);x([u({attribute:!1})],m.prototype,"lightsOk",2);m=x([_("sw-xsection")],m);let k=class extends T{constructor(){super(...arguments),this.floors=[],this.opts={...F},this.selectedId=null}render(){const e=this.floors;if(!e.length)return p;const t=e.slice(0,8),n=Math.max(7,Math.min(16,Math.floor(76/t.length)-3)),a=e.some(h=>h.level<0)&&e.some(h=>h.level>=0);let o=!1;const c=[],r=y(e,this.opts);for(const h of t){a&&h.level<0&&!o&&(o=!0,c.push(i`<i class="gnd"></i>`));const l=z(h,this.opts.temp_threshold);c.push(i`<span class="r ${this.selectedId===h.id?"sel":""}" data-temp=${l??""} ?data-off=${h.nodata}>${n>=12&&!h.nodata&&r.light?E(h,4):i`<span></span>`}<span>${n>=11&&r.temp?h.nodata||h.temp===null?"-":`${h.temp.toFixed(1)}°`:""}</span></span>`)}return i`<button data-xs-compact aria-label=${s("sectionTitle")} @click=${()=>this.dispatchEvent(new CustomEvent("xs-open-sheet",{bubbles:!0,composed:!0}))}>
      <span><b class="tt">${g("section")}${s("sectionTitle")}</b>${C(e,this.opts)}</span>
      <span class="mb" style="--mh:${n}px">${c}${e.length>t.length?i`<span class="r"><span>+${e.length-t.length}</span><span></span></span>`:p}</span>
    </button>`}};k.styles=O`
    :host { display: block; }
    button { inline-size: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 16px; background: var(--sw-surface); box-shadow: var(--sw-shadow-1); border: 1px solid var(--sw-border); text-align: start; font: inherit; color: inherit; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
    button { transition: transform var(--sw-t-press, 100ms) var(--sw-ease, ease), box-shadow var(--sw-t-hover, 120ms) var(--sw-ease-color, ease); }
    button:active { transform: scale(var(--sw-press-scale, 0.98)); }
    @media (hover: hover) and (pointer: fine) { button:hover { box-shadow: var(--sw-shadow-2, var(--sw-shadow-1)); } }
    b.tt { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 800; color: var(--sw-heading); }
    .xi { inline-size: 14px; block-size: 14px; flex: none; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-block-start: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; block-size: 24px; padding: 0 8px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); font-size: 11.5px; white-space: nowrap; }
    .chip b { color: var(--sw-text); direction: ltr; unicode-bidi: isolate; }
    .chip.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); }
    .chip.hot { background: color-mix(in srgb, var(--sw-heat) 16%, var(--sw-surface)); }
    .chip.cold { background: color-mix(in srgb, var(--sw-cool) 16%, var(--sw-surface)); }
    .chip.off { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .mb { display: flex; flex-direction: column; gap: 3px; inline-size: 132px; }
    .r { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; block-size: var(--mh, 14px); padding: 0 6px; border-radius: 4px; background: var(--sw-surface-2); font-size: 10.5px; font-weight: 700; color: var(--sw-heading); direction: ltr; }
    .r.sel { background: var(--sw-accent); color: #fff; }
    .r[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 18%, var(--sw-surface)); }
    .r[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 18%, var(--sw-surface)); }
    .r[data-off] { color: var(--sw-text-3); font-weight: 600; }
    .fac { display: flex; gap: 1px; padding: 1px; block-size: 7px; inline-size: 34px; border-radius: 2px; background: var(--sw-border); }
    .fac i { flex: 1 1 0; background: var(--sw-surface-2); border-radius: 1px; }
    .fac i.on { background: var(--sw-lit); }
    .gnd { block-size: 2px; background: var(--sw-border-strong); border-radius: 2px; margin: 0 2px; }
    :focus-visible { outline: 2px solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; }
  `;x([u({attribute:!1})],k.prototype,"floors",2);x([u({attribute:!1})],k.prototype,"opts",2);x([u()],k.prototype,"selectedId",2);k=x([_("sw-xs-compact")],k);const R=O`
  :host { --xt-white: #fff; } /* COLOR-LITERAL-B-2480: the chosen tile's white ink, one literal */
  .xtile { inline-size: 54px; flex: none; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); padding: 0; font: inherit; color: var(--sw-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; min-block-size: 44px; transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); }
  .xtile:active { transform: scale(var(--sw-press-scale, 0.98)); }
  .xtile .tv { font-size: 12px; font-weight: 600; color: var(--sw-text-2); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .xtile[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 16%, var(--sw-surface)); }
  .xtile[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 16%, var(--sw-surface)); }
  .xtile[data-off]:not([aria-pressed='true']) { color: var(--sw-text-3); }
  .xtile[aria-pressed='true'] { background: var(--sw-accent); color: var(--xt-white); }
  .xtile[aria-pressed='true'] .tv { color: var(--xt-white); }
  .xtile .fac { block-size: 9px; inline-size: 26px; display: flex; gap: 1.5px; padding: 1.5px; border-radius: 3px; background: var(--sw-border); }
  .xtile .fac i { flex: 1 1 0; background: var(--sw-surface-2); border-radius: 1px; }
  .xtile .fac i.on { background: var(--sw-lit); }
  .xtile[aria-pressed='true'] .fac { background: rgba(255, 255, 255, 0.35); }
`;export{A as HOW_KEY,m as SwXSection,k as SwXsCompact,B as matchLine,E as panes,P as unlinkedFloors,K as xsTile,R as xsTileStyles};
