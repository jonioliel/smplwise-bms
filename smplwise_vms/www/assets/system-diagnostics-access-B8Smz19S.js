import{dL as a,gy as ne,g as P,ax as w,j as p,i as D,x5 as je,n as C,b as r,A as d,a2 as u,aA as g,u as Ce,k as K,aU as re,x6 as Me,a as We,x7 as Fe,x8 as de,cN as T,b5 as He,bm as Oe,mh as G,tD as ce,x9 as Ue,xa as S,xb as Be,xc as X,xd as Xe,xe as z,xf as Ye,dT as Ge,xg as Ve,bc as qe,aY as pe,xh as Je,xi as Qe,a$ as he,xj as V,kq as Ze,dR as es,xk as ue,xl as fe,xm as ss,c0 as ts,xn as q,xo as me,ob as ge,a3 as as}from"./index-I3FcVZcW.js";import{a as Re,U as ze}from"./wiskey-format-g-Ir7Okk.js";import{P as _,Q as is,R as M,T as se,U as ns,V as rs,W as os,X as ls}from"./system-diagnostics-B6vdH-L6.js";import{s as Ie}from"./settings-B0P4zyXC.js";import"./wk-triage-panel-BThsY6C6.js";import{p as Pe,P as h,a as o,b as oe,c as J,S as te,d as ds,s as F,M as cs,e as ps}from"./access-parity-DjP0p5fy.js";import{b as N,p as be,c as j,s as we,t as hs,f as B,a as us}from"./tts-default-wBBpl1JV.js";import"./sw-table-MTDJvn6e.js";import{listUsers as fs}from"./access-Z19EAoBv.js";import{R as ms,s as gs,f as bs,w as ws,a as vs}from"./status-text-BT1Impk4.js";import{s as ys,C as R}from"./status-css-DbRs5vjt.js";import{c as Q}from"./safe-storage-BOOiiGOc.js";import{V as $s}from"./wiskey-validation-Db9Y-TJU.js";import"./sw-logo-art-PLtEZJxU.js";import"./wiskey-DEHG09e1.js";import"./static-BOQjuF9l.js";import"./long-lists-83hxvv3i.js";import"./skins-GC1srGA8.js";import"./plan-view-DQBWGT4U.js";import"./ha-sync-status-BcZCaSiw.js";import"./quality-mode-DqtKvl4M.js";import"./map-C2zsKqmG.js";import"./quality-ladder-Bh4CnHdp.js";import"./plan-quality-D6Lzjvp1.js";import"./wall-phone-bar-BINJOKYC.js";import"./access-status-DzXoxKAO.js";import"./schedules-logic-CwRyxIL9.js";import"./deep-links-BAGHD2Tx.js";import"./events-logic-BUix0ng8.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";var ks=Object.defineProperty,xs=Object.getOwnPropertyDescriptor,H=(e,s,t,i)=>{for(var n=i>1?void 0:i?xs(s,t):s,l=e.length-1,c;l>=0;l--)(c=e[l])&&(n=(i?c(s,t,n):c(n))||n);return i&&n&&ks(s,t,n),n};const _s=[["overview",a("סקירה")],["users",a("אנשים")],["events",a("אירועים")],["stations",a("עמדות")],["management",a("ניהול")]],Ss=[["phone",a("טלפון")],["photo",a("תמונה")],["credentials",a("אישורי כניסה")],["profile",a("פרופיל")],["access",a("גישה")]],ve={none:a("אין"),view:a("צפייה"),manage:a("ניהול"),unknown:a("לא ידוע")},Z={ready:a("מחובר"),connecting:a("מתחבר"),ha_unavailable:a("תשתית המערכת אינה זמינה"),ha_not_configured:a("אין גישה לתשתית המערכת"),not_installed:a("WisKey אינו מותקן"),forbidden:a("WisKey דחה את החשבון"),error:a("שגיאה"),not_configured:a("לא הוגדר"),shares_service_identity:a("משתמש בזהות השירות")},Ts={ok:a("התקבלה תשובה"),not_asked:a("לא נבדק"),not_ready:a("הערוץ אינו מחובר"),forbidden:a("WisKey דחה את הבקשה"),unauthorized:a("WisKey דחה את הבקשה"),rate_limited:a("נבדק הרגע - נסו שוב בעוד כמה שניות"),busy:a("ממתין לבקשה קודמת"),timeout:a("לא התקבלה תשובה בזמן"),invalid_response:a("התשובה אינה בפורמט המוכר"),ha_unavailable:a("תשתית המערכת אינה זמינה")},Es={ok:a("פעילה"),not_attempted:a("לא נוסתה"),"n/a":a("לא רלוונטי")},As={service_identity_is_admin:a("זהות השירות היא מנהל ב־WisKey. זה המצב הנוכחי של הכתיבות הקיימות (שחרור דלת, אנשים, כרטיסים)."),background_shares_service_identity:a("ערוץ הרקע עדיין משתמש בזהות השירות (מנהל). אחרי שבעל המוצר יוצר משתמש רקע ייעודי ומגדיר את האסימון שלו, הערוץ מתפצל לחיבור משלו."),background_is_admin:a("חשבון הרקע הוא מנהל ב־WisKey. הוא אמור להיות משתמש רגיל עם צפייה בסקירה בלבד."),background_cannot_read_overview:a("לחשבון הרקע אין צפייה בסקירה, ולכן ערוץ הרקע לא יקבל נתונים."),background_has_more_than_overview:a('לחשבון הרקע יש הרשאות מעבר לסקירה. ההמלצה: כל שאר האזורים והשדות ברמת "אין".'),background_scope_is_all_stations:a("חשבון הרקע רואה את כל העמדות. ההמלצה: היקף עמדות מפורש וצר."),background_authorization_unavailable:a("לא התקבלה תשובת הרשאות מערוץ הרקע."),background_subscribe_not_live:a("ההרשמה לעדכונים של ערוץ הרקע אינה פעילה; הערוץ מתעדכן רק בבדיקה תקופתית."),service_subscribe_not_live:a("ההרשמה לעדכונים של זהות השירות אינה פעילה."),connection_locked:a("החיבור נעול ב־WisKey. קריאות יידחו עד שהמשתמש יפתח אותו ב־WisKey; Arx לא מנסה לעקוף."),idle_or_reauth_configured:a("ב־WisKey מוגדר זמן נעילה או אימות חוזר. אם הם יחולו על חיבור של Arx, פעולות יידחו עד שיפתחו בחלון האינטרקום.")},Cs={service:a("זהות השירות"),background:a("ערוץ הרקע")};function Os(e){return e==="ready"?"live":e==="connecting"?"unknown":e==="forbidden"?"forbidden":e==="error"?"error":e==="shares_service_identity"?"stale":"offline"}let I=class extends D{constructor(){super(...arguments),this.bare=!1,this.data=null,this.busy=!1,this.error=""}async run(){this.busy=!0,this.error="";try{this.data=await je()}catch(e){this.error=C(e)}finally{this.busy=!1}}renderAuth(e,s){if(!e)return r`<div class="muted" data-wk-diag-auth-state>${s}</div>`;const t=e.security,i=e.station_scope;return r`
      <div class="facts" data-wk-diag-identity>
        <span>${e.is_admin?a("מנהל ב־WisKey"):e.is_admin===!1?a("לא מנהל"):a("מנהל: לא ידוע")}</span>
        <span>${e.allowed===!1?a("הגישה נדחתה"):e.allowed?a("הגישה מאושרת"):a("גישה: לא ידוע")}</span>
        <span>${a("עמדות:")} ${i.kind==="all"?a("כולן"):i.kind==="explicit"?a("{n} מפורשות",{n:i.count??i.ids.length}):a("לא ידוע")}</span>
        ${t?r`<span>${t.locked?a("החיבור נעול"):t.locked===!1?a("החיבור פתוח"):a("נעילה: לא ידוע")}${t.idle_minutes?` · idle ${a("{n} דק׳",{n:t.idle_minutes})}`:""}${t.reauth_sensitive?` · ${a("אימות חוזר")}`:""}</span>`:r`<span class="muted">${a("אין הגדרת נעילה ב־WisKey")}</span>`}
      </div>
      <div class="chips" aria-label=${a("אזורים")}>${_s.map(([n,l])=>r`<span class="chip ${e.areas[n]==="none"?"":"on"}">${l}: ${ve[e.areas[n]]}</span>`)}</div>
      <div class="chips" aria-label=${a("שדות")}>${Ss.map(([n,l])=>r`<span class="chip ${e.fields[n]==="none"?"":"on"}">${l}: ${ve[e.fields[n]]}</span>`)}</div>`}renderIdentity(e,s,t){const i=Z[s.state]??s.state;return r`<div class="block" data-wk-diag=${t}>
      <div class="head"><span>${e}</span><sw-badge kind=${Os(s.state)} label=${i}></sw-badge></div>
      <div class="facts">
        ${s.wiskey_version?r`<span>WisKey <bdi>${s.wiskey_version}</bdi></span>`:d}
        <span>${a("הרשמה לעדכונים:")} ${Es[s.subscribe]??s.subscribe}</span>
      </div>
      ${this.renderAuth(s.authorization,Ts[s.authorization_state]??s.authorization_state)}
    </div>`}renderChannels(e){return r`<div class="block" data-wk-diag="channels">
      <div class="head"><span>${a("פקודות מותרות לכל ערוץ")}</span></div>
      <div class="facts"><span>${a("ערוץ הרקע:")} <bdi>${e.background.join(", ")}</bdi></span></div>
      <div class="facts"><span>${a("זהות השירות, קריאה:")} <bdi>${e.service.reads.join(", ")}</bdi></span></div>
      <div class="facts"><span>${a("זהות השירות, כתיבה:")} <bdi>${e.service.writes.join(", ")}</bdi></span></div>
    </div>`}renderFinding(e){return r`<div class="finding ${e.level}" data-wk-diag-finding=${e.code}><b>${Cs[e.subject]}:</b> ${As[e.code]??e.code}</div>`}summary(){const e=_().sum,s=this.data;return this.busy?_().sum.loading:s?is(e.diag,{service:Z[s.service.state]??s.service.state,background:Z[s.background.state]??s.background.state}):this.error?e.diagFailed:e.diagIdle}updated(){this.bare&&M(this,{card:"diagnostics",summary:this.summary(),present:u()&&g("system.configure")})}render(){if(!u())return d;if(!g("system.configure"))return d;const e=this.data;return r`<sw-card heading=${this.bare?"":a("WisKey רואה את Arx כ־")} subheading=${this.bare?"":a("קריאה בלבד: מה ש־WisKey מדווח על זהות החיבורים של Arx אליו. הבדיקה נעשית לפי בקשה.")} data-wk-diag-card>
      <div class="block">
        <div class="head"><span class="muted">${e?r`${a("נבדק ב־")}<bdi>${Re(e.generated_at,Ce(),ze)}</bdi>`:a("עדיין לא נבדק")}</span>
          <sw-button size="sm" variant="primary" icon="refresh" data-wk-diag-run ?disabled=${this.busy} @click=${()=>this.run()}>${this.busy?a("בודק…"):e?a("בדיקה מחדש"):a("בדיקה")}</sw-button></div>
        ${this.error?r`<div class="err" role="alert">${this.error}</div>`:d}
      </div>
      ${e?r`${this.renderIdentity(a("זהות השירות (המשתמש של ה־add-on)"),e.service,"service")}
            ${this.renderIdentity(a("ערוץ הרקע"),e.background,"background")} ${this.renderChannels(e.channels)}
            ${e.findings.length?r`<div class="findings">${e.findings.map(s=>this.renderFinding(s))}</div>`:d}`:d}
    </sw-card>`}};I.styles=P`
    :host {
      display: block;
    }
    .block {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .block:last-of-type {
      border-block-end: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: var(--sw-fw-medium);
    }
    ${ne}
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      font-size: var(--sw-fs-sm);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    .chip.on {
      background: var(--sw-accent-soft);
    }
    .finding {
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
      background: var(--sw-surface-2);
    }
    .finding.warn {
      background: var(--sw-warning-soft);
    }
    .findings {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-block-start: 10px;
    }
    .err {
      align-self: flex-start;
      padding: 2px 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    bdi {
      unicode-bidi: isolate;
    }
    /* POLISH4-WP7: on a phone the head (label + check key) wraps and the key takes the line; the facts stack */
    @media (max-width: 767px) {
      .head {
        flex-wrap: wrap;
      }
      .head sw-button {
        flex: 1 1 100%;
      }
      .facts {
        flex-direction: column;
        gap: 4px;
      }
    }
  `;H([w({type:Boolean,reflect:!0})],I.prototype,"bare",2);H([p()],I.prototype,"data",2);H([p()],I.prototype,"busy",2);H([p()],I.prototype,"error",2);I=H([K("system-wiskey-diagnostics")],I);var Rs=Object.defineProperty,zs=Object.getOwnPropertyDescriptor,E=(e,s,t,i)=>{for(var n=i>1?void 0:i?zs(s,t):s,l=e.length-1,c;l>=0;l--)(c=e[l])&&(n=(i?c(s,t,n):c(n))||n);return i&&n&&Rs(s,t,n),n};const Is=["off","everyone","roles"];let y=class extends D{constructor(){super(...arguments),this.bare=!1,this.view=null,this.draft=null,this.busy=!1,this.message="",this.error="",this.failed="",this.absent=!1,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}async load(){const e=++this.gen;if(this.failed="",!(!u()||!g("system.configure")))try{const s=await Me();if(e!==this.gen)return;this.view=s,this.draft={...s.settings,roles:[...s.settings.roles],stations:[...s.settings.stations]}}catch(s){if(e!==this.gen)return;!(s instanceof We)||s.status===404?this.absent=!0:this.failed=C(s)}}patch(e){this.draft&&(this.draft={...this.draft,...e},this.message="",this.error="")}toggle(e,s,t){if(!this.draft)return;const i=this.draft[e].filter(n=>n!==s);this.patch({[e]:t?[...i,s]:i})}dirty(){const e=this.view?.settings,s=this.draft;if(!e||!s)return!1;const t=(i,n)=>i.length===n.length&&[...i].sort().join(`
`)===[...n].sort().join(`
`);return e.mode!==s.mode||e.sound!==s.sound||!t(e.roles,s.roles)||!t(e.stations,s.stations)}async save(){const e=this.draft;if(!(!e||this.busy||!this.dirty())){this.busy=!0,this.error="";try{const s=await Fe(e);this.view=s,this.draft={...s.settings,roles:[...s.settings.roles],stations:[...s.settings.stations]},this.message=de().setting.saved}catch(s){this.error=C(s)}finally{this.busy=!1}}}summary(){const e=this.view?.settings;return this.failed?_().sum.failed:e?se(ns(e.mode,e.roles.length,e.stations.length,e.sound),this.dirty()):_().sum.loading}updated(){this.bare&&M(this,{card:"calls",summary:this.summary(),present:u()&&g("system.configure")&&!this.absent})}render(){if(!u()||!g("system.configure")||this.absent)return d;const e=de().setting,s=this.bare?"":e.title;if(this.failed)return r`<sw-card heading=${s} data-call-banner-setting="error"><div class="row"><span class="lbl">${e.error}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void this.load()}>${e.retry}</sw-button></div></sw-card>`;const t=this.view,i=this.draft;if(!t||!i)return d;const n={off:e.off,everyone:e.everyone,roles:e.roles},l=i.mode==="roles"&&i.roles.length===0;return r`<sw-card heading=${s} subheading=${this.bare?"":e.sub} data-call-banner-setting="ready" data-mode=${i.mode}>
      <div class="row"><span class="lbl">${e.mode}<span class="muted">${e.modeText}</span></span>
        <sw-field class="ctl"><select data-call-banner-mode ?disabled=${this.busy} @change=${c=>this.patch({mode:c.target.value})}>
          ${Is.map(c=>r`<option value=${c} ?selected=${i.mode===c}>${n[c]}</option>`)}
        </select></sw-field></div>
      ${i.mode==="roles"?r`<div class="row stack" data-call-banner-roles><span class="lbl">${e.rolesLabel}${l?r`<span class="muted" role="alert">${e.needRole}</span>`:d}</span>
            <div class="checks">${t.roles.map(c=>r`<label><input type="checkbox" data-call-banner-role=${c.id} .checked=${i.roles.includes(c.id)} ?disabled=${this.busy}
              @change=${x=>this.toggle("roles",c.id,x.target.checked)} />${c.name}</label>`)}</div></div>`:d}
      ${i.mode!=="off"?r`<div class="row stack" data-call-banner-stations><span class="lbl">${e.stationsLabel}<span class="muted">${i.stations.length?"":e.stationsAll}</span></span>
              ${t.stations.length?r`<div class="checks">${t.stations.map(c=>r`<label><input type="checkbox" data-call-banner-station=${c.id} .checked=${i.stations.includes(c.id)} ?disabled=${this.busy}
                    @change=${x=>this.toggle("stations",c.id,x.target.checked)} />${c.name||"—"}</label>`)}</div>`:r`<span class="muted">${e.stationsNone}</span>`}</div>
            <div class="row"><span class="lbl">${e.sound}<span class="muted">${e.soundText}</span></span>
              <label class="one"><input type="checkbox" data-call-banner-sound aria-label=${e.sound} .checked=${i.sound} ?disabled=${this.busy} @change=${c=>this.patch({sound:c.target.checked})} /></label></div>`:d}
      <div class="foot">
        <sw-button variant="primary" icon="check" data-save-call-banner ?disabled=${!this.dirty()||l||this.busy} @click=${()=>void this.save()}>${e.save}</sw-button>
        ${this.message?r`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:d}
        ${this.error?r`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:d}
      </div>
    </sw-card>`}};y.styles=[Ie,P`
      /* no box of its own: while nothing is drawn (loading, an older backend) the settings column's gap is not taken */
      :host {
        display: contents;
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px));
        --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px));
      }
      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 16px;
      }
      .checks label,
      label.one {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-block-size: 44px;
        cursor: pointer;
      }
      input[type='checkbox'] {
        inline-size: 18px;
        block-size: 18px;
        accent-color: var(--sw-accent);
      }
      .row.stack {
        flex-direction: column;
        align-items: stretch;
      }
      .row.stack .lbl {
        flex: none;
      }
    `,re];E([w({type:Boolean,reflect:!0})],y.prototype,"bare",2);E([p()],y.prototype,"view",2);E([p()],y.prototype,"draft",2);E([p()],y.prototype,"busy",2);E([p()],y.prototype,"message",2);E([p()],y.prototype,"error",2);E([p()],y.prototype,"failed",2);E([p()],y.prototype,"absent",2);y=E([K("system-call-banner")],y);const Ps=()=>He("system/wiskey-pairing"),Ds=()=>Oe("system/wiskey-pairing/probe"),Ks=e=>Oe("system/wiskey-pairing/repair",{confirm:!0,pause_rotation:e}),Ls=600*1e3;function Ns(e,s=Date.now()){if(!e)return!0;const t=Date.parse(e.at);return!Number.isFinite(t)||s-t>Ls}const ye={paired:T("מצומד: WisKey מקבל את המפתח של Arx"),not_paired:T("לא מצומד"),unknown:T("לא ידוע עדיין")},js={SET:T("הגדרה"),POL:T("מדיניות"),PAIR:T("צימוד"),WK:T("צד WisKey"),OWN:T("פעולת בעלים"),RUN:T("הפעלה מחדש")};function Ms(e){const s=new Map;for(const t of e){const i=s.get(t.group)??[];i.push(t),s.set(t.group,i)}return[...s.entries()]}function Ws(e){const s={on:0,off:0,blocked:0,unknown:0};for(const t of e)s[t.state]+=1;return s}var Fs=Object.defineProperty,Hs=Object.getOwnPropertyDescriptor,k=(e,s,t,i)=>{for(var n=i>1?void 0:i?Hs(s,t):s,l=e.length-1,c;l>=0;l--)(c=e[l])&&(n=(i?c(s,t,n):c(n))||n);return i&&n&&Fs(s,t,n),n};const Us={ok:"live",warn:"stale",blocked:"error",unknown:"unknown"},Bs={ok:a("תקין"),warn:a("לתשומת לב"),blocked:a("חסום"),unknown:a("לא ידוע")},Xs={on:"live",off:"offline",blocked:"error",unknown:"unknown"},Ys={local:a("Arx (וידאו בלבד)"),auto:a("WisKey (וידאו ודיבור)")},Gs={on:a("פעיל"),off:a("כבוי"),blocked:a("חסום"),unknown:a("לא ידוע")};let b=class extends D{constructor(){super(...arguments),this.bare=!1,this.data=null,this.busy="",this.error="",this.confirming=!1,this.pauseRotation=!0,this.result=null,this.copied=!1,this.showFeatures=null,this.showTriage=null}get featuresShown(){return this.showFeatures??!this.bare}get triageShown(){return this.showTriage??!this.bare}connectedCallback(){super.connectedCallback(),u()&&g("system.configure")&&!G()&&this.load()}async load(){this.busy="load",this.error="";try{this.data=await Ps()}catch(e){this.error=C(e)}finally{this.busy=""}}async probe(){this.busy="probe",this.error="";try{this.data=await Ds()}catch(e){this.error=C(e)}finally{this.busy=""}}async repair(){this.busy="repair",this.error="";try{this.result=await Ks(this.pauseRotation),this.data=this.result.status,this.confirming=!1}catch(e){this.error=C(e)}finally{this.busy=""}}async copy(e){try{await navigator.clipboard.writeText(e),this.copied=!0,setTimeout(()=>this.copied=!1,2e3)}catch{this.copied=!1}}renderFacts(e){const s=e.facts;if(e.key==="discovery"&&s.listed&&typeof s.listed=="object"&&Object.keys(s.listed).length){const t=s.listed;return r`<div class="chips" data-wkp-listed>${Object.entries(t).map(([i,n])=>r`<span class="chip ${n?"on":""}"><bdi>${i}</bdi> ${n?"✓":"✗"}</span>`)}</div>`}if(e.key==="provider"){const t=Array.isArray(s.readiness)?s.readiness:[],i=s.row??null;return r`<div class="chips" data-wkp-provider><span class="chip" data-wkp-provider-choice=${String(s.choice??"")}>${Ys[String(s.choice)]??String(s.choice??"")}</span>
          <span class="chip">${a("רשימת ערוץ השירות:")} <bdi>${s.feed_reason?String(s.feed_reason):a("מפרסמת וידאו")}</bdi></span>
          ${t.map(n=>r`<span class="chip" data-wkp-readiness=${n}><bdi>${n}</bdi></span>`)}</div>
        ${i?r`<a href=${i.href} data-wkp-provider-link>${a('לשורה "{label}"',{label:i.label})}</a>`:d}`}return d}renderLine(e){return r`<div class="line" data-wkp-line=${e.key} data-state=${e.state}>
      <span class="lbl">${e.label}</span>
      <sw-badge kind=${Us[e.state]} label=${Bs[e.state]}></sw-badge>
      <div class="body"><span>${e.text}</span>${this.renderFacts(e)}${e.fix?r`<span class="fix ${e.state==="blocked"?"blocked":""}" data-wkp-fix>${a("איך מתקנים:")} ${e.fix}</span>`:d}</div>
    </div>`}renderRepair(e){if(!e.repair.available&&!this.result)return d;const s=this.result;return r`<div class="section" data-wkp-repair>
      <h4>${a("צימוד מחדש")}</h4>
      ${s?r`<div class="muted" data-wkp-repair-done>${s.announced?a("נוצר קוד צימוד חדש והוא נשלח לגשר."):a("נוצר קוד צימוד חדש. יש להזין אותו בגשר בתשתית המערכת.")}${s.rotation_paused?` ${a("החלפת מפתח הגשר כובתה.")}`:""}</div>
            ${s.pairing_code?r`<div class="code"><span>${a("קוד הצימוד:")}</span><code data-wkp-code>${s.pairing_code}</code>
                  <sw-button size="sm" icon="copy" @click=${()=>this.copy(s.pairing_code??"")}>${this.copied?a("הועתק"):a("העתקה")}</sw-button></div>`:d}
            <ol data-wkp-repair-steps>${s.steps.map(t=>r`<li>${t}</li>`)}</ol>`:r`<div class="muted">${e.repair.announce?a("Arx יכול לתקן את זה בעצמו: ליצור קוד צימוד חדש ולשלוח אותו לגשר. פעולה של מנהל מערכת, נרשמת ביומן."):a("Arx יכול לתקן את זה בעצמו: ליצור קוד צימוד חדש (את הקוד מזינים בגשר בתשתית המערכת). פעולה של מנהל מערכת, נרשמת ביומן.")}</div>
            <div><sw-button variant="danger" size="sm" icon="link" data-wkp-repair-open ?disabled=${!!this.busy} @click=${()=>this.confirming=!0}>${a("צימוד מחדש")}</sw-button></div>`}
    </div>`}renderConfirm(e){return this.confirming?r`<sw-dialog open heading=${a("צימוד מחדש של Arx ו־WisKey")} data-wkp-confirm @close=${()=>this.confirming=!1}>
      <div class="dlg">
        <div>${a("Arx ייצור קוד צימוד חדש. עד שהגשר יקבל אותו, פעולות דרך הגשר (פתיחת דלת, פעולות בהתקנים, רשימת המשתמשים) ו־WisKey לא יעבדו, וכל אישור קליטת כרטיס פתוח יבוטל.")}</div>
        <div>${e.repair.announce?a("הקוד יישלח לגשר אוטומטית; ייתכן שתופיע בקשת אישור בתשתית המערכת."):a("בהתקנה הזו הקוד לא נשלח אוטומטית: יוצגו כאן הקוד והשלבים להזנתו בגשר.")}</div>
        <label class="chk"><input type="checkbox" data-wkp-pause .checked=${this.pauseRotation} @change=${s=>this.pauseRotation=s.target.checked} />
          <span>${a("לכבות גם את החלפת מפתח הגשר (מומלץ: החלפה מנתקת את WisKey)")}</span></label>
        ${this.error?r`<div class="err" role="alert">${this.error}</div>`:d}
      </div>
      <div class="dfoot"><sw-button variant="ghost" @click=${()=>this.confirming=!1}>${a("ביטול")}</sw-button>
        <sw-button variant="danger" data-wkp-confirm-ok ?disabled=${this.busy==="repair"} @click=${()=>this.repair()}>${this.busy==="repair"?a("מצמד…"):a("צימוד מחדש")}</sw-button></div>
    </sw-dialog>`:d}renderFeature(e){return r`<div class="feat" data-wkp-feature=${e.key} data-state=${e.state}>
      <span>${e.label}</span>
      <sw-badge kind=${Xs[e.state]} label=${Gs[e.state]}></sw-badge>
      <div class="reasons">
        ${e.reasons.map(s=>r`<div class="reason" data-wkp-reason=${s.code}><span class="kind">${js[s.kind]}</span>${s.text}${s.fix?r` <span class="how">· ${a("איך מפעילים:")} ${s.fix}</span>`:d}</div>`)}
        ${e.link?r`<a href=${e.link.href} data-wkp-link>${e.link.label}</a>`:d}
      </div>
    </div>`}renderFeatures(e){if(!e.features.length)return d;const s=Ws(e.features);return r`<div class="section" data-wkp-features>
      <div class="top" style="border:0;padding:0">
        <h4>${a("מצב WisKey: תכונות בנויות")}</h4>
        <span class="muted">${a("{n} פעילות",{n:s.on})} · ${a("{n} כבויות",{n:s.off})} · ${a("{n} חסומות",{n:s.blocked})}${s.unknown?` · ${a("{n} לא ידוע",{n:s.unknown})}`:""}</span>
        <span class="sp"></span>
        <sw-button size="sm" variant="ghost" data-wkp-features-toggle @click=${()=>this.showFeatures=!this.featuresShown}>${this.featuresShown?a("הסתרה"):a("הצגה")}</sw-button>
      </div>
      ${this.featuresShown?Ms(e.features).map(([t,i])=>r`<div class="group"><h5>${t}</h5>${i.map(n=>this.renderFeature(n))}</div>`):d}
    </div>`}renderTriage(){return this.bare?r`<div class="section" data-wkp-triage>
        <div class="top" style="border:0;padding:0"><h4>${a("מצב WisKey: התנגשויות והתראות")}</h4><span class="sp"></span>
          <sw-button size="sm" variant="ghost" data-wkp-triage-toggle @click=${()=>this.showTriage=!this.triageShown}>${this.triageShown?a("הסתרה"):a("הצגה")}</sw-button></div>
        ${this.triageShown?r`<wk-triage-panel mode="compact"></wk-triage-panel>`:d}
      </div>`:r`<div class="section" data-wkp-triage>
      <h4>${a("מצב WisKey: התנגשויות והתראות")}</h4>
      <wk-triage-panel mode="compact"></wk-triage-panel>
    </div>`}summary(){const e=_().sum;if(G())return ce;const s=this.data;return s?`${ye[s.verdict]} · ${s.talk_ready?e.pairingTalkReady:e.pairingTalkNot}`:this.error?e.failed:e.loading}updated(){this.bare&&M(this,{card:"pairing",summary:this.summary(),present:u()&&g("system.configure")})}render(){if(!u()||!g("system.configure"))return d;const e=this.data,s=G();return r`<sw-card heading=${this.bare?"":a("חיבור Arx ל-WisKey")} subheading=${this.bare?"":a("האם Arx ו־WisKey מצומדים, מה חסר ואיך משלימים. הבדיקה החתומה היא קריאה בלבד ונרשמת ביומן.")} data-wkp-card>
      ${s?r`<div class="muted" data-wkp-remote>${ce}</div>`:r`<div class="top">
              ${e?r`<sw-badge kind=${e.paired?"live":e.paired===!1?"error":"unknown"} filled label=${ye[e.verdict]} data-wkp-verdict=${e.verdict}></sw-badge>
                  <span class="muted" data-wkp-talk>${e.talk_ready?a("דיבור דרך WisKey: מוכן"):a("דיבור דרך WisKey: לא מוכן")}</span>`:r`<span class="muted">${this.busy==="load"?a("טוען…"):""}</span>`}
              <span class="sp"></span>
              ${e?.probe?r`<span class="muted" data-wkp-checked>${a("נבדק ב־")}<bdi>${Re(e.probe.at,Ce(),ze)}</bdi>${Ns(e.probe)?` · ${a("בדיקה ישנה, מומלץ לבדוק שוב")}`:""}</span>`:d}
              <sw-button size="sm" variant="primary" icon="shield" data-wkp-probe ?disabled=${!!this.busy} @click=${()=>this.probe()}>${this.busy==="probe"?a("בודק…"):a("בדוק חיבור חתום")}</sw-button>
            </div>
            ${this.error&&!this.confirming?r`<div class="err" role="alert" style="margin-block-start:8px">${this.error}</div>`:d}
            ${e?r`<div class="lines">${e.lines.map(t=>this.renderLine(t))}</div>
                  ${e.owner_steps.length?r`<div class="section" data-wkp-steps><h4>${a("מה נדרש מחוץ ל־Arx")}</h4><ol>${e.owner_steps.map(t=>r`<li>${t}</li>`)}</ol></div>`:d}
                  ${this.renderRepair(e)} ${this.renderFeatures(e)} ${this.renderTriage()} ${this.renderConfirm(e)}`:d}`}
    </sw-card>`}};b.styles=P`
    :host {
      display: block;
    }
    .top {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding-block-end: 10px;
      border-block-end: 1px solid var(--sw-border);
    }
    .top .sp {
      flex: 1 1 auto;
    }
    ${ne}
    .lines {
      display: flex;
      flex-direction: column;
    }
    .line {
      display: grid;
      grid-template-columns: minmax(150px, 220px) auto 1fr;
      align-items: start;
      gap: 4px 12px;
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .line .lbl {
      font-weight: var(--sw-fw-medium);
    }
    .line .body {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .fix {
      padding: 4px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      line-height: 1.45;
    }
    .fix.blocked {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    .chip.on {
      background: var(--sw-accent-soft);
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-block: 12px;
      border-block-end: 1px solid var(--sw-border);
    }
    .section:last-child {
      border-block-end: 0;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    ol {
      margin: 0;
      padding-inline-start: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .code {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .code code {
      padding: 4px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-family: var(--sw-font-mono, monospace);
      direction: ltr;
      unicode-bidi: isolate;
      overflow-wrap: anywhere;
    }
    .err {
      align-self: flex-start;
      padding: 2px 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .group {
      display: flex;
      flex-direction: column;
    }
    .group h5 {
      margin: 8px 0 2px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .feat {
      display: grid;
      grid-template-columns: minmax(170px, 260px) auto 1fr;
      gap: 4px 12px;
      align-items: start;
      padding: 7px 0;
      border-block-end: 1px dashed var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .reasons {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .reason .kind {
      display: inline-block;
      margin-inline-end: 6px;
      padding: 0 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-xs);
    }
    .reason .how {
      color: var(--sw-text-2);
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .dfoot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding-block-start: 12px;
    }
    label.chk {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    bdi {
      unicode-bidi: isolate;
    }
    /* SETTINGS-INTERCOM-CARDS-2401: inside a card of layout a the status lines are a step denser */
    :host([bare]) .line {
      padding: 6px 0;
    }
    :host([bare]) .section {
      padding-block: 8px;
    }
    @media (max-width: 767px) {
      .line,
      .feat {
        grid-template-columns: 1fr auto;
      }
      .line .body,
      .feat .reasons {
        grid-column: 1 / -1;
      }
      .top sw-button {
        flex: 1 1 100%;
      }
    }
  `;k([w({type:Boolean,reflect:!0})],b.prototype,"bare",2);k([p()],b.prototype,"data",2);k([p()],b.prototype,"busy",2);k([p()],b.prototype,"error",2);k([p()],b.prototype,"confirming",2);k([p()],b.prototype,"pauseRotation",2);k([p()],b.prototype,"result",2);k([p()],b.prototype,"copied",2);k([p()],b.prototype,"showFeatures",2);k([p()],b.prototype,"showTriage",2);b=k([K("system-wiskey-pairing")],b);const Vs=2e3;function $e(e){const s=e.split(/\r?\n/).map(i=>i.split(/\s+/).filter(Boolean).join(" ")).filter(i=>i.length>0),t=Pe({[h.phrases]:e}).phrases.length;return{shown:t,dropped:Math.max(0,s.length-t),builtIn:t===0}}const qs={off:"dispMediaOff",video:"dispMediaVideo",video_talk:"dispMediaTalk"},ke=()=>Ue.map(e=>[e,o(qs[e])]),Js={match:"live",filtered:"neutral",mismatch:"error",partial:"partial",not_permitted:"forbidden",unsupported:"unknown",unavailable:"offline"},Qs=e=>Js[e]??"unknown",xe=e=>oe(`out_${e}`,"out_unavailable");function Zs(e){return e.outcome==="filtered"?oe(`why_${e.rule??"station_scope"}`,"why_station_scope"):e.outcome==="not_permitted"?o("why_permission"):e.outcome==="mismatch"?o("why_mismatch"):e.outcome==="partial"?o("why_partial"):""}function _e(e){return!e||e.count===null||e.count===void 0?"—":e.complete?String(e.count):o("notComplete",{n:e.count})}const et=e=>oe(`scr_${e}`,"scr_stations"),De=["overview","events","people","devices"];function st(e,s){const t=/^#\/wiskey\/([a-z-]+)$/.exec(e);return t?{native:s(t[1])===!0?e:null,classic:De.includes(t[1])?`${e}?classic=1`:null}:{native:e||null,classic:null}}const ae=[{screen:"overview",label:"chk_overview",items:["item_stations_count","item_ringing"]},{screen:"stations",label:"chk_stations",items:["item_stations_count","item_doors","item_technical"]},{screen:"people",label:"chk_people",items:["item_people_count","item_sample_person"]},{screen:"events",label:"chk_events",items:["item_last_events","item_event_filters"]},{screen:"schedules",label:"chk_schedules",items:["item_schedule"]}],ie="sw.access.parity.checklist";function tt(e){try{const s=e?.getItem(ie);if(!s)return{};const t=JSON.parse(s);if(!t||typeof t!="object"||Array.isArray(t))return{};const i={};for(const n of ae){const l=t[n.screen];if(!(!l||typeof l!="object"))for(const c of n.items)l[c]===!0&&((i[n.screen]??={})[c]=!0)}return i}catch{return{}}}function Se(e,s){try{if(!e)return;Object.keys(s).length?e.setItem(ie,JSON.stringify(s)):e.removeItem(ie)}catch{}}function at(e,s,t){const i=JSON.parse(JSON.stringify(e)),n=i[s]??={};return n[t]?delete n[t]:n[t]=!0,Object.keys(n).length||delete i[s],i}function Te(e,s){let t=0,i=0;for(const n of s)i+=n.items.length,t+=n.items.filter(l=>e[n.screen]?.[l]).length;return{done:t,all:i}}var it=Object.defineProperty,nt=Object.getOwnPropertyDescriptor,m=(e,s,t,i)=>{for(var n=i>1?void 0:i?nt(s,t):s,l=e.length-1,c;l>=0;l--)(c=e[l])&&(n=(i?c(s,t,n):c(n))||n);return i&&n&&it(s,t,n),n};const Ee={[h.callHint]:J.callHint,[h.talk]:J.talk,[h.announceScope]:J.announceScope,[h.phrases]:"",[z]:"off",[X]:"local",[S]:String(ss),[te]:"off",[j]:"",[N]:""};let f=class extends D{constructor(){super(...arguments),this.show="all",this.bare=!1,this.saved=null,this.draft={},this.canEdit=!1,this.busy=!1,this.message="",this.error="",this.failed="",this.readiness=null,this.readinessFailed=!1,this.engines=null,this.enginesState="idle",this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}read(e){const s=Pe(e);return{[h.callHint]:s.callHint,[h.talk]:s.talk,[h.announceScope]:s.announceScope,[h.phrases]:String(e[h.phrases]??""),[z]:Ye(e),[X]:Xe(e),[S]:String(Be(e)),[te]:ds(e),[j]:be(e).engine,[N]:be(e).language}}async load(){const e=++this.gen;if(this.failed="",!u()){this.saved={...Ee};return}try{const s=await Ge();if(e!==this.gen)return;this.saved=this.read(s.settings),this.canEdit=!!s.can_edit&&g("system.configure"),this.show!=="announce"&&this.loadReadiness(),this.show!=="display"&&this.canEdit&&this.enginesState==="idle"&&this.loadEngines()}catch(s){if(e!==this.gen)return;this.failed=C(s)}}async loadReadiness(){if(!u()||!g("system.configure"))return;const e=this.gen;this.readinessFailed=!1;try{const s=await Ve();e===this.gen&&(this.readiness=s)}catch{e===this.gen&&(this.readinessFailed=!0)}}async loadEngines(){const e=this.gen;this.enginesState="loading";try{const s=await qe();if(e!==this.gen)return;this.engines=s.tts??null,this.enginesState=s.tts?"ready":"unavailable"}catch{e===this.gen&&(this.enginesState="unavailable")}}readinessLine(){if(!u()||!g("system.configure"))return null;const e=pe().source;if(this.readinessFailed)return{state:"failed",text:e.failed};const s=Je(this.readiness);if(!s)return{state:"checking",text:e.checking};const t=this.value(X)==="auto";if(s.state==="ok")return{state:"ok",text:t?e.ok:e.okLocal};const i=e.capsKinds[Qe(this.readiness)],n=s.codes.map(c=>he(e.codes[c],{kind:i})).join("; "),l=t?s.state==="partial"?e.videoOnly:e.fallback:"";return{state:s.state,text:`${he(e.missing,{list:n})}${l?` - ${l}`:""}`}}settled(){const e=this.show!=="announce"&&u()&&g("system.configure")&&!this.readinessFailed&&this.readiness===null,s=this.show!=="display"&&this.canEdit&&(this.enginesState==="idle"||this.enginesState==="loading");return!e&&!s}value(e){return this.draft[e]??this.saved?.[e]??Ee[e]}set(e,s){const t={...this.draft};if(this.saved&&this.saved[e]===s?delete t[e]:t[e]=s,this.draft=t,this.message="",e===j){const i=this.value(N),n=this.engineLanguages(s);i&&n.length&&!n.includes(i)&&this.set(N,"")}}engineLanguages(e){const s=e||we(this.engines);return this.engines?.engines.find(t=>t.engine_id===s)?.supported_languages??[]}ttsRows(){const e=hs().setting,s=!u()||!this.canEdit,t=this.value(j),i=this.value(N),n=this.engines?.engines??[],l=this.enginesState==="ready",c=l&&!!t&&!n.some(v=>v.engine_id===t),x=n.find(v=>v.engine_id===we(this.engines)),U=[["",e.systemDefault],...n.map(v=>[v.engine_id,v.name])];t&&!n.some(v=>v.engine_id===t)&&U.push([t,l?B(e.missingOption,{engine:t}):t]);const L=this.engineLanguages(t),le=[["",e.languageAuto],...L.map(v=>[v,`${us(v)} · ${v}`])];i&&!L.includes(i)&&le.push([i,l&&L.length?B(e.missingLanguageOption,{language:i}):i]);const Le=s?r`<span class="muted">${e.engineText}</span>`:c?r`<span class="msg warn" role="status" data-tts-fixed-missing><sw-icon name="warning" size=${13}></sw-icon>${B(e.missing,{engine:t})}</span>`:this.enginesState==="unavailable"?r`<span class="muted" role="status" data-tts-fixed-list="unavailable">${e.listUnavailable}</span>`:l&&!n.length?r`<span class="muted" role="status" data-tts-fixed-list="empty">${e.noEngines}</span>`:r`<span class="muted">${this.enginesState==="loading"?e.loading:e.engineText}</span>`,Ne=!t&&x?r`<span class="muted" data-tts-fixed-default-now>${B(e.systemDefaultNow,{name:x.name})}</span>`:d;return r`<div class="row" data-access-display-tts-engine><span class="lbl">${e.engine}${Le}${Ne}</span>
        ${this.select(j,U)}</div>
      ${L.length||i?r`<div class="row" data-access-display-tts-language><span class="lbl">${e.language}<span class="muted">${e.languageText}</span></span>
            ${this.select(N,le)}</div>`:d}`}payload(){const e={...this.draft};if(S in e){const s=V(String(e[S]));if(s===null)return null;e[S]=s}return e}async save(){if(!Object.keys(this.draft).length||this.busy)return;const e=this.payload();if(e){this.busy=!0,this.error="";try{const s=await Ze(e);this.saved=this.read(s.settings),this.draft={},es(),this.message=o("dispSaved"),this.show!=="announce"&&this.loadReadiness()}catch(s){this.error=C(s)}finally{this.busy=!1}}}select(e,s){const t=!u()||!this.canEdit;return r`<sw-field class="ctl"><select data-set-access-display=${e} ?disabled=${t||this.busy} @change=${i=>this.set(e,i.target.value)}>
      ${s.map(([i,n])=>r`<option value=${i} ?selected=${this.value(e)===i}>${n}</option>`)}
    </select></sw-field>`}talkMax(){const e=!u()||!this.canEdit,s=this.value(S),t=V(s)===null;return r`<div class="row" data-access-display-talk-max><span class="lbl">${o("dispTalkMax")}</span>
      <sw-field class="ctl" hint=${t?o("dispTalkMaxInvalid",{min:ue,max:fe}):o("dispTalkMaxUnit")}>
        <input type="number" inputmode="numeric" dir="ltr" min=${ue} max=${fe} step="1" data-set-access-display=${S}
          aria-label=${o("dispTalkMax")} aria-invalid=${t?"true":"false"} ?disabled=${e||this.busy} .value=${s}
          @input=${i=>this.set(S,i.target.value)} />
      </sw-field></div>`}sourceRow(){const e=pe().source,s=this.readinessLine();return r`<div class="row" data-access-display-source>
      <span class="lbl">${e.label}${s?r`<span class="muted" role="status" data-access-display-readiness=${s.state}>${s.text}</span>`:d}</span>
      ${this.select(X,[["local",e.local],["auto",e.auto]])}
    </div>`}cardTitle(){return this.show==="announce"?_().title.announce:o("dispTitle")}summary(){const e=_().sum;if(this.failed)return e.failed;const s=this.saved;if(!s)return e.loading;const t=Object.keys(this.draft).length>0;if(this.show==="announce"){const c=s[h.announceScope]==="station"?o("dispAnnounceStation"):o("dispAnnounceScope"),x=s[j],U=x?this.engines?.engines.find(L=>L.engine_id===x)?.name??x:"";return se(rs(c,U,$e(s[h.phrases]).shown),t)}const i=s[h.callHint]==="call"?o("dispCallHintCall"):o("dispCallHintEveryone"),n=s[h.talk]==="hidden"?o("dispTalkHidden"):e.talkShown,l=ke().find(([c])=>c===s[z])?.[1]??o("dispMediaOff");return se(os(i,n,l),t)}updated(){this.bare&&M(this,{card:this.show==="announce"?"announce":"display",summary:this.summary(),present:!0})}displayRows(){return r`<div class="row"><span class="lbl">${o("dispCallHint")}<span class="muted">${o("dispCallHintText")}</span></span>
        ${this.select(h.callHint,[["everyone",o("dispCallHintEveryone")],["call",o("dispCallHintCall")]])}</div>
      <div class="row"><span class="lbl">${o("dispTalk")}<span class="muted">${o("dispTalkText")}</span></span>
        ${this.select(h.talk,[["classic",o("dispTalkClassic")],["hidden",o("dispTalkHidden")]])}</div>
      <div class="row" data-access-display-media><span class="lbl">${o("dispMedia")}</span>
        ${this.select(z,ke())}</div>
      ${this.value(z)!=="off"?this.sourceRow():d}
      ${this.value(z)==="video_talk"?this.talkMax():d}
      ${this.value(z)!=="off"?r`<div class="row" data-access-display-listen><span class="lbl">${F().setting.label}<span class="muted">${F().setting.text}</span></span>
            ${this.select(te,[["off",F().setting.off],["on",F().setting.on],["probe",F().setting.probe]])}</div>`:d}`}announceRows(e){const s=this.value(h.phrases),t=$e(s);return r`<div class="row"><span class="lbl">${o("dispAnnounce")}<span class="muted">${o("dispAnnounceText")}</span></span>
        ${this.select(h.announceScope,[["scope",o("dispAnnounceScope")],["station",o("dispAnnounceStation")]])}</div>
      ${this.ttsRows()}
      <div class="row stack"><span class="lbl">${o("dispPhrases")}<span class="muted">${o("dispPhrasesText",{n:ps,len:cs})}</span></span>
        <sw-field hint=${[t.builtIn?o("dispPhrasesBuiltIn"):o("dispPhrasesCount",{n:t.shown}),t.dropped?o("dispPhrasesDropped",{n:t.dropped}):""].filter(Boolean).join(" · ")}>
          <textarea data-set-access-display=${h.phrases} aria-label=${o("dispPhrases")} maxlength=${Vs} rows=${this.bare?"3":"5"} ?disabled=${e||this.busy} .value=${s} @input=${i=>this.set(h.phrases,i.target.value)}></textarea>
        </sw-field></div>`}render(){const e=this.bare?"":this.cardTitle();if(this.failed)return r`<sw-card heading=${e} data-access-display="error" data-access-display-show=${this.show}><div class="row"><span class="lbl">${this.failed}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void this.load()}>${o("dispRetry")}</sw-button></div></sw-card>`;if(!this.saved)return r`<sw-card heading=${e} data-access-display="loading" data-access-display-show=${this.show}><div class="row"><span class="lbl muted">${o("dispLoading")}</span></div></sw-card>`;const s=!u()||!this.canEdit,t=Object.keys(this.draft).length>0,i=V(this.value(S))!==null,n=this.bare?"":this.show==="announce"?_().announceSub:o("dispSub");return r`<sw-card heading=${e} subheading=${n} data-access-display="ready" data-access-display-settled=${this.settled()?"true":"false"} data-access-display-show=${this.show}>
      ${this.show!=="announce"?this.displayRows():d}
      ${this.show!=="display"?this.announceRows(s):d}
      ${s?r`<div class="muted" data-access-display-readonly>${u()?o("dispReadOnly"):""}</div>`:r`<div class="foot">
            <sw-button variant="primary" icon="check" data-save-access-display ?disabled=${!t||!i||this.busy} @click=${()=>void this.save()}>${o("dispSave")}</sw-button>
            ${this.message?r`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:d}
            ${this.error?r`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:d}
          </div>`}
    </sw-card>`}};f.styles=[Ie,P`
      :host {
        display: block;
        /* every control of the card is a 44 px target (the shared settings rows are not, in every skin) */
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px));
        --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px));
      }
      /* the phrase row stacks its label over the box: the label keeps its own height (a row's 220 px basis is a width) */
      .row.stack .lbl {
        flex: none;
      }
      textarea {
        min-block-size: 132px;
        resize: vertical;
        line-height: 1.5;
      }
      /* SETTINGS-INTERCOM-CARDS-2401: inside a card of layout a the phrase box opens at three lines (it still grows by hand) - the open
         card has to fit the screen */
      :host([bare]) textarea {
        min-block-size: 84px;
      }
    `,re];m([w({reflect:!0})],f.prototype,"show",2);m([w({type:Boolean,reflect:!0})],f.prototype,"bare",2);m([p()],f.prototype,"saved",2);m([p()],f.prototype,"draft",2);m([p()],f.prototype,"canEdit",2);m([p()],f.prototype,"busy",2);m([p()],f.prototype,"message",2);m([p()],f.prototype,"error",2);m([p()],f.prototype,"failed",2);m([p()],f.prototype,"readiness",2);m([p()],f.prototype,"readinessFailed",2);m([p()],f.prototype,"engines",2);m([p()],f.prototype,"enginesState",2);f=m([K("system-access-display")],f);function rt(e){const s=new URLSearchParams;return e.asUser&&s.set("as_user",e.asUser),s.set("hours",String(e.hours??24)),s.toString()}const ot=(e={},s)=>ts(`access-control/parity?${rt(e)}`,{signal:s});var lt=Object.defineProperty,dt=Object.getOwnPropertyDescriptor,A=(e,s,t,i)=>{for(var n=i>1?void 0:i?dt(s,t):s,l=e.length-1,c;l>=0;l--)(c=e[l])&&(n=(i?c(s,t,n):c(n))||n);return i&&n&&lt(s,t,n),n};const ee=[24,168],Ae="display:inline-flex;align-items:center;min-block-size:var(--sw-touch-desktop,44px);padding:0 12px;box-sizing:border-box;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-pill);color:var(--sw-text);text-decoration:none;font-size:var(--sw-fs-sm)";function ct(){try{return{kind:"iana",name:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}}catch{return{kind:"iana",name:"UTC"}}}let $=class extends D{constructor(){super(...arguments),this.rev=0,this.show="all",this.bare=!1,this.subject="",this.hours=ee[0],this.users=[],this.ticks={},this.asked=!1,this.lastRev=0,this.switchedOn=e=>{const s=q.find(t=>me[t]===e);return s?ge[s]==="smplwise":null}}connectedCallback(){super.connectedCallback(),this.res=new ms({fetch:()=>ot({asUser:this.subject||void 0,hours:this.hours}),pick:e=>e.parity,onChange:()=>this.requestUpdate()}),this.ticks=tt(Q()),u()&&g("system.configure")&&this.show!=="checklist"&&fs().then(e=>this.users=e.users.filter(s=>s.active&&!s.is_self)).catch(()=>this.users=[])}disconnectedCallback(){this.res?.dispose(),super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.asked&&this.res.reload()),this.bare&&this.show!=="all"&&M(this,{card:this.show==="checklist"?"checklist":"parity",summary:this.summary(),present:!0})}run(){this.asked=!0,this.res.reload()}subjectItems(){return[{id:"",label:o("subjectMe")},...this.users.map(e=>({id:e.id,label:e.name||e.username||e.id}))]}hourItems(){return ee.map(e=>({id:String(e),label:e===24?o("window24"):o("window168")}))}openCell(e){const s=st(e.route,this.switchedOn);return!s.native&&!s.classic?"—":r`<span style=${R.row}>
      ${s.native?r`<a style=${Ae} href=${s.native} target="_blank" rel="noopener" data-parity-open="native">${o("openArx")}</a>`:d}
      ${s.classic?r`<a style=${Ae} href=${s.classic} target="_blank" rel="noopener" data-parity-open="classic">${o("openClassic")}</a>`:d}
    </span>`}table(e){const s=i=>i,t=[{key:"screen",label:o("colScreen"),render:i=>r`<span style=${R.strong}>${et(s(i).screen)}</span>`},{key:"source",label:o("colSource"),render:i=>_e(s(i).source)},{key:"native",label:o("colNative"),render:i=>{const n=s(i);return r`<span>${_e(n.native)}${n.outcome==="filtered"&&n.expected_count!==null?r`<span style=${R.sub}>${o("expected",{n:n.expected_count})}</span>`:d}</span>`}},{key:"outcome",label:o("colOutcome"),render:i=>r`<sw-badge data-parity-outcome=${s(i).outcome} kind=${Qs(s(i).outcome)} label=${xe(s(i).outcome)}></sw-badge>`},{key:"why",label:o("colWhy"),render:i=>{const n=s(i),l=Zs(n);return r`<span style=${R.wrap} data-parity-why>${l||d}${n.reason?r`<span style=${l?R.sub:R.raw}><span style=${R.raw}>${n.reason}</span></span>`:d}${!l&&!n.reason?"—":d}</span>`}},{key:"open",label:o("colOpen"),render:i=>this.openCell(s(i))}];return r`<sw-table data-parity-table .columns=${t} .rows=${e.screens} rowKey="screen"></sw-table>`}report(){const e=this.res.snap,s=e.data;let t;if(!this.asked)t=r`<div class="empty" data-parity-idle>${o("notRun")}</div>`;else if(e.busy&&!s)t=gs(6);else if(s)t=this.table(s);else return r`<sw-card flush data-access-card="parity">${this.head()}${bs(e.failure??"error",e.message,()=>this.run())}</sw-card>`;const i=new Date;return r`<sw-card flush data-access-card="parity" data-parity-state=${this.asked?e.busy?"busy":s?"ready":"failed":"idle"}>
      ${this.head()}
      ${e.failure&&s?r`<div class="note err" role="alert" data-parity-failed><sw-icon name="warning" size=${16}></sw-icon><span>${e.message||xe("unavailable")}</span></div>`:d}
      ${t}
      ${s?r`<div class="foot-note" data-parity-foot>${[o("ranFor",{name:s.subject.self?o("subjectMe"):s.subject.display_name,when:e.fetchedAt?ws(vs(e.fetchedAt,i,ct())):""}),o("windowNote",{n:s.window_hours}),o("summary",{match:s.summary.match??0,filtered:s.summary.filtered??0,mismatch:s.summary.mismatch??0})].join(" · ")}</div>`:d}
    </sw-card>`}head(){const e=this.res.snap.busy;return r`<div class="ch">
      ${this.bare?r`<div class="sub">${o("sub")}</div>`:r`<div><h3>${o("title")}</h3><div class="sub">${o("sub")}</div></div>`}
      <div class="ctl">
        ${this.users.length?r`<sw-dropdown tall data-parity-subject label=${o("subject")} .items=${this.subjectItems()} .value=${this.subject} @change=${s=>this.subject=s.detail.id}></sw-dropdown>`:d}
        <sw-dropdown tall data-parity-hours label=${o("window")} .items=${this.hourItems()} .value=${String(this.hours)} @change=${s=>this.hours=Number(s.detail.id)||ee[0]}></sw-dropdown>
        <sw-button size="lg" variant="primary" icon="refresh" data-parity-run ?disabled=${e} @click=${()=>this.run()}>${e?o("running"):o("run")}</sw-button>
      </div>
    </div>`}tick(e,s){this.ticks=at(this.ticks,e,s),Se(Q(),this.ticks)}clearTicks(){this.ticks={},Se(Q(),{})}checklist(){const e=ae.filter(t=>q.includes(t.screen)),s=Te(this.ticks,e);return r`<sw-card flush data-access-card="parity-checklist">
      <div class="ch">
        ${this.bare?r`<div class="sub">${o("checklistSub")}</div>`:r`<div><h3>${o("checklistTitle")}</h3><div class="sub">${o("checklistSub")}</div></div>`}
        <div class="ctl">
          <span class="muted" data-parity-progress>${o("checklistDone",s)}</span>
          ${s.done?r`<sw-button size="lg" variant="ghost" data-parity-clear @click=${()=>this.clearTicks()}>${o("checklistClear")}</sw-button>`:d}
        </div>
      </div>
      <div class="chk-grid">${e.map(t=>{const i=me[t.screen],n=`#/wiskey/${i}`;return r`<div class="chk" data-parity-checklist=${t.screen}>
          <div class="chk-head">
            <span class="t">${o(t.label)}</span>
            ${ge[t.screen]==="smplwise"?r`<a href=${n} target="_blank" rel="noopener" data-parity-open="native">${o("openArx")}</a>`:d}
            ${De.includes(i)?r`<a href=${`${n}?classic=1`} target="_blank" rel="noopener" data-parity-open="classic">${o("openClassic")}</a>`:d}
          </div>
          ${t.items.map(l=>r`<label class="item"><input type="checkbox" data-parity-item=${`${t.screen}:${l}`} .checked=${!!this.ticks[t.screen]?.[l]} @change=${()=>this.tick(t.screen,l)} /><span>${o(l)}</span></label>`)}
        </div>`})}</div>
    </sw-card>`}summary(){const e=_().sum;if(this.show==="checklist"){const i=Te(this.ticks,ae.filter(n=>q.includes(n.screen)));return ls(i.done,i.all)}const s=this.res?.snap,t=s?.data;return!this.asked||!s?e.parityIdle:s.busy&&!t?e.parityBusy:t?o("summary",{match:t.summary.match??0,filtered:t.summary.filtered??0,mismatch:t.summary.mismatch??0}):e.parityFailed}render(){return r`<div class="stack" data-access-status="ready">${this.show!=="checklist"?this.report():d}${this.show!=="report"?this.checklist():d}</div>`}};$.styles=[ys,P`
      .foot-note {
        padding: 10px 14px 14px;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        border-block-start: 1px solid var(--sw-border);
      }
      .chk {
        display: flex;
        flex-direction: column;
        border-block-start: 1px solid var(--sw-border);
        padding: 8px 14px 12px;
        gap: 4px;
      }
      .chk-head {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px 12px;
        min-block-size: var(--_t);
      }
      .chk-head .t {
        flex: 1 1 160px;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
      }
      .chk-head a {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: var(--_t);
        padding: 0 12px;
        box-sizing: border-box;
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-pill);
        color: var(--sw-text);
        text-decoration: none;
        font-size: var(--sw-fs-sm);
      }
      .chk-head a:hover {
        background: var(--sw-hover-wash);
      }
      label.item {
        display: flex;
        align-items: center;
        gap: 10px;
        min-block-size: var(--_t);
        color: var(--sw-text-2);
        cursor: pointer;
      }
      label.item input {
        inline-size: 20px;
        block-size: 20px;
        margin: 0;
        accent-color: var(--sw-accent);
        flex: none;
      }
      /* SETTINGS-INTERCOM-CARDS-2401: the screens of the checklist - one after the other (as before), or side by side inside a card */
      .chk-grid {
        display: contents;
      }
      :host([bare]) .chk-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
        border-block-start: 1px solid var(--sw-border);
      }
      :host([bare]) .chk-grid .chk {
        border-block-start: 0;
      }
    `,re];A([w({type:Number})],$.prototype,"rev",2);A([w({reflect:!0})],$.prototype,"show",2);A([w({type:Boolean,reflect:!0})],$.prototype,"bare",2);A([p()],$.prototype,"subject",2);A([p()],$.prototype,"hours",2);A([p()],$.prototype,"users",2);A([p()],$.prototype,"ticks",2);A([p()],$.prototype,"asked",2);$=A([K("system-access-parity")],$);var pt=Object.defineProperty,ht=Object.getOwnPropertyDescriptor,Ke=(e,s,t,i)=>{for(var n=i>1?void 0:i?ht(s,t):s,l=e.length-1,c;l>=0;l--)(c=e[l])&&(n=(i?c(s,t,n):c(n))||n);return i&&n&&pt(s,t,n),n};let Y=class extends D{constructor(){super(...arguments),this.bare=!1}present(){return u()&&as("access.stations.manage")}updated(){this.bare&&M(this,{card:"validation",summary:_().sum.validation,present:this.present()})}render(){if(!this.present())return d;const e=a("לכל עמדה: זהות, דלתות, תמונה דרך Arx ודרך WisKey, דיבור, אירועים ושעון. רץ רק כשלוחצים, ונשמר לכל ריצה.");return r`<sw-card heading=${this.bare?"":a("בדיקת קבלה לעמדות")} subheading=${this.bare?"":e}>
      ${this.bare?r`<p class="muted about">${e}</p>`:d}
      <div class="row" data-lv-card>
        <span class="muted">${a("פתיחת דלת עם עד היא פעולה נפרדת, למנהל מערכת בלבד.")}</span>
        <a href=${$s} data-lv-card-link>${a("פתח את בדיקת הקבלה")}</a>
      </div>
    </sw-card>`}};Y.styles=P`
    :host {
      display: block;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
    }
    ${ne}
    a {
      color: var(--sw-accent);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .about {
      margin: 0 0 8px;
    }
    /* SETTINGS-INTERCOM-CARDS-2401: inside a card the link is a 44 px target */
    :host([bare]) a {
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
    }
  `;Ke([w({type:Boolean,reflect:!0})],Y.prototype,"bare",2);Y=Ke([K("system-wiskey-validation-card")],Y);var ut=Object.defineProperty,ft=Object.getOwnPropertyDescriptor,W=(e,s,t,i)=>{for(var n=i>1?void 0:i?ft(s,t):s,l=e.length-1,c;l>=0;l--)(c=e[l])&&(n=(i?c(s,t,n):c(n))||n);return i&&n&&ut(s,t,n),n};const mt=820,gt=32,bt=520;let O=class extends D{constructor(){super(...arguments),this.cards=[],this.open="",this.label="",this.inplace=!1,this.wide=!0,this.ro=null,this.watched=null,this.frame=0,this.onResize=()=>this.schedule()}schedule(){this.frame||(this.frame=requestAnimationFrame(()=>{this.frame=0,this.measure()}))}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),typeof ResizeObserver=="function"&&(this.ro=new ResizeObserver(()=>this.schedule()),this.ro.observe(this))}disconnectedCallback(){window.removeEventListener("resize",this.onResize),this.frame&&cancelAnimationFrame(this.frame),this.frame=0,this.ro?.disconnect(),this.ro=null,this.watched=null,super.disconnectedCallback()}willUpdate(e){e.has("inplace")&&this.inplace&&(this.wide=!1)}updated(e){(e.has("open")||e.has("cards")||e.has("wide")||e.has("inplace"))&&this.measure(),this.inplace&&this.open&&e.has("open")&&e.get("open")!==void 0&&this.renderRoot.querySelector(`.head[data-fold-toggle="${CSS.escape(this.open)}"]`)?.scrollIntoView({block:"nearest"})}openBody(){return this.open?this.querySelector(`:scope > [slot="b-${CSS.escape(this.open)}"]`):null}measure(){const e=this.getBoundingClientRect().width,s=!this.inplace&&e>=mt;if(e>0&&s!==this.wide){this.wide=s,this.dispatchEvent(new CustomEvent("fold-wide",{detail:{wide:s},bubbles:!0,composed:!0}));return}const t=this.openBody(),i=t?.firstElementChild??null;if(this.ro&&i!==this.watched&&(this.watched&&this.ro.unobserve(this.watched),i&&this.ro.observe(i),this.watched=i),!this.wide){this.style.removeProperty("--fold-room"),this.removeAttribute("tight"),t?.removeAttribute("data-fold-scroll");return}const n=Math.max(240,Math.floor(window.innerHeight-this.getBoundingClientRect().top-gt));this.style.setProperty("--fold-room",`${n}px`),this.toggleAttribute("tight",n<bt),t&&(t.removeAttribute("data-fold-scroll"),t.scrollHeight>t.clientHeight+1&&t.setAttribute("data-fold-scroll",""))}press(e){this.dispatchEvent(new CustomEvent("fold-toggle",{detail:{id:e},bubbles:!0,composed:!0}))}render(){const e=this.cards.filter(s=>!s.hidden).length;return r`<div class="list ${this.wide?"wide":""}" role="group" aria-label=${this.label||d} data-fold-wide=${String(this.wide)}
        style=${`--fold-n:${Math.max(1,e)};--fold-span:${e+1}`}>
      ${this.cards.map(s=>r`<button type="button" class="head" ?hidden=${!!s.hidden} aria-expanded=${String(s.id===this.open)} data-fold-toggle=${s.id} title=${s.summary||d}
            @click=${()=>this.press(s.id)}>
            <span class="t">${s.title}</span>
            <span class="s" data-fold-summary=${s.id}>${s.summary||" "}</span>
            <sw-icon name="chevronDown" size=${14}></sw-icon>
          </button>
          <slot name=${`b-${s.id}`}></slot>`)}
    </div>`}};O.styles=P`
    :host {
      display: block;
      container-type: inline-size;
      min-inline-size: 0;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .list.wide {
      display: grid;
      grid-template-columns: minmax(232px, 280px) minmax(0, 1fr);
      grid-template-rows: repeat(var(--fold-n, 1), auto) 1fr;
      column-gap: var(--sw-s-4, 16px);
      row-gap: 3px;
      align-items: start;
    }
    .list.wide .head {
      grid-column: 1;
    }
    :host([tight]) .list.wide {
      grid-template-columns: 232px minmax(0, 1fr);
    }
    .list.wide ::slotted(:not([hidden])) {
      grid-column: 2;
      grid-row: 1 / span var(--fold-span, 2);
      max-block-size: var(--fold-room, none);
      min-block-size: 0;
    }
    ::slotted([hidden]) {
      display: none !important;
    }
    ::slotted([data-fold-scroll]) {
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    ::slotted(:not([hidden])) {
      min-inline-size: 0;
      animation: fold-in 180ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    @keyframes fold-in {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }
    /* a header: the title over the summary line, the chevron at the end; a 44 px target at least */
    .head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 't i' 's i';
      align-items: center;
      column-gap: 10px;
      row-gap: 0;
      inline-size: 100%;
      min-inline-size: 0;
      min-block-size: 44px;
      box-sizing: border-box;
      padding: 4px 12px;
      margin: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      /* SKIN-QA-2403: a header is drawn as the skin draws its cards - in the glass skins (domus, crystal, soft) the sheen over the
         translucent surface and the backdrop blur, so the words do not sit on the raw canvas (the city / bloom picture showed through);
         in the solid skins the sheen is transparent and the blur none, so classic, tesla and infra draw exactly what they drew */
      background: var(--sw-glass-sheen), var(--sw-perf-glass-bg, var(--sw-card-bg, var(--sw-surface)));
      -webkit-backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur));
      backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur));
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition:
        transform var(--sw-t-press, 120ms) var(--sw-ease, ease-out),
        background-color var(--sw-t-hover, 150ms) var(--sw-ease-color, ease),
        border-color var(--sw-t-hover, 150ms) var(--sw-ease-color, ease);
    }
    .head[hidden] {
      display: none;
    }
    .head:active {
      transform: scale(var(--sw-press-scale, 0.98));
    }
    .head:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: 2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .head:hover {
        border-color: var(--sw-border-strong);
      }
    }
    .t {
      grid-area: t;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sw-fs-md);
      line-height: 1.35;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .s {
      grid-area: s;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sw-fs-xs);
      line-height: 1.35;
      color: var(--sw-text-3);
    }
    .head sw-icon {
      grid-area: i;
      color: var(--sw-text-3);
      transition: transform var(--sw-t-fast, 150ms) var(--sw-ease, ease-out);
    }
    .head[aria-expanded='true'] {
      border-color: color-mix(in srgb, var(--sw-accent) 45%, var(--sw-border));
      /* SKIN-QA-2403: the accent tint is laid OVER the header's surface; alone, a translucent tint (every dark scheme, the glass skins)
         left the open header see-through (its accent title fell to 4.3:1 on soft / domus light). Where the tint is opaque (classic
         light) nothing changes. */
      background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-perf-glass-bg, var(--sw-card-bg, var(--sw-surface)));
    }
    .head[aria-expanded='true'] .t {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .head[aria-expanded='true'] .s {
      color: var(--sw-text-2);
    }
    /* narrow: the chevron says fold / unfold; wide: the open card stands beside its header, so the chevron is not drawn */
    .head[aria-expanded='true'] sw-icon {
      transform: rotate(180deg);
    }
    .list.wide .head sw-icon {
      display: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .head,
      .head sw-icon {
        transition-duration: 0ms;
      }
      ::slotted(:not([hidden])) {
        animation-name: fold-fade;
      }
      @keyframes fold-fade {
        from {
          opacity: 0;
        }
      }
    }
  `;W([w({attribute:!1})],O.prototype,"cards",2);W([w()],O.prototype,"open",2);W([w()],O.prototype,"label",2);W([w({type:Boolean,reflect:!0})],O.prototype,"inplace",2);W([p()],O.prototype,"wide",2);O=W([K("sw-fold-cards")],O);
