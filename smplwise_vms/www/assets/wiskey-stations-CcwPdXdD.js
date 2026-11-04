import{E as j,F as g,G as h,a as N,bw as St,R as xe,A as l,e as o,H as M,b7 as Y,bx as tt,by as st,j as B,g as _e,l as T,bz as zt,bA as Ct,bB as Q,bC as ae,bD as fe,bE as at,bF as Tt,bG as Ot,bH as At,bI as Pt,bJ as Et,bK as Dt,bq as Lt,bL as Nt,bM as Mt,bN as Rt,bO as Ae,i as ee,bP as It,bQ as qt,bR as Ft,bS as Ht,bT as jt,bU as Wt,bV as nt,bW as it,bX as Pe,n as Bt,bY as Ut,bZ as Kt,b_ as Vt,b$ as Yt,av as Ee,J as Gt,c0 as Jt,c1 as Zt,c2 as Xt,c3 as Qt,be as De,c4 as Le,aA as es,r as ts}from"./index-BJ665FDN.js";import"./sw-table-BkX6TAOZ.js";import"./sw-place-tree-Zx1WZddn.js";import{a as ss,g as ot,b as rt,c as as,d as ns}from"./access-stations-DPb-BnbY.js";import{a as is,w as S,t as Ne,T as le,c as Me,f as p,b as lt,s as os,n as rs,l as ls,d as ds,e as cs,g as hs,h as us,A as ps,i as ws,U as ms,j as se,k as ge,m as G,p as we,o as ne,q as Se,r as ze,u as me,v as dt,x as K,y as ve,z as ct,B as fs,C as gs,D as vs,E as bs,F as ks,G as ys,H as ht,P as $s,I as Re,J as xs,K as _s,L as Ss,M as zs,N as Cs,O as Ts,Q as Os,R as As,S as Ps,V as Es,W as Ds,X as Ls,Y as Ns,Z as Ms,_ as Rs,$ as Is,a0 as qs,a1 as Fs,a2 as Hs}from"./access-parity-B4IT7BYY.js";import"./wk-deep-links-FWYwUrCZ.js";import{v as js}from"./wiskey-validation-DrixtKk4.js";import"./sw-logo-art-Va6y_cIM.js";import"./schedules-logic-u5AQJ0Sk.js";import"./wiskey-format-B1C9aa4N.js";import"./deep-links-BulfUhTh.js";var Ws=Object.defineProperty,Bs=Object.getOwnPropertyDescriptor,$=(e,t,s,a)=>{for(var n=a>1?void 0:a?Bs(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&Ws(t,s,n),n};const Us={he:"עברית",iw:"עברית",en:"English",ar:"العربية",ru:"Русский"},Ie=e=>Us[e.toLowerCase().split("-")[0]]??e.toUpperCase();let y=class extends N{constructor(){super(...arguments),this.open=!1,this.stations=[],this.places=null,this.scope="scope",this.phrases=[],this.preselect="",this.tts={},this.engines=null,this.enginesNote="",this.engine="",this.language="",this.message="",this.choice="",this.sending=!1,this.result=null,this.locked=!1,this.retryAt=0,this.more=!1,this.sent=[],this.loadedEngines=!1,this.timer=0}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("open")&&this.open&&this.reset()}updated(e){e.has("open")&&this.open&&!this.loadedEngines&&this.loadEngines()}reset(){this.message="",this.result=null,this.locked=!1,this.retryAt=0,this.sending=!1,this.more=!1,this.sent=[],this.choice=this.choices()[0]?.key??""}online(){return this.stations.filter(e=>e.online)}choices(){return is(this.online(),this.places,this.scope,this.preselect||void 0)}current(){const e=this.choices();return e.find(t=>t.key===this.choice)??e[0]}async loadEngines(){this.loadedEngines=!0,this.enginesNote="";try{const e=await St();e.tts&&e.tts.engines.length?(this.engines=e.tts,this.pickEngine(e.tts.default&&e.tts.engines.some(t=>t.engine_id===e.tts.default)?e.tts.default:e.tts.engines[0].engine_id)):e.tts?this.enginesNote=S().announceDlg.noEngine:this.enginesNote=e.state==="unsupported"?S().announceDlg.enginesUnsupported:S().announceDlg.noEngine}catch(e){this.enginesNote=xe(e),this.loadedEngines=!1}}pickEngine(e){this.engine=e;const t=this.engines?.engines.find(a=>a.engine_id===e),s=t?.supported_languages??[];this.language=s.includes("he")?"he":s.includes("iw")?"iw":t?.default_language??s[0]??""}busySeconds(){return Math.max(0,Math.ceil((this.retryAt-Date.now())/1e3))}startRetryClock(){window.clearInterval(this.timer),this.timer=window.setInterval(()=>{this.busySeconds()<=0?(window.clearInterval(this.timer),this.retryAt=0):this.requestUpdate()},1e3)}ready(){const e=Ne(this.message);return!!this.engine&&e>0&&e<=le&&!this.sending&&!this.locked&&this.busySeconds()===0&&!!this.current()?.stationIds.length}async send(){const e=this.current(),t=Me(this.message);if(!this.ready()||!e)return;const s=S().announceDlg,a=e.stationIds.filter(r=>this.online().some(c=>c.id===r));if(!a.length){this.result={tone:"warn",text:s.noTargets};return}this.sending=!0,this.result=null;let n=[];try{n=await ss({stationIds:a,engine_id:this.engine,language:this.language||null,message:t})}finally{this.sending=!1}for(const r of n)r.status&&this.dispatchEvent(new CustomEvent("tts-status",{detail:r.status,bubbles:!0,composed:!0}));this.sent=n.filter(r=>r.outcome==="sent").map(r=>r.station_id),this.result=this.summarize(n),n.some(r=>r.outcome==="unknown")&&(this.locked=!0);const i=n.filter(r=>r.code==="audio_busy").map(r=>r.retry_after_s??10);i.length&&!this.locked&&(this.retryAt=Date.now()+Math.min(...i)*1e3,this.startRetryClock())}summarize(e){const t=S().announceDlg,s=e.filter(i=>i.outcome==="sent"),a=e.filter(i=>i.outcome!=="sent"),n=i=>this.stations.find(r=>r.id===i)?.name??i;return a.length?e.some(i=>i.outcome==="unknown")?{tone:"warn",text:s.length?p(t.partial,{ok:s.length,bad:a.length,names:a.map(i=>n(i.station_id)).join(", ")})+" · "+t.unknown:t.unknown}:s.length?{tone:"warn",text:p(t.partial,{ok:s.length,bad:a.length,names:a.map(i=>n(i.station_id)).join(", ")})}:a.every(i=>i.code==="audio_busy")?{tone:"warn",text:t.busy}:{tone:"err",text:a[0].error??t.failed}:{tone:"ok",text:s.length===1?t.sentOne:p(t.sentMany,{n:s.length})}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}progress(){if(this.sent.length!==1)return"";const e=this.tts[this.sent[0]];return e?lt(e):""}renderResult(){if(!this.result)return l;const e=S().announceDlg,t=this.busySeconds(),s=this.progress()&&this.result.tone==="ok"?this.progress():this.result.text;return o`<div class="result ${this.result.tone}" role="status" data-wk-announce-result data-tone=${this.result.tone}>${s}${t>0?o` · ${p(e.busyIn,{n:t})}`:l}</div>`}render(){const e=S().announceDlg,t=this.choices(),s=this.current(),a=Ne(this.message),i=this.engines?.engines.find(d=>d.engine_id===this.engine)?.supported_languages??[],r=this.phrases.length?this.phrases:e.phraseList,c=this.result?.tone==="ok"&&this.sent.length>0;return o`<sw-dialog ?open=${this.open} wide ?locked=${this.sending} heading=${e.title} data-wk-announce-dialog @close=${()=>this.close()}>
      <div class="body">
        <div class="fld">
          <label>${e.to}</label>
          <div class="chips" role="group" aria-label=${e.to}>
            ${t.length?t.map(d=>o`<button type="button" class="chip" data-wk-target=${d.key} aria-pressed=${String(d.key===s?.key)} ?disabled=${this.sending} @click=${()=>this.choice=d.key}>
                    ${d.kind==="station"?o`<sw-icon name="door" size=${14}></sw-icon>`:d.kind==="place"?o`<sw-icon name="pin" size=${14}></sw-icon>`:l}<span>${d.label}</span>
                  </button>`):o`<span class="note" data-wk-announce-notargets>${e.noTargets}</span>`}
          </div>
        </div>
        <div class="fld">
          <label for="msg">${e.message}</label>
          <textarea id="msg" data-wk-announce-message rows="3" maxlength=${le*2} ?disabled=${this.sending||this.locked} .value=${this.message} @input=${d=>this.message=d.target.value}></textarea>
          <span class="cnt ${a>le?"over":""}" aria-live="polite">${p(e.counter,{n:a,max:le})}</span>
        </div>
        <div class="fld">
          <label>${e.phrases}</label>
          <div class="chips" role="group" aria-label=${e.phrases}>
            ${r.map(d=>o`<button type="button" class="chip" data-wk-phrase aria-pressed=${String(Me(this.message)===d)} ?disabled=${this.sending||this.locked} @click=${()=>this.message=d}><span>${d}</span></button>`)}
          </div>
        </div>
        <div class="prev" data-wk-announce-preview>
          <sw-icon name="volume" size=${15}></sw-icon>
          <span>${p(e.preview,{lang:Ie(this.language||"he"),voice:e.voiceDefault,n:os(this.message)})}</span>
          <span class="sp"></span>
          <wk-action-button tone="quiet" data-wk-announce-more aria-expanded=${String(this.more)} @click=${()=>this.more=!this.more}>${e.more}</wk-action-button>
        </div>
        ${this.more?o`<div class="engine" data-wk-announce-engine>
                ${this.engines?.engines.length?o`<sw-field label=${e.engine}>
                        <select data-wk-engine .value=${this.engine} @change=${d=>this.pickEngine(d.target.value)}>
                          ${this.engines.engines.map(d=>o`<option value=${d.engine_id} ?selected=${d.engine_id===this.engine}>${d.name}</option>`)}
                        </select>
                      </sw-field>
                      ${i.length?o`<sw-field label=${e.language}>
                            <select data-wk-language .value=${this.language} @change=${d=>this.language=d.target.value}>
                              ${i.map(d=>o`<option value=${d} ?selected=${d===this.language}>${Ie(d)}</option>`)}
                            </select>
                          </sw-field>`:l}`:o`<span class="note">${this.enginesNote||e.enginesLoading}</span>`}
                <span class="note" style="grid-column:1/-1">${e.external}</span>
              </div>`:!this.engines&&this.enginesNote?o`<div class="result warn" role="status" data-wk-announce-engines-state>${this.enginesNote}</div>`:l}
        ${this.renderResult()}
      </div>
      <div slot="footer">
        <wk-action-button tone="primary" icon="volume" data-wk-announce-send ?disabled=${!this.ready()} ?busy=${this.sending} @click=${()=>void this.send()}>${this.sending?e.sending:c?e.sendAgain:e.send}</wk-action-button>
        <wk-action-button data-wk-announce-close ?disabled=${this.sending} @click=${()=>this.close()}>${c?e.close:e.cancel}</wk-action-button>
      </div>
    </sw-dialog>`}};y.styles=j`
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
  `;$([g({type:Boolean,reflect:!0})],y.prototype,"open",2);$([g({attribute:!1})],y.prototype,"stations",2);$([g({attribute:!1})],y.prototype,"places",2);$([g()],y.prototype,"scope",2);$([g({attribute:!1})],y.prototype,"phrases",2);$([g()],y.prototype,"preselect",2);$([g({attribute:!1})],y.prototype,"tts",2);$([h()],y.prototype,"engines",2);$([h()],y.prototype,"enginesNote",2);$([h()],y.prototype,"engine",2);$([h()],y.prototype,"language",2);$([h()],y.prototype,"message",2);$([h()],y.prototype,"choice",2);$([h()],y.prototype,"sending",2);$([h()],y.prototype,"result",2);$([h()],y.prototype,"locked",2);$([h()],y.prototype,"retryAt",2);$([h()],y.prototype,"more",2);$([h()],y.prototype,"sent",2);y=$([M("wk-announce-dialog")],y);const ut=["sync","rescan","health_refresh","clock_refresh"],pt=e=>`access-control/stations/${encodeURIComponent(e)}/maintenance`,Ks=15e3,Vs=e=>_e(pt(e)),wt=(e,t)=>Y(`${pt(e)}/${t}`,{confirmed:!0,client_request_id:st(),expires_at:new Date(tt()+Ks).toISOString().replace(/\.\d{3}Z$/,"Z")});function Ys(e,t,s){if(e instanceof B){const a=e.body?.details??{},n=String(a.outcome??""),i=n==="refused"?"failed":n==="not_sent"?"not_sent":n==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",r=Number(a.retry_after_s);return{station_id:t,action:s,status:i,code:String(a.wiskey_code??e.code??"")||null,retry_after_s:Number.isFinite(r)&&r>=0?r:null,data:null}}return{station_id:t,action:s,status:"unknown",code:"network",retry_after_s:null,data:null}}async function mt(e,t,s=wt){try{const a=await s(e,t);return{station_id:e,action:t,status:a.status,code:null,retry_after_s:null,data:a.data??null}}catch(a){return Ys(a,e,t)}}async function Gs(e,t,s=()=>{},a=wt,n=250,i=r=>new Promise(c=>setTimeout(c,r))){const r=[];for(let c=0;c<e.length;c++){c>0&&n>0&&await i(n);const d=await mt(e[c],t,a);r.push(d),s(d,c)}return r}function qe(e,t,s){return e.filter(a=>t.has(a.id)&&(s==="sync"||a.online)).map(a=>a.id)}function be(e,t){return e?t.reasons[e]??e:""}function ke(e,t,s){const a=be(t,s)||s.none;return e==="failed"?p(s.status.failed,{reason:a}):e==="not_sent"?p(s.status.not_sent,{reason:a}):s.status[e]}function ye(e){return e==="acknowledged"||e==="completed"?"ok":e==="failed"?"err":e==="sending"||e==="sent"?"busy":"warn"}function Js(e){const t={ok:0,failed:0,not_sent:0,unknown:0};for(const s of e)s.status==="acknowledged"||s.status==="completed"?t.ok++:s.status==="failed"?t.failed++:s.status==="not_sent"?t.not_sent++:t.unknown++;return t}function Zs(e){const t=e?.auth_seen??null,s=e?.report?.auth?.last_failure??null;return t?s&&String(s.at??"")>=String(t.at??"")?s:t:s}function Xs(e,t){const s=[],a=e?.report?.auth,n=e?.technical?.event_status?.stream;return(a?.sync_now||e?.technical?.last_error==="authentication_failed")&&s.push(t.authSources.sync),(a?.event_stream_now||n==="authentication_failed")&&s.push(t.authSources.event_stream),a?.event_history_now&&s.push(t.authSources.event_history),s}function Qs(e,t){return e?t.steps[e]??t.steps.other:""}const ea={title:"תחזוקה",listButton:"תחזוקה",listTitle:"תחזוקת עמדות",refresh:"רענון נתונים",loading:"טוען את מצב העמדה…",unavailable:"מצב העמדה אינו זמין כרגע.",healthHidden:"פרטי הבריאות של העמדה מוצגים רק למי שמורשה לצפות במצב המערכת.",actions:{sync:"סנכרן עכשיו",rescan:"סריקה מחדש",health_refresh:"רענון בריאות",clock_refresh:"בדיקת שעון"},confirm:{sync:{title:"לסנכרן את העמדה עכשיו?",one:"אנשים, כרטיסים והרשאות שממתינים יישלחו לעמדה {name}. הסנכרון נכנס לתור ומתבצע ברקע."},rescan:{title:"לסרוק את העמדה מחדש?",one:"היכולות ורשימת המשתמשים יקראו מחדש מהעמדה {name}. שום דבר לא נכתב לעמדה."},health_refresh:{title:"לרענן את בריאות העמדה?",one:"השעון ונתוני המדיה של העמדה {name} ייקראו מחדש מהמכשיר (עד חצי דקה)."},clock_refresh:{title:"לבדוק את שעון העמדה?",one:"השעון של העמדה {name} ייקרא מחדש. השעה בעמדה לא משתנה."},many:"הפעולה תישלח פעם אחת לכל עמדה מתוך {n} העמדות שנבחרו, אחת אחרי השנייה.",send:"שלח",cancel:"ביטול"},rows:{lastSync:"סנכרון אחרון",lastScan:"קריאה אחרונה מהעמדה",stream:"זרם אירועים",clock:"שעון",lastError:"שגיאה אחרונה",auth:"כשל הזדהות",polls:"כשלי תקשורת רצופים"},stream:{connected:"מחובר",connecting:"מתחבר",disconnected:"מנותק",authentication_failed:"נכשל בהזדהות",unavailable:"לא זמין",stopped:"עצור",unknown:"לא ידוע"},clockOk:"תקין",clockSkew:"סטייה של {n} שניות",clockStatus:{ready:"נמדד",stale:"מדידה ישנה",unavailable:"לא נמדד"},never:"אין עדיין",none:"אין",authNone:"לא נראה מאז שהמערכת עלתה",authLine:"{source} · שלב: {step} · {at}",authObserved:"{source} · נראה ב־{at}",authCount:"{n} כשלים ברשומות האחרונות",authNow:"כרגע: {what}",authCode:"קוד מהמכשיר {code}",authSources:{sync:"סנכרון",event_stream:"זרם האירועים",event_history:"השלמת היסטוריית אירועים",station_sync:"סנכרון העמדה"},steps:{queued:"בתור",identity:"זיהוי העמדה",capabilities:"קריאת יכולות",inventory:"קריאת משתמשים מהעמדה",person_read:"קריאת אדם",reconcile:"התאמה",journal:"רישום",create_person:"הוספת אדם",update_person:"עדכון אדם",delete_person:"מחיקת אדם",create_card:"הוספת כרטיס",update_card:"עדכון כרטיס",delete_card:"מחיקת כרטיס",readback:"אימות",complete:"סיום",other:"שלב אחר"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"התקבל - הסנכרון בתור",completed:"הושלם",failed:"נכשל: {reason}",not_sent:"לא נשלח: {reason}",unknown:"נשלח, אין תשובה ברורה - ייתכן שבוצע"},lastRun:"פעם אחרונה: {status} · {at}",cooldown:"אפשר שוב בעוד {n} שניות",offlineHint:"העמדה לא מחוברת - אפשר רק לבקש סנכרון.",reasons:{authentication_failed:"העמדה דחתה את פרטי ההתחברות",connection_failed:"אין חיבור לעמדה",device_busy:"העמדה עסוקה",device_unavailable:"העמדה לא זמינה",station_offline:"העמדה לא מחוברת",intercom_station_offline:"העמדה לא מחוברת",station_unloaded:"העמדה לא טעונה במערכת האינטרקום",station_not_found:"העמדה לא נמצאה",intercom_station_not_found:"העמדה לא נמצאה",manager_closed:"מערכת האינטרקום בעצירה",unauthorized:"מערכת האינטרקום לא אישרה את הפעולה",forbidden:"אין הרשאה לתחזוקת העמדה",confirmation_required:"חסר אישור",expired:"הבקשה פגה לפני שנשלחה",intercom_duplicate_command:"הפקודה כבר נשלחה",station_ops_cooldown:"נשלח לפני רגע",station_ops_rate_limited:"יותר מדי פקודות בזמן קצר",station_ops_busy:"פקודות אחרות עדיין רצות",intercom_busy:"מערכת האינטרקום עסוקה",intercom_rate_limited:"הגבלת קצב",rate_limited:"הגבלת קצב",busy:"מערכת האינטרקום עסוקה",intercom_unavailable:"מערכת האינטרקום לא זמינה",timeout:"לא התקבלה תשובה בזמן",clock_read_failed:"קריאת השעון נכשלה",operation_unsupported:"העמדה לא תומכת בפעולה",capacity_exhausted:"העמדה מלאה",network:"אין חיבור לשרת"},bulk:{pickAction:"פעולה",pickStations:"עמדות",all:"בחר הכל",clear:"נקה",selected:"{n} נבחרו",offline:"לא מחוברת",next:"המשך",back:"חזרה",close:"סגור",running:"שולח {i} מתוך {n}…",summary:"{ok} הצליחו · {failed} נכשלו · {not_sent} לא נשלחו · {unknown} ללא תשובה",noneSelected:"בחרו לפחות עמדה אחת.",offlineSkipped:"עמדות לא מחוברות לא ייכללו בפעולה הזו."}},ta={title:"Maintenance",listButton:"Maintenance",listTitle:"Station maintenance",refresh:"Refresh data",loading:"Loading the station state…",unavailable:"The station state is not available right now.",healthHidden:"The station's health details are shown only to who may view the system status.",actions:{sync:"Sync now",rescan:"Rescan",health_refresh:"Refresh health",clock_refresh:"Check clock"},confirm:{sync:{title:"Sync the station now?",one:"Pending people, cards and permissions are sent to {name}. The sync is queued and runs in the background."},rescan:{title:"Rescan the station?",one:"Capabilities and the user list are read again from {name}. Nothing is written to the station."},health_refresh:{title:"Refresh the station's health?",one:"{name}'s clock and media details are read again from the device (up to half a minute)."},clock_refresh:{title:"Check the station's clock?",one:"{name}'s clock is read again. The station's time is not changed."},many:"The action is sent once to each of the {n} selected stations, one after the other.",send:"Send",cancel:"Cancel"},rows:{lastSync:"Last sync",lastScan:"Last read from the station",stream:"Event stream",clock:"Clock",lastError:"Last error",auth:"Sign-in failure",polls:"Failed polls in a row"},stream:{connected:"Connected",connecting:"Connecting",disconnected:"Disconnected",authentication_failed:"Sign-in failed",unavailable:"Unavailable",stopped:"Stopped",unknown:"Unknown"},clockOk:"OK",clockSkew:"{n} s off",clockStatus:{ready:"Measured",stale:"Old measurement",unavailable:"Not measured"},never:"None yet",none:"None",authNone:"Not seen since the system started",authLine:"{source} · step: {step} · {at}",authObserved:"{source} · seen at {at}",authCount:"{n} failures in the recent records",authNow:"Now: {what}",authCode:"device code {code}",authSources:{sync:"Sync",event_stream:"Event stream",event_history:"Event history",station_sync:"Station sync"},steps:{queued:"Queued",identity:"Station identity",capabilities:"Capabilities",inventory:"Reading users",person_read:"Reading a person",reconcile:"Reconcile",journal:"Journal",create_person:"Adding a person",update_person:"Updating a person",delete_person:"Removing a person",create_card:"Adding a card",update_card:"Updating a card",delete_card:"Removing a card",readback:"Verification",complete:"Complete",other:"Other step"},status:{sending:"Sending…",sent:"Sent, waiting for the answer",acknowledged:"Accepted - the sync is queued",completed:"Done",failed:"Failed: {reason}",not_sent:"Not sent: {reason}",unknown:"Sent, no clear answer - it may have run"},lastRun:"Last time: {status} · {at}",cooldown:"Again in {n} s",offlineHint:"The station is offline - only a sync can be requested.",reasons:{authentication_failed:"the station refused the sign-in",connection_failed:"no connection to the station",device_busy:"the station is busy",device_unavailable:"the station is unavailable",station_offline:"the station is offline",intercom_station_offline:"the station is offline",station_unloaded:"the station is not loaded",station_not_found:"station not found",intercom_station_not_found:"station not found",manager_closed:"the intercom system is stopping",unauthorized:"the intercom system refused the action",forbidden:"no permission to maintain this station",confirmation_required:"not confirmed",expired:"the request expired before it was sent",intercom_duplicate_command:"already sent",station_ops_cooldown:"sent a moment ago",station_ops_rate_limited:"too many commands in a short time",station_ops_busy:"other commands are still running",intercom_busy:"the intercom system is busy",intercom_rate_limited:"rate limited",rate_limited:"rate limited",busy:"the intercom system is busy",intercom_unavailable:"the intercom system is unavailable",timeout:"no answer in time",clock_read_failed:"reading the clock failed",operation_unsupported:"the station does not support this",capacity_exhausted:"the station is full",network:"no connection to the server"},bulk:{pickAction:"Action",pickStations:"Stations",all:"Select all",clear:"Clear",selected:"{n} selected",offline:"offline",next:"Continue",back:"Back",close:"Close",running:"Sending {i} of {n}…",summary:"{ok} done · {failed} failed · {not_sent} not sent · {unknown} no answer",noneSelected:"Select at least one station.",offlineSkipped:"Offline stations are left out of this action."}};function F(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?ta:ea}var sa=Object.defineProperty,aa=Object.getOwnPropertyDescriptor,D=(e,t,s,a)=>{for(var n=a>1?void 0:a?aa(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&sa(t,s,n),n};let O=class extends N{constructor(){super(...arguments),this.stations=[],this.live=!0,this.open=!1,this.step="pick",this.action="sync",this.chosen=new Set,this.outcomes={},this.index=0,this.busy=!1,this.targets=[]}allowed(){return T("access.stations.manage")&&this.stations.length>0}openDialog(){this.open=!0,this.step="pick",this.outcomes={},this.index=0,this.chosen=new Set(this.stations.map(e=>e.id))}close(){this.busy||(this.open=!1)}toggle(e){const t=new Set(this.chosen);t.has(e)?t.delete(e):t.add(e),this.chosen=t}async send(){this.busy||(this.targets=qe(this.stations,this.chosen,this.action),this.targets.length&&(this.step="run",this.busy=!0,this.outcomes=Object.fromEntries(this.targets.map(e=>[e,{station_id:e,action:this.action,status:"sending",code:null,retry_after_s:null,data:null}])),await Gs(this.targets,this.action,(e,t)=>{this.outcomes={...this.outcomes,[e.station_id]:e},this.index=t+1}),this.busy=!1,this.dispatchEvent(new CustomEvent("stations-op",{detail:Object.values(this.outcomes),bubbles:!0,composed:!0}))))}willUpdate(){this.hidden=!this.allowed()}render(){if(!this.allowed())return l;const e=F();return o`<wk-action-button icon="wrench" data-wk-maint-list ?disabled=${!this.live} label=${e.listButton} @click=${()=>this.openDialog()}><span class="lbl">${e.listButton}</span></wk-action-button>
      ${this.open?this.renderDialog():l}`}renderDialog(){const e=F(),t=qe(this.stations,this.chosen,this.action),s=this.action!=="sync"&&this.stations.some(a=>this.chosen.has(a.id)&&!a.online);return o`<sw-dialog open ?locked=${this.busy} heading=${this.step==="confirm"?e.confirm[this.action].title:e.listTitle} data-wk-maint-dialog data-step=${this.step}
      @close=${a=>a.target===a.currentTarget&&this.close()}>
      <div class="body">
        ${this.step==="pick"?this.renderPick(s):this.step==="confirm"?o`<p class="sentence" data-wk-maint-many>${e.actions[this.action]} · ${p(e.confirm.many,{n:t.length})}</p>${s?o`<div class="note">${e.bulk.offlineSkipped}</div>`:l}`:this.renderRun()}
      </div>
      <div slot="footer">
        ${this.step==="pick"?o`<wk-action-button data-wk-maint-dialog-cancel @click=${()=>this.close()}>${e.confirm.cancel}</wk-action-button>
              <wk-action-button tone="primary" data-wk-maint-next ?disabled=${!t.length} @click=${()=>this.step="confirm"}>${e.bulk.next}</wk-action-button>`:this.step==="confirm"?o`<wk-action-button data-wk-maint-back @click=${()=>this.step="pick"}>${e.bulk.back}</wk-action-button>
                <wk-action-button tone="primary" icon="wrench" data-wk-maint-send-many ?disabled=${!this.live||!t.length} @click=${()=>void this.send()}>${e.confirm.send}</wk-action-button>`:o`<wk-action-button data-wk-maint-done ?disabled=${this.busy} @click=${()=>this.close()}>${e.bulk.close}</wk-action-button>`}
      </div>
    </sw-dialog>`}renderPick(e){const t=F();return o`<div class="lab">${t.bulk.pickAction}</div>
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
        ${this.stations.map(s=>{const a=!s.online&&this.action!=="sync";return o`<div class="row" aria-disabled=${String(a)} data-wk-maint-station=${s.id}>
            <label><input type="checkbox" .checked=${this.chosen.has(s.id)} ?disabled=${a} @change=${()=>this.toggle(s.id)} /><span class="nm">${s.name}</span></label>
            ${s.online?l:o`<span class="st">${t.bulk.offline}</span>`}
          </div>`})}
      </div>
      ${this.chosen.size?e?o`<div class="note">${t.bulk.offlineSkipped}</div>`:l:o`<div class="note" role="status">${t.bulk.noneSelected}</div>`}`}renderRun(){const e=F(),t=new Map(this.stations.map(i=>[i.id,i.name])),s=this.targets.map(i=>this.outcomes[i]).filter(Boolean),a=s.filter(i=>i.status!=="sending"),n=Js(a);return o`<div class="summary" role="status" data-wk-maint-progress>
        ${this.busy?p(e.bulk.running,{i:Math.min(this.index+1,this.targets.length),n:this.targets.length}):p(e.bulk.summary,{...n})}
      </div>
      <div class="list" data-wk-maint-results>
        ${s.map(i=>o`<div class="row" data-wk-maint-row=${i.station_id} data-status=${i.status}>
            <span class="nm">${t.get(i.station_id)??i.station_id}</span>
            <span class="st" data-tone=${ye(i.status)}>${ke(i.status,i.code,e)}</span>
          </div>`)}
      </div>`}};O.styles=j`
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
  `;D([g({attribute:!1})],O.prototype,"stations",2);D([g({type:Boolean})],O.prototype,"live",2);D([h()],O.prototype,"open",2);D([h()],O.prototype,"step",2);D([h()],O.prototype,"action",2);D([h()],O.prototype,"chosen",2);D([h()],O.prototype,"outcomes",2);D([h()],O.prototype,"index",2);D([h()],O.prototype,"busy",2);D([h()],O.prototype,"targets",2);O=D([M("wk-stations-maintenance")],O);var na=Object.defineProperty,ia=Object.getOwnPropertyDescriptor,R=(e,t,s,a)=>{for(var n=a>1?void 0:a?ia(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&na(t,s,n),n};let P=class extends N{constructor(){super(...arguments),this.stationId="",this.talk=null,this.live=!0,this.dial=!1,this.idleLabel="",this.deps=null,this.tick=0,this.mic="unknown",this.session=null,this.timer=0,this.activate=()=>{const e=this.ensure();e.phase==="idle"?e.start():(e.phase==="open"||e.phase==="talking")&&e.toggleMute()}}connectedCallback(){super.connectedCallback(),zt().then(e=>this.mic=e)}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,window.clearInterval(this.timer)}updated(e){e.has("stationId")&&e.get("stationId")!==void 0&&(this.session?.dispose(),this.session=null)}ensure(){if(this.session&&this.session.stationId===this.stationId)return this.session;const e=this.talk,t=Math.max(80,Math.round((e?.sample_rate??8e3)*(e?.frame_ms??20)/1e3)),s={start:(a,n)=>Et(a,n),stop:a=>Pt(a),socket:a=>new WebSocket(At(a)),mic:(a,n,i)=>Ot(a,n,i),requestId:()=>Tt(),now:()=>Date.now(),after:(a,n)=>window.setTimeout(a,n),cancel:a=>window.clearTimeout(a),changed:()=>this.onChange(),floor:a=>this.dispatchEvent(new CustomEvent("talk-floor",{detail:{held:a,stationId:this.stationId},bubbles:!0,composed:!0}))};return this.session=new Ct(this.stationId,e?.codec==="pcma"?"pcma":"pcmu",t,{...s,...this.deps??{}}),this.session}onChange(){this.tick+=1;const e=this.session;window.clearInterval(this.timer),e&&(e.phase==="open"||e.phase==="talking")&&(this.timer=window.setInterval(()=>this.tick+=1,1e3)),this.dispatchEvent(new CustomEvent("talk-state",{detail:{phase:e?.phase??"idle",problem:e?.problem??null,outcome:e?.outcome??null},bubbles:!0,composed:!0}))}blocked(){return this.mic==="insecure"?"insecure":this.mic==="denied"?"denied":null}end(){this.session?.end()}render(){const e=Q(),t=e.talk,s=this.session,a=s?.phase??"idle",n=!!this.talk?.busy&&a==="idle",i=this.blocked(),r=!this.live||a==="idle"&&(n||!!i),c=s?.secondsLeft()??null,d=s?.secondsOpen()??null;this.tick;const u=a==="open"||a==="talking",m=this.idleLabel||(this.dial?e.dial.dial:t.start),w=a==="talking"?t.talking:a==="starting"?t.starting:a==="open"?t.muted:m,v=a==="talking"?t.mute:a==="open"?t.unmute:m,f=a==="idle"&&this.dial?ae("phone",18):null,z=s?.problem??(a==="idle"?i:null),q=z?{tone:z==="busy"||z==="expired"?"warn":"error",text:t.problems[z]}:n?{tone:"warn",text:t.busy}:a==="idle"&&s?.outcome?{tone:"",text:t.ended}:u&&s?.echoCancelled===!1?{tone:"warn",text:t.headset}:null;return o`<button
        type="button"
        class="ptt"
        data-wk-ptt
        data-phase=${a}
        data-muted=${u?String(a==="open"):l}
        aria-pressed=${u?String(a==="open"):l}
        aria-label=${v}
        ?disabled=${r}
        @click=${this.activate}
      >
        ${a==="talking"?o`<i class="dot" aria-hidden="true"></i>`:f??o`<sw-icon name=${a==="open"?"micOff":"mic"} size=${18}></sw-icon>`}<span>${w}</span>
      </button>
      ${q||a==="open"||a==="talking"?o`<div class="row">
            <span class="line" role="status" aria-live="polite" data-wk-talk-line data-tone=${q?.tone??""} data-problem=${z??""}
              >${q?q.text:o`${d!==null?o`<span class="elapsed" data-wk-talk-elapsed>${e.dial.inCall} <bdi>${fe(d)}</bdi></span> · `:l}${c!==null?o`<span class="left" data-wk-talk-left>${at(t.left,{t:fe(c)})}</span>`:l}`}</span
            >
            ${a==="open"||a==="talking"?o`<wk-action-button tone="danger" icon="hangup" data-wk-talk-end @click=${()=>this.end()}>${this.dial?e.dial.hangUp:t.end}</wk-action-button>`:l}
          </div>`:l}`}};P.styles=j`
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
    .ptt svg {
      flex: none;
    }
    .elapsed {
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .elapsed bdi,
    .left {
      direction: ltr;
      unicode-bidi: isolate;
      font-variant-numeric: tabular-nums;
    }
  `;R([g()],P.prototype,"stationId",2);R([g({attribute:!1})],P.prototype,"talk",2);R([g({type:Boolean})],P.prototype,"live",2);R([g({type:Boolean})],P.prototype,"dial",2);R([g()],P.prototype,"idleLabel",2);R([g({attribute:!1})],P.prototype,"deps",2);R([h()],P.prototype,"tick",2);R([h()],P.prototype,"mic",2);P=R([M("wk-talk-button")],P);function oa(e){const t=~e&255,s=t&128,a=t>>4&7,i=((t&15)<<3)+132<<a;return s?132-i:i-132}function ra(e){const t=e^85,s=(t&112)>>4;let a=(t&15)<<4;return s===0?a+=8:s===1?a+=264:a=a+264<<s-1,(t&128)!==0?a:-a}function la(e,t="pcmu"){const s=new Float32Array(e.length),a=t==="pcma"?ra:oa;for(let n=0;n<e.length;n+=1)s[n]=a(e[n]&255)/32768;return s}function da(e){if(!e.length)return 0;let t=0;for(let s=0;s<e.length;s+=1)t+=e[s]*e[s];return Math.min(1,Math.sqrt(t/e.length)*4)}function ca(e,t){if(t<=0)return e;const s=e*.5**(t/150);return s<.01?0:s}const Fe={intercom_listen_busy:"busy",intercom_listen_user_busy:"user_busy",intercom_listen_unsupported:"unsupported",intercom_listen_no_listen:"no_listen",intercom_listen_off:"off",intercom_station_offline:"offline",intercom_listen_unavailable:"unavailable",intercom_unavailable:"unavailable",intercom_station_not_found:"unavailable",forbidden:"forbidden"};function ha(e){if(e instanceof B){if(Fe[e.code])return Fe[e.code];if(e.status===403)return"forbidden";if(e.status===0)return"network"}return e instanceof TypeError?"network":"failed"}function ua(e){switch(e){case"ended":case"stopped":return null;case"expired":return"expired";case"access_lost":return"access_lost";case"upstream_closed":case"upstream_unavailable":return"upstream";case"network":return"network";default:return"failed"}}class pa{constructor(t,s){this.stationId=t,this.deps=s,this.phase="idle",this.problem=null,this.outcome=null,this.muted=!1,this.endsAt=0,this.starts=0,this.frames=0,this.level=0,this.levelAt=0,this.gen=0,this.reply=null,this.ws=null,this.sink=null,this.codec="pcmu",this.rate=8e3}secondsLeft(){return this.phase==="listening"?Math.max(0,Math.ceil((this.endsAt-this.deps.now())/1e3)):null}levelNow(){return this.phase==="listening"?ca(this.level,this.deps.now()-this.levelAt):0}async start(){if(this.phase!=="idle")return;this.problem=null;const t=this.deps.sink();if(!t){this.problem="no_audio",this.deps.changed();return}this.sink=t,t.setMuted(this.muted),this.phase="starting";const s=++this.gen;this.deps.changed();let a;try{this.starts+=1,a=await this.deps.start(this.stationId,this.deps.requestId())}catch(i){s===this.gen&&this.fail(ha(i));return}if(s!==this.gen){this.deps.stop(a.session).catch(()=>{});return}this.reply=a,this.codec=a.codec,this.rate=a.sample_rate,this.endsAt=this.deps.now()+a.max_seconds*1e3;let n;try{n=this.deps.socket(a.ws_path)}catch{this.deps.stop(a.session).catch(()=>{}),this.fail("network");return}n.binaryType="arraybuffer",this.ws=n,n.onmessage=i=>{if(s!==this.gen)return;if(typeof i.data!="string"){this.phase==="listening"&&this.onFrame(i.data);return}let r;try{r=JSON.parse(i.data)}catch{return}r.type==="listen/state"&&r.value==="open"&&this.phase==="starting"?(this.phase="listening",this.levelAt=this.deps.now(),this.deps.changed()):r.type==="listen/closed"&&this.finish(String(r.value??"ended"))},n.onclose=i=>{s===this.gen&&this.finish(Dt(i.code))},n.onerror=()=>{}}setMuted(t){this.muted=t,this.sink?.setMuted(t),this.deps.changed()}stop(){if(this.phase==="idle")return;const t=this.ws,s=this.reply;t&&t.readyState===1?t.send(JSON.stringify({type:"listen/stop"})):s&&this.deps.stop(s.session).catch(()=>{}),this.finish("ended")}dispose(){this.stop()}onFrame(t){const s=la(new Uint8Array(t),this.codec);this.frames+=1,this.level=da(s),this.levelAt=this.deps.now(),this.sink?.play(s,this.rate)}teardown(){this.gen+=1;const t=this.ws;if(this.ws=null,t){t.onmessage=null,t.onclose=null,t.onerror=null;try{t.close()}catch{}}this.sink?.close(),this.sink=null,this.reply=null,this.endsAt=0,this.level=0}fail(t){this.teardown(),this.phase="idle",this.problem=t,this.outcome=null,this.deps.changed()}finish(t){this.teardown(),this.phase="idle",this.outcome=t,this.problem=ua(t),this.deps.changed()}}const wa=.06,ma=.3;function fa(e,t){const s=Math.max(t,e+wa);return s-e>ma?null:s}function ga(){const e=globalThis.AudioContext??globalThis.webkitAudioContext;if(!e)return null;let t;try{t=new e}catch{return null}t.resume().catch(()=>{});const s=t.createGain();s.connect(t.destination);let a=0;return{play(n,i){const r=fa(t.currentTime,a);if(r===null)return;const c=t.createBuffer(1,n.length,i);c.copyToChannel(n,0);const d=t.createBufferSource();d.buffer=c,d.connect(s),d.start(r),a=r+c.duration},setMuted(n){s.gain.value=n?0:1},close(){t.close().catch(()=>{})}}}var va=Object.defineProperty,ba=Object.getOwnPropertyDescriptor,J=(e,t,s,a)=>{for(var n=a>1?void 0:a?ba(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&va(t,s,n),n};let H=class extends N{constructor(){super(...arguments),this.stationId="",this.live=!0,this.deps=null,this.capability=null,this.tick=0,this.session=null,this.timer=0,this.loadedFor=""}realDeps(){const e=this.deps??{};return{start:e.start??((t,s)=>cs(t,s)),stop:e.stop??(t=>ds(t)),socket:e.socket??(t=>new WebSocket(ls(t))),sink:e.sink??(()=>ga()),requestId:e.requestId??(()=>rs()),now:e.now??(()=>Date.now()),changed:()=>{this.tick+=1,this.syncTimer()}}}ensureSession(){return(!this.session||this.session.stationId!==this.stationId)&&(this.session?.dispose(),this.session=new pa(this.stationId,this.realDeps())),this.session}syncTimer(){const e=this.session?.phase==="listening";e&&!this.timer?this.timer=window.setInterval(()=>this.tick+=1,150):!e&&this.timer&&(window.clearInterval(this.timer),this.timer=0)}willUpdate(e){(e.has("stationId")||e.has("live"))&&this.stationId&&this.live&&!this.deps?.start&&this.loadedFor!==this.stationId&&!this.capability&&(this.loadedFor=this.stationId,hs(this.stationId).then(t=>{this.loadedFor===this.stationId&&(this.capability=t)}).catch(()=>{}))}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,this.timer&&window.clearInterval(this.timer),this.timer=0}get offered(){const e=this.session,t=e!==null&&e.phase!=="idle";return this.live&&(t||!!e?.problem||!!this.capability?.available)}updated(e){super.updated(e),this.toggleAttribute("hidden",!this.offered)}toggle(){const e=this.ensureSession();e.phase==="idle"?e.start():e.stop()}render(){const e=this.session;if(!this.offered)return l;const t=us(),s=e?.phase??"idle",a=e?.secondsLeft(),n=Math.round((e?.levelNow()??0)*100),i=s==="starting"?t.starting:s==="listening"?`${t.listening}${a!=null?` · ${at(t.left,{t:fe(a)})}`:""}`:"";return o`
      <div class="row" data-wk-listen>
        <button class="main" type="button" data-wk-listen-toggle aria-pressed=${String(s!=="idle")} @click=${()=>this.toggle()}>
          <sw-icon name=${s==="idle"?"volume":"hangup"} size=${18}></sw-icon>
          ${s==="idle"?t.start:t.stop}
        </button>
        ${s==="listening"?o`<button type="button" data-wk-listen-mute aria-pressed=${String(e.muted)} aria-label=${e.muted?t.unmute:t.mute} @click=${()=>e.setMuted(!e.muted)}>
              ${e.muted?t.unmute:t.mute}
            </button>`:l}
      </div>
      ${s==="listening"?o`<div class="meter ${e.muted?"muted":""}" role="meter" aria-label=${t.level} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${n} data-wk-listen-level>
            <i style=${`inline-size:${n}%`}></i>
          </div>`:l}
      ${i?o`<div class="msg" data-wk-listen-state>${i}${e?.muted?` · ${t.muted}`:""}</div>`:l}
      ${s==="idle"&&e?.problem?o`<div class="msg problem" data-wk-listen-problem role="status">${t.problems[e.problem]}</div>`:l}
      ${s==="idle"&&!e?.problem&&e?.outcome?o`<div class="msg" data-wk-listen-ended>${t.ended}</div>`:l}
    `}};H.styles=j`
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
  `;J([g()],H.prototype,"stationId",2);J([g({type:Boolean})],H.prototype,"live",2);J([g({attribute:!1})],H.prototype,"deps",2);J([g({attribute:!1})],H.prototype,"capability",2);J([h()],H.prototype,"tick",2);H=J([M("wk-listen-button")],H);var ka=Object.defineProperty,ya=Object.getOwnPropertyDescriptor,L=(e,t,s,a)=>{for(var n=a>1?void 0:a?ya(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&ka(t,s,n),n};let A=class extends N{constructor(){super(...arguments),this.stationId="",this.stationName="",this.media=null,this.poster="",this.live=!0,this.classicHref="",this.classicLabel="",this.talkHere=!0,this.profile=null,this.mutedBefore=null,this.onOuterFloor=e=>{if(this.talkHere)return;e.detail?.stationId===this.stationId&&this.onFloor(e)},this.onFloor=e=>{const t=e.detail.held,s=this.player;!s||this.media?.talk?.duplex==="full"||(t?(this.mutedBefore=s.muted,s.muted=!0):this.mutedBefore!==null&&(s.muted=this.mutedBefore,this.mutedBefore=null))}}connectedCallback(){super.connectedCallback(),window.addEventListener("talk-floor",this.onOuterFloor)}disconnectedCallback(){window.removeEventListener("talk-floor",this.onOuterFloor),super.disconnectedCallback()}willUpdate(e){if(e.has("media")||e.has("stationId")){const t=this.media?.video?.profiles.map(s=>s.id)??[];(!this.profile||!t.includes(this.profile)||e.has("stationId"))&&(this.profile=Nt(this.media?.video??null))}}render(){const e=this.media,t=e?.video,s=Q(),a=t?.profiles.find(r=>r.id===this.profile),n=a?t?.paths[a.id]:void 0,i=e?.talk;return o`
      ${n?o`<div class="frame" data-wk-live-frame data-profile=${a.id}>
            <sw-live-player .livePath=${n} .profile=${a.id} .mode=${Mt(a)} .poster=${this.poster} data-wk-live-player aria-label=${`${s.live.label} · ${this.stationName}`}></sw-live-player>
          </div>`:this.poster?o`<div class="frame" data-wk-live-frame data-profile=""><img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" /></div>`:l}
      ${t&&t.profiles.length>1&&n?o`<div class="bar">
            <span class="lbl" id="q">${s.live.quality}</span>
            <div class="seg" role="group" aria-labelledby="q" data-wk-quality>
              ${t.profiles.map(r=>o`<button type="button" data-profile=${r.id} aria-pressed=${String(r.id===this.profile)} @click=${()=>this.profile=r.id}>${r.id==="main"?s.live.main:s.live.sub}</button>`)}
            </div>
          </div>`:l}
      ${this.talkHere?i?.available?o`<wk-talk-button .stationId=${this.stationId} .talk=${i} .live=${this.live} data-wk-talk="native" @talk-floor=${this.onFloor}></wk-talk-button>`:this.classicHref?o`<wk-action-button tone="dashed" icon="window" block size="lg" href=${this.classicHref} data-wk-talk="classic">${this.classicLabel}</wk-action-button>`:l:l}
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
  `;L([g()],A.prototype,"stationId",2);L([g()],A.prototype,"stationName",2);L([g({attribute:!1})],A.prototype,"media",2);L([g()],A.prototype,"poster",2);L([g({type:Boolean})],A.prototype,"live",2);L([g()],A.prototype,"classicHref",2);L([g()],A.prototype,"classicLabel",2);L([g({type:Boolean})],A.prototype,"talkHere",2);L([h()],A.prototype,"profile",2);L([Lt("sw-live-player")],A.prototype,"player",2);A=L([M("wk-station-live")],A);const $a=45e3,xa=12e4;function _a(e){const t=e instanceof B?Number(e.body?.details?.retry_after_s):NaN;return Number.isFinite(t)&&t>=0?Math.ceil(t*1e3):ms}function He(e,t=S()){return Rt(e)!=="unknown"?{tone:"err",text:xe(e),unknown:!1}:{tone:"warn",text:t.call.unknown,unknown:!0}}function Sa(e,t=S()){const s={answer:t.call.answer,reject:t.call.reject,hangUp:t.call.hangUp},a=p(t.call.sent,{label:s[e.command]??e.command,ack:e.acknowledged===!0?t.call.ack:t.call.noAck});if(e.observation==="unavailable"||!e.observed_state)return`${a} · ${t.call.stateUnread}`;const n=se(e.observed_state,t);return`${a} · ${p(e.observation==="unchanged"?t.call.stateUnchanged:t.call.state,{state:n})}`}const za=["started","generating","speaking","completed","closed"],je=e=>za.indexOf(e.state);class ue{constructor(t){this.deps=t,this.confirm=null,this.releasing=new Set,this.held={},this.results={},this.callBusy=new Set,this.armed=null,this.tts={},this.armTimer=0,this.holdTimer=0}dispose(){this.deps.cancel(this.armTimer),this.deps.cancel(this.holdTimer)}static key(t,s){return`${t}/${s}`}isHeld(t){return(this.held[t]??0)>this.deps.now()}setResult(t,s,a){this.results={...this.results,[t]:{tone:s,text:a,at:this.deps.now()}},this.deps.changed()}prune(){const t=this.deps.now(),s=Object.entries(this.results).filter(([,a])=>t-a.at<(a.tone==="warn"?xa:$a));s.length!==Object.keys(this.results).length&&(this.results=Object.fromEntries(s),this.deps.changed())}clearResult(t){if(!(t in this.results))return;const s={...this.results};delete s[t],this.results=s,this.deps.changed()}askRelease(t,s){const a=ue.key(t,s);return!this.deps.live()||this.releasing.has(a)||this.isHeld(a)?!1:(this.confirm={stationId:t,lock:s},this.deps.changed(),!0)}cancelRelease(){this.confirm&&(this.confirm=null,this.deps.changed())}async confirmRelease(){const t=this.confirm;if(!t)return;const s=ue.key(t.stationId,t.lock);if(!(!this.deps.live()||this.releasing.has(s)||this.isHeld(s))){this.releasing=new Set([...this.releasing,s]),this.deps.changed();try{await this.deps.release(t.stationId,t.lock),this.setResult(t.stationId,"ok",p(S().door.sentAt,{at:this.deps.stamp()}))}catch(a){const n=He(a);this.setResult(t.stationId,n.tone,n.unknown?S().door.unknown:n.text),(n.unknown||a instanceof B&&a.code==="intercom_release_in_progress")&&this.hold(s,_a(a))}finally{const a=new Set(this.releasing);a.delete(s),this.releasing=a,this.confirm===t&&(this.confirm=null),this.deps.changed()}}}hold(t,s){const a=this.deps.now()+s;this.held={...this.held,[t]:Math.max(this.held[t]??0,a)},this.deps.cancel(this.holdTimer);const n=Object.values(this.held).filter(i=>i>this.deps.now());n.length&&(this.holdTimer=this.deps.after(()=>{this.held={...this.held},this.deps.changed()},Math.min(...n)-this.deps.now()+50)),this.deps.changed()}tapCall(t,s,a=1){const n=this.deps.station(t);if(!n||this.callBusy.has(t)||!this.deps.live()||a>1)return;const i=this.armed;if(i&&i.id===t&&i.command===s&&i.callState===n.call_state){if(this.deps.tick()-i.at<ps)return;this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed(),this.sendCall(t,s);return}this.deps.cancel(this.armTimer),this.armed={id:t,command:s,at:this.deps.tick(),callState:n.call_state},this.armTimer=this.deps.after(()=>{this.armed=null,this.deps.changed()},ws),this.deps.changed()}dropStaleArm(){const t=this.armed;if(!t)return;const s=this.deps.station(t.id);(!this.deps.live()||!s||!s.online||s.call_state!==t.callState)&&(this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed())}async sendCall(t,s){this.callBusy=new Set([...this.callBusy,t]),this.deps.changed();try{const a=await this.deps.signal(t,s);a.call&&this.setResult(t,a.call.acknowledged===!0?"ok":"warn",Sa(a.call))}catch(a){const n=He(a);this.setResult(t,n.tone,n.text)}finally{const a=new Set(this.callBusy);a.delete(t),this.callBusy=a,this.deps.changed(),this.deps.refetch()}}noteTts(t){const s=this.tts[t.station_id];s&&s.at>=t.at&&je(s)>je(t)||(this.tts={...this.tts,[t.station_id]:t},this.deps.changed())}}const Ca=j`
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
`,ie=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],U=e=>`access-control/stations/${encodeURIComponent(e)}`,Ta=15e3,oe=()=>({confirmed:!0,client_request_id:st(),expires_at:new Date(tt()+Ta).toISOString().replace(/\.\d{3}Z$/,"Z")}),Oa=e=>_e(`${U(e)}/door-tech`),Aa=(e,t)=>_e(`${U(e)}/doors/${t}/hold`),Pa=(e,t,s,a)=>Y(`${U(e)}/doors/${t}/hold`,{...oe(),revision:s,policy:a}),Ea=(e,t,s)=>Y(`${U(e)}/doors/${t}/hold/delete`,{...oe(),revision:s}),Da=(e,t,s,a,n)=>Y(`${U(e)}/doors/${t}/program`,{...oe(),revision:s,policy:a,enabled:n}),La=(e,t,s,a)=>Y(`${U(e)}/doors/${t}/program/${a}`,{...oe(),revision:s});function Na(e){return{action:e.action,door:e.door,expected:e.expected,...e.action==="set"?{new_code:e.newCode??""}:{},...e.expected?{current_code:e.currentCode??""}:{},compatibility:!!e.compatibility,confirm_text:e.confirmText}}const Ma=(e,t)=>Y(`${U(e)}/codes/${t.slot}`,{...oe(),...Na(t)});function Ra(e,t){if(e instanceof B){const s=e.body?.details??{},a=String(s.outcome??""),n=a==="refused"?"refused":a==="not_sent"?"not_sent":a==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",i=Number(s.retry_after_s),r=String(s.wiskey_code??"")||String(s.reason??"")||e.code||"";return{kind:t,status:n,code:r||null,retry_after_s:Number.isFinite(i)&&i>=0?i:null,data:null}}return{kind:t,status:"unknown",code:"network",retry_after_s:null,data:null}}async function Z(e,t){try{const s=await t();return{kind:e,status:s.status,code:s.partial,retry_after_s:null,data:s.data??null}}catch(s){return Ra(s,e)}}function he(e,t){const s=Object.fromEntries(ie.map(a=>[a,(e?.weekly?.[a]??[]).filter(n=>!!n?.start&&!!n?.end).map(n=>({start:n.start,end:n.end}))]));return{timezone:e?.timezone||t,name:e?.name??"",weekly:s,holidays:(e?.holidays??[]).filter(a=>!!a.start&&!!a.end).map(a=>({name:a.name??"",start:a.start,end:a.end,periods:(a.periods??[]).map(n=>({start:n.start,end:n.end}))}))}}const Ia=(e,t="")=>he({timezone:e,name:t,weekly:{},holidays:[]},e),qa=/^(?:[01]\d|2[0-3]):[0-5]\d$/,de=(e,t=!1)=>qa.test(e)?Number(e.slice(0,2))*60+Number(e.slice(3)):t&&e==="24:00"?1440:null;function We(e,t){if(e.length>8)return[{field:t,key:"tooMany"}];const s=[];if(e.forEach((n,i)=>{const r=de(n.start),c=de(n.end,!0);r===null||c===null?s.push({field:`${t}.${i}`,key:"time"}):r>=c&&s.push({field:`${t}.${i}`,key:"order"})}),s.length)return s;const a=[...e].sort((n,i)=>n.start.localeCompare(i.start));for(let n=1;n<a.length;n++)if((de(a[n-1].end,!0)??0)>(de(a[n].start)??0))return[{field:t,key:"overlap"}];return[]}function Be(e){const t=[],s=e.name.trim();(!s||s.length>32)&&t.push({field:"name",key:"name"}),(!e.timezone||e.timezone.length>64)&&t.push({field:"timezone",key:"zone"});for(const i of ie)t.push(...We(e.weekly[i]??[],`weekly.${i}`));e.holidays.length>64&&t.push({field:"holidays",key:"tooMany"});const a=/^\d{4}-\d{2}-\d{2}$/;e.holidays.forEach((i,r)=>{(!i.name.trim()||i.name.trim().length>32)&&t.push({field:`holidays.${r}.name`,key:"name"}),!a.test(i.start)||!a.test(i.end)?t.push({field:`holidays.${r}`,key:"date"}):i.start>i.end&&t.push({field:`holidays.${r}`,key:"dateOrder"}),t.push(...We(i.periods,`holidays.${r}.periods`))});const n=e.holidays.filter(i=>a.test(i.start)&&a.test(i.end)).sort((i,r)=>i.start.localeCompare(r.start));for(let i=1;i<n.length;i++)n[i-1].end>=n[i].start&&t.push({field:"holidays",key:"dateOverlap"});return t}function Ue(e){const t=s=>[...s].map(a=>({start:a.start,end:a.end})).sort((a,n)=>a.start.localeCompare(n.start));return{timezone:e.timezone,name:e.name.trim(),weekly:Object.fromEntries(ie.map(s=>[s,t(e.weekly[s]??[])])),holidays:e.holidays.map(s=>({name:s.name.trim(),start:s.start,end:s.end,periods:t(s.periods)})).sort((s,a)=>s.start.localeCompare(a.start))}}function Ke(e,t){return e?ie.filter(s=>(e.weekly[s]??[]).length).map(s=>`${t.days[s]} ⁦${(e.weekly[s]??[]).map(a=>`${a.start}–${a.end}`).join(", ")}⁩`):[]}const Ve=/^\d{4,16}$/;function Fa(e){if(e.action==="set"){if(!Ve.test(e.newCode))return"newCode";if(e.newCode!==e.repeatCode)return"repeat"}return e.expected&&!Ve.test(e.currentCode)?"currentCode":e.typed.trim()!==e.phrase?"typed":null}const Ye=(e,t)=>p(e,{slot:t});function Ha(e,t){return e?t.reasons[e]??(e.startsWith("schedule_")?t.reasons.schedule_invalid:e):""}function Ge(e,t){const s=Ha(e.code,t);switch(e.status){case"sending":return t.status.sending;case"sent":return t.status.sent;case"acknowledged":return t.status.acknowledged;case"partial":return t.status.partial;case"refused":return p(t.status.refused,{reason:s||t.reasons.unknown_reason});case"not_sent":return s?p(t.status.notSentWhy,{reason:s}):t.status.notSent;default:return s&&e.code!=="network"?p(t.status.unknownWhy,{reason:s}):t.status.unknown}}function Je(e){return e==="acknowledged"?"ok":e==="refused"||e==="not_sent"?"err":e==="sending"||e==="sent"?"busy":"warn"}const ja={title:"שינויים טכניים",open:"ניהול טכני של הדלתות",heading:"ניהול טכני · {name}",sub:"שינויים בהגדרות הדלתות של העמדה. כל שינוי דורש אישור ונרשם ביומן.",loading:"טוען…",unavailable:"לא ניתן לטעון את הנתונים כרגע.",retry:"נסה שוב",close:"סגירה",notAllowed:"שינויים טכניים בדלתות של העמדה הזו מותרים למנהלי מערכת בלבד.",offline:"העמדה אינה מחוברת: אפשר לשמור לוחות זמנים ולהשהות תוכניות, אבל לא להחיל תוכנית או לשנות קוד.",unsupported:"הגרסה המותקנת של מערכת האינטרקום אינה מציעה את הפעולה הזו.",noDoors:"לעמדה אין דלתות מנוהלות.",tabs:{hold:"לוחות החזקה",codes:"קודים ציבוריים",programs:"תוכניות",history:"יומן"},door:"דלת {n}",days:{Sunday:"א׳",Monday:"ב׳",Tuesday:"ג׳",Wednesday:"ד׳",Thursday:"ה׳",Friday:"ו׳",Saturday:"ש׳"},dayNames:{Sunday:"ראשון",Monday:"שני",Tuesday:"שלישי",Wednesday:"רביעי",Thursday:"חמישי",Friday:"שישי",Saturday:"שבת"},hold:{none:"אין לוח החזקה",draftNote:"לוח החזקה הוא טיוטה: הוא לא פותח את הדלת עד שמחילים אותו כתוכנית.",add:"הוספה",edit:"עריכה",remove:"מחיקה",holidays:"תאריכים מיוחדים: {n}",noHours:"סגור כל השבוע"},editor:{titleNew:"לוח החזקה חדש · {door}",titleEdit:"עריכת לוח החזקה · {door}",name:"שם",zone:"אזור זמן",week:"שעות פתיחה בשבוע",closed:"סגור",addPeriod:"הוספת טווח",removePeriod:"הסרת הטווח",from:"מ־",to:"עד",holidays:"תאריכים מיוחדים",addHoliday:"הוספת תאריך",removeHoliday:"הסרת התאריך",holidayName:"שם",holidayStart:"מתאריך",holidayEnd:"עד תאריך",holidayClosed:"סגור כל היום",holidayOpen:"פתוח בשעות",save:"שמירה",cancel:"ביטול",problems:{name:"יש לתת שם (עד 32 תווים).",time:"שעה לא תקינה (HH:MM, סיום עד 24:00).",order:"שעת ההתחלה חייבת להיות לפני שעת הסיום.",overlap:"טווחי השעות חופפים.",tooMany:"יותר מדי טווחים.",date:"תאריך לא תקין.",dateOrder:"תאריך ההתחלה אחרי תאריך הסיום.",dateOverlap:"התאריכים המיוחדים חופפים.",zone:"אזור הזמן חסר."}},codes:{slot:"קוד {n}",set:"מוגדר",notSet:"לא מוגדר",unknown:"לא ידוע",never:"ערך של קוד אף פעם לא מוצג כאן - רק אם הוא מוגדר.",define:"הגדרה",replace:"החלפה",clear:"ניקוי",formSet:"הגדרת {slot}",formReplace:"החלפת {slot}",formClear:"ניקוי {slot}",door:"הדלת שהקוד פותח",newCode:"קוד חדש (4-16 ספרות)",repeat:"הקוד החדש שוב",current:"הקוד הנוכחי",currentHint:"העמדה מבקשת את הקוד הנוכחי כדי להחליף או לנקות אותו.",compatibility:"מצב תאימות (העמדה אינה מצהירה על תמיכה)",typed:"לאישור, הקלידו: {phrase}",send:"שליחה לעמדה",cancel:"ביטול",load:"קריאת מצב הקודים",problems:{newCode:"קוד חייב להכיל 4-16 ספרות.",repeat:"שני הקודים החדשים אינם זהים.",currentCode:"יש להזין את הקוד הנוכחי (4-16 ספרות).",typed:"הטקסט שהוקלד אינו תואם."},rate:"עד {n} שינויי קוד ב־{m} דקות."},programs:{none:"אין תוכנית",on:"מופעלת",paused:"מושהית",removing:"בהסרה",exec:{idle:"לא מחזיקה כרגע",opening:"שולחת החזקה",held_acknowledged:"החזקה אושרה (המצב הפיזי לא אומת)",restoring:"חוזרת לשליטה רגילה",unknown:"תוצאה לא ידועה"},apply:"החלה מלוח ההחזקה",resume:"הפעלה מחדש",pause:"השהיה",remove:"הסרה",needDraft:"כדי להחיל תוכנית שמרו קודם לוח החזקה לדלת.",pauseFirst:"כדי להחיל לוח חדש יש להשהות קודם את התוכנית."},confirm:{hold_save:{title:"לשמור את לוח ההחזקה?",one:'הלוח "{name}" יישמר כטיוטה ל{door} בעמדה {station}. הדלת לא תיפתח עד שתוחל תוכנית.'},hold_delete:{title:"למחוק את לוח ההחזקה?",one:"לוח ההחזקה של {door} בעמדה {station} יימחק."},program_apply:{title:"להחיל תוכנית החזקה?",one:'מעכשיו {door} בעמדה {station} תוחזק פתוחה אוטומטית בשעות של "{name}". המערכת תפעל לבד לפי הלוח.'},program_pause:{title:"להשהות את התוכנית?",one:"התוכנית של {door} בעמדה {station} תושהה, והדלת תתבקש לחזור לשליטה רגילה."},program_remove:{title:"להסיר את התוכנית?",one:"התוכנית של {door} בעמדה {station} תוסר, והדלת תתבקש לחזור לשליטה רגילה."},send:"אישור ושליחה",cancel:"ביטול"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"בוצע ואושר",partial:"בוצע חלקית: התוכנית נשמרה, אך לא ברור אם הטיוטה הישנה נמחקה",refused:"WisKey סירב: {reason}",notSent:"לא נשלח",notSentWhy:"לא נשלח: {reason}",unknown:"נשלח, לא התקבלה תשובה ברורה - ייתכן שבוצע. טענו מחדש לפני שמנסים שוב",unknownWhy:"נשלח, לא התקבלה תשובה ברורה ({reason}) - ייתכן שבוצע. טענו מחדש לפני שמנסים שוב"},kinds:{hold_save:"שמירת לוח",hold_delete:"מחיקת לוח",code_write:"קוד ציבורי",program_save:"החלת תוכנית",program_action:"עדכון תוכנית"},historyEmpty:"אין עדיין שינויים טכניים בעמדה הזו.",historyCode:"{action} {slot}",codeActions:{set:"הגדרת",clear:"ניקוי"},programActions:{pause:"השהיה",remove:"הסרה"},reasons:{unauthorized:"אין הרשאה לפקודה הזו",forbidden:"אין הרשאה",reauth_required:"נדרש אימות מחדש לפעולות רגישות",screen_locked:"המסך נעול",approval_required:"נדרש אישור כפול",device_busy:"העמדה עסוקה בפקודה טכנית אחרת",revision_conflict:"הנתונים השתנו מאז שנטענו",hold_pause_before_edit:"יש להשהות את התוכנית קודם",schedule_limit:"הגעתם למספר המרבי של לוחות",operation_unsupported:"העמדה אינה תומכת בפעולה",unmanaged_lock:"הדלת אינה מנוהלת",station_retiring:"העמדה בהוצאה משימוש",station_unloaded:"העמדה נטענה מחדש באמצע הפעולה",invalid_fields:"פרמטרים לא תקינים",schedule_invalid:"לוח הזמנים אינו תקין",confirmation_required:"לא אושר",typed_confirmation_required:"הטקסט לאישור לא הוקלד נכון",expired:"הבקשה פגה לפני שנשלחה",intercom_duplicate_command:"כבר נשלח",intercom_station_offline:"העמדה אינה מחוברת",intercom_station_not_found:"העמדה לא נמצאה",intercom_lock_unknown:"אין לעמדה דלת כזו",door_tech_invalid:"ערך לא תקין",door_tech_unsupported:"הגרסה המותקנת אינה מציעה את הפעולה",door_tech_cooldown:"נשלח לפני רגע",door_tech_code_rate_limited:"יותר מדי שינויי קוד בזמן קצר",door_tech_rate_limited:"יותר מדי שינויים בזמן קצר",door_tech_busy:"שינוי אחר בעמדה עדיין רץ",door_tech_code_not_set:"הקוד אינו מוגדר",relay_map_unreadable:"לא ניתן היה לקרוא את מיפוי הדלתות",explicit_deny:"ההרשאה נשללה בעמדה הזו",no_binding:"אין הרשאה",wall_account:"חשבון תצוגה",intercom_unavailable:"מערכת האינטרקום אינה זמינה",intercom_busy:"מערכת האינטרקום עסוקה",intercom_rate_limited:"הוגבל קצב",rate_limited:"הוגבל קצב",timeout:"אין תשובה בזמן",action_failed:"כשל לא מפורט",invalid_response:"תשובה לא צפויה",ambiguous_write:"העמדה לא אישרה בבירור",readback_mismatch:"הקריאה החוזרת לא תאמה",network:"אין חיבור לשרת",unknown_reason:"סיבה לא ידועה"}},Wa={title:"Technical changes",open:"Door technical settings",heading:"Technical settings · {name}",sub:"Changes to this station's door settings. Every change needs a confirmation and is recorded.",loading:"Loading…",unavailable:"The data cannot be loaded right now.",retry:"Try again",close:"Close",notAllowed:"Technical changes to this station's doors are for system administrators only.",offline:"The station is offline: schedules can be saved and programs paused, but a program cannot be applied and codes cannot be changed.",unsupported:"The installed intercom version does not offer this action.",noDoors:"The station has no managed doors.",tabs:{hold:"Hold-open schedules",codes:"Public codes",programs:"Programs",history:"Log"},door:"Door {n}",days:{Sunday:"Sun",Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat"},dayNames:{Sunday:"Sunday",Monday:"Monday",Tuesday:"Tuesday",Wednesday:"Wednesday",Thursday:"Thursday",Friday:"Friday",Saturday:"Saturday"},hold:{none:"No hold-open schedule",draftNote:"A hold-open schedule is a draft: it does not open the door until it is applied as a program.",add:"Add",edit:"Edit",remove:"Delete",holidays:"Special dates: {n}",noHours:"Closed all week"},editor:{titleNew:"New hold-open schedule · {door}",titleEdit:"Edit hold-open schedule · {door}",name:"Name",zone:"Time zone",week:"Weekly opening hours",closed:"Closed",addPeriod:"Add a period",removePeriod:"Remove the period",from:"From",to:"To",holidays:"Special dates",addHoliday:"Add a date",removeHoliday:"Remove the date",holidayName:"Name",holidayStart:"From date",holidayEnd:"To date",holidayClosed:"Closed all day",holidayOpen:"Open during",save:"Save",cancel:"Cancel",problems:{name:"Give it a name (up to 32 characters).",time:"Invalid time (HH:MM, end up to 24:00).",order:"The start must be before the end.",overlap:"The periods overlap.",tooMany:"Too many periods.",date:"Invalid date.",dateOrder:"The start date is after the end date.",dateOverlap:"The special dates overlap.",zone:"The time zone is missing."}},codes:{slot:"Code {n}",set:"Set",notSet:"Not set",unknown:"Unknown",never:"A code value is never shown here - only whether it is set.",define:"Set",replace:"Replace",clear:"Clear",formSet:"Set {slot}",formReplace:"Replace {slot}",formClear:"Clear {slot}",door:"The door the code opens",newCode:"New code (4-16 digits)",repeat:"New code again",current:"Current code",currentHint:"The station asks for the current code to replace or clear it.",compatibility:"Compatibility mode (the station does not declare support)",typed:"To confirm, type: {phrase}",send:"Send to the station",cancel:"Cancel",load:"Read the codes",problems:{newCode:"A code has 4-16 digits.",repeat:"The two new codes differ.",currentCode:"Enter the current code (4-16 digits).",typed:"The typed text does not match."},rate:"Up to {n} code changes in {m} minutes."},programs:{none:"No program",on:"On",paused:"Paused",removing:"Being removed",exec:{idle:"Not holding now",opening:"Sending hold-open",held_acknowledged:"Hold-open acknowledged (physical state not verified)",restoring:"Returning to normal control",unknown:"Outcome unknown"},apply:"Apply the hold-open schedule",resume:"Turn on again",pause:"Pause",remove:"Remove",needDraft:"Save a hold-open schedule for the door first to apply a program.",pauseFirst:"Pause the program first to apply a new schedule."},confirm:{hold_save:{title:"Save the hold-open schedule?",one:'The schedule "{name}" is saved as a draft for {door} at {station}. The door does not open until a program is applied.'},hold_delete:{title:"Delete the hold-open schedule?",one:"The hold-open schedule of {door} at {station} is deleted."},program_apply:{title:"Apply a hold-open program?",one:'From now on {door} at {station} is held open automatically during the hours of "{name}". The system acts on its own by the schedule.'},program_pause:{title:"Pause the program?",one:"The program of {door} at {station} is paused and the door is asked back to normal control."},program_remove:{title:"Remove the program?",one:"The program of {door} at {station} is removed and the door is asked back to normal control."},send:"Confirm and send",cancel:"Cancel"},status:{sending:"Sending…",sent:"Sent, waiting for the answer",acknowledged:"Done and acknowledged",partial:"Partly done: the program was saved, but it is not clear whether the old draft was deleted",refused:"WisKey refused: {reason}",notSent:"Not sent",notSentWhy:"Not sent: {reason}",unknown:"Sent, no clear answer - it may have happened. Reload before trying again",unknownWhy:"Sent, no clear answer ({reason}) - it may have happened. Reload before trying again"},kinds:{hold_save:"Schedule saved",hold_delete:"Schedule deleted",code_write:"Public code",program_save:"Program applied",program_action:"Program changed"},historyEmpty:"No technical changes at this station yet.",historyCode:"{action} {slot}",codeActions:{set:"Set",clear:"Clear"},programActions:{pause:"Pause",remove:"Remove"},reasons:{unauthorized:"no permission for this command",forbidden:"no permission",reauth_required:"a fresh sign-in is required for sensitive actions",screen_locked:"the screen is locked",approval_required:"a second approval is required",device_busy:"the station is busy with another technical command",revision_conflict:"the data changed since it was loaded",hold_pause_before_edit:"pause the program first",schedule_limit:"the schedule limit is reached",operation_unsupported:"the station does not support this",unmanaged_lock:"the door is not managed",station_retiring:"the station is being retired",station_unloaded:"the station reloaded during the action",invalid_fields:"invalid parameters",schedule_invalid:"the schedule is invalid",confirmation_required:"not confirmed",typed_confirmation_required:"the confirmation text was not typed correctly",expired:"the request expired before it was sent",intercom_duplicate_command:"already sent",intercom_station_offline:"the station is offline",intercom_station_not_found:"the station was not found",intercom_lock_unknown:"the station has no such door",door_tech_invalid:"invalid value",door_tech_unsupported:"the installed version does not offer this",door_tech_cooldown:"sent a moment ago",door_tech_code_rate_limited:"too many code changes in a short time",door_tech_rate_limited:"too many changes in a short time",door_tech_busy:"another change at the station is still running",door_tech_code_not_set:"the code is not set",relay_map_unreadable:"the door map could not be read",explicit_deny:"the permission is denied at this station",no_binding:"no permission",wall_account:"a display account",intercom_unavailable:"the intercom system is unavailable",intercom_busy:"the intercom system is busy",intercom_rate_limited:"rate limited",rate_limited:"rate limited",timeout:"no answer in time",action_failed:"an unspecified failure",invalid_response:"an unexpected answer",ambiguous_write:"the station did not clearly acknowledge",readback_mismatch:"the read-back did not match",network:"no connection to the server",unknown_reason:"unknown reason"}};function _(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?Wa:ja}var Ba=Object.defineProperty,Ua=Object.getOwnPropertyDescriptor,C=(e,t,s,a)=>{for(var n=a>1?void 0:a?Ua(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&Ba(t,s,n),n};let x=class extends N{constructor(){super(...arguments),this.station=null,this.live=!0,this.open=!1,this.tab="hold",this.phase="idle",this.view=null,this.programs=null,this.holds={},this.zone="Asia/Jerusalem",this.codes=null,this.codesPhase="idle",this.editing=null,this.codeForm=null,this.pending=null,this.running=null,this.results={},this.seq=0,this.loadedFor=""}mayWrite(){return T("system.configure")||T("access.stations.manage")}willUpdate(e){e.has("station")&&this.station&&this.station.id!==this.loadedFor&&(this.loadedFor=this.station.id,this.reset()),this.hidden=!this.station||!this.mayWrite()}reset(){this.seq++,this.open=!1,this.view=null,this.programs=null,this.holds={},this.codes=null,this.codesPhase="idle",this.phase="idle",this.editing=null,this.codeForm=null,this.pending=null,this.running=null,this.results={}}doors(){return(this.view?.locks??this.station?.locks.map(e=>({door:e.physical_index,name:e.name??null}))??[]).map(e=>e.door)}doorName(e){const t=_();return this.view?.locks.find(a=>a.door===e)?.name?.trim()||p(t.door,{n:e})}async openDialog(){this.open=!0,this.tab="hold",await this.load()}async load(){const e=this.station;if(!e)return;const t=++this.seq;this.phase="loading";try{const s=await Oa(e.id);if(t!==this.seq)return;if(this.view=s,!s.allowed){this.phase="ready";return}const[a,...n]=await Promise.all([ot(e.id),...s.locks.map(i=>Aa(e.id,i.door))]);if(t!==this.seq)return;this.programs=a.programs,this.zone=a.programs?.timezone||n.find(i=>i.hold?.timezone)?.hold?.timezone||this.zone,this.holds=Object.fromEntries(s.locks.map((i,r)=>[i.door,n[r]?.hold?.draft??null])),this.phase="ready"}catch{t===this.seq&&(this.phase="error")}}async loadCodes(){const e=this.station;if(!e)return;const t=this.seq;this.codesPhase="loading";try{const s=await rt(e.id);if(t!==this.seq)return;this.codes=s.codes,this.codesPhase=s.codes?"ready":"error"}catch{t===this.seq&&(this.codesPhase="error")}}pick(e){this.tab=e,this.pending=null,e==="codes"&&this.codesPhase==="idle"&&this.loadCodes()}ask(e){this.pending=e,this.updateComplete.then(()=>{const t=this.renderRoot.querySelector("[data-wk-dt-confirm]");t?.scrollIntoView({block:"nearest"}),t?.querySelector("[data-wk-dt-send]")?.focus()})}async send(){const e=this.pending;!e||this.running||(this.pending=null,await this.execute(e.key,e.kind,e.send))}async execute(e,t,s){const a=this.station?.id;this.running=e,this.results={...this.results,[e]:{kind:t,status:"sending",code:null,retry_after_s:null,data:null}};const n=await s();this.station?.id===a&&(this.running=null,this.results={...this.results,[e]:n},this.dispatchEvent(new CustomEvent("door-tech-changed",{detail:n,bubbles:!0,composed:!0})),await this.load(),e.startsWith("code:")&&await this.loadCodes())}stationName(){return this.station?.name??""}askHoldSave(){const e=this.editing,t=this.station;if(!e||!t||Be(e.body).length)return;const s=_(),a=Ue(e.body),n=e.door,i=e.revision;this.ask({key:`hold:${n}`,kind:"hold_save",title:s.confirm.hold_save.title,sentence:p(s.confirm.hold_save.one,{name:a.name,door:this.doorName(n),station:this.stationName()}),send:async()=>{const r=await Z("hold_save",()=>Pa(t.id,n,i,a));return r.status==="acknowledged"&&(this.editing=null),r}})}askHoldDelete(e){const t=this.station,s=this.holds[e];if(!t||!s||s.revision===null)return;const a=_(),n=s.revision;this.ask({key:`hold:${e}`,kind:"hold_delete",title:a.confirm.hold_delete.title,sentence:p(a.confirm.hold_delete.one,{door:this.doorName(e),station:this.stationName()}),send:()=>Z("hold_delete",()=>Ea(t.id,e,n))})}askProgramSave(e,t,s){const a=this.station;if(!a)return;const n=_();this.ask({key:`program:${e}`,kind:"program_save",title:n.confirm.program_apply.title,sentence:p(n.confirm.program_apply.one,{name:t.name,door:this.doorName(e),station:this.stationName()}),send:()=>Z("program_save",()=>Da(a.id,e,s,Ue(t),!0))})}askProgramAction(e,t){const s=this.station;if(!s||e.door===null||e.revision===null)return;const a=_(),n=t==="pause"?a.confirm.program_pause:a.confirm.program_remove,i=e.door,r=e.revision;this.ask({key:`program:${i}`,kind:"program_action",title:n.title,sentence:p(n.one,{door:this.doorName(i),station:this.stationName()}),send:()=>Z("program_action",()=>La(s.id,i,r,t))})}async sendCode(e){e.preventDefault();const t=this.codeForm,s=this.station,a=this.view;if(!t||!s||!a||this.running)return;const n=this.renderRoot,i=m=>n.querySelector(`[data-wk-dt-code-field="${m}"]`)?.value??"",r={action:t.action,expected:t.expected,newCode:i("new"),repeatCode:i("repeat"),currentCode:i("current"),typed:i("typed"),phrase:Ye(a.confirm_phrase,t.slot)},c=Fa(r),d=n.querySelector("[data-wk-dt-code-problem]");if(c){d&&(d.textContent=_().codes.problems[c]);return}const u={slot:t.slot,action:t.action,door:t.door,expected:t.expected,newCode:r.newCode,currentCode:r.currentCode,compatibility:t.compatibility,confirmText:r.typed};n.querySelectorAll("[data-wk-dt-code-field]").forEach(m=>m.value=""),r.newCode=r.repeatCode=r.currentCode="",this.codeForm=null,await this.execute(`code:${t.slot}`,"code_write",()=>Z("code_write",()=>Ma(s.id,u)))}render(){const e=this.station;if(!e||!this.mayWrite())return l;const t=_();return o`<div class="row" data-wk-dt=${e.id}>
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
        ${s.map(a=>o`<button type="button" role="tab" aria-selected=${String(this.tab===a)} data-wk-dt-tab=${a} @click=${()=>this.pick(a)}>${e.tabs[a]}</button>`)}
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
    </div>`}confirmAt(e){return this.pending?.key===e?this.renderConfirm(this.pending):l}result(e){const t=this.results[e];return t?o`<span class="line" role="status" data-wk-dt-result=${e} data-status=${t.status} data-tone=${Je(t.status)}>${Ge(t,_())}</span>`:l}unsupported(e){return this.view?.commands?.[e]?.available===!1}renderHold(){const e=_();return this.editing?this.renderEditor():o`<p class="note">${e.hold.draftNote}</p>
      ${this.doors().map(t=>{const s=this.holds[t]??null,a=s?.policy?he(s.policy,this.zone):null,n=Ke(a,e),i=`hold:${t}`,r=this.running===i;return o`<div class="door" data-wk-dt-hold=${t}>
          <div class="dh">
            <span class="n">${this.doorName(t)}${a?o` · <bdi>${a.name}</bdi>`:l}</span>
            <div class="btns">
              ${this.unsupported("hold_save")?l:o`<wk-action-button icon=${s?"edit":"plus"} data-wk-dt-hold-edit=${t} ?disabled=${!this.live||!!this.running||s?.revision===null}
                    @click=${()=>this.editing={door:t,revision:s?.revision??0,body:a??Ia(this.zone)}}>${s?e.hold.edit:e.hold.add}</wk-action-button>`}
              ${s&&!this.unsupported("hold_delete")?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-hold-delete=${t} ?busy=${r} ?disabled=${!this.live||!!this.running}
                    @click=${()=>this.askHoldDelete(t)}>${e.hold.remove}</wk-action-button>`:l}
            </div>
          </div>
          ${a?o`<div class="lines">${n.length?n.map(c=>o`<bdi>${c}</bdi>`):o`<span>${e.hold.noHours}</span>`}${a.holidays.length?o`<span>${p(e.hold.holidays,{n:a.holidays.length})}</span>`:l}</div>`:o`<span class="line">${e.hold.none}</span>`}
          ${this.confirmAt(i)} ${this.result(i)}
        </div>`})}`}change(e){if(!this.editing)return;const t=structuredClone(this.editing.body);e(t),this.editing={...this.editing,body:t}}periodInputs(e,t,s,a){const n=_().editor;return o`${e.map((i,r)=>o`<span class="period" data-wk-dt-period=${`${t}.${r}`}>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="07:00" aria-label=${n.from} .value=${i.start} @input=${c=>s(r,"start",c.target.value)} />
        <span aria-hidden="true">–</span>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="19:00" aria-label=${n.to} .value=${i.end} @input=${c=>s(r,"end",c.target.value)} />
        <wk-action-button tone="quiet" icon="close" icon-only label=${n.removePeriod} @click=${()=>a(r)}></wk-action-button>
      </span>`)}`}renderEditor(){const e=_(),t=this.editing,s=t.body,a=Be(s),n=r=>a.filter(c=>c.field===r||c.field.startsWith(r+".")),i=r=>r.length?o`<span class="problem">${e.editor.problems[r[0].key]}</span>`:l;return o`<div class="form" data-wk-dt-editor=${t.door}>
      <h5>${p(t.revision?e.editor.titleEdit:e.editor.titleNew,{door:this.doorName(t.door)})}</h5>
      <div class="grid2">
        <label class="f">${e.editor.name}<input data-wk-dt-name maxlength="32" .value=${s.name} aria-invalid=${String(!!n("name").length)} @input=${r=>this.change(c=>c.name=r.target.value)} />${i(n("name"))}</label>
        <label class="f">${e.editor.zone}<input class="ltr" data-wk-dt-zone maxlength="64" .value=${s.timezone} @input=${r=>this.change(c=>c.timezone=r.target.value.trim())} />${i(n("timezone"))}</label>
      </div>
      <div>
        <div class="line">${e.editor.week}</div>
        ${ie.map(r=>{const c=s.weekly[r]??[];return o`<div class="day" data-wk-dt-day=${r}>
            <span class="dn">${e.dayNames[r]}</span>
            <div>
              <div class="periods">
                ${c.length?l:o`<span class="closed">${e.editor.closed}</span>`}
                ${this.periodInputs(c,r,(d,u,m)=>this.change(w=>w.weekly[r][d][u]=m),d=>this.change(u=>u.weekly[r].splice(d,1)))}
                ${c.length<8?o`<wk-action-button tone="quiet" icon="plus" data-wk-dt-add-period=${r} @click=${()=>this.change(d=>d.weekly[r].push(c.length?{start:"",end:""}:{start:"07:00",end:"19:00"}))}>${e.editor.addPeriod}</wk-action-button>`:l}
              </div>
              ${i(n(`weekly.${r}`))}
            </div>
          </div>`})}
      </div>
      <div class="form">
        <div class="line">${e.editor.holidays}</div>
        ${s.holidays.map((r,c)=>o`<div class="holiday" data-wk-dt-holiday=${c}>
            <div class="grid2">
              <label class="f">${e.editor.holidayName}<input maxlength="32" .value=${r.name} @input=${d=>this.change(u=>u.holidays[c].name=d.target.value)} /></label>
              <span></span>
              <label class="f">${e.editor.holidayStart}<input type="date" lang=${Ae()} min="2000-01-01" max="2037-12-31" .value=${r.start} @input=${d=>this.change(u=>u.holidays[c].start=d.target.value)} /></label>
              <label class="f">${e.editor.holidayEnd}<input type="date" lang=${Ae()} min="2000-01-01" max="2037-12-31" .value=${r.end} @input=${d=>this.change(u=>u.holidays[c].end=d.target.value)} /></label>
            </div>
            <div class="periods">
              ${r.periods.length?l:o`<span class="closed">${e.editor.holidayClosed}</span>`}
              ${this.periodInputs(r.periods,`h${c}`,(d,u,m)=>this.change(w=>w.holidays[c].periods[d][u]=m),d=>this.change(u=>u.holidays[c].periods.splice(d,1)))}
              <wk-action-button tone="quiet" icon="plus" @click=${()=>this.change(d=>d.holidays[c].periods.push({start:"08:00",end:"12:00"}))}>${e.editor.addPeriod}</wk-action-button>
              <wk-action-button tone="quiet" icon="trash" @click=${()=>this.change(d=>d.holidays.splice(c,1))}>${e.editor.removeHoliday}</wk-action-button>
            </div>
            ${i(n(`holidays.${c}`))}
          </div>`)}
        ${i(a.filter(r=>r.field==="holidays"))}
        <div class="btns">
          <wk-action-button tone="quiet" icon="plus" data-wk-dt-add-holiday @click=${()=>this.change(r=>r.holidays.push({name:"",start:"",end:"",periods:[]}))}>${e.editor.addHoliday}</wk-action-button>
        </div>
      </div>
      <div class="btns">
        <wk-action-button tone="primary" icon="check" data-wk-dt-save ?disabled=${!this.live||!!this.running||a.length>0} @click=${()=>this.askHoldSave()}>${e.editor.save}</wk-action-button>
        <wk-action-button data-wk-dt-editor-cancel ?disabled=${!!this.running} @click=${()=>(this.editing=null,this.pending=null)}>${e.editor.cancel}</wk-action-button>
      </div>
      ${this.confirmAt(`hold:${t.door}`)} ${this.result(`hold:${t.door}`)}
    </div>`}renderPrograms(){const e=_(),t=this.view?.online!==!1;return o`${this.doors().map(s=>{const a=this.programs?.programs.find(z=>z.door===s)??null,n=this.holds[s]??null,i=n?.policy?he(n.policy,this.zone):null,r=`program:${s}`,c=!this.live||!!this.running,d=!this.unsupported("program_save"),u=!this.unsupported("program_action"),m=!!a&&!a.enabled&&!a.removing,w=a?a.removing?e.programs.removing:a.enabled?e.programs.on:e.programs.paused:e.programs.none,v=a?.execution?.status?e.programs.exec[a.execution.status]:null,f=a?.policy?he(a.policy,this.zone):null;return o`<div class="door" data-wk-dt-program=${s} data-state=${a?a.removing?"removing":a.enabled?"on":"paused":"none"}>
        <div class="dh">
          <span class="n">${this.doorName(s)}${f?.name?o` · <bdi>${f.name}</bdi>`:l}</span>
          <sw-badge kind=${a?a.removing?"stale":a.enabled?"live":"offline":"neutral"} label=${w}></sw-badge>
        </div>
        ${f?o`<div class="lines">${Ke(f,e).map(z=>o`<bdi>${z}</bdi>`)}</div>`:l}
        ${v&&a?.enabled?o`<span class="line">${v}</span>`:l}
        <div class="btns">
          ${d&&i&&(!a||m)?o`<wk-action-button tone="primary" icon="play" data-wk-dt-program-apply=${s} ?disabled=${c||!t} @click=${()=>this.askProgramSave(s,i,a?.revision??0)}>${e.programs.apply}</wk-action-button>`:l}
          ${d&&m&&f&&a?.revision!==null?o`<wk-action-button icon="play" data-wk-dt-program-resume=${s} ?disabled=${c||!t} @click=${()=>this.askProgramSave(s,f,a.revision)}>${e.programs.resume}</wk-action-button>`:l}
          ${u&&a?.enabled&&!a.removing?o`<wk-action-button icon="pause" data-wk-dt-program-pause=${s} ?disabled=${c} @click=${()=>this.askProgramAction(a,"pause")}>${e.programs.pause}</wk-action-button>`:l}
          ${u&&a&&!a.removing?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-program-remove=${s} ?disabled=${c} @click=${()=>this.askProgramAction(a,"remove")}>${e.programs.remove}</wk-action-button>`:l}
        </div>
        ${!i&&(!a||m)?o`<span class="line">${e.programs.needDraft}</span>`:l}
        ${i&&a?.enabled?o`<span class="line">${e.programs.pauseFirst}</span>`:l}
        ${this.confirmAt(r)} ${this.result(r)}
      </div>`})}`}renderCodes(){const e=_();if(this.codesPhase==="loading"&&!this.codes)return o`<p class="note" role="status">${e.loading}</p>`;if(this.codesPhase==="error"&&!this.codes)return o`<p class="note" data-wk-dt-codes-error>${e.unavailable} <wk-action-button tone="quiet" @click=${()=>void this.loadCodes()}>${e.retry}</wk-action-button></p>`;const t=this.codes;if(!t)return o`<wk-action-button @click=${()=>void this.loadCodes()}>${e.codes.load}</wk-action-button>`;const s=this.view?.online!==!1,a=!this.unsupported("code_write"),n=this.view?.limits;return o`<p class="note">${e.codes.never}${n?o` ${p(e.codes.rate,{n:n.code_max,m:Math.round(n.code_window_s/60)})}`:l}</p>
      ${this.codeForm?this.renderCodeForm(this.codeForm,t):l}
      ${t.slots.map(i=>{const r=`code:${i.slot}`,c=i.configured===!0?e.codes.set:i.configured===!1?e.codes.notSet:e.codes.unknown,d=!this.live||!!this.running||!s||i.configured===null||!!this.codeForm;return o`<div class="door" data-wk-dt-slot=${i.slot} data-configured=${String(i.configured)}>
          <div class="dh">
            <span class="n">${p(e.codes.slot,{n:i.slot})}</span>
            <sw-badge kind=${i.configured===!0?"live":i.configured===!1?"offline":"unknown"} label=${c}></sw-badge>
          </div>
          ${a?o`<div class="btns">
                <wk-action-button icon="lock" data-wk-dt-code-set=${i.slot} ?disabled=${d}
                  @click=${()=>this.codeForm={slot:i.slot,action:"set",expected:i.configured===!0,door:this.doors()[0]??1,compatibility:!1}}>${i.configured?e.codes.replace:e.codes.define}</wk-action-button>
                ${i.configured?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-code-clear=${i.slot} ?disabled=${d}
                      @click=${()=>this.codeForm={slot:i.slot,action:"clear",expected:!0,door:this.doors()[0]??1,compatibility:!1}}>${e.codes.clear}</wk-action-button>`:l}
              </div>`:l}
          ${this.result(r)}
        </div>`})}`}renderCodeForm(e,t){const s=_(),a=p(s.codes.slot,{n:e.slot}),n=e.action==="clear"?s.codes.formClear:e.expected?s.codes.formReplace:s.codes.formSet,i=Ye(this.view?.confirm_phrase??"קוד {slot}",e.slot),r=this.doors();return o`<form class="confirm" data-wk-dt-code-form=${e.slot} data-action=${e.action} autocomplete="off" @submit=${c=>void this.sendCode(c)}>
      <h5>${p(n,{slot:a})}</h5>
      ${r.length>1?o`<label class="f">${s.codes.door}<select data-wk-dt-code-door @change=${c=>this.codeForm={...e,door:Number(c.target.value)}}>
            ${r.map(c=>o`<option value=${c} ?selected=${c===e.door}>${this.doorName(c)}</option>`)}
          </select></label>`:l}
      ${e.action==="set"?o`<div class="grid2">
            <label class="f">${s.codes.newCode}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="16" data-wk-dt-code-field="new" /></label>
            <label class="f">${s.codes.repeat}<input type="password" inputmode="numeric" autocomplete="new-password" maxlength="16" data-wk-dt-code-field="repeat" /></label>
          </div>`:l}
      ${e.expected?o`<label class="f">${s.codes.current}<input type="password" inputmode="numeric" autocomplete="off" maxlength="16" data-wk-dt-code-field="current" /><span class="line">${s.codes.currentHint}</span></label>`:l}
      ${t.capabilities.advertised===!1&&e.action==="set"?o`<label class="check"><input type="checkbox" data-wk-dt-code-compat .checked=${e.compatibility} @change=${c=>this.codeForm={...e,compatibility:c.target.checked}} />${s.codes.compatibility}</label>`:l}
      <label class="f">${p(s.codes.typed,{phrase:i})}<input autocomplete="off" maxlength="32" data-wk-dt-code-field="typed" /></label>
      <span class="problem" role="alert" data-wk-dt-code-problem></span>
      <div class="btns">
        <wk-action-button tone="primary" icon="lock" data-wk-dt-code-send ?disabled=${!this.live||!!this.running} @click=${c=>void this.sendCode(c)}>${s.codes.send}</wk-action-button>
        <wk-action-button data-wk-dt-code-cancel @click=${()=>this.codeForm=null}>${s.codes.cancel}</wk-action-button>
      </div>
    </form>`}renderHistory(){const e=_(),t=this.view?.history??[];return t.length?o`<ul class="hist" data-wk-dt-history>
      ${t.map(s=>{const a=s.kind==="code_write"&&s.slot?p(e.historyCode,{action:e.codeActions[s.code_action??"set"],slot:p(e.codes.slot,{n:s.slot})}):`${s.kind==="program_action"&&s.program_action?e.programActions[s.program_action]:e.kinds[s.kind]}${s.door?` · ${this.doorName(s.door)}`:""}`;return o`<li data-wk-dt-history-row=${s.kind} data-status=${s.status}>
          <span>${a}</span>
          <span class="line" data-tone=${Je(s.status)}><bdi>${new Date(s.at).toLocaleString(document.documentElement.lang||"he",{dateStyle:"short",timeStyle:"short"})}</bdi> · ${Ge(s,e)}</span>
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
  `;C([g({attribute:!1})],x.prototype,"station",2);C([g({type:Boolean})],x.prototype,"live",2);C([h()],x.prototype,"open",2);C([h()],x.prototype,"tab",2);C([h()],x.prototype,"phase",2);C([h()],x.prototype,"view",2);C([h()],x.prototype,"programs",2);C([h()],x.prototype,"holds",2);C([h()],x.prototype,"zone",2);C([h()],x.prototype,"codes",2);C([h()],x.prototype,"codesPhase",2);C([h()],x.prototype,"editing",2);C([h()],x.prototype,"codeForm",2);C([h()],x.prototype,"pending",2);C([h()],x.prototype,"running",2);C([h()],x.prototype,"results",2);x=C([M("wk-door-tech")],x);var Ka=Object.defineProperty,Va=Object.getOwnPropertyDescriptor,I=(e,t,s,a)=>{for(var n=a>1?void 0:a?Va(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&Ka(t,s,n),n};const Ze={sync:"refresh",rescan:"search",health_refresh:"activity",clock_refresh:"clock"};let E=class extends N{constructor(){super(...arguments),this.station=null,this.live=!0,this.view=null,this.phase="idle",this.running=null,this.asking=null,this.results={},this.now=Date.now(),this.loadedFor="",this.loadedAt=Date.now(),this.seq=0,this.timer=0}mayRead(){return T("access.admin.read")||T("access.stations.manage")}connectedCallback(){super.connectedCallback(),this.timer=window.setInterval(()=>{this.now=Date.now()},1e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("station")&&this.station&&this.station.id!==this.loadedFor&&(this.loadedFor=this.station.id,this.view=null,this.results={},this.asking=null,this.mayRead()&&this.load()),this.hidden=!this.shown()}shown(){return!!this.station&&this.mayRead()&&(this.phase==="ready"||this.phase==="error"||this.phase==="loading"&&!!this.view)}async load(){const e=this.station?.id;if(!e)return;const t=++this.seq;this.phase="loading";try{const s=await Vs(e);if(t!==this.seq)return;this.view=s,this.loadedAt=Date.now(),this.now=this.loadedAt,this.phase="ready"}catch(s){if(t!==this.seq)return;this.phase=s instanceof B&&(s.status===403||s.status===404)?"hidden":"error"}}async run(e){const t=this.station;if(!t||this.running)return;this.asking=null,this.running=e,this.results={...this.results,[e]:{station_id:t.id,action:e,status:"sending",code:null,retry_after_s:null,data:null}};const s=await mt(t.id,e);this.station?.id===t.id&&(this.running=null,this.results={...this.results,[e]:s},this.dispatchEvent(new CustomEvent("station-op",{detail:s,bubbles:!0,composed:!0})),await this.load())}cooldownLeft(e){const t=this.view?.actions?.[e]?.cooldown_s??0;return Math.max(0,Math.ceil(t-(this.now-this.loadedAt)/1e3))}render(){const e=this.station;if(!e||!this.shown())return l;const t=F();return o`<div class="wrap" data-wk-maint=${e.id} data-wk-maint-state=${this.phase}>
      <div class="head">
        <h5><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</h5>
        <wk-action-button tone="quiet" icon="refresh" data-wk-maint-reload ?busy=${this.phase==="loading"} ?disabled=${this.phase==="loading"} @click=${()=>void this.load()}>${t.refresh}</wk-action-button>
      </div>
      ${this.phase==="error"&&!this.view?o`<div class="note" role="status" data-wk-maint-error>${t.unavailable}</div>`:l}
      ${this.view?this.renderHealth(e):l} ${this.view?this.renderOps(e):l} ${this.renderConfirm(e)}
    </div>`}renderHealth(e){const t=this.view,s=F();if(t.health_hidden)return o`<div class="note" data-wk-maint-hidden>${s.healthHidden}</div>`;const a=e.zone,n=t.technical,i=t.report?.health??null,r=n?.reconciled_at??t.report?.auth?.last_sync_ok_at??null,c=i?.events?.stream??n?.event_status?.stream??null,d=i?.clock??n?.clock??null,u=d?.skew_seconds,m=i?.access?.last_error??n?.last_error??null,w=Zs(t),v=Xs(t,s),f=t.report?.auth?.retained??0,z=q=>ge(q,this.now,a,S());return o`<dl class="kv" data-wk-maint-health>
      <dt>${s.rows.lastSync}</dt>
      <dd data-wk-maint-last-sync><bdi>${r?z(r):s.never}</bdi></dd>
      ${n?.scanned_at?o`<dt>${s.rows.lastScan}</dt><dd><bdi>${z(n.scanned_at)}</bdi></dd>`:l}
      ${c?o`<dt>${s.rows.stream}</dt><dd data-wk-maint-stream=${c}>${s.stream[c]??s.stream.unknown}</dd>`:l}
      ${d?o`<dt>${s.rows.clock}</dt><dd data-wk-maint-clock>${u==null?s.clockStatus[d.status??""]??s.clockStatus.unavailable:Math.abs(u)<=2?s.clockOk:p(s.clockSkew,{n:Math.round(u)})}${d.checked_at?o` <span class="sub">· <bdi>${z(d.checked_at)}</bdi></span>`:l}</dd>`:l}
      ${i&&(i.consecutive_poll_failures??0)>0?o`<dt>${s.rows.polls}</dt><dd>${i.consecutive_poll_failures}</dd>`:l}
      <dt>${s.rows.lastError}</dt>
      <dd data-wk-maint-last-error>${m?o`${be(m,s)}${be(m,s)!==m?o` <code>${m}</code>`:l}`:o`<span class="sub">${s.none}</span>`}</dd>
      <dt>${s.rows.auth}</dt>
      <dd>
        <div class="auth ${w||v.length?"bad":""}" data-wk-maint-auth=${w?w.source:"none"}>
          ${w?o`<span data-wk-maint-auth-line>${w.step?p(s.authLine,{source:s.authSources[w.source]??w.source,step:Qs(w.step,s),at:w.at?z(w.at):s.never}):p(s.authObserved,{source:s.authSources[w.source]??w.source,at:w.at?z(w.at):s.never})}</span>${w.status_code!==null&&w.status_code!==void 0?o`<span class="sub">${p(s.authCode,{code:`${w.status_code}${w.sub_status?` / ${w.sub_status}`:""}`})}</span>`:l}`:o`<span class="sub">${s.authNone}</span>`}
          ${v.length?o`<span data-wk-maint-auth-now>${p(s.authNow,{what:v.join(" · ")})}</span>`:l}
          ${f>0?o`<span class="sub" data-wk-maint-auth-count>${p(s.authCount,{n:f})}</span>`:l}
        </div>
      </dd>
    </dl>`}renderOps(e){const t=this.view,s=F(),a=ut.filter(i=>t.actions?.[i]?.allowed);if(!a.length)return l;const n=t.online??e.online;return o`${n?l:o`<div class="note" data-wk-maint-offline>${s.offlineHint}</div>`}
      <div class="ops" data-wk-maint-ops>
        ${a.map(i=>{const r=t.actions[i].needs_online,c=this.cooldownLeft(i),d=this.running===i,u=!this.live||!!this.running||r&&!n||c>0,m=this.results[i],w=t.last_runs?.[i]??null,v=m?ke(m.status,m.code,s):c>0?p(s.cooldown,{n:c}):w?p(s.lastRun,{status:ke(w.status,w.code,s),at:ge(w.at,this.now,e.zone,S())}):"",f=m?ye(m.status):w?ye(w.status):"busy";return o`<div class="op">
            <wk-action-button icon=${Ze[i]} data-wk-maint-op=${i} ?busy=${d} ?disabled=${u} @click=${()=>this.asking=i}>${s.actions[i]}</wk-action-button>
            <span class="line" role="status" data-wk-maint-result=${i} data-status=${m?.status??w?.status??""} data-tone=${m||w?f:""}>${v}</span>
          </div>`})}
      </div>`}renderConfirm(e){const t=this.asking;if(!t)return l;const s=F(),a=s.confirm[t];return o`<sw-dialog open heading=${a.title} data-wk-maint-confirm=${t} @close=${n=>n.target===n.currentTarget&&(this.asking=null)}>
      <p class="sentence" data-wk-maint-sentence>${p(a.one,{name:e.name})}</p>
      <div slot="footer">
        <wk-action-button data-wk-maint-cancel @click=${()=>this.asking=null}>${s.confirm.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon=${Ze[t]} data-wk-maint-send ?disabled=${!this.live} @click=${()=>void this.run(t)}>${s.confirm.send}</wk-action-button>
      </div>
    </sw-dialog>`}};E.styles=j`
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
  `;I([g({attribute:!1})],E.prototype,"station",2);I([g({type:Boolean})],E.prototype,"live",2);I([h()],E.prototype,"view",2);I([h()],E.prototype,"phase",2);I([h()],E.prototype,"running",2);I([h()],E.prototype,"asking",2);I([h()],E.prototype,"results",2);I([h()],E.prototype,"now",2);E=I([M("wk-station-maintenance")],E);var Ya=Object.defineProperty,Ga=Object.getOwnPropertyDescriptor,re=(e,t,s,a)=>{for(var n=a>1?void 0:a?Ga(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&Ya(t,s,n),n};const Ja=8,Za=3e4,Xa=`
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
`;let X;function Qa(){if(X===void 0)try{X=new CSSStyleSheet,X.replaceSync(Xa)}catch{X=null}return X}function en(e){const t=Qa(),s=e;if(!(!t||!("adoptedStyleSheets"in s)||s.adoptedStyleSheets.includes(t)))try{s.adoptedStyleSheets=[...s.adoptedStyleSheets,t]}catch{}}let V=class extends N{constructor(){super(...arguments),this.stationId="",this.zone="",this.rows=null,this.next=null,this.timer=0}createRenderRoot(){return this}allowed(){return ee()&&T("access.read")&&(T("access.events.read")||T("access.call"))}connectedCallback(){super.connectedCallback(),en(this.getRootNode()),this.style.display="contents",this.timer=window.setInterval(()=>{document.hidden||this.load(!1)},Za)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("stationId")&&(this.rows=null,this.next=null,this.load(!1))}async load(e){if(!this.stationId||!this.allowed())return;const t=this.stationId;try{const s=await It(t,Ja,e?this.next:null);if(t!==this.stationId)return;this.rows=e?[...this.rows??[],...s.calls]:s.calls,this.next=s.next}catch{}}when(e){const t=new Date(e),s={day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:!1},a=document.documentElement.lang||"he";try{return new Intl.DateTimeFormat(a,this.zone?{...s,timeZone:this.zone}:s).format(t)}catch{return new Intl.DateTimeFormat(a,s).format(t)}}render(){if(!this.allowed()||!this.rows?.length)return l;const e=qt(),t=e.log;return o`<section class="dsec" data-wk-dsec="calls" data-call-log="ready">
      <h4><sw-icon name="history" size=${14}></sw-icon>${t.title}</h4>
      <ul>
        ${this.rows.map(s=>{const a=Ft(s,e),n=Ht(s);return o`<li data-call-row=${s.id} data-outcome=${s.outcome??s.state} data-tone=${a.tone}>
            <span class="cw" dir="ltr">${this.when(s.rang_at)}</span>
            <span class="cx"><span>${a.text}</span>${s.door_opened_at?o`<small data-call-row-door>${jt(t.door,{name:s.door_opened_by_name||""})}</small>`:l}</span>
            <span class="cd" dir="ltr">${n!==null?Wt(n):""}</span>
          </li>`})}
      </ul>
      ${this.next?o`<button class="cm" data-call-log-more @click=${()=>void this.load(!0)}>${t.more}</button>`:l}
    </section>`}};re([g({attribute:"station-id"})],V.prototype,"stationId",2);re([g()],V.prototype,"zone",2);re([h()],V.prototype,"rows",2);re([h()],V.prototype,"next",2);V=re([M("wk-call-history")],V);function tn(e,t){return o`<wk-call-history station-id=${e} zone=${t?.kind==="iana"?t.name:""}></wk-call-history>`}function sn(e){return!ee()||!T("access.stations.manage")?l:o`<dt>בדיקת קבלה</dt><dd><a href=${js(e)} data-wk-live-validation=${e}>הרצת בדיקת קבלה לעמדה</a></dd>`}const ft=(e,t)=>t.zone??e.defaultZone,W=(e,t)=>ge(t.last_seen,e.now,ft(e,t),e.text),pe=e=>t=>{t.stopPropagation(),e()};function Ce(e,t){return t.camera_entity?e.media?e.failed[t.id]===e.poster?"failed":"image":"none":t.has_camera?"none":"nocam"}const Te=(e,t)=>it(t.id,e.poster);function gt(e,t,s){const a=e.text.still,n=s==="nocam"?a.none:s==="failed"?a.failed:a.offline;return o`<div class="none" role="status"><sw-icon name=${s==="nocam"?"camera":"offline"} size=${20}></sw-icon><span>${t.online||s==="nocam"?n:a.offline}</span></div>`}function an(e,t){if(!ht(t)&&!(t.online&&t.call_state==="ending"))return l;if(!G(e.policy,e.rights))return l;const s=t.call_state==="ringing";return o`<span class="callbadge ${t.call_state}" data-wk-call-badge=${t.call_state}>${s?o`<sw-icon name="bell" size=${14}></sw-icon>`:o`<span class="ic">${ae("phone",14)}</span>`}${se(t.call_state,e.text)}</span>`}function nn(e,t){const s=e.text,a=Ce(e,t),n=we(t.id,e.places),i=t.online?`${s.still.tag} · ${dt(e.poster)}`:W(e,t);return o`<div class="media ${t.online?"":"off"}" data-wk-still=${t.id} data-still-state=${a}>
    ${a==="image"?o`<img src=${Te(e,t)} alt=${p(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} /><span class="stamp"><bdi>${i}</bdi></span>`:gt(e,t,a)}
    ${an(e,t)}
    <button type="button" class="open" data-wk-open=${t.id} aria-label=${t.name} @click=${()=>e.open(t.id)}></button>
    <div class="scrim"><span class="name">${t.name}</span>${n?o`<span class="place">${n}</span>`:l}</div>
  </div>`}function on(e,t){const s=Ce(e,t);return o`<span class="thumb ${t.online?"":"off"}" data-wk-thumb=${t.id}>${s==="image"?o`<img src=${Te(e,t)} alt="" decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:o`<sw-icon name="camera" size=${18}></sw-icon>`}</span>`}function te(e,t,s,a,n,i){const r=e.actions.armed,c=!!r&&r.id===t.id&&r.command===s&&r.callState===t.call_state;return o`<wk-action-button
    tone=${a}
    icon=${n}
    data-wk-call=${s}
    ?armed=${c}
    ?disabled=${!e.live||e.actions.callBusy.has(t.id)}
    label=${c?p(e.text.call.armedAria,{label:i}):i}
    @click=${d=>{d.stopPropagation(),e.call(t,s,d)}}
    >${c?e.text.call.armed:i}</wk-action-button
  >`}function rn(e,t=!1){const s=e.text.talk;return o`<wk-action-button tone="dashed" icon="window" href=${K()} data-wk-talk="classic" label=${s.hint} ?block=${t} size=${t?"lg":"md"} @click=${a=>a.stopPropagation()}
    >${t?s.classic:s.classicShort}</wk-action-button
  >`}function vt(e,t,s){const a=e.talkControl?.(t,s);return a!==void 0?a:e.rights.talk?rn(e,s):l}function bt(e,t,s=!1){const a=e.text,n=t.online?t.call_state:"unavailable";if(n!=="ringing"&&n!=="in_call"&&n!=="ending")return l;if(!G(e.policy,e.rights))return l;const i=e.clock.seconds(t.id,e.now),r=n==="ringing"?o`<sw-icon name="bell" size=${15}></sw-icon>`:ae("phone",15),c=e.rights.call&&n!=="ending";return o`<div class="callrow ${n} ${s?"big":""}" data-wk-call-row=${t.id} data-call=${n} role="group" aria-label=${a.call.group}>
    <span class="cs">${r}<span>${se(n,a)}</span>${i!==null?o`<span class="dur" data-wk-call-clock>${ve(i)}</span>`:l}</span>
    ${c?o`<span class="ctl">${n==="ringing"?o`${te(e,t,"answer","ok","phone",a.call.answer)}${te(e,t,"reject","danger","close",a.call.reject)}`:o`${s?l:vt(e,t,!1)}${te(e,t,"hangUp","danger","hangup",a.call.hangUp)}`}</span>`:l}
  </div>`}function Oe(e,t){if(!e.rights.door)return l;const s=e.text.door;return o`${ne(t).map(a=>{const n=`${t.id}/${a.physical_index}`,i=e.actions.isHeld(n),r=e.actions.releasing.has(n),c=i?"held":r?"sending":"idle",d=i?s.held:r?s.sending:t.locks.length>1?p(s.openNamed,{name:Se(a,e.text)}):s.open;return o`<wk-action-button
      class="grow"
      icon="unlock"
      data-wk-door=${n}
      data-state=${c}
      ?busy=${r}
      ?disabled=${!e.live||!t.online||r||i}
      @click=${pe(()=>e.door(t,a.physical_index))}
      >${d}</wk-action-button
    >`})}`}function ln(e,t){return!e.rights.announce||!t.online?l:o`<wk-action-button icon="volume" icon-only data-wk-announce-at=${t.id} label=${e.text.announce} ?disabled=${!e.live} @click=${pe(()=>e.announce(t.id))}></wk-action-button>`}function kt(e,t,s=!1){const a=e.actions.results[t.id];return a?o`<div class="result ${a.tone} ${s?"sticky":""}" role="status" data-wk-result=${t.id} data-tone=${a.tone}>${a.text}</div>`:l}function dn(e,t,s){t.composedPath().some(n=>n instanceof HTMLElement&&n.matches("button, a, wk-action-button, select, input, textarea, summary"))||e.open(s)}function cn(e,t){const s=t.technical;return s?o`<div class="tech" data-wk-tech-row>
    <sw-badge kind=${ze(t.sync_state)} label=${me(t.sync_state,e.text)} data-wk-sync=${t.sync_state}></sw-badge>
    <span class="sp"></span>
    ${s.model?o`<code>${s.model}</code>`:l}
  </div>`:l}function hn(e,t){const s=e.text,a=ct(t),n=e.rights.door&&ne(t).length>0||e.rights.announce&&t.online;return o`<sw-card flush interactive class="card ${a==="ringing"?"ringing":""}" data-wk-station=${t.id} data-status=${a} @click=${i=>dn(e,i,t.id)}>
    ${nn(e,t)}
    <div class="cb">
      <div class="hd">
        <sw-badge kind=${t.online?"live":"offline"} label=${t.online?s.status.online:s.status.offline}></sw-badge>
        <span>${s.seen.prefix} <b><bdi>${W(e,t)}</bdi></b></span>
      </div>
      ${bt(e,t)}
      ${n?o`<div class="acts">${Oe(e,t)}${ln(e,t)}</div>`:l}
      ${kt(e,t)} ${cn(e,t)}
    </div>
  </sw-card>`}function $e(e,t,s=!1){const a=t.online?t.call_state:"";if(a!=="ringing"&&a!=="in_call"&&a!=="ending")return l;if(!G(e.policy,e.rights))return l;const n=e.clock.seconds(t.id,e.now),i=`${se(a,e.text)}${n!==null?` · ${ve(n)}`:""}`;return s?o`<sw-badge kind=${a==="ringing"?"stale":"recorded"} label=${i} data-wk-call-pill=${a}></sw-badge>`:o`<span class="pillcall ${a}" data-wk-call-pill=${a}>${se(a,e.text)}${n!==null?o` · <span class="dur">${ve(n)}</span>`:l}</span>`}function un(e,t){const s=e.text,n=[we(t.id,e.places),t.technical?me(t.sync_state,s):""].filter(Boolean).join(" · "),i=e.rights.call&&t.online&&t.call_state==="ringing"&&G(e.policy,e.rights);return o`<div class="row" data-wk-station=${t.id} data-status=${ct(t)}>
    <button type="button" class="rowmain" data-wk-open=${t.id} @click=${()=>e.open(t.id)}>
      ${on(e,t)}
      <span class="rowtext"><span class="t"><span class="sdot ${t.online?"":"off"}" aria-hidden="true"></span><b>${t.name}</b></span>${n?o`<span class="s">${n}</span>`:l}</span>
    </button>
    <div class="rowside">
      ${$e(e,t)}
      <span class="seen">${s.seen.prefix} <bdi>${W(e,t)}</bdi></span>
      <div class="rowacts">
        ${i?te(e,t,"answer","ok","phone",s.call.answer):l}${Oe(e,t)}
      </div>
      <sw-icon name="chevron" size=${16} aria-hidden="true"></sw-icon>
    </div>
  </div>`}function pn(e,t){return o`<sw-card flush class="rows-card"><div class="rows" data-wk-rows>${nt(t,s=>s.id,s=>un(e,s))}</div></sw-card>`}function wn(e,t){return o`<div class="grid" data-wk-grid>${nt(t,s=>s.id,s=>hn(e,s))}</div>`}function mn(e,t){const s=e.text,a=d=>d,n=t.some(d=>d.technical),i=o`<span style="color:var(--sw-text-3)">—</span>`,r=e.table==="compact"||e.table==="none",c=[{key:"name",label:s.table.station,render:d=>o`<wk-action-button tone="quiet" data-wk-open=${a(d).id} @click=${()=>e.open(a(d).id)}>${a(d).name}</wk-action-button>`},{key:"status",label:s.table.status,render:d=>{const u=a(d),m=o`<sw-badge kind=${u.online?"live":"offline"} label=${u.online?s.status.online:s.status.offline}></sw-badge>`;if(!r)return m;const w=$e(e,u,!0),v=u.online?l:o`<small style="color:var(--sw-text-3);font-size:var(--sw-fs-xs)"><bdi>${W(e,u)}</bdi></small>`;return w===l&&v===l?m:o`<span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:var(--sw-s-1)">${m}${w}${v}</span>`}}];return r||c.push({key:"call",label:s.table.call,render:d=>$e(e,a(d),!0)}),c.push({key:"actions",label:s.table.actions,render:d=>{const u=a(d),m=e.rights.call&&u.online&&u.call_state==="ringing"&&G(e.policy,e.rights);return o`<span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:var(--sw-s-2);max-inline-size:190px">${m?te(e,u,"answer","ok","phone",s.call.answer):l}${Oe(e,u)}</span>`}}),r||c.push({key:"place",label:s.table.place,render:d=>o`<span style="display:inline-block;white-space:normal;max-inline-size:130px;vertical-align:middle">${we(a(d).id,e.places)||"—"}</span>`},{key:"seen",label:s.table.seen,render:d=>o`<bdi>${W(e,a(d))}</bdi>`}),e.table==="full"&&c.push({key:"doors",label:s.table.doors,render:d=>o`<span style="display:inline-block;white-space:normal;max-inline-size:120px;vertical-align:middle">${ne(a(d)).map(u=>Se(u,s)).join(", ")||"—"}</span>`}),n&&(c.push({key:"sync",label:s.table.sync,render:d=>a(d).technical?o`<sw-badge kind=${ze(a(d).sync_state)} label=${me(a(d).sync_state,s)}></sw-badge>`:i}),e.table==="full"&&c.push({key:"model",label:s.table.model,ltr:!0,render:d=>{const u=a(d).technical;return u?.model||u?.firmware?o`<span style="display:inline-block;vertical-align:middle">${u.model?o`<span style="display:block">${u.model}</span>`:l}${u.firmware?o`<span style="display:block;color:var(--sw-text-3)">${u.firmware}</span>`:l}</span>`:i}})),c}function fn(e,t){const s=t.technical;if(!s)return l;const a=e.text,n=s.reconciled_at&&/(Z|[+-]\d\d:\d\d)$/.test(s.reconciled_at)?bs(Date.parse(s.reconciled_at),e.now,ft(e,t)??void 0,a):"",i=s.clock?.skew_seconds,r=i==null?"":Math.abs(i)<=2?a.tech.clockOk:p(a.tech.clockDrift,{n:Math.round(i)}),c=s.event_status?.stream,d=c?c==="connected"?a.tech.streamOk:["disconnected","unavailable","stopped","authentication_failed"].includes(c)?a.tech.streamDown:a.tech.streamUnknown:"";return o`<section class="dsec" data-wk-dsec="technical">
    <h4><sw-icon name="cpu" size=${14}></sw-icon>${a.drawer.technical}</h4>
    <dl class="kv">
      <dt>${a.tech.sync}</dt>
      <dd><sw-badge kind=${ze(t.sync_state)} label=${me(t.sync_state,a)}></sw-badge>${n?o` · <bdi>${n}</bdi>`:l}</dd>
      ${s.model?o`<dt>${a.tech.model}</dt><dd><code>${s.model}</code></dd>`:l}
      ${s.firmware?o`<dt>${a.tech.firmware}</dt><dd><code>${s.firmware}</code></dd>`:l}
      <dt>${a.tech.relays}</dt>
      <dd>${p(a.tech.relaysValue,{n:t.locks.length,mode:t.lock_enabled?a.tech.relayOn:a.tech.relayOff})}</dd>
      ${sn(t.id)}
      ${r?o`<dt>${a.tech.clock}</dt><dd>${r}</dd>`:l} ${d?o`<dt>${a.tech.stream}</dt><dd>${d}</dd>`:l}
      ${t.errors?o`<dt>${a.tech.lastError}</dt><dd>${t.errors.last_error?o`<code data-wk-last-error>${t.errors.last_error}</code>`:o`<span class="muted">${a.tech.none}</span>`}</dd>`:l}
      ${t.errors?.scan_error?o`<dt>${a.tech.scanError}</dt><dd><code>${t.errors.scan_error}</code></dd>`:l}
    </dl>
    <wk-deep-links place="station"></wk-deep-links>
    <wk-station-maintenance .station=${t} ?live=${e.live}></wk-station-maintenance>
  </section>`}function yt(e,t){const s=e.text.prog;if(t.state==="ready")return l;const a=t.state==="unsupported"?s.unsupported:t.state==="busy"?s.busy:t.state==="error"?s.unavailable:s.loading;return o`<div class="muted" role="status" data-wk-fetch=${t.state}>${a}${t.state==="error"||t.state==="busy"?o` · <wk-action-button tone="quiet" @click=${()=>e.retryDetail()}>${e.text.retry}</wk-action-button>`:l}</div>`}function gn(e,t,s){const a=e.text;if(!s||s.programs.state!=="ready")return s?yt(e,s.programs):o`<div class="muted" role="status" data-wk-fetch="loading">${a.prog.loading}</div>`;const n=ks(s.programs.data,t,a);return n.length?o`${n.map(i=>o`<div class="prog" data-wk-program=${i.door}>
      <div class="ph">
        <span>${i.name}</span>
        ${i.none?o`<sw-badge kind="neutral" label=${a.prog.none}></sw-badge>`:o`<sw-badge kind=${i.removing?"stale":i.enabled?"live":"offline"} label=${i.removing?a.prog.removing:i.enabled?a.prog.on:a.prog.off}></sw-badge>${i.status&&i.enabled&&!i.removing?o`<sw-badge kind="recorded" label=${i.status}></sw-badge>`:l}`}
      </div>
      ${i.hours.map(r=>o`<div class="line">${a.prog.hours}: <bdi>${r}</bdi></div>`)}
      ${i.holidays?o`<div class="line muted">${p(a.prog.holidays,{n:i.holidays})}</div>`:l}
      ${i.error?o`<div class="line"><sw-badge kind="error" label=${a.prog.error}></sw-badge></div>`:l}
      ${!i.none&&i.unreadable?o`<div class="line muted">${a.prog.unknownShape}</div>`:l}
    </div>`)}`:l}function vn(e,t){const s=e.text;if(!t)return l;if(t.codes.state!=="ready")return o`<div class="prog">${yt(e,t.codes)}</div>`;const a=ys(t.codes.data,s);return o`<div class="prog" data-wk-codes=${a.state}>
    <div class="ph"><span>${s.prog.codes}</span><sw-badge kind=${a.state==="set"?"live":a.state==="unset"?"offline":"unknown"} label=${a.label}></sw-badge></div>
    ${a.slots.length>1?a.slots.map(n=>o`<div class="line">${n.label}: ${n.state==="set"?s.prog.codeConfigured:n.state==="unset"?s.prog.codeNotConfigured:s.prog.codeUnknown}</div>`):l}
  </div>`}function bn(e,t){if(!t.technical)return l;const s=e.features.door_programs!==!1,a=e.features.public_codes!==!1;if(!s&&!a)return l;const n=e.text,i=e.detail[t.id];return o`<section class="dsec" data-wk-dsec="settings">
    <button type="button" class="toggle" aria-expanded=${String(e.detailOpen)} data-wk-settings-toggle @click=${()=>e.toggleDetail()}>
      <sw-icon name="chevronDown" size=${14}></sw-icon><span>${n.drawer.doorSettings}</span>
    </button>
    ${e.detailOpen?o`${s&&ne(t).length?gn(e,t,i):l}${a?vn(e,i):l}`:l}
    ${e.detailOpen?o`<wk-door-tech .station=${t} ?live=${e.live} @door-tech-changed=${()=>e.retryDetail()}></wk-door-tech>`:l}
  </section>`}function kn(e,t){const s=fs(t.id,Pe.events==="smplwise",T("access.events.read")),a=gs(t,Pe.schedules==="smplwise",T("access.stations.read"));return!s&&!a?l:o`<div class="evlink">
    ${s?o`<wk-action-button tone="quiet" icon="history" href=${s} data-wk-station-events=${t.id}>${vs("stationEvents")}</wk-action-button>`:l}
    ${a?o`<wk-action-button tone="quiet" icon="calendar" href=${a} data-wk-station-schedules=${t.id}>${e.text.drawer.schedules}</wk-action-button>`:l}
  </div>`}function yn(e,t){const s=e.text,a=Ce(e,t),n=we(t.id,e.places),i=ne(t),r=e.rights.call||G(e.policy,e.rights)&&(t.online?["ringing","in_call","ending"].includes(t.call_state):!1),c=t.online&&["ringing","in_call","ending"].includes(t.call_state),d=e.actions.tts[t.id],u=d?lt(d,s):"",m=e.liveArea?.(t)??null,w=e.rights.call&&t.online?e.dialControl?.(t,c):void 0;return o`
    ${m??o`<div class="live ${t.online?"":"off"}" data-wk-live data-still-state=${a}>
      ${a==="image"?o`<img src=${Te(e,t)} alt=${p(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:gt(e,t,a)}
      ${a==="image"?o`<span class="stamp"><bdi>${s.drawer.lastStill} · ${t.online?dt(e.poster):W(e,t)}</bdi></span>`:l}
      <div class="ov"><span class="t"><sw-icon name="play" size=${16}></sw-icon>${s.drawer.liveClassic}</span><wk-action-button icon="window" href=${K()} data-wk-classic-link>${s.drawer.openClassic}</wk-action-button></div>
    </div>`}
    <div class="meta">${n?o`<span>${n}</span>`:l}<span>${s.seen.prefix} <bdi>${W(e,t)}</bdi></span></div>
    ${kn(e,t)}
    ${kt(e,t,!0)}
    ${r?o`<section class="dsec" data-wk-dsec="call">
          <h4>${ae("phone",14)}${s.drawer.call}</h4>
          ${c?o`${bt(e,t,!0)}${t.call_state==="in_call"?vt(e,t,!0):l}`:o`<div class="callrow"><span class="cs muted">${s.call.none}</span>${e.rights.call&&t.online&&w===void 0?o`<wk-action-button tone="dashed" icon="phone" href=${K()} data-wk-dial>${s.call.dial}</wk-action-button>`:l}</div>`}
          ${w??l}
        </section>`:l}
    ${i.length||e.rights.door?o`<section class="dsec" data-wk-dsec="doors">
          <h4><sw-icon name="door" size=${14}></sw-icon>${s.drawer.doors}</h4>
          ${i.length?i.map(v=>{const z=e.detail[t.id]?.programs.data?.programs.find(q=>q.door===v.physical_index)?.execution?.status==="held_acknowledged";return o`<div class="doorrow" data-wk-doorrow=${v.physical_index}>
                  <span class="dn">${Se(v,s)}</span>
                  <span class="ds">${z?o`<sw-icon name="clock" size=${12}></sw-icon>${s.prog.state.held_acknowledged}`:l}</span>
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
          <div class="callrow"><span class="cs muted" data-wk-announce-state>${u||s.drawer.announceHint}</span><wk-action-button icon="volume" data-wk-announce-at=${t.id} ?disabled=${!e.live||!t.online} @click=${pe(()=>e.announce(t.id))}>${s.announce}</wk-action-button></div>
        </section>`:l}
    ${tn(t.id,t.zone)}
    ${fn(e,t)} ${bn(e,t)}
  `}var $n=Object.defineProperty,xn=Object.getOwnPropertyDescriptor,k=(e,t,s,a)=>{for(var n=a>1?void 0:a?xn(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&$n(t,s,n),n};const $t="sw.wiskey.stations.view",xt="sw.wiskey.stations.treeCollapsed",Xe=3e4;function _t(e){try{return localStorage.getItem(e)}catch{return null}}function Qe(e,t){try{localStorage.setItem(e,t)}catch{}}const _n=()=>{const e=_t($t);return e==="list"||e==="table"?e:"cards"},Sn=()=>{try{const e=JSON.parse(_t(xt)??"[]");return new Set(Array.isArray(e)?e.filter(t=>typeof t=="string"):[])}catch{return new Set}},ce={kind:"iana",name:"Asia/Jerusalem"},et=[{id:"d1",name:"שער ראשי",online:!0,call_state:"ringing",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:ce,technical:null,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:ce,technical:null,errors:null},{id:"d3",name:"חניון",online:!0,call_state:"idle",sync_state:"pending",lock_enabled:!1,locks:[],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:ce,technical:null,errors:null},{id:"d4",name:"מחסן",online:!1,call_state:"unavailable",sync_state:"offline",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!1,camera_entity:null,last_seen:"2026-09-26T19:02:00+03:00",zone:ce,technical:null,errors:null}];let b=class extends N{constructor(){super(...arguments),this.feed=null,this.error="",this.forbidden=!1,this.filter="all",this.query="",this.view=_n(),this.place="all",this.places=null,this.collapsed=Sn(),this.selected=null,this.sheet=!1,this.announceOpen=!1,this.announceFor="",this.policy=$s,this.features={},this.detail={},this.detailOpen=!1,this.now=Date.now(),this.poster=Date.now(),this.failed={},this.table=Re(typeof window>"u"?1440:window.innerWidth),this.mediaMode="off",this.media={},this.mediaAt={},this.clock=new xs,this.actions=new ue({release:(e,t)=>Kt(e,t),signal:(e,t)=>Ut(e,t),station:e=>this.list().find(t=>t.id===e),live:()=>this.isLive(),now:()=>Date.now(),tick:()=>performance.now(),after:(e,t)=>window.setTimeout(e,t),cancel:e=>window.clearTimeout(e),changed:()=>this.requestUpdate(),refetch:()=>void this.load(),stamp:()=>Bt(new Date)}),this.stop=null,this.stopRoute=null,this.poll=0,this.tickTimer=0,this.posterTimer=0,this.loading=!1,this.loadAgain=!1,this.placesKey="",this.detailAt={},this.mqc=typeof matchMedia=="function"?matchMedia(`(max-width: ${_s}px)`):null,this.mqm=typeof matchMedia=="function"?matchMedia(`(max-width: ${Ss}px)`):null,this.mqn=typeof matchMedia=="function"?matchMedia(`(max-width: ${zs-1}px)`):null,this.onMedia=()=>{this.table=Re(window.innerWidth)}}connectedCallback(){if(super.connectedCallback(),this.mqc?.addEventListener("change",this.onMedia),this.mqm?.addEventListener("change",this.onMedia),this.mqn?.addEventListener("change",this.onMedia),this.stopRoute=Vt(e=>this.onRoute(e)),!!ee()){if(!T("access.read")){this.forbidden=!0;return}this.load(),this.readFeatures(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.poster=Date.now())},Cs),this.stop=Yt(e=>{e.type==="intercom_tts"?this.actions.noteTts(e.status):e.type!=="heartbeat"&&this.load()},e=>{this.setPolling(!e),e&&this.load()}),this.schedule()}}disconnectedCallback(){super.disconnectedCallback(),this.mqc?.removeEventListener("change",this.onMedia),this.mqm?.removeEventListener("change",this.onMedia),this.mqn?.removeEventListener("change",this.onMedia),this.stop?.(),this.stop=null,this.stopRoute?.(),this.stopRoute=null,this.setPolling(!1),window.clearInterval(this.posterTimer),window.clearTimeout(this.tickTimer),this.actions.dispose()}updated(e){(e.has("selected")||e.has("detailOpen"))&&this.maybeLoadDetail(),(e.has("selected")||e.has("mediaMode"))&&this.maybeLoadMedia()}setPolling(e){window.clearInterval(this.poll),this.poll=e?window.setInterval(()=>void this.load(),Ts):0}schedule(){window.clearTimeout(this.tickTimer),this.tickTimer=window.setTimeout(()=>{this.now=Date.now(),this.clock.observe(this.list(),this.now),this.actions.prune(),this.schedule()},this.clock.active?1e3:2e4)}onRoute(e){if(e.mode!=="wiskey")return;const t=e.params.get("station");t&&t!==this.selected?(this.selected=t,this.detailOpen=!1):!t&&this.selected&&(this.selected=null,this.detailOpen=!1)}demo(){return!ee()}list(){return this.demo()?et:this.feed?.stations??[]}isLive(){return!this.demo()&&this.feed?.state==="ready"&&this.feed.fresh!==!1}rights(){return this.demo()?Os:As(Ee,this.policy,T)}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{const e=await as();this.feed=e,this.error="",this.forbidden=!1,this.afterLoad(e)}catch(e){e instanceof B&&e.status===403?this.forbidden=!0:this.error=xe(e)}}while(this.loadAgain)}finally{this.loading=!1}}afterLoad(e){this.now=Date.now(),this.clock.observe(e.stations??[],this.now),this.actions.dropStaleArm(),this.readPolicy(),this.ensurePlaces(e.stations??[]),this.maybeLoadMedia(),this.schedule()}async readPolicy(){try{const e=await Gt();this.policy=Ps(e),this.mediaMode=Jt(e)}catch{}}async readFeatures(){try{const e=await ns();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([t,s])=>[t,s.available]))}catch{}}async ensurePlaces(e){const t=e.filter(a=>a.camera_entity),s=t.map(a=>`${a.id}:${a.camera_entity}`).sort().join("|");if(s!==this.placesKey){if(this.placesKey=s,!t.length||!T("devices.read")){this.places=null;return}try{const[a,n]=await Promise.all([Zt(),Xt(t.map(i=>i.camera_entity))]);if(s!==this.placesKey)return;this.places=Es(e,a,n.entities)}catch{this.places=null}}}maybeLoadDetail(){const e=this.selected;if(!e||!this.detailOpen||this.demo()||!this.list().find(a=>a.id===e)?.technical)return;const s=this.detailAt[e]??0;this.detail[e]&&Date.now()-s<Xe||this.loadDetail(e)}async loadDetail(e){this.detailAt={...this.detailAt,[e]:Date.now()};const t={state:"loading",data:null};this.detail={...this.detail,[e]:{programs:t,codes:t}};const s=n=>this.detail={...this.detail,[e]:{...this.detail[e],...n}},a=(n,i)=>n.state==="ready"&&i?{state:"ready",data:i}:n.state==="unsupported"?{state:"unsupported",data:null}:n.last_error==="busy"||n.last_error==="rate_limited"||n.last_error==="timeout"?{state:"busy",data:null}:{state:"error",data:null};if(this.features.door_programs!==!1)try{const n=await ot(e);s({programs:a(n,n.programs)})}catch{s({programs:{state:"error",data:null}})}else s({programs:{state:"unsupported",data:null}});if(this.features.public_codes!==!1)try{const n=await rt(e);s({codes:a(n,n.codes)})}catch{s({codes:{state:"error",data:null}})}else s({codes:{state:"unsupported",data:null}})}maybeLoadMedia(){const e=this.selected;!e||this.mediaMode==="off"||this.demo()||this.media[e]!==void 0&&Date.now()-(this.mediaAt[e]??0)<Xe||(this.mediaAt={...this.mediaAt,[e]:Date.now()},Qt(e).then(t=>this.media={...this.media,[e]:t}).catch(()=>this.media={...this.media,[e]:null}))}posterOf(e){return!e.camera_entity||this.demo()||!De("go2rtc")||this.failed[e.id]===this.poster?"":it(e.id,this.poster)}liveArea(e,t){if(this.mediaMode==="off")return null;const s=this.media[e.id];if(!s||s.state!=="ready")return null;const a=!!s.video?.allowed&&Object.keys(s.video.paths).length>0;if(!a&&!s.talk?.available)return null;const n=!t.rights.call,i=n&&t.rights.talk&&!s.talk?.available;return o`<wk-station-live
      data-wk-live-native
      .stationId=${e.id}
      .stationName=${e.name}
      .media=${a?s:{...s,video:null}}
      .poster=${this.posterOf(e)}
      .live=${t.live&&e.online}
      .talkHere=${n}
      .classicHref=${i?K():""}
      .classicLabel=${t.text.talk.classic}
    ></wk-station-live>`}dialControl(e,t,s){const a=Le(this.mediaMode,this.media[e.id]);if(a.kind==="legacy")return;const n=Q().dial;return a.kind==="native"?o`<div class="dialnative">
        <wk-talk-button
          dial
          data-wk-dial="native"
          .stationId=${e.id}
          .talk=${this.media[e.id]?.talk??null}
          .live=${s.live&&e.online}
          .idleLabel=${t?n.talk:n.dial}
        ></wk-talk-button>
        <wk-action-button tone="quiet" icon="window" href=${K()} data-wk-dial-classic="secondary">${n.classic}</wk-action-button>
      </div>`:o`<div class="callrow" data-wk-dial="reason" data-reason=${a.reason}>
      <span class="cs muted dialwhy" data-wk-dial-reason role="status">${n.reasons[a.reason]}</span>
      <wk-action-button tone="dashed" icon="window" href=${K()} data-wk-dial-classic>${n.classic}</wk-action-button>
    </div>`}talkControl(e,t,s){if(this.mediaMode==="video_talk")return t?Le(this.mediaMode,this.media[e.id]).kind!=="legacy"&&s.rights.call?l:this.liveArea(e,s)?l:void 0:!T("access.call")||!e.online?void 0:o`<wk-action-button icon="mic" data-wk-talk="drawer" label=${Q().talk.openDrawer} @click=${a=>{a.stopPropagation(),this.open(e.id)}}>${Q().talk.openDrawer}</wk-action-button>`}open(e){this.selected!==e&&(this.selected=e,this.detailOpen=!1,this.syncRoute(e))}closeDrawer(){this.selected=null,this.detailOpen=!1,this.syncRoute(null)}syncRoute(e){const t=es();if(t.mode!=="wiskey")return;const s=new URLSearchParams(t.params);e?s.set("station",e):s.delete("station"),ts(t.path,s)}setView(e){this.view=e,Qe($t,e)}toggleFloor(e){const t=new Set(this.collapsed);t.has(e)?t.delete(e):t.add(e),this.collapsed=t,Qe(xt,JSON.stringify([...t]))}pickPlace(e){this.place=e,this.sheet=!1}ctx(){const e=this.features,t={text:S(),now:this.now,defaultZone:this.feed?.default_zone??null,live:this.isLive(),rights:this.rights(),policy:this.policy,places:this.places,actions:this.actions,clock:this.clock,table:this.table,media:this.demo()?!1:De("go2rtc"),poster:this.poster,failed:this.failed,selected:this.selected,detail:this.detail,detailOpen:this.detailOpen,features:e,open:s=>this.open(s),door:(s,a)=>void this.actions.askRelease(s.id,a),call:(s,a,n)=>this.actions.tapCall(s.id,a,n.detail),announce:s=>{this.announceFor=s,this.announceOpen=!0},stillError:(s,a)=>this.failed={...this.failed,[s]:a},toggleDetail:()=>this.detailOpen=!this.detailOpen,retryDetail:()=>{this.selected&&this.loadDetail(this.selected)}};return this.mediaMode!=="off"&&(t.liveArea=s=>this.liveArea(s,t),t.talkControl=(s,a)=>this.talkControl(s,a,t),t.dialControl=(s,a)=>this.dialControl(s,a,t)),t}render(){const e=S();if(this.forbidden&&ee())return o`<sw-page heading=${e.title}><div data-wk-stations data-wk-state="forbidden"><sw-state-panel state="forbidden" heading=${e.states.forbidden} data-wk-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return o`<sw-page heading=${e.title}><div data-wk-stations data-wk-state=${this.error?"error":"loading"}>${this.error?o`<sw-state-panel state="error" heading=${e.states.error} hint=${this.error} actionLabel=${e.retry} data-wk-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:o`<sw-state-panel state="loading" heading=${e.states.loading} data-wk-panel="loading"></sw-state-panel>`}</div></sw-page>`;const t=this.demo()?et:this.feed.stations;if(t===null){const s=this.feed.state==="ready"?"error":this.feed.state,a=Ds(s,e);return o`<sw-page heading=${e.title}>
        ${this.renderFeedBadge()}
        <div data-wk-stations data-wk-state=${`feed:${this.feed.state}`}>
          <sw-state-panel icon="door" state=${a.panel} heading=${a.heading} actionLabel=${a.settings&&Ee("system.configure")?e.states.toSettings:""} data-wk-panel=${`feed:${this.feed.state}`} @action=${()=>window.location.hash="#/system/diagnostics?tab=access-control"}></sw-state-panel>
        </div>
      </sw-page>`}return this.renderReady(t)}renderFeedBadge(){const e=S();if(this.demo())return o`<sw-badge slot="actions" kind="neutral" label=${e.demo} data-wk-feed="demo"></sw-badge>`;const t=this.feed;if(!t)return l;const s=t.state==="ready"&&t.fresh!==!1,a=s?"live":t.state==="connecting"?"unknown":t.state==="forbidden"?"forbidden":t.state==="error"?"error":t.stations?"stale":"offline",n=s?e.feed.live:t.state==="connecting"?e.feed.connecting:t.stations&&t.fetched_at?p(e.feed.stale,{ago:Ls(t.fetched_at,this.now,e)||"…"}):e.feed.off;return o`<sw-badge slot="actions" kind=${a} label=${n} data-wk-feed=${s?"live":t.state}></sw-badge>`}effectiveView(){return this.table==="none"&&this.view==="table"?"list":this.view}renderReady(e){const t=S(),s=this.ctx(),a=Ns(e,this.places,this.collapsed,t),n=a.length>0,i=n&&a.some(f=>f.id===this.place)?this.place:"all",r=Ms(e,this.filter,this.query,i,this.places),c=Rs(e),d=this.effectiveView(),u=e.filter(ht).length,m=e.some(f=>f.online),w=e.length?"ready":"empty",v=a.find(f=>f.id===i)?.name??t.places.all;return o`<sw-page wide heading=${t.title} subheading=${Is(c,t)}>
      ${this.renderFeedBadge()}<wk-deep-links slot="actions" place="stations" mode="menu"></wk-deep-links>
      <div data-wk-stations data-wk-state=${w} data-view=${d} data-live=${String(s.live)}>
        ${e.length?o`<div class="toolbar">
              <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wk-search aria-label=${t.searchLabel} placeholder=${t.searchLabel} .value=${this.query} @input=${f=>this.query=f.target.value} /></label>
              ${s.rights.announce&&m?o`<wk-action-button icon="volume" data-wk-announce ?disabled=${!s.live} label=${t.announce} @click=${()=>s.announce("")}><span class="lbl">${t.announce}</span></wk-action-button>`:l}
              <wk-stations-maintenance .stations=${e} ?live=${s.live}></wk-stations-maintenance>
              <sw-view-switch data-wk-views label=${t.views.label} .value=${d} .options=${[{id:"cards",label:t.views.cards,icon:"grid"},{id:"list",label:t.views.list,icon:"list"},...this.table==="none"?[]:[{id:"table",label:t.views.table,icon:"table"}]]} @change=${f=>this.setView(f.detail)}></sw-view-switch>
            </div>`:l}
        <div class="layout ${n?"":"no-tree"}">
          ${n?o`<aside class="treecol"><sw-card flush><sw-place-tree data-wk-tree .rows=${a} .selected=${i} heading=${t.places.title} foldLabel=${t.places.fold} unfoldLabel=${t.places.unfold} @place-select=${f=>this.pickPlace(f.detail)} @place-toggle=${f=>this.toggleFloor(f.detail)}></sw-place-tree></sw-card></aside>`:l}
          <section class="main">
            ${e.length?o`<div class="chips" role="group" aria-label=${t.filters.label}>
                  ${n?o`<button type="button" class="chip places" data-wk-places-chip @click=${()=>this.sheet=!0}><sw-icon name="pin" size=${14}></sw-icon>${t.places.chip}: ${v}<sw-icon name="chevronDown" size=${12}></sw-icon></button>`:l}
                  ${qs.map(f=>o`<button type="button" class="chip" data-wk-filter=${f} aria-pressed=${String(this.filter===f)} @click=${()=>this.filter=f}>
                      ${f==="in_call"?ae("phone",14):l}${f==="all"?t.filters.all:f==="online"?t.filters.online:f==="attention"?t.filters.attention:t.filters.inCall}
                    </button>`)}
                </div>`:l}
            ${u&&d==="cards"&&s.rights.call?o`<div class="strip" role="status" data-wk-strip>
                  <span class="dot" aria-hidden="true"></span><span>${u===1?t.strip.one:p(t.strip.many,{n:u})}</span><span class="sp"></span>
                  <wk-action-button tone="quiet" icon="list" data-wk-strip-list @click=${()=>this.setView("list")}>${t.strip.toList}</wk-action-button>
                </div>`:l}
            ${this.renderContent(s,e,r,d)}
          </section>
        </div>
      </div>
      ${this.renderSheet(a,i)} ${this.renderDrawer(s,e)} ${this.selected?l:this.renderDialogs(s,e)}
    </sw-page>`}renderContent(e,t,s,a){const n=e.text;return t.length?s.length?a==="table"?o`<sw-table class="tbl" dense data-wk-table .columns=${mn(e,t)} .rows=${s} .selected=${this.selected} @row-select=${i=>this.open(i.detail.id)}></sw-table>`:a==="list"?pn(e,s):wn(e,s):o`<sw-state-panel icon="door" compact state="empty" heading=${n.states.emptyFilter} data-wk-panel="empty-filter"></sw-state-panel>`:o`<sw-state-panel icon="door" state="empty" heading=${n.states.empty} data-wk-panel="empty"></sw-state-panel>`}renderSheet(e,t){const s=S();return e.length?o`<sw-drawer modal ?open=${this.sheet} heading=${s.places.sheet} data-wk-places-sheet @close=${a=>a.target===a.currentTarget&&(this.sheet=!1)}>
      <sw-place-tree .rows=${e} .selected=${t} heading=${s.places.title} foldLabel=${s.places.fold} unfoldLabel=${s.places.unfold} @place-select=${a=>this.pickPlace(a.detail)} @place-toggle=${a=>this.toggleFloor(a.detail)}></sw-place-tree>
    </sw-drawer>`:l}renderDrawer(e,t){const s=e.text,a=this.selected,n=a?t.find(r=>r.id===a):void 0,i=n?n.online?"live":"offline":"neutral";return o`<sw-drawer modal ?open=${!!a} heading=${n?.name??s.drawer.notFound} data-wk-drawer data-wk-drawer-station=${a??""} @close=${r=>r.target===r.currentTarget&&this.closeDrawer()}>
      ${a&&n?o`<sw-badge slot="action" kind=${i} label=${n.online?s.status.online:s.status.offline}></sw-badge>`:l}
      ${a?n?yn(e,n):o`<sw-state-panel compact state="forbidden" heading=${s.drawer.notFoundHint} data-wk-panel="scoped"></sw-state-panel>`:l}
      ${a?this.renderDialogs(e,t):l}
    </sw-drawer>`}renderDialogs(e,t){return o`${this.renderConfirm(e,t)}
    <wk-announce-dialog
      ?open=${this.announceOpen}
      .stations=${t}
      .places=${this.places}
      .scope=${this.policy.announceScope}
      .phrases=${Fs(this.policy,e.text)}
      .preselect=${this.announceFor}
      .tts=${this.actions.tts}
      @tts-status=${s=>this.actions.noteTts(s.detail)}
      @close=${s=>{s.target===s.currentTarget&&(this.announceOpen=!1)}}
    ></wk-announce-dialog>`}renderConfirm(e,t){const s=this.actions.confirm;if(!s)return l;const a=t.find(u=>u.id===s.stationId);if(!a)return l;const n=e.text,i=a.locks.find(u=>u.physical_index===s.lock)?.name?.trim(),r=Hs(a.name),c=i?p(n.door.confirmNamed,{door:i,inPlace:r}):p(n.door.confirmPlain,{inPlace:r}),d=this.actions.releasing.has(`${a.id}/${s.lock}`);return o`<sw-dialog open ?locked=${d} heading=${n.door.confirmTitle} data-wk-release-dialog @close=${u=>u.target===u.currentTarget&&this.actions.cancelRelease()}>
      <p class="sentence" data-wk-release-sentence>${c}</p>
      <div slot="footer">
        <wk-action-button data-wk-release-cancel ?disabled=${d} @click=${()=>this.actions.cancelRelease()}>${n.door.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon="unlock" data-wk-release-confirm ?busy=${d} ?disabled=${d||!e.live} @click=${()=>void this.actions.confirmRelease()}>${d?n.door.sending:n.door.send}</wk-action-button>
      </div>
    </sw-dialog>`}};b.styles=Ca;k([h()],b.prototype,"feed",2);k([h()],b.prototype,"error",2);k([h()],b.prototype,"forbidden",2);k([h()],b.prototype,"filter",2);k([h()],b.prototype,"query",2);k([h()],b.prototype,"view",2);k([h()],b.prototype,"place",2);k([h()],b.prototype,"places",2);k([h()],b.prototype,"collapsed",2);k([h()],b.prototype,"selected",2);k([h()],b.prototype,"sheet",2);k([h()],b.prototype,"announceOpen",2);k([h()],b.prototype,"announceFor",2);k([h()],b.prototype,"policy",2);k([h()],b.prototype,"features",2);k([h()],b.prototype,"detail",2);k([h()],b.prototype,"detailOpen",2);k([h()],b.prototype,"now",2);k([h()],b.prototype,"poster",2);k([h()],b.prototype,"failed",2);k([h()],b.prototype,"table",2);k([h()],b.prototype,"mediaMode",2);k([h()],b.prototype,"media",2);b=k([M("wiskey-stations")],b);export{b as WiskeyStations};
//# sourceMappingURL=wiskey-stations-CcwPdXdD.js.map
