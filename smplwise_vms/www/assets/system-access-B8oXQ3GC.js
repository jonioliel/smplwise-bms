import"./sw-second-factor-C8W5FhYe.js";import{a1 as L,bn as H,b3 as D,c_ as Te,cY as Ne,bE as Ge,bF as qe,aT as Ee,g as q,j as h,i as B,aK as $e,a as te,m as f,A as c,b as a,a5 as Be,bb as We,k as W,aw as ne,bl as U,a0 as ae,bm as K,b$ as Fe,bo as Re,dD as G,wD as Ke,uE as O,wE as Pe,s as Q,bq as Ve,ed as Ye,a9 as Je,wF as me,wG as Oe,wH as Le,az as C,d0 as Ze,Q as Qe,wI as Xe,cO as oe,fF as es,dn as ss}from"./index-BYRaM0w7.js";import"./system-alarm-Dt-JzQMO.js";import{l as we}from"./live-CilGSmOB.js";import"./sw-table-VzVxYctQ.js";import"./sw-steps-Cm6_vURU.js";import"./sw-chip-CouakMmq.js";import"./system-doors-CF9fCoUV.js";import{fmtWhen as S,listUsers as ts,listRoles as V,listGroups as as,listAudit as ge,groupImpact as is,bindGroup as rs,createBinding as fe,unbindGroup as ns,revokeBinding as os,syncDirectory as ls,createGroup as ds,setGroupMembers as cs,renameGroup as ps,deleteGroup as hs,previewAccess as us,setRemoteAccess as ms,SYNC_LABEL as be,previewRole as ws,updateRole as vs,createRole as $s,deleteRole as gs,setDelegation as fs,ACTION_LABEL as bs}from"./access-B1k_bu-Z.js";import{s as Ue}from"./settings-kC3vgv__.js";import{b as Me}from"./bubble-chrome-BtjbJxHL.js";import{T as je}from"./toast-controller-BPX0Tkjm.js";import{l,d as ys,u as _s,e as ks,p as Y,f as xs}from"./passkey-only-DM7nBv7H.js";import{c as le}from"./confirm-dialog-BAnE0kNe.js";import{a as zs,c as Ss}from"./confirm-words-CIzDMVUQ.js";import{b as As}from"./lock-reason-DNYM2ma3.js";import{e as Cs}from"./styles-CoHOCgmg.js";import{b as Es}from"./access-VnfLfycJ.js";import{t as d,g as Rs,a as Ps,G as Os,b as Ls,P as Us}from"./home-api-Bjcj1XSB.js";import"./sw-view-switch-BPNyiPFt.js";import{t}from"./system-a-zQMR-zdk.js";import"./qrcode-CWKHzRGU.js";import"./sw-logo-art-PLtEZJxU.js";import"./door-path-logic-BT7ZMFMV.js";import"./automations-D4qdJMEM.js";const I={users:[{ha_user_id:"demo-1",username:"dana",display_name:"דנה לוי",role_id:"viewer",role_name:"צופה",scope_type:"installation",scope_id:"*",scope_name:"כל ההתקנה",state:"active",repair:null,person:!0,created_at:"2026-10-16T08:00:00Z",created_by_name:"מנהל",is_self:!1},{ha_user_id:"demo-2",username:"yossi",display_name:"יוסי כהן",role_id:"operator",role_name:"מפעיל",scope_type:"installation",scope_id:"*",scope_name:"כל ההתקנה",state:"inactive",repair:null,person:!0,created_at:"2026-10-15T08:00:00Z",created_by_name:"מנהל",is_self:!1}],can_manage:!0,actor_ha_admin:!0,transport:"supervisor",access:{state:"ok",checked_at:"2026-10-16T08:00:00Z"},roles:[{id:"viewer",name:"צופה"},{id:"operator",name:"מפעיל"},{id:"editor",name:"עורך מפות ותצוגות"}],scopes:[{type:"installation",id:"*",name:"כל ההתקנה"}],password:{min_length:10,max_length:128},limit:50},X=e=>JSON.parse(JSON.stringify(e)),J={async view(){return L()?D("/ha-users"):X(I)},async check(){return L()?H("/ha-users/check",{}):{access:X(I.access),transport:I.transport}},async create(e){if(L())return H("/ha-users",e);const s=I.roles.find(r=>r.id===e.role_id),i={ha_user_id:`demo-${Date.now()}`,username:e.username,display_name:e.display_name,role_id:e.role_id,role_name:s?.name??e.role_id,scope_type:e.scope_type,scope_id:e.scope_id,scope_name:"כל ההתקנה",state:"active",repair:null,person:e.create_person,created_at:new Date().toISOString(),created_by_name:"מנהל",is_self:!1};return I.users.push(i),{user:X(i),replayed:!1}},async setActive(e,s){if(L())return H(`/ha-users/${encodeURIComponent(e)}/${s?"activate":"deactivate"}`,{confirm:!0});const i=I.users.find(r=>r.ha_user_id===e);return i&&(i.state=s?"active":"inactive"),{user:X(i)}},async remove(e,s){return L()?H(`/ha-users/${encodeURIComponent(e)}/delete`,{confirm_username:s}):(I.users=I.users.filter(i=>i.ha_user_id!==e),{deleted:e,already_gone:!1})}},De={tab:"משתמשי מערכת הבית",title:"משתמשי מערכת הבית",sub:"יצירת משתמש רגיל במערכת הבית עם תפקיד ב־Arx. מכאן אפשר להשבית או למחוק רק משתמשים שנוצרו כאן.",keywords:"משתמש חדש יצירה מחיקה השבתה סיסמה מערכת הבית",loading:"טוען…",forbidden:"ניהול משתמשי מערכת הבית שמור למנהלי המערכת.",retry:"נסו שוב",accessTitle:"הרשאה במערכת הבית",check:"בדיקת הרשאה",checking:"בודק…",checkedAt:"נבדק {time}",acc_ok:"למערכת יש הרשאה לנהל משתמשים במערכת הבית.",acc_unknown:'עוד לא נבדק. לחצו "בדיקת הרשאה" לפני יצירת המשתמש הראשון.',acc_not_authorised:"למערכת אין הרשאת מנהל במערכת הבית, ולכן אי אפשר ליצור או למחוק משתמשים מכאן.",acc_not_authorised_fix:'מה עושים: במערכת הבית, בפרופיל של חשבון מנהל, יוצרים אסימון גישה לטווח ארוך (Long-Lived Access Token), ושומרים אותו בהגדרות ‹ חיבורים ‹ סודות בשורה "אסימון מנהל לניהול משתמשי מערכת הבית". אין צורך בהפעלה מחדש; אחר כך לוחצים שוב "בדיקת הרשאה". אפשר גם להמשיך לנהל משתמשים במסך המשתמשים של מערכת הבית.',acc_unavailable:"מערכת הבית אינה זמינה כרגע. נסו שוב בעוד רגע.",acc_not_configured:"החיבור למערכת הבית אינו מוגדר בהתקנה הזו.",acc_failed:"הבדיקה נכשלה. נסו שוב.",via_supervisor:"בזהות התוסף",via_token:"באסימון המנהל שהוגדר",notHaAdmin:"רק מנהל של מערכת הבית יכול ליצור, להשבית או למחוק משתמשים. אפשר לצפות ברשימה.",listTitle:"משתמשים שנוצרו דרך Arx",empty:"עוד לא נוצרו משתמשים מכאן.",emptyHint:'משתמשים קיימים של מערכת הבית מופיעים בלשונית "משתמשים", ושם משייכים להם תפקידים.',add:"משתמש חדש",count:"{n} מתוך {max}",colName:"שם",colUser:"שם משתמש",colRole:"תפקיד ב־Arx",colState:"מצב",st_active:"פעיל",st_inactive:"מושבת",st_needs_repair:"דורש תיקון",repair_person_missing:"נוצר בלי כרטיס אדם",repair_compensation_failed:"היצירה נכשלה באמצע; יש למחוק",repair_binding_failed:"שיוך התפקיד נכשל; יש למחוק",repair_cleanup_failed:"הניקוי לא הושלם; יש למחוק שוב",repair_missing_in_ha:"לא נמצא במערכת הבית; יש למחוק",you:"אתם",deactivate:"השבתה",activate:"הפעלה",remove:"מחיקה",createTitle:"משתמש חדש במערכת הבית",createSub:"המשתמש נוצר כמשתמש רגיל (לא מנהל) ומקבל את התפקיד שנבחר ב־Arx בלבד.",fName:"שם מוצג",fUsername:"שם משתמש לכניסה",fUsernameHint:"אותיות לטיניות קטנות, ספרות, נקודה, מקף או קו תחתון; 3 עד 32 תווים.",fPassword:"סיסמה",fPassword2:"סיסמה שוב",fPasswordHint:"לפחות {min} תווים, לא סיסמה נפוצה ולא רצף. הסיסמה לא נשמרת ב־Arx ולא תוצג שוב.",fRole:"תפקיד ב־Arx",fScope:"היקף",fPerson:"ליצור גם כרטיס אדם במערכת הבית",create:"יצירה",cancel:"ביטול",created:"המשתמש {name} נוצר.",createdNoPerson:"המשתמש {name} נוצר, אך כרטיס האדם לא נוצר.",e_name:"נדרש שם מוצג.",e_username:"שם המשתמש אינו בפורמט הנדרש.",e_mismatch:"הסיסמאות אינן זהות.",e_role:"יש לבחור תפקיד.",pw_too_short:"הסיסמה קצרה מדי.",pw_too_long:"הסיסמה ארוכה מדי.",pw_repetitive:"הסיסמה חוזרת על אותם תווים.",pw_common:"הסיסמה נפוצה מדי.",pw_sequence:"הסיסמה היא רצף מקלדת או ספרות.",pw_contains_username:"הסיסמה מכילה את שם המשתמש.",pw_contains_name:"הסיסמה מכילה את השם המוצג.",deactivateTitle:"השבתת {name}",deactivateBody:"המשתמש לא יוכל להיכנס למערכת הבית ול־Arx עד שיופעל שוב. אפשר להפעיל אותו מחדש בכל עת.",activateTitle:"הפעלת {name}",activateBody:"המשתמש יוכל להיכנס שוב, עם התפקיד שלו ב־Arx.",confirm:"אישור",deactivated:"המשתמש הושבת.",activated:"המשתמש הופעל.",removeTitle:"מחיקת {name}",removeBody:"המשתמש יימחק ממערכת הבית, כל התפקידים שלו ב־Arx יבוטלו והכניסות הפתוחות שלו ייסגרו. אי אפשר לבטל את המחיקה. השבתה היא האפשרות הבטוחה יותר.",removeType:"להקליד את שם המשתמש {username} כדי לאשר",removeConfirm:"מחיקה לצמיתות",removed:"המשתמש נמחק."},He=Ge("en","i18n/ha-users","en");function Ms(){return Ne(["en"])}function w(e,s){const i=(Ms()==="en"?He[e]:void 0)??De[e]??e;return Te(i,s)}qe("i18n/ha-users",{he:De,en:He});const js=/^[a-z0-9][a-z0-9._-]{2,31}$/;function ye(e,s){return e.toLowerCase()===s.toLowerCase()}const Ds=["0123456789","9876543210","abcdefghijklmnopqrstuvwxyz","zyxwvutsrqponmlkjihgfedcba","qwertyuiopasdfghjklzxcvbnm"];function Hs(e,s,i,r=10,n=128){if(e.length<r)return"too_short";if(e.length>n)return"too_long";const o=e.toLowerCase();return new Set(o).size<=2?"repetitive":Ds.some(p=>p.includes(o)||(p+p).includes(o))?"sequence":s.length>=3&&o.includes(s.toLowerCase())?"contains_username":i.toLowerCase().split(/\s+/).some(p=>p.length>=3&&o.includes(p))?"contains_name":null}const de=(e="viewer")=>({display_name:"",username:"",password:"",password2:"",role_id:e,scope:"installation:*",create_person:!0});function _e(e,s=10,i=128){const r={};e.display_name.trim()||(r.display_name="e_name"),js.test(e.username)||(r.username="e_username");const n=Hs(e.password,e.username,e.display_name,s,i);return n?r.password=`pw_${n}`:e.password!==e.password2&&(r.password2="e_mismatch"),e.role_id||(r.role_id="e_role"),r}function Is(e,s,i){const r=s.actor_ha_admin&&!e.is_self&&i!=="not_authorised"&&i!=="not_configured";return{deactivate:r&&e.state==="active",activate:r&&e.state==="inactive",remove:r}}function Ts(e){return`st_${e.state}`}function Ns(e){return e.repair?`repair_${e.repair}`:null}function Gs(e){return`acc_${e}`}function qs(e){return e.actor_ha_admin&&e.users.length<e.limit&&e.access.state!=="not_authorised"&&e.access.state!=="not_configured"&&e.transport!=="none"}function ke(){const e=new Uint8Array(12);return globalThis.crypto.getRandomValues(e),Array.from(e,s=>s.toString(16).padStart(2,"0")).join("")}var Bs=Object.defineProperty,Ws=Object.getOwnPropertyDescriptor,R=(e,s,i,r)=>{for(var n=r>1?void 0:r?Ws(s,i):s,o=e.length-1,p;o>=0;o--)(p=e[o])&&(n=(r?p(s,i,n):p(n))||n);return r&&n&&Bs(s,i,n),n};let A=class extends B{constructor(){super(...arguments),this.bubbleSkin=new $e(this),this.view=null,this.loadState="loading",this.error="",this.okLine=new je(this,{ms:0}),this.busy=!1,this.checking=!1,this.createOpen=!1,this.draft=de(),this.touched=!1,this.formError="",this.confirm=null,this.removing=null,this.typed="",this.requestKey=""}get ok(){return this.okLine.text}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{this.view=await J.view(),this.loadState="ready"}catch(e){this.loadState=e instanceof te&&e.status===403?"forbidden":"error",this.error=f(e)}}flash(e){this.okLine.show(e),this.error=""}async runCheck(){if(this.view){this.checking=!0;try{const e=await J.check();this.view={...this.view,access:e.access,transport:e.transport}}catch(e){this.error=f(e)}finally{this.checking=!1}}}openCreate(){this.draft=de(this.view?.roles.some(e=>e.id==="viewer")?"viewer":this.view?.roles[0]?.id??""),this.touched=!1,this.formError="",this.requestKey=ke(),this.createOpen=!0}closeCreate(){this.createOpen=!1,this.draft=de()}async submitCreate(){if(!this.view)return;this.touched=!0;const e=_e(this.draft,this.view.password.min_length,this.view.password.max_length);if(Object.keys(e).length)return;const[s,...i]=this.draft.scope.split(":");this.busy=!0,this.formError="";try{const r=await J.create({display_name:this.draft.display_name.trim(),username:this.draft.username,password:this.draft.password,role_id:this.draft.role_id,scope_type:s,scope_id:i.join(":")||"*",create_person:this.draft.create_person,request_key:this.requestKey});this.closeCreate(),this.flash(w(r.user.repair==="person_missing"?"createdNoPerson":"created",{name:r.user.display_name})),await this.load()}catch(r){this.draft={...this.draft,password:"",password2:""},this.formError=f(r),r instanceof te&&r.code!=="password_weak"&&r.code!=="username_taken"&&r.code!=="validation"&&(this.requestKey=ke(),await this.load())}finally{this.busy=!1}}async submitConfirm(){const e=this.confirm;if(e){this.busy=!0;try{await J.setActive(e.user.ha_user_id,e.kind==="activate"),this.confirm=null,this.flash(w(e.kind==="activate"?"activated":"deactivated")),await this.load()}catch(s){this.confirm=null,this.error=f(s),await this.load()}finally{this.busy=!1}}}async submitRemove(){const e=this.removing;if(!(!e||!ye(this.typed,e.username))){this.busy=!0;try{await J.remove(e.ha_user_id,this.typed),this.removing=null,this.typed="",this.flash(w("removed")),await this.load()}catch(s){this.removing=null,this.typed="",this.error=f(s),await this.load()}finally{this.busy=!1}}}renderAccess(e){const s=e.access.state,i=s==="ok"?"tone-ok":s==="unknown"?"":s==="unavailable"?"tone-warn":"tone-err",r=s==="ok"?"check":s==="unknown"?"info":"warning";return a`<sw-card data-ha-access=${s}>
      <div class="head"><h3>${w("accessTitle")}</h3></div>
      <div class="access">
        <sw-icon class=${i} name=${r} size=${18}></sw-icon>
        <div class="text">
          <span class=${i} data-access-text>${w(Gs(s))}</span>
          ${s==="not_authorised"?a`<span class="fix" data-access-fix>${w("acc_not_authorised_fix")}</span>`:c}
          ${e.access.checked_at?a`<span class="meta">${w("checkedAt",{time:S(e.access.checked_at)})} · ${w(e.transport==="token"?"via_token":"via_supervisor")}</span>`:c}
        </div>
        <sw-button size="sm" icon="refresh" data-ha-check ?disabled=${this.checking||e.transport==="none"} @click=${()=>void this.runCheck()}>${this.checking?w("checking"):w("check")}</sw-button>
      </div>
      ${e.actor_ha_admin?c:a`<div class="msg warn" style="margin-block-start:var(--sw-s-2)" data-not-ha-admin><sw-icon name="lock" size=${13}></sw-icon>${w("notHaAdmin")}</div>`}
    </sw-card>`}renderRow(e,s){const i=Is(e,s,s.access.state),r=Ns(e);return a`<div class="item" data-ha-user=${e.username}>
      <span class="name"><span>${Be(e.display_name)}${e.is_self?a` <span class="chip">${w("you")}</span>`:c}</span>
        ${r?a`<span class="sub">${w(r)}</span>`:c}</span>
      <span class="user ltr">${e.username}</span>
      <span class="role">${e.role_name} · ${e.scope_name}</span>
      <span class=${`chip ${e.state}`} data-state=${e.state}>${w(Ts(e))}</span>
      <span class="row-actions">
        ${i.deactivate?a`<sw-button size="sm" variant="secondary" data-deactivate @click=${()=>this.confirm={user:e,kind:"deactivate"}}>${w("deactivate")}</sw-button>`:c}
        ${i.activate?a`<sw-button size="sm" variant="secondary" data-activate @click=${()=>this.confirm={user:e,kind:"activate"}}>${w("activate")}</sw-button>`:c}
        ${i.remove?a`<sw-button size="sm" variant="ghost" icon="trash" data-remove @click=${()=>{this.removing=e,this.typed=""}}>${w("remove")}</sw-button>`:c}
      </span>
    </div>`}renderList(e){return a`<sw-card data-ha-list>
      <div class="head">
        <h3>${w("listTitle")}</h3><span class="count">${w("count",{n:e.users.length,max:e.limit})}</span><span class="grow"></span>
        ${qs(e)?a`<sw-button variant="primary" size="sm" icon="plus" data-ha-add @click=${()=>this.openCreate()}>${w("add")}</sw-button>`:c}
      </div>
      ${e.users.length===0?a`<sw-state-panel icon="users" compact state="empty" heading=${w("empty")} hint=${w("emptyHint")}></sw-state-panel>`:a`<div class="list" role="list">
            <div class="item hdr" aria-hidden="true"><span>${w("colName")}</span><span>${w("colUser")}</span><span>${w("colRole")}</span><span>${w("colState")}</span><span></span></div>
            ${We(e.users,s=>s.ha_user_id,s=>this.renderRow(s,e))}
          </div>`}
    </sw-card>`}field(e,s){this.draft={...this.draft,[e]:s}}renderCreate(e){const s=this.touched?_e(this.draft,e.password.min_length,e.password.max_length):{},i=r=>s[r]?a`<span class="ferr" role="alert">${w(s[r])}</span>`:c;return a`<sw-dialog heading=${w("createTitle")} subheading=${w("createSub")} .open=${this.createOpen} data-ha-create @close=${()=>this.closeCreate()}>
      <form class="form" autocomplete="off" @submit=${r=>{r.preventDefault(),this.submitCreate()}}>
        <label>${w("fName")}<input class="in" maxlength="60" data-f-name aria-invalid=${String(!!s.display_name)} .value=${this.draft.display_name}
          @input=${r=>this.field("display_name",r.target.value)} />${i("display_name")}</label>
        <label>${w("fUsername")}<input class="in ltr" dir="ltr" maxlength="32" autocapitalize="off" spellcheck="false" data-f-username aria-invalid=${String(!!s.username)}
          .value=${this.draft.username} @input=${r=>this.field("username",r.target.value.trim().toLowerCase())} />
          <span class="hint">${w("fUsernameHint")}</span>${i("username")}</label>
        <label>${w("fPassword")}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${e.password.max_length} data-f-password
          aria-invalid=${String(!!s.password)} .value=${this.draft.password} @input=${r=>this.field("password",r.target.value)} />
          <span class="hint">${w("fPasswordHint",{min:e.password.min_length})}</span>${i("password")}</label>
        <label>${w("fPassword2")}<input class="in ltr" dir="ltr" type="password" autocomplete="new-password" maxlength=${e.password.max_length} data-f-password2
          aria-invalid=${String(!!s.password2)} .value=${this.draft.password2} @input=${r=>this.field("password2",r.target.value)} />${i("password2")}</label>
        <label>${w("fRole")}<sw-field><select class="in" data-f-role .value=${this.draft.role_id} @change=${r=>this.field("role_id",r.target.value)}>
          ${e.roles.map(r=>a`<option value=${r.id} ?selected=${r.id===this.draft.role_id}>${r.name}</option>`)}</select></sw-field>${i("role_id")}</label>
        ${e.scopes.length>1?a`<label>${w("fScope")}<sw-field><select class="in" data-f-scope .value=${this.draft.scope} @change=${r=>this.field("scope",r.target.value)}>
          ${e.scopes.map(r=>a`<option value=${`${r.type}:${r.id}`} ?selected=${`${r.type}:${r.id}`===this.draft.scope}>${r.name}</option>`)}</select></sw-field></label>`:c}
        <label class="check"><sw-toggle data-f-person .checked=${this.draft.create_person} @change=${r=>this.draft={...this.draft,create_person:r.target.checked}}></sw-toggle>${w("fPerson")}</label>
        ${this.formError?a`<span class="msg err" role="alert" data-form-error><sw-icon name="warning" size=${13}></sw-icon>${this.formError}</span>`:c}
      </form>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.closeCreate()}>${w("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-f-submit ?disabled=${this.busy} @click=${()=>void this.submitCreate()}>${w("create")}</sw-button>
    </sw-dialog>`}renderConfirm(){const e=this.confirm,s=e?.user.display_name??"";return a`<sw-dialog heading=${e?w(e.kind==="activate"?"activateTitle":"deactivateTitle",{name:s}):""} .open=${!!e} data-ha-confirm @close=${()=>this.confirm=null}>
      <p class="body">${e?w(e.kind==="activate"?"activateBody":"deactivateBody"):""}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.confirm=null}>${w("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-confirm-go ?disabled=${this.busy} @click=${()=>void this.submitConfirm()}>${w("confirm")}</sw-button>
    </sw-dialog>`}renderRemove(){const e=this.removing;return a`<sw-dialog heading=${e?w("removeTitle",{name:e.display_name}):""} .open=${!!e} data-ha-remove @close=${()=>{this.removing=null,this.typed=""}}>
      <div class="form">
        <p class="body">${w("removeBody")}</p>
        <label>${e?w("removeType",{username:e.username}):""}<input class="in ltr" dir="ltr" autocomplete="off" spellcheck="false" data-remove-typed .value=${this.typed}
          @input=${s=>this.typed=s.target.value} /></label>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.removing=null,this.typed=""}}>${w("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-remove-go ?disabled=${this.busy||!e||!ye(this.typed,e.username)} @click=${()=>void this.submitRemove()}>${w("removeConfirm")}</sw-button>
    </sw-dialog>`}render(){if(this.loadState==="loading")return a`<sw-state-panel state="loading"></sw-state-panel>`;if(this.loadState==="forbidden")return a`<sw-state-panel state="forbidden" heading=${w("forbidden")}></sw-state-panel>`;if(this.loadState==="error"||!this.view)return a`<sw-state-panel state="error" heading=${this.error} actionLabel=${w("retry")} @action=${()=>void this.load()}></sw-state-panel>`;const e=this.view;return a`<div class="stack" data-ha-users>
      <p class="body">${w("sub")}</p>
      ${this.ok||this.error?a`<div>${this.ok?a`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.ok}</span>`:c}${this.error?a`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:c}</div>`:c}
      ${this.renderAccess(e)}
      ${this.renderList(e)}
      ${this.renderCreate(e)}${this.renderConfirm()}${this.renderRemove()}
    </div>`}};A.styles=[Ue,Me,q`
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
    ${Ee}
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
    /* NATIVE-SELECT-A-2480: the select sits in sw-field; its block padding stays the browser's 0 (the field's 5 px would make it taller) */
    select.in { padding-block: 0; }
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
  `];R([h()],A.prototype,"view",2);R([h()],A.prototype,"loadState",2);R([h()],A.prototype,"error",2);R([h()],A.prototype,"busy",2);R([h()],A.prototype,"checking",2);R([h()],A.prototype,"createOpen",2);R([h()],A.prototype,"draft",2);R([h()],A.prototype,"touched",2);R([h()],A.prototype,"formError",2);R([h()],A.prototype,"confirm",2);R([h()],A.prototype,"removing",2);R([h()],A.prototype,"typed",2);A=R([W("sw-ha-users")],A);const Fs=(e,s)=>e.trim().toLocaleLowerCase()===s.trim().toLocaleLowerCase();function ie(e,s,i){const r=(e??"").trim(),n=(s??"").trim()||(i??"").trim();return n?r&&Fs(r,n)?"":n:""}var Ks=Object.defineProperty,Vs=Object.getOwnPropertyDescriptor,j=(e,s,i,r)=>{for(var n=r>1?void 0:r?Vs(s,i):s,o=e.length-1,p;o>=0;o--)(p=e[o])&&(n=(r?p(s,i,n):p(n))||n);return r&&n&&Ks(s,i,n),n};function ce(e,s=ys()){return s==="en"&&e.en||e.he}let P=class extends B{constructor(){super(...arguments),this.remote=!1,this.data=null,this.notShown=!1,this.error="",this.saved=!1,this.busy=!1,this.value="",this.runText="",this.runSaved=!1}connectedCallback(){super.connectedCallback(),this.remote||this.load()}async load(){try{const e=await D("/identity/service-identity");this.data=e,this.value=e.configured_user_id??"",this.runText=(e.runnable?.ids??[]).join(", "),this.error=""}catch(e){e instanceof te&&(e.status===403||e.status===404)?this.notShown=!0:this.error=f(e)}}async save(e=!1){this.busy=!0,this.error="",this.saved=!1;try{const s=await U("/identity/service-identity",{user_id:e?null:this.value.trim()||null});this.data=s,this.value=s.configured_user_id??"",this.saved=!0}catch(s){this.error=f(s)}finally{this.busy=!1}}async saveRunnable(){this.busy=!0,this.error="",this.runSaved=!1;try{const e=this.runText.split(/[\s,]+/).map(i=>i.trim()).filter(Boolean),s=await U("/identity/service-identity/runnable",{entity_ids:e});this.data=s,this.runText=(s.runnable?.ids??[]).join(", "),this.runSaved=!0}catch(e){this.error=f(e)}finally{this.busy=!1}}render(){if(this.remote)return a`<div class="note" data-si-remote>${l("siRemote")}</div>`;if(this.notShown)return c;const e=this.data;return a`<sw-card data-service-identity>
      <div class="body">
        <div class="head">
          <h3>${l("siTitle")}</h3>
          ${e?a`<sw-badge kind=${e.ready?"live":"partial"} label=${e.ready?l("siReady"):l("siNotReady")} data-si-state=${e.ready?"ready":"not-ready"}></sw-badge>`:c}
        </div>
        <p class="sub">${l("siSub")}</p>
        ${this.error?a`<div class="note err" role="alert" data-si-error>${this.error}</div>`:c}
        ${this.saved?a`<div class="note" role="status">${l("siSaved")}</div>`:c}
        ${e?a`
              ${e.user?a`<div class="facts" data-si-user>
                    <span>${l("siUser")}: <bdi>${e.user.name??""}</bdi> · <bdi class="id">${e.user.id}</bdi>${e.user.is_admin?a` · <strong>${l("siAdmin")}</strong>`:c}</span>
                    <span>${l("siBridge")}: <bdi>${e.bridge.version??"?"}</bdi> · ${e.bridge.agrees?l("siAgrees"):l("siDiffers")}</span>
                  </div>`:c}
              ${e.extended?a`<div class="note ${e.extended.requested?"warn":""}" data-si-extended=${e.extended.on?"on":e.extended.requested?"requested":"off"}>
                    ${e.extended.requested?l("siExtendedOn"):l("siExtendedOff")}
                    ${e.extended.doors_addon_only?a`<div data-si-doors-addon-only>${l("siDoorsAddonOnly")}</div>`:c}
                    <div data-si-policy-risk>${l("siPolicyRisk")}</div>
                  </div>`:c}
              ${e.steps.length?a`<div class="note warn" data-si-steps>
                    <div class="label">${l("siNeeded")}</div>
                    <ol>${e.steps.map(s=>a`<li data-si-step=${s.code}>${ce(s)}</li>`)}</ol>
                  </div>`:c}
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
                ${e.configured_user_id?a`<sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>this.save(!0)} data-si-clear>${l("siClear")}</sw-button>`:c}
              </div>
              ${e.runnable?a`<div class="runnable" data-si-runnable=${e.runnable.agrees?"agrees":"differs"}>
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
                    ${this.runSaved?a`<div class="note" role="status" data-si-run-saved>${l("siRunSaved")}</div>`:c}
                    <div class="facts">
                      <span data-si-run-bridge
                        >${l("siRunBridge")}:
                        ${e.runnable.bridge_ids.length?a`<bdi class="id">${e.runnable.bridge_ids.join(", ")}</bdi>`:l("siRunEmpty")}</span
                      >
                      <span>${e.runnable.agrees?l("siRunAgrees"):l("siRunDiffers")}</span>
                    </div>
                  </div>`:c}
              <div class="cols">
                <div>
                  <div class="label">${l("siAllowed")}</div>
                  <ul data-si-allowed>${e.allowed.map(s=>a`<li>${ce(s)}</li>`)}</ul>
                </div>
                <div>
                  <div class="label">${l("siRefused")}</div>
                  <ul data-si-refused>${e.refused.map(s=>a`<li>${ce(s)}</li>`)}</ul>
                </div>
              </div>
            `:a`<div class="sub">…</div>`}
      </div>
    </sw-card>`}};P.styles=q`
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
  `;j([ne({type:Boolean})],P.prototype,"remote",2);j([h()],P.prototype,"data",2);j([h()],P.prototype,"notShown",2);j([h()],P.prototype,"error",2);j([h()],P.prototype,"saved",2);j([h()],P.prototype,"busy",2);j([h()],P.prototype,"value",2);j([h()],P.prototype,"runText",2);j([h()],P.prototype,"runSaved",2);P=j([W("system-service-identity")],P);var Ys=Object.defineProperty,Js=Object.getOwnPropertyDescriptor,_=(e,s,i,r)=>{for(var n=r>1?void 0:r?Js(s,i):s,o=e.length-1,p;o>=0;o--)(p=e[o])&&(n=(r?p(s,i,n):p(n))||n);return r&&n&&Ys(s,i,n),n};const Z={password:"",again:"",must:!0},pe="display:flex;flex-direction:column;gap:2px;align-items:flex-start",he="color:var(--sw-text-3);font-size:var(--sw-fs-xs)",Zs="display:flex;flex-wrap:wrap;gap:4px",Qs=new Set(["rbac.assign","identity.directory.read","system.configure","identity.local.manage","rbac.roles.manage","sources.configure","audit.read","backup.manage","nvr.configure","system.update"]);function ee(e){return!!e&&e.permissions.some(s=>Qs.has(s))}function ve(e){return e.filter(s=>s.id!=="system_admin"&&!s.system_role)}function xe(e){return e.url??`https://<כתובת הגישה מרחוק>${e.path}`}function ze(e){return e?`⁦${e}⁩`:""}let b=class extends B{constructor(){super(...arguments),this.roles=[],this.scopes=[],this.data=null,this.error="",this.busy=!1,this.creating=!1,this.selected=null,this.link=null,this.copied=!1,this.suggest="",this.form={username:"",display_name:"",role_id:"viewer",scope:"installation:*",email:"",notes:"",reset_mode:"manager_only"},this.roleEdit=null,this.pwMode="set",this.pw={...Z},this.formError="",this.done="",this.pwEdit=null,this.pwError="",this.sent=null,this.publicUrl="",this.publicUrlNote="",this.pk=null,this.pkStepUp=!1,this.pkCode="",this.switching=null,this.switched="",this.narrow=!1,this.narrowMq=null,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.pkRequested=null}connectedCallback(){super.connectedCallback(),this.narrowMq=window.matchMedia("(max-width: 767px)"),this.narrowMq.addEventListener("change",this.onNarrow),this.onNarrow(),this.load()}disconnectedCallback(){this.narrowMq?.removeEventListener("change",this.onNarrow),super.disconnectedCallback()}async load(){try{this.data=await D("/identity/local-users"),this.publicUrl||(this.publicUrl=this.data.public_url??""),this.error=""}catch(e){this.error=f(e)}}async run(e){this.busy=!0,this.error="";try{await e()}catch(s){this.error=f(s)}finally{this.busy=!1}}get remote(){return this.data?.channel==="remote"}roleOf(e){return this.roles.find(s=>s.id===e)}scopeParts(e){const s=e.indexOf(":");return{scope_type:e.slice(0,s),scope_id:e.slice(s+1)}}closeCreate(){this.creating=!1,this.formError="",this.pw={...Z,must:this.pw.must}}get pwMin(){return this.data?.password_min??12}pwProblem(e){return!e.password||!e.again?l("pwMissing"):e.password!==e.again?l("mismatch"):[...e.password].length<this.pwMin?l("pwTooShort",{min:this.pwMin}):""}async create(e){if(e.preventDefault(),this.busy)return;const s=this.form;if(this.remote&&ee(this.roleOf(s.role_id)))return;const i=this.pwMode==="set",r=this.pw;if(this.formError=!s.username.trim()||!s.display_name.trim()?l("fillUsernameName"):i?this.pwProblem(r):"",!this.formError){this.busy=!0,this.error="";try{const n=await H("/identity/local-users",{username:s.username.trim(),display_name:s.display_name.trim(),role_id:s.role_id,...this.scopeParts(s.scope),email:s.email.trim()||null,notes:s.notes.trim()||null,reset_mode:s.reset_mode,...i?{password:r.password,must_change:r.must}:{}});this.link=n.link?{...n.link,user:n.user.display_name}:null,this.done=n.link?"":l(n.user.must_change_password?"createdWithPwChange":"createdWithPw",{name:n.user.display_name,username:n.user.username}),this.copied=!1,this.creating=!1,this.form={...this.form,username:"",display_name:"",email:"",notes:""},this.pw={...Z,must:r.must},await this.load()}catch(n){this.formError=f(n)}finally{this.busy=!1}}}async savePassword(e,s){s?.preventDefault();const i=this.pwEdit;if(!(!i||this.busy)&&(this.pwError=this.pwProblem(i),!this.pwError)){this.busy=!0,this.error="";try{await U(`/identity/local-users/${encodeURIComponent(e.id)}/password`,{password:i.password,must_change:i.must}),this.pwEdit=null,this.link=null,this.done=l(i.must?"pwSetDoneChange":"pwSetDone",{name:e.display_name}),await this.load()}catch(r){this.pwError=f(r)}finally{this.busy=!1}}}renderPwFields(e,s,i){const r=n=>o=>s({...e,[n]:o.target.value});return a`<label>${l("pwField")}<sw-field><input class="ltr" type="password" autocomplete="new-password" maxlength="128" .value=${e.password} @input=${r("password")} data-local-pw=${i} /></sw-field>
        <span class="muted">${l("pwHint",{min:this.pwMin})}</span></label>
      <label>${l("pwAgain")}<sw-field><input class="ltr" type="password" autocomplete="new-password" maxlength="128" .value=${e.again} @input=${r("again")} data-local-pw-again=${i} /></sw-field></label>
      <label class="full check"><sw-toggle size="sm" labelHidden in-label label=${l(i==="user"?"pwMustChangeNext":"pwMustChange")} .checked=${e.must} @change=${n=>s({...e,must:ae(n)})} data-local-pw-must=${i}></sw-toggle>
        ${l(i==="user"?"pwMustChangeNext":"pwMustChange")}</label>
      <div class="muted full">${l("pwMustChangeHelp")}</div>`}issue(e,s,i=!1){this.run(async()=>{const r=await H(`/identity/local-users/${encodeURIComponent(e.id)}/link`,{purpose:s,via:"shown",temporary:i});this.link={...r.link,user:e.display_name},this.sent=null,this.copied=!1,await this.load()})}issueWhatsapp(e,s){this.run(async()=>{const i=await H(`/identity/local-users/${encodeURIComponent(e.id)}/link`,{purpose:s,via:"whatsapp"});this.link=null,this.sent={user:e.display_name,to:e.whatsapp?.masked??"",expires_at:i.link.expires_at},await this.load()})}savePublicUrl(){this.run(async()=>{await K("/settings",{"security.local_public_url":this.publicUrl.trim()}),this.publicUrlNote=l("publicUrlSaved"),this.publicUrl="",await this.load()})}applySwitch(){const e=this.switching;e&&(this.switched="",this.run(async()=>{try{await K("/settings",{"security.local_identity":e})}finally{this.switching=null}this.creating=!1,this.selected=null,this.roleEdit=null,this.pwEdit=null,this.pw={...Z},this.done="",this.link=null,this.sent=null,this.switched=l(e==="on"?"switchedOn":"switchedOff"),await this.load()}))}renderSwitchDialog(){const e=this.switching;return e?a`<sw-dialog open heading=${l(e==="on"?"switchOn":"switchOff")} ?locked=${this.busy} data-local-switch-dialog=${e} @close=${()=>this.switching=null}>
      <div class="sub" data-local-switch-body>${l(e==="on"?"switchOnBody":"switchOffBody")}</div>
      <sw-button slot="footer" variant="ghost" ?disabled=${this.busy} @click=${()=>this.switching=null}>${l("cancel")}</sw-button>
      <sw-button slot="footer" variant=${e==="on"?"primary":"danger"} ?disabled=${this.busy} @click=${()=>this.applySwitch()} data-local-switch-confirm>${l(e==="on"?"switchOn":"switchOff")}</sw-button>
    </sw-dialog>`:c}async copy(){if(this.link)try{await navigator.clipboard.writeText(xe(this.link)),this.copied=!0}catch{this.copied=!1}}setActive(e,s){this.run(async()=>{const i=await K(`/identity/local-users/${encodeURIComponent(e.id)}`,{active:s});this.suggest=i.suggest_also?l("suggestAlso"):"",await this.load()})}setResetMode(e,s){this.run(async()=>{await K(`/identity/local-users/${encodeURIComponent(e.id)}`,{reset_mode:s}),await this.load()})}async removeUser(e){await le({body:l("removeConfirm",{name:e.display_name}),danger:!0})&&this.run(async()=>{await Fe(`/identity/local-users/${encodeURIComponent(e.id)}`),this.selected=null,await this.load()})}simple(e,s){this.run(async()=>{await H(`/identity/local-users/${encodeURIComponent(e.id)}/${s}`),await this.load()})}async loadPasskeys(e){try{const s=await _s(e);this.selected===e&&(this.pk={userId:e,items:s.credentials})}catch{this.pk=null}}async removePasskey(e,s){await le({body:l("passkeyAdminRemoveConfirm"),danger:!0})&&this.run(async()=>{try{await ks(e.id,s,this.pkStepUp?this.pkCode.trim():void 0)}catch(i){throw i instanceof te&&i.body.code==="second_factor_step_up_required"&&(this.pkStepUp=!0),i}this.pkCode="",await this.load(),await this.loadPasskeys(e.id)})}passkeyFirstOff(e){this.run(async()=>{await K(`/identity/local-users/${encodeURIComponent(e.id)}`,{passkey_first:!1}),await this.load()})}async passkeyOnly(e,s){await le({body:Y(s?"onlyConfirmOn":"onlyConfirmOff"),danger:s})&&this.run(async()=>{await xs(e.id,s),await this.load()})}setPasskeyFirstAllowed(e){this.run(async()=>{await K("/settings",{"security.local_passkey_first":e?"on":"off"}),await this.load()})}renderPasskeys(e,s){this.pkRequested!==e.id&&(this.pkRequested=e.id,Promise.resolve().then(()=>(this.pkStepUp=!1,this.loadPasskeys(e.id))));const i=this.pk?.userId===e.id?this.pk.items:[];return a`<div class="full cell" data-local-passkeys>
      <span class="muted">${l("passkeysCount",{n:e.passkeys??i.length})}${e.passkey_first?a` · ${l("passkeyFirstOn")}`:c}${e.passkey_only?a` · ${Y("onlyOn")}`:c}</span>
      ${i.map(r=>a`<span class="muted" data-local-passkey=${r.id}>${r.label||l("passkeys")} · ${S(r.created_at)}${r.synced?a` · ${l("passkeySynced")}`:c}${r.usable?c:a` · ${l("passkeyNotUsable")}`}
        ${s?a`<sw-button size="sm" variant="ghost" @click=${()=>this.removePasskey(e,r.id)} ?disabled=${this.busy} data-local-passkey-remove>${l("passkeyAdminRemove")}</sw-button>`:c}</span>`)}
      ${s&&this.pkStepUp?a`<label>${l("code")}<sw-field><input class="ltr" inputmode="numeric" autocomplete="one-time-code" maxlength="6" .value=${this.pkCode}
            @input=${r=>this.pkCode=r.target.value.replace(/\D/g,"").slice(0,6)} data-local-passkey-code /></sw-field></label>`:c}
      ${s&&(e.passkey_only||this.data?.passkey_first_allowed&&(e.passkeys??i.length)>0)?a`<div class="actions"><sw-button @click=${()=>this.passkeyOnly(e,!e.passkey_only)} ?disabled=${this.busy} data-local-passkey-only>${e.passkey_only?Y("onlyDisable"):Y("onlyEnable")} · ${Y("onlyLabel")}</sw-button></div>`:c}
      ${s&&e.passkey_first&&!e.passkey_only?a`<div class="actions"><sw-button @click=${()=>this.passkeyFirstOff(e)} ?disabled=${this.busy} data-local-passkey-first-off>${l("passkeyFirstAdminOff")}</sw-button></div>`:c}
    </div>`}saveRole(e){const s=this.roleEdit;s&&this.run(async()=>{await U(`/identity/local-users/${encodeURIComponent(e.id)}/role`,{role_id:s.role_id,...this.scopeParts(s.scope)}),this.roleEdit=null,await this.load()})}statusBadge(e){const s=e.status==="active"?"live":e.status==="delayed"?"stale":e.status==="pending_first_login"?"neutral":"offline";return a`<sw-badge kind=${s} label=${l(`status_${e.status}`)}></sw-badge>`}renderCreate(){const e=this.form,s=ve(this.roles),i=ee(this.roleOf(e.role_id)),r=n=>o=>this.form={...this.form,[n]:o.target.value};return a`<sw-card flush data-local-create>
      <form @submit=${this.create} novalidate>
        <div class="head"><div class="cell"><strong>${l("add")}</strong></div>
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${l("cancel")} @click=${()=>this.closeCreate()}></sw-button></div>
        <label>${l("colUsername")}<sw-field><input class="ltr" .value=${e.username} @input=${r("username")} autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="32" required data-local-username /></sw-field>
          <span class="muted">${l("usernameHint")}</span></label>
        <label>${l("displayName")}<sw-field><input .value=${e.display_name} @input=${r("display_name")} maxlength="60" required data-local-display /></sw-field></label>
        <label>${l("role")}<sw-field><select .value=${e.role_id} @change=${r("role_id")} data-local-role>
          ${s.map(n=>a`<option value=${n.id} ?selected=${n.id===e.role_id} ?disabled=${this.remote&&ee(n)}>${n.name}</option>`)}
        </select></sw-field></label>
        <label>${l("scope")}<sw-field><select .value=${e.scope} @change=${r("scope")}>
          ${this.scopes.map(n=>a`<option value=${`${n.type}:${n.id}`} ?selected=${`${n.type}:${n.id}`===e.scope}>${n.name}</option>`)}
        </select></sw-field></label>
        <label>${l("email")}<sw-field><input class="ltr" type="email" .value=${e.email} @input=${r("email")} maxlength="254" /></sw-field></label>
        <label>${l("notes")}<sw-field><input .value=${e.notes} @input=${r("notes")} maxlength="200" /></sw-field></label>
        <label>${l("resetMode")}<sw-field><select .value=${i?"manager_only":e.reset_mode} @change=${r("reset_mode")} ?disabled=${i} data-local-reset-mode>
          <option value="manager_only">${l("reset_manager_only")}</option>
          <option value="self_service">${l("reset_self_service")}</option>
        </select></sw-field></label>
        ${i?a`<div class="note warn full" data-local-admin-note>${l("adminNote")} ${l("resetAdminNote")}</div>`:c}
        <div class="sep" role="presentation"></div>
        <label class="full">${l("pwHow")}<sw-field><select .value=${this.pwMode} @change=${n=>{this.pwMode=n.target.value==="link"?"link":"set",this.formError=""}} data-local-pw-mode>
          <option value="set" ?selected=${this.pwMode==="set"}>${l("pwHowSet")}</option>
          <option value="link" ?selected=${this.pwMode==="link"}>${l("pwHowLink")}</option>
        </select></sw-field></label>
        ${this.pwMode==="set"?this.renderPwFields(this.pw,n=>this.pw=n,"create"):a`<div class="muted full" data-local-pw-link-help>${l("pwLinkHelp")}</div>`}
        ${this.formError?a`<div class="note err full" role="alert" data-local-create-error>${this.formError}</div>`:c}
        <div class="actions">
          <sw-button variant="primary" type="submit" ?disabled=${this.busy||i&&this.remote} data-local-create-save>${l("create")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.closeCreate()}>${l("cancel")}</sw-button>
        </div>
        <!-- Enter in a field submits: the visible button sits in sw-button's shadow root, so the form needs a submit button of its own -->
        <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
      </form>
    </sw-card>`}renderLink(){const e=this.link;return e?a`<sw-card flush data-local-link>
      <div class="panel">
        <div class="full"><strong>${e.purpose==="reset"?l("linkResetTitle"):l("linkTitle")} · ${e.user}</strong></div>
        <div class="note full">${l("linkOnce",{until:S(e.expires_at)})}</div>
        <div class="link full" data-local-link-text>${xe(e)}</div>
        <div class="actions">
          <sw-button variant="primary" icon="link" @click=${()=>void this.copy()}>${this.copied?l("copied"):l("copy")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.link=null}>${l("close")}</sw-button>
        </div>
      </div>
    </sw-card>`:c}renderSent(){const e=this.sent;return e?a`<div class="note" role="status" data-local-link-sent>${e.user} · ${l("waSent",{to:ze(e.to),until:S(e.expires_at)})}
      <sw-button variant="ghost" @click=${()=>this.sent=null}>${l("close")}</sw-button></div>`:c}renderWhatsapp(e){const s=this.data?.whatsapp_ready??!1,i=!!e.whatsapp?.verified,r=e.status==="pending_first_login"?"first_login":"reset";return e.admin?a`<div class="muted full" data-local-wa-admin>${l("waAdminNote")}</div>`:a`<div class="full cell" data-local-wa>
      <span class="muted" data-local-wa-state>${i?l("waVerified",{masked:ze(e.whatsapp?.masked??"")}):l("waNone")}</span>
      ${s?c:a`<span class="muted" data-local-wa-off>${l("waChannelOff")}</span>`}
      ${s&&i?a`<div class="actions"><sw-button @click=${()=>this.issueWhatsapp(e,r)} ?disabled=${this.busy||!e.active} data-local-issue-wa=${r}>
            ${r==="first_login"?l("issueFirstWa"):l("issueResetWa")}</sw-button></div>`:c}
    </div>`}renderSelected(e){const s=this.data?.can_manage??!1,i=e.admin&&this.remote,r=ve(this.roles),n=this.roleEdit;return a`<sw-card flush data-local-user=${e.id}>
      <div class="panel">
        <div class="head">
          <div class="cell">
            <strong>${e.display_name}</strong>
            <span class="muted">${ie(e.display_name,e.username)?a`<bdi>${e.username}</bdi> · `:c}${e.role_name??"—"} · ${e.scope_name??"—"} · ${l("sessions")}: ${e.sessions}</span>
            <span class="muted" data-local-user-meta>${l("colLast")}: ${e.last_sign_in_at?S(e.last_sign_in_at):l("never")} · ${l("colFactor")}: ${e.second_factor?l("factorOn"):l("factorOff")}</span>
            ${e.admin?a`<span class="muted">${l("adminNote")}</span>`:c}
          </div>
          ${this.statusBadge(e)}
          <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${l("close")} data-local-user-close @click=${()=>{this.selected=null,this.roleEdit=null,this.pwEdit=null}}></sw-button>
        </div>
        ${s?a`<div class="actions">
              ${i?a`<span class="muted" data-local-only>${l("localOnly")}</span>`:e.status==="pending_first_login"?a`<sw-button @click=${()=>this.issue(e,"first_login")} ?disabled=${this.busy||!e.active} data-local-issue="first_login">${l("issueFirst")}</sw-button>`:a`<sw-button @click=${()=>this.issue(e,"reset")} ?disabled=${this.busy||!e.active} data-local-issue="reset">${l("issueReset")}</sw-button>
                    <sw-button variant="ghost" @click=${()=>this.issue(e,"reset",!0)} ?disabled=${this.busy||!e.active}>${l("temporary")}</sw-button>`}
              ${e.status==="delayed"?a`<sw-button @click=${()=>this.simple(e,"unlock")} ?disabled=${this.busy}>${l("unlock")}</sw-button>`:c}
              ${i?c:a`<sw-button @click=${()=>{this.pwEdit=this.pwEdit?null:{...Z},this.pwError=""}} ?disabled=${this.busy||!e.active} data-local-pw-set>${l("pwSet")}</sw-button>`}
              <sw-button @click=${()=>this.simple(e,"sessions/revoke")} ?disabled=${this.busy||!e.sessions}>${l("endSessions")}</sw-button>
              <sw-button @click=${()=>this.setActive(e,!e.active)} ?disabled=${this.busy}>${e.active?l("disable"):l("enable")}</sw-button>
              <sw-button @click=${()=>this.roleEdit={role_id:e.role_id??"viewer",scope:`${e.scope_type??"installation"}:${e.scope_id??"*"}`}} ?disabled=${this.busy}>${l("changeRole")}</sw-button>
              <sw-button class="end" variant="danger" @click=${()=>this.removeUser(e)} ?disabled=${this.busy}>${l("remove")}</sw-button>
            </div>
            ${this.pwEdit&&!i?a`<form class="full pwform" @submit=${o=>void this.savePassword(e,o)} novalidate data-local-pw-form>
                  <div class="full"><strong>${l("pwSetTitle",{name:e.display_name})}</strong></div>
                  <div class="muted full">${l("pwSetHelp")}</div>
                  ${this.renderPwFields(this.pwEdit,o=>this.pwEdit=o,"user")}
                  ${this.pwError?a`<div class="note err full" role="alert" data-local-pw-error>${this.pwError}</div>`:c}
                  <div class="actions">
                    <sw-button variant="primary" type="submit" ?disabled=${this.busy} data-local-pw-save>${l("pwSet")}</sw-button>
                    <sw-button variant="ghost" @click=${()=>this.pwEdit=null}>${l("cancel")}</sw-button>
                  </div>
                  <button type="submit" hidden tabindex="-1" aria-hidden="true"></button>
                </form>`:c}
            <div class="sep" role="presentation"></div>
            <label>${l("resetMode")}<sw-field><select .value=${e.reset_mode} ?disabled=${this.busy||e.admin} @change=${o=>this.setResetMode(e,o.target.value)}>
              <option value="manager_only">${l("reset_manager_only")}</option>
              <option value="self_service">${l("reset_self_service")}</option>
            </select></sw-field></label>
            ${e.admin?a`<div class="muted full" data-local-reset-admin>${l("resetAdminNote")}</div>`:e.self_service_blocked?a`<div class="note warn full" data-local-reset-blocked=${e.self_service_blocked}>${l(`blocked_${e.self_service_blocked}`)}</div>`:a`<div class="muted full">${l("resetModeHelp")}</div>`}
            ${this.renderWhatsapp(e)}
            ${this.renderPasskeys(e,s)}
            ${n?a`<label>${l("role")}<sw-field><select .value=${n.role_id} @change=${o=>this.roleEdit={...n,role_id:o.target.value}}>
                    ${r.map(o=>a`<option value=${o.id} ?selected=${o.id===n.role_id} ?disabled=${this.remote&&ee(o)}>${o.name}</option>`)}
                  </select></sw-field></label>
                  <label>${l("scope")}<sw-field><select .value=${n.scope} @change=${o=>this.roleEdit={...n,scope:o.target.value}}>
                    ${this.scopes.map(o=>a`<option value=${`${o.type}:${o.id}`} ?selected=${`${o.type}:${o.id}`===n.scope}>${o.name}</option>`)}
                  </select></sw-field></label>
                  <div class="actions"><sw-button variant="primary" @click=${()=>this.saveRole(e)} ?disabled=${this.busy}>${l("save")}</sw-button><sw-button variant="ghost" @click=${()=>this.roleEdit=null}>${l("cancel")}</sw-button></div>`:c}`:c}
      </div>
    </sw-card>`}renderPublicUrl(e){return a`<sw-card flush data-local-public-url>
      <div class="panel">
        <label class="full">${l("publicUrl")}
          <sw-field><input class="ltr" type="url" inputmode="url" placeholder=${e.public_url??"https://"} .value=${this.publicUrl}
            @input=${s=>this.publicUrl=s.target.value} maxlength="300" data-local-public-url-input /></sw-field></label>
        <div class="muted full">${l("publicUrlHint")}</div>
        ${this.publicUrlNote?a`<div class="note full" role="status">${this.publicUrlNote}</div>`:c}
        <div class="actions"><sw-button @click=${()=>this.savePublicUrl()} ?disabled=${this.busy} data-local-public-url-save>${l("publicUrlSave")}</sw-button></div>
        <label class="full check"><sw-toggle size="sm" labelHidden in-label label=${l("passkeySettingFirst")} .checked=${!!e.passkey_first_allowed} ?disabled=${this.busy}
            @change=${s=>this.setPasskeyFirstAllowed(ae(s))} data-local-passkey-first-allowed></sw-toggle>
          ${l("passkeySettingFirst")}</label>
        <div class="muted full">${l("passkeySettingHelp")}</div>
      </div>
    </sw-card>`}render(){const e=this.data;if(!e)return a`<div class="stack">${this.error?a`<sw-state-panel state="error" compact hint=${this.error} actionLabel="נסה שוב" data-local-load-error @action=${()=>void this.load()}></sw-state-panel>`:a`<sw-state-panel state="loading" compact data-local-loading></sw-state-panel>`}</div>`;const s=o=>o,i=[{key:"name",label:l("colName"),render:o=>a`<span style=${pe}><span>${s(o).display_name}</span>${ie(s(o).display_name,s(o).username)?a`<span style=${he}><bdi>${s(o).username}</bdi></span>`:c}</span>`},{key:"role",label:l("colRole"),render:o=>a`<span style=${pe}><span>${s(o).role_name??"—"}</span><span style=${he}>${s(o).scope_name??""}</span>
          <span style=${Zs}>${s(o).admin?a`<sw-badge kind="partial" label=${l("adminBadge")}></sw-badge>`:c}${s(o).ha_user_id?a`<sw-badge kind="neutral" label=${l("haBadge")}></sw-badge>`:c}</span></span>`},{key:"status",label:l("colStatus"),render:o=>this.statusBadge(s(o))},{key:"last",label:l("colLast"),render:o=>s(o).last_sign_in_at?S(s(o).last_sign_in_at):l("never")},{key:"factor",label:l("colFactor"),render:o=>a`<span style=${pe}><span>${s(o).second_factor?l("factorOn"):l("factorOff")}</span>${s(o).passkeys?a`<span style=${he}>${l("passkeysCount",{n:s(o).passkeys??0})}</span>`:c}</span>`}],r=this.narrow?i.filter(o=>o.key!=="last"&&o.key!=="factor"):i,n=e.users.find(o=>o.id===this.selected)??null;return a`<div class="stack" data-local-users>
      <div class="bar">
        <div class="sub">${l("tabSub")}</div>
        ${e.can_manage&&e.enabled?a`<div class="actions">
              <sw-button variant="primary" icon="plus" @click=${()=>{this.creating=!this.creating,this.formError="",this.done=""}} data-local-add>${l("add")}</sw-button>
              <sw-button variant="ghost" @click=${()=>window.open(Re("/identity/local-users/export"),"_blank","noopener")}>${l("export")}</sw-button>
            </div>`:c}
      </div>
      ${e.enabled?c:a`<div class="note warn" data-local-off>${l("off")}${e.can_switch?a`<div class="actions"><sw-button variant="primary" @click=${()=>this.switching="on"} ?disabled=${this.busy} data-local-switch="on">${l("switchOn")}</sw-button></div>`:a` <span data-local-switch-readonly>${l("offNotAdmin")}</span>`}</div>`}
      ${this.switched?a`<div class="note" role="status" data-local-switched>${this.switched}</div>`:c}
      ${this.done?a`<div class="note" role="status" data-local-done>${this.done}
          <sw-button variant="ghost" size="sm" @click=${()=>this.done=""}>${l("close")}</sw-button></div>`:c}
      ${e.can_manage?a`<system-service-identity ?remote=${this.remote}></system-service-identity>`:c}
      ${this.error?a`<div class="note err" role="alert" data-local-error>${this.error}</div>`:c}
      ${this.suggest?a`<div class="note warn" role="status">${this.suggest}</div>`:c}
      ${this.renderLink()}
      ${this.renderSent()}
      ${this.creating&&e.enabled?this.renderCreate():c}
      ${e.users.length?a`<sw-table .columns=${r} .rows=${e.users} rowKey="id" .selected=${this.selected}
            @row-select=${o=>{this.selected=o.detail.id,this.roleEdit=null,this.pwEdit=null,this.pwError=""}}></sw-table>`:a`<sw-state-panel icon="users" state="empty" compact hint=${l("empty")} data-local-empty></sw-state-panel>`}
      ${n?this.renderSelected(n):c}
      ${e.can_manage&&e.enabled?this.renderPublicUrl(e):c}
      ${e.enabled&&e.can_switch?a`<div class="bar" data-local-on>
            <div class="sub">${l("onState")}</div>
            <sw-button variant="danger" @click=${()=>this.switching="off"} ?disabled=${this.busy} data-local-switch="off">${l("switchOff")}</sw-button>
          </div>`:c}
      ${this.renderSwitchDialog()}
    </div>`}};b.styles=q`
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
    /* CR-CMP2-SEGMENTED-B-2450 (owner N10): every text field and select of the page sits in sw-field (the shared field look, one look
       for the whole form); the LTR fields keep their direction */
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
    label.check input:focus-visible {
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
    /* CR-LOCAL-USER-CREATE-2438: the set-password panel inside the selected user's card (the card's own grid, no second padding) */
    form.pwform {
      padding: 0;
    }
    label .muted {
      font-weight: var(--sw-fw-regular, 400);
    }
    /* CR-LOCAL-ID-SWITCH-2442: the switch button under the off-state text */
    .note .actions {
      margin-block-start: 10px;
    }
  `;_([ne({attribute:!1})],b.prototype,"roles",2);_([ne({attribute:!1})],b.prototype,"scopes",2);_([h()],b.prototype,"data",2);_([h()],b.prototype,"error",2);_([h()],b.prototype,"busy",2);_([h()],b.prototype,"creating",2);_([h()],b.prototype,"selected",2);_([h()],b.prototype,"link",2);_([h()],b.prototype,"copied",2);_([h()],b.prototype,"suggest",2);_([h()],b.prototype,"form",2);_([h()],b.prototype,"roleEdit",2);_([h()],b.prototype,"pwMode",2);_([h()],b.prototype,"pw",2);_([h()],b.prototype,"formError",2);_([h()],b.prototype,"done",2);_([h()],b.prototype,"pwEdit",2);_([h()],b.prototype,"pwError",2);_([h()],b.prototype,"sent",2);_([h()],b.prototype,"publicUrl",2);_([h()],b.prototype,"publicUrlNote",2);_([h()],b.prototype,"pk",2);_([h()],b.prototype,"pkStepUp",2);_([h()],b.prototype,"pkCode",2);_([h()],b.prototype,"switching",2);_([h()],b.prototype,"switched",2);_([h()],b.prototype,"narrow",2);b=_([W("system-local-users")],b);const Xs=()=>D("access/capture-lease/settings"),et=(e,s)=>U("access/capture-lease/settings",{lookup_scope:e,...s?{lookup_scope_confirm:s}:{}});var st=Object.defineProperty,tt=Object.getOwnPropertyDescriptor,T=(e,s,i,r)=>{for(var n=r>1?void 0:r?tt(s,i):s,o=e.length-1,p;o>=0;o--)(p=e[o])&&(n=(r?p(s,i,n):p(n))||n);return r&&n&&st(s,i,n),n};const Se={holder:G("מי שמחזיק כעת בהרשאה לפעולה המקורית (ברירת מחדל)"),holder_or_audit_readers:G("גם מחזיקי הרשאת צפייה באודיט")};let M=class extends B{constructor(){super(...arguments),this.value=null,this.pending=null,this.word="",this.notAllowed=!1,this.busy=!1,this.error="",this.saved=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=await Xs();this.value=e.lookup_scope,this.pending=e.lookup_scope}catch(e){const s=e.status;s===403||s===404?this.notAllowed=!0:this.error=f(e)}}async save(){if(!(!this.pending||this.pending===this.value)){this.busy=!0,this.error="",this.saved=!1;try{const e=await et(this.pending,this.pending==="holder_or_audit_readers"?this.word.trim():void 0);this.value=e.lookup_scope,this.pending=e.lookup_scope,this.word="",this.saved=!0}catch(e){this.error=f(e)}finally{this.busy=!1}}}render(){if(this.notAllowed)return c;if(this.value===null)return this.error?a`<p class="err" role="alert">${this.error}</p>`:c;const e=this.pending==="holder_or_audit_readers"&&this.value!=="holder_or_audit_readers";return a`<sw-card heading=${G("בירור מצב פעולה ישנה")} data-lookup-scope>
      <div class="row">
        <sw-field label=${G("מי רשאי לברר מצב של פעולת אינטרקום ישנה")}>
          <select data-lookup-scope-select .value=${we(this.pending??"holder")} ?disabled=${this.busy}
            @change=${s=>{this.pending=s.target.value,this.saved=!1}}>
            ${Object.keys(Se).map(s=>a`<option value=${s} ?selected=${s===this.pending}>${Se[s]}</option>`)}
          </select>
        </sw-field>
        ${e?a`<sw-field label=${G('לאישור ההרחבה הקלידו "{word}"',{word:zs("capture_lookup_wide")})}>
              <input data-lookup-scope-word .value=${we(this.word)} ?disabled=${this.busy} @input=${s=>this.word=s.target.value} />
            </sw-field>`:c}
        <sw-button variant="primary" data-lookup-scope-save ?disabled=${this.busy||this.pending===this.value||e&&!Ss("capture_lookup_wide",this.word)}
          @click=${()=>void this.save()}>${G("שמירה")}</sw-button>
      </div>
      ${this.error?a`<p class="err" role="alert">${this.error}</p>`:c}
      ${this.saved?a`<p class="ok" role="status">${G("נשמר")}</p>`:c}
    </sw-card>`}};M.styles=q`
    :host { display: block; margin-block-end: var(--sw-space-4, 16px); }
    .row { display: flex; flex-wrap: wrap; gap: var(--sw-space-3, 12px); align-items: end; }
    select, input { min-width: 16rem; max-width: 100%; }
    .err { color: var(--sw-danger); }
    .ok { color: var(--sw-success); }
  `;T([h()],M.prototype,"value",2);T([h()],M.prototype,"pending",2);T([h()],M.prototype,"word",2);T([h()],M.prototype,"notAllowed",2);T([h()],M.prototype,"busy",2);T([h()],M.prototype,"error",2);T([h()],M.prototype,"saved",2);M=T([W("sw-lookup-scope")],M);var at=Object.defineProperty,it=Object.getOwnPropertyDescriptor,Ie=(e,s,i,r)=>{for(var n=r>1?void 0:r?it(s,i):s,o=e.length-1,p;o>=0;o--)(p=e[o])&&(n=(r?p(s,i,n):p(n))||n);return r&&n&&at(s,i,n),n};let re=class extends B{constructor(){super(...arguments),this.bubbleSkin=new $e(this),this.roles=null}rows(){const e=new Set(this.roles?.sensitive??[]),s=i=>this.roles?.labels[i]??Pe(i)??i;return[...Ke.map(i=>({id:i,label:s(i),tag:i==="energy.bills"&&(e.has(i)||!this.roles?.sensitive)?"sensitive":""})),{id:"system.configure",label:O("הגדרות שמירת נתונים"),tag:"existing"}]}holds(e,s){return e.permissions.includes(s)||e.sensitive_included.includes(s)}chip(e){return e==="sensitive"?a`<span class="chip c-warn nodot">${O("רגישה")}</span>`:e==="existing"?a`<span class="chip nodot">${O("קיימת")}</span>`:c}columns(e){return[{key:"label",label:O("הרשאה"),render:s=>a`<b>${s.label}</b> ${this.cellChip(s.tag)}<span class="t2" part="code">${s.id}</span>`},...e.roles.map(s=>({key:`role-${s.id}`,label:s.name,align:"center",cellAttrs:()=>({"data-role":s.id}),render:i=>this.holds(s,i.id)?a`<span class="tick on" part="tick tick-on" aria-label=${O("יש")}>✓</span>`:a`<span class="tick" part="tick" aria-label=${O("אין")}></span>`}))]}cellChip(e){return e==="sensitive"?a`<span class="chip" data-tone="warn" data-nodot>${O("רגישה")}</span>`:e==="existing"?a`<span class="chip" data-nodot>${O("קיימת")}</span>`:c}render(){const e=this.roles;if(!e?.roles.length)return c;const s=this.rows();return a`<section data-energy-permissions aria-label=${O("הרשאות חשמל")}>
      <h3>${O("חשמל")}</h3>
      <sw-table class="t card flush wide" static-rows data-energy-matrix .columns=${this.columns(e)} .rows=${s}
        .rowAttrs=${i=>({"data-energy-row":String(i.id)})}></sw-table>
      <div class="list phone" style="flex-direction:column">${s.map(i=>a`<div class="li" style="flex-direction:column;align-items:stretch" data-energy-row-phone=${i.id}>
        <div class="row"><b>${i.label}</b>${this.chip(i.tag)}</div>
        <div class="t2 wrap">${e.roles.filter(r=>this.holds(r,i.id)).map(r=>r.name).join(", ")||O("אין תפקיד")}</div></div>`)}</div>
    </section>`}};re.styles=[Cs,q`
      :host {
        display: block;
        margin-block-start: 14px;
      }
      h3 {
        margin: 0 0 8px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
      }
      sw-table::part(code) {
        font-family: var(--sw-font-mono, monospace);
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        direction: ltr;
        text-align: start;
        unicode-bidi: isolate;
      }
      sw-table::part(tick) {
        display: inline-grid;
        place-items: center;
        inline-size: 22px;
        block-size: 22px;
        border-radius: var(--sw-r-xs);
        border: 2px solid var(--sw-border-strong);
        color: var(--sw-text-inverse);
      }
      sw-table::part(tick-on) {
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
    `];Ie([ne({attribute:!1})],re.prototype,"roles",2);re=Ie([W("elec-permission-rows")],re);function rt(e,s){const i=new Set(s??[]);return e.filter(r=>!i.has(r))}function nt(e,s,i){return s?e.filter(r=>!(r in s)||i.has(r)):[...e]}var ot=Object.defineProperty,lt=Object.getOwnPropertyDescriptor,z=(e,s,i,r)=>{for(var n=r>1?void 0:r?lt(s,i):s,o=e.length-1,p;o>=0;o--)(p=e[o])&&(n=(r?p(s,i,n):p(n))||n);return r&&n&&ot(s,i,n),n};const ue={light:d("תאורה"),not_light:d("לא תאורה"),protected:d("מוגן")},dt={alarm_managed:d("נשלט ממסך האזעקה"),media_managed:d("נשלט ממסך המולטימדיה"),doors_layer:d("בשכבת הדלתות")},se=20,ct={lights:d("תאורה"),climate:d("אקלים"),shades:d("תריסים"),doors:d("דלתות"),cameras:d("מצלמות"),energy:d("חשמל"),alerts:d("התראות"),scenes:d("סצנות"),security:d("אבטחה"),presence:d("מי בבית"),calendar:d("יומן וחדרים משותפים"),notices:d("לוח הודעות"),tickets:d("פניות שירות"),schedules:d("תזמונים"),...Us,recordings:d("הקלטות"),log:d("יומן הבית"),intercom:d("אינטרקום")};let x=class extends B{constructor(){super(...arguments),this.data=null,this.rooms=[],this.sel="",this.error="",this.message="",this.busy=!1,this.code="",this.sub="users",this.inst=null,this.vis=null,this.sw=null,this.swError="",this.swSel=new Set,this.swFilter="all",this.swArea="",this.swPage=0,this.walls=null,this.wallRoom="",this.wallStamp=0,this.wallsLoading=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const[e,s,i]=await Promise.all([D("home/policies"),Rs().catch(()=>null),D("home/settings").catch(()=>null)]);this.data=e,this.inst=i?.settings??null,this.rooms=s?.rooms??[],!this.sel&&e.users[0]&&(this.sel=e.users[0].user_id),this.error=""}catch(e){this.error=f(e)}this.loadVisitors()}async loadVisitors(){if(!this.data?.users.find(s=>s.user_id===Q.me?.user.id)?.system_admin){this.vis=this.data?"denied":null;return}try{this.vis=await D("access/visitors/settings")}catch{this.vis="denied"}}async saveVisitors(e){this.message="",this.busy=!0;try{this.vis=await U("access/visitors/settings",{visitors:e?"on":"off"}),this.message=e?this.vis.effective?d("הזמנת אורחים הופעלה."):d("נשמר. הזמנת אורחים תפעל רק כשגם הגישה החיצונית מופעלת."):d("הזמנת אורחים כובתה.")}catch(s){this.error=f(s)}finally{this.busy=!1}}visitorsCard(){const e=this.vis;if(e===null)return c;const s=e!=="denied"&&e.visitors==="on",i=e==="denied"?d("רק מנהל מערכת יכול להפעיל או לכבות."):s?e.effective?d('מופעל. רק מי שסומן "רשאי להזמין אורחים" ויש לו הרשאה יכול להזמין. קוד האורח לא מוצג למזמין.'):d("מופעל, אבל לא פועל עדיין: צריך להפעיל גם את הגישה החיצונית בהגדרות הגישה."):d('כבוי (ברירת המחדל בהתקנה). כשמופעל, רק מי שסומן "רשאי להזמין אורחים" ויש לו הרשאה יכול להזמין.');return a`<section class="card" aria-label="${d("הזמנת אורחים")}" data-home-visitors><h3>${d("הזמנת אורחים")}</h3>
      <div class="srow"><div><b>${d("הזמנת אורחים מהממשק הביתי")}</b><div class="note">${i}</div></div><sw-toggle label="${d("הזמנת אורחים מהממשק הביתי")}" labelHidden data-home-visitors-switch ?checked=${s} ?disabled=${e==="denied"||this.busy} @change=${r=>this.saveVisitors(r.detail.checked)}></sw-toggle></div></section>`}async save(e,s){this.busy=!0,this.message="";try{await U(`home/policies/${encodeURIComponent(e.user_id)}`,s),await this.load(),this.message=d("נשמר.")}catch(i){this.error=f(i)}finally{this.busy=!1}}async saveCode(){try{const e=await U("home/kiosk-code",{code:this.code||null});this.code="",this.message=e.kiosk_code_set?d("קוד היציאה של מסכי הקיר נשמר."):d("קוד היציאה נמחק."),await this.load()}catch(e){this.error=f(e)}}async seedFromMine(){try{const e=await Ps();await U("home/seed",{seed:e.favourites}),this.message=d("המועדפים שלך נשמרו כמועדפי ההתחלה של כולם.")}catch(e){this.error=f(e)}}async loadSwitches(){try{this.sw=(await D("home/switches")).switches,this.swError=""}catch(e){this.swError=f(e)}}async saveInstall(e){this.message="";try{this.inst=(await U("home/settings",e)).settings,this.message=d("נשמר. משתמשים קיימים לא הושפעו.")}catch(s){this.error=f(s)}}swVisible(){return(this.sw??[]).filter(e=>(this.swFilter==="all"?!0:this.swFilter==="suggested"?!!e.suggest:e.class===this.swFilter)&&(!this.swArea||(e.area_id??"")===this.swArea))}async mark(e,s){if(s.length){this.busy=!0,this.message="";try{const i=await H("home/switches",{entity_ids:s,mark:e});this.message=d('סומנו {changed} כ"{v1}".{v2}',{changed:i.changed,v1:ue[e],v2:i.refused?d(" {refused} לא שונו (נשלטים ממסך אחר).",{refused:i.refused}):""}),this.swSel=new Set,await this.loadSwitches()}catch(i){this.error=f(i)}finally{this.busy=!1}}}async approveSelected(){const e=(this.sw??[]).filter(s=>this.swSel.has(s.entity_id)&&s.suggest);for(const s of["light","protected","not_light"]){const i=e.filter(r=>r.suggest===s).map(r=>r.entity_id);i.length&&await this.mark(s,i)}}installPane(){const e=this.inst;if(!e)return a`<sw-state-panel state="loading"></sw-state-panel>`;const s=(i,r,n,o)=>a`<label class="opt"><input type="radio" name=${i} .checked=${e[i]===r} data-install=${`${i}:${r}`} @change=${()=>this.saveInstall({[i]:r})}><span><b>${n}</b><span class="note">${o}</span></span></label>`;return a`<div class="grid">
      <section class="card" aria-label="${d("ממשק למשתמשים חדשים")}"><h3>${d("ממשק למשתמשים חדשים")}</h3><p class="note">${d("חל רק על מי שעוד לא הוגדר. משתמשים קיימים נשארים עם מה שיש להם.")}</p><div class="opts">
        ${s("default_mode","full_all",d("ממשק מלא לכולם"),d("ברירת המחדל. כל אחד יכול לעבור לממשק הביתי מהתפריט האישי."))}
        ${s("default_mode","home_regular",d("ביתי למשתמשים רגילים, מלא למנהלים"),d("מנהל = מנהל מערכת או מי שרשאי להגדיר את המערכת."))}
        ${s("default_mode","choose",d("בחירה בכניסה הראשונה"),d("בכניסה הראשונה מוצג מסך בחירה בין שני הממשקים, והבחירה נשמרת."))}
      </div></section>
      <section class="card" aria-label="${d("מסכי קיר ורקע")}"><h3>${d("מסכי קיר")}</h3><div class="opts">
        ${s("kiosk_exit","code",d("נעול, יציאה בקוד מנהל"),d("ברירת המחדל. לחיצה ארוכה על השעון מבקשת את הקוד."))}
        ${s("kiosk_exit","none",d("נעול לממשק הביתי ולחדר שלו, בלי יציאה"),d("אין תפריט אישי ואין דרך לצאת מהמסך עצמו. משנים רק מכאן."))}
      </div>
      <h3 style="margin-block-start:16px">${d("רקע לחדרים")}</h3><div class="opts">
        ${s("wallpaper","none",d("בלי רקע"),d("ברירת המחדל: מסך נקי."))}
        ${s("wallpaper","gallery",d("גלריה מוכנה"),d("כל משתמש בוחר רקע מעומעם לכל חדר מתוך גלריה מובנית."))}
        ${s("wallpaper","gallery_image",d("גלריה ותמונה אישית"),d("בנוסף אפשר להעלות תמונה לחדר (JPEG או PNG, עד 2 MB). התמונה נשמרת בשרת ונראית רק למי שהעלה אותה."))}
      </div></section>${this.roomWallPane()}${this.visitorsCard()}</div>`}async loadWalls(){if(!this.wallsLoading){this.wallsLoading=!0;try{this.walls=(await D("home/room-wallpapers")).walls}catch{this.walls={}}this.wallsLoading=!1}}async setWall(e,s){this.busy=!0;try{this.walls=(await U(`home/room-wallpapers/${encodeURIComponent(e)}`,{value:s})).walls,this.message=d("הרקע נשמר")}catch(i){this.message=f(i)}finally{this.busy=!1}}async uploadWall(e,s){const i=s.target,r=i.files?.[0];if(i.value="",!r)return;if(!/^image\/(jpeg|png)$/.test(r.type)||r.size>2e6){this.message=d("אפשר להעלות JPEG או PNG עד 2 MB.");return}const n=new FormData;n.append("file",r);try{this.walls=(await Ve(`home/room-wallpapers/${encodeURIComponent(e)}/image`,{method:"PUT",body:n})).walls,this.wallStamp=Date.now(),this.message=d("התמונה נשמרה כרקע לכולם")}catch(o){this.message=f(o)}}roomWallPane(){const e=this.inst?.wallpaper??"none";if(e==="none")return c;if(this.walls==null)return this.loadWalls(),a`<section class="card"><sw-state-panel state="loading"></sw-state-panel></section>`;const s=this.wallRoom||this.rooms[0]?.id||"",i=this.walls[s]??"",r=[["",d("בלי רקע"),""],...Os.map(n=>["g:"+n.id,n.name,Ls(n.id)])];return a`<section class="card" aria-label="${d("רקע לחדר לכולם")}" data-home-room-walls><h3>${d("רקע לחדר לכולם")}</h3><p class="note">${d("למשל למסכי קיר. רקע שאדם בחר לעצמו גובר על זה, חוץ ממסך קיר: שם הרקע שנבחר כאן תמיד מוצג.")}</p>
      <div class="inline"><select aria-label="${d("חדר")}" @change=${n=>{this.wallRoom=n.target.value}}>${this.rooms.map(n=>a`<option value=${n.id} ?selected=${n.id===s}>${n.name}${this.walls[n.id]?" ·":""}</option>`)}</select>
      ${e==="gallery_image"&&s?a`<label class="up"><input type="file" accept="image/jpeg,image/png" hidden data-home-room-wall-upload @change=${n=>this.uploadWall(s,n)}><span>${i==="img"?d("החלפת התמונה"):d("תמונה לחדר")}</span></label>`:c}</div>
      <div class="walls">${r.map(([n,o,p])=>a`<button class="wopt" aria-pressed=${String(n===i)} data-home-room-wall=${n||"none"} ?disabled=${this.busy||!s} @click=${()=>this.setWall(s,n)}><span class="wpv" style=${p?`background:${p}`:c}></span>${o}</button>`)}${i==="img"?a`<button class="wopt" aria-pressed="true"><span class="wpv" style=${`background:url("${Re("home/room-wallpapers/"+encodeURIComponent(s)+"/image")}?v=${this.wallStamp}") center / cover`}></span>${d("תמונה")}</button>`:c}</div></section>`}switchesPane(){if(this.swError)return a`<sw-state-panel state="error" hint=${this.swError} actionLabel="${d("נסה שוב")}" @action=${()=>this.loadSwitches()}></sw-state-panel>`;if(!this.sw)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.swVisible(),s=Math.max(1,Math.ceil(e.length/se)),i=Math.min(this.swPage,s-1),r=e.slice(i*se,i*se+se),n=[...new Map(this.sw.filter($=>$.area_id).map($=>[$.area_id,$.area_name??$.area_id])).entries()],o=this.swSel,p=e.length>0&&e.every($=>o.has($.entity_id)),v=this.sw.filter($=>$.suggest).length,u=$=>{this.swSel=$},m=($,g)=>{const E=new Set(o);g?E.add($):E.delete($),u(E)},N=[...o].filter($=>this.sw.find(g=>g.entity_id===$)?.suggest).length;return a`<section class="card" aria-label="${d("סיווג מפסקים")}" data-home-switches>
      <h3>${d("סיווג מפסקים")}</h3>
      <p class="note">${d('תאורה נכבית ב"כיבוי החדר" וב"כיבוי הכל". "לא תאורה" (דוד, מקרר, משאבה...) לא נכבה בכיבוי כללי. "מוגן" גם מבקש אישור לפני כיבוי ידני ולא נכלל בשום פעולה קבוצתית. המערכת מציעה לפי השם, ואתם מאשרים.')}</p>
      <div class="filters">
        <sw-tabs segmented group-label="${d("סינון")}" data-sw-filter .items=${[{id:"all",label:d("הכל"),count:this.sw.length},{id:"suggested",label:d("הצעות"),count:v},{id:"light",label:d("תאורה")},{id:"not_light",label:d("לא תאורה")},{id:"protected",label:d("מוגן")}]} .active=${this.swFilter} @change=${$=>{this.swFilter=$.detail.id,this.swPage=0}}></sw-tabs>
        <select aria-label="${d("חדר")}" data-sw-area @change=${$=>{this.swArea=$.target.value,this.swPage=0}}><option value="">${d("כל החדרים")}</option>${n.map(([$,g])=>a`<option value=${$} ?selected=${this.swArea===$}>${g}</option>`)}</select>
      </div>
      <div class="bulk" ?hidden=${!o.size} role="toolbar" aria-label="${d("פעולה על המסומנים")}" data-sw-bulk>
        <span class="count">${o.size} ${d("מסומנים")}</span>
        ${N?a`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-sw-approve @click=${()=>this.approveSelected()}>${d("אישור ההצעות (")}${N})</sw-button>`:c}
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="light" @click=${()=>this.mark("light",[...o])}>${d("תאורה")}</sw-button>
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="not_light" @click=${()=>this.mark("not_light",[...o])}>${d("לא תאורה")}</sw-button>
        <sw-button size="sm" ?disabled=${this.busy} data-sw-mark="protected" @click=${()=>this.mark("protected",[...o])}>${d("מוגן")}</sw-button>
        <sw-button size="sm" variant="ghost" @click=${()=>u(new Set)}>${d("ניקוי")}</sw-button>
      </div>
      ${e.length?a`<table>
        <thead><tr><th class="c"><input type="checkbox" aria-label="${d("סמן את כל המוצגים")}" data-sw-all .checked=${p} @change=${$=>{const g=$.target.checked,E=new Set(o);for(const F of e)g?E.add(F.entity_id):E.delete(F.entity_id);u(E)}}></th><th>${d("שם")}</th><th>${d("חדר")}</th><th>${d("עכשיו")}</th><th>${d("הצעה")}</th></tr></thead>
        <tbody>${r.map($=>a`<tr data-sw-row=${$.entity_id} aria-selected=${String(o.has($.entity_id))}>
          <td class="c"><input type="checkbox" aria-label=${d("סמן ")+$.name} .checked=${o.has($.entity_id)} @change=${g=>m($.entity_id,g.target.checked)}></td>
          <td><b>${$.name}</b>${$.locked?a`<div class="note">${dt[$.locked]??""}</div>`:c}</td>
          <td>${$.area_name??a`<span class="note">${d("בלי חדר")}</span>`}</td>
          <td><span class="cls ${$.class}">${ue[$.class]}</span></td>
          <td>${$.suggest?a`<span class="sug"><sw-button size="sm" ?disabled=${this.busy} data-sw-accept=${$.entity_id} @click=${()=>this.mark($.suggest,[$.entity_id])}>${ue[$.suggest]}</sw-button><span class="why">${$.suggest_reason??""}</span></span>`:a`<span class="note">—</span>`}</td>
        </tr>`)}</tbody></table>
        ${s>1?a`<div class="pager"><sw-button size="sm" variant="ghost" ?disabled=${i===0} @click=${()=>{this.swPage=i-1}}>${d("הקודם")}</sw-button><span>${i+1} ${d("מתוך")} ${s}</span><sw-button size="sm" variant="ghost" ?disabled=${i>=s-1} @click=${()=>{this.swPage=i+1}}>${d("הבא")}</sw-button></div>`:c}`:a`<p class="note">${d("אין מפסקים שמתאימים לסינון.")}</p>`}
    </section>`}render(){if(this.error&&!this.data)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="${d("נסה שוב")}" @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.data.users.find(r=>r.user_id===this.sel)??this.data.users[0],s=a`<div class="subtabs"><sw-tabs variant="underline-compact" group-label="${d("ממשק ביתי")}" data-home-subtabs .items=${[{id:"users",label:d("משתמשים")},{id:"install",label:d("הגדרות התקנה")},{id:"switches",label:d("סיווג מפסקים")}]} .active=${this.sub}
      @change=${r=>{this.sub=r.detail.id,this.message="",this.error="",this.sub==="switches"&&!this.sw&&this.loadSwitches()}}></sw-tabs></div>`,i=a`${this.message?a`<p class="msg ok" role="status">${this.message}</p>`:c}${this.error?a`<p class="msg err" role="alert">${this.error}</p>`:c}`;return this.sub==="install"?a`${s}${i}${this.installPane()}`:this.sub==="switches"?a`${s}${i}${this.switchesPane()}`:a`${s}
      ${i}
      <div class="grid">
        <section class="card" aria-label="${d("משתמשים")}"><div class="users">${this.data.users.map(r=>a`<button class="u" data-home-user=${r.user_id} aria-current=${String(r.user_id===e?.user_id)} @click=${()=>{this.sel=r.user_id,this.message=""}}><b>${r.display_name}</b><span class="chip ${r.default_interface==="home"?"home":""}">${r.kiosk?d("מסך קיר"):r.home_only?d("ביתי בלבד"):r.default_interface==="home"?d("ביתי"):d("מלא")}</span><span class="note">${r.home_only||!r.may_switch?d("נעול"):d("מחליף")}</span></button>`)}</div></section>
        ${e?this.detail(e):c}
      </div>
      <section class="card extra">
        <h3>${d("מסכי קיר ומועדפי התחלה")}</h3>
        <div class="srow"><div><b>${d("קוד יציאה ממסך קיר")}</b><div class="note">${this.data.kiosk_code_set?d("מוגדר. לחיצה ארוכה על השעון במסך הקיר מבקשת אותו."):d("לא מוגדר: מסך קיר לא ייפתח בלי קוד.")}</div></div>
          <div class="inline"><input type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="${d("4 עד 8 ספרות")}" aria-label="${d("קוד יציאה")}" .value=${this.code} @input=${r=>{this.code=r.target.value.replace(/\D/g,"")}}><sw-button size="sm" @click=${()=>this.saveCode()}>${this.code?d("שמירה"):d("מחיקת הקוד")}</sw-button></div></div>
        <div class="srow"><div><b>${d("מועדפי התחלה")}</b><div class="note">${d("מי שעוד לא סידר מועדפים בחדר רואה את אלה. משתמשים יכולים לשנות לעצמם.")}</div></div><sw-button size="sm" data-home-seed @click=${()=>this.seedFromMine()}>${d("העתק את המועדפים שלי")}</sw-button></div>
      </section>`}detail(e){const s=this.rooms,i=o=>e.rooms==null||e.rooms.includes(o),r=o=>e.modules==null||e.modules.includes(o),n=(o,p,v,u)=>{const m=o??p,N=u?[...new Set([...m,v])]:m.filter($=>$!==v);return N.length===p.length?null:N};return a`<section class="card" aria-label=${e.display_name} data-home-detail>
      <h3>${e.display_name}</h3>
      <div class="srow"><div><b>${d("ממשק ברירת מחדל")}</b><div class="note">${d("הממשק שנפתח בכניסה")}</div></div>
        <sw-view-switch label="${d("ממשק ברירת מחדל")}" .options=${[{id:"home",label:d("ביתי")},{id:"full",label:d("מלא")}]} value=${e.home_only?"home":e.default_interface} ?disabled=${e.home_only} @change=${o=>this.save(e,{default_interface:o.detail})}></sw-view-switch></div>
      <div class="srow"><div><b>${d("רשאי להחליף ממשק")}</b><div class="note">${d("מציג את הבחירה בתפריט האישי")}</div></div><sw-toggle label="${d("רשאי להחליף ממשק")}" labelHidden ?checked=${e.may_switch} ?disabled=${e.home_only||this.busy} @change=${o=>this.save(e,{may_switch:o.detail.checked})}></sw-toggle></div>
      <div class="srow"><div><b>${d("ממשק ביתי בלבד")}</b><div class="note">${e.system_admin?d("מנהל מערכת תמיד רשאי לממשק המלא."):d("לא יכול לפתוח את הממשק המלא. השרת מסרב גם לבקשות שלו לאזורים של הממשק המלא.")}</div></div><sw-toggle label="${d("ממשק ביתי בלבד")}" labelHidden ?checked=${e.home_only} ?disabled=${e.system_admin||this.busy} @change=${o=>this.save(e,{home_only:o.detail.checked,...o.detail.checked?{}:{kiosk:!1}})}></sw-toggle></div>
      <div class="srow"><div><b>${d("מצב מסך קיר")}</b><div class="note">${d("נשאר תמיד בממשק הביתי ובחדר שלו, בלי תפריט אישי. יוצאים עם קוד המנהל.")}</div></div>
        <div class="inline">${e.kiosk||s.length?a`<select aria-label="${d("החדר של מסך הקיר")}" ?disabled=${e.system_admin} @change=${o=>{const p=o.target.value;p&&this.save(e,{kiosk:!0,kiosk_area_id:p})}}><option value="">${e.kiosk?d("חדר"):d("בחרו חדר")}</option>${s.map(o=>a`<option value=${o.id} ?selected=${e.kiosk_area_id===o.id}>${o.name}</option>`)}</select>`:c}<sw-toggle label="${d("מצב מסך קיר")}" labelHidden ?checked=${e.kiosk} ?disabled=${e.system_admin||this.busy||!e.kiosk&&!e.kiosk_area_id} @change=${o=>this.save(e,{kiosk:o.detail.checked,kiosk_area_id:e.kiosk_area_id})}></sw-toggle></div></div>
      <div class="srow"><div><b>${d("רשאי להזמין אורחים")}</b><div class="note">${e.can_invite?d("מופיע בממשק הביתי תחת אינטרקום: אורח מקבל קוד זמני לדלת. דורש שהזמנת מבקרים מופעלת בהתקנה."):d("הסימון לבדו לא מספיק: צריך גם הרשאה להזמנת מבקרים (משתמשים והרשאות), והזמנת מבקרים מופעלת בהתקנה.")}</div></div><sw-toggle label="${d("רשאי להזמין אורחים")}" labelHidden data-home-guests ?checked=${!!e.guests} ?disabled=${this.busy} @change=${o=>this.save(e,{guests:o.detail.checked})}></sw-toggle></div>
      <div class="cols">
        <div><b>${d("מה מופיע בממשק הביתי")}</b>${this.data.modules.map(o=>a`<label class="chk"><input type="checkbox" .checked=${r(o)} @change=${p=>{const v=n(e.modules,this.data.modules,o,p.target.checked);this.save(e,v==null?{all_modules:!0}:{modules:v})}}><span>${ct[o]}</span></label>`)}</div>
        <div><b>${d("חדרים שהמשתמש רואה")}</b>${s.length?s.map(o=>a`<label class="chk"><input type="checkbox" .checked=${i(o.id)} @change=${p=>{const v=n(e.rooms,s.map(u=>u.id),o.id,p.target.checked);this.save(e,v==null?{all_rooms:!0}:{rooms:v})}}><span>${o.name}</span></label>`):a`<p class="note">${d("עוד אין חדרים.")}</p>`}</div>
      </div>
    </section>`}};x.styles=q`
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
  `;z([h()],x.prototype,"data",2);z([h()],x.prototype,"rooms",2);z([h()],x.prototype,"sel",2);z([h()],x.prototype,"error",2);z([h()],x.prototype,"message",2);z([h()],x.prototype,"busy",2);z([h()],x.prototype,"code",2);z([h()],x.prototype,"sub",2);z([h()],x.prototype,"inst",2);z([h()],x.prototype,"vis",2);z([h()],x.prototype,"sw",2);z([h()],x.prototype,"swError",2);z([h()],x.prototype,"swSel",2);z([h()],x.prototype,"swFilter",2);z([h()],x.prototype,"swArea",2);z([h()],x.prototype,"swPage",2);z([h()],x.prototype,"walls",2);z([h()],x.prototype,"wallRoom",2);z([h()],x.prototype,"wallStamp",2);x=z([W("sw-home-admin")],x);var pt=Object.defineProperty,ht=Object.getOwnPropertyDescriptor,k=(e,s,i,r)=>{for(var n=r>1?void 0:r?ht(s,i):s,o=e.length-1,p;o>=0;o--)(p=e[o])&&(n=(r?p(s,i,n):p(n))||n);return r&&n&&pt(s,i,n),n};const Ae=[{id:"users",label:t("משתמשים"),count:me.length},{id:"groups",label:t("קבוצות"),count:Oe.length},{id:"roles",label:t("תפקידים"),count:Le.length},{id:"effective",label:t("הרשאות אפקטיביות")},{id:"audit",label:t("אודיט הרשאות")}],Ce=new Set(["map.read","video.live","video.playback","video.export","events.read","events.ack","cases.manage"]);let y=class extends B{constructor(){super(...arguments),this.bubbleSkin=new $e(this),this.tabsMode=new Ye(this,"settings"),this.tab="users",this.selected=null,this.assigning=!1,this.step=0,this.directory=null,this.roles=null,this.groups=null,this.tree=null,this.audit=null,this.selectedGroup=null,this.wizard=null,this.members=null,this.newGroup="",this.preview=null,this.previewUser="",this.previewScope="installation:*",this.busy=!1,this.error="",this.toaster=new je(this,{ms:3500}),this.forbidden=!1,this.roleEdit=null,this.roleImpact=null,this.roleDelete=null,this.groupsMeta={can_manage:!1,delegated:!1},this.renameDraft=null,this.groupChange=null,this.remoteOff=null,this.roleImpactTimer=0,this.narrow=!1,this.narrowMq=null,this.onNarrow=()=>this.narrow=!!this.narrowMq?.matches,this.onHash=()=>{window.location.hash.startsWith("#/system/access")&&this.readTab()},this.userColumns=[{key:"name",label:t("שם"),render:e=>a`<div class="who"><sw-avatar name=${String(e.name)} size=${30}></sw-avatar><div><strong>${String(e.name)}</strong>${e.haAdmin?a` <sw-badge kind="neutral" label=${t("מנהל HA · מידע בלבד")}></sw-badge>`:""}<div class="ltr sub">${String(e.haUser)}@ha.local</div></div></div>`},{key:"role",label:t("תפקיד"),render:e=>{const s=e.bindings[0];return s?a`<span class="pillsel">${s.role}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:a`<span class="pillsel" style="color:var(--sw-text-3)">${t("ללא שיוך")}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`}},{key:"scope",label:t("היקף גישה"),render:e=>{const s=e.bindings[0];return s?a`<span class="pillsel">${s.scope}<sw-icon name="chevronDown" size=${11}></sw-icon></span>`:a`<span class="sub">—</span>`}},{key:"active",label:t("מצב"),render:e=>a`<span class="status ${e.active?"":"off"}"><i></i>${e.active?t("פעיל"):t("מושבת ב־HA")}</span>`},{key:"lastSync",label:t("סנכרון")},{key:"more",label:"",width:"40px",render:()=>a`<sw-button variant="ghost" size="sm" iconOnly icon="more" label=${t("עוד")}></sw-button>`}]}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.readTab(),window.addEventListener("hashchange",this.onHash),this.narrowMq=window.matchMedia("(max-width: 767px)"),this.narrowMq.addEventListener("change",this.onNarrow),this.onNarrow(),L()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),this.narrowMq?.removeEventListener("change",this.onNarrow)}readTab(){const e=Je().params.get("tab")??"";(Ae.some(i=>i.id===e)||e==="ha-users"&&(!L()||C("users.ha_manage"))||e==="local"&&L()&&C("identity.directory.read")||e==="home"&&L()&&C("rbac.assign"))&&e!==this.tab&&this.setTab(e)}setTab(e){this.tab=e,this.tab==="audit"&&L()&&this.loadAudit(),Ze("/system/access",e==="users"?void 0:new URLSearchParams({tab:e}))}async load(){this.error="";try{const[e,s,i,r]=await Promise.all([ts(),V(),as(),Qe().catch(()=>null)]);this.directory=e,this.roles=s,this.groups=i.groups,this.groupsMeta={can_manage:!!i.can_manage,delegated:!!i.delegated},this.tree=r,this.forbidden=!1,this.previewUser||(this.previewUser=Q.me?.user.id??"");const n=this.scopeOptions;n.length&&!n.some(o=>`${o.type}:${o.id}`===this.previewScope)&&(this.previewScope=`${n[0].type}:${n[0].id}`)}catch(e){const s=f(e);this.error=s,this.forbidden=/403|הרשאה|forbidden/i.test(s)&&!this.directory}}async loadAudit(){try{const[e,s]=await Promise.all([ge({prefix:"rbac.",limit:100}),ge({prefix:"identity.",limit:50})]);this.audit=[...e.rows,...s.rows].sort((i,r)=>i.at<r.at?1:-1).slice(0,150)}catch(e){this.error=f(e),this.audit=[]}}flash(e){this.toaster.show(e)}get scopeOptions(){const e=this.directory?.assign_scopes;if(e&&e.length)return e;const s=[{type:"installation",id:"*",name:t("כל ההתקנה")}];for(const i of this.tree?.sites??[]){s.push({type:"site",id:i.id,name:`${t("אתר")} · ${i.name}`});for(const r of i.buildings??[]){s.push({type:"building",id:r.id,name:`${i.name} · ${r.name}`});for(const n of r.floors??[])s.push({type:"floor",id:n.id,name:`${i.name} · ${r.name} · ${n.name}`})}}return s}userName(e){return this.directory?.users.find(s=>s.id===e)?.name??e}label(e){return this.roles?.labels[e]??Pe(e)??Xe(e)??Es(e)??e}startWizard(e,s,i){const r=this.roles?.roles??[],n=r.some(p=>p.id==="viewer")?"viewer":r[0]?.id??"viewer",o=this.scopeOptions[0];this.wizard={subjectKind:e,subjectId:s,subjectName:i,roleId:n,scopeKey:o?`${o.type}:${o.id}`:"installation:*",effect:"allow"}}pickScopeKind(e,s){const r=this.scopeOptions.filter(n=>n.type==="camera"===s)[0];r&&(this.wizard={...e,scopeKey:`${r.type}:${r.id}`})}async previewGroupChange(e,s,i,r,n){this.busy=!0,this.error="";try{const o=await is(e.id,r);this.groupChange={heading:s,impact:o,confirmLabel:i,run:async()=>{await n(o.revision)}}}catch(o){this.error=f(o)}finally{this.busy=!1}}async confirmGroupChange(){const e=this.groupChange;if(e){this.busy=!0,this.error="";try{await e.run(),this.groupChange=null,await this.load()}catch(s){this.error=f(s),this.groupChange=null,await this.load()}finally{this.busy=!1}}}async saveWizard(){const e=this.wizard;if(!e)return;const[s,i]=e.scopeKey.split(":");if(e.subjectKind==="group"){const r=this.groups?.find(p=>p.id===e.subjectId);if(!r)return;const n=this.roles?.roles.find(p=>p.id===e.roleId),o=this.scopeOptions.find(p=>`${p.type}:${p.id}`===e.scopeKey);await this.previewGroupChange(r,`${t('{kind} לקבוצה "{name}"',{kind:e.effect==="deny"?t("חסימה"):t("שיוך"),name:r.name})}: ${n?.name??e.roleId} · ${o?.name??i}`,t("שמור שיוך"),{op:"bind",role_id:e.roleId,scope_type:s,scope_id:i,effect:e.effect},async p=>{await rs(r.id,{role_id:e.roleId,scope_type:s,scope_id:i,effect:e.effect,revision:p}),this.wizard=null,this.flash(t('שויך לקבוצה "{name}"',{name:r.name}))});return}this.busy=!0,this.error="";try{const r=await fe({subject_kind:e.subjectKind,subject_id:e.subjectId,role_id:e.roleId,scope_type:s,scope_id:i,effect:e.effect});this.flash(e.effect==="deny"?`${t("נחסם:")} ${r.role_name} · ${r.scope_name} (${t("רוויזיה {n}",{n:r.revision})})`:`${t("שויך:")} ${r.role_name} · ${r.scope_name} (${t("רוויזיה {n}",{n:r.revision})})`),this.wizard=null,await this.load()}catch(r){this.error=f(r)}finally{this.busy=!1}}async revoke(e){if(e.subject_kind==="group"&&!e.via_group){const s=this.groups?.find(i=>i.id===e.subject_id);if(s){await this.previewGroupChange(s,`${t('ביטול שיוך של הקבוצה "{name}"',{name:s.name})}: ${e.role_name} · ${e.scope_name}`,t("בטל שיוך"),{op:"unbind",binding_id:e.id},async i=>{await ns(s.id,e.id,i),this.flash(`${t("בוטל:")} ${e.role_name} · ${e.scope_name}`)});return}}this.busy=!0,this.error="";try{await os(e.id),this.flash(`${t("בוטל:")} ${e.role_name} · ${e.scope_name}`),await this.load()}catch(s){this.error=f(s)}finally{this.busy=!1}}async sync(){this.busy=!0,this.error="";try{const e=await ls();this.flash(e.requested?t("הספרייה נדחפה מ־Home Assistant"):e.note??t("הספרייה מתעדכנת אוטומטית כל דקה")),await this.load()}catch(e){this.error=f(e)}finally{this.busy=!1}}async addGroup(){const e=this.newGroup.trim();if(e){this.busy=!0,this.error="";try{const s=await ds(e);this.newGroup="",this.flash(t('נוצרה קבוצה "{name}"',{name:s.name})),await this.load(),this.selectedGroup=s.id}catch(s){this.error=f(s)}finally{this.busy=!1}}}async saveMembers(e){if(!this.members)return;const s=[...this.members];await this.previewGroupChange(e,t('חברי הקבוצה "{name}"',{name:e.name}),t("שמור חברים"),{op:"members",user_ids:s},async i=>{await cs(e.id,s,i),this.members=null,this.flash(t("חברי הקבוצה עודכנו"))})}async saveRename(e){const s=(this.renameDraft??"").trim();if(!s||s===e.name){this.renameDraft=null;return}this.busy=!0,this.error="";try{await ps(e.id,s,e.revision),this.renameDraft=null,this.flash(t('שם הקבוצה עודכן ל"{name}"',{name:s})),await this.load()}catch(i){this.error=f(i)}finally{this.busy=!1}}async removeGroup(e){this.busy=!0,this.error="";try{await hs(e.id,e.revision),this.selectedGroup=null,this.flash(t('הקבוצה "{name}" נמחקה',{name:e.name})),await this.load()}catch(s){this.error=f(s)}finally{this.busy=!1}}async runPreview(){if(!this.previewUser)return;const[e,s]=this.previewScope.split(":");this.busy=!0,this.error="";try{this.preview=await us({user_id:this.previewUser,scope_type:e,scope_id:s})}catch(i){this.error=f(i)}finally{this.busy=!1}}canRevoke(e,s){if(!s||e.via_group)return!1;const i=this.directory;return!(i?.delegated&&(!(i.assignable_roles??[]).includes(e.role_id)||e.subject_kind==="user"&&e.subject_id===Q.me?.user.id))}renderBindingRow(e,s){return a`<div class="bind" data-binding=${e.id}>
      <div><strong>${e.role_name}</strong> · ${e.scope_name}${e.effect==="deny"?a` <sw-badge kind="forbidden" label=${t("חסימה")}></sw-badge>`:c}<div class="sub">${e.via_group?`${t('דרך קבוצה "{name}"',{name:e.via_group})} · `:""}${t("מאז {time}",{time:S(e.created_at)})}${e.expires_at?` · ${t("עד {time}",{time:S(e.expires_at)})}`:""} · ${t("רוויזיה {n}",{n:e.permission_revision})}</div></div>
      ${this.canRevoke(e,s)?a`<sw-button size="sm" variant="ghost" icon="trash" data-revoke ?disabled=${this.busy} @click=${()=>this.revoke(e)}>${t("ביטול")}</sw-button>`:c}
    </div>`}renderWizard(){const e=this.wizard;if(!e||!this.roles)return c;const s=this.roles.roles.find(m=>m.id===e.roleId),i=this.scopeOptions.find(m=>`${m.type}:${m.id}`===e.scopeKey),r=s?.system_role??!1,n=e.effect==="deny",o=s?.permissions.includes("rbac.assign")??!1,p=this.scopeOptions.filter(m=>m.type!=="camera"),v=this.scopeOptions.filter(m=>m.type==="camera"),u=e.scopeKey.startsWith("camera:");return a`<div class="wiz">
      <sw-steps .steps=${[t("תפקיד"),t("היקף"),t("תצוגה מקדימה"),t("שמירה")]} .current=${2}></sw-steps>
      <div class="hint">${e.subjectKind==="group"?t("שיוך לקבוצה:"):t("שיוך למשתמש:")} <strong>${e.subjectName}</strong></div>
      ${this.directory?.delegated?c:a`<sw-field label=${t("סוג שיוך")}><select data-wizard-effect @change=${m=>this.wizard={...e,effect:m.target.value}}>
            <option value="allow" ?selected=${!n}>${t("הרשאה — מוסיף את הרשאות התפקיד בהיקף")}</option>
            <option value="deny" ?selected=${n}>${t("חסימה — מסיר את הרשאות התפקיד בהיקף, גם אם שיוך אחר מרשה")}</option>
          </select></sw-field>`}
      <sw-field label=${t("תפקיד")}><select data-wizard-role @change=${m=>this.wizard={...e,roleId:m.target.value}}>${this.roles.roles.map(m=>a`<option value=${m.id} ?selected=${m.id===e.roleId}>${m.name}</option>`)}</select></sw-field>
      <sw-field label=${t("סוג היקף")}><select data-wizard-scope-kind @change=${m=>this.pickScopeKind(e,m.target.value==="camera")}>
        <option value="place" ?selected=${!u}>${t("התקנה / אתר / מבנה / קומה")}</option>
        <option value="camera" ?selected=${u} ?disabled=${!v.length||r||o}>${t("מצלמה")}</option>
      </select></sw-field>
      ${u?a`<sw-field label=${t("מצלמה")}><select data-wizard-camera @change=${m=>this.wizard={...e,scopeKey:m.target.value}}>${v.map(m=>a`<option value=${`${m.type}:${m.id}`} ?selected=${`${m.type}:${m.id}`===e.scopeKey}>${m.name.replace(/^מצלמה · /,"")}</option>`)}</select></sw-field>`:a`<sw-field label=${t("היקף")}><select data-wizard-scope @change=${m=>this.wizard={...e,scopeKey:m.target.value}}>${p.map(m=>a`<option value=${`${m.type}:${m.id}`} ?selected=${`${m.type}:${m.id}`===e.scopeKey} ?disabled=${r&&m.type!=="installation"}>${m.name}</option>`)}</select></sw-field>`}
      ${u?a`<div class="hint" data-camera-scope-hint>${t("היקף מצלמה: ההרשאות חלות על המצלמה הזו בלבד — שידור חי, הקלטות, אירועים וייצוא שלה. במפה תוצג תוכנית הקומה שלה עם המצלמה הזו בלבד, בלי ישויות Home Assistant ובלי מצלמות אחרות. חסימה ברמה רחבה יותר (קומה, אתר, התקנה) גוברת גם עליה.")}</div>`:c}
      ${this.directory?.delegated?a`<div class="hint" data-delegated-hint>${t("כמנהל אתר מוצגים רק התפקידים שמותר לך להאציל וההיקפים שבאחריותך. אינך משנה את השיוכים של עצמך ואינך יוצר חסימות.")}</div>`:c}
      ${e.subjectKind==="group"?a`<div class="hint">${t("לפני השמירה תוצג ההשפעה על כל אחד מחברי הקבוצה.")}</div>`:c}
      ${s?n?a`<div class="eff">
              <div><div class="sec">${t("ייחסמו ב־{scope}",{scope:i?.name??t("ההיקף")})}</div>${s.permissions.map(m=>a`<div class="row"><span>${this.label(m)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
              <div class="hint" style="align-self:start">${t('חסימה פועלת רק על ההרשאות שהתפקיד הזה מקנה, ורק בהיקף שנבחר. היא גוברת על כל שיוך "הרשאה" אחר לאותו משתמש באותה הרשאה ובאותו היקף (או היקף שמכיל אותו) — לא על שיוכים בהיקפים לא קשורים.')}</div>
            </div>`:u?a`<div class="eff" data-camera-effect>
                <div><div class="sec">${t("מותר ב־{scope}",{scope:i?.name??t("המצלמה")})}</div>${s.permissions.filter(m=>Ce.has(m)).map(m=>a`<div class="row"><span>${this.label(m)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
                <div><div class="sec">${t("ללא השפעה בהיקף מצלמה")}</div>${s.permissions.filter(m=>!Ce.has(m)).map(m=>a`<div class="row"><span>${this.label(m)}</span><sw-icon name="close" size=${14} style="color:var(--sw-text-3)"></sw-icon></div>`)}<div class="row"><span>${t("כל מצלמה אחרת")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
              </div>`:a`<div class="eff">
              <div><div class="sec">${t("מותר ב־{scope}",{scope:i?.name??t("ההיקף")})}</div>${s.permissions.map(m=>a`<div class="row"><span>${this.label(m)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}</div>
              <div><div class="sec">${t("לא כלול / מחוץ להיקף")}</div>${s.sensitive_missing.map(m=>a`<div class="row"><span>${this.label(m)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}<div class="row"><span>${t("כל היקף אחר")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
            </div>`:c}
      ${r?a`<div class="hint">${t("תפקיד עם הרשאות מערכת מוקצה רק ברמת ההתקנה כולה.")}</div>`:c}
      <div class="hint">${t("הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־Home Assistant. השינוי נרשם באודיט עם diff לפני/אחרי.")}</div>
    </div>`}requestRemote(e,s){const i=e.remote_sessions??0;if(!s&&i>0&&(this.directory?.remote_policy??"flag")==="flag"&&!e.remote_admin_default){this.remoteOff={userId:e.id,count:i};return}this.toggleRemote(e.id,s)}async toggleRemote(e,s){this.busy=!0,this.error="",this.remoteOff=null;try{const i=await ms(e,s);this.flash(s?t("הגישה מרחוק הופעלה"):i.sessions_ended?`${t("הגישה מרחוק כובתה")} · ${t("{n} כניסות נסגרו",{n:i.sessions_ended})}`:t("הגישה מרחוק כובתה")),await this.load()}catch(i){this.error=f(i),await this.load()}finally{this.busy=!1}}remoteStats(e){const s=e.remote_sessions??0;return`${s===0?t("אין כניסות פעילות מרחוק"):s===1?t("כניסה פעילה אחת"):t("{n} כניסות פעילות",{n:s})} · ${e.remote_last_sign_in?t("כניסה אחרונה מרחוק {time}",{time:S(e.remote_last_sign_in)}):t("טרם נכנס מרחוק")}`}renderUsersApi(){const e=this.directory,s=e.can_assign,i=e.delegated?[]:[{key:"remote_access",label:t("מרחוק"),render:p=>{const v=p,u=v.remote_sessions??0;return a`<span data-remote-col style="font-size:var(--sw-fs-xs)">${v.remote_access_basis==="admin_default"?t("ברירת מחדל (מנהל)"):v.remote_access?t("מופעלת"):t("כבויה")}${u?a` · <sw-badge kind="live" label=${u===1?t("מחובר"):t("{n} חיבורים",{n:u})}></sw-badge>`:c}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${v.remote_last_sign_in?t("אחרונה {time}",{time:S(v.remote_last_sign_in)}):t("טרם נכנס")}</div>`}}],n=[{key:"name",label:t("שם"),render:p=>a`<div style="display:flex;align-items:center;gap:10px"><sw-avatar name=${String(p.name)} size=${30}></sw-avatar><div style="min-inline-size:0;white-space:normal;overflow-wrap:anywhere"><strong>${String(p.name)}</strong>${p.is_admin?a` <sw-badge kind="neutral" label=${t("מנהל HA · מידע בלבד")}></sw-badge>`:c}${p.is_self?a` <sw-badge kind="recorded" label=${t("אני")}></sw-badge>`:c}${ie(String(p.name),String(p.username??""),String(p.id??""))?a`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3);direction:ltr;text-align:start">${ie(String(p.name),String(p.username??""),String(p.id??""))}</div>`:c}</div></div>`},{key:"bindings",label:t("תפקיד · היקף"),render:p=>{const v=p.bindings;return v.length?a`${v.slice(0,2).map(u=>a`<div style="font-size:var(--sw-fs-xs);white-space:normal;overflow-wrap:anywhere;min-inline-size:16ch"><strong>${u.role_name}</strong> · ${u.scope_name}${u.via_group?` (${t("קבוצה")})`:""}${u.effect==="deny"?a` <span data-binding-deny style="color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)">· ${t("חסימה")}</span>`:c}</div>`)}${v.length>2?a`<div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">+${v.length-2}</div>`:c}`:a`<span style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${t("ללא שיוך · אין גישה לתוכן")}</span>`}},{key:"groups",label:t("קבוצות"),render:p=>{const v=p.groups.map(u=>u.name).join(", ");return a`<span title=${v} style="font-size:var(--sw-fs-xs);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;white-space:normal;overflow-wrap:anywhere;min-inline-size:12ch;max-inline-size:32ch">${v||"—"}</span>`}},{key:"active",label:t("מצב"),render:p=>a`<span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--sw-fs-xs)"><i style="inline-size:7px;block-size:7px;border-radius:50%;background:${p.active?"var(--sw-live)":"var(--sw-offline)"}"></i>${p.active?t("פעיל"):t("ללא גישה (HA)")}</span>`},{key:"sync_status",label:t("סנכרון"),render:p=>a`<span style="font-size:var(--sw-fs-xs)">${be[p.sync_status]}</span><div style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${p.last_seen_at?t("נראה {time}",{time:S(String(p.last_seen_at))}):t("טרם נכנס")}</div>`},...i].filter(p=>!this.narrow||!["groups","sync_status","remote_access"].includes(p.key)),o=e.users.find(p=>p.id===this.selected)??null;return a`
      <div class="stage">
        ${e.users.length?a`<sw-table .columns=${n} .rows=${e.users} .selected=${this.selected} @row-select=${p=>{this.selected=p.detail.id,this.wizard=null}}></sw-table>`:a`<sw-state-panel icon="users" state="empty" heading=${t("אין משתמשים עדיין")} hint=${e.directory.paired?t("הספרייה תגיע מהגשר תוך דקה."):t("צמד את גשר Arx ב־Home Assistant כדי לקבל את רשימת המשתמשים.")}></sw-state-panel>`}
        ${o?a`<sw-drawer open modal heading=${o.name} subheading=${`Home Assistant · ${o.username||o.id} · ${o.active?t("פעיל"):t("ללא גישה")}`} data-user-drawer @close=${()=>{this.selected=null,this.wizard=null}}>
              ${this.wizard&&this.wizard.subjectKind==="user"?this.renderWizard():a`<dl>
                    <dt>${t("מקור זהות")}</dt><dd>Home Assistant · <span class="ltr">${o.id}</span></dd>
                    <dt>${t("סנכרון")}</dt><dd>${be[o.sync_status]}${o.synced_at?` · ${S(o.synced_at)}`:""}</dd>
                    <dt>${t("ב־Arx")}</dt><dd>${o.first_seen_at?`${t("מאז {time}",{time:S(o.first_seen_at)})} · ${t("לאחרונה {time}",{time:S(o.last_seen_at)})}`:t("טרם נכנס לממשק")}</dd>
                    <dt>${t("מנהל HA")}</dt><dd>${o.is_admin?t("כן · מידע בלבד, לא תפקיד במערכת"):t("לא")}</dd>
                    <dt>${t("קבוצות")}</dt><dd>${o.groups.map(p=>p.name).join(", ")||"—"}</dd>
                    ${e.delegated?c:a`<dt>${t("גישה מרחוק")}</dt><dd data-remote-access>${C("system.configure")?a`<sw-toggle label="SmplWise Arx" .checked=${we(!!o.remote_access&&this.remoteOff?.userId!==o.id)} ?disabled=${this.busy||o.remote_access_basis==="admin_default"} data-remote-access-toggle @change=${p=>this.requestRemote(o,p.detail.checked)}></sw-toggle>`:o.remote_access_basis==="admin_default"?t("ברירת מחדל (מנהל)"):o.remote_access?t("מופעלת"):t("כבויה")}
                      ${o.remote_access_basis==="admin_default"?a`<div class="sub" data-remote-admin-default>${t("ברירת מחדל (מנהל) · משתנה בהגדרות ‹ גישה מרחוק")}</div>`:c}
                      <div class="sub" data-remote-stats>${this.remoteStats(o)}</div>
                      ${this.remoteOff?.userId===o.id?a`<div class="remote-off" role="alert" data-remote-off-impact>
                            <span>${this.remoteOff.count===1?t("כניסה פעילה אחת תיסגר עכשיו"):t("{n} כניסות פעילות ייסגרו עכשיו",{n:this.remoteOff.count})} (${t("כולל חיבורי וידאו פתוחים")}).</span>
                            <sw-button size="sm" variant="danger" data-remote-off-confirm ?disabled=${this.busy} @click=${()=>void this.toggleRemote(o.id,!1)}>${t("כבה וסגור")}</sw-button>
                            <sw-button size="sm" variant="ghost" @click=${()=>this.remoteOff=null}>${t("ביטול")}</sw-button>
                          </div>`:c}</dd>`}
                    ${!e.delegated&&C("system.configure")?a`<dt>${oe("secondFactor.adminLabel")}</dt><dd data-second-factor-user><sw-second-factor-user .userId=${o.id}></sw-second-factor-user></dd>`:c}
                    ${!e.delegated&&C("system.configure")?a`<dt>${oe("secondFactor.overrideLabel")}</dt><dd data-second-factor-policy-user><sw-second-factor-policy kind="user" .subjectId=${o.id}></sw-second-factor-policy></dd>`:c}
                    ${!e.delegated&&C("system.configure")?a`<dt>${t("אזעקה")}</dt><dd data-alarm-user-policy><system-alarm-user .userId=${o.id} ?canEdit=${!this.busy}></system-alarm-user></dd>`:c}
                  </dl>
                  <div class="sec">${t("שיוכים")}</div>
                  ${o.bindings.length?o.bindings.map(p=>this.renderBindingRow(p,s)):a`<div class="hint">${t("ללא שיוך: אין גישה לתוכן.")}</div>`}
                  <div class="hint">${t("אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.")}</div>`}
              <div slot="footer" class="dfoot">
                ${this.wizard?a`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${()=>this.saveWizard()}>${t("שמור שיוך")}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>${t("ביטול")}</sw-button>`:a`${s&&!(e.delegated&&o.is_self)?a`<sw-button variant="primary" size="sm" icon="plus" data-assign @click=${()=>this.startWizard("user",o.id,o.name)}>${t("שיוך תפקיד")}</sw-button>`:c}
                    <sw-button variant="ghost" size="sm" icon="shield" data-user-effective @click=${()=>{this.previewUser=o.id,this.selected=null,this.setTab("effective"),this.runPreview()}}>${t("הרשאות אפקטיביות")}</sw-button>`}
              </div>
            </sw-drawer>`:c}
      </div>
    `}renderGroupsApi(){const e=this.groups??[],s=this.directory,i=s.can_assign,r=[{key:"name",label:t("קבוצה"),render:g=>a`<strong>${String(g.name)}</strong>`},{key:"members",label:t("חברים"),render:g=>a`${g.members.length}`},{key:"bindings",label:t("שיוכים (תפקיד · היקף)"),render:g=>a`${g.bindings.map(E=>a`<div style="font-size:var(--sw-fs-xs)">${E.role_name} · ${E.scope_name}${E.effect==="deny"?a` <span data-binding-deny style="color:var(--sw-danger-text);font-weight:var(--sw-fw-semibold)">· ${t("חסימה")}</span>`:c}</div>`)}`}],n=e.find(g=>g.id===this.selectedGroup)??null,o=this.members??new Set(n?.members.map(g=>g.id)??[]),p=this.groupsMeta.can_manage,v=!!s.delegated,u=Q.me?.user.id,m=n?n.members.length>0||n.bindings.length>0:!1,N=new Set(s.users.map(g=>g.id)),$=n?n.members.filter(g=>!N.has(g.id)):[];return a`
      <sw-card heading=${t("קבוצות")} subheading=${v?t("הקבוצות שכל השיוכים שלהן בתוך ההיקף שלך · חברות ושיוך תפקידים מרשימת ההאצלה"):t("קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו · ההרשאות האפקטיביות = השיוכים האישיים + שיוכי הקבוצות, בכל היקף בנפרד")} data-groups-card>
        ${p?a`<div class="toolbar"><sw-field label=${t("קבוצה חדשה")}><input data-group-new .value=${this.newGroup} placeholder=${t("למשל: עורכי קומה 2")} @input=${g=>this.newGroup=g.target.value} @keydown=${g=>{g.key==="Enter"&&this.addGroup()}} /></sw-field><sw-button size="sm" icon="plus" data-group-create ?disabled=${this.busy||!this.newGroup.trim()} @click=${()=>this.addGroup()}>${t("יצירה")}</sw-button></div>`:a`<div class="hint">${v?t("יצירה, שינוי שם ומחיקה של קבוצות — מנהל המערכת בלבד. קבוצה שיש לה שיוך מחוץ להיקף שלך, או שאתה חבר בה, אינה מוצגת כאן."):t("יצירה, שינוי שם ומחיקה של קבוצות דורשים ניהול תפקידים (מנהל מערכת).")}</div>`}
      </sw-card>
        <div class="stage groups-stage">
          ${e.length?a`<sw-table .columns=${r} .rows=${e} .selected=${this.selectedGroup} @row-select=${g=>{this.selectedGroup=g.detail.id,this.members=null,this.wizard=null,this.renameDraft=null}}></sw-table>`:a`<sw-state-panel icon="users" state="empty" heading=${t("אין קבוצות")} hint=${v?t("אין קבוצה שכל השיוכים שלה בתוך ההיקף שלך."):t("קבוצה מקבלת תפקיד בהיקף, וכל חבריה יורשים אותו. קבוצות Arx בלבד, לא קבוצות HA.")}></sw-state-panel>`}
          ${n?a`<sw-drawer open modal heading=${n.name} subheading=${`${t("{n} חברים",{n:n.members.length})} · ${t("{n} שיוכים",{n:n.bindings.length})} · ${t("רוויזיה {n}",{n:n.revision})}`} data-group-drawer @close=${()=>{this.selectedGroup=null,this.members=null,this.wizard=null,this.renameDraft=null}}>
                ${this.wizard&&this.wizard.subjectKind==="group"?this.renderWizard():a`${p?a`<div class="toolbar" style="margin-block-end:8px"><sw-field label=${t("שם הקבוצה")}><input data-group-rename .value=${this.renameDraft??n.name} @input=${g=>this.renameDraft=g.target.value} @keydown=${g=>{g.key==="Enter"&&this.saveRename(n)}} /></sw-field><sw-button size="sm" data-group-rename-save ?disabled=${this.busy||this.renameDraft===null||!this.renameDraft.trim()||this.renameDraft.trim()===n.name} @click=${()=>this.saveRename(n)}>${t("שינוי שם")}</sw-button></div>`:c}
                    <div class="sec">${t("שיוכים של הקבוצה")}</div>
                    ${n.bindings.length?n.bindings.map(g=>this.renderBindingRow(g,i)):a`<div class="hint">${t("ללא שיוך: החברים אינם מקבלים דבר דרך הקבוצה.")}</div>`}
                    <div class="sec">${t("חברים")} · ${o.size}</div>
                    <div class="members in-drawer">${s.users.map(g=>a`<label><input type="checkbox" data-member=${g.id} ?disabled=${!i||v&&g.id===u} .checked=${o.has(g.id)} @change=${E=>{const F=new Set(o);E.target.checked?F.add(g.id):F.delete(g.id),this.members=F}} /> ${g.name}<span class="hint">${g.active?"":" · "+t("ללא גישה")}${v&&g.id===u?" · "+t("לא ניתן לצרף את עצמך"):""}</span></label>`)}${$.map(g=>a`<label><input type="checkbox" checked disabled /> ${g.name}<span class="hint"> · ${t("מחוץ לרשימה שלך")}</span></label>`)}</div>
                    <div class="hint">${t("שינוי חברות ושיוך נבדקים מול כל השיוכים של הקבוצה, מוצגים לפני השמירה עם ההשפעה על כל משתמש, ונרשמים באודיט.")}</div>
                    ${p&&m?a`<div class="hint" data-group-in-use>${t("מחיקה אפשרית רק לקבוצה ללא חברים וללא שיוכים — הסר אותם קודם.")}</div>`:c}`}
                <div slot="footer" class="dfoot">
                  ${this.wizard?a`<sw-button variant="primary" size="sm" icon="check" data-wizard-save ?disabled=${this.busy} @click=${()=>this.saveWizard()}>${t("שמור שיוך")}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.wizard=null}>${t("ביטול")}</sw-button>`:a`${i?a`<sw-button variant="primary" size="sm" icon="check" data-group-save-members ?disabled=${this.busy||!this.members} @click=${()=>this.saveMembers(n)}>${t("שמור חברים")}</sw-button>
                          <sw-button size="sm" icon="plus" data-group-bind ?disabled=${this.busy} @click=${()=>this.startWizard("group",n.id,n.name)}>${t("שיוך תפקיד")}</sw-button>`:c}
                      ${p?a`<sw-button variant="danger" size="sm" icon="trash" class="end" data-group-delete ?disabled=${this.busy||m} @click=${()=>this.removeGroup(n)}>${t("מחיקה")}</sw-button>`:c}`}
                </div>
                ${this.renderGroupChange()}
              </sw-drawer>`:c}
        </div>
      ${n?c:this.renderGroupChange()}
    `}renderGroupChange(){const e=this.groupChange;if(!e)return c;const s=e.impact,i=n=>s.labels[n]??this.label(n),r={member:t("חבר"),added:t("מצטרף"),removed:t("יוצא")};return a`<sw-dialog open heading=${t("השפעת השינוי")} subheading=${e.heading} data-group-impact @close=${()=>this.groupChange=null}>
      <div class="impact">
        <strong>${t("{n} משתמשים מושפעים",{n:s.users.length})}</strong>${s.scopes.length?a` · ${t("היקפים:")} ${s.scopes.map(n=>n.scope_name).join(", ")}`:a` · ${t("לקבוצה אין שיוך, ולכן השינוי אינו משנה הרשאות")}`}
      </div>
      ${s.users.length?a`<div class="members" style="margin-block-start:8px">${s.users.map(n=>a`<div class="bind" data-impact-user=${n.id}>
            <div><strong>${n.name}</strong> <sw-badge kind=${n.change==="removed"?"forbidden":"recorded"} label=${r[n.change]}></sw-badge>
              <div class="sub">${n.added.length?a`<span class="ok">${t("יתווספו:")} ${n.added.map(i).join(", ")}</span>`:t("ללא הרשאות חדשות")} · ${n.removed.length?a`<span class="err">${t("יוסרו:")} ${n.removed.map(i).join(", ")}</span>`:t("ללא הסרות")}</div></div>
          </div>`)}</div>`:a`<div class="hint" style="margin-block-start:8px">${t("אין חברים בקבוצה: אף משתמש אינו מושפע כרגע. מי שיצורף בהמשך יירש את השיוך.")}</div>`}
      <div class="hint" style="margin-block-start:8px">${t("הרשאות בתוך Arx בלבד. השינוי נרשם באודיט (מזהים בלבד) וחל מהבקשה הבאה של כל משתמש.")}</div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.groupChange=null}>${t("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-group-impact-confirm ?disabled=${this.busy} @click=${()=>this.confirmGroupChange()}>${e.confirmLabel}</sw-button>
    </sw-dialog>`}openRole(e){this.roleImpact=null;const s=new Set(this.roles?.sensitive??[]);this.roleEdit=e?{id:e.id,revision:e.revision??1,name:e.name,description:e.description??"",permissions:e.permissions.filter(i=>!s.has(i)),sensitive:e.permissions.filter(i=>s.has(i)),delegable:!!e.delegable}:{id:null,revision:0,name:"",description:"",permissions:["map.read"],sensitive:[],delegable:!1},this.scheduleImpact()}toggleRolePerm(e,s){const i=this.roleEdit;if(!i)return;const r=s?"sensitive":"permissions",n=i[r].includes(e)?i[r].filter(o=>o!==e):[...i[r],e];this.roleEdit={...i,[r]:n},this.scheduleImpact()}scheduleImpact(){window.clearTimeout(this.roleImpactTimer),this.roleImpactTimer=window.setTimeout(()=>void this.loadImpact(),300)}async loadImpact(){const e=this.roleEdit;if(!e||!e.permissions.length&&!e.sensitive.length){this.roleImpact=null;return}try{this.roleImpact=await ws({role_id:e.id,permissions:e.permissions,sensitive:e.sensitive})}catch(s){this.error=f(s)}}async saveRole(){const e=this.roleEdit;if(!(!e||!e.name.trim())){this.busy=!0,this.error="";try{const s={name:e.name.trim(),description:e.description,permissions:e.permissions,sensitive:e.sensitive,delegable:e.delegable&&!e.sensitive.length&&!e.permissions.includes("rbac.assign")};if(e.id){await vs(e.id,{...s,revision:e.revision}),this.roleEdit=null,this.roleImpact=null,this.toaster.show(t("התפקיד עודכן; השינוי חל על כל המשויכים ברענון הבא"),{ms:0}),this.roles=await V();return}const i=await $s(s);this.roleEdit=null,this.roleImpact=null,this.roles=await V();const r=Q.me?.user.id;if(e.assignMe!==!1&&r)try{await fe({subject_kind:"user",subject_id:r,role_id:i.id,scope_type:"installation",scope_id:"*"}),this.toaster.show(t('התפקיד "{name}" נוצר ושויך אליך (כל המתקן). ההרשאות החדשות ייכנסו לתוקף ברענון הבא של הדף.',{name:i.name}),{ms:0})}catch(n){this.toaster.show(t('התפקיד "{name}" נוצר, אך השיוך האוטומטי אליך נכשל ({error}). שייך אותו ידנית בלשונית "שיוכים".',{name:i.name,error:f(n)}),{ms:0})}else this.toaster.show(t('התפקיד "{name}" נוצר. שייך אותו למשתמש או לקבוצה בלשונית "שיוכים".',{name:i.name}),{ms:0})}catch(s){this.error=f(s)}finally{this.busy=!1}}}setAllRolePerms(e,s,i){const r=this.roleEdit;r&&(this.roleEdit={...r,[e]:i?[...new Set([...r[e],...s])]:r[e].filter(n=>!s.includes(n))},this.scheduleImpact())}async removeRole(e){this.busy=!0,this.error="";try{await gs(e.id),this.roleDelete=null,this.roles=await V()}catch(s){this.error=f(s),this.roleDelete=null}finally{this.busy=!1}}async toggleDelegable(e){const s=this.roles?.delegable_roles??[],i=s.includes(e)?s.filter(r=>r!==e):[...s,e];this.busy=!0,this.error="";try{await fs(i),this.roles=await V()}catch(r){this.error=f(r)}finally{this.busy=!1}}renderRoleDialog(){const e=this.roleEdit,s=this.roles;if(!e||!s)return c;const i=new Set(s.sensitive),r=new Set(s.system_permissions??[]),n=Object.keys(s.labels).filter(u=>!i.has(u)&&!r.has(u)),o=new Set(e.id?s.roles.find(u=>u.id===e.id)?.permissions??[]:[]),p=rt(nt(s.sensitive,s.legacy_permissions,o),s.system_permissions),v=this.roleImpact;return a`<sw-dialog open heading=${e.id?t("עריכת תפקיד מותאם"):t("תפקיד מותאם חדש")} subheading=${t("הרשאות רגילות + הרשאות רגישות במפורש · ללא הרשאות מערכת · ההשפעה מוצגת לפני השמירה")} data-role-dialog @close=${()=>this.roleEdit=null}>
      ${this.error?a`<div class="err banner" data-role-error>${this.error}</div>`:c}
      <sw-field label=${t("שם")}><input data-role-name .value=${e.name} @input=${u=>this.roleEdit={...e,name:u.target.value}} /></sw-field>
      <sw-field label=${t("תיאור")}><input .value=${e.description} @input=${u=>this.roleEdit={...e,description:u.target.value}} /></sw-field>
      <div class="hint permsrow">${t("הרשאות רגילות")}
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-perm-all @click=${()=>this.setAllRolePerms("permissions",n,!0)}>${t("בחר הכל")}</sw-button>
          <sw-button size="sm" variant="ghost" data-role-perm-none @click=${()=>this.setAllRolePerms("permissions",n,!1)}>${t("נקה הכל")}</sw-button>
        </span>
      </div>
      <div class="perms">${n.map(u=>a`<label class="chk"><input type="checkbox" data-role-perm=${u} .checked=${e.permissions.includes(u)} @change=${()=>this.toggleRolePerm(u,!1)} /> ${s.labels[u]}</label>`)}</div>
      <div class="hint permsrow" style="margin-block-start:6px">${t("הרשאות רגישות — לעולם לא מרומזות, נדרשות במפורש")}
        <span class="permsel">
          <sw-button size="sm" variant="ghost" data-role-sensitive-all @click=${()=>this.setAllRolePerms("sensitive",p,!0)}>${t("בחר הכל")}</sw-button>
          <sw-button size="sm" variant="ghost" data-role-sensitive-none @click=${()=>this.setAllRolePerms("sensitive",p,!1)}>${t("נקה הכל")}</sw-button>
        </span>
      </div>
      <div class="perms">${p.map(u=>a`<label class="chk sens"><input type="checkbox" data-role-sensitive=${u} .checked=${e.sensitive.includes(u)} @change=${()=>this.toggleRolePerm(u,!0)} /> ${s.labels[u]??u}</label>`)}</div>
      ${e.id?c:a`<label class="chk" style="margin-block-start:6px"><sw-toggle size="sm" labelHidden in-label label=${t("שייך את התפקיד אליי מיד (כל המתקן)")} data-role-assign-me .checked=${e.assignMe!==!1} @change=${u=>this.roleEdit={...e,assignMe:ae(u)}}></sw-toggle> ${t("שייך את התפקיד אליי מיד (כל המתקן)")}</label>`}
      <label class="chk" style="margin-block-start:6px"><sw-toggle size="sm" labelHidden in-label label=${t("מנהל אתר רשאי להקצות תפקיד זה בהיקפו (בכפוף להרשאות שהוא מחזיק)")} data-role-delegable ?disabled=${e.sensitive.length>0||e.permissions.includes("rbac.assign")} .checked=${e.delegable&&!e.sensitive.length&&!e.permissions.includes("rbac.assign")} @change=${u=>this.roleEdit={...e,delegable:ae(u)}}></sw-toggle> ${t("מנהל אתר רשאי להקצות תפקיד זה בהיקפו (בכפוף להרשאות שהוא מחזיק)")}${e.sensitive.length||e.permissions.includes("rbac.assign")?a`<span class="hint"> · ${t("לא זמין: תפקיד עם הרשאה רגישה או עם שיוך תפקידים אינו ניתן להאצלה")}</span>`:c}</label>
      ${v?a`<div class="impact" data-role-impact>
            <strong>${t("השפעת השינוי:")}</strong> ${t("{n} שיוכים",{n:v.bindings})} · ${t("{n} משתמשים",{n:v.users.length})}${v.users.length?` (${v.users.map(u=>u.name).join(", ")})`:""}${v.groups.length?` · ${t("{n} קבוצות",{n:v.groups.length})}`:""}${v.scopes.length?` · ${t("היקפים:")} ${v.scopes.join(", ")}`:""}
            <div>${v.added.length?a`${t("יתווספו:")} ${v.added.map(u=>s.labels[u]??u).join(", ")}`:t("ללא הרשאות חדשות")} · ${v.removed.length?a`<span class="err">${t("יוסרו:")} ${v.removed.map(u=>s.labels[u]??u).join(", ")}</span>`:t("ללא הסרות")}</div>
          </div>`:c}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.roleEdit=null}>${t("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-role-save ?disabled=${this.busy||!e.name.trim()||!e.permissions.length&&!e.sensitive.length} @click=${()=>this.saveRole()}>${e.id?t("שמירה"):t("צור תפקיד")}</sw-button>
    </sw-dialog>`}renderRolesApi(){const e=this.roles;return a`<div class="roles">${e.roles.map(s=>a`<sw-card class="role" data-role-card=${s.id}><h4><span class="ic"><sw-icon name=${s.custom?"user":s.id==="viewer"?"eye":s.id==="operator"?"play":s.id==="editor"?"edit":s.id==="site_admin"?"building":s.id==="kiosk"?"grid":"shield"} size=${14}></sw-icon></span>${s.name}${s.custom?a` <sw-badge kind="recorded" label=${t("מותאם")}></sw-badge>`:c}${s.system_role?a` <sw-badge kind="neutral" label=${t("הרשאות מערכת")}></sw-badge>`:c}${s.delegable?a` <sw-badge kind="historic" label=${t("ניתן להאצלה")}></sw-badge>`:c}</h4>${s.description?a`<div class="desc">${s.description}</div>`:c}<div class="a">${t("מותר:")} ${s.permissions.map(i=>this.label(i)).join(", ")}</div><div class="d">${t("לא כלול אוטומטית:")} ${s.sensitive_missing.map(i=>this.label(i)).join(", ")||"—"}</div>${C("system.configure")?a`<div class="pol" data-second-factor-policy-role>${oe("secondFactor.overrideLabel")}<sw-second-factor-policy kind="role" .subjectId=${s.id}></sw-second-factor-policy></div>`:c}${s.custom&&e.can_manage_roles?a`<div class="acts"><sw-button size="sm" data-role-edit @click=${()=>this.openRole(s)}>${t("עריכה")}</sw-button><sw-button size="sm" variant="ghost" icon="trash" data-role-delete @click=${()=>this.roleDelete=s}>${t("מחיקה")}</sw-button></div>`:c}</sw-card>`)}</div>
      ${e.can_manage_roles?a`<div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" data-role-new @click=${()=>this.openRole()}>${t("תפקיד מותאם חדש")}</sw-button></div>
            <sw-card heading=${t("האצלת שיוך תפקידים למנהלי אתר")} subheading=${t("מנהל אתר משייך רק תפקידים מהרשימה הזו, רק הרשאות שהוא מחזיק בעצמו, רק בתוך ההיקף שלו, ולעולם לא לעצמו; קבוצה — רק כשכל השיוכים שלה בהיקף שלו")} style="margin-block-start:12px" data-delegation>
              <div class="chips">${e.roles.filter(s=>!s.delegation_block).map(s=>a`<sw-chip data-delegable=${s.id} ?selected=${(e.delegable_roles??[]).includes(s.id)} @click=${()=>void this.toggleDelegable(s.id)}>${s.name}</sw-chip>`)}</div>
              <div class="hint" style="margin-block-start:6px" data-delegation-blocked>${t("לעולם לא ניתנים להאצלה:")} ${e.roles.filter(s=>s.delegation_block).map(s=>`${s.name} (${s.delegation_block==="system_role"?t("תפקיד ניהול / הרשאות מערכת"):s.delegation_block==="assign_role"?t("כולל שיוך תפקידים"):t("הרשאה רגישה")})`).join(" · ")||"—"}. ${t("ברירת המחדל: צופה ומפעיל.")}</div>
            </sw-card>`:e.delegated?a`<div class="hint" style="margin-block-start:10px" data-delegation>${t("מוצגים רק התפקידים שמותר לך לשייך בהיקף שלך (רשימת ההאצלה של ההתקנה). עריכת תפקידים והרשימה — מנהל המערכת בלבד.")}</div>`:c}
      <div class="hint">${t("תפקידים מובנים אינם נערכים; תפקיד מותאם מורכב מהרשאות רגילות ומהרשאות רגישות שניתנות במפורש, ולעולם לא מהרשאות מערכת. התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.")}</div>
      <elec-permission-rows .roles=${e}></elec-permission-rows>
      ${this.renderRoleDialog()}
      ${this.roleDelete?a`<sw-dialog open heading=${t("מחיקת תפקיד")} subheading=${this.roleDelete.name} @close=${()=>this.roleDelete=null}>
            <div class="hint">${t("תפקיד משויך אינו נמחק: בטל קודם את השיוכים. המחיקה נרשמת באודיט.")}</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.roleDelete=null}>${t("ביטול")}</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-role-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeRole(this.roleDelete)}>${t("מחק")}</sw-button>
          </sw-dialog>`:c}`}doorPermissionNote(e){const s=As(e,C("system.configure"));return s?a`<div class="hint" style="margin-block-start:12px" data-effective-door-note>${s.text}${s.link?a` <a data-effective-door-link href=${s.link.href}>${s.link.label}</a>`:c}</div>`:c}renderEffectiveApi(){const e=this.directory,s=this.preview;return a`
      <div class="toolbar">
        <sw-field label=${t("משתמש")}><select @change=${i=>this.previewUser=i.target.value}>${e.users.map(i=>a`<option value=${i.id} ?selected=${i.id===this.previewUser}>${i.name}</option>`)}</select></sw-field>
        <sw-field label=${t("היקף")}><select @change=${i=>this.previewScope=i.target.value}>${this.scopeOptions.map(i=>a`<option value=${`${i.type}:${i.id}`} ?selected=${`${i.type}:${i.id}`===this.previewScope}>${i.name}</option>`)}</select></sw-field>
        <sw-button variant="primary" icon="shield" data-effective-run ?disabled=${this.busy||!this.previewUser} @click=${()=>this.runPreview()}>${t("חשב")}</sw-button>
      </div>
      ${s?a`<sw-card heading=${`${this.userName(s.user_id)} · ${s.scope_name}`} subheading=${s.active?t("רוויזיה {n}",{n:s.revision}):t("המשתמש ללא גישה (מושבת או נמחק ב־HA)")}>
            <div class="eff">
              <div><div class="sec">${t("מותר בהיקף")}</div>${s.allowed.length?s.allowed.map(i=>a`<div class="row"><span>${this.label(i)}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`):a`<div class="row"><span>${t("כלום")}</span></div>`}</div>
              <div><div class="sec">${t("מחוץ להיקף / לא מוקנה")}</div>${s.denied.map(i=>a`<div class="row"><span>${this.label(i)}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}</div>
            </div>
            ${this.doorPermissionNote(s.allowed)}
            ${s.bindings.length?a`<div class="sec">${t("שיוכים שנלקחו בחשבון")}</div>${s.bindings.map(i=>a`<div class="bind"><div>${i.role_name} · ${i.scope_name}${i.via_group?` (${t('קבוצה "{name}"',{name:i.via_group})})`:""}</div></div>`)}`:c}
            <div class="hint" style="margin-block-start:12px">${t("תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו; החישוב נעשה בצד השרת.")}</div>
          </sw-card>`:a`<sw-state-panel icon="shield" state="empty" heading=${t("בחר משתמש והיקף")} hint=${t("החישוב מראה מה מותר ומה לא למשתמש בהיקף שנבחר, לפי השיוכים האישיים ושיוכי הקבוצות.")} data-effective-idle></sw-state-panel>`}
    `}renderAuditApi(){if(!this.audit)return this.loadAudit(),a`<sw-state-panel state="loading"></sw-state-panel>`;const e=[{key:"at",label:t("זמן"),render:s=>a`<span style="font-size:var(--sw-fs-xs)">${S(String(s.at))}</span>`},{key:"actor_username",label:t("מבצע"),render:s=>a`${String(s.actor_username??t("מערכת / HA"))}`},{key:"action",label:t("פעולה"),render:s=>a`${bs[String(s.action)]??String(s.action)}`},{key:"resource_id",label:t("משאב"),render:s=>a`${s.resource_type==="user"?this.userName(String(s.resource_id)):s.resource_type==="group"?this.groups?.find(i=>i.id===s.resource_id)?.name??String(s.resource_id):String(s.resource_id??"")}`},{key:"decision",label:t("החלטה"),render:s=>a`<sw-badge kind=${s.decision==="denied"?"forbidden":"live"} label=${s.decision==="denied"?`${t("נחסם")}${s.reason?` · ${String(s.reason)}`:""}`:t("הותר")}></sw-badge>`},{key:"details",label:t("פרטים"),render:s=>{const i=s.details,r=[i.role_id?`${String(i.role_id)}`:"",i.scope?String(i.scope):"",Array.isArray(i.added)&&i.added.length?`+${i.added.length}`:"",Array.isArray(i.removed)&&i.removed.length?`−${i.removed.length}`:"",i.revision?`rev ${String(i.revision)}`:""].filter(Boolean);return a`<span style="font-size:var(--sw-fs-xs);direction:ltr;unicode-bidi:isolate">${r.join(" · ")}</span>`}}];return a`<sw-lookup-scope></sw-lookup-scope>${this.audit.length?a`<sw-table dense .columns=${e} .rows=${this.audit} rowKey="at"></sw-table>`:a`<sw-state-panel icon="users" state="empty" heading=${t("אין רשומות אודיט הרשאות")} hint=${t("כל שיוך, ביטול, קבוצה או שינוי מצב משתמש יופיע כאן.")}></sw-state-panel>`}`}renderApi(){if(this.forbidden)return a`<sw-page heading=${t("משתמשים והרשאות")}><sw-state-panel state="forbidden" hint=${t("צפייה בספריית המשתמשים דורשת תפקיד מנהל מערכת.")}></sw-state-panel></sw-page>`;if(this.error&&!this.directory)return a`<sw-page heading=${t("משתמשים והרשאות")}><sw-state-panel state="error" hint=${this.error} actionLabel=${t("נסה שוב")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!this.directory||!this.roles)return a`<sw-page heading=${t("משתמשים והרשאות")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.directory,s=[{id:"users",label:t("משתמשים"),count:e.users.length},{id:"groups",label:t("קבוצות"),count:this.groups?.length??0},{id:"roles",label:t("תפקידים"),count:this.roles.roles.length},{id:"effective",label:t("הרשאות אפקטיביות")},...!e.delegated||e.assignable_roles?.includes("door_opener")?[{id:"doors",label:t("פתיחת דלתות")}]:[],...e.delegated&&!this.groupsMeta.can_manage?[]:[{id:"audit",label:t("אודיט הרשאות")}],...C("users.ha_manage")?[{id:"ha-users",label:w("tab")}]:[],...C("identity.directory.read")?[{id:"local",label:l("tab")}]:[],...C("rbac.assign")?[{id:"home",label:t("ממשק ביתי")}]:[]],i=e.delegated&&!this.groupsMeta.can_manage?`${t("מנהל אתר · שיוך תפקידים מרשימת ההאצלה בתוך ההיקף שלך בלבד")} · ${t("{n} משתמשים פעילים",{n:e.users.length})} · ${t("רוויזיית הרשאות {n}",{n:e.revision})}`:e.directory.paired?`${t("זהות מ־Home Assistant")} · ${t("{n} משתמשים בספרייה",{n:e.directory.users})} · ${t("עודכן {time}",{time:S(e.directory.last_directory_at)})} · ${t("רוויזיית הרשאות {n}",{n:e.revision})}`:t("זהות מ־Home Assistant · הגשר עדיין לא מצומד: מוצגים רק משתמשים שנכנסו דרך Ingress");return a`
      <sw-page heading=${t("משתמשים והרשאות")} subheading=${i}>
        ${e.delegated?c:a`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.sync()}>${t("סנכרון משתמשים מ־HA")}</sw-button>`}
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props("").variant} ?adaptive=${this.tabsMode.props("").adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label=${t("הרשאות")} .items=${s} .active=${this.tab} @change=${r=>this.setTab(r.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>${t("שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות.")} ${C("users.ha_manage")?t('משתמש חדש נוצר בלשונית "משתמשי מערכת הבית" (תמיד כמשתמש רגיל) או במסך של מערכת הבית.'):t('אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.')}</div>
        ${this.message||this.error?a`<div class="bar">${this.message?a`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:c}${this.error?a`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:c}</div>`:c}
        ${this.tab==="users"?this.renderUsersApi():this.tab==="groups"?this.renderGroupsApi():this.tab==="roles"?this.renderRolesApi():this.tab==="effective"?this.renderEffectiveApi():this.tab==="doors"?a`<sw-door-grants data-door-grants></sw-door-grants>`:this.tab==="ha-users"?a`<sw-ha-users data-ha-users-tab></sw-ha-users>`:this.tab==="home"?a`<sw-home-admin data-home-admin-tab></sw-home-admin>`:this.tab==="local"?a`<system-local-users data-local-users-tab .roles=${ve(this.roles.roles)} .scopes=${this.scopeOptions}></system-local-users>`:this.renderAuditApi()}
      </sw-page>
    `}renderUsers(){const e=me.find(s=>s.id===this.selected);return a`
      <div class="stage">
        <sw-table .columns=${this.userColumns} .rows=${me} .selected=${this.selected} @row-select=${s=>{this.selected=s.detail.id,this.assigning=!1}}></sw-table>
        ${e?a`<sw-drawer open heading=${e.name} subheading=${`HA: ${e.haUser} · ${e.active?t("פעיל"):t("מושבת")}`} @close=${()=>this.selected=null}>
              ${this.assigning?a`<div class="wiz">
                    <sw-steps .steps=${[t("תפקיד"),t("היקף"),t("תצוגה מקדימה"),t("שמירה")]} .current=${this.step}></sw-steps>
                    <sw-field label=${t("קבוצה או תפקיד")}><select><option>${t("עורך מפות ותצוגות")}</option><option>${t("מפעיל")}</option><option>${t("צופה")}</option><option>${t("מנהל אתר/מבנה/קומה")}</option></select></sw-field>
                    <sw-field label=${t("היקף")}><select><option>${t("מבנה א · קומה 2")}</option><option>${t("מבנה א")}</option><option>${t("אתר הדגמה")}</option></select></sw-field>
                    <div class="eff">
                      <div><div class="sec">${t("מותר בהיקף")}</div><div class="row"><span>${t("עריכת תוכנית קומה 2")}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div><div class="row"><span>${t("הצבת ציוד מורשה")}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div></div>
                      <div><div class="sec">${t("לא ניתן")}</div><div class="row"><span>${t("עריכת קומה 3")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>${t("ניהול משתמשים / NVR")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div><div class="row"><span>${t("פתיחת מנעול")}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div></div>
                    </div>
                    <div class="hint">${t("הרשאות בתוך Arx בלבד. שום דבר לא נכתב ל־HA. השינוי ירשם באודיט עם diff לפני/אחרי.")}</div>
                  </div>`:a`<dl>
                    <dt>${t("מקור זהות")}</dt><dd>Home Assistant · <span class="ltr">${e.haUser}</span></dd>
                    <dt>${t("סנכרון אחרון")}</dt><dd>${e.lastSync}</dd>
                    <dt>${t("קבוצות")}</dt><dd>${e.groups.join(", ")||"—"}</dd>
                    <dt>${t("שיוכים")}</dt><dd>${e.bindings.length?e.bindings.map(s=>a`<div>${s.role} · ${s.scope}</div>`):t("ללא: אין גישה לתוכן")}</dd>
                  </dl>
                  <div class="hint">${t("אין כפתור לשינוי סיסמת HA או להפיכה למנהל HA. מנהל HA אינו מקבל תפקיד במערכת אוטומטית.")}</div>`}
              <div slot="footer" class="dfoot">
                ${this.assigning?a`<sw-button variant="primary" size="sm" icon="check">${t("שמור שיוך")}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.assigning=!1}>${t("ביטול")}</sw-button>`:a`<sw-button variant="primary" size="sm" icon="plus" @click=${()=>{this.assigning=!0,this.step=2}}>${t("שיוך תפקיד")}</sw-button><sw-button variant="ghost" size="sm" icon="shield">${t("הרשאות אפקטיביות")}</sw-button>`}
              </div>
            </sw-drawer>`:""}
      </div>
    `}renderGroups(){const e=[{key:"name",label:t("קבוצה"),render:s=>a`<strong>${String(s.name)}</strong>`},{key:"members",label:t("חברים")},{key:"bindings",label:t("שיוכים (תפקיד · היקף)"),render:s=>a`${s.bindings.map(i=>a`<div>${i}</div>`)}`},{key:"more",label:"",width:"40px",render:()=>a`<sw-button variant="ghost" size="sm" iconOnly icon="more" label=${t("עוד")}></sw-button>`}];return a`<sw-table .columns=${e} .rows=${Oe}></sw-table><div class="hint">${t("שיוך חבר לקבוצה מציג את כל ה־bindings שלה: קבוצה בשני אתרים אינה ניתנת לניהול בידי מי שקיבל האצלה לקומה אחת.")}</div>`}renderRoles(){return a`<div class="roles">${Le.map(e=>a`<sw-card class="role"><h4><span class="ic"><sw-icon name=${e.id==="viewer"?"eye":e.id==="operator"?"play":e.id==="editor"?"edit":e.id==="site_admin"?"building":"shield"} size=${14}></sw-icon></span>${e.name}</h4><div class="a">${t("מותר:")} ${e.allowed}</div><div class="d">${t("לא ניתן אוטומטית:")} ${e.denied}</div></sw-card>`)}</div><div class="hint">${t("תפקידים מובנים בפיילוט; תפקידים מותאמים והאצלה מקומית ב־V1 (T082). התפקידים אינם סולם: עריכת מפה והיסטוריית וידאו הן יכולות נפרדות.")}</div>`}renderEffective(){return a`
      <sw-card heading=${t("דנה · עורכת קומה 2")}>
        <div class="eff">
          <div>
            <div class="sec">${t("מבנה א · קומה 2")}</div>
            ${[t("מפה: קריאה"),t("תוכנית: יבוא/עריכה/פרסום"),t("מיקומים ותצוגות: עריכה"),t("שידור חי: מצלמות מורשות")].map(e=>a`<div class="row"><span>${e}</span><sw-icon name="check" size=${14} style="color:var(--sw-live)"></sw-icon></div>`)}
          </div>
          <div>
            <div class="sec">${t("מחוץ להיקף / לא מוקנה")}</div>
            ${[t("קומה 3: הכל"),t("Playback וייצוא"),t("ניהול משתמשים"),t("הגדרות NVR / go2rtc"),t("פתיחת מנעול")].map(e=>a`<div class="row"><span>${e}</span><sw-icon name="close" size=${14} style="color:var(--sw-danger)"></sw-icon></div>`)}
          </div>
        </div>
        <div class="hint" style="margin-block-start:8px">${t("תצוגה זו אינה מתחזה למשתמש ואינה מאפשרת לעקוף את הגישה שלו. permission_revision: 7.")}</div>
      </sw-card>
    `}renderAudit(){const e=[{key:"time",label:t("זמן")},{key:"user",label:t("משתמש"),render:s=>a`<div class="who"><sw-avatar name=${String(s.user)} size=${24}></sw-avatar>${String(s.user)}</div>`},{key:"action",label:t("פעולה")},{key:"resource",label:t("משאב")},{key:"decision",label:t("החלטה"),render:s=>a`<sw-badge kind=${String(s.decision).startsWith("נחסם")?"forbidden":"live"} label=${String(s.decision)}></sw-badge>`},{key:"role",label:t("תפקיד/היקף ששימשו")}];return a`<sw-table dense .columns=${e} .rows=${es.filter(s=>s.action.includes("תוכנית")||s.action.includes("סנכרון")||s.action.includes("Ingress"))}></sw-table>`}render(){return L()?this.renderApi():a`
      <sw-page heading=${t("משתמשים והרשאות")} subheading=${t("זהות מ־Home Assistant · הרשאות בתוך Arx בלבד · נתוני הדגמה")}>
        <sw-button slot="actions" icon="refresh">${t("סנכרון משתמשים מ־HA")}</sw-button>
        <sw-tabs data-access-tabs .variant=${this.tabsMode.props("").variant} ?adaptive=${this.tabsMode.props("").adaptive} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label=${t("הרשאות")} .items=${[...Ae,{id:"ha-users",label:w("tab")}]} .active=${this.tab} @change=${e=>this.setTab(e.detail.id)}></sw-tabs>
        <div class="notice"><sw-icon name="shield" size=${14}></sw-icon>${t("שיוך כאן אינו משנה דבר ב־Home Assistant: לא קבוצות HA, לא דגל מנהל, לא סיסמאות.")} ${C("users.ha_manage")?t('משתמש חדש נוצר בלשונית "משתמשי מערכת הבית" (תמיד כמשתמש רגיל) או במסך של מערכת הבית.'):t('אין "הוספת משתמש" — משתמשים נוצרים ב־HA בלבד.')}</div>
        ${this.tab==="users"?this.renderUsers():this.tab==="groups"?this.renderGroups():this.tab==="roles"?this.renderRoles():this.tab==="effective"?this.renderEffective():this.tab==="ha-users"?a`<sw-ha-users data-ha-users-tab></sw-ha-users>`:this.renderAudit()}
      </sw-page>
    `}};y.styles=[Ue,q`
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
    ${ss}
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
    ${Ee}
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-wrap: wrap;
    }
  `,Me];k([h()],y.prototype,"tab",2);k([h()],y.prototype,"selected",2);k([h()],y.prototype,"assigning",2);k([h()],y.prototype,"step",2);k([h()],y.prototype,"directory",2);k([h()],y.prototype,"roles",2);k([h()],y.prototype,"groups",2);k([h()],y.prototype,"tree",2);k([h()],y.prototype,"audit",2);k([h()],y.prototype,"selectedGroup",2);k([h()],y.prototype,"wizard",2);k([h()],y.prototype,"members",2);k([h()],y.prototype,"newGroup",2);k([h()],y.prototype,"preview",2);k([h()],y.prototype,"previewUser",2);k([h()],y.prototype,"previewScope",2);k([h()],y.prototype,"busy",2);k([h()],y.prototype,"error",2);k([h()],y.prototype,"forbidden",2);k([h()],y.prototype,"roleEdit",2);k([h()],y.prototype,"roleImpact",2);k([h()],y.prototype,"roleDelete",2);k([h()],y.prototype,"groupsMeta",2);k([h()],y.prototype,"renameDraft",2);k([h()],y.prototype,"groupChange",2);k([h()],y.prototype,"remoteOff",2);k([h()],y.prototype,"narrow",2);y=k([W("system-access")],y);export{y as SystemAccess};
