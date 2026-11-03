import{E as P,F as u,a as R,A as l,e as o,H as N,G as h,R as oe,j as W,bq as Ke,bw as Te,l as D,bx as pe,n as Je,by as Ye,i as ie,av as ue,J as Ve,bz as Ge,bA as Xe,be as we,aA as Ze,r as Qe}from"./index-22diBytU.js";import"./sw-table-DVq7I7D0.js";import"./sw-place-tree-CSsWYkTA.js";import{i as et,w as K,a as tt,g as st,b as it,c as at,d as nt}from"./access-stations-CniAjZRs.js";import{g as ot,a as rt,i as Me,s as lt,r as ct,b as dt}from"./intercom-BPXdeCfa.js";import{a as ht,w as x,t as fe,T as V,c as ge,f as k,b as Oe,s as pt,n as ut,d as wt,e as ft,g as gt,h as mt,l as bt,i as vt,j as kt,k as yt,m as $t,o as xt,p as _t,A as zt,q as St,U as Tt,r as F,u as B,v as te,x as J,y as re,z as le,B as se,C as Ae,D as X,E as ae,F as Mt,G as Ce,H as Ot,I as At,J as Ct,K as Et,L as Lt,M as It,N as Ee,P as Dt,O as me,Q as Pt,R as Rt,S as Nt,V as Bt,W as qt,X as Ht,Y as Ut,Z as jt,_ as Ft,$ as Wt,a0 as Kt,a1 as Jt,a2 as Yt,a3 as Vt,a4 as Gt,a5 as Xt,a6 as Zt,a7 as Qt,a8 as es,a9 as ts,aa as ss}from"./access-parity-BSL8nTXw.js";import"./sw-logo-art-Va6y_cIM.js";import"./schedules-logic-rdplUl0d.js";import"./wiskey-format-B1C9aa4N.js";var is=Object.defineProperty,as=Object.getOwnPropertyDescriptor,T=(t,e,s,i)=>{for(var a=i>1?void 0:i?as(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(a=(i?r(e,s,a):r(a))||a);return i&&a&&is(e,s,a),a};let _=class extends R{constructor(){super(...arguments),this.tone="default",this.icon="",this.iconOnly=!1,this.disabled=!1,this.busy=!1,this.armed=!1,this.block=!1,this.size="md",this.label="",this.href=""}glyph(){return this.icon?et(this.icon)?K(this.icon,16):o`<sw-icon .name=${this.icon} size=${16}></sw-icon>`:l}render(){const t=this.iconOnly?l:o`<span><slot></slot></span>`,e=this.label||l;return this.href&&!this.disabled?o`<a class="btn" href=${this.href} aria-label=${e}>${this.glyph()}${t}</a>`:o`<button class="btn" type="button" ?disabled=${this.disabled} aria-label=${e} aria-busy=${this.busy?"true":l}>${this.glyph()}${t}</button>`}};_.styles=P`
    :host {
      display: inline-flex;
      min-inline-size: 0;
      /* WALL-OVERFLOW-2270: the slotted label is ellipsized by the inner span (.btn > span); the host says so too, so the
         label's full (unpainted) run past a narrow card - a long door name at 320 px - reads as ellipsized text, not as text
         cut by the card. No rendering change: text-overflow does not apply to the flex host itself. */
      text-overflow: ellipsis;
    }
    :host([block]) {
      display: flex;
    }
    :host([block]) .btn {
      inline-size: 100%;
    }
    .btn {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      min-inline-size: var(--sw-touch-desktop, 44px);
      max-inline-size: 100%;
      padding-inline: var(--sw-s-3h);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      line-height: 1.2;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    .btn > span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host([size='lg']) .btn {
      min-block-size: 56px;
      font-size: var(--sw-fs-md);
    }
    :host([icon-only]) .btn {
      padding-inline: 0;
    }
    .btn:hover {
      background: var(--sw-surface-2);
    }
    :host([tone='ok']) .btn {
      background: var(--sw-success-soft);
      border-color: transparent;
      color: var(--sw-success-text);
      box-shadow: none;
    }
    :host([tone='danger']) .btn {
      background: var(--sw-danger-soft);
      border-color: transparent;
      color: var(--sw-danger-text);
      box-shadow: none;
    }
    :host([tone='primary']) .btn {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      box-shadow: var(--sw-shadow-primary);
    }
    :host([tone='primary']) .btn:hover {
      background: var(--sw-accent-hover);
    }
    :host([tone='quiet']) .btn {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      padding-inline: var(--sw-s-1);
      justify-content: flex-start;
    }
    :host([tone='dashed']) .btn {
      background: transparent;
      border-style: dashed;
      color: var(--sw-text-2);
      box-shadow: none;
      font-weight: var(--sw-fw-regular);
    }
    :host([tone='ok']) .btn:hover,
    :host([tone='danger']) .btn:hover,
    :host([tone='quiet']) .btn:hover,
    :host([tone='dashed']) .btn:hover {
      background: var(--sw-hover-wash);
    }
    :host([armed]) .btn {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    :host([busy]) .btn {
      cursor: progress;
    }
    :host([disabled]) .btn {
      cursor: not-allowed;
      opacity: var(--sw-disabled-opacity);
    }
    .btn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    @media (max-width: 1100px) {
      .btn {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;T([u({reflect:!0})],_.prototype,"tone",2);T([u()],_.prototype,"icon",2);T([u({type:Boolean,reflect:!0,attribute:"icon-only"})],_.prototype,"iconOnly",2);T([u({type:Boolean,reflect:!0})],_.prototype,"disabled",2);T([u({type:Boolean,reflect:!0})],_.prototype,"busy",2);T([u({type:Boolean,reflect:!0})],_.prototype,"armed",2);T([u({type:Boolean,reflect:!0})],_.prototype,"block",2);T([u()],_.prototype,"size",2);T([u()],_.prototype,"label",2);T([u()],_.prototype,"href",2);_=T([N("wk-action-button")],_);var ns=Object.defineProperty,os=Object.getOwnPropertyDescriptor,y=(t,e,s,i)=>{for(var a=i>1?void 0:i?os(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(a=(i?r(e,s,a):r(a))||a);return i&&a&&ns(e,s,a),a};const rs={he:"עברית",iw:"עברית",en:"English",ar:"العربية",ru:"Русский"},be=t=>rs[t.toLowerCase().split("-")[0]]??t.toUpperCase();let b=class extends R{constructor(){super(...arguments),this.open=!1,this.stations=[],this.places=null,this.scope="scope",this.phrases=[],this.preselect="",this.tts={},this.engines=null,this.enginesNote="",this.engine="",this.language="",this.message="",this.choice="",this.sending=!1,this.result=null,this.locked=!1,this.retryAt=0,this.more=!1,this.sent=[],this.loadedEngines=!1,this.timer=0}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(t){t.has("open")&&this.open&&this.reset()}updated(t){t.has("open")&&this.open&&!this.loadedEngines&&this.loadEngines()}reset(){this.message="",this.result=null,this.locked=!1,this.retryAt=0,this.sending=!1,this.more=!1,this.sent=[],this.choice=this.choices()[0]?.key??""}online(){return this.stations.filter(t=>t.online)}choices(){return ht(this.online(),this.places,this.scope,this.preselect||void 0)}current(){const t=this.choices();return t.find(e=>e.key===this.choice)??t[0]}async loadEngines(){this.loadedEngines=!0,this.enginesNote="";try{const t=await ot();t.tts&&t.tts.engines.length?(this.engines=t.tts,this.pickEngine(t.tts.default&&t.tts.engines.some(e=>e.engine_id===t.tts.default)?t.tts.default:t.tts.engines[0].engine_id)):t.tts?this.enginesNote=x().announceDlg.noEngine:this.enginesNote=t.state==="unsupported"?x().announceDlg.enginesUnsupported:x().announceDlg.noEngine}catch(t){this.enginesNote=oe(t),this.loadedEngines=!1}}pickEngine(t){this.engine=t;const e=this.engines?.engines.find(i=>i.engine_id===t),s=e?.supported_languages??[];this.language=s.includes("he")?"he":s.includes("iw")?"iw":e?.default_language??s[0]??""}busySeconds(){return Math.max(0,Math.ceil((this.retryAt-Date.now())/1e3))}startRetryClock(){window.clearInterval(this.timer),this.timer=window.setInterval(()=>{this.busySeconds()<=0?(window.clearInterval(this.timer),this.retryAt=0):this.requestUpdate()},1e3)}ready(){const t=fe(this.message);return!!this.engine&&t>0&&t<=V&&!this.sending&&!this.locked&&this.busySeconds()===0&&!!this.current()?.stationIds.length}async send(){const t=this.current(),e=ge(this.message);if(!this.ready()||!t)return;const s=x().announceDlg,i=t.stationIds.filter(r=>this.online().some(d=>d.id===r));if(!i.length){this.result={tone:"warn",text:s.noTargets};return}this.sending=!0,this.result=null;let a=[];try{a=await tt({stationIds:i,engine_id:this.engine,language:this.language||null,message:e})}finally{this.sending=!1}for(const r of a)r.status&&this.dispatchEvent(new CustomEvent("tts-status",{detail:r.status,bubbles:!0,composed:!0}));this.sent=a.filter(r=>r.outcome==="sent").map(r=>r.station_id),this.result=this.summarize(a),a.some(r=>r.outcome==="unknown")&&(this.locked=!0);const n=a.filter(r=>r.code==="audio_busy").map(r=>r.retry_after_s??10);n.length&&!this.locked&&(this.retryAt=Date.now()+Math.min(...n)*1e3,this.startRetryClock())}summarize(t){const e=x().announceDlg,s=t.filter(n=>n.outcome==="sent"),i=t.filter(n=>n.outcome!=="sent"),a=n=>this.stations.find(r=>r.id===n)?.name??n;return i.length?t.some(n=>n.outcome==="unknown")?{tone:"warn",text:s.length?k(e.partial,{ok:s.length,bad:i.length,names:i.map(n=>a(n.station_id)).join(", ")})+" · "+e.unknown:e.unknown}:s.length?{tone:"warn",text:k(e.partial,{ok:s.length,bad:i.length,names:i.map(n=>a(n.station_id)).join(", ")})}:i.every(n=>n.code==="audio_busy")?{tone:"warn",text:e.busy}:{tone:"err",text:i[0].error??e.failed}:{tone:"ok",text:s.length===1?e.sentOne:k(e.sentMany,{n:s.length})}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}progress(){if(this.sent.length!==1)return"";const t=this.tts[this.sent[0]];return t?Oe(t):""}renderResult(){if(!this.result)return l;const t=x().announceDlg,e=this.busySeconds(),s=this.progress()&&this.result.tone==="ok"?this.progress():this.result.text;return o`<div class="result ${this.result.tone}" role="status" data-wk-announce-result data-tone=${this.result.tone}>${s}${e>0?o` · ${k(t.busyIn,{n:e})}`:l}</div>`}render(){const t=x().announceDlg,e=this.choices(),s=this.current(),i=fe(this.message),n=this.engines?.engines.find(c=>c.engine_id===this.engine)?.supported_languages??[],r=this.phrases.length?this.phrases:t.phraseList,d=this.result?.tone==="ok"&&this.sent.length>0;return o`<sw-dialog ?open=${this.open} wide ?locked=${this.sending} heading=${t.title} data-wk-announce-dialog @close=${()=>this.close()}>
      <div class="body">
        <div class="fld">
          <label>${t.to}</label>
          <div class="chips" role="group" aria-label=${t.to}>
            ${e.length?e.map(c=>o`<button type="button" class="chip" data-wk-target=${c.key} aria-pressed=${String(c.key===s?.key)} ?disabled=${this.sending} @click=${()=>this.choice=c.key}>
                    ${c.kind==="station"?o`<sw-icon name="door" size=${14}></sw-icon>`:c.kind==="place"?o`<sw-icon name="pin" size=${14}></sw-icon>`:l}<span>${c.label}</span>
                  </button>`):o`<span class="note" data-wk-announce-notargets>${t.noTargets}</span>`}
          </div>
        </div>
        <div class="fld">
          <label for="msg">${t.message}</label>
          <textarea id="msg" data-wk-announce-message rows="3" maxlength=${V*2} ?disabled=${this.sending||this.locked} .value=${this.message} @input=${c=>this.message=c.target.value}></textarea>
          <span class="cnt ${i>V?"over":""}" aria-live="polite">${k(t.counter,{n:i,max:V})}</span>
        </div>
        <div class="fld">
          <label>${t.phrases}</label>
          <div class="chips" role="group" aria-label=${t.phrases}>
            ${r.map(c=>o`<button type="button" class="chip" data-wk-phrase aria-pressed=${String(ge(this.message)===c)} ?disabled=${this.sending||this.locked} @click=${()=>this.message=c}><span>${c}</span></button>`)}
          </div>
        </div>
        <div class="prev" data-wk-announce-preview>
          <sw-icon name="volume" size=${15}></sw-icon>
          <span>${k(t.preview,{lang:be(this.language||"he"),voice:t.voiceDefault,n:pt(this.message)})}</span>
          <span class="sp"></span>
          <wk-action-button tone="quiet" data-wk-announce-more aria-expanded=${String(this.more)} @click=${()=>this.more=!this.more}>${t.more}</wk-action-button>
        </div>
        ${this.more?o`<div class="engine" data-wk-announce-engine>
                ${this.engines?.engines.length?o`<sw-field label=${t.engine}>
                        <select data-wk-engine .value=${this.engine} @change=${c=>this.pickEngine(c.target.value)}>
                          ${this.engines.engines.map(c=>o`<option value=${c.engine_id} ?selected=${c.engine_id===this.engine}>${c.name}</option>`)}
                        </select>
                      </sw-field>
                      ${n.length?o`<sw-field label=${t.language}>
                            <select data-wk-language .value=${this.language} @change=${c=>this.language=c.target.value}>
                              ${n.map(c=>o`<option value=${c} ?selected=${c===this.language}>${be(c)}</option>`)}
                            </select>
                          </sw-field>`:l}`:o`<span class="note">${this.enginesNote||t.enginesLoading}</span>`}
                <span class="note" style="grid-column:1/-1">${t.external}</span>
              </div>`:!this.engines&&this.enginesNote?o`<div class="result warn" role="status" data-wk-announce-engines-state>${this.enginesNote}</div>`:l}
        ${this.renderResult()}
      </div>
      <div slot="footer">
        <wk-action-button tone="primary" icon="volume" data-wk-announce-send ?disabled=${!this.ready()} ?busy=${this.sending} @click=${()=>void this.send()}>${this.sending?t.sending:d?t.sendAgain:t.send}</wk-action-button>
        <wk-action-button data-wk-announce-close ?disabled=${this.sending} @click=${()=>this.close()}>${d?t.close:t.cancel}</wk-action-button>
      </div>
    </sw-dialog>`}};b.styles=P`
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .fld {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      position: relative;
    }
    .fld > label {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .chip {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      max-inline-size: 100%;
      padding-inline: var(--sw-s-3h);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      text-align: start;
    }
    .chip:hover {
      background: var(--sw-surface-2);
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-medium);
    }
    .chip span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .chip:focus-visible,
    textarea:focus-visible,
    select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    textarea {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: 88px;
      padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-5);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
      line-height: 1.5;
      resize: vertical;
    }
    textarea:disabled {
      opacity: var(--sw-disabled-opacity);
    }
    .cnt {
      position: absolute;
      inset-block-end: var(--sw-s-2);
      inset-inline-end: var(--sw-s-3);
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      direction: ltr;
      pointer-events: none;
    }
    .cnt.over {
      color: var(--sw-danger-text);
      font-weight: var(--sw-fw-semibold);
    }
    .prev {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .prev .sp {
      flex: 1;
    }
    .engine {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--sw-s-3);
    }
    .engine select {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .result {
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
      line-height: 1.4;
    }
    .result.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .result.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .result.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    @media (max-width: 1100px) {
      .chip,
      .engine select {
        min-block-size: 44px;
      }
    }
  `;y([u({type:Boolean,reflect:!0})],b.prototype,"open",2);y([u({attribute:!1})],b.prototype,"stations",2);y([u({attribute:!1})],b.prototype,"places",2);y([u()],b.prototype,"scope",2);y([u({attribute:!1})],b.prototype,"phrases",2);y([u()],b.prototype,"preselect",2);y([u({attribute:!1})],b.prototype,"tts",2);y([h()],b.prototype,"engines",2);y([h()],b.prototype,"enginesNote",2);y([h()],b.prototype,"engine",2);y([h()],b.prototype,"language",2);y([h()],b.prototype,"message",2);y([h()],b.prototype,"choice",2);y([h()],b.prototype,"sending",2);y([h()],b.prototype,"result",2);y([h()],b.prototype,"locked",2);y([h()],b.prototype,"retryAt",2);y([h()],b.prototype,"more",2);y([h()],b.prototype,"sent",2);b=y([N("wk-announce-dialog")],b);const ls={live:{label:"שידור חי",quality:"איכות",sub:"רגילה",main:"גבוהה",poster:"תמונה אחרונה"},talk:{label:"דיבור",start:"פתח דיבור",starting:"פותח דיבור…",muted:"מיקרופון מושתק",talking:"מיקרופון פתוח",mute:"השתק",unmute:"בטל השתקה",headset:"מומלץ להשתמש באוזניות",end:"סיום דיבור",left:"נותרו {t}",openDrawer:"דיבור",busy:"העמדה בדיבור עם מפעיל אחר",ended:"הדיבור הסתיים",problems:{insecure:"מיקרופון זמין רק בחיבור מאובטח",denied:"המיקרופון חסום בדפדפן",no_mic:"לא נמצא מיקרופון",mic_busy:"המיקרופון תפוס",busy:"העמדה בדיבור עם מפעיל אחר",user_busy:"פתוח אצלך דיבור עם עמדה אחרת",forbidden:"אין הרשאה לדבר עם העמדה",unsupported:"דיבור זמין בלוח הקלאסי",off:"דיבור כבוי",offline:"העמדה אינה מחוברת",unavailable:"דיבור אינו זמין כרגע",expired:"זמן הדיבור הסתיים",upstream:"ערוץ הדיבור נסגר",network:"החיבור נותק",access_lost:"ההרשאה לדיבור הוסרה",failed:"לא ניתן לפתוח דיבור"}}},cs={live:{label:"Live",quality:"Quality",sub:"Standard",main:"High",poster:"Last picture"},talk:{label:"Talk",start:"Start talk",starting:"Opening talk…",muted:"Microphone muted",talking:"Microphone open",mute:"Mute",unmute:"Unmute",headset:"A headset is recommended",end:"End talk",left:"{t} left",openDrawer:"Talk",busy:"Another operator is talking to this station",ended:"Talk ended",problems:{insecure:"The microphone needs a secure connection",denied:"The microphone is blocked in the browser",no_mic:"No microphone found",mic_busy:"The microphone is in use",busy:"Another operator is talking to this station",user_busy:"You already talk to another station",forbidden:"No permission to talk to this station",unsupported:"Talk is available in the classic panel",off:"Talk is off",offline:"The station is offline",unavailable:"Talk is not available right now",expired:"Talk time is over",upstream:"The talk channel closed",network:"The connection dropped",access_lost:"Talk permission was removed",failed:"Talk could not be opened"}}};function Z(){return(document.documentElement.lang||"").toLowerCase().startsWith("en")?cs:ls}function Le(t,e={}){return t.replace(/\{(\w+)\}/g,(s,i)=>i in e?String(e[i]):s)}function Ie(t){const e=Math.max(0,Math.floor(t));return`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`}const ds=132,ve=32635;function hs(t){let e=Math.max(-32768,Math.min(32767,Math.round(t)));const s=e<0?128:0;s&&(e=-e),e>ve&&(e=ve),e+=ds;let i=7;for(let n=16384;(e&n)===0&&i>0;i-=1,n>>=1);const a=e>>i+3&15;return~(s|i<<4|a)&255}const ps=[31,63,127,255,511,1023,2047,4095];function us(t){let e=Math.max(-32768,Math.min(32767,Math.round(t)))>>3,s;e>=0?s=213:(s=85,e=-e-1);let i=0;for(;i<8&&e>ps[i];)i+=1;if(i>=8)return 127^s;let a=i<<4;return a|=i<2?e>>1&15:e>>i&15,a^s}const ws=t=>Math.round(Math.max(-1,Math.min(1,t))*32767);class fs{constructor(e,s=8e3){this.pos=0,this.acc=0,this.count=0,this.ratio=Math.max(1,e/s)}push(e){const s=[];for(let i=0;i<e.length;i++)this.acc+=e[i],this.count+=1,this.pos+=1,this.pos>=this.ratio&&(s.push(this.acc/this.count),this.pos-=this.ratio,this.acc=0,this.count=0);return s}}class gs{constructor(e,s=160){this.codec=e,this.frameBytes=s,this.buf=[]}push(e){const s=this.codec==="pcma"?us:hs;for(let a=0;a<e.length;a++)this.buf.push(s(ws(e[a])));const i=[];for(;this.buf.length>=this.frameBytes;)i.push(Uint8Array.from(this.buf.splice(0,this.frameBytes)));return i}reset(){this.buf=[]}}function ms(t,e){if(e==="pcmu"){const n=~t&255,r=((n&15)<<3)+132<<(n>>4&7);return(n&128?132-r:r-132)/32768}const s=t^85,i=s>>4&7;let a=(s&15)<<4;return a+=i===0?8:264,i>1&&(a<<=i-1),(s&128?a:-a)/32768}class U extends Error{constructor(e){super(e),this.code=e}}const bs={audio:{channelCount:1,echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0},video:!1};async function vs(){if(typeof window>"u"||!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)return"insecure";try{const t=await navigator.permissions?.query({name:"microphone"});return t?t.state:"unknown"}catch{return"unknown"}}function ks(t){const e=t?.name??"";return e==="NotAllowedError"||e==="SecurityError"||e==="PermissionDeniedError"?"denied":e==="NotFoundError"||e==="OverconstrainedError"||e==="DevicesNotFoundError"?"no_mic":e==="NotReadableError"||e==="AbortError"||e==="TrackStartError"?"mic_busy":"failed"}async function ys(t,e,s){if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new U("insecure");let i;try{i=await navigator.mediaDevices.getUserMedia(bs)}catch(v){throw new U(ks(v))}const a=i.getAudioTracks()[0];if(!a)throw i.getTracks().forEach(v=>v.stop()),new U("no_mic");let n;try{n=new AudioContext}catch{throw i.getTracks().forEach(v=>v.stop()),new U("failed")}const r=n.createMediaStreamSource(i),d=n.createScriptProcessor(2048,1,1),c=new fs(n.sampleRate,8e3),p=new gs(t,e);let $=!1,g=!1,z=0;const w=new Set;a.enabled=!1,d.onaudioprocess=v=>{if($)for(const H of p.push(c.push(v.inputBuffer.getChannelData(0))))s(H)},r.connect(d),d.connect(n.destination);const Y=typeof a.getSettings=="function"?a.getSettings().echoCancellation:void 0;return{echoCancellation:typeof Y=="boolean"?Y:null,play(v){if(g||v.byteLength!==800)return;if(n.state==="suspended"&&n.resume(),z>n.currentTime+.3){for(const I of w)I.stop();w.clear(),z=n.currentTime}const H=n.createBuffer(1,v.length,8e3),We=H.getChannelData(0);for(let I=0;I<v.length;I++)We[I]=ms(v[I],t);const C=n.createBufferSource();C.buffer=H,C.connect(n.destination),w.add(C),C.onended=()=>{w.delete(C),C.disconnect()},z=Math.max(n.currentTime,z),C.start(z),z+=H.duration},setActive(v){$=v,a.enabled=v,v||p.reset(),v&&n.state==="suspended"&&n.resume()},stop(){g=!0;for(const v of w)v.stop();w.clear(),$=!1,d.onaudioprocess=null;try{d.disconnect(),r.disconnect()}catch{}i.getTracks().forEach(v=>v.stop()),n.close().catch(()=>{})}}}const $s=3e4,xs=800,ke={intercom_talk_busy:"busy",intercom_talk_user_busy:"user_busy",intercom_talk_unsupported:"unsupported",intercom_talk_off:"off",intercom_station_offline:"offline",intercom_talk_unavailable:"unavailable",intercom_unavailable:"unavailable",intercom_station_not_found:"unavailable",forbidden:"forbidden"};function _s(t){if(t instanceof W){if(ke[t.code])return ke[t.code];if(t.status===403)return"forbidden";if(t.status===0)return"network"}return t instanceof TypeError?"network":"failed"}function De(t){return t===4408?"expired":t===4403?"access_lost":t===4503?"upstream_unavailable":t===4423?"busy":t===4404||t===4409?"refused":t===1e3?"ended":"network"}function zs(t){switch(t){case"ended":case"stopped":return null;case"expired":return"expired";case"access_lost":return"access_lost";case"busy":return"busy";case"upstream_closed":case"upstream_unavailable":return"upstream";case"network":return"network";default:return"failed"}}class Ss{constructor(e,s,i,a){this.stationId=e,this.codec=s,this.frameBytes=i,this.deps=a,this.phase="idle",this.problem=null,this.outcome=null,this.endsAt=0,this.starts=0,this.muted=!1,this.gen=0,this.reply=null,this.ws=null,this.micHandle=null,this.idleTimer=0,this.floorHeld=!1}secondsLeft(){return this.phase==="open"||this.phase==="talking"?Math.max(0,Math.ceil((this.endsAt-this.deps.now())/1e3)):null}get echoCancelled(){return this.micHandle?.echoCancellation??null}async start(){if(this.phase!=="idle")return;this.problem=null,this.muted=!1,this.phase="starting";const e=++this.gen;this.deps.changed();let s;try{s=await this.deps.mic(this.codec,this.frameBytes,n=>this.onFrame(n))}catch(n){e===this.gen&&this.fail(n instanceof U?n.code:"failed");return}if(e!==this.gen){s.stop();return}this.micHandle=s;let i;try{this.starts+=1,i=await this.deps.start(this.stationId,this.deps.requestId())}catch(n){e===this.gen&&this.fail(_s(n));return}if(e!==this.gen){this.deps.stop(i.session).catch(()=>{});return}this.reply=i,this.endsAt=this.deps.now()+i.max_seconds*1e3;let a;try{a=this.deps.socket(i.ws_path)}catch{this.deps.stop(i.session).catch(()=>{}),this.fail("network");return}a.binaryType="arraybuffer",this.ws=a,a.onmessage=n=>{if(e!==this.gen)return;if(n.data instanceof ArrayBuffer){if(n.data.byteLength!==xs)return;(this.phase==="open"||this.phase==="talking")&&(this.micHandle?.play?.(new Uint8Array(n.data)),this.phase==="open"&&this.armIdle());return}if(typeof n.data!="string")return;let r;try{r=JSON.parse(n.data)}catch{return}r.type==="talk/state"&&r.value==="open"&&this.phase==="starting"?(this.phase="open",this.floorHeld=!0,this.deps.floor?.(!0),this.muted?this.armIdle():this.openMic(),this.deps.changed()):r.type==="talk/closed"&&this.finish(String(r.value??"ended"))},a.onclose=n=>{e===this.gen&&this.finish(De(n.code))},a.onerror=()=>{}}setMuted(e){this.phase!=="idle"&&(this.muted=e,e&&this.phase==="talking"?this.muteMic():!e&&this.phase==="open"?this.openMic():this.deps.changed())}toggleMute(){this.setMuted(!this.muted)}end(){if(this.phase==="idle")return;const e=this.ws,s=this.reply;e&&e.readyState===1?e.send(JSON.stringify({type:"talk/stop"})):s&&this.deps.stop(s.session).catch(()=>{}),this.finish("ended")}dispose(){this.end()}openMic(){const e=this.ws;!e||e.readyState!==1||!this.micHandle||(this.deps.cancel(this.idleTimer),this.micHandle.setActive(!0),e.send(JSON.stringify({type:"talk/ptt",value:"down"})),this.phase="talking",this.deps.changed())}muteMic(){this.micHandle?.setActive(!1);const e=this.ws;e&&e.readyState===1&&e.send(JSON.stringify({type:"talk/ptt",value:"up"})),this.phase="open",this.armIdle(),this.deps.changed()}armIdle(){this.deps.cancel(this.idleTimer);const e=this.gen;this.idleTimer=this.deps.after(()=>{e===this.gen&&this.phase==="open"&&this.end()},$s)}onFrame(e){const s=this.ws;this.phase==="talking"&&s&&s.readyState===1&&s.send(e)}teardown(){this.gen+=1,this.deps.cancel(this.idleTimer),this.micHandle?.stop(),this.micHandle=null;const e=this.ws;if(this.ws=null,e){e.onmessage=null,e.onclose=null,e.onerror=null;try{e.close()}catch{}}this.floorHeld&&this.deps.floor?.(!1),this.floorHeld=!1,this.reply=null,this.endsAt=0}fail(e){this.teardown(),this.phase="idle",this.problem=e,this.outcome=null,this.deps.changed()}finish(e){this.teardown(),this.phase="idle",this.outcome=e,this.problem=zs(e),this.deps.changed()}}var Ts=Object.defineProperty,Ms=Object.getOwnPropertyDescriptor,L=(t,e,s,i)=>{for(var a=i>1?void 0:i?Ms(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(a=(i?r(e,s,a):r(a))||a);return i&&a&&Ts(e,s,a),a};let O=class extends R{constructor(){super(...arguments),this.stationId="",this.talk=null,this.live=!0,this.deps=null,this.tick=0,this.mic="unknown",this.session=null,this.timer=0,this.activate=()=>{const t=this.ensure();t.phase==="idle"?t.start():(t.phase==="open"||t.phase==="talking")&&t.toggleMute()}}connectedCallback(){super.connectedCallback(),vs().then(t=>this.mic=t)}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,window.clearInterval(this.timer)}updated(t){t.has("stationId")&&t.get("stationId")!==void 0&&(this.session?.dispose(),this.session=null)}ensure(){if(this.session&&this.session.stationId===this.stationId)return this.session;const t=this.talk,e=Math.max(80,Math.round((t?.sample_rate??8e3)*(t?.frame_ms??20)/1e3)),s={start:(i,a)=>gt(i,a),stop:i=>ft(i),socket:i=>new WebSocket(wt(i)),mic:(i,a,n)=>ys(i,a,n),requestId:()=>ut(),now:()=>Date.now(),after:(i,a)=>window.setTimeout(i,a),cancel:i=>window.clearTimeout(i),changed:()=>this.onChange(),floor:i=>this.dispatchEvent(new CustomEvent("talk-floor",{detail:{held:i,stationId:this.stationId},bubbles:!0,composed:!0}))};return this.session=new Ss(this.stationId,t?.codec==="pcma"?"pcma":"pcmu",e,{...s,...this.deps??{}}),this.session}onChange(){this.tick+=1;const t=this.session;window.clearInterval(this.timer),t&&(t.phase==="open"||t.phase==="talking")&&(this.timer=window.setInterval(()=>this.tick+=1,1e3)),this.dispatchEvent(new CustomEvent("talk-state",{detail:{phase:t?.phase??"idle",problem:t?.problem??null,outcome:t?.outcome??null},bubbles:!0,composed:!0}))}blocked(){return this.mic==="insecure"?"insecure":this.mic==="denied"?"denied":null}end(){this.session?.end()}render(){const t=Z().talk,e=this.session,s=e?.phase??"idle",i=!!this.talk?.busy&&s==="idle",a=this.blocked(),n=!this.live||s==="idle"&&(i||!!a),r=e?.secondsLeft()??null;this.tick;const d=s==="open"||s==="talking",c=s==="talking"?t.talking:s==="starting"?t.starting:s==="open"?t.muted:t.start,p=s==="talking"?t.mute:s==="open"?t.unmute:t.start,$=e?.problem??(s==="idle"?a:null),g=$?{tone:$==="busy"||$==="expired"?"warn":"error",text:t.problems[$]}:i?{tone:"warn",text:t.busy}:s==="idle"&&e?.outcome?{tone:"",text:t.ended}:d&&e?.echoCancelled===!1?{tone:"warn",text:t.headset}:null;return o`<button
        type="button"
        class="ptt"
        data-wk-ptt
        data-phase=${s}
        data-muted=${d?String(s==="open"):l}
        aria-pressed=${d?String(s==="open"):l}
        aria-label=${p}
        ?disabled=${n}
        @click=${this.activate}
      >
        ${s==="talking"?o`<i class="dot" aria-hidden="true"></i>`:o`<sw-icon name=${s==="open"?"micOff":"mic"} size=${18}></sw-icon>`}<span>${c}</span>
      </button>
      ${g||s==="open"||s==="talking"?o`<div class="row">
            <span class="line" role="status" aria-live="polite" data-wk-talk-line data-tone=${g?.tone??""} data-problem=${$??""}
              >${g?g.text:r!==null?o`<span class="left" data-wk-talk-left>${Le(t.left,{t:Ie(r)})}</span>`:l}</span
            >
            ${s==="open"||s==="talking"?o`<wk-action-button tone="danger" icon="hangup" data-wk-talk-end @click=${()=>this.end()}>${t.end}</wk-action-button>`:l}
          </div>`:l}`}};O.styles=P`
    :host {
      display: grid;
      gap: var(--sw-s-2);
      min-inline-size: 0;
    }
    .ptt {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      inline-size: 100%;
      min-block-size: max(56px, var(--sw-ctl-h-lg, 0px)); /* a big press target on every skin and width */
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      touch-action: none;
      box-shadow: var(--sw-shadow-1);
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease);
    }
    .ptt[data-phase='idle']:hover:not(:disabled) {
      background: var(--sw-hover-wash, var(--sw-surface-2));
    }
    .ptt:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .ptt[data-phase='open'] {
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      background: var(--sw-accent-soft);
    }
    .ptt[data-phase='talking'] {
      border-color: var(--sw-danger);
      background: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .ptt[data-phase='starting'] {
      opacity: 0.85;
      cursor: progress;
    }
    .ptt:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    .ptt span {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dot {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: currentColor;
      flex: none;
    }
    .ptt[data-phase='talking'] .dot {
      animation: pulse 1s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.35;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .ptt[data-phase='talking'] .dot {
        animation: none;
      }
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-inline-size: 0;
      min-block-size: var(--sw-touch-desktop, 44px);
    }
    .line {
      flex: 1;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .line[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .line[data-tone='error'] {
      color: var(--sw-danger-text);
    }
    .left {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
  `;L([u()],O.prototype,"stationId",2);L([u({attribute:!1})],O.prototype,"talk",2);L([u({type:Boolean})],O.prototype,"live",2);L([u({attribute:!1})],O.prototype,"deps",2);L([h()],O.prototype,"tick",2);L([h()],O.prototype,"mic",2);O=L([N("wk-talk-button")],O);function Os(t){const e=~t&255,s=e&128,i=e>>4&7,n=((e&15)<<3)+132<<i;return s?132-n:n-132}function As(t){const e=t^85,s=(e&112)>>4;let i=(e&15)<<4;return s===0?i+=8:s===1?i+=264:i=i+264<<s-1,(e&128)!==0?i:-i}function Cs(t,e="pcmu"){const s=new Float32Array(t.length),i=e==="pcma"?As:Os;for(let a=0;a<t.length;a+=1)s[a]=i(t[a]&255)/32768;return s}function Es(t){if(!t.length)return 0;let e=0;for(let s=0;s<t.length;s+=1)e+=t[s]*t[s];return Math.min(1,Math.sqrt(e/t.length)*4)}function Ls(t,e){if(e<=0)return t;const s=t*.5**(e/150);return s<.01?0:s}const ye={intercom_listen_busy:"busy",intercom_listen_user_busy:"user_busy",intercom_listen_unsupported:"unsupported",intercom_listen_no_listen:"no_listen",intercom_listen_off:"off",intercom_station_offline:"offline",intercom_listen_unavailable:"unavailable",intercom_unavailable:"unavailable",intercom_station_not_found:"unavailable",forbidden:"forbidden"};function Is(t){if(t instanceof W){if(ye[t.code])return ye[t.code];if(t.status===403)return"forbidden";if(t.status===0)return"network"}return t instanceof TypeError?"network":"failed"}function Ds(t){switch(t){case"ended":case"stopped":return null;case"expired":return"expired";case"access_lost":return"access_lost";case"upstream_closed":case"upstream_unavailable":return"upstream";case"network":return"network";default:return"failed"}}class Ps{constructor(e,s){this.stationId=e,this.deps=s,this.phase="idle",this.problem=null,this.outcome=null,this.muted=!1,this.endsAt=0,this.starts=0,this.frames=0,this.level=0,this.levelAt=0,this.gen=0,this.reply=null,this.ws=null,this.sink=null,this.codec="pcmu",this.rate=8e3}secondsLeft(){return this.phase==="listening"?Math.max(0,Math.ceil((this.endsAt-this.deps.now())/1e3)):null}levelNow(){return this.phase==="listening"?Ls(this.level,this.deps.now()-this.levelAt):0}async start(){if(this.phase!=="idle")return;this.problem=null;const e=this.deps.sink();if(!e){this.problem="no_audio",this.deps.changed();return}this.sink=e,e.setMuted(this.muted),this.phase="starting";const s=++this.gen;this.deps.changed();let i;try{this.starts+=1,i=await this.deps.start(this.stationId,this.deps.requestId())}catch(n){s===this.gen&&this.fail(Is(n));return}if(s!==this.gen){this.deps.stop(i.session).catch(()=>{});return}this.reply=i,this.codec=i.codec,this.rate=i.sample_rate,this.endsAt=this.deps.now()+i.max_seconds*1e3;let a;try{a=this.deps.socket(i.ws_path)}catch{this.deps.stop(i.session).catch(()=>{}),this.fail("network");return}a.binaryType="arraybuffer",this.ws=a,a.onmessage=n=>{if(s!==this.gen)return;if(typeof n.data!="string"){this.phase==="listening"&&this.onFrame(n.data);return}let r;try{r=JSON.parse(n.data)}catch{return}r.type==="listen/state"&&r.value==="open"&&this.phase==="starting"?(this.phase="listening",this.levelAt=this.deps.now(),this.deps.changed()):r.type==="listen/closed"&&this.finish(String(r.value??"ended"))},a.onclose=n=>{s===this.gen&&this.finish(De(n.code))},a.onerror=()=>{}}setMuted(e){this.muted=e,this.sink?.setMuted(e),this.deps.changed()}stop(){if(this.phase==="idle")return;const e=this.ws,s=this.reply;e&&e.readyState===1?e.send(JSON.stringify({type:"listen/stop"})):s&&this.deps.stop(s.session).catch(()=>{}),this.finish("ended")}dispose(){this.stop()}onFrame(e){const s=Cs(new Uint8Array(e),this.codec);this.frames+=1,this.level=Es(s),this.levelAt=this.deps.now(),this.sink?.play(s,this.rate)}teardown(){this.gen+=1;const e=this.ws;if(this.ws=null,e){e.onmessage=null,e.onclose=null,e.onerror=null;try{e.close()}catch{}}this.sink?.close(),this.sink=null,this.reply=null,this.endsAt=0,this.level=0}fail(e){this.teardown(),this.phase="idle",this.problem=e,this.outcome=null,this.deps.changed()}finish(e){this.teardown(),this.phase="idle",this.outcome=e,this.problem=Ds(e),this.deps.changed()}}const Rs=.06,Ns=.3;function Bs(t,e){const s=Math.max(e,t+Rs);return s-t>Ns?null:s}function qs(){const t=globalThis.AudioContext??globalThis.webkitAudioContext;if(!t)return null;let e;try{e=new t}catch{return null}e.resume().catch(()=>{});const s=e.createGain();s.connect(e.destination);let i=0;return{play(a,n){const r=Bs(e.currentTime,i);if(r===null)return;const d=e.createBuffer(1,a.length,n);d.copyToChannel(a,0);const c=e.createBufferSource();c.buffer=d,c.connect(s),c.start(r),i=r+d.duration},setMuted(a){s.gain.value=a?0:1},close(){e.close().catch(()=>{})}}}var Hs=Object.defineProperty,Us=Object.getOwnPropertyDescriptor,q=(t,e,s,i)=>{for(var a=i>1?void 0:i?Us(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(a=(i?r(e,s,a):r(a))||a);return i&&a&&Hs(e,s,a),a};let A=class extends R{constructor(){super(...arguments),this.stationId="",this.live=!0,this.deps=null,this.capability=null,this.tick=0,this.session=null,this.timer=0,this.loadedFor=""}realDeps(){const t=this.deps??{};return{start:t.start??((e,s)=>kt(e,s)),stop:t.stop??(e=>vt(e)),socket:t.socket??(e=>new WebSocket(bt(e))),sink:t.sink??(()=>qs()),requestId:t.requestId??(()=>mt()),now:t.now??(()=>Date.now()),changed:()=>{this.tick+=1,this.syncTimer()}}}ensureSession(){return(!this.session||this.session.stationId!==this.stationId)&&(this.session?.dispose(),this.session=new Ps(this.stationId,this.realDeps())),this.session}syncTimer(){const t=this.session?.phase==="listening";t&&!this.timer?this.timer=window.setInterval(()=>this.tick+=1,150):!t&&this.timer&&(window.clearInterval(this.timer),this.timer=0)}willUpdate(t){(t.has("stationId")||t.has("live"))&&this.stationId&&this.live&&!this.deps?.start&&this.loadedFor!==this.stationId&&!this.capability&&(this.loadedFor=this.stationId,yt(this.stationId).then(e=>{this.loadedFor===this.stationId&&(this.capability=e)}).catch(()=>{}))}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,this.timer&&window.clearInterval(this.timer),this.timer=0}get offered(){const t=this.session,e=t!==null&&t.phase!=="idle";return this.live&&(e||!!t?.problem||!!this.capability?.available)}updated(t){super.updated(t),this.toggleAttribute("hidden",!this.offered)}toggle(){const t=this.ensureSession();t.phase==="idle"?t.start():t.stop()}render(){const t=this.session;if(!this.offered)return l;const e=$t(),s=t?.phase??"idle",i=t?.secondsLeft(),a=Math.round((t?.levelNow()??0)*100),n=s==="starting"?e.starting:s==="listening"?`${e.listening}${i!=null?` · ${Le(e.left,{t:Ie(i)})}`:""}`:"";return o`
      <div class="row" data-wk-listen>
        <button class="main" type="button" data-wk-listen-toggle aria-pressed=${String(s!=="idle")} @click=${()=>this.toggle()}>
          <sw-icon name=${s==="idle"?"volume":"hangup"} size=${18}></sw-icon>
          ${s==="idle"?e.start:e.stop}
        </button>
        ${s==="listening"?o`<button type="button" data-wk-listen-mute aria-pressed=${String(t.muted)} aria-label=${t.muted?e.unmute:e.mute} @click=${()=>t.setMuted(!t.muted)}>
              ${t.muted?e.unmute:e.mute}
            </button>`:l}
      </div>
      ${s==="listening"?o`<div class="meter ${t.muted?"muted":""}" role="meter" aria-label=${e.level} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${a} data-wk-listen-level>
            <i style=${`inline-size:${a}%`}></i>
          </div>`:l}
      ${n?o`<div class="msg" data-wk-listen-state>${n}${t?.muted?` · ${e.muted}`:""}</div>`:l}
      ${s==="idle"&&t?.problem?o`<div class="msg problem" data-wk-listen-problem role="status">${e.problems[t.problem]}</div>`:l}
      ${s==="idle"&&!t?.problem&&t?.outcome?o`<div class="msg" data-wk-listen-ended>${e.ended}</div>`:l}
    `}};A.styles=P`
    :host {
      display: grid;
      gap: var(--sw-s-2);
      min-inline-size: 0;
    }
    /* nothing offered: no box at all, so the drawer's grid keeps no empty row and no gap for it */
    :host([hidden]) {
      display: none;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      min-block-size: max(44px, var(--sw-ctl-h, 0px));
      padding-inline: var(--sw-s-4);
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
    }
    button.main {
      flex: 1;
    }
    button[aria-pressed='true'] {
      border-color: var(--sw-accent);
    }
    button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .meter {
      block-size: 8px;
      border-radius: 4px;
      background: var(--sw-surface-sunken, var(--sw-border));
      overflow: hidden;
      direction: ltr;
    }
    .meter > i {
      display: block;
      block-size: 100%;
      inline-size: 0;
      background: var(--sw-accent);
    }
    .meter.muted > i {
      opacity: 0.35;
    }
    .msg {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-muted);
    }
    .msg.problem {
      color: var(--sw-warn, var(--sw-text));
    }
  `;q([u()],A.prototype,"stationId",2);q([u({type:Boolean})],A.prototype,"live",2);q([u({attribute:!1})],A.prototype,"deps",2);q([u({attribute:!1})],A.prototype,"capability",2);q([h()],A.prototype,"tick",2);A=q([N("wk-listen-button")],A);var js=Object.defineProperty,Fs=Object.getOwnPropertyDescriptor,M=(t,e,s,i)=>{for(var a=i>1?void 0:i?Fs(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(a=(i?r(e,s,a):r(a))||a);return i&&a&&js(e,s,a),a};let S=class extends R{constructor(){super(...arguments),this.stationId="",this.stationName="",this.media=null,this.poster="",this.live=!0,this.classicHref="",this.classicLabel="",this.profile=null,this.mutedBefore=null,this.onFloor=t=>{const e=t.detail.held,s=this.player;!s||this.media?.talk?.duplex==="full"||(e?(this.mutedBefore=s.muted,s.muted=!0):this.mutedBefore!==null&&(s.muted=this.mutedBefore,this.mutedBefore=null))}}willUpdate(t){if(t.has("media")||t.has("stationId")){const e=this.media?.video?.profiles.map(s=>s.id)??[];(!this.profile||!e.includes(this.profile)||t.has("stationId"))&&(this.profile=xt(this.media?.video??null))}}render(){const t=this.media,e=t?.video,s=Z(),i=e?.profiles.find(r=>r.id===this.profile),a=i?e?.paths[i.id]:void 0,n=t?.talk;return o`
      ${a?o`<div class="frame" data-wk-live-frame data-profile=${i.id}>
            <sw-live-player .livePath=${a} .profile=${i.id} .mode=${_t(i)} .poster=${this.poster} data-wk-live-player aria-label=${`${s.live.label} · ${this.stationName}`}></sw-live-player>
          </div>`:this.poster?o`<div class="frame" data-wk-live-frame data-profile=""><img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" /></div>`:l}
      ${e&&e.profiles.length>1&&a?o`<div class="bar">
            <span class="lbl" id="q">${s.live.quality}</span>
            <div class="seg" role="group" aria-labelledby="q" data-wk-quality>
              ${e.profiles.map(r=>o`<button type="button" data-profile=${r.id} aria-pressed=${String(r.id===this.profile)} @click=${()=>this.profile=r.id}>${r.id==="main"?s.live.main:s.live.sub}</button>`)}
            </div>
          </div>`:l}
      ${n?.available?o`<wk-talk-button .stationId=${this.stationId} .talk=${n} .live=${this.live} data-wk-talk="native" @talk-floor=${this.onFloor}></wk-talk-button>`:this.classicHref?o`<wk-action-button tone="dashed" icon="window" block size="lg" href=${this.classicHref} data-wk-talk="classic">${this.classicLabel}</wk-action-button>`:l}
      ${t?.state==="ready"?o`<wk-listen-button .stationId=${this.stationId} .live=${this.live}></wk-listen-button>`:l}
    `}};S.styles=P`
    :host {
      display: grid;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .frame {
      position: relative;
      direction: ltr;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-media, var(--sw-r-md));
      overflow: hidden;
      background: var(--sw-video-bg);
    }
    sw-live-player,
    .frame img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .frame img {
      object-fit: cover;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .seg {
      display: inline-flex;
      align-items: stretch;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface);
    }
    .seg button {
      min-block-size: var(--sw-touch-desktop, 44px);
      min-inline-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3);
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: calc(-1 * var(--sw-focus-w));
    }
    .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    @media (max-width: 1100px) {
      .seg button {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;M([u()],S.prototype,"stationId",2);M([u()],S.prototype,"stationName",2);M([u({attribute:!1})],S.prototype,"media",2);M([u()],S.prototype,"poster",2);M([u({type:Boolean})],S.prototype,"live",2);M([u()],S.prototype,"classicHref",2);M([u()],S.prototype,"classicLabel",2);M([h()],S.prototype,"profile",2);M([Ke("sw-live-player")],S.prototype,"player",2);S=M([N("wk-station-live")],S);const Ws=45e3,Ks=12e4;function Js(t){const e=t instanceof W?Number(t.body?.details?.retry_after_s):NaN;return Number.isFinite(e)&&e>=0?Math.ceil(e*1e3):Tt}function $e(t,e=x()){return rt(t)!=="unknown"?{tone:"err",text:oe(t),unknown:!1}:{tone:"warn",text:e.call.unknown,unknown:!0}}function Ys(t,e=x()){const s={answer:e.call.answer,reject:e.call.reject,hangUp:e.call.hangUp},i=k(e.call.sent,{label:s[t.command]??t.command,ack:t.acknowledged===!0?e.call.ack:e.call.noAck});if(t.observation==="unavailable"||!t.observed_state)return`${i} · ${e.call.stateUnread}`;const a=F(t.observed_state,e);return`${i} · ${k(t.observation==="unchanged"?e.call.stateUnchanged:e.call.state,{state:a})}`}const Vs=["started","generating","speaking","completed","closed"],xe=t=>Vs.indexOf(t.state);class Q{constructor(e){this.deps=e,this.confirm=null,this.releasing=new Set,this.held={},this.results={},this.callBusy=new Set,this.armed=null,this.tts={},this.armTimer=0,this.holdTimer=0}dispose(){this.deps.cancel(this.armTimer),this.deps.cancel(this.holdTimer)}static key(e,s){return`${e}/${s}`}isHeld(e){return(this.held[e]??0)>this.deps.now()}setResult(e,s,i){this.results={...this.results,[e]:{tone:s,text:i,at:this.deps.now()}},this.deps.changed()}prune(){const e=this.deps.now(),s=Object.entries(this.results).filter(([,i])=>e-i.at<(i.tone==="warn"?Ks:Ws));s.length!==Object.keys(this.results).length&&(this.results=Object.fromEntries(s),this.deps.changed())}clearResult(e){if(!(e in this.results))return;const s={...this.results};delete s[e],this.results=s,this.deps.changed()}askRelease(e,s){const i=Q.key(e,s);return!this.deps.live()||this.releasing.has(i)||this.isHeld(i)?!1:(this.confirm={stationId:e,lock:s},this.deps.changed(),!0)}cancelRelease(){this.confirm&&(this.confirm=null,this.deps.changed())}async confirmRelease(){const e=this.confirm;if(!e)return;const s=Q.key(e.stationId,e.lock);if(!(!this.deps.live()||this.releasing.has(s)||this.isHeld(s))){this.releasing=new Set([...this.releasing,s]),this.deps.changed();try{await this.deps.release(e.stationId,e.lock),this.setResult(e.stationId,"ok",k(x().door.sentAt,{at:this.deps.stamp()}))}catch(i){const a=$e(i);this.setResult(e.stationId,a.tone,a.unknown?x().door.unknown:a.text),(a.unknown||i instanceof W&&i.code==="intercom_release_in_progress")&&this.hold(s,Js(i))}finally{const i=new Set(this.releasing);i.delete(s),this.releasing=i,this.confirm===e&&(this.confirm=null),this.deps.changed()}}}hold(e,s){const i=this.deps.now()+s;this.held={...this.held,[e]:Math.max(this.held[e]??0,i)},this.deps.cancel(this.holdTimer);const a=Object.values(this.held).filter(n=>n>this.deps.now());a.length&&(this.holdTimer=this.deps.after(()=>{this.held={...this.held},this.deps.changed()},Math.min(...a)-this.deps.now()+50)),this.deps.changed()}tapCall(e,s,i=1){const a=this.deps.station(e);if(!a||this.callBusy.has(e)||!this.deps.live()||i>1)return;const n=this.armed;if(n&&n.id===e&&n.command===s&&n.callState===a.call_state){if(this.deps.tick()-n.at<zt)return;this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed(),this.sendCall(e,s);return}this.deps.cancel(this.armTimer),this.armed={id:e,command:s,at:this.deps.tick(),callState:a.call_state},this.armTimer=this.deps.after(()=>{this.armed=null,this.deps.changed()},St),this.deps.changed()}dropStaleArm(){const e=this.armed;if(!e)return;const s=this.deps.station(e.id);(!this.deps.live()||!s||!s.online||s.call_state!==e.callState)&&(this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed())}async sendCall(e,s){this.callBusy=new Set([...this.callBusy,e]),this.deps.changed();try{const i=await this.deps.signal(e,s);i.call&&this.setResult(e,i.call.acknowledged===!0?"ok":"warn",Ys(i.call))}catch(i){const a=$e(i);this.setResult(e,a.tone,a.text)}finally{const i=new Set(this.callBusy);i.delete(e),this.callBusy=i,this.deps.changed(),this.deps.refetch()}}noteTts(e){const s=this.tts[e.station_id];s&&s.at>=e.at&&xe(s)>xe(e)||(this.tts={...this.tts,[e.station_id]:e},this.deps.changed())}}const Gs=P`
  :host {
    display: block;
    --wk-hit: var(--sw-touch-desktop, 44px);
  }
  @media (max-width: 1100px) {
    :host {
      --wk-hit: 44px;
    }
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
  }
  .search {
    flex: 1 1 220px;
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-inline-size: 0;
    max-inline-size: 420px;
    padding-inline: var(--sw-s-3);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text-3);
  }
  .search:focus-within {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 3px var(--sw-accent-soft);
  }
  .search input {
    flex: 1;
    min-inline-size: 0;
    min-block-size: var(--wk-hit);
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-base);
  }
  .lbl {
    min-inline-size: 0;
  }
  .layout {
    display: grid;
    grid-template-columns: var(--wk-tree, 236px) minmax(0, 1fr);
    gap: var(--sw-s-4);
    align-items: start;
  }
  .layout.no-tree {
    grid-template-columns: minmax(0, 1fr);
  }
  .treecol {
    position: sticky;
    inset-block-start: var(--sw-s-3);
  }
  .main {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    min-inline-size: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2);
  }
  .chip {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding-inline: var(--sw-s-4);
    border: 1px solid transparent;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    white-space: nowrap;
    cursor: pointer;
    /* R5-SECURITY: a raised key (shadow 1), sinks on pointer-down; the active one a filled accent field */
    box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
  }
  @media (hover: hover) and (pointer: fine) {
    .chip:hover {
      background: var(--sw-surface-2);
    }
  }
  .chip:active,
  .rowmain:active,
  .open:active ~ .scrim {
    transform: scale(var(--sw-press-scale));
  }
  .chip[aria-pressed='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
    font-weight: var(--sw-fw-bold);
  }
  .chip.places {
    display: none;
  }
  .chip:focus-visible,
  .rowmain:focus-visible,
  .open:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .strip {
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-md);
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 40%, transparent);
  }
  /* R5-SECURITY: the badges of the cards, rows and the drawer are fields - 12.5/700 on 22 px */
  sw-badge {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-bold);
    line-height: 18px;
    padding-block: 2px;
  }
  .strip .dot {
    flex: none;
    inline-size: 9px;
    block-size: 9px;
    border-radius: 50%;
    background: var(--sw-warning);
    animation: wk-blink 1.2s ease-in-out infinite;
  }
  .strip .sp {
    flex: 1;
  }

  /* ---- cards ---- */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
    gap: var(--sw-s-4);
  }
  .card {
    min-inline-size: 0;
  }
  /* the ring is the ONLY layer of the shadow: a skin may set --sw-shadow-N to "none" (Tesla does), and "none" inside a shadow list
     makes the whole declaration invalid - the ring would vanish exactly where the screen needs it */
  .card.ringing {
    box-shadow: 0 0 0 2px var(--sw-warning);
    animation: wk-ring 1.6s ease-in-out infinite;
  }
  .media {
    position: relative;
    aspect-ratio: 16 / 8;
    overflow: hidden;
    background: var(--sw-surface-3);
  }
  .media img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .media.off img {
    filter: grayscale(1) brightness(0.7);
  }
  .none {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--sw-s-1);
    padding-block-end: 36px;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .open {
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .scrim {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 2;
    display: flex;
    align-items: baseline;
    gap: var(--sw-s-3);
    padding: 26px 14px 10px;
    background: linear-gradient(180deg, transparent, var(--sw-video-scrim-strong));
    color: var(--sw-on-video);
    pointer-events: none;
  }
  .scrim .name {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* R5-SECURITY: the station's name is the card's display line - 20/800 */
    font-size: var(--sw-fs-2xl);
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .scrim .place {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--sw-fs-xs);
    color: var(--sw-on-video-2);
  }
  .stamp {
    position: absolute;
    z-index: 2;
    inset-block-start: 10px;
    inset-inline-start: 10px;
    padding: 2px 7px;
    border-radius: var(--sw-r-2xs);
    background: var(--sw-video-scrim);
    color: var(--sw-on-video);
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-2xs);
    pointer-events: none;
  }
  .stamp bdi {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .callbadge {
    position: absolute;
    z-index: 2;
    inset-block-start: 10px;
    inset-inline-end: 10px;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: var(--sw-s-1) var(--sw-s-3);
    border: 2px solid var(--sw-warning);
    border-radius: var(--sw-r-pill);
    background: var(--sw-on-image-bg);
    color: var(--sw-text);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    box-shadow: var(--sw-shadow-2);
    pointer-events: none;
  }
  .callbadge.in_call,
  .callbadge.ending {
    border-color: var(--sw-accent);
  }
  .callbadge sw-icon,
  .callbadge .ic {
    display: inline-flex;
    color: var(--sw-warning);
  }
  .callbadge.in_call sw-icon,
  .callbadge.in_call .ic,
  .callbadge.ending sw-icon,
  .callbadge.ending .ic {
    color: var(--sw-accent);
  }
  .cb {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    padding: var(--sw-s-3) var(--sw-s-4);
  }
  .hd {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .callrow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding: var(--sw-s-1) var(--sw-s-3);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-2);
  }
  .callrow.ringing {
    background: var(--sw-warning-soft);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 40%, transparent);
  }
  .callrow.in_call,
  .callrow.ending {
    background: var(--sw-accent-soft);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-accent) 35%, transparent);
  }
  .callrow.big {
    padding-block: var(--sw-s-3);
  }
  .cs {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-inline-size: 0;
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    white-space: nowrap;
  }
  .callrow.big .cs {
    font-size: var(--sw-fs-xl);
    font-weight: 800;
  }
  /* the controls of a call row move together: when the row is narrow they take their own line, side by side */
  .ctl {
    flex: 1 1 auto;
    display: flex;
    justify-content: flex-end;
    gap: var(--sw-s-2);
  }
  .ctl > * {
    flex: 1 1 0;
  }
  .callrow.ringing .cs {
    color: var(--sw-warning-text);
  }
  .callrow.in_call .cs,
  .callrow.ending .cs {
    color: var(--sw-accent-text);
  }
  .cs.muted {
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
  .dur {
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-3);
    direction: ltr;
  }
  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
  }
  .acts .grow {
    flex: 1 1 auto;
  }
  .result {
    padding: var(--sw-s-2) var(--sw-s-3);
    border-radius: var(--sw-r-sm);
    font-size: var(--sw-fs-sm);
    line-height: 1.4;
  }
  .result.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .result.warn {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .result.err {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  /* in the drawer the outcome sticks to the top of the scrolling body, over a solid backing (the soft tones are translucent) */
  .result.sticky {
    position: sticky;
    inset-block-start: 0;
    z-index: 3;
    background-color: var(--sw-surface-solid);
    box-shadow: var(--sw-shadow-1);
  }
  .result.sticky.ok {
    background-image: linear-gradient(var(--sw-success-soft), var(--sw-success-soft));
  }
  .result.sticky.warn {
    background-image: linear-gradient(var(--sw-warning-soft), var(--sw-warning-soft));
  }
  .result.sticky.err {
    background-image: linear-gradient(var(--sw-danger-soft), var(--sw-danger-soft));
  }
  .tech {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    padding-block-start: var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  .tech .sp {
    flex: 1;
  }
  code,
  .ltr {
    font-family: var(--sw-font-mono);
    direction: ltr;
    unicode-bidi: isolate;
  }

  /* ---- list rows ---- */
  .rows {
    display: flex;
    flex-direction: column;
  }
  /* a row is two groups: the station (opens the drawer) and its side - call pill, "seen", actions, chevron. When the row is
     narrow the side takes its own line below the station, whole, instead of squeezing the station's name away. */
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sw-s-2) var(--sw-s-3);
    padding: var(--sw-s-2) var(--sw-s-3);
    border-block-start: 1px solid var(--sw-border);
  }
  .row:first-child {
    border-block-start: 0;
  }
  .rowside {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2) var(--sw-s-3);
    margin-inline-start: auto;
  }
  .rowmain {
    flex: 1 1 220px;
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    min-inline-size: min(220px, 100%);
    min-block-size: var(--wk-hit);
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: none;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .thumb {
    flex: none;
    inline-size: 64px;
    block-size: 40px;
    border-radius: var(--sw-r-xs);
    overflow: hidden;
    background: var(--sw-surface-3);
    display: grid;
    place-items: center;
    color: var(--sw-text-3);
  }
  .thumb img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    display: block;
  }
  .thumb.off img {
    filter: grayscale(1) brightness(0.7);
  }
  .rowtext {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  .rowtext .t {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-md);
    color: var(--sw-heading, var(--sw-text));
  }
  .row[data-status='ringing'] {
    background: var(--sw-warning-soft);
  }
  .rowtext .t b {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rowtext .s {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sdot {
    flex: none;
    inline-size: 9px;
    block-size: 9px;
    border-radius: 50%;
    background: var(--sw-live);
  }
  .sdot.off {
    background: var(--sw-offline);
  }
  .seen {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
    white-space: nowrap;
  }
  .rowacts {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
  }
  .pillcall {
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    padding: 2px var(--sw-s-3);
    border-radius: var(--sw-r-pill);
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    white-space: nowrap;
  }
  .pillcall.in_call,
  .pillcall.ending {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }

  /* ---- the drawer ---- */
  .live {
    position: relative;
    flex: none;
    aspect-ratio: 16 / 9;
    border-radius: var(--sw-r-md);
    overflow: hidden;
    background: var(--sw-surface-3);
  }
  .live img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    filter: saturate(0.7) brightness(0.85);
  }
  .live.off img {
    filter: grayscale(1) brightness(0.6);
  }
  .live .ov {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--sw-s-3);
    background: linear-gradient(180deg, transparent, var(--sw-video-scrim));
    color: var(--sw-on-video);
    text-align: center;
  }
  .live .ov .t {
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-2);
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-semibold);
  }
  .live .none {
    padding-block-end: 0;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sw-s-3);
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  /* CR-036 S12 / WXSCH: the quiet ways on from a station - its entry log, the schedules of its doors */
  .evlink {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: var(--sw-s-2);
  }
  .dsec {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    flex: none;
    padding: var(--sw-s-4);
    border: 1px solid transparent;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface-2);
  }
  /* R5-SECURITY: the drawer's sections are wells; their headings 14.5/700 in the heading ink; the door name 15/700 */
  .dsec h4 {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    margin: 0;
    color: var(--sw-heading, var(--sw-text));
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
  }
  .doorrow {
    display: flex;
    align-items: center;
    gap: var(--sw-s-3);
    min-block-size: var(--wk-hit);
  }
  .doorrow .dn {
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-lg);
    color: var(--sw-heading, var(--sw-text));
  }
  .doorrow .ds {
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: var(--sw-s-1);
    min-inline-size: 0;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  .kv {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sw-s-2) var(--sw-s-4);
    margin: 0;
    font-size: var(--sw-fs-sm);
  }
  .kv dt {
    color: var(--sw-text-3);
  }
  .kv dd {
    margin: 0;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text);
  }
  .toggle {
    display: flex;
    align-items: center;
    gap: var(--sw-s-2);
    min-block-size: var(--wk-hit);
    padding-inline: var(--sw-s-1);
    border: 0;
    border-radius: var(--sw-r-sm);
    background: none;
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    text-align: start;
    cursor: pointer;
  }
  .toggle sw-icon {
    transition: transform var(--sw-t-fast) var(--sw-ease);
  }
  .toggle[aria-expanded='true'] sw-icon {
    transform: rotate(180deg);
  }
  .toggle:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  .prog {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-1);
    padding-block: var(--sw-s-2);
    border-block-start: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm);
  }
  .prog:first-of-type {
    border-block-start: 0;
  }
  .prog .ph {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--sw-s-2);
    font-weight: var(--sw-fw-semibold);
  }
  .prog .line {
    color: var(--sw-text-2);
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--sw-text-3);
  }
  .tbl {
    min-inline-size: 0;
  }
  .sentence {
    margin: 0;
    font-size: var(--sw-fs-md);
    line-height: 1.5;
  }

  /* WKWATER-POLISH-2331: one rhythm between the toolbar and the columns (they touched before) */
  [data-wk-stations] {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
    min-inline-size: 0;
  }
  /* a list row answers the pointer like the cards: a tone step under a fine pointer, the press scale on the station part */
  .rowmain {
    transition: transform var(--sw-t-press) var(--sw-ease-out);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .row {
    transition: background-color var(--sw-t-fast) var(--sw-ease);
  }
  @media (hover: hover) and (pointer: fine) {
    .row:not([data-status='ringing']):hover {
      background: var(--sw-surface-2);
    }
  }
  .card .tech {
    margin-block-start: auto;
  }

  @media (max-width: 1100px) {
    .layout {
      --wk-tree: 208px;
    }
  }
  /* WKWATER-POLISH-2331 (NOSCROLL-297, owner rule: a control screen fits the viewport on a desktop): above 1100 px the screen takes the
     shell's height; the title, the toolbar and the filter chips stay in place and the stations (cards, list or table) scroll inside their
     own box, the places tree inside its column. A short window keeps 240 px for the stations and lets the page scroll below that. On a
     tablet and a phone the page scrolls as before. */
  @media (min-width: 1101px) {
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
    }
    sw-page {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    [data-wk-stations][data-wk-state='ready'] {
      flex: 1 1 auto;
      min-block-size: 0;
    }
    [data-wk-stations][data-wk-state='ready'] > .layout {
      flex: 1 1 auto;
      min-block-size: 240px;
      grid-template-rows: minmax(0, 1fr);
      align-items: stretch;
    }
    .treecol {
      position: static;
      max-block-size: 100%;
      min-block-size: 0;
      overflow-y: auto;
      scrollbar-width: thin;
      align-self: start;
    }
    .main {
      min-block-size: 0;
    }
    .main > .grid,
    .main > .rows-card,
    .main > sw-table {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow-y: auto;
      scrollbar-width: thin;
    }
    /* the ringing card's pulse (5 px) and the cards' shadows stay inside the scrolling box: the box keeps that much room around them */
    .main > .grid {
      grid-auto-rows: max-content;
      align-content: start;
      margin: -6px;
      padding: 6px;
    }
  }
  @media (max-width: 767px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }
    .treecol {
      display: none;
    }
    .chip.places {
      display: inline-flex;
    }
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      scrollbar-width: none;
      padding-block-end: 2px;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .toolbar .lbl {
      display: none;
    }
    .search {
      flex-basis: 160px;
    }
    .seen {
      display: none;
    }
    /* WKWATER-POLISH-2331: on a phone the whole row opens the drawer; its chevron took a line of its own under a row's buttons */
    .rowside > sw-icon {
      display: none;
    }
  }
  @keyframes wk-ring {
    0%,
    100% {
      box-shadow: 0 0 0 2px var(--sw-warning);
    }
    50% {
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--sw-warning) 35%, transparent);
    }
  }
  @keyframes wk-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .card.ringing,
    .strip .dot {
      animation: none;
    }
  }
`,Pe=(t,e)=>e.zone??t.defaultZone,E=(t,e)=>Mt(e.last_seen,t.now,Pe(t,e),t.text),ee=t=>e=>{e.stopPropagation(),t()};function ce(t,e){return e.camera_entity?t.media?t.failed[e.id]===t.poster?"failed":"image":"none":e.has_camera?"none":"nocam"}const de=(t,e)=>Me(e.id,t.poster);function Re(t,e,s){const i=t.text.still,a=s==="nocam"?i.none:s==="failed"?i.failed:i.offline;return o`<div class="none" role="status"><sw-icon name=${s==="nocam"?"camera":"offline"} size=${20}></sw-icon><span>${e.online||s==="nocam"?a:i.offline}</span></div>`}function Xs(t,e){if(!Ee(e)&&!(e.online&&e.call_state==="ending"))return l;if(!B(t.policy,t.rights))return l;const s=e.call_state==="ringing";return o`<span class="callbadge ${e.call_state}" data-wk-call-badge=${e.call_state}>${s?o`<sw-icon name="bell" size=${14}></sw-icon>`:o`<span class="ic">${K("phone",14)}</span>`}${F(e.call_state,t.text)}</span>`}function Zs(t,e){const s=t.text,i=ce(t,e),a=te(e.id,t.places),n=e.online?`${s.still.tag} · ${Ae(t.poster)}`:E(t,e);return o`<div class="media ${e.online?"":"off"}" data-wk-still=${e.id} data-still-state=${i}>
    ${i==="image"?o`<img src=${de(t,e)} alt=${k(s.still.alt,{name:e.name})} decoding="async" @error=${()=>t.stillError(e.id,t.poster)} /><span class="stamp"><bdi>${n}</bdi></span>`:Re(t,e,i)}
    ${Xs(t,e)}
    <button type="button" class="open" data-wk-open=${e.id} aria-label=${e.name} @click=${()=>t.open(e.id)}></button>
    <div class="scrim"><span class="name">${e.name}</span>${a?o`<span class="place">${a}</span>`:l}</div>
  </div>`}function Qs(t,e){const s=ce(t,e);return o`<span class="thumb ${e.online?"":"off"}" data-wk-thumb=${e.id}>${s==="image"?o`<img src=${de(t,e)} alt="" decoding="async" @error=${()=>t.stillError(e.id,t.poster)} />`:o`<sw-icon name="camera" size=${18}></sw-icon>`}</span>`}function j(t,e,s,i,a,n){const r=t.actions.armed,d=!!r&&r.id===e.id&&r.command===s&&r.callState===e.call_state;return o`<wk-action-button
    tone=${i}
    icon=${a}
    data-wk-call=${s}
    ?armed=${d}
    ?disabled=${!t.live||t.actions.callBusy.has(e.id)}
    label=${d?k(t.text.call.armedAria,{label:n}):n}
    @click=${c=>{c.stopPropagation(),t.call(e,s,c)}}
    >${d?t.text.call.armed:n}</wk-action-button
  >`}function ei(t,e=!1){const s=t.text.talk;return o`<wk-action-button tone="dashed" icon="window" href=${X()} data-wk-talk="classic" label=${s.hint} ?block=${e} size=${e?"lg":"md"} @click=${i=>i.stopPropagation()}
    >${e?s.classic:s.classicShort}</wk-action-button
  >`}function Ne(t,e,s){const i=t.talkControl?.(e,s);return i!==void 0?i:t.rights.talk?ei(t,s):l}function Be(t,e,s=!1){const i=t.text,a=e.online?e.call_state:"unavailable";if(a!=="ringing"&&a!=="in_call"&&a!=="ending")return l;if(!B(t.policy,t.rights))return l;const n=t.clock.seconds(e.id,t.now),r=a==="ringing"?o`<sw-icon name="bell" size=${15}></sw-icon>`:K("phone",15),d=t.rights.call&&a!=="ending";return o`<div class="callrow ${a} ${s?"big":""}" data-wk-call-row=${e.id} data-call=${a} role="group" aria-label=${i.call.group}>
    <span class="cs">${r}<span>${F(a,i)}</span>${n!==null?o`<span class="dur" data-wk-call-clock>${ae(n)}</span>`:l}</span>
    ${d?o`<span class="ctl">${a==="ringing"?o`${j(t,e,"answer","ok","phone",i.call.answer)}${j(t,e,"reject","danger","close",i.call.reject)}`:o`${s?l:Ne(t,e,!1)}${j(t,e,"hangUp","danger","hangup",i.call.hangUp)}`}</span>`:l}
  </div>`}function he(t,e){if(!t.rights.door)return l;const s=t.text.door;return o`${J(e).map(i=>{const a=`${e.id}/${i.physical_index}`,n=t.actions.isHeld(a),r=t.actions.releasing.has(a),d=n?"held":r?"sending":"idle",c=n?s.held:r?s.sending:e.locks.length>1?k(s.openNamed,{name:re(i,t.text)}):s.open;return o`<wk-action-button
      class="grow"
      icon="unlock"
      data-wk-door=${a}
      data-state=${d}
      ?busy=${r}
      ?disabled=${!t.live||!e.online||r||n}
      @click=${ee(()=>t.door(e,i.physical_index))}
      >${c}</wk-action-button
    >`})}`}function ti(t,e){return!t.rights.announce||!e.online?l:o`<wk-action-button icon="volume" icon-only data-wk-announce-at=${e.id} label=${t.text.announce} ?disabled=${!t.live} @click=${ee(()=>t.announce(e.id))}></wk-action-button>`}function qe(t,e,s=!1){const i=t.actions.results[e.id];return i?o`<div class="result ${i.tone} ${s?"sticky":""}" role="status" data-wk-result=${e.id} data-tone=${i.tone}>${i.text}</div>`:l}function si(t,e,s){e.composedPath().some(a=>a instanceof HTMLElement&&a.matches("button, a, wk-action-button, select, input, textarea, summary"))||t.open(s)}function ii(t,e){const s=e.technical;return s?o`<div class="tech" data-wk-tech-row>
    <sw-badge kind=${le(e.sync_state)} label=${se(e.sync_state,t.text)} data-wk-sync=${e.sync_state}></sw-badge>
    <span class="sp"></span>
    ${s.model?o`<code>${s.model}</code>`:l}
  </div>`:l}function ai(t,e){const s=t.text,i=Ce(e),a=t.rights.door&&J(e).length>0||t.rights.announce&&e.online;return o`<sw-card flush interactive class="card ${i==="ringing"?"ringing":""}" data-wk-station=${e.id} data-status=${i} @click=${n=>si(t,n,e.id)}>
    ${Zs(t,e)}
    <div class="cb">
      <div class="hd">
        <sw-badge kind=${e.online?"live":"offline"} label=${e.online?s.status.online:s.status.offline}></sw-badge>
        <span>${s.seen.prefix} <b><bdi>${E(t,e)}</bdi></b></span>
      </div>
      ${Be(t,e)}
      ${a?o`<div class="acts">${he(t,e)}${ti(t,e)}</div>`:l}
      ${qe(t,e)} ${ii(t,e)}
    </div>
  </sw-card>`}function ne(t,e,s=!1){const i=e.online?e.call_state:"";if(i!=="ringing"&&i!=="in_call"&&i!=="ending")return l;if(!B(t.policy,t.rights))return l;const a=t.clock.seconds(e.id,t.now),n=`${F(i,t.text)}${a!==null?` · ${ae(a)}`:""}`;return s?o`<sw-badge kind=${i==="ringing"?"stale":"recorded"} label=${n} data-wk-call-pill=${i}></sw-badge>`:o`<span class="pillcall ${i}" data-wk-call-pill=${i}>${F(i,t.text)}${a!==null?o` · <span class="dur">${ae(a)}</span>`:l}</span>`}function ni(t,e){const s=t.text,a=[te(e.id,t.places),e.technical?se(e.sync_state,s):""].filter(Boolean).join(" · "),n=t.rights.call&&e.online&&e.call_state==="ringing"&&B(t.policy,t.rights);return o`<div class="row" data-wk-station=${e.id} data-status=${Ce(e)}>
    <button type="button" class="rowmain" data-wk-open=${e.id} @click=${()=>t.open(e.id)}>
      ${Qs(t,e)}
      <span class="rowtext"><span class="t"><span class="sdot ${e.online?"":"off"}" aria-hidden="true"></span><b>${e.name}</b></span>${a?o`<span class="s">${a}</span>`:l}</span>
    </button>
    <div class="rowside">
      ${ne(t,e)}
      <span class="seen">${s.seen.prefix} <bdi>${E(t,e)}</bdi></span>
      <div class="rowacts">
        ${n?j(t,e,"answer","ok","phone",s.call.answer):l}${he(t,e)}
      </div>
      <sw-icon name="chevron" size=${16} aria-hidden="true"></sw-icon>
    </div>
  </div>`}function oi(t,e){return o`<sw-card flush class="rows-card"><div class="rows" data-wk-rows>${Te(e,s=>s.id,s=>ni(t,s))}</div></sw-card>`}function ri(t,e){return o`<div class="grid" data-wk-grid>${Te(e,s=>s.id,s=>ai(t,s))}</div>`}function li(t,e){const s=t.text,i=c=>c,a=e.some(c=>c.technical),n=o`<span style="color:var(--sw-text-3)">—</span>`,r=t.table==="compact"||t.table==="none",d=[{key:"name",label:s.table.station,render:c=>o`<wk-action-button tone="quiet" data-wk-open=${i(c).id} @click=${()=>t.open(i(c).id)}>${i(c).name}</wk-action-button>`},{key:"status",label:s.table.status,render:c=>{const p=i(c),$=o`<sw-badge kind=${p.online?"live":"offline"} label=${p.online?s.status.online:s.status.offline}></sw-badge>`;if(!r)return $;const g=ne(t,p,!0),z=p.online?l:o`<small style="color:var(--sw-text-3);font-size:var(--sw-fs-xs)"><bdi>${E(t,p)}</bdi></small>`;return g===l&&z===l?$:o`<span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:var(--sw-s-1)">${$}${g}${z}</span>`}}];return r||d.push({key:"call",label:s.table.call,render:c=>ne(t,i(c),!0)}),d.push({key:"actions",label:s.table.actions,render:c=>{const p=i(c),$=t.rights.call&&p.online&&p.call_state==="ringing"&&B(t.policy,t.rights);return o`<span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:var(--sw-s-2);max-inline-size:190px">${$?j(t,p,"answer","ok","phone",s.call.answer):l}${he(t,p)}</span>`}}),r||d.push({key:"place",label:s.table.place,render:c=>o`<span style="display:inline-block;white-space:normal;max-inline-size:130px;vertical-align:middle">${te(i(c).id,t.places)||"—"}</span>`},{key:"seen",label:s.table.seen,render:c=>o`<bdi>${E(t,i(c))}</bdi>`}),t.table==="full"&&d.push({key:"doors",label:s.table.doors,render:c=>o`<span style="display:inline-block;white-space:normal;max-inline-size:120px;vertical-align:middle">${J(i(c)).map(p=>re(p,s)).join(", ")||"—"}</span>`}),a&&(d.push({key:"sync",label:s.table.sync,render:c=>i(c).technical?o`<sw-badge kind=${le(i(c).sync_state)} label=${se(i(c).sync_state,s)}></sw-badge>`:n}),t.table==="full"&&d.push({key:"model",label:s.table.model,ltr:!0,render:c=>{const p=i(c).technical;return p?.model||p?.firmware?o`<span style="display:inline-block;vertical-align:middle">${p.model?o`<span style="display:block">${p.model}</span>`:l}${p.firmware?o`<span style="display:block;color:var(--sw-text-3)">${p.firmware}</span>`:l}</span>`:n}})),d}function ci(t,e){const s=e.technical;if(!s)return l;const i=t.text,a=s.reconciled_at&&/(Z|[+-]\d\d:\d\d)$/.test(s.reconciled_at)?Et(Date.parse(s.reconciled_at),t.now,Pe(t,e)??void 0,i):"",n=s.clock?.skew_seconds,r=n==null?"":Math.abs(n)<=2?i.tech.clockOk:k(i.tech.clockDrift,{n:Math.round(n)}),d=s.event_status?.stream,c=d?d==="connected"?i.tech.streamOk:["disconnected","unavailable","stopped","authentication_failed"].includes(d)?i.tech.streamDown:i.tech.streamUnknown:"";return o`<section class="dsec" data-wk-dsec="technical">
    <h4><sw-icon name="cpu" size=${14}></sw-icon>${i.drawer.technical}</h4>
    <dl class="kv">
      <dt>${i.tech.sync}</dt>
      <dd><sw-badge kind=${le(e.sync_state)} label=${se(e.sync_state,i)}></sw-badge>${a?o` · <bdi>${a}</bdi>`:l}</dd>
      ${s.model?o`<dt>${i.tech.model}</dt><dd><code>${s.model}</code></dd>`:l}
      ${s.firmware?o`<dt>${i.tech.firmware}</dt><dd><code>${s.firmware}</code></dd>`:l}
      <dt>${i.tech.relays}</dt>
      <dd>${k(i.tech.relaysValue,{n:e.locks.length,mode:e.lock_enabled?i.tech.relayOn:i.tech.relayOff})}</dd>
      ${r?o`<dt>${i.tech.clock}</dt><dd>${r}</dd>`:l} ${c?o`<dt>${i.tech.stream}</dt><dd>${c}</dd>`:l}
      ${e.errors?o`<dt>${i.tech.lastError}</dt><dd>${e.errors.last_error?o`<code data-wk-last-error>${e.errors.last_error}</code>`:o`<span class="muted">${i.tech.none}</span>`}</dd>`:l}
      ${e.errors?.scan_error?o`<dt>${i.tech.scanError}</dt><dd><code>${e.errors.scan_error}</code></dd>`:l}
    </dl>
  </section>`}function He(t,e){const s=t.text.prog;if(e.state==="ready")return l;const i=e.state==="unsupported"?s.unsupported:e.state==="busy"?s.busy:e.state==="error"?s.unavailable:s.loading;return o`<div class="muted" role="status" data-wk-fetch=${e.state}>${i}${e.state==="error"||e.state==="busy"?o` · <wk-action-button tone="quiet" @click=${()=>t.retryDetail()}>${t.text.retry}</wk-action-button>`:l}</div>`}function di(t,e,s){const i=t.text;if(!s||s.programs.state!=="ready")return s?He(t,s.programs):o`<div class="muted" role="status" data-wk-fetch="loading">${i.prog.loading}</div>`;const a=Lt(s.programs.data,e,i);return a.length?o`${a.map(n=>o`<div class="prog" data-wk-program=${n.door}>
      <div class="ph">
        <span>${n.name}</span>
        ${n.none?o`<sw-badge kind="neutral" label=${i.prog.none}></sw-badge>`:o`<sw-badge kind=${n.removing?"stale":n.enabled?"live":"offline"} label=${n.removing?i.prog.removing:n.enabled?i.prog.on:i.prog.off}></sw-badge>${n.status&&n.enabled&&!n.removing?o`<sw-badge kind="recorded" label=${n.status}></sw-badge>`:l}`}
      </div>
      ${n.hours.map(r=>o`<div class="line">${i.prog.hours}: <bdi>${r}</bdi></div>`)}
      ${n.holidays?o`<div class="line muted">${k(i.prog.holidays,{n:n.holidays})}</div>`:l}
      ${n.error?o`<div class="line"><sw-badge kind="error" label=${i.prog.error}></sw-badge></div>`:l}
      ${!n.none&&n.unreadable?o`<div class="line muted">${i.prog.unknownShape}</div>`:l}
    </div>`)}`:l}function hi(t,e){const s=t.text;if(!e)return l;if(e.codes.state!=="ready")return o`<div class="prog">${He(t,e.codes)}</div>`;const i=It(e.codes.data,s);return o`<div class="prog" data-wk-codes=${i.state}>
    <div class="ph"><span>${s.prog.codes}</span><sw-badge kind=${i.state==="set"?"live":i.state==="unset"?"offline":"unknown"} label=${i.label}></sw-badge></div>
    ${i.slots.length>1?i.slots.map(a=>o`<div class="line">${a.label}: ${a.state==="set"?s.prog.codeConfigured:a.state==="unset"?s.prog.codeNotConfigured:s.prog.codeUnknown}</div>`):l}
  </div>`}function pi(t,e){if(!e.technical)return l;const s=t.features.door_programs!==!1,i=t.features.public_codes!==!1;if(!s&&!i)return l;const a=t.text,n=t.detail[e.id];return o`<section class="dsec" data-wk-dsec="settings">
    <button type="button" class="toggle" aria-expanded=${String(t.detailOpen)} data-wk-settings-toggle @click=${()=>t.toggleDetail()}>
      <sw-icon name="chevronDown" size=${14}></sw-icon><span>${a.drawer.doorSettings}</span>
    </button>
    ${t.detailOpen?o`${s&&J(e).length?di(t,e,n):l}${i?hi(t,n):l}`:l}
  </section>`}function ui(t,e){const s=Ot(e.id,pe.events==="smplwise",D("access.events.read")),i=At(e,pe.schedules==="smplwise",D("access.stations.read"));return!s&&!i?l:o`<div class="evlink">
    ${s?o`<wk-action-button tone="quiet" icon="history" href=${s} data-wk-station-events=${e.id}>${Ct("stationEvents")}</wk-action-button>`:l}
    ${i?o`<wk-action-button tone="quiet" icon="calendar" href=${i} data-wk-station-schedules=${e.id}>${t.text.drawer.schedules}</wk-action-button>`:l}
  </div>`}function wi(t,e){const s=t.text,i=ce(t,e),a=te(e.id,t.places),n=J(e),r=t.rights.call||B(t.policy,t.rights)&&(e.online?["ringing","in_call","ending"].includes(e.call_state):!1),d=e.online&&["ringing","in_call","ending"].includes(e.call_state),c=t.actions.tts[e.id],p=c?Oe(c,s):"",$=t.liveArea?.(e)??null;return o`
    ${$??o`<div class="live ${e.online?"":"off"}" data-wk-live data-still-state=${i}>
      ${i==="image"?o`<img src=${de(t,e)} alt=${k(s.still.alt,{name:e.name})} decoding="async" @error=${()=>t.stillError(e.id,t.poster)} />`:Re(t,e,i)}
      ${i==="image"?o`<span class="stamp"><bdi>${s.drawer.lastStill} · ${e.online?Ae(t.poster):E(t,e)}</bdi></span>`:l}
      <div class="ov"><span class="t"><sw-icon name="play" size=${16}></sw-icon>${s.drawer.liveClassic}</span><wk-action-button icon="window" href=${X()} data-wk-classic-link>${s.drawer.openClassic}</wk-action-button></div>
    </div>`}
    <div class="meta">${a?o`<span>${a}</span>`:l}<span>${s.seen.prefix} <bdi>${E(t,e)}</bdi></span></div>
    ${ui(t,e)}
    ${qe(t,e,!0)}
    ${r?o`<section class="dsec" data-wk-dsec="call">
          <h4>${K("phone",14)}${s.drawer.call}</h4>
          ${d?o`${Be(t,e,!0)}${e.call_state==="in_call"?Ne(t,e,!0):l}`:o`<div class="callrow"><span class="cs muted">${s.call.none}</span>${t.rights.call&&e.online?o`<wk-action-button tone="dashed" icon="phone" href=${X()} data-wk-dial>${s.call.dial}</wk-action-button>`:l}</div>`}
        </section>`:l}
    ${n.length||t.rights.door?o`<section class="dsec" data-wk-dsec="doors">
          <h4><sw-icon name="door" size=${14}></sw-icon>${s.drawer.doors}</h4>
          ${n.length?n.map(g=>{const w=t.detail[e.id]?.programs.data?.programs.find(Y=>Y.door===g.physical_index)?.execution?.status==="held_acknowledged";return o`<div class="doorrow" data-wk-doorrow=${g.physical_index}>
                  <span class="dn">${re(g,s)}</span>
                  <span class="ds">${w?o`<sw-icon name="clock" size=${12}></sw-icon>${s.prog.state.held_acknowledged}`:l}</span>
                  ${t.rights.door?o`<wk-action-button
                        icon="unlock"
                        data-wk-door=${`${e.id}/${g.physical_index}`}
                        data-state=${t.actions.isHeld(`${e.id}/${g.physical_index}`)?"held":t.actions.releasing.has(`${e.id}/${g.physical_index}`)?"sending":"idle"}
                        ?busy=${t.actions.releasing.has(`${e.id}/${g.physical_index}`)}
                        ?disabled=${!t.live||!e.online||t.actions.releasing.has(`${e.id}/${g.physical_index}`)||t.actions.isHeld(`${e.id}/${g.physical_index}`)}
                        @click=${ee(()=>t.door(e,g.physical_index))}
                        >${t.actions.isHeld(`${e.id}/${g.physical_index}`)?s.door.held:t.actions.releasing.has(`${e.id}/${g.physical_index}`)?s.door.sending:s.door.open}</wk-action-button
                      >`:l}
                </div>`}):o`<span class="muted">${s.door.none}</span>`}
        </section>`:l}
    ${t.rights.announce?o`<section class="dsec" data-wk-dsec="announce">
          <h4><sw-icon name="volume" size=${14}></sw-icon>${s.drawer.announce}</h4>
          <div class="callrow"><span class="cs muted" data-wk-announce-state>${p||s.drawer.announceHint}</span><wk-action-button icon="volume" data-wk-announce-at=${e.id} ?disabled=${!t.live||!e.online} @click=${ee(()=>t.announce(e.id))}>${s.announce}</wk-action-button></div>
        </section>`:l}
    ${ci(t,e)} ${pi(t,e)}
  `}var fi=Object.defineProperty,gi=Object.getOwnPropertyDescriptor,m=(t,e,s,i)=>{for(var a=i>1?void 0:i?gi(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(a=(i?r(e,s,a):r(a))||a);return i&&a&&fi(e,s,a),a};const Ue="sw.wiskey.stations.view",je="sw.wiskey.stations.treeCollapsed",_e=3e4;function Fe(t){try{return localStorage.getItem(t)}catch{return null}}function ze(t,e){try{localStorage.setItem(t,e)}catch{}}const mi=()=>{const t=Fe(Ue);return t==="list"||t==="table"?t:"cards"},bi=()=>{try{const t=JSON.parse(Fe(je)??"[]");return new Set(Array.isArray(t)?t.filter(e=>typeof e=="string"):[])}catch{return new Set}},G={kind:"iana",name:"Asia/Jerusalem"},Se=[{id:"d1",name:"שער ראשי",online:!0,call_state:"ringing",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:G,technical:null,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:G,technical:null,errors:null},{id:"d3",name:"חניון",online:!0,call_state:"idle",sync_state:"pending",lock_enabled:!1,locks:[],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:G,technical:null,errors:null},{id:"d4",name:"מחסן",online:!1,call_state:"unavailable",sync_state:"offline",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!1,camera_entity:null,last_seen:"2026-09-26T19:02:00+03:00",zone:G,technical:null,errors:null}];let f=class extends R{constructor(){super(...arguments),this.feed=null,this.error="",this.forbidden=!1,this.filter="all",this.query="",this.view=mi(),this.place="all",this.places=null,this.collapsed=bi(),this.selected=null,this.sheet=!1,this.announceOpen=!1,this.announceFor="",this.policy=Dt,this.features={},this.detail={},this.detailOpen=!1,this.now=Date.now(),this.poster=Date.now(),this.failed={},this.table=me(typeof window>"u"?1440:window.innerWidth),this.mediaMode="off",this.media={},this.mediaAt={},this.clock=new Pt,this.actions=new Q({release:(t,e)=>ct(t,e),signal:(t,e)=>lt(t,e),station:t=>this.list().find(e=>e.id===t),live:()=>this.isLive(),now:()=>Date.now(),tick:()=>performance.now(),after:(t,e)=>window.setTimeout(t,e),cancel:t=>window.clearTimeout(t),changed:()=>this.requestUpdate(),refetch:()=>void this.load(),stamp:()=>Je(new Date)}),this.stop=null,this.stopRoute=null,this.poll=0,this.tickTimer=0,this.posterTimer=0,this.loading=!1,this.loadAgain=!1,this.placesKey="",this.detailAt={},this.mqc=typeof matchMedia=="function"?matchMedia(`(max-width: ${Rt}px)`):null,this.mqm=typeof matchMedia=="function"?matchMedia(`(max-width: ${Nt}px)`):null,this.mqn=typeof matchMedia=="function"?matchMedia(`(max-width: ${Bt-1}px)`):null,this.onMedia=()=>{this.table=me(window.innerWidth)}}connectedCallback(){if(super.connectedCallback(),this.mqc?.addEventListener("change",this.onMedia),this.mqm?.addEventListener("change",this.onMedia),this.mqn?.addEventListener("change",this.onMedia),this.stopRoute=Ye(t=>this.onRoute(t)),!!ie()){if(!D("access.read")){this.forbidden=!0;return}this.load(),this.readFeatures(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.poster=Date.now())},qt),this.stop=dt(t=>{t.type==="intercom_tts"?this.actions.noteTts(t.status):t.type!=="heartbeat"&&this.load()},t=>{this.setPolling(!t),t&&this.load()}),this.schedule()}}disconnectedCallback(){super.disconnectedCallback(),this.mqc?.removeEventListener("change",this.onMedia),this.mqm?.removeEventListener("change",this.onMedia),this.mqn?.removeEventListener("change",this.onMedia),this.stop?.(),this.stop=null,this.stopRoute?.(),this.stopRoute=null,this.setPolling(!1),window.clearInterval(this.posterTimer),window.clearTimeout(this.tickTimer),this.actions.dispose()}updated(t){(t.has("selected")||t.has("detailOpen"))&&this.maybeLoadDetail(),(t.has("selected")||t.has("mediaMode"))&&this.maybeLoadMedia()}setPolling(t){window.clearInterval(this.poll),this.poll=t?window.setInterval(()=>void this.load(),Ht):0}schedule(){window.clearTimeout(this.tickTimer),this.tickTimer=window.setTimeout(()=>{this.now=Date.now(),this.clock.observe(this.list(),this.now),this.actions.prune(),this.schedule()},this.clock.active?1e3:2e4)}onRoute(t){if(t.mode!=="wiskey")return;const e=t.params.get("station");e&&e!==this.selected?(this.selected=e,this.detailOpen=!1):!e&&this.selected&&(this.selected=null,this.detailOpen=!1)}demo(){return!ie()}list(){return this.demo()?Se:this.feed?.stations??[]}isLive(){return!this.demo()&&this.feed?.state==="ready"&&this.feed.fresh!==!1}rights(){return this.demo()?Ut:jt(ue,this.policy,D)}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{const t=await st();this.feed=t,this.error="",this.forbidden=!1,this.afterLoad(t)}catch(t){t instanceof W&&t.status===403?this.forbidden=!0:this.error=oe(t)}}while(this.loadAgain)}finally{this.loading=!1}}afterLoad(t){this.now=Date.now(),this.clock.observe(t.stations??[],this.now),this.actions.dropStaleArm(),this.readPolicy(),this.ensurePlaces(t.stations??[]),this.maybeLoadMedia(),this.schedule()}async readPolicy(){try{const t=await Ve();this.policy=Ft(t),this.mediaMode=Wt(t)}catch{}}async readFeatures(){try{const t=await it();this.features=Object.fromEntries(Object.entries(t.features??{}).map(([e,s])=>[e,s.available]))}catch{}}async ensurePlaces(t){const e=t.filter(i=>i.camera_entity),s=e.map(i=>`${i.id}:${i.camera_entity}`).sort().join("|");if(s!==this.placesKey){if(this.placesKey=s,!e.length||!D("devices.read")){this.places=null;return}try{const[i,a]=await Promise.all([Ge(),Xe(e.map(n=>n.camera_entity))]);if(s!==this.placesKey)return;this.places=Kt(t,i,a.entities)}catch{this.places=null}}}maybeLoadDetail(){const t=this.selected;if(!t||!this.detailOpen||this.demo()||!this.list().find(i=>i.id===t)?.technical)return;const s=this.detailAt[t]??0;this.detail[t]&&Date.now()-s<_e||this.loadDetail(t)}async loadDetail(t){this.detailAt={...this.detailAt,[t]:Date.now()};const e={state:"loading",data:null};this.detail={...this.detail,[t]:{programs:e,codes:e}};const s=a=>this.detail={...this.detail,[t]:{...this.detail[t],...a}},i=(a,n)=>a.state==="ready"&&n?{state:"ready",data:n}:a.state==="unsupported"?{state:"unsupported",data:null}:a.last_error==="busy"||a.last_error==="rate_limited"||a.last_error==="timeout"?{state:"busy",data:null}:{state:"error",data:null};if(this.features.door_programs!==!1)try{const a=await at(t);s({programs:i(a,a.programs)})}catch{s({programs:{state:"error",data:null}})}else s({programs:{state:"unsupported",data:null}});if(this.features.public_codes!==!1)try{const a=await nt(t);s({codes:i(a,a.codes)})}catch{s({codes:{state:"error",data:null}})}else s({codes:{state:"unsupported",data:null}})}maybeLoadMedia(){const t=this.selected;!t||this.mediaMode==="off"||this.demo()||this.media[t]!==void 0&&Date.now()-(this.mediaAt[t]??0)<_e||(this.mediaAt={...this.mediaAt,[t]:Date.now()},Jt(t).then(e=>this.media={...this.media,[t]:e}).catch(()=>this.media={...this.media,[t]:null}))}posterOf(t){return!t.camera_entity||this.demo()||!we("go2rtc")||this.failed[t.id]===this.poster?"":Me(t.id,this.poster)}liveArea(t,e){if(this.mediaMode==="off")return null;const s=this.media[t.id];if(!s||s.state!=="ready")return null;const i=!!s.video?.allowed&&Object.keys(s.video.paths).length>0;if(!i&&!s.talk?.available)return null;const a=e.rights.talk&&!s.talk?.available;return o`<wk-station-live
      data-wk-live-native
      .stationId=${t.id}
      .stationName=${t.name}
      .media=${i?s:{...s,video:null}}
      .poster=${this.posterOf(t)}
      .live=${e.live&&t.online}
      .classicHref=${a?X():""}
      .classicLabel=${e.text.talk.classic}
    ></wk-station-live>`}talkControl(t,e,s){if(this.mediaMode==="video_talk")return e?this.liveArea(t,s)?l:void 0:!D("access.call")||!t.online?void 0:o`<wk-action-button icon="mic" data-wk-talk="drawer" label=${Z().talk.openDrawer} @click=${i=>{i.stopPropagation(),this.open(t.id)}}>${Z().talk.openDrawer}</wk-action-button>`}open(t){this.selected!==t&&(this.selected=t,this.detailOpen=!1,this.syncRoute(t))}closeDrawer(){this.selected=null,this.detailOpen=!1,this.syncRoute(null)}syncRoute(t){const e=Ze();if(e.mode!=="wiskey")return;const s=new URLSearchParams(e.params);t?s.set("station",t):s.delete("station"),Qe(e.path,s)}setView(t){this.view=t,ze(Ue,t)}toggleFloor(t){const e=new Set(this.collapsed);e.has(t)?e.delete(t):e.add(t),this.collapsed=e,ze(je,JSON.stringify([...e]))}pickPlace(t){this.place=t,this.sheet=!1}ctx(){const t=this.features,e={text:x(),now:this.now,defaultZone:this.feed?.default_zone??null,live:this.isLive(),rights:this.rights(),policy:this.policy,places:this.places,actions:this.actions,clock:this.clock,table:this.table,media:this.demo()?!1:we("go2rtc"),poster:this.poster,failed:this.failed,selected:this.selected,detail:this.detail,detailOpen:this.detailOpen,features:t,open:s=>this.open(s),door:(s,i)=>void this.actions.askRelease(s.id,i),call:(s,i,a)=>this.actions.tapCall(s.id,i,a.detail),announce:s=>{this.announceFor=s,this.announceOpen=!0},stillError:(s,i)=>this.failed={...this.failed,[s]:i},toggleDetail:()=>this.detailOpen=!this.detailOpen,retryDetail:()=>{this.selected&&this.loadDetail(this.selected)}};return this.mediaMode!=="off"&&(e.liveArea=s=>this.liveArea(s,e),e.talkControl=(s,i)=>this.talkControl(s,i,e)),e}render(){const t=x();if(this.forbidden&&ie())return o`<sw-page heading=${t.title}><div data-wk-stations data-wk-state="forbidden"><sw-state-panel state="forbidden" heading=${t.states.forbidden} data-wk-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return o`<sw-page heading=${t.title}><div data-wk-stations data-wk-state=${this.error?"error":"loading"}>${this.error?o`<sw-state-panel state="error" heading=${t.states.error} hint=${this.error} actionLabel=${t.retry} data-wk-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:o`<sw-state-panel state="loading" heading=${t.states.loading} data-wk-panel="loading"></sw-state-panel>`}</div></sw-page>`;const e=this.demo()?Se:this.feed.stations;if(e===null){const s=this.feed.state==="ready"?"error":this.feed.state,i=Yt(s,t);return o`<sw-page heading=${t.title}>
        ${this.renderFeedBadge()}
        <div data-wk-stations data-wk-state=${`feed:${this.feed.state}`}>
          <sw-state-panel icon="door" state=${i.panel} heading=${i.heading} actionLabel=${i.settings&&ue("system.configure")?t.states.toSettings:""} data-wk-panel=${`feed:${this.feed.state}`} @action=${()=>window.location.hash="#/system/diagnostics?tab=access-control"}></sw-state-panel>
        </div>
      </sw-page>`}return this.renderReady(e)}renderFeedBadge(){const t=x();if(this.demo())return o`<sw-badge slot="actions" kind="neutral" label=${t.demo} data-wk-feed="demo"></sw-badge>`;const e=this.feed;if(!e)return l;const s=e.state==="ready"&&e.fresh!==!1,i=s?"live":e.state==="connecting"?"unknown":e.state==="forbidden"?"forbidden":e.state==="error"?"error":e.stations?"stale":"offline",a=s?t.feed.live:e.state==="connecting"?t.feed.connecting:e.stations&&e.fetched_at?k(t.feed.stale,{ago:Vt(e.fetched_at,this.now,t)||"…"}):t.feed.off;return o`<sw-badge slot="actions" kind=${i} label=${a} data-wk-feed=${s?"live":e.state}></sw-badge>`}effectiveView(){return this.table==="none"&&this.view==="table"?"list":this.view}renderReady(t){const e=x(),s=this.ctx(),i=Gt(t,this.places,this.collapsed,e),a=i.length>0,n=a&&i.some(w=>w.id===this.place)?this.place:"all",r=Xt(t,this.filter,this.query,n,this.places),d=Zt(t),c=this.effectiveView(),p=t.filter(Ee).length,$=t.some(w=>w.online),g=t.length?"ready":"empty",z=i.find(w=>w.id===n)?.name??e.places.all;return o`<sw-page wide heading=${e.title} subheading=${Qt(d,e)}>
      ${this.renderFeedBadge()}
      <div data-wk-stations data-wk-state=${g} data-view=${c} data-live=${String(s.live)}>
        ${t.length?o`<div class="toolbar">
              <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wk-search aria-label=${e.searchLabel} placeholder=${e.searchLabel} .value=${this.query} @input=${w=>this.query=w.target.value} /></label>
              ${s.rights.announce&&$?o`<wk-action-button icon="volume" data-wk-announce ?disabled=${!s.live} label=${e.announce} @click=${()=>s.announce("")}><span class="lbl">${e.announce}</span></wk-action-button>`:l}
              <sw-view-switch data-wk-views label=${e.views.label} .value=${c} .options=${[{id:"cards",label:e.views.cards,icon:"grid"},{id:"list",label:e.views.list,icon:"list"},...this.table==="none"?[]:[{id:"table",label:e.views.table,icon:"table"}]]} @change=${w=>this.setView(w.detail)}></sw-view-switch>
            </div>`:l}
        <div class="layout ${a?"":"no-tree"}">
          ${a?o`<aside class="treecol"><sw-card flush><sw-place-tree data-wk-tree .rows=${i} .selected=${n} heading=${e.places.title} foldLabel=${e.places.fold} unfoldLabel=${e.places.unfold} @place-select=${w=>this.pickPlace(w.detail)} @place-toggle=${w=>this.toggleFloor(w.detail)}></sw-place-tree></sw-card></aside>`:l}
          <section class="main">
            ${t.length?o`<div class="chips" role="group" aria-label=${e.filters.label}>
                  ${a?o`<button type="button" class="chip places" data-wk-places-chip @click=${()=>this.sheet=!0}><sw-icon name="pin" size=${14}></sw-icon>${e.places.chip}: ${z}<sw-icon name="chevronDown" size=${12}></sw-icon></button>`:l}
                  ${es.map(w=>o`<button type="button" class="chip" data-wk-filter=${w} aria-pressed=${String(this.filter===w)} @click=${()=>this.filter=w}>
                      ${w==="in_call"?K("phone",14):l}${w==="all"?e.filters.all:w==="online"?e.filters.online:w==="attention"?e.filters.attention:e.filters.inCall}
                    </button>`)}
                </div>`:l}
            ${p&&c==="cards"&&s.rights.call?o`<div class="strip" role="status" data-wk-strip>
                  <span class="dot" aria-hidden="true"></span><span>${p===1?e.strip.one:k(e.strip.many,{n:p})}</span><span class="sp"></span>
                  <wk-action-button tone="quiet" icon="list" data-wk-strip-list @click=${()=>this.setView("list")}>${e.strip.toList}</wk-action-button>
                </div>`:l}
            ${this.renderContent(s,t,r,c)}
          </section>
        </div>
      </div>
      ${this.renderSheet(i,n)} ${this.renderDrawer(s,t)} ${this.selected?l:this.renderDialogs(s,t)}
    </sw-page>`}renderContent(t,e,s,i){const a=t.text;return e.length?s.length?i==="table"?o`<sw-table class="tbl" dense data-wk-table .columns=${li(t,e)} .rows=${s} .selected=${this.selected} @row-select=${n=>this.open(n.detail.id)}></sw-table>`:i==="list"?oi(t,s):ri(t,s):o`<sw-state-panel icon="door" compact state="empty" heading=${a.states.emptyFilter} data-wk-panel="empty-filter"></sw-state-panel>`:o`<sw-state-panel icon="door" state="empty" heading=${a.states.empty} data-wk-panel="empty"></sw-state-panel>`}renderSheet(t,e){const s=x();return t.length?o`<sw-drawer modal ?open=${this.sheet} heading=${s.places.sheet} data-wk-places-sheet @close=${i=>i.target===i.currentTarget&&(this.sheet=!1)}>
      <sw-place-tree .rows=${t} .selected=${e} heading=${s.places.title} foldLabel=${s.places.fold} unfoldLabel=${s.places.unfold} @place-select=${i=>this.pickPlace(i.detail)} @place-toggle=${i=>this.toggleFloor(i.detail)}></sw-place-tree>
    </sw-drawer>`:l}renderDrawer(t,e){const s=t.text,i=this.selected,a=i?e.find(r=>r.id===i):void 0,n=a?a.online?"live":"offline":"neutral";return o`<sw-drawer modal ?open=${!!i} heading=${a?.name??s.drawer.notFound} data-wk-drawer data-wk-drawer-station=${i??""} @close=${r=>r.target===r.currentTarget&&this.closeDrawer()}>
      ${i&&a?o`<sw-badge slot="action" kind=${n} label=${a.online?s.status.online:s.status.offline}></sw-badge>`:l}
      ${i?a?wi(t,a):o`<sw-state-panel compact state="forbidden" heading=${s.drawer.notFoundHint} data-wk-panel="scoped"></sw-state-panel>`:l}
      ${i?this.renderDialogs(t,e):l}
    </sw-drawer>`}renderDialogs(t,e){return o`${this.renderConfirm(t,e)}
    <wk-announce-dialog
      ?open=${this.announceOpen}
      .stations=${e}
      .places=${this.places}
      .scope=${this.policy.announceScope}
      .phrases=${ts(this.policy,t.text)}
      .preselect=${this.announceFor}
      .tts=${this.actions.tts}
      @tts-status=${s=>this.actions.noteTts(s.detail)}
      @close=${s=>{s.target===s.currentTarget&&(this.announceOpen=!1)}}
    ></wk-announce-dialog>`}renderConfirm(t,e){const s=this.actions.confirm;if(!s)return l;const i=e.find(p=>p.id===s.stationId);if(!i)return l;const a=t.text,n=i.locks.find(p=>p.physical_index===s.lock)?.name?.trim(),r=ss(i.name),d=n?k(a.door.confirmNamed,{door:n,inPlace:r}):k(a.door.confirmPlain,{inPlace:r}),c=this.actions.releasing.has(`${i.id}/${s.lock}`);return o`<sw-dialog open ?locked=${c} heading=${a.door.confirmTitle} data-wk-release-dialog @close=${p=>p.target===p.currentTarget&&this.actions.cancelRelease()}>
      <p class="sentence" data-wk-release-sentence>${d}</p>
      <div slot="footer">
        <wk-action-button data-wk-release-cancel ?disabled=${c} @click=${()=>this.actions.cancelRelease()}>${a.door.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon="unlock" data-wk-release-confirm ?busy=${c} ?disabled=${c||!t.live} @click=${()=>void this.actions.confirmRelease()}>${c?a.door.sending:a.door.send}</wk-action-button>
      </div>
    </sw-dialog>`}};f.styles=Gs;m([h()],f.prototype,"feed",2);m([h()],f.prototype,"error",2);m([h()],f.prototype,"forbidden",2);m([h()],f.prototype,"filter",2);m([h()],f.prototype,"query",2);m([h()],f.prototype,"view",2);m([h()],f.prototype,"place",2);m([h()],f.prototype,"places",2);m([h()],f.prototype,"collapsed",2);m([h()],f.prototype,"selected",2);m([h()],f.prototype,"sheet",2);m([h()],f.prototype,"announceOpen",2);m([h()],f.prototype,"announceFor",2);m([h()],f.prototype,"policy",2);m([h()],f.prototype,"features",2);m([h()],f.prototype,"detail",2);m([h()],f.prototype,"detailOpen",2);m([h()],f.prototype,"now",2);m([h()],f.prototype,"poster",2);m([h()],f.prototype,"failed",2);m([h()],f.prototype,"table",2);m([h()],f.prototype,"mediaMode",2);m([h()],f.prototype,"media",2);f=m([N("wiskey-stations")],f);export{f as WiskeyStations};
//# sourceMappingURL=wiskey-stations-CqsqdXw1.js.map
