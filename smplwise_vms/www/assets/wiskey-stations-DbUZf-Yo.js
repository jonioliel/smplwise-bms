import{E as q,F as g,G as u,a as M,b_ as St,Y as ye,K as $e,A as l,e as o,H as I,af as U,b$ as st,$ as nt,j as H,g as xe,l as C,c0 as zt,c1 as Ct,c2 as Tt,bV as Ot,P as Oe,c3 as At,c4 as re,c5 as Et,c6 as Pt,c7 as Ae,i as Z,a9 as Dt,c8 as Lt,c9 as Nt,ca as Rt,cb as Mt,a7 as It,cc as at,cd as he,a4 as it,ce as Ee,n as Ft,cf as qt,cg as Ht,ch as jt,ci as Wt,aX as Pe,cj as Bt,ck as Ut,cl as Kt,ab as Vt,bF as De,cm as Le,b0 as Yt,r as Gt}from"./index-D4Q_hjW4.js";import"./sw-table-BGr-CuXa.js";import"./sw-place-tree-Bv6aQmgP.js";import"./sw-view-switch-i9aQj_wD.js";import{a as Zt,g as ot,b as rt,c as Jt,d as Xt}from"./access-stations-BmTMnTrk.js";import{T as Ne,p as Qt,r as es,l as ts,t as ss,a as ne,f as Re}from"./tts-default-BdUzH1g6.js";import{a as ns,w as S,t as Me,T as ae,c as Ie,f as p,b as lt,s as as,n as is,l as os,d as rs,e as ls,g as ds,h as cs,A as hs,i as us,U as ps,j as X,k as me,m as K,p as ue,o as Q,q as _e,r as Se,u as pe,v as dt,x as W,y as fe,z as ct,B as ws,C as ms,D as fs,E as gs,F as vs,G as bs,H as ht,P as ks,I as Fe,J as ys,K as $s,L as xs,M as _s,N as Ss,O as zs,Q as Cs,R as Ts,S as Os,V as As,W as Es,X as Ps,Y as Ds,Z as Ls,_ as Ns,$ as Rs,a0 as Ms,a1 as Is,a2 as Fs}from"./access-parity-t9YWuJV9.js";import"./wk-talk-button-C35cFyRR.js";import"./wk-deep-links-UTM7c-Ji.js";import{v as qs}from"./wiskey-validation-KfmTZ1pU.js";import"./sw-logo-art-Va6y_cIM.js";import"./schedules-logic-B_wmd4f6.js";import"./wiskey-format-DJ4vUeXA.js";import"./deep-links-DcLXvoYw.js";var Hs=Object.defineProperty,js=Object.getOwnPropertyDescriptor,y=(e,t,s,n)=>{for(var a=n>1?void 0:n?js(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&Hs(t,s,a),a};const Ws=6e4;let b=class extends M{constructor(){super(...arguments),this.open=!1,this.stations=[],this.places=null,this.scope="scope",this.phrases=[],this.preselect="",this.tts={},this.engines=null,this.enginesNote="",this.engine="",this.language="",this.message="",this.choice="",this.sending=!1,this.result=null,this.locked=!1,this.retryAt=0,this.more=!1,this.sent=[],this.fixed=Ne,this.preselected="",this.missingEngine=null,this.missingLanguage=null,this.loadedEngines=!1,this.enginesAt=0,this.timer=0}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("open")&&this.open&&this.reset()}updated(e){e.has("open")&&this.open&&(!this.loadedEngines||Date.now()-this.enginesAt>Ws?this.loadEngines():this.applyFixed())}reset(){this.message="",this.result=null,this.locked=!1,this.retryAt=0,this.sending=!1,this.more=!1,this.sent=[],this.choice=this.choices()[0]?.key??""}online(){return this.stations.filter(e=>e.online)}choices(){return ns(this.online(),this.places,this.scope,this.preselect||void 0)}current(){const e=this.choices();return e.find(t=>t.key===this.choice)??e[0]}async loadEngines(){this.loadedEngines=!0,this.enginesAt=Date.now(),this.enginesNote="";try{const e=await St();e.tts&&e.tts.engines.length?(this.engines=e.tts,await this.applyFixed()):e.tts?this.enginesNote=S().announceDlg.noEngine:this.enginesNote=e.state==="unsupported"?S().announceDlg.enginesUnsupported:S().announceDlg.noEngine}catch(e){this.enginesNote=ye(e),this.loadedEngines=!1}}async applyFixed(){if(!this.engines?.engines.length)return;try{this.fixed=Qt(await $e())}catch{this.fixed=Ne}const e=es(this.engines,this.fixed);this.engine=e.engine,this.language=e.language,this.preselected=e.engine,this.missingEngine=e.missingEngine,this.missingLanguage=e.missingLanguage,e.missingEngine&&(this.more=!0)}pickEngine(e){this.engine=e,this.language=ts(this.engines,e,this.fixed),this.missingLanguage=null}busySeconds(){return Math.max(0,Math.ceil((this.retryAt-Date.now())/1e3))}startRetryClock(){window.clearInterval(this.timer),this.timer=window.setInterval(()=>{this.busySeconds()<=0?(window.clearInterval(this.timer),this.retryAt=0):this.requestUpdate()},1e3)}ready(){const e=Me(this.message);return!!this.engine&&e>0&&e<=ae&&!this.sending&&!this.locked&&this.busySeconds()===0&&!!this.current()?.stationIds.length}async send(){const e=this.current(),t=Ie(this.message);if(!this.ready()||!e)return;const s=S().announceDlg,n=e.stationIds.filter(r=>this.online().some(d=>d.id===r));if(!n.length){this.result={tone:"warn",text:s.noTargets};return}this.sending=!0,this.result=null;let a=[];try{a=await Zt({stationIds:n,engine_id:this.engine,language:this.language||null,message:t})}finally{this.sending=!1}for(const r of a)r.status&&this.dispatchEvent(new CustomEvent("tts-status",{detail:r.status,bubbles:!0,composed:!0}));this.sent=a.filter(r=>r.outcome==="sent").map(r=>r.station_id),this.result=this.summarize(a),a.some(r=>r.outcome==="unknown")&&(this.locked=!0);const i=a.filter(r=>r.code==="audio_busy").map(r=>r.retry_after_s??10);i.length&&!this.locked&&(this.retryAt=Date.now()+Math.min(...i)*1e3,this.startRetryClock())}summarize(e){const t=S().announceDlg,s=e.filter(i=>i.outcome==="sent"),n=e.filter(i=>i.outcome!=="sent"),a=i=>this.stations.find(r=>r.id===i)?.name??i;return n.length?e.some(i=>i.outcome==="unknown")?{tone:"warn",text:s.length?p(t.partial,{ok:s.length,bad:n.length,names:n.map(i=>a(i.station_id)).join(", ")})+" · "+t.unknown:t.unknown}:s.length?{tone:"warn",text:p(t.partial,{ok:s.length,bad:n.length,names:n.map(i=>a(i.station_id)).join(", ")})}:n.every(i=>i.code==="audio_busy")?{tone:"warn",text:t.busy}:{tone:"err",text:n[0].error??t.failed}:{tone:"ok",text:s.length===1?t.sentOne:p(t.sentMany,{n:s.length})}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}progress(){if(this.sent.length!==1)return"";const e=this.tts[this.sent[0]];return e?lt(e):""}renderResult(){if(!this.result)return l;const e=S().announceDlg,t=this.busySeconds(),s=this.progress()&&this.result.tone==="ok"?this.progress():this.result.text;return o`<div class="result ${this.result.tone}" role="status" data-wk-announce-result data-tone=${this.result.tone}>${s}${t>0?o` · ${p(e.busyIn,{n:t})}`:l}</div>`}render(){const e=S().announceDlg,t=ss().dialog,s=this.choices(),n=this.current(),a=Me(this.message),r=this.engines?.engines.find(h=>h.engine_id===this.engine)?.supported_languages??[],d=this.phrases.length?this.phrases:e.phraseList,c=this.result?.tone==="ok"&&this.sent.length>0;return o`<sw-dialog ?open=${this.open} wide ?locked=${this.sending} heading=${e.title} data-wk-announce-dialog @close=${()=>this.close()}>
      <div class="body">
        <div class="fld">
          <label>${e.to}</label>
          <div class="chips" role="group" aria-label=${e.to}>
            ${s.length?s.map(h=>o`<button type="button" class="chip" data-wk-target=${h.key} aria-pressed=${String(h.key===n?.key)} ?disabled=${this.sending} @click=${()=>this.choice=h.key}>
                    ${h.kind==="station"?o`<sw-icon name="door" size=${14}></sw-icon>`:h.kind==="place"?o`<sw-icon name="pin" size=${14}></sw-icon>`:l}<span>${h.label}</span>
                  </button>`):o`<span class="note" data-wk-announce-notargets>${e.noTargets}</span>`}
          </div>
        </div>
        <div class="fld">
          <label for="msg">${e.message}</label>
          <textarea id="msg" data-wk-announce-message rows="3" maxlength=${ae*2} ?disabled=${this.sending||this.locked} .value=${this.message} @input=${h=>this.message=h.target.value}></textarea>
          <span class="cnt ${a>ae?"over":""}" aria-live="polite">${p(e.counter,{n:a,max:ae})}</span>
        </div>
        <div class="fld">
          <label>${e.phrases}</label>
          <div class="chips" role="group" aria-label=${e.phrases}>
            ${d.map(h=>o`<button type="button" class="chip" data-wk-phrase aria-pressed=${String(Ie(this.message)===h)} ?disabled=${this.sending||this.locked} @click=${()=>this.message=h}><span>${h}</span></button>`)}
          </div>
        </div>
        <div class="prev" data-wk-announce-preview>
          <sw-icon name="volume" size=${15}></sw-icon>
          <span>${p(e.preview,{lang:this.engine||!this.missingEngine?ne(this.language||"he"):"—",voice:e.voiceDefault,n:as(this.message)})}</span>
          <span class="sp"></span>
          <wk-action-button tone="quiet" data-wk-announce-more aria-expanded=${String(this.more)} @click=${()=>this.more=!this.more}>${e.more}</wk-action-button>
        </div>
        ${this.missingEngine?o`<div class="result warn" role="status" data-wk-announce-engine-missing>${Re(t.missingEngine,{engine:this.missingEngine})}</div>`:l}
        ${this.more?o`<div class="engine" data-wk-announce-engine>
                ${this.missingLanguage&&this.language?o`<div class="result warn" role="status" data-wk-announce-language-missing>${Re(t.missingLanguage,{language:ne(this.missingLanguage),auto:ne(this.language)})}</div>`:l}
                ${this.engines?.engines.length?o`<sw-field label=${e.engine}>
                        <select data-wk-engine .value=${this.engine} @change=${h=>this.pickEngine(h.target.value)}>
                          ${this.engine?l:o`<option value="" selected disabled>${t.pickEngine}</option>`}
                          ${this.engines.engines.map(h=>o`<option value=${h.engine_id} ?selected=${h.engine_id===this.engine}>${h.engine_id===this.fixed.engine?`${h.name} · ${t.fixedTag}`:h.name}</option>`)}
                        </select>
                      </sw-field>
                      ${r.length?o`<sw-field label=${e.language}>
                            <select data-wk-language .value=${this.language} @change=${h=>this.language=h.target.value}>
                              ${r.map(h=>o`<option value=${h} ?selected=${h===this.language}>${ne(h)}</option>`)}
                            </select>
                          </sw-field>`:l}`:o`<span class="note">${this.enginesNote||e.enginesLoading}</span>`}
                ${this.engine&&this.preselected&&this.engine!==this.preselected?o`<span class="note" style="grid-column:1/-1" data-wk-announce-override>${t.overridden}</span>`:l}
                <span class="note" style="grid-column:1/-1">${e.external}</span>
              </div>`:!this.engines&&this.enginesNote?o`<div class="result warn" role="status" data-wk-announce-engines-state>${this.enginesNote}</div>`:l}
        ${this.renderResult()}
      </div>
      <div slot="footer">
        <wk-action-button tone="primary" icon="volume" data-wk-announce-send ?disabled=${!this.ready()} ?busy=${this.sending} @click=${()=>void this.send()}>${this.sending?e.sending:c?e.sendAgain:e.send}</wk-action-button>
        <wk-action-button data-wk-announce-close ?disabled=${this.sending} @click=${()=>this.close()}>${c?e.close:e.cancel}</wk-action-button>
      </div>
    </sw-dialog>`}};b.styles=q`
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
    .engine .result {
      grid-column: 1 / -1;
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
  `;y([g({type:Boolean,reflect:!0})],b.prototype,"open",2);y([g({attribute:!1})],b.prototype,"stations",2);y([g({attribute:!1})],b.prototype,"places",2);y([g()],b.prototype,"scope",2);y([g({attribute:!1})],b.prototype,"phrases",2);y([g()],b.prototype,"preselect",2);y([g({attribute:!1})],b.prototype,"tts",2);y([u()],b.prototype,"engines",2);y([u()],b.prototype,"enginesNote",2);y([u()],b.prototype,"engine",2);y([u()],b.prototype,"language",2);y([u()],b.prototype,"message",2);y([u()],b.prototype,"choice",2);y([u()],b.prototype,"sending",2);y([u()],b.prototype,"result",2);y([u()],b.prototype,"locked",2);y([u()],b.prototype,"retryAt",2);y([u()],b.prototype,"more",2);y([u()],b.prototype,"sent",2);y([u()],b.prototype,"fixed",2);y([u()],b.prototype,"preselected",2);y([u()],b.prototype,"missingEngine",2);y([u()],b.prototype,"missingLanguage",2);b=y([I("wk-announce-dialog")],b);const ut=["sync","rescan","health_refresh","clock_refresh"],pt=e=>`access-control/stations/${encodeURIComponent(e)}/maintenance`,Bs=15e3,Us=e=>xe(pt(e)),wt=(e,t)=>U(`${pt(e)}/${t}`,{confirmed:!0,client_request_id:nt(),expires_at:new Date(st()+Bs).toISOString().replace(/\.\d{3}Z$/,"Z")});function Ks(e,t,s){if(e instanceof H){const n=e.body?.details??{},a=String(n.outcome??""),i=a==="refused"?"failed":a==="not_sent"?"not_sent":a==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",r=Number(n.retry_after_s);return{station_id:t,action:s,status:i,code:String(n.wiskey_code??e.code??"")||null,retry_after_s:Number.isFinite(r)&&r>=0?r:null,data:null}}return{station_id:t,action:s,status:"unknown",code:"network",retry_after_s:null,data:null}}async function mt(e,t,s=wt){try{const n=await s(e,t);return{station_id:e,action:t,status:n.status,code:null,retry_after_s:null,data:n.data??null}}catch(n){return Ks(n,e,t)}}async function Vs(e,t,s=()=>{},n=wt,a=250,i=r=>new Promise(d=>setTimeout(d,r))){const r=[];for(let d=0;d<e.length;d++){d>0&&a>0&&await i(a);const c=await mt(e[d],t,n);r.push(c),s(c,d)}return r}function qe(e,t,s){return e.filter(n=>t.has(n.id)&&(s==="sync"||n.online)).map(n=>n.id)}function ge(e,t){return e?t.reasons[e]??e:""}function ve(e,t,s){const n=ge(t,s)||s.none;return e==="failed"?p(s.status.failed,{reason:n}):e==="not_sent"?p(s.status.not_sent,{reason:n}):s.status[e]}function be(e){return e==="acknowledged"||e==="completed"?"ok":e==="failed"?"err":e==="sending"||e==="sent"?"busy":"warn"}function Ys(e){const t={ok:0,failed:0,not_sent:0,unknown:0};for(const s of e)s.status==="acknowledged"||s.status==="completed"?t.ok++:s.status==="failed"?t.failed++:s.status==="not_sent"?t.not_sent++:t.unknown++;return t}function Gs(e){const t=e?.auth_seen??null,s=e?.report?.auth?.last_failure??null;return t?s&&String(s.at??"")>=String(t.at??"")?s:t:s}function Zs(e,t){const s=[],n=e?.report?.auth,a=e?.technical?.event_status?.stream;return(n?.sync_now||e?.technical?.last_error==="authentication_failed")&&s.push(t.authSources.sync),(n?.event_stream_now||a==="authentication_failed")&&s.push(t.authSources.event_stream),n?.event_history_now&&s.push(t.authSources.event_history),s}function Js(e,t){return e?t.steps[e]??t.steps.other:""}const Xs={title:"תחזוקה",listButton:"תחזוקה",listTitle:"תחזוקת עמדות",refresh:"רענון נתונים",loading:"טוען את מצב העמדה…",unavailable:"מצב העמדה אינו זמין כרגע.",healthHidden:"פרטי הבריאות של העמדה מוצגים רק למי שמורשה לצפות במצב המערכת.",actions:{sync:"סנכרן עכשיו",rescan:"סריקה מחדש",health_refresh:"רענון בריאות",clock_refresh:"בדיקת שעון"},confirm:{sync:{title:"לסנכרן את העמדה עכשיו?",one:"אנשים, כרטיסים והרשאות שממתינים יישלחו לעמדה {name}. הסנכרון נכנס לתור ומתבצע ברקע."},rescan:{title:"לסרוק את העמדה מחדש?",one:"היכולות ורשימת המשתמשים יקראו מחדש מהעמדה {name}. שום דבר לא נכתב לעמדה."},health_refresh:{title:"לרענן את בריאות העמדה?",one:"השעון ונתוני המדיה של העמדה {name} ייקראו מחדש מהמכשיר (עד חצי דקה)."},clock_refresh:{title:"לבדוק את שעון העמדה?",one:"השעון של העמדה {name} ייקרא מחדש. השעה בעמדה לא משתנה."},many:"הפעולה תישלח פעם אחת לכל עמדה מתוך {n} העמדות שנבחרו, אחת אחרי השנייה.",send:"שלח",cancel:"ביטול"},rows:{lastSync:"סנכרון אחרון",lastScan:"קריאה אחרונה מהעמדה",stream:"זרם אירועים",clock:"שעון",lastError:"שגיאה אחרונה",auth:"כשל הזדהות",polls:"כשלי תקשורת רצופים"},stream:{connected:"מחובר",connecting:"מתחבר",disconnected:"מנותק",authentication_failed:"נכשל בהזדהות",unavailable:"לא זמין",stopped:"עצור",unknown:"לא ידוע"},clockOk:"תקין",clockSkew:"סטייה של {n} שניות",clockStatus:{ready:"נמדד",stale:"מדידה ישנה",unavailable:"לא נמדד"},never:"אין עדיין",none:"אין",authNone:"לא נראה מאז שהמערכת עלתה",authLine:"{source} · שלב: {step} · {at}",authObserved:"{source} · נראה ב־{at}",authCount:"{n} כשלים ברשומות האחרונות",authNow:"כרגע: {what}",authCode:"קוד מהמכשיר {code}",authSources:{sync:"סנכרון",event_stream:"זרם האירועים",event_history:"השלמת היסטוריית אירועים",station_sync:"סנכרון העמדה"},steps:{queued:"בתור",identity:"זיהוי העמדה",capabilities:"קריאת יכולות",inventory:"קריאת משתמשים מהעמדה",person_read:"קריאת אדם",reconcile:"התאמה",journal:"רישום",create_person:"הוספת אדם",update_person:"עדכון אדם",delete_person:"מחיקת אדם",create_card:"הוספת כרטיס",update_card:"עדכון כרטיס",delete_card:"מחיקת כרטיס",readback:"אימות",complete:"סיום",other:"שלב אחר"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"התקבל - הסנכרון בתור",completed:"הושלם",failed:"נכשל: {reason}",not_sent:"לא נשלח: {reason}",unknown:"נשלח, אין תשובה ברורה - ייתכן שבוצע"},lastRun:"פעם אחרונה: {status} · {at}",cooldown:"אפשר שוב בעוד {n} שניות",offlineHint:"העמדה לא מחוברת - אפשר רק לבקש סנכרון.",reasons:{authentication_failed:"העמדה דחתה את פרטי ההתחברות",connection_failed:"אין חיבור לעמדה",device_busy:"העמדה עסוקה",device_unavailable:"העמדה לא זמינה",station_offline:"העמדה לא מחוברת",intercom_station_offline:"העמדה לא מחוברת",station_unloaded:"העמדה לא טעונה במערכת האינטרקום",station_not_found:"העמדה לא נמצאה",intercom_station_not_found:"העמדה לא נמצאה",manager_closed:"מערכת האינטרקום בעצירה",unauthorized:"מערכת האינטרקום לא אישרה את הפעולה",forbidden:"אין הרשאה לתחזוקת העמדה",confirmation_required:"חסר אישור",expired:"הבקשה פגה לפני שנשלחה",intercom_duplicate_command:"הפקודה כבר נשלחה",station_ops_cooldown:"נשלח לפני רגע",station_ops_rate_limited:"יותר מדי פקודות בזמן קצר",station_ops_busy:"פקודות אחרות עדיין רצות",intercom_busy:"מערכת האינטרקום עסוקה",intercom_rate_limited:"הגבלת קצב",rate_limited:"הגבלת קצב",busy:"מערכת האינטרקום עסוקה",intercom_unavailable:"מערכת האינטרקום לא זמינה",timeout:"לא התקבלה תשובה בזמן",clock_read_failed:"קריאת השעון נכשלה",operation_unsupported:"העמדה לא תומכת בפעולה",capacity_exhausted:"העמדה מלאה",network:"אין חיבור לשרת"},bulk:{pickAction:"פעולה",pickStations:"עמדות",all:"בחר הכל",clear:"נקה",selected:"{n} נבחרו",offline:"לא מחוברת",next:"המשך",back:"חזרה",close:"סגור",running:"שולח {i} מתוך {n}…",summary:"{ok} הצליחו · {failed} נכשלו · {not_sent} לא נשלחו · {unknown} ללא תשובה",noneSelected:"בחרו לפחות עמדה אחת.",offlineSkipped:"עמדות לא מחוברות לא ייכללו בפעולה הזו."}},Qs={title:"Maintenance",listButton:"Maintenance",listTitle:"Station maintenance",refresh:"Refresh data",loading:"Loading the station state…",unavailable:"The station state is not available right now.",healthHidden:"The station's health details are shown only to who may view the system status.",actions:{sync:"Sync now",rescan:"Rescan",health_refresh:"Refresh health",clock_refresh:"Check clock"},confirm:{sync:{title:"Sync the station now?",one:"Pending people, cards and permissions are sent to {name}. The sync is queued and runs in the background."},rescan:{title:"Rescan the station?",one:"Capabilities and the user list are read again from {name}. Nothing is written to the station."},health_refresh:{title:"Refresh the station's health?",one:"{name}'s clock and media details are read again from the device (up to half a minute)."},clock_refresh:{title:"Check the station's clock?",one:"{name}'s clock is read again. The station's time is not changed."},many:"The action is sent once to each of the {n} selected stations, one after the other.",send:"Send",cancel:"Cancel"},rows:{lastSync:"Last sync",lastScan:"Last read from the station",stream:"Event stream",clock:"Clock",lastError:"Last error",auth:"Sign-in failure",polls:"Failed polls in a row"},stream:{connected:"Connected",connecting:"Connecting",disconnected:"Disconnected",authentication_failed:"Sign-in failed",unavailable:"Unavailable",stopped:"Stopped",unknown:"Unknown"},clockOk:"OK",clockSkew:"{n} s off",clockStatus:{ready:"Measured",stale:"Old measurement",unavailable:"Not measured"},never:"None yet",none:"None",authNone:"Not seen since the system started",authLine:"{source} · step: {step} · {at}",authObserved:"{source} · seen at {at}",authCount:"{n} failures in the recent records",authNow:"Now: {what}",authCode:"device code {code}",authSources:{sync:"Sync",event_stream:"Event stream",event_history:"Event history",station_sync:"Station sync"},steps:{queued:"Queued",identity:"Station identity",capabilities:"Capabilities",inventory:"Reading users",person_read:"Reading a person",reconcile:"Reconcile",journal:"Journal",create_person:"Adding a person",update_person:"Updating a person",delete_person:"Removing a person",create_card:"Adding a card",update_card:"Updating a card",delete_card:"Removing a card",readback:"Verification",complete:"Complete",other:"Other step"},status:{sending:"Sending…",sent:"Sent, waiting for the answer",acknowledged:"Accepted - the sync is queued",completed:"Done",failed:"Failed: {reason}",not_sent:"Not sent: {reason}",unknown:"Sent, no clear answer - it may have run"},lastRun:"Last time: {status} · {at}",cooldown:"Again in {n} s",offlineHint:"The station is offline - only a sync can be requested.",reasons:{authentication_failed:"the station refused the sign-in",connection_failed:"no connection to the station",device_busy:"the station is busy",device_unavailable:"the station is unavailable",station_offline:"the station is offline",intercom_station_offline:"the station is offline",station_unloaded:"the station is not loaded",station_not_found:"station not found",intercom_station_not_found:"station not found",manager_closed:"the intercom system is stopping",unauthorized:"the intercom system refused the action",forbidden:"no permission to maintain this station",confirmation_required:"not confirmed",expired:"the request expired before it was sent",intercom_duplicate_command:"already sent",station_ops_cooldown:"sent a moment ago",station_ops_rate_limited:"too many commands in a short time",station_ops_busy:"other commands are still running",intercom_busy:"the intercom system is busy",intercom_rate_limited:"rate limited",rate_limited:"rate limited",busy:"the intercom system is busy",intercom_unavailable:"the intercom system is unavailable",timeout:"no answer in time",clock_read_failed:"reading the clock failed",operation_unsupported:"the station does not support this",capacity_exhausted:"the station is full",network:"no connection to the server"},bulk:{pickAction:"Action",pickStations:"Stations",all:"Select all",clear:"Clear",selected:"{n} selected",offline:"offline",next:"Continue",back:"Back",close:"Close",running:"Sending {i} of {n}…",summary:"{ok} done · {failed} failed · {not_sent} not sent · {unknown} no answer",noneSelected:"Select at least one station.",offlineSkipped:"Offline stations are left out of this action."}};function N(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?Qs:Xs}var en=Object.defineProperty,tn=Object.getOwnPropertyDescriptor,D=(e,t,s,n)=>{for(var a=n>1?void 0:n?tn(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&en(t,s,a),a};let O=class extends M{constructor(){super(...arguments),this.stations=[],this.live=!0,this.open=!1,this.step="pick",this.action="sync",this.chosen=new Set,this.outcomes={},this.index=0,this.busy=!1,this.targets=[]}allowed(){return C("access.stations.manage")&&this.stations.length>0}openDialog(){this.open=!0,this.step="pick",this.outcomes={},this.index=0,this.chosen=new Set(this.stations.map(e=>e.id))}close(){this.busy||(this.open=!1)}toggle(e){const t=new Set(this.chosen);t.has(e)?t.delete(e):t.add(e),this.chosen=t}async send(){this.busy||(this.targets=qe(this.stations,this.chosen,this.action),this.targets.length&&(this.step="run",this.busy=!0,this.outcomes=Object.fromEntries(this.targets.map(e=>[e,{station_id:e,action:this.action,status:"sending",code:null,retry_after_s:null,data:null}])),await Vs(this.targets,this.action,(e,t)=>{this.outcomes={...this.outcomes,[e.station_id]:e},this.index=t+1}),this.busy=!1,this.dispatchEvent(new CustomEvent("stations-op",{detail:Object.values(this.outcomes),bubbles:!0,composed:!0}))))}willUpdate(){this.hidden=!this.allowed()}render(){if(!this.allowed())return l;const e=N();return o`<wk-action-button icon="wrench" data-wk-maint-list ?disabled=${!this.live} label=${e.listButton} @click=${()=>this.openDialog()}><span class="lbl">${e.listButton}</span></wk-action-button>
      ${this.open?this.renderDialog():l}`}renderDialog(){const e=N(),t=qe(this.stations,this.chosen,this.action),s=this.action!=="sync"&&this.stations.some(n=>this.chosen.has(n.id)&&!n.online);return o`<sw-dialog open ?locked=${this.busy} heading=${this.step==="confirm"?e.confirm[this.action].title:e.listTitle} data-wk-maint-dialog data-step=${this.step}
      @close=${n=>n.target===n.currentTarget&&this.close()}>
      <div class="body">
        ${this.step==="pick"?this.renderPick(s):this.step==="confirm"?o`<p class="sentence" data-wk-maint-many>${e.actions[this.action]} · ${p(e.confirm.many,{n:t.length})}</p>${s?o`<div class="note">${e.bulk.offlineSkipped}</div>`:l}`:this.renderRun()}
      </div>
      <div slot="footer">
        ${this.step==="pick"?o`<wk-action-button data-wk-maint-dialog-cancel @click=${()=>this.close()}>${e.confirm.cancel}</wk-action-button>
              <wk-action-button tone="primary" data-wk-maint-next ?disabled=${!t.length} @click=${()=>this.step="confirm"}>${e.bulk.next}</wk-action-button>`:this.step==="confirm"?o`<wk-action-button data-wk-maint-back @click=${()=>this.step="pick"}>${e.bulk.back}</wk-action-button>
                <wk-action-button tone="primary" icon="wrench" data-wk-maint-send-many ?disabled=${!this.live||!t.length} @click=${()=>void this.send()}>${e.confirm.send}</wk-action-button>`:o`<wk-action-button data-wk-maint-done ?disabled=${this.busy} @click=${()=>this.close()}>${e.bulk.close}</wk-action-button>`}
      </div>
    </sw-dialog>`}renderPick(e){const t=N();return o`<div class="lab">${t.bulk.pickAction}</div>
      <div class="chips" role="radiogroup" aria-label=${t.bulk.pickAction}>
        ${ut.map(s=>o`<button type="button" class="chip" role="radio" aria-checked=${String(this.action===s)} aria-pressed=${String(this.action===s)} data-wk-maint-action=${s} @click=${()=>this.action=s}>
            ${t.actions[s]}
          </button>`)}
      </div>
      <div class="tools">
        <span class="lab">${t.bulk.pickStations}</span><span class="sp"></span>
        <span data-wk-maint-count>${p(t.bulk.selected,{n:this.chosen.size})}</span>
        <wk-action-button tone="quiet" data-wk-maint-all @click=${()=>this.chosen=new Set(this.stations.map(s=>s.id))}>${t.bulk.all}</wk-action-button>
        <wk-action-button tone="quiet" data-wk-maint-clear @click=${()=>this.chosen=new Set}>${t.bulk.clear}</wk-action-button>
      </div>
      <div class="list" data-wk-maint-stations>
        ${this.stations.map(s=>{const n=!s.online&&this.action!=="sync";return o`<div class="row" aria-disabled=${String(n)} data-wk-maint-station=${s.id}>
            <label><input type="checkbox" .checked=${this.chosen.has(s.id)} ?disabled=${n} @change=${()=>this.toggle(s.id)} /><span class="nm">${s.name}</span></label>
            ${s.online?l:o`<span class="st">${t.bulk.offline}</span>`}
          </div>`})}
      </div>
      ${this.chosen.size?e?o`<div class="note">${t.bulk.offlineSkipped}</div>`:l:o`<div class="note" role="status">${t.bulk.noneSelected}</div>`}`}renderRun(){const e=N(),t=new Map(this.stations.map(i=>[i.id,i.name])),s=this.targets.map(i=>this.outcomes[i]).filter(Boolean),n=s.filter(i=>i.status!=="sending"),a=Ys(n);return o`<div class="summary" role="status" data-wk-maint-progress>
        ${this.busy?p(e.bulk.running,{i:Math.min(this.index+1,this.targets.length),n:this.targets.length}):p(e.bulk.summary,{...a})}
      </div>
      <div class="list" data-wk-maint-results>
        ${s.map(i=>o`<div class="row" data-wk-maint-row=${i.station_id} data-status=${i.status}>
            <span class="nm">${t.get(i.station_id)??i.station_id}</span>
            <span class="st" data-tone=${be(i.status)}>${ve(i.status,i.code,e)}</span>
          </div>`)}
      </div>`}};O.styles=q`
    :host {
      display: inline-flex;
    }
    :host([hidden]) {
      display: none;
    }
    .lbl {
      display: inline;
    }
    @media (max-width: 600px) {
      .lbl {
        display: none;
      }
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .lab {
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
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: var(--sw-touch-desktop, 44px);
      padding-inline: var(--sw-s-3h, 14px);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-medium);
    }
    .chip:focus-visible,
    .row:focus-within {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset, 2px);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-block-size: 40vh;
      overflow: auto;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      min-block-size: 40px;
      padding-inline: var(--sw-s-2);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .row label {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex: 1 1 auto;
      min-inline-size: 0;
      cursor: pointer;
    }
    .row input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
    }
    .row .nm {
      flex: 1 1 auto;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .st {
      flex: none;
      max-inline-size: 60%;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: end;
      overflow-wrap: anywhere;
    }
    .row .st[data-tone='ok'] {
      color: var(--sw-success-text, var(--sw-text-2));
    }
    .row .st[data-tone='err'] {
      color: var(--sw-danger-text);
    }
    .row .st[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .row[aria-disabled='true'] {
      opacity: 0.6;
    }
    .tools {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tools .sp {
      flex: 1 1 auto;
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    .sentence {
      margin: 0;
      font-size: var(--sw-fs-base);
      line-height: 1.5;
    }
    .summary {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
  `;D([g({attribute:!1})],O.prototype,"stations",2);D([g({type:Boolean})],O.prototype,"live",2);D([u()],O.prototype,"open",2);D([u()],O.prototype,"step",2);D([u()],O.prototype,"action",2);D([u()],O.prototype,"chosen",2);D([u()],O.prototype,"outcomes",2);D([u()],O.prototype,"index",2);D([u()],O.prototype,"busy",2);D([u()],O.prototype,"targets",2);O=D([I("wk-stations-maintenance")],O);function sn(e){const t=~e&255,s=t&128,n=t>>4&7,i=((t&15)<<3)+132<<n;return s?132-i:i-132}function nn(e){const t=e^85,s=(t&112)>>4;let n=(t&15)<<4;return s===0?n+=8:s===1?n+=264:n=n+264<<s-1,(t&128)!==0?n:-n}function an(e,t="pcmu"){const s=new Float32Array(e.length),n=t==="pcma"?nn:sn;for(let a=0;a<e.length;a+=1)s[a]=n(e[a]&255)/32768;return s}function on(e){if(!e.length)return 0;let t=0;for(let s=0;s<e.length;s+=1)t+=e[s]*e[s];return Math.min(1,Math.sqrt(t/e.length)*4)}function rn(e,t){if(t<=0)return e;const s=e*.5**(t/150);return s<.01?0:s}const He={intercom_listen_busy:"busy",intercom_listen_user_busy:"user_busy",intercom_listen_unsupported:"unsupported",intercom_listen_no_listen:"no_listen",intercom_listen_off:"off",intercom_station_offline:"offline",intercom_listen_unavailable:"unavailable",intercom_unavailable:"unavailable",intercom_station_not_found:"unavailable",forbidden:"forbidden"};function ln(e){if(e instanceof H){if(He[e.code])return He[e.code];if(e.status===403)return"forbidden";if(e.status===0)return"network"}return e instanceof TypeError?"network":"failed"}function dn(e){switch(e){case"ended":case"stopped":return null;case"expired":return"expired";case"access_lost":return"access_lost";case"upstream_closed":case"upstream_unavailable":return"upstream";case"network":return"network";default:return"failed"}}class cn{constructor(t,s){this.stationId=t,this.deps=s,this.phase="idle",this.problem=null,this.outcome=null,this.muted=!1,this.endsAt=0,this.starts=0,this.frames=0,this.level=0,this.levelAt=0,this.gen=0,this.reply=null,this.ws=null,this.sink=null,this.codec="pcmu",this.rate=8e3}secondsLeft(){return this.phase==="listening"?Math.max(0,Math.ceil((this.endsAt-this.deps.now())/1e3)):null}levelNow(){return this.phase==="listening"?rn(this.level,this.deps.now()-this.levelAt):0}async start(){if(this.phase!=="idle")return;this.problem=null;const t=this.deps.sink();if(!t){this.problem="no_audio",this.deps.changed();return}this.sink=t,t.setMuted(this.muted),this.phase="starting";const s=++this.gen;this.deps.changed();let n;try{this.starts+=1,n=await this.deps.start(this.stationId,this.deps.requestId())}catch(i){s===this.gen&&this.fail(ln(i));return}if(s!==this.gen){this.deps.stop(n.session).catch(()=>{});return}this.reply=n,this.codec=n.codec,this.rate=n.sample_rate,this.endsAt=this.deps.now()+n.max_seconds*1e3;let a;try{a=this.deps.socket(n.ws_path)}catch{this.deps.stop(n.session).catch(()=>{}),this.fail("network");return}a.binaryType="arraybuffer",this.ws=a,a.onmessage=i=>{if(s!==this.gen)return;if(typeof i.data!="string"){this.phase==="listening"&&this.onFrame(i.data);return}let r;try{r=JSON.parse(i.data)}catch{return}r.type==="listen/state"&&r.value==="open"&&this.phase==="starting"?(this.phase="listening",this.levelAt=this.deps.now(),this.deps.changed()):r.type==="listen/closed"&&this.finish(String(r.value??"ended"))},a.onclose=i=>{s===this.gen&&this.finish(zt(i.code))},a.onerror=()=>{}}setMuted(t){this.muted=t,this.sink?.setMuted(t),this.deps.changed()}stop(){if(this.phase==="idle")return;const t=this.ws,s=this.reply;t&&t.readyState===1?t.send(JSON.stringify({type:"listen/stop"})):s&&this.deps.stop(s.session).catch(()=>{}),this.finish("ended")}dispose(){this.stop()}onFrame(t){const s=an(new Uint8Array(t),this.codec);this.frames+=1,this.level=on(s),this.levelAt=this.deps.now(),this.sink?.play(s,this.rate)}teardown(){this.gen+=1;const t=this.ws;if(this.ws=null,t){t.onmessage=null,t.onclose=null,t.onerror=null;try{t.close()}catch{}}this.sink?.close(),this.sink=null,this.reply=null,this.endsAt=0,this.level=0}fail(t){this.teardown(),this.phase="idle",this.problem=t,this.outcome=null,this.deps.changed()}finish(t){this.teardown(),this.phase="idle",this.outcome=t,this.problem=dn(t),this.deps.changed()}}const hn=.06,un=.3;function pn(e,t){const s=Math.max(t,e+hn);return s-e>un?null:s}function wn(){const e=globalThis.AudioContext??globalThis.webkitAudioContext;if(!e)return null;let t;try{t=new e}catch{return null}t.resume().catch(()=>{});const s=t.createGain();s.connect(t.destination);let n=0;return{play(a,i){const r=pn(t.currentTime,n);if(r===null)return;const d=t.createBuffer(1,a.length,i);d.copyToChannel(a,0);const c=t.createBufferSource();c.buffer=d,c.connect(s),c.start(r),n=r+d.duration},setMuted(a){s.gain.value=a?0:1},close(){t.close().catch(()=>{})}}}var mn=Object.defineProperty,fn=Object.getOwnPropertyDescriptor,V=(e,t,s,n)=>{for(var a=n>1?void 0:n?fn(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&mn(t,s,a),a};let R=class extends M{constructor(){super(...arguments),this.stationId="",this.live=!0,this.deps=null,this.capability=null,this.tick=0,this.session=null,this.timer=0,this.loadedFor=""}realDeps(){const e=this.deps??{};return{start:e.start??((t,s)=>ls(t,s)),stop:e.stop??(t=>rs(t)),socket:e.socket??(t=>new WebSocket(os(t))),sink:e.sink??(()=>wn()),requestId:e.requestId??(()=>is()),now:e.now??(()=>Date.now()),changed:()=>{this.tick+=1,this.syncTimer()}}}ensureSession(){return(!this.session||this.session.stationId!==this.stationId)&&(this.session?.dispose(),this.session=new cn(this.stationId,this.realDeps())),this.session}syncTimer(){const e=this.session?.phase==="listening";e&&!this.timer?this.timer=window.setInterval(()=>this.tick+=1,150):!e&&this.timer&&(window.clearInterval(this.timer),this.timer=0)}willUpdate(e){(e.has("stationId")||e.has("live"))&&this.stationId&&this.live&&!this.deps?.start&&this.loadedFor!==this.stationId&&!this.capability&&(this.loadedFor=this.stationId,ds(this.stationId).then(t=>{this.loadedFor===this.stationId&&(this.capability=t)}).catch(()=>{}))}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,this.timer&&window.clearInterval(this.timer),this.timer=0}get offered(){const e=this.session,t=e!==null&&e.phase!=="idle";return this.live&&(t||!!e?.problem||!!this.capability?.available)}updated(e){super.updated(e),this.toggleAttribute("hidden",!this.offered)}toggle(){const e=this.ensureSession();e.phase==="idle"?e.start():e.stop()}render(){const e=this.session;if(!this.offered)return l;const t=cs(),s=e?.phase??"idle",n=e?.secondsLeft(),a=Math.round((e?.levelNow()??0)*100),i=s==="starting"?t.starting:s==="listening"?`${t.listening}${n!=null?` · ${Ct(t.left,{t:Tt(n)})}`:""}`:"";return o`
      <div class="row" data-wk-listen>
        <button class="main" type="button" data-wk-listen-toggle aria-pressed=${String(s!=="idle")} @click=${()=>this.toggle()}>
          <sw-icon name=${s==="idle"?"volume":"hangup"} size=${18}></sw-icon>
          ${s==="idle"?t.start:t.stop}
        </button>
        ${s==="listening"?o`<button type="button" data-wk-listen-mute aria-pressed=${String(e.muted)} aria-label=${e.muted?t.unmute:t.mute} @click=${()=>e.setMuted(!e.muted)}>
              ${e.muted?t.unmute:t.mute}
            </button>`:l}
      </div>
      ${s==="listening"?o`<div class="meter ${e.muted?"muted":""}" role="meter" aria-label=${t.level} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${a} data-wk-listen-level>
            <i style=${`inline-size:${a}%`}></i>
          </div>`:l}
      ${i?o`<div class="msg" data-wk-listen-state>${i}${e?.muted?` · ${t.muted}`:""}</div>`:l}
      ${s==="idle"&&e?.problem?o`<div class="msg problem" data-wk-listen-problem role="status">${t.problems[e.problem]}</div>`:l}
      ${s==="idle"&&!e?.problem&&e?.outcome?o`<div class="msg" data-wk-listen-ended>${t.ended}</div>`:l}
    `}};R.styles=q`
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
  `;V([g()],R.prototype,"stationId",2);V([g({type:Boolean})],R.prototype,"live",2);V([g({attribute:!1})],R.prototype,"deps",2);V([g({attribute:!1})],R.prototype,"capability",2);V([u()],R.prototype,"tick",2);R=V([I("wk-listen-button")],R);var gn=Object.defineProperty,vn=Object.getOwnPropertyDescriptor,A=(e,t,s,n)=>{for(var a=n>1?void 0:n?vn(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&gn(t,s,a),a};let T=class extends M{constructor(){super(...arguments),this.stationId="",this.stationName="",this.media=null,this.poster="",this.live=!0,this.classicHref="",this.classicLabel="",this.talkHere=!0,this.profile=null,this.choice=Oe(null),this.mutedBefore=null,this.onOuterFloor=e=>{if(this.talkHere)return;e.detail?.stationId===this.stationId&&this.onFloor(e)},this.onFloor=e=>{const t=e.detail.held,s=this.player;!s||this.media?.talk?.duplex==="full"||(t?(this.mutedBefore=s.muted,s.muted=!0):this.mutedBefore!==null&&(s.muted=this.mutedBefore,this.mutedBefore=null))}}connectedCallback(){super.connectedCallback(),window.addEventListener("talk-floor",this.onOuterFloor),$e().then(e=>this.choice=Oe(e)).catch(()=>{})}disconnectedCallback(){window.removeEventListener("talk-floor",this.onOuterFloor),super.disconnectedCallback()}willUpdate(e){if(e.has("media")||e.has("stationId")){const t=this.media?.video?.profiles.map(s=>s.id)??[];(!this.profile||!t.includes(this.profile)||e.has("stationId"))&&(this.profile=At(this.media?.video??null))}}render(){const e=this.media,t=e?.video,s=re(),n=t?.profiles.find(c=>c.id===this.profile),a=n?t?.paths[n.id]:void 0,i=e?.talk,r=Object.fromEntries((t?.profiles??[]).map(c=>[c.id,c.transports])),d=n?Et(t?.transport?.choice??this.choice,n.id,r,t?.transport?.plans?.[n.id]??null):null;return o`
      ${a&&d?.blocked?o`<div class="frame" data-wk-live-frame data-profile=${n.id} data-wk-live-blocked>
            ${this.poster?o`<img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" />`:l}
            <div class="blocked" role="status"><sw-icon name="offline" size=${18}></sw-icon><span>${s.live.blocked}</span><span class="hint">${s.live.blockedHint}</span></div>
          </div>`:a&&d?o`<div class="frame" data-wk-live-frame data-profile=${n.id} data-transport-plan=${d.plan||d.mode}>
            <sw-live-player .livePath=${a} .profile=${n.id} .mode=${d.mode} .plan=${d.plan} .preferred=${d.plan?n.id:""} .poster=${this.poster} data-wk-live-player aria-label=${`${s.live.label} · ${this.stationName}`}></sw-live-player>
          </div>`:this.poster?o`<div class="frame" data-wk-live-frame data-profile=""><img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" /></div>`:l}
      ${t&&t.profiles.length>1&&a?o`<div class="bar">
            <span class="lbl" id="q">${s.live.quality}</span>
            <div class="seg" role="group" aria-labelledby="q" data-wk-quality>
              ${t.profiles.map(c=>o`<button type="button" data-profile=${c.id} aria-pressed=${String(c.id===this.profile)} @click=${()=>this.profile=c.id}>${c.id==="main"?s.live.main:s.live.sub}</button>`)}
            </div>
          </div>`:l}
      ${this.talkHere?i?.available?o`<wk-talk-button .stationId=${this.stationId} .talk=${i} .live=${this.live} data-wk-talk="native" @talk-floor=${this.onFloor}></wk-talk-button>`:this.classicHref?o`<wk-action-button tone="dashed" icon="window" block size="lg" href=${this.classicHref} data-wk-talk="classic">${this.classicLabel}</wk-action-button>`:l:l}
      ${e?.state==="ready"?o`<wk-listen-button .stationId=${this.stationId} .live=${this.live}></wk-listen-button>`:l}
    `}};T.styles=q`
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
    /* VIDEO-TRANSPORT-2400: the viewer's choice allows nothing this station offers - said on the still, never another transport */
    .blocked {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: var(--sw-s-1);
      padding: var(--sw-s-3);
      text-align: center;
      color: var(--sw-on-video);
      background: var(--sw-video-scrim-strong);
      font-size: var(--sw-fs-sm);
    }
    .blocked .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-on-video-2);
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
  `;A([g()],T.prototype,"stationId",2);A([g()],T.prototype,"stationName",2);A([g({attribute:!1})],T.prototype,"media",2);A([g()],T.prototype,"poster",2);A([g({type:Boolean})],T.prototype,"live",2);A([g()],T.prototype,"classicHref",2);A([g()],T.prototype,"classicLabel",2);A([g({type:Boolean})],T.prototype,"talkHere",2);A([u()],T.prototype,"profile",2);A([u()],T.prototype,"choice",2);A([Ot("sw-live-player")],T.prototype,"player",2);T=A([I("wk-station-live")],T);const bn=45e3,kn=12e4;function yn(e){const t=e instanceof H?Number(e.body?.details?.retry_after_s):NaN;return Number.isFinite(t)&&t>=0?Math.ceil(t*1e3):ps}function je(e,t=S()){return Pt(e)!=="unknown"?{tone:"err",text:ye(e),unknown:!1}:{tone:"warn",text:t.call.unknown,unknown:!0}}function $n(e,t=S()){const s={answer:t.call.answer,reject:t.call.reject,hangUp:t.call.hangUp},n=p(t.call.sent,{label:s[e.command]??e.command,ack:e.acknowledged===!0?t.call.ack:t.call.noAck});if(e.observation==="unavailable"||!e.observed_state)return`${n} · ${t.call.stateUnread}`;const a=X(e.observed_state,t);return`${n} · ${p(e.observation==="unchanged"?t.call.stateUnchanged:t.call.state,{state:a})}`}const xn=["started","generating","speaking","completed","closed"],We=e=>xn.indexOf(e.state);class de{constructor(t){this.deps=t,this.confirm=null,this.releasing=new Set,this.held={},this.results={},this.callBusy=new Set,this.armed=null,this.tts={},this.armTimer=0,this.holdTimer=0}dispose(){this.deps.cancel(this.armTimer),this.deps.cancel(this.holdTimer)}static key(t,s){return`${t}/${s}`}isHeld(t){return(this.held[t]??0)>this.deps.now()}setResult(t,s,n){this.results={...this.results,[t]:{tone:s,text:n,at:this.deps.now()}},this.deps.changed()}prune(){const t=this.deps.now(),s=Object.entries(this.results).filter(([,n])=>t-n.at<(n.tone==="warn"?kn:bn));s.length!==Object.keys(this.results).length&&(this.results=Object.fromEntries(s),this.deps.changed())}clearResult(t){if(!(t in this.results))return;const s={...this.results};delete s[t],this.results=s,this.deps.changed()}askRelease(t,s){const n=de.key(t,s);return!this.deps.live()||this.releasing.has(n)||this.isHeld(n)?!1:(this.confirm={stationId:t,lock:s},this.deps.changed(),!0)}cancelRelease(){this.confirm&&(this.confirm=null,this.deps.changed())}async confirmRelease(){const t=this.confirm;if(!t)return;const s=de.key(t.stationId,t.lock);if(!(!this.deps.live()||this.releasing.has(s)||this.isHeld(s))){this.releasing=new Set([...this.releasing,s]),this.deps.changed();try{await this.deps.release(t.stationId,t.lock),this.setResult(t.stationId,"ok",p(S().door.sentAt,{at:this.deps.stamp()}))}catch(n){const a=je(n);this.setResult(t.stationId,a.tone,a.unknown?S().door.unknown:a.text),(a.unknown||n instanceof H&&n.code==="intercom_release_in_progress")&&this.hold(s,yn(n))}finally{const n=new Set(this.releasing);n.delete(s),this.releasing=n,this.confirm===t&&(this.confirm=null),this.deps.changed()}}}hold(t,s){const n=this.deps.now()+s;this.held={...this.held,[t]:Math.max(this.held[t]??0,n)},this.deps.cancel(this.holdTimer);const a=Object.values(this.held).filter(i=>i>this.deps.now());a.length&&(this.holdTimer=this.deps.after(()=>{this.held={...this.held},this.deps.changed()},Math.min(...a)-this.deps.now()+50)),this.deps.changed()}tapCall(t,s,n=1){const a=this.deps.station(t);if(!a||this.callBusy.has(t)||!this.deps.live()||n>1)return;const i=this.armed;if(i&&i.id===t&&i.command===s&&i.callState===a.call_state){if(this.deps.tick()-i.at<hs)return;this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed(),this.sendCall(t,s);return}this.deps.cancel(this.armTimer),this.armed={id:t,command:s,at:this.deps.tick(),callState:a.call_state},this.armTimer=this.deps.after(()=>{this.armed=null,this.deps.changed()},us),this.deps.changed()}dropStaleArm(){const t=this.armed;if(!t)return;const s=this.deps.station(t.id);(!this.deps.live()||!s||!s.online||s.call_state!==t.callState)&&(this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed())}async sendCall(t,s){this.callBusy=new Set([...this.callBusy,t]),this.deps.changed();try{const n=await this.deps.signal(t,s);n.call&&this.setResult(t,n.call.acknowledged===!0?"ok":"warn",$n(n.call))}catch(n){const a=je(n);this.setResult(t,a.tone,a.text)}finally{const n=new Set(this.callBusy);n.delete(t),this.callBusy=n,this.deps.changed(),this.deps.refetch()}}noteTts(t){const s=this.tts[t.station_id];s&&s.at>=t.at&&We(s)>We(t)||(this.tts={...this.tts,[t.station_id]:t},this.deps.changed())}}const _n=q`
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
  /* WISKEY-TALK-DIAL-2382 (owner 03.11, Q2): the dial is Arx's talk; the classic panel is a small secondary link under it, at the end */
  .dialnative {
    display: grid;
    gap: var(--sw-s-1);
    min-inline-size: 0;
  }
  .dialnative > wk-action-button {
    justify-self: end;
  }
  /* WISKEY-TALK-DIAL-2382: why the drawer cannot dial from this screen - one sentence that wraps (never cut), the classic panel beside it */
  .cs.dialwhy {
    flex: 1 1 14em;
    white-space: normal;
    font-size: var(--sw-fs-sm);
    line-height: 1.4;
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
`,ee=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],j=e=>`access-control/stations/${encodeURIComponent(e)}`,Sn=15e3,te=()=>({confirmed:!0,client_request_id:nt(),expires_at:new Date(st()+Sn).toISOString().replace(/\.\d{3}Z$/,"Z")}),zn=e=>xe(`${j(e)}/door-tech`),Cn=(e,t)=>xe(`${j(e)}/doors/${t}/hold`),Tn=(e,t,s,n)=>U(`${j(e)}/doors/${t}/hold`,{...te(),revision:s,policy:n}),On=(e,t,s)=>U(`${j(e)}/doors/${t}/hold/delete`,{...te(),revision:s}),An=(e,t,s,n,a)=>U(`${j(e)}/doors/${t}/program`,{...te(),revision:s,policy:n,enabled:a}),En=(e,t,s,n)=>U(`${j(e)}/doors/${t}/program/${n}`,{...te(),revision:s});function Pn(e){return{action:e.action,door:e.door,expected:e.expected,...e.action==="set"?{new_code:e.newCode??""}:{},...e.expected?{current_code:e.currentCode??""}:{},compatibility:!!e.compatibility,confirm_text:e.confirmText}}const Dn=(e,t)=>U(`${j(e)}/codes/${t.slot}`,{...te(),...Pn(t)});function Ln(e,t){if(e instanceof H){const s=e.body?.details??{},n=String(s.outcome??""),a=n==="refused"?"refused":n==="not_sent"?"not_sent":n==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",i=Number(s.retry_after_s),r=String(s.wiskey_code??"")||String(s.reason??"")||e.code||"";return{kind:t,status:a,code:r||null,retry_after_s:Number.isFinite(i)&&i>=0?i:null,data:null}}return{kind:t,status:"unknown",code:"network",retry_after_s:null,data:null}}async function Y(e,t){try{const s=await t();return{kind:e,status:s.status,code:s.partial,retry_after_s:null,data:s.data??null}}catch(s){return Ln(s,e)}}function le(e,t){const s=Object.fromEntries(ee.map(n=>[n,(e?.weekly?.[n]??[]).filter(a=>!!a?.start&&!!a?.end).map(a=>({start:a.start,end:a.end}))]));return{timezone:e?.timezone||t,name:e?.name??"",weekly:s,holidays:(e?.holidays??[]).filter(n=>!!n.start&&!!n.end).map(n=>({name:n.name??"",start:n.start,end:n.end,periods:(n.periods??[]).map(a=>({start:a.start,end:a.end}))}))}}const Nn=(e,t="")=>le({timezone:e,name:t,weekly:{},holidays:[]},e),Rn=/^(?:[01]\d|2[0-3]):[0-5]\d$/,ie=(e,t=!1)=>Rn.test(e)?Number(e.slice(0,2))*60+Number(e.slice(3)):t&&e==="24:00"?1440:null;function Be(e,t){if(e.length>8)return[{field:t,key:"tooMany"}];const s=[];if(e.forEach((a,i)=>{const r=ie(a.start),d=ie(a.end,!0);r===null||d===null?s.push({field:`${t}.${i}`,key:"time"}):r>=d&&s.push({field:`${t}.${i}`,key:"order"})}),s.length)return s;const n=[...e].sort((a,i)=>a.start.localeCompare(i.start));for(let a=1;a<n.length;a++)if((ie(n[a-1].end,!0)??0)>(ie(n[a].start)??0))return[{field:t,key:"overlap"}];return[]}function Ue(e){const t=[],s=e.name.trim();(!s||s.length>32)&&t.push({field:"name",key:"name"}),(!e.timezone||e.timezone.length>64)&&t.push({field:"timezone",key:"zone"});for(const i of ee)t.push(...Be(e.weekly[i]??[],`weekly.${i}`));e.holidays.length>64&&t.push({field:"holidays",key:"tooMany"});const n=/^\d{4}-\d{2}-\d{2}$/;e.holidays.forEach((i,r)=>{(!i.name.trim()||i.name.trim().length>32)&&t.push({field:`holidays.${r}.name`,key:"name"}),!n.test(i.start)||!n.test(i.end)?t.push({field:`holidays.${r}`,key:"date"}):i.start>i.end&&t.push({field:`holidays.${r}`,key:"dateOrder"}),t.push(...Be(i.periods,`holidays.${r}.periods`))});const a=e.holidays.filter(i=>n.test(i.start)&&n.test(i.end)).sort((i,r)=>i.start.localeCompare(r.start));for(let i=1;i<a.length;i++)a[i-1].end>=a[i].start&&t.push({field:"holidays",key:"dateOverlap"});return t}function Ke(e){const t=s=>[...s].map(n=>({start:n.start,end:n.end})).sort((n,a)=>n.start.localeCompare(a.start));return{timezone:e.timezone,name:e.name.trim(),weekly:Object.fromEntries(ee.map(s=>[s,t(e.weekly[s]??[])])),holidays:e.holidays.map(s=>({name:s.name.trim(),start:s.start,end:s.end,periods:t(s.periods)})).sort((s,n)=>s.start.localeCompare(n.start))}}function Ve(e,t){return e?ee.filter(s=>(e.weekly[s]??[]).length).map(s=>`${t.days[s]} ⁦${(e.weekly[s]??[]).map(n=>`${n.start}–${n.end}`).join(", ")}⁩`):[]}const Ye=/^\d{4,16}$/;function Mn(e){if(e.action==="set"){if(!Ye.test(e.newCode))return"newCode";if(e.newCode!==e.repeatCode)return"repeat"}return e.expected&&!Ye.test(e.currentCode)?"currentCode":e.typed.trim()!==e.phrase?"typed":null}const Ge=(e,t)=>p(e,{slot:t});function In(e,t){return e?t.reasons[e]??(e.startsWith("schedule_")?t.reasons.schedule_invalid:e):""}function Ze(e,t){const s=In(e.code,t);switch(e.status){case"sending":return t.status.sending;case"sent":return t.status.sent;case"acknowledged":return t.status.acknowledged;case"partial":return t.status.partial;case"refused":return p(t.status.refused,{reason:s||t.reasons.unknown_reason});case"not_sent":return s?p(t.status.notSentWhy,{reason:s}):t.status.notSent;default:return s&&e.code!=="network"?p(t.status.unknownWhy,{reason:s}):t.status.unknown}}function Je(e){return e==="acknowledged"?"ok":e==="refused"||e==="not_sent"?"err":e==="sending"||e==="sent"?"busy":"warn"}const Fn={title:"שינויים טכניים",open:"ניהול טכני של הדלתות",heading:"ניהול טכני · {name}",sub:"שינויים בהגדרות הדלתות של העמדה. כל שינוי דורש אישור ונרשם ביומן.",loading:"טוען…",unavailable:"לא ניתן לטעון את הנתונים כרגע.",retry:"נסה שוב",close:"סגירה",notAllowed:"שינויים טכניים בדלתות של העמדה הזו מותרים למנהלי מערכת בלבד.",offline:"העמדה אינה מחוברת: אפשר לשמור לוחות זמנים ולהשהות תוכניות, אבל לא להחיל תוכנית או לשנות קוד.",unsupported:"הגרסה המותקנת של מערכת האינטרקום אינה מציעה את הפעולה הזו.",noDoors:"לעמדה אין דלתות מנוהלות.",tabs:{hold:"לוחות החזקה",codes:"קודים ציבוריים",programs:"תוכניות",history:"יומן"},door:"דלת {n}",days:{Sunday:"א׳",Monday:"ב׳",Tuesday:"ג׳",Wednesday:"ד׳",Thursday:"ה׳",Friday:"ו׳",Saturday:"ש׳"},dayNames:{Sunday:"ראשון",Monday:"שני",Tuesday:"שלישי",Wednesday:"רביעי",Thursday:"חמישי",Friday:"שישי",Saturday:"שבת"},hold:{none:"אין לוח החזקה",draftNote:"לוח החזקה הוא טיוטה: הוא לא פותח את הדלת עד שמחילים אותו כתוכנית.",add:"הוספה",edit:"עריכה",remove:"מחיקה",holidays:"תאריכים מיוחדים: {n}",noHours:"סגור כל השבוע"},editor:{titleNew:"לוח החזקה חדש · {door}",titleEdit:"עריכת לוח החזקה · {door}",name:"שם",zone:"אזור זמן",week:"שעות פתיחה בשבוע",closed:"סגור",addPeriod:"הוספת טווח",removePeriod:"הסרת הטווח",from:"מ־",to:"עד",holidays:"תאריכים מיוחדים",addHoliday:"הוספת תאריך",removeHoliday:"הסרת התאריך",holidayName:"שם",holidayStart:"מתאריך",holidayEnd:"עד תאריך",holidayClosed:"סגור כל היום",holidayOpen:"פתוח בשעות",save:"שמירה",cancel:"ביטול",problems:{name:"יש לתת שם (עד 32 תווים).",time:"שעה לא תקינה (HH:MM, סיום עד 24:00).",order:"שעת ההתחלה חייבת להיות לפני שעת הסיום.",overlap:"טווחי השעות חופפים.",tooMany:"יותר מדי טווחים.",date:"תאריך לא תקין.",dateOrder:"תאריך ההתחלה אחרי תאריך הסיום.",dateOverlap:"התאריכים המיוחדים חופפים.",zone:"אזור הזמן חסר."}},codes:{slot:"קוד {n}",set:"מוגדר",notSet:"לא מוגדר",unknown:"לא ידוע",never:"ערך של קוד אף פעם לא מוצג כאן - רק אם הוא מוגדר.",define:"הגדרה",replace:"החלפה",clear:"ניקוי",formSet:"הגדרת {slot}",formReplace:"החלפת {slot}",formClear:"ניקוי {slot}",door:"הדלת שהקוד פותח",newCode:"קוד חדש (4-16 ספרות)",repeat:"הקוד החדש שוב",current:"הקוד הנוכחי",currentHint:"העמדה מבקשת את הקוד הנוכחי כדי להחליף או לנקות אותו.",compatibility:"מצב תאימות (העמדה אינה מצהירה על תמיכה)",typed:"לאישור, הקלידו: {phrase}",send:"שליחה לעמדה",cancel:"ביטול",load:"קריאת מצב הקודים",problems:{newCode:"קוד חייב להכיל 4-16 ספרות.",repeat:"שני הקודים החדשים אינם זהים.",currentCode:"יש להזין את הקוד הנוכחי (4-16 ספרות).",typed:"הטקסט שהוקלד אינו תואם."},rate:"עד {n} שינויי קוד ב־{m} דקות."},programs:{none:"אין תוכנית",on:"מופעלת",paused:"מושהית",removing:"בהסרה",exec:{idle:"לא מחזיקה כרגע",opening:"שולחת החזקה",held_acknowledged:"החזקה אושרה (המצב הפיזי לא אומת)",restoring:"חוזרת לשליטה רגילה",unknown:"תוצאה לא ידועה"},apply:"החלה מלוח ההחזקה",resume:"הפעלה מחדש",pause:"השהיה",remove:"הסרה",needDraft:"כדי להחיל תוכנית שמרו קודם לוח החזקה לדלת.",pauseFirst:"כדי להחיל לוח חדש יש להשהות קודם את התוכנית."},confirm:{hold_save:{title:"לשמור את לוח ההחזקה?",one:'הלוח "{name}" יישמר כטיוטה ל{door} בעמדה {station}. הדלת לא תיפתח עד שתוחל תוכנית.'},hold_delete:{title:"למחוק את לוח ההחזקה?",one:"לוח ההחזקה של {door} בעמדה {station} יימחק."},program_apply:{title:"להחיל תוכנית החזקה?",one:'מעכשיו {door} בעמדה {station} תוחזק פתוחה אוטומטית בשעות של "{name}". המערכת תפעל לבד לפי הלוח.'},program_pause:{title:"להשהות את התוכנית?",one:"התוכנית של {door} בעמדה {station} תושהה, והדלת תתבקש לחזור לשליטה רגילה."},program_remove:{title:"להסיר את התוכנית?",one:"התוכנית של {door} בעמדה {station} תוסר, והדלת תתבקש לחזור לשליטה רגילה."},send:"אישור ושליחה",cancel:"ביטול"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"בוצע ואושר",partial:"בוצע חלקית: התוכנית נשמרה, אך לא ברור אם הטיוטה הישנה נמחקה",refused:"WisKey סירב: {reason}",notSent:"לא נשלח",notSentWhy:"לא נשלח: {reason}",unknown:"נשלח, לא התקבלה תשובה ברורה - ייתכן שבוצע. טענו מחדש לפני שמנסים שוב",unknownWhy:"נשלח, לא התקבלה תשובה ברורה ({reason}) - ייתכן שבוצע. טענו מחדש לפני שמנסים שוב"},kinds:{hold_save:"שמירת לוח",hold_delete:"מחיקת לוח",code_write:"קוד ציבורי",program_save:"החלת תוכנית",program_action:"עדכון תוכנית"},historyEmpty:"אין עדיין שינויים טכניים בעמדה הזו.",historyCode:"{action} {slot}",codeActions:{set:"הגדרת",clear:"ניקוי"},programActions:{pause:"השהיה",remove:"הסרה"},reasons:{unauthorized:"אין הרשאה לפקודה הזו",forbidden:"אין הרשאה",reauth_required:"נדרש אימות מחדש לפעולות רגישות",screen_locked:"המסך נעול",approval_required:"נדרש אישור כפול",device_busy:"העמדה עסוקה בפקודה טכנית אחרת",revision_conflict:"הנתונים השתנו מאז שנטענו",hold_pause_before_edit:"יש להשהות את התוכנית קודם",schedule_limit:"הגעתם למספר המרבי של לוחות",operation_unsupported:"העמדה אינה תומכת בפעולה",unmanaged_lock:"הדלת אינה מנוהלת",station_retiring:"העמדה בהוצאה משימוש",station_unloaded:"העמדה נטענה מחדש באמצע הפעולה",invalid_fields:"פרמטרים לא תקינים",schedule_invalid:"לוח הזמנים אינו תקין",confirmation_required:"לא אושר",typed_confirmation_required:"הטקסט לאישור לא הוקלד נכון",expired:"הבקשה פגה לפני שנשלחה",intercom_duplicate_command:"כבר נשלח",intercom_station_offline:"העמדה אינה מחוברת",intercom_station_not_found:"העמדה לא נמצאה",intercom_lock_unknown:"אין לעמדה דלת כזו",door_tech_invalid:"ערך לא תקין",door_tech_unsupported:"הגרסה המותקנת אינה מציעה את הפעולה",door_tech_cooldown:"נשלח לפני רגע",door_tech_code_rate_limited:"יותר מדי שינויי קוד בזמן קצר",door_tech_rate_limited:"יותר מדי שינויים בזמן קצר",door_tech_busy:"שינוי אחר בעמדה עדיין רץ",door_tech_code_not_set:"הקוד אינו מוגדר",relay_map_unreadable:"לא ניתן היה לקרוא את מיפוי הדלתות",explicit_deny:"ההרשאה נשללה בעמדה הזו",no_binding:"אין הרשאה",wall_account:"חשבון תצוגה",intercom_unavailable:"מערכת האינטרקום אינה זמינה",intercom_busy:"מערכת האינטרקום עסוקה",intercom_rate_limited:"הוגבל קצב",rate_limited:"הוגבל קצב",timeout:"אין תשובה בזמן",action_failed:"כשל לא מפורט",invalid_response:"תשובה לא צפויה",ambiguous_write:"העמדה לא אישרה בבירור",readback_mismatch:"הקריאה החוזרת לא תאמה",network:"אין חיבור לשרת",unknown_reason:"סיבה לא ידועה"}},qn={title:"Technical changes",open:"Door technical settings",heading:"Technical settings · {name}",sub:"Changes to this station's door settings. Every change needs a confirmation and is recorded.",loading:"Loading…",unavailable:"The data cannot be loaded right now.",retry:"Try again",close:"Close",notAllowed:"Technical changes to this station's doors are for system administrators only.",offline:"The station is offline: schedules can be saved and programs paused, but a program cannot be applied and codes cannot be changed.",unsupported:"The installed intercom version does not offer this action.",noDoors:"The station has no managed doors.",tabs:{hold:"Hold-open schedules",codes:"Public codes",programs:"Programs",history:"Log"},door:"Door {n}",days:{Sunday:"Sun",Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat"},dayNames:{Sunday:"Sunday",Monday:"Monday",Tuesday:"Tuesday",Wednesday:"Wednesday",Thursday:"Thursday",Friday:"Friday",Saturday:"Saturday"},hold:{none:"No hold-open schedule",draftNote:"A hold-open schedule is a draft: it does not open the door until it is applied as a program.",add:"Add",edit:"Edit",remove:"Delete",holidays:"Special dates: {n}",noHours:"Closed all week"},editor:{titleNew:"New hold-open schedule · {door}",titleEdit:"Edit hold-open schedule · {door}",name:"Name",zone:"Time zone",week:"Weekly opening hours",closed:"Closed",addPeriod:"Add a period",removePeriod:"Remove the period",from:"From",to:"To",holidays:"Special dates",addHoliday:"Add a date",removeHoliday:"Remove the date",holidayName:"Name",holidayStart:"From date",holidayEnd:"To date",holidayClosed:"Closed all day",holidayOpen:"Open during",save:"Save",cancel:"Cancel",problems:{name:"Give it a name (up to 32 characters).",time:"Invalid time (HH:MM, end up to 24:00).",order:"The start must be before the end.",overlap:"The periods overlap.",tooMany:"Too many periods.",date:"Invalid date.",dateOrder:"The start date is after the end date.",dateOverlap:"The special dates overlap.",zone:"The time zone is missing."}},codes:{slot:"Code {n}",set:"Set",notSet:"Not set",unknown:"Unknown",never:"A code value is never shown here - only whether it is set.",define:"Set",replace:"Replace",clear:"Clear",formSet:"Set {slot}",formReplace:"Replace {slot}",formClear:"Clear {slot}",door:"The door the code opens",newCode:"New code (4-16 digits)",repeat:"New code again",current:"Current code",currentHint:"The station asks for the current code to replace or clear it.",compatibility:"Compatibility mode (the station does not declare support)",typed:"To confirm, type: {phrase}",send:"Send to the station",cancel:"Cancel",load:"Read the codes",problems:{newCode:"A code has 4-16 digits.",repeat:"The two new codes differ.",currentCode:"Enter the current code (4-16 digits).",typed:"The typed text does not match."},rate:"Up to {n} code changes in {m} minutes."},programs:{none:"No program",on:"On",paused:"Paused",removing:"Being removed",exec:{idle:"Not holding now",opening:"Sending hold-open",held_acknowledged:"Hold-open acknowledged (physical state not verified)",restoring:"Returning to normal control",unknown:"Outcome unknown"},apply:"Apply the hold-open schedule",resume:"Turn on again",pause:"Pause",remove:"Remove",needDraft:"Save a hold-open schedule for the door first to apply a program.",pauseFirst:"Pause the program first to apply a new schedule."},confirm:{hold_save:{title:"Save the hold-open schedule?",one:'The schedule "{name}" is saved as a draft for {door} at {station}. The door does not open until a program is applied.'},hold_delete:{title:"Delete the hold-open schedule?",one:"The hold-open schedule of {door} at {station} is deleted."},program_apply:{title:"Apply a hold-open program?",one:'From now on {door} at {station} is held open automatically during the hours of "{name}". The system acts on its own by the schedule.'},program_pause:{title:"Pause the program?",one:"The program of {door} at {station} is paused and the door is asked back to normal control."},program_remove:{title:"Remove the program?",one:"The program of {door} at {station} is removed and the door is asked back to normal control."},send:"Confirm and send",cancel:"Cancel"},status:{sending:"Sending…",sent:"Sent, waiting for the answer",acknowledged:"Done and acknowledged",partial:"Partly done: the program was saved, but it is not clear whether the old draft was deleted",refused:"WisKey refused: {reason}",notSent:"Not sent",notSentWhy:"Not sent: {reason}",unknown:"Sent, no clear answer - it may have happened. Reload before trying again",unknownWhy:"Sent, no clear answer ({reason}) - it may have happened. Reload before trying again"},kinds:{hold_save:"Schedule saved",hold_delete:"Schedule deleted",code_write:"Public code",program_save:"Program applied",program_action:"Program changed"},historyEmpty:"No technical changes at this station yet.",historyCode:"{action} {slot}",codeActions:{set:"Set",clear:"Clear"},programActions:{pause:"Pause",remove:"Remove"},reasons:{unauthorized:"no permission for this command",forbidden:"no permission",reauth_required:"a fresh sign-in is required for sensitive actions",screen_locked:"the screen is locked",approval_required:"a second approval is required",device_busy:"the station is busy with another technical command",revision_conflict:"the data changed since it was loaded",hold_pause_before_edit:"pause the program first",schedule_limit:"the schedule limit is reached",operation_unsupported:"the station does not support this",unmanaged_lock:"the door is not managed",station_retiring:"the station is being retired",station_unloaded:"the station reloaded during the action",invalid_fields:"invalid parameters",schedule_invalid:"the schedule is invalid",confirmation_required:"not confirmed",typed_confirmation_required:"the confirmation text was not typed correctly",expired:"the request expired before it was sent",intercom_duplicate_command:"already sent",intercom_station_offline:"the station is offline",intercom_station_not_found:"the station was not found",intercom_lock_unknown:"the station has no such door",door_tech_invalid:"invalid value",door_tech_unsupported:"the installed version does not offer this",door_tech_cooldown:"sent a moment ago",door_tech_code_rate_limited:"too many code changes in a short time",door_tech_rate_limited:"too many changes in a short time",door_tech_busy:"another change at the station is still running",door_tech_code_not_set:"the code is not set",relay_map_unreadable:"the door map could not be read",explicit_deny:"the permission is denied at this station",no_binding:"no permission",wall_account:"a display account",intercom_unavailable:"the intercom system is unavailable",intercom_busy:"the intercom system is busy",intercom_rate_limited:"rate limited",rate_limited:"rate limited",timeout:"no answer in time",action_failed:"an unspecified failure",invalid_response:"an unexpected answer",ambiguous_write:"the station did not clearly acknowledge",readback_mismatch:"the read-back did not match",network:"no connection to the server",unknown_reason:"unknown reason"}};function _(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?qn:Fn}var Hn=Object.defineProperty,jn=Object.getOwnPropertyDescriptor,z=(e,t,s,n)=>{for(var a=n>1?void 0:n?jn(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&Hn(t,s,a),a};let x=class extends M{constructor(){super(...arguments),this.station=null,this.live=!0,this.open=!1,this.tab="hold",this.phase="idle",this.view=null,this.programs=null,this.holds={},this.zone="Asia/Jerusalem",this.codes=null,this.codesPhase="idle",this.editing=null,this.codeForm=null,this.pending=null,this.running=null,this.results={},this.seq=0,this.loadedFor=""}mayWrite(){return C("system.configure")||C("access.stations.manage")}willUpdate(e){e.has("station")&&this.station&&this.station.id!==this.loadedFor&&(this.loadedFor=this.station.id,this.reset()),this.hidden=!this.station||!this.mayWrite()}reset(){this.seq++,this.open=!1,this.view=null,this.programs=null,this.holds={},this.codes=null,this.codesPhase="idle",this.phase="idle",this.editing=null,this.codeForm=null,this.pending=null,this.running=null,this.results={}}doors(){return(this.view?.locks??this.station?.locks.map(e=>({door:e.physical_index,name:e.name??null}))??[]).map(e=>e.door)}doorName(e){const t=_();return this.view?.locks.find(n=>n.door===e)?.name?.trim()||p(t.door,{n:e})}async openDialog(){this.open=!0,this.tab="hold",await this.load()}async load(){const e=this.station;if(!e)return;const t=++this.seq;this.phase="loading";try{const s=await zn(e.id);if(t!==this.seq)return;if(this.view=s,!s.allowed){this.phase="ready";return}const[n,...a]=await Promise.all([ot(e.id),...s.locks.map(i=>Cn(e.id,i.door))]);if(t!==this.seq)return;this.programs=n.programs,this.zone=n.programs?.timezone||a.find(i=>i.hold?.timezone)?.hold?.timezone||this.zone,this.holds=Object.fromEntries(s.locks.map((i,r)=>[i.door,a[r]?.hold?.draft??null])),this.phase="ready"}catch{t===this.seq&&(this.phase="error")}}async loadCodes(){const e=this.station;if(!e)return;const t=this.seq;this.codesPhase="loading";try{const s=await rt(e.id);if(t!==this.seq)return;this.codes=s.codes,this.codesPhase=s.codes?"ready":"error"}catch{t===this.seq&&(this.codesPhase="error")}}pick(e){this.tab=e,this.pending=null,e==="codes"&&this.codesPhase==="idle"&&this.loadCodes()}ask(e){this.pending=e,this.updateComplete.then(()=>{const t=this.renderRoot.querySelector("[data-wk-dt-confirm]");t?.scrollIntoView({block:"nearest"}),t?.querySelector("[data-wk-dt-send]")?.focus()})}async send(){const e=this.pending;!e||this.running||(this.pending=null,await this.execute(e.key,e.kind,e.send))}async execute(e,t,s){const n=this.station?.id;this.running=e,this.results={...this.results,[e]:{kind:t,status:"sending",code:null,retry_after_s:null,data:null}};const a=await s();this.station?.id===n&&(this.running=null,this.results={...this.results,[e]:a},this.dispatchEvent(new CustomEvent("door-tech-changed",{detail:a,bubbles:!0,composed:!0})),await this.load(),e.startsWith("code:")&&await this.loadCodes())}stationName(){return this.station?.name??""}askHoldSave(){const e=this.editing,t=this.station;if(!e||!t||Ue(e.body).length)return;const s=_(),n=Ke(e.body),a=e.door,i=e.revision;this.ask({key:`hold:${a}`,kind:"hold_save",title:s.confirm.hold_save.title,sentence:p(s.confirm.hold_save.one,{name:n.name,door:this.doorName(a),station:this.stationName()}),send:async()=>{const r=await Y("hold_save",()=>Tn(t.id,a,i,n));return r.status==="acknowledged"&&(this.editing=null),r}})}askHoldDelete(e){const t=this.station,s=this.holds[e];if(!t||!s||s.revision===null)return;const n=_(),a=s.revision;this.ask({key:`hold:${e}`,kind:"hold_delete",title:n.confirm.hold_delete.title,sentence:p(n.confirm.hold_delete.one,{door:this.doorName(e),station:this.stationName()}),send:()=>Y("hold_delete",()=>On(t.id,e,a))})}askProgramSave(e,t,s){const n=this.station;if(!n)return;const a=_();this.ask({key:`program:${e}`,kind:"program_save",title:a.confirm.program_apply.title,sentence:p(a.confirm.program_apply.one,{name:t.name,door:this.doorName(e),station:this.stationName()}),send:()=>Y("program_save",()=>An(n.id,e,s,Ke(t),!0))})}askProgramAction(e,t){const s=this.station;if(!s||e.door===null||e.revision===null)return;const n=_(),a=t==="pause"?n.confirm.program_pause:n.confirm.program_remove,i=e.door,r=e.revision;this.ask({key:`program:${i}`,kind:"program_action",title:a.title,sentence:p(a.one,{door:this.doorName(i),station:this.stationName()}),send:()=>Y("program_action",()=>En(s.id,i,r,t))})}async sendCode(e){e.preventDefault();const t=this.codeForm,s=this.station,n=this.view;if(!t||!s||!n||this.running)return;const a=this.renderRoot,i=m=>a.querySelector(`[data-wk-dt-code-field="${m}"]`)?.value??"",r={action:t.action,expected:t.expected,newCode:i("new"),repeatCode:i("repeat"),currentCode:i("current"),typed:i("typed"),phrase:Ge(n.confirm_phrase,t.slot)},d=Mn(r),c=a.querySelector("[data-wk-dt-code-problem]");if(d){c&&(c.textContent=_().codes.problems[d]);return}const h={slot:t.slot,action:t.action,door:t.door,expected:t.expected,newCode:r.newCode,currentCode:r.currentCode,compatibility:t.compatibility,confirmText:r.typed};a.querySelectorAll("[data-wk-dt-code-field]").forEach(m=>m.value=""),r.newCode=r.repeatCode=r.currentCode="",this.codeForm=null,await this.execute(`code:${t.slot}`,"code_write",()=>Y("code_write",()=>Dn(s.id,h)))}render(){const e=this.station;if(!e||!this.mayWrite())return l;const t=_();return o`<div class="row" data-wk-dt=${e.id}>
        <span class="t"><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</span>
        <wk-action-button icon="door" data-wk-dt-open @click=${()=>void this.openDialog()}>${t.open}</wk-action-button>
      </div>
      ${this.open?this.renderDialog(e):l}`}renderDialog(e){const t=_();return o`<sw-dialog
      open
      xl
      heading=${p(t.heading,{name:e.name})}
      ?locked=${!!this.running}
      data-wk-dt-dialog
      data-wk-dt-state=${this.phase}
      @close=${s=>{s.target===s.currentTarget&&(this.open=!1,this.pending=null,this.editing=null,this.codeForm=null)}}
    >
      <p class="sub">${t.sub}</p>
      ${this.renderBody()}
      <div slot="footer"><wk-action-button data-wk-dt-close ?disabled=${!!this.running} @click=${()=>this.open=!1}>${t.close}</wk-action-button></div>
    </sw-dialog>`}renderBody(){const e=_();if(this.phase==="loading"&&!this.view)return o`<p class="note" role="status">${e.loading}</p>`;if(this.phase==="error"&&!this.view)return o`<p class="note" role="status" data-wk-dt-error>${e.unavailable} <wk-action-button tone="quiet" @click=${()=>void this.load()}>${e.retry}</wk-action-button></p>`;const t=this.view;if(!t)return l;if(!t.allowed)return o`<p class="note warn" data-wk-dt-not-allowed>${e.notAllowed}</p>`;if(!t.locks.length)return o`<p class="note" data-wk-dt-no-doors>${e.noDoors}</p>`;const s=["hold","programs","codes","history"];return o`${t.online===!1?o`<p class="note warn" data-wk-dt-offline>${e.offline}</p>`:l}
      <div class="tabs" role="tablist" aria-label=${e.title}>
        ${s.map(n=>o`<button type="button" role="tab" aria-selected=${String(this.tab===n)} data-wk-dt-tab=${n} @click=${()=>this.pick(n)}>${e.tabs[n]}</button>`)}
      </div>
      <div role="tabpanel" data-wk-dt-panel=${this.tab}>
        ${this.tab==="hold"?this.renderHold():this.tab==="codes"?this.renderCodes():this.tab==="programs"?this.renderPrograms():this.renderHistory()}
      </div>`}renderConfirm(e){const t=_();return o`<div class="confirm" role="alertdialog" aria-label=${e.title} data-wk-dt-confirm=${e.kind}>
      <h5>${e.title}</h5>
      <p data-wk-dt-sentence>${e.sentence}</p>
      <div class="btns">
        <wk-action-button tone="primary" data-wk-dt-send ?disabled=${!this.live||!!this.running} @click=${()=>void this.send()}>${t.confirm.send}</wk-action-button>
        <wk-action-button data-wk-dt-cancel @click=${()=>this.pending=null}>${t.confirm.cancel}</wk-action-button>
      </div>
    </div>`}confirmAt(e){return this.pending?.key===e?this.renderConfirm(this.pending):l}result(e){const t=this.results[e];return t?o`<span class="line" role="status" data-wk-dt-result=${e} data-status=${t.status} data-tone=${Je(t.status)}>${Ze(t,_())}</span>`:l}unsupported(e){return this.view?.commands?.[e]?.available===!1}renderHold(){const e=_();return this.editing?this.renderEditor():o`<p class="note">${e.hold.draftNote}</p>
      ${this.doors().map(t=>{const s=this.holds[t]??null,n=s?.policy?le(s.policy,this.zone):null,a=Ve(n,e),i=`hold:${t}`,r=this.running===i;return o`<div class="door" data-wk-dt-hold=${t}>
          <div class="dh">
            <span class="n">${this.doorName(t)}${n?o` · <bdi>${n.name}</bdi>`:l}</span>
            <div class="btns">
              ${this.unsupported("hold_save")?l:o`<wk-action-button icon=${s?"edit":"plus"} data-wk-dt-hold-edit=${t} ?disabled=${!this.live||!!this.running||s?.revision===null}
                    @click=${()=>this.editing={door:t,revision:s?.revision??0,body:n??Nn(this.zone)}}>${s?e.hold.edit:e.hold.add}</wk-action-button>`}
              ${s&&!this.unsupported("hold_delete")?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-hold-delete=${t} ?busy=${r} ?disabled=${!this.live||!!this.running}
                    @click=${()=>this.askHoldDelete(t)}>${e.hold.remove}</wk-action-button>`:l}
            </div>
          </div>
          ${n?o`<div class="lines">${a.length?a.map(d=>o`<bdi>${d}</bdi>`):o`<span>${e.hold.noHours}</span>`}${n.holidays.length?o`<span>${p(e.hold.holidays,{n:n.holidays.length})}</span>`:l}</div>`:o`<span class="line">${e.hold.none}</span>`}
          ${this.confirmAt(i)} ${this.result(i)}
        </div>`})}`}change(e){if(!this.editing)return;const t=structuredClone(this.editing.body);e(t),this.editing={...this.editing,body:t}}periodInputs(e,t,s,n){const a=_().editor;return o`${e.map((i,r)=>o`<span class="period" data-wk-dt-period=${`${t}.${r}`}>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="07:00" aria-label=${a.from} .value=${i.start} @input=${d=>s(r,"start",d.target.value)} />
        <span aria-hidden="true">–</span>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="19:00" aria-label=${a.to} .value=${i.end} @input=${d=>s(r,"end",d.target.value)} />
        <wk-action-button tone="quiet" icon="close" icon-only label=${a.removePeriod} @click=${()=>n(r)}></wk-action-button>
      </span>`)}`}renderEditor(){const e=_(),t=this.editing,s=t.body,n=Ue(s),a=r=>n.filter(d=>d.field===r||d.field.startsWith(r+".")),i=r=>r.length?o`<span class="problem">${e.editor.problems[r[0].key]}</span>`:l;return o`<div class="form" data-wk-dt-editor=${t.door}>
      <h5>${p(t.revision?e.editor.titleEdit:e.editor.titleNew,{door:this.doorName(t.door)})}</h5>
      <div class="grid2">
        <label class="f">${e.editor.name}<input data-wk-dt-name maxlength="32" .value=${s.name} aria-invalid=${String(!!a("name").length)} @input=${r=>this.change(d=>d.name=r.target.value)} />${i(a("name"))}</label>
        <label class="f">${e.editor.zone}<input class="ltr" data-wk-dt-zone maxlength="64" .value=${s.timezone} @input=${r=>this.change(d=>d.timezone=r.target.value.trim())} />${i(a("timezone"))}</label>
      </div>
      <div>
        <div class="line">${e.editor.week}</div>
        ${ee.map(r=>{const d=s.weekly[r]??[];return o`<div class="day" data-wk-dt-day=${r}>
            <span class="dn">${e.dayNames[r]}</span>
            <div>
              <div class="periods">
                ${d.length?l:o`<span class="closed">${e.editor.closed}</span>`}
                ${this.periodInputs(d,r,(c,h,m)=>this.change(w=>w.weekly[r][c][h]=m),c=>this.change(h=>h.weekly[r].splice(c,1)))}
                ${d.length<8?o`<wk-action-button tone="quiet" icon="plus" data-wk-dt-add-period=${r} @click=${()=>this.change(c=>c.weekly[r].push(d.length?{start:"",end:""}:{start:"07:00",end:"19:00"}))}>${e.editor.addPeriod}</wk-action-button>`:l}
              </div>
              ${i(a(`weekly.${r}`))}
            </div>
          </div>`})}
      </div>
      <div class="form">
        <div class="line">${e.editor.holidays}</div>
        ${s.holidays.map((r,d)=>o`<div class="holiday" data-wk-dt-holiday=${d}>
            <div class="grid2">
              <label class="f">${e.editor.holidayName}<input maxlength="32" .value=${r.name} @input=${c=>this.change(h=>h.holidays[d].name=c.target.value)} /></label>
              <span></span>
              <label class="f">${e.editor.holidayStart}<input type="date" lang=${Ae()} min="2000-01-01" max="2037-12-31" .value=${r.start} @input=${c=>this.change(h=>h.holidays[d].start=c.target.value)} /></label>
              <label class="f">${e.editor.holidayEnd}<input type="date" lang=${Ae()} min="2000-01-01" max="2037-12-31" .value=${r.end} @input=${c=>this.change(h=>h.holidays[d].end=c.target.value)} /></label>
            </div>
            <div class="periods">
              ${r.periods.length?l:o`<span class="closed">${e.editor.holidayClosed}</span>`}
              ${this.periodInputs(r.periods,`h${d}`,(c,h,m)=>this.change(w=>w.holidays[d].periods[c][h]=m),c=>this.change(h=>h.holidays[d].periods.splice(c,1)))}
              <wk-action-button tone="quiet" icon="plus" @click=${()=>this.change(c=>c.holidays[d].periods.push({start:"08:00",end:"12:00"}))}>${e.editor.addPeriod}</wk-action-button>
              <wk-action-button tone="quiet" icon="trash" @click=${()=>this.change(c=>c.holidays.splice(d,1))}>${e.editor.removeHoliday}</wk-action-button>
            </div>
            ${i(a(`holidays.${d}`))}
          </div>`)}
        ${i(n.filter(r=>r.field==="holidays"))}
        <div class="btns">
          <wk-action-button tone="quiet" icon="plus" data-wk-dt-add-holiday @click=${()=>this.change(r=>r.holidays.push({name:"",start:"",end:"",periods:[]}))}>${e.editor.addHoliday}</wk-action-button>
        </div>
      </div>
      <div class="btns">
        <wk-action-button tone="primary" icon="check" data-wk-dt-save ?disabled=${!this.live||!!this.running||n.length>0} @click=${()=>this.askHoldSave()}>${e.editor.save}</wk-action-button>
        <wk-action-button data-wk-dt-editor-cancel ?disabled=${!!this.running} @click=${()=>(this.editing=null,this.pending=null)}>${e.editor.cancel}</wk-action-button>
      </div>
      ${this.confirmAt(`hold:${t.door}`)} ${this.result(`hold:${t.door}`)}
    </div>`}renderPrograms(){const e=_(),t=this.view?.online!==!1;return o`${this.doors().map(s=>{const n=this.programs?.programs.find(E=>E.door===s)??null,a=this.holds[s]??null,i=a?.policy?le(a.policy,this.zone):null,r=`program:${s}`,d=!this.live||!!this.running,c=!this.unsupported("program_save"),h=!this.unsupported("program_action"),m=!!n&&!n.enabled&&!n.removing,w=n?n.removing?e.programs.removing:n.enabled?e.programs.on:e.programs.paused:e.programs.none,v=n?.execution?.status?e.programs.exec[n.execution.status]:null,f=n?.policy?le(n.policy,this.zone):null;return o`<div class="door" data-wk-dt-program=${s} data-state=${n?n.removing?"removing":n.enabled?"on":"paused":"none"}>
        <div class="dh">
          <span class="n">${this.doorName(s)}${f?.name?o` · <bdi>${f.name}</bdi>`:l}</span>
          <sw-badge kind=${n?n.removing?"stale":n.enabled?"live":"offline":"neutral"} label=${w}></sw-badge>
        </div>
        ${f?o`<div class="lines">${Ve(f,e).map(E=>o`<bdi>${E}</bdi>`)}</div>`:l}
        ${v&&n?.enabled?o`<span class="line">${v}</span>`:l}
        <div class="btns">
          ${c&&i&&(!n||m)?o`<wk-action-button tone="primary" icon="play" data-wk-dt-program-apply=${s} ?disabled=${d||!t} @click=${()=>this.askProgramSave(s,i,n?.revision??0)}>${e.programs.apply}</wk-action-button>`:l}
          ${c&&m&&f&&n?.revision!==null?o`<wk-action-button icon="play" data-wk-dt-program-resume=${s} ?disabled=${d||!t} @click=${()=>this.askProgramSave(s,f,n.revision)}>${e.programs.resume}</wk-action-button>`:l}
          ${h&&n?.enabled&&!n.removing?o`<wk-action-button icon="pause" data-wk-dt-program-pause=${s} ?disabled=${d} @click=${()=>this.askProgramAction(n,"pause")}>${e.programs.pause}</wk-action-button>`:l}
          ${h&&n&&!n.removing?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-program-remove=${s} ?disabled=${d} @click=${()=>this.askProgramAction(n,"remove")}>${e.programs.remove}</wk-action-button>`:l}
        </div>
        ${!i&&(!n||m)?o`<span class="line">${e.programs.needDraft}</span>`:l}
        ${i&&n?.enabled?o`<span class="line">${e.programs.pauseFirst}</span>`:l}
        ${this.confirmAt(r)} ${this.result(r)}
      </div>`})}`}renderCodes(){const e=_();if(this.codesPhase==="loading"&&!this.codes)return o`<p class="note" role="status">${e.loading}</p>`;if(this.codesPhase==="error"&&!this.codes)return o`<p class="note" data-wk-dt-codes-error>${e.unavailable} <wk-action-button tone="quiet" @click=${()=>void this.loadCodes()}>${e.retry}</wk-action-button></p>`;const t=this.codes;if(!t)return o`<wk-action-button @click=${()=>void this.loadCodes()}>${e.codes.load}</wk-action-button>`;const s=this.view?.online!==!1,n=!this.unsupported("code_write"),a=this.view?.limits;return o`<p class="note">${e.codes.never}${a?o` ${p(e.codes.rate,{n:a.code_max,m:Math.round(a.code_window_s/60)})}`:l}</p>
      ${this.codeForm?this.renderCodeForm(this.codeForm,t):l}
      ${t.slots.map(i=>{const r=`code:${i.slot}`,d=i.configured===!0?e.codes.set:i.configured===!1?e.codes.notSet:e.codes.unknown,c=!this.live||!!this.running||!s||i.configured===null||!!this.codeForm;return o`<div class="door" data-wk-dt-slot=${i.slot} data-configured=${String(i.configured)}>
          <div class="dh">
            <span class="n">${p(e.codes.slot,{n:i.slot})}</span>
            <sw-badge kind=${i.configured===!0?"live":i.configured===!1?"offline":"unknown"} label=${d}></sw-badge>
          </div>
          ${n?o`<div class="btns">
                <wk-action-button icon="lock" data-wk-dt-code-set=${i.slot} ?disabled=${c}
                  @click=${()=>this.codeForm={slot:i.slot,action:"set",expected:i.configured===!0,door:this.doors()[0]??1,compatibility:!1}}>${i.configured?e.codes.replace:e.codes.define}</wk-action-button>
                ${i.configured?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-code-clear=${i.slot} ?disabled=${c}
                      @click=${()=>this.codeForm={slot:i.slot,action:"clear",expected:!0,door:this.doors()[0]??1,compatibility:!1}}>${e.codes.clear}</wk-action-button>`:l}
              </div>`:l}
          ${this.result(r)}
        </div>`})}`}renderCodeForm(e,t){const s=_(),n=p(s.codes.slot,{n:e.slot}),a=e.action==="clear"?s.codes.formClear:e.expected?s.codes.formReplace:s.codes.formSet,i=Ge(this.view?.confirm_phrase??"קוד {slot}",e.slot),r=this.doors();return o`<form class="confirm" data-wk-dt-code-form=${e.slot} data-action=${e.action} autocomplete="off" @submit=${d=>void this.sendCode(d)}>
      <h5>${p(a,{slot:n})}</h5>
      ${r.length>1?o`<label class="f">${s.codes.door}<select data-wk-dt-code-door @change=${d=>this.codeForm={...e,door:Number(d.target.value)}}>
            ${r.map(d=>o`<option value=${d} ?selected=${d===e.door}>${this.doorName(d)}</option>`)}
          </select></label>`:l}
      ${e.action==="set"?o`<div class="grid2">
            <label class="f">${s.codes.newCode}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="16" data-wk-dt-code-field="new" /></label>
            <label class="f">${s.codes.repeat}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="16" data-wk-dt-code-field="repeat" /></label>
          </div>`:l}
      ${e.expected?o`<label class="f">${s.codes.current}<input type="password" inputmode="numeric" autocomplete="off" maxlength="16" data-wk-dt-code-field="current" /><span class="line">${s.codes.currentHint}</span></label>`:l}
      ${t.capabilities.advertised===!1&&e.action==="set"?o`<label class="check"><input type="checkbox" data-wk-dt-code-compat .checked=${e.compatibility} @change=${d=>this.codeForm={...e,compatibility:d.target.checked}} />${s.codes.compatibility}</label>`:l}
      <label class="f">${p(s.codes.typed,{phrase:i})}<input autocomplete="off" maxlength="32" data-wk-dt-code-field="typed" /></label>
      <span class="problem" role="alert" data-wk-dt-code-problem></span>
      <div class="btns">
        <wk-action-button tone="primary" icon="lock" data-wk-dt-code-send ?disabled=${!this.live||!!this.running} @click=${d=>void this.sendCode(d)}>${s.codes.send}</wk-action-button>
        <wk-action-button data-wk-dt-code-cancel @click=${()=>this.codeForm=null}>${s.codes.cancel}</wk-action-button>
      </div>
    </form>`}renderHistory(){const e=_(),t=this.view?.history??[];return t.length?o`<ul class="hist" data-wk-dt-history>
      ${t.map(s=>{const n=s.kind==="code_write"&&s.slot?p(e.historyCode,{action:e.codeActions[s.code_action??"set"],slot:p(e.codes.slot,{n:s.slot})}):`${s.kind==="program_action"&&s.program_action?e.programActions[s.program_action]:e.kinds[s.kind]}${s.door?` · ${this.doorName(s.door)}`:""}`;return o`<li data-wk-dt-history-row=${s.kind} data-status=${s.status}>
          <span>${n}</span>
          <span class="line" data-tone=${Je(s.status)}><bdi>${new Date(s.at).toLocaleString(document.documentElement.lang||"he",{dateStyle:"short",timeStyle:"short"})}</bdi> · ${Ze(s,e)}</span>
        </li>`})}
    </ul>`:o`<p class="note" data-wk-dt-history-empty>${e.historyEmpty}</p>`}};x.styles=q`
    :host {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      padding-block-start: var(--sw-s-2);
      border-block-start: 1px solid var(--sw-border);
    }
    .row .t {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    /* the dialog's body is a column that scrolls: its direct children keep their height (a tall tab must not squash the tab bar) */
    .sub,
    .tabs,
    .note,
    [role='tabpanel'] {
      flex-shrink: 0;
    }
    .sub {
      margin: 0 0 var(--sw-s-3);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 3px;
      margin-block-end: var(--sw-s-3);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2, var(--sw-bg-2));
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs button {
      flex: 1 0 auto;
      min-block-size: 36px;
      padding: 0 var(--sw-s-3);
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      white-space: nowrap;
    }
    .tabs button[aria-selected='true'] {
      /* DARK-SEG-ALL-2380: the chosen key reads the segment tokens (a neutral surface key is invisible in the dark scheme) */
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text, var(--sw-accent)));
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      margin: 0 0 var(--sw-s-2);
    }
    .note.warn {
      color: var(--sw-warning-text);
    }
    .door {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-3);
      margin-block-end: var(--sw-s-2);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .dh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .dh .n {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .lines {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .btns {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .line {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      overflow-wrap: anywhere;
    }
    .line[data-tone='ok'] {
      color: var(--sw-success-text, var(--sw-text-2));
    }
    .line[data-tone='err'] {
      color: var(--sw-danger-text);
    }
    .line[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .confirm {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
      border: 1px solid var(--sw-warning-border, var(--sw-border-strong));
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-bg, var(--sw-surface-2));
    }
    .confirm h5 {
      margin: 0;
      font-size: var(--sw-fs-base);
    }
    .confirm p {
      margin: 0;
      line-height: 1.5;
    }
    form,
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .grid2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sw-s-2) var(--sw-s-3);
    }
    label.f {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    input,
    select {
      box-sizing: border-box;
      inline-size: 100%;
      min-block-size: var(--sw-ctl-h-md, 36px);
      padding: 4px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface, #fff);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    input.hm {
      inline-size: 5.5em;
      direction: ltr;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    input[type='password'],
    input.ltr {
      direction: ltr;
      text-align: start;
    }
    input[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    .day {
      display: grid;
      grid-template-columns: 4.5em 1fr;
      gap: var(--sw-s-2);
      align-items: start;
      padding-block: 4px;
      border-block-end: 1px dashed var(--sw-border);
    }
    .day .dn {
      padding-block-start: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .periods {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .period {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .closed {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      padding-block-start: 8px;
    }
    .holiday {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    .problem {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger-text);
    }
    .check {
      display: flex;
      gap: var(--sw-s-2);
      align-items: center;
      font-size: var(--sw-fs-sm);
    }
    .check input {
      inline-size: auto;
      min-block-size: 0;
    }
    ul.hist {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    ul.hist li {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      padding-block-end: var(--sw-s-2);
      border-block-end: 1px solid var(--sw-border);
    }
    bdi {
      unicode-bidi: isolate;
    }
    @media (max-width: 520px) {
      .grid2 {
        grid-template-columns: minmax(0, 1fr);
      }
      .day {
        grid-template-columns: minmax(0, 1fr);
      }
      .day .dn {
        padding-block-start: 0;
        font-weight: var(--sw-fw-semibold);
      }
    }
  `;z([g({attribute:!1})],x.prototype,"station",2);z([g({type:Boolean})],x.prototype,"live",2);z([u()],x.prototype,"open",2);z([u()],x.prototype,"tab",2);z([u()],x.prototype,"phase",2);z([u()],x.prototype,"view",2);z([u()],x.prototype,"programs",2);z([u()],x.prototype,"holds",2);z([u()],x.prototype,"zone",2);z([u()],x.prototype,"codes",2);z([u()],x.prototype,"codesPhase",2);z([u()],x.prototype,"editing",2);z([u()],x.prototype,"codeForm",2);z([u()],x.prototype,"pending",2);z([u()],x.prototype,"running",2);z([u()],x.prototype,"results",2);x=z([I("wk-door-tech")],x);var Wn=Object.defineProperty,Bn=Object.getOwnPropertyDescriptor,L=(e,t,s,n)=>{for(var a=n>1?void 0:n?Bn(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&Wn(t,s,a),a};const Xe={sync:"refresh",rescan:"search",health_refresh:"activity",clock_refresh:"clock"};let P=class extends M{constructor(){super(...arguments),this.station=null,this.live=!0,this.view=null,this.phase="idle",this.running=null,this.asking=null,this.results={},this.now=Date.now(),this.loadedFor="",this.loadedAt=Date.now(),this.seq=0,this.timer=0}mayRead(){return C("access.admin.read")||C("access.stations.manage")}connectedCallback(){super.connectedCallback(),this.timer=window.setInterval(()=>{this.now=Date.now()},1e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("station")&&this.station&&this.station.id!==this.loadedFor&&(this.loadedFor=this.station.id,this.view=null,this.results={},this.asking=null,this.mayRead()&&this.load()),this.hidden=!this.shown()}shown(){return!!this.station&&this.mayRead()&&(this.phase==="ready"||this.phase==="error"||this.phase==="loading"&&!!this.view)}async load(){const e=this.station?.id;if(!e)return;const t=++this.seq;this.phase="loading";try{const s=await Us(e);if(t!==this.seq)return;this.view=s,this.loadedAt=Date.now(),this.now=this.loadedAt,this.phase="ready"}catch(s){if(t!==this.seq)return;this.phase=s instanceof H&&(s.status===403||s.status===404)?"hidden":"error"}}async run(e){const t=this.station;if(!t||this.running)return;this.asking=null,this.running=e,this.results={...this.results,[e]:{station_id:t.id,action:e,status:"sending",code:null,retry_after_s:null,data:null}};const s=await mt(t.id,e);this.station?.id===t.id&&(this.running=null,this.results={...this.results,[e]:s},this.dispatchEvent(new CustomEvent("station-op",{detail:s,bubbles:!0,composed:!0})),await this.load())}cooldownLeft(e){const t=this.view?.actions?.[e]?.cooldown_s??0;return Math.max(0,Math.ceil(t-(this.now-this.loadedAt)/1e3))}render(){const e=this.station;if(!e||!this.shown())return l;const t=N();return o`<div class="wrap" data-wk-maint=${e.id} data-wk-maint-state=${this.phase}>
      <div class="head">
        <h5><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</h5>
        <wk-action-button tone="quiet" icon="refresh" data-wk-maint-reload ?busy=${this.phase==="loading"} ?disabled=${this.phase==="loading"} @click=${()=>void this.load()}>${t.refresh}</wk-action-button>
      </div>
      ${this.phase==="error"&&!this.view?o`<div class="note" role="status" data-wk-maint-error>${t.unavailable}</div>`:l}
      ${this.view?this.renderHealth(e):l} ${this.view?this.renderOps(e):l} ${this.renderConfirm(e)}
    </div>`}renderHealth(e){const t=this.view,s=N();if(t.health_hidden)return o`<div class="note" data-wk-maint-hidden>${s.healthHidden}</div>`;const n=e.zone,a=t.technical,i=t.report?.health??null,r=a?.reconciled_at??t.report?.auth?.last_sync_ok_at??null,d=i?.events?.stream??a?.event_status?.stream??null,c=i?.clock??a?.clock??null,h=c?.skew_seconds,m=i?.access?.last_error??a?.last_error??null,w=Gs(t),v=Zs(t,s),f=t.report?.auth?.retained??0,E=we=>me(we,this.now,n,S());return o`<dl class="kv" data-wk-maint-health>
      <dt>${s.rows.lastSync}</dt>
      <dd data-wk-maint-last-sync><bdi>${r?E(r):s.never}</bdi></dd>
      ${a?.scanned_at?o`<dt>${s.rows.lastScan}</dt><dd><bdi>${E(a.scanned_at)}</bdi></dd>`:l}
      ${d?o`<dt>${s.rows.stream}</dt><dd data-wk-maint-stream=${d}>${s.stream[d]??s.stream.unknown}</dd>`:l}
      ${c?o`<dt>${s.rows.clock}</dt><dd data-wk-maint-clock>${h==null?s.clockStatus[c.status??""]??s.clockStatus.unavailable:Math.abs(h)<=2?s.clockOk:p(s.clockSkew,{n:Math.round(h)})}${c.checked_at?o` <span class="sub">· <bdi>${E(c.checked_at)}</bdi></span>`:l}</dd>`:l}
      ${i&&(i.consecutive_poll_failures??0)>0?o`<dt>${s.rows.polls}</dt><dd>${i.consecutive_poll_failures}</dd>`:l}
      <dt>${s.rows.lastError}</dt>
      <dd data-wk-maint-last-error>${m?o`${ge(m,s)}${ge(m,s)!==m?o` <code>${m}</code>`:l}`:o`<span class="sub">${s.none}</span>`}</dd>
      <dt>${s.rows.auth}</dt>
      <dd>
        <div class="auth ${w||v.length?"bad":""}" data-wk-maint-auth=${w?w.source:"none"}>
          ${w?o`<span data-wk-maint-auth-line>${w.step?p(s.authLine,{source:s.authSources[w.source]??w.source,step:Js(w.step,s),at:w.at?E(w.at):s.never}):p(s.authObserved,{source:s.authSources[w.source]??w.source,at:w.at?E(w.at):s.never})}</span>${w.status_code!==null&&w.status_code!==void 0?o`<span class="sub">${p(s.authCode,{code:`${w.status_code}${w.sub_status?` / ${w.sub_status}`:""}`})}</span>`:l}`:o`<span class="sub">${s.authNone}</span>`}
          ${v.length?o`<span data-wk-maint-auth-now>${p(s.authNow,{what:v.join(" · ")})}</span>`:l}
          ${f>0?o`<span class="sub" data-wk-maint-auth-count>${p(s.authCount,{n:f})}</span>`:l}
        </div>
      </dd>
    </dl>`}renderOps(e){const t=this.view,s=N(),n=ut.filter(i=>t.actions?.[i]?.allowed);if(!n.length)return l;const a=t.online??e.online;return o`${a?l:o`<div class="note" data-wk-maint-offline>${s.offlineHint}</div>`}
      <div class="ops" data-wk-maint-ops>
        ${n.map(i=>{const r=t.actions[i].needs_online,d=this.cooldownLeft(i),c=this.running===i,h=!this.live||!!this.running||r&&!a||d>0,m=this.results[i],w=t.last_runs?.[i]??null,v=m?ve(m.status,m.code,s):d>0?p(s.cooldown,{n:d}):w?p(s.lastRun,{status:ve(w.status,w.code,s),at:me(w.at,this.now,e.zone,S())}):"",f=m?be(m.status):w?be(w.status):"busy";return o`<div class="op">
            <wk-action-button icon=${Xe[i]} data-wk-maint-op=${i} ?busy=${c} ?disabled=${h} @click=${()=>this.asking=i}>${s.actions[i]}</wk-action-button>
            <span class="line" role="status" data-wk-maint-result=${i} data-status=${m?.status??w?.status??""} data-tone=${m||w?f:""}>${v}</span>
          </div>`})}
      </div>`}renderConfirm(e){const t=this.asking;if(!t)return l;const s=N(),n=s.confirm[t];return o`<sw-dialog open heading=${n.title} data-wk-maint-confirm=${t} @close=${a=>a.target===a.currentTarget&&(this.asking=null)}>
      <p class="sentence" data-wk-maint-sentence>${p(n.one,{name:e.name})}</p>
      <div slot="footer">
        <wk-action-button data-wk-maint-cancel @click=${()=>this.asking=null}>${s.confirm.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon=${Xe[t]} data-wk-maint-send ?disabled=${!this.live} @click=${()=>void this.run(t)}>${s.confirm.send}</wk-action-button>
      </div>
    </sw-dialog>`}};P.styles=q`
    :host {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding-block-start: var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      min-block-size: 32px;
    }
    h5 {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
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
    .auth {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .auth.bad {
      color: var(--sw-danger-text);
    }
    .sub {
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    code {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .ops {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sw-s-2);
    }
    .op {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
    }
    .line {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-block-size: 1.2em;
      overflow-wrap: anywhere;
    }
    .line[data-tone='ok'] {
      color: var(--sw-success-text, var(--sw-text-2));
    }
    .line[data-tone='err'] {
      color: var(--sw-danger-text);
    }
    .line[data-tone='warn'] {
      color: var(--sw-warning-text);
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
    }
    .sentence {
      margin: 0;
      font-size: var(--sw-fs-base);
      line-height: 1.5;
    }
    @media (max-width: 420px) {
      .ops {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;L([g({attribute:!1})],P.prototype,"station",2);L([g({type:Boolean})],P.prototype,"live",2);L([u()],P.prototype,"view",2);L([u()],P.prototype,"phase",2);L([u()],P.prototype,"running",2);L([u()],P.prototype,"asking",2);L([u()],P.prototype,"results",2);L([u()],P.prototype,"now",2);P=L([I("wk-station-maintenance")],P);var Un=Object.defineProperty,Kn=Object.getOwnPropertyDescriptor,se=(e,t,s,n)=>{for(var a=n>1?void 0:n?Kn(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&Un(t,s,a),a};const Vn=8,Yn=3e4,Gn=`
  wk-call-history { display: contents; }
  wk-call-history ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  wk-call-history li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--sw-s-2, 8px); padding-block: 6px;
    border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm, 13px); }
  wk-call-history li:last-child { border-block-end: 0; }
  wk-call-history .cw { color: var(--sw-text-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
  wk-call-history .cx { min-inline-size: 0; display: grid; }
  wk-call-history .cx span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  wk-call-history .cx small, wk-call-history .cd { color: var(--sw-text-3); }
  wk-call-history .cd { font-variant-numeric: tabular-nums; }
  wk-call-history li[data-tone='warn'] .cx span { color: var(--sw-warning-text); }
  wk-call-history li[data-tone='live'] .cx span { color: var(--sw-success-text); font-weight: var(--sw-fw-semibold, 600); }
  wk-call-history .cm { background: none; border: 0; padding: 6px 0; font: inherit; font-size: var(--sw-fs-sm, 13px); color: var(--sw-accent-text); cursor: pointer; min-block-size: 32px; }
  wk-call-history .cm:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 2px; }
`;let G;function Zn(){if(G===void 0)try{G=new CSSStyleSheet,G.replaceSync(Gn)}catch{G=null}return G}function Jn(e){const t=Zn(),s=e;if(!(!t||!("adoptedStyleSheets"in s)||s.adoptedStyleSheets.includes(t)))try{s.adoptedStyleSheets=[...s.adoptedStyleSheets,t]}catch{}}let B=class extends M{constructor(){super(...arguments),this.stationId="",this.zone="",this.rows=null,this.next=null,this.timer=0}createRenderRoot(){return this}allowed(){return Z()&&C("access.read")&&(C("access.events.read")||C("access.call"))}connectedCallback(){super.connectedCallback(),Jn(this.getRootNode()),this.style.display="contents",this.timer=window.setInterval(()=>{document.hidden||this.load(!1)},Yn)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("stationId")&&(this.rows=null,this.next=null,this.load(!1))}async load(e){if(!this.stationId||!this.allowed())return;const t=this.stationId;try{const s=await Dt(t,Vn,e?this.next:null);if(t!==this.stationId)return;this.rows=e?[...this.rows??[],...s.calls]:s.calls,this.next=s.next}catch{}}when(e){const t=new Date(e),s={day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:!1},n=document.documentElement.lang||"he";try{return new Intl.DateTimeFormat(n,this.zone?{...s,timeZone:this.zone}:s).format(t)}catch{return new Intl.DateTimeFormat(n,s).format(t)}}render(){if(!this.allowed()||!this.rows?.length)return l;const e=Lt(),t=e.log;return o`<section class="dsec" data-wk-dsec="calls" data-call-log="ready">
      <h4><sw-icon name="history" size=${14}></sw-icon>${t.title}</h4>
      <ul>
        ${this.rows.map(s=>{const n=Nt(s,e),a=Rt(s);return o`<li data-call-row=${s.id} data-outcome=${s.outcome??s.state} data-tone=${n.tone}>
            <span class="cw" dir="ltr">${this.when(s.rang_at)}</span>
            <span class="cx"><span>${n.text}</span>${s.door_opened_at?o`<small data-call-row-door>${Mt(t.door,{name:s.door_opened_by_name||""})}</small>`:l}</span>
            <span class="cd" dir="ltr">${a!==null?It(a):""}</span>
          </li>`})}
      </ul>
      ${this.next?o`<button class="cm" data-call-log-more @click=${()=>void this.load(!0)}>${t.more}</button>`:l}
    </section>`}};se([g({attribute:"station-id"})],B.prototype,"stationId",2);se([g()],B.prototype,"zone",2);se([u()],B.prototype,"rows",2);se([u()],B.prototype,"next",2);B=se([I("wk-call-history")],B);function Xn(e,t){return o`<wk-call-history station-id=${e} zone=${t?.kind==="iana"?t.name:""}></wk-call-history>`}function Qn(e){return!Z()||!C("access.stations.manage")?l:o`<dt>בדיקת קבלה</dt><dd><a href=${qs(e)} data-wk-live-validation=${e}>הרצת בדיקת קבלה לעמדה</a></dd>`}const ft=(e,t)=>t.zone??e.defaultZone,F=(e,t)=>me(t.last_seen,e.now,ft(e,t),e.text),ce=e=>t=>{t.stopPropagation(),e()};function ze(e,t){return t.camera_entity?e.media?e.failed[t.id]===e.poster?"failed":"image":"none":t.has_camera?"none":"nocam"}const Ce=(e,t)=>it(t.id,e.poster);function gt(e,t,s){const n=e.text.still,a=s==="nocam"?n.none:s==="failed"?n.failed:n.offline;return o`<div class="none" role="status"><sw-icon name=${s==="nocam"?"camera":"offline"} size=${20}></sw-icon><span>${t.online||s==="nocam"?a:n.offline}</span></div>`}function ea(e,t){if(!ht(t)&&!(t.online&&t.call_state==="ending"))return l;if(!K(e.policy,e.rights))return l;const s=t.call_state==="ringing";return o`<span class="callbadge ${t.call_state}" data-wk-call-badge=${t.call_state}>${s?o`<sw-icon name="bell" size=${14}></sw-icon>`:o`<span class="ic">${he("phone",14)}</span>`}${X(t.call_state,e.text)}</span>`}function ta(e,t){const s=e.text,n=ze(e,t),a=ue(t.id,e.places),i=t.online?`${s.still.tag} · ${dt(e.poster)}`:F(e,t);return o`<div class="media ${t.online?"":"off"}" data-wk-still=${t.id} data-still-state=${n}>
    ${n==="image"?o`<img src=${Ce(e,t)} alt=${p(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} /><span class="stamp"><bdi>${i}</bdi></span>`:gt(e,t,n)}
    ${ea(e,t)}
    <button type="button" class="open" data-wk-open=${t.id} aria-label=${t.name} @click=${()=>e.open(t.id)}></button>
    <div class="scrim"><span class="name">${t.name}</span>${a?o`<span class="place">${a}</span>`:l}</div>
  </div>`}function sa(e,t){const s=ze(e,t);return o`<span class="thumb ${t.online?"":"off"}" data-wk-thumb=${t.id}>${s==="image"?o`<img src=${Ce(e,t)} alt="" decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:o`<sw-icon name="camera" size=${18}></sw-icon>`}</span>`}function J(e,t,s,n,a,i){const r=e.actions.armed,d=!!r&&r.id===t.id&&r.command===s&&r.callState===t.call_state;return o`<wk-action-button
    tone=${n}
    icon=${a}
    data-wk-call=${s}
    ?armed=${d}
    ?disabled=${!e.live||e.actions.callBusy.has(t.id)}
    label=${d?p(e.text.call.armedAria,{label:i}):i}
    @click=${c=>{c.stopPropagation(),e.call(t,s,c)}}
    >${d?e.text.call.armed:i}</wk-action-button
  >`}function na(e,t=!1){const s=e.text.talk;return o`<wk-action-button tone="dashed" icon="window" href=${W()} data-wk-talk="classic" label=${s.hint} ?block=${t} size=${t?"lg":"md"} @click=${n=>n.stopPropagation()}
    >${t?s.classic:s.classicShort}</wk-action-button
  >`}function vt(e,t,s){const n=e.talkControl?.(t,s);return n!==void 0?n:e.rights.talk?na(e,s):l}function bt(e,t,s=!1){const n=e.text,a=t.online?t.call_state:"unavailable";if(a!=="ringing"&&a!=="in_call"&&a!=="ending")return l;if(!K(e.policy,e.rights))return l;const i=e.clock.seconds(t.id,e.now),r=a==="ringing"?o`<sw-icon name="bell" size=${15}></sw-icon>`:he("phone",15),d=e.rights.call&&a!=="ending";return o`<div class="callrow ${a} ${s?"big":""}" data-wk-call-row=${t.id} data-call=${a} role="group" aria-label=${n.call.group}>
    <span class="cs">${r}<span>${X(a,n)}</span>${i!==null?o`<span class="dur" data-wk-call-clock>${fe(i)}</span>`:l}</span>
    ${d?o`<span class="ctl">${a==="ringing"?o`${J(e,t,"answer","ok","phone",n.call.answer)}${J(e,t,"reject","danger","close",n.call.reject)}`:o`${s?l:vt(e,t,!1)}${J(e,t,"hangUp","danger","hangup",n.call.hangUp)}`}</span>`:l}
  </div>`}function Te(e,t){if(!e.rights.door)return l;const s=e.text.door;return o`${Q(t).map(n=>{const a=`${t.id}/${n.physical_index}`,i=e.actions.isHeld(a),r=e.actions.releasing.has(a),d=i?"held":r?"sending":"idle",c=i?s.held:r?s.sending:t.locks.length>1?p(s.openNamed,{name:_e(n,e.text)}):s.open;return o`<wk-action-button
      class="grow"
      icon="unlock"
      data-wk-door=${a}
      data-state=${d}
      ?busy=${r}
      ?disabled=${!e.live||!t.online||r||i}
      @click=${ce(()=>e.door(t,n.physical_index))}
      >${c}</wk-action-button
    >`})}`}function aa(e,t){return!e.rights.announce||!t.online?l:o`<wk-action-button icon="volume" icon-only data-wk-announce-at=${t.id} label=${e.text.announce} ?disabled=${!e.live} @click=${ce(()=>e.announce(t.id))}></wk-action-button>`}function kt(e,t,s=!1){const n=e.actions.results[t.id];return n?o`<div class="result ${n.tone} ${s?"sticky":""}" role="status" data-wk-result=${t.id} data-tone=${n.tone}>${n.text}</div>`:l}function ia(e,t,s){t.composedPath().some(a=>a instanceof HTMLElement&&a.matches("button, a, wk-action-button, select, input, textarea, summary"))||e.open(s)}function oa(e,t){const s=t.technical;return s?o`<div class="tech" data-wk-tech-row>
    <sw-badge kind=${Se(t.sync_state)} label=${pe(t.sync_state,e.text)} data-wk-sync=${t.sync_state}></sw-badge>
    <span class="sp"></span>
    ${s.model?o`<code>${s.model}</code>`:l}
  </div>`:l}function ra(e,t){const s=e.text,n=ct(t),a=e.rights.door&&Q(t).length>0||e.rights.announce&&t.online;return o`<sw-card flush interactive class="card ${n==="ringing"?"ringing":""}" data-wk-station=${t.id} data-status=${n} @click=${i=>ia(e,i,t.id)}>
    ${ta(e,t)}
    <div class="cb">
      <div class="hd">
        <sw-badge kind=${t.online?"live":"offline"} label=${t.online?s.status.online:s.status.offline}></sw-badge>
        <span>${s.seen.prefix} <b><bdi>${F(e,t)}</bdi></b></span>
      </div>
      ${bt(e,t)}
      ${a?o`<div class="acts">${Te(e,t)}${aa(e,t)}</div>`:l}
      ${kt(e,t)} ${oa(e,t)}
    </div>
  </sw-card>`}function ke(e,t,s=!1){const n=t.online?t.call_state:"";if(n!=="ringing"&&n!=="in_call"&&n!=="ending")return l;if(!K(e.policy,e.rights))return l;const a=e.clock.seconds(t.id,e.now),i=`${X(n,e.text)}${a!==null?` · ${fe(a)}`:""}`;return s?o`<sw-badge kind=${n==="ringing"?"stale":"recorded"} label=${i} data-wk-call-pill=${n}></sw-badge>`:o`<span class="pillcall ${n}" data-wk-call-pill=${n}>${X(n,e.text)}${a!==null?o` · <span class="dur">${fe(a)}</span>`:l}</span>`}function la(e,t){const s=e.text,a=[ue(t.id,e.places),t.technical?pe(t.sync_state,s):""].filter(Boolean).join(" · "),i=e.rights.call&&t.online&&t.call_state==="ringing"&&K(e.policy,e.rights);return o`<div class="row" data-wk-station=${t.id} data-status=${ct(t)}>
    <button type="button" class="rowmain" data-wk-open=${t.id} @click=${()=>e.open(t.id)}>
      ${sa(e,t)}
      <span class="rowtext"><span class="t"><span class="sdot ${t.online?"":"off"}" aria-hidden="true"></span><b>${t.name}</b></span>${a?o`<span class="s">${a}</span>`:l}</span>
    </button>
    <div class="rowside">
      ${ke(e,t)}
      <span class="seen">${s.seen.prefix} <bdi>${F(e,t)}</bdi></span>
      <div class="rowacts">
        ${i?J(e,t,"answer","ok","phone",s.call.answer):l}${Te(e,t)}
      </div>
      <sw-icon name="chevron" size=${16} aria-hidden="true"></sw-icon>
    </div>
  </div>`}function da(e,t){return o`<sw-card flush class="rows-card"><div class="rows" data-wk-rows>${at(t,s=>s.id,s=>la(e,s))}</div></sw-card>`}function ca(e,t){return o`<div class="grid" data-wk-grid>${at(t,s=>s.id,s=>ra(e,s))}</div>`}function ha(e,t){const s=e.text,n=c=>c,a=t.some(c=>c.technical),i=o`<span style="color:var(--sw-text-3)">—</span>`,r=e.table==="compact"||e.table==="none",d=[{key:"name",label:s.table.station,render:c=>o`<wk-action-button tone="quiet" data-wk-open=${n(c).id} @click=${()=>e.open(n(c).id)}>${n(c).name}</wk-action-button>`},{key:"status",label:s.table.status,render:c=>{const h=n(c),m=o`<sw-badge kind=${h.online?"live":"offline"} label=${h.online?s.status.online:s.status.offline}></sw-badge>`;if(!r)return m;const w=ke(e,h,!0),v=h.online?l:o`<small style="color:var(--sw-text-3);font-size:var(--sw-fs-xs)"><bdi>${F(e,h)}</bdi></small>`;return w===l&&v===l?m:o`<span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:var(--sw-s-1)">${m}${w}${v}</span>`}}];return r||d.push({key:"call",label:s.table.call,render:c=>ke(e,n(c),!0)}),d.push({key:"actions",label:s.table.actions,render:c=>{const h=n(c),m=e.rights.call&&h.online&&h.call_state==="ringing"&&K(e.policy,e.rights);return o`<span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:var(--sw-s-2);max-inline-size:190px">${m?J(e,h,"answer","ok","phone",s.call.answer):l}${Te(e,h)}</span>`}}),r||d.push({key:"place",label:s.table.place,render:c=>o`<span style="display:inline-block;white-space:normal;max-inline-size:130px;vertical-align:middle">${ue(n(c).id,e.places)||"—"}</span>`},{key:"seen",label:s.table.seen,render:c=>o`<bdi>${F(e,n(c))}</bdi>`}),e.table==="full"&&d.push({key:"doors",label:s.table.doors,render:c=>o`<span style="display:inline-block;white-space:normal;max-inline-size:120px;vertical-align:middle">${Q(n(c)).map(h=>_e(h,s)).join(", ")||"—"}</span>`}),a&&(d.push({key:"sync",label:s.table.sync,render:c=>n(c).technical?o`<sw-badge kind=${Se(n(c).sync_state)} label=${pe(n(c).sync_state,s)}></sw-badge>`:i}),e.table==="full"&&d.push({key:"model",label:s.table.model,ltr:!0,render:c=>{const h=n(c).technical;return h?.model||h?.firmware?o`<span style="display:inline-block;vertical-align:middle">${h.model?o`<span style="display:block">${h.model}</span>`:l}${h.firmware?o`<span style="display:block;color:var(--sw-text-3)">${h.firmware}</span>`:l}</span>`:i}})),d}function ua(e,t){const s=t.technical;if(!s)return l;const n=e.text,a=s.reconciled_at&&/(Z|[+-]\d\d:\d\d)$/.test(s.reconciled_at)?gs(Date.parse(s.reconciled_at),e.now,ft(e,t)??void 0,n):"",i=s.clock?.skew_seconds,r=i==null?"":Math.abs(i)<=2?n.tech.clockOk:p(n.tech.clockDrift,{n:Math.round(i)}),d=s.event_status?.stream,c=d?d==="connected"?n.tech.streamOk:["disconnected","unavailable","stopped","authentication_failed"].includes(d)?n.tech.streamDown:n.tech.streamUnknown:"";return o`<section class="dsec" data-wk-dsec="technical">
    <h4><sw-icon name="cpu" size=${14}></sw-icon>${n.drawer.technical}</h4>
    <dl class="kv">
      <dt>${n.tech.sync}</dt>
      <dd><sw-badge kind=${Se(t.sync_state)} label=${pe(t.sync_state,n)}></sw-badge>${a?o` · <bdi>${a}</bdi>`:l}</dd>
      ${s.model?o`<dt>${n.tech.model}</dt><dd><code>${s.model}</code></dd>`:l}
      ${s.firmware?o`<dt>${n.tech.firmware}</dt><dd><code>${s.firmware}</code></dd>`:l}
      <dt>${n.tech.relays}</dt>
      <dd>${p(n.tech.relaysValue,{n:t.locks.length,mode:t.lock_enabled?n.tech.relayOn:n.tech.relayOff})}</dd>
      ${Qn(t.id)}
      ${r?o`<dt>${n.tech.clock}</dt><dd>${r}</dd>`:l} ${c?o`<dt>${n.tech.stream}</dt><dd>${c}</dd>`:l}
      ${t.errors?o`<dt>${n.tech.lastError}</dt><dd>${t.errors.last_error?o`<code data-wk-last-error>${t.errors.last_error}</code>`:o`<span class="muted">${n.tech.none}</span>`}</dd>`:l}
      ${t.errors?.scan_error?o`<dt>${n.tech.scanError}</dt><dd><code>${t.errors.scan_error}</code></dd>`:l}
    </dl>
    <wk-deep-links place="station"></wk-deep-links>
    <wk-station-maintenance .station=${t} ?live=${e.live}></wk-station-maintenance>
  </section>`}function yt(e,t){const s=e.text.prog;if(t.state==="ready")return l;const n=t.state==="unsupported"?s.unsupported:t.state==="busy"?s.busy:t.state==="error"?s.unavailable:s.loading;return o`<div class="muted" role="status" data-wk-fetch=${t.state}>${n}${t.state==="error"||t.state==="busy"?o` · <wk-action-button tone="quiet" @click=${()=>e.retryDetail()}>${e.text.retry}</wk-action-button>`:l}</div>`}function pa(e,t,s){const n=e.text;if(!s||s.programs.state!=="ready")return s?yt(e,s.programs):o`<div class="muted" role="status" data-wk-fetch="loading">${n.prog.loading}</div>`;const a=vs(s.programs.data,t,n);return a.length?o`${a.map(i=>o`<div class="prog" data-wk-program=${i.door}>
      <div class="ph">
        <span>${i.name}</span>
        ${i.none?o`<sw-badge kind="neutral" label=${n.prog.none}></sw-badge>`:o`<sw-badge kind=${i.removing?"stale":i.enabled?"live":"offline"} label=${i.removing?n.prog.removing:i.enabled?n.prog.on:n.prog.off}></sw-badge>${i.status&&i.enabled&&!i.removing?o`<sw-badge kind="recorded" label=${i.status}></sw-badge>`:l}`}
      </div>
      ${i.hours.map(r=>o`<div class="line">${n.prog.hours}: <bdi>${r}</bdi></div>`)}
      ${i.holidays?o`<div class="line muted">${p(n.prog.holidays,{n:i.holidays})}</div>`:l}
      ${i.error?o`<div class="line"><sw-badge kind="error" label=${n.prog.error}></sw-badge></div>`:l}
      ${!i.none&&i.unreadable?o`<div class="line muted">${n.prog.unknownShape}</div>`:l}
    </div>`)}`:l}function wa(e,t){const s=e.text;if(!t)return l;if(t.codes.state!=="ready")return o`<div class="prog">${yt(e,t.codes)}</div>`;const n=bs(t.codes.data,s);return o`<div class="prog" data-wk-codes=${n.state}>
    <div class="ph"><span>${s.prog.codes}</span><sw-badge kind=${n.state==="set"?"live":n.state==="unset"?"offline":"unknown"} label=${n.label}></sw-badge></div>
    ${n.slots.length>1?n.slots.map(a=>o`<div class="line">${a.label}: ${a.state==="set"?s.prog.codeConfigured:a.state==="unset"?s.prog.codeNotConfigured:s.prog.codeUnknown}</div>`):l}
  </div>`}function ma(e,t){if(!t.technical)return l;const s=e.features.door_programs!==!1,n=e.features.public_codes!==!1;if(!s&&!n)return l;const a=e.text,i=e.detail[t.id];return o`<section class="dsec" data-wk-dsec="settings">
    <button type="button" class="toggle" aria-expanded=${String(e.detailOpen)} data-wk-settings-toggle @click=${()=>e.toggleDetail()}>
      <sw-icon name="chevronDown" size=${14}></sw-icon><span>${a.drawer.doorSettings}</span>
    </button>
    ${e.detailOpen?o`${s&&Q(t).length?pa(e,t,i):l}${n?wa(e,i):l}`:l}
    ${e.detailOpen?o`<wk-door-tech .station=${t} ?live=${e.live} @door-tech-changed=${()=>e.retryDetail()}></wk-door-tech>`:l}
  </section>`}function fa(e,t){const s=ws(t.id,Ee.events==="smplwise",C("access.events.read")),n=ms(t,Ee.schedules==="smplwise",C("access.stations.read"));return!s&&!n?l:o`<div class="evlink">
    ${s?o`<wk-action-button tone="quiet" icon="history" href=${s} data-wk-station-events=${t.id}>${fs("stationEvents")}</wk-action-button>`:l}
    ${n?o`<wk-action-button tone="quiet" icon="calendar" href=${n} data-wk-station-schedules=${t.id}>${e.text.drawer.schedules}</wk-action-button>`:l}
  </div>`}function ga(e,t){const s=e.text,n=ze(e,t),a=ue(t.id,e.places),i=Q(t),r=e.rights.call||K(e.policy,e.rights)&&(t.online?["ringing","in_call","ending"].includes(t.call_state):!1),d=t.online&&["ringing","in_call","ending"].includes(t.call_state),c=e.actions.tts[t.id],h=c?lt(c,s):"",m=e.liveArea?.(t)??null,w=e.rights.call&&t.online?e.dialControl?.(t,d):void 0;return o`
    ${m??o`<div class="live ${t.online?"":"off"}" data-wk-live data-still-state=${n}>
      ${n==="image"?o`<img src=${Ce(e,t)} alt=${p(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:gt(e,t,n)}
      ${n==="image"?o`<span class="stamp"><bdi>${s.drawer.lastStill} · ${t.online?dt(e.poster):F(e,t)}</bdi></span>`:l}
      <div class="ov"><span class="t"><sw-icon name="play" size=${16}></sw-icon>${s.drawer.liveClassic}</span><wk-action-button icon="window" href=${W()} data-wk-classic-link>${s.drawer.openClassic}</wk-action-button></div>
    </div>`}
    <div class="meta">${a?o`<span>${a}</span>`:l}<span>${s.seen.prefix} <bdi>${F(e,t)}</bdi></span></div>
    ${fa(e,t)}
    ${kt(e,t,!0)}
    ${r?o`<section class="dsec" data-wk-dsec="call">
          <h4>${he("phone",14)}${s.drawer.call}</h4>
          ${d?o`${bt(e,t,!0)}${t.call_state==="in_call"?vt(e,t,!0):l}`:o`<div class="callrow"><span class="cs muted">${s.call.none}</span>${e.rights.call&&t.online&&w===void 0?o`<wk-action-button tone="dashed" icon="phone" href=${W()} data-wk-dial>${s.call.dial}</wk-action-button>`:l}</div>`}
          ${w??l}
        </section>`:l}
    ${i.length||e.rights.door?o`<section class="dsec" data-wk-dsec="doors">
          <h4><sw-icon name="door" size=${14}></sw-icon>${s.drawer.doors}</h4>
          ${i.length?i.map(v=>{const E=e.detail[t.id]?.programs.data?.programs.find(we=>we.door===v.physical_index)?.execution?.status==="held_acknowledged";return o`<div class="doorrow" data-wk-doorrow=${v.physical_index}>
                  <span class="dn">${_e(v,s)}</span>
                  <span class="ds">${E?o`<sw-icon name="clock" size=${12}></sw-icon>${s.prog.state.held_acknowledged}`:l}</span>
                  ${e.rights.door?o`<wk-action-button
                        icon="unlock"
                        data-wk-door=${`${t.id}/${v.physical_index}`}
                        data-state=${e.actions.isHeld(`${t.id}/${v.physical_index}`)?"held":e.actions.releasing.has(`${t.id}/${v.physical_index}`)?"sending":"idle"}
                        ?busy=${e.actions.releasing.has(`${t.id}/${v.physical_index}`)}
                        ?disabled=${!e.live||!t.online||e.actions.releasing.has(`${t.id}/${v.physical_index}`)||e.actions.isHeld(`${t.id}/${v.physical_index}`)}
                        @click=${ce(()=>e.door(t,v.physical_index))}
                        >${e.actions.isHeld(`${t.id}/${v.physical_index}`)?s.door.held:e.actions.releasing.has(`${t.id}/${v.physical_index}`)?s.door.sending:s.door.open}</wk-action-button
                      >`:l}
                </div>`}):o`<span class="muted">${s.door.none}</span>`}
        </section>`:l}
    ${e.rights.announce?o`<section class="dsec" data-wk-dsec="announce">
          <h4><sw-icon name="volume" size=${14}></sw-icon>${s.drawer.announce}</h4>
          <div class="callrow"><span class="cs muted" data-wk-announce-state>${h||s.drawer.announceHint}</span><wk-action-button icon="volume" data-wk-announce-at=${t.id} ?disabled=${!e.live||!t.online} @click=${ce(()=>e.announce(t.id))}>${s.announce}</wk-action-button></div>
        </section>`:l}
    ${Xn(t.id,t.zone)}
    ${ua(e,t)} ${ma(e,t)}
  `}var va=Object.defineProperty,ba=Object.getOwnPropertyDescriptor,$=(e,t,s,n)=>{for(var a=n>1?void 0:n?ba(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(a=(n?r(t,s,a):r(a))||a);return n&&a&&va(t,s,a),a};const $t="sw.wiskey.stations.view",xt="sw.wiskey.stations.treeCollapsed",Qe=3e4;function _t(e){try{return localStorage.getItem(e)}catch{return null}}function et(e,t){try{localStorage.setItem(e,t)}catch{}}const ka=()=>{const e=_t($t);return e==="list"||e==="table"?e:"cards"},ya=()=>{try{const e=JSON.parse(_t(xt)??"[]");return new Set(Array.isArray(e)?e.filter(t=>typeof t=="string"):[])}catch{return new Set}},oe={kind:"iana",name:"Asia/Jerusalem"},tt=[{id:"d1",name:"שער ראשי",online:!0,call_state:"ringing",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:oe,technical:null,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:oe,technical:null,errors:null},{id:"d3",name:"חניון",online:!0,call_state:"idle",sync_state:"pending",lock_enabled:!1,locks:[],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:oe,technical:null,errors:null},{id:"d4",name:"מחסן",online:!1,call_state:"unavailable",sync_state:"offline",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!1,camera_entity:null,last_seen:"2026-09-26T19:02:00+03:00",zone:oe,technical:null,errors:null}];let k=class extends M{constructor(){super(...arguments),this.feed=null,this.error="",this.forbidden=!1,this.filter="all",this.query="",this.view=ka(),this.place="all",this.places=null,this.collapsed=ya(),this.selected=null,this.sheet=!1,this.announceOpen=!1,this.announceFor="",this.policy=ks,this.features={},this.detail={},this.detailOpen=!1,this.now=Date.now(),this.poster=Date.now(),this.failed={},this.table=Fe(typeof window>"u"?1440:window.innerWidth),this.mediaMode="off",this.media={},this.mediaAt={},this.clock=new ys,this.actions=new de({release:(e,t)=>Ht(e,t),signal:(e,t)=>qt(e,t),station:e=>this.list().find(t=>t.id===e),live:()=>this.isLive(),now:()=>Date.now(),tick:()=>performance.now(),after:(e,t)=>window.setTimeout(e,t),cancel:e=>window.clearTimeout(e),changed:()=>this.requestUpdate(),refetch:()=>void this.load(),stamp:()=>Ft(new Date)}),this.stop=null,this.stopRoute=null,this.poll=0,this.tickTimer=0,this.posterTimer=0,this.loading=!1,this.loadAgain=!1,this.placesKey="",this.detailAt={},this.mqc=typeof matchMedia=="function"?matchMedia(`(max-width: ${$s}px)`):null,this.mqm=typeof matchMedia=="function"?matchMedia(`(max-width: ${xs}px)`):null,this.mqn=typeof matchMedia=="function"?matchMedia(`(max-width: ${_s-1}px)`):null,this.onMedia=()=>{this.table=Fe(window.innerWidth)}}connectedCallback(){if(super.connectedCallback(),this.mqc?.addEventListener("change",this.onMedia),this.mqm?.addEventListener("change",this.onMedia),this.mqn?.addEventListener("change",this.onMedia),this.stopRoute=jt(e=>this.onRoute(e)),!!Z()){if(!C("access.read")){this.forbidden=!0;return}this.load(),this.readFeatures(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.poster=Date.now())},Ss),this.stop=Wt(e=>{e.type==="intercom_tts"?this.actions.noteTts(e.status):e.type!=="heartbeat"&&this.load()},e=>{this.setPolling(!e),e&&this.load()}),this.schedule()}}disconnectedCallback(){super.disconnectedCallback(),this.mqc?.removeEventListener("change",this.onMedia),this.mqm?.removeEventListener("change",this.onMedia),this.mqn?.removeEventListener("change",this.onMedia),this.stop?.(),this.stop=null,this.stopRoute?.(),this.stopRoute=null,this.setPolling(!1),window.clearInterval(this.posterTimer),window.clearTimeout(this.tickTimer),this.actions.dispose()}updated(e){(e.has("selected")||e.has("detailOpen"))&&this.maybeLoadDetail(),(e.has("selected")||e.has("mediaMode"))&&this.maybeLoadMedia()}setPolling(e){window.clearInterval(this.poll),this.poll=e?window.setInterval(()=>void this.load(),zs):0}schedule(){window.clearTimeout(this.tickTimer),this.tickTimer=window.setTimeout(()=>{this.now=Date.now(),this.clock.observe(this.list(),this.now),this.actions.prune(),this.schedule()},this.clock.active?1e3:2e4)}onRoute(e){if(e.mode!=="wiskey")return;const t=e.params.get("station");t&&t!==this.selected?(this.selected=t,this.detailOpen=!1):!t&&this.selected&&(this.selected=null,this.detailOpen=!1)}demo(){return!Z()}list(){return this.demo()?tt:this.feed?.stations??[]}isLive(){return!this.demo()&&this.feed?.state==="ready"&&this.feed.fresh!==!1}rights(){return this.demo()?Cs:Ts(Pe,this.policy,C)}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{const e=await Jt();this.feed=e,this.error="",this.forbidden=!1,this.afterLoad(e)}catch(e){e instanceof H&&e.status===403?this.forbidden=!0:this.error=ye(e)}}while(this.loadAgain)}finally{this.loading=!1}}afterLoad(e){this.now=Date.now(),this.clock.observe(e.stations??[],this.now),this.actions.dropStaleArm(),this.readPolicy(),this.ensurePlaces(e.stations??[]),this.maybeLoadMedia(),this.schedule()}async readPolicy(){try{const e=await $e();this.policy=Os(e),this.mediaMode=Bt(e)}catch{}}async readFeatures(){try{const e=await Xt();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([t,s])=>[t,s.available]))}catch{}}async ensurePlaces(e){const t=e.filter(n=>n.camera_entity),s=t.map(n=>`${n.id}:${n.camera_entity}`).sort().join("|");if(s!==this.placesKey){if(this.placesKey=s,!t.length||!C("devices.read")){this.places=null;return}try{const[n,a]=await Promise.all([Ut(),Kt(t.map(i=>i.camera_entity))]);if(s!==this.placesKey)return;this.places=As(e,n,a.entities)}catch{this.places=null}}}maybeLoadDetail(){const e=this.selected;if(!e||!this.detailOpen||this.demo()||!this.list().find(n=>n.id===e)?.technical)return;const s=this.detailAt[e]??0;this.detail[e]&&Date.now()-s<Qe||this.loadDetail(e)}async loadDetail(e){this.detailAt={...this.detailAt,[e]:Date.now()};const t={state:"loading",data:null};this.detail={...this.detail,[e]:{programs:t,codes:t}};const s=a=>this.detail={...this.detail,[e]:{...this.detail[e],...a}},n=(a,i)=>a.state==="ready"&&i?{state:"ready",data:i}:a.state==="unsupported"?{state:"unsupported",data:null}:a.last_error==="busy"||a.last_error==="rate_limited"||a.last_error==="timeout"?{state:"busy",data:null}:{state:"error",data:null};if(this.features.door_programs!==!1)try{const a=await ot(e);s({programs:n(a,a.programs)})}catch{s({programs:{state:"error",data:null}})}else s({programs:{state:"unsupported",data:null}});if(this.features.public_codes!==!1)try{const a=await rt(e);s({codes:n(a,a.codes)})}catch{s({codes:{state:"error",data:null}})}else s({codes:{state:"unsupported",data:null}})}maybeLoadMedia(){const e=this.selected;!e||this.mediaMode==="off"||this.demo()||this.media[e]!==void 0&&Date.now()-(this.mediaAt[e]??0)<Qe||(this.mediaAt={...this.mediaAt,[e]:Date.now()},Vt(e).then(t=>this.media={...this.media,[e]:t}).catch(()=>this.media={...this.media,[e]:null}))}posterOf(e){return!e.camera_entity||this.demo()||!De("go2rtc")||this.failed[e.id]===this.poster?"":it(e.id,this.poster)}liveArea(e,t){if(this.mediaMode==="off")return null;const s=this.media[e.id];if(!s||s.state!=="ready")return null;const n=!!s.video?.allowed&&Object.keys(s.video.paths).length>0;if(!n&&!s.talk?.available)return null;const a=!t.rights.call,i=a&&t.rights.talk&&!s.talk?.available;return o`<wk-station-live
      data-wk-live-native
      .stationId=${e.id}
      .stationName=${e.name}
      .media=${n?s:{...s,video:null}}
      .poster=${this.posterOf(e)}
      .live=${t.live&&e.online}
      .talkHere=${a}
      .classicHref=${i?W():""}
      .classicLabel=${t.text.talk.classic}
    ></wk-station-live>`}dialControl(e,t,s){const n=Le(this.mediaMode,this.media[e.id]);if(n.kind==="legacy")return;const a=re().dial;return n.kind==="native"?o`<div class="dialnative">
        <wk-talk-button
          dial
          data-wk-dial="native"
          .stationId=${e.id}
          .talk=${this.media[e.id]?.talk??null}
          .live=${s.live&&e.online}
          .idleLabel=${t?a.talk:a.dial}
        ></wk-talk-button>
        <wk-action-button tone="quiet" icon="window" href=${W()} data-wk-dial-classic="secondary">${a.classic}</wk-action-button>
      </div>`:o`<div class="callrow" data-wk-dial="reason" data-reason=${n.reason}>
      <span class="cs muted dialwhy" data-wk-dial-reason role="status">${a.reasons[n.reason]}</span>
      <wk-action-button tone="dashed" icon="window" href=${W()} data-wk-dial-classic>${a.classic}</wk-action-button>
    </div>`}talkControl(e,t,s){if(this.mediaMode==="video_talk")return t?Le(this.mediaMode,this.media[e.id]).kind!=="legacy"&&s.rights.call?l:this.liveArea(e,s)?l:void 0:!C("access.call")||!e.online?void 0:o`<wk-action-button icon="mic" data-wk-talk="drawer" label=${re().talk.openDrawer} @click=${n=>{n.stopPropagation(),this.open(e.id)}}>${re().talk.openDrawer}</wk-action-button>`}open(e){this.selected!==e&&(this.selected=e,this.detailOpen=!1,this.syncRoute(e))}closeDrawer(){this.selected=null,this.detailOpen=!1,this.syncRoute(null)}syncRoute(e){const t=Yt();if(t.mode!=="wiskey")return;const s=new URLSearchParams(t.params);e?s.set("station",e):s.delete("station"),Gt(t.path,s)}setView(e){this.view=e,et($t,e)}toggleFloor(e){const t=new Set(this.collapsed);t.has(e)?t.delete(e):t.add(e),this.collapsed=t,et(xt,JSON.stringify([...t]))}pickPlace(e){this.place=e,this.sheet=!1}ctx(){const e=this.features,t={text:S(),now:this.now,defaultZone:this.feed?.default_zone??null,live:this.isLive(),rights:this.rights(),policy:this.policy,places:this.places,actions:this.actions,clock:this.clock,table:this.table,media:this.demo()?!1:De("go2rtc"),poster:this.poster,failed:this.failed,selected:this.selected,detail:this.detail,detailOpen:this.detailOpen,features:e,open:s=>this.open(s),door:(s,n)=>void this.actions.askRelease(s.id,n),call:(s,n,a)=>this.actions.tapCall(s.id,n,a.detail),announce:s=>{this.announceFor=s,this.announceOpen=!0},stillError:(s,n)=>this.failed={...this.failed,[s]:n},toggleDetail:()=>this.detailOpen=!this.detailOpen,retryDetail:()=>{this.selected&&this.loadDetail(this.selected)}};return this.mediaMode!=="off"&&(t.liveArea=s=>this.liveArea(s,t),t.talkControl=(s,n)=>this.talkControl(s,n,t),t.dialControl=(s,n)=>this.dialControl(s,n,t)),t}render(){const e=S();if(this.forbidden&&Z())return o`<sw-page heading=${e.title}><div data-wk-stations data-wk-state="forbidden"><sw-state-panel state="forbidden" heading=${e.states.forbidden} data-wk-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return o`<sw-page heading=${e.title}><div data-wk-stations data-wk-state=${this.error?"error":"loading"}>${this.error?o`<sw-state-panel state="error" heading=${e.states.error} hint=${this.error} actionLabel=${e.retry} data-wk-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:o`<sw-state-panel state="loading" heading=${e.states.loading} data-wk-panel="loading"></sw-state-panel>`}</div></sw-page>`;const t=this.demo()?tt:this.feed.stations;if(t===null){const s=this.feed.state==="ready"?"error":this.feed.state,n=Es(s,e);return o`<sw-page heading=${e.title}>
        ${this.renderFeedBadge()}
        <div data-wk-stations data-wk-state=${`feed:${this.feed.state}`}>
          <sw-state-panel icon="door" state=${n.panel} heading=${n.heading} actionLabel=${n.settings&&Pe("system.configure")?e.states.toSettings:""} data-wk-panel=${`feed:${this.feed.state}`} @action=${()=>window.location.hash="#/system/diagnostics?tab=access-control"}></sw-state-panel>
        </div>
      </sw-page>`}return this.renderReady(t)}renderFeedBadge(){const e=S();if(this.demo())return o`<sw-badge slot="actions" kind="neutral" label=${e.demo} data-wk-feed="demo"></sw-badge>`;const t=this.feed;if(!t)return l;const s=t.state==="ready"&&t.fresh!==!1,n=s?"live":t.state==="connecting"?"unknown":t.state==="forbidden"?"forbidden":t.state==="error"?"error":t.stations?"stale":"offline",a=s?e.feed.live:t.state==="connecting"?e.feed.connecting:t.stations&&t.fetched_at?p(e.feed.stale,{ago:Ps(t.fetched_at,this.now,e)||"…"}):e.feed.off;return o`<sw-badge slot="actions" kind=${n} label=${a} data-wk-feed=${s?"live":t.state}></sw-badge>`}effectiveView(){return this.table==="none"&&this.view==="table"?"list":this.view}renderReady(e){const t=S(),s=this.ctx(),n=Ds(e,this.places,this.collapsed,t),a=n.length>0,i=a&&n.some(f=>f.id===this.place)?this.place:"all",r=Ls(e,this.filter,this.query,i,this.places),d=Ns(e),c=this.effectiveView(),h=e.filter(ht).length,m=e.some(f=>f.online),w=e.length?"ready":"empty",v=n.find(f=>f.id===i)?.name??t.places.all;return o`<sw-page wide heading=${t.title} subheading=${Rs(d,t)}>
      ${this.renderFeedBadge()}<wk-deep-links slot="actions" place="stations" mode="menu"></wk-deep-links>
      <div data-wk-stations data-wk-state=${w} data-view=${c} data-live=${String(s.live)}>
        ${e.length?o`<div class="toolbar">
              <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wk-search aria-label=${t.searchLabel} placeholder=${t.searchLabel} .value=${this.query} @input=${f=>this.query=f.target.value} /></label>
              ${s.rights.announce&&m?o`<wk-action-button icon="volume" data-wk-announce ?disabled=${!s.live} label=${t.announce} @click=${()=>s.announce("")}><span class="lbl">${t.announce}</span></wk-action-button>`:l}
              <wk-stations-maintenance .stations=${e} ?live=${s.live}></wk-stations-maintenance>
              <sw-view-switch data-wk-views label=${t.views.label} .value=${c} .options=${[{id:"cards",label:t.views.cards,icon:"grid"},{id:"list",label:t.views.list,icon:"list"},...this.table==="none"?[]:[{id:"table",label:t.views.table,icon:"table"}]]} @change=${f=>this.setView(f.detail)}></sw-view-switch>
            </div>`:l}
        <div class="layout ${a?"":"no-tree"}">
          ${a?o`<aside class="treecol"><sw-card flush><sw-place-tree data-wk-tree .rows=${n} .selected=${i} heading=${t.places.title} foldLabel=${t.places.fold} unfoldLabel=${t.places.unfold} @place-select=${f=>this.pickPlace(f.detail)} @place-toggle=${f=>this.toggleFloor(f.detail)}></sw-place-tree></sw-card></aside>`:l}
          <section class="main">
            ${e.length?o`<div class="chips" role="group" aria-label=${t.filters.label}>
                  ${a?o`<button type="button" class="chip places" data-wk-places-chip @click=${()=>this.sheet=!0}><sw-icon name="pin" size=${14}></sw-icon>${t.places.chip}: ${v}<sw-icon name="chevronDown" size=${12}></sw-icon></button>`:l}
                  ${Ms.map(f=>o`<button type="button" class="chip" data-wk-filter=${f} aria-pressed=${String(this.filter===f)} @click=${()=>this.filter=f}>
                      ${f==="in_call"?he("phone",14):l}${f==="all"?t.filters.all:f==="online"?t.filters.online:f==="attention"?t.filters.attention:t.filters.inCall}
                    </button>`)}
                </div>`:l}
            ${h&&c==="cards"&&s.rights.call?o`<div class="strip" role="status" data-wk-strip>
                  <span class="dot" aria-hidden="true"></span><span>${h===1?t.strip.one:p(t.strip.many,{n:h})}</span><span class="sp"></span>
                  <wk-action-button tone="quiet" icon="list" data-wk-strip-list @click=${()=>this.setView("list")}>${t.strip.toList}</wk-action-button>
                </div>`:l}
            ${this.renderContent(s,e,r,c)}
          </section>
        </div>
      </div>
      ${this.renderSheet(n,i)} ${this.renderDrawer(s,e)} ${this.selected?l:this.renderDialogs(s,e)}
    </sw-page>`}renderContent(e,t,s,n){const a=e.text;return t.length?s.length?n==="table"?o`<sw-table class="tbl" dense data-wk-table .columns=${ha(e,t)} .rows=${s} .selected=${this.selected} @row-select=${i=>this.open(i.detail.id)}></sw-table>`:n==="list"?da(e,s):ca(e,s):o`<sw-state-panel icon="door" compact state="empty" heading=${a.states.emptyFilter} data-wk-panel="empty-filter"></sw-state-panel>`:o`<sw-state-panel icon="door" state="empty" heading=${a.states.empty} data-wk-panel="empty"></sw-state-panel>`}renderSheet(e,t){const s=S();return e.length?o`<sw-drawer modal ?open=${this.sheet} heading=${s.places.sheet} data-wk-places-sheet @close=${n=>n.target===n.currentTarget&&(this.sheet=!1)}>
      <sw-place-tree .rows=${e} .selected=${t} heading=${s.places.title} foldLabel=${s.places.fold} unfoldLabel=${s.places.unfold} @place-select=${n=>this.pickPlace(n.detail)} @place-toggle=${n=>this.toggleFloor(n.detail)}></sw-place-tree>
    </sw-drawer>`:l}renderDrawer(e,t){const s=e.text,n=this.selected,a=n?t.find(r=>r.id===n):void 0,i=a?a.online?"live":"offline":"neutral";return o`<sw-drawer modal ?open=${!!n} heading=${a?.name??s.drawer.notFound} data-wk-drawer data-wk-drawer-station=${n??""} @close=${r=>r.target===r.currentTarget&&this.closeDrawer()}>
      ${n&&a?o`<sw-badge slot="action" kind=${i} label=${a.online?s.status.online:s.status.offline}></sw-badge>`:l}
      ${n?a?ga(e,a):o`<sw-state-panel compact state="forbidden" heading=${s.drawer.notFoundHint} data-wk-panel="scoped"></sw-state-panel>`:l}
      ${n?this.renderDialogs(e,t):l}
    </sw-drawer>`}renderDialogs(e,t){return o`${this.renderConfirm(e,t)}
    <wk-announce-dialog
      ?open=${this.announceOpen}
      .stations=${t}
      .places=${this.places}
      .scope=${this.policy.announceScope}
      .phrases=${Is(this.policy,e.text)}
      .preselect=${this.announceFor}
      .tts=${this.actions.tts}
      @tts-status=${s=>this.actions.noteTts(s.detail)}
      @close=${s=>{s.target===s.currentTarget&&(this.announceOpen=!1)}}
    ></wk-announce-dialog>`}renderConfirm(e,t){const s=this.actions.confirm;if(!s)return l;const n=t.find(h=>h.id===s.stationId);if(!n)return l;const a=e.text,i=n.locks.find(h=>h.physical_index===s.lock)?.name?.trim(),r=Fs(n.name),d=i?p(a.door.confirmNamed,{door:i,inPlace:r}):p(a.door.confirmPlain,{inPlace:r}),c=this.actions.releasing.has(`${n.id}/${s.lock}`);return o`<sw-dialog open ?locked=${c} heading=${a.door.confirmTitle} data-wk-release-dialog @close=${h=>h.target===h.currentTarget&&this.actions.cancelRelease()}>
      <p class="sentence" data-wk-release-sentence>${d}</p>
      <div slot="footer">
        <wk-action-button data-wk-release-cancel ?disabled=${c} @click=${()=>this.actions.cancelRelease()}>${a.door.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon="unlock" data-wk-release-confirm ?busy=${c} ?disabled=${c||!e.live} @click=${()=>void this.actions.confirmRelease()}>${c?a.door.sending:a.door.send}</wk-action-button>
      </div>
    </sw-dialog>`}};k.styles=_n;$([u()],k.prototype,"feed",2);$([u()],k.prototype,"error",2);$([u()],k.prototype,"forbidden",2);$([u()],k.prototype,"filter",2);$([u()],k.prototype,"query",2);$([u()],k.prototype,"view",2);$([u()],k.prototype,"place",2);$([u()],k.prototype,"places",2);$([u()],k.prototype,"collapsed",2);$([u()],k.prototype,"selected",2);$([u()],k.prototype,"sheet",2);$([u()],k.prototype,"announceOpen",2);$([u()],k.prototype,"announceFor",2);$([u()],k.prototype,"policy",2);$([u()],k.prototype,"features",2);$([u()],k.prototype,"detail",2);$([u()],k.prototype,"detailOpen",2);$([u()],k.prototype,"now",2);$([u()],k.prototype,"poster",2);$([u()],k.prototype,"failed",2);$([u()],k.prototype,"table",2);$([u()],k.prototype,"mediaMode",2);$([u()],k.prototype,"media",2);k=$([I("wiskey-stations")],k);export{k as WiskeyStations};
//# sourceMappingURL=wiskey-stations-DbUZf-Yo.js.map
