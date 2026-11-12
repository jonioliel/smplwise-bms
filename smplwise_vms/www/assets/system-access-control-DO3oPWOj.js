import{E as C,F as R,a as j,e as r,A as c,H as E,C as W,G as u,i as _,bd as U,b9 as Re,g as Ce,Y as L,bR as Ne,aa as Le,at as qe,mf as De,q as de,n as pe,cs as he,cn as ue,td as Fe,kp as Ie,s4 as Ue}from"./index-D8-Lulvz.js";import"./wk-deep-links-CndW7mao.js";import"./sw-table-AIwBIYpC.js";import{c as We,d as He,b as oe,e as Ke,a as Je,g as Ge,A as Be,f as Ze,h as Ve,i as Xe}from"./access-status-xq1MFzPs.js";import{R as y,s as n,m as Te,a as te,b as D,c as me,d as F,e as I,y as ve,f as Ye,g as Qe,h as es,i as ss,j as $,k,l as ts,n as as,o as ns,p as is,q as rs,t as os,r as b,u as ls,v as cs,z as ds,w as ps,x as hs,A as us,B as ms,C as fe,D as z,E as vs,F as fs,G as gs,H as ws,I as bs,J as _s,K as ys,L as ge,M as we,N as $s,O as xs,P as ks,Q as zs,S as Ss,T as Oe,U as Ae,V as Rs,W as Cs,X as Ts,Y as Os,Z as As,_ as Ps,$ as js,a0 as be,a1 as Es,a2 as Ms,a3 as Ns}from"./status-text-BDPh0xxS.js";import{b as _e,c as Ls}from"./events-logic-BoHem6Ex.js";import{s as H,C as v}from"./status-css-C-iUDxaY.js";import{U as ee}from"./wiskey-format-DJ4vUeXA.js";import{l as re,h as qs,g as Ds,p as Fs,s as Is,i as Us}from"./access-messaging-thbuuTIj.js";import{a as Q}from"./access-DB3neQEf.js";import"./sw-logo-art-Va6y_cIM.js";import"./deep-links-DcLXvoYw.js";import"./wiskey-profiles-8s8nupq2.js";var Ws=Object.defineProperty,Hs=Object.getOwnPropertyDescriptor,V=(e,s,t,i)=>{for(var a=i>1?void 0:i?Hs(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(s,t,a):l(a))||a);return i&&a&&Ws(s,t,a),a};const Ks={ok:"ok",warn:"warn",err:"err",off:"off",unk:"unk"};let q=class extends j{constructor(){super(...arguments),this.station=null,this.zone={kind:"iana",name:"UTC"},this.rev=0,this.now=new Date,this.health=null,this.history=null,this.ctl=null,this.loadedFor="",this.lastRev=0}willUpdate(e){const s=this.station?.id??"";if(s&&(s!==this.loadedFor||e.has("rev")&&this.rev!==this.lastRev)){const t=s===this.loadedFor;this.lastRev=this.rev,t?(this.health?.reload(),this.history?.reload()):this.start(s)}}disconnectedCallback(){this.stop(),super.disconnectedCallback()}start(e){this.stop(),this.loadedFor=e,this.ctl=new AbortController;const s=this.ctl.signal;this.health=new y({fetch:()=>We(e,s),pick:t=>t.health,onChange:()=>this.requestUpdate()}),this.history=new y({fetch:()=>He(e,s),pick:t=>t.history,onChange:()=>this.requestUpdate()}),this.health.reload(),this.history.reload()}stop(){this.ctl?.abort(),this.health?.dispose(),this.history?.dispose(),this.health=null,this.history=null,this.loadedFor=""}row(e,s){return r`<dt>${e}</dt><dd>${s}</dd>`}tone(e,s){return r`<span class="with"><span class="dot ${Ks[e]}" aria-hidden="true"></span>${s}</span>`}connection(e){const s=e.requests,t=e.online;return r`<section class="sect" data-health-section="connection">
      <h4>${n("hdConnection")}</h4>
      <dl>
        ${this.row(n("hdState"),t===null?"—":this.tone(t?"ok":"off",t?n("hdOnline"):n("hdOffline")))}
        ${this.row(n("hdFirmware"),r`<bdi class="ltr">${Te(null,e.firmware)||"—"}</bdi>`)}
        ${this.row(n("hdPollFailures"),e.consecutive_poll_failures===null?"—":String(e.consecutive_poll_failures))}
        ${this.row(n("hdRequests"),s.requests===null?"—":n("hdRequestsVal",{n:s.requests,f:s.failures??0}))}
        ${this.row(n("hdLastMs"),te(s.last_ms))}
        ${this.row(n("hdP95"),te(s.p95_ms))}
      </dl>
    </section>`}access(e){const s=e.access,t=D(s.sync_state,!0),i=me(s.assignment_states,o=>F(D(o,!0).word)),a=me(s.errors,o=>I(o));return r`<section class="sect" data-health-section="sync">
      <h4>${n("hdSync")}</h4>
      <dl>
        ${this.row(n("hdSyncState"),r`<sw-badge kind=${t.kind} label=${F(t.word)}></sw-badge>`)}
        ${s.last_error?this.row(n("colError"),I(s.last_error)):c}
        ${this.row(n("hdQueue"),s.queue_depth===null?"—":String(s.queue_depth))}
        ${this.row(n("hdWorker"),ve(s.worker_active))}
        ${this.row(n("hdPendingRequest"),ve(s.pending_request))}
        ${i?this.row(n("hdAssignments"),i):c}
        ${a?this.row(n("hdErrors"),a):c}
      </dl>
    </section>`}events(e){const s=e.events;return s?r`<section class="sect" data-health-section="events">
      <h4>${n("hdEvents")}</h4>
      <dl>
        ${this.row(n("hdStream"),this.tone(Ye(s.stream),Qe(s.stream)))}
        ${this.row(n("hdHistoryState"),this.tone(es(s.history),ss(s.history)))}
        ${this.row(n("hdReconnects"),s.reconnects===null?"—":String(s.reconnects))}
        ${this.row(n("hdLastFrame"),$(k(s.last_frame_at,this.now,this.zone)))}
        ${s.storage_failed?this.row(n("hdStorageFailed"),n("hdYes")):c}
      </dl>
    </section>`:r`<section class="sect" data-health-section="events"><h4>${n("hdEvents")}</h4><div class="none">${n("hdNoEvents")}</div></section>`}clock(e){const s=e.clock;return s?r`<section class="sect" data-health-section="clock">
      <h4>${n("hdClock")}</h4>
      <dl>
        ${this.row(n("hdClockStatus"),this.tone(ts(s.status),as(s.status)))}
        ${this.row(n("hdSkew"),ns(s.skew_seconds))}
        ${this.row(n("hdDrift"),this.tone(is(s.drift_state),rs(s.drift_state)))}
        ${this.row(n("hdTimeMode"),os(s.time_mode))}
        ${this.row(n("hdChecked"),$(k(s.checked_at,this.now,this.zone)))}
        ${s.error?this.row(n("hdClockError"),I(s.error)):c}
      </dl>
    </section>`:r`<section class="sect" data-health-section="clock"><h4>${n("hdClock")}</h4><div class="none">${n("hdNoClock")}</div></section>`}strip(){const e=this.history,s=e?.snap;if(!e||!s||s.busy&&!s.data)return r`<section class="sect sk-box" data-health-section="history"><h4>${n("hdHistory")}</h4><span class="sk"></span></section>`;if(!s.data)return r`<section class="sect" data-health-section="history"><h4>${n("hdHistory")}</h4>${s.failure&&s.failure!=="forbidden"?b(s.failure,s.message,()=>void e.reload(),!0):c}</section>`;const t=ls(s.data.records,this.zone,this.now),i=t.some(a=>a.samples>0);return r`<section class="sect" data-health-section="history">
      <h4>${n("hdHistory")}</h4>
      ${i?r`<div class="strip" data-health-strip>
            ${t.map(a=>{const o=`${_e(a.date).replace(/\.\d{4}$/,"")}${a.onlinePct===null?"":` · ${n("hdHistoryPct",{p:a.onlinePct})}`}${a.pollMs===null?"":` · ${te(a.pollMs)}`}`;return r`<div class="day ${a.tone}" role="img" aria-label=${o} title=${o} data-health-day=${a.date}><span class="bar"></span><span class="pct">${a.onlinePct===null?"—":`${a.onlinePct}%`}</span><span class="dt">${_e(a.date).replace(/\.\d{4}$/,"")}</span></div>`})}
          </div>`:r`<div class="none">${n("hdHistoryNone")}</div>`}
      ${s.data.storage_failed?r`<div class="none">${n("hdHistoryStorage")}</div>`:c}
    </section>`}render(){if(!this.station)return c;const s=this.health,t=s?.snap;if(!s||!t||t.busy&&!t.data)return r`<section class="sect sk-box" data-health-loading aria-busy="true"><span class="sk"></span><span class="sk"></span><span class="sk"></span></section>`;if(!t.data)return r`${t.failure?b(t.failure,t.message,()=>void s.reload(),!0):c}`;const i=s.stale;return r`
      ${i?r`<div class="note" role="status" data-health-stale><sw-icon name="offline" size=${16}></sw-icon><span>${t.fetchedAt?n("stale",{t:$(k(t.fetchedAt,this.now,this.zone))}):n("staleNever")}</span></div>`:c}
      ${this.connection(t.data)}${this.access(t.data)}${this.events(t.data)}${this.clock(t.data)}${this.strip()}
    `}};q.styles=C`
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
  `;V([R({attribute:!1})],q.prototype,"station",2);V([R({attribute:!1})],q.prototype,"zone",2);V([R({type:Number})],q.prototype,"rev",2);V([R({attribute:!1})],q.prototype,"now",2);q=V([E("system-access-health")],q);const X=C`
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
`;var Js=Object.defineProperty,Gs=Object.getOwnPropertyDescriptor,K=(e,s,t,i)=>{for(var a=i>1?void 0:i?Gs(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(s,t,a):l(a))||a);return i&&a&&Js(s,t,a),a};const Bs=6e4;let O=class extends j{constructor(){super(...arguments),this.rev=0,this.selected="",this.kind="",this.muted=!1,this.wide=!0,this.timer=0,this.stopSession=null,this.lastMeta="",this.lastRev=0,this.nameOf=e=>this.stationsRes.snap.data?.find(s=>s.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.stationsRes=new y({fetch:()=>oe(),pick:s=>s.stations,onChange:e}),this.syncRes=new y({fetch:()=>Ke(),pick:s=>s.sync_status,onChange:e}),this.alertsRes=new y({fetch:s=>Je({kind:this.kind,includeSuppressed:this.muted,offset:typeof s=="number"?s:0}),pick:s=>s.alerts,merge:cs,cursorOf:s=>s.next_offset,onChange:e}),this.conflictsRes=new y({fetch:()=>Ge(),pick:s=>s.conflicts,onChange:e}),this.wide=!_()||U("access.admin.read"),this.stopSession=Re(()=>{const s=!_()||U("access.admin.read");s!==this.wide&&(this.wide=s,this.reloadAll())}),this.reloadAll(),this.timer=window.setInterval(()=>{(typeof document>"u"||document.visibilityState==="visible")&&this.reloadAll()},Bs)}disconnectedCallback(){window.clearInterval(this.timer),this.stopSession?.();for(const e of[this.stationsRes,this.syncRes,this.alertsRes,this.conflictsRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),this.syncRes.reload(),this.alertsRes.reload(),this.wide&&this.conflictsRes.reload()}emitMeta(){const e=this.stationsRes?.snap.reply?.sync??this.syncRes?.snap.reply?.sync??this.alertsRes?.snap.reply?.sync??null,s=JSON.stringify(e);s!==this.lastMeta&&(this.lastMeta=s,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.defaultZone()},bubbles:!0,composed:!0})))}defaultZone(){return this.stationsRes?.snap.reply?.default_zone??ee}zoneOf(e){return ds(this.stationsRes.snap.data,e,this.defaultZone())}tiles(e){const s=ps(this.stationsRes.snap.data,this.syncRes.snap.data,this.wide?this.conflictsRes.snap.data:null),t=this.defaultZone(),i=(a,o,l,h="",p="")=>r`<div class="tile" data-access-tile=${a}><span class="k">${o?n(o):""}</span><span class="v ${p}">${l}</span>${h?r`<span class="d">${h}</span>`:r`<span class="d">&nbsp;</span>`}</div>`;return r`<div class="tiles" data-access-tiles>
      ${i("online","kpiOnline",String(s.online),n("kpiOnlineOf",{total:s.total}),s.total>0&&s.online<s.total?"warn":"")}
      ${i("pending","kpiPending",s.pending===null?"—":String(s.pending),"",(s.pending??0)>0?"warn":"")}
      ${s.conflicts===null?c:i("conflicts","kpiConflicts",String(s.conflicts),"",s.conflicts>0?"err":"")}
      ${i("last-sync","kpiLastSync",s.lastSync?Ls(s.lastSync,t):"—",s.lastSync?$(k(s.lastSync,e,t)):"")}
    </div>`}stationRow(e,s){const t=hs(e),i=D(e.sync_state,e.online),a=Te(e.technical?.model,e.technical?.firmware);return r`<button type="button" class="row two" data-access-station=${e.id} aria-label=${n("healthOpen",{name:e.name})} @click=${()=>this.selected=e.id}>
      <span class="dot ${t}" aria-hidden="true"></span>
      <span class="main"><span class="t">${e.name}</span>${a?r`<span class="s"><bdi class="ltr">${a}</bdi></span>`:c}</span>
      <span class="side"><sw-badge kind=${i.kind} label=${F(i.word)}></sw-badge><span class="when">${$(k(e.last_seen,s,this.zoneOf(e.id)))}</span></span>
      <sw-icon class="chev" name="chevronBack" size=${16}></sw-icon>
    </button>`}healthCard(e){const s=this.stationsRes.snap.data??[];return r`<sw-card flush data-access-card="health">
      <div class="ch"><div><h3>${n("healthTitle")}</h3><div class="sub">${n("healthSub")}</div></div></div>
      ${s.length?r`<div class="list">${s.map(t=>this.stationRow(t,e))}</div>`:r`<div class="empty">${n("healthEmpty")}</div>`}
    </sw-card>`}kindItems(){return[{id:"",label:n("alertKindAll")},...Be.map(e=>({id:e,label:n(`alert_${e}`)}))]}alertRow(e,s){const t=us(e);return r`<div class="row" data-access-alert=${e.id} data-tone=${t}>
      <span class="dot ${t==="muted"?"muted":t}" aria-hidden="true"></span>
      <span class="main"><span class="t">${ms(e)}</span>${fe(e,s,this.zoneOf(e.station_id))?r`<span class="s wrap">${fe(e,s,this.zoneOf(e.station_id))}</span>`:c}</span>
    </div>`}alertsCard(e){const s=this.alertsRes,t=s.snap,i=t.data;let a;return!t.everAnswered||t.busy&&!i?a=z(3):i?i.items.length?a=r`<div class="list" data-access-alerts>${i.items.map(o=>this.alertRow(o,e))}</div>`:a=r`<div class="empty" data-access-alerts-empty><span class="dot ok" aria-hidden="true"></span>${n("alertsEmpty")}</div>`:a=r`<div class="empty-panel">${b(t.failure??"error",t.message,()=>void s.reload(),!0)}</div>`,r`<sw-card flush data-access-card="alerts">
      <div class="ch">
        <div><h3>${n("alertsTitle")}</h3><div class="sub">${n("alertsSub",{n:i?i.total??i.items.length:0})}</div></div>
        <div class="ctl">
          <sw-dropdown tall data-access-alert-kind label=${n("alertKind")} .items=${this.kindItems()} .value=${this.kind} @change=${o=>this.setKind(o.detail.id)}></sw-dropdown>
          <button type="button" class="chipbtn" data-access-alerts-muted aria-pressed=${String(this.muted)} @click=${()=>this.toggleMuted()}>${n("alertMutedShow")}</button>
        </div>
      </div>
      ${s.stale&&i?r`<div class="note stale" role="status" data-access-stale="alerts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(t.fetchedAt,e)}</span></div>`:c}
      ${a}
      ${i&&!i.complete?r`<div class="note info" role="status" data-access-alerts-partial><sw-icon name="info" size=${16}></sw-icon><span>${n("alertsPartial")}</span></div>`:c}
      ${s.hasMore?r`<div class="more"><sw-button size="lg" data-access-alerts-more ?disabled=${t.loadingMore} @click=${()=>void s.more()}>${t.loadingMore?n("loadingMore"):n("more")}</sw-button></div>`:c}
      ${t.moreFailed?r`<div class="note err" role="alert" data-access-alerts-more-failed><span>${n("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void s.more()}>${n("retry")}</sw-button></div>`:c}
    </sw-card>`}setKind(e){this.kind=e,this.alertsRes.reload()}toggleMuted(){this.muted=!this.muted,this.alertsRes.reload()}staleText(e,s){return e?n("stale",{t:$(k(e,s,this.defaultZone()))}):n("staleNever")}syncCard(e){const s=this.syncRes,t=s.snap,i=vs(t.data,this.nameOf),a=p=>p>0?String(p):"—",o=p=>p,l=[{key:"name",label:n("colStation"),render:p=>r`<span style=${v.strong}>${o(p).name}</span>`},{key:"managed",label:n("colManaged"),render:p=>o(p).managed===null?"—":String(o(p).managed)},{key:"pending",label:n("colPending"),render:p=>a(o(p).pending)},{key:"removals",label:n("colRemovals"),render:p=>a(o(p).removals)},{key:"failed",label:n("colFailed"),render:p=>a(o(p).failed)},{key:"last",label:n("colLastSync"),render:p=>$(k(o(p).reconciledAt,e,this.zoneOf(o(p).id)))},{key:"state",label:n("colState"),render:p=>{const g=D(o(p).state,!0);return r`<span style=${v.row}><sw-badge kind=${g.kind} label=${F(g.word)}></sw-badge>${o(p).error?r`<span style=${v.muted}>${I(o(p).error)}</span>`:c}</span>`}}];let h;return!t.everAnswered||t.busy&&!t.data?h=z(3):t.data?i.length?h=r`<sw-table data-access-sync .columns=${l} .rows=${i} rowKey="id"></sw-table>`:h=r`<div class="empty">${n("syncEmpty")}</div>`:h=b(t.failure??"error",t.message,()=>void s.reload(),!0),r`<sw-card flush data-access-card="sync">
      <div class="ch"><div><h3>${n("syncTitle")}</h3><div class="sub">${n("syncSub")}</div></div></div>
      ${s.stale&&t.data?r`<div class="note stale" role="status" data-access-stale="sync"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(t.fetchedAt,e)}</span></div>`:c}
      ${h}
    </sw-card>`}conflictsCard(e){if(!this.wide)return c;const s=this.conflictsRes,t=s.snap;if(t.failure==="forbidden")return c;const i=h=>h,a=[{key:"who",label:n("colWho"),render:h=>{const p=fs(i(h));return p.kind==="name"?r`<span style=${v.strong}>${p.text}</span>`:p.kind==="employee"?r`<span>${n("employeeShort",{n:p.text})}</span>`:r`<span style=${v.muted}>${n("unnamed")}</span>`}},{key:"kind",label:n("colKind"),render:h=>n(gs(i(h).kind))},{key:"station",label:n("colStation"),render:h=>this.nameOf(i(h).station_id)},{key:"state",label:n("colState"),render:h=>{const p=D(i(h).sync_state,!0);return r`<sw-badge kind=${p.kind} label=${F(p.word)}></sw-badge>`}},{key:"error",label:n("colError"),render:h=>I(i(h).last_error)||"—"}],o=(t.data??[]).map((h,p)=>({...h,id:`${h.station_id}/${h.kind}/${h.person?.id??p}`}));let l;return!t.everAnswered||t.busy&&!t.data?l=z(2):t.data?o.length?l=r`<sw-table data-access-conflicts .columns=${a} .rows=${o} rowKey="id"></sw-table>`:l=r`<div class="empty" data-access-conflicts-empty><span class="dot ok" aria-hidden="true"></span>${n("conflictsEmpty")}</div>`:l=b(t.failure??"error",t.message,()=>void s.reload(),!0),r`<sw-card flush data-access-card="conflicts">
      <div class="ch"><div><h3>${n("conflictsTitle")}</h3><div class="sub">${n("conflictsSub")}</div></div></div>
      ${s.stale&&t.data?r`<div class="note stale" role="status" data-access-stale="conflicts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(t.fetchedAt,e)}</span></div>`:c}
      ${l}
    </sw-card>`}drawer(e){const s=this.selected?this.stationsRes.snap.data?.find(i=>i.id===this.selected):void 0,t=s?D(s.sync_state,s.online):null;return r`<sw-drawer modal ?open=${!!s} heading=${s?.name??""} @close=${()=>this.selected=""} data-access-health-drawer>
      ${t?r`<sw-badge slot="action" kind=${t.kind} label=${F(t.word)}></sw-badge>`:c}
      ${s?r`<system-access-health data-access-health=${s.id} .station=${s} .zone=${this.zoneOf(s.id)} .rev=${this.rev} .now=${e}></system-access-health>`:c}
    </sw-drawer>`}render(){const e=new Date,s=this.stationsRes,t=s.snap;return!t.everAnswered||t.busy&&!t.data?r`<div class="stack" data-access-status="loading">${ws()}<sw-card flush>${z(4)}</sw-card></div>`:t.data?r`<div class="stack" data-access-status="ready">
        ${s.stale?r`<div class="note stale" role="status" data-access-stale="page"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(t.fetchedAt,e)}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>this.reloadAll()}>${n("refresh")}</sw-button></div>`:c}
        ${this.tiles(e)}
        <div class="grid2">${this.healthCard(e)}${this.alertsCard(e)}</div>
        ${this.syncCard(e)}
        ${this.conflictsCard(e)}
      </div>
      ${this.drawer(e)}`:r`<div class="stack" data-access-status=${t.failure??"error"}>${b(t.failure??"error",t.message,()=>this.reloadAll())}</div>`}};O.styles=[H,C`
      .when {
        white-space: nowrap;
      }
    `,X,W];K([R({type:Number})],O.prototype,"rev",2);K([u()],O.prototype,"selected",2);K([u()],O.prototype,"kind",2);K([u()],O.prototype,"muted",2);K([u()],O.prototype,"wide",2);O=K([E("system-access-status")],O);var Zs=Object.defineProperty,Vs=Object.getOwnPropertyDescriptor,J=(e,s,t,i)=>{for(var a=i>1?void 0:i?Vs(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(s,t,a):l(a))||a);return i&&a&&Zs(s,t,a),a};const Xs="display:inline-flex;align-items:center;min-block-size:var(--sw-touch-desktop,44px);padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer;text-decoration:underline;text-decoration-color:var(--sw-border-strong);text-underline-offset:3px";let A=class extends j{constructor(){super(...arguments),this.rev=0,this.station="",this.action="",this.period="",this.person=null,this.lastRev=0,this.lastMeta="",this.nameOf=e=>this.stationsRes.snap.data?.find(s=>s.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.stationsRes=new y({fetch:()=>oe(),pick:s=>s.stations,onChange:e}),this.auditRes=new y({fetch:s=>Ze({station_id:this.station,action:this.action,user_id:this.person?.id,start:_s(this.period,new Date),before:typeof s=="number"?s:null}),pick:s=>s.audit,merge:bs,cursorOf:s=>s.next_cursor,onChange:e}),this.reloadAll()}disconnectedCallback(){this.stationsRes?.dispose(),this.auditRes?.dispose(),super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),this.auditRes.reload()}emitMeta(){const e=this.auditRes?.snap.reply?.sync??this.stationsRes?.snap.reply?.sync??null,s=JSON.stringify(e);s!==this.lastMeta&&(this.lastMeta=s,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.zone()},bubbles:!0,composed:!0})))}zone(){return this.stationsRes?.snap.reply?.default_zone??ee}stationItems(){return[{id:"",label:n("auditStationAll")},...(this.stationsRes.snap.data??[]).map(e=>({id:e.id,label:e.name}))]}actionItems(){return[{id:"",label:n("auditActionAll")},...ys.map(e=>({id:e,label:ge(e)}))]}setStation(e){this.station=e,this.auditRes.reload()}setAction(e){this.action=e,this.auditRes.reload()}periodItems(){const e={"":n("auditPeriodAll"),"24h":n("auditPeriod24h"),"7d":n("auditPeriod7d"),"30d":n("auditPeriod30d")};return we.map(s=>({id:s,label:e[s]}))}setPeriod(e){this.period=we.includes(e)?e:"",this.auditRes.reload()}setPerson(e){this.person=e,this.auditRes.reload()}clear(){this.station="",this.action="",this.period="",this.person=null,this.auditRes.reload()}target(e){const s=$s(e);if(s.kind==="none")return"—";if(s.kind==="person"){const i=r`<span>${s.name??n("unnamed")}${s.employee?r` <span style=${v.muted}>· ${n("employeeShort",{n:s.employee})}</span>`:c}</span>`,a=xs(e);return!a||this.person?i:r`<button type="button" style=${Xs} data-access-audit-person=${a.id} title=${n("auditPersonPick",{name:a.name})} @click=${()=>this.setPerson(a)}>${i}</button>`}const t=s.ids.map(i=>this.nameOf(i)).join(", ");return s.more?n("auditStationsMore",{names:t,n:s.more}):n("auditStations",{names:t})}actionCell(e){const s=ge(e.action),t=ks(e).map(a=>zs(a)),i=!!s&&s!==e.action;return r`<span>${i?s:r`<span style=${v.raw}>${s||"—"}</span>`}${t.length?r`<span style=${v.sub}>${n("auditFields",{list:t.join(", ")})}</span>`:c}</span>`}resultCell(e){const s=Ss(e);return s.kind==="done"?r`<sw-badge kind="live" label=${n("resDone")}></sw-badge>`:r`<span style=${v.row}><sw-badge kind="error" label=${n("resFailed")}></sw-badge><span style=${v.muted}>${I(s.code)}</span></span>`}table(e,s){const t=this.zone(),i=o=>o,a=[{key:"time",label:n("colTime"),render:o=>i(o).time?Oe(Ae(i(o).time,s,t)):"—"},{key:"user",label:n("colUser"),render:o=>i(o).actor_name??n("actorNone")},{key:"action",label:n("colAction"),render:o=>this.actionCell(i(o))},{key:"target",label:n("colTarget"),render:o=>this.target(i(o))},{key:"result",label:n("colResult"),render:o=>this.resultCell(i(o))}];return r`<sw-table data-access-audit-table .columns=${a} .rows=${e.records} rowKey="sequence"></sw-table>`}render(){const e=this.auditRes,s=e.snap,t=new Date,i=s.data,a=!!(this.station||this.action||this.period||this.person);let o;if(!s.everAnswered||s.busy&&!i)o=z(5);else if(i)i.records.length?o=this.table(i,t):o=r`<div class="empty" data-access-audit-empty>${a?n("auditEmptyFiltered"):n("auditEmpty")}</div>`;else return r`<div class="stack" data-access-status=${s.failure??"error"}>${b(s.failure??"error",s.message,()=>this.reloadAll())}</div>`;const l=this.zone();return r`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="audit">
        <div class="ch">
          <div><h3>${n("auditTitle")}</h3><div class="sub">${n("auditSub")}</div></div>
          <div class="ctl">
            <sw-dropdown tall data-access-audit-station label=${n("auditStation")} .items=${this.stationItems()} .value=${this.station} @change=${h=>this.setStation(h.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-action label=${n("auditAction")} .items=${this.actionItems()} .value=${this.action} @change=${h=>this.setAction(h.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-period label=${n("auditPeriod")} .items=${this.periodItems()} .value=${this.period} @change=${h=>this.setPeriod(h.detail.id)}></sw-dropdown>
            ${this.person?r`<button type="button" class="chipbtn" aria-pressed="true" data-access-audit-person-chip aria-label=${n("auditPersonClear")} @click=${()=>this.setPerson(null)}><span>${n("auditPerson",{name:this.person.name})}</span><sw-icon name="close" size=${14}></sw-icon></button>`:c}
            ${a?r`<sw-button size="lg" variant="ghost" data-access-audit-clear @click=${()=>this.clear()}>${n("auditClear")}</sw-button>`:c}
          </div>
        </div>
        ${e.stale&&i?r`<div class="note stale" role="status" data-access-stale="audit"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt?n("stale",{t:$(k(s.fetchedAt,t,l))}):n("staleNever")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void e.reload()}>${n("refresh")}</sw-button></div>`:c}
        ${o}
        ${e.hasMore?r`<div class="more"><sw-button size="lg" data-access-audit-more ?disabled=${s.loadingMore} @click=${()=>void e.more()}>${s.loadingMore?n("loadingMore"):n("more")}</sw-button></div>`:c}
        ${s.moreFailed?r`<div class="note err" role="alert" data-access-audit-more-failed><span>${n("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void e.more()}>${n("retry")}</sw-button></div>`:c}
        ${i?r`<div class="foot-note" data-access-audit-foot>${[i.total!==null?n("auditTotal",{n:i.total}):"",i.retention_days?n("auditRetention",{n:i.retention_days}):""].filter(Boolean).join(" · ")}</div>`:c}
      </sw-card>
    </div>`}};A.styles=[H,C`
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
      }
    `,X,W];J([R({type:Number})],A.prototype,"rev",2);J([u()],A.prototype,"station",2);J([u()],A.prototype,"action",2);J([u()],A.prototype,"period",2);J([u()],A.prototype,"person",2);A=J([E("system-access-audit")],A);var Ys=Object.defineProperty,Qs=Object.getOwnPropertyDescriptor,le=(e,s,t,i)=>{for(var a=i>1?void 0:i?Qs(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(s,t,a):l(a))||a);return i&&a&&Ys(s,t,a),a};let Z=class extends j{constructor(){super(...arguments),this.rev=0,this.wide=!0,this.lastRev=0,this.lastMeta="",this.nameOf=e=>this.stationsRes.snap.data?.find(s=>s.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.wide=!_()||U("access.admin.read"),this.stationsRes=new y({fetch:()=>oe(),pick:s=>s.stations,onChange:e}),this.groupsRes=new y({fetch:()=>Ve(),pick:s=>s.groups,onChange:e}),this.versionsRes=new y({fetch:s=>Xe(typeof s=="number"?s:0),pick:s=>s.versions,merge:Rs,cursorOf:s=>s.next_offset,onChange:e}),this.reloadAll()}disconnectedCallback(){for(const e of[this.groupsRes,this.versionsRes,this.stationsRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),(!_()||Q().people)&&this.groupsRes.reload(),this.wide&&this.versionsRes.reload()}emitMeta(){const e=this.groupsRes?.snap.reply?.sync??this.versionsRes?.snap.reply?.sync??this.stationsRes?.snap.reply?.sync??null,s=JSON.stringify(e);s!==this.lastMeta&&(this.lastMeta=s,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.zone()},bubbles:!0,composed:!0})))}zone(){return this.stationsRes?.snap.reply?.default_zone??ee}ruleText(e){const s=Cs(e,(this.stationsRes.snap.data??[]).map(t=>t.id));switch(s.kind){case"all":return n("ruleAll");case"none":return n("ruleNone");case"unknown":return n("ruleUnknown");case"stations":return s.ids.map(t=>this.nameOf(t)).join(", ")}}groupsCard(){if(_()&&!Q().people)return c;const e=this.groupsRes,s=e.snap;if(s.failure==="forbidden")return c;const t=s.data;let i;return!s.everAnswered||s.busy&&!t?i=z(4):t?t.groups.length?i=r`<div class="list" data-access-groups>
        ${t.groups.map(a=>r`<div class="row" data-access-group=${a.id}>
            <span class="dot ${a.enabled?"ok":"off"}" aria-hidden="true"></span>
            <span class="main"><span class="t">${a.label}</span><span class="s wrap">${this.ruleText(a)}</span></span>
            ${a.enabled?c:r`<span class="side"><sw-badge kind="offline" label=${n("groupOff")}></sw-badge></span>`}
          </div>`)}
      </div>`:i=r`<div class="empty">${n("groupsEmpty")}</div>`:i=b(s.failure??"error",s.message,()=>void e.reload(),!0),r`<sw-card flush data-access-card="groups">
      <div class="ch">
        <div><h3>${n("groupsTitle")}</h3><div class="sub">${n("groupsSub")}</div></div>
        ${t?r`<div class="ctl rev" data-access-revision><span class="muted">${n("revisionNow",{n:t.revision??"—"})}</span>${t.photo_enabled===null?c:r`<span class="muted">${t.photo_enabled?n("photoOn"):n("photoOff")}</span>`}<wk-profiles-link variant="ghost"></wk-profiles-link></div>`:c}
      </div>
      ${e.stale&&t?r`<div class="note stale" role="status" data-access-stale="groups"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt?n("stale",{t:$(k(s.fetchedAt,new Date,this.zone()))}):n("staleNever")}</span></div>`:c}
      ${i}
    </sw-card>`}fieldsCard(){const e=this.groupsRes.snap.data;if(!e||e.fields===null)return c;const s=i=>i,t=[{key:"label",label:n("colField"),render:i=>r`<span style=${v.strong}>${s(i).label}</span>`},{key:"type",label:n("colType"),render:i=>n(Ts(s(i).type))},{key:"flags",label:n("colFlags"),render:i=>{const a=s(i),o=Os(a),l=a.depends_on?(e.fields??[]).find(h=>h.id===a.depends_on?.field_id)?.label??a.depends_on.field_id:"";return r`<span style=${v.row}>${[a.required?n("flagRequired"):n("flagOptional"),o.includes("unique")?n("flagUnique"):"",o.includes("depends")?n("flagDepends",{field:l}):""].filter(Boolean).join(" · ")}${o.includes("disabled")?r`<sw-badge kind="offline" label=${n("flagDisabled")}></sw-badge>`:c}</span>`}},{key:"options",label:n("colOptions"),render:i=>{const a=As(s(i).options??[]);return a.shown.length?r`<span>${a.shown.join(", ")}${a.more?r` <span style=${v.muted}>${n("optionsMore",{n:a.more})}</span>`:c}</span>`:r`<span style=${v.muted}>—</span>`}}];return r`<sw-card flush data-access-card="fields">
      <div class="ch"><div><h3>${n("fieldsTitle")}</h3><div class="sub">${n("fieldsCount",{n:e.fields.length})}</div></div></div>
      ${e.fields.length?r`<sw-table data-access-fields .columns=${t} .rows=${e.fields} rowKey="id"></sw-table>`:r`<div class="empty">${n("fieldsEmpty")}</div>`}
    </sw-card>`}versionsCard(e){if(!this.wide)return c;const s=this.versionsRes,t=s.snap;if(t.failure==="forbidden")return c;const i=t.data,a=this.zone(),o=p=>p,l=[{key:"revision",label:n("colRevision"),render:p=>r`<span style=${v.row}><span style=${v.strong}>${o(p).revision}</span>${i&&o(p).revision===i.current_revision?r`<sw-badge kind="live" label=${n("versionCurrent")}></sw-badge>`:c}</span>`},{key:"saved",label:n("colSaved"),render:p=>o(p).saved_at?Oe(Ae(o(p).saved_at,e,a)):"—"},{key:"action",label:n("colChange"),render:p=>Ps(o(p).action)},{key:"fields",label:n("colFieldChanges"),render:p=>o(p).field_changes?String(o(p).field_changes):"—"},{key:"groups",label:n("colGroupChanges"),render:p=>o(p).group_changes?String(o(p).group_changes):"—"}];let h;return!t.everAnswered||t.busy&&!i?h=z(3):i?i.records.length?h=r`<sw-table data-access-versions .columns=${l} .rows=${i.records} rowKey="revision"></sw-table>`:h=r`<div class="empty">${n("versionsEmpty")}</div>`:h=b(t.failure??"error",t.message,()=>void s.reload(),!0),r`<sw-card flush data-access-card="versions">
      <div class="ch"><div><h3>${n("versionsTitle")}</h3><div class="sub">${n("versionsSub")}</div></div></div>
      ${s.stale&&i?r`<div class="note stale" role="status" data-access-stale="versions"><sw-icon name="offline" size=${16}></sw-icon><span>${t.fetchedAt?n("stale",{t:$(k(t.fetchedAt,e,a))}):n("staleNever")}</span></div>`:c}
      ${h}
      ${s.hasMore?r`<div class="more"><sw-button size="lg" data-access-versions-more ?disabled=${t.loadingMore} @click=${()=>void s.more()}>${t.loadingMore?n("loadingMore"):`${n("more")} (${js(i)})`}</sw-button></div>`:c}
      ${t.moreFailed?r`<div class="note err" role="alert" data-access-versions-more-failed><span>${n("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void s.more()}>${n("retry")}</sw-button></div>`:c}
      ${i?.retained_from_revision?r`<div class="foot-note" data-access-versions-retained>${n("versionsRetained",{n:i.retained_from_revision})}</div>`:c}
    </sw-card>`}render(){const e=new Date,s=this.groupsRes.snap;if((!_()||Q().people)&&s.everAnswered&&!s.data&&s.failure&&s.failure!=="forbidden"&&["not_configured","connecting","not_installed","unsupported"].includes(s.failure))return r`<div class="stack" data-access-status=${s.failure}>${b(s.failure,s.message,()=>this.reloadAll())}</div>`;const i=this.groupsCard(),a=this.fieldsCard();return r`<div class="stack" data-access-status="ready">
      ${i!==c&&a!==c?r`<div class="grid2">${i}${a}</div>`:r`${i}${a}`}
      ${this.versionsCard(e)}
    </div>`}};Z.styles=[H,C`
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
    `,X,W];le([R({type:Number})],Z.prototype,"rev",2);le([u()],Z.prototype,"wide",2);Z=le([E("system-access-groups")],Z);var et=Object.defineProperty,st=Object.getOwnPropertyDescriptor,M=(e,s,t,i)=>{for(var a=i>1?void 0:i?st(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(s,t,a):l(a))||a);return i&&a&&et(s,t,a),a};const ye={"access.event_portrait_audit":{title:"pol_event_portrait_audit",text:"pol_event_portrait_audit_text"},"access.event_portrait_sensitive":{title:"pol_event_portrait_sensitive",text:"pol_event_portrait_sensitive_text"},"access.employee_no_sensitive":{title:"pol_employee_no_sensitive",text:"pol_employee_no_sensitive_text"},"access.sync_errors_everyone":{title:"pol_sync_errors_everyone",text:"pol_sync_errors_everyone_text"}};let S=class extends j{constructor(){super(...arguments),this.rev=0,this.values=null,this.canEdit=!1,this.busy="",this.error="",this.failed="",this.loading=!0,this.lastRev=0,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.load())}async load(){const e=++this.gen;this.failed="";try{const s=await Ce("settings");if(e!==this.gen)return;this.values=this.read(s.settings),this.canEdit=!!s.can_edit&&(!_()||U("system.configure"))}catch(s){if(e!==this.gen)return;this.failed=L(s)}finally{e===this.gen&&(this.loading=!1)}}read(e){return Object.fromEntries(be.map(s=>[s,Es(e,s)]))}async flip(e){if(!this.values||!this.canEdit||this.busy)return;const s=!this.values[e];this.busy=e,this.error="";try{const t=await Ne("settings",{[e]:String(s)});this.values=this.read(t.settings)}catch(t){this.error=`${n("policySaveFailed")} · ${L(t)}`}finally{this.busy=""}}render(){if(this.loading)return r`<div class="stack" data-access-status="loading"><sw-card flush>${z(4)}</sw-card></div>`;if(!this.values)return r`<div class="stack" data-access-status="error">${b("error",this.failed,()=>void this.load())}</div>`;const e=this.values;return r`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="policy">
        <div class="ch"><div><h3>${n("policyTitle")}</h3><div class="sub">${this.canEdit?n("policySub"):n("policyNote")}</div></div></div>
        ${be.map(s=>r`<button type="button" class="sw" role="switch" aria-checked=${String(e[s])} data-access-policy=${s} data-default=${String(Ms[s])} ?disabled=${!this.canEdit||!!this.busy} @click=${()=>void this.flip(s)}>
            <span class="txt"><span class="t">${n(ye[s].title)}</span><span class="x">${n(ye[s].text)}</span></span>
            <span class="track" aria-hidden="true"></span>
          </button>`)}
        ${this.error?r`<div class="note err" role="alert" data-access-policy-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:c}
      </sw-card>
    </div>`}};S.styles=[H,C`
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
        background: var(--sw-toggle-off);
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
    `,X,W];M([R({type:Number})],S.prototype,"rev",2);M([u()],S.prototype,"values",2);M([u()],S.prototype,"canEdit",2);M([u()],S.prototype,"busy",2);M([u()],S.prototype,"error",2);M([u()],S.prototype,"failed",2);M([u()],S.prototype,"loading",2);S=M([E("system-access-policy")],S);const ae="access-control/messaging/installed",tt={view:()=>Ce(ae),save:e=>qe(ae,e),sync:()=>Le(`${ae}/registry-sync`,{})};function at(){return{settings:{send_pacing_v1:!1},gates:{messaging_enabled:!0,template_switch:!0,permit:!1},commands:{"whatsapp/template_registry_v1":!0,"whatsapp/template_enqueue_v1":!0,"whatsapp/template_job_v1":!0,"whatsapp/template_cancel_v1":!0,"whatsapp/template_send_v3":!0,"whatsapp/send_pacing_v1":!1},registry:{templates:[{id:"access",name:"access_notice",language:"he",purpose:"notice",source:"arx",account:null,template_revision:3,bound:!0},{id:"native_0a1b2c3d4e5f6a7b8c9d0e1f",name:"door_code",language:"he",purpose:"notice",source:"wiskey",account:"office",template_revision:2,bound:!0}],wiskey_rows:1,arx_rows:1,native_accounts:1,native_sendable:!1,last_sync:{outcome:"synced",code:null,native:1,at:"2026-11-04T08:00:00+00:00"}},jobs:[{operation_id:"tplq-demo00000001",template_id:"access",person_id:"p1",state:"completed",outcome:"accepted",code:"provider_accepted",created_at:"2026-11-04T08:10:00+00:00",updated_at:"2026-11-04T08:10:20+00:00"},{operation_id:"tplq-demo00000002",template_id:"access",person_id:"p2",state:"cancelled",outcome:"not_sent",code:"cancelled_before_dispatch",created_at:"2026-11-04T08:05:00+00:00",updated_at:"2026-11-04T08:05:30+00:00"}],queue_ttl_s:120,delivery_receipts:!1,excluded:["whatsapp/history","whatsapp/media","whatsapp/templates_get","whatsapp/templates_update"]}}let N=at();const Y=e=>JSON.parse(JSON.stringify(e)),nt={view:async()=>Y(N),save:async e=>(N.settings.send_pacing_v1=e.send_pacing_v1===!0,Y(N)),sync:async()=>(N.registry.last_sync={outcome:"synced",code:null,native:N.registry.wiskey_rows,at:new Date().toISOString()},{...Y(N),sync:Y(N.registry.last_sync)})};function ne(){return _()?tt:nt}const Pe={title:"תבניות ותור שליחה",sub:"רשימת התבניות של שירות ההודעות, תור השליחה ומצב כל הודעה. היסטוריית השיחות נשארת בשירות ההודעות.",loadError:"לא ניתן לטעון את מצב התבניות",retry:"נסו שוב",blocked:"שליחת תבנית אינה זמינה כרגע",blk_messaging_off:"שליחת הודעות כבויה",blk_template_switch_off:"שליחת תבניות כבויה",blk_permit_closed:"טרם אושרה שליחה מול עמדה אמיתית",blk_queue_unavailable:"החיבור הישיר לשירות ההודעות אינו זמין",ready:"שליחת תבנית זמינה",commands:"מה שירות ההודעות מאפשר עכשיו",cmd_registry:"רשימת תבניות",cmd_queue:"תור שליחה",cmd_job:"מצב משימה",cmd_cancel:"ביטול משימה",cmd_now:"שליחה מיידית",cmd_paced:"שליחה בקצב של השירות",on:"זמין",off:"לא זמין",registry:"תבניות",fromWiskey:"מהשירות: {n}",fromArx:"שהוגדרו כאן: {n}",nativeLocked:"תבניות השירות נשלחות רק כשההתקנה האוטומטית פעילה",sync:"רענון מהשירות",syncing:"מרענן...",lastSync:"רענון אחרון: {time}",neverSynced:"עוד לא רועננה",sync_synced:"הרשימה רועננה",sync_not_sent:"לא נשלחה בקשה",sync_refused:"השירות סירב",sync_invalid:"התשובה לא תקינה - הרשימה נשמרה",sync_unknown:"לא התקבלה תשובה",noTemplates:"אין תבניות",src_wiskey:"מהשירות",src_arx:"כאן",unbound:"לא מקושרת",jobs:"משימות אחרונות",noJobs:"אין משימות בתור",job_pending:"ממתינה בתור",job_sent:"התקבלה אצל ספק ההודעות",job_cancelled:"בוטלה - לא נשלחה",job_paced:"עוכבה בקצב של השירות - לא נשלחה",job_expired:"פג תוקפה בתור - לא נשלחה",job_not_sent:"לא נשלחה",job_unknown:"לא ידוע אם נשלחה",delivery:"השירות אינו מדווח על מסירה - ידוע רק שהספק קיבל את ההודעה",ttl:"הודעה ממתינה בתור עד {n} שניות",paced:"הודעה חופשית בקצב של השירות",pacedOn:'מופעל - כל הודעה שנשלחה תוצג כ"לא ידוע" עד שהשירות ידווח קבלה',pacedOff:"כבוי",pacedUnlisted:"השירות אינו מציע זאת כרגע",saved:"נשמר",history:"היסטוריית השיחות נשארת בשירות ההודעות ואינה נשמרת כאן"},it={title:"Templates and send queue",sub:"The messaging service's template list, the send queue and each message's state. The conversation history stays in the messaging service.",loadError:"The template state could not be loaded",retry:"Try again",blocked:"Template sending is not available now",blk_messaging_off:"Messaging is off",blk_template_switch_off:"Template sending is off",blk_permit_closed:"Sending has not been approved against a real station yet",blk_queue_unavailable:"The direct messaging-service connection is not available",ready:"Template sending is available",commands:"What the messaging service offers now",cmd_registry:"Template list",cmd_queue:"Send queue",cmd_job:"Job state",cmd_cancel:"Job cancel",cmd_now:"Send now",cmd_paced:"Send at the service's pace",on:"Available",off:"Not available",registry:"Templates",fromWiskey:"From the service: {n}",fromArx:"Defined here: {n}",nativeLocked:"Service templates are sent only while the automatic installation is on",sync:"Refresh from the service",syncing:"Refreshing...",lastSync:"Last refresh: {time}",neverSynced:"Not refreshed yet",sync_synced:"The list was refreshed",sync_not_sent:"No request was sent",sync_refused:"The service refused",sync_invalid:"The answer was not valid - the list was kept",sync_unknown:"No answer arrived",noTemplates:"No templates",src_wiskey:"Service",src_arx:"Here",unbound:"Not linked",jobs:"Recent jobs",noJobs:"No jobs in the queue",job_pending:"Waiting in the queue",job_sent:"Accepted by the message provider",job_cancelled:"Cancelled - not sent",job_paced:"Held by the service's pace - not sent",job_expired:"Expired in the queue - not sent",job_not_sent:"Not sent",job_unknown:"Unknown whether it was sent",delivery:"The service does not report delivery - only that the provider accepted the message",ttl:"A message waits in the queue for up to {n} seconds",paced:"Free text at the service's pace",pacedOn:'On - every dispatched message shows as "unknown" until the service reports acceptance',pacedOff:"Off",pacedUnlisted:"The service does not offer this now",saved:"Saved",history:"The conversation history stays in the messaging service and is not kept here"},rt={title:"القوالب وطابور الإرسال",sub:"قائمة قوالب خدمة الرسائل وطابور الإرسال وحالة كل رسالة. يبقى سجل المحادثات في خدمة الرسائل.",loadError:"تعذّر تحميل حالة القوالب",retry:"حاول مرة أخرى",blocked:"إرسال القوالب غير متاح الآن",blk_messaging_off:"إرسال الرسائل متوقف",blk_template_switch_off:"إرسال القوالب متوقف",blk_permit_closed:"لم تتم الموافقة على الإرسال مقابل محطة حقيقية بعد",blk_queue_unavailable:"الاتصال المباشر بخدمة الرسائل غير متاح",ready:"إرسال القوالب متاح",commands:"ما تتيحه خدمة الرسائل الآن",cmd_registry:"قائمة القوالب",cmd_queue:"طابور الإرسال",cmd_job:"حالة المهمة",cmd_cancel:"إلغاء المهمة",cmd_now:"إرسال فوري",cmd_paced:"إرسال بوتيرة خدمة الرسائل",on:"متاح",off:"غير متاح",registry:"القوالب",fromWiskey:"من خدمة الرسائل: {n}",fromArx:"معرّفة هنا: {n}",nativeLocked:"تُرسل قوالب خدمة الرسائل فقط عندما يكون التثبيت التلقائي مفعّلاً",sync:"تحديث من خدمة الرسائل",syncing:"جارٍ التحديث...",lastSync:"آخر تحديث: {time}",neverSynced:"لم يتم التحديث بعد",sync_synced:"تم تحديث القائمة",sync_not_sent:"لم يُرسل أي طلب",sync_refused:"رفضت الخدمة",sync_invalid:"الإجابة غير صالحة - تم الاحتفاظ بالقائمة",sync_unknown:"لم تصل إجابة",noTemplates:"لا توجد قوالب",src_wiskey:"الخدمة",src_arx:"هنا",unbound:"غير مرتبط",jobs:"المهام الأخيرة",noJobs:"لا توجد مهام في الطابور",job_pending:"بانتظار الطابور",job_sent:"استلمها مزوّد الرسائل",job_cancelled:"أُلغيت - لم تُرسل",job_paced:"أخّرتها وتيرة خدمة الرسائل - لم تُرسل",job_expired:"انتهت صلاحيتها في الطابور - لم تُرسل",job_not_sent:"لم تُرسل",job_unknown:"غير معروف إن أُرسلت",delivery:"لا تبلّغ الخدمة عن التسليم - المعروف فقط أن المزوّد استلم الرسالة",ttl:"تنتظر الرسالة في الطابور حتى {n} ثانية",paced:"نص حر بوتيرة خدمة الرسائل",pacedOn:'مفعّل - كل رسالة مُرسلة تظهر "غير معروف" حتى تبلّغ الخدمة عن الاستلام',pacedOff:"متوقف",pacedUnlisted:"لا تتيح الخدمة ذلك الآن",saved:"تم الحفظ",history:"يبقى سجل المحادثات في خدمة الرسائل ولا يُحفظ هنا"},ot={title:"Шаблоны и очередь отправки",sub:"Список шаблонов сервиса сообщений, очередь отправки и состояние каждого сообщения. История переписки остаётся в сервисе сообщений.",loadError:"Не удалось загрузить состояние шаблонов",retry:"Повторить",blocked:"Отправка шаблонов сейчас недоступна",blk_messaging_off:"Отправка сообщений выключена",blk_template_switch_off:"Отправка шаблонов выключена",blk_permit_closed:"Отправка ещё не подтверждена на реальной станции",blk_queue_unavailable:"Прямое подключение к сервису сообщений недоступно",ready:"Отправка шаблонов доступна",commands:"Что сервис сообщений предлагает сейчас",cmd_registry:"Список шаблонов",cmd_queue:"Очередь отправки",cmd_job:"Состояние задачи",cmd_cancel:"Отмена задачи",cmd_now:"Отправить сейчас",cmd_paced:"Отправка в темпе сервиса",on:"Доступно",off:"Недоступно",registry:"Шаблоны",fromWiskey:"Из сервиса: {n}",fromArx:"Заданы здесь: {n}",nativeLocked:"Шаблоны сервиса отправляются только при включённой автоматической установке",sync:"Обновить из сервиса",syncing:"Обновление...",lastSync:"Последнее обновление: {time}",neverSynced:"Ещё не обновлялось",sync_synced:"Список обновлён",sync_not_sent:"Запрос не отправлен",sync_refused:"Сервис отказал",sync_invalid:"Ответ некорректен - список сохранён",sync_unknown:"Ответ не получен",noTemplates:"Нет шаблонов",src_wiskey:"Сервис",src_arx:"Здесь",unbound:"Не связан",jobs:"Последние задачи",noJobs:"В очереди нет задач",job_pending:"Ждёт в очереди",job_sent:"Принято провайдером сообщений",job_cancelled:"Отменено - не отправлено",job_paced:"Задержано темпом сервиса - не отправлено",job_expired:"Истекло в очереди - не отправлено",job_not_sent:"Не отправлено",job_unknown:"Неизвестно, отправлено ли",delivery:"Сервис не сообщает о доставке - известно только, что провайдер принял сообщение",ttl:"Сообщение ждёт в очереди до {n} секунд",paced:"Свободный текст в темпе сервиса",pacedOn:"Включено - каждое отправленное сообщение показано как «неизвестно», пока сервис не сообщит о приёме",pacedOff:"Выключено",pacedUnlisted:"Сервис сейчас этого не предлагает",saved:"Сохранено",history:"История переписки остаётся в сервисе сообщений и здесь не хранится"},lt={he:Pe,en:it,ar:rt,ru:ot};function ct(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function m(e,s,t=ct()){const i=lt[t][e]??Pe[e]??e;return s?i.replace(/\{(\w+)\}/g,(a,o)=>o in s?String(s[o]):a):i}function dt(e){return e.outcome==="pending"?"pending":e.outcome==="accepted"?"sent":e.outcome==="not_sent"?e.code==="cancelled_before_dispatch"?"cancelled":e.code==="rate_limited"?"paced":e.code==="queue_expired"?"expired":"not_sent":"unknown"}function pt(e){return e==="sent"?"ok":e==="unknown"?"warn":e==="pending"?"muted":"bad"}function ht(e){const s=[];return e.gates.messaging_enabled||s.push("messaging_off"),e.gates.template_switch||s.push("template_switch_off"),e.gates.permit||s.push("permit_closed"),!e.commands["whatsapp/template_enqueue_v1"]&&!e.commands["whatsapp/template_send_v3"]&&s.push("queue_unavailable"),s}function ut(e){return e==="synced"?"ok":e==="unknown"?"warn":e?"bad":"muted"}function mt(e){return e.settings.send_pacing_v1||e.commands["whatsapp/send_pacing_v1"]}function vt(e,s=5){return e.slice(0,Math.max(0,s))}var ft=Object.defineProperty,gt=Object.getOwnPropertyDescriptor,G=(e,s,t,i)=>{for(var a=i>1?void 0:i?gt(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(s,t,a):l(a))||a);return i&&a&&ft(s,t,a),a};const wt=[["whatsapp/template_registry_v1","cmd_registry"],["whatsapp/template_enqueue_v1","cmd_queue"],["whatsapp/template_job_v1","cmd_job"],["whatsapp/template_cancel_v1","cmd_cancel"],["whatsapp/template_send_v3","cmd_now"],["whatsapp/send_pacing_v1","cmd_paced"]];let P=class extends j{constructor(){super(...arguments),this.view=null,this.phase="loading",this.error="",this.notice="",this.busy="",this.noticeTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){window.clearTimeout(this.noticeTimer),super.disconnectedCallback()}async load(){this.phase=this.view?this.phase:"loading";try{this.view=await ne().view(),this.phase="ready",this.error=""}catch(e){this.error=L(e),this.phase="error"}}flash(e){this.notice=e,window.clearTimeout(this.noticeTimer),this.noticeTimer=window.setTimeout(()=>this.notice="",3e3)}async sync(){if(!this.busy){this.busy="sync",this.error="";try{const e=await ne().sync();this.view=e,this.flash(m(`sync_${e.sync?.outcome??"synced"}`))}catch(e){const s=L(e);await this.load(),this.phase==="ready"&&(this.error=s)}finally{this.busy=""}}}async setPaced(e){if(!(this.busy||!this.view)){this.busy="save",this.error="";try{this.view=await ne().save({send_pacing_v1:e}),this.flash(m("saved"))}catch(s){this.error=L(s)}finally{this.busy=""}}}template(e){return r`<div class="row" data-wa-template=${e.id} data-source=${e.source}>
      <span class="dot ${e.bound?"ok":"muted"}" aria-hidden="true"></span>
      <span class="main"><span class="t">${De(e.name)}</span>
        <span class="s">${e.language} · ${m(e.source==="wiskey"?"src_wiskey":"src_arx")}${e.account?r` · <span class="ltr">${de(e.account)}</span>`:c}${e.bound?c:r` · ${m("unbound")}`}</span></span>
    </div>`}job(e){const s=dt(e),t=pt(s);return r`<div class="row" data-wa-job=${e.operation_id} data-word=${s}>
      <span class="dot ${t==="bad"?"err":t}" aria-hidden="true"></span>
      <span class="main"><span class="t">${m(`job_${s}`)}</span>
        <span class="s"><span class="ltr">${de(e.template_id??"–")}</span> · ${pe(new Date(e.updated_at))}</span></span>
    </div>`}render(){if(this.phase==="loading")return r`<sw-card flush data-wa-installed data-state="loading">${z(3)}</sw-card>`;if(this.phase==="error"||!this.view)return r`<sw-card flush data-wa-installed data-state="error"><div class="ch"><div><h3>${m("title")}</h3></div></div>
        <div class="sec"><div class="note err" role="alert" data-wa-error><sw-icon name="warning" size="16"></sw-icon><span>${m("loadError")}: ${this.error}</span>
          <sw-button size="sm" data-wa-retry @click=${()=>void this.load()}>${m("retry")}</sw-button></div></div></sw-card>`;const e=this.view,s=ht(e),t=e.registry.last_sync,i=vt(e.jobs),a=mt(e);return r`<sw-card flush data-wa-installed data-state="ready">
      <div class="ch">
        <div><h3>${m("title")}</h3><div class="sub">${m("sub")}</div></div>
        <div class="ctl"><sw-button size="sm" icon="refresh" data-wa-sync ?disabled=${!!this.busy||!e.commands["whatsapp/template_registry_v1"]}
          @click=${()=>void this.sync()}>${this.busy==="sync"?m("syncing"):m("sync")}</sw-button></div>
      </div>
      ${this.error?r`<div class="sec"><div class="note err" role="alert" data-wa-error><sw-icon name="warning" size="16"></sw-icon><span>${this.error}</span></div></div>`:c}
      ${this.notice?r`<div class="sec"><div class="note info" role="status" data-wa-notice><sw-icon name="check" size="16"></sw-icon><span>${this.notice}</span></div></div>`:c}
      <div class="sec" data-wa-blockers=${s.join(" ")}>
        ${s.length?r`<h4>${m("blocked")}</h4><div class="chips">${s.map(o=>r`<span class="chip bad" data-wa-blocker=${o}>${m(`blk_${o}`)}</span>`)}</div>`:r`<div class="chips"><span class="chip ok" data-wa-ready>${m("ready")}</span></div>`}
      </div>
      <div class="sec">
        <h4>${m("commands")}</h4>
        <div class="cmds">${wt.map(([o,l])=>r`<div class="cmd" data-wa-command=${o} data-on=${String(e.commands[o])}>
          <span class="dot ${e.commands[o]?"ok":"muted"}" aria-hidden="true"></span><span>${m(l)} · ${m(e.commands[o]?"on":"off")}</span></div>`)}</div>
      </div>
      <div class="sec" data-wa-registry>
        <div class="line"><h4 class="grow">${m("registry")}</h4>
          <span class="chip" data-wa-count="wiskey">${m("fromWiskey",{n:e.registry.wiskey_rows})}</span>
          <span class="chip" data-wa-count="arx">${m("fromArx",{n:e.registry.arx_rows})}</span></div>
        <div class="line"><span class="chip ${ut(t?.outcome)}" data-wa-last-sync=${t?.outcome??"never"}>${m(t?`sync_${t.outcome}`:"neverSynced")}</span>
          ${t?.at?r`<span class="meta">${m("lastSync",{time:pe(new Date(t.at))})}</span>`:c}</div>
        ${e.registry.wiskey_rows&&!e.registry.native_sendable?r`<div class="hint" data-wa-native-locked>${m("nativeLocked")}</div>`:c}
      </div>
      <div data-wa-templates>${e.registry.templates.length?he(e.registry.templates,o=>o.id,o=>this.template(o)):r`<div class="empty">${m("noTemplates")}</div>`}</div>
      <div class="sec" data-wa-jobs-head><h4>${m("jobs")}</h4><div class="hint">${m("ttl",{n:e.queue_ttl_s})}</div>
        ${e.delivery_receipts?c:r`<div class="hint" data-wa-no-delivery>${m("delivery")}</div>`}</div>
      <div data-wa-jobs>${i.length?he(i,o=>o.operation_id,o=>this.job(o)):r`<div class="empty">${m("noJobs")}</div>`}</div>
      <div class="sec">
        <div class="toggle" data-wa-paced>
          <span class="txt"><span class="t">${m("paced")}</span>
            <span class="x">${e.settings.send_pacing_v1?m("pacedOn"):m(a?"pacedOff":"pacedUnlisted")}</span></span>
          <sw-toggle label=${m("paced")} labelHidden data-wa-paced-toggle .checked=${e.settings.send_pacing_v1} ?disabled=${!!this.busy||!a}
            @change=${o=>void this.setPaced(o.detail.checked)}></sw-toggle>
        </div>
        <div class="hint" data-wa-history>${m("history")}</div>
      </div>
    </sw-card>`}};P.styles=[H,C`
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
    `];G([u()],P.prototype,"view",2);G([u()],P.prototype,"phase",2);G([u()],P.prototype,"error",2);G([u()],P.prototype,"notice",2);G([u()],P.prototype,"busy",2);P=G([E("wa-installed-card")],P);const je={templates_max:20,label_max:40,body_max:600,text_max:1e3,organization_max:60,bulk_max:[1,200],rate_per_hour:[1,1e3],per_sender_per_hour:[1,1e3],per_person_per_day:[1,50],per_station_per_hour:[1,1e3],placeholders:["name","organization"],placeholders_max:6},bt=128,_t=1500,yt=/\p{Cc}|\p{Zl}|\p{Zp}/u,ce=(e,s)=>[...e].some(t=>s&&t===`
`?!1:yt.test(t));function $t(e){return e.replace(/\r\n?/g,`
`).split(`
`).map(s=>s.replace(/\s+$/u,"")).join(`
`).trim()}function xt(e,s,t,i){const a=e.trim();if(!a)return[{path:s,code:"empty"}];if(a.length>i.label_max)return[{path:s,code:"too_long"}];if(ce(a,!1))return[{path:s,code:"control_chars"}];const o=a.toLocaleLowerCase();return t.has(o)?[{path:s,code:"duplicate_label"}]:(t.add(o),[])}function kt(e,s,t,i){const a=$t(e);if(!a)return[{path:s,code:"empty"}];if(a.length>i.body_max)return[{path:s,code:"too_long"}];if(ce(a,!0))return[{path:s,code:"control_chars"}];if(qs(a))return[{path:s,code:"credential"}];const o=[...a.matchAll(/\{([^{}]*)\}/g)].map(g=>g[1]),l=a.replace(/\{[^{}]*\}/g,"");if(l.includes("{")||l.includes("}"))return[{path:s,code:"bad_braces"}];if(o.some(g=>!i.placeholders.includes(g)))return[{path:s,code:"unknown_placeholder"}];if(re(a))return[{path:s,code:"credential"}];if(o.length>i.placeholders_max)return[{path:s,code:"too_many_placeholders"}];if(o.includes("organization")&&!t.trim())return[{path:s,code:"organization_missing"}];if(re(a.replace(/\{(name|organization)\}/g,(g,se)=>se==="name"?"xxxxxxxx":t.trim())))return[{path:s,code:"credential"}];const h=o.filter(g=>g==="name").length,p=o.filter(g=>g==="organization").length;return a.replace(/\{(?:name|organization)\}/g,"").length+h*bt+p*i.organization_max>_t?[{path:s,code:"too_long"}]:[]}const $e=/^([01]\d|2[0-3]):[0-5]\d$/;function zt(e){return e==null?null:!$e.test(e.from)||!$e.test(e.to)?"window_invalid":e.from===e.to?"window_empty":e.from>e.to?"window_across_midnight":null}const xe={per_sender_per_hour:[1,1e3],per_person_per_day:[1,50],per_station_per_hour:[1,1e3]};function St(e,s=je){const t=[],i=h=>typeof h=="number"&&Number.isInteger(h);i(e.bulk_max)?(e.bulk_max<s.bulk_max[0]||e.bulk_max>s.bulk_max[1])&&t.push({path:"bulk_max",code:"range"}):t.push({path:"bulk_max",code:"type"}),i(e.rate_per_hour)?(e.rate_per_hour<s.rate_per_hour[0]||e.rate_per_hour>s.rate_per_hour[1])&&t.push({path:"rate_per_hour",code:"range"}):t.push({path:"rate_per_hour",code:"type"});for(const h of Object.keys(xe)){if(!(h in e))continue;const p=e[h],[g,se]=s[h]??xe[h];i(p)?(p<g||p>se)&&t.push({path:h,code:"range"}):t.push({path:h,code:"type"})}const a=zt(e.send_hours);a&&t.push({path:"send_hours",code:a});const o=e.organization.trim();o.length>s.organization_max?t.push({path:"organization",code:"too_long"}):ce(o,!1)?t.push({path:"organization",code:"control_chars"}):o.includes("{")||o.includes("}")?t.push({path:"organization",code:"bad_braces"}):re(o)&&t.push({path:"organization",code:"credential"}),e.templates.length>s.templates_max&&t.push({path:"templates",code:"too_many"});const l=new Set;return e.templates.forEach((h,p)=>{t.push(...xt(h.label,`templates.${p}.label`,l,s)),t.push(...kt(h.body,`templates.${p}.body`,o,s))}),t}const Rt=(e,s)=>e.filter(t=>t.path===s);function Ct(e,s,t,i){const a=t??e.length,o=i??a;return{text:e.slice(0,a)+s+e.slice(o),caret:a+s.length}}const Ee={segment:"הודעות",segments_label:"הודעות",title:"הודעות לאנשים",sub:"שליחת הודעות וואטסאפ מרשימת האנשים: תבניות מאושרות והודעה חופשית. השליחה נרשמת ביומן המערכת, בלי תוכן ההודעה.",loading:"טוען את ההגדרות…",load_failed:"לא ניתן לטעון את ההגדרות",retry:"נסה שוב","service.connected":"שירות ההודעות מחובר","service.account":"חשבון: {name}","service.not_connected":"שירות ההודעות אינו מחובר","service.unknown":"מצב שירות ההודעות לא ידוע","service.unsupported":"שירות ההודעות אינו זמין בהתקנה הזו","service.account_required":"יש כמה חשבונות · בחרו מאיזה חשבון נשלחות ההודעות","service.account_missing":"החשבון שנבחר אינו קיים יותר · בחרו חשבון","service.account_not_covered":"החשבון שנבחר לא נכלל ברשימה שהתקבלה כרגע משירות ההודעות (הרשימה מוגבלת) · נסו שוב או בחרו חשבון אחר","service.no_account":"אין חשבון הודעות מחובר","enabled.title":"שליחת הודעות","enabled.on":"מופעל · במסך האנשים יש כפתור שליחה לבעלי ההרשאה","enabled.off":"כבוי · במסך האנשים אין כפתור שליחה","free.title":"הודעה חופשית","free.on":"השולח יכול לכתוב הודעה בעצמו","free.off":"אפשר לשלוח תבניות מאושרות בלבד","bulk.title":"נמענים מרבי בשליחה אחת","bulk.hint":"בין {min} ל־{max}","rate.title":"מכסת הודעות לשעה","rate.hint":"לכל המערכת · בין {min} ל־{max}","optout.note":'בקשת "לא לקבל הודעות" חלה על הודעות שנשלחות מכאן בלבד; רק מנהל מערכת יכול לבטל אותה.',"sender.title":"הודעות לשעה לכל שולח","sender.hint":"כולל הודעות שנדחו · בין {min} ל־{max}","person.title":"הודעות ביום לכל נמען","person.hint":"לפי האדם ולפי מספר הטלפון · בין {min} ל־{max}","station.title":"הודעות לשעה לאנשי עמדה","station.hint":"לכל עמדה בנפרד · בין {min} ל־{max}","hours.title":"שעות שליחה","hours.on":"הודעות נשלחות רק בין השעות שנבחרו (שעון ההתקנה)","hours.off":"ללא הגבלת שעות","hours.from":"משעה","hours.to":"עד שעה","org.title":"שם הארגון בהודעות","org.hint":"מחליף את {organization} בתבניות","account.title":"חשבון השליחה","account.only":"החשבון היחיד","account.choose":"בחרו חשבון","templates.title":"תבניות מאושרות","templates.sub":"{name} מוחלף בשם האדם ו־{organization} בשם הארגון. אי אפשר לכתוב בתבנית קוד גישה או פרטי כניסה.","templates.empty":"אין תבניות · השולחים יוכלו לכתוב הודעה חופשית בלבד","template.label":"שם התבנית","template.body":"נוסח ההודעה","template.counter":"{n}/{max}","template.add":"הוספת תבנית","template.remove":"מחיקת התבנית","template.insert_name":"הוספת שם האדם","template.insert_org":"הוספת שם הארגון","template.new":"תבנית חדשה","consent.title":"אישור קבלת הודעות בקישור","consent.sub":"כשהאפשרות מופעלת, ההודעה הראשונה לאדם שלא ידוע אם הסכים היא בקשת אישור עם קישור. ההודעה המבוקשת נשלחת רק אחרי שהאדם אישר.","consent.switch":"בקשת אישור לפני ההודעה הראשונה","consent.on":"מופעל · אדם שלא אישר מקבל קודם בקשת אישור","consent.off":"כבוי · אפשר לשלוח גם למי שלא ידוע אם הסכים","consent.wait":"ימים להמתנה לתשובה","consent.wait_hint":"בין {min} ל־{max} · בלי תשובה ההודעה לא נשלחת והשולח מקבל התראה","consent.language":"שפת בקשת האישור","consent.lang.he":"עברית","consent.lang.en":"אנגלית","consent.lang.ar":"ערבית (טיוטה)","consent.lang.ru":"רוסית (טיוטה)","consent.wa_template":"שם התבנית המאושרת בוואטסאפ","consent.wa_template_hint":"לפנייה ראשונה. אישור התבנית מול וואטסאפ נעשה על ידי בעל החשבון","consent.wa_language":"קוד השפה של התבנית","consent.rules":"בקשת אישור אחת לאדם בכל {days} יום · עד {held} הודעות ממתינות לאדם","consent.problem.module_off":"הדף הציבורי כבוי · אי אפשר לשלוח בקשת אישור","consent.problem.public_page":"הדף הציבורי אינו זמין או שאין לו כתובת · אי אפשר לשלוח בקשת אישור","consent.problem.key":"מפתח הקישורים חסר · אי אפשר לשלוח בקשת אישור","err.bad_name":"אותיות לטיניות קטנות, ספרות וקו תחתון בלבד","err.bad_language":"קוד שפה לא תקין (למשל he או en_US)","err.template_send_unsupported":"שליחת תבנית וואטסאפ מאושרת עדיין אינה נתמכת - השאירו ריק","consent.no_template":"בקשת האישור נשלחת כהודעת טקסט רגילה. שליחה בתבנית וואטסאפ מאושרת עדיין אינה נתמכת, ולכן אדם שלא כתב לחשבון ב־24 השעות האחרונות עלול לא לקבל אותה",save:"שמירה",saving:"שומר…",revert:"ביטול שינויים",saved:"נשמר",unsaved:"יש שינויים שלא נשמרו",invalid:"יש לתקן את השדות המסומנים",save_failed:"השמירה נכשלה",conflict:"ההגדרות נשמרו בינתיים על ידי מישהו אחר",reload:"טעינה מחדש","err.empty":"חובה למלא","err.too_long":"ארוך מדי","err.control_chars":"יש תווים שאי אפשר להשתמש בהם","err.credential":"אי אפשר לכלול קוד גישה או פרטי כניסה","err.unknown_placeholder":"בין סוגריים מסולסלים מותר {name} ו־{organization} בלבד","err.bad_braces":"סוגריים מסולסלים לא תקינים","err.too_many_placeholders":"יותר מדי מילים להחלפה בתבנית אחת","err.organization_missing":"התבנית משתמשת בשם הארגון והוא לא הוגדר","err.duplicate_label":"יש כבר תבנית בשם הזה","err.range":"מחוץ לטווח המותר","err.type":"יש להזין מספר שלם","err.too_many":"יותר מדי תבניות","err.window_invalid":"יש להזין שעה בתבנית 08:00","err.window_across_midnight":"שעת ההתחלה חייבת להיות לפני שעת הסיום","err.window_empty":"שעת ההתחלה ושעת הסיום זהות","err.other":"ערך לא תקין"},Tt={"service.account_not_covered":"The selected account is not in the list the messaging service sent this time (the list is limited) · try again or choose another account","sender.title":"Messages per sender per hour","sender.hint":"Refused messages count too · {min} to {max}","person.title":"Messages per recipient per day","person.hint":"By person and by phone number · {min} to {max}","station.title":"Messages per hour to a station's people","station.hint":"Each station separately · {min} to {max}","hours.title":"Send hours","hours.on":"Messages go out only between these times (installation time)","hours.off":"No time restriction","hours.from":"From","hours.to":"Until","err.window_invalid":"Enter a time like 08:00","err.window_across_midnight":"The start must be earlier than the end","err.window_empty":"The start and the end are the same","err.range":"Out of the allowed range","err.type":"Enter a whole number","err.credential":"An access code or sign-in details cannot be included","err.template_send_unsupported":"Sending an approved WhatsApp template is not supported yet - leave it empty","consent.no_template":"The consent request goes out as a plain text message. An approved WhatsApp template cannot be sent yet, so a person who has not written to the account in the last 24 hours may not receive it","optout.note":'A "do not message me" request applies to messages sent from here only; only a system administrator can clear it.'};function Ot(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function d(e,s){const t=(Ot()==="en"?Tt[e]:void 0)??Ee[e]??e;return s?t.replace(/\{(\w+)\}/g,(i,a)=>a in s?String(s[a]):i):t}const At=new Set(Object.keys(Ee).filter(e=>e.startsWith("err.")).map(e=>e.slice(4)));function Pt(e){return d(At.has(e)?`err.${e}`:"err.other")}var jt=Object.defineProperty,Et=Object.getOwnPropertyDescriptor,w=(e,s,t,i)=>{for(var a=i>1?void 0:i?Et(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(s,t,a):l(a))||a);return i&&a&&jt(s,t,a),a};const Mt=["he","en","ar","ru"],Nt=e=>e==="module_off"?"consent.problem.module_off":e==="key"?"consent.problem.key":"consent.problem.public_page",ke={from:"08:00",to:"21:00"},B=e=>/^\d+$/.test(e.trim())?Number(e):Number.NaN;let Lt=0;const Me=()=>`r${++Lt}`;function ie(e){return r`${e.split(/(\{[a-z]+\})/).map(s=>/^\{[a-z]+\}$/.test(s)?r`<bdi class="ltr">${s}</bdi>`:s)}`}const qt=e=>({revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:String(e.bulk_max),rate_per_hour:String(e.rate_per_hour),per_sender_per_hour:String(e.per_sender_per_hour??50),per_person_per_day:String(e.per_person_per_day??3),per_station_per_hour:String(e.per_station_per_hour??50),hours_on:e.send_hours!==null,hours_from:(e.send_hours??ke).from,hours_to:(e.send_hours??ke).to,organization:e.organization,account:e.account,templates:e.templates.map(s=>({key:Me(),id:s.id,label:s.label,body:s.body})),consent_by_link:e.consent_by_link===!0,consent_wait_days:String(e.consent_wait_days??7),consent_language:e.consent_language??"he",consent_wa_template:e.consent_wa_template??"",consent_wa_language:e.consent_wa_language??""}),ze=e=>({revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:B(e.bulk_max),rate_per_hour:B(e.rate_per_hour),per_sender_per_hour:B(e.per_sender_per_hour),per_person_per_day:B(e.per_person_per_day),per_station_per_hour:B(e.per_station_per_hour),send_hours:e.hours_on?{from:e.hours_from.trim(),to:e.hours_to.trim()}:null,organization:e.organization,account:e.account,templates:e.templates.map(s=>({...s.id?{id:s.id}:{},label:s.label,body:s.body})),consent_by_link:e.consent_by_link,consent_wait_days:/^\d+$/.test(e.consent_wait_days.trim())?Number(e.consent_wait_days):Number.NaN,consent_language:e.consent_language,consent_wa_template:e.consent_wa_template.trim(),consent_wa_language:e.consent_wa_language.trim()}),Se=e=>JSON.stringify([e.enabled,e.free_text,e.bulk_max.trim(),e.rate_per_hour.trim(),e.per_sender_per_hour.trim(),e.per_person_per_day.trim(),e.per_station_per_hour.trim(),e.hours_on,e.hours_from.trim(),e.hours_to.trim(),e.organization.trim(),e.account,e.templates.map(s=>[s.id??"",s.label.trim(),s.body.trim()]),e.consent_by_link,e.consent_wait_days.trim(),e.consent_language,e.consent_wa_template.trim(),e.consent_wa_language.trim()]);let f=class extends j{constructor(){super(...arguments),this.rev=0,this.reply=null,this.draft=null,this.base="",this.loading=!0,this.failed="",this.saving=!1,this.notice="",this.noticeText="",this.submitted=!1,this.touched=new Set,this.remote=[],this.lastRev=0,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.load())}async load(){const e=++this.gen;this.failed="";try{const s=await Ds();if(e!==this.gen)return;this.adopt(s)}catch(s){if(e!==this.gen)return;this.failed=L(s)}finally{e===this.gen&&(this.loading=!1)}}adopt(e){this.reply=e,this.draft=qt(e.settings),this.base=Se(this.draft),this.submitted=!1,this.touched=new Set,this.remote=[],this.notice=""}set(e,s=""){this.draft&&(this.draft={...this.draft,...e},this.notice="",this.remote=[],s&&(this.touched=new Set([...this.touched,s])))}setRow(e,s,t){this.draft&&this.set({templates:this.draft.templates.map((i,a)=>a===e?{...i,...s}:i)},`templates.${e}.${t}`)}addRow(){this.draft&&this.set({templates:[...this.draft.templates,{key:Me(),label:d("template.new"),body:""}]})}removeRow(e){this.draft&&(this.set({templates:this.draft.templates.filter((s,t)=>t!==e)}),this.touched=new Set)}insert(e,s,t){if(!this.draft)return;const i=this.draft.templates[e],a=Ct(i.body,s,t?.selectionStart??null,t?.selectionEnd??null);this.setRow(e,{body:a.text},"body"),this.updateComplete.then(()=>{t?.focus(),t?.setSelectionRange(a.caret,a.caret)})}revert(){this.reply&&this.adopt(this.reply),this.notice=""}get dirty(){return!!this.draft&&Se(this.draft)!==this.base}problems(){if(!this.draft)return[];const e=St(ze(this.draft),this.reply?.limits??je);return[...e,...this.remote.filter(s=>!e.some(t=>t.path===s.path))]}async save(){if(!(!this.draft||this.saving)&&(this.submitted=!0,!this.problems().length)){this.saving=!0,this.notice="";try{const e=await Fs(ze(this.draft));this.adopt(e),this.notice="saved"}catch(e){const s=Is(e);s?(this.remote=s,this.notice="failed",this.noticeText=d("invalid")):Us(e)?this.notice="conflict":(this.notice="failed",this.noticeText=`${d("save_failed")} · ${L(e)}`)}finally{this.saving=!1}}}shown(e){return this.submitted||this.touched.has(e)?Rt(this.problems(),e):[]}problemLine(e){const s=this.shown(e);return s.length?r`<div class="problem" role="alert" data-msg-problem=${s[0].code} data-msg-problem-path=${e}><sw-icon name="warning" size=${14}></sw-icon><span>${ie(Pt(s[0].code))}</span></div>`:c}capField(e,s,t){const i=this.draft;return r`<div>
      <sw-field label=${d(`${s}.title`)} hint=${d(`${s}.hint`,{min:t[0],max:t[1]})} ?data-bad=${this.shown(e).length>0}>
        <input type="text" inputmode="numeric" .value=${i[e]} data-msg-setting=${e} @input=${a=>this.set({[e]:a.target.value},e)} />
      </sw-field>
      ${this.problemLine(e)}
    </div>`}serviceLine(e){const s=e.service;let t="ok",i;if(s.problem)t="warn",i=d(`service.${s.problem}`);else if(s.connected===!0){const a=s.accounts.length===1?s.accounts[0].name:s.accounts.find(o=>o.id===this.draft?.account)?.name;i=a?`${d("service.connected")} · ${d("service.account",{name:a})}`:d("service.connected")}else s.connected===!1?(t="warn",i=s.state==="unsupported"?d("service.unsupported"):d("service.not_connected")):(t="muted",i=d("service.unknown"));return r`<div class="svc" data-msg-service=${s.connected===!0&&!s.problem?"connected":s.connected===!1?"not_connected":"unknown"}><span class="dot ${t}"></span><span>${i}</span></div>`}renderTemplate(e,s,t){const i=this.shown(`templates.${s}.label`),a=this.shown(`templates.${s}.body`);return r`<div class="tpl" data-msg-template-row=${s} data-msg-template-key=${e.id??"new"}>
      <div class="tpl-head">
        <sw-field label=${d("template.label")} ?data-bad=${i.length>0}>
          <input type="text" maxlength=${t.label_max*2} .value=${e.label} data-msg-template-label @input=${o=>this.setRow(s,{label:o.target.value},"label")} />
        </sw-field>
        <sw-button variant="ghost" iconOnly icon="trash" label=${d("template.remove")} data-msg-template-remove @click=${()=>this.removeRow(s)}></sw-button>
      </div>
      ${this.problemLine(`templates.${s}.label`)}
      <sw-field label=${d("template.body")} ?data-bad=${a.length>0}>
        <textarea rows="4" .value=${e.body} data-msg-template-body @input=${o=>this.setRow(s,{body:o.target.value},"body")}></textarea>
      </sw-field>
      ${this.problemLine(`templates.${s}.body`)}
      <div class="tpl-foot">
        <div class="chips">
          <button type="button" class="chipbtn" data-msg-insert="name" @click=${o=>this.insert(s,"{name}",this.textareaOf(o))}>${d("template.insert_name")}</button>
          <button type="button" class="chipbtn" data-msg-insert="organization" @click=${o=>this.insert(s,"{organization}",this.textareaOf(o))}>${d("template.insert_org")}</button>
        </div>
        <span class="cnt" aria-hidden="true">${d("template.counter",{n:e.body.length,max:t.body_max})}</span>
      </div>
    </div>`}textareaOf(e){return e.currentTarget.closest(".tpl")?.querySelector("textarea")??null}renderConsent(e,s){const t=s.consent,i=t?.page_problem??null;return r`<sw-card flush data-msg-settings-card="consent">
      <div class="ch"><div><h3>${d("consent.title")}</h3><div class="sub">${d("consent.sub")}</div></div></div>
      <button type="button" class="sw" role="switch" aria-checked=${String(e.consent_by_link)} data-msg-setting="consent_by_link" @click=${()=>this.set({consent_by_link:!e.consent_by_link},"consent_by_link")}>
        <span class="txt"><span class="t">${d("consent.switch")}</span><span class="x">${e.consent_by_link?d("consent.on"):d("consent.off")}</span></span>
        <span class="track" aria-hidden="true"></span>
      </button>
      ${this.problemLine("consent_by_link")}
      ${e.consent_by_link&&i?r`<div class="note err" role="alert" data-msg-consent-problem=${i}><sw-icon name="warning" size=${16}></sw-icon><span>${d(Nt(i))}</span></div>`:c}
      <div class="fields">
        <div>
          <sw-field label=${d("consent.wait")} hint=${d("consent.wait_hint",{min:t?.wait_days[0]??1,max:t?.wait_days[1]??30})} ?data-bad=${this.shown("consent_wait_days").length>0}>
            <input type="text" inputmode="numeric" .value=${e.consent_wait_days} data-msg-setting="consent_wait_days" @input=${a=>this.set({consent_wait_days:a.target.value},"consent_wait_days")} />
          </sw-field>
          ${this.problemLine("consent_wait_days")}
        </div>
        <div>
          <sw-field label=${d("consent.language")}>
            <select data-msg-setting="consent_language" @change=${a=>this.set({consent_language:a.target.value})}>
              ${Mt.map(a=>r`<option value=${a} ?selected=${e.consent_language===a}>${d(`consent.lang.${a}`)}</option>`)}
            </select>
          </sw-field>
        </div>
        ${t?.template_send_supported===!1?c:r`<div>
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
      ${t?.template_send_supported===!1?r`<div class="hint" data-msg-consent-no-template>${d("consent.no_template")}</div>`:c}
      <div class="hint" data-msg-consent-rules>${d("consent.rules",{days:t?.resend_days??30,held:t?.held_per_person??3})}</div>
    </sw-card>`}render(){if(this.loading)return r`<div class="stack" data-access-status="loading"><sw-card flush>${z(4)}</sw-card></div>`;if(!this.draft||!this.reply)return r`<div class="stack" data-access-status="error">${b("error",this.failed,()=>void this.load())}</div>`;const e=this.draft,s=this.reply,t=s.limits,i=s.service.accounts,a=this.dirty,o=this.submitted&&this.problems().length>0;return r`<div class="stack" data-access-status="ready" data-msg-settings>
      <sw-card flush data-msg-settings-card="general">
        <div class="ch"><div><h3>${d("title")}</h3><div class="sub">${d("sub")}</div></div></div>
        ${this.serviceLine(s)}
        <button type="button" class="sw" role="switch" aria-checked=${String(e.enabled)} data-msg-setting="enabled" @click=${()=>this.set({enabled:!e.enabled})}>
          <span class="txt"><span class="t">${d("enabled.title")}</span><span class="x">${e.enabled?d("enabled.on"):d("enabled.off")}</span></span>
          <span class="track" aria-hidden="true"></span>
        </button>
        <button type="button" class="sw" role="switch" aria-checked=${String(e.free_text)} data-msg-setting="free_text" @click=${()=>this.set({free_text:!e.free_text})}>
          <span class="txt"><span class="t">${d("free.title")}</span><span class="x">${e.free_text?d("free.on"):d("free.off")}</span></span>
          <span class="track" aria-hidden="true"></span>
        </button>
        <div class="hint" data-msg-optout-note>${d("optout.note")}</div>
        <div class="fields">
          <div>
            <sw-field label=${d("bulk.title")} hint=${d("bulk.hint",{min:t.bulk_max[0],max:t.bulk_max[1]})} ?data-bad=${this.shown("bulk_max").length>0}>
              <input type="text" inputmode="numeric" .value=${e.bulk_max} data-msg-setting="bulk_max" @input=${l=>this.set({bulk_max:l.target.value},"bulk_max")} />
            </sw-field>
            ${this.problemLine("bulk_max")}
          </div>
          <div>
            <sw-field label=${d("rate.title")} hint=${d("rate.hint",{min:t.rate_per_hour[0],max:t.rate_per_hour[1]})} ?data-bad=${this.shown("rate_per_hour").length>0}>
              <input type="text" inputmode="numeric" .value=${e.rate_per_hour} data-msg-setting="rate_per_hour" @input=${l=>this.set({rate_per_hour:l.target.value},"rate_per_hour")} />
            </sw-field>
            ${this.problemLine("rate_per_hour")}
          </div>
          ${this.capField("per_sender_per_hour","sender",t.per_sender_per_hour??[1,1e3])}
          ${this.capField("per_person_per_day","person",t.per_person_per_day??[1,50])}
          ${this.capField("per_station_per_hour","station",t.per_station_per_hour??[1,1e3])}
          <div data-msg-send-hours>
            <button type="button" class="sw" role="switch" aria-checked=${String(e.hours_on)} data-msg-setting="send_hours" @click=${()=>this.set({hours_on:!e.hours_on},"send_hours")}>
              <span class="txt"><span class="t">${d("hours.title")}</span><span class="x">${e.hours_on?d("hours.on"):d("hours.off")}</span></span>
              <span class="track" aria-hidden="true"></span>
            </button>
            ${e.hours_on?r`<div class="fields">
                  <sw-field label=${d("hours.from")} ?data-bad=${this.shown("send_hours").length>0}>
                    <input type="time" lang=${ue()} class="ltr" .value=${e.hours_from} data-msg-setting="send_hours_from" @input=${l=>this.set({hours_from:l.target.value},"send_hours")} />
                  </sw-field>
                  <sw-field label=${d("hours.to")} ?data-bad=${this.shown("send_hours").length>0}>
                    <input type="time" lang=${ue()} class="ltr" .value=${e.hours_to} data-msg-setting="send_hours_to" @input=${l=>this.set({hours_to:l.target.value},"send_hours")} />
                  </sw-field>
                </div>`:c}
            ${this.problemLine("send_hours")}
          </div>
          <div>
            <sw-field label=${d("org.title")} ?data-bad=${this.shown("organization").length>0}>
              <input type="text" .value=${e.organization} data-msg-setting="organization" @input=${l=>this.set({organization:l.target.value},"organization")} />
            </sw-field>
            <div class="hint" data-msg-org-hint>${ie(d("org.hint"))}</div>
            ${this.problemLine("organization")}
          </div>
          ${i.length>1?r`<div>
                <sw-field label=${d("account.title")}>
                  <select data-msg-setting="account" @change=${l=>this.set({account:l.target.value})}>
                    <option value="" ?selected=${e.account===""}>${d("account.choose")}</option>
                    ${i.map(l=>r`<option value=${l.id} ?selected=${e.account===l.id}>${l.name}</option>`)}
                  </select>
                </sw-field>
              </div>`:c}
        </div>
      </sw-card>

      ${this.renderConsent(e,s)}

      <sw-card flush data-msg-settings-card="templates">
        <div class="ch">
          <div><h3>${d("templates.title")}</h3><div class="sub">${ie(d("templates.sub"))}</div></div>
          <div class="ctl"><sw-button icon="plus" data-msg-template-add ?disabled=${e.templates.length>=t.templates_max} @click=${()=>this.addRow()}>${d("template.add")}</sw-button></div>
        </div>
        ${this.problemLine("templates")}
        ${e.templates.length===0?r`<div class="empty" data-msg-templates-empty>${d("templates.empty")}</div>`:e.templates.map((l,h)=>this.renderTemplate(l,h,t))}
      </sw-card>

      <div class="actions" data-msg-actions>
        <span class="grow">
          ${this.notice==="saved"?r`<span class="note info" role="status" data-msg-notice="saved"><sw-icon name="check" size=${16}></sw-icon><span>${d("saved")}</span></span>`:c}
          ${this.notice==="failed"?r`<span class="note err" role="alert" data-msg-notice="failed"><sw-icon name="warning" size=${16}></sw-icon><span>${this.noticeText}</span></span>`:c}
          ${this.notice==="conflict"?r`<span class="note stale" role="alert" data-msg-notice="conflict"><sw-icon name="warning" size=${16}></sw-icon><span>${d("conflict")}</span><sw-button size="sm" data-msg-reload @click=${()=>void this.load()}>${d("reload")}</sw-button></span>`:c}
          ${this.notice===""&&o?r`<span class="note err" role="alert" data-msg-notice="invalid"><sw-icon name="warning" size=${16}></sw-icon><span>${d("invalid")}</span></span>`:c}
          ${this.notice===""&&!o&&a?r`<span class="note info" data-msg-notice="unsaved"><span>${d("unsaved")}</span></span>`:c}
        </span>
        <sw-button data-msg-revert ?disabled=${!a||this.saving} @click=${()=>this.revert()}>${d("revert")}</sw-button>
        <sw-button variant="primary" data-msg-save ?disabled=${!a||this.saving} @click=${()=>void this.save()}>${this.saving?d("saving"):d("save")}</sw-button>
      </div>

      <wa-installed-card></wa-installed-card>
    </div>`}};f.styles=[H,C`
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
        background: var(--sw-toggle-off);
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
    `,X,W];w([R({type:Number})],f.prototype,"rev",2);w([u()],f.prototype,"reply",2);w([u()],f.prototype,"draft",2);w([u()],f.prototype,"base",2);w([u()],f.prototype,"loading",2);w([u()],f.prototype,"failed",2);w([u()],f.prototype,"saving",2);w([u()],f.prototype,"notice",2);w([u()],f.prototype,"noticeText",2);w([u()],f.prototype,"submitted",2);w([u()],f.prototype,"touched",2);w([u()],f.prototype,"remote",2);f=w([E("system-access-messaging")],f);var Dt=Object.defineProperty,Ft=Object.getOwnPropertyDescriptor,T=(e,s,t,i)=>{for(var a=i>1?void 0:i?Ft(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(i?l(s,t,a):l(a))||a);return i&&a&&Dt(s,t,a),a};let x=class extends j{constructor(){super(...arguments),this.view="",this.rev=0,this.meta=null,this.zone=ee,this.admin=!0,this.wide=!0,this.people=!0,this.configure=!1,this.stop=null,this.onMeta=e=>{const s=e.detail;this.meta=s.meta,this.zone=s.zone}}connectedCallback(){super.connectedCallback(),this.sync(),this.stop=Re(()=>this.sync())}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}sync(){const e=Q();this.admin=e.admin,this.people=e.people,this.wide=!_()||U("access.admin.read"),this.configure=_()&&U("system.configure")}segments(){const e=[{id:"status",label:n("segStatus")}];return this.wide&&e.push({id:"audit",label:n("segAudit")}),(this.people||this.wide)&&e.push({id:"groups",label:n("segGroups")}),this.configure&&e.push({id:"policy",label:n("segPolicy")}),this.configure&&e.push({id:"messaging",label:d("segment")}),e}active(e){return e.find(s=>s.id===this.view)?.id??"status"}subtitle(){if(!this.meta)return"";const e=Ns(this.meta,new Date,this.zone);return[e.version?n("hlVersion",{v:e.version}):"",e.connected===!0?n("hlConnected"):e.connected===!1?n("hlDisconnected"):"",e.checked.key!=="none"?n("hlChecked",{when:$(e.checked)}):""].filter(Boolean).join(" · ")}render(){if(_()&&!this.admin)return r`<sw-page heading=${n("title")}><sw-state-panel quiet data-access-state="no_permission" state="forbidden" heading=${n("noPermission")}></sw-state-panel></sw-page>`;const e=this.segments(),s=this.active(e),t=e.map(i=>({id:i.id,label:i.label,href:`${Fe}${i.id==="status"?"":`/${i.id}`}`}));return r`<sw-page heading=${n("title")} subheading=${this.subtitle()} wide>
      <sw-button slot="actions" size="lg" variant="ghost" icon="refresh" data-access-refresh @click=${()=>this.rev+=1}>${n("refresh")}</sw-button>
      ${e.length>1?r`<div class="segs"><sw-tabs .items=${t} .active=${s} .variant=${Ie(null,2)} group-label=${n("segments")} data-access-segments></sw-tabs></div>`:c}
      <div class="body" data-access-segment=${s}>
        ${s==="audit"?r`<system-access-audit .rev=${this.rev} @access-meta=${this.onMeta}></system-access-audit>`:s==="groups"?r`<system-access-groups .rev=${this.rev} @access-meta=${this.onMeta}></system-access-groups>`:s==="policy"?r`<system-access-policy .rev=${this.rev}></system-access-policy>`:s==="messaging"?r`<system-access-messaging .rev=${this.rev}></system-access-messaging>`:r`<system-access-status .rev=${this.rev} @access-meta=${this.onMeta}></system-access-status>`}
        <wk-deep-links class="deeplinks" place=${`settings-${s}`}></wk-deep-links>
      </div>
    </sw-page>`}};x.styles=[Ue,C`
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
    `,W];T([R()],x.prototype,"view",2);T([u()],x.prototype,"rev",2);T([u()],x.prototype,"meta",2);T([u()],x.prototype,"zone",2);T([u()],x.prototype,"admin",2);T([u()],x.prototype,"wide",2);T([u()],x.prototype,"people",2);T([u()],x.prototype,"configure",2);x=T([E("system-access-control")],x);export{x as SystemAccessControl};
//# sourceMappingURL=system-access-control-DO3oPWOj.js.map
