import{a as w,aX as f,eV as g,af as h,p as m,bg as $,q as v,A as c,b as a,jL as y,ei as _,u as k,j as S,k as o,m as x}from"./index-bjkrEUAJ.js";import"./sw-table-D5UAWIHJ.js";import"./sw-chip-DuP6EvwD.js";import{b as z}from"./bubble-chrome-wRf-BHoZ.js";import{a as C}from"./settings-BsA9TwNg.js";import{t as e}from"./system-a-BqOtLkqY.js";import"./sw-logo-art-PLtEZJxU.js";const L=["at","actor","action","decision","resource_type","resource_id","reason","request_id","permission_revision"];function O(i){const t=String(i??"");return`"${(/^[=+\-@\t\r＝＋－＠]/.test(t)?`'${t}`:t).replace(/"/g,'""')}"`}function A(i){const t=[L.join(",")];for(const s of i)t.push([s.at,s.actor_username,s.action,s.decision,s.resource_type,s.resource_id,s.reason,s.request_id,s.permission_revision].map(O).join(","));return t.join(`
`)}function j(i,t,s){const d=new Date(i);if(Number.isNaN(d.getTime()))return i;const n={day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"};try{return d.toLocaleString(s,{...n,timeZone:t})}catch{return d.toLocaleString(s,n)}}var E=Object.defineProperty,N=Object.getOwnPropertyDescriptor,l=(i,t,s,d)=>{for(var n=d>1?void 0:d?N(t,s):t,p=i.length-1,u;p>=0;p--)(u=i[p])&&(n=(d?u(t,s,n):u(n))||n);return d&&n&&E(t,s,n),n};const I=[{key:"time",label:e("זמן"),render:i=>a`14.09.2026 ${String(i.time)}`},{key:"user",label:e("משתמש"),render:i=>a`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(i.user)} size=${24}></sw-avatar>${String(i.user)}</span>`},{key:"action",label:e("פעולה"),render:i=>a`<span style=${String(i.decision).startsWith("נחסם")?"color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)":""}>${String(i.action)}</span>`},{key:"resource",label:e("פרטים"),render:i=>a`${String(i.resource)} <span style="color:var(--sw-text-3)">· ${String(i.decision)}</span>`},{key:"role",label:e("תפקיד / היקף")},{key:"rev",label:"rev",ltr:!0,render:()=>a`7`}],P=[{id:"",label:e("כל הפעולות")},{id:"rbac.",label:e("הרשאות ותפקידים")},{id:"video.",label:e("וידאו (לייב, הקלטות, ייצוא)")},{id:"events.",label:e("אירועים")},{id:"cases.",label:e("תיקים וראיות")},{id:"ha.",label:e("פעולות Home Assistant")},{id:"system.",label:e("מערכת והגדרות")},{id:"plan.",label:e("תוכניות ומפות")}],R=[{id:"",label:e("כל הערוצים")},{id:"local",label:e("מקומי (תשתית המערכת)")},{id:"remote",label:e("מרחוק (Arx)")},{id:"bearer",label:e("מרחוק · אסימון גישה")}],D=[{id:"remote_sign_ins",label:e("כניסות מרחוק")},{id:"remote_refusals",label:e("סירובים מרחוק")}],b={remote_not_allowed:e("גישה מרחוק לא הופעלה"),remote_user_inactive:e("משתמש לא פעיל"),remote_mfa_required:e("נדרש אימות דו־שלבי"),csrf_refused:e("בקשה ממקור זר"),rate_limited_ip:e("יותר מדי ניסיונות מהכתובת"),rate_limited_user:e("יותר מדי ניסיונות של המשתמש"),token_invalid:e("אסימון לא תקף"),token_revoked:e("הכניסה בוטלה"),remote_session_revoked:e("כניסה שנותקה"),remote_live_cap:e("מכסת זרמים מרחוק"),signed_out_everywhere:e("התנתקות מכל המקומות"),revoked_by_user:e("נותקה על ידי המשתמש"),revoked_by_admin:e("נותקה על ידי מנהל"),revoked_all_by_admin:e("כל הכניסות נותקו על ידי מנהל")};function U(i,t){return i?.via==="bearer"?e("מרחוק · אסימון"):i?.channel==="remote"||t.startsWith("auth.remote")?e("מרחוק"):e("מקומי")}const F={allowed:{kind:"success",label:e("הותר")},granted:{kind:"success",label:e("הוענק")},denied:{kind:"danger",label:e("נחסם")},refused:{kind:"danger",label:e("סורב")},failed:{kind:"warning",label:e("נכשל")}},T=i=>[{key:"at",label:e("זמן"),ltr:!0,render:t=>a`<span class="ltr">${j(String(t.at),i,k())}</span>`},{key:"actor",label:e("משתמש"),render:t=>a`<span style="display:inline-flex;align-items:center;gap:8px"><sw-avatar name=${String(t.actor_username??e("מערכת"))} size=${24}></sw-avatar>${String(t.actor_username??e("מערכת"))}</span>`},{key:"action",label:e("פעולה"),ltr:!0,render:t=>a`<span class="ltr">${String(t.action)}</span>`},{key:"decision",label:e("החלטה"),render:t=>{const s=F[String(t.decision)]??{kind:"neutral",label:String(t.decision)};return a`<sw-badge kind=${s.kind} label=${s.label}></sw-badge>`}},{key:"resource",label:e("משאב"),render:t=>a`${t.resource_type?a`<span style="color:var(--sw-text-3)">${String(t.resource_type)}</span> `:c}<span class="ltr">${String(t.resource_id??"")}</span>`},{key:"channel",label:e("ערוץ"),render:t=>a`<span data-audit-channel style="font-size:var(--sw-fs-xs)">${U(t.details,String(t.action))}</span>`},{key:"reason",label:e("סיבה / פרטים"),render:t=>a`${b[String(t.reason??"")]?a`${b[String(t.reason)]} <span class="ltr" style="color:var(--sw-text-3)">(${String(t.reason)})</span>`:String(t.reason??"")}${Object.keys(t.details??{}).length?a` <span style="color:var(--sw-text-3);display:inline-block;max-inline-size:100%;overflow-wrap:anywhere;direction:ltr;unicode-bidi:isolate;text-align:start" class="ltr" dir="ltr" data-audit-json>${JSON.stringify(t.details).slice(0,120)}</span>`:c}`},{key:"permission_revision",label:"rev",ltr:!0}];let r=class extends w{constructor(){super(...arguments),this.bubbleSkin=new f(this),this.rows=null,this.error="",this.family="",this.actor="",this.limit=100,this.channel="",this.view="",this.zone="Asia/Jerusalem",this.loading=!1,this.reads=new g,this.columns=null}connectedCallback(){super.connectedCallback(),h()&&(m().then(i=>{const t=i["time.zone"];typeof t=="string"&&t&&(this.zone=t)}).catch(()=>{}),this.load())}disconnectedCallback(){super.disconnectedCallback(),this.reads.cancel()}columnsFor(i){return this.columns?.zone!==i&&(this.columns={zone:i,value:T(i)}),this.columns.value}async load(){const i=this.reads.begin();this.loading=!0;try{const t=new URLSearchParams({prefix:this.family,limit:String(this.limit)});this.actor.trim()&&t.set("actor",this.actor.trim()),this.channel&&t.set("channel",this.channel),this.view&&t.set("view",this.view);const s=await $(`/audit?${t.toString()}`);if(!i())return;this.rows=s.rows,this.error=""}catch(t){if(!i())return;this.error=v(t),this.rows=[]}finally{i()&&(this.loading=!1)}}exportCsv(){if(this.loading)return;const i=this.rows??[],t=new Blob(["\uFEFF"+A(i)],{type:"text/csv;charset=utf-8"}),s=document.createElement("a");s.href=URL.createObjectURL(t),s.download=`audit-${new Date().toISOString().slice(0,10)}.csv`,s.click(),setTimeout(()=>URL.revokeObjectURL(s.href),2e3)}renderApi(){const i=this.rows;return a`
      <sw-page crumbs=${e("הגדרות")} heading=${e("יומן אודיט")} subheading=${e("מי צפה, שינה, ייצא או שלח פעולה · משתמש, פעולה, החלטה, משאב, סיבה ומספר בקשה · אין סיסמאות או טוקנים ביומן")}>
        <sw-button slot="actions" icon="download" ?disabled=${!i?.length||this.loading} @click=${()=>this.exportCsv()}>${e("ייצוא CSV")}</sw-button>
        <div class="filters" data-audit-filters>
          <sw-field><select aria-label=${e("פעולה")} .value=${this.family} @change=${t=>{this.family=t.target.value,this.load()}}>${P.map(t=>a`<option value=${t.id} ?selected=${t.id===this.family}>${t.label}</option>`)}</select></sw-field>
          <sw-field><select aria-label=${e("ערוץ")} data-audit-channel-filter .value=${this.channel} @change=${t=>{this.channel=t.target.value,this.load()}}>${R.map(t=>a`<option value=${t.id} ?selected=${t.id===this.channel}>${t.label}</option>`)}</select></sw-field>
          ${D.map(t=>a`<sw-chip icon=${t.id==="remote_refusals"?"shield":"user"} data-audit-view=${t.id} aria-pressed=${this.view===t.id?"true":"false"} ?selected=${this.view===t.id} @click=${()=>{this.view=this.view===t.id?"":t.id,this.load()}}>${t.label}</sw-chip>`)}
          <sw-field><input type="search" placeholder=${e("שם משתמש")} aria-label=${e("משתמש")} .value=${this.actor} @change=${t=>{this.actor=t.target.value,this.load()}} /></sw-field>
          <sw-field><select aria-label=${e("כמות")} @change=${t=>{this.limit=Number(t.target.value),this.load()}}>${[100,250,500].map(t=>a`<option value=${t} ?selected=${t===this.limit}>${e("{n} אחרונות",{n:t})}</option>`)}</select></sw-field>
          <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>${e("רענון")}</sw-button>
        </div>
        ${this.error?a`<sw-state-panel state="error" heading=${e("יומן האודיט לא נטען")} hint=${this.error}></sw-state-panel>`:c}
        ${i===null?a`<sw-state-panel state="loading" heading=${e("טוען יומן…")}></sw-state-panel>`:i.length?a`<sw-table data-audit-table .columns=${this.columnsFor(this.zone)} .rows=${i}></sw-table>`:this.error?c:a`<sw-state-panel icon="filter" state="empty" heading=${e("אין רשומות לסינון הזה")} hint=${e("נסה משפחת פעולות אחרת או נקה את שם המשתמש")}></sw-state-panel>`}
        <div class="pager"><span>${i?e("מציג {n} רשומות אחרונות · צפייה ממושכת נרשמת כ־start/stop",{n:i.length}):""}</span></div>
      </sw-page>
    `}render(){return h()?this.renderApi():a`
      <sw-page crumbs=${e("הגדרות")} heading=${e("יומן אודיט")} subheading=${e("מי צפה, שינה, ייצא או שלח פעולה · משתמש, תפקיד והיקף, החלטה, מספר בקשה · נתוני הדגמה")}>
        <sw-button slot="actions" icon="download">${e("ייצוא")}</sw-button>
        <div class="filters">
          <sw-field><select aria-label=${e("פעולה")}><option>${e("כל הפעולות")}</option><option>${e("צפייה")}</option><option>${e("שינוי")}</option><option>${e("ייצוא")}</option><option>${e("פעולת HA")}</option></select></sw-field>
          <sw-field><select aria-label=${e("משתמש")}><option>${e("כל המשתמשים")}</option></select></sw-field>
          <sw-field><select aria-label=${e("אתר")}><option>${e("כל האתרים")}</option></select></sw-field>
          <sw-field><input type="date" lang=${_()} value="2026-09-14" data-ltr aria-label=${e("תאריך")} /></sw-field>
          <sw-chip icon="clock">${e("שמירה: 180 יום")}</sw-chip>
        </div>
        <sw-table .columns=${I} .rows=${y}></sw-table>
        <div class="pager">
          <span>${e("מציג 1–7 מתוך 128 · אין סיסמאות או טוקנים באודיט; צפייה ממושכת נרשמת כ־start/stop")}</span>
          <span class="pages"><button aria-label=${e("קודם")}><sw-icon name="chevron" size=${11} flip></sw-icon></button><button class="on">1</button><button>2</button><button>3</button><button>4</button><button>5</button><button aria-label=${e("הבא")}><sw-icon name="chevron" size=${11}></sw-icon></button></span>
        </div>
      </sw-page>
    `}};r.styles=[C,S`
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
  `,z];l([o()],r.prototype,"rows",2);l([o()],r.prototype,"error",2);l([o()],r.prototype,"family",2);l([o()],r.prototype,"actor",2);l([o()],r.prototype,"limit",2);l([o()],r.prototype,"channel",2);l([o()],r.prototype,"view",2);l([o()],r.prototype,"zone",2);l([o()],r.prototype,"loading",2);r=l([x("system-audit")],r);export{r as SystemAudit};
