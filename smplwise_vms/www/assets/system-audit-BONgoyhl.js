import{a as w,aX as $,af as h,bg as f,q as g,A as p,b as s,fN as m,ei as v,u as y,j as _,k as o,m as k}from"./index-D3xHkfje.js";import"./sw-table-BASj552X.js";import"./sw-chip-C1wXYX1O.js";import{b as x}from"./bubble-chrome-DW_f3pbN.js";import{a as S}from"./settings-CBX0_39g.js";import{t as e}from"./system-a-CDuaOwuI.js";import"./sw-logo-art-PLtEZJxU.js";var z=Object.defineProperty,O=Object.getOwnPropertyDescriptor,l=(t,i,d,c)=>{for(var r=c>1?void 0:c?O(i,d):i,a=t.length-1,u;a>=0;a--)(u=t[a])&&(r=(c?u(i,d,r):u(r))||r);return c&&r&&z(i,d,r),r};const j=[{key:"time",label:e("זמן"),render:t=>s`14.09.2026 ${String(t.time)}`},{key:"user",label:e("משתמש"),render:t=>s`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(t.user)} size=${24}></sw-avatar>${String(t.user)}</span>`},{key:"action",label:e("פעולה"),render:t=>s`<span style=${String(t.decision).startsWith("נחסם")?"color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)":""}>${String(t.action)}</span>`},{key:"resource",label:e("פרטים"),render:t=>s`${String(t.resource)} <span style="color:var(--sw-text-3)">· ${String(t.decision)}</span>`},{key:"role",label:e("תפקיד / היקף")},{key:"rev",label:"rev",ltr:!0,render:()=>s`7`}],A=[{id:"",label:e("כל הפעולות")},{id:"rbac.",label:e("הרשאות ותפקידים")},{id:"video.",label:e("וידאו (לייב, הקלטות, ייצוא)")},{id:"events.",label:e("אירועים")},{id:"cases.",label:e("תיקים וראיות")},{id:"ha.",label:e("פעולות Home Assistant")},{id:"system.",label:e("מערכת והגדרות")},{id:"plan.",label:e("תוכניות ומפות")}],C=[{id:"",label:e("כל הערוצים")},{id:"local",label:e("מקומי (תשתית המערכת)")},{id:"remote",label:e("מרחוק (Arx)")},{id:"bearer",label:e("מרחוק · אסימון גישה")}],E=[{id:"remote_sign_ins",label:e("כניסות מרחוק")},{id:"remote_refusals",label:e("סירובים מרחוק")}],b={remote_not_allowed:e("גישה מרחוק לא הופעלה"),remote_user_inactive:e("משתמש לא פעיל"),remote_mfa_required:e("נדרש אימות דו־שלבי"),csrf_refused:e("בקשה ממקור זר"),rate_limited_ip:e("יותר מדי ניסיונות מהכתובת"),rate_limited_user:e("יותר מדי ניסיונות של המשתמש"),token_invalid:e("אסימון לא תקף"),token_revoked:e("הכניסה בוטלה"),remote_session_revoked:e("כניסה שנותקה"),remote_live_cap:e("מכסת זרמים מרחוק"),signed_out_everywhere:e("התנתקות מכל המקומות"),revoked_by_user:e("נותקה על ידי המשתמש"),revoked_by_admin:e("נותקה על ידי מנהל"),revoked_all_by_admin:e("כל הכניסות נותקו על ידי מנהל")};function L(t,i){return t?.via==="bearer"?e("מרחוק · אסימון"):t?.channel==="remote"||i.startsWith("auth.remote")?e("מרחוק"):e("מקומי")}const P={allowed:{kind:"success",label:e("הותר")},granted:{kind:"success",label:e("הוענק")},denied:{kind:"danger",label:e("נחסם")},refused:{kind:"danger",label:e("סורב")},failed:{kind:"warning",label:e("נכשל")}},R=[{key:"at",label:e("זמן"),ltr:!0,render:t=>s`<span class="ltr">${new Date(String(t.at)).toLocaleString(y(),{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>`},{key:"actor",label:e("משתמש"),render:t=>s`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(t.actor_username??e("מערכת"))} size=${24}></sw-avatar>${String(t.actor_username??e("מערכת"))}</span>`},{key:"action",label:e("פעולה"),ltr:!0,render:t=>s`<span class="ltr">${String(t.action)}</span>`},{key:"decision",label:e("החלטה"),render:t=>{const i=P[String(t.decision)]??{kind:"neutral",label:String(t.decision)};return s`<sw-badge kind=${i.kind} label=${i.label}></sw-badge>`}},{key:"resource",label:e("משאב"),render:t=>s`${t.resource_type?s`<span style="color:var(--sw-text-3)">${String(t.resource_type)}</span> `:p}<span class="ltr">${String(t.resource_id??"")}</span>`},{key:"channel",label:e("ערוץ"),render:t=>s`<span data-audit-channel style="font-size:var(--sw-fs-xs)">${L(t.details,String(t.action))}</span>`},{key:"reason",label:e("סיבה / פרטים"),render:t=>s`${b[String(t.reason??"")]?s`${b[String(t.reason)]} <span class="ltr" style="color:var(--sw-text-3)">(${String(t.reason)})</span>`:String(t.reason??"")}${Object.keys(t.details??{}).length?s` <span style="color:var(--sw-text-3);display:inline-block;max-inline-size:100%;overflow-wrap:anywhere;direction:ltr;unicode-bidi:isolate;text-align:start" class="ltr" dir="ltr" data-audit-json>${JSON.stringify(t.details).slice(0,120)}</span>`:p}`},{key:"permission_revision",label:"rev",ltr:!0}];let n=class extends w{constructor(){super(...arguments),this.bubbleSkin=new $(this),this.rows=null,this.error="",this.family="",this.actor="",this.limit=100,this.channel="",this.view=""}connectedCallback(){super.connectedCallback(),h()&&this.load()}async load(){try{const t=new URLSearchParams({prefix:this.family,limit:String(this.limit)});this.actor.trim()&&t.set("actor",this.actor.trim()),this.channel&&t.set("channel",this.channel),this.view&&t.set("view",this.view);const i=await f(`/audit?${t.toString()}`);this.rows=i.rows,this.error=""}catch(t){this.error=g(t),this.rows=[]}}exportCsv(){const t=this.rows??[],i=a=>`"${String(a??"").replace(/"/g,'""')}"`,d=[["at","actor","action","decision","resource_type","resource_id","reason","request_id","permission_revision"].join(",")];for(const a of t)d.push([a.at,a.actor_username,a.action,a.decision,a.resource_type,a.resource_id,a.reason,a.request_id,a.permission_revision].map(i).join(","));const c=new Blob(["\uFEFF"+d.join(`
`)],{type:"text/csv;charset=utf-8"}),r=document.createElement("a");r.href=URL.createObjectURL(c),r.download=`audit-${new Date().toISOString().slice(0,10)}.csv`,r.click(),setTimeout(()=>URL.revokeObjectURL(r.href),2e3)}renderApi(){const t=this.rows;return s`
      <sw-page crumbs=${e("הגדרות")} heading=${e("יומן אודיט")} subheading=${e("מי צפה, שינה, ייצא או שלח פעולה · משתמש, פעולה, החלטה, משאב, סיבה ומספר בקשה · אין סיסמאות או טוקנים ביומן")}>
        <sw-button slot="actions" icon="download" ?disabled=${!t?.length} @click=${()=>this.exportCsv()}>${e("ייצוא CSV")}</sw-button>
        <div class="filters" data-audit-filters>
          <sw-field><select aria-label=${e("פעולה")} .value=${this.family} @change=${i=>{this.family=i.target.value,this.load()}}>${A.map(i=>s`<option value=${i.id} ?selected=${i.id===this.family}>${i.label}</option>`)}</select></sw-field>
          <sw-field><select aria-label=${e("ערוץ")} data-audit-channel-filter .value=${this.channel} @change=${i=>{this.channel=i.target.value,this.load()}}>${C.map(i=>s`<option value=${i.id} ?selected=${i.id===this.channel}>${i.label}</option>`)}</select></sw-field>
          ${E.map(i=>s`<sw-chip icon=${i.id==="remote_refusals"?"shield":"user"} data-audit-view=${i.id} aria-pressed=${this.view===i.id?"true":"false"} ?selected=${this.view===i.id} @click=${()=>{this.view=this.view===i.id?"":i.id,this.load()}}>${i.label}</sw-chip>`)}
          <sw-field><input type="search" placeholder=${e("שם משתמש")} aria-label=${e("משתמש")} .value=${this.actor} @change=${i=>{this.actor=i.target.value,this.load()}} /></sw-field>
          <sw-field><select aria-label=${e("כמות")} @change=${i=>{this.limit=Number(i.target.value),this.load()}}>${[100,250,500].map(i=>s`<option value=${i} ?selected=${i===this.limit}>${e("{n} אחרונות",{n:i})}</option>`)}</select></sw-field>
          <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>${e("רענון")}</sw-button>
        </div>
        ${this.error?s`<sw-state-panel state="error" heading=${e("יומן האודיט לא נטען")} hint=${this.error}></sw-state-panel>`:p}
        ${t===null?s`<sw-state-panel state="loading" heading=${e("טוען יומן…")}></sw-state-panel>`:t.length?s`<sw-table data-audit-table .columns=${R} .rows=${t}></sw-table>`:this.error?p:s`<sw-state-panel icon="filter" state="empty" heading=${e("אין רשומות לסינון הזה")} hint=${e("נסה משפחת פעולות אחרת או נקה את שם המשתמש")}></sw-state-panel>`}
        <div class="pager"><span>${t?e("מציג {n} רשומות אחרונות · צפייה ממושכת נרשמת כ־start/stop",{n:t.length}):""}</span></div>
      </sw-page>
    `}render(){return h()?this.renderApi():s`
      <sw-page crumbs=${e("הגדרות")} heading=${e("יומן אודיט")} subheading=${e("מי צפה, שינה, ייצא או שלח פעולה · משתמש, תפקיד והיקף, החלטה, מספר בקשה · נתוני הדגמה")}>
        <sw-button slot="actions" icon="download">${e("ייצוא")}</sw-button>
        <div class="filters">
          <sw-field><select aria-label=${e("פעולה")}><option>${e("כל הפעולות")}</option><option>${e("צפייה")}</option><option>${e("שינוי")}</option><option>${e("ייצוא")}</option><option>${e("פעולת HA")}</option></select></sw-field>
          <sw-field><select aria-label=${e("משתמש")}><option>${e("כל המשתמשים")}</option></select></sw-field>
          <sw-field><select aria-label=${e("אתר")}><option>${e("כל האתרים")}</option></select></sw-field>
          <sw-field><input type="date" lang=${v()} value="2026-09-14" data-ltr aria-label=${e("תאריך")} /></sw-field>
          <sw-chip icon="clock">${e("שמירה: 180 יום")}</sw-chip>
        </div>
        <sw-table .columns=${j} .rows=${m}></sw-table>
        <div class="pager">
          <span>${e("מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop")}</span>
          <span class="pages"><button aria-label=${e("קודם")}><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label=${e("הבא")}><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `}};n.styles=[S,_`
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
    /* POLISH4-WP7 (D16): the phone layout. The filters share the width two to a line (the search field and the refresh key take a whole
       line), the table is the card list sw-table gives a phone, and the footer line wraps under its pager. */
    @media (max-width: 767px) {
      .filters {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .filters sw-field {
        inline-size: auto;
        min-inline-size: 0;
      }
      .filters sw-field:has(input[type='search']),
      .filters sw-field:has(input[type='date']),
      .filters > sw-button {
        grid-column: 1 / -1;
      }
      .pager {
        flex-wrap: wrap;
      }
    }
  `,x];l([o()],n.prototype,"rows",2);l([o()],n.prototype,"error",2);l([o()],n.prototype,"family",2);l([o()],n.prototype,"actor",2);l([o()],n.prototype,"limit",2);l([o()],n.prototype,"channel",2);l([o()],n.prototype,"view",2);n=l([k("system-audit")],n);export{n as SystemAudit};
