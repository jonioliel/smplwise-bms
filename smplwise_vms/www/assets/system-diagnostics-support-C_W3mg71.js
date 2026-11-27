import{bs as u,bu as m,br as v,bt as x,by as g,j as $,k as l,a as y,aX as z,Ca as R,c as h,q as O,A as b,Cb as L,b as r,Cc as _,e2 as k,m as E}from"./index-CoJbESCx.js";import{c as T}from"./confirm-dialog-Kd4DkskJ.js";import{T as N}from"./toast-controller-BPX0Tkjm.js";import"./sw-logo-art-PLtEZJxU.js";const w={title:"ייצוא יומן מצונזר",subtitle:"קובץ לבדיקת תקלות: שורות היומן האחרונות עם מזהה הבקשה של כל שורה, בדיקות המערכת והמלצה לכל בעיה.",window:"טווח זמן",level:"רמת פירוט",o15:"15 דקות",o60:"שעה (ברירת מחדל)",o180:"3 שעות",o360:"6 שעות",o720:"12 שעות",o1440:"24 שעות",w15:"ב־15 הדקות האחרונות",w60:"בשעה האחרונה",w180:"ב־3 השעות האחרונות",w360:"ב־6 השעות האחרונות",w720:"ב־12 השעות האחרונות",w1440:"ב־24 השעות האחרונות",oINFO:"מידע ומעלה (ברירת מחדל)",oWARNING:"אזהרות ושגיאות",oERROR:"שגיאות בלבד",pINFO:"מידע, אזהרות ושגיאות",pWARNING:"אזהרות ושגיאות",pERROR:"שגיאות בלבד",hidden:"מוסתרים: סיסמאות, אסימונים, פרטי כניסה בכתובות, כתובות רשת, מספרים סידוריים, טלפונים ודוא״ל. לא נכללים וידאו, תמונות או תוכניות.",export:"ייצוא היומן",exporting:"מייצא…",confirmTitle:"לייצא את היומן?",confirmBody:"הקובץ יכלול את שורות היומן שנכתבו {window} ({level}) ואת בדיקות המערכת, אחרי הסתרת סיסמאות, אסימונים, כתובות, מספרים סידוריים ופרטים אישיים. אין בו וידאו, תמונות או תוכניות. הייצוא נרשם ביומן הביקורת.",confirm:"אישור והורדה",cancel:"ביטול",done:"הקובץ {name} הורד",cancelled:"הייצוא בוטל; לא נוצר קובץ",forbidden:"רק מי שמורשה לנהל את הגדרות המערכת יכול לייצא את היומן.",consent:"השרת לא קיבל את האישור. נסו שוב ואשרו את הייצוא.",failed:"הייצוא נכשל: {error}",retry:"נסו שוב"},f=u("en","i18n/log-export","en");m("i18n/log-export",{he:w,en:f});const e=(t,s)=>v((x(["en"])==="en"?f[t]:void 0)??w[t],s);var C=Object.defineProperty,I=Object.getOwnPropertyDescriptor,a=(t,s,d,n)=>{for(var o=n>1?void 0:n?I(s,d):s,c=t.length-1,p;c>=0;c--)(p=t[c])&&(o=(n?p(s,d,o):p(o))||o);return n&&o&&C(s,d,o),o};let i=class extends y{constructor(){super(...arguments),this.skin=new z(this),this.minutes=60,this.level="INFO",this.busy=!1,this.error="",this.toast=new N(this,{ms:3200})}async run(){if(this.busy)return;if(!await T({heading:e("confirmTitle"),body:e("confirmBody",{window:e(`w${this.minutes}`),level:e(`p${this.level}`)}),confirmLabel:e("confirm"),cancelLabel:e("cancel")})){this.toast.show(e("cancelled"));return}this.busy=!0,this.error="";try{const s=await R(this.minutes,this.level);this.toast.show(e("done",{name:s}))}catch(s){this.error=s instanceof h&&s.status===403?e("forbidden"):s instanceof h&&s.body.code==="consent_required"?e("consent"):e("failed",{error:O(s)})}finally{this.busy=!1}}render(){return r`<sw-card heading=${e("title")} subheading=${e("subtitle")} data-log-export>
      <div class="opts">
        <sw-field label=${e("window")}><select data-log-window ?disabled=${this.busy} @change=${t=>{this.minutes=Number(t.target.value),this.error=""}}>
          ${L.map(t=>r`<option value=${t} .selected=${t===this.minutes}>${e(`o${t}`)}</option>`)}</select></sw-field>
        <sw-field label=${e("level")}><select data-log-level ?disabled=${this.busy} @change=${t=>{this.level=t.target.value,this.error=""}}>
          ${_.map(t=>r`<option value=${t} .selected=${t===this.level}>${e(`o${t}`)}</option>`)}</select></sw-field>
      </div>
      <div class="hidden">${e("hidden")}</div>
      <div class="actions">
        <sw-button size="sm" icon="download" data-log-export-go ?disabled=${this.busy} @click=${()=>void this.run()}>${this.busy?e("exporting"):e("export")}</sw-button>
        ${this.error?r`<span class="err" role="alert" data-log-export-error>${this.error}</span><sw-button size="sm" variant="ghost" data-log-export-retry @click=${()=>void this.run()}>${e("retry")}</sw-button>`:b}
      </div>
      ${this.toast.text?r`<div class="toast" role="status" data-log-export-toast ${k()}>${this.toast.text}</div>`:b}
    </sw-card>`}};i.styles=[g,$`
    :host {
      display: block;
    }
    .opts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
      gap: 8px 12px;
    }
    .opts select {
      inline-size: 100%;
      box-sizing: border-box;
    }
    .hidden {
      margin-block: 10px 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-block-start: 12px;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    /* centred by auto margins (not a transform), so the same rule holds in the RTL and the LTR interface */
    .toast {
      position: fixed;
      inset-block-end: 24px;
      inset-inline: 16px;
      margin-inline: auto;
      inline-size: fit-content;
      box-sizing: border-box;
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      padding: 10px 16px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-md);
      z-index: var(--sw-z-toast);
      box-shadow: var(--sw-shadow-3);
      max-inline-size: calc(100vw - 32px);
      overflow-wrap: anywhere;
    }
    @media (max-width: 767px) {
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom));
      }
    }
    :host([data-skin='bubble']) .opts select {
      min-block-size: 44px;
    }
  `];a([l()],i.prototype,"minutes",2);a([l()],i.prototype,"level",2);a([l()],i.prototype,"busy",2);a([l()],i.prototype,"error",2);i=a([E("health-log-export")],i);
