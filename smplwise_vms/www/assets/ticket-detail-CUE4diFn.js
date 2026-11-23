const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{sw as ze,gN as Y,md as os,me as rs,bv as Xe,cT as Rt,g as F,aw as C,j as g,i as ie,aK as ne,cu as Ee,m as N,eu as ke,a as j,b as n,A as r,a5 as x,bw as M,eO as ls,oZ as ds,a0 as X,ea as be,bb as J,k as oe,bk as cs,a1 as ue,bl as It,bn as Z,bE as ps,bF as us,bB as hs,AN as fs,AO as ye,s as ms,b3 as vs,gC as gs,AP as Ze,n as u,AQ as bs,Q as $s,aA as ws,AR as se,bx as ys,cm as Oe,cv as ve,AS as ks,wN as xs,st as _s,cw as Pe}from"./index-eHtAZ44A.js";import{l as zs}from"./lead-reserve-CHwtOPqC.js";import{_ as Mt}from"./sw-logo-art-PLtEZJxU.js";import{a as re}from"./automations-glass-DLYdljCh.js";import{a as le}from"./glass-DPaC1cdZ.js";import{b as de}from"./bubble-chrome-DOL7l61i.js";import{ticketCostsApi as U,LINE_KINDS as Fe,COST_MODES as qs}from"./tickets-costs-DmBWXaVP.js";import{c as Cs,i as Ts,q as h,b as Ns,s as Ss,e as Es,f as Ds,g as Os,h as Ps,v as Rs,j as Is,a as H,m as $e,w as Je,k as Ms,p as Ls,l as As,n as et,o as Fs,r as tt,t as st,u as js,x as Bs,y as at,z as it,A as Us,B as Hs,C as Ks,D as Vs,E as Ws,M as Qs,F as Gs,V as Ys,G as Xs,H as Zs,I as Js,J as ea,K as ta,L as sa,N as nt,O as aa,P as ot,d as A,Q as ia,R as na,S as oa,T as ra,U as rt,W as lt,X as la,Y as da,Z as ca,_ as pa,$ as ua,a0 as ha,a1 as fa,a2 as ma,a3 as dt}from"./drawer-model-CukwrJsa.js";import{t as Re,f as De,c as p,j as va,e as ae,l as pe,w as ct,o as ga,k as Ne,n as pt,r as ba,s as Lt,u as At,p as Ft,x as jt,g as $a,y as wa}from"./cost-model-B59q-d5l.js";import{c as y,t as f}from"./icons-WoM0xGTL.js";import{b as ce,e as me,t as xe,M as S,n as ya,f as ka,h as ut,a as xa,o as _a}from"./map-text-DIyz28TN.js";import{t as O,a as je,w as za,n as ht,r as qa}from"./tickets-DDZQK1BN.js";import{t as he}from"./tickets-s4-CvsWvZPM.js";import{a as fe,s as Ca,f as Ta,t as Na,O as ft,o as Sa,h as Ea}from"./org-locations-text-BoD2rUCa.js";import{u as Da,s as Oa,o as Pa,w as Ra}from"./readiness-model-DGhavIGL.js";import{N as Ia}from"./model-BGBhXdF0.js";import{b as Ma}from"./geometry-CargtvfA.js";import{d as b}from"./drawer-text-C7P45eW3.js";import{f as Ie}from"./board-model-IyapGYIf.js";import{l as La}from"./location-picker-DR-SViya.js";const Aa=4,Fa=8;function ja(e,t,s,a,i=Aa,o=Fa){const l=Math.min(t.w,Math.max(0,s.w-2*o));let d=a?e.right-l:e.left;d=Math.max(o,Math.min(d,s.w-o-l));const c=Math.max(0,s.h-o-(e.bottom+i)),m=Math.max(0,e.top-i-o),v=t.h;if(v<=c)return{top:e.bottom+i,left:d,maxHeight:v,flipped:!1,scrolls:!1};if(v<=m)return{top:e.top-i-v,left:d,maxHeight:v,flipped:!0,scrolls:!1};const $=m>c,L=Math.max(0,Math.min(v,$?m:c));return{top:$?e.top-i-L:e.bottom+i,left:d,maxHeight:L,flipped:$,scrolls:L<v}}function Ba(e,t){const s=e;try{s.matches(":popover-open")||s.showPopover?.()}catch{}e.style.maxBlockSize="none",e.style.top="0px",e.style.left="0px";const a={w:e.offsetWidth,h:e.offsetHeight},i=t.getBoundingClientRect(),o=document.documentElement,l={w:o.clientWidth||window.innerWidth,h:window.innerHeight||o.clientHeight},d=getComputedStyle(t).direction==="rtl",c=ja(i,a,l,d);return e.style.top=`${Math.round(c.top)}px`,e.style.left=`${Math.round(c.left)}px`,e.style.maxBlockSize=`${Math.floor(c.maxHeight)}px`,e.toggleAttribute("data-scrolls",c.scrolls),e.toggleAttribute("data-flipped",c.flipped),c}function Ua(e,t){if(e.key!=="ArrowDown"&&e.key!=="ArrowUp"&&e.key!=="Home"&&e.key!=="End")return;const s=[...t.querySelectorAll("button:not([disabled])")];if(!s.length)return;e.preventDefault();const a=s.indexOf(t.getRootNode().activeElement),i=e.key==="Home"?0:e.key==="End"?s.length-1:e.key==="ArrowDown"?(a+1)%s.length:a<=0?s.length-1:a-1;s[i].focus()}const Bt=90,Ha=["assigned","acknowledged","in_progress","waiting_part"];function Ka(e){return!!e.can.return||!!e.can.eta&&!e.can.manage&&e.assignee?.kind==="user"?"handler":e.can.manage?"manager":e.cost?.can_decide?"approver":"requester"}const k=(e,t)=>b(e,t);function Ut(e,t){const s=e.replace(/\s+/g," ").trim();return t<=1?"":s.length<=t?s:`${s.slice(0,t-1).trimEnd()}…`}function Ht(e,t=new Date){if(!e)return k("eta_none");const s=new Date(e);if(Number.isNaN(s.getTime()))return k("eta_none");const a=d=>String(d).padStart(2,"0"),i=`${a(s.getHours())}:${a(s.getMinutes())}`,o=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(),l=Math.round((o(s)-o(t))/864e5);return l===0?k("eta_today",{time:i}):l===1?k("eta_tomorrow",{time:i}):k("eta_date",{date:`${a(s.getDate())}/${a(s.getMonth()+1)}`,time:i})}function Va(e){return e.assignee?.name?e.assignee.name:e.last_assignee_name?e.last_assignee_name:(e.assignments?.length?e.assignments[e.assignments.length-1]:void 0)?.name||k("handlerWord")}function Kt(e){return e.assignments?.filter(t=>!t.ended_at).at(-1)}function Wa(e){if(e.link)return!!e.link.first_opened_at;if(!e.events)return null;const t=Kt(e)?.assigned_at??e.assignee?.since??"";return e.events.some(s=>s.kind==="link_opened"&&s.at>=t)}function Qa(e){return e.events?.filter(s=>s.kind==="status"&&s.to==="done").at(-1)?.at??e.last_activity_at}function Ga(e){const t=e.assignments?.filter(s=>s.end_reason==="returned").at(-1);return t?.return_reason?t.return_reason:t?.return_kind==="not_mine"||e.waiting_reason==="not_mine"?k("reason_not_mine"):""}function mt(e,t){if(!t)return e;const s=Bt-e.length-3,a=Ut(t,s);return a?`${e} · ${a}`:e}function Ya(e){const t=e.status==="waiting_part";return{label:t?ze("in_progress"):ze(e.status),sub:t?ze("waiting_part"):"",text:rs(e.status),tone:t?"info":os(e.status)}}function Xa(e){if(e.cost?.status==="submitted"&&(e.status==="done"||Ha.includes(e.status)))return"approver";switch(e.status){case"new":case"returned":return"manager";case"assigned":case"acknowledged":case"in_progress":case"waiting_part":return e.assignee?.kind==="contact"?"vendor":"handler";case"done":return e.cost?.status==="awaiting"?"vendor":"manager";default:return"none"}}function vo(e){return e==="new"||e==="returned"}function Za(e,t,s,a,i){if(s)return k("sn_assigned_requester");if(e.assignee?.kind!=="contact")return a?k("sn_assigned_user_handler"):k("sn_assigned_user",{name:t});const o=Wa(e);if(o===!0)return k("sn_assigned_opened",{name:t});if(o===!1){const l=e.link?.sent_via??Kt(e)?.channel??"",d=l==="whatsapp"?k("via_whatsapp"):l==="email"?k("via_email"):"",c=Y(e.link?.sent_at??e.assignee?.since??e.last_activity_at,i);return k("sn_assigned_sent",{name:t,via:d,when:c})}return k("sn_assigned_contact",{name:t})}function Ja(e,t,s,a,i,o){const l=Y(Qa(e),o);if(a)return k("sn_done_requester");if(i)return k("sn_done_handler",{when:l});const d=e.cost?.status;return d==="submitted"?e.cost?.can_decide?k("sn_done_claim_mine",{name:s,when:l}):k("sn_done_claim_other",{name:s,when:l}):d==="awaiting"?k("sn_done_claim_awaiting",{name:s,when:l}):t==="manager"?k("sn_done",{name:s,when:l}):k("sn_done_other",{name:s,when:l})}function ei(e,t,s){if(s)return k("sn_returned_requester");const a=Ga(e);if(!a)return k("sn_returned_plain");const i=k("sn_returned",{name:t,reason:"\0"}),o=Bt-(i.length-1);return i.replace("\0",Ut(a,o))}function ti(e,t,s){if(e.status==="closed"){const l=Y(e.closed_at??e.last_activity_at,s),d=e.closed_by_name?k("sn_closed",{when:l,who:e.closed_by_name}):k("sn_closed_plain",{when:l});return t?d:mt(d,e.close_note??"")}const a=k("sn_cancelled",{when:Y(e.closed_at??e.last_activity_at,s)}),i=e.duplicate_of?k("sn_duplicate",{n:e.duplicate_of.number}):"",o=i?`${a} · ${i}`:a;return t?o:mt(o,e.close_note??"")}function si(e,t="manager",s=new Date){const a=Va(e),i=t==="requester",o=t==="handler",l=Ht(e.eta_at,s);switch(e.status){case"new":return i?k("sn_new_requester"):k("sn_new",{when:Y(e.created_at,s),who:e.created_by.name});case"assigned":return Za(e,a,i,o,s);case"acknowledged":return i?k("sn_ack_requester",{eta:l}):o?k("sn_ack_handler",{eta:l}):k("sn_ack",{name:a,eta:l});case"in_progress":return i?k("sn_progress_requester",{eta:l}):o?k("sn_progress_handler",{eta:l}):e.eta_at?k("sn_progress_eta",{name:a,eta:l}):k("sn_progress_quiet",{name:a,when:Y(e.last_activity_at,s)});case"waiting_part":return i?k("sn_part_requester"):o?k("sn_part_handler",{eta:l}):k("sn_part",{name:a,eta:l});case"done":return Ja(e,t,a,i,o,s);case"returned":return ei(e,a,i);case"closed":case"cancelled":return ti(e,i,s);default:return ze(e.status)}}const vt=["send_failed","link_expired","code_locked","contact_changed","user_inactive","stuck","late_reply","reply","question"],ai=["unassigned","overdue","unopened","ack","stuck","waiting"];function ii(e){const t=e.events??[],s=t.filter(o=>["status","assigned","reassigned","returned","reopened","closed","cancelled"].includes(o.kind)).at(-1)?.at??"",a=t.filter(o=>o.kind==="reminder"&&o.at>=s).length;if(e.stuck)return{kind:e.stuck.kind,since:e.stuck.since,reminders:e.stuck.reminders??a};const i=t.filter(o=>o.kind==="stuck"&&o.at>=s).at(-1);return i?{kind:String(i.data?.kind??"stuck"),since:i.at,reminders:a}:null}function ni(e,t="manager"){if(t!=="manager"&&t!=="approver"||e.status==="closed"||e.status==="cancelled")return null;const s=[],a=e.waiting_reason,i=(l,d)=>s.push({key:l,text:k(d),tone:"bad"});a==="send_failed"&&i("send_failed","w_send_failed"),a==="link_expired"&&i("link_expired","w_link_expired"),a==="code_locked"&&i("code_locked","w_code_locked"),a==="contact_changed"&&s.push({key:"contact_changed",text:k("w_contact_changed"),tone:"warn"}),a==="user_inactive"&&i("user_inactive","w_user_inactive");const o=ii(e);if(o){const l=ai.includes(o.kind)?Xe(`r_${o.kind}`):Xe("r_stuck"),d=l.charAt(0).toUpperCase()+l.slice(1),c=o.reminders>1?k("w_stuck_reminders",{reason:d,n:o.reminders}):o.reminders===1?k("w_stuck_reminder",{reason:d}):k("w_stuck",{reason:d});s.push({key:"stuck",text:c,tone:"warn"})}return a==="late_reply"&&s.push({key:"late_reply",text:k("w_late_reply"),tone:"warn"}),a==="question"&&s.push({key:"question",text:k("w_question"),tone:"warn"}),a==="reply"&&s.push({key:"reply",text:k("w_reply"),tone:"warn"}),s.sort((l,d)=>vt.indexOf(l.key)-vt.indexOf(d.key)),s[0]??null}const oi=24*36e5;function Vt(e,t=new Date){const s={badge:null,row:""};if(!e.sla||e.status==="done"||e.status==="closed"||e.status==="cancelled")return s;const a=[e.sla.ack_due_at,e.sla.stuck_due_at,e.sla.resolve_due_at].map(o=>o?Date.parse(o):NaN).filter(o=>!Number.isNaN(o));if(!a.length)return s;const i=Math.min(...a)-t.getTime();return i<0?{badge:{text:k("slaOver",{dur:Ie(-i)}),tone:"bad"},row:""}:i<oi?{badge:{text:k("slaNear",{dur:Ie(i)}),tone:"warn"},row:""}:{badge:null,row:k("slaFar",{dur:Ie(i)})}}const Ve=F`
  ${Rt}
  .claims {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .claim {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: var(--sw-r-xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    min-inline-size: 0;
  }
  .claim.high {
    border-color: color-mix(in srgb, var(--dv-warning) 55%, transparent);
  }
  .ch {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    min-inline-size: 0;
  }
  .ch .who {
    font-weight: 700;
    overflow-wrap: anywhere;
    min-inline-size: 0;
  }
  .ch .sp {
    flex: 1;
  }
  .amt {
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
    white-space: nowrap;
  }
  .kv {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 16px;
    margin: 0;
    font-size: var(--sw-fs-base);
  }
  .kv dt {
    color: var(--dv-text-2);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .kv dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
    text-align: end;
    white-space: nowrap;
  }
  .kv .tot {
    font-weight: 700;
    color: var(--dv-text);
    border-block-start: 1px solid var(--dv-border);
    padding-block-start: 4px;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .meta .late {
    color: var(--dv-danger);
    font-weight: 600;
  }
  .docs {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .doc {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    padding: 8px 10px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
    min-inline-size: 0;
  }
  .doc .dl {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-base);
    font-weight: 600;
    min-inline-size: 0;
  }
  .doc .dl small {
    color: var(--dv-text-3);
    font-weight: 500;
  }
  .doc .sp {
    flex: 1;
  }
  .thumbs {
    display: flex;
    gap: 6px;
  }
  .thumb {
    inline-size: 44px;
    block-size: 56px;
    padding: 0;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    overflow: hidden;
    cursor: zoom-in;
  }
  .thumb img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb[aria-current='true'] {
    outline: 2px solid var(--dv-accent);
    outline-offset: 1px;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .reqrow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    font-size: var(--sw-fs-base);
  }
  .reqrow .lbl {
    color: var(--dv-text-2);
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .reqrow sw-segmented {
    margin-inline-start: auto;
  }
  details.hist {
    border-block-start: 1px solid var(--dv-border);
    padding-block-start: 8px;
  }
  details.hist summary {
    cursor: pointer;
    min-block-size: 36px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-base);
    font-weight: 600;
    color: var(--dv-text-2);
  }
  .hist ol {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .hist li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-inline-start: 10px;
    border-inline-start: 2px solid var(--dv-border);
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    overflow-wrap: anywhere;
  }
  .hist li b {
    color: var(--dv-text);
  }
  .hist li.dec {
    border-inline-start-color: var(--dv-accent);
  }
  .hist .why {
    white-space: pre-line;
    color: var(--dv-text);
  }
  .state {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    color: var(--dv-text-2);
    font-size: var(--sw-fs-base);
  }
  :host([data-skin='bubble']) .claim,
  :host([data-skin='bubble']) .doc {
    border-radius: var(--sw-r-md);
  }
  /* TKUI3: the payment demand against the approved quote (the baseline line, the exceptional lines, the difference) */
  .vsq {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-block-start: 8px;
    border-block-start: 1px dashed var(--dv-border);
    font-size: var(--sw-fs-sm);
  }
  .vline {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: var(--dv-text-2);
  }
  .vline.delta {
    font-weight: 700;
    color: var(--dv-text);
  }
  .vline.delta.warn .num {
    color: var(--au-warn-text);
  }
  .exc {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .exc li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    color: var(--au-warn-text);
  }
  .exc .el {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .exc .el svg {
    inline-size: 14px;
    block-size: 14px;
  }
  .num {
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
    white-space: nowrap;
  }
  /* TKLAYFIX: the title, its sub-line and the on-behalf button wrap to a second row on a narrow drawer instead of crossing the panel */
  .sect[data-cost-section] > h4 {
    flex-wrap: wrap;
  }
  .sect[data-embedded] > h4 .muted {
    font-weight: 500;
    color: var(--dv-text-3);
  }
`,We=F`
  .lines {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .line {
    display: grid;
    grid-template-columns: minmax(96px, 0.8fr) minmax(0, 2fr) repeat(2, minmax(72px, 1fr)) auto;
    align-items: end;
    gap: 8px;
    padding: 10px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
  }
  .line .fld {
    min-inline-size: 0;
  }
  .line .fld > span {
    font-size: var(--sw-fs-sm);
  }
  .line .lt {
    grid-column: 1 / -2;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  .line .rmv {
    align-self: center;
  }
  .line[aria-invalid='true'] {
    border-color: color-mix(in srgb, var(--dv-danger) 55%, transparent);
  }
  .preview {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 16px;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
    font-size: var(--sw-fs-base);
    font-variant-numeric: tabular-nums;
  }
  .preview dt {
    color: var(--dv-text-2);
  }
  .preview dd {
    margin: 0;
    text-align: end;
    unicode-bidi: isolate;
  }
  .preview .tot {
    font-weight: 700;
    color: var(--dv-text);
  }
  .files {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .files .frow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-base);
    min-inline-size: 0;
  }
  .files .frow span {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pick-file {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .pick-file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .viewer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-inline-size: 0;
  }
  .stage {
    display: grid;
    place-items: center;
    overflow: auto;
    block-size: min(62vh, 640px);
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
  }
  .stage img {
    max-inline-size: 100%;
    max-block-size: 100%;
    transform-origin: center;
    transition: transform var(--mm-motion, 0.2s) var(--mm-ease, ease);
    box-shadow: var(--dv-shadow-1);
  }
  .vbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .vbar .sp {
    flex: 1;
  }
  .vbar .pg {
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
    font-variant-numeric: tabular-nums;
  }
  .gate {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  @media (max-width: 767px) {
    .line {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .line .fld.wide {
      grid-column: 1 / -1;
    }
    .line .lt {
      grid-column: 1 / 2;
    }
    .stage {
      block-size: 52vh;
    }
  }
`;var ri=Object.defineProperty,li=Object.getOwnPropertyDescriptor,E=(e,t,s,a)=>{for(var i=a>1?void 0:a?li(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&ri(t,s,i),i};const gt=[1,1.5,2,3],di={approve:"approve",reject:"reject",markPaid:"mark-paid",unmarkPaid:"unmark-paid",reopen:"reopen-window",adjust:"adjust"};let T=class extends ie{constructor(){super(...arguments),this.bubbleSkin=new ne(this),this.ticket=null,this.costs=null,this.embedded=!1,this.data=null,this.failed="",this.busy=!1,this.dialog=null,this.flash=null,this.reason="",this.internalNote="",this.payRef="",this.payDate=Re(),this.lines=[],this.form=null,this.uploading=0,this.err="",this.tried=!1,this.page=0,this.zoom=0,this.turn=0,this.loadedKey="",this.flashTimer=0,this.offNames=null,this.onDialogClose=e=>{e.stopPropagation(),this.close()}}connectedCallback(){super.connectedCallback(),le(this),this.offNames=Ee(()=>this.requestUpdate())}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.flashTimer),this.offNames?.()}willUpdate(e){if(this.embedded){e.has("costs")&&(this.data=this.costs);return}if(!e.has("ticket"))return;const t=this.ticket,s=t?.cost?.can_view?`${t.id}|${t.revision}|${t.cost.status}`:"";s&&s!==this.loadedKey?(this.loadedKey.startsWith(`${t?.id}|`)||(this.data=null),this.loadedKey=s,this.load()):s||(this.loadedKey="",this.data=null)}async load(){if(this.embedded){this.dispatchEvent(new CustomEvent("cost-reload",{bubbles:!0,composed:!0}));return}const e=this.ticket?.id;if(e){this.failed="";try{const t=await U().get(e);e===this.ticket?.id&&(this.data=t)}catch(t){e===this.ticket?.id&&(this.failed=N(t))}}}say(e,t="ok"){this.flash={text:e,tone:t},window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.flash=null,t==="bad"?7e3:3500)}claim(e){return this.data?.claims.find(t=>t.id===e)}currentRev(e){return e.revisions?.find(t=>t.id===e.current_revision_id)}uiLang(){return ke()}money(e,t){return De(e,t,this.uiLang())}async write(e,t){if(this.busy)return!1;this.busy=!0,this.err="";try{const s=await e(),{message_draft:a,...i}=s;return this.data=i,this.dispatchEvent(new CustomEvent("cost-changed",{detail:{costs:this.data},bubbles:!0,composed:!0})),t&&this.embedded?this.dispatchEvent(new CustomEvent("cost-draft",{detail:{draft:a,decision:Cs(t)},bubbles:!0,composed:!0})):this.say(p("saved")),!0}catch(s){return s instanceof j&&s.status===409&&s.body.code==="claim_stale"?(this.err=p("stale"),await this.load()):this.err=N(s),!1}finally{this.busy=!1}}open(e){if(this.reason="",this.internalNote="",this.payRef="",this.payDate=Re(),this.err="",this.tried=!1,this.page=0,this.zoom=0,this.turn=0,e.kind==="adjust"){const t=this.claim(e.claimId),s=t?this.currentRev(t):void 0;this.lines=s?.lines.length?s.lines.map(va):[ae("labor",t?.labor_rate_minor)]}if(e.kind==="onBehalf"){const t=this.onBehalfIds(),s=this.data?.claims.find(a=>a.assignment_id===t.at(-1));this.form={assignment:t.at(-1)??"",currency:s?.currency??this.data?.settings?.currencies[0]??"ILS",include:!1,noCharge:!1,vendorRef:"",notes:"",docs:[]},this.lines=[ae("labor",s?.labor_rate_minor)]}this.dialog=e}close(){this.dialog=null,this.form=null}async submitSimple(e,t,s){this.tried=!0;const a={revision:t.revision??1};if((e==="approve"||e==="reject")&&(a.revision_id=t.current_revision_id??void 0),e==="approve"&&s&&(a.exceptional=s),e==="reject"||e==="unmarkPaid"){if(!this.reason.trim())return;a.reason=this.reason.trim()}if((e==="approve"||e==="reject")&&this.internalNote.trim()&&(a.internal_note=this.internalNote.trim()),e==="markPaid"){if(!this.payRef.trim()||!this.payDate)return;a.payment_ref=this.payRef.trim(),a.payment_date=this.payDate}const i=this.ticket?.id??"",o=e==="approve"||e==="reject"?e:void 0;await this.write(()=>U().decide(i,t.id,di[e],a),o)&&this.close()}async submitAdjust(e){if(this.tried=!0,!this.reason.trim()||!this.lines.length||this.lines.some(a=>pe(a)))return;const t=this.ticket?.id??"",s={revision:e.revision??1,revision_id:e.current_revision_id??void 0,reason:this.reason.trim(),lines:this.lines.map(ct)};this.internalNote.trim()&&(s.internal_note=this.internalNote.trim()),await this.write(()=>U().decide(t,e.id,"adjust",s),"adjust")&&this.close()}async submitOnBehalf(){const e=this.form;if(!e||(this.tried=!0,!e.noCharge&&(!this.lines.length||this.lines.some(i=>pe(i))))||this.uploading)return;const t=this.ticket?.id??"",s=!!this.data?.claims.find(i=>i.assignment_id===e.assignment)?.vat_exempt;await this.write(()=>U().onBehalf(t,{...e.assignment?{assignment_id:e.assignment}:{},lines:e.noCharge?[]:this.lines.map(ct),currency:e.currency,...s||e.noCharge?{}:{amounts_include_vat:e.include},...e.vendorRef.trim()?{vendor_ref:e.vendorRef.trim()}:{},...e.notes.trim()?{notes:e.notes.trim()}:{},no_charge:e.noCharge,documents:e.docs.map(i=>({file_ids:i.files.map(o=>o.id)}))}))&&this.close()}async onFiles(e){const t=e.target,s=[...t.files??[]];t.value="";const a=this.form,i=this.ticket?.id;if(!a||!i||!s.length)return;const o=s.filter(m=>m.type==="application/pdf"||/\.pdf$/i.test(m.name)),l=s.filter(m=>!o.includes(m)),d=o.length+(l.length?1:0);if(a.docs.length+d>3){this.err=p("tooManyDocs");return}if(l.length>10){this.err=p("tooManyPages");return}this.err="";const c=async m=>{this.uploading+=1;try{const v=await U().uploadFile(i,m);return{id:v.id,name:m.name,bytes:v.bytes}}finally{this.uploading-=1}};try{const m=[];for(const v of o)m.push({kind:"pdf",files:[await c(v)]});if(l.length){const v=[];for(const $ of l)v.push(await c($));m.push({kind:"photo",files:v})}this.form&&(this.form={...this.form,docs:[...this.form.docs,...m]})}catch(m){this.err=N(m)}}async setRequirement(e,t){const s=this.ticket?.id??"";!await this.write(()=>U().setRequirement(s,e,t))&&this.err&&(this.say(this.err,"bad"),this.err="")}async download(e){try{await e()}catch(t){this.say(N(t),"bad")}}onBehalfIds(){const e=(this.data?.external_assignments??[]).filter(Ts);return ga(this.data?.claims??[],e,this.ticket?.cost)}statusChip(e,t="data-cost-status"){const s=$a(e);return n`<span class=${`chip ${s}`} ${t==="data-claim-chip"?"data-claim-chip":""} data-cost-status=${e}>${p(`cs_${e}`)}</span>`}breakdown(e){const t=Fe.filter(a=>e[`${a}_minor`]>0),s=e.vat_mode==="none"?p("vatNone"):p("vatAt",{rate:Ne(e.vat_rate_bp)});return n`<dl class="kv" data-breakdown>
      ${t.map(a=>n`<dt>${p(`k_${a}`)}</dt><dd data-kind=${a}>${this.money(e[`${a}_minor`],e.currency)}</dd>`)}
      <dt>${p("net")}</dt><dd data-net>${this.money(e.net_minor,e.currency)}</dd>
      <dt>${s}</dt><dd data-vat>${this.money(e.vat_minor,e.currency)}</dd>
      <dt class="tot">${p("total")}</dt><dd class="tot" data-total>${this.money(e.total_minor,e.currency)}</dd>
      ${e.vendor_ref?n`<dt>${p("vendorRef")}</dt><dd data-vendor-ref>${x(e.vendor_ref)}</dd>`:r}
    </dl>`}documents(e,t){if(!t.documents.length)return r;const s=this.ticket?.id??"";return n`<div class="docs" data-documents>${t.documents.map(a=>this.docRow(s,e,t,a))}</div>`}docRow(e,t,s,a){if(a.kind==="pdf"){const o=a.pages[0];return n`<div class="doc" data-doc=${a.no} data-doc-kind="pdf">
        <span class="dl">${y("file")}${p("docN",{n:a.no})}<small>${p("pdf")} · ${pt(o?.bytes??0)}</small></span><span class="sp"></span>
        <button type="button" class="btn sm" data-pdf-download ?disabled=${!o} @click=${()=>o&&void this.download(()=>U().downloadFile(e,o.id))}>${y("download")}${p("download")}</button>
      </div>`}const i=U();return n`<div class="doc" data-doc=${a.no} data-doc-kind="photo">
      <span class="dl">${y("pages")}${p("docN",{n:a.no})}<small>${p("pagesN",{n:a.pages.length})}</small></span>
      <span class="thumbs">${a.pages.slice(0,3).map((o,l)=>n`<button type="button" class="thumb" data-thumb=${l} aria-label=${p("pageAlt",{n:l+1})}
        @click=${()=>{this.open({kind:"viewer",claimId:t.id,revisionId:s.id,docNo:a.no}),this.page=l}}><img src=${i.pageUrl(e,o.id)} alt="" loading="lazy" decoding="async" /></button>`)}</span>
      <span class="sp"></span>
      <button type="button" class="btn sm quiet" data-doc-open @click=${()=>this.open({kind:"viewer",claimId:t.id,revisionId:s.id,docNo:a.no})}>${p("open")}</button>
      <button type="button" class="btn sm" data-doc-pdf @click=${()=>void this.download(()=>i.downloadDocument(e,t.id,s.id,a.no))}>${y("download")}${p("downloadPdf")}</button>
    </div>`}history(e){const t=e.revisions??[],s=e.decisions??[];if(!t.length&&!s.length)return r;const a=[...t.map(i=>{const o=i.kind==="adjustment"?p("src_adjustment"):i.kind==="on_behalf"?p("src_on_behalf"):p("src_vendor"),l=i.created_by_name?` · ${i.created_by_name}`:"";return{at:i.created_at,dec:!1,tpl:n`<li data-hist-rev=${i.seq}><span><b>${p("revN",{n:i.seq})}</b> · ${o}${x(l)} · ${M(i.created_at)}</span>
          <span>${i.no_charge?p("noCharge"):this.money(i.total_minor,i.currency)}</span>${i.reason?n`<span class="why">${i.reason}</span>`:r}</li>`}}),...s.map(i=>({at:i.at,dec:!0,tpl:n`<li class="dec" data-hist-dec=${i.action}><span><b>${p(`d_${i.action}`)}</b>${i.by?n` · ${x(i.by)}`:r} · ${M(i.at)}</span>
        ${i.amount_minor!==null&&(i.action==="approve"||i.action==="adjust")?n`<span>${this.money(i.amount_minor,e.currency)}</span>`:r}
        ${i.payment_ref?n`<span>${p("paymentRef")}: ${x(i.payment_ref)}</span>`:r}
        ${i.reason&&i.action!=="requirement"?n`<span class="why">${i.reason}</span>`:i.action==="requirement"&&i.reason?n`<span>${p(`m_${i.reason}`)}</span>`:r}</li>`}))].sort((i,o)=>o.at.localeCompare(i.at));return n`<details class="hist" data-history><summary>${y("refresh")}${p("history")} (${a.length})</summary><ol>${a.map(i=>i.tpl)}</ol></details>`}againstQuote(e,t){const s=t?.exceptional??[];if(!e.baseline&&!s.length)return r;const a=t?.currency??e.currency,i=e.quote_check;return n`<div class="vsq" data-against-quote>
      ${e.baseline?n`<div class="vline" data-claim-baseline=${e.baseline.quote_id}><span>${h("againstQuote",{n:e.baseline.version,total:this.money(e.baseline.total_minor,e.baseline.currency)})}</span></div>`:r}
      ${i?.basis==="instalment"?n`<div class="vline" data-claim-instalment=${i.instalment_index??""}><span>${h("qcInstalment",{n:(i.instalment_index??0)+1,total:this.money(i.basis_minor,i.currency)})}</span></div>`:r}
      ${i?.status==="differs"?n`<div class="vline" data-quote-check="differs"><span class="chip warn">${y("warning")}${h("qcDiffers")}</span>
        <span>${i.flags.map(o=>h(`qc_${o}`)).join(" · ")}</span></div>`:r}
      ${i?.above_reason?n`<div class="vline" data-quote-check-reason><span>${h("qcReason")}</span><span class="why">${i.above_reason}</span></div>`:r}
      ${s.length?n`<ul class="exc" aria-label=${h("exceptional")} data-exceptional>${s.map(o=>n`<li data-exc=${o.index} data-exc-kind=${o.kind} data-exc-review=${o.review??"none"}>
        <span class="el">${y("warning")}${x([p(`k_${o.kind}`),o.description].filter(Boolean).join(" · "))}
          <span class=${`chip ${o.review==="pending"?"warn":o.review==="excluded"?"":o.review==="accepted"?"ok":"warn"}`}>${h(o.review?`exc_${o.review}`:`exc_${o.reason}`)}</span></span>
        <span class="num">${this.money(o.total_minor,a)}</span></li>`)}</ul>`:r}
      ${e.delta_minor!==null&&e.delta_minor!==void 0?n`<div class=${`vline delta ${Ns(e.delta_minor)}`} data-claim-delta=${e.delta_minor}><span>${h("delta")}</span>
        <span class="num">${Ss(e.delta_minor,o=>this.money(o,a))}</span></div>`:r}
    </div>`}claimBlock(e,t){const s=this.currentRev(e),a=ba(e,this.ticket?.cost),i=this.embedded,o=[e.vendor,e.contact_name].filter(Boolean).join(" · "),l=(e.status==="awaiting"||e.status==="rejected")&&!e.window_open;return n`<div class=${`claim${e.high_amount?" high":""}`} data-claim=${e.id} data-claim-status=${e.status}>
      <div class="ch">
        ${o?n`<span class="who">${x(o)}</span>`:r}
        ${t?this.statusChip(e.status):r}
        ${e.instalment_index!==null&&e.instalment_index!==void 0?n`<span class="chip" data-claim-instalment-n=${e.instalment_index}>${h("qcPaymentN",{n:e.instalment_index+1})}</span>`:r}
        ${e.high_amount?n`<span class="chip warn" data-high-amount>${y("warning")}${p("highAmount")}</span>`:r}
        ${e.no_charge?n`<span class="chip" data-no-charge>${p("noCharge")}</span>`:r}
        <span class="sp"></span>
        ${e.total_minor!==null&&e.total_minor!==void 0?n`<span class="amt" data-claim-total>${this.money(e.total_minor,e.currency)}</span>`:r}
      </div>
      ${s&&!e.no_charge?this.breakdown(s):r}
      ${this.againstQuote(e,s)}
      <div class="meta">
        ${e.status==="awaiting"||e.status==="rejected"?n`<span class=${l?"late":""} data-window>${l?p("windowClosed"):p("until",{when:M(e.claim_until)})}</span>`:r}
        ${e.approved_at?n`<span data-approved>${p("approvedBy",{when:M(e.approved_at),who:e.approved_by??""})}</span>`:r}
        ${e.status==="paid"?n`<span data-paid>${p("paidOn",{date:ls(e.payment_date)||(e.payment_date??""),ref:e.payment_ref??""})}</span>`:r}
      </div>
      ${s?this.documents(e,s):r}
      ${Object.values(a).some(Boolean)?n`<div class="acts" data-claim-actions>
        ${a.approve?n`<button type="button" class="btn sm primary" data-cost-approve ?disabled=${this.busy} @click=${()=>this.open({kind:"approve",claimId:e.id})}>${y("check")}${i?h(e.needs_review?"approveWithExc":"approveDemand"):p("approve")}</button>`:r}
        ${a.approve&&i&&e.needs_review?n`<button type="button" class="btn sm" data-cost-approve-noexc ?disabled=${this.busy} @click=${()=>this.open({kind:"approve",claimId:e.id})}>${y("check")}${h("approveNoExc")}</button>`:r}
        ${a.adjust?n`<button type="button" class="btn sm" data-cost-adjust ?disabled=${this.busy} @click=${()=>this.open({kind:"adjust",claimId:e.id})}>${y("edit")}${p("adjust")}</button>`:r}
        ${a.reject?n`<button type="button" class="btn sm quiet dz" data-cost-reject ?disabled=${this.busy} @click=${()=>this.open({kind:"reject",claimId:e.id})}>${y(i?"refresh":"x")}${i?h("fixDemand"):p("reject")}</button>`:r}
        ${a.markPaid?n`<button type="button" class="btn sm primary" data-cost-paid ?disabled=${this.busy} @click=${()=>this.open({kind:"markPaid",claimId:e.id})}>${y("paid")}${p("markPaid")}</button>`:r}
        ${a.unmarkPaid?n`<button type="button" class="btn sm quiet" data-cost-unpaid ?disabled=${this.busy} @click=${()=>this.open({kind:"unmarkPaid",claimId:e.id})}>${y("undo")}${p("unmarkPaid")}</button>`:r}
        ${a.reopen?n`<button type="button" class="btn sm" data-cost-reopen ?disabled=${this.busy} @click=${()=>this.open({kind:"reopen",claimId:e.id})}>${y("refresh")}${p("reopen")}</button>`:r}
      </div>`:r}
      ${this.history(e)}
    </div>`}requirementRows(){const e=this.data,t=this.ticket?.cost;if(this.embedded||!e||!t?.can_set_requirement)return r;const s=(e.external_assignments??[]).filter(a=>!a.ended_at&&Lt(a.id,e.claims,t));return s.length?n`${s.map(a=>n`<div class="reqrow" data-requirement=${a.id}><span class="lbl">${p("mode")} · ${x(a.name)}</span>
      <sw-segmented radio size="sm" label=${`${p("mode")} · ${a.name}`} value=${a.cost_claim??""} ?disabled=${this.busy}
        @change=${i=>{const o=i.detail.value;a.cost_claim!==o&&this.setRequirement(a.id,o)}}
        .options=${qs.map(i=>({value:i,label:p(`m_${i}`),attrs:{"data-requirement-mode":i}}))}></sw-segmented></div>`)}`:r}reasonField(e=p("reason"),t=!1){const s=this.tried&&!this.reason.trim();return n`<label class="fld"><span>${e} <b class="req">*</b>${t?n` <span class="muted" data-cost-reason-public>· ${p("vendorSees")}</span>`:r}</span>
      <textarea class="inp" maxlength="500" data-cost-reason aria-invalid=${String(s)} .value=${this.reason} @input=${a=>{this.reason=a.target.value,this.err=""}}></textarea>
      ${s?n`<span class="err">${p("required")}</span>`:r}</label>${t?this.internalNoteField():r}`}internalNoteField(){return n`<label class="fld"><span>${p("internalNote")}</span>
      <textarea class="inp" maxlength="500" data-cost-internal-note .value=${this.internalNote} @input=${e=>this.internalNote=e.target.value}></textarea></label>`}foot(e){return n`<div slot="footer" class="sheetfoot">${e}<button type="button" class="btn" data-dialog-cancel @click=${()=>this.close()}>${p("back")}</button></div>`}errRow(){return this.err?n`<div class="err" role="alert" data-cost-error>${this.err}</div>`:r}setLine(e,t){this.lines=this.lines.map((s,a)=>a===e?{...s,...t}:s),this.err=""}lineEditor(e,t){const s=(a,i,o,l,d,c=!1)=>{const m=this.tried&&pe(i)===o;return n`<label class=${`fld${c?" wide":""}`}><span>${l}</span><input class="inp" inputmode=${d} maxlength=${o==="description"?120:12} data-line-field=${o}
        dir=${d==="decimal"?"ltr":"auto"} aria-invalid=${String(m)} .value=${i[o]} @input=${v=>this.setLine(a,{[o]:v.target.value})} /></label>`};return n`<div class="lines" data-lines>
      ${this.lines.map((a,i)=>{const o=At(a),l=this.tried&&!!pe(a);return n`<div class="line" data-line=${i} data-line-kind=${a.kind} aria-invalid=${String(l)}>
          <label class="fld"><span>${p("lineKind")}</span><select class="inp" data-line-kind-select @change=${d=>{const c=d.target.value;this.lines=this.lines.map((m,v)=>v===i?{...ae(c,t),description:m.description}:m)}}>
            ${Fe.map(d=>n`<option value=${d} ?selected=${d===a.kind}>${p(`k_${d}`)}</option>`)}</select></label>
          ${s(i,a,"description",p("description"),"text",!0)}
          ${a.kind==="labor"?n`${s(i,a,"hours",p("hours"),"decimal")}${s(i,a,"rate",p("rate"),"decimal")}`:a.kind==="parts"?n`${s(i,a,"quantity",p("quantity"),"decimal")}${s(i,a,"unit_price",p("unitPrice"),"decimal")}`:n`${s(i,a,"amount",p("amount"),"decimal")}<span></span>`}
          <button type="button" class="btn sm quiet rmv" aria-label=${p("removeLine")} data-line-remove ?disabled=${this.lines.length<2} @click=${()=>this.lines=this.lines.filter((d,c)=>c!==i)}>${y("x")}</button>
          <span class="lt" data-line-total>${p("lineTotal")}: ${o===null?"—":this.money(o,e)}</span>
        </div>`})}
      <div><button type="button" class="btn sm" data-line-add ?disabled=${this.lines.length>=30} @click=${()=>this.lines=[...this.lines,ae("parts",t)]}>${y("plus")}${p("addLine")}</button></div>
    </div>`}preview(e,t,s){const a=Ft(this.lines,e,t),i=o=>a&&o!==void 0?this.money(o,s):"—";return n`<dl class="preview" data-preview>
      <dt>${p("net")}</dt><dd data-preview-net>${i(a?.net)}</dd>
      <dt>${e==="none"?p("vatNone"):p("vatAt",{rate:Ne(t)})}</dt><dd data-preview-vat>${i(a?.vat)}</dd>
      <dt class="tot">${p("total")}</dt><dd class="tot" data-preview-total>${i(a?.total)}</dd>
    </dl>`}viewer(e){const t=this.claim(e.claimId),s=t?.revisions?.find(v=>v.id===e.revisionId),a=s?.documents.find(v=>v.no===e.docNo),i=this.ticket?.id??"",o=a?.pages??[],l=Math.min(this.page,Math.max(0,o.length-1)),d=o[l],c=U(),m=`rotate(${this.turn*90}deg) scale(${gt[this.zoom]})`;return n`<sw-dialog open wide heading=${p("docN",{n:e.docNo})} data-dialog="cost-viewer" @close=${this.onDialogClose}>
      <div class="viewer">
        <div class="vbar">
          <button type="button" class="btn sm quiet" aria-label=${p("prev")} data-viewer-prev ?disabled=${l<=0} @click=${()=>this.page=l-1}>${y("prev")}</button>
          <span class="pg" data-viewer-page>${p("pageOf",{n:l+1,m:o.length})}</span>
          <button type="button" class="btn sm quiet" aria-label=${p("next")} data-viewer-next ?disabled=${l>=o.length-1} @click=${()=>this.page=l+1}>${y("next")}</button>
          <span class="sp"></span>
          <button type="button" class="btn sm quiet" aria-label=${p("zoomOut")} data-viewer-zoom-out ?disabled=${this.zoom===0} @click=${()=>this.zoom-=1}>${y("zoomOut")}</button>
          <button type="button" class="btn sm quiet" aria-label=${p("zoomIn")} data-viewer-zoom-in ?disabled=${this.zoom===gt.length-1} @click=${()=>this.zoom+=1}>${y("zoomIn")}</button>
          <button type="button" class="btn sm quiet" aria-label=${p("rotate")} data-viewer-rotate @click=${()=>this.turn=(this.turn+1)%4}>${y("rotate")}</button>
        </div>
        <div class="stage" data-viewer-stage>${d?n`<img src=${c.pageUrl(i,d.id)} alt=${p("pageAlt",{n:l+1})} data-viewer-img data-turn=${this.turn*90} style=${ds({transform:m})} />`:r}</div>
        ${o.length>1?n`<div class="thumbs" role="tablist">${o.map((v,$)=>n`<button type="button" class="thumb" role="tab" aria-selected=${String($===l)} aria-current=${String($===l)} aria-label=${p("pageAlt",{n:$+1})} @click=${()=>this.page=$}>
          <img src=${c.pageUrl(i,v.id)} alt="" loading="lazy" decoding="async" /></button>`)}</div>`:r}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn primary" data-viewer-pdf ?disabled=${!t||!s} @click=${()=>t&&s&&void this.download(()=>c.downloadDocument(i,t.id,s.id,e.docNo))}>${y("download")}${p("downloadPdf")}</button>
        <button type="button" class="btn" data-dialog-cancel @click=${()=>this.close()}>${p("back")}</button>
      </div>
    </sw-dialog>`}onBehalfDialog(){const e=this.form,t=this.data;if(!e||!t)return r;const s=c=>{this.form={...e,...c},this.err=""},a=(t.external_assignments??[]).filter(c=>this.onBehalfIds().includes(c.id)),i=t.claims.find(c=>c.assignment_id===e.assignment),o=!!i?.vat_exempt,l=t.settings?.currencies??["ILS"],d=t.settings?.vat_rate_bp??1800;return n`<sw-dialog open wide heading=${p("onBehalfTitle")} data-dialog="cost-on-behalf" @close=${this.onDialogClose}>
      <div class="form">
        ${a.length>1?n`<label class="fld"><span>${p("assignment")}</span><select class="inp" data-ob-assignment @change=${c=>s({assignment:c.target.value})}>
          ${a.map(c=>n`<option value=${c.id} ?selected=${c.id===e.assignment}>${c.name}</option>`)}</select></label>`:r}
        <div class="two">
          ${l.length>1?n`<label class="fld"><span>${p("currency")}</span><select class="inp" data-ob-currency @change=${c=>s({currency:c.target.value})}>
            ${l.map(c=>n`<option value=${c} ?selected=${c===e.currency}>${c}</option>`)}</select></label>`:r}
          ${!o&&!e.noCharge?n`<div class="fld"><span>${p("vatToggle")}</span><sw-segmented radio size="sm" label=${p("vatToggle")} value=${e.include?"included":"excluded"} @change=${c=>s({include:c.detail.value==="included"})}
            .options=${[{value:"excluded",label:p("amountsExcl"),attrs:{"data-ob-vat":"excluded"}},{value:"included",label:p("amountsIncl"),attrs:{"data-ob-vat":"included"}}]}></sw-segmented></div>`:r}
        </div>
        <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${p("noCharge")} data-ob-no-charge .checked=${e.noCharge} @change=${c=>s({noCharge:X(c)})}></sw-toggle>${p("noCharge")}</label>
        ${e.noCharge?r:n`${this.lineEditor(e.currency,i?.labor_rate_minor)}${this.preview(jt(o,e.include,!1),d,e.currency)}`}
        <div class="two">
          <label class="fld"><span>${p("invoiceNo")}</span><input class="inp" maxlength="40" dir="auto" data-ob-ref .value=${e.vendorRef} @input=${c=>s({vendorRef:c.target.value})} /></label>
        </div>
        <label class="fld"><span>${p("notes")}</span><textarea class="inp" maxlength="1000" data-ob-notes .value=${e.notes} @input=${c=>s({notes:c.target.value})}></textarea></label>
        <div class="files" data-ob-files>
          ${e.docs.map((c,m)=>n`<div class="frow" data-ob-doc=${m}>${y(c.kind==="pdf"?"file":"pages")}<span>${p("docN",{n:m+1})} · ${c.kind==="pdf"?`${p("pdf")} · ${pt(c.files[0]?.bytes??0)}`:p("pagesN",{n:c.files.length})}</span>
            <button type="button" class="btn sm quiet" data-ob-doc-remove @click=${()=>s({docs:e.docs.filter((v,$)=>$!==m)})}>${p("removeFile")}</button></div>`)}
          ${e.docs.length<3?n`<label class="btn sm pick-file" data-ob-attach>${y(this.uploading?"refresh":"attach")}<span>${this.uploading?p("uploading"):p("attach")}</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png" multiple ?disabled=${this.uploading>0} aria-label=${p("attach")} data-ob-file @change=${this.onFiles} /></label>`:r}
        </div>
        ${this.errRow()}
      </div>
      ${this.foot(n`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy||this.uploading>0} @click=${()=>void this.submitOnBehalf()}>${y("check")}${p("save")}</button>`)}
    </sw-dialog>`}dialogs(){const e=this.dialog;if(!e)return r;if(e.kind==="viewer")return this.viewer(e);if(e.kind==="onBehalf")return this.onBehalfDialog();const t=this.claim(e.claimId);if(!t)return r;const s=this.currentRev(t),a=n`<div class="ch"><span class="who">${x([t.vendor,t.contact_name].filter(Boolean).join(" · "))}</span><span class="sp"></span><span class="amt">${this.money(t.total_minor,t.currency)}</span></div>`;if(e.kind==="adjust"){const $=s?.currency??t.currency??"ILS";return n`<sw-dialog open wide heading=${p("adjustTitle")} data-dialog="cost-adjust" @close=${this.onDialogClose}>
        <div class="form">${a}${this.lineEditor($,t.labor_rate_minor)}${this.preview(s?.vat_mode??"excluded",s?.vat_rate_bp??0,$)}${this.reasonField(p("reason"),!0)}${this.errRow()}</div>
        ${this.foot(n`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.submitAdjust(t)}>${y("check")}${p("adjust")}</button>`)}
      </sw-dialog>`}const i={approve:"approveTitle",reject:"rejectTitle",markPaid:"markPaidTitle",unmarkPaid:"unmarkPaidTitle",reopen:"reopenTitle"},o={approve:"approve",reject:"reject",markPaid:"markPaid",unmarkPaid:"unmarkPaid",reopen:"reopen"},l=this.tried&&!this.payRef.trim(),d=e.kind==="reject"?this.reasonField(p("reason"),!0):e.kind==="unmarkPaid"?this.reasonField():e.kind==="markPaid"?n`<div class="two">
          <label class="fld"><span>${p("paymentRef")} <b class="req">*</b></span><input class="inp" maxlength="60" dir="auto" data-pay-ref aria-invalid=${String(l)} .value=${this.payRef} @input=${$=>{this.payRef=$.target.value,this.err=""}} />${l?n`<span class="err">${p("required")}</span>`:r}</label>
          <label class="fld"><span>${p("paymentDate")} <b class="req">*</b></span><input class="inp" type="date" lang=${be()} max=${Re(new Date(Date.now()+864e5))} data-pay-date .value=${this.payDate} @input=${$=>this.payDate=$.target.value} /></label>
        </div>`:e.kind==="approve"&&s?n`${this.breakdown(s)}${this.againstQuote(t,s)}${this.internalNoteField()}`:r,c=this.embedded,m=c&&e.kind==="reject"?h("fixDemandTitle"):p(i[e.kind]),v=c&&e.kind==="reject"?h("fixDemand"):c&&e.kind==="approve"&&t.needs_review?h("approveWithExc"):p(o[e.kind]);return n`<sw-dialog open heading=${m} data-dialog=${`cost-${e.kind}`} @close=${this.onDialogClose}>
      <div class="form">${a}${d}${this.errRow()}</div>
      ${this.foot(n`<button type="button" class=${`btn ${e.kind==="reject"&&!c?"danger":"primary"}`} data-dialog-ok ?disabled=${this.busy}
          @click=${()=>void this.submitSimple(e.kind,t,e.kind==="approve"&&t.needs_review?"include":void 0)}>${v}</button>
        ${e.kind==="approve"&&t.needs_review?n`<button type="button" class="btn" data-dialog-ok-noexc ?disabled=${this.busy}
          @click=${()=>void this.submitSimple("approve",t,"exclude")}>${h("approveNoExc")}</button>`:r}`)}
    </sw-dialog>`}render(){const e=this.ticket,t=e?.cost;if(!e||!t)return r;const s=this.data,a=t.can_view&&!!s&&(s.claims.length>0||(s.external_assignments??[]).length>0);if(t.status==="not_required"&&!a&&!(t.can_view&&this.failed))return r;const i=this.onBehalfIds();if(this.embedded&&!s?.claims.length&&!(t.can_decide&&i.length))return r;const o=this.embedded?n`${h("demandTitle")}<span class="muted">${h("demandSub")}</span>`:n`${p("sCost")}${t.status!=="not_required"?this.statusChip(t.status):r}`;return n`<section class="sect" data-sect="cost" data-cost-section=${t.status} ?data-embedded=${this.embedded}>
      <h4><span class="tag">${y("coins")}</span>${o}<span class="sp"></span>
        ${t.can_decide&&s&&i.length?n`<button type="button" class="btn sm" data-cost-on-behalf ?disabled=${this.busy} @click=${()=>this.open({kind:"onBehalf"})}>${y("plus")}${p("onBehalf")}</button>`:r}
      </h4>
      ${this.flash?n`<div class=${`banner ${this.flash.tone==="bad"?"bad":"info"}`} role="status" data-cost-flash=${this.flash.tone}>${y(this.flash.tone==="bad"?"warning":"check")}<div>${this.flash.text}</div></div>`:r}
      ${t.can_view?this.failed?n`<div class="state" role="status" data-cost-state="error">${y("warning")}<span>${p("loadFailed")}</span><button type="button" class="btn sm" data-cost-retry @click=${()=>void this.load()}>${y("refresh")}${p("retry")}</button></div>`:s?n`<div class="claims">${J(s.claims,l=>l.id,l=>this.claimBlock(l,s.claims.length>1))}${this.requirementRows()}</div>`:n`<span class="skl" style="block-size:120px" data-cost-state="loading" aria-busy="true"></span>`:r}
      ${this.dialogs()}
    </section>`}};T.styles=[de,...re,ce,me,Ve,We];E([C({attribute:!1})],T.prototype,"ticket",2);E([C({attribute:!1})],T.prototype,"costs",2);E([C({type:Boolean})],T.prototype,"embedded",2);E([g()],T.prototype,"data",2);E([g()],T.prototype,"failed",2);E([g()],T.prototype,"busy",2);E([g()],T.prototype,"dialog",2);E([g()],T.prototype,"flash",2);E([g()],T.prototype,"reason",2);E([g()],T.prototype,"internalNote",2);E([g()],T.prototype,"payRef",2);E([g()],T.prototype,"payDate",2);E([g()],T.prototype,"lines",2);E([g()],T.prototype,"form",2);E([g()],T.prototype,"uploading",2);E([g()],T.prototype,"err",2);E([g()],T.prototype,"tried",2);E([g()],T.prototype,"page",2);E([g()],T.prototype,"zoom",2);E([g()],T.prototype,"turn",2);T=E([oe("ticket-cost-card")],T);const ge=encodeURIComponent,ci={decide:(e,t,s,a)=>Z(`tickets/${ge(e)}/quotes/${ge(t)}/${s}`,a),onBehalf:(e,t)=>Z(`tickets/${ge(e)}/quotes`,t),setMode:(e,t,s)=>Z(`tickets/${ge(e)}/quotes/requirement`,{assignment_id:t,mode:s}),setKinds:(e,t)=>It(`tickets/${ge(e)}/allowed-line-kinds`,{kinds:t})},pi=cs(()=>Mt(()=>import("./tickets-costs-mock-Cq1JwjxP.js").then(e=>e.t),__vite__mapDeps([0]),import.meta.url).then(e=>e.mockQuotes),{});function qe(){return ue()?ci:pi}var ui=Object.defineProperty,hi=Object.getOwnPropertyDescriptor,ee=(e,t,s,a)=>{for(var i=a>1?void 0:a?hi(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&ui(t,s,i),i};const Me={lines:"obLinesRequired",kind:"obLinesRequired",work_format:"obWorkFormat",work_range:"obWorkRange",work_order:"obWorkOrder",valid_format:"obValidFormat",valid_range:"obValidRange"};let V=class extends ie{constructor(){super(...arguments),this.bubbleSkin=new ne(this),this.ticketId="",this.costs=null,this.target=null,this.form=null,this.tried=!1,this.busy=!1,this.err="",this.offNames=null,this.close=e=>{e?.stopPropagation(),this.dispatchEvent(new CustomEvent("quote-form-close",{bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),le(this),this.offNames=Ee(()=>this.requestUpdate())}disconnectedCallback(){super.disconnectedCallback(),this.offNames?.()}willUpdate(e){if(this.form||!this.target||!this.costs||!e.has("target")&&!e.has("costs"))return;const t=this.costs.claims.find(s=>s.assignment_id===this.target?.assignmentId);this.form={assignment:this.target.assignmentId,currency:this.costs.settings?.currencies[0]??"ILS",include:!1,from:"",to:"",validUntil:"",note:"",lines:[ae("labor",t?.labor_rate_minor)]}}money(e,t){return De(e,t,ke())}set(e){this.form&&(this.form={...this.form,...e},this.err="")}setLine(e,t){this.form&&this.set({lines:this.form.lines.map((s,a)=>a===e?{...s,...t}:s)})}async save(){const e=this.form,t=this.costs;if(!e||!t||this.busy)return;this.tried=!0;const s=t.allowed_line_kinds?.kinds,a=Es(e,s);if(a){!a.startsWith("work_")&&!a.startsWith("valid_")&&(this.err=h(Me[a]));return}this.busy=!0,this.err="";try{const i=await qe().onBehalf(this.ticketId,Ds(e,{multiCurrency:(t.settings?.currencies.length??1)>1}));this.dispatchEvent(new CustomEvent("quote-entered",{detail:{answer:i},bubbles:!0,composed:!0}))}catch(i){this.err=i instanceof j&&i.code==="self_approval"?h("selfApproval"):N(i)}finally{this.busy=!1}}lineEditor(e,t,s){const a=(i,o,l,d,c,m=!1)=>{const v=this.tried&&pe(o)===l;return n`<label class=${`fld${m?" wide":""}`}><span>${d}</span><input class="inp" inputmode=${c} maxlength=${l==="description"?120:12} data-line-field=${l}
        dir=${c==="decimal"?"ltr":"auto"} aria-invalid=${String(v)} .value=${o[l]} @input=${$=>this.setLine(i,{[l]:$.target.value})} /></label>`};return n`<div class="lines" data-lines>
      ${e.lines.map((i,o)=>{const l=At(i),d=this.tried&&!!pe(i);return n`<div class="line" data-line=${o} data-line-kind=${i.kind} aria-invalid=${String(d)}>
          <label class="fld"><span>${p("lineKind")}</span><select class="inp" data-line-kind-select @change=${c=>{const m=c.target.value;this.set({lines:e.lines.map((v,$)=>$===o?{...ae(m,s),description:v.description}:v)})}}>
            ${t.map(c=>n`<option value=${c} ?selected=${c===i.kind}>${p(`k_${c}`)}</option>`)}</select></label>
          ${a(o,i,"description",p("description"),"text",!0)}
          ${i.kind==="labor"?n`${a(o,i,"hours",p("hours"),"decimal")}${a(o,i,"rate",p("rate"),"decimal")}`:i.kind==="parts"?n`${a(o,i,"quantity",p("quantity"),"decimal")}${a(o,i,"unit_price",p("unitPrice"),"decimal")}`:n`${a(o,i,"amount",p("amount"),"decimal")}<span></span>`}
          <button type="button" class="btn sm quiet rmv" aria-label=${p("removeLine")} data-line-remove ?disabled=${e.lines.length<2} @click=${()=>this.set({lines:e.lines.filter((c,m)=>m!==o)})}>${y("x")}</button>
          <span class="lt" data-line-total>${p("lineTotal")}: ${l===null?"—":this.money(l,e.currency)}</span>
        </div>`})}
      <div><button type="button" class="btn sm" data-line-add ?disabled=${e.lines.length>=30} @click=${()=>this.set({lines:[...e.lines,ae(t.includes("parts")?"parts":"labor",s)]})}>${y("plus")}${p("addLine")}</button></div>
    </div>`}render(){const e=this.form,t=this.costs,s=this.target;if(!e||!t||!s)return r;const a=t.claims.find(q=>q.assignment_id===e.assignment),i=!!a?.vat_exempt,o=t.settings?.currencies??["ILS"],l=t.settings?.vat_rate_bp??1800,d=jt(i,e.include,!1),c=Os(t.allowed_line_kinds?.kinds),m=Ft(e.lines,d,l),v=q=>m&&q!==void 0?this.money(q,e.currency):"—",$=this.tried?Ps(e.from,e.to):"",D=$?h(Me[`work_${$}`]):"",L=this.tried?Rs(e.validUntil):"",G=L?h(Me[`valid_${L}`]):"";return n`<sw-dialog open wide heading=${h("obTitle")} data-dialog="quote-on-behalf" @close=${this.close}>
      <div class="form">
        <div class="banner info" role="note" data-ob-notice>${y("lock")}<div>${x(h("obNotice",{vendor:s.name}))}</div></div>
        ${s.replaces?n`<span class="muted" data-ob-replaces>${h("obReplaces")}</span>`:r}
        <div class="two">
          ${o.length>1?n`<label class="fld"><span>${p("currency")}</span><select class="inp" data-ob-currency @change=${q=>this.set({currency:q.target.value})}>
            ${o.map(q=>n`<option value=${q} ?selected=${q===e.currency}>${q}</option>`)}</select></label>`:r}
          ${i?r:n`<div class="fld"><span>${p("vatToggle")}</span><sw-segmented radio size="sm" label=${p("vatToggle")} value=${e.include?"included":"excluded"} @change=${q=>this.set({include:q.detail.value==="included"})}
            .options=${[{value:"excluded",label:p("amountsExcl"),attrs:{"data-ob-vat":"excluded"}},{value:"included",label:p("amountsIncl"),attrs:{"data-ob-vat":"included"}}]}></sw-segmented></div>`}
        </div>
        ${this.lineEditor(e,c,a?.labor_rate_minor)}
        <dl class="preview" data-preview>
          <dt>${p("net")}</dt><dd data-preview-net>${v(m?.net)}</dd>
          <dt>${d==="none"?p("vatNone"):p("vatAt",{rate:Ne(l)})}</dt><dd data-preview-vat>${v(m?.vat)}</dd>
          <dt class="tot">${p("total")}</dt><dd class="tot" data-preview-total>${v(m?.total)}</dd>
        </dl>
        <div class="two" data-ob-window>
          <label class="fld"><span>${h("obWorkFrom")}</span><input class="inp" type="datetime-local" lang=${be()} dir="ltr" data-ob-work-from aria-invalid=${String(!!D)} .value=${e.from} @input=${q=>this.set({from:q.target.value})} /></label>
          <label class="fld"><span>${h("obWorkTo")}</span><input class="inp" type="datetime-local" lang=${be()} dir="ltr" data-ob-work-to aria-invalid=${String(!!D)} .value=${e.to} @input=${q=>this.set({to:q.target.value})} /></label>
        </div>
        ${D?n`<span class="err" data-ob-work-error>${D}</span>`:n`<span class="muted" data-ob-work-hint>${h("obWorkHint")}</span>`}
        <label class="fld"><span>${h("obValidUntil")}</span><input class="inp" type="date" lang=${be()} dir="ltr" data-ob-valid-until aria-invalid=${String(!!G)} .value=${e.validUntil} @input=${q=>this.set({validUntil:q.target.value})} /></label>
        ${G?n`<span class="err" data-ob-valid-error>${G}</span>`:n`<span class="muted" data-ob-valid-hint>${h("obValidHint")}</span>`}
        <label class="fld"><span>${h("quoteNote")}</span><textarea class="inp" maxlength="1000" data-ob-note .value=${e.note} @input=${q=>this.set({note:q.target.value})}></textarea></label>
        ${this.err?n`<div class="err" role="alert" data-ob-error>${this.err}</div>`:r}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.save()}>${y("check")}${h("obSave")}</button>
        <button type="button" class="btn" data-dialog-cancel @click=${()=>this.close()}>${h("back")}</button>
      </div>
    </sw-dialog>`}};V.styles=[de,...re,ce,me,Ve,We];ee([C()],V.prototype,"ticketId",2);ee([C({attribute:!1})],V.prototype,"costs",2);ee([C({attribute:!1})],V.prototype,"target",2);ee([g()],V.prototype,"form",2);ee([g()],V.prototype,"tried",2);ee([g()],V.prototype,"busy",2);ee([g()],V.prototype,"err",2);V=ee([oe("ticket-quote-form")],V);const Le=encodeURIComponent;async function bt(e,t,s){const{mockStore:a}=await je(),i=a.find(e);return i.events.push(a.event("note",new Date().toISOString(),{...a.me,me:!0},{body:t,external:!0,data:s?{from_note_id:s}:{}})),a.touch(i),a.view(i)}const fi={vendorMessage:(e,t,s={})=>Z(`tickets/${Le(e)}/vendor-message`,{text:t,notify:s.notify??!0,...s.source?{source:s.source}:{}}),forwardNote:(e,t,s,a={})=>Z(`tickets/${Le(e)}/notes/${Le(t)}/forward`,{text:s,notify:a.notify??!0}),teamNote:(e,t)=>O().note(e,t,!1)},mi={vendorMessage:async(e,t)=>(await bt(e,t,null),{}),forwardNote:async(e,t,s)=>(await bt(e,s,t),{}),teamNote:(e,t)=>O().note(e,t,!1)};function Qe(){return ue()?fi:mi}const vi=new Set(["created","status","closed","cancelled","reopened","assigned","reassigned","returned","auto_closed"]),$t={link_sent:"sent",update_sent:"sent",reminder:"sent",code_sent:"sent",cost_message:"sent",message_unknown:"unknown",message_failed:"failed",message_fallback:null},gi=new Set(["link_sent","update_sent","reminder","code_sent","cost_message","message_unknown","message_failed"]),bi=e=>typeof e=="string"&&e?e:null;function $i(e){const t={id:e.id,type:"system",kind:e.kind,at:e.at,actor:{kind:e.actor?.kind??"system",name:e.actor?.name??"",me:!!e.actor?.me},body:e.body,external:!!e.external,direction:null,channel:null,delivery:null,fromNoteId:bi(e.data?.from_note_id),unverified:!1,event:e,message:null};return e.kind==="note"?t.actor.kind==="contact"?{...t,type:"message",direction:"in",channel:"page"}:e.external?{...t,type:"message",direction:"out",channel:"page",delivery:"page"}:{...t,type:"internal_note"}:e.kind in $t?{...t,type:"message",direction:"out",channel:e.via==="email"?"email":"whatsapp",delivery:$t[e.kind]}:e.kind==="inbound"||e.kind==="late_reply"?{...t,type:"message",direction:"in",channel:"whatsapp",unverified:!0}:vi.has(e.kind)?{...t,type:"status_event"}:e.kind==="quote_submitted"||e.kind==="quote_decided"?{...t,type:"quote"}:e.kind==="cost_submitted"||e.kind==="cost_decision"?{...t,type:"demand"}:e.kind==="owner_changed"?{...t,type:"owner_change"}:e.kind==="photo"||e.kind==="photo_removed"?{...t,type:"photo"}:t}function wi(e){switch(e){case"sent":return"sent";case"unknown":return"unknown";case"held":return"held";case"sending":return"sending";case"queued":return"queued";default:return"failed"}}function yi(e){return{id:`ob:${e.id}`,type:"message",kind:"outbox",at:e.created_at,actor:{kind:"system",name:"",me:!1},body:null,external:!0,direction:"out",channel:e.channel==="email"?"email":"whatsapp",delivery:wi(e.state),fromNoteId:null,unverified:!1,event:null,message:e}}function Wt(e,t={}){const s=!!t.outbox&&!!e.messages?.length,a=e.events.filter(i=>!(s&&gi.has(i.kind))).map($i);if(s)for(const i of e.messages??[])i.purpose!=="test"&&a.push(yi(i));return a.map((i,o)=>({it:i,i:o})).sort((i,o)=>i.it.at<o.it.at?-1:i.it.at>o.it.at?1:i.i-o.i).map(i=>i.it)}const ki=["all","messages","notes","status","costs"],xi={messages:["message"],notes:["internal_note"],status:["status_event","owner_change"],costs:["quote","demand"]};function Qt(e,t){return t==="all"||xi[t].includes(e.type)}function _i(e,t){return e.filter(s=>Qt(s,t))}function zi(e){const t={all:e.length,messages:0,notes:0,status:0,costs:0};for(const s of e)for(const a of["messages","notes","status","costs"])Qt(s,a)&&(t[a]+=1);return t}function qi(e){return e.filter(t=>t.kind.startsWith("link_")&&t.kind!=="link_sent").reverse()}function Ci(e){return e?["vendor","team"]:["team"]}function Ti(e,t,s){return s?t==="vendor"?e.type==="message"||e.type==="quote"||e.type==="demand"||(e.type==="status_event"||e.type==="photo"&&e.kind==="photo")&&e.external:e.type==="internal_note"||e.type==="photo"&&e.kind==="photo"&&!e.external:e.type==="internal_note"||e.type==="message"&&e.kind==="note"||e.kind==="inbound"||e.kind==="late_reply"||e.type==="photo"&&e.kind==="photo"}function Ae(e,t,s){return e.filter(a=>Ti(a,t,s))}function Ni(e){const t=e.filter(s=>s.actor.me).at(-1)?.at??"";return e.filter(s=>s.direction==="in"&&s.at>t).length}function Si(e){const t=new Map;for(const s of e)s.fromNoteId&&s.direction==="out"&&t.set(s.fromNoteId,s);return t}function Ei(e,t){return e.type==="internal_note"&&!!e.body?.trim()&&t.canVendor&&!t.forwarded.has(e.id)}function Di(e,t){return e.delivery==="page"&&t.some(s=>s.kind==="link_opened"&&s.at>e.at)}function wt(e){return{sub:e?"vendor":"team",vendorDraft:"",teamDraft:"",sourceNote:null,expanded:{vendor:!1,team:!1}}}function Oi(e,t){return t?e.sub:"team"}function yt(e,t){return e.sub===t?e:{...e,sub:t}}function kt(e,t,s){return t==="team"?{...e,teamDraft:s}:{...e,vendorDraft:s,sourceNote:s.trim()?e.sourceNote:null}}function Pi(e,t){const s=(t.body??"").trim(),a=e.vendorDraft.trim()?`${e.vendorDraft.trimEnd()}

${s}`:s;return{...e,sub:"vendor",vendorDraft:a,sourceNote:t.id}}function Ri(e,t=e.sub){const s=(t==="team"?e.teamDraft:e.vendorDraft).trim();return s?t==="team"?{route:"note",text:s}:e.sourceNote?{route:"forward",noteId:e.sourceNote,text:s}:{route:"vendor",text:s}:null}function Ii(e,t){return t==="team"?{...e,teamDraft:""}:{...e,vendorDraft:"",sourceNote:null}}function Mi(e,t){return t.key!=="Enter"||t.isComposing?!1:e==="team"?!t.shiftKey:!!(t.ctrlKey||t.metaKey)}const Li=20;function Gt(e,t,s=Li){return t||e.length<=s?{shown:[...e],hidden:0}:{shown:e.slice(e.length-s),hidden:e.length-s}}function Be(e){const t=new Date(e);if(Number.isNaN(t.getTime()))return"";const s=a=>String(a).padStart(2,"0");return`${t.getFullYear()}-${s(t.getMonth()+1)}-${s(t.getDate())}`}function Ai(e){const t=[];let s="";for(const a of e){const i=Be(a.at);i&&i!==s&&t.push({day:i}),s=i||s,t.push({item:a})}return t}function Fi(e,t,s){if(e===Be(t.toISOString()))return s.today;const a=new Date(t);if(a.setDate(a.getDate()-1),e===Be(a.toISOString()))return s.yesterday;const[i,o,l]=e.split("-");return i===String(t.getFullYear())?`${l}/${o}`:`${l}/${o}/${i}`}const Yt={subs:"שיחה עם",sub_vendor:"עם הספק",sub_team:"הצוות",sub_notes:"הערות",sub_unread_one:"הודעה אחת חדשה",sub_unread_many:"{n} הודעות חדשות",cap_vendor_whatsapp:"הספק רואה את ההודעות כאן · WhatsApp ודף הקישור",cap_vendor_email:"הספק רואה את ההודעות כאן · מייל ודף הקישור",cap_vendor_page:"הספק רואה את ההודעות כאן · בדף הקישור",cap_vendor_none:"אין כרגע ספק משויך · ההודעות הקודמות נשמרות כאן",cap_team:"הצוות בלבד · הספק לא רואה",cap_notes:"רק הצוות רואה כאן",log_vendor:"הודעות עם הספק",log_team:"הערות הצוות",empty_vendor:"עוד לא נשלחה הודעה ל{name}",empty_vendor_none:"אין הודעות",empty_team:"אין הערות · רק הצוות רואה כאן",older:"הודעות קודמות ({n})",today:"היום",yesterday:"אתמול",ph_vendor_whatsapp:"הודעה ל{name} ב-WhatsApp ובדף הקישור",ph_vendor_email:"הודעה ל{name} במייל ובדף הקישור",ph_vendor_page:"הודעה ל{name} בדף הקישור",ph_team:"הערה לצוות",send_vendor:"שליחה ל{name}",save_team:"שמירה",hint_vendor:"Ctrl+Enter שולח",hint_team:"Enter שומר · הצוות בלבד",photo_team:"תמונה פנימית",photo_vendor:"תמונה לספק",from_note_draft:"מהערה פנימית · עוד לא נשלח",clear_draft:"ניקוי",prefilled:"הועתק להודעה לספק · עוד לא נשלח",sent_vendor:"ההודעה נשלחה ל{name}",sent_vendor_page:"ההודעה מוצגת ל{name} בדף הקישור",saved_team:"ההערה נשמרה · הצוות בלבד",send_failed:"ההודעה לא נשלחה",save_failed:"ההערה לא נשמרה",note_head:"הערה פנימית",note_not_sent:"לא נשלחה לספק",note_forwarded:"נשלחה לספק · {when}",forward:"שלח לספק",from_note:"מהערה פנימית",auto:"אוטומטי",ch_page:"דף הקישור",ch_whatsapp:"WhatsApp",ch_email:"מייל",me:"אני",d_page:"מוצג בדף הקישור",d_page_opened:"הקישור נפתח אחרי ההודעה",to_costs:"לעלויות",more_text:"עוד",less_text:"פחות",e_quote_submitted:"הוגשה הצעת מחיר",e_quote_decided:"התקבלה החלטה על הצעת המחיר",e_owner_changed:"אחראי בארגון: {name}",e_owner_cleared:"האחראי בארגון הוסר",h_timeline:"ציר זמן",h_filters:"סינון ציר הזמן",f_all:"הכול",f_messages:"הודעות",f_notes:"הערות",f_status:"מצב",f_costs:"עלויות",h_empty_filter:"אין פריטים בסינון הזה",h_more:"אירועים קודמים ({n})",h_files:"קבצים",h_files_none:"אין קבצים",file_photo:"תמונה {n}",file_internal:"פנימי",file_vendor:"גלוי לספק",file_mine:"צירפת",h_audit:"ביקורת",h_audit_link:"הקישור של הספק",h_audit_none:"אין עדיין פעולות על הקישור"},Xt=ps("en","tickets/conversation-text","en"),ji=hs(Yt,Xt),w=ji.t;us("tickets/conversation-text",{he:Yt,en:Xt});function we(e,t={}){const s=Is(e);if(s)return s;const a=wa(e.kind,e.data??{});if(a)return{icon:"flag",text:a};const i=e.data??{};switch(e.kind){case"quote_submitted":return{icon:"note",text:w("e_quote_submitted")};case"quote_decided":return{icon:"check",text:w("e_quote_decided")};case"owner_changed":{const o=typeof i.to=="string"?i.to:"";return{icon:"user",text:o?w("e_owner_changed",{name:o}):w("e_owner_cleared")}}default:return fs(e,t)}}const Bi=e=>{const t=e.trim().split(/\s+/)[0]??"";return t.length>14?`${t.slice(0,13)}…`:t},Ui=420;function Zt(e){if(e.assignee?.kind==="contact"){const s=[...e.assignments].reverse().find(a=>a.kind==="contact"&&!a.ended_at);return{name:e.assignee.name,channel:s?.channel??"",active:!0}}const t=[...e.assignments].reverse().find(s=>s.kind==="contact");return t?{name:t.name,channel:t.channel,active:!1}:null}function Jt(e){return e.status==="closed"||e.status==="cancelled"?!1:typeof e.can.vendor_message=="boolean"?e.can.vendor_message:!!e.can.note_external&&e.assignee?.kind==="contact"}class Hi{constructor(t,s){this.host=t,this.lend=s,this.s=wt(!1),this.forTicket="",this.bodiesOpen=new Set,this.error=null,this.sending=!1,t.addController(this)}hostConnected(){}reset(){this.forTicket="",this.bodiesOpen.clear(),this.error=null}sync(t){this.forTicket!==t.id&&(this.forTicket=t.id,this.s=wt(ye(t)))}set(t){this.s=t,this.host.requestUpdate()}focusComposer(t,s){this.sync(t),s&&this.set(yt(this.s,s)),this.host.updateComplete.then(()=>this.focusText())}focusText(){const t=this.host.renderRoot.querySelector("[data-composer-text]");if(!t)return;t.focus();const s=t.value.length;t.setSelectionRange?.(s,s)}pickSub(t){this.error=null,this.set(yt(this.s,t))}forward(t){this.error=null,this.set(Pi(this.s,{id:t.id,body:t.body})),this.host.updateComplete.then(()=>this.focusText())}async send(t,s,a){const i=Ri(this.s,s);if(!i||this.sending||this.lend.busy())return;this.sending=!0,this.error=null;const o=t.id,l=Qe(),d=i.route==="note"?w("saved_team"):w("sent_vendor",{name:a}),c=await this.lend.run(async()=>i.route==="note"?l.teamNote(o,i.text):(i.route==="forward"?await l.forwardNote(o,i.noteId,i.text):await l.vendorMessage(o,i.text),O().get(o)),d);this.sending=!1,c?this.set(Ii(this.s,s)):(this.error={sub:s,text:w(s==="team"?"save_failed":"send_failed")},this.host.requestUpdate()),this.host.updateComplete.then(()=>this.focusText())}onKey(t,s,a,i){Mi(a,t)&&(t.preventDefault(),this.send(s,a,i))}async onFiles(t,s){const a=t.target,i=[...a.files??[]];a.value="",i.length&&await this.lend.upload(i,s)}render(t){this.sync(t);const s=ye(t),a=Oi(this.s,s),i=Zt(t),o=Bi(i?.name??""),l=Wt(t,{outbox:!0}),d=Si(l),c=Jt(t),m=Ae(l,a,s),v=Gt(m,this.s.expanded[a]),$=new Date,D={t,all:l,forwarded:d,canVendor:c,now:$,vname:o},L=a==="vendor"&&!!t.external_stale&&!!t.link?.can?.resend,G=s?a==="team"?w("cap_team"):i?.active?w(i.channel==="whatsapp"?"cap_vendor_whatsapp":i.channel==="email"?"cap_vendor_email":"cap_vendor_page"):w("cap_vendor_none"):w("cap_notes"),q=a==="team"?w("empty_team"):i?.active?w("empty_vendor",{name:o}):w("empty_vendor_none");return n`<div class=${`cv ${a}`} data-conv data-conv-active=${a} data-conv-mode=${s?"vendor":"notes"}>
      ${s?this.subToggle(l,a):r}
      <section class=${`cv-feed ${a}`} data-conv-feed=${a} data-sect=${a==="vendor"?"messages":"notes"}>
        <div class="cv-cap" data-conv-caption>${f(a==="team"?"lock":"send")}<span>${G}</span></div>
        ${L?n`<div class="blk cv-stale" data-stale>
          <span class="bi">${f("warning")}</span>
          <div class="bt"><span class="who">${H("staleLine")}</span></div>
          <div class="acts"><button type="button" class="btn sm" data-send-update ?disabled=${this.lend.busy()}
            @click=${()=>void this.lend.run(()=>$e().sendUpdate(t.id),H("queuedNow"))}>${f("send")}${H("sendUpdate")}</button></div>
        </div>`:r}
        ${v.hidden?n`<button type="button" class="btn sm quiet cv-older" data-conv-older aria-expanded="false"
          @click=${()=>this.set({...this.s,expanded:{...this.s.expanded,[a]:!0}})}>${f("clock")}${w("older",{n:v.hidden})}</button>`:r}
        <div class="cv-log" role="log" aria-label=${w(a==="team"?"log_team":"log_vendor")} data-conv-log data-timeline>
          ${J(Ai(v.shown),K=>"day"in K?`d:${K.day}`:K.item.id,K=>"day"in K?n`<div class="cv-day" data-day=${K.day}><span>${Fi(K.day,$,{today:w("today"),yesterday:w("yesterday")})}</span></div>`:this.row(K.item,D))}
        </div>
        ${m.length?r:n`<p class="cv-empty" data-conv-empty>${q}</p>`}
      </section>
      ${this.composer(t,a,i,o,c)}
    </div>`}subToggle(t,s){const a=i=>{const o=Ae(t,i,!0).length,l=i==="vendor"?Ni(Ae(t,"vendor",!0)):0,d=w(i==="vendor"?"sub_vendor":"sub_team"),c=l?l===1?w("sub_unread_one"):w("sub_unread_many",{n:l}):"";return n`<button type="button" class=${`cv-sub ${i}${s===i?" on":""}`} aria-pressed=${String(s===i)} data-conv-sub=${i}
        aria-label=${c?`${d}, ${c}`:d} @click=${()=>this.pickSub(i)}>
        ${f(i==="vendor"?"send":"lock")}<span>${d}</span><small class="n" aria-hidden="true">${o}</small>
        ${l?n`<span class="bdg info" aria-hidden="true" data-conv-unread=${l}>${l}</span>`:r}
      </button>`};return n`<div class="cv-subs" role="group" aria-label=${w("subs")} data-conv-subs>${Ci(!0).map(a)}</div>`}bodyOf(t){if(!t.body)return r;const s=t.body.length>Ui||t.body.split(`
`).length>8,a=this.bodiesOpen.has(t.id);return n`<div class=${`cv-text${s&&!a?" clamp":""}`}>${t.body}</div>
      ${s?n`<button type="button" class="cv-more" aria-expanded=${String(a)} data-body-more
        @click=${()=>{a?this.bodiesOpen.delete(t.id):this.bodiesOpen.add(t.id),this.host.requestUpdate()}}>${w(a?"less_text":"more_text")}</button>`:r}`}row(t,s){const a=Je(t.at,s.now);if(t.message)return this.outboxRow(t.message,s);if(t.type==="internal_note"){const o=s.forwarded.get(t.id);return n`<article class="cv-note" data-item=${t.id} data-kind=${t.kind} data-type="internal_note">
        <span class="ni" aria-hidden="true">${f("lock")}</span>
        <div class="nh"><b>${w("note_head")}</b><span>·</span><span>${x(t.actor.me?w("me"):t.actor.name)}</span>
          <span class="mut">${a} · ${o?n`<span class="fwd" data-note-forwarded>${f("check")}${w("note_forwarded",{when:Je(o.at,s.now)})}</span>`:w("note_not_sent")}</span>
        </div>
        ${this.bodyOf(t)}
        ${Ei(t,{canVendor:s.canVendor,forwarded:s.forwarded})?n`<button type="button" class="btn sm quiet cv-fwd" data-note-forward=${t.id}
          @click=${()=>this.forward(t)}>${f("send")}${w("forward")}</button>`:r}
      </article>`}if(t.type==="message"&&t.direction==="in"){const o=t.unverified?we(t.event).text:t.channel==="page"?w("ch_page"):w("ch_whatsapp");return n`<article class="cv-msg in" data-item=${t.id} data-kind=${t.kind} data-dir="in">
        <div class="hd"><b>${x(t.actor.name||s.vname)}</b><span class=${`ch cv-ch-${t.channel??"none"}`}>${f(t.channel==="page"?"link":"send")}${o}</span></div>
        <div class="bx">${t.body?this.bodyOf(t):n`<div class="cv-text">${we(t.event).text}</div>`}<span class="tm">${a}</span></div>
      </article>`}if(t.type==="message"&&t.direction==="out"&&t.body){const o=Di(t,s.all),l=t.actor.me?w("me"):t.actor.name;return n`<article class="cv-msg out" data-item=${t.id} data-kind=${t.kind} data-dir="out" data-delivery=${o?"opened":t.delivery??""}>
        <div class="hd"><span class="ch cv-ch-page">${f("link")}${w("ch_page")}</span><b>${x(l)}</b>${t.fromNoteId?n`<span class="mut">· ${w("from_note")}</span>`:r}</div>
        <div class="bx">${this.bodyOf(t)}<span class="tm">${a} · <span data-delivery-line>${w(o?"d_page_opened":"d_page")}</span></span></div>
      </article>`}const i=we(t.event,s.t.department?{[s.t.department.id]:s.t.department.name}:{});return t.type==="message"?n`<div class=${`cv-sys out ${t.delivery==="failed"?"bad":t.delivery==="unknown"?"run":""}`} data-item=${t.id} data-kind=${t.kind} data-state=${t.delivery??""}>
        ${f(i.icon)}<span data-message-line>${i.text}</span><span class="mut">· ${a}</span></div>`:t.type==="quote"||t.type==="demand"?n`<div class="blk cv-cost" data-item=${t.id} data-kind=${t.kind} data-type=${t.type}>
        <span class="bi">${f(i.icon)}</span><div class="bt"><span class="who">${i.text}</span><small>${x(t.actor.name)} · ${a}</small></div>
        <div class="acts"><button type="button" class="btn sm quiet" data-conv-costs @click=${()=>this.lend.onTab("costs")}>${w("to_costs")}</button></div>
      </div>`:t.type==="photo"?n`<div class="cv-sys" data-item=${t.id} data-kind=${t.kind}>${f("image")}<span>${i.text}</span><span class="mut">· ${x(t.actor.me?w("me"):t.actor.name)} · ${a}</span></div>`:n`<div class=${`cv-sys ${t.type==="status_event"?"hl":""}`} data-item=${t.id} data-kind=${t.kind}>${f(i.icon)}<span>${i.text}</span><span class="mut">· ${a}</span></div>`}outboxRow(t,s){const a=Ms(t,s.now);return n`<div class=${`blk cv-ob ${a.tone}`} data-item=${`ob:${t.id}`} data-message=${t.id} data-state=${t.state} data-purpose=${t.purpose}>
      <span class="bi">${f(t.channel==="email"?"note":"send")}</span>
      <div class="bt"><span class="who">${Ls(t.purpose)}</span>
        <small data-message-line data-tone=${a.tone}>${a.text}${t.account&&t.state==="sent"?n` · ${x(t.account)}`:r}</small></div>
      <div class="acts">
        ${t.can.send_now?n`<button type="button" class="btn sm" data-send-now ?disabled=${this.lend.busy()}
          @click=${()=>void this.lend.run(()=>$e().sendNow(s.t.id,t.id),H("queuedNow"))}>${f("send")}${H("sendNow")}</button>`:r}
        ${t.can.resend?n`<button type="button" class="btn sm quiet" data-resend ?disabled=${this.lend.busy()}
          @click=${()=>void this.lend.run(()=>$e().resend(s.t.id,t.id),H("queuedNow"))}>${f("refresh")}${H("resend")}</button>`:r}
      </div>
    </div>`}composer(t,s,a,i,o){const l=s==="team";if(l?!t.can.note:!o)return r;const d=l?this.s.teamDraft:this.s.vendorDraft,c=l?w("ph_team"):w(a?.channel==="whatsapp"?"ph_vendor_whatsapp":a?.channel==="email"?"ph_vendor_email":"ph_vendor_page",{name:i}),m=l?t.can.attach:t.can.attach_external,v=this.sending||this.lend.busy(),$=this.error?.sub===s?this.error.text:"";return n`<div class=${`cv-composer ${l?"team":"vendor"}`} data-composer=${l?"team":"vendor"}>
      ${!l&&this.s.sourceNote?n`<div class="cv-src" data-composer-source=${this.s.sourceNote}>${f("lock")}<span>${w("from_note_draft")}</span>
        <button type="button" class="cv-more" data-composer-clear @click=${()=>{this.set(kt(this.s,"vendor","")),this.focusText()}}>${w("clear_draft")}</button></div>`:r}
      <div class="cv-in">
        <span class="cv-ic" aria-hidden="true">${f(l?"lock":"send")}</span>
        <textarea rows="1" maxlength="2000" data-composer-text aria-label=${c} placeholder=${c} .value=${d}
          @input=${D=>{this.error=null,this.set(kt(this.s,s,D.target.value))}}
          @keydown=${D=>this.onKey(D,t,s,i)}></textarea>
        ${m?n`<label class="cv-photo" title=${w(l?"photo_team":"photo_vendor")} data-composer-photo=${l?"internal":"external"}>
          ${f(this.lend.uploading()?"clock":"camera")}
          <input type="file" accept="image/jpeg,image/png" multiple aria-label=${w(l?"photo_team":"photo_vendor")} ?disabled=${this.lend.uploading()>0}
            @change=${D=>void this.onFiles(D,!l)} /></label>`:r}
      </div>
      <div class="cv-foot">
        <span class="hint">${w(l?"hint_team":"hint_vendor")}</span>
        ${$?n`<span class="cv-err" role="alert" data-composer-error>${f("warning")}${$}</span>`:r}
        <span class="sp"></span>
        <button type="button" class=${`btn sm ${l?"cv-save":"primary"}`} data-composer-send=${l?"team":"vendor"} ?disabled=${v||!d.trim()}
          @click=${()=>void this.send(t,s,i)}>${f(l?"lock":"send")}${l?w("save_team"):w("send_vendor",{name:i})}</button>
      </div>
    </div>`}}const Ki=F`
  .cv {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-inline-size: 0;
  }
  /* the sub-tabs: a segmented toggle group (aria-pressed); the team toggle takes the note colour when on */
  .cv-subs {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
  }
  .cv-sub {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-block-size: 40px;
    padding-inline: 10px;
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .cv-sub .n {
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
    font-variant-numeric: tabular-nums;
  }
  .cv-sub.on {
    background: var(--mm-seg-thumb, var(--dv-surface-solid));
    color: var(--dv-accent-text);
    box-shadow: var(--dv-shadow-control);
  }
  .cv-sub.team.on {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text);
  }
  .cv-sub:focus-visible,
  .cv-fwd:focus-visible,
  .cv-more:focus-visible,
  .cv-photo:focus-within {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 1px;
  }
  /* the feed: a plain column inside the one scroller (never max-height + overflow) */
  .cv-feed {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface-2);
    min-inline-size: 0;
  }
  .cv-feed.team {
    background: color-mix(in srgb, var(--dv-warning-soft) 55%, var(--dv-surface-2));
  }
  .cv-log {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }
  .cv-cap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    text-align: center;
  }
  .cv-feed.team .cv-cap {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text);
  }
  .cv-older {
    align-self: center;
    min-block-size: 36px;
  }
  .cv-empty {
    margin: 4px 0;
    text-align: center;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-sm);
  }
  .cv-day {
    align-self: center;
    margin-block: 4px 0;
  }
  .cv-day span {
    display: inline-block;
    padding: 2px 10px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
    font-weight: 600;
  }
  .cv-sys {
    align-self: center;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px;
    max-inline-size: 100%;
    padding: 2px 8px;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
    text-align: center;
    overflow-wrap: anywhere;
  }
  .cv-sys.hl {
    padding: 4px 12px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .cv-sys.bad {
    color: var(--dv-danger);
  }
  .cv-sys.run {
    color: var(--au-warn-text);
  }
  .cv-sys .mut,
  .cv-msg .mut {
    opacity: 0.8;
  }
  /* messages: incoming at the start side (the vendor's), outgoing at the end side in the message colour */
  .cv-msg {
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-inline-size: 86%;
    min-inline-size: 0;
  }
  .cv-msg.in {
    align-self: flex-start;
  }
  .cv-msg.out {
    align-self: flex-end;
  }
  .cv-msg .hd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding-inline: 6px;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
  }
  .cv-msg .hd b {
    color: var(--dv-text-2);
    font-weight: 600;
  }
  .cv-msg .ch {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .cv-msg .bx {
    padding: 9px 12px;
    border-radius: var(--sw-r-xl);
    background: var(--dv-surface-solid);
    border: 1px solid var(--dv-border);
    box-shadow: var(--dv-shadow-control);
    font-size: var(--sw-fs-md);
    line-height: 1.5;
    color: var(--dv-text);
  }
  .cv-msg.in .bx {
    border-start-start-radius: var(--sw-r-2xs);
  }
  .cv-msg.out .bx {
    background: var(--dv-accent-soft);
    border-color: color-mix(in srgb, var(--dv-accent) 30%, transparent);
    border-start-end-radius: var(--sw-r-2xs);
  }
  .cv-msg .tm {
    display: block;
    margin-block-start: 3px;
    text-align: end;
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
  }
  .cv-text {
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .cv-text.clamp {
    display: -webkit-box;
    -webkit-line-clamp: 8;
    line-clamp: 8;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cv-more {
    min-block-size: 32px;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--dv-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  /* the team note: the warning-tinted card with the lock - "הערה פנימית" is said in text, never by colour alone */
  .cv-note {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 2px 10px;
    padding: 8px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-warning-soft);
    border: 1px dashed color-mix(in srgb, var(--dv-warning) 55%, transparent);
    color: var(--dv-text);
  }
  .cv-note .ni {
    grid-row: 1 / span 3;
    display: grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--sw-r-md);
    background: color-mix(in srgb, var(--dv-warning) 30%, transparent);
    color: var(--au-warn-text);
  }
  .cv-note .nh {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    font-size: var(--sw-fs-xs);
    color: var(--au-warn-text);
  }
  .cv-note .nh .mut {
    opacity: 0.85;
  }
  .cv-note .nh .sp {
    flex: 1;
  }
  .cv-note .fwd {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--au-ok-text);
    font-weight: 600;
  }
  .cv-note .cv-text {
    font-size: var(--sw-fs-md);
    line-height: 1.5;
  }
  .cv-note .cv-more {
    justify-self: start;
  }
  .cv-note .cv-fwd {
    grid-column: 2;
    justify-self: end;
  }
  .cv-ob.bad .bt small,
  .cv-stale .who {
    color: var(--dv-danger);
  }
  .cv-ob.run .bt small {
    color: var(--au-warn-text);
  }
  /* the composer: sticky at the bottom of the tab body (the drawer's one scroller); the team one is the note surface */
  .cv-composer {
    position: sticky;
    inset-block-end: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-block-start: 4px;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: linear-gradient(color-mix(in srgb, var(--dv-accent-soft) 40%, transparent), color-mix(in srgb, var(--dv-accent-soft) 40%, transparent)), var(--dv-surface-solid);
    border: 1px solid color-mix(in srgb, var(--dv-accent) 35%, var(--dv-border));
    box-shadow: var(--dv-shadow-2);
  }
  .cv-composer.team {
    background: linear-gradient(var(--dv-warning-soft), var(--dv-warning-soft)), var(--dv-surface-solid);
    border: 1px dashed color-mix(in srgb, var(--dv-warning) 60%, transparent);
  }
  .cv-src {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-xs);
    color: var(--au-warn-text);
    font-weight: 600;
  }
  .cv-in {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .cv-ic {
    display: grid;
    place-items: center;
    inline-size: 32px;
    block-size: 44px;
    color: var(--dv-accent-text);
    flex: none;
  }
  .cv-composer.team .cv-ic {
    color: var(--au-warn-text);
  }
  .cv-in textarea {
    flex: 1;
    min-inline-size: 0;
    min-block-size: 44px;
    box-sizing: border-box;
    padding: 10px 14px;
    border-radius: var(--sw-r-xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-2);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-md);
    line-height: 1.5;
    resize: none;
    overflow: hidden;
    field-sizing: content;
  }
  .cv-composer.vendor textarea {
    border-color: color-mix(in srgb, var(--dv-accent) 45%, transparent);
    background: color-mix(in srgb, var(--dv-accent-soft) 60%, var(--dv-surface-2));
  }
  .cv-composer.team textarea {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--dv-warning) 60%, transparent);
    background: var(--dv-surface-solid);
  }
  .cv-in textarea:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 1px;
  }
  .cv-photo {
    position: relative;
    display: grid;
    place-items: center;
    inline-size: 44px;
    block-size: 44px;
    flex: none;
    border-radius: 50%;
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    color: var(--dv-text-2);
    cursor: pointer;
  }
  .cv-photo input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .cv-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .cv-foot .hint {
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
  }
  .cv-foot .sp {
    flex: 1;
  }
  .cv-err {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--dv-danger);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
  }
  .cv-foot .btn {
    min-block-size: 40px;
  }
  .cv-save {
    background: color-mix(in srgb, var(--dv-warning) 35%, var(--dv-surface-solid));
    border-color: color-mix(in srgb, var(--dv-warning) 60%, transparent);
    color: var(--au-warn-text);
    font-weight: 700;
  }
  @media (max-width: 767px) {
    .cv-sub,
    .cv-foot .btn,
    .cv-older,
    .cv-fwd,
    .cv-more {
      min-block-size: 44px;
    }
    .cv-msg {
      max-inline-size: 94%;
    }
    .cv-foot .hint {
      display: none;
    }
    .cv-foot .btn {
      flex: 1;
      justify-content: center;
    }
  }
`,Vi=F`
  ${Rt}
  .ct {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-inline-size: 0;
  }
  .cthead {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
  }
  .steps {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .steps .st {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    color: var(--dv-text-3);
    white-space: nowrap;
  }
  .steps .st i {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--dv-border-strong);
  }
  .steps .st::after {
    content: '';
    inline-size: 12px;
    block-size: 1px;
    margin-inline: 5px;
    background: var(--dv-border-strong);
  }
  .steps .st:last-child::after {
    display: none;
  }
  .steps .st.done {
    color: var(--au-ok-text);
  }
  .steps .st.done i {
    background: var(--dv-success);
  }
  .steps .st.cur {
    color: var(--dv-accent-text);
  }
  .steps .st.cur i {
    background: var(--dv-accent);
    box-shadow: 0 0 0 3px var(--dv-accent-soft);
  }
  .cstage {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: var(--sw-r-xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    min-inline-size: 0;
  }
  .cstage.ok {
    border-color: color-mix(in srgb, var(--dv-success) 40%, transparent);
  }
  .cstage.dim {
    opacity: 0.65;
  }
  .csh {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    min-inline-size: 0;
  }
  .csh .sp {
    flex: 1;
  }
  .csh .ic,
  .baseline .ic {
    display: inline-grid;
    place-items: center;
    color: var(--dv-accent-text);
  }
  .csh .ic svg,
  .baseline .ic svg {
    inline-size: 16px;
    block-size: 16px;
  }
  .qlines {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .ql {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    min-block-size: 28px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .ql.off {
    color: var(--dv-text-3);
    text-decoration: line-through;
  }
  .ql .qd,
  .ql .pick {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .ql .pick {
    min-block-size: 44px;
    cursor: pointer;
  }
  .ql .pick input {
    inline-size: 20px;
    block-size: 20px;
    accent-color: var(--dv-accent);
  }
  .mk {
    display: inline-grid;
    place-items: center;
  }
  .mk svg {
    inline-size: 14px;
    block-size: 14px;
  }
  .mk.approved {
    color: var(--au-ok-text);
  }
  .mk.not {
    color: var(--dv-text-3);
  }
  .num {
    font-variant-numeric: tabular-nums;
    unicode-bidi: isolate;
    white-space: nowrap;
  }
  .qtot {
    padding-block-start: 6px;
    border-block-start: 1px solid var(--dv-border);
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .qnote,
  .why {
    margin: 0;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    overflow-wrap: anywhere;
  }
  .why {
    color: var(--au-warn-text);
  }
  .muted {
    color: var(--dv-text-3);
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-block-start: 2px;
  }
  .acts .hint {
    inline-size: 100%;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .acts .more {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .baseline {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-success-soft, var(--dv-surface-3));
    font-size: var(--sw-fs-sm);
  }
  .baseline b {
    margin-inline-end: 6px;
  }
  .fold {
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
  }
  .fold > summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-block-size: 44px;
    padding-inline: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .fold > summary:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: -2px;
    border-radius: var(--sw-r-lg);
  }
  /* TKLAYFIX: a closed <details> keeps laying its body out (content-visibility hides it but the boxes still extend below the fold, outside the panel); it takes no space until opened. */
  .fold:not([open]) > .foldbody {
    display: none;
  }
  .foldbody {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 14px 14px;
  }
  .chipsrow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .rc {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-block-size: 36px;
    padding-inline: 12px;
    border-radius: 999px;
    border: 1px solid var(--dv-border-strong);
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .rc svg {
    inline-size: 14px;
    block-size: 14px;
  }
  .rc.on {
    border-color: var(--dv-accent);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .rc:disabled {
    cursor: default;
    opacity: 0.8;
  }
  .rc:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 2px;
  }
  .reqrow {
    flex-wrap: wrap;
  }
  .reqpair {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .draft {
    min-block-size: 120px;
    resize: vertical;
  }
  .slot-note {
    margin: 0;
    color: var(--dv-text-2);
  }
  @media (max-width: 767px) {
    .acts .btn,
    .rc {
      min-block-size: 44px;
    }
    .acts .btn.primary {
      flex: 1 1 100%;
      justify-content: center;
    }
  }
`;var Wi=Object.defineProperty,Qi=Object.getOwnPropertyDescriptor,R=(e,t,s,a)=>{for(var i=a>1?void 0:a?Qi(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&Wi(t,s,i),i};let P=class extends ie{constructor(){super(...arguments),this.bubbleSkin=new ne(this),this.ticket=null,this.data=null,this.failed="",this.busy=!1,this.flash=null,this.dialog=null,this.reason="",this.internalNote="",this.expiredOk=!1,this.tried=!1,this.err="",this.picking=null,this.moreFor="",this.send=null,this.sendErr="",this.sending=!1,this.entering=!1,this.loadedKey="",this.flashTimer=0,this.expiredAsked=!1,this.offNames=null,this.onEntered=e=>{e.stopPropagation(),this.entering=!1,this.load().then(()=>{this.changed(),this.say(h("obSaved"))})},this.onFormClose=e=>{e.stopPropagation(),this.entering=!1},this.notNow=e=>{e?.stopPropagation(),this.send&&(this.send=null,this.say(h("notSent")))},this.onDialogClose=e=>{e.stopPropagation(),this.dialog=null},this.onCardChanged=e=>{const t=e.detail?.costs;t&&(this.data={...this.data,...t})},this.onCardDraft=e=>{e.stopPropagation();const t=e.detail;this.afterDecision(t?.draft,t?.decision??"approved")},this.onCardReload=e=>{e.stopPropagation(),this.load()}}connectedCallback(){super.connectedCallback(),le(this),this.offNames=Ee(()=>this.requestUpdate())}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.flashTimer),this.offNames?.()}willUpdate(e){if(!e.has("ticket"))return;const t=this.ticket,s=t?.cost?`${t.id}|${t.revision}|${t.cost.status}`:"";s&&s!==this.loadedKey?(this.loadedKey.startsWith(`${t?.id}|`)||this.resetFor(),this.loadedKey=s,this.load()):s||(this.loadedKey="",this.data=null)}resetFor(){this.data=null,this.dialog=null,this.picking=null,this.moreFor="",this.send=null,this.entering=!1,this.failed=""}async load(){const e=this.ticket?.id;if(e){this.failed="";try{const t=await U().get(e);e===this.ticket?.id&&(this.data=t)}catch(t){e===this.ticket?.id&&(this.failed=N(t))}}}say(e,t="ok"){this.flash={text:e,tone:t},window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.flash=null,t==="bad"?7e3:3500)}money(e,t){return De(e,t,ke())}changed(){this.dispatchEvent(new CustomEvent("cost-changed",{detail:{costs:this.data},bubbles:!0,composed:!0}))}vendorTarget(){const e=this.ticket;if(!e)return{canWrite:!1,vendor:null};const t=Zt(e);return{canWrite:Jt(e),vendor:t?.active?t.name:null}}afterDecision(e,t){const s=As(e,t,this.vendorTarget());this.sendErr="",s?this.send=s:this.say(h("decided"))}async quoteWrite(e){if(this.busy)return null;this.busy=!0,this.err="";try{const t=await e();return await this.load(),this.changed(),t}catch(t){return t instanceof j&&t.status===409&&t.code==="quote_stale"?(this.err=h("stale"),await this.load()):t instanceof j&&t.status===409&&t.code==="self_approval"?this.err=h("selfApproval"):t instanceof j&&t.status===409&&t.code==="quote_expired"?(this.err=h("expiredRefused"),this.expiredAsked=!0):this.err=N(t),null}finally{this.busy=!1}}async decide(e,t,s={}){const a=this.ticket?.id??"",i=this.internalNote.trim();i&&(s={...s,internal_note:i});const o=await this.quoteWrite(()=>qe().decide(a,e.id,t,{revision:e.revision??1,...s}));if(!o)return;this.dialog=null,this.picking=null;const l=o.quotes.find(d=>d.id===e.id);this.afterDecision(o.message_draft,l?.state??(t==="approve"?"approved":t==="reject"?"rejected":"fix_requested"))}async submitDialog(e){const t=this.dialog;if(!t)return;this.tried=!0;const s=this.expiredNeeded(e,t.kind)?{confirm_expired:!0}:{};if(this.expiredNeeded(e,t.kind)&&!this.expiredOk){this.err=h("expiredNeeded");return}if(t.kind==="approve")return this.decide(e,"approve",s);if(t.kind==="partial"){const a=this.picking?.selected;return!a||!et(e,a)?void 0:this.decide(e,"approve",{...s,line_indexes:(e.lines??[]).filter(i=>a.has(i.index)).map(i=>i.index)})}if(this.reason.trim())return this.decide(e,t.kind==="fix"?"request-fix":"reject",{reason:this.reason.trim()})}expiredNeeded(e,t){return Fs(e,t)||this.expiredAsked&&(t==="approve"||t==="partial")}expiredField(e,t){if(!this.expiredNeeded(e,t))return r;const s=h("expiredConfirmSentence",{date:tt(e.valid_until)});return n`<label class="chk" data-quote-expired-confirm><sw-toggle size="sm" labelHidden in-label label=${s} data-quote-expired-ok .checked=${this.expiredOk}
      @change=${a=>{this.expiredOk=X(a),this.err=""}}></sw-toggle>${s}</label>`}openDialog(e,t){this.reason="",this.internalNote="",this.expiredOk=!1,this.expiredAsked=!1,this.tried=!1,this.err="",this.moreFor="",this.dialog={kind:e,quoteId:t.id}}async setKinds(e){const t=this.ticket?.id??"";await this.quoteWrite(()=>qe().setKinds(t,e))?this.say(h("decided")):this.err&&this.say(this.err,"bad")}async setQuoteMode(e,t){const s=this.ticket?.id??"";await this.quoteWrite(()=>qe().setMode(s,e.id,t))?this.say(h("decided")):this.err&&this.say(this.err,"bad")}async setClaimMode(e,t){if(!this.busy){this.busy=!0;try{this.data=await U().setRequirement(this.ticket?.id??"",e.id,t),await this.load(),this.changed(),this.say(h("decided"))}catch(s){this.say(N(s),"bad")}finally{this.busy=!1}}}async sendToVendor(){const e=st(this.send),t=this.ticket;if(!(!e||!t||this.sending)){this.sending=!0,this.sendErr="";try{await Qe().vendorMessage(t.id,e.text,{notify:e.notify,source:e.source});const s=this.send?.vendor??"";this.send=null,this.say(h("sent",{name:s})),this.changed()}catch(s){this.sendErr=`${h("sendFailed")} · ${N(s)}`}finally{this.sending=!1}}}entryButton(e,t=!0){return e?n`<button type="button" class=${`btn sm${t?" quiet":""}`} data-ob-entry ?disabled=${this.busy} @click=${()=>{this.err="",this.entering=!0}}>${y("plus")}${h("obEntry")}</button>`:r}onBehalfDialog(e,t){return!this.entering||!t||!this.ticket?r:n`<ticket-quote-form .ticketId=${this.ticket.id} .costs=${e} .target=${t} @quote-entered=${this.onEntered} @quote-form-close=${this.onFormClose}></ticket-quote-form>`}header(e,t){const s=js(e.flow,t);return n`<div class="cthead" data-cost-stage=${e.flow?.stage??"none"}>
      <span class=${`chip ${s.tone}`} data-stage-chip>${h(s.key)}${e.flow?.sub_state==="waiting_part"?n` · ${h("waitingPart")}`:r}</span>
      ${e.flow&&e.flow.stage!=="none"?n`<ol class="steps" aria-label=${h("stepper")} data-stepper>${s.steps.map(a=>n`<li class=${`st ${a.state}`}
        data-step=${a.id} data-step-state=${a.state||"todo"} aria-current=${a.state==="cur"?"step":"false"}><i aria-hidden="true"></i>${h(`step_${a.id}`)}</li>`)}</ol>`:r}
    </div>`}kindName(e){return p(`k_${e}`)}quoteLines(e,t){const s=e.currency??"ILS";return n`<ul class="qlines" data-quote-lines>${(e.lines??[]).map(a=>{const i=Bs(a),o=[this.kindName(a.kind),a.description].filter(Boolean).join(" · ");return n`<li class=${`ql ${i==="not"?"off":""}`} data-quote-line=${a.index} data-line-kind=${a.kind} data-line-mark=${i||"none"}>
        ${t?n`<label class="pick"><input type="checkbox" data-pick-line=${a.index} .checked=${t.has(a.index)} @change=${l=>this.togglePick(a.index,l.target.checked)} /><span>${x(o)}</span></label>`:n`<span class="qd">${i?n`<span class=${`mk ${i}`} aria-label=${i==="approved"?h("lineApproved"):h("lineNotApproved")}>${y(i==="approved"?"check":"x")}</span>`:r}${x(o)}</span>`}
        <span class="num">${this.money(a.total_minor,s)}</span>
      </li>`})}</ul>`}togglePick(e,t){if(!this.picking)return;const s=new Set(this.picking.selected);t?s.add(e):s.delete(e),this.picking={...this.picking,selected:s}}quoteTotals(e){if(e.total_minor===void 0)return r;const t=e.currency??"ILS",s=e.vat_mode==="none"?p("vatNone"):p("vatAt",{rate:Ne(e.vat_rate_bp??0)});if(this.picking?.quoteId===e.id){const i=at(e,this.picking.selected);return n`<dl class="kv qtot" data-pick-totals><dt>${p("net")}</dt><dd>${this.money(i.subtotal,t)}</dd><dt>${s}</dt><dd>${this.money(i.vat,t)}</dd>
        <dt class="tot">${h("selectedTotal")}</dt><dd class="tot" data-pick-total>${this.money(i.total,t)}</dd></dl>`}const a=e.approved&&e.state==="partially_approved";return n`<dl class="kv qtot" data-quote-totals>
      <dt>${p("net")}</dt><dd>${this.money(a?e.approved?.subtotal_minor:e.subtotal_minor,t)}</dd>
      <dt>${s}</dt><dd>${this.money(a?e.approved?.vat_minor:e.vat_minor,t)}</dd>
      <dt class="tot">${p("total")}</dt><dd class="tot" data-quote-total>${this.money(it(e),t)}</dd>
      ${a?n`<dt class="muted">${h("quoteFullTotal")}</dt><dd class="muted" data-quote-full-total>${this.money(e.total_minor,t)}</dd>`:r}
    </dl>`}quoteActionsRow(e,t,s){const a=Us(e,t.external_assignments),i=Hs(e,ms.me?.user.display_name);if(i&&(a.approve=!1,a.partial=!1),this.picking?.quoteId===e.id){const d=et(e,this.picking.selected);return n`<div class="acts" data-pick-actions><span class="hint">${h("pickLines")}</span>
        <button type="button" class="btn sm primary" data-pick-approve ?disabled=${this.busy||!d} @click=${()=>this.openDialog("partial",e)}>${y("check")}${h("approveSelected")}</button>
        <button type="button" class="btn sm quiet" data-pick-cancel @click=${()=>this.picking=null}>${h("cancel")}</button></div>`}const o=i&&e.state==="submitted";if(!a.approve&&!a.partial&&!a.fix&&!a.reject&&!s&&!o)return r;const l=this.moreFor===e.id;return n`<div class="acts" data-quote-actions>
      ${o?n`<span class="hint" data-quote-own>${y("lock")}${h("obOwn")}</span>`:r}
      ${a.approve?n`<button type="button" class="btn sm primary" data-quote-approve ?disabled=${this.busy} @click=${()=>this.openDialog("approve",e)}>${y("check")}${h("approveQuote")}</button>`:r}
      ${a.partial?n`<button type="button" class="btn sm" data-quote-partial ?disabled=${this.busy}
        @click=${()=>{this.moreFor="",this.picking={quoteId:e.id,selected:new Set((e.lines??[]).map(d=>d.index))}}}>${y("list")}${h("partialQuote")}</button>`:r}
      ${a.fix?n`<button type="button" class="btn sm quiet" data-quote-fix ?disabled=${this.busy} @click=${()=>this.openDialog("fix",e)}>${y("refresh")}${h("fixQuote")}</button>`:r}
      ${a.reject||s?n`<span class="more"><button type="button" class="btn sm quiet icon" aria-label=${h("more")} aria-expanded=${String(l)} data-quote-more
          @click=${()=>this.moreFor=l?"":e.id}>…</button>
        ${l&&s?n`<button type="button" class="btn sm quiet" data-quote-on-behalf ?disabled=${this.busy} @click=${()=>{this.moreFor="",this.err="",this.entering=!0}}>${y("plus")}${h("obNewVersion")}</button>`:r}
        ${l&&a.reject?n`<button type="button" class="btn sm quiet dz" data-quote-reject ?disabled=${this.busy} @click=${()=>this.openDialog("reject",e)}>${y("x")}${h("rejectQuote")}</button>`:r}</span>`:r}
    </div>`}quoteCard(e,t,s){const a=e.decision?.at?h("decidedBy",{state:h(`qs_${e.state}`),who:e.decision.by||"",when:M(e.decision.at)}):"",i=this.picking?.quoteId===e.id?this.picking.selected:null,o=e.state==="approved"||e.state==="partially_approved",l=!o&&(e.state==="submitted"||e.state==="fix_requested")&&Ks(e);return n`<section class=${`cstage ${o?"ok":""}`} data-quote=${e.id} data-quote-state=${e.state} aria-labelledby=${`qh-${e.id}`}>
      <div class="csh"><span class="ic">${y("file")}</span><b id=${`qh-${e.id}`}>${h("quoteTitle")}</b><span class="muted">${h("quoteSub")}</span>
        ${e.version>1?n`<span class="muted">· ${h("quoteVersion",{n:e.version})}</span>`:r}
        <span class="sp"></span>${l?n`<span class="chip warn" data-quote-expired-chip>${h("validExpiredChip")}</span>`:r}<span class=${`chip ${Vs(e.state)}`} data-quote-chip>${a&&o?a:h(`qs_${e.state}`)}</span></div>
      <div class="meta"><span>${h("quoteSubmitted",{when:M(e.created_at)})}</span>
        ${e.source==="manager"?n`<span data-quote-by-manager>${x(e.created_by_name?h("quoteOnBehalf",{who:e.created_by_name}):h("obEntry"))}</span>`:r}
        ${e.vendor?n`<span>${x(e.vendor)}</span>`:r}</div>
      ${e.lines?n`${this.quoteLines(e,i)}${this.quoteTotals(e)}`:n`<p class="muted" data-amounts-hidden>${h("amountsHidden")}</p>`}
      ${e.work_from||e.work_to?n`<div class="line" data-work-window><span>${h("workWindow")}</span><span class="num">${[e.work_from,e.work_to].filter(Boolean).map(d=>M(d)).join(" – ")}</span></div>`:r}
      ${e.valid_until?n`<div class="line" data-valid-until><span>${h("validUntil")}</span><span class="num">${tt(e.valid_until)}</span></div>`:r}
      ${e.vendor_ref?n`<div class="line"><span>${h("vendorRef")}</span><span class="num">${x(e.vendor_ref)}</span></div>`:r}
      ${e.note?n`<p class="qnote" data-quote-note><b>${h("quoteNote")}:</b> ${x(e.note)}</p>`:r}
      ${!o&&e.decision?.reason&&(e.state==="fix_requested"||e.state==="rejected")?n`<p class="why" data-quote-reason>${x(e.decision.reason)}</p>`:r}
      ${!o&&a?n`<div class="meta"><span>${a}</span></div>`:r}
      ${this.quoteActionsRow(e,t,s)}
    </section>`}olderFold(e){return e.length?n`<details class="hist" data-quote-older><summary>${y("refresh")}${h("older",{n:e.length})}</summary><ol>
      ${e.map(t=>n`<li data-older-quote=${t.version}><span><b>${h("quoteVersion",{n:t.version})}</b> · ${h(`qs_${t.state}`)} · ${M(t.created_at)}</span>
        ${t.total_minor!==void 0?n`<span class="num">${this.money(t.total_minor,t.currency)}</span>`:r}
        ${t.decision?.reason?n`<span class="why">${x(t.decision.reason)}</span>`:r}</li>`)}
    </ol></details>`:r}quotePending(e,t){const s=e.flow?.stage;return s!=="quote_requested"&&s!=="quote_optional"?r:n`<section class="cstage" data-quote="none" data-quote-state="none">
      <div class="csh"><span class="ic">${y("file")}</span><b>${h("quoteTitle")}</b><span class="muted">${h("quoteSub")}</span><span class="sp"></span>
        ${s==="quote_requested"?n`<span class="chip warn">${h("quoteRequired")}</span>`:n`<span class="muted">${h("quoteNone")}</span>`}</div>
      ${t?n`<div class="acts" data-quote-empty-actions>${this.entryButton(t,!1)}</div>`:r}
    </section>`}baselineRow(e){const t=e.baseline;if(!t)return r;const s=(t.line_kinds??[]).map(a=>this.kindName(a)).join(" · ");return n`<div class="baseline" data-baseline=${t.quote_id}><span class="ic">${y("check")}</span><span><b>${h("baseline")}</b>
      <span class="muted">${h("baselineLine",{n:t.version,total:this.money(t.total_minor,t.currency)})}${s?` · ${s}`:""}</span></span></div>`}kindsFold(e){const t=e.allowed_line_kinds;return!t||!this.ticket?.cost?.can_decide?r:n`<details class="fold" data-kinds-fold><summary>${h("kindsFold")} <span class="muted">(${t.kinds.map(s=>this.kindName(s)).join(" · ")})</span></summary>
      <div class="foldbody">
        <span class="muted" data-kinds-level=${t.level}>${h(`kindsLevel_${t.level}`)}</span>
        <div class="chipsrow" role="group" aria-label=${h("kindsFold")}>${Fe.map(s=>{const a=t.kinds.includes(s),i=s==="labor";return n`<button type="button" class=${`rc ${a?"on":""}`} aria-pressed=${String(a)} data-kind-toggle=${s} ?disabled=${this.busy||i}
            title=${i?h("kindsFixed"):""} @click=${()=>void this.setKinds(Ws(t.kinds,s))}>${y(a?"check":"plus")}${this.kindName(s)}</button>`})}</div>
        ${t.level==="request"?n`<div><button type="button" class="btn sm quiet" data-kinds-reset ?disabled=${this.busy} @click=${()=>void this.setKinds(null)}>${y("undo")}${h("kindsReset")}</button></div>`:r}
      </div>
    </details>`}seg(e,t,s,a,i){return n`<sw-segmented radio size="sm" label=${e} value=${t} ?disabled=${a||this.busy}
      @change=${o=>t===o.detail.value?void 0:i(o.detail.value)}
      .options=${Qs.map(o=>({value:o,label:h(`m_${o}`),attrs:{"data-mode":`${s}:${o}`}}))}></sw-segmented>`}requirementFold(e){const t=Gs(e.external_assignments,this.ticket?.cost);if(!t.length)return r;const s=this.ticket?.cost;return n`<details class="fold" data-requirement-fold><summary>${h("requirementFold")}</summary><div class="foldbody">
      ${J(t,a=>a.id,a=>n`<div class="reqrow" data-requirement=${a.id}><span class="lbl">${x(a.name)}</span>
        <span class="reqpair"><span class="muted">${h("quoteMode")}</span>${this.seg(`${h("quoteMode")} · ${a.name}`,a.quote_mode??"optional",`quote:${a.id}`,!1,i=>void this.setQuoteMode(a,i))}</span>
        <span class="reqpair"><span class="muted">${h("claimMode")}</span>${this.seg(`${h("claimMode")} · ${a.name}`,a.cost_claim??"optional",`claim:${a.id}`,!Lt(a.id,e.claims,s),i=>void this.setClaimMode(a,i))}</span>
      </div>`)}
    </div></details>`}reasonField(e){const t=this.tried&&!this.reason.trim();return n`<label class="fld"><span>${e} <b class="req">*</b> <span class="muted" data-quote-reason-public>· ${h("vendorSees")}</span></span>
      <textarea class="inp" maxlength="500" data-quote-reason-input aria-invalid=${String(t)} .value=${this.reason} @input=${s=>{this.reason=s.target.value,this.err=""}}></textarea>
      ${t?n`<span class="err">${h("required")}</span>`:r}</label>${this.internalNoteField()}`}internalNoteField(){return n`<label class="fld"><span>${h("internalNote")}</span>
      <textarea class="inp" maxlength="500" data-quote-internal-note .value=${this.internalNote} @input=${e=>this.internalNote=e.target.value}></textarea></label>`}quoteDialog(e){const t=this.dialog;if(!t)return r;const s=e.quotes?.find(c=>c.id===t.quoteId);if(!s)return r;const a={approve:"approveTitle",partial:"partialTitle",fix:"fixTitle",reject:"rejectTitle"},i={approve:"approveQuote",partial:"approveSelected",fix:"fixQuote",reject:"rejectQuote"},o=t.kind==="partial"&&this.picking?at(s,this.picking.selected).total:it(s),l=n`<div class="ch"><span class="who">${x(s.vendor??"")}</span><span class="sp"></span>${o!==null?n`<span class="amt" data-dialog-total>${this.money(o,s.currency)}</span>`:r}</div>`,d=t.kind==="fix"?this.reasonField(h("fixReason")):t.kind==="reject"?this.reasonField(h("rejectReason")):n`<p class="muted">${h("approveNote")}</p>${this.expiredField(s,t.kind)}${this.internalNoteField()}`;return n`<sw-dialog open heading=${h(a[t.kind])} data-dialog=${`quote-${t.kind}`} @close=${this.onDialogClose}>
      <div class="form">${l}${d}${this.err?n`<div class="err" role="alert" data-quote-error>${this.err}</div>`:r}</div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class=${`btn ${t.kind==="reject"?"danger":"primary"}`} data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.submitDialog(s)}>${h(i[t.kind])}</button>
        <button type="button" class="btn" data-dialog-cancel @click=${()=>this.dialog=null}>${h("back")}</button>
      </div>
    </sw-dialog>`}sendDialog(){const e=this.send;if(!e)return r;const t=st(e);return n`<sw-dialog open wide heading=${h(Xs(e))} data-dialog="send-vendor" data-send-subject=${e.subject} data-send-decision=${e.decision} @close=${this.notNow}>
      <div class="form">
        <p data-send-ask>${h("sendAsk")}</p>
        <span class="chip tag" data-send-to>${y("lock")}${x(h("sendTo",{name:e.vendor}))}</span>
        <label class="fld"><span>${h("sendText")}</span>
          <textarea class="inp draft" rows="5" maxlength=${Ys} dir="auto" data-send-text .value=${e.text}
            @input=${s=>{this.send&&(this.send={...this.send,text:s.target.value}),this.sendErr=""}}></textarea></label>
        <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${h("sendNotify")} data-send-notify .checked=${e.notify} @change=${s=>{this.send&&(this.send={...this.send,notify:X(s)})}}></sw-toggle>${h("sendNotify")}</label>
        ${this.sendErr?n`<div class="err" role="alert" data-send-error>${this.sendErr}</div>`:r}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn primary" data-send-ok ?disabled=${this.sending||!t} @click=${()=>void this.sendToVendor()}>${y("check")}${h("sendToVendor")}</button>
        <button type="button" class="btn" data-send-cancel @click=${this.notNow}>${h("notNow")}</button>
      </div>
    </sw-dialog>`}instalmentDemands(e){const t=e.instalment_demands??[];return t.length?customElements.get("ticket-costs-demands")?n`<ticket-costs-demands .items=${t} @cost-reload=${this.onCardReload}></ticket-costs-demands>`:(Mt(()=>import("./costs-demands-BxIUr7Dh.js"),__vite__mapDeps([0]),import.meta.url).then(()=>this.requestUpdate()),r):r}render(){const e=this.ticket;if(!e?.cost)return n`<p class="slot-note" data-costs-empty>${h("emptyCosts")}</p>`;const t=this.data,s=this.flash?n`<div class=${`banner ${this.flash.tone==="bad"?"bad":"info"}`} role="status" data-costs-flash=${this.flash.tone}>${y(this.flash.tone==="bad"?"warning":"check")}<div>${this.flash.text}</div></div>`:r;if(this.failed&&!t)return n`<div class="ct" data-costs-tab data-costs-state="error"><div class="banner bad" role="alert">${y("warning")}<div>${h("loadFailed")}</div>
        <button type="button" class="btn sm" data-costs-retry @click=${()=>void this.load()}>${y("refresh")}${h("retry")}</button></div></div>`;if(!t)return n`<div class="ct" data-costs-tab data-costs-state="loading" aria-busy="true"><span class="skl" style="block-size:32px"></span><span class="skl" style="block-size:140px"></span></div>`;const a=Zs(t.flow,t.external_assignments),i=Js(t.quotes??[],t.external_assignments),o=ea(t.claims,t.external_assignments),l=a?void 0:ta(i,t.flow?.assignment_id);if(a||(!t.flow||t.flow.stage==="none")&&!i.length&&!o.length){const L=a?null:sa(t.external_assignments,e.cost,t.flow),G=L?t.external_assignments?.find(K=>K.id===L):void 0,q=a?null:nt(e,t);return n`<div class="ct" data-costs-tab data-costs-state=${a?"staff":"empty"}>${s}
        <p class="slot-note" data-costs-empty>${a?h("noMoneyStaff"):h("emptyCosts")}</p>
        ${G||q?n`<div class="acts">${G?n`<button type="button" class="btn sm quiet" data-ask-quote ?disabled=${this.busy} @click=${()=>void this.setQuoteMode(G,"required")}>${y("file")}${h("askQuote")}</button>`:r}${this.entryButton(q)}</div>`:r}
        ${a?r:this.requirementFold(t)}
        ${this.onBehalfDialog(t,q)}
      </div>`}const c=t.flow?.stage??"none",m=nt(e,{...t,quotes:i}),v=(t.external_assignments??[]).some(L=>!L.ended_at&&L.quote_capable!==!1),$=o.length>0||!!e.cost.can_decide&&v&&(c==="work"||c==="quote_approved"||c==="demand_awaiting"),D=!$&&!!t.baseline&&(c==="quote_approved"||c==="work");return n`<div class="ct" data-costs-tab data-costs-state="ready">
      ${s}
      ${this.header(t,!!l)}
      ${l?n`${this.quoteCard(l,t,m)}${this.olderFold(aa(i,l))}`:this.quotePending(t,m)}
      ${this.baselineRow(t)}
      ${D?n`<section class="cstage dim" data-demand-later><div class="csh"><span class="ic">${y("coins")}</span><b>${h("demandTitle")}</b><span class="muted">${h("demandLater")}</span></div></section>`:r}
      ${$?n`<ticket-cost-card embedded .ticket=${e} .costs=${{...t,claims:o}}
        @cost-changed=${this.onCardChanged} @cost-draft=${this.onCardDraft} @cost-reload=${this.onCardReload}></ticket-cost-card>`:r}
      ${this.instalmentDemands(t)}
      ${this.kindsFold(t)}
      ${this.requirementFold(t)}
      ${this.quoteDialog(t)}
      ${this.onBehalfDialog(t,m)}
      ${this.sendDialog()}
    </div>`}};P.styles=[de,...re,ce,me,Ve,We,Vi];R([C({attribute:!1})],P.prototype,"ticket",2);R([g()],P.prototype,"data",2);R([g()],P.prototype,"failed",2);R([g()],P.prototype,"busy",2);R([g()],P.prototype,"flash",2);R([g()],P.prototype,"dialog",2);R([g()],P.prototype,"reason",2);R([g()],P.prototype,"internalNote",2);R([g()],P.prototype,"expiredOk",2);R([g()],P.prototype,"tried",2);R([g()],P.prototype,"err",2);R([g()],P.prototype,"picking",2);R([g()],P.prototype,"moreFor",2);R([g()],P.prototype,"send",2);R([g()],P.prototype,"sendErr",2);R([g()],P.prototype,"sending",2);R([g()],P.prototype,"entering",2);P=R([oe("ticket-costs-tab")],P);const xt=encodeURIComponent,Gi={get:e=>vs(`tickets/${xt(e)}/owner`),change:(e,t)=>It(`tickets/${xt(e)}/owner`,t)};function Yi(e){return e.view!=="full"||e.internal_owner===void 0?"hidden":e.internal_owner?"set":Ge(e)?"none":"hidden"}function Ge(e){return e.view==="full"&&!!e.can.change_owner&&e.status!=="closed"&&e.status!=="cancelled"}function Xi(e,t){return e.filter(s=>s.kind==="user"&&s.account).sort((s,a)=>+(a.id===t?.id)-+(s.id===t?.id)||s.name.localeCompare(a.name))}function _t(e,t,s,a){if(e===null)return null;const i=e||null;if((t?.id??null)===i)return null;const o=s.trim();return{user_id:i,...o?{reason:o}:{},revision:a}}const es=2e3;function Zi(e){return e.outside||e.pickedStaff}function Ji(e){return e.outside&&e.vendor?"vendor":"handler"}function ts(e,t){return t?e.trim().slice(0,es):""}function en(e){const t=e.internalNote.trim(),s=ts(e.handlerMessage,e.applies);return{note:t||null,note_external:!1,message:s||null}}const zt={he:{title:"נעילת קוד",until:"נעול עד {when}",newLink:"שלח קישור חדש",done:"נוצר קישור חדש"},en:{title:"Code locked",until:"Locked until {when}",newLink:"Send a new link",done:"A new link was created"}};function Ce(e,t,s=ke()){const a=gs(zt[s][e]??zt.he[e],s);return t?a.replace(/\{(\w+)\}/g,(i,o)=>o in t?t[o]:i):a}function tn(e){const t=e.link;return t&&typeof t=="object"?t:null}function sn(e,t=Date.now()){const s=tn(e);if(!s||!s.current)return{show:!1,until:null,canNew:!1};const a=s.code_locked&&s.code_locked_until&&Date.parse(s.code_locked_until)>t?s.code_locked_until:null,i=e.waiting_on==="manager"&&e.waiting_reason==="code_locked";return{show:!!s.code_locked||i,until:a,canNew:!!s.can?.new}}function an(e){return Z(`tickets/${encodeURIComponent(e)}/link/new`)}function nn(e,t){const s=sn(e);return s.show?n`<section class="sect" data-sect="code-lock" data-code-locked=${s.until?"on":"ended"}>
    <div class="blk" role="status">
      <span class="bi">${f("lock")}</span>
      <div class="bt"><span class="who">${Ce("title")}</span>
        ${s.until?n`<small>${Ce("until",{when:M(s.until)})}</small>`:r}
      </div>
      <div class="acts">
        ${s.canNew?n`<button type="button" class="btn sm" data-code-new-link ?disabled=${t.busy} @click=${t.onNew}>${f("send")}${Ce("newLink")}</button>`:r}
      </div>
    </div>
  </section>`:r}const on=60,rn={all:"f_all",messages:"f_messages",notes:"f_notes",status:"f_status",costs:"f_costs"};class ln{constructor(t){this.host=t,this.filter="all",this.all=!1,t.addController(this)}hostConnected(){}reset(){this.filter="all",this.all=!1}pick(t){this.filter=t,this.all=!1,this.host.requestUpdate()}render(t,s){const a=Wt(t),i=zi(a),o=_i(a,this.filter),l=Gt(o,this.all,on),d=ye(t),c=t.department?{[t.department.id]:t.department.name}:{};return n`<section class="sect" data-sect="timeline" id="timeline">
        <h4><span class="tag t1">${f("clock")}</span>${w("h_timeline")}<span class="cnt">${o.length}</span></h4>
        <div class="hv-chips" role="group" aria-label=${w("h_filters")} data-history-filters>
          ${ki.map(m=>n`<button type="button" class=${`hv-chip${this.filter===m?" on":""}`} aria-pressed=${String(this.filter===m)}
            data-history-filter=${m} ?disabled=${m!=="all"&&!i[m]} @click=${()=>this.pick(m)}>
            <span>${w(rn[m])}</span><small class="n">${i[m]}</small></button>`)}
        </div>
        <ol class="tline" data-timeline data-history-filter-active=${this.filter} aria-live="off">
          ${J([...l.shown].reverse(),m=>m.id,m=>this.row(m,d,c))}
        </ol>
        ${o.length?r:n`<p class="slot-note" data-history-empty>${w("h_empty_filter")}</p>`}
        ${l.hidden?n`<button type="button" class="btn sm quiet hv-all" data-history-all @click=${()=>{this.all=!0,this.host.requestUpdate()}}>
          ${f("clock")}${w("h_more",{n:l.hidden})}</button>`:r}
      </section>
      ${this.files(t)}
      ${this.audit(a,s)}`}row(t,s,a){const i=t.event,o=we(i,a),l=s&&!t.external&&(t.kind==="note"||t.kind==="photo");return n`<li data-kind=${t.kind} data-event=${t.id} data-type=${t.type}>
      <span class="ring">${f(o.icon)}</span>
      <div class="tx">
        <span class="meta">${M(t.at)} · ${x(Ze(i))}${l?n` · <b>${u("internal")}</b>`:r}</span>
        <span class="line">${o.text}</span>
        ${t.body?n`<div class="body">${t.body}</div>`:r}
      </div>
    </li>`}files(t){const s=ye(t),a=[...t.attachments].sort((i,o)=>i.at<o.at?1:i.at>o.at?-1:0);return n`<section class="sect" data-sect="files">
      <h4><span class="tag">${f("image")}</span>${w("h_files")}<span class="cnt">${a.length||""}</span></h4>
      ${a.length?n`<div class="hv-files">${J(a,i=>i.id,(i,o)=>n`<a class="blk hv-file" href=${O().photoUrl(i)} target="_blank" rel="noopener" data-file=${i.id}>
          <img src=${O().photoUrl(i)} alt="" loading="lazy" decoding="async" />
          <span class="bt"><span class="who">${w("file_photo",{n:a.length-o})}</span>
            <small>${M(i.at)}${i.mine?n` · ${w("file_mine")}`:r}${s?n` · <span data-file-scope=${i.external?"external":"internal"}>${i.external?w("file_vendor"):w("file_internal")}</span>`:r}</small></span>
          ${f("eye")}
        </a>`)}</div>`:n`<p class="slot-note" data-files-empty>${w("h_files_none")}</p>`}
    </section>`}audit(t,s){const a=qi(t);return s.link===r&&!a.length?r:n`<section class="sect" data-sect="audit">
      <h4><span class="tag">${f("eye")}</span>${w("h_audit")}<span class="cnt">${a.length||""}</span></h4>
      ${s.link}
      ${a.length?n`<ol class="hv-audit" data-link-audit>${a.map(i=>{const o=we(i.event);return n`<li class="blk" data-audit=${i.kind}><span class="bi">${f(o.icon)}</span>
          <span class="bt"><span class="who">${o.text}</span><small>${M(i.at)} · ${x(Ze(i.event))}</small></span></li>`})}</ol>`:n`<p class="slot-note" data-audit-empty>${w("h_audit_none")}</p>`}
    </section>`}}const dn=F`
  .hv-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .hv-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 36px;
    padding-inline: 12px;
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-solid);
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  .hv-chip .n {
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
    font-variant-numeric: tabular-nums;
  }
  .hv-chip.on {
    background: var(--dv-accent-soft);
    border-color: color-mix(in srgb, var(--dv-accent) 45%, transparent);
    color: var(--dv-accent-text);
  }
  .hv-chip.on .n {
    color: inherit;
  }
  .hv-chip:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .hv-chip:focus-visible,
  .hv-file:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 1px;
  }
  .hv-all {
    align-self: center;
  }
  .hv-files {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .hv-file {
    text-decoration: none;
    color: inherit;
  }
  .hv-file img {
    flex: none;
    inline-size: 44px;
    block-size: 44px;
    border-radius: var(--sw-r-md);
    object-fit: cover;
    background: var(--dv-surface-3);
  }
  .hv-file .ic {
    color: var(--dv-text-3);
  }
  .hv-audit {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  @media (max-width: 767px) {
    .hv-chip,
    .hv-all {
      min-block-size: 44px;
    }
    .hv-files {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;function Ye(e,t){const s=!!e?.available;return{visible:s,checked:s&&t}}function cn(e,t){return Ye(e,t).checked?!0:void 0}function pn(e,t){return Ye(e,t).checked&&e?.on?!0:void 0}function un(e){const t=`refusal_${e}`;return bs.includes(t)?u(t):u("refusal_other")}class hn{constructor(t,s){this.host=t,this.lend=s,this.kind="user",this.contacts=null,this.external=!1,this.publicReady=!1,this.readiness=null,this.pick="",this.query="",this.requireCode=!1,this.shareHistory=!1,this.costClaim=null,this.preview=null,this.showText=!1,this.error="",this.sendNow=null,this.locationNav=!1,this.accessNeeded=!1,this.navKnown=null,this.seq=0,this.pending="",t.addController(this)}hostConnected(){}reset(){this.kind="user",this.contacts=null,this.external=!1,this.publicReady=!1,this.readiness=null,this.pick="",this.query="",this.requireCode=!1,this.shareHistory=!1,this.costClaim=null,this.preview=null,this.showText=!1,this.error="",this.sendNow=null,this.locationNav=!1,this.accessNeeded=!1,this.navKnown=null,this.pending="",this.seq+=1}preselect(t){this.kind="person",this.pending=t,this.host.requestUpdate()}applyPending(t){const s=this.pending;this.pending="";const a=s?this.groupRows().find(i=>i.id===s):void 0;a&&this.choose(t,a)}take(t,s){if(t.contacts!==void 0||ue()){this.contacts=t.contacts??[],this.external=!!t.external,this.publicReady=!!t.public_ready,this.readiness=t.readiness??null,this.applyPending(s),this.host.requestUpdate();return}he().externalAssignees(s.department?.id??"",s.id).then(a=>{this.contacts=a.contacts??[],this.external=!!a.external,this.publicReady=!!a.public_ready,this.readiness=a.readiness??null,this.applyPending(s),this.host.requestUpdate()}).catch(()=>{})}mayExternal(t){return t.can.assign_external||this.external}groupRows(){return(this.contacts??[]).filter(t=>t.contact_kind!=="employee")}blocked(t,s,a){return s==="user"?a===null?null:Da(a):s==="employee"?a===null?null:Oa({readiness:this.readiness,publicReady:this.publicReady||!ue(),count:a}):this.contacts===null&&this.mayExternal(t)?null:Pa("person",{external:this.mayExternal(t),readiness:this.readiness,publicReady:this.publicReady||!ue(),count:this.groupRows().length})}get outside(){return this.kind==="person"}reasonLine(t,s="block"){return n`<div class=${`xreason ${s}`} data-blocked=${t.key}>${f(s==="note"?"warning":"lock")}<span>${u(t.text)}</span>
      <a href=${t.href} data-blocked-link=${t.key}>${u(t.link)}</a></div>`}setKind(t){this.kind=t,this.pick="",this.preview=null,this.error="",this.host.requestUpdate()}choose(t,s){this.pick=s.id,this.requireCode=s.require_code,this.shareHistory=!1,this.sendNow=null,this.locationNav=!1,this.accessNeeded=!1,this.navKnown=null,this.error="",this.loadPreview(t)}async loadPreview(t){const s=++this.seq,a=cn(this.navKnown,this.locationNav);this.preview=null,this.host.requestUpdate();try{const i=await he().preview(t.id,this.pick,this.requireCode,a);if(s!==this.seq)return;this.preview=i,this.navKnown=i.location_nav??null,this.shareHistory||(this.shareHistory=i.share_history.default)}catch(i){s===this.seq&&(this.error=N(i))}this.host.requestUpdate()}matches(t){if(t.contact_kind==="employee")return!1;const s=this.query.trim().toLowerCase();return!s||t.name.toLowerCase().includes(s)||t.company.toLowerCase().includes(s)||(t.vendor_name??"").toLowerCase().includes(s)}renderKinds(t,s){const a=(i,o,l)=>{const d=this.blocked(t,i,i==="person"?null:s[i]);return{value:i,label:u(o),sub:u(d?d.text:l),dimmed:!!d,attrs:{"data-assign-kind":i,"data-kind-blocked":d?.key??""}}};return n`<sw-segmented class="xkinds" radio block label=${u("fAssignee")} data-assign-kinds value=${this.kind}
      @change=${i=>this.setKind(i.detail.value)}
      .options=${[a("user","asgInside","asgInsideSub"),a("employee","asgGroupEmployees","asgEmployeesSub"),a("person","asgOutside","asgOutsideSub")]}></sw-segmented>`}row(t,s){return n`<label data-contact=${s.id} data-contact-kind=${s.contact_kind}>
      <input type="radio" name="asgc" .checked=${this.pick===s.id} @change=${()=>this.choose(t,s)} />
      <span class="xtx"><span class="xnm">${x(s.name)}</span>
        <span class="xsub">${x([s.vendor_name??s.company,s.phone].filter(Boolean).join(" · "))}</span></span>
      ${this.insuranceChip(s)}
      ${s.require_code?n`<small>${f("lock")}${u("lkCode")}</small>`:r}</label>`}insuranceChip(t){const s=Ia(t.insurance);return s?n`<small class="xins" data-insurance=${t.insurance.state} data-look=${s.look} data-insurance-mark>${f("warning")}${s.text}</small>`:r}renderPicker(t){const a=this.blocked(t,"person",null);if(a)return this.reasonLine(a);if(this.contacts===null)return n`<span class="skl" style="block-size:44px"></span>`;const i=this.contacts.filter($=>this.matches($)),o=this.contacts.find($=>$.id===this.pick)??null,l=this.preview,d=Ra(this.readiness),c=i.filter($=>$.contact_kind==="vendor"),m=i.filter($=>$.contact_kind!=="vendor"),v=c.length>0&&m.length>0;return n`
      ${d?this.reasonLine(d,"note"):r}
      <label class="fld"><span class="vh">${u("asgSearch")}</span><input class="inp" type="search" maxlength="60" data-contact-search placeholder=${u("asgSearch")}
        .value=${this.query} @input=${$=>{this.query=$.target.value,this.host.requestUpdate()}} /></label>
      ${i.length?n`<div class="pick xpick" role="radiogroup" aria-label=${u("fAssignee")}>
          ${v?n`<span class="xgh" data-group="vendors">${u("hdSeg_vendors")}</span>`:r}${J(c,$=>$.id,$=>this.row(t,$))}
          ${v?n`<span class="xgh" data-group="contacts">${u("hdSeg_contacts")}</span>`:r}${J(m,$=>$.id,$=>this.row(t,$))}</div>`:n`<div class="muted" data-contacts-none>${u("ctNone")}</div>`}
      ${o?n`<div class="xopts" data-contact-options>
        <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${u("asgRequireCode")} data-require-code .checked=${this.requireCode} ?disabled=${o.require_code||this.lend.busy()}
          @change=${$=>{this.requireCode=X($),this.loadPreview(t)}}></sw-toggle>${u("asgRequireCode")}</label>
        ${o.require_code?n`<span class="muted xnote">${u("asgRequireCodeLocked")}</span>`:this.requireCode?n`<span class="muted xnote">${u("asgRequireCodeNote")}</span>`:r}
        ${l?.share_history.available?n`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${u("asgShareHistory")} data-share-history .checked=${this.shareHistory}
          @change=${$=>{this.shareHistory=X($),this.host.requestUpdate()}}></sw-toggle>${u("asgShareHistory")}</label>`:r}
        ${this.costChoice()}
        ${this.navChoice(t)}
        ${this.accessChoice()}
      </div>`:r}
      ${l?n`<div class="xinfo" data-assign-preview>
        <span class="muted">${f("link")}${u("asgLinkLine",{days:l.link.cap_days,grace:l.link.grace_hours})}</span>
        ${l.channel==="manual"?n`<span class="muted">${f("copy")}${u("asgManualLine")}</span>`:this.channelLines(l)}
        ${l.refusals.map($=>n`<div class="err" role="alert" data-refusal=${$}>${un($)}</div>`)}
        <button type="button" class="btn sm quiet" aria-expanded=${String(this.showText)} data-preview-toggle @click=${()=>{this.showText=!this.showText,this.host.requestUpdate()}}>
          ${f("note")}${this.showText?u("asgPreviewHide"):u("asgPreview")}</button>
        ${this.showText?n`<pre class="pv" dir=${l.lang==="he"||l.lang==="ar"?"rtl":"ltr"} lang=${l.lang} data-preview-text>${l.text}</pre>`:r}
      </div>`:r}
      ${this.error?n`<div class="err" role="alert">${this.error}</div>`:r}`}channelLines(t){const s=ot(t);return s?n`<span class="muted" data-assign-channel=${t.channel}>${f(t.channel==="email"?"note":"send")}${s.via}</span>
      ${s.down?n`<span class="muted" data-assign-down>${f("warning")}${s.down}</span>`:r}
      ${s.hours?n`<span class="muted" data-assign-hours>${f("clock")}${s.hours}</span>
        <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${H("sendNow")} data-assign-send-now .checked=${this.sendNow??s.sendNowDefault} ?disabled=${this.lend.busy()}
          @change=${a=>{this.sendNow=X(a),this.host.requestUpdate()}}></sw-toggle>${H("sendNow")}</label>`:r}`:r}sendNowChoice(){const t=this.preview?ot(this.preview):null;return!!t&&!!t.hours&&(this.sendNow??t.sendNowDefault)}costChoice(){const t=this.preview?.cost_claim;if(!t)return r;const s=this.costClaim??t.default;return n`<div class="fld" data-cost-claim=${s}><span>${p("mode")}</span>
      <sw-segmented radio size="sm" label=${p("mode")} value=${s} ?disabled=${this.lend.busy()}
        @change=${a=>{this.costClaim=a.detail.value,this.host.requestUpdate()}}
        .options=${t.choices.map(a=>({value:a,label:p(`m_${a}`),attrs:{"data-cost-claim-mode":a}}))}></sw-segmented></div>`}navChoice(t){const s=Ye(this.navKnown,this.locationNav);return s.visible?n`<label class="chk" data-nav-switch><sw-toggle size="sm" labelHidden in-label label=${fe("navOn")} data-location-nav .checked=${s.checked} ?disabled=${this.lend.busy()}
      @change=${a=>{this.locationNav=X(a),this.loadPreview(t)}}></sw-toggle>
      <span><b>${fe("navOn")}</b><small class="muted">${fe("navOnSub")}</small></span></label>`:r}accessChoice(){return this.preview?.access_needed?.available?n`<label class="chk" data-access-needed-switch><sw-toggle size="sm" labelHidden in-label label=${u("asgAccessNeeded")} data-access-needed .checked=${this.accessNeeded} ?disabled=${this.lend.busy()}
      @change=${t=>{this.accessNeeded=X(t),this.host.requestUpdate()}}></sw-toggle>
      <span><b>${u("asgAccessNeeded")}</b><small class="muted">${u("asgAccessNeededSub")}</small></span></label>`:r}get pickedVendor(){return!!this.contacts?.find(t=>t.id===this.pick&&t.contact_kind==="vendor")}ready(){return!!this.pick&&!!this.preview&&this.preview.refusals.length===0}async submit(t,s){if(!this.ready())return!1;const a=this.contacts?.find(i=>i.id===this.pick);return this.lend.run(()=>he().assignContact(t.id,{contactId:this.pick,note:s||null,noteExternal:!1,revision:t.revision,requireCode:this.requireCode&&!a?.require_code?!0:null,shareHistory:this.preview?.share_history.available?this.shareHistory:null,sendNow:this.sendNowChoice()||null,costClaim:this.costClaim,locationNav:pn(this.preview?.location_nav,this.locationNav)??null,accessNeeded:this.preview?.access_needed?.available&&this.accessNeeded?!0:null}),u("saved"))}}const fn=F`
  .xins {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: 999px;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    white-space: nowrap;
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .xins[data-look='alarm'] {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .vh {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* CR-CMP2-SEGMENTED-C-2450: the three groups are sw-segmented's two-line keys (block: three equal tiles), shaped through its knobs */
  sw-segmented.xkinds {
    inline-size: 100%;
    --sw-seg-h: 52px;
    --sw-seg-key-pad: 6px;
    --sw-seg-fw: 700;
    --sw-seg-on-fw: 700;
    --sw-seg-sub-fg: var(--dv-text-3);
    --sw-seg-dim-fg: var(--dv-text-3);
    --sw-seg-dim-sub-fg: var(--sw-warning);
  }
  /* a phone: the three kinds are rows of one column (three tiles with two lines each do not fit a 320 px dialog) */
  @media (max-width: 560px) {
    sw-segmented.xkinds {
      --sw-seg-axis: column;
      --sw-seg-key-axis: row;
      --sw-seg-key-justify: space-between;
      --sw-seg-h: 44px;
      --sw-seg-key-pad: 14px;
      --sw-seg-radius: var(--sw-r-lg);
      --sw-seg-pad: 4px;
      --sw-seg-btn-radius: var(--sw-r-md);
    }
    sw-segmented.xkinds::part(sub) {
      text-align: end;
    }
  }
  .xreason {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    padding: 10px 12px;
    border: 1px solid var(--dv-border);
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface);
    font-size: var(--sw-fs-sm);
    overflow-wrap: anywhere;
  }
  .xreason.note {
    padding: 0;
    border: 0;
    background: none;
    color: var(--dv-text-3);
  }
  .xreason a {
    color: var(--dv-accent-text, var(--dv-accent));
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  /* the list scrolls at its max height: its rows keep their own height (a squeezed row cut its two-line text) */
  .xpick > * {
    flex-shrink: 0;
  }
  .xgh {
    padding-block: 6px 0;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    color: var(--dv-text-3);
  }
  .xpick .xtx {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    padding-block: 6px;
  }
  .xpick .xnm {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .xpick .xsub {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-3);
    overflow-wrap: anywhere;
  }
  .xpick small {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .xopts,
  .xinfo {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .xinfo .muted {
    display: inline-flex;
    align-items: flex-start;
    gap: 6px;
    font-size: var(--sw-fs-sm);
  }
  .xnote {
    font-size: var(--sw-fs-sm);
    padding-inline-start: 26px;
  }
  .xinfo .btn {
    align-self: flex-start;
  }
  .pv {
    margin: 0;
    padding: 10px 14px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    font: inherit;
    font-size: var(--sw-fs-base);
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
`,mn=6e4;async function qt(e){try{if(typeof navigator<"u"&&navigator.clipboard&&window.isSecureContext)return await navigator.clipboard.writeText(e),!0}catch{}return!1}class vn{constructor(t,s){this.host=t,this.lend=s,this.confirm=null,this.copied=null,this.timer=0,t.addController(this)}hostConnected(){}hostDisconnected(){window.clearTimeout(this.timer),this.copied=null}reset(){this.confirm=null,this.copied=null,window.clearTimeout(this.timer)}keep(t,s){this.copied={...t,at:Date.now(),manual:s},window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>{this.copied=null,this.host.requestUpdate()},mn),this.host.requestUpdate()}async copy(t){if(!this.lend.busy())try{const s=await he().copyLink(t.id),a=await qt(s.url);this.keep(s,!a),this.lend.say(a?u("lkCopied"):u("lkCopyFailed"),a?"ok":"bad"),this.lend.reload()}catch(s){this.lend.say(N(s),"bad")}}async copyText(){if(!this.copied)return;await qt(this.copied.text)?this.lend.say(u("lkCopied")):this.copied={...this.copied,manual:!0},this.host.requestUpdate()}async setEntry(t,s){this.confirm=null,this.copied=null,await this.lend.run(()=>he().setAccessNeeded(t.id,s,t.revision),s?u("lkEntrySet"):u("lkEntryClear"))}async act(t,s){this.confirm=null,this.copied=null,await this.lend.run(()=>he().linkAction(t.id,s),s==="new"?u("lkNewDone"):u("lkRevoked"))}async resend(t){this.copied=null,await this.lend.run(()=>$e().resendLink(t.id),H("queuedNow"))}stateLine(t){return t.state==="grace"&&t.grace_until?u("lkGraceUntil",{when:M(t.grace_until)}):t.state==="live"?u("lkExpires",{when:M(t.expires_at)}):t.state==="revoked"&&t.revoked_reason?u(`lkReason_${t.revoked_reason}`):""}render(t){const s=t.link;if(!s)return r;const a=s.state==="live"?"ok":s.state==="grace"?"info":"warn",i=s.open_count?u("lkOpened",{n:s.open_count,when:Y(s.last_opened_at??s.first_opened_at??s.created_at)}):u("lkNeverOpened"),o=this.lend.busy(),l=[i,s.devices>1?u("lkDevices",{n:s.devices}):"",s.update_count?u("lkUpdates",{n:s.update_count}):""].filter(Boolean).join(" · ");return n`<div class="lkp" data-link-panel data-link-state=${s.state}>
      <div class="lkh">${f("link")}<b>${u("lkTitle")}</b>
        <span class=${`chip ${a}`} data-link-chip>${u(`lk_${s.state}`)}</span>
        ${s.kind==="staff"?n`<span class="chip tag" data-link-staff>${u("lkStaff")}</span>`:r}
        ${s.require_code?n`<span class="chip tag" data-link-code>${f("lock")}${u("lkCode")}</span>`:r}
        ${s.code_locked?n`<span class="chip warn" data-link-locked>${u("lkCodeLocked")}</span>`:r}
      </div>
      <small class="lkl">${this.stateLine(s)}${s.sent_via==="manual"&&s.state==="live"?` · ${u("lkSentManual")}`:""}</small>
      <small class="lkl" data-link-opened>${l}</small>
      ${this.copied?.manual?n`<div class="lkcopy" data-link-manual>
        <input class="inp" readonly dir="ltr" aria-label=${u("lkCopy")} .value=${this.copied.url} @focus=${d=>d.target.select()} />
        <textarea class="inp" readonly aria-label=${u("lkCopyText")} .value=${this.copied.text} @focus=${d=>d.target.select()}></textarea>
      </div>`:r}
      ${this.confirm?n`<div class="lkconfirm" role="group" data-link-confirm=${this.confirm}>
        <span>${this.confirm==="new"?u("lkNewConfirm"):this.confirm==="entry-off"?u("lkEntryConfirm"):u("lkRevokeConfirm")}</span>
        <span class="lkacts">
          <button type="button" class=${`btn sm ${this.confirm==="revoke"?"danger":"primary"}`} data-link-confirm-ok ?disabled=${o} @click=${()=>this.confirm==="entry-off"?void this.setEntry(t,!1):void this.act(t,this.confirm)}>
            ${this.confirm==="new"?u("lkNew"):this.confirm==="entry-off"?u("lkEntryOff"):u("lkRevoke")}</button>
          <button type="button" class="btn sm" data-link-confirm-back @click=${()=>{this.confirm=null,this.host.requestUpdate()}}>${u("back")}</button>
        </span>
      </div>`:n`<div class="lkacts">
        ${s.can.copy?n`<button type="button" class="btn sm primary" data-link-copy ?disabled=${o} @click=${()=>void this.copy(t)}>${f("copy")}${u("lkCopy")}</button>`:r}
        ${this.copied&&!this.copied.manual?n`<button type="button" class="btn sm" data-link-copy-text @click=${()=>void this.copyText()}>${f("note")}${u("lkCopyText")}</button>`:r}
        ${s.access_needed?.available?n`<button type="button" class="btn sm" data-link-entry aria-pressed=${String(s.access_needed.on)} ?disabled=${o}
          @click=${()=>s.access_needed.on?(this.confirm="entry-off",this.host.requestUpdate()):void this.setEntry(t,!0)}>${f("lock")}${u("lkEntry")}</button>`:r}
        ${s.can.resend?n`<button type="button" class="btn sm" data-link-resend ?disabled=${o} @click=${()=>void this.resend(t)}>${f("send")}${H("lkResend")}</button>`:r}
        ${s.can.new?n`<button type="button" class="btn sm" data-link-new ?disabled=${o} @click=${()=>{this.confirm="new",this.host.requestUpdate()}}>${f("refresh")}${u("lkNew")}</button>`:r}
        ${s.can.revoke?n`<button type="button" class="btn sm quiet dz" data-link-revoke ?disabled=${o} @click=${()=>{this.confirm="revoke",this.host.requestUpdate()}}>${f("x")}${u("lkRevoke")}</button>`:r}
      </div>`}
    </div>`}}const gn=F`
  .lkp {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-block-start: 10px;
    padding: 12px 14px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    min-inline-size: 0;
  }
  .lkh {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .lkl {
    color: var(--dv-text-2);
    font-size: var(--sw-fs-sm);
    overflow-wrap: anywhere;
  }
  .lkacts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .lkconfirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--sw-r-md);
    background: var(--dv-warning-soft);
    font-size: var(--sw-fs-base);
  }
  .lkcopy {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .lkcopy textarea {
    min-block-size: 96px;
  }
`,bn=encodeURIComponent,$n={remove:(e,t)=>Z(`tickets/${bn(e)}/delete`,t),bulkRemove:e=>Z("tickets/bulk-delete",e)};za(e=>e.extendMockView(t=>({...t,can:{...t.can,delete:!0}})));function Ct(){return new j(404,{code:"ticket_not_found",user_message:"",retryable:!1,correlation_id:"",details:{}})}function Tt(e,t){const s=e.all(),a=s.findIndex(l=>l.id===t);if(a<0)return null;const[i]=s.splice(a,1),o=i.events.filter(l=>l.kind==="note").length;return{deleted:!0,id:t,number:i.number,counts:{notes:o,photos:i.attachments.length,files:i.attachments.length,links:0,claims:0}}}const wn={async remove(e,t){const{mockStore:s}=await je(),a=s.find(e);if(!a)throw Ct();if(t.confirm_number!==a.number)throw new j(422,{code:"validation",user_message:"",retryable:!1,correlation_id:"",details:{fields:[{field:"confirm_number",code:"mismatch"}]}});const i=Tt(s,e);if(!i)throw Ct();return i},async bulkRemove(e){const{mockStore:t}=await je(),s=e.ids.map(i=>{const o=Tt(t,i);return o?{id:i,number:o.number,result:"ok"}:{id:i,result:"not_found"}}),a={};for(const i of s)a[i.result]=(a[i.result]??0)+1;return{action:"delete",total:e.ids.length,done:a.ok??0,counts:a,results:s}}};function Nt(){return ue()?$n:wn}const Te=300,Ue=50;function He(e){return e.length===1?e[0].number:e.length}function St(e,t,s){const a=s.trim();return e.length>0&&e.length<=Ue&&t.trim()===String(He(e))&&a.length>0&&a.length<=Te}var yn=Object.defineProperty,kn=Object.getOwnPropertyDescriptor,te=(e,t,s,a)=>{for(var i=a>1?void 0:a?kn(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&yn(t,s,i),i};const _e=new Set;let W=class extends ie{constructor(){super(...arguments),this.bubbleSkin=new ne(this),this.targets=[],this.open=!1,this.typed="",this.reason="",this.error="",this.busy=!1,this.done=!1}connectedCallback(){super.connectedCallback(),le(this)}willUpdate(e){e.has("open")&&this.open&&(this.typed="",this.reason="",this.error="",this.done=!1)}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}close(){this.busy||this.emit("delete-close",{})}async go(){const e=this.targets;if(!St(e,this.typed,this.reason)||this.busy){this.reason.trim()?this.typed.trim()!==String(He(e))&&(this.error=A("mismatch")):this.error=A("required");return}this.busy=!0,this.error="";try{const t=this.reason.trim();if(e.length===1){const s=e[0];let a=s.id,i=s.number;try{const o=await Nt().remove(s.id,{reason:t,confirm_number:s.number,client_request_id:ht()});a=o?.id??s.id,i=o?.number??s.number}catch(o){if(!(o instanceof j&&o.status===404&&_e.has(s.id)))throw o}_e.add(a),this.done=!0,this.emit("ticket-deleted",{id:a,number:i}),this.emit("delete-close",{})}else{const s=await Nt().bulkRemove({ids:e.map(a=>a.id),reason:t,confirm_count:e.length,client_request_id:ht()});for(const a of s.results??[])(a.result==="ok"||a.result==="not_found"&&_e.has(a.id))&&_e.add(a.id);this.done=!0,this.emit("bulk-done",{answer:s}),this.emit("delete-close",{})}}catch(t){this.error=N(t)}finally{this.busy=!1}}render(){if(!this.open||this.done)return r;const e=this.targets,t=e.length===1,s=He(e),a=t?A("title",{n:e[0].number}):A("bulkTitle",{n:e.length}),i=e.length>Ue;return n`<sw-dialog open heading=${a} data-delete-dialog=${t?"one":"bulk"} @close=${()=>this.close()}>
      <div class="form">
        <div class="warn" role="note" data-delete-warn>${f("warning")}<div><b>${A("warn")}</b><span data-delete-goes>${t?A("goes"):A("bulkGoes")}</span></div></div>
        ${i?n`<div class="err" role="alert" data-delete-too-many>${A("tooMany",{max:Ue})}</div>`:r}
        <label class="fld"><span>${t?A("typeNumber",{n:s}):A("typeCount",{n:s})} <b class="req">*</b></span>
          <input class="inp code num" inputmode="numeric" autocomplete="off" maxlength="10" data-delete-confirm .value=${this.typed}
            @input=${o=>{this.typed=o.target.value,this.error=""}} /></label>
        <label class="fld"><span>${A("reason")} <b class="req">*</b></span>
          <textarea class="inp" maxlength=${Te} data-delete-reason .value=${this.reason}
            @input=${o=>{this.reason=o.target.value,this.error=""}}></textarea>
          <small class="hint">${A("reasonHint",{max:Te})} <span class="num" data-delete-left>${this.reason.trim().length}/${Te}</span></small></label>
        ${this.error?n`<div class="err" role="alert" data-delete-error>${this.error}</div>`:r}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn danger" data-delete-go ?disabled=${this.busy||i||!St(e,this.typed,this.reason)} @click=${()=>void this.go()}>${f("trash")}${A("go")}</button>
        <button type="button" class="btn" data-delete-cancel ?disabled=${this.busy} @click=${()=>this.close()}>${A("cancel")}</button>
      </div>
    </sw-dialog>`}};W.styles=[de,...re,ce,me,F`
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .warn {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: color-mix(in srgb, var(--dv-danger) 10%, transparent);
      color: var(--dv-text);
      overflow-wrap: anywhere;
    }
    .warn b {
      display: block;
    }
    .num {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .hint {
      color: var(--dv-text-dim);
      font-size: var(--sw-fs-sm);
    }
    .inp.code {
      max-inline-size: 180px;
      direction: ltr;
      text-align: start;
    }
  `];te([C({attribute:!1})],W.prototype,"targets",2);te([C({type:Boolean})],W.prototype,"open",2);te([g()],W.prototype,"typed",2);te([g()],W.prototype,"reason",2);te([g()],W.prototype,"error",2);te([g()],W.prototype,"busy",2);te([g()],W.prototype,"done",2);W=te([oe("tickets-delete-dialog")],W);function xn(e){return e.label&&e.label.trim()?e.label.trim():e.resource_type==="camera"?(e.camera?.alias||e.camera?.name||e.camera?.name_source||e.resource_id).trim():(e.entity?.name||e.resource_id).trim()}function _n(e,t,s){const a=o=>typeof o=="number"&&Number.isFinite(o)&&o>=-.01&&o<=1.01,i=[];for(const o of e)!a(o.position?.x)||!a(o.position?.y)||i.push({key:`anchor:${o.id}`,kind:"anchor",type:o.resource_type,id:o.id,name:xn(o),x:o.position.x,y:o.position.y,level:o.level_id??null});for(const o of t){const[l,d]=o.position??[];!a(l)||!a(d)||i.push({key:`object:${o.id}`,kind:"object",type:"object",id:o.id,name:s(o),x:l,y:d,level:o.level_id??null})}return i}function zn(e,t,s,a,i=.03){let o=null;for(const l of e){const d=l.x-t,c=(l.y-s)/(a||1),m=Math.hypot(d,c);m<=i&&(!o||m<o.d)&&(o={d:m,e:l})}return o?o.e:null}function qn(e,t){return{element:{floor_id:e,kind:t.kind,id:t.id}}}function Cn(e){return{text:[e.name,e.floor_name,e.room_name??""].map(s=>s.trim()).filter(Boolean).join(" · "),gone:!e.present,canShow:e.present&&!!e.floor_id,vendorImage:e.vendor_image}}var Tn=Object.defineProperty,Nn=Object.getOwnPropertyDescriptor,I=(e,t,s,a)=>{for(var i=a>1?void 0:a?Nn(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&Tn(t,s,i),i};const ss={camera:"camera",ha_entity:"flag",object:"grid"};let Q=class extends ie{constructor(){super(...arguments),this.bubbleSkin=new ne(this),this.ticketId="",this.answer=null,this.picking=!1,this.preview=!1,this.busy=!1,this.error="",this.note="",this.onPicked=e=>{this.picking=!1,this.run(()=>xe.attach(this.ticketId,e.detail.pick,e.detail),S.attached)}}connectedCallback(){super.connectedCallback(),le(this)}willUpdate(e){e.has("ticketId")&&this.ticketId&&(this.answer=null,this.preview=!1,this.note="",this.load())}async load(){const e=this.ticketId;try{const t=await xe.get(e);e===this.ticketId&&(this.answer=t)}catch{e===this.ticketId&&(this.answer=null)}}async run(e,t){if(!this.busy){this.busy=!0,this.error="";try{this.answer=await e(),this.note=t,this.dispatchEvent(new CustomEvent("map-element-changed",{bubbles:!0,composed:!0}))}catch(s){this.error=N(s)}finally{this.busy=!1}}}render(){const e=this.answer;if(!e||!e.element&&!e.can.attach)return r;const t=e.element,s=t?Cn(t):null,a=t?ya(t):null;return n`<section class="sect" data-sect="map" data-map-element=${t?t.present?"present":"gone":"none"}>
      <h4><span class="tag">${f("layers")}</span>${S.section}</h4>
      ${t&&s?n`<div class="mline"><span class="what" data-map-line>${f(ss[t.type])}${x(s.text)}</span></div>
        ${s.gone?n`<div class="gone" data-map-gone>${S.gone}</div>`:r}`:r}
      <div class="acts">
        ${a?n`<a class="btn" href=${a} data-map-show>${f("eye")}${S.show}</a>`:r}
        ${t&&s?.vendorImage?n`<button type="button" class="btn" data-map-preview aria-pressed=${String(this.preview)} @click=${()=>this.preview=!this.preview}>${f("image")}${this.preview?S.vendorPreviewHide:S.vendorPreview}</button>`:r}
        ${e.can.attach?n`<button type="button" class="btn" data-map-pick ?disabled=${this.busy} @click=${()=>this.picking=!0}>${f(t?"edit":"plus")}${t?S.replace:S.add}</button>`:r}
        ${e.can.detach?n`<button type="button" class="btn" data-map-remove ?disabled=${this.busy} @click=${()=>void this.run(()=>xe.detach(this.ticketId),S.removed)}>${f("trash")}${S.remove}</button>`:r}
      </div>
      ${t&&!s?.vendorImage&&!s?.gone?n`<div class="gone" data-map-vendor-text>${S.vendorNoImage}</div>`:r}
      ${this.preview&&t?.vendor_image?n`<figure class="pv" style="margin:10px 0 0" data-map-preview-image><img src=${xe.vendorPreviewUrl(this.ticketId)} alt=${s?.text??""} loading="lazy" decoding="async" /></figure>`:r}
      ${this.error?n`<div class="err" role="alert" data-map-error>${this.error}</div>`:this.note?n`<div class="ok" role="status" data-map-note>${this.note}</div>`:r}
      ${this.picking?n`<ticket-map-picker open @map-picked=${this.onPicked} @close=${()=>this.picking=!1}></ticket-map-picker>`:r}
    </section>`}};Q.styles=[de,...re,ce,F`
    :host { display: block; }
    .mline { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .mline .what { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: var(--dv-text-1); }
    .acts { display: flex; flex-wrap: wrap; gap: 6px; margin-block-start: 8px; }
    .acts a.btn { text-decoration: none; }
    .gone { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
    .pv { margin-block-start: 10px; border: 1px solid var(--dv-border); border-radius: var(--sw-r-lg); overflow: hidden; background: #fff; }
    .pv img { display: block; inline-size: 100%; block-size: auto; }
    .err { color: var(--dv-danger); font-size: var(--sw-fs-sm); }
    .ok { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
  `];I([C({attribute:!1})],Q.prototype,"ticketId",2);I([g()],Q.prototype,"answer",2);I([g()],Q.prototype,"picking",2);I([g()],Q.prototype,"preview",2);I([g()],Q.prototype,"busy",2);I([g()],Q.prototype,"error",2);I([g()],Q.prototype,"note",2);Q=I([oe("ticket-map-element")],Q);let B=class extends ie{constructor(){super(...arguments),this.bubbleSkin=new ne(this),this.open=!1,this.floorId="",this.floors=null,this.floor="",this.bundle=null,this.elements=[],this.chosen=null,this.loading=!1,this.error="",this.onStageClick=e=>{const t=this.bundle,s=e.currentTarget;if(!t)return;const a=s.getBoundingClientRect();if(!a.width||!a.height)return;const i=(e.clientX-a.left)/a.width,o=(e.clientY-a.top)/a.height,l=zn(this.elements,i,o,t.width/t.height,.035);l&&(this.chosen=l)}}connectedCallback(){super.connectedCallback(),le(this)}willUpdate(e){e.has("open")&&this.open&&this.floors===null&&this.loadFloors()}async loadFloors(){try{const e=await $s(),t=e.sites.reduce((a,i)=>a+(i.buildings??[]).length,0)>1;this.floors=e.sites.flatMap(a=>(a.buildings??[]).flatMap(i=>[...i.floors??[]].sort((o,l)=>l.level-o.level).map(o=>({id:o.id,label:t?`${i.name} · ${o.name}`:o.name,hasPlan:o.has_plan}))));const s=this.floors.find(a=>a.id===this.floorId)??this.floors.find(a=>a.hasPlan)??this.floors[0];s&&await this.pickFloor(s.id)}catch(e){this.floors=[],this.error=N(e)}}async pickFloor(e){this.floor=e,this.chosen=null,this.bundle=null,this.elements=[],this.error="",this.loading=!0;try{const t=await ws(e);if(this.floor!==e)return;const s=await Ma(t);if(this.floor!==e)return;this.bundle=t,this.elements=_n(t.anchors,s?.objects??[],a=>a.label&&a.label.trim()||a.item_id)}catch(t){this.error=N(t)}finally{this.loading=!1}}save(){const e=this.chosen,t=this.floors?.find(s=>s.id===this.floor);!e||!this.floor||this.dispatchEvent(new CustomEvent("map-picked",{detail:{pick:qn(this.floor,e),name:e.name,floorName:t?.label??""},bubbles:!0,composed:!0}))}stage(){const e=this.bundle,t=Math.max(e.width,e.height)*.011,s=a=>a.type==="camera"?se.camera:a.type==="ha_entity"?se.entity:se.other;return n`<div class="stage" data-map-stage style=${`aspect-ratio:${e.width} / ${e.height}`} @click=${this.onStageClick}>
      ${e.imageUrl?n`<img src=${e.imageUrl} alt="" />`:e.planSvg?n`<svg viewBox=${`0 0 ${e.width} ${e.height}`} aria-hidden="true">${e.planSvg}</svg>`:r}
      <svg viewBox=${`0 0 ${e.width} ${e.height}`} preserveAspectRatio="none" aria-hidden="true">
        ${this.elements.map(a=>{const i=this.chosen?.key===a.key,o=a.x*e.width,l=a.y*e.height;return n`<g class="dot" data-pick-dot=${a.key}>
            ${i?n`<circle cx=${o} cy=${l} r=${t*2.2} fill=${se.chosen} fill-opacity="0.18" stroke=${se.chosen} stroke-width=${t*.35}></circle>`:r}
            <circle cx=${o} cy=${l} r=${t} fill=${i?se.chosen:s(a)} stroke=${se.ring} stroke-width=${t*.3}></circle></g>`})}
      </svg>
    </div>`}render(){if(!this.open)return r;const e=this.floors,t=this.bundle;return n`<sw-dialog open wide heading=${S.pickTitle} data-map-picker @close=${()=>this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}>
      <div class="form">
        <label class="fld"><span>${S.pickFloor}</span>
          <select class="inp" data-map-floor ?disabled=${!e?.length} @change=${s=>void this.pickFloor(s.target.value)}>
            ${(e??[]).map(s=>n`<option value=${s.id} ?selected=${s.id===this.floor}>${x(s.label)}</option>`)}
          </select></label>
        ${this.loading||e===null?n`<div class="state" role="status" aria-busy="true" data-map-loading>${S.pickLoading}</div>`:t&&t.planStatus==="none"?n`<div class="state" data-map-noplan>${S.pickNoPlan}</div>`:t?n`${this.elements.length?n`<div class="hint">${S.pickHint}</div>`:n`<div class="state" data-map-empty>${S.pickNone}</div>`}
            ${this.stage()}
            ${this.elements.length?n`<div class="list" role="group" aria-label=${S.pickHint}>${this.elements.map(s=>n`<button type="button" class="btn sm" data-pick-item=${s.key}
              aria-pressed=${String(this.chosen?.key===s.key)} @click=${()=>this.chosen=s}>${f(ss[s.type])}${x(s.name)}</button>`)}</div>`:r}`:r}
        ${this.chosen?n`<div class="chosen" data-map-chosen>${f("check")}${S.pickChosen}: ${x(this.chosen.name)}</div>`:r}
        ${this.error?n`<div class="err" role="alert">${this.error}</div>`:r}
      </div>
      <div slot="footer" class="sheetfoot">
        <button type="button" class="btn primary" data-map-save ?disabled=${!this.chosen} @click=${()=>this.save()}>${f("check")}${S.pickSave}</button>
        <button type="button" class="btn" @click=${()=>this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}>${S.pickCancel}</button>
      </div>
    </sw-dialog>`}};B.styles=[de,...re,ce,me,F`
    sw-dialog { --sw-surface: var(--dv-surface-solid); --sw-glass-blur: none; }
    .stage { position: relative; inline-size: 100%; border: 1px solid var(--dv-border); border-radius: var(--sw-r-lg); overflow: hidden; background: #fff;
      direction: ltr; /* map geometry is never mirrored by RTL */ cursor: crosshair; touch-action: manipulation; }
    .stage img { display: block; inline-size: 100%; block-size: auto; user-select: none; -webkit-user-drag: none; pointer-events: none; }
    .stage svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
    .dot { cursor: pointer; }
    .hint, .state { color: var(--dv-text-2); font-size: var(--sw-fs-sm); }
    .chosen { display: flex; align-items: center; gap: 6px; font-weight: 600; }
    .err { color: var(--dv-danger); font-size: var(--sw-fs-sm); }
    .list { display: flex; flex-wrap: wrap; gap: 6px; max-block-size: 132px; overflow: auto; }
    .list button[aria-pressed='true'] { outline: 2px solid var(--dv-accent); }
  `];I([C({type:Boolean})],B.prototype,"open",2);I([C({attribute:!1})],B.prototype,"floorId",2);I([g()],B.prototype,"floors",2);I([g()],B.prototype,"floor",2);I([g()],B.prototype,"bundle",2);I([g()],B.prototype,"elements",2);I([g()],B.prototype,"chosen",2);I([g()],B.prototype,"loading",2);I([g()],B.prototype,"error",2);B=I([oe("ticket-map-picker")],B);const as="dpanel",Ke=e=>`dtab-${e}`;function Et(e,t,s){const a=i=>{const o=getComputedStyle(i.currentTarget).direction==="rtl",l=ia(t,i.key,o);l&&(i.preventDefault(),s(l,!0))};return n`<div class="rtabs" role="tablist" aria-label=${b("tabs")} data-drawer-tabs @keydown=${a}>
    ${e.map(i=>n`<button type="button" role="tab" id=${Ke(i.id)} class=${i.id===t?"on":""} aria-selected=${String(i.id===t)}
      aria-controls=${as} tabindex=${i.id===t?"0":"-1"} aria-label=${i.name} data-tab=${i.id} @click=${()=>s(i.id,!1)}>
      <span>${i.label}</span>${i.badge?n`<span class=${`bdg ${i.tone}`} aria-hidden="true" data-badge=${i.badge}>${i.badge}</span>`:""}
    </button>`)}
  </div>`}const Sn=F`
  .rtabs {
    display: flex;
    gap: 2px;
    padding-inline: 12px;
    border-block-end: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
  }
  .rtabs [role='tab'] {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: 44px;
    padding-inline: 14px;
    border: 0;
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-md);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--mm-motion, 120ms) var(--mm-ease, ease);
  }
  .rtabs [role='tab']:hover {
    color: var(--dv-text);
  }
  .rtabs [role='tab'].on {
    color: var(--dv-accent-text);
  }
  .rtabs [role='tab'].on::after {
    content: '';
    position: absolute;
    inset-inline: 10px;
    inset-block-end: -1px;
    block-size: 2px;
    border-radius: 2px;
    background: var(--dv-accent);
  }
  .rtabs [role='tab']:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: -4px;
    border-radius: var(--sw-r-sm);
  }
  .bdg {
    min-inline-size: 18px;
    block-size: 18px;
    padding-inline: 6px;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    box-sizing: border-box;
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .bdg.info {
    background: var(--dv-accent);
    color: var(--sw-text-inverse);
  }
  .bdg.warn {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dv-warning) 50%, transparent);
  }
  [role='tabpanel']:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: -2px;
  }
  @media (max-width: 767px) {
    .rtabs {
      margin: 10px 14px 4px;
      padding: 3px;
      border: 0;
      border-radius: 999px;
      background: var(--dv-surface-3);
    }
    .rtabs [role='tab'] {
      flex: 1;
      justify-content: center;
      min-block-size: 44px;
      padding-inline: 6px;
      border-radius: 999px;
      font-size: var(--sw-fs-sm);
    }
    .rtabs [role='tab'].on {
      background: var(--mm-seg-thumb, var(--dv-surface-solid));
      color: var(--dv-text);
      box-shadow: var(--dv-shadow-control);
    }
    .rtabs [role='tab'].on::after {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rtabs [role='tab'] {
      transition: none;
    }
  }
`;function Se(e){return ys(e??"")}function Dt(e,t,s){const a=`btn ${e.tone==="quiet"?"quiet":e.tone}`;return n`<button type="button" class=${a} data-action=${e.key} ?data-primary=${s==="primary"} ?data-quiet=${s==="quiet"} ?data-assign=${e.kind==="assign"||e.kind==="reassign"}
    ?disabled=${t.busy} @click=${()=>t.onAction(e)}>${f(e.icon)}<span>${e.label}</span></button>`}function Ot(e,t){const s=Ya(e),a=si(e,t.role,t.now),i=ni(e,t.role),o=Vt(e,t.now).badge,l=e.assignee,d=e.status==="cancelled"||e.status==="returned"?[]:na(e.status);return n`<div class="stat" role="group" aria-label=${b("statusGroup")} data-status-block data-ball=${Xa(e)} data-role=${t.role}>
    <div class="st-top">
      ${l?n`<span class="pair" aria-hidden="true"><span class=${`av sm ${l.kind==="contact"?"ext":"int"}`}>${Se(l.name)}</span></span>`:r}
      <span class=${`chip lg ${s.tone}`} data-status-chip=${e.status}><i class=${`dot ${s.tone==="ok"?"ok":s.tone==="info"?"run":s.tone==="warn"?"warn":""}`}></i>${s.label}${s.sub?n`<span class="subst" data-waiting-sub>${s.sub}</span>`:r}</span>
      <span class="sent" data-sentence aria-live="polite">${x(a)}</span>
      ${o?n`<span class=${`badge sla ${o.tone}`} data-sla=${o.tone}>${f("clock")}${o.text}</span>`:r}
    </div>
    ${i?n`<div class=${`st-warn ${i.tone}`} data-warning=${i.key}>${f("warning")}<span>${i.text}</span></div>`:r}
    ${d.length?n`<ol class="flow" aria-label=${b("flowLabel")} data-flow>
      ${d.map(c=>n`<li class=${`fc ${c.state}`} aria-current=${c.state==="cur"?"step":"false"}>${c.state==="done"?f("check"):r}${c.label}</li>`)}
    </ol>`:r}
    ${t.primary||t.quiet?n`<div class="st-act">
      ${t.primary?Dt(t.primary,t,"primary"):r}
      ${t.quiet?Dt(t.quiet,t,"quiet"):r}
    </div>`:r}
  </div>`}const En=F`
  .stat {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 18px 12px;
    border-block-end: 1px solid var(--dv-border);
    background: linear-gradient(180deg, var(--dv-accent-soft), color-mix(in srgb, var(--dv-accent-soft) 30%, transparent));
  }
  .st-top {
    display: flex;
    align-items: center;
    gap: 8px 10px;
    flex-wrap: wrap;
    min-inline-size: 0;
  }
  .st-top .sent {
    flex: 1 1 220px;
    min-inline-size: 0;
    font-size: var(--sw-fs-lg);
    font-weight: 500;
    line-height: 1.35;
    color: var(--dv-text);
    overflow-wrap: anywhere;
  }
  .chip.lg {
    block-size: 30px;
    padding-inline: 12px;
    font-size: var(--sw-fs-base);
    font-weight: 700;
    flex: none;
  }
  .chip .dot {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  .chip .subst {
    font-weight: 500;
    padding-inline-start: 6px;
    margin-inline-start: 2px;
    border-inline-start: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  }
  .pair {
    display: inline-flex;
    align-items: center;
    flex: none;
  }
  .av {
    inline-size: 36px;
    block-size: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    flex: none;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .av.sm {
    inline-size: 28px;
    block-size: 28px;
    font-size: var(--sw-fs-xs);
  }
  .av.lg {
    inline-size: 44px;
    block-size: 44px;
    font-size: var(--sw-fs-md);
  }
  .av.int {
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .av.ext {
    background: var(--dv-surface-3);
    color: var(--dv-text);
    box-shadow: inset 0 0 0 1px var(--dv-border-strong, var(--dv-border));
  }
  .badge.sla {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    block-size: 26px;
    padding-inline: 10px;
    border-radius: 999px;
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    white-space: nowrap;
    margin-inline-start: auto;
  }
  .badge.sla.warn {
    background: var(--dv-warning-soft);
    color: var(--au-warn-text);
  }
  .badge.sla.bad {
    background: var(--dv-danger-soft);
    color: var(--dv-danger);
  }
  .st-warn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--au-warn-text);
  }
  .st-warn.bad {
    color: var(--dv-danger);
  }
  .st-warn .ic {
    flex: none;
    font-size: var(--sw-fs-md);
  }
  .flow {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .flow .fc {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    block-size: 26px;
    padding-inline: 10px;
    border-radius: 999px;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    background: var(--dv-surface-3);
    color: var(--dv-text-3);
  }
  .flow .fc.done {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .flow .fc.cur {
    background: var(--dv-accent);
    color: var(--sw-text-inverse);
  }
  .flow .fc .ic {
    font-size: var(--sw-fs-xs);
  }
  .st-act {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .st-act .btn {
    min-block-size: 40px;
  }
  /* the mock-up's placement (the quiet push at the start, the primary at the end) while the focus order stays primary → quiet (IA §4.5) */
  .st-act [data-primary] {
    order: 2;
    margin-inline-start: auto;
  }
  .btn.success {
    background: var(--dv-success);
    border-color: transparent;
    color: var(--sw-text-inverse);
    box-shadow: none;
  }
  .btn.danger {
    color: var(--sw-text-inverse);
  }
  @media (max-width: 767px) {
    .stat {
      padding: 12px 14px 10px;
    }
    .st-top .sent {
      font-size: var(--sw-fs-md);
      flex-basis: 100%;
    }
    .badge.sla {
      margin-inline-start: 0;
    }
    .flow .fc {
      block-size: 24px;
      padding-inline: 8px;
    }
    .st-act {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }
    .st-act .btn {
      inline-size: 100%;
      min-block-size: 44px;
    }
    .st-act [data-primary] {
      order: 0;
      margin-inline-start: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .st-act .btn {
      transition: none;
    }
  }
`,Dn=["inbound","late_reply","note","message"];function On(e){for(let t=e.length-1;t>=0;t--){const s=e[t];if(Dn.includes(s.kind)&&s.body&&s.body.trim())return s}return null}function Pn(e){const t=e.cost;if(!t||t.status==="not_required")return null;const s={awaiting:"cs_awaiting",submitted:t.can_decide?"cs_submitted_mine":"cs_submitted",rejected:"cs_rejected",approved:"cs_approved",paid:"cs_paid"},a=t.status==="submitted"?"warn":t.status==="approved"||t.status==="paid"?"ok":t.status==="rejected"?"warn":"info",i=t.can_view&&t.total_minor!=null&&t.currency?De(t.total_minor,t.currency,ke()):"";return{text:b(s[t.status]),tone:a,amount:i}}function Rn(e){return e?e.state==="live"&&e.first_opened_at?{text:b("linkActive",{n:e.open_count}),tone:"ok"}:e.state==="live"?{text:b("linkNotOpened"),tone:""}:{text:b("linkOther"),tone:""}:null}function In(e,t){const s=e.assignee,a=s?.kind==="contact",i=e.assignments.filter(c=>!c.ended_at).at(-1),o=a&&e.link?.kind==="staff",l=s?o?b("roleStaff"):a?b("roleVendor"):b("roleUser"):"",d=a?Rn(e.link):null;return n`<section class="sect" data-ov="people">
    <h4><span class="tag t5">${f("users")}</span>${b("ovPeople")}</h4>
    ${s?n`<div class=${`person ${a?"ext":"int"}`} data-person="handler" data-assignee=${s.id??""}>
      <span class=${`av lg ${a?"ext":"int"}`} aria-hidden="true">${Se(s.name)}</span>
      <div class="pt">
        <div class="nm"><b>${x(s.name)}</b><span class="role">${l}${s.since?` · ${Y(s.since,t.now)}`:""}</span></div>
        ${d||i?.channel==="whatsapp"?n`<div class="meta">
          ${i?.channel==="whatsapp"?n`<span class="chan">${f("send")}WhatsApp</span>`:r}
          ${d?n`<span class=${`chan ${d.tone}`} data-link-line>${f("link")}${d.text}</span>`:r}

        </div>`:r}
      </div>
      ${t.onReassign?n`<button type="button" class="btn sm quiet" data-ov-reassign data-assign ?disabled=${t.busy} @click=${t.onReassign}>${f("refresh")}${b("a_reassign")}</button>`:r}
    </div>`:n`<div class="oline muted" data-person="none">${f("user")}<span>${b("noHandler")}</span></div>`}
    ${Mn(e,t)}
    <div class="oline" data-person="requester"><span class="av xs" aria-hidden="true">${Se(e.created_by.name)}</span>
      <span>${x(b("requesterLine",{who:e.created_by.name,when:M(e.created_at)}))}</span></div>
  </section>`}function Mn(e,t){if(Yi(e)==="hidden")return r;const a=e.internal_owner,i=t.onChangeOwner&&Ge(e)?n`<button type="button" class="btn sm quiet" data-ov-owner-change ?disabled=${t.busy} @click=${t.onChangeOwner}>${f("edit")}${b(a?"ownerChange":"ownerSet")}</button>`:r;return a?n`<div class="oline" data-person="owner" data-owner=${a.id}><span class="av xs" aria-hidden="true">${Se(a.name)}</span>
    <span class="ownertx"><b>${x(a.name)}</b> <span class="muted">${b("ownerLabel")}${a.since?` · ${Y(a.since,t.now)}`:""}${a.active===!1?` · ${b("ownerInactive")}`:""}</span></span>${i}</div>`:n`<div class="oline muted" data-person="owner" data-owner="none">${f("user")}<span>${b("ownerNone")}</span>${i}</div>`}function is(e,t){const s=[],a=(c,m,v,$,D)=>n`<div class="orow" data-now=${c}><span class="oi">${f(m)}</span><div class="ot"><small>${v}</small><div>${$}</div></div>${D??r}</div>`,i=e.status==="closed"||e.status==="cancelled";e.eta_at&&!i&&s.push(a("eta","clock",b("nowEta"),Ht(e.eta_at,t.now)));const o=On(e.events);o&&s.push(a("last",o.kind==="note"?"note":"send",b("nowLast"),n`<b>${x(o.actor.name)}:</b> <span class="clip">${o.body}</span>`,n`<button type="button" class="btn sm quiet" data-now-go="conv" @click=${()=>t.onTab("conv")}>${b("toConv")}</button>`));const l=Pn(e);l&&s.push(a("cost","flag",b("nowCost"),n`<span class=${`chip ${l.tone}`}>${l.text}</span>${l.amount?n`<span class="num muted">${l.amount}</span>`:r}`,n`<button type="button" class="btn sm quiet" data-now-go="costs" @click=${()=>t.onTab("costs")}>${b("toCosts")}</button>`));const d=Vt(e,t.now).row;return d&&s.length<4&&s.push(a("sla","clock",b("nowSla"),n`<span class="muted">${d}</span>`)),s.length?n`<section class="sect" data-ov="now"><h4><span class="tag t3">${f("flag")}</span>${b("ovNow")}</h4>${s.slice(0,4)}</section>`:r}function Ln(e,t){return is(e,t)}function An(e){const t=Ca(e.location?.plan_area);return t?n`<div class="f wide" data-fact="location-map"><a href=${t} data-location-on-map>${f("link")}${fe("showOnMap")}</a></div>`:r}function Fn(e,t){const s=(o,l,d,c=!1)=>d?n`<div class=${`f${c?" wide":""}`} data-fact=${o}><small>${l}</small><span>${x(d)}</span></div>`:r,a=[e.department?.name,e.category?.name].filter(Boolean).join(" · "),i=(e.description??"").length>160||(e.description??"").split(`
`).length>3;return n`<section class="sect" data-ov="facts">
    <h4><span class="tag t2">${f("layers")}</span>${b("ovFacts")}${t.onEdit?n`<button type="button" class="btn sm quiet act" data-edit ?disabled=${t.busy} @click=${t.onEdit}>${f("edit")}${b("a_edit")}</button>`:r}</h4>
    <div class="facts">
      ${s("location",fe("fLocation"),e.location?.text??"",!0)}
      ${An(e)}
      ${s("place",b("fPlace"),e.place_text)}
      ${s("device",b("fDevice"),e.device_name)}
      ${s("dept",b("fDept"),a)}
      ${s("priority",b("fPriority"),e.priority?.name??"")}
      ${s("opened",b("fOpened"),`${M(e.created_at)} · ${e.created_by.name}`)}
      ${jn(e,t)}
      ${e.duplicate_of?n`<div class="f" data-fact="duplicate"><small>${b("fDuplicate")}</small><a href=${t.duplicateHref} data-duplicate-of>${b("sn_duplicate",{n:e.duplicate_of.number})}</a></div>`:r}
      ${e.close_note&&(e.status==="closed"||e.status==="cancelled")?n`<div class="f wide" data-fact="close-note"><small>${b("fCloseNote")}</small><span data-close-note>${e.close_note}</span></div>`:r}
      ${e.description?n`<div class="f wide" data-fact="description"><small>${b("fDescription")}</small>
        <span class=${`desc${t.descOpen?" open":""}`} data-description>${e.description}</span>
        ${i?n`<button type="button" class="btn sm quiet more" aria-expanded=${String(t.descOpen)} data-desc-more @click=${t.onToggleDesc}>${t.descOpen?b("descLess"):b("descMore")}</button>`:r}
      </div>`:r}
    </div>
  </section>`}function jn(e,t){const s=e.rfq_origin;if(!s)return r;const a=b("rfqOrigin",{ref:s.ref}),i=s.siblings.length?n`<small class="muted" data-rfq-siblings>${b("rfqSiblings",{list:""})}${s.siblings.map((d,c)=>n`${c?", ":""}<a href=${t.hrefOf?t.hrefOf(d.id):`#/tickets/${d.id}`} data-rfq-sibling=${d.id}>#${d.number}</a>`)}</small>`:r,o=s.vendor_files??[],l=o.length?n`<small class="muted" data-rfq-vendor-files>${b("rfqVendorFiles")}: ${o.map((d,c)=>n`${c?", ":""}<a
    href=${qa(e.id,d.id)} download rel="noopener noreferrer" data-rfq-vendor-file=${d.id}>${x(d.name)}</a>`)}</small>`:r;return n`<div class="f wide" data-fact="rfq-origin"><small>${b("fRfqOrigin")}</small>
    <span>${s.id?n`<a href=${`#/tickets/rfqs?rfq=${encodeURIComponent(s.id)}`} data-rfq-origin=${s.id}>${a}</a>`:n`<span data-rfq-origin>${a}</span>`}</span>${i}${l}</div>`}function Bn(e,t){return n`<div class="one" data-tab-content="overview">
    ${In(e,t)}
    ${t.link}
    ${is(e,t)}
    ${Fn(e,t)}
    ${t.photos}
    ${t.device!==r?n`<details class="fold" data-ov="device"><summary><span class="tag t2">${f("clock")}</span>${b("ovDevice")}${f("chevronDown","chev")}</summary>${t.device}</details>`:r}
  </div>`}const Un=F`
  .one {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-inline-size: 0;
  }
  .sect > h4 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: 28px;
  }
  .sect > h4 .act {
    margin-inline-start: auto;
  }
  .person {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px 12px;
    align-items: center;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface);
    border: 1px solid var(--dv-border);
    border-inline-start: 3px solid var(--dv-text-3);
  }
  .person.int {
    border-inline-start-color: var(--dv-accent);
  }
  .person .pt {
    min-inline-size: 0;
  }
  .person .nm {
    display: flex;
    align-items: baseline;
    gap: 4px 8px;
    flex-wrap: wrap;
  }
  .person .nm .role {
    color: var(--dv-text-3);
    font-size: var(--sw-fs-sm);
    font-weight: 500;
  }
  .person .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-block-start: 4px;
  }
  .chan {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-block-size: 26px;
    padding-inline: 9px;
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .chan.ok {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .chan .ic {
    font-size: var(--sw-fs-sm);
  }
  .oline {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    min-inline-size: 0;
  }
  .oline .btn {
    margin-inline-start: auto;
    flex: none;
  }
  .ownertx {
    flex: 1 1 auto;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .av.xs {
    inline-size: 24px;
    block-size: 24px;
    font-size: var(--sw-fs-xs);
  }
  .orow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--dv-surface);
    border: 1px solid var(--dv-border);
    min-inline-size: 0;
  }
  .orow .oi {
    flex: none;
    inline-size: 32px;
    block-size: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .orow .ot {
    flex: 1;
    min-inline-size: 0;
  }
  .orow .ot small {
    display: block;
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
    font-weight: 600;
  }
  .orow .ot > div {
    display: flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    font-size: var(--sw-fs-md);
  }
  .orow .ot > div b {
    flex: 0 0 auto;
    max-inline-size: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .orow .clip {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .orow .btn {
    flex: none;
  }
  .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 14px;
  }
  .facts .f {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  .facts .f small {
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3);
    font-weight: 600;
  }
  .facts .f > span {
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .facts .f.wide {
    grid-column: 1 / -1;
  }
  .facts .desc {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-line;
    line-height: 1.5;
  }
  .facts .desc.open {
    display: block;
  }
  .facts .more {
    align-self: flex-start;
  }
  details.fold {
    border-radius: var(--sw-r-lg);
  }
  details.fold > summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: 44px;
    cursor: pointer;
    list-style: none;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--dv-text-2);
  }
  details.fold > summary::-webkit-details-marker {
    display: none;
  }
  details.fold > summary .chev {
    margin-inline-start: auto;
    transition: transform var(--mm-motion, 120ms);
  }
  details.fold:not([open]) > summary .chev {
    transform: rotate(90deg);
  }
  details.fold > summary:focus-visible {
    outline: 2px solid var(--dv-focus, var(--dv-accent));
    outline-offset: 2px;
    border-radius: var(--sw-r-sm);
  }
  @media (max-width: 767px) {
    .facts {
      grid-template-columns: minmax(0, 1fr);
    }
    .person {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .person > .btn {
      grid-column: 1 / -1;
      min-block-size: 44px;
    }
    .orow .btn {
      min-block-size: 44px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    details.fold > summary .chev {
      transition: none;
    }
  }
`,ns="sw.tickets.drawerSize";function Pt(){try{return oa(globalThis.localStorage?.getItem(ns))}catch{return null}}function Hn(e){try{globalThis.localStorage?.setItem(ns,e)}catch{}}var Kn=Object.defineProperty,Vn=Object.getOwnPropertyDescriptor,z=(e,t,s,a)=>{for(var i=a>1?void 0:a?Vn(t,s):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(a?l(t,s,i):l(i))||i);return a&&i&&Kn(t,s,i),i};const Wn=4,Qn="(max-width: 767px)";let _=class extends ie{constructor(){super(...arguments),this.bubbleSkin=new ne(this),this.ticketId="",this.mode="drawer",this.open=!1,this.detailMode="drawer_fullscreen",this.scope="mine",this.focusTimeline=!1,this.initialTab="",this.defaultTab="",this.sizeSetting="",this.sheetSetting="",this.assignContact="",this.cameraViewfinder=!1,this.assignedFor="",this.t=null,this.failed="",this.gone=!1,this.busy=!1,this.dialog=null,this.flash=null,this.uploading=0,this.tab="overview",this.size="wide",this.sheet="full",this.phone=!1,this.menu=!1,this.descOpen=!1,this.photosAll=!1,this.dlgText="",this.costGate=null,this.dlgOverride="",this.dlgNumber="",this.dlgError="",this.dlgPick="",this.dlgMsg="",this.dlgReturnKind="cannot_handle",this.eligible=null,this.ownerPick=null,this.deleting=!1,this.meta=null,this.edit=null,this.editLocs=null,this.loadedFor="",this.flashTimer=0,this.offNames=null,this.mq=null,this.ext=new hn(this,{busy:()=>this.busy,run:(e,t)=>this.run(e,t)}),this.linkPanel=new vn(this,{busy:()=>this.busy,run:(e,t)=>this.run(e,t||void 0),say:(e,t)=>this.say(e,t),reload:()=>void this.load()}),this.conv=new Hi(this,{busy:()=>this.busy,run:(e,t)=>this.run(e,t),upload:(e,t)=>this.uploadFiles(e,t),uploading:()=>this.uploading,onTab:e=>this.selectTab(e,!1)}),this.history=new ln(this),this.onMq=e=>{this.phone=e.matches},this.onAction=e=>{const t=this.t;if(this.setMenu(!1),!!t)switch(e.kind){case"assign":case"reassign":this.openDialog({kind:"assign"});return;case"move":case"toggle_wait":case"close":case"cancel":case"reopen":e.to&&this.move(e.to);return;case"costs":case"conv":this.selectTab(e.tab??(e.kind==="costs"?"costs":"conv"),!1),e.kind==="conv"&&this.conv.focusComposer(t,t.assignee?.kind==="contact"?"vendor":"team");return;case"resend_link":this.run(()=>$e().resendLink(t.id),b("a_resend"));return;case"eta":this.openDialog({kind:"eta"});return;case"return":this.openDialog({kind:"return"});return;case"edit":this.openDialog({kind:"edit"});return;case"delete":this.deleting=!0;return;case"page":window.location.href=Oe(t.id);return}},this.placeMenu=()=>{if(!this.menu)return;const e=this.renderRoot.querySelector(".pop.ov"),t=this.renderRoot.querySelector("[data-more]");e&&t&&Ba(e,t)},this.onOutside=e=>{if(!this.menu)return;const t=e.composedPath(),s=this.renderRoot.querySelector(".pop.ov"),a=this.renderRoot.querySelector("[data-more]");s&&t.includes(s)||a&&t.includes(a)||this.setMenu(!1)},this.onMenuKey=e=>{if(e.key==="Escape"){e.stopPropagation(),this.setMenu(!1),this.renderRoot.querySelector("[data-more]")?.focus();return}if(e.key==="Tab"){this.setMenu(!1);return}Ua(e,e.currentTarget)},this.onDialogClose=e=>{e.stopPropagation(),this.closeDialog()},this.onDeleted=()=>{const e=this.ticketId;this.deleting=!1,this.t=null,this.gone=!0,this.dispatchEvent(new CustomEvent("ticket-gone",{detail:{id:e,deleted:!0},bubbles:!0,composed:!0})),this.mode!=="page"&&this.close(),this.mode==="page"&&(window.location.href=ve(this.scope))},this.openViewfinder=()=>{this.renderRoot.querySelector("ticket-camera-viewfinder")?.start()},this.onCameraPhoto=e=>{e.stopPropagation(),this.uploadFiles([e.detail.file],!1)},this.onCameraFailed=e=>{e.stopPropagation(),this.say(ra(e.detail.reason),"bad")}}connectedCallback(){super.connectedCallback(),le(this),this.offNames=Ee(()=>this.requestUpdate()),this.size=rt(Pt(),this.sizeSetting),typeof window<"u"&&window.matchMedia&&(this.mq=window.matchMedia(Qn),this.phone=this.mq.matches,this.mq.addEventListener?.("change",this.onMq)),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("resize",this.placeMenu)}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.flashTimer),this.offNames?.(),this.mq?.removeEventListener?.("change",this.onMq),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("resize",this.placeMenu)}willUpdate(e){e.has("sizeSetting")&&(this.size=rt(Pt(),this.sizeSetting)),e.has("open")&&!this.open&&this.mode==="drawer"&&(this.loadedFor=""),(e.has("ticketId")||e.has("open"))&&this.ticketId&&(this.mode==="page"||this.open)&&this.loadedFor!==this.ticketId?(this.loadedFor=this.ticketId,this.t=null,this.failed="",this.gone=!1,this.dialog=null,this.menu=!1,this.descOpen=!1,this.photosAll=!1,this.tab=lt({deepLink:this.initialTab,focusTimeline:this.focusTimeline,setting:this.defaultTab}),this.sheet=la(this.sheetSetting)??"full",this.linkPanel.reset(),this.conv.reset(),this.history.reset(),this.load()):e.has("initialTab")&&this.initialTab&&this.t&&(this.tab=lt({deepLink:this.initialTab,setting:this.defaultTab}))}async load(){const e=this.ticketId;try{const t=await O().get(e);if(e!==this.ticketId)return;this.t=t,this.assignContact&&this.assignedFor!==e&&t.can.assign&&(this.assignedFor=e,this.openDialog({kind:"assign"}),this.ext.preselect(this.assignContact),this.dispatchEvent(new CustomEvent("assign-consumed",{detail:{id:e},bubbles:!0,composed:!0}))),this.focusTimeline&&this.updateComplete.then(()=>this.renderRoot.querySelector("#timeline")?.scrollIntoView({block:"start"}))}catch(t){if(e!==this.ticketId)return;t instanceof j&&t.status===404?this.gone=!0:this.failed=N(t)}}say(e,t="ok"){this.flash={text:e,tone:t},window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.flash=null,t==="bad"?7e3:3500)}async run(e,t){if(this.busy)return!1;this.busy=!0;try{const s=await e();return"view"in s&&s.view==="none"?(this.dispatchEvent(new CustomEvent("ticket-gone",{detail:{id:this.ticketId},bubbles:!0,composed:!0})),this.gone=!0,this.t=null):(this.t=s,this.dispatchEvent(new CustomEvent("ticket-changed",{detail:{ticket:this.t},bubbles:!0,composed:!0}))),t&&this.say(t),!0}catch(s){if(s instanceof j&&s.code==="cost_claim_pending"&&this.dialog?.kind==="move"){const a=s.body.details;return this.costGate={canOverride:!!a?.can_override},this.dlgError=N(s),!1}return this.say(N(s),"bad"),s instanceof j&&(s.status===409||s.status===404)&&this.load(),!1}finally{this.busy=!1}}move(e){const t=this.t;if(!t)return;const s=ks(t,e);if(s.allowed){if(e==="closed"||e==="cancelled"||e==="new"&&t.status==="closed"||s.noteRequired){this.openDialog({kind:"move",to:e,noteRequired:s.noteRequired});return}this.run(()=>O().status(t.id,{to:e,revision:t.revision}),u("saved"))}}selectTab(e,t){this.tab=e,this.updateComplete.then(()=>{t&&this.renderRoot.querySelector(`#${Ke(e)}`)?.focus();const s=this.scrollBox();s&&(s.scrollTop=e==="conv"?s.scrollHeight:0)})}scrollBox(){return this.renderRoot.querySelector("sw-drawer")?.shadowRoot?.querySelector(".body")??null}setSize(e){this.size=e,Hn(e)}setMenu(e){if(this.menu!==e)if(this.menu=e,e)this.updateComplete.then(()=>{this.placeMenu(),this.renderRoot.querySelector('.pop.ov [role="menuitem"]')?.focus()});else{const t=this.renderRoot.querySelector(".pop.ov");try{t?.hidePopover?.()}catch{}}}openDialog(e){this.dlgText="",this.dlgNumber="",this.dlgError="",this.dlgPick="",this.dlgMsg="",this.dlgReturnKind="cannot_handle",this.costGate=null,this.dlgOverride="",this.dialog=e;const t=this.t;if(t&&(e.kind==="assign"&&(this.eligible=null,this.ext.reset(),O().assignees(t.department?.id??"",t.id).then(s=>{this.eligible=ut(s),this.ext.take(s,t)}).catch(s=>{this.eligible=[],this.dlgError=N(s)})),e.kind==="owner"&&(this.eligible=null,this.ownerPick=null,O().assignees(t.department?.id??"",t.id).then(s=>{this.eligible=ut(s)}).catch(s=>{this.eligible=[],this.dlgError=N(s)})),e.kind==="eta"&&(this.dlgText=xs(t.eta_at)),e.kind==="edit")){const s=t.can.edit_fields.includes("place_text"),a=Ta(t.location?.id,s?t.place_text:"");this.edit={title:t.title,description:t.description,department_id:t.department?.id??"",category_id:t.category?.id??"",priority_id:t.priority?.id??"",pick:a,place:s?t.place_text:"",startPick:a,startPlace:s?t.place_text:""},this.meta||O().meta().then(i=>this.meta=i).catch(()=>{}),this.editLocs=null,t.can.edit_fields.includes("location_id")&&Na().list().then(i=>{this.editLocs=i,!i.locations.length&&this.edit&&this.edit.startPick===""&&(this.edit={...this.edit,pick:ft,startPick:ft})}).catch(()=>{this.editLocs=null})}}closeDialog(){this.dialog=null,this.edit=null}async submitMove(e,t){const s=this.t;if(!s)return;const a=this.dlgText.trim();if((t||e==="cancelled")&&!a){this.dlgError=u("required");return}let i=null;if(e==="cancelled"&&this.dlgNumber.trim()){const d=Number(this.dlgNumber.trim().replace(/^#/,"")),c=Number.isInteger(d)&&d>0?(await O().list({scope:"visible",status:"all",q:String(d),limit:20}).catch(()=>null))?.items.find(m=>m.number===d):void 0;if(!c||c.id===s.id){this.dlgError=u("duplicateNotFound");return}i=c.id}const o=e==="closed"&&this.costGate?.canOverride?this.dlgOverride.trim():"";if(e==="closed"&&this.costGate?.canOverride&&!o){this.dlgError=u("required");return}const l={to:e,note:a||null,duplicate_of:i,revision:s.revision,...o?{override_claim_reason:o}:{}};await this.run(()=>O().status(s.id,l),u("saved"))&&this.closeDialog()}async submitOwner(){const e=this.t;if(!e||this.busy)return;const t=_t(this.ownerPick,e.internal_owner,this.dlgText,e.revision);if(!t){this.dlgError=u("required");return}this.busy=!0,this.dlgError="";try{await Gi.change(e.id,t),this.closeDialog(),await this.load(),this.t&&this.dispatchEvent(new CustomEvent("ticket-changed",{detail:{ticket:this.t},bubbles:!0,composed:!0})),this.say(b("ownerSaved"))}catch(s){this.dlgError=N(s),s instanceof j&&s.status===409&&s.code==="ticket_stale"&&await this.load()}finally{this.busy=!1}}ownerDialog(e,t,s){const a=e.internal_owner??null,i=this.eligible===null?null:Xi(this.eligible,a),o=this.ownerPick,l=_t(o,a,this.dlgText,e.revision),d=o?i?.find(m=>m.id===o)?.name??"":"",c=(m,v,$,D)=>n`<label data-owner-choice=${$}>
      <input type="radio" name="owner" .checked=${o===m} @change=${()=>{this.ownerPick=m,this.dlgError=""}} />${v}${D?n` <small>${D}</small>`:r}</label>`;return n`<sw-dialog open heading=${b("ownerTitle")} data-dialog="owner" @close=${this.onDialogClose}>
      <div class="form">
        <p class="muted" data-owner-help>${b("ownerHelp")}</p>
        ${i===null?n`<span class="skl" style="block-size:44px"></span>`:n`<div class="pick" role="radiogroup" aria-label=${b("ownerPick")} data-owner-pick>
            ${i.map(m=>c(m.id,x(m.name),m.id,m.id===a?.id?b("ownerCurrent"):m.member_role==="manager"?u("depManager"):void 0))}
            ${a?c("",b("ownerNoOne"),"none"):r}
            ${i.length||a?r:n`<div data-owner-none>${b("ownerNoCandidates")}</div>`}</div>`}
        <label class="fld"><span>${b("ownerReason")}</span>
          <textarea class="inp" maxlength="2000" data-owner-reason .value=${this.dlgText} @input=${m=>{this.dlgText=m.target.value,this.dlgError=""}}></textarea></label>
        ${l?n`<div class="banner info" role="status" data-owner-confirm>${f("check")}<div>${o?x(b("ownerConfirm",{name:d})):b("ownerConfirmClear")}</div></div>`:r}
        ${t}</div>
      ${s(n`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy||!l} @click=${()=>void this.submitOwner()}>${f("user")}${b("ownerSave")}</button>`)}
    </sw-dialog>`}async submitAssign(){const e=this.t,t=en({internalNote:this.dlgText,handlerMessage:this.dlgMsg,applies:this.handlerMessageOn()});if(e&&this.ext.outside){await this.ext.submit(e,t.note??"")&&(t.message&&await this.sendHandlerMessage(e.id,t.message),this.closeDialog());return}const s=this.pickedHandler();if(!e||!s){this.dlgError=u("required");return}await this.run(()=>O().assign(e.id,{assignee:xa(s),note:t.note,note_external:t.note_external,revision:e.revision}),u("saved"))&&(t.message&&await this.sendHandlerMessage(e.id,t.message),this.closeDialog())}handlerMessageOn(){const e=this.ext.outside?null:this.pickedHandler();return Zi({outside:this.ext.outside,pickedStaff:!!e&&!e.account})}async sendHandlerMessage(e,t){this.busy=!0;try{await Qe().vendorMessage(e,t,{notify:!1});const s=await O().get(e);this.t=s,this.dispatchEvent(new CustomEvent("ticket-changed",{detail:{ticket:this.t},bubbles:!0,composed:!0}))}catch{this.say(u("asgMsgFailed"),"bad")}finally{this.busy=!1}}pickedHandler(){return this.groupHandlers().find(e=>e.key===this.dlgPick)??null}groupHandlers(){const e=this.ext.kind==="employee";return(this.eligible??[]).filter(t=>t.account!==e)}async submitReturn(){const e=this.t;if(!e)return;const t=this.dlgText.trim();if(!t){this.dlgError=u("required");return}await this.run(()=>O().giveBack(e.id,{kind:this.dlgReturnKind,reason:t,revision:e.revision}),u("saved"))&&this.closeDialog()}async submitEdit(){const e=this.t,t=this.edit;if(!e||!t)return;if(!t.title.trim()){this.dlgError=u("createNeed");return}const s=new Set(e.can.edit_fields),a={revision:e.revision};if(s.has("title")&&t.title.trim()!==e.title&&(a.title=t.title.trim()),s.has("description")&&t.description!==e.description&&(a.description=t.description),s.has("department_id")&&t.department_id&&t.department_id!==e.department?.id&&(a.department_id=t.department_id),s.has("category_id")&&(t.category_id||null)!==(e.category?.id??null)&&(a.category_id=t.category_id||null),s.has("priority_id")&&t.priority_id&&t.priority_id!==e.priority?.id&&(a.priority_id=t.priority_id),s.has("location_id")){if(Sa(t.pick,t.place)){this.dlgError=fe("err_too_long");return}Object.assign(a,Ea(t.startPick,t.startPlace,t.pick,t.place,s.has("place_text")))}if(Object.keys(a).length===1){this.closeDialog();return}await this.run(()=>O().patch(e.id,a),u("saved"))&&this.closeDialog()}async submitEta(e){const t=this.t;if(!t)return;const s=e?null:_s(this.dlgText)||null;if(!e&&!s){this.dlgError=u("required");return}await this.run(()=>O().eta(t.id,s),u("saved"))&&this.closeDialog()}async onFiles(e){const t=e.target,s=[...t.files??[]];t.value="",await this.uploadFiles(s,!1)}async uploadFiles(e,t){const s=this.t;if(!s||!e.length)return;let a=0;for(const i of e){this.uploading+=1;try{const o=await O().upload(s.id,i,t);this.t=o}catch(o){a+=1,this.say(N(o),"bad")}finally{this.uploading-=1}}this.t&&this.dispatchEvent(new CustomEvent("ticket-changed",{detail:{ticket:this.t},bubbles:!0,composed:!0})),a>1&&this.say(u("photosFailed",{n:a}),"bad")}removePhoto(e){const t=this.t;t&&this.run(()=>O().removePhoto(t.id,e))}close(){this.dispatchEvent(new CustomEvent("drawer-close",{bubbles:!0,composed:!0}))}deleteDialog(e){return e.can.delete?n`<tickets-delete-dialog .targets=${[{id:e.id,number:e.number}]} ?open=${this.deleting}
      @delete-close=${()=>this.deleting=!1} @ticket-deleted=${this.onDeleted}></tickets-delete-dialog>`:r}actions(e){const t=Ka(e),s=da(e,t),a=ca(e,t,s),i=pa(e,t,[s,a],{detailMode:this.detailMode,page:this.mode==="page"});return{role:t,primary:s,quiet:a,menu:i}}subLine(e){const t=Pe(e.priority),s=e.place_text||[e.department?.name,e.category?.name].filter(Boolean).join(" · ");return n`<span class="id" data-ticket-number>#${e.number}</span>
      ${s?n`<span>·</span><span>${f("layers")} ${x(s)}</span>`:r}
      ${e.priority?n`<span class=${`chip ${t}`} data-chip="priority"><i class=${`dot ${t==="bad"?"bad":t==="info"?"run":""}`}></i>${e.priority.name}</span>`:r}`}moreButton(){return n`<button type="button" class="rb sm" aria-label=${b("more")} aria-haspopup="menu" aria-expanded=${String(this.menu)} data-more
      @click=${()=>this.setMenu(!this.menu)}>${f("dots")}</button>`}sizeSwitch(){const e=(t,s)=>n`<button type="button" aria-pressed=${String(this.size===t)} aria-label=${b(`size_${t}`)} title=${b(`size_${t}`)}
      data-size-btn=${t} @click=${()=>this.setSize(t)}>${f(s)}</button>`;return n`<span class="sizes" role="group" aria-label=${b("size")}>${e("drawer","layers")}${e("wide","grid")}${e("full","expand")}</span>`}sheetToggle(){const e=this.sheet==="full";return n`<button type="button" class="rb sm" aria-label=${e?b("sheetHalf"):b("sheetFull")} aria-pressed=${String(e)} data-sheet-toggle=${this.sheet}
      @click=${()=>this.sheet=e?"half":"full"}>${f(e?"shrink":"expand")}</button>`}menuPopover(e,t){if(!this.menu)return r;const s=t.findIndex(i=>i.kind==="move"),a=(i,o)=>{const l=o===s?n`<div class="mh" role="presentation">${b("moveGroup")}</div>`:r,d=i.kind==="cancel"||i.kind==="delete"&&!t.some(m=>m.kind==="cancel")?n`<hr role="separator" />`:r,c=i.tone==="danger"?"dz":"";return i.kind==="page"?n`${l}${d}<a role="menuitem" class=${c} href=${Oe(e.id)} data-menu-item=${i.key} data-full-screen>${f(i.icon)}${i.label}</a>`:n`${l}${d}<button type="button" role="menuitem" class=${c} data-menu-item=${i.key} ?disabled=${this.busy}
        data-move=${i.kind==="move"&&i.to?i.to:r}
        ?data-assign=${i.kind==="assign"||i.kind==="reassign"} ?data-return=${i.kind==="return"} ?data-eta-edit=${i.kind==="eta"} ?data-edit=${i.kind==="edit"}
        ?data-cancel=${i.kind==="cancel"} ?data-reopen=${i.kind==="reopen"} ?data-delete-ticket=${i.kind==="delete"}
        data-waiting-toggle=${i.kind==="toggle_wait"?i.to==="waiting_part"?"mark":"back":r}
        @click=${()=>this.onAction(i)}>${f(i.icon)}${i.label}</button>`};return n`<div class="pop ov" popover="manual" role="menu" aria-label=${b("more")} data-drawer-menu data-nested-open @keydown=${this.onMenuKey}>
      ${t.map(a)}
    </div>`}photosSection(e){if(!e.attachments.length&&!e.can.attach)return r;const t=ye(e),s=this.photosAll?e.attachments:e.attachments.slice(0,Wn),a=e.attachments.length-s.length;return n`<section class="sect" data-sect="photos">
      <h4><span class="tag">${f("image")}</span>${u("sPhotos")}<span class="cnt">${e.attachments.length||""}</span></h4>
      <div class="photos">
        ${J(s,i=>i.id,(i,o)=>n`<figure class="ph" data-photo=${i.id} style="margin:0">
          <img src=${O().photoUrl(i)} alt=${u("photoAlt",{n:o+1})} loading="lazy" decoding="async" />
          ${t&&!i.external?n`<span class="chip tag">${f("lock")}${u("internal")}</span>`:r}
          ${i.can_delete?n`<button type="button" class="rm" aria-label=${u("removePhoto")} data-photo-remove ?disabled=${this.busy} @click=${()=>this.removePhoto(i.id)}>${f("trash")}</button>`:r}
        </figure>`)}
        ${a>0?n`<button type="button" class="ph photos-more" aria-label=${b("photosAll")} data-photos-more @click=${()=>this.photosAll=!0}>${b("photosMore",{n:a})}</button>`:r}
        ${e.can.attach?n`<label class="ph add" data-photo-add>${f(this.uploading?"clock":"camera")}<span>${this.uploading?u("uploading"):u("addPhoto")}</span>
          <input type="file" accept="image/jpeg,image/png" multiple ?disabled=${this.uploading>0} aria-label=${u("addPhoto")} @change=${this.onFiles} /></label>`:r}
        ${this.liveCameraTile(e)}
      </div>
    </section>`}liveCameraTile(e){return ua(this.cameraViewfinder,e.can.attach,ha())?n`<button type="button" class="ph add live" data-camvf-open ?disabled=${this.uploading>0} @click=${this.openViewfinder}>${f("eye")}<span>${fa("open")}</span></button>
      <ticket-camera-viewfinder .enabled=${this.cameraViewfinder} @camera-photo=${this.onCameraPhoto} @camera-failed=${this.onCameraFailed}></ticket-camera-viewfinder>`:r}flashRow(){return this.flash?n`<div class=${`banner flash ${this.flash.tone==="bad"?"bad":"info"}`} role=${this.flash.tone==="bad"?"alert":"status"} data-flash=${this.flash.tone}>${f(this.flash.tone==="bad"?"warning":"check")}<div>${this.flash.text}</div></div>`:r}overviewCtx(e){return{now:new Date,busy:this.busy,descOpen:this.descOpen,onToggleDesc:()=>this.descOpen=!this.descOpen,onTab:t=>this.selectTab(t,!1),onReassign:e.can.assign&&e.assignee?()=>this.openDialog({kind:"assign"}):null,onEdit:e.can.edit_fields.length?()=>this.openDialog({kind:"edit"}):null,onChangeOwner:Ge(e)?()=>this.openDialog({kind:"owner"}):null,duplicateHref:e.duplicate_of?this.hrefOf(e.duplicate_of.id):"",hrefOf:t=>this.hrefOf(t),link:this.linkPanel.render(e),photos:this.photosSection(e),device:_a(e.device_context)}}tabContent(e){switch(this.tab){case"conv":return n`<div class="one" data-tab-content="conv" data-slot="conv">${this.conv.render(e)}</div>`;case"costs":return n`<div class="one" data-tab-content="costs" data-slot="costs"><ticket-costs-tab .ticket=${e} @cost-changed=${()=>void this.load()}></ticket-costs-tab></div>`;case"history":return n`<div class="one" data-tab-content="history" data-slot="history">${this.history.render(e,{link:this.linkPanel.render(e)})}</div>`;default:return n`${nn(e,{busy:this.busy,onNew:()=>void this.run(()=>an(e.id),Ce("done"))})}${Bn(e,this.overviewCtx(e))}
          <ticket-map-element .ticketId=${e.id}></ticket-map-element>`}}panel(e){return n`<div class="panel stack" role="tabpanel" id=${as} aria-labelledby=${Ke(this.tab)} tabindex="0"
      data-ticket-detail=${e.id} data-view=${e.view} data-tab-panel=${this.tab}>
      ${this.tabContent(e)}
    </div>`}handlerMessageField(){const e=u(Ji({outside:this.ext.outside,vendor:this.ext.pickedVendor})==="vendor"?"asgMsgVendor":"asgMsgHandler"),t=ts(this.dlgMsg,!0);return n`<label class="fld" data-assign-message><span>${e}</span>
        <textarea class="inp" maxlength=${es} data-dialog-message .value=${this.dlgMsg} @input=${s=>{this.dlgMsg=s.target.value}}></textarea></label>
      <span class="muted" data-assign-message-hint>${f("send")}${u("asgMsgHint")}</span>
      ${t?n`<div class="xinfo" data-assign-message-preview><span class="muted">${u("asgMsgPreview")}</span><pre class="pv" dir="auto" data-message-text>${t}</pre></div>`:r}`}dialogs(){const e=this.dialog,t=this.t;if(!e||!t)return r;const s=this.dlgError?n`<div class="err" role="alert" data-dialog-error>${this.dlgError}</div>`:r,a=o=>n`<div slot="footer" class="sheetfoot">${o}<button type="button" class="btn" data-dialog-cancel @click=${()=>this.closeDialog()}>${u("back")}</button></div>`,i=(o,l)=>n`<label class="fld"><span>${o}${l?n` <b class="req">*</b>`:r}</span>
      <textarea class="inp" maxlength="2000" data-dialog-text .value=${this.dlgText} @input=${d=>{this.dlgText=d.target.value,this.dlgError=""}}></textarea></label>`;if(e.kind==="owner")return this.ownerDialog(t,s,a);if(e.kind==="move"){const o=e.to==="closed"?u("closeTitle"):e.to==="cancelled"?u("cancelTitle"):u("reopenTitle"),l=e.to==="closed"?e.noteRequired?u("closeReason"):u("closeSummary"):e.to==="cancelled"?u("reason"):u("reasonOptional"),d=e.to==="closed"?u("closeAction"):e.to==="cancelled"?u("cancelTicket"):u("reopen");return n`<sw-dialog open heading=${o} data-dialog="move" data-to=${e.to} @close=${this.onDialogClose}>
        <div class="form">${i(l,e.noteRequired||e.to==="cancelled")}
          ${e.to==="closed"&&this.costGate?n`<div class="fld" data-cost-gate=${this.costGate.canOverride?"override":"blocked"}><b>${p("gateTitle")}</b>
            ${this.costGate.canOverride?n`<label class="fld"><span>${p("gateOverride")} - ${p("gateReason")} <b class="req">*</b></span>
              <textarea class="inp" maxlength="500" data-cost-override .value=${this.dlgOverride} @input=${c=>{this.dlgOverride=c.target.value,this.dlgError=""}}></textarea></label>`:r}</div>`:r}
          ${e.to==="cancelled"?n`<label class="fld"><span>${u("duplicateOf")}</span><input class="inp" inputmode="numeric" maxlength="12" data-dialog-number .value=${this.dlgNumber} @input=${c=>{this.dlgNumber=c.target.value,this.dlgError=""}} /></label>`:r}
          ${s}</div>
        ${a(n`<button type="button" class=${`btn ${e.to==="cancelled"?"danger":"primary"}`} data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.submitMove(e.to,e.noteRequired)}>${d}</button>`)}
      </sw-dialog>`}if(e.kind==="assign"){const o=this.ext.outside,l=v=>this.eligible===null?null:this.eligible.filter($=>$.account!==v).length,d=this.groupHandlers(),c=this.eligible===null?null:this.ext.blocked(t,this.ext.kind,d.length),m=o?null:this.pickedHandler();return n`<sw-dialog open heading=${u("assignTitle")} data-dialog="assign" @close=${this.onDialogClose}>
        <div class="form">
          ${this.ext.renderKinds(t,{user:l(!1),employee:l(!0)})}
          ${o?this.ext.renderPicker(t):this.eligible===null?n`<span class="skl" style="block-size:44px"></span>`:d.length&&!c?n`<div class="pick" role="radiogroup" aria-label=${u("fAssignee")}>${d.map(v=>n`<label data-eligible=${v.id} data-handler=${v.key}>
                <input type="radio" name="asg" .checked=${this.dlgPick===v.key} @change=${()=>{this.dlgPick=v.key,this.dlgError=""}} />${x(v.name)}
                ${v.member_role==="manager"?n`<small>${u("depManager")}</small>`:r}</label>`)}</div>`:n`<div data-eligible-none>${c?this.ext.reasonLine(c):r}</div>`}
          ${i(u("assignNote"),!1)}
          <span class="muted" data-assign-internal-hint>${f("lock")}${u("asgInternalHint")}</span>
          ${this.handlerMessageOn()?this.handlerMessageField():r}
          ${s}</div>
        ${a(n`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy||(o?!this.ext.ready():!m)} @click=${()=>void this.submitAssign()}>${f("user")}${u("assign")}</button>`)}
      </sw-dialog>`}if(e.kind==="return")return n`<sw-dialog open heading=${u("returnTitle")} data-dialog="return" @close=${this.onDialogClose}>
        <div class="form">
          <sw-segmented radio label=${u("returnTitle")} value=${this.dlgReturnKind} @change=${o=>this.dlgReturnKind=o.detail.value}
            .options=${["cannot_handle","not_mine"].map(o=>({value:o,label:o==="not_mine"?u("returnNotMine"):u("returnCannot"),attrs:{"data-return-kind":o}}))}></sw-segmented>
          ${i(u("reason"),!0)}
          ${s}</div>
        ${a(n`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.submitReturn()}>${f("refresh")}${u("giveBack")}</button>`)}
      </sw-dialog>`;if(e.kind==="eta")return n`<sw-dialog open heading=${u("etaTitle")} data-dialog="eta" @close=${this.onDialogClose}>
        <div class="form"><label class="fld"><span>${u("etaSet")}</span><input class="inp" type="datetime-local" lang=${be()} data-dialog-eta .value=${this.dlgText} @input=${o=>{this.dlgText=o.target.value,this.dlgError=""}} /></label>${s}</div>
        <div slot="footer" class="sheetfoot">
          <button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.submitEta(!1)}>${u("save")}</button>
          ${t.eta_at?n`<button type="button" class="btn" data-eta-clear ?disabled=${this.busy} @click=${()=>void this.submitEta(!0)}>${u("etaClear")}</button>`:r}
          <button type="button" class="btn" data-dialog-cancel @click=${()=>this.closeDialog()}>${u("back")}</button>
        </div>
      </sw-dialog>`;if(e.kind==="edit"&&this.edit){const o=this.edit,l=new Set(t.can.edit_fields),d=(this.meta?.departments??[]).filter(v=>v.can_manage||v.id===t.department?.id),c=this.meta?.departments.find(v=>v.id===o.department_id),m=v=>{this.edit={...o,...v},this.dlgError=""};return n`<sw-dialog open wide heading=${u("editTitle")} data-dialog="edit" @close=${this.onDialogClose}>
        <div class="form">
          <label class="fld"><span>${u("fTitle")} <b class="req">*</b></span><input class="inp" maxlength="120" data-edit-title .value=${o.title} ?disabled=${!l.has("title")} @input=${v=>m({title:v.target.value})} /></label>
          <label class="fld"><span>${u("fDescription")}</span><textarea class="inp" maxlength="4000" data-edit-description .value=${o.description} ?disabled=${!l.has("description")} @input=${v=>m({description:v.target.value})}></textarea></label>
          ${l.has("department_id")||l.has("category_id")||l.has("priority_id")?n`<div class="two">
            ${l.has("department_id")&&d.length>1?n`<label class="fld"><span>${u("fDepartment")}</span><select class="inp" data-edit-department @change=${v=>m({department_id:v.target.value,category_id:"",priority_id:""})}>${d.map(v=>n`<option value=${v.id} ?selected=${v.id===o.department_id}>${v.name}</option>`)}</select></label>`:r}
            ${l.has("category_id")&&c?n`<label class="fld"><span>${u("fCategory")}</span><select class="inp" data-edit-category @change=${v=>m({category_id:v.target.value})}><option value="" ?selected=${!o.category_id}>${u("fNoCategory")}</option>${c.categories.map(v=>n`<option value=${v.id} ?selected=${v.id===o.category_id}>${v.name}</option>`)}</select></label>`:r}
          </div>`:r}
          ${l.has("priority_id")&&c?n`<div class="fld"><span>${u("fPriority")}</span><div class="prio" role="radiogroup" aria-label=${u("fPriority")}>${c.priorities.map(v=>n`<button type="button" class="rc" role="radio" aria-checked=${String(v.id===o.priority_id)} data-edit-priority=${v.key} @click=${()=>m({priority_id:v.id})}><i class=${`dot ${Pe(v)==="bad"?"bad":Pe(v)==="info"?"run":""}`}></i>${v.name}</button>`)}</div></div>`:r}
          ${l.has("location_id")&&(l.has("place_text")||this.editLocs?.locations.length)?n`<div style="display:contents" data-edit-location>${La({ans:this.editLocs,pick:o.pick,other:o.place,disabled:this.busy||!l.has("place_text")&&!this.editLocs,onPick:v=>m({pick:v}),onOther:v=>m({place:v})})}</div>`:r}
          ${s}</div>
        ${a(n`<button type="button" class="btn primary" data-dialog-ok ?disabled=${this.busy} @click=${()=>void this.submitEdit()}>${f("check")}${u("save")}</button>`)}
      </sw-dialog>`}return r}hrefOf(e){return this.detailMode==="fullscreen"||this.mode==="page"?Oe(e):ve(this.scope,void 0,{t:e})}stateBox(){if(this.mode==="page"){if(this.gone)return n`<sw-state-panel icon="ticket" state="empty" quiet heading=${u("notFound")} data-ticket-state="gone"></sw-state-panel>`;if(this.failed)return n`<sw-state-panel state="error" hint=${this.failed} actionLabel=${u("retry")} data-ticket-state="error"
          @action=${()=>{this.failed="",this.load()}}></sw-state-panel>`}return this.gone?n`<div class="statebox glass" role="status" data-ticket-state="gone"><span class="ring">${f("ticket")}</span><b>${u("notFound")}</b></div>`:this.failed?n`<div class="statebox glass" role="status" data-ticket-state="error"><span class="ring">${f("warning")}</span><b>${this.failed}</b><button type="button" class="btn sm" @click=${()=>{this.failed="",this.load()}}>${f("refresh")}${u("retry")}</button></div>`:n`<div class="stack" data-ticket-state="loading" aria-busy="true"><span class="skl" style="block-size:96px"></span><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:64px"></span><span class="skl" style="block-size:64px"></span><span class="skl" style="block-size:64px"></span></div>`}drawer(){const e=this.t,t=this.phone&&this.sheet==="half",s=this.phone?"100vw":ma[this.size],a=this.phone&&!t?"100dvh":"auto",i=`--sw-drawer-modal-w:${s};--sw-drawer-sheet-h:${a};--sw-drawer-sheet-max-h:${this.phone&&!t?"100dvh":"88dvh"}`,o=e?this.actions(e):null,l=new Date;return n`<sw-drawer modal .open=${this.open} heading=${e?.title??""} style=${i} data-ticket-drawer data-size=${this.phone?"phone":this.size} data-sheet=${this.phone?this.sheet:r}
      @close=${d=>{d.target===d.currentTarget&&this.close()}}>
      ${e?n`<span slot="sub" class="hsub">${this.subLine(e)}</span>`:r}
      ${e?n`<span slot="action" class="hacts">${this.phone?this.sheetToggle():this.sizeSwitch()}${this.moreButton()}</span>`:r}
      ${e&&o?n`<div slot="strip" class="strip">
        ${Ot(e,{role:o.role,now:l,busy:this.busy,primary:o.primary,quiet:o.quiet,onAction:this.onAction})}
        ${t?r:Et(dt(e),this.tab,(d,c)=>this.selectTab(d,c))}
      </div>`:r}
      ${this.flashRow()}
      ${e?t?n`<div class="half" data-ticket-detail=${e.id} data-half-sheet>${Ln(e,this.overviewCtx(e))}
            <button type="button" class="btn quiet" data-show-all @click=${()=>this.sheet="full"}>${f("expand")}${b("showAll")}</button></div>`:this.panel(e):this.stateBox()}
      ${e&&o?this.menuPopover(e,o.menu):r}
      ${this.dialogs()}
      ${e?this.deleteDialog(e):r}
    </sw-drawer>`}page(){const e=this.t;if(!e)return n`<div class="page"><div class="phead lead-head"><a class="rb sm" href=${ve(this.scope)} aria-label=${u("toList")} data-back>${f("back")}</a></div>${this.stateBox()}</div>`;const t=this.actions(e);return n`<div class="page" data-ticket-page=${e.id}>
      <div class="phead lead-head">
        <a class="rb sm" href=${ve(this.scope)} aria-label=${u("toList")} data-back>${f("back")}</a>
        <div class="tt"><h1 dir="auto" data-ticket-title title=${e.title}>${x(e.title)}</h1><div class="hsub">${this.subLine(e)}</div></div>
        <div class="acts">
          ${this.detailMode==="drawer_fullscreen"?n`<a class="btn sm quiet" href=${ve(this.scope,void 0,{t:e.id})} data-to-drawer>${f("shrink")}${b("a_toDrawer")}</a>`:r}
          ${this.moreButton()}
        </div>
      </div>
      ${this.flashRow()}
      <div class="glass hero">${Ot(e,{role:t.role,now:new Date,busy:this.busy,primary:t.primary,quiet:t.quiet,onAction:this.onAction})}</div>
      <div class="glass tabcard">
        ${Et(dt(e),this.tab,(s,a)=>this.selectTab(s,a))}
        ${this.panel(e)}
      </div>
      ${this.menuPopover(e,t.menu)}
      ${this.dialogs()}
      ${this.deleteDialog(e)}
    </div>`}updated(){this.placeMenu()}render(){return this.mode==="page"?this.page():this.drawer()}};_.styles=[de,zs,...re,ce,me,fn,gn,ka,En,Sn,Un,Ki,dn,F`
    sw-drawer {
      --sw-drawer-modal-w: 640px;
    }
    /* the title of the header: two lines at most, then an ellipsis (IA §5) */
    sw-drawer::part(title) {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      font-size: var(--sw-fs-xl);
      font-weight: 700;
      line-height: 1.25;
    }
    sw-dialog {
      --sw-surface: var(--dv-surface-solid);
      --sw-glass-blur: none;
    }
    .hsub {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
      margin-block-start: 3px;
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .hsub .id {
      font-weight: 700;
      color: var(--dv-text);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .hsub .ic {
      color: var(--dv-text-3);
    }
    .hsub .chip {
      block-size: 22px;
      padding-inline: 8px;
      font-size: var(--sw-fs-xs);
    }
    .hacts {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .sizes {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--dv-surface-3);
    }
    .sizes button {
      display: grid;
      place-items: center;
      inline-size: 34px;
      block-size: 30px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--dv-text-2);
      cursor: pointer;
    }
    .sizes button[aria-pressed='true'] {
      background: var(--mm-seg-thumb, var(--dv-surface-solid));
      color: var(--dv-accent-text);
      box-shadow: var(--dv-shadow-control);
    }
    .sizes button:focus-visible,
    .rb:focus-visible {
      outline: 2px solid var(--dv-focus, var(--dv-accent));
      outline-offset: 1px;
    }
    .sizes .ic {
      font-size: var(--sw-fs-md);
    }
    .strip {
      display: block;
      background: var(--dv-surface-solid);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-inline-size: 0;
    }
    .slot-note {
      margin: 0;
      color: var(--dv-text-3);
      font-size: var(--sw-fs-sm);
    }
    .half {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .half .btn {
      align-self: center;
      min-block-size: 44px;
    }
    /* CR-CAMVF-295: the live camera tile (a button beside the unchanged file-input tile) */
    button.ph.add.live {
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
    }
    button.ph.add.live:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
    }
    .photos-more {
      display: grid;
      place-items: center;
      font-weight: 700;
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
      border-style: dashed;
      cursor: pointer;
    }
    /* the "⋯" menu: a top-layer popover (tickets/overlay-menu.ts) - never a scroll box inside a tab */
    .pop.ov {
      position: fixed;
      inset: auto;
      margin: 0;
      display: flex;
      flex-direction: column;
      min-inline-size: 220px;
      max-inline-size: calc(100vw - 16px);
      padding: 6px;
      overflow-y: auto;
      overscroll-behavior: contain;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--dv-shadow-2);
      color: var(--dv-text);
    }
    .pop .mh {
      padding: 8px 12px 4px;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--dv-text-3);
    }
    .pop hr {
      border: 0;
      border-block-start: 1px solid var(--dv-border);
      margin: 4px 6px;
    }
    .pop [role='menuitem'] {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      padding-inline: 12px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: transparent;
      color: var(--dv-text);
      font: inherit;
      font-size: var(--sw-fs-md);
      text-align: start;
      text-decoration: none;
      cursor: pointer;
    }
    .pop [role='menuitem']:focus-visible {
      background: var(--dv-surface-3);
      outline: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .pop [role='menuitem']:hover {
        background: var(--dv-surface-3);
      }
    }
    .pop [role='menuitem'] .ic {
      font-size: var(--sw-fs-lg);
      color: var(--dv-text-2);
    }
    .pop [role='menuitem'].dz,
    .pop [role='menuitem'].dz .ic {
      color: var(--dv-danger);
    }
    /* ---- the full page: the status block as a hero, the same tabs in one card (IA §4.1: no columns) ---- */
    .page {
      padding: 0 36px 44px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .phead {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px 14px;
      padding-block-start: 18px;
    }
    .phead .tt {
      flex: 1;
      min-inline-size: 0;
    }
    .phead h1 {
      margin: 0;
      font-size: var(--sw-fs-3xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
      overflow-wrap: anywhere;
    }
    .phead .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .hero,
    .tabcard {
      padding: 0;
      overflow: clip;
      border-radius: var(--sw-r-2xl);
    }
    .hero .stat {
      border-block-end: 0;
    }
    .tabcard .rtabs {
      background: transparent;
    }
    .tabcard .panel {
      padding: 16px 18px 20px;
    }
    .flash {
      position: sticky;
      inset-block-start: 0;
      z-index: 5;
    }
    @media (max-width: 767px) {
      .page {
        padding: 0 16px 28px;
      }
      .phead h1 {
        font-size: var(--sw-fs-2xl);
      }
      .tabcard .panel {
        padding: 12px 14px 16px;
      }
      .rb {
        inline-size: 44px;
        block-size: 44px;
      }
    }
  `];z([C()],_.prototype,"ticketId",2);z([C({reflect:!0})],_.prototype,"mode",2);z([C({type:Boolean})],_.prototype,"open",2);z([C()],_.prototype,"detailMode",2);z([C()],_.prototype,"scope",2);z([C({type:Boolean})],_.prototype,"focusTimeline",2);z([C()],_.prototype,"initialTab",2);z([C()],_.prototype,"defaultTab",2);z([C()],_.prototype,"sizeSetting",2);z([C()],_.prototype,"sheetSetting",2);z([C()],_.prototype,"assignContact",2);z([C({type:Boolean})],_.prototype,"cameraViewfinder",2);z([g()],_.prototype,"t",2);z([g()],_.prototype,"failed",2);z([g()],_.prototype,"gone",2);z([g()],_.prototype,"busy",2);z([g()],_.prototype,"dialog",2);z([g()],_.prototype,"flash",2);z([g()],_.prototype,"uploading",2);z([g()],_.prototype,"tab",2);z([g()],_.prototype,"size",2);z([g()],_.prototype,"sheet",2);z([g()],_.prototype,"phone",2);z([g()],_.prototype,"menu",2);z([g()],_.prototype,"descOpen",2);z([g()],_.prototype,"photosAll",2);z([g()],_.prototype,"dlgText",2);z([g()],_.prototype,"costGate",2);z([g()],_.prototype,"dlgOverride",2);z([g()],_.prototype,"dlgNumber",2);z([g()],_.prototype,"dlgError",2);z([g()],_.prototype,"dlgPick",2);z([g()],_.prototype,"dlgMsg",2);z([g()],_.prototype,"dlgReturnKind",2);z([g()],_.prototype,"eligible",2);z([g()],_.prototype,"ownerPick",2);z([g()],_.prototype,"deleting",2);z([g()],_.prototype,"meta",2);z([g()],_.prototype,"edit",2);z([g()],_.prototype,"editLocs",2);_=z([oe("ticket-detail")],_);export{Bt as S,Ut as a,si as b,Vi as c,vo as d,Ya as e,Ua as m,Ba as o,Vt as s,ni as w};
