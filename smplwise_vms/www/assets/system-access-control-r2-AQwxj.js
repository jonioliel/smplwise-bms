import{bY as be,g as O,E as P,F as z,a as M,e as r,A as d,H as N,C as q,G as u,i as y,av as j,ar as we,R as V,b8 as Se,bV as ne,rQ as Re,i_ as Ce,qJ as Ae}from"./index-CcnB1Mea.js";import"./sw-table-D7oaCHnK.js";import{R as w,s as a,m as _e,a as J,b as L,c as ie,d as D,e as F,y as re,f as Oe,g as Pe,h as Te,i as Ee,j as _,k as x,l as Me,n as Ne,o as Le,p as De,q as Fe,t as je,r as b,u as qe,v as Ie,z as Ue,w as He,x as Ke,A as Ge,B as We,C as oe,D as S,E as Ze,F as Be,G as Ve,H as Xe,I as Ye,J as Je,K as Qe,L as le,M as ce,N as et,O as tt,P as st,Q as at,S as nt,T as $e,U as ye,V as it,W as rt,X as ot,Y as lt,Z as ct,_ as dt,$ as pt,a0 as de,a1 as ht,a2 as ut,a3 as mt}from"./status-text-yvrx5Oqw.js";import{b as pe,c as ft}from"./events-logic-CB6NBjhX.js";import{s as G,C as m}from"./status-css-C3YVsA_e.js";import{U as X}from"./wiskey-format-B1C9aa4N.js";import{a as B}from"./access-WpRrFBbe.js";import{l as ee,h as vt,g as gt,p as bt,s as wt,i as _t}from"./access-messaging-CowZtS1x.js";import"./sw-logo-art-Va6y_cIM.js";const te=()=>O("access-control/status/stations"),$t=(e,t)=>be(`access-control/stations/${encodeURIComponent(e)}/health`,{signal:t}),yt=(e,t)=>be(`access-control/stations/${encodeURIComponent(e)}/health/history`,{signal:t}),xt=()=>O("access-control/status/sync"),kt=()=>O("access-control/status/conflicts"),zt=["offline","sync_stalled","sync_conflict","sync_error","event_gap","clock_drift"],St=50;function Rt(e){const t=new URLSearchParams;return e.kind&&t.set("kind",e.kind),e.includeSuppressed&&t.set("include_suppressed","true"),t.set("offset",String(e.offset??0)),t.set("limit",String(e.limit??St)),t.toString()}const Ct=(e={})=>O(`access-control/status/alerts?${Rt(e)}`),At=50;function Ot(e){const t=new URLSearchParams;return e.station_id&&t.set("station_id",e.station_id),e.action&&t.set("action",e.action),e.user_id&&t.set("user_id",e.user_id),e.start&&t.set("start",e.start),e.end&&t.set("end",e.end),e.before&&t.set("before",String(e.before)),t.set("limit",String(e.limit??At)),t.toString()}const Pt=(e={})=>O(`access-control/status/audit?${Ot(e)}`),Tt=()=>O("access-control/groups"),Et=20,Mt=(e=0,t=Et)=>O(`access-control/groups/versions?offset=${e}&limit=${t}`);var Nt=Object.defineProperty,Lt=Object.getOwnPropertyDescriptor,W=(e,t,s,i)=>{for(var n=i>1?void 0:i?Lt(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(i?c(t,s,n):c(n))||n);return i&&n&&Nt(t,s,n),n};const Dt={ok:"ok",warn:"warn",err:"err",off:"off",unk:"unk"};let E=class extends M{constructor(){super(...arguments),this.station=null,this.zone={kind:"iana",name:"UTC"},this.rev=0,this.now=new Date,this.health=null,this.history=null,this.ctl=null,this.loadedFor="",this.lastRev=0}willUpdate(e){const t=this.station?.id??"";if(t&&(t!==this.loadedFor||e.has("rev")&&this.rev!==this.lastRev)){const s=t===this.loadedFor;this.lastRev=this.rev,s?(this.health?.reload(),this.history?.reload()):this.start(t)}}disconnectedCallback(){this.stop(),super.disconnectedCallback()}start(e){this.stop(),this.loadedFor=e,this.ctl=new AbortController;const t=this.ctl.signal;this.health=new w({fetch:()=>$t(e,t),pick:s=>s.health,onChange:()=>this.requestUpdate()}),this.history=new w({fetch:()=>yt(e,t),pick:s=>s.history,onChange:()=>this.requestUpdate()}),this.health.reload(),this.history.reload()}stop(){this.ctl?.abort(),this.health?.dispose(),this.history?.dispose(),this.health=null,this.history=null,this.loadedFor=""}row(e,t){return r`<dt>${e}</dt><dd>${t}</dd>`}tone(e,t){return r`<span class="with"><span class="dot ${Dt[e]}" aria-hidden="true"></span>${t}</span>`}connection(e){const t=e.requests,s=e.online;return r`<section class="sect" data-health-section="connection">
      <h4>${a("hdConnection")}</h4>
      <dl>
        ${this.row(a("hdState"),s===null?"—":this.tone(s?"ok":"off",s?a("hdOnline"):a("hdOffline")))}
        ${this.row(a("hdFirmware"),r`<bdi class="ltr">${_e(null,e.firmware)||"—"}</bdi>`)}
        ${this.row(a("hdPollFailures"),e.consecutive_poll_failures===null?"—":String(e.consecutive_poll_failures))}
        ${this.row(a("hdRequests"),t.requests===null?"—":a("hdRequestsVal",{n:t.requests,f:t.failures??0}))}
        ${this.row(a("hdLastMs"),J(t.last_ms))}
        ${this.row(a("hdP95"),J(t.p95_ms))}
      </dl>
    </section>`}access(e){const t=e.access,s=L(t.sync_state,!0),i=ie(t.assignment_states,o=>D(L(o,!0).word)),n=ie(t.errors,o=>F(o));return r`<section class="sect" data-health-section="sync">
      <h4>${a("hdSync")}</h4>
      <dl>
        ${this.row(a("hdSyncState"),r`<sw-badge kind=${s.kind} label=${D(s.word)}></sw-badge>`)}
        ${t.last_error?this.row(a("colError"),F(t.last_error)):d}
        ${this.row(a("hdQueue"),t.queue_depth===null?"—":String(t.queue_depth))}
        ${this.row(a("hdWorker"),re(t.worker_active))}
        ${this.row(a("hdPendingRequest"),re(t.pending_request))}
        ${i?this.row(a("hdAssignments"),i):d}
        ${n?this.row(a("hdErrors"),n):d}
      </dl>
    </section>`}events(e){const t=e.events;return t?r`<section class="sect" data-health-section="events">
      <h4>${a("hdEvents")}</h4>
      <dl>
        ${this.row(a("hdStream"),this.tone(Oe(t.stream),Pe(t.stream)))}
        ${this.row(a("hdHistoryState"),this.tone(Te(t.history),Ee(t.history)))}
        ${this.row(a("hdReconnects"),t.reconnects===null?"—":String(t.reconnects))}
        ${this.row(a("hdLastFrame"),_(x(t.last_frame_at,this.now,this.zone)))}
        ${t.storage_failed?this.row(a("hdStorageFailed"),a("hdYes")):d}
      </dl>
    </section>`:r`<section class="sect" data-health-section="events"><h4>${a("hdEvents")}</h4><div class="none">${a("hdNoEvents")}</div></section>`}clock(e){const t=e.clock;return t?r`<section class="sect" data-health-section="clock">
      <h4>${a("hdClock")}</h4>
      <dl>
        ${this.row(a("hdClockStatus"),this.tone(Me(t.status),Ne(t.status)))}
        ${this.row(a("hdSkew"),Le(t.skew_seconds))}
        ${this.row(a("hdDrift"),this.tone(De(t.drift_state),Fe(t.drift_state)))}
        ${this.row(a("hdTimeMode"),je(t.time_mode))}
        ${this.row(a("hdChecked"),_(x(t.checked_at,this.now,this.zone)))}
        ${t.error?this.row(a("hdClockError"),F(t.error)):d}
      </dl>
    </section>`:r`<section class="sect" data-health-section="clock"><h4>${a("hdClock")}</h4><div class="none">${a("hdNoClock")}</div></section>`}strip(){const e=this.history,t=e?.snap;if(!e||!t||t.busy&&!t.data)return r`<section class="sect sk-box" data-health-section="history"><h4>${a("hdHistory")}</h4><span class="sk"></span></section>`;if(!t.data)return r`<section class="sect" data-health-section="history"><h4>${a("hdHistory")}</h4>${t.failure&&t.failure!=="forbidden"?b(t.failure,t.message,()=>void e.reload(),!0):d}</section>`;const s=qe(t.data.records,this.zone,this.now),i=s.some(n=>n.samples>0);return r`<section class="sect" data-health-section="history">
      <h4>${a("hdHistory")}</h4>
      ${i?r`<div class="strip" data-health-strip>
            ${s.map(n=>{const o=`${pe(n.date).replace(/\.\d{4}$/,"")}${n.onlinePct===null?"":` · ${a("hdHistoryPct",{p:n.onlinePct})}`}${n.pollMs===null?"":` · ${J(n.pollMs)}`}`;return r`<div class="day ${n.tone}" role="img" aria-label=${o} title=${o} data-health-day=${n.date}><span class="bar"></span><span class="pct">${n.onlinePct===null?"—":`${n.onlinePct}%`}</span><span class="dt">${pe(n.date).replace(/\.\d{4}$/,"")}</span></div>`})}
          </div>`:r`<div class="none">${a("hdHistoryNone")}</div>`}
      ${t.data.storage_failed?r`<div class="none">${a("hdHistoryStorage")}</div>`:d}
    </section>`}render(){if(!this.station)return d;const t=this.health,s=t?.snap;if(!t||!s||s.busy&&!s.data)return r`<section class="sect sk-box" data-health-loading aria-busy="true"><span class="sk"></span><span class="sk"></span><span class="sk"></span></section>`;if(!s.data)return r`${s.failure?b(s.failure,s.message,()=>void t.reload(),!0):d}`;const i=t.stale;return r`
      ${i?r`<div class="note" role="status" data-health-stale><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt?a("stale",{t:_(x(s.fetchedAt,this.now,this.zone))}):a("staleNever")}</span></div>`:d}
      ${this.connection(s.data)}${this.access(s.data)}${this.events(s.data)}${this.clock(s.data)}${this.strip()}
    `}};E.styles=P`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .sect {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      letter-spacing: 0.04em;
      color: var(--sw-text-3);
    }
    dl {
      display: grid;
      grid-template-columns: minmax(96px, 128px) minmax(0, 1fr);
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-base);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      color: var(--sw-text);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .with {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .dot {
      flex: none;
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: var(--sw-unknown);
    }
    .dot.ok {
      background: var(--sw-live);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .dot.err {
      background: var(--sw-danger);
    }
    .dot.off {
      background: var(--sw-offline);
    }
    .none {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-stale-soft);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .note > span {
      flex: 1 1 160px;
    }
    .strip {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-inline-size: 0;
    }
    .bar {
      inline-size: 100%;
      block-size: 36px;
      border-radius: var(--sw-r-xs);
      background: var(--sw-skeleton);
    }
    .day.ok .bar {
      background: var(--sw-live);
    }
    .day.warn .bar {
      background: var(--sw-warning);
    }
    .day.err .bar {
      background: var(--sw-danger);
    }
    .pct {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .dt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .sk {
      display: block;
      border-radius: var(--sw-r-xs);
      background: var(--sw-skeleton);
      block-size: 12px;
    }
    .sect.sk-box {
      gap: 10px;
    }
  `;W([z({attribute:!1})],E.prototype,"station",2);W([z({attribute:!1})],E.prototype,"zone",2);W([z({type:Number})],E.prototype,"rev",2);W([z({attribute:!1})],E.prototype,"now",2);E=W([N("system-access-health")],E);const Z=P`
  @media not ((hover: hover) and (pointer: fine)) {
    button.row:hover,
    .sw:not(:disabled):hover {
      background: transparent;
    }
  }
  button.row,
  .sw {
    transition: background-color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease);
  }
  button.row:active,
  .sw:not(:disabled):active {
    background: var(--sw-hover-wash);
  }
  .chipbtn {
    transition: transform var(--sw-t-press, 120ms) var(--sw-ease, ease);
  }
  .chipbtn:active {
    transform: scale(var(--sw-press-scale, 0.97));
  }
  .chipbtn:focus-visible {
    outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
    outline-offset: 2px;
  }
  @media (max-width: 767px) {
    .ch {
      padding: 12px 12px 8px;
    }
    .ch > div:first-child {
      flex: 1 1 100%;
      min-inline-size: 0;
    }
    .ch .ctl {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      inline-size: 100%;
      gap: 8px;
    }
    .ch .ctl > * {
      min-inline-size: 0;
    }
    .ch .ctl > .chipbtn,
    .ch .ctl > sw-button {
      justify-content: center;
    }
    .row,
    .sw {
      padding-inline: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button.row,
    .sw,
    .chipbtn {
      transition-duration: 0ms;
    }
    .chipbtn:active {
      transform: none;
    }
  }
`;var Ft=Object.defineProperty,jt=Object.getOwnPropertyDescriptor,I=(e,t,s,i)=>{for(var n=i>1?void 0:i?jt(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(i?c(t,s,n):c(n))||n);return i&&n&&Ft(t,s,n),n};const qt=6e4;let C=class extends M{constructor(){super(...arguments),this.rev=0,this.selected="",this.kind="",this.muted=!1,this.wide=!0,this.timer=0,this.stopSession=null,this.lastMeta="",this.lastRev=0,this.nameOf=e=>this.stationsRes.snap.data?.find(t=>t.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.stationsRes=new w({fetch:()=>te(),pick:t=>t.stations,onChange:e}),this.syncRes=new w({fetch:()=>xt(),pick:t=>t.sync_status,onChange:e}),this.alertsRes=new w({fetch:t=>Ct({kind:this.kind,includeSuppressed:this.muted,offset:typeof t=="number"?t:0}),pick:t=>t.alerts,merge:Ie,cursorOf:t=>t.next_offset,onChange:e}),this.conflictsRes=new w({fetch:()=>kt(),pick:t=>t.conflicts,onChange:e}),this.wide=!y()||j("access.admin.read"),this.stopSession=we(()=>{const t=!y()||j("access.admin.read");t!==this.wide&&(this.wide=t,this.reloadAll())}),this.reloadAll(),this.timer=window.setInterval(()=>{(typeof document>"u"||document.visibilityState==="visible")&&this.reloadAll()},qt)}disconnectedCallback(){window.clearInterval(this.timer),this.stopSession?.();for(const e of[this.stationsRes,this.syncRes,this.alertsRes,this.conflictsRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),this.syncRes.reload(),this.alertsRes.reload(),this.wide&&this.conflictsRes.reload()}emitMeta(){const e=this.stationsRes?.snap.reply?.sync??this.syncRes?.snap.reply?.sync??this.alertsRes?.snap.reply?.sync??null,t=JSON.stringify(e);t!==this.lastMeta&&(this.lastMeta=t,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.defaultZone()},bubbles:!0,composed:!0})))}defaultZone(){return this.stationsRes?.snap.reply?.default_zone??X}zoneOf(e){return Ue(this.stationsRes.snap.data,e,this.defaultZone())}tiles(e){const t=He(this.stationsRes.snap.data,this.syncRes.snap.data,this.wide?this.conflictsRes.snap.data:null),s=this.defaultZone(),i=(n,o,c,h="",p="")=>r`<div class="tile" data-access-tile=${n}><span class="k">${o?a(o):""}</span><span class="v ${p}">${c}</span>${h?r`<span class="d">${h}</span>`:r`<span class="d">&nbsp;</span>`}</div>`;return r`<div class="tiles" data-access-tiles>
      ${i("online","kpiOnline",String(t.online),a("kpiOnlineOf",{total:t.total}),t.total>0&&t.online<t.total?"warn":"")}
      ${i("pending","kpiPending",t.pending===null?"—":String(t.pending),"",(t.pending??0)>0?"warn":"")}
      ${t.conflicts===null?d:i("conflicts","kpiConflicts",String(t.conflicts),"",t.conflicts>0?"err":"")}
      ${i("last-sync","kpiLastSync",t.lastSync?ft(t.lastSync,s):"—",t.lastSync?_(x(t.lastSync,e,s)):"")}
    </div>`}stationRow(e,t){const s=Ke(e),i=L(e.sync_state,e.online),n=_e(e.technical?.model,e.technical?.firmware);return r`<button type="button" class="row two" data-access-station=${e.id} aria-label=${a("healthOpen",{name:e.name})} @click=${()=>this.selected=e.id}>
      <span class="dot ${s}" aria-hidden="true"></span>
      <span class="main"><span class="t">${e.name}</span>${n?r`<span class="s"><bdi class="ltr">${n}</bdi></span>`:d}</span>
      <span class="side"><sw-badge kind=${i.kind} label=${D(i.word)}></sw-badge><span class="when">${_(x(e.last_seen,t,this.zoneOf(e.id)))}</span></span>
      <sw-icon class="chev" name="chevronBack" size=${16}></sw-icon>
    </button>`}healthCard(e){const t=this.stationsRes.snap.data??[];return r`<sw-card flush data-access-card="health">
      <div class="ch"><div><h3>${a("healthTitle")}</h3><div class="sub">${a("healthSub")}</div></div></div>
      ${t.length?r`<div class="list">${t.map(s=>this.stationRow(s,e))}</div>`:r`<div class="empty">${a("healthEmpty")}</div>`}
    </sw-card>`}kindItems(){return[{id:"",label:a("alertKindAll")},...zt.map(e=>({id:e,label:a(`alert_${e}`)}))]}alertRow(e,t){const s=Ge(e);return r`<div class="row" data-access-alert=${e.id} data-tone=${s}>
      <span class="dot ${s==="muted"?"muted":s}" aria-hidden="true"></span>
      <span class="main"><span class="t">${We(e)}</span>${oe(e,t,this.zoneOf(e.station_id))?r`<span class="s wrap">${oe(e,t,this.zoneOf(e.station_id))}</span>`:d}</span>
    </div>`}alertsCard(e){const t=this.alertsRes,s=t.snap,i=s.data;let n;return!s.everAnswered||s.busy&&!i?n=S(3):i?i.items.length?n=r`<div class="list" data-access-alerts>${i.items.map(o=>this.alertRow(o,e))}</div>`:n=r`<div class="empty" data-access-alerts-empty><span class="dot ok" aria-hidden="true"></span>${a("alertsEmpty")}</div>`:n=r`<div class="empty-panel">${b(s.failure??"error",s.message,()=>void t.reload(),!0)}</div>`,r`<sw-card flush data-access-card="alerts">
      <div class="ch">
        <div><h3>${a("alertsTitle")}</h3><div class="sub">${a("alertsSub",{n:i?i.total??i.items.length:0})}</div></div>
        <div class="ctl">
          <sw-dropdown tall data-access-alert-kind label=${a("alertKind")} .items=${this.kindItems()} .value=${this.kind} @change=${o=>this.setKind(o.detail.id)}></sw-dropdown>
          <button type="button" class="chipbtn" data-access-alerts-muted aria-pressed=${String(this.muted)} @click=${()=>this.toggleMuted()}>${a("alertMutedShow")}</button>
        </div>
      </div>
      ${t.stale&&i?r`<div class="note stale" role="status" data-access-stale="alerts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt,e)}</span></div>`:d}
      ${n}
      ${i&&!i.complete?r`<div class="note info" role="status" data-access-alerts-partial><sw-icon name="info" size=${16}></sw-icon><span>${a("alertsPartial")}</span></div>`:d}
      ${t.hasMore?r`<div class="more"><sw-button size="lg" data-access-alerts-more ?disabled=${s.loadingMore} @click=${()=>void t.more()}>${s.loadingMore?a("loadingMore"):a("more")}</sw-button></div>`:d}
      ${s.moreFailed?r`<div class="note err" role="alert" data-access-alerts-more-failed><span>${a("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void t.more()}>${a("retry")}</sw-button></div>`:d}
    </sw-card>`}setKind(e){this.kind=e,this.alertsRes.reload()}toggleMuted(){this.muted=!this.muted,this.alertsRes.reload()}staleText(e,t){return e?a("stale",{t:_(x(e,t,this.defaultZone()))}):a("staleNever")}syncCard(e){const t=this.syncRes,s=t.snap,i=Ze(s.data,this.nameOf),n=p=>p>0?String(p):"—",o=p=>p,c=[{key:"name",label:a("colStation"),render:p=>r`<span style=${m.strong}>${o(p).name}</span>`},{key:"managed",label:a("colManaged"),render:p=>o(p).managed===null?"—":String(o(p).managed)},{key:"pending",label:a("colPending"),render:p=>n(o(p).pending)},{key:"removals",label:a("colRemovals"),render:p=>n(o(p).removals)},{key:"failed",label:a("colFailed"),render:p=>n(o(p).failed)},{key:"last",label:a("colLastSync"),render:p=>_(x(o(p).reconciledAt,e,this.zoneOf(o(p).id)))},{key:"state",label:a("colState"),render:p=>{const v=L(o(p).state,!0);return r`<span style=${m.row}><sw-badge kind=${v.kind} label=${D(v.word)}></sw-badge>${o(p).error?r`<span style=${m.muted}>${F(o(p).error)}</span>`:d}</span>`}}];let h;return!s.everAnswered||s.busy&&!s.data?h=S(3):s.data?i.length?h=r`<sw-table data-access-sync .columns=${c} .rows=${i} rowKey="id"></sw-table>`:h=r`<div class="empty">${a("syncEmpty")}</div>`:h=b(s.failure??"error",s.message,()=>void t.reload(),!0),r`<sw-card flush data-access-card="sync">
      <div class="ch"><div><h3>${a("syncTitle")}</h3><div class="sub">${a("syncSub")}</div></div></div>
      ${t.stale&&s.data?r`<div class="note stale" role="status" data-access-stale="sync"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt,e)}</span></div>`:d}
      ${h}
    </sw-card>`}conflictsCard(e){if(!this.wide)return d;const t=this.conflictsRes,s=t.snap;if(s.failure==="forbidden")return d;const i=h=>h,n=[{key:"who",label:a("colWho"),render:h=>{const p=Be(i(h));return p.kind==="name"?r`<span style=${m.strong}>${p.text}</span>`:p.kind==="employee"?r`<span>${a("employeeShort",{n:p.text})}</span>`:r`<span style=${m.muted}>${a("unnamed")}</span>`}},{key:"kind",label:a("colKind"),render:h=>a(Ve(i(h).kind))},{key:"station",label:a("colStation"),render:h=>this.nameOf(i(h).station_id)},{key:"state",label:a("colState"),render:h=>{const p=L(i(h).sync_state,!0);return r`<sw-badge kind=${p.kind} label=${D(p.word)}></sw-badge>`}},{key:"error",label:a("colError"),render:h=>F(i(h).last_error)||"—"}],o=(s.data??[]).map((h,p)=>({...h,id:`${h.station_id}/${h.kind}/${h.person?.id??p}`}));let c;return!s.everAnswered||s.busy&&!s.data?c=S(2):s.data?o.length?c=r`<sw-table data-access-conflicts .columns=${n} .rows=${o} rowKey="id"></sw-table>`:c=r`<div class="empty" data-access-conflicts-empty><span class="dot ok" aria-hidden="true"></span>${a("conflictsEmpty")}</div>`:c=b(s.failure??"error",s.message,()=>void t.reload(),!0),r`<sw-card flush data-access-card="conflicts">
      <div class="ch"><div><h3>${a("conflictsTitle")}</h3><div class="sub">${a("conflictsSub")}</div></div></div>
      ${t.stale&&s.data?r`<div class="note stale" role="status" data-access-stale="conflicts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt,e)}</span></div>`:d}
      ${c}
    </sw-card>`}drawer(e){const t=this.selected?this.stationsRes.snap.data?.find(i=>i.id===this.selected):void 0,s=t?L(t.sync_state,t.online):null;return r`<sw-drawer modal ?open=${!!t} heading=${t?.name??""} @close=${()=>this.selected=""} data-access-health-drawer>
      ${s?r`<sw-badge slot="action" kind=${s.kind} label=${D(s.word)}></sw-badge>`:d}
      ${t?r`<system-access-health data-access-health=${t.id} .station=${t} .zone=${this.zoneOf(t.id)} .rev=${this.rev} .now=${e}></system-access-health>`:d}
    </sw-drawer>`}render(){const e=new Date,t=this.stationsRes,s=t.snap;return!s.everAnswered||s.busy&&!s.data?r`<div class="stack" data-access-status="loading">${Xe()}<sw-card flush>${S(4)}</sw-card></div>`:s.data?r`<div class="stack" data-access-status="ready">
        ${t.stale?r`<div class="note stale" role="status" data-access-stale="page"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt,e)}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>this.reloadAll()}>${a("refresh")}</sw-button></div>`:d}
        ${this.tiles(e)}
        <div class="grid2">${this.healthCard(e)}${this.alertsCard(e)}</div>
        ${this.syncCard(e)}
        ${this.conflictsCard(e)}
      </div>
      ${this.drawer(e)}`:r`<div class="stack" data-access-status=${s.failure??"error"}>${b(s.failure??"error",s.message,()=>this.reloadAll())}</div>`}};C.styles=[G,P`
      .when {
        white-space: nowrap;
      }
    `,Z,q];I([z({type:Number})],C.prototype,"rev",2);I([u()],C.prototype,"selected",2);I([u()],C.prototype,"kind",2);I([u()],C.prototype,"muted",2);I([u()],C.prototype,"wide",2);C=I([N("system-access-status")],C);var It=Object.defineProperty,Ut=Object.getOwnPropertyDescriptor,U=(e,t,s,i)=>{for(var n=i>1?void 0:i?Ut(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(i?c(t,s,n):c(n))||n);return i&&n&&It(t,s,n),n};const Ht="display:inline-flex;align-items:center;min-block-size:var(--sw-touch-desktop,44px);padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer;text-decoration:underline;text-decoration-color:var(--sw-border-strong);text-underline-offset:3px";let A=class extends M{constructor(){super(...arguments),this.rev=0,this.station="",this.action="",this.period="",this.person=null,this.lastRev=0,this.lastMeta="",this.nameOf=e=>this.stationsRes.snap.data?.find(t=>t.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.stationsRes=new w({fetch:()=>te(),pick:t=>t.stations,onChange:e}),this.auditRes=new w({fetch:t=>Pt({station_id:this.station,action:this.action,user_id:this.person?.id,start:Je(this.period,new Date),before:typeof t=="number"?t:null}),pick:t=>t.audit,merge:Ye,cursorOf:t=>t.next_cursor,onChange:e}),this.reloadAll()}disconnectedCallback(){this.stationsRes?.dispose(),this.auditRes?.dispose(),super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),this.auditRes.reload()}emitMeta(){const e=this.auditRes?.snap.reply?.sync??this.stationsRes?.snap.reply?.sync??null,t=JSON.stringify(e);t!==this.lastMeta&&(this.lastMeta=t,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.zone()},bubbles:!0,composed:!0})))}zone(){return this.stationsRes?.snap.reply?.default_zone??X}stationItems(){return[{id:"",label:a("auditStationAll")},...(this.stationsRes.snap.data??[]).map(e=>({id:e.id,label:e.name}))]}actionItems(){return[{id:"",label:a("auditActionAll")},...Qe.map(e=>({id:e,label:le(e)}))]}setStation(e){this.station=e,this.auditRes.reload()}setAction(e){this.action=e,this.auditRes.reload()}periodItems(){const e={"":a("auditPeriodAll"),"24h":a("auditPeriod24h"),"7d":a("auditPeriod7d"),"30d":a("auditPeriod30d")};return ce.map(t=>({id:t,label:e[t]}))}setPeriod(e){this.period=ce.includes(e)?e:"",this.auditRes.reload()}setPerson(e){this.person=e,this.auditRes.reload()}clear(){this.station="",this.action="",this.period="",this.person=null,this.auditRes.reload()}target(e){const t=et(e);if(t.kind==="none")return"—";if(t.kind==="person"){const i=r`<span>${t.name??a("unnamed")}${t.employee?r` <span style=${m.muted}>· ${a("employeeShort",{n:t.employee})}</span>`:d}</span>`,n=tt(e);return!n||this.person?i:r`<button type="button" style=${Ht} data-access-audit-person=${n.id} title=${a("auditPersonPick",{name:n.name})} @click=${()=>this.setPerson(n)}>${i}</button>`}const s=t.ids.map(i=>this.nameOf(i)).join(", ");return t.more?a("auditStationsMore",{names:s,n:t.more}):a("auditStations",{names:s})}actionCell(e){const t=le(e.action),s=st(e).map(n=>at(n)),i=!!t&&t!==e.action;return r`<span>${i?t:r`<span style=${m.raw}>${t||"—"}</span>`}${s.length?r`<span style=${m.sub}>${a("auditFields",{list:s.join(", ")})}</span>`:d}</span>`}resultCell(e){const t=nt(e);return t.kind==="done"?r`<sw-badge kind="live" label=${a("resDone")}></sw-badge>`:r`<span style=${m.row}><sw-badge kind="error" label=${a("resFailed")}></sw-badge><span style=${m.muted}>${F(t.code)}</span></span>`}table(e,t){const s=this.zone(),i=o=>o,n=[{key:"time",label:a("colTime"),render:o=>i(o).time?$e(ye(i(o).time,t,s)):"—"},{key:"user",label:a("colUser"),render:o=>i(o).actor_name??a("actorNone")},{key:"action",label:a("colAction"),render:o=>this.actionCell(i(o))},{key:"target",label:a("colTarget"),render:o=>this.target(i(o))},{key:"result",label:a("colResult"),render:o=>this.resultCell(i(o))}];return r`<sw-table data-access-audit-table .columns=${n} .rows=${e.records} rowKey="sequence"></sw-table>`}render(){const e=this.auditRes,t=e.snap,s=new Date,i=t.data,n=!!(this.station||this.action||this.period||this.person);let o;if(!t.everAnswered||t.busy&&!i)o=S(5);else if(i)i.records.length?o=this.table(i,s):o=r`<div class="empty" data-access-audit-empty>${n?a("auditEmptyFiltered"):a("auditEmpty")}</div>`;else return r`<div class="stack" data-access-status=${t.failure??"error"}>${b(t.failure??"error",t.message,()=>this.reloadAll())}</div>`;const c=this.zone();return r`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="audit">
        <div class="ch">
          <div><h3>${a("auditTitle")}</h3><div class="sub">${a("auditSub")}</div></div>
          <div class="ctl">
            <sw-dropdown tall data-access-audit-station label=${a("auditStation")} .items=${this.stationItems()} .value=${this.station} @change=${h=>this.setStation(h.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-action label=${a("auditAction")} .items=${this.actionItems()} .value=${this.action} @change=${h=>this.setAction(h.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-period label=${a("auditPeriod")} .items=${this.periodItems()} .value=${this.period} @change=${h=>this.setPeriod(h.detail.id)}></sw-dropdown>
            ${this.person?r`<button type="button" class="chipbtn" aria-pressed="true" data-access-audit-person-chip aria-label=${a("auditPersonClear")} @click=${()=>this.setPerson(null)}><span>${a("auditPerson",{name:this.person.name})}</span><sw-icon name="close" size=${14}></sw-icon></button>`:d}
            ${n?r`<sw-button size="lg" variant="ghost" data-access-audit-clear @click=${()=>this.clear()}>${a("auditClear")}</sw-button>`:d}
          </div>
        </div>
        ${e.stale&&i?r`<div class="note stale" role="status" data-access-stale="audit"><sw-icon name="offline" size=${16}></sw-icon><span>${t.fetchedAt?a("stale",{t:_(x(t.fetchedAt,s,c))}):a("staleNever")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void e.reload()}>${a("refresh")}</sw-button></div>`:d}
        ${o}
        ${e.hasMore?r`<div class="more"><sw-button size="lg" data-access-audit-more ?disabled=${t.loadingMore} @click=${()=>void e.more()}>${t.loadingMore?a("loadingMore"):a("more")}</sw-button></div>`:d}
        ${t.moreFailed?r`<div class="note err" role="alert" data-access-audit-more-failed><span>${a("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void e.more()}>${a("retry")}</sw-button></div>`:d}
        ${i?r`<div class="foot-note" data-access-audit-foot>${[i.total!==null?a("auditTotal",{n:i.total}):"",i.retention_days?a("auditRetention",{n:i.retention_days}):""].filter(Boolean).join(" · ")}</div>`:d}
      </sw-card>
    </div>`}};A.styles=[G,P`
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
      }
    `,Z,q];U([z({type:Number})],A.prototype,"rev",2);U([u()],A.prototype,"station",2);U([u()],A.prototype,"action",2);U([u()],A.prototype,"period",2);U([u()],A.prototype,"person",2);A=U([N("system-access-audit")],A);var Kt=Object.defineProperty,Gt=Object.getOwnPropertyDescriptor,se=(e,t,s,i)=>{for(var n=i>1?void 0:i?Gt(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(i?c(t,s,n):c(n))||n);return i&&n&&Kt(t,s,n),n};let K=class extends M{constructor(){super(...arguments),this.rev=0,this.wide=!0,this.lastRev=0,this.lastMeta="",this.nameOf=e=>this.stationsRes.snap.data?.find(t=>t.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.wide=!y()||j("access.admin.read"),this.stationsRes=new w({fetch:()=>te(),pick:t=>t.stations,onChange:e}),this.groupsRes=new w({fetch:()=>Tt(),pick:t=>t.groups,onChange:e}),this.versionsRes=new w({fetch:t=>Mt(typeof t=="number"?t:0),pick:t=>t.versions,merge:it,cursorOf:t=>t.next_offset,onChange:e}),this.reloadAll()}disconnectedCallback(){for(const e of[this.groupsRes,this.versionsRes,this.stationsRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),(!y()||B().people)&&this.groupsRes.reload(),this.wide&&this.versionsRes.reload()}emitMeta(){const e=this.groupsRes?.snap.reply?.sync??this.versionsRes?.snap.reply?.sync??this.stationsRes?.snap.reply?.sync??null,t=JSON.stringify(e);t!==this.lastMeta&&(this.lastMeta=t,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.zone()},bubbles:!0,composed:!0})))}zone(){return this.stationsRes?.snap.reply?.default_zone??X}ruleText(e){const t=rt(e,(this.stationsRes.snap.data??[]).map(s=>s.id));switch(t.kind){case"all":return a("ruleAll");case"none":return a("ruleNone");case"unknown":return a("ruleUnknown");case"stations":return t.ids.map(s=>this.nameOf(s)).join(", ")}}groupsCard(){if(y()&&!B().people)return d;const e=this.groupsRes,t=e.snap;if(t.failure==="forbidden")return d;const s=t.data;let i;return!t.everAnswered||t.busy&&!s?i=S(4):s?s.groups.length?i=r`<div class="list" data-access-groups>
        ${s.groups.map(n=>r`<div class="row" data-access-group=${n.id}>
            <span class="dot ${n.enabled?"ok":"off"}" aria-hidden="true"></span>
            <span class="main"><span class="t">${n.label}</span><span class="s wrap">${this.ruleText(n)}</span></span>
            ${n.enabled?d:r`<span class="side"><sw-badge kind="offline" label=${a("groupOff")}></sw-badge></span>`}
          </div>`)}
      </div>`:i=r`<div class="empty">${a("groupsEmpty")}</div>`:i=b(t.failure??"error",t.message,()=>void e.reload(),!0),r`<sw-card flush data-access-card="groups">
      <div class="ch">
        <div><h3>${a("groupsTitle")}</h3><div class="sub">${a("groupsSub")}</div></div>
        ${s?r`<div class="ctl rev" data-access-revision><span class="muted">${a("revisionNow",{n:s.revision??"—"})}</span>${s.photo_enabled===null?d:r`<span class="muted">${s.photo_enabled?a("photoOn"):a("photoOff")}</span>`}</div>`:d}
      </div>
      ${e.stale&&s?r`<div class="note stale" role="status" data-access-stale="groups"><sw-icon name="offline" size=${16}></sw-icon><span>${t.fetchedAt?a("stale",{t:_(x(t.fetchedAt,new Date,this.zone()))}):a("staleNever")}</span></div>`:d}
      ${i}
    </sw-card>`}fieldsCard(){const e=this.groupsRes.snap.data;if(!e||e.fields===null)return d;const t=i=>i,s=[{key:"label",label:a("colField"),render:i=>r`<span style=${m.strong}>${t(i).label}</span>`},{key:"type",label:a("colType"),render:i=>a(ot(t(i).type))},{key:"flags",label:a("colFlags"),render:i=>{const n=t(i),o=lt(n),c=n.depends_on?(e.fields??[]).find(h=>h.id===n.depends_on?.field_id)?.label??n.depends_on.field_id:"";return r`<span style=${m.row}>${[n.required?a("flagRequired"):a("flagOptional"),o.includes("unique")?a("flagUnique"):"",o.includes("depends")?a("flagDepends",{field:c}):""].filter(Boolean).join(" · ")}${o.includes("disabled")?r`<sw-badge kind="offline" label=${a("flagDisabled")}></sw-badge>`:d}</span>`}},{key:"options",label:a("colOptions"),render:i=>{const n=ct(t(i).options??[]);return n.shown.length?r`<span>${n.shown.join(", ")}${n.more?r` <span style=${m.muted}>${a("optionsMore",{n:n.more})}</span>`:d}</span>`:r`<span style=${m.muted}>—</span>`}}];return r`<sw-card flush data-access-card="fields">
      <div class="ch"><div><h3>${a("fieldsTitle")}</h3><div class="sub">${a("fieldsCount",{n:e.fields.length})}</div></div></div>
      ${e.fields.length?r`<sw-table data-access-fields .columns=${s} .rows=${e.fields} rowKey="id"></sw-table>`:r`<div class="empty">${a("fieldsEmpty")}</div>`}
    </sw-card>`}versionsCard(e){if(!this.wide)return d;const t=this.versionsRes,s=t.snap;if(s.failure==="forbidden")return d;const i=s.data,n=this.zone(),o=p=>p,c=[{key:"revision",label:a("colRevision"),render:p=>r`<span style=${m.row}><span style=${m.strong}>${o(p).revision}</span>${i&&o(p).revision===i.current_revision?r`<sw-badge kind="live" label=${a("versionCurrent")}></sw-badge>`:d}</span>`},{key:"saved",label:a("colSaved"),render:p=>o(p).saved_at?$e(ye(o(p).saved_at,e,n)):"—"},{key:"action",label:a("colChange"),render:p=>dt(o(p).action)},{key:"fields",label:a("colFieldChanges"),render:p=>o(p).field_changes?String(o(p).field_changes):"—"},{key:"groups",label:a("colGroupChanges"),render:p=>o(p).group_changes?String(o(p).group_changes):"—"}];let h;return!s.everAnswered||s.busy&&!i?h=S(3):i?i.records.length?h=r`<sw-table data-access-versions .columns=${c} .rows=${i.records} rowKey="revision"></sw-table>`:h=r`<div class="empty">${a("versionsEmpty")}</div>`:h=b(s.failure??"error",s.message,()=>void t.reload(),!0),r`<sw-card flush data-access-card="versions">
      <div class="ch"><div><h3>${a("versionsTitle")}</h3><div class="sub">${a("versionsSub")}</div></div></div>
      ${t.stale&&i?r`<div class="note stale" role="status" data-access-stale="versions"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt?a("stale",{t:_(x(s.fetchedAt,e,n))}):a("staleNever")}</span></div>`:d}
      ${h}
      ${t.hasMore?r`<div class="more"><sw-button size="lg" data-access-versions-more ?disabled=${s.loadingMore} @click=${()=>void t.more()}>${s.loadingMore?a("loadingMore"):`${a("more")} (${pt(i)})`}</sw-button></div>`:d}
      ${s.moreFailed?r`<div class="note err" role="alert" data-access-versions-more-failed><span>${a("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void t.more()}>${a("retry")}</sw-button></div>`:d}
      ${i?.retained_from_revision?r`<div class="foot-note" data-access-versions-retained>${a("versionsRetained",{n:i.retained_from_revision})}</div>`:d}
    </sw-card>`}render(){const e=new Date,t=this.groupsRes.snap;if((!y()||B().people)&&t.everAnswered&&!t.data&&t.failure&&t.failure!=="forbidden"&&["not_configured","connecting","not_installed","unsupported"].includes(t.failure))return r`<div class="stack" data-access-status=${t.failure}>${b(t.failure,t.message,()=>this.reloadAll())}</div>`;const i=this.groupsCard(),n=this.fieldsCard();return r`<div class="stack" data-access-status="ready">
      ${i!==d&&n!==d?r`<div class="grid2">${i}${n}</div>`:r`${i}${n}`}
      ${this.versionsCard(e)}
    </div>`}};K.styles=[G,P`
      .rev {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
      }
    `,Z,q];se([z({type:Number})],K.prototype,"rev",2);se([u()],K.prototype,"wide",2);K=se([N("system-access-groups")],K);var Wt=Object.defineProperty,Zt=Object.getOwnPropertyDescriptor,T=(e,t,s,i)=>{for(var n=i>1?void 0:i?Zt(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(i?c(t,s,n):c(n))||n);return i&&n&&Wt(t,s,n),n};const he={"access.event_portrait_audit":{title:"pol_event_portrait_audit",text:"pol_event_portrait_audit_text"},"access.event_portrait_sensitive":{title:"pol_event_portrait_sensitive",text:"pol_event_portrait_sensitive_text"},"access.employee_no_sensitive":{title:"pol_employee_no_sensitive",text:"pol_employee_no_sensitive_text"},"access.sync_errors_everyone":{title:"pol_sync_errors_everyone",text:"pol_sync_errors_everyone_text"}};let k=class extends M{constructor(){super(...arguments),this.rev=0,this.values=null,this.canEdit=!1,this.busy="",this.error="",this.failed="",this.loading=!0,this.lastRev=0,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.load())}async load(){const e=++this.gen;this.failed="";try{const t=await O("settings");if(e!==this.gen)return;this.values=this.read(t.settings),this.canEdit=!!t.can_edit&&(!y()||j("system.configure"))}catch(t){if(e!==this.gen)return;this.failed=V(t)}finally{e===this.gen&&(this.loading=!1)}}read(e){return Object.fromEntries(de.map(t=>[t,ht(e,t)]))}async flip(e){if(!this.values||!this.canEdit||this.busy)return;const t=!this.values[e];this.busy=e,this.error="";try{const s=await Se("settings",{[e]:String(t)});this.values=this.read(s.settings)}catch(s){this.error=`${a("policySaveFailed")} · ${V(s)}`}finally{this.busy=""}}render(){if(this.loading)return r`<div class="stack" data-access-status="loading"><sw-card flush>${S(4)}</sw-card></div>`;if(!this.values)return r`<div class="stack" data-access-status="error">${b("error",this.failed,()=>void this.load())}</div>`;const e=this.values;return r`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="policy">
        <div class="ch"><div><h3>${a("policyTitle")}</h3><div class="sub">${this.canEdit?a("policySub"):a("policyNote")}</div></div></div>
        ${de.map(t=>r`<button type="button" class="sw" role="switch" aria-checked=${String(e[t])} data-access-policy=${t} data-default=${String(ut[t])} ?disabled=${!this.canEdit||!!this.busy} @click=${()=>void this.flip(t)}>
            <span class="txt"><span class="t">${a(he[t].title)}</span><span class="x">${a(he[t].text)}</span></span>
            <span class="track" aria-hidden="true"></span>
          </button>`)}
        ${this.error?r`<div class="note err" role="alert" data-access-policy-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:d}
      </sw-card>
    </div>`}};k.styles=[G,P`
      .sw {
        display: flex;
        align-items: center;
        gap: 14px;
        inline-size: 100%;
        min-block-size: max(64px, var(--_t));
        padding: 10px 14px;
        box-sizing: border-box;
        border: 0;
        border-block-start: 1px solid var(--sw-border);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .sw:disabled {
        cursor: default;
        opacity: var(--sw-disabled-opacity);
      }
      .sw:not(:disabled):hover {
        background: var(--sw-hover-wash);
      }
      .sw:focus-visible {
        outline-offset: -2px;
      }
      .sw .txt {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sw .t {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
      }
      .sw .x {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .track {
        flex: none;
        position: relative;
        inline-size: 42px;
        block-size: 24px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-border-strong);
        transition: background var(--sw-t-fast) var(--sw-ease);
      }
      .track::after {
        content: '';
        position: absolute;
        inset-block-start: 3px;
        inset-inline-start: 3px;
        inline-size: 18px;
        block-size: 18px;
        border-radius: 50%;
        background: var(--sw-toggle-thumb);
        box-shadow: var(--sw-shadow-1);
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .sw[aria-checked='true'] .track {
        background: var(--sw-toggle-on);
      }
      .sw[aria-checked='true'] .track::after {
        transform: translateX(-18px);
      }
      :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after {
        transform: translateX(18px);
      }
      @media (prefers-reduced-motion: reduce) {
        .track,
        .track::after {
          transition: none;
        }
      }
    `,Z,q];T([z({type:Number})],k.prototype,"rev",2);T([u()],k.prototype,"values",2);T([u()],k.prototype,"canEdit",2);T([u()],k.prototype,"busy",2);T([u()],k.prototype,"error",2);T([u()],k.prototype,"failed",2);T([u()],k.prototype,"loading",2);k=T([N("system-access-policy")],k);const xe={templates_max:20,label_max:40,body_max:600,text_max:1e3,organization_max:60,bulk_max:[1,200],rate_per_hour:[1,1e3],per_sender_per_hour:[1,1e3],per_person_per_day:[1,50],per_station_per_hour:[1,1e3],placeholders:["name","organization"],placeholders_max:6},Bt=128,Vt=1500,Xt=/\p{Cc}|\p{Zl}|\p{Zp}/u,ae=(e,t)=>[...e].some(s=>t&&s===`
`?!1:Xt.test(s));function Yt(e){return e.replace(/\r\n?/g,`
`).split(`
`).map(t=>t.replace(/\s+$/u,"")).join(`
`).trim()}function Jt(e,t,s,i){const n=e.trim();if(!n)return[{path:t,code:"empty"}];if(n.length>i.label_max)return[{path:t,code:"too_long"}];if(ae(n,!1))return[{path:t,code:"control_chars"}];const o=n.toLocaleLowerCase();return s.has(o)?[{path:t,code:"duplicate_label"}]:(s.add(o),[])}function Qt(e,t,s,i){const n=Yt(e);if(!n)return[{path:t,code:"empty"}];if(n.length>i.body_max)return[{path:t,code:"too_long"}];if(ae(n,!0))return[{path:t,code:"control_chars"}];if(vt(n))return[{path:t,code:"credential"}];const o=[...n.matchAll(/\{([^{}]*)\}/g)].map(v=>v[1]),c=n.replace(/\{[^{}]*\}/g,"");if(c.includes("{")||c.includes("}"))return[{path:t,code:"bad_braces"}];if(o.some(v=>!i.placeholders.includes(v)))return[{path:t,code:"unknown_placeholder"}];if(ee(n))return[{path:t,code:"credential"}];if(o.length>i.placeholders_max)return[{path:t,code:"too_many_placeholders"}];if(o.includes("organization")&&!s.trim())return[{path:t,code:"organization_missing"}];if(ee(n.replace(/\{(name|organization)\}/g,(v,Y)=>Y==="name"?"xxxxxxxx":s.trim())))return[{path:t,code:"credential"}];const h=o.filter(v=>v==="name").length,p=o.filter(v=>v==="organization").length;return n.replace(/\{(?:name|organization)\}/g,"").length+h*Bt+p*i.organization_max>Vt?[{path:t,code:"too_long"}]:[]}const ue=/^([01]\d|2[0-3]):[0-5]\d$/;function es(e){return e==null?null:!ue.test(e.from)||!ue.test(e.to)?"window_invalid":e.from===e.to?"window_empty":e.from>e.to?"window_across_midnight":null}const me={per_sender_per_hour:[1,1e3],per_person_per_day:[1,50],per_station_per_hour:[1,1e3]};function ts(e,t=xe){const s=[],i=h=>typeof h=="number"&&Number.isInteger(h);i(e.bulk_max)?(e.bulk_max<t.bulk_max[0]||e.bulk_max>t.bulk_max[1])&&s.push({path:"bulk_max",code:"range"}):s.push({path:"bulk_max",code:"type"}),i(e.rate_per_hour)?(e.rate_per_hour<t.rate_per_hour[0]||e.rate_per_hour>t.rate_per_hour[1])&&s.push({path:"rate_per_hour",code:"range"}):s.push({path:"rate_per_hour",code:"type"});for(const h of Object.keys(me)){if(!(h in e))continue;const p=e[h],[v,Y]=t[h]??me[h];i(p)?(p<v||p>Y)&&s.push({path:h,code:"range"}):s.push({path:h,code:"type"})}const n=es(e.send_hours);n&&s.push({path:"send_hours",code:n});const o=e.organization.trim();o.length>t.organization_max?s.push({path:"organization",code:"too_long"}):ae(o,!1)?s.push({path:"organization",code:"control_chars"}):o.includes("{")||o.includes("}")?s.push({path:"organization",code:"bad_braces"}):ee(o)&&s.push({path:"organization",code:"credential"}),e.templates.length>t.templates_max&&s.push({path:"templates",code:"too_many"});const c=new Set;return e.templates.forEach((h,p)=>{s.push(...Jt(h.label,`templates.${p}.label`,c,t)),s.push(...Qt(h.body,`templates.${p}.body`,o,t))}),s}const ss=(e,t)=>e.filter(s=>s.path===t);function as(e,t,s,i){const n=s??e.length,o=i??n;return{text:e.slice(0,n)+t+e.slice(o),caret:n+t.length}}const ke={segment:"הודעות",segments_label:"הודעות",title:"הודעות לאנשים",sub:"שליחת הודעות וואטסאפ מרשימת האנשים: תבניות מאושרות והודעה חופשית. השליחה נרשמת ביומן המערכת, בלי תוכן ההודעה.",loading:"טוען את ההגדרות…",load_failed:"לא ניתן לטעון את ההגדרות",retry:"נסה שוב","service.connected":"שירות ההודעות מחובר","service.account":"חשבון: {name}","service.not_connected":"שירות ההודעות אינו מחובר","service.unknown":"מצב שירות ההודעות לא ידוע","service.unsupported":"שירות ההודעות אינו זמין בהתקנה הזו","service.account_required":"יש כמה חשבונות · בחרו מאיזה חשבון נשלחות ההודעות","service.account_missing":"החשבון שנבחר אינו קיים יותר · בחרו חשבון","service.account_not_covered":"החשבון שנבחר לא נכלל ברשימה שהתקבלה כרגע משירות ההודעות (הרשימה מוגבלת) · נסו שוב או בחרו חשבון אחר","service.no_account":"אין חשבון הודעות מחובר","enabled.title":"שליחת הודעות","enabled.on":"מופעל · במסך האנשים יש כפתור שליחה לבעלי ההרשאה","enabled.off":"כבוי · במסך האנשים אין כפתור שליחה","free.title":"הודעה חופשית","free.on":"השולח יכול לכתוב הודעה בעצמו","free.off":"אפשר לשלוח תבניות מאושרות בלבד","bulk.title":"נמענים מרבי בשליחה אחת","bulk.hint":"בין {min} ל־{max}","rate.title":"מכסת הודעות לשעה","rate.hint":"לכל המערכת · בין {min} ל־{max}","optout.note":'בקשת "לא לקבל הודעות" חלה על הודעות שנשלחות מכאן בלבד; רק מנהל מערכת יכול לבטל אותה.',"sender.title":"הודעות לשעה לכל שולח","sender.hint":"כולל הודעות שנדחו · בין {min} ל־{max}","person.title":"הודעות ביום לכל נמען","person.hint":"לפי האדם ולפי מספר הטלפון · בין {min} ל־{max}","station.title":"הודעות לשעה לאנשי עמדה","station.hint":"לכל עמדה בנפרד · בין {min} ל־{max}","hours.title":"שעות שליחה","hours.on":"הודעות נשלחות רק בין השעות שנבחרו (שעון ההתקנה)","hours.off":"ללא הגבלת שעות","hours.from":"משעה","hours.to":"עד שעה","org.title":"שם הארגון בהודעות","org.hint":"מחליף את {organization} בתבניות","account.title":"חשבון השליחה","account.only":"החשבון היחיד","account.choose":"בחרו חשבון","templates.title":"תבניות מאושרות","templates.sub":"{name} מוחלף בשם האדם ו־{organization} בשם הארגון. אי אפשר לכתוב בתבנית קוד גישה או פרטי כניסה.","templates.empty":"אין תבניות · השולחים יוכלו לכתוב הודעה חופשית בלבד","template.label":"שם התבנית","template.body":"נוסח ההודעה","template.counter":"{n}/{max}","template.add":"הוספת תבנית","template.remove":"מחיקת התבנית","template.insert_name":"הוספת שם האדם","template.insert_org":"הוספת שם הארגון","template.new":"תבנית חדשה","consent.title":"אישור קבלת הודעות בקישור","consent.sub":"כשהאפשרות מופעלת, ההודעה הראשונה לאדם שלא ידוע אם הסכים היא בקשת אישור עם קישור. ההודעה המבוקשת נשלחת רק אחרי שהאדם אישר.","consent.switch":"בקשת אישור לפני ההודעה הראשונה","consent.on":"מופעל · אדם שלא אישר מקבל קודם בקשת אישור","consent.off":"כבוי · אפשר לשלוח גם למי שלא ידוע אם הסכים","consent.wait":"ימים להמתנה לתשובה","consent.wait_hint":"בין {min} ל־{max} · בלי תשובה ההודעה לא נשלחת והשולח מקבל התראה","consent.language":"שפת בקשת האישור","consent.lang.he":"עברית","consent.lang.en":"אנגלית","consent.lang.ar":"ערבית (טיוטה)","consent.lang.ru":"רוסית (טיוטה)","consent.wa_template":"שם התבנית המאושרת בוואטסאפ","consent.wa_template_hint":"לפנייה ראשונה. אישור התבנית מול וואטסאפ נעשה על ידי בעל החשבון","consent.wa_language":"קוד השפה של התבנית","consent.rules":"בקשת אישור אחת לאדם בכל {days} יום · עד {held} הודעות ממתינות לאדם","consent.problem.module_off":"הדף הציבורי כבוי · אי אפשר לשלוח בקשת אישור","consent.problem.public_page":"הדף הציבורי אינו זמין או שאין לו כתובת · אי אפשר לשלוח בקשת אישור","consent.problem.key":"מפתח הקישורים חסר · אי אפשר לשלוח בקשת אישור","err.bad_name":"אותיות לטיניות קטנות, ספרות וקו תחתון בלבד","err.bad_language":"קוד שפה לא תקין (למשל he או en_US)","err.template_send_unsupported":"שליחת תבנית וואטסאפ מאושרת עדיין אינה נתמכת - השאירו ריק","consent.no_template":"בקשת האישור נשלחת כהודעת טקסט רגילה. שליחה בתבנית וואטסאפ מאושרת עדיין אינה נתמכת, ולכן אדם שלא כתב לחשבון ב־24 השעות האחרונות עלול לא לקבל אותה",save:"שמירה",saving:"שומר…",revert:"ביטול שינויים",saved:"נשמר",unsaved:"יש שינויים שלא נשמרו",invalid:"יש לתקן את השדות המסומנים",save_failed:"השמירה נכשלה",conflict:"ההגדרות נשמרו בינתיים על ידי מישהו אחר",reload:"טעינה מחדש","err.empty":"חובה למלא","err.too_long":"ארוך מדי","err.control_chars":"יש תווים שאי אפשר להשתמש בהם","err.credential":"אי אפשר לכלול קוד גישה או פרטי כניסה","err.unknown_placeholder":"בין סוגריים מסולסלים מותר {name} ו־{organization} בלבד","err.bad_braces":"סוגריים מסולסלים לא תקינים","err.too_many_placeholders":"יותר מדי מילים להחלפה בתבנית אחת","err.organization_missing":"התבנית משתמשת בשם הארגון והוא לא הוגדר","err.duplicate_label":"יש כבר תבנית בשם הזה","err.range":"מחוץ לטווח המותר","err.type":"יש להזין מספר שלם","err.too_many":"יותר מדי תבניות","err.window_invalid":"יש להזין שעה בתבנית 08:00","err.window_across_midnight":"שעת ההתחלה חייבת להיות לפני שעת הסיום","err.window_empty":"שעת ההתחלה ושעת הסיום זהות","err.other":"ערך לא תקין"},ns={"service.account_not_covered":"The selected account is not in the list the messaging service sent this time (the list is limited) · try again or choose another account","sender.title":"Messages per sender per hour","sender.hint":"Refused messages count too · {min} to {max}","person.title":"Messages per recipient per day","person.hint":"By person and by phone number · {min} to {max}","station.title":"Messages per hour to a station's people","station.hint":"Each station separately · {min} to {max}","hours.title":"Send hours","hours.on":"Messages go out only between these times (installation time)","hours.off":"No time restriction","hours.from":"From","hours.to":"Until","err.window_invalid":"Enter a time like 08:00","err.window_across_midnight":"The start must be earlier than the end","err.window_empty":"The start and the end are the same","err.range":"Out of the allowed range","err.type":"Enter a whole number","err.credential":"An access code or sign-in details cannot be included","err.template_send_unsupported":"Sending an approved WhatsApp template is not supported yet - leave it empty","consent.no_template":"The consent request goes out as a plain text message. An approved WhatsApp template cannot be sent yet, so a person who has not written to the account in the last 24 hours may not receive it","optout.note":'A "do not message me" request applies to messages sent from here only; only a system administrator can clear it.'};function is(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function l(e,t){const s=(is()==="en"?ns[e]:void 0)??ke[e]??e;return t?s.replace(/\{(\w+)\}/g,(i,n)=>n in t?String(t[n]):i):s}const rs=new Set(Object.keys(ke).filter(e=>e.startsWith("err.")).map(e=>e.slice(4)));function os(e){return l(rs.has(e)?`err.${e}`:"err.other")}var ls=Object.defineProperty,cs=Object.getOwnPropertyDescriptor,g=(e,t,s,i)=>{for(var n=i>1?void 0:i?cs(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(i?c(t,s,n):c(n))||n);return i&&n&&ls(t,s,n),n};const ds=["he","en","ar","ru"],ps=e=>e==="module_off"?"consent.problem.module_off":e==="key"?"consent.problem.key":"consent.problem.public_page",fe={from:"08:00",to:"21:00"},H=e=>/^\d+$/.test(e.trim())?Number(e):Number.NaN;let hs=0;const ze=()=>`r${++hs}`;function Q(e){return r`${e.split(/(\{[a-z]+\})/).map(t=>/^\{[a-z]+\}$/.test(t)?r`<bdi class="ltr">${t}</bdi>`:t)}`}const us=e=>({revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:String(e.bulk_max),rate_per_hour:String(e.rate_per_hour),per_sender_per_hour:String(e.per_sender_per_hour??50),per_person_per_day:String(e.per_person_per_day??3),per_station_per_hour:String(e.per_station_per_hour??50),hours_on:e.send_hours!==null,hours_from:(e.send_hours??fe).from,hours_to:(e.send_hours??fe).to,organization:e.organization,account:e.account,templates:e.templates.map(t=>({key:ze(),id:t.id,label:t.label,body:t.body})),consent_by_link:e.consent_by_link===!0,consent_wait_days:String(e.consent_wait_days??7),consent_language:e.consent_language??"he",consent_wa_template:e.consent_wa_template??"",consent_wa_language:e.consent_wa_language??""}),ve=e=>({revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:H(e.bulk_max),rate_per_hour:H(e.rate_per_hour),per_sender_per_hour:H(e.per_sender_per_hour),per_person_per_day:H(e.per_person_per_day),per_station_per_hour:H(e.per_station_per_hour),send_hours:e.hours_on?{from:e.hours_from.trim(),to:e.hours_to.trim()}:null,organization:e.organization,account:e.account,templates:e.templates.map(t=>({...t.id?{id:t.id}:{},label:t.label,body:t.body})),consent_by_link:e.consent_by_link,consent_wait_days:/^\d+$/.test(e.consent_wait_days.trim())?Number(e.consent_wait_days):Number.NaN,consent_language:e.consent_language,consent_wa_template:e.consent_wa_template.trim(),consent_wa_language:e.consent_wa_language.trim()}),ge=e=>JSON.stringify([e.enabled,e.free_text,e.bulk_max.trim(),e.rate_per_hour.trim(),e.per_sender_per_hour.trim(),e.per_person_per_day.trim(),e.per_station_per_hour.trim(),e.hours_on,e.hours_from.trim(),e.hours_to.trim(),e.organization.trim(),e.account,e.templates.map(t=>[t.id??"",t.label.trim(),t.body.trim()]),e.consent_by_link,e.consent_wait_days.trim(),e.consent_language,e.consent_wa_template.trim(),e.consent_wa_language.trim()]);let f=class extends M{constructor(){super(...arguments),this.rev=0,this.reply=null,this.draft=null,this.base="",this.loading=!0,this.failed="",this.saving=!1,this.notice="",this.noticeText="",this.submitted=!1,this.touched=new Set,this.remote=[],this.lastRev=0,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.load())}async load(){const e=++this.gen;this.failed="";try{const t=await gt();if(e!==this.gen)return;this.adopt(t)}catch(t){if(e!==this.gen)return;this.failed=V(t)}finally{e===this.gen&&(this.loading=!1)}}adopt(e){this.reply=e,this.draft=us(e.settings),this.base=ge(this.draft),this.submitted=!1,this.touched=new Set,this.remote=[],this.notice=""}set(e,t=""){this.draft&&(this.draft={...this.draft,...e},this.notice="",this.remote=[],t&&(this.touched=new Set([...this.touched,t])))}setRow(e,t,s){this.draft&&this.set({templates:this.draft.templates.map((i,n)=>n===e?{...i,...t}:i)},`templates.${e}.${s}`)}addRow(){this.draft&&this.set({templates:[...this.draft.templates,{key:ze(),label:l("template.new"),body:""}]})}removeRow(e){this.draft&&(this.set({templates:this.draft.templates.filter((t,s)=>s!==e)}),this.touched=new Set)}insert(e,t,s){if(!this.draft)return;const i=this.draft.templates[e],n=as(i.body,t,s?.selectionStart??null,s?.selectionEnd??null);this.setRow(e,{body:n.text},"body"),this.updateComplete.then(()=>{s?.focus(),s?.setSelectionRange(n.caret,n.caret)})}revert(){this.reply&&this.adopt(this.reply),this.notice=""}get dirty(){return!!this.draft&&ge(this.draft)!==this.base}problems(){if(!this.draft)return[];const e=ts(ve(this.draft),this.reply?.limits??xe);return[...e,...this.remote.filter(t=>!e.some(s=>s.path===t.path))]}async save(){if(!(!this.draft||this.saving)&&(this.submitted=!0,!this.problems().length)){this.saving=!0,this.notice="";try{const e=await bt(ve(this.draft));this.adopt(e),this.notice="saved"}catch(e){const t=wt(e);t?(this.remote=t,this.notice="failed",this.noticeText=l("invalid")):_t(e)?this.notice="conflict":(this.notice="failed",this.noticeText=`${l("save_failed")} · ${V(e)}`)}finally{this.saving=!1}}}shown(e){return this.submitted||this.touched.has(e)?ss(this.problems(),e):[]}problemLine(e){const t=this.shown(e);return t.length?r`<div class="problem" role="alert" data-msg-problem=${t[0].code} data-msg-problem-path=${e}><sw-icon name="warning" size=${14}></sw-icon><span>${Q(os(t[0].code))}</span></div>`:d}capField(e,t,s){const i=this.draft;return r`<div>
      <sw-field label=${l(`${t}.title`)} hint=${l(`${t}.hint`,{min:s[0],max:s[1]})} ?data-bad=${this.shown(e).length>0}>
        <input type="text" inputmode="numeric" .value=${i[e]} data-msg-setting=${e} @input=${n=>this.set({[e]:n.target.value},e)} />
      </sw-field>
      ${this.problemLine(e)}
    </div>`}serviceLine(e){const t=e.service;let s="ok",i;if(t.problem)s="warn",i=l(`service.${t.problem}`);else if(t.connected===!0){const n=t.accounts.length===1?t.accounts[0].name:t.accounts.find(o=>o.id===this.draft?.account)?.name;i=n?`${l("service.connected")} · ${l("service.account",{name:n})}`:l("service.connected")}else t.connected===!1?(s="warn",i=t.state==="unsupported"?l("service.unsupported"):l("service.not_connected")):(s="muted",i=l("service.unknown"));return r`<div class="svc" data-msg-service=${t.connected===!0&&!t.problem?"connected":t.connected===!1?"not_connected":"unknown"}><span class="dot ${s}"></span><span>${i}</span></div>`}renderTemplate(e,t,s){const i=this.shown(`templates.${t}.label`),n=this.shown(`templates.${t}.body`);return r`<div class="tpl" data-msg-template-row=${t} data-msg-template-key=${e.id??"new"}>
      <div class="tpl-head">
        <sw-field label=${l("template.label")} ?data-bad=${i.length>0}>
          <input type="text" maxlength=${s.label_max*2} .value=${e.label} data-msg-template-label @input=${o=>this.setRow(t,{label:o.target.value},"label")} />
        </sw-field>
        <sw-button variant="ghost" iconOnly icon="trash" label=${l("template.remove")} data-msg-template-remove @click=${()=>this.removeRow(t)}></sw-button>
      </div>
      ${this.problemLine(`templates.${t}.label`)}
      <sw-field label=${l("template.body")} ?data-bad=${n.length>0}>
        <textarea rows="4" .value=${e.body} data-msg-template-body @input=${o=>this.setRow(t,{body:o.target.value},"body")}></textarea>
      </sw-field>
      ${this.problemLine(`templates.${t}.body`)}
      <div class="tpl-foot">
        <div class="chips">
          <button type="button" class="chipbtn" data-msg-insert="name" @click=${o=>this.insert(t,"{name}",this.textareaOf(o))}>${l("template.insert_name")}</button>
          <button type="button" class="chipbtn" data-msg-insert="organization" @click=${o=>this.insert(t,"{organization}",this.textareaOf(o))}>${l("template.insert_org")}</button>
        </div>
        <span class="cnt" aria-hidden="true">${l("template.counter",{n:e.body.length,max:s.body_max})}</span>
      </div>
    </div>`}textareaOf(e){return e.currentTarget.closest(".tpl")?.querySelector("textarea")??null}renderConsent(e,t){const s=t.consent,i=s?.page_problem??null;return r`<sw-card flush data-msg-settings-card="consent">
      <div class="ch"><div><h3>${l("consent.title")}</h3><div class="sub">${l("consent.sub")}</div></div></div>
      <button type="button" class="sw" role="switch" aria-checked=${String(e.consent_by_link)} data-msg-setting="consent_by_link" @click=${()=>this.set({consent_by_link:!e.consent_by_link},"consent_by_link")}>
        <span class="txt"><span class="t">${l("consent.switch")}</span><span class="x">${e.consent_by_link?l("consent.on"):l("consent.off")}</span></span>
        <span class="track" aria-hidden="true"></span>
      </button>
      ${this.problemLine("consent_by_link")}
      ${e.consent_by_link&&i?r`<div class="note err" role="alert" data-msg-consent-problem=${i}><sw-icon name="warning" size=${16}></sw-icon><span>${l(ps(i))}</span></div>`:d}
      <div class="fields">
        <div>
          <sw-field label=${l("consent.wait")} hint=${l("consent.wait_hint",{min:s?.wait_days[0]??1,max:s?.wait_days[1]??30})} ?data-bad=${this.shown("consent_wait_days").length>0}>
            <input type="text" inputmode="numeric" .value=${e.consent_wait_days} data-msg-setting="consent_wait_days" @input=${n=>this.set({consent_wait_days:n.target.value},"consent_wait_days")} />
          </sw-field>
          ${this.problemLine("consent_wait_days")}
        </div>
        <div>
          <sw-field label=${l("consent.language")}>
            <select data-msg-setting="consent_language" @change=${n=>this.set({consent_language:n.target.value})}>
              ${ds.map(n=>r`<option value=${n} ?selected=${e.consent_language===n}>${l(`consent.lang.${n}`)}</option>`)}
            </select>
          </sw-field>
        </div>
        ${s?.template_send_supported===!1?d:r`<div>
          <sw-field label=${l("consent.wa_template")} hint=${l("consent.wa_template_hint")} ?data-bad=${this.shown("consent_wa_template").length>0}>
            <input type="text" dir="ltr" .value=${e.consent_wa_template} data-msg-setting="consent_wa_template" @input=${n=>this.set({consent_wa_template:n.target.value},"consent_wa_template")} />
          </sw-field>
          ${this.problemLine("consent_wa_template")}
        </div>
        <div>
          <sw-field label=${l("consent.wa_language")} ?data-bad=${this.shown("consent_wa_language").length>0}>
            <input type="text" dir="ltr" .value=${e.consent_wa_language} data-msg-setting="consent_wa_language" @input=${n=>this.set({consent_wa_language:n.target.value},"consent_wa_language")} />
          </sw-field>
          ${this.problemLine("consent_wa_language")}
        </div>`}
      </div>
      ${s?.template_send_supported===!1?r`<div class="hint" data-msg-consent-no-template>${l("consent.no_template")}</div>`:d}
      <div class="hint" data-msg-consent-rules>${l("consent.rules",{days:s?.resend_days??30,held:s?.held_per_person??3})}</div>
    </sw-card>`}render(){if(this.loading)return r`<div class="stack" data-access-status="loading"><sw-card flush>${S(4)}</sw-card></div>`;if(!this.draft||!this.reply)return r`<div class="stack" data-access-status="error">${b("error",this.failed,()=>void this.load())}</div>`;const e=this.draft,t=this.reply,s=t.limits,i=t.service.accounts,n=this.dirty,o=this.submitted&&this.problems().length>0;return r`<div class="stack" data-access-status="ready" data-msg-settings>
      <sw-card flush data-msg-settings-card="general">
        <div class="ch"><div><h3>${l("title")}</h3><div class="sub">${l("sub")}</div></div></div>
        ${this.serviceLine(t)}
        <button type="button" class="sw" role="switch" aria-checked=${String(e.enabled)} data-msg-setting="enabled" @click=${()=>this.set({enabled:!e.enabled})}>
          <span class="txt"><span class="t">${l("enabled.title")}</span><span class="x">${e.enabled?l("enabled.on"):l("enabled.off")}</span></span>
          <span class="track" aria-hidden="true"></span>
        </button>
        <button type="button" class="sw" role="switch" aria-checked=${String(e.free_text)} data-msg-setting="free_text" @click=${()=>this.set({free_text:!e.free_text})}>
          <span class="txt"><span class="t">${l("free.title")}</span><span class="x">${e.free_text?l("free.on"):l("free.off")}</span></span>
          <span class="track" aria-hidden="true"></span>
        </button>
        <div class="hint" data-msg-optout-note>${l("optout.note")}</div>
        <div class="fields">
          <div>
            <sw-field label=${l("bulk.title")} hint=${l("bulk.hint",{min:s.bulk_max[0],max:s.bulk_max[1]})} ?data-bad=${this.shown("bulk_max").length>0}>
              <input type="text" inputmode="numeric" .value=${e.bulk_max} data-msg-setting="bulk_max" @input=${c=>this.set({bulk_max:c.target.value},"bulk_max")} />
            </sw-field>
            ${this.problemLine("bulk_max")}
          </div>
          <div>
            <sw-field label=${l("rate.title")} hint=${l("rate.hint",{min:s.rate_per_hour[0],max:s.rate_per_hour[1]})} ?data-bad=${this.shown("rate_per_hour").length>0}>
              <input type="text" inputmode="numeric" .value=${e.rate_per_hour} data-msg-setting="rate_per_hour" @input=${c=>this.set({rate_per_hour:c.target.value},"rate_per_hour")} />
            </sw-field>
            ${this.problemLine("rate_per_hour")}
          </div>
          ${this.capField("per_sender_per_hour","sender",s.per_sender_per_hour??[1,1e3])}
          ${this.capField("per_person_per_day","person",s.per_person_per_day??[1,50])}
          ${this.capField("per_station_per_hour","station",s.per_station_per_hour??[1,1e3])}
          <div data-msg-send-hours>
            <button type="button" class="sw" role="switch" aria-checked=${String(e.hours_on)} data-msg-setting="send_hours" @click=${()=>this.set({hours_on:!e.hours_on},"send_hours")}>
              <span class="txt"><span class="t">${l("hours.title")}</span><span class="x">${e.hours_on?l("hours.on"):l("hours.off")}</span></span>
              <span class="track" aria-hidden="true"></span>
            </button>
            ${e.hours_on?r`<div class="fields">
                  <sw-field label=${l("hours.from")} ?data-bad=${this.shown("send_hours").length>0}>
                    <input type="time" lang=${ne()} class="ltr" .value=${e.hours_from} data-msg-setting="send_hours_from" @input=${c=>this.set({hours_from:c.target.value},"send_hours")} />
                  </sw-field>
                  <sw-field label=${l("hours.to")} ?data-bad=${this.shown("send_hours").length>0}>
                    <input type="time" lang=${ne()} class="ltr" .value=${e.hours_to} data-msg-setting="send_hours_to" @input=${c=>this.set({hours_to:c.target.value},"send_hours")} />
                  </sw-field>
                </div>`:d}
            ${this.problemLine("send_hours")}
          </div>
          <div>
            <sw-field label=${l("org.title")} ?data-bad=${this.shown("organization").length>0}>
              <input type="text" .value=${e.organization} data-msg-setting="organization" @input=${c=>this.set({organization:c.target.value},"organization")} />
            </sw-field>
            <div class="hint" data-msg-org-hint>${Q(l("org.hint"))}</div>
            ${this.problemLine("organization")}
          </div>
          ${i.length>1?r`<div>
                <sw-field label=${l("account.title")}>
                  <select data-msg-setting="account" @change=${c=>this.set({account:c.target.value})}>
                    <option value="" ?selected=${e.account===""}>${l("account.choose")}</option>
                    ${i.map(c=>r`<option value=${c.id} ?selected=${e.account===c.id}>${c.name}</option>`)}
                  </select>
                </sw-field>
              </div>`:d}
        </div>
      </sw-card>

      ${this.renderConsent(e,t)}

      <sw-card flush data-msg-settings-card="templates">
        <div class="ch">
          <div><h3>${l("templates.title")}</h3><div class="sub">${Q(l("templates.sub"))}</div></div>
          <div class="ctl"><sw-button icon="plus" data-msg-template-add ?disabled=${e.templates.length>=s.templates_max} @click=${()=>this.addRow()}>${l("template.add")}</sw-button></div>
        </div>
        ${this.problemLine("templates")}
        ${e.templates.length===0?r`<div class="empty" data-msg-templates-empty>${l("templates.empty")}</div>`:e.templates.map((c,h)=>this.renderTemplate(c,h,s))}
      </sw-card>

      <div class="actions" data-msg-actions>
        <span class="grow">
          ${this.notice==="saved"?r`<span class="note info" role="status" data-msg-notice="saved"><sw-icon name="check" size=${16}></sw-icon><span>${l("saved")}</span></span>`:d}
          ${this.notice==="failed"?r`<span class="note err" role="alert" data-msg-notice="failed"><sw-icon name="warning" size=${16}></sw-icon><span>${this.noticeText}</span></span>`:d}
          ${this.notice==="conflict"?r`<span class="note stale" role="alert" data-msg-notice="conflict"><sw-icon name="warning" size=${16}></sw-icon><span>${l("conflict")}</span><sw-button size="sm" data-msg-reload @click=${()=>void this.load()}>${l("reload")}</sw-button></span>`:d}
          ${this.notice===""&&o?r`<span class="note err" role="alert" data-msg-notice="invalid"><sw-icon name="warning" size=${16}></sw-icon><span>${l("invalid")}</span></span>`:d}
          ${this.notice===""&&!o&&n?r`<span class="note info" data-msg-notice="unsaved"><span>${l("unsaved")}</span></span>`:d}
        </span>
        <sw-button data-msg-revert ?disabled=${!n||this.saving} @click=${()=>this.revert()}>${l("revert")}</sw-button>
        <sw-button variant="primary" data-msg-save ?disabled=${!n||this.saving} @click=${()=>void this.save()}>${this.saving?l("saving"):l("save")}</sw-button>
      </div>
    </div>`}};f.styles=[G,P`
      .sw {
        display: flex;
        align-items: center;
        gap: 14px;
        inline-size: 100%;
        min-block-size: max(64px, var(--_t));
        padding: 10px 14px;
        box-sizing: border-box;
        border: 0;
        border-block-start: 1px solid var(--sw-border);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: start;
        cursor: pointer;
      }
      .sw:disabled {
        cursor: default;
        opacity: var(--sw-disabled-opacity);
      }
      .sw:not(:disabled):hover {
        background: var(--sw-hover-wash);
      }
      .sw:focus-visible {
        outline-offset: -2px;
      }
      .sw .txt {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .sw .t {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
      }
      .sw .x {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .track {
        flex: none;
        position: relative;
        inline-size: 42px;
        block-size: 24px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-border-strong);
        transition: background var(--sw-t-fast) var(--sw-ease);
      }
      .track::after {
        content: '';
        position: absolute;
        inset-block-start: 3px;
        inset-inline-start: 3px;
        inline-size: 18px;
        block-size: 18px;
        border-radius: 50%;
        background: var(--sw-toggle-thumb);
        box-shadow: var(--sw-shadow-1);
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .sw[aria-checked='true'] .track {
        background: var(--sw-toggle-on);
      }
      .sw[aria-checked='true'] .track::after {
        transform: translateX(-18px);
      }
      :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after {
        transform: translateX(18px);
      }
      @media (prefers-reduced-motion: reduce) {
        .track,
        .track::after {
          transition: none;
        }
      }
      .svc {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px 12px;
        color: var(--sw-text-2);
        font-size: var(--sw-fs-sm);
      }
      .fields {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        padding: 14px;
        border-block-start: 1px solid var(--sw-border);
      }
      @media (max-width: 900px) {
        .fields {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .tpl {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        border-block-start: 1px solid var(--sw-border);
      }
      .tpl-head {
        display: flex;
        align-items: flex-end;
        gap: 10px;
      }
      .tpl-head sw-field {
        flex: 1;
        min-inline-size: 0;
      }
      .tpl-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px 12px;
      }
      .tpl-foot .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .hint {
        margin-block-start: 6px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
      }
      /* a hint that is a direct line of a flush card (the opt-out note, the consent rules) takes the card's 14 px gutter: with none
         it sat on the card's edge and, as the consent card's last line, inside the rounded corner of the round skins (2.7.0 gate) */
      sw-card > .hint {
        padding-inline: 14px;
        padding-block-end: 12px;
      }
      .ltr {
        direction: ltr;
        unicode-bidi: isolate;
      }
      .cnt {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        font-variant-numeric: tabular-nums;
      }
      input,
      textarea,
      select {
        font: inherit;
      }
      textarea {
        min-block-size: 96px;
        resize: vertical;
        line-height: 1.5;
      }
      .problem {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--sw-danger-text);
        font-size: var(--sw-fs-sm);
      }
      sw-field[data-bad] ::slotted(input),
      sw-field[data-bad] ::slotted(textarea),
      sw-field[data-bad] ::slotted(select) {
        border-color: var(--sw-danger);
      }
      .actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px 12px;
        justify-content: flex-end;
      }
      .actions .grow {
        flex: 1 1 14rem;
        min-inline-size: 0;
      }
      /* POLISH4-WP8 (owner Q7): the page is a long settings document; on a phone its save row stays in view while it scrolls under it
         (the settings kit's .foot.sticky look, styles/settings.ts) */
      @media (max-width: 767px) {
        .actions {
          position: sticky;
          inset-block-end: var(--sw-s-2);
          z-index: 3;
          padding: 10px var(--sw-s-2);
          border: 1px solid var(--sw-border-strong);
          border-radius: var(--sw-r-lg);
          background: var(--sw-surface-solid);
          box-shadow: var(--sw-shadow-3);
        }
        /* GATE2370-D: the sticky bar is one line of keys. The status span's 14rem basis pushed the keys onto two stacked lines under an
           empty strip (a 120 px bar over the form); on a phone the status takes its own line only while it says something */
        .actions .grow {
          flex: 1 1 100%;
        }
        .actions .grow:not(:has(.note)) {
          display: none;
        }
      }
      sw-button {
        min-block-size: var(--_t);
      }
    `,Z,q];g([z({type:Number})],f.prototype,"rev",2);g([u()],f.prototype,"reply",2);g([u()],f.prototype,"draft",2);g([u()],f.prototype,"base",2);g([u()],f.prototype,"loading",2);g([u()],f.prototype,"failed",2);g([u()],f.prototype,"saving",2);g([u()],f.prototype,"notice",2);g([u()],f.prototype,"noticeText",2);g([u()],f.prototype,"submitted",2);g([u()],f.prototype,"touched",2);g([u()],f.prototype,"remote",2);f=g([N("system-access-messaging")],f);var ms=Object.defineProperty,fs=Object.getOwnPropertyDescriptor,R=(e,t,s,i)=>{for(var n=i>1?void 0:i?fs(t,s):t,o=e.length-1,c;o>=0;o--)(c=e[o])&&(n=(i?c(t,s,n):c(n))||n);return i&&n&&ms(t,s,n),n};let $=class extends M{constructor(){super(...arguments),this.view="",this.rev=0,this.meta=null,this.zone=X,this.admin=!0,this.wide=!0,this.people=!0,this.configure=!1,this.stop=null,this.onMeta=e=>{const t=e.detail;this.meta=t.meta,this.zone=t.zone}}connectedCallback(){super.connectedCallback(),this.sync(),this.stop=we(()=>this.sync())}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}sync(){const e=B();this.admin=e.admin,this.people=e.people,this.wide=!y()||j("access.admin.read"),this.configure=y()&&j("system.configure")}segments(){const e=[{id:"status",label:a("segStatus")}];return this.wide&&e.push({id:"audit",label:a("segAudit")}),(this.people||this.wide)&&e.push({id:"groups",label:a("segGroups")}),this.configure&&e.push({id:"policy",label:a("segPolicy")}),this.configure&&e.push({id:"messaging",label:l("segment")}),e}active(e){return e.find(t=>t.id===this.view)?.id??"status"}subtitle(){if(!this.meta)return"";const e=mt(this.meta,new Date,this.zone);return[e.version?a("hlVersion",{v:e.version}):"",e.connected===!0?a("hlConnected"):e.connected===!1?a("hlDisconnected"):"",e.checked.key!=="none"?a("hlChecked",{when:_(e.checked)}):""].filter(Boolean).join(" · ")}render(){if(y()&&!this.admin)return r`<sw-page heading=${a("title")}><sw-state-panel quiet data-access-state="no_permission" state="forbidden" heading=${a("noPermission")}></sw-state-panel></sw-page>`;const e=this.segments(),t=this.active(e),s=e.map(i=>({id:i.id,label:i.label,href:`${Re}${i.id==="status"?"":`/${i.id}`}`}));return r`<sw-page heading=${a("title")} subheading=${this.subtitle()} wide>
      <sw-button slot="actions" size="lg" variant="ghost" icon="refresh" data-access-refresh @click=${()=>this.rev+=1}>${a("refresh")}</sw-button>
      ${e.length>1?r`<div class="segs"><sw-tabs .items=${s} .active=${t} .variant=${Ce(null,2)} group-label=${a("segments")} data-access-segments></sw-tabs></div>`:d}
      <div class="body" data-access-segment=${t}>
        ${t==="audit"?r`<system-access-audit .rev=${this.rev} @access-meta=${this.onMeta}></system-access-audit>`:t==="groups"?r`<system-access-groups .rev=${this.rev} @access-meta=${this.onMeta}></system-access-groups>`:t==="policy"?r`<system-access-policy .rev=${this.rev}></system-access-policy>`:t==="messaging"?r`<system-access-messaging .rev=${this.rev}></system-access-messaging>`:r`<system-access-status .rev=${this.rev} @access-meta=${this.onMeta}></system-access-status>`}
      </div>
    </sw-page>`}};$.styles=[Ae,P`
      :host {
        display: block;
        --_t: var(--sw-touch-desktop, 44px);
        --sw-ctl-h-sm: var(--_t);
        --sw-ctl-h-md: var(--_t);
        --sw-ctl-h-lg: var(--_t);
      }
      @media (max-width: 1100px) {
        :host {
          --_t: max(44px, var(--sw-touch-desktop, 44px));
        }
      }
      .segs {
        display: flex;
        min-inline-size: 0;
      }
      .body {
        display: block;
        min-inline-size: 0;
      }
    `,q];R([z()],$.prototype,"view",2);R([u()],$.prototype,"rev",2);R([u()],$.prototype,"meta",2);R([u()],$.prototype,"zone",2);R([u()],$.prototype,"admin",2);R([u()],$.prototype,"wide",2);R([u()],$.prototype,"people",2);R([u()],$.prototype,"configure",2);$=R([N("system-access-control")],$);export{$ as SystemAccessControl};
//# sourceMappingURL=system-access-control-r2-AQwxj.js.map
