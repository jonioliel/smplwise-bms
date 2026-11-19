import{i as w,aL as $,a2 as h,b5 as g,n as f,A as p,eE as e,b as i,fT as m,ek as v,u as y,aU as _,g as k,j as o,k as x}from"./index-rXjlW4bK.js";import"./sw-table-BkAxAukF.js";import"./sw-chip-DbEqThVX.js";import{b as S}from"./settings-x5Mc4jJH.js";import"./sw-logo-art-PLtEZJxU.js";var z=Object.defineProperty,O=Object.getOwnPropertyDescriptor,l=(t,s,d,c)=>{for(var r=c>1?void 0:c?O(s,d):s,a=t.length-1,u;a>=0;a--)(u=t[a])&&(r=(c?u(s,d,r):u(r))||r);return c&&r&&z(s,d,r),r};const E=[{key:"time",label:e("זמן"),render:t=>i`14.09.2026 ${String(t.time)}`},{key:"user",label:e("משתמש"),render:t=>i`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(t.user)} size=${24}></sw-avatar>${String(t.user)}</span>`},{key:"action",label:e("פעולה"),render:t=>i`<span style=${String(t.decision).startsWith("נחסם")?"color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)":""}>${String(t.action)}</span>`},{key:"resource",label:e("פרטים"),render:t=>i`${String(t.resource)} <span style="color:var(--sw-text-3)">· ${String(t.decision)}</span>`},{key:"role",label:e("תפקיד / היקף")},{key:"rev",label:"rev",ltr:!0,render:()=>i`7`}],L=[{id:"",label:e("כל הפעולות")},{id:"rbac.",label:e("הרשאות ותפקידים")},{id:"video.",label:e("וידאו (לייב, הקלטות, ייצוא)")},{id:"events.",label:e("אירועים")},{id:"cases.",label:e("תיקים וראיות")},{id:"ha.",label:e("פעולות Home Assistant")},{id:"system.",label:e("מערכת והגדרות")},{id:"plan.",label:e("תוכניות ומפות")}],j=[{id:"",label:e("כל הערוצים")},{id:"local",label:e("מקומי (תשתית המערכת)")},{id:"remote",label:e("מרחוק (Arx)")},{id:"bearer",label:e("מרחוק · אסימון גישה")}],A=[{id:"remote_sign_ins",label:e("כניסות מרחוק")},{id:"remote_refusals",label:e("סירובים מרחוק")}],b={remote_not_allowed:e("גישה מרחוק לא הופעלה"),remote_user_inactive:e("משתמש לא פעיל"),remote_mfa_required:e("נדרש אימות דו־שלבי"),csrf_refused:e("בקשה ממקור זר"),rate_limited_ip:e("יותר מדי ניסיונות מהכתובת"),rate_limited_user:e("יותר מדי ניסיונות של המשתמש"),token_invalid:e("אסימון לא תקף"),token_revoked:e("הכניסה בוטלה"),remote_session_revoked:e("כניסה שנותקה"),remote_live_cap:e("מכסת זרמים מרחוק"),signed_out_everywhere:e("התנתקות מכל המקומות"),revoked_by_user:e("נותקה על ידי המשתמש"),revoked_by_admin:e("נותקה על ידי מנהל"),revoked_all_by_admin:e("כל הכניסות נותקו על ידי מנהל")};function C(t,s){return t?.via==="bearer"?e("מרחוק · אסימון"):t?.channel==="remote"||s.startsWith("auth.remote")?e("מרחוק"):e("מקומי")}const P={allowed:{kind:"success",label:e("הותר")},granted:{kind:"success",label:e("הוענק")},denied:{kind:"danger",label:e("נחסם")},refused:{kind:"danger",label:e("סורב")},failed:{kind:"warning",label:e("נכשל")}},R=[{key:"at",label:e("זמן"),ltr:!0,render:t=>i`<span class="ltr">${new Date(String(t.at)).toLocaleString(y(),{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>`},{key:"actor",label:e("משתמש"),render:t=>i`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(t.actor_username??e("מערכת"))} size=${24}></sw-avatar>${String(t.actor_username??e("מערכת"))}</span>`},{key:"action",label:e("פעולה"),ltr:!0,render:t=>i`<span class="ltr">${String(t.action)}</span>`},{key:"decision",label:e("החלטה"),render:t=>{const s=P[String(t.decision)]??{kind:"neutral",label:String(t.decision)};return i`<sw-badge kind=${s.kind} label=${s.label}></sw-badge>`}},{key:"resource",label:e("משאב"),render:t=>i`${t.resource_type?i`<span style="color:var(--sw-text-3)">${String(t.resource_type)}</span> `:p}<span class="ltr">${String(t.resource_id??"")}</span>`},{key:"channel",label:e("ערוץ"),render:t=>i`<span data-audit-channel style="font-size:var(--sw-fs-xs)">${C(t.details,String(t.action))}</span>`},{key:"reason",label:e("סיבה / פרטים"),render:t=>i`${b[String(t.reason??"")]?i`${b[String(t.reason)]} <span class="ltr" style="color:var(--sw-text-3)">(${String(t.reason)})</span>`:String(t.reason??"")}${Object.keys(t.details??{}).length?i` <span style="color:var(--sw-text-3);display:inline-block;max-inline-size:100%;overflow-wrap:anywhere;direction:ltr;unicode-bidi:isolate;text-align:start" class="ltr" dir="ltr" data-audit-json>${JSON.stringify(t.details).slice(0,120)}</span>`:p}`},{key:"permission_revision",label:"rev",ltr:!0}];let n=class extends w{constructor(){super(...arguments),this.bubbleSkin=new $(this),this.rows=null,this.error="",this.family="",this.actor="",this.limit=100,this.channel="",this.view=""}connectedCallback(){super.connectedCallback(),h()&&this.load()}async load(){try{const t=new URLSearchParams({prefix:this.family,limit:String(this.limit)});this.actor.trim()&&t.set("actor",this.actor.trim()),this.channel&&t.set("channel",this.channel),this.view&&t.set("view",this.view);const s=await g(`/audit?${t.toString()}`);this.rows=s.rows,this.error=""}catch(t){this.error=f(t),this.rows=[]}}exportCsv(){const t=this.rows??[],s=a=>`"${String(a??"").replace(/"/g,'""')}"`,d=[["at","actor","action","decision","resource_type","resource_id","reason","request_id","permission_revision"].join(",")];for(const a of t)d.push([a.at,a.actor_username,a.action,a.decision,a.resource_type,a.resource_id,a.reason,a.request_id,a.permission_revision].map(s).join(","));const c=new Blob(["\uFEFF"+d.join(`
`)],{type:"text/csv;charset=utf-8"}),r=document.createElement("a");r.href=URL.createObjectURL(c),r.download=`audit-${new Date().toISOString().slice(0,10)}.csv`,r.click(),setTimeout(()=>URL.revokeObjectURL(r.href),2e3)}renderApi(){const t=this.rows;return i`
      <sw-page crumbs=${e("הגדרות")} heading=${e("יומן אודיט")} subheading=${e("מי צפה, שינה, ייצא או שלח פעולה · משתמש, פעולה, החלטה, משאב, סיבה ומספר בקשה · אין סיסמאות או טוקנים ביומן")}>
        <sw-button slot="actions" icon="download" ?disabled=${!t?.length} @click=${()=>this.exportCsv()}>${e("ייצוא CSV")}</sw-button>
        <div class="filters" data-audit-filters>
          <sw-field><select aria-label=${e("פעולה")} .value=${this.family} @change=${s=>{this.family=s.target.value,this.load()}}>${L.map(s=>i`<option value=${s.id} ?selected=${s.id===this.family}>${s.label}</option>`)}</select></sw-field>
          <sw-field><select aria-label=${e("ערוץ")} data-audit-channel-filter .value=${this.channel} @change=${s=>{this.channel=s.target.value,this.load()}}>${j.map(s=>i`<option value=${s.id} ?selected=${s.id===this.channel}>${s.label}</option>`)}</select></sw-field>
          ${A.map(s=>i`<sw-chip icon=${s.id==="remote_refusals"?"shield":"user"} data-audit-view=${s.id} aria-pressed=${this.view===s.id?"true":"false"} ?selected=${this.view===s.id} @click=${()=>{this.view=this.view===s.id?"":s.id,this.load()}}>${s.label}</sw-chip>`)}
          <sw-field><input type="search" placeholder=${e("שם משתמש")} aria-label=${e("משתמש")} .value=${this.actor} @change=${s=>{this.actor=s.target.value,this.load()}} /></sw-field>
          <sw-field><select aria-label=${e("כמות")} @change=${s=>{this.limit=Number(s.target.value),this.load()}}>${[100,250,500].map(s=>i`<option value=${s} ?selected=${s===this.limit}>${e("{n} אחרונות",{n:s})}</option>`)}</select></sw-field>
          <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>${e("רענון")}</sw-button>
        </div>
        ${this.error?i`<sw-state-panel state="error" heading=${e("יומן האודיט לא נטען")} hint=${this.error}></sw-state-panel>`:p}
        ${t===null?i`<sw-state-panel state="loading" heading=${e("טוען יומן…")}></sw-state-panel>`:t.length?i`<sw-table data-audit-table .columns=${R} .rows=${t}></sw-table>`:this.error?p:i`<sw-state-panel icon="filter" state="empty" heading=${e("אין רשומות לסינון הזה")} hint=${e("נסה משפחת פעולות אחרת או נקה את שם המשתמש")}></sw-state-panel>`}
        <div class="pager"><span>${t?e("מציג {n} רשומות אחרונות · צפייה ממושכת נרשמת כ־start/stop",{n:t.length}):""}</span></div>
      </sw-page>
    `}render(){return h()?this.renderApi():i`
      <sw-page crumbs=${e("הגדרות")} heading=${e("יומן אודיט")} subheading=${e("מי צפה, שינה, ייצא או שלח פעולה · משתמש, תפקיד והיקף, החלטה, מספר בקשה · נתוני הדגמה")}>
        <sw-button slot="actions" icon="download">${e("ייצוא")}</sw-button>
        <div class="filters">
          <sw-field><select aria-label=${e("פעולה")}><option>${e("כל הפעולות")}</option><option>${e("צפייה")}</option><option>${e("שינוי")}</option><option>${e("ייצוא")}</option><option>${e("פעולת HA")}</option></select></sw-field>
          <sw-field><select aria-label=${e("משתמש")}><option>${e("כל המשתמשים")}</option></select></sw-field>
          <sw-field><select aria-label=${e("אתר")}><option>${e("כל האתרים")}</option></select></sw-field>
          <sw-field><input type="date" lang=${v()} value="2026-09-14" data-ltr aria-label=${e("תאריך")} /></sw-field>
          <sw-chip icon="clock">${e("שמירה: 180 יום")}</sw-chip>
        </div>
        <sw-table .columns=${E} .rows=${m}></sw-table>
        <div class="pager">
          <span>${e("מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop")}</span>
          <span class="pages"><button aria-label=${e("קודם")}><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label=${e("הבא")}><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `}};n.styles=[S,k`
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
  `,_];l([o()],n.prototype,"rows",2);l([o()],n.prototype,"error",2);l([o()],n.prototype,"family",2);l([o()],n.prototype,"actor",2);l([o()],n.prototype,"limit",2);l([o()],n.prototype,"channel",2);l([o()],n.prototype,"view",2);n=l([x("system-audit")],n);export{n as SystemAudit};
