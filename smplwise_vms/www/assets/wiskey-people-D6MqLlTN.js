import{E as K,F as _,G as c,a as W,d4 as Tt,Y as U,j as $,d5 as Ot,cn as pe,d6 as Rt,d7 as pt,d8 as Dt,A as l,e as n,H as V,a7 as I,a8 as _e,cg as At,$ as It,g as ne,d9 as ut,da as we,i as D,l as ye,db as qt,dc as Nt,dd as Mt,de as ht,co as Z,ct as le,df as jt,n as Lt,aC as Re,al as Ut,ba as Ft,cz as Bt,be as Kt}from"./index-k1cto_iv.js";import"./wk-deep-links-bX6lYJJY.js";import{l as b}from"./live-pyZ6TXim.js";import{f as Q,s as ft,v as Wt,a as qe,b as Vt,p as Yt,t as Gt,c as mt,i as Ht,d as se,e as ue,g as he,m as Xt,h as Jt,j as Zt,T as Qt,k as Ne,l as es,n as ts,o as ss,w as Me,q as $e,P as de,r as je,u as is,x as ns,y as as,z as rs,A as Le,B as os,C as ls,D as ds,E as Ue,S as cs,F as ps,R as us,G as hs,H as fs,I as ms,J as gs,K as ws,L as vs,M as _s}from"./access-people-R-PoH3j8.js";import{t as p,U as ee,l as Fe,r as Be}from"./wiskey-format-DJ4vUeXA.js";import{u as Ke,r as bs,b as ke,c as xe,n as ys,a as $s,d as ks,o as xs,e as zs}from"./access-messaging-Bx27xRKP.js";import{a as We}from"./access-C1lMjOLO.js";import"./sw-logo-art-Va6y_cIM.js";import"./deep-links-DcLXvoYw.js";import"./wiskey-profiles-9YwVwPC8.js";var Cs=Object.defineProperty,Ss=Object.getOwnPropertyDescriptor,j=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ss(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Cs(t,s,a),a};const Es=30,Ps=1e3,Ts=3e3,Os=2e3,Rs=new Set(["preparing","waiting","captured","applying"]),ze=new Set(["preparing","waiting","captured"]);async function Ve(e){try{await pt(e)}catch{}}function Ce(e){const t=e instanceof $?e.body?.details?.wiskey_code:void 0,s=t?p(t):"";return t&&s!==t.replaceAll("_"," ")?s:U(e)}let N=class extends W{constructor(){super(...arguments),this.stations=[],this.step="choose",this.station="",this.readers=null,this.reader=0,this.busy="",this.capture=null,this.label="",this.error="",this.errorCode="",this.outcome="",this.holdUntil=0,this.now=performance.now(),this.receivedAt=performance.now(),this.epoch=0,this.pollTimer=0,this.tickTimer=0}connectedCallback(){super.connectedCallback();const e=this.usable()[0]?.id??"";this.station=e,e&&this.readReaders(e),this.tickTimer=window.setInterval(()=>this.now=performance.now(),250)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.tickTimer),this.clear()}usable(){return this.stations.filter(e=>e.lock_enabled&&e.online)}clear(){this.epoch++,window.clearTimeout(this.pollTimer);const e=this.capture;this.capture=null,e&&ze.has(e.state)&&Ve(e.session_id)}setError(e,t="",s=""){this.error=e,this.errorCode=t,this.outcome=s}async readReaders(e){if(this.clear(),this.step="choose",this.station=e,this.readers=null,this.reader=0,this.setError(""),!e)return;const t=this.epoch;this.busy="readers";try{const s=await Tt(e);if(t!==this.epoch)return;if(s.readers)this.readers=s.readers.readers,this.reader=s.readers.readers[0]??0;else{const i=s.last_error??s.state;this.setError(p(i)!==i.replaceAll("_"," ")?p(i):`לא ניתן לקרוא את יכולות הקורא (${i}).`,i)}}catch(s){t===this.epoch&&this.setError(U(s),s instanceof $?s.code:"error")}finally{t===this.epoch&&(this.busy="")}}async start(){if(this.busy||!this.station||!this.readers?.length)return;const e=++this.epoch;this.busy="start",this.setError("");try{const t=await Ot(this.person.id,this.station,this.reader,this.person.revision??0);if(e!==this.epoch){t.capture&&Ve(t.capture.session_id);return}this.show(t.capture),this.step="session"}catch(t){if(e!==this.epoch)return;const s=pe(t);if(s==="unknown"){const i=t instanceof $?Number(t.body?.details?.retry_after_s):NaN;this.holdUntil=performance.now()+(Number.isFinite(i)&&i>0?i:120)*1e3,this.step="start_unknown",this.setError(U(t),t instanceof $?t.code:"error","unknown")}else this.step="choose",this.setError(Ce(t),t instanceof $?t.code:"error",s)}finally{e===this.epoch&&(this.busy="")}}show(e){if(this.capture=e,this.receivedAt=performance.now(),window.clearTimeout(this.pollTimer),e&&Rs.has(e.state)&&e.state!=="applying"){const t=this.epoch;this.pollTimer=window.setTimeout(()=>void this.poll(t),e.state==="captured"?Ts:Ps)}}async poll(e){const t=this.capture?.session_id;if(!(!t||e!==this.epoch))try{const s=await Rt(t);if(e!==this.epoch||this.busy==="save"||this.busy==="cancel")return;this.show(s.capture)}catch(s){if(e!==this.epoch)return;if(s instanceof $&&s.code==="intercom_capture_not_found"){this.capture=this.capture?{...this.capture,state:"lost",active:!1,card:null}:null,this.setError(p("capture_not_found"),s.code);return}this.pollTimer=window.setTimeout(()=>void this.poll(e),Os)}}async cancel(){const e=this.capture;if(!e||!ze.has(e.state)||this.busy)return;this.busy="cancel",window.clearTimeout(this.pollTimer);const t=this.epoch;try{const s=await pt(e.session_id);if(t!==this.epoch)return;this.setError(""),this.show(s.capture)}catch(s){if(t!==this.epoch)return;const i=s instanceof $?s.body?.details?.capture:void 0,a=pe(s);this.setError(a==="unknown"?`לא ידוע אם הביטול התקבל: ${U(s)}`:Ce(s),s instanceof $?s.code:"error",a),this.show(i??e)}finally{t===this.epoch&&(this.busy="")}}again(){this.readReaders(this.station)}close(){if(this.busy==="save"){this.requestUpdate();return}this.clear(),this.dispatchEvent(new CustomEvent("capture-close",{bubbles:!0,composed:!0}))}async save(){const e=this.capture;if(!e||e.state!=="captured"||this.busy)return;this.busy="save",window.clearTimeout(this.pollTimer);const t=this.epoch;try{const s=await Dt(e.session_id,this.label);this.capture=s.capture,this.dispatchEvent(new CustomEvent("capture-saved",{detail:{person:s.person,note:s.note},bubbles:!0,composed:!0}))}catch(s){if(t!==this.epoch)return;const i=s instanceof $?s.body?.details?.capture:void 0,a=pe(s);this.step="session",a==="unknown"?(this.setError(`${p("capture_state_unconfirmed")} (${U(s)})`,s instanceof $?s.code:"error","unknown"),this.show(i??{...e,state:"unconfirmed",active:!1,card:null})):(this.setError(Ce(s),s instanceof $?s.code:"error",a),this.show(i??e))}finally{this.busy=""}}remaining(e){return e==null?0:Math.max(0,Math.ceil(e-(this.now-this.receivedAt)/1e3))}stationName(e){return this.stations.find(t=>t.id===e)?.name??e}render(){const e=this.capture,t=this.step==="session"||this.step==="confirm_save"?e?.state??"preparing":this.step;return n`<sw-dialog
      .open=${b(!0)}
      heading=${p("capture_card")}
      subheading=${[this.person.display_name,this.person.employee_no].filter(Boolean).join(" · ")}
      data-wiskey-capture
      data-wiskey-capture-step=${this.step}
      data-wiskey-capture-state=${t}
      @close=${()=>this.close()}
    >
      ${this.step==="choose"?this.renderChoose():l}
      ${this.step==="confirm"?this.renderConfirm():l}
      ${this.step==="start_unknown"?this.renderStartUnknown():l}
      ${(this.step==="session"||this.step==="confirm_save")&&e?this.renderSession(e):l}
      ${this.error&&this.step!=="start_unknown"?n`<p class="note ${this.outcome==="unknown"?"warn":"err"}" role="alert" data-wiskey-capture-error=${this.errorCode} data-wiskey-capture-outcome=${this.outcome}>${this.error}</p>`:l}
      <p class="muted">${p("capture_limits")}</p>
      <div slot="footer" class="footer">${this.renderFooter()}</div>
    </sw-dialog>`}renderChoose(){const e=this.usable();return n`<p class="muted">${p("capture_hint")}</p>
      <div class="grid2">
        <sw-field label=${p("station")}>
          <select data-wiskey-capture-station .value=${b(this.station)} ?disabled=${this.busy==="start"} @change=${t=>void this.readReaders(t.target.value)}>
            <option value="" disabled>${p("select_station")}</option>
            ${e.map(t=>n`<option value=${t.id} ?selected=${t.id===this.station}>${t.name}</option>`)}
          </select>
        </sw-field>
        <sw-field label=${p("capture_reader")}>
          <select aria-label=${p("capture_reader")} data-wiskey-capture-reader .value=${b(String(this.reader))} ?disabled=${!this.readers?.length} @change=${t=>this.reader=Number(t.target.value)}>
            ${(this.readers??[]).map(t=>n`<option value=${t} ?selected=${t===this.reader}>${t===0?p("capture_default_reader"):t}</option>`)}
          </select>
        </sw-field>
      </div>
      ${e.length?l:n`<p class="note err" data-wiskey-capture-no-station>אין כרגע אינטרקום מחובר עם מנעול מנוהל שאפשר לקרוא בו כרטיס.</p>`}
      <p role="status" data-wiskey-capture-status>${this.busy==="readers"?p("loading"):p("capture_state_choose")}</p>`}renderConfirm(){const e=this.stationName(this.station);return n`<div class="confirm" data-wiskey-capture-confirm-step>
      <p><b>להפעיל את קורא הכרטיסים בעמדה ${e}?</b></p>
      <p>הקורא בעמדה ייכנס עכשיו למצב קריאת כרטיס, לעד ${Es} שניות. בקשו מ־<b>${this.person.display_name}</b> (או ממי שמחזיק את הכרטיס) לעמוד ליד העמדה ולהצמיד <b>כרטיס אחד</b> לקורא כשתופיע כאן ההנחיה "הצמד כעת כרטיס".</p>
      <p>המספר שנקרא יוצג כאן ממוסך, ורק אחרי אישורכם הוא יתווסף למשתמש ויסונכרן לתחנות שלו. ${p("capture_hint").split(". ").slice(-1)[0]}</p>
      <p class="muted">הפעולה נרשמת ביומן הביקורת של Arx בשמך.</p>
    </div>`}renderStartUnknown(){const e=Math.max(0,Math.ceil((this.holdUntil-this.now)/1e3));return n`<div class="note warn" role="alert" data-wiskey-capture-error=${this.errorCode} data-wiskey-capture-outcome="unknown">
      <sw-icon name="warning" size=${16}></sw-icon>
      <span>לא ידוע אם הקורא נכנס למצב קריאה. ${this.error}</span>
    </div>
    <p data-wiskey-capture-countdown=${e}>${e>0?`ייתכן שהקורא בעמדה ${this.stationName(this.station)} ממתין לכרטיס עוד עד ${e} שניות (עד שיפוג זמן הקריאה). שום כרטיס לא יתווסף בלי אישורכם.`:"זמן הקריאה הסתיים. אפשר לנסות שוב."}</p>`}renderSession(e){const t=e.state==="preparing"||e.state==="waiting",s=this.remaining(e.collect_remaining_s),i=this.remaining(e.session_remaining_s),a=this.person.stations.filter(d=>d.enabled).map(d=>this.stationName(d.station_id));return n`<div class="session">
      <p class="muted">${p("station")}: <b>${e.station_name??this.stationName(e.station_id)}</b> · ${p("capture_reader")}: ${e.reader_id===0?p("capture_default_reader"):e.reader_id}</p>
      <p role="status" class="status ${t?"live":""}" data-wiskey-capture-status>
        ${t?n`<span class="pulse" aria-hidden="true"></span>`:l}${this.stateText(e)}
      </p>
      ${t?n`<p data-wiskey-capture-countdown=${s}>זמן שנותר לקריאה: <b>${s}</b> שניות</p>`:l}
      ${e.state==="error"&&e.error?n`<p class="note err" data-wiskey-capture-wiskey-error=${e.error}>${p(e.error)}</p>`:l}
      ${e.card&&(e.state==="captured"||e.state==="applying")?n`<div class="card" data-wiskey-capture-card>
              <bdi data-ltr>${e.card.masked_number}</bdi>${e.card.technology?n`<span> · <bdi>${e.card.technology}</bdi></span>`:l}
            </div>
            <sw-field label=${p("card_label")}>
              <input maxlength="64" data-wiskey-capture-label .value=${b(this.label)} ?disabled=${this.step==="confirm_save"||this.busy==="save"} @input=${d=>this.label=d.target.value} />
            </sw-field>
            <p class="muted">${p("capture_targets")}: ${a.join(", ")||p("csv_no_stations")}</p>
            ${e.state==="captured"?n`<p class="muted" data-wiskey-capture-session-left=${i}>הכרטיס ממתין לאישור עוד ${i} שניות; אחר כך הקריאה נמחקת.</p>`:l}`:l}
      ${this.step==="confirm_save"&&e.state==="captured"?n`<div class="note info" data-wiskey-capture-save-prompt>${p("capture_confirm_prompt").replace("{name}",this.person.display_name)} הכרטיס יישמר ויפתח את הדלתות שהמשתמש משויך אליהן.</div>`:l}
      ${e.reader_may_be_collecting&&!t?n`<p class="note warn" data-wiskey-capture-maybe-collecting>ייתכן שהקורא בעמדה עדיין במצב קריאה עד שיפוג הזמן (עד ${i} שניות; זמן ההמתנה של הקורא עצמו נקבע בקושחה). שום כרטיס לא יתווסף בלי אישורכם.</p>`:l}
    </div>`}stateText(e){switch(e.state){case"cancel_unknown":return e.reason==="abandoned"?`${p("capture_state_abandoned")} לא ידוע אם הביטול התקבל.`:"לא ידוע אם הביטול התקבל.";case"unconfirmed":return p("capture_state_unconfirmed");case"cancelled":case"lost":return e.reason==="abandoned"?p("capture_state_abandoned"):p(`capture_state_${e.state}`);default:return p(`capture_state_${e.state}`)}}renderFooter(){const e=this.capture,t=this.busy,s=n`<sw-button variant="ghost" data-wiskey-capture-close ?disabled=${t==="save"} @click=${()=>this.close()}>${p("close")}</sw-button>`;if(this.step==="choose")return n`${s}<sw-button variant="primary" data-wiskey-capture-next ?disabled=${!!t||!this.station||!this.readers?.length} @click=${()=>{this.setError(""),this.step="confirm"}}>המשך</sw-button>`;if(this.step==="confirm")return n`<sw-button variant="ghost" data-wiskey-capture-back ?disabled=${t==="start"} @click=${()=>this.step="choose"}>חזרה</sw-button>
        <sw-button variant="primary" icon="wifi" data-wiskey-capture-start ?disabled=${t==="start"} @click=${()=>void this.start()}>${t==="start"?p("wait"):p("capture_start")}</sw-button>`;if(this.step==="start_unknown")return n`${s}<sw-button data-wiskey-capture-again @click=${()=>this.again()}>${p("capture_again")}</sw-button>`;if(!e)return s;if(this.step==="confirm_save")return n`<sw-button variant="ghost" data-wiskey-capture-save-back ?disabled=${t==="save"} @click=${()=>this.step="session"}>חזרה</sw-button>
        <sw-button variant="primary" icon="check" data-wiskey-capture-save-confirm ?disabled=${t==="save"||e.state!=="captured"} @click=${()=>void this.save()}>${t==="save"?p("wait"):p("capture_save")}</sw-button>`;const i=ze.has(e.state)?n`<sw-button variant="danger" data-wiskey-capture-cancel ?disabled=${!!t} @click=${()=>void this.cancel()}>${t==="cancel"?p("wait"):"ביטול הקריאה"}</sw-button>`:l,a=["error","captured","cancelled","expired","lost","closed","revoked"].includes(e.state)?n`<sw-button data-wiskey-capture-again ?disabled=${!!t} @click=${()=>this.again()}>${p("capture_again")}</sw-button>`:l,d=e.state==="captured"?n`<sw-button variant="primary" icon="check" data-wiskey-capture-save ?disabled=${!!t} @click=${()=>{this.setError(""),this.step="confirm_save"}}>${p("capture_save")}</sw-button>`:l,o=e.state==="unconfirmed"?n`<sw-button icon="refresh" data-wiskey-capture-reload @click=${()=>{this.clear(),this.dispatchEvent(new CustomEvent("capture-reload",{bubbles:!0,composed:!0}))}}>טען מחדש את הרשומה</sw-button>`:l;return n`${s}${i}${a}${o}${d}`}};N.styles=K`
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 10px;
    }
    @media (max-width: 480px) {
      .grid2 {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    p {
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .session,
    .confirm {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pulse {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: var(--sw-accent, var(--sw-success));
      animation: pulse 1.2s ease-in-out infinite;
      flex: none;
    }
    @keyframes pulse {
      0%,
      100% {
        opacity: 0.3;
      }
      50% {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse {
        animation: none;
      }
    }
    /* R5-SECURITY: the read card number is the dialog's display figure - 26/800 tabular in a well */
    .card {
      font-size: var(--sw-fs-3xl);
      font-weight: 800;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--sw-text));
      padding: 12px 16px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .status {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    [data-ltr] {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note > span {
      flex: 1 1 200px;
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .note.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
  `;j([_({attribute:!1})],N.prototype,"person",2);j([_({attribute:!1})],N.prototype,"stations",2);j([c()],N.prototype,"step",2);j([c()],N.prototype,"station",2);j([c()],N.prototype,"readers",2);j([c()],N.prototype,"reader",2);j([c()],N.prototype,"busy",2);j([c()],N.prototype,"capture",2);j([c()],N.prototype,"label",2);j([c()],N.prototype,"error",2);j([c()],N.prototype,"errorCode",2);j([c()],N.prototype,"outcome",2);j([c()],N.prototype,"holdUntil",2);j([c()],N.prototype,"now",2);N=j([V("wiskey-card-capture")],N);function Ds(e,t,s){if(!e||!t.manage||!e.editable)return[];const i=["edit"];return e.archived||i.push(e.active?"deactivate":"activate"),!e.archived&&e.active&&(e.access_category==="visitor"||e.access_category==="contractor")&&i.push("temporary_cancel"),e.level==="sensitive"&&(i.push("cards"),s.photoEnabled&&i.push("photo")),i.push(e.archived?"restore":"archive","delete"),i}function Pe(e){return e&&e.pending===!1&&e.effect!=="unknown_effect"?"saved":"pending"}const As={intercom_person_scope:"err.scope",intercom_field_level:"err.field",intercom_person_not_found:"err.gone",intercom_revision_conflict:"err.revision",intercom_archive_state_changed:"err.archive_state",intercom_person_archived:"err.archived",intercom_not_temporary:"err.not_temporary",intercom_already_inactive:"err.already_inactive",intercom_card_conflict:"err.card_conflict",intercom_card_not_found:"err.card_gone",intercom_approval_required:"err.approval",intercom_pin_interactive_only:"err.pin_interactive",intercom_busy:"err.busy",intercom_rate_limited:"err.busy",intercom_unavailable:"err.unavailable",intercom_duplicate_command:"err.duplicate",intercom_responsible_required:"err.guest",intercom_photo_disabled:"err.photo_disabled",expired:"err.expired",forbidden:"err.forbidden",validation:"err.invalid",intercom_invalid_request:"err.invalid"};function Ye(e){const t=e.code&&As[e.code]||"err.generic";return e.outcome==="not_sent"||e.status===403&&e.code==="forbidden"?{state:"not_sent",reason:t}:e.outcome==="refused"?{state:"refused",reason:t}:{state:"unknown",reason:"err.generic"}}function gt(e){return e===404?"confirmed":"pending"}const wt=3e3,Te=10,Is=/^[A-Za-z0-9_-]{1,32}$/,qs=e=>Is.test(e.trim()),Ns=512,Ms=32768,js=44e3,Ls="data:image/jpeg;base64,",Us=[.86,.78,.7,.62,.54,.46,.38];function Fs(e,t,s=Ns){if(!(e>0)||!(t>0))return{width:1,height:1};const i=Math.min(1,s/Math.max(e,t));return{width:Math.max(1,Math.round(e*i)),height:Math.max(1,Math.round(t*i))}}function Bs(e){const t=e.slice(e.indexOf(",")+1),s=t.endsWith("==")?2:t.endsWith("=")?1:0;return Math.floor(t.length*3/4)-s}function Ks(e){return e.startsWith(Ls)&&e.length<=js&&Bs(e)<=Ms}const vt=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],Ws=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],_t=8,bt=64,Vs=/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/,Ys=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;function Ge(e,t=!1){if(t&&e==="24:00")return 1440;if(!Vs.test(e))return null;const[s,i]=e.split(":");return Number(s)*60+Number(i)}function Gs(e){if(!Ys.test(e))return!1;const[t,s,i]=e.split("-").map(Number),a=new Date(Date.UTC(t,s-1,i));return a.getUTCFullYear()===t&&a.getUTCMonth()===s-1&&a.getUTCDate()===i&&t>=2e3&&t<=2037}function Oe(e,t){const s=e?.timing_policy??null,i=s?.schedule??e?.timing_draft??null,a=s?.mode==="native"?"native":s?.mode==="ha"?"ha":"draft";return!i||i.mode!=="weekly"&&i.mode!=="dates"?{mode:"none",enforce:a==="native"?"native":"draft",timezone:t,days:[],dates:[],periods:[{start:"08:00",end:"17:00"}]}:{mode:i.mode,enforce:a,timezone:i.timezone||t,days:[...i.days],dates:[...i.dates],periods:i.periods.length?i.periods.map(d=>({...d})):[{start:"08:00",end:"17:00"}]}}function Hs(e,t=()=>!0){if(e.mode==="none"||e.enforce==="native")return null;if(!e.timezone||!t(e.timezone))return"timing.err.zone";if(e.mode==="weekly"){const a=new Set(e.days);if(a.size===0||[...a].some(d=>!vt.includes(d)))return"timing.err.days"}else{const a=new Set(e.dates);if(a.size===0||a.size>bt||[...a].some(d=>!Gs(d)))return"timing.err.dates"}if(!e.periods.length||e.periods.length>_t)return"timing.err.periods";const s=e.periods.map(a=>[Ge(a.start),Ge(a.end,!0)]);if(s.some(([a,d])=>a===null||d===null||a>=d))return"timing.err.order";const i=[...s].sort((a,d)=>a[0]-d[0]);for(let a=1;a<i.length;a++)if(i[a-1][1]>i[a][0])return"timing.err.overlap";return null}function Se(e){return e.mode==="none"?null:{mode:e.mode,timezone:e.timezone,days:e.mode==="weekly"?vt.filter(t=>e.days.includes(t)):[],dates:e.mode==="dates"?[...new Set(e.dates)].sort():[],periods:[...e.periods].map(t=>({start:t.start,end:t.end})).sort((t,s)=>t.start<s.start?-1:t.start>s.start?1:0)}}function Xs(e,t,s){if(e.enforce==="native")return{};const i=Oe(t,s);if(i.enforce!=="native"&&JSON.stringify([i.mode,i.mode==="none"?null:i.enforce,Se(i)])===JSON.stringify([e.mode,e.mode==="none"?null:e.enforce,Se(e)]))return{};const d=Se(e);return d?e.enforce==="ha"?{access_timing_draft:null,access_timing_policy:{mode:"ha",schedule:d,bindings:{}}}:{access_timing_draft:d,access_timing_policy:null}:{access_timing_draft:null,access_timing_policy:null}}function Js(e,t,s){return e==="staff"||t.trim()&&s?null:"err.guest"}const Zs={"actions.open":"פעולות","actions.heading":"פעולות","act.edit":"עריכת פרטים","act.deactivate":"השבתה","act.activate":"הפעלה","act.archive":"העברה לארכיון","act.restore":"שחזור מהארכיון","act.temporary_cancel":"סיום גישה זמנית","act.cards":"כרטיסים","act.photo":"תמונה","act.delete":"מחיקה","confirm.deactivate":"להשבית את הגישה של {name}?","confirm.activate":"להפעיל את הגישה של {name}?","confirm.archive":"להעביר את {name} לארכיון? הגישה תושבת.","confirm.restore":"לשחזר את {name} מהארכיון? האדם יחזור מושבת.","confirm.temporary_cancel":"לסיים עכשיו את הגישה של {name}?","confirm.delete":"למחוק את {name}? ההסרה מהעמדות מתוזמנת.","confirm.remove_card":"להסיר את הכרטיס {mask}?","confirm.remove_photo":"להסיר את התמונה של {name}?","reason.label":"סיבה","reason.visit_completed":"הביקור הסתיים","reason.visit_cancelled":"הביקור בוטל","reason.access_no_longer_needed":"הגישה אינה נחוצה עוד","btn.confirm":"אישור","btn.cancel":"ביטול","btn.close":"סגירה","btn.check":"בדיקה חוזרת","btn.add_card":"הוספת כרטיס","btn.remove":"הסרה","btn.read_card":"קריאה מעמדה","btn.choose_photo":"בחירת תמונה","btn.save_photo":"שמירה","btn.remove_photo":"הסרת התמונה","btn.working":"שולח…","res.saved":"נשמר · {time}","res.pending":"נשלח · ממתין לאישור","res.deleted":"האדם הוסר","res.still_pending":"עדיין לא אושר · אפשר לבדוק שוב","res.unknown":"לא ידוע אם בוצע · טענו מחדש לפני ניסיון נוסף","res.not_sent":"לא נשלח · {reason}","res.refused":"לא בוצע · {reason}","err.scope":"האדם משויך גם לעמדה שאינה בניהולך","err.field":"נדרשת הרשאה לפרטים רגישים","err.gone":"האדם לא נמצא","err.revision":"האדם השתנה בינתיים · טענו מחדש","err.archive_state":"מצב הארכיון כבר השתנה","err.archived":"האדם בארכיון · יש לשחזר לפני הפעלה","err.not_temporary":"רק לאורח או לקבלן","err.already_inactive":"הגישה כבר מושבתת","err.card_conflict":"הכרטיס משויך לאדם אחר","err.card_gone":"הכרטיס כבר אינו משויך","err.card_invalid":"אותיות לטיניות, ספרות, מקף או קו תחתון (עד 32)","err.approval":"הפעולה דורשת אישור נוסף בחלון האינטרקום","err.pin_interactive":"יצירת קוד זמינה רק בדפדפן","err.busy":"עמוס כרגע · נסו שוב בעוד רגע","err.unavailable":"בקרת הכניסה אינה זמינה כרגע","err.duplicate":"הפקודה כבר נשלחה","err.expired":"הבקשה פגה · נסו שוב","err.forbidden":"אין הרשאה לפעולה","err.invalid":"הנתונים אינם תקינים","err.photo_disabled":"תמונות אינן מופעלות","err.guest":"לאורח או לקבלן נדרשים אחראי ותאריך סיום","err.generic":"הפעולה לא בוצעה","photo.processing":"מכין תמונה…","photo.too_big":"התמונה גדולה מדי גם אחרי הקטנה","photo.not_image":"הקובץ אינו תמונה","photo.none":"אין תמונה","photo.preview":"תצוגה מקדימה","cards.number":"מספר כרטיס","cards.label":"תווית","cards.none":"אין כרטיסים","cards.loading":"טוען…","cards.disabled":"מושבת","timing.heading":"מועדי כניסה","timing.mode":"מתי","timing.none":"תמיד","timing.weekly":"ימים קבועים בשבוע","timing.dates":"תאריכים","timing.days":"ימים","timing.dates_label":"תאריכים","timing.add_date":"הוספת תאריך","timing.periods":"שעות","timing.add_period":"הוספת שעות","timing.from":"משעה","timing.to":"עד שעה","timing.zone":"אזור זמן","timing.enforce":"אכיפה","timing.enforce_draft":"הצעה בלבד","timing.enforce_ha":"נאכף במערכת","timing.native_locked":"נאכף בעמדה · נערך בחלון האינטרקום","timing.err.days":"יש לבחור לפחות יום אחד","timing.err.dates":"יש לבחור 1-64 תאריכים בין 2000 ל־2037","timing.err.periods":"יש להגדיר 1-8 טווחי שעות","timing.err.order":"שעת ההתחלה חייבת להיות לפני שעת הסיום","timing.err.overlap":"טווחי השעות חופפים","timing.err.zone":"אזור זמן לא מוכר","day.Sunday":"ראשון","day.Monday":"שני","day.Tuesday":"שלישי","day.Wednesday":"רביעי","day.Thursday":"חמישי","day.Friday":"שישי","day.Saturday":"שבת","cat.label":"סוג גישה","cat.field":"קטגוריה","cat.staff":"עובד","cat.visitor":"אורח","cat.contractor":"קבלן","cat.responsible":"אחראי","cat.purpose":"מטרת הגישה"};function h(e,t){const s=Zs[e]??e;return t?s.replace(/\{(\w+)\}/g,(i,a)=>a in t?String(t[a]):i):s}const Qs=15e3;function Y(){return{client_request_id:It(),expires_at:new Date(At()+Qs).toISOString().replace(/\.\d{3}Z$/,"Z")}}const ei=["visit_completed","visit_cancelled","access_no_longer_needed"],te=e=>`intercom/people/${encodeURIComponent(e)}`,ti=(e,t)=>I(`${te(e)}/archive`,{revision:t,confirmed:!0,...Y()}),si=(e,t)=>I(`${te(e)}/unarchive`,{revision:t,confirmed:!0,...Y()}),He=(e,t,s)=>I(`${te(e)}/active`,{active:s,revision:t,...Y()}),ii=(e,t,s)=>I(`${te(e)}/temporary-cancel`,{reason_code:s,revision:t,confirmed:!0,...Y()}),ni=(e,t,s)=>I(`${te(e)}/cards`,{...s,revision:t,...Y()}),ai=(e,t,s)=>I(`${te(e)}/cards/${encodeURIComponent(s)}/remove`,{revision:t,confirmed:!0,...Y()}),ri=(e,t,s,i=!0)=>_e(`${te(e)}/photo`,{photo:s,revision:t,sync_now:i,...Y()}),oi=encodeURIComponent,li=()=>ne("access-control/station-people/stations"),di=(e,t=!1)=>ne(`access-control/station-people/stations/${oi(e)}${t?"?refresh=true":""}`),ci=(e,t)=>I("intercom/station-people/check",{station_id:e,employee_no:t}),pi=(e,t,s)=>I("intercom/station-people/adopt",{employee_no:e,station_ids:t,confirmed:!0,allow_possible_duplicate:s,...Y()}),ui=(e,t,s)=>I("intercom/station-people/ignore",{employee_no:e,station_ids:t,ignored:s,confirmed:!0,...Y()}),hi=(e,t,s)=>I("intercom/station-people/delete",{employee_no:e,station_ids:t,typed:s,confirmed:!0,...Y()}),fi=()=>ne("access-control/people-duplicates"),mi=(e,t)=>I("intercom/people/pin-check",{user_id:e,pin:t});function Xe(e){const t=e.filter(s=>s!==null);return t.length?t.some(Boolean):null}function gi(e){const t=new Map;for(const{station:s,people:i}of e)for(const a of i??[]){const d={...a,station_id:s.id,station_name:s.name},o=t.get(a.employee_no);if(!o){t.set(a.employee_no,{employee_no:a.employee_no,display_name:a.display_name,names:a.display_name?[a.display_name]:[],stations:[d],first_seen_at:a.first_seen_at,ignored:a.ignored,pin:a.pin,cards:a.cards,biometric:a.biometric});continue}o.stations.push(d),!o.display_name&&a.display_name&&(o.display_name=a.display_name),a.display_name&&!o.names.includes(a.display_name)&&o.names.push(a.display_name),a.first_seen_at<o.first_seen_at&&(o.first_seen_at=a.first_seen_at),o.ignored=o.ignored&&a.ignored,o.pin=Xe(o.stations.map(g=>g.pin)),o.biometric=Xe(o.stations.map(g=>g.biometric));const m=o.stations.map(g=>g.cards).filter(g=>g!==null);o.cards=m.length?m.reduce((g,x)=>g+x,0):null}return[...t.values()].sort((s,i)=>!s.display_name!=!i.display_name?s.display_name?-1:1:s.display_name.localeCompare(i.display_name,"he")||s.employee_no.localeCompare(i.employee_no))}function wi(e,t,s=""){const i=s.trim().toLocaleLowerCase("he");return e.filter(a=>(t||!a.ignored)&&(!i||a.employee_no.toLowerCase().includes(i)||a.names.some(d=>d.toLocaleLowerCase("he").includes(i))))}function oe(e,t){return t==="adopt"?e.stations.filter(s=>s.adoptable&&!s.ignored):t==="ignore"?e.stations.filter(s=>!s.ignored):t==="unignore"?e.stations.filter(s=>s.ignored):e.stations}function vi(e){return oe(e,"adopt").length?"":e.stations.find(s=>s.import_error)?.import_error??(e.stations.every(s=>s.ignored)?"ignored":"review_stale")}function _i(e,t){return e.trim()===t}function bi(e){if(!e.length)return"failed";const t=e.filter(s=>s.outcome==="ok").length;return t===e.length?"ok":e.some(s=>s.outcome==="unknown")?"unknown":t?"partial":"failed"}function yi(e){const t=e??[];return{groups:t,people:new Set(t.flatMap(s=>s.people.map(i=>i.id))).size}}function $i(e){return typeof e=="string"&&/^[0-9]{4,128}$/.test(e)}const fe={open:"בעמדות בלבד",title:"משתמשים שנמצאים רק בעמדות",intro:"משתמשים שרשומים באחת העמדות או יותר, אבל אינם ברשימת האנשים. אפשר לאמץ, להסתיר או למחוק כל אחד מהם.",refresh:"קריאה מחדש מהעמדות",reading:"קורא את העמדות…",reading_station:"קורא את {name}…",search:"חיפוש לפי שם או מספר",show_ignored:"הצגת מוסתרים",empty:"לא נמצאו בעמדות משתמשים שאינם ברשימת האנשים.",empty_filtered:"אין תוצאות לחיפוש.",no_stations:"אין עמדות שבהן מותר לך לנהל אנשים.",feed_down:"בקרת הכניסה אינה זמינה כרגע, ולכן אי אפשר לקרוא את העמדות. נסו שוב בעוד רגע.",count:"{n} משתמשים",count_one:"משתמש אחד",read_at:"נקרא {when}",cached:"מהקריאה האחרונה",col_name:"שם בעמדה",col_number:"מספר בעמדה",col_stations:"עמדות",col_credentials:"אמצעי זיהוי",col_first_seen:"נראה לראשונה",no_name:"ללא שם",two_names:"שמות שונים בעמדות",pin:"קוד",card:"כרטיס",cards:"{n} כרטיסים",face:"פנים או טביעת אצבע",none:"אין",hidden:"מוסתר",hidden_hint:"אמצעי הזיהוי מוצגים רק עם הרשאה לפרטים רגישים בעמדה.",ignored_badge:"מוסתר",station_off:"{name}: לא נקראה ({reason})",station_numbers_hidden:"{name}: מספרי המשתמשים בעמדה הזו מוגדרים כפרט רגיש",reason_offline:"העמדה אינה מחוברת",reason_busy:"המערכת עסוקה, נסו שוב בעוד רגע",reason_forbidden:"אין הרשאה לקרוא את העמדה",reason_unsupported:"הגרסה המותקנת אינה תומכת בקריאה הזו",reason_generic:"הקריאה נכשלה",act_adopt:"אימוץ",act_ignore:"הסתרה",act_unignore:"ביטול הסתרה",act_delete:"מחיקה מהעמדה",actions_for:"פעולות עבור {name}",adopt_title:"אימוץ משתמש מהעמדה",adopt_text:"ייווצר אדם ברשימת האנשים מתוך המשתמש כפי שהוא רשום בעמדה, כולל הקוד והכרטיסים שלו. שום דבר לא נוצר בעמדה עצמה.",adopt_link:"ברשימת האנשים כבר קיים אדם עם המספר הזה: {name}. האימוץ יקשר אליו את המשתמש בעמדה, בלי ליצור אדם נוסף.",adopt_link_hidden:"ברשימת האנשים כבר קיים אדם עם המספר הזה. האימוץ יקשר אליו את המשתמש בעמדה, בלי ליצור אדם נוסף.",adopt_checking:"בודק אם האדם כבר קיים…",adopt_maybe:"ייתכן שהאדם כבר קיים בשם או בטלפון אחר:",adopt_maybe_hidden:"ייתכן שהאדם כבר קיים ({n} התאמות) ברשומות שאינן בהרשאתך.",adopt_maybe_accept:"בדקתי - זה אדם אחר, לאמץ בכל זאת",adopt_check_failed:"לא ניתן היה לבדוק כפילויות כרגע. האימוץ ייבדק שוב בשרת.",adopt_blocked:"אי אפשר לאמץ את המשתמש כמו שהוא",adopt_go:"אימוץ",ignore_title:"הסתרת משתמש",ignore_text:"המשתמש יוסתר מהרשימה הזו. הוא נשאר בעמדה ויכול להמשיך להיכנס. אפשר לבטל את ההסתרה בכל עת.",unignore_title:"ביטול הסתרה",unignore_text:"המשתמש יחזור להופיע ברשימה.",delete_title:"מחיקת משתמש מהעמדה",delete_text:"המשתמש יימחק מהעמדות שלמטה ולא יוכל עוד להיכנס בהן בקוד, בכרטיס או בפנים. המחיקה מתבצעת בסנכרון ואינה מיידית.",delete_type:"כדי לאשר, הקלידו את מספר המשתמש בעמדה: {n}",delete_go:"מחיקה מהעמדה",stations_list:"עמדות:",confirm:"אישור",cancel:"ביטול",close:"סגירה",working:"שולח…",res_title:"התוצאה",res_ok:"בוצע",res_refused:"נדחה - לא בוצע",res_unknown:"לא ידוע אם בוצע",res_not_sent:"לא נשלח",res_all_ok:"הפעולה בוצעה בכל העמדות.",res_partial:"הפעולה בוצעה רק בחלק מהעמדות. הפרטים לכל עמדה למטה.",res_failed:"הפעולה לא בוצעה.",res_unknown_all:"לחלק מהעמדות אין תוצאה ברורה. רעננו את הרשימה ובדקו לפני שמנסים שוב.",res_pending:"נשלח - ההסרה מהעמדה תתבצע בסנכרון. רעננו את הרשימה בעוד כמה דקות.",res_stored_only:"הוסתר כאן, אך הסימון בבקרת הכניסה לא עודכן.",res_open_person:"פתיחת האדם",imp_unsupported_credentials:"יש לו פנים או טביעת אצבע בעמדה",imp_unmanaged_lock:"מורשה לדלת שאינה מנוהלת",imp_schedule_unverified:"יש לו לוח זמנים שאי אפשר לאמת",imp_pin_device_managed:"הקוד מנוהל בעמדה עצמה",imp_local_validity_needs_conversion:"התוקף רשום בשעון מקומי",imp_device_user_missing:"כבר לא נמצא בעמדה",imp_ignored:"מוסתר בכל העמדות",imp_review_stale:"השתנה מאז הקריאה - רעננו",imp_unknown:"סיבה לא מוכרת",dup_strip:"ייתכן שיש אנשים שרשומים פעמיים ({n} קבוצות)",dup_show:"הצגה",dup_hide:"הסתרה",dup_name:"אותו שם",dup_phone:"אותו טלפון",dup_profile:"אותו ערך ב{label}",dup_more:"ועוד {n}",dup_partial:"הרשימה חלקית.",dup_resolve:"פתחו כל אדם, בדקו אם זה אותו אדם, ותקנו או מחקו את הרשומה הכפולה.",pin_checking:"בודק אם הקוד פנוי…",pin_free:"הקוד פנוי כרגע (ייבדק שוב בשמירה).",pin_taken:"הקוד הזה כבר בשימוש אצל אדם אחר. בחרו קוד אחר או צרו קוד פנוי.",pin_check_failed:"לא ניתן היה לבדוק את הקוד כרגע. הוא ייבדק בשמירה.",pin_check_limited:"יותר מדי בדיקות קוד בזמן קצר. הקוד ייבדק בשמירה."};function f(e,t){const s=fe[e]??e;return t?s.replace(/\{(\w+)\}/g,(i,a)=>a in t?String(t[a]):i):s}function ki(e,t){return e in fe?fe[e]:fe[t]}var xi=Object.defineProperty,zi=Object.getOwnPropertyDescriptor,z=(e,t,s,i)=>{for(var a=i>1?void 0:i?zi(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&xi(t,s,a),a};function Ci(e){try{return new Intl.DateTimeFormat("en-US",{timeZone:e}),!0}catch{return!1}}function Si(){const e=new Uint32Array(1);return crypto.getRandomValues(e),String(1e8+e[0]%9e8)}let Ei=0;const Pi=()=>`row-${++Ei}`;function Ti(e){const t=e.replace(/\D/g,"");return/^05\d{8}$/.test(t)&&/^[\d\s()-]*$/.test(e)?`${t.slice(0,3)}-${t.slice(3,6)}-${t.slice(6)}`:e}let k=class extends W{constructor(){super(...arguments),this.userId="",this.ctx=null,this.ctxNote="",this.original=null,this.draft=null,this.loadError="",this.loading=!0,this.timed=!1,this.validityFrom="",this.validityUntil="",this.busy="",this.error="",this.errorCode="",this.errorTone="err",this.outcome="",this.pinStatus="",this.pinReveal=null,this.pinCopy="",this.pinCheck="",this.pinCheckSeq=0,this.confirmDelete=!1,this.confirmClose=!1,this.capturing=!1,this.notice="",this.sensitive=!0,this.cardsKnown=!0,this.baseline="",this.generation=0,this.onKey=e=>{e.key==="Escape"&&!this.confirmDelete&&!this.confirmClose&&!this.capturing&&this.requestClose()}}connectedCallback(){super.connectedCallback(),this.load(),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),this.generation++}get zone(){return this.ctx?.default_zone??ee}get isNew(){return!this.userId}async load(){const e=++this.generation;this.loading=!0,this.loadError="";try{const[t,s]=await Promise.all([ut(),this.isNew?null:we(this.userId)]);if(e!==this.generation)return;if(t.context?this.ctx=t.context:this.ctxNote=t.state==="unsupported"?"בקרת הכניסה המותקנת אינה מכירה את הפקודות הנדרשות.":`נתוני התחנות לא נטענו (${t.last_error??t.state}).`,this.isNew)this.edit(null);else{if(!s?.person){this.loadError=`הרשומה לא נטענה (${s?.last_error??s?.state??"error"}).`;return}this.edit(s.person)}}catch(t){if(e!==this.generation)return;this.loadError=t instanceof $&&t.code==="intercom_person_not_found"?"האדם הזה לא נמצא (ייתכן שנמחק).":t instanceof $&&t.code==="intercom_person_scope"?h("err.scope"):U(t)}finally{e===this.generation&&(this.loading=!1)}}edit(e){this.original=e,this.pinStatus="",this.hidePin(),this.notice="",this.error="",this.errorCode="",this.outcome="";const t=this.zone.kind==="iana"?this.zone.name:"UTC";if(e){this.sensitive=e.level!=="names",this.cardsKnown=e.cards!==null;const s=e.access_category==="visitor"||e.access_category==="contractor"?e.access_category:"staff";this.draft={employee_no:e.employee_no??"",display_name:e.display_name,phone:e.phone??"",active:e.active,confirm_pin:"",cards:(e.cards??[]).map(i=>({key:i.id,id:i.id,masked_number:i.masked_number,card_no:"",label:i.label,enabled:i.enabled})),assignments:Object.fromEntries(e.stations.map(i=>[i.station_id,{enabled:i.enabled,allowed_locks:[...i.doors],sync_state:i.sync_state}])),overrides:{...e.permission_overrides},category:s,responsible:e.responsible_person??"",purpose:e.access_purpose??"",timing:Oe(e,t)},this.timed=!!e.valid_from,this.validityFrom=Fe(e.valid_from,this.zone),this.validityUntil=Fe(e.valid_until,this.zone)}else this.sensitive=!D()||ye("access.people.sensitive"),this.cardsKnown=!0,this.draft={employee_no:Si(),display_name:"",phone:"",active:!0,confirm_pin:"",cards:[],assignments:{},overrides:{},category:"staff",responsible:"",purpose:"",timing:Oe(null,t)},this.timed=!1,this.validityFrom="",this.validityUntil="";this.baseline=this.snapshot()}snapshot(){return JSON.stringify([this.draft,this.timed,this.validityFrom,this.validityUntil])}get dirty(){return!!this.draft&&this.snapshot()!==this.baseline}patch(e,t){this.draft&&(this.draft={...this.draft,[e]:t})}pinBlocked(){return!this.draft||!this.ctx?!1:this.ctx.stations.some(e=>this.draft.assignments[e.id]?.enabled&&e.pin_writable===!1)}async generatePin(){if(!(!this.draft||this.busy)){this.busy="pin",this.pinStatus="",this.hidePin(),this.error="";try{const e=await qt(this.userId);e.pin?(this.draft={...this.draft,pin:e.pin.pin,confirm_pin:e.pin.pin},this.pinStatus="generated",this.pinCheck="",this.pinReveal=e.pin.pin):(this.pinStatus="failed",this.setError(e.last_error==="pin_generation_failed"?p("pin_generation_failed"):`${p("pin_generation_failed")} (${e.last_error??e.state})`,"err",e.last_error??e.state))}catch(e){this.pinStatus="failed",this.setError(U(e),"err",e instanceof $?e.code:"error")}finally{this.busy=""}}}async copyPin(){const e=this.pinReveal;if(e)try{if(!navigator.clipboard?.writeText)throw new Error("clipboard unavailable");if(await navigator.clipboard.writeText(e),this.pinReveal!==e)return;this.pinReveal=null,this.pinCopy="copied"}catch{this.pinReveal===e&&(this.pinCopy="manual")}}hidePin(){this.pinReveal=null,this.pinCopy=""}async checkPinFree(){const e=this.draft?.pin,t=++this.pinCheckSeq;if(!D()||!ye("access.people.sensitive")||!$i(e)){this.pinCheck="";return}this.pinCheck="checking";try{const s=await mi(this.userId,e);if(t!==this.pinCheckSeq)return;this.pinCheck=s.available===!0?"free":s.available===!1?"taken":"failed"}catch(s){if(t!==this.pinCheckSeq)return;this.pinCheck=s instanceof $&&s.status===429?"limited":"failed"}}readValidity(){const e=Be(this.validityFrom,this.zone,this.original?.valid_from??void 0),t=Be(this.validityUntil,this.zone,this.original?.valid_until??void 0);if(!e||!t)throw new Error("invalid_validity");return{from:e,until:t}}setError(e,t,s="",i=""){this.error=e,this.errorTone=t,this.errorCode=s,this.outcome=i}async save(e){const t=this.draft;if(!t||this.busy)return;this.hidePin(),this.error="",this.errorCode="",this.outcome="";let s=null;if(this.timed)try{s=this.readValidity()}catch(g){this.setError(p(g.message),"err",g.message);return}if(t.pin&&t.pin!==t.confirm_pin){this.setError(p("pin_mismatch"),"err","pin_mismatch");return}if(s&&Date.parse(s.from)>=Date.parse(s.until)){this.setError(p("invalid_validity"),"err","invalid_validity");return}const i=this.renderRoot.querySelector("form");if(i&&!i.reportValidity()){this.setError(p("field_required"),"err","field_required");return}const a=this.zone.kind==="iana"?this.zone.name:"UTC",d=Hs(t.timing,Ci);if(d){this.setError(h(d),"err",d);return}const o=this.sensitive?Js(t.category,t.responsible,!!s):null;if(o){this.setError(h(o),"err",o);return}const m={display_name:t.display_name,active:t.active,valid_from:s?s.from:null,valid_until:s?s.until:null,permission_overrides:{...t.overrides},door_permissions:Object.fromEntries(Object.entries(t.assignments).filter(([,g])=>g.enabled).map(([g,x])=>[g,[...x.allowed_locks].sort()])),...Xs(t.timing,this.original,a)};(this.isNew||this.original?.employee_no!==null)&&(m.employee_no=t.employee_no),(this.isNew||t.category!==(this.original?.access_category??"staff"))&&(m.access_category=t.category),this.sensitive&&(m.phone=t.phone??"",(this.isNew||t.responsible!==(this.original?.responsible_person??""))&&(m.responsible_person=t.responsible),(this.isNew||t.purpose!==(this.original?.access_purpose??""))&&(m.access_purpose=t.purpose),this.cardsKnown&&(m.cards=t.cards.map(g=>g.id?{id:g.id,label:g.label,enabled:g.enabled}:{card_no:g.card_no,label:g.label,enabled:g.enabled})),t.pin!==void 0&&(m.pin=t.pin)),typeof this.ctx?.profile_policy?.revision=="number"&&(m.access_policy_revision=this.ctx.profile_policy.revision),this.busy=e?"sync":"save";try{const g=this.isNew?await Nt(m,e):await Mt(this.userId,this.original?.revision??0,m,e);if(!g.person)throw new Error("empty reply");this.draft=null,this.dispatchEvent(new CustomEvent("editor-saved",{detail:{person:g.person,notice:e?"saved_sync":"saved",note:g.note,pending:Pe(g)==="pending"},bubbles:!0,composed:!0}))}catch(g){this.showFailure(g)}finally{this.busy=""}}showFailure(e){const t=pe(e),s=e instanceof $?e.code:"error";if(t==="unknown"){this.setError(h("res.unknown"),"warn",s,"unknown");return}const i={intercom_person_scope:"err.scope",intercom_field_level:"err.field",intercom_approval_required:"err.approval",intercom_person_archived:"err.archived",intercom_responsible_required:"err.guest",intercom_pin_interactive_only:"err.pin_interactive",intercom_busy:"err.busy",intercom_rate_limited:"err.busy",intercom_unavailable:"err.unavailable",intercom_duplicate_command:"err.duplicate",expired:"err.expired"};s==="intercom_pin_conflict"?this.setError(p("pin_conflict"),"err",s,t):s==="intercom_revision_conflict"?this.setError(p("revision_conflict"),"err",s,t):s==="intercom_card_conflict"?this.setError(p("card_conflict"),"err",s,t):s==="intercom_employee_conflict"?this.setError(p("employee_conflict"),"err",s,t):i[s]?this.setError(h(i[s]),"err",s,t):this.setError(U(e),"err",s,t)}async reload(){this.isNew||(this.loading=!0,this.draft=null,await this.load())}askDelete(){if(this.dirty){this.setError(p("profile_save_first"),"err","profile_save_first");return}this.confirmDelete=!0}async doDelete(){const e=this.original;if(!(!e||this.busy)){this.busy="delete",this.error="";try{const t=await ht(e.id,e.revision??0);this.confirmDelete=!1,this.draft=null,this.dispatchEvent(new CustomEvent("editor-deleted",{detail:{id:e.id,notice:"deleted",note:t.note,pending:Pe(t)==="pending"},bubbles:!0,composed:!0}))}catch(t){this.confirmDelete=!1,this.showFailure(t)}finally{this.busy=""}}}requestClose(){if(!this.busy){if(this.dirty){this.confirmClose=!0;return}this.close()}}close(){this.draft=null,this.hidePin(),this.dispatchEvent(new CustomEvent("editor-close",{bubbles:!0,composed:!0}))}setStation(e,t){if(!this.draft)return;const s=this.draft.assignments[e],i=s?.allowed_locks.length?s.allowed_locks:[1];this.draft={...this.draft,assignments:{...this.draft.assignments,[e]:{enabled:t,allowed_locks:i,sync_state:s?.sync_state??null}},overrides:{...this.draft.overrides,[e]:t?"allow":"deny"}}}setLock(e,t,s){if(!this.draft)return;const i=this.draft.assignments[e];if(!i)return;const a=s?[...i.allowed_locks,t].sort():i.allowed_locks.filter(d=>d!==t);a.length?this.patch("assignments",{...this.draft.assignments,[e]:{...i,allowed_locks:a}}):this.setStation(e,!1)}setAll(e){if(!this.draft||!this.ctx)return;const t={...this.draft.assignments},s={...this.draft.overrides};for(const i of this.ctx.stations){if(!i.lock_enabled)continue;const a=t[i.id];t[i.id]={enabled:e,allowed_locks:a?.allowed_locks.length?a.allowed_locks:[1],sync_state:a?.sync_state??null},s[i.id]=e?"allow":"deny"}this.draft={...this.draft,assignments:t,overrides:s}}render(){const e=this.isNew?"new":"edit";return n`<div class="backdrop" data-wiskey-editor data-wiskey-editor-mode=${e} @click=${t=>t.target===t.currentTarget&&this.requestClose()}>
      <div class="pane" role="dialog" aria-modal="true" aria-label=${p(this.isNew?"add_user":"edit_user")}>
        <header>
          <div>
            <h3>${p(this.isNew?"add_user":"edit_user")}</h3>
            <div class="sub" data-wiskey-editor-heading>${this.draft?.display_name||(this.isNew?p("new_person_heading"):"")} · ${p("editor_intro")}</div>
          </div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${p("cancel")} data-wiskey-editor-cancel @click=${()=>this.requestClose()}></sw-button>
        </header>
        <div class="body">${this.renderBody()}</div>
        ${this.draft?this.renderFooter():l}
      </div>
      ${this.confirmDelete?this.renderDeleteConfirm():l}
      ${this.confirmClose?this.renderCloseConfirm():l}
      ${this.capturing&&this.original&&this.ctx?n`<wiskey-card-capture
            .person=${this.original}
            .stations=${this.captureStations()}
            @capture-close=${()=>this.capturing=!1}
            @capture-saved=${t=>this.captured(t.detail.person,t.detail.note)}
            @capture-reload=${()=>{this.capturing=!1,this.reload()}}
          ></wiskey-card-capture>`:l}
    </div>`}renderBody(){if(this.loading&&!this.draft)return n`<sw-state-panel state="loading"></sw-state-panel>`;if(this.loadError||!this.draft)return n`<sw-state-panel data-wiskey-editor-load-error state="error" heading="לא ניתן לפתוח את העורך" hint=${this.loadError||"הרשומה לא נטענה."}></sw-state-panel>
        <div class="row"><sw-button size="sm" icon="refresh" data-wiskey-editor-retry ?disabled=${this.loading} @click=${()=>void this.load()}>נסו שוב</sw-button></div>`;const e=this.draft,t=this.ctx,s=this.pinBlocked();return n`
      ${this.renderContextNotes()}
      ${this.notice?n`<div class="note info" role="status" data-wiskey-editor-notice><sw-icon name="check" size=${16}></sw-icon><span>${this.notice}</span></div>`:l}
      ${this.error?this.renderError():l}
      <form @submit=${i=>i.preventDefault()}>
        <p class="hint">${p("save_hint")}</p>
        <div class="columns">
          <div class="column">
            <fieldset data-wiskey-editor-section="person">
              <legend><sw-icon name="user" size=${16}></sw-icon>${p("person_details")}</legend>
              <div class="grid2">
                <sw-field label=${p("name")}>
                  <input required autofocus maxlength="32" data-wiskey-editor-name .value=${b(e.display_name)} @input=${i=>this.patch("display_name",i.target.value)} />
                </sw-field>
                <sw-field label=${p("employee_id")} hint=${this.original?.identity_locked?p("employee_locked"):""}>
                  <input required pattern="[A-Za-z0-9_-]{1,32}" maxlength="32" data-ltr data-wiskey-editor-employee .value=${b(e.employee_no)} ?disabled=${!!this.original?.identity_locked} @input=${i=>this.patch("employee_no",i.target.value)} />
                </sw-field>
              </div>
              ${this.sensitive?n`<sw-field label=${p("phone")}>
                    <input type="tel" autocomplete="tel" maxlength="32" data-ltr placeholder="05X-xxx-xxxx" data-wiskey-editor-phone .value=${b(e.phone)} @input=${i=>this.patch("phone",Ti(i.target.value))} />
                  </sw-field>`:l}
              <label class="check"><input type="checkbox" data-wiskey-editor-active .checked=${b(e.active)} ?disabled=${!!this.original?.archived} @change=${i=>this.patch("active",i.target.checked)} />${p("active")}</label>
            </fieldset>
            ${this.renderCategory()}
            ${this.isNew?l:this.renderActions()}
            ${this.renderValidity()}
            ${this.renderTiming()}
            ${this.sensitive?this.renderPin(s):l}
          </div>
          <div class="column">
            ${this.sensitive&&this.cardsKnown?this.renderCards():l}
            ${t?this.renderAssignments(t):n`<fieldset data-wiskey-editor-section="assignments"><legend>${p("assignments")}</legend><p class="muted">${this.ctxNote||"רשימת התחנות לא נטענה, ולכן אי אפשר לערוך הרשאות לתחנות כאן."}</p></fieldset>`}
          </div>
        </div>
      </form>
    `}renderContextNotes(){const e=this.ctx,t=[];return e&&(e.writes_listed===!1||e.users_manage===!1)?t.push(n`<div class="note err" role="alert" data-wiskey-editor-note="no_users_manage">חשבון המערכת אינו מורשה לנהל אנשים בבקרת הכניסה. שמירה תידחה.</div>`):e&&e.writes_listed===null&&t.push(n`<div class="note info" role="note" data-wiskey-editor-note="writes_unverified">לא ידוע אם חשבון המערכת מורשה לנהל אנשים; דחייה תוצג כאן.</div>`),this.ctxNote&&t.push(n`<div class="note warn" role="status" data-wiskey-editor-note="context">${this.ctxNote}</div>`),e?.profile_policy&&(e.profile_policy.fields||e.profile_policy.groups)&&t.push(n`<div class="note info" role="note" data-wiskey-editor-note="profile">שדות פרופיל וקבוצות נערכים בחלון האינטרקום. ביטול סימון של תחנה שמגיעה מקבוצה חוסם אותה לאדם הזה.</div>`),t}renderCategory(){const e=this.draft,t=e.category!=="staff";return n`<fieldset data-wiskey-editor-section="category">
      <legend><sw-icon name="users" size=${16}></sw-icon>${h("cat.label")}</legend>
      <sw-field label=${h("cat.field")}>
        <select data-wiskey-editor-category .value=${b(e.category)} @change=${s=>this.patch("category",s.target.value)}>
          ${["staff","visitor","contractor"].map(s=>n`<option value=${s} ?selected=${s===e.category}>${h(`cat.${s}`)}</option>`)}
        </select>
      </sw-field>
      ${t&&this.sensitive?n`<div class="grid2">
            <sw-field label=${h("cat.responsible")}>
              <input maxlength="64" data-wiskey-editor-responsible .value=${b(e.responsible)} @input=${s=>this.patch("responsible",s.target.value)} />
            </sw-field>
            <sw-field label=${h("cat.purpose")}>
              <input maxlength="128" data-wiskey-editor-purpose .value=${b(e.purpose)} @input=${s=>this.patch("purpose",s.target.value)} />
            </sw-field>
          </div>`:l}
    </fieldset>`}setTiming(e){this.draft&&this.patch("timing",{...this.draft.timing,...e})}renderTiming(){const e=this.draft.timing,t=e.enforce==="native";return n`<fieldset data-wiskey-editor-section="timing" data-wiskey-editor-timing-mode=${e.mode}>
      <legend><sw-icon name="clock" size=${16}></sw-icon>${h("timing.heading")}</legend>
      ${t?n`<p class="muted" data-wiskey-editor-timing-native>${h("timing.native_locked")}</p>`:n`<div class="grid2">
            <sw-field label=${h("timing.mode")}>
              <select data-wiskey-editor-timing-select .value=${b(e.mode)} @change=${s=>this.setTiming({mode:s.target.value})}>
                <option value="none" ?selected=${e.mode==="none"}>${h("timing.none")}</option>
                <option value="weekly" ?selected=${e.mode==="weekly"}>${h("timing.weekly")}</option>
                <option value="dates" ?selected=${e.mode==="dates"}>${h("timing.dates")}</option>
              </select>
            </sw-field>
            ${e.mode==="none"?l:n`<sw-field label=${h("timing.enforce")}>
                  <select data-wiskey-editor-timing-enforce .value=${b(e.enforce)} @change=${s=>this.setTiming({enforce:s.target.value})}>
                    <option value="draft" ?selected=${e.enforce==="draft"}>${h("timing.enforce_draft")}</option>
                    <option value="ha" ?selected=${e.enforce==="ha"}>${h("timing.enforce_ha")}</option>
                  </select>
                </sw-field>`}
          </div>
          ${e.mode==="weekly"?n`<div class="days" role="group" aria-label=${h("timing.days")} data-wiskey-editor-timing-days>
                ${Ws.map(s=>n`<label class="check day"><input type="checkbox" data-timing-day=${s} .checked=${b(e.days.includes(s))}
                  @change=${i=>this.setTiming({days:i.target.checked?[...e.days,s]:e.days.filter(a=>a!==s)})} />${h(`day.${s}`)}</label>`)}
              </div>`:l}
          ${e.mode==="dates"?n`<div class="dates" role="group" aria-label=${h("timing.dates_label")} data-wiskey-editor-timing-dates>
                ${e.dates.map((s,i)=>n`<div class="row"><input type="date" lang=${Z()} data-timing-date=${i} min="2000-01-01" max="2037-12-31" .value=${b(s)}
                    @change=${a=>this.setTiming({dates:e.dates.map((d,o)=>o===i?a.target.value:d)})} />
                  <sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${p("remove")} @click=${()=>this.setTiming({dates:e.dates.filter((a,d)=>d!==i)})}></sw-button></div>`)}
                <sw-button size="sm" icon="plus" data-timing-add-date ?disabled=${e.dates.length>=bt} @click=${()=>this.setTiming({dates:[...e.dates,""]})}>${h("timing.add_date")}</sw-button>
              </div>`:l}
          ${e.mode==="none"?l:n`<div class="periods" role="group" aria-label=${h("timing.periods")} data-wiskey-editor-timing-periods>
                ${e.periods.map((s,i)=>n`<div class="row period" data-timing-period=${i}>
                  <sw-field label=${h("timing.from")}><input type="time" lang=${Z()} data-timing-start .value=${b(s.start)}
                    @change=${a=>this.setTiming({periods:e.periods.map((d,o)=>o===i?{...d,start:a.target.value}:d)})} /></sw-field>
                  <sw-field label=${h("timing.to")}><input type="time" lang=${Z()} data-timing-end .value=${b(s.end==="24:00"?"23:59":s.end)}
                    @change=${a=>this.setTiming({periods:e.periods.map((d,o)=>o===i?{...d,end:a.target.value}:d)})} /></sw-field>
                  ${e.periods.length>1?n`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${p("remove")} @click=${()=>this.setTiming({periods:e.periods.filter((a,d)=>d!==i)})}></sw-button>`:l}
                </div>`)}
                <sw-button size="sm" icon="plus" data-timing-add-period ?disabled=${e.periods.length>=_t} @click=${()=>this.setTiming({periods:[...e.periods,{start:"08:00",end:"17:00"}]})}>${h("timing.add_period")}</sw-button>
                <sw-field label=${h("timing.zone")}><input data-ltr data-timing-zone maxlength="128" .value=${b(e.timezone)} @input=${s=>this.setTiming({timezone:s.target.value.trim()})} /></sw-field>
              </div>`}`}
    </fieldset>`}renderActions(){return n`<fieldset data-wiskey-editor-section="actions">
      <legend>${p("user_more_actions")}</legend>
      <div class="row">
        <sw-button variant="danger" size="sm" icon="trash" data-wiskey-editor-delete ?disabled=${!!this.busy} @click=${()=>this.askDelete()}>${p("delete")}</sw-button>
      </div>
      <p class="muted">${p("profile_save_first")}</p>
    </fieldset>`}renderValidity(){return n`<fieldset data-wiskey-editor-section="validity">
      <legend><sw-icon name="calendar" size=${16}></sw-icon>${p("validity")}</legend>
      <sw-field label=${p("user_timing_mode")}>
        <select data-wiskey-editor-validity-mode .value=${b(this.timed?"period":"always")} @change=${e=>this.timed=e.target.value==="period"}>
          <option value="always">${p("permanent")}</option>
          <option value="period">${p("period")}</option>
        </select>
      </sw-field>
      ${this.timed?n`<div class="grid2">
              <sw-field label=${p("valid_from")}>
                <input required type="datetime-local" lang=${Z()} data-wiskey-editor-valid-from .value=${b(this.validityFrom)} @input=${e=>this.validityFrom=e.target.value} />
              </sw-field>
              <sw-field label=${p("valid_until")}>
                <input required type="datetime-local" lang=${Z()} data-wiskey-editor-valid-until .value=${b(this.validityUntil)} @input=${e=>this.validityUntil=e.target.value} />
              </sw-field>
            </div>
            <p class="muted">${p("clock_ha_zone")}: <bdi>${this.zone.name}</bdi>. ${p("validity_hint")}</p>`:n`<p class="muted">${p("permanent")}</p>`}
    </fieldset>`}renderPin(e){const t=this.draft,s=!!this.original?.pin_configured,i=t.pin===null;return n`<fieldset data-wiskey-editor-section="pin" data-wiskey-editor-pin-configured=${String(s)}>
      <legend><sw-icon name="lock" size=${16}></sw-icon>${p("pin")} · ${p(s?"configured":"not_configured")}</legend>
      <p class="muted">${p("pin_private")}</p>
      ${e?n`<p class="danger" data-wiskey-editor-pin-blocked>${p("pin_mode_blocked")}</p>`:l}
      <div class="grid2">
        <sw-field label=${p("new_pin")}>
          <input type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]*" maxlength="128" data-ltr data-wiskey-editor-pin .value=${b(t.pin??"")} ?disabled=${e||i} @input=${a=>{this.hidePin(),this.pinCheckSeq++,this.pinCheck="",this.patch("pin",a.target.value||void 0)}} @change=${()=>void this.checkPinFree()} />
        </sw-field>
        <sw-field label=${p("confirm_pin")}>
          <input type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]*" maxlength="128" data-ltr data-wiskey-editor-pin-confirm .value=${b(t.confirm_pin)} ?disabled=${e||i} @input=${a=>{this.hidePin(),this.patch("confirm_pin",a.target.value)}} />
        </sw-field>
      </div>
      <div aria-live="polite" data-wiskey-editor-pin-status=${this.pinStatus}>
        ${this.pinCheck==="checking"?n`<p class="muted" data-wiskey-editor-pin-check="checking">${f("pin_checking")}</p>`:l}
        ${this.pinCheck==="free"?n`<p class="ok" data-wiskey-editor-pin-check="free">${f("pin_free")}</p>`:l}
        ${this.pinCheck==="taken"?n`<p class="danger" data-wiskey-editor-pin-check="taken">${f("pin_taken")}</p>`:l}
        ${this.pinCheck==="failed"?n`<p class="muted" data-wiskey-editor-pin-check="failed">${f("pin_check_failed")}</p>`:l}
        ${this.pinCheck==="limited"?n`<p class="muted" data-wiskey-editor-pin-check="limited">${f("pin_check_limited")}</p>`:l}
        ${this.pinStatus==="generated"?n`<p class="ok">נוצר קוד פנוי ומולא בשני השדות. הוא אינו שמור עדיין - הוא ייבדק שוב בשמירה.</p>`:l}
        ${this.pinReveal?n`<div class="reveal" data-wiskey-editor-pin-reveal>
              <span>הקוד שנוצר (מוצג פעם אחת, כדי למסור אותו):</span>
              <bdi class="pin" data-ltr data-wiskey-editor-pin-reveal-value>${this.pinReveal}</bdi>
              <sw-button size="sm" icon="check" data-wiskey-editor-pin-copy @click=${()=>void this.copyPin()}>העתק</sw-button>
              <sw-button size="sm" variant="ghost" icon="eye" data-wiskey-editor-pin-hide @click=${()=>this.hidePin()}>הסתר</sw-button>
            </div>`:l}
        ${this.pinCopy==="copied"?n`<p class="ok" data-wiskey-editor-pin-copied>הקוד הועתק ללוח והוסתר.</p>`:l}
        ${this.pinCopy==="manual"?n`<p class="danger" data-wiskey-editor-pin-copy-failed>העתקה אוטומטית אינה זמינה בדפדפן הזה (למשל בחיבור שאינו מאובטח). סמנו את הקוד והעתיקו ידנית, ואז לחצו "הסתר".</p>`:l}
      </div>
      <div class="row">
        ${this.ctx?.pin_generate===!1?l:n`<sw-button size="sm" data-wiskey-editor-pin-generate ?disabled=${e||i||!!this.busy} @click=${()=>void this.generatePin()}>${this.busy==="pin"?p("wait"):p("generate_unique_pin")}</sw-button>`}
        ${i?n`<sw-badge kind="stale" label=${p("remove_pin")}></sw-badge>
              <sw-button size="sm" variant="ghost" data-wiskey-editor-pin-keep @click=${()=>{this.draft={...t,pin:void 0,confirm_pin:""},this.pinStatus="",this.hidePin()}}>${p("keep_pin")}</sw-button>`:n`<sw-button size="sm" variant="danger" data-wiskey-editor-pin-remove ?disabled=${e||!s} @click=${()=>{this.draft={...t,pin:null,confirm_pin:""},this.pinStatus="",this.hidePin()}}>${p("remove_pin")}</sw-button>`}
      </div>
      <p class="muted">${p("pin_physical")} קוד תפוס יידחה בשמירה.</p>
    </fieldset>`}renderCards(){const e=this.draft;return n`<fieldset data-wiskey-editor-section="cards">
      <legend><sw-icon name="grid" size=${16}></sw-icon>${p("cards")}</legend>
      ${le(e.cards,t=>t.key,t=>n`<div class="card-row" data-wiskey-editor-card=${t.id?"saved":"new"}>
          <div class="grid2">
            <sw-field label=${p("card_label")}>
              <input maxlength="64" data-wiskey-editor-card-label .value=${b(t.label)} @input=${s=>this.editCard(t.key,{label:s.target.value})} />
            </sw-field>
            <sw-field label=${p("card_number")} hint=${t.id?p("masked"):""}>
              ${t.id?n`<input readonly data-ltr data-wiskey-editor-card-masked .value=${t.masked_number??"••••"} aria-label=${p("masked")} />`:n`<input required pattern="[A-Za-z0-9_-]+" maxlength="32" autocomplete="off" data-ltr data-wiskey-editor-card-number .value=${b(t.card_no)} @input=${s=>this.editCard(t.key,{card_no:s.target.value})} />`}
            </sw-field>
          </div>
          <div class="row between">
            <label class="check"><input type="checkbox" data-wiskey-editor-card-enabled .checked=${b(t.enabled)} @change=${s=>this.editCard(t.key,{enabled:s.target.checked})} />${p("active")} · ${p("normal_card")}</label>
            <sw-button size="sm" variant="ghost" icon="trash" data-wiskey-editor-card-remove @click=${()=>this.patch("cards",e.cards.filter(s=>s.key!==t.key))}>${p("remove")}</sw-button>
          </div>
        </div>`)}
      <div class="row">
        <sw-button size="sm" icon="plus" data-wiskey-editor-card-add @click=${()=>this.patch("cards",[...e.cards,{key:Pi(),card_no:"",label:"",enabled:!0}])}>${p("add_card")}</sw-button>
      </div>
      ${this.renderCapture()}
      <p class="muted">מספר כרטיס שמור מוצג ממוסך; המספר המלא אינו זמין לאחר השמירה.</p>
    </fieldset>`}captureStations(){const e=this.ctx?.capture_stations;return(this.ctx?.stations??[]).filter(t=>e===void 0||e.includes(t.id))}renderCapture(){if(!D())return l;if(!ye("access.cards.capture"))return l;const e=this.captureStations().some(t=>t.lock_enabled&&t.online);return n`<div class="capture" data-wiskey-editor-capture>
      <sw-button size="sm" icon="wifi" data-wiskey-editor-capture-open ?disabled=${!!this.busy||this.isNew||!this.ctx||!e} @click=${()=>this.openCapture()}>${p("capture_card")}</sw-button>
      <p class="muted">${p(this.isNew?"capture_save_user_first":"capture_from_editor_hint")}${!this.isNew&&this.ctx&&!e?" אין כרגע אינטרקום מחובר עם מנעול מנוהל.":""}</p>
    </div>`}openCapture(){if(!(this.busy||this.isNew||!this.original)){if(this.dirty){this.setError(p("profile_save_first"),"err","profile_save_first");return}this.notice="",this.setError("","err"),this.capturing=!0}}captured(e,t){this.capturing=!1;const s=this.original?.cards?.length??0;this.edit(e),this.notice=h("res.pending"),this.userId&&we(this.userId).then(i=>{!i.person||!this.isConnected||(this.edit(i.person),this.notice=(i.person.cards?.length??0)>s?p("capture_state_confirmed"):h("res.still_pending"))}).catch(()=>{})}editCard(e,t){this.draft&&this.patch("cards",this.draft.cards.map(s=>s.key===e?{...s,...t}:s))}renderAssignments(e){const t=this.draft,s=Object.values(t.assignments).filter(i=>i.enabled).length;return n`<fieldset data-wiskey-editor-section="assignments">
      <legend><sw-icon name="door" size=${16}></sw-icon>${p("assignments")}</legend>
      <div class="row">
        <sw-button size="sm" variant="ghost" data-wiskey-editor-stations-all @click=${()=>this.setAll(!0)}>${p("select_all_stations")}</sw-button>
        <sw-button size="sm" variant="ghost" data-wiskey-editor-stations-clear @click=${()=>this.setAll(!1)}>${p("clear_stations")}</sw-button>
        <span class="muted" data-wiskey-editor-stations-count=${s}>${p("selected_stations")}: ${s}</span>
      </div>
      ${e.stations.length?l:n`<p class="muted">${p("no_stations")}</p>`}
      ${e.stations.map(i=>{const a=t.assignments[i.id],d=!!a?.enabled,o=d&&a?sa(a.sync_state??"pending"):null;return n`<div class="station" data-wiskey-editor-station=${i.id} data-wiskey-editor-station-enabled=${String(d)}>
          <label class="check">
            <input type="checkbox" data-wiskey-editor-station-toggle .checked=${b(d)} ?disabled=${!i.lock_enabled} @change=${m=>this.setStation(i.id,m.target.checked)} />
            <b>${i.name}</b>
          </label>
          <sw-badge kind=${i.online?"recorded":"offline"} label=${p(i.online?"online":"offline")}></sw-badge>
          <span class="muted">${i.lock_enabled?`${p("station_access")}${i.locks.length===1&&i.locks[0].name?` · ${i.locks[0].name}`:""}`:p("camera_only")}</span>
          ${d&&i.locks.length>1?n`<div class="locks">
                ${i.locks.map(m=>n`<label class="check"><input type="checkbox" data-wiskey-editor-lock=${m.physical_index} .checked=${b(a.allowed_locks.includes(m.physical_index))} @change=${g=>this.setLock(i.id,m.physical_index,g.target.checked)} />${m.name||`${p("physical_lock")} ${m.physical_index}`}</label>`)}
              </div>`:l}
          ${o?n`<sw-badge kind=${o.kind} label=${o.label}></sw-badge>`:l}
        </div>`})}
    </fieldset>`}renderError(){const e=this.outcome==="unknown",t=this.errorCode==="intercom_revision_conflict";return n`<div class="note ${this.errorTone}" role="alert" data-wiskey-editor-error data-wiskey-editor-error-code=${this.errorCode} data-wiskey-editor-outcome=${this.outcome}>
      <sw-icon name=${e?"warning":"info"} size=${16}></sw-icon>
      <span>${this.error}${e&&!this.isNew?" טענו מחדש את הרשומה והשוו את הגרסה לפני ניסיון נוסף.":""}${e&&this.isNew?" חפשו את מזהה העובד בספריית האנשים לפני שיוצרים שוב.":""}${this.errorCode==="intercom_pin_conflict"?` אפשר ללחוץ על "${p("generate_unique_pin")}".`:""}</span>
      ${(t||e)&&!this.isNew?n`<sw-button size="sm" variant="ghost" icon="refresh" data-wiskey-editor-reload @click=${()=>void this.reload()}>טען מחדש את הרשומה</sw-button>`:l}
    </div>`}renderFooter(){const e=!!this.busy,t=e||this.ctx?.writes_listed===!1||this.ctx?.users_manage===!1;return n`<footer>
      <sw-button variant="ghost" data-wiskey-editor-cancel-footer ?disabled=${e} @click=${()=>this.requestClose()}>${p("cancel")}</sw-button>
      <sw-button data-wiskey-editor-save ?disabled=${t} @click=${()=>void this.save(!1)}>${this.busy==="save"?p("wait"):p("save")}</sw-button>
      <sw-button variant="primary" icon="check" data-wiskey-editor-save-sync ?disabled=${t} @click=${()=>void this.save(!0)}>${this.busy==="sync"?p("wait"):p("save_sync")}</sw-button>
    </footer>`}renderDeleteConfirm(){const e=this.original,t=Object.keys(this.draft?.assignments??{}).length;return n`<sw-dialog open heading=${p("delete")} subheading=${e.display_name} data-wiskey-editor-delete-dialog @close=${()=>this.confirmDelete=!1}>
      <p>${p("confirm_delete").replace("{count}",String(t))}</p>
      <div slot="footer">
        <sw-button variant="ghost" @click=${()=>this.confirmDelete=!1}>${p("cancel")}</sw-button>
        <sw-button variant="danger" icon="trash" data-wiskey-editor-delete-confirm ?disabled=${!!this.busy} @click=${()=>void this.doDelete()}>${this.busy==="delete"?p("wait"):p("delete")}</sw-button>
      </div>
    </sw-dialog>`}renderCloseConfirm(){return n`<sw-dialog open heading="שינויים שלא נשמרו" data-wiskey-editor-close-dialog @close=${()=>this.confirmClose=!1}>
      <p>יש בטופס שינויים שלא נשמרו. לסגור בלי לשמור?</p>
      <div slot="footer">
        <sw-button variant="ghost" @click=${()=>this.confirmClose=!1}>חזרה לעריכה</sw-button>
        <sw-button variant="danger" data-wiskey-editor-close-discard @click=${()=>{this.confirmClose=!1,this.close()}}>סגירה בלי לשמור</sw-button>
      </div>
    </sw-dialog>`}};k.styles=K`
    .backdrop {
      position: fixed;
      inset: 0;
      background: var(--sw-overlay);
      z-index: var(--sw-z-modal);
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .pane {
      inline-size: min(1040px, 100%);
      max-block-size: calc(100dvh - 32px);
      /* opaque: the glass skins make --sw-surface translucent, and this pane sits over the people table */
      background: var(--sw-surface-solid);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      min-block-size: 0;
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 14px 16px 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    header div {
      flex: 1;
    }
    h3 {
      /* R5-SECURITY: the dialog's heading 20/800 in the heading ink */
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--sw-text));
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 2px;
    }
    .body {
      padding: 12px 16px;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-block-size: 0;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 16px 14px;
      border-block-start: 1px solid var(--sw-border);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .columns {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 860px) {
      .columns {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .column {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    /* R5-SECURITY: each section is a well (a tone step, no edge, radius lg); its legend 14.5/700 in the heading ink */
    fieldset {
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
      padding: 10px 14px 14px;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    legend {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 6px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    sw-badge {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      line-height: 18px;
      padding-block: 2px;
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 10px;
    }
    @media (max-width: 480px) {
      .grid2 {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
    }
    .row.between {
      justify-content: space-between;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .capture {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-block-start: 6px;
      border-block-start: 1px solid var(--sw-border);
    }
    .days {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
    }
    .day {
      min-block-size: 44px;
    }
    .dates,
    .periods {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-start;
    }
    .period {
      align-items: flex-end;
    }
    .dates input,
    .periods input,
    [data-wiskey-editor-section='category'] select,
    [data-wiskey-editor-section='timing'] select {
      font: inherit;
    }
    @media (max-width: 1100px) {
      [data-wiskey-editor-section='category'] input,
      [data-wiskey-editor-section='category'] select,
      [data-wiskey-editor-section='timing'] input:not([type='checkbox']),
      [data-wiskey-editor-section='timing'] select {
        min-block-size: 44px;
      }
    }
    .card-row {
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .station {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 6px 0;
      border-block-start: 1px solid var(--sw-border);
    }
    .locks {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      flex-basis: 100%;
      padding-inline-start: 24px;
    }
    .hint,
    .muted {
      margin: 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      margin: 0;
      color: var(--sw-success);
      font-size: var(--sw-fs-xs);
    }
    .reveal {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .reveal .pin {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
      letter-spacing: 0.12em;
      direction: ltr;
      unicode-bidi: isolate;
    }
    .danger {
      margin: 0;
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    .note > span {
      flex: 1 1 240px;
    }
    .note.info {
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .note.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
  `;z([_()],k.prototype,"userId",2);z([c()],k.prototype,"ctx",2);z([c()],k.prototype,"ctxNote",2);z([c()],k.prototype,"original",2);z([c()],k.prototype,"draft",2);z([c()],k.prototype,"loadError",2);z([c()],k.prototype,"loading",2);z([c()],k.prototype,"timed",2);z([c()],k.prototype,"validityFrom",2);z([c()],k.prototype,"validityUntil",2);z([c()],k.prototype,"busy",2);z([c()],k.prototype,"error",2);z([c()],k.prototype,"errorCode",2);z([c()],k.prototype,"errorTone",2);z([c()],k.prototype,"outcome",2);z([c()],k.prototype,"pinStatus",2);z([c()],k.prototype,"pinReveal",2);z([c()],k.prototype,"pinCopy",2);z([c()],k.prototype,"pinCheck",2);z([c()],k.prototype,"confirmDelete",2);z([c()],k.prototype,"confirmClose",2);z([c()],k.prototype,"capturing",2);z([c()],k.prototype,"notice",2);z([c()],k.prototype,"sensitive",2);k=z([V("wiskey-person-editor")],k);const Oi={"page.title":"אנשים","page.count":"{n} אנשים","page.count_one":"אדם אחד","page.count_of":"{shown} מתוך {total}","page.count_min":"{shown} מתוך {total}+","page.count_zero":"אין אנשים","search.name":"חיפוש לפי שם","search.name_number":"חיפוש לפי שם או מס׳ עובד","search.label":"חיפוש אנשים","view.label":"תצוגה","view.cards":"כרטיסים","view.list":"רשימה","view.table":"טבלה","action.add":"הוספת אדם","action.refresh":"רענון","action.select":"בחירה מרובה","action.select_off":"סיום הבחירה","action.columns":"עמודות","action.more":"עוד {n}","action.clear":"ניקוי מסננים","action.retry":"נסה שוב","action.reload":"טען מחדש","action.close":"סגירה","action.edit":"עריכה","action.message":"שלח הודעה","action.message_selected":"הודעה לנבחרים","action.settings":"להגדרות","action.show_photo":"הצג תמונה","action.hide_photo":"הסתר תמונה","action.reveal_phone":"הצג מספר","action.hide_phone":"הסתר מספר","action.select_all":"בחירת כל הרשומות המוצגות","action.clear_selection":"ביטול הבחירה","action.select_row":"בחירת {name}","filter.group":"קבוצה","filter.station":"תחנה","filter.state":"מצב","filter.rights":"הרשאה","filter.credential":"אמצעי זיהוי","filter.profile":"שדה פרופיל","filter.profile_value":"ערך","filter.sort":"מיון","filter.any":"הכול","filter.bar":"סינון","state.active":"פעילים","state.inactive":"מושבתים","state.expired":"פג תוקף","state.upcoming":"תוקף עתידי","state.archived":"בארכיון","rights.assigned":"עם הרשאה פעילה","rights.unassigned":"ללא שיוך לתחנות","rights.disabled":"שיוך כבוי","credential.pin":"עם קוד","credential.no_pin":"בלי קוד","credential.card":"עם כרטיס","credential.no_card":"בלי כרטיס","sort.name":"שם (א׳–ת׳)","sort.name_desc":"שם (ת׳–א׳)","sort.employee":"מס׳ עובד","col.name":"שם","col.employee":"מס׳ עובד","col.groups":"קבוצות","col.stations":"תחנות","col.credentials":"אמצעים","col.validity":"תוקף","col.state":"מצב","col.sync":"סנכרון","col.actions":"פעולות","row.stations":"{n} תחנות","row.station_one":"תחנה אחת","row.no_stations":"ללא תחנות","row.no_groups":"ללא קבוצה","validity.permanent":"ללא הגבלה","validity.until":"עד {date}","validity.from":"מ־{date}","validity.expired":"פג תוקף","validity.future":"טרם התחיל","validity.window":"מ־{from} עד {until}","validity.unknown":"לא ידוע","person.active":"פעיל","person.inactive":"מושבת","person.archived":"בארכיון","cred.card":"כרטיס","cred.cards":"{n} כרטיסים","cred.pin":"קוד","cred.none":"ללא אמצעי","cred.unknown":"לא ידוע","sync.synced":"מסונכרן","sync.pending":"ממתין לסנכרון","sync.syncing":"מסנכרן","sync.conflict":"התנגשות","sync.error":"שגיאת סנכרון","sync.delete_pending":"ממתין להסרה","sync.offline":"התחנה לא מחוברת","sync.unknown":"לא ידוע","sync.unassigned":"ללא שיוך","state.loading":"טוען אנשים…","state.empty":"אין אנשים להצגה","state.no_results":"לא נמצאו אנשים","state.error":"לא ניתן לטעון את רשימת האנשים","state.forbidden":"המסך הזה אינו זמין לך","state.unavailable":"בקרת הכניסה אינה זמינה","state.unsupported":"המסך אינו זמין בגרסה המותקנת","state.connecting":"מתחבר לבקרת הכניסה…","state.stale":"מוצג המצב האחרון · עודכן {when}","state.page_stale":"הרשימה השתנתה","state.partial":"התוצאות חלקיות","state.partial_rate":"הבקשה הוגבלה בקצב והחיפוש נעצר לפני סופו","state.partial_scan":"החיפוש נעצר לפני סופו","state.detail_error":"לא ניתן לטעון את הכרטיס","state.detail_gone":"האדם לא נמצא","state.detail_loading":"טוען…","drawer.tab_details":"פרטים","drawer.tab_access":"גישה","drawer.tab_groups":"קבוצות","drawer.tabs":"חלקי הכרטיס","drawer.validity":"תוקף","drawer.timing":"מועדי כניסה","drawer.timing_always":"ללא הגבלת שעות","drawer.timing_days":"ימים","drawer.timing_dates":"תאריכים","drawer.timing_hours":"שעות","drawer.timing_zone":"אזור זמן","drawer.timing_native":"נאכף בתחנה","drawer.timing_arx":"נאכף במערכת","drawer.credentials":"אמצעי זיהוי","drawer.category":"סוג גישה","drawer.employee":"מס׳ עובד","drawer.sensitive":"פרטים רגישים","drawer.phone":"טלפון","drawer.no_phone":"אין מספר","drawer.photo":"תמונה","drawer.no_photo":"אין תמונה","drawer.photo_loading":"טוען תמונה…","drawer.photo_error":"לא ניתן להציג את התמונה","drawer.profile":"שדות פרופיל","drawer.responsible":"אחראי","drawer.purpose":"מטרת הגישה","drawer.stations":"גישה לתחנות","drawer.door":"דלת {doors}","drawer.doors":"דלתות {doors}","syncerr.device_unavailable":"העמדה אינה זמינה","syncerr.action_failed":"הפעולה נכשלה","syncerr.station_unloaded":"העמדה אינה טעונה","syncerr.device_busy":"העמדה עסוקה","drawer.access_off":"כבוי","drawer.no_access":"אין שיוך לתחנות","drawer.error_detail":"פירוט","drawer.groups":"קבוצות","drawer.no_groups":"האדם אינו שייך לקבוצה","drawer.group_stations":"מעניקה גישה ל־{n} תחנות","drawer.unknown_value":"לא ידוע","drawer.tab_messages":"הודעות","category.staff":"עובד","category.visitor":"אורח","category.contractor":"קבלן","timing.weekly":"שבועי","timing.dates":"תאריכים","bulk.selected":"{n} נבחרו","bulk.bar":"פעולות על הנבחרים","msg.title":"הודעת וואטסאפ","msg.title_bulk":"הודעת וואטסאפ ל־{n} אנשים","msg.recipient":"נמען","msg.phone_hidden":"מספר מוסתר","msg.phone_masked":"מספר מוסתר חלקית","msg.consent_granted":"הסכמה","msg.consent_declined":"ביקש לא לקבל","msg.consent_unknown":"הסכמה לא ידועה","msg.template":"תבנית","msg.free":"חופשי","msg.text":"ההודעה","msg.counter":"{n}/{max}","msg.send":"שלח","msg.send_again":"שליחה נוספת","msg.send_n":"שלח ל־{n}","msg.send_anyway":"שלח שוב בכל זאת","msg.confirm_send":"אישור ושליחה","msg.confirm_bulk":"לשלוח ל־{n} אנשים? ההודעות יישלחו בזו אחר זו, ואי אפשר לבטל הודעה שנשלחה.","msg.back":"חזרה","msg.stop":"עצירה","msg.stopping":"עוצר אחרי ההודעה הנוכחית…","msg.cancel":"ביטול","msg.close":"סגירה","msg.sending":"שולח…","msg.sending_n":"שולח {done} מתוך {total}…","msg.sent":"נשלח · {time} · אין אישור מסירה","msg.failed":"לא נשלח · {reason}","msg.uncertain":"לא ידוע אם ההודעה נשלחה · בדקו עם הנמען לפני שליחה חוזרת","msg.rate":"הגעת למכסת ההודעות · אפשר לשלוח שוב בעוד {minutes} דק׳","msg.cant":"אי אפשר לשלוח · {reason}","msg.preview_bulk":"יישלח ל־{send}{skip}","msg.preview_skip":" · לא יישלח ל־{n}: {names}","msg.bulk_done":"נשלח ל־{sent}{failed}","msg.bulk_held":" · {n} ממתינות לאישור האדם","msg.bulk_failed":" · {n} לא נשלחו","msg.bulk_unknown":" · {n} לא ידוע","msg.results":"תוצאות השליחה","msg.result_name":"נמען","msg.result_outcome":"תוצאה","msg.result_detail":"פירוט","msg.result_sent":"נשלח","msg.result_failed":"לא נשלח","msg.result_unknown":"לא ידוע","msg.bulk_over_quota":"המכסה מאפשרת {n} הודעות בלבד · הקטינו את הבחירה","msg.bulk_too_many":"אפשר לשלוח לעד {max} אנשים בבת אחת","msg.no_template":"בחרו תבנית או כתבו הודעה","msg.too_long":"ההודעה ארוכה מדי","msg.credential_blocked":"אי אפשר לשלוח קוד גישה או פרטי כניסה בהודעה","msg.reason.no_phone":"אין מספר טלפון בכרטיס האדם","msg.reason.no_consent":"האדם ביקש לא לקבל הודעות","msg.reason.no_service":"שירות ההודעות אינו מחובר","msg.reason.not_registered":"המספר אינו רשום בוואטסאפ","msg.reason.uncertain":"לא ידוע אם ההודעה נשלחה","msg.reason.unknown":"הסיבה לא ידועה","msg.reason.expired":"ההודעה פגה · נסו שוב","msg.reason.free_text_off":"הודעה חופשית אינה מופעלת","msg.reason.rate":"מכסת ההודעות מלאה","msg.reason.person_limit":"האדם קיבל היום את מספר ההודעות המרבי","msg.reason.station_limit":"אנשי העמדה קיבלו את מספר ההודעות המרבי לשעה","msg.reason.outside_hours":"מחוץ לשעות השליחה","msg.reason.forbidden":"אין לכם הרשאה לשלוח לאדם הזה","msg.reason.gone":"האדם לא נמצא","msg.reason.template_changed":"התבניות עודכנו · בחרו תבנית שוב","msg.reason.disabled":"שליחת ההודעות כבויה בהגדרות","msg.reason.duplicate":"ההודעה הזו כבר נשלחה","msg.reason.refused":"שירות ההודעות דחה את ההודעה","msg.reason.stopped":"הופסק לפני השליחה","msg.reason.empty":"ההודעה ריקה","msg.held":"ממתינה לאישור האדם · תישלח אחרי שיאשר בקישור","msg.consent_requested":"נשלחה לאדם בקשת אישור · ההודעה תישלח אחרי שיאשר","msg.consent_requested_free":"נשלחה לאדם בקשת אישור · הודעה חופשית לא נשמרת, שלחו אותה שוב אחרי האישור","msg.result_held":"ממתין לאישור","msg.reason.consent_pending":"ממתינה כבר בקשת אישור לאדם הזה","msg.reason.consent_recent":"נשלחה לאדם בקשת אישור בחודש האחרון ולא אושרה","msg.reason.consent_unavailable":"אי אפשר לשלוח בקשת אישור כרגע","hist.held":"ממתין לאישור","hist.dropped":"לא נשלח · אין אישור","hist.loading":"טוען הודעות…","hist.empty":"עדיין לא נשלחו הודעות לאדם הזה","hist.error":"לא ניתן לטעון את ההודעות","hist.retry":"נסה שוב","hist.free":"הודעה חופשית","hist.removed_template":"תבנית שנמחקה","hist.bulk":"שליחה לרבים","hist.by":"נשלח ע״י {name}","hist.sent":"נשלח","hist.refused":"לא נשלח","hist.unknown":"לא ידוע","hist.pending":"בשליחה","hist.list":"הודעות שנשלחו","optout.label":"ביקש לא לקבל הודעות","optout.by":"סומן ע״י {name} · {date}","optout.at":"סומן {date}","optout.error":"השינוי לא נשמר","optout.admin_only":"רק מנהל מערכת יכול לבטל את הבקשה"};function r(e,t){const s=Oi[e]??e;return t?s.replace(/\{(\w+)\}/g,(i,a)=>a in t?String(t[a]):i):s}const yt=new Map([["device_unavailable","syncerr.device_unavailable"],["action_failed","syncerr.action_failed"],["station_unloaded","syncerr.station_unloaded"],["device_busy","syncerr.device_busy"]]),Ri=e=>yt.has(e);function Di(e){const t=yt.get(e);return t?r(t):e}var Ai=Object.defineProperty,Ii=Object.getOwnPropertyDescriptor,G=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ii(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Ai(t,s,a),a};function qi(e){switch(e){case"sent":return{kind:"recorded",label:r("hist.sent")};case"refused":return{kind:"error",label:r("hist.refused")};case"pending":return{kind:"stale",label:r("hist.pending")};case"held":return{kind:"stale",label:r("hist.held")};case"dropped":return{kind:"error",label:r("hist.dropped")};default:return{kind:"unknown",label:r("hist.unknown")}}}let F=class extends W{constructor(){super(...arguments),this.transport=null,this.personId="",this.zone=ee,this.rev=0,this.phase="loading",this.data=null,this.busy=!1,this.failed=!1,this.generation=0}willUpdate(e){(e.has("personId")||e.has("rev")||e.has("transport"))&&this.personId&&this.load()}disconnectedCallback(){super.disconnectedCallback(),this.generation++}async load(){const e=++this.generation,t=this.transport;if(t){this.data||(this.phase="loading");try{const s=await t.history(this.personId);if(e!==this.generation)return;this.data=s,this.phase="ready"}catch{if(e!==this.generation)return;this.phase="error"}}}async toggleOptOut(){const e=this.transport;if(!e||!this.data||this.busy||this.data.opt_out!==null&&this.data.can_clear_opt_out===!1)return;this.busy=!0,this.failed=!1;const t=this.personId;try{const s=await e.setOptOut(t,this.data.opt_out===null);if(t!==this.personId)return;this.data={...this.data,opt_out:s.opt_out,consent:s.consent}}catch{this.failed=!0}finally{this.busy=!1}}optOutText(e){if(!e.opt_out)return"";const t=Q(e.opt_out.at,this.zone);return e.opt_out.by?r("optout.by",{name:e.opt_out.by,date:t}):r("optout.at",{date:t})}renderItem(e){const t=qi(e.outcome),s=e.kind==="free"?r("hist.free"):e.template_label??r("hist.removed_template"),i=[e.by?r("hist.by",{name:e.by}):"",Q(e.at,this.zone),e.bulk?r("hist.bulk"):""].filter(Boolean).join(" · ");return n`<li data-msg-history-item data-msg-outcome=${e.outcome}>
      <div class="main"><span class="t">${s}</span><span class="s">${i}</span></div>
      <sw-badge kind=${t.kind} label=${t.label}></sw-badge>
    </li>`}render(){if(this.phase==="loading")return n`<section data-person-section="messages" data-msg-history-state="loading" aria-busy="true"><div class="skeleton" style="inline-size:60%"></div><div class="skeleton" style="inline-size:80%"></div><span class="sub" role="status">${r("hist.loading")}</span></section>`;if(this.phase==="error"||!this.data)return n`<section data-person-section="messages" data-msg-history-state="error"><sw-state-panel compact state="error" heading=${r("hist.error")} actionLabel=${r("hist.retry")} @action=${()=>void this.load()}></sw-state-panel></section>`;const e=this.data,t=e.opt_out!==null,s=t&&e.can_clear_opt_out===!1;return n`<section data-person-section="messages" data-msg-history-state="ready">
      <button type="button" class="sw" role="switch" aria-checked=${String(t)} data-msg-optout ?data-locked=${s} ?disabled=${this.busy||s} @click=${()=>void this.toggleOptOut()}>
        <span class="txt"><span class="t">${r("optout.label")}</span>${t?n`<span class="x" data-msg-optout-by>${this.optOutText(e)}${s?` · ${r("optout.admin_only")}`:""}</span>`:l}</span>
        <span class="track" aria-hidden="true"></span>
      </button>
      ${this.failed?n`<div class="err" role="alert" data-msg-optout-error><sw-icon name="warning" size=${16}></sw-icon><span>${r("optout.error")}</span></div>`:l}
      <h4>${r("hist.list")}</h4>
      ${e.messages.length===0?n`<span class="sub" data-msg-history-empty>${r("hist.empty")}</span>`:n`<ul data-msg-history aria-label=${r("hist.list")}>${e.messages.map(i=>this.renderItem(i))}</ul>`}
    </section>`}};F.styles=K`
    :host {
      display: block;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .sw {
      display: flex;
      align-items: center;
      gap: 12px;
      inline-size: 100%;
      min-block-size: 56px;
      padding: 8px 12px;
      box-sizing: border-box;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .sw:disabled {
      cursor: default;
      opacity: var(--sw-disabled-opacity);
    }
    .sw:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .sw .txt {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sw .t {
      font-weight: var(--sw-fw-medium);
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
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 56px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    li .main {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    li .t {
      font-weight: var(--sw-fw-medium);
      overflow-wrap: anywhere;
    }
    li .s {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .sub {
      color: var(--sw-text-3);
    }
    .err {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .skeleton {
      block-size: 14px;
      border-radius: var(--sw-r-xs);
      background: linear-gradient(90deg, var(--sw-surface-3), var(--sw-surface-2), var(--sw-surface-3));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }
    sw-button {
      min-block-size: 44px;
    }
  `;G([_({attribute:!1})],F.prototype,"transport",2);G([_()],F.prototype,"personId",2);G([_({attribute:!1})],F.prototype,"zone",2);G([_({type:Number})],F.prototype,"rev",2);G([c()],F.prototype,"phase",2);G([c()],F.prototype,"data",2);G([c()],F.prototype,"busy",2);G([c()],F.prototype,"failed",2);F=G([V("wiskey-person-messages")],F);const $t=e=>`access-station-permissions/people/${encodeURIComponent(e)}`,be=(e,t)=>`${$t(e)}/stations/${encodeURIComponent(t)}`,Ni=e=>ne($t(e)),Mi=(e,t,s,i,a)=>_e(be(e,t),{effect:s,revision:i,...s==="allow"?{relays:a??[1]}:{}}),ji=(e,t,s)=>I(`${be(e,t)}/approve`,{revision:s}),Li=(e,t,s)=>I(`${be(e,t)}/refuse`,{revision:s}),Ui=(e,t,s)=>I(`${be(e,t)}/sync`,{revision:s}),kt={title:"הרשאות לפי עמדה",src_group:"דרך קבוצה",src_personal:"אישית",src_blocked:"חסומה",src_blocked_group:"נחסמה אישית · הקבוצה מאפשרת",src_none:"ללא גישה",src_unknown:"לא ידוע",sync_pending:"ממתין לשליחה",sync_applied:"עודכן ב-WisKey",sync_unverified:"לא אומת",sync_failed:"נדחה ב-WisKey",allow:"אפשר",deny:"חסום",inherit:"לפי קבוצה",removePersonal:"הסרת גישה אישית",approve:"אישור",refuse:"דחייה",withdraw:"ביטול בקשה",sync:"בדיקה חוזרת",add:"הוספת עמדה",addPick:"בחירת עמדה",doors:"דלתות {doors}",requested:"בקשה: {who}",requestedMine:"הבקשה שלך ממתינה לאישור",requestSent:"הבקשה נשלחה לאישור",confirmDeny:"לחסום את {station}?",confirmYes:"חסום",cancel:"ביטול",done:"נשמר",unavailable:"WisKey לא זמין כרגע",grantLive:"גישה זמנית פעילה מנהלת את הדלתות של אדם זה",self:"לא ניתן לשנות את הגישה של עצמך",empty:"אין עמדות",error:"לא ניתן לטעון",retry:"נסה שוב"},Fi={title:"Station permissions",src_group:"Through a group",src_personal:"Personal",src_blocked:"Blocked",src_blocked_group:"Denied personally · group grants",src_none:"No access",src_unknown:"Unknown",sync_pending:"Waiting to send",sync_applied:"Updated in WisKey",sync_unverified:"Not verified",sync_failed:"Refused by WisKey",allow:"Allow",deny:"Block",inherit:"Follow group",removePersonal:"Remove personal access",approve:"Approve",refuse:"Refuse",withdraw:"Withdraw request",sync:"Check again",add:"Add station",addPick:"Choose a station",doors:"Doors {doors}",requested:"Request: {who}",requestedMine:"Your request is waiting for approval",requestSent:"Request sent for approval",confirmDeny:"Block {station}?",confirmYes:"Block",cancel:"Cancel",done:"Saved",unavailable:"WisKey is not available right now",grantLive:"A live temporary access manages this person's doors",self:"You cannot change your own access",empty:"No stations",error:"Could not load",retry:"Try again"},Bi={title:"الأذونات حسب المحطة",src_group:"عبر مجموعة",src_personal:"شخصي",src_blocked:"محظور",src_blocked_group:"محظور شخصيًا · المجموعة تسمح",src_none:"بلا وصول",src_unknown:"غير معروف",sync_pending:"بانتظار الإرسال",sync_applied:"تم التحديث في WisKey",sync_unverified:"لم يتم التحقق",sync_failed:"رفضه WisKey",allow:"السماح",deny:"حظر",inherit:"حسب المجموعة",removePersonal:"إزالة الوصول الشخصي",approve:"موافقة",refuse:"رفض",withdraw:"سحب الطلب",sync:"تحقق مجددًا",add:"إضافة محطة",addPick:"اختر محطة",doors:"الأبواب {doors}",requested:"طلب: {who}",requestedMine:"طلبك بانتظار الموافقة",requestSent:"تم إرسال الطلب للموافقة",confirmDeny:"حظر {station}؟",confirmYes:"حظر",cancel:"إلغاء",done:"تم الحفظ",unavailable:"WisKey غير متاح حاليًا",grantLive:"وصول مؤقت نشط يدير أبواب هذا الشخص",self:"لا يمكنك تغيير وصولك الشخصي",empty:"لا توجد محطات",error:"تعذر التحميل",retry:"حاول مجددًا"},Ki={title:"Права по станциям",src_group:"Через группу",src_personal:"Личное",src_blocked:"Заблокировано",src_blocked_group:"Запрещено лично · группа разрешает",src_none:"Нет доступа",src_unknown:"Неизвестно",sync_pending:"Ожидает отправки",sync_applied:"Обновлено в WisKey",sync_unverified:"Не подтверждено",sync_failed:"Отклонено WisKey",allow:"Разрешить",deny:"Заблокировать",inherit:"По группе",removePersonal:"Убрать личный доступ",approve:"Утвердить",refuse:"Отклонить",withdraw:"Отозвать запрос",sync:"Проверить снова",add:"Добавить станцию",addPick:"Выберите станцию",doors:"Двери {doors}",requested:"Запрос: {who}",requestedMine:"Ваш запрос ожидает утверждения",requestSent:"Запрос отправлен на утверждение",confirmDeny:"Заблокировать {station}?",confirmYes:"Заблокировать",cancel:"Отмена",done:"Сохранено",unavailable:"WisKey сейчас недоступен",grantLive:"Дверями этого человека управляет активный временный доступ",self:"Нельзя изменить собственный доступ",empty:"Нет станций",error:"Не удалось загрузить",retry:"Повторить"},Wi={he:kt,en:Fi,ar:Bi,ru:Ki};function y(e,t,s=jt()){const i=Wi[s][e]??kt[e]??e;return t?i.replace(/\{(\w+)\}/g,(a,d)=>d in t?String(t[d]):a):i}function Vi(e){switch(e){case"group":return{kind:"neutral",label:y("src_group")};case"personal":return{kind:"live",label:y("src_personal")};case"blocked":return{kind:"error",label:y("src_blocked")};case"blocked_group":return{kind:"error",label:y("src_blocked_group")};case"none":return{kind:"offline",label:y("src_none")};default:return{kind:"unknown",label:y("src_unknown")}}}function Yi(e){switch(e){case"pending":return{kind:"stale",label:y("sync_pending")};case"unverified":return{kind:"stale",label:y("sync_unverified")};case"failed":return{kind:"error",label:y("sync_failed")};case"applied":return{kind:"recorded",label:y("sync_applied")};default:return null}}function Gi(e){const t=[],s=e.actions;return s.approve&&t.push({action:"approve",label:y("approve"),primary:!0}),s.refuse&&t.push({action:"refuse",label:y(e.request?.mine?"withdraw":"refuse"),primary:!1}),s.allow&&e.source!=="personal"&&!e.request&&t.push({action:"allow",label:y("allow"),primary:!1}),s.inherit&&t.push({action:"inherit",label:y(e.source==="personal"?"removePersonal":"inherit"),primary:!1}),s.deny&&t.push({action:"deny",label:y("deny"),primary:!1}),s.sync&&t.push({action:"sync",label:y("sync"),primary:!1}),t}function Hi(e){return e.grant_live?"grantLive":e.self&&!e.system_admin?"self":e.read==="unavailable"?"unavailable":null}function Xi(e){return e.length&&!(e.length===1&&e[0]===1)?y("doors",{doors:e.join(", ")}):""}function Ji(e,t){return e.name||t[e.station_id]||e.station_id}function Je(e){const t=new Set(e.stations.map(s=>s.station_id));return e.addable.filter(s=>!t.has(s.station_id)).sort((s,i)=>(s.name||s.station_id).localeCompare(i.name||i.station_id))}function Zi(e){return e==="requested"?"requestSent":"done"}var Qi=Object.defineProperty,en=Object.getOwnPropertyDescriptor,H=(e,t,s,i)=>{for(var a=i>1?void 0:i?en(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Qi(t,s,a),a};let B=class extends W{constructor(){super(...arguments),this.personId="",this.stationNames={},this.phase="loading",this.data=null,this.busy="",this.confirming="",this.line=null,this.pick="",this.seq=0}willUpdate(e){e.has("personId")&&(this.line=null,this.confirming="",this.pick="",this.load())}async load(){const e=this.personId,t=++this.seq;if(!e){this.phase="hidden";return}(!this.data||this.data.person_id!==e)&&(this.phase="loading");try{const s=await Ni(e);if(t!==this.seq)return;this.data=s,this.phase="ready"}catch(s){if(t!==this.seq)return;this.phase=s instanceof $&&(s.status===404||s.status===403)?"hidden":"error"}}async act(e,t,s){if(t==="deny"&&this.confirming!==e.station_id){this.confirming=e.station_id;return}this.confirming="",this.busy=e.station_id,this.line=null;const i=this.personId;try{const a=t==="approve"?await ji(i,e.station_id,e.revision):t==="refuse"?await Li(i,e.station_id,e.revision):t==="sync"?await Ui(i,e.station_id,e.revision):await Mi(i,e.station_id,t,e.revision,t==="allow"?s??(e.relays.length?e.relays:[1]):void 0);this.line={ok:!0,text:y(Zi(a.outcome))}}catch(a){this.line={ok:!1,text:a instanceof $?a.message:y("error")}}finally{this.busy="",await this.load()}}addStation(){const e=this.data?Je(this.data).find(s=>s.station_id===this.pick):void 0;if(!e)return;const t={station_id:e.station_id,name:e.name,enabled:!1,relays:e.relays,source:"none",record:null,request:null,revision:0,decides:!e.request_only,request_only:e.request_only,actions:{allow:!0,deny:!1,inherit:!1,approve:!1,refuse:!1,sync:!1}};this.pick="",this.act(t,"allow",e.relays.length?e.relays:[1])}renderRow(e){const t=Vi(e.source),s=e.record&&e.record.sync_state!=="applied"?Yi(e.record.sync_state):null,i=Ji(e,this.stationNames),a=Xi(e.relays),d=this.busy===e.station_id;return n`<li data-sp-station=${e.station_id}>
      <span class="name">${i}</span>
      ${a?n`<span class="sub">${a}</span>`:l}
      <sw-badge data-sp-source=${e.source} kind=${t.kind} label=${t.label}></sw-badge>
      ${s?n`<sw-badge data-sp-sync=${e.record.sync_state} kind=${s.kind} label=${s.label}></sw-badge>`:l}
      ${e.request?n`<span class="req" data-sp-request>${e.request.mine?y("requestedMine"):y("requested",{who:e.request.requested_by_name??"—"})}</span>`:l}
      ${this.confirming===e.station_id?n`<div class="acts" role="group">
            <span class="sub" style="margin-inline-end:auto">${y("confirmDeny",{station:i})}</span>
            <sw-button size="sm" @click=${()=>this.confirming=""}>${y("cancel")}</sw-button>
            <sw-button size="sm" variant="danger" data-sp-confirm @click=${()=>void this.act(e,"deny")}>${y("confirmYes")}</sw-button>
          </div>`:(()=>{const o=Gi(e);return o.length?n`<div class="acts">${o.map(m=>n`<sw-button size="sm" variant=${m.primary?"primary":m.action==="deny"?"ghost":"secondary"} ?disabled=${d}
                  data-sp-action=${m.action} @click=${()=>void this.act(e,m.action)}>${m.label}</sw-button>`)}</div>`:l})()}
    </li>`}render(){if(this.phase==="hidden"||this.phase==="loading"&&!this.data)return l;if(this.phase==="error")return n`<section data-sp-block="error"><h4>${y("title")}</h4>
        <p class="note">${y("error")} <sw-button size="sm" @click=${()=>void this.load()}>${y("retry")}</sw-button></p></section>`;const e=this.data,t=Hi(e),s=t?[]:Je(e);return n`<section data-sp-block="ready">
      <h4>${y("title")}</h4>
      ${t?n`<p class="note" data-sp-notice=${t}>${y(t)}</p>`:l}
      ${this.line?n`<p class="line ${this.line.ok?"ok":"bad"}" role="status" data-sp-line>${this.line.text}</p>`:l}
      ${e.stations.length?n`<ul>${e.stations.map(i=>this.renderRow(i))}</ul>`:n`<span class="sub" data-sp-empty>${y("empty")}</span>`}
      ${s.length?n`<div class="add">
            <select aria-label=${y("addPick")} data-sp-add-pick .value=${this.pick} @change=${i=>this.pick=i.target.value}>
              <option value="">${y("addPick")}</option>
              ${s.map(i=>n`<option value=${i.station_id}>${i.name||this.stationNames[i.station_id]||i.station_id}</option>`)}
            </select>
            <sw-button size="sm" icon="plus" data-sp-add ?disabled=${!this.pick||!!this.busy} @click=${()=>this.addStation()}>${y("add")}</sw-button>
          </div>`:l}
    </section>`}};B.styles=K`
    :host {
      display: block;
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li:last-child {
      border-block-end: 0;
    }
    .name {
      flex: 1 1 8rem;
      min-inline-size: 0;
      font-weight: var(--sw-fw-medium);
      overflow-wrap: anywhere;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      flex-basis: 100%;
      justify-content: flex-end;
    }
    .req {
      flex-basis: 100%;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .note,
    .line {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .line.ok {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    .line.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .add {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    select {
      flex: 1 1 10rem;
      min-block-size: 44px;
      padding-inline: 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    sw-button {
      min-block-size: 44px;
    }
  `;H([_()],B.prototype,"personId",2);H([_({attribute:!1})],B.prototype,"stationNames",2);H([c()],B.prototype,"phase",2);H([c()],B.prototype,"data",2);H([c()],B.prototype,"busy",2);H([c()],B.prototype,"confirming",2);H([c()],B.prototype,"line",2);H([c()],B.prototype,"pick",2);B=H([V("wiskey-station-permissions")],B);var tn=Object.defineProperty,sn=Object.getOwnPropertyDescriptor,T=(e,t,s,i)=>{for(var a=i>1?void 0:i?sn(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&tn(t,s,a),a};function ve(e){switch(e){case"synced":return{kind:"recorded",label:r("sync.synced")};case"pending":case"syncing":case"delete_pending":return{kind:"stale",label:r(`sync.${e}`)};case"conflict":case"error":return{kind:"error",label:r(`sync.${e}`)};case"offline":return{kind:"offline",label:r("sync.offline")};case"unassigned":return{kind:"neutral",label:r("sync.unassigned")};default:return{kind:"unknown",label:r("sync.unknown")}}}function me(e){switch(ft(e)){case"archived":return{kind:"neutral",label:r("person.archived")};case"inactive":return{kind:"offline",label:r("person.inactive")};case"expired":return{kind:"error",label:r("validity.expired")};case"upcoming":return{kind:"stale",label:r("validity.future")};default:return{kind:"live",label:r("person.active")}}}function ge(e,t,s=!1){const i=Wt(e);if(i==="permanent")return r("validity.permanent");if(i==="validity_unknown")return r("validity.unknown");const a=qe(e.valid_from,t),d=qe(e.valid_until,t);return i==="validity_expired"?`${r("validity.expired")} · ${d}`:i==="validity_future"?`${r("validity.future")} · ${a}`:s?r("validity.until",{date:d}):r("validity.window",{from:a,until:d})}let C=class extends W{constructor(){super(...arguments),this.open=!1,this.person=null,this.loading=!1,this.error="",this.stationNames={},this.groupLabels={},this.groupStations={},this.fields=null,this.zone=ee,this.canEdit=!1,this.canMessage=!1,this.canAct=!1,this.resultLine=null,this.transport=null,this.messagesTab=!1,this.messagesRev=0,this.photoEnabled=!0,this.tab="details",this.photo={phase:"idle",url:"",reason:""},this.photoFor=""}willUpdate(e){const t=this.person?.id??"";e.has("person")&&t!==this.photoFor&&(this.dropPhoto(),this.photoFor=t,this.tab="details"),e.has("open")&&!this.open&&this.dropPhoto()}disconnectedCallback(){super.disconnectedCallback(),this.dropPhoto()}dropPhoto(){this.photo.url&&URL.revokeObjectURL(this.photo.url),this.photo={phase:"idle",url:"",reason:""}}async showPhoto(){const e=this.person;if(!e)return;this.photo={phase:"loading",url:"",reason:""};const t=await Vt(e.id);if(this.person?.id!==e.id||!this.open){"url"in t&&URL.revokeObjectURL(t.url);return}this.photo="url"in t?{phase:"ready",url:t.url,reason:""}:{phase:"error",url:"",reason:t.error}}fire(e,t={}){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}renderDetails(e,t){const s=Yt(e),i=Gt(e.timing),a=mt(e),d=e.access_category&&e.access_category!=="unknown"?r(`category.${e.access_category}`):"";return n`
      <section data-person-section="details">
        <h4>${r("drawer.tab_details")}</h4>
        <dl>
          ${s.employeeNo?n`<dt>${r("drawer.employee")}</dt><dd><bdi class="ltr" data-person-employee>${e.employee_no}</bdi></dd>`:l}
          ${d?n`<dt>${r("drawer.category")}</dt><dd>${d}</dd>`:l}
          <dt>${r("drawer.validity")}</dt><dd data-person-validity>${ge(e,this.zone)}</dd>
          ${t?n`<dt>${r("drawer.timing")}</dt><dd data-person-timing>${i?n`${i.mode==="weekly"?n`${i.days.length?n`<div>${r("drawer.timing_days")}: ${i.days.join(", ")}</div>`:l}`:l}
                    ${i.mode==="dates"?n`<div>${r("drawer.timing_dates")}: <bdi class="ltr">${i.dates.join(", ")}</bdi>${i.moreDates?` +${i.moreDates}`:""}</div>`:l}
                    <div>${r("drawer.timing_hours")}: ${i.hours?n`<bdi class="ltr">${i.hours}</bdi>`:r("drawer.timing_always")}</div>
                    ${i.timezone?n`<div class="sub">${r("drawer.timing_zone")}: <bdi class="ltr">${i.timezone}</bdi></div>`:l}`:r("drawer.timing_always")}</dd>`:n`<dt>${r("drawer.timing")}</dt><dd><div class="skeleton" style="inline-size:60%"></div></dd>`}
          ${s.credentials?n`<dt>${r("drawer.credentials")}</dt><dd data-person-credentials>${a?a.kinds.length?a.kinds.map(o=>o==="card"?a.cards>1?r("cred.cards",{n:a.cards}):r("cred.card"):r("cred.pin")).join(" · "):a.none?r("cred.none"):r("cred.unknown"):r("drawer.unknown_value")}</dd>`:l}
        </dl>
      </section>
      ${s.sensitive?this.renderSensitive(e,s,t):l}`}renderSensitive(e,t,s){const i=t.photo&&this.photoEnabled?n`<div class="portrait" data-person-portrait>
          <div class="frame" aria-hidden=${this.photo.phase==="ready"?"false":"true"}>${this.photo.phase==="ready"?n`<img src=${this.photo.url} alt=${e.display_name} data-person-photo-img />`:Ht(e.display_name)}</div>
          <div>
            ${e.photo_configured===!0?this.photo.phase==="ready"?n`<button type="button" class="linkbtn" data-person-photo-hide @click=${()=>this.dropPhoto()}>${r("action.hide_photo")}</button>`:this.photo.phase==="loading"?n`<span class="sub" role="status">${r("drawer.photo_loading")}</span>`:n`<button type="button" class="linkbtn" data-person-photo-show @click=${()=>void this.showPhoto()}>${r("action.show_photo")}</button>${this.photo.phase==="error"?n`<div class="sub" role="status" data-person-photo-error=${this.photo.reason}>${r("drawer.photo_error")}</div>`:l}`:n`<span class="sub">${r("drawer.no_photo")}</span>`}
          </div>
        </div>`:l,a=new Map((this.fields??[]).map(o=>[o.id,o.label])),d=Object.entries(e.profile??{});return n`<section class="sens" data-person-section="sensitive" aria-label=${r("drawer.sensitive")}>
      <h4><sw-icon name="lock" size=${14}></sw-icon>${r("drawer.sensitive")}</h4>
      ${i}
      ${s?n`<dl>
            <dt>${r("drawer.phone")}</dt><dd data-person-phone>${e.phone?n`<bdi class="ltr">${e.phone}</bdi>`:e.phone_set===!1?r("drawer.no_phone"):r("drawer.unknown_value")}</dd>
            ${t.responsible?n`<dt>${r("drawer.responsible")}</dt><dd>${e.responsible_person}</dd>`:l}
            ${t.purpose?n`<dt>${r("drawer.purpose")}</dt><dd>${e.access_purpose}</dd>`:l}
            ${t.profile?d.map(([o,m])=>n`<dt>${a.get(o)??o}</dt><dd data-person-profile=${o}>${m}</dd>`):l}
          </dl>`:n`<div class="skeleton" style="inline-size:70%"></div>`}
    </section>`}renderAccess(e){const t=e.stations??[];return n`<section data-person-section="access">
      <h4>${r("drawer.stations")}</h4>
      ${t.length===0?n`<span class="sub" data-person-no-access>${r("drawer.no_access")}</span>`:n`<ul>${t.map(s=>{const i=ve(se({stations:[s]}));return n`<li class="station" data-person-station=${s.station_id}>
              <span class="name">${this.stationNames[s.station_id]??s.station_id}</span>
              ${s.doors.length?n`<span class="sub">${r(s.doors.length===1?"drawer.door":"drawer.doors",{doors:s.doors.join(", ")})}</span>`:l}
              ${s.enabled?l:n`<sw-badge kind="neutral" label=${r("drawer.access_off")}></sw-badge>`}
              <sw-badge data-person-sync=${se({stations:[s]})} kind=${i.kind} label=${i.label}></sw-badge>
              ${s.last_error?n`<span class="err" data-person-sync-error=${s.last_error} title=${s.last_error}>${Ri(s.last_error)?Di(s.last_error):n`<bdi class="ltr">${s.last_error}</bdi>`}</span>`:l}
            </li>`})}</ul>`}
    </section>
    ${D()?n`<wiskey-station-permissions .personId=${e.id} .stationNames=${this.stationNames}></wiskey-station-permissions>`:l}`}renderGroups(e){const t=e.group_ids??[];return n`<section data-person-section="groups">
      <h4>${r("drawer.groups")}</h4>
      ${t.length===0?n`<span class="sub" data-person-no-groups>${r("drawer.no_groups")}</span>`:n`<ul>${t.map(s=>{const i=this.groupStations[s];return n`<li class="station" data-person-group=${s}><span class="name">${this.groupLabels[s]??s}</span>${typeof i=="number"?n`<span class="sub">${r("drawer.group_stations",{n:i})}</span>`:l}</li>`})}</ul>`}
    </section>`}render(){const e=this.person,t=!!e&&!this.loading&&!this.error,s=e?.display_name??"",i=e&&e.employee_no!==null?`${r("drawer.employee")} ${e.employee_no}`:"",a=this.messagesTab&&!!this.transport,d=[["details",r("drawer.tab_details")],["access",r("drawer.tab_access")],["groups",r("drawer.tab_groups")],...a?[["messages",r("drawer.tab_messages")]]:[]],o=this.tab==="messages"&&!a?"details":this.tab,m=e?me(e):null,g=e?ve(se(e)):null;return n`<sw-drawer modal ?open=${this.open} heading=${s} subheading=${i} data-person-drawer @close=${x=>x.target===x.currentTarget&&this.fire("close")}>
      ${e?n`
            <div class="head">
              <sw-avatar name=${e.display_name} size=${44} aria-hidden="true"></sw-avatar>
              <div class="tags">
                <sw-badge data-person-state=${ft(e)} kind=${m.kind} label=${m.label}></sw-badge>
                ${ue(e)||e.stations?.length?n`<sw-badge data-person-sync-all=${se(e)} kind=${g.kind} label=${g.label}></sw-badge>`:l}
              </div>
            </div>
            ${this.resultLine?n`<p class="result ${this.resultLine.state}" role="status" data-person-result=${this.resultLine.state}>${this.resultLine.text}</p>`:l}
            ${this.error?n`<sw-state-panel icon="user" compact data-person-error=${this.error} state=${this.error==="gone"?"empty":"error"} heading=${this.error==="gone"?r("state.detail_gone"):r("state.detail_error")}></sw-state-panel>`:l}
            <div class="tabs" role="tablist" aria-label=${r("drawer.tabs")}>
              ${d.map(([x,X])=>n`<button type="button" role="tab" id="tab-${x}" aria-selected=${o===x} aria-controls="panel-${x}" data-person-tab=${x} @click=${()=>this.tab=x}>${X}</button>`)}
            </div>
            <div role="tabpanel" id="panel-${o}" aria-labelledby="tab-${o}" style="display:flex;flex-direction:column;gap:12px">
              ${o==="details"?this.renderDetails(e,t):o==="access"?this.renderAccess(e):o==="groups"?this.renderGroups(e):n`<wiskey-person-messages .transport=${this.transport} .personId=${e.id} .zone=${this.zone} .rev=${this.messagesRev}></wiskey-person-messages>`}
            </div>`:l}
      ${e&&(this.canMessage||this.canEdit||this.canAct)?n`<div slot="footer" style="display:contents">
            ${this.canMessage?n`<sw-button icon="mail" data-person-message @click=${()=>this.fire("message",{id:e.id})}>${r("action.message")}</sw-button>`:l}
            ${this.canAct?n`<sw-button icon="more" data-person-actions-open @click=${()=>this.fire("actions",{id:e.id})}>${h("actions.open")}</sw-button>`:l}
            ${this.canEdit?n`<sw-button variant="primary" icon="edit" data-wiskey-person-edit @click=${()=>this.fire("edit",{id:e.id})}>${r("action.edit")}</sw-button>`:l}
          </div>`:l}
      <slot></slot>
    </sw-drawer>`}};C.styles=K`
    :host {
      display: contents;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .head .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
    }
    .tabs button {
      flex: 1;
      min-block-size: 44px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-heading, var(--sw-text)));
      font-weight: var(--sw-fw-bold);
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .tabs button {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .tabs button:active {
      transform: scale(var(--sw-press-scale));
    }
    /* R5-SECURITY: the badges in the head and the sections are fields - 12.5/700 on 22 px */
    sw-badge {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      line-height: 18px;
      padding-block: 2px;
    }
    .tabs button:focus-visible,
    .linkbtn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    /* R5-SECURITY: section headings in the heading ink (14.5/700); values 14/600; the sensitive section is a well (a tone step, no edge) */
    h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    section.sens {
      padding: 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    dl {
      display: grid;
      grid-template-columns: minmax(0, 8rem) minmax(0, 1fr);
      gap: 8px 12px;
      margin: 0;
      font-size: var(--sw-fs-base);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
      font-variant-numeric: tabular-nums;
    }
    .sub {
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    li.station {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    li.station:last-child {
      border-block-end: 0;
    }
    li.station .name {
      flex: 1 1 8rem;
      min-inline-size: 0;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
    }
    li.station .err {
      flex-basis: 100%;
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    .portrait {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .frame {
      display: grid;
      place-items: center;
      inline-size: 88px;
      block-size: 88px;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      border: 2px solid var(--sw-surface);
      box-shadow: var(--sw-shadow-2);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .linkbtn {
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .skeleton {
      block-size: 14px;
      border-radius: var(--sw-r-xs);
      background: linear-gradient(90deg, var(--sw-surface-3), var(--sw-surface-2), var(--sw-surface-3));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }
    sw-button {
      min-block-size: 44px;
    }
    .result {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .result.saved,
    .result.deleted {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    .result.pending,
    .result.unknown {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .result.refused,
    .result.not_sent {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
  `;T([_({type:Boolean,reflect:!0})],C.prototype,"open",2);T([_({attribute:!1})],C.prototype,"person",2);T([_({type:Boolean})],C.prototype,"loading",2);T([_()],C.prototype,"error",2);T([_({attribute:!1})],C.prototype,"stationNames",2);T([_({attribute:!1})],C.prototype,"groupLabels",2);T([_({attribute:!1})],C.prototype,"groupStations",2);T([_({attribute:!1})],C.prototype,"fields",2);T([_({attribute:!1})],C.prototype,"zone",2);T([_({type:Boolean})],C.prototype,"canEdit",2);T([_({type:Boolean})],C.prototype,"canMessage",2);T([_({type:Boolean})],C.prototype,"canAct",2);T([_({attribute:!1})],C.prototype,"resultLine",2);T([_({attribute:!1})],C.prototype,"transport",2);T([_({type:Boolean})],C.prototype,"messagesTab",2);T([_({type:Number})],C.prototype,"messagesRev",2);T([_({type:Boolean})],C.prototype,"photoEnabled",2);T([c()],C.prototype,"tab",2);T([c()],C.prototype,"photo",2);C=T([V("wiskey-person-drawer")],C);var nn=Object.defineProperty,an=Object.getOwnPropertyDescriptor,q=(e,t,s,i)=>{for(var a=i>1?void 0:i?an(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&nn(t,s,a),a};const rn={no_phone:"msg.reason.no_phone",no_consent:"msg.reason.no_consent",no_service:"msg.reason.no_service",not_registered:"msg.reason.not_registered",uncertain:"msg.reason.uncertain",expired:"msg.reason.expired",free_text_off:"msg.reason.free_text_off",credential:"msg.credential_blocked",too_long:"msg.too_long",empty:"msg.reason.empty",rate:"msg.reason.rate",person_limit:"msg.reason.person_limit",station_limit:"msg.reason.station_limit",outside_hours:"msg.reason.outside_hours",forbidden:"msg.reason.forbidden",gone:"msg.reason.gone",template_changed:"msg.reason.template_changed",disabled:"msg.reason.disabled",duplicate:"msg.reason.duplicate",refused:"msg.reason.refused",stopped:"msg.reason.stopped",unknown:"msg.reason.unknown",consent_pending:"msg.reason.consent_pending",consent_recent:"msg.reason.consent_recent",consent_unavailable:"msg.reason.consent_unavailable"},J=e=>r(rn[e]),Ze=e=>{const t=new Date(e);return Number.isFinite(t.getTime())?Lt(t):""};let P=class extends W{constructor(){super(...arguments),this.open=!1,this.transport=null,this.people=[],this.loaded="loading",this.config=null,this.recipients=[],this.draft={template_id:null,text:""},this.phase="idle",this.sentAt="",this.held="",this.progress=null,this.outcome=null,this.confirming=!1,this.stopping=!1,this.generation=0,this.stopRequested=!1}willUpdate(e){e.has("open")&&this.open&&this.begin()}get bulk(){return this.people.length>1}async begin(){const e=++this.generation;this.loaded="loading",this.config=null,this.recipients=[],this.draft={template_id:null,text:""},this.phase="idle",this.failure=void 0,this.retryAfterS=void 0,this.progress=null,this.outcome=null,this.sentAt="",this.held="",this.confirming=!1,this.stopping=!1,this.stopRequested=!1;const t=this.transport;if(!t){this.loaded="unavailable";return}try{const[s,i]=await Promise.all([t.config(),t.recipients(this.people.map(a=>a.id)).catch(()=>[])]);if(e!==this.generation)return;this.config={...s,templates:Ke(s.templates)},this.recipients=this.people.map(a=>({...i.find(d=>d.person_id===a.id)??{person_id:a.id,phone_masked:null,has_phone:null,consent:"unknown"},name:a.name})),this.loaded="ready"}catch{if(e!==this.generation)return;this.loaded="unavailable"}}close(){this.generation++,this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0,detail:{sent:this.phase==="sent"||(this.outcome?.sent.length??0)>0}}))}pick(e){if(this.config){if(this.phase="idle",this.failure=void 0,this.outcome=null,this.confirming=!1,!e){this.draft={template_id:null,text:this.draft.template_id===null?this.draft.text:""};return}this.draft={template_id:e.id,text:this.bulk?e.body:bs(e.body,{name:this.recipients[0]?.name??""})}}}edit(e){this.phase=this.phase==="sent"?"idle":this.phase,this.failure=void 0,this.confirming=!1,this.draft={template_id:null,text:e}}async send(){const e=this.transport;if(!e||!this.config||this.phase==="sending"||!(this.bulk?ke(this.recipients,this.config,this.draft).canSend:xe({config:this.config,recipient:this.recipients[0]??null,draft:this.draft,phase:this.phase,failure:this.failure,retryAfterS:this.retryAfterS}).canSend))return;if(this.bulk&&!this.confirming){this.confirming=!0;return}const s=this.generation,i={templates_revision:this.config.templates_revision};if(this.phase="sending",this.failure=void 0,!this.bulk){const m=await e.send(this.people[0].id,this.draft,i);if(s!==this.generation)return;m.ok?(this.phase="sent",this.sentAt=m.sent_at,this.held=m.held?m.held==="held"?"msg.held":this.draft.template_id===null?"msg.consent_requested_free":"msg.consent_requested":"",m.quota!==void 0?this.config={...this.config,quota:m.quota}:await this.refreshConfig()):(this.phase="failed",this.failure=m.reason,this.retryAfterS=m.retry_after_s,(m.reason==="rate"||m.reason==="template_changed"||m.reason==="disabled")&&(await this.refreshConfig(),m.reason==="template_changed"&&(this.draft={template_id:null,text:""})));return}const a=ke(this.recipients,this.config,this.draft);this.confirming=!1,this.progress=[0,a.send.length],this.stopRequested=!1,this.stopping=!1;const d=ys(),o=await $s(a,this.draft,(m,g)=>e.send(m,g,{...i,bulk:{id:d,total:a.send.length}}),{onProgress:(m,g)=>this.progress=[m,g],paceMs:this.config.pace_ms,sleep:this.sleep,shouldStop:()=>this.stopRequested});s===this.generation&&(this.outcome=o,this.progress=null,this.stopping=!1,this.phase="sent",await this.refreshConfig())}stop(){this.stopRequested=!0,this.stopping=!0}async refreshConfig(){try{const e=await this.transport?.config();e&&(this.config={...e,templates:Ke(e.templates)})}catch{}}renderLine(e){const t=e.line;if(!t)return l;const s=t.tone==="ok"?"check":t.tone==="wait"?"refresh":t.tone==="warn"?"clock":"warning";let i="";return t.kind==="sending"?i=r("msg.sending"):t.kind==="sent"?i=this.held?r(this.held):r("msg.sent",{time:Ze(this.sentAt)}):t.kind==="rate"?i=r("msg.rate",{minutes:t.minutes??1}):t.kind==="cant"?i=r("msg.cant",{reason:J(t.reason)}):i=t.reason==="uncertain"?r("msg.uncertain"):r("msg.failed",{reason:J(t.reason)}),n`<div class="line ${t.tone}" role=${t.tone==="err"?"alert":"status"} data-msg-line=${t.kind} data-msg-tone=${t.tone}><sw-icon name=${s} size=${16}></sw-icon><span>${i}</span></div>`}renderTemplates(e,t){return n`<div class="field">
      <span class="lbl">${r("msg.template")}</span>
      <div class="chips" role="group" aria-label=${r("msg.template")}>
        ${e.templates.map(s=>n`<button type="button" class="chip" data-msg-template=${s.id} aria-pressed=${this.draft.template_id===s.id} ?disabled=${t} @click=${()=>this.pick(s)}>${s.label}</button>`)}
        ${e.free_text?n`<button type="button" class="chip" data-msg-free aria-pressed=${this.draft.template_id===null&&this.draft.text!==""} ?disabled=${t} @click=${()=>this.pick(null)}>${r("msg.free")}</button>`:l}
      </div>
    </div>`}renderText(e,t){const s=this.bulk&&this.draft.template_id?this.draft.text.replaceAll("{name}","[שם]"):this.draft.text,i=this.draft.template_id!==null&&!e.free_text;return n`<div class="field">
      <label for="msg-text">${r("msg.text")}</label>
      <textarea id="msg-text" data-msg-text maxlength=${e.text_max} .value=${s} ?disabled=${t} ?readonly=${i}
        @input=${a=>this.edit(a.target.value)}
        @keydown=${a=>{(a.ctrlKey||a.metaKey)&&a.key==="Enter"&&(a.preventDefault(),this.send())}}></textarea>
      <span class="cnt" aria-hidden="true">${r("msg.counter",{n:this.draft.text.length,max:e.text_max})}</span>
    </div>`}renderSingle(e){const t=this.recipients[0],s=xe({config:e,recipient:t??null,draft:this.draft,phase:this.phase,failure:this.failure,retryAfterS:this.retryAfterS}),i=t?.has_phone===!1?"—":t?.phone_masked?n`<span class="ltr" data-msg-phone>${t.phone_masked}</span>`:n`<span data-msg-phone="hidden">${r("msg.phone_hidden")}</span>`,a=t?.consent==="declined"?n`<span class="pill warn" data-msg-consent="declined">${r("msg.consent_declined")}</span>`:t?.consent==="granted"?n`<span class="pill ok" data-msg-consent="granted">${r("msg.consent_granted")}</span>`:t?.consent===null?l:n`<span class="pill" data-msg-consent="unknown">${r("msg.consent_unknown")}</span>`,d=this.phase==="sending",o=this.phase==="sent"?r("msg.send_again"):this.phase==="failed"&&this.failure==="uncertain"?r("msg.send_anyway"):r("msg.send");return n`
      <div class="to" data-msg-recipient>
        <sw-avatar name=${t?.name??""} size=${40} aria-hidden="true"></sw-avatar>
        <div class="col"><b>${t?.name}</b><span class="meta">${i}${a}</span></div>
      </div>
      ${this.renderTemplates(e,s.textDisabled||d)}
      ${this.renderText(e,s.textDisabled||d)}
      ${this.renderLine(s)}
      <div slot="footer" style="display:contents">
        <sw-button variant="primary" icon="mail" data-msg-send ?disabled=${!s.canSend||d} @click=${()=>void this.send()}>${o}</sw-button>
        <sw-button data-msg-cancel @click=${()=>this.close()} ?disabled=${d}>${this.phase==="sent"?r("msg.close"):r("msg.cancel")}</sw-button>
      </div>`}renderResults(e){const t=s=>this.people.find(i=>i.id===s)?.name??s;return n`<table class="results" data-msg-results>
      <caption>${r("msg.results")}</caption>
      <thead><tr><th scope="col" class="c-name">${r("msg.result_name")}</th><th scope="col" class="c-outcome">${r("msg.result_outcome")}</th><th scope="col" class="c-detail">${r("msg.result_detail")}</th></tr></thead>
      <tbody>
        ${e.map(s=>{const i=s.status==="sent"?"ok":s.status==="unknown"||s.status==="held"?"warn":"err",a=s.status==="sent"?r("msg.result_sent"):s.status==="held"?r("msg.result_held"):s.status==="unknown"?r("msg.result_unknown"):r("msg.result_failed"),d=s.status==="sent"?Ze(s.at??""):s.status==="held"?r("msg.held"):s.status==="unknown"?r("msg.uncertain"):J(s.reason??"unknown");return n`<tr data-msg-result=${s.id} data-msg-outcome=${s.status}><td class="c-name">${t(s.id)}</td><td class="c-outcome"><span class="pill ${i}">${a}</span></td><td class="c-detail">${d}</td></tr>`})}
      </tbody>
    </table>`}renderBulk(e){const t=ke(this.recipients,e,this.draft),s=this.phase==="sending",i=t.skip.slice(0,3).map(g=>`${g.recipient.name} (${J(g.reason)})`).join(", ")+(t.skip.length>3?"…":""),a=r("msg.preview_bulk",{send:t.send.length,skip:t.skip.length?r("msg.preview_skip",{n:t.skip.length,names:i}):""}),d=this.outcome;let o=l;if(s&&this.progress)o=n`<div class="line wait" role="status" data-msg-line="sending"><sw-icon name="refresh" size=${16}></sw-icon><span>${this.stopping?r("msg.stopping"):r("msg.sending_n",{done:this.progress[0],total:this.progress[1]})}</span></div>`;else if(d){const g=ks(d),x=g.failed||g.unknown||g.held?"warn":"ok";o=n`<div class="line ${x}" role="status" data-msg-line="bulk-done" data-msg-tone=${x}><sw-icon name="check" size=${16}></sw-icon><span>${r("msg.bulk_done",{sent:g.sent,failed:(g.held?r("msg.bulk_held",{n:g.held}):"")+(g.failed?r("msg.bulk_failed",{n:g.failed}):"")+(g.unknown?r("msg.bulk_unknown",{n:g.unknown}):"")})}</span></div>`}else if(this.confirming)o=n`<div class="line warn" role="alert" data-msg-line="confirm"><sw-icon name="warning" size=${16}></sw-icon><span>${r("msg.confirm_bulk",{n:t.send.length})}</span></div>`;else if(t.tooMany)o=n`<div class="line err" role="alert" data-msg-line="too-many"><sw-icon name="warning" size=${16}></sw-icon><span>${r("msg.bulk_too_many",{max:e.bulk_max})}</span></div>`;else if(t.overQuota!==null)o=n`<div class="line warn" role="status" data-msg-line="over-quota"><sw-icon name="clock" size=${16}></sw-icon><span>${r("msg.bulk_over_quota",{n:t.overQuota})}</span></div>`;else{const g=xe({config:e,recipient:this.recipients[0]??null,draft:this.draft,phase:"idle"}).line;g?.kind==="cant"&&g.reason&&["credential","too_long","free_text_off"].includes(g.reason)?o=n`<div class="line err" role="alert" data-msg-line="cant"><sw-icon name="warning" size=${16}></sw-icon><span>${r("msg.cant",{reason:J(g.reason)})}</span></div>`:e.enabled||(o=n`<div class="line warn" role="status" data-msg-line="cant"><sw-icon name="clock" size=${16}></sw-icon><span>${r("msg.cant",{reason:J("no_service")})}</span></div>`)}const m=d?n`<sw-button variant="primary" data-msg-cancel @click=${()=>this.close()}>${r("msg.close")}</sw-button>`:s?n`<sw-button data-msg-stop icon="close" ?disabled=${this.stopping} @click=${()=>this.stop()}>${r("msg.stop")}</sw-button>`:this.confirming?n`<sw-button variant="primary" icon="mail" data-msg-confirm @click=${()=>void this.send()}>${r("msg.confirm_send")}</sw-button>
              <sw-button data-msg-back @click=${()=>this.confirming=!1}>${r("msg.back")}</sw-button>`:n`<sw-button variant="primary" icon="mail" data-msg-send ?disabled=${!t.canSend} @click=${()=>void this.send()}>${r("msg.send_n",{n:t.send.length})}</sw-button>
              <sw-button data-msg-cancel @click=${()=>this.close()}>${r("msg.cancel")}</sw-button>`;return n`
      ${d?l:this.renderTemplates(e,s||this.confirming)}
      ${d?l:this.renderText(e,s||this.confirming||!e.enabled)}
      ${d?l:n`<div class="prev" data-msg-preview><sw-icon name="users" size=${16}></sw-icon><span>${a}</span></div>`}
      ${o}
      ${d?this.renderResults(xs(this.people.map(g=>g.id),d.rows)):l}
      <div slot="footer" style="display:contents">${m}</div>`}render(){const e=this.bulk?r("msg.title_bulk",{n:this.people.length}):r("msg.title");return n`<sw-dialog wide ?open=${this.open} ?locked=${this.phase==="sending"} heading=${e} @close=${t=>{t.stopPropagation(),this.close()}} data-msg-dialog>
      ${this.loaded==="loading"?n`<div class="line wait" role="status" data-msg-line="loading"><sw-icon name="refresh" size=${16}></sw-icon><span>${r("state.detail_loading")}</span></div>`:l}
      ${this.loaded==="unavailable"||!this.config?this.loaded==="unavailable"?n`<div class="line warn" role="status" data-msg-line="cant"><sw-icon name="clock" size=${16}></sw-icon><span>${r("msg.cant",{reason:J("no_service")})}</span></div>
              <div slot="footer" style="display:contents"><sw-button data-msg-cancel @click=${()=>this.close()}>${r("msg.close")}</sw-button></div>`:l:this.bulk?this.renderBulk(this.config):this.renderSingle(this.config)}
    </sw-dialog>`}};P.styles=K`
    :host {
      display: contents;
    }
    .to {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
    }
    .to .col {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    /* R5-SECURITY: the recipient is the dialog's display line - 17/800 in the heading ink; the pills are 12.5/700 fields */
    .to b {
      font-weight: 800;
      font-size: var(--sw-fs-xl);
      letter-spacing: -0.01em;
      color: var(--sw-heading, var(--sw-text));
    }
    .to .meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px 8px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .pill.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .pill.warn {
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .pill.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field > label,
    .field > .lbl {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    /* R5-SECURITY: the template chips are raised keys (shadow 1, 600) that sink on pointer-down; the chosen one a filled accent field */
    .chip {
      min-block-size: 44px;
      padding-inline: 14px;
      border-radius: var(--sw-r-pill);
      border: 1px solid transparent;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .chip:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: transparent;
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-bold);
    }
    .chip:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: default;
    }
    .chip:focus-visible,
    textarea:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    textarea {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 120px;
      padding: 10px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
      line-height: 1.5;
      resize: vertical;
    }
    textarea:disabled {
      background: var(--sw-surface-2);
      color: var(--sw-text-3);
    }
    .cnt {
      align-self: flex-end;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-variant-numeric: tabular-nums;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .line.ok {
      background: var(--sw-success-soft);
    }
    .line.warn {
      background: var(--sw-stale-soft);
    }
    .line.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .line.wait sw-icon {
      animation: spin 1.2s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .line.wait sw-icon {
        animation: none;
      }
    }
    .prev {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    sw-button {
      min-block-size: 44px;
    }
    /* the per-recipient result table of a bulk run */
    .results {
      inline-size: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: var(--sw-fs-sm);
    }
    .results caption {
      caption-side: top;
      text-align: start;
      padding-block-end: 6px;
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .results th {
      text-align: start;
      padding: 6px 8px;
      border-block-end: 1px solid var(--sw-border-strong);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .results td {
      padding: 8px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    .results tr:last-child td {
      border-block-end: 0;
    }
    .results .c-name {
      inline-size: 36%;
    }
    .results .c-outcome {
      inline-size: 26%;
    }
    .results .c-detail {
      color: var(--sw-text-2);
    }
  `;q([_({type:Boolean,reflect:!0})],P.prototype,"open",2);q([_({attribute:!1})],P.prototype,"transport",2);q([_({attribute:!1})],P.prototype,"people",2);q([_({attribute:!1})],P.prototype,"sleep",2);q([c()],P.prototype,"loaded",2);q([c()],P.prototype,"config",2);q([c()],P.prototype,"recipients",2);q([c()],P.prototype,"draft",2);q([c()],P.prototype,"phase",2);q([c()],P.prototype,"failure",2);q([c()],P.prototype,"retryAfterS",2);q([c()],P.prototype,"sentAt",2);q([c()],P.prototype,"held",2);q([c()],P.prototype,"progress",2);q([c()],P.prototype,"outcome",2);q([c()],P.prototype,"confirming",2);q([c()],P.prototype,"stopping",2);P=q([V("wiskey-message-dialog")],P);var on=Object.defineProperty,ln=Object.getOwnPropertyDescriptor,O=(e,t,s,i)=>{for(var a=i>1?void 0:i?ln(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&on(t,s,a),a};const Qe={edit:"act.edit",deactivate:"act.deactivate",activate:"act.activate",temporary_cancel:"act.temporary_cancel",cards:"act.cards",photo:"act.photo",archive:"act.archive",restore:"act.restore",delete:"act.delete"},dn={deactivate:"confirm.deactivate",activate:"confirm.activate",temporary_cancel:"confirm.temporary_cancel",archive:"confirm.archive",restore:"confirm.restore",delete:"confirm.delete"},cn={deactivate:"lock",activate:"check",temporary_cancel:"clock",cards:"grid",photo:"image",archive:"storage",restore:"refresh",delete:"trash"};function et(e){if(e instanceof $){const t=e.body?.details?.outcome;return{status:e.status,code:e.code,outcome:typeof t=="string"?t:null}}return{status:null,code:null,outcome:null}}async function pn(e){if(!e.type.startsWith("image/"))throw new Error("not_image");const t=URL.createObjectURL(e);try{const s=await new Promise((a,d)=>{const o=new Image;o.onload=()=>a(o),o.onerror=()=>d(new Error("not_image")),o.src=t});let i=512;for(let a=0;a<4;a++,i=Math.round(i*.75)){const{width:d,height:o}=Fs(s.naturalWidth,s.naturalHeight,i),m=document.createElement("canvas");m.width=d,m.height=o;const g=m.getContext("2d");if(!g)throw new Error("not_image");g.fillStyle="#ffffff",g.fillRect(0,0,d,o),g.drawImage(s,0,0,d,o);for(const x of Us){const X=m.toDataURL("image/jpeg",x);if(Ks(X))return X}}throw new Error("too_big")}finally{URL.revokeObjectURL(t)}}let S=class extends W{constructor(){super(...arguments),this.person=null,this.kind="menu",this.actions=[],this.canCapture=!1,this.zone=ee,this.current="menu",this.step="ask",this.result=null,this.reason="visit_completed",this.editor=null,this.editorError="",this.cardNo="",this.cardLabel="",this.cardProblem=!1,this.removing=null,this.ctx=null,this.capturing=!1,this.photo={phase:"idle",data:"",problem:null},this.photoRemove=!1,this.checks=0,this.checkTimer=0,this.generation=0}connectedCallback(){super.connectedCallback(),this.current=this.kind}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.checkTimer),this.generation++}willUpdate(e){e.has("kind")&&this.select(this.kind)}select(e){this.current=e,this.step="ask",this.result=null,(e==="cards"||e==="photo")&&this.loadEditor()}fire(e){this.dispatchEvent(new CustomEvent("action-result",{detail:e,bubbles:!0,composed:!0}))}close(){this.step!=="working"&&(window.clearTimeout(this.checkTimer),this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0})))}async loadEditor(){const e=this.person;if(!e)return;const t=++this.generation;this.editor=null,this.editorError="";try{const[s,i]=await Promise.all([we(e.id),this.current==="cards"&&this.canCapture?ut().catch(()=>null):Promise.resolve(null)]);if(t!==this.generation)return;this.editor=s.person,s.person||(this.editorError=h("err.unavailable")),this.ctx=i?.context??null}catch(s){if(t!==this.generation)return;this.editorError=h(Ye(et(s)).reason)}}revision(){return this.editor?.revision??this.person?.revision??0}async write(e,t){const s=this.person;if(!(!s||this.step==="working")){this.step="working",this.result=null;try{const i=await t(),a=Pe(i),d="person"in i?i.person:null;if(d&&(this.editor=d),e==="delete"&&a==="pending"){this.result={state:"pending",text:h("res.pending")},this.step="checking",this.checks=0,this.fire({kind:e,id:s.id,state:"pending",text:this.result.text,person:null}),this.scheduleCheck(s.id);return}const o=a==="pending"?h("res.pending"):h("res.saved",{time:Q(new Date().toISOString(),this.zone)});this.result={state:a,text:o},this.step="done",this.fire({kind:e,id:s.id,state:a,text:o,person:d})}catch(i){const a=Ye(et(i)),d=a.state==="unknown"?h("res.unknown"):h(a.state==="not_sent"?"res.not_sent":"res.refused",{reason:h(a.reason)});this.result={state:a.state,text:d},this.step="done",this.fire({kind:e,id:s.id,state:a.state,text:d,person:null})}}}scheduleCheck(e){window.clearTimeout(this.checkTimer),this.checkTimer=window.setTimeout(()=>void this.check(e),wt)}async check(e){let t=200;try{await he(e)}catch(s){t=s instanceof $?s.status:0}if(this.isConnected){if(gt(t)==="confirmed"){this.result={state:"deleted",text:h("res.deleted")},this.step="done",this.fire({kind:"delete",id:e,state:"deleted",text:this.result.text,person:null});return}this.checks++,this.checks<Te?this.scheduleCheck(e):this.result={state:"pending",text:h("res.still_pending")}}}confirm(){const e=this.person;if(!e)return;const t=this.revision();switch(this.current){case"deactivate":return void this.write("deactivate",()=>He(e.id,t,!1));case"activate":return void this.write("activate",()=>He(e.id,t,!0));case"archive":return void this.write("archive",()=>ti(e.id,t));case"restore":return void this.write("restore",()=>si(e.id,t));case"temporary_cancel":return void this.write("temporary_cancel",()=>ii(e.id,t,this.reason));case"delete":return void this.write("delete",()=>ht(e.id,t))}}addCard(){const e=this.person;if(!e||!this.editor)return;if(!qs(this.cardNo)){this.cardProblem=!0;return}const t={card_no:this.cardNo.trim(),label:this.cardLabel.trim(),enabled:!0};this.write("cards",()=>ni(e.id,this.revision(),t)).then(()=>{(this.result?.state==="saved"||this.result?.state==="pending")&&(this.cardNo="",this.cardLabel="")})}removeCard(e){const t=this.person;t&&(this.removing=null,this.write("cards",()=>ai(t.id,this.revision(),e)))}async pickPhoto(e){const t=e.target,s=t.files?.[0];if(t.value="",!!s){this.photo={phase:"processing",data:"",problem:null};try{const i=await pn(s);this.photo={phase:"ready",data:i,problem:null}}catch(i){this.photo={phase:"error",data:"",problem:i.message==="too_big"?"photo.too_big":"photo.not_image"}}}}savePhoto(e){const t=this.person;if(!t)return;const s=e?null:this.photo.data;!e&&!s||(this.photoRemove=!1,this.write("photo",()=>ri(t.id,this.revision(),s)).then(()=>{(this.result?.state==="saved"||this.result?.state==="pending")&&(this.photo={phase:"idle",data:"",problem:null})}))}captured(){this.capturing=!1;const e=this.editor?.cards?.length??0,t=this.person;t&&(this.result={state:"pending",text:h("res.pending")},we(t.id).then(s=>{if(!s.person)return;this.editor=s.person;const i=(s.person.cards?.length??0)>e;this.result=i?{state:"saved",text:h("res.saved",{time:Q(new Date().toISOString(),this.zone)})}:{state:"pending",text:h("res.still_pending")},this.fire({kind:"cards",id:t.id,state:this.result.state,text:this.result.text,person:s.person})}).catch(()=>{}))}render(){const e=this.person;if(!e)return l;const t=this.current,s=h(t==="menu"?"actions.heading":Qe[t]);return n`<sw-dialog open heading=${s} subheading=${e.display_name} ?locked=${this.step==="working"} data-person-actions=${t} data-person-actions-step=${this.step}
        @close=${i=>{i.stopPropagation(),this.close()}}>
        ${t==="menu"?this.renderMenu():t==="cards"?this.renderCards():t==="photo"?this.renderPhoto():this.renderAsk(t)}
        ${this.result?n`<p class="result ${this.result.state}" role="status" data-action-result=${this.result.state}>${this.result.text}</p>`:l}
        <div slot="footer" class="footer">${this.renderFooter(t)}</div>
      </sw-dialog>
      ${this.capturing&&this.editor&&this.ctx?n`<wiskey-card-capture .person=${this.editor} .stations=${this.ctx.stations.filter(i=>(this.ctx?.capture_stations??[]).includes(i.id))}
            @capture-close=${()=>this.capturing=!1} @capture-saved=${()=>this.captured()} @capture-reload=${()=>{this.capturing=!1,this.loadEditor()}}></wiskey-card-capture>`:l}`}renderMenu(){const e=this.actions.filter(t=>t!=="edit");return n`<div class="menu">
      ${e.map(t=>n`<button type="button" class="item ${t==="delete"?"danger":""}" data-person-action=${t} @click=${()=>this.select(t)}>
        <sw-icon name=${cn[t]??"chevron"} size=${18}></sw-icon><span>${h(Qe[t])}</span></button>`)}
    </div>`}renderAsk(e){const t=this.person,s=dn[e];return n`${s&&this.step==="ask"?n`<p class="ask" data-action-question>${h(s,{name:t.display_name})}</p>`:l}
      ${e==="temporary_cancel"&&this.step==="ask"?n`<sw-field label=${h("reason.label")}>
            <select data-action-reason .value=${b(this.reason)} @change=${i=>this.reason=i.target.value}>
              ${ei.map(i=>n`<option value=${i} ?selected=${i===this.reason}>${h(`reason.${i}`)}</option>`)}
            </select>
          </sw-field>`:l}`}renderCards(){const e=this.editor;if(this.editorError)return n`<p class="result refused" role="status" data-cards-error>${this.editorError}</p>`;if(!e)return n`<p class="muted" role="status" data-cards-loading>${h("cards.loading")}</p>`;const t=e.cards??[];return n`<ul class="cards" data-person-cards>
        ${t.length===0?n`<li class="muted" data-cards-none>${h("cards.none")}</li>`:l}
        ${t.map(s=>n`<li class="card" data-person-card=${s.id}>
          <bdi class="mask" dir="ltr">${s.masked_number}</bdi>
          <span class="label">${s.label}</span>
          ${s.enabled?l:n`<span class="muted">${h("cards.disabled")}</span>`}
          ${this.removing===s.id?n`<span class="inline-ask"><span>${h("confirm.remove_card",{mask:s.masked_number})}</span>
                <sw-button size="sm" variant="danger" data-card-remove-confirm ?disabled=${this.step==="working"} @click=${()=>this.removeCard(s.id)}>${h("btn.remove")}</sw-button>
                <sw-button size="sm" variant="ghost" @click=${()=>this.removing=null}>${h("btn.cancel")}</sw-button></span>`:n`<sw-button size="sm" variant="ghost" icon="trash" data-card-remove ?disabled=${this.step==="working"} @click=${()=>this.removing=s.id}>${h("btn.remove")}</sw-button>`}
        </li>`)}
      </ul>
      <div class="add" data-card-add-form>
        <sw-field label=${h("cards.number")} hint=${this.cardProblem?h("err.card_invalid"):""}>
          <input data-card-number dir="ltr" autocomplete="off" maxlength="32" .value=${b(this.cardNo)} aria-invalid=${this.cardProblem?"true":"false"}
            @input=${s=>{this.cardNo=s.target.value,this.cardProblem=!1}} />
        </sw-field>
        <sw-field label=${h("cards.label")}>
          <input data-card-label maxlength="64" .value=${b(this.cardLabel)} @input=${s=>this.cardLabel=s.target.value} />
        </sw-field>
      </div>`}renderPhoto(){const e=this.editor;if(this.editorError)return n`<p class="result refused" role="status" data-photo-error>${this.editorError}</p>`;const t=this.photo;return n`<div class="photo" data-person-photo-form>
      <div class="frame" aria-label=${h("photo.preview")}>${t.phase==="ready"?n`<img src=${t.data} alt=${h("photo.preview")} data-photo-preview />`:n`<sw-icon name="user" size=${40}></sw-icon>`}</div>
      <div class="col">
        <label class="pick">
          <input type="file" accept="image/*" data-photo-input @change=${s=>void this.pickPhoto(s)} ?disabled=${this.step==="working"} />
          <span>${h("btn.choose_photo")}</span>
        </label>
        ${t.phase==="processing"?n`<span class="muted" role="status">${h("photo.processing")}</span>`:l}
        ${t.phase==="error"&&t.problem?n`<span class="result refused" role="status" data-photo-problem=${t.problem}>${h(t.problem)}</span>`:l}
        ${e&&e.photo_configured===!1&&t.phase!=="ready"?n`<span class="muted">${h("photo.none")}</span>`:l}
        ${this.photoRemove?n`<span class="ask">${h("confirm.remove_photo",{name:this.person?.display_name??""})}</span>`:l}
      </div>
    </div>`}renderFooter(e){const t=this.step==="working",s=n`<sw-button variant="ghost" data-action-close ?disabled=${t} @click=${()=>this.close()}>${h(this.result?"btn.close":"btn.cancel")}</sw-button>`;if(e==="menu")return s;if(e==="cards"){const i=this.canCapture&&(this.ctx?.capture_stations?.length??0)>0?n`<sw-button icon="wifi" data-card-read ?disabled=${t||!this.editor} @click=${()=>this.capturing=!0}>${h("btn.read_card")}</sw-button>`:l;return n`${s}${i}<sw-button variant="primary" icon="plus" data-card-add ?disabled=${t||!this.editor||!this.cardNo.trim()} @click=${()=>this.addCard()}>${h(t?"btn.working":"btn.add_card")}</sw-button>`}if(e==="photo"){const a=this.editor?.photo_configured?this.photoRemove?n`<sw-button variant="danger" data-photo-remove-confirm ?disabled=${t} @click=${()=>this.savePhoto(!0)}>${h("btn.remove_photo")}</sw-button>`:n`<sw-button variant="ghost" icon="trash" data-photo-remove ?disabled=${t} @click=${()=>this.photoRemove=!0}>${h("btn.remove_photo")}</sw-button>`:l;return n`${s}${a}<sw-button variant="primary" icon="check" data-photo-save ?disabled=${t||this.photo.phase!=="ready"} @click=${()=>this.savePhoto(!1)}>${h(t?"btn.working":"btn.save_photo")}</sw-button>`}if(this.step==="ask")return n`${s}<sw-button variant=${e==="delete"||e==="archive"||e==="deactivate"||e==="temporary_cancel"?"danger":"primary"} data-action-confirm
        @click=${()=>this.confirm()}>${h("btn.confirm")}</sw-button>`;if(this.step==="checking"||e==="delete"&&this.result?.state==="pending"){const i=this.person?.id??"";return n`${s}<sw-button variant="ghost" icon="refresh" data-action-check ?disabled=${this.step==="checking"&&this.checks<Te} @click=${()=>{this.checks=0,this.check(i)}}>${h("btn.check")}</sw-button>`}return t?n`<sw-button variant="primary" disabled>${h("btn.working")}</sw-button>`:s}};S.styles=K`
    .menu {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 46px;
      padding-inline: 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      text-align: start;
      cursor: pointer;
      /* R5-SECURITY: the menu items are raised keys (shadow 1) that sink on pointer-down; a hover only under a fine pointer */
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    @media (hover: hover) and (pointer: fine) {
      .item:hover {
        background: var(--sw-surface-2);
      }
    }
    .item:active {
      transform: scale(var(--sw-press-scale));
    }
    .item.danger {
      background: var(--sw-danger-soft);
    }
    .item:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .item.danger {
      color: var(--sw-danger-text);
    }
    .ask {
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .result {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
    }
    .result.saved,
    .result.deleted {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    .result.pending,
    .result.unknown {
      background: var(--sw-stale-soft);
      color: var(--sw-text);
    }
    .result.refused,
    .result.not_sent {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .cards {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .card {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      padding: 8px 12px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      min-block-size: 44px;
    }
    .card .mask {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--sw-text));
      direction: ltr;
      unicode-bidi: isolate;
    }
    .card .label {
      flex: 1 1 6rem;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .inline-ask {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      flex-basis: 100%;
      font-size: var(--sw-fs-sm);
    }
    .add {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 10px;
    }
    @media (max-width: 480px) {
      .add {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    input,
    select {
      font: inherit;
      min-block-size: 44px;
      box-sizing: border-box;
      inline-size: 100%;
    }
    .photo {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .frame {
      display: grid;
      place-items: center;
      inline-size: 96px;
      block-size: 96px;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      border: 2px solid var(--sw-border);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
      flex: 1 1 10rem;
    }
    .pick {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-block-size: 44px;
      padding-inline: 14px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      cursor: pointer;
      font-size: var(--sw-fs-sm);
      position: relative;
    }
    .pick input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      min-block-size: 0;
    }
    .pick:focus-within {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    sw-button {
      min-block-size: 44px;
    }
  `;O([_({attribute:!1})],S.prototype,"person",2);O([_()],S.prototype,"kind",2);O([_({attribute:!1})],S.prototype,"actions",2);O([_({type:Boolean})],S.prototype,"canCapture",2);O([_({attribute:!1})],S.prototype,"zone",2);O([c()],S.prototype,"current",2);O([c()],S.prototype,"step",2);O([c()],S.prototype,"result",2);O([c()],S.prototype,"reason",2);O([c()],S.prototype,"editor",2);O([c()],S.prototype,"editorError",2);O([c()],S.prototype,"cardNo",2);O([c()],S.prototype,"cardLabel",2);O([c()],S.prototype,"cardProblem",2);O([c()],S.prototype,"removing",2);O([c()],S.prototype,"ctx",2);O([c()],S.prototype,"capturing",2);O([c()],S.prototype,"photo",2);O([c()],S.prototype,"photoRemove",2);S=O([V("wiskey-person-actions")],S);const L="access-control/bulk-people";function tt(){const e=new Uint8Array(16);return crypto.getRandomValues(e),Array.from(e,t=>t.toString(16).padStart(2,"0")).join("")}const xt=()=>ne(`${L}/settings`),un=e=>_e(`${L}/settings`,{enabled:e});function hn(e,t){return Re(`${L}/jobs`,{method:"POST",body:e,headers:{"Content-Type":"text/csv","Idempotency-Key":t}})}function fn(e,t){return Re(`${L}/jobs/edit`,{method:"POST",body:JSON.stringify(e),headers:{"Idempotency-Key":t}})}const mn=e=>I(`${L}/jobs/${encodeURIComponent(e)}/dry-run`),gn=(e,t,s)=>I(`${L}/jobs/${encodeURIComponent(e)}/confirm`,{plan_digest:t,confirm:s}),wn=e=>I(`${L}/jobs/${encodeURIComponent(e)}/apply`),vn=e=>I(`${L}/jobs/${encodeURIComponent(e)}/cancel`);async function zt(e){const t=await fetch(Ut(e),{credentials:"same-origin"});if(!t.ok){let i={};try{i=await t.json()}catch{i={}}throw new $(t.status,{code:i.code??`http_${t.status}`,user_message:i.user_message??"",retryable:i.retryable??!1,correlation_id:i.correlation_id??"",details:i.details??{}})}const s=t.headers.get("X-Export-Rows");return{blob:await t.blob(),rows:s===null?null:Number(s)}}const _n=()=>zt(`${L}/export.csv`),bn=()=>zt(`${L}/template.csv`),yn=e=>_e(`${L}/wiskey-csv/settings`,{enabled:e});function $n(e,t){return Re(`${L}/jobs/${encodeURIComponent(e)}/wiskey-preview`,{method:"POST",body:t,headers:{"Content-Type":"text/csv"}})}const kn=(e,t,s)=>I(`${L}/jobs/${encodeURIComponent(e)}/wiskey-confirm`,{preview_digest:t,confirm:s}),st=e=>ne(`${L}/jobs/${encodeURIComponent(e)}/wiskey-result`),Ct=8,xn=1500,zn=20;function Cn(e){const t=e?.wiskey_csv;return!t||t.enabled!=="on"?"off":t.available&&e?.may_import===!0?"ready":"blocked"}const Sn={switch_off:"v_blocker_switch_off",bulk_people_off:"v_blocker_bulk_people_off",binding_not_configured:"v_blocker_binding_not_configured",direct_not_installed:"v_blocker_direct_not_installed",direct_not_selected:"v_blocker_direct_not_selected"};function En(e){return Sn[e]??"v_blocker_direct_not_selected"}function St(e,t=Ct){return Math.max(1,Math.ceil(e/t))}function Pn(e,t,s=Ct){const i=St(e.length,s)-1,a=Math.min(Math.max(0,t),i);return e.slice(a*s,a*s+s)}function it(e,t,s){if(e.writes<=0||t.trim()!==String(e.writes))return!1;const i=Date.parse(e.expires_at);return Number.isFinite(i)&&i>s}function Tn(e){switch(e.state){case"running":return{key:"v_result_running"};case"finished":return typeof e.saved=="number"?{key:"v_result_finished",n:e.saved}:{key:"v_result_done"};case"cancelled":return{key:"v_result_cancelled"};case"not_started":return{key:"v_none"};default:return{key:"v_result_unknown"}}}function On(e,t){return e!==null&&e.state==="running"&&t<zn}function Rn(e,t){const s=Date.parse(e);return Number.isFinite(s)?new Date(s).toLocaleTimeString(t,{hour:"2-digit",minute:"2-digit"}):e}const De={open:"ייבוא וייצוא",title:"ייבוא, ייצוא ושינוי מרוכז",tab_import:"ייבוא מקובץ",tab_export:"ייצוא",edit_open:"שינוי מרוכז",no_secrets:"קודים, כרטיסים ותמונות אינם נטענים מקובץ ואינם מיוצאים לקובץ.",off_title:"שינוי מרוכז כבוי",off_text:"מנהל מערכת יכול להפעיל ייבוא, ייצוא ושינוי מרוכז של אנשים.",off_enable:"הפעלה",permit_missing:"הכתיבה לבקרת הכניסה דורשת אישור הפעלה נפרד מבעל המערכת. עד אז אפשר לבדוק קבצים ולראות תצוגה מקדימה בלבד.",template:"הורדת תבנית",export_btn:"ייצוא לקובץ",export_hint:"רק האנשים שמותר לך לראות. הטלפון מוסתר חלקית. אפשר לייצא פעם בדקה.",export_done:"יוצאו {n} אנשים",choose_file:"בחירת קובץ CSV",file_hint:"עד {rows} שורות ועד {kb} ק״ב. שורה בלי מזהה יוצרת אדם חדש; שורה עם מזהה מעדכנת רק את האדם הזה.",uploading:"בודק את הקובץ…",report_title:"בדיקת הקובץ",report_ok:"{n} תקינות",report_skip:"{n} ללא שינוי",report_error:"{n} עם שגיאה",row:"שורה {n}",dry_run:"תצוגה מקדימה",dry_running:"משווה מול בקרת הכניסה…",dry_title:"מה ישתנה",will_create:"{n} חדשים",will_update:"{n} עדכונים",unchanged:"{n} ללא שינוי",errors:"{n} לא ייכתבו",before:"לפני",after:"אחרי",hidden:"מוסתר",confirm_title:"אישור כתיבה",confirm_text:"ייכתבו {n} שורות לבקרת הכניסה. להמשך הקלידו את המספר {n}.",confirm_label:"מספר השורות",confirm_btn:"אישור",confirm_admin_only:"האישור שמור למנהל מערכת. שלחו לו את הקישור למשימה.",apply:"כתיבה",applying:"נכתבו {done} מתוך {total}",paused:"הכתיבה נעצרה באמצע. אפשר להמשיך.",stalled:"בקרת הכניסה לא זמינה כרגע. נסו להמשיך מאוחר יותר.",resume:"המשך",done_title:"הכתיבה הסתיימה",cancel:"ביטול המשימה",close:"סגירה",back:"חזרה",outcome_ok:"נכתב",outcome_failed:"לא נכתב",outcome_unknown:"לא ידוע",outcome_not_sent:"לא נשלח",unknown_hint:"שורה שתוצאתה לא ידועה לא נשלחת שוב. בדקו את האדם ברשימה לפני כל שינוי נוסף.",edit_title:"שינוי מרוכז · {n} אנשים",edit_validity:"תוקף",edit_from:"מתאריך",edit_until:"עד תאריך",edit_doors_add:"הוספת עמדה",edit_doors_remove:"הסרת עמדה",edit_relays:"דלתות",edit_groups_add:"הוספה לקבוצה",edit_groups_remove:"הסרה מקבוצה",edit_active:"מצב",edit_keep:"ללא שינוי",edit_activate:"הפעלה",edit_deactivate:"השבתה",edit_stage:"המשך לתצוגה מקדימה",edit_nochange:"לא נבחר שינוי.",field_person_id:"מזהה",field_revision:"גרסה",field_employee_no:"מספר עובד",field_display_name:"שם",field_phone:"טלפון",field_access_category:"סוג",field_responsible_person:"אחראי",field_access_purpose:"מטרה",field_active:"פעיל",field_valid_from:"מתאריך",field_valid_until:"עד",field_doors:"דלתות",field_groups:"קבוצות",field_group_ids:"קבוצות",field_door_permissions:"דלתות",code_formula_like:"ערך שנראה כנוסחה",code_invalid:"ערך לא תקין",code_validity_pair:"יש למלא גם התחלה וגם סוף",code_validity:"תאריך לא תקין",code_required:"שדה חובה",code_duplicate_person:"האדם מופיע יותר מפעם אחת",code_duplicate_employee_no:"מספר עובד כפול בקובץ",code_guest_responsible_required:"למבקר או לקבלן נדרש אחראי",code_invalid_validity:"למבקר או לקבלן נדרש תאריך סיום",code_doors:"דלתות לא תקינות",code_groups:"קבוצות לא תקינות",code_active:"ערך פעיל לא תקין",code_access_category:"סוג לא מוכר",code_person_id:"מזהה לא תקין",code_revision:"גרסה לא תקינה",code_revision_without_person:"גרסה בלי מזהה",code_cell_too_long:"ערך ארוך מדי",code_control_character:"תו לא חוקי",code_too_many_cells:"יותר מדי עמודות בשורה",code_nothing_to_change:"אין מה לשנות",code_unchanged:"ללא שינוי",code_not_found:"האדם לא נמצא",code_scope:"האדם או העמדה אינם בניהולך",code_field_level:"נדרשת הרשאה לפרטים רגישים",code_revision_conflict:"האדם השתנה מאז הייצוא",code_employee_conflict:"מספר העובד כבר קיים",code_projection_restricted:"הרשאות האדם אינן גלויות במלואן",code_unknown_group:"קבוצה לא מוכרת",code_group_stations_unknown:"עמדות הקבוצה לא ידועות",code_plan_changed:"הנתונים השתנו מאז התצוגה המקדימה",code_refused:"בקרת הכניסה דחתה את השורה",code_generic:"שגיאה",v_title:"אימות מול בקרת הכניסה",v_enable:"הפעלת אימות הקובץ",v_btn:"אימות הקובץ",v_running:"מאמת…",v_will_write:"{n} ייכתבו",v_line:"שורה {n} בקובץ",v_op_create:"אדם חדש",v_op_update:"עדכון",v_expires:"בתוקף עד {t}",v_confirm_btn:"אישור וכתיבה",v_sent:"נשלח",v_result_running:"בביצוע…",v_result_finished:"נכתבו {n}",v_result_done:"הושלם",v_result_unknown:"התוצאה לא ידועה. לא נשלח שוב.",v_result_cancelled:"בוטל",v_check:"בדיקת תוצאה",v_prev:"הקודם",v_next:"הבא",v_page:"{a} מתוך {b}",v_admin_only:"רק מנהל מערכת יכול לאשר.",v_blocker_switch_off:"האימות כבוי",v_blocker_bulk_people_off:"שינוי מרוכז כבוי",v_blocker_binding_not_configured:"חסרה הגדרת סמכות",v_blocker_direct_not_installed:"אין חיבור ישיר",v_blocker_direct_not_selected:"החיבור הישיר אינו זמין",v_none:"אין שורות לכתיבה",v_mode_note:"רק אנשים חדשים"},Dn={open:"Import & export",title:"Import, export and bulk edit",tab_import:"Import a file",tab_export:"Export",edit_open:"Bulk edit",no_secrets:"Codes, cards and photos are never read from a file and never exported.",off_title:"Bulk changes are off",off_text:"A system administrator can switch on importing, exporting and bulk editing people.",off_enable:"Switch on",permit_missing:"Writing to access control needs a separate go-live approval from the owner. Until then you can check files and see a preview only.",template:"Download template",export_btn:"Export to file",export_hint:"Only the people you may see. Phone numbers are partly hidden. One export a minute.",export_done:"{n} people exported",choose_file:"Choose a CSV file",file_hint:"Up to {rows} rows and {kb} KB. A row without an id creates a person; a row with an id updates only that person.",uploading:"Checking the file…",report_title:"File check",report_ok:"{n} valid",report_skip:"{n} without change",report_error:"{n} with errors",row:"Row {n}",dry_run:"Preview",dry_running:"Comparing with access control…",dry_title:"What will change",will_create:"{n} new",will_update:"{n} updates",unchanged:"{n} unchanged",errors:"{n} will not be written",before:"Before",after:"After",hidden:"Hidden",confirm_title:"Confirm writing",confirm_text:"{n} rows will be written to access control. Type the number {n} to continue.",confirm_label:"Number of rows",confirm_btn:"Confirm",confirm_admin_only:"Confirming is reserved for a system administrator. Send them the job.",apply:"Write",applying:"{done} of {total} written",paused:"Writing stopped part-way. You can continue.",stalled:"Access control is not available right now. Try continuing later.",resume:"Continue",done_title:"Writing finished",cancel:"Cancel the job",close:"Close",back:"Back",outcome_ok:"Written",outcome_failed:"Not written",outcome_unknown:"Unknown",outcome_not_sent:"Not sent",unknown_hint:"A row with an unknown result is never sent again. Check the person in the list before any further change.",edit_title:"Bulk edit · {n} people",edit_validity:"Validity",edit_from:"From",edit_until:"Until",edit_doors_add:"Add a station",edit_doors_remove:"Remove a station",edit_relays:"Doors",edit_groups_add:"Add to a group",edit_groups_remove:"Remove from a group",edit_active:"State",edit_keep:"No change",edit_activate:"Activate",edit_deactivate:"Deactivate",edit_stage:"Continue to preview",edit_nochange:"No change selected.",field_person_id:"Id",field_revision:"Revision",field_employee_no:"Employee no.",field_display_name:"Name",field_phone:"Phone",field_access_category:"Kind",field_responsible_person:"Responsible",field_access_purpose:"Purpose",field_active:"Active",field_valid_from:"From",field_valid_until:"Until",field_doors:"Doors",field_groups:"Groups",field_group_ids:"Groups",field_door_permissions:"Doors",code_formula_like:"Looks like a formula",code_invalid:"Invalid value",code_validity_pair:"Fill in both start and end",code_validity:"Invalid date",code_required:"Required",code_duplicate_person:"The person appears more than once",code_duplicate_employee_no:"Employee number repeated in the file",code_guest_responsible_required:"A visitor or contractor needs a responsible person",code_invalid_validity:"A visitor or contractor needs an end date",code_doors:"Invalid doors",code_groups:"Invalid groups",code_active:"Invalid active value",code_access_category:"Unknown kind",code_person_id:"Invalid id",code_revision:"Invalid revision",code_revision_without_person:"Revision without an id",code_cell_too_long:"Value too long",code_control_character:"Invalid character",code_too_many_cells:"Too many columns in the row",code_nothing_to_change:"Nothing to change",code_unchanged:"Unchanged",code_not_found:"Person not found",code_scope:"The person or station is not yours to manage",code_field_level:"Needs the sensitive-details permission",code_revision_conflict:"The person changed since the export",code_employee_conflict:"The employee number already exists",code_projection_restricted:"The person's access is not fully visible",code_unknown_group:"Unknown group",code_group_stations_unknown:"The group's stations are unknown",code_plan_changed:"The data changed since the preview",code_refused:"Access control refused the row",code_generic:"Error",v_title:"Verify with access control",v_enable:"Turn on file verification",v_btn:"Verify file",v_running:"Verifying…",v_will_write:"{n} will be written",v_line:"File line {n}",v_op_create:"New person",v_op_update:"Update",v_expires:"Valid until {t}",v_confirm_btn:"Confirm and write",v_sent:"Sent",v_result_running:"In progress…",v_result_finished:"{n} written",v_result_done:"Completed",v_result_unknown:"Result unknown. Not sent again.",v_result_cancelled:"Cancelled",v_check:"Check result",v_prev:"Previous",v_next:"Next",v_page:"{a} of {b}",v_admin_only:"Only a system administrator can confirm.",v_blocker_switch_off:"Verification is off",v_blocker_bulk_people_off:"Bulk changes are off",v_blocker_binding_not_configured:"Authority setting missing",v_blocker_direct_not_installed:"No direct connection",v_blocker_direct_not_selected:"Direct connection unavailable",v_none:"No rows to write",v_mode_note:"New people only"},An={open:"استيراد وتصدير",title:"استيراد وتصدير وتعديل جماعي",tab_import:"استيراد من ملف",tab_export:"تصدير",edit_open:"تعديل جماعي",no_secrets:"الرموز والبطاقات والصور لا تُقرأ من ملف ولا تُصدَّر إليه.",off_title:"التعديل الجماعي متوقف",off_text:"يمكن لمدير النظام تشغيل استيراد الأشخاص وتصديرهم وتعديلهم جماعيًا.",off_enable:"تشغيل",permit_missing:"الكتابة إلى نظام التحكم بالدخول تتطلب موافقة تشغيل منفصلة من المالك. حتى ذلك الحين يمكن فحص الملفات والمعاينة فقط.",template:"تنزيل القالب",export_btn:"تصدير إلى ملف",export_hint:"فقط الأشخاص المسموح لك برؤيتهم. أرقام الهاتف مخفية جزئيًا. تصدير واحد كل دقيقة.",export_done:"تم تصدير {n} أشخاص",choose_file:"اختيار ملف CSV",file_hint:"حتى {rows} صف و{kb} كيلوبايت. صف بلا معرّف ينشئ شخصًا جديدًا؛ صف بمعرّف يحدّث هذا الشخص فقط.",uploading:"جارٍ فحص الملف…",report_title:"فحص الملف",report_ok:"{n} سليمة",report_skip:"{n} بلا تغيير",report_error:"{n} بها أخطاء",row:"صف {n}",dry_run:"معاينة",dry_running:"جارٍ المقارنة مع نظام التحكم بالدخول…",dry_title:"ما الذي سيتغير",will_create:"{n} جديد",will_update:"{n} تحديث",unchanged:"{n} بلا تغيير",errors:"{n} لن تُكتب",before:"قبل",after:"بعد",hidden:"مخفي",confirm_title:"تأكيد الكتابة",confirm_text:"ستُكتب {n} صفوف إلى نظام التحكم بالدخول. اكتب الرقم {n} للمتابعة.",confirm_label:"عدد الصفوف",confirm_btn:"تأكيد",confirm_admin_only:"التأكيد محصور بمدير النظام. أرسل إليه المهمة.",apply:"كتابة",applying:"كُتب {done} من {total}",paused:"توقفت الكتابة في المنتصف. يمكن المتابعة.",stalled:"نظام التحكم بالدخول غير متاح الآن. حاول المتابعة لاحقًا.",resume:"متابعة",done_title:"انتهت الكتابة",cancel:"إلغاء المهمة",close:"إغلاق",back:"رجوع",outcome_ok:"كُتب",outcome_failed:"لم يُكتب",outcome_unknown:"غير معروف",outcome_not_sent:"لم يُرسل",unknown_hint:"الصف ذو النتيجة غير المعروفة لا يُرسل مرة أخرى. تحقق من الشخص في القائمة قبل أي تغيير آخر.",edit_title:"تعديل جماعي · {n} أشخاص",edit_validity:"الصلاحية",edit_from:"من",edit_until:"حتى",edit_doors_add:"إضافة محطة",edit_doors_remove:"إزالة محطة",edit_relays:"الأبواب",edit_groups_add:"إضافة إلى مجموعة",edit_groups_remove:"إزالة من مجموعة",edit_active:"الحالة",edit_keep:"بلا تغيير",edit_activate:"تفعيل",edit_deactivate:"تعطيل",edit_stage:"المتابعة إلى المعاينة",edit_nochange:"لم يُختر أي تغيير.",field_person_id:"المعرّف",field_revision:"الإصدار",field_employee_no:"رقم الموظف",field_display_name:"الاسم",field_phone:"الهاتف",field_access_category:"النوع",field_responsible_person:"المسؤول",field_access_purpose:"الغرض",field_active:"نشط",field_valid_from:"من",field_valid_until:"حتى",field_doors:"الأبواب",field_groups:"المجموعات",field_group_ids:"المجموعات",field_door_permissions:"الأبواب",code_formula_like:"قيمة تشبه صيغة",code_invalid:"قيمة غير صالحة",code_validity_pair:"املأ البداية والنهاية معًا",code_validity:"تاريخ غير صالح",code_required:"حقل إلزامي",code_duplicate_person:"الشخص مذكور أكثر من مرة",code_duplicate_employee_no:"رقم موظف مكرر في الملف",code_guest_responsible_required:"الزائر أو المقاول يحتاج إلى مسؤول",code_invalid_validity:"الزائر أو المقاول يحتاج إلى تاريخ انتهاء",code_doors:"أبواب غير صالحة",code_groups:"مجموعات غير صالحة",code_active:"قيمة نشط غير صالحة",code_access_category:"نوع غير معروف",code_person_id:"معرّف غير صالح",code_revision:"إصدار غير صالح",code_revision_without_person:"إصدار بلا معرّف",code_cell_too_long:"القيمة طويلة جدًا",code_control_character:"حرف غير مسموح",code_too_many_cells:"أعمدة كثيرة في الصف",code_nothing_to_change:"لا شيء لتغييره",code_unchanged:"بلا تغيير",code_not_found:"الشخص غير موجود",code_scope:"الشخص أو المحطة ليسا ضمن إدارتك",code_field_level:"يتطلب صلاحية التفاصيل الحساسة",code_revision_conflict:"تغيّر الشخص منذ التصدير",code_employee_conflict:"رقم الموظف موجود بالفعل",code_projection_restricted:"صلاحيات الشخص غير مرئية بالكامل",code_unknown_group:"مجموعة غير معروفة",code_group_stations_unknown:"محطات المجموعة غير معروفة",code_plan_changed:"تغيرت البيانات منذ المعاينة",code_refused:"رفض نظام التحكم بالدخول الصف",code_generic:"خطأ",v_title:"التحقق مع نظام التحكم بالدخول",v_enable:"تشغيل التحقق من الملف",v_btn:"التحقق من الملف",v_running:"جارٍ التحقق…",v_will_write:"سيتم كتابة {n}",v_line:"سطر الملف {n}",v_op_create:"شخص جديد",v_op_update:"تحديث",v_expires:"صالح حتى {t}",v_confirm_btn:"تأكيد وكتابة",v_sent:"أُرسل",v_result_running:"قيد التنفيذ…",v_result_finished:"تمت كتابة {n}",v_result_done:"اكتمل",v_result_unknown:"النتيجة غير معروفة. لم يُرسل مجددًا.",v_result_cancelled:"أُلغي",v_check:"فحص النتيجة",v_prev:"السابق",v_next:"التالي",v_page:"{a} من {b}",v_admin_only:"مدير النظام فقط يمكنه التأكيد.",v_blocker_switch_off:"التحقق متوقف",v_blocker_bulk_people_off:"التغيير الجماعي متوقف",v_blocker_binding_not_configured:"إعداد الصلاحية ناقص",v_blocker_direct_not_installed:"لا يوجد اتصال مباشر",v_blocker_direct_not_selected:"الاتصال المباشر غير متاح",v_none:"لا توجد صفوف للكتابة",v_mode_note:"أشخاص جدد فقط"},In={open:"Импорт и экспорт",title:"Импорт, экспорт и массовое изменение",tab_import:"Импорт из файла",tab_export:"Экспорт",edit_open:"Массовое изменение",no_secrets:"Коды, карты и фотографии не читаются из файла и не экспортируются.",off_title:"Массовые изменения выключены",off_text:"Системный администратор может включить импорт, экспорт и массовое изменение людей.",off_enable:"Включить",permit_missing:"Запись в систему контроля доступа требует отдельного разрешения владельца. До тех пор можно только проверять файлы и смотреть предпросмотр.",template:"Скачать шаблон",export_btn:"Экспорт в файл",export_hint:"Только люди, которых вам разрешено видеть. Телефоны частично скрыты. Один экспорт в минуту.",export_done:"Экспортировано людей: {n}",choose_file:"Выбрать файл CSV",file_hint:"До {rows} строк и {kb} КБ. Строка без идентификатора создаёт человека; строка с идентификатором обновляет только его.",uploading:"Проверка файла…",report_title:"Проверка файла",report_ok:"Верных: {n}",report_skip:"Без изменений: {n}",report_error:"С ошибками: {n}",row:"Строка {n}",dry_run:"Предпросмотр",dry_running:"Сравнение с системой контроля доступа…",dry_title:"Что изменится",will_create:"Новых: {n}",will_update:"Обновлений: {n}",unchanged:"Без изменений: {n}",errors:"Не будут записаны: {n}",before:"До",after:"После",hidden:"Скрыто",confirm_title:"Подтверждение записи",confirm_text:"В систему контроля доступа будет записано строк: {n}. Введите число {n}, чтобы продолжить.",confirm_label:"Число строк",confirm_btn:"Подтвердить",confirm_admin_only:"Подтверждение доступно только системному администратору. Отправьте ему задание.",apply:"Записать",applying:"Записано {done} из {total}",paused:"Запись остановилась на середине. Можно продолжить.",stalled:"Система контроля доступа сейчас недоступна. Попробуйте продолжить позже.",resume:"Продолжить",done_title:"Запись завершена",cancel:"Отменить задание",close:"Закрыть",back:"Назад",outcome_ok:"Записано",outcome_failed:"Не записано",outcome_unknown:"Неизвестно",outcome_not_sent:"Не отправлено",unknown_hint:"Строка с неизвестным результатом повторно не отправляется. Проверьте человека в списке перед следующим изменением.",edit_title:"Массовое изменение · людей: {n}",edit_validity:"Срок действия",edit_from:"С",edit_until:"По",edit_doors_add:"Добавить станцию",edit_doors_remove:"Убрать станцию",edit_relays:"Двери",edit_groups_add:"Добавить в группу",edit_groups_remove:"Убрать из группы",edit_active:"Состояние",edit_keep:"Без изменений",edit_activate:"Включить",edit_deactivate:"Отключить",edit_stage:"Перейти к предпросмотру",edit_nochange:"Изменение не выбрано.",field_person_id:"Идентификатор",field_revision:"Версия",field_employee_no:"Табельный номер",field_display_name:"Имя",field_phone:"Телефон",field_access_category:"Тип",field_responsible_person:"Ответственный",field_access_purpose:"Цель",field_active:"Активен",field_valid_from:"С",field_valid_until:"По",field_doors:"Двери",field_groups:"Группы",field_group_ids:"Группы",field_door_permissions:"Двери",code_formula_like:"Похоже на формулу",code_invalid:"Неверное значение",code_validity_pair:"Заполните и начало, и конец",code_validity:"Неверная дата",code_required:"Обязательное поле",code_duplicate_person:"Человек указан больше одного раза",code_duplicate_employee_no:"Табельный номер повторяется в файле",code_guest_responsible_required:"Посетителю или подрядчику нужен ответственный",code_invalid_validity:"Посетителю или подрядчику нужна дата окончания",code_doors:"Неверные двери",code_groups:"Неверные группы",code_active:"Неверное значение активности",code_access_category:"Неизвестный тип",code_person_id:"Неверный идентификатор",code_revision:"Неверная версия",code_revision_without_person:"Версия без идентификатора",code_cell_too_long:"Слишком длинное значение",code_control_character:"Недопустимый символ",code_too_many_cells:"Слишком много столбцов в строке",code_nothing_to_change:"Нечего менять",code_unchanged:"Без изменений",code_not_found:"Человек не найден",code_scope:"Человек или станция вне вашего управления",code_field_level:"Нужно разрешение на чувствительные данные",code_revision_conflict:"Человек изменился после экспорта",code_employee_conflict:"Табельный номер уже существует",code_projection_restricted:"Права человека видны не полностью",code_unknown_group:"Неизвестная группа",code_group_stations_unknown:"Станции группы неизвестны",code_plan_changed:"Данные изменились после предпросмотра",code_refused:"Система контроля доступа отклонила строку",code_generic:"Ошибка",v_title:"Проверка в системе контроля доступа",v_enable:"Включить проверку файла",v_btn:"Проверить файл",v_running:"Проверка…",v_will_write:"Будет записано: {n}",v_line:"Строка файла {n}",v_op_create:"Новый человек",v_op_update:"Обновление",v_expires:"Действует до {t}",v_confirm_btn:"Подтвердить и записать",v_sent:"Отправлено",v_result_running:"Выполняется…",v_result_finished:"Записано: {n}",v_result_done:"Завершено",v_result_unknown:"Результат неизвестен. Повторно не отправлено.",v_result_cancelled:"Отменено",v_check:"Проверить результат",v_prev:"Назад",v_next:"Далее",v_page:"{a} из {b}",v_admin_only:"Подтвердить может только администратор системы.",v_blocker_switch_off:"Проверка выключена",v_blocker_bulk_people_off:"Массовые изменения выключены",v_blocker_binding_not_configured:"Не задана настройка полномочий",v_blocker_direct_not_installed:"Нет прямого соединения",v_blocker_direct_not_selected:"Прямое соединение недоступно",v_none:"Нет строк для записи",v_mode_note:"Только новые люди"},qn={he:De,en:Dn,ar:An,ru:In};function Ae(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function u(e,t,s=Ae()){const i=qn[s][e]??De[e]??e;return t?i.replace(/\{(\w+)\}/g,(a,d)=>d in t?String(t[d]):a):i}function ie(e,t,s,i=Ae()){return e in De?u(e,s,i):u(t,s,i)}function Nn(e){switch(e.state){case"staged":return"report";case"previewed":return"preview";case"confirmed":case"applying":case"paused":return"apply";case"done":return"done";default:return"closed"}}function Mn(e){const t={create:0,update:0,unchanged:0,error:0};for(const s of e)s.status==="error"?t.error+=1:s.status==="unchanged"?t.unchanged+=1:s.op==="create"?t.create+=1:t.update+=1;return t}function nt(e,t){const s=e.fields.map(a=>ie(`field_${a}`,"code_generic",void 0,t)),i=e.codes.map(a=>ie(`code_${a}`,"code_generic",void 0,t));return s.length?`${s.join(", ")}: ${i.join(", ")}`:i.join(", ")}function at(e){if(e==null||e==="")return"—";if(Array.isArray(e))return e.length?e.join(", "):"—";if(typeof e=="object"){const t=Object.entries(e);return t.length?t.map(([s,i])=>`${s}: ${Array.isArray(i)?i.join("+"):String(i)}`).join("; "):"—"}return typeof e=="boolean"?e?"✓":"✗":String(e)}function jn(e){return e.more===!0&&e.stalled!==!0&&(e.state==="paused"||e.state==="applying")}function Ln(e){return e.filter(t=>t.outcome==="failed"||t.outcome==="unknown")}const rt={validFrom:"",validUntil:"",active:"keep",doorsAdd:{},doorsRemove:[],groupsAdd:[],groupsRemove:[]};function Un(e,t){const s={person_ids:[...new Set(e)]};if(!s.person_ids.length||!!t.validFrom!=!!t.validUntil)return null;if(t.validFrom&&t.validUntil){if(t.validFrom>t.validUntil)return null;s.valid_from=t.validFrom,s.valid_until=t.validUntil}t.active!=="keep"&&(s.active=t.active==="on");const i=Object.fromEntries(Object.entries(t.doorsAdd).filter(([,d])=>d.length));return Object.keys(i).length&&(s.doors_add=i),t.doorsRemove.length&&(s.doors_remove=[...new Set(t.doorsRemove)]),t.groupsAdd.length&&(s.groups_add=[...new Set(t.groupsAdd)]),t.groupsRemove.length&&(s.groups_remove=[...new Set(t.groupsRemove)]),s.doors_add&&s.doors_remove&&s.doors_remove.some(d=>d in s.doors_add)||s.groups_add&&s.groups_remove&&s.groups_remove.some(d=>s.groups_add.includes(d))?null:["valid_from","active","doors_add","doors_remove","groups_add","groups_remove"].filter(d=>d in s).length?s:null}function Fn(e,t,s,i){return t>i?"too_large":/\.csv$/i.test(e)?/(pin|card|code|photo|password|secret|token|קוד|כרטיס|תמונה|סיסמ)/i.test(s)?"secret_column":null:"not_csv"}var Bn=Object.defineProperty,Kn=Object.getOwnPropertyDescriptor,R=(e,t,s,i)=>{for(var a=i>1?void 0:i?Kn(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Bn(t,s,a),a};let E=class extends W{constructor(){super(...arguments),this.open=!1,this.mode="import",this.personIds=[],this.stations=[],this.groups=[],this.settings=null,this.job=null,this.rows=[],this.busy=!1,this.error="",this.note="",this.typed="",this.form={...rt},this.addStation="",this.addRelays=[1],this.file=null,this.vp=null,this.op=null,this.vpage=0,this.vtyped=""}updated(e){e.has("open")&&this.open&&this.load()}async load(){this.job=null,this.rows=[],this.error="",this.note="",this.typed="",this.file=null,this.vp=null,this.op=null,this.vpage=0,this.vtyped="",this.form={...rt};try{this.settings=await xt()}catch(e){this.error=U(e)}}close(){this.busy||this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async run(e){this.busy=!0,this.error="";try{return await e()}catch(t){this.error=U(t);return}finally{this.busy=!1}}save(e,t){const s=URL.createObjectURL(e),i=document.createElement("a");i.href=s,i.download=t,i.click(),setTimeout(()=>URL.revokeObjectURL(s),1e3)}async onFile(e){const t=e.target,s=t.files?.[0];if(t.value="",!s||!this.settings)return;const i=(await s.slice(0,2048).text()).split(/\r?\n/,1)[0]??"",a=Fn(s.name,s.size,i,this.settings.limits.max_file_bytes);if(a==="secret_column"){this.error=u("no_secrets");return}if(a){this.error=u("file_hint",{rows:this.settings.limits.max_rows,kb:Math.round(this.settings.limits.max_file_bytes/1024)});return}const d=await this.run(()=>hn(s,tt()));d&&(this.job=d.job,this.file=s)}async verify(){if(!this.job||!this.file)return;const e=this.file,t=await this.run(()=>$n(this.job.id,e));t&&(this.job=t.job,this.vp=t.preview,this.vpage=0,this.vtyped="")}async confirmVerifiedStep(){if(!this.job||!this.vp||!it(this.vp,this.vtyped,Date.now()))return;const e=this.job.id,t=await this.run(()=>kn(e,this.vp.preview_digest,this.vtyped));t&&(this.op=t.operation,this.vp=null,this.vtyped="",await this.pollResult(e))}async pollResult(e){let t=0;for(;this.open&&On(this.op,t);){await new Promise(i=>setTimeout(i,xn)),t+=1;const s=await this.run(()=>st(e));if(!s)return;this.op=s.operation}this.op?.state==="finished"&&this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}async enableVerify(){const e=await this.run(()=>yn("on"));e&&this.settings&&(this.settings={...this.settings,wiskey_csv:e})}async stageEdit(){const e=Un(this.personIds,this.form);if(!e){this.error=u("edit_nochange");return}const t=await this.run(()=>fn(e,tt()));t&&(this.job=t.job,await this.preview())}async preview(){if(!this.job)return;const e=await this.run(()=>mn(this.job.id));e&&(this.job=e.job,this.rows=e.rows)}async confirm(){if(!this.job?.plan_digest)return;const e=await this.run(()=>gn(this.job.id,this.job.plan_digest,this.typed));e&&(this.job=e.job)}async apply(){if(!this.job)return;let e=this.job;do e=(await this.run(()=>wn(e.id)))?.job,e&&(this.job=e);while(e&&jn(e)&&this.open);this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}async cancel(){if(!this.job)return;await this.run(()=>vn(this.job.id))&&(this.job=null),this.rows=[],this.vp=null,this.op=null,this.file=null}async exportFile(){const e=await this.run(()=>_n());e&&(this.save(e.blob,"access-people.csv"),this.note=u("export_done",{n:e.rows??0}))}async template(){const e=await this.run(()=>bn());e&&this.save(e.blob,"people-template.csv")}async enable(){const e=await this.run(()=>un("on"));e&&(this.settings={...this.settings,...e})}render(){const e=this.mode==="edit"?u("edit_title",{n:this.personIds.length}):u("title");return n`<sw-dialog wide ?open=${this.open} ?locked=${this.busy} heading=${e} @close=${t=>{t.stopPropagation(),this.close()}} data-bulk-dialog>
      <div class="stack">
        ${this.error?n`<div class="line bad" role="alert" data-bulk-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>`:l}
        ${this.note?n`<div class="line" role="status" data-bulk-note><sw-icon name="check" size=${16}></sw-icon><span>${this.note}</span></div>`:l}
        ${this.body()}
      </div>
      <sw-button slot="footer" variant="ghost" ?disabled=${this.busy} @click=${()=>this.close()}>${u("close")}</sw-button>
    </sw-dialog>`}body(){const e=this.settings;if(!e)return n`<div class="muted" role="status">…</div>`;if(e.enabled!=="on")return n`<div class="line warn" data-bulk-off><sw-icon name="warning" size=${16}></sw-icon><div><strong>${u("off_title")}</strong><div class="muted">${u("off_text")}</div></div></div>
        ${e.system_admin?n`<div class="actions"><sw-button variant="primary" data-bulk-enable ?disabled=${this.busy} @click=${()=>void this.enable()}>${u("off_enable")}</sw-button></div>`:l}`;const t=e.go_live_permitted?l:n`<div class="line warn" data-bulk-permit><sw-icon name="clock" size=${16}></sw-icon><span>${u("permit_missing")}</span></div>`;return this.job?n`${t}${this.jobView(this.job)}`:this.mode==="edit"?n`${t}${this.editForm()}`:n`${t}
      <div class="muted">${u("no_secrets")}</div>
      ${e.may_export?n`<div class="actions"><sw-button icon="download" data-bulk-export ?disabled=${this.busy} @click=${()=>void this.exportFile()}>${u("export_btn")}</sw-button></div>
        <div class="muted">${u("export_hint")}</div>`:l}
      ${e.may_import?n`<div class="actions">
          <sw-button variant="ghost" icon="download" data-bulk-template ?disabled=${this.busy} @click=${()=>void this.template()}>${u("template")}</sw-button>
          <label class="file"><span>${u("choose_file")}</span><input type="file" accept=".csv,text/csv" data-bulk-file ?disabled=${this.busy} @change=${s=>void this.onFile(s)}></label>
        </div>
        <div class="muted">${u("file_hint",{rows:e.limits.max_rows,kb:Math.round(e.limits.max_file_bytes/1024)})}</div>
        ${e.system_admin&&e.wiskey_csv&&e.wiskey_csv.enabled!=="on"?n`<div class="actions"><sw-button variant="ghost" data-verify-enable ?disabled=${this.busy} @click=${()=>void this.enableVerify()}>${u("v_enable")}</sw-button></div>`:l}`:l}
      ${this.busy?n`<div class="muted" role="status">${u("uploading")}</div>`:l}`}jobView(e){const t=Nn(e);if(t==="report"){const s=e.report.filter(i=>i.status!=="ok");return n`<strong>${u("report_title")}</strong>
        <div class="chips" data-bulk-report><span class="chip">${u("report_ok",{n:e.counts.ok})}</span><span class="chip">${u("report_skip",{n:e.counts.skip})}</span><span class="chip">${u("report_error",{n:e.counts.error})}</span></div>
        ${s.length?n`<div class="rows">${s.map(i=>n`<div class="row" data-bulk-row=${i.row}><span>${u("row",{n:i.row})}</span><span>${nt(i)}</span></div>`)}</div>`:l}
        ${this.verifySection(e)}`}if(t==="preview"){const s=Mn(this.rows),i=e.writes??0;return n`<strong>${u("dry_title")}</strong>
        <div class="chips" data-bulk-preview><span class="chip">${u("will_create",{n:s.create})}</span><span class="chip">${u("will_update",{n:s.update})}</span>
          <span class="chip">${u("unchanged",{n:s.unchanged})}</span><span class="chip">${u("errors",{n:s.error})}</span></div>
        <div class="rows">${this.rows.filter(a=>a.status!=="unchanged").map(a=>this.previewRow(a))}</div>
        ${i>0?this.settings?.system_admin?n`<strong>${u("confirm_title")}</strong><div>${u("confirm_text",{n:i})}</div>
              <div class="actions"><label><span class="muted">${u("confirm_label")}</span><input inputmode="numeric" data-bulk-typed .value=${this.typed} @input=${a=>this.typed=a.target.value}></label>
                <sw-button variant="primary" data-bulk-confirm ?disabled=${this.busy||this.typed.trim()!==String(i)} @click=${()=>void this.confirm()}>${u("confirm_btn")}</sw-button></div>`:n`<div class="line" data-bulk-admin-only><sw-icon name="clock" size=${16}></sw-icon><span>${u("confirm_admin_only")}</span></div>`:l}
        <div class="actions"><sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>void this.cancel()}>${u("cancel")}</sw-button></div>`}if(t==="apply"||t==="done"){const s=e.progress,i=Ln(e.results);return n`<strong>${u(t==="done"?"done_title":"apply")}</strong>
        <progress max=${Math.max(1,s.total)} value=${s.done} aria-label=${u("applying",{done:s.done,total:s.total})}></progress>
        <div role="status" data-bulk-progress>${u("applying",{done:s.done,total:s.total})}</div>
        <div class="chips">${Object.entries(e.outcomes).map(([a,d])=>n`<span class="chip">${ie(`outcome_${a}`,"code_generic")} · ${d}</span>`)}</div>
        ${e.stalled?n`<div class="line warn" data-bulk-stalled><sw-icon name="pause" size=${16}></sw-icon><span>${u("stalled")}</span></div>`:e.state==="paused"?n`<div class="line" data-bulk-paused><sw-icon name="pause" size=${16}></sw-icon><span>${u("paused")}</span></div>`:l}
        ${i.length?n`<div class="rows">${i.map(a=>n`<div class="row" data-bulk-result=${a.row}><span>${u("row",{n:a.row})}</span>
          <span>${ie(`outcome_${a.outcome}`,"code_generic")}${a.code?n` · ${ie(`code_${a.code}`,"code_generic")}`:l}</span></div>`)}</div>`:l}
        ${i.some(a=>a.outcome==="unknown")?n`<div class="muted">${u("unknown_hint")}</div>`:l}
        ${t==="apply"?n`<div class="actions"><sw-button variant="primary" icon="play" data-bulk-apply ?disabled=${this.busy||!e.go_live_permitted} @click=${()=>void this.apply()}>${e.state==="confirmed"?u("apply"):u("resume")}</sw-button></div>`:l}`}return n`<div class="muted">${u("code_generic")}</div>`}verifySection(e){const t=Cn(this.settings),s=n`<sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>void this.cancel()}>${u("cancel")}</sw-button>`;if(this.op)return this.resultView(this.op);if(t==="off")return n`<div class="actions"><sw-button variant="primary" data-bulk-dry ?disabled=${this.busy||e.counts.ok===0} @click=${()=>void this.preview()}>${u("dry_run")}</sw-button>${s}</div>`;if(t==="blocked")return n`<div class="chips" data-verify-blockers>${(this.settings?.wiskey_csv?.blockers??[]).map(o=>n`<span class="chip">${u(En(o))}</span>`)}</div><div class="actions">${s}</div>`;const i=this.vp;if(!i)return n`<strong>${u("v_title")}</strong>
        <div class="actions"><sw-button variant="primary" data-verify-run ?disabled=${this.busy||e.counts.ok===0||!this.file} @click=${()=>void this.verify()}>${this.busy?u("v_running"):u("v_btn")}</sw-button>${s}</div>`;const a=St(i.rows.length),d=Math.min(this.vpage,a-1);return n`<strong>${u("v_title")}</strong>
      <div class="chips" data-verify-preview>
        <span class="chip">${u("v_will_write",{n:i.writes})}</span><span class="chip">${u("unchanged",{n:i.skipped})}</span><span class="chip">${u("errors",{n:i.errors})}</span>
        <span class="chip">${u("v_expires",{t:Rn(i.expires_at,Ae())})}</span></div>
      <div class="vlist">${Pn(i.rows,d).map(o=>n`<div class="vrow" data-verify-row=${o.source_line}><span>${u("v_line",{n:o.source_line})}</span><span>${o.op==="create"?u("v_op_create"):u("v_op_update")}</span></div>`)}</div>
      ${a>1?n`<div class="pager"><sw-button variant="ghost" data-verify-prev ?disabled=${d===0} @click=${()=>this.vpage=d-1}>${u("v_prev")}</sw-button>
        <span class="muted">${u("v_page",{a:d+1,b:a})}</span><sw-button variant="ghost" data-verify-next ?disabled=${d>=a-1} @click=${()=>this.vpage=d+1}>${u("v_next")}</sw-button></div>`:l}
      ${i.writes===0?n`<div class="line" data-verify-none><span>${u("v_none")}</span></div>`:this.settings?.system_admin?n`<div>${u("confirm_text",{n:i.writes})}</div>
            <div class="actions"><label><span class="muted">${u("confirm_label")}</span><input inputmode="numeric" data-verify-typed .value=${this.vtyped} @input=${o=>this.vtyped=o.target.value}></label>
              <sw-button variant="primary" data-verify-confirm ?disabled=${this.busy||!it(i,this.vtyped,Date.now())} @click=${()=>void this.confirmVerifiedStep()}>${u("v_confirm_btn")}</sw-button></div>`:n`<div class="line" data-verify-admin-only><sw-icon name="clock" size=${16}></sw-icon><span>${u("v_admin_only")}</span></div>`}
      <div class="actions"><sw-button variant="ghost" data-verify-again ?disabled=${this.busy} @click=${()=>void this.verify()}>${u("v_btn")}</sw-button>${s}</div>`}resultView(e){const t=Tn(e);return n`<strong>${u("v_sent")}</strong>
      <div class="line ${e.state==="unknown"?"warn":""}" role="status" data-verify-result=${e.state}><span>${u(t.key,t.n===void 0?void 0:{n:t.n})}</span></div>
      ${e.state==="running"||e.state==="unknown"?n`<div class="actions"><sw-button variant="ghost" data-verify-check ?disabled=${this.busy} @click=${()=>void this.recheck()}>${u("v_check")}</sw-button></div>`:l}`}async recheck(){if(!this.job)return;const e=this.job.id,t=await this.run(()=>st(e));t&&(this.op=t.operation,await this.pollResult(e))}previewRow(e){return n`<div class="row" data-bulk-preview-row=${e.row}><span>${u("row",{n:e.row})}</span><div>
      ${e.name?n`<strong>${e.name}</strong>`:l}
      ${e.status==="error"?n`<div>${nt(e)}</div>`:l}
      ${e.diff?.length?n`<div class="diff"><span></span><span class="k">${u("before")}</span><span class="k">${u("after")}</span>
        ${e.diff.map(t=>n`<span class="k">${ie(`field_${t.field}`,"code_generic")}</span><span>${at(t.before)}</span><span>${at(t.after)}</span>`)}</div>`:l}
    </div></div>`}editForm(){const e=this.form,t=s=>this.form={...e,...s};return n`<div class="grid2">
        <label>${u("edit_from")}<input type="date" lang=${Z()} data-bulk-from .value=${e.validFrom} @change=${s=>t({validFrom:s.target.value})}></label>
        <label>${u("edit_until")}<input type="date" lang=${Z()} data-bulk-until .value=${e.validUntil} @change=${s=>t({validUntil:s.target.value})}></label>
        <label>${u("edit_active")}<select data-bulk-active @change=${s=>t({active:s.target.value})}>
          <option value="keep" ?selected=${e.active==="keep"}>${u("edit_keep")}</option>
          <option value="on" ?selected=${e.active==="on"}>${u("edit_activate")}</option>
          <option value="off" ?selected=${e.active==="off"}>${u("edit_deactivate")}</option></select></label>
      </div>
      ${this.stations.length?n`<div class="grid2">
        <label>${u("edit_doors_add")}<select data-bulk-door-add @change=${s=>this.addStation=s.target.value}>
          <option value="">—</option>${this.stations.map(s=>n`<option value=${s.id}>${s.name}</option>`)}</select></label>
        <label>${u("edit_relays")}<select data-bulk-relays @change=${s=>this.addRelays=s.target.value.split("+").map(Number)}>
          <option value="1">1</option><option value="2">2</option><option value="1+2">1+2</option></select></label>
        <label>${u("edit_doors_remove")}<select data-bulk-door-remove multiple @change=${s=>t({doorsRemove:[...s.target.selectedOptions].map(i=>i.value)})}>
          ${this.stations.map(s=>n`<option value=${s.id}>${s.name}</option>`)}</select></label>
      </div>`:l}
      ${this.groups.length?n`<div class="grid2">
        <label>${u("edit_groups_add")}<select multiple data-bulk-group-add @change=${s=>t({groupsAdd:[...s.target.selectedOptions].map(i=>i.value)})}>
          ${this.groups.map(s=>n`<option value=${s.id}>${s.label}</option>`)}</select></label>
        <label>${u("edit_groups_remove")}<select multiple data-bulk-group-remove @change=${s=>t({groupsRemove:[...s.target.selectedOptions].map(i=>i.value)})}>
          ${this.groups.map(s=>n`<option value=${s.id}>${s.label}</option>`)}</select></label>
      </div>`:l}
      <div class="actions"><sw-button variant="primary" data-bulk-edit-stage ?disabled=${this.busy} @click=${()=>{this.form={...this.form,doorsAdd:this.addStation?{[this.addStation]:this.addRelays}:{}},this.stageEdit()}}>${u("edit_stage")}</sw-button></div>`}};E.styles=K`
    :host {
      display: contents;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .muted {
      color: var(--sw-text-muted);
    }
    .line {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .line.warn {
      background: var(--sw-warning-bg, var(--sw-surface-2));
    }
    .line.bad {
      background: var(--sw-danger-bg, var(--sw-surface-2));
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      font-variant-numeric: tabular-nums;
    }
    .rows {
      max-block-size: 320px;
      overflow: auto;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .row {
      display: grid;
      grid-template-columns: minmax(64px, auto) 1fr;
      gap: 8px;
      padding: 8px 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-child {
      border-block-end: 0;
    }
    .diff {
      display: grid;
      grid-template-columns: auto 1fr 1fr;
      gap: 2px 10px;
      margin-block-start: 4px;
    }
    .diff .k {
      color: var(--sw-text-muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    input,
    select {
      font: inherit;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      min-block-size: 36px;
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }
    progress {
      inline-size: 100%;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .vlist {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .vrow {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    .vrow:last-child {
      border-block-end: 0;
    }
  `;R([_({type:Boolean})],E.prototype,"open",2);R([_()],E.prototype,"mode",2);R([_({attribute:!1})],E.prototype,"personIds",2);R([_({attribute:!1})],E.prototype,"stations",2);R([_({attribute:!1})],E.prototype,"groups",2);R([c()],E.prototype,"settings",2);R([c()],E.prototype,"job",2);R([c()],E.prototype,"rows",2);R([c()],E.prototype,"busy",2);R([c()],E.prototype,"error",2);R([c()],E.prototype,"note",2);R([c()],E.prototype,"typed",2);R([c()],E.prototype,"form",2);R([c()],E.prototype,"addStation",2);R([c()],E.prototype,"addRelays",2);R([c()],E.prototype,"vp",2);R([c()],E.prototype,"op",2);R([c()],E.prototype,"vpage",2);R([c()],E.prototype,"vtyped",2);E=R([V("sw-bulk-people-dialog")],E);var Wn=Object.defineProperty,Vn=Object.getOwnPropertyDescriptor,M=(e,t,s,i)=>{for(var a=i>1?void 0:i?Vn(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Wn(t,s,a),a};const Yn={ok:"res_ok",refused:"res_refused",unknown:"res_unknown",not_sent:"res_not_sent"},Gn={adopt:"adopt_title",ignore:"ignore_title",unignore:"unignore_title",delete:"delete_title"};function Hn(e,t){return f(t==="station_offline"||t==="device_unavailable"?"reason_offline":t==="busy"||t==="rate_limited"?"reason_busy":e==="forbidden"?"reason_forbidden":e==="unsupported"?"reason_unsupported":"reason_generic")}let A=class extends W{constructor(){super(...arguments),this.open=!1,this.zone=ee,this.phase="loading",this.feedDown=!1,this.scope=[],this.reads={},this.query="",this.showIgnored=!1,this.acting=null,this.step="ask",this.check=null,this.checkFailed=!1,this.acceptDuplicate=!1,this.typed="",this.reply=null,this.failure="",this.generation=0}connectedCallback(){super.connectedCallback(),this.open&&this.load(!1)}disconnectedCallback(){super.disconnectedCallback(),this.generation++}updated(e){e.has("open")&&this.open&&e.get("open")===!1&&this.load(!1)}async load(e){const t=++this.generation;this.phase="loading";try{const i=await li();if(t!==this.generation)return;this.scope=i.stations,this.feedDown=i.state!=="ready"&&!i.stations.length,this.phase="ready"}catch{t===this.generation&&(this.phase="error");return}const s=this.scope.filter(i=>i.numbers);this.reads=Object.fromEntries(s.map(i=>[i.id,{loading:!0,reply:this.reads[i.id]?.reply??null,error:""}]));for(const i of s){if(t!==this.generation)return;await this.readStation(i.id,e,t)}}async readStation(e,t,s=this.generation){this.reads={...this.reads,[e]:{...this.reads[e]??{reply:null,error:""},loading:!0}};try{const i=await di(e,t);if(s!==this.generation)return;this.reads={...this.reads,[e]:{loading:!1,reply:i,error:i.people?"":Hn(i.state,i.last_error)}}}catch(i){if(s!==this.generation)return;const a=i instanceof $&&i.status===403?f("reason_forbidden"):f("reason_generic");this.reads={...this.reads,[e]:{loading:!1,reply:null,error:a}}}}get rows(){const e=this.scope.filter(t=>this.reads[t.id]?.reply?.people).map(t=>({station:{id:t.id,name:t.name},people:this.reads[t.id].reply.people}));return gi(e)}get loadingAny(){return Object.values(this.reads).some(e=>e.loading)}close(){this.step!=="working"&&(this.acting=null,this.dispatchEvent(new CustomEvent("close")))}startAction(e,t){this.acting={row:e,action:t},this.step="ask",this.reply=null,this.failure="",this.check=null,this.checkFailed=!1,this.acceptDuplicate=!1,this.typed="",t==="adopt"&&this.runCheck(e)}async runCheck(e){const t=oe(e,"adopt")[0];if(t){this.step="checking";try{this.check=await ci(t.station_id,e.employee_no),this.checkFailed=!this.check.checked}catch{this.checkFailed=!0}finally{this.step==="checking"&&(this.step="ask")}}}get possibleDuplicates(){const e=this.check;return!e||!e.checked?0:e.total-(e.same_number?1:0)}canConfirm(){const e=this.acting;return!(!e||this.step!=="ask"||!oe(e.row,e.action).length||e.action==="adopt"&&this.possibleDuplicates>0&&!this.acceptDuplicate||e.action==="delete"&&!_i(this.typed,e.row.employee_no))}async confirm(){const e=this.acting;if(!e||!this.canConfirm())return;const t=oe(e.row,e.action).map(s=>s.station_id);this.step="working",this.failure="";try{e.action==="adopt"?this.reply=await pi(e.row.employee_no,t,this.acceptDuplicate):e.action==="delete"?this.reply=await hi(e.row.employee_no,t,this.typed.trim()):this.reply=await ui(e.row.employee_no,t,e.action==="ignore")}catch(s){this.failure=s instanceof $?s.body.user_message||s.code:f("res_failed"),this.reply=null}this.step="done",this.reply&&this.reply.summary.ok+this.reply.summary.unknown>0&&this.dispatchEvent(new CustomEvent("changed"));for(const s of t)this.readStation(s,e.action==="adopt"||e.action==="delete")}closeAction(){this.step!=="working"&&(this.acting=null)}render(){if(!this.open)return l;const e=this.rows,t=wi(e,this.showIgnored,this.query),s=e.filter(i=>i.ignored).length;return n`<sw-dialog open xl heading=${f("title")} subheading=${this.phase==="ready"&&!this.loadingAny?e.length===1?f("count_one"):f("count",{n:e.length}):""}
        data-station-people data-station-people-phase=${this.phase} data-station-people-loading=${String(this.loadingAny)}
        @close=${i=>{i.stopPropagation(),this.close()}}>
        <p class="intro">${f("intro")}</p>
        ${this.phase==="loading"?n`<sw-state-panel state="loading" compact heading=${f("reading")}></sw-state-panel>`:l}
        ${this.phase==="error"?n`<sw-state-panel state="error" compact heading=${f("reason_generic")} data-station-people-error></sw-state-panel>`:l}
        ${this.phase==="ready"&&this.feedDown?n`<sw-state-panel state="error" compact heading=${f("feed_down")} data-station-people-feed-down></sw-state-panel>`:l}
        ${this.phase==="ready"&&!this.feedDown&&!this.scope.length?n`<sw-state-panel icon="door" state="empty" compact heading=${f("no_stations")} data-station-people-noscope></sw-state-panel>`:l}
        ${this.phase==="ready"&&this.scope.length?this.renderReady(t,e.length,s):l}
        <div slot="footer" class="footer">
          <sw-button variant="ghost" icon="refresh" data-station-people-refresh ?disabled=${this.loadingAny||this.phase==="loading"} @click=${()=>void this.load(!0)}>${f("refresh")}</sw-button>
          <sw-button variant="secondary" data-station-people-close @click=${()=>this.close()}>${f("close")}</sw-button>
        </div>
      </sw-dialog>
      ${this.acting?this.renderAction():l}`}renderReady(e,t,s){return n`
      <div class="tools">
        <label class="search"><sw-icon name="search" size=${16}></sw-icon>
          <input type="search" data-station-people-search maxlength="64" aria-label=${f("search")} placeholder=${f("search")} .value=${b(this.query)}
            @input=${i=>this.query=i.target.value} />
        </label>
        ${s?n`<label class="check"><input type="checkbox" data-station-people-show-ignored .checked=${this.showIgnored} @change=${i=>this.showIgnored=i.target.checked} />
              <span>${f("show_ignored")} (${s})</span></label>`:l}
      </div>
      <ul class="status" aria-live="polite">
        ${this.scope.map(i=>{if(!i.numbers)return n`<li class="warn" data-station-people-station=${i.id} data-station-state="numbers_hidden"><sw-icon name="lock" size=${14}></sw-icon>${f("station_numbers_hidden",{name:i.name})}</li>`;const a=this.reads[i.id];return!a||a.loading?n`<li class="muted" data-station-people-station=${i.id} data-station-state="loading"><span class="dot"></span>${f("reading_station",{name:i.name})}</li>`:a.error?n`<li class="warn" data-station-people-station=${i.id} data-station-state="error"><sw-icon name="warning" size=${14}></sw-icon>${f("station_off",{name:i.name,reason:a.error})}</li>`:l})}
      </ul>
      ${e.length?n`<ul class="rows" data-station-people-rows>${le(e,i=>i.employee_no,i=>this.renderRow(i))}</ul>`:this.loadingAny?l:n`<sw-state-panel icon="users" state="empty" compact heading=${f(t?"empty_filtered":"empty")} data-station-people-empty></sw-state-panel>`}`}credentials(e){if(e.pin===null&&e.cards===null&&e.biometric===null)return n`<span class="muted" title=${f("hidden_hint")}>${f("hidden")}</span>`;const t=[];return e.pin&&t.push(n`<span class="chip" data-cred="pin"><sw-icon name="lock" size=${12}></sw-icon>${f("pin")}</span>`),e.cards&&t.push(n`<span class="chip" data-cred="cards"><sw-icon name="grid" size=${12}></sw-icon>${e.cards===1?f("card"):f("cards",{n:e.cards})}</span>`),e.biometric&&t.push(n`<span class="chip" data-cred="face"><sw-icon name="user" size=${12}></sw-icon>${f("face")}</span>`),t.length?n`${t}`:n`<span class="muted">${f("none")}</span>`}renderRow(e){const t=vi(e),s=e.display_name||f("no_name");return n`<li class="row ${e.ignored?"ignored":""}" data-station-user=${e.employee_no} data-station-user-ignored=${String(e.ignored)}>
      <div class="who">
        <span class="name ${e.display_name?"":"muted"}">${s}</span>
        <bdi class="num" dir="ltr" data-station-user-number>${e.employee_no}</bdi>
        ${e.ignored?n`<sw-badge kind="neutral" label=${f("ignored_badge")}></sw-badge>`:l}
        ${e.names.length>1?n`<span class="warn-text" data-station-user-names>${f("two_names")}: ${e.names.join(" · ")}</span>`:l}
      </div>
      <div class="facts">
        <span class="stations" aria-label=${f("col_stations")}>${e.stations.map(i=>n`<span class="chip station ${i.ignored?"off":""}" data-station-chip=${i.station_id}>${i.station_name}</span>`)}</span>
        <span class="creds" aria-label=${f("col_credentials")}>${this.credentials(e)}</span>
        <span class="seen muted" data-station-user-first-seen>${f("col_first_seen")}: ${Q(e.first_seen_at,this.zone)}</span>
      </div>
      <div class="acts">
        ${t?n`<span class="muted small" data-station-user-block=${t}>${f("adopt_blocked")}: ${ki(`imp_${t}`,"imp_unknown")}</span>`:n`<sw-button size="sm" variant="primary" icon="plus" data-station-user-act="adopt" @click=${()=>this.startAction(e,"adopt")}>${f("act_adopt")}</sw-button>`}
        ${e.ignored?n`<sw-button size="sm" variant="secondary" icon="eye" data-station-user-act="unignore" @click=${()=>this.startAction(e,"unignore")}>${f("act_unignore")}</sw-button>`:n`<sw-button size="sm" variant="secondary" icon="eye" data-station-user-act="ignore" @click=${()=>this.startAction(e,"ignore")}>${f("act_ignore")}</sw-button>`}
        <sw-button size="sm" variant="danger" icon="trash" data-station-user-act="delete" @click=${()=>this.startAction(e,"delete")}>${f("act_delete")}</sw-button>
      </div>
    </li>`}renderAction(){const{row:e,action:t}=this.acting,s=oe(e,t),i=this.step==="done";return n`<sw-dialog open heading=${f(Gn[t])} subheading=${`${e.display_name||f("no_name")} · ${e.employee_no}`} ?locked=${this.step==="working"}
        data-station-action=${t} data-station-action-step=${this.step} @close=${a=>{a.stopPropagation(),this.closeAction()}}>
        ${i?this.renderResult(t):this.renderAsk(e,t,s.map(a=>a.station_name))}
        <div slot="footer" class="footer">
          ${i?n`${t==="adopt"&&this.reply?.person?n`<sw-button variant="secondary" icon="user" data-station-action-open-person @click=${()=>{const a=this.reply.person.id;this.acting=null,this.dispatchEvent(new CustomEvent("open-person",{detail:{id:a}}))}}>${f("res_open_person")}</sw-button>`:l}
              <sw-button variant="primary" data-station-action-close @click=${()=>this.closeAction()}>${f("close")}</sw-button>`:n`<sw-button variant="ghost" data-station-action-cancel ?disabled=${this.step==="working"} @click=${()=>this.closeAction()}>${f("cancel")}</sw-button>
              <sw-button variant=${t==="delete"?"danger":"primary"} data-station-action-confirm ?disabled=${!this.canConfirm()} @click=${()=>void this.confirm()}>
                ${this.step==="working"?f("working"):f(t==="adopt"?"adopt_go":t==="delete"?"delete_go":"confirm")}</sw-button>`}
        </div>
      </sw-dialog>`}renderAsk(e,t,s){return n`<p class="ask">${f(t==="adopt"?"adopt_text":t==="delete"?"delete_text":t==="ignore"?"ignore_text":"unignore_text")}</p>
      <p class="targets" data-station-action-targets>${f("stations_list")} ${s.join(" · ")}</p>
      ${t==="adopt"?this.renderCheck():l}
      ${t==="delete"?n`<sw-field label=${f("delete_type",{n:e.employee_no})}>
            <input data-station-action-typed dir="ltr" autocomplete="off" maxlength="64" .value=${b(this.typed)} @input=${a=>this.typed=a.target.value} />
          </sw-field>`:l}`}renderCheck(){if(this.step==="checking")return n`<p class="muted" role="status" data-station-check="checking">${f("adopt_checking")}</p>`;if(this.checkFailed)return n`<p class="warn-text" role="status" data-station-check="failed">${f("adopt_check_failed")}</p>`;const e=this.check;if(!e)return n``;const t=e.same_number,s=this.possibleDuplicates;return n`${t?n`<p class="note ok" data-station-check="link"><sw-icon name="link" size=${14}></sw-icon>${t.id?f("adopt_link",{name:t.display_name}):f("adopt_link_hidden")}</p>`:l}
      ${s>0?n`<div class="note warn" data-station-check="maybe">
            <p>${e.restricted?f("adopt_maybe_hidden",{n:s}):f("adopt_maybe")}</p>
            ${e.restricted?l:n`<ul>${e.matches.filter(i=>!i.reasons.includes("employee_no")).map(i=>n`<li data-station-check-match=${i.id}>
                  <button type="button" class="link" @click=${()=>{this.acting=null,this.dispatchEvent(new CustomEvent("open-person",{detail:{id:i.id}}))}}>${i.display_name}</button>
                  ${i.employee_no?n`<bdi dir="ltr" class="muted">${i.employee_no}</bdi>`:l}</li>`)}</ul>`}
            <label class="check"><input type="checkbox" data-station-check-accept .checked=${this.acceptDuplicate} @change=${i=>this.acceptDuplicate=i.target.checked} />
              <span>${f("adopt_maybe_accept")}</span></label>
          </div>`:l}`}renderResult(e){if(this.failure||!this.reply)return n`<p class="result failed" role="status" data-station-result="failed">${this.failure||f("res_failed")}</p>`;const t=bi(this.reply.results),s=t==="ok"?e==="delete"?"res_pending":"res_all_ok":t==="partial"?"res_partial":t==="unknown"?"res_unknown_all":"res_failed",i=Object.fromEntries(this.scope.map(a=>[a.id,a.name]));return n`<p class="result ${t}" role="status" data-station-result=${t}>${f(s)}</p>
      <ul class="per-station" data-station-results>
        ${this.reply.results.map(a=>n`<li data-station-result-row=${a.station_id} data-outcome=${a.outcome}>
          <span class="st">${i[a.station_id]??a.station_id}</span>
          <span class="oc ${a.outcome}">${f(Yn[a.outcome])}</span>
          ${a.message?n`<span class="msg">${a.message}</span>`:l}
          ${(e==="ignore"||e==="unignore")&&a.stored&&a.outcome!=="ok"?n`<span class="msg" data-station-result-stored-only>${f("res_stored_only")}</span>`:l}
        </li>`)}
      </ul>`}};A.styles=K`
    :host {
      display: contents;
    }
    .intro,
    .ask,
    .targets {
      margin: 0 0 12px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .targets {
      color: var(--sw-text);
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      margin-block-end: 8px;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1 1 220px;
      min-block-size: 40px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text-2);
    }
    .search input {
      flex: 1;
      min-inline-size: 0;
      border: 0;
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: max(16px, var(--sw-fs-sm));
    }
    .search input:focus {
      outline: none;
    }
    .search:focus-within {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 40px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      cursor: pointer;
    }
    .check input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
    }
    .status {
      list-style: none;
      margin: 0 0 8px;
      padding: 0;
      display: grid;
      gap: 4px;
      font-size: var(--sw-fs-sm);
    }
    .status li {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-skeleton);
    }
    .warn,
    .warn-text {
      color: var(--sw-text);
    }
    .warn sw-icon {
      color: var(--sw-warning);
    }
    .warn-text {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      color: var(--sw-text-3);
    }
    .small {
      font-size: var(--sw-fs-xs);
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr) auto;
      gap: 8px 16px;
      align-items: center;
      padding: 12px 14px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .row.ignored {
      background: var(--sw-surface-2);
    }
    .who {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4px 8px;
      min-inline-size: 0;
    }
    .name {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
      overflow-wrap: anywhere;
    }
    .num {
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
    }
    .stations,
    .creds {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .chip.station {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .chip.station.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      inline-size: 100%;
    }
    .note {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 12px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
    }
    p.note {
      flex-direction: row;
      align-items: center;
    }
    .note p {
      margin: 0;
    }
    .note ul {
      margin: 0;
      padding-inline-start: 18px;
    }
    .note.ok {
      background: var(--sw-success-soft);
    }
    .note.warn {
      background: var(--sw-stale-soft);
    }
    .link {
      border: 0;
      padding: 4px 0;
      background: none;
      color: var(--sw-accent-text);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
    .result {
      margin: 0 0 10px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      background: var(--sw-surface-2);
    }
    .result.ok {
      background: var(--sw-success-soft);
    }
    .result.partial,
    .result.unknown {
      background: var(--sw-stale-soft);
    }
    .result.failed {
      background: var(--sw-danger-soft);
    }
    .per-station {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .per-station li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
      align-items: baseline;
    }
    .per-station .st {
      font-weight: var(--sw-fw-semibold);
    }
    .oc {
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      font-weight: var(--sw-fw-semibold);
      background: var(--sw-surface-2);
    }
    .oc.ok {
      background: var(--sw-success-soft);
    }
    .oc.unknown {
      background: var(--sw-stale-soft);
    }
    .oc.refused,
    .oc.not_sent {
      background: var(--sw-danger-soft);
    }
    .msg {
      color: var(--sw-text-2);
      flex-basis: 100%;
    }
    input[data-station-action-typed] {
      font-size: max(16px, var(--sw-fs-sm));
    }
    @media (max-width: 767px) {
      .row {
        grid-template-columns: minmax(0, 1fr);
        padding: 12px;
      }
      .acts {
        justify-content: flex-start;
      }
    }
  `;M([_({type:Boolean,reflect:!0})],A.prototype,"open",2);M([_({attribute:!1})],A.prototype,"zone",2);M([c()],A.prototype,"phase",2);M([c()],A.prototype,"feedDown",2);M([c()],A.prototype,"scope",2);M([c()],A.prototype,"reads",2);M([c()],A.prototype,"query",2);M([c()],A.prototype,"showIgnored",2);M([c()],A.prototype,"acting",2);M([c()],A.prototype,"step",2);M([c()],A.prototype,"check",2);M([c()],A.prototype,"checkFailed",2);M([c()],A.prototype,"acceptDuplicate",2);M([c()],A.prototype,"typed",2);M([c()],A.prototype,"reply",2);M([c()],A.prototype,"failure",2);A=M([V("wiskey-station-people")],A);const Ee={p1:{name:"דנה כהן",phone:"050-000-0001",consent:"granted"},p2:{name:"יוסי לוי",phone:"050-000-0002",consent:"granted"},p3:{name:"מאיה כץ",phone:null,consent:"unknown"},p4:{name:"אורן ברק",phone:"050-000-0004",consent:"declined"},p5:{name:"נועה שלו",phone:"050-000-0005",consent:"unknown",unregistered:!0}},ot=[{id:"card_ready",label:"כרטיס מוכן",body:"שלום {name}, כרטיס הכניסה שלך מוכן לאיסוף במשרד."},{id:"validity_reminder",label:"תזכורת תוקף",body:"שלום {name}, תוקף הכניסה שלך מסתיים בקרוב. נא לפנות למשרד."},{id:"closure",label:"הכניסה סגורה",body:"שלום {name}, הכניסה לחניון סגורה היום בין 12:00 ל־14:00."}];function Xn(e=350){const t={limit:6,used:0,resets_in_s:1800},s=new Map,i=new Map,a=()=>({feature:!0,enabled:!0,can_send:!0,can_reveal_phone:!0,free_text:!0,bulk_max:20,text_max:1e3,templates:ot.map(m=>({...m})),templates_revision:1,quota:{...t},pace_ms:0}),d=()=>new Promise(m=>setTimeout(m,e)),o=m=>i.has(m)?"declined":Ee[m]?.consent??"unknown";return{async config(){return a()},async recipients(m){return m.map(g=>{const x=Ee[g];return{person_id:g,name:x?.name??g,phone_masked:x?.phone?Xt(x.phone):null,has_phone:x?x.phone!==null:!1,consent:o(g),allowed:!0}})},async send(m,g,x){await d();const X=Ee[m];if(!X?.phone)return{ok:!1,reason:"no_phone"};if(o(m)==="declined")return{ok:!1,reason:"no_consent"};if(t.used>=t.limit)return{ok:!1,reason:"rate",retry_after_s:t.resets_in_s};if(X.unregistered)return{ok:!1,reason:"not_registered"};if(!g.text.trim())return{ok:!1,reason:"empty"};t.used+=1;const Ie=new Date().toISOString(),Et=ot.find(Pt=>Pt.id===g.template_id);return s.set(m,[{id:`demo-${m}-${t.used}`,at:Ie,by:"בודק",kind:g.template_id?"template":"free",template_id:g.template_id,template_label:Et?.label??null,outcome:"sent",reason:null,bulk:!!x.bulk},...s.get(m)??[]]),{ok:!0,sent_at:Ie,quota:{...t}}},async history(m){return{messages:s.get(m)??[],opt_out:i.get(m)??null,consent:o(m)}},async setOptOut(m,g){return g?i.set(m,{at:new Date().toISOString(),by:"בודק"}):i.delete(m),{opt_out:i.get(m)??null,consent:o(m)}}}}var Jn=Object.defineProperty,Zn=Object.getOwnPropertyDescriptor,v=(e,t,s,i)=>{for(var a=i>1?void 0:i?Zn(t,s):t,d=e.length-1,o;d>=0;d--)(o=e[d])&&(a=(i?o(t,s,a):o(a))||a);return i&&a&&Jn(t,s,a),a};const Qn=3e4,ea=250,ta=800,lt="sw.people.view",dt="sw.people.columns";function sa(e){return e==="synced"?{kind:"recorded",label:p("synced")}:e==="pending"||e==="syncing"||e==="delete_pending"?{kind:"stale",label:p(e)}:e==="conflict"||e==="error"?{kind:"error",label:p(e)}:e==="offline"?{kind:"offline",label:p("offline")}:e==="unassigned"?{kind:"unknown",label:p("filter_unassigned")}:{kind:"neutral",label:p(e)}}const ce={get(e){try{return window.localStorage.getItem(e)}catch{return null}},set(e,t){try{window.localStorage.setItem(e,t)}catch{}}},ia={kind:"iana",name:"Asia/Jerusalem"},na=[{id:"d1",name:"שער ראשי"},{id:"d2",name:"לובי"},{id:"d3",name:"חניון"}],aa=[{id:"staff",label:"עובדים",enabled:!0,station_ids:["d1","d2"]},{id:"night",label:"משמרת לילה",enabled:!0,station_ids:["d3"]}],ae=(e,t,s,i={})=>({id:e,display_name:s,active:!0,archived:!1,valid_from:null,valid_until:null,revision:1,access_category:"staff",user_type:"normal",identity_locked:!1,employee_no:t,group_ids:[],stations:[],timing:null,level:"sensitive",editable:!1,phone:null,phone_set:!0,credentials:{pin:!0,cards:1},photo_configured:!1,profile:null,responsible_person:null,access_purpose:null,...i}),re=(e,t,s=!0)=>({station_id:e,enabled:s,doors:[1],sync_state:t,last_sync_at:null,last_error:null}),ct=[ae("p1","1001","דנה כהן",{phone:"050-000-0001",group_ids:["staff"],stations:[re("d1","synced"),re("d2","synced")],credentials:{pin:!0,cards:2}}),ae("p2","1017","יוסי לוי",{phone:"050-000-0002",stations:[re("d1","pending")],credentials:{pin:!1,cards:1}}),ae("p3","1033","מאיה כץ",{valid_from:"2026-01-01T00:00:00+02:00",valid_until:"2026-06-30T00:00:00+03:00",stations:[re("d3","synced")],phone_set:!1,credentials:{pin:!0,cards:0}}),ae("p4","2044","אורן ברק",{phone:"050-000-0004",active:!1,group_ids:["night"],stations:[re("d2","error",!1)],credentials:{pin:!1,cards:0}}),ae("p5","2051","נועה שלו",{phone:"050-000-0005",credentials:{pin:!1,cards:1}})];let w=class extends W{constructor(){super(...arguments),this.access=We(),this.phase="loading",this.panelNote="",this.rows=[],this.page=null,this.shownAt=null,this.feedDown=!1,this.changed=!1,this.busy=!1,this.moreBusy=!1,this.query="",this.filters={},this.view=Jt(ce.get(lt)),this.columns=Zt(ce.get(dt)),this.columnsOpen=!1,this.phone=!1,this.stations=[],this.zone=ee,this.groups=[],this.fields=null,this.features={},this.photoOn=!0,this.profileDraft={field:"",value:""},this.selecting=!1,this.selected=new Set,this.openId="",this.drawerOpen=!1,this.detail=null,this.detailLoading=!1,this.detailError="",this.editing=null,this.notice=null,this.transport=null,this.msgConfig=null,this.message=null,this.acting=null,this.result=null,this.pendingTimer=0,this.pendingDelete="",this.bulk=null,this.bulkShown=!1,this.messagesRev=0,this.stationPeople=!1,this.dups=null,this.dupsOpen=!1,this.rowsKey="",this.generation=0,this.detailGeneration=0,this.inflight=!1,this.queued=!1,this.typing=0,this.coalesce=0,this.poll=0,this.stop=null,this.stopSession=null,this.media=null,this.onMedia=()=>this.phone=!!this.media?.matches}connectedCallback(){if(super.connectedCallback(),D()&&xt().then(e=>this.bulkShown=e.enabled==="on"||e.system_admin===!0,()=>this.bulkShown=!1),this.media=typeof window.matchMedia=="function"?window.matchMedia(`(max-width: ${Qt-1}px)`):null,this.phone=!!this.media?.matches,this.media?.addEventListener("change",this.onMedia),!D()){this.phase="ready",this.rows=ct,this.stations=na,this.zone=ia,this.groups=aa,this.transport=Xn(),this.transport.config().then(e=>this.msgConfig=e);return}if(this.stopSession=Ft(()=>{const e=We(),t=this.access.people;this.access=e,e.people&&!t&&this.phase==="forbidden"?this.begin():!e.people&&this.phase!=="forbidden"&&(this.phase="forbidden")}),!this.access.people){this.phase="forbidden";return}this.begin(),this.stop=Bt(e=>{(e.type==="intercom_refresh"||e.type==="intercom_state")&&this.scheduleRefresh()},e=>{window.clearInterval(this.poll),this.poll=e?0:window.setInterval(()=>this.scheduleRefresh(),Qn),e&&this.scheduleRefresh()})}disconnectedCallback(){super.disconnectedCallback(),this.media?.removeEventListener("change",this.onMedia),this.stop?.(),this.stop=null,this.stopSession?.(),this.stopSession=null,window.clearTimeout(this.typing),window.clearTimeout(this.coalesce),window.clearInterval(this.poll),window.clearTimeout(this.pendingTimer),this.generation++,this.detailGeneration++}begin(){this.phase="loading",this.loadMeta(),this.reload()}get filterAccess(){return{people:this.access.people,sensitive:this.access.sensitive}}request(e,t,s){return{query:this.query,filters:Ne(this.filters,this.filterAccess),offset:e,limit:t,snapshot:s}}requestKey(){return JSON.stringify([this.query.trim(),Ne(this.filters,this.filterAccess)])}async loadMeta(){const[e,t,s]=await Promise.allSettled([es(),ts(),ss()]);e.status==="fulfilled"&&(this.features=e.value.features??{},this.photoOn=this.features.person_photo?.available!==!1),await this.loadMessaging(),this.loadDuplicates(),t.status==="fulfilled"&&t.value.stations&&(this.stations=t.value.stations,this.zone=t.value.default_zone??ee,this.filters.station&&!this.stations.some(i=>i.id===this.filters.station)&&(this.filters=Me(this.filters,"station",""))),s.status==="fulfilled"&&s.value.groups&&(this.groups=s.value.groups.groups,this.fields=s.value.groups.fields,this.photoOn=this.photoOn&&s.value.groups.photo_enabled!==!1)}async loadDuplicates(){if(!this.canManage){this.dups=null;return}try{this.dups=await fi()}catch{this.dups=null}}async loadMessaging(){if(this.transport=null,this.msgConfig=null,!this.access.message)return;const e=zs();try{const t=await e.config();this.msgConfig=t,this.transport=t.feature?e:null}catch{}}async reload(){const e=++this.generation;this.busy=!0,this.moreBusy=!1;try{const t=await $e(this.request(0,de,""));if(e!==this.generation)return;this.apply(t,"replace")}catch(t){if(e!==this.generation)return;this.fail(t)}finally{e===this.generation&&(this.busy=!1)}}async loadMore(){const e=this.page,t=e?je(e):null;if(!e||t===null||this.moreBusy||this.busy)return;const s=this.generation;this.moreBusy=!0;try{const i=await $e(this.request(t,de,e.snapshot));if(s!==this.generation)return;this.apply(i,"append")}catch(i){if(s!==this.generation)return;this.fail(i)}finally{s===this.generation&&(this.moreBusy=!1),this.queued&&!this.inflight&&!this.moreBusy&&(this.queued=!1,this.refresh())}}scheduleRefresh(){window.clearTimeout(this.coalesce),this.coalesce=window.setTimeout(()=>void this.refresh(),ta)}async refresh(){if(this.phase==="forbidden"||!this.access.people)return;if(this.inflight||this.moreBusy){this.queued=!0;return}if(this.rows.length>is){this.changed=!0;return}this.inflight=!0;const e=++this.generation;try{const t=await $e(this.request(0,Math.max(de,this.rows.length),""));if(e!==this.generation)return;this.apply(t,"replace")}catch(t){if(e!==this.generation)return;this.rows.length?this.feedDown=!0:this.fail(t)}finally{this.inflight=!1,this.queued&&(this.queued=!1,this.refresh())}}apply(e,t){if(e.state==="ready"&&e.people){const i=e.people;if(this.rows=ns(this.rows,i.records,t),this.rowsKey=this.requestKey(),this.page=i,this.shownAt=e.fetched_at,this.feedDown=!1,this.changed=t==="append"?i.stale:!1,this.phase="ready",this.selected=as(this.selected,this.rows),this.openId){const a=this.rows.find(d=>d.id===this.openId);a&&this.detail&&a.revision!==this.detail.revision&&this.openPerson(this.openId,!1)}return}if(e.state==="unsupported"){this.rows.length||(this.phase="unsupported");return}if(e.state==="forbidden"){this.phase="forbidden";return}if(this.rows.length>0&&this.rowsKey===this.requestKey()){this.feedDown=!0;return}if(this.dropRows(),e.state==="connecting"){this.phase="loading";return}this.phase=e.state==="error"?"error":"unavailable",this.panelNote=e.last_error??""}dropRows(){this.rows=[],this.page=null,this.rowsKey="",this.selected=new Set}fail(e){if(e instanceof $&&e.status===403){this.phase="forbidden";return}if(this.rows.length>0&&this.rowsKey===this.requestKey()){this.feedDown=!0;return}this.dropRows(),this.phase="error",this.panelNote=U(e)}editQuery(e){this.query=e,window.clearTimeout(this.typing),this.typing=window.setTimeout(()=>this.restart(),ea)}restart(){window.clearTimeout(this.typing),this.selected=new Set,D()&&this.reload()}setFilter(e,t){this.filters=Me(this.filters,e,t),this.restart()}clearAll(){window.clearTimeout(this.typing),this.query="",this.filters=rs(this.filters),this.profileDraft={field:"",value:""},this.restart()}applyProfile(){const{field:e,value:t}=this.profileDraft;!e||!t.trim()||(this.filters=Le(this.filters,e,t.trim()),this.profileDraft={field:"",value:""},this.restart())}setView(e){this.view=e,ce.set(lt,e),this.columnsOpen=!1}setColumns(e){this.columns=os(this.columns,e,this.access,this.employeeNoVisible),ce.set(dt,JSON.stringify(this.columns))}get employeeNoVisible(){return this.page?.employee_no_visible??!0}get shownView(){return ls(this.view,this.phone)}async openPerson(e,t=!0){this.openId=e,t&&(this.drawerOpen=!0);const s=this.rows.find(a=>a.id===e)??null;if(this.detail=s,this.detailError="",!D()){this.detailLoading=!1;return}this.detailLoading=!0;const i=++this.detailGeneration;try{const a=await he(e);if(i!==this.detailGeneration)return;a.state==="ready"&&a.person?this.detail=a.person:this.detailError="failed"}catch(a){if(i!==this.detailGeneration)return;this.detailError=a instanceof $&&(a.status===404||a.status===403)?"gone":"failed"}finally{i===this.detailGeneration&&(this.detailLoading=!1)}}closePerson(){this.detailGeneration++,this.drawerOpen=!1,this.openId="",this.detail=null,this.detailLoading=!1,this.detailError="",this.message=this.message?.inDrawer?null:this.message,this.closeActions()}closeActions(){this.acting=null;const e=this.pendingDelete;e&&(this.pendingDelete="",this.notice={tone:"warn",text:h("res.pending")},this.watchDelete(e,0))}get canManage(){return D()&&this.access.manage}onSaved(e){const{person:t}=e.detail;this.editing=null;const s=e.detail.pending?h("res.pending"):h("res.saved",{time:Q(new Date().toISOString(),this.zone)});this.notice={tone:e.detail.pending?"warn":"ok",text:s},this.result={id:t.id,state:e.detail.pending?"pending":"saved",text:s},this.selected=new Set,this.reload().then(()=>{this.rows.some(i=>i.id===t.id)&&this.openPerson(t.id)})}onDeleted(e){this.editing=null,this.notice={tone:"warn",text:h("res.pending")},this.closePerson(),this.selected=new Set,this.reload(),this.watchDelete(e.detail.id,0)}watchDelete(e,t){window.clearTimeout(this.pendingTimer),D()&&(this.pendingTimer=window.setTimeout(async()=>{let s=200;try{await he(e)}catch(i){s=i instanceof $?i.status:0}this.isConnected&&(gt(s)==="confirmed"?(this.notice={tone:"ok",text:h("res.deleted")},this.reload()):t+1<Te?this.watchDelete(e,t+1):this.notice={tone:"warn",text:h("res.still_pending")})},wt))}actionsFor(e){return Ds(e,{manage:this.canManage},{photoEnabled:this.photoOn}).filter(t=>t!=="edit")}onActionResult(e){const t=e.detail;if(this.result={id:t.id,state:t.state,text:t.text},t.state==="deleted"){this.pendingDelete="",this.notice={tone:"ok",text:t.text},this.closePerson(),this.reload();return}t.kind==="delete"&&(this.pendingDelete=t.state==="pending"?t.id:""),(t.state==="saved"||t.state==="unknown"||t.state==="pending"&&t.kind!=="delete")&&(this.scheduleRefresh(),this.refreshPerson(t.id))}async refreshPerson(e){if(!D()||this.openId!==e)return;const t=++this.detailGeneration;try{const s=await he(e);if(t!==this.detailGeneration||this.openId!==e)return;s.state==="ready"&&s.person&&(this.detail=s.person)}catch(s){if(t!==this.detailGeneration||this.openId!==e)return;s instanceof $&&s.status===404&&(this.detailError="gone")}finally{t===this.detailGeneration&&(this.detailLoading=!1)}}openEditor(e){this.drawerOpen=!1,this.editing=e}closeEditor(){this.editing=null,this.openId&&(this.drawerOpen=!0)}get canMessage(){return!!this.transport&&this.msgConfig?.feature===!0&&this.msgConfig.can_send===!0}openMessage(e,t){const s=e.map(i=>({id:i,name:this.rows.find(a=>a.id===i)?.display_name??(this.detail?.id===i?this.detail.display_name:i)}));s.length&&(this.message={people:s,inDrawer:t})}closeMessage(){this.message=null}groupLabel(e){return this.groups.find(t=>t.id===e)?.label??e}groupsText(e){const t=e.group_ids??[];return t.length?t.map(s=>this.groupLabel(s)).join(" · "):r("row.no_groups")}stationsText(e){const t=ue(e);return t===0?r("row.no_stations"):t===1?r("row.station_one"):r("row.stations",{n:t})}subtitle(){if(!this.page&&!D())return`${ct.length} אנשים · נתוני הדגמה`;const e=ds(this.rows.length,this.page,Ue(this.query,this.filters));if(e.total===null)return"";if(e.total===0)return r("page.count_zero");if(this.rows.length<e.total||e.minimum)return r(e.minimum?"page.count_min":"page.count_of",{shown:this.rows.length,total:e.total});const t=e.total===1?r("page.count_one"):r("page.count",{n:e.total});return e.of!==null&&e.of!==e.total?`${t} · ${r("page.count_of",{shown:e.total,total:e.of})}`:t}render(){if(D()&&this.phase==="forbidden")return n`<sw-page heading=${r("page.title")}><sw-state-panel data-wiskey-state="no_permission" state="forbidden" heading=${r("state.forbidden")}></sw-state-panel></sw-page>`;const e=this.phase==="ready",t=this.selecting&&e;return n`<sw-page heading=${r("page.title")} subheading=${e?this.subtitle():""} wide data-people-screen data-people-phase=${this.phase}>
        ${this.renderActions(e)}
        ${e?this.renderSearch():l}
        ${e?this.renderFilters():l}
        ${this.renderStrips()}
        ${t?this.renderBulkBar():l}
        ${this.renderBody()}
      </sw-page>
      ${this.renderDrawer()}
      ${this.editing?n`<wiskey-person-editor .userId=${this.editing==="new"?"":this.editing.id} @editor-saved=${s=>this.onSaved(s)} @editor-deleted=${s=>this.onDeleted(s)} @editor-close=${()=>this.closeEditor()}></wiskey-person-editor>`:l}
      ${this.message&&!this.message.inDrawer?this.renderMessage():l}
      ${this.stationPeople?n`<wiskey-station-people open .zone=${this.zone} @close=${()=>this.stationPeople=!1}
            @changed=${()=>{this.reload(),this.loadDuplicates()}}
            @open-person=${s=>{this.stationPeople=!1,this.openPerson(s.detail.id)}}></wiskey-station-people>`:l}
      ${this.bulk?n`<sw-bulk-people-dialog open .mode=${this.bulk} .personIds=${[...this.selected]} .stations=${this.stations.map(s=>({id:s.id,name:s.name,locks:[1,2]}))}
            .groups=${this.groups.map(s=>({id:s.id,label:s.label}))} @close=${()=>this.bulk=null} @changed=${()=>void this.reload()}></sw-bulk-people-dialog>`:l}`}renderActions(e){const t=this.shownView,s=[["cards",r("view.cards"),"grid"],["list",r("view.list"),"list"]];return this.phone||s.push(["table",r("view.table"),"menu"]),n`
      ${e?n`<div class="seg" slot="actions" role="group" aria-label=${r("view.label")}>
            ${s.map(([i,a,d])=>n`<button type="button" data-people-view=${i} aria-pressed=${t===i} aria-label=${a} title=${a} @click=${()=>this.setView(i)}><sw-icon name=${d} size=${16}></sw-icon></button>`)}
          </div>`:l}
      ${e?n`<sw-button slot="actions" variant=${this.selecting?"primary":"secondary"} icon="check" iconOnly data-people-select-mode label=${this.selecting?r("action.select_off"):r("action.select")} aria-pressed=${this.selecting}
            @click=${()=>{this.selecting=!this.selecting,this.selecting||(this.selected=new Set)}}></sw-button>`:l}
      ${e&&this.canManage?n`<sw-button slot="actions" variant="primary" icon="plus" data-wiskey-people-add @click=${()=>this.openEditor("new")}>${r("action.add")}</sw-button>`:l}
      ${e&&this.canManage?n`<sw-button slot="actions" variant="secondary" icon="door" ?iconOnly=${this.phone} label=${f("open")} data-people-station-only @click=${()=>this.stationPeople=!0}>${f("open")}</sw-button>`:l}
      ${e&&D()&&this.bulkShown?n`<sw-button slot="actions" variant="secondary" icon="upload" data-people-bulk-open @click=${()=>this.bulk="import"}>${u("open")}</sw-button>`:l}
      ${e&&this.canManage&&D()?n`<wk-profiles-link slot="actions"></wk-profiles-link>`:l}
      ${D()&&this.phase!=="forbidden"?n`<sw-button slot="actions" variant="ghost" icon="refresh" iconOnly data-wiskey-people-refresh label=${r("action.refresh")} ?disabled=${this.busy} @click=${()=>void this.reload()}></sw-button>`:l}
      ${e?n`<wk-deep-links slot="actions" place="people" mode="menu"></wk-deep-links>`:l}`}renderSearch(){const e=!this.employeeNoVisible;return n`<div class="search">
      <sw-icon name="search" size=${16}></sw-icon>
      <input type="search" data-wiskey-people-search name="query" maxlength="160" autocomplete="off" aria-label=${r("search.label")} placeholder=${r(e?"search.name":"search.name_number")}
        .value=${this.query} ?disabled=${!D()} @input=${t=>this.editQuery(t.target.value)} @keydown=${t=>t.key==="Enter"&&this.restart()} />
    </div>`}selectChip(e,t,s,i,a){return n`<label class="fchip${s?" on":""}" data-people-chip=${e}>
      <span class="k">${t}</span>
      <select name=${e} data-wiskey-people-filter=${e} aria-label=${t} .value=${s} ?disabled=${!D()} @change=${d=>a(d.target.value)}>
        <option value="" ?selected=${!s}>${r("filter.any")}</option>
        ${i.map(([d,o])=>n`<option value=${d} ?selected=${d===s}>${o}</option>`)}
      </select>
    </label>`}renderFilters(){const e=this.filters,t=this.access.sensitive,s=(this.fields??[]).filter(o=>o.enabled),i=s.find(o=>o.id===this.profileDraft.field)??null,a=cs.filter(o=>o!=="employee"||this.employeeNoVisible),d=e.sort??this.page?.sort??(this.employeeNoVisible?"employee":"name");return n`<div class="filters" role="group" aria-label=${r("filter.bar")} data-people-filters>
      ${this.groups.length?this.selectChip("group",r("filter.group"),e.group??"",this.groups.filter(o=>o.enabled).map(o=>[o.id,o.label]),o=>this.setFilter("group",o)):l}
      ${this.stations.length?this.selectChip("station",r("filter.station"),e.station??"",this.stations.map(o=>[o.id,o.name]),o=>this.setFilter("station",o)):l}
      ${this.selectChip("state",r("filter.state"),e.state??"",ps.map(o=>[o,r(`state.${o}`)]),o=>this.setFilter("state",o))}
      ${this.selectChip("rights",r("filter.rights"),e.rights??"",us.map(o=>[o,r(`rights.${o}`)]),o=>this.setFilter("rights",o))}
      ${t?this.selectChip("credential",r("filter.credential"),e.credential??"",hs.map(o=>[o,r(`credential.${o}`)]),o=>this.setFilter("credential",o)):l}
      ${t&&s.length?n`${Object.entries(e.profile??{}).map(([o,m])=>n`<button type="button" class="fchip on" data-people-profile-clear=${o} @click=${()=>{this.filters=Le(this.filters,o,""),this.restart()}}><span class="k">${s.find(g=>g.id===o)?.label??o}</span><span class="v">${m}</span><sw-icon name="close" size=${12}></sw-icon></button>`)}
          <label class="fchip" data-people-chip="profile"><span class="k">${r("filter.profile")}</span>
            <select data-people-profile-field aria-label=${r("filter.profile")} .value=${this.profileDraft.field} @change=${o=>this.profileDraft={field:o.target.value,value:""}}>
              <option value="">${r("filter.any")}</option>${s.map(o=>n`<option value=${o.id} ?selected=${o.id===this.profileDraft.field}>${o.label}</option>`)}
            </select></label>
          ${i?n`<label class="fchip on" data-people-chip="profile-value"><span class="k">${r("filter.profile_value")}</span>
                ${i.type==="select"&&i.options.length?n`<select data-people-profile-value aria-label=${r("filter.profile_value")} .value=${this.profileDraft.value} @change=${o=>{this.profileDraft={...this.profileDraft,value:o.target.value},this.applyProfile()}}>
                      <option value="">${r("filter.any")}</option>${i.options.map(o=>n`<option value=${o}>${o}</option>`)}
                    </select>`:n`<input data-people-profile-value type="text" maxlength="100" aria-label=${r("filter.profile_value")} .value=${this.profileDraft.value}
                      @input=${o=>this.profileDraft={...this.profileDraft,value:o.target.value}} @keydown=${o=>o.key==="Enter"&&this.applyProfile()} @change=${()=>this.applyProfile()} />`}
              </label>`:l}`:l}
      <label class="fchip" data-people-chip="sort"><span class="k">${r("filter.sort")}</span>
        <select name="sort" data-wiskey-people-filter="sort" aria-label=${r("filter.sort")} .value=${d} @change=${o=>this.setFilter("sort",o.target.value)}>
          ${a.map(o=>n`<option value=${o} ?selected=${o===d}>${r(`sort.${o}`)}</option>`)}
        </select></label>
      ${fs(this.query,this.filters)>0?n`<button type="button" class="clear" data-wiskey-people-clear @click=${()=>this.clearAll()}>${r("action.clear")}</button>`:l}
    </div>`}renderDuplicates(){const e=yi(this.dups?.groups);return!this.canManage||!e.groups.length?l:n`<div class="note dup" role="status" data-people-duplicates=${e.groups.length}>
      <sw-icon name="users" size=${16}></sw-icon>
      <span>${f("dup_strip",{n:e.groups.length})}${this.dups?.complete===!1?` ${f("dup_partial")}`:""}</span>
      <sw-button size="sm" variant="ghost" data-people-duplicates-toggle aria-expanded=${String(this.dupsOpen)} @click=${()=>this.dupsOpen=!this.dupsOpen}>${this.dupsOpen?f("dup_hide"):f("dup_show")}</sw-button>
      ${this.dupsOpen?n`<div class="dup-list"><p class="dup-hint">${f("dup_resolve")}</p><ul>
            ${e.groups.map(t=>n`<li data-people-duplicate-group=${t.code}>
              <span class="dup-kind">${t.code==="duplicate_display_name"?f("dup_name"):t.code==="duplicate_phone"?f("dup_phone"):f("dup_profile",{label:t.label})}</span>
              ${t.people.map(s=>n`<button type="button" class="dup-person" data-people-duplicate-person=${s.id} @click=${()=>void this.openPerson(s.id)}>${s.display_name}</button>`)}
              ${t.more?n`<span class="dup-more">${f("dup_more",{n:t.more})}</span>`:l}
            </li>`)}
          </ul></div>`:l}
    </div>`}renderStrips(){return n`
      ${this.renderDuplicates()}
      ${this.notice?n`<div class="note ${this.notice.tone}" role="status" data-wiskey-people-notice=${this.notice.tone}>
            <sw-icon name=${this.notice.tone==="ok"?"check":"warning"} size=${16}></sw-icon><span>${this.notice.text}</span>
            <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${r("action.close")} @click=${()=>this.notice=null}></sw-button>
          </div>`:l}
      ${this.feedDown&&this.rows.length?n`<div class="note stale" role="status" data-wiskey-stale><sw-icon name="offline" size=${16}></sw-icon><span>${r("state.stale",{when:Q(this.shownAt,this.zone)})}</span></div>`:l}
      ${this.changed?n`<div class="note stale" role="status" data-wiskey-people-stale><sw-icon name="warning" size=${16}></sw-icon><span>${r("state.page_stale")}</span>
            <sw-button size="sm" variant="ghost" icon="refresh" data-wiskey-people-restart ?disabled=${this.busy} @click=${()=>{this.changed=!1,this.reload()}}>${r("action.reload")}</sw-button></div>`:l}
      ${this.page&&!this.page.complete?n`<div class="note stale" role="status" data-wiskey-people-incomplete=${this.page.incomplete_reason??"unknown"}><sw-icon name="warning" size=${16}></sw-icon><span>${r("state.partial")} · ${this.page.incomplete_reason==="rate_limited"?r("state.partial_rate"):r("state.partial_scan")}</span></div>`:l}`}renderBody(){switch(this.phase){case"loading":return this.renderSkeleton();case"unsupported":return n`<sw-state-panel icon="users" data-wiskey-state="unsupported" state="empty" heading=${r("state.unsupported")}></sw-state-panel>`;case"unavailable":return n`<sw-state-panel icon="users" data-wiskey-state="unavailable" state="empty" heading=${r("state.unavailable")}>${Kt("system.configure")?n`<a class="settings-link" href="#/system/diagnostics?tab=access-control">${r("action.settings")}</a>`:l}</sw-state-panel>`;case"error":return n`<sw-state-panel data-wiskey-state="load_error" state="error" heading=${r("state.error")} hint=${this.panelNote} actionLabel=${r("action.retry")} @action=${()=>this.begin()}></sw-state-panel>`}if(this.busy&&!this.rows.length)return this.renderSkeleton();if(!this.rows.length){const s=Ue(this.query,this.filters);return n`<sw-state-panel icon="users" data-wiskey-people-empty state="empty" heading=${r(s?"state.no_results":"state.empty")} actionLabel=${s?r("action.clear"):""} @action=${()=>this.clearAll()}></sw-state-panel>`}const e=this.shownView,t=this.page?je(this.page):null;return n`${e==="cards"?this.renderCards():e==="table"?this.renderTable():this.renderList()}
      ${t!==null?n`<div class="more"><sw-button data-wiskey-people-more ?disabled=${this.moreBusy} @click=${()=>void this.loadMore()}>${this.moreBusy?r("state.detail_loading"):r("action.more",{n:Math.min(de,Math.max(1,(this.page?.total??0)-this.rows.length))})}</sw-button></div>`:l}`}renderSkeleton(){return n`<div class="skeletons" aria-busy="true" data-people-skeleton>${Array.from({length:6},()=>n`<div class="sk-row"><span class="sk dot"></span><span class="sk-col"><span class="sk a"></span><span class="sk b"></span></span><span class="sk c"></span></div>`)}</div>`}checkbox(e){const t=this.selected.has(e.id);return n`<button type="button" class="cbx" role="checkbox" aria-checked=${t} aria-label=${r("action.select_row",{name:e.display_name})} data-person-select=${e.id}
      @click=${s=>{s.stopPropagation(),this.selected=ms(this.selected,e.id)}} @keydown=${s=>s.stopPropagation()}>
      <span class="box${t?" on":""}">${t?n`<sw-icon name="check" size=${14}></sw-icon>`:l}</span></button>`}messageButton(e){return!this.canMessage||e.phone_set===!1?l:n`<sw-button variant="ghost" iconOnly icon="mail" data-person-message-row label=${r("action.message")} @click=${t=>{t.stopPropagation(),this.openMessage([e.id],!1)}}></sw-button>`}credentialsText(e){const t=mt(e);return t?t.kinds.length?t.kinds.map(s=>s==="card"?t.cards>1?r("cred.cards",{n:t.cards}):r("cred.card"):r("cred.pin")).join(" · "):t.none?r("cred.none"):r("cred.unknown"):""}rowKeys(e){return t=>{t.target===t.currentTarget&&(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.openPerson(e.id))}}renderList(){return n`<ul class="rows" role="list" data-wiskey-people-list>
      ${le(this.rows,e=>e.id,e=>{const t=me(e);return n`<li class="row${this.selected.has(e.id)?" sel":""}" tabindex="0" data-wiskey-person-name-row=${e.id} data-person-row=${e.id} @click=${()=>void this.openPerson(e.id)} @keydown=${this.rowKeys(e)}>
          ${this.selecting?this.checkbox(e):l}
          <sw-avatar name=${e.display_name} size=${36} aria-hidden="true"></sw-avatar>
          <span class="main"><b data-wiskey-person-name>${e.display_name}</b><span class="sub">${e.employee_no!==null?n`<bdi class="ltr" data-wiskey-person-employee>${e.employee_no}</bdi> · `:l}${this.groupsText(e)}</span></span>
          <span class="side hide-p">${this.stationsText(e)}</span>
          <span class="side hide-p">${ge(e,this.zone,!0)}</span>
          <sw-badge data-person-state kind=${t.kind} label=${t.label}></sw-badge>
          ${this.messageButton(e)}
        </li>`})}
    </ul>`}renderCards(){return n`<div class="grid" data-wiskey-people-cards>
      ${le(this.rows,e=>e.id,e=>{const t=me(e),s=ve(se(e));return n`<article class="card${this.selected.has(e.id)?" sel":""}" tabindex="0" data-person-row=${e.id} @click=${()=>void this.openPerson(e.id)} @keydown=${this.rowKeys(e)}>
          <div class="ctop">${this.selecting?this.checkbox(e):l}<sw-avatar name=${e.display_name} size=${40} aria-hidden="true"></sw-avatar>
            <span class="main"><b data-wiskey-person-name>${e.display_name}</b>${e.employee_no!==null?n`<span class="sub"><bdi class="ltr" data-wiskey-person-employee>${e.employee_no}</bdi></span>`:l}</span>
            <sw-badge kind=${t.kind} label=${t.label}></sw-badge></div>
          <div class="cmeta"><span>${this.groupsText(e)}</span><span>${this.stationsText(e)}</span><span>${ge(e,this.zone,!0)}</span></div>
          <div class="cfoot">${ue(e)||e.stations?.length?n`<sw-badge kind=${s.kind} label=${s.label}></sw-badge>`:l}${this.credentialsText(e)?n`<span class="sub">${this.credentialsText(e)}</span>`:l}${this.messageButton(e)}</div>
        </article>`})}
    </div>`}renderTable(){const e=gs(this.columns,this.access,this.employeeNoVisible),t={name:r("col.name"),employee:r("col.employee"),groups:r("col.groups"),stations:r("col.stations"),credentials:r("col.credentials"),validity:r("col.validity"),state:r("col.state"),sync:r("col.sync")},s=ws(this.selected,this.rows),i=(a,d)=>{switch(d){case"name":return n`<span class="who"><sw-avatar name=${a.display_name} size=${34} aria-hidden="true"></sw-avatar><b data-wiskey-person-name>${a.display_name}</b></span>`;case"employee":return n`<bdi class="ltr" data-wiskey-person-employee>${a.employee_no??""}</bdi>`;case"groups":return n`${this.groupsText(a)}`;case"stations":return n`<span data-wiskey-person-assignments=${ue(a)}>${this.stationsText(a)}</span>`;case"credentials":return n`${this.credentialsText(a)}`;case"validity":return n`${ge(a,this.zone,!0)}`;case"state":{const o=me(a);return n`<sw-badge data-person-state kind=${o.kind} label=${o.label}></sw-badge>`}default:{const o=ve(se(a));return n`<sw-badge kind=${o.kind} label=${o.label}></sw-badge>`}}};return n`<div class="tablewrap" data-wiskey-people-table>
      <div class="tabletools">
        <button type="button" class="linkbtn" data-people-columns aria-expanded=${this.columnsOpen} @click=${()=>this.columnsOpen=!this.columnsOpen}><sw-icon name="filter" size=${14}></sw-icon>${r("action.columns")}</button>
        ${this.columnsOpen?n`<div class="colmenu" role="group" aria-label=${r("action.columns")}>
              ${vs(this.access,this.employeeNoVisible).map(a=>n`<label class="colopt"><input type="checkbox" data-people-column=${a} .checked=${e.includes(a)} ?disabled=${a==="name"} @change=${()=>this.setColumns(a)} />${t[a]}</label>`)}
            </div>`:l}
      </div>
      <div class="scroll">
        <table>
          <thead><tr>
            ${this.selecting?n`<th class="chk"><button type="button" class="cbx" role="checkbox" aria-checked=${s==="all"?"true":s==="some"?"mixed":"false"} aria-label=${r("action.select_all")} data-people-select-all @click=${()=>this.selected=_s(this.selected,this.rows)}><span class="box${s!=="none"?" on":""}">${s==="all"?n`<sw-icon name="check" size=${14}></sw-icon>`:s==="some"?n`<sw-icon name="minus" size=${14}></sw-icon>`:l}</span></button></th>`:l}
            ${e.map(a=>n`<th scope="col" data-col=${a}>${t[a]}</th>`)}
            <th class="act" aria-label=${r("col.actions")}></th>
          </tr></thead>
          <tbody>
            ${le(this.rows,a=>a.id,a=>n`<tr class="${this.selected.has(a.id)?"sel":""}" tabindex="0" data-person-row=${a.id} @click=${()=>void this.openPerson(a.id)} @keydown=${this.rowKeys(a)}>
              ${this.selecting?n`<td class="chk">${this.checkbox(a)}</td>`:l}
              ${e.map(d=>n`<td data-col=${d}>${i(a,d)}</td>`)}
              <td class="act">${this.messageButton(a)}</td>
            </tr>`)}
          </tbody>
        </table>
      </div>
    </div>`}renderBulkBar(){const e=this.selected.size;return n`<div class="bulk" role="toolbar" aria-label=${r("bulk.bar")} data-people-bulk>
      <span class="n" data-people-bulk-count=${e}>${r("bulk.selected",{n:e})}</span>
      <span class="sp"></span>
      ${this.canMessage?n`<sw-button icon="mail" data-people-bulk-message ?disabled=${e===0} @click=${()=>this.openMessage([...this.selected],!1)}>${r("action.message_selected")}</sw-button>`:l}
      ${this.canManage&&D()&&this.bulkShown?n`<sw-button icon="edit" data-people-bulk-edit ?disabled=${e===0} @click=${()=>this.bulk="edit"}>${u("edit_open")}</sw-button>`:l}
      <sw-button variant="ghost" data-people-bulk-clear ?disabled=${e===0} @click=${()=>this.selected=new Set}>${r("action.clear_selection")}</sw-button>
    </div>`}renderDrawer(){if(!this.openId&&!this.drawerOpen)return l;const e=Object.fromEntries(this.stations.map(o=>[o.id,o.name])),t=Object.fromEntries(this.groups.map(o=>[o.id,o.label])),s=Object.fromEntries(this.groups.map(o=>[o.id,o.station_ids?o.station_ids.length:null])),i=this.detail,a=this.canManage&&!!i&&i.editable!==!1,d=this.actionsFor(i);return n`<wiskey-person-drawer .open=${this.drawerOpen} .person=${i} .loading=${this.detailLoading} .error=${this.detailError}
        .stationNames=${e} .groupLabels=${t} .groupStations=${s} .fields=${this.fields} .zone=${this.zone} .photoEnabled=${this.photoOn}
        .canEdit=${a} .canMessage=${this.canMessage&&!!i&&i.phone_set!==!1} .canAct=${d.length>0&&!this.detailLoading}
        .messagesTab=${this.canMessage} .transport=${this.transport} .messagesRev=${this.messagesRev}
        .resultLine=${i&&this.result?.id===i.id?this.result:null}
        @close=${()=>this.closePerson()} @edit=${o=>this.openEditor({id:o.detail.id})} @message=${o=>this.openMessage([o.detail.id],!0)}
        @actions=${()=>this.acting="menu"}>
        ${this.message?.inDrawer?this.renderMessage():l}
        ${this.acting&&i?n`<wiskey-person-actions .person=${i} .kind=${this.acting} .actions=${d} .canCapture=${this.access.capture} .zone=${this.zone}
              @action-result=${o=>{o.stopPropagation(),this.onActionResult(o)}}
              @close=${o=>{o.stopPropagation(),this.closeActions()}}></wiskey-person-actions>`:l}
      </wiskey-person-drawer>`}renderMessage(){const e=this.message;return n`<wiskey-message-dialog open .transport=${this.transport} .people=${e.people} @close=${t=>{t.stopPropagation(),this.closeMessage(),t.detail?.sent&&(this.selected=new Set,this.messagesRev+=1)}}></wiskey-message-dialog>`}};w.styles=K`
    .search {
      position: relative;
      display: flex;
      align-items: center;
      inline-size: min(100%, 28rem);
      color: var(--sw-text-3);
    }
    .search sw-icon {
      position: absolute;
      inset-inline-start: 12px;
      pointer-events: none;
    }
    .search input {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 44px;
      padding-inline: 36px 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
    }
    .search input:focus-visible,
    .fchip select:focus-visible,
    .fchip input:focus-visible,
    .seg button:focus-visible,
    .cbx:focus-visible,
    .linkbtn:focus-visible,
    .clear:focus-visible,
    .row:focus-visible,
    .card:focus-visible,
    tr:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface);
    }
    .seg button {
      inline-size: 44px;
      block-size: 44px;
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    sw-button {
      min-block-size: 44px;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    /* R5-SECURITY: the filter chips are raised keys (shadow 1, no outline); an active one is a filled accent field */
    .fchip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 12px 6px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      max-inline-size: 100%;
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    }
    .fchip.on {
      border-color: transparent;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-accent) 45%, transparent);
    }
    .fchip .k {
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .fchip.on .k {
      color: inherit;
    }
    .fchip select,
    .fchip input {
      min-block-size: 44px;
      max-inline-size: 11rem;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: var(--sw-fw-medium);
      text-overflow: ellipsis;
    }
    .fchip input {
      max-inline-size: 9rem;
      border-block-end: 1px solid var(--sw-border-strong);
    }
    button.fchip {
      cursor: pointer;
      padding-inline: 12px;
    }
    .clear {
      min-block-size: 44px;
      padding-inline: 12px;
      border: 0;
      background: transparent;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .note {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .note > span {
      flex: 1 1 12rem;
    }
    .note.stale {
      background: var(--sw-stale-soft);
    }
    .note.ok {
      background: var(--sw-success-soft);
    }
    /* WISKEY-PEOPLE-COMPLETE-2390: people who may be in the list twice */
    .note.dup {
      background: var(--sw-warning-soft);
    }
    .dup-list {
      flex-basis: 100%;
    }
    .dup-list ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
    }
    .dup-list li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 8px;
    }
    .dup-hint {
      margin: 0 0 6px;
      color: var(--sw-text-2);
    }
    .dup-kind {
      font-weight: var(--sw-fw-semibold);
    }
    .dup-person {
      min-block-size: 32px;
      padding: 2px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font: inherit;
      cursor: pointer;
    }
    .dup-person:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .dup-more {
      color: var(--sw-text-3);
    }
    /* not sticky: now that the page scrolls, a bar stuck to the top of the column would pass under the shell's floating search / status
       corner (it covers the far end of whatever is at the top) and cover the rows beneath it (layout guard: floating) */
    .bulk {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--sw-accent);
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .bulk .n {
      font-weight: var(--sw-fw-semibold);
    }
    .bulk .sp {
      flex: 1;
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 60px;
      padding: 8px 14px;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
    }
    .row:last-child {
      border-block-end: 0;
    }
    /* R5-SECURITY (mobile-native / emil): a hover only under a fine pointer; the press answers on pointer-down */
    @media (hover: hover) and (pointer: fine) {
      .row:hover,
      .card:hover,
      tbody tr:hover {
        background: var(--sw-surface-2);
      }
    }
    .row,
    .card,
    tbody tr {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .row:active,
    .card:active {
      transform: scale(var(--sw-press-scale));
    }
    tbody tr:active td {
      background: var(--sw-surface-3);
    }
    .row.sel,
    .card.sel,
    tbody tr.sel {
      background: var(--sw-accent-soft);
    }
    /* R5-SECURITY: the state badge is the question of its column - 13/700, a 26 px field */
    sw-badge {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-bold);
      line-height: 20px;
      padding-block: 3px;
      padding-inline: 10px;
    }
    .main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 auto;
      min-inline-size: 0;
    }
    .main b {
      font-weight: 800;
      font-size: var(--sw-fs-xl);
      letter-spacing: -0.01em;
      color: var(--sw-heading, var(--sw-text));
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .side {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
      gap: 12px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      cursor: pointer;
    }
    .card .ctop b {
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .ctop {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cmeta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .cfoot {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      min-block-size: 24px;
    }
    .cfoot sw-button {
      margin-inline-start: auto;
    }
    .cbx {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      flex-shrink: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0;
    }
    .box {
      display: grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border: 2px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: var(--sw-text-inverse);
    }
    .box.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .tablewrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .tabletools {
      position: relative;
      display: flex;
      justify-content: flex-end;
    }
    .linkbtn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .colmenu {
      position: absolute;
      inset-block-start: 100%;
      inset-inline-end: 0;
      z-index: 3;
      display: flex;
      flex-direction: column;
      min-inline-size: 12rem;
      padding: 6px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-solid);
      box-shadow: var(--sw-shadow-3);
    }
    .colopt {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      padding-inline: 8px;
      font-size: var(--sw-fs-sm);
    }
    .colopt input {
      inline-size: 20px;
      block-size: 20px;
    }
    .scroll {
      overflow: auto;
      border: 1px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      /* R5-SECURITY pass 2: the table is the screen's one primary object - shadow 2 */
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-base);
    }
    th,
    td {
      padding: 8px 14px;
      text-align: start;
      white-space: nowrap;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    /* R5-SECURITY: column heads are a filled head row (surface-2, 11/700 tracked); the name cell is the row's display line */
    th {
      position: sticky;
      inset-block-start: 0;
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-xs);
      letter-spacing: 0.03em;
      padding-block: 10px;
    }
    /* R5-SECURITY pass 2: the name is the row's display line (17/800, tracked -0.01em), the row 60 px, the figures 600 */
    td .who b,
    td.name b {
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      letter-spacing: -0.01em;
      color: var(--sw-heading, var(--sw-text));
    }
    td {
      font-variant-numeric: tabular-nums;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    tbody tr {
      cursor: pointer;
      block-size: 60px;
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    td.chk,
    th.chk {
      inline-size: 44px;
      padding: 0 4px;
    }
    td.act,
    th.act {
      inline-size: 48px;
      padding: 0 4px;
    }
    /* break-ui (R5): an 80-character name used to push every other column out of the table (nowrap cells, no cap); the name cell
       is capped at 30ch and truncates, the full name lives in the person drawer */
    .who {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-inline-size: min(30ch, 34vw);
    }
    .who b {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* PEOPLE-TABLE-2271: the R5 cells (14 px sides, 15 px figures, the 13/700 state field) made the table's narrowest form about
       930 px, wider than its box from the table's first width (TABLE_MIN_WIDTH, 1000 px) to about 1075 px - it scrolled sideways by
       51 px at 1024. Below 1200 px the cells keep the R5 type and take 8 px sides; 1200 px and up are unchanged. */
    @media (max-width: 1199px) {
      th:not(.chk):not(.act),
      td:not(.chk):not(.act) {
        padding-inline: 8px;
      }
    }
    .more {
      display: flex;
      justify-content: center;
      padding-block: 4px;
    }
    .skeletons {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .sk-row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-block-size: 56px;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
    }
    .sk-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;
    }
    .sk {
      display: block;
      border-radius: var(--sw-r-xs);
      background: linear-gradient(90deg, var(--sw-skeleton), var(--sw-skeleton-shine), var(--sw-skeleton));
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    .sk.dot {
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
    }
    .sk.a {
      inline-size: 40%;
      block-size: 12px;
    }
    .sk.b {
      inline-size: 25%;
      block-size: 10px;
    }
    .sk.c {
      inline-size: 70px;
      block-size: 18px;
      border-radius: var(--sw-r-pill);
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sk {
        animation: none;
      }
    }
    .settings-link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .hide-p {
        display: none;
      }
      .search {
        inline-size: 100%;
      }
      .filters {
        flex-wrap: nowrap;
        overflow-x: auto;
        padding-block-end: 4px;
        scrollbar-width: none;
      }
      .fchip {
        flex-shrink: 0;
      }
    }
  `;v([c()],w.prototype,"access",2);v([c()],w.prototype,"phase",2);v([c()],w.prototype,"panelNote",2);v([c()],w.prototype,"rows",2);v([c()],w.prototype,"page",2);v([c()],w.prototype,"shownAt",2);v([c()],w.prototype,"feedDown",2);v([c()],w.prototype,"changed",2);v([c()],w.prototype,"busy",2);v([c()],w.prototype,"moreBusy",2);v([c()],w.prototype,"query",2);v([c()],w.prototype,"filters",2);v([c()],w.prototype,"view",2);v([c()],w.prototype,"columns",2);v([c()],w.prototype,"columnsOpen",2);v([c()],w.prototype,"phone",2);v([c()],w.prototype,"stations",2);v([c()],w.prototype,"zone",2);v([c()],w.prototype,"groups",2);v([c()],w.prototype,"fields",2);v([c()],w.prototype,"features",2);v([c()],w.prototype,"photoOn",2);v([c()],w.prototype,"profileDraft",2);v([c()],w.prototype,"selecting",2);v([c()],w.prototype,"selected",2);v([c()],w.prototype,"openId",2);v([c()],w.prototype,"drawerOpen",2);v([c()],w.prototype,"detail",2);v([c()],w.prototype,"detailLoading",2);v([c()],w.prototype,"detailError",2);v([c()],w.prototype,"editing",2);v([c()],w.prototype,"notice",2);v([c()],w.prototype,"transport",2);v([c()],w.prototype,"msgConfig",2);v([c()],w.prototype,"message",2);v([c()],w.prototype,"acting",2);v([c()],w.prototype,"result",2);v([c()],w.prototype,"bulk",2);v([c()],w.prototype,"bulkShown",2);v([c()],w.prototype,"messagesRev",2);v([c()],w.prototype,"stationPeople",2);v([c()],w.prototype,"dups",2);v([c()],w.prototype,"dupsOpen",2);w=v([V("wiskey-people")],w);export{w as WiskeyPeople,sa as syncBadge};
