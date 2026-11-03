import{E as f,F as g,G as h,a as m,sm as v,sn as x,R as w,so as $,sp as y,si as _,e1 as s,e as a,A as u,H as k}from"./index-TwIAG38v.js";var z=Object.defineProperty,E=Object.getOwnPropertyDescriptor,c=(t,i,e,r)=>{for(var n=r>1?void 0:r?E(i,e):i,l=t.length-1,d;l>=0;l--)(d=t[l])&&(n=(r?d(i,e,n):d(n))||n);return r&&n&&z(i,e,n),n};const p=new Set(["incident.merge_window_s","incident.door_window_s"]);let o=class extends m{constructor(){super(...arguments),this.sheet=!1,this.values=null,this.draft={},this.bounds=v,this.canEdit=!1,this.error="",this.saving=!1,this.invalid=new Set}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const t=await x();this.values=t.settings,this.bounds={...v,...t.bounds??{}},this.canEdit=t.can_edit,this.draft={},this.error=""}catch(t){this.error=w(t)}}v(t){return t in this.draft?this.draft[t]:this.values?.[t]}set(t,i){this.draft={...this.draft,[t]:i}}setInt(t,i){const e=this.bounds[t],r=Number(i),n=p.has(t)?Math.round(r*60):Math.round(r),l=i.trim()!==""&&Number.isFinite(r)&&e.kind==="int"&&n>=e.min&&n<=e.max,d=new Set(this.invalid);l?(d.delete(t),this.set(t,n)):d.add(t),this.invalid=d}async save(){if(!(!this.values||this.invalid.size||!Object.keys(this.draft).length)){this.saving=!0;try{const t=await $(this.draft);this.values=t.settings,this.draft={},this.error="",y(t.settings["incident.enabled"]),_(),this.dispatchEvent(new CustomEvent("saved",{detail:t.settings,bubbles:!0,composed:!0}))}catch(t){this.error=w(t)||s("sError")}finally{this.saving=!1}}}cancel(){this.draft={},this.invalid=new Set,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}toggle(t,i){const e=!!this.v(t);return a`<button class="sw" role="switch" type="button" aria-checked=${e?"true":"false"} aria-label=${i} data-setting=${t} ?disabled=${!this.canEdit}
      @click=${()=>this.set(t,!e)}></button>`}num(t,i){const e=this.bounds[t],r=Number(this.v(t)),n=p.has(t)?r/60:r,l=e.kind==="int"?p.has(t)?e.min/60:e.min:0,d=e.kind==="int"?p.has(t)?e.max/60:e.max:0;return a`<input type="number" inputmode="numeric" min=${l} max=${d} step="1" .value=${String(n)} aria-label=${i} data-setting=${t}
      aria-invalid=${this.invalid.has(t)?"true":"false"} ?disabled=${!this.canEdit} @input=${b=>this.setInt(t,b.target.value)} />`}row(t,i,e){return a`<div class="srow"><div class="tx"><b>${t}</b><span>${i}</span></div>${e}</div>`}render(){if(this.error&&!this.values)return a`<sw-state-panel state="error" heading=${s("sError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>void this.load()}></sw-state-panel>`;if(!this.values)return a`<sw-state-panel state="loading"></sw-state-panel>`;const t=this.v("incident.red_dot"),i=Object.keys(this.draft).length>0;return a`<div class="card" data-incident-settings>
      ${this.sheet?a`<div class="hd"><h2>${s("sTitle")}</h2><span class="sp"></span><sw-button size="sm" variant="ghost" data-settings-close @click=${()=>this.cancel()}>${s("sClose")}</sw-button></div>`:u}
      <div class="grid">
        ${this.row(s("sEnabled"),s("sEnabledHint"),this.toggle("incident.enabled",s("sEnabled")))}
        ${this.row(s("sAuto"),s("sAutoHint"),this.toggle("incident.auto_open.alarm",s("sAuto")))}
        ${this.row(s("sMerge"),s("sMergeHint"),a`${this.num("incident.merge_window_s",s("sMerge"))}<span class="unit">${s("sMinutes",{n:""}).trim()}</span>`)}
        ${this.row(s("sLive"),s("sLiveHint"),a`<span class="unit">${s("sDesktop")}</span>${this.num("incident.max_live",s("sDesktop"))}<span class="unit">${s("sPhone")}</span>${this.num("incident.max_live_phone",s("sPhone"))}`)}
        ${this.row(s("sSnap"),s("sTimesHint"),this.num("incident.snapshot_refresh_s",s("sSnap")))}
        ${this.row(s("sRefresh"),s("sTimesHint"),this.num("incident.refresh_s",s("sRefresh")))}
        ${this.row(s("sHidden"),s("sTimesHint"),this.num("incident.hidden_stop_s",s("sHidden")))}
        ${this.row(s("sDoorWindow"),s("sDoorWindowHint"),this.num("incident.door_window_s",s("sDoorWindow")))}
        ${this.row(s("sRadius"),s("sRadiusHint"),this.num("incident.near_radius_pct",s("sRadius")))}
        ${this.row(s("sDot"),s("sDotHint"),a`<div class="seg" role="group" aria-label=${s("sDot")} data-setting="incident.red_dot">
            <button type="button" data-dot="active" aria-pressed=${t==="active"?"true":"false"} ?disabled=${!this.canEdit} @click=${()=>this.set("incident.red_dot","active")}>${s("sDotActive")}</button>
            <button type="button" data-dot="off" aria-pressed=${t==="off"?"true":"false"} ?disabled=${!this.canEdit} @click=${()=>this.set("incident.red_dot","off")}>${s("sDotOff")}</button></div>`)}
        ${this.row(s("sClock"),s("sClockHint"),this.toggle("incident.header_clock",s("sClock")))}
        ${this.row(s("sRetention"),s("sRetentionHint"),this.num("incidents.retention_days",s("sRetention")))}
        ${this.row(s("sRecipients"),s("sRecipientsHint"),a`<a href="#/system/notifications" data-recipients-link>${s("sRecipientsLink")}</a>`)}
      </div>
      <div class="foot">
        <span class="msg ${this.error?"err":""}">${this.error||(this.canEdit?"":s("sReadOnly"))}</span>
        ${this.sheet?a`<sw-button data-settings-cancel @click=${()=>this.cancel()}>${s("sCancel")}</sw-button>`:u}
        ${this.canEdit?a`<sw-button variant="primary" data-settings-save ?disabled=${!i||this.invalid.size>0||this.saving} @click=${()=>void this.save()}>${s("sSave")}</sw-button>`:u}
      </div>
    </div>`}};o.styles=f`
    :host { display: block; }
    .hd { display: flex; align-items: center; gap: 8px; margin-block-end: 6px; }
    .hd h2 { margin: 0; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .hd .sp { flex: 1; }
    .card { background: var(--sw-surface-solid, var(--sw-surface)); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); padding: 12px 18px 14px; box-shadow: var(--sw-shadow-1); max-inline-size: 760px; }
    :host([sheet]) .card { border: 0; box-shadow: none; padding: 0; max-inline-size: none; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 900px) { :host(:not([sheet])) .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 28px; } }
    .srow { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-block-start: 1px solid var(--sw-border); min-inline-size: 0; }
    .tx { flex: 1; min-inline-size: 0; }
    .tx b { display: block; font-size: var(--sw-fs-base); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
    .tx span { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .sw { position: relative; inline-size: 40px; block-size: 24px; border-radius: 999px; background: var(--sw-border-strong); border: 0; cursor: pointer; flex: none; padding: 0; }
    .sw::after { content: ''; position: absolute; inset-block-start: 3px; inset-inline-start: 3px; inline-size: 18px; block-size: 18px; border-radius: 50%; background: #fff; transition: inset-inline-start var(--sw-t-fast) var(--sw-ease); box-shadow: var(--sw-shadow-1); }
    .sw[aria-checked='true'] { background: var(--sw-accent); }
    .sw[aria-checked='true']::after { inset-inline-start: 19px; }
    .sw:disabled { opacity: var(--sw-disabled-opacity); cursor: default; }
    .seg { display: inline-flex; padding: 2px; background: var(--sw-surface-3); border-radius: var(--sw-r-sm); flex: none; }
    .seg button { font: inherit; font-size: var(--sw-fs-sm); border: 0; background: transparent; color: var(--sw-text-2); border-radius: var(--sw-r-xs); padding: 4px 10px; min-block-size: 26px; cursor: pointer; white-space: nowrap; }
    .seg button[aria-pressed='true'] { background: var(--sw-seg-thumb, var(--sw-surface)); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .seg button:disabled { cursor: default; }
    input[type='number'] { font: inherit; font-size: var(--sw-fs-sm); background: var(--sw-surface); color: var(--sw-text); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: 3px 6px; min-block-size: 28px; inline-size: 64px; }
    input[aria-invalid='true'] { border-color: var(--sw-danger); }
    .unit { color: var(--sw-text-3); font-size: var(--sw-fs-xs); white-space: nowrap; }
    a { color: var(--sw-accent-text); font-size: var(--sw-fs-sm); white-space: nowrap; }
    .foot { display: flex; gap: 8px; justify-content: flex-end; align-items: center; padding-block-start: 8px; border-block-start: 1px solid var(--sw-border); }
    .foot .msg { flex: 1; font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
    .foot .err { color: var(--sw-danger-text); }
    @media (max-width: 767px) and (pointer: coarse) { .sw { min-block-size: 24px; } input[type='number'] { min-block-size: 36px; } .seg button { min-block-size: 36px; } }
  `;c([g({type:Boolean,reflect:!0})],o.prototype,"sheet",2);c([h()],o.prototype,"values",2);c([h()],o.prototype,"draft",2);c([h()],o.prototype,"bounds",2);c([h()],o.prototype,"canEdit",2);c([h()],o.prototype,"error",2);c([h()],o.prototype,"saving",2);c([h()],o.prototype,"invalid",2);o=c([k("incident-settings-form")],o);
//# sourceMappingURL=settings-form-Bz2as8qe.js.map
