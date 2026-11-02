import{E as T,F as w,G as f,a as M,i as C,l as N,j as B,R as z,c0 as a,A as u,e as o,av as j,H as q}from"./index-BJCfUqyq.js";import{A as L,B as V,C as Z,D as K,E as P,t as U}from"./access-grants-D361p4Z7.js";import{q as H}from"./access-people-DcUF5ZYb.js";import{d as I,m as b,i as k}from"./recordings-ChfRjSpa.js";const re=["attention","waiting","moving","active","history"],W=168*36e5;function v(e){if(e.closure&&!e.closure.reappeared_at&&e.state!=="revoking")return"gone";switch(e.state){case"requested":return e.person.pending?"draft":"pending";case"approved":case"provisioning":return"pushing";case"active":return e.needs_push?"sync":e.scope_verified===!0?"verified":"accepted";case"unknown":return"unknown";case"revoking":return"revoking";case"ended":case"revoked":return e.revoke_proof==="unverified"?"revoked_unverified":e.state;case"refused":return"refused";default:return"failed"}}const oe={draft:"off",pending:"acc",pushing:"acc",verified:"ok",accepted:"ok",sync:"warn",unknown:"warn",revoking:"err",revoked:"off",revoked_unverified:"warn",ended:"off",refused:"off",failed:"err",gone:"off"},de={draft:"edit",pending:"clock",pushing:"refresh",verified:"check",accepted:"check",sync:"refresh",unknown:"help",revoking:"bell",revoked:"lock",revoked_unverified:"lock",ended:"clock",refused:"close",failed:"warning",gone:"user"};function A(e,t=Date.now()){const n=v(e);if(n==="revoking"||n==="unknown")return"attention";if(n==="failed"){const i=Date.parse(e.ended_at??e.updated_at??"");return Number.isFinite(i)&&t-i<W?"attention":"history"}return n==="draft"||n==="pending"||e.pending_amendment?"waiting":n==="pushing"?"moving":n==="verified"||n==="accepted"||n==="sync"?"active":"history"}function le(e,t=Date.now()){const n={attention:0,waiting:0,moving:0,active:0,history:0};for(const i of e)n[A(i,t)]+=1;return n}function ce(e,t,n=Date.now()){const i=t.q.trim().toLowerCase();return e.filter(s=>{const r=A(s,n);return!((t.filter==="live"?r==="history":r!==t.filter)||t.station&&!s.doors.some(d=>d.station_id===t.station)||t.source&&s.source!==t.source||i&&![s.person.name??"",s.source_ref??""].join(" ").toLowerCase().includes(i))})}function pe(e){const t=new Map;for(const n of e)for(const i of n.doors)t.has(i.station_id)||t.set(i.station_id,i.name);return[...t].map(([n,i])=>({id:n,name:i})).sort((n,i)=>n.name.localeCompare(i.name))}function ue(e){const t=v(e);return t==="revoking"?e.closure?.reappeared_at?"why_reopened":e.link?.state==="wiskey_missing"?"why_revoking_missing":e.create_unresolved?"why_revoking_unresolved":e.link?.origin==="matched"?"why_revoking_notours":"why_revoking":(t==="accepted"||t==="verified")&&e.pending_amendment?"why_widening":`why_${t}`}function fe(e){const t=v(e),n=["lad_requested","lad_approved","lad_sent","lad_accepted","lad_verified"],i=["lad_decided","lad_written","lad_clean","lad_nothing"],s={draft:["cur","no","no","no","no"],pending:["done","cur","no","no","no"],pushing:["done","done","cur","no","no"],accepted:["done","done","done","done","no"],verified:["done","done","done","done","done"],sync:["done","done","cur","no","no"],unknown:["done","done","unk","unk","no"],failed:["done","done","stop","no","no"],refused:["done","stop","no","no","no"]},d={revoking:e.link?.state==="wiskey_missing"||e.create_unresolved||e.link?.origin==="matched"?["done","unk","unk","no"]:["done","done","cur","no"],revoked:["done","done","done","done"],revoked_unverified:["done","done","unk","no"],ended:["done","done","done","done"],gone:["done","unk","unk","no"]},p=t in d,h=(p?d[t]:s[t])??(p?["no","no","no","no"]:["no","no","no","no","no"]);return{revoke:p,steps:(p?i:n).map((g,m)=>({key:g,mark:h[m]}))}}function ve(e){const t=v(e);return t==="verified"?{key:"dr_verified",tone:"ok"}:t==="accepted"?{key:"dr_accepted",tone:"acc"}:t==="sync"||t==="pushing"?{key:"dr_desired",tone:"acc"}:t==="unknown"?{key:"dr_unknown",tone:"warn"}:t==="draft"||t==="pending"?{key:"dr_proposed",tone:"off"}:t==="revoking"?{key:E(e)?"dr_unknown":"dr_removing",tone:E(e)?"warn":"err"}:{key:"dr_closed",tone:"off"}}function E(e){return e.link?.state==="wiskey_missing"||e.create_unresolved||e.link?.origin==="matched"}function he(e){if(e.code_state===null||e.code_state===void 0)return null;const t={sent:"ok",pending:"acc",queued:"acc",not_delivered:"warn",unknown:"warn",not_needed:"off"};return{key:`code_${e.code_state}`,tone:t[e.code_state]??"off"}}function ge(e,t){const n=v(e);return{accept:n==="draft",refuse:n==="pending"||!!e.pending_amendment&&["accepted","verified","sync","pushing"].includes(n),approve:(n==="pending"||!!e.pending_amendment&&["accepted","verified","sync","pushing"].includes(n))&&(!e.self_requested||t),retry:e.state==="approved",rotate:e.state==="active"&&e.credential==="pin"&&["sent","not_delivered","unknown"].includes(e.code_state??"")&&(e.code_sends??0)<3,revoke:["pushing","accepted","verified","sync","unknown"].includes(n),gone:t&&n==="revoking"&&e.link?.state==="wiskey_missing",readNow:n==="unknown"||n==="revoking"||n==="accepted"||n==="verified"}}function O(e,t){return I(new Date(e),t)}function D(e,t){return I(new Date(Date.parse(e)-1e3),t)}function we(e,t,n){const i=d=>`${d.slice(8,10)}.${d.slice(5,7)}`,s=O(e,n),r=D(t,n);return s===r?i(s):`${i(s)}-${i(r)}`}function me(e,t){const n=e.timing?.periods??[];if(n.length)return n.map(s=>`${s.start}-${s.end}`).join(", ");const i=s=>{const r=Math.round(b(new Date(s),t));return`${String(Math.floor(r/60)%24).padStart(2,"0")}:${String(r%60).padStart(2,"0")}`};return`${i(e.valid_from)}-${i(e.valid_until)}`}function Y(e,t){const n=Date.UTC(Number(e.slice(0,4)),Number(e.slice(5,7))-1,Number(e.slice(8,10)))+t*864e5;return new Date(n).toISOString().slice(0,10)}function F(e,t){return Math.round((Date.UTC(+t.slice(0,4),+t.slice(5,7)-1,+t.slice(8,10))-Date.UTC(+e.slice(0,4),+e.slice(5,7)-1,+e.slice(8,10)))/864e5)+1}function ke(e,t,n,i,s,r){const d=O(e,s),p=D(t,s),h=F(n,i);let g=null;!n||!i||i<n?g="before":n<d||i>p?g="outside":h>r&&(g="too_long");const m=b(new Date(e),s),y=b(new Date(t),s),R=n===d?e:x(k(n,m,s));let $=t;return i!==p&&($=x(y===0?k(Y(i,1),0,s):k(i,y,s))),{valid_from:R,valid_until:$,days:Math.max(h,0),error:g}}function x(e){return e.toISOString().replace(/\.\d{3}Z$/,"Z")}function xe(e){const t=e.split(/\s+/).filter(Boolean).join(" ");return t.length>=8&&t.length<=128&&!/\d[\d\s\-.]{6,}\d/.test(t)}function G(e){return/^[A-Za-z0-9][A-Za-z0-9:._/-]{7,127}$/.test(e)}function _e(e,t){const n=Math.floor(e/60),i=Math.max(0,Math.round(e%60)),s={he:["ש׳","ד׳"],en:["h","min"],ar:["س","د"],ru:["ч","мин"]}[t]??["h","min"];return n?`${n} ${s[0]} ${i} ${s[1]}`:`${i} ${s[1]}`}function be(e){const t=[];return e.created_at&&t.push({at:e.created_at,key:"ev_created",tone:"acc"}),e.approved_at&&t.push(e.approved_by_name?{at:e.approved_at,key:"ev_approved",tone:"ok",vars:{name:e.approved_by_name}}:{at:e.approved_at,key:"ev_approvedAnon",tone:"ok"}),e.scope_verified&&e.scope_verified_at&&t.push({at:e.scope_verified_at,key:"ev_verified",tone:"ok"}),e.revoking_since&&t.push({at:e.revoking_since,key:"ev_revoking",tone:"err",vars:{reason:e.end_reason??"manual"}}),e.closure&&t.push({at:e.closure.closed_at,key:"ev_closed",tone:"off",vars:{name:e.closure.closed_by_name??"-"}}),e.closure?.reappeared_at&&t.push({at:e.closure.reappeared_at,key:"ev_reappeared",tone:"err"}),e.ended_at&&!e.closure&&t.push({at:e.ended_at,key:"ev_ended",tone:"off"}),t.sort((n,i)=>n.at.localeCompare(i.at))}function ye(e,t){const n=v(e);return n!=="unknown"&&n!=="revoking"?null:t?"offline":"pending"}function $e(e,t){const n=v(t||e);return t&&n!==v(e)?{kind:"changed",key:`st_${n}`}:{kind:"still",key:{unknown:"rb_still_unknown",revoking:"rb_still_revoking",accepted:"rb_still_accepted",verified:"rb_still_verified"}[n]??"rb_still_unknown"}}function ze(e){return!!e?.enabled&&!!e.wiskey&&!e.wiskey.reachable}const Ee=[0,1,2,3,4,5,6];function X(e,t){return e||t("tickets.configure")||t("tickets.directory")}const J=T`
  :host {
    --x-ok: var(--sw-success);
    --x-acc: var(--sw-accent);
    --x-warn: var(--sw-warning);
    --x-err: var(--sw-danger);
    --x-off: var(--sw-text-3);
    /* SHAREDUI-295: text in a tone colour, >= 4.5:1 on its soft fill and on the surfaces in every skin, light and dark: the product's
       -text token pulled 40% towards the heading colour (darker in light, lighter in dark). The plain -text tokens measure 3.0-4.5:1
       on their soft fills (success 3.0, accent 4.4, unknown 4.5 in the classic light set). */
    --x-ok-t: color-mix(in srgb, var(--sw-success-text) 60%, var(--sw-heading));
    --x-acc-t: color-mix(in srgb, var(--sw-accent-text) 60%, var(--sw-heading));
    --x-warn-t: color-mix(in srgb, var(--sw-warning-text) 60%, var(--sw-heading));
    --x-err-t: color-mix(in srgb, var(--sw-danger-text) 60%, var(--sw-heading));
    --x-off-t: color-mix(in srgb, var(--sw-unknown-text) 60%, var(--sw-heading));
  }
  [data-tone='ok'] { --c: var(--sw-success); --cs: var(--sw-success-soft); --ct: var(--x-ok-t); }
  [data-tone='acc'] { --c: var(--sw-accent); --cs: var(--sw-accent-soft); --ct: var(--x-acc-t); }
  [data-tone='warn'] { --c: var(--sw-warning); --cs: var(--sw-warning-soft); --ct: var(--x-warn-t); }
  [data-tone='err'] { --c: var(--sw-danger); --cs: var(--sw-danger-soft); --ct: var(--x-err-t); }
  [data-tone='off'] { --c: var(--sw-unknown); --cs: var(--sw-unknown-soft); --ct: var(--x-off-t); }
  .chip {
    display: inline-flex; align-items: center; gap: 5px; padding: 2px 10px; border-radius: 999px; font-size: var(--sw-fs-sm);
    font-weight: 600; line-height: 20px; white-space: nowrap; max-inline-size: 100%;
    background: var(--cs, var(--sw-surface-3)); color: var(--ct, var(--sw-text-2));
  }
  .chip.door { font-weight: 500; white-space: normal; line-height: 1.35; padding-block: 3px; }
  .chip.door.add { --cs: var(--sw-success-soft); --ct: var(--x-ok-t); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; min-inline-size: 0; }
  /* SHAREDUI-295: white on the solid state colours measured 1.8-3.8:1 (success, warning, danger, unknown); the badge is the soft fill
     with the tone text and a ring in the state colour, so it still reads as the strongest mark of the row */
  .badge {
    display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 3px 11px; font-size: var(--sw-fs-sm);
    font-weight: 600; white-space: nowrap; line-height: 1.4; background: var(--cs); color: var(--ct);
    box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c) 55%, transparent);
  }
  .badge.soft { box-shadow: none; }
  .callout {
    display: grid; grid-template-columns: auto 1fr; gap: 10px; padding: 12px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-sm);
    background: var(--cs, var(--sw-accent-soft)); color: var(--sw-text); align-items: start;
  }
  .callout > sw-icon { color: var(--c, var(--x-acc)); margin-top: 1px; }
  .callout b { display: block; color: var(--sw-heading); margin-block-end: 2px; }
  .callout ul { margin: 6px 0 0; padding-inline-start: 18px; display: grid; gap: 4px; }
  .sec { display: grid; gap: 8px; }
  .sec > h4 { margin: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: 600; display: flex; gap: 6px; align-items: center; }
  .kv { display: grid; font-size: var(--sw-fs-base); }
  .kv > div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-block-end: 1px solid var(--sw-border-strong); align-items: center; }
  .kv > div:last-child { border: 0; }
  .kv span { color: var(--sw-text-2); }
  .kv b { color: var(--sw-heading); font-weight: 600; text-align: end; min-inline-size: 0; overflow-wrap: anywhere; }
  .num, .ltr { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .dtable { display: grid; font-size: var(--sw-fs-base); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); overflow: hidden; }
  .dtable > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 9px 12px; border-block-end: 1px solid var(--sw-border); align-items: center; }
  .dtable > div:last-child { border: 0; }
  .dtable small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
  .ladder { display: grid; grid-template-columns: repeat(var(--n, 5), 1fr); position: relative; }
  .ladder .stp { display: grid; justify-items: center; gap: 6px; text-align: center; position: relative; font-size: var(--sw-fs-xs); color: var(--sw-text-2); line-height: 1.25; padding: 0 2px; }
  .ladder .stp::before { content: ''; position: absolute; top: 10px; inset-inline-start: calc(-50% + 12px); inset-inline-end: calc(50% + 12px); block-size: 2px; background: var(--sw-surface-3); }
  .ladder .stp:first-child::before { display: none; }
  .ladder .stp i { inline-size: 22px; block-size: 22px; border-radius: 50%; display: grid; place-items: center; font-style: normal; font-size: 12px; font-weight: 700; position: relative; z-index: 1; background: var(--sw-surface-3); color: var(--sw-text-3); }
  .ladder .stp[data-s='done'] i { background: var(--x-ok); color: var(--sw-text-inverse); }
  .ladder .stp[data-s='done']::before { background: var(--x-ok); }
  .ladder .stp[data-s='done'] { color: var(--sw-text-2); }
  .ladder .stp[data-s='cur'] i { background: var(--x-acc); color: var(--sw-text-inverse); box-shadow: 0 0 0 4px color-mix(in srgb, var(--x-acc) 20%, transparent); }
  .ladder .stp[data-s='cur'] { color: var(--x-acc-t); font-weight: 600; }
  .ladder .stp[data-s='unk'] i { background: transparent; border: 2px dashed var(--x-warn); color: var(--x-warn); }
  .ladder .stp[data-s='unk'] { color: var(--x-warn-t); font-weight: 600; }
  .ladder .stp[data-s='stop'] i { background: var(--x-err); color: var(--sw-text-inverse); }
  .ladder .stp[data-s='stop'] { color: var(--x-err-t); font-weight: 600; }
  .note { font-size: var(--sw-fs-xs); color: var(--sw-text-2); display: flex; gap: 6px; align-items: flex-start; margin: 0; }
  .tl { display: grid; margin: 0; padding: 0; list-style: none; }
  .tl li { display: grid; grid-template-columns: 78px 14px 1fr; gap: 8px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding-block-end: 10px; position: relative; }
  .tl li time { color: var(--sw-text-2); font-variant-numeric: tabular-nums; direction: ltr; text-align: end; }
  .tl li i { inline-size: 9px; block-size: 9px; border-radius: 50%; background: var(--c); margin-top: 5px; justify-self: center; position: relative; z-index: 1; }
  .tl li:not(:last-child)::after { content: ''; position: absolute; top: 14px; bottom: -2px; inset-inline-start: calc(78px + 8px + 6px); inline-size: 1px; background: var(--sw-border-strong); }
  .ku { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ku > div { padding: 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); display: grid; gap: 6px; align-content: start; }
  .ku h4 { margin: 0; font-size: var(--sw-fs-sm); display: flex; gap: 6px; align-items: center; }
  .ku ul { margin: 0; padding-inline-start: 18px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); display: grid; gap: 4px; }
  .ku .unk h4 { color: var(--x-warn-t); }
  /* SHAREDUI-295: the explanations of a state sit behind one disclosure ("how Arx decides"); the summary is a 44 px target */
  details.more { border-radius: var(--sw-r-sm); }
  details.more > summary { display: flex; align-items: center; gap: 6px; min-block-size: var(--sw-touch-desktop, 44px); cursor: pointer; list-style: none;
    font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text-2); border-radius: var(--sw-r-sm); }
  details.more > summary::-webkit-details-marker { display: none; }
  details.more > summary:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
  details.more > ul { margin: 0; padding-inline-start: 18px; display: grid; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .field { display: grid; gap: 6px; }
  .field label { font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text-2); }
  .field .hint { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
  .field .hint.e { color: var(--x-err-t); font-weight: 600; }
  .in {
    min-block-size: var(--sw-touch-desktop); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface-solid);
    padding: 0 12px; inline-size: 100%; box-sizing: border-box; font: inherit; color: var(--sw-text);
  }
  .in:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 1px; }
  .in[aria-invalid='true'] { border-color: var(--x-err); }
  .in::placeholder { color: var(--sw-text-2); opacity: 1; }
  label.cb { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; padding: 8px 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border-strong); cursor: pointer; min-block-size: var(--sw-touch-desktop); box-sizing: border-box; }
  label.cb input { inline-size: 18px; block-size: 18px; margin: 2px 0 0; accent-color: var(--sw-accent); }
  label.cb small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
  .stack { display: grid; gap: 14px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .row .sp { flex: 1; }
  .err-line { color: var(--x-err-t); font-size: var(--sw-fs-sm); font-weight: 600; margin: 0; }
  /* EXTERNALBUILD-297: the readiness lines in the settings dialog */
  ul.rd { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  ul.rd li { display: flex; gap: 8px; align-items: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-1, inherit); }
  ul.rd li .chip { flex: none; }
  @media (max-width: 560px) {
    .ku { grid-template-columns: 1fr; }
    .tl li { grid-template-columns: 64px 14px 1fr; }
    .tl li:not(:last-child)::after { inset-inline-start: calc(64px + 8px + 6px); }
  }
`,Se=["all","permanent","temporary"];function Q(e){return e==null?null:e?{permanent:!0,key:"vm_permanent",tone:"ok"}:{permanent:!1,key:"vm_temporary",tone:"off"}}const Te=e=>e==="all"?"vm_all":e==="permanent"?"vm_permanent":"vm_temporary";function Ie(e,t){return t==="all"?[...e]:e.filter(n=>n.permanent_vendor===!0==(t==="permanent"))}const Ae=e=>e==="vendor"||e==="person";var ee=Object.defineProperty,te=Object.getOwnPropertyDescriptor,c=(e,t,n,i)=>{for(var s=i>1?void 0:i?te(t,n):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(s=(i?d(t,n,s):d(s))||s);return i&&s&&ee(t,n,s),s};const S={"access.person_link.create":"h_create","access.person_link.match":"h_match","access.person_link.unlink":"h_unlink","access.person_link.name_pushed":"h_name","access.grant.request":"h_request","access.grant.activate":"h_activate","access.grant.end":"h_end","access.grant.revoked":"h_revoked","access.grant.confirm_gone":"h_gone","access.grant.create_recovered":"h_recovered"};let l=class extends M{constructor(){super(...arguments),this.contactId="",this.name="",this.compact=!1,this.tz=void 0,this.data=null,this.absent=!1,this.loading=!1,this.loadError="",this.dialog=null,this.busy=!1,this.error="",this.notice="",this.word="",this.q="",this.people=null,this.peopleError=!1,this.pick="",this.ref=""}updated(e){e.has("contactId")&&this.contactId&&this.load()}async load(){if(!C()||!X(N("access.external.grant"),j)){this.data=null,this.absent=!0;return}this.loading=!this.data,this.loadError="";try{this.data=(await L(this.contactId)).identity,this.absent=!1}catch(e){this.data=null;const t=e instanceof B&&(e.status===403||e.status===404);this.absent=t,this.loadError=t?"":z(e)}finally{this.loading=!1}}open(e){this.dialog=e,this.error="",this.word="",this.ref="",this.pick="",(e==="link"||e==="attach")&&this.search()}async search(){this.peopleError=!1;try{const e=await H({query:this.q,filters:{},offset:0,limit:20,snapshot:""});this.people=e.people?.records??[],e.state!=="ready"&&(this.peopleError=!0)}catch{this.people=[],this.peopleError=!0}}async run(e,t){this.busy=!0,this.error="";try{await e(),this.dialog=null,this.notice=a(t),await this.load(),this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}catch(n){this.error=z(n)}finally{this.busy=!1}}stateView(e){const t=e.link;return!t&&e.unresolved?{tone:"warn",icon:"help",t:"id_unresolved_t",desc:a("id_unresolved_d",{t:_(e.unresolved.started_at,this.tz)})}:t?t.state==="wiskey_missing"?{tone:"warn",icon:"warning",t:"id_missing_t",desc:a("id_missing_d")}:t.state==="unlinking"?{tone:"off",icon:"link",t:"id_unlinking_t",desc:a("id_unlinking_d")}:t.origin==="matched"?{tone:"acc",icon:"lock",t:"id_matched_t",desc:a("id_matched_d")}:{tone:"ok",icon:"link",t:"id_created_t",desc:a("id_created_d")}:{tone:"off",icon:"user",t:"id_none_t",desc:a("id_none_d")}}act(e,t,n,i,s,r,d,p,h=!1){return o`<div class="act ${s?"":"dis"}" data-identity-act=${p}>
      <h4><sw-icon name=${e} size="16"></sw-icon>${a(t)}</h4>${a(n)}
      <sw-button size="sm" variant=${h?"danger":"secondary"} ?disabled=${!s||this.busy} @click=${d}>${a(i)}</sw-button>
      ${s?u:o`<span class="why"><sw-icon name="info" size="14"></sw-icon>${r}</span>`}
    </div>`}dialogs(e){const t=this.name||"",n=i=>o`${this.error?o`<p class="err-line" role="alert">${this.error}</p>`:u}<div class="foot"><sw-button variant="ghost" @click=${()=>this.dialog=null}>${a("back")}</sw-button>${i}</div>`;if(this.dialog==="unlink"&&e.link){const i=e.link.id;return o`<sw-dialog open heading=${a("ul_q",{name:t})} data-identity-dialog="unlink" @close=${()=>this.dialog=null}>
        <ul class="stack" style="margin:0;padding-inline-start:18px">${e.live_grant?o`<li>${a("ul_1")}</li>`:u}<li>${a("ul_2")}</li>${e.link.origin==="created_from_arx"?o`<li>${a("ul_3")}</li>`:u}</ul>
        ${n(o`<sw-button variant="danger" ?disabled=${this.busy} @click=${()=>this.run(()=>V(i),"ul_done")}>${a("act_unlink")}</sw-button>`)}
      </sw-dialog>`}if(this.dialog==="delete"&&e.link){const i=e.link.id,s=a("del_word");return o`<sw-dialog open heading=${a("del_q",{name:t})} data-identity-dialog="delete" @close=${()=>this.dialog=null}>
        <div class="callout" data-tone="err"><sw-icon name="warning" size="18"></sw-icon><div><b>${a("del_warn")}</b><ul><li>${a("del_1")}</li><li>${a("del_2")}</li><li>${a("del_3")}</li></ul></div></div>
        <div class="field" style="margin-block-start:12px"><label for="dw">${a("typeWord",{w:s})}</label><input id="dw" class="in" autocomplete="off" .value=${this.word} @input=${r=>this.word=r.target.value} /></div>
        ${n(o`<sw-button variant="danger" ?disabled=${this.busy||this.word.trim()!==s} @click=${()=>this.run(()=>Z(i,this.word.trim()),"del_done")}>${a("act_deleteBtn")}</sw-button>`)}
      </sw-dialog>`}if(this.dialog==="link")return o`<sw-dialog open wide heading=${a("lk_title")} subheading=${t} data-identity-dialog="link" @close=${()=>this.dialog=null}>
        <div class="stack">
          <div class="callout" data-tone="warn"><sw-icon name="lock" size="18"></sw-icon><div><b>${a("lk_callout")}</b><ul><li>${a("lk_c1")}</li><li>${a("lk_c2")}</li><li>${a("lk_c3")}</li></ul></div></div>
          ${this.peopleSearch()}
        </div>
        ${n(o`<sw-button variant="primary" icon="link" ?disabled=${this.busy||!this.pick} @click=${()=>this.run(()=>K(this.contactId,this.pick),"lk_done")}>${a("lk_ok")}</sw-button>`)}
      </sw-dialog>`;if(this.dialog==="attach"&&e.unresolved?.op_id&&e.unresolved.grant_id){const i=e.unresolved.op_id,s=e.unresolved.grant_id,r=G(this.ref);return o`<sw-dialog open wide heading=${a("at_title")} subheading=${a("at_sub")} data-identity-dialog="attach" @close=${()=>this.dialog=null}>
        <div class="stack">
          <div class="callout" data-tone="warn"><sw-icon name="warning" size="18"></sw-icon><div><b>${a("at_warn")}</b>${a("at_warnText")}</div></div>
          <div class="kv"><div><span>${a("at_op")}</span><b class="num">${i.slice(0,8)}… · ${_(e.unresolved.started_at,this.tz)}</b></div><div><span>${a("at_count")}</span><b>${a("at_countValue")}</b></div></div>
          <div class="field"><label>${a("at_person")}</label>${this.peopleSearch()}</div>
          <div class="field"><label for="aref">${a("at_ref")}</label><input id="aref" class="in ltr" maxlength="128" .value=${this.ref} aria-invalid=${this.ref&&!r?"true":"false"} @input=${d=>this.ref=d.target.value} /><span class="hint ${this.ref&&!r?"e":""}">${a("at_refHint")}</span></div>
          <div class="callout" data-tone="acc"><sw-icon name="refresh" size="18"></sw-icon><div>${a("at_after")}</div></div>
        </div>
        ${n(o`<sw-button variant="primary" ?disabled=${this.busy||!this.pick||!r} data-attach-ok @click=${()=>this.run(()=>P(s,{op_id:i,wiskey_person_id:this.pick,evidence_ref:this.ref}),"at_done")}>${a("at_ok")}</sw-button>`)}
      </sw-dialog>`}return u}peopleSearch(){return o`<div class="stack" style="gap:8px">
      <input class="in" type="search" aria-label=${a("lk_search")} placeholder=${a("lk_search")} .value=${this.q} @input=${e=>this.q=e.target.value} @change=${()=>this.search()} @keydown=${e=>e.key==="Enter"&&this.search()} />
      ${this.peopleError?o`<p class="note"><sw-icon name="info" size="14"></sw-icon>${a("peopleUnavailable")}</p>`:u}
      <div class="plist" role="radiogroup" aria-label=${a("at_person")}>
        ${(this.people??[]).length?(this.people??[]).map(e=>o`<label><input type="radio" name="lp" .checked=${this.pick===e.id} @change=${()=>this.pick=e.id} /><span><b>${e.display_name}</b><small>${e.access_category?a(e.access_category==="contractor"?"contractor":"visitor"):""}${e.stations?` · ${e.stations.length}`:""}</small></span></label>`):o`<p class="note">${a("lk_none")}</p>`}
      </div>
    </div>`}render(){const e=this.data;if(this.absent)return u;if(!e&&this.loadError)return o`<section class="card"><h3><sw-icon name="lock" size="18"></sw-icon>${a("id_title")}</h3>
        <div class="state" role="alert" data-identity-error><sw-icon name="warning" size="16"></sw-icon><span>${a("id_error")}</span><span class="sp"></span>
          <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>${a("retry")}</sw-button></div></section>`;if(!e)return this.loading?o`<section class="card"><h3><sw-icon name="lock" size="18"></sw-icon>${a("id_title")}</h3><div class="state" role="status" data-identity-loading>${a("id_loading")}</div></section>`:u;const t=this.stateView(e),n=!!e.link?.name_drift,i=Q(e.permanent_vendor),s=e.name_sync==="auto",r=p=>a(p),d=o`<section class="card" data-identity=${e.link?`${e.link.origin}:${e.link.state}`:e.unresolved?"unresolved":"none"}>
      <h3><sw-icon name="lock" size="18"></sw-icon>${a("id_title")}</h3>
      <div class="idstate" data-tone=${t.tone}><span class="big"><sw-icon name=${t.icon} size="22"></sw-icon></span><div><b>${a(t.t)}</b><small>${t.desc}</small>
        ${n?o`<span class="chip" data-tone="warn" data-identity-drift style="margin-block-start:6px">${a("id_drift")}</span>`:u}
        ${i?o`<span class="chip" data-tone=${i.tone} data-identity-marker=${i.permanent?"permanent":"temporary"} style="margin-block-start:6px">${a(i.key)}</span>`:u}</div></div>
      ${this.notice?o`<p class="ok-line" role="status">${this.notice}</p>`:u}
      <div class="acts">
        ${this.act("link","act_link","act_linkText","act_linkBtn",e.can.link,e.link?r("act_linkWhy"):r("act_noRight"),()=>this.open("link"),"link")}
        ${this.act("close","act_unlink","act_unlinkText","act_unlinkBtn",e.can.unlink,e.link?r("act_noRight"):r("act_unlinkWhy"),()=>this.open("unlink"),"unlink")}
        ${this.act("trash","act_delete","act_deleteText","act_deleteBtn",e.can.delete,e.link?.origin==="matched"?r("act_deleteWhyMatched"):e.link?r("act_noRight"):r("act_deleteWhyNone"),()=>this.open("delete"),"delete",!0)}
        ${e.link?.origin==="created_from_arx"?this.act("refresh","act_push","act_pushText","act_pushBtn",e.can.push_name&&n,r(s?"act_pushAuto":n?"act_noRight":"id_drift"),()=>this.run(()=>U(e.link.id),"act_pushDone"),"push"):u}
        ${e.unresolved?o`<div class="act wide ${e.can.attach?"":"dis"}" data-identity-act="attach"><h4><sw-icon name="user" size="16"></sw-icon>${a("act_attach")}</h4>${a("act_attachText")}
              <sw-button size="sm" ?disabled=${!e.can.attach||this.busy} @click=${()=>this.open("attach")}>${a("act_attachBtn")}</sw-button>
              ${e.can.attach?u:o`<span class="why"><sw-icon name="lock" size="14"></sw-icon>${a("at_sub")}</span>`}</div>`:u}
      </div>
    </section>`;return this.compact?o`${d}${this.dialogs(e)}`:o`<div class="grid">${d}
      <aside class="side">
        <section class="stack" style="gap:8px"><h3><sw-icon name="shield" size="18"></sw-icon>${a("ir_title")}</h3><div class="kv">
          <div><span>${a("ir_source")}</span><b>Arx</b></div>
          <div><span>${a("ir_sent")}</span><b>${a("ir_sentValue")}</b></div>
          <div><span>${a("ir_phone")}</span><b>${a("ir_phoneValue")}</b></div>
          <div><span>${a("ir_doors")}</span><b>${a("ir_doorsValue")}</b></div>
          <div><span>${a("ir_name")}</span><b>${s?a("ir_nameAuto"):a("ir_nameManual")}</b></div></div></section>
        ${e.history.length?o`<section class="stack" style="gap:8px"><h3><sw-icon name="history" size="18"></sw-icon>${a("id_history")}</h3><ol class="tl">${e.history.map(p=>o`<li><time>${_(p.at,this.tz)}</time><i data-tone="acc"></i><span>${S[p.action]?a(S[p.action]):p.action}</span></li>`)}</ol></section>`:u}
      </aside></div>${this.dialogs(e)}`}};l.styles=[J,T`
      :host { display: block; --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px)); --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px)); }
      .state { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .state .sp { flex: 1; }
      .card { display: grid; gap: 12px; }
      .grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 14px; align-items: start; }
      :host([compact]) .grid { grid-template-columns: 1fr; }
      h3 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); display: flex; gap: 8px; align-items: center; }
      .idstate { display: grid; grid-template-columns: 44px 1fr auto; gap: 12px; align-items: center; padding: 12px; border-radius: var(--sw-r-md); background: var(--cs); }
      .idstate .big { inline-size: 44px; block-size: 44px; border-radius: var(--sw-r-sm); display: grid; place-items: center; background: var(--sw-surface-solid); color: var(--ct); }
      .idstate b { display: block; color: var(--sw-heading); }
      .idstate small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .acts { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
      .act { display: grid; gap: 6px; align-content: start; padding: 12px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border-strong); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .act h4 { margin: 0; font-size: var(--sw-fs-base); color: var(--sw-heading); display: flex; gap: 6px; align-items: center; }
      .act.dis { background: var(--sw-surface-2); border-style: dashed; }
      .act .why { display: flex; gap: 6px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
      .act.wide { grid-column: 1 / -1; border-style: dashed; }
      .side { display: grid; gap: 12px; }
      .plist { display: grid; gap: 6px; max-block-size: 40vh; overflow: auto; }
      .plist label { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: center; padding: 8px 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); cursor: pointer; min-block-size: var(--sw-touch-desktop); box-sizing: border-box; }
      .plist small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
      .ok-line { color: var(--x-ok-t); font-size: var(--sw-fs-sm); font-weight: 600; margin: 0; }
      .foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-block-start: 14px; }
      @media (max-width: 760px) { .grid { grid-template-columns: 1fr; } }
    `];c([w({attribute:"contact-id"})],l.prototype,"contactId",2);c([w()],l.prototype,"name",2);c([w({type:Boolean})],l.prototype,"compact",2);c([w({attribute:!1})],l.prototype,"tz",2);c([f()],l.prototype,"data",2);c([f()],l.prototype,"absent",2);c([f()],l.prototype,"loading",2);c([f()],l.prototype,"loadError",2);c([f()],l.prototype,"dialog",2);c([f()],l.prototype,"busy",2);c([f()],l.prototype,"error",2);c([f()],l.prototype,"notice",2);c([f()],l.prototype,"word",2);c([f()],l.prototype,"q",2);c([f()],l.prototype,"people",2);c([f()],l.prototype,"peopleError",2);c([f()],l.prototype,"pick",2);c([f()],l.prototype,"ref",2);l=c([q("access-identity-card")],l);function _(e,t){const n=new Date(e);if(Number.isNaN(n.getTime()))return"";const i={day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"};try{return n.toLocaleString(document.documentElement.lang||"he-IL",t?{...i,timeZone:t}:i)}catch{return n.toLocaleString(document.documentElement.lang||"he-IL",i)}}export{re as B,Ee as D,Se as M,oe as S,de as a,ge as b,he as c,ve as d,ye as e,ue as f,_e as g,we as h,me as i,O as j,D as k,fe as l,xe as m,ke as n,le as o,Ae as p,Ie as q,$e as r,pe as s,be as t,v as u,ce as v,ze as w,J as x,Q as y,Te as z};
//# sourceMappingURL=identity-card-CUG6nGBl.js.map
