import{cy as i,g as x,ay as M,j as l,i as k,b4 as A,n as w,lf as G,bZ as B,b as n,A as p,fp as F,k as _,bs as N,bE as K,cG as U,cE as W,a3 as S,a as X,m6 as C,aU as Y,aL as J,eI as V,pI as Z,pJ as q,pK as Q,aB as ee,dE as d,pL as se,pM as te,s as ae}from"./index-DJHEuoub.js";import{s as re}from"./settings-B2Aqk_ne.js";import"./sw-logo-art-MaHPMZFI.js";var ne=Object.defineProperty,ie=Object.getOwnPropertyDescriptor,b=(e,s,t,r)=>{for(var a=r>1?void 0:r?ie(s,t):s,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(r?h(s,t,a):h(a))||a);return r&&a&&ne(s,t,a),a};const oe={inline:i("קוד או עיצוב מוטמע (inline)"),eval:"eval",self:i("מהאתר עצמו"),data:"data:",blob:"blob:",none:"—",other:i("אחר")};let g=class extends k{constructor(){super(...arguments),this.canEdit=!1,this.data=null,this.error="",this.busy=!1,this.armed=!1,this.message=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await A("csp-reports"),this.error=""}catch(e){this.error=w(e)}}async setEnforce(e){if(!this.armed){this.armed=!0;return}this.armed=!1,this.busy=!0;try{await G({"remote.csp_enforce":e?"true":"false"}),this.message=e?i("המדיניות המחמירה נאכפת מעכשיו."):i("המדיניות המחמירה חזרה לדיווח בלבד."),await this.load()}catch(s){this.error=w(s)}finally{this.busy=!1}}async clear(){this.busy=!0;try{await B("csp-reports",{method:"DELETE"}),this.message=i("הספירה אופסה."),await this.load()}catch(e){this.error=w(e)}finally{this.busy=!1}}render(){const e=this.data;if(!e)return this.error?n`<div class="err" role="alert">${this.error}</div>`:n`<div class="muted">${i("טוען דיווחים…")}</div>`;const s=e.mode==="enforce",t=e.rows.filter(a=>(a.directive==="style-src-elem"||a.directive==="style-src")&&a.blocked==="inline").reduce((a,o)=>a+o.count,0),r=!s&&t>0;return n`
      <div class="mode" data-csp-mode=${e.mode}>
        <sw-badge kind=${s?"live":"partial"} label=${s?i("נאכפת"):i("דיווח בלבד")}></sw-badge>
        <span>${s?i("המדיניות המחמירה (בלי עיצוב מוטמע בתגיות style) נאכפת בגישה מרחוק."):i("המדיניות המחמירה נבדקת בדפדפנים ומדווחת, אבל עדיין לא נאכפת. אחרי שעוברים על הדיווחים אפשר לאכוף.")}</span>
      </div>
      ${e.rows.length?n`<table data-csp-table>
            <thead><tr><th>${i("הנחיה")}</th><th>${i("מה נחסם")}</th><th>${i("סוג")}</th><th>${i("כמות")}</th><th>${i("לאחרונה")}</th></tr></thead>
            <tbody>${e.rows.map(a=>n`<tr>
              <td class="ltr">${a.directive}</td>
              <td class="ltr">${oe[a.blocked]??a.blocked}</td>
              <td>${a.disposition==="enforce"?i("נחסם"):i("דיווח")}</td>
              <td>${a.count}</td>
              <td>${F(new Date(a.last_at))}</td>
            </tr>`)}</tbody>
          </table>`:n`<div class="muted" data-csp-empty>${i("אין דיווחים. דפדפנים שולחים דיווח רק כשמשהו בדף חורג מהמדיניות.")}</div>`}
      <div class="muted">${i("נשמרות ספירות בלבד (הנחיה, מקור חסום, סוג) - בלי כתובות דפים, תוכן או משתמשים. דיווחים ממקורות לא מוכרים הם לרוב תוספי דפדפן.")}</div>
      ${this.canEdit&&r?n`<div class="warn" role="note" data-csp-enforce-blocked>${i("אי אפשר לאכוף עדיין: דפדפנים דיווחו על {n} מקרים של עיצוב מוטמע בתגית style, והאכיפה הייתה משאירה את המסכים האלה בלי עיצוב. אחרי תיקון בגרסה הבאה - לאפס את הספירה ולבדוק שוב.",{n:t})}</div>`:p}
      ${this.canEdit?n`<div class="foot">
            <sw-button size="sm" variant=${this.armed?s?"secondary":"danger":s?"secondary":"primary"} icon="shield" data-csp-enforce ?disabled=${this.busy||r} @click=${()=>void this.setEnforce(!s)}>
              ${this.armed?i("לאשר?"):s?i("חזרה לדיווח בלבד"):i("אכוף את המדיניות המחמירה")}
            </sw-button>
            ${this.armed?n`<sw-button size="sm" variant="ghost" @click=${()=>this.armed=!1}>${i("ביטול")}</sw-button>`:p}
            <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.busy} @click=${()=>void this.load()}>${i("רענון")}</sw-button>
            <sw-button size="sm" variant="ghost" icon="trash" data-csp-clear ?disabled=${this.busy||!e.rows.length} @click=${()=>void this.clear()}>${i("איפוס הספירה")}</sw-button>
          </div>`:p}
      ${this.message?n`<div class="ok" role="status">${this.message}</div>`:p}
      ${this.error?n`<div class="err" role="alert">${this.error}</div>`:p}
    `}};g.styles=x`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .mode {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-xs);
    }
    th,
    td {
      text-align: start;
      padding: 5px 6px;
      border-block-end: 1px solid var(--sw-border);
    }
    th {
      color: var(--sw-text-3);
      font-weight: 500;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      text-align: start;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .warn {
      padding: 8px;
      border-radius: var(--sw-r-xs);
      background: var(--sw-warning-soft);
      font-size: var(--sw-fs-xs);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
  `;b([M({type:Boolean})],g.prototype,"canEdit",2);b([l()],g.prototype,"data",2);b([l()],g.prototype,"error",2);b([l()],g.prototype,"busy",2);b([l()],g.prototype,"armed",2);b([l()],g.prototype,"message",2);g=b([_("sw-csp-reports")],g);const L="security.app_refresh",R="security.app_session_exchange",ce="security.app_refresh_access_minutes",j=15,$={refresh:!1,exchange:!1,accessMinutes:10};function I(e){const s=e??{},t=s[ce];return{refresh:s[L]==="on",exchange:s[R]==="on",accessMinutes:typeof t=="number"&&Number.isInteger(t)?t:$.accessMinutes}}function de(e,s,t){return s==="refresh"?{...e,refresh:t,exchange:t?e.exchange:!1}:{...e,exchange:t}}function z(e,s,t){return t&&!e[s]}function O(e,s,t){return t&&(s.refresh&&!e.refresh||s.exchange&&!e.exchange)?"remote_on":s.exchange&&!e.exchange&&!s.refresh?"exchange_needs_refresh":s.exchange&&s.accessMinutes>j?"access_too_long":null}function P(e,s){const t={};return e.refresh!==s.refresh&&(t[L]=s.refresh?"on":"off"),e.exchange!==s.exchange&&(t[R]=s.exchange?"on":"off"),t}function T(e,s){const t=[];return e.refresh&&!s.refresh&&t.push("refresh"),e.exchange&&!s.exchange&&t.push("exchange"),t}const le=()=>A("auth/app/settings"),he=e=>N("auth/app/settings",e),E={title:"כניסה מהאפליקציה לנייד",sub:"למנהל מערכת. ההפעלה רק מתוך הרשת המקומית; הכיבוי אפשרי מכל מקום ומנתק מיד.",refresh:"כניסה שמורה באפליקציה",refreshHint:"האפליקציה נשארת מחוברת בלי סיסמה בכל פתיחה. כיבוי מסיים מיד את הכניסה השמורה בכל הטלפונים.",exchange:"חיבור מסך האפליקציה",exchangeHint:"מסך האפליקציה נפתח מחובר בעזרת קוד חד־פעמי, בלי בקשת סיסמה. דורש כניסה שמורה פעילה.",off:"כבוי",on:"פעיל",localOnly:"את ההפעלה עושים רק מתוך הרשת המקומית",needsRefresh:"קודם מפעילים את הכניסה השמורה באפליקציה",accessTooLong:"כשחיבור מסך האפליקציה פעיל, תוקף אסימון הגישה עד {max} דקות (כעת {n}). יש לקצר אותו קודם.",save:"שמור",saved:"ההגדרות נשמרו",savedEnded:"ההגדרות נשמרו · {n} כניסות שמורות הסתיימו",confirmTitle:"לשמור ולנתק?",confirmRefresh:"הכניסה השמורה בכל הטלפונים תסתיים עכשיו. כל משתמש יתבקש להיכנס שוב באפליקציה.",confirmExchange:"מסכי האפליקציה שנפתחו בחיבור הזה ינותקו עכשיו.",confirmGo:"שמור ונתק",cancel:"ביטול",loadError:"הגדרות הכניסה מהאפליקציה לא נטענו",demo:"נתוני הדגמה: ההגדרות נשמרות רק מול השרת."},D={title:"Sign-in from the phone app",sub:"For a system administrator. Switching on works from the local network only; switching off works anywhere and disconnects at once.",refresh:"Saved sign-in in the app",refreshHint:"The app stays signed in without a password every time it opens. Switching it off ends the saved sign-in on every phone at once.",exchange:"App screen sign-in",exchangeHint:"The app screen opens signed in with a one-time code, without asking for a password. Needs the saved sign-in on.",off:"Off",on:"On",localOnly:"Switching on is done from the local network only",needsRefresh:"Switch the saved sign-in on first",accessTooLong:"While the app screen sign-in is on, the access token lasts at most {max} minutes (now {n}). Shorten it first.",save:"Save",saved:"Settings saved",savedEnded:"Settings saved · {n} saved sign-ins ended",confirmTitle:"Save and disconnect?",confirmRefresh:"The saved sign-in on every phone ends now. Every user will be asked to sign in again in the app.",confirmExchange:"The app screens opened by this sign-in are disconnected now.",confirmGo:"Save and disconnect",cancel:"Cancel",loadError:"The phone app sign-in settings could not be loaded",demo:"Demo data: the settings are saved against a server only."},pe={he:E,en:D};function fe(){return W(["en"])}function c(e,s,t=fe()){const r=pe[t][e]??E[e]??e;return U(r,s)}K("i18n/app-signin",{he:E,en:D});var ue=Object.defineProperty,ge=Object.getOwnPropertyDescriptor,m=(e,s,t,r)=>{for(var a=r>1?void 0:r?ge(s,t):s,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(r?h(s,t,a):h(a))||a);return r&&a&&ue(s,t,a),a};let f=class extends k{constructor(){super(...arguments),this.saved=$,this.draft=$,this.phase=S()?"loading":"demo",this.busy=!1,this.asking=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),S()&&this.load()}async load(){try{const e=await le();this.adopt(I(e.settings))}catch(e){e instanceof X&&(e.status===403||e.status===404)?this.phase="hidden":(this.phase="error",this.error=`${c("loadError")}: ${w(e)}`)}}adopt(e){this.saved=e,this.draft={...e},this.phase="ready"}set(e,s){this.draft=de(this.draft,e,s),this.message="",this.error=""}ask(){T(this.saved,this.draft).length?this.asking=!0:this.save()}async save(){this.asking=!1;const e=P(this.saved,this.draft);if(!(!Object.keys(e).length||O(this.saved,this.draft,C()))){this.busy=!0,this.error="";try{const s=await he(e);this.adopt(I(s.settings)),this.message=s.families_ended?c("savedEnded",{n:s.families_ended}):c("saved")}catch(s){this.error=w(s)}finally{this.busy=!1}}}problemText(e){const s=O(this.saved,this.draft,e);return s==="remote_on"?c("localOnly"):s==="exchange_needs_refresh"?c("needsRefresh"):s==="access_too_long"?c("accessTooLong",{max:j,n:this.draft.accessMinutes}):""}row(e,s,t){const r=this.draft[e],a=t||z(this.saved,e,s)||e==="exchange"&&!this.draft.refresh,o=c(e),h=z(this.saved,e,s)?c("localOnly"):e==="exchange"&&!this.draft.refresh?c("needsRefresh"):"";return n`<div class="row" data-app-signin-row=${e}><span class="lbl">${o}<span class="muted">${c(e==="refresh"?"refreshHint":"exchangeHint")}</span>
        ${h?n`<span class="muted note" data-app-signin-note=${e}>${h}</span>`:p}</span>
      <div class="seg" role="group" aria-label=${o} data-app-signin=${e}>
        <button type="button" data-v="off" aria-pressed=${String(!r)} ?disabled=${t} @click=${()=>this.set(e,!1)}>${c("off")}</button>
        <button type="button" data-v="on" aria-pressed=${String(r)} ?disabled=${a} @click=${()=>this.set(e,!0)}>${c("on")}</button></div></div>`}render(){if(this.phase==="hidden"||this.phase==="loading")return p;const e=C(),s=this.phase!=="ready"||this.busy,t=Object.keys(P(this.saved,this.draft)).length>0,r=t?this.problemText(e):"",a=T(this.saved,this.draft);return n`<sw-card heading=${c("title")} subheading=${c("sub")} data-card="remote.app-signin" data-app-signin-card>
      <div class="set-col">${this.row("refresh",e,s)}${this.row("exchange",e,s)}</div>
      ${this.phase==="ready"?n`<div class="foot sticky" data-app-signin-foot>
            <sw-button variant="primary" size="sm" icon="check" data-app-signin-save ?disabled=${!t||!!r||this.busy} @click=${()=>this.ask()}>${c("save")}</sw-button>
            ${r?n`<span class="err" role="alert" data-app-signin-problem>${r}</span>`:p}
            ${this.message?n`<span class="ok" role="status" data-app-signin-message>${this.message}</span>`:p}
            ${this.error?n`<span class="err" role="alert" data-app-signin-error>${this.error}</span>`:p}
          </div>`:n`<div class="muted" data-app-signin-readonly>${this.phase==="error"?this.error:c("demo")}</div>`}
      <sw-dialog ?open=${this.asking} heading=${c("confirmTitle")} @close=${()=>this.asking=!1} data-app-signin-confirm>
        ${a.includes("refresh")?n`<p data-app-signin-ends="refresh">${c("confirmRefresh")}</p>`:p}
        ${a.includes("exchange")?n`<p data-app-signin-ends="exchange">${c("confirmExchange")}</p>`:p}
        <sw-button slot="footer" @click=${()=>this.asking=!1}>${c("cancel")}</sw-button>
        <sw-button slot="footer" variant="primary" data-app-signin-confirm-go @click=${()=>void this.save()}>${c("confirmGo")}</sw-button>
      </sw-dialog>
    </sw-card>`}};f.styles=[re,x`
    :host { display: block; }
    .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 12px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
    .note { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  `];m([l()],f.prototype,"saved",2);m([l()],f.prototype,"draft",2);m([l()],f.prototype,"phase",2);m([l()],f.prototype,"busy",2);m([l()],f.prototype,"asking",2);m([l()],f.prototype,"message",2);m([l()],f.prototype,"error",2);f=m([_("system-app-signin")],f);var me=Object.defineProperty,ve=Object.getOwnPropertyDescriptor,v=(e,s,t,r)=>{for(var a=r>1?void 0:r?ve(s,t):s,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(r?h(s,t,a):h(a))||a);return r&&a&&me(s,t,a),a};function be(){const e=se(navigator.userAgent);return{browser:e.browser,os:e.os,mobile:e.mobile,remote:ae.me?.channel==="remote",...te()}}let u=class extends k{constructor(){super(...arguments),this.bubbleSkin=new J(this),this.cameras=null,this.cameraId="",this.choice="sub",this.running=!1,this.reports=[],this.error="",this.copied="",this.abort=null,this.runId=0,this.stop=()=>{this.runId+=1,this.abort?.abort(),this.abort=null}}connectedCallback(){super.connectedCallback(),window.addEventListener("pagehide",this.stop),this.loadCameras()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pagehide",this.stop),this.stop()}async loadCameras(){try{const e=await V();this.cameras=e.cameras.filter(s=>s.enabled&&s.can_view_live!==!1),!this.cameraId&&this.cameras.length&&(this.cameraId=this.cameras[0].id)}catch(e){this.cameras=[],this.error=w(e)}}cancel(){this.abort?.abort()}async start(){const e=this.cameras?.find(o=>o.id===this.cameraId);if(!e||this.running)return;const s=this.runId+=1,t=new AbortController;this.abort=t,this.running=!0,this.error="",this.copied="",this.reports=[];const r=be(),a=this.choice==="both"?["sub","main"]:[this.choice];try{for(const o of a){if(t.signal.aborted||s!==this.runId)break;const h=[...this.reports],H=await Z({wsUrl:q(e.id,o),profile:o,cameraLabel:`camera channel ${e.channel}`,env:r,signal:t.signal,onUpdate:y=>{s===this.runId&&(this.reports=[...h,y])}});if(s!==this.runId)break;this.reports=[...h,H],o!==a[a.length-1]&&await new Promise(y=>window.setTimeout(y,600))}}finally{s===this.runId&&(this.running=!1,this.abort=null)}}text(){return Q(this.reports)}async copy(){const e=this.text();if(e){try{await navigator.clipboard.writeText(e),this.copied="ok"}catch{this.copied=this.legacyCopy(e)?"ok":"manual"}window.setTimeout(()=>this.copied="",4e3)}}legacyCopy(e){const s=document.createElement("textarea");s.value=e,s.setAttribute("readonly",""),s.style.cssText="position:fixed;inset-block-start:0;inset-inline-start:0;opacity:0",document.body.append(s),s.select();let t=!1;try{t=document.execCommand("copy")}catch{t=!1}return s.remove(),t}render(){if(!ee("system.configure"))return p;const e=this.cameras,s=e!==null&&e.length===0,t=this.text();return n`<sw-card heading=${d("בדיקת חיבור וידאו")} subheading=${d("מראה מה ה־WebRTC של הדפדפן הזה עושה מול שרת הווידאו: מועמדי ICE, מעברי מצב, הזוג שנבחר וסטטיסטיקת RTP, ושורת מסקנה. בלי נגן; הבדיקה סוגרת את החיבור בסיומה. מומלץ להריץ אותה מהטלפון שבו הווידאו לא עובד.")} data-card="remote.video-conn-test" data-conn-test>
      <div class="row"><span class="lbl">${d("מצלמה")}<span class="muted">${s?d("אין מצלמות עם הרשאת צפייה"):d("כל צפייה בבדיקה נספרת במכסת הזרמים החיים של הכניסה")}</span></span>
        <sw-field class="ctl"><select data-conn-camera ?disabled=${this.running||!e?.length} @change=${r=>this.cameraId=r.target.value}>
          ${(e??[]).map(r=>n`<option value=${r.id} ?selected=${r.id===this.cameraId}>${r.alias||r.name}</option>`)}
        </select></sw-field></div>
      <div class="row"><span class="lbl">${d("זרם")}<span class="muted">${d('"שניהם": קודם המשני ואז הראשי, בזה אחר זה')}</span></span>
        <sw-field class="ctl"><select data-conn-profile ?disabled=${this.running} @change=${r=>this.choice=r.target.value}>
          <option value="sub" ?selected=${this.choice==="sub"}>${d("משני (sub)")}</option>
          <option value="main" ?selected=${this.choice==="main"}>${d("ראשי (main)")}</option>
          <option value="both" ?selected=${this.choice==="both"}>${d("שניהם")}</option>
        </select></sw-field></div>
      <div class="acts">
        ${this.running?n`<sw-button size="sm" variant="ghost" icon="close" data-conn-stop @click=${()=>this.cancel()}>${d("עצור")}</sw-button><span class="muted" data-conn-running>${d("בודק…")}</span>`:n`<sw-button size="sm" variant="primary" icon="activity" data-conn-run ?disabled=${!this.cameraId} @click=${()=>void this.start()}>${d("בדוק")}</sw-button>`}
        <sw-button size="sm" icon="list" data-conn-copy ?disabled=${!t} @click=${()=>void this.copy()}>${d("העתק דוח")}</sw-button>
        ${this.copied==="ok"?n`<span class="ok" data-conn-copied>${d("הועתק")}</span>`:p}
        ${this.copied==="manual"?n`<span class="err" data-conn-copy-manual>${d("ההעתקה נחסמה בדפדפן: סמן את הטקסט למטה והעתק ידנית")}</span>`:p}
        ${this.error?n`<span class="err">${this.error}</span>`:p}
      </div>
      ${this.reports.length?n`<div class="verdicts" data-conn-verdicts>${this.reports.map(r=>{const a=r.firstFrameAt!=null;return n`<div class=${a?"good":r.verdict?"bad":""} data-conn-verdict=${r.profile}>${r.profile==="main"?d("ראשי"):d("משני")}: ${r.verdict||d("בודק…")}</div>`})}</div>
          <pre class="report" data-conn-report tabindex="0">${t}</pre>`:p}
    </sw-card>`}};u.styles=[x`
    :host {
      display: block;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .row .ctl {
      inline-size: 220px;
      flex-shrink: 0;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .acts {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      padding-block-start: 10px;
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .verdicts {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-block-start: 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .verdicts .good {
      color: var(--sw-success-text);
    }
    .verdicts .bad {
      color: var(--sw-danger);
    }
    pre.report {
      margin: 10px 0 0;
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-surface));
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-xs);
      line-height: 1.45;
      direction: ltr;
      text-align: left;
      white-space: pre-wrap;
      word-break: break-word;
      max-block-size: 420px;
      overflow: auto;
      user-select: text;
      -webkit-user-select: text;
    }
    @media (max-width: 600px) {
      .row {
        flex-direction: column;
        align-items: stretch;
      }
      .row .ctl {
        inline-size: auto;
      }
    }
  `,Y];v([l()],u.prototype,"cameras",2);v([l()],u.prototype,"cameraId",2);v([l()],u.prototype,"choice",2);v([l()],u.prototype,"running",2);v([l()],u.prototype,"reports",2);v([l()],u.prototype,"error",2);v([l()],u.prototype,"copied",2);u=v([_("system-video-conn-test")],u);
