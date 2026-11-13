import{i as P,a7 as j,g as L,gN as xe,C as ke,E as H,G as c,a as M,S as ce,j as J,Y as g,A as o,e as t,q as Pe,ct as Oe,H as N,F as X,a8 as O,um as l,un as Ee,bW as q,ac as Ue,uo as Le,up as je,uq as W,ur as De,al as ze,us as Te,ut as Se,R as F,aC as Ie,e3 as He,bj as Me,uu as oe,uv as Ae,uw as Ce,be as S,r as Ne,aZ as Ge,ux as qe,fe as ee,uy as We,uz as Be}from"./index-BbQM-cPX.js";import"./system-alarm-BLpIiA8G.js";import{l as le}from"./live-BYwxLxf5.js";import"./sw-table-DnDK_Vyk.js";import"./sw-steps-COrAfsUR.js";import"./sw-chip-LaKUjmzQ.js";import"./system-doors--YLbUCiW.js";import{fmtWhen as k,listUsers as Ke,listRoles as B,listGroups as Fe,listAudit as pe,groupImpact as Ve,bindGroup as Ye,createBinding as he,unbindGroup as Je,revokeBinding as Ze,syncDirectory as Qe,createGroup as Xe,setGroupMembers as es,renameGroup as ss,deleteGroup as ts,previewAccess as as,setRemoteAccess as is,SYNC_LABEL as ue,previewRole as rs,updateRole as ns,createRole as os,deleteRole as ls,setDelegation as ds,ACTION_LABEL as cs}from"./access-CnSd90N9.js";import{e as ps}from"./styles-BT2SQMY8.js";import{b as hs}from"./access-VhhPAQtF.js";import{o as us,h as ms,y as ws,z as vs,A as gs}from"./home-api-DedWJtpI.js";import"./sw-view-switch-5B8E8Ffs.js";import"./sw-logo-art-Va6y_cIM.js";const D={users:[{ha_user_id:"demo-1",username:"dana",display_name:"דנה לוי",role_id:"viewer",role_name:"צופה",scope_type:"installation",scope_id:"*",scope_name:"כל ההתקנה",state:"active",repair:null,person:!0,created_at:"2026-10-16T08:00:00Z",created_by_name:"מנהל",is_self:!1},{ha_user_id:"demo-2",username:"yossi",display_name:"יוסי כהן",role_id:"operator",role_name:"מפעיל",scope_type:"installation",scope_id:"*",scope_name:"כל ההתקנה",state:"inactive",repair:null,person:!0,created_at:"2026-10-15T08:00:00Z",created_by_name:"מנהל",is_self:!1}],can_manage:!0,actor_ha_admin:!0,transport:"supervisor",access:{state:"ok",checked_at:"2026-10-16T08:00:00Z"},roles:[{id:"viewer",name:"צופה"},{id:"operator",name:"מפעיל"},{id:"editor",name:"עורך מפות ותצוגות"}],scopes:[{type:"installation",id:"*",name:"כל ההתקנה"}],password:{min_length:10,max_length:128},limit:50},V=e=>JSON.parse(JSON.stringify(e)),K={async view(){return P()?L("/ha-users"):V(D)},async check(){return P()?j("/ha-users/check",{}):{access:V(D.access),transport:D.transport}},async create(e){if(P())return j("/ha-users",e);const s=D.roles.find(i=>i.id===e.role_id),a={ha_user_id:`demo-${Date.now()}`,username:e.username,display_name:e.display_name,role_id:e.role_id,role_name:s?.name??e.role_id,scope_type:e.scope_type,scope_id:e.scope_id,scope_name:"כל ההתקנה",state:"active",repair:null,person:e.create_person,created_at:new Date().toISOString(),created_by_name:"מנהל",is_self:!1};return D.users.push(a),{user:V(a),replayed:!1}},async setActive(e,s){if(P())return j(`/ha-users/${encodeURIComponent(e)}/${s?"activate":"deactivate"}`,{confirm:!0});const a=D.users.find(i=>i.ha_user_id===e);return a&&(a.state=s?"active":"inactive"),{user:V(a)}},async remove(e,s){return P()?j(`/ha-users/${encodeURIComponent(e)}/delete`,{confirm_username:s}):(D.users=D.users.filter(a=>a.ha_user_id!==e),{deleted:e,already_gone:!1})}},fs={tab:"משתמשי מערכת הבית",title:"משתמשי מערכת הבית",sub:"יצירת משתמש רגיל במערכת הבית עם תפקיד ב־Arx. מכאן אפשר להשבית או למחוק רק משתמשים שנוצרו כאן.",keywords:"משתמש חדש יצירה מחיקה השבתה סיסמה מערכת הבית",loading:"טוען…",forbidden:"ניהול משתמשי מערכת הבית שמור למנהלי המערכת.",retry:"נסו שוב",accessTitle:"הרשאה במערכת הבית",check:"בדיקת הרשאה",checking:"בודק…",checkedAt:"נבדק {time}",acc_ok:"למערכת יש הרשאה לנהל משתמשים במערכת הבית.",acc_unknown:'עוד לא נבדק. לחצו "בדיקת הרשאה" לפני יצירת המשתמש הראשון.',acc_not_authorised:"למערכת אין הרשאת מנהל במערכת הבית, ולכן אי אפשר ליצור או למחוק משתמשים מכאן.",acc_not_authorised_fix:'מה עושים: במערכת הבית, בפרופיל של חשבון מנהל, יוצרים אסימון גישה לטווח ארוך (Long-Lived Access Token), ושומרים אותו בהגדרות ‹ חיבורים ‹ סודות בשורה "אסימון מנהל לניהול משתמשי מערכת הבית". אין צורך בהפעלה מחדש; אחר כך לוחצים שוב "בדיקת הרשאה". אפשר גם להמשיך לנהל משתמשים במסך המשתמשים של מערכת הבית.',acc_unavailable:"מערכת הבית אינה זמינה כרגע. נסו שוב בעוד רגע.",acc_not_configured:"החיבור למערכת הבית אינו מוגדר בהתקנה הזו.",acc_failed:"הבדיקה נכשלה. נסו שוב.",via_supervisor:"בזהות התוסף",via_token:"באסימון המנהל שהוגדר",notHaAdmin:"רק מנהל של מערכת הבית יכול ליצור, להשבית או למחוק משתמשים. אפשר לצפות ברשימה.",listTitle:"משתמשים שנוצרו דרך Arx",empty:"עוד לא נוצרו משתמשים מכאן.",emptyHint:'משתמשים קיימים של מערכת הבית מופיעים בלשונית "משתמשים", ושם משייכים להם תפקידים.',add:"משתמש חדש",count:"{n} מתוך {max}",colName:"שם",colUser:"שם משתמש",colRole:"תפקיד ב־Arx",colState:"מצב",st_active:"פעיל",st_inactive:"מושבת",st_needs_repair:"דורש תיקון",repair_person_missing:"נוצר בלי כרטיס אדם",repair_compensation_failed:"היצירה נכשלה באמצע; יש למחוק",repair_binding_failed:"שיוך התפקיד נכשל; יש למחוק",repair_cleanup_failed:"הניקוי לא הושלם; יש למחוק שוב",repair_missing_in_ha:"לא נמצא במערכת הבית; יש למחוק",you:"אתם",deactivate:"השבתה",activate:"הפעלה",remove:"מחיקה",createTitle:"משתמש חדש במערכת הבית",createSub:"המשתמש נוצר כמשתמש רגיל (לא מנהל) ומקבל את התפקיד שנבחר ב־Arx בלבד.",fName:"שם מוצג",fUsername:"שם משתמש לכניסה",fUsernameHint:"אותיות לטיניות קטנות, ספרות, נקודה, מקף או קו תחתון; 3 עד 32 תווים.",fPassword:"סיסמה",fPassword2:"סיסמה שוב",fPasswordHint:"לפחות {min} תווים, לא סיסמה נפוצה ולא רצף. הסיסמה לא נשמרת ב־Arx ולא תוצג שוב.",fRole:"תפקיד ב־Arx",fScope:"היקף",fPerson:"ליצור גם כרטיס אדם במערכת הבית",create:"יצירה",cancel:"ביטול",created:"המשתמש {name} נוצר.",createdNoPerson:"המשתמש {name} נוצר, אך כרטיס האדם לא נוצר.",e_name:"נדרש שם מוצג.",e_username:"שם המשתמש אינו בפורמט הנדרש.",e_mismatch:"הסיסמאות אינן זהות.",e_role:"יש לבחור תפקיד.",pw_too_short:"הסיסמה קצרה מדי.",pw_too_long:"הסיסמה ארוכה מדי.",pw_repetitive:"הסיסמה חוזרת על אותם תווים.",pw_common:"הסיסמה נפוצה מדי.",pw_sequence:"הסיסמה היא רצף מקלדת או ספרות.",pw_contains_username:"הסיסמה מכילה את שם המשתמש.",pw_contains_name:"הסיסמה מכילה את השם המוצג.",deactivateTitle:"השבתת {name}",deactivateBody:"המשתמש לא יוכל להיכנס למערכת הבית ול־Arx עד שיופעל שוב. אפשר להפעיל אותו מחדש בכל עת.",activateTitle:"הפעלת {name}",activateBody:"המשתמש יוכל להיכנס שוב, עם התפקיד שלו ב־Arx.",confirm:"אישור",deactivated:"המשתמש הושבת.",activated:"המשתמש הופעל.",removeTitle:"מחיקת {name}",removeBody:"המשתמש יימחק ממערכת הבית, כל התפקידים שלו ב־Arx יבוטלו והכניסות הפתוחות שלו ייסגרו. אי אפשר לבטל את המחיקה. השבתה היא האפשרות הבטוחה יותר.",removeType:"להקליד את שם המשתמש {username} כדי לאשר",removeConfirm:"מחיקה לצמיתות",removed:"המשתמש נמחק."},bs={tab:"Home system users",title:"Home system users",sub:"Create an ordinary home-system user with an Arx role. Only users created here can be deactivated or deleted here.",loading:"Loading…",forbidden:"Managing home-system users is reserved for system administrators.",retry:"Try again",accessTitle:"Permission in the home system",check:"Check permission",checking:"Checking…",checkedAt:"Checked {time}",acc_ok:"Arx may manage users in the home system.",acc_unknown:'Not checked yet. Press "Check permission" before creating the first user.',acc_not_authorised:"Arx has no administrator permission in the home system, so users cannot be created or deleted from here.",acc_not_authorised_fix:`What to do: in the home system, in an administrator account's profile, create a long-lived access token, and save it in Settings › Connections › Secrets as "Home-system users administrator token". No restart is needed; then press "Check permission" again. You can also keep managing users in the home system's own users screen.`,acc_unavailable:"The home system is not reachable right now. Try again in a moment.",acc_not_configured:"This installation has no home-system connection.",acc_failed:"The check failed. Try again.",notHaAdmin:"Only a home-system administrator can create, deactivate or delete users. You can view the list.",listTitle:"Users created through Arx",empty:"No users were created here yet.",add:"New user",colName:"Name",colUser:"Username",colRole:"Arx role",colState:"State",st_active:"Active",st_inactive:"Deactivated",st_needs_repair:"Needs repair",you:"You",deactivate:"Deactivate",activate:"Activate",remove:"Delete",createTitle:"New home-system user",createSub:"The user is created as an ordinary (non-administrator) user and gets only the chosen Arx role.",fName:"Display name",fUsername:"Login username",fPassword:"Password",fPassword2:"Repeat password",fPasswordHint:"At least {min} characters, not a common password or a run. The password is not kept by Arx and is never shown again.",fRole:"Arx role",fScope:"Scope",fPerson:"Also create a person card in the home system",create:"Create",cancel:"Cancel",created:"User {name} was created.",confirm:"Confirm",removeTitle:"Delete {name}",removeType:"Type the username {username} to confirm",removeConfirm:"Delete permanently",removed:"The user was deleted."};function $s(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function u(e,s){const a=($s()==="en"?bs[e]:void 0)??fs[e]??e;return s?a.replace(/\{(\w+)\}/g,(i,r)=>r in s?String(s[r]):i):a}const ys=/^[a-z0-9][a-z0-9._-]{2,31}$/;function me(e,s){return e.toLowerCase()===s.toLowerCase()}const _s=["0123456789","9876543210","abcdefghijklmnopqrstuvwxyz","zyxwvutsrqponmlkjihgfedcba","qwertyuiopasdfghjklzxcvbnm"];function xs(e,s,a,i=10,r=128){if(e.length<i)return"too_short";if(e.length>r)return"too_long";const n=e.toLowerCase();return new Set(n).size<=2?"repetitive":_s.some(d=>d.includes(n)||(d+d).includes(n))?"sequence":s.length>=3&&n.includes(s.toLowerCase())?"contains_username":a.toLowerCase().split(/\s+/).some(d=>d.length>=3&&n.includes(d))?"contains_name":null}const se=(e="viewer")=>({display_name:"",username:"",password:"",password2:"",role_id:e,scope:"installation:*",create_person:!0});function we(e,s=10,a=128){const i={};e.display_name.trim()||(i.display_name="e_name"),ys.test(e.username)||(i.username="e_username");const r=xs(e.password,e.username,e.display_name,s,a);return r?i.password=`pw_${r}`:e.password!==e.password2&&(i.password2="e_mismatch"),e.role_id||(i.role_id="e_role"),i}function ks(e,s,a){const i=s.actor_ha_admin&&!e.is_self&&a!=="not_authorised"&&a!=="not_configured";return{deactivate:i&&e.state==="active",activate:i&&e.state==="inactive",remove:i}}function zs(e){return`st_${e.state}`}function Ss(e){return e.repair?`repair_${e.repair}`:null}function As(e){return`acc_${e}`}function Cs(e){return e.actor_ha_admin&&e.users.length<e.limit&&e.access.state!=="not_authorised"&&e.access.state!=="not_configured"&&e.transport!=="none"}function ve(){const e=new Uint8Array(12);return globalThis.crypto.getRandomValues(e),Array.from(e,s=>s.toString(16).padStart(2,"0")).join("")}var Rs=Object.defineProperty,Ps=Object.getOwnPropertyDescriptor,A=(e,s,a,i)=>{for(var r=i>1?void 0:i?Ps(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Rs(s,a,r),r};let z=class extends M{constructor(){super(...arguments),this.bubbleSkin=new ce(this),this.view=null,this.loadState="loading",this.error="",this.ok="",this.busy=!1,this.checking=!1,this.createOpen=!1,this.draft=se(),this.touched=!1,this.formError="",this.confirm=null,this.removing=null,this.typed="",this.requestKey=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{this.view=await K.view(),this.loadState="ready"}catch(e){this.loadState=e instanceof J&&e.status===403?"forbidden":"error",this.error=g(e)}}flash(e){this.ok=e,this.error=""}async runCheck(){if(this.view){this.checking=!0;try{const e=await K.check();this.view={...this.view,access:e.access,transport:e.transport}}catch(e){this.error=g(e)}finally{this.checking=!1}}}openCreate(){this.draft=se(this.view?.roles.some(e=>e.id==="viewer")?"viewer":this.view?.roles[0]?.id??""),this.touched=!1,this.formError="",this.requestKey=ve(),this.createOpen=!0}closeCreate(){this.createOpen=!1,this.draft=se()}async submitCreate(){if(!this.view)return;this.touched=!0;const e=we(this.draft,this.view.password.min_length,this.view.password.max_length);if(Object.keys(e).length)return;const[s,...a]=this.draft.scope.split(":");this.busy=!0,this.formError="";try{const i=await K.create({display_name:this.draft.display_name.trim(),username:this.draft.username,password:this.draft.password,role_id:this.draft.role_id,scope_type:s,scope_id:a.join(":")||"*",create_person:this.draft.create_person,request_key:this.requestKey});this.closeCreate(),this.flash(u(i.user.repair==="person_missing"?"createdNoPerson":"created",{name:i.user.display_name})),await this.load()}catch(i){this.draft={...this.draft,password:"",password2:""},this.formError=g(i),i instanceof J&&i.code!=="password_weak"&&i.code!=="username_taken"&&i.code!=="validation"&&(this.requestKey=ve(),await this.load())}finally{this.busy=!1}}async submitConfirm(){const e=this.confirm;if(e){this.busy=!0;try{await K.setActive(e.user.ha_user_id,e.kind==="activate"),this.confirm=null,this.flash(u(e.kind==="activate"?"activated":"deactivated")),await this.load()}catch(s){this.confirm=null,this.error=g(s),await this.load()}finally{this.busy=!1}}}async submitRemove(){const e=this.removing;if(!(!e||!me(this.typed,e.username))){this.busy=!0;try{await K.remove(e.ha_user_id,this.typed),this.removing=null,this.typed="",this.flash(u("removed")),await this.load()}catch(s){this.removing=null,this.typed="",this.error=g(s),await this.load()}finally{this.busy=!1}}}renderAccess(e){const s=e.access.state,a=s==="ok"?"tone-ok":s==="unknown"?"":s==="unavailable"?"tone-warn":"tone-err",i=s==="ok"?"check":s==="unknown"?"info":"warning";return t`<sw-card data-ha-access=${s}>
      <div class="head"><h3>${u("accessTitle")}</h3></div>
      <div class="access">
        <sw-icon class=${a} name=${i} size=${18}></sw-icon>
        <div class="text">
          <span class=${a} data-access-text>${u(As(s))}</span>
          ${s==="not_authorised"?t`<span class="fix" data-access-fix>${u("acc_not_authorised_fix")}</span>`:o}
          ${e.access.checked_at?t`<span class="meta">${u("checkedAt",{time:k(e.access.checked_at)})} · ${u(e.transport==="token"?"via_token":"via_supervisor")}</span>`:o}
        </div>
        <sw-button size="sm" icon="refresh" data-ha-check ?disabled=${this.checking||e.transport==="none"} @click=${()=>void this.runCheck()}>${this.checking?u("checking"):u("check")}</sw-button>
      </div>
      ${e.actor_ha_admin?o:t`<div class="msg warn" style="margin-block-start:var(--sw-s-2)" data-not-ha-admin><sw-icon name="lock" size=${13}></sw-icon>${u("notHaAdmin")}</div>`}
    </sw-card>`}renderRow(e,s){const a=ks(e,s,s.access.state),i=Ss(e);return t`<div class="item" data-ha-user=${e.username}>
      <span class="name"><span>${Pe(e.display_name)}${e.is_self?t` <span class="chip">${u("you")}</span>`:o}</span>
        ${i?t`<span class="sub">${u(i)}</span>`:o}</span>
      <span class="user ltr">${e.username}</span>
      <span class="role">${e.role_name} · ${e.scope_name}</span>
      <span class=${`chip ${e.state}`} data-state=${e.state}>${u(zs(e))}</span>
      <span class="row-actions">
        ${a.deactivate?t`<sw-button size="sm" variant="secondary" data-deactivate @click=${()=>this.confirm={user:e,kind:"deactivate"}}>${u("deactivate")}</sw-button>`:o}
        ${a.activate?t`<sw-button size="sm" variant="secondary" data-activate @click=${()=>this.confirm={user:e,kind:"activate"}}>${u("activate")}</sw-button>`:o}
        ${a.remove?t`<sw-button size="sm" variant="ghost" icon="trash" data-remove @click=${()=>{this.removing=e,this.typed=""}}>${u("remove")}</sw-button>`:o}
      </span>
    </div>`}renderList(e){return t`<sw-card data-ha-list>
      <div class="head">
        <h3>${u("listTitle")}</h3><span class="count">${u("count",{n:e.users.length,max:e.limit})}</span><span class="grow"></span>
        ${Cs(e)?t`<sw-button variant="primary" size="sm" icon="plus" data-ha-add @click=${()=>this.openCreate()}>${u("add")}</sw-button>`:o}
      </div>
      ${e.users.length===0?t`<sw-state-panel icon="users" compact state="empty" heading=${u("empty")} hint=${u("emptyHint")}></sw-state-panel>`:t`<div class="list" role="list">
            <div class="item hdr" aria-hidden="true"><span>${u("colName")}</span><span>${u("colUser")}</span><span>${u("colRole")}</span><span>${u("colState")}</span><span></span></div>
            ${Oe(e.users,s=>s.ha_user_id,s=>this.renderRow(s,e))}
          </div>`}
    </sw-card>`}field(e,s){this.draft={...this.draft,[e]:s}}renderCreate(e){const s=this.touched?we(this.draft,e.password.min_length,e.password.max_length):{},a=i=>s[i]?t`<span class="ferr" role="alert">${u(s[i])}</span>`:o;return t`<sw-dialog heading=${u("createTitle")} subheading=${u("createSub")} .open=${this.createOpen} data-ha-create @close=${()=>this.closeCreate()}>
      <form class="form" autocomplete="off" @submit=${i=>{i.preventDefault(),this.submitCreate()}}>
        <label>${u("fName")}<input class="in" maxlength="60" data-f-name aria-invalid=${String(!!s.display_name)} .value=${this.draft.display_name}
          @input=${i=>this.field("display_name",i.target.value)} />${a("display_name")}</label>
        <label>${u("fUsername")}<input class="in ltr" dir="ltr" maxlength="32" autocapitalize="off" spellcheck="false" data-f-username aria-invalid=${String(!!s.username)}
          .value=${this.draft.username} @input=${i=>this.field("username",i.target.value.trim().toLowerCase())} />
          <span class="hint">${u("fUsernameHint")}</span>${a("username")}</label>
        <label>${u("fPassword")}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${e.password.max_length} data-f-password
          aria-invalid=${String(!!s.password)} .value=${this.draft.password} @input=${i=>this.field("password",i.target.value)} />
          <span class="hint">${u("fPasswordHint",{min:e.password.min_length})}</span>${a("password")}</label>
        <label>${u("fPassword2")}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${e.password.max_length} data-f-password2
          aria-invalid=${String(!!s.password2)} .value=${this.draft.password2} @input=${i=>this.field("password2",i.target.value)} />${a("password2")}</label>
        <label>${u("fRole")}<select class="in" data-f-role .value=${this.draft.role_id} @change=${i=>this.field("role_id",i.target.value)}>
          ${e.roles.map(i=>t`<option value=${i.id} ?selected=${i.id===this.draft.role_id}>${i.name}</option>`)}</select>${a("role_id")}</label>
        ${e.scopes.length>1?t`<label>${u("fScope")}<select class="in" data-f-scope .value=${this.draft.scope} @change=${i=>this.field("scope",i.target.value)}>
          ${e.scopes.map(i=>t`<option value=${`${i.type}:${i.id}`} ?selected=${`${i.type}:${i.id}`===this.draft.scope}>${i.name}</option>`)}</select></label>`:o}
        <label class="check"><sw-toggle data-f-person .checked=${this.draft.create_person} @change=${i=>this.draft={...this.draft,create_person:i.target.checked}}></sw-toggle>${u("fPerson")}</label>
        ${this.formError?t`<span class="msg err" role="alert" data-form-error><sw-icon name="warning" size=${13}></sw-icon>${this.formError}</span>`:o}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.closeCreate()}>${u("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-f-submit ?disabled=${this.busy} @click=${()=>void this.submitCreate()}>${u("create")}</sw-button>
    </sw-dialog>`}renderConfirm(){const e=this.confirm,s=e?.user.display_name??"";return t`<sw-dialog heading=${e?u(e.kind==="activate"?"activateTitle":"deactivateTitle",{name:s}):""} .open=${!!e} data-ha-confirm @close=${()=>this.confirm=null}>
      <p class="body">${e?u(e.kind==="activate"?"activateBody":"deactivateBody"):""}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.confirm=null}>${u("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-confirm-go ?disabled=${this.busy} @click=${()=>void this.submitConfirm()}>${u("confirm")}</sw-button>
    </sw-dialog>`}renderRemove(){const e=this.removing;return t`<sw-dialog heading=${e?u("removeTitle",{name:e.display_name}):""} .open=${!!e} data-ha-remove @close=${()=>{this.removing=null,this.typed=""}}>
      <div class="form">
        <p class="body">${u("removeBody")}</p>
        <label>${e?u("removeType",{username:e.username}):""}<input class="in ltr" dir="ltr" autocomplete="off" spellcheck="false" data-remove-typed .value=${this.typed}
          @input=${s=>this.typed=s.target.value} /></label>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.removing=null,this.typed=""}}>${u("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-remove-go ?disabled=${this.busy||!e||!me(this.typed,e.username)} @click=${()=>void this.submitRemove()}>${u("removeConfirm")}</sw-button>
    </sw-dialog>`}render(){if(this.loadState==="loading")return t`<sw-state-panel state="loading"></sw-state-panel>`;if(this.loadState==="forbidden")return t`<sw-state-panel state="forbidden" heading=${u("forbidden")}></sw-state-panel>`;if(this.loadState==="error"||!this.view)return t`<sw-state-panel state="error" heading=${this.error} actionLabel=${u("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=this.view;return t`<div class="stack" data-ha-users>
      <p class="body">${u("sub")}</p>
      ${this.ok||this.error?t`<div>${this.ok?t`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.ok}</span>`:o}${this.error?t`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:o}</div>`:o}
      ${this.renderAccess(e)}
      ${this.renderList(e)}
      ${this.renderCreate(e)}${this.renderConfirm()}${this.renderRemove()}
    </div>`}};z.styles=[xe,ke,H`
    .stack { display: flex; flex-direction: column; gap: var(--sw-s-3); max-inline-size: 960px; }
    .access { display: flex; align-items: flex-start; gap: var(--sw-s-3); flex-wrap: wrap; }
    .access .text { flex: 1; min-inline-size: 220px; display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .access .fix { color: var(--sw-text-2); font-size: var(--sw-fs-xs); line-height: 1.6; }
    .access .meta { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .tone-ok { color: var(--sw-success-text); }
    .tone-warn { color: var(--sw-warning-text); }
    .tone-err { color: var(--sw-danger-text); }
    .head { display: flex; align-items: center; gap: var(--sw-s-2); flex-wrap: wrap; margin-block-end: var(--sw-s-2); }
    .head h3 { margin: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-text); }
    .head .grow { flex: 1; }
    .head .count { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .list { display: flex; flex-direction: column; }
    .item { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1.2fr) 6.5rem 13rem; gap: var(--sw-s-2) var(--sw-s-3); align-items: center;
      padding-block: 10px; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .item:last-child { border-block-end: 0; }
    .item.hdr { color: var(--sw-text-3); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); padding-block: 4px; }
    .name { display: flex; flex-direction: column; min-inline-size: 0; }
    .name .sub { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .chip.active { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .chip.inactive { background: var(--sw-surface-3); color: var(--sw-text-2); }
    .chip.needs_repair { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .row-actions { display: flex; gap: var(--sw-s-1); flex-wrap: wrap; justify-content: flex-end; }
    .form { display: flex; flex-direction: column; gap: var(--sw-s-3); min-inline-size: min(440px, 100%); }
    .form label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .form .hint { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .in { box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm);
      background: var(--sw-surface-solid); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); inline-size: 100%; min-inline-size: 0; }
    .in[aria-invalid='true'] { border-color: var(--sw-danger); }
    .in:focus-visible { outline: 2px solid var(--sw-accent); outline-offset: 1px; }
    .ferr { color: var(--sw-danger-text); font-size: var(--sw-fs-xs); }
    .form label.check { flex-direction: row; align-items: center; gap: var(--sw-s-2); }
    .body { font-size: var(--sw-fs-sm); color: var(--sw-text-2); line-height: 1.6; margin: 0; }
    @media (max-width: 720px) {
      .item { grid-template-columns: minmax(0, 1fr) auto; }
      .item.hdr { display: none; }
      .item .role, .item .user { grid-column: 1 / -1; }
      .row-actions { grid-column: 1 / -1; justify-content: flex-start; }
    }
  `];A([c()],z.prototype,"view",2);A([c()],z.prototype,"loadState",2);A([c()],z.prototype,"error",2);A([c()],z.prototype,"ok",2);A([c()],z.prototype,"busy",2);A([c()],z.prototype,"checking",2);A([c()],z.prototype,"createOpen",2);A([c()],z.prototype,"draft",2);A([c()],z.prototype,"touched",2);A([c()],z.prototype,"formError",2);A([c()],z.prototype,"confirm",2);A([c()],z.prototype,"removing",2);A([c()],z.prototype,"typed",2);z=A([N("sw-ha-users")],z);const Os=(e,s)=>e.trim().toLocaleLowerCase()===s.trim().toLocaleLowerCase();function Z(e,s,a){const i=(e??"").trim(),r=(s??"").trim()||(a??"").trim();return r?i&&Os(i,r)?"":r:""}var Es=Object.defineProperty,Us=Object.getOwnPropertyDescriptor,U=(e,s,a,i)=>{for(var r=i>1?void 0:i?Us(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Es(s,a,r),r};function te(e,s=Ee()){return s==="en"&&e.en||e.he}let R=class extends M{constructor(){super(...arguments),this.remote=!1,this.data=null,this.notShown=!1,this.error="",this.saved=!1,this.busy=!1,this.value="",this.runText="",this.runSaved=!1}connectedCallback(){super.connectedCallback(),this.remote||this.load()}async load(){try{const e=await L("/identity/service-identity");this.data=e,this.value=e.configured_user_id??"",this.runText=(e.runnable?.ids??[]).join(", "),this.error=""}catch(e){e instanceof J&&(e.status===403||e.status===404)?this.notShown=!0:this.error=g(e)}}async save(e=!1){this.busy=!0,this.error="",this.saved=!1;try{const s=await O("/identity/service-identity",{user_id:e?null:this.value.trim()||null});this.data=s,this.value=s.configured_user_id??"",this.saved=!0}catch(s){this.error=g(s)}finally{this.busy=!1}}async saveRunnable(){this.busy=!0,this.error="",this.runSaved=!1;try{const e=this.runText.split(/[\s,]+/).map(a=>a.trim()).filter(Boolean),s=await O("/identity/service-identity/runnable",{entity_ids:e});this.data=s,this.runText=(s.runnable?.ids??[]).join(", "),this.runSaved=!0}catch(e){this.error=g(e)}finally{this.busy=!1}}render(){if(this.remote)return t`<div class="note" data-si-remote>${l("siRemote")}</div>`;if(this.notShown)return o;const e=this.data;return t`<sw-card data-service-identity>
      <div class="body">
        <div class="head">
          <h3>${l("siTitle")}</h3>
          ${e?t`<sw-badge kind=${e.ready?"live":"partial"} label=${e.ready?l("siReady"):l("siNotReady")} data-si-state=${e.ready?"ready":"not-ready"}></sw-badge>`:o}
        </div>
        <p class="sub">${l("siSub")}</p>
        ${this.error?t`<div class="note err" role="alert" data-si-error>${this.error}</div>`:o}
        ${this.saved?t`<div class="note" role="status">${l("siSaved")}</div>`:o}
        ${e?t`
              ${e.user?t`<div class="facts" data-si-user>
                    <span>${l("siUser")}: <bdi>${e.user.name??""}</bdi> · <bdi class="id">${e.user.id}</bdi>${e.user.is_admin?t` · <strong>${l("siAdmin")}</strong>`:o}</span>
                    <span>${l("siBridge")}: <bdi>${e.bridge.version??"?"}</bdi> · ${e.bridge.agrees?l("siAgrees"):l("siDiffers")}</span>
                  </div>`:o}
              ${e.extended?t`<div class="note ${e.extended.requested?"warn":""}" data-si-extended=${e.extended.on?"on":e.extended.requested?"requested":"off"}>
                    ${e.extended.requested?l("siExtendedOn"):l("siExtendedOff")}
                    ${e.extended.doors_addon_only?t`<div data-si-doors-addon-only>${l("siDoorsAddonOnly")}</div>`:o}
                    <div data-si-policy-risk>${l("siPolicyRisk")}</div>
                  </div>`:o}
              ${e.steps.length?t`<div class="note warn" data-si-steps>
                    <div class="label">${l("siNeeded")}</div>
                    <ol>${e.steps.map(s=>t`<li data-si-step=${s.code}>${te(s)}</li>`)}</ol>
                  </div>`:o}
              <div class="row">
                <label
                  >${l("siUserId")}
                  <input
                    .value=${this.value}
                    maxlength="64"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder=${l("siPlaceholder")}
                    @input=${s=>this.value=s.target.value}
                    data-si-input
                /></label>
                <sw-button variant="primary" ?disabled=${this.busy} @click=${()=>this.save()} data-si-save>${l("siSave")}</sw-button>
                ${e.configured_user_id?t`<sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>this.save(!0)} data-si-clear>${l("siClear")}</sw-button>`:o}
              </div>
              ${e.runnable?t`<div class="runnable" data-si-runnable=${e.runnable.agrees?"agrees":"differs"}>
                    <div class="label">${l("siRunTitle")}</div>
                    <p class="sub">${l("siRunSub")}</p>
                    <div class="row">
                      <label
                        >${l("siRunLabel")}
                        <input
                          .value=${this.runText}
                          spellcheck="false"
                          autocomplete="off"
                          placeholder="script.evening_lights, scene.movie"
                          @input=${s=>this.runText=s.target.value}
                          data-si-run-input
                      /></label>
                      <sw-button variant="secondary" ?disabled=${this.busy} @click=${()=>this.saveRunnable()} data-si-run-save>${l("siRunSave")}</sw-button>
                    </div>
                    ${this.runSaved?t`<div class="note" role="status" data-si-run-saved>${l("siRunSaved")}</div>`:o}
                    <div class="facts">
                      <span data-si-run-bridge
                        >${l("siRunBridge")}:
                        ${e.runnable.bridge_ids.length?t`<bdi class="id">${e.runnable.bridge_ids.join(", ")}</bdi>`:l("siRunEmpty")}</span
                      >
                      <span>${e.runnable.agrees?l("siRunAgrees"):l("siRunDiffers")}</span>
                    </div>
                  </div>`:o}
              <div class="cols">
                <div>
                  <div class="label">${l("siAllowed")}</div>
                  <ul data-si-allowed>${e.allowed.map(s=>t`<li>${te(s)}</li>`)}</ul>
                </div>
                <div>
                  <div class="label">${l("siRefused")}</div>
                  <ul data-si-refused>${e.refused.map(s=>t`<li>${te(s)}</li>`)}</ul>
                </div>
              </div>
            `:t`<div class="sub">…</div>`}
      </div>
    </sw-card>`}};R.styles=H`
    :host {
      display: block;
    }
    .body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md, 1rem);
      font-weight: var(--sw-fw-semibold, 600);
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      max-inline-size: 75ch;
      margin: 0;
    }
    .note {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-accent-soft);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .note.warn {
      background: var(--sw-warning-soft, var(--sw-accent-soft));
    }
    ol,
    ul {
      margin: 0;
      padding-inline-start: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      margin-block-end: 4px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-end;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      flex: 1 1 260px;
      min-inline-size: 0;
    }
    input {
      font: inherit;
      min-block-size: 40px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      inline-size: 100%;
      box-sizing: border-box;
      direction: ltr;
      text-align: start;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    [data-si-doors-addon-only],
    [data-si-policy-risk] {
      margin-block-start: 6px;
    }
    .runnable {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-block-start: 1px solid var(--sw-border, transparent);
      padding-block-start: 10px;
    }
    bdi.id {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      word-break: break-all;
    }
  `;U([X({type:Boolean})],R.prototype,"remote",2);U([c()],R.prototype,"data",2);U([c()],R.prototype,"notShown",2);U([c()],R.prototype,"error",2);U([c()],R.prototype,"saved",2);U([c()],R.prototype,"busy",2);U([c()],R.prototype,"value",2);U([c()],R.prototype,"runText",2);U([c()],R.prototype,"runSaved",2);R=U([N("system-service-identity")],R);var Ls=Object.defineProperty,js=Object.getOwnPropertyDescriptor,_=(e,s,a,i)=>{for(var r=i>1?void 0:i?js(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Ls(s,a,r),r};const ae="display:flex;flex-direction:column;gap:2px;align-items:flex-start",ie="color:var(--sw-text-3);font-size:var(--sw-fs-xs)",Ds="display:flex;flex-wrap:wrap;gap:4px",Ts=new Set(["rbac.assign","identity.directory.read","system.configure","identity.local.manage","rbac.roles.manage","sources.configure","audit.read","backup.manage","nvr.configure","system.update"]);function re(e){return!!e&&e.permissions.some(s=>Ts.has(s))}function de(e){return e.filter(s=>s.id!=="system_admin"&&!s.system_role)}function ge(e){return e.url??`https://<כתובת הגישה מרחוק>${e.path}`}function fe(e){return e?`⁦${e}⁩`:""}let $=class extends M{constructor(){super(...arguments),this.roles=[],this.scopes=[],this.data=null,this.error="",this.busy=!1,this.creating=!1,this.selected=null,this.link=null,this.copied=!1,this.suggest="",this.form={username:"",display_name:"",role_id:"viewer",scope:"installation:*",email:"",notes:"",reset_mode:"manager_only"},this.roleEdit=null,this.sent=null,this.publicUrl="",this.publicUrlNote="",this.pk=null,this.pkStepUp=!1,this.pkCode="",this.narrow=!1,this.narrowMq=null,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.pkRequested=null}connectedCallback(){super.connectedCallback(),this.narrowMq=window.matchMedia("(max-width: 767px)"),this.narrowMq.addEventListener("change",this.onNarrow),this.onNarrow(),this.load()}disconnectedCallback(){this.narrowMq?.removeEventListener("change",this.onNarrow),super.disconnectedCallback()}async load(){try{this.data=await L("/identity/local-users"),this.publicUrl||(this.publicUrl=this.data.public_url??""),this.error=""}catch(e){this.error=g(e)}}async run(e){this.busy=!0,this.error="";try{await e()}catch(s){this.error=g(s)}finally{this.busy=!1}}get remote(){return this.data?.channel==="remote"}roleOf(e){return this.roles.find(s=>s.id===e)}scopeParts(e){const s=e.indexOf(":");return{scope_type:e.slice(0,s),scope_id:e.slice(s+1)}}create(e){e.preventDefault();const s=this.form;this.run(async()=>{const a=await j("/identity/local-users",{username:s.username.trim(),display_name:s.display_name.trim(),role_id:s.role_id,...this.scopeParts(s.scope),email:s.email.trim()||null,notes:s.notes.trim()||null,reset_mode:s.reset_mode});this.link={...a.link,user:a.user.display_name},this.copied=!1,this.creating=!1,this.form={...this.form,username:"",display_name:"",email:"",notes:""},await this.load()})}issue(e,s,a=!1){this.run(async()=>{const i=await j(`/identity/local-users/${encodeURIComponent(e.id)}/link`,{purpose:s,via:"shown",temporary:a});this.link={...i.link,user:e.display_name},this.sent=null,this.copied=!1,await this.load()})}issueWhatsapp(e,s){this.run(async()=>{const a=await j(`/identity/local-users/${encodeURIComponent(e.id)}/link`,{purpose:s,via:"whatsapp"});this.link=null,this.sent={user:e.display_name,to:e.whatsapp?.masked??"",expires_at:a.link.expires_at},await this.load()})}savePublicUrl(){this.run(async()=>{await q("/settings",{"security.local_public_url":this.publicUrl.trim()}),this.publicUrlNote=l("publicUrlSaved"),this.publicUrl="",await this.load()})}async copy(){if(this.link)try{await navigator.clipboard.writeText(ge(this.link)),this.copied=!0}catch{this.copied=!1}}setActive(e,s){this.run(async()=>{const a=await q(`/identity/local-users/${encodeURIComponent(e.id)}`,{active:s});this.suggest=a.suggest_also?l("suggestAlso"):"",await this.load()})}setResetMode(e,s){this.run(async()=>{await q(`/identity/local-users/${encodeURIComponent(e.id)}`,{reset_mode:s}),await this.load()})}removeUser(e){window.confirm(l("removeConfirm",{name:e.display_name}))&&this.run(async()=>{await Ue(`/identity/local-users/${encodeURIComponent(e.id)}`),this.selected=null,await this.load()})}simple(e,s){this.run(async()=>{await j(`/identity/local-users/${encodeURIComponent(e.id)}/${s}`),await this.load()})}async loadPasskeys(e){try{const s=await Le(e);this.selected===e&&(this.pk={userId:e,items:s.credentials})}catch{this.pk=null}}removePasskey(e,s){window.confirm(l("passkeyAdminRemoveConfirm"))&&this.run(async()=>{try{await je(e.id,s,this.pkStepUp?this.pkCode.trim():void 0)}catch(a){throw a instanceof J&&a.body.code==="second_factor_step_up_required"&&(this.pkStepUp=!0),a}this.pkCode="",await this.load(),await this.loadPasskeys(e.id)})}passkeyFirstOff(e){this.run(async()=>{await q(`/identity/local-users/${encodeURIComponent(e.id)}`,{passkey_first:!1}),await this.load()})}passkeyOnly(e,s){window.confirm(W(s?"onlyConfirmOn":"onlyConfirmOff"))&&this.run(async()=>{await De(e.id,s),await this.load()})}setPasskeyFirstAllowed(e){this.run(async()=>{await q("/settings",{"security.local_passkey_first":e?"on":"off"}),await this.load()})}renderPasskeys(e,s){this.pkRequested!==e.id&&(this.pkRequested=e.id,Promise.resolve().then(()=>(this.pkStepUp=!1,this.loadPasskeys(e.id))));const a=this.pk?.userId===e.id?this.pk.items:[];return t`<div class="full cell" data-local-passkeys>
      <span class="muted">${l("passkeysCount",{n:e.passkeys??a.length})}${e.passkey_first?t` · ${l("passkeyFirstOn")}`:o}${e.passkey_only?t` · ${W("onlyOn")}`:o}</span>
      ${a.map(i=>t`<span class="muted" data-local-passkey=${i.id}>${i.label||l("passkeys")} · ${k(i.created_at)}${i.synced?t` · ${l("passkeySynced")}`:o}${i.usable?o:t` · ${l("passkeyNotUsable")}`}
        ${s?t`<sw-button size="sm" variant="ghost" @click=${()=>this.removePasskey(e,i.id)} ?disabled=${this.busy} data-local-passkey-remove>${l("passkeyAdminRemove")}</sw-button>`:o}</span>`)}
      ${s&&this.pkStepUp?t`<label>${l("code")}<input class="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6" .value=${this.pkCode}
            @input=${i=>this.pkCode=i.target.value.replace(/\D/g,"").slice(0,6)} data-local-passkey-code /></label>`:o}
      ${s&&(e.passkey_only||this.data?.passkey_first_allowed&&(e.passkeys??a.length)>0)?t`<div class="actions"><sw-button @click=${()=>this.passkeyOnly(e,!e.passkey_only)} ?disabled=${this.busy} data-local-passkey-only>${e.passkey_only?W("onlyDisable"):W("onlyEnable")} · ${W("onlyLabel")}</sw-button></div>`:o}
      ${s&&e.passkey_first&&!e.passkey_only?t`<div class="actions"><sw-button @click=${()=>this.passkeyFirstOff(e)} ?disabled=${this.busy} data-local-passkey-first-off>${l("passkeyFirstAdminOff")}</sw-button></div>`:o}
    </div>`}saveRole(e){const s=this.roleEdit;s&&this.run(async()=>{await O(`/identity/local-users/${encodeURIComponent(e.id)}/role`,{role_id:s.role_id,...this.scopeParts(s.scope)}),this.roleEdit=null,await this.load()})}statusBadge(e){const s=e.status==="active"?"live":e.status==="delayed"?"stale":e.status==="pending_first_login"?"neutral":"offline";return t`<sw-badge kind=${s} label=${l(`status_${e.status}`)}></sw-badge>`}renderCreate(){const e=this.form,s=de(this.roles),a=re(this.roleOf(e.role_id)),i=r=>n=>this.form={...this.form,[r]:n.target.value};return t`<sw-card flush data-local-create>
      <form @submit=${this.create} novalidate>
        <div class="head"><div class="cell"><strong>${l("add")}</strong></div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${l("cancel")} @click=${()=>this.creating=!1}></sw-button></div>
        <label>${l("colUsername")}<input class="ltr" .value=${e.username} @input=${i("username")} autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" required /></label>
        <label>${l("displayName")}<input .value=${e.display_name} @input=${i("display_name")} maxlength="60" required /></label>
        <label>${l("role")}<select .value=${e.role_id} @change=${i("role_id")} data-local-role>
          ${s.map(r=>t`<option value=${r.id} ?selected=${r.id===e.role_id} ?disabled=${this.remote&&re(r)}>${r.name}</option>`)}
        </select></label>
        <label>${l("scope")}<select .value=${e.scope} @change=${i("scope")}>
          ${this.scopes.map(r=>t`<option value=${`${r.type}:${r.id}`} ?selected=${`${r.type}:${r.id}`===e.scope}>${r.name}</option>`)}
        </select></label>
        <label>${l("email")}<input class="ltr" type="email" .value=${e.email} @input=${i("email")} maxlength="254" /></label>
        <label>${l("notes")}<input .value=${e.notes} @input=${i("notes")} maxlength="200" /></label>
        <label>${l("resetMode")}<select .value=${a?"manager_only":e.reset_mode} @change=${i("reset_mode")} ?disabled=${a} data-local-reset-mode>
          <option value="manager_only">${l("reset_manager_only")}</option>
          <option value="self_service">${l("reset_self_service")}</option>
        </select></label>
        ${a?t`<div class="note warn full" data-local-admin-note>${l("adminNote")} ${l("resetAdminNote")}</div>`:o}
        <div class="actions">
          <sw-button variant="primary" type="submit" ?disabled=${this.busy||a&&this.remote} data-local-create-save>${l("create")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.creating=!1}>${l("cancel")}</sw-button>
        </div>
      </form>
    </sw-card>`}renderLink(){const e=this.link;return e?t`<sw-card flush data-local-link>
      <div class="panel">
        <div class="full"><strong>${e.purpose==="reset"?l("linkResetTitle"):l("linkTitle")} · ${e.user}</strong></div>
        <div class="note full">${l("linkOnce",{until:k(e.expires_at)})}</div>
        <div class="link full" data-local-link-text>${ge(e)}</div>
        <div class="actions">
          <sw-button variant="primary" icon="link" @click=${()=>void this.copy()}>${this.copied?l("copied"):l("copy")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.link=null}>${l("close")}</sw-button>
        </div>
      </div>
    </sw-card>`:o}renderSent(){const e=this.sent;return e?t`<div class="note" role="status" data-local-link-sent>${e.user} · ${l("waSent",{to:fe(e.to),until:k(e.expires_at)})}
      <sw-button variant="ghost" @click=${()=>this.sent=null}>${l("close")}</sw-button></div>`:o}renderWhatsapp(e){const s=this.data?.whatsapp_ready??!1,a=!!e.whatsapp?.verified,i=e.status==="pending_first_login"?"first_login":"reset";return e.admin?t`<div class="muted full" data-local-wa-admin>${l("waAdminNote")}</div>`:t`<div class="full cell" data-local-wa>
      <span class="muted" data-local-wa-state>${a?l("waVerified",{masked:fe(e.whatsapp?.masked??"")}):l("waNone")}</span>
      ${s?o:t`<span class="muted" data-local-wa-off>${l("waChannelOff")}</span>`}
      ${s&&a?t`<div class="actions"><sw-button @click=${()=>this.issueWhatsapp(e,i)} ?disabled=${this.busy||!e.active} data-local-issue-wa=${i}>
            ${i==="first_login"?l("issueFirstWa"):l("issueResetWa")}</sw-button></div>`:o}
    </div>`}renderSelected(e){const s=this.data?.can_manage??!1,a=e.admin&&this.remote,i=de(this.roles),r=this.roleEdit;return t`<sw-card flush data-local-user=${e.id}>
      <div class="panel">
        <div class="head">
          <div class="cell">
            <strong>${e.display_name}</strong>
            <span class="muted">${Z(e.display_name,e.username)?t`<bdi>${e.username}</bdi> · `:o}${e.role_name??"—"} · ${e.scope_name??"—"} · ${l("sessions")}: ${e.sessions}</span>
            <span class="muted" data-local-user-meta>${l("colLast")}: ${e.last_sign_in_at?k(e.last_sign_in_at):l("never")} · ${l("colFactor")}: ${e.second_factor?l("factorOn"):l("factorOff")}</span>
            ${e.admin?t`<span class="muted">${l("adminNote")}</span>`:o}
          </div>
          ${this.statusBadge(e)}
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${l("close")} data-local-user-close @click=${()=>{this.selected=null,this.roleEdit=null}}></sw-button>
        </div>
        ${s?t`<div class="actions">
              ${a?t`<span class="muted" data-local-only>${l("localOnly")}</span>`:e.status==="pending_first_login"?t`<sw-button @click=${()=>this.issue(e,"first_login")} ?disabled=${this.busy||!e.active} data-local-issue="first_login">${l("issueFirst")}</sw-button>`:t`<sw-button @click=${()=>this.issue(e,"reset")} ?disabled=${this.busy||!e.active} data-local-issue="reset">${l("issueReset")}</sw-button>
                    <sw-button variant="ghost" @click=${()=>this.issue(e,"reset",!0)} ?disabled=${this.busy||!e.active}>${l("temporary")}</sw-button>`}
              ${e.status==="delayed"?t`<sw-button @click=${()=>this.simple(e,"unlock")} ?disabled=${this.busy}>${l("unlock")}</sw-button>`:o}
              <sw-button @click=${()=>this.simple(e,"sessions/revoke")} ?disabled=${this.busy||!e.sessions}>${l("endSessions")}</sw-button>
              <sw-button @click=${()=>this.setActive(e,!e.active)} ?disabled=${this.busy}>${e.active?l("disable"):l("enable")}</sw-button>
              <sw-button @click=${()=>this.roleEdit={role_id:e.role_id??"viewer",scope:`${e.scope_type??"installation"}:${e.scope_id??"*"}`}} ?disabled=${this.busy}>${l("changeRole")}</sw-button>
              <sw-button class="end" variant="danger" @click=${()=>this.removeUser(e)} ?disabled=${this.busy}>${l("remove")}</sw-button>
            </div>
            <div class="sep" role="presentation"></div>
            <label>${l("resetMode")}<select .value=${e.reset_mode} ?disabled=${this.busy||e.admin} @change=${n=>this.setResetMode(e,n.target.value)}>
              <option value="manager_only">${l("reset_manager_only")}</option>
              <option value="self_service">${l("reset_self_service")}</option>
            </select></label>
            ${e.admin?t`<div class="muted full" data-local-reset-admin>${l("resetAdminNote")}</div>`:e.self_service_blocked?t`<div class="note warn full" data-local-reset-blocked=${e.self_service_blocked}>${l(`blocked_${e.self_service_blocked}`)}</div>`:t`<div class="muted full">${l("resetModeHelp")}</div>`}
            ${this.renderWhatsapp(e)}
            ${this.renderPasskeys(e,s)}
            ${r?t`<label>${l("role")}<select .value=${r.role_id} @change=${n=>this.roleEdit={...r,role_id:n.target.value}}>
                    ${i.map(n=>t`<option value=${n.id} ?selected=${n.id===r.role_id} ?disabled=${this.remote&&re(n)}>${n.name}</option>`)}
                  </select></label>
                  <label>${l("scope")}<select .value=${r.scope} @change=${n=>this.roleEdit={...r,scope:n.target.value}}>
                    ${this.scopes.map(n=>t`<option value=${`${n.type}:${n.id}`} ?selected=${`${n.type}:${n.id}`===r.scope}>${n.name}</option>`)}
                  </select></label>
                  <div class="actions"><sw-button variant="primary" @click=${()=>this.saveRole(e)} ?disabled=${this.busy}>${l("save")}</sw-button><sw-button variant="ghost" @click=${()=>this.roleEdit=null}>${l("cancel")}</sw-button></div>`:o}`:o}
      </div>
    </sw-card>`}renderPublicUrl(e){return t`<sw-card flush data-local-public-url>
      <div class="panel">
        <label class="full">${l("publicUrl")}
          <input class="ltr" type="url" inputmode="url" placeholder=${e.public_url??"https://"} .value=${this.publicUrl}
            @input=${s=>this.publicUrl=s.target.value} maxlength="300" data-local-public-url-input /></label>
        <div class="muted full">${l("publicUrlHint")}</div>
        ${this.publicUrlNote?t`<div class="note full" role="status">${this.publicUrlNote}</div>`:o}
        <div class="actions"><sw-button @click=${()=>this.savePublicUrl()} ?disabled=${this.busy} data-local-public-url-save>${l("publicUrlSave")}</sw-button></div>
        <label class="full check"><input type="checkbox" .checked=${!!e.passkey_first_allowed} ?disabled=${this.busy}
            @change=${s=>this.setPasskeyFirstAllowed(s.target.checked)} data-local-passkey-first-allowed />
          ${l("passkeySettingFirst")}</label>
        <div class="muted full">${l("passkeySettingHelp")}</div>
      </div>
    </sw-card>`}render(){const e=this.data;if(!e)return t`<div class="stack">${this.error?t`<sw-state-panel state="error" compact hint=${this.error} actionLabel="נסה שוב" data-local-load-error @action=${()=>void this.load()}></sw-state-panel>`:t`<sw-state-panel state="loading" compact data-local-loading></sw-state-panel>`}</div>`;const s=n=>n,a=[{key:"name",label:l("colName"),render:n=>t`<span style=${ae}><span>${s(n).display_name}</span>${Z(s(n).display_name,s(n).username)?t`<span style=${ie}><bdi>${s(n).username}</bdi></span>`:o}</span>`},{key:"role",label:l("colRole"),render:n=>t`<span style=${ae}><span>${s(n).role_name??"—"}</span><span style=${ie}>${s(n).scope_name??""}</span>
          <span style=${Ds}>${s(n).admin?t`<sw-badge kind="partial" label=${l("adminBadge")}></sw-badge>`:o}${s(n).ha_user_id?t`<sw-badge kind="neutral" label=${l("haBadge")}></sw-badge>`:o}</span></span>`},{key:"status",label:l("colStatus"),render:n=>this.statusBadge(s(n))},{key:"last",label:l("colLast"),render:n=>s(n).last_sign_in_at?k(s(n).last_sign_in_at):l("never")},{key:"factor",label:l("colFactor"),render:n=>t`<span style=${ae}><span>${s(n).second_factor?l("factorOn"):l("factorOff")}</span>${s(n).passkeys?t`<span style=${ie}>${l("passkeysCount",{n:s(n).passkeys??0})}</span>`:o}</span>`}],i=this.narrow?a.filter(n=>n.key!=="last"&&n.key!=="factor"):a,r=e.users.find(n=>n.id===this.selected)??null;return t`<div class="stack" data-local-users>
      <div class="bar">
        <div class="sub">${l("tabSub")}</div>
        ${e.can_manage&&e.enabled?t`<div class="actions">
              <sw-button variant="primary" icon="plus" @click=${()=>this.creating=!this.creating} data-local-add>${l("add")}</sw-button>
              <sw-button variant="ghost" @click=${()=>window.open(ze("/identity/local-users/export"),"_blank","noopener")}>${l("export")}</sw-button>
            </div>`:o}
      </div>
      ${e.enabled?o:t`<div class="note warn" data-local-off>${l("off")}</div>`}
      ${e.can_manage?t`<system-service-identity ?remote=${this.remote}></system-service-identity>`:o}
      ${this.error?t`<div class="note err" role="alert" data-local-error>${this.error}</div>`:o}
      ${this.suggest?t`<div class="note warn" role="status">${this.suggest}</div>`:o}
      ${this.renderLink()}
      ${this.renderSent()}
      ${this.creating&&e.enabled?this.renderCreate():o}
      ${e.users.length?t`<sw-table .columns=${i} .rows=${e.users} rowKey="id" .selected=${this.selected}
            @row-select=${n=>{this.selected=n.detail.id,this.roleEdit=null}}></sw-table>`:t`<sw-state-panel icon="users" state="empty" compact hint=${l("empty")} data-local-empty></sw-state-panel>`}
      ${r?this.renderSelected(r):o}
      ${e.can_manage&&e.enabled?this.renderPublicUrl(e):o}
    </div>`}};$.styles=H`
    :host {
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      max-inline-size: 70ch;
    }
    .note {
      border-radius: var(--sw-r-md);
      padding: 10px 12px;
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
      background: var(--sw-accent-soft);
    }
    .note.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .note.warn {
      background: var(--sw-warning-soft, var(--sw-accent-soft));
    }
    form,
    .panel {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      padding: 14px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    input,
    select {
      font: inherit;
      min-block-size: 40px;
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      inline-size: 100%;
      box-sizing: border-box;
    }
    input.ltr {
      direction: ltr;
      text-align: start;
    }
    .actions {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .link {
      direction: ltr;
      text-align: start;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      word-break: break-all;
      user-select: all;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-bg));
      border: 1px solid var(--sw-border);
    }
    .cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .full {
      grid-column: 1 / -1;
    }
    /* ACCESS-POLISH-2331: a checkbox row (the passkey-first switch) - a checkbox is never a 100 % wide, 40 px tall field */
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    label.check input {
      inline-size: 20px;
      min-block-size: 20px;
      block-size: 20px;
      flex: none;
      margin: 0;
    }
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* the selected user's and the create form's header: the title, and a close action at the far end */
    .head {
      grid-column: 1 / -1;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .head .cell {
      flex: 1;
      min-inline-size: 0;
    }
    .head strong {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
    }
    /* a destructive action stands apart from the everyday ones */
    .actions .end {
      margin-inline-start: auto;
    }
    .sep {
      grid-column: 1 / -1;
      border-block-start: 1px solid var(--sw-border);
    }
  `;_([X({attribute:!1})],$.prototype,"roles",2);_([X({attribute:!1})],$.prototype,"scopes",2);_([c()],$.prototype,"data",2);_([c()],$.prototype,"error",2);_([c()],$.prototype,"busy",2);_([c()],$.prototype,"creating",2);_([c()],$.prototype,"selected",2);_([c()],$.prototype,"link",2);_([c()],$.prototype,"copied",2);_([c()],$.prototype,"suggest",2);_([c()],$.prototype,"form",2);_([c()],$.prototype,"roleEdit",2);_([c()],$.prototype,"sent",2);_([c()],$.prototype,"publicUrl",2);_([c()],$.prototype,"publicUrlNote",2);_([c()],$.prototype,"pk",2);_([c()],$.prototype,"pkStepUp",2);_([c()],$.prototype,"pkCode",2);_([c()],$.prototype,"narrow",2);$=_([N("system-local-users")],$);const be="הרחב בירור",Is=()=>L("access/capture-lease/settings"),Hs=(e,s)=>O("access/capture-lease/settings",{lookup_scope:e,...s?{lookup_scope_confirm:s}:{}});var Ms=Object.defineProperty,Ns=Object.getOwnPropertyDescriptor,T=(e,s,a,i)=>{for(var r=i>1?void 0:i?Ns(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Ms(s,a,r),r};const $e={holder:"מי שמחזיק כעת בהרשאה לפעולה המקורית (ברירת מחדל)",holder_or_audit_readers:"גם מחזיקי הרשאת צפייה באודיט"};let E=class extends M{constructor(){super(...arguments),this.value=null,this.pending=null,this.word="",this.notAllowed=!1,this.busy=!1,this.error="",this.saved=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=await Is();this.value=e.lookup_scope,this.pending=e.lookup_scope}catch(e){const s=e.status;s===403||s===404?this.notAllowed=!0:this.error=g(e)}}async save(){if(!(!this.pending||this.pending===this.value)){this.busy=!0,this.error="",this.saved=!1;try{const e=await Hs(this.pending,this.pending==="holder_or_audit_readers"?this.word.trim():void 0);this.value=e.lookup_scope,this.pending=e.lookup_scope,this.word="",this.saved=!0}catch(e){this.error=g(e)}finally{this.busy=!1}}}render(){if(this.notAllowed)return o;if(this.value===null)return this.error?t`<p class="err" role="alert">${this.error}</p>`:o;const e=this.pending==="holder_or_audit_readers"&&this.value!=="holder_or_audit_readers";return t`<sw-card heading="בירור מצב פעולה ישנה" data-lookup-scope>
      <div class="row">
        <sw-field label="מי רשאי לברר מצב של פעולת אינטרקום ישנה">
          <select data-lookup-scope-select .value=${le(this.pending??"holder")} ?disabled=${this.busy}
            @change=${s=>{this.pending=s.target.value,this.saved=!1}}>
            ${Object.keys($e).map(s=>t`<option value=${s} ?selected=${s===this.pending}>${$e[s]}</option>`)}
          </select>
        </sw-field>
        ${e?t`<sw-field label=${`לאישור ההרחבה הקלידו "${be}"`}>
              <input data-lookup-scope-word .value=${le(this.word)} ?disabled=${this.busy} @input=${s=>this.word=s.target.value} />
            </sw-field>`:o}
        <sw-button variant="primary" data-lookup-scope-save ?disabled=${this.busy||this.pending===this.value||e&&this.word.trim()!==be}
          @click=${()=>void this.save()}>שמירה</sw-button>
      </div>
      ${this.error?t`<p class="err" role="alert">${this.error}</p>`:o}
      ${this.saved?t`<p class="ok" role="status">נשמר</p>`:o}
    </sw-card>`}};E.styles=H`
    :host { display: block; margin-block-end: var(--sw-space-4, 16px); }
    .row { display: flex; flex-wrap: wrap; gap: var(--sw-space-3, 12px); align-items: end; }
    select, input { min-width: 16rem; max-width: 100%; }
    .err { color: var(--sw-danger); }
    .ok { color: var(--sw-success); }
  `;T([c()],E.prototype,"value",2);T([c()],E.prototype,"pending",2);T([c()],E.prototype,"word",2);T([c()],E.prototype,"notAllowed",2);T([c()],E.prototype,"busy",2);T([c()],E.prototype,"error",2);T([c()],E.prototype,"saved",2);E=T([N("sw-lookup-scope")],E);var Gs=Object.defineProperty,qs=Object.getOwnPropertyDescriptor,Re=(e,s,a,i)=>{for(var r=i>1?void 0:i?qs(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Gs(s,a,r),r};let Q=class extends M{constructor(){super(...arguments),this.bubbleSkin=new ce(this),this.roles=null}rows(){const e=new Set(this.roles?.sensitive??[]),s=a=>this.roles?.labels[a]??Se(a)??a;return[...Te.map(a=>({id:a,label:s(a),tag:a==="energy.bills"&&(e.has(a)||!this.roles?.sensitive)?"sensitive":""})),{id:"system.configure",label:"הגדרות שמירת נתונים",tag:"existing"}]}holds(e,s){return e.permissions.includes(s)||e.sensitive_included.includes(s)}chip(e){return e==="sensitive"?t`<span class="chip c-warn nodot">רגישה</span>`:e==="existing"?t`<span class="chip nodot">קיימת</span>`:o}render(){const e=this.roles;if(!e?.roles.length)return o;const s=this.rows();return t`<section data-energy-permissions aria-label="הרשאות חשמל">
      <h3>חשמל</h3>
      <div class="card flush scrollx wide"><table class="t" data-energy-matrix>
        <thead><tr><th>הרשאה</th>${e.roles.map(a=>t`<th class="c">${a.name}</th>`)}</tr></thead>
        <tbody>${s.map(a=>t`<tr data-energy-row=${a.id}><td><b>${a.label}</b> ${this.chip(a.tag)}<div class="code">${a.id}</div></td>
          ${e.roles.map(i=>t`<td class="c" data-role=${i.id}>${this.holds(i,a.id)?t`<span class="tick on" aria-label="יש">✓</span>`:t`<span class="tick" aria-label="אין"></span>`}</td>`)}</tr>`)}</tbody></table></div>
      <div class="list phone" style="flex-direction:column">${s.map(a=>t`<div class="li" style="flex-direction:column;align-items:stretch" data-energy-row-phone=${a.id}>
        <div class="row"><b>${a.label}</b>${this.chip(a.tag)}</div>
        <div class="t2 wrap">${e.roles.filter(i=>this.holds(i,a.id)).map(i=>i.name).join(", ")||"אין תפקיד"}</div></div>`)}</div>
    </section>`}};Q.styles=[ps,H`
      :host {
        display: block;
        margin-block-start: 14px;
      }
      h3 {
        margin: 0 0 8px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      th.c,
      td.c {
        text-align: center;
      }
      .code {
        font-family: var(--sw-font-mono, monospace);
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        direction: ltr;
        text-align: start;
        unicode-bidi: isolate;
      }
      .tick {
        display: inline-grid;
        place-items: center;
        inline-size: 22px;
        block-size: 22px;
        border-radius: var(--sw-r-xs);
        border: 2px solid var(--sw-border-strong);
        color: var(--sw-text-inverse);
      }
      .tick.on {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
      }
      .phone {
        display: none;
      }
      @media (max-width: 760px) {
        .wide {
          display: none;
        }
        .phone {
          display: flex;
        }
      }
    `];Re([X({attribute:!1})],Q.prototype,"roles",2);Q=Re([N("elec-permission-rows")],Q);function Ws(e,s){const a=new Set(s??[]);return e.filter(i=>!a.has(i))}function Bs(e,s,a){return s?e.filter(i=>!(i in s)||a.has(i)):[...e]}var Ks=Object.defineProperty,Fs=Object.getOwnPropertyDescriptor,x=(e,s,a,i)=>{for(var r=i>1?void 0:i?Fs(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Ks(s,a,r),r};const ne={light:"תאורה",not_light:"לא תאורה",protected:"מוגן"},Vs={alarm_managed:"נשלט ממסך האזעקה",media_managed:"נשלט ממסך המולטימדיה",doors_layer:"בשכבת הדלתות"},Y=20,Ys={lights:"תאורה",climate:"אקלים",shades:"תריסים",doors:"דלתות",cameras:"מצלמות",energy:"חשמל",alerts:"התראות",scenes:"סצנות",security:"אבטחה",presence:"מי בבית",calendar:"יומן וחדרים משותפים",notices:"לוח הודעות",tickets:"פניות שירות",schedules:"תזמונים",...gs,recordings:"הקלטות",log:"יומן הבית",intercom:"אינטרקום"};let y=class extends M{constructor(){super(...arguments),this.data=null,this.rooms=[],this.sel="",this.error="",this.message="",this.busy=!1,this.code="",this.sub="users",this.inst=null,this.vis=null,this.sw=null,this.swError="",this.swSel=new Set,this.swFilter="all",this.swArea="",this.swPage=0,this.walls=null,this.wallRoom="",this.wallStamp=0,this.wallsLoading=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const[e,s,a]=await Promise.all([L("home/policies"),us().catch(()=>null),L("home/settings").catch(()=>null)]);this.data=e,this.inst=a?.settings??null,this.rooms=s?.rooms??[],!this.sel&&e.users[0]&&(this.sel=e.users[0].user_id),this.error=""}catch(e){this.error=g(e)}this.loadVisitors()}async loadVisitors(){if(!this.data?.users.find(s=>s.user_id===F.me?.user.id)?.system_admin){this.vis=this.data?"denied":null;return}try{this.vis=await L("access/visitors/settings")}catch{this.vis="denied"}}async saveVisitors(e){this.message="",this.busy=!0;try{this.vis=await O("access/visitors/settings",{visitors:e?"on":"off"}),this.message=e?this.vis.effective?"הזמנת אורחים הופעלה.":"נשמר. הזמנת אורחים תפעל רק כשגם הגישה החיצונית מופעלת.":"הזמנת אורחים כובתה."}catch(s){this.error=g(s)}finally{this.busy=!1}}visitorsCard(){const e=this.vis;if(e===null)return o;const s=e!=="denied"&&e.visitors==="on",a=e==="denied"?"רק מנהל מערכת יכול להפעיל או לכבות.":s?e.effective?'מופעל. רק מי שסומן "רשאי להזמין אורחים" ויש לו הרשאה יכול להזמין. קוד האורח לא מוצג למזמין.':"מופעל, אבל לא פועל עדיין: צריך להפעיל גם את הגישה החיצונית בהגדרות הגישה.":'כבוי (ברירת המחדל בהתקנה). כשמופעל, רק מי שסומן "רשאי להזמין אורחים" ויש לו הרשאה יכול להזמין.';return t`<section class="card" aria-label="הזמנת אורחים" data-home-visitors><h3>הזמנת אורחים</h3>
      <div class="srow"><div><b>הזמנת אורחים מהממשק הביתי</b><div class="note">${a}</div></div><sw-toggle label="הזמנת אורחים מהממשק הביתי" labelHidden data-home-visitors-switch ?checked=${s} ?disabled=${e==="denied"||this.busy} @change=${i=>this.saveVisitors(i.detail.checked)}></sw-toggle></div></section>`}async save(e,s){this.busy=!0,this.message="";try{await O(`home/policies/${encodeURIComponent(e.user_id)}`,s),await this.load(),this.message="נשמר."}catch(a){this.error=g(a)}finally{this.busy=!1}}async saveCode(){try{const e=await O("home/kiosk-code",{code:this.code||null});this.code="",this.message=e.kiosk_code_set?"קוד היציאה של מסכי הקיר נשמר.":"קוד היציאה נמחק.",await this.load()}catch(e){this.error=g(e)}}async seedFromMine(){try{const e=await ms();await O("home/seed",{seed:e.favourites}),this.message="המועדפים שלך נשמרו כמועדפי ההתחלה של כולם."}catch(e){this.error=g(e)}}async loadSwitches(){try{this.sw=(await L("home/switches")).switches,this.swError=""}catch(e){this.swError=g(e)}}async saveInstall(e){this.message="";try{this.inst=(await O("home/settings",e)).settings,this.message="נשמר. משתמשים קיימים לא הושפעו."}catch(s){this.error=g(s)}}swVisible(){return(this.sw??[]).filter(e=>(this.swFilter==="all"?!0:this.swFilter==="suggested"?!!e.suggest:e.class===this.swFilter)&&(!this.swArea||(e.area_id??"")===this.swArea))}async mark(e,s){if(s.length){this.busy=!0,this.message="";try{const a=await j("home/switches",{entity_ids:s,mark:e});this.message=`סומנו ${a.changed} כ"${ne[e]}".${a.refused?` ${a.refused} לא שונו (נשלטים ממסך אחר).`:""}`,this.swSel=new Set,await this.loadSwitches()}catch(a){this.error=g(a)}finally{this.busy=!1}}}async approveSelected(){const e=(this.sw??[]).filter(s=>this.swSel.has(s.entity_id)&&s.suggest);for(const s of["light","protected","not_light"]){const a=e.filter(i=>i.suggest===s).map(i=>i.entity_id);a.length&&await this.mark(s,a)}}installPane(){const e=this.inst;if(!e)return t`<sw-state-panel state="loading"></sw-state-panel>`;const s=(a,i,r,n)=>t`<label class="opt"><input type="radio" name=${a} .checked=${e[a]===i} data-install=${`${a}:${i}`} @change=${()=>this.saveInstall({[a]:i})}><span><b>${r}</b><span class="note">${n}</span></span></label>`;return t`<div class="grid">
      <section class="card" aria-label="ממשק למשתמשים חדשים"><h3>ממשק למשתמשים חדשים</h3><p class="note">חל רק על מי שעוד לא הוגדר. משתמשים קיימים נשארים עם מה שיש להם.</p><div class="opts">
        ${s("default_mode","full_all","ממשק מלא לכולם","ברירת המחדל. כל אחד יכול לעבור לממשק הביתי מהתפריט האישי.")}
        ${s("default_mode","home_regular","ביתי למשתמשים רגילים, מלא למנהלים","מנהל = מנהל מערכת או מי שרשאי להגדיר את המערכת.")}
        ${s("default_mode","choose","בחירה בכניסה הראשונה","בכניסה הראשונה מוצג מסך בחירה בין שני הממשקים, והבחירה נשמרת.")}
      </div></section>
      <section class="card" aria-label="מסכי קיר ורקע"><h3>מסכי קיר</h3><div class="opts">
        ${s("kiosk_exit","code","נעול, יציאה בקוד מנהל","ברירת המחדל. לחיצה ארוכה על השעון מבקשת את הקוד.")}
        ${s("kiosk_exit","none","נעול לממשק הביתי ולחדר שלו, בלי יציאה","אין תפריט אישי ואין דרך לצאת מהמסך עצמו. משנים רק מכאן.")}
      </div>
      <h3 style="margin-block-start:16px">רקע לחדרים</h3><div class="opts">
        ${s("wallpaper","none","בלי רקע","ברירת המחדל: מסך נקי.")}
        ${s("wallpaper","gallery","גלריה מוכנה","כל משתמש בוחר רקע מעומעם לכל חדר מתוך גלריה מובנית.")}
        ${s("wallpaper","gallery_image","גלריה ותמונה אישית","בנוסף אפשר להעלות תמונה לחדר (JPEG או PNG, עד 2 MB). התמונה נשמרת בשרת ונראית רק למי שהעלה אותה.")}
      </div></section>${this.roomWallPane()}${this.visitorsCard()}</div>`}async loadWalls(){if(!this.wallsLoading){this.wallsLoading=!0;try{this.walls=(await L("home/room-wallpapers")).walls}catch{this.walls={}}this.wallsLoading=!1}}async setWall(e,s){this.busy=!0;try{this.walls=(await O(`home/room-wallpapers/${encodeURIComponent(e)}`,{value:s})).walls,this.message="הרקע נשמר"}catch(a){this.message=g(a)}finally{this.busy=!1}}async uploadWall(e,s){const a=s.target,i=a.files?.[0];if(a.value="",!i)return;if(!/^image\/(jpeg|png)$/.test(i.type)||i.size>2e6){this.message="אפשר להעלות JPEG או PNG עד 2 MB.";return}const r=new FormData;r.append("file",i);try{this.walls=(await Ie(`home/room-wallpapers/${encodeURIComponent(e)}/image`,{method:"PUT",body:r})).walls,this.wallStamp=Date.now(),this.message="התמונה נשמרה כרקע לכולם"}catch(n){this.message=g(n)}}roomWallPane(){const e=this.inst?.wallpaper??"none";if(e==="none")return o;if(this.walls==null)return this.loadWalls(),t`<section class="card"><sw-state-panel state="loading"></sw-state-panel></section>`;const s=this.wallRoom||this.rooms[0]?.id||"",a=this.walls[s]??"",i=[["","בלי רקע",""],...ws.map(r=>["g:"+r.id,r.name,vs(r.id)])];return t`<section class="card" aria-label="רקע לחדר לכולם" data-home-room-walls><h3>רקע לחדר לכולם</h3><p class="note">למשל למסכי קיר. רקע שאדם בחר לעצמו גובר על זה, חוץ ממסך קיר: שם הרקע שנבחר כאן תמיד מוצג.</p>
      <div class="inline"><select aria-label="חדר" @change=${r=>{this.wallRoom=r.target.value}}>${this.rooms.map(r=>t`<option value=${r.id} ?selected=${r.id===s}>${r.name}${this.walls[r.id]?" ·":""}</option>`)}</select>
      ${e==="gallery_image"&&s?t`<label class="up"><input type="file" accept="image/jpeg,image/png" hidden data-home-room-wall-upload @change=${r=>this.uploadWall(s,r)}><span>${a==="img"?"החלפת התמונה":"תמונה לחדר"}</span></label>`:o}</div>
      <div class="walls">${i.map(([r,n,d])=>t`<button class="wopt" aria-pressed=${String(r===a)} data-home-room-wall=${r||"none"} ?disabled=${this.busy||!s} @click=${()=>this.setWall(s,r)}><span class="wpv" style=${d?`background:${d}`:o}></span>${n}</button>`)}${a==="img"?t`<button class="wopt" aria-pressed="true"><span class="wpv" style=${`background:url("${ze("home/room-wallpapers/"+encodeURIComponent(s)+"/image")}?v=${this.wallStamp}") center / cover`}></span>תמונה</button>`:o}</div></section>`}switchesPane(){if(this.swError)return t`<sw-state-panel state="error" hint=${this.swError} actionLabel="נסה שוב" @action=${()=>this.loadSwitches()}></sw-state-panel>`;if(!this.sw)return t`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.swVisible(),s=Math.max(1,Math.ceil(e.length/Y)),a=Math.min(this.swPage,s-1),i=e.slice(a*Y,a*Y+Y),r=[...new Map(this.sw.filter(w=>w.area_id).map(w=>[w.area_id,w.area_name??w.area_id])).entries()],n=this.swSel,d=e.length>0&&e.every(w=>n.has(w.entity_id)),m=this.sw.filter(w=>w.suggest).length,p=w=>{this.swSel=w},h=(w,v)=>{const C=new Set(n);v?C.add(w):C.delete(w),p(C)},I=[...n].filter(w=>this.sw.find(v=>v.entity_id===w)?.suggest).length;return t`<section class="card" aria-label="סיווג מפסקים" data-home-switches>
      <h3>סיווג מפסקים</h3>
      <p class="note">תאורה נכבית ב"כיבוי החדר" וב"כיבוי הכל". "לא תאורה" (דוד, מקרר, משאבה...) לא נכבה בכיבוי כללי. "מוגן" גם מבקש אישור לפני כיבוי ידני ולא נכלל בשום פעולה קבוצתית. המערכת מציעה לפי השם, ואתם מאשרים.</p>
      <div class="filters">
        <sw-tabs segmented group-label="סינון" data-sw-filter .items=${[{id:"all",label:"הכל",count:this.sw.length},{id:"suggested",label:"הצעות",count:m},{id:"light",label:"תאורה"},{id:"not_light",label:"לא תאורה"},{id:"protected",label:"מוגן"}]} .active=${this.swFilter} @change=${w=>{this.swFilter=w.detail.id,this.swPage=0}}></sw-tabs>
        <select aria-label="חדר" data-sw-area @change=${w=>{this.swArea=w.target.value,this.swPage=0}}><option value="">כל החדרים</option>${r.map(([w,v])=>t`<option value=${w} ?selected=${this.swArea===w}>${v}</option>`)}</select>
      </div>
      <div class="bulk" ?hidden=${!n.size} role="toolbar" aria-label="פעולה על המסומנים" data-sw-bulk>
        <span class="count">${n.size} מסומנים</span>
        ${I?t`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-sw-approve @click=${()=>this.approveSelected()}>אישור ההצעות (${I})</sw-button>`:o}
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="light" @click=${()=>this.mark("light",[...n])}>תאורה</sw-button>
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="not_light" @click=${()=>this.mark("not_light",[...n])}>לא תאורה</sw-button>
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="protected" @click=${()=>this.mark("protected",[...n])}>מוגן</sw-button>
        <sw-button size="sm" variant="ghost" @click=${()=>p(new Set)}>ניקוי</sw-button>
      </div>
      ${e.length?t`<table>
        <thead><tr><th class="c"><input type="checkbox" aria-label="סמן את כל המוצגים" data-sw-all .checked=${d} @change=${w=>{const v=w.target.checked,C=new Set(n);for(const G of e)v?C.add(G.entity_id):C.delete(G.entity_id);p(C)}}></th><th>שם</th><th>חדר</th><th>עכשיו</th><th>הצעה</th></tr></thead>
        <tbody>${i.map(w=>t`<tr data-sw-row=${w.entity_id} aria-selected=${String(n.has(w.entity_id))}>
          <td class="c"><input type="checkbox" aria-label=${"סמן "+w.name} .checked=${n.has(w.entity_id)} @change=${v=>h(w.entity_id,v.target.checked)}></td>
          <td><b>${w.name}</b>${w.locked?t`<div class="note">${Vs[w.locked]??""}</div>`:o}</td>
          <td>${w.area_name??t`<span class="note">בלי חדר</span>`}</td>
          <td><span class="cls ${w.class}">${ne[w.class]}</span></td>
          <td>${w.suggest?t`<span class="sug"><sw-button size="sm" ?disabled=${this.busy} data-sw-accept=${w.entity_id} @click=${()=>this.mark(w.suggest,[w.entity_id])}>${ne[w.suggest]}</sw-button><span class="why">${w.suggest_reason??""}</span></span>`:t`<span class="note">—</span>`}</td>
        </tr>`)}</tbody></table>
        ${s>1?t`<div class="pager"><sw-button size="sm" variant="ghost" ?disabled=${a===0} @click=${()=>{this.swPage=a-1}}>הקודם</sw-button><span>${a+1} מתוך ${s}</span><sw-button size="sm" variant="ghost" ?disabled=${a>=s-1} @click=${()=>{this.swPage=a+1}}>הבא</sw-button></div>`:o}`:t`<p class="note">אין מפסקים שמתאימים לסינון.</p>`}
    </section>`}render(){if(this.error&&!this.data)return t`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return t`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.data.users.find(i=>i.user_id===this.sel)??this.data.users[0],s=t`<div class="subtabs"><sw-tabs variant="underline-compact" group-label="ממשק ביתי" data-home-subtabs .items=${[{id:"users",label:"משתמשים"},{id:"install",label:"הגדרות התקנה"},{id:"switches",label:"סיווג מפסקים"}]} .active=${this.sub}
      @change=${i=>{this.sub=i.detail.id,this.message="",this.error="",this.sub==="switches"&&!this.sw&&this.loadSwitches()}}></sw-tabs></div>`,a=t`${this.message?t`<p class="msg ok" role="status">${this.message}</p>`:o}${this.error?t`<p class="msg err" role="alert">${this.error}</p>`:o}`;return this.sub==="install"?t`${s}${a}${this.installPane()}`:this.sub==="switches"?t`${s}${a}${this.switchesPane()}`:t`${s}
      ${a}
      <div class="grid">
        <section class="card" aria-label="משתמשים"><div class="users">${this.data.users.map(i=>t`<button class="u" data-home-user=${i.user_id} aria-current=${String(i.user_id===e?.user_id)} @click=${()=>{this.sel=i.user_id,this.message=""}}><b>${i.display_name}</b><span class="chip ${i.default_interface==="home"?"home":""}">${i.kiosk?"מסך קיר":i.home_only?"ביתי בלבד":i.default_interface==="home"?"ביתי":"מלא"}</span><span class="note">${i.home_only||!i.may_switch?"נעול":"מחליף"}</span></button>`)}</div></section>
        ${e?this.detail(e):o}
      </div>
      <section class="card extra">
        <h3>מסכי קיר ומועדפי התחלה</h3>
        <div class="srow"><div><b>קוד יציאה ממסך קיר</b><div class="note">${this.data.kiosk_code_set?"מוגדר. לחיצה ארוכה על השעון במסך הקיר מבקשת אותו.":"לא מוגדר: מסך קיר לא ייפתח בלי קוד."}</div></div>
          <div class="inline"><input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="4 עד 8 ספרות" aria-label="קוד יציאה" .value=${this.code} @input=${i=>{this.code=i.target.value.replace(/\D/g,"")}}><sw-button size="sm" @click=${()=>this.saveCode()}>${this.code?"שמירה":"מחיקת הקוד"}</sw-button></div></div>
        <div class="srow"><div><b>מועדפי התחלה</b><div class="note">מי שעוד לא סידר מועדפים בחדר רואה את אלה. משתמשים יכולים לשנות לעצמם.</div></div><sw-button size="sm" data-home-seed @click=${()=>this.seedFromMine()}>העתק את המועדפים שלי</sw-button></div>
      </section>`}detail(e){const s=this.rooms,a=n=>e.rooms==null||e.rooms.includes(n),i=n=>e.modules==null||e.modules.includes(n),r=(n,d,m,p)=>{const h=n??d,I=p?[...new Set([...h,m])]:h.filter(w=>w!==m);return I.length===d.length?null:I};return t`<section class="card" aria-label=${e.display_name} data-home-detail>
      <h3>${e.display_name}</h3>
      <div class="srow"><div><b>ממשק ברירת מחדל</b><div class="note">הממשק שנפתח בכניסה</div></div>
        <sw-view-switch label="ממשק ברירת מחדל" .options=${[{id:"home",label:"ביתי"},{id:"full",label:"מלא"}]} value=${e.home_only?"home":e.default_interface} ?disabled=${e.home_only} @change=${n=>this.save(e,{default_interface:n.detail})}></sw-view-switch></div>
      <div class="srow"><div><b>רשאי להחליף ממשק</b><div class="note">מציג את הבחירה בתפריט האישי</div></div><sw-toggle label="רשאי להחליף ממשק" labelHidden ?checked=${e.may_switch} ?disabled=${e.home_only||this.busy} @change=${n=>this.save(e,{may_switch:n.detail.checked})}></sw-toggle></div>
      <div class="srow"><div><b>ממשק ביתי בלבד</b><div class="note">${e.system_admin?"מנהל מערכת תמיד רשאי לממשק המלא.":"לא יכול לפתוח את הממשק המלא. השרת מסרב גם לבקשות שלו לאזורים של הממשק המלא."}</div></div><sw-toggle label="ממשק ביתי בלבד" labelHidden ?checked=${e.home_only} ?disabled=${e.system_admin||this.busy} @change=${n=>this.save(e,{home_only:n.detail.checked,...n.detail.checked?{}:{kiosk:!1}})}></sw-toggle></div>
      <div class="srow"><div><b>מצב מסך קיר</b><div class="note">נשאר תמיד בממשק הביתי ובחדר שלו, בלי תפריט אישי. יוצאים עם קוד המנהל.</div></div>
        <div class="inline">${e.kiosk||s.length?t`<select aria-label="החדר של מסך הקיר" ?disabled=${e.system_admin} @change=${n=>{const d=n.target.value;d&&this.save(e,{kiosk:!0,kiosk_area_id:d})}}><option value="">${e.kiosk?"חדר":"בחרו חדר"}</option>${s.map(n=>t`<option value=${n.id} ?selected=${e.kiosk_area_id===n.id}>${n.name}</option>`)}</select>`:o}<sw-toggle label="מצב מסך קיר" labelHidden ?checked=${e.kiosk} ?disabled=${e.system_admin||this.busy||!e.kiosk&&!e.kiosk_area_id} @change=${n=>this.save(e,{kiosk:n.detail.checked,kiosk_area_id:e.kiosk_area_id})}></sw-toggle></div></div>
      <div class="srow"><div><b>רשאי להזמין אורחים</b><div class="note">${e.can_invite?"מופיע בממשק הביתי תחת אינטרקום: אורח מקבל קוד זמני לדלת. דורש שהזמנת מבקרים מופעלת בהתקנה.":"הסימון לבדו לא מספיק: צריך גם הרשאה להזמנת מבקרים (משתמשים והרשאות), והזמנת מבקרים מופעלת בהתקנה."}</div></div><sw-toggle label="רשאי להזמין אורחים" labelHidden data-home-guests ?checked=${!!e.guests} ?disabled=${this.busy} @change=${n=>this.save(e,{guests:n.detail.checked})}></sw-toggle></div>
      <div class="cols">
        <div><b>מה מופיע בממשק הביתי</b>${this.data.modules.map(n=>t`<label class="chk"><input type="checkbox" .checked=${i(n)} @change=${d=>{const m=r(e.modules,this.data.modules,n,d.target.checked);this.save(e,m==null?{all_modules:!0}:{modules:m})}}><span>${Ys[n]}</span></label>`)}</div>
        <div><b>חדרים שהמשתמש רואה</b>${s.length?s.map(n=>t`<label class="chk"><input type="checkbox" .checked=${a(n.id)} @change=${d=>{const m=r(e.rooms,s.map(p=>p.id),n.id,d.target.checked);this.save(e,m==null?{all_rooms:!0}:{rooms:m})}}><span>${n.name}</span></label>`):t`<p class="note">עוד אין חדרים.</p>`}</div>
      </div>
    </section>`}};y.styles=H`
    /* HOME-V3-P1-2430: a room's wallpaper for everyone */
    .walls { display: flex; flex-wrap: wrap; gap: 8px; margin-block-start: 10px; }
    .wopt { display: grid; gap: 4px; justify-items: center; inline-size: 88px; padding: 6px; border: 1px solid var(--sw-border); border-radius: 10px; background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: 13px; cursor: pointer; min-block-size: 44px; }
    .wopt[aria-pressed="true"] { outline: 2px solid var(--sw-accent); outline-offset: 1px; }
    .wpv { inline-size: 72px; block-size: 44px; border-radius: 6px; background: var(--sw-surface-2); }
    .up { display: inline-flex; align-items: center; min-block-size: 40px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--sw-border); cursor: pointer; }

    :host { display: block; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: var(--sw-gap-lg, 20px); align-items: start; }
    @media (max-width: 900px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .card { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg, 12px); padding: 12px; min-inline-size: 0; }
    .users { display: grid; gap: 2px; padding: 6px; }
    .u { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-block-size: 44px; padding: 0 10px; border: 0; border-radius: var(--sw-r-md, 8px); background: none; color: var(--sw-text); font: inherit; text-align: start; cursor: pointer; }
    .u[aria-current='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .u b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .chip { font-size: var(--sw-fs-xs, 12px); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); white-space: nowrap; }
    .chip.home { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    h3 { margin: 0 0 4px; font-size: var(--sw-fs-lg, 16px); color: var(--sw-heading); }
    .srow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding-block: 10px; border-block-start: 1px solid var(--sw-border); }
    .note { color: var(--sw-text-3); font-size: var(--sw-fs-sm, 13px); }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; border-block-start: 1px solid var(--sw-border); padding-block-start: 10px; }
    @media (max-width: 600px) { .cols { grid-template-columns: 1fr; } }
    .chk { display: flex; align-items: center; gap: 8px; min-block-size: 32px; font-size: var(--sw-fs-sm, 13px); }
    .chk input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    select, input[type='password'] { font: inherit; min-block-size: 36px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md, 8px); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; }
    .msg { margin-block: 8px; font-size: var(--sw-fs-sm, 13px); } .msg.err { color: var(--sw-danger); } .msg.ok { color: var(--sw-success); }
    .extra { display: grid; gap: 10px; margin-block-start: 16px; }
    .inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .subtabs { margin-block-end: 16px; }
    .opts { display: grid; gap: 6px; }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: var(--sw-r-md, 8px); cursor: pointer; }
    .opt:hover { background: var(--sw-surface-2); }
    .opt input { margin-block-start: 3px; accent-color: var(--sw-accent); inline-size: 16px; block-size: 16px; }
    .opt b { display: block; font-weight: 600; }
    .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-block-end: 10px; }
    .bulk { position: sticky; inset-block-start: 0; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 10px; margin-block-end: 8px;
      border-radius: var(--sw-r-md, 8px); background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .bulk[hidden] { display: none; }
    .bulk .count { font-weight: 600; margin-inline-end: auto; }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm, 13px); }
    th, td { text-align: start; padding: 8px 6px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; }
    th { color: var(--sw-text-3); font-weight: 600; font-size: var(--sw-fs-xs, 12px); }
    td.c { inline-size: 32px; }
    td input, th input { inline-size: 16px; block-size: 16px; accent-color: var(--sw-accent); }
    tr[aria-selected='true'] td { background: var(--sw-surface-2); }
    .cls { font-size: var(--sw-fs-xs, 12px); padding: 2px 8px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); white-space: nowrap; }
    .cls.light { background: var(--sw-accent-soft); color: var(--sw-accent-text); }
    .cls.protected { background: var(--sw-surface-3, var(--sw-surface-2)); color: var(--sw-heading); font-weight: 600; }
    .sug { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .sug .why { color: var(--sw-text-3); font-size: var(--sw-fs-xs, 12px); }
    .pager { display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-block-start: 8px; color: var(--sw-text-3); font-size: var(--sw-fs-sm, 13px); }
  `;x([c()],y.prototype,"data",2);x([c()],y.prototype,"rooms",2);x([c()],y.prototype,"sel",2);x([c()],y.prototype,"error",2);x([c()],y.prototype,"message",2);x([c()],y.prototype,"busy",2);x([c()],y.prototype,"code",2);x([c()],y.prototype,"sub",2);x([c()],y.prototype,"inst",2);x([c()],y.prototype,"vis",2);x([c()],y.prototype,"sw",2);x([c()],y.prototype,"swError",2);x([c()],y.prototype,"swSel",2);x([c()],y.prototype,"swFilter",2);x([c()],y.prototype,"swArea",2);x([c()],y.prototype,"swPage",2);x([c()],y.prototype,"walls",2);x([c()],y.prototype,"wallRoom",2);x([c()],y.prototype,"wallStamp",2);y=x([N("sw-home-admin")],y);var Js=Object.defineProperty,Zs=Object.getOwnPropertyDescriptor,b=(e,s,a,i)=>{for(var r=i>1?void 0:i?Zs(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Js(s,a,r),r};const ye=[{id:"users",label:"משתמשים",count:oe.length},{id:"groups",label:"קבוצות",count:Ae.length},{id:"roles",label:"תפקידים",count:Ce.length},{id:"effective",label:"הרשאות אפקטיביות"},{id:"audit",label:"אודיט הרשאות"}],_e=new Set(["map.read","video.live","video.playback","video.export","events.read","events.ack","cases.manage"]);let f=class extends M{constructor(){super(...arguments),this.bubbleSkin=new ce(this),this.tabsMode=new He(this,"settings"),this.tab="users",this.selected=null,this.assigning=!1,this.step=0,this.directory=null,this.roles=null,this.groups=null,this.tree=null,this.audit=null,this.selectedGroup=null,this.wizard=null,this.members=null,this.newGroup="",this.preview=null,this.previewUser="",this.previewScope="installation:*",this.busy=!1,this.error="",this.message="",this.forbidden=!1,this.roleEdit=null,this.roleImpact=null,this.roleDelete=null,this.groupsMeta={can_manage:!1,delegated:!1},this.renameDraft=null,this.groupChange=null,this.remoteOff=null,this.roleImpactTimer=0,this.narrow=!1,this.narrowMq=null,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.onHash=()=>{window.location.hash.startsWith("#/system/access")&&this.readTab()},this.userColumns=[{key:"name",label:"שם",render:e=>t`<div class="who"><sw-avatar name=${String(e.name)} size=${30}></sw-avatar><div><strong>${String(e.name)}</strong>${e.haAdmin?t` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>`:""}<div class="ltr sub">${String(e.haUser)}@ha.local</div></div></div>`},{key:"role",label:"תפקיד",render:e=>{const s=e.bindings[0];return s?t`<span class="pillsel">${s.role}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:t`<span class="pillsel" style="color:var(--sw-text-3)">ללא שיוך<sw-icon name="chevronDown" size=${11}></sw-icon></span>`}},{key:"scope",label:"היקף גישה",render:e=>{const s=e.bindings[0];return s?t`<span class="pillsel">${s.scope}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:t`<span class="sub">—</span>`}},{key:"active",label:"מצב",render:e=>t`<span class="status ${e.active?"":"off"}"><i></i>${e.active?"פעיל":"מושבת ב־HA"}</span>`},{key:"lastSync",label:"סנכרון"},{key:"more",label:"",width:"40px",render:()=>t`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),this.readTab(),window.addEventListener("hashchange",this.onHash),this.narrowMq=window.matchMedia("(max-width: 767px)"),this.narrowMq.addEventListener("change",this.onNarrow),this.onNarrow(),P()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),this.narrowMq?.removeEventListener("change",this.onNarrow)}readTab(){const e=Me().params.get("tab")??"";(ye.some(a=>a.id===e)||e==="ha-users"&&(!P()||S("users.ha_manage"))||e==="local"&&P()&&S("identity.directory.read")||e==="home"&&P()&&S("rbac.assign"))&&e!==this.tab&&this.setTab(e)}setTab(e){this.tab=e,this.tab==="audit"&&P()&&this.loadAudit(),Ne("/system/access",e==="users"?void 0:new URLSearchParams({tab:e}))}async load(){this.error="";try{const[e,s,a,i]=await Promise.all([Ke(),B(),Fe(),Ge().catch(()=>null)]);this.directory=e,this.roles=s,this.groups=a.groups,this.groupsMeta={can_manage:!!a.can_manage,delegated:!!a.delegated},this.tree=i,this.forbidden=!1,this.previewUser||(this.previewUser=F.me?.user.id??"");const r=this.scopeOptions;r.length&&!r.some(n=>`${n.type}:${n.id}`===this.previewScope)&&(this.previewScope=`${r[0].type}:${r[0].id}`)}catch(e){const s=g(e);this.error=s,this.forbidden=/403|הרשאה|forbidden/i.test(s)&&!this.directory}}async loadAudit(){try{const[e,s]=await Promise.all([pe({prefix:"rbac.",limit:100}),pe({prefix:"identity.",limit:50})]);this.audit=[...e.rows,...s.rows].sort((a,i)=>a.at<i.at?1:-1).slice(0,150)}catch(e){this.error=g(e),this.audit=[]}}flash(e){this.message=e,setTimeout(()=>this.message="",3500)}get scopeOptions(){const e=this.directory?.assign_scopes;if(e&&e.length)return e;const s=[{type:"installation",id:"*",name:"כל ההתקנה"}];for(const a of this.tree?.sites??[]){s.push({type:"site",id:a.id,name:`אתר · ${a.name}`});for(const i of a.buildings??[]){s.push({type:"building",id:i.id,name:`${a.name} · ${i.name}`});for(const r of i.floors??[])s.push({type:"floor",id:r.id,name:`${a.name} · ${i.name} · ${r.name}`})}}return s}userName(e){return this.directory?.users.find(s=>s.id===e)?.name??e}label(e){return this.roles?.labels[e]??Se(e)??qe(e)??hs(e)??e}startWizard(e,s,a){const i=this.roles?.roles??[],r=i.some(d=>d.id==="viewer")?"viewer":i[0]?.id??"viewer",n=this.scopeOptions[0];this.wizard={subjectKind:e,subjectId:s,subjectName:a,roleId:r,scopeKey:n?`${n.type}:${n.id}`:"installation:*",effect:"allow"}}pickScopeKind(e,s){const i=this.scopeOptions.filter(r=>r.type==="camera"===s)[0];i&&(this.wizard={...e,scopeKey:`${i.type}:${i.id}`})}async previewGroupChange(e,s,a,i,r){this.busy=!0,this.error="";try{const n=await Ve(e.id,i);this.groupChange={heading:s,impact:n,confirmLabel:a,run:async()=>{await r(n.revision)}}}catch(n){this.error=g(n)}finally{this.busy=!1}}async confirmGroupChange(){const e=this.groupChange;if(e){this.busy=!0,this.error="";try{await e.run(),this.groupChange=null,await this.load()}catch(s){this.error=g(s),this.groupChange=null,await this.load()}finally{this.busy=!1}}}async saveWizard(){const e=this.wizard;if(!e)return;const[s,a]=e.scopeKey.split(":");if(e.subjectKind==="group"){const i=this.groups?.find(d=>d.id===e.subjectId);if(!i)return;const r=this.roles?.roles.find(d=>d.id===e.roleId),n=this.scopeOptions.find(d=>`${d.type}:${d.id}`===e.scopeKey);await this.previewGroupChange(i,`${e.effect==="deny"?"חסימה":"שיוך"} לקבוצה "${i.name}": ${r?.name??e.roleId} · ${n?.name??a}`,"שמור שיוך",{op:"bind",role_id:e.roleId,scope_type:s,scope_id:a,effect:e.effect},async d=>{await Ye(i.id,{role_id:e.roleId,scope_type:s,scope_id:a,effect:e.effect,revision:d}),this.wizard=null,this.flash(`שויך לקבוצה "${i.name}"`)});return}this.busy=!0,this.error="";try{const i=await he({subject_kind:e.subjectKind,subject_id:e.subjectId,role_id:e.roleId,scope_type:s,scope_id:a,effect:e.effect});this.flash(e.effect==="deny"?`נחסם: ${i.role_name} · ${i.scope_name} (רוויזיה ${i.revision})`:`שויך: ${i.role_name} · ${i.scope_name} (רוויזיה ${i.revision})`),this.wizard=null,await this.load()}catch(i){this.error=g(i)}finally{this.busy=!1}}async revoke(e){if(e.subject_kind==="group"&&!e.via_group){const s=this.groups?.find(a=>a.id===e.subject_id);if(s){await this.previewGroupChange(s,`ביטול שיוך של הקבוצה "${s.name}": ${e.role_name} · ${e.scope_name}`,"בטל שיוך",{op:"unbind",binding_id:e.id},async a=>{await Je(s.id,e.id,a),this.flash(`בוטל: ${e.role_name} · ${e.scope_name}`)});return}}this.busy=!0,this.error="";try{await Ze(e.id),this.flash(`בוטל: ${e.role_name} · ${e.scope_name}`),await this.load()}catch(s){this.error=g(s)}finally{this.busy=!1}}async sync(){this.busy=!0,this.error="";try{const e=await Qe();this.flash(e.requested?"הספרייה נדחפה מ־Home Assistant":e.note??"הספרייה מתעדכנת אוטומטית כל דקה"),await this.load()}catch(e){this.error=g(e)}finally{this.busy=!1}}async addGroup(){const e=this.newGroup.trim();if(e){this.busy=!0,this.error="";try{const s=await Xe(e);this.newGroup="",this.flash(`נוצרה קבוצה "${s.name}"`),await this.load(),this.selectedGroup=s.id}catch(s){this.error=g(s)}finally{this.busy=!1}}}async saveMembers(e){if(!this.members)return;const s=[...this.members];await this.previewGroupChange(e,`חברי הקבוצה "${e.name}"`,"שמור חברים",{op:"members",user_ids:s},async a=>{await es(e.id,s,a),this.members=null,this.flash("חברי הקבוצה עודכנו")})}async saveRename(e){const s=(this.renameDraft??"").trim();if(!s||s===e.name){this.renameDraft=null;return}this.busy=!0,this.error="";try{await ss(e.id,s,e.revision),this.renameDraft=null,this.flash(`שם הקבוצה עודכן ל"${s}"`),await this.load()}catch(a){this.error=g(a)}finally{this.busy=!1}}async removeGroup(e){this.busy=!0,this.error="";try{await ts(e.id,e.revision),this.selectedGroup=null,this.flash(`הקבוצה "${e.name}" נמחקה`),await this.load()}catch(s){this.error=g(s)}finally{this.busy=!1}}async runPreview(){if(!this.previewUser)return;const[e,s]=this.previewScope.split(":");this.busy=!0,this.error="";try{this.preview=await as({user_id:this.previewUser,scope_type:e,scope_id:s})}catch(a){this.error=g(a)}finally{this.busy=!1}}canRevoke(e,s){if(!s||e.via_group)return!1;const a=this.directory;return!(a?.delegated&&(!(a.assignable_roles??[]).includes(e.role_id)||e.subject_kind==="user"&&e.subject_id===F.me?.user.id))}renderBindingRow(e,s){return t`<div class="bind" data-binding=${e.id}>
      <div><strong>${e.role_name}</strong> · ${e.scope_name}${e.effect==="deny"?t` <sw-badge kind="forbidden" label="חסימה"></sw-badge>`:o}<div class="sub">${e.via_group?`דרך קבוצה "${e.via_group}" · `:""}מאז ${k(e.created_at)}${e.expires_at?` · עד ${k(e.expires_at)}`:""} · רוויזיה ${e.permission_revision}</div></div>
      ${this.canRevoke(e,s)?t`<sw-button size="sm" variant="ghost" icon="trash" data-revoke ?disabled=${this.busy} @click=${()=>this.revoke(e)}>ביטול</sw-button>`:o}
    </div>`}renderWizard(){const e=this.wizard;if(!e||!this.roles)return o;const s=this.roles.roles.find(h=>h.id===e.roleId),a=this.scopeOptions.find(h=>`${h.type}:${h.id}`===e.scopeKey),i=s?.system_role??!1,r=e.effect==="deny",n=s?.permissions.includes("rbac.assign")??!1,d=this.scopeOptions.filter(h=>h.type!=="camera"),m=this.scopeOptions.filter(h=>h.type==="camera"),p=e.scopeKey.startsWith("camera:");return t`<div class="wiz">
      <sw-steps .steps=${["תפקיד","היקף","תצוגה מקדימה","שמירה"]} .current=${2}></sw-steps>
      <div class="hint">שיוך ל${e.subjectKind==="group"?"קבוצה":"משתמש"}: <strong>${e.subjectName}</strong></div>
      ${this.directory?.delegated?o:t`<sw-field label="סוג שיוך"><select data-wizard-effect @change=${h=>this.wizard={...e,effect:h.target.value}}>
            <option value="allow" ?selected=${!r}>הרשאה — מוסיף את הרשאות התפקיד בהיקף</option>
            <option value="deny" ?selected=${r}>חסימה — מסיר את הרשאות התפקיד בהיקף, גם אם שיוך אחר מרשה</option>
          </select></sw-field>`}
      <sw-field label="תפקיד"><select data-wizard-role @change=${h=>this.wizard={...e,roleId:h.target.value}}>${this.roles.roles.map(h=>t`<option value=${h.id} ?selected=${h.id===e.roleId}>${h.name}</option>`)}</select></sw-field>
      <sw-field label="סוג היקף"><select data-wizard-scope-kind @change=${h=>this.pickScopeKind(e,h.target.value==="camera")}>
        <option value="place" ?selected=${!p}>התקנה / אתר / מבנה / קומה</option>
        <option value="camera" ?selected=${p} ?disabled=${!m.length||i||n}>מצלמה</option>
      </select></sw-field>
      ${p?t`<sw-field label="מצלמה"><select data-wizard-camera @change=${h=>this.wizard={...e,scopeKey:h.target.value}}>${m.map(h=>t`<option value=${`${h.type}:${h.id}`} ?selected=${`${h.type}:${h.id}`===e.scopeKey}>${h.name.replace(/^מצלמה · /,"")}</option>`)}</select></sw-field>`:t`<sw-field label="היקף"><select data-wizard-scope @change=${h=>this.wizard={...e,scopeKey:h.target.value}}>${d.map(h=>t`<option value=${`${h.type}:${h.id}`} ?selected=${`${h.type}:${h.id}`===e.scopeKey} ?disabled=${i&&h.type!=="installation"}>${h.name}</option>`)}</select></sw-field>`}
      ${p?t`<div class="hint" data-camera-scope-hint>היקף מצלמה: ההרשאות חלות על המצלמה הזו בלבד — שידור חי, הקלטות, אירועים וייצוא שלה. במפה תוצג תוכנית הקומה שלה עם המצלמה הזו בלבד, בלי ישויות Home Assistant ובלי מצלמות אחרות. חסימה ברמה רחבה יותר (קומה, אתר, התקנה) גוברת גם עליה.</div>`:o}
      ${this.directory?.delegated?t`<div class="hint" data-delegated-hint>כמנהל אתר מוצגים רק התפקידים שמותר לך להאציל וההיקפים שבאחריותך. אינך משנה את השיוכים של עצמך ואינך יוצר חסימות.</div>`:o}
      ${e.subjectKind==="group"?t`<div class="hint">לפני השמירה תוצג ההשפעה על כל אחד מחברי הקבוצה.</div>`:o}
      ${s?r?t`<div class="eff">
              <div><div class="sec">ייחסמו ב־${a?.name??"ההיקף"}</div>${s.permissions.map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
              <div class="hint" style="align-self:start">חסימה פועלת רק על ההרשאות שהתפקיד הזה מקנה, ורק בהיקף שנבחר. היא גוברת על כל שיוך "הרשאה" אחר לאותו משתמש באותה הרשאה ובאותו היקף (או היקף שמכיל אותו) — לא על שיוכים בהיקפים לא קשורים.</div>
            </div>`:p?t`<div class="eff" data-camera-effect>
                <div><div class="sec">מותר ב־${a?.name??"המצלמה"}</div>${s.permissions.filter(h=>_e.has(h)).map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
                <div><div class="sec">ללא השפעה בהיקף מצלמה</div>${s.permissions.filter(h=>!_e.has(h)).map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="close" size=${14} style="color:var(--sw-text-3)"></sw-icon></div>`)}<div class="row"><span>כל מצלמה אחרת</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
              </div>`:t`<div class="eff">
              <div><div class="sec">מותר ב־${a?.name??"ההיקף"}</div>${s.permissions.map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
              <div><div class="sec">לא כלול / מחוץ להיקף</div>${s.sensitive_missing.map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}<div class="row"><span>כל היקף אחר</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
            </div>`:o}
      ${i?t`<div class="hint">תפקיד עם הרשאות מערכת מוקצה רק ברמת ההתקנה כולה.</div>`:o}
      <div class="hint">הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־Home Assistant. השינוי נרשם באודיט עם diff לפני/אחרי.</div>
    </div>`}requestRemote(e,s){const a=e.remote_sessions??0;if(!s&&a>0&&(this.directory?.remote_policy??"flag")==="flag"&&!e.remote_admin_default){this.remoteOff={userId:e.id,count:a};return}this.toggleRemote(e.id,s)}async toggleRemote(e,s){this.busy=!0,this.error="",this.remoteOff=null;try{const a=await is(e,s);this.flash(s?"הגישה מרחוק הופעלה":a.sessions_ended?`הגישה מרחוק כובתה · ${a.sessions_ended} כניסות נסגרו`:"הגישה מרחוק כובתה"),await this.load()}catch(a){this.error=g(a),await this.load()}finally{this.busy=!1}}remoteStats(e){const s=e.remote_sessions??0;return`${s===0?"אין כניסות פעילות מרחוק":s===1?"כניסה פעילה אחת":`${s} כניסות פעילות`} · ${e.remote_last_sign_in?`כניסה אחרונה מרחוק ${k(e.remote_last_sign_in)}`:"טרם נכנס מרחוק"}`}renderUsersApi(){const e=this.directory,s=e.can_assign,a=e.delegated?[]:[{key:"remote_access",label:"מרחוק",render:d=>{const m=d,p=m.remote_sessions??0;return t`<span data-remote-col style="font-size:var(--sw-fs-xs)">${m.remote_access_basis==="admin_default"?"ברירת מחדל (מנהל)":m.remote_access?"מופעלת":"כבויה"}${p?t` · <sw-badge kind="live" label=${p===1?"מחובר":`${p} חיבורים`}></sw-badge>`:o}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${m.remote_last_sign_in?`אחרונה ${k(m.remote_last_sign_in)}`:"טרם נכנס"}</div>`}}],r=[{key:"name",label:"שם",render:d=>t`<div style="display:flex;align-items:center;gap:10px"><sw-avatar name=${String(d.name)} size=${30}></sw-avatar><div style="min-inline-size:0;white-space:normal;overflow-wrap:anywhere"><strong>${String(d.name)}</strong>${d.is_admin?t` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>`:o}${d.is_self?t` <sw-badge kind="recorded" label="אני"></sw-badge>`:o}${Z(String(d.name),String(d.username??""),String(d.id??""))?t`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3);direction:ltr;text-align:start">${Z(String(d.name),String(d.username??""),String(d.id??""))}</div>`:o}</div></div>`},{key:"bindings",label:"תפקיד · היקף",render:d=>{const m=d.bindings;return m.length?t`${m.slice(0,2).map(p=>t`<div style="font-size:var(--sw-fs-xs);white-space:normal;overflow-wrap:anywhere;min-inline-size:16ch"><strong>${p.role_name}</strong> · ${p.scope_name}${p.via_group?" (קבוצה)":""}${p.effect==="deny"?t` <span data-binding-deny style="color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)">· חסימה</span>`:o}</div>`)}${m.length>2?t`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">+${m.length-2}</div>`:o}`:t`<span style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">ללא שיוך · אין גישה לתוכן</span>`}},{key:"groups",label:"קבוצות",render:d=>{const m=d.groups.map(p=>p.name).join(", ");return t`<span title=${m} style="font-size:var(--sw-fs-xs);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere;min-inline-size:12ch;max-inline-size:32ch">${m||"—"}</span>`}},{key:"active",label:"מצב",render:d=>t`<span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--sw-fs-xs)"><i style="inline-size:7px;block-size:7px;border-radius:50%;background:${d.active?"var(--sw-live)":"var(--sw-offline)"}"></i>${d.active?"פעיל":"ללא גישה (HA)"}</span>`},{key:"sync_status",label:"סנכרון",render:d=>t`<span style="font-size:var(--sw-fs-xs)">${ue[d.sync_status]}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${d.last_seen_at?`נראה ${k(String(d.last_seen_at))}`:"טרם נכנס"}</div>`},...a].filter(d=>!this.narrow||!["groups","sync_status","remote_access"].includes(d.key)),n=e.users.find(d=>d.id===this.selected)??null;return t`
      <div class="stage">
        ${e.users.length?t`<sw-table .columns=${r} .rows=${e.users} .selected=${this.selected} @row-select=${d=>{this.selected=d.detail.id,this.wizard=null}}></sw-table>`:t`<sw-state-panel icon="users" state="empty" heading="אין משתמשים עדיין" hint=${e.directory.paired?"הספרייה תגיע מהגשר תוך דקה.":"צמד את גשר Arx ב־Home Assistant כדי לקבל את רשימת המשתמשים."}></sw-state-panel>`}
        ${n?t`<sw-drawer open modal heading=${n.name} subheading=${`Home Assistant · ${n.username||n.id} · ${n.active?"פעיל":"ללא גישה"}`} data-user-drawer @close=${()=>{this.selected=null,this.wizard=null}}>
              ${this.wizard&&this.wizard.subjectKind==="user"?this.renderWizard():t`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${n.id}</span></dd>
                    <dt>סנכרון</dt><dd>${ue[n.sync_status]}${n.synced_at?` · ${k(n.synced_at)}`:""}</dd>
                    <dt>ב־Arx</dt><dd>${n.first_seen_at?`מאז ${k(n.first_seen_at)} · לאחרונה ${k(n.last_seen_at)}`:"טרם נכנס לממשק"}</dd>
                    <dt>מנהל HA</dt><dd>${n.is_admin?"כן · מידע בלבד, לא תפקיד במערכת":"לא"}</dd>
                    <dt>קבוצות</dt><dd>${n.groups.map(d=>d.name).join(", ")||"—"}</dd>
                    ${e.delegated?o:t`<dt>גישה מרחוק</dt><dd data-remote-access>${S("system.configure")?t`<sw-toggle label="SmplWise Arx" .checked=${le(!!n.remote_access&&this.remoteOff?.userId!==n.id)} ?disabled=${this.busy||n.remote_access_basis==="admin_default"} data-remote-access-toggle @change=${d=>this.requestRemote(n,d.detail.checked)}></sw-toggle>`:n.remote_access_basis==="admin_default"?"ברירת מחדל (מנהל)":n.remote_access?"מופעלת":"כבויה"}
                      ${n.remote_access_basis==="admin_default"?t`<div class="sub" data-remote-admin-default>ברירת מחדל (מנהל) · משתנה בהגדרות ‹ גישה מרחוק</div>`:o}
                      <div class="sub" data-remote-stats>${this.remoteStats(n)}</div>
                      ${this.remoteOff?.userId===n.id?t`<div class="remote-off" role="alert" data-remote-off-impact>
                            <span>${this.remoteOff.count===1?"כניסה פעילה אחת תיסגר עכשיו":`${this.remoteOff.count} כניסות פעילות ייסגרו עכשיו`} (כולל חיבורי וידאו פתוחים).</span>
                            <sw-button size="sm" variant="danger" data-remote-off-confirm ?disabled=${this.busy} @click=${()=>void this.toggleRemote(n.id,!1)}>כבה וסגור</sw-button>
                            <sw-button size="sm" variant="ghost" @click=${()=>this.remoteOff=null}>ביטול</sw-button>
                          </div>`:o}</dd>`}
                    ${!e.delegated&&S("system.configure")?t`<dt>${ee("secondFactor.adminLabel")}</dt><dd data-second-factor-user><sw-second-factor-user .userId=${n.id}></sw-second-factor-user></dd>`:o}
                    ${!e.delegated&&S("system.configure")?t`<dt>${ee("secondFactor.overrideLabel")}</dt><dd data-second-factor-policy-user><sw-second-factor-policy kind="user" .subjectId=${n.id}></sw-second-factor-policy></dd>`:o}
                    ${!e.delegated&&S("system.configure")?t`<dt>אזעקה</dt><dd data-alarm-user-policy><system-alarm-user .userId=${n.id} ?canEdit=${!this.busy}></system-alarm-user></dd>`:o}
                  </dl>
                  <div class="sec">שיוכים</div>
                  ${n.bindings.length?n.bindings.map(d=>this.renderBindingRow(d,s)):t`<div class="hint">ללא שיוך: אין גישה לתוכן.</div>`}
                  <div class="hint">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.</div>`}
              <div slot="footer" class="dfoot">
                ${this.wizard?t`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${()=>this.saveWizard()}>שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>ביטול</sw-button>`:t`${s&&!(e.delegated&&n.is_self)?t`<sw-button variant="primary" size="sm" icon="plus" data-assign @click=${()=>this.startWizard("user",n.id,n.name)}>שיוך תפקיד</sw-button>`:o}
                    <sw-button variant="ghost" size="sm" icon="shield" data-user-effective @click=${()=>{this.previewUser=n.id,this.selected=null,this.setTab("effective"),this.runPreview()}}>הרשאות אפקטיביות</sw-button>`}
              </div>
            </sw-drawer>`:o}
      </div>
    `}renderGroupsApi(){const e=this.groups??[],s=this.directory,a=s.can_assign,i=[{key:"name",label:"קבוצה",render:v=>t`<strong>${String(v.name)}</strong>`},{key:"members",label:"חברים",render:v=>t`${v.members.length}`},{key:"bindings",label:"שיוכים (תפקיד · היקף)",render:v=>t`${v.bindings.map(C=>t`<div style="font-size:var(--sw-fs-xs)">${C.role_name} · ${C.scope_name}${C.effect==="deny"?t` <span data-binding-deny style="color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)">· חסימה</span>`:o}</div>`)}`}],r=e.find(v=>v.id===this.selectedGroup)??null,n=this.members??new Set(r?.members.map(v=>v.id)??[]),d=this.groupsMeta.can_manage,m=!!s.delegated,p=F.me?.user.id,h=r?r.members.length>0||r.bindings.length>0:!1,I=new Set(s.users.map(v=>v.id)),w=r?r.members.filter(v=>!I.has(v.id)):[];return t`
      <sw-card heading="קבוצות" subheading=${m?"הקבוצות שכל השיוכים שלהן בתוך ההיקף שלך · חברות ושיוך תפקידים מרשימת ההאצלה":"קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו · ההרשאות האפקטיביות = השיוכים האישיים + שיוכי הקבוצות, בכל היקף בנפרד"} data-groups-card>
        ${d?t`<div class="toolbar"><sw-field label="קבוצה חדשה"><input data-group-new .value=${this.newGroup} placeholder="למשל: עורכי קומה 2" @input=${v=>this.newGroup=v.target.value} @keydown=${v=>{v.key==="Enter"&&this.addGroup()}} /></sw-field><sw-button size="sm" icon="plus" data-group-create ?disabled=${this.busy||!this.newGroup.trim()} @click=${()=>this.addGroup()}>יצירה</sw-button></div>`:t`<div class="hint">${m?"יצירה, שינוי שם ומחיקה של קבוצות — מנהל המערכת בלבד. קבוצה שיש לה שיוך מחוץ להיקף שלך, או שאתה חבר בה, אינה מוצגת כאן.":"יצירה, שינוי שם ומחיקה של קבוצות דורשים ניהול תפקידים (מנהל מערכת)."}</div>`}
      </sw-card>
        <div class="stage groups-stage">
          ${e.length?t`<sw-table .columns=${i} .rows=${e} .selected=${this.selectedGroup} @row-select=${v=>{this.selectedGroup=v.detail.id,this.members=null,this.wizard=null,this.renameDraft=null}}></sw-table>`:t`<sw-state-panel icon="users" state="empty" heading="אין קבוצות" hint=${m?"אין קבוצה שכל השיוכים שלה בתוך ההיקף שלך.":"קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו. קבוצות Arx בלבד, לא קבוצות HA."}></sw-state-panel>`}
          ${r?t`<sw-drawer open modal heading=${r.name} subheading=${`${r.members.length} חברים · ${r.bindings.length} שיוכים · רוויזיה ${r.revision}`} data-group-drawer @close=${()=>{this.selectedGroup=null,this.members=null,this.wizard=null,this.renameDraft=null}}>
                ${this.wizard&&this.wizard.subjectKind==="group"?this.renderWizard():t`${d?t`<div class="toolbar" style="margin-block-end:8px"><sw-field label="שם הקבוצה"><input data-group-rename .value=${this.renameDraft??r.name} @input=${v=>this.renameDraft=v.target.value} @keydown=${v=>{v.key==="Enter"&&this.saveRename(r)}} /></sw-field><sw-button size="sm" data-group-rename-save ?disabled=${this.busy||this.renameDraft===null||!this.renameDraft.trim()||this.renameDraft.trim()===r.name} @click=${()=>this.saveRename(r)}>שינוי שם</sw-button></div>`:o}
                    <div class="sec">שיוכים של הקבוצה</div>
                    ${r.bindings.length?r.bindings.map(v=>this.renderBindingRow(v,a)):t`<div class="hint">ללא שיוך: החברים אינם מקבלים דבר דרך הקבוצה.</div>`}
                    <div class="sec">חברים · ${n.size}</div>
                    <div class="members in-drawer">${s.users.map(v=>t`<label><input type="checkbox" data-member=${v.id} ?disabled=${!a||m&&v.id===p} .checked=${n.has(v.id)} @change=${C=>{const G=new Set(n);C.target.checked?G.add(v.id):G.delete(v.id),this.members=G}} /> ${v.name}<span class="hint">${v.active?"":" · ללא גישה"}${m&&v.id===p?" · לא ניתן לצרף את עצמך":""}</span></label>`)}${w.map(v=>t`<label><input type="checkbox" checked disabled /> ${v.name}<span class="hint"> · מחוץ לרשימה שלך</span></label>`)}</div>
                    <div class="hint">שינוי חברות ושיוך נבדקים מול כל השיוכים של הקבוצה, מוצגים לפני השמירה עם ההשפעה על כל משתמש, ונרשמים באודיט.</div>
                    ${d&&h?t`<div class="hint" data-group-in-use>מחיקה אפשרית רק לקבוצה ללא חברים וללא שיוכים — הסר אותם קודם.</div>`:o}`}
                <div slot="footer" class="dfoot">
                  ${this.wizard?t`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${()=>this.saveWizard()}>שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>ביטול</sw-button>`:t`${a?t`<sw-button variant="primary" size="sm" icon="check" data-group-save-members ?disabled=${this.busy||!this.members} @click=${()=>this.saveMembers(r)}>שמור חברים</sw-button>
                          <sw-button size="sm" icon="plus" data-group-bind ?disabled=${this.busy} @click=${()=>this.startWizard("group",r.id,r.name)}>שיוך תפקיד</sw-button>`:o}
                      ${d?t`<sw-button variant="danger" size="sm" icon="trash" class="end" data-group-delete ?disabled=${this.busy||h} @click=${()=>this.removeGroup(r)}>מחיקה</sw-button>`:o}`}
                </div>
                ${this.renderGroupChange()}
              </sw-drawer>`:o}
        </div>
      ${r?o:this.renderGroupChange()}
    `}renderGroupChange(){const e=this.groupChange;if(!e)return o;const s=e.impact,a=r=>s.labels[r]??this.label(r),i={member:"חבר",added:"מצטרף",removed:"יוצא"};return t`<sw-dialog open heading="השפעת השינוי" subheading=${e.heading} data-group-impact @close=${()=>this.groupChange=null}>
      <div class="impact">
        <strong>${s.users.length} משתמשים מושפעים</strong>${s.scopes.length?t` · היקפים: ${s.scopes.map(r=>r.scope_name).join(", ")}`:t` · לקבוצה אין שיוך, ולכן השינוי אינו משנה הרשאות`}
      </div>
      ${s.users.length?t`<div class="members" style="margin-block-start:8px">${s.users.map(r=>t`<div class="bind" data-impact-user=${r.id}>
            <div><strong>${r.name}</strong> <sw-badge kind=${r.change==="removed"?"forbidden":"recorded"} label=${i[r.change]}></sw-badge>
              <div class="sub">${r.added.length?t`<span class="ok">יתווספו: ${r.added.map(a).join(", ")}</span>`:"ללא הרשאות חדשות"} · ${r.removed.length?t`<span class="err">יוסרו: ${r.removed.map(a).join(", ")}</span>`:"ללא הסרות"}</div></div>
          </div>`)}</div>`:t`<div class="hint" style="margin-block-start:8px">אין חברים בקבוצה: אף משתמש אינו מושפע כרגע. מי שיצורף בהמשך יירש את השיוך.</div>`}
      <div class="hint" style="margin-block-start:8px">הרשאות בתוך Arx בלבד. השינוי נרשם באודיט (מזהים בלבד) וחל מהבקשה הבאה של כל משתמש.</div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.groupChange=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-group-impact-confirm ?disabled=${this.busy} @click=${()=>this.confirmGroupChange()}>${e.confirmLabel}</sw-button>
    </sw-dialog>`}openRole(e){this.roleImpact=null;const s=new Set(this.roles?.sensitive??[]);this.roleEdit=e?{id:e.id,revision:e.revision??1,name:e.name,description:e.description??"",permissions:e.permissions.filter(a=>!s.has(a)),sensitive:e.permissions.filter(a=>s.has(a)),delegable:!!e.delegable}:{id:null,revision:0,name:"",description:"",permissions:["map.read"],sensitive:[],delegable:!1},this.scheduleImpact()}toggleRolePerm(e,s){const a=this.roleEdit;if(!a)return;const i=s?"sensitive":"permissions",r=a[i].includes(e)?a[i].filter(n=>n!==e):[...a[i],e];this.roleEdit={...a,[i]:r},this.scheduleImpact()}scheduleImpact(){window.clearTimeout(this.roleImpactTimer),this.roleImpactTimer=window.setTimeout(()=>void this.loadImpact(),300)}async loadImpact(){const e=this.roleEdit;if(!e||!e.permissions.length&&!e.sensitive.length){this.roleImpact=null;return}try{this.roleImpact=await rs({role_id:e.id,permissions:e.permissions,sensitive:e.sensitive})}catch(s){this.error=g(s)}}async saveRole(){const e=this.roleEdit;if(!(!e||!e.name.trim())){this.busy=!0,this.error="";try{const s={name:e.name.trim(),description:e.description,permissions:e.permissions,sensitive:e.sensitive,delegable:e.delegable&&!e.sensitive.length&&!e.permissions.includes("rbac.assign")};if(e.id){await ns(e.id,{...s,revision:e.revision}),this.roleEdit=null,this.roleImpact=null,this.message="התפקיד עודכן; השינוי חל על כל המשויכים ברענון הבא",this.roles=await B();return}const a=await os(s);this.roleEdit=null,this.roleImpact=null,this.roles=await B();const i=F.me?.user.id;if(e.assignMe!==!1&&i)try{await he({subject_kind:"user",subject_id:i,role_id:a.id,scope_type:"installation",scope_id:"*"}),this.message=`התפקיד "${a.name}" נוצר ושויך אליך (כל המתקן). ההרשאות החדשות ייכנסו לתוקף ברענון הבא של הדף.`}catch(r){this.message=`התפקיד "${a.name}" נוצר, אך השיוך האוטומטי אליך נכשל (${g(r)}). שייך אותו ידנית בלשונית "שיוכים".`}else this.message=`התפקיד "${a.name}" נוצר. שייך אותו למשתמש או לקבוצה בלשונית "שיוכים".`}catch(s){this.error=g(s)}finally{this.busy=!1}}}setAllRolePerms(e,s,a){const i=this.roleEdit;i&&(this.roleEdit={...i,[e]:a?[...new Set([...i[e],...s])]:i[e].filter(r=>!s.includes(r))},this.scheduleImpact())}async removeRole(e){this.busy=!0,this.error="";try{await ls(e.id),this.roleDelete=null,this.roles=await B()}catch(s){this.error=g(s),this.roleDelete=null}finally{this.busy=!1}}async toggleDelegable(e){const s=this.roles?.delegable_roles??[],a=s.includes(e)?s.filter(i=>i!==e):[...s,e];this.busy=!0,this.error="";try{await ds(a),this.roles=await B()}catch(i){this.error=g(i)}finally{this.busy=!1}}renderRoleDialog(){const e=this.roleEdit,s=this.roles;if(!e||!s)return o;const a=new Set(s.sensitive),i=new Set(s.system_permissions??[]),r=Object.keys(s.labels).filter(p=>!a.has(p)&&!i.has(p)),n=new Set(e.id?s.roles.find(p=>p.id===e.id)?.permissions??[]:[]),d=Ws(Bs(s.sensitive,s.legacy_permissions,n),s.system_permissions),m=this.roleImpact;return t`<sw-dialog open heading=${e.id?"עריכת תפקיד מותאם":"תפקיד מותאם חדש"} subheading="הרשאות רגילות + הרשאות רגישות במפורש · ללא הרשאות מערכת · ההשפעה מוצגת לפני השמירה" data-role-dialog @close=${()=>this.roleEdit=null}>
      ${this.error?t`<div class="err banner" data-role-error>${this.error}</div>`:o}
      <sw-field label="שם"><input data-role-name .value=${e.name} @input=${p=>this.roleEdit={...e,name:p.target.value}} /></sw-field>
      <sw-field label="תיאור"><input .value=${e.description} @input=${p=>this.roleEdit={...e,description:p.target.value}} /></sw-field>
      <div class="hint permsrow">הרשאות רגילות
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-perm-all @click=${()=>this.setAllRolePerms("permissions",r,!0)}>בחר הכל</sw-button>
          <sw-button size="sm" variant="ghost" data-role-perm-none @click=${()=>this.setAllRolePerms("permissions",r,!1)}>נקה הכל</sw-button>
        </span>
      </div>
      <div class="perms">${r.map(p=>t`<label class="chk"><input type="checkbox" data-role-perm=${p} .checked=${e.permissions.includes(p)} @change=${()=>this.toggleRolePerm(p,!1)} /> ${s.labels[p]}</label>`)}</div>
      <div class="hint permsrow" style="margin-block-start:6px">הרשאות רגישות — לעולם לא מרומזות, נדרשות במפורש
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-sensitive-all @click=${()=>this.setAllRolePerms("sensitive",d,!0)}>בחר הכל</sw-button>
          <sw-button size="sm" variant="ghost" data-role-sensitive-none @click=${()=>this.setAllRolePerms("sensitive",d,!1)}>נקה הכל</sw-button>
        </span>
      </div>
      <div class="perms">${d.map(p=>t`<label class="chk sens"><input type="checkbox" data-role-sensitive=${p} .checked=${e.sensitive.includes(p)} @change=${()=>this.toggleRolePerm(p,!0)} /> ${s.labels[p]??p}</label>`)}</div>
      ${e.id?o:t`<label class="chk" style="margin-block-start:6px"><input type="checkbox" data-role-assign-me .checked=${e.assignMe!==!1} @change=${p=>this.roleEdit={...e,assignMe:p.target.checked}} /> שייך את התפקיד אליי מיד (כל המתקן)</label>`}
      <label class="chk" style="margin-block-start:6px"><input type="checkbox" data-role-delegable ?disabled=${e.sensitive.length>0||e.permissions.includes("rbac.assign")} .checked=${e.delegable&&!e.sensitive.length&&!e.permissions.includes("rbac.assign")} @change=${p=>this.roleEdit={...e,delegable:p.target.checked}} /> מנהל אתר רשאי להקצות תפקיד זה בהיקפו (בכפוף להרשאות שהוא מחזיק)${e.sensitive.length||e.permissions.includes("rbac.assign")?t`<span class="hint"> · לא זמין: תפקיד עם הרשאה רגישה או עם שיוך תפקידים אינו ניתן להאצלה</span>`:o}</label>
      ${m?t`<div class="impact" data-role-impact>
            <strong>השפעת השינוי:</strong> ${m.bindings} שיוכים · ${m.users.length} משתמשים${m.users.length?` (${m.users.map(p=>p.name).join(", ")})`:""}${m.groups.length?` · ${m.groups.length} קבוצות`:""}${m.scopes.length?` · היקפים: ${m.scopes.join(", ")}`:""}
            <div>${m.added.length?t`יתווספו: ${m.added.map(p=>s.labels[p]??p).join(", ")}`:"ללא הרשאות חדשות"} · ${m.removed.length?t`<span class="err">יוסרו: ${m.removed.map(p=>s.labels[p]??p).join(", ")}</span>`:"ללא הסרות"}</div>
          </div>`:o}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.roleEdit=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-role-save ?disabled=${this.busy||!e.name.trim()||!e.permissions.length&&!e.sensitive.length} @click=${()=>this.saveRole()}>${e.id?"שמירה":"צור תפקיד"}</sw-button>
    </sw-dialog>`}renderRolesApi(){const e=this.roles;return t`<div class="roles">${e.roles.map(s=>t`<sw-card class="role" data-role-card=${s.id}><h4><span class="ic"><sw-icon name=${s.custom?"user":s.id==="viewer"?"eye":s.id==="operator"?"play":s.id==="editor"?"edit":s.id==="site_admin"?"building":s.id==="kiosk"?"grid":"shield"} size=${14}></sw-icon></span>${s.name}${s.custom?t` <sw-badge kind="recorded" label="מותאם"></sw-badge>`:o}${s.system_role?t` <sw-badge kind="neutral" label="הרשאות מערכת"></sw-badge>`:o}${s.delegable?t` <sw-badge kind="historic" label="ניתן להאצלה"></sw-badge>`:o}</h4>${s.description?t`<div class="desc">${s.description}</div>`:o}<div class="a">מותר: ${s.permissions.map(a=>this.label(a)).join(", ")}</div><div class="d">לא כלול אוטומטית: ${s.sensitive_missing.map(a=>this.label(a)).join(", ")||"—"}</div>${S("system.configure")?t`<div class="pol" data-second-factor-policy-role>${ee("secondFactor.overrideLabel")}<sw-second-factor-policy kind="role" .subjectId=${s.id}></sw-second-factor-policy></div>`:o}${s.custom&&e.can_manage_roles?t`<div class="acts"><sw-button size="sm" data-role-edit @click=${()=>this.openRole(s)}>עריכה</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-role-delete @click=${()=>this.roleDelete=s}>מחיקה</sw-button></div>`:o}</sw-card>`)}</div>
      ${e.can_manage_roles?t`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" data-role-new @click=${()=>this.openRole()}>תפקיד מותאם חדש</sw-button></div>
            <sw-card heading="האצלת שיוך תפקידים למנהלי אתר" subheading="מנהל אתר משייך רק תפקידים מהרשימה הזו, רק הרשאות שהוא מחזיק בעצמו, רק בתוך ההיקף שלו, ולעולם לא לעצמו; קבוצה — רק כשכל השיוכים שלה בהיקף שלו" style="margin-block-start:12px" data-delegation>
              <div class="chips">${e.roles.filter(s=>!s.delegation_block).map(s=>t`<sw-chip data-delegable=${s.id} ?selected=${(e.delegable_roles??[]).includes(s.id)} @click=${()=>void this.toggleDelegable(s.id)}>${s.name}</sw-chip>`)}</div>
              <div class="hint" style="margin-block-start:6px" data-delegation-blocked>לעולם לא ניתנים להאצלה: ${e.roles.filter(s=>s.delegation_block).map(s=>`${s.name} (${s.delegation_block==="system_role"?"תפקיד ניהול / הרשאות מערכת":s.delegation_block==="assign_role"?"כולל שיוך תפקידים":"הרשאה רגישה"})`).join(" · ")||"—"}. ברירת המחדל: צופה ומפעיל.</div>
            </sw-card>`:e.delegated?t`<div class="hint" style="margin-block-start:10px" data-delegation>מוצגים רק התפקידים שמותר לך לשייך בהיקף שלך (רשימת ההאצלה של ההתקנה). עריכת תפקידים והרשימה — מנהל המערכת בלבד.</div>`:o}
      <div class="hint">תפקידים מובנים אינם נערכים; תפקיד מותאם מורכב מהרשאות רגילות ומהרשאות רגישות שניתנות במפורש, ולעולם לא מהרשאות מערכת. התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>
      <elec-permission-rows .roles=${e}></elec-permission-rows>
      ${this.renderRoleDialog()}
      ${this.roleDelete?t`<sw-dialog open heading="מחיקת תפקיד" subheading=${this.roleDelete.name} @close=${()=>this.roleDelete=null}>
            <div class="hint">תפקיד משויך אינו נמחק: בטל קודם את השיוכים. המחיקה נרשמת באודיט.</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.roleDelete=null}>ביטול</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-role-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeRole(this.roleDelete)}>מחק</sw-button>
          </sw-dialog>`:o}`}doorPermissionNote(e){const s=We(e,S("system.configure"));return s?t`<div class="hint" style="margin-block-start:12px" data-effective-door-note>${s.text}${s.link?t` <a data-effective-door-link href=${s.link.href}>${s.link.label}</a>`:o}</div>`:o}renderEffectiveApi(){const e=this.directory,s=this.preview;return t`
      <div class="toolbar">
        <sw-field label="משתמש"><select @change=${a=>this.previewUser=a.target.value}>${e.users.map(a=>t`<option value=${a.id} ?selected=${a.id===this.previewUser}>${a.name}</option>`)}</select></sw-field>
        <sw-field label="היקף"><select @change=${a=>this.previewScope=a.target.value}>${this.scopeOptions.map(a=>t`<option value=${`${a.type}:${a.id}`} ?selected=${`${a.type}:${a.id}`===this.previewScope}>${a.name}</option>`)}</select></sw-field>
        <sw-button variant="primary" icon="shield" data-effective-run ?disabled=${this.busy||!this.previewUser} @click=${()=>this.runPreview()}>חשב</sw-button>
      </div>
      ${s?t`<sw-card heading=${`${this.userName(s.user_id)} · ${s.scope_name}`} subheading=${s.active?`רוויזיה ${s.revision}`:"המשתמש ללא גישה (מושבת או נמחק ב־HA)"}>
            <div class="eff">
              <div><div class="sec">מותר בהיקף</div>${s.allowed.length?s.allowed.map(a=>t`<div class="row"><span>${this.label(a)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`):t`<div class="row"><span>כלום</span></div>`}</div>
              <div><div class="sec">מחוץ להיקף / לא מוקנה</div>${s.denied.map(a=>t`<div class="row"><span>${this.label(a)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
            </div>
            ${this.doorPermissionNote(s.allowed)}
            ${s.bindings.length?t`<div class="sec">שיוכים שנלקחו בחשבון</div>${s.bindings.map(a=>t`<div class="bind"><div>${a.role_name} · ${a.scope_name}${a.via_group?` (קבוצה "${a.via_group}")`:""}</div></div>`)}`:o}
            <div class="hint" style="margin-block-start:12px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו; החישוב נעשה בצד השרת.</div>
          </sw-card>`:t`<sw-state-panel icon="shield" state="empty" heading="בחר משתמש והיקף" hint="החישוב מראה מה מותר ומה לא למשתמש בהיקף שנבחר, לפי השיוכים האישיים ושיוכי הקבוצות." data-effective-idle></sw-state-panel>`}
    `}renderAuditApi(){if(!this.audit)return this.loadAudit(),t`<sw-state-panel state="loading"></sw-state-panel>`;const e=[{key:"at",label:"זמן",render:s=>t`<span style="font-size:var(--sw-fs-xs)">${k(String(s.at))}</span>`},{key:"actor_username",label:"מבצע",render:s=>t`${String(s.actor_username??"מערכת / HA")}`},{key:"action",label:"פעולה",render:s=>t`${cs[String(s.action)]??String(s.action)}`},{key:"resource_id",label:"משאב",render:s=>t`${s.resource_type==="user"?this.userName(String(s.resource_id)):s.resource_type==="group"?this.groups?.find(a=>a.id===s.resource_id)?.name??String(s.resource_id):String(s.resource_id??"")}`},{key:"decision",label:"החלטה",render:s=>t`<sw-badge kind=${s.decision==="denied"?"forbidden":"live"} label=${s.decision==="denied"?`נחסם${s.reason?` · ${String(s.reason)}`:""}`:"הותר"}></sw-badge>`},{key:"details",label:"פרטים",render:s=>{const a=s.details,i=[a.role_id?`${String(a.role_id)}`:"",a.scope?String(a.scope):"",Array.isArray(a.added)&&a.added.length?`+${a.added.length}`:"",Array.isArray(a.removed)&&a.removed.length?`−${a.removed.length}`:"",a.revision?`rev ${String(a.revision)}`:""].filter(Boolean);return t`<span style="font-size:var(--sw-fs-xs);direction:ltr;unicode-bidi:isolate">${i.join(" · ")}</span>`}}];return t`<sw-lookup-scope></sw-lookup-scope>${this.audit.length?t`<sw-table dense .columns=${e} .rows=${this.audit} rowKey="at"></sw-table>`:t`<sw-state-panel icon="users" state="empty" heading="אין רשומות אודיט הרשאות" hint="כל שיוך, ביטול, קבוצה או שינוי מצב משתמש יופיע כאן."></sw-state-panel>`}`}renderApi(){if(this.forbidden)return t`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="forbidden" hint="צפייה בספריית המשתמשים דורשת תפקיד מנהל מערכת."></sw-state-panel></sw-page>`;if(this.error&&!this.directory)return t`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.directory||!this.roles)return t`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.directory,s=[{id:"users",label:"משתמשים",count:e.users.length},{id:"groups",label:"קבוצות",count:this.groups?.length??0},{id:"roles",label:"תפקידים",count:this.roles.roles.length},{id:"effective",label:"הרשאות אפקטיביות"},...!e.delegated||e.assignable_roles?.includes("door_opener")?[{id:"doors",label:"פתיחת דלתות"}]:[],...e.delegated&&!this.groupsMeta.can_manage?[]:[{id:"audit",label:"אודיט הרשאות"}],...S("users.ha_manage")?[{id:"ha-users",label:u("tab")}]:[],...S("identity.directory.read")?[{id:"local",label:l("tab")}]:[],...S("rbac.assign")?[{id:"home",label:"ממשק ביתי"}]:[]],a=e.delegated&&!this.groupsMeta.can_manage?`מנהל אתר · שיוך תפקידים מרשימת ההאצלה בתוך ההיקף שלך בלבד · ${e.users.length} משתמשים פעילים · רוויזיית הרשאות ${e.revision}`:e.directory.paired?`זהות מ־Home Assistant · ${e.directory.users} משתמשים בספרייה · עודכן ${k(e.directory.last_directory_at)} · רוויזיית הרשאות ${e.revision}`:"זהות מ־Home Assistant · הגשר עדיין לא מצומד: מוצגים רק משתמשים שנכנסו דרך Ingress";return t`
      <sw-page heading="משתמשים והרשאות" subheading=${a}>
        ${e.delegated?o:t`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>סנכרון משתמשים מ־HA</sw-button>`}
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props("").variant} ?adaptive=${this.tabsMode.props("").adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label="הרשאות" .items=${s} .active=${this.tab} @change=${i=>this.setTab(i.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. ${S("users.ha_manage")?'משתמש חדש נוצר בלשונית "משתמשי מערכת הבית" (תמיד כמשתמש רגיל) או במסך של מערכת הבית.':'אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.'}</div>
        ${this.message||this.error?t`<div class="bar">${this.message?t`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:o}${this.error?t`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:o}</div>`:o}
        ${this.tab==="users"?this.renderUsersApi():this.tab==="groups"?this.renderGroupsApi():this.tab==="roles"?this.renderRolesApi():this.tab==="effective"?this.renderEffectiveApi():this.tab==="doors"?t`<sw-door-grants data-door-grants></sw-door-grants>`:this.tab==="ha-users"?t`<sw-ha-users data-ha-users-tab></sw-ha-users>`:this.tab==="home"?t`<sw-home-admin data-home-admin-tab></sw-home-admin>`:this.tab==="local"?t`<system-local-users data-local-users-tab .roles=${de(this.roles.roles)} .scopes=${this.scopeOptions}></system-local-users>`:this.renderAuditApi()}
      </sw-page>
    `}renderUsers(){const e=oe.find(s=>s.id===this.selected);return t`
      <div class="stage">
        <sw-table .columns=${this.userColumns} .rows=${oe} .selected=${this.selected} @row-select=${s=>{this.selected=s.detail.id,this.assigning=!1}}></sw-table>
        ${e?t`<sw-drawer open heading=${e.name} subheading=${`HA: ${e.haUser} · ${e.active?"פעיל":"מושבת"}`} @close=${()=>this.selected=null}>
              ${this.assigning?t`<div class="wiz">
                    <sw-steps .steps=${["תפקיד","היקף","תצוגה מקדימה","שמירה"]} .current=${this.step}></sw-steps>
                    <sw-field label="קבוצה או תפקיד"><select><option>עורך מפות ותצוגות</option><option>מפעיל</option><option>צופה</option><option>מנהל אתר/מבנה/קומה</option></select></sw-field>
                    <sw-field label="היקף"><select><option>מבנה א · קומה 2</option><option>מבנה א</option><option>אתר הדגמה</option></select></sw-field>
                    <div class="eff">
                      <div><div class="sec">מותר בהיקף</div><div class="row"><span>עריכת תוכנית קומה 2</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div><div class="row"><span>הצבת ציוד מורשה</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div></div>
                      <div><div class="sec">לא ניתן</div><div class="row"><span>עריכת קומה 3</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>ניהול משתמשים / NVR</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>פתיחת מנעול</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
                    </div>
                    <div class="hint">הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־HA. השינוי ירשם באודיט עם diff לפני/אחרי.</div>
                  </div>`:t`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${e.haUser}</span></dd>
                    <dt>סנכרון אחרון</dt><dd>${e.lastSync}</dd>
                    <dt>קבוצות</dt><dd>${e.groups.join(", ")||"—"}</dd>
                    <dt>שיוכים</dt><dd>${e.bindings.length?e.bindings.map(s=>t`<div>${s.role} · ${s.scope}</div>`):"ללא: אין גישה לתוכן"}</dd>
                  </dl>
                  <div class="hint">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.</div>`}
              <div slot="footer" class="dfoot">
                ${this.assigning?t`<sw-button variant="primary" size="sm" icon="check">שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.assigning=!1}>ביטול</sw-button>`:t`<sw-button variant="primary" size="sm" icon="plus" @click=${()=>{this.assigning=!0,this.step=2}}>שיוך תפקיד</sw-button><sw-button variant="ghost" size="sm" icon="shield">הרשאות אפקטיביות</sw-button>`}
              </div>
            </sw-drawer>`:""}
      </div>
    `}renderGroups(){return t`<sw-table .columns=${[{key:"name",label:"קבוצה",render:s=>t`<strong>${String(s.name)}</strong>`},{key:"members",label:"חברים"},{key:"bindings",label:"שיוכים (תפקיד · היקף)",render:s=>t`${s.bindings.map(a=>t`<div>${a}</div>`)}`},{key:"more",label:"",width:"40px",render:()=>t`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]} .rows=${Ae}></sw-table><div class="hint">שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.</div>`}renderRoles(){return t`<div class="roles">${Ce.map(e=>t`<sw-card class="role"><h4><span class="ic"><sw-icon name=${e.id==="viewer"?"eye":e.id==="operator"?"play":e.id==="editor"?"edit":e.id==="site_admin"?"building":"shield"} size=${14}></sw-icon></span>${e.name}</h4><div class="a">מותר: ${e.allowed}</div><div class="d">לא ניתן אוטומטית: ${e.denied}</div></sw-card>`)}</div><div class="hint">תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>`}renderEffective(){return t`
      <sw-card heading="דנה · עורכת קומה 2">
        <div class="eff">
          <div>
            <div class="sec">מבנה א · קומה 2</div>
            ${["מפה: קריאה","תוכנית: יבוא/עריכה/פרסום","מיקומים ותצוגות: עריכה","שידור חי: מצלמות מורשות"].map(e=>t`<div class="row"><span>${e}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}
          </div>
          <div>
            <div class="sec">מחוץ להיקף / לא מוקנה</div>
            ${["קומה 3: הכל","Playback וייצוא","ניהול משתמשים","הגדרות NVR / go2rtc","פתיחת מנעול"].map(e=>t`<div class="row"><span>${e}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}
          </div>
        </div>
        <div class="hint" style="margin-block-start:8px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו. permission_revision: 7.</div>
      </sw-card>
    `}renderAudit(){return t`<sw-table dense .columns=${[{key:"time",label:"זמן"},{key:"user",label:"משתמש",render:s=>t`<div class="who"><sw-avatar name=${String(s.user)} size=${24}></sw-avatar>${String(s.user)}</div>`},{key:"action",label:"פעולה"},{key:"resource",label:"משאב"},{key:"decision",label:"החלטה",render:s=>t`<sw-badge kind=${String(s.decision).startsWith("נחסם")?"forbidden":"live"} label=${String(s.decision)}></sw-badge>`},{key:"role",label:"תפקיד/היקף ששימשו"}]} .rows=${Be.filter(s=>s.action.includes("תוכנית")||s.action.includes("סנכרון")||s.action.includes("Ingress"))}></sw-table>`}render(){return P()?this.renderApi():t`
      <sw-page heading="משתמשים והרשאות" subheading="זהות מ־Home Assistant · הרשאות בתוך Arx בלבד · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון משתמשים מ־HA</sw-button>
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props("").variant} ?adaptive=${this.tabsMode.props("").adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label="הרשאות" .items=${[...ye,{id:"ha-users",label:u("tab")}]} .active=${this.tab} @change=${e=>this.setTab(e.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. ${S("users.ha_manage")?'משתמש חדש נוצר בלשונית "משתמשי מערכת הבית" (תמיד כמשתמש רגיל) או במסך של מערכת הבית.':'אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.'}</div>
        ${this.tab==="users"?this.renderUsers():this.tab==="groups"?this.renderGroups():this.tab==="roles"?this.renderRoles():this.tab==="effective"?this.renderEffective():this.tab==="ha-users"?t`<sw-ha-users data-ha-users-tab></sw-ha-users>`:this.renderAudit()}
      </sw-page>
    `}};f.styles=[xe,H`
    .notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-xs);
    }
    /* ACCESS-POLISH-2331: the user and group drawers are modal (fixed to the viewport, actions always in view), so the stage no longer
       reserves a fixed 420 / 620 px height for an absolutely placed panel - a short list ends where its rows end */
    .stage {
      position: relative;
    }
    .groups-stage {
      margin-block-start: 12px;
    }
    /* a section label inside a drawer, a dialog or a result card (was an inline style repeated a dozen times) */
    .sec {
      margin-block: 12px 4px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .sec:first-child {
      margin-block-start: 0;
    }
    .msg {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-sm);
    }
    .msg.ok {
      background: var(--sw-success-soft);
    }
    .msg.err {
      background: var(--sw-danger-soft);
    }
    .who {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .who .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: start;
    }
    .pillsel {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      background: var(--sw-surface);
      color: var(--sw-text);
      white-space: nowrap;
    }
    .pillsel sw-icon {
      color: var(--sw-text-3);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .status.off i {
      background: var(--sw-offline);
    }
    .perms {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 10px;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .chk.sens {
      color: var(--sw-warning-text);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .impact {
      margin-block-start: 8px;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .err.banner {
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-danger-soft);
      border: 1px solid var(--sw-danger);
    }
    .permsrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .permsel {
      display: flex;
      gap: 4px;
    }
    .roles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .role h4 {
      margin: 0 0 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-md);
    }
    .role .ic {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .role .a {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-xs);
    }
    .role .d {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    /* a custom role's own description is plain text, not a warning (it used the red "not included" style) */
    .role .desc {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      margin-block-end: 4px;
    }
    .role .pol {
      margin-block-start: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .role .acts {
      display: flex;
      gap: 6px;
      margin-block-start: 10px;
    }
    .role .a,
    .role .d {
      line-height: 1.5;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      min-inline-size: 0;
    }
    dd .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .remote-off {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-block-start: 6px;
      padding: 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-danger-soft);
      font-size: var(--sw-fs-xs);
    }
    .eff {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .eff .row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-xs);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .wiz {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bind {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .bind .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .members {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
      font-size: var(--sw-fs-sm);
    }
    /* inside a drawer the panel body is the one scroll container: no second, nested scroll for the member list */
    .members.in-drawer {
      max-block-size: none;
      overflow: visible;
    }
    .members label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 2px;
    }
    .bar {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: var(--sw-success-text);
    }
    .err {
      color: var(--sw-danger-text);
    }
    /* the drawer footer's actions: one row with a gap; a destructive action sits apart at the far end */
    .dfoot {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      inline-size: 100%;
    }
    .dfoot .end {
      margin-inline-start: auto;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-wrap: wrap;
    }
  `,ke];b([c()],f.prototype,"tab",2);b([c()],f.prototype,"selected",2);b([c()],f.prototype,"assigning",2);b([c()],f.prototype,"step",2);b([c()],f.prototype,"directory",2);b([c()],f.prototype,"roles",2);b([c()],f.prototype,"groups",2);b([c()],f.prototype,"tree",2);b([c()],f.prototype,"audit",2);b([c()],f.prototype,"selectedGroup",2);b([c()],f.prototype,"wizard",2);b([c()],f.prototype,"members",2);b([c()],f.prototype,"newGroup",2);b([c()],f.prototype,"preview",2);b([c()],f.prototype,"previewUser",2);b([c()],f.prototype,"previewScope",2);b([c()],f.prototype,"busy",2);b([c()],f.prototype,"error",2);b([c()],f.prototype,"message",2);b([c()],f.prototype,"forbidden",2);b([c()],f.prototype,"roleEdit",2);b([c()],f.prototype,"roleImpact",2);b([c()],f.prototype,"roleDelete",2);b([c()],f.prototype,"groupsMeta",2);b([c()],f.prototype,"renameDraft",2);b([c()],f.prototype,"groupChange",2);b([c()],f.prototype,"remoteOff",2);b([c()],f.prototype,"narrow",2);f=b([N("system-access")],f);export{f as SystemAccess};
//# sourceMappingURL=system-access-CdXSk5ie.js.map
