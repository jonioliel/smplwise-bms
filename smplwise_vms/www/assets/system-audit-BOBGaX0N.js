import{a as w,S as h,i as u,g,R as v,A as c,e as s,t5 as m,bV as f,qH as $,C as y,E as _,G as l,H as k}from"./index-BJCfUqyq.js";import"./sw-table-BRSPaajE.js";import"./sw-chip-B5_aZ_-s.js";import"./sw-logo-art-Va6y_cIM.js";var S=Object.defineProperty,x=Object.getOwnPropertyDescriptor,n=(e,t,o,d)=>{for(var a=d>1?void 0:d?x(t,o):t,i=e.length-1,p;i>=0;i--)(p=e[i])&&(a=(d?p(t,o,a):p(a))||a);return d&&a&&S(t,o,a),a};const O=[{key:"time",label:"זמן",render:e=>s`14.09.2026 ${String(e.time)}`},{key:"user",label:"משתמש",render:e=>s`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(e.user)} size=${24}></sw-avatar>${String(e.user)}</span>`},{key:"action",label:"פעולה",render:e=>s`<span style=${String(e.decision).startsWith("נחסם")?"color:var(--sw-danger);font-weight:600":""}>${String(e.action)}</span>`},{key:"resource",label:"פרטים",render:e=>s`${String(e.resource)} <span style="color:var(--sw-text-3)">· ${String(e.decision)}</span>`},{key:"role",label:"תפקיד / היקף"},{key:"rev",label:"rev",ltr:!0,render:()=>s`7`}],z=[{id:"",label:"כל הפעולות"},{id:"rbac.",label:"הרשאות ותפקידים"},{id:"video.",label:"וידאו (לייב, הקלטות, ייצוא)"},{id:"events.",label:"אירועים"},{id:"cases.",label:"תיקים וראיות"},{id:"ha.",label:"פעולות Home Assistant"},{id:"system.",label:"מערכת והגדרות"},{id:"plan.",label:"תוכניות ומפות"}],C=[{id:"",label:"כל הערוצים"},{id:"local",label:"מקומי (תשתית המערכת)"},{id:"remote",label:"מרחוק (Arx)"},{id:"bearer",label:"מרחוק · אסימון גישה"}],E=[{id:"remote_sign_ins",label:"כניסות מרחוק"},{id:"remote_refusals",label:"סירובים מרחוק"}],b={remote_not_allowed:"גישה מרחוק לא הופעלה",remote_user_inactive:"משתמש לא פעיל",remote_mfa_required:"נדרש אימות דו־שלבי",csrf_refused:"בקשה ממקור זר",rate_limited_ip:"יותר מדי ניסיונות מהכתובת",rate_limited_user:"יותר מדי ניסיונות של המשתמש",token_invalid:"אסימון לא תקף",token_revoked:"הכניסה בוטלה",remote_session_revoked:"כניסה שנותקה",remote_live_cap:"מכסת זרמים מרחוק",signed_out_everywhere:"התנתקות מכל המקומות",revoked_by_user:"נותקה על ידי המשתמש",revoked_by_admin:"נותקה על ידי מנהל",revoked_all_by_admin:"כל הכניסות נותקו על ידי מנהל"};function A(e,t){return e?.via==="bearer"?"מרחוק · אסימון":e?.channel==="remote"||t.startsWith("auth.remote")?"מרחוק":"מקומי"}const j={allowed:{kind:"success",label:"הותר"},granted:{kind:"success",label:"הוענק"},denied:{kind:"danger",label:"נחסם"},refused:{kind:"danger",label:"סורב"},failed:{kind:"warning",label:"נכשל"}},L=[{key:"at",label:"זמן",ltr:!0,render:e=>s`<span class="ltr">${new Date(String(e.at)).toLocaleString("he-IL",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>`},{key:"actor",label:"משתמש",render:e=>s`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(e.actor_username??"מערכת")} size=${24}></sw-avatar>${String(e.actor_username??"מערכת")}</span>`},{key:"action",label:"פעולה",ltr:!0,render:e=>s`<span class="ltr">${String(e.action)}</span>`},{key:"decision",label:"החלטה",render:e=>{const t=j[String(e.decision)]??{kind:"neutral",label:String(e.decision)};return s`<sw-badge kind=${t.kind} label=${t.label}></sw-badge>`}},{key:"resource",label:"משאב",render:e=>s`${e.resource_type?s`<span style="color:var(--sw-text-3)">${String(e.resource_type)}</span> `:c}<span class="ltr">${String(e.resource_id??"")}</span>`},{key:"channel",label:"ערוץ",render:e=>s`<span data-audit-channel style="font-size:var(--sw-fs-xs)">${A(e.details,String(e.action))}</span>`},{key:"reason",label:"סיבה / פרטים",render:e=>s`${b[String(e.reason??"")]?s`${b[String(e.reason)]} <span class="ltr" style="color:var(--sw-text-3)">(${String(e.reason)})</span>`:String(e.reason??"")}${Object.keys(e.details??{}).length?s` <span style="color:var(--sw-text-3);display:inline-block;max-inline-size:100%;overflow-wrap:anywhere;direction:ltr;unicode-bidi:isolate;text-align:left" class="ltr" dir="ltr" data-audit-json>${JSON.stringify(e.details).slice(0,120)}</span>`:c}`},{key:"permission_revision",label:"rev",ltr:!0}];let r=class extends w{constructor(){super(...arguments),this.bubbleSkin=new h(this),this.rows=null,this.error="",this.family="",this.actor="",this.limit=100,this.channel="",this.view=""}connectedCallback(){super.connectedCallback(),u()&&this.load()}async load(){try{const e=new URLSearchParams({prefix:this.family,limit:String(this.limit)});this.actor.trim()&&e.set("actor",this.actor.trim()),this.channel&&e.set("channel",this.channel),this.view&&e.set("view",this.view);const t=await g(`/audit?${e.toString()}`);this.rows=t.rows,this.error=""}catch(e){this.error=v(e),this.rows=[]}}exportCsv(){const e=this.rows??[],t=i=>`"${String(i??"").replace(/"/g,'""')}"`,o=[["at","actor","action","decision","resource_type","resource_id","reason","request_id","permission_revision"].join(",")];for(const i of e)o.push([i.at,i.actor_username,i.action,i.decision,i.resource_type,i.resource_id,i.reason,i.request_id,i.permission_revision].map(t).join(","));const d=new Blob(["\uFEFF"+o.join(`
`)],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(d),a.download=`audit-${new Date().toISOString().slice(0,10)}.csv`,a.click(),setTimeout(()=>URL.revokeObjectURL(a.href),2e3)}renderApi(){const e=this.rows;return s`
      <sw-page crumbs="הגדרות" heading="יומן אודיט" subheading="מי צפה, שינה, ייצא או שלח פעולה · actor, פעולה, החלטה, משאב, סיבה, request_id, permission_revision · אין סיסמאות או טוקנים ביומן">
        <sw-button slot="actions" icon="download" ?disabled=${!e?.length} @click=${()=>this.exportCsv()}>ייצוא CSV</sw-button>
        <div class="filters" data-audit-filters>
          <sw-field><select aria-label="פעולה" .value=${this.family} @change=${t=>{this.family=t.target.value,this.load()}}>${z.map(t=>s`<option value=${t.id} ?selected=${t.id===this.family}>${t.label}</option>`)}</select></sw-field>
          <sw-field><select aria-label="ערוץ" data-audit-channel-filter .value=${this.channel} @change=${t=>{this.channel=t.target.value,this.load()}}>${C.map(t=>s`<option value=${t.id} ?selected=${t.id===this.channel}>${t.label}</option>`)}</select></sw-field>
          ${E.map(t=>s`<sw-chip icon=${t.id==="remote_refusals"?"shield":"user"} data-audit-view=${t.id} aria-pressed=${this.view===t.id?"true":"false"} ?selected=${this.view===t.id} @click=${()=>{this.view=this.view===t.id?"":t.id,this.load()}}>${t.label}</sw-chip>`)}
          <sw-field><input type="search" placeholder="שם משתמש" aria-label="משתמש" .value=${this.actor} @change=${t=>{this.actor=t.target.value,this.load()}} /></sw-field>
          <sw-field><select aria-label="כמות" @change=${t=>{this.limit=Number(t.target.value),this.load()}}>${[100,250,500].map(t=>s`<option value=${t} ?selected=${t===this.limit}>${t} אחרונות</option>`)}</select></sw-field>
          <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>רענון</sw-button>
        </div>
        ${this.error?s`<sw-state-panel state="error" heading="יומן האודיט לא נטען" hint=${this.error}></sw-state-panel>`:c}
        ${e===null?s`<sw-state-panel state="loading" heading="טוען יומן…"></sw-state-panel>`:e.length?s`<sw-table data-audit-table .columns=${L} .rows=${e}></sw-table>`:this.error?c:s`<sw-state-panel icon="filter" state="empty" heading="אין רשומות לסינון הזה" hint="נסה משפחת פעולות אחרת או נקה את שם המשתמש"></sw-state-panel>`}
        <div class="pager"><span>${e?`מציג ${e.length} רשומות אחרונות · צפייה ממושכת נרשמת כ־start/stop`:""}</span></div>
      </sw-page>
    `}render(){return u()?this.renderApi():s`
      <sw-page crumbs="הגדרות" heading="יומן אודיט" subheading="מי צפה, שינה, ייצא או שלח פעולה · actor, מקור זהות, תפקיד והיקף, החלטה, request_id, permission_revision · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא</sw-button>
        <div class="filters">
          <sw-field><select aria-label="פעולה"><option>כל הפעולות</option><option>צפייה</option><option>שינוי</option><option>ייצוא</option><option>פעולת HA</option></select></sw-field>
          <sw-field><select aria-label="משתמש"><option>כל המשתמשים</option></select></sw-field>
          <sw-field><select aria-label="אתר"><option>כל האתרים</option></select></sw-field>
          <sw-field><input type="date" lang=${f()} value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
          <sw-chip icon="clock">שמירה: 180 יום</sw-chip>
        </div>
        <sw-table .columns=${O} .rows=${m}></sw-table>
        <div class="pager">
          <span>מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop</span>
          <span class="pages"><button aria-label="קודם"><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label="הבא"><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `}};r.styles=[$,_`
    .filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters sw-field {
      inline-size: 150px;
    }
    .pager {
      display: flex;
      align-items: center;
      gap: 4px;
      justify-content: space-between;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .pages {
      display: inline-flex;
      gap: 4px;
    }
    .pages button {
      inline-size: 26px;
      block-size: 26px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .pages button.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
  `,y];n([l()],r.prototype,"rows",2);n([l()],r.prototype,"error",2);n([l()],r.prototype,"family",2);n([l()],r.prototype,"actor",2);n([l()],r.prototype,"limit",2);n([l()],r.prototype,"channel",2);n([l()],r.prototype,"view",2);r=n([k("system-audit")],r);export{r as SystemAudit};
//# sourceMappingURL=system-audit-BOBGaX0N.js.map
