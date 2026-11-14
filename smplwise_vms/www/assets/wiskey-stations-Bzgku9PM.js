import{E as j,F as g,G as u,a as F,cf as Ct,Y as $e,K as xe,A as l,e as o,H as I,a7 as G,cg as at,$ as nt,j as B,g as _e,l as O,ch as Tt,ci as Ot,cj as Pt,ca as At,P as Pe,ck as Et,cl as de,cm as Dt,cn as Lt,co as Ae,i as X,ab as Mt,cp as Nt,cq as Rt,cr as Ft,cs as It,a6 as qt,ct as it,cu as pe,a3 as ot,cv as Ee,n as Ht,cw as jt,cx as Bt,cy as Wt,cz as Ut,be as De,cA as Kt,cB as Gt,cC as Vt,ax as Yt,bZ as Le,cD as Me,bj as Zt,r as Jt}from"./index-k1cto_iv.js";import"./sw-table-CwhWVtZq.js";import"./sw-place-tree-DbSXmiwf.js";import"./sw-view-switch-CJgil170.js";import"./sw-pager-syP9MpoI.js";import{a as Xt,g as rt,b as lt,c as Qt,d as es}from"./access-stations-1948brgu.js";import{T as Ne,p as ts,r as ss,l as as,t as ns,a as ie,f as Re}from"./tts-default-BdUzH1g6.js";import{a as is,w as z,t as Fe,T as oe,c as Ie,f as p,b as dt,s as os,n as rs,l as ls,d as ds,e as cs,g as hs,h as us,A as ps,i as ws,U as ms,j as ee,k as fe,m as V,p as we,o as te,q as Se,r as ze,u as me,v as ct,x as U,y as ge,z as ht,B as fs,C as gs,D as vs,E as bs,F as ks,G as ys,H as ut,P as $s,I as qe,J as xs,K as _s,L as Ss,M as zs,N as Cs,O as Ts,Q as Os,R as Ps,S as As,V as Es,W as Ds,X as Ls,Y as Ms,Z as Ns,_ as Rs,$ as Fs,a0 as Is,a1 as qs,a2 as Hs}from"./access-parity-DrAYVlVx.js";import"./wk-talk-button-CVFvDfBJ.js";import"./wk-deep-links-bX6lYJJY.js";import{v as js}from"./wiskey-validation-BeZoSvoa.js";import"./sw-logo-art-Va6y_cIM.js";import"./schedules-logic-B_wmd4f6.js";import"./wiskey-format-DJ4vUeXA.js";import"./deep-links-DcLXvoYw.js";var Bs=Object.defineProperty,Ws=Object.getOwnPropertyDescriptor,y=(e,t,s,a)=>{for(var n=a>1?void 0:a?Ws(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&Bs(t,s,n),n};const Us=6e4;let b=class extends F{constructor(){super(...arguments),this.open=!1,this.stations=[],this.places=null,this.scope="scope",this.phrases=[],this.preselect="",this.tts={},this.engines=null,this.enginesNote="",this.engine="",this.language="",this.message="",this.choice="",this.sending=!1,this.result=null,this.locked=!1,this.retryAt=0,this.more=!1,this.sent=[],this.fixed=Ne,this.preselected="",this.missingEngine=null,this.missingLanguage=null,this.loadedEngines=!1,this.enginesAt=0,this.timer=0}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("open")&&this.open&&this.reset()}updated(e){e.has("open")&&this.open&&(!this.loadedEngines||Date.now()-this.enginesAt>Us?this.loadEngines():this.applyFixed())}reset(){this.message="",this.result=null,this.locked=!1,this.retryAt=0,this.sending=!1,this.more=!1,this.sent=[],this.choice=this.choices()[0]?.key??""}online(){return this.stations.filter(e=>e.online)}choices(){return is(this.online(),this.places,this.scope,this.preselect||void 0)}current(){const e=this.choices();return e.find(t=>t.key===this.choice)??e[0]}async loadEngines(){this.loadedEngines=!0,this.enginesAt=Date.now(),this.enginesNote="";try{const e=await Ct();e.tts&&e.tts.engines.length?(this.engines=e.tts,await this.applyFixed()):e.tts?this.enginesNote=z().announceDlg.noEngine:this.enginesNote=e.state==="unsupported"?z().announceDlg.enginesUnsupported:z().announceDlg.noEngine}catch(e){this.enginesNote=$e(e),this.loadedEngines=!1}}async applyFixed(){if(!this.engines?.engines.length)return;try{this.fixed=ts(await xe())}catch{this.fixed=Ne}const e=ss(this.engines,this.fixed);this.engine=e.engine,this.language=e.language,this.preselected=e.engine,this.missingEngine=e.missingEngine,this.missingLanguage=e.missingLanguage,e.missingEngine&&(this.more=!0)}pickEngine(e){this.engine=e,this.language=as(this.engines,e,this.fixed),this.missingLanguage=null}busySeconds(){return Math.max(0,Math.ceil((this.retryAt-Date.now())/1e3))}startRetryClock(){window.clearInterval(this.timer),this.timer=window.setInterval(()=>{this.busySeconds()<=0?(window.clearInterval(this.timer),this.retryAt=0):this.requestUpdate()},1e3)}ready(){const e=Fe(this.message);return!!this.engine&&e>0&&e<=oe&&!this.sending&&!this.locked&&this.busySeconds()===0&&!!this.current()?.stationIds.length}async send(){const e=this.current(),t=Ie(this.message);if(!this.ready()||!e)return;const s=z().announceDlg,a=e.stationIds.filter(r=>this.online().some(d=>d.id===r));if(!a.length){this.result={tone:"warn",text:s.noTargets};return}this.sending=!0,this.result=null;let n=[];try{n=await Xt({stationIds:a,engine_id:this.engine,language:this.language||null,message:t})}finally{this.sending=!1}for(const r of n)r.status&&this.dispatchEvent(new CustomEvent("tts-status",{detail:r.status,bubbles:!0,composed:!0}));this.sent=n.filter(r=>r.outcome==="sent").map(r=>r.station_id),this.result=this.summarize(n),n.some(r=>r.outcome==="unknown")&&(this.locked=!0);const i=n.filter(r=>r.code==="audio_busy").map(r=>r.retry_after_s??10);i.length&&!this.locked&&(this.retryAt=Date.now()+Math.min(...i)*1e3,this.startRetryClock())}summarize(e){const t=z().announceDlg,s=e.filter(i=>i.outcome==="sent"),a=e.filter(i=>i.outcome!=="sent"),n=i=>this.stations.find(r=>r.id===i)?.name??i;return a.length?e.some(i=>i.outcome==="unknown")?{tone:"warn",text:s.length?p(t.partial,{ok:s.length,bad:a.length,names:a.map(i=>n(i.station_id)).join(", ")})+" · "+t.unknown:t.unknown}:s.length?{tone:"warn",text:p(t.partial,{ok:s.length,bad:a.length,names:a.map(i=>n(i.station_id)).join(", ")})}:a.every(i=>i.code==="audio_busy")?{tone:"warn",text:t.busy}:{tone:"err",text:a[0].error??t.failed}:{tone:"ok",text:s.length===1?t.sentOne:p(t.sentMany,{n:s.length})}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}progress(){if(this.sent.length!==1)return"";const e=this.tts[this.sent[0]];return e?dt(e):""}renderResult(){if(!this.result)return l;const e=z().announceDlg,t=this.busySeconds(),s=this.progress()&&this.result.tone==="ok"?this.progress():this.result.text;return o`<div class="result ${this.result.tone}" role="status" data-wk-announce-result data-tone=${this.result.tone}>${s}${t>0?o` · ${p(e.busyIn,{n:t})}`:l}</div>`}render(){const e=z().announceDlg,t=ns().dialog,s=this.choices(),a=this.current(),n=Fe(this.message),r=this.engines?.engines.find(h=>h.engine_id===this.engine)?.supported_languages??[],d=this.phrases.length?this.phrases:e.phraseList,c=this.result?.tone==="ok"&&this.sent.length>0;return o`<sw-dialog ?open=${this.open} wide ?locked=${this.sending} heading=${e.title} data-wk-announce-dialog @close=${()=>this.close()}>
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
          <span class="cnt ${n>oe?"over":""}" aria-live="polite">${p(e.counter,{n,max:oe})}</span>
        </div>
        <div class="fld">
          <label>${e.phrases}</label>
          <div class="chips" role="group" aria-label=${e.phrases}>
            ${d.map(h=>o`<button type="button" class="chip" data-wk-phrase aria-pressed=${String(Ie(this.message)===h)} ?disabled=${this.sending||this.locked} @click=${()=>this.message=h}><span>${h}</span></button>`)}
          </div>
        </div>
        <div class="prev" data-wk-announce-preview>
          <sw-icon name="volume" size=${15}></sw-icon>
          <span>${p(e.preview,{lang:this.engine||!this.missingEngine?ie(this.language||"he"):"—",voice:e.voiceDefault,n:os(this.message)})}</span>
          <span class="sp"></span>
          <wk-action-button tone="quiet" data-wk-announce-more aria-expanded=${String(this.more)} @click=${()=>this.more=!this.more}>${e.more}</wk-action-button>
        </div>
        ${this.missingEngine?o`<div class="result warn" role="status" data-wk-announce-engine-missing>${Re(t.missingEngine,{engine:this.missingEngine})}</div>`:l}
        ${this.more?o`<div class="engine" data-wk-announce-engine>
                ${this.missingLanguage&&this.language?o`<div class="result warn" role="status" data-wk-announce-language-missing>${Re(t.missingLanguage,{language:ie(this.missingLanguage),auto:ie(this.language)})}</div>`:l}
                ${this.engines?.engines.length?o`<sw-field label=${e.engine}>
                        <select data-wk-engine .value=${this.engine} @change=${h=>this.pickEngine(h.target.value)}>
                          ${this.engine?l:o`<option value="" selected disabled>${t.pickEngine}</option>`}
                          ${this.engines.engines.map(h=>o`<option value=${h.engine_id} ?selected=${h.engine_id===this.engine}>${h.engine_id===this.fixed.engine?`${h.name} · ${t.fixedTag}`:h.name}</option>`)}
                        </select>
                      </sw-field>
                      ${r.length?o`<sw-field label=${e.language}>
                            <select data-wk-language .value=${this.language} @change=${h=>this.language=h.target.value}>
                              ${r.map(h=>o`<option value=${h} ?selected=${h===this.language}>${ie(h)}</option>`)}
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
  `;y([g({type:Boolean,reflect:!0})],b.prototype,"open",2);y([g({attribute:!1})],b.prototype,"stations",2);y([g({attribute:!1})],b.prototype,"places",2);y([g()],b.prototype,"scope",2);y([g({attribute:!1})],b.prototype,"phrases",2);y([g()],b.prototype,"preselect",2);y([g({attribute:!1})],b.prototype,"tts",2);y([u()],b.prototype,"engines",2);y([u()],b.prototype,"enginesNote",2);y([u()],b.prototype,"engine",2);y([u()],b.prototype,"language",2);y([u()],b.prototype,"message",2);y([u()],b.prototype,"choice",2);y([u()],b.prototype,"sending",2);y([u()],b.prototype,"result",2);y([u()],b.prototype,"locked",2);y([u()],b.prototype,"retryAt",2);y([u()],b.prototype,"more",2);y([u()],b.prototype,"sent",2);y([u()],b.prototype,"fixed",2);y([u()],b.prototype,"preselected",2);y([u()],b.prototype,"missingEngine",2);y([u()],b.prototype,"missingLanguage",2);b=y([I("wk-announce-dialog")],b);const pt=["sync","rescan","health_refresh","clock_refresh"],wt=e=>`access-control/stations/${encodeURIComponent(e)}/maintenance`,Ks=15e3,Gs=e=>_e(wt(e)),mt=(e,t)=>G(`${wt(e)}/${t}`,{confirmed:!0,client_request_id:nt(),expires_at:new Date(at()+Ks).toISOString().replace(/\.\d{3}Z$/,"Z")});function Vs(e,t,s){if(e instanceof B){const a=e.body?.details??{},n=String(a.outcome??""),i=n==="refused"?"failed":n==="not_sent"?"not_sent":n==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",r=Number(a.retry_after_s);return{station_id:t,action:s,status:i,code:String(a.wiskey_code??e.code??"")||null,retry_after_s:Number.isFinite(r)&&r>=0?r:null,data:null}}return{station_id:t,action:s,status:"unknown",code:"network",retry_after_s:null,data:null}}async function ft(e,t,s=mt){try{const a=await s(e,t);return{station_id:e,action:t,status:a.status,code:null,retry_after_s:null,data:a.data??null}}catch(a){return Vs(a,e,t)}}async function Ys(e,t,s=()=>{},a=mt,n=250,i=r=>new Promise(d=>setTimeout(d,r))){const r=[];for(let d=0;d<e.length;d++){d>0&&n>0&&await i(n);const c=await ft(e[d],t,a);r.push(c),s(c,d)}return r}function He(e,t,s){return e.filter(a=>t.has(a.id)&&(s==="sync"||a.online)).map(a=>a.id)}function ve(e,t){return e?t.reasons[e]??e:""}function be(e,t,s){const a=ve(t,s)||s.none;return e==="failed"?p(s.status.failed,{reason:a}):e==="not_sent"?p(s.status.not_sent,{reason:a}):s.status[e]}function ke(e){return e==="acknowledged"||e==="completed"?"ok":e==="failed"?"err":e==="sending"||e==="sent"?"busy":"warn"}function Zs(e){const t={ok:0,failed:0,not_sent:0,unknown:0};for(const s of e)s.status==="acknowledged"||s.status==="completed"?t.ok++:s.status==="failed"?t.failed++:s.status==="not_sent"?t.not_sent++:t.unknown++;return t}function Js(e){const t=e?.auth_seen??null,s=e?.report?.auth?.last_failure??null;return t?s&&String(s.at??"")>=String(t.at??"")?s:t:s}function Xs(e,t){const s=[],a=e?.report?.auth,n=e?.technical?.event_status?.stream;return(a?.sync_now||e?.technical?.last_error==="authentication_failed")&&s.push(t.authSources.sync),(a?.event_stream_now||n==="authentication_failed")&&s.push(t.authSources.event_stream),a?.event_history_now&&s.push(t.authSources.event_history),s}function Qs(e,t){return e?t.steps[e]??t.steps.other:""}const ea={title:"תחזוקה",listButton:"תחזוקה",listTitle:"תחזוקת עמדות",refresh:"רענון נתונים",loading:"טוען את מצב העמדה…",unavailable:"מצב העמדה אינו זמין כרגע.",healthHidden:"פרטי הבריאות של העמדה מוצגים רק למי שמורשה לצפות במצב המערכת.",actions:{sync:"סנכרן עכשיו",rescan:"סריקה מחדש",health_refresh:"רענון בריאות",clock_refresh:"בדיקת שעון"},confirm:{sync:{title:"לסנכרן את העמדה עכשיו?",one:"אנשים, כרטיסים והרשאות שממתינים יישלחו לעמדה {name}. הסנכרון נכנס לתור ומתבצע ברקע."},rescan:{title:"לסרוק את העמדה מחדש?",one:"היכולות ורשימת המשתמשים יקראו מחדש מהעמדה {name}. שום דבר לא נכתב לעמדה."},health_refresh:{title:"לרענן את בריאות העמדה?",one:"השעון ונתוני המדיה של העמדה {name} ייקראו מחדש מהמכשיר (עד חצי דקה)."},clock_refresh:{title:"לבדוק את שעון העמדה?",one:"השעון של העמדה {name} ייקרא מחדש. השעה בעמדה לא משתנה."},many:"הפעולה תישלח פעם אחת לכל עמדה מתוך {n} העמדות שנבחרו, אחת אחרי השנייה.",send:"שלח",cancel:"ביטול"},rows:{lastSync:"סנכרון אחרון",lastScan:"קריאה אחרונה מהעמדה",stream:"זרם אירועים",clock:"שעון",lastError:"שגיאה אחרונה",auth:"כשל הזדהות",polls:"כשלי תקשורת רצופים"},stream:{connected:"מחובר",connecting:"מתחבר",disconnected:"מנותק",authentication_failed:"נכשל בהזדהות",unavailable:"לא זמין",stopped:"עצור",unknown:"לא ידוע"},clockOk:"תקין",clockSkew:"סטייה של {n} שניות",clockStatus:{ready:"נמדד",stale:"מדידה ישנה",unavailable:"לא נמדד"},never:"אין עדיין",none:"אין",authNone:"לא נראה מאז שהמערכת עלתה",authLine:"{source} · שלב: {step} · {at}",authObserved:"{source} · נראה ב־{at}",authCount:"{n} כשלים ברשומות האחרונות",authNow:"כרגע: {what}",authCode:"קוד מהמכשיר {code}",authSources:{sync:"סנכרון",event_stream:"זרם האירועים",event_history:"השלמת היסטוריית אירועים",station_sync:"סנכרון העמדה"},steps:{queued:"בתור",identity:"זיהוי העמדה",capabilities:"קריאת יכולות",inventory:"קריאת משתמשים מהעמדה",person_read:"קריאת אדם",reconcile:"התאמה",journal:"רישום",create_person:"הוספת אדם",update_person:"עדכון אדם",delete_person:"מחיקת אדם",create_card:"הוספת כרטיס",update_card:"עדכון כרטיס",delete_card:"מחיקת כרטיס",readback:"אימות",complete:"סיום",other:"שלב אחר"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"התקבל - הסנכרון בתור",completed:"הושלם",failed:"נכשל: {reason}",not_sent:"לא נשלח: {reason}",unknown:"נשלח, אין תשובה ברורה - ייתכן שבוצע"},lastRun:"פעם אחרונה: {status} · {at}",cooldown:"אפשר שוב בעוד {n} שניות",offlineHint:"העמדה לא מחוברת - אפשר רק לבקש סנכרון.",reasons:{authentication_failed:"העמדה דחתה את פרטי ההתחברות",connection_failed:"אין חיבור לעמדה",device_busy:"העמדה עסוקה",device_unavailable:"העמדה לא זמינה",station_offline:"העמדה לא מחוברת",intercom_station_offline:"העמדה לא מחוברת",station_unloaded:"העמדה לא טעונה במערכת האינטרקום",station_not_found:"העמדה לא נמצאה",intercom_station_not_found:"העמדה לא נמצאה",manager_closed:"מערכת האינטרקום בעצירה",unauthorized:"מערכת האינטרקום לא אישרה את הפעולה",forbidden:"אין הרשאה לתחזוקת העמדה",confirmation_required:"חסר אישור",expired:"הבקשה פגה לפני שנשלחה",intercom_duplicate_command:"הפקודה כבר נשלחה",station_ops_cooldown:"נשלח לפני רגע",station_ops_rate_limited:"יותר מדי פקודות בזמן קצר",station_ops_busy:"פקודות אחרות עדיין רצות",intercom_busy:"מערכת האינטרקום עסוקה",intercom_rate_limited:"הגבלת קצב",rate_limited:"הגבלת קצב",busy:"מערכת האינטרקום עסוקה",intercom_unavailable:"מערכת האינטרקום לא זמינה",timeout:"לא התקבלה תשובה בזמן",clock_read_failed:"קריאת השעון נכשלה",operation_unsupported:"העמדה לא תומכת בפעולה",capacity_exhausted:"העמדה מלאה",network:"אין חיבור לשרת"},bulk:{pickAction:"פעולה",pickStations:"עמדות",all:"בחר הכל",clear:"נקה",selected:"{n} נבחרו",offline:"לא מחוברת",next:"המשך",back:"חזרה",close:"סגור",running:"שולח {i} מתוך {n}…",summary:"{ok} הצליחו · {failed} נכשלו · {not_sent} לא נשלחו · {unknown} ללא תשובה",noneSelected:"בחרו לפחות עמדה אחת.",offlineSkipped:"עמדות לא מחוברות לא ייכללו בפעולה הזו."}},ta={title:"Maintenance",listButton:"Maintenance",listTitle:"Station maintenance",refresh:"Refresh data",loading:"Loading the station state…",unavailable:"The station state is not available right now.",healthHidden:"The station's health details are shown only to who may view the system status.",actions:{sync:"Sync now",rescan:"Rescan",health_refresh:"Refresh health",clock_refresh:"Check clock"},confirm:{sync:{title:"Sync the station now?",one:"Pending people, cards and permissions are sent to {name}. The sync is queued and runs in the background."},rescan:{title:"Rescan the station?",one:"Capabilities and the user list are read again from {name}. Nothing is written to the station."},health_refresh:{title:"Refresh the station's health?",one:"{name}'s clock and media details are read again from the device (up to half a minute)."},clock_refresh:{title:"Check the station's clock?",one:"{name}'s clock is read again. The station's time is not changed."},many:"The action is sent once to each of the {n} selected stations, one after the other.",send:"Send",cancel:"Cancel"},rows:{lastSync:"Last sync",lastScan:"Last read from the station",stream:"Event stream",clock:"Clock",lastError:"Last error",auth:"Sign-in failure",polls:"Failed polls in a row"},stream:{connected:"Connected",connecting:"Connecting",disconnected:"Disconnected",authentication_failed:"Sign-in failed",unavailable:"Unavailable",stopped:"Stopped",unknown:"Unknown"},clockOk:"OK",clockSkew:"{n} s off",clockStatus:{ready:"Measured",stale:"Old measurement",unavailable:"Not measured"},never:"None yet",none:"None",authNone:"Not seen since the system started",authLine:"{source} · step: {step} · {at}",authObserved:"{source} · seen at {at}",authCount:"{n} failures in the recent records",authNow:"Now: {what}",authCode:"device code {code}",authSources:{sync:"Sync",event_stream:"Event stream",event_history:"Event history",station_sync:"Station sync"},steps:{queued:"Queued",identity:"Station identity",capabilities:"Capabilities",inventory:"Reading users",person_read:"Reading a person",reconcile:"Reconcile",journal:"Journal",create_person:"Adding a person",update_person:"Updating a person",delete_person:"Removing a person",create_card:"Adding a card",update_card:"Updating a card",delete_card:"Removing a card",readback:"Verification",complete:"Complete",other:"Other step"},status:{sending:"Sending…",sent:"Sent, waiting for the answer",acknowledged:"Accepted - the sync is queued",completed:"Done",failed:"Failed: {reason}",not_sent:"Not sent: {reason}",unknown:"Sent, no clear answer - it may have run"},lastRun:"Last time: {status} · {at}",cooldown:"Again in {n} s",offlineHint:"The station is offline - only a sync can be requested.",reasons:{authentication_failed:"the station refused the sign-in",connection_failed:"no connection to the station",device_busy:"the station is busy",device_unavailable:"the station is unavailable",station_offline:"the station is offline",intercom_station_offline:"the station is offline",station_unloaded:"the station is not loaded",station_not_found:"station not found",intercom_station_not_found:"station not found",manager_closed:"the intercom system is stopping",unauthorized:"the intercom system refused the action",forbidden:"no permission to maintain this station",confirmation_required:"not confirmed",expired:"the request expired before it was sent",intercom_duplicate_command:"already sent",station_ops_cooldown:"sent a moment ago",station_ops_rate_limited:"too many commands in a short time",station_ops_busy:"other commands are still running",intercom_busy:"the intercom system is busy",intercom_rate_limited:"rate limited",rate_limited:"rate limited",busy:"the intercom system is busy",intercom_unavailable:"the intercom system is unavailable",timeout:"no answer in time",clock_read_failed:"reading the clock failed",operation_unsupported:"the station does not support this",capacity_exhausted:"the station is full",network:"no connection to the server"},bulk:{pickAction:"Action",pickStations:"Stations",all:"Select all",clear:"Clear",selected:"{n} selected",offline:"offline",next:"Continue",back:"Back",close:"Close",running:"Sending {i} of {n}…",summary:"{ok} done · {failed} failed · {not_sent} not sent · {unknown} no answer",noneSelected:"Select at least one station.",offlineSkipped:"Offline stations are left out of this action."}};function N(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?ta:ea}var sa=Object.defineProperty,aa=Object.getOwnPropertyDescriptor,L=(e,t,s,a)=>{for(var n=a>1?void 0:a?aa(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&sa(t,s,n),n};let A=class extends F{constructor(){super(...arguments),this.stations=[],this.live=!0,this.open=!1,this.step="pick",this.action="sync",this.chosen=new Set,this.outcomes={},this.index=0,this.busy=!1,this.targets=[]}allowed(){return O("access.stations.manage")&&this.stations.length>0}openDialog(){this.open=!0,this.step="pick",this.outcomes={},this.index=0,this.chosen=new Set(this.stations.map(e=>e.id))}close(){this.busy||(this.open=!1)}toggle(e){const t=new Set(this.chosen);t.has(e)?t.delete(e):t.add(e),this.chosen=t}async send(){this.busy||(this.targets=He(this.stations,this.chosen,this.action),this.targets.length&&(this.step="run",this.busy=!0,this.outcomes=Object.fromEntries(this.targets.map(e=>[e,{station_id:e,action:this.action,status:"sending",code:null,retry_after_s:null,data:null}])),await Ys(this.targets,this.action,(e,t)=>{this.outcomes={...this.outcomes,[e.station_id]:e},this.index=t+1}),this.busy=!1,this.dispatchEvent(new CustomEvent("stations-op",{detail:Object.values(this.outcomes),bubbles:!0,composed:!0}))))}willUpdate(){this.hidden=!this.allowed()}render(){if(!this.allowed())return l;const e=N();return o`<wk-action-button icon="wrench" data-wk-maint-list ?disabled=${!this.live} label=${e.listButton} @click=${()=>this.openDialog()}><span class="lbl">${e.listButton}</span></wk-action-button>
      ${this.open?this.renderDialog():l}`}renderDialog(){const e=N(),t=He(this.stations,this.chosen,this.action),s=this.action!=="sync"&&this.stations.some(a=>this.chosen.has(a.id)&&!a.online);return o`<sw-dialog open ?locked=${this.busy} heading=${this.step==="confirm"?e.confirm[this.action].title:e.listTitle} data-wk-maint-dialog data-step=${this.step}
      @close=${a=>a.target===a.currentTarget&&this.close()}>
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
        ${pt.map(s=>o`<button type="button" class="chip" role="radio" aria-checked=${String(this.action===s)} aria-pressed=${String(this.action===s)} data-wk-maint-action=${s} @click=${()=>this.action=s}>
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
      ${this.chosen.size?e?o`<div class="note">${t.bulk.offlineSkipped}</div>`:l:o`<div class="note" role="status">${t.bulk.noneSelected}</div>`}`}renderRun(){const e=N(),t=new Map(this.stations.map(i=>[i.id,i.name])),s=this.targets.map(i=>this.outcomes[i]).filter(Boolean),a=s.filter(i=>i.status!=="sending"),n=Zs(a);return o`<div class="summary" role="status" data-wk-maint-progress>
        ${this.busy?p(e.bulk.running,{i:Math.min(this.index+1,this.targets.length),n:this.targets.length}):p(e.bulk.summary,{...n})}
      </div>
      <div class="list" data-wk-maint-results>
        ${s.map(i=>o`<div class="row" data-wk-maint-row=${i.station_id} data-status=${i.status}>
            <span class="nm">${t.get(i.station_id)??i.station_id}</span>
            <span class="st" data-tone=${ke(i.status)}>${be(i.status,i.code,e)}</span>
          </div>`)}
      </div>`}};A.styles=j`
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
  `;L([g({attribute:!1})],A.prototype,"stations",2);L([g({type:Boolean})],A.prototype,"live",2);L([u()],A.prototype,"open",2);L([u()],A.prototype,"step",2);L([u()],A.prototype,"action",2);L([u()],A.prototype,"chosen",2);L([u()],A.prototype,"outcomes",2);L([u()],A.prototype,"index",2);L([u()],A.prototype,"busy",2);L([u()],A.prototype,"targets",2);A=L([I("wk-stations-maintenance")],A);function na(e){const t=~e&255,s=t&128,a=t>>4&7,i=((t&15)<<3)+132<<a;return s?132-i:i-132}function ia(e){const t=e^85,s=(t&112)>>4;let a=(t&15)<<4;return s===0?a+=8:s===1?a+=264:a=a+264<<s-1,(t&128)!==0?a:-a}function oa(e,t="pcmu"){const s=new Float32Array(e.length),a=t==="pcma"?ia:na;for(let n=0;n<e.length;n+=1)s[n]=a(e[n]&255)/32768;return s}function ra(e){if(!e.length)return 0;let t=0;for(let s=0;s<e.length;s+=1)t+=e[s]*e[s];return Math.min(1,Math.sqrt(t/e.length)*4)}function la(e,t){if(t<=0)return e;const s=e*.5**(t/150);return s<.01?0:s}const je={intercom_listen_busy:"busy",intercom_listen_user_busy:"user_busy",intercom_listen_unsupported:"unsupported",intercom_listen_no_listen:"no_listen",intercom_listen_off:"off",intercom_station_offline:"offline",intercom_listen_unavailable:"unavailable",intercom_unavailable:"unavailable",intercom_station_not_found:"unavailable",forbidden:"forbidden"};function da(e){if(e instanceof B){if(je[e.code])return je[e.code];if(e.status===403)return"forbidden";if(e.status===0)return"network"}return e instanceof TypeError?"network":"failed"}function ca(e){switch(e){case"ended":case"stopped":return null;case"expired":return"expired";case"access_lost":return"access_lost";case"upstream_closed":case"upstream_unavailable":return"upstream";case"network":return"network";default:return"failed"}}class ha{constructor(t,s){this.stationId=t,this.deps=s,this.phase="idle",this.problem=null,this.outcome=null,this.muted=!1,this.endsAt=0,this.starts=0,this.frames=0,this.level=0,this.levelAt=0,this.gen=0,this.reply=null,this.ws=null,this.sink=null,this.codec="pcmu",this.rate=8e3}secondsLeft(){return this.phase==="listening"?Math.max(0,Math.ceil((this.endsAt-this.deps.now())/1e3)):null}levelNow(){return this.phase==="listening"?la(this.level,this.deps.now()-this.levelAt):0}async start(){if(this.phase!=="idle")return;this.problem=null;const t=this.deps.sink();if(!t){this.problem="no_audio",this.deps.changed();return}this.sink=t,t.setMuted(this.muted),this.phase="starting";const s=++this.gen;this.deps.changed();let a;try{this.starts+=1,a=await this.deps.start(this.stationId,this.deps.requestId())}catch(i){s===this.gen&&this.fail(da(i));return}if(s!==this.gen){this.deps.stop(a.session).catch(()=>{});return}this.reply=a,this.codec=a.codec,this.rate=a.sample_rate,this.endsAt=this.deps.now()+a.max_seconds*1e3;let n;try{n=this.deps.socket(a.ws_path)}catch{this.deps.stop(a.session).catch(()=>{}),this.fail("network");return}n.binaryType="arraybuffer",this.ws=n,n.onmessage=i=>{if(s!==this.gen)return;if(typeof i.data!="string"){this.phase==="listening"&&this.onFrame(i.data);return}let r;try{r=JSON.parse(i.data)}catch{return}r.type==="listen/state"&&r.value==="open"&&this.phase==="starting"?(this.phase="listening",this.levelAt=this.deps.now(),this.deps.changed()):r.type==="listen/closed"&&this.finish(String(r.value??"ended"))},n.onclose=i=>{s===this.gen&&this.finish(Tt(i.code))},n.onerror=()=>{}}setMuted(t){this.muted=t,this.sink?.setMuted(t),this.deps.changed()}stop(){if(this.phase==="idle")return;const t=this.ws,s=this.reply;t&&t.readyState===1?t.send(JSON.stringify({type:"listen/stop"})):s&&this.deps.stop(s.session).catch(()=>{}),this.finish("ended")}dispose(){this.stop()}onFrame(t){const s=oa(new Uint8Array(t),this.codec);this.frames+=1,this.level=ra(s),this.levelAt=this.deps.now(),this.sink?.play(s,this.rate)}teardown(){this.gen+=1;const t=this.ws;if(this.ws=null,t){t.onmessage=null,t.onclose=null,t.onerror=null;try{t.close()}catch{}}this.sink?.close(),this.sink=null,this.reply=null,this.endsAt=0,this.level=0}fail(t){this.teardown(),this.phase="idle",this.problem=t,this.outcome=null,this.deps.changed()}finish(t){this.teardown(),this.phase="idle",this.outcome=t,this.problem=ca(t),this.deps.changed()}}const ua=.06,pa=.3;function wa(e,t){const s=Math.max(t,e+ua);return s-e>pa?null:s}function ma(){const e=globalThis.AudioContext??globalThis.webkitAudioContext;if(!e)return null;let t;try{t=new e}catch{return null}t.resume().catch(()=>{});const s=t.createGain();s.connect(t.destination);let a=0;return{play(n,i){const r=wa(t.currentTime,a);if(r===null)return;const d=t.createBuffer(1,n.length,i);d.copyToChannel(n,0);const c=t.createBufferSource();c.buffer=d,c.connect(s),c.start(r),a=r+d.duration},setMuted(n){s.gain.value=n?0:1},close(){t.close().catch(()=>{})}}}var fa=Object.defineProperty,ga=Object.getOwnPropertyDescriptor,Y=(e,t,s,a)=>{for(var n=a>1?void 0:a?ga(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&fa(t,s,n),n};let R=class extends F{constructor(){super(...arguments),this.stationId="",this.live=!0,this.deps=null,this.capability=null,this.tick=0,this.session=null,this.timer=0,this.loadedFor=""}realDeps(){const e=this.deps??{};return{start:e.start??((t,s)=>cs(t,s)),stop:e.stop??(t=>ds(t)),socket:e.socket??(t=>new WebSocket(ls(t))),sink:e.sink??(()=>ma()),requestId:e.requestId??(()=>rs()),now:e.now??(()=>Date.now()),changed:()=>{this.tick+=1,this.syncTimer()}}}ensureSession(){return(!this.session||this.session.stationId!==this.stationId)&&(this.session?.dispose(),this.session=new ha(this.stationId,this.realDeps())),this.session}syncTimer(){const e=this.session?.phase==="listening";e&&!this.timer?this.timer=window.setInterval(()=>this.tick+=1,150):!e&&this.timer&&(window.clearInterval(this.timer),this.timer=0)}willUpdate(e){(e.has("stationId")||e.has("live"))&&this.stationId&&this.live&&!this.deps?.start&&this.loadedFor!==this.stationId&&!this.capability&&(this.loadedFor=this.stationId,hs(this.stationId).then(t=>{this.loadedFor===this.stationId&&(this.capability=t)}).catch(()=>{}))}disconnectedCallback(){super.disconnectedCallback(),this.session?.dispose(),this.session=null,this.timer&&window.clearInterval(this.timer),this.timer=0}get offered(){const e=this.session,t=e!==null&&e.phase!=="idle";return this.live&&(t||!!e?.problem||!!this.capability?.available)}updated(e){super.updated(e),this.toggleAttribute("hidden",!this.offered)}toggle(){const e=this.ensureSession();e.phase==="idle"?e.start():e.stop()}render(){const e=this.session;if(!this.offered)return l;const t=us(),s=e?.phase??"idle",a=e?.secondsLeft(),n=Math.round((e?.levelNow()??0)*100),i=s==="starting"?t.starting:s==="listening"?`${t.listening}${a!=null?` · ${Ot(t.left,{t:Pt(a)})}`:""}`:"";return o`
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
    `}};R.styles=j`
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
  `;Y([g()],R.prototype,"stationId",2);Y([g({type:Boolean})],R.prototype,"live",2);Y([g({attribute:!1})],R.prototype,"deps",2);Y([g({attribute:!1})],R.prototype,"capability",2);Y([u()],R.prototype,"tick",2);R=Y([I("wk-listen-button")],R);var va=Object.defineProperty,ba=Object.getOwnPropertyDescriptor,E=(e,t,s,a)=>{for(var n=a>1?void 0:a?ba(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&va(t,s,n),n};let P=class extends F{constructor(){super(...arguments),this.stationId="",this.stationName="",this.media=null,this.poster="",this.live=!0,this.classicHref="",this.classicLabel="",this.talkHere=!0,this.profile=null,this.choice=Pe(null),this.mutedBefore=null,this.onOuterFloor=e=>{if(this.talkHere)return;e.detail?.stationId===this.stationId&&this.onFloor(e)},this.onFloor=e=>{const t=e.detail.held,s=this.player;!s||this.media?.talk?.duplex==="full"||(t?(this.mutedBefore=s.muted,s.muted=!0):this.mutedBefore!==null&&(s.muted=this.mutedBefore,this.mutedBefore=null))}}connectedCallback(){super.connectedCallback(),window.addEventListener("talk-floor",this.onOuterFloor),xe().then(e=>this.choice=Pe(e)).catch(()=>{})}disconnectedCallback(){window.removeEventListener("talk-floor",this.onOuterFloor),super.disconnectedCallback()}willUpdate(e){if(e.has("media")||e.has("stationId")){const t=this.media?.video?.profiles.map(s=>s.id)??[];(!this.profile||!t.includes(this.profile)||e.has("stationId"))&&(this.profile=Et(this.media?.video??null))}}render(){const e=this.media,t=e?.video,s=de(),a=t?.profiles.find(c=>c.id===this.profile),n=a?t?.paths[a.id]:void 0,i=e?.talk,r=Object.fromEntries((t?.profiles??[]).map(c=>[c.id,c.transports])),d=a?Dt(t?.transport?.choice??this.choice,a.id,r,t?.transport?.plans?.[a.id]??null):null;return o`
      ${n&&d?.blocked?o`<div class="frame" data-wk-live-frame data-profile=${a.id} data-wk-live-blocked>
            ${this.poster?o`<img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" />`:l}
            <div class="blocked" role="status"><sw-icon name="offline" size=${18}></sw-icon><span>${s.live.blocked}</span><span class="hint">${s.live.blockedHint}</span></div>
          </div>`:n&&d?o`<div class="frame" data-wk-live-frame data-profile=${a.id} data-transport-plan=${d.plan||d.mode}>
            <sw-live-player .livePath=${n} .profile=${a.id} .mode=${d.mode} .plan=${d.plan} .preferred=${d.plan?a.id:""} .poster=${this.poster} data-wk-live-player aria-label=${`${s.live.label} · ${this.stationName}`}></sw-live-player>
          </div>`:this.poster?o`<div class="frame" data-wk-live-frame data-profile=""><img src=${this.poster} alt=${`${s.live.poster} · ${this.stationName}`} decoding="async" /></div>`:l}
      ${t&&t.profiles.length>1&&n?o`<div class="bar">
            <span class="lbl" id="q">${s.live.quality}</span>
            <div class="seg" role="group" aria-labelledby="q" data-wk-quality>
              ${t.profiles.map(c=>o`<button type="button" data-profile=${c.id} aria-pressed=${String(c.id===this.profile)} @click=${()=>this.profile=c.id}>${c.id==="main"?s.live.main:s.live.sub}</button>`)}
            </div>
          </div>`:l}
      ${this.talkHere?i?.available?o`<wk-talk-button .stationId=${this.stationId} .talk=${i} .live=${this.live} data-wk-talk="native" @talk-floor=${this.onFloor}></wk-talk-button>`:this.classicHref?o`<wk-action-button tone="dashed" icon="window" block size="lg" href=${this.classicHref} data-wk-talk="classic">${this.classicLabel}</wk-action-button>`:l:l}
      ${e?.state==="ready"?o`<wk-listen-button .stationId=${this.stationId} .live=${this.live}></wk-listen-button>`:l}
    `}};P.styles=j`
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
  `;E([g()],P.prototype,"stationId",2);E([g()],P.prototype,"stationName",2);E([g({attribute:!1})],P.prototype,"media",2);E([g()],P.prototype,"poster",2);E([g({type:Boolean})],P.prototype,"live",2);E([g()],P.prototype,"classicHref",2);E([g()],P.prototype,"classicLabel",2);E([g({type:Boolean})],P.prototype,"talkHere",2);E([u()],P.prototype,"profile",2);E([u()],P.prototype,"choice",2);E([At("sw-live-player")],P.prototype,"player",2);P=E([I("wk-station-live")],P);const ka=45e3,ya=12e4;function $a(e){const t=e instanceof B?Number(e.body?.details?.retry_after_s):NaN;return Number.isFinite(t)&&t>=0?Math.ceil(t*1e3):ms}function Be(e,t=z()){return Lt(e)!=="unknown"?{tone:"err",text:$e(e),unknown:!1}:{tone:"warn",text:t.call.unknown,unknown:!0}}function xa(e,t=z()){const s={answer:t.call.answer,reject:t.call.reject,hangUp:t.call.hangUp},a=p(t.call.sent,{label:s[e.command]??e.command,ack:e.acknowledged===!0?t.call.ack:t.call.noAck});if(e.observation==="unavailable"||!e.observed_state)return`${a} · ${t.call.stateUnread}`;const n=ee(e.observed_state,t);return`${a} · ${p(e.observation==="unchanged"?t.call.stateUnchanged:t.call.state,{state:n})}`}const _a=["started","generating","speaking","completed","closed"],We=e=>_a.indexOf(e.state);class he{constructor(t){this.deps=t,this.confirm=null,this.releasing=new Set,this.held={},this.results={},this.callBusy=new Set,this.armed=null,this.tts={},this.armTimer=0,this.holdTimer=0}dispose(){this.deps.cancel(this.armTimer),this.deps.cancel(this.holdTimer)}static key(t,s){return`${t}/${s}`}isHeld(t){return(this.held[t]??0)>this.deps.now()}setResult(t,s,a){this.results={...this.results,[t]:{tone:s,text:a,at:this.deps.now()}},this.deps.changed()}prune(){const t=this.deps.now(),s=Object.entries(this.results).filter(([,a])=>t-a.at<(a.tone==="warn"?ya:ka));s.length!==Object.keys(this.results).length&&(this.results=Object.fromEntries(s),this.deps.changed())}clearResult(t){if(!(t in this.results))return;const s={...this.results};delete s[t],this.results=s,this.deps.changed()}askRelease(t,s){const a=he.key(t,s);return!this.deps.live()||this.releasing.has(a)||this.isHeld(a)?!1:(this.confirm={stationId:t,lock:s},this.deps.changed(),!0)}cancelRelease(){this.confirm&&(this.confirm=null,this.deps.changed())}async confirmRelease(){const t=this.confirm;if(!t)return;const s=he.key(t.stationId,t.lock);if(!(!this.deps.live()||this.releasing.has(s)||this.isHeld(s))){this.releasing=new Set([...this.releasing,s]),this.deps.changed();try{await this.deps.release(t.stationId,t.lock),this.setResult(t.stationId,"ok",p(z().door.sentAt,{at:this.deps.stamp()}))}catch(a){const n=Be(a);this.setResult(t.stationId,n.tone,n.unknown?z().door.unknown:n.text),(n.unknown||a instanceof B&&a.code==="intercom_release_in_progress")&&this.hold(s,$a(a))}finally{const a=new Set(this.releasing);a.delete(s),this.releasing=a,this.confirm===t&&(this.confirm=null),this.deps.changed()}}}hold(t,s){const a=this.deps.now()+s;this.held={...this.held,[t]:Math.max(this.held[t]??0,a)},this.deps.cancel(this.holdTimer);const n=Object.values(this.held).filter(i=>i>this.deps.now());n.length&&(this.holdTimer=this.deps.after(()=>{this.held={...this.held},this.deps.changed()},Math.min(...n)-this.deps.now()+50)),this.deps.changed()}tapCall(t,s,a=1){const n=this.deps.station(t);if(!n||this.callBusy.has(t)||!this.deps.live()||a>1)return;const i=this.armed;if(i&&i.id===t&&i.command===s&&i.callState===n.call_state){if(this.deps.tick()-i.at<ps)return;this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed(),this.sendCall(t,s);return}this.deps.cancel(this.armTimer),this.armed={id:t,command:s,at:this.deps.tick(),callState:n.call_state},this.armTimer=this.deps.after(()=>{this.armed=null,this.deps.changed()},ws),this.deps.changed()}dropStaleArm(){const t=this.armed;if(!t)return;const s=this.deps.station(t.id);(!this.deps.live()||!s||!s.online||s.call_state!==t.callState)&&(this.deps.cancel(this.armTimer),this.armed=null,this.deps.changed())}async sendCall(t,s){this.callBusy=new Set([...this.callBusy,t]),this.deps.changed();try{const a=await this.deps.signal(t,s);a.call&&this.setResult(t,a.call.acknowledged===!0?"ok":"warn",xa(a.call))}catch(a){const n=Be(a);this.setResult(t,n.tone,n.text)}finally{const a=new Set(this.callBusy);a.delete(t),this.callBusy=a,this.deps.changed(),this.deps.refetch()}}noteTts(t){const s=this.tts[t.station_id];s&&s.at>=t.at&&We(s)>We(t)||(this.tts={...this.tts,[t.station_id]:t},this.deps.changed())}}const Sa=j`
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
`,se=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],W=e=>`access-control/stations/${encodeURIComponent(e)}`,za=15e3,ae=()=>({confirmed:!0,client_request_id:nt(),expires_at:new Date(at()+za).toISOString().replace(/\.\d{3}Z$/,"Z")}),Ca=e=>_e(`${W(e)}/door-tech`),Ta=(e,t)=>_e(`${W(e)}/doors/${t}/hold`),Oa=(e,t,s,a)=>G(`${W(e)}/doors/${t}/hold`,{...ae(),revision:s,policy:a}),Pa=(e,t,s)=>G(`${W(e)}/doors/${t}/hold/delete`,{...ae(),revision:s}),Aa=(e,t,s,a,n)=>G(`${W(e)}/doors/${t}/program`,{...ae(),revision:s,policy:a,enabled:n}),Ea=(e,t,s,a)=>G(`${W(e)}/doors/${t}/program/${a}`,{...ae(),revision:s});function Da(e){return{action:e.action,door:e.door,expected:e.expected,...e.action==="set"?{new_code:e.newCode??""}:{},...e.expected?{current_code:e.currentCode??""}:{},compatibility:!!e.compatibility,confirm_text:e.confirmText}}const La=(e,t)=>G(`${W(e)}/codes/${t.slot}`,{...ae(),...Da(t)});function Ma(e,t){if(e instanceof B){const s=e.body?.details??{},a=String(s.outcome??""),n=a==="refused"?"refused":a==="not_sent"?"not_sent":a==="unknown"?"unknown":[403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",i=Number(s.retry_after_s),r=String(s.wiskey_code??"")||String(s.reason??"")||e.code||"";return{kind:t,status:n,code:r||null,retry_after_s:Number.isFinite(i)&&i>=0?i:null,data:null}}return{kind:t,status:"unknown",code:"network",retry_after_s:null,data:null}}async function Z(e,t){try{const s=await t();return{kind:e,status:s.status,code:s.partial,retry_after_s:null,data:s.data??null}}catch(s){return Ma(s,e)}}function ce(e,t){const s=Object.fromEntries(se.map(a=>[a,(e?.weekly?.[a]??[]).filter(n=>!!n?.start&&!!n?.end).map(n=>({start:n.start,end:n.end}))]));return{timezone:e?.timezone||t,name:e?.name??"",weekly:s,holidays:(e?.holidays??[]).filter(a=>!!a.start&&!!a.end).map(a=>({name:a.name??"",start:a.start,end:a.end,periods:(a.periods??[]).map(n=>({start:n.start,end:n.end}))}))}}const Na=(e,t="")=>ce({timezone:e,name:t,weekly:{},holidays:[]},e),Ra=/^(?:[01]\d|2[0-3]):[0-5]\d$/,re=(e,t=!1)=>Ra.test(e)?Number(e.slice(0,2))*60+Number(e.slice(3)):t&&e==="24:00"?1440:null;function Ue(e,t){if(e.length>8)return[{field:t,key:"tooMany"}];const s=[];if(e.forEach((n,i)=>{const r=re(n.start),d=re(n.end,!0);r===null||d===null?s.push({field:`${t}.${i}`,key:"time"}):r>=d&&s.push({field:`${t}.${i}`,key:"order"})}),s.length)return s;const a=[...e].sort((n,i)=>n.start.localeCompare(i.start));for(let n=1;n<a.length;n++)if((re(a[n-1].end,!0)??0)>(re(a[n].start)??0))return[{field:t,key:"overlap"}];return[]}function Ke(e){const t=[],s=e.name.trim();(!s||s.length>32)&&t.push({field:"name",key:"name"}),(!e.timezone||e.timezone.length>64)&&t.push({field:"timezone",key:"zone"});for(const i of se)t.push(...Ue(e.weekly[i]??[],`weekly.${i}`));e.holidays.length>64&&t.push({field:"holidays",key:"tooMany"});const a=/^\d{4}-\d{2}-\d{2}$/;e.holidays.forEach((i,r)=>{(!i.name.trim()||i.name.trim().length>32)&&t.push({field:`holidays.${r}.name`,key:"name"}),!a.test(i.start)||!a.test(i.end)?t.push({field:`holidays.${r}`,key:"date"}):i.start>i.end&&t.push({field:`holidays.${r}`,key:"dateOrder"}),t.push(...Ue(i.periods,`holidays.${r}.periods`))});const n=e.holidays.filter(i=>a.test(i.start)&&a.test(i.end)).sort((i,r)=>i.start.localeCompare(r.start));for(let i=1;i<n.length;i++)n[i-1].end>=n[i].start&&t.push({field:"holidays",key:"dateOverlap"});return t}function Ge(e){const t=s=>[...s].map(a=>({start:a.start,end:a.end})).sort((a,n)=>a.start.localeCompare(n.start));return{timezone:e.timezone,name:e.name.trim(),weekly:Object.fromEntries(se.map(s=>[s,t(e.weekly[s]??[])])),holidays:e.holidays.map(s=>({name:s.name.trim(),start:s.start,end:s.end,periods:t(s.periods)})).sort((s,a)=>s.start.localeCompare(a.start))}}function Ve(e,t){return e?se.filter(s=>(e.weekly[s]??[]).length).map(s=>`${t.days[s]} ⁦${(e.weekly[s]??[]).map(a=>`${a.start}–${a.end}`).join(", ")}⁩`):[]}const Ye=/^\d{4,16}$/;function Fa(e){if(e.action==="set"){if(!Ye.test(e.newCode))return"newCode";if(e.newCode!==e.repeatCode)return"repeat"}return e.expected&&!Ye.test(e.currentCode)?"currentCode":e.typed.trim()!==e.phrase?"typed":null}const Ze=(e,t)=>p(e,{slot:t});function Ia(e,t){return e?t.reasons[e]??(e.startsWith("schedule_")?t.reasons.schedule_invalid:e):""}function Je(e,t){const s=Ia(e.code,t);switch(e.status){case"sending":return t.status.sending;case"sent":return t.status.sent;case"acknowledged":return t.status.acknowledged;case"partial":return t.status.partial;case"refused":return p(t.status.refused,{reason:s||t.reasons.unknown_reason});case"not_sent":return s?p(t.status.notSentWhy,{reason:s}):t.status.notSent;default:return s&&e.code!=="network"?p(t.status.unknownWhy,{reason:s}):t.status.unknown}}function Xe(e){return e==="acknowledged"?"ok":e==="refused"||e==="not_sent"?"err":e==="sending"||e==="sent"?"busy":"warn"}const qa={title:"שינויים טכניים",open:"ניהול טכני של הדלתות",heading:"ניהול טכני · {name}",sub:"שינויים בהגדרות הדלתות של העמדה. כל שינוי דורש אישור ונרשם ביומן.",loading:"טוען…",unavailable:"לא ניתן לטעון את הנתונים כרגע.",retry:"נסה שוב",close:"סגירה",notAllowed:"שינויים טכניים בדלתות של העמדה הזו מותרים למנהלי מערכת בלבד.",offline:"העמדה אינה מחוברת: אפשר לשמור לוחות זמנים ולהשהות תוכניות, אבל לא להחיל תוכנית או לשנות קוד.",unsupported:"הגרסה המותקנת של מערכת האינטרקום אינה מציעה את הפעולה הזו.",noDoors:"לעמדה אין דלתות מנוהלות.",tabs:{hold:"לוחות החזקה",codes:"קודים ציבוריים",programs:"תוכניות",history:"יומן"},door:"דלת {n}",days:{Sunday:"א׳",Monday:"ב׳",Tuesday:"ג׳",Wednesday:"ד׳",Thursday:"ה׳",Friday:"ו׳",Saturday:"ש׳"},dayNames:{Sunday:"ראשון",Monday:"שני",Tuesday:"שלישי",Wednesday:"רביעי",Thursday:"חמישי",Friday:"שישי",Saturday:"שבת"},hold:{none:"אין לוח החזקה",draftNote:"לוח החזקה הוא טיוטה: הוא לא פותח את הדלת עד שמחילים אותו כתוכנית.",add:"הוספה",edit:"עריכה",remove:"מחיקה",holidays:"תאריכים מיוחדים: {n}",noHours:"סגור כל השבוע"},editor:{titleNew:"לוח החזקה חדש · {door}",titleEdit:"עריכת לוח החזקה · {door}",name:"שם",zone:"אזור זמן",week:"שעות פתיחה בשבוע",closed:"סגור",addPeriod:"הוספת טווח",removePeriod:"הסרת הטווח",from:"מ־",to:"עד",holidays:"תאריכים מיוחדים",addHoliday:"הוספת תאריך",removeHoliday:"הסרת התאריך",holidayName:"שם",holidayStart:"מתאריך",holidayEnd:"עד תאריך",holidayClosed:"סגור כל היום",holidayOpen:"פתוח בשעות",save:"שמירה",cancel:"ביטול",problems:{name:"יש לתת שם (עד 32 תווים).",time:"שעה לא תקינה (HH:MM, סיום עד 24:00).",order:"שעת ההתחלה חייבת להיות לפני שעת הסיום.",overlap:"טווחי השעות חופפים.",tooMany:"יותר מדי טווחים.",date:"תאריך לא תקין.",dateOrder:"תאריך ההתחלה אחרי תאריך הסיום.",dateOverlap:"התאריכים המיוחדים חופפים.",zone:"אזור הזמן חסר."}},codes:{slot:"קוד {n}",set:"מוגדר",notSet:"לא מוגדר",unknown:"לא ידוע",never:"ערך של קוד אף פעם לא מוצג כאן - רק אם הוא מוגדר.",define:"הגדרה",replace:"החלפה",clear:"ניקוי",formSet:"הגדרת {slot}",formReplace:"החלפת {slot}",formClear:"ניקוי {slot}",door:"הדלת שהקוד פותח",newCode:"קוד חדש (4-16 ספרות)",repeat:"הקוד החדש שוב",current:"הקוד הנוכחי",currentHint:"העמדה מבקשת את הקוד הנוכחי כדי להחליף או לנקות אותו.",compatibility:"מצב תאימות (העמדה אינה מצהירה על תמיכה)",typed:"לאישור, הקלידו: {phrase}",send:"שליחה לעמדה",cancel:"ביטול",load:"קריאת מצב הקודים",problems:{newCode:"קוד חייב להכיל 4-16 ספרות.",repeat:"שני הקודים החדשים אינם זהים.",currentCode:"יש להזין את הקוד הנוכחי (4-16 ספרות).",typed:"הטקסט שהוקלד אינו תואם."},rate:"עד {n} שינויי קוד ב־{m} דקות."},programs:{none:"אין תוכנית",on:"מופעלת",paused:"מושהית",removing:"בהסרה",exec:{idle:"לא מחזיקה כרגע",opening:"שולחת החזקה",held_acknowledged:"החזקה אושרה (המצב הפיזי לא אומת)",restoring:"חוזרת לשליטה רגילה",unknown:"תוצאה לא ידועה"},apply:"החלה מלוח ההחזקה",resume:"הפעלה מחדש",pause:"השהיה",remove:"הסרה",needDraft:"כדי להחיל תוכנית שמרו קודם לוח החזקה לדלת.",pauseFirst:"כדי להחיל לוח חדש יש להשהות קודם את התוכנית."},confirm:{hold_save:{title:"לשמור את לוח ההחזקה?",one:'הלוח "{name}" יישמר כטיוטה ל{door} בעמדה {station}. הדלת לא תיפתח עד שתוחל תוכנית.'},hold_delete:{title:"למחוק את לוח ההחזקה?",one:"לוח ההחזקה של {door} בעמדה {station} יימחק."},program_apply:{title:"להחיל תוכנית החזקה?",one:'מעכשיו {door} בעמדה {station} תוחזק פתוחה אוטומטית בשעות של "{name}". המערכת תפעל לבד לפי הלוח.'},program_pause:{title:"להשהות את התוכנית?",one:"התוכנית של {door} בעמדה {station} תושהה, והדלת תתבקש לחזור לשליטה רגילה."},program_remove:{title:"להסיר את התוכנית?",one:"התוכנית של {door} בעמדה {station} תוסר, והדלת תתבקש לחזור לשליטה רגילה."},send:"אישור ושליחה",cancel:"ביטול"},status:{sending:"שולח…",sent:"נשלח, ממתין לתשובה",acknowledged:"בוצע ואושר",partial:"בוצע חלקית: התוכנית נשמרה, אך לא ברור אם הטיוטה הישנה נמחקה",refused:"WisKey סירב: {reason}",notSent:"לא נשלח",notSentWhy:"לא נשלח: {reason}",unknown:"נשלח, לא התקבלה תשובה ברורה - ייתכן שבוצע. טענו מחדש לפני שמנסים שוב",unknownWhy:"נשלח, לא התקבלה תשובה ברורה ({reason}) - ייתכן שבוצע. טענו מחדש לפני שמנסים שוב"},kinds:{hold_save:"שמירת לוח",hold_delete:"מחיקת לוח",code_write:"קוד ציבורי",program_save:"החלת תוכנית",program_action:"עדכון תוכנית"},historyEmpty:"אין עדיין שינויים טכניים בעמדה הזו.",historyCode:"{action} {slot}",codeActions:{set:"הגדרת",clear:"ניקוי"},programActions:{pause:"השהיה",remove:"הסרה"},reasons:{unauthorized:"אין הרשאה לפקודה הזו",forbidden:"אין הרשאה",reauth_required:"נדרש אימות מחדש לפעולות רגישות",screen_locked:"המסך נעול",approval_required:"נדרש אישור כפול",device_busy:"העמדה עסוקה בפקודה טכנית אחרת",revision_conflict:"הנתונים השתנו מאז שנטענו",hold_pause_before_edit:"יש להשהות את התוכנית קודם",schedule_limit:"הגעתם למספר המרבי של לוחות",operation_unsupported:"העמדה אינה תומכת בפעולה",unmanaged_lock:"הדלת אינה מנוהלת",station_retiring:"העמדה בהוצאה משימוש",station_unloaded:"העמדה נטענה מחדש באמצע הפעולה",invalid_fields:"פרמטרים לא תקינים",schedule_invalid:"לוח הזמנים אינו תקין",confirmation_required:"לא אושר",typed_confirmation_required:"הטקסט לאישור לא הוקלד נכון",expired:"הבקשה פגה לפני שנשלחה",intercom_duplicate_command:"כבר נשלח",intercom_station_offline:"העמדה אינה מחוברת",intercom_station_not_found:"העמדה לא נמצאה",intercom_lock_unknown:"אין לעמדה דלת כזו",door_tech_invalid:"ערך לא תקין",door_tech_unsupported:"הגרסה המותקנת אינה מציעה את הפעולה",door_tech_cooldown:"נשלח לפני רגע",door_tech_code_rate_limited:"יותר מדי שינויי קוד בזמן קצר",door_tech_rate_limited:"יותר מדי שינויים בזמן קצר",door_tech_busy:"שינוי אחר בעמדה עדיין רץ",door_tech_code_not_set:"הקוד אינו מוגדר",relay_map_unreadable:"לא ניתן היה לקרוא את מיפוי הדלתות",explicit_deny:"ההרשאה נשללה בעמדה הזו",no_binding:"אין הרשאה",wall_account:"חשבון תצוגה",intercom_unavailable:"מערכת האינטרקום אינה זמינה",intercom_busy:"מערכת האינטרקום עסוקה",intercom_rate_limited:"הוגבל קצב",rate_limited:"הוגבל קצב",timeout:"אין תשובה בזמן",action_failed:"כשל לא מפורט",invalid_response:"תשובה לא צפויה",ambiguous_write:"העמדה לא אישרה בבירור",readback_mismatch:"הקריאה החוזרת לא תאמה",network:"אין חיבור לשרת",unknown_reason:"סיבה לא ידועה"}},Ha={title:"Technical changes",open:"Door technical settings",heading:"Technical settings · {name}",sub:"Changes to this station's door settings. Every change needs a confirmation and is recorded.",loading:"Loading…",unavailable:"The data cannot be loaded right now.",retry:"Try again",close:"Close",notAllowed:"Technical changes to this station's doors are for system administrators only.",offline:"The station is offline: schedules can be saved and programs paused, but a program cannot be applied and codes cannot be changed.",unsupported:"The installed intercom version does not offer this action.",noDoors:"The station has no managed doors.",tabs:{hold:"Hold-open schedules",codes:"Public codes",programs:"Programs",history:"Log"},door:"Door {n}",days:{Sunday:"Sun",Monday:"Mon",Tuesday:"Tue",Wednesday:"Wed",Thursday:"Thu",Friday:"Fri",Saturday:"Sat"},dayNames:{Sunday:"Sunday",Monday:"Monday",Tuesday:"Tuesday",Wednesday:"Wednesday",Thursday:"Thursday",Friday:"Friday",Saturday:"Saturday"},hold:{none:"No hold-open schedule",draftNote:"A hold-open schedule is a draft: it does not open the door until it is applied as a program.",add:"Add",edit:"Edit",remove:"Delete",holidays:"Special dates: {n}",noHours:"Closed all week"},editor:{titleNew:"New hold-open schedule · {door}",titleEdit:"Edit hold-open schedule · {door}",name:"Name",zone:"Time zone",week:"Weekly opening hours",closed:"Closed",addPeriod:"Add a period",removePeriod:"Remove the period",from:"From",to:"To",holidays:"Special dates",addHoliday:"Add a date",removeHoliday:"Remove the date",holidayName:"Name",holidayStart:"From date",holidayEnd:"To date",holidayClosed:"Closed all day",holidayOpen:"Open during",save:"Save",cancel:"Cancel",problems:{name:"Give it a name (up to 32 characters).",time:"Invalid time (HH:MM, end up to 24:00).",order:"The start must be before the end.",overlap:"The periods overlap.",tooMany:"Too many periods.",date:"Invalid date.",dateOrder:"The start date is after the end date.",dateOverlap:"The special dates overlap.",zone:"The time zone is missing."}},codes:{slot:"Code {n}",set:"Set",notSet:"Not set",unknown:"Unknown",never:"A code value is never shown here - only whether it is set.",define:"Set",replace:"Replace",clear:"Clear",formSet:"Set {slot}",formReplace:"Replace {slot}",formClear:"Clear {slot}",door:"The door the code opens",newCode:"New code (4-16 digits)",repeat:"New code again",current:"Current code",currentHint:"The station asks for the current code to replace or clear it.",compatibility:"Compatibility mode (the station does not declare support)",typed:"To confirm, type: {phrase}",send:"Send to the station",cancel:"Cancel",load:"Read the codes",problems:{newCode:"A code has 4-16 digits.",repeat:"The two new codes differ.",currentCode:"Enter the current code (4-16 digits).",typed:"The typed text does not match."},rate:"Up to {n} code changes in {m} minutes."},programs:{none:"No program",on:"On",paused:"Paused",removing:"Being removed",exec:{idle:"Not holding now",opening:"Sending hold-open",held_acknowledged:"Hold-open acknowledged (physical state not verified)",restoring:"Returning to normal control",unknown:"Outcome unknown"},apply:"Apply the hold-open schedule",resume:"Turn on again",pause:"Pause",remove:"Remove",needDraft:"Save a hold-open schedule for the door first to apply a program.",pauseFirst:"Pause the program first to apply a new schedule."},confirm:{hold_save:{title:"Save the hold-open schedule?",one:'The schedule "{name}" is saved as a draft for {door} at {station}. The door does not open until a program is applied.'},hold_delete:{title:"Delete the hold-open schedule?",one:"The hold-open schedule of {door} at {station} is deleted."},program_apply:{title:"Apply a hold-open program?",one:'From now on {door} at {station} is held open automatically during the hours of "{name}". The system acts on its own by the schedule.'},program_pause:{title:"Pause the program?",one:"The program of {door} at {station} is paused and the door is asked back to normal control."},program_remove:{title:"Remove the program?",one:"The program of {door} at {station} is removed and the door is asked back to normal control."},send:"Confirm and send",cancel:"Cancel"},status:{sending:"Sending…",sent:"Sent, waiting for the answer",acknowledged:"Done and acknowledged",partial:"Partly done: the program was saved, but it is not clear whether the old draft was deleted",refused:"WisKey refused: {reason}",notSent:"Not sent",notSentWhy:"Not sent: {reason}",unknown:"Sent, no clear answer - it may have happened. Reload before trying again",unknownWhy:"Sent, no clear answer ({reason}) - it may have happened. Reload before trying again"},kinds:{hold_save:"Schedule saved",hold_delete:"Schedule deleted",code_write:"Public code",program_save:"Program applied",program_action:"Program changed"},historyEmpty:"No technical changes at this station yet.",historyCode:"{action} {slot}",codeActions:{set:"Set",clear:"Clear"},programActions:{pause:"Pause",remove:"Remove"},reasons:{unauthorized:"no permission for this command",forbidden:"no permission",reauth_required:"a fresh sign-in is required for sensitive actions",screen_locked:"the screen is locked",approval_required:"a second approval is required",device_busy:"the station is busy with another technical command",revision_conflict:"the data changed since it was loaded",hold_pause_before_edit:"pause the program first",schedule_limit:"the schedule limit is reached",operation_unsupported:"the station does not support this",unmanaged_lock:"the door is not managed",station_retiring:"the station is being retired",station_unloaded:"the station reloaded during the action",invalid_fields:"invalid parameters",schedule_invalid:"the schedule is invalid",confirmation_required:"not confirmed",typed_confirmation_required:"the confirmation text was not typed correctly",expired:"the request expired before it was sent",intercom_duplicate_command:"already sent",intercom_station_offline:"the station is offline",intercom_station_not_found:"the station was not found",intercom_lock_unknown:"the station has no such door",door_tech_invalid:"invalid value",door_tech_unsupported:"the installed version does not offer this",door_tech_cooldown:"sent a moment ago",door_tech_code_rate_limited:"too many code changes in a short time",door_tech_rate_limited:"too many changes in a short time",door_tech_busy:"another change at the station is still running",door_tech_code_not_set:"the code is not set",relay_map_unreadable:"the door map could not be read",explicit_deny:"the permission is denied at this station",no_binding:"no permission",wall_account:"a display account",intercom_unavailable:"the intercom system is unavailable",intercom_busy:"the intercom system is busy",intercom_rate_limited:"rate limited",rate_limited:"rate limited",timeout:"no answer in time",action_failed:"an unspecified failure",invalid_response:"an unexpected answer",ambiguous_write:"the station did not clearly acknowledge",readback_mismatch:"the read-back did not match",network:"no connection to the server",unknown_reason:"unknown reason"}};function S(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?Ha:qa}var ja=Object.defineProperty,Ba=Object.getOwnPropertyDescriptor,C=(e,t,s,a)=>{for(var n=a>1?void 0:a?Ba(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&ja(t,s,n),n};let x=class extends F{constructor(){super(...arguments),this.station=null,this.live=!0,this.open=!1,this.tab="hold",this.phase="idle",this.view=null,this.programs=null,this.holds={},this.zone="Asia/Jerusalem",this.codes=null,this.codesPhase="idle",this.editing=null,this.codeForm=null,this.pending=null,this.running=null,this.results={},this.seq=0,this.loadedFor=""}mayWrite(){return O("system.configure")||O("access.stations.manage")}willUpdate(e){e.has("station")&&this.station&&this.station.id!==this.loadedFor&&(this.loadedFor=this.station.id,this.reset()),this.hidden=!this.station||!this.mayWrite()}reset(){this.seq++,this.open=!1,this.view=null,this.programs=null,this.holds={},this.codes=null,this.codesPhase="idle",this.phase="idle",this.editing=null,this.codeForm=null,this.pending=null,this.running=null,this.results={}}doors(){return(this.view?.locks??this.station?.locks.map(e=>({door:e.physical_index,name:e.name??null}))??[]).map(e=>e.door)}doorName(e){const t=S();return this.view?.locks.find(a=>a.door===e)?.name?.trim()||p(t.door,{n:e})}async openDialog(){this.open=!0,this.tab="hold",await this.load()}async load(){const e=this.station;if(!e)return;const t=++this.seq;this.phase="loading";try{const s=await Ca(e.id);if(t!==this.seq)return;if(this.view=s,!s.allowed){this.phase="ready";return}const[a,...n]=await Promise.all([rt(e.id),...s.locks.map(i=>Ta(e.id,i.door))]);if(t!==this.seq)return;this.programs=a.programs,this.zone=a.programs?.timezone||n.find(i=>i.hold?.timezone)?.hold?.timezone||this.zone,this.holds=Object.fromEntries(s.locks.map((i,r)=>[i.door,n[r]?.hold?.draft??null])),this.phase="ready"}catch{t===this.seq&&(this.phase="error")}}async loadCodes(){const e=this.station;if(!e)return;const t=this.seq;this.codesPhase="loading";try{const s=await lt(e.id);if(t!==this.seq)return;this.codes=s.codes,this.codesPhase=s.codes?"ready":"error"}catch{t===this.seq&&(this.codesPhase="error")}}pick(e){this.tab=e,this.pending=null,e==="codes"&&this.codesPhase==="idle"&&this.loadCodes()}ask(e){this.pending=e,this.updateComplete.then(()=>{const t=this.renderRoot.querySelector("[data-wk-dt-confirm]");t?.scrollIntoView({block:"nearest"}),t?.querySelector("[data-wk-dt-send]")?.focus()})}async send(){const e=this.pending;!e||this.running||(this.pending=null,await this.execute(e.key,e.kind,e.send))}async execute(e,t,s){const a=this.station?.id;this.running=e,this.results={...this.results,[e]:{kind:t,status:"sending",code:null,retry_after_s:null,data:null}};const n=await s();this.station?.id===a&&(this.running=null,this.results={...this.results,[e]:n},this.dispatchEvent(new CustomEvent("door-tech-changed",{detail:n,bubbles:!0,composed:!0})),await this.load(),e.startsWith("code:")&&await this.loadCodes())}stationName(){return this.station?.name??""}askHoldSave(){const e=this.editing,t=this.station;if(!e||!t||Ke(e.body).length)return;const s=S(),a=Ge(e.body),n=e.door,i=e.revision;this.ask({key:`hold:${n}`,kind:"hold_save",title:s.confirm.hold_save.title,sentence:p(s.confirm.hold_save.one,{name:a.name,door:this.doorName(n),station:this.stationName()}),send:async()=>{const r=await Z("hold_save",()=>Oa(t.id,n,i,a));return r.status==="acknowledged"&&(this.editing=null),r}})}askHoldDelete(e){const t=this.station,s=this.holds[e];if(!t||!s||s.revision===null)return;const a=S(),n=s.revision;this.ask({key:`hold:${e}`,kind:"hold_delete",title:a.confirm.hold_delete.title,sentence:p(a.confirm.hold_delete.one,{door:this.doorName(e),station:this.stationName()}),send:()=>Z("hold_delete",()=>Pa(t.id,e,n))})}askProgramSave(e,t,s){const a=this.station;if(!a)return;const n=S();this.ask({key:`program:${e}`,kind:"program_save",title:n.confirm.program_apply.title,sentence:p(n.confirm.program_apply.one,{name:t.name,door:this.doorName(e),station:this.stationName()}),send:()=>Z("program_save",()=>Aa(a.id,e,s,Ge(t),!0))})}askProgramAction(e,t){const s=this.station;if(!s||e.door===null||e.revision===null)return;const a=S(),n=t==="pause"?a.confirm.program_pause:a.confirm.program_remove,i=e.door,r=e.revision;this.ask({key:`program:${i}`,kind:"program_action",title:n.title,sentence:p(n.one,{door:this.doorName(i),station:this.stationName()}),send:()=>Z("program_action",()=>Ea(s.id,i,r,t))})}async sendCode(e){e.preventDefault();const t=this.codeForm,s=this.station,a=this.view;if(!t||!s||!a||this.running)return;const n=this.renderRoot,i=m=>n.querySelector(`[data-wk-dt-code-field="${m}"]`)?.value??"",r={action:t.action,expected:t.expected,newCode:i("new"),repeatCode:i("repeat"),currentCode:i("current"),typed:i("typed"),phrase:Ze(a.confirm_phrase,t.slot)},d=Fa(r),c=n.querySelector("[data-wk-dt-code-problem]");if(d){c&&(c.textContent=S().codes.problems[d]);return}const h={slot:t.slot,action:t.action,door:t.door,expected:t.expected,newCode:r.newCode,currentCode:r.currentCode,compatibility:t.compatibility,confirmText:r.typed};n.querySelectorAll("[data-wk-dt-code-field]").forEach(m=>m.value=""),r.newCode=r.repeatCode=r.currentCode="",this.codeForm=null,await this.execute(`code:${t.slot}`,"code_write",()=>Z("code_write",()=>La(s.id,h)))}render(){const e=this.station;if(!e||!this.mayWrite())return l;const t=S();return o`<div class="row" data-wk-dt=${e.id}>
        <span class="t"><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</span>
        <wk-action-button icon="door" data-wk-dt-open @click=${()=>void this.openDialog()}>${t.open}</wk-action-button>
      </div>
      ${this.open?this.renderDialog(e):l}`}renderDialog(e){const t=S();return o`<sw-dialog
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
    </sw-dialog>`}renderBody(){const e=S();if(this.phase==="loading"&&!this.view)return o`<p class="note" role="status">${e.loading}</p>`;if(this.phase==="error"&&!this.view)return o`<p class="note" role="status" data-wk-dt-error>${e.unavailable} <wk-action-button tone="quiet" @click=${()=>void this.load()}>${e.retry}</wk-action-button></p>`;const t=this.view;if(!t)return l;if(!t.allowed)return o`<p class="note warn" data-wk-dt-not-allowed>${e.notAllowed}</p>`;if(!t.locks.length)return o`<p class="note" data-wk-dt-no-doors>${e.noDoors}</p>`;const s=["hold","programs","codes","history"];return o`${t.online===!1?o`<p class="note warn" data-wk-dt-offline>${e.offline}</p>`:l}
      <div class="tabs" role="tablist" aria-label=${e.title}>
        ${s.map(a=>o`<button type="button" role="tab" aria-selected=${String(this.tab===a)} data-wk-dt-tab=${a} @click=${()=>this.pick(a)}>${e.tabs[a]}</button>`)}
      </div>
      <div role="tabpanel" data-wk-dt-panel=${this.tab}>
        ${this.tab==="hold"?this.renderHold():this.tab==="codes"?this.renderCodes():this.tab==="programs"?this.renderPrograms():this.renderHistory()}
      </div>`}renderConfirm(e){const t=S();return o`<div class="confirm" role="alertdialog" aria-label=${e.title} data-wk-dt-confirm=${e.kind}>
      <h5>${e.title}</h5>
      <p data-wk-dt-sentence>${e.sentence}</p>
      <div class="btns">
        <wk-action-button tone="primary" data-wk-dt-send ?disabled=${!this.live||!!this.running} @click=${()=>void this.send()}>${t.confirm.send}</wk-action-button>
        <wk-action-button data-wk-dt-cancel @click=${()=>this.pending=null}>${t.confirm.cancel}</wk-action-button>
      </div>
    </div>`}confirmAt(e){return this.pending?.key===e?this.renderConfirm(this.pending):l}result(e){const t=this.results[e];return t?o`<span class="line" role="status" data-wk-dt-result=${e} data-status=${t.status} data-tone=${Xe(t.status)}>${Je(t,S())}</span>`:l}unsupported(e){return this.view?.commands?.[e]?.available===!1}renderHold(){const e=S();return this.editing?this.renderEditor():o`<p class="note">${e.hold.draftNote}</p>
      ${this.doors().map(t=>{const s=this.holds[t]??null,a=s?.policy?ce(s.policy,this.zone):null,n=Ve(a,e),i=`hold:${t}`,r=this.running===i;return o`<div class="door" data-wk-dt-hold=${t}>
          <div class="dh">
            <span class="n">${this.doorName(t)}${a?o` · <bdi>${a.name}</bdi>`:l}</span>
            <div class="btns">
              ${this.unsupported("hold_save")?l:o`<wk-action-button icon=${s?"edit":"plus"} data-wk-dt-hold-edit=${t} ?disabled=${!this.live||!!this.running||s?.revision===null}
                    @click=${()=>this.editing={door:t,revision:s?.revision??0,body:a??Na(this.zone)}}>${s?e.hold.edit:e.hold.add}</wk-action-button>`}
              ${s&&!this.unsupported("hold_delete")?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-hold-delete=${t} ?busy=${r} ?disabled=${!this.live||!!this.running}
                    @click=${()=>this.askHoldDelete(t)}>${e.hold.remove}</wk-action-button>`:l}
            </div>
          </div>
          ${a?o`<div class="lines">${n.length?n.map(d=>o`<bdi>${d}</bdi>`):o`<span>${e.hold.noHours}</span>`}${a.holidays.length?o`<span>${p(e.hold.holidays,{n:a.holidays.length})}</span>`:l}</div>`:o`<span class="line">${e.hold.none}</span>`}
          ${this.confirmAt(i)} ${this.result(i)}
        </div>`})}`}change(e){if(!this.editing)return;const t=structuredClone(this.editing.body);e(t),this.editing={...this.editing,body:t}}periodInputs(e,t,s,a){const n=S().editor;return o`${e.map((i,r)=>o`<span class="period" data-wk-dt-period=${`${t}.${r}`}>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="07:00" aria-label=${n.from} .value=${i.start} @input=${d=>s(r,"start",d.target.value)} />
        <span aria-hidden="true">–</span>
        <input class="hm" inputmode="numeric" maxlength="5" placeholder="19:00" aria-label=${n.to} .value=${i.end} @input=${d=>s(r,"end",d.target.value)} />
        <wk-action-button tone="quiet" icon="close" icon-only label=${n.removePeriod} @click=${()=>a(r)}></wk-action-button>
      </span>`)}`}renderEditor(){const e=S(),t=this.editing,s=t.body,a=Ke(s),n=r=>a.filter(d=>d.field===r||d.field.startsWith(r+".")),i=r=>r.length?o`<span class="problem">${e.editor.problems[r[0].key]}</span>`:l;return o`<div class="form" data-wk-dt-editor=${t.door}>
      <h5>${p(t.revision?e.editor.titleEdit:e.editor.titleNew,{door:this.doorName(t.door)})}</h5>
      <div class="grid2">
        <label class="f">${e.editor.name}<input data-wk-dt-name maxlength="32" .value=${s.name} aria-invalid=${String(!!n("name").length)} @input=${r=>this.change(d=>d.name=r.target.value)} />${i(n("name"))}</label>
        <label class="f">${e.editor.zone}<input class="ltr" data-wk-dt-zone maxlength="64" .value=${s.timezone} @input=${r=>this.change(d=>d.timezone=r.target.value.trim())} />${i(n("timezone"))}</label>
      </div>
      <div>
        <div class="line">${e.editor.week}</div>
        ${se.map(r=>{const d=s.weekly[r]??[];return o`<div class="day" data-wk-dt-day=${r}>
            <span class="dn">${e.dayNames[r]}</span>
            <div>
              <div class="periods">
                ${d.length?l:o`<span class="closed">${e.editor.closed}</span>`}
                ${this.periodInputs(d,r,(c,h,m)=>this.change(w=>w.weekly[r][c][h]=m),c=>this.change(h=>h.weekly[r].splice(c,1)))}
                ${d.length<8?o`<wk-action-button tone="quiet" icon="plus" data-wk-dt-add-period=${r} @click=${()=>this.change(c=>c.weekly[r].push(d.length?{start:"",end:""}:{start:"07:00",end:"19:00"}))}>${e.editor.addPeriod}</wk-action-button>`:l}
              </div>
              ${i(n(`weekly.${r}`))}
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
            ${i(n(`holidays.${d}`))}
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
    </div>`}renderPrograms(){const e=S(),t=this.view?.online!==!1;return o`${this.doors().map(s=>{const a=this.programs?.programs.find(T=>T.door===s)??null,n=this.holds[s]??null,i=n?.policy?ce(n.policy,this.zone):null,r=`program:${s}`,d=!this.live||!!this.running,c=!this.unsupported("program_save"),h=!this.unsupported("program_action"),m=!!a&&!a.enabled&&!a.removing,w=a?a.removing?e.programs.removing:a.enabled?e.programs.on:e.programs.paused:e.programs.none,v=a?.execution?.status?e.programs.exec[a.execution.status]:null,_=a?.policy?ce(a.policy,this.zone):null;return o`<div class="door" data-wk-dt-program=${s} data-state=${a?a.removing?"removing":a.enabled?"on":"paused":"none"}>
        <div class="dh">
          <span class="n">${this.doorName(s)}${_?.name?o` · <bdi>${_.name}</bdi>`:l}</span>
          <sw-badge kind=${a?a.removing?"stale":a.enabled?"live":"offline":"neutral"} label=${w}></sw-badge>
        </div>
        ${_?o`<div class="lines">${Ve(_,e).map(T=>o`<bdi>${T}</bdi>`)}</div>`:l}
        ${v&&a?.enabled?o`<span class="line">${v}</span>`:l}
        <div class="btns">
          ${c&&i&&(!a||m)?o`<wk-action-button tone="primary" icon="play" data-wk-dt-program-apply=${s} ?disabled=${d||!t} @click=${()=>this.askProgramSave(s,i,a?.revision??0)}>${e.programs.apply}</wk-action-button>`:l}
          ${c&&m&&_&&a?.revision!==null?o`<wk-action-button icon="play" data-wk-dt-program-resume=${s} ?disabled=${d||!t} @click=${()=>this.askProgramSave(s,_,a.revision)}>${e.programs.resume}</wk-action-button>`:l}
          ${h&&a?.enabled&&!a.removing?o`<wk-action-button icon="pause" data-wk-dt-program-pause=${s} ?disabled=${d} @click=${()=>this.askProgramAction(a,"pause")}>${e.programs.pause}</wk-action-button>`:l}
          ${h&&a&&!a.removing?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-program-remove=${s} ?disabled=${d} @click=${()=>this.askProgramAction(a,"remove")}>${e.programs.remove}</wk-action-button>`:l}
        </div>
        ${!i&&(!a||m)?o`<span class="line">${e.programs.needDraft}</span>`:l}
        ${i&&a?.enabled?o`<span class="line">${e.programs.pauseFirst}</span>`:l}
        ${this.confirmAt(r)} ${this.result(r)}
      </div>`})}`}renderCodes(){const e=S();if(this.codesPhase==="loading"&&!this.codes)return o`<p class="note" role="status">${e.loading}</p>`;if(this.codesPhase==="error"&&!this.codes)return o`<p class="note" data-wk-dt-codes-error>${e.unavailable} <wk-action-button tone="quiet" @click=${()=>void this.loadCodes()}>${e.retry}</wk-action-button></p>`;const t=this.codes;if(!t)return o`<wk-action-button @click=${()=>void this.loadCodes()}>${e.codes.load}</wk-action-button>`;const s=this.view?.online!==!1,a=!this.unsupported("code_write"),n=this.view?.limits;return o`<p class="note">${e.codes.never}${n?o` ${p(e.codes.rate,{n:n.code_max,m:Math.round(n.code_window_s/60)})}`:l}</p>
      ${this.codeForm?this.renderCodeForm(this.codeForm,t):l}
      ${t.slots.map(i=>{const r=`code:${i.slot}`,d=i.configured===!0?e.codes.set:i.configured===!1?e.codes.notSet:e.codes.unknown,c=!this.live||!!this.running||!s||i.configured===null||!!this.codeForm;return o`<div class="door" data-wk-dt-slot=${i.slot} data-configured=${String(i.configured)}>
          <div class="dh">
            <span class="n">${p(e.codes.slot,{n:i.slot})}</span>
            <sw-badge kind=${i.configured===!0?"live":i.configured===!1?"offline":"unknown"} label=${d}></sw-badge>
          </div>
          ${a?o`<div class="btns">
                <wk-action-button icon="lock" data-wk-dt-code-set=${i.slot} ?disabled=${c}
                  @click=${()=>this.codeForm={slot:i.slot,action:"set",expected:i.configured===!0,door:this.doors()[0]??1,compatibility:!1}}>${i.configured?e.codes.replace:e.codes.define}</wk-action-button>
                ${i.configured?o`<wk-action-button tone="danger" icon="trash" data-wk-dt-code-clear=${i.slot} ?disabled=${c}
                      @click=${()=>this.codeForm={slot:i.slot,action:"clear",expected:!0,door:this.doors()[0]??1,compatibility:!1}}>${e.codes.clear}</wk-action-button>`:l}
              </div>`:l}
          ${this.result(r)}
        </div>`})}`}renderCodeForm(e,t){const s=S(),a=p(s.codes.slot,{n:e.slot}),n=e.action==="clear"?s.codes.formClear:e.expected?s.codes.formReplace:s.codes.formSet,i=Ze(this.view?.confirm_phrase??"קוד {slot}",e.slot),r=this.doors();return o`<form class="confirm" data-wk-dt-code-form=${e.slot} data-action=${e.action} autocomplete="off" @submit=${d=>void this.sendCode(d)}>
      <h5>${p(n,{slot:a})}</h5>
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
    </form>`}renderHistory(){const e=S(),t=this.view?.history??[];return t.length?o`<ul class="hist" data-wk-dt-history>
      ${t.map(s=>{const a=s.kind==="code_write"&&s.slot?p(e.historyCode,{action:e.codeActions[s.code_action??"set"],slot:p(e.codes.slot,{n:s.slot})}):`${s.kind==="program_action"&&s.program_action?e.programActions[s.program_action]:e.kinds[s.kind]}${s.door?` · ${this.doorName(s.door)}`:""}`;return o`<li data-wk-dt-history-row=${s.kind} data-status=${s.status}>
          <span>${a}</span>
          <span class="line" data-tone=${Xe(s.status)}><bdi>${new Date(s.at).toLocaleString(document.documentElement.lang||"he",{dateStyle:"short",timeStyle:"short"})}</bdi> · ${Je(s,e)}</span>
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
  `;C([g({attribute:!1})],x.prototype,"station",2);C([g({type:Boolean})],x.prototype,"live",2);C([u()],x.prototype,"open",2);C([u()],x.prototype,"tab",2);C([u()],x.prototype,"phase",2);C([u()],x.prototype,"view",2);C([u()],x.prototype,"programs",2);C([u()],x.prototype,"holds",2);C([u()],x.prototype,"zone",2);C([u()],x.prototype,"codes",2);C([u()],x.prototype,"codesPhase",2);C([u()],x.prototype,"editing",2);C([u()],x.prototype,"codeForm",2);C([u()],x.prototype,"pending",2);C([u()],x.prototype,"running",2);C([u()],x.prototype,"results",2);x=C([I("wk-door-tech")],x);var Wa=Object.defineProperty,Ua=Object.getOwnPropertyDescriptor,M=(e,t,s,a)=>{for(var n=a>1?void 0:a?Ua(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&Wa(t,s,n),n};const Qe={sync:"refresh",rescan:"search",health_refresh:"activity",clock_refresh:"clock"};let D=class extends F{constructor(){super(...arguments),this.station=null,this.live=!0,this.view=null,this.phase="idle",this.running=null,this.asking=null,this.results={},this.now=Date.now(),this.loadedFor="",this.loadedAt=Date.now(),this.seq=0,this.timer=0}mayRead(){return O("access.admin.read")||O("access.stations.manage")}connectedCallback(){super.connectedCallback(),this.timer=window.setInterval(()=>{this.now=Date.now()},1e3)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("station")&&this.station&&this.station.id!==this.loadedFor&&(this.loadedFor=this.station.id,this.view=null,this.results={},this.asking=null,this.mayRead()&&this.load()),this.hidden=!this.shown()}shown(){return!!this.station&&this.mayRead()&&(this.phase==="ready"||this.phase==="error"||this.phase==="loading"&&!!this.view)}async load(){const e=this.station?.id;if(!e)return;const t=++this.seq;this.phase="loading";try{const s=await Gs(e);if(t!==this.seq)return;this.view=s,this.loadedAt=Date.now(),this.now=this.loadedAt,this.phase="ready"}catch(s){if(t!==this.seq)return;this.phase=s instanceof B&&(s.status===403||s.status===404)?"hidden":"error"}}async run(e){const t=this.station;if(!t||this.running)return;this.asking=null,this.running=e,this.results={...this.results,[e]:{station_id:t.id,action:e,status:"sending",code:null,retry_after_s:null,data:null}};const s=await ft(t.id,e);this.station?.id===t.id&&(this.running=null,this.results={...this.results,[e]:s},this.dispatchEvent(new CustomEvent("station-op",{detail:s,bubbles:!0,composed:!0})),await this.load())}cooldownLeft(e){const t=this.view?.actions?.[e]?.cooldown_s??0;return Math.max(0,Math.ceil(t-(this.now-this.loadedAt)/1e3))}render(){const e=this.station;if(!e||!this.shown())return l;const t=N();return o`<div class="wrap" data-wk-maint=${e.id} data-wk-maint-state=${this.phase}>
      <div class="head">
        <h5><sw-icon name="wrench" size=${14}></sw-icon>${t.title}</h5>
        <wk-action-button tone="quiet" icon="refresh" data-wk-maint-reload ?busy=${this.phase==="loading"} ?disabled=${this.phase==="loading"} @click=${()=>void this.load()}>${t.refresh}</wk-action-button>
      </div>
      ${this.phase==="error"&&!this.view?o`<div class="note" role="status" data-wk-maint-error>${t.unavailable}</div>`:l}
      ${this.view?this.renderHealth(e):l} ${this.view?this.renderOps(e):l} ${this.renderConfirm(e)}
    </div>`}renderHealth(e){const t=this.view,s=N();if(t.health_hidden)return o`<div class="note" data-wk-maint-hidden>${s.healthHidden}</div>`;const a=e.zone,n=t.technical,i=t.report?.health??null,r=n?.reconciled_at??t.report?.auth?.last_sync_ok_at??null,d=i?.events?.stream??n?.event_status?.stream??null,c=i?.clock??n?.clock??null,h=c?.skew_seconds,m=i?.access?.last_error??n?.last_error??null,w=Js(t),v=Xs(t,s),_=t.report?.auth?.retained??0,T=q=>fe(q,this.now,a,z());return o`<dl class="kv" data-wk-maint-health>
      <dt>${s.rows.lastSync}</dt>
      <dd data-wk-maint-last-sync><bdi>${r?T(r):s.never}</bdi></dd>
      ${n?.scanned_at?o`<dt>${s.rows.lastScan}</dt><dd><bdi>${T(n.scanned_at)}</bdi></dd>`:l}
      ${d?o`<dt>${s.rows.stream}</dt><dd data-wk-maint-stream=${d}>${s.stream[d]??s.stream.unknown}</dd>`:l}
      ${c?o`<dt>${s.rows.clock}</dt><dd data-wk-maint-clock>${h==null?s.clockStatus[c.status??""]??s.clockStatus.unavailable:Math.abs(h)<=2?s.clockOk:p(s.clockSkew,{n:Math.round(h)})}${c.checked_at?o` <span class="sub">· <bdi>${T(c.checked_at)}</bdi></span>`:l}</dd>`:l}
      ${i&&(i.consecutive_poll_failures??0)>0?o`<dt>${s.rows.polls}</dt><dd>${i.consecutive_poll_failures}</dd>`:l}
      <dt>${s.rows.lastError}</dt>
      <dd data-wk-maint-last-error>${m?o`${ve(m,s)}${ve(m,s)!==m?o` <code>${m}</code>`:l}`:o`<span class="sub">${s.none}</span>`}</dd>
      <dt>${s.rows.auth}</dt>
      <dd>
        <div class="auth ${w||v.length?"bad":""}" data-wk-maint-auth=${w?w.source:"none"}>
          ${w?o`<span data-wk-maint-auth-line>${w.step?p(s.authLine,{source:s.authSources[w.source]??w.source,step:Qs(w.step,s),at:w.at?T(w.at):s.never}):p(s.authObserved,{source:s.authSources[w.source]??w.source,at:w.at?T(w.at):s.never})}</span>${w.status_code!==null&&w.status_code!==void 0?o`<span class="sub">${p(s.authCode,{code:`${w.status_code}${w.sub_status?` / ${w.sub_status}`:""}`})}</span>`:l}`:o`<span class="sub">${s.authNone}</span>`}
          ${v.length?o`<span data-wk-maint-auth-now>${p(s.authNow,{what:v.join(" · ")})}</span>`:l}
          ${_>0?o`<span class="sub" data-wk-maint-auth-count>${p(s.authCount,{n:_})}</span>`:l}
        </div>
      </dd>
    </dl>`}renderOps(e){const t=this.view,s=N(),a=pt.filter(i=>t.actions?.[i]?.allowed);if(!a.length)return l;const n=t.online??e.online;return o`${n?l:o`<div class="note" data-wk-maint-offline>${s.offlineHint}</div>`}
      <div class="ops" data-wk-maint-ops>
        ${a.map(i=>{const r=t.actions[i].needs_online,d=this.cooldownLeft(i),c=this.running===i,h=!this.live||!!this.running||r&&!n||d>0,m=this.results[i],w=t.last_runs?.[i]??null,v=m?be(m.status,m.code,s):d>0?p(s.cooldown,{n:d}):w?p(s.lastRun,{status:be(w.status,w.code,s),at:fe(w.at,this.now,e.zone,z())}):"",_=m?ke(m.status):w?ke(w.status):"busy";return o`<div class="op">
            <wk-action-button icon=${Qe[i]} data-wk-maint-op=${i} ?busy=${c} ?disabled=${h} @click=${()=>this.asking=i}>${s.actions[i]}</wk-action-button>
            <span class="line" role="status" data-wk-maint-result=${i} data-status=${m?.status??w?.status??""} data-tone=${m||w?_:""}>${v}</span>
          </div>`})}
      </div>`}renderConfirm(e){const t=this.asking;if(!t)return l;const s=N(),a=s.confirm[t];return o`<sw-dialog open heading=${a.title} data-wk-maint-confirm=${t} @close=${n=>n.target===n.currentTarget&&(this.asking=null)}>
      <p class="sentence" data-wk-maint-sentence>${p(a.one,{name:e.name})}</p>
      <div slot="footer">
        <wk-action-button data-wk-maint-cancel @click=${()=>this.asking=null}>${s.confirm.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon=${Qe[t]} data-wk-maint-send ?disabled=${!this.live} @click=${()=>void this.run(t)}>${s.confirm.send}</wk-action-button>
      </div>
    </sw-dialog>`}};D.styles=j`
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
  `;M([g({attribute:!1})],D.prototype,"station",2);M([g({type:Boolean})],D.prototype,"live",2);M([u()],D.prototype,"view",2);M([u()],D.prototype,"phase",2);M([u()],D.prototype,"running",2);M([u()],D.prototype,"asking",2);M([u()],D.prototype,"results",2);M([u()],D.prototype,"now",2);D=M([I("wk-station-maintenance")],D);var Ka=Object.defineProperty,Ga=Object.getOwnPropertyDescriptor,ne=(e,t,s,a)=>{for(var n=a>1?void 0:a?Ga(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&Ka(t,s,n),n};const Va=8,Ya=3e4,Za=`
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
`;let J;function Ja(){if(J===void 0)try{J=new CSSStyleSheet,J.replaceSync(Za)}catch{J=null}return J}function Xa(e){const t=Ja(),s=e;if(!(!t||!("adoptedStyleSheets"in s)||s.adoptedStyleSheets.includes(t)))try{s.adoptedStyleSheets=[...s.adoptedStyleSheets,t]}catch{}}let K=class extends F{constructor(){super(...arguments),this.stationId="",this.zone="",this.rows=null,this.next=null,this.timer=0}createRenderRoot(){return this}allowed(){return X()&&O("access.read")&&(O("access.events.read")||O("access.call"))}connectedCallback(){super.connectedCallback(),Xa(this.getRootNode()),this.style.display="contents",this.timer=window.setInterval(()=>{document.hidden||this.load(!1)},Ya)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}willUpdate(e){e.has("stationId")&&(this.rows=null,this.next=null,this.load(!1))}async load(e){if(!this.stationId||!this.allowed())return;const t=this.stationId;try{const s=await Mt(t,Va,e?this.next:null);if(t!==this.stationId)return;this.rows=e?[...this.rows??[],...s.calls]:s.calls,this.next=s.next}catch{}}when(e){const t=new Date(e),s={day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:!1},a=document.documentElement.lang||"he";try{return new Intl.DateTimeFormat(a,this.zone?{...s,timeZone:this.zone}:s).format(t)}catch{return new Intl.DateTimeFormat(a,s).format(t)}}render(){if(!this.allowed()||!this.rows?.length)return l;const e=Nt(),t=e.log;return o`<section class="dsec" data-wk-dsec="calls" data-call-log="ready">
      <h4><sw-icon name="history" size=${14}></sw-icon>${t.title}</h4>
      <ul>
        ${this.rows.map(s=>{const a=Rt(s,e),n=Ft(s);return o`<li data-call-row=${s.id} data-outcome=${s.outcome??s.state} data-tone=${a.tone}>
            <span class="cw" dir="ltr">${this.when(s.rang_at)}</span>
            <span class="cx"><span>${a.text}</span>${s.door_opened_at?o`<small data-call-row-door>${It(t.door,{name:s.door_opened_by_name||""})}</small>`:l}</span>
            <span class="cd" dir="ltr">${n!==null?qt(n):""}</span>
          </li>`})}
      </ul>
      ${this.next?o`<button class="cm" data-call-log-more @click=${()=>void this.load(!0)}>${t.more}</button>`:l}
    </section>`}};ne([g({attribute:"station-id"})],K.prototype,"stationId",2);ne([g()],K.prototype,"zone",2);ne([u()],K.prototype,"rows",2);ne([u()],K.prototype,"next",2);K=ne([I("wk-call-history")],K);function Qa(e,t){return o`<wk-call-history station-id=${e} zone=${t?.kind==="iana"?t.name:""}></wk-call-history>`}function en(e){return!X()||!O("access.stations.manage")?l:o`<dt>בדיקת קבלה</dt><dd><a href=${js(e)} data-wk-live-validation=${e}>הרצת בדיקת קבלה לעמדה</a></dd>`}const gt=(e,t)=>t.zone??e.defaultZone,H=(e,t)=>fe(t.last_seen,e.now,gt(e,t),e.text),ue=e=>t=>{t.stopPropagation(),e()};function Ce(e,t){return t.camera_entity?e.media?e.failed[t.id]===e.poster?"failed":"image":"none":t.has_camera?"none":"nocam"}const Te=(e,t)=>ot(t.id,e.poster);function vt(e,t,s){const a=e.text.still,n=s==="nocam"?a.none:s==="failed"?a.failed:a.offline;return o`<div class="none" role="status"><sw-icon name=${s==="nocam"?"camera":"offline"} size=${20}></sw-icon><span>${t.online||s==="nocam"?n:a.offline}</span></div>`}function tn(e,t){if(!ut(t)&&!(t.online&&t.call_state==="ending"))return l;if(!V(e.policy,e.rights))return l;const s=t.call_state==="ringing";return o`<span class="callbadge ${t.call_state}" data-wk-call-badge=${t.call_state}>${s?o`<sw-icon name="bell" size=${14}></sw-icon>`:o`<span class="ic">${pe("phone",14)}</span>`}${ee(t.call_state,e.text)}</span>`}function sn(e,t){const s=e.text,a=Ce(e,t),n=we(t.id,e.places),i=t.online?`${s.still.tag} · ${ct(e.poster)}`:H(e,t);return o`<div class="media ${t.online?"":"off"}" data-wk-still=${t.id} data-still-state=${a}>
    ${a==="image"?o`<img src=${Te(e,t)} alt=${p(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} /><span class="stamp"><bdi>${i}</bdi></span>`:vt(e,t,a)}
    ${tn(e,t)}
    <button type="button" class="open" data-wk-open=${t.id} aria-label=${t.name} @click=${()=>e.open(t.id)}></button>
    <div class="scrim"><span class="name">${t.name}</span>${n?o`<span class="place">${n}</span>`:l}</div>
  </div>`}function an(e,t){const s=Ce(e,t);return o`<span class="thumb ${t.online?"":"off"}" data-wk-thumb=${t.id}>${s==="image"?o`<img src=${Te(e,t)} alt="" decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:o`<sw-icon name="camera" size=${18}></sw-icon>`}</span>`}function Q(e,t,s,a,n,i){const r=e.actions.armed,d=!!r&&r.id===t.id&&r.command===s&&r.callState===t.call_state;return o`<wk-action-button
    tone=${a}
    icon=${n}
    data-wk-call=${s}
    ?armed=${d}
    ?disabled=${!e.live||e.actions.callBusy.has(t.id)}
    label=${d?p(e.text.call.armedAria,{label:i}):i}
    @click=${c=>{c.stopPropagation(),e.call(t,s,c)}}
    >${d?e.text.call.armed:i}</wk-action-button
  >`}function nn(e,t=!1){const s=e.text.talk;return o`<wk-action-button tone="dashed" icon="window" href=${U()} data-wk-talk="classic" label=${s.hint} ?block=${t} size=${t?"lg":"md"} @click=${a=>a.stopPropagation()}
    >${t?s.classic:s.classicShort}</wk-action-button
  >`}function bt(e,t,s){const a=e.talkControl?.(t,s);return a!==void 0?a:e.rights.talk?nn(e,s):l}function kt(e,t,s=!1){const a=e.text,n=t.online?t.call_state:"unavailable";if(n!=="ringing"&&n!=="in_call"&&n!=="ending")return l;if(!V(e.policy,e.rights))return l;const i=e.clock.seconds(t.id,e.now),r=n==="ringing"?o`<sw-icon name="bell" size=${15}></sw-icon>`:pe("phone",15),d=e.rights.call&&n!=="ending";return o`<div class="callrow ${n} ${s?"big":""}" data-wk-call-row=${t.id} data-call=${n} role="group" aria-label=${a.call.group}>
    <span class="cs">${r}<span>${ee(n,a)}</span>${i!==null?o`<span class="dur" data-wk-call-clock>${ge(i)}</span>`:l}</span>
    ${d?o`<span class="ctl">${n==="ringing"?o`${Q(e,t,"answer","ok","phone",a.call.answer)}${Q(e,t,"reject","danger","close",a.call.reject)}`:o`${s?l:bt(e,t,!1)}${Q(e,t,"hangUp","danger","hangup",a.call.hangUp)}`}</span>`:l}
  </div>`}function Oe(e,t){if(!e.rights.door)return l;const s=e.text.door;return o`${te(t).map(a=>{const n=`${t.id}/${a.physical_index}`,i=e.actions.isHeld(n),r=e.actions.releasing.has(n),d=i?"held":r?"sending":"idle",c=i?s.held:r?s.sending:t.locks.length>1?p(s.openNamed,{name:Se(a,e.text)}):s.open;return o`<wk-action-button
      class="grow"
      icon="unlock"
      data-wk-door=${n}
      data-state=${d}
      ?busy=${r}
      ?disabled=${!e.live||!t.online||r||i}
      @click=${ue(()=>e.door(t,a.physical_index))}
      >${c}</wk-action-button
    >`})}`}function on(e,t){return!e.rights.announce||!t.online?l:o`<wk-action-button icon="volume" icon-only data-wk-announce-at=${t.id} label=${e.text.announce} ?disabled=${!e.live} @click=${ue(()=>e.announce(t.id))}></wk-action-button>`}function yt(e,t,s=!1){const a=e.actions.results[t.id];return a?o`<div class="result ${a.tone} ${s?"sticky":""}" role="status" data-wk-result=${t.id} data-tone=${a.tone}>${a.text}</div>`:l}function rn(e,t,s){t.composedPath().some(n=>n instanceof HTMLElement&&n.matches("button, a, wk-action-button, select, input, textarea, summary"))||e.open(s)}function ln(e,t){const s=t.technical;return s?o`<div class="tech" data-wk-tech-row>
    <sw-badge kind=${ze(t.sync_state)} label=${me(t.sync_state,e.text)} data-wk-sync=${t.sync_state}></sw-badge>
    <span class="sp"></span>
    ${s.model?o`<code>${s.model}</code>`:l}
  </div>`:l}function dn(e,t){const s=e.text,a=ht(t),n=e.rights.door&&te(t).length>0||e.rights.announce&&t.online;return o`<sw-card flush interactive class="card ${a==="ringing"?"ringing":""}" data-wk-station=${t.id} data-status=${a} @click=${i=>rn(e,i,t.id)}>
    ${sn(e,t)}
    <div class="cb">
      <div class="hd">
        <sw-badge kind=${t.online?"live":"offline"} label=${t.online?s.status.online:s.status.offline}></sw-badge>
        <span>${s.seen.prefix} <b><bdi>${H(e,t)}</bdi></b></span>
      </div>
      ${kt(e,t)}
      ${n?o`<div class="acts">${Oe(e,t)}${on(e,t)}</div>`:l}
      ${yt(e,t)} ${ln(e,t)}
    </div>
  </sw-card>`}function ye(e,t,s=!1){const a=t.online?t.call_state:"";if(a!=="ringing"&&a!=="in_call"&&a!=="ending")return l;if(!V(e.policy,e.rights))return l;const n=e.clock.seconds(t.id,e.now),i=`${ee(a,e.text)}${n!==null?` · ${ge(n)}`:""}`;return s?o`<sw-badge kind=${a==="ringing"?"stale":"recorded"} label=${i} data-wk-call-pill=${a}></sw-badge>`:o`<span class="pillcall ${a}" data-wk-call-pill=${a}>${ee(a,e.text)}${n!==null?o` · <span class="dur">${ge(n)}</span>`:l}</span>`}function cn(e,t){const s=e.text,n=[we(t.id,e.places),t.technical?me(t.sync_state,s):""].filter(Boolean).join(" · "),i=e.rights.call&&t.online&&t.call_state==="ringing"&&V(e.policy,e.rights);return o`<div class="row" data-wk-station=${t.id} data-status=${ht(t)}>
    <button type="button" class="rowmain" data-wk-open=${t.id} @click=${()=>e.open(t.id)}>
      ${an(e,t)}
      <span class="rowtext"><span class="t"><span class="sdot ${t.online?"":"off"}" aria-hidden="true"></span><b>${t.name}</b></span>${n?o`<span class="s">${n}</span>`:l}</span>
    </button>
    <div class="rowside">
      ${ye(e,t)}
      <span class="seen">${s.seen.prefix} <bdi>${H(e,t)}</bdi></span>
      <div class="rowacts">
        ${i?Q(e,t,"answer","ok","phone",s.call.answer):l}${Oe(e,t)}
      </div>
      <sw-icon name="chevron" size=${16} aria-hidden="true"></sw-icon>
    </div>
  </div>`}function hn(e,t){return o`<sw-card flush class="rows-card"><div class="rows" data-wk-rows>${it(t,s=>s.id,s=>cn(e,s))}</div></sw-card>`}function un(e,t){return o`<div class="grid" data-wk-grid>${it(t,s=>s.id,s=>dn(e,s))}</div>`}function pn(e,t){const s=e.text,a=c=>c,n=t.some(c=>c.technical),i=o`<span style="color:var(--sw-text-3)">—</span>`,r=e.table==="compact"||e.table==="none",d=[{key:"name",label:s.table.station,render:c=>o`<wk-action-button tone="quiet" data-wk-open=${a(c).id} @click=${()=>e.open(a(c).id)}>${a(c).name}</wk-action-button>`},{key:"status",label:s.table.status,render:c=>{const h=a(c),m=o`<sw-badge kind=${h.online?"live":"offline"} label=${h.online?s.status.online:s.status.offline}></sw-badge>`;if(!r)return m;const w=ye(e,h,!0),v=h.online?l:o`<small style="color:var(--sw-text-3);font-size:var(--sw-fs-xs)"><bdi>${H(e,h)}</bdi></small>`;return w===l&&v===l?m:o`<span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:var(--sw-s-1)">${m}${w}${v}</span>`}}];return r||d.push({key:"call",label:s.table.call,render:c=>ye(e,a(c),!0)}),d.push({key:"actions",label:s.table.actions,render:c=>{const h=a(c),m=e.rights.call&&h.online&&h.call_state==="ringing"&&V(e.policy,e.rights);return o`<span style="display:inline-flex;flex-wrap:wrap;align-items:center;gap:var(--sw-s-2);max-inline-size:190px">${m?Q(e,h,"answer","ok","phone",s.call.answer):l}${Oe(e,h)}</span>`}}),r||d.push({key:"place",label:s.table.place,render:c=>o`<span style="display:inline-block;white-space:normal;max-inline-size:130px;vertical-align:middle">${we(a(c).id,e.places)||"—"}</span>`},{key:"seen",label:s.table.seen,render:c=>o`<bdi>${H(e,a(c))}</bdi>`}),e.table==="full"&&d.push({key:"doors",label:s.table.doors,render:c=>o`<span style="display:inline-block;white-space:normal;max-inline-size:120px;vertical-align:middle">${te(a(c)).map(h=>Se(h,s)).join(", ")||"—"}</span>`}),n&&(d.push({key:"sync",label:s.table.sync,render:c=>a(c).technical?o`<sw-badge kind=${ze(a(c).sync_state)} label=${me(a(c).sync_state,s)}></sw-badge>`:i}),e.table==="full"&&d.push({key:"model",label:s.table.model,ltr:!0,render:c=>{const h=a(c).technical;return h?.model||h?.firmware?o`<span style="display:inline-block;vertical-align:middle">${h.model?o`<span style="display:block">${h.model}</span>`:l}${h.firmware?o`<span style="display:block;color:var(--sw-text-3)">${h.firmware}</span>`:l}</span>`:i}})),d}function wn(e,t){const s=t.technical;if(!s)return l;const a=e.text,n=s.reconciled_at&&/(Z|[+-]\d\d:\d\d)$/.test(s.reconciled_at)?bs(Date.parse(s.reconciled_at),e.now,gt(e,t)??void 0,a):"",i=s.clock?.skew_seconds,r=i==null?"":Math.abs(i)<=2?a.tech.clockOk:p(a.tech.clockDrift,{n:Math.round(i)}),d=s.event_status?.stream,c=d?d==="connected"?a.tech.streamOk:["disconnected","unavailable","stopped","authentication_failed"].includes(d)?a.tech.streamDown:a.tech.streamUnknown:"";return o`<section class="dsec" data-wk-dsec="technical">
    <h4><sw-icon name="cpu" size=${14}></sw-icon>${a.drawer.technical}</h4>
    <dl class="kv">
      <dt>${a.tech.sync}</dt>
      <dd><sw-badge kind=${ze(t.sync_state)} label=${me(t.sync_state,a)}></sw-badge>${n?o` · <bdi>${n}</bdi>`:l}</dd>
      ${s.model?o`<dt>${a.tech.model}</dt><dd><code>${s.model}</code></dd>`:l}
      ${s.firmware?o`<dt>${a.tech.firmware}</dt><dd><code>${s.firmware}</code></dd>`:l}
      <dt>${a.tech.relays}</dt>
      <dd>${p(a.tech.relaysValue,{n:t.locks.length,mode:t.lock_enabled?a.tech.relayOn:a.tech.relayOff})}</dd>
      ${en(t.id)}
      ${r?o`<dt>${a.tech.clock}</dt><dd>${r}</dd>`:l} ${c?o`<dt>${a.tech.stream}</dt><dd>${c}</dd>`:l}
      ${t.errors?o`<dt>${a.tech.lastError}</dt><dd>${t.errors.last_error?o`<code data-wk-last-error>${t.errors.last_error}</code>`:o`<span class="muted">${a.tech.none}</span>`}</dd>`:l}
      ${t.errors?.scan_error?o`<dt>${a.tech.scanError}</dt><dd><code>${t.errors.scan_error}</code></dd>`:l}
    </dl>
    <wk-deep-links place="station"></wk-deep-links>
    <wk-station-maintenance .station=${t} ?live=${e.live}></wk-station-maintenance>
  </section>`}function $t(e,t){const s=e.text.prog;if(t.state==="ready")return l;const a=t.state==="unsupported"?s.unsupported:t.state==="busy"?s.busy:t.state==="error"?s.unavailable:s.loading;return o`<div class="muted" role="status" data-wk-fetch=${t.state}>${a}${t.state==="error"||t.state==="busy"?o` · <wk-action-button tone="quiet" @click=${()=>e.retryDetail()}>${e.text.retry}</wk-action-button>`:l}</div>`}function mn(e,t,s){const a=e.text;if(!s||s.programs.state!=="ready")return s?$t(e,s.programs):o`<div class="muted" role="status" data-wk-fetch="loading">${a.prog.loading}</div>`;const n=ks(s.programs.data,t,a);return n.length?o`${n.map(i=>o`<div class="prog" data-wk-program=${i.door}>
      <div class="ph">
        <span>${i.name}</span>
        ${i.none?o`<sw-badge kind="neutral" label=${a.prog.none}></sw-badge>`:o`<sw-badge kind=${i.removing?"stale":i.enabled?"live":"offline"} label=${i.removing?a.prog.removing:i.enabled?a.prog.on:a.prog.off}></sw-badge>${i.status&&i.enabled&&!i.removing?o`<sw-badge kind="recorded" label=${i.status}></sw-badge>`:l}`}
      </div>
      ${i.hours.map(r=>o`<div class="line">${a.prog.hours}: <bdi>${r}</bdi></div>`)}
      ${i.holidays?o`<div class="line muted">${p(a.prog.holidays,{n:i.holidays})}</div>`:l}
      ${i.error?o`<div class="line"><sw-badge kind="error" label=${a.prog.error}></sw-badge></div>`:l}
      ${!i.none&&i.unreadable?o`<div class="line muted">${a.prog.unknownShape}</div>`:l}
    </div>`)}`:l}function fn(e,t){const s=e.text;if(!t)return l;if(t.codes.state!=="ready")return o`<div class="prog">${$t(e,t.codes)}</div>`;const a=ys(t.codes.data,s);return o`<div class="prog" data-wk-codes=${a.state}>
    <div class="ph"><span>${s.prog.codes}</span><sw-badge kind=${a.state==="set"?"live":a.state==="unset"?"offline":"unknown"} label=${a.label}></sw-badge></div>
    ${a.slots.length>1?a.slots.map(n=>o`<div class="line">${n.label}: ${n.state==="set"?s.prog.codeConfigured:n.state==="unset"?s.prog.codeNotConfigured:s.prog.codeUnknown}</div>`):l}
  </div>`}function gn(e,t){if(!t.technical)return l;const s=e.features.door_programs!==!1,a=e.features.public_codes!==!1;if(!s&&!a)return l;const n=e.text,i=e.detail[t.id];return o`<section class="dsec" data-wk-dsec="settings">
    <button type="button" class="toggle" aria-expanded=${String(e.detailOpen)} data-wk-settings-toggle @click=${()=>e.toggleDetail()}>
      <sw-icon name="chevronDown" size=${14}></sw-icon><span>${n.drawer.doorSettings}</span>
    </button>
    ${e.detailOpen?o`${s&&te(t).length?mn(e,t,i):l}${a?fn(e,i):l}`:l}
    ${e.detailOpen?o`<wk-door-tech .station=${t} ?live=${e.live} @door-tech-changed=${()=>e.retryDetail()}></wk-door-tech>`:l}
  </section>`}function vn(e,t){const s=fs(t.id,Ee.events==="smplwise",O("access.events.read")),a=gs(t,Ee.schedules==="smplwise",O("access.stations.read"));return!s&&!a?l:o`<div class="evlink">
    ${s?o`<wk-action-button tone="quiet" icon="history" href=${s} data-wk-station-events=${t.id}>${vs("stationEvents")}</wk-action-button>`:l}
    ${a?o`<wk-action-button tone="quiet" icon="calendar" href=${a} data-wk-station-schedules=${t.id}>${e.text.drawer.schedules}</wk-action-button>`:l}
  </div>`}function bn(e,t){const s=e.text,a=Ce(e,t),n=we(t.id,e.places),i=te(t),r=e.rights.call||V(e.policy,e.rights)&&(t.online?["ringing","in_call","ending"].includes(t.call_state):!1),d=t.online&&["ringing","in_call","ending"].includes(t.call_state),c=e.actions.tts[t.id],h=c?dt(c,s):"",m=e.liveArea?.(t)??null,w=e.rights.call&&t.online?e.dialControl?.(t,d):void 0;return o`
    ${m??o`<div class="live ${t.online?"":"off"}" data-wk-live data-still-state=${a}>
      ${a==="image"?o`<img src=${Te(e,t)} alt=${p(s.still.alt,{name:t.name})} decoding="async" @error=${()=>e.stillError(t.id,e.poster)} />`:vt(e,t,a)}
      ${a==="image"?o`<span class="stamp"><bdi>${s.drawer.lastStill} · ${t.online?ct(e.poster):H(e,t)}</bdi></span>`:l}
      <div class="ov"><span class="t"><sw-icon name="play" size=${16}></sw-icon>${s.drawer.liveClassic}</span><wk-action-button icon="window" href=${U()} data-wk-classic-link>${s.drawer.openClassic}</wk-action-button></div>
    </div>`}
    <div class="meta">${n?o`<span>${n}</span>`:l}<span>${s.seen.prefix} <bdi>${H(e,t)}</bdi></span></div>
    ${vn(e,t)}
    ${yt(e,t,!0)}
    ${r?o`<section class="dsec" data-wk-dsec="call">
          <h4>${pe("phone",14)}${s.drawer.call}</h4>
          ${d?o`${kt(e,t,!0)}${t.call_state==="in_call"?bt(e,t,!0):l}`:o`<div class="callrow"><span class="cs muted">${s.call.none}</span>${e.rights.call&&t.online&&w===void 0?o`<wk-action-button tone="dashed" icon="phone" href=${U()} data-wk-dial>${s.call.dial}</wk-action-button>`:l}</div>`}
          ${w??l}
        </section>`:l}
    ${i.length||e.rights.door?o`<section class="dsec" data-wk-dsec="doors">
          <h4><sw-icon name="door" size=${14}></sw-icon>${s.drawer.doors}</h4>
          ${i.length?i.map(v=>{const T=e.detail[t.id]?.programs.data?.programs.find(q=>q.door===v.physical_index)?.execution?.status==="held_acknowledged";return o`<div class="doorrow" data-wk-doorrow=${v.physical_index}>
                  <span class="dn">${Se(v,s)}</span>
                  <span class="ds">${T?o`<sw-icon name="clock" size=${12}></sw-icon>${s.prog.state.held_acknowledged}`:l}</span>
                  ${e.rights.door?o`<wk-action-button
                        icon="unlock"
                        data-wk-door=${`${t.id}/${v.physical_index}`}
                        data-state=${e.actions.isHeld(`${t.id}/${v.physical_index}`)?"held":e.actions.releasing.has(`${t.id}/${v.physical_index}`)?"sending":"idle"}
                        ?busy=${e.actions.releasing.has(`${t.id}/${v.physical_index}`)}
                        ?disabled=${!e.live||!t.online||e.actions.releasing.has(`${t.id}/${v.physical_index}`)||e.actions.isHeld(`${t.id}/${v.physical_index}`)}
                        @click=${ue(()=>e.door(t,v.physical_index))}
                        >${e.actions.isHeld(`${t.id}/${v.physical_index}`)?s.door.held:e.actions.releasing.has(`${t.id}/${v.physical_index}`)?s.door.sending:s.door.open}</wk-action-button
                      >`:l}
                </div>`}):o`<span class="muted">${s.door.none}</span>`}
        </section>`:l}
    ${e.rights.announce?o`<section class="dsec" data-wk-dsec="announce">
          <h4><sw-icon name="volume" size=${14}></sw-icon>${s.drawer.announce}</h4>
          <div class="callrow"><span class="cs muted" data-wk-announce-state>${h||s.drawer.announceHint}</span><wk-action-button icon="volume" data-wk-announce-at=${t.id} ?disabled=${!e.live||!t.online} @click=${ue(()=>e.announce(t.id))}>${s.announce}</wk-action-button></div>
        </section>`:l}
    ${Qa(t.id,t.zone)}
    ${wn(e,t)} ${gn(e,t)}
  `}var kn=Object.defineProperty,yn=Object.getOwnPropertyDescriptor,k=(e,t,s,a)=>{for(var n=a>1?void 0:a?yn(t,s):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(a?r(t,s,n):r(n))||n);return a&&n&&kn(t,s,n),n};const xt="sw.wiskey.stations.view",_t="sw.wiskey.stations.treeCollapsed",et=3e4;function St(e){try{return localStorage.getItem(e)}catch{return null}}function tt(e,t){try{localStorage.setItem(e,t)}catch{}}const $n=()=>{const e=St(xt);return e==="list"||e==="table"?e:"cards"},xn=()=>{try{const e=JSON.parse(St(_t)??"[]");return new Set(Array.isArray(e)?e.filter(t=>typeof t=="string"):[])}catch{return new Set}},le={kind:"iana",name:"Asia/Jerusalem"},st=[{id:"d1",name:"שער ראשי",online:!0,call_state:"ringing",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:le,technical:null,errors:null},{id:"d2",name:"לובי",online:!0,call_state:"idle",sync_state:"synced",lock_enabled:!0,locks:[{physical_index:1,name:"כניסה"},{physical_index:2,name:"מחסום"}],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:le,technical:null,errors:null},{id:"d3",name:"חניון",online:!0,call_state:"idle",sync_state:"pending",lock_enabled:!1,locks:[],has_camera:!0,camera_entity:null,last_seen:"2026-09-27T08:00:00+03:00",zone:le,technical:null,errors:null},{id:"d4",name:"מחסן",online:!1,call_state:"unavailable",sync_state:"offline",lock_enabled:!0,locks:[{physical_index:1,name:null}],has_camera:!1,camera_entity:null,last_seen:"2026-09-26T19:02:00+03:00",zone:le,technical:null,errors:null}];let f=class extends F{constructor(){super(...arguments),this.feed=null,this.error="",this.forbidden=!1,this.filter="all",this.query="",this.view=$n(),this.place="all",this.places=null,this.collapsed=xn(),this.selected=null,this.sheet=!1,this.announceOpen=!1,this.announceFor="",this.policy=$s,this.features={},this.detail={},this.detailOpen=!1,this.now=Date.now(),this.poster=Date.now(),this.failed={},this.table=qe(typeof window>"u"?1440:window.innerWidth),this.mediaMode="off",this.media={},this.mediaAt={},this.cardPage=1,this.perPage=0,this.fitObserver=null,this.fitGrid=null,this.mqd=typeof matchMedia=="function"?matchMedia("(min-width: 1101px)"):null,this.clock=new xs,this.actions=new he({release:(e,t)=>Bt(e,t),signal:(e,t)=>jt(e,t),station:e=>this.list().find(t=>t.id===e),live:()=>this.isLive(),now:()=>Date.now(),tick:()=>performance.now(),after:(e,t)=>window.setTimeout(e,t),cancel:e=>window.clearTimeout(e),changed:()=>this.requestUpdate(),refetch:()=>void this.load(),stamp:()=>Ht(new Date)}),this.stop=null,this.stopRoute=null,this.poll=0,this.tickTimer=0,this.posterTimer=0,this.loading=!1,this.loadAgain=!1,this.placesKey="",this.detailAt={},this.mqc=typeof matchMedia=="function"?matchMedia(`(max-width: ${_s}px)`):null,this.mqm=typeof matchMedia=="function"?matchMedia(`(max-width: ${Ss}px)`):null,this.mqn=typeof matchMedia=="function"?matchMedia(`(max-width: ${zs-1}px)`):null,this.onMedia=()=>{this.table=qe(window.innerWidth)},this.onFitMedia=()=>{this.perPage=0,this.watchFit()}}connectedCallback(){if(super.connectedCallback(),this.mqc?.addEventListener("change",this.onMedia),this.mqm?.addEventListener("change",this.onMedia),this.mqn?.addEventListener("change",this.onMedia),this.mqd?.addEventListener("change",this.onFitMedia),this.stopRoute=Wt(e=>this.onRoute(e)),!!X()){if(!O("access.read")){this.forbidden=!0;return}this.load(),this.readFeatures(),this.posterTimer=window.setInterval(()=>{document.hidden||(this.poster=Date.now())},Cs),this.stop=Ut(e=>{e.type==="intercom_tts"?this.actions.noteTts(e.status):e.type!=="heartbeat"&&this.load()},e=>{this.setPolling(!e),e&&this.load()}),this.schedule()}}disconnectedCallback(){super.disconnectedCallback(),this.mqc?.removeEventListener("change",this.onMedia),this.mqm?.removeEventListener("change",this.onMedia),this.mqn?.removeEventListener("change",this.onMedia),this.mqd?.removeEventListener("change",this.onFitMedia),this.fitObserver?.disconnect(),this.fitObserver=null,this.fitGrid=null,this.stop?.(),this.stop=null,this.stopRoute?.(),this.stopRoute=null,this.setPolling(!1),window.clearInterval(this.posterTimer),window.clearTimeout(this.tickTimer),this.actions.dispose()}willUpdate(e){(e.has("filter")||e.has("query")||e.has("place"))&&(this.cardPage=1)}updated(e){(e.has("selected")||e.has("detailOpen"))&&this.maybeLoadDetail(),(e.has("selected")||e.has("mediaMode"))&&this.maybeLoadMedia(),this.watchFit()}watchFit(){const e=this.mqd?.matches&&this.effectiveView()==="cards"?this.renderRoot.querySelector(".main > .grid"):null;if(e!==this.fitGrid){if(this.fitObserver?.disconnect(),this.fitGrid=e,!e){this.perPage&&(this.perPage=0);return}typeof ResizeObserver>"u"||(this.fitObserver=new ResizeObserver(()=>requestAnimationFrame(()=>this.measureFit())),this.fitObserver.observe(e))}}measureFit(){const e=this.fitGrid;if(!e||!e.isConnected)return;const t=getComputedStyle(e),s=parseFloat(t.rowGap)||0,a=(parseFloat(t.paddingBlockStart)||0)+(parseFloat(t.paddingBlockEnd)||0),n=Math.max(1,t.gridTemplateColumns.split(" ").filter(Boolean).length),i=[...e.querySelectorAll(":scope > .card")];if(!i.length)return;const r=Math.max(...i.map(h=>h.offsetHeight));if(!r)return;const d=Math.max(1,Math.floor((e.clientHeight-a+s)/(r+s))),c=n*d;c!==this.perPage&&(this.perPage=c)}setPolling(e){window.clearInterval(this.poll),this.poll=e?window.setInterval(()=>void this.load(),Ts):0}schedule(){window.clearTimeout(this.tickTimer),this.tickTimer=window.setTimeout(()=>{this.now=Date.now(),this.clock.observe(this.list(),this.now),this.actions.prune(),this.schedule()},this.clock.active?1e3:2e4)}onRoute(e){if(e.mode!=="wiskey")return;const t=e.params.get("station");t&&t!==this.selected?(this.selected=t,this.detailOpen=!1):!t&&this.selected&&(this.selected=null,this.detailOpen=!1)}demo(){return!X()}list(){return this.demo()?st:this.feed?.stations??[]}isLive(){return!this.demo()&&this.feed?.state==="ready"&&this.feed.fresh!==!1}rights(){return this.demo()?Os:Ps(De,this.policy,O)}async load(){if(this.loading){this.loadAgain=!0;return}this.loading=!0;try{do{this.loadAgain=!1;try{const e=await Qt();this.feed=e,this.error="",this.forbidden=!1,this.afterLoad(e)}catch(e){e instanceof B&&e.status===403?this.forbidden=!0:this.error=$e(e)}}while(this.loadAgain)}finally{this.loading=!1}}afterLoad(e){this.now=Date.now(),this.clock.observe(e.stations??[],this.now),this.actions.dropStaleArm(),this.readPolicy(),this.ensurePlaces(e.stations??[]),this.maybeLoadMedia(),this.schedule()}async readPolicy(){try{const e=await xe();this.policy=As(e),this.mediaMode=Kt(e)}catch{}}async readFeatures(){try{const e=await es();this.features=Object.fromEntries(Object.entries(e.features??{}).map(([t,s])=>[t,s.available]))}catch{}}async ensurePlaces(e){const t=e.filter(a=>a.camera_entity),s=t.map(a=>`${a.id}:${a.camera_entity}`).sort().join("|");if(s!==this.placesKey){if(this.placesKey=s,!t.length||!O("devices.read")){this.places=null;return}try{const[a,n]=await Promise.all([Gt(),Vt(t.map(i=>i.camera_entity))]);if(s!==this.placesKey)return;this.places=Es(e,a,n.entities)}catch{this.places=null}}}maybeLoadDetail(){const e=this.selected;if(!e||!this.detailOpen||this.demo()||!this.list().find(a=>a.id===e)?.technical)return;const s=this.detailAt[e]??0;this.detail[e]&&Date.now()-s<et||this.loadDetail(e)}async loadDetail(e){this.detailAt={...this.detailAt,[e]:Date.now()};const t={state:"loading",data:null};this.detail={...this.detail,[e]:{programs:t,codes:t}};const s=n=>this.detail={...this.detail,[e]:{...this.detail[e],...n}},a=(n,i)=>n.state==="ready"&&i?{state:"ready",data:i}:n.state==="unsupported"?{state:"unsupported",data:null}:n.last_error==="busy"||n.last_error==="rate_limited"||n.last_error==="timeout"?{state:"busy",data:null}:{state:"error",data:null};if(this.features.door_programs!==!1)try{const n=await rt(e);s({programs:a(n,n.programs)})}catch{s({programs:{state:"error",data:null}})}else s({programs:{state:"unsupported",data:null}});if(this.features.public_codes!==!1)try{const n=await lt(e);s({codes:a(n,n.codes)})}catch{s({codes:{state:"error",data:null}})}else s({codes:{state:"unsupported",data:null}})}maybeLoadMedia(){const e=this.selected;!e||this.mediaMode==="off"||this.demo()||this.media[e]!==void 0&&Date.now()-(this.mediaAt[e]??0)<et||(this.mediaAt={...this.mediaAt,[e]:Date.now()},Yt(e).then(t=>this.media={...this.media,[e]:t}).catch(()=>this.media={...this.media,[e]:null}))}posterOf(e){return!e.camera_entity||this.demo()||!Le("go2rtc")||this.failed[e.id]===this.poster?"":ot(e.id,this.poster)}liveArea(e,t){if(this.mediaMode==="off")return null;const s=this.media[e.id];if(!s||s.state!=="ready")return null;const a=!!s.video?.allowed&&Object.keys(s.video.paths).length>0;if(!a&&!s.talk?.available)return null;const n=!t.rights.call,i=n&&t.rights.talk&&!s.talk?.available;return o`<wk-station-live
      data-wk-live-native
      .stationId=${e.id}
      .stationName=${e.name}
      .media=${a?s:{...s,video:null}}
      .poster=${this.posterOf(e)}
      .live=${t.live&&e.online}
      .talkHere=${n}
      .classicHref=${i?U():""}
      .classicLabel=${t.text.talk.classic}
    ></wk-station-live>`}dialControl(e,t,s){const a=Me(this.mediaMode,this.media[e.id]);if(a.kind==="legacy")return;const n=de().dial;return a.kind==="native"?o`<div class="dialnative">
        <wk-talk-button
          dial
          data-wk-dial="native"
          .stationId=${e.id}
          .talk=${this.media[e.id]?.talk??null}
          .live=${s.live&&e.online}
          .idleLabel=${t?n.talk:n.dial}
        ></wk-talk-button>
        <wk-action-button tone="quiet" icon="window" href=${U()} data-wk-dial-classic="secondary">${n.classic}</wk-action-button>
      </div>`:o`<div class="callrow" data-wk-dial="reason" data-reason=${a.reason}>
      <span class="cs muted dialwhy" data-wk-dial-reason role="status">${n.reasons[a.reason]}</span>
      <wk-action-button tone="dashed" icon="window" href=${U()} data-wk-dial-classic>${n.classic}</wk-action-button>
    </div>`}talkControl(e,t,s){if(this.mediaMode==="video_talk")return t?Me(this.mediaMode,this.media[e.id]).kind!=="legacy"&&s.rights.call?l:this.liveArea(e,s)?l:void 0:!O("access.call")||!e.online?void 0:o`<wk-action-button icon="mic" data-wk-talk="drawer" label=${de().talk.openDrawer} @click=${a=>{a.stopPropagation(),this.open(e.id)}}>${de().talk.openDrawer}</wk-action-button>`}open(e){this.selected!==e&&(this.selected=e,this.detailOpen=!1,this.syncRoute(e))}closeDrawer(){this.selected=null,this.detailOpen=!1,this.syncRoute(null)}syncRoute(e){const t=Zt();if(t.mode!=="wiskey")return;const s=new URLSearchParams(t.params);e?s.set("station",e):s.delete("station"),Jt(t.path,s)}setView(e){this.view=e,tt(xt,e)}toggleFloor(e){const t=new Set(this.collapsed);t.has(e)?t.delete(e):t.add(e),this.collapsed=t,tt(_t,JSON.stringify([...t]))}pickPlace(e){this.place=e,this.sheet=!1}ctx(){const e=this.features,t={text:z(),now:this.now,defaultZone:this.feed?.default_zone??null,live:this.isLive(),rights:this.rights(),policy:this.policy,places:this.places,actions:this.actions,clock:this.clock,table:this.table,media:this.demo()?!1:Le("go2rtc"),poster:this.poster,failed:this.failed,selected:this.selected,detail:this.detail,detailOpen:this.detailOpen,features:e,open:s=>this.open(s),door:(s,a)=>void this.actions.askRelease(s.id,a),call:(s,a,n)=>this.actions.tapCall(s.id,a,n.detail),announce:s=>{this.announceFor=s,this.announceOpen=!0},stillError:(s,a)=>this.failed={...this.failed,[s]:a},toggleDetail:()=>this.detailOpen=!this.detailOpen,retryDetail:()=>{this.selected&&this.loadDetail(this.selected)}};return this.mediaMode!=="off"&&(t.liveArea=s=>this.liveArea(s,t),t.talkControl=(s,a)=>this.talkControl(s,a,t),t.dialControl=(s,a)=>this.dialControl(s,a,t)),t}render(){const e=z();if(this.forbidden&&X())return o`<sw-page heading=${e.title}><div data-wk-stations data-wk-state="forbidden"><sw-state-panel state="forbidden" heading=${e.states.forbidden} data-wk-panel="forbidden"></sw-state-panel></div></sw-page>`;if(!this.demo()&&!this.feed)return o`<sw-page heading=${e.title}><div data-wk-stations data-wk-state=${this.error?"error":"loading"}>${this.error?o`<sw-state-panel state="error" heading=${e.states.error} hint=${this.error} actionLabel=${e.retry} data-wk-panel="error" @action=${()=>void this.load()}></sw-state-panel>`:o`<sw-state-panel state="loading" heading=${e.states.loading} data-wk-panel="loading"></sw-state-panel>`}</div></sw-page>`;const t=this.demo()?st:this.feed.stations;if(t===null){const s=this.feed.state==="ready"?"error":this.feed.state,a=Ds(s,e);return o`<sw-page heading=${e.title}>
        ${this.renderFeedBadge()}
        <div data-wk-stations data-wk-state=${`feed:${this.feed.state}`}>
          <sw-state-panel icon="door" state=${a.panel} heading=${a.heading} actionLabel=${a.settings&&De("system.configure")?e.states.toSettings:""} data-wk-panel=${`feed:${this.feed.state}`} @action=${()=>window.location.hash="#/system/diagnostics?tab=access-control"}></sw-state-panel>
        </div>
      </sw-page>`}return this.renderReady(t)}renderFeedBadge(){const e=z();if(this.demo())return o`<sw-badge slot="actions" kind="neutral" label=${e.demo} data-wk-feed="demo"></sw-badge>`;const t=this.feed;if(!t)return l;const s=t.state==="ready"&&t.fresh!==!1,a=s?"live":t.state==="connecting"?"unknown":t.state==="forbidden"?"forbidden":t.state==="error"?"error":t.stations?"stale":"offline",n=s?e.feed.live:t.state==="connecting"?e.feed.connecting:t.stations&&t.fetched_at?p(e.feed.stale,{ago:Ls(t.fetched_at,this.now,e)||"…"}):e.feed.off;return o`<sw-badge slot="actions" kind=${a} label=${n} data-wk-feed=${s?"live":t.state}></sw-badge>`}effectiveView(){return this.table==="none"&&this.view==="table"?"list":this.view}renderReady(e){const t=z(),s=this.ctx(),a=Ms(e,this.places,this.collapsed,t),n=a.length>0,i=n&&a.some($=>$.id===this.place)?this.place:"all",r=Ns(e,this.filter,this.query,i,this.places),d=Rs(e),c=this.effectiveView(),h=e.filter(ut).length,m=e.some($=>$.online),w=e.length?"ready":"empty",v=a.find($=>$.id===i)?.name??t.places.all,_=c==="cards"&&this.perPage>0?this.perPage:0,T=_?Math.max(1,Math.ceil(r.length/_)):1,q=Math.min(Math.max(1,this.cardPage),T),zt=_?r.slice((q-1)*_,q*_):r;return o`<sw-page wide heading=${t.title} subheading=${Fs(d,t)}>
      ${this.renderFeedBadge()}<wk-deep-links slot="actions" place="stations" mode="menu"></wk-deep-links>
      <div data-wk-stations data-wk-state=${w} data-view=${c} data-live=${String(s.live)}>
        ${e.length?o`<div class="toolbar">
              <label class="search"><sw-icon name="search" size=${16}></sw-icon><input type="search" data-wk-search aria-label=${t.searchLabel} placeholder=${t.searchLabel} .value=${this.query} @input=${$=>this.query=$.target.value} /></label>
              ${s.rights.announce&&m?o`<wk-action-button icon="volume" data-wk-announce ?disabled=${!s.live} label=${t.announce} @click=${()=>s.announce("")}><span class="lbl">${t.announce}</span></wk-action-button>`:l}
              <wk-stations-maintenance .stations=${e} ?live=${s.live}></wk-stations-maintenance>
              <sw-view-switch data-wk-views label=${t.views.label} .value=${c} .options=${[{id:"cards",label:t.views.cards,icon:"grid"},{id:"list",label:t.views.list,icon:"list"},...this.table==="none"?[]:[{id:"table",label:t.views.table,icon:"table"}]]} @change=${$=>this.setView($.detail)}></sw-view-switch>
            </div>`:l}
        <div class="layout ${n?"":"no-tree"}">
          ${n?o`<aside class="treecol"><sw-card flush><sw-place-tree data-wk-tree .rows=${a} .selected=${i} heading=${t.places.title} foldLabel=${t.places.fold} unfoldLabel=${t.places.unfold} @place-select=${$=>this.pickPlace($.detail)} @place-toggle=${$=>this.toggleFloor($.detail)}></sw-place-tree></sw-card></aside>`:l}
          <section class="main">
            ${e.length?o`<div class="chips" role="group" aria-label=${t.filters.label}>
                  ${n?o`<button type="button" class="chip places" data-wk-places-chip @click=${()=>this.sheet=!0}><sw-icon name="pin" size=${14}></sw-icon>${t.places.chip}: ${v}<sw-icon name="chevronDown" size=${12}></sw-icon></button>`:l}
                  ${Is.map($=>o`<button type="button" class="chip" data-wk-filter=${$} aria-pressed=${String(this.filter===$)} @click=${()=>this.filter=$}>
                      ${$==="in_call"?pe("phone",14):l}${$==="all"?t.filters.all:$==="online"?t.filters.online:$==="attention"?t.filters.attention:t.filters.inCall}
                    </button>`)}
                  ${T>1?o`<sw-pager class="pager" data-wk-pager .page=${q} .pages=${T} @page-change=${$=>this.cardPage=$.detail.page}></sw-pager>`:l}
                </div>`:l}
            ${h&&c==="cards"&&s.rights.call?o`<div class="strip" role="status" data-wk-strip>
                  <span class="dot" aria-hidden="true"></span><span>${h===1?t.strip.one:p(t.strip.many,{n:h})}</span><span class="sp"></span>
                  <wk-action-button tone="quiet" icon="list" data-wk-strip-list @click=${()=>this.setView("list")}>${t.strip.toList}</wk-action-button>
                </div>`:l}
            ${this.renderContent(s,e,r,c,zt)}
          </section>
        </div>
      </div>
      ${this.renderSheet(a,i)} ${this.renderDrawer(s,e)} ${this.selected?l:this.renderDialogs(s,e)}
    </sw-page>`}renderContent(e,t,s,a,n=s){const i=e.text;return t.length?s.length?a==="table"?o`<sw-table class="tbl" dense data-wk-table .columns=${pn(e,t)} .rows=${s} .selected=${this.selected} @row-select=${r=>this.open(r.detail.id)}></sw-table>`:a==="list"?hn(e,s):un(e,n):o`<sw-state-panel icon="door" compact state="empty" heading=${i.states.emptyFilter} data-wk-panel="empty-filter"></sw-state-panel>`:o`<sw-state-panel icon="door" state="empty" heading=${i.states.empty} data-wk-panel="empty"></sw-state-panel>`}renderSheet(e,t){const s=z();return e.length?o`<sw-drawer modal ?open=${this.sheet} heading=${s.places.sheet} data-wk-places-sheet @close=${a=>a.target===a.currentTarget&&(this.sheet=!1)}>
      <sw-place-tree .rows=${e} .selected=${t} heading=${s.places.title} foldLabel=${s.places.fold} unfoldLabel=${s.places.unfold} @place-select=${a=>this.pickPlace(a.detail)} @place-toggle=${a=>this.toggleFloor(a.detail)}></sw-place-tree>
    </sw-drawer>`:l}renderDrawer(e,t){const s=e.text,a=this.selected,n=a?t.find(r=>r.id===a):void 0,i=n?n.online?"live":"offline":"neutral";return o`<sw-drawer modal ?open=${!!a} heading=${n?.name??s.drawer.notFound} data-wk-drawer data-wk-drawer-station=${a??""} @close=${r=>r.target===r.currentTarget&&this.closeDrawer()}>
      ${a&&n?o`<sw-badge slot="action" kind=${i} label=${n.online?s.status.online:s.status.offline}></sw-badge>`:l}
      ${a?n?bn(e,n):o`<sw-state-panel compact state="forbidden" heading=${s.drawer.notFoundHint} data-wk-panel="scoped"></sw-state-panel>`:l}
      ${a?this.renderDialogs(e,t):l}
    </sw-drawer>`}renderDialogs(e,t){return o`${this.renderConfirm(e,t)}
    <wk-announce-dialog
      ?open=${this.announceOpen}
      .stations=${t}
      .places=${this.places}
      .scope=${this.policy.announceScope}
      .phrases=${qs(this.policy,e.text)}
      .preselect=${this.announceFor}
      .tts=${this.actions.tts}
      @tts-status=${s=>this.actions.noteTts(s.detail)}
      @close=${s=>{s.target===s.currentTarget&&(this.announceOpen=!1)}}
    ></wk-announce-dialog>`}renderConfirm(e,t){const s=this.actions.confirm;if(!s)return l;const a=t.find(h=>h.id===s.stationId);if(!a)return l;const n=e.text,i=a.locks.find(h=>h.physical_index===s.lock)?.name?.trim(),r=Hs(a.name),d=i?p(n.door.confirmNamed,{door:i,inPlace:r}):p(n.door.confirmPlain,{inPlace:r}),c=this.actions.releasing.has(`${a.id}/${s.lock}`);return o`<sw-dialog open ?locked=${c} heading=${n.door.confirmTitle} data-wk-release-dialog @close=${h=>h.target===h.currentTarget&&this.actions.cancelRelease()}>
      <p class="sentence" data-wk-release-sentence>${d}</p>
      <div slot="footer">
        <wk-action-button data-wk-release-cancel ?disabled=${c} @click=${()=>this.actions.cancelRelease()}>${n.door.cancel}</wk-action-button>
        <wk-action-button tone="primary" icon="unlock" data-wk-release-confirm ?busy=${c} ?disabled=${c||!e.live} @click=${()=>void this.actions.confirmRelease()}>${c?n.door.sending:n.door.send}</wk-action-button>
      </div>
    </sw-dialog>`}};f.styles=Sa;k([u()],f.prototype,"feed",2);k([u()],f.prototype,"error",2);k([u()],f.prototype,"forbidden",2);k([u()],f.prototype,"filter",2);k([u()],f.prototype,"query",2);k([u()],f.prototype,"view",2);k([u()],f.prototype,"place",2);k([u()],f.prototype,"places",2);k([u()],f.prototype,"collapsed",2);k([u()],f.prototype,"selected",2);k([u()],f.prototype,"sheet",2);k([u()],f.prototype,"announceOpen",2);k([u()],f.prototype,"announceFor",2);k([u()],f.prototype,"policy",2);k([u()],f.prototype,"features",2);k([u()],f.prototype,"detail",2);k([u()],f.prototype,"detailOpen",2);k([u()],f.prototype,"now",2);k([u()],f.prototype,"poster",2);k([u()],f.prototype,"failed",2);k([u()],f.prototype,"table",2);k([u()],f.prototype,"mediaMode",2);k([u()],f.prototype,"media",2);k([u()],f.prototype,"cardPage",2);k([u()],f.prototype,"perPage",2);f=k([I("wiskey-stations")],f);export{f as WiskeyStations};
//# sourceMappingURL=wiskey-stations-Bzgku9PM.js.map
