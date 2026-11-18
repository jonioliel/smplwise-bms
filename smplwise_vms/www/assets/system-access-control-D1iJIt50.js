import{g as P,ay as T,i as j,b as o,A as c,k as E,aU as W,j as u,a3 as b,aB as U,cA as Oe,b4 as Ae,n as q,bo as Ke,bn as Je,bs as Ge,bE as Pe,cG as je,cE as Ee,eb as Be,a7 as ue,d as me,bc as ve,ei as ge,yw as Ze,er as Ve}from"./index-CkOaAZ0k.js";import"./wk-deep-links-5GOAP5yw.js";import"./sw-table-Bl6m_rem.js";import{c as Ye,d as Qe,b as le,e as Xe,a as et,g as tt,A as st,f as at,h as nt,i as it}from"./access-status-C5pUdEN3.js";import{R as y,b as n,m as Me,c as ae,d as D,e as fe,g as F,h as I,y as we,i as ot,j as rt,k as lt,l as ct,n as $,o as k,p as dt,q as pt,r as ht,t as ut,u as mt,v as vt,f as _,x as gt,z as ft,A as wt,B as _t,C as bt,D as yt,E as $t,F as _e,s as S,G as xt,H as kt,I as St,J as zt,K as Tt,L as Rt,M as Ct,N as be,O as ye,P as Ot,Q as At,S as Pt,T as jt,U as Et,w as Ne,a as qe,V as Mt,W as Nt,X as qt,Y as Lt,Z as Dt,_ as Ft,$ as It,a0 as $e,a1 as Ut,a2 as Wt,a3 as Ht}from"./status-text-DkmhIoV2.js";import{c as xe,l as Kt}from"./events-logic-DWvSq8p-.js";import{s as H,C as v}from"./status-css-DFUhvlsc.js";import{U as te}from"./wiskey-format-D8sxb_B6.js";import{p as Le,s as Z,l as re,h as Jt,g as Gt,a as Bt,b as Zt,i as Vt}from"./access-messaging-BikuqKTL.js";import{a as ee}from"./access-CpI49Dds.js";import{b as Yt}from"./settings-mBGpMa3Z.js";import"./sw-logo-art-MaHPMZFI.js";import"./deep-links-BGf3Jxzm.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";import"./wiskey-Du_2sjw3.js";import"./wiskey-profiles-BGr9zVek.js";var Qt=Object.defineProperty,Xt=Object.getOwnPropertyDescriptor,Y=(e,t,s,i)=>{for(var a=i>1?void 0:i?Xt(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Qt(t,s,a),a};const es={ok:"ok",warn:"warn",err:"err",off:"off",unk:"unk"};let L=class extends j{constructor(){super(...arguments),this.station=null,this.zone={kind:"iana",name:"UTC"},this.rev=0,this.now=new Date,this.health=null,this.history=null,this.ctl=null,this.loadedFor="",this.lastRev=0}willUpdate(e){const t=this.station?.id??"";if(t&&(t!==this.loadedFor||e.has("rev")&&this.rev!==this.lastRev)){const s=t===this.loadedFor;this.lastRev=this.rev,s?(this.health?.reload(),this.history?.reload()):this.start(t)}}disconnectedCallback(){this.stop(),super.disconnectedCallback()}start(e){this.stop(),this.loadedFor=e,this.ctl=new AbortController;const t=this.ctl.signal;this.health=new y({fetch:()=>Ye(e,t),pick:s=>s.health,onChange:()=>this.requestUpdate()}),this.history=new y({fetch:()=>Qe(e,t),pick:s=>s.history,onChange:()=>this.requestUpdate()}),this.health.reload(),this.history.reload()}stop(){this.ctl?.abort(),this.health?.dispose(),this.history?.dispose(),this.health=null,this.history=null,this.loadedFor=""}row(e,t){return o`<dt>${e}</dt><dd>${t}</dd>`}tone(e,t){return o`<span class="with"><span class="dot ${es[e]}" aria-hidden="true"></span>${t}</span>`}connection(e){const t=e.requests,s=e.online;return o`<section class="sect" data-health-section="connection">
      <h4>${n("hdConnection")}</h4>
      <dl>
        ${this.row(n("hdState"),s===null?"—":this.tone(s?"ok":"off",s?n("hdOnline"):n("hdOffline")))}
        ${this.row(n("hdFirmware"),o`<bdi class="ltr">${Me(null,e.firmware)||"—"}</bdi>`)}
        ${this.row(n("hdPollFailures"),e.consecutive_poll_failures===null?"—":String(e.consecutive_poll_failures))}
        ${this.row(n("hdRequests"),t.requests===null?"—":n("hdRequestsVal",{n:t.requests,f:t.failures??0}))}
        ${this.row(n("hdLastMs"),ae(t.last_ms))}
        ${this.row(n("hdP95"),ae(t.p95_ms))}
      </dl>
    </section>`}access(e){const t=e.access,s=D(t.sync_state,!0),i=fe(t.assignment_states,r=>F(D(r,!0).word)),a=fe(t.errors,r=>I(r));return o`<section class="sect" data-health-section="sync">
      <h4>${n("hdSync")}</h4>
      <dl>
        ${this.row(n("hdSyncState"),o`<sw-badge kind=${s.kind} label=${F(s.word)}></sw-badge>`)}
        ${t.last_error?this.row(n("colError"),I(t.last_error)):c}
        ${this.row(n("hdQueue"),t.queue_depth===null?"—":String(t.queue_depth))}
        ${this.row(n("hdWorker"),we(t.worker_active))}
        ${this.row(n("hdPendingRequest"),we(t.pending_request))}
        ${i?this.row(n("hdAssignments"),i):c}
        ${a?this.row(n("hdErrors"),a):c}
      </dl>
    </section>`}events(e){const t=e.events;return t?o`<section class="sect" data-health-section="events">
      <h4>${n("hdEvents")}</h4>
      <dl>
        ${this.row(n("hdStream"),this.tone(ot(t.stream),rt(t.stream)))}
        ${this.row(n("hdHistoryState"),this.tone(lt(t.history),ct(t.history)))}
        ${this.row(n("hdReconnects"),t.reconnects===null?"—":String(t.reconnects))}
        ${this.row(n("hdLastFrame"),$(k(t.last_frame_at,this.now,this.zone)))}
        ${t.storage_failed?this.row(n("hdStorageFailed"),n("hdYes")):c}
      </dl>
    </section>`:o`<section class="sect" data-health-section="events"><h4>${n("hdEvents")}</h4><div class="none">${n("hdNoEvents")}</div></section>`}clock(e){const t=e.clock;return t?o`<section class="sect" data-health-section="clock">
      <h4>${n("hdClock")}</h4>
      <dl>
        ${this.row(n("hdClockStatus"),this.tone(dt(t.status),pt(t.status)))}
        ${this.row(n("hdSkew"),ht(t.skew_seconds))}
        ${this.row(n("hdDrift"),this.tone(ut(t.drift_state),mt(t.drift_state)))}
        ${this.row(n("hdTimeMode"),vt(t.time_mode))}
        ${this.row(n("hdChecked"),$(k(t.checked_at,this.now,this.zone)))}
        ${t.error?this.row(n("hdClockError"),I(t.error)):c}
      </dl>
    </section>`:o`<section class="sect" data-health-section="clock"><h4>${n("hdClock")}</h4><div class="none">${n("hdNoClock")}</div></section>`}strip(){const e=this.history,t=e?.snap;if(!e||!t||t.busy&&!t.data)return o`<section class="sect sk-box" data-health-section="history"><h4>${n("hdHistory")}</h4><span class="sk"></span></section>`;if(!t.data)return o`<section class="sect" data-health-section="history"><h4>${n("hdHistory")}</h4>${t.failure&&t.failure!=="forbidden"?_(t.failure,t.message,()=>void e.reload(),!0):c}</section>`;const s=gt(t.data.records,this.zone,this.now),i=s.some(a=>a.samples>0);return o`<section class="sect" data-health-section="history">
      <h4>${n("hdHistory")}</h4>
      ${i?o`<div class="strip" data-health-strip>
            ${s.map(a=>{const r=`${xe(a.date).replace(/\.\d{4}$/,"")}${a.onlinePct===null?"":` · ${n("hdHistoryPct",{p:a.onlinePct})}`}${a.pollMs===null?"":` · ${ae(a.pollMs)}`}`;return o`<div class="day ${a.tone}" role="img" aria-label=${r} title=${r} data-health-day=${a.date}><span class="bar"></span><span class="pct">${a.onlinePct===null?"—":`${a.onlinePct}%`}</span><span class="dt">${xe(a.date).replace(/\.\d{4}$/,"")}</span></div>`})}
          </div>`:o`<div class="none">${n("hdHistoryNone")}</div>`}
      ${t.data.storage_failed?o`<div class="none">${n("hdHistoryStorage")}</div>`:c}
    </section>`}render(){if(!this.station)return c;const t=this.health,s=t?.snap;if(!t||!s||s.busy&&!s.data)return o`<section class="sect sk-box" data-health-loading aria-busy="true"><span class="sk"></span><span class="sk"></span><span class="sk"></span></section>`;if(!s.data)return o`${s.failure?_(s.failure,s.message,()=>void t.reload(),!0):c}`;const i=t.stale;return o`
      ${i?o`<div class="note" role="status" data-health-stale><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt?n("stale",{t:$(k(s.fetchedAt,this.now,this.zone))}):n("staleNever")}</span></div>`:c}
      ${this.connection(s.data)}${this.access(s.data)}${this.events(s.data)}${this.clock(s.data)}${this.strip()}
    `}};L.styles=P`
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
  `;Y([T({attribute:!1})],L.prototype,"station",2);Y([T({attribute:!1})],L.prototype,"zone",2);Y([T({type:Number})],L.prototype,"rev",2);Y([T({attribute:!1})],L.prototype,"now",2);L=Y([E("system-access-health")],L);const Q=P`
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
`;var ts=Object.defineProperty,ss=Object.getOwnPropertyDescriptor,K=(e,t,s,i)=>{for(var a=i>1?void 0:i?ss(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&ts(t,s,a),a};const as=6e4;let C=class extends j{constructor(){super(...arguments),this.rev=0,this.selected="",this.kind="",this.muted=!1,this.wide=!0,this.timer=0,this.stopSession=null,this.lastMeta="",this.lastRev=0,this.nameOf=e=>this.stationsRes.snap.data?.find(t=>t.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.stationsRes=new y({fetch:()=>le(),pick:t=>t.stations,onChange:e}),this.syncRes=new y({fetch:()=>Xe(),pick:t=>t.sync_status,onChange:e}),this.alertsRes=new y({fetch:t=>et({kind:this.kind,includeSuppressed:this.muted,offset:typeof t=="number"?t:0}),pick:t=>t.alerts,merge:ft,cursorOf:t=>t.next_offset,onChange:e}),this.conflictsRes=new y({fetch:()=>tt(),pick:t=>t.conflicts,onChange:e}),this.wide=!b()||U("access.admin.read"),this.stopSession=Oe(()=>{const t=!b()||U("access.admin.read");t!==this.wide&&(this.wide=t,this.reloadAll())}),this.reloadAll(),this.timer=window.setInterval(()=>{(typeof document>"u"||document.visibilityState==="visible")&&this.reloadAll()},as)}disconnectedCallback(){window.clearInterval(this.timer),this.stopSession?.();for(const e of[this.stationsRes,this.syncRes,this.alertsRes,this.conflictsRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),this.syncRes.reload(),this.alertsRes.reload(),this.wide&&this.conflictsRes.reload()}emitMeta(){const e=this.stationsRes?.snap.reply?.sync??this.syncRes?.snap.reply?.sync??this.alertsRes?.snap.reply?.sync??null,t=JSON.stringify(e);t!==this.lastMeta&&(this.lastMeta=t,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.defaultZone()},bubbles:!0,composed:!0})))}defaultZone(){return this.stationsRes?.snap.reply?.default_zone??te}zoneOf(e){return wt(this.stationsRes.snap.data,e,this.defaultZone())}tiles(e){const t=_t(this.stationsRes.snap.data,this.syncRes.snap.data,this.wide?this.conflictsRes.snap.data:null),s=this.defaultZone(),i=(a,r,l,h="",p="")=>o`<div class="tile" data-access-tile=${a}><span class="k">${r?n(r):""}</span><span class="v ${p}">${l}</span>${h?o`<span class="d">${h}</span>`:o`<span class="d">&nbsp;</span>`}</div>`;return o`<div class="tiles" data-access-tiles>
      ${i("online","kpiOnline",String(t.online),n("kpiOnlineOf",{total:t.total}),t.total>0&&t.online<t.total?"warn":"")}
      ${i("pending","kpiPending",t.pending===null?"—":String(t.pending),"",(t.pending??0)>0?"warn":"")}
      ${t.conflicts===null?c:i("conflicts","kpiConflicts",String(t.conflicts),"",t.conflicts>0?"err":"")}
      ${i("last-sync","kpiLastSync",t.lastSync?Kt(t.lastSync,s):"—",t.lastSync?$(k(t.lastSync,e,s)):"")}
    </div>`}stationRow(e,t){const s=bt(e),i=D(e.sync_state,e.online),a=Me(e.technical?.model,e.technical?.firmware);return o`<button type="button" class="row two" data-access-station=${e.id} aria-label=${n("healthOpen",{name:e.name})} @click=${()=>this.selected=e.id}>
      <span class="dot ${s}" aria-hidden="true"></span>
      <span class="main"><span class="t">${e.name}</span>${a?o`<span class="s"><bdi class="ltr">${a}</bdi></span>`:c}</span>
      <span class="side"><sw-badge kind=${i.kind} label=${F(i.word)}></sw-badge><span class="when">${$(k(e.last_seen,t,this.zoneOf(e.id)))}</span></span>
      <sw-icon class="chev" name="chevronBack" size=${16}></sw-icon>
    </button>`}healthCard(e){const t=this.stationsRes.snap.data??[];return o`<sw-card flush data-access-card="health">
      <div class="ch"><div><h3>${n("healthTitle")}</h3><div class="sub">${n("healthSub")}</div></div></div>
      ${t.length?o`<div class="list">${t.map(s=>this.stationRow(s,e))}</div>`:o`<div class="empty">${n("healthEmpty")}</div>`}
    </sw-card>`}kindItems(){return[{id:"",label:n("alertKindAll")},...st.map(e=>({id:e,label:n(`alert_${e}`)}))]}alertRow(e,t){const s=yt(e);return o`<div class="row" data-access-alert=${e.id} data-tone=${s}>
      <span class="dot ${s==="muted"?"muted":s}" aria-hidden="true"></span>
      <span class="main"><span class="t">${$t(e)}</span>${_e(e,t,this.zoneOf(e.station_id))?o`<span class="s wrap">${_e(e,t,this.zoneOf(e.station_id))}</span>`:c}</span>
    </div>`}alertsCard(e){const t=this.alertsRes,s=t.snap,i=s.data;let a;return!s.everAnswered||s.busy&&!i?a=S(3):i?i.items.length?a=o`<div class="list" data-access-alerts>${i.items.map(r=>this.alertRow(r,e))}</div>`:a=o`<div class="empty" data-access-alerts-empty><span class="dot ok" aria-hidden="true"></span>${n("alertsEmpty")}</div>`:a=o`<div class="empty-panel">${_(s.failure??"error",s.message,()=>void t.reload(),!0)}</div>`,o`<sw-card flush data-access-card="alerts">
      <div class="ch">
        <div><h3>${n("alertsTitle")}</h3><div class="sub">${n("alertsSub",{n:i?i.total??i.items.length:0})}</div></div>
        <div class="ctl">
          <sw-dropdown tall data-access-alert-kind label=${n("alertKind")} .items=${this.kindItems()} .value=${this.kind} @change=${r=>this.setKind(r.detail.id)}></sw-dropdown>
          <button type="button" class="chipbtn" data-access-alerts-muted aria-pressed=${String(this.muted)} @click=${()=>this.toggleMuted()}>${n("alertMutedShow")}</button>
        </div>
      </div>
      ${t.stale&&i?o`<div class="note stale" role="status" data-access-stale="alerts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt,e)}</span></div>`:c}
      ${a}
      ${i&&!i.complete?o`<div class="note info" role="status" data-access-alerts-partial><sw-icon name="info" size=${16}></sw-icon><span>${n("alertsPartial")}</span></div>`:c}
      ${t.hasMore?o`<div class="more"><sw-button size="lg" data-access-alerts-more ?disabled=${s.loadingMore} @click=${()=>void t.more()}>${s.loadingMore?n("loadingMore"):n("more")}</sw-button></div>`:c}
      ${s.moreFailed?o`<div class="note err" role="alert" data-access-alerts-more-failed><span>${n("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void t.more()}>${n("retry")}</sw-button></div>`:c}
    </sw-card>`}setKind(e){this.kind=e,this.alertsRes.reload()}toggleMuted(){this.muted=!this.muted,this.alertsRes.reload()}staleText(e,t){return e?n("stale",{t:$(k(e,t,this.defaultZone()))}):n("staleNever")}syncCard(e){const t=this.syncRes,s=t.snap,i=xt(s.data,this.nameOf),a=p=>p>0?String(p):"—",r=p=>p,l=[{key:"name",label:n("colStation"),render:p=>o`<span style=${v.strong}>${r(p).name}</span>`},{key:"managed",label:n("colManaged"),render:p=>r(p).managed===null?"—":String(r(p).managed)},{key:"pending",label:n("colPending"),render:p=>a(r(p).pending)},{key:"removals",label:n("colRemovals"),render:p=>a(r(p).removals)},{key:"failed",label:n("colFailed"),render:p=>a(r(p).failed)},{key:"last",label:n("colLastSync"),render:p=>$(k(r(p).reconciledAt,e,this.zoneOf(r(p).id)))},{key:"state",label:n("colState"),render:p=>{const f=D(r(p).state,!0);return o`<span style=${v.row}><sw-badge kind=${f.kind} label=${F(f.word)}></sw-badge>${r(p).error?o`<span style=${v.muted}>${I(r(p).error)}</span>`:c}</span>`}}];let h;return!s.everAnswered||s.busy&&!s.data?h=S(3):s.data?i.length?h=o`<sw-table data-access-sync .columns=${l} .rows=${i} rowKey="id"></sw-table>`:h=o`<div class="empty">${n("syncEmpty")}</div>`:h=_(s.failure??"error",s.message,()=>void t.reload(),!0),o`<sw-card flush data-access-card="sync">
      <div class="ch"><div><h3>${n("syncTitle")}</h3><div class="sub">${n("syncSub")}</div></div></div>
      ${t.stale&&s.data?o`<div class="note stale" role="status" data-access-stale="sync"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt,e)}</span></div>`:c}
      ${h}
    </sw-card>`}conflictsCard(e){if(!this.wide)return c;const t=this.conflictsRes,s=t.snap;if(s.failure==="forbidden")return c;const i=h=>h,a=[{key:"who",label:n("colWho"),render:h=>{const p=kt(i(h));return p.kind==="name"?o`<span style=${v.strong}>${p.text}</span>`:p.kind==="employee"?o`<span>${n("employeeShort",{n:p.text})}</span>`:o`<span style=${v.muted}>${n("unnamed")}</span>`}},{key:"kind",label:n("colKind"),render:h=>n(St(i(h).kind))},{key:"station",label:n("colStation"),render:h=>this.nameOf(i(h).station_id)},{key:"state",label:n("colState"),render:h=>{const p=D(i(h).sync_state,!0);return o`<sw-badge kind=${p.kind} label=${F(p.word)}></sw-badge>`}},{key:"error",label:n("colError"),render:h=>I(i(h).last_error)||"—"}],r=(s.data??[]).map((h,p)=>({...h,id:`${h.station_id}/${h.kind}/${h.person?.id??p}`}));let l;return!s.everAnswered||s.busy&&!s.data?l=S(2):s.data?r.length?l=o`<sw-table data-access-conflicts .columns=${a} .rows=${r} rowKey="id"></sw-table>`:l=o`<div class="empty" data-access-conflicts-empty><span class="dot ok" aria-hidden="true"></span>${n("conflictsEmpty")}</div>`:l=_(s.failure??"error",s.message,()=>void t.reload(),!0),o`<sw-card flush data-access-card="conflicts">
      <div class="ch"><div><h3>${n("conflictsTitle")}</h3><div class="sub">${n("conflictsSub")}</div></div></div>
      ${t.stale&&s.data?o`<div class="note stale" role="status" data-access-stale="conflicts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt,e)}</span></div>`:c}
      ${l}
    </sw-card>`}drawer(e){const t=this.selected?this.stationsRes.snap.data?.find(i=>i.id===this.selected):void 0,s=t?D(t.sync_state,t.online):null;return o`<sw-drawer modal ?open=${!!t} heading=${t?.name??""} @close=${()=>this.selected=""} data-access-health-drawer>
      ${s?o`<sw-badge slot="action" kind=${s.kind} label=${F(s.word)}></sw-badge>`:c}
      ${t?o`<system-access-health data-access-health=${t.id} .station=${t} .zone=${this.zoneOf(t.id)} .rev=${this.rev} .now=${e}></system-access-health>`:c}
    </sw-drawer>`}render(){const e=new Date,t=this.stationsRes,s=t.snap;return!s.everAnswered||s.busy&&!s.data?o`<div class="stack" data-access-status="loading">${zt()}<sw-card flush>${S(4)}</sw-card></div>`:s.data?o`<div class="stack" data-access-status="ready">
        ${t.stale?o`<div class="note stale" role="status" data-access-stale="page"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(s.fetchedAt,e)}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>this.reloadAll()}>${n("refresh")}</sw-button></div>`:c}
        ${this.tiles(e)}
        <div class="grid2">${this.healthCard(e)}${this.alertsCard(e)}</div>
        ${this.syncCard(e)}
        ${this.conflictsCard(e)}
      </div>
      ${this.drawer(e)}`:o`<div class="stack" data-access-status=${s.failure??"error"}>${_(s.failure??"error",s.message,()=>this.reloadAll())}</div>`}};C.styles=[H,P`
      .when {
        white-space: nowrap;
      }
    `,Q,W];K([T({type:Number})],C.prototype,"rev",2);K([u()],C.prototype,"selected",2);K([u()],C.prototype,"kind",2);K([u()],C.prototype,"muted",2);K([u()],C.prototype,"wide",2);C=K([E("system-access-status")],C);var ns=Object.defineProperty,is=Object.getOwnPropertyDescriptor,J=(e,t,s,i)=>{for(var a=i>1?void 0:i?is(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&ns(t,s,a),a};const os="display:inline-flex;align-items:center;min-block-size:var(--sw-touch-desktop,44px);padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer;text-decoration:underline;text-decoration-color:var(--sw-border-strong);text-underline-offset:3px";let O=class extends j{constructor(){super(...arguments),this.rev=0,this.station="",this.action="",this.period="",this.person=null,this.lastRev=0,this.lastMeta="",this.nameOf=e=>this.stationsRes.snap.data?.find(t=>t.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.stationsRes=new y({fetch:()=>le(),pick:t=>t.stations,onChange:e}),this.auditRes=new y({fetch:t=>at({station_id:this.station,action:this.action,user_id:this.person?.id,start:Rt(this.period,new Date),before:typeof t=="number"?t:null}),pick:t=>t.audit,merge:Tt,cursorOf:t=>t.next_cursor,onChange:e}),this.reloadAll()}disconnectedCallback(){this.stationsRes?.dispose(),this.auditRes?.dispose(),super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),this.auditRes.reload()}emitMeta(){const e=this.auditRes?.snap.reply?.sync??this.stationsRes?.snap.reply?.sync??null,t=JSON.stringify(e);t!==this.lastMeta&&(this.lastMeta=t,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.zone()},bubbles:!0,composed:!0})))}zone(){return this.stationsRes?.snap.reply?.default_zone??te}stationItems(){return[{id:"",label:n("auditStationAll")},...(this.stationsRes.snap.data??[]).map(e=>({id:e.id,label:e.name}))]}actionItems(){return[{id:"",label:n("auditActionAll")},...Ct.map(e=>({id:e,label:be(e)}))]}setStation(e){this.station=e,this.auditRes.reload()}setAction(e){this.action=e,this.auditRes.reload()}periodItems(){const e={"":n("auditPeriodAll"),"24h":n("auditPeriod24h"),"7d":n("auditPeriod7d"),"30d":n("auditPeriod30d")};return ye.map(t=>({id:t,label:e[t]}))}setPeriod(e){this.period=ye.includes(e)?e:"",this.auditRes.reload()}setPerson(e){this.person=e,this.auditRes.reload()}clear(){this.station="",this.action="",this.period="",this.person=null,this.auditRes.reload()}target(e){const t=Ot(e);if(t.kind==="none")return"—";if(t.kind==="person"){const i=o`<span>${t.name??n("unnamed")}${t.employee?o` <span style=${v.muted}>· ${n("employeeShort",{n:t.employee})}</span>`:c}</span>`,a=At(e);return!a||this.person?i:o`<button type="button" style=${os} data-access-audit-person=${a.id} title=${n("auditPersonPick",{name:a.name})} @click=${()=>this.setPerson(a)}>${i}</button>`}const s=t.ids.map(i=>this.nameOf(i)).join(", ");return t.more?n("auditStationsMore",{names:s,n:t.more}):n("auditStations",{names:s})}actionCell(e){const t=be(e.action),s=Pt(e).map(a=>jt(a)),i=!!t&&t!==e.action;return o`<span>${i?t:o`<span style=${v.raw}>${t||"—"}</span>`}${s.length?o`<span style=${v.sub}>${n("auditFields",{list:s.join(", ")})}</span>`:c}</span>`}resultCell(e){const t=Et(e);return t.kind==="done"?o`<sw-badge kind="live" label=${n("resDone")}></sw-badge>`:o`<span style=${v.row}><sw-badge kind="error" label=${n("resFailed")}></sw-badge><span style=${v.muted}>${I(t.code)}</span></span>`}table(e,t){const s=this.zone(),i=r=>r,a=[{key:"time",label:n("colTime"),render:r=>i(r).time?Ne(qe(i(r).time,t,s)):"—"},{key:"user",label:n("colUser"),render:r=>i(r).actor_name??n("actorNone")},{key:"action",label:n("colAction"),render:r=>this.actionCell(i(r))},{key:"target",label:n("colTarget"),render:r=>this.target(i(r))},{key:"result",label:n("colResult"),render:r=>this.resultCell(i(r))}];return o`<sw-table data-access-audit-table .columns=${a} .rows=${e.records} rowKey="sequence"></sw-table>`}render(){const e=this.auditRes,t=e.snap,s=new Date,i=t.data,a=!!(this.station||this.action||this.period||this.person);let r;if(!t.everAnswered||t.busy&&!i)r=S(5);else if(i)i.records.length?r=this.table(i,s):r=o`<div class="empty" data-access-audit-empty>${a?n("auditEmptyFiltered"):n("auditEmpty")}</div>`;else return o`<div class="stack" data-access-status=${t.failure??"error"}>${_(t.failure??"error",t.message,()=>this.reloadAll())}</div>`;const l=this.zone();return o`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="audit">
        <div class="ch">
          <div><h3>${n("auditTitle")}</h3><div class="sub">${n("auditSub")}</div></div>
          <div class="ctl">
            <sw-dropdown tall data-access-audit-station label=${n("auditStation")} .items=${this.stationItems()} .value=${this.station} @change=${h=>this.setStation(h.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-action label=${n("auditAction")} .items=${this.actionItems()} .value=${this.action} @change=${h=>this.setAction(h.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-period label=${n("auditPeriod")} .items=${this.periodItems()} .value=${this.period} @change=${h=>this.setPeriod(h.detail.id)}></sw-dropdown>
            ${this.person?o`<button type="button" class="chipbtn" aria-pressed="true" data-access-audit-person-chip aria-label=${n("auditPersonClear")} @click=${()=>this.setPerson(null)}><span>${n("auditPerson",{name:this.person.name})}</span><sw-icon name="close" size=${14}></sw-icon></button>`:c}
            ${a?o`<sw-button size="lg" variant="ghost" data-access-audit-clear @click=${()=>this.clear()}>${n("auditClear")}</sw-button>`:c}
          </div>
        </div>
        ${e.stale&&i?o`<div class="note stale" role="status" data-access-stale="audit"><sw-icon name="offline" size=${16}></sw-icon><span>${t.fetchedAt?n("stale",{t:$(k(t.fetchedAt,s,l))}):n("staleNever")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void e.reload()}>${n("refresh")}</sw-button></div>`:c}
        ${r}
        ${e.hasMore?o`<div class="more"><sw-button size="lg" data-access-audit-more ?disabled=${t.loadingMore} @click=${()=>void e.more()}>${t.loadingMore?n("loadingMore"):n("more")}</sw-button></div>`:c}
        ${t.moreFailed?o`<div class="note err" role="alert" data-access-audit-more-failed><span>${n("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void e.more()}>${n("retry")}</sw-button></div>`:c}
        ${i?o`<div class="foot-note" data-access-audit-foot>${[i.total!==null?n("auditTotal",{n:i.total}):"",i.retention_days?n("auditRetention",{n:i.retention_days}):""].filter(Boolean).join(" · ")}</div>`:c}
      </sw-card>
    </div>`}};O.styles=[H,P`
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
      }
    `,Q,W];J([T({type:Number})],O.prototype,"rev",2);J([u()],O.prototype,"station",2);J([u()],O.prototype,"action",2);J([u()],O.prototype,"period",2);J([u()],O.prototype,"person",2);O=J([E("system-access-audit")],O);var rs=Object.defineProperty,ls=Object.getOwnPropertyDescriptor,ce=(e,t,s,i)=>{for(var a=i>1?void 0:i?ls(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&rs(t,s,a),a};let V=class extends j{constructor(){super(...arguments),this.rev=0,this.wide=!0,this.lastRev=0,this.lastMeta="",this.nameOf=e=>this.stationsRes.snap.data?.find(t=>t.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.wide=!b()||U("access.admin.read"),this.stationsRes=new y({fetch:()=>le(),pick:t=>t.stations,onChange:e}),this.groupsRes=new y({fetch:()=>nt(),pick:t=>t.groups,onChange:e}),this.versionsRes=new y({fetch:t=>it(typeof t=="number"?t:0),pick:t=>t.versions,merge:Mt,cursorOf:t=>t.next_offset,onChange:e}),this.reloadAll()}disconnectedCallback(){for(const e of[this.groupsRes,this.versionsRes,this.stationsRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),(!b()||ee().people)&&this.groupsRes.reload(),this.wide&&this.versionsRes.reload()}emitMeta(){const e=this.groupsRes?.snap.reply?.sync??this.versionsRes?.snap.reply?.sync??this.stationsRes?.snap.reply?.sync??null,t=JSON.stringify(e);t!==this.lastMeta&&(this.lastMeta=t,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.zone()},bubbles:!0,composed:!0})))}zone(){return this.stationsRes?.snap.reply?.default_zone??te}ruleText(e){const t=Nt(e,(this.stationsRes.snap.data??[]).map(s=>s.id));switch(t.kind){case"all":return n("ruleAll");case"none":return n("ruleNone");case"unknown":return n("ruleUnknown");case"stations":return t.ids.map(s=>this.nameOf(s)).join(", ")}}groupsCard(){if(b()&&!ee().people)return c;const e=this.groupsRes,t=e.snap;if(t.failure==="forbidden")return c;const s=t.data;let i;return!t.everAnswered||t.busy&&!s?i=S(4):s?s.groups.length?i=o`<div class="list" data-access-groups>
        ${s.groups.map(a=>o`<div class="row" data-access-group=${a.id}>
            <span class="dot ${a.enabled?"ok":"off"}" aria-hidden="true"></span>
            <span class="main"><span class="t">${a.label}</span><span class="s wrap">${this.ruleText(a)}</span></span>
            ${a.enabled?c:o`<span class="side"><sw-badge kind="offline" label=${n("groupOff")}></sw-badge></span>`}
          </div>`)}
      </div>`:i=o`<div class="empty">${n("groupsEmpty")}</div>`:i=_(t.failure??"error",t.message,()=>void e.reload(),!0),o`<sw-card flush data-access-card="groups">
      <div class="ch">
        <div><h3>${n("groupsTitle")}</h3><div class="sub">${n("groupsSub")}</div></div>
        ${s?o`<div class="ctl rev" data-access-revision><span class="muted">${n("revisionNow",{n:s.revision??"—"})}</span>${s.photo_enabled===null?c:o`<span class="muted">${s.photo_enabled?n("photoOn"):n("photoOff")}</span>`}<wk-profiles-link variant="ghost"></wk-profiles-link></div>`:c}
      </div>
      ${e.stale&&s?o`<div class="note stale" role="status" data-access-stale="groups"><sw-icon name="offline" size=${16}></sw-icon><span>${t.fetchedAt?n("stale",{t:$(k(t.fetchedAt,new Date,this.zone()))}):n("staleNever")}</span></div>`:c}
      ${i}
    </sw-card>`}fieldsCard(){const e=this.groupsRes.snap.data;if(!e||e.fields===null)return c;const t=i=>i,s=[{key:"label",label:n("colField"),render:i=>o`<span style=${v.strong}>${t(i).label}</span>`},{key:"type",label:n("colType"),render:i=>n(qt(t(i).type))},{key:"flags",label:n("colFlags"),render:i=>{const a=t(i),r=Lt(a),l=a.depends_on?(e.fields??[]).find(h=>h.id===a.depends_on?.field_id)?.label??a.depends_on.field_id:"";return o`<span style=${v.row}>${[a.required?n("flagRequired"):n("flagOptional"),r.includes("unique")?n("flagUnique"):"",r.includes("depends")?n("flagDepends",{field:l}):""].filter(Boolean).join(" · ")}${r.includes("disabled")?o`<sw-badge kind="offline" label=${n("flagDisabled")}></sw-badge>`:c}</span>`}},{key:"options",label:n("colOptions"),render:i=>{const a=Dt(t(i).options??[]);return a.shown.length?o`<span>${a.shown.join(", ")}${a.more?o` <span style=${v.muted}>${n("optionsMore",{n:a.more})}</span>`:c}</span>`:o`<span style=${v.muted}>—</span>`}}];return o`<sw-card flush data-access-card="fields">
      <div class="ch"><div><h3>${n("fieldsTitle")}</h3><div class="sub">${n("fieldsCount",{n:e.fields.length})}</div></div></div>
      ${e.fields.length?o`<sw-table data-access-fields .columns=${s} .rows=${e.fields} rowKey="id"></sw-table>`:o`<div class="empty">${n("fieldsEmpty")}</div>`}
    </sw-card>`}versionsCard(e){if(!this.wide)return c;const t=this.versionsRes,s=t.snap;if(s.failure==="forbidden")return c;const i=s.data,a=this.zone(),r=p=>p,l=[{key:"revision",label:n("colRevision"),render:p=>o`<span style=${v.row}><span style=${v.strong}>${r(p).revision}</span>${i&&r(p).revision===i.current_revision?o`<sw-badge kind="live" label=${n("versionCurrent")}></sw-badge>`:c}</span>`},{key:"saved",label:n("colSaved"),render:p=>r(p).saved_at?Ne(qe(r(p).saved_at,e,a)):"—"},{key:"action",label:n("colChange"),render:p=>Ft(r(p).action)},{key:"fields",label:n("colFieldChanges"),render:p=>r(p).field_changes?String(r(p).field_changes):"—"},{key:"groups",label:n("colGroupChanges"),render:p=>r(p).group_changes?String(r(p).group_changes):"—"}];let h;return!s.everAnswered||s.busy&&!i?h=S(3):i?i.records.length?h=o`<sw-table data-access-versions .columns=${l} .rows=${i.records} rowKey="revision"></sw-table>`:h=o`<div class="empty">${n("versionsEmpty")}</div>`:h=_(s.failure??"error",s.message,()=>void t.reload(),!0),o`<sw-card flush data-access-card="versions">
      <div class="ch"><div><h3>${n("versionsTitle")}</h3><div class="sub">${n("versionsSub")}</div></div></div>
      ${t.stale&&i?o`<div class="note stale" role="status" data-access-stale="versions"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt?n("stale",{t:$(k(s.fetchedAt,e,a))}):n("staleNever")}</span></div>`:c}
      ${h}
      ${t.hasMore?o`<div class="more"><sw-button size="lg" data-access-versions-more ?disabled=${s.loadingMore} @click=${()=>void t.more()}>${s.loadingMore?n("loadingMore"):`${n("more")} (${It(i)})`}</sw-button></div>`:c}
      ${s.moreFailed?o`<div class="note err" role="alert" data-access-versions-more-failed><span>${n("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void t.more()}>${n("retry")}</sw-button></div>`:c}
      ${i?.retained_from_revision?o`<div class="foot-note" data-access-versions-retained>${n("versionsRetained",{n:i.retained_from_revision})}</div>`:c}
    </sw-card>`}render(){const e=new Date,t=this.groupsRes.snap;if((!b()||ee().people)&&t.everAnswered&&!t.data&&t.failure&&t.failure!=="forbidden"&&["not_configured","connecting","not_installed","unsupported"].includes(t.failure))return o`<div class="stack" data-access-status=${t.failure}>${_(t.failure,t.message,()=>this.reloadAll())}</div>`;const i=this.groupsCard(),a=this.fieldsCard();return o`<div class="stack" data-access-status="ready">
      ${i!==c&&a!==c?o`<div class="grid2">${i}${a}</div>`:o`${i}${a}`}
      ${this.versionsCard(e)}
    </div>`}};V.styles=[H,P`
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
    `,Q,W];ce([T({type:Number})],V.prototype,"rev",2);ce([u()],V.prototype,"wide",2);V=ce([E("system-access-groups")],V);var cs=Object.defineProperty,ds=Object.getOwnPropertyDescriptor,M=(e,t,s,i)=>{for(var a=i>1?void 0:i?ds(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&cs(t,s,a),a};const ke={"access.event_portrait_audit":{title:"pol_event_portrait_audit",text:"pol_event_portrait_audit_text"},"access.event_portrait_sensitive":{title:"pol_event_portrait_sensitive",text:"pol_event_portrait_sensitive_text"},"access.employee_no_sensitive":{title:"pol_employee_no_sensitive",text:"pol_employee_no_sensitive_text"},"access.sync_errors_everyone":{title:"pol_sync_errors_everyone",text:"pol_sync_errors_everyone_text"}};let z=class extends j{constructor(){super(...arguments),this.rev=0,this.values=null,this.canEdit=!1,this.busy="",this.error="",this.failed="",this.loading=!0,this.lastRev=0,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.load())}async load(){const e=++this.gen;this.failed="";try{const t=await Ae("settings");if(e!==this.gen)return;this.values=this.read(t.settings),this.canEdit=!!t.can_edit&&(!b()||U("system.configure"))}catch(t){if(e!==this.gen)return;this.failed=q(t)}finally{e===this.gen&&(this.loading=!1)}}read(e){return Object.fromEntries($e.map(t=>[t,Ut(e,t)]))}async flip(e){if(!this.values||!this.canEdit||this.busy)return;const t=!this.values[e];this.busy=e,this.error="";try{const s=await Ke("settings",{[e]:String(t)});this.values=this.read(s.settings)}catch(s){this.error=`${n("policySaveFailed")} · ${q(s)}`}finally{this.busy=""}}render(){if(this.loading)return o`<div class="stack" data-access-status="loading"><sw-card flush>${S(4)}</sw-card></div>`;if(!this.values)return o`<div class="stack" data-access-status="error">${_("error",this.failed,()=>void this.load())}</div>`;const e=this.values;return o`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="policy">
        <div class="ch"><div><h3>${n("policyTitle")}</h3><div class="sub">${this.canEdit?n("policySub"):n("policyNote")}</div></div></div>
        ${$e.map(t=>o`<button type="button" class="sw" role="switch" aria-checked=${String(e[t])} data-access-policy=${t} data-default=${String(Wt[t])} ?disabled=${!this.canEdit||!!this.busy} @click=${()=>void this.flip(t)}>
            ${Z(n(ke[t].title),n(ke[t].text))}
          </button>`)}
        ${this.error?o`<div class="note err" role="alert" data-access-policy-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:c}
      </sw-card>
    </div>`}};z.styles=[H,Le,Q,W];M([T({type:Number})],z.prototype,"rev",2);M([u()],z.prototype,"values",2);M([u()],z.prototype,"canEdit",2);M([u()],z.prototype,"busy",2);M([u()],z.prototype,"error",2);M([u()],z.prototype,"failed",2);M([u()],z.prototype,"loading",2);z=M([E("system-access-policy")],z);const ne="access-control/messaging/installed",ps={view:()=>Ae(ne),save:e=>Ge(ne,e),sync:()=>Je(`${ne}/registry-sync`,{})};function hs(){return{settings:{send_pacing_v1:!1},gates:{messaging_enabled:!0,template_switch:!0,permit:!1},commands:{"whatsapp/template_registry_v1":!0,"whatsapp/template_enqueue_v1":!0,"whatsapp/template_job_v1":!0,"whatsapp/template_cancel_v1":!0,"whatsapp/template_send_v3":!0,"whatsapp/send_pacing_v1":!1},registry:{templates:[{id:"access",name:"access_notice",language:"he",purpose:"notice",source:"arx",account:null,template_revision:3,bound:!0},{id:"native_0a1b2c3d4e5f6a7b8c9d0e1f",name:"door_code",language:"he",purpose:"notice",source:"wiskey",account:"office",template_revision:2,bound:!0}],wiskey_rows:1,arx_rows:1,native_accounts:1,native_sendable:!1,last_sync:{outcome:"synced",code:null,native:1,at:"2026-11-04T08:00:00+00:00"}},jobs:[{operation_id:"tplq-demo00000001",template_id:"access",person_id:"p1",state:"completed",outcome:"accepted",code:"provider_accepted",created_at:"2026-11-04T08:10:00+00:00",updated_at:"2026-11-04T08:10:20+00:00"},{operation_id:"tplq-demo00000002",template_id:"access",person_id:"p2",state:"cancelled",outcome:"not_sent",code:"cancelled_before_dispatch",created_at:"2026-11-04T08:05:00+00:00",updated_at:"2026-11-04T08:05:30+00:00"}],queue_ttl_s:120,delivery_receipts:!1,excluded:["whatsapp/history","whatsapp/media","whatsapp/templates_get","whatsapp/templates_update"]}}let N=hs();const X=e=>JSON.parse(JSON.stringify(e)),us={view:async()=>X(N),save:async e=>(N.settings.send_pacing_v1=e.send_pacing_v1===!0,X(N)),sync:async()=>(N.registry.last_sync={outcome:"synced",code:null,native:N.registry.wiskey_rows,at:new Date().toISOString()},{...X(N),sync:X(N.registry.last_sync)})};function ie(){return b()?ps:us}const de={title:"תבניות ותור שליחה",sub:"רשימת התבניות של שירות ההודעות, תור השליחה ומצב כל הודעה. היסטוריית השיחות נשארת בשירות ההודעות.",loadError:"לא ניתן לטעון את מצב התבניות",retry:"נסו שוב",blocked:"שליחת תבנית אינה זמינה כרגע",blk_messaging_off:"שליחת הודעות כבויה",blk_template_switch_off:"שליחת תבניות כבויה",blk_permit_closed:"טרם אושרה שליחה מול עמדה אמיתית",blk_queue_unavailable:"החיבור הישיר לשירות ההודעות אינו זמין",ready:"שליחת תבנית זמינה",commands:"מה שירות ההודעות מאפשר עכשיו",cmd_registry:"רשימת תבניות",cmd_queue:"תור שליחה",cmd_job:"מצב משימה",cmd_cancel:"ביטול משימה",cmd_now:"שליחה מיידית",cmd_paced:"שליחה בקצב של השירות",on:"זמין",off:"לא זמין",registry:"תבניות",fromWiskey:"מהשירות: {n}",fromArx:"שהוגדרו כאן: {n}",nativeLocked:"תבניות השירות נשלחות רק כשההתקנה האוטומטית פעילה",sync:"רענון מהשירות",syncing:"מרענן...",lastSync:"רענון אחרון: {time}",neverSynced:"עוד לא רועננה",sync_synced:"הרשימה רועננה",sync_not_sent:"לא נשלחה בקשה",sync_refused:"השירות סירב",sync_invalid:"התשובה לא תקינה - הרשימה נשמרה",sync_unknown:"לא התקבלה תשובה",noTemplates:"אין תבניות",src_wiskey:"מהשירות",src_arx:"כאן",unbound:"לא מקושרת",jobs:"משימות אחרונות",noJobs:"אין משימות בתור",job_pending:"ממתינה בתור",job_sent:"התקבלה אצל ספק ההודעות",job_cancelled:"בוטלה - לא נשלחה",job_paced:"עוכבה בקצב של השירות - לא נשלחה",job_expired:"פג תוקפה בתור - לא נשלחה",job_not_sent:"לא נשלחה",job_unknown:"לא ידוע אם נשלחה",delivery:"השירות אינו מדווח על מסירה - ידוע רק שהספק קיבל את ההודעה",ttl:"הודעה ממתינה בתור עד {n} שניות",paced:"הודעה חופשית בקצב של השירות",pacedOn:'מופעל - כל הודעה שנשלחה תוצג כ"לא ידוע" עד שהשירות ידווח קבלה',pacedOff:"כבוי",pacedUnlisted:"השירות אינו מציע זאת כרגע",saved:"נשמר",history:"היסטוריית השיחות נשארת בשירות ההודעות ואינה נשמרת כאן"},De={title:"Templates and send queue",sub:"The messaging service's template list, the send queue and each message's state. The conversation history stays in the messaging service.",loadError:"The template state could not be loaded",retry:"Try again",blocked:"Template sending is not available now",blk_messaging_off:"Messaging is off",blk_template_switch_off:"Template sending is off",blk_permit_closed:"Sending has not been approved against a real station yet",blk_queue_unavailable:"The direct messaging-service connection is not available",ready:"Template sending is available",commands:"What the messaging service offers now",cmd_registry:"Template list",cmd_queue:"Send queue",cmd_job:"Job state",cmd_cancel:"Job cancel",cmd_now:"Send now",cmd_paced:"Send at the service's pace",on:"Available",off:"Not available",registry:"Templates",fromWiskey:"From the service: {n}",fromArx:"Defined here: {n}",nativeLocked:"Service templates are sent only while the automatic installation is on",sync:"Refresh from the service",syncing:"Refreshing...",lastSync:"Last refresh: {time}",neverSynced:"Not refreshed yet",sync_synced:"The list was refreshed",sync_not_sent:"No request was sent",sync_refused:"The service refused",sync_invalid:"The answer was not valid - the list was kept",sync_unknown:"No answer arrived",noTemplates:"No templates",src_wiskey:"Service",src_arx:"Here",unbound:"Not linked",jobs:"Recent jobs",noJobs:"No jobs in the queue",job_pending:"Waiting in the queue",job_sent:"Accepted by the message provider",job_cancelled:"Cancelled - not sent",job_paced:"Held by the service's pace - not sent",job_expired:"Expired in the queue - not sent",job_not_sent:"Not sent",job_unknown:"Unknown whether it was sent",delivery:"The service does not report delivery - only that the provider accepted the message",ttl:"A message waits in the queue for up to {n} seconds",paced:"Free text at the service's pace",pacedOn:'On - every dispatched message shows as "unknown" until the service reports acceptance',pacedOff:"Off",pacedUnlisted:"The service does not offer this now",saved:"Saved",history:"The conversation history stays in the messaging service and is not kept here"},Fe={title:"القوالب وطابور الإرسال",sub:"قائمة قوالب خدمة الرسائل وطابور الإرسال وحالة كل رسالة. يبقى سجل المحادثات في خدمة الرسائل.",loadError:"تعذّر تحميل حالة القوالب",retry:"حاول مرة أخرى",blocked:"إرسال القوالب غير متاح الآن",blk_messaging_off:"إرسال الرسائل متوقف",blk_template_switch_off:"إرسال القوالب متوقف",blk_permit_closed:"لم تتم الموافقة على الإرسال مقابل محطة حقيقية بعد",blk_queue_unavailable:"الاتصال المباشر بخدمة الرسائل غير متاح",ready:"إرسال القوالب متاح",commands:"ما تتيحه خدمة الرسائل الآن",cmd_registry:"قائمة القوالب",cmd_queue:"طابور الإرسال",cmd_job:"حالة المهمة",cmd_cancel:"إلغاء المهمة",cmd_now:"إرسال فوري",cmd_paced:"إرسال بوتيرة خدمة الرسائل",on:"متاح",off:"غير متاح",registry:"القوالب",fromWiskey:"من خدمة الرسائل: {n}",fromArx:"معرّفة هنا: {n}",nativeLocked:"تُرسل قوالب خدمة الرسائل فقط عندما يكون التثبيت التلقائي مفعّلاً",sync:"تحديث من خدمة الرسائل",syncing:"جارٍ التحديث...",lastSync:"آخر تحديث: {time}",neverSynced:"لم يتم التحديث بعد",sync_synced:"تم تحديث القائمة",sync_not_sent:"لم يُرسل أي طلب",sync_refused:"رفضت الخدمة",sync_invalid:"الإجابة غير صالحة - تم الاحتفاظ بالقائمة",sync_unknown:"لم تصل إجابة",noTemplates:"لا توجد قوالب",src_wiskey:"الخدمة",src_arx:"هنا",unbound:"غير مرتبط",jobs:"المهام الأخيرة",noJobs:"لا توجد مهام في الطابور",job_pending:"بانتظار الطابور",job_sent:"استلمها مزوّد الرسائل",job_cancelled:"أُلغيت - لم تُرسل",job_paced:"أخّرتها وتيرة خدمة الرسائل - لم تُرسل",job_expired:"انتهت صلاحيتها في الطابور - لم تُرسل",job_not_sent:"لم تُرسل",job_unknown:"غير معروف إن أُرسلت",delivery:"لا تبلّغ الخدمة عن التسليم - المعروف فقط أن المزوّد استلم الرسالة",ttl:"تنتظر الرسالة في الطابور حتى {n} ثانية",paced:"نص حر بوتيرة خدمة الرسائل",pacedOn:'مفعّل - كل رسالة مُرسلة تظهر "غير معروف" حتى تبلّغ الخدمة عن الاستلام',pacedOff:"متوقف",pacedUnlisted:"لا تتيح الخدمة ذلك الآن",saved:"تم الحفظ",history:"يبقى سجل المحادثات في خدمة الرسائل ولا يُحفظ هنا"},Ie={title:"Шаблоны и очередь отправки",sub:"Список шаблонов сервиса сообщений, очередь отправки и состояние каждого сообщения. История переписки остаётся в сервисе сообщений.",loadError:"Не удалось загрузить состояние шаблонов",retry:"Повторить",blocked:"Отправка шаблонов сейчас недоступна",blk_messaging_off:"Отправка сообщений выключена",blk_template_switch_off:"Отправка шаблонов выключена",blk_permit_closed:"Отправка ещё не подтверждена на реальной станции",blk_queue_unavailable:"Прямое подключение к сервису сообщений недоступно",ready:"Отправка шаблонов доступна",commands:"Что сервис сообщений предлагает сейчас",cmd_registry:"Список шаблонов",cmd_queue:"Очередь отправки",cmd_job:"Состояние задачи",cmd_cancel:"Отмена задачи",cmd_now:"Отправить сейчас",cmd_paced:"Отправка в темпе сервиса",on:"Доступно",off:"Недоступно",registry:"Шаблоны",fromWiskey:"Из сервиса: {n}",fromArx:"Заданы здесь: {n}",nativeLocked:"Шаблоны сервиса отправляются только при включённой автоматической установке",sync:"Обновить из сервиса",syncing:"Обновление...",lastSync:"Последнее обновление: {time}",neverSynced:"Ещё не обновлялось",sync_synced:"Список обновлён",sync_not_sent:"Запрос не отправлен",sync_refused:"Сервис отказал",sync_invalid:"Ответ некорректен - список сохранён",sync_unknown:"Ответ не получен",noTemplates:"Нет шаблонов",src_wiskey:"Сервис",src_arx:"Здесь",unbound:"Не связан",jobs:"Последние задачи",noJobs:"В очереди нет задач",job_pending:"Ждёт в очереди",job_sent:"Принято провайдером сообщений",job_cancelled:"Отменено - не отправлено",job_paced:"Задержано темпом сервиса - не отправлено",job_expired:"Истекло в очереди - не отправлено",job_not_sent:"Не отправлено",job_unknown:"Неизвестно, отправлено ли",delivery:"Сервис не сообщает о доставке - известно только, что провайдер принял сообщение",ttl:"Сообщение ждёт в очереди до {n} секунд",paced:"Свободный текст в темпе сервиса",pacedOn:"Включено - каждое отправленное сообщение показано как «неизвестно», пока сервис не сообщит о приёме",pacedOff:"Выключено",pacedUnlisted:"Сервис сейчас этого не предлагает",saved:"Сохранено",history:"История переписки остаётся в сервисе сообщений и здесь не хранится"},ms={he:de,en:De,ar:Fe,ru:Ie},vs=["ar","ru"];function gs(){return Ee(["en","ar","ru"])}function m(e,t,s=gs()){const i=ms[s][e]??de[e]??e;return je(i,t)}Pe("i18n/wa-installed",{he:de,en:De,ar:Fe,ru:Ie},vs);function fs(e){return e.outcome==="pending"?"pending":e.outcome==="accepted"?"sent":e.outcome==="not_sent"?e.code==="cancelled_before_dispatch"?"cancelled":e.code==="rate_limited"?"paced":e.code==="queue_expired"?"expired":"not_sent":"unknown"}function ws(e){return e==="sent"?"ok":e==="unknown"?"warn":e==="pending"?"muted":"bad"}function _s(e){const t=[];return e.gates.messaging_enabled||t.push("messaging_off"),e.gates.template_switch||t.push("template_switch_off"),e.gates.permit||t.push("permit_closed"),!e.commands["whatsapp/template_enqueue_v1"]&&!e.commands["whatsapp/template_send_v3"]&&t.push("queue_unavailable"),t}function bs(e){return e==="synced"?"ok":e==="unknown"?"warn":e?"bad":"muted"}function ys(e){return e.settings.send_pacing_v1||e.commands["whatsapp/send_pacing_v1"]}function $s(e,t=5){return e.slice(0,Math.max(0,t))}var xs=Object.defineProperty,ks=Object.getOwnPropertyDescriptor,G=(e,t,s,i)=>{for(var a=i>1?void 0:i?ks(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&xs(t,s,a),a};const Ss=[["whatsapp/template_registry_v1","cmd_registry"],["whatsapp/template_enqueue_v1","cmd_queue"],["whatsapp/template_job_v1","cmd_job"],["whatsapp/template_cancel_v1","cmd_cancel"],["whatsapp/template_send_v3","cmd_now"],["whatsapp/send_pacing_v1","cmd_paced"]];let A=class extends j{constructor(){super(...arguments),this.view=null,this.phase="loading",this.error="",this.notice="",this.busy="",this.noticeTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){window.clearTimeout(this.noticeTimer),super.disconnectedCallback()}async load(){this.phase=this.view?this.phase:"loading";try{this.view=await ie().view(),this.phase="ready",this.error=""}catch(e){this.error=q(e),this.phase="error"}}flash(e){this.notice=e,window.clearTimeout(this.noticeTimer),this.noticeTimer=window.setTimeout(()=>this.notice="",3e3)}async sync(){if(!this.busy){this.busy="sync",this.error="";try{const e=await ie().sync();this.view=e,this.flash(m(`sync_${e.sync?.outcome??"synced"}`))}catch(e){const t=q(e);await this.load(),this.phase==="ready"&&(this.error=t)}finally{this.busy=""}}}async setPaced(e){if(!(this.busy||!this.view)){this.busy="save",this.error="";try{this.view=await ie().save({send_pacing_v1:e}),this.flash(m("saved"))}catch(t){this.error=q(t)}finally{this.busy=""}}}template(e){return o`<div class="row" data-wa-template=${e.id} data-source=${e.source}>
      <span class="dot ${e.bound?"ok":"muted"}" aria-hidden="true"></span>
      <span class="main"><span class="t">${Be(e.name)}</span>
        <span class="s">${e.language} · ${m(e.source==="wiskey"?"src_wiskey":"src_arx")}${e.account?o` · <span class="ltr">${ue(e.account)}</span>`:c}${e.bound?c:o` · ${m("unbound")}`}</span></span>
    </div>`}job(e){const t=fs(e),s=ws(t);return o`<div class="row" data-wa-job=${e.operation_id} data-word=${t}>
      <span class="dot ${s==="bad"?"err":s}" aria-hidden="true"></span>
      <span class="main"><span class="t">${m(`job_${t}`)}</span>
        <span class="s"><span class="ltr">${ue(e.template_id??"–")}</span> · ${me(new Date(e.updated_at))}</span></span>
    </div>`}render(){if(this.phase==="loading")return o`<sw-card flush data-wa-installed data-state="loading">${S(3)}</sw-card>`;if(this.phase==="error"||!this.view)return o`<sw-card flush data-wa-installed data-state="error"><div class="ch"><div><h3>${m("title")}</h3></div></div>
        <div class="sec"><div class="note err" role="alert" data-wa-error><sw-icon name="warning" size="16"></sw-icon><span>${m("loadError")}: ${this.error}</span>
          <sw-button size="sm" data-wa-retry @click=${()=>void this.load()}>${m("retry")}</sw-button></div></div></sw-card>`;const e=this.view,t=_s(e),s=e.registry.last_sync,i=$s(e.jobs),a=ys(e);return o`<sw-card flush data-wa-installed data-state="ready">
      <div class="ch">
        <div><h3>${m("title")}</h3><div class="sub">${m("sub")}</div></div>
        <div class="ctl"><sw-button size="sm" icon="refresh" data-wa-sync ?disabled=${!!this.busy||!e.commands["whatsapp/template_registry_v1"]}
          @click=${()=>void this.sync()}>${this.busy==="sync"?m("syncing"):m("sync")}</sw-button></div>
      </div>
      ${this.error?o`<div class="sec"><div class="note err" role="alert" data-wa-error><sw-icon name="warning" size="16"></sw-icon><span>${this.error}</span></div></div>`:c}
      ${this.notice?o`<div class="sec"><div class="note info" role="status" data-wa-notice><sw-icon name="check" size="16"></sw-icon><span>${this.notice}</span></div></div>`:c}
      <div class="sec" data-wa-blockers=${t.join(" ")}>
        ${t.length?o`<h4>${m("blocked")}</h4><div class="chips">${t.map(r=>o`<span class="chip bad" data-wa-blocker=${r}>${m(`blk_${r}`)}</span>`)}</div>`:o`<div class="chips"><span class="chip ok" data-wa-ready>${m("ready")}</span></div>`}
      </div>
      <div class="sec">
        <h4>${m("commands")}</h4>
        <div class="cmds">${Ss.map(([r,l])=>o`<div class="cmd" data-wa-command=${r} data-on=${String(e.commands[r])}>
          <span class="dot ${e.commands[r]?"ok":"muted"}" aria-hidden="true"></span><span>${m(l)} · ${m(e.commands[r]?"on":"off")}</span></div>`)}</div>
      </div>
      <div class="sec" data-wa-registry>
        <div class="line"><h4 class="grow">${m("registry")}</h4>
          <span class="chip" data-wa-count="wiskey">${m("fromWiskey",{n:e.registry.wiskey_rows})}</span>
          <span class="chip" data-wa-count="arx">${m("fromArx",{n:e.registry.arx_rows})}</span></div>
        <div class="line"><span class="chip ${bs(s?.outcome)}" data-wa-last-sync=${s?.outcome??"never"}>${m(s?`sync_${s.outcome}`:"neverSynced")}</span>
          ${s?.at?o`<span class="meta">${m("lastSync",{time:me(new Date(s.at))})}</span>`:c}</div>
        ${e.registry.wiskey_rows&&!e.registry.native_sendable?o`<div class="hint" data-wa-native-locked>${m("nativeLocked")}</div>`:c}
      </div>
      <div data-wa-templates>${e.registry.templates.length?ve(e.registry.templates,r=>r.id,r=>this.template(r)):o`<div class="empty">${m("noTemplates")}</div>`}</div>
      <div class="sec" data-wa-jobs-head><h4>${m("jobs")}</h4><div class="hint">${m("ttl",{n:e.queue_ttl_s})}</div>
        ${e.delivery_receipts?c:o`<div class="hint" data-wa-no-delivery>${m("delivery")}</div>`}</div>
      <div data-wa-jobs>${i.length?ve(i,r=>r.operation_id,r=>this.job(r)):o`<div class="empty">${m("noJobs")}</div>`}</div>
      <div class="sec">
        <div class="toggle" data-wa-paced>
          <span class="txt"><span class="t">${m("paced")}</span>
            <span class="x">${e.settings.send_pacing_v1?m("pacedOn"):m(a?"pacedOff":"pacedUnlisted")}</span></span>
          <sw-toggle label=${m("paced")} labelHidden data-wa-paced-toggle .checked=${e.settings.send_pacing_v1} ?disabled=${!!this.busy||!a}
            @change=${r=>void this.setPaced(r.detail.checked)}></sw-toggle>
        </div>
        <div class="hint" data-wa-history>${m("history")}</div>
      </div>
    </sw-card>`}};A.styles=[H,P`
      :host { display: block; min-inline-size: 0; }
      .sec { padding: 10px 14px; border-block-start: 1px solid var(--sw-border); display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
      .sec h4 { margin: 0; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; min-inline-size: 0; }
      .chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs);
        background: var(--sw-surface-3); color: var(--sw-text-2); max-inline-size: 100%; overflow-wrap: anywhere; }
      .chip.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
      .chip.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
      .chip.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
      .cmds { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 6px 12px; }
      .cmd { display: flex; align-items: center; gap: 8px; min-inline-size: 0; font-size: var(--sw-fs-sm); }
      .cmd span { min-inline-size: 0; overflow-wrap: anywhere; }
      .line { display: flex; align-items: center; gap: 10px; min-inline-size: 0; font-size: var(--sw-fs-sm); }
      .line .grow { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
      .line .meta { color: var(--sw-text-3); font-size: var(--sw-fs-xs); white-space: nowrap; }
      .row { min-block-size: max(44px, var(--_t)); }
      .ltr { direction: ltr; unicode-bidi: isolate; }
      .hint { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .toggle { display: flex; align-items: center; gap: 12px; min-inline-size: 0; }
      .toggle .txt { flex: 1; min-inline-size: 0; display: flex; flex-direction: column; gap: 2px; }
      .toggle .t { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .toggle .x { color: var(--sw-text-3); font-size: var(--sw-fs-sm); overflow-wrap: anywhere; }
    `];G([u()],A.prototype,"view",2);G([u()],A.prototype,"phase",2);G([u()],A.prototype,"error",2);G([u()],A.prototype,"notice",2);G([u()],A.prototype,"busy",2);A=G([E("wa-installed-card")],A);const Ue={templates_max:20,label_max:40,body_max:600,text_max:1e3,organization_max:60,bulk_max:[1,200],rate_per_hour:[1,1e3],per_sender_per_hour:[1,1e3],per_person_per_day:[1,50],per_station_per_hour:[1,1e3],placeholders:["name","organization"],placeholders_max:6},zs=128,Ts=1500,Rs=/\p{Cc}|\p{Zl}|\p{Zp}/u,pe=(e,t)=>[...e].some(s=>t&&s===`
`?!1:Rs.test(s));function Cs(e){return e.replace(/\r\n?/g,`
`).split(`
`).map(t=>t.replace(/\s+$/u,"")).join(`
`).trim()}function Os(e,t,s,i){const a=e.trim();if(!a)return[{path:t,code:"empty"}];if(a.length>i.label_max)return[{path:t,code:"too_long"}];if(pe(a,!1))return[{path:t,code:"control_chars"}];const r=a.toLocaleLowerCase();return s.has(r)?[{path:t,code:"duplicate_label"}]:(s.add(r),[])}function As(e,t,s,i){const a=Cs(e);if(!a)return[{path:t,code:"empty"}];if(a.length>i.body_max)return[{path:t,code:"too_long"}];if(pe(a,!0))return[{path:t,code:"control_chars"}];if(Jt(a))return[{path:t,code:"credential"}];const r=[...a.matchAll(/\{([^{}]*)\}/g)].map(f=>f[1]),l=a.replace(/\{[^{}]*\}/g,"");if(l.includes("{")||l.includes("}"))return[{path:t,code:"bad_braces"}];if(r.some(f=>!i.placeholders.includes(f)))return[{path:t,code:"unknown_placeholder"}];if(re(a))return[{path:t,code:"credential"}];if(r.length>i.placeholders_max)return[{path:t,code:"too_many_placeholders"}];if(r.includes("organization")&&!s.trim())return[{path:t,code:"organization_missing"}];if(re(a.replace(/\{(name|organization)\}/g,(f,se)=>se==="name"?"xxxxxxxx":s.trim())))return[{path:t,code:"credential"}];const h=r.filter(f=>f==="name").length,p=r.filter(f=>f==="organization").length;return a.replace(/\{(?:name|organization)\}/g,"").length+h*zs+p*i.organization_max>Ts?[{path:t,code:"too_long"}]:[]}const Se=/^([01]\d|2[0-3]):[0-5]\d$/;function Ps(e){return e==null?null:!Se.test(e.from)||!Se.test(e.to)?"window_invalid":e.from===e.to?"window_empty":e.from>e.to?"window_across_midnight":null}const ze={per_sender_per_hour:[1,1e3],per_person_per_day:[1,50],per_station_per_hour:[1,1e3]};function js(e,t=Ue){const s=[],i=h=>typeof h=="number"&&Number.isInteger(h);i(e.bulk_max)?(e.bulk_max<t.bulk_max[0]||e.bulk_max>t.bulk_max[1])&&s.push({path:"bulk_max",code:"range"}):s.push({path:"bulk_max",code:"type"}),i(e.rate_per_hour)?(e.rate_per_hour<t.rate_per_hour[0]||e.rate_per_hour>t.rate_per_hour[1])&&s.push({path:"rate_per_hour",code:"range"}):s.push({path:"rate_per_hour",code:"type"});for(const h of Object.keys(ze)){if(!(h in e))continue;const p=e[h],[f,se]=t[h]??ze[h];i(p)?(p<f||p>se)&&s.push({path:h,code:"range"}):s.push({path:h,code:"type"})}const a=Ps(e.send_hours);a&&s.push({path:"send_hours",code:a});const r=e.organization.trim();r.length>t.organization_max?s.push({path:"organization",code:"too_long"}):pe(r,!1)?s.push({path:"organization",code:"control_chars"}):r.includes("{")||r.includes("}")?s.push({path:"organization",code:"bad_braces"}):re(r)&&s.push({path:"organization",code:"credential"}),e.templates.length>t.templates_max&&s.push({path:"templates",code:"too_many"});const l=new Set;return e.templates.forEach((h,p)=>{s.push(...Os(h.label,`templates.${p}.label`,l,t)),s.push(...As(h.body,`templates.${p}.body`,r,t))}),s}const Es=(e,t)=>e.filter(s=>s.path===t);function Ms(e,t,s,i){const a=s??e.length,r=i??a;return{text:e.slice(0,a)+t+e.slice(r),caret:a+t.length}}const he={segment:"הודעות",segments_label:"הודעות",title:"הודעות לאנשים",sub:"שליחת הודעות וואטסאפ מרשימת האנשים: תבניות מאושרות והודעה חופשית. השליחה נרשמת ביומן המערכת, בלי תוכן ההודעה.",loading:"טוען את ההגדרות…",load_failed:"לא ניתן לטעון את ההגדרות",retry:"נסה שוב","service.connected":"שירות ההודעות מחובר","service.account":"חשבון: {name}","service.not_connected":"שירות ההודעות אינו מחובר","service.unknown":"מצב שירות ההודעות לא ידוע","service.unsupported":"שירות ההודעות אינו זמין בהתקנה הזו","service.account_required":"יש כמה חשבונות · בחרו מאיזה חשבון נשלחות ההודעות","service.account_missing":"החשבון שנבחר אינו קיים יותר · בחרו חשבון","service.account_not_covered":"החשבון שנבחר לא נכלל ברשימה שהתקבלה כרגע משירות ההודעות (הרשימה מוגבלת) · נסו שוב או בחרו חשבון אחר","service.no_account":"אין חשבון הודעות מחובר","enabled.title":"שליחת הודעות","enabled.on":"מופעל · במסך האנשים יש כפתור שליחה לבעלי ההרשאה","enabled.off":"כבוי · במסך האנשים אין כפתור שליחה","free.title":"הודעה חופשית","free.on":"השולח יכול לכתוב הודעה בעצמו","free.off":"אפשר לשלוח תבניות מאושרות בלבד","bulk.title":"נמענים מרבי בשליחה אחת","bulk.hint":"בין {min} ל־{max}","rate.title":"מכסת הודעות לשעה","rate.hint":"לכל המערכת · בין {min} ל־{max}","optout.note":'בקשת "לא לקבל הודעות" חלה על הודעות שנשלחות מכאן בלבד; רק מנהל מערכת יכול לבטל אותה.',"sender.title":"הודעות לשעה לכל שולח","sender.hint":"כולל הודעות שנדחו · בין {min} ל־{max}","person.title":"הודעות ביום לכל נמען","person.hint":"לפי האדם ולפי מספר הטלפון · בין {min} ל־{max}","station.title":"הודעות לשעה לאנשי עמדה","station.hint":"לכל עמדה בנפרד · בין {min} ל־{max}","hours.title":"שעות שליחה","hours.on":"הודעות נשלחות רק בין השעות שנבחרו (שעון ההתקנה)","hours.off":"ללא הגבלת שעות","hours.from":"משעה","hours.to":"עד שעה","org.title":"שם הארגון בהודעות","org.hint":"מחליף את {organization} בתבניות","account.title":"חשבון השליחה","account.only":"החשבון היחיד","account.choose":"בחרו חשבון","templates.title":"תבניות מאושרות","templates.sub":"{name} מוחלף בשם האדם ו־{organization} בשם הארגון. אי אפשר לכתוב בתבנית קוד גישה או פרטי כניסה.","templates.empty":"אין תבניות · השולחים יוכלו לכתוב הודעה חופשית בלבד","template.label":"שם התבנית","template.body":"נוסח ההודעה","template.counter":"{n}/{max}","template.add":"הוספת תבנית","template.remove":"מחיקת התבנית","template.insert_name":"הוספת שם האדם","template.insert_org":"הוספת שם הארגון","template.new":"תבנית חדשה","consent.title":"אישור קבלת הודעות בקישור","consent.sub":"כשהאפשרות מופעלת, ההודעה הראשונה לאדם שלא ידוע אם הסכים היא בקשת אישור עם קישור. ההודעה המבוקשת נשלחת רק אחרי שהאדם אישר.","consent.switch":"בקשת אישור לפני ההודעה הראשונה","consent.on":"מופעל · אדם שלא אישר מקבל קודם בקשת אישור","consent.off":"כבוי · אפשר לשלוח גם למי שלא ידוע אם הסכים","consent.wait":"ימים להמתנה לתשובה","consent.wait_hint":"בין {min} ל־{max} · בלי תשובה ההודעה לא נשלחת והשולח מקבל התראה","consent.language":"שפת בקשת האישור","consent.lang.he":"עברית","consent.lang.en":"אנגלית","consent.lang.ar":"ערבית (טיוטה)","consent.lang.ru":"רוסית (טיוטה)","consent.wa_template":"שם התבנית המאושרת בוואטסאפ","consent.wa_template_hint":"לפנייה ראשונה. אישור התבנית מול וואטסאפ נעשה על ידי בעל החשבון","consent.wa_language":"קוד השפה של התבנית","consent.rules":"בקשת אישור אחת לאדם בכל {days} יום · עד {held} הודעות ממתינות לאדם","consent.problem.module_off":"הדף הציבורי כבוי · אי אפשר לשלוח בקשת אישור","consent.problem.public_page":"הדף הציבורי אינו זמין או שאין לו כתובת · אי אפשר לשלוח בקשת אישור","consent.problem.key":"מפתח הקישורים חסר · אי אפשר לשלוח בקשת אישור","err.bad_name":"אותיות לטיניות קטנות, ספרות וקו תחתון בלבד","err.bad_language":"קוד שפה לא תקין (למשל he או en_US)","err.template_send_unsupported":"שליחת תבנית וואטסאפ מאושרת עדיין אינה נתמכת - השאירו ריק","consent.no_template":"בקשת האישור נשלחת כהודעת טקסט רגילה. שליחה בתבנית וואטסאפ מאושרת עדיין אינה נתמכת, ולכן אדם שלא כתב לחשבון ב־24 השעות האחרונות עלול לא לקבל אותה",save:"שמירה",saving:"שומר…",revert:"ביטול שינויים",saved:"נשמר",unsaved:"יש שינויים שלא נשמרו",invalid:"יש לתקן את השדות המסומנים",save_failed:"השמירה נכשלה",conflict:"ההגדרות נשמרו בינתיים על ידי מישהו אחר",reload:"טעינה מחדש","err.empty":"חובה למלא","err.too_long":"ארוך מדי","err.control_chars":"יש תווים שאי אפשר להשתמש בהם","err.credential":"אי אפשר לכלול קוד גישה או פרטי כניסה","err.unknown_placeholder":"בין סוגריים מסולסלים מותר {name} ו־{organization} בלבד","err.bad_braces":"סוגריים מסולסלים לא תקינים","err.too_many_placeholders":"יותר מדי מילים להחלפה בתבנית אחת","err.organization_missing":"התבנית משתמשת בשם הארגון והוא לא הוגדר","err.duplicate_label":"יש כבר תבנית בשם הזה","err.range":"מחוץ לטווח המותר","err.type":"יש להזין מספר שלם","err.too_many":"יותר מדי תבניות","err.window_invalid":"יש להזין שעה בתבנית 08:00","err.window_across_midnight":"שעת ההתחלה חייבת להיות לפני שעת הסיום","err.window_empty":"שעת ההתחלה ושעת הסיום זהות","err.other":"ערך לא תקין"},We={segment:"Messages",segments_label:"Messages",title:"Messages to people",sub:"Send WhatsApp messages from the people list: approved templates and free text. Each send is recorded in the system log, without the message content.",loading:"Loading the settings…",load_failed:"The settings could not be loaded",retry:"Try again","service.connected":"The messaging service is connected","service.account":"Account: {name}","service.not_connected":"The messaging service is not connected","service.unknown":"The messaging service status is unknown","service.unsupported":"The messaging service is not available in this installation","service.account_required":"There are several accounts · choose which account sends the messages","service.account_missing":"The selected account no longer exists · choose an account","service.account_not_covered":"The selected account is not in the list the messaging service sent this time (the list is limited) · try again or choose another account","service.no_account":"No messaging account is connected","enabled.title":"Sending messages","enabled.on":"On · the people screen has a send button for users with permission","enabled.off":"Off · the people screen has no send button","free.title":"Free-text message","free.on":"The sender can write their own message","free.off":"Only approved templates can be sent","bulk.title":"Most recipients in one send","bulk.hint":"{min} to {max}","rate.title":"Messages per hour","rate.hint":"For the whole system · {min} to {max}","optout.note":'A "do not message me" request applies to messages sent from here only; only a system administrator can clear it.',"sender.title":"Messages per sender per hour","sender.hint":"Refused messages count too · {min} to {max}","person.title":"Messages per recipient per day","person.hint":"By person and by phone number · {min} to {max}","station.title":"Messages per hour to a station's people","station.hint":"Each station separately · {min} to {max}","hours.title":"Send hours","hours.on":"Messages go out only between these times (installation time)","hours.off":"No time restriction","hours.from":"From","hours.to":"Until","org.title":"Organisation name in messages","org.hint":"Replaces {organization} in the templates","account.title":"Sending account","account.only":"The only account","account.choose":"Choose an account","templates.title":"Approved templates","templates.sub":"{name} is replaced by the person's name and {organization} by the organisation name. A template cannot contain an access code or sign-in details.","templates.empty":"No templates · senders can write free-text messages only","template.label":"Template name","template.body":"Message text","template.counter":"{n}/{max}","template.add":"Add a template","template.remove":"Delete the template","template.insert_name":"Insert the person's name","template.insert_org":"Insert the organisation name","template.new":"New template","consent.title":"Consent to messages by link","consent.sub":"When this is on, the first message to a person whose consent is unknown is a consent request with a link. The requested message is sent only after the person consents.","consent.switch":"Ask for consent before the first message","consent.on":"On · a person who has not consented first gets a consent request","consent.off":"Off · messages can also go to people whose consent is unknown","consent.wait":"Days to wait for a reply","consent.wait_hint":"{min} to {max} · without a reply the message is not sent and the sender is notified","consent.language":"Consent request language","consent.lang.he":"Hebrew","consent.lang.en":"English","consent.lang.ar":"Arabic (draft)","consent.lang.ru":"Russian (draft)","consent.wa_template":"Approved WhatsApp template name","consent.wa_template_hint":"For first contact. The account owner gets the template approved with WhatsApp","consent.wa_language":"Template language code","consent.rules":"One consent request per person every {days} days · up to {held} messages waiting per person","consent.problem.module_off":"The public page is off · a consent request cannot be sent","consent.problem.public_page":"The public page is unavailable or has no address · a consent request cannot be sent","consent.problem.key":"The link key is missing · a consent request cannot be sent","err.bad_name":"Lower-case Latin letters, digits and underscores only","err.bad_language":"Invalid language code (for example he or en_US)","err.template_send_unsupported":"Sending an approved WhatsApp template is not supported yet - leave it empty","consent.no_template":"The consent request goes out as a plain text message. An approved WhatsApp template cannot be sent yet, so a person who has not written to the account in the last 24 hours may not receive it",save:"Save",saving:"Saving…",revert:"Discard changes",saved:"Saved",unsaved:"There are unsaved changes",invalid:"Correct the marked fields",save_failed:"Saving failed",conflict:"Someone else saved the settings in the meantime",reload:"Reload","err.empty":"Required","err.too_long":"Too long","err.control_chars":"Contains characters that cannot be used","err.credential":"An access code or sign-in details cannot be included","err.unknown_placeholder":"Only {name} and {organization} are allowed between curly braces","err.bad_braces":"Invalid curly braces","err.too_many_placeholders":"Too many replacement words in one template","err.organization_missing":"The template uses the organisation name, which is not set","err.duplicate_label":"A template with this name already exists","err.range":"Out of the allowed range","err.type":"Enter a whole number","err.too_many":"Too many templates","err.window_invalid":"Enter a time like 08:00","err.window_across_midnight":"The start must be earlier than the end","err.window_empty":"The start and the end are the same","err.other":"Invalid value"};function Ns(){return Ee(["en"])}function d(e,t){const s=(Ns()==="en"?We[e]:void 0)??he[e]??e;return je(s,t)}const qs=new Set(Object.keys(he).filter(e=>e.startsWith("err.")).map(e=>e.slice(4)));function Ls(e){return d(qs.has(e)?`err.${e}`:"err.other")}Pe("i18n/access-messaging",{he,en:We});var Ds=Object.defineProperty,Fs=Object.getOwnPropertyDescriptor,w=(e,t,s,i)=>{for(var a=i>1?void 0:i?Fs(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Ds(t,s,a),a};const Is=["he","en","ar","ru"],Us=e=>e==="module_off"?"consent.problem.module_off":e==="key"?"consent.problem.key":"consent.problem.public_page",Te={from:"08:00",to:"21:00"},B=e=>/^\d+$/.test(e.trim())?Number(e):Number.NaN;let Ws=0;const He=()=>`r${++Ws}`;function oe(e){return o`${e.split(/(\{[a-z]+\})/).map(t=>/^\{[a-z]+\}$/.test(t)?o`<bdi class="ltr">${t}</bdi>`:t)}`}const Hs=e=>({revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:String(e.bulk_max),rate_per_hour:String(e.rate_per_hour),per_sender_per_hour:String(e.per_sender_per_hour??50),per_person_per_day:String(e.per_person_per_day??3),per_station_per_hour:String(e.per_station_per_hour??50),hours_on:e.send_hours!==null,hours_from:(e.send_hours??Te).from,hours_to:(e.send_hours??Te).to,organization:e.organization,account:e.account,templates:e.templates.map(t=>({key:He(),id:t.id,label:t.label,body:t.body})),consent_by_link:e.consent_by_link===!0,consent_wait_days:String(e.consent_wait_days??7),consent_language:e.consent_language??"he",consent_wa_template:e.consent_wa_template??"",consent_wa_language:e.consent_wa_language??""}),Re=e=>({revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:B(e.bulk_max),rate_per_hour:B(e.rate_per_hour),per_sender_per_hour:B(e.per_sender_per_hour),per_person_per_day:B(e.per_person_per_day),per_station_per_hour:B(e.per_station_per_hour),send_hours:e.hours_on?{from:e.hours_from.trim(),to:e.hours_to.trim()}:null,organization:e.organization,account:e.account,templates:e.templates.map(t=>({...t.id?{id:t.id}:{},label:t.label,body:t.body})),consent_by_link:e.consent_by_link,consent_wait_days:/^\d+$/.test(e.consent_wait_days.trim())?Number(e.consent_wait_days):Number.NaN,consent_language:e.consent_language,consent_wa_template:e.consent_wa_template.trim(),consent_wa_language:e.consent_wa_language.trim()}),Ce=e=>JSON.stringify([e.enabled,e.free_text,e.bulk_max.trim(),e.rate_per_hour.trim(),e.per_sender_per_hour.trim(),e.per_person_per_day.trim(),e.per_station_per_hour.trim(),e.hours_on,e.hours_from.trim(),e.hours_to.trim(),e.organization.trim(),e.account,e.templates.map(t=>[t.id??"",t.label.trim(),t.body.trim()]),e.consent_by_link,e.consent_wait_days.trim(),e.consent_language,e.consent_wa_template.trim(),e.consent_wa_language.trim()]);let g=class extends j{constructor(){super(...arguments),this.rev=0,this.reply=null,this.draft=null,this.base="",this.loading=!0,this.failed="",this.saving=!1,this.notice="",this.noticeText="",this.submitted=!1,this.touched=new Set,this.remote=[],this.lastRev=0,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.load())}async load(){const e=++this.gen;this.failed="";try{const t=await Gt();if(e!==this.gen)return;this.adopt(t)}catch(t){if(e!==this.gen)return;this.failed=q(t)}finally{e===this.gen&&(this.loading=!1)}}adopt(e){this.reply=e,this.draft=Hs(e.settings),this.base=Ce(this.draft),this.submitted=!1,this.touched=new Set,this.remote=[],this.notice=""}set(e,t=""){this.draft&&(this.draft={...this.draft,...e},this.notice="",this.remote=[],t&&(this.touched=new Set([...this.touched,t])))}setRow(e,t,s){this.draft&&this.set({templates:this.draft.templates.map((i,a)=>a===e?{...i,...t}:i)},`templates.${e}.${s}`)}addRow(){this.draft&&this.set({templates:[...this.draft.templates,{key:He(),label:d("template.new"),body:""}]})}removeRow(e){this.draft&&(this.set({templates:this.draft.templates.filter((t,s)=>s!==e)}),this.touched=new Set)}insert(e,t,s){if(!this.draft)return;const i=this.draft.templates[e],a=Ms(i.body,t,s?.selectionStart??null,s?.selectionEnd??null);this.setRow(e,{body:a.text},"body"),this.updateComplete.then(()=>{s?.focus(),s?.setSelectionRange(a.caret,a.caret)})}revert(){this.reply&&this.adopt(this.reply),this.notice=""}get dirty(){return!!this.draft&&Ce(this.draft)!==this.base}problems(){if(!this.draft)return[];const e=js(Re(this.draft),this.reply?.limits??Ue);return[...e,...this.remote.filter(t=>!e.some(s=>s.path===t.path))]}async save(){if(!(!this.draft||this.saving)&&(this.submitted=!0,!this.problems().length)){this.saving=!0,this.notice="";try{const e=await Bt(Re(this.draft));this.adopt(e),this.notice="saved"}catch(e){const t=Zt(e);t?(this.remote=t,this.notice="failed",this.noticeText=d("invalid")):Vt(e)?this.notice="conflict":(this.notice="failed",this.noticeText=`${d("save_failed")} · ${q(e)}`)}finally{this.saving=!1}}}shown(e){return this.submitted||this.touched.has(e)?Es(this.problems(),e):[]}problemLine(e){const t=this.shown(e);return t.length?o`<div class="problem" role="alert" data-msg-problem=${t[0].code} data-msg-problem-path=${e}><sw-icon name="warning" size=${14}></sw-icon><span>${oe(Ls(t[0].code))}</span></div>`:c}capField(e,t,s){const i=this.draft;return o`<div>
      <sw-field label=${d(`${t}.title`)} hint=${d(`${t}.hint`,{min:s[0],max:s[1]})} ?data-bad=${this.shown(e).length>0}>
        <input type="text" inputmode="numeric" .value=${i[e]} data-msg-setting=${e} @input=${a=>this.set({[e]:a.target.value},e)} />
      </sw-field>
      ${this.problemLine(e)}
    </div>`}serviceLine(e){const t=e.service;let s="ok",i;if(t.problem)s="warn",i=d(`service.${t.problem}`);else if(t.connected===!0){const a=t.accounts.length===1?t.accounts[0].name:t.accounts.find(r=>r.id===this.draft?.account)?.name;i=a?`${d("service.connected")} · ${d("service.account",{name:a})}`:d("service.connected")}else t.connected===!1?(s="warn",i=t.state==="unsupported"?d("service.unsupported"):d("service.not_connected")):(s="muted",i=d("service.unknown"));return o`<div class="svc" data-msg-service=${t.connected===!0&&!t.problem?"connected":t.connected===!1?"not_connected":"unknown"}><span class="dot ${s}"></span><span>${i}</span></div>`}renderTemplate(e,t,s){const i=this.shown(`templates.${t}.label`),a=this.shown(`templates.${t}.body`);return o`<div class="tpl" data-msg-template-row=${t} data-msg-template-key=${e.id??"new"}>
      <div class="tpl-head">
        <sw-field label=${d("template.label")} ?data-bad=${i.length>0}>
          <input type="text" maxlength=${s.label_max*2} .value=${e.label} data-msg-template-label @input=${r=>this.setRow(t,{label:r.target.value},"label")} />
        </sw-field>
        <sw-button variant="ghost" iconOnly icon="trash" label=${d("template.remove")} data-msg-template-remove @click=${()=>this.removeRow(t)}></sw-button>
      </div>
      ${this.problemLine(`templates.${t}.label`)}
      <sw-field label=${d("template.body")} ?data-bad=${a.length>0}>
        <textarea rows="4" .value=${e.body} data-msg-template-body @input=${r=>this.setRow(t,{body:r.target.value},"body")}></textarea>
      </sw-field>
      ${this.problemLine(`templates.${t}.body`)}
      <div class="tpl-foot">
        <div class="chips">
          <button type="button" class="chipbtn" data-msg-insert="name" @click=${r=>this.insert(t,"{name}",this.textareaOf(r))}>${d("template.insert_name")}</button>
          <button type="button" class="chipbtn" data-msg-insert="organization" @click=${r=>this.insert(t,"{organization}",this.textareaOf(r))}>${d("template.insert_org")}</button>
        </div>
        <span class="cnt" aria-hidden="true">${d("template.counter",{n:e.body.length,max:s.body_max})}</span>
      </div>
    </div>`}textareaOf(e){return e.currentTarget.closest(".tpl")?.querySelector("textarea")??null}renderConsent(e,t){const s=t.consent,i=s?.page_problem??null;return o`<sw-card flush data-msg-settings-card="consent">
      <div class="ch"><div><h3>${d("consent.title")}</h3><div class="sub">${d("consent.sub")}</div></div></div>
      <button type="button" class="sw" role="switch" aria-checked=${String(e.consent_by_link)} data-msg-setting="consent_by_link" @click=${()=>this.set({consent_by_link:!e.consent_by_link},"consent_by_link")}>
        ${Z(d("consent.switch"),e.consent_by_link?d("consent.on"):d("consent.off"))}
      </button>
      ${this.problemLine("consent_by_link")}
      ${e.consent_by_link&&i?o`<div class="note err" role="alert" data-msg-consent-problem=${i}><sw-icon name="warning" size=${16}></sw-icon><span>${d(Us(i))}</span></div>`:c}
      <div class="fields">
        <div>
          <sw-field label=${d("consent.wait")} hint=${d("consent.wait_hint",{min:s?.wait_days[0]??1,max:s?.wait_days[1]??30})} ?data-bad=${this.shown("consent_wait_days").length>0}>
            <input type="text" inputmode="numeric" .value=${e.consent_wait_days} data-msg-setting="consent_wait_days" @input=${a=>this.set({consent_wait_days:a.target.value},"consent_wait_days")} />
          </sw-field>
          ${this.problemLine("consent_wait_days")}
        </div>
        <div>
          <sw-field label=${d("consent.language")}>
            <select data-msg-setting="consent_language" @change=${a=>this.set({consent_language:a.target.value})}>
              ${Is.map(a=>o`<option value=${a} ?selected=${e.consent_language===a}>${d(`consent.lang.${a}`)}</option>`)}
            </select>
          </sw-field>
        </div>
        ${s?.template_send_supported===!1?c:o`<div>
          <sw-field label=${d("consent.wa_template")} hint=${d("consent.wa_template_hint")} ?data-bad=${this.shown("consent_wa_template").length>0}>
            <input type="text" dir="ltr" .value=${e.consent_wa_template} data-msg-setting="consent_wa_template" @input=${a=>this.set({consent_wa_template:a.target.value},"consent_wa_template")} />
          </sw-field>
          ${this.problemLine("consent_wa_template")}
        </div>
        <div>
          <sw-field label=${d("consent.wa_language")} ?data-bad=${this.shown("consent_wa_language").length>0}>
            <input type="text" dir="ltr" .value=${e.consent_wa_language} data-msg-setting="consent_wa_language" @input=${a=>this.set({consent_wa_language:a.target.value},"consent_wa_language")} />
          </sw-field>
          ${this.problemLine("consent_wa_language")}
        </div>`}
      </div>
      ${s?.template_send_supported===!1?o`<div class="hint" data-msg-consent-no-template>${d("consent.no_template")}</div>`:c}
      <div class="hint" data-msg-consent-rules>${d("consent.rules",{days:s?.resend_days??30,held:s?.held_per_person??3})}</div>
    </sw-card>`}render(){if(this.loading)return o`<div class="stack" data-access-status="loading"><sw-card flush>${S(4)}</sw-card></div>`;if(!this.draft||!this.reply)return o`<div class="stack" data-access-status="error">${_("error",this.failed,()=>void this.load())}</div>`;const e=this.draft,t=this.reply,s=t.limits,i=t.service.accounts,a=this.dirty,r=this.submitted&&this.problems().length>0;return o`<div class="stack" data-access-status="ready" data-msg-settings>
      <sw-card flush data-msg-settings-card="general">
        <div class="ch"><div><h3>${d("title")}</h3><div class="sub">${d("sub")}</div></div></div>
        ${this.serviceLine(t)}
        <button type="button" class="sw" role="switch" aria-checked=${String(e.enabled)} data-msg-setting="enabled" @click=${()=>this.set({enabled:!e.enabled})}>
          ${Z(d("enabled.title"),e.enabled?d("enabled.on"):d("enabled.off"))}
        </button>
        <button type="button" class="sw" role="switch" aria-checked=${String(e.free_text)} data-msg-setting="free_text" @click=${()=>this.set({free_text:!e.free_text})}>
          ${Z(d("free.title"),e.free_text?d("free.on"):d("free.off"))}
        </button>
        <div class="hint" data-msg-optout-note>${d("optout.note")}</div>
        <div class="fields">
          <div>
            <sw-field label=${d("bulk.title")} hint=${d("bulk.hint",{min:s.bulk_max[0],max:s.bulk_max[1]})} ?data-bad=${this.shown("bulk_max").length>0}>
              <input type="text" inputmode="numeric" .value=${e.bulk_max} data-msg-setting="bulk_max" @input=${l=>this.set({bulk_max:l.target.value},"bulk_max")} />
            </sw-field>
            ${this.problemLine("bulk_max")}
          </div>
          <div>
            <sw-field label=${d("rate.title")} hint=${d("rate.hint",{min:s.rate_per_hour[0],max:s.rate_per_hour[1]})} ?data-bad=${this.shown("rate_per_hour").length>0}>
              <input type="text" inputmode="numeric" .value=${e.rate_per_hour} data-msg-setting="rate_per_hour" @input=${l=>this.set({rate_per_hour:l.target.value},"rate_per_hour")} />
            </sw-field>
            ${this.problemLine("rate_per_hour")}
          </div>
          ${this.capField("per_sender_per_hour","sender",s.per_sender_per_hour??[1,1e3])}
          ${this.capField("per_person_per_day","person",s.per_person_per_day??[1,50])}
          ${this.capField("per_station_per_hour","station",s.per_station_per_hour??[1,1e3])}
          <div data-msg-send-hours>
            <button type="button" class="sw" role="switch" aria-checked=${String(e.hours_on)} data-msg-setting="send_hours" @click=${()=>this.set({hours_on:!e.hours_on},"send_hours")}>
              ${Z(d("hours.title"),e.hours_on?d("hours.on"):d("hours.off"))}
            </button>
            ${e.hours_on?o`<div class="fields">
                  <sw-field label=${d("hours.from")} ?data-bad=${this.shown("send_hours").length>0}>
                    <input type="time" lang=${ge()} class="ltr" .value=${e.hours_from} data-msg-setting="send_hours_from" @input=${l=>this.set({hours_from:l.target.value},"send_hours")} />
                  </sw-field>
                  <sw-field label=${d("hours.to")} ?data-bad=${this.shown("send_hours").length>0}>
                    <input type="time" lang=${ge()} class="ltr" .value=${e.hours_to} data-msg-setting="send_hours_to" @input=${l=>this.set({hours_to:l.target.value},"send_hours")} />
                  </sw-field>
                </div>`:c}
            ${this.problemLine("send_hours")}
          </div>
          <div>
            <sw-field label=${d("org.title")} ?data-bad=${this.shown("organization").length>0}>
              <input type="text" .value=${e.organization} data-msg-setting="organization" @input=${l=>this.set({organization:l.target.value},"organization")} />
            </sw-field>
            <div class="hint" data-msg-org-hint>${oe(d("org.hint"))}</div>
            ${this.problemLine("organization")}
          </div>
          ${i.length>1?o`<div>
                <sw-field label=${d("account.title")}>
                  <select data-msg-setting="account" @change=${l=>this.set({account:l.target.value})}>
                    <option value="" ?selected=${e.account===""}>${d("account.choose")}</option>
                    ${i.map(l=>o`<option value=${l.id} ?selected=${e.account===l.id}>${l.name}</option>`)}
                  </select>
                </sw-field>
              </div>`:c}
        </div>
      </sw-card>

      ${this.renderConsent(e,t)}

      <sw-card flush data-msg-settings-card="templates">
        <div class="ch">
          <div><h3>${d("templates.title")}</h3><div class="sub">${oe(d("templates.sub"))}</div></div>
          <div class="ctl"><sw-button icon="plus" data-msg-template-add ?disabled=${e.templates.length>=s.templates_max} @click=${()=>this.addRow()}>${d("template.add")}</sw-button></div>
        </div>
        ${this.problemLine("templates")}
        ${e.templates.length===0?o`<div class="empty" data-msg-templates-empty>${d("templates.empty")}</div>`:e.templates.map((l,h)=>this.renderTemplate(l,h,s))}
      </sw-card>

      <div class="actions" data-msg-actions>
        <span class="grow">
          ${this.notice==="saved"?o`<span class="note info" role="status" data-msg-notice="saved"><sw-icon name="check" size=${16}></sw-icon><span>${d("saved")}</span></span>`:c}
          ${this.notice==="failed"?o`<span class="note err" role="alert" data-msg-notice="failed"><sw-icon name="warning" size=${16}></sw-icon><span>${this.noticeText}</span></span>`:c}
          ${this.notice==="conflict"?o`<span class="note stale" role="alert" data-msg-notice="conflict"><sw-icon name="warning" size=${16}></sw-icon><span>${d("conflict")}</span><sw-button size="sm" data-msg-reload @click=${()=>void this.load()}>${d("reload")}</sw-button></span>`:c}
          ${this.notice===""&&r?o`<span class="note err" role="alert" data-msg-notice="invalid"><sw-icon name="warning" size=${16}></sw-icon><span>${d("invalid")}</span></span>`:c}
          ${this.notice===""&&!r&&a?o`<span class="note info" data-msg-notice="unsaved"><span>${d("unsaved")}</span></span>`:c}
        </span>
        <sw-button data-msg-revert ?disabled=${!a||this.saving} @click=${()=>this.revert()}>${d("revert")}</sw-button>
        <sw-button variant="primary" data-msg-save ?disabled=${!a||this.saving} @click=${()=>void this.save()}>${this.saving?d("saving"):d("save")}</sw-button>
      </div>

      <wa-installed-card></wa-installed-card>
    </div>`}};g.styles=[H,Le,P`
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
    `,Q,W];w([T({type:Number})],g.prototype,"rev",2);w([u()],g.prototype,"reply",2);w([u()],g.prototype,"draft",2);w([u()],g.prototype,"base",2);w([u()],g.prototype,"loading",2);w([u()],g.prototype,"failed",2);w([u()],g.prototype,"saving",2);w([u()],g.prototype,"notice",2);w([u()],g.prototype,"noticeText",2);w([u()],g.prototype,"submitted",2);w([u()],g.prototype,"touched",2);w([u()],g.prototype,"remote",2);g=w([E("system-access-messaging")],g);var Ks=Object.defineProperty,Js=Object.getOwnPropertyDescriptor,R=(e,t,s,i)=>{for(var a=i>1?void 0:i?Js(t,s):t,r=e.length-1,l;r>=0;r--)(l=e[r])&&(a=(i?l(t,s,a):l(a))||a);return i&&a&&Ks(t,s,a),a};let x=class extends j{constructor(){super(...arguments),this.view="",this.rev=0,this.meta=null,this.zone=te,this.admin=!0,this.wide=!0,this.people=!0,this.configure=!1,this.stop=null,this.onMeta=e=>{const t=e.detail;this.meta=t.meta,this.zone=t.zone}}connectedCallback(){super.connectedCallback(),this.sync(),this.stop=Oe(()=>this.sync())}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}sync(){const e=ee();this.admin=e.admin,this.people=e.people,this.wide=!b()||U("access.admin.read"),this.configure=b()&&U("system.configure")}segments(){const e=[{id:"status",label:n("segStatus")}];return this.wide&&e.push({id:"audit",label:n("segAudit")}),(this.people||this.wide)&&e.push({id:"groups",label:n("segGroups")}),this.configure&&e.push({id:"policy",label:n("segPolicy")}),this.configure&&e.push({id:"messaging",label:d("segment")}),e}active(e){return e.find(t=>t.id===this.view)?.id??"status"}subtitle(){if(!this.meta)return"";const e=Ht(this.meta,new Date,this.zone);return[e.version?n("hlVersion",{v:e.version}):"",e.connected===!0?n("hlConnected"):e.connected===!1?n("hlDisconnected"):"",e.checked.key!=="none"?n("hlChecked",{when:$(e.checked)}):""].filter(Boolean).join(" · ")}render(){if(b()&&!this.admin)return o`<sw-page heading=${n("title")}><sw-state-panel quiet data-access-state="no_permission" state="forbidden" heading=${n("noPermission")}></sw-state-panel></sw-page>`;const e=this.segments(),t=this.active(e),s=e.map(i=>({id:i.id,label:i.label,href:`${Ze}${i.id==="status"?"":`/${i.id}`}`}));return o`<sw-page heading=${n("title")} subheading=${this.subtitle()} wide>
      <sw-button slot="actions" size="lg" variant="ghost" icon="refresh" data-access-refresh @click=${()=>this.rev+=1}>${n("refresh")}</sw-button>
      ${e.length>1?o`<div class="segs"><sw-tabs .items=${s} .active=${t} .variant=${Ve(null,2)} group-label=${n("segments")} data-access-segments></sw-tabs></div>`:c}
      <div class="body" data-access-segment=${t}>
        ${t==="audit"?o`<system-access-audit .rev=${this.rev} @access-meta=${this.onMeta}></system-access-audit>`:t==="groups"?o`<system-access-groups .rev=${this.rev} @access-meta=${this.onMeta}></system-access-groups>`:t==="policy"?o`<system-access-policy .rev=${this.rev}></system-access-policy>`:t==="messaging"?o`<system-access-messaging .rev=${this.rev}></system-access-messaging>`:o`<system-access-status .rev=${this.rev} @access-meta=${this.onMeta}></system-access-status>`}
        <wk-deep-links class="deeplinks" place=${`settings-${t}`}></wk-deep-links>
      </div>
    </sw-page>`}};x.styles=[Yt,P`
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
      .deeplinks {
        margin-block-start: var(--sw-s-3, 12px);
      }
    `,W];R([T()],x.prototype,"view",2);R([u()],x.prototype,"rev",2);R([u()],x.prototype,"meta",2);R([u()],x.prototype,"zone",2);R([u()],x.prototype,"admin",2);R([u()],x.prototype,"wide",2);R([u()],x.prototype,"people",2);R([u()],x.prototype,"configure",2);x=R([E("system-access-control")],x);export{x as SystemAccessControl};
