import{dL as i,gA as ce,j as I,z as y,k as p,a as L,v_ as Ze,q as T,b as n,A as c,af as u,aM as w,u as Le,m as P,v$ as es,c as ss,w0 as ts,w1 as fe,ae as Pe,c8 as W,bg as as,F as ze,bs as je,bu as Me,br as De,bt as Ne,iY as Z,j9 as _e,w2 as is,w3 as S,w4 as rs,w5 as q,w6 as ns,w7 as C,w8 as os,dO as ls,w9 as ds,bn as cs,b7 as we,wa as ps,wb as hs,ba as ge,wc as ee,kb as us,dl as fs,wd as ye,we as me,wf as _s,bv as ws,wg as se,wh as be,nG as ve,ag as gs}from"./index-D3xHkfje.js";import{a as Fe,U as Be}from"./wiskey-format-LjC3azXw.js";import{P as x,Q as ys,R as D,T as ne,U as ms,V as bs,W as vs,X as $s}from"./system-diagnostics-CDp1veMc.js";import{s as He}from"./settings-CBX0_39g.js";import{b as pe}from"./bubble-chrome-DW_f3pbN.js";import"./wk-triage-panel-KZKlMLE8.js";import{p as Ue,P as h,a as l,b as he,c as te,S as oe,d as ks,s as H,M as xs,e as Ss}from"./access-parity-BEzX9kDV.js";import{b as j,p as $e,c as M,s as ke,t as Ws,f as V,a as Ks}from"./tts-default-C3o0amHo.js";import"./sw-table-BASj552X.js";import{listUsers as As}from"./access-CVGF2oq1.js";import{R as Ts,s as Es,f as Os,w as Cs,a as Rs}from"./status-text-D6OI-3eM.js";import{s as Is,C as O}from"./status-css-3-HI8WwH.js";import{c as ae}from"./safe-storage-BOOiiGOc.js";import{V as Ls}from"./wiskey-validation-L_6cuGYD.js";import"./sw-logo-art-PLtEZJxU.js";import"./wiskey-BvQMnpau.js";import"./static-B845d-94.js";import"./long-lists-Oi_dEjsQ.js";import"./skins-BvRmGhxy.js";import"./plan-view-Dm4VXqyt.js";import"./system-a-CDuaOwuI.js";import"./toast-controller-BPX0Tkjm.js";import"./live-Btf27nYW.js";import"./ha-sync-status-BfP-r3qC.js";import"./quality-mode-CAoNRPkM.js";import"./map-D3bqut0m.js";import"./quality-ladder-BIYtMgBU.js";import"./plan-quality-Dmj2fdFZ.js";import"./wall-phone-bar-C39Ne3tt.js";import"./media-CSqgsuwf.js";import"./access-status-CvakVtQg.js";import"./schedules-logic-DE8IZvbp.js";import"./deep-links-q4RsfMxD.js";import"./events-logic-D-__lyLZ.js";import"./day-key-Bn1dxlC5.js";import"./pad-CImDeuHV.js";var Ps=Object.defineProperty,zs=Object.getOwnPropertyDescriptor,U=(e,s,t,a)=>{for(var r=a>1?void 0:a?zs(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(r=(a?d(s,t,r):d(r))||r);return a&&r&&Ps(s,t,r),r};const js=[["overview",i("סקירה")],["users",i("אנשים")],["events",i("אירועים")],["stations",i("עמדות")],["management",i("ניהול")]],Ms=[["phone",i("טלפון")],["photo",i("תמונה")],["credentials",i("אישורי כניסה")],["profile",i("פרופיל")],["access",i("גישה")]],xe={none:i("אין"),view:i("צפייה"),manage:i("ניהול"),unknown:i("לא ידוע")},ie={ready:i("מחובר"),connecting:i("מתחבר"),ha_unavailable:i("תשתית המערכת אינה זמינה"),ha_not_configured:i("אין גישה לתשתית המערכת"),not_installed:i("WisKey אינו מותקן"),forbidden:i("WisKey דחה את החשבון"),error:i("שגיאה"),not_configured:i("לא הוגדר"),shares_service_identity:i("משתמש בזהות השירות")},Ds={ok:i("התקבלה תשובה"),not_asked:i("לא נבדק"),not_ready:i("הערוץ אינו מחובר"),forbidden:i("WisKey דחה את הבקשה"),unauthorized:i("WisKey דחה את הבקשה"),rate_limited:i("נבדק הרגע - נסו שוב בעוד כמה שניות"),busy:i("ממתין לבקשה קודמת"),timeout:i("לא התקבלה תשובה בזמן"),invalid_response:i("התשובה אינה בפורמט המוכר"),ha_unavailable:i("תשתית המערכת אינה זמינה")},Ns={ok:i("פעילה"),not_attempted:i("לא נוסתה"),"n/a":i("לא רלוונטי")},Fs={service_identity_is_admin:i("זהות השירות היא מנהל ב־WisKey. זה המצב הנוכחי של הכתיבות הקיימות (שחרור דלת, אנשים, כרטיסים)."),background_shares_service_identity:i("ערוץ הרקע עדיין משתמש בזהות השירות (מנהל). אחרי שבעל המוצר יוצר משתמש רקע ייעודי ומגדיר את האסימון שלו, הערוץ מתפצל לחיבור משלו."),background_is_admin:i("חשבון הרקע הוא מנהל ב־WisKey. הוא אמור להיות משתמש רגיל עם צפייה בסקירה בלבד."),background_cannot_read_overview:i("לחשבון הרקע אין צפייה בסקירה, ולכן ערוץ הרקע לא יקבל נתונים."),background_has_more_than_overview:i('לחשבון הרקע יש הרשאות מעבר לסקירה. ההמלצה: כל שאר האזורים והשדות ברמת "אין".'),background_scope_is_all_stations:i("חשבון הרקע רואה את כל העמדות. ההמלצה: היקף עמדות מפורש וצר."),background_authorization_unavailable:i("לא התקבלה תשובת הרשאות מערוץ הרקע."),background_subscribe_not_live:i("ההרשמה לעדכונים של ערוץ הרקע אינה פעילה; הערוץ מתעדכן רק בבדיקה תקופתית."),service_subscribe_not_live:i("ההרשמה לעדכונים של זהות השירות אינה פעילה."),connection_locked:i("החיבור נעול ב־WisKey. קריאות יידחו עד שהמשתמש יפתח אותו ב־WisKey; Arx לא מנסה לעקוף."),idle_or_reauth_configured:i("ב־WisKey מוגדר זמן נעילה או אימות חוזר. אם הם יחולו על חיבור של Arx, פעולות יידחו עד שיפתחו בחלון האינטרקום.")},Bs={service:i("זהות השירות"),background:i("ערוץ הרקע")};function Hs(e){return e==="ready"?"live":e==="connecting"?"unknown":e==="forbidden"?"forbidden":e==="error"?"error":e==="shares_service_identity"?"stale":"offline"}let R=class extends L{constructor(){super(...arguments),this.bare=!1,this.data=null,this.busy=!1,this.error=""}async run(){this.busy=!0,this.error="";try{this.data=await Ze()}catch(e){this.error=T(e)}finally{this.busy=!1}}renderAuth(e,s){if(!e)return n`<div class="muted" data-wk-diag-auth-state>${s}</div>`;const t=e.security,a=e.station_scope;return n`
      <div class="facts" data-wk-diag-identity>
        <span>${e.is_admin?i("מנהל ב־WisKey"):e.is_admin===!1?i("לא מנהל"):i("מנהל: לא ידוע")}</span>
        <span>${e.allowed===!1?i("הגישה נדחתה"):e.allowed?i("הגישה מאושרת"):i("גישה: לא ידוע")}</span>
        <span>${i("עמדות:")} ${a.kind==="all"?i("כולן"):a.kind==="explicit"?i("{n} מפורשות",{n:a.count??a.ids.length}):i("לא ידוע")}</span>
        ${t?n`<span>${t.locked?i("החיבור נעול"):t.locked===!1?i("החיבור פתוח"):i("נעילה: לא ידוע")}${t.idle_minutes?` · idle ${i("{n} דק׳",{n:t.idle_minutes})}`:""}${t.reauth_sensitive?` · ${i("אימות חוזר")}`:""}</span>`:n`<span class="muted">${i("אין הגדרת נעילה ב־WisKey")}</span>`}
      </div>
      <div class="chips" aria-label=${i("אזורים")}>${js.map(([r,o])=>n`<span class="chip ${e.areas[r]==="none"?"":"on"}">${o}: ${xe[e.areas[r]]}</span>`)}</div>
      <div class="chips" aria-label=${i("שדות")}>${Ms.map(([r,o])=>n`<span class="chip ${e.fields[r]==="none"?"":"on"}">${o}: ${xe[e.fields[r]]}</span>`)}</div>`}renderIdentity(e,s,t){const a=ie[s.state]??s.state;return n`<div class="block" data-wk-diag=${t}>
      <div class="head"><span>${e}</span><sw-badge kind=${Hs(s.state)} label=${a}></sw-badge></div>
      <div class="facts">
        ${s.wiskey_version?n`<span>WisKey <bdi>${s.wiskey_version}</bdi></span>`:c}
        <span>${i("הרשמה לעדכונים:")} ${Ns[s.subscribe]??s.subscribe}</span>
      </div>
      ${this.renderAuth(s.authorization,Ds[s.authorization_state]??s.authorization_state)}
    </div>`}renderChannels(e){return n`<div class="block" data-wk-diag="channels">
      <div class="head"><span>${i("פקודות מותרות לכל ערוץ")}</span></div>
      <div class="facts"><span>${i("ערוץ הרקע:")} <bdi>${e.background.join(", ")}</bdi></span></div>
      <div class="facts"><span>${i("זהות השירות, קריאה:")} <bdi>${e.service.reads.join(", ")}</bdi></span></div>
      <div class="facts"><span>${i("זהות השירות, כתיבה:")} <bdi>${e.service.writes.join(", ")}</bdi></span></div>
    </div>`}renderFinding(e){return n`<div class="finding ${e.level}" data-wk-diag-finding=${e.code}><b>${Bs[e.subject]}:</b> ${Fs[e.code]??e.code}</div>`}summary(){const e=x().sum,s=this.data;return this.busy?x().sum.loading:s?ys(e.diag,{service:ie[s.service.state]??s.service.state,background:ie[s.background.state]??s.background.state}):this.error?e.diagFailed:e.diagIdle}updated(){this.bare&&D(this,{card:"diagnostics",summary:this.summary(),present:u()&&w("system.configure")})}render(){if(!u())return c;if(!w("system.configure"))return c;const e=this.data;return n`<sw-card heading=${this.bare?"":i("WisKey רואה את Arx כ־")} subheading=${this.bare?"":i("קריאה בלבד: מה ש־WisKey מדווח על זהות החיבורים של Arx אליו. הבדיקה נעשית לפי בקשה.")} data-wk-diag-card>
      <div class="block">
        <div class="head"><span class="muted">${e?n`${i("נבדק ב־")}<bdi>${Fe(e.generated_at,Le(),Be)}</bdi>`:i("עדיין לא נבדק")}</span>
          <sw-button size="sm" variant="primary" icon="refresh" data-wk-diag-run ?disabled=${this.busy} @click=${()=>this.run()}>${this.busy?i("בודק…"):e?i("בדיקה מחדש"):i("בדיקה")}</sw-button></div>
        ${this.error?n`<div class="err" role="alert">${this.error}</div>`:c}
      </div>
      ${e?n`${this.renderIdentity(i("זהות השירות (המשתמש של ה־add-on)"),e.service,"service")}
            ${this.renderIdentity(i("ערוץ הרקע"),e.background,"background")} ${this.renderChannels(e.channels)}
            ${e.findings.length?n`<div class="findings">${e.findings.map(s=>this.renderFinding(s))}</div>`:c}`:c}
    </sw-card>`}};R.styles=I`
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
    ${ce}
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
  `;U([y({type:Boolean,reflect:!0})],R.prototype,"bare",2);U([p()],R.prototype,"data",2);U([p()],R.prototype,"busy",2);U([p()],R.prototype,"error",2);R=U([P("system-wiskey-diagnostics")],R);var Us=Object.defineProperty,Xs=Object.getOwnPropertyDescriptor,K=(e,s,t,a)=>{for(var r=a>1?void 0:a?Xs(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(r=(a?d(s,t,r):d(r))||r);return a&&r&&Us(s,t,r),r};const Gs=["off","everyone","roles"];let b=class extends L{constructor(){super(...arguments),this.bare=!1,this.view=null,this.draft=null,this.busy=!1,this.message="",this.error="",this.failed="",this.absent=!1,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}async load(){const e=++this.gen;if(this.failed="",!(!u()||!w("system.configure")))try{const s=await es();if(e!==this.gen)return;this.view=s,this.draft={...s.settings,roles:[...s.settings.roles],stations:[...s.settings.stations]}}catch(s){if(e!==this.gen)return;!(s instanceof ss)||s.status===404?this.absent=!0:this.failed=T(s)}}patch(e){this.draft&&(this.draft={...this.draft,...e},this.message="",this.error="")}toggle(e,s,t){if(!this.draft)return;const a=this.draft[e].filter(r=>r!==s);this.patch({[e]:t?[...a,s]:a})}dirty(){const e=this.view?.settings,s=this.draft;if(!e||!s)return!1;const t=(a,r)=>a.length===r.length&&[...a].sort().join(`
`)===[...r].sort().join(`
`);return e.mode!==s.mode||e.sound!==s.sound||!t(e.roles,s.roles)||!t(e.stations,s.stations)}async save(){const e=this.draft;if(!(!e||this.busy||!this.dirty())){this.busy=!0,this.error="";try{const s=await ts(e);this.view=s,this.draft={...s.settings,roles:[...s.settings.roles],stations:[...s.settings.stations]},this.message=fe().setting.saved}catch(s){this.error=T(s)}finally{this.busy=!1}}}summary(){const e=this.view?.settings;return this.failed?x().sum.failed:e?ne(ms(e.mode,e.roles.length,e.stations.length,e.sound),this.dirty()):x().sum.loading}updated(){this.bare&&D(this,{card:"calls",summary:this.summary(),present:u()&&w("system.configure")&&!this.absent})}render(){if(!u()||!w("system.configure")||this.absent)return c;const e=fe().setting,s=this.bare?"":e.title;if(this.failed)return n`<sw-card heading=${s} data-call-banner-setting="error"><div class="row"><span class="lbl">${e.error}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void this.load()}>${e.retry}</sw-button></div></sw-card>`;const t=this.view,a=this.draft;if(!t||!a)return c;const r={off:e.off,everyone:e.everyone,roles:e.roles},o=a.mode==="roles"&&a.roles.length===0;return n`<sw-card heading=${s} subheading=${this.bare?"":e.sub} data-call-banner-setting="ready" data-mode=${a.mode}>
      <div class="row"><span class="lbl">${e.mode}<span class="muted">${e.modeText}</span></span>
        <sw-field class="ctl"><select data-call-banner-mode ?disabled=${this.busy} @change=${d=>this.patch({mode:d.target.value})}>
          ${Gs.map(d=>n`<option value=${d} ?selected=${a.mode===d}>${r[d]}</option>`)}
        </select></sw-field></div>
      ${a.mode==="roles"?n`<div class="row stack" data-call-banner-roles><span class="lbl">${e.rolesLabel}${o?n`<span class="muted" role="alert">${e.needRole}</span>`:c}</span>
            <div class="checks">${t.roles.map(d=>n`<label><input type="checkbox" data-call-banner-role=${d.id} .checked=${a.roles.includes(d.id)} ?disabled=${this.busy}
              @change=${k=>this.toggle("roles",d.id,k.target.checked)} />${d.name}</label>`)}</div></div>`:c}
      ${a.mode!=="off"?n`<div class="row stack" data-call-banner-stations><span class="lbl">${e.stationsLabel}<span class="muted">${a.stations.length?"":e.stationsAll}</span></span>
              ${t.stations.length?n`<div class="checks">${t.stations.map(d=>n`<label><input type="checkbox" data-call-banner-station=${d.id} .checked=${a.stations.includes(d.id)} ?disabled=${this.busy}
                    @change=${k=>this.toggle("stations",d.id,k.target.checked)} />${d.name||"—"}</label>`)}</div>`:n`<span class="muted">${e.stationsNone}</span>`}</div>
            <div class="row"><span class="lbl">${e.sound}<span class="muted">${e.soundText}</span></span>
              <label class="one"><sw-toggle size="sm" labelHidden in-label data-call-banner-sound label=${e.sound} .checked=${a.sound} ?disabled=${this.busy} @change=${d=>this.patch({sound:Pe(d)})}></sw-toggle></label></div>`:c}
      <div class="foot">
        <sw-button variant="primary" icon="check" data-save-call-banner ?disabled=${!this.dirty()||o||this.busy} @click=${()=>void this.save()}>${e.save}</sw-button>
        ${this.message?n`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:c}
        ${this.error?n`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:c}
      </div>
    </sw-card>`}};b.styles=[He,I`
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
    `,pe];K([y({type:Boolean,reflect:!0})],b.prototype,"bare",2);K([p()],b.prototype,"view",2);K([p()],b.prototype,"draft",2);K([p()],b.prototype,"busy",2);K([p()],b.prototype,"message",2);K([p()],b.prototype,"error",2);K([p()],b.prototype,"failed",2);K([p()],b.prototype,"absent",2);b=K([P("system-call-banner")],b);const Ys=()=>as("system/wiskey-pairing"),Vs=()=>ze("system/wiskey-pairing/probe"),qs=e=>ze("system/wiskey-pairing/repair",{confirm:!0,pause_rotation:e}),Js=600*1e3;function Qs(e,s=Date.now()){if(!e)return!0;const t=Date.parse(e.at);return!Number.isFinite(t)||s-t>Js}const Se={paired:W("מצומד: WisKey מקבל את המפתח של Arx"),not_paired:W("לא מצומד"),unknown:W("לא ידוע עדיין")},Zs={SET:W("הגדרה"),POL:W("מדיניות"),PAIR:W("צימוד"),WK:W("צד WisKey"),OWN:W("פעולת בעלים"),RUN:W("הפעלה מחדש")};function et(e){const s=new Map;for(const t of e){const a=s.get(t.group)??[];a.push(t),s.set(t.group,a)}return[...s.entries()]}function st(e){const s={on:0,off:0,blocked:0,unknown:0};for(const t of e)s[t.state]+=1;return s}const Q={r_provider_local:'מקור הווידאו והדיבור מוגדר "Arx (וידאו בלבד)", ולכן החיבור הישיר ל־WisKey לא מופעל.',f_provider_local:'בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: "WisKey (וידאו ודיבור)", ואז הפעלה מחדש של Arx.',r_key_missing:"אין מפתח צימוד, ולכן Arx לא חותם על פקודות אל WisKey.",f_key_missing:'צימוד מחדש בבלוק "חיבור Arx ל-WisKey" למעלה.',r_key_unreadable:"לא ניתן לפענח את מפתח הגשר במכונה הזו.",f_key_unreadable:'צימוד מחדש בבלוק "חיבור Arx ל-WisKey" למעלה.',r_key_rotated:"מפתח הגשר הוחלף; החיבור הישיר של WisKey (גרסה 1) לא מקבל מפתח עם מזהה מפתח.",f_key_rotated:'צימוד מחדש בבלוק "חיבור Arx ל-WisKey" למעלה, עם כיבוי החלפת מפתח הגשר.',r_join_not_started:"החיבור הישיר לא פעיל כרגע.",f_join_not_started:'Arx מפעיל אותו לבד, בלי הפעלה מחדש, כש"מקור הווידאו והדיבור" הוא WisKey ומפתח הצימוד תקין; אם זה לא קורה - "בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.',r_join_starting:"החיבור הישיר {what} כעת.",f_join_starting:"אין צורך בהפעלה מחדש: רעננו את הדף בעוד רגע.",r_join_error:"החיבור הישיר נכשל ({error}); Arx ינסה שוב לבד.",f_join_error:'"בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.',r_not_proven:"עוד לא הוכח ש־WisKey מקבל את החתימה של Arx.",f_not_proven:'"בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.',r_refused:"WisKey דחה את החתימה של Arx בבדיקה האחרונה.",f_refused:'ראו את ההנחיות בבלוק "חיבור Arx ל-WisKey" למעלה.',r_feed_not_listed:"Arx בוחר ב־WisKey לפי רשימת הפקודות שבערוץ השירות, ושם פקודות המדיה לא מופיעות ({why}).",f_feed_not_listed:"פריט פתוח בפיתוח: WisKey יפרסם את פקודות המדיה ברשימה, או ש־Arx יבחר לפי הגילוי החתום. לא פעולה של בעל המערכת.",r_feed_no_talk:"ברשימת הפקודות של ערוץ השירות אין את פקודות הדיבור.",f_feed_no_talk:"פריט פתוח בפיתוח (כמו בשורה של הווידאו).",r_direct_no_media:"בגילוי החתום (direct/capabilities) חסרות פקודות מדיה: {missing}.",f_direct_no_media:"עדכון WisKey לגרסה שמפרסמת אותן (בהתקנה ידנית - בעל המערכת).",r_no_talk_audio:"WisKey לא מציע את צליל העמדה בתוך שיחה (station_talk_audio) בגילוי החתום.",f_no_talk_audio:"עדכון WisKey (בהתקנה ידנית - בעל המערכת).",r_media_off:'המתג "מדיה של העמדות" כבוי.',f_media_off:"בהגדרות › מתגי מסכי כניסה: מדיה של העמדות - וידאו (או וידאו ודיבור).",r_media_no_talk:'המתג "מדיה של העמדות" מוגדר לווידאו בלבד.',f_media_no_talk:"בהגדרות › מתגי מסכי כניסה: מדיה של העמדות - וידאו ודיבור.",r_listen_off:'המתג "האזנה לעמדה" כבוי.',f_listen_off:"בהגדרות › מתגי מסכי כניסה: האזנה לעמדה.",r_listen_no_downlink:"הגילוי החתום האחרון של WisKey לא מציע האזנה לעמדה (station_talk_audio עם הבחירה media/talk_open.parameters.listen).",f_listen_no_downlink:'עדכון WisKey לגרסה שמציעה אותה (בהתקנה ידנית - בעל המערכת), ואז "בדוק חיבור חתום".',r_listen_offer_rejected:"WisKey מציע את station_talk_audio בצורה אחרת מזו ש־Arx קורא (arx.station_talk_audio.v1, בחירה, ברירת מחדל כבויה), ולכן Arx לא משתמש בה.",f_listen_offer_rejected:"פריט פתוח מול WisKey; לא פעולה של בעל המערכת.",r_listen_unknown:"עוד לא ידוע אם WisKey מציע האזנה לעמדה: אין גילוי חתום (לא מהחיבור הישיר ולא מבדיקה).",f_listen_unknown:'"בדוק חיבור חתום" בבלוק "חיבור Arx ל-WisKey" למעלה.',r_policy_b:"מדיניות B: Arx לא מתקין ולא מנהל את WisKey, והתכונה זמינה רק בהתקנה מנוהלת.",f_policy_b:"ממתין להתקנה מנוהלת (בעבודה, צוות ההתקנה המנוהלת). לא מפעילים את wiskey.auto_install ידנית.",r_owner_on_not_permitted:"הפעלת ההתקנה המנוהלת חסומה בגרסה הזו (OWNER_ON_PERMITTED).",f_owner_on_not_permitted:"ממתין לגרסה עם ההתקנה המנוהלת ואישור בעל המערכת.",r_service_grant_manual:"בהתקנה ידנית אין ב־WisKey כותב להרשאת השירות (native_service_grants_v1), ולכן WisKey עונה service_grant_required.",f_service_grant_manual:"תיפתר עם ההתקנה המנוהלת, או כשבעל המערכת יגדיר הרשאת שירות ב־WisKey (לפי הנחיות WisKey).",r_not_built:"הזרימה לא בנויה עדיין ב־Arx (קבוע בנייה כבוי).",f_not_built:"פריט פיתוח פתוח; אין מה להפעיל כרגע.",r_peer_receipt_off:"מתג אישור הקבלה של WisKey (wiskey.peer_receipt) כבוי, וקריאת רישום העמיתים לא בנויה.",f_peer_receipt_off:"פריט פיתוח פתוח; אין מה להפעיל כרגע.",r_acr5_off:"מתגי הקריאה החוזרת של WisKey כבויים ({on} מתוך 4 פעילים).",f_acr5_off:"הגדרות › אבטחה › WisKey.",r_doors_unmapped:"{count} דלתות של WisKey לא משויכות לממסר בעמדה, ופתיחה שלהן נדחית.",f_doors_unmapped:"הגדרות › הקמה › שיוך דלתות: אשרו את ההצעות או שייכו ידנית.",r_windows_off:"חלונות הדלת כבויים (doors.windows.enabled).",f_windows_off:"חלונות דלת › הגדרות.",r_emergency_off:"פתיחת חירום כבויה (doors.emergency.enabled / open_enabled).",f_emergency_off:"חלונות דלת › חירום (מנהל מערכת, עם אישור).",r_automation_off:"פתיחת דלת מאוטומציה כבויה (doors.automation_open).",f_automation_off:"הגדרות › הקמה › פתיחת דלתות מאוטומציה.",r_lock_unsupported:"WisKey מסמן נעילת חירום כלא נתמכת (emergency_secure_unsupported_v1).",f_lock_unsupported:"ממתין ל־WisKey.",r_template_off:"שליחת תבניות וואטסאפ דרך WisKey כבויה (messaging.template_send).",f_template_off:"הגדרות ההודעות › תבניות וואטסאפ.",r_owner_excluded:"פקודות אישור כפול של WisKey מוחרגות בהחלטת בעל המערכת (ההרשאות של Arx הן הסמכות).",f_owner_excluded:"אין צורך להפעיל.",r_probe_unknown:"לא ידוע אם WisKey מקבל את החתימה (הבדיקה לא הסתיימה או לא הגיעה ל־WisKey).",f_probe_unknown:'"בדוק חיבור חתום" שוב.',r_check_failed:"לא ניתן לבדוק כרגע ({error}).",joinState_starting:"מופעל",joinState_connecting:"מתחבר",joinState_stopping:"נעצר",row_direct_api:"החיבור הישיר ל־WisKey (גילוי, זהות שירות)",row_w10_video:"וידאו של עמדה דרך WisKey",row_w10_talk:"דיבור דו־כיווני עם עמדה",row_w10_sound:"צליל העמדה בתוך שיחה",row_listen:"האזנה לעמדה בלי שיחה",row_native_people_writes:"כתיבת אנשים חתומה (Native, שרשרת אישור)",row_service_writer:"כותב השירות של WisKey (יצירה, עדכון, קוד, ביטול זמני)",row_readback:"קריאה חוזרת של הרשאות אדם מ־WisKey",row_csv_preview:"תצוגה מקדימה מאומתת ב־WisKey לייבוא CSV",row_capture_lease:"קליטת כרטיס בחתימה (capture lease)",row_door_release:"פתיחת דלת מ־Arx",row_programs_save:"שמירת תוכניות החזקה פתוחה בעמדה",row_door_windows:"חלונות דלת",row_emergency_open:"פתיחת חירום",row_emergency_lock:"נעילת חירום",row_door_automations:"פתיחת דלת מאוטומציה",row_feature_host:"מארח התכונות של WisKey",row_live_media_feature:"מדיה חיה לתכונות (media ingress)",row_template_send:"שליחת תבניות וואטסאפ דרך WisKey (גרסה 2)",row_template_queue:"תור תבניות וגרסה 3",row_event_cursor:"סמן אירועים עמיד (חידוש אחרי ניתוק)",row_relay_map_stage:"העברת מפת הממסרים ל־WisKey",row_job_approvals:"אישור כפול של WisKey",row_managed_install:"התקנה ועדכון מנוהלים של WisKey",row_generation_journal:"יומן דורות ותחזוקה של ההתקנה",grp_connection:"חיבור",grp_media:"מדיה ודיבור",grp_people:"אנשים",grp_doors:"דלתות",grp_messaging:"הודעות",grp_events:"אירועים",grp_install:"התקנה",link_accessTab:"הגדרות › מתגי מסכי כניסה",link_setup:"הגדרות › הקמה",link_securityWiskey:"הגדרות › אבטחה › WisKey",link_doorWindows:"חלונות דלת",link_bridgeTab:"הגדרות › גשר Arx"},Xe=je("en","i18n/wiskey-feature-status","en"),tt={he:Q,en:Xe},at=Object.keys(Q),it={"#/system/diagnostics?tab=access-control":"accessTab","#/system/setup":"setup","#/system/security/wiskey":"securityWiskey","#/wiskey/door-windows":"doorWindows","#/system/diagnostics?tab=ha":"bridgeTab"},rt=Object.fromEntries(at.filter(e=>e.startsWith("grp_")).map(e=>[Q[e],e.slice(4)]));function X(){return Ne(["en"])}const nt=/\{(\w+)\}/g;function N(e,s,t={}){const a=tt[s][e];return typeof a!="string"||!a||[...a.matchAll(nt)].map(o=>o[1]).some(o=>!(o in t)||t[o]===null||t[o]===void 0||typeof t[o]=="object")?null:De(a,t)}function ot(e,s){const t=e.params??{};if(typeof t!="object"||Array.isArray(t))return null;const a={...t};if(e.code==="join_starting"){const r=typeof t.state=="string"?t.state:"",o=N(`joinState_${r}`,s);if(!o)return null;a.what=o}return a}function lt(e,s=X()){if(s==="he")return e.text;const t=ot(e,s);return t&&N(`r_${e.code}`,s,t)||e.text}function dt(e,s=X()){return!e.fix||s==="he"?e.fix:N(`f_${e.code}`,s)||e.fix}function ct(e,s=X()){return s==="he"?e.label:N(`row_${e.key}`,s)||e.label}function pt(e,s=X()){const t=rt[e];return s==="he"||!t?e:N(`grp_${t}`,s)||e}function ht(e,s=X()){const t=it[e.href];return s==="he"||!t?e.label:N(`link_${t}`,s)||e.label}Me("i18n/wiskey-feature-status",{he:Q,en:Xe});const Ge={lbl_bridge:"גשר Arx בתשתית המערכת",lbl_component:"רכיב WisKey",lbl_key:"מפתח הצימוד",lbl_acceptance:"WisKey מקבל את המפתח",lbl_discovery:"חוזה הגילוי (פקודות מדיה ודיבור)",lbl_provider:"מקור הווידאו והדיבור",lbl_rotation:"החלפת מפתח הגשר",lbl_events:"אירועי דלת אחרי הפעלה מחדש",lbl_last_error:"שגיאה אחרונה",l_bridge_ok:"הגשר מותקן ({version}) ומצומד; הוא שולח עדכון חתום כל דקה.",l_bridge_not_paired:"הגשר עוד לא צומד ל־Arx.",l_bridge_silent:"הגשר צומד, אבל לא שלח עדכון חתום מאז {since}. כנראה שהוא לא טעון או שהקוד שלו שונה מזה של Arx.",l_bridge_update_pending:"גרסת הגשר שרצה ({active}) שונה מהגרסה שהותקנה ({installed}); נדרשת הפעלה מחדש של תשתית המערכת.",l_bridge_rejected:"הגשר שולח עדכונים חתומים, אבל Arx דוחה אותם ({count} מאז {since}): הגשר חותם בקוד צימוד אחר מזה של Arx.",l_bridge_rejected_after_repair:"אחרי הצימוד מחדש הגשר עדיין חותם בקוד הישן: Arx דוחה את העדכונים שלו ({count} מאז {since}). הקוד החדש לא הגיע לגשר.",l_component_managed:"WisKey {version} · התקנה מנוהלת על ידי Arx.",l_component_manual:"WisKey {version} · התקנה ידנית (בעל המערכת מעדכן את WisKey בעצמו).",l_component_unknown:'גרסת WisKey לא ידועה כרגע: ערוץ השירות אל WisKey במצב "{feed}".',l_key_ok:"יש מפתח צימוד והוא יכול לחתום. טביעה: {fingerprint}.",l_key_missing:"אין מפתח צימוד: Arx לא יכול לחתום על שום פקודה אל WisKey.",l_key_unreadable:"מפתח הגשר שמור, אבל לא ניתן לפענח אותו במכונה הזו (למשל אחרי שחזור גיבוי ממכונה אחרת).",l_key_rotated:"מפתח הגשר הוחלף (החלפת מפתח). WisKey מקבל רק את קוד הצימוד המקורי, ולכן Arx לא חותם אליו יותר.",l_accepted:"WisKey קיבל את החתימה של Arx וזיהה אותו כזהות שירות ({checked}).",l_refused:"WisKey דחה את החתימה של Arx ({code}): הקוד שאצלו לא תואם את המפתח של Arx, או שהגשר לא טעון אצלו.",l_probe_key:'לא נשלחה בדיקה: אין מפתח שיכול לחתום (ראו "מפתח הצימוד").',l_unreachable:"לא ניתן היה להגיע לחיבור הישיר של WisKey ({code}). אולי גרסת WisKey לא כוללת אותו, או ש־WisKey לא טעון.",l_probe_error:"הבדיקה לא הסתיימה ({code}); התוצאה לא ידועה.",l_probe_not_run:"עוד לא נבדק מול WisKey.",l_discovery_ok:"חוזה גילוי {protocol} גרסה {schema}: {listed} מתוך 6 פקודות המדיה והדיבור מפורסמות.",l_discovery_talk_missing:"WisKey מפרסם וידאו אבל לא את ארבע פקודות הדיבור ({missing}).",l_discovery_media_missing:"WisKey לא מפרסם את פקודות המדיה של העמדות ({missing}).",l_discovery_feed:"לפי ערוץ השירות: וידאו {video}, דיבור {talk} (לא נבדק בחיבור הישיר).",l_discovery_unknown:"חוזה הגילוי לא נקרא עדיין.",l_discovery_clock:"השעונים של Arx ו־WisKey רחוקים מדי זה מזה ({why}); פקודות חתומות יידחו.",l_provider_auto:"Arx בוחר לבד: החיבור הישיר של WisKey, ואם הוא לא זמין - הנתיב החתום דרך תשתית המערכת.",l_provider_local:'מקור הווידאו והדיבור מוגדר "Arx (וידאו בלבד)": Arx לא מדבר עם העמדות דרך WisKey, גם כשהצימוד תקין.',l_provider_feed_gate:'מקור הווידאו והדיבור מוגדר "WisKey (וידאו ודיבור)", אבל Arx בוחר ב־WisKey רק לפי רשימת הפקודות שבערוץ השירות, ושם פקודות המדיה לא מופיעות ({why}). לכן וידאו ודיבור לא עוברים דרך WisKey, גם כשהצימוד והחיבור הישיר תקינים.',l_provider_feed_no_talk:"ערוץ השירות מפרסם את פקודות הווידאו אבל לא את פקודות הדיבור, ולכן דיבור לא עובר דרך WisKey.",l_rotation_off:"החלפת מפתח הגשר כבויה; קוד הצימוד המקורי נשאר בתוקף.",l_rotation_risk:"החלפת מפתח הגשר מופעלת. החלפה תמחק את קוד הצימוד המקורי מהגשר, ו־WisKey יפסיק לקבל את Arx.",l_rotation_blocked_wiskey:"החלפת מפתח הגשר חסומה כל עוד WisKey מותקן: WisKey מאמת את Arx רק מול קוד הצימוד המקורי, וההחלפה מוחקת אותו מהגשר.",l_rotation_done:'מפתח הגשר כבר הוחלף; זה מה שמנתק את WisKey (ראו "מפתח הצימוד").',l_events_off:"המשכת אירועי הדלת מ־WisKey כבויה בהתקנה הזו; אירועים שקרו בזמן ש־Arx או WisKey היו כבויים עלולים לחסור.",l_events_not_run:"עוד לא נקראו אירועי דלת מ־WisKey מאז ש־Arx עלה.",l_events_ok:"המשך אחרון {at}: {delivered} אירועים חדשים, {duplicates} כפולים סוננו. {caught}",l_events_gap:"פער באירועי הדלת: {start} עד {end} ({why}). האירועים בטווח הזה לא הגיעו ל־Arx - ההיסטוריה שם לא שלמה.",l_events_unsupported:"גרסת WisKey לא מציעה המשך רציף של אירועים, ולכן אירועים שקרו בזמן ש־Arx או WisKey היו כבויים עלולים לחסור.",l_events_failed:"ההמשך האחרון ({at}) לא הצליח ({code}); Arx ינסה שוב. אירוע לא הולך לאיבוד כל עוד WisKey שומר אותו.",l_no_error:"אין שגיאה.",l_error:"{code}",x_bridge_not_paired:"בהגדרות › תשתית המערכת: העתיקו את קוד הצימוד והוסיפו בתשתית המערכת את האינטגרציה SMPLWISE Bridge עם הקוד הזה.",x_bridge_silent:"בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge - ודאו שהיא טעונה (בלי שגיאה) והפעילו מחדש את תשתית המערכת. אם זה לא עוזר - צימוד מחדש (למטה).",x_bridge_update_pending:"הפעילו מחדש את תשתית המערכת כדי שהגרסה החדשה של הגשר תיטען.",x_bridge_rejected:'לרוב זו הודעת גילוי ישנה שהחזירה לגשר קוד ישן אחרי הפעלה מחדש של תשתית המערכת. Arx מגרסה 2.39.1 מוחק אותה בעצמו. לחצו "צימוד מחדש" למטה (מנהל מערכת). אם הקוד לא נשלח לגשר אוטומטית - הזינו אותו בגשר כפי שמוצג אחרי הצימוד.',x_bridge_rejected_after_repair:"אם הקוד נשלח אוטומטית: המתינו דקה (הגשר בודק את הקוד מול Arx ומחליף אותו בעצמו); אם השורה נשארת אדומה - הפעילו מחדש את תשתית המערכת. אם הקוד לא נשלח: הגדרות › מכשירים ושירותים › SMPLWISE Bridge › מחיקה, ואז הוספת אינטגרציה › SMPLWISE Bridge עם הכתובת והקוד שמוצגים כאן.",x_component_unknown:"בדקו ש־WisKey מותקן וטעון בתשתית המערכת. בהתקנה ידנית בעל המערכת מתקין ומעדכן אותו בעצמו.",x_key_missing:'לחצו "צימוד מחדש" למטה (מנהל מערכת). Arx ייצור קוד צימוד חדש.',x_key_unreadable:'לחצו "צימוד מחדש" למטה (מנהל מערכת). Arx ייצור קוד צימוד חדש במקום המפתח שאי אפשר לפענח.',x_key_rotated:'לחצו "צימוד מחדש" למטה (מנהל מערכת) והשאירו את "לכבות את החלפת מפתח הגשר" מסומן. הקוד החדש יחזור לגשר, ו־WisKey יקבל אותו.',x_refused:"אם הגשר שולח עדכונים (השורה הראשונה תקינה): הפעילו מחדש את תשתית המערכת וודאו שיש רק אינטגרציית SMPLWISE Bridge אחת. אם הגשר שקט - צימוד מחדש (למטה).",x_probe_key:'תקנו קודם את "מפתח הצימוד".',x_unreachable:"ודאו ש־WisKey טעון בתשתית המערכת ובגרסה 2.0.1 ומעלה. בהתקנה ידנית בעל המערכת מעדכן את WisKey. Arx ינסה בינתיים את הנתיב החתום דרך תשתית המערכת.",x_probe_error:'לחצו שוב "בדיקה מול WisKey". אם זה חוזר - בדקו שתשתית המערכת זמינה.',x_probe_not_run:'לחצו "בדיקה מול WisKey".',x_discovery_talk_missing:"עדכנו את WisKey לגרסה שמפרסמת את פקודות הדיבור (בהתקנה ידנית - בעל המערכת).",x_discovery_media_missing:"עדכנו את WisKey לגרסה שמפרסמת את פקודות המדיה של העמדות (בהתקנה ידנית - בעל המערכת).",x_discovery_unknown:'לחצו "בדיקה מול WisKey".',x_discovery_clock:"סנכרנו את השעון של שרת תשתית המערכת (NTP). Arx לא מזיז את השעון שלו.",x_provider_local:'בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: בחרו "WisKey (וידאו ודיבור)".',x_provider_feed_gate:"זה לא תלוי בצימוד: נדרש עדכון - או ש־WisKey יפרסם את פקודות המדיה גם ברשימת הפקודות של ערוץ השירות, או ש־Arx יבחר לפי הגילוי החתום. פריט פתוח בפיתוח, לא פעולה של בעל המערכת.",x_provider_feed_no_talk:"כמו בשורה למעלה: נדרש עדכון של רשימת הפקודות בערוץ השירות או של בחירת Arx. פריט פתוח בפיתוח.",x_rotation_risk:'אל תלחצו "החלפת מפתח" בכרטיס מפתח הגשר כל עוד WisKey בשימוש. אפשר לכבות את ההחלפה שם, או בצימוד מחדש למטה.',x_rotation_done:"צימוד מחדש (למטה) מחזיר קוד צימוד מקורי.",x_error:"ראו את השורה שמסומנת באדום למעלה.",x_events_off:"המשכת האירועים כובתה במכוון בהגדרת השרת של ההתקנה. כדי להפעיל אותה שוב - פנו לתמיכה.",x_events_not_run:"Arx קורא את האירועים ברגע שערוץ השירות אל WisKey מוכן. אם זה נמשך - בדקו את השורות למעלה.",x_events_gap:"אין מה לתקן ב־Arx: את האירועים שבטווח אפשר לראות ביומן הכניסות (כל עוד WisKey שומר אותם). השורה חוזרת לתקינה 7 ימים אחרי הפער.",x_events_unsupported:"עדכנו את WisKey לגרסה שמפרסמת המשך רציף של אירועים (בהתקנה ידנית - בעל המערכת).",x_events_failed:'אם זה חוזר: בדקו את השורות "מפתח הצימוד" ו"WisKey מקבל את המפתח" למעלה.',s_entry_single:"בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge - ודאו שיש רשומה אחת בלבד ושהיא טעונה.",s_restart_infra:"הפעילו מחדש את תשתית המערכת (WisKey קורא את קוד הצימוד מהגשר כשהוא נטען).",s_check_again:'חזרו לכאן ולחצו "בדיקה מול WisKey".',s_update_wiskey:"עדכון WisKey הוא פעולה של בעל המערכת (התקנה ידנית, מדיניות B): התקינו את גרסת WisKey המאושרת (2.0.1 ומעלה) והפעילו מחדש את תשתית המערכת.",s_provider_choose:'בהגדרות › מתגי מסכי כניסה › מקור הווידאו והדיבור: "WisKey (וידאו ודיבור)".',s_announced_sent:"הקוד החדש נשלח לגשר הקיים: הגשר בודק אותו מול Arx ומחליף אותו בעצמו, בלי אישור. אם הגשר עוד לא הוגדר - בתשתית המערכת תופיע בקשה להוסיף את SMPLWISE Bridge; אשרו אותה.",s_announced_wait:'המתינו דקה עד שהגשר ישלח עדכון חתום (השורה "גשר Arx" תהפוך לתקינה).',s_announced_check:'לחצו "בדיקה מול WisKey".',s_manual_delete:"בתשתית המערכת: הגדרות › מכשירים ושירותים › SMPLWISE Bridge › שלוש הנקודות › מחיקה. לפני כן רשמו את האפשרויות שהוגדרו בה (משתמש שירות, האצלת שמירה, הרשאות להפעלה): הן נמחקות עם הרשומה.",s_manual_add:"הוספת אינטגרציה › SMPLWISE Bridge.",s_manual_url:"כתובת: {url} · קוד הצימוד: הקוד שמוצג כאן.",v_since_pairing:"הצימוד",v_video_yes:"כן",v_video_no:"לא",v_talk_yes:"כן",v_talk_no:"לא",v_start_unknown:"לא ידוע",v_caught_until:"Arx מעודכן עד {caught_at}.",v_caught_not_yet:"עוד לא הגיע לסוף הרשימה של WisKey.",v_why_first_start:"Arx התחיל בלי נקודת המשך",v_why_source_replaced:"WisKey הותקן מחדש או שמאגר האירועים שלו אופס",v_why_source_mismatch:"מאגר האירועים של WisKey התחלף",v_why_cursor_ahead:"ההיסטוריה של WisKey חזרה אחורה (שחזור)",v_why_retention_gap:"נקודת ההמשך ישנה מדי: WisKey כבר מחק את האירועים שאחריה",v_why_cursor_invalid:"WisKey לא זיהה את נקודת ההמשך",v_code_direct_connect_refused:"WisKey סגר את החיבור בלי תשובה - החתימה לא אומתה אצלו.",v_code_reply_unauthenticated:"התשובה של WisKey לא חתומה במפתח של Arx.",v_code_direct_identity_invalid:"WisKey החזיר זהות בפורמט לא מוכר.",v_code_direct_unreachable:"החיבור הישיר של WisKey לא נפתח.",v_code_direct_hello_timeout:"WisKey לא פתח את החיבור הישיר בזמן.",v_code_direct_hello_invalid:"פתיחת החיבור הישיר של WisKey בפורמט לא מוכר.",v_code_direct_connect_timeout:"WisKey לא ענה בזמן על בקשת החיבור.",v_code_direct_connect_failed:"החיבור הישיר נכשל.",v_code_bridge_not_paired:"אין מפתח צימוד.",v_code_bridge_key_rotated:"המפתח הוחלף, ו־WisKey לא מקבל מפתח מוחלף.",v_code_outcome_unknown:"לא התקבלה תשובה בזמן.",v_code_connection_closed:"החיבור נסגר באמצע.",v_code_probe_timeout:"הבדיקה לא הסתיימה בזמן.",v_code_clock_skew:"השעונים רחוקים מדי.",link_providerRow:"מקור הווידאו והדיבור"},Ye=je("en","i18n/wiskey-pairing-status","en"),ut={he:Ge,en:Ye},ft="#/system/diagnostics?tab=access-control";function G(){return Ne(["en"])}const _t=/\{(\w+)\}/g;function F(e,s,t={}){const a=ut[s][e];return typeof a!="string"||!a||[...a.matchAll(_t)].map(o=>o[1]).some(o=>!(o in t)||t[o]===null||t[o]===void 0||typeof t[o]=="object")?null:De(a,t)}function wt(e,s){const t=e.params??{};if(typeof t!="object"||Array.isArray(t))return null;const a={...t};for(const[r,o]of Object.entries(t)){if(!r.endsWith("_code")||r==="_code")continue;const d=typeof o=="string"?F(`v_${r.slice(0,-5)}_${o}`,s,t):null;if(!d)return null;a[r.slice(0,-5)]=d}return a}function gt(e,s=G()){return s==="he"?e.label:F(`lbl_${e.key}`,s)||e.label}function yt(e,s=G()){if(s==="he")return e.text;const t=wt(e,s);return t&&F(`l_${e.reason}`,s,t)||e.text}function mt(e,s=G()){return!e.fix||s==="he"||!e.fix_code?e.fix:F(`x_${e.fix_code}`,s)||e.fix}function We(e,s,t={},a=G()){return a==="he"||!Array.isArray(s)||s.length!==e.length?[...e]:e.map((r,o)=>typeof s[o]=="string"&&F(`s_${s[o]}`,a,t)||r)}function bt(e,s=G()){return s==="he"||e.href!==ft?e.label:F("link_providerRow",s)||e.label}Me("i18n/wiskey-pairing-status",{he:Ge,en:Ye});var vt=Object.defineProperty,$t=Object.getOwnPropertyDescriptor,$=(e,s,t,a)=>{for(var r=a>1?void 0:a?$t(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(r=(a?d(s,t,r):d(r))||r);return a&&r&&vt(s,t,r),r};const kt={ok:"live",warn:"stale",blocked:"error",unknown:"unknown"},xt={ok:i("תקין"),warn:i("לתשומת לב"),blocked:i("חסום"),unknown:i("לא ידוע")},St={on:"live",off:"offline",blocked:"error",unknown:"unknown"},Wt={local:i("Arx (וידאו בלבד)"),auto:i("WisKey (וידאו ודיבור)")},Kt={on:i("פעיל"),off:i("כבוי"),blocked:i("חסום"),unknown:i("לא ידוע")};let g=class extends L{constructor(){super(...arguments),this.bare=!1,this.data=null,this.busy="",this.error="",this.confirming=!1,this.pauseRotation=!0,this.result=null,this.copied=!1,this.showFeatures=null,this.showTriage=null}get featuresShown(){return this.showFeatures??!this.bare}get triageShown(){return this.showTriage??!this.bare}connectedCallback(){super.connectedCallback(),u()&&w("system.configure")&&!Z()&&this.load()}async load(){this.busy="load",this.error="";try{this.data=await Ys()}catch(e){this.error=T(e)}finally{this.busy=""}}async probe(){this.busy="probe",this.error="";try{this.data=await Vs()}catch(e){this.error=T(e)}finally{this.busy=""}}async repair(){this.busy="repair",this.error="";try{this.result=await qs(this.pauseRotation),this.data=this.result.status,this.confirming=!1}catch(e){this.error=T(e)}finally{this.busy=""}}async copy(e){try{await navigator.clipboard.writeText(e),this.copied=!0,setTimeout(()=>this.copied=!1,2e3)}catch{this.copied=!1}}renderFacts(e){const s=e.facts;if(e.key==="discovery"&&s.listed&&typeof s.listed=="object"&&Object.keys(s.listed).length){const t=s.listed;return n`<div class="chips" data-wkp-listed>${Object.entries(t).map(([a,r])=>n`<span class="chip ${r?"on":""}"><bdi>${a}</bdi> ${r?"✓":"✗"}</span>`)}</div>`}if(e.key==="provider"){const t=Array.isArray(s.readiness)?s.readiness:[],a=s.row??null;return n`<div class="chips" data-wkp-provider><span class="chip" data-wkp-provider-choice=${String(s.choice??"")}>${Wt[String(s.choice)]??String(s.choice??"")}</span>
          <span class="chip">${i("רשימת ערוץ השירות:")} <bdi>${s.feed_reason?String(s.feed_reason):i("מפרסמת וידאו")}</bdi></span>
          ${t.map(r=>n`<span class="chip" data-wkp-readiness=${r}><bdi>${r}</bdi></span>`)}</div>
        ${a?n`<a href=${a.href} data-wkp-provider-link>${i('לשורה "{label}"',{label:bt(a)})}</a>`:c}`}return c}renderLine(e){const s=mt(e);return n`<div class="line" data-wkp-line=${e.key} data-state=${e.state}>
      <span class="lbl">${gt(e)}</span>
      <sw-badge kind=${kt[e.state]} label=${xt[e.state]}></sw-badge>
      <div class="body"><span>${yt(e)}</span>${this.renderFacts(e)}${s?n`<span class="fix ${e.state==="blocked"?"blocked":""}" data-wkp-fix>${i("איך מתקנים:")} ${s}</span>`:c}</div>
    </div>`}renderRepair(e){if(!e.repair.available&&!this.result)return c;const s=this.result;return n`<div class="section" data-wkp-repair>
      <h4>${i("צימוד מחדש")}</h4>
      ${s?n`<div class="muted" data-wkp-repair-done>${s.announced?i("נוצר קוד צימוד חדש והוא נשלח לגשר."):i("נוצר קוד צימוד חדש. יש להזין אותו בגשר בתשתית המערכת.")}${s.rotation_paused?` ${i("החלפת מפתח הגשר כובתה.")}`:""}</div>
            ${s.pairing_code?n`<div class="code"><span>${i("קוד הצימוד:")}</span><code data-wkp-code>${s.pairing_code}</code>
                  <sw-button size="sm" icon="copy" @click=${()=>this.copy(s.pairing_code??"")}>${this.copied?i("הועתק"):i("העתקה")}</sw-button></div>`:c}
            <ol data-wkp-repair-steps>${We(s.steps,s.step_codes,{url:s.addon_url}).map(t=>n`<li>${t}</li>`)}</ol>`:n`<div class="muted">${e.repair.announce?i("Arx יכול לתקן את זה בעצמו: ליצור קוד צימוד חדש ולשלוח אותו לגשר. פעולה של מנהל מערכת, נרשמת ביומן."):i("Arx יכול לתקן את זה בעצמו: ליצור קוד צימוד חדש (את הקוד מזינים בגשר בתשתית המערכת). פעולה של מנהל מערכת, נרשמת ביומן.")}</div>
            <div><sw-button variant="danger" size="sm" icon="link" data-wkp-repair-open ?disabled=${!!this.busy} @click=${()=>this.confirming=!0}>${i("צימוד מחדש")}</sw-button></div>`}
    </div>`}renderConfirm(e){return this.confirming?n`<sw-dialog open heading=${i("צימוד מחדש של Arx ו־WisKey")} data-wkp-confirm @close=${()=>this.confirming=!1}>
      <div class="dlg">
        <div>${i("Arx ייצור קוד צימוד חדש. עד שהגשר יקבל אותו, פעולות דרך הגשר (פתיחת דלת, פעולות בהתקנים, רשימת המשתמשים) ו־WisKey לא יעבדו, וכל אישור קליטת כרטיס פתוח יבוטל.")}</div>
        <div>${e.repair.announce?i("הקוד יישלח לגשר אוטומטית; ייתכן שתופיע בקשת אישור בתשתית המערכת."):i("בהתקנה הזו הקוד לא נשלח אוטומטית: יוצגו כאן הקוד והשלבים להזנתו בגשר.")}</div>
        <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${i("לכבות גם את החלפת מפתח הגשר (מומלץ: החלפה מנתקת את WisKey)")} data-wkp-pause .checked=${this.pauseRotation} @change=${s=>this.pauseRotation=Pe(s)}></sw-toggle>
          <span>${i("לכבות גם את החלפת מפתח הגשר (מומלץ: החלפה מנתקת את WisKey)")}</span></label>
        ${this.error?n`<div class="err" role="alert">${this.error}</div>`:c}
      </div>
      <div class="dfoot"><sw-button variant="ghost" @click=${()=>this.confirming=!1}>${i("ביטול")}</sw-button>
        <sw-button variant="danger" data-wkp-confirm-ok ?disabled=${this.busy==="repair"} @click=${()=>this.repair()}>${this.busy==="repair"?i("מצמד…"):i("צימוד מחדש")}</sw-button></div>
    </sw-dialog>`:c}renderFeature(e){return n`<div class="feat" data-wkp-feature=${e.key} data-state=${e.state}>
      <span>${ct(e)}</span>
      <sw-badge kind=${St[e.state]} label=${Kt[e.state]}></sw-badge>
      <div class="reasons">
        ${e.reasons.map(s=>{const t=dt(s);return n`<div class="reason" data-wkp-reason=${s.code}><span class="kind">${Zs[s.kind]}</span>${lt(s)}${t?n` <span class="how">· ${i("איך מפעילים:")} ${t}</span>`:c}</div>`})}
        ${e.link?n`<a href=${e.link.href} data-wkp-link>${ht(e.link)}</a>`:c}
      </div>
    </div>`}renderFeatures(e){if(!e.features.length)return c;const s=st(e.features);return n`<div class="section" data-wkp-features>
      <div class="top" style="border:0;padding:0">
        <h4>${i("מצב WisKey: תכונות בנויות")}</h4>
        <span class="muted">${i("{n} פעילות",{n:s.on})} · ${i("{n} כבויות",{n:s.off})} · ${i("{n} חסומות",{n:s.blocked})}${s.unknown?` · ${i("{n} לא ידוע",{n:s.unknown})}`:""}</span>
        <span class="sp"></span>
        <sw-button size="sm" variant="ghost" data-wkp-features-toggle @click=${()=>this.showFeatures=!this.featuresShown}>${this.featuresShown?i("הסתרה"):i("הצגה")}</sw-button>
      </div>
      ${this.featuresShown?et(e.features).map(([t,a])=>n`<div class="group"><h5>${pt(t)}</h5>${a.map(r=>this.renderFeature(r))}</div>`):c}
    </div>`}renderTriage(){return this.bare?n`<div class="section" data-wkp-triage>
        <div class="top" style="border:0;padding:0"><h4>${i("מצב WisKey: התנגשויות והתראות")}</h4><span class="sp"></span>
          <sw-button size="sm" variant="ghost" data-wkp-triage-toggle @click=${()=>this.showTriage=!this.triageShown}>${this.triageShown?i("הסתרה"):i("הצגה")}</sw-button></div>
        ${this.triageShown?n`<wk-triage-panel mode="compact"></wk-triage-panel>`:c}
      </div>`:n`<div class="section" data-wkp-triage>
      <h4>${i("מצב WisKey: התנגשויות והתראות")}</h4>
      <wk-triage-panel mode="compact"></wk-triage-panel>
    </div>`}summary(){const e=x().sum;if(Z())return _e;const s=this.data;return s?`${Se[s.verdict]} · ${s.talk_ready?e.pairingTalkReady:e.pairingTalkNot}`:this.error?e.failed:e.loading}updated(){this.bare&&D(this,{card:"pairing",summary:this.summary(),present:u()&&w("system.configure")})}render(){if(!u()||!w("system.configure"))return c;const e=this.data,s=Z();return n`<sw-card heading=${this.bare?"":i("חיבור Arx ל-WisKey")} subheading=${this.bare?"":i("האם Arx ו־WisKey מצומדים, מה חסר ואיך משלימים. הבדיקה החתומה היא קריאה בלבד ונרשמת ביומן.")} data-wkp-card>
      ${s?n`<div class="muted" data-wkp-remote>${_e}</div>`:n`<div class="top">
              ${e?n`<sw-badge kind=${e.paired?"live":e.paired===!1?"error":"unknown"} filled label=${Se[e.verdict]} data-wkp-verdict=${e.verdict}></sw-badge>
                  <span class="muted" data-wkp-talk>${e.talk_ready?i("דיבור דרך WisKey: מוכן"):i("דיבור דרך WisKey: לא מוכן")}</span>`:n`<span class="muted">${this.busy==="load"?i("טוען…"):""}</span>`}
              <span class="sp"></span>
              ${e?.probe?n`<span class="muted" data-wkp-checked>${i("נבדק ב־")}<bdi>${Fe(e.probe.at,Le(),Be)}</bdi>${Qs(e.probe)?` · ${i("בדיקה ישנה, מומלץ לבדוק שוב")}`:""}</span>`:c}
              <sw-button size="sm" variant="primary" icon="shield" data-wkp-probe ?disabled=${!!this.busy} @click=${()=>this.probe()}>${this.busy==="probe"?i("בודק…"):i("בדוק חיבור חתום")}</sw-button>
            </div>
            ${this.error&&!this.confirming?n`<div class="err" role="alert" style="margin-block-start:8px">${this.error}</div>`:c}
            ${e?n`<div class="lines">${e.lines.map(t=>this.renderLine(t))}</div>
                  ${e.owner_steps.length?n`<div class="section" data-wkp-steps><h4>${i("מה נדרש מחוץ ל־Arx")}</h4><ol>${We(e.owner_steps,e.owner_step_codes).map(t=>n`<li>${t}</li>`)}</ol></div>`:c}
                  ${this.renderRepair(e)} ${this.renderFeatures(e)} ${this.renderTriage()} ${this.renderConfirm(e)}`:c}`}
    </sw-card>`}};g.styles=I`
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
    ${ce}
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
  `;$([y({type:Boolean,reflect:!0})],g.prototype,"bare",2);$([p()],g.prototype,"data",2);$([p()],g.prototype,"busy",2);$([p()],g.prototype,"error",2);$([p()],g.prototype,"confirming",2);$([p()],g.prototype,"pauseRotation",2);$([p()],g.prototype,"result",2);$([p()],g.prototype,"copied",2);$([p()],g.prototype,"showFeatures",2);$([p()],g.prototype,"showTriage",2);g=$([P("system-wiskey-pairing")],g);const At=2e3;function Ke(e){const s=e.split(/\r?\n/).map(a=>a.split(/\s+/).filter(Boolean).join(" ")).filter(a=>a.length>0),t=Ue({[h.phrases]:e}).phrases.length;return{shown:t,dropped:Math.max(0,s.length-t),builtIn:t===0}}const Tt={off:"dispMediaOff",video:"dispMediaVideo",video_talk:"dispMediaTalk"},Ae=()=>is.map(e=>[e,l(Tt[e])]),Et={match:"live",filtered:"neutral",mismatch:"error",partial:"partial",not_permitted:"forbidden",unsupported:"unknown",unavailable:"offline"},Ot=e=>Et[e]??"unknown",Te=e=>he(`out_${e}`,"out_unavailable");function Ct(e){return e.outcome==="filtered"?he(`why_${e.rule??"station_scope"}`,"why_station_scope"):e.outcome==="not_permitted"?l("why_permission"):e.outcome==="mismatch"?l("why_mismatch"):e.outcome==="partial"?l("why_partial"):""}function Ee(e){return!e||e.count===null||e.count===void 0?"—":e.complete?String(e.count):l("notComplete",{n:e.count})}const Rt=e=>he(`scr_${e}`,"scr_stations"),Ve=["overview","events","people","devices"];function It(e,s){const t=/^#\/wiskey\/([a-z-]+)$/.exec(e);return t?{native:s(t[1])===!0?e:null,classic:Ve.includes(t[1])?`${e}?classic=1`:null}:{native:e||null,classic:null}}const le=[{screen:"overview",label:"chk_overview",items:["item_stations_count","item_ringing"]},{screen:"stations",label:"chk_stations",items:["item_stations_count","item_doors","item_technical"]},{screen:"people",label:"chk_people",items:["item_people_count","item_sample_person"]},{screen:"events",label:"chk_events",items:["item_last_events","item_event_filters"]},{screen:"schedules",label:"chk_schedules",items:["item_schedule"]}],de="sw.access.parity.checklist";function Lt(e){try{const s=e?.getItem(de);if(!s)return{};const t=JSON.parse(s);if(!t||typeof t!="object"||Array.isArray(t))return{};const a={};for(const r of le){const o=t[r.screen];if(!(!o||typeof o!="object"))for(const d of r.items)o[d]===!0&&((a[r.screen]??={})[d]=!0)}return a}catch{return{}}}function Oe(e,s){try{if(!e)return;Object.keys(s).length?e.setItem(de,JSON.stringify(s)):e.removeItem(de)}catch{}}function Pt(e,s,t){const a=JSON.parse(JSON.stringify(e)),r=a[s]??={};return r[t]?delete r[t]:r[t]=!0,Object.keys(r).length||delete a[s],a}function Ce(e,s){let t=0,a=0;for(const r of s)a+=r.items.length,t+=r.items.filter(o=>e[r.screen]?.[o]).length;return{done:t,all:a}}var zt=Object.defineProperty,jt=Object.getOwnPropertyDescriptor,_=(e,s,t,a)=>{for(var r=a>1?void 0:a?jt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(r=(a?d(s,t,r):d(r))||r);return a&&r&&zt(s,t,r),r};const Re={[h.callHint]:te.callHint,[h.talk]:te.talk,[h.announceScope]:te.announceScope,[h.phrases]:"",[C]:"off",[q]:"local",[S]:String(_s),[oe]:"off",[M]:"",[j]:""};let f=class extends L{constructor(){super(...arguments),this.show="all",this.bare=!1,this.saved=null,this.draft={},this.canEdit=!1,this.busy=!1,this.message="",this.error="",this.failed="",this.readiness=null,this.readinessFailed=!1,this.engines=null,this.enginesState="idle",this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}read(e){const s=Ue(e);return{[h.callHint]:s.callHint,[h.talk]:s.talk,[h.announceScope]:s.announceScope,[h.phrases]:String(e[h.phrases]??""),[C]:os(e),[q]:ns(e),[S]:String(rs(e)),[oe]:ks(e),[M]:$e(e).engine,[j]:$e(e).language}}async load(){const e=++this.gen;if(this.failed="",!u()){this.saved={...Re};return}try{const s=await ls();if(e!==this.gen)return;this.saved=this.read(s.settings),this.canEdit=!!s.can_edit&&w("system.configure"),this.show!=="announce"&&this.loadReadiness(),this.show!=="display"&&this.canEdit&&this.enginesState==="idle"&&this.loadEngines()}catch(s){if(e!==this.gen)return;this.failed=T(s)}}async loadReadiness(){if(!u()||!w("system.configure"))return;const e=this.gen;this.readinessFailed=!1;try{const s=await ds();e===this.gen&&(this.readiness=s)}catch{e===this.gen&&(this.readinessFailed=!0)}}async loadEngines(){const e=this.gen;this.enginesState="loading";try{const s=await cs();if(e!==this.gen)return;this.engines=s.tts??null,this.enginesState=s.tts?"ready":"unavailable"}catch{e===this.gen&&(this.enginesState="unavailable")}}readinessLine(){if(!u()||!w("system.configure"))return null;const e=we().source;if(this.readinessFailed)return{state:"failed",text:e.failed};const s=ps(this.readiness);if(!s)return{state:"checking",text:e.checking};const t=this.value(q)==="auto";if(s.state==="ok")return{state:"ok",text:t?e.ok:e.okLocal};const a=e.capsKinds[hs(this.readiness)],r=s.codes.map(d=>ge(e.codes[d],{kind:a})).join("; "),o=t?s.state==="partial"?e.videoOnly:e.fallback:"";return{state:s.state,text:`${ge(e.missing,{list:r})}${o?` - ${o}`:""}`}}settled(){const e=this.show!=="announce"&&u()&&w("system.configure")&&!this.readinessFailed&&this.readiness===null,s=this.show!=="display"&&this.canEdit&&(this.enginesState==="idle"||this.enginesState==="loading");return!e&&!s}value(e){return this.draft[e]??this.saved?.[e]??Re[e]}set(e,s){const t={...this.draft};if(this.saved&&this.saved[e]===s?delete t[e]:t[e]=s,this.draft=t,this.message="",e===M){const a=this.value(j),r=this.engineLanguages(s);a&&r.length&&!r.includes(a)&&this.set(j,"")}}engineLanguages(e){const s=e||ke(this.engines);return this.engines?.engines.find(t=>t.engine_id===s)?.supported_languages??[]}ttsRows(){const e=Ws().setting,s=!u()||!this.canEdit,t=this.value(M),a=this.value(j),r=this.engines?.engines??[],o=this.enginesState==="ready",d=o&&!!t&&!r.some(m=>m.engine_id===t),k=r.find(m=>m.engine_id===ke(this.engines)),Y=[["",e.systemDefault],...r.map(m=>[m.engine_id,m.name])];t&&!r.some(m=>m.engine_id===t)&&Y.push([t,o?V(e.missingOption,{engine:t}):t]);const z=this.engineLanguages(t),ue=[["",e.languageAuto],...z.map(m=>[m,`${Ks(m)} · ${m}`])];a&&!z.includes(a)&&ue.push([a,o&&z.length?V(e.missingLanguageOption,{language:a}):a]);const Je=s?n`<span class="muted">${e.engineText}</span>`:d?n`<span class="msg warn" role="status" data-tts-fixed-missing><sw-icon name="warning" size=${13}></sw-icon>${V(e.missing,{engine:t})}</span>`:this.enginesState==="unavailable"?n`<span class="muted" role="status" data-tts-fixed-list="unavailable">${e.listUnavailable}</span>`:o&&!r.length?n`<span class="muted" role="status" data-tts-fixed-list="empty">${e.noEngines}</span>`:n`<span class="muted">${this.enginesState==="loading"?e.loading:e.engineText}</span>`,Qe=!t&&k?n`<span class="muted" data-tts-fixed-default-now>${V(e.systemDefaultNow,{name:k.name})}</span>`:c;return n`<div class="row" data-access-display-tts-engine><span class="lbl">${e.engine}${Je}${Qe}</span>
        ${this.select(M,Y)}</div>
      ${z.length||a?n`<div class="row" data-access-display-tts-language><span class="lbl">${e.language}<span class="muted">${e.languageText}</span></span>
            ${this.select(j,ue)}</div>`:c}`}payload(){const e={...this.draft};if(S in e){const s=ee(String(e[S]));if(s===null)return null;e[S]=s}return e}async save(){if(!Object.keys(this.draft).length||this.busy)return;const e=this.payload();if(e){this.busy=!0,this.error="";try{const s=await us(e);this.saved=this.read(s.settings),this.draft={},fs(),this.message=l("dispSaved"),this.show!=="announce"&&this.loadReadiness()}catch(s){this.error=T(s)}finally{this.busy=!1}}}select(e,s){const t=!u()||!this.canEdit;return n`<sw-field class="ctl"><select data-set-access-display=${e} ?disabled=${t||this.busy} @change=${a=>this.set(e,a.target.value)}>
      ${s.map(([a,r])=>n`<option value=${a} ?selected=${this.value(e)===a}>${r}</option>`)}
    </select></sw-field>`}talkMax(){const e=!u()||!this.canEdit,s=this.value(S),t=ee(s)===null;return n`<div class="row" data-access-display-talk-max><span class="lbl">${l("dispTalkMax")}</span>
      <sw-field class="ctl" hint=${t?l("dispTalkMaxInvalid",{min:ye,max:me}):l("dispTalkMaxUnit")}>
        <input type="number" inputmode="numeric" dir="ltr" min=${ye} max=${me} step="1" data-set-access-display=${S}
          aria-label=${l("dispTalkMax")} aria-invalid=${t?"true":"false"} ?disabled=${e||this.busy} .value=${s}
          @input=${a=>this.set(S,a.target.value)} />
      </sw-field></div>`}sourceRow(){const e=we().source,s=this.readinessLine();return n`<div class="row" data-access-display-source>
      <span class="lbl">${e.label}${s?n`<span class="muted" role="status" data-access-display-readiness=${s.state}>${s.text}</span>`:c}</span>
      ${this.select(q,[["local",e.local],["auto",e.auto]])}
    </div>`}cardTitle(){return this.show==="announce"?x().title.announce:l("dispTitle")}summary(){const e=x().sum;if(this.failed)return e.failed;const s=this.saved;if(!s)return e.loading;const t=Object.keys(this.draft).length>0;if(this.show==="announce"){const d=s[h.announceScope]==="station"?l("dispAnnounceStation"):l("dispAnnounceScope"),k=s[M],Y=k?this.engines?.engines.find(z=>z.engine_id===k)?.name??k:"";return ne(bs(d,Y,Ke(s[h.phrases]).shown),t)}const a=s[h.callHint]==="call"?l("dispCallHintCall"):l("dispCallHintEveryone"),r=s[h.talk]==="hidden"?l("dispTalkHidden"):e.talkShown,o=Ae().find(([d])=>d===s[C])?.[1]??l("dispMediaOff");return ne(vs(a,r,o),t)}updated(){this.bare&&D(this,{card:this.show==="announce"?"announce":"display",summary:this.summary(),present:!0})}displayRows(){return n`<div class="row"><span class="lbl">${l("dispCallHint")}<span class="muted">${l("dispCallHintText")}</span></span>
        ${this.select(h.callHint,[["everyone",l("dispCallHintEveryone")],["call",l("dispCallHintCall")]])}</div>
      <div class="row"><span class="lbl">${l("dispTalk")}<span class="muted">${l("dispTalkText")}</span></span>
        ${this.select(h.talk,[["classic",l("dispTalkClassic")],["hidden",l("dispTalkHidden")]])}</div>
      <div class="row" data-access-display-media><span class="lbl">${l("dispMedia")}</span>
        ${this.select(C,Ae())}</div>
      ${this.value(C)!=="off"?this.sourceRow():c}
      ${this.value(C)==="video_talk"?this.talkMax():c}
      ${this.value(C)!=="off"?n`<div class="row" data-access-display-listen><span class="lbl">${H().setting.label}<span class="muted">${H().setting.text}</span></span>
            ${this.select(oe,[["off",H().setting.off],["on",H().setting.on],["probe",H().setting.probe]])}</div>`:c}`}announceRows(e){const s=this.value(h.phrases),t=Ke(s);return n`<div class="row"><span class="lbl">${l("dispAnnounce")}<span class="muted">${l("dispAnnounceText")}</span></span>
        ${this.select(h.announceScope,[["scope",l("dispAnnounceScope")],["station",l("dispAnnounceStation")]])}</div>
      ${this.ttsRows()}
      <div class="row stack"><span class="lbl">${l("dispPhrases")}<span class="muted">${l("dispPhrasesText",{n:Ss,len:xs})}</span></span>
        <sw-field hint=${[t.builtIn?l("dispPhrasesBuiltIn"):l("dispPhrasesCount",{n:t.shown}),t.dropped?l("dispPhrasesDropped",{n:t.dropped}):""].filter(Boolean).join(" · ")}>
          <textarea data-set-access-display=${h.phrases} aria-label=${l("dispPhrases")} maxlength=${At} rows=${this.bare?"3":"5"} ?disabled=${e||this.busy} .value=${s} @input=${a=>this.set(h.phrases,a.target.value)}></textarea>
        </sw-field></div>`}render(){const e=this.bare?"":this.cardTitle();if(this.failed)return n`<sw-card heading=${e} data-access-display="error" data-access-display-show=${this.show}><div class="row"><span class="lbl">${this.failed}</span><sw-button size="lg" variant="ghost" icon="refresh" @click=${()=>void this.load()}>${l("dispRetry")}</sw-button></div></sw-card>`;if(!this.saved)return n`<sw-card heading=${e} data-access-display="loading" data-access-display-show=${this.show}><div class="row"><span class="lbl muted">${l("dispLoading")}</span></div></sw-card>`;const s=!u()||!this.canEdit,t=Object.keys(this.draft).length>0,a=ee(this.value(S))!==null,r=this.bare?"":this.show==="announce"?x().announceSub:l("dispSub");return n`<sw-card heading=${e} subheading=${r} data-access-display="ready" data-access-display-settled=${this.settled()?"true":"false"} data-access-display-show=${this.show}>
      ${this.show!=="announce"?this.displayRows():c}
      ${this.show!=="display"?this.announceRows(s):c}
      ${s?n`<div class="muted" data-access-display-readonly>${u()?l("dispReadOnly"):""}</div>`:n`<div class="foot">
            <sw-button variant="primary" icon="check" data-save-access-display ?disabled=${!t||!a||this.busy} @click=${()=>void this.save()}>${l("dispSave")}</sw-button>
            ${this.message?n`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:c}
            ${this.error?n`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:c}
          </div>`}
    </sw-card>`}};f.styles=[He,I`
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
    `,pe];_([y({reflect:!0})],f.prototype,"show",2);_([y({type:Boolean,reflect:!0})],f.prototype,"bare",2);_([p()],f.prototype,"saved",2);_([p()],f.prototype,"draft",2);_([p()],f.prototype,"canEdit",2);_([p()],f.prototype,"busy",2);_([p()],f.prototype,"message",2);_([p()],f.prototype,"error",2);_([p()],f.prototype,"failed",2);_([p()],f.prototype,"readiness",2);_([p()],f.prototype,"readinessFailed",2);_([p()],f.prototype,"engines",2);_([p()],f.prototype,"enginesState",2);f=_([P("system-access-display")],f);function Mt(e){const s=new URLSearchParams;return e.asUser&&s.set("as_user",e.asUser),s.set("hours",String(e.hours??24)),s.toString()}const Dt=(e={},s)=>ws(`access-control/parity?${Mt(e)}`,{signal:s});var Nt=Object.defineProperty,Ft=Object.getOwnPropertyDescriptor,A=(e,s,t,a)=>{for(var r=a>1?void 0:a?Ft(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(r=(a?d(s,t,r):d(r))||r);return a&&r&&Nt(s,t,r),r};const re=[24,168],Ie="display:inline-flex;align-items:center;min-block-size:var(--sw-touch-desktop,44px);padding:0 12px;box-sizing:border-box;border:1px solid var(--sw-border-strong);border-radius:var(--sw-r-pill);color:var(--sw-text);text-decoration:none;font-size:var(--sw-fs-sm)";function Bt(){try{return{kind:"iana",name:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}}catch{return{kind:"iana",name:"UTC"}}}let v=class extends L{constructor(){super(...arguments),this.rev=0,this.show="all",this.bare=!1,this.subject="",this.hours=re[0],this.users=[],this.ticks={},this.asked=!1,this.lastRev=0,this.switchedOn=e=>{const s=se.find(t=>be[t]===e);return s?ve[s]==="smplwise":null}}connectedCallback(){super.connectedCallback(),this.res=new Ts({fetch:()=>Dt({asUser:this.subject||void 0,hours:this.hours}),pick:e=>e.parity,onChange:()=>this.requestUpdate()}),this.ticks=Lt(ae()),u()&&w("system.configure")&&this.show!=="checklist"&&As().then(e=>this.users=e.users.filter(s=>s.active&&!s.is_self)).catch(()=>this.users=[])}disconnectedCallback(){this.res?.dispose(),super.disconnectedCallback()}updated(e){e.has("rev")&&this.rev!==this.lastRev&&(this.lastRev=this.rev,this.asked&&this.res.reload()),this.bare&&this.show!=="all"&&D(this,{card:this.show==="checklist"?"checklist":"parity",summary:this.summary(),present:!0})}run(){this.asked=!0,this.res.reload()}subjectItems(){return[{id:"",label:l("subjectMe")},...this.users.map(e=>({id:e.id,label:e.name||e.username||e.id}))]}hourItems(){return re.map(e=>({id:String(e),label:e===24?l("window24"):l("window168")}))}openCell(e){const s=It(e.route,this.switchedOn);return!s.native&&!s.classic?"—":n`<span style=${O.row}>
      ${s.native?n`<a style=${Ie} href=${s.native} target="_blank" rel="noopener" data-parity-open="native">${l("openArx")}</a>`:c}
      ${s.classic?n`<a style=${Ie} href=${s.classic} target="_blank" rel="noopener" data-parity-open="classic">${l("openClassic")}</a>`:c}
    </span>`}table(e){const s=a=>a,t=[{key:"screen",label:l("colScreen"),render:a=>n`<span style=${O.strong}>${Rt(s(a).screen)}</span>`},{key:"source",label:l("colSource"),render:a=>Ee(s(a).source)},{key:"native",label:l("colNative"),render:a=>{const r=s(a);return n`<span>${Ee(r.native)}${r.outcome==="filtered"&&r.expected_count!==null?n`<span style=${O.sub}>${l("expected",{n:r.expected_count})}</span>`:c}</span>`}},{key:"outcome",label:l("colOutcome"),render:a=>n`<sw-badge data-parity-outcome=${s(a).outcome} kind=${Ot(s(a).outcome)} label=${Te(s(a).outcome)}></sw-badge>`},{key:"why",label:l("colWhy"),render:a=>{const r=s(a),o=Ct(r);return n`<span style=${O.wrap} data-parity-why>${o||c}${r.reason?n`<span style=${o?O.sub:O.raw}><span style=${O.raw}>${r.reason}</span></span>`:c}${!o&&!r.reason?"—":c}</span>`}},{key:"open",label:l("colOpen"),render:a=>this.openCell(s(a))}];return n`<sw-table data-parity-table .columns=${t} .rows=${e.screens} rowKey="screen"></sw-table>`}report(){const e=this.res.snap,s=e.data;let t;if(!this.asked)t=n`<div class="empty" data-parity-idle>${l("notRun")}</div>`;else if(e.busy&&!s)t=Es(6);else if(s)t=this.table(s);else return n`<sw-card flush data-access-card="parity">${this.head()}${Os(e.failure??"error",e.message,()=>this.run())}</sw-card>`;const a=new Date;return n`<sw-card flush data-access-card="parity" data-parity-state=${this.asked?e.busy?"busy":s?"ready":"failed":"idle"}>
      ${this.head()}
      ${e.failure&&s?n`<div class="note err" role="alert" data-parity-failed><sw-icon name="warning" size=${16}></sw-icon><span>${e.message||Te("unavailable")}</span></div>`:c}
      ${t}
      ${s?n`<div class="foot-note" data-parity-foot>${[l("ranFor",{name:s.subject.self?l("subjectMe"):s.subject.display_name,when:e.fetchedAt?Cs(Rs(e.fetchedAt,a,Bt())):""}),l("windowNote",{n:s.window_hours}),l("summary",{match:s.summary.match??0,filtered:s.summary.filtered??0,mismatch:s.summary.mismatch??0})].join(" · ")}</div>`:c}
    </sw-card>`}head(){const e=this.res.snap.busy;return n`<div class="ch">
      ${this.bare?n`<div class="sub">${l("sub")}</div>`:n`<div><h3>${l("title")}</h3><div class="sub">${l("sub")}</div></div>`}
      <div class="ctl">
        ${this.users.length?n`<sw-dropdown tall data-parity-subject label=${l("subject")} .items=${this.subjectItems()} .value=${this.subject} @change=${s=>this.subject=s.detail.id}></sw-dropdown>`:c}
        <sw-dropdown tall data-parity-hours label=${l("window")} .items=${this.hourItems()} .value=${String(this.hours)} @change=${s=>this.hours=Number(s.detail.id)||re[0]}></sw-dropdown>
        <sw-button size="lg" variant="primary" icon="refresh" data-parity-run ?disabled=${e} @click=${()=>this.run()}>${e?l("running"):l("run")}</sw-button>
      </div>
    </div>`}tick(e,s){this.ticks=Pt(this.ticks,e,s),Oe(ae(),this.ticks)}clearTicks(){this.ticks={},Oe(ae(),{})}checklist(){const e=le.filter(t=>se.includes(t.screen)),s=Ce(this.ticks,e);return n`<sw-card flush data-access-card="parity-checklist">
      <div class="ch">
        ${this.bare?n`<div class="sub">${l("checklistSub")}</div>`:n`<div><h3>${l("checklistTitle")}</h3><div class="sub">${l("checklistSub")}</div></div>`}
        <div class="ctl">
          <span class="muted" data-parity-progress>${l("checklistDone",s)}</span>
          ${s.done?n`<sw-button size="lg" variant="ghost" data-parity-clear @click=${()=>this.clearTicks()}>${l("checklistClear")}</sw-button>`:c}
        </div>
      </div>
      <div class="chk-grid">${e.map(t=>{const a=be[t.screen],r=`#/wiskey/${a}`;return n`<div class="chk" data-parity-checklist=${t.screen}>
          <div class="chk-head">
            <span class="t">${l(t.label)}</span>
            ${ve[t.screen]==="smplwise"?n`<a href=${r} target="_blank" rel="noopener" data-parity-open="native">${l("openArx")}</a>`:c}
            ${Ve.includes(a)?n`<a href=${`${r}?classic=1`} target="_blank" rel="noopener" data-parity-open="classic">${l("openClassic")}</a>`:c}
          </div>
          ${t.items.map(o=>n`<label class="item"><input type="checkbox" data-parity-item=${`${t.screen}:${o}`} .checked=${!!this.ticks[t.screen]?.[o]} @change=${()=>this.tick(t.screen,o)} /><span>${l(o)}</span></label>`)}
        </div>`})}</div>
    </sw-card>`}summary(){const e=x().sum;if(this.show==="checklist"){const a=Ce(this.ticks,le.filter(r=>se.includes(r.screen)));return $s(a.done,a.all)}const s=this.res?.snap,t=s?.data;return!this.asked||!s?e.parityIdle:s.busy&&!t?e.parityBusy:t?l("summary",{match:t.summary.match??0,filtered:t.summary.filtered??0,mismatch:t.summary.mismatch??0}):e.parityFailed}render(){return n`<div class="stack" data-access-status="ready">${this.show!=="checklist"?this.report():c}${this.show!=="report"?this.checklist():c}</div>`}};v.styles=[Is,I`
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
    `,pe];A([y({type:Number})],v.prototype,"rev",2);A([y({reflect:!0})],v.prototype,"show",2);A([y({type:Boolean,reflect:!0})],v.prototype,"bare",2);A([p()],v.prototype,"subject",2);A([p()],v.prototype,"hours",2);A([p()],v.prototype,"users",2);A([p()],v.prototype,"ticks",2);A([p()],v.prototype,"asked",2);v=A([P("system-access-parity")],v);var Ht=Object.defineProperty,Ut=Object.getOwnPropertyDescriptor,qe=(e,s,t,a)=>{for(var r=a>1?void 0:a?Ut(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(r=(a?d(s,t,r):d(r))||r);return a&&r&&Ht(s,t,r),r};let J=class extends L{constructor(){super(...arguments),this.bare=!1}present(){return u()&&gs("access.stations.manage")}updated(){this.bare&&D(this,{card:"validation",summary:x().sum.validation,present:this.present()})}render(){if(!this.present())return c;const e=i("לכל עמדה: זהות, דלתות, תמונה דרך Arx ודרך WisKey, דיבור, אירועים ושעון. רץ רק כשלוחצים, ונשמר לכל ריצה.");return n`<sw-card heading=${this.bare?"":i("בדיקת קבלה לעמדות")} subheading=${this.bare?"":e}>
      ${this.bare?n`<p class="muted about">${e}</p>`:c}
      <div class="row" data-lv-card>
        <span class="muted">${i("פתיחת דלת עם עד היא פעולה נפרדת, למנהל מערכת בלבד.")}</span>
        <a href=${Ls} data-lv-card-link>${i("פתח את בדיקת הקבלה")}</a>
      </div>
    </sw-card>`}};J.styles=I`
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
    ${ce}
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
  `;qe([y({type:Boolean,reflect:!0})],J.prototype,"bare",2);J=qe([P("system-wiskey-validation-card")],J);var Xt=Object.defineProperty,Gt=Object.getOwnPropertyDescriptor,B=(e,s,t,a)=>{for(var r=a>1?void 0:a?Gt(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(r=(a?d(s,t,r):d(r))||r);return a&&r&&Xt(s,t,r),r};const Yt=820,Vt=32,qt=520;let E=class extends L{constructor(){super(...arguments),this.cards=[],this.open="",this.label="",this.inplace=!1,this.wide=!0,this.ro=null,this.watched=null,this.frame=0,this.onResize=()=>this.schedule()}schedule(){this.frame||(this.frame=requestAnimationFrame(()=>{this.frame=0,this.measure()}))}connectedCallback(){super.connectedCallback(),window.addEventListener("resize",this.onResize),typeof ResizeObserver=="function"&&(this.ro=new ResizeObserver(()=>this.schedule()),this.ro.observe(this))}disconnectedCallback(){window.removeEventListener("resize",this.onResize),this.frame&&cancelAnimationFrame(this.frame),this.frame=0,this.ro?.disconnect(),this.ro=null,this.watched=null,super.disconnectedCallback()}willUpdate(e){e.has("inplace")&&this.inplace&&(this.wide=!1)}updated(e){(e.has("open")||e.has("cards")||e.has("wide")||e.has("inplace"))&&this.measure(),this.inplace&&this.open&&e.has("open")&&e.get("open")!==void 0&&this.renderRoot.querySelector(`.head[data-fold-toggle="${CSS.escape(this.open)}"]`)?.scrollIntoView({block:"nearest"})}openBody(){return this.open?this.querySelector(`:scope > [slot="b-${CSS.escape(this.open)}"]`):null}measure(){const e=this.getBoundingClientRect().width,s=!this.inplace&&e>=Yt;if(e>0&&s!==this.wide){this.wide=s,this.dispatchEvent(new CustomEvent("fold-wide",{detail:{wide:s},bubbles:!0,composed:!0}));return}const t=this.openBody(),a=t?.firstElementChild??null;if(this.ro&&a!==this.watched&&(this.watched&&this.ro.unobserve(this.watched),a&&this.ro.observe(a),this.watched=a),!this.wide){this.style.removeProperty("--fold-room"),this.removeAttribute("tight"),t?.removeAttribute("data-fold-scroll");return}const r=Math.max(240,Math.floor(window.innerHeight-this.getBoundingClientRect().top-Vt));this.style.setProperty("--fold-room",`${r}px`),this.toggleAttribute("tight",r<qt),t&&(t.removeAttribute("data-fold-scroll"),t.scrollHeight>t.clientHeight+1&&t.setAttribute("data-fold-scroll",""))}press(e){this.dispatchEvent(new CustomEvent("fold-toggle",{detail:{id:e},bubbles:!0,composed:!0}))}render(){const e=this.cards.filter(s=>!s.hidden).length;return n`<div class="list ${this.wide?"wide":""}" role="group" aria-label=${this.label||c} data-fold-wide=${String(this.wide)}
        style=${`--fold-n:${Math.max(1,e)};--fold-span:${e+1}`}>
      ${this.cards.map(s=>n`<button type="button" class="head" ?hidden=${!!s.hidden} aria-expanded=${String(s.id===this.open)} data-fold-toggle=${s.id} title=${s.summary||c}
            @click=${()=>this.press(s.id)}>
            <span class="t">${s.title}</span>
            <span class="s" data-fold-summary=${s.id}>${s.summary||" "}</span>
            <sw-icon name="chevronDown" size=${14}></sw-icon>
          </button>
          <slot name=${`b-${s.id}`}></slot>`)}
    </div>`}};E.styles=I`
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
  `;B([y({attribute:!1})],E.prototype,"cards",2);B([y()],E.prototype,"open",2);B([y()],E.prototype,"label",2);B([y({type:Boolean,reflect:!0})],E.prototype,"inplace",2);B([p()],E.prototype,"wide",2);E=B([P("sw-fold-cards")],E);
