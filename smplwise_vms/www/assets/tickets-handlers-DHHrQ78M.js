import{E as A,F as m,G as c,a as I,R as y,p as s,A as d,e as n,H as j,i as J,b7 as T,bb as Y,cE as Q,g as G,j as R,C as W,D as re,g6 as _e,S as oe,b as de,f as q,h as E,om as pe,na as S,q as u,t as w,on as X,cI as N,bV as ne,l as Le,oo as Me,op as Ee,oq as De,x as Re,o as Te,or as Oe,r as Ne,os as Ae,ot as Ie,cL as he,eC as je}from"./index-BJ665FDN.js";import{L as Se,b as me}from"./tickets-board-Be-58pqs.js";import{p as Z,c as He}from"./tickets-phone-verify-SggtVBVr.js";import{p as ee,q as Be,y as te,M as Fe,z as Ve}from"./identity-card-jmnvCQz7.js";import{t as Ce}from"./settings-styles-CECXTBwa.js";import{b as ze,r as Ue,H as ue,a as se,s as Ke,m as fe,l as Ge,w as We,c as Je}from"./handler-load-BXHEF_X6.js";import{a as Ye}from"./media-page-C8y559Vm.js";import{r as Qe}from"./settings-tabs-CcQjb9O6.js";import{F as Xe,f as Ze,p as et,a as tt,b as st,t as at}from"./list-toolbar-scRdWm7F.js";import"./sw-logo-art-Va6y_cIM.js";import"./access-grants-C46dsanm.js";import"./access-people-CaljknBI.js";import"./wiskey-format-B1C9aa4N.js";import"./recordings-BbVpf66t.js";import"./lead-reserve-8HuqOQGZ.js";import"./list-text-DK2ThST_.js";var it=Object.defineProperty,nt=Object.getOwnPropertyDescriptor,C=(e,t,i,a)=>{for(var r=a>1?void 0:a?nt(t,i):t,l=e.length-1,o;l>=0;l--)(o=e[l])&&(r=(a?o(t,i,r):o(r))||r);return a&&r&&it(t,i,r),r};let _=class extends I{constructor(){super(...arguments),this.contactId=null,this.hasPhone=!1,this.userLinked=!1,this.required=!1,this.confirmed=!1,this.via=null,this.confirmToken=null,this.busy=!1,this.sent=!1,this.code="",this.error="",this.cooldown=0}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}startCooldown(e){this.cooldown=e,window.clearInterval(this.timer),this.timer=window.setInterval(()=>{this.cooldown=Math.max(0,this.cooldown-1),this.cooldown||window.clearInterval(this.timer)},1e3)}async act(e,t){if(!(this.busy||!this.contactId)){this.busy=!0,this.error="";try{await e(),t?.()}catch(i){this.error=y(i)}finally{this.busy=!1}}}done(){this.sent=!1,this.code="",this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}viaText(){return this.via==="code"?s("otpConfirmedCode"):this.via==="manager"?s("otpConfirmedManager"):s("otpConfirmedUser")}render(){if(!this.hasPhone||!this.contactId)return d;const e=this.contactId;if(this.confirmed)return n`<div class="row" data-phone-verify="confirmed"><span class="tag ok">${s("otpConfirmed")} · ${this.viaText()}</span></div>`;const t=this.error?n`<div class="err" role="alert">${this.error}</div>`:d;if(this.required&&this.userLinked)return n`<div class="row" data-phone-verify="user-only"><span class="tag warn">${s("otpRequired")}</span><span class="hint">${s("otpUserOnly")}</span></div>`;if(this.required)return n`<div class="row" data-phone-verify="required">
          <span class="tag warn">${s("otpRequired")}</span>
          <button type="button" ?disabled=${this.busy||this.cooldown>0} data-phone-verify-send
            @click=${()=>void this.act(()=>Z.contactSend(e),()=>{this.sent=!0,this.startCooldown(60)})}>
            ${this.sent?s("otpResend"):s("otpSend")}${this.cooldown?` (${this.cooldown})`:""}</button>
        </div>
        ${this.sent?n`<div class="hint">${s("otpSent")}</div>
          <div class="row"><input inputmode="numeric" autocomplete="one-time-code" maxlength="9" aria-label=${s("otpCodeLabel")} placeholder="000000"
              .value=${this.code} data-phone-verify-code @input=${a=>{this.code=a.target.value}}>
            <button type="button" ?disabled=${this.busy||!He(this.code)} data-phone-verify-check
              @click=${()=>void this.act(()=>Z.contactCheck(e,this.code),()=>this.done())}>${s("otpVerify")}</button></div>`:d}
        ${t}`;const i=this.confirmToken;return n`<div class="row" data-phone-verify="unconfirmed"><span class="tag">${s("otpUnconfirmed")}</span>
        ${i?n`<button type="button" ?disabled=${this.busy} data-phone-verify-sure
          @click=${()=>void this.act(()=>Z.contactConfirm(e,i),()=>this.done())}>${s("otpManagerSure")}</button>`:d}</div>${t}`}};_.styles=A`
    :host { display: block; }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 4px 0; }
    .tag { font-size: var(--sw-fs-xs); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); }
    .ok { color: var(--sw-success-text); }
    .warn { color: var(--sw-warning-text); }
    .hint { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    input { font: inherit; width: 9ch; padding: 4px 8px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit;
      direction: ltr; text-align: center; letter-spacing: 0.15em; font-variant-numeric: tabular-nums; }
    button { font: inherit; padding: 4px 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border); background: transparent; color: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: default; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
  `;C([m({attribute:!1})],_.prototype,"contactId",2);C([m({type:Boolean})],_.prototype,"hasPhone",2);C([m({type:Boolean})],_.prototype,"userLinked",2);C([m({type:Boolean})],_.prototype,"required",2);C([m({type:Boolean})],_.prototype,"confirmed",2);C([m({attribute:!1})],_.prototype,"via",2);C([m({attribute:!1})],_.prototype,"confirmToken",2);C([c()],_.prototype,"busy",2);C([c()],_.prototype,"sent",2);C([c()],_.prototype,"code",2);C([c()],_.prototype,"error",2);C([c()],_.prototype,"cooldown",2);_=C([j("tickets-phone-verify")],_);const z="tickets/dept-handlers",$=encodeURIComponent,rt={overview:()=>G(z),people:e=>G(`${z}/people${e?.trim()?`?q=${$(e.trim())}`:""}`),addMember:(e,t)=>Y(`${z}/${$(e)}/members/${$(t)}`,{}),removeMember:(e,t)=>Q(`${z}/${$(e)}/members/${$(t)}`,{method:"DELETE"}),createContact:(e,t)=>T(`${z}/${$(e)}/contacts`,t),patchContact:(e,t,i)=>Q(`${z}/${$(e)}/contacts/${$(t)}`,{method:"PATCH",body:JSON.stringify(i)}),attach:(e,t)=>Y(`${z}/${$(e)}/contacts/${$(t)}`,{}),detach:(e,t)=>Q(`${z}/${$(e)}/contacts/${$(t)}`,{method:"DELETE"}),erase:(e,t)=>T(`${z}/${$(e)}/contacts/${$(t)}/erase`,{confirm:!0}),memberMobile:(e,t,i)=>Y(`${z}/${$(e)}/members/${$(t)}/mobile`,i),lookup:(e,t)=>T(`${z}/${$(e)}/contacts/lookup`,{phone:t}),attachByPhone:(e,t,i)=>T(`${z}/${$(e)}/contacts/attach-by-phone`,{contact_id:t,phone:i})},M=()=>Promise.reject(new R(403,{code:"forbidden",user_message:"",retryable:!1,correlation_id:"",details:{permission:"tickets.handlers"}})),ot={overview:()=>Promise.resolve({departments:[],can_manage:!1,full_phones:!1}),people:()=>Promise.resolve({users:[]}),addMember:M,removeMember:M,createContact:M,patchContact:M,attach:M,detach:M,erase:M,memberMobile:M,lookup:M,attachByPhone:M};function P(){return J()?rt:ot}function dt(e){return e.filter(t=>t.can_handlers===!0).map(t=>t.id)}function lt(e,t){return t&&e.kind==="user"&&e.role==="member"}function ct(e,t){const i={edit:!1,attach:[],detach:[],shared:!e.departments.length};if(!t.length||e.erased||e.user_linked)return i;const a=!e.departments.length,r=e.departments.filter(l=>t.includes(l));return{edit:e.manager_editable===!0,shared:a,attach:a||!r.length?[]:t.filter(l=>!e.departments.includes(l)),detach:a||e.departments.length<=1?[]:r}}function be(e){return e!=="employee"}const ve=!1;function pt(e,t,i){return e?e.other?i:e.name||(e.id?t(e.id):null):null}function ge(e){const t=e.trim().replace(/[\s\-().]/g,"").replace(/^\+/,"");return/^\d{9,15}$/.test(t)}function $e(e){return e.kind==="user"&&e.role==="member"&&e.mobile_editable===!0}function ht(e,t){return e===!1&&!t?["person","vendor"]:["person","vendor","employee"]}const le=A`
  .sh {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding-inline: 4px;
    margin-block-start: 6px;
  }
  .sh h2 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--sw-fs-2xl);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  .sh h2 .n {
    display: inline-grid;
    place-items: center;
    min-inline-size: 24px;
    block-size: 24px;
    padding-inline: 8px;
    border-radius: 999px;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .sh small {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .sh .grow {
    flex: 1;
  }
  .cgrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 350px), 1fr));
    gap: var(--dv-gap-lg, 16px);
    align-items: stretch;
  }
  .hcard {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 18px 14px;
    min-inline-size: 0;
    border-radius: var(--sw-r-2xl);
    transition: box-shadow var(--mm-motion), transform var(--mm-motion);
  }
  @media (hover: hover) and (pointer: fine) {
    .hcard:hover {
      box-shadow: var(--dv-shadow-2);
    }
  }
  .hcard.off {
    opacity: 0.72;
  }
  .hcard header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hcard header .t {
    flex: 1;
    min-inline-size: 0;
  }
  .hcard h3 {
    margin: 0;
    font-size: var(--sw-fs-xl);
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hcard .role {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 6px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    min-inline-size: 0;
  }
  .hcard .role .chip {
    block-size: 22px;
    padding-inline: 8px;
    font-size: var(--sw-fs-xs);
  }
  .hperiod {
    display: flex;
    flex: none;
  }
  .hperiod select {
    block-size: 38px;
    padding-inline: 12px;
    max-inline-size: 100%;
    min-inline-size: 0;
    border-radius: var(--dv-radius-control);
    background: var(--mm-sheen), var(--dv-surface);
    border: 1px solid var(--dv-border);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
  }
  .hperiod select:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 1px;
  }
  @media (max-width: 767px) {
    .dh-det .hperiod {
      order: 2;
      flex: 1 1 100%;
    }
    .dh-det .hperiod select {
      inline-size: 100%;
    }
    .hcard .stats {
      gap: 6px 14px;
    }
  }
  .hcard .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .hcard .stats b {
    display: block;
    font-size: var(--sw-fs-3xl);
    font-weight: 800;
    color: var(--dv-text);
    line-height: 1.1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .hcard .stats b.warn {
    color: var(--au-warn-text);
  }
  .hcard .stats small[data-stat-period] {
    display: block;
    font-size: var(--sw-fs-xs);
    color: var(--dv-text-3, var(--dv-text-2));
  }
  .hcard .stats b.bad {
    color: var(--dv-danger);
  }
  .hcard footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-block-start: auto;
  }
  .hcard footer .push {
    margin-inline-start: auto;
  }
  .hcard .main {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-inline-size: 0;
    cursor: pointer;
    border-radius: var(--sw-r-lg);
  }
  .hcard .main:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 3px;
  }
  .tile {
    flex: none;
    inline-size: 44px;
    block-size: 44px;
    border-radius: var(--sw-r-lg);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: var(--sw-fs-lg);
    background: color-mix(in srgb, var(--sw-purple) 16%, transparent);
    color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text));
  }
  .tile.int {
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .tile.grp {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .tile .ic {
    font-size: var(--sw-fs-2xl);
  }
  .chip.wa {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .chip.pur {
    background: color-mix(in srgb, var(--sw-purple) 16%, transparent);
    color: color-mix(in srgb, var(--sw-purple) 68%, var(--dv-text));
  }
  .chip.xs {
    block-size: 22px;
    padding-inline: 8px;
    font-size: var(--sw-fs-xs);
  }
  /* the preferred channel: three round choices, one on */
  .chsel {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: 999px;
    background: var(--dv-surface-3);
  }
  .chsel button {
    position: relative;
    border: 0;
    background: transparent;
    inline-size: 32px;
    block-size: 28px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    color: var(--dv-text-3);
    cursor: pointer;
  }
  .chsel button::before {
    content: '';
    position: absolute;
    inset: -8px -2px;
  }
  .chsel button:disabled {
    cursor: default;
  }
  .chsel button[aria-checked='true'] {
    background: var(--mm-seg-thumb);
    color: var(--dv-accent-text);
    box-shadow: var(--dv-shadow-control);
  }
  .chsel button:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 1px;
  }
  .chsel .ic {
    font-size: var(--sw-fs-lg);
  }
  .manage {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-block-start: 10px;
    border-block-start: 1px solid var(--dv-border);
  }
  .manage .line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .manage .line .lbl {
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    min-inline-size: 5em;
  }
  .manage .rm {
    margin-inline-start: auto;
    border: 0;
    background: transparent;
    color: var(--dv-danger);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    min-block-size: 36px;
    padding-inline: 8px;
    cursor: pointer;
  }
  .crows {
    padding: 0;
    overflow: hidden;
    border-radius: var(--sw-r-2xl);
  }
  .crow {
    display: grid;
    grid-template-columns: auto minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 6px 16px;
    min-block-size: 56px;
    border: 0;
    border-block-end: 1px solid var(--dv-border);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--sw-fs-md);
    text-align: start;
    inline-size: 100%;
    cursor: pointer;
  }
  .crow:last-child {
    border-block-end: 0;
  }
  @media (hover: hover) and (pointer: fine) {
    .crow:hover {
      background: var(--dv-surface-2);
    }
  }
  .crow:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: -2px;
  }
  .crow[aria-current='true'] {
    background: var(--dv-accent-soft);
  }
  .crow b {
    display: block;
    font-weight: 700;
  }
  .crow small {
    display: block;
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
  }
  .crow .av {
    inline-size: 36px;
    block-size: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: var(--sw-fs-sm);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
  }
  .crow .chs {
    display: inline-flex;
    gap: 4px;
  }
  .crow .chs span {
    inline-size: 28px;
    block-size: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--dv-surface-3);
    color: var(--dv-text-2);
  }
  .crow .chs span.on {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .crow .chs .ic {
    font-size: var(--sw-fs-base);
  }
  .crow .mut,
  .mut {
    color: var(--dv-text-3);
    font-size: var(--sw-fs-sm);
  }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
    text-align: start;
  }
  /* the add panel and the editor form share the glass fields */
  .addp {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    border-radius: var(--sw-r-2xl);
  }
  .addp .inp {
    min-block-size: 44px;
    inline-size: auto;
    min-inline-size: 0;
    flex: 1 1 160px;
  }
  .msg {
    padding: 10px 14px;
    border-radius: var(--sw-r-lg);
    font-size: var(--sw-fs-sm);
  }
  .msg.ok {
    background: var(--dv-success-soft);
    color: var(--au-ok-text);
  }
  .msg.err {
    background: var(--dv-danger-soft);
    color: var(--dv-danger);
  }
  @media (max-width: 767px) {
    .crow {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .crow .hide-p {
      display: none;
    }
    .cgrid {
      grid-template-columns: minmax(0, 1fr);
    }
    .sh h2 {
      font-size: var(--sw-fs-xl);
    }
  }
`;var mt=Object.defineProperty,ut=Object.getOwnPropertyDescriptor,h=(e,t,i,a)=>{for(var r=a>1?void 0:a?ut(t,i):t,l=e.length-1,o;l>=0;l--)(o=e[l])&&(r=(a?o(t,i,r):o(r))||r);return a&&r&&mt(t,i,r),r};const we=e=>e.trim().split(/\s+/).slice(0,2).map(t=>t[0]??"").join(""),F={he:"עברית",en:"English",ar:"العربية",ru:"Русский"};function V(e,t="person"){return{kind:e?.kind??t,display_name:e?.display_name??"",company:e?.company??"",vendor_id:e?.vendor_id??"",phone:e?.phone_full?e.phone??"":"",email:e?.phone_full?e.email??"":"",preferred_channel:e?.preferred_channel??"whatsapp",require_code:e?.require_code??!1,share_history:e?.share_history===null||e?.share_history===void 0?"default":e.share_history?"on":"off",lang:e?.lang??"he",notes:e?.notes??"",active:e?.active??!0,departments:[...e?.departments??[]],cost_claim:e?.cost_claim??"",vat_exempt:e?.vat_exempt??!1,vat_default:e?.vat_default??"excluded",labor_rate:De(e?.labor_rate_minor),rate_currency:e?.rate_currency??"ILS",phone_verify:e?.phone_verify??!1,permanent_vendor:e?.permanent_vendor??!1}}let p=class extends I{constructor(){super(...arguments),this.bubbleSkin=new oe(this),this.kind="",this.dept="",this.query="",this.head=!1,this.newbtn=!1,this.loads=null,this.handledLabel=null,this.managed=[],this.rows=null,this.vendorRows=[],this.canEdit=!1,this.canEditStaff=!0,this.filter="all",this.marker="all",this.selected="",this.creating=!1,this.draft=null,this.departments=[],this.busy=!1,this.erasing=!1,this.eraseHistory=!1,this.problem="",this.liveLinks=0,this.full=null,this.denied=!1,this.mine=[],this.mgrDept="",this.mgrShared=ve,this.lkPhone="",this.lkMatches=null,this.searchTimer=0,this.loadedKind="",this.live=new Se(()=>{!this.busy&&!this.selected&&!this.creating&&!this.denied&&this.load()})}connectedCallback(){super.connectedCallback(),de(this),this.live.start(),this.load(),q().meta().then(e=>this.departments=e.departments.map(t=>({id:t.id,name:t.name}))).catch(()=>{})}disconnectedCallback(){super.disconnectedCallback(),this.live.stop(),window.clearTimeout(this.searchTimer)}updated(e){e.has("kind")&&this.kind!==this.loadedKind&&this.isConnected?(this.selected="",this.creating=!1,this.draft=null,this.rows=null,this.load()):e.has("query")&&e.get("query")!==void 0&&this.isConnected&&(window.clearTimeout(this.searchTimer),this.searchTimer=window.setTimeout(()=>void this.load(),250))}startNew(){(this.canEdit||this.mgr||this.rows===null)&&this.open(null)}get mgr(){return!this.canEdit&&this.mine.length>0}deptFor(e){return e.departments.find(t=>this.mine.includes(t))??(this.dept&&this.mine.includes(this.dept)?this.dept:this.mine[0])}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){try{this.loadedKind=this.kind;const e=this.kind||(this.filter==="all"?void 0:this.filter),t=await E().contacts({q:this.query,kind:e});this.rows=t.contacts,this.canEdit=t.can_edit,this.canEditStaff=t.can_edit_staff??!0,this.mine=t.handler_departments??[],this.kind==="person"&&t.can_edit&&!this.vendorRows.length&&E().contacts({kind:"vendor"}).then(i=>this.vendorRows=i.contacts).catch(()=>{}),this.denied=!1,this.selected&&!t.contacts.some(i=>i.id===this.selected)&&(this.selected="")}catch(e){this.rows=[],e instanceof R&&e.status===403?this.denied=!0:this.notice({error:y(e)})}}open(e){this.selected=e?.id??"",this.creating=!e;const t=this.mgr&&(!e||e.manager_editable===!0);this.draft=this.canEdit||t?V(e,this.kind||"person"):null,this.mgr&&!e&&(this.mgrDept=this.dept&&this.mine.includes(this.dept)?this.dept:this.mine[0],this.mgrShared=ve,this.lkPhone="",this.lkMatches=null),this.erasing=!1,this.eraseHistory=!1,this.problem="",this.liveLinks=0,this.full=null,e&&this.canEdit&&this.loadFull(e.id)}async loadFull(e){try{const t=await E().contact(e);this.selected===e&&(this.liveLinks=t.live_links??0,this.full=t)}catch{}}set(e){this.draft&&(this.draft={...this.draft,...e}),this.problem=""}body(e){const t=this.draft;if(!t)return null;const i={},a=V(e,this.kind||"person");return(!e||t.kind!==a.kind)&&(i.kind=t.kind),(!e||t.display_name.trim()!==a.display_name)&&(i.display_name=t.display_name.trim()),t.company.trim()!==a.company&&(i.company=t.company.trim()),t.kind==="person"&&t.vendor_id!==a.vendor_id&&(i.vendor_id=t.vendor_id||null),t.phone.trim()!==a.phone&&(i.phone=t.phone.trim()||null),t.email.trim()!==a.email&&(i.email=t.email.trim()||null),t.preferred_channel!==a.preferred_channel&&(i.preferred_channel=t.preferred_channel),t.require_code!==a.require_code&&(i.require_code=t.require_code),t.phone_verify!==a.phone_verify&&(i.phone_verify=t.phone_verify),ee(t.kind)&&t.permanent_vendor!==a.permanent_vendor&&(i.permanent_vendor=t.permanent_vendor),t.share_history!==a.share_history&&(i.share_history=t.share_history==="default"?null:t.share_history==="on"),t.lang!==a.lang&&(i.lang=t.lang),t.notes!==a.notes&&(i.notes=t.notes),t.active!==a.active&&(i.active=t.active),t.cost_claim!==a.cost_claim&&(i.cost_claim=t.cost_claim||null),t.vat_exempt!==a.vat_exempt&&(i.vat_exempt=t.vat_exempt),t.vat_default!==a.vat_default&&(i.vat_default=t.vat_default),(t.labor_rate.trim()!==a.labor_rate||t.labor_rate.trim()&&t.rate_currency!==a.rate_currency)&&(i.labor_rate=t.labor_rate.trim()||null,i.rate_currency=t.rate_currency),JSON.stringify([...t.departments].sort())!==JSON.stringify([...a.departments].sort())&&(i.departments=t.departments),i}mgrBody(e,t){const i=["display_name","company","vendor_id","phone","email","preferred_channel","require_code","share_history","lang","active"],a={};for(const r of i)r in t&&(a[r]=t[r]);return e||(a.kind=this.draft?.kind??(this.kind||"person"),be(a.kind)&&(a.shared=this.mgrShared)),a}async save(e){const t=this.draft,i=this.body(e);if(!(!t||!i||this.busy)){if(!t.display_name.trim()){this.problem=s("required");return}if(!(e&&!Object.keys(i).length)){if(t.labor_rate.trim()&&pe(t.labor_rate)===null){this.problem=S("invalid");return}this.busy=!0;try{const a=this.mgr?e?await P().patchContact(this.deptFor(e),e.id,{...this.mgrBody(e,i),revision:e.revision}):await P().createContact(this.mgrDept,this.mgrBody(null,i)):e?await E().patchContact(e.id,{...i,revision:e.revision}):await E().createContact(i),r=this.liveLinks,l=e&&r>0&&(a.live_links??0)<r?r-(a.live_links??0):0;this.notice({ok:l?`${s("setSaved")} · ${s("ctLinksRevoked",{n:l})}`:s("setSaved")}),await this.load(),this.open(a)}catch(a){const r=a instanceof R?a.body.details?.fields??[]:[];this.problem=r.length?`${y(a)} (${r.map(l=>l.field).join(", ")})`:y(a),a instanceof R&&a.status===409&&await this.load()}finally{this.busy=!1}}}}async erase(e){if(!this.busy){this.busy=!0;try{const t=this.mgr?await P().erase(this.deptFor(e),e.id):await E().eraseContact(e.id,this.eraseHistory);this.notice({ok:t.links_revoked?`${s("ctErased")} · ${s("ctLinksRevoked",{n:t.links_revoked})}`:s("ctErased")}),this.selected="",this.draft=null,await this.load()}catch(t){this.notice({error:y(t)})}finally{this.busy=!1,this.erasing=!1}}}async exportData(e){try{const t=await E().exportContact(e.id),i=new Blob([JSON.stringify(t,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(i),a.download=`contact-${e.id.slice(0,8)}.json`,a.click(),window.setTimeout(()=>URL.revokeObjectURL(a.href),2e3)}catch(t){this.notice({error:y(t)})}}async attachment(e,t,i){if(!this.busy){this.busy=!0;try{i?await P().attach(t,e.id):await P().detach(t,e.id),this.notice({ok:s("setSaved")}),await this.load()}catch(a){this.notice({error:y(a)})}finally{this.busy=!1}}}attachments(e){const t=ct(e,this.mine);return n`<div class="fld wide" data-contact-attachments><span>${s("dmMyDepartments")}</span>
      ${t.shared?n`<span class="chip" data-contact-shared>${s("dmShared")}</span>`:n`<span class="chipsrow">${this.mine.map(i=>{const a=e.departments.includes(i);return n`<span class="chip ${a?"info":""}" data-attach-dept=${i}>${u(this.deptName(i))}
          ${a&&t.detach.includes(i)?n`<button type="button" class="rm" data-contact-detach=${i} ?disabled=${this.busy} @click=${()=>void this.attachment(e,i,!1)}>${s("dmDetach")}</button>`:d}
          ${!a&&t.attach.includes(i)?n`<button type="button" class="rm" data-contact-attach=${i} ?disabled=${this.busy} @click=${()=>void this.attachment(e,i,!0)}>${s("dmAttach")}</button>`:d}</span>`})}</span>`}
      ${t.edit?d:n`<span class="hint" data-contact-attachment-only>${s("dmAttachmentOnly")}</span>`}
    </div>`}mgrCreateFields(e){return n`${this.mine.length>1?n`<label class="fld"><span>${s("dmCreateIn")}</span><select class="in" data-field="mgr_department"
        @change=${t=>this.mgrDept=t.target.value}>${this.mine.map(t=>n`<option value=${t} ?selected=${t===this.mgrDept}>${this.deptName(t)}</option>`)}</select></label>`:d}
      ${be(e)?n`<div class="row wide"><span class="lbl">${s("dmShared")}<span class="muted">${s("dmSharedHint")}</span></span>
        <sw-toggle label=${s("dmShared")} labelHidden .checked=${this.mgrShared} data-field="mgr_shared" @change=${t=>this.mgrShared=t.detail.checked}></sw-toggle></div>`:d}`}async lookup(){if(!(this.busy||!ge(this.lkPhone))){this.busy=!0;try{this.lkMatches=(await P().lookup(this.mgrDept,this.lkPhone.trim())).matches}catch(e){this.lkMatches=null,this.notice({error:y(e)})}finally{this.busy=!1}}}async attachFound(e){if(!this.busy){this.busy=!0;try{const t=await P().attachByPhone(this.mgrDept,e.id,this.lkPhone.trim());this.notice({ok:s("setSaved")}),this.creating=!1,this.draft=null,this.lkMatches=null,await this.load(),this.open(t)}catch(t){this.notice({error:y(t)})}finally{this.busy=!1}}}lookupBlock(){const e=this.lkMatches;return n`<div class="fld wide" data-vendor-lookup><span>${s("dmLookupTitle")}</span>
      <span class="chipsrow"><input class="in tel" type="tel" dir="ltr" inputmode="tel" maxlength="40" autocomplete="off" data-vendor-lookup-phone
        aria-label=${s("dmLookupTitle")} .value=${this.lkPhone} @input=${t=>{this.lkPhone=t.target.value,this.lkMatches=null}}
        @keydown=${t=>{t.key==="Enter"&&this.lookup()}} />
        <sw-button size="sm" data-vendor-lookup-find ?disabled=${this.busy||!ge(this.lkPhone)} @click=${()=>void this.lookup()}>${s("dmLookupFind")}</sw-button></span>
      <span class="hint">${s("dmLookupHint")}</span>
      ${e===null?d:e.length?n`<span class="chipsrow" data-vendor-lookup-results>${e.map(t=>n`<span class="chip" data-vendor-match=${t.id}>
          ${u(t.display_name)} <span dir="ltr">${t.phone??""}</span>
          ${t.shared?n`<span class="mut">${s("dmShared")}</span>`:t.attached?n`<span class="mut">${s("dmLookupAttached")}</span>`:n`<button type="button" class="rm" data-vendor-match-attach ?disabled=${this.busy} @click=${()=>void this.attachFound(t)}>${s("dmLookupAttach")}</button>`}</span>`)}</span>`:n`<span class="hint" role="status" data-vendor-lookup-none>${s("dmLookupNone")}</span>`}
    </div>`}createdText(e){return pt(e.created_department,t=>this.deptName(t),s("dmCreatedOther"))}shown(){const e=this.kind==="employee"?this.rows??[]:Be(this.rows??[],this.marker);return this.dept?e.filter(t=>!t.departments.length||t.departments.includes(this.dept)):e}deptName(e){return this.departments.find(t=>t.id===e)?.name??e}chIcon(e){return e==="whatsapp"?w("send"):e==="email"?w("note"):w("copy")}channelSel(e){return n`<span class="chsel" role="radiogroup" aria-label=${s("u6ChannelPref")} data-contact-channels>${X.map(t=>n`<button type="button" role="radio"
      aria-checked=${String(e.preferred_channel===t)} aria-label=${s(`ch_${t}`)} title=${s(`ch_${t}`)} data-contact-channel=${t}
      ?disabled=${!this.canEdit||this.busy} @click=${()=>void this.quickChannel(e,t)}>${this.chIcon(t)}</button>`)}</span>`}async quickChannel(e,t){if(!(!this.canEdit||this.busy||e.preferred_channel===t)){this.busy=!0;try{await E().patchContact(e.id,{preferred_channel:t,revision:e.revision}),this.notice({ok:s("setSaved")}),await this.load()}catch(i){this.notice({error:y(i)}),i instanceof R&&i.status===409&&await this.load()}finally{this.busy=!1}}}loadOf(e){return!this.loads||!ze(this.managed,e.departments)?null:this.loads.get(`contact:${e.id}`)??{open:0,waiting:0,stuck:0}}card(e){const t=e.kind==="employee",i=t?this.loadOf(e):null,a=this.createdText(e),r=t?[s("u6NoAccount"),e.phone].filter(Boolean).join(" · "):[e.phone,F[e.lang]].filter(Boolean).join(" · ");return n`<article class=${`glass hcard ${e.active?"":"off"}`} data-contact-card=${e.id}>
      <header>
        <button type="button" class="main" data-contact-item=${e.id} aria-current=${String(e.id===this.selected)} @click=${()=>this.open(e)}>
          <span class=${`tile ${t?"":"int"}`} aria-hidden="true">${we(e.display_name)}</span>
          <span class="t"><h3>${u(e.display_name)}</h3>
            <span class="role">${u(r||"–")}${t?n`<span class="chip xs pur">${w("link")}${s("u6PersonalLink")}</span>`:d}${e.active?d:n`<span class="chip xs">${s("depInactive")}</span>`}</span></span>
        </button>
      </header>
      ${t?i?n`<div class="stats" data-contact-stats>
            <div><b data-stat="open">${i.open}</b>${s("u6Open")}</div>
            <div><b class=${i.waiting?"warn":""} data-stat="waiting">${i.waiting}</b>${s("u6WaitingHim")}</div>
            <div><b class=${i.stuck?"bad":""} data-stat="stuck">${i.stuck}</b>${s("u6Stuck")}</div>
            ${this.handledLabel===null?d:n`<div data-stat-cell="handled"><b data-stat="handled">${i.handled??0}</b>${s("u6Handled")}<small data-stat-period>${this.handledLabel}</small></div>`}</div>`:d:n`<div class="stats" data-contact-stats><div><b data-stat="open">${e.open_tickets}</b>${s("u6Open")}</div></div>`}
      <footer>
        <span class="fchips">${e.departments.map(l=>n`<span class="chip">${u(this.deptName(l))}</span>`)}
          ${a?n`<span class="chip xs" title=${s("dmCreatedIn")} data-contact-created>${s("dmCreatedIn")}: ${u(a)}</span>`:d}</span>
        ${t?e.preferred_channel==="whatsapp"&&e.has_phone?n`<span class="chip wa">${w("send")}${s("ch_whatsapp")}</span>`:d:n`<span class="push"></span>${this.channelSel(e)}<span class=${`chip ${e.require_code?"info":""}`} title=${s("u6CodeTitle")} data-contact-code>${w("lock")}${e.require_code?s("u6CodeOn"):s("u6CodeOff")}</span>${this.markerChip(e)}`}
      </footer>
    </article>`}row(e){return n`<button type="button" role="listitem" class=${`crow ${e.active?"":"off"}`} aria-current=${String(e.id===this.selected)} data-contact-item=${e.id} @click=${()=>this.open(e)}>
      <span class="av" aria-hidden="true">${we(e.display_name)}</span>
      <span><b>${u(e.display_name)}</b><small>${u(e.vendor_name??e.company??"")||" "}</small>${this.markerChip(e)}</span>
      <span class="ltr hide-p">${e.phone??"–"}</span>
      <span class="hide-p mut">${F[e.lang]}</span>
      <span class="chs" aria-label=${s(`ch_${e.preferred_channel}`)}>${X.map(t=>n`<span class=${e.preferred_channel===t?"on":""}>${this.chIcon(t)}</span>`)}</span>
    </button>`}markerChip(e){const t=ee(e.kind)?te(e.permanent_vendor):null;return t?n`<span class=${`chip xs ${t.permanent?"info":""}`} data-contact-marker=${t.permanent?"permanent":"temporary"}>${N(t.key)}</span>`:d}markerBar(){return this.kind==="employee"||this.rows===null||!this.rows.length?d:n`<span class="seg" role="radiogroup" aria-label=${N("vm_kind")} data-contacts-marker-filter>${Fe.map(e=>n`<button type="button" role="radio"
      aria-checked=${String(this.marker===e)} aria-pressed=${String(this.marker===e)} data-marker-filter=${e} @click=${()=>this.marker=e}>${N(Ve(e))}</button>`)}</span>`}listCard(){const e=this.shown(),t=this.kind,i=t==="employee"?s("u6SecEmployees"):t==="vendor"?s("hdSeg_vendors"):s("hdSeg_contacts"),a=t==="employee"?s("u6SecEmployeesSub"):t==="vendor"?s("u6SecVendorsSub"):s("u6SecContactsSub"),r=!!this.query.trim()||!!this.dept||this.marker!=="all";let l;return this.rows===null?l=n`<div class="cgrid" data-contacts-loading aria-busy="true"><div class="glass hcard"><span class="skl" style="block-size:20px;inline-size:55%"></span><span class="skl" style="block-size:44px"></span></div></div>`:e.length?t==="person"?l=n`<div class="glass crows" role="list" data-contacts-list>${ne(e,o=>o.id,o=>this.row(o))}</div>`:l=n`<div class="cgrid" data-contacts-list>${ne(e,o=>o.id,o=>this.card(o))}</div>`:l=n`<sw-state-panel icon="users" state="empty" heading=${r?s("ctNone"):t?s(`ctEmpty_${t}`):s("ctEmpty")}></sw-state-panel>`,n`<div class="sec" data-card="contacts" data-contacts-kind=${t||"all"}>
      ${this.head?n`<div class="sh"><h2>${i}<span class="n" data-contacts-count>${e.length}</span></h2><small>${a}</small>
        <span class="grow"></span>
        ${this.newbtn&&(this.canEdit||this.mgr)&&(t!=="employee"||this.canEditStaff||this.mgr)?n`<button type="button" class="btn sm" data-contact-new ?disabled=${this.busy} @click=${()=>this.open(null)}>${w("plus")}${s(`ctNew_${t||"person"}`)}</button>`:d}</div>`:d}
      ${this.markerBar()}
      ${l}
    </div>`}readOnlyBody(e){const t=e.departments.length?e.departments.map(i=>this.departments.find(a=>a.id===i)?.name??i).join(", "):s("ctDepartmentsAll");return n`<div class="drawer-body" data-card="contact" data-contact=${e.id}>
      <dl class="ro">
        ${e.company?n`<dt>${s("ctCompany")}</dt><dd>${u(e.company)}</dd>`:d}
        ${e.vendor_name?n`<dt>${s("ctVendor")}</dt><dd>${u(e.vendor_name)}</dd>`:d}
        <dt>${s("ctPhone")}</dt><dd dir="ltr">${e.phone??"–"}${e.phone&&!e.phone_full?n` <span class="tag">${s("ctMasked")}</span>`:d}</dd>
        <dt>${s("ctLang")}</dt><dd>${F[e.lang]}</dd>
        <dt>${s("ctRequireCode")}</dt><dd>${e.require_code?s("ctYes"):s("ctNo")}</dd>
        ${ee(e.kind)&&te(e.permanent_vendor)?n`<dt>${N("vm_kind")}</dt><dd data-contact-marker-ro>${N(te(e.permanent_vendor).key)}</dd>`:d}
        <dt>${s("ctDepartments")}</dt><dd>${t}</dd>
        ${this.createdText(e)?n`<dt>${s("dmCreatedIn")}</dt><dd data-contact-created-ro>${u(this.createdText(e)??"")}</dd>`:d}
      </dl>
      ${this.mgr?this.attachments(e):d}
      ${e.kind==="person"?n`<access-identity-card compact data-contact-identity contact-id=${e.id} name=${e.display_name}></access-identity-card>`:d}
    </div>`}costFields(e){const t=!J()||Le("tickets.costs.view"),i=["","required","optional","off"],a=!!e.labor_rate.trim()&&pe(e.labor_rate)===null;return n`<div class="fld wide" data-section="costs"><span>${S("ctCostSection")}</span>
      <span class="seg" role="radiogroup" aria-label=${S("ctCostClaim")} data-field="cost_claim">${i.map(r=>n`<button type="button" role="radio"
        aria-checked=${String(e.cost_claim===r)} aria-pressed=${String(e.cost_claim===r)} data-field=${`cost_claim:${r||"default"}`}
        @click=${()=>this.set({cost_claim:r})}>${r?S(`m_${r}`):S("ctCostClaimDefault")}</button>`)}</span></div>
      <div class="row wide"><span class="lbl">${S("ctVatExempt")}</span>
        <sw-toggle label=${S("ctVatExempt")} labelHidden .checked=${e.vat_exempt} data-field="vat_exempt" @change=${r=>this.set({vat_exempt:r.detail.checked})}></sw-toggle></div>
      ${e.vat_exempt?d:n`<div class="fld wide"><span>${S("ctVatDefault")}</span>
        <span class="seg" role="radiogroup" aria-label=${S("ctVatDefault")}>${["excluded","included"].map(r=>n`<button type="button" role="radio"
          aria-checked=${String(e.vat_default===r)} aria-pressed=${String(e.vat_default===r)} data-field=${`vat_default:${r}`}
          @click=${()=>this.set({vat_default:r})}>${r==="excluded"?S("amountsExcl"):S("amountsIncl")}</button>`)}</span></div>`}
      ${t?n`<label class="fld"><span>${S("ctRate")}</span><input class="in" inputmode="decimal" dir="ltr" maxlength="20" data-field="labor_rate"
          aria-invalid=${String(a)} .value=${e.labor_rate} @input=${r=>this.set({labor_rate:r.target.value})} /></label>
        <label class="fld"><span>${S("ctRateCurrency")}</span><select class="in" data-field="rate_currency" ?disabled=${!e.labor_rate.trim()}
          @change=${r=>this.set({rate_currency:r.target.value})}>${Me.map(r=>n`<option value=${r} ?selected=${r===e.rate_currency}>${r}</option>`)}</select></label>`:d}`}editorCard(e){const t=this.draft,i=(this.kind==="person"?this.vendorRows:this.rows??[]).filter(o=>o.kind==="vendor"&&o.id!==e?.id&&!o.erased),a=t.kind==="employee",r=this.kind?[]:ht(this.canEditStaff,this.mgr),l=(o,v,O,g,qe,Pe)=>n`
      <div class="fld"><span>${o}</span><span class="seg" role="radiogroup" aria-label=${o}>${v.map(H=>n`<button type="button" role="radio"
        aria-checked=${String(O===H)} aria-pressed=${String(O===H)} data-field=${`${Pe}:${H}`} @click=${()=>qe(H)}>${g(H)}</button>`)}</span></div>`;return n`<div class="drawer-body" data-card="contact-editor" data-contact=${e?.id??"new"} data-contact-kind=${t.kind}>
      <div class="form">
        ${this.mgr&&!e&&t.kind==="vendor"?this.lookupBlock():d}
        ${r.length?l(s("ctColKind"),r,t.kind,o=>s(`ctKind_${o}`),o=>this.set({kind:o,vendor_id:o==="person"?t.vendor_id:""}),"kind"):d}
        <label class="fld"><span>${s("ctName")} *</span><input class="in" maxlength="80" data-field="display_name" aria-invalid=${String(!!this.problem&&!t.display_name.trim())}
          .value=${t.display_name} @input=${o=>this.set({display_name:o.target.value})} /></label>
        ${a?d:n`<label class="fld"><span>${s("ctCompany")}</span><input class="in" maxlength="80" data-field="company" .value=${t.company} @input=${o=>this.set({company:o.target.value})} /></label>`}
        ${t.kind==="person"?n`<label class="fld"><span>${s("ctVendor")}</span><select class="in" data-field="vendor_id" @change=${o=>this.set({vendor_id:o.target.value})}>
          <option value="" ?selected=${!t.vendor_id}>${s("ctVendorNone")}</option>
          ${i.map(o=>n`<option value=${o.id} ?selected=${o.id===t.vendor_id}>${o.display_name}</option>`)}</select></label>`:d}
        <label class="fld"><span>${s("ctPhone")}</span><input class="in" type="tel" dir="ltr" maxlength="40" autocomplete="off" data-field="phone"
          placeholder=${e&&e.has_phone&&!e.phone_full?e.phone??"":""} .value=${t.phone} @input=${o=>this.set({phone:o.target.value})} />
          <span class="hint">${s("ctPhoneHint")}</span>
          ${e&&this.liveLinks>0&&(t.phone.trim()!==V(e).phone||t.email.trim()!==V(e).email)?n`<span class="err" role="status" data-contact-links-warning>${s("ctChangeRevokes",{n:this.liveLinks})}</span>`:d}</label>
        ${!this.mgr&&e&&this.full&&this.full.id===e.id?n`<div class="fld wide"><tickets-phone-verify data-contact-phone-verify .contactId=${e.id} ?hasPhone=${this.full.has_phone}
            ?userLinked=${this.full.user_linked} ?required=${!!this.full.phone_verify_required} ?confirmed=${!!this.full.phone_confirmed}
            .via=${this.full.phone_confirmed_via??null} .confirmToken=${this.full.phone_confirm_token??null}
            @changed=${()=>void this.loadFull(e.id)}></tickets-phone-verify></div>`:d}
        ${this.mgr?d:n`<div class="row wide"><span class="lbl">${s("otpRowSwitch")}<span class="muted">${s("otpSettingHint")}</span></span>
          <sw-toggle label=${s("otpRowSwitch")} labelHidden .checked=${t.phone_verify} data-field="phone_verify"
            @change=${o=>this.set({phone_verify:o.detail.checked})}></sw-toggle></div>`}
        <label class="fld"><span>${s("ctEmail")}</span><input class="in" type="email" dir="ltr" maxlength="254" autocomplete="off" data-field="email" .value=${t.email}
          @input=${o=>this.set({email:o.target.value})} /></label>
        ${l(s("ctChannel"),X,t.preferred_channel,o=>s(`ch_${o}`),o=>this.set({preferred_channel:o}),"channel")}
        <label class="fld"><span>${s("ctLang")}</span><select class="in" data-field="lang" @change=${o=>this.set({lang:o.target.value})}>
          ${Ee.map(o=>n`<option value=${o} ?selected=${o===t.lang}>${F[o]}</option>`)}</select></label>
        ${a||this.mgr?d:l(N("vm_kind"),["temporary","permanent"],t.permanent_vendor?"permanent":"temporary",o=>N(o==="permanent"?"vm_permanent":"vm_temporary"),o=>this.set({permanent_vendor:o==="permanent"}),"marker")}
        ${a?d:n`${l(s("ctHistory"),["default","on","off"],t.share_history,o=>s(`hist_${o}`),o=>this.set({share_history:o}),"history")}
        <div class="row wide"><span class="lbl">${s("ctRequireCode")}<span class="muted">${s("ctRequireCodeSub")}</span></span>
          <sw-toggle label=${s("ctRequireCode")} labelHidden .checked=${t.require_code} data-field="require_code" @change=${o=>this.set({require_code:o.detail.checked})}></sw-toggle></div>
        ${this.mgr?d:this.costFields(t)}`}
        ${this.mgr?e?this.attachments(e):this.mgrCreateFields(t.kind):n`<div class="fld wide"><span>${a?s("ctDepartmentsOf"):s("ctDepartments")}</span>
          <span class="chipsrow" data-field="departments">
            <button type="button" class="rc" aria-pressed=${String(!t.departments.length)} @click=${()=>this.set({departments:[]})}>${s("ctDepartmentsAll")}</button>
            ${this.departments.map(o=>n`<button type="button" class="rc" aria-pressed=${String(t.departments.includes(o.id))} data-dept=${o.id}
              @click=${()=>this.set({departments:t.departments.includes(o.id)?t.departments.filter(v=>v!==o.id):[...t.departments,o.id]})}>${u(o.name)}</button>`)}
          </span></div>
        <label class="fld wide"><span>${s("ctNotes")}</span><textarea class="in" maxlength="1000" data-field="notes" .value=${t.notes}
          @input=${o=>this.set({notes:o.target.value})}></textarea></label>`}
        ${e?n`<div class="row wide"><span class="lbl">${s("ctActive")}</span>
          <sw-toggle label=${s("ctActive")} labelHidden .checked=${t.active} data-field="active" @change=${o=>this.set({active:o.detail.checked})}></sw-toggle></div>`:d}
      </div>
      ${this.problem?n`<div class="err" role="alert" data-contact-problem>${this.problem}</div>`:d}
      <div class="foot">
        <sw-button variant="primary" size="sm" data-contact-save ?disabled=${this.busy} @click=${()=>void this.save(e)}>${s("ctSave")}</sw-button>
        <sw-button size="sm" variant="ghost" data-contact-cancel ?disabled=${this.busy} @click=${()=>{this.selected="",this.creating=!1,this.draft=null}}>${s("ctCancel")}</sw-button>
        ${e?n`<span class="grow"></span>
          ${this.mgr?d:n`<sw-button size="sm" variant="ghost" data-contact-export ?disabled=${this.busy} @click=${()=>void this.exportData(e)}>${s("ctExport")}</sw-button>`}
          <sw-button size="sm" variant="ghost" data-contact-erase ?disabled=${this.busy||this.erasing} @click=${()=>this.erasing=!0}>${s("ctErase")}</sw-button>`:d}
      </div>
      ${e&&e.kind==="person"?n`<access-identity-card compact data-contact-identity contact-id=${e.id} name=${e.display_name}></access-identity-card>`:d}
      ${e&&this.erasing?n`<div class="danger" role="group" data-contact-erase-confirm>
        <span>${s("ctEraseConfirm",{name:e.display_name})}</span>
        ${this.mgr?d:n`<label class="chk"><input type="checkbox" .checked=${this.eraseHistory} @change=${o=>this.eraseHistory=o.target.checked} />${s("ctEraseHistory")}</label>`}
        <span class="chipsrow"><sw-button size="sm" variant="danger" data-contact-erase-ok ?disabled=${this.busy} @click=${()=>void this.erase(e)}>${s("ctErase")}</sw-button>
          <sw-button size="sm" variant="ghost" @click=${()=>this.erasing=!1}>${s("ctCancel")}</sw-button></span>
      </div>`:d}
    </div>`}render(){if(this.denied)return n`<sw-state-panel icon="users" state="empty" heading=${s("ctNoPermission")} data-contacts-denied></sw-state-panel>`;const e=(this.rows??[]).find(o=>o.id===this.selected)??null,t=this.creating&&!!this.draft,i=t?null:e,a=this.kind?s(`ctNew_${this.kind}`):s("ctFormNew"),r=t?a:i?i.display_name:"",l=t?this.editorCard(null):i?this.draft?this.editorCard(i):this.readOnlyBody(i):d;return n`<div data-contacts>
      ${this.listCard()}
      <sw-drawer modal .open=${t||!!i} heading=${u(r)} subheading=${i&&!this.kind?s(`ctKind_${i.kind}`):""} data-contact-drawer
        @close=${()=>{this.selected="",this.creating=!1,this.draft=null}}>${l}</sw-drawer>
    </div>`}};p.styles=[W,...re,_e,Ce,le,A`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .drawer-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 14px;
    }
    .drawer-body .foot {
      margin-block-start: 6px;
    }
    .hcard .fchips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-inline-size: 0;
    }
    .form {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 12px;
      inline-size: 100%;
    }
    .form .wide {
      grid-column: 1 / -1;
    }
    .form .fld > .seg {
      align-self: flex-start;
      max-inline-size: 100%;
      flex-wrap: wrap; /* the four cost-claim choices (slice 9b) wrap on a 320 px phone instead of leaving the card (2.5.0 gate) */
    }
    .form .seg button {
      white-space: nowrap;
    }
    .fld .in,
    .fld select.in {
      inline-size: 100%;
    }
    .fld > span {
      font-weight: var(--sw-fw-medium);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .ro {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 6px 14px;
      font-size: var(--sw-fs-sm);
    }
    .ro dt {
      color: var(--sw-text-3);
    }
    .ro dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .danger {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      font-size: var(--sw-fs-sm);
    }
    .form .in,
    .form select.in,
    .form textarea.in {
      min-block-size: 44px;
      border-radius: var(--dv-radius-control);
      border-color: var(--dv-border);
      background: var(--dv-surface-2);
    }
    .form textarea.in {
      border-radius: var(--dv-radius-sm);
    }
    .chk {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    [data-vendor-lookup] .chipsrow .in {
      flex: 1 1 12em;
      inline-size: auto;
      min-inline-size: 0;
    }
  `,W];h([m()],p.prototype,"kind",2);h([m()],p.prototype,"dept",2);h([m()],p.prototype,"query",2);h([m({type:Boolean})],p.prototype,"head",2);h([m({type:Boolean})],p.prototype,"newbtn",2);h([m({attribute:!1})],p.prototype,"loads",2);h([m({attribute:!1})],p.prototype,"handledLabel",2);h([m({attribute:!1})],p.prototype,"managed",2);h([c()],p.prototype,"rows",2);h([c()],p.prototype,"vendorRows",2);h([c()],p.prototype,"canEdit",2);h([c()],p.prototype,"canEditStaff",2);h([c()],p.prototype,"filter",2);h([c()],p.prototype,"marker",2);h([c()],p.prototype,"selected",2);h([c()],p.prototype,"creating",2);h([c()],p.prototype,"draft",2);h([c()],p.prototype,"departments",2);h([c()],p.prototype,"busy",2);h([c()],p.prototype,"erasing",2);h([c()],p.prototype,"eraseHistory",2);h([c()],p.prototype,"problem",2);h([c()],p.prototype,"liveLinks",2);h([c()],p.prototype,"full",2);h([c()],p.prototype,"denied",2);h([c()],p.prototype,"mine",2);h([c()],p.prototype,"mgrDept",2);h([c()],p.prototype,"mgrShared",2);h([c()],p.prototype,"lkPhone",2);h([c()],p.prototype,"lkMatches",2);p=h([j("tickets-contacts")],p);var ft=Object.defineProperty,bt=Object.getOwnPropertyDescriptor,k=(e,t,i,a)=>{for(var r=a>1?void 0:a?bt(t,i):t,l=e.length-1,o;l>=0;l--)(o=e[l])&&(r=(a?o(t,i,r):o(r))||r);return a&&r&&ft(t,i,r),r};const ye=["he","ar","ru","en"],vt=e=>e.trim().split(/\s+/).slice(0,2).map(t=>t[0]??"").join("");function U(e){return{id:e.id,name:e.name,active:e.active,can_edit_members:e.can_manage,members:e.members.map(t=>({kind:t.kind,id:t.id,name:t.name,role:t.role,notify_new:!1,added_at:"",mobile:t.mobile??null,mobile_confirmed:t.mobile_confirmed,notify_whatsapp:t.notify_whatsapp,lang:t.lang,mobile_full:t.mobile_full,mobile_editable:t.mobile_editable}))}}let f=class extends I{constructor(){super(...arguments),this.bubbleSkin=new oe(this),this.dept="",this.query="",this.loads=null,this.handledLabel=null,this.managed=[],this.adding=!1,this.depts=null,this.directory=null,this.addDept="",this.pick="",this.newRole="member",this.busy=!1,this.denied=!1,this.open=new Set,this.drafts={},this.manager=!1,this.live=new Se(()=>{!this.busy&&!this.hidden&&this.load()})}connectedCallback(){super.connectedCallback(),de(this),this.live.start(),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.live.stop()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){try{if(this.manager){await this.loadManager();return}const e=await q().departments();this.depts=e.departments.filter(t=>t.active),this.depts.some(t=>t.id===this.addDept)||(this.addDept=this.depts.find(t=>t.can_edit_members)?.id??this.depts[0]?.id??""),this.directory||(this.directory=await q().directory())}catch(e){if(e instanceof R&&(e.status===403||e.status===404)&&!this.manager){this.manager=!0;try{await this.loadManager()}catch{this.denied=!0,this.hidden=!0}}else e instanceof R&&(e.status===403||e.status===404)?(this.denied=!0,this.hidden=!0):(this.depts=[],this.notice({error:y(e)}))}}async loadManager(){const e=await P().overview();this.depts=e.departments.filter(t=>t.active).map(U),this.depts.some(t=>t.id===this.addDept)||(this.addDept=this.depts.find(t=>t.can_edit_members)?.id??""),!this.directory&&e.can_manage&&(this.directory={users:(await P().people()).users,groups:[]})}async act(e,t){if(!this.busy){this.busy=!0;try{const i=await e();this.depts=(this.depts??[]).map(a=>a.id===i.id?i:a),t?.(),this.notice({ok:s("setSaved")}),this.load()}catch(i){this.notice({error:y(i)}),i instanceof R&&i.status===409&&await this.load()}finally{this.busy=!1}}}draftOf(e){return this.drafts[e.id]??{phone:e.mobile??"",lang:e.lang??"he"}}setDraft(e,t){this.drafts={...this.drafts,[e.id]:{...this.draftOf(e),...t}}}async saveStaff(e,t){if(!this.busy){this.busy=!0;try{await q().putStaffMobile(e.id,t);const{[e.id]:i,...a}=this.drafts;this.drafts=a,this.notice({ok:s("setSaved")}),await this.load()}catch(i){this.notice({error:y(i)})}finally{this.busy=!1}}}mobileOf(e){const t=this.draftOf(e),i=t.phone.trim()!==(e.mobile??"")||t.lang!==(e.lang??"he");return n`<div class="line" data-member-mobile=${e.id}>
      <span class="lbl">${s("hdMobile")}</span>
      <input class="in tel" type="tel" dir="ltr" inputmode="tel" autocomplete="off" maxlength="40" aria-label=${`${s("hdMobile")} · ${e.name}`}
        placeholder=${s("hdMobile")} .value=${t.phone} ?disabled=${this.busy} data-member-mobile-input
        @input=${a=>this.setDraft(e,{phone:a.target.value})}>
      <select class="in" aria-label=${s("hdMobileLang")} ?disabled=${this.busy} data-member-mobile-lang
        @change=${a=>this.setDraft(e,{lang:a.target.value})}>
        ${ye.map(a=>n`<option value=${a} ?selected=${t.lang===a}>${s(`lang_${a}`)}</option>`)}
      </select>
      <sw-button size="sm" ?disabled=${this.busy||!i} data-member-mobile-save
        @click=${()=>void this.saveStaff(e,{phone:t.phone.trim()||null,lang:t.lang})}>${s("hdMobileSave")}</sw-button>
      ${e.mobile&&e.mobile_confirmed===!1?n`<span class="chip warn" data-member-mobile-pending>${s("hdMobilePending")}</span>`:d}
      ${e.mobile?n`<sw-toggle label=${s("hdMobileWhatsapp")} .checked=${e.notify_whatsapp!==!1} ?disabled=${this.busy||e.notify_whatsapp===!1} data-member-whatsapp
        @change=${a=>void this.saveStaff(e,{notify_whatsapp:a.detail.checked})}></sw-toggle>`:d}
    </div>
    ${e.mobile?n`<div class="line" data-member-phone-verify=${e.id}>
      <sw-toggle label=${s("otpRowSwitch")} .checked=${!!e.phone_verify} ?disabled=${this.busy} data-member-phone-verify-switch
        @change=${a=>void this.saveStaff(e,{phone_verify:a.detail.checked})}></sw-toggle>
      <tickets-phone-verify .contactId=${e.contact_id??null} hasPhone userLinked ?required=${!!e.verify_required} ?confirmed=${!!e.mobile_confirmed}
        .confirmToken=${e.mobile_confirm??null} @changed=${()=>void this.load()}></tickets-phone-verify>
    </div>`:d}`}add(){const e=(this.depts??[]).find(l=>l.id===this.addDept),[t,...i]=this.pick.split(":");if(!e||!this.pick)return;const a=i.join(":"),r=this.manager?async()=>U(await P().addMember(e.id,a)):()=>q().putMember(e.id,t,a,this.newRole);this.act(r,()=>{this.pick="",this.dispatchEvent(new CustomEvent("add-done",{bubbles:!0,composed:!0}))})}toggle(e){const t=new Set(this.open);t.delete(e)||t.add(e),this.open=t}statsOf(e){if(e.kind!=="user"||!this.loads||!ze(this.managed,e.ms.map(i=>i.d.id)))return d;const t=this.loads.get(`user:${e.id}`)??{open:0,waiting:0,stuck:0};return n`<div class="stats" data-member-stats>
      <div><b data-stat="open">${t.open}</b>${s("u6Open")}</div>
      <div><b class=${t.waiting?"warn":""} data-stat="waiting">${t.waiting}</b>${s("u6WaitingHim")}</div>
      <div><b class=${t.stuck?"bad":""} data-stat="stuck">${t.stuck}</b>${s("u6Stuck")}</div>
      ${this.handledLabel===null?d:n`<div data-stat-cell="handled"><b data-stat="handled">${t.handled??0}</b>${s("u6Handled")}<small data-stat-period>${this.handledLabel}</small></div>`}
    </div>`}membership(e,t,i){if(this.manager)return this.managerMembership(e,t,i);const a=e.can_edit_members;return n`<div class="line" data-member-membership=${e.id}>
      <span class="lbl">${i?u(e.name):s("u6MemberRole")}</span>
      <span class="seg" role="radiogroup" aria-label=${`${t.name} · ${e.name}`}>${["manager","member"].map(r=>n`<button type="button" role="radio" aria-pressed=${String(t.role===r)}
        aria-checked=${String(t.role===r)} ?disabled=${this.busy||!a||t.role===r} data-member-role=${r}
        @click=${()=>void this.act(()=>q().putMember(e.id,t.kind,t.id,r))}>${r==="manager"?s("hdRole_manager"):s("hdRole_member")}</button>`)}</span>
      ${t.role==="manager"&&a?n`<sw-toggle label=${s("depNotifyNew")} .checked=${t.notify_new} ?disabled=${this.busy} data-member-notify
        @change=${r=>void this.act(()=>q().putMember(e.id,t.kind,t.id,t.role,r.detail.checked))}></sw-toggle>`:d}
      ${a?n`<button type="button" class="rm" data-member-remove ?disabled=${this.busy} @click=${()=>void this.act(()=>q().deleteMember(e.id,t.kind,t.id))}>${s("depRemove")}</button>`:d}
    </div>`}managerMembership(e,t,i){return n`<div class="line" data-member-membership=${e.id}>
      <span class="lbl">${i?u(e.name):s("u6MemberRole")}</span>
      <span class="chip" data-member-role-text>${t.role==="manager"?s("hdRole_manager"):s("hdRole_member")}</span>
      ${t.role==="manager"?n`<span class="mut" data-member-manager-fixed>${s("dmManagerFixed")}</span>`:d}
      ${lt(t,e.can_edit_members)?n`<button type="button" class="rm" data-member-remove ?disabled=${this.busy}
        @click=${()=>void this.act(async()=>U(await P().removeMember(e.id,t.id)))}>${s("dmMemberRemove")}</button>`:d}
    </div>`}async saveManagerMobile(e,t,i){await this.act(async()=>U(await P().memberMobile(e.id,t.id,i)),()=>{const{[t.id]:a,...r}=this.drafts;this.drafts=r})}managerMobile(e,t){const i=e;if(t&&$e({kind:e.kind,role:e.role,mobile_editable:i.mobile_editable})){const a=this.drafts[e.id]??{phone:i.mobile_full?e.mobile??"":"",lang:e.lang??"he"},r=a.phone.trim()!==(i.mobile_full?e.mobile??"":"")||a.lang!==(e.lang??"he");return n`<div class="line" data-member-mobile=${e.id} data-member-mobile-editable>
        <span class="lbl">${s("hdMobile")}</span>
        <input class="in tel" type="tel" dir="ltr" inputmode="tel" autocomplete="off" maxlength="40" aria-label=${`${s("hdMobile")} · ${e.name}`}
          placeholder=${e.mobile??s("hdMobile")} .value=${a.phone} ?disabled=${this.busy} data-member-mobile-input
          @input=${l=>this.drafts={...this.drafts,[e.id]:{...a,phone:l.target.value}}}>
        <select class="in" aria-label=${s("hdMobileLang")} ?disabled=${this.busy} data-member-mobile-lang
          @change=${l=>this.drafts={...this.drafts,[e.id]:{...a,lang:l.target.value}}}>
          ${ye.map(l=>n`<option value=${l} ?selected=${a.lang===l}>${s(`lang_${l}`)}</option>`)}
        </select>
        <sw-button size="sm" ?disabled=${this.busy||!r} data-member-mobile-save
          @click=${()=>void this.saveManagerMobile(t,e,{...a.phone.trim()!==(i.mobile_full?e.mobile??"":"")?{phone:a.phone.trim()||null}:{},lang:a.lang})}>${s("hdMobileSave")}</sw-button>
        ${e.mobile&&!i.mobile_full?n`<span class="chip xs" data-member-mobile-masked>${s("dmMasked")}</span>`:d}
        ${e.mobile&&e.mobile_confirmed===!1?n`<span class="chip warn" data-member-mobile-pending>${s("hdMobilePending")}</span>`:d}
      </div>`}return e.mobile?n`<div class="line" data-member-mobile=${e.id}><span class="lbl">${s("hdMobile")}</span>
      <span dir="ltr" data-member-mobile-text>${e.mobile}</span>${e.mobile.startsWith("••")?n`<span class="chip xs" data-member-mobile-masked>${s("dmMasked")}</span>`:d}</div>`:d}card(e){const t=this.open.has(e.key),i=e.kind==="group",a=e.ms[0].m,r=e.ms.some(v=>v.m.role==="manager"),l=!i&&!!a.mobile&&a.mobile_confirmed===!1,o=this.manager&&!i?e.ms.find(v=>$e(v.m)):void 0;return n`<article class=${`glass hcard ${t?"open":""}`} data-member=${e.key}>
      <header>
        <span class=${`tile ${i?"grp":"int"}`} aria-hidden="true">${i?w("users"):vt(e.name)}</span>
        <div class="t"><h3>${u(e.name)}</h3>
          <div class="role">${i?s("u6Group"):s("hdRole_member")}${r?n`<span class="chip xs info" data-member-manager-chip>${s("u6Manager")}</span>`:d}</div></div>
        <button type="button" class="rb sm" data-member-toggle aria-expanded=${String(t)} aria-label=${`${t?s("u6CloseManage"):s("u6Manage")} · ${e.name}`} title=${t?s("u6CloseManage"):s("u6Manage")}
          @click=${()=>this.toggle(e.key)}>${t?w("x"):w("dots")}</button>
      </header>
      ${this.statsOf(e)}
      <footer>
        ${e.ms.map(v=>n`<span class="chip">${u(v.d.name)}</span>`)}
        ${!i&&a.mobile&&a.notify_whatsapp!==!1?n`<span class="chip wa" data-member-wa>${w("send")}${s("ch_whatsapp")}</span>`:d}
        ${l?n`<span class="chip warn" data-member-pending-chip>${s("hdMobilePending")}</span>`:d}
      </footer>
      ${t?n`<div class="manage" data-member-panel>
        ${e.ms.map(v=>this.membership(v.d,v.m,e.ms.length>1))}
        ${i?d:this.manager?this.managerMobile(o?.m??a,o?.d):this.mobileOf(a)}
      </div>`:d}
    </article>`}addPanel(){const e=(this.depts??[]).filter(a=>a.can_edit_members),t=e.find(a=>a.id===this.addDept)??e[0];if(!t)return d;const i=[...(this.directory?.users??[]).filter(a=>!t.members.some(r=>r.kind==="user"&&r.id===a.id)).map(a=>({v:`user:${a.id}`,label:a.name})),...(this.directory?.groups??[]).filter(a=>!t.members.some(r=>r.kind==="group"&&r.id===a.id)).map(a=>({v:`group:${a.id}`,label:`${a.name} (${s("depGroupTag")})`}))];return n`<div class="glass addp" data-members-add role="group" aria-label=${s("u6AddMember")}>
      ${e.length>1?n`<select class="in" data-member-dept-pick aria-label=${s("hdDepartment")} @change=${a=>{this.addDept=a.target.value,this.pick=""}}>
        ${e.map(a=>n`<option value=${a.id} ?selected=${a.id===t.id}>${u(a.name)}</option>`)}</select>`:d}
      <select class="in" data-member-pick aria-label=${s("hdMemberPick")} @change=${a=>this.pick=a.target.value}>
        <option value="" ?selected=${!this.pick}>${s("hdMemberPick")}</option>
        ${i.map(a=>n`<option value=${a.v} ?selected=${this.pick===a.v}>${a.label}</option>`)}
      </select>
      ${this.manager?d:n`<select class="in" data-member-new-role aria-label=${s("depMembers")} @change=${a=>this.newRole=a.target.value}>
        <option value="member" ?selected=${this.newRole==="member"}>${s("hdRole_member")}</option>
        <option value="manager" ?selected=${this.newRole==="manager"}>${s("hdRole_manager")}</option>
      </select>`}
      <button type="button" class="btn primary" data-member-add ?disabled=${this.busy||!this.pick} @click=${()=>this.add()}>${w("plus")}${s("depMemberAdd")}</button>
    </div>`}people(){const e=this.query.trim().toLowerCase(),t=new Map;for(const i of(this.depts??[]).filter(a=>!this.dept||a.id===this.dept))for(const a of i.members){if(e&&!a.name.toLowerCase().includes(e))continue;const r=`${a.kind}:${a.id}`,l=t.get(r)??{key:r,kind:a.kind,id:a.id,name:a.name,ms:[]};l.ms.push({d:i,m:a}),t.set(r,l)}return[...t.values()]}render(){if(this.denied)return d;if(this.depts===null)return n`<div class="sec"><div class="glass" style="padding:18px"><span class="skl" style="block-size:20px;inline-size:40%"></span></div></div>`;const e=this.people(),t=this.query.trim()?s("u6NoMatch"):s("hdMembersEmpty");return n`<div class="sec" data-card="handlers-members" data-handlers-members>
      <div class="sh"><h2>${s("u6SecMembers")}<span class="n">${e.length}</span></h2><small>${s("u6SecMembersSub")}</small></div>
      ${this.adding?this.addPanel():d}
      ${this.depts.length?e.length?n`<div class="cgrid" data-members-grid>${ne(e,i=>i.key,i=>this.card(i))}</div>`:n`<span class="mut" data-members-empty>${t}</span>`:n`<sw-state-panel icon="users" state="empty" heading=${s("hdNoDepartments")}></sw-state-panel>
          <div class="foot"><a href="#/system/tickets?tab=departments" data-to-departments>${s("setTabDepartments")}</a></div>`}
    </div>`}};f.styles=[W,...re,_e,Ce,le,A`
    :host {
      display: block;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .dsec {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .dsec > h3 {
      margin: 0;
      padding-inline: 4px;
      font-size: var(--sw-fs-md);
      font-weight: 700;
      color: var(--dv-text-2);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hcard.open {
      grid-column: 1 / -1;
    }
    .manage .in,
    .addp .in {
      min-block-size: 44px;
      border-radius: var(--dv-radius-control);
      border-color: var(--dv-border);
      background: var(--dv-surface-2);
    }
    .manage .tel {
      inline-size: 14em;
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .manage .seg button {
      min-block-size: 36px;
    }
    .manage .seg button[disabled] {
      cursor: default;
    }
    .rb.sm {
      inline-size: 40px;
      block-size: 40px;
    }
  `];k([m()],f.prototype,"dept",2);k([m()],f.prototype,"query",2);k([m({attribute:!1})],f.prototype,"loads",2);k([m({attribute:!1})],f.prototype,"handledLabel",2);k([m({attribute:!1})],f.prototype,"managed",2);k([m({type:Boolean})],f.prototype,"adding",2);k([c()],f.prototype,"depts",2);k([c()],f.prototype,"directory",2);k([c()],f.prototype,"addDept",2);k([c()],f.prototype,"pick",2);k([c()],f.prototype,"newRole",2);k([c()],f.prototype,"busy",2);k([c()],f.prototype,"denied",2);k([c()],f.prototype,"open",2);k([c()],f.prototype,"drafts",2);k([c()],f.prototype,"manager",2);f=k([j("tickets-handlers-members")],f);const ae="tickets/portal-requests",ke=encodeURIComponent,ie={list:()=>J()?G(`${ae}?state=pending`):Promise.resolve({requests:[],enabled:!1}),approve:e=>T(`${ae}/${ke(e.id)}/approve`,{revision:e.revision}),reject:e=>T(`${ae}/${ke(e.id)}/reject`,{revision:e.revision})};function gt(e){const t=new Map;for(const i of e){let a=t.get(i.vendor.id);a||t.set(i.vendor.id,a={vendor:i.vendor,requests:[]}),a.requests.push(i)}return[...t.values()].sort((i,a)=>i.vendor.name.localeCompare(a.vendor.name))}var $t=Object.defineProperty,wt=Object.getOwnPropertyDescriptor,ce=(e,t,i,a)=>{for(var r=a>1?void 0:a?wt(t,i):t,l=e.length-1,o;l>=0;l--)(o=e[l])&&(r=(a?o(t,i,r):o(r))||r);return a&&r&&$t(t,i,r),r};let B=class extends I{constructor(){super(...arguments),this.requests=[],this.busy=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.requests=(await ie.list()).requests}catch{this.requests=[]}}async decide(e,t){if(!this.busy){this.busy=e.id;try{t?await ie.approve(e):await ie.reject(e),this.dispatchEvent(new CustomEvent("notice",{detail:{ok:s(t?"ptrApproved":"ptrRejected")},bubbles:!0,composed:!0}))}catch(i){this.dispatchEvent(new CustomEvent("notice",{detail:{error:y(i)},bubbles:!0,composed:!0}))}finally{this.busy="",await this.load()}}}render(){return this.requests.length?n`<sw-card heading=${s("ptrTitle")} data-portal-requests>
      ${gt(this.requests).map(e=>n`<section data-portal-vendor=${e.vendor.id}>
        <h3 class="vendor" dir="auto">${e.vendor.name} (${e.requests.length})</h3>
        ${e.requests.map(t=>n`<div class="req" data-portal-request=${t.id}>
        <div class="who"><div dir="auto">${t.display_name} <bdi dir="ltr">${t.phone??""}</bdi></div>
          <div class="sub" dir="auto">${t.action==="add"?s("ptrAdd"):s("ptrReplace",{name:t.replaces?.name??""})}</div>
          ${t.phone_known?n`<div class="tag" data-portal-request-known>${s("ptrKnown")}</div>`:d}</div>
        <sw-button size="sm" variant="primary" data-portal-request-approve ?disabled=${!!this.busy} @click=${()=>void this.decide(t,!0)}>${s("ptrApprove")}</sw-button>
        <sw-button size="sm" data-portal-request-reject ?disabled=${!!this.busy} @click=${()=>void this.decide(t,!1)}>${s("ptrReject")}</sw-button>
      </div>`)}</section>`)}
    </sw-card>`:d}};B.styles=A`
    :host {
      display: block;
    }
    .req {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding-block: 8px;
      border-block-end: 1px solid var(--sw-border);
    }
    .req:last-child {
      border-block-end: 0;
    }
    .who {
      flex: 1 1 220px;
      min-inline-size: 0;
    }
    .vendor {
      margin-block: 8px 0;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
    }
    .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tag {
      font-size: var(--sw-fs-xs);
      color: var(--sw-warning-text);
    }
  `;ce([c()],B.prototype,"requests",2);ce([c()],B.prototype,"busy",2);B=ce([j("tickets-portal-requests")],B);const xe=encodeURIComponent,yt={pending_days:30,idle_months:12,pending:[],idle:[],at:""},K={report:()=>J()?G("tickets/contacts-review"):Promise.resolve(yt),reject:e=>T(`access-grants/pending-contacts/${xe(e)}/reject`),erase:e=>T(`tickets/contacts-review/${xe(e)}/delete`,{confirm:!0})};var kt=Object.defineProperty,xt=Object.getOwnPropertyDescriptor,D=(e,t,i,a)=>{for(var r=a>1?void 0:a?xt(t,i):t,l=e.length-1,o;l>=0;l--)(o=e[l])&&(r=(a?o(t,i,r):o(r))||r);return a&&r&&kt(t,i,r),r};let L=class extends I{constructor(){super(...arguments),this.report=null,this.failed="",this.confirming=null,this.busy=!1,this.dialogError="",this.limits=null,this.draftPending="",this.draftIdle="",this.savingLimits=!1}connectedCallback(){super.connectedCallback(),this.load(),this.loadLimits()}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}async load(){try{this.report=await K.report(),this.failed="",this.emit("review-count",{n:this.report.pending.length+this.report.idle.length})}catch(e){this.failed=y(e)}}async loadLimits(){try{const e=await q().settings(),t=e.directory;if(!t||typeof t.review_pending_days!="number"||typeof t.review_idle_months!="number")return;this.limits={revision:e.revision,pending:t.review_pending_days,idle:t.review_idle_months},this.draftPending=String(t.review_pending_days),this.draftIdle=String(t.review_idle_months)}catch{this.limits=null}}date(e){const t=new Date(e);return Number.isNaN(t.getTime())?"":new Intl.DateTimeFormat(Re()==="en"?"en-GB":"he-IL",{day:"numeric",month:"short",year:"numeric"}).format(t)}open(e){this.dialogError="",this.confirming=e}close(){this.busy||(this.confirming=null,this.dialogError="")}async go(){const e=this.confirming;if(!(!e||this.busy)){this.busy=!0,this.dialogError="";try{if(e.action==="reject")await K.reject(e.contact_id),this.emit("notice",{ok:s("nrRejected")});else{const t=await K.erase(e.contact_id);this.emit("notice",{ok:t.door_system_linked?s("nrDeletedDoor"):s("nrDeleted")})}this.busy=!1,this.confirming=null,await this.load()}catch(t){this.dialogError=y(t),this.busy=!1}}}async saveLimits(){const e=this.limits;if(!e||this.savingLimits)return;const t=Number(this.draftPending),i=Number(this.draftIdle);this.savingLimits=!0;try{const a=await q().saveInstallation(e.revision,{directory:{review_pending_days:t,review_idle_months:i}}),r=a.directory;this.limits={revision:a.revision,pending:r?.review_pending_days??t,idle:r?.review_idle_months??i},this.emit("notice",{ok:s("nrSaved")}),await this.load()}catch(a){this.emit("notice",{error:y(a)}),await this.loadLimits()}finally{this.savingLimits=!1}}rowView(e){const t=e.section==="pending"?s("nrDays",{n:e.days??0}):s("nrMonths",{n:e.months??0}),i=e.section==="pending"?s("nrSince",{date:this.date(e.since)}):s("nrLast",{date:this.date(e.since)});return n`<div class="row" data-review-row=${e.contact_id} data-review-section=${e.section}>
      <div class="who">
        <div class="name" dir="auto">${e.name}${e.door_system_linked?n`<span class="tag" data-review-door>${s("nrDoorTag")}</span>`:d}</div>
        <div class="sub" dir="auto">${e.vendor?n`<bdi>${e.vendor}</bdi> · `:d}${e.phone?n`<bdi dir="ltr">${e.phone}</bdi> · `:d}${i}</div>
      </div>
      <span class="age" data-review-age>${t}</span>
      <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-review-action=${e.action} @click=${()=>this.open(e)}>
        ${e.action==="reject"?s("nrReject"):s("nrDelete")}</sw-button>
    </div>`}section(e,t,i){return n`<sw-card heading=${e} data-review-list=${i}>
      ${t.length?t.map(a=>this.rowView(a)):n`<div class="empty" data-review-empty>${s("nrEmpty")}</div>`}
    </sw-card>`}dialog(){const e=this.confirming;if(!e)return d;const t=e.action==="reject";return n`<sw-dialog open ?locked=${this.busy} heading=${t?s("nrRejectTitle",{name:e.name}):s("nrDeleteTitle",{name:e.name})}
      data-review-dialog=${e.action} @close=${()=>this.close()}>
      <div class="dlg">
        <div>${t?s("nrRejectBody"):s("nrDeleteBody")}</div>
        ${e.door_system_linked?n`<div class="note" role="note" data-review-door-note>${s("nrDoorNote")}</div>`:d}
        ${this.dialogError?n`<div class="msg err" role="alert" data-review-dialog-error>${this.dialogError}</div>`:d}
      </div>
      <div slot="footer" class="foot">
        <sw-button size="sm" ?disabled=${this.busy} data-review-cancel @click=${()=>this.close()}>${s("nrCancel")}</sw-button>
        <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-review-confirm @click=${()=>void this.go()}>
          ${t?s("nrConfirmReject"):s("nrConfirmDelete")}</sw-button>
      </div>
    </sw-dialog>`}limitsCard(){const e=this.limits;if(!e)return d;const t=Number(this.draftPending),i=Number(this.draftIdle),a=Number.isInteger(t)&&t>=7&&t<=365&&Number.isInteger(i)&&i>=1&&i<=60,r=t!==e.pending||i!==e.idle;return n`<sw-card heading=${s("nrThresholds")} data-review-limits>
      <div class="limits">
        <label>${s("nrPendingDays")}<input type="number" inputmode="numeric" min="7" max="365" data-review-pending-days aria-invalid=${String(!a)}
          .value=${this.draftPending} @input=${l=>this.draftPending=l.target.value} /></label>
        <label>${s("nrIdleMonths")}<input type="number" inputmode="numeric" min="1" max="60" data-review-idle-months aria-invalid=${String(!a)}
          .value=${this.draftIdle} @input=${l=>this.draftIdle=l.target.value} /></label>
        <sw-button size="sm" ?disabled=${!a||!r||this.savingLimits} data-review-limits-save @click=${()=>void this.saveLimits()}>${s("nrSave")}</sw-button>
      </div>
    </sw-card>`}render(){if(this.failed&&!this.report)return n`<div class="msg err" role="alert" data-review-failed>${s("nrLoadFailed")}: ${this.failed}</div>`;const e=this.report;return e?n`<div data-needs-review style="display:contents">
      ${this.section(s("nrPendingTitle",{n:e.pending_days}),e.pending,"pending")}
      ${this.section(s("nrIdleTitle",{n:e.idle_months}),e.idle,"idle")}
      ${this.limitsCard()}
      ${this.dialog()}
    </div>`:d}};L.styles=A`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-inline-size: 0;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding-block: 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .who {
      flex: 1 1 220px;
      min-inline-size: 0;
    }
    .name {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      overflow-wrap: anywhere;
    }
    .age {
      font-variant-numeric: tabular-nums;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .tag {
      display: inline-block;
      font-size: var(--sw-fs-xs);
      padding: 1px 8px;
      border-radius: 999px;
      border: 1px solid var(--sw-border);
      color: var(--sw-text-2);
      margin-inline-start: 6px;
    }
    .empty {
      color: var(--sw-text-3);
      padding-block: 6px;
    }
    .msg.err {
      color: var(--sw-danger-text);
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .note {
      font-size: var(--sw-fs-sm);
      padding: 8px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-bg, var(--sw-surface-2));
      color: var(--sw-warning-text);
    }
    .foot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .limits {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 12px;
    }
    .limits label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .limits input {
      inline-size: 96px;
      block-size: 34px;
      box-sizing: border-box;
      padding-inline: 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 767px) {
      .row sw-button {
        flex: 1 1 100%;
      }
    }
  `;D([c()],L.prototype,"report",2);D([c()],L.prototype,"failed",2);D([c()],L.prototype,"confirming",2);D([c()],L.prototype,"busy",2);D([c()],L.prototype,"dialogError",2);D([c()],L.prototype,"limits",2);D([c()],L.prototype,"draftPending",2);D([c()],L.prototype,"draftIdle",2);D([c()],L.prototype,"savingLimits",2);L=D([j("tickets-needs-review")],L);var _t=Object.defineProperty,St=Object.getOwnPropertyDescriptor,x=(e,t,i,a)=>{for(var r=a>1?void 0:a?St(t,i):t,l=e.length-1,o;l>=0;l--)(o=e[l])&&(r=(a?o(t,i,r):o(r))||r);return a&&r&&_t(t,i,r),r};let b=class extends I{constructor(){super(...arguments),this.bubbleSkin=new oe(this),this.embedded=!1,this.seg="handlers",this.readiness=null,this.meta=null,this.dept="",this.q="",this.counts={},this.loads=null,this.period=Ue(),this.installDefault=ue,this.handled=null,this.handledSeq=0,this.adding=!1,this.ok="",this.error="",this.filterOpen=!1,this.panelCtl=new Xe(this,()=>this.filterOpen,e=>this.filterOpen=e),this.phone=window.matchMedia("(max-width: 767px)").matches,this.okTimer=0,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.onPhone=()=>this.phone=this.phoneMq.matches,this.offNames=null,this.onHash=()=>{!this.embedded&&window.location.hash.startsWith("#/tickets/handlers")&&this.readSeg()},this.onReviewCount=e=>{this.counts={...this.counts,review:e.detail.n}},this.onPeriod=e=>{const t=se(e.target.value);t&&(this.period=t,Ke(t),this.loadHandled())},this.onNotice=e=>{window.clearTimeout(this.okTimer),e.detail.error?(this.ok="",this.error=e.detail.error):e.detail.ok&&(this.error="",this.ok=e.detail.ok,this.okTimer=window.setTimeout(()=>this.ok="",3e3),this.loadCounts(),this.loadLoads())},this.onAddDone=()=>{this.adding=!1},this.onSegKey=e=>{const t=this.segments(),i=t.indexOf(this.seg),a=Qe(e.key,i,t.length,getComputedStyle(this).direction==="rtl");a!==null&&(e.preventDefault(),this.setSeg(t[a]),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-handlers-tabs] [data-seg="${this.seg}"]`)?.focus()))}}connectedCallback(){super.connectedCallback(),de(this),this.embedded||this.readSeg(),window.addEventListener("hashchange",this.onHash),this.phoneMq.addEventListener("change",this.onPhone),this.offNames=Te(()=>this.requestUpdate()),E().readiness().then(e=>this.readiness=e).catch(()=>{}),q().meta().then(e=>{this.meta=e,this.loadLoads(),this.loadReviewCount()}).catch(()=>{}),this.loadCounts()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),this.phoneMq.removeEventListener("change",this.onPhone),window.clearTimeout(this.okTimer),this.offNames?.()}willUpdate(e){e.has("meta")&&this.dept&&!this.meta?.departments.some(t=>t.id===this.dept)&&(this.dept=""),e.has("meta")&&this.meta&&this.seg==="review"&&!this.meta.can.configure&&(this.seg="handlers")}readSeg(){const e=new URLSearchParams(window.location.hash.split("?")[1]??"").get("seg");this.seg=e&&Oe.includes(e)?e:"handlers"}setSeg(e){this.seg=e,this.adding=!1,this.filterOpen=!1,this.embedded||Ne("/tickets/handlers",this.seg==="handlers"?void 0:new URLSearchParams({seg:this.seg})),this.ok="",this.error=""}async loadCounts(){const e=async o=>{try{return(await E().contacts({kind:o})).contacts.length}catch{return null}},[t,i,a]=await Promise.all([e("vendor"),e("person"),e("employee")]);let r=0;try{const o=await q().departments(),v=new Set;for(const O of o.departments.filter(g=>g.active))for(const g of O.members)g.kind==="user"&&v.add(g.id);r=v.size}catch(o){r=o instanceof R&&(o.status===403||o.status===404)?0:null}const l={};(r!==null||a!==null)&&(l.handlers=(r??0)+(a??0)),t!==null&&(l.vendors=t),i!==null&&(l.contacts=i),this.counts.review!==void 0&&(l.review=this.counts.review),this.counts=l}segments(){return Ae(!!this.meta?.can.configure)}async loadReviewCount(){if(this.meta?.can.configure)try{const e=await K.report();this.counts={...this.counts,review:e.pending.length+e.idle.length}}catch{}}async loadLoads(){if(!fe(this.meta?.departments??[]).length){this.loads=null,this.loadHandled();return}this.loadHandled();try{this.loads=Ge((await me().board({})).items)}catch{this.loads=null}}async loadHandled(){const e=++this.handledSeq;if(!this.managed().length){this.handled=null;return}try{const t=await me().handlerLoad(this.period??void 0);if(e!==this.handledSeq)return;this.installDefault=se(t.default_days)??ue;const i=se(t.days);this.handled=i?{days:i,counts:t.handled}:null}catch{e===this.handledSeq&&(this.handled=null)}}deptChips(e){const t=e.find(i=>i.id===this.dept);return t?[{key:"department",label:u(t.name),remove:()=>this.dept=""}]:[]}deptPanel(e){const t=n`<div class="fchips" role="group" aria-label=${s("departmentsGroup")} data-handlers-depts>
      <button type="button" class="rc" aria-pressed=${String(!this.dept)} data-handlers-dept="" @click=${()=>this.dept=""}>${s("allDepartments")}</button>
      ${e.map(i=>n`<button type="button" class="rc" aria-pressed=${String(this.dept===i.id)} data-handlers-dept=${i.id} @click=${()=>this.dept=i.id}>${u(i.name)}</button>`)}
    </div>`;return Ze(et(s("departmentsGroup"),t),this.dept?1:0,()=>this.dept="",()=>this.filterOpen=!1)}addLabel(){return this.seg==="vendors"?s("u6AddVendor"):this.seg==="contacts"?s("u6AddContact"):s("u6AddHandler")}onAdd(){if(this.seg==="handlers"){this.adding=!this.adding;return}this.renderRoot.querySelector(`tickets-contacts[kind="${this.seg==="vendors"?"vendor":"person"}"]`)?.startNew()}managed(){return fe(this.meta?.departments??[])}strip(){const e=Ie(this.readiness);return e.length?n`<div class="banner warn" role="status" data-readiness>
      ${w("warning")}
      <div><b>${s("u6NotReady")}</b><small>${s("rdyStrip")}: ${e.map(t=>s(t.text)).join(" · ")}</small></div>
      <div class="rdy">${e.map(t=>n`<a class="btn sm" href=${t.href} data-readiness-item=${t.key}>${s(t.text)}</a>`)}</div>
    </div>`:d}shownLoads(){return this.handled?{loads:We(this.loads,this.handled.counts),label:s(`u6HandledP${this.handled.days}`)}:{loads:this.loads,label:null}}periodPicker(){if(this.seg!=="handlers"||!this.loads)return d;const e=this.period??this.installDefault;return n`<label class="hperiod" data-handled-period-wrap><span class="vh">${s("u6HandledPeriodLabel")}</span>
      <select class="in" data-handled-period aria-label=${s("u6HandledPeriodLabel")} @change=${this.onPeriod}>
        ${Je.map(t=>n`<option value=${String(t)} ?selected=${e===t}>${s("u6Handled")} · ${s(`u6HandledP${t}`)}</option>`)}
      </select></label>`}body(){const{loads:e,label:t}=this.shownLoads();return this.seg==="vendors"?n`${this.meta?.can.configure||this.meta?.can.technician_requests?n`<tickets-portal-requests @notice=${this.onNotice}></tickets-portal-requests>`:d}
        <tickets-contacts kind="vendor" head .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>`:this.seg==="review"?this.meta?.can.configure?n`<tickets-needs-review @notice=${this.onNotice} @review-count=${this.onReviewCount}></tickets-needs-review>`:n``:this.seg==="contacts"?n`<tickets-contacts kind="person" head .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>`:n`<div class="body" data-handlers-segment>
      <tickets-handlers-members .dept=${this.dept} .query=${this.q} .loads=${e} .handledLabel=${t} .managed=${this.managed()}
        ?adding=${this.adding} @add-done=${this.onAddDone} @notice=${this.onNotice}></tickets-handlers-members>
      <tickets-contacts kind="employee" head newbtn .loads=${e} .handledLabel=${t} .managed=${this.managed()} .dept=${this.dept} .query=${this.q} @notice=${this.onNotice}></tickets-contacts>
    </div>`}render(){const e=this.meta?.departments??[],t=this.embedded?e.filter(g=>g.can_manage):e,i=dt(e),a=this.seg==="review",r=this.segments(),l=!a&&(this.seg!=="handlers"||(this.meta?.can.configure??!0)||i.length>0),o=t.length>1&&!a,v=o?this.deptChips(t):[],O=o&&this.filterOpen?this.deptPanel(t):d;return n`<div class=${this.embedded?"page embedded":"page"} data-tickets-handlers data-seg=${this.seg} ?data-embedded=${this.embedded}>
      <header class="dh" data-tickets-header>
        ${this.embedded?d:n`<div class="dh-row">
          <div class="titles"><div class="crumbs">${s("area")}</div><h1 data-handlers-title>${s("hdTitle")}</h1></div>
          <span class="grow"></span>
        </div>`}
        <div class="dh-det tb" role="group" aria-label=${s("hdTitle")} data-toolbar>
          <div class="seg sm" role="radiogroup" aria-label=${s("hdTitle")} data-handlers-tabs style=${`--segs:${r.length}`} @keydown=${this.onSegKey}>
            ${r.map(g=>n`<button type="button" role="radio" aria-checked=${String(this.seg===g)} tabindex=${this.seg===g?"0":"-1"} data-seg=${g} @click=${()=>this.setSeg(g)}>${s(`hdSeg_${g}`)}${this.counts[g]===void 0?d:n`<small>${this.counts[g]}</small>`}</button>`)}
          </div>
          ${o?n`<span class="fanchor">
            ${tt(this.filterOpen,v.length,()=>this.filterOpen=!this.filterOpen)}
            ${this.phone?d:O}
          </span>${st(v,()=>this.dept="")}`:d}
          <span class="grow"></span>
          ${this.periodPicker()}
          ${a?d:n`<label class="search">${w("search")}<span class="vh">${s("u6SearchPh")}</span><input type="search" data-handlers-search maxlength="80" placeholder=${this.phone?s("searchShort"):s("u6SearchPh")}
            .value=${this.q} @input=${g=>this.q=g.target.value} /></label>`}
          ${l?n`<button type="button" class="btn primary newbtn" data-handlers-new aria-label=${this.addLabel()} aria-expanded=${this.seg==="handlers"?String(this.adding):d} @click=${()=>this.onAdd()}>${w("plus")}<span class="lbl">${this.addLabel()}</span></button>`:d}
          ${o&&this.phone?O:d}
        </div>
      </header>
      ${this.strip()}
      ${this.error?n`<div class="toast bad" role="alert" data-handlers-error ${he()}>${w("warning")}<span class="tx">${this.error}</span>
        <button type="button" class="x" aria-label=${je("actions.close")} data-handlers-error-close @click=${()=>this.error=""}>${w("x")}</button></div>`:this.ok?n`<div class="toast" role="status" data-handlers-ok ${he()}>${w("check")}<span class="tx">${this.ok}</span></div>`:d}
      ${this.body()}
    </div>`}};b.styles=[W,...re,Ye,le,at,A`
    .crumbs {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      margin-block-end: 2px;
    }
    .titles {
      min-inline-size: 0;
    }
    .rdy {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-inline-start: auto;
    }
    .rdy .btn {
      text-decoration: none;
    }
    .banner > div:not(.rdy) {
      min-inline-size: 0;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 22px;
      min-inline-size: 0;
    }
    .dh-det .seg small {
      margin-inline-start: 4px;
    }
    /* WP3 (POLISH-4): the toolbar is the list's (tickets/list-toolbar.ts); the period and the "new" key keep their places at its end, and
       the row wraps when the department filter, the period and the search do not share one line (a tablet) */
    .dh-det.tb {
      flex-wrap: wrap;
    }
    .dh-det.tb > .grow {
      flex: 1 1 0;
      min-inline-size: 0;
    }
    .newbtn {
      flex: none;
    }
    /* the receipt and the error: a toast in view (the TKSET dialect) instead of an inline line under the header, out of sight when the
       card that was changed is far below it; the error stays until it is dismissed or the next action starts */
    .toast .tx {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .toast .x {
      display: inline-grid;
      place-items: center;
      flex: none;
      inline-size: 32px;
      block-size: 32px;
      margin-inline: 4px -8px;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: inherit;
      cursor: pointer;
      position: relative;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: transform var(--sw-t-press) var(--sw-ease-out);
    }
    .toast .x::after {
      content: '';
      position: absolute;
      inset: -6px;
    }
    .toast .x:active {
      transform: scale(var(--sw-press-scale));
    }
    .toast .x:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    @media (hover: hover) and (pointer: fine) {
      .toast .x:hover {
        background: color-mix(in srgb, currentColor 12%, transparent);
      }
    }
    .page.embedded {
      padding: 0;
      min-block-size: 0;
    }
    @media (max-width: 767px) {
      .dh-row {
        grid-template-areas: 't .';
        grid-template-columns: minmax(0, 1fr) var(--sw-float-reserve, 0px);
      }
      .dh-det {
        gap: 10px;
      }
      .dh-det.tb > .seg {
        grid-template-columns: repeat(var(--segs, 3), minmax(0, 1fr));
        grid-auto-flow: row;
        overflow: visible;
      }
      .dh-det .grow {
        display: none;
      }
      /* the search, the filter and the "new" key share one 44 px row; "new" keeps its name for assistive tech and shows the plus */
      .dh-det .newbtn {
        order: 1;
        min-inline-size: 44px;
        min-block-size: 44px;
        justify-content: center;
      }
      .dh-det .newbtn .lbl {
        display: none;
      }
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h) + 14px);
      }
      .banner {
        flex-wrap: wrap;
      }
      .rdy {
        margin-inline-start: 0;
      }
    }
  `];x([m({type:Boolean})],b.prototype,"embedded",2);x([c()],b.prototype,"seg",2);x([c()],b.prototype,"readiness",2);x([c()],b.prototype,"meta",2);x([c()],b.prototype,"dept",2);x([c()],b.prototype,"q",2);x([c()],b.prototype,"counts",2);x([c()],b.prototype,"loads",2);x([c()],b.prototype,"period",2);x([c()],b.prototype,"installDefault",2);x([c()],b.prototype,"handled",2);x([c()],b.prototype,"adding",2);x([c()],b.prototype,"ok",2);x([c()],b.prototype,"error",2);x([c()],b.prototype,"filterOpen",2);x([c()],b.prototype,"phone",2);b=x([j("tickets-handlers")],b);export{b as TicketsHandlersPage};
//# sourceMappingURL=tickets-handlers-DHHrQ78M.js.map
