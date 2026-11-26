import{b4 as be,j as N,z as T,a as E,b as r,A as d,m as j,k as h,af as C,aM as G,d1 as He,bg as pe,q as U,bE as ls,F as ds,bw as cs,bs as ue,bu as We,br as Je,bt as Be,d0 as ps,eb as us,aj as Se,e as Re,bo as Ce,ei as ze,yg as hs,ep as ms}from"./index-CoJbESCx.js";import"./wk-deep-links-CAkKjS_5.js";import"./sw-table-DhR8Spy7.js";import{c as ws,d as fs,b as he,e as vs,a as _s,g as gs,A as bs,f as $s,h as ys,i as ks}from"./access-status-CDOV_aGL.js";import{R as y,b as a,m as Ve,c as we,d as J,e as Ae,g as B,h as V,y as Te,i as xs,j as Ss,k as Rs,l as Cs,n as S,o as z,p as zs,q as As,r as Ts,t as Os,u as Ps,v as Ns,f as k,x as Es,z as js,A as Ms,B as Ls,C as qs,D as Ds,E as Fs,F as Oe,s as R,G as Us,H as Is,I as Ks,J as Ge,K as Hs,L as Ws,M as Js,N as Pe,O as Ne,P as Bs,Q as Vs,S as Gs,T as Zs,U as Ys,w as Ze,a as Ye,V as Qs,W as Xs,X as et,Y as st,Z as tt,_ as at,$ as nt,a0 as Ee,a1 as it,a2 as rt,a3 as ot}from"./status-text-BVyvl0sU.js";import{c as je,l as lt}from"./events-logic-B03uUwx9.js";import{s as H,C as w}from"./status-css-DjHi95uK.js";import{U as te}from"./wiskey-format-CZ5xHydf.js";import{b as W}from"./bubble-chrome-Da7T662v.js";import{p as Qe,s as ee,l as ge,h as dt,g as ct,a as pt,b as ut,i as ht}from"./access-messaging-De4wjBkm.js";import{a as de}from"./access-B1MER8jd.js";import{T as mt}from"./toast-controller-BPX0Tkjm.js";import{a as wt}from"./settings-xDM-ttq5.js";import"./sw-logo-art-PLtEZJxU.js";import"./deep-links-DLVZNwA1.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";import"./wiskey-jRkTuT87.js";import"./wiskey-profiles-BeKASYyZ.js";var ft=Object.defineProperty,vt=Object.getOwnPropertyDescriptor,ae=(e,s,t,i)=>{for(var n=i>1?void 0:i?vt(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&ft(s,t,n),n};const _t={ok:"ok",warn:"warn",err:"err",off:"off",unk:"unk"};let I=class extends E{constructor(){super(...arguments),this.station=null,this.zone={kind:"iana",name:"UTC"},this.rev=0,this.now=new Date,this.health=null,this.history=null,this.ctl=null,this.loadedFor="",this.lastRev=0}willUpdate(e){const s=this.station?.id??"";if(s&&(s!==this.loadedFor||e.has("rev")&&this.rev!==this.lastRev)){const t=s===this.loadedFor;this.lastRev=this.rev,t?(this.health?.reload(),this.history?.reload()):this.start(s)}}disconnectedCallback(){this.stop(),super.disconnectedCallback()}start(e){this.stop(),this.loadedFor=e,this.ctl=new AbortController;const s=this.ctl.signal;this.health=new y({fetch:()=>ws(e,s),pick:t=>t.health,onChange:()=>this.requestUpdate()}),this.history=new y({fetch:()=>fs(e,s),pick:t=>t.history,onChange:()=>this.requestUpdate()}),this.health.reload(),this.history.reload()}stop(){this.ctl?.abort(),this.health?.dispose(),this.history?.dispose(),this.health=null,this.history=null,this.loadedFor=""}row(e,s){return r`<dt>${e}</dt><dd>${s}</dd>`}tone(e,s){return r`<span class="with"><span class="dot ${_t[e]}" aria-hidden="true"></span>${s}</span>`}connection(e){const s=e.requests,t=e.online;return r`<section class="sect" data-health-section="connection">
      <h4>${a("hdConnection")}</h4>
      <dl>
        ${this.row(a("hdState"),t===null?"—":this.tone(t?"ok":"off",t?a("hdOnline"):a("hdOffline")))}
        ${this.row(a("hdFirmware"),r`<bdi class="ltr">${Ve(null,e.firmware)||"—"}</bdi>`)}
        ${this.row(a("hdPollFailures"),e.consecutive_poll_failures===null?"—":String(e.consecutive_poll_failures))}
        ${this.row(a("hdRequests"),s.requests===null?"—":a("hdRequestsVal",{n:s.requests,f:s.failures??0}))}
        ${this.row(a("hdLastMs"),we(s.last_ms))}
        ${this.row(a("hdP95"),we(s.p95_ms))}
      </dl>
    </section>`}access(e){const s=e.access,t=J(s.sync_state,!0),i=Ae(s.assignment_states,o=>B(J(o,!0).word)),n=Ae(s.errors,o=>V(o));return r`<section class="sect" data-health-section="sync">
      <h4>${a("hdSync")}</h4>
      <dl>
        ${this.row(a("hdSyncState"),r`<sw-badge kind=${t.kind} label=${B(t.word)}></sw-badge>`)}
        ${s.last_error?this.row(a("colError"),V(s.last_error)):d}
        ${this.row(a("hdQueue"),s.queue_depth===null?"—":String(s.queue_depth))}
        ${this.row(a("hdWorker"),Te(s.worker_active))}
        ${this.row(a("hdPendingRequest"),Te(s.pending_request))}
        ${i?this.row(a("hdAssignments"),i):d}
        ${n?this.row(a("hdErrors"),n):d}
      </dl>
    </section>`}events(e){const s=e.events;return s?r`<section class="sect" data-health-section="events">
      <h4>${a("hdEvents")}</h4>
      <dl>
        ${this.row(a("hdStream"),this.tone(xs(s.stream),Ss(s.stream)))}
        ${this.row(a("hdHistoryState"),this.tone(Rs(s.history),Cs(s.history)))}
        ${this.row(a("hdReconnects"),s.reconnects===null?"—":String(s.reconnects))}
        ${this.row(a("hdLastFrame"),S(z(s.last_frame_at,this.now,this.zone)))}
        ${s.storage_failed?this.row(a("hdStorageFailed"),a("hdYes")):d}
      </dl>
    </section>`:r`<section class="sect" data-health-section="events"><h4>${a("hdEvents")}</h4><div class="none">${a("hdNoEvents")}</div></section>`}clock(e){const s=e.clock;return s?r`<section class="sect" data-health-section="clock">
      <h4>${a("hdClock")}</h4>
      <dl>
        ${this.row(a("hdClockStatus"),this.tone(zs(s.status),As(s.status)))}
        ${this.row(a("hdSkew"),Ts(s.skew_seconds))}
        ${this.row(a("hdDrift"),this.tone(Os(s.drift_state),Ps(s.drift_state)))}
        ${this.row(a("hdTimeMode"),Ns(s.time_mode))}
        ${this.row(a("hdChecked"),S(z(s.checked_at,this.now,this.zone)))}
        ${s.error?this.row(a("hdClockError"),V(s.error)):d}
      </dl>
    </section>`:r`<section class="sect" data-health-section="clock"><h4>${a("hdClock")}</h4><div class="none">${a("hdNoClock")}</div></section>`}strip(){const e=this.history,s=e?.snap;if(!e||!s||s.busy&&!s.data)return r`<section class="sect sk-box" data-health-section="history"><h4>${a("hdHistory")}</h4><span class="sk"></span></section>`;if(!s.data)return r`<section class="sect" data-health-section="history"><h4>${a("hdHistory")}</h4>${s.failure&&s.failure!=="forbidden"?k(s.failure,s.message,()=>void e.reload(),!0):d}</section>`;const t=Es(s.data.records,this.zone,this.now),i=t.some(n=>n.samples>0);return r`<section class="sect" data-health-section="history">
      <h4>${a("hdHistory")}</h4>
      ${i?r`<div class="strip" data-health-strip>
            ${t.map(n=>{const o=`${je(n.date).replace(/\.\d{4}$/,"")}${n.onlinePct===null?"":` · ${a("hdHistoryPct",{p:n.onlinePct})}`}${n.pollMs===null?"":` · ${we(n.pollMs)}`}`;return r`<div class="day ${n.tone}" role="img" aria-label=${o} title=${o} data-health-day=${n.date}><span class="bar"></span><span class="pct">${n.onlinePct===null?"—":`${n.onlinePct}%`}</span><span class="dt">${je(n.date).replace(/\.\d{4}$/,"")}</span></div>`})}
          </div>`:r`<div class="none">${a("hdHistoryNone")}</div>`}
      ${s.data.storage_failed?r`<div class="none">${a("hdHistoryStorage")}</div>`:d}
    </section>`}render(){if(!this.station)return d;const s=this.health,t=s?.snap;if(!s||!t||t.busy&&!t.data)return r`<section class="sect sk-box" data-health-loading aria-busy="true"><span class="sk"></span><span class="sk"></span><span class="sk"></span></section>`;if(!t.data)return r`${t.failure?k(t.failure,t.message,()=>void s.reload(),!0):d}`;const i=s.stale;return r`
      ${i?r`<div class="note" role="status" data-health-stale><sw-icon name="offline" size=${16}></sw-icon><span>${t.fetchedAt?a("stale",{t:S(z(t.fetchedAt,this.now,this.zone))}):a("staleNever")}</span></div>`:d}
      ${this.connection(t.data)}${this.access(t.data)}${this.events(t.data)}${this.clock(t.data)}${this.strip()}
    `}};I.styles=N`
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
    ${be}
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
  `;ae([T({attribute:!1})],I.prototype,"station",2);ae([T({attribute:!1})],I.prototype,"zone",2);ae([T({type:Number})],I.prototype,"rev",2);ae([T({attribute:!1})],I.prototype,"now",2);I=ae([j("system-access-health")],I);const Z=N`
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
`;var gt=Object.defineProperty,bt=Object.getOwnPropertyDescriptor,Y=(e,s,t,i)=>{for(var n=i>1?void 0:i?bt(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&gt(s,t,n),n};const $t=6e4;let L=class extends E{constructor(){super(...arguments),this.rev=0,this.selected="",this.kind="",this.muted=!1,this.wide=!0,this.timer=0,this.stopSession=null,this.lastMeta="",this.lastRev=0,this.nameOf=e=>this.stationsRes.snap.data?.find(s=>s.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.stationsRes=new y({fetch:()=>he(),pick:s=>s.stations,onChange:e}),this.syncRes=new y({fetch:()=>vs(),pick:s=>s.sync_status,onChange:e}),this.alertsRes=new y({fetch:s=>_s({kind:this.kind,includeSuppressed:this.muted,offset:typeof s=="number"?s:0}),pick:s=>s.alerts,merge:js,cursorOf:s=>s.next_offset,onChange:e}),this.conflictsRes=new y({fetch:()=>gs(),pick:s=>s.conflicts,onChange:e}),this.wide=!C()||G("access.admin.read"),this.stopSession=He(()=>{const s=!C()||G("access.admin.read");s!==this.wide&&(this.wide=s,this.reloadAll())}),this.reloadAll(),this.timer=window.setInterval(()=>{(typeof document>"u"||document.visibilityState==="visible")&&this.reloadAll()},$t)}disconnectedCallback(){window.clearInterval(this.timer),this.stopSession?.();for(const e of[this.stationsRes,this.syncRes,this.alertsRes,this.conflictsRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),this.syncRes.reload(),this.alertsRes.reload(),this.wide&&this.conflictsRes.reload()}emitMeta(){const e=this.stationsRes?.snap.reply?.sync??this.syncRes?.snap.reply?.sync??this.alertsRes?.snap.reply?.sync??null,s=JSON.stringify(e);s!==this.lastMeta&&(this.lastMeta=s,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.defaultZone()},bubbles:!0,composed:!0})))}defaultZone(){return this.stationsRes?.snap.reply?.default_zone??te}zoneOf(e){return Ms(this.stationsRes.snap.data,e,this.defaultZone())}tiles(e){const s=Ls(this.stationsRes.snap.data,this.syncRes.snap.data,this.wide?this.conflictsRes.snap.data:null),t=this.defaultZone(),i=(n,o,l,c="",u="")=>r`<div class="tile" data-access-tile=${n}><span class="k">${o?a(o):""}</span><span class="v ${u}">${l}</span>${c?r`<span class="d">${c}</span>`:r`<span class="d">&nbsp;</span>`}</div>`;return r`<div class="tiles" data-access-tiles>
      ${i("online","kpiOnline",String(s.online),a("kpiOnlineOf",{total:s.total}),s.total>0&&s.online<s.total?"warn":"")}
      ${i("pending","kpiPending",s.pending===null?"—":String(s.pending),"",(s.pending??0)>0?"warn":"")}
      ${s.conflicts===null?d:i("conflicts","kpiConflicts",String(s.conflicts),"",s.conflicts>0?"err":"")}
      ${i("last-sync","kpiLastSync",s.lastSync?lt(s.lastSync,t):"—",s.lastSync?S(z(s.lastSync,e,t)):"")}
    </div>`}stationRow(e,s){const t=qs(e),i=J(e.sync_state,e.online),n=Ve(e.technical?.model,e.technical?.firmware);return r`<button type="button" class="row two" data-access-station=${e.id} aria-label=${a("healthOpen",{name:e.name})} @click=${()=>this.selected=e.id}>
      <span class="dot ${t}" aria-hidden="true"></span>
      <span class="main"><span class="t">${e.name}</span>${n?r`<span class="s"><bdi class="ltr">${n}</bdi></span>`:d}</span>
      <span class="side"><sw-badge kind=${i.kind} label=${B(i.word)}></sw-badge><span class="when">${S(z(e.last_seen,s,this.zoneOf(e.id)))}</span></span>
      <sw-icon class="chev" name="chevronBack" size=${16}></sw-icon>
    </button>`}healthCard(e){const s=this.stationsRes.snap.data??[];return r`<sw-card flush data-access-card="health">
      <div class="ch"><div><h3>${a("healthTitle")}</h3><div class="sub">${a("healthSub")}</div></div></div>
      ${s.length?r`<div class="list">${s.map(t=>this.stationRow(t,e))}</div>`:r`<div class="empty">${a("healthEmpty")}</div>`}
    </sw-card>`}kindItems(){return[{id:"",label:a("alertKindAll")},...bs.map(e=>({id:e,label:a(`alert_${e}`)}))]}alertRow(e,s){const t=Ds(e);return r`<div class="row" data-access-alert=${e.id} data-tone=${t}>
      <span class="dot ${t==="muted"?"muted":t}" aria-hidden="true"></span>
      <span class="main"><span class="t">${Fs(e)}</span>${Oe(e,s,this.zoneOf(e.station_id))?r`<span class="s wrap">${Oe(e,s,this.zoneOf(e.station_id))}</span>`:d}</span>
    </div>`}alertsCard(e){const s=this.alertsRes,t=s.snap,i=t.data;let n;return!t.everAnswered||t.busy&&!i?n=R(3):i?i.items.length?n=r`<div class="list" data-access-alerts>${i.items.map(o=>this.alertRow(o,e))}</div>`:n=r`<div class="empty" data-access-alerts-empty><span class="dot ok" aria-hidden="true"></span>${a("alertsEmpty")}</div>`:n=r`<div class="empty-panel">${k(t.failure??"error",t.message,()=>void s.reload(),!0)}</div>`,r`<sw-card flush data-access-card="alerts">
      <div class="ch">
        <div><h3>${a("alertsTitle")}</h3><div class="sub">${a("alertsSub",{n:i?i.total??i.items.length:0})}</div></div>
        <div class="ctl">
          <sw-dropdown tall data-access-alert-kind label=${a("alertKind")} .items=${this.kindItems()} .value=${this.kind} @change=${o=>this.setKind(o.detail.id)}></sw-dropdown>
          <button type="button" class="chipbtn" data-access-alerts-muted aria-pressed=${String(this.muted)} @click=${()=>this.toggleMuted()}>${a("alertMutedShow")}</button>
        </div>
      </div>
      ${s.stale&&i?r`<div class="note stale" role="status" data-access-stale="alerts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(t.fetchedAt,e)}</span></div>`:d}
      ${n}
      ${i&&!i.complete?r`<div class="note info" role="status" data-access-alerts-partial><sw-icon name="info" size=${16}></sw-icon><span>${a("alertsPartial")}</span></div>`:d}
      ${s.hasMore?r`<div class="more"><sw-button size="lg" data-access-alerts-more ?disabled=${t.loadingMore} @click=${()=>void s.more()}>${t.loadingMore?a("loadingMore"):a("more")}</sw-button></div>`:d}
      ${t.moreFailed?r`<div class="note err" role="alert" data-access-alerts-more-failed><span>${a("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void s.more()}>${a("retry")}</sw-button></div>`:d}
    </sw-card>`}setKind(e){this.kind=e,this.alertsRes.reload()}toggleMuted(){this.muted=!this.muted,this.alertsRes.reload()}staleText(e,s){return e?a("stale",{t:S(z(e,s,this.defaultZone()))}):a("staleNever")}syncCard(e){const s=this.syncRes,t=s.snap,i=Us(t.data,this.nameOf),n=u=>u>0?String(u):"—",o=u=>u,l=[{key:"name",label:a("colStation"),render:u=>r`<span style=${w.strong}>${o(u).name}</span>`},{key:"managed",label:a("colManaged"),render:u=>o(u).managed===null?"—":String(o(u).managed)},{key:"pending",label:a("colPending"),render:u=>n(o(u).pending)},{key:"removals",label:a("colRemovals"),render:u=>n(o(u).removals)},{key:"failed",label:a("colFailed"),render:u=>n(o(u).failed)},{key:"last",label:a("colLastSync"),render:u=>S(z(o(u).reconciledAt,e,this.zoneOf(o(u).id)))},{key:"state",label:a("colState"),render:u=>{const g=J(o(u).state,!0);return r`<span style=${w.row}><sw-badge kind=${g.kind} label=${B(g.word)}></sw-badge>${o(u).error?r`<span style=${w.muted}>${V(o(u).error)}</span>`:d}</span>`}}];let c;return!t.everAnswered||t.busy&&!t.data?c=R(3):t.data?i.length?c=r`<sw-table data-access-sync .columns=${l} .rows=${i} rowKey="id"></sw-table>`:c=r`<div class="empty">${a("syncEmpty")}</div>`:c=k(t.failure??"error",t.message,()=>void s.reload(),!0),r`<sw-card flush data-access-card="sync">
      <div class="ch"><div><h3>${a("syncTitle")}</h3><div class="sub">${a("syncSub")}</div></div></div>
      ${s.stale&&t.data?r`<div class="note stale" role="status" data-access-stale="sync"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(t.fetchedAt,e)}</span></div>`:d}
      ${c}
    </sw-card>`}conflictsCard(e){if(!this.wide)return d;const s=this.conflictsRes,t=s.snap;if(t.failure==="forbidden")return d;const i=c=>c,n=[{key:"who",label:a("colWho"),render:c=>{const u=Is(i(c));return u.kind==="name"?r`<span style=${w.strong}>${u.text}</span>`:u.kind==="employee"?r`<span>${a("employeeShort",{n:u.text})}</span>`:r`<span style=${w.muted}>${a("unnamed")}</span>`}},{key:"kind",label:a("colKind"),render:c=>a(Ks(i(c).kind))},{key:"station",label:a("colStation"),render:c=>this.nameOf(i(c).station_id)},{key:"state",label:a("colState"),render:c=>{const u=J(i(c).sync_state,!0);return r`<sw-badge kind=${u.kind} label=${B(u.word)}></sw-badge>`}},{key:"error",label:a("colError"),render:c=>V(i(c).last_error)||"—"}],o=(t.data??[]).map((c,u)=>({...c,id:`${c.station_id}/${c.kind}/${c.person?.id??u}`}));let l;return!t.everAnswered||t.busy&&!t.data?l=R(2):t.data?o.length?l=r`<sw-table data-access-conflicts .columns=${n} .rows=${o} rowKey="id"></sw-table>`:l=r`<div class="empty" data-access-conflicts-empty><span class="dot ok" aria-hidden="true"></span>${a("conflictsEmpty")}</div>`:l=k(t.failure??"error",t.message,()=>void s.reload(),!0),r`<sw-card flush data-access-card="conflicts">
      <div class="ch"><div><h3>${a("conflictsTitle")}</h3><div class="sub">${a("conflictsSub")}</div></div></div>
      ${s.stale&&t.data?r`<div class="note stale" role="status" data-access-stale="conflicts"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(t.fetchedAt,e)}</span></div>`:d}
      ${l}
    </sw-card>`}drawer(e){const s=this.selected?this.stationsRes.snap.data?.find(i=>i.id===this.selected):void 0,t=s?J(s.sync_state,s.online):null;return r`<sw-drawer modal ?open=${!!s} heading=${s?.name??""} @close=${()=>this.selected=""} data-access-health-drawer>
      ${t?r`<sw-badge slot="action" kind=${t.kind} label=${B(t.word)}></sw-badge>`:d}
      ${s?r`<system-access-health data-access-health=${s.id} .station=${s} .zone=${this.zoneOf(s.id)} .rev=${this.rev} .now=${e}></system-access-health>`:d}
    </sw-drawer>`}render(){const e=new Date,s=this.stationsRes,t=s.snap;return!t.everAnswered||t.busy&&!t.data?r`<div class="stack" data-access-status="loading">${Ge()}<sw-card flush>${R(4)}</sw-card></div>`:t.data?r`<div class="stack" data-access-status="ready">
        ${s.stale?r`<div class="note stale" role="status" data-access-stale="page"><sw-icon name="offline" size=${16}></sw-icon><span>${this.staleText(t.fetchedAt,e)}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>this.reloadAll()}>${a("refresh")}</sw-button></div>`:d}
        ${this.tiles(e)}
        <div class="grid2">${this.healthCard(e)}${this.alertsCard(e)}</div>
        ${this.syncCard(e)}
        ${this.conflictsCard(e)}
      </div>
      ${this.drawer(e)}`:r`<div class="stack" data-access-status=${t.failure??"error"}>${k(t.failure??"error",t.message,()=>this.reloadAll())}</div>`}};L.styles=[H,N`
      .when {
        white-space: nowrap;
      }
    `,Z,W];Y([T({type:Number})],L.prototype,"rev",2);Y([h()],L.prototype,"selected",2);Y([h()],L.prototype,"kind",2);Y([h()],L.prototype,"muted",2);Y([h()],L.prototype,"wide",2);L=Y([j("system-access-status")],L);var yt=Object.defineProperty,kt=Object.getOwnPropertyDescriptor,Q=(e,s,t,i)=>{for(var n=i>1?void 0:i?kt(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&yt(s,t,n),n};const xt="display:inline-flex;align-items:center;min-block-size:var(--sw-touch-desktop,44px);padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer;text-decoration:underline;text-decoration-color:var(--sw-border-strong);text-underline-offset:3px";let q=class extends E{constructor(){super(...arguments),this.rev=0,this.station="",this.action="",this.period="",this.person=null,this.lastRev=0,this.lastMeta="",this.nameOf=e=>this.stationsRes.snap.data?.find(s=>s.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.stationsRes=new y({fetch:()=>he(),pick:s=>s.stations,onChange:e}),this.auditRes=new y({fetch:s=>$s({station_id:this.station,action:this.action,user_id:this.person?.id,start:Ws(this.period,new Date),before:typeof s=="number"?s:null}),pick:s=>s.audit,merge:Hs,cursorOf:s=>s.next_cursor,onChange:e}),this.reloadAll()}disconnectedCallback(){this.stationsRes?.dispose(),this.auditRes?.dispose(),super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),this.auditRes.reload()}emitMeta(){const e=this.auditRes?.snap.reply?.sync??this.stationsRes?.snap.reply?.sync??null,s=JSON.stringify(e);s!==this.lastMeta&&(this.lastMeta=s,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.zone()},bubbles:!0,composed:!0})))}zone(){return this.stationsRes?.snap.reply?.default_zone??te}stationItems(){return[{id:"",label:a("auditStationAll")},...(this.stationsRes.snap.data??[]).map(e=>({id:e.id,label:e.name}))]}actionItems(){return[{id:"",label:a("auditActionAll")},...Js.map(e=>({id:e,label:Pe(e)}))]}setStation(e){this.station=e,this.auditRes.reload()}setAction(e){this.action=e,this.auditRes.reload()}periodItems(){const e={"":a("auditPeriodAll"),"24h":a("auditPeriod24h"),"7d":a("auditPeriod7d"),"30d":a("auditPeriod30d")};return Ne.map(s=>({id:s,label:e[s]}))}setPeriod(e){this.period=Ne.includes(e)?e:"",this.auditRes.reload()}setPerson(e){this.person=e,this.auditRes.reload()}clear(){this.station="",this.action="",this.period="",this.person=null,this.auditRes.reload()}target(e){const s=Bs(e);if(s.kind==="none")return"—";if(s.kind==="person"){const i=r`<span>${s.name??a("unnamed")}${s.employee?r` <span style=${w.muted}>· ${a("employeeShort",{n:s.employee})}</span>`:d}</span>`,n=Vs(e);return!n||this.person?i:r`<button type="button" style=${xt} data-access-audit-person=${n.id} title=${a("auditPersonPick",{name:n.name})} @click=${()=>this.setPerson(n)}>${i}</button>`}const t=s.ids.map(i=>this.nameOf(i)).join(", ");return s.more?a("auditStationsMore",{names:t,n:s.more}):a("auditStations",{names:t})}actionCell(e){const s=Pe(e.action),t=Gs(e).map(n=>Zs(n)),i=!!s&&s!==e.action;return r`<span>${i?s:r`<span style=${w.raw}>${s||"—"}</span>`}${t.length?r`<span style=${w.sub}>${a("auditFields",{list:t.join(", ")})}</span>`:d}</span>`}resultCell(e){const s=Ys(e);return s.kind==="done"?r`<sw-badge kind="live" label=${a("resDone")}></sw-badge>`:r`<span style=${w.row}><sw-badge kind="error" label=${a("resFailed")}></sw-badge><span style=${w.muted}>${V(s.code)}</span></span>`}table(e,s){const t=this.zone(),i=o=>o,n=[{key:"time",label:a("colTime"),render:o=>i(o).time?Ze(Ye(i(o).time,s,t)):"—"},{key:"user",label:a("colUser"),render:o=>i(o).actor_name??a("actorNone")},{key:"action",label:a("colAction"),render:o=>this.actionCell(i(o))},{key:"target",label:a("colTarget"),render:o=>this.target(i(o))},{key:"result",label:a("colResult"),render:o=>this.resultCell(i(o))}];return r`<sw-table data-access-audit-table .columns=${n} .rows=${e.records} rowKey="sequence"></sw-table>`}render(){const e=this.auditRes,s=e.snap,t=new Date,i=s.data,n=!!(this.station||this.action||this.period||this.person);let o;if(!s.everAnswered||s.busy&&!i)o=R(5);else if(i)i.records.length?o=this.table(i,t):o=r`<div class="empty" data-access-audit-empty>${n?a("auditEmptyFiltered"):a("auditEmpty")}</div>`;else return r`<div class="stack" data-access-status=${s.failure??"error"}>${k(s.failure??"error",s.message,()=>this.reloadAll())}</div>`;const l=this.zone();return r`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="audit">
        <div class="ch">
          <div><h3>${a("auditTitle")}</h3><div class="sub">${a("auditSub")}</div></div>
          <div class="ctl">
            <sw-dropdown tall data-access-audit-station label=${a("auditStation")} .items=${this.stationItems()} .value=${this.station} @change=${c=>this.setStation(c.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-action label=${a("auditAction")} .items=${this.actionItems()} .value=${this.action} @change=${c=>this.setAction(c.detail.id)}></sw-dropdown>
            <sw-dropdown tall data-access-audit-period label=${a("auditPeriod")} .items=${this.periodItems()} .value=${this.period} @change=${c=>this.setPeriod(c.detail.id)}></sw-dropdown>
            ${this.person?r`<button type="button" class="chipbtn" aria-pressed="true" data-access-audit-person-chip aria-label=${a("auditPersonClear")} @click=${()=>this.setPerson(null)}><span>${a("auditPerson",{name:this.person.name})}</span><sw-icon name="close" size=${14}></sw-icon></button>`:d}
            ${n?r`<sw-button size="lg" variant="ghost" data-access-audit-clear @click=${()=>this.clear()}>${a("auditClear")}</sw-button>`:d}
          </div>
        </div>
        ${e.stale&&i?r`<div class="note stale" role="status" data-access-stale="audit"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt?a("stale",{t:S(z(s.fetchedAt,t,l))}):a("staleNever")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void e.reload()}>${a("refresh")}</sw-button></div>`:d}
        ${o}
        ${e.hasMore?r`<div class="more"><sw-button size="lg" data-access-audit-more ?disabled=${s.loadingMore} @click=${()=>void e.more()}>${s.loadingMore?a("loadingMore"):a("more")}</sw-button></div>`:d}
        ${s.moreFailed?r`<div class="note err" role="alert" data-access-audit-more-failed><span>${a("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void e.more()}>${a("retry")}</sw-button></div>`:d}
        ${i?r`<div class="foot-note" data-access-audit-foot>${[i.total!==null?a("auditTotal",{n:i.total}):"",i.retention_days?a("auditRetention",{n:i.retention_days}):""].filter(Boolean).join(" · ")}</div>`:d}
      </sw-card>
    </div>`}};q.styles=[H,N`
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
      }
    `,Z,W];Q([T({type:Number})],q.prototype,"rev",2);Q([h()],q.prototype,"station",2);Q([h()],q.prototype,"action",2);Q([h()],q.prototype,"period",2);Q([h()],q.prototype,"person",2);q=Q([j("system-access-audit")],q);var St=Object.defineProperty,Rt=Object.getOwnPropertyDescriptor,$e=(e,s,t,i)=>{for(var n=i>1?void 0:i?Rt(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&St(s,t,n),n};let se=class extends E{constructor(){super(...arguments),this.rev=0,this.wide=!0,this.lastRev=0,this.lastMeta="",this.nameOf=e=>this.stationsRes.snap.data?.find(s=>s.id===e)?.name??e}connectedCallback(){super.connectedCallback();const e=()=>{this.requestUpdate(),this.emitMeta()};this.wide=!C()||G("access.admin.read"),this.stationsRes=new y({fetch:()=>he(),pick:s=>s.stations,onChange:e}),this.groupsRes=new y({fetch:()=>ys(),pick:s=>s.groups,onChange:e}),this.versionsRes=new y({fetch:s=>ks(typeof s=="number"?s:0),pick:s=>s.versions,merge:Qs,cursorOf:s=>s.next_offset,onChange:e}),this.reloadAll()}disconnectedCallback(){for(const e of[this.groupsRes,this.versionsRes,this.stationsRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.stationsRes.reload(),(!C()||de().people)&&this.groupsRes.reload(),this.wide&&this.versionsRes.reload()}emitMeta(){const e=this.groupsRes?.snap.reply?.sync??this.versionsRes?.snap.reply?.sync??this.stationsRes?.snap.reply?.sync??null,s=JSON.stringify(e);s!==this.lastMeta&&(this.lastMeta=s,this.dispatchEvent(new CustomEvent("access-meta",{detail:{meta:e,zone:this.zone()},bubbles:!0,composed:!0})))}zone(){return this.stationsRes?.snap.reply?.default_zone??te}ruleText(e){const s=Xs(e,(this.stationsRes.snap.data??[]).map(t=>t.id));switch(s.kind){case"all":return a("ruleAll");case"none":return a("ruleNone");case"unknown":return a("ruleUnknown");case"stations":return s.ids.map(t=>this.nameOf(t)).join(", ")}}groupsCard(){if(C()&&!de().people)return d;const e=this.groupsRes,s=e.snap;if(s.failure==="forbidden")return d;const t=s.data;let i;return!s.everAnswered||s.busy&&!t?i=R(4):t?t.groups.length?i=r`<div class="list" data-access-groups>
        ${t.groups.map(n=>r`<div class="row" data-access-group=${n.id}>
            <span class="dot ${n.enabled?"ok":"off"}" aria-hidden="true"></span>
            <span class="main"><span class="t">${n.label}</span><span class="s wrap">${this.ruleText(n)}</span></span>
            ${n.enabled?d:r`<span class="side"><sw-badge kind="offline" label=${a("groupOff")}></sw-badge></span>`}
          </div>`)}
      </div>`:i=r`<div class="empty">${a("groupsEmpty")}</div>`:i=k(s.failure??"error",s.message,()=>void e.reload(),!0),r`<sw-card flush data-access-card="groups">
      <div class="ch">
        <div><h3>${a("groupsTitle")}</h3><div class="sub">${a("groupsSub")}</div></div>
        ${t?r`<div class="ctl rev" data-access-revision><span class="muted">${a("revisionNow",{n:t.revision??"—"})}</span>${t.photo_enabled===null?d:r`<span class="muted">${t.photo_enabled?a("photoOn"):a("photoOff")}</span>`}<wk-profiles-link variant="ghost"></wk-profiles-link></div>`:d}
      </div>
      ${e.stale&&t?r`<div class="note stale" role="status" data-access-stale="groups"><sw-icon name="offline" size=${16}></sw-icon><span>${s.fetchedAt?a("stale",{t:S(z(s.fetchedAt,new Date,this.zone()))}):a("staleNever")}</span></div>`:d}
      ${i}
    </sw-card>`}fieldsCard(){const e=this.groupsRes.snap.data;if(!e||e.fields===null)return d;const s=i=>i,t=[{key:"label",label:a("colField"),render:i=>r`<span style=${w.strong}>${s(i).label}</span>`},{key:"type",label:a("colType"),render:i=>a(et(s(i).type))},{key:"flags",label:a("colFlags"),render:i=>{const n=s(i),o=st(n),l=n.depends_on?(e.fields??[]).find(c=>c.id===n.depends_on?.field_id)?.label??n.depends_on.field_id:"";return r`<span style=${w.row}>${[n.required?a("flagRequired"):a("flagOptional"),o.includes("unique")?a("flagUnique"):"",o.includes("depends")?a("flagDepends",{field:l}):""].filter(Boolean).join(" · ")}${o.includes("disabled")?r`<sw-badge kind="offline" label=${a("flagDisabled")}></sw-badge>`:d}</span>`}},{key:"options",label:a("colOptions"),render:i=>{const n=tt(s(i).options??[]);return n.shown.length?r`<span>${n.shown.join(", ")}${n.more?r` <span style=${w.muted}>${a("optionsMore",{n:n.more})}</span>`:d}</span>`:r`<span style=${w.muted}>—</span>`}}];return r`<sw-card flush data-access-card="fields">
      <div class="ch"><div><h3>${a("fieldsTitle")}</h3><div class="sub">${a("fieldsCount",{n:e.fields.length})}</div></div></div>
      ${e.fields.length?r`<sw-table data-access-fields .columns=${t} .rows=${e.fields} rowKey="id"></sw-table>`:r`<div class="empty">${a("fieldsEmpty")}</div>`}
    </sw-card>`}versionsCard(e){if(!this.wide)return d;const s=this.versionsRes,t=s.snap;if(t.failure==="forbidden")return d;const i=t.data,n=this.zone(),o=u=>u,l=[{key:"revision",label:a("colRevision"),render:u=>r`<span style=${w.row}><span style=${w.strong}>${o(u).revision}</span>${i&&o(u).revision===i.current_revision?r`<sw-badge kind="live" label=${a("versionCurrent")}></sw-badge>`:d}</span>`},{key:"saved",label:a("colSaved"),render:u=>o(u).saved_at?Ze(Ye(o(u).saved_at,e,n)):"—"},{key:"action",label:a("colChange"),render:u=>at(o(u).action)},{key:"fields",label:a("colFieldChanges"),render:u=>o(u).field_changes?String(o(u).field_changes):"—"},{key:"groups",label:a("colGroupChanges"),render:u=>o(u).group_changes?String(o(u).group_changes):"—"}];let c;return!t.everAnswered||t.busy&&!i?c=R(3):i?i.records.length?c=r`<sw-table data-access-versions .columns=${l} .rows=${i.records} rowKey="revision"></sw-table>`:c=r`<div class="empty">${a("versionsEmpty")}</div>`:c=k(t.failure??"error",t.message,()=>void s.reload(),!0),r`<sw-card flush data-access-card="versions">
      <div class="ch"><div><h3>${a("versionsTitle")}</h3><div class="sub">${a("versionsSub")}</div></div></div>
      ${s.stale&&i?r`<div class="note stale" role="status" data-access-stale="versions"><sw-icon name="offline" size=${16}></sw-icon><span>${t.fetchedAt?a("stale",{t:S(z(t.fetchedAt,e,n))}):a("staleNever")}</span></div>`:d}
      ${c}
      ${s.hasMore?r`<div class="more"><sw-button size="lg" data-access-versions-more ?disabled=${t.loadingMore} @click=${()=>void s.more()}>${t.loadingMore?a("loadingMore"):`${a("more")} (${nt(i)})`}</sw-button></div>`:d}
      ${t.moreFailed?r`<div class="note err" role="alert" data-access-versions-more-failed><span>${a("moreFailed")}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void s.more()}>${a("retry")}</sw-button></div>`:d}
      ${i?.retained_from_revision?r`<div class="foot-note" data-access-versions-retained>${a("versionsRetained",{n:i.retained_from_revision})}</div>`:d}
    </sw-card>`}render(){const e=new Date,s=this.groupsRes.snap;if((!C()||de().people)&&s.everAnswered&&!s.data&&s.failure&&s.failure!=="forbidden"&&["not_configured","connecting","not_installed","unsupported"].includes(s.failure))return r`<div class="stack" data-access-status=${s.failure}>${k(s.failure,s.message,()=>this.reloadAll())}</div>`;const i=this.groupsCard(),n=this.fieldsCard();return r`<div class="stack" data-access-status="ready">
      ${i!==d&&n!==d?r`<div class="grid2">${i}${n}</div>`:r`${i}${n}`}
      ${this.versionsCard(e)}
    </div>`}};se.styles=[H,N`
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
    `,Z,W];$e([T({type:Number})],se.prototype,"rev",2);$e([h()],se.prototype,"wide",2);se=$e([j("system-access-groups")],se);var Ct=Object.defineProperty,zt=Object.getOwnPropertyDescriptor,D=(e,s,t,i)=>{for(var n=i>1?void 0:i?zt(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&Ct(s,t,n),n};const Me={"access.event_portrait_audit":{title:"pol_event_portrait_audit",text:"pol_event_portrait_audit_text"},"access.event_portrait_sensitive":{title:"pol_event_portrait_sensitive",text:"pol_event_portrait_sensitive_text"},"access.employee_no_sensitive":{title:"pol_employee_no_sensitive",text:"pol_employee_no_sensitive_text"},"access.sync_errors_everyone":{title:"pol_sync_errors_everyone",text:"pol_sync_errors_everyone_text"}};let P=class extends E{constructor(){super(...arguments),this.rev=0,this.values=null,this.canEdit=!1,this.busy="",this.error="",this.failed="",this.loading=!0,this.lastRev=0,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.load())}async load(){const e=++this.gen;this.failed="";try{const s=await pe("settings");if(e!==this.gen)return;this.values=this.read(s.settings),this.canEdit=!!s.can_edit&&(!C()||G("system.configure"))}catch(s){if(e!==this.gen)return;this.failed=U(s)}finally{e===this.gen&&(this.loading=!1)}}read(e){return Object.fromEntries(Ee.map(s=>[s,it(e,s)]))}async flip(e){if(!this.values||!this.canEdit||this.busy)return;const s=!this.values[e];this.busy=e,this.error="";try{const t=await ls("settings",{[e]:String(s)});this.values=this.read(t.settings)}catch(t){this.error=`${a("policySaveFailed")} · ${U(t)}`}finally{this.busy=""}}render(){if(this.loading)return r`<div class="stack" data-access-status="loading"><sw-card flush>${R(4)}</sw-card></div>`;if(!this.values)return r`<div class="stack" data-access-status="error">${k("error",this.failed,()=>void this.load())}</div>`;const e=this.values;return r`<div class="stack" data-access-status="ready">
      <sw-card flush data-access-card="policy">
        <div class="ch"><div><h3>${a("policyTitle")}</h3><div class="sub">${this.canEdit?a("policySub"):a("policyNote")}</div></div></div>
        ${Ee.map(s=>r`<button type="button" class="sw" role="switch" aria-checked=${String(e[s])} data-access-policy=${s} data-default=${String(rt[s])} ?disabled=${!this.canEdit||!!this.busy} @click=${()=>void this.flip(s)}>
            ${ee(a(Me[s].title),a(Me[s].text))}
          </button>`)}
        ${this.error?r`<div class="note err" role="alert" data-access-policy-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:d}
      </sw-card>
    </div>`}};P.styles=[H,Qe,Z,W];D([T({type:Number})],P.prototype,"rev",2);D([h()],P.prototype,"values",2);D([h()],P.prototype,"canEdit",2);D([h()],P.prototype,"busy",2);D([h()],P.prototype,"error",2);D([h()],P.prototype,"failed",2);D([h()],P.prototype,"loading",2);P=D([j("system-access-policy")],P);const fe="access-control/messaging/installed",At={view:()=>pe(fe),save:e=>cs(fe,e),sync:()=>ds(`${fe}/registry-sync`,{})};function Tt(){return{settings:{send_pacing_v1:!1},gates:{messaging_enabled:!0,template_switch:!0,permit:!1},commands:{"whatsapp/template_registry_v1":!0,"whatsapp/template_enqueue_v1":!0,"whatsapp/template_job_v1":!0,"whatsapp/template_cancel_v1":!0,"whatsapp/template_send_v3":!0,"whatsapp/send_pacing_v1":!1},registry:{templates:[{id:"access",name:"access_notice",language:"he",purpose:"notice",source:"arx",account:null,template_revision:3,bound:!0},{id:"native_0a1b2c3d4e5f6a7b8c9d0e1f",name:"door_code",language:"he",purpose:"notice",source:"wiskey",account:"office",template_revision:2,bound:!0}],wiskey_rows:1,arx_rows:1,native_accounts:1,native_sendable:!1,last_sync:{outcome:"synced",code:null,native:1,at:"2026-11-04T08:00:00+00:00"}},jobs:[{operation_id:"tplq-demo00000001",template_id:"access",person_id:"p1",state:"completed",outcome:"accepted",code:"provider_accepted",created_at:"2026-11-04T08:10:00+00:00",updated_at:"2026-11-04T08:10:20+00:00"},{operation_id:"tplq-demo00000002",template_id:"access",person_id:"p2",state:"cancelled",outcome:"not_sent",code:"cancelled_before_dispatch",created_at:"2026-11-04T08:05:00+00:00",updated_at:"2026-11-04T08:05:30+00:00"}],queue_ttl_s:120,delivery_receipts:!1,excluded:["whatsapp/history","whatsapp/media","whatsapp/templates_get","whatsapp/templates_update"]}}let F=Tt();const ie=e=>JSON.parse(JSON.stringify(e)),Ot={view:async()=>ie(F),save:async e=>(F.settings.send_pacing_v1=e.send_pacing_v1===!0,ie(F)),sync:async()=>(F.registry.last_sync={outcome:"synced",code:null,native:F.registry.wiskey_rows,at:new Date().toISOString()},{...ie(F),sync:ie(F.registry.last_sync)})};function ve(){return C()?At:Ot}const ye={title:"תבניות ותור שליחה",sub:"רשימת התבניות של שירות ההודעות, תור השליחה ומצב כל הודעה. היסטוריית השיחות נשארת בשירות ההודעות.",loadError:"לא ניתן לטעון את מצב התבניות",retry:"נסו שוב",blocked:"שליחת תבנית אינה זמינה כרגע",blk_messaging_off:"שליחת הודעות כבויה",blk_template_switch_off:"שליחת תבניות כבויה",blk_permit_closed:"טרם אושרה שליחה מול עמדה אמיתית",blk_queue_unavailable:"החיבור הישיר לשירות ההודעות אינו זמין",ready:"שליחת תבנית זמינה",commands:"מה שירות ההודעות מאפשר עכשיו",cmd_registry:"רשימת תבניות",cmd_queue:"תור שליחה",cmd_job:"מצב משימה",cmd_cancel:"ביטול משימה",cmd_now:"שליחה מיידית",cmd_paced:"שליחה בקצב של השירות",on:"זמין",off:"לא זמין",registry:"תבניות",fromWiskey:"מהשירות: {n}",fromArx:"שהוגדרו כאן: {n}",nativeLocked:"תבניות השירות נשלחות רק כשההתקנה האוטומטית פעילה",sync:"רענון מהשירות",syncing:"מרענן...",lastSync:"רענון אחרון: {time}",neverSynced:"עוד לא רועננה",sync_synced:"הרשימה רועננה",sync_not_sent:"לא נשלחה בקשה",sync_refused:"השירות סירב",sync_invalid:"התשובה לא תקינה - הרשימה נשמרה",sync_unknown:"לא התקבלה תשובה",noTemplates:"אין תבניות",src_wiskey:"מהשירות",src_arx:"כאן",unbound:"לא מקושרת",jobs:"משימות אחרונות",noJobs:"אין משימות בתור",job_pending:"ממתינה בתור",job_sent:"התקבלה אצל ספק ההודעות",job_cancelled:"בוטלה - לא נשלחה",job_paced:"עוכבה בקצב של השירות - לא נשלחה",job_expired:"פג תוקפה בתור - לא נשלחה",job_not_sent:"לא נשלחה",job_unknown:"לא ידוע אם נשלחה",delivery:"השירות אינו מדווח על מסירה - ידוע רק שהספק קיבל את ההודעה",ttl:"הודעה ממתינה בתור עד {n} שניות",paced:"הודעה חופשית בקצב של השירות",pacedOn:'מופעל - כל הודעה שנשלחה תוצג כ"לא ידוע" עד שהשירות ידווח קבלה',pacedOff:"כבוי",pacedUnlisted:"השירות אינו מציע זאת כרגע",saved:"נשמר",history:"היסטוריית השיחות נשארת בשירות ההודעות ואינה נשמרת כאן"},Xe=ue("en","i18n/wa-installed","en"),es=ue("ar","i18n/wa-installed","ar"),ss=ue("ru","i18n/wa-installed","ru"),Pt={he:ye,en:Xe,ar:es,ru:ss},Nt=["ar","ru"];function Et(){return Be(["en","ar","ru"])}function m(e,s,t=Et()){const i=Pt[t][e]??ye[e]??e;return Je(i,s)}We("i18n/wa-installed",{he:ye,en:Xe,ar:es,ru:ss},Nt);function jt(e){return e.outcome==="pending"?"pending":e.outcome==="accepted"?"sent":e.outcome==="not_sent"?e.code==="cancelled_before_dispatch"?"cancelled":e.code==="rate_limited"?"paced":e.code==="queue_expired"?"expired":"not_sent":"unknown"}function Mt(e){return e==="sent"?"ok":e==="unknown"?"warn":e==="pending"?"muted":"bad"}function Lt(e){const s=[];return e.gates.messaging_enabled||s.push("messaging_off"),e.gates.template_switch||s.push("template_switch_off"),e.gates.permit||s.push("permit_closed"),!e.commands["whatsapp/template_enqueue_v1"]&&!e.commands["whatsapp/template_send_v3"]&&s.push("queue_unavailable"),s}function qt(e){return e==="synced"?"ok":e==="unknown"?"warn":e?"bad":"muted"}function Dt(e){return e.settings.send_pacing_v1||e.commands["whatsapp/send_pacing_v1"]}function Ft(e,s=5){return e.slice(0,Math.max(0,s))}var Ut=Object.defineProperty,It=Object.getOwnPropertyDescriptor,ne=(e,s,t,i)=>{for(var n=i>1?void 0:i?It(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&Ut(s,t,n),n};const Kt=[["whatsapp/template_registry_v1","cmd_registry"],["whatsapp/template_enqueue_v1","cmd_queue"],["whatsapp/template_job_v1","cmd_job"],["whatsapp/template_cancel_v1","cmd_cancel"],["whatsapp/template_send_v3","cmd_now"],["whatsapp/send_pacing_v1","cmd_paced"]];let K=class extends E{constructor(){super(...arguments),this.view=null,this.phase="loading",this.error="",this.toaster=new mt(this,{ms:3e3}),this.busy=""}get notice(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback()}async load(){this.phase=this.view?this.phase:"loading";try{this.view=await ve().view(),this.phase="ready",this.error=""}catch(e){this.error=U(e),this.phase="error"}}flash(e){this.toaster.show(e)}async sync(){if(!this.busy){this.busy="sync",this.error="";try{const e=await ve().sync();this.view=e,this.flash(m(`sync_${e.sync?.outcome??"synced"}`))}catch(e){const s=U(e);await this.load(),this.phase==="ready"&&(this.error=s)}finally{this.busy=""}}}async setPaced(e){if(!(this.busy||!this.view)){this.busy="save",this.error="";try{this.view=await ve().save({send_pacing_v1:e}),this.flash(m("saved"))}catch(s){this.error=U(s)}finally{this.busy=""}}}template(e){return r`<div class="row" data-wa-template=${e.id} data-source=${e.source}>
      <span class="dot ${e.bound?"ok":"muted"}" aria-hidden="true"></span>
      <span class="main"><span class="t">${us(e.name)}</span>
        <span class="s">${e.language} · ${m(e.source==="wiskey"?"src_wiskey":"src_arx")}${e.account?r` · <span class="ltr">${Se(e.account)}</span>`:d}${e.bound?d:r` · ${m("unbound")}`}</span></span>
    </div>`}job(e){const s=jt(e),t=Mt(s);return r`<div class="row" data-wa-job=${e.operation_id} data-word=${s}>
      <span class="dot ${t==="bad"?"err":t}" aria-hidden="true"></span>
      <span class="main"><span class="t">${m(`job_${s}`)}</span>
        <span class="s"><span class="ltr">${Se(e.template_id??"–")}</span> · ${Re(new Date(e.updated_at))}</span></span>
    </div>`}render(){if(this.phase==="loading")return r`<sw-card flush data-wa-installed data-state="loading">${R(3)}</sw-card>`;if(this.phase==="error"||!this.view)return r`<sw-card flush data-wa-installed data-state="error"><div class="ch"><div><h3>${m("title")}</h3></div></div>
        <div class="sec"><div class="note err" role="alert" data-wa-error><sw-icon name="warning" size="16"></sw-icon><span>${m("loadError")}: ${this.error}</span>
          <sw-button size="sm" data-wa-retry @click=${()=>void this.load()}>${m("retry")}</sw-button></div></div></sw-card>`;const e=this.view,s=Lt(e),t=e.registry.last_sync,i=Ft(e.jobs),n=Dt(e);return r`<sw-card flush data-wa-installed data-state="ready">
      <div class="ch">
        <div><h3>${m("title")}</h3><div class="sub">${m("sub")}</div></div>
        <div class="ctl"><sw-button size="sm" icon="refresh" data-wa-sync ?disabled=${!!this.busy||!e.commands["whatsapp/template_registry_v1"]}
          @click=${()=>void this.sync()}>${this.busy==="sync"?m("syncing"):m("sync")}</sw-button></div>
      </div>
      ${this.error?r`<div class="sec"><div class="note err" role="alert" data-wa-error><sw-icon name="warning" size="16"></sw-icon><span>${this.error}</span></div></div>`:d}
      ${this.notice?r`<div class="sec"><div class="note info" role="status" data-wa-notice><sw-icon name="check" size="16"></sw-icon><span>${this.notice}</span></div></div>`:d}
      <div class="sec" data-wa-blockers=${s.join(" ")}>
        ${s.length?r`<h4>${m("blocked")}</h4><div class="chips">${s.map(o=>r`<span class="chip bad" data-wa-blocker=${o}>${m(`blk_${o}`)}</span>`)}</div>`:r`<div class="chips"><span class="chip ok" data-wa-ready>${m("ready")}</span></div>`}
      </div>
      <div class="sec">
        <h4>${m("commands")}</h4>
        <div class="cmds">${Kt.map(([o,l])=>r`<div class="cmd" data-wa-command=${o} data-on=${String(e.commands[o])}>
          <span class="dot ${e.commands[o]?"ok":"muted"}" aria-hidden="true"></span><span>${m(l)} · ${m(e.commands[o]?"on":"off")}</span></div>`)}</div>
      </div>
      <div class="sec" data-wa-registry>
        <div class="line"><h4 class="grow">${m("registry")}</h4>
          <span class="chip" data-wa-count="wiskey">${m("fromWiskey",{n:e.registry.wiskey_rows})}</span>
          <span class="chip" data-wa-count="arx">${m("fromArx",{n:e.registry.arx_rows})}</span></div>
        <div class="line"><span class="chip ${qt(t?.outcome)}" data-wa-last-sync=${t?.outcome??"never"}>${m(t?`sync_${t.outcome}`:"neverSynced")}</span>
          ${t?.at?r`<span class="meta">${m("lastSync",{time:Re(new Date(t.at))})}</span>`:d}</div>
        ${e.registry.wiskey_rows&&!e.registry.native_sendable?r`<div class="hint" data-wa-native-locked>${m("nativeLocked")}</div>`:d}
      </div>
      <div data-wa-templates>${e.registry.templates.length?Ce(e.registry.templates,o=>o.id,o=>this.template(o)):r`<div class="empty">${m("noTemplates")}</div>`}</div>
      <div class="sec" data-wa-jobs-head><h4>${m("jobs")}</h4><div class="hint">${m("ttl",{n:e.queue_ttl_s})}</div>
        ${e.delivery_receipts?d:r`<div class="hint" data-wa-no-delivery>${m("delivery")}</div>`}</div>
      <div data-wa-jobs>${i.length?Ce(i,o=>o.operation_id,o=>this.job(o)):r`<div class="empty">${m("noJobs")}</div>`}</div>
      <div class="sec">
        <div class="toggle" data-wa-paced>
          <span class="txt"><span class="t">${m("paced")}</span>
            <span class="x">${e.settings.send_pacing_v1?m("pacedOn"):m(n?"pacedOff":"pacedUnlisted")}</span></span>
          <sw-toggle controlled label=${m("paced")} labelHidden data-wa-paced-toggle .checked=${e.settings.send_pacing_v1} ?disabled=${!!this.busy||!n}
            @change=${o=>void this.setPaced(o.detail.checked)}></sw-toggle>
        </div>
        <div class="hint" data-wa-history>${m("history")}</div>
      </div>
    </sw-card>`}};K.styles=[H,N`
      ${ps}
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
      ${be}
      .hint { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .toggle { display: flex; align-items: center; gap: 12px; min-inline-size: 0; }
      .toggle .txt { flex: 1; min-inline-size: 0; display: flex; flex-direction: column; gap: 2px; }
      .toggle .t { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .toggle .x { color: var(--sw-text-3); font-size: var(--sw-fs-sm); overflow-wrap: anywhere; }
    `];ne([h()],K.prototype,"view",2);ne([h()],K.prototype,"phase",2);ne([h()],K.prototype,"error",2);ne([h()],K.prototype,"busy",2);K=ne([j("wa-installed-card")],K);const ts={templates_max:20,label_max:40,body_max:600,text_max:1e3,organization_max:60,bulk_max:[1,200],rate_per_hour:[1,1e3],per_sender_per_hour:[1,1e3],per_person_per_day:[1,50],per_station_per_hour:[1,1e3],placeholders:["name","organization"],placeholders_max:6},Ht=128,Wt=1500,Jt=/\p{Cc}|\p{Zl}|\p{Zp}/u,ke=(e,s)=>[...e].some(t=>s&&t===`
`?!1:Jt.test(t));function Bt(e){return e.replace(/\r\n?/g,`
`).split(`
`).map(s=>s.replace(/\s+$/u,"")).join(`
`).trim()}function Vt(e,s,t,i){const n=e.trim();if(!n)return[{path:s,code:"empty"}];if(n.length>i.label_max)return[{path:s,code:"too_long"}];if(ke(n,!1))return[{path:s,code:"control_chars"}];const o=n.toLocaleLowerCase();return t.has(o)?[{path:s,code:"duplicate_label"}]:(t.add(o),[])}function Gt(e,s,t,i){const n=Bt(e);if(!n)return[{path:s,code:"empty"}];if(n.length>i.body_max)return[{path:s,code:"too_long"}];if(ke(n,!0))return[{path:s,code:"control_chars"}];if(dt(n))return[{path:s,code:"credential"}];const o=[...n.matchAll(/\{([^{}]*)\}/g)].map(g=>g[1]),l=n.replace(/\{[^{}]*\}/g,"");if(l.includes("{")||l.includes("}"))return[{path:s,code:"bad_braces"}];if(o.some(g=>!i.placeholders.includes(g)))return[{path:s,code:"unknown_placeholder"}];if(ge(n))return[{path:s,code:"credential"}];if(o.length>i.placeholders_max)return[{path:s,code:"too_many_placeholders"}];if(o.includes("organization")&&!t.trim())return[{path:s,code:"organization_missing"}];if(ge(n.replace(/\{(name|organization)\}/g,(g,me)=>me==="name"?"xxxxxxxx":t.trim())))return[{path:s,code:"credential"}];const c=o.filter(g=>g==="name").length,u=o.filter(g=>g==="organization").length;return n.replace(/\{(?:name|organization)\}/g,"").length+c*Ht+u*i.organization_max>Wt?[{path:s,code:"too_long"}]:[]}const Le=/^([01]\d|2[0-3]):[0-5]\d$/;function Zt(e){return e==null?null:!Le.test(e.from)||!Le.test(e.to)?"window_invalid":e.from===e.to?"window_empty":e.from>e.to?"window_across_midnight":null}const qe={per_sender_per_hour:[1,1e3],per_person_per_day:[1,50],per_station_per_hour:[1,1e3]};function Yt(e,s=ts){const t=[],i=c=>typeof c=="number"&&Number.isInteger(c);i(e.bulk_max)?(e.bulk_max<s.bulk_max[0]||e.bulk_max>s.bulk_max[1])&&t.push({path:"bulk_max",code:"range"}):t.push({path:"bulk_max",code:"type"}),i(e.rate_per_hour)?(e.rate_per_hour<s.rate_per_hour[0]||e.rate_per_hour>s.rate_per_hour[1])&&t.push({path:"rate_per_hour",code:"range"}):t.push({path:"rate_per_hour",code:"type"});for(const c of Object.keys(qe)){if(!(c in e))continue;const u=e[c],[g,me]=s[c]??qe[c];i(u)?(u<g||u>me)&&t.push({path:c,code:"range"}):t.push({path:c,code:"type"})}const n=Zt(e.send_hours);n&&t.push({path:"send_hours",code:n});const o=e.organization.trim();o.length>s.organization_max?t.push({path:"organization",code:"too_long"}):ke(o,!1)?t.push({path:"organization",code:"control_chars"}):o.includes("{")||o.includes("}")?t.push({path:"organization",code:"bad_braces"}):ge(o)&&t.push({path:"organization",code:"credential"}),e.templates.length>s.templates_max&&t.push({path:"templates",code:"too_many"});const l=new Set;return e.templates.forEach((c,u)=>{t.push(...Vt(c.label,`templates.${u}.label`,l,s)),t.push(...Gt(c.body,`templates.${u}.body`,o,s))}),t}const Qt=(e,s)=>e.filter(t=>t.path===s);function Xt(e,s,t,i){const n=t??e.length,o=i??n;return{text:e.slice(0,n)+s+e.slice(o),caret:n+s.length}}const xe={segment:"הודעות",segments_label:"הודעות",title:"הודעות לאנשים",sub:"שליחת הודעות וואטסאפ מרשימת האנשים: תבניות מאושרות והודעה חופשית. השליחה נרשמת ביומן המערכת, בלי תוכן ההודעה.",loading:"טוען את ההגדרות…",load_failed:"לא ניתן לטעון את ההגדרות",retry:"נסה שוב","service.connected":"שירות ההודעות מחובר","service.account":"חשבון: {name}","service.not_connected":"שירות ההודעות אינו מחובר","service.unknown":"מצב שירות ההודעות לא ידוע","service.unsupported":"שירות ההודעות אינו זמין בהתקנה הזו","service.account_required":"יש כמה חשבונות · בחרו מאיזה חשבון נשלחות ההודעות","service.account_missing":"החשבון שנבחר אינו קיים יותר · בחרו חשבון","service.account_not_covered":"החשבון שנבחר לא נכלל ברשימה שהתקבלה כרגע משירות ההודעות (הרשימה מוגבלת) · נסו שוב או בחרו חשבון אחר","service.no_account":"אין חשבון הודעות מחובר","enabled.title":"שליחת הודעות","enabled.on":"מופעל · במסך האנשים יש כפתור שליחה לבעלי ההרשאה","enabled.off":"כבוי · במסך האנשים אין כפתור שליחה","free.title":"הודעה חופשית","free.on":"השולח יכול לכתוב הודעה בעצמו","free.off":"אפשר לשלוח תבניות מאושרות בלבד","bulk.title":"נמענים מרבי בשליחה אחת","bulk.hint":"בין {min} ל־{max}","rate.title":"מכסת הודעות לשעה","rate.hint":"לכל המערכת · בין {min} ל־{max}","optout.note":'בקשת "לא לקבל הודעות" חלה על הודעות שנשלחות מכאן בלבד; רק מנהל מערכת יכול לבטל אותה.',"sender.title":"הודעות לשעה לכל שולח","sender.hint":"כולל הודעות שנדחו · בין {min} ל־{max}","person.title":"הודעות ביום לכל נמען","person.hint":"לפי האדם ולפי מספר הטלפון · בין {min} ל־{max}","station.title":"הודעות לשעה לאנשי עמדה","station.hint":"לכל עמדה בנפרד · בין {min} ל־{max}","hours.title":"שעות שליחה","hours.on":"הודעות נשלחות רק בין השעות שנבחרו (שעון ההתקנה)","hours.off":"ללא הגבלת שעות","hours.from":"משעה","hours.to":"עד שעה","org.title":"שם הארגון בהודעות","org.hint":"מחליף את {organization} בתבניות","account.title":"חשבון השליחה","account.only":"החשבון היחיד","account.choose":"בחרו חשבון","templates.title":"תבניות מאושרות","templates.sub":"{name} מוחלף בשם האדם ו־{organization} בשם הארגון. אי אפשר לכתוב בתבנית קוד גישה או פרטי כניסה.","templates.empty":"אין תבניות · השולחים יוכלו לכתוב הודעה חופשית בלבד","template.label":"שם התבנית","template.body":"נוסח ההודעה","template.counter":"{n}/{max}","template.add":"הוספת תבנית","template.remove":"מחיקת התבנית","template.insert_name":"הוספת שם האדם","template.insert_org":"הוספת שם הארגון","template.new":"תבנית חדשה","consent.title":"אישור קבלת הודעות בקישור","consent.sub":"כשהאפשרות מופעלת, ההודעה הראשונה לאדם שלא ידוע אם הסכים היא בקשת אישור עם קישור. ההודעה המבוקשת נשלחת רק אחרי שהאדם אישר.","consent.switch":"בקשת אישור לפני ההודעה הראשונה","consent.on":"מופעל · אדם שלא אישר מקבל קודם בקשת אישור","consent.off":"כבוי · אפשר לשלוח גם למי שלא ידוע אם הסכים","consent.wait":"ימים להמתנה לתשובה","consent.wait_hint":"בין {min} ל־{max} · בלי תשובה ההודעה לא נשלחת והשולח מקבל התראה","consent.language":"שפת בקשת האישור","consent.lang.he":"עברית","consent.lang.en":"אנגלית","consent.lang.ar":"ערבית (טיוטה)","consent.lang.ru":"רוסית (טיוטה)","consent.wa_template":"שם התבנית המאושרת בוואטסאפ","consent.wa_template_hint":"לפנייה ראשונה. אישור התבנית מול וואטסאפ נעשה על ידי בעל החשבון","consent.wa_language":"קוד השפה של התבנית","consent.rules":"בקשת אישור אחת לאדם בכל {days} יום · עד {held} הודעות ממתינות לאדם","consent.problem.module_off":"הדף הציבורי כבוי · אי אפשר לשלוח בקשת אישור","consent.problem.public_page":"הדף הציבורי אינו זמין או שאין לו כתובת · אי אפשר לשלוח בקשת אישור","consent.problem.key":"מפתח הקישורים חסר · אי אפשר לשלוח בקשת אישור","err.bad_name":"אותיות לטיניות קטנות, ספרות וקו תחתון בלבד","err.bad_language":"קוד שפה לא תקין (למשל he או en_US)","err.template_send_unsupported":"שליחת תבנית וואטסאפ מאושרת עדיין אינה נתמכת - השאירו ריק","consent.no_template":"בקשת האישור נשלחת כהודעת טקסט רגילה. שליחה בתבנית וואטסאפ מאושרת עדיין אינה נתמכת, ולכן אדם שלא כתב לחשבון ב־24 השעות האחרונות עלול לא לקבל אותה",save:"שמירה",saving:"שומר…",revert:"ביטול שינויים",saved:"נשמר",unsaved:"יש שינויים שלא נשמרו",invalid:"יש לתקן את השדות המסומנים",save_failed:"השמירה נכשלה",conflict:"ההגדרות נשמרו בינתיים על ידי מישהו אחר",reload:"טעינה מחדש","err.empty":"חובה למלא","err.too_long":"ארוך מדי","err.control_chars":"יש תווים שאי אפשר להשתמש בהם","err.credential":"אי אפשר לכלול קוד גישה או פרטי כניסה","err.unknown_placeholder":"בין סוגריים מסולסלים מותר {name} ו־{organization} בלבד","err.bad_braces":"סוגריים מסולסלים לא תקינים","err.too_many_placeholders":"יותר מדי מילים להחלפה בתבנית אחת","err.organization_missing":"התבנית משתמשת בשם הארגון והוא לא הוגדר","err.duplicate_label":"יש כבר תבנית בשם הזה","err.range":"מחוץ לטווח המותר","err.type":"יש להזין מספר שלם","err.too_many":"יותר מדי תבניות","err.window_invalid":"יש להזין שעה בתבנית 08:00","err.window_across_midnight":"שעת ההתחלה חייבת להיות לפני שעת הסיום","err.window_empty":"שעת ההתחלה ושעת הסיום זהות","err.other":"ערך לא תקין"},as=ue("en","i18n/access-messaging","en");function ea(){return Be(["en"])}function p(e,s){const t=(ea()==="en"?as[e]:void 0)??xe[e]??e;return Je(t,s)}const sa=new Set(Object.keys(xe).filter(e=>e.startsWith("err.")).map(e=>e.slice(4)));function ta(e){return p(sa.has(e)?`err.${e}`:"err.other")}We("i18n/access-messaging",{he:xe,en:as});var aa=Object.defineProperty,na=Object.getOwnPropertyDescriptor,x=(e,s,t,i)=>{for(var n=i>1?void 0:i?na(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&aa(s,t,n),n};const ia=["he","en","ar","ru"],ra=e=>e==="module_off"?"consent.problem.module_off":e==="key"?"consent.problem.key":"consent.problem.public_page",De={from:"08:00",to:"21:00"},X=e=>/^\d+$/.test(e.trim())?Number(e):Number.NaN;let oa=0;const ns=()=>`r${++oa}`;function _e(e){return r`${e.split(/(\{[a-z]+\})/).map(s=>/^\{[a-z]+\}$/.test(s)?r`<bdi class="ltr">${s}</bdi>`:s)}`}const la=e=>({revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:String(e.bulk_max),rate_per_hour:String(e.rate_per_hour),per_sender_per_hour:String(e.per_sender_per_hour??50),per_person_per_day:String(e.per_person_per_day??3),per_station_per_hour:String(e.per_station_per_hour??50),hours_on:e.send_hours!==null,hours_from:(e.send_hours??De).from,hours_to:(e.send_hours??De).to,organization:e.organization,account:e.account,templates:e.templates.map(s=>({key:ns(),id:s.id,label:s.label,body:s.body})),consent_by_link:e.consent_by_link===!0,consent_wait_days:String(e.consent_wait_days??7),consent_language:e.consent_language??"he",consent_wa_template:e.consent_wa_template??"",consent_wa_language:e.consent_wa_language??""}),Fe=e=>({revision:e.revision,enabled:e.enabled,free_text:e.free_text,bulk_max:X(e.bulk_max),rate_per_hour:X(e.rate_per_hour),per_sender_per_hour:X(e.per_sender_per_hour),per_person_per_day:X(e.per_person_per_day),per_station_per_hour:X(e.per_station_per_hour),send_hours:e.hours_on?{from:e.hours_from.trim(),to:e.hours_to.trim()}:null,organization:e.organization,account:e.account,templates:e.templates.map(s=>({...s.id?{id:s.id}:{},label:s.label,body:s.body})),consent_by_link:e.consent_by_link,consent_wait_days:/^\d+$/.test(e.consent_wait_days.trim())?Number(e.consent_wait_days):Number.NaN,consent_language:e.consent_language,consent_wa_template:e.consent_wa_template.trim(),consent_wa_language:e.consent_wa_language.trim()}),Ue=e=>JSON.stringify([e.enabled,e.free_text,e.bulk_max.trim(),e.rate_per_hour.trim(),e.per_sender_per_hour.trim(),e.per_person_per_day.trim(),e.per_station_per_hour.trim(),e.hours_on,e.hours_from.trim(),e.hours_to.trim(),e.organization.trim(),e.account,e.templates.map(s=>[s.id??"",s.label.trim(),s.body.trim()]),e.consent_by_link,e.consent_wait_days.trim(),e.consent_language,e.consent_wa_template.trim(),e.consent_wa_language.trim()]);let b=class extends E{constructor(){super(...arguments),this.rev=0,this.reply=null,this.draft=null,this.base="",this.loading=!0,this.failed="",this.saving=!1,this.notice="",this.noticeText="",this.submitted=!1,this.touched=new Set,this.remote=[],this.lastRev=0,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.load())}async load(){const e=++this.gen;this.failed="";try{const s=await ct();if(e!==this.gen)return;this.adopt(s)}catch(s){if(e!==this.gen)return;this.failed=U(s)}finally{e===this.gen&&(this.loading=!1)}}adopt(e){this.reply=e,this.draft=la(e.settings),this.base=Ue(this.draft),this.submitted=!1,this.touched=new Set,this.remote=[],this.notice=""}set(e,s=""){this.draft&&(this.draft={...this.draft,...e},this.notice="",this.remote=[],s&&(this.touched=new Set([...this.touched,s])))}setRow(e,s,t){this.draft&&this.set({templates:this.draft.templates.map((i,n)=>n===e?{...i,...s}:i)},`templates.${e}.${t}`)}addRow(){this.draft&&this.set({templates:[...this.draft.templates,{key:ns(),label:p("template.new"),body:""}]})}removeRow(e){this.draft&&(this.set({templates:this.draft.templates.filter((s,t)=>t!==e)}),this.touched=new Set)}insert(e,s,t){if(!this.draft)return;const i=this.draft.templates[e],n=Xt(i.body,s,t?.selectionStart??null,t?.selectionEnd??null);this.setRow(e,{body:n.text},"body"),this.updateComplete.then(()=>{t?.focus(),t?.setSelectionRange(n.caret,n.caret)})}revert(){this.reply&&this.adopt(this.reply),this.notice=""}get dirty(){return!!this.draft&&Ue(this.draft)!==this.base}problems(){if(!this.draft)return[];const e=Yt(Fe(this.draft),this.reply?.limits??ts);return[...e,...this.remote.filter(s=>!e.some(t=>t.path===s.path))]}async save(){if(!(!this.draft||this.saving)&&(this.submitted=!0,!this.problems().length)){this.saving=!0,this.notice="";try{const e=await pt(Fe(this.draft));this.adopt(e),this.notice="saved"}catch(e){const s=ut(e);s?(this.remote=s,this.notice="failed",this.noticeText=p("invalid")):ht(e)?this.notice="conflict":(this.notice="failed",this.noticeText=`${p("save_failed")} · ${U(e)}`)}finally{this.saving=!1}}}shown(e){return this.submitted||this.touched.has(e)?Qt(this.problems(),e):[]}problemLine(e){const s=this.shown(e);return s.length?r`<div class="problem" role="alert" data-msg-problem=${s[0].code} data-msg-problem-path=${e}><sw-icon name="warning" size=${14}></sw-icon><span>${_e(ta(s[0].code))}</span></div>`:d}capField(e,s,t){const i=this.draft;return r`<div>
      <sw-field label=${p(`${s}.title`)} hint=${p(`${s}.hint`,{min:t[0],max:t[1]})} ?data-bad=${this.shown(e).length>0}>
        <input type="text" inputmode="numeric" .value=${i[e]} data-msg-setting=${e} @input=${n=>this.set({[e]:n.target.value},e)} />
      </sw-field>
      ${this.problemLine(e)}
    </div>`}serviceLine(e){const s=e.service;let t="ok",i;if(s.problem)t="warn",i=p(`service.${s.problem}`);else if(s.connected===!0){const n=s.accounts.length===1?s.accounts[0].name:s.accounts.find(o=>o.id===this.draft?.account)?.name;i=n?`${p("service.connected")} · ${p("service.account",{name:n})}`:p("service.connected")}else s.connected===!1?(t="warn",i=s.state==="unsupported"?p("service.unsupported"):p("service.not_connected")):(t="muted",i=p("service.unknown"));return r`<div class="svc" data-msg-service=${s.connected===!0&&!s.problem?"connected":s.connected===!1?"not_connected":"unknown"}><span class="dot ${t}"></span><span>${i}</span></div>`}renderTemplate(e,s,t){const i=this.shown(`templates.${s}.label`),n=this.shown(`templates.${s}.body`);return r`<div class="tpl" data-msg-template-row=${s} data-msg-template-key=${e.id??"new"}>
      <div class="tpl-head">
        <sw-field label=${p("template.label")} ?data-bad=${i.length>0}>
          <input type="text" maxlength=${t.label_max*2} .value=${e.label} data-msg-template-label @input=${o=>this.setRow(s,{label:o.target.value},"label")} />
        </sw-field>
        <sw-button variant="ghost" iconOnly icon="trash" label=${p("template.remove")} data-msg-template-remove @click=${()=>this.removeRow(s)}></sw-button>
      </div>
      ${this.problemLine(`templates.${s}.label`)}
      <sw-field label=${p("template.body")} ?data-bad=${n.length>0}>
        <textarea rows="4" .value=${e.body} data-msg-template-body @input=${o=>this.setRow(s,{body:o.target.value},"body")}></textarea>
      </sw-field>
      ${this.problemLine(`templates.${s}.body`)}
      <div class="tpl-foot">
        <div class="chips">
          <button type="button" class="chipbtn" data-msg-insert="name" @click=${o=>this.insert(s,"{name}",this.textareaOf(o))}>${p("template.insert_name")}</button>
          <button type="button" class="chipbtn" data-msg-insert="organization" @click=${o=>this.insert(s,"{organization}",this.textareaOf(o))}>${p("template.insert_org")}</button>
        </div>
        <span class="cnt" aria-hidden="true">${p("template.counter",{n:e.body.length,max:t.body_max})}</span>
      </div>
    </div>`}textareaOf(e){return e.currentTarget.closest(".tpl")?.querySelector("textarea")??null}renderConsent(e,s){const t=s.consent,i=t?.page_problem??null;return r`<sw-card flush data-msg-settings-card="consent">
      <div class="ch"><div><h3>${p("consent.title")}</h3><div class="sub">${p("consent.sub")}</div></div></div>
      <button type="button" class="sw" role="switch" aria-checked=${String(e.consent_by_link)} data-msg-setting="consent_by_link" @click=${()=>this.set({consent_by_link:!e.consent_by_link},"consent_by_link")}>
        ${ee(p("consent.switch"),e.consent_by_link?p("consent.on"):p("consent.off"))}
      </button>
      ${this.problemLine("consent_by_link")}
      ${e.consent_by_link&&i?r`<div class="note err" role="alert" data-msg-consent-problem=${i}><sw-icon name="warning" size=${16}></sw-icon><span>${p(ra(i))}</span></div>`:d}
      <div class="fields">
        <div>
          <sw-field label=${p("consent.wait")} hint=${p("consent.wait_hint",{min:t?.wait_days[0]??1,max:t?.wait_days[1]??30})} ?data-bad=${this.shown("consent_wait_days").length>0}>
            <input type="text" inputmode="numeric" .value=${e.consent_wait_days} data-msg-setting="consent_wait_days" @input=${n=>this.set({consent_wait_days:n.target.value},"consent_wait_days")} />
          </sw-field>
          ${this.problemLine("consent_wait_days")}
        </div>
        <div>
          <sw-field label=${p("consent.language")}>
            <select data-msg-setting="consent_language" @change=${n=>this.set({consent_language:n.target.value})}>
              ${ia.map(n=>r`<option value=${n} ?selected=${e.consent_language===n}>${p(`consent.lang.${n}`)}</option>`)}
            </select>
          </sw-field>
        </div>
        ${t?.template_send_supported===!1?d:r`<div>
          <sw-field label=${p("consent.wa_template")} hint=${p("consent.wa_template_hint")} ?data-bad=${this.shown("consent_wa_template").length>0}>
            <input type="text" dir="ltr" .value=${e.consent_wa_template} data-msg-setting="consent_wa_template" @input=${n=>this.set({consent_wa_template:n.target.value},"consent_wa_template")} />
          </sw-field>
          ${this.problemLine("consent_wa_template")}
        </div>
        <div>
          <sw-field label=${p("consent.wa_language")} ?data-bad=${this.shown("consent_wa_language").length>0}>
            <input type="text" dir="ltr" .value=${e.consent_wa_language} data-msg-setting="consent_wa_language" @input=${n=>this.set({consent_wa_language:n.target.value},"consent_wa_language")} />
          </sw-field>
          ${this.problemLine("consent_wa_language")}
        </div>`}
      </div>
      ${t?.template_send_supported===!1?r`<div class="hint" data-msg-consent-no-template>${p("consent.no_template")}</div>`:d}
      <div class="hint" data-msg-consent-rules>${p("consent.rules",{days:t?.resend_days??30,held:t?.held_per_person??3})}</div>
    </sw-card>`}render(){if(this.loading)return r`<div class="stack" data-access-status="loading"><sw-card flush>${R(4)}</sw-card></div>`;if(!this.draft||!this.reply)return r`<div class="stack" data-access-status="error">${k("error",this.failed,()=>void this.load())}</div>`;const e=this.draft,s=this.reply,t=s.limits,i=s.service.accounts,n=this.dirty,o=this.submitted&&this.problems().length>0;return r`<div class="stack" data-access-status="ready" data-msg-settings>
      <sw-card flush data-msg-settings-card="general">
        <div class="ch"><div><h3>${p("title")}</h3><div class="sub">${p("sub")}</div></div></div>
        ${this.serviceLine(s)}
        <button type="button" class="sw" role="switch" aria-checked=${String(e.enabled)} data-msg-setting="enabled" @click=${()=>this.set({enabled:!e.enabled})}>
          ${ee(p("enabled.title"),e.enabled?p("enabled.on"):p("enabled.off"))}
        </button>
        <button type="button" class="sw" role="switch" aria-checked=${String(e.free_text)} data-msg-setting="free_text" @click=${()=>this.set({free_text:!e.free_text})}>
          ${ee(p("free.title"),e.free_text?p("free.on"):p("free.off"))}
        </button>
        <div class="hint" data-msg-optout-note>${p("optout.note")}</div>
        <div class="fields">
          <div>
            <sw-field label=${p("bulk.title")} hint=${p("bulk.hint",{min:t.bulk_max[0],max:t.bulk_max[1]})} ?data-bad=${this.shown("bulk_max").length>0}>
              <input type="text" inputmode="numeric" .value=${e.bulk_max} data-msg-setting="bulk_max" @input=${l=>this.set({bulk_max:l.target.value},"bulk_max")} />
            </sw-field>
            ${this.problemLine("bulk_max")}
          </div>
          <div>
            <sw-field label=${p("rate.title")} hint=${p("rate.hint",{min:t.rate_per_hour[0],max:t.rate_per_hour[1]})} ?data-bad=${this.shown("rate_per_hour").length>0}>
              <input type="text" inputmode="numeric" .value=${e.rate_per_hour} data-msg-setting="rate_per_hour" @input=${l=>this.set({rate_per_hour:l.target.value},"rate_per_hour")} />
            </sw-field>
            ${this.problemLine("rate_per_hour")}
          </div>
          ${this.capField("per_sender_per_hour","sender",t.per_sender_per_hour??[1,1e3])}
          ${this.capField("per_person_per_day","person",t.per_person_per_day??[1,50])}
          ${this.capField("per_station_per_hour","station",t.per_station_per_hour??[1,1e3])}
          <div data-msg-send-hours>
            <button type="button" class="sw" role="switch" aria-checked=${String(e.hours_on)} data-msg-setting="send_hours" @click=${()=>this.set({hours_on:!e.hours_on},"send_hours")}>
              ${ee(p("hours.title"),e.hours_on?p("hours.on"):p("hours.off"))}
            </button>
            ${e.hours_on?r`<div class="fields">
                  <sw-field label=${p("hours.from")} ?data-bad=${this.shown("send_hours").length>0}>
                    <input type="time" lang=${ze()} class="ltr" .value=${e.hours_from} data-msg-setting="send_hours_from" @input=${l=>this.set({hours_from:l.target.value},"send_hours")} />
                  </sw-field>
                  <sw-field label=${p("hours.to")} ?data-bad=${this.shown("send_hours").length>0}>
                    <input type="time" lang=${ze()} class="ltr" .value=${e.hours_to} data-msg-setting="send_hours_to" @input=${l=>this.set({hours_to:l.target.value},"send_hours")} />
                  </sw-field>
                </div>`:d}
            ${this.problemLine("send_hours")}
          </div>
          <div>
            <sw-field label=${p("org.title")} ?data-bad=${this.shown("organization").length>0}>
              <input type="text" .value=${e.organization} data-msg-setting="organization" @input=${l=>this.set({organization:l.target.value},"organization")} />
            </sw-field>
            <div class="hint" data-msg-org-hint>${_e(p("org.hint"))}</div>
            ${this.problemLine("organization")}
          </div>
          ${i.length>1?r`<div>
                <sw-field label=${p("account.title")}>
                  <select data-msg-setting="account" @change=${l=>this.set({account:l.target.value})}>
                    <option value="" ?selected=${e.account===""}>${p("account.choose")}</option>
                    ${i.map(l=>r`<option value=${l.id} ?selected=${e.account===l.id}>${l.name}</option>`)}
                  </select>
                </sw-field>
              </div>`:d}
        </div>
      </sw-card>

      ${this.renderConsent(e,s)}

      <sw-card flush data-msg-settings-card="templates">
        <div class="ch">
          <div><h3>${p("templates.title")}</h3><div class="sub">${_e(p("templates.sub"))}</div></div>
          <div class="ctl"><sw-button icon="plus" data-msg-template-add ?disabled=${e.templates.length>=t.templates_max} @click=${()=>this.addRow()}>${p("template.add")}</sw-button></div>
        </div>
        ${this.problemLine("templates")}
        ${e.templates.length===0?r`<div class="empty" data-msg-templates-empty>${p("templates.empty")}</div>`:e.templates.map((l,c)=>this.renderTemplate(l,c,t))}
      </sw-card>

      <div class="actions" data-msg-actions>
        <span class="grow">
          ${this.notice==="saved"?r`<span class="note info" role="status" data-msg-notice="saved"><sw-icon name="check" size=${16}></sw-icon><span>${p("saved")}</span></span>`:d}
          ${this.notice==="failed"?r`<span class="note err" role="alert" data-msg-notice="failed"><sw-icon name="warning" size=${16}></sw-icon><span>${this.noticeText}</span></span>`:d}
          ${this.notice==="conflict"?r`<span class="note stale" role="alert" data-msg-notice="conflict"><sw-icon name="warning" size=${16}></sw-icon><span>${p("conflict")}</span><sw-button size="sm" data-msg-reload @click=${()=>void this.load()}>${p("reload")}</sw-button></span>`:d}
          ${this.notice===""&&o?r`<span class="note err" role="alert" data-msg-notice="invalid"><sw-icon name="warning" size=${16}></sw-icon><span>${p("invalid")}</span></span>`:d}
          ${this.notice===""&&!o&&n?r`<span class="note info" data-msg-notice="unsaved"><span>${p("unsaved")}</span></span>`:d}
        </span>
        <sw-button data-msg-revert ?disabled=${!n||this.saving} @click=${()=>this.revert()}>${p("revert")}</sw-button>
        <sw-button variant="primary" data-msg-save ?disabled=${!n||this.saving} @click=${()=>void this.save()}>${this.saving?p("saving"):p("save")}</sw-button>
      </div>

      <wa-installed-card></wa-installed-card>
    </div>`}};b.styles=[H,Qe,N`
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
      ${be}
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
    `,Z,W];x([T({type:Number})],b.prototype,"rev",2);x([h()],b.prototype,"reply",2);x([h()],b.prototype,"draft",2);x([h()],b.prototype,"base",2);x([h()],b.prototype,"loading",2);x([h()],b.prototype,"failed",2);x([h()],b.prototype,"saving",2);x([h()],b.prototype,"notice",2);x([h()],b.prototype,"noticeText",2);x([h()],b.prototype,"submitted",2);x([h()],b.prototype,"touched",2);x([h()],b.prototype,"remote",2);b=x([j("system-access-messaging")],b);const da=()=>pe("access-control/status/system"),ca=()=>pe("access-control/status/jobs"),_=e=>typeof e=="object"&&e!==null&&!Array.isArray(e),f=e=>typeof e=="string"&&e.length>0?e:null,$=e=>typeof e=="number"&&Number.isInteger(e)&&e>=0?e:null,pa=e=>typeof e=="boolean"?e:null,re=e=>Array.isArray(e)?e.filter(s=>typeof s=="string"&&s.length>0):[],is="unknown",v=e=>f(e)??is,ua=["checkpoint","schedules","maintenance","templates"],ha={not_listed:"wkUnsupportedNotListed",wiskey_unknown_command:"wkUnsupportedNotListed",no_copy:"wkUnsupportedNoCopy",commands_unknown:"wkUnsupportedCommandsUnknown",api_incompatible:"wkUnsupportedApi"};function oe(e,s){if(!e)return null;const t=f(e.wiskey_code),i=f(e.reason);switch(e.state){case"ready":return null;case"unsupported":return{kind:"unsupported",panel:"empty",heading:"wkUnsupported",hint:i&&ha[i]||"wkUnsupportedNotListed",code:t,retry:!1};case"forbidden":return{kind:"refused",panel:"forbidden",heading:"wkRefused",hint:s==="jobs"?"wkRefusedJobsHint":"wkRefusedSystemHint",code:t,retry:!1};case"busy":return{kind:"busy",panel:"stale",heading:"sRate",hint:"sRateHint",code:t,retry:!0};case"unavailable":return i==="connecting"?{kind:"connecting",panel:"loading",heading:"sConnecting",hint:null,code:t,retry:!0}:i==="ha_not_configured"?{kind:"not_configured",panel:"stale",heading:"sNotConfigured",hint:null,code:t,retry:!1}:i==="not_installed"?{kind:"not_installed",panel:"empty",heading:"sNotInstalled",hint:null,code:t,retry:!1}:{kind:"unavailable",panel:"error",heading:"sUnavailable",hint:"wkUnavailableHint",code:t,retry:!0};default:return i==="contract_mismatch"?{kind:"mismatch",panel:"error",heading:"wkMismatch",hint:"wkMismatchHint",code:t,retry:!0}:t==="jobs_unavailable"||i==="jobs_unavailable"?{kind:"jobs_unavailable",panel:"empty",heading:"wkJobsUnavailable",hint:"wkJobsUnavailableHint",code:"jobs_unavailable",retry:!0}:{kind:"error",panel:"error",heading:"sError",hint:null,code:t??i,retry:!0}}}function ma(e){return _(e)?{at:f(e.at),channel:v(e.channel),http_status_code:$(e.http_status_code),isapi_status_code:$(e.isapi_status_code),sub_status:f(e.sub_status),reason:v(e.reason)}:null}function wa(e){if(!_(e)||!f(e.station_id))return null;const s=_(e.sync)?e.sync:{},t=_(s.request)?s.request:null,i=t&&_(t.last_result)?t.last_result:null,n=_(s.last_intent)?s.last_intent:null;return{station_id:e.station_id,loaded:pa(e.loaded),connection:v(e.connection),last_authenticated_at:f(e.last_authenticated_at),last_failure:ma(e.last_failure),firmware:f(e.firmware),sync:{state:v(s.state),last_reconciled_at:f(s.last_reconciled_at),request:t?{scope:v(t.scope),pending_request_id:f(t.pending_request_id),active_request_id:f(t.active_request_id),last_result:i?{request_id:f(i.request_id),state:v(i.state),observed_at:f(i.observed_at),code:f(i.code),effect_proven:!1}:null}:null,last_intent:n?{operation_id:f(n.operation_id),state:v(n.state),updated_at:f(n.updated_at),verified_at:f(n.verified_at)}:null}}}function fa(e){if(!_(e))return null;const s=_(e.integration)?e.integration:{},t=_(e.writes)?e.writes:{},i=_(e.jobs)?e.jobs:{},n=_(e.templates)?e.templates:{},o=_(e.schedules)?e.schedules:{},l=(Array.isArray(i.families)?i.families:[]).filter(_).filter(c=>typeof c.family=="string").map(c=>({family:c.family,waiting:$(c.waiting),running:$(c.running),failed_last_24h:$(c.failed_last_24h)}));return{generated_at:f(e.generated_at),observation_scope:v(e.observation_scope),integration:{version:f(s.version),api_contract:$(s.api_contract),profile:v(s.profile)},stations:(Array.isArray(e.stations)?e.stations:[]).map(wa).filter(c=>c!==null),writes:{writes_enabled:null,reason_codes:re(t.reason_codes),legacy_schedule_writes_enabled:!1,legacy_schedule_reason:f(t.legacy_schedule_reason),reviewed_schedule_contract:f(t.reviewed_schedule_contract),reviewed_schedule_reason:f(t.reviewed_schedule_reason)},jobs:{families:l,families_absent:re(i.families_absent),scope:f(i.scope),running_scope:f(i.running_scope),failed_window:f(i.failed_window),history_complete:!1,reason_codes:re(i.reason_codes)},templates:{installation_state:v(n.installation_state),configured_accounts:$(n.configured_accounts),configured_templates:$(n.configured_templates),reason_codes:re(n.reason_codes),send_admission:f(n.send_admission)},schedules:{legacy_writes_enabled:!1,reviewed_execution_contract:f(o.reviewed_execution_contract),physical_acceptance:v(o.physical_acceptance)},physical_result:v(e.physical_result)}}function va(e){return{version:e.integration.version,apiContract:e.integration.api_contract,profile:e.integration.profile,connected:e.stations.filter(s=>s.connection==="connected").length,total:e.stations.length,unknown:e.stations.filter(s=>!rs.includes(s.connection)).length}}const _a=["manual-existing","managed"],rs=["connected","connecting","auth_failed","offline"],ga=["synced","pending","syncing","offline","conflict","error","delete_pending","unavailable"],ba=["synced","pending","syncing","offline","conflict","error","delete_pending","cancelled","interrupted","cancelled_before_run"],$a=["authentication_failed","authorization_denied","account_locked","timeout","connection_failed","device_rejected","source_changed"],ya=["csv","bulk"],ka=["paused","running","completed","completed_with_errors","cancelled"],xa=["pending","approved","rejected"],Sa=["resume","retry_failed"],Ra=["per_command_authorization_and_business_admission","schedule_writes_unverified","original_ownership_fresh_source_and_review_required","retention_can_remove_completed_jobs","template_installation_unavailable","original_per_operation_guards"],Ca=["unavailable","installed","not_installed"];function O(e,s,t){return!s||s===is?{key:`${e}unknown`}:t.includes(s)?{key:`${e}${s.replace(/-/g,"_")}`}:{code:s}}const le=e=>e?Ra.includes(e)?{key:`wkReason_${e}`}:{code:e}:null;function za(e){switch(e){case"connected":return"live";case"connecting":return"stale";case"auth_failed":return"error";case"offline":return"offline";default:return"unknown"}}function Ie(e){switch(e){case"synced":return"live";case"pending":case"delete_pending":return"stale";case"syncing":return"recorded";case"conflict":case"error":return"error";case"offline":case"unavailable":return"offline";case"cancelled":case"interrupted":case"cancelled_before_run":return"neutral";default:return"unknown"}}function Aa(e){switch(e){case"completed":return"live";case"running":return"recorded";case"paused":return"stale";case"completed_with_errors":return"error";case"cancelled":return"neutral";default:return"unknown"}}function Ta(e){const s=e.sync.request;return s?s.active_request_id?{kind:"active"}:s.pending_request_id?{kind:"pending"}:s.last_result?{kind:"result",state:s.last_result.state,at:s.last_result.observed_at,code:s.last_result.code}:{kind:"none"}:{kind:"none"}}function Oa(e){return[e.http_status_code!==null?`HTTP ${e.http_status_code}`:"",e.isapi_status_code!==null?`ISAPI ${e.isapi_status_code}`:"",e.sub_status??""].filter(Boolean).join(" · ")}function Pa(e){const s=new Map(e.jobs.families.map(t=>[t.family,t]));return ua.map(t=>{const i=s.get(t);return i?{family:t,present:!0,waiting:i.waiting,running:i.running,failed:i.failed_last_24h}:{family:t,present:!1}})}function Na(e){return!_(e)||!Array.isArray(e.records)?null:{records:e.records.filter(_).flatMap(t=>{const i=f(t.id);if(!i)return[];const n=_(t.approval)?{state:v(t.approval.state),action:v(t.approval.action),expires_at:f(t.approval.expires_at)}:null,o=(Array.isArray(t.errors)?t.errors:[]).filter(_).flatMap(l=>{const c=$(l.row);return c!==null&&c>=1?[{row:c,code:f(l.code)}]:[]});return[{id:i,kind:v(t.kind),state:v(t.state),revision:$(t.revision),created_at:f(t.created_at),updated_at:f(t.updated_at),approval:n,total:$(t.total),saved:$(t.saved),failed:$(t.failed),pending:$(t.pending),errors:o,errors_truncated:t.errors_truncated===!0}]}),scope:v(e.scope),history_complete:!1,notification:v(e.notification)}}const Ea=e=>e.slice(0,8);var ja=Object.defineProperty,Ma=Object.getOwnPropertyDescriptor,os=(e,s,t,i)=>{for(var n=i>1?void 0:i?Ma(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&ja(s,t,n),n};const Ke=async e=>{const s=await e();return{state:"ready",last_error:null,fetched_at:s.fetched_at,read:s}};let ce=class extends E{constructor(){super(...arguments),this.rev=0,this.lastRev=0}connectedCallback(){super.connectedCallback();const e=()=>this.requestUpdate();this.systemRes=new y({fetch:()=>Ke(da),pick:s=>s.read,onChange:e}),this.jobsRes=new y({fetch:()=>Ke(ca),pick:s=>s.read,onChange:e}),this.namesRes=new y({fetch:()=>he(),pick:s=>s.stations,onChange:e}),this.lastRev=this.rev,this.reloadAll()}disconnectedCallback(){for(const e of[this.systemRes,this.jobsRes,this.namesRes])e?.dispose();super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.reloadAll())}reloadAll(){this.systemRes.reload(),this.jobsRes.reload(),this.namesRes.reload()}zone(){return this.namesRes?.snap.reply?.default_zone??te}nameOf(e){return this.namesRes.snap.data?.find(s=>s.id===e)?.name??null}word(e){return"key"in e?a(e.key):r`<bdi class="ltr mono" style=${w.raw}>${e.code}</bdi>`}wordText(e){return"key"in e?a(e.key):e.code}num(e){return e===null?a("wkUnknown"):String(e)}when(e,s){return S(z(e,s,this.zone()))}reason(e){const s=le(e);return s?r`<span class="s wrap">${this.word(s)}</span>`:d}panel(e,s,t,i=!1){const n=[e.hint?a(e.hint):"",e.code?a("wkCode",{code:e.code}):""].filter(Boolean).join(" ");return r`<sw-state-panel icon="door" quiet ?compact=${i} data-wk-state=${e.kind} data-wk-read=${s} state=${e.panel} heading=${a(e.heading)} hint=${n} actionLabel=${e.retry?a("retry"):""} @action=${t}></sw-state-panel>`}staleNote(e,s,t){if(!e.stale)return d;const i=e.snap.fetchedAt;return r`<div class="note stale" role="status" data-wk-stale=${t}><sw-icon name="offline" size=${16}></sw-icon><span>${i?a("stale",{t:this.when(i,s)}):a("staleNever")}</span></div>`}tilesRow(e){const s=va(e),t=O("wkProfile_",s.profile,_a),i=(n,o,l,c,u="",g=!1)=>r`<div class="tile" data-wk-tile=${n}><span class="k">${a(o)}</span><span class="v ${u} ${g?"sm":""}">${l}</span><span class="d">${c||r`&nbsp;`}</span></div>`;return r`<div class="tiles" data-wk-tiles>
      ${i("version","wkTileVersion",s.version?r`<bdi class="ltr">${s.version}</bdi>`:a("wkUnknown"),s.apiContract!==null?a("wkTileContract",{n:s.apiContract}):"","",!0)}
      ${i("profile","wkTileProfile",this.word(t),"","",!0)}
      ${i("stations","wkTileStations",String(s.connected),s.unknown?a("wkTileStationsUnknown",{total:s.total,n:s.unknown}):a("wkTileStationsOf",{total:s.total}),s.total>0&&s.connected<s.total?"warn":"")}
      ${i("writes","wkTileWrites",a("wkWritesPerCommand"),"","",!0)}
    </div>`}stationsCard(e,s){const t=o=>o,i=[{key:"station",label:a("wkColStation"),card:"title",render:o=>{const l=t(o),c=this.nameOf(l.station_id);return r`<span style=${w.strong}>${c??r`<bdi style=${w.raw}>${l.station_id}</bdi>`}</span>${l.loaded===!1?r`<span style=${w.sub}>${a("wkNotLoaded")}</span>`:d}`}},{key:"connection",label:a("wkColConnection"),card:"badge",render:o=>r`<sw-badge kind=${za(t(o).connection)} label=${this.wordText(O("wkConn_",t(o).connection,rs))}></sw-badge>`},{key:"auth",label:a("wkColAuth"),card:"show",render:o=>this.when(t(o).last_authenticated_at,s)},{key:"failure",label:a("wkColFailure"),card:"show",render:o=>{const l=t(o).last_failure;if(!l)return a("ageNone");const c=Oa(l);return r`<span style=${w.wrap}>${this.word(O("wkFail_",l.reason,$a))} · ${this.when(l.at,s)}</span>${c?r`<span style=${w.sub}><bdi style=${w.raw}>${c}</bdi></span>`:d}`}},{key:"firmware",label:a("wkColFirmware"),hideBelow:"tablet",render:o=>t(o).firmware?r`<bdi style=${w.raw}>${t(o).firmware}</bdi>`:a("wkUnknown")},{key:"sync",label:a("wkColSync"),card:"meta",render:o=>{const l=t(o).sync;return r`<span style=${w.row}><sw-badge kind=${Ie(l.state)} label=${this.wordText(O("wkSync_",l.state,ga))}></sw-badge><span style=${w.muted}>${this.when(l.last_reconciled_at,s)}</span></span>`}},{key:"request",label:a("wkColRequest"),card:"show",render:o=>{const l=Ta(t(o));return l.kind==="none"?a("ageNone"):l.kind==="pending"?a("wkReqPending"):l.kind==="active"?a("wkReqActive"):r`<span style=${w.row}><sw-badge kind=${Ie(l.state)} label=${this.wordText(O("wkSync_",l.state,ba))}></sw-badge><span style=${w.muted}>${a("wkNotProven")}</span></span>${l.code?r`<span style=${w.sub}><bdi style=${w.raw}>${l.code}</bdi></span>`:d}`}}],n=e.stations.map(o=>({...o,id:o.station_id}));return r`<sw-card flush data-wk-card="stations">
      <div class="ch"><div><h3>${a("wkStationsTitle")}</h3><div class="sub">${a("wkStationsSub")}</div></div></div>
      ${n.length?r`<sw-table data-wk-stations .columns=${i} .rows=${n} rowKey="id" static-rows></sw-table>`:r`<div class="empty" data-wk-stations-empty>${a("wkStationsEmpty")}</div>`}
      ${n.length?r`<div class="note info" role="note"><sw-icon name="info" size=${16}></sw-icon><span>${a("wkRequestNote")}</span></div>`:d}
    </sw-card>`}familiesCard(e){const s=o=>o,t=(o,l)=>o.present?this.num(o[l]):a("ageNone"),i=[{key:"family",label:a("wkColFamily"),card:"title",render:o=>r`<span style=${w.strong}>${a(`wkFamily_${s(o).family}`)}</span>${s(o).present?d:r`<span style=${w.sub}>${a("wkFamilyMissing")}</span>`}`},{key:"waiting",label:a("wkColWaiting"),card:"show",kind:"num",render:o=>t(s(o),"waiting")},{key:"running",label:a("wkColRunning"),card:"show",kind:"num",render:o=>t(s(o),"running")},{key:"failed",label:a("wkColFailed"),card:"show",kind:"num",render:o=>t(s(o),"failed")}],n=Pa(e).map(o=>({...o,id:o.family}));return r`<sw-card flush data-wk-card="families">
      <div class="ch"><div><h3>${a("wkFamiliesTitle")}</h3><div class="sub">${a("wkFamiliesSub")}</div></div></div>
      <sw-table data-wk-families .columns=${i} .rows=${n} rowKey="id" static-rows .rowAttrs=${o=>({"data-wk-family":String(o.family),"data-wk-present":String(o.present)})}></sw-table>
      <div class="note info" role="note"><sw-icon name="info" size=${16}></sw-icon><span>${a("wkFamiliesNote")}${e.jobs.reason_codes.length?r` · ${e.jobs.reason_codes.map((o,l)=>r`${l?" · ":""}${this.word(le(o))}`)}`:d}</span></div>
    </sw-card>`}kv(e,s,t,i=d){return r`<div class="row kv" data-wk-line=${e}><span class="main"><span class="t">${a(s)}</span>${i}</span><span class="side">${t}</span></div>`}writesCard(e){const s=e.writes;return r`<sw-card flush data-wk-card="writes">
      <div class="ch"><div><h3>${a("wkWritesTitle")}</h3><div class="sub">${a("wkWritesSub")}</div></div></div>
      <div class="list">
        ${this.kv("writes","wkWritesLine",r`<sw-badge kind="neutral" label=${a("wkWritesPerCommand")}></sw-badge>`,r`<span class="s wrap">${a("wkWritesValue")}</span>`)}
        ${this.kv("legacy-schedules","wkLegacySched",r`<sw-badge kind="offline" label=${a("wkOff")}></sw-badge>`,this.reason(s.legacy_schedule_reason))}
        ${this.kv("reviewed-schedules","wkReviewedSched",s.reviewed_schedule_contract||e.schedules.reviewed_execution_contract?r`<bdi class="ltr mono">${s.reviewed_schedule_contract??e.schedules.reviewed_execution_contract}</bdi>`:a("wkUnknown"),this.reason(s.reviewed_schedule_reason))}
        ${this.kv("physical","wkPhysical",r`<sw-badge kind="unknown" label=${a("wkNotMeasured")}></sw-badge>`)}
      </div>
    </sw-card>`}templatesCard(e){const s=e.templates,t=le(s.send_admission);return r`<sw-card flush data-wk-card="templates">
      <div class="ch"><div><h3>${a("wkTplTitle")}</h3><div class="sub">${a("wkTplSub")}</div></div></div>
      <div class="list">
        ${this.kv("installation","wkTplState",this.word(O("wkTpl_",s.installation_state,Ca)),s.reason_codes.length?r`<span class="s wrap">${s.reason_codes.map((i,n)=>r`${n?" · ":""}${this.word(le(i))}`)}</span>`:d)}
        ${this.kv("accounts","wkTplAccounts",this.num(s.configured_accounts))}
        ${this.kv("templates","wkTplTemplates",this.num(s.configured_templates))}
        ${this.kv("admission","wkTplAdmission",t?this.word(t):a("wkUnknown"))}
      </div>
      <div class="note info" role="note"><sw-icon name="info" size=${16}></sw-icon><span>${a("wkTplNote")}</span></div>
    </sw-card>`}systemPart(e){const s=this.systemRes,t=s.snap;if(!t.everAnswered||t.busy&&!t.data)return r`${Ge()}<sw-card flush>${R(3)}</sw-card>`;if(!t.data)return k(t.failure??"error",t.message,()=>void s.reload());const i=oe(t.data,"system");if(i)return this.panel(i,"system",()=>void s.reload());const n=fa(t.data.data);return n?r`${this.staleNote(s,e,"system")}
      <div class="note info" role="note" data-wk-scope><sw-icon name="info" size=${16}></sw-icon><span>${a("wkScopeNote")}${n.generated_at?r` · ${a("wkReadAt",{when:this.when(n.generated_at,e)})}`:d}</span></div>
      ${this.tilesRow(n)} ${this.stationsCard(n,e)} ${this.familiesCard(n)}
      <div class="grid2">${this.writesCard(n)}${this.templatesCard(n)}</div>`:this.panel(oe({state:"error",reason:"contract_mismatch",wiskey_code:null},"system"),"system",()=>void s.reload())}jobsCard(e){const s=this.jobsRes,t=s.snap;let i,n=!1;if(!t.everAnswered||t.busy&&!t.data)i=R(2);else if(!t.data)i=r`<div class="empty-panel">${k(t.failure??"error",t.message,()=>void s.reload(),!0)}</div>`;else{const o=oe(t.data,"jobs"),l=o?null:Na(t.data.data);o||!l?i=r`<div class="empty-panel">${this.panel(o??oe({state:"error",reason:"contract_mismatch",wiskey_code:null},"jobs"),"jobs",()=>void s.reload(),!0)}</div>`:(n=!0,i=l.records.length?this.jobsTable(l.records,e):r`<div class="empty" data-wk-jobs-empty>${a("wkJobsEmpty")}</div>`)}return r`<sw-card flush data-wk-card="jobs">
      <div class="ch"><div><h3>${a("wkJobsTitle")}</h3><div class="sub">${a("wkJobsSub")}</div></div></div>
      ${this.staleNote(s,e,"jobs")} ${i}
      ${n?r`<div class="note info" role="note"><sw-icon name="info" size=${16}></sw-icon><span>${a("wkJobsNote")}</span></div>`:d}
    </sw-card>`}jobsTable(e,s){const t=n=>n,i=[{key:"id",label:a("wkColJob"),card:"title",cellTitle:n=>t(n).id,render:n=>r`<bdi style=${w.raw}>${Ea(t(n).id)}</bdi>`},{key:"kind",label:a("wkColKind"),card:"meta",render:n=>this.word(O("wkJobKind_",t(n).kind,ya))},{key:"state",label:a("wkColState"),card:"badge",render:n=>r`<sw-badge kind=${Aa(t(n).state)} label=${this.wordText(O("wkJob_",t(n).state,ka))}></sw-badge>`},{key:"rows",label:a("wkColRows"),card:"show",render:n=>{const o=t(n),l=o.errors.length?o.errors_truncated?a("wkErrorsMore",{n:o.errors.length}):a("wkErrors",{n:o.errors.length}):"";return r`<span style=${w.wrap}>${a("wkRows",{saved:this.num(o.saved),failed:this.num(o.failed),pending:this.num(o.pending),total:this.num(o.total)})}</span>${l?r`<span style=${w.sub}>${l}</span>`:d}`}},{key:"approval",label:a("wkColApproval"),card:"show",render:n=>{const o=t(n).approval;return o?r`<span style=${w.wrap}>${this.word(O("wkAppr_",o.state,xa))} · ${this.word(O("wkApprAct_",o.action,Sa))}${o.expires_at?r` · ${a("wkApprUntil",{when:this.when(o.expires_at,s)})}`:d}</span>`:a("ageNone")}},{key:"updated",label:a("wkColUpdated"),card:"meta",render:n=>this.when(t(n).updated_at??t(n).created_at,s)}];return r`<sw-table data-wk-jobs .columns=${i} .rows=${e} rowKey="id" static-rows></sw-table>`}render(){const e=new Date;return r`<div class="stack" data-wk-status=${this.systemRes.snap.data?.state??(this.systemRes.snap.everAnswered?"failed":"loading")}>${this.systemPart(e)} ${this.jobsCard(e)}</div>`}};ce.styles=[H,N`
      .kv .main .t {
        white-space: normal;
      }
      .kv .side {
        flex-wrap: wrap;
        justify-content: flex-end;
        max-inline-size: 60%;
        text-align: end;
      }
      .tile .v.sm {
        font-size: var(--sw-fs-lg);
      }
    `,Z,W];os([T({type:Number})],ce.prototype,"rev",2);ce=os([j("system-access-wiskey")],ce);var La=Object.defineProperty,qa=Object.getOwnPropertyDescriptor,M=(e,s,t,i)=>{for(var n=i>1?void 0:i?qa(s,t):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(n=(i?l(s,t,n):l(n))||n);return i&&n&&La(s,t,n),n};let A=class extends E{constructor(){super(...arguments),this.view="",this.rev=0,this.meta=null,this.zone=te,this.admin=!0,this.wide=!0,this.people=!0,this.configure=!1,this.stop=null,this.onMeta=e=>{const s=e.detail;this.meta=s.meta,this.zone=s.zone}}connectedCallback(){super.connectedCallback(),this.sync(),this.stop=He(()=>this.sync())}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}sync(){const e=de();this.admin=e.admin,this.people=e.people,this.wide=!C()||G("access.admin.read"),this.configure=C()&&G("system.configure")}segments(){const e=[{id:"status",label:a("segStatus")}];return this.wide&&e.push({id:"audit",label:a("segAudit")}),this.wide&&e.push({id:"wiskey",label:a("segWiskey")}),(this.people||this.wide)&&e.push({id:"groups",label:a("segGroups")}),this.configure&&e.push({id:"policy",label:a("segPolicy")}),this.configure&&e.push({id:"messaging",label:p("segment")}),e}active(e){return e.find(s=>s.id===this.view)?.id??"status"}subtitle(){if(!this.meta)return"";const e=ot(this.meta,new Date,this.zone);return[e.version?a("hlVersion",{v:e.version}):"",e.connected===!0?a("hlConnected"):e.connected===!1?a("hlDisconnected"):"",e.checked.key!=="none"?a("hlChecked",{when:S(e.checked)}):""].filter(Boolean).join(" · ")}render(){if(C()&&!this.admin)return r`<sw-page heading=${a("title")}><sw-state-panel quiet data-access-state="no_permission" state="forbidden" heading=${a("noPermission")}></sw-state-panel></sw-page>`;const e=this.segments(),s=this.active(e),t=e.map(i=>({id:i.id,label:i.label,href:`${hs}${i.id==="status"?"":`/${i.id}`}`}));return r`<sw-page heading=${a("title")} subheading=${this.subtitle()} wide>
      <sw-button slot="actions" size="lg" variant="ghost" icon="refresh" data-access-refresh @click=${()=>this.rev+=1}>${a("refresh")}</sw-button>
      ${e.length>1?r`<div class="segs"><sw-tabs .items=${t} .active=${s} .variant=${ms(null,2)} group-label=${a("segments")} data-access-segments></sw-tabs></div>`:d}
      <div class="body" data-access-segment=${s}>
        ${s==="audit"?r`<system-access-audit .rev=${this.rev} @access-meta=${this.onMeta}></system-access-audit>`:s==="wiskey"?r`<system-access-wiskey .rev=${this.rev}></system-access-wiskey>`:s==="groups"?r`<system-access-groups .rev=${this.rev} @access-meta=${this.onMeta}></system-access-groups>`:s==="policy"?r`<system-access-policy .rev=${this.rev}></system-access-policy>`:s==="messaging"?r`<system-access-messaging .rev=${this.rev}></system-access-messaging>`:r`<system-access-status .rev=${this.rev} @access-meta=${this.onMeta}></system-access-status>`}
        <wk-deep-links class="deeplinks" place=${`settings-${s}`}></wk-deep-links>
      </div>
    </sw-page>`}};A.styles=[wt,N`
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
    `,W];M([T()],A.prototype,"view",2);M([h()],A.prototype,"rev",2);M([h()],A.prototype,"meta",2);M([h()],A.prototype,"zone",2);M([h()],A.prototype,"admin",2);M([h()],A.prototype,"wide",2);M([h()],A.prototype,"people",2);M([h()],A.prototype,"configure",2);A=M([j("system-access-control")],A);export{A as SystemAccessControl};
