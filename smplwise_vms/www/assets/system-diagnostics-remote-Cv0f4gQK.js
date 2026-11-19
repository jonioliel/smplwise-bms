import{cB as n,g as x,ax as M,j as d,i as k,b5 as T,n as w,kq as B,c0 as G,b as i,A as h,fw as F,k as _,br as K,bG as N,bH as U,cK as X,cI as Y,a2 as C,a as q,mh as z,aU as W,aL as V,eP as J,pn as Q,po as Z,pp as ss,aA as es,dL as l,pq as ts,pr as as,s as rs}from"./index-I3FcVZcW.js";import{s as is}from"./settings-B0P4zyXC.js";import"./sw-logo-art-PLtEZJxU.js";var ns=Object.defineProperty,os=Object.getOwnPropertyDescriptor,v=(s,e,t,r)=>{for(var a=r>1?void 0:r?os(e,t):e,o=s.length-1,p;o>=0;o--)(p=s[o])&&(a=(r?p(e,t,a):p(a))||a);return r&&a&&ns(e,t,a),a};const cs={inline:n("קוד או עיצוב מוטמע (inline)"),eval:"eval",self:n("מהאתר עצמו"),data:"data:",blob:"blob:",none:"—",other:n("אחר")};let g=class extends k{constructor(){super(...arguments),this.canEdit=!1,this.data=null,this.error="",this.busy=!1,this.armed=!1,this.message=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await T("csp-reports"),this.error=""}catch(s){this.error=w(s)}}async setEnforce(s){if(!this.armed){this.armed=!0;return}this.armed=!1,this.busy=!0;try{await B({"remote.csp_enforce":s?"true":"false"}),this.message=s?n("המדיניות המחמירה נאכפת מעכשיו."):n("המדיניות המחמירה חזרה לדיווח בלבד."),await this.load()}catch(e){this.error=w(e)}finally{this.busy=!1}}async clear(){this.busy=!0;try{await G("csp-reports",{method:"DELETE"}),this.message=n("הספירה אופסה."),await this.load()}catch(s){this.error=w(s)}finally{this.busy=!1}}render(){const s=this.data;if(!s)return this.error?i`<div class="err" role="alert">${this.error}</div>`:i`<div class="muted">${n("טוען דיווחים…")}</div>`;const e=s.mode==="enforce",t=s.rows.filter(a=>(a.directive==="style-src-elem"||a.directive==="style-src")&&a.blocked==="inline").reduce((a,o)=>a+o.count,0),r=!e&&t>0;return i`
      <div class="mode" data-csp-mode=${s.mode}>
        <sw-badge kind=${e?"live":"partial"} label=${e?n("נאכפת"):n("דיווח בלבד")}></sw-badge>
        <span>${e?n("המדיניות המחמירה (בלי עיצוב מוטמע בתגיות style) נאכפת בגישה מרחוק."):n("המדיניות המחמירה נבדקת בדפדפנים ומדווחת, אבל עדיין לא נאכפת. אחרי שעוברים על הדיווחים אפשר לאכוף.")}</span>
      </div>
      ${s.rows.length?i`<table data-csp-table>
            <thead><tr><th>${n("הנחיה")}</th><th>${n("מה נחסם")}</th><th>${n("סוג")}</th><th>${n("כמות")}</th><th>${n("לאחרונה")}</th></tr></thead>
            <tbody>${s.rows.map(a=>i`<tr>
              <td class="ltr">${a.directive}</td>
              <td class="ltr">${cs[a.blocked]??a.blocked}</td>
              <td>${a.disposition==="enforce"?n("נחסם"):n("דיווח")}</td>
              <td>${a.count}</td>
              <td>${F(new Date(a.last_at))}</td>
            </tr>`)}</tbody>
          </table>`:i`<div class="muted" data-csp-empty>${n("אין דיווחים. דפדפנים שולחים דיווח רק כשמשהו בדף חורג מהמדיניות.")}</div>`}
      <div class="muted">${n("נשמרות ספירות בלבד (הנחיה, מקור חסום, סוג) - בלי כתובות דפים, תוכן או משתמשים. דיווחים ממקורות לא מוכרים הם לרוב תוספי דפדפן.")}</div>
      ${this.canEdit&&r?i`<div class="warn" role="note" data-csp-enforce-blocked>${n("אי אפשר לאכוף עדיין: דפדפנים דיווחו על {n} מקרים של עיצוב מוטמע בתגית style, והאכיפה הייתה משאירה את המסכים האלה בלי עיצוב. אחרי תיקון בגרסה הבאה - לאפס את הספירה ולבדוק שוב.",{n:t})}</div>`:h}
      ${this.canEdit?i`<div class="foot">
            <sw-button size="sm" variant=${this.armed?e?"secondary":"danger":e?"secondary":"primary"} icon="shield" data-csp-enforce ?disabled=${this.busy||r} @click=${()=>void this.setEnforce(!e)}>
              ${this.armed?n("לאשר?"):e?n("חזרה לדיווח בלבד"):n("אכוף את המדיניות המחמירה")}
            </sw-button>
            ${this.armed?i`<sw-button size="sm" variant="ghost" @click=${()=>this.armed=!1}>${n("ביטול")}</sw-button>`:h}
            <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.busy} @click=${()=>void this.load()}>${n("רענון")}</sw-button>
            <sw-button size="sm" variant="ghost" icon="trash" data-csp-clear ?disabled=${this.busy||!s.rows.length} @click=${()=>void this.clear()}>${n("איפוס הספירה")}</sw-button>
          </div>`:h}
      ${this.message?i`<div class="ok" role="status">${this.message}</div>`:h}
      ${this.error?i`<div class="err" role="alert">${this.error}</div>`:h}
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
  `;v([M({type:Boolean})],g.prototype,"canEdit",2);v([d()],g.prototype,"data",2);v([d()],g.prototype,"error",2);v([d()],g.prototype,"busy",2);v([d()],g.prototype,"armed",2);v([d()],g.prototype,"message",2);g=v([_("sw-csp-reports")],g);const L="security.app_refresh",R="security.app_session_exchange",ls="security.app_refresh_access_minutes",j=15,y={refresh:!1,exchange:!1,accessMinutes:10};function I(s){const e=s??{},t=e[ls];return{refresh:e[L]==="on",exchange:e[R]==="on",accessMinutes:typeof t=="number"&&Number.isInteger(t)?t:y.accessMinutes}}function ds(s,e,t){return e==="refresh"?{...s,refresh:t,exchange:t?s.exchange:!1}:{...s,exchange:t}}function P(s,e,t){return t&&!s[e]}function S(s,e,t){return t&&(e.refresh&&!s.refresh||e.exchange&&!s.exchange)?"remote_on":e.exchange&&!s.exchange&&!e.refresh?"exchange_needs_refresh":e.exchange&&e.accessMinutes>j?"access_too_long":null}function A(s,e){const t={};return s.refresh!==e.refresh&&(t[L]=e.refresh?"on":"off"),s.exchange!==e.exchange&&(t[R]=e.exchange?"on":"off"),t}function O(s,e){const t=[];return s.refresh&&!e.refresh&&t.push("refresh"),s.exchange&&!e.exchange&&t.push("exchange"),t}const ps=()=>T("auth/app/settings"),hs=s=>K("auth/app/settings",s),E={title:"כניסה מהאפליקציה לנייד",sub:"למנהל מערכת. ההפעלה רק מתוך הרשת המקומית; הכיבוי אפשרי מכל מקום ומנתק מיד.",refresh:"כניסה שמורה באפליקציה",refreshHint:"האפליקציה נשארת מחוברת בלי סיסמה בכל פתיחה. כיבוי מסיים מיד את הכניסה השמורה בכל הטלפונים.",exchange:"חיבור מסך האפליקציה",exchangeHint:"מסך האפליקציה נפתח מחובר בעזרת קוד חד־פעמי, בלי בקשת סיסמה. דורש כניסה שמורה פעילה.",off:"כבוי",on:"פעיל",localOnly:"את ההפעלה עושים רק מתוך הרשת המקומית",needsRefresh:"קודם מפעילים את הכניסה השמורה באפליקציה",accessTooLong:"כשחיבור מסך האפליקציה פעיל, תוקף אסימון הגישה עד {max} דקות (כעת {n}). יש לקצר אותו קודם.",save:"שמור",saved:"ההגדרות נשמרו",savedEnded:"ההגדרות נשמרו · {n} כניסות שמורות הסתיימו",confirmTitle:"לשמור ולנתק?",confirmRefresh:"הכניסה השמורה בכל הטלפונים תסתיים עכשיו. כל משתמש יתבקש להיכנס שוב באפליקציה.",confirmExchange:"מסכי האפליקציה שנפתחו בחיבור הזה ינותקו עכשיו.",confirmGo:"שמור ונתק",cancel:"ביטול",loadError:"הגדרות הכניסה מהאפליקציה לא נטענו",demo:"נתוני הדגמה: ההגדרות נשמרות רק מול השרת."},D=N("en","i18n/app-signin","en"),fs={he:E,en:D};function us(){return Y(["en"])}function c(s,e,t=us()){const r=fs[t][s]??E[s]??s;return X(r,e)}U("i18n/app-signin",{he:E,en:D});var gs=Object.defineProperty,ms=Object.getOwnPropertyDescriptor,m=(s,e,t,r)=>{for(var a=r>1?void 0:r?ms(e,t):e,o=s.length-1,p;o>=0;o--)(p=s[o])&&(a=(r?p(e,t,a):p(a))||a);return r&&a&&gs(e,t,a),a};let f=class extends k{constructor(){super(...arguments),this.saved=y,this.draft=y,this.phase=C()?"loading":"demo",this.busy=!1,this.asking=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),C()&&this.load()}async load(){try{const s=await ps();this.adopt(I(s.settings))}catch(s){s instanceof q&&(s.status===403||s.status===404)?this.phase="hidden":(this.phase="error",this.error=`${c("loadError")}: ${w(s)}`)}}adopt(s){this.saved=s,this.draft={...s},this.phase="ready"}set(s,e){this.draft=ds(this.draft,s,e),this.message="",this.error=""}ask(){O(this.saved,this.draft).length?this.asking=!0:this.save()}async save(){this.asking=!1;const s=A(this.saved,this.draft);if(!(!Object.keys(s).length||S(this.saved,this.draft,z()))){this.busy=!0,this.error="";try{const e=await hs(s);this.adopt(I(e.settings)),this.message=e.families_ended?c("savedEnded",{n:e.families_ended}):c("saved")}catch(e){this.error=w(e)}finally{this.busy=!1}}}problemText(s){const e=S(this.saved,this.draft,s);return e==="remote_on"?c("localOnly"):e==="exchange_needs_refresh"?c("needsRefresh"):e==="access_too_long"?c("accessTooLong",{max:j,n:this.draft.accessMinutes}):""}row(s,e,t){const r=this.draft[s],a=t||P(this.saved,s,e)||s==="exchange"&&!this.draft.refresh,o=c(s),p=P(this.saved,s,e)?c("localOnly"):s==="exchange"&&!this.draft.refresh?c("needsRefresh"):"";return i`<div class="row" data-app-signin-row=${s}><span class="lbl">${o}<span class="muted">${c(s==="refresh"?"refreshHint":"exchangeHint")}</span>
        ${p?i`<span class="muted note" data-app-signin-note=${s}>${p}</span>`:h}</span>
      <div class="seg" role="group" aria-label=${o} data-app-signin=${s}>
        <button type="button" data-v="off" aria-pressed=${String(!r)} ?disabled=${t} @click=${()=>this.set(s,!1)}>${c("off")}</button>
        <button type="button" data-v="on" aria-pressed=${String(r)} ?disabled=${a} @click=${()=>this.set(s,!0)}>${c("on")}</button></div></div>`}render(){if(this.phase==="hidden"||this.phase==="loading")return h;const s=z(),e=this.phase!=="ready"||this.busy,t=Object.keys(A(this.saved,this.draft)).length>0,r=t?this.problemText(s):"",a=O(this.saved,this.draft);return i`<sw-card heading=${c("title")} subheading=${c("sub")} data-card="remote.app-signin" data-app-signin-card>
      <div class="set-col">${this.row("refresh",s,e)}${this.row("exchange",s,e)}</div>
      ${this.phase==="ready"?i`<div class="foot sticky" data-app-signin-foot>
            <sw-button variant="primary" size="sm" icon="check" data-app-signin-save ?disabled=${!t||!!r||this.busy} @click=${()=>this.ask()}>${c("save")}</sw-button>
            ${r?i`<span class="err" role="alert" data-app-signin-problem>${r}</span>`:h}
            ${this.message?i`<span class="ok" role="status" data-app-signin-message>${this.message}</span>`:h}
            ${this.error?i`<span class="err" role="alert" data-app-signin-error>${this.error}</span>`:h}
          </div>`:i`<div class="muted" data-app-signin-readonly>${this.phase==="error"?this.error:c("demo")}</div>`}
      <sw-dialog ?open=${this.asking} heading=${c("confirmTitle")} @close=${()=>this.asking=!1} data-app-signin-confirm>
        ${a.includes("refresh")?i`<p data-app-signin-ends="refresh">${c("confirmRefresh")}</p>`:h}
        ${a.includes("exchange")?i`<p data-app-signin-ends="exchange">${c("confirmExchange")}</p>`:h}
        <sw-button slot="footer" @click=${()=>this.asking=!1}>${c("cancel")}</sw-button>
        <sw-button slot="footer" variant="primary" data-app-signin-confirm-go @click=${()=>void this.save()}>${c("confirmGo")}</sw-button>
      </sw-dialog>
    </sw-card>`}};f.styles=[is,x`
    :host { display: block; }
    .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 12px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
    .note { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  `];m([d()],f.prototype,"saved",2);m([d()],f.prototype,"draft",2);m([d()],f.prototype,"phase",2);m([d()],f.prototype,"busy",2);m([d()],f.prototype,"asking",2);m([d()],f.prototype,"message",2);m([d()],f.prototype,"error",2);f=m([_("system-app-signin")],f);var bs=Object.defineProperty,vs=Object.getOwnPropertyDescriptor,b=(s,e,t,r)=>{for(var a=r>1?void 0:r?vs(e,t):e,o=s.length-1,p;o>=0;o--)(p=s[o])&&(a=(r?p(e,t,a):p(a))||a);return r&&a&&bs(e,t,a),a};function ws(){const s=ts(navigator.userAgent);return{browser:s.browser,os:s.os,mobile:s.mobile,remote:rs.me?.channel==="remote",...as()}}let u=class extends k{constructor(){super(...arguments),this.bubbleSkin=new V(this),this.cameras=null,this.cameraId="",this.choice="sub",this.running=!1,this.reports=[],this.error="",this.copied="",this.abort=null,this.runId=0,this.stop=()=>{this.runId+=1,this.abort?.abort(),this.abort=null}}connectedCallback(){super.connectedCallback(),window.addEventListener("pagehide",this.stop),this.loadCameras()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pagehide",this.stop),this.stop()}async loadCameras(){try{const s=await J();this.cameras=s.cameras.filter(e=>e.enabled&&e.can_view_live!==!1),!this.cameraId&&this.cameras.length&&(this.cameraId=this.cameras[0].id)}catch(s){this.cameras=[],this.error=w(s)}}cancel(){this.abort?.abort()}async start(){const s=this.cameras?.find(o=>o.id===this.cameraId);if(!s||this.running)return;const e=this.runId+=1,t=new AbortController;this.abort=t,this.running=!0,this.error="",this.copied="",this.reports=[];const r=ws(),a=this.choice==="both"?["sub","main"]:[this.choice];try{for(const o of a){if(t.signal.aborted||e!==this.runId)break;const p=[...this.reports],H=await Q({wsUrl:Z(s.id,o),profile:o,cameraLabel:`camera channel ${s.channel}`,env:r,signal:t.signal,onUpdate:$=>{e===this.runId&&(this.reports=[...p,$])}});if(e!==this.runId)break;this.reports=[...p,H],o!==a[a.length-1]&&await new Promise($=>window.setTimeout($,600))}}finally{e===this.runId&&(this.running=!1,this.abort=null)}}text(){return ss(this.reports)}async copy(){const s=this.text();if(s){try{await navigator.clipboard.writeText(s),this.copied="ok"}catch{this.copied=this.legacyCopy(s)?"ok":"manual"}window.setTimeout(()=>this.copied="",4e3)}}legacyCopy(s){const e=document.createElement("textarea");e.value=s,e.setAttribute("readonly",""),e.style.cssText="position:fixed;inset-block-start:0;inset-inline-start:0;opacity:0",document.body.append(e),e.select();let t=!1;try{t=document.execCommand("copy")}catch{t=!1}return e.remove(),t}render(){if(!es("system.configure"))return h;const s=this.cameras,e=s!==null&&s.length===0,t=this.text();return i`<sw-card heading=${l("בדיקת חיבור וידאו")} subheading=${l("מראה מה ה־WebRTC של הדפדפן הזה עושה מול שרת הווידאו: מועמדי ICE, מעברי מצב, הזוג שנבחר וסטטיסטיקת RTP, ושורת מסקנה. בלי נגן; הבדיקה סוגרת את החיבור בסיומה. מומלץ להריץ אותה מהטלפון שבו הווידאו לא עובד.")} data-card="remote.video-conn-test" data-conn-test>
      <div class="row"><span class="lbl">${l("מצלמה")}<span class="muted">${e?l("אין מצלמות עם הרשאת צפייה"):l("כל צפייה בבדיקה נספרת במכסת הזרמים החיים של הכניסה")}</span></span>
        <sw-field class="ctl"><select data-conn-camera ?disabled=${this.running||!s?.length} @change=${r=>this.cameraId=r.target.value}>
          ${(s??[]).map(r=>i`<option value=${r.id} ?selected=${r.id===this.cameraId}>${r.alias||r.name}</option>`)}
        </select></sw-field></div>
      <div class="row"><span class="lbl">${l("זרם")}<span class="muted">${l('"שניהם": קודם המשני ואז הראשי, בזה אחר זה')}</span></span>
        <sw-field class="ctl"><select data-conn-profile ?disabled=${this.running} @change=${r=>this.choice=r.target.value}>
          <option value="sub" ?selected=${this.choice==="sub"}>${l("משני (sub)")}</option>
          <option value="main" ?selected=${this.choice==="main"}>${l("ראשי (main)")}</option>
          <option value="both" ?selected=${this.choice==="both"}>${l("שניהם")}</option>
        </select></sw-field></div>
      <div class="acts">
        ${this.running?i`<sw-button size="sm" variant="ghost" icon="close" data-conn-stop @click=${()=>this.cancel()}>${l("עצור")}</sw-button><span class="muted" data-conn-running>${l("בודק…")}</span>`:i`<sw-button size="sm" variant="primary" icon="activity" data-conn-run ?disabled=${!this.cameraId} @click=${()=>void this.start()}>${l("בדוק")}</sw-button>`}
        <sw-button size="sm" icon="list" data-conn-copy ?disabled=${!t} @click=${()=>void this.copy()}>${l("העתק דוח")}</sw-button>
        ${this.copied==="ok"?i`<span class="ok" data-conn-copied>${l("הועתק")}</span>`:h}
        ${this.copied==="manual"?i`<span class="err" data-conn-copy-manual>${l("ההעתקה נחסמה בדפדפן: סמן את הטקסט למטה והעתק ידנית")}</span>`:h}
        ${this.error?i`<span class="err">${this.error}</span>`:h}
      </div>
      ${this.reports.length?i`<div class="verdicts" data-conn-verdicts>${this.reports.map(r=>{const a=r.firstFrameAt!=null;return i`<div class=${a?"good":r.verdict?"bad":""} data-conn-verdict=${r.profile}>${r.profile==="main"?l("ראשי"):l("משני")}: ${r.verdict||l("בודק…")}</div>`})}</div>
          <pre class="report" data-conn-report tabindex="0">${t}</pre>`:h}
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
  `,W];b([d()],u.prototype,"cameras",2);b([d()],u.prototype,"cameraId",2);b([d()],u.prototype,"choice",2);b([d()],u.prototype,"running",2);b([d()],u.prototype,"reports",2);b([d()],u.prototype,"error",2);b([d()],u.prototype,"copied",2);u=b([_("system-video-conn-test")],u);
