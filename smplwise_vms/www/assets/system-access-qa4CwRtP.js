import{i as S,b8 as O,g as W,g9 as fe,C as ge,E as U,G as c,a as E,S as ie,j as G,T as f,A as l,e as t,q as ze,bW as Se,H as T,F,bc as q,tO as o,tP as Ae,b9 as D,bb as Ce,tQ as Re,tR as Oe,tS as I,tT as Pe,cG as Ue,tU as Ee,tV as be,du as Te,aB as je,tW as se,tX as $e,tY as ye,aw as x,r as De,af as Ie,R as H,tZ as Ne,eF as Y,t_ as Le,t$ as He}from"./index-Cke5lP-r.js";import"./system-alarm-Ke859nPi.js";import{l as te}from"./live-CU7KAl3n.js";import"./sw-table-Ca1XuNyu.js";import"./sw-steps-B2V6WV6t.js";import"./sw-chip-BlTLYAbO.js";import"./system-doors-CGb66bi5.js";import{fmtWhen as y,listUsers as Me,listRoles as N,listGroups as Ge,listAudit as re,groupImpact as qe,bindGroup as Ke,createBinding as ne,unbindGroup as Be,revokeBinding as We,syncDirectory as Fe,createGroup as Ve,setGroupMembers as Ye,renameGroup as Ze,deleteGroup as Je,previewAccess as Qe,setRemoteAccess as Xe,SYNC_LABEL as oe,previewRole as es,updateRole as ss,createRole as ts,deleteRole as as,setDelegation as is,ACTION_LABEL as rs}from"./access-4wbCv92j.js";import{e as ns}from"./styles-BB41gvlM.js";import{b as os}from"./access-d8W2giMA.js";import"./sw-logo-art-Va6y_cIM.js";const R={users:[{ha_user_id:"demo-1",username:"dana",display_name:"דנה לוי",role_id:"viewer",role_name:"צופה",scope_type:"installation",scope_id:"*",scope_name:"כל ההתקנה",state:"active",repair:null,person:!0,created_at:"2026-10-16T08:00:00Z",created_by_name:"מנהל",is_self:!1},{ha_user_id:"demo-2",username:"yossi",display_name:"יוסי כהן",role_id:"operator",role_name:"מפעיל",scope_type:"installation",scope_id:"*",scope_name:"כל ההתקנה",state:"inactive",repair:null,person:!0,created_at:"2026-10-15T08:00:00Z",created_by_name:"מנהל",is_self:!1}],can_manage:!0,actor_ha_admin:!0,transport:"supervisor",access:{state:"ok",checked_at:"2026-10-16T08:00:00Z"},roles:[{id:"viewer",name:"צופה"},{id:"operator",name:"מפעיל"},{id:"editor",name:"עורך מפות ותצוגות"}],scopes:[{type:"installation",id:"*",name:"כל ההתקנה"}],password:{min_length:10,max_length:128},limit:50},M=e=>JSON.parse(JSON.stringify(e)),L={async view(){return S()?W("/ha-users"):M(R)},async check(){return S()?O("/ha-users/check",{}):{access:M(R.access),transport:R.transport}},async create(e){if(S())return O("/ha-users",e);const s=R.roles.find(i=>i.id===e.role_id),a={ha_user_id:`demo-${Date.now()}`,username:e.username,display_name:e.display_name,role_id:e.role_id,role_name:s?.name??e.role_id,scope_type:e.scope_type,scope_id:e.scope_id,scope_name:"כל ההתקנה",state:"active",repair:null,person:e.create_person,created_at:new Date().toISOString(),created_by_name:"מנהל",is_self:!1};return R.users.push(a),{user:M(a),replayed:!1}},async setActive(e,s){if(S())return O(`/ha-users/${encodeURIComponent(e)}/${s?"activate":"deactivate"}`,{confirm:!0});const a=R.users.find(i=>i.ha_user_id===e);return a&&(a.state=s?"active":"inactive"),{user:M(a)}},async remove(e,s){return S()?O(`/ha-users/${encodeURIComponent(e)}/delete`,{confirm_username:s}):(R.users=R.users.filter(a=>a.ha_user_id!==e),{deleted:e,already_gone:!1})}},ls={tab:"משתמשי מערכת הבית",title:"משתמשי מערכת הבית",sub:"יצירת משתמש רגיל במערכת הבית עם תפקיד ב־Arx. מכאן אפשר להשבית או למחוק רק משתמשים שנוצרו כאן.",keywords:"משתמש חדש יצירה מחיקה השבתה סיסמה מערכת הבית",loading:"טוען…",forbidden:"ניהול משתמשי מערכת הבית שמור למנהלי המערכת.",retry:"נסו שוב",accessTitle:"הרשאה במערכת הבית",check:"בדיקת הרשאה",checking:"בודק…",checkedAt:"נבדק {time}",acc_ok:"למערכת יש הרשאה לנהל משתמשים במערכת הבית.",acc_unknown:'עוד לא נבדק. לחצו "בדיקת הרשאה" לפני יצירת המשתמש הראשון.',acc_not_authorised:"למערכת אין הרשאת מנהל במערכת הבית, ולכן אי אפשר ליצור או למחוק משתמשים מכאן.",acc_not_authorised_fix:'מה עושים: במערכת הבית, בפרופיל של חשבון מנהל, יוצרים אסימון גישה לטווח ארוך (Long-Lived Access Token), ושומרים אותו בהגדרות ‹ חיבורים ‹ סודות בשורה "אסימון מנהל לניהול משתמשי מערכת הבית". אין צורך בהפעלה מחדש; אחר כך לוחצים שוב "בדיקת הרשאה". אפשר גם להמשיך לנהל משתמשים במסך המשתמשים של מערכת הבית.',acc_unavailable:"מערכת הבית אינה זמינה כרגע. נסו שוב בעוד רגע.",acc_not_configured:"החיבור למערכת הבית אינו מוגדר בהתקנה הזו.",acc_failed:"הבדיקה נכשלה. נסו שוב.",via_supervisor:"בזהות התוסף",via_token:"באסימון המנהל שהוגדר",notHaAdmin:"רק מנהל של מערכת הבית יכול ליצור, להשבית או למחוק משתמשים. אפשר לצפות ברשימה.",listTitle:"משתמשים שנוצרו דרך Arx",empty:"עוד לא נוצרו משתמשים מכאן.",emptyHint:'משתמשים קיימים של מערכת הבית מופיעים בלשונית "משתמשים", ושם משייכים להם תפקידים.',add:"משתמש חדש",count:"{n} מתוך {max}",colName:"שם",colUser:"שם משתמש",colRole:"תפקיד ב־Arx",colState:"מצב",st_active:"פעיל",st_inactive:"מושבת",st_needs_repair:"דורש תיקון",repair_person_missing:"נוצר בלי כרטיס אדם",repair_compensation_failed:"היצירה נכשלה באמצע; יש למחוק",repair_binding_failed:"שיוך התפקיד נכשל; יש למחוק",repair_cleanup_failed:"הניקוי לא הושלם; יש למחוק שוב",repair_missing_in_ha:"לא נמצא במערכת הבית; יש למחוק",you:"אתם",deactivate:"השבתה",activate:"הפעלה",remove:"מחיקה",createTitle:"משתמש חדש במערכת הבית",createSub:"המשתמש נוצר כמשתמש רגיל (לא מנהל) ומקבל את התפקיד שנבחר ב־Arx בלבד.",fName:"שם מוצג",fUsername:"שם משתמש לכניסה",fUsernameHint:"אותיות לטיניות קטנות, ספרות, נקודה, מקף או קו תחתון; 3 עד 32 תווים.",fPassword:"סיסמה",fPassword2:"סיסמה שוב",fPasswordHint:"לפחות {min} תווים, לא סיסמה נפוצה ולא רצף. הסיסמה לא נשמרת ב־Arx ולא תוצג שוב.",fRole:"תפקיד ב־Arx",fScope:"היקף",fPerson:"ליצור גם כרטיס אדם במערכת הבית",create:"יצירה",cancel:"ביטול",created:"המשתמש {name} נוצר.",createdNoPerson:"המשתמש {name} נוצר, אך כרטיס האדם לא נוצר.",e_name:"נדרש שם מוצג.",e_username:"שם המשתמש אינו בפורמט הנדרש.",e_mismatch:"הסיסמאות אינן זהות.",e_role:"יש לבחור תפקיד.",pw_too_short:"הסיסמה קצרה מדי.",pw_too_long:"הסיסמה ארוכה מדי.",pw_repetitive:"הסיסמה חוזרת על אותם תווים.",pw_common:"הסיסמה נפוצה מדי.",pw_sequence:"הסיסמה היא רצף מקלדת או ספרות.",pw_contains_username:"הסיסמה מכילה את שם המשתמש.",pw_contains_name:"הסיסמה מכילה את השם המוצג.",deactivateTitle:"השבתת {name}",deactivateBody:"המשתמש לא יוכל להיכנס למערכת הבית ול־Arx עד שיופעל שוב. אפשר להפעיל אותו מחדש בכל עת.",activateTitle:"הפעלת {name}",activateBody:"המשתמש יוכל להיכנס שוב, עם התפקיד שלו ב־Arx.",confirm:"אישור",deactivated:"המשתמש הושבת.",activated:"המשתמש הופעל.",removeTitle:"מחיקת {name}",removeBody:"המשתמש יימחק ממערכת הבית, כל התפקידים שלו ב־Arx יבוטלו והכניסות הפתוחות שלו ייסגרו. אי אפשר לבטל את המחיקה. השבתה היא האפשרות הבטוחה יותר.",removeType:"להקליד את שם המשתמש {username} כדי לאשר",removeConfirm:"מחיקה לצמיתות",removed:"המשתמש נמחק."},ds={tab:"Home system users",title:"Home system users",sub:"Create an ordinary home-system user with an Arx role. Only users created here can be deactivated or deleted here.",loading:"Loading…",forbidden:"Managing home-system users is reserved for system administrators.",retry:"Try again",accessTitle:"Permission in the home system",check:"Check permission",checking:"Checking…",checkedAt:"Checked {time}",acc_ok:"Arx may manage users in the home system.",acc_unknown:'Not checked yet. Press "Check permission" before creating the first user.',acc_not_authorised:"Arx has no administrator permission in the home system, so users cannot be created or deleted from here.",acc_not_authorised_fix:`What to do: in the home system, in an administrator account's profile, create a long-lived access token, and save it in Settings › Connections › Secrets as "Home-system users administrator token". No restart is needed; then press "Check permission" again. You can also keep managing users in the home system's own users screen.`,acc_unavailable:"The home system is not reachable right now. Try again in a moment.",acc_not_configured:"This installation has no home-system connection.",acc_failed:"The check failed. Try again.",notHaAdmin:"Only a home-system administrator can create, deactivate or delete users. You can view the list.",listTitle:"Users created through Arx",empty:"No users were created here yet.",add:"New user",colName:"Name",colUser:"Username",colRole:"Arx role",colState:"State",st_active:"Active",st_inactive:"Deactivated",st_needs_repair:"Needs repair",you:"You",deactivate:"Deactivate",activate:"Activate",remove:"Delete",createTitle:"New home-system user",createSub:"The user is created as an ordinary (non-administrator) user and gets only the chosen Arx role.",fName:"Display name",fUsername:"Login username",fPassword:"Password",fPassword2:"Repeat password",fPasswordHint:"At least {min} characters, not a common password or a run. The password is not kept by Arx and is never shown again.",fRole:"Arx role",fScope:"Scope",fPerson:"Also create a person card in the home system",create:"Create",cancel:"Cancel",created:"User {name} was created.",confirm:"Confirm",removeTitle:"Delete {name}",removeType:"Type the username {username} to confirm",removeConfirm:"Delete permanently",removed:"The user was deleted."};function cs(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function p(e,s){const a=(cs()==="en"?ds[e]:void 0)??ls[e]??e;return s?a.replace(/\{(\w+)\}/g,(i,r)=>r in s?String(s[r]):i):a}const ps=/^[a-z0-9][a-z0-9._-]{2,31}$/;function le(e,s){return e.toLowerCase()===s.toLowerCase()}const hs=["0123456789","9876543210","abcdefghijklmnopqrstuvwxyz","zyxwvutsrqponmlkjihgfedcba","qwertyuiopasdfghjklzxcvbnm"];function us(e,s,a,i=10,r=128){if(e.length<i)return"too_short";if(e.length>r)return"too_long";const n=e.toLowerCase();return new Set(n).size<=2?"repetitive":hs.some(d=>d.includes(n)||(d+d).includes(n))?"sequence":s.length>=3&&n.includes(s.toLowerCase())?"contains_username":a.toLowerCase().split(/\s+/).some(d=>d.length>=3&&n.includes(d))?"contains_name":null}const Z=(e="viewer")=>({display_name:"",username:"",password:"",password2:"",role_id:e,scope:"installation:*",create_person:!0});function de(e,s=10,a=128){const i={};e.display_name.trim()||(i.display_name="e_name"),ps.test(e.username)||(i.username="e_username");const r=us(e.password,e.username,e.display_name,s,a);return r?i.password=`pw_${r}`:e.password!==e.password2&&(i.password2="e_mismatch"),e.role_id||(i.role_id="e_role"),i}function ms(e,s,a){const i=s.actor_ha_admin&&!e.is_self&&a!=="not_authorised"&&a!=="not_configured";return{deactivate:i&&e.state==="active",activate:i&&e.state==="inactive",remove:i}}function vs(e){return`st_${e.state}`}function ws(e){return e.repair?`repair_${e.repair}`:null}function fs(e){return`acc_${e}`}function gs(e){return e.actor_ha_admin&&e.users.length<e.limit&&e.access.state!=="not_authorised"&&e.access.state!=="not_configured"&&e.transport!=="none"}function ce(){const e=new Uint8Array(12);return globalThis.crypto.getRandomValues(e),Array.from(e,s=>s.toString(16).padStart(2,"0")).join("")}var bs=Object.defineProperty,$s=Object.getOwnPropertyDescriptor,k=(e,s,a,i)=>{for(var r=i>1?void 0:i?$s(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&bs(s,a,r),r};let _=class extends E{constructor(){super(...arguments),this.bubbleSkin=new ie(this),this.view=null,this.loadState="loading",this.error="",this.ok="",this.busy=!1,this.checking=!1,this.createOpen=!1,this.draft=Z(),this.touched=!1,this.formError="",this.confirm=null,this.removing=null,this.typed="",this.requestKey=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{this.view=await L.view(),this.loadState="ready"}catch(e){this.loadState=e instanceof G&&e.status===403?"forbidden":"error",this.error=f(e)}}flash(e){this.ok=e,this.error=""}async runCheck(){if(this.view){this.checking=!0;try{const e=await L.check();this.view={...this.view,access:e.access,transport:e.transport}}catch(e){this.error=f(e)}finally{this.checking=!1}}}openCreate(){this.draft=Z(this.view?.roles.some(e=>e.id==="viewer")?"viewer":this.view?.roles[0]?.id??""),this.touched=!1,this.formError="",this.requestKey=ce(),this.createOpen=!0}closeCreate(){this.createOpen=!1,this.draft=Z()}async submitCreate(){if(!this.view)return;this.touched=!0;const e=de(this.draft,this.view.password.min_length,this.view.password.max_length);if(Object.keys(e).length)return;const[s,...a]=this.draft.scope.split(":");this.busy=!0,this.formError="";try{const i=await L.create({display_name:this.draft.display_name.trim(),username:this.draft.username,password:this.draft.password,role_id:this.draft.role_id,scope_type:s,scope_id:a.join(":")||"*",create_person:this.draft.create_person,request_key:this.requestKey});this.closeCreate(),this.flash(p(i.user.repair==="person_missing"?"createdNoPerson":"created",{name:i.user.display_name})),await this.load()}catch(i){this.draft={...this.draft,password:"",password2:""},this.formError=f(i),i instanceof G&&i.code!=="password_weak"&&i.code!=="username_taken"&&i.code!=="validation"&&(this.requestKey=ce(),await this.load())}finally{this.busy=!1}}async submitConfirm(){const e=this.confirm;if(e){this.busy=!0;try{await L.setActive(e.user.ha_user_id,e.kind==="activate"),this.confirm=null,this.flash(p(e.kind==="activate"?"activated":"deactivated")),await this.load()}catch(s){this.confirm=null,this.error=f(s),await this.load()}finally{this.busy=!1}}}async submitRemove(){const e=this.removing;if(!(!e||!le(this.typed,e.username))){this.busy=!0;try{await L.remove(e.ha_user_id,this.typed),this.removing=null,this.typed="",this.flash(p("removed")),await this.load()}catch(s){this.removing=null,this.typed="",this.error=f(s),await this.load()}finally{this.busy=!1}}}renderAccess(e){const s=e.access.state,a=s==="ok"?"tone-ok":s==="unknown"?"":s==="unavailable"?"tone-warn":"tone-err",i=s==="ok"?"check":s==="unknown"?"info":"warning";return t`<sw-card data-ha-access=${s}>
      <div class="head"><h3>${p("accessTitle")}</h3></div>
      <div class="access">
        <sw-icon class=${a} name=${i} size=${18}></sw-icon>
        <div class="text">
          <span class=${a} data-access-text>${p(fs(s))}</span>
          ${s==="not_authorised"?t`<span class="fix" data-access-fix>${p("acc_not_authorised_fix")}</span>`:l}
          ${e.access.checked_at?t`<span class="meta">${p("checkedAt",{time:y(e.access.checked_at)})} · ${p(e.transport==="token"?"via_token":"via_supervisor")}</span>`:l}
        </div>
        <sw-button size="sm" icon="refresh" data-ha-check ?disabled=${this.checking||e.transport==="none"} @click=${()=>void this.runCheck()}>${this.checking?p("checking"):p("check")}</sw-button>
      </div>
      ${e.actor_ha_admin?l:t`<div class="msg warn" style="margin-block-start:var(--sw-s-2)" data-not-ha-admin><sw-icon name="lock" size=${13}></sw-icon>${p("notHaAdmin")}</div>`}
    </sw-card>`}renderRow(e,s){const a=ms(e,s,s.access.state),i=ws(e);return t`<div class="item" data-ha-user=${e.username}>
      <span class="name"><span>${ze(e.display_name)}${e.is_self?t` <span class="chip">${p("you")}</span>`:l}</span>
        ${i?t`<span class="sub">${p(i)}</span>`:l}</span>
      <span class="user ltr">${e.username}</span>
      <span class="role">${e.role_name} · ${e.scope_name}</span>
      <span class=${`chip ${e.state}`} data-state=${e.state}>${p(vs(e))}</span>
      <span class="row-actions">
        ${a.deactivate?t`<sw-button size="sm" variant="secondary" data-deactivate @click=${()=>this.confirm={user:e,kind:"deactivate"}}>${p("deactivate")}</sw-button>`:l}
        ${a.activate?t`<sw-button size="sm" variant="secondary" data-activate @click=${()=>this.confirm={user:e,kind:"activate"}}>${p("activate")}</sw-button>`:l}
        ${a.remove?t`<sw-button size="sm" variant="ghost" icon="trash" data-remove @click=${()=>{this.removing=e,this.typed=""}}>${p("remove")}</sw-button>`:l}
      </span>
    </div>`}renderList(e){return t`<sw-card data-ha-list>
      <div class="head">
        <h3>${p("listTitle")}</h3><span class="count">${p("count",{n:e.users.length,max:e.limit})}</span><span class="grow"></span>
        ${gs(e)?t`<sw-button variant="primary" size="sm" icon="plus" data-ha-add @click=${()=>this.openCreate()}>${p("add")}</sw-button>`:l}
      </div>
      ${e.users.length===0?t`<sw-state-panel icon="users" compact state="empty" heading=${p("empty")} hint=${p("emptyHint")}></sw-state-panel>`:t`<div class="list" role="list">
            <div class="item hdr" aria-hidden="true"><span>${p("colName")}</span><span>${p("colUser")}</span><span>${p("colRole")}</span><span>${p("colState")}</span><span></span></div>
            ${Se(e.users,s=>s.ha_user_id,s=>this.renderRow(s,e))}
          </div>`}
    </sw-card>`}field(e,s){this.draft={...this.draft,[e]:s}}renderCreate(e){const s=this.touched?de(this.draft,e.password.min_length,e.password.max_length):{},a=i=>s[i]?t`<span class="ferr" role="alert">${p(s[i])}</span>`:l;return t`<sw-dialog heading=${p("createTitle")} subheading=${p("createSub")} .open=${this.createOpen} data-ha-create @close=${()=>this.closeCreate()}>
      <form class="form" autocomplete="off" @submit=${i=>{i.preventDefault(),this.submitCreate()}}>
        <label>${p("fName")}<input class="in" maxlength="60" data-f-name aria-invalid=${String(!!s.display_name)} .value=${this.draft.display_name}
          @input=${i=>this.field("display_name",i.target.value)} />${a("display_name")}</label>
        <label>${p("fUsername")}<input class="in ltr" dir="ltr" maxlength="32" autocapitalize="off" spellcheck="false" data-f-username aria-invalid=${String(!!s.username)}
          .value=${this.draft.username} @input=${i=>this.field("username",i.target.value.trim().toLowerCase())} />
          <span class="hint">${p("fUsernameHint")}</span>${a("username")}</label>
        <label>${p("fPassword")}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${e.password.max_length} data-f-password
          aria-invalid=${String(!!s.password)} .value=${this.draft.password} @input=${i=>this.field("password",i.target.value)} />
          <span class="hint">${p("fPasswordHint",{min:e.password.min_length})}</span>${a("password")}</label>
        <label>${p("fPassword2")}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${e.password.max_length} data-f-password2
          aria-invalid=${String(!!s.password2)} .value=${this.draft.password2} @input=${i=>this.field("password2",i.target.value)} />${a("password2")}</label>
        <label>${p("fRole")}<select class="in" data-f-role .value=${this.draft.role_id} @change=${i=>this.field("role_id",i.target.value)}>
          ${e.roles.map(i=>t`<option value=${i.id} ?selected=${i.id===this.draft.role_id}>${i.name}</option>`)}</select>${a("role_id")}</label>
        ${e.scopes.length>1?t`<label>${p("fScope")}<select class="in" data-f-scope .value=${this.draft.scope} @change=${i=>this.field("scope",i.target.value)}>
          ${e.scopes.map(i=>t`<option value=${`${i.type}:${i.id}`} ?selected=${`${i.type}:${i.id}`===this.draft.scope}>${i.name}</option>`)}</select></label>`:l}
        <label class="check"><sw-toggle data-f-person .checked=${this.draft.create_person} @change=${i=>this.draft={...this.draft,create_person:i.target.checked}}></sw-toggle>${p("fPerson")}</label>
        ${this.formError?t`<span class="msg err" role="alert" data-form-error><sw-icon name="warning" size=${13}></sw-icon>${this.formError}</span>`:l}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.closeCreate()}>${p("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-f-submit ?disabled=${this.busy} @click=${()=>void this.submitCreate()}>${p("create")}</sw-button>
    </sw-dialog>`}renderConfirm(){const e=this.confirm,s=e?.user.display_name??"";return t`<sw-dialog heading=${e?p(e.kind==="activate"?"activateTitle":"deactivateTitle",{name:s}):""} .open=${!!e} data-ha-confirm @close=${()=>this.confirm=null}>
      <p class="body">${e?p(e.kind==="activate"?"activateBody":"deactivateBody"):""}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.confirm=null}>${p("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-confirm-go ?disabled=${this.busy} @click=${()=>void this.submitConfirm()}>${p("confirm")}</sw-button>
    </sw-dialog>`}renderRemove(){const e=this.removing;return t`<sw-dialog heading=${e?p("removeTitle",{name:e.display_name}):""} .open=${!!e} data-ha-remove @close=${()=>{this.removing=null,this.typed=""}}>
      <div class="form">
        <p class="body">${p("removeBody")}</p>
        <label>${e?p("removeType",{username:e.username}):""}<input class="in ltr" dir="ltr" autocomplete="off" spellcheck="false" data-remove-typed .value=${this.typed}
          @input=${s=>this.typed=s.target.value} /></label>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.removing=null,this.typed=""}}>${p("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-remove-go ?disabled=${this.busy||!e||!le(this.typed,e.username)} @click=${()=>void this.submitRemove()}>${p("removeConfirm")}</sw-button>
    </sw-dialog>`}render(){if(this.loadState==="loading")return t`<sw-state-panel state="loading"></sw-state-panel>`;if(this.loadState==="forbidden")return t`<sw-state-panel state="forbidden" heading=${p("forbidden")}></sw-state-panel>`;if(this.loadState==="error"||!this.view)return t`<sw-state-panel state="error" heading=${this.error} actionLabel=${p("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=this.view;return t`<div class="stack" data-ha-users>
      <p class="body">${p("sub")}</p>
      ${this.ok||this.error?t`<div>${this.ok?t`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.ok}</span>`:l}${this.error?t`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:l}</div>`:l}
      ${this.renderAccess(e)}
      ${this.renderList(e)}
      ${this.renderCreate(e)}${this.renderConfirm()}${this.renderRemove()}
    </div>`}};_.styles=[fe,ge,U`
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
  `];k([c()],_.prototype,"view",2);k([c()],_.prototype,"loadState",2);k([c()],_.prototype,"error",2);k([c()],_.prototype,"ok",2);k([c()],_.prototype,"busy",2);k([c()],_.prototype,"checking",2);k([c()],_.prototype,"createOpen",2);k([c()],_.prototype,"draft",2);k([c()],_.prototype,"touched",2);k([c()],_.prototype,"formError",2);k([c()],_.prototype,"confirm",2);k([c()],_.prototype,"removing",2);k([c()],_.prototype,"typed",2);_=k([T("sw-ha-users")],_);const ys=(e,s)=>e.trim().toLocaleLowerCase()===s.trim().toLocaleLowerCase();function K(e,s,a){const i=(e??"").trim(),r=(s??"").trim()||(a??"").trim();return r?i&&ys(i,r)?"":r:""}var _s=Object.defineProperty,ks=Object.getOwnPropertyDescriptor,C=(e,s,a,i)=>{for(var r=i>1?void 0:i?ks(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&_s(s,a,r),r};function J(e,s=Ae()){return s==="en"&&e.en||e.he}let z=class extends E{constructor(){super(...arguments),this.remote=!1,this.data=null,this.notShown=!1,this.error="",this.saved=!1,this.busy=!1,this.value="",this.runText="",this.runSaved=!1}connectedCallback(){super.connectedCallback(),this.remote||this.load()}async load(){try{const e=await W("/identity/service-identity");this.data=e,this.value=e.configured_user_id??"",this.runText=(e.runnable?.ids??[]).join(", "),this.error=""}catch(e){e instanceof G&&(e.status===403||e.status===404)?this.notShown=!0:this.error=f(e)}}async save(e=!1){this.busy=!0,this.error="",this.saved=!1;try{const s=await q("/identity/service-identity",{user_id:e?null:this.value.trim()||null});this.data=s,this.value=s.configured_user_id??"",this.saved=!0}catch(s){this.error=f(s)}finally{this.busy=!1}}async saveRunnable(){this.busy=!0,this.error="",this.runSaved=!1;try{const e=this.runText.split(/[\s,]+/).map(a=>a.trim()).filter(Boolean),s=await q("/identity/service-identity/runnable",{entity_ids:e});this.data=s,this.runText=(s.runnable?.ids??[]).join(", "),this.runSaved=!0}catch(e){this.error=f(e)}finally{this.busy=!1}}render(){if(this.remote)return t`<div class="note" data-si-remote>${o("siRemote")}</div>`;if(this.notShown)return l;const e=this.data;return t`<sw-card data-service-identity>
      <div class="body">
        <div class="head">
          <h3>${o("siTitle")}</h3>
          ${e?t`<sw-badge kind=${e.ready?"live":"partial"} label=${e.ready?o("siReady"):o("siNotReady")} data-si-state=${e.ready?"ready":"not-ready"}></sw-badge>`:l}
        </div>
        <p class="sub">${o("siSub")}</p>
        ${this.error?t`<div class="note err" role="alert" data-si-error>${this.error}</div>`:l}
        ${this.saved?t`<div class="note" role="status">${o("siSaved")}</div>`:l}
        ${e?t`
              ${e.user?t`<div class="facts" data-si-user>
                    <span>${o("siUser")}: <bdi>${e.user.name??""}</bdi> · <bdi class="id">${e.user.id}</bdi>${e.user.is_admin?t` · <strong>${o("siAdmin")}</strong>`:l}</span>
                    <span>${o("siBridge")}: <bdi>${e.bridge.version??"?"}</bdi> · ${e.bridge.agrees?o("siAgrees"):o("siDiffers")}</span>
                  </div>`:l}
              ${e.extended?t`<div class="note ${e.extended.requested?"warn":""}" data-si-extended=${e.extended.on?"on":e.extended.requested?"requested":"off"}>
                    ${e.extended.requested?o("siExtendedOn"):o("siExtendedOff")}
                    ${e.extended.doors_addon_only?t`<div data-si-doors-addon-only>${o("siDoorsAddonOnly")}</div>`:l}
                    <div data-si-policy-risk>${o("siPolicyRisk")}</div>
                  </div>`:l}
              ${e.steps.length?t`<div class="note warn" data-si-steps>
                    <div class="label">${o("siNeeded")}</div>
                    <ol>${e.steps.map(s=>t`<li data-si-step=${s.code}>${J(s)}</li>`)}</ol>
                  </div>`:l}
              <div class="row">
                <label
                  >${o("siUserId")}
                  <input
                    .value=${this.value}
                    maxlength="64"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder=${o("siPlaceholder")}
                    @input=${s=>this.value=s.target.value}
                    data-si-input
                /></label>
                <sw-button variant="primary" ?disabled=${this.busy} @click=${()=>this.save()} data-si-save>${o("siSave")}</sw-button>
                ${e.configured_user_id?t`<sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>this.save(!0)} data-si-clear>${o("siClear")}</sw-button>`:l}
              </div>
              ${e.runnable?t`<div class="runnable" data-si-runnable=${e.runnable.agrees?"agrees":"differs"}>
                    <div class="label">${o("siRunTitle")}</div>
                    <p class="sub">${o("siRunSub")}</p>
                    <div class="row">
                      <label
                        >${o("siRunLabel")}
                        <input
                          .value=${this.runText}
                          spellcheck="false"
                          autocomplete="off"
                          placeholder="script.evening_lights, scene.movie"
                          @input=${s=>this.runText=s.target.value}
                          data-si-run-input
                      /></label>
                      <sw-button variant="secondary" ?disabled=${this.busy} @click=${()=>this.saveRunnable()} data-si-run-save>${o("siRunSave")}</sw-button>
                    </div>
                    ${this.runSaved?t`<div class="note" role="status" data-si-run-saved>${o("siRunSaved")}</div>`:l}
                    <div class="facts">
                      <span data-si-run-bridge
                        >${o("siRunBridge")}:
                        ${e.runnable.bridge_ids.length?t`<bdi class="id">${e.runnable.bridge_ids.join(", ")}</bdi>`:o("siRunEmpty")}</span
                      >
                      <span>${e.runnable.agrees?o("siRunAgrees"):o("siRunDiffers")}</span>
                    </div>
                  </div>`:l}
              <div class="cols">
                <div>
                  <div class="label">${o("siAllowed")}</div>
                  <ul data-si-allowed>${e.allowed.map(s=>t`<li>${J(s)}</li>`)}</ul>
                </div>
                <div>
                  <div class="label">${o("siRefused")}</div>
                  <ul data-si-refused>${e.refused.map(s=>t`<li>${J(s)}</li>`)}</ul>
                </div>
              </div>
            `:t`<div class="sub">…</div>`}
      </div>
    </sw-card>`}};z.styles=U`
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
  `;C([F({type:Boolean})],z.prototype,"remote",2);C([c()],z.prototype,"data",2);C([c()],z.prototype,"notShown",2);C([c()],z.prototype,"error",2);C([c()],z.prototype,"saved",2);C([c()],z.prototype,"busy",2);C([c()],z.prototype,"value",2);C([c()],z.prototype,"runText",2);C([c()],z.prototype,"runSaved",2);z=C([T("system-service-identity")],z);var xs=Object.defineProperty,zs=Object.getOwnPropertyDescriptor,$=(e,s,a,i)=>{for(var r=i>1?void 0:i?zs(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&xs(s,a,r),r};const Q="display:flex;flex-direction:column;gap:2px;align-items:flex-start",X="color:var(--sw-text-3);font-size:var(--sw-fs-xs)",Ss="display:flex;flex-wrap:wrap;gap:4px",As=new Set(["rbac.assign","identity.directory.read","system.configure","identity.local.manage","rbac.roles.manage","sources.configure","audit.read","backup.manage","nvr.configure","system.update"]);function ee(e){return!!e&&e.permissions.some(s=>As.has(s))}function ae(e){return e.filter(s=>s.id!=="system_admin"&&!s.system_role)}function pe(e){return e.url??`https://<כתובת הגישה מרחוק>${e.path}`}function he(e){return e?`⁦${e}⁩`:""}let b=class extends E{constructor(){super(...arguments),this.roles=[],this.scopes=[],this.data=null,this.error="",this.busy=!1,this.creating=!1,this.selected=null,this.link=null,this.copied=!1,this.suggest="",this.form={username:"",display_name:"",role_id:"viewer",scope:"installation:*",email:"",notes:"",reset_mode:"manager_only"},this.roleEdit=null,this.sent=null,this.publicUrl="",this.publicUrlNote="",this.pk=null,this.pkStepUp=!1,this.pkCode="",this.narrow=!1,this.narrowMq=null,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.pkRequested=null}connectedCallback(){super.connectedCallback(),this.narrowMq=window.matchMedia("(max-width: 767px)"),this.narrowMq.addEventListener("change",this.onNarrow),this.onNarrow(),this.load()}disconnectedCallback(){this.narrowMq?.removeEventListener("change",this.onNarrow),super.disconnectedCallback()}async load(){try{this.data=await W("/identity/local-users"),this.publicUrl||(this.publicUrl=this.data.public_url??""),this.error=""}catch(e){this.error=f(e)}}async run(e){this.busy=!0,this.error="";try{await e()}catch(s){this.error=f(s)}finally{this.busy=!1}}get remote(){return this.data?.channel==="remote"}roleOf(e){return this.roles.find(s=>s.id===e)}scopeParts(e){const s=e.indexOf(":");return{scope_type:e.slice(0,s),scope_id:e.slice(s+1)}}create(e){e.preventDefault();const s=this.form;this.run(async()=>{const a=await O("/identity/local-users",{username:s.username.trim(),display_name:s.display_name.trim(),role_id:s.role_id,...this.scopeParts(s.scope),email:s.email.trim()||null,notes:s.notes.trim()||null,reset_mode:s.reset_mode});this.link={...a.link,user:a.user.display_name},this.copied=!1,this.creating=!1,this.form={...this.form,username:"",display_name:"",email:"",notes:""},await this.load()})}issue(e,s,a=!1){this.run(async()=>{const i=await O(`/identity/local-users/${encodeURIComponent(e.id)}/link`,{purpose:s,via:"shown",temporary:a});this.link={...i.link,user:e.display_name},this.sent=null,this.copied=!1,await this.load()})}issueWhatsapp(e,s){this.run(async()=>{const a=await O(`/identity/local-users/${encodeURIComponent(e.id)}/link`,{purpose:s,via:"whatsapp"});this.link=null,this.sent={user:e.display_name,to:e.whatsapp?.masked??"",expires_at:a.link.expires_at},await this.load()})}savePublicUrl(){this.run(async()=>{await D("/settings",{"security.local_public_url":this.publicUrl.trim()}),this.publicUrlNote=o("publicUrlSaved"),this.publicUrl="",await this.load()})}async copy(){if(this.link)try{await navigator.clipboard.writeText(pe(this.link)),this.copied=!0}catch{this.copied=!1}}setActive(e,s){this.run(async()=>{const a=await D(`/identity/local-users/${encodeURIComponent(e.id)}`,{active:s});this.suggest=a.suggest_also?o("suggestAlso"):"",await this.load()})}setResetMode(e,s){this.run(async()=>{await D(`/identity/local-users/${encodeURIComponent(e.id)}`,{reset_mode:s}),await this.load()})}removeUser(e){window.confirm(o("removeConfirm",{name:e.display_name}))&&this.run(async()=>{await Ce(`/identity/local-users/${encodeURIComponent(e.id)}`),this.selected=null,await this.load()})}simple(e,s){this.run(async()=>{await O(`/identity/local-users/${encodeURIComponent(e.id)}/${s}`),await this.load()})}async loadPasskeys(e){try{const s=await Re(e);this.selected===e&&(this.pk={userId:e,items:s.credentials})}catch{this.pk=null}}removePasskey(e,s){window.confirm(o("passkeyAdminRemoveConfirm"))&&this.run(async()=>{try{await Oe(e.id,s,this.pkStepUp?this.pkCode.trim():void 0)}catch(a){throw a instanceof G&&a.body.code==="second_factor_step_up_required"&&(this.pkStepUp=!0),a}this.pkCode="",await this.load(),await this.loadPasskeys(e.id)})}passkeyFirstOff(e){this.run(async()=>{await D(`/identity/local-users/${encodeURIComponent(e.id)}`,{passkey_first:!1}),await this.load()})}passkeyOnly(e,s){window.confirm(I(s?"onlyConfirmOn":"onlyConfirmOff"))&&this.run(async()=>{await Pe(e.id,s),await this.load()})}setPasskeyFirstAllowed(e){this.run(async()=>{await D("/settings",{"security.local_passkey_first":e?"on":"off"}),await this.load()})}renderPasskeys(e,s){this.pkRequested!==e.id&&(this.pkRequested=e.id,Promise.resolve().then(()=>(this.pkStepUp=!1,this.loadPasskeys(e.id))));const a=this.pk?.userId===e.id?this.pk.items:[];return t`<div class="full cell" data-local-passkeys>
      <span class="muted">${o("passkeysCount",{n:e.passkeys??a.length})}${e.passkey_first?t` · ${o("passkeyFirstOn")}`:l}${e.passkey_only?t` · ${I("onlyOn")}`:l}</span>
      ${a.map(i=>t`<span class="muted" data-local-passkey=${i.id}>${i.label||o("passkeys")} · ${y(i.created_at)}${i.synced?t` · ${o("passkeySynced")}`:l}${i.usable?l:t` · ${o("passkeyNotUsable")}`}
        ${s?t`<sw-button size="sm" variant="ghost" @click=${()=>this.removePasskey(e,i.id)} ?disabled=${this.busy} data-local-passkey-remove>${o("passkeyAdminRemove")}</sw-button>`:l}</span>`)}
      ${s&&this.pkStepUp?t`<label>${o("code")}<input class="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6" .value=${this.pkCode}
            @input=${i=>this.pkCode=i.target.value.replace(/\D/g,"").slice(0,6)} data-local-passkey-code /></label>`:l}
      ${s&&(e.passkey_only||this.data?.passkey_first_allowed&&(e.passkeys??a.length)>0)?t`<div class="actions"><sw-button @click=${()=>this.passkeyOnly(e,!e.passkey_only)} ?disabled=${this.busy} data-local-passkey-only>${e.passkey_only?I("onlyDisable"):I("onlyEnable")} · ${I("onlyLabel")}</sw-button></div>`:l}
      ${s&&e.passkey_first&&!e.passkey_only?t`<div class="actions"><sw-button @click=${()=>this.passkeyFirstOff(e)} ?disabled=${this.busy} data-local-passkey-first-off>${o("passkeyFirstAdminOff")}</sw-button></div>`:l}
    </div>`}saveRole(e){const s=this.roleEdit;s&&this.run(async()=>{await q(`/identity/local-users/${encodeURIComponent(e.id)}/role`,{role_id:s.role_id,...this.scopeParts(s.scope)}),this.roleEdit=null,await this.load()})}statusBadge(e){const s=e.status==="active"?"live":e.status==="delayed"?"stale":e.status==="pending_first_login"?"neutral":"offline";return t`<sw-badge kind=${s} label=${o(`status_${e.status}`)}></sw-badge>`}renderCreate(){const e=this.form,s=ae(this.roles),a=ee(this.roleOf(e.role_id)),i=r=>n=>this.form={...this.form,[r]:n.target.value};return t`<sw-card flush data-local-create>
      <form @submit=${this.create} novalidate>
        <div class="head"><div class="cell"><strong>${o("add")}</strong></div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${o("cancel")} @click=${()=>this.creating=!1}></sw-button></div>
        <label>${o("colUsername")}<input class="ltr" .value=${e.username} @input=${i("username")} autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" required /></label>
        <label>${o("displayName")}<input .value=${e.display_name} @input=${i("display_name")} maxlength="60" required /></label>
        <label>${o("role")}<select .value=${e.role_id} @change=${i("role_id")} data-local-role>
          ${s.map(r=>t`<option value=${r.id} ?selected=${r.id===e.role_id} ?disabled=${this.remote&&ee(r)}>${r.name}</option>`)}
        </select></label>
        <label>${o("scope")}<select .value=${e.scope} @change=${i("scope")}>
          ${this.scopes.map(r=>t`<option value=${`${r.type}:${r.id}`} ?selected=${`${r.type}:${r.id}`===e.scope}>${r.name}</option>`)}
        </select></label>
        <label>${o("email")}<input class="ltr" type="email" .value=${e.email} @input=${i("email")} maxlength="254" /></label>
        <label>${o("notes")}<input .value=${e.notes} @input=${i("notes")} maxlength="200" /></label>
        <label>${o("resetMode")}<select .value=${a?"manager_only":e.reset_mode} @change=${i("reset_mode")} ?disabled=${a} data-local-reset-mode>
          <option value="manager_only">${o("reset_manager_only")}</option>
          <option value="self_service">${o("reset_self_service")}</option>
        </select></label>
        ${a?t`<div class="note warn full" data-local-admin-note>${o("adminNote")} ${o("resetAdminNote")}</div>`:l}
        <div class="actions">
          <sw-button variant="primary" type="submit" ?disabled=${this.busy||a&&this.remote} data-local-create-save>${o("create")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.creating=!1}>${o("cancel")}</sw-button>
        </div>
      </form>
    </sw-card>`}renderLink(){const e=this.link;return e?t`<sw-card flush data-local-link>
      <div class="panel">
        <div class="full"><strong>${e.purpose==="reset"?o("linkResetTitle"):o("linkTitle")} · ${e.user}</strong></div>
        <div class="note full">${o("linkOnce",{until:y(e.expires_at)})}</div>
        <div class="link full" data-local-link-text>${pe(e)}</div>
        <div class="actions">
          <sw-button variant="primary" icon="link" @click=${()=>void this.copy()}>${this.copied?o("copied"):o("copy")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.link=null}>${o("close")}</sw-button>
        </div>
      </div>
    </sw-card>`:l}renderSent(){const e=this.sent;return e?t`<div class="note" role="status" data-local-link-sent>${e.user} · ${o("waSent",{to:he(e.to),until:y(e.expires_at)})}
      <sw-button variant="ghost" @click=${()=>this.sent=null}>${o("close")}</sw-button></div>`:l}renderWhatsapp(e){const s=this.data?.whatsapp_ready??!1,a=!!e.whatsapp?.verified,i=e.status==="pending_first_login"?"first_login":"reset";return e.admin?t`<div class="muted full" data-local-wa-admin>${o("waAdminNote")}</div>`:t`<div class="full cell" data-local-wa>
      <span class="muted" data-local-wa-state>${a?o("waVerified",{masked:he(e.whatsapp?.masked??"")}):o("waNone")}</span>
      ${s?l:t`<span class="muted" data-local-wa-off>${o("waChannelOff")}</span>`}
      ${s&&a?t`<div class="actions"><sw-button @click=${()=>this.issueWhatsapp(e,i)} ?disabled=${this.busy||!e.active} data-local-issue-wa=${i}>
            ${i==="first_login"?o("issueFirstWa"):o("issueResetWa")}</sw-button></div>`:l}
    </div>`}renderSelected(e){const s=this.data?.can_manage??!1,a=e.admin&&this.remote,i=ae(this.roles),r=this.roleEdit;return t`<sw-card flush data-local-user=${e.id}>
      <div class="panel">
        <div class="head">
          <div class="cell">
            <strong>${e.display_name}</strong>
            <span class="muted">${K(e.display_name,e.username)?t`<bdi>${e.username}</bdi> · `:l}${e.role_name??"—"} · ${e.scope_name??"—"} · ${o("sessions")}: ${e.sessions}</span>
            <span class="muted" data-local-user-meta>${o("colLast")}: ${e.last_sign_in_at?y(e.last_sign_in_at):o("never")} · ${o("colFactor")}: ${e.second_factor?o("factorOn"):o("factorOff")}</span>
            ${e.admin?t`<span class="muted">${o("adminNote")}</span>`:l}
          </div>
          ${this.statusBadge(e)}
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${o("close")} data-local-user-close @click=${()=>{this.selected=null,this.roleEdit=null}}></sw-button>
        </div>
        ${s?t`<div class="actions">
              ${a?t`<span class="muted" data-local-only>${o("localOnly")}</span>`:e.status==="pending_first_login"?t`<sw-button @click=${()=>this.issue(e,"first_login")} ?disabled=${this.busy||!e.active} data-local-issue="first_login">${o("issueFirst")}</sw-button>`:t`<sw-button @click=${()=>this.issue(e,"reset")} ?disabled=${this.busy||!e.active} data-local-issue="reset">${o("issueReset")}</sw-button>
                    <sw-button variant="ghost" @click=${()=>this.issue(e,"reset",!0)} ?disabled=${this.busy||!e.active}>${o("temporary")}</sw-button>`}
              ${e.status==="delayed"?t`<sw-button @click=${()=>this.simple(e,"unlock")} ?disabled=${this.busy}>${o("unlock")}</sw-button>`:l}
              <sw-button @click=${()=>this.simple(e,"sessions/revoke")} ?disabled=${this.busy||!e.sessions}>${o("endSessions")}</sw-button>
              <sw-button @click=${()=>this.setActive(e,!e.active)} ?disabled=${this.busy}>${e.active?o("disable"):o("enable")}</sw-button>
              <sw-button @click=${()=>this.roleEdit={role_id:e.role_id??"viewer",scope:`${e.scope_type??"installation"}:${e.scope_id??"*"}`}} ?disabled=${this.busy}>${o("changeRole")}</sw-button>
              <sw-button class="end" variant="danger" @click=${()=>this.removeUser(e)} ?disabled=${this.busy}>${o("remove")}</sw-button>
            </div>
            <div class="sep" role="presentation"></div>
            <label>${o("resetMode")}<select .value=${e.reset_mode} ?disabled=${this.busy||e.admin} @change=${n=>this.setResetMode(e,n.target.value)}>
              <option value="manager_only">${o("reset_manager_only")}</option>
              <option value="self_service">${o("reset_self_service")}</option>
            </select></label>
            ${e.admin?t`<div class="muted full" data-local-reset-admin>${o("resetAdminNote")}</div>`:e.self_service_blocked?t`<div class="note warn full" data-local-reset-blocked=${e.self_service_blocked}>${o(`blocked_${e.self_service_blocked}`)}</div>`:t`<div class="muted full">${o("resetModeHelp")}</div>`}
            ${this.renderWhatsapp(e)}
            ${this.renderPasskeys(e,s)}
            ${r?t`<label>${o("role")}<select .value=${r.role_id} @change=${n=>this.roleEdit={...r,role_id:n.target.value}}>
                    ${i.map(n=>t`<option value=${n.id} ?selected=${n.id===r.role_id} ?disabled=${this.remote&&ee(n)}>${n.name}</option>`)}
                  </select></label>
                  <label>${o("scope")}<select .value=${r.scope} @change=${n=>this.roleEdit={...r,scope:n.target.value}}>
                    ${this.scopes.map(n=>t`<option value=${`${n.type}:${n.id}`} ?selected=${`${n.type}:${n.id}`===r.scope}>${n.name}</option>`)}
                  </select></label>
                  <div class="actions"><sw-button variant="primary" @click=${()=>this.saveRole(e)} ?disabled=${this.busy}>${o("save")}</sw-button><sw-button variant="ghost" @click=${()=>this.roleEdit=null}>${o("cancel")}</sw-button></div>`:l}`:l}
      </div>
    </sw-card>`}renderPublicUrl(e){return t`<sw-card flush data-local-public-url>
      <div class="panel">
        <label class="full">${o("publicUrl")}
          <input class="ltr" type="url" inputmode="url" placeholder=${e.public_url??"https://"} .value=${this.publicUrl}
            @input=${s=>this.publicUrl=s.target.value} maxlength="300" data-local-public-url-input /></label>
        <div class="muted full">${o("publicUrlHint")}</div>
        ${this.publicUrlNote?t`<div class="note full" role="status">${this.publicUrlNote}</div>`:l}
        <div class="actions"><sw-button @click=${()=>this.savePublicUrl()} ?disabled=${this.busy} data-local-public-url-save>${o("publicUrlSave")}</sw-button></div>
        <label class="full check"><input type="checkbox" .checked=${!!e.passkey_first_allowed} ?disabled=${this.busy}
            @change=${s=>this.setPasskeyFirstAllowed(s.target.checked)} data-local-passkey-first-allowed />
          ${o("passkeySettingFirst")}</label>
        <div class="muted full">${o("passkeySettingHelp")}</div>
      </div>
    </sw-card>`}render(){const e=this.data;if(!e)return t`<div class="stack">${this.error?t`<sw-state-panel state="error" compact hint=${this.error} actionLabel="נסה שוב" data-local-load-error @action=${()=>void this.load()}></sw-state-panel>`:t`<sw-state-panel state="loading" compact data-local-loading></sw-state-panel>`}</div>`;const s=n=>n,a=[{key:"name",label:o("colName"),render:n=>t`<span style=${Q}><span>${s(n).display_name}</span>${K(s(n).display_name,s(n).username)?t`<span style=${X}><bdi>${s(n).username}</bdi></span>`:l}</span>`},{key:"role",label:o("colRole"),render:n=>t`<span style=${Q}><span>${s(n).role_name??"—"}</span><span style=${X}>${s(n).scope_name??""}</span>
          <span style=${Ss}>${s(n).admin?t`<sw-badge kind="partial" label=${o("adminBadge")}></sw-badge>`:l}${s(n).ha_user_id?t`<sw-badge kind="neutral" label=${o("haBadge")}></sw-badge>`:l}</span></span>`},{key:"status",label:o("colStatus"),render:n=>this.statusBadge(s(n))},{key:"last",label:o("colLast"),render:n=>s(n).last_sign_in_at?y(s(n).last_sign_in_at):o("never")},{key:"factor",label:o("colFactor"),render:n=>t`<span style=${Q}><span>${s(n).second_factor?o("factorOn"):o("factorOff")}</span>${s(n).passkeys?t`<span style=${X}>${o("passkeysCount",{n:s(n).passkeys??0})}</span>`:l}</span>`}],i=this.narrow?a.filter(n=>n.key!=="last"&&n.key!=="factor"):a,r=e.users.find(n=>n.id===this.selected)??null;return t`<div class="stack" data-local-users>
      <div class="bar">
        <div class="sub">${o("tabSub")}</div>
        ${e.can_manage&&e.enabled?t`<div class="actions">
              <sw-button variant="primary" icon="plus" @click=${()=>this.creating=!this.creating} data-local-add>${o("add")}</sw-button>
              <sw-button variant="ghost" @click=${()=>window.open(Ue("/identity/local-users/export"),"_blank","noopener")}>${o("export")}</sw-button>
            </div>`:l}
      </div>
      ${e.enabled?l:t`<div class="note warn" data-local-off>${o("off")}</div>`}
      ${e.can_manage?t`<system-service-identity ?remote=${this.remote}></system-service-identity>`:l}
      ${this.error?t`<div class="note err" role="alert" data-local-error>${this.error}</div>`:l}
      ${this.suggest?t`<div class="note warn" role="status">${this.suggest}</div>`:l}
      ${this.renderLink()}
      ${this.renderSent()}
      ${this.creating&&e.enabled?this.renderCreate():l}
      ${e.users.length?t`<sw-table .columns=${i} .rows=${e.users} rowKey="id" .selected=${this.selected}
            @row-select=${n=>{this.selected=n.detail.id,this.roleEdit=null}}></sw-table>`:t`<sw-state-panel icon="users" state="empty" compact hint=${o("empty")} data-local-empty></sw-state-panel>`}
      ${r?this.renderSelected(r):l}
      ${e.can_manage&&e.enabled?this.renderPublicUrl(e):l}
    </div>`}};b.styles=U`
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
  `;$([F({attribute:!1})],b.prototype,"roles",2);$([F({attribute:!1})],b.prototype,"scopes",2);$([c()],b.prototype,"data",2);$([c()],b.prototype,"error",2);$([c()],b.prototype,"busy",2);$([c()],b.prototype,"creating",2);$([c()],b.prototype,"selected",2);$([c()],b.prototype,"link",2);$([c()],b.prototype,"copied",2);$([c()],b.prototype,"suggest",2);$([c()],b.prototype,"form",2);$([c()],b.prototype,"roleEdit",2);$([c()],b.prototype,"sent",2);$([c()],b.prototype,"publicUrl",2);$([c()],b.prototype,"publicUrlNote",2);$([c()],b.prototype,"pk",2);$([c()],b.prototype,"pkStepUp",2);$([c()],b.prototype,"pkCode",2);$([c()],b.prototype,"narrow",2);b=$([T("system-local-users")],b);const ue="הרחב בירור",Cs=()=>W("access/capture-lease/settings"),Rs=(e,s)=>q("access/capture-lease/settings",{lookup_scope:e,...s?{lookup_scope_confirm:s}:{}});var Os=Object.defineProperty,Ps=Object.getOwnPropertyDescriptor,P=(e,s,a,i)=>{for(var r=i>1?void 0:i?Ps(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Os(s,a,r),r};const me={holder:"מי שמחזיק כעת בהרשאה לפעולה המקורית (ברירת מחדל)",holder_or_audit_readers:"גם מחזיקי הרשאת צפייה באודיט"};let A=class extends E{constructor(){super(...arguments),this.value=null,this.pending=null,this.word="",this.notAllowed=!1,this.busy=!1,this.error="",this.saved=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=await Cs();this.value=e.lookup_scope,this.pending=e.lookup_scope}catch(e){const s=e.status;s===403||s===404?this.notAllowed=!0:this.error=f(e)}}async save(){if(!(!this.pending||this.pending===this.value)){this.busy=!0,this.error="",this.saved=!1;try{const e=await Rs(this.pending,this.pending==="holder_or_audit_readers"?this.word.trim():void 0);this.value=e.lookup_scope,this.pending=e.lookup_scope,this.word="",this.saved=!0}catch(e){this.error=f(e)}finally{this.busy=!1}}}render(){if(this.notAllowed)return l;if(this.value===null)return this.error?t`<p class="err" role="alert">${this.error}</p>`:l;const e=this.pending==="holder_or_audit_readers"&&this.value!=="holder_or_audit_readers";return t`<sw-card heading="בירור מצב פעולה ישנה" data-lookup-scope>
      <div class="row">
        <sw-field label="מי רשאי לברר מצב של פעולת אינטרקום ישנה">
          <select data-lookup-scope-select .value=${te(this.pending??"holder")} ?disabled=${this.busy}
            @change=${s=>{this.pending=s.target.value,this.saved=!1}}>
            ${Object.keys(me).map(s=>t`<option value=${s} ?selected=${s===this.pending}>${me[s]}</option>`)}
          </select>
        </sw-field>
        ${e?t`<sw-field label=${`לאישור ההרחבה הקלידו "${ue}"`}>
              <input data-lookup-scope-word .value=${te(this.word)} ?disabled=${this.busy} @input=${s=>this.word=s.target.value} />
            </sw-field>`:l}
        <sw-button variant="primary" data-lookup-scope-save ?disabled=${this.busy||this.pending===this.value||e&&this.word.trim()!==ue}
          @click=${()=>void this.save()}>שמירה</sw-button>
      </div>
      ${this.error?t`<p class="err" role="alert">${this.error}</p>`:l}
      ${this.saved?t`<p class="ok" role="status">נשמר</p>`:l}
    </sw-card>`}};A.styles=U`
    :host { display: block; margin-block-end: var(--sw-space-4, 16px); }
    .row { display: flex; flex-wrap: wrap; gap: var(--sw-space-3, 12px); align-items: end; }
    select, input { min-width: 16rem; max-width: 100%; }
    .err { color: var(--sw-danger); }
    .ok { color: var(--sw-success); }
  `;P([c()],A.prototype,"value",2);P([c()],A.prototype,"pending",2);P([c()],A.prototype,"word",2);P([c()],A.prototype,"notAllowed",2);P([c()],A.prototype,"busy",2);P([c()],A.prototype,"error",2);P([c()],A.prototype,"saved",2);A=P([T("sw-lookup-scope")],A);var Us=Object.defineProperty,Es=Object.getOwnPropertyDescriptor,_e=(e,s,a,i)=>{for(var r=i>1?void 0:i?Es(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Us(s,a,r),r};let B=class extends E{constructor(){super(...arguments),this.bubbleSkin=new ie(this),this.roles=null}rows(){const e=new Set(this.roles?.sensitive??[]),s=a=>this.roles?.labels[a]??be(a)??a;return[...Ee.map(a=>({id:a,label:s(a),tag:a==="energy.bills"&&(e.has(a)||!this.roles?.sensitive)?"sensitive":""})),{id:"system.configure",label:"הגדרות שמירת נתונים",tag:"existing"}]}holds(e,s){return e.permissions.includes(s)||e.sensitive_included.includes(s)}chip(e){return e==="sensitive"?t`<span class="chip c-warn nodot">רגישה</span>`:e==="existing"?t`<span class="chip nodot">קיימת</span>`:l}render(){const e=this.roles;if(!e?.roles.length)return l;const s=this.rows();return t`<section data-energy-permissions aria-label="הרשאות חשמל">
      <h3>חשמל</h3>
      <div class="card flush scrollx wide"><table class="t" data-energy-matrix>
        <thead><tr><th>הרשאה</th>${e.roles.map(a=>t`<th class="c">${a.name}</th>`)}</tr></thead>
        <tbody>${s.map(a=>t`<tr data-energy-row=${a.id}><td><b>${a.label}</b> ${this.chip(a.tag)}<div class="code">${a.id}</div></td>
          ${e.roles.map(i=>t`<td class="c" data-role=${i.id}>${this.holds(i,a.id)?t`<span class="tick on" aria-label="יש">✓</span>`:t`<span class="tick" aria-label="אין"></span>`}</td>`)}</tr>`)}</tbody></table></div>
      <div class="list phone" style="flex-direction:column">${s.map(a=>t`<div class="li" style="flex-direction:column;align-items:stretch" data-energy-row-phone=${a.id}>
        <div class="row"><b>${a.label}</b>${this.chip(a.tag)}</div>
        <div class="t2 wrap">${e.roles.filter(i=>this.holds(i,a.id)).map(i=>i.name).join(", ")||"אין תפקיד"}</div></div>`)}</div>
    </section>`}};B.styles=[ns,U`
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
    `];_e([F({attribute:!1})],B.prototype,"roles",2);B=_e([T("elec-permission-rows")],B);function Ts(e,s){const a=new Set(s??[]);return e.filter(i=>!a.has(i))}function js(e,s,a){return s?e.filter(i=>!(i in s)||a.has(i)):[...e]}var Ds=Object.defineProperty,Is=Object.getOwnPropertyDescriptor,g=(e,s,a,i)=>{for(var r=i>1?void 0:i?Is(s,a):s,n=e.length-1,d;n>=0;n--)(d=e[n])&&(r=(i?d(s,a,r):d(r))||r);return i&&r&&Ds(s,a,r),r};const ve=[{id:"users",label:"משתמשים",count:se.length},{id:"groups",label:"קבוצות",count:$e.length},{id:"roles",label:"תפקידים",count:ye.length},{id:"effective",label:"הרשאות אפקטיביות"},{id:"audit",label:"אודיט הרשאות"}],we=new Set(["map.read","video.live","video.playback","video.export","events.read","events.ack","cases.manage"]);let w=class extends E{constructor(){super(...arguments),this.bubbleSkin=new ie(this),this.tabsMode=new Te(this,"settings"),this.tab="users",this.selected=null,this.assigning=!1,this.step=0,this.directory=null,this.roles=null,this.groups=null,this.tree=null,this.audit=null,this.selectedGroup=null,this.wizard=null,this.members=null,this.newGroup="",this.preview=null,this.previewUser="",this.previewScope="installation:*",this.busy=!1,this.error="",this.message="",this.forbidden=!1,this.roleEdit=null,this.roleImpact=null,this.roleDelete=null,this.groupsMeta={can_manage:!1,delegated:!1},this.renameDraft=null,this.groupChange=null,this.remoteOff=null,this.roleImpactTimer=0,this.narrow=!1,this.narrowMq=null,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.onHash=()=>{window.location.hash.startsWith("#/system/access")&&this.readTab()},this.userColumns=[{key:"name",label:"שם",render:e=>t`<div class="who"><sw-avatar name=${String(e.name)} size=${30}></sw-avatar><div><strong>${String(e.name)}</strong>${e.haAdmin?t` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>`:""}<div class="ltr sub">${String(e.haUser)}@ha.local</div></div></div>`},{key:"role",label:"תפקיד",render:e=>{const s=e.bindings[0];return s?t`<span class="pillsel">${s.role}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:t`<span class="pillsel" style="color:var(--sw-text-3)">ללא שיוך<sw-icon name="chevronDown" size=${11}></sw-icon></span>`}},{key:"scope",label:"היקף גישה",render:e=>{const s=e.bindings[0];return s?t`<span class="pillsel">${s.scope}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:t`<span class="sub">—</span>`}},{key:"active",label:"מצב",render:e=>t`<span class="status ${e.active?"":"off"}"><i></i>${e.active?"פעיל":"מושבת ב־HA"}</span>`},{key:"lastSync",label:"סנכרון"},{key:"more",label:"",width:"40px",render:()=>t`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]}connectedCallback(){super.connectedCallback(),this.readTab(),window.addEventListener("hashchange",this.onHash),this.narrowMq=window.matchMedia("(max-width: 767px)"),this.narrowMq.addEventListener("change",this.onNarrow),this.onNarrow(),S()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),this.narrowMq?.removeEventListener("change",this.onNarrow)}readTab(){const e=je().params.get("tab")??"";(ve.some(a=>a.id===e)||e==="ha-users"&&(!S()||x("users.ha_manage"))||e==="local"&&S()&&x("identity.directory.read"))&&e!==this.tab&&this.setTab(e)}setTab(e){this.tab=e,this.tab==="audit"&&S()&&this.loadAudit(),De("/system/access",e==="users"?void 0:new URLSearchParams({tab:e}))}async load(){this.error="";try{const[e,s,a,i]=await Promise.all([Me(),N(),Ge(),Ie().catch(()=>null)]);this.directory=e,this.roles=s,this.groups=a.groups,this.groupsMeta={can_manage:!!a.can_manage,delegated:!!a.delegated},this.tree=i,this.forbidden=!1,this.previewUser||(this.previewUser=H.me?.user.id??"");const r=this.scopeOptions;r.length&&!r.some(n=>`${n.type}:${n.id}`===this.previewScope)&&(this.previewScope=`${r[0].type}:${r[0].id}`)}catch(e){const s=f(e);this.error=s,this.forbidden=/403|הרשאה|forbidden/i.test(s)&&!this.directory}}async loadAudit(){try{const[e,s]=await Promise.all([re({prefix:"rbac.",limit:100}),re({prefix:"identity.",limit:50})]);this.audit=[...e.rows,...s.rows].sort((a,i)=>a.at<i.at?1:-1).slice(0,150)}catch(e){this.error=f(e),this.audit=[]}}flash(e){this.message=e,setTimeout(()=>this.message="",3500)}get scopeOptions(){const e=this.directory?.assign_scopes;if(e&&e.length)return e;const s=[{type:"installation",id:"*",name:"כל ההתקנה"}];for(const a of this.tree?.sites??[]){s.push({type:"site",id:a.id,name:`אתר · ${a.name}`});for(const i of a.buildings??[]){s.push({type:"building",id:i.id,name:`${a.name} · ${i.name}`});for(const r of i.floors??[])s.push({type:"floor",id:r.id,name:`${a.name} · ${i.name} · ${r.name}`})}}return s}userName(e){return this.directory?.users.find(s=>s.id===e)?.name??e}label(e){return this.roles?.labels[e]??be(e)??Ne(e)??os(e)??e}startWizard(e,s,a){const i=this.roles?.roles??[],r=i.some(d=>d.id==="viewer")?"viewer":i[0]?.id??"viewer",n=this.scopeOptions[0];this.wizard={subjectKind:e,subjectId:s,subjectName:a,roleId:r,scopeKey:n?`${n.type}:${n.id}`:"installation:*",effect:"allow"}}pickScopeKind(e,s){const i=this.scopeOptions.filter(r=>r.type==="camera"===s)[0];i&&(this.wizard={...e,scopeKey:`${i.type}:${i.id}`})}async previewGroupChange(e,s,a,i,r){this.busy=!0,this.error="";try{const n=await qe(e.id,i);this.groupChange={heading:s,impact:n,confirmLabel:a,run:async()=>{await r(n.revision)}}}catch(n){this.error=f(n)}finally{this.busy=!1}}async confirmGroupChange(){const e=this.groupChange;if(e){this.busy=!0,this.error="";try{await e.run(),this.groupChange=null,await this.load()}catch(s){this.error=f(s),this.groupChange=null,await this.load()}finally{this.busy=!1}}}async saveWizard(){const e=this.wizard;if(!e)return;const[s,a]=e.scopeKey.split(":");if(e.subjectKind==="group"){const i=this.groups?.find(d=>d.id===e.subjectId);if(!i)return;const r=this.roles?.roles.find(d=>d.id===e.roleId),n=this.scopeOptions.find(d=>`${d.type}:${d.id}`===e.scopeKey);await this.previewGroupChange(i,`${e.effect==="deny"?"חסימה":"שיוך"} לקבוצה "${i.name}": ${r?.name??e.roleId} · ${n?.name??a}`,"שמור שיוך",{op:"bind",role_id:e.roleId,scope_type:s,scope_id:a,effect:e.effect},async d=>{await Ke(i.id,{role_id:e.roleId,scope_type:s,scope_id:a,effect:e.effect,revision:d}),this.wizard=null,this.flash(`שויך לקבוצה "${i.name}"`)});return}this.busy=!0,this.error="";try{const i=await ne({subject_kind:e.subjectKind,subject_id:e.subjectId,role_id:e.roleId,scope_type:s,scope_id:a,effect:e.effect});this.flash(e.effect==="deny"?`נחסם: ${i.role_name} · ${i.scope_name} (רוויזיה ${i.revision})`:`שויך: ${i.role_name} · ${i.scope_name} (רוויזיה ${i.revision})`),this.wizard=null,await this.load()}catch(i){this.error=f(i)}finally{this.busy=!1}}async revoke(e){if(e.subject_kind==="group"&&!e.via_group){const s=this.groups?.find(a=>a.id===e.subject_id);if(s){await this.previewGroupChange(s,`ביטול שיוך של הקבוצה "${s.name}": ${e.role_name} · ${e.scope_name}`,"בטל שיוך",{op:"unbind",binding_id:e.id},async a=>{await Be(s.id,e.id,a),this.flash(`בוטל: ${e.role_name} · ${e.scope_name}`)});return}}this.busy=!0,this.error="";try{await We(e.id),this.flash(`בוטל: ${e.role_name} · ${e.scope_name}`),await this.load()}catch(s){this.error=f(s)}finally{this.busy=!1}}async sync(){this.busy=!0,this.error="";try{const e=await Fe();this.flash(e.requested?"הספרייה נדחפה מ־Home Assistant":e.note??"הספרייה מתעדכנת אוטומטית כל דקה"),await this.load()}catch(e){this.error=f(e)}finally{this.busy=!1}}async addGroup(){const e=this.newGroup.trim();if(e){this.busy=!0,this.error="";try{const s=await Ve(e);this.newGroup="",this.flash(`נוצרה קבוצה "${s.name}"`),await this.load(),this.selectedGroup=s.id}catch(s){this.error=f(s)}finally{this.busy=!1}}}async saveMembers(e){if(!this.members)return;const s=[...this.members];await this.previewGroupChange(e,`חברי הקבוצה "${e.name}"`,"שמור חברים",{op:"members",user_ids:s},async a=>{await Ye(e.id,s,a),this.members=null,this.flash("חברי הקבוצה עודכנו")})}async saveRename(e){const s=(this.renameDraft??"").trim();if(!s||s===e.name){this.renameDraft=null;return}this.busy=!0,this.error="";try{await Ze(e.id,s,e.revision),this.renameDraft=null,this.flash(`שם הקבוצה עודכן ל"${s}"`),await this.load()}catch(a){this.error=f(a)}finally{this.busy=!1}}async removeGroup(e){this.busy=!0,this.error="";try{await Je(e.id,e.revision),this.selectedGroup=null,this.flash(`הקבוצה "${e.name}" נמחקה`),await this.load()}catch(s){this.error=f(s)}finally{this.busy=!1}}async runPreview(){if(!this.previewUser)return;const[e,s]=this.previewScope.split(":");this.busy=!0,this.error="";try{this.preview=await Qe({user_id:this.previewUser,scope_type:e,scope_id:s})}catch(a){this.error=f(a)}finally{this.busy=!1}}canRevoke(e,s){if(!s||e.via_group)return!1;const a=this.directory;return!(a?.delegated&&(!(a.assignable_roles??[]).includes(e.role_id)||e.subject_kind==="user"&&e.subject_id===H.me?.user.id))}renderBindingRow(e,s){return t`<div class="bind" data-binding=${e.id}>
      <div><strong>${e.role_name}</strong> · ${e.scope_name}${e.effect==="deny"?t` <sw-badge kind="forbidden" label="חסימה"></sw-badge>`:l}<div class="sub">${e.via_group?`דרך קבוצה "${e.via_group}" · `:""}מאז ${y(e.created_at)}${e.expires_at?` · עד ${y(e.expires_at)}`:""} · רוויזיה ${e.permission_revision}</div></div>
      ${this.canRevoke(e,s)?t`<sw-button size="sm" variant="ghost" icon="trash" data-revoke ?disabled=${this.busy} @click=${()=>this.revoke(e)}>ביטול</sw-button>`:l}
    </div>`}renderWizard(){const e=this.wizard;if(!e||!this.roles)return l;const s=this.roles.roles.find(h=>h.id===e.roleId),a=this.scopeOptions.find(h=>`${h.type}:${h.id}`===e.scopeKey),i=s?.system_role??!1,r=e.effect==="deny",n=s?.permissions.includes("rbac.assign")??!1,d=this.scopeOptions.filter(h=>h.type!=="camera"),m=this.scopeOptions.filter(h=>h.type==="camera"),u=e.scopeKey.startsWith("camera:");return t`<div class="wiz">
      <sw-steps .steps=${["תפקיד","היקף","תצוגה מקדימה","שמירה"]} .current=${2}></sw-steps>
      <div class="hint">שיוך ל${e.subjectKind==="group"?"קבוצה":"משתמש"}: <strong>${e.subjectName}</strong></div>
      ${this.directory?.delegated?l:t`<sw-field label="סוג שיוך"><select data-wizard-effect @change=${h=>this.wizard={...e,effect:h.target.value}}>
            <option value="allow" ?selected=${!r}>הרשאה — מוסיף את הרשאות התפקיד בהיקף</option>
            <option value="deny" ?selected=${r}>חסימה — מסיר את הרשאות התפקיד בהיקף, גם אם שיוך אחר מרשה</option>
          </select></sw-field>`}
      <sw-field label="תפקיד"><select data-wizard-role @change=${h=>this.wizard={...e,roleId:h.target.value}}>${this.roles.roles.map(h=>t`<option value=${h.id} ?selected=${h.id===e.roleId}>${h.name}</option>`)}</select></sw-field>
      <sw-field label="סוג היקף"><select data-wizard-scope-kind @change=${h=>this.pickScopeKind(e,h.target.value==="camera")}>
        <option value="place" ?selected=${!u}>התקנה / אתר / מבנה / קומה</option>
        <option value="camera" ?selected=${u} ?disabled=${!m.length||i||n}>מצלמה</option>
      </select></sw-field>
      ${u?t`<sw-field label="מצלמה"><select data-wizard-camera @change=${h=>this.wizard={...e,scopeKey:h.target.value}}>${m.map(h=>t`<option value=${`${h.type}:${h.id}`} ?selected=${`${h.type}:${h.id}`===e.scopeKey}>${h.name.replace(/^מצלמה · /,"")}</option>`)}</select></sw-field>`:t`<sw-field label="היקף"><select data-wizard-scope @change=${h=>this.wizard={...e,scopeKey:h.target.value}}>${d.map(h=>t`<option value=${`${h.type}:${h.id}`} ?selected=${`${h.type}:${h.id}`===e.scopeKey} ?disabled=${i&&h.type!=="installation"}>${h.name}</option>`)}</select></sw-field>`}
      ${u?t`<div class="hint" data-camera-scope-hint>היקף מצלמה: ההרשאות חלות על המצלמה הזו בלבד — שידור חי, הקלטות, אירועים וייצוא שלה. במפה תוצג תוכנית הקומה שלה עם המצלמה הזו בלבד, בלי ישויות Home Assistant ובלי מצלמות אחרות. חסימה ברמה רחבה יותר (קומה, אתר, התקנה) גוברת גם עליה.</div>`:l}
      ${this.directory?.delegated?t`<div class="hint" data-delegated-hint>כמנהל אתר מוצגים רק התפקידים שמותר לך להאציל וההיקפים שבאחריותך. אינך משנה את השיוכים של עצמך ואינך יוצר חסימות.</div>`:l}
      ${e.subjectKind==="group"?t`<div class="hint">לפני השמירה תוצג ההשפעה על כל אחד מחברי הקבוצה.</div>`:l}
      ${s?r?t`<div class="eff">
              <div><div class="sec">ייחסמו ב־${a?.name??"ההיקף"}</div>${s.permissions.map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
              <div class="hint" style="align-self:start">חסימה פועלת רק על ההרשאות שהתפקיד הזה מקנה, ורק בהיקף שנבחר. היא גוברת על כל שיוך "הרשאה" אחר לאותו משתמש באותה הרשאה ובאותו היקף (או היקף שמכיל אותו) — לא על שיוכים בהיקפים לא קשורים.</div>
            </div>`:u?t`<div class="eff" data-camera-effect>
                <div><div class="sec">מותר ב־${a?.name??"המצלמה"}</div>${s.permissions.filter(h=>we.has(h)).map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
                <div><div class="sec">ללא השפעה בהיקף מצלמה</div>${s.permissions.filter(h=>!we.has(h)).map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="close" size=${14} style="color:var(--sw-text-3)"></sw-icon></div>`)}<div class="row"><span>כל מצלמה אחרת</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
              </div>`:t`<div class="eff">
              <div><div class="sec">מותר ב־${a?.name??"ההיקף"}</div>${s.permissions.map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
              <div><div class="sec">לא כלול / מחוץ להיקף</div>${s.sensitive_missing.map(h=>t`<div class="row"><span>${this.label(h)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}<div class="row"><span>כל היקף אחר</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
            </div>`:l}
      ${i?t`<div class="hint">תפקיד עם הרשאות מערכת מוקצה רק ברמת ההתקנה כולה.</div>`:l}
      <div class="hint">הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־Home Assistant. השינוי נרשם באודיט עם diff לפני/אחרי.</div>
    </div>`}requestRemote(e,s){const a=e.remote_sessions??0;if(!s&&a>0&&(this.directory?.remote_policy??"flag")==="flag"&&!e.remote_admin_default){this.remoteOff={userId:e.id,count:a};return}this.toggleRemote(e.id,s)}async toggleRemote(e,s){this.busy=!0,this.error="",this.remoteOff=null;try{const a=await Xe(e,s);this.flash(s?"הגישה מרחוק הופעלה":a.sessions_ended?`הגישה מרחוק כובתה · ${a.sessions_ended} כניסות נסגרו`:"הגישה מרחוק כובתה"),await this.load()}catch(a){this.error=f(a),await this.load()}finally{this.busy=!1}}remoteStats(e){const s=e.remote_sessions??0;return`${s===0?"אין כניסות פעילות מרחוק":s===1?"כניסה פעילה אחת":`${s} כניסות פעילות`} · ${e.remote_last_sign_in?`כניסה אחרונה מרחוק ${y(e.remote_last_sign_in)}`:"טרם נכנס מרחוק"}`}renderUsersApi(){const e=this.directory,s=e.can_assign,a=e.delegated?[]:[{key:"remote_access",label:"מרחוק",render:d=>{const m=d,u=m.remote_sessions??0;return t`<span data-remote-col style="font-size:var(--sw-fs-xs)">${m.remote_access_basis==="admin_default"?"ברירת מחדל (מנהל)":m.remote_access?"מופעלת":"כבויה"}${u?t` · <sw-badge kind="live" label=${u===1?"מחובר":`${u} חיבורים`}></sw-badge>`:l}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${m.remote_last_sign_in?`אחרונה ${y(m.remote_last_sign_in)}`:"טרם נכנס"}</div>`}}],r=[{key:"name",label:"שם",render:d=>t`<div style="display:flex;align-items:center;gap:10px"><sw-avatar name=${String(d.name)} size=${30}></sw-avatar><div style="min-inline-size:0;white-space:normal;overflow-wrap:anywhere"><strong>${String(d.name)}</strong>${d.is_admin?t` <sw-badge kind="neutral" label="מנהל HA · מידע בלבד"></sw-badge>`:l}${d.is_self?t` <sw-badge kind="recorded" label="אני"></sw-badge>`:l}${K(String(d.name),String(d.username??""),String(d.id??""))?t`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3);direction:ltr;text-align:start">${K(String(d.name),String(d.username??""),String(d.id??""))}</div>`:l}</div></div>`},{key:"bindings",label:"תפקיד · היקף",render:d=>{const m=d.bindings;return m.length?t`${m.slice(0,2).map(u=>t`<div style="font-size:var(--sw-fs-xs);white-space:normal;overflow-wrap:anywhere;min-inline-size:16ch"><strong>${u.role_name}</strong> · ${u.scope_name}${u.via_group?" (קבוצה)":""}${u.effect==="deny"?t` <span data-binding-deny style="color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)">· חסימה</span>`:l}</div>`)}${m.length>2?t`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">+${m.length-2}</div>`:l}`:t`<span style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">ללא שיוך · אין גישה לתוכן</span>`}},{key:"groups",label:"קבוצות",render:d=>{const m=d.groups.map(u=>u.name).join(", ");return t`<span title=${m} style="font-size:var(--sw-fs-xs);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere;min-inline-size:12ch;max-inline-size:32ch">${m||"—"}</span>`}},{key:"active",label:"מצב",render:d=>t`<span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--sw-fs-xs)"><i style="inline-size:7px;block-size:7px;border-radius:50%;background:${d.active?"var(--sw-live)":"var(--sw-offline)"}"></i>${d.active?"פעיל":"ללא גישה (HA)"}</span>`},{key:"sync_status",label:"סנכרון",render:d=>t`<span style="font-size:var(--sw-fs-xs)">${oe[d.sync_status]}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${d.last_seen_at?`נראה ${y(String(d.last_seen_at))}`:"טרם נכנס"}</div>`},...a].filter(d=>!this.narrow||!["groups","sync_status","remote_access"].includes(d.key)),n=e.users.find(d=>d.id===this.selected)??null;return t`
      <div class="stage">
        ${e.users.length?t`<sw-table .columns=${r} .rows=${e.users} .selected=${this.selected} @row-select=${d=>{this.selected=d.detail.id,this.wizard=null}}></sw-table>`:t`<sw-state-panel icon="users" state="empty" heading="אין משתמשים עדיין" hint=${e.directory.paired?"הספרייה תגיע מהגשר תוך דקה.":"צמד את גשר Arx ב־Home Assistant כדי לקבל את רשימת המשתמשים."}></sw-state-panel>`}
        ${n?t`<sw-drawer open modal heading=${n.name} subheading=${`Home Assistant · ${n.username||n.id} · ${n.active?"פעיל":"ללא גישה"}`} data-user-drawer @close=${()=>{this.selected=null,this.wizard=null}}>
              ${this.wizard&&this.wizard.subjectKind==="user"?this.renderWizard():t`<dl>
                    <dt>מקור זהות</dt><dd>Home Assistant · <span class="ltr">${n.id}</span></dd>
                    <dt>סנכרון</dt><dd>${oe[n.sync_status]}${n.synced_at?` · ${y(n.synced_at)}`:""}</dd>
                    <dt>ב־Arx</dt><dd>${n.first_seen_at?`מאז ${y(n.first_seen_at)} · לאחרונה ${y(n.last_seen_at)}`:"טרם נכנס לממשק"}</dd>
                    <dt>מנהל HA</dt><dd>${n.is_admin?"כן · מידע בלבד, לא תפקיד במערכת":"לא"}</dd>
                    <dt>קבוצות</dt><dd>${n.groups.map(d=>d.name).join(", ")||"—"}</dd>
                    ${e.delegated?l:t`<dt>גישה מרחוק</dt><dd data-remote-access>${x("system.configure")?t`<sw-toggle label="SmplWise Arx" .checked=${te(!!n.remote_access&&this.remoteOff?.userId!==n.id)} ?disabled=${this.busy||n.remote_access_basis==="admin_default"} data-remote-access-toggle @change=${d=>this.requestRemote(n,d.detail.checked)}></sw-toggle>`:n.remote_access_basis==="admin_default"?"ברירת מחדל (מנהל)":n.remote_access?"מופעלת":"כבויה"}
                      ${n.remote_access_basis==="admin_default"?t`<div class="sub" data-remote-admin-default>ברירת מחדל (מנהל) · משתנה בהגדרות ‹ גישה מרחוק</div>`:l}
                      <div class="sub" data-remote-stats>${this.remoteStats(n)}</div>
                      ${this.remoteOff?.userId===n.id?t`<div class="remote-off" role="alert" data-remote-off-impact>
                            <span>${this.remoteOff.count===1?"כניסה פעילה אחת תיסגר עכשיו":`${this.remoteOff.count} כניסות פעילות ייסגרו עכשיו`} (כולל חיבורי וידאו פתוחים).</span>
                            <sw-button size="sm" variant="danger" data-remote-off-confirm ?disabled=${this.busy} @click=${()=>void this.toggleRemote(n.id,!1)}>כבה וסגור</sw-button>
                            <sw-button size="sm" variant="ghost" @click=${()=>this.remoteOff=null}>ביטול</sw-button>
                          </div>`:l}</dd>`}
                    ${!e.delegated&&x("system.configure")?t`<dt>${Y("secondFactor.adminLabel")}</dt><dd data-second-factor-user><sw-second-factor-user .userId=${n.id}></sw-second-factor-user></dd>`:l}
                    ${!e.delegated&&x("system.configure")?t`<dt>${Y("secondFactor.overrideLabel")}</dt><dd data-second-factor-policy-user><sw-second-factor-policy kind="user" .subjectId=${n.id}></sw-second-factor-policy></dd>`:l}
                    ${!e.delegated&&x("system.configure")?t`<dt>אזעקה</dt><dd data-alarm-user-policy><system-alarm-user .userId=${n.id} ?canEdit=${!this.busy}></system-alarm-user></dd>`:l}
                  </dl>
                  <div class="sec">שיוכים</div>
                  ${n.bindings.length?n.bindings.map(d=>this.renderBindingRow(d,s)):t`<div class="hint">ללא שיוך: אין גישה לתוכן.</div>`}
                  <div class="hint">אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.</div>`}
              <div slot="footer" class="dfoot">
                ${this.wizard?t`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${()=>this.saveWizard()}>שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>ביטול</sw-button>`:t`${s&&!(e.delegated&&n.is_self)?t`<sw-button variant="primary" size="sm" icon="plus" data-assign @click=${()=>this.startWizard("user",n.id,n.name)}>שיוך תפקיד</sw-button>`:l}
                    <sw-button variant="ghost" size="sm" icon="shield" data-user-effective @click=${()=>{this.previewUser=n.id,this.selected=null,this.setTab("effective"),this.runPreview()}}>הרשאות אפקטיביות</sw-button>`}
              </div>
            </sw-drawer>`:l}
      </div>
    `}renderGroupsApi(){const e=this.groups??[],s=this.directory,a=s.can_assign,i=[{key:"name",label:"קבוצה",render:v=>t`<strong>${String(v.name)}</strong>`},{key:"members",label:"חברים",render:v=>t`${v.members.length}`},{key:"bindings",label:"שיוכים (תפקיד · היקף)",render:v=>t`${v.bindings.map(j=>t`<div style="font-size:var(--sw-fs-xs)">${j.role_name} · ${j.scope_name}${j.effect==="deny"?t` <span data-binding-deny style="color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)">· חסימה</span>`:l}</div>`)}`}],r=e.find(v=>v.id===this.selectedGroup)??null,n=this.members??new Set(r?.members.map(v=>v.id)??[]),d=this.groupsMeta.can_manage,m=!!s.delegated,u=H.me?.user.id,h=r?r.members.length>0||r.bindings.length>0:!1,ke=new Set(s.users.map(v=>v.id)),xe=r?r.members.filter(v=>!ke.has(v.id)):[];return t`
      <sw-card heading="קבוצות" subheading=${m?"הקבוצות שכל השיוכים שלהן בתוך ההיקף שלך · חברות ושיוך תפקידים מרשימת ההאצלה":"קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו · ההרשאות האפקטיביות = השיוכים האישיים + שיוכי הקבוצות, בכל היקף בנפרד"} data-groups-card>
        ${d?t`<div class="toolbar"><sw-field label="קבוצה חדשה"><input data-group-new .value=${this.newGroup} placeholder="למשל: עורכי קומה 2" @input=${v=>this.newGroup=v.target.value} @keydown=${v=>{v.key==="Enter"&&this.addGroup()}} /></sw-field><sw-button size="sm" icon="plus" data-group-create ?disabled=${this.busy||!this.newGroup.trim()} @click=${()=>this.addGroup()}>יצירה</sw-button></div>`:t`<div class="hint">${m?"יצירה, שינוי שם ומחיקה של קבוצות — מנהל המערכת בלבד. קבוצה שיש לה שיוך מחוץ להיקף שלך, או שאתה חבר בה, אינה מוצגת כאן.":"יצירה, שינוי שם ומחיקה של קבוצות דורשים ניהול תפקידים (מנהל מערכת)."}</div>`}
      </sw-card>
        <div class="stage groups-stage">
          ${e.length?t`<sw-table .columns=${i} .rows=${e} .selected=${this.selectedGroup} @row-select=${v=>{this.selectedGroup=v.detail.id,this.members=null,this.wizard=null,this.renameDraft=null}}></sw-table>`:t`<sw-state-panel icon="users" state="empty" heading="אין קבוצות" hint=${m?"אין קבוצה שכל השיוכים שלה בתוך ההיקף שלך.":"קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו. קבוצות Arx בלבד, לא קבוצות HA."}></sw-state-panel>`}
          ${r?t`<sw-drawer open modal heading=${r.name} subheading=${`${r.members.length} חברים · ${r.bindings.length} שיוכים · רוויזיה ${r.revision}`} data-group-drawer @close=${()=>{this.selectedGroup=null,this.members=null,this.wizard=null,this.renameDraft=null}}>
                ${this.wizard&&this.wizard.subjectKind==="group"?this.renderWizard():t`${d?t`<div class="toolbar" style="margin-block-end:8px"><sw-field label="שם הקבוצה"><input data-group-rename .value=${this.renameDraft??r.name} @input=${v=>this.renameDraft=v.target.value} @keydown=${v=>{v.key==="Enter"&&this.saveRename(r)}} /></sw-field><sw-button size="sm" data-group-rename-save ?disabled=${this.busy||this.renameDraft===null||!this.renameDraft.trim()||this.renameDraft.trim()===r.name} @click=${()=>this.saveRename(r)}>שינוי שם</sw-button></div>`:l}
                    <div class="sec">שיוכים של הקבוצה</div>
                    ${r.bindings.length?r.bindings.map(v=>this.renderBindingRow(v,a)):t`<div class="hint">ללא שיוך: החברים אינם מקבלים דבר דרך הקבוצה.</div>`}
                    <div class="sec">חברים · ${n.size}</div>
                    <div class="members in-drawer">${s.users.map(v=>t`<label><input type="checkbox" data-member=${v.id} ?disabled=${!a||m&&v.id===u} .checked=${n.has(v.id)} @change=${j=>{const V=new Set(n);j.target.checked?V.add(v.id):V.delete(v.id),this.members=V}} /> ${v.name}<span class="hint">${v.active?"":" · ללא גישה"}${m&&v.id===u?" · לא ניתן לצרף את עצמך":""}</span></label>`)}${xe.map(v=>t`<label><input type="checkbox" checked disabled /> ${v.name}<span class="hint"> · מחוץ לרשימה שלך</span></label>`)}</div>
                    <div class="hint">שינוי חברות ושיוך נבדקים מול כל השיוכים של הקבוצה, מוצגים לפני השמירה עם ההשפעה על כל משתמש, ונרשמים באודיט.</div>
                    ${d&&h?t`<div class="hint" data-group-in-use>מחיקה אפשרית רק לקבוצה ללא חברים וללא שיוכים — הסר אותם קודם.</div>`:l}`}
                <div slot="footer" class="dfoot">
                  ${this.wizard?t`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${()=>this.saveWizard()}>שמור שיוך</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>ביטול</sw-button>`:t`${a?t`<sw-button variant="primary" size="sm" icon="check" data-group-save-members ?disabled=${this.busy||!this.members} @click=${()=>this.saveMembers(r)}>שמור חברים</sw-button>
                          <sw-button size="sm" icon="plus" data-group-bind ?disabled=${this.busy} @click=${()=>this.startWizard("group",r.id,r.name)}>שיוך תפקיד</sw-button>`:l}
                      ${d?t`<sw-button variant="danger" size="sm" icon="trash" class="end" data-group-delete ?disabled=${this.busy||h} @click=${()=>this.removeGroup(r)}>מחיקה</sw-button>`:l}`}
                </div>
                ${this.renderGroupChange()}
              </sw-drawer>`:l}
        </div>
      ${r?l:this.renderGroupChange()}
    `}renderGroupChange(){const e=this.groupChange;if(!e)return l;const s=e.impact,a=r=>s.labels[r]??this.label(r),i={member:"חבר",added:"מצטרף",removed:"יוצא"};return t`<sw-dialog open heading="השפעת השינוי" subheading=${e.heading} data-group-impact @close=${()=>this.groupChange=null}>
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
    </sw-dialog>`}openRole(e){this.roleImpact=null;const s=new Set(this.roles?.sensitive??[]);this.roleEdit=e?{id:e.id,revision:e.revision??1,name:e.name,description:e.description??"",permissions:e.permissions.filter(a=>!s.has(a)),sensitive:e.permissions.filter(a=>s.has(a)),delegable:!!e.delegable}:{id:null,revision:0,name:"",description:"",permissions:["map.read"],sensitive:[],delegable:!1},this.scheduleImpact()}toggleRolePerm(e,s){const a=this.roleEdit;if(!a)return;const i=s?"sensitive":"permissions",r=a[i].includes(e)?a[i].filter(n=>n!==e):[...a[i],e];this.roleEdit={...a,[i]:r},this.scheduleImpact()}scheduleImpact(){window.clearTimeout(this.roleImpactTimer),this.roleImpactTimer=window.setTimeout(()=>void this.loadImpact(),300)}async loadImpact(){const e=this.roleEdit;if(!e||!e.permissions.length&&!e.sensitive.length){this.roleImpact=null;return}try{this.roleImpact=await es({role_id:e.id,permissions:e.permissions,sensitive:e.sensitive})}catch(s){this.error=f(s)}}async saveRole(){const e=this.roleEdit;if(!(!e||!e.name.trim())){this.busy=!0,this.error="";try{const s={name:e.name.trim(),description:e.description,permissions:e.permissions,sensitive:e.sensitive,delegable:e.delegable&&!e.sensitive.length&&!e.permissions.includes("rbac.assign")};if(e.id){await ss(e.id,{...s,revision:e.revision}),this.roleEdit=null,this.roleImpact=null,this.message="התפקיד עודכן; השינוי חל על כל המשויכים ברענון הבא",this.roles=await N();return}const a=await ts(s);this.roleEdit=null,this.roleImpact=null,this.roles=await N();const i=H.me?.user.id;if(e.assignMe!==!1&&i)try{await ne({subject_kind:"user",subject_id:i,role_id:a.id,scope_type:"installation",scope_id:"*"}),this.message=`התפקיד "${a.name}" נוצר ושויך אליך (כל המתקן). ההרשאות החדשות ייכנסו לתוקף ברענון הבא של הדף.`}catch(r){this.message=`התפקיד "${a.name}" נוצר, אך השיוך האוטומטי אליך נכשל (${f(r)}). שייך אותו ידנית בלשונית "שיוכים".`}else this.message=`התפקיד "${a.name}" נוצר. שייך אותו למשתמש או לקבוצה בלשונית "שיוכים".`}catch(s){this.error=f(s)}finally{this.busy=!1}}}setAllRolePerms(e,s,a){const i=this.roleEdit;i&&(this.roleEdit={...i,[e]:a?[...new Set([...i[e],...s])]:i[e].filter(r=>!s.includes(r))},this.scheduleImpact())}async removeRole(e){this.busy=!0,this.error="";try{await as(e.id),this.roleDelete=null,this.roles=await N()}catch(s){this.error=f(s),this.roleDelete=null}finally{this.busy=!1}}async toggleDelegable(e){const s=this.roles?.delegable_roles??[],a=s.includes(e)?s.filter(i=>i!==e):[...s,e];this.busy=!0,this.error="";try{await is(a),this.roles=await N()}catch(i){this.error=f(i)}finally{this.busy=!1}}renderRoleDialog(){const e=this.roleEdit,s=this.roles;if(!e||!s)return l;const a=new Set(s.sensitive),i=new Set(s.system_permissions??[]),r=Object.keys(s.labels).filter(u=>!a.has(u)&&!i.has(u)),n=new Set(e.id?s.roles.find(u=>u.id===e.id)?.permissions??[]:[]),d=Ts(js(s.sensitive,s.legacy_permissions,n),s.system_permissions),m=this.roleImpact;return t`<sw-dialog open heading=${e.id?"עריכת תפקיד מותאם":"תפקיד מותאם חדש"} subheading="הרשאות רגילות + הרשאות רגישות במפורש · ללא הרשאות מערכת · ההשפעה מוצגת לפני השמירה" data-role-dialog @close=${()=>this.roleEdit=null}>
      ${this.error?t`<div class="err banner" data-role-error>${this.error}</div>`:l}
      <sw-field label="שם"><input data-role-name .value=${e.name} @input=${u=>this.roleEdit={...e,name:u.target.value}} /></sw-field>
      <sw-field label="תיאור"><input .value=${e.description} @input=${u=>this.roleEdit={...e,description:u.target.value}} /></sw-field>
      <div class="hint permsrow">הרשאות רגילות
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-perm-all @click=${()=>this.setAllRolePerms("permissions",r,!0)}>בחר הכל</sw-button>
          <sw-button size="sm" variant="ghost" data-role-perm-none @click=${()=>this.setAllRolePerms("permissions",r,!1)}>נקה הכל</sw-button>
        </span>
      </div>
      <div class="perms">${r.map(u=>t`<label class="chk"><input type="checkbox" data-role-perm=${u} .checked=${e.permissions.includes(u)} @change=${()=>this.toggleRolePerm(u,!1)} /> ${s.labels[u]}</label>`)}</div>
      <div class="hint permsrow" style="margin-block-start:6px">הרשאות רגישות — לעולם לא מרומזות, נדרשות במפורש
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-sensitive-all @click=${()=>this.setAllRolePerms("sensitive",d,!0)}>בחר הכל</sw-button>
          <sw-button size="sm" variant="ghost" data-role-sensitive-none @click=${()=>this.setAllRolePerms("sensitive",d,!1)}>נקה הכל</sw-button>
        </span>
      </div>
      <div class="perms">${d.map(u=>t`<label class="chk sens"><input type="checkbox" data-role-sensitive=${u} .checked=${e.sensitive.includes(u)} @change=${()=>this.toggleRolePerm(u,!0)} /> ${s.labels[u]??u}</label>`)}</div>
      ${e.id?l:t`<label class="chk" style="margin-block-start:6px"><input type="checkbox" data-role-assign-me .checked=${e.assignMe!==!1} @change=${u=>this.roleEdit={...e,assignMe:u.target.checked}} /> שייך את התפקיד אליי מיד (כל המתקן)</label>`}
      <label class="chk" style="margin-block-start:6px"><input type="checkbox" data-role-delegable ?disabled=${e.sensitive.length>0||e.permissions.includes("rbac.assign")} .checked=${e.delegable&&!e.sensitive.length&&!e.permissions.includes("rbac.assign")} @change=${u=>this.roleEdit={...e,delegable:u.target.checked}} /> מנהל אתר רשאי להקצות תפקיד זה בהיקפו (בכפוף להרשאות שהוא מחזיק)${e.sensitive.length||e.permissions.includes("rbac.assign")?t`<span class="hint"> · לא זמין: תפקיד עם הרשאה רגישה או עם שיוך תפקידים אינו ניתן להאצלה</span>`:l}</label>
      ${m?t`<div class="impact" data-role-impact>
            <strong>השפעת השינוי:</strong> ${m.bindings} שיוכים · ${m.users.length} משתמשים${m.users.length?` (${m.users.map(u=>u.name).join(", ")})`:""}${m.groups.length?` · ${m.groups.length} קבוצות`:""}${m.scopes.length?` · היקפים: ${m.scopes.join(", ")}`:""}
            <div>${m.added.length?t`יתווספו: ${m.added.map(u=>s.labels[u]??u).join(", ")}`:"ללא הרשאות חדשות"} · ${m.removed.length?t`<span class="err">יוסרו: ${m.removed.map(u=>s.labels[u]??u).join(", ")}</span>`:"ללא הסרות"}</div>
          </div>`:l}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.roleEdit=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-role-save ?disabled=${this.busy||!e.name.trim()||!e.permissions.length&&!e.sensitive.length} @click=${()=>this.saveRole()}>${e.id?"שמירה":"צור תפקיד"}</sw-button>
    </sw-dialog>`}renderRolesApi(){const e=this.roles;return t`<div class="roles">${e.roles.map(s=>t`<sw-card class="role" data-role-card=${s.id}><h4><span class="ic"><sw-icon name=${s.custom?"user":s.id==="viewer"?"eye":s.id==="operator"?"play":s.id==="editor"?"edit":s.id==="site_admin"?"building":s.id==="kiosk"?"grid":"shield"} size=${14}></sw-icon></span>${s.name}${s.custom?t` <sw-badge kind="recorded" label="מותאם"></sw-badge>`:l}${s.system_role?t` <sw-badge kind="neutral" label="הרשאות מערכת"></sw-badge>`:l}${s.delegable?t` <sw-badge kind="historic" label="ניתן להאצלה"></sw-badge>`:l}</h4>${s.description?t`<div class="desc">${s.description}</div>`:l}<div class="a">מותר: ${s.permissions.map(a=>this.label(a)).join(", ")}</div><div class="d">לא כלול אוטומטית: ${s.sensitive_missing.map(a=>this.label(a)).join(", ")||"—"}</div>${x("system.configure")?t`<div class="pol" data-second-factor-policy-role>${Y("secondFactor.overrideLabel")}<sw-second-factor-policy kind="role" .subjectId=${s.id}></sw-second-factor-policy></div>`:l}${s.custom&&e.can_manage_roles?t`<div class="acts"><sw-button size="sm" data-role-edit @click=${()=>this.openRole(s)}>עריכה</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-role-delete @click=${()=>this.roleDelete=s}>מחיקה</sw-button></div>`:l}</sw-card>`)}</div>
      ${e.can_manage_roles?t`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" data-role-new @click=${()=>this.openRole()}>תפקיד מותאם חדש</sw-button></div>
            <sw-card heading="האצלת שיוך תפקידים למנהלי אתר" subheading="מנהל אתר משייך רק תפקידים מהרשימה הזו, רק הרשאות שהוא מחזיק בעצמו, רק בתוך ההיקף שלו, ולעולם לא לעצמו; קבוצה — רק כשכל השיוכים שלה בהיקף שלו" style="margin-block-start:12px" data-delegation>
              <div class="chips">${e.roles.filter(s=>!s.delegation_block).map(s=>t`<sw-chip data-delegable=${s.id} ?selected=${(e.delegable_roles??[]).includes(s.id)} @click=${()=>void this.toggleDelegable(s.id)}>${s.name}</sw-chip>`)}</div>
              <div class="hint" style="margin-block-start:6px" data-delegation-blocked>לעולם לא ניתנים להאצלה: ${e.roles.filter(s=>s.delegation_block).map(s=>`${s.name} (${s.delegation_block==="system_role"?"תפקיד ניהול / הרשאות מערכת":s.delegation_block==="assign_role"?"כולל שיוך תפקידים":"הרשאה רגישה"})`).join(" · ")||"—"}. ברירת המחדל: צופה ומפעיל.</div>
            </sw-card>`:e.delegated?t`<div class="hint" style="margin-block-start:10px" data-delegation>מוצגים רק התפקידים שמותר לך לשייך בהיקף שלך (רשימת ההאצלה של ההתקנה). עריכת תפקידים והרשימה — מנהל המערכת בלבד.</div>`:l}
      <div class="hint">תפקידים מובנים אינם נערכים; תפקיד מותאם מורכב מהרשאות רגילות ומהרשאות רגישות שניתנות במפורש, ולעולם לא מהרשאות מערכת. התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>
      <elec-permission-rows .roles=${e}></elec-permission-rows>
      ${this.renderRoleDialog()}
      ${this.roleDelete?t`<sw-dialog open heading="מחיקת תפקיד" subheading=${this.roleDelete.name} @close=${()=>this.roleDelete=null}>
            <div class="hint">תפקיד משויך אינו נמחק: בטל קודם את השיוכים. המחיקה נרשמת באודיט.</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.roleDelete=null}>ביטול</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-role-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeRole(this.roleDelete)}>מחק</sw-button>
          </sw-dialog>`:l}`}doorPermissionNote(e){const s=Le(e,x("system.configure"));return s?t`<div class="hint" style="margin-block-start:12px" data-effective-door-note>${s.text}${s.link?t` <a data-effective-door-link href=${s.link.href}>${s.link.label}</a>`:l}</div>`:l}renderEffectiveApi(){const e=this.directory,s=this.preview;return t`
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
            ${s.bindings.length?t`<div class="sec">שיוכים שנלקחו בחשבון</div>${s.bindings.map(a=>t`<div class="bind"><div>${a.role_name} · ${a.scope_name}${a.via_group?` (קבוצה "${a.via_group}")`:""}</div></div>`)}`:l}
            <div class="hint" style="margin-block-start:12px">תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו; החישוב נעשה בצד השרת.</div>
          </sw-card>`:t`<sw-state-panel icon="shield" state="empty" heading="בחר משתמש והיקף" hint="החישוב מראה מה מותר ומה לא למשתמש בהיקף שנבחר, לפי השיוכים האישיים ושיוכי הקבוצות." data-effective-idle></sw-state-panel>`}
    `}renderAuditApi(){if(!this.audit)return this.loadAudit(),t`<sw-state-panel state="loading"></sw-state-panel>`;const e=[{key:"at",label:"זמן",render:s=>t`<span style="font-size:var(--sw-fs-xs)">${y(String(s.at))}</span>`},{key:"actor_username",label:"מבצע",render:s=>t`${String(s.actor_username??"מערכת / HA")}`},{key:"action",label:"פעולה",render:s=>t`${rs[String(s.action)]??String(s.action)}`},{key:"resource_id",label:"משאב",render:s=>t`${s.resource_type==="user"?this.userName(String(s.resource_id)):s.resource_type==="group"?this.groups?.find(a=>a.id===s.resource_id)?.name??String(s.resource_id):String(s.resource_id??"")}`},{key:"decision",label:"החלטה",render:s=>t`<sw-badge kind=${s.decision==="denied"?"forbidden":"live"} label=${s.decision==="denied"?`נחסם${s.reason?` · ${String(s.reason)}`:""}`:"הותר"}></sw-badge>`},{key:"details",label:"פרטים",render:s=>{const a=s.details,i=[a.role_id?`${String(a.role_id)}`:"",a.scope?String(a.scope):"",Array.isArray(a.added)&&a.added.length?`+${a.added.length}`:"",Array.isArray(a.removed)&&a.removed.length?`−${a.removed.length}`:"",a.revision?`rev ${String(a.revision)}`:""].filter(Boolean);return t`<span style="font-size:var(--sw-fs-xs);direction:ltr;unicode-bidi:isolate">${i.join(" · ")}</span>`}}];return t`<sw-lookup-scope></sw-lookup-scope>${this.audit.length?t`<sw-table dense .columns=${e} .rows=${this.audit} rowKey="at"></sw-table>`:t`<sw-state-panel icon="users" state="empty" heading="אין רשומות אודיט הרשאות" hint="כל שיוך, ביטול, קבוצה או שינוי מצב משתמש יופיע כאן."></sw-state-panel>`}`}renderApi(){if(this.forbidden)return t`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="forbidden" hint="צפייה בספריית המשתמשים דורשת תפקיד מנהל מערכת."></sw-state-panel></sw-page>`;if(this.error&&!this.directory)return t`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.directory||!this.roles)return t`<sw-page heading="משתמשים והרשאות"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.directory,s=[{id:"users",label:"משתמשים",count:e.users.length},{id:"groups",label:"קבוצות",count:this.groups?.length??0},{id:"roles",label:"תפקידים",count:this.roles.roles.length},{id:"effective",label:"הרשאות אפקטיביות"},...!e.delegated||e.assignable_roles?.includes("door_opener")?[{id:"doors",label:"פתיחת דלתות"}]:[],...e.delegated&&!this.groupsMeta.can_manage?[]:[{id:"audit",label:"אודיט הרשאות"}],...x("users.ha_manage")?[{id:"ha-users",label:p("tab")}]:[],...x("identity.directory.read")?[{id:"local",label:o("tab")}]:[]],a=e.delegated&&!this.groupsMeta.can_manage?`מנהל אתר · שיוך תפקידים מרשימת ההאצלה בתוך ההיקף שלך בלבד · ${e.users.length} משתמשים פעילים · רוויזיית הרשאות ${e.revision}`:e.directory.paired?`זהות מ־Home Assistant · ${e.directory.users} משתמשים בספרייה · עודכן ${y(e.directory.last_directory_at)} · רוויזיית הרשאות ${e.revision}`:"זהות מ־Home Assistant · הגשר עדיין לא מצומד: מוצגים רק משתמשים שנכנסו דרך Ingress";return t`
      <sw-page heading="משתמשים והרשאות" subheading=${a}>
        ${e.delegated?l:t`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>סנכרון משתמשים מ־HA</sw-button>`}
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props("").variant} ?adaptive=${this.tabsMode.props("").adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label="הרשאות" .items=${s} .active=${this.tab} @change=${i=>this.setTab(i.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. ${x("users.ha_manage")?'משתמש חדש נוצר בלשונית "משתמשי מערכת הבית" (תמיד כמשתמש רגיל) או במסך של מערכת הבית.':'אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.'}</div>
        ${this.message||this.error?t`<div class="bar">${this.message?t`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:l}${this.error?t`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:l}</div>`:l}
        ${this.tab==="users"?this.renderUsersApi():this.tab==="groups"?this.renderGroupsApi():this.tab==="roles"?this.renderRolesApi():this.tab==="effective"?this.renderEffectiveApi():this.tab==="doors"?t`<sw-door-grants data-door-grants></sw-door-grants>`:this.tab==="ha-users"?t`<sw-ha-users data-ha-users-tab></sw-ha-users>`:this.tab==="local"?t`<system-local-users data-local-users-tab .roles=${ae(this.roles.roles)} .scopes=${this.scopeOptions}></system-local-users>`:this.renderAuditApi()}
      </sw-page>
    `}renderUsers(){const e=se.find(s=>s.id===this.selected);return t`
      <div class="stage">
        <sw-table .columns=${this.userColumns} .rows=${se} .selected=${this.selected} @row-select=${s=>{this.selected=s.detail.id,this.assigning=!1}}></sw-table>
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
    `}renderGroups(){return t`<sw-table .columns=${[{key:"name",label:"קבוצה",render:s=>t`<strong>${String(s.name)}</strong>`},{key:"members",label:"חברים"},{key:"bindings",label:"שיוכים (תפקיד · היקף)",render:s=>t`${s.bindings.map(a=>t`<div>${a}</div>`)}`},{key:"more",label:"",width:"40px",render:()=>t`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>`}]} .rows=${$e}></sw-table><div class="hint">שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.</div>`}renderRoles(){return t`<div class="roles">${ye.map(e=>t`<sw-card class="role"><h4><span class="ic"><sw-icon name=${e.id==="viewer"?"eye":e.id==="operator"?"play":e.id==="editor"?"edit":e.id==="site_admin"?"building":"shield"} size=${14}></sw-icon></span>${e.name}</h4><div class="a">מותר: ${e.allowed}</div><div class="d">לא ניתן אוטומטית: ${e.denied}</div></sw-card>`)}</div><div class="hint">תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.</div>`}renderEffective(){return t`
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
    `}renderAudit(){return t`<sw-table dense .columns=${[{key:"time",label:"זמן"},{key:"user",label:"משתמש",render:s=>t`<div class="who"><sw-avatar name=${String(s.user)} size=${24}></sw-avatar>${String(s.user)}</div>`},{key:"action",label:"פעולה"},{key:"resource",label:"משאב"},{key:"decision",label:"החלטה",render:s=>t`<sw-badge kind=${String(s.decision).startsWith("נחסם")?"forbidden":"live"} label=${String(s.decision)}></sw-badge>`},{key:"role",label:"תפקיד/היקף ששימשו"}]} .rows=${He.filter(s=>s.action.includes("תוכנית")||s.action.includes("סנכרון")||s.action.includes("Ingress"))}></sw-table>`}render(){return S()?this.renderApi():t`
      <sw-page heading="משתמשים והרשאות" subheading="זהות מ־Home Assistant · הרשאות בתוך Arx בלבד · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון משתמשים מ־HA</sw-button>
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props("").variant} ?adaptive=${this.tabsMode.props("").adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label="הרשאות" .items=${[...ve,{id:"ha-users",label:p("tab")}]} .active=${this.tab} @change=${e=>this.setTab(e.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות. ${x("users.ha_manage")?'משתמש חדש נוצר בלשונית "משתמשי מערכת הבית" (תמיד כמשתמש רגיל) או במסך של מערכת הבית.':'אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.'}</div>
        ${this.tab==="users"?this.renderUsers():this.tab==="groups"?this.renderGroups():this.tab==="roles"?this.renderRoles():this.tab==="effective"?this.renderEffective():this.tab==="ha-users"?t`<sw-ha-users data-ha-users-tab></sw-ha-users>`:this.renderAudit()}
      </sw-page>
    `}};w.styles=[fe,U`
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
  `,ge];g([c()],w.prototype,"tab",2);g([c()],w.prototype,"selected",2);g([c()],w.prototype,"assigning",2);g([c()],w.prototype,"step",2);g([c()],w.prototype,"directory",2);g([c()],w.prototype,"roles",2);g([c()],w.prototype,"groups",2);g([c()],w.prototype,"tree",2);g([c()],w.prototype,"audit",2);g([c()],w.prototype,"selectedGroup",2);g([c()],w.prototype,"wizard",2);g([c()],w.prototype,"members",2);g([c()],w.prototype,"newGroup",2);g([c()],w.prototype,"preview",2);g([c()],w.prototype,"previewUser",2);g([c()],w.prototype,"previewScope",2);g([c()],w.prototype,"busy",2);g([c()],w.prototype,"error",2);g([c()],w.prototype,"message",2);g([c()],w.prototype,"forbidden",2);g([c()],w.prototype,"roleEdit",2);g([c()],w.prototype,"roleImpact",2);g([c()],w.prototype,"roleDelete",2);g([c()],w.prototype,"groupsMeta",2);g([c()],w.prototype,"renameDraft",2);g([c()],w.prototype,"groupChange",2);g([c()],w.prototype,"remoteOff",2);g([c()],w.prototype,"narrow",2);w=g([T("system-access")],w);export{w as SystemAccess};
//# sourceMappingURL=system-access-qa4CwRtP.js.map
