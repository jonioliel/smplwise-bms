import{g as j,ax as g,j as p,i as I,bc as Rt,n as ye,p as xe,A as l,b as o,k as F,bm as V,bA as at,hT as it,hU as nt,a as B,b5 as _e,bG as ot,bH as rt,cI as lt,a3 as T,Ae as Nt,Af as It,a$ as Ft,a_ as qt,e8 as Ht,e as Ae,Ag as jt,aY as de,Ah as Bt,b7 as Wt,Ai as Ut,Aj as Kt,ep as Pe,uU as Vt,u as dt,eV as Gt,a2 as X,Ak as Yt,x8 as Jt,Al as Zt,Am as Xt,An as Qt,Ao as es,t as Ee,bd as ct,aZ as ue,bf as ht,ob as Le,d as ts,bb as ss,ba as as,lp as is,b8 as ns,aA as De,xf as os,lR as rs,pR as ls,Ap as ds,be as Me,Aq as Re,aa as cs,cO as hs}from"./index-kipM9krC.js";import"./sw-table-IVoLa83R.js";import"./sw-place-tree-BHQ0z5cN.js";import"./sw-view-switch-C_4wJwmP.js";import"./sw-pager-pLqx2JEM.js";import{d as ps,b as pt,c as ut,g as us,a as ws}from"./access-stations-C0x25IPS.js";import{T as Ne,p as fs,r as ms,l as gs,t as vs,a as ne,f as Ie}from"./tts-default-CJUZwtoB.js";import{f as bs,w as S,t as Fe,T as oe,g as qe,h as u,i as wt,j as ks,n as $s,l as ys,k as xs,m as _s,o as zs,s as Ss,A as Cs,q as Os,U as Ts,r as ee,u as me,v as G,x as we,y as te,z as ze,B as Se,C as fe,D as ft,E as U,F as ge,G as mt,H as As,I as Ps,a as Es,J as Ls,K as Ds,L as Ms,N as gt,c as Rs,O as He,Q as Ns,R as Is,V as Fs,W as qs,X as Hs,Y as js,Z as Bs,_ as Ws,p as Us,$ as Ks,a0 as Vs,a1 as Gs,a2 as Ys,a3 as Js,a4 as Zs,a5 as Xs,a6 as Qs,a7 as ea,a8 as ta}from"./access-parity-Bd2r_3Rg.js";import"./wk-talk-button-Cw1ZmwNV.js";import"./wk-deep-links-Ck5nEbWJ.js";import{v as sa}from"./wiskey-validation-BphAazhp.js";import{L as aa}from"./long-lists-C9KZiGIW.js";import"./sw-logo-art-PLtEZJxU.js";import"./schedules-logic-Dw1XQVDZ.js";import"./wiskey-format-B1799tmm.js";import"./wiskey-Mz3Lhzuk.js";import"./deep-links-CKU-Vkw1.js";var ia=Object.defineProperty,na=Object.getOwnPropertyDescriptor,$=(e,t,s,a)=>{for(var i=a>1?void 0:a?na(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&ia(t,s,i),i};const oa=6e4;let b=class extends I{constructor(){super(...arguments),this.open=!1,this.stations=[],this.places=null,this.scope="scope",this.phrases=[],this.preselect="",this.tts={},this.engines=null,this.enginesNote="",this.engine="",this.language="",this.message="",this.choice="",this.sending=!1,this.result=null,this.locked=!1,this.retryAt=0,this.more=!1,this.sent=[],this.fixed=Ne,this.preselected="",this.missingEngine=null,this.missingLanguage=null,this.loadedEngines=!1,this.enginesAt=0,this.timer=0}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("open")&&this.open&&this.reset()}updated(e){e.has("open")&&this.open&&(!this.loadedEngines||Date.now()-this.enginesAt>oa?this.loadEngines():this.applyFixed())}reset(){this.message="",this.result=null,this.locked=!1,this.retryAt=0,this.sending=!1,this.more=!1,this.sent=[],this.choice=this.choices()[0]?.key??""}online(){return this.stations.filter(e=>e.online)}choices(){return bs(this.online(),this.places,this.scope,this.preselect||void 0)}current(){const e=this.choices();return e.find(t=>t.key===this.choice)??e[0]}async loadEngines(){this.loadedEngines=!0,this.enginesAt=Date.now(),this.enginesNote="";try{const e=await Rt();e.tts&&e.tts.engines.length?(this.engines=e.tts,await this.applyFixed()):e.tts?this.enginesNote=S().announceDlg.noEngine:this.enginesNote=e.state==="unsupported"?S().announceDlg.enginesUnsupported:S().announceDlg.noEngine}catch(e){this.enginesNote=ye(e),this.loadedEngines=!1}}async applyFixed(){if(!this.engines?.engines.length)return;try{this.fixed=fs(await xe())}catch{this.fixed=Ne}const e=ms(this.engines,this.fixed);this.engine=e.engine,this.language=e.language,this.preselected=e.engine,this.missingEngine=e.missingEngine,this.missingLanguage=e.missingLanguage,e.missingEngine&&(this.more=!0)}pickEngine(e){this.engine=e,this.language=gs(this.engines,e,this.fixed),this.missingLanguage=null}busySeconds(){return Math.max(0,Math.ceil((this.retryAt-Date.now())/1e3))}startRetryClock(){window.clearInterval(this.timer),this.timer=window.setInterval(()=>{this.busySeconds()<=0?(window.clearInterval(this.timer),this.retryAt=0):this.requestUpdate()},1e3)}ready(){const e=Fe(this.message);return!!this.engine&&e>0&&e<=oe&&!this.sending&&!this.locked&&this.busySeconds()===0&&!!this.current()?.stationIds.length}async send(){const e=this.current(),t=qe(this.message);if(!this.ready()||!e)return;const s=S().announceDlg,a=e.stationIds.filter(r=>this.online().some(d=>d.id===r));if(!a.length){this.result={tone:"warn",text:s.noTargets};return}this.sending=!0,this.result=null;let i=[];try{i=await ps({stationIds:a,engine_id:this.engine,language:this.language||null,message:t})}finally{this.sending=!1}for(const r of i)r.status&&this.dispatchEvent(new CustomEvent("tts-status",{detail:r.status,bubbles:!0,composed:!0}));this.sent=i.filter(r=>r.outcome==="sent").map(r=>r.station_id),this.result=this.summarize(i),i.some(r=>r.outcome==="unknown")&&(this.locked=!0);const n=i.filter(r=>r.code==="audio_busy").map(r=>r.retry_after_s??10);n.length&&!this.locked&&(this.retryAt=Date.now()+Math.min(...n)*1e3,this.startRetryClock())}summarize(e){const t=S().announceDlg,s=e.filter(n=>n.outcome==="sent"),a=e.filter(n=>n.outcome!=="sent"),i=n=>this.stations.find(r=>r.id===n)?.name??n;return a.length?e.some(n=>n.outcome==="unknown")?{tone:"warn",text:s.length?u(t.partial,{ok:s.length,bad:a.length,names:a.map(n=>i(n.station_id)).join(", ")})+" · "+t.unknown:t.unknown}:s.length?{tone:"warn",text:u(t.partial,{ok:s.length,bad:a.length,names:a.map(n=>i(n.station_id)).join(", ")})}:a.every(n=>n.code==="audio_busy")?{tone:"warn",text:t.busy}:{tone:"err",text:a[0].error??t.failed}:{tone:"ok",text:s.length===1?t.sentOne:u(t.sentMany,{n:s.length})}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}progress(){if(this.sent.length!==1)return"";const e=this.tts[this.sent[0]];return e?wt(e):""}renderResult(){if(!this.result)return l;const e=S().announceDlg,t=this.busySeconds(),s=this.progress()&&this.result.tone==="ok"?this.progress():this.result.text;return o`<div class="result ${this.result.tone}" role="status" data-wk-announce-result data-tone=${this.result.tone}>${s}${t>0?o` · ${u(e.busyIn,{n:t})}`:l}</div>`}render(){const e=S().announceDlg,t=vs().dialog,s=this.choices(),a=this.current(),i=Fe(this.message),r=this.engines?.engines.find(h=>h.engine_id===this.engine)?.supported_languages??[],d=this.phrases.length?this.phrases:e.phraseList,c=this.result?.tone==="ok"&&this.sent.length>0;return o`<sw-dialog ?open=${this.open} wide ?locked=${this.sending} heading=${e.title} data-wk-announce-dialog @close=${()=>this.close()}>
      <div class="body">
        <div class="fld">
          <label>${e.to}</label>
          <div class="chips" role="group" aria-label=${e.to}>
            ${s.length?s.map(h=>o`<button type="button" class="chip" data-wk-target=${h.key} aria-pressed=${String(h.key===a?.key)} ?disabled=${this.sending} @click=${()=>this.choice=h.key}>
                    ${h.kind==="station"?o`<sw-icon name="door" size=${14}></sw-icon>`:h.kind==="place"?o`<sw-icon name="pin" size=${14}></sw-icon>`:l}<span>${h.label}</span>
                  </button>`):o`<span class="note" data-wk-announce-notargets>${e.noTargets}</span>`}
          </div>
        </div>
        <div class="fld">
          <label for="msg">${e.message}</label>
          <textarea id="msg" data-wk-announce-message rows="3" maxlength=${oe*2} ?disabled=${this.sending||this.locked} .value=${this.message} @input=${h=>this.message=h.target.value}></textarea>
          <span class="cnt ${i>oe?"over":""}" aria-live="polite">${u(e.counter,{n:i,max:oe})}</span>
        </div>
        <div class="fld">
          <label>${e.phrases}</label>
          <div class="chips" role="group" aria-label=${e.phrases}>
            ${d.map(h=>o`<button type="button" class="chip" data-wk-phrase aria-pressed=${String(qe(this.message)===h)} ?disabled=${this.sending||this.locked} @click=${()=>this.message=h}><span>${h}</span></button>`)}
          </div>
        </div>
        <div class="prev" data-wk-announce-preview>
          <sw-icon name="volume" size=${15}></sw-icon>
          <span>${u(e.preview,{lang:this.engine||!this.missingEngine?ne(this.language||"he"):"—",voice:e.voiceDefault,n:ks(this.message)})}</span>
          <span class="sp"></span>
          <wk-action-button tone="quiet" data-wk-announce-more aria-expanded=${String(this.more)} @click=${()=>this.more=!this.more}>${e.more}</wk-action-button>
        </div>
        ${this.missingEngine?o`<div class="result warn" role="status" data-wk-announce-engine-missing>${Ie(t.missingEngine,{engine:this.missingEngine})}</div>`:l}
        ${this.more?o`<div class="engine" data-wk-announce-engine>
                ${this.missingLanguage&&this.language?o`<div class="result warn" role="status" data-wk-announce-language-missing>${Ie(t.missingLanguage,{language:ne(this.missingLanguage),auto:ne(this.language)})}</div>`:l}
                ${this.engines?.engines.length?o`<sw-field label=${e.engine}>
                        <sw-dropdown block data-wk-engine label=${e.engine} placeholder=${t.pickEngine} .value=${this.engine}
                          .items=${this.engines.engines.map(h=>({id:h.engine_id,label:h.engine_id===this.fixed.engine?`${h.name} · ${t.fixedTag}`:h.name}))}
                          @change=${h=>this.pickEngine(h.detail.id)}></sw-dropdown>
                      </sw-field>
                      ${r.length?o`<sw-field label=${e.language}>
                            <sw-dropdown block data-wk-language label=${e.language} .value=${this.language}
                              .items=${r.map(h=>({id:h,label:ne(h)}))}
                              @change=${h=>this.language=h.detail.id}></sw-dropdown>
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
    </sw-dialog>`}};b.styles=j`
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
    textarea:focus-visible {
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
      .chip {
        min-block-size: 44px;
      }
    }
  `;$([g({type:Boolean,reflect:!0})],b.prototype,"open",2);$([g({attribute:!1})],b.prototype,"stations",2);$([g({attribute:!1})],b.prototype,"places",2);$([g()],b.prototype,"scope",2);$([g({attribute:!1})],b.prototype,"phrases",2);$([g()],b.prototype,"preselect",2);$([g({attribute:!1})],b.prototype,"tts",2);$([p()],b.prototype,"engines",2);$([p()],b.prototype,"enginesNote",2);$([p()],b.prototype,"engine",2);$([p()],b.prototype,"language",2);$([p()],b.prototype,"message",2);$([p()],b.prototype,"choice",2);$([p()],b.prototype,"sending",2);$([p()],b.prototype,"result",2);$([p()],b.prototype,"locked",2);$([p()],b.prototype,"retryAt",2);$([p()],b.prototype,"more",2);$([p()],b.prototype,"sent",2);$([p()],b.prototype,"fixed",2);$([p()],b.prototype,"preselected",2);$([p()],b.prototype,"missingEngine",2);$([p()],b.prototype,"missingLanguage",2);b=$([F("wk-announce-dialog")],b);const vt=["sync","rescan","health_refresh","clock_refresh"],bt=e=>`access-control/stations/${encodeURIComponent(e)}/maintenance`,ra=15e3,la=e=>_e(bt(e)),kt=(e,t)=>V(`${bt(e)}/${t}`,{confirmed:!0,client_request_id:nt(),expires_at:at(it()+ra)});function da(e,t,s){if(e instanceof B){const a=e.body?.details??{},i=String(a.outcome??""),n=i==="refused"?"failed":i==="not_sent"?"not_sent":i==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",r=Number(a.retry_after_s);return{station_id:t,action:s,status:n,code:String(a.wiskey_code??e.code??"")||null,retry_after_s:Number.isFinite(r)&&r>=0?r:null,data:null}}return{station_id:t,action:s,status:"unknown",code:"network",retry_after_s:null,data:null}}async function $t(e,t,s=kt){try{const a=await s(e,t);return{station_id:e,action:t,status:a.status,code:null,retry_after_s:null,data:a.data??null}}catch(a){return da(a,e,t)}}async function ca(e,t,s=()=>{},a=kt,i=250,n=r=>new Promise(d=>setTimeout(d,r))){const r=[];for(let d=0;d<e.length;d++){d>0&&i>0&&await n(i);const c=await $t(e[d],t,a);r.push(c),s(c,d)}return r}function je(e,t,s){return e.filter(a=>t.has(a.id)&&(s==="sync"||a.online)).map(a=>a.id)}function ve(e,t){return e?t.reasons[e]??e:""}function be(e,t,s){const a=ve(t,s)||s.none;return e==="failed"?u(s.status.failed,{reason:a}):e==="not_sent"?u(s.status.not_sent,{reason:a}):s.status[e]}function ke(e){return e==="acknowledged"||e==="completed"?"ok":e==="failed"?"err":e==="sending"||e==="sent"?"busy":"warn"}function ha(e){const t={ok:0,failed:0,not_sent:0,unknown:0};for(const s of e)s.status==="acknowledged"||s.status==="completed"?t.ok++:s.status==="failed"?t.failed++:s.status==="not_sent"?t.not_sent++:t.unknown++;return t}function pa(e){const t=e?.auth_seen??null,s=e?.report?.auth?.last_failure??null;return t?s&&String(s.at??"")>=String(t.at??"")?s:t:s}function ua(e,t){const s=[],a=e?.report?.auth,i=e?.technical?.event_status?.stream;return(a?.sync_now||e?.technical?.last_error==="authentication_failed")&&s.push(t.authSources.sync),(a?.event_stream_now||i==="authentication_failed")&&s.push(t.authSources.event_stream),a?.event_history_now&&s.push(t.authSources.event_history),s}function wa(e,t){return e?t.steps[e]??t.steps.other:""}const yt={title:"תחזוקה",listButton:"תחזוקה",listTitle:"תחזוקת עמדות",refresh:"רענון נתונים",loading:"טוען את מצב העמדה…",unavailable:"מצב העמדה אינו זמין כרגע.",healthHidden:"פרטי הבריאות של העמדה מוצגים רק למי שמורשה לצפות במצב המערכת.",actions:{sync:"סנכרן עכשיו",rescan:"סריקה מחדש",health_refresh:"רענון בריאות",clock_refresh:"בדיקת שעון"},confirm:{sync:{title:"לסנכרן את העמדה עכשיו?",one:"אנשים, כרטיסים והרשאות שממתינים יישלחו לעמדה {name}. הסנכרון נכנס לתור ומתבצע ברקע."},rescan:{title:"לסרוק את העמדה מחדש?",one:"היכולות ורשימת המשתמשים יקראו מחדש מהעמדה {name}. שום דבר לא נכתב לעמדה."},health_refresh:{title:"לרענן את בריאות העמדה?",one:"השעון ונתוני המדיה של העמדה {name} ייקראו מחדש מהמכשיר (עד חצי דקה)."},clock_refresh:{title:"לבדוק את שעון העמדה?",one:"השעון של העמדה {name} ייקרא מחדש. השעה בעמדה לא משתנה."},many:"הפעולה תישלח פעם אחת לכל עמדה מתוך {n} העמדות שנבחרו, אחת אחרי השנייה.",send:"שלח",cancel:"ביטול"},rows:{lastSync:"סנכרון אחרון",lastScan:"קריאה אחרונה מהעמדה",stream:"זרם אירועים",clock:"שעון",lastError:"שגיאה אחרונה",auth:"כשל הזדהות",polls:"כשלי תקשורת רצופים"},stream:{connected:"מחובר",connecting:"מתחבר",disconnected:"מנותק",authentication_failed:"נכשל בהזדהות",unavailable:"לא זמין",stopped:"עצור",unknown:"לא ידוע"},clockOk:"תקין",clockSkew:"סטייה של {n} שניות",clockStatus:{ready:"נמדד",stale:"מדידה ישנה",unavailable:"לא נמדד"},never:"אין עדיין",none:"אין",authNone:"לא נראה מאז שהמערכת עלתה",authLine:"{source} · שלב: {step} · {at}",authObserved:"{source} · נראה ב־{at}",authCount:"{n} כשלים ברשומות האחרונות",authNow:"כרגע: {what}",authCode:"קוד מהמכשיר {code}",authSources:{sync:"סנכרון",event_stream:"זרם האירועים",event_history:"השלמת היסטוריית אירועים",station_sync:"סנכרון העמדה"},steps:{queued:"בתור",identity:"זיהוי העמדה",capabilities:"קריאת יכולות",inventory:"קריאת משתמשים מהעמדה",person_read:"קריאת אדם",reconcile:"התאמה",journal:"רישום",create_person:"הוספת אדם",update_person:"עדכון אדם",delete_person:"מחיקת אדם",create_card:"הוספת כרטיס",update_card:"עדכון כרטיס",delete_card:"מחיקת כרטיס",readback:"אימות",complete:"סיום",other:"שלב אחר"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"התקבל - הסנכרון בתור",completed:"הושלם",failed:"נכשל: {reason}",not_sent:"לא נשלח: {reason}",unknown:"נשלח, אין תשובה ברורה - ייתכן שבוצע"},lastRun:"פעם אחרונה: {status} · {at}",cooldown:"אפשר שוב בעוד {n} שניות",offlineHint:"העמדה לא מחוברת - אפשר רק לבקש סנכרון.",reasons:{authentication_failed:"העמדה דחתה את פרטי ההתחברות",connection_failed:"אין חיבור לעמדה",device_busy:"העמדה עסוקה",device_unavailable:"העמדה לא זמינה",station_offline:"העמדה לא מחוברת",intercom_station_offline:"העמדה לא מחוברת",station_unloaded:"העמדה לא טעונה במערכת האינטרקום",station_not_found:"העמדה לא נמצאה",intercom_station_not_found:"העמדה לא נמצאה",manager_closed:"מערכת האינטרקום בעצירה",unauthorized:"מערכת האינטרקום לא אישרה את הפעולה",forbidden:"אין הרשאה לתחזוקת העמדה",confirmation_required:"חסר אישור",expired:"הבקשה פגה לפני שנשלחה",intercom_duplicate_command:"הפקודה כבר נשלחה",station_ops_cooldown:"נשלח לפני רגע",station_ops_rate_limited:"יותר מדי פקודות בזמן קצר",station_ops_busy:"פקודות אחרות עדיין רצות",intercom_busy:"מערכת האינטרקום עסוקה",intercom_rate_limited:"הגבלת קצב",rate_limited:"הגבלת קצב",busy:"מערכת האינטרקום עסוקה",intercom_unavailable:"מערכת האינטרקום לא זמינה",timeout:"לא התקבלה תשובה בזמן",clock_read_failed:"קריאת השעון נכשלה",operation_unsupported:"העמדה לא תומכת בפעולה",capacity_exhausted:"העמדה מלאה",network:"אין חיבור לשרת"},bulk:{pickAction:"פעולה",pickStations:"עמדות",all:"בחר הכל",clear:"נקה",selected:"{n} נבחרו",offline:"לא מחוברת",next:"המשך",back:"חזרה",close:"סגור",running:"שולח {i} מתוך {n}…",summary:"{ok} הצליחו · {failed} נכשלו · {not_sent} לא נשלחו · {unknown} ללא תשובה",noneSelected:"בחרו לפחות עמדה אחת.",offlineSkipped:"עמדות לא מחוברות לא ייכללו בפעולה הזו."}},xt=ot("en","i18n/wiskey-station-ops","en");function R(){return lt(["en"])==="en"?xt:yt}rt("i18n/wiskey-station-ops",{he:yt,en:xt});var fa=Object.defineProperty,ma=Object.getOwnPropertyDescriptor,D=(e,t,s,a)=>{for(var i=a>1?void 0:a?ma(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&fa(t,s,i),i};let P=class extends I{constructor(){super(...arguments),this.stations=[],this.live=!0,this.open=!1,this.step="pick",this.action="sync",this.chosen=new Set,this.outcomes={},this.index=0,this.busy=!1,this.targets=[]}allowed(){return T("access.stations.manage")&&this.stations.length>0}openDialog(){this.open=!0,this.step="pick",this.outcomes={},this.index=0,this.chosen=new Set(this.stations.map(e=>e.id))}close(){this.busy||(this.open=!1)}toggle(e){const t=new Set(this.chosen);t.has(e)?t.delete(e):t.add(e),this.chosen=t}async send(){this.busy||(this.targets=je(this.stations,this.chosen,this.action),this.targets.length&&(this.step="run",this.busy=!0,this.outcomes=Object.fromEntries(this.targets.map(e=>[e,{station_id:e,action:this.action,status:"sending",code:null,retry_after_s:null,data:null}])),await ca(this.targets,this.action,(e,t)=>{this.outcomes={...this.outcomes,[e.station_id]:e},this.index=t+1}),this.busy=!1,this.dispatchEvent(new CustomEvent("stations-op",{detail:Object.values(this.outcomes),bubbles:!0,composed:!0}))))}willUpdate(){this.hidden=!this.allowed()}render(){if(!this.allowed())return l;const e=R();return o`<wk-action-button icon="wrench" data-wk-maint-list ?disabled=${!this.live} label=${e.listButton} @click=${()=>this.openDialog()}><span class="lbl">${e.listButton}</span></wk-action-button>
      ${this.open?this.renderDialog():l}`}renderDialog(){const e=R(),t=je(this.stations,this.chosen,this.action),s=this.action!=="sync"&&this.stations.some(a=>this.chosen.has(a.id)&&!a.online);return o`<sw-dialog open ?locked=${this.busy} heading=${this.step==="confirm"?e.confirm[this.action].title:e.listTitle} data-wk-maint-dialog data-step=${this.step}
      @close=${a=>a.target===a.currentTarget&&this.close()}>
      <div class="body">
        ${this.step==="pick"?this.renderPick(s):this.step==="confirm"?o`<p class="sentence" data-wk-maint-many>${e.actions[this.action]} · ${u(e.confirm.many,{n:t.length})}</p>${s?o`<div class="note">${e.bulk.offlineSkipped}</div>`:l}`:this.renderRun()}
      </div>
      <div slot="footer">
        ${this.step==="pick"?o`<wk-action-button data-wk-maint-dialog-cancel @click=${()=>this.close()}>${e.confirm.cancel}</wk-action-button>
              <wk-action-button tone="primary" data-wk-maint-next ?disabled=${!t.length} @click=${()=>this.step="confirm"}>${e.bulk.next}</wk-action-button>`:this.step==="confirm"?o`<wk-action-button data-wk-maint-back @click=${()=>this.step="pick"}>${e.bulk.back}</wk-action-button>
                <wk-action-button tone="primary" icon="wrench" data-wk-maint-send-many ?disabled=${!this.live||!t.length} @click=${()=>void this.send()}>${e.confirm.send}</wk-action-button>`:o`<wk-action-button data-wk-maint-done ?disabled=${this.busy} @click=${()=>this.close()}>${e.bulk.close}</wk-action-button>`}
      </div>
    </sw-dialog>`}renderPick(e){const t=R();return o`<div class="lab">${t.bulk.pickAction}</div>
      <div class="chips" role="radiogroup" aria-label=${t.bulk.pickAction}>
        ${vt.map(s=>o`<button type="button" class="chip" role="radio" aria-checked=${String(this.action===s)} aria-pressed=${String(this.action===s)} data-wk-maint-action=${s} @click=${()=>this.action=s}>
            ${t.actions[s]}
          </button>`)}
      </div>
      <div class="tools">
        <span class="lab">${t.bulk.pickStations}</span><span class="sp"></span>
        <span data-wk-maint-count>${u(t.bulk.selected,{n:this.chosen.size})}</span>
        <wk-action-button tone="quiet" data-wk-maint-all @click=${()=>this.chosen=new Set(this.stations.map(s=>s.id))}>${t.bulk.all}</wk-action-button>
        <wk-action-button tone="quiet" data-wk-maint-clear @click=${()=>this.chosen=new Set}>${t.bulk.clear}</wk-action-button>
      </div>
      <div class="list" data-wk-maint-stations>
        ${this.stations.map(s=>{const a=!s.online&&this.action!=="sync";return o`<div class="row" aria-disabled=${String(a)} data-wk-maint-station=${s.id}>
            <label><input type="checkbox" .checked=${this.chosen.has(s.id)} ?disabled=${a} @change=${()=>this.toggle(s.id)} /><span class="nm">${s.name}</span></label>
            ${s.online?l:o`<span class="st">${t.bulk.offline}</span>`}
          </div>`})}
      </div>
      ${this.chosen.size?e?o`<div class="note">${t.bulk.offlineSkipped}</div>`:l:o`<div class="note" role="status">${t.bulk.noneSelected}</div>`}`}renderRun(){const e=R(),t=new Map(this.stations.map(n=>[n.id,n.name])),s=this.targets.map(n=>this.outcomes[n]).filter(Boolean),a=s.filter(n=>n.status!=="sending"),i=ha(a);return o`<div class="summary" role="status" data-wk-maint-progress>
        ${this.busy?u(e.bulk.running,{i:Math.min(this.index+1,this.targets.length),n:this.targets.length}):u(e.bulk.summary,{...i})}
      </div>
      <div class="list" data-wk-maint-results>
        ${s.map(n=>o`<div class="row" data-wk-maint-row=${n.station_id} data-status=${n.status}>
            <span class="nm">${t.get(n.station_id)??n.station_id}</span>
            <span class="st" data-tone=${ke(n.status)}>${be(n.status,n.code,e)}</span>
          </div>`)}
      </div>`}};P.styles=j`
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
  `;D([g({attribute:!1})],P.prototype,"stations",2);D([g({type:Boolean})],P.prototype,"live",2);D([p()],P.prototype,"open",2);D([p()],P.prototype,"step",2);D([p()],P.prototype,"action",2);D([p()],P.prototype,"chosen",2);D([p()],P.prototype,"outcomes",2);D([p()],P.prototype,"index",2);D([p()],P.prototype,"busy",2);D([p()],P.prototype,"targets",2);P=D([F("wk-stations-maintenance")],P);function ga(e){const t=~e&255,s=t&128,a=t>>4&7,n=((t&15)<<3)+132<<a;return s?132-n:n-132}function va(e){const t=e^85,s=(t&112)>>4;let a=(t&15)<<4;return s===0?a+=8:s===1?a+=264:a=a+264<<s-1,(t&128)!==0?a:-a}function ba(e,t="pcmu"){const s=new Float32Array(e.length),a=t==="pcma"?va:ga;for(let i=0;i<e.length;i+=1)s[i]=a(e[i]&255)/32768;return s}function ka(e){if(!e.length)return 0;let t=0;for(let s=0;s<e.length;s+=1)t+=e[s]*e[s];return Math.min(1,Math.sqrt(t/e.length)*4)}function $a(e,t){if(t<=0)return e;const s=e*.5**(t/150);return s<.01?0:s}const Be={intercom_listen_busy:"busy",intercom_listen_user_busy:"user_busy",intercom_listen_unsupported:"unsupported",intercom_listen_no_listen:"no_listen",intercom_listen_off:"off",intercom_station_offline:"offline",intercom_listen_unavailable:"unavailable",intercom_unavailable:"unavailable",intercom_station_not_found:"unavailable",forbidden:"forbidden"};function ya(e){if(e instanceof B){if(Be[e.code])return Be[e.code];if(e.status===403)return"forbidden";if(e.status===0)return"network"}return e instanceof TypeError?"network":"failed"}function xa(e){switch(e){case"ended":case"stopped":return null;case"expired":return"expired";case"access_lost":return"access_lost";case"upstream_closed":case"upstream_unavailable":return"upstream";case"network":return"network";default:return"failed"}}class _a{constructor(t,s){this.stationId=t,this.deps=s,this.phase="idle",this.problem=null,this.outcome=null,this.muted=!1,this.endsAt=0,this.starts=0,this.frames=0,this.level=0,this.levelAt=0,this.gen=0,this.reply=null,this.ws=null,this.sink=null,this.codec="pcmu",this.rate=8e3}secondsLeft(){return this.phase==="listening"?Math.max(0,Math.ceil((this.endsAt-this.deps.now())/1e3)):null}levelNow(){return this.phase==="listening"?$a(this.level,this.deps.now()-this.levelAt):0}async start(){if(this.phase!=="idle")return;this.problem=null;const t=this.deps.sink();if(!t){this.problem="no_audio",this.deps.changed();return}this.sink=t,t.setMuted(this.muted),this.phase="starting";const s=++this.gen;this.deps.changed();let a;try{this.starts+=1,a=await this.deps.start(this.stationId,this.deps.requestId())}catch(n){s===this.gen&&this.fail(ya(n));return}if(s!==this.gen){this.deps.stop(a.session).catch(()=>{});return}this.reply=a,this.codec=a.codec,this.rate=a.sample_rate,this.endsAt=this.deps.now()+a.max_seconds*1e3;const i=Nt(this.deps,a,()=>this.fail("network"));i&&(this.ws=i,i.onmessage=n=>{if(s!==this.gen)return;if(typeof n.data!="string"){this.phase==="listening"&&this.onFrame(n.data);return}let r;try{r=JSON.parse(n.data)}catch{return}r.type==="listen/state"&&r.value==="open"&&this.phase==="starting"?(this.phase="listening",this.levelAt=this.deps.now(),this.deps.changed()):r.type==="listen/closed"&&this.finish(String(r.value??"ended"))},i.onclose=n=>{s===this.gen&&this.finish(It(n.code))},i.onerror=()=>{})}setMuted(t){this.muted=t,this.sink?.setMuted(t),this.deps.changed()}stop(){if(this.phase==="idle")return;const t=this.ws,s=this.reply;t&&t.readyState===1?t.send(JSON.stringify({type:"listen/stop"})):s&&this.deps.stop(s.session).catch(()=>{}),this.finish("ended")}dispose(){this.stop()}onFrame(t){const s=ba(new Uint8Array(t),this.codec);this.frames+=1,this.level=ka(s),this.levelAt=this.deps.now(),this.sink?.play(s,this.rate)}teardown(){this.gen+=1;const t=this.ws;if(this.ws=null,t){t.onmessage=null,t.onclose=null,t.onerror=null;try{t.close()}catch{}}this.sink?.close(),this.sink=null,this.reply=null,this.endsAt=0,this.level=0}fail(t){this.teardown(),this.phase="idle",this.problem=t,this.outcome=null,this.deps.changed()}finish(t){this.teardown(),this.phase="idle",this.outcome=t,this.problem=xa(t),this.deps.changed()}}const za=.06,Sa=.3;function Ca(e,t){const s=Math.max(t,e+za);return s-e>Sa?null:s}function Oa(){const e=globalThis.AudioContext??globalThis.webkitAudioContext;if(!e)return null;let t;try{t=new e}catch{return null}t.resume().catch(()=>{});const s=t.createGain();s.connect(t.destination);let a=0;return{play(i,n){const r=Ca(t.currentTime,a);if(r===null)return;const d=t.createBuffer(1,i.length,n);d.copyToChannel(i,0);const c=t.createBufferSource();c.buffer=d,c.connect(s),c.start(r),a=r+d.duration},setMuted(i){s.gain.value=i?0:1},close(){t.close().catch(()=>{})}}}var Ta=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,Y=(e,t,s,a)=>{for(var i=a>1?void 0:a?Aa(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&Ta(t,s,i),i};let N=class extends I{constructor(){super(...arguments),this.stationId="",this.live=!0,this.deps=null,this.capability=null,this.tick=0,this.session=null,this.timer=0,this.loadedFor=""}realDeps(){const e=this.deps??{};return{start:e.start??((t,s)=>_s(t,s)),stop:e.stop??(t=>xs(t)),socket:e.socket??(t=>new WebSocket(ys(t))),sink:e.sink??(()=>Oa()),requestId:e.requestId??(()=>$s()),now:e.now??(()=>Date.now()),changed:()=>{this.tick+=1,this.syncTimer()}}}ensureSession(){return(!this.session||this.session.stationId!==this.stationId)&&(this.session?.dispose(),this.session=new _a(this.stationId,this.realDeps())),this.session}syncTimer(){const e=this.session?.phase==="listening";e&&!this.timer?this.timer=window.setInterval(()=>this.tick+=1,150):!e&&this.timer&&(window.clearInterval(this.timer),this.timer=0)}willUpdate(e){(e.has("stationId")||e.has("live"))&&this.stationId&&this.live&&!this.deps?.start&&this.loadedFor!==this.stationId&&!this.capability&&(this.loadedFor=this.stationId,zs(this.stationId).then(t=>{this.loadedFor===this.stationId&&(this.capability=t)}).catch(()=>{}))}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,this.timer&&window.clearInterval(this.timer),this.timer=0}get offered(){const e=this.session,t=e!==null&&e.phase!=="idle";return this.live&&(t||!!e?.problem||!!this.capability?.available)}updated(e){super.updated(e),this.toggleAttribute("hidden",!this.offered)}toggle(){const e=this.ensureSession();e.phase==="idle"?e.start():e.stop()}render(){const e=this.session;if(!this.offered)return l;const t=Ss(),s=e?.phase??"idle",a=e?.secondsLeft(),i=Math.round((e?.levelNow()??0)*100),n=s==="starting"?t.starting:s==="listening"?`${t.listening}${a!=null?` · ${Ft(t.left,{t:qt(a)})}`:""}`:"";return o`
      <div class="row" data-wk-listen>
        <button class="main" type="button" data-wk-listen-toggle aria-pressed=${String(s!=="idle")} @click=${()=>this.toggle()}>
          <sw-icon name=${s==="idle"?"volume":"hangup"} size=${18}></sw-icon>
          ${s==="idle"?t.start:t.stop}
        </button>
        ${s==="listening"?o`<button type="button" data-wk-listen-mute aria-pressed=${String(e.muted)} aria-label=${e.muted?t.unmute:t.mute} @click=${()=>e.setMuted(!e.muted)}>
              ${e.muted?t.unmute:t.mute}
            </button>`:l}
      </div>
      ${s==="listening"?o`<div class="meter ${e.muted?"muted":""}" role="meter" aria-label=${t.level} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${i} data-wk-listen-level>
            <i style=${`inline-size:${i}%`}></i>
          </div>`:l}
      ${n?o`<div class="msg" data-wk-listen-state>${n}${e?.muted?` · ${t.muted}`:""}</div>`:l}
      ${s==="idle"&&e?.problem?o`<div class="msg problem" data-wk-listen-problem role="status">${t.problems[e.problem]}</div>`:l}
      ${s==="idle"&&!e?.problem&&e?.outcome?o`<div class="msg" data-wk-listen-ended>${t.ended}</div>`:l}
    `}};N.styles=j`
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
      color: var(--sw-text-3);
    }
    .msg.problem {
      color: var(--sw-warn, var(--sw-text));
    }
  `;Y([g()],N.prototype,"stationId",2);Y([g({type:Boolean})],N.prototype,"live",2);Y([g({attribute:!1})],N.prototype,"deps",2);Y([g({attribute:!1})],N.prototype,"capability",2);Y([p()],N.prototype,"tick",2);N=Y([F("wk-listen-button")],N);var Pa=Object.defineProperty,Ea=Object.getOwnPropertyDescriptor,E=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ea(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&Pa(t,s,i),i};let A=class extends I{constructor(){super(...arguments),this.stationId="",this.stationName="",this.media=null,this.poster="",this.live=!0,this.classicHref="",this.classicLabel="",this.talkHere=!0,this.profile=null,this.choice=Ae(null),this.mutedBefore=null,this.onOuterFloor=e=>{if(this.talkHere)return;e.detail?.stationId===this.stationId&&this.onFloor(e)},this.onFloor=e=>{const t=e.detail.held,s=this.player;!s||this.media?.talk?.duplex==="full"||(t?(this.mutedBefore=s.muted,s.muted=!0):this.mutedBefore!==null&&(s.muted=this.mutedBefore,this.mutedBefore=null))}}connectedCallback(){super.connectedCallback(),window.addEventListener("talk-floor",this.onOuterFloor),xe().then(e=>this.choice=Ae(e)).catch(()=>{})}disconnectedCallback(){window.removeEventListener("talk-floor",this.onOuterFloor),super.disconnectedCallback()}willUpdate(e){if(e.has("media")||e.has("stationId")){const t=this.media?.video?.profiles.map(s=>s.id)??[];(!this.profile||!t.includes(this.profile)||e.has("stationId"))&&(this.profile=jt(this.media?.video??null))}}render(){const e=this.media,t=e?.video,s=de(),a=t?.profiles.find(c=>c.id===this.profile),i=a?t?.paths[a.id]:void 0,n=e?.talk,r=Object.fromEntries((t?.profiles??[]).map(c=>[c.id,c.transports])),d=a?Bt(t?.transport?.choice??this.choice,a.id,r,t?.transport?.plans?.[a.id]??null):null;return o`
      ${i&&d?.blocked?o`<div class="frame" data-wk-live-frame data-profile=${a.id} data-wk-live-blocked>
            ${this.poster?o`<img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" />`:l}
            <div class="blocked" role="status"><sw-icon name="offline" size=${18}></sw-icon><span>${s.live.blocked}</span><span class="hint">${s.live.blockedHint}</span></div>
          </div>`:i&&d?o`<div class="frame" data-wk-live-frame data-profile=${a.id} data-transport-plan=${d.plan||d.mode}>
            <sw-live-player .livePath=${i} .profile=${a.id} .mode=${d.mode} .plan=${d.plan} .preferred=${d.plan?a.id:""} .poster=${this.poster} data-wk-live-player aria-label=${`${s.live.label} · ${this.stationName}`}></sw-live-player>
          </div>`:this.poster?o`<div class="frame" data-wk-live-frame data-profile=""><img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" /></div>`:l}
      ${t&&t.profiles.length>1&&i?o`<div class="bar">
            <span class="lbl" id="q">${s.live.quality}</span>
            <div class="seg" role="group" aria-labelledby="q" data-wk-quality>
              ${t.profiles.map(c=>o`<button type="button" data-profile=${c.id} aria-pressed=${String(c.id===this.profile)} @click=${()=>this.profile=c.id}>${c.id==="main"?s.live.main:s.live.sub}</button>`)}
            </div>
          </div>`:l}
      ${this.talkHere?n?.available?o`<wk-talk-button .stationId=${this.stationId} .talk=${n} .live=${this.live} data-wk-talk="native" @talk-floor=${this.onFloor}></wk-talk-button>`:this.classicHref?o`<wk-action-button tone="dashed" icon="window" block size="lg" href=${this.classicHref} data-wk-talk="classic">${this.classicLabel}</wk-action-button>`:l:l}
      ${e?.state==="ready"?o`<wk-listen-button .stationId=${this.stationId} .live=${this.live}></wk-listen-button>`:l}
    `}};A.styles=j`
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
  `;E([g()],A.prototype,"stationId",2);E([g()],A.prototype,"stationName",2);E([g({attribute:!1})],A.prototype,"media",2);E([g()],A.prototype,"poster",2);E([g({type:Boolean})],A.prototype,"live",2);E([g()],A.prototype,"classicHref",2);E([g()],A.prototype,"classicLabel",2);E([g({type:Boolean})],A.prototype,"talkHere",2);E([p()],A.prototype,"profile",2);E([p()],A.prototype,"choice",2);E([Ht("sw-live-player")],A.prototype,"player",2);A=E([F("wk-station-live")],A);const La=45e3,Da=12e4;function Ma(e){const t=e instanceof B?Number(e.body?.details?.retry_after_s):NaN;return Number.isFinite(t)&&t>=0?Math.ceil(t*1e3):Ts}function We(e,t=S()){return Wt(e)!=="unknown"?{tone:"err",text:ye(e),unknown:!1}:{tone:"warn",text:t.call.unknown,unknown:!0}}function Ra(e,t=S()){const s={answer:t.call.answer,reject:t.call.reject,hangUp:t.call.hangUp},a=u(t.call.sent,{label:s[e.command]??e.command,ack:e.acknowledged===!0?t.call.ack:t.call.noAck});if(e.observation==="unavailable"||!e.observed_state)return`${a} · ${t.call.stateUnread}`;const i=ee(e.observed_state,t);return`${a} · ${u(e.observation==="unchanged"?t.call.stateUnchanged:t.call.state,{state:i})}`}const Na=["started","generating","speaking","completed","closed"],Ue=e=>Na.indexOf(e.state);class he{constructor(t){this.deps=t,this.confirm=null,this.releasing=new Set,this.held={},this.results={},this.callBusy=new Set,this.armed=null,this.tts={},this.armTimer=0,this.holdTimer=0}dispose(){this.deps.cancel(this.armTimer),this.deps.cancel(this.holdTimer)}static key(t,s){return`${t}/${s}`}isHeld(t){return(this.held[t]??0)>this.deps.now()}setResult(t,s,a){this.results={...this.results,[t]:{tone:s,text:a,at:this.deps.now()}},this.deps.changed()}prune(){const t=this.deps.now(),s=Object.entries(this.results).filter(([,a])=>t-a.at<(a.tone==="warn"?Da:La));s.length!==Object.keys(this.results).length&&(this.results=Object.fromEntries(s),this.deps.changed())}clearResult(t){if(!(t in this.results))return;const s={...this.results};delete s[t],this.results=s,this.deps.changed()}askRelease(t,s){const a=he.key(t,s);return!this.deps.live()||this.releasing.has(a)||this.isHeld(a)?!1:(this.confirm={stationId:t,lock:s},this.deps.changed(),!0)}cancelRelease(){this.confirm&&(this.confirm=null,this.deps.changed())}async confirmRelease(){const t=this.confirm;if(!t)return;const s=he.key(t.stationId,t.lock);if(!(!this.deps.live()||this.releasing.has(s)||this.isHeld(s))){this.releasing=new Set([...this.releasing,s]),this.deps.changed();try{await this.deps.release(t.stationId,t.lock),this.setResult(t.stationId,"ok",u(S().door.sentAt,{at:this.deps.stamp()}))}catch(a){const i=We(a);this.setResult(t.stationId,i.tone,i.unknown?S().door.unknown:i.text),(i.unknown||a instanceof B&&a.code==="intercom_release_in_progress")&&this.hold(s,Ma(a))}finally{const a=new Set(this.releasing);a.delete(s),this.releasing=a,this.confirm===t&&(this.confirm=null),this.deps.changed()}}}hold(t,s){const a=this.deps.now()+s;this.held={...this.held,[t]:Math.max(this.held[t]??0,a)},this.deps.cancel(this.holdTimer);const i=Object.values(this.held).filter(n=>n>this.deps.now());i.length&&(this.holdTimer=this.deps.after(()=>{this.held={...this.held},this.deps.changed()},Math.min(...i)-this.deps.now()+50)),this.deps.changed()}tapCall(t,s,a=1){const i=this.deps.station(t);if(!i||this.callBusy.has(t)||!this.deps.live()||a>1)return;const n=this.armed;if(n&&n.id===t&&n.command===s&&n.callState===i.call_state){if(this.deps.tick()-n.at<Cs)return;this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed(),this.sendCall(t,s);return}this.deps.cancel(this.armTimer),this.armed={id:t,command:s,at:this.deps.tick(),callState:i.call_state},this.armTimer=this.deps.after(()=>{this.armed=null,this.deps.changed()},Os),this.deps.changed()}dropStaleArm(){const t=this.armed;if(!t)return;const s=this.deps.station(t.id);(!this.deps.live()||!s||!s.online||s.call_state!==t.callState)&&(this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed())}async sendCall(t,s){this.callBusy=new Set([...this.callBusy,t]),this.deps.changed();try{const a=await this.deps.signal(t,s);a.call&&this.setResult(t,a.call.acknowledged===!0?"ok":"warn",Ra(a.call))}catch(a){const i=We(a);this.setResult(t,i.tone,i.text)}finally{const a=new Set(this.callBusy);a.delete(t),this.callBusy=a,this.deps.changed(),this.deps.refetch()}}noteTts(t){const s=this.tts[t.station_id];s&&s.at>=t.at&&Ue(s)>Ue(t)||(this.tts={...this.tts,[t.station_id]:t},this.deps.changed())}}const Ia=j`
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
    /* NOSCROLL-1366-2437: the cards view is paged to what fits (the screen measures whole rows; the pager sits at the end of the chips
       row), so the box no longer scrolls; overflow stays a fallback for a window too short for one row */
    .chips .pager {
      margin-inline-start: auto;
    }
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
`,se=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],W=e=>`access-control/stations/${encodeURIComponent(e)}`,Fa=15e3,ae=()=>({confirmed:!0,client_request_id:nt(),expires_at:at(it()+Fa)}),qa=e=>_e(`${W(e)}/door-tech`),Ha=(e,t)=>_e(`${W(e)}/doors/${t}/hold`),ja=(e,t,s,a)=>V(`${W(e)}/doors/${t}/hold`,{...ae(),revision:s,policy:a}),Ba=(e,t,s)=>V(`${W(e)}/doors/${t}/hold/delete`,{...ae(),revision:s}),Wa=(e,t,s,a,i)=>V(`${W(e)}/doors/${t}/program`,{...ae(),revision:s,policy:a,enabled:i}),Ua=(e,t,s,a)=>V(`${W(e)}/doors/${t}/program/${a}`,{...ae(),revision:s});function Ka(e){return{action:e.action,door:e.door,expected:e.expected,...e.action==="set"?{new_code:e.newCode??""}:{},...e.expected?{current_code:e.currentCode??""}:{},compatibility:!!e.compatibility,confirm_text:e.confirmText}}const Va=(e,t)=>V(`${W(e)}/codes/${t.slot}`,{...ae(),...Ka(t)});function Ga(e,t){if(e instanceof B){const s=e.body?.details??{},a=String(s.outcome??""),i=a==="refused"?"refused":a==="not_sent"?"not_sent":a==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",n=Number(s.retry_after_s),r=String(s.wiskey_code??"")||String(s.reason??"")||e.code||"";return{kind:t,status:i,code:r||null,retry_after_s:Number.isFinite(n)&&n>=0?n:null,data:null}}return{kind:t,status:"unknown",code:"network",retry_after_s:null,data:null}}async function J(e,t){try{const s=await t();return{kind:e,status:s.status,code:s.partial,retry_after_s:null,data:s.data??null}}catch(s){return Ga(s,e)}}function ce(e,t){const s=Object.fromEntries(se.map(a=>[a,(e?.weekly?.[a]??[]).filter(i=>!!i?.start&&!!i?.end).map(i=>({start:i.start,end:i.end}))]));return{timezone:e?.timezone||t,name:e?.name??"",weekly:s,holidays:(e?.holidays??[]).filter(a=>!!a.start&&!!a.end).map(a=>({name:a.name??"",start:a.start,end:a.end,periods:(a.periods??[]).map(i=>({start:i.start,end:i.end}))}))}}const Ya=(e,t="")=>ce({timezone:e,name:t,weekly:{},holidays:[]},e),Ja=/^(?:[01]\d|2[0-3]):[0-5]\d$/,re=(e,t=!1)=>Ja.test(e)?Number(e.slice(0,2))*60+Number(e.slice(3)):t&&e==="24:00"?1440:null;function Ke(e,t){if(e.length>8)return[{field:t,key:"tooMany"}];const s=[];if(e.forEach((i,n)=>{const r=re(i.start),d=re(i.end,!0);r===null||d===null?s.push({field:`${t}.${n}`,key:"time"}):r>=d&&s.push({field:`${t}.${n}`,key:"order"})}),s.length)return s;const a=[...e].sort((i,n)=>i.start.localeCompare(n.start));for(let i=1;i<a.length;i++)if((re(a[i-1].end,!0)??0)>(re(a[i].start)??0))return[{field:t,key:"overlap"}];return[]}function Ve(e){const t=[],s=e.name.trim();(!s||s.length>32)&&t.push({field:"name",key:"name"}),(!e.timezone||e.timezone.length>64)&&t.push({field:"timezone",key:"zone"});for(const n of se)t.push(...Ke(e.weekly[n]??[],`weekly.${n}`));e.holidays.length>64&&t.push({field:"holidays",key:"tooMany"});const a=/^\d{4}-\d{2}-\d{2}$/;e.holidays.forEach((n,r)=>{(!n.name.trim()||n.name.trim().length>32)&&t.push({field:`holidays.${r}.name`,key:"name"}),!a.test(n.start)||!a.test(n.end)?t.push({field:`holidays.${r}`,key:"date"}):n.start>n.end&&t.push({field:`holidays.${r}`,key:"dateOrder"}),t.push(...Ke(n.periods,`holidays.${r}.periods`))});const i=e.holidays.filter(n=>a.test(n.start)&&a.test(n.end)).sort((n,r)=>n.start.localeCompare(r.start));for(let n=1;n<i.length;n++)i[n-1].end>=i[n].start&&t.push({field:"holidays",key:"dateOverlap"});return t}function Ge(e){const t=s=>[...s].map(a=>({start:a.start,end:a.end})).sort((a,i)=>a.start.localeCompare(i.start));return{timezone:e.timezone,name:e.name.trim(),weekly:Object.fromEntries(se.map(s=>[s,t(e.weekly[s]??[])])),holidays:e.holidays.map(s=>({name:s.name.trim(),start:s.start,end:s.end,periods:t(s.periods)})).sort((s,a)=>s.start.localeCompare(a.start))}}function Ye(e,t){return e?se.filter(s=>(e.weekly[s]??[]).length).map(s=>`${t.days[s]} ⁦${(e.weekly[s]??[]).map(a=>`${a.start}–${a.end}`).join(", ")}⁩`):[]}const Je=/^\d{4,16}$/;function Za(e){if(e.action==="set"){if(!Je.test(e.newCode))return"newCode";if(e.newCode!==e.repeatCode)return"repeat"}return e.expected&&!Je.test(e.currentCode)?"currentCode":(e.template!==void 0&&e.slot!==void 0?Ut(e.template,e.typed,{slot:e.slot}):e.typed.trim()===e.phrase)?null:"typed"}const Xa=(e,t)=>u(e,{slot:t}),Qa=(e,t)=>Kt(e,{slot:t});function ei(e,t){return e?t.reasons[e]??(e.startsWith("schedule_")?t.reasons.schedule_invalid:e):""}function Ze(e,t){const s=ei(e.code,t);switch(e.status){case"sending":return t.status.sending;case"sent":return t.status.sent;case"acknowledged":return t.status.acknowledged;case"partial":return t.status.partial;case"refused":return u(t.status.refused,{reason:s||t.reasons.unknown_reason});case"not_sent":return s?u(t.status.notSentWhy,{reason:s}):t.status.notSent;default:return s&&e.code!=="network"?u(t.status.unknownWhy,{reason:s}):t.status.unknown}}function Xe(e){return e==="acknowledged"?"ok":e==="refused"||e==="not_sent"?"err":e==="sending"||e==="sent"?"busy":"warn"}const _t={title:"שינויים טכניים",open:"ניהול טכני של הדלתות",heading:"ניהול טכני · {name}",sub:"שינויים בהגדרות הדלתות של העמדה. כל שינוי דורש אישור ונרשם ביומן.",loading:"טוען…",unavailable:"לא ניתן לטעון את הנתונים כרגע.",retry:"נסה שוב",close:"סגירה",notAllowed:"שינויים טכניים בדלתות של העמדה הזו מותרים למנהלי מערכת בלבד.",offline:"העמדה אינה מחוברת: אפשר לשמור לוחות זמנים ולהשהות תוכניות, אבל לא להחיל תוכנית או לשנות קוד.",unsupported:"הגרסה המותקנת של מערכת האינטרקום אינה מציעה את הפעולה הזו.",noDoors:"לעמדה אין דלתות מנוהלות.",tabs:{hold:"לוחות החזקה",codes:"קודים ציבוריים",programs:"תוכניות",history:"יומן"},door:"דלת {n}",days:{Sunday:"א׳",Monday:"ב׳",Tuesday:"ג׳",Wednesday:"ד׳",Thursday:"ה׳",Friday:"ו׳",Saturday:"ש׳"},dayNames:{Sunday:"ראשון",Monday:"שני",Tuesday:"שלישי",Wednesday:"רביעי",Thursday:"חמישי",Friday:"שישי",Saturday:"שבת"},hold:{none:"אין לוח החזקה",draftNote:"לוח החזקה הוא טיוטה: הוא לא פותח את הדלת עד שמחילים אותו כתוכנית.",add:"הוספה",edit:"עריכה",remove:"מחיקה",holidays:"תאריכים מיוחדים: {n}",noHours:"סגור כל השבוע"},editor:{titleNew:"לוח החזקה חדש · {door}",titleEdit:"עריכת לוח החזקה · {door}",name:"שם",zone:"אזור זמן",week:"שעות פתיחה בשבוע",closed:"סגור",addPeriod:"הוספת טווח",removePeriod:"הסרת הטווח",from:"מ־",to:"עד",holidays:"תאריכים מיוחדים",addHoliday:"הוספת תאריך",removeHoliday:"הסרת התאריך",holidayName:"שם",holidayStart:"מתאריך",holidayEnd:"עד תאריך",holidayClosed:"סגור כל היום",holidayOpen:"פתוח בשעות",save:"שמירה",cancel:"ביטול",problems:{name:"יש לתת שם (עד 32 תווים).",time:"שעה לא תקינה (HH:MM, סיום עד 24:00).",order:"שעת ההתחלה חייבת להיות לפני שעת הסיום.",overlap:"טווחי השעות חופפים.",tooMany:"יותר מדי טווחים.",date:"תאריך לא תקין.",dateOrder:"תאריך ההתחלה אחרי תאריך הסיום.",dateOverlap:"התאריכים המיוחדים חופפים.",zone:"אזור הזמן חסר."}},codes:{slot:"קוד {n}",set:"מוגדר",notSet:"לא מוגדר",unknown:"לא ידוע",never:"ערך של קוד אף פעם לא מוצג כאן - רק אם הוא מוגדר.",define:"הגדרה",replace:"החלפה",clear:"ניקוי",formSet:"הגדרת {slot}",formReplace:"החלפת {slot}",formClear:"ניקוי {slot}",door:"הדלת שהקוד פותח",newCode:"קוד חדש (4-16 ספרות)",repeat:"הקוד החדש שוב",current:"הקוד הנוכחי",currentHint:"העמדה מבקשת את הקוד הנוכחי כדי להחליף או לנקות אותו.",compatibility:"מצב תאימות (העמדה אינה מצהירה על תמיכה)",typed:"לאישור, הקלידו: {phrase}",send:"שליחה לעמדה",cancel:"ביטול",load:"קריאת מצב הקודים",problems:{newCode:"קוד חייב להכיל 4-16 ספרות.",repeat:"שני הקודים החדשים אינם זהים.",currentCode:"יש להזין את הקוד הנוכחי (4-16 ספרות).",typed:"הטקסט שהוקלד אינו תואם."},rate:"עד {n} שינויי קוד ב־{m} דקות."},programs:{none:"אין תוכנית",on:"מופעלת",paused:"מושהית",removing:"בהסרה",exec:{idle:"לא מחזיקה כרגע",opening:"שולחת החזקה",held_acknowledged:"החזקה אושרה (המצב הפיזי לא אומת)",restoring:"חוזרת לשליטה רגילה",unknown:"תוצאה לא ידועה"},apply:"החלה מלוח ההחזקה",resume:"הפעלה מחדש",pause:"השהיה",remove:"הסרה",needDraft:"כדי להחיל תוכנית שמרו קודם לוח החזקה לדלת.",pauseFirst:"כדי להחיל לוח חדש יש להשהות קודם את התוכנית."},confirm:{hold_save:{title:"לשמור את לוח ההחזקה?",one:'הלוח "{name}" יישמר כטיוטה ל{door} בעמדה {station}. הדלת לא תיפתח עד שתוחל תוכנית.'},hold_delete:{title:"למחוק את לוח ההחזקה?",one:"לוח ההחזקה של {door} בעמדה {station} יימחק."},program_apply:{title:"להחיל תוכנית החזקה?",one:'מעכשיו {door} בעמדה {station} תוחזק פתוחה אוטומטית בשעות של "{name}". המערכת תפעל לבד לפי הלוח.'},program_pause:{title:"להשהות את התוכנית?",one:"התוכנית של {door} בעמדה {station} תושהה, והדלת תתבקש לחזור לשליטה רגילה."},program_remove:{title:"להסיר את התוכנית?",one:"התוכנית של {door} בעמדה {station} תוסר, והדלת תתבקש לחזור לשליטה רגילה."},send:"אישור ושליחה",cancel:"ביטול"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"בוצע ואושר",partial:"בוצע חלקית: התוכנית נשמרה, אך לא ברור אם הטיוטה הישנה נמחקה",refused:"WisKey סירב: {reason}",notSent:"לא נשלח",notSentWhy:"לא נשלח: {reason}",unknown:"נשלח, לא התקבלה תשובה ברורה - ייתכן שבוצע. טענו מחדש לפני שמנסים שוב",unknownWhy:"נשלח, לא התקבלה תשובה ברורה ({reason}) - ייתכן שבוצע. טענו מחדש לפני שמנסים שוב"},kinds:{hold_save:"שמירת לוח",hold_delete:"מחיקת לוח",code_write:"קוד ציבורי",program_save:"החלת תוכנית",program_action:"עדכון תוכנית"},historyEmpty:"אין עדיין שינויים טכניים בעמדה הזו.",historyCode:"{action} {slot}",codeActions:{set:"הגדרת",clear:"ניקוי"},programActions:{pause:"השהיה",remove:"הסרה"},reasons:{unauthorized:"אין הרשאה לפקודה הזו",forbidden:"אין הרשאה",reauth_required:"נדרש אימות מחדש לפעולות רגישות",screen_locked:"המסך נעול",approval_required:"נדרש אישור כפול",device_busy:"העמדה עסוקה בפקודה טכנית אחרת",revision_conflict:"הנתונים השתנו מאז שנטענו",hold_pause_before_edit:"יש להשהות את התוכנית קודם",schedule_limit:"הגעתם למספר המרבי של לוחות",operation_unsupported:"העמדה אינה תומכת בפעולה",unmanaged_lock:"הדלת אינה מנוהלת",station_retiring:"העמדה בהוצאה משימוש",station_unloaded:"העמדה נטענה מחדש באמצע הפעולה",invalid_fields:"פרמטרים לא תקינים",schedule_invalid:"לוח הזמנים אינו תקין",confirmation_required:"לא אושר",typed_confirmation_required:"הטקסט לאישור לא הוקלד נכון",expired:"הבקשה פגה לפני שנשלחה",intercom_duplicate_command:"כבר נשלח",intercom_station_offline:"העמדה אינה מחוברת",intercom_station_not_found:"העמדה לא נמצאה",intercom_lock_unknown:"אין לעמדה דלת כזו",door_tech_invalid:"ערך לא תקין",door_tech_unsupported:"הגרסה המותקנת אינה מציעה את הפעולה",door_tech_cooldown:"נשלח לפני רגע",door_tech_code_rate_limited:"יותר מדי שינויי קוד בזמן קצר",door_tech_rate_limited:"יותר מדי שינויים בזמן קצר",door_tech_busy:"שינוי אחר בעמדה עדיין רץ",door_tech_code_not_set:"הקוד אינו מוגדר",relay_map_unreadable:"לא ניתן היה לקרוא את מיפוי הדלתות",explicit_deny:"ההרשאה נשללה בעמדה הזו",no_binding:"אין הרשאה",wall_account:"חשבון תצוגה",intercom_unavailable:"מערכת האינטרקום אינה זמינה",intercom_busy:"מערכת האינטרקום עסוקה",intercom_rate_limited:"הוגבל קצב",rate_limited:"הוגבל קצב",timeout:"אין תשובה בזמן",action_failed:"כשל לא מפורט",invalid_response:"תשובה לא צפויה",ambiguous_write:"העמדה לא אישרה בבירור",readback_mismatch:"הקריאה החוזרת לא תאמה",network:"אין חיבור לשרת",unknown_reason:"סיבה לא ידועה"}},zt=ot("en","i18n/wiskey-door-tech","en");function z(){return lt(["en"])==="en"?zt:_t}rt("i18n/wiskey-door-tech",{he:_t,en:zt});var ti=Object.defineProperty,si=Object.getOwnPropertyDescriptor,C=(e,t,s,a)=>{for(var i=a>1?void 0:a?si(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&ti(t,s,i),i};let x=class extends I{constructor(){super(...arguments),this.station=null,this.live=!0,this.open=!1,this.tab="hold",this.phase="idle",this.view=null,this.programs=null,this.holds={},this.zone="Asia/Jerusalem",this.codes=null,this.codesPhase="idle",this.editing=null,this.codeForm=null,this.pending=null,this.running=null,this.results={},this.seq=0,this.loadedFor=""}mayWrite(){return T("system.configure")||T("access.stations.manage")}willUpdate(e){e.has("station")&&this.station&&this.station.id!==this.loadedFor&&(this.loadedFor=this.station.id,this.reset()),this.hidden=!this.station||!this.mayWrite()}reset(){this.seq++,this.open=!1,this.view=null,this.programs=null,this.holds={},this.codes=null,this.codesPhase="idle",this.phase="idle",this.editing=null,this.codeForm=null,this.pending=null,this.running=null,this.results={}}doors(){return(this.view?.locks??this.station?.locks.map(e=>({door:e.physical_index,name:e.name??null}))??[]).map(e=>e.door)}doorName(e){const t=z();return this.view?.locks.find(a=>a.door===e)?.name?.trim()||u(t.door,{n:e})}async openDialog(){this.open=!0,this.tab="hold",await this.load()}async load(){const e=this.station;if(!e)return;const t=++this.seq;this.phase="loading";try{const s=await qa(e.id);if(t!==this.seq)return;if(this.view=s,!s.allowed){this.phase="ready";return}const[a,...i]=await Promise.all([pt(e.id),...s.locks.map(n=>Ha(e.id,n.door))]);if(t!==this.seq)return;this.programs=a.programs,this.zone=a.programs?.timezone||i.find(n=>n.hold?.timezone)?.hold?.timezone||this.zone,this.holds=Object.fromEntries(s.locks.map((n,r)=>[n.door,i[r]?.hold?.draft??null])),this.phase="ready"}catch{t===this.seq&&(this.phase="error")}}async loadCodes(){const e=this.station;if(!e)return;const t=this.seq;this.codesPhase="loading";try{const s=await ut(e.id);if(t!==this.seq)return;this.codes=s.codes,this.codesPhase=s.codes?"ready":"error"}catch{t===this.seq&&(this.codesPhase="error")}}pick(e){this.tab=e,this.pending=null,e==="codes"&&this.codesPhase==="idle"&&this.loadCodes()}ask(e){this.pending=e,this.updateComplete.then(()=>{const t=this.renderRoot.querySelector("[data-wk-dt-confirm]");t?.scrollIntoView({block:"nearest"}),t?.querySelector("[data-wk-dt-send]")?.focus()})}async send(){const e=this.pending;!e||this.running||(this.pending=null,await this.execute(e.key,e.kind,e.send))}async execute(e,t,s){const a=this.station?.id;this.running=e,this.results={...this.results,[e]:{kind:t,status:"sending",code:null,retry_after_s:null,data:null}};const i=await s();this.station?.id===a&&(this.running=null,this.results={...this.results,[e]:i},this.dispatchEvent(new CustomEvent("door-tech-changed",{detail:i,bubbles:!0,composed:!0})),await this.load(),e.startsWith("code:")&&await this.loadCodes())}stationName(){return this.station?.name??""}askHoldSave(){const e=this.editing,t=this.station;if(!e||!t||Ve(e.body).length)return;const s=z(),a=Ge(e.body),i=e.door,n=e.revision;this.ask({key:`hold:${i}`,kind:"hold_save",title:s.confirm.hold_save.title,sentence:u(s.confirm.hold_save.one,{name:a.name,door:this.doorName(i),station:this.stationName()}),send:async()=>{const r=await J("hold_save",()=>ja(t.id,i,n,a));return r.status==="acknowledged"&&(this.editing=null),r}})}askHoldDelete(e){const t=this.station,s=this.holds[e];if(!t||!s||s.revision===null)return;const a=z(),i=s.revision;this.ask({key:`hold:${e}`,kind:"hold_delete",title:a.confirm.hold_delete.title,sentence:u(a.confirm.hold_delete.one,{door:this.doorName(e),station:this.stationName()}),send:()=>J("hold_delete",()=>Ba(t.id,e,i))})}askProgramSave(e,t,s){const a=this.station;if(!a)return;const i=z();this.ask({key:`program:${e}`,kind:"program_save",title:i.confirm.program_apply.title,sentence:u(i.confirm.program_apply.one,{name:t.name,door:this.doorName(e),station:this.stationName()}),send:()=>J("program_save",()=>Wa(a.id,e,s,Ge(t),!0))})}askProgramAction(e,t){const s=this.station;if(!s||e.door===null||e.revision===null)return;const a=z(),i=t==="pause"?a.confirm.program_pause:a.confirm.program_remove,n=e.door,r=e.revision;this.ask({key:`program:${n}`,kind:"program_action",title:i.title,sentence:u(i.one,{door:this.doorName(n),station:this.stationName()}),send:()=>J("program_action",()=>Ua(s.id,n,r,t))})}async sendCode(e){e.preventDefault();const t=this.codeForm,s=this.station,a=this.view;if(!t||!s||!a||this.running)return;const i=this.renderRoot,n=f=>i.querySelector(`[data-wk-dt-code-field="${f}"]`)?.value??"",r={action:t.action,expected:t.expected,newCode:n("new"),repeatCode:n("repeat"),currentCode:n("current"),typed:n("typed"),phrase:Xa(a.confirm_phrase,t.slot),template:a.confirm_phrase,slot:t.slot},d=Za(r),c=i.querySelector("[data-wk-dt-code-problem]");if(d){c&&(c.textContent=z().codes.problems[d]);return}const h={slot:t.slot,action:t.action,door:t.door,expected:t.expected,newCode:r.newCode,currentCode:r.currentCode,compatibility:t.compatibility,confirmText:r.typed};i.querySelectorAll("[data-wk-dt-code-field]").forEach(f=>f.value=""),r.newCode=r.repeatCode=r.currentCode="",this.codeForm=null,await this.execute(`code:${t.slot}`,"code_write",()=>J("code_write",()=>Va(s.id,h)))}render(){const e=this.station;if(!e||!this.mayWrite())return l;const t=z();return o`<div class="row" data-wk-dt=${e.id}>
        <span class="t"><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</span>
        <wk-action-button icon="door" data-wk-dt-open @click=${()=>void this.openDialog()}>${t.open}</wk-action-button>
      </div>
      ${this.open?this.renderDialog(e):l}`}renderDialog(e){const t=z();return o`<sw-dialog
      open
      xl
      heading=${u(t.heading,{name:e.name})}
      ?locked=${!!this.running}
      data-wk-dt-dialog
      data-wk-dt-state=${this.phase}
      @close=${s=>{s.target===s.currentTarget&&(this.open=!1,this.pending=null,this.editing=null,this.codeForm=null)}}
    >
      <p class="sub">${t.sub}</p>
      ${this.renderBody()}
      <div slot="footer"><wk-action-button data-wk-dt-close ?disabled=${!!this.running} @click=${()=>this.open=!1}>${t.close}</wk-action-button></div>
    </sw-dialog>`}renderBody(){const e=z();if(this.phase==="loading"&&!this.view)return o`<p class="note" role="status">${e.loading}</p>`;if(this.phase==="error"&&!this.view)return o`<p class="note" role="status" data-wk-dt-error>${e.unavailable} <wk-action-button tone="quiet" @click=${()=>void this.load()}>${e.retry}</wk-action-button></p>`;const t=this.view;if(!t)return l;if(!t.allowed)return o`<p class="note warn" data-wk-dt-not-allowed>${e.notAllowed}</p>`;if(!t.locks.length)return o`<p class="note" data-wk-dt-no-doors>${e.noDoors}</p>`;const s=["hold","programs","codes","history"];return o`${t.online===!1?o`<p class="note warn" data-wk-dt-offline>${e.offline}</p>`:l}
      <div class="tabs" role="tablist" aria-label=${e.title}>
        ${s.map(a=>o`<button type="button" role="tab" aria-selected=${String(this.tab===a)} data-wk-dt-tab=${a} @click=${()=>this.pick(a)}>${e.tabs[a]}</button>`)}
      </div>
      <div role="tabpanel" data-wk-dt-panel=${this.tab}>
        ${this.tab==="hold"?this.renderHold():this.tab==="codes"?this.renderCodes():this.tab==="programs"?this.renderPrograms():this.renderHistory()}
      </div>`}renderConfirm(e){const t=z();return o`<div class="confirm" role="alertdialog" aria-label=${e.title} data-wk-dt-confirm=${e.kind}>
      <h5>${e.title}</h5>
      <p data-wk-dt-sentence>${e.sentence}</p>
      <div class="btns">
        <wk-action-button tone="primary" data-wk-dt-send ?disabled=${!this.live||!!this.running} @click=${()=>void this.send()}>${t.confirm.send}</wk-action-button>
        <wk-action-button data-wk-dt-cancel @click=${()=>this.pending=null}>${t.confirm.cancel}</wk-action-button>
      </div>
    </div>`}confirmAt(e){return this.pending?.key===e?this.renderConfirm(this.pending):l}result(e){const t=this.results[e];return t?o`<span class="line" role="status" data-wk-dt-result=${e} data-status=${t.status} data-tone=${Xe(t.status)}>${Ze(t,z())}</span>`:l}unsupported(e){return this.view?.commands?.[e]?.available===!1}renderHold(){const e=z();return this.editing?this.renderEditor():o`<p class="note">${e.hold.draftNote}</p>
      ${this.doors().map(t=>{const s=this.holds[t]??null,a=s?.policy?ce(s.policy,this.zone):null,i=Ye(a,e),n=`hold:${t}`,r=this.running===n;return o`<div class="door" data-wk-dt-hold=${t}>
          <div class="dh">
            <span class="n">${this.doorName(t)}${a?o` · <bdi>${a.name}</bdi>`:l}</span>
            <div class="btns">
              ${this.unsupported("hold_save")?l:o`<wk-action-button icon=${s?"edit":"plus"} data-wk-dt-hold-edit=${t} ?disabled=${!this.live||!!this.running||s?.revision===null}
                    @click=${()=>this.editing={door:t,revision:s?.revision??0,body:a??Ya(this.zone)}}>${s?e.hold.edit:e.hold.add}</wk-action-button>`}
              ${s&&!this.unsupported("hold_delete")?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-hold-delete=${t} ?busy=${r} ?disabled=${!this.live||!!this.running}
                    @click=${()=>this.askHoldDelete(t)}>${e.hold.remove}</wk-action-button>`:l}
            </div>
          </div>
          ${a?o`<div class="lines">${i.length?i.map(d=>o`<bdi>${d}</bdi>`):o`<span>${e.hold.noHours}</span>`}${a.holidays.length?o`<span>${u(e.hold.holidays,{n:a.holidays.length})}</span>`:l}</div>`:o`<span class="line">${e.hold.none}</span>`}
          ${this.confirmAt(n)} ${this.result(n)}
        </div>`})}`}change(e){if(!this.editing)return;const t=structuredClone(this.editing.body);e(t),this.editing={...this.editing,body:t}}periodInputs(e,t,s,a){const i=z().editor;return o`${e.map((n,r)=>o`<span class="period" data-wk-dt-period=${`${t}.${r}`}>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="07:00" aria-label=${i.from} .value=${n.start} @input=${d=>s(r,"start",d.target.value)} />
        <span aria-hidden="true">–</span>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="19:00" aria-label=${i.to} .value=${n.end} @input=${d=>s(r,"end",d.target.value)} />
        <wk-action-button tone="quiet" icon="close" icon-only label=${i.removePeriod} @click=${()=>a(r)}></wk-action-button>
      </span>`)}`}renderEditor(){const e=z(),t=this.editing,s=t.body,a=Ve(s),i=r=>a.filter(d=>d.field===r||d.field.startsWith(r+".")),n=r=>r.length?o`<span class="problem">${e.editor.problems[r[0].key]}</span>`:l;return o`<div class="form" data-wk-dt-editor=${t.door}>
      <h5>${u(t.revision?e.editor.titleEdit:e.editor.titleNew,{door:this.doorName(t.door)})}</h5>
      <div class="grid2">
        <label class="f">${e.editor.name}<input data-wk-dt-name maxlength="32" .value=${s.name} aria-invalid=${String(!!i("name").length)} @input=${r=>this.change(d=>d.name=r.target.value)} />${n(i("name"))}</label>
        <label class="f">${e.editor.zone}<input class="ltr" data-wk-dt-zone maxlength="64" .value=${s.timezone} @input=${r=>this.change(d=>d.timezone=r.target.value.trim())} />${n(i("timezone"))}</label>
      </div>
      <div>
        <div class="line">${e.editor.week}</div>
        ${se.map(r=>{const d=s.weekly[r]??[];return o`<div class="day" data-wk-dt-day=${r}>
            <span class="dn">${e.dayNames[r]}</span>
            <div>
              <div class="periods">
                ${d.length?l:o`<span class="closed">${e.editor.closed}</span>`}
                ${this.periodInputs(d,r,(c,h,f)=>this.change(w=>w.weekly[r][c][h]=f),c=>this.change(h=>h.weekly[r].splice(c,1)))}
                ${d.length<8?o`<wk-action-button tone="quiet" icon="plus" data-wk-dt-add-period=${r} @click=${()=>this.change(c=>c.weekly[r].push(d.length?{start:"",end:""}:{start:"07:00",end:"19:00"}))}>${e.editor.addPeriod}</wk-action-button>`:l}
              </div>
              ${n(i(`weekly.${r}`))}
            </div>
          </div>`})}
      </div>
      <div class="form">
        <div class="line">${e.editor.holidays}</div>
        ${s.holidays.map((r,d)=>o`<div class="holiday" data-wk-dt-holiday=${d}>
            <div class="grid2">
              <label class="f">${e.editor.holidayName}<input maxlength="32" .value=${r.name} @input=${c=>this.change(h=>h.holidays[d].name=c.target.value)} /></label>
              <span></span>
              <label class="f">${e.editor.holidayStart}<input type="date" lang=${Pe()} min="2000-01-01" max="2037-12-31" .value=${r.start} @input=${c=>this.change(h=>h.holidays[d].start=c.target.value)} /></label>
              <label class="f">${e.editor.holidayEnd}<input type="date" lang=${Pe()} min="2000-01-01" max="2037-12-31" .value=${r.end} @input=${c=>this.change(h=>h.holidays[d].end=c.target.value)} /></label>
            </div>
            <div class="periods">
              ${r.periods.length?l:o`<span class="closed">${e.editor.holidayClosed}</span>`}
              ${this.periodInputs(r.periods,`h${d}`,(c,h,f)=>this.change(w=>w.holidays[d].periods[c][h]=f),c=>this.change(h=>h.holidays[d].periods.splice(c,1)))}
              <wk-action-button tone="quiet" icon="plus" @click=${()=>this.change(c=>c.holidays[d].periods.push({start:"08:00",end:"12:00"}))}>${e.editor.addPeriod}</wk-action-button>
              <wk-action-button tone="quiet" icon="trash" @click=${()=>this.change(c=>c.holidays.splice(d,1))}>${e.editor.removeHoliday}</wk-action-button>
            </div>
            ${n(i(`holidays.${d}`))}
          </div>`)}
        ${n(a.filter(r=>r.field==="holidays"))}
        <div class="btns">
          <wk-action-button tone="quiet" icon="plus" data-wk-dt-add-holiday @click=${()=>this.change(r=>r.holidays.push({name:"",start:"",end:"",periods:[]}))}>${e.editor.addHoliday}</wk-action-button>
        </div>
      </div>
      <div class="btns">
        <wk-action-button tone="primary" icon="check" data-wk-dt-save ?disabled=${!this.live||!!this.running||a.length>0} @click=${()=>this.askHoldSave()}>${e.editor.save}</wk-action-button>
        <wk-action-button data-wk-dt-editor-cancel ?disabled=${!!this.running} @click=${()=>(this.editing=null,this.pending=null)}>${e.editor.cancel}</wk-action-button>
      </div>
      ${this.confirmAt(`hold:${t.door}`)} ${this.result(`hold:${t.door}`)}
    </div>`}renderPrograms(){const e=z(),t=this.view?.online!==!1;return o`${this.doors().map(s=>{const a=this.programs?.programs.find(O=>O.door===s)??null,i=this.holds[s]??null,n=i?.policy?ce(i.policy,this.zone):null,r=`program:${s}`,d=!this.live||!!this.running,c=!this.unsupported("program_save"),h=!this.unsupported("program_action"),f=!!a&&!a.enabled&&!a.removing,w=a?a.removing?e.programs.removing:a.enabled?e.programs.on:e.programs.paused:e.programs.none,v=a?.execution?.status?e.programs.exec[a.execution.status]:null,_=a?.policy?ce(a.policy,this.zone):null;return o`<div class="door" data-wk-dt-program=${s} data-state=${a?a.removing?"removing":a.enabled?"on":"paused":"none"}>
        <div class="dh">
          <span class="n">${this.doorName(s)}${_?.name?o` · <bdi>${_.name}</bdi>`:l}</span>
          <sw-badge kind=${a?a.removing?"stale":a.enabled?"live":"offline":"neutral"} label=${w}></sw-badge>
        </div>
        ${_?o`<div class="lines">${Ye(_,e).map(O=>o`<bdi>${O}</bdi>`)}</div>`:l}
        ${v&&a?.enabled?o`<span class="line">${v}</span>`:l}
        <div class="btns">
          ${c&&n&&(!a||f)?o`<wk-action-button tone="primary" icon="play" data-wk-dt-program-apply=${s} ?disabled=${d||!t} @click=${()=>this.askProgramSave(s,n,a?.revision??0)}>${e.programs.apply}</wk-action-button>`:l}
          ${c&&f&&_&&a?.revision!==null?o`<wk-action-button icon="play" data-wk-dt-program-resume=${s} ?disabled=${d||!t} @click=${()=>this.askProgramSave(s,_,a.revision)}>${e.programs.resume}</wk-action-button>`:l}
          ${h&&a?.enabled&&!a.removing?o`<wk-action-button icon="pause" data-wk-dt-program-pause=${s} ?disabled=${d} @click=${()=>this.askProgramAction(a,"pause")}>${e.programs.pause}</wk-action-button>`:l}
          ${h&&a&&!a.removing?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-program-remove=${s} ?disabled=${d} @click=${()=>this.askProgramAction(a,"remove")}>${e.programs.remove}</wk-action-button>`:l}
        </div>
        ${!n&&(!a||f)?o`<span class="line">${e.programs.needDraft}</span>`:l}
        ${n&&a?.enabled?o`<span class="line">${e.programs.pauseFirst}</span>`:l}
        ${this.confirmAt(r)} ${this.result(r)}
      </div>`})}`}renderCodes(){const e=z();if(this.codesPhase==="loading"&&!this.codes)return o`<p class="note" role="status">${e.loading}</p>`;if(this.codesPhase==="error"&&!this.codes)return o`<p class="note" data-wk-dt-codes-error>${e.unavailable} <wk-action-button tone="quiet" @click=${()=>void this.loadCodes()}>${e.retry}</wk-action-button></p>`;const t=this.codes;if(!t)return o`<wk-action-button @click=${()=>void this.loadCodes()}>${e.codes.load}</wk-action-button>`;const s=this.view?.online!==!1,a=!this.unsupported("code_write"),i=this.view?.limits;return o`<p class="note">${e.codes.never}${i?o` ${u(e.codes.rate,{n:i.code_max,m:Math.round(i.code_window_s/60)})}`:l}</p>
      ${this.codeForm?this.renderCodeForm(this.codeForm,t):l}
      ${t.slots.map(n=>{const r=`code:${n.slot}`,d=n.configured===!0?e.codes.set:n.configured===!1?e.codes.notSet:e.codes.unknown,c=!this.live||!!this.running||!s||n.configured===null||!!this.codeForm;return o`<div class="door" data-wk-dt-slot=${n.slot} data-configured=${String(n.configured)}>
          <div class="dh">
            <span class="n">${u(e.codes.slot,{n:n.slot})}</span>
            <sw-badge kind=${n.configured===!0?"live":n.configured===!1?"offline":"unknown"} label=${d}></sw-badge>
          </div>
          ${a?o`<div class="btns">
                <wk-action-button icon="lock" data-wk-dt-code-set=${n.slot} ?disabled=${c}
                  @click=${()=>this.codeForm={slot:n.slot,action:"set",expected:n.configured===!0,door:this.doors()[0]??1,compatibility:!1}}>${n.configured?e.codes.replace:e.codes.define}</wk-action-button>
                ${n.configured?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-code-clear=${n.slot} ?disabled=${c}
                      @click=${()=>this.codeForm={slot:n.slot,action:"clear",expected:!0,door:this.doors()[0]??1,compatibility:!1}}>${e.codes.clear}</wk-action-button>`:l}
              </div>`:l}
          ${this.result(r)}
        </div>`})}`}renderCodeForm(e,t){const s=z(),a=u(s.codes.slot,{n:e.slot}),i=e.action==="clear"?s.codes.formClear:e.expected?s.codes.formReplace:s.codes.formSet,n=Qa(this.view?.confirm_phrase??Vt.door_code.he,e.slot),r=this.doors();return o`<form class="confirm" data-wk-dt-code-form=${e.slot} data-action=${e.action} autocomplete="off" @submit=${d=>void this.sendCode(d)}>
      <h5>${u(i,{slot:a})}</h5>
      ${r.length>1?o`<div class="f"><span>${s.codes.door}</span>
            <sw-dropdown block data-wk-dt-code-door label=${s.codes.door} .value=${String(e.door)}
              .items=${r.map(d=>({id:String(d),label:this.doorName(d)}))}
              @change=${d=>this.codeForm={...e,door:Number(d.detail.id)}}></sw-dropdown></div>`:l}
      ${e.action==="set"?o`<div class="grid2">
            <label class="f">${s.codes.newCode}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="16" data-wk-dt-code-field="new" /></label>
            <label class="f">${s.codes.repeat}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="16" data-wk-dt-code-field="repeat" /></label>
          </div>`:l}
      ${e.expected?o`<label class="f">${s.codes.current}<input type="password" inputmode="numeric" autocomplete="off" maxlength="16" data-wk-dt-code-field="current" /><span class="line">${s.codes.currentHint}</span></label>`:l}
      ${t.capabilities.advertised===!1&&e.action==="set"?o`<label class="check"><input type="checkbox" data-wk-dt-code-compat .checked=${e.compatibility} @change=${d=>this.codeForm={...e,compatibility:d.target.checked}} />${s.codes.compatibility}</label>`:l}
      <label class="f">${u(s.codes.typed,{phrase:n})}<input autocomplete="off" maxlength="32" data-wk-dt-code-field="typed" /></label>
      <span class="problem" role="alert" data-wk-dt-code-problem></span>
      <div class="btns">
        <wk-action-button tone="primary" icon="lock" data-wk-dt-code-send ?disabled=${!this.live||!!this.running} @click=${d=>void this.sendCode(d)}>${s.codes.send}</wk-action-button>
        <wk-action-button data-wk-dt-code-cancel @click=${()=>this.codeForm=null}>${s.codes.cancel}</wk-action-button>
      </div>
    </form>`}renderHistory(){const e=z(),t=this.view?.history??[];return t.length?o`<ul class="hist" data-wk-dt-history>
      ${t.map(s=>{const a=s.kind==="code_write"&&s.slot?u(e.historyCode,{action:e.codeActions[s.code_action??"set"],slot:u(e.codes.slot,{n:s.slot})}):`${s.kind==="program_action"&&s.program_action?e.programActions[s.program_action]:e.kinds[s.kind]}${s.door?` · ${this.doorName(s.door)}`:""}`;return o`<li data-wk-dt-history-row=${s.kind} data-status=${s.status}>
          <span>${a}</span>
          <span class="line" data-tone=${Xe(s.status)}><bdi>${new Date(s.at).toLocaleString(dt(),{dateStyle:"short",timeStyle:"short"})}</bdi> · ${Ze(s,e)}</span>
        </li>`})}
    </ul>`:o`<p class="note" data-wk-dt-history-empty>${e.historyEmpty}</p>`}};x.styles=j`
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
      background: var(--sw-surface-2);
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
    label.f,
    div.f {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    input {
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
  `;C([g({attribute:!1})],x.prototype,"station",2);C([g({type:Boolean})],x.prototype,"live",2);C([p()],x.prototype,"open",2);C([p()],x.prototype,"tab",2);C([p()],x.prototype,"phase",2);C([p()],x.prototype,"view",2);C([p()],x.prototype,"programs",2);C([p()],x.prototype,"holds",2);C([p()],x.prototype,"zone",2);C([p()],x.prototype,"codes",2);C([p()],x.prototype,"codesPhase",2);C([p()],x.prototype,"editing",2);C([p()],x.prototype,"codeForm",2);C([p()],x.prototype,"pending",2);C([p()],x.prototype,"running",2);C([p()],x.prototype,"results",2);x=C([F("wk-door-tech")],x);var ai=Object.defineProperty,ii=Object.getOwnPropertyDescriptor,M=(e,t,s,a)=>{for(var i=a>1?void 0:a?ii(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&ai(t,s,i),i};const Qe={sync:"refresh",rescan:"search",health_refresh:"activity",clock_refresh:"clock"};let L=class extends I{constructor(){super(...arguments),this.station=null,this.live=!0,this.view=null,this.phase="idle",this.running=null,this.asking=null,this.results={},this.now=Date.now(),this.loadedFor="",this.loadedAt=Date.now(),this.seq=0,this.timer=0}mayRead(){return T("access.admin.read")||T("access.stations.manage")}connectedCallback(){super.connectedCallback(),this.timer=window.setInterval(()=>{this.now=Date.now()},1e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("station")&&this.station&&this.station.id!==this.loadedFor&&(this.loadedFor=this.station.id,this.view=null,this.results={},this.asking=null,this.mayRead()&&this.load()),this.hidden=!this.shown()}shown(){return!!this.station&&this.mayRead()&&(this.phase==="ready"||this.phase==="error"||this.phase==="loading"&&!!this.view)}async load(){const e=this.station?.id;if(!e)return;const t=++this.seq;this.phase="loading";try{const s=await la(e);if(t!==this.seq)return;this.view=s,this.loadedAt=Date.now(),this.now=this.loadedAt,this.phase="ready"}catch(s){if(t!==this.seq)return;this.phase=s instanceof B&&(s.status===403||s.status===404)?"hidden":"error"}}async run(e){const t=this.station;if(!t||this.running)return;this.asking=null,this.running=e,this.results={...this.results,[e]:{station_id:t.id,action:e,status:"sending",code:null,retry_after_s:null,data:null}};const s=await $t(t.id,e);this.station?.id===t.id&&(this.running=null,this.results={...this.results,[e]:s},this.dispatchEvent(new CustomEvent("station-op",{detail:s,bubbles:!0,composed:!0})),await this.load())}cooldownLeft(e){const t=this.view?.actions?.[e]?.cooldown_s??0;return Math.max(0,Math.ceil(t-(this.now-this.loadedAt)/1e3))}render(){const e=this.station;if(!e||!this.shown())return l;const t=R();return o`<div class="wrap" data-wk-maint=${e.id} data-wk-maint-state=${this.phase}>
      <div class="head">
        <h5><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</h5>
        <wk-action-button tone="quiet" icon="refresh" data-wk-maint-reload ?busy=${this.phase==="loading"} ?disabled=${this.phase==="loading"} @click=${()=>void this.load()}>${t.refresh}</wk-action-button>
      </div>
      ${this.phase==="error"&&!this.view?o`<div class="note" role="status" data-wk-maint-error>${t.unavailable}</div>`:l}
      ${this.view?this.renderHealth(e):l} ${this.view?this.renderOps(e):l} ${this.renderConfirm(e)}
    </div>`}renderHealth(e){const t=this.view,s=R();if(t.health_hidden)return o`<div class="note" data-wk-maint-hidden>${s.healthHidden}</div>`;const a=e.zone,i=t.technical,n=t.report?.health??null,r=i?.reconciled_at??t.report?.auth?.last_sync_ok_at??null,d=n?.events?.stream??i?.event_status?.stream??null,c=n?.clock??i?.clock??null,h=c?.skew_seconds,f=n?.access?.last_error??i?.last_error??null,w=pa(t),v=ua(t,s),_=t.report?.auth?.retained??0,O=q=>me(q,this.now,a,S());return o`<dl class="kv" data-wk-maint-health>
      <dt>${s.rows.lastSync}</dt>
      <dd data-wk-maint-last-sync><bdi>${r?O(r):s.never}</bdi></dd>
      ${i?.scanned_at?o`<dt>${s.rows.lastScan}</dt><dd><bdi>${O(i.scanned_at)}</bdi></dd>`:l}
      ${d?o`<dt>${s.rows.stream}</dt><dd data-wk-maint-stream=${d}>${s.stream[d]??s.stream.unknown}</dd>`:l}
      ${c?o`<dt>${s.rows.clock}</dt><dd data-wk-maint-clock>${h==null?s.clockStatus[c.status??""]??s.clockStatus.unavailable:Math.abs(h)<=2?s.clockOk:u(s.clockSkew,{n:Math.round(h)})}${c.checked_at?o` <span class="sub">· <bdi>${O(c.checked_at)}</bdi></span>`:l}</dd>`:l}
      ${n&&(n.consecutive_poll_failures??0)>0?o`<dt>${s.rows.polls}</dt><dd>${n.consecutive_poll_failures}</dd>`:l}
      <dt>${s.rows.lastError}</dt>
      <dd data-wk-maint-last-error>${f?o`${ve(f,s)}${ve(f,s)!==f?o` <code>${f}</code>`:l}`:o`<span class="sub">${s.none}</span>`}</dd>
      <dt>${s.rows.auth}</dt>
      <dd>
        <div class="auth ${w||v.length?"bad":""}" data-wk-maint-auth=${w?w.source:"none"}>
          ${w?o`<span data-wk-maint-auth-line>${w.step?u(s.authLine,{source:s.authSources[w.source]??w.source,step:wa(w.step,s),at:w.at?O(w.at):s.never}):u(s.authObserved,{source:s.authSources[w.source]??w.source,at:w.at?O(w.at):s.never})}</span>${w.status_code!==null&&w.status_code!==void 0?o`<span class="sub">${u(s.authCode,{code:`${w.status_code}${w.sub_status?` / ${w.sub_status}`:""}`})}</span>`:l}`:o`<span class="sub">${s.authNone}</span>`}
          ${v.length?o`<span data-wk-maint-auth-now>${u(s.authNow,{what:v.join(" · ")})}</span>`:l}
          ${_>0?o`<span class="sub" data-wk-maint-auth-count>${u(s.authCount,{n:_})}</span>`:l}
        </div>
      </dd>
    </dl>`}renderOps(e){const t=this.view,s=R(),a=vt.filter(n=>t.actions?.[n]?.allowed);if(!a.length)return l;const i=t.online??e.online;return o`${i?l:o`<div class="note" data-wk-maint-offline>${s.offlineHint}</div>`}
      <div class="ops" data-wk-maint-ops>
        ${a.map(n=>{const r=t.actions[n].needs_online,d=this.cooldownLeft(n),c=this.running===n,h=!this.live||!!this.running||r&&!i||d>0,f=this.results[n],w=t.last_runs?.[n]??null,v=f?be(f.status,f.code,s):d>0?u(s.cooldown,{n:d}):w?u(s.lastRun,{status:be(w.status,w.code,s),at:me(w.at,this.now,e.zone,S())}):"",_=f?ke(f.status):w?ke(w.status):"busy";return o`<div class="op">
            <wk-action-button icon=${Qe[n]} data-wk-maint-op=${n} ?busy=${c} ?disabled=${h} @click=${()=>this.asking=n}>${s.actions[n]}</wk-action-button>
            <span class="line" role="status" data-wk-maint-result=${n} data-status=${f?.status??w?.status??""} data-tone=${f||w?_:""}>${v}</span>
          </div>`})}
      </div>`}renderConfirm(e){const t=this.asking;if(!t)return l;const s=R(),a=s.confirm[t];return o`<sw-dialog open heading=${a.title} data-wk-maint-confirm=${t} @close=${i=>i.target===i.currentTarget&&(this.asking=null)}>
      <p class="sentence" data-wk-maint-sentence>${u(a.one,{name:e.name})}</p>
      <div slot="footer">
        <wk-action-button data-wk-maint-cancel @click=${()=>this.asking=null}>${s.confirm.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon=${Qe[t]} data-wk-maint-send ?disabled=${!this.live} @click=${()=>void this.run(t)}>${s.confirm.send}</wk-action-button>
      </div>
    </sw-dialog>`}};L.styles=j`
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
  `;M([g({attribute:!1})],L.prototype,"station",2);M([g({type:Boolean})],L.prototype,"live",2);M([p()],L.prototype,"view",2);M([p()],L.prototype,"phase",2);M([p()],L.prototype,"running",2);M([p()],L.prototype,"asking",2);M([p()],L.prototype,"results",2);M([p()],L.prototype,"now",2);L=M([F("wk-station-maintenance")],L);var ni=Object.defineProperty,oi=Object.getOwnPropertyDescriptor,ie=(e,t,s,a)=>{for(var i=a>1?void 0:a?oi(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&ni(t,s,i),i};const ri=8,li=3e4,di=`
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
`;let Z;function ci(){if(Z===void 0)try{Z=new CSSStyleSheet,Z.replaceSync(di)}catch{Z=null}return Z}function hi(e){const t=ci(),s=e;if(!(!t||!("adoptedStyleSheets"in s)||s.adoptedStyleSheets.includes(t)))try{s.adoptedStyleSheets=[...s.adoptedStyleSheets,t]}catch{}}let K=class extends I{constructor(){super(...arguments),this.stationId="",this.zone="",this.rows=null,this.next=null,this.poll=new Gt(this)}createRenderRoot(){return this}allowed(){return X()&&T("access.read")&&(T("access.events.read")||T("access.call"))}connectedCallback(){super.connectedCallback(),hi(this.getRootNode()),this.style.display="contents",this.poll.every("calls",li,()=>this.load(!1))}willUpdate(e){e.has("stationId")&&(this.rows=null,this.next=null,this.load(!1))}async load(e){if(!this.stationId||!this.allowed())return;const t=this.stationId;try{const s=await Yt(t,ri,e?this.next:null);if(t!==this.stationId)return;this.rows=e?[...this.rows??[],...s.calls]:s.calls,this.next=s.next}catch{}}when(e){const t=new Date(e),s={day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:!1},a=dt();try{return new Intl.DateTimeFormat(a,this.zone?{...s,timeZone:this.zone}:s).format(t)}catch{return new Intl.DateTimeFormat(a,s).format(t)}}render(){if(!this.allowed()||!this.rows?.length)return l;const e=Jt(),t=e.log;return o`<section class="dsec" data-wk-dsec="calls" data-call-log="ready">
      <h4><sw-icon name="history" size=${14}></sw-icon>${t.title}</h4>
      <ul>
        ${this.rows.map(s=>{const a=Zt(s,e),i=Xt(s);return o`<li data-call-row=${s.id} data-outcome=${s.outcome??s.state} data-tone=${a.tone}>
            <span class="cw" dir="ltr">${this.when(s.rang_at)}</span>
            <span class="cx"><span>${a.text}</span>${s.door_opened_at?o`<small data-call-row-door>${Qt(t.door,{name:s.door_opened_by_name||""})}</small>`:l}</span>
            <span class="cd" dir="ltr">${i!==null?es(i):""}</span>
          </li>`})}
      </ul>
      ${this.next?o`<button class="cm" data-call-log-more @click=${()=>void this.load(!0)}>${t.more}</button>`:l}
    </section>`}};ie([g({attribute:"station-id"})],K.prototype,"stationId",2);ie([g()],K.prototype,"zone",2);ie([p()],K.prototype,"rows",2);ie([p()],K.prototype,"next",2);K=ie([F("wk-call-history")],K);function pi(e,t){return o`<wk-call-history station-id=${e} zone=${t?.kind==="iana"?t.name:""}></wk-call-history>`}function ui(e){return!X()||!T("access.stations.manage")?l:o`<dt>${Ee("בדיקת קבלה")}</dt><dd><a href=${sa(e)} data-wk-live-validation=${e}>${Ee("הרצת בדיקת קבלה לעמדה")}</a></dd>`}const St=(e,t)=>t.zone??e.defaultZone,H=(e,t)=>me(t.last_seen,e.now,St(e,t),e.text),pe=e=>t=>{t.stopPropagation(),e()};function Ce(e,t){return t.camera_entity?e.media?e.failed[t.id]===e.poster?"failed":"image":"none":t.has_camera?"none":"nocam"}const Oe=(e,t)=>ht(t.id,e.poster);function Ct(e,t,s){const a=e.text.still,i=s==="nocam"?a.none:s==="failed"?a.failed:a.offline;return o`<div class="none" role="status"><sw-icon name=${s==="nocam"?"camera":"offline"} size=${20}></sw-icon><span>${t.online||s==="nocam"?i:a.offline}</span></div>`}function wi(e,t){if(!gt(t)&&!(t.online&&t.call_state==="ending"))return l;if(!G(e.policy,e.rights))return l;const s=t.call_state==="ringing";return o`<span class="callbadge ${t.call_state}" data-wk-call-badge=${t.call_state}>${s?o`<sw-icon name="bell" size=${14}></sw-icon>`:o`<span class="ic">${ue("phone",14)}</span>`}${ee(t.call_state,e.text)}</span>`}function fi(e,t){const s=e.text,a=Ce(e,t),i=we(t.id,e.places),n=t.online?`${s.still.tag} · ${ft(e.poster)}`:H(e,t);return o`<div class="media ${t.online?"":"off"}" data-wk-still=${t.id} data-still-state=${a}>
    ${a==="image"?o`<img src=${Oe(e,t)} alt=${u(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} /><span class="stamp"><bdi>${n}</bdi></span>`:Ct(e,t,a)}
    ${wi(e,t)}
    <button type="button" class="open" data-wk-open=${t.id} aria-label=${t.name} @click=${()=>e.open(t.id)}></button>
    <div class="scrim"><span class="name">${t.name}</span>${i?o`<span class="place">${i}</span>`:l}</div>
  </div>`}function mi(e,t){const s=Ce(e,t);return o`<span class="thumb ${t.online?"":"off"}" data-wk-thumb=${t.id}>${s==="image"?o`<img src=${Oe(e,t)} alt="" decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:o`<sw-icon name="camera" size=${18}></sw-icon>`}</span>`}function Q(e,t,s,a,i,n){const r=e.actions.armed,d=!!r&&r.id===t.id&&r.command===s&&r.callState===t.call_state;return o`<wk-action-button
    tone=${a}
    icon=${i}
    data-wk-call=${s}
    ?armed=${d}
    ?disabled=${!e.live||e.actions.callBusy.has(t.id)}
    label=${d?u(e.text.call.armedAria,{label:n}):n}
    @click=${c=>{c.stopPropagation(),e.call(t,s,c)}}
    >${d?e.text.call.armed:n}</wk-action-button
  >`}function gi(e,t=!1){const s=e.text.talk;return o`<wk-action-button tone="dashed" icon="window" href=${U()} data-wk-talk="classic" label=${s.hint} ?block=${t} size=${t?"lg":"md"} @click=${a=>a.stopPropagation()}
    >${t?s.classic:s.classicShort}</wk-action-button
  >`}function Ot(e,t,s){const a=e.talkControl?.(t,s);return a!==void 0?a:e.rights.talk?gi(e,s):l}function Tt(e,t,s=!1){const a=e.text,i=t.online?t.call_state:"unavailable";if(i!=="ringing"&&i!=="in_call"&&i!=="ending")return l;if(!G(e.policy,e.rights))return l;const n=e.clock.seconds(t.id,e.now),r=i==="ringing"?o`<sw-icon name="bell" size=${15}></sw-icon>`:ue("phone",15),d=e.rights.call&&i!=="ending";return o`<div class="callrow ${i} ${s?"big":""}" data-wk-call-row=${t.id} data-call=${i} role="group" aria-label=${a.call.group}>
    <span class="cs">${r}<span>${ee(i,a)}</span>${n!==null?o`<span class="dur" data-wk-call-clock>${ge(n)}</span>`:l}</span>
    ${d?o`<span class="ctl">${i==="ringing"?o`${Q(e,t,"answer","ok","phone",a.call.answer)}${Q(e,t,"reject","danger","close",a.call.reject)}`:o`${s?l:Ot(e,t,!1)}${Q(e,t,"hangUp","danger","hangup",a.call.hangUp)}`}</span>`:l}
  </div>`}function Te(e,t){if(!e.rights.door)return l;const s=e.text.door;return o`${te(t).map(a=>{const i=`${t.id}/${a.physical_index}`,n=e.actions.isHeld(i),r=e.actions.releasing.has(i),d=n?"held":r?"sending":"idle",c=n?s.held:r?s.sending:t.locks.length>1?u(s.openNamed,{name:ze(a,e.text)}):s.open;return o`<wk-action-button
      class="grow"
      icon="unlock"
      data-wk-door=${i}
      data-state=${d}
      ?busy=${r}
      ?disabled=${!e.live||!t.online||r||n}
      @click=${pe(()=>e.door(t,a.physical_index))}
      >${c}</wk-action-button
    >`})}`}function vi(e,t){return!e.rights.announce||!t.online?l:o`<wk-action-button icon="volume" icon-only data-wk-announce-at=${t.id} label=${e.text.announce} ?disabled=${!e.live} @click=${pe(()=>e.announce(t.id))}></wk-action-button>`}function At(e,t,s=!1){const a=e.actions.results[t.id];return a?o`<div class="result ${a.tone} ${s?"sticky":""}" role="status" data-wk-result=${t.id} data-tone=${a.tone}>${a.text}</div>`:l}function bi(e,t,s){t.composedPath().some(i=>i instanceof HTMLElement&&i.matches("button, a, wk-action-button, select, input, textarea, summary"))||e.open(s)}function ki(e,t){const s=t.technical;return s?o`<div class="tech" data-wk-tech-row>
    <sw-badge kind=${Se(t.sync_state)} label=${fe(t.sync_state,e.text)} data-wk-sync=${t.sync_state}></sw-badge>
    <span class="sp"></span>
    ${s.model?o`<code>${s.model}</code>`:l}
  </div>`:l}function $i(e,t){const s=e.text,a=mt(t),i=e.rights.door&&te(t).length>0||e.rights.announce&&t.online;return o`<sw-card flush interactive class="card ${a==="ringing"?"ringing":""}" data-wk-station=${t.id} data-status=${a} @click=${n=>bi(e,n,t.id)}>
    ${fi(e,t)}
    <div class="cb">
      <div class="hd">
        <sw-badge kind=${t.online?"live":"offline"} label=${t.online?s.status.online:s.status.offline}></sw-badge>
        <span>${s.seen.prefix} <b><bdi>${H(e,t)}</bdi></b></span>
      </div>
      ${Tt(e,t)}
      ${i?o`<div class="acts">${Te(e,t)}${vi(e,t)}</div>`:l}
      ${At(e,t)} ${ki(e,t)}
    </div>
  </sw-card>`}function $e(e,t,s=!1){const a=t.online?t.call_state:"";if(a!=="ringing"&&a!=="in_call"&&a!=="ending")return l;if(!G(e.policy,e.rights))return l;const i=e.clock.seconds(t.id,e.now),n=`${ee(a,e.text)}${i!==null?` · ${ge(i)}`:""}`;return s?o`<sw-badge kind=${a==="ringing"?"stale":"recorded"} label=${n} data-wk-call-pill=${a}></sw-badge>`:o`<span class="pillcall ${a}" data-wk-call-pill=${a}>${ee(a,e.text)}${i!==null?o` · <span class="dur">${ge(i)}</span>`:l}</span>`}function yi(e,t){const s=e.text,i=[we(t.id,e.places),t.technical?fe(t.sync_state,s):""].filter(Boolean).join(" · "),n=e.rights.call&&t.online&&t.call_state==="ringing"&&G(e.policy,e.rights);return o`<div class="row" data-wk-station=${t.id} data-status=${mt(t)}>
    <button type="button" class="rowmain" data-wk-open=${t.id} @click=${()=>e.open(t.id)}>
      ${mi(e,t)}
      <span class="rowtext"><span class="t"><span class="sdot ${t.online?"":"off"}" aria-hidden="true"></span><b>${t.name}</b></span>${i?o`<span class="s">${i}</span>`:l}</span>
    </button>
    <div class="rowside">
      ${$e(e,t)}
      <span class="seen">${s.seen.prefix} <bdi>${H(e,t)}</bdi></span>
      <div class="rowacts">
        ${n?Q(e,t,"answer","ok","phone",s.call.answer):l}${Te(e,t)}
      </div>
      <sw-icon name="chevron" size=${16} aria-hidden="true"></sw-icon>
    </div>
  </div>`}function xi(e,t){return o`<sw-card flush class="rows-card"><div class="rows" data-wk-rows>${ct(t,s=>s.id,s=>yi(e,s))}</div></sw-card>`}function _i(e,t){return o`<div class="grid" data-wk-grid>${ct(t,s=>s.id,s=>$i(e,s))}</div>`}function zi(e,t){const s=e.text,a=c=>c,i=t.some(c=>c.technical),n=o`<span style="color:var(--sw-text-3)">—</span>`,r=e.table==="compact"||e.table==="none",d=[{key:"name",label:s.table.station,render:c=>o`<wk-action-button tone="quiet" data-wk-open=${a(c).id} @click=${()=>e.open(a(c).id)}>${a(c).name}</wk-action-button>`},{key:"status",label:s.table.status,render:c=>{const h=a(c),f=o`<sw-badge kind=${h.online?"live":"offline"} label=${h.online?s.status.online:s.status.offline}></sw-badge>`;if(!r)return f;const w=$e(e,h,!0),v=h.online?l:o`<small style="color:var(--sw-text-3);font-size:var(--sw-fs-xs)"><bdi>${H(e,h)}</bdi></small>`;return w===l&&v===l?f:o`<span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:var(--sw-s-1)">${f}${w}${v}</span>`}}];return r||d.push({key:"call",label:s.table.call,render:c=>$e(e,a(c),!0)}),d.push({key:"actions",label:s.table.actions,render:c=>{const h=a(c),f=e.rights.call&&h.online&&h.call_state==="ringing"&&G(e.policy,e.rights);return o`<span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:var(--sw-s-2);max-inline-size:190px">${f?Q(e,h,"answer","ok","phone",s.call.answer):l}${Te(e,h)}</span>`}}),r||d.push({key:"place",label:s.table.place,render:c=>o`<span style="display:inline-block;white-space:normal;max-inline-size:130px;vertical-align:middle">${we(a(c).id,e.places)||"—"}</span>`},{key:"seen",label:s.table.seen,render:c=>o`<bdi>${H(e,a(c))}</bdi>`}),e.table==="full"&&d.push({key:"doors",label:s.table.doors,render:c=>o`<span style="display:inline-block;white-space:normal;max-inline-size:120px;vertical-align:middle">${te(a(c)).map(h=>ze(h,s)).join(", ")||"—"}</span>`}),i&&(d.push({key:"sync",label:s.table.sync,render:c=>a(c).technical?o`<sw-badge kind=${Se(a(c).sync_state)} label=${fe(a(c).sync_state,s)}></sw-badge>`:n}),e.table==="full"&&d.push({key:"model",label:s.table.model,ltr:!0,render:c=>{const h=a(c).technical;return h?.model||h?.firmware?o`<span style="display:inline-block;vertical-align:middle">${h.model?o`<span style="display:block">${h.model}</span>`:l}${h.firmware?o`<span style="display:block;color:var(--sw-text-3)">${h.firmware}</span>`:l}</span>`:n}})),d}function Si(e,t){const s=t.technical;if(!s)return l;const a=e.text,i=s.reconciled_at&&/(Z|[+-]\d\d:\d\d)$/.test(s.reconciled_at)?Ls(Date.parse(s.reconciled_at),e.now,St(e,t)??void 0,a):"",n=s.clock?.skew_seconds,r=n==null?"":Math.abs(n)<=2?a.tech.clockOk:u(a.tech.clockDrift,{n:Math.round(n)}),d=s.event_status?.stream,c=d?d==="connected"?a.tech.streamOk:["disconnected","unavailable","stopped","authentication_failed"].includes(d)?a.tech.streamDown:a.tech.streamUnknown:"";return o`<section class="dsec" data-wk-dsec="technical">
    <h4><sw-icon name="cpu" size=${14}></sw-icon>${a.drawer.technical}</h4>
    <dl class="kv">
      <dt>${a.tech.sync}</dt>
      <dd><sw-badge kind=${Se(t.sync_state)} label=${fe(t.sync_state,a)}></sw-badge>${i?o` · <bdi>${i}</bdi>`:l}</dd>
      ${s.model?o`<dt>${a.tech.model}</dt><dd><code>${s.model}</code></dd>`:l}
      ${s.firmware?o`<dt>${a.tech.firmware}</dt><dd><code>${s.firmware}</code></dd>`:l}
      <dt>${a.tech.relays}</dt>
      <dd>${u(a.tech.relaysValue,{n:t.locks.length,mode:t.lock_enabled?a.tech.relayOn:a.tech.relayOff})}</dd>
      ${ui(t.id)}
      ${r?o`<dt>${a.tech.clock}</dt><dd>${r}</dd>`:l} ${c?o`<dt>${a.tech.stream}</dt><dd>${c}</dd>`:l}
      ${t.errors?o`<dt>${a.tech.lastError}</dt><dd>${t.errors.last_error?o`<code data-wk-last-error>${t.errors.last_error}</code>`:o`<span class="muted">${a.tech.none}</span>`}</dd>`:l}
      ${t.errors?.scan_error?o`<dt>${a.tech.scanError}</dt><dd><code>${t.errors.scan_error}</code></dd>`:l}
    </dl>
    <wk-deep-links place="station"></wk-deep-links>
    <wk-station-maintenance .station=${t} ?live=${e.live}></wk-station-maintenance>
  </section>`}function Pt(e,t){const s=e.text.prog;if(t.state==="ready")return l;const a=t.state==="unsupported"?s.unsupported:t.state==="busy"?s.busy:t.state==="error"?s.unavailable:s.loading;return o`<div class="muted" role="status" data-wk-fetch=${t.state}>${a}${t.state==="error"||t.state==="busy"?o` · <wk-action-button tone="quiet" @click=${()=>e.retryDetail()}>${e.text.retry}</wk-action-button>`:l}</div>`}function Ci(e,t,s){const a=e.text;if(!s||s.programs.state!=="ready")return s?Pt(e,s.programs):o`<div class="muted" role="status" data-wk-fetch="loading">${a.prog.loading}</div>`;const i=Ds(s.programs.data,t,a);return i.length?o`${i.map(n=>o`<div class="prog" data-wk-program=${n.door}>
      <div class="ph">
        <span>${n.name}</span>
        ${n.none?o`<sw-badge kind="neutral" label=${a.prog.none}></sw-badge>`:o`<sw-badge kind=${n.removing?"stale":n.enabled?"live":"offline"} label=${n.removing?a.prog.removing:n.enabled?a.prog.on:a.prog.off}></sw-badge>${n.status&&n.enabled&&!n.removing?o`<sw-badge kind="recorded" label=${n.status}></sw-badge>`:l}`}
      </div>
      ${n.hours.map(r=>o`<div class="line">${a.prog.hours}: <bdi>${r}</bdi></div>`)}
      ${n.holidays?o`<div class="line muted">${u(a.prog.holidays,{n:n.holidays})}</div>`:l}
      ${n.error?o`<div class="line"><sw-badge kind="error" label=${a.prog.error}></sw-badge></div>`:l}
      ${!n.none&&n.unreadable?o`<div class="line muted">${a.prog.unknownShape}</div>`:l}
    </div>`)}`:l}function Oi(e,t){const s=e.text;if(!t)return l;if(t.codes.state!=="ready")return o`<div class="prog">${Pt(e,t.codes)}</div>`;const a=Ms(t.codes.data,s);return o`<div class="prog" data-wk-codes=${a.state}>
    <div class="ph"><span>${s.prog.codes}</span><sw-badge kind=${a.state==="set"?"live":a.state==="unset"?"offline":"unknown"} label=${a.label}></sw-badge></div>
    ${a.slots.length>1?a.slots.map(i=>o`<div class="line">${i.label}: ${i.state==="set"?s.prog.codeConfigured:i.state==="unset"?s.prog.codeNotConfigured:s.prog.codeUnknown}</div>`):l}
  </div>`}function Ti(e,t){if(!t.technical)return l;const s=e.features.door_programs!==!1,a=e.features.public_codes!==!1;if(!s&&!a)return l;const i=e.text,n=e.detail[t.id];return o`<section class="dsec" data-wk-dsec="settings">
    <button type="button" class="toggle" aria-expanded=${String(e.detailOpen)} data-wk-settings-toggle @click=${()=>e.toggleDetail()}>
      <sw-icon name="chevronDown" size=${14}></sw-icon><span>${i.drawer.doorSettings}</span>
    </button>
    ${e.detailOpen?o`${s&&te(t).length?Ci(e,t,n):l}${a?Oi(e,n):l}`:l}
    ${e.detailOpen?o`<wk-door-tech .station=${t} ?live=${e.live} @door-tech-changed=${()=>e.retryDetail()}></wk-door-tech>`:l}
  </section>`}function Ai(e,t){const s=As(t.id,Le.events==="smplwise",T("access.events.read")),a=Ps(t,Le.schedules==="smplwise",T("access.stations.read"));return!s&&!a?l:o`<div class="evlink">
    ${s?o`<wk-action-button tone="quiet" icon="history" href=${s} data-wk-station-events=${t.id}>${Es("stationEvents")}</wk-action-button>`:l}
    ${a?o`<wk-action-button tone="quiet" icon="calendar" href=${a} data-wk-station-schedules=${t.id}>${e.text.drawer.schedules}</wk-action-button>`:l}
  </div>`}function Pi(e,t){const s=e.text,a=Ce(e,t),i=we(t.id,e.places),n=te(t),r=e.rights.call||G(e.policy,e.rights)&&(t.online?["ringing","in_call","ending"].includes(t.call_state):!1),d=t.online&&["ringing","in_call","ending"].includes(t.call_state),c=e.actions.tts[t.id],h=c?wt(c,s):"",f=e.liveArea?.(t)??null,w=e.rights.call&&t.online?e.dialControl?.(t,d):void 0;return o`
    ${f??o`<div class="live ${t.online?"":"off"}" data-wk-live data-still-state=${a}>
      ${a==="image"?o`<img src=${Oe(e,t)} alt=${u(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:Ct(e,t,a)}
      ${a==="image"?o`<span class="stamp"><bdi>${s.drawer.lastStill} · ${t.online?ft(e.poster):H(e,t)}</bdi></span>`:l}
      <div class="ov"><span class="t"><sw-icon name="play" size=${16}></sw-icon>${s.drawer.liveClassic}</span><wk-action-button icon="window" href=${U()} data-wk-classic-link>${s.drawer.openClassic}</wk-action-button></div>
    </div>`}
    <div class="meta">${i?o`<span>${i}</span>`:l}<span>${s.seen.prefix} <bdi>${H(e,t)}</bdi></span></div>
    ${Ai(e,t)}
    ${At(e,t,!0)}
    ${r?o`<section class="dsec" data-wk-dsec="call">
          <h4>${ue("phone",14)}${s.drawer.call}</h4>
          ${d?o`${Tt(e,t,!0)}${t.call_state==="in_call"?Ot(e,t,!0):l}`:o`<div class="callrow"><span class="cs muted">${s.call.none}</span>${e.rights.call&&t.online&&w===void 0?o`<wk-action-button tone="dashed" icon="phone" href=${U()} data-wk-dial>${s.call.dial}</wk-action-button>`:l}</div>`}
          ${w??l}
        </section>`:l}
    ${n.length||e.rights.door?o`<section class="dsec" data-wk-dsec="doors">
          <h4><sw-icon name="door" size=${14}></sw-icon>${s.drawer.doors}</h4>
          ${n.length?n.map(v=>{const O=e.detail[t.id]?.programs.data?.programs.find(q=>q.door===v.physical_index)?.execution?.status==="held_acknowledged";return o`<div class="doorrow" data-wk-doorrow=${v.physical_index}>
                  <span class="dn">${ze(v,s)}</span>
                  <span class="ds">${O?o`<sw-icon name="clock" size=${12}></sw-icon>${s.prog.state.held_acknowledged}`:l}</span>
                  ${e.rights.door?o`<wk-action-button
                        icon="unlock"
                        data-wk-door=${`${t.id}/${v.physical_index}`}
                        data-state=${e.actions.isHeld(`${t.id}/${v.physical_index}`)?"held":e.actions.releasing.has(`${t.id}/${v.physical_index}`)?"sending":"idle"}
                        ?busy=${e.actions.releasing.has(`${t.id}/${v.physical_index}`)}
                        ?disabled=${!e.live||!t.online||e.actions.releasing.has(`${t.id}/${v.physical_index}`)||e.actions.isHeld(`${t.id}/${v.physical_index}`)}
                        @click=${pe(()=>e.door(t,v.physical_index))}
                        >${e.actions.isHeld(`${t.id}/${v.physical_index}`)?s.door.held:e.actions.releasing.has(`${t.id}/${v.physical_index}`)?s.door.sending:s.door.open}</wk-action-button
                      >`:l}
                </div>`}):o`<span class="muted">${s.door.none}</span>`}
        </section>`:l}
    ${e.rights.announce?o`<section class="dsec" data-wk-dsec="announce">
          <h4><sw-icon name="volume" size=${14}></sw-icon>${s.drawer.announce}</h4>
          <div class="callrow"><span class="cs muted" data-wk-announce-state>${h||s.drawer.announceHint}</span><wk-action-button icon="volume" data-wk-announce-at=${t.id} ?disabled=${!e.live||!t.online} @click=${pe(()=>e.announce(t.id))}>${s.announce}</wk-action-button></div>
        </section>`:l}
    ${pi(t.id,t.zone)}
    ${Si(e,t)} ${Ti(e,t)}
  `}var Ei=Object.defineProperty,Li=Object.getOwnPropertyDescriptor,k=(e,t,s,a)=>{for(var i=a>1?void 0:a?Li(t,s):t,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(a?r(t,s,i):r(i))||i);return a&&i&&Ei(t,s,i),i};const Et="sw.wiskey.stations.view",Lt="sw.wiskey.stations.treeCollapsed",et=3e4;function Dt(e){try{return localStorage.getItem(e)}catch{return null}}function tt(e,t){try{localStorage.setItem(e,t)}catch{}}const Di=()=>{const e=Dt(Et);return e==="list"||e==="table"?e:"cards"},Mi=()=>{try{const e=JSON.parse(Dt(Lt)??"[]");return new Set(Array.isArray(e)?e.filter(t=>typeof t=="string"):[])}catch{return new Set}},le={kind:"iana",name:"Asia/Jerusalem"},st=[{id:"d1",name:"שער ראשי",online:!0,call_state:"ringing",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:le,technical:null,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:le,technical:null,errors:null},{id:"d3",name:"חניון",online:!0,call_state:"idle",sync_state:"pending",lock_enabled:!1,locks:[],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:le,technical:null,errors:null},{id:"d4",name:"מחסן",online:!1,call_state:"unavailable",sync_state:"offline",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!1,camera_entity:null,last_seen:"2026-09-26T19:02:00+03:00",zone:le,technical:null,errors:null}];let m=class extends I{constructor(){super(...arguments),this.feed=null,this.error="",this.forbidden=!1,this.filter="all",this.query="",this.view=Di(),this.place="all",this.places=null,this.collapsed=Mi(),this.selected=null,this.sheet=!1,this.announceOpen=!1,this.announceFor="",this.policy=Rs,this.features={},this.detail={},this.detailOpen=!1,this.now=Date.now(),this.poster=Date.now(),this.failed={},this.table=He(typeof window>"u"?1440:window.innerWidth),this.mediaMode="off",this.media={},this.mediaAt={},this.cardPage=1,this.perPage=0,this.fitObserver=null,this.fitGrid=null,this.mqd=typeof matchMedia=="function"?matchMedia("(min-width: 1101px)"):null,this.lists=new aa(this,()=>{this.cardPage=1}),this.clock=new Ns,this.actions=new he({release:(e,t)=>as(e,t),signal:(e,t)=>ss(e,t),station:e=>this.list().find(t=>t.id===e),live:()=>this.isLive(),now:()=>Date.now(),tick:()=>performance.now(),after:(e,t)=>window.setTimeout(e,t),cancel:e=>window.clearTimeout(e),changed:()=>this.requestUpdate(),refetch:()=>void this.load(),stamp:()=>ts(new Date)}),this.stop=null,this.stopRoute=null,this.poll=0,this.tickTimer=0,this.posterTimer=0,this.loading=!1,this.loadAgain=!1,this.placesKey="",this.detailAt={},this.mqc=typeof matchMedia=="function"?matchMedia(`(max-width: ${Is}px)`):null,this.mqm=typeof matchMedia=="function"?matchMedia(`(max-width: ${Fs}px)`):null,this.mqn=typeof matchMedia=="function"?matchMedia(`(max-width: ${qs-1}px)`):null,this.onMedia=()=>{this.table=He(window.innerWidth)},this.onFitMedia=()=>{this.perPage=0,this.watchFit()}}connectedCallback(){if(super.connectedCallback(),this.mqc?.addEventListener("change",this.onMedia),this.mqm?.addEventListener("change",this.onMedia),this.mqn?.addEventListener("change",this.onMedia),this.mqd?.addEventListener("change",this.onFitMedia),this.stopRoute=is(e=>this.onRoute(e)),!!X()){if(!T("access.read")){this.forbidden=!0;return}this.load(),this.readFeatures(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.poster=Date.now())},Hs),this.stop=ns(e=>{e.type==="intercom_tts"?this.actions.noteTts(e.status):e.type!=="heartbeat"&&this.load()},e=>{this.setPolling(!e),e&&this.load()}),this.schedule()}}disconnectedCallback(){super.disconnectedCallback(),this.mqc?.removeEventListener("change",this.onMedia),this.mqm?.removeEventListener("change",this.onMedia),this.mqn?.removeEventListener("change",this.onMedia),this.mqd?.removeEventListener("change",this.onFitMedia),this.fitObserver?.disconnect(),this.fitObserver=null,this.fitGrid=null,this.stop?.(),this.stop=null,this.stopRoute?.(),this.stopRoute=null,this.setPolling(!1),window.clearInterval(this.posterTimer),window.clearTimeout(this.tickTimer),this.actions.dispose()}willUpdate(e){(e.has("filter")||e.has("query")||e.has("place"))&&(this.cardPage=1)}updated(e){(e.has("selected")||e.has("detailOpen"))&&this.maybeLoadDetail(),(e.has("selected")||e.has("mediaMode"))&&this.maybeLoadMedia(),this.watchFit()}watchFit(){const e=this.mqd?.matches&&this.effectiveView()==="cards"?this.renderRoot.querySelector(".main > .grid"):null;if(e!==this.fitGrid){if(this.fitObserver?.disconnect(),this.fitGrid=e,!e){this.perPage&&(this.perPage=0);return}typeof ResizeObserver>"u"||(this.fitObserver=new ResizeObserver(()=>requestAnimationFrame(()=>this.measureFit())),this.fitObserver.observe(e))}}measureFit(){const e=this.fitGrid;if(!e||!e.isConnected)return;const t=getComputedStyle(e),s=parseFloat(t.rowGap)||0,a=(parseFloat(t.paddingBlockStart)||0)+(parseFloat(t.paddingBlockEnd)||0),i=Math.max(1,t.gridTemplateColumns.split(" ").filter(Boolean).length),n=[...e.querySelectorAll(":scope > .card")];if(!n.length)return;const r=Math.max(...n.map(h=>h.offsetHeight));if(!r)return;const d=Math.max(1,Math.floor((e.clientHeight-a+s)/(r+s))),c=i*d;c!==this.perPage&&(this.perPage=c)}setPolling(e){window.clearInterval(this.poll),this.poll=e?window.setInterval(()=>void this.load(),js):0}schedule(){window.clearTimeout(this.tickTimer),this.tickTimer=window.setTimeout(()=>{this.now=Date.now(),this.clock.observe(this.list(),this.now),this.actions.prune(),this.schedule()},this.clock.active?1e3:2e4)}onRoute(e){if(e.mode!=="wiskey")return;const t=e.params.get("station");t&&t!==this.selected?(this.selected=t,this.detailOpen=!1):!t&&this.selected&&(this.selected=null,this.detailOpen=!1)}demo(){return!X()}list(){return this.demo()?st:this.feed?.stations??[]}isLive(){return!this.demo()&&this.feed?.state==="ready"&&this.feed.fresh!==!1}rights(){return this.demo()?Bs:Ws(De,this.policy,T)}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{const e=await us();this.feed=e,this.error="",this.forbidden=!1,this.afterLoad(e)}catch(e){e instanceof B&&e.status===403?this.forbidden=!0:this.error=ye(e)}}while(this.loadAgain)}finally{this.loading=!1}}afterLoad(e){this.now=Date.now(),this.clock.observe(e.stations??[],this.now),this.actions.dropStaleArm(),this.readPolicy(),this.ensurePlaces(e.stations??[]),this.maybeLoadMedia(),this.schedule()}async readPolicy(){try{const e=await xe();this.policy=Us(e),this.mediaMode=os(e)}catch{}}async readFeatures(){try{const e=await ws();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([t,s])=>[t,s.available]))}catch{}}async ensurePlaces(e){const t=e.filter(a=>a.camera_entity),s=t.map(a=>`${a.id}:${a.camera_entity}`).sort().join("|");if(s!==this.placesKey){if(this.placesKey=s,!t.length||!T("devices.read")){this.places=null;return}try{const[a,i]=await Promise.all([rs(),ls(t.map(n=>n.camera_entity))]);if(s!==this.placesKey)return;this.places=Ks(e,a,i.entities)}catch{this.places=null}}}maybeLoadDetail(){const e=this.selected;if(!e||!this.detailOpen||this.demo()||!this.list().find(a=>a.id===e)?.technical)return;const s=this.detailAt[e]??0;this.detail[e]&&Date.now()-s<et||this.loadDetail(e)}async loadDetail(e){this.detailAt={...this.detailAt,[e]:Date.now()};const t={state:"loading",data:null};this.detail={...this.detail,[e]:{programs:t,codes:t}};const s=i=>this.detail={...this.detail,[e]:{...this.detail[e],...i}},a=(i,n)=>i.state==="ready"&&n?{state:"ready",data:n}:i.state==="unsupported"?{state:"unsupported",data:null}:i.last_error==="busy"||i.last_error==="rate_limited"||i.last_error==="timeout"?{state:"busy",data:null}:{state:"error",data:null};if(this.features.door_programs!==!1)try{const i=await pt(e);s({programs:a(i,i.programs)})}catch{s({programs:{state:"error",data:null}})}else s({programs:{state:"unsupported",data:null}});if(this.features.public_codes!==!1)try{const i=await ut(e);s({codes:a(i,i.codes)})}catch{s({codes:{state:"error",data:null}})}else s({codes:{state:"unsupported",data:null}})}maybeLoadMedia(){const e=this.selected;!e||this.mediaMode==="off"||this.demo()||this.media[e]!==void 0&&Date.now()-(this.mediaAt[e]??0)<et||(this.mediaAt={...this.mediaAt,[e]:Date.now()},ds(e).then(t=>this.media={...this.media,[e]:t}).catch(()=>this.media={...this.media,[e]:null}))}posterOf(e){return!e.camera_entity||this.demo()||!Me("go2rtc")||this.failed[e.id]===this.poster?"":ht(e.id,this.poster)}liveArea(e,t){if(this.mediaMode==="off")return null;const s=this.media[e.id];if(!s||s.state!=="ready")return null;const a=!!s.video?.allowed&&Object.keys(s.video.paths).length>0;if(!a&&!s.talk?.available)return null;const i=!t.rights.call,n=i&&t.rights.talk&&!s.talk?.available;return o`<wk-station-live
      data-wk-live-native
      .stationId=${e.id}
      .stationName=${e.name}
      .media=${a?s:{...s,video:null}}
      .poster=${this.posterOf(e)}
      .live=${t.live&&e.online}
      .talkHere=${i}
      .classicHref=${n?U():""}
      .classicLabel=${t.text.talk.classic}
    ></wk-station-live>`}dialControl(e,t,s){const a=Re(this.mediaMode,this.media[e.id]);if(a.kind==="legacy")return;const i=de().dial;return a.kind==="native"?o`<div class="dialnative">
        <wk-talk-button
          dial
          data-wk-dial="native"
          .stationId=${e.id}
          .talk=${this.media[e.id]?.talk??null}
          .live=${s.live&&e.online}
          .idleLabel=${t?i.talk:i.dial}
        ></wk-talk-button>
        <wk-action-button tone="quiet" icon="window" href=${U()} data-wk-dial-classic="secondary">${i.classic}</wk-action-button>
      </div>`:o`<div class="callrow" data-wk-dial="reason" data-reason=${a.reason}>
      <span class="cs muted dialwhy" data-wk-dial-reason role="status">${i.reasons[a.reason]}</span>
      <wk-action-button tone="dashed" icon="window" href=${U()} data-wk-dial-classic>${i.classic}</wk-action-button>
    </div>`}talkControl(e,t,s){if(this.mediaMode==="video_talk")return t?Re(this.mediaMode,this.media[e.id]).kind!=="legacy"&&s.rights.call?l:this.liveArea(e,s)?l:void 0:!T("access.call")||!e.online?void 0:o`<wk-action-button icon="mic" data-wk-talk="drawer" label=${de().talk.openDrawer} @click=${a=>{a.stopPropagation(),this.open(e.id)}}>${de().talk.openDrawer}</wk-action-button>`}open(e){this.selected!==e&&(this.selected=e,this.detailOpen=!1,this.syncRoute(e))}closeDrawer(){this.selected=null,this.detailOpen=!1,this.syncRoute(null)}syncRoute(e){const t=cs();if(t.mode!=="wiskey")return;const s=new URLSearchParams(t.params);e?s.set("station",e):s.delete("station"),hs(t.path,s)}setView(e){this.view=e,tt(Et,e)}toggleFloor(e){const t=new Set(this.collapsed);t.has(e)?t.delete(e):t.add(e),this.collapsed=t,tt(Lt,JSON.stringify([...t]))}pickPlace(e){this.place=e,this.sheet=!1}ctx(){const e=this.features,t={text:S(),now:this.now,defaultZone:this.feed?.default_zone??null,live:this.isLive(),rights:this.rights(),policy:this.policy,places:this.places,actions:this.actions,clock:this.clock,table:this.table,media:this.demo()?!1:Me("go2rtc"),poster:this.poster,failed:this.failed,selected:this.selected,detail:this.detail,detailOpen:this.detailOpen,features:e,open:s=>this.open(s),door:(s,a)=>void this.actions.askRelease(s.id,a),call:(s,a,i)=>this.actions.tapCall(s.id,a,i.detail),announce:s=>{this.announceFor=s,this.announceOpen=!0},stillError:(s,a)=>this.failed={...this.failed,[s]:a},toggleDetail:()=>this.detailOpen=!this.detailOpen,retryDetail:()=>{this.selected&&this.loadDetail(this.selected)}};return this.mediaMode!=="off"&&(t.liveArea=s=>this.liveArea(s,t),t.talkControl=(s,a)=>this.talkControl(s,a,t),t.dialControl=(s,a)=>this.dialControl(s,a,t)),t}render(){const e=S();if(this.forbidden&&X())return o`<sw-page heading=${e.title}><div data-wk-stations data-wk-state="forbidden"><sw-state-panel state="forbidden" heading=${e.states.forbidden} data-wk-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return o`<sw-page heading=${e.title}><div data-wk-stations data-wk-state=${this.error?"error":"loading"}>${this.error?o`<sw-state-panel state="error" heading=${e.states.error} hint=${this.error} actionLabel=${e.retry} data-wk-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:o`<sw-state-panel state="loading" heading=${e.states.loading} data-wk-panel="loading"></sw-state-panel>`}</div></sw-page>`;const t=this.demo()?st:this.feed.stations;if(t===null){const s=this.feed.state==="ready"?"error":this.feed.state,a=Vs(s,e);return o`<sw-page heading=${e.title}>
        ${this.renderFeedBadge()}
        <div data-wk-stations data-wk-state=${`feed:${this.feed.state}`}>
          <sw-state-panel icon="door" state=${a.panel} heading=${a.heading} actionLabel=${a.settings&&De("system.configure")?e.states.toSettings:""} data-wk-panel=${`feed:${this.feed.state}`} @action=${()=>window.location.hash="#/system/diagnostics?tab=access-control"}></sw-state-panel>
        </div>
      </sw-page>`}return this.renderReady(t)}renderFeedBadge(){const e=S();if(this.demo())return o`<sw-badge slot="actions" kind="neutral" label=${e.demo} data-wk-feed="demo"></sw-badge>`;const t=this.feed;if(!t)return l;const s=t.state==="ready"&&t.fresh!==!1,a=s?"live":t.state==="connecting"?"unknown":t.state==="forbidden"?"forbidden":t.state==="error"?"error":t.stations?"stale":"offline",i=s?e.feed.live:t.state==="connecting"?e.feed.connecting:t.stations&&t.fetched_at?u(e.feed.stale,{ago:Gs(t.fetched_at,this.now,e)||"…"}):e.feed.off;return o`<sw-badge slot="actions" kind=${a} label=${i} data-wk-feed=${s?"live":t.state}></sw-badge>`}effectiveView(){return this.table==="none"&&this.view==="table"?"list":this.view}renderReady(e){const t=S(),s=this.ctx(),a=Ys(e,this.places,this.collapsed,t),i=a.length>0,n=i&&a.some(y=>y.id===this.place)?this.place:"all",r=Js(e,this.filter,this.query,n,this.places),d=Zs(e),c=this.effectiveView(),h=e.filter(gt).length,f=e.some(y=>y.online),w=e.length?"ready":"empty",v=a.find(y=>y.id===n)?.name??t.places.all,_=c==="cards"&&this.perPage>0&&this.lists.paged?this.perPage:0,O=_?Math.max(1,Math.ceil(r.length/_)):1,q=Math.min(Math.max(1,this.cardPage),O),Mt=_?r.slice((q-1)*_,q*_):r;return o`<sw-page wide heading=${t.title} subheading=${Xs(d,t)}>
      ${this.renderFeedBadge()}<wk-deep-links slot="actions" place="stations" mode="menu"></wk-deep-links>
      <div data-wk-stations data-wk-state=${w} data-view=${c} data-live=${String(s.live)}>
        ${e.length?o`<div class="toolbar">
              <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wk-search aria-label=${t.searchLabel} placeholder=${t.searchLabel} .value=${this.query} @input=${y=>this.query=y.target.value} /></label>
              ${s.rights.announce&&f?o`<wk-action-button icon="volume" data-wk-announce ?disabled=${!s.live} label=${t.announce} @click=${()=>s.announce("")}><span class="lbl">${t.announce}</span></wk-action-button>`:l}
              <wk-stations-maintenance .stations=${e} ?live=${s.live}></wk-stations-maintenance>
              <sw-view-switch data-wk-views label=${t.views.label} .value=${c} .options=${[{id:"cards",label:t.views.cards,icon:"grid"},{id:"list",label:t.views.list,icon:"list"},...this.table==="none"?[]:[{id:"table",label:t.views.table,icon:"table"}]]} @change=${y=>this.setView(y.detail)}></sw-view-switch>
            </div>`:l}
        <div class="layout ${i?"":"no-tree"}">
          ${i?o`<aside class="treecol"><sw-card flush><sw-place-tree data-wk-tree .rows=${a} .selected=${n} heading=${t.places.title} foldLabel=${t.places.fold} unfoldLabel=${t.places.unfold} @place-select=${y=>this.pickPlace(y.detail)} @place-toggle=${y=>this.toggleFloor(y.detail)}></sw-place-tree></sw-card></aside>`:l}
          <section class="main">
            ${e.length?o`<div class="chips" role="group" aria-label=${t.filters.label}>
                  ${i?o`<button type="button" class="chip places" data-wk-places-chip @click=${()=>this.sheet=!0}><sw-icon name="pin" size=${14}></sw-icon>${t.places.chip}: ${v}<sw-icon name="chevronDown" size=${12}></sw-icon></button>`:l}
                  ${Qs.map(y=>o`<button type="button" class="chip" data-wk-filter=${y} aria-pressed=${String(this.filter===y)} @click=${()=>this.filter=y}>
                      ${y==="in_call"?ue("phone",14):l}${y==="all"?t.filters.all:y==="online"?t.filters.online:y==="attention"?t.filters.attention:t.filters.inCall}
                    </button>`)}
                  ${O>1?o`<sw-pager class="pager" data-wk-pager .page=${q} .pages=${O} @page-change=${y=>this.cardPage=y.detail.page}></sw-pager>`:l}
                </div>`:l}
            ${h&&c==="cards"&&s.rights.call?o`<div class="strip" role="status" data-wk-strip>
                  <span class="dot" aria-hidden="true"></span><span>${h===1?t.strip.one:u(t.strip.many,{n:h})}</span><span class="sp"></span>
                  <wk-action-button tone="quiet" icon="list" data-wk-strip-list @click=${()=>this.setView("list")}>${t.strip.toList}</wk-action-button>
                </div>`:l}
            ${this.renderContent(s,e,r,c,Mt)}
          </section>
        </div>
      </div>
      ${this.renderSheet(a,n)} ${this.renderDrawer(s,e)} ${this.selected?l:this.renderDialogs(s,e)}
    </sw-page>`}renderContent(e,t,s,a,i=s){const n=e.text;return t.length?s.length?a==="table"?o`<sw-table class="tbl" dense data-wk-table .columns=${zi(e,t)} .rows=${s} .selected=${this.selected} @row-select=${r=>this.open(r.detail.id)}></sw-table>`:a==="list"?xi(e,s):_i(e,i):o`<sw-state-panel icon="door" compact state="empty" heading=${n.states.emptyFilter} data-wk-panel="empty-filter"></sw-state-panel>`:o`<sw-state-panel icon="door" state="empty" heading=${n.states.empty} data-wk-panel="empty"></sw-state-panel>`}renderSheet(e,t){const s=S();return e.length?o`<sw-drawer modal ?open=${this.sheet} heading=${s.places.sheet} data-wk-places-sheet @close=${a=>a.target===a.currentTarget&&(this.sheet=!1)}>
      <sw-place-tree .rows=${e} .selected=${t} heading=${s.places.title} foldLabel=${s.places.fold} unfoldLabel=${s.places.unfold} @place-select=${a=>this.pickPlace(a.detail)} @place-toggle=${a=>this.toggleFloor(a.detail)}></sw-place-tree>
    </sw-drawer>`:l}renderDrawer(e,t){const s=e.text,a=this.selected,i=a?t.find(r=>r.id===a):void 0,n=i?i.online?"live":"offline":"neutral";return o`<sw-drawer modal ?open=${!!a} heading=${i?.name??s.drawer.notFound} data-wk-drawer data-wk-drawer-station=${a??""} @close=${r=>r.target===r.currentTarget&&this.closeDrawer()}>
      ${a&&i?o`<sw-badge slot="action" kind=${n} label=${i.online?s.status.online:s.status.offline}></sw-badge>`:l}
      ${a?i?Pi(e,i):o`<sw-state-panel compact state="forbidden" heading=${s.drawer.notFoundHint} data-wk-panel="scoped"></sw-state-panel>`:l}
      ${a?this.renderDialogs(e,t):l}
    </sw-drawer>`}renderDialogs(e,t){return o`${this.renderConfirm(e,t)}
    <wk-announce-dialog
      ?open=${this.announceOpen}
      .stations=${t}
      .places=${this.places}
      .scope=${this.policy.announceScope}
      .phrases=${ea(this.policy,e.text)}
      .preselect=${this.announceFor}
      .tts=${this.actions.tts}
      @tts-status=${s=>this.actions.noteTts(s.detail)}
      @close=${s=>{s.target===s.currentTarget&&(this.announceOpen=!1)}}
    ></wk-announce-dialog>`}renderConfirm(e,t){const s=this.actions.confirm;if(!s)return l;const a=t.find(h=>h.id===s.stationId);if(!a)return l;const i=e.text,n=a.locks.find(h=>h.physical_index===s.lock)?.name?.trim(),r=ta(a.name),d=n?u(i.door.confirmNamed,{door:n,inPlace:r}):u(i.door.confirmPlain,{inPlace:r}),c=this.actions.releasing.has(`${a.id}/${s.lock}`);return o`<sw-dialog open ?locked=${c} heading=${i.door.confirmTitle} data-wk-release-dialog @close=${h=>h.target===h.currentTarget&&this.actions.cancelRelease()}>
      <p class="sentence" data-wk-release-sentence>${d}</p>
      <div slot="footer">
        <wk-action-button data-wk-release-cancel ?disabled=${c} @click=${()=>this.actions.cancelRelease()}>${i.door.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon="unlock" data-wk-release-confirm ?busy=${c} ?disabled=${c||!e.live} @click=${()=>void this.actions.confirmRelease()}>${c?i.door.sending:i.door.send}</wk-action-button>
      </div>
    </sw-dialog>`}};m.styles=Ia;k([p()],m.prototype,"feed",2);k([p()],m.prototype,"error",2);k([p()],m.prototype,"forbidden",2);k([p()],m.prototype,"filter",2);k([p()],m.prototype,"query",2);k([p()],m.prototype,"view",2);k([p()],m.prototype,"place",2);k([p()],m.prototype,"places",2);k([p()],m.prototype,"collapsed",2);k([p()],m.prototype,"selected",2);k([p()],m.prototype,"sheet",2);k([p()],m.prototype,"announceOpen",2);k([p()],m.prototype,"announceFor",2);k([p()],m.prototype,"policy",2);k([p()],m.prototype,"features",2);k([p()],m.prototype,"detail",2);k([p()],m.prototype,"detailOpen",2);k([p()],m.prototype,"now",2);k([p()],m.prototype,"poster",2);k([p()],m.prototype,"failed",2);k([p()],m.prototype,"table",2);k([p()],m.prototype,"mediaMode",2);k([p()],m.prototype,"media",2);k([p()],m.prototype,"cardPage",2);k([p()],m.prototype,"perPage",2);m=k([F("wiskey-stations")],m);export{m as WiskeyStations};
