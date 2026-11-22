const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{L as ye,_ as N}from"./sw-logo-art-PLtEZJxU.js";import{cC as Ps,bG as us,bH as Ds,cE as ge,b5 as Z,br as Hs,bm as z,bn as ma,bW as ks,bt as xs,cv as S,bs as Da,aU as as,g as I,j as c,i as F,aL as ts,AF as ke,AG as Ha,a2 as b,dN as is,AH as xe,AI as _e,AJ as js,AK as Ia,AL as Se,kq as O,dL as C,dE as p,n as g,AM as Fa,AN as Wa,b as i,AO as ja,AP as Va,cp as Ua,A as o,k as W,bU as hs,c0 as Ka,eD as v,AQ as j,AR as qa,AS as Vs,AT as Us,AU as wa,AV as Ga,AW as Ee,AX as Ss,AY as Ya,AZ as Qa,A_ as Ja,A$ as Xa,ey as l,B0 as Za,mw as pe,pE as P,B1 as Ks,B2 as qs,B3 as st,B4 as et,B5 as at,B6 as tt,B7 as Le,B8 as ze,B9 as it,aK as nt,ax as rt,eC as _s,Ba as ga,Bb as os,Bc as lt,Bd as Ts,Be as Ce,Bf as Be,Bg as gs,Bh as Es,Bi as ot,Bj as ue,Bk as he,Bl as dt,Bm as ct,Bn as V,Bo as Ae,gx as Oe,Bp as pt,Bq as Te,Br as Re,Bs as ut,Bt as Gs,Bu as Ne,gw as vs,Bv as ht,Bw as Ys,gy as Qs,Bx as Me,By as bt,Bz as mt,BA as Pe,BB as De,BC as Ls,BD as wt,BE as He,BF as gt,BG as vt,BH as Ie,c$ as ft,BI as $t,ac as ls,a7 as yt,BJ as Fe,aa as va,ca as Js,BK as kt,BL as xt,ai as y,BM as We,bY as _t,bu as St,nH as Rs,aA as M,BN as Xs,BO as ds,BP as Et,BQ as Lt,BR as zt,BS as Ct,BT as Bt,BU as At,BV as Ot,BW as Tt,dH as Rt,fn as Nt,BX as Ns,BY as Mt,BZ as je,B_ as fs,B$ as Pt,C0 as Ve,C1 as Ue,C2 as Dt,C3 as Zs,em as Ht,C4 as It,h as Ft,cI as Wt,R as jt,gt as zs,C5 as Vt,C6 as Ut,C7 as Kt,mn as se,C8 as qt,C9 as Gt,Ca as Yt,aS as Q,Y as Qt,Cb as Jt,t6 as Xt,Cc as Zt,Cd as si,Ce as ei,Cf as ai,Cg as ti,Ch as ii,bJ as Ke,Ci as ni,Cj as ri,Ck as ee,Cl as ae,Cm as qe,bI as li,Cn as oi,Co as Ge,eO as te,d as Ye,s8 as Qe,sd as Je,Cp as di,Cq as ci,Cr as pi,Cs as ui,Ct as hi,a3 as bi,s as Xe,nz as mi,nJ as wi,Cu as gi,Cv as vi,Cw as fi,Cx as $i,Cy as Ze,Cz as yi,m7 as ki,fp as xi,a as sa,aI as _i}from"./index-HShv8nD9.js";import{s as Si,u as Ei}from"./static-B3vucD8b.js";import{h as Is,i as fa,j as ve,e as Li,k as $a,l as ya,m as ka,s as Fs}from"./settings-Bm1Ps2Kg.js";import{i as ea,s as zi}from"./long-lists-D8RLwZUP.js";import{a as Ci,r as Bi}from"./skins-Dc_tytIV.js";import{s as Ai}from"./ha-sync-status-BiunByuh.js";import{Q as Oi,b as Ti,c as Ri,d as Ni,m as Mi,O as Pi,o as Di}from"./quality-mode-BBhfVR9j.js";import{R as Hi}from"./quality-ladder-DvW92bvh.js";import{l as Ii,s as Fi}from"./plan-quality-CeINhsIg.js";import{p as Wi}from"./plan-view-DTHjWNE-.js";import{W as ji,e as Vi,w as aa,f as Ui}from"./wall-phone-bar-45wcsUVP.js";import{c as ta}from"./safe-storage-BOOiiGOc.js";const be={label:"חיפוש בפינה העליונה",hint:"כבוי כברירת מחדל: חיפוש מאפשר להגיע למקומות שלא בטוח שרוצים שמשתמש יגיע אליהם. מנהל מערכת תמיד יכול כשהוא פעיל.",off:"כבוי (ברירת מחדל)",admins:"למנהלי מערכת בלבד",roles:"למנהלי מערכת ולתפקידים שנבחרו",all:"לכל המשתמשים",rolesTitle:"התפקידים שרואים את החיפוש"},xa=us("en","i18n/search-access","en");function ia(s){return(Ps(["en"])==="en"?xa[s]:be[s])??be[s]}Ds("i18n/search-access",{he:be,en:xa});const Ki=["off","admins","roles","all"];function qi(s){return[...new Set(String(s??"").split(",").map(e=>e.trim()).filter(Boolean))]}function Br(s,e,t){const n=new Set(s);return t?n.add(e):n.delete(e),[...n]}function Gi(s){return Ki.includes(s)?s:"off"}const fe={createLabel:"סיסמת גיבוי",createHint:"מצפינה את סיסמאות החשבונות המקומיים בתוך הגיבוי. בלי סיסמה הן לא נכללות בגיבוי. שמרו אותה במקום בטוח: בלעדיה אי אפשר לשחזר אותן.",createPlaceholder:"לפחות {n} תווים (אופציונלי)",minLabel:"אורך מינימלי לסיסמת גיבוי",minHint:"בין 8 ל־64 תווים. חל על גיבויים חדשים; גיבוי קיים נפתח בסיסמה שלו",minSaved:"האורך המינימלי נשמר",minRange:"ערך בין 8 ל־64",createdEncrypted:"סיסמאות החשבונות המקומיים מוצפנות בגיבוי",createdOmitted:"הגיבוי נוצר בלי סיסמאות החשבונות המקומיים",badgeEncrypted:"מוצפן",badgeOmitted:"בלי סיסמאות",badgeLegacy:"גיבוי ישן",restoreLabel:"סיסמת הגיבוי",restoreHint:"הגיבוי מכיל {n} סיסמאות מוצפנות של חשבונות מקומיים",restoreSkip:"שחזור בלי סיסמאות החשבונות המקומיים",restoreSkipHint:"חשבון מקומי שאין לו סיסמה בהתקנה הזו יצטרך קישור איפוס ממנהל",restoreOmitted:"הגיבוי נוצר בלי סיסמת גיבוי: סיסמאות החשבונות המקומיים לא נכללו בו",restoreLegacy:"גיבוי מגרסה ישנה: סיסמאות החשבונות המקומיים שמורות בו בלי הצפנה. שמרו את הקובץ במקום מוגן או מחקו אותו אחרי השחזור.",resultNeedReset:"{n} חשבונות מקומיים צריכים קישור איפוס סיסמה"},_a=us("en","i18n/backup-password","en"),Sa=us("ar","i18n/backup-password","ar"),Ea=us("ru","i18n/backup-password","ru");function Yi(){return Ps(["en","ar","ru"])}const Qi={he:fe,en:_a,ar:Sa,ru:Ea},Ji=["ar","ru"];function k(s,e,t=Yi()){const n=Qi[t][s]??fe[s]??s;return ge(n,e)}Ds("i18n/backup-password",{he:fe,en:_a,ar:Sa,ru:Ea},Ji);const Ws={open:"שחזור מעותק",title:"שחזור מעותק מחוץ למכונה",loading:"טוען רשימת עותקים…",none:"אין עותקים ביעד הזה",pick:"בחרו עותק (מוצגים החדשים ביותר)",newest:"החדש ביותר",prepare:"הורדה ואימות",preparing:"מוריד ומפענח…",verified:"העותק הורד, פוענח ונבדק. עדיין לא שונה דבר במערכת.",summary_version:"גרסת היישום",summary_schema:"גרסת מבנה הנתונים",summary_tables:"טבלאות / קבצים",summary_key:"מפתח הצפנה",warnDestructive:"השחזור מחליף את הפרויקט הנוכחי בתוכן העותק. לפני כן נכתב גיבוי ביטחון מקומי, שאפשר לשחזר ממנו.",includeAccess:"לשחזר גם משתמשים והרשאות",password:"סיסמת הגיבוי (לחלק המוצפן של העותק)",skipSensitive:"לשחזר בלי הסיסמאות של החשבונות המקומיים",confirmHint:"לאישור הקלידו RESTORE",restore:"שחזור",restoring:"משחזר…",cancel:"ביטול",done:"שוחזר מ־{name}: {n} טבלאות, {files} קבצים. גיבוי הביטחון: {safety}. מומלץ לרענן את המסך.",err_key_missing:"אין מפתח הצפנה במערכת הזו. יש לייבא את המפתח שיוצא (ייבוא מפתח) ולנסות שוב.",err_key_mismatch:"העותק הוצפן במפתח שאינו מותקן כאן. יש לייבא את המפתח הנכון.",err_sealed_damaged:"העותק פגום או שונה. נסו עותק אחר.",err_sealed_invalid:"הקובץ אינו עותק מוצפן של Arx.",err_archive_invalid:"הארכיון שבתוך העותק אינו תקין.",err_schema_newer:"העותק חדש מהגרסה המותקנת. יש לעדכן את התוסף ואז לנסות שוב.",err_disk_insufficient:"אין מספיק מקום פנוי בדיסק.",err_object_missing:"העותק לא נמצא ביעד.",err_stage_missing:"ההכנה פגה. יש להוריד ולאמת מחדש.",err_stage_changed:"הקובץ המוכן השתנה. יש להכין מחדש.",err_safety_failed:"גיבוי הביטחון לא נכתב, ולכן השחזור לא התחיל.",err_destination_unavailable:"היעד לא זמין.",err_push_running:"העברה אחרת רצה כרגע.",err_other:"הפעולה נדחתה.",safetyPassword:"סיסמה לגיבוי הביטחון",safetyHint:"אופציונלי. בלעדיה גיבוי הביטחון נשמר בלי סיסמאות החשבונות המקומיים",safetyPlaceholder:"לפחות {n} תווים",safetyOff:"גיבוי הביטחון לפני שחזור כבוי בהגדרות: השחזור לא ישאיר נקודת חזרה.",localSafety:"גיבוי ביטחון לפני שחזור",localSafetyHint:"לפני כל שחזור נשמר גיבוי של המצב הנוכחי (שלושת האחרונים נשמרים)",scopeDefault:"שחזור מעותק כולל משתמשים והרשאות",scopeDefaultHint:"הבחירה ההתחלתית בחלון השחזור; אפשר לשנות בכל שחזור",saved:"ההגדרה נשמרה",localScope:"שחזור מגיבוי כולל משתמשים והרשאות",localScopeHint:"הבחירה ההתחלתית בחלון השחזור; ההרשאות שלך נשמרות בכל מקרה",accessLabel:"כולל משתמשים והרשאות",accessHint:"ההרשאות שלך נשמרות בכל מקרה. ברירת המחדל נקבעת בהגדרות הגיבוי.",safetyDone:"גיבוי הביטחון: {safety}",err_safety_password_weak:"הסיסמה לגיבוי הביטחון צריכה לפחות {n} תווים.",err_safety_password_too_long:"הסיסמה לגיבוי הביטחון ארוכה מדי."},La=us("en","i18n/backup-offbox-restore","en"),Xi={he:Ws,en:La};function $e(){return Ps(["en"])}function _(s,e,t=$e()){const n=Xi[t][s]??Ws[s]??s;return ge(n,e)}function Zi(s,e=$e(),t){const n=`err_${s??""}`;return n in Ws?_(n,t,e):_("err_other",void 0,e)}function sn(s,e,t=$e()){const n=typeof e?.min_chars=="number"?e.min_chars:12;return Zi(s,t,{n})}Ds("i18n/backup-offbox-restore",{he:Ws,en:La});const Ar={s3:["endpoint","bucket","region","prefix","path_style"],sftp:["host","port","username","remote_dir","host_key"],gdrive:["client_id","folder_name","prune_mode","chunk_mib","quota_margin_pct","min_free_mib"]},Or={s3:["access_key","secret_key"],sftp:["key"],gdrive:["client_secret"]},en={chunk_mib:{min:1,max:64,fallback:8},quota_margin_pct:{min:0,max:100,fallback:10},min_free_mib:{min:0,max:1e6,fallback:100}},ie=()=>({keep_last:3,keep_daily:7,keep_weekly:4,keep_monthly:6});function Tr(s){return s==="gdrive"?{name:"Google Drive",kind:s,enabled:!1,config:{client_id:"",folder_name:"SmplWise Arx backups",prune_mode:"delete",chunk_mib:8,quota_margin_pct:10,min_free_mib:100},secrets:{},retention:ie()}:s==="s3"?{name:"",kind:s,enabled:!0,config:{endpoint:"https://",bucket:"",region:"auto",prefix:"arx-backups",path_style:!0},secrets:{},retention:ie()}:{name:"",kind:s,enabled:!0,config:{host:"",port:22,username:"",remote_dir:"/",host_key:""},secrets:{},retention:ie()}}function Rr(s,e=[]){const t={};for(const[a,r]of Object.entries(s.config))t[a]=typeof r=="string"?r.trim():r;if("port"in t&&(t.port=Number(t.port)||22),s.kind==="gdrive")for(const[a,r]of Object.entries(en)){if(!(a in t))continue;const d=Math.round(Number(t[a]));t[a]=Number.isFinite(d)&&String(t[a]).trim()!==""?Math.max(r.min,Math.min(r.max,d)):r.fallback}const n={};for(const[a,r]of Object.entries(s.secrets))r&&(n[a]=a==="key"?r:r.trim());for(const a of e)n[a]="";return{...s,name:s.name.trim(),config:t,secrets:n}}const Nr=()=>Z("backups/offbox"),Mr=s=>z("backups/offbox/targets",s),Pr=(s,e)=>Hs(`backups/offbox/targets/${encodeURIComponent(s)}`,e),Dr=(s,e)=>ma(`backups/offbox/targets/${encodeURIComponent(s)}`,{enabled:e}),Hr=s=>ks(`backups/offbox/targets/${encodeURIComponent(s)}`),Ir=s=>z(`backups/offbox/targets/${encodeURIComponent(s)}/test`),Fr=(s,e=!1)=>z(`backups/offbox/targets/${encodeURIComponent(s)}/push`,{dry_run:e}),Wr=s=>z(`backups/offbox/targets/${encodeURIComponent(s)}/gdrive/connect`),jr=s=>z(`backups/offbox/targets/${encodeURIComponent(s)}/gdrive/poll`),Vr=s=>z(`backups/offbox/targets/${encodeURIComponent(s)}/gdrive/disconnect`),Ur=s=>z(`backups/offbox/targets/${encodeURIComponent(s)}/gdrive/diagnose`);function Kr(s){return s==="ok"?"live":s==="fail"?"error":s==="warn"?"partial":"neutral"}function qr(s){return(Number.isFinite(s)?Math.max(2,Math.min(60,Number(s))):5)*1e3}function Gr(s){return s==="pending"||s==="slow_down"}function Yr(s){return/^https:\/\/(www\.)?google\.com\/device$/.test(s)}const Qr=()=>z("backups/offbox/key/export",{confirm:"EXPORT"}),Jr=()=>z("backups/offbox/key/rotate",{confirm:"ROTATE"}),Xr=s=>z("backups/offbox/key/import",{key:s.trim()}),Zr=()=>Z("backups/drill"),sl=s=>z("backups/drill",s?{target_id:s}:{}),el=s=>Hs("backups/drill/schedule",{monthly:s}),al=s=>Z(`backups/offbox/targets/${encodeURIComponent(s)}/copies`),tl=(s,e)=>z("backups/offbox/restore/prepare",{target_id:s,object:e}),il=s=>ks(`backups/offbox/restore/${encodeURIComponent(s)}`),nl=s=>z("backups/offbox/restore",{mode:"replace",...s});function na(s){return s==="project"?"project":"project+access"}function ne(s){return s!=="off"}function an(s){return s?{safety_backup_password:s}:{}}function rl(s,e){return s==="RESTORE"&&!e}const ra={manual:S("ידני"),upload:S("הועלה"),"auto-pre-upgrade":S("אוטומטי · לפני עדכון"),"auto-daily":S("אוטומטי · יומי"),"auto-pre-restore":S("אוטומטי · לפני שחזור")},re={sites:S("אתרים"),buildings:S("מבנים"),floors:S("קומות"),plan_assets:S("קבצי תוכנית"),plan_versions:S("גרסאות תוכנית"),map_anchors:S("עוגנים"),cameras:S("מצלמות"),spatial_zones:S("אזורים"),settings:S("הגדרות"),users:S("משתמשים"),bindings:S("הרשאות"),groups:S("קבוצות")},tn=()=>Z("backups"),nn=(s={})=>z("backups",s),rn=s=>ks(`backups/${encodeURIComponent(s)}`),ln=(s,e)=>z(`backups/${encodeURIComponent(s)}/restore`,e),on=s=>Da(`backups/${encodeURIComponent(s)}/download`);function dn(s){const e=new FormData;return e.append("file",s,s.name),xs("backups/upload",e)}const Os="energy.include_history_in_backup";function za(s){return!s?.values||!(Os in s.values)?null:{on:s.values[Os]===!0,editable:!!s.editable?.[Os],bytes:typeof s.storage?.energy_db_bytes=="number"?s.storage.energy_db_bytes:null}}async function cn(){try{return za(await Z("energy/settings"))}catch{return null}}async function pn(s){return za(await ma("energy/settings",{[Os]:s}))}function Cs(s){return s<1024?`${s} B`:s<1024*1024?`${(s/1024).toFixed(0)} KB`:`${(s/1024/1024).toFixed(1)} MB`}var un=Object.defineProperty,hn=Object.getOwnPropertyDescriptor,ss=(s,e,t,n)=>{for(var a=n>1?void 0:n?hn(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&un(e,t,a),a};const la=[{icon:"home",label:"ראשי"},{icon:"shield",label:"אבטחה"},{icon:"map",label:"מפה"},{icon:"door",label:"WisKey"}];let D=class extends F{constructor(){super(...arguments),this.bubbleSkin=new ts(this),this.target="own",this.draft=ke(),this.canEdit=!1,this.busy=!1,this.message="",this.error="",this.applied=ke()}connectedCallback(){super.connectedCallback(),this.stop=Ha(s=>this.applied=s),this.draft=this.storedOf(this.target),b()&&is().then(s=>{this.canEdit=s.can_edit,xe(s.settings["ui.nav_size"]),this.draft=this.storedOf(this.target)}).catch(()=>{})}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}storedOf(s){return s==="installation"?_e():js()??_e()}setTarget(s){this.target=s,this.draft=this.storedOf(s),this.message="",this.error=""}get dirty(){return!Ia(this.draft,this.storedOf(this.target))||this.target==="own"&&js()===null}async save(){this.busy=!0,this.error="";try{if(this.target==="own")await Se(this.draft);else{const s=await O({"ui.nav_size":this.draft});C(),xe(s.settings["ui.nav_size"])}this.draft=this.storedOf(this.target),this.message=p("גודל הניווט נשמר"),setTimeout(()=>this.message="",2500)}catch(s){this.error=g(s)}finally{this.busy=!1}}async useSystemDefault(){this.busy=!0,this.error="";try{await Se(null),this.draft=this.storedOf("own"),this.message=p("הניווט חזר לברירת המחדל של המערכת"),setTimeout(()=>this.message="",2500)}catch(s){this.error=g(s)}finally{this.busy=!1}}renderRel(){const s=this.applied.mode==="rel"?this.applied.preset:null,e=this.draft.mode==="rel"?this.draft.preset:null;return i`<div class="row" data-nav-rel><span class="lbl">${p("גודל")}<span class="muted">${p("כל חלקי הניווט מוגדלים ומוקטנים יחד")}</span></span>
      <sw-segmented label=${p("גודל הניווט")} value=${e??""} @change=${t=>{this.draft={mode:"rel",preset:t.detail.value},this.message=""}}
        .options=${Fa.map(t=>({value:t,label:Wa[t],badge:s===t?p("נוכחי"):void 0,badgeAttrs:{"data-nav-current":""},attrs:{"data-nav-preset":t}}))}></sw-segmented></div>`}renderPreview(){const s=ja(this.draft),e=Object.entries(Va(s)).map(([t,n])=>`${t}:${n}`).join(";");return i`<div class="stage ${Ua({nolabels:!s.labels})}" style=${e} data-nav-preview data-icon=${s.icon} data-label=${s.labels?s.label:0} data-item=${s.item}>
      <div><h4>${p("סרגל צד")}</h4>
        <div class="mini-rail" data-preview-rail>
          ${la.map((t,n)=>i`<span class="it ${n===0?"on":""}" data-preview-item><sw-icon name=${t.icon} size=${s.icon}></sw-icon><span class="lbl">${t.label}</span></span>`)}
          <span class="it" data-preview-item><sw-avatar name="יוני" size=${s.avatar}></sw-avatar><span class="lbl">יוני</span></span>
        </div></div>
      <div><h4>${p("סרגל תחתון בטלפון")}</h4>
        <div class="mini-bar" data-preview-bar>
          ${la.map((t,n)=>i`<span class="it ${n===0?"on":""}"><span class="ic"><sw-icon name=${t.icon} size=${s.pIcon}></sw-icon></span><span class="lbl">${t.label}</span></span>`)}
          <span class="it"><span class="ic"><sw-avatar name="יוני" size=${s.pAvatar}></sw-avatar></span><span class="lbl">יוני</span></span>
        </div></div>
    </div>`}render(){const s=this.canEdit&&b();return i`<sw-card heading=${p("גודל הניווט")} subheading=${p("סרגל הצד במחשב והסרגל התחתון בטלפון")} data-nav-size>
      ${s?i`<div class="row"><span class="lbl">${p("מה לערוך")}<span class="muted">${p("הגדרה אישית גוברת על ברירת המחדל של המערכת")}</span></span>
            <sw-segmented label=${p("מה לערוך")} value=${this.target} @change=${e=>this.setTarget(e.detail.value)}
              .options=${[{value:"own",label:p("שלי"),attrs:{"data-nav-target":"own"}},{value:"installation",label:p("ברירת מחדל של המערכת"),attrs:{"data-nav-target":"installation"}}]}></sw-segmented></div>`:o}
      ${this.renderRel()}
      ${this.renderPreview()}
      <div class="foot">
        <sw-button variant="primary" size="sm" icon="check" data-nav-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${p("שמור")}</sw-button>
        ${this.target==="own"?i`<sw-button size="sm" data-nav-reset ?disabled=${js()===null||this.busy} @click=${()=>void this.useSystemDefault()}>${p("ברירת מחדל של המערכת")}</sw-button>`:o}
        ${this.message?i`<span class="ok" role="status" data-nav-message>${this.message}</span>`:o}
        ${this.error?i`<span class="err" role="alert">${this.error}</span>`:o}
      </div>
    </sw-card>`}};D.styles=[I`
    ${Is}
    .row:last-of-type {
      border-block-end: 0;
    }
    ${fa}
    ${ve}
    /* CR-CMP2-SEGMENTED-C-2450: the keys are sw-segmented (the settings key); this page keeps its 36 px key with the medium label */
    sw-segmented {
      --sw-seg-h: 36px;
      --sw-seg-fw: var(--sw-fw-medium);
      --sw-seg-on-fw: var(--sw-fw-semibold);
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .stage {
      display: flex;
      gap: 24px;
      align-items: flex-start;
      flex-wrap: wrap;
      padding: 14px;
      margin-block-start: 10px;
      background: var(--sw-bg);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
    .stage h4 {
      margin: 0 0 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
    }
    /* the mini rail: the shell's own proportions (sw-app.ts), driven by the same variables */
    .mini-rail {
      display: inline-flex;
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
      padding: 10px 7px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .mini-rail .it {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      box-sizing: border-box;
      min-inline-size: var(--nav-item-w);
      min-block-size: var(--nav-item-h);
      padding: 6px 4px;
      border-radius: var(--sw-r-md);
      color: var(--sw-text-3);
      font-size: var(--nav-label);
      line-height: 1.3;
      white-space: nowrap;
    }
    .mini-rail .it.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .mini-bar {
      display: flex;
      inline-size: 300px;
      max-inline-size: 100%;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
    }
    .mini-bar .it {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      box-sizing: border-box;
      min-block-size: var(--nav-bar-h);
      padding: 3px 2px 4px;
      color: var(--sw-text-3);
      font-size: var(--nav-p-label);
      white-space: nowrap;
    }
    .mini-bar .ic {
      display: grid;
      place-items: center;
      inline-size: var(--nav-pill-w);
      block-size: var(--nav-pill-h);
      border-radius: 999px;
    }
    .mini-bar .it.on {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .mini-bar .it.on .ic {
      background: var(--sw-accent-soft);
    }
    .nolabels .lbl {
      display: none;
    }
    ${Li}
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
  `,as];ss([c()],D.prototype,"target",2);ss([c()],D.prototype,"draft",2);ss([c()],D.prototype,"canEdit",2);ss([c()],D.prototype,"busy",2);ss([c()],D.prototype,"message",2);ss([c()],D.prototype,"error",2);ss([c()],D.prototype,"applied",2);D=ss([W("system-nav-size")],D);function bn(s,e){const t=new FormData;return t.append("file",e,e.name),xs(hs`settings/background/${s}`,t)}const mn=s=>Ka(hs`settings/background/${s}`,{method:"DELETE"});var wn=Object.defineProperty,gn=Object.getOwnPropertyDescriptor,E=(s,e,t,n)=>{for(var a=n>1?void 0:n?gn(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&wn(e,t,a),a};const oa={light:v("בהיר"),dark:v("כהה"),auto:v("אוטומטי")},vn={auto:v("אוטומטי"),full:v("מלא"),reduced:v("מופחת")},fn={auto:v("כמו הסגנון"),dark:v("כהה")},da={builtin:()=>l("background.builtin"),none:()=>l("background.none"),custom:()=>l("background.custom")};function $n(){try{return window.matchMedia("(prefers-color-scheme: dark)").matches}catch{return!1}}const yn=s=>s==="auto"?$n()?"dark":"light":s;let x=class extends F{constructor(){super(...arguments),this.bubbleSkin=new ts(this),this.draftSkin=j().skin,this.draftScheme=j().scheme,this.draftMotion=j().motion,this.draftRail=j().rail,this.draftEnter=j().enter,this.draftChip=j().chip,this.own=qa(),this.draftBackground=Vs().mode,this.ownBackground=Us(),this.slotBusy=null,this.slotMessage="",this.slotError="",this.canEdit=!b(),this.busy=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),this.stop=wa(()=>this.requestUpdate()),this.stopBackground=Ga(()=>{this.ownBackground=Us(),this.requestUpdate()}),b()&&is().then(s=>{this.canEdit=s.can_edit,Ee(s.settings["ui.skin"],s.settings["ui.scheme"],s.settings["ui.motion"],s.settings["ui.rail_tone"],s.settings["ui.entry_animations"],s.settings["ui.chip_selected"]),Ss(s.settings["ui.background"],s.settings["ui.background_images"]);const e=j();this.draftSkin=e.skin,this.draftScheme=e.scheme,this.draftMotion=e.motion,this.draftRail=e.rail,this.draftEnter=e.enter,this.draftChip=e.chip,this.draftBackground=Vs().mode}).catch(()=>{})}disconnectedCallback(){this.stop?.(),this.stopBackground?.(),super.disconnectedCallback()}get dirty(){const s=j();return s.skin!==this.draftSkin||s.scheme!==this.draftScheme||s.motion!==this.draftMotion||s.rail!==this.draftRail||s.enter!==this.draftEnter||s.chip!==this.draftChip||Vs().mode!==this.draftBackground}async save(){this.busy=!0,this.error="";try{if(b()){const s=await O({"ui.skin":this.draftSkin,"ui.scheme":this.draftScheme,"ui.motion":this.draftMotion,"ui.rail_tone":this.draftRail,"ui.entry_animations":this.draftEnter,"ui.chip_selected":this.draftChip,"ui.background":this.draftBackground});C(),Ee(s.settings["ui.skin"],s.settings["ui.scheme"],s.settings["ui.motion"],s.settings["ui.rail_tone"],s.settings["ui.entry_animations"],s.settings["ui.chip_selected"]),Ss(s.settings["ui.background"],s.settings["ui.background_images"])}else Ya(this.draftSkin,this.draftScheme,this.draftMotion,this.draftRail,this.draftEnter,this.draftChip),Qa(this.draftBackground);this.message=v("המראה נשמר"),setTimeout(()=>this.message="",2500)}catch(s){this.error=g(s)}finally{this.busy=!1}}setOwn(s){this.own=s,Ja(s)}async setOwnBackground(s){this.ownBackground=s,this.slotError="";try{await Xa(s)}catch(e){this.ownBackground=Us(),this.slotError=g(e)}}async uploadSlot(s,e){const t=e.files?.[0];if(e.value="",!(!t||!b())){this.slotBusy=s,this.slotError="",this.slotMessage="";try{const n=await bn(s,t);C(),Ss(void 0,n.images),this.slotMessage=l("background.uploaded"),setTimeout(()=>this.slotMessage="",2500)}catch(n){this.slotError=g(n)}finally{this.slotBusy=null}}}async removeSlot(s){if(b()){this.slotBusy=s,this.slotError="",this.slotMessage="";try{const e=await mn(s);C(),Ss(void 0,e.images),this.slotMessage=l("background.removed"),setTimeout(()=>this.slotMessage="",2500)}catch(e){this.slotError=g(e)}finally{this.slotBusy=null}}}slotCard(s){const e=Za(s),t=this.slotBusy!==null||!this.canEdit||!b();return i`<div class="slot" data-bg-slot=${s}>
      ${e?i`<img class="thumb" src=${e} alt="" />`:i`<span class="thumb">${l("background.empty")}</span>`}
      <div class="acts">
        <span class="nm">${s==="day"?l("background.day"):l("background.night")}</span>
        <div class="btns">
          <label class="upl"><input type="file" accept="image/png,image/jpeg,image/webp" data-bg-input=${s} ?disabled=${t} @change=${n=>void this.uploadSlot(s,n.target)} /><sw-button size="sm" icon="upload" ?disabled=${t} @click=${n=>n.currentTarget.closest("label")?.querySelector("input")?.click()}>${e?l("background.replace"):l("background.upload")}</sw-button></label>
          ${e?i`<sw-button size="sm" variant="ghost" icon="trash" data-bg-remove=${s} ?disabled=${t} @click=${()=>void this.removeSlot(s)}>${l("background.remove")}</sw-button>`:o}
        </div>
      </div>
    </div>`}swatch(s,e){const t=pe(s),n=h=>t[h]?.[e]??"",a=n("--sw-canvas"),r=h=>`${Math.min(parseFloat(n(h))||0,14)}px`,d={background:a.includes("var(")?n("--sw-bg"):a,"--m-surface":n("--sw-surface-solid"),"--m-border":n("--sw-border-strong"),"--m-text":n("--sw-heading"),"--m-text2":n("--sw-text-2"),"--m-text3":n("--sw-text-3"),"--m-accent":n("--sw-accent"),"--m-r-sm":r("--sw-r-sm"),"--m-r-md":r("--sw-r-md"),"--m-r-lg":r("--sw-r-lg")};return i`<span class="sw" style=${P(d)} aria-hidden="true"
      ><span class="body"><span class="title"></span><span class="card"><b></b><em></em></span><span class="card"><b></b><em></em></span></span
      ><span class="rail"><i></i><i></i><i></i></span></span
    >`}seg(s,e,t,n,a,r,d){return i`<sw-segmented label=${s} value=${t} ?disabled=${d} .options=${e.map(h=>({value:h,label:a(h),attrs:{[n]:h}}))}
      @change=${h=>r(h.detail.value)}></sw-segmented>`}render(){const s=yn(this.draftScheme),e=j();return i`<sw-card heading=${v("מראה המערכת")} subheading=${v("סגנון וצבעוניות - בהיר, כהה או לפי המכשיר")} data-design-card>
      <div class="row col skinrow">
        <span class="lbl">${v("סגנון")}<span class="muted">${v("אותו מבנה בכל הסגנונות; ההבדל הוא בחומרים, בצורות ובצבעים")}</span></span>
        <div class="skins" role="group" aria-label=${v("סגנון")} style=${P({"--skins-n":String(Ks.length),"--skins-half":String(Math.ceil(Ks.length/2))})}>
          ${Ks.map(t=>i`<button type="button" class="skin" data-skin-option=${t} aria-pressed=${this.draftSkin===t?"true":"false"} ?disabled=${!this.canEdit} @click=${()=>this.draftSkin=t}>
              ${this.swatch(t,s)}
              <span class="nm">${qs[t].nameHe}${e.skin===t?i`<span class="cur" data-skin-current>${v("נוכחי")}</span>`:o}</span>
              <span class="note">${qs[t].noteHe}</span>
            </button>`)}
        </div>
      </div>
      <div class="row"><span class="lbl">${v("תנועה")}<span class="muted">${v("אוטומטי עוקב אחרי הגדרת המכשיר; מלא מתעלם ממנה; מופחת מבטל תנועה")}</span></span>
        ${this.seg(v("תנועה"),st,this.draftMotion,"data-motion-option",t=>vn[t],t=>this.draftMotion=t,!this.canEdit)}</div>
      <div class="row" data-enter-row><span class="lbl">${l("entryAnim.label")}<span class="muted">${l("entryAnim.note")}</span></span>
        ${this.seg(l("entryAnim.label"),et,this.draftEnter,"data-enter-option",t=>l(t==="on"?"entryAnim.on":"entryAnim.off"),t=>this.draftEnter=t,!this.canEdit)}</div>
      <div class="row" data-chip-on-row><span class="lbl">${l("chipOn.label")}<span class="muted">${l("chipOn.note")}</span></span>
        ${this.seg(l("chipOn.label"),at,this.draftChip,"data-chip-on-option",t=>l(`chipOn.${t}`),t=>this.draftChip=t,!this.canEdit)}</div>
      ${qs[this.draftSkin].darkRail?i`<div class="row" data-rail-row><span class="lbl">${v("סרגל הניווט")}<span class="muted">${v("כהה = סרגל כחול-כהה גם במראה הבהיר")}</span></span>
            ${this.seg(v("סרגל הניווט"),tt,this.draftRail,"data-rail-option",t=>fn[t],t=>this.draftRail=t,!this.canEdit)}</div>`:o}
      <div class="row"><span class="lbl">${v("צבעוניות של המערכת")}<span class="muted">${v("ברירת המחדל לכל המשתמשים; אוטומטי עוקב אחרי המכשיר")}</span></span>
        ${this.seg(v("צבעוניות של המערכת"),Le,this.draftScheme,"data-scheme-option",t=>oa[t],t=>this.draftScheme=t,!this.canEdit)}</div>
      <div class="row"><span class="lbl">${v("הצבעוניות אצלי")}<span class="muted">${v('רק בדפדפן הזה; "כמו המערכת" מבטל')}</span></span>
        ${this.seg(v("הצבעוניות אצלי"),["system",...Le],this.own??"system","data-own-scheme",t=>t==="system"?v("כמו המערכת"):oa[t],t=>this.setOwn(t==="system"?null:t),!1)}</div>
      <div class="row ${this.draftBackground==="custom"?"col":""}"><span class="lbl">${l("background.label")}<span class="muted">${l("background.note")}</span></span>
        ${this.seg(l("background.label"),ze,this.draftBackground,"data-bg-option",t=>da[t](),t=>this.draftBackground=t,!this.canEdit)}
        ${this.draftBackground==="custom"?i`<div class="slots" data-bg-slots>${it.map(t=>this.slotCard(t))}</div>
              <span class="muted">${b()?`${l("background.hint")}. ${l("background.fallback")}`:l("background.demoOnly")}</span>
              ${this.slotMessage?i`<span class="ok" role="status" data-bg-slot-message>${this.slotMessage}</span>`:o}
              ${this.slotError?i`<span class="err" role="alert">${this.slotError}</span>`:o}`:o}
      </div>
      <div class="row"><span class="lbl">${l("background.ownLabel")}<span class="muted">${l("background.ownNote")}</span></span>
        ${this.seg(l("background.ownLabel"),["system",...ze],this.ownBackground??"system","data-own-bg",t=>t==="system"?l("background.likeSystem"):da[t](),t=>void this.setOwnBackground(t==="system"?null:t),!1)}</div>
      <div class="foot">
        <sw-button variant="primary" size="sm" icon="check" data-design-save ?disabled=${!this.canEdit||!this.dirty||this.busy} @click=${()=>void this.save()}>${v("שמור")}</sw-button>
        ${this.message?i`<span class="ok" role="status" data-design-message>${this.message}</span>`:o}
        ${this.error?i`<span class="err" role="alert">${this.error}</span>`:o}
      </div>
    </sw-card>`}};x.styles=[I`
    ${Is}
    .row.col {
      align-items: stretch;
      flex-direction: column;
      flex-wrap: nowrap;
    }
    ${fa}
    ${ve}
    .skins {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      align-items: start;
    }
    /* VISDIFF-246: skins in a row that held one fewer left the last alone on a second line (a 25 % card and a hole beside it):
       where the card is wide enough all of them sit in one row. BUBBLE-FREEZE-295: four selectable skins (the bubble skin is frozen).
       SKINFOUND-297: six with the two Arx skins - one row where the card is wide, two equal rows (3 + 3) where it is medium; the counts
       come from the registry (--skins-n / --skins-half on .skins), so a lone card on its own line never appears */
    .skinrow {
      container-type: inline-size;
    }
    @container (min-width: 520px) {
      .skins {
        grid-template-columns: repeat(var(--skins-half, 2), minmax(0, 1fr));
      }
    }
    @container (min-width: 860px) {
      .skins {
        grid-template-columns: repeat(var(--skins-n, 4), minmax(0, 1fr));
      }
    }
    /* R5-SYSTEM-297: a skin card is a key one step below the card (surface-2 well, no outline at rest); the chosen one is a FILLED accent
       field with the accent ring; it gives on press and lifts only under a pointer that hovers */
    .skin {
      all: unset;
      align-self: start;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      cursor: pointer;
      min-block-size: 44px;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    @media (hover: hover) and (pointer: fine) {
      .skin:hover:not([disabled]) {
        box-shadow: var(--sw-shadow-2);
      }
    }
    .skin:active:not([disabled]) {
      transform: scale(var(--sw-press-scale));
    }
    .skin[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent), var(--sw-shadow-2);
    }
    @media (prefers-reduced-motion: reduce) {
      .skin {
        transition-duration: 0ms;
      }
    }
    .skin[disabled] {
      cursor: default;
      opacity: 0.7;
    }
    .skin:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    /* DESIGNTOKENS-297 (break-ui): a skin added as data may carry a long name (up to 24 characters, skins/define.ts) or an unbroken
       English word; the name wraps inside its card instead of pushing the card wider, and the "current" mark never shrinks or wraps */
    .skin .nm {
      display: flex;
      align-items: center;
      gap: 6px;
      min-inline-size: 0;
      overflow-wrap: anywhere;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-lg);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.005em;
    }
    .skin .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .skin .cur {
      flex: none;
      white-space: nowrap;
    }
    .cur {
      font-size: var(--sw-fs-2xs);
      padding: 1px 6px;
      border-radius: 999px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    /* the swatch: a miniature of the shell drawn in the skin's own tokens (inline custom properties on .sw) */
    .sw {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 16px;
      gap: 6px;
      padding: 6px;
      block-size: 78px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      direction: rtl;
    }
    .sw .rail {
      border-radius: var(--m-r-lg);
      background: var(--m-surface);
      border: 1px solid var(--m-border);
      display: grid;
      align-content: start;
      justify-items: center;
      gap: 4px;
      padding-block: 5px;
    }
    .sw .rail i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 3px;
      background: var(--m-text3);
      opacity: 0.55;
    }
    .sw .rail i:first-child {
      background: var(--m-accent);
      opacity: 1;
    }
    .sw .body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto 1fr;
      gap: 5px;
    }
    .sw .title {
      grid-column: 1 / -1;
      inline-size: 55%;
      block-size: 7px;
      border-radius: 3px;
      background: var(--m-text);
    }
    .sw .card {
      border-radius: var(--m-r-md);
      background: var(--m-surface);
      border: 1px solid var(--m-border);
      padding: 4px;
      display: grid;
      align-content: space-between;
    }
    .sw .card b {
      display: block;
      inline-size: 60%;
      block-size: 4px;
      border-radius: 2px;
      background: var(--m-text2);
    }
    .sw .card em {
      display: block;
      inline-size: 40%;
      block-size: 6px;
      border-radius: var(--m-r-sm);
      background: var(--m-accent);
    }
    /* CR-CMP2-SELECTS-2450 (owner N11): the rows' keys are sw-segmented (the shared settings key) */
    ${$a}
    /* CRY: the two picture slots of the custom background */
    .slots {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .slot {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      padding: 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .slot .thumb {
      inline-size: 96px;
      block-size: 54px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      object-fit: cover;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
    }
    .slot .acts {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .slot .acts .nm {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .slot .btns {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .upl {
      display: inline-flex;
      position: relative;
    }
    .upl input[type='file'] {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      opacity: 0;
      pointer-events: none;
    }
  `,as];E([c()],x.prototype,"draftSkin",2);E([c()],x.prototype,"draftScheme",2);E([c()],x.prototype,"draftMotion",2);E([c()],x.prototype,"draftRail",2);E([c()],x.prototype,"draftEnter",2);E([c()],x.prototype,"draftChip",2);E([c()],x.prototype,"own",2);E([c()],x.prototype,"draftBackground",2);E([c()],x.prototype,"ownBackground",2);E([c()],x.prototype,"slotBusy",2);E([c()],x.prototype,"slotMessage",2);E([c()],x.prototype,"slotError",2);E([c()],x.prototype,"canEdit",2);E([c()],x.prototype,"busy",2);E([c()],x.prototype,"message",2);E([c()],x.prototype,"error",2);x=E([W("system-design")],x);var kn=Object.defineProperty,xn=Object.getOwnPropertyDescriptor,ns=(s,e,t,n)=>{for(var a=n>1?void 0:n?xn(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&kn(e,t,a),a};const Bs=()=>`custom-${Date.now().toString(36)}${Math.floor(Math.random()*1296).toString(36)}`,_n=[["accent",p("צבע הדגש")],["accentContrast",p("טקסט על הדגש")],["accentText",p("טקסט בצבע הדגש")],["bg",p("רקע")],["surface",p("משטח")],["surface2",p("משטח משני")],["surfaceElevated",p("משטח מוגבה")],["glass.tint",p("גוון זכוכית")],["text",p("טקסט")],["textMuted",p("טקסט משני")]],$s=s=>JSON.parse(JSON.stringify(s));function Sn(s,e,t){const n=e.split("."),a=n.pop();let r=s;for(const d of n)r=r[d];r[a]=t}const ca=(s,e)=>e.split(".").reduce((t,n)=>t[n],s);let q=class extends F{constructor(){super(...arguments),this.bubbleSkin=new ts(this),this.canEdit=!1,this.draft=null,this.scheme="light",this.busy=!1,this.error="",this.toaster=new _s(this,{ms:2500}),this.confirmDelete=""}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.stop=ga(()=>this.requestUpdate())}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}flash(s){this.toaster.show(s)}startNew(){const s=os(lt("palette"))??Ts()[0];this.draft={...$s(s),id:Bs(),name:{he:"",en:"Custom"}},this.error=""}startEdit(s){this.draft=Ce(s.id)?$s(s):{...$s(s),id:Bs()},this.error=""}async saveAs(){if(!this.draft)return;const s=`${this.draft.name.he.trim()} (עותק)`.slice(0,40);this.draft={...this.draft,id:Bs(),name:{he:s,en:this.draft.name.en||"Custom"}},await this.save()}rebase(s){const e=os(s);!e||!this.draft||(this.draft={...$s(e),id:this.draft.id,name:this.draft.name})}setColor(s,e){if(!this.draft)return;const t=$s(this.draft),n=t.schemes[this.scheme],a=ca(n,s);Sn(n,s,e),s==="accent"&&n.state.on===a&&(n.state.on=e),this.draft=t,this.error=""}async save(){if(!this.draft)return;Ce(this.draft.id)||(this.draft={...this.draft,id:Bs()});const s=Be(this.draft,{custom:!0});if(!s.ok){this.error=s.message;return}const e=[...gs().filter(t=>t.id!==s.palette.id),s.palette];if(e.length>Es){this.error=p("אפשר לשמור עד {n} ערכות מותאמות.",{n:Es});return}await this.persist(e,p("הערכה נשמרה"),()=>this.draft=null)}autoFix(){if(!this.draft)return;const s=ot(this.draft);this.draft=s.palette,this.flash(s.changed.length?p("תוקנו {n} צבעים",{n:s.changed.length}):p("אין מה לתקן אוטומטית"))}async removeCustom(s){if(this.confirmDelete!==s){this.confirmDelete=s;return}this.confirmDelete="",await this.persist(gs().filter(e=>e.id!==s),p("הערכה נמחקה"))}async persist(s,e,t){this.busy=!0,this.error="";try{if(b()){const n=await O({"ui.palettes":s});C(),ue(n.settings["ui.palettes"])}else ue(s);t?.(),this.flash(e)}catch(n){this.error=g(n)}finally{this.busy=!1}}previewStyle(s){try{return{...he(s,this.scheme),"--pv-alpha":String(s.schemes[this.scheme].glass.opacity.default)}}catch{return{}}}render(){if(!this.canEdit)return o;const s=this.draft,e=gs();if(!s)return i`<div class="row" data-palette-list>
        <span class="lbl">${p("ערכות מותאמות")}</span>
        <span class="btns">
          ${e.map(u=>i`<span class="btns" data-palette-custom=${u.id}>
              <sw-button variant="ghost" size="sm" data-palette-edit=${u.id} ?disabled=${this.busy} @click=${()=>this.startEdit(u)}>${u.name.he}</sw-button>
              <sw-button variant=${this.confirmDelete===u.id?"danger":"ghost"} size="sm" icon="trash" data-palette-delete=${u.id} ?disabled=${this.busy} ?iconOnly=${this.confirmDelete!==u.id} label=${p("מחיקת {name}",{name:u.name.he})} @click=${()=>void this.removeCustom(u.id)}>${this.confirmDelete===u.id?p("לאשר מחיקה"):o}</sw-button>
            </span>`)}
          <sw-button variant="primary" size="sm" icon="plus" data-palette-new ?disabled=${this.busy||e.length>=Es} @click=${()=>this.startNew()}>${p("ערכה חדשה")}</sw-button>
        </span>
        ${this.message?i`<span class="ok" role="status" data-palette-message>${this.message}</span>`:o}
        ${this.error?i`<span class="err" role="alert" data-palette-error>${this.error}</span>`:o}
      </div>`;const t=Be(s,{custom:!0}),n=!t.ok,a=t.ok?t.warning:"",r=this.scheme==="dark"&&dt(s,"dark").accent.toLowerCase()!==s.schemes.dark.accent.toLowerCase(),d=gs().some(u=>u.id===s.id),h=s.schemes[this.scheme];return i`<div class="editor" data-palette-editor>
      <h4>${d?p("עריכת ערכה: {name}",{name:s.name.he}):p("ערכה חדשה")}</h4>
      <div class="fields">
        <input type="text" data-palette-name maxlength="40" placeholder=${p("שם הערכה")} aria-label=${p("שם הערכה")} .value=${s.name.he} @input=${u=>this.draft={...s,name:{...s.name,he:u.target.value}}} />
        ${d?o:i`<select data-palette-base aria-label=${p("התחלה מערכה")} @change=${u=>this.rebase(u.target.value)}>
              <option value="">${p("התחל מ…")}</option>
              ${Ts().map(u=>i`<option value=${u.id}>${u.name.he}</option>`)}
            </select>`}
        <sw-segmented label=${p("מצב תצוגה")} value=${this.scheme} @change=${u=>this.scheme=u.detail.value}
          .options=${[{value:"light",label:p("בהיר"),attrs:{"data-palette-scheme":"light"}},{value:"dark",label:p("כהה"),attrs:{"data-palette-scheme":"dark"}}]}></sw-segmented>
      </div>
      <div class="grid" data-palette-colors>
        ${_n.map(([u,$])=>{const f=ca(h,u).toLowerCase();return i`<div class="ci" data-palette-key=${u}>
            <span class="cn">${$}</span>
            <span class="sw" role="group" aria-label=${p("צבעים מומלצים: {name}",{name:$})}>
              ${ct(u,this.scheme).map(L=>i`<button type="button" class="chip" data-palette-swatch=${`${u}:${L}`} aria-label=${`${$} ${L}`} aria-pressed=${f===L?"true":"false"} style=${P({background:L})} @click=${()=>this.setColor(u,L)}></button>`)}
              <input type="color" data-palette-color=${u} aria-label=${`${$}: ${p("בחירה חופשית")}`} .value=${f} @input=${L=>this.setColor(u,L.target.value)} />
            </span>
          </div>`})}
      </div>
      ${r?i`<div class="note" data-palette-lifted>${p("בכהה צבע הדגש מוּבהר אוטומטית, כך שיהיה בהיר מהצבע בתצוגה הבהירה.")}</div>`:o}
      ${n?i`<div class="err" role="alert" data-palette-invalid>${t.message}</div>`:o}
      ${a?i`<div class="warn" role="status" data-palette-warning>
            <span>${a}</span>
            <sw-button variant="ghost" size="sm" data-palette-autofix ?disabled=${this.busy} @click=${()=>this.autoFix()}>${p("תקן אוטומטית")}</sw-button>
          </div>`:o}
      ${this.message?i`<div class="ok" role="status" data-palette-message>${this.message}</div>`:o}
      <div class="pv" data-palette-preview style=${P(this.previewStyle(s))}>
        <div class="pv-col">
          <sw-pill variant="slider" icon="light" label=${p("תאורה מרכזית")} state=${`${p("דולק")} · 72%`} .value=${.72} on .hue=${2} tabindex="-1"></sw-pill>
          <sw-pill variant="toggle" icon="bolt" label=${p("דוד שמש")} state=${p("פעיל")} on accent .hue=${6} tabindex="-1"></sw-pill>
          <sw-pill variant="toggle" icon="bolt" label=${p("משאבה")} state=${p("כבוי")} .hue=${4} tabindex="-1"></sw-pill>
        </div>
        <div class="pv-sheet">
          <span class="t">${p("סלון")}</span>
          <span class="s">${p("{n} דולקים",{n:3})} · ${p("טמפרטורה {t}°",{t:23})}</span>
          <span class="pv-link">${p("קישור בצבע הדגש")}</span>
          <span class="pv-states"><b style=${P({color:"var(--sw-success-text)"})}>${p("תקין")}</b><b style=${P({color:"var(--sw-warning-text)"})}>${p("אזהרה")}</b><b style=${P({color:"var(--sw-danger-text)"})}>${p("שגיאה")}</b></span>
          <button type="button" class="pv-btn" tabindex="-1" aria-hidden="true">${p("אישור")}</button>
        </div>
      </div>
      <div class="btns">
        <sw-button variant="primary" size="sm" icon="check" data-palette-save ?disabled=${this.busy||n||!s.name.he.trim()} @click=${()=>void this.save()}>${p("שמור ערכה")}</sw-button>
        ${d?i`<sw-button variant="ghost" size="sm" data-palette-save-as ?disabled=${this.busy||n||!s.name.he.trim()||gs().length>=Es} @click=${()=>void this.saveAs()}>${p("שמור כחדשה")}</sw-button>`:o}
        <sw-button variant="ghost" size="sm" data-palette-cancel ?disabled=${this.busy} @click=${()=>{this.draft=null,this.error=""}}>${p("ביטול")}</sw-button>
        ${this.error?i`<span class="err" role="alert" data-palette-error>${this.error}</span>`:o}
      </div>
    </div>`}};q.styles=[I`
    ${Is}
    .lbl {
      font-weight: var(--sw-fw-medium);
    }
    .btns {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    select:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .fields {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      padding: 10px 0;
    }
    select,
    input[type='text'] {
      min-block-size: 36px;
      padding: 0 10px;
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 8px;
    }
    .ci {
      display: grid;
      gap: 6px;
      padding: 8px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .sw {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .chip {
      all: unset;
      box-sizing: border-box;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 0 0 1px rgba(128, 128, 128, 0.5);
      transition: transform var(--sw-t-press) var(--sw-ease), box-shadow var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
    }
    .chip:active {
      transform: scale(var(--sw-press-scale));
    }
    @media (prefers-reduced-motion: reduce) {
      .chip {
        transition-duration: 0ms;
      }
    }
    /* LOOK-POLISH-2331: the open editor is a well of its own under the palette row (it was an unmarked run of controls) */
    .editor {
      display: grid;
      gap: 4px;
      margin-block: 10px;
      padding: 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
      box-shadow: inset 0 0 0 1px var(--sw-border);
    }
    .editor > h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .editor .ci {
      background: var(--sw-surface);
    }
    .cn {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .chip[aria-pressed='true'] {
      box-shadow: 0 0 0 2px var(--sw-surface-2), 0 0 0 4px var(--sw-accent);
    }
    .chip:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .warn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
      padding-block: 8px;
    }
    .grid input[type='color'] {
      inline-size: 44px;
      block-size: 32px;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: none;
      cursor: pointer;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 8px;
    }
    ${nt}
    .pv {
      margin-block: 10px;
      padding: 14px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-canvas);
      color: var(--sw-text);
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--sw-gap-grid);
      direction: rtl;
    }
    ${ya}
    .pv-sheet {
      border-radius: var(--sw-r-xl);
      background: rgba(var(--sw-sheet-rgb), var(--pv-alpha, 0.72));
      -webkit-backdrop-filter: var(--sw-glass-blur-sheet);
      backdrop-filter: var(--sw-glass-blur-sheet);
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
      padding: 14px;
      display: grid;
      gap: var(--sw-gap);
    }
    .pv-sheet .t {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .pv-sheet .s {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    ${ka}
    .pv-link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .pv-states {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
    }
    .pv-states b {
      font-weight: var(--sw-fw-semibold);
    }
  `,as];ns([rt({type:Boolean})],q.prototype,"canEdit",2);ns([c()],q.prototype,"draft",2);ns([c()],q.prototype,"scheme",2);ns([c()],q.prototype,"busy",2);ns([c()],q.prototype,"error",2);ns([c()],q.prototype,"confirmDelete",2);q=ns([W("system-palette-editor")],q);var En=Object.defineProperty,Ln=Object.getOwnPropertyDescriptor,es=(s,e,t,n)=>{for(var a=n>1?void 0:n?Ln(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&En(e,t,a),a};const le="__follow";let H=class extends F{constructor(){super(...arguments),this.bubbleSkin=new ts(this),this.target="own",this.draftInst=V(),this.own=Ae(),this.canEdit=!b(),this.busy=!1,this.toaster=new _s(this,{ms:2500}),this.error="",this.skin=Oe(),this.stops=[]}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.stops.push(pt(()=>{this.own=Ae(),this.dirtyInst||(this.draftInst=V()),this.requestUpdate()})),this.stops.push(wa(()=>this.skin=Oe())),this.stops.push(ga(()=>this.requestUpdate())),b()&&is().then(s=>{this.canEdit=s.can_edit,Te(s.settings["ui.look"]),ue(s.settings["ui.palettes"]),this.draftInst=V()}).catch(()=>{})}disconnectedCallback(){for(const s of this.stops)s();super.disconnectedCallback()}get dirtyInst(){return!Re(this.draftInst,V())}get preview(){return this.target==="installation"?this.draftInst:{...V(),...this.own}}flash(s){this.toaster.show(s)}async saveInstallation(){this.busy=!0,this.error="";try{if(b()){const s=await O({"ui.look":this.draftInst});C(),Te(s.settings["ui.look"])}else ut(this.draftInst);this.draftInst=V(),this.flash(p("ברירת המחדל נשמרה"))}catch(s){this.error=g(s)}finally{this.busy=!1}}async setOwn(s,e){const t={...this.own};e===null?delete t[s]:t[s]=e,this.busy=!0,this.error="";try{await Gs(t),this.flash(p("ההעדפה נשמרה"))}catch(n){this.error=g(n)}finally{this.busy=!1}}setInst(s,e){this.draftInst={...this.draftInst,[s]:e},this.toaster.clear()}pickMaterial(s){if(this.target==="installation"){s!==null&&(this.draftInst={...this.draftInst,...Ne(this.draftInst,s)},this.toaster.clear());return}if(s===null){this.setOwn("material",null);return}const e={...V(),...this.own},t={...this.own,...Ne(e,s)};this.busy=!0,this.error="",Gs(t).then(()=>this.flash(p("ההעדפה נשמרה"))).catch(n=>this.error=g(n)).finally(()=>this.busy=!1)}pick(s,e){if(s==="material"){this.pickMaterial(e);return}this.target==="installation"?e!==null&&this.setInst(s,e):this.setOwn(s,e)}choiceRow(s){const e=vs[s],t=V()[s],n=this.target==="installation"?this.draftInst[s]:this.own[s]??null,a=this.busy||this.target==="installation"&&!this.canEdit;let r=n===null?p("לפי ההתקנה: {value}",{value:e.labelHe[String(t)]}):e.hintHe[String(n)];s==="performance"&&(n??t)==="auto"&&(r+=` · ${p("כרגע: {value}",{value:e.labelHe[ht("auto")]})}`);const d=[...this.target==="own"?[{value:le,label:p("לפי ההתקנה"),attrs:{"data-look-follow":s}}]:[],...e.values.map(h=>({value:String(h),label:e.labelHe[String(h)],attrs:{"data-look-option":`${s}:${h}`}}))];return i`<div class="row" data-look-row=${s}>
      <span class="lbl">${e.nameHe}<span class="muted">${r}</span></span>
      <sw-segmented label=${e.nameHe} .options=${d} value=${n===null?le:String(n)} ?disabled=${a}
        @change=${h=>this.pick(s,h.detail.value===le?null:e.values.find(u=>String(u)===h.detail.value))}></sw-segmented>
    </div>`}rangeRow(s){const e=vs[s],t=V()[s],n=this.own[s],a=this.target==="own"&&n===void 0,r=this.target==="installation"?this.draftInst[s]:n??t,d=this.busy||this.target==="installation"&&!this.canEdit,h=s==="transparency"?Math.round(Ys()*100):0,u=s==="transparency"&&this.preview.transparency<h?` · ${p("בפועל {n}% (סף הניגודיות)",{n:h})}`:"",$=L=>{const ws=De(s,Number(L.target.value));ws!==null&&this.target==="installation"&&this.setInst(s,ws)},f=L=>{const ws=De(s,Number(L.target.value));ws!==null&&this.target==="own"&&this.setOwn(s,ws)};return i`<div class="row" data-look-row=${s}>
      <span class="lbl">${e.nameHe}<span class="muted">${a?p("לפי ההתקנה: {value}",{value:`${t}%`}):`${r}%`}${u}</span></span>
      <span class="range">
        ${this.target==="own"?i`<button type="button" data-look-follow=${s} aria-pressed=${a?"true":"false"} ?disabled=${d} @click=${()=>void this.setOwn(s,null)}>${p("לפי ההתקנה")}</button>`:o}
        <input type="range" data-look-range=${s} min=${e.range[0]} max=${e.range[1]} step=${e.step} .value=${String(r)} ?disabled=${d} aria-label=${e.nameHe} aria-valuetext=${`${r}%`} @input=${$} @change=${f} />
        <output>${r}%</output>
      </span>
    </div>`}previewStyle(s){const e=os(s.palette),t=e?e.schemes[Qs()].glass.opacity.min:0,n=Me(s,Math.max(t,Ys()<=s.transparency/100?0:Ys()));return{...mt[s.density],...bt[s.radius],...this.paletteStyle(s.palette),...n.style}}paletteStyle(s){const e=Qs(),t=os(s);if(t)return he(t,e);const n=pe("bubble"),a={};for(const r of Object.keys(he(Ts()[0],e))){const d=n[r]?.[e];d&&(a[r]=d)}return a}swatch(s){const e=Qs(),t=os(s);if(t){const a=t.schemes[e];return[a.bg,a.surface,a.accent,a.text]}const n=pe("bubble");return["--sw-bg","--sw-surface","--sw-accent","--sw-text"].map(a=>n[a][e])}paletteRow(){if(this.target!=="installation"||!this.canEdit)return o;const s=vs.palette,e=this.draftInst.palette,t=this.busy,n=r=>r==="default"?s.labelHe.default:os(r)?.name.he??s.labelHe.default,a=["default",...Ts().map(r=>r.id)];return i`<div class="row" data-look-row="palette">
      <span class="lbl">${s.nameHe}<span class="muted">${n(e)}</span></span>
      <span class="pal" role="group" aria-label=${s.nameHe}>
        ${a.map(r=>i`<button type="button" data-look-option=${`palette:${r}`} aria-pressed=${e===r?"true":"false"} ?disabled=${t} @click=${()=>this.pick("palette",r)}>
            <span class="dots" aria-hidden="true">${this.swatch(r).map(d=>i`<i style=${P({background:d})}></i>`)}</span>${n(r)}
          </button>`)}
      </span>
    </div>
    <system-palette-editor .canEdit=${this.canEdit}></system-palette-editor>`}render(){const s=this.preview,e=Me(s).attrs,t=!this.canEdit||this.busy;return i`<sw-card heading=${p("מראה")} subheading=${p("צפיפות, משטח, חלונות קופצים, פינות, אטימות, גודל, יעד לחיצה, חומר, עומק וגוון מצב - לכל ההתקנה ולעצמי")} data-look-card>
      <div class="row">
        <span class="lbl">${p("למי")}<span class="muted">${this.target==="own"?p("ההעדפה שלי: כל שינוי נשמר מיד"):p("ברירת המחדל של ההתקנה: נשמרת בכפתור")}</span></span>
        <sw-segmented label=${p("למי")} value=${this.target} @change=${n=>this.target=n.detail.value}
          .options=${[{value:"own",label:p("ההעדפה שלי"),attrs:{"data-look-target":"own"}},{value:"installation",label:p("ברירת המחדל של ההתקנה"),attrs:{"data-look-target":"installation"}}]}></sw-segmented>
      </div>
      ${this.skin!=="bubble"?i`<div class="row"><span class="note skinnote" data-look-skin-note><sw-icon name="info" size=${14}></sw-icon>${p("הסגנון הנוכחי הוא {skin}; האפשרויות כאן מצוירות על ידי סגנון Bubble.",{skin:this.skin})}</span></div>`:o}
      <h4 class="group">${p("פריסה")}</h4>
      ${this.choiceRow("density")}
      ${this.choiceRow("surface")}
      ${this.choiceRow("popup")}
      ${this.choiceRow("radius")}
      ${this.choiceRow("slider")}
      <h4 class="group">${p("שקיפות, גודל ומגע")}</h4>
      ${this.rangeRow("transparency")}
      ${this.rangeRow("scale")}
      ${this.choiceRow("touch")}
      ${this.choiceRow("performance")}
      <h4 class="group">${p("חומר ועומק")}</h4>
      ${this.choiceRow("material")}
      ${this.choiceRow("depth")}
      ${this.choiceRow("tint")}
      ${this.target==="installation"&&this.canEdit?i`<h4 class="group">${p("צבעים")}</h4>`:o}
      ${this.paletteRow()}
      <h4 class="group">${p("תצוגה מקדימה")}</h4>
      <div class="preview" data-look-preview=${`${s.density}/${s.surface}/${s.popup}/${s.radius}/${s.transparency}/${s.scale}/${s.touch}/${s.material}/${s.depth}/${s.tint}`} aria-label=${p("תצוגה מקדימה")} style=${P(this.previewStyle(s))}
        data-bubble-density=${e["data-bubble-density"]} data-bubble-surface=${e["data-bubble-surface"]} data-bubble-radius=${e["data-bubble-radius"]} data-bubble-touch=${e["data-bubble-touch"]} data-bubble-performance=${e["data-bubble-performance"]}
        data-bubble-material=${e["data-bubble-material"]} data-bubble-depth=${e["data-bubble-depth"]} data-bubble-tint=${e["data-bubble-tint"]}>
        <div class="pv-col">
          <sw-pill variant="slider" icon="light" label=${p("תאורה מרכזית")} state=${`${p("דולק")} · 72%`} .value=${.72} on .hue=${2} .density=${s.density} .surface=${s.surface} tabindex="-1" data-preview-pill></sw-pill>
          <sw-kpi label=${p("אזעקה")} value=${p("דרוכה")} tone="live" icon="shield" data-preview-kpi></sw-kpi>
          <sw-pill variant="plain" icon="coverOpen" label=${p("תריס חלון")} state=${`${p("פתוח")} · 60%`} .value=${.6} on fill-color="var(--sw-accent-soft)" .hue=${4} .density=${s.density} .surface=${s.surface} tabindex="-1">
            <button slot="subs" class="sb" tabindex="-1" aria-hidden="true"><sw-icon name="arrowUp" size=${18}></sw-icon></button>
            <button slot="subs" class="sb" tabindex="-1" aria-hidden="true"><sw-icon name="arrowDown" size=${18}></sw-icon></button>
          </sw-pill>
          <sw-pill variant="toggle" icon="bolt" label=${p("דוד שמש")} state=${p("כבוי")} .hue=${6} .density=${s.density} .surface=${s.surface} tabindex="-1"></sw-pill>
        </div>
        <div class="pv-wrap"><span class="pv-bg" aria-hidden="true"></span>
          <div class="pv-sheet" data-preview-sheet>
            <span class="t">${vs.popup.labelHe[s.popup]}</span>
            <span class="s">${vs.popup.hintHe[s.popup]}</span>
            <sw-pill variant="plain" icon="home" label=${p("סלון")} state=${p("{n} דולקים",{n:3})} .hue=${2} .density=${s.density} .surface=${s.surface} tabindex="-1"></sw-pill>
            <button type="button" class="pv-btn" tabindex="-1" aria-hidden="true">${p("אישור")}</button>
          </div>
        </div>
      </div>
      <div class="foot">
        ${this.target==="installation"?i`<sw-button variant="primary" size="sm" icon="check" data-look-save ?disabled=${t||!this.dirtyInst} @click=${()=>void this.saveInstallation()}>${p("שמור")}</sw-button>
              <sw-button variant="ghost" size="sm" data-look-reset ?disabled=${t||Re(this.draftInst,Pe)} @click=${()=>{this.draftInst={...Pe}}}>${p("ערכי המוצר")}</sw-button>
              ${!this.canEdit&&b()?i`<span class="note">${p("שינוי ברירת המחדל דורש הרשאת מנהל מערכת.")}</span>`:o}`:i`<sw-button variant="ghost" size="sm" data-look-clear-own ?disabled=${this.busy||!Object.keys(this.own).length} @click=${()=>void Gs({}).then(()=>this.flash(p("ההעדפה נמחקה"))).catch(n=>this.error=g(n))}>${p("לפי ההתקנה בכל האפשרויות")}</sw-button>`}
        ${this.message?i`<span class="ok" role="status" data-look-message>${this.message}</span>`:o}
        ${this.error?i`<span class="err" role="alert">${this.error}</span>`:o}
      </div>
    </sw-card>`}};H.styles=[I`
    ${Is}
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-weight: var(--sw-fw-medium);
      min-inline-size: 120px;
    }
    ${ve}
    /* CR-CMP2-SELECTS-2450 (owner N11): the dials' keys are sw-segmented (the shared settings key; its own press / hover / disabled) */
    /* LOOK-POLISH-2331: every key gives on pointer-down and washes on hover only under a pointer that hovers */
    .range button,
    .pal button {
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    .range button:active:not(:disabled),
    .pal button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .pal button:hover:not([aria-pressed='true']):not(:disabled) {
        color: var(--sw-text);
        background: var(--sw-hover-wash);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .range button,
      .pal button {
        transition-duration: 0ms;
      }
    }
    /* the thirteen dials in four headed groups (they were one unbroken list) */
    .group {
      margin: 0;
      padding-block: 18px 2px;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.005em;
    }
    .range {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-inline-size: 220px;
    }
    .range input[type='range'] {
      flex: 1;
      min-inline-size: 140px;
      accent-color: var(--sw-accent);
      block-size: 36px;
      margin: 0;
    }
    .range output {
      min-inline-size: 48px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
    }
    .range button {
      all: unset;
      box-sizing: border-box;
      min-block-size: 36px;
      padding: 0 10px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      background: var(--sw-surface-3);
    }
    .range button[aria-pressed='true'] {
      color: var(--sw-accent-text);
      background: var(--sw-accent-soft);
    }
    .range button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* the palette row: one chip per palette with its four swatch colours */
    .pal {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: 100%;
    }
    .pal button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 40px;
      padding: 0 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .pal button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: inset 0 0 0 2px var(--sw-accent);
    }
    .pal button[disabled] {
      cursor: default;
      opacity: 0.6;
    }
    .pal button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .dots {
      display: inline-flex;
      direction: ltr;
    }
    .dots i {
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(128, 128, 128, 0.45);
      margin-inline-start: -4px;
    }
    .dots i:first-child {
      margin-inline-start: 0;
    }
    /* the preview: a canvas with the draft's tokens, two pills, a mini sheet over a colourful backdrop */
    .preview {
      margin-block-start: 12px;
      padding: 14px;
      border-radius: var(--sw-r-lg);
      background: radial-gradient(60% 50% at 85% 0%, rgba(120, 140, 255, 0.32), transparent 70%), radial-gradient(50% 45% at 10% 100%, rgba(255, 170, 120, 0.28), transparent 70%), var(--sw-bg);
      display: grid;
      gap: var(--sw-gap-grid);
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      direction: rtl;
    }
    ${ya}
    .pv-sheet {
      position: relative;
      border-radius: var(--sw-r-xl);
      background: rgba(var(--sw-sheet-rgb), var(--sw-sheet-alpha));
      -webkit-backdrop-filter: var(--sw-glass-blur-sheet);
      backdrop-filter: var(--sw-glass-blur-sheet);
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), var(--sw-shadow-2);
      padding: 14px;
      display: grid;
      gap: var(--sw-gap);
      min-block-size: 120px;
    }
    .pv-sheet .t {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-size: calc(var(--sw-fs-lg) * var(--sw-look-scale));
    }
    .pv-sheet .s {
      color: var(--sw-text-2);
      font-size: calc(var(--sw-fs-sm) * var(--sw-look-scale));
    }
    .pv-sheet sw-pill {
      --pill-base: var(--sw-layer);
    }
    .pv-bg {
      position: absolute;
      inset: -20px -30px auto auto;
      inline-size: 140px;
      block-size: 90px;
      border-radius: var(--sw-r-xl);
      background: linear-gradient(120deg, var(--sw-lit), var(--sw-hue-2));
      z-index: -1;
      opacity: 0.9;
    }
    .pv-wrap {
      position: relative;
      isolation: isolate;
    }
    ${ka}
    .sb {
      inline-size: var(--sw-sub-size, var(--sw-sub));
      block-size: var(--sw-sub-size, var(--sw-sub));
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
      border: 0;
      border-radius: 50%;
      background: var(--sw-surface-2);
      color: var(--sw-text);
      display: grid;
      place-items: center;
      padding: 0;
      pointer-events: none;
    }
    ${$a}
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .skinnote {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
  `,as];es([c()],H.prototype,"target",2);es([c()],H.prototype,"draftInst",2);es([c()],H.prototype,"own",2);es([c()],H.prototype,"canEdit",2);es([c()],H.prototype,"busy",2);es([c()],H.prototype,"error",2);es([c()],H.prototype,"skin",2);H=es([W("system-look")],H);var zn=Object.defineProperty,Cn=Object.getOwnPropertyDescriptor,bs=(s,e,t,n)=>{for(var a=n>1?void 0:n?Cn(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&zn(e,t,a),a};const Bn=["structure","control_images","layout_editor","wall_arrange","settings_writes","permissions"];let J=class extends F{constructor(){super(...arguments),this.bubbleSkin=new ts(this),this.draft={...Ls()},this.canEdit=!1,this.busy=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),this.stop=wt(()=>{this.dirty||(this.draft={...Ls()})}),b()&&is().then(s=>{this.canEdit=s.can_edit,He(s.settings["ui.mobile"]),this.draft={...Ls()}}).catch(()=>{})}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}get dirty(){const s=Ls();return Object.keys(gt).some(e=>this.draft[e]!==s[e])}set(s,e){this.draft={...this.draft,[`hide_${s}`]:e},this.message=""}async save(){this.busy=!0,this.error="";try{const s=await O({"ui.mobile":this.draft});C(),He(s.settings["ui.mobile"]),this.draft=vt(s.settings["ui.mobile"]),this.message=p("האפשרויות נשמרו"),setTimeout(()=>this.message="",2500)}catch(s){this.error=g(s)}finally{this.busy=!1}}render(){const s=this.canEdit&&b();return i`<sw-card heading=${p("אפשרויות נייד")} subheading=${p("חלות רק במסך צר (עד 768 פיקסלים); ההרשאות אינן משתנות")} data-mobile-options>
      ${Bn.map(e=>i`<div class="row" data-mobile-option=${e}><span class="lbl">${Ie[e]}</span>
          <sw-toggle ?checked=${this.draft[`hide_${e}`]} ?disabled=${!s||this.busy} label=${Ie[e]} labelHidden data-mobile-toggle=${e} @change=${t=>this.set(e,t.detail.checked)}></sw-toggle></div>`)}
      ${s?i`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-mobile-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${p("שמור")}</sw-button>
            ${this.message?i`<span class="ok" role="status" data-mobile-message>${this.message}</span>`:o}
            ${this.error?i`<span class="err" role="alert">${this.error}</span>`:o}
          </div>`:o}
    </sw-card>`}};J.styles=[I`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .lbl {
      font-weight: var(--sw-fw-medium);
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-block-start: 12px;
    }
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
  `,as];bs([c()],J.prototype,"draft",2);bs([c()],J.prototype,"canEdit",2);bs([c()],J.prototype,"busy",2);bs([c()],J.prototype,"message",2);bs([c()],J.prototype,"error",2);J=bs([W("system-mobile-options")],J);var An=Object.defineProperty,On=Object.getOwnPropertyDescriptor,ms=(s,e,t,n)=>{for(var a=n>1?void 0:n?On(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&An(e,t,a),a};const Tn={light:"colLight",temp:"colTemp",presence:"colPresence",cameras:"colCameras",doors:"colDoors",alerts:"colAlerts",fire:"colFire"},Ca=[{title:"grpFloors",opts:[{key:"desktop_place",kind:"enum",label:"optDesktopPlace",options:[["left","optDesktopLeft"],["right","optDesktopRight"],["off","optDesktopOff"]]},{key:"phone_place",kind:"enum",label:"optPhonePlace",options:[["side","optPhoneSide"],["card","optPhoneCard"],["sheet","optPhoneSheet"]]},{key:"many",kind:"enum",label:"optMany",options:[["steps","optManySteps"],["scroll","optManyScroll"],["near","optManyNear"]]},{key:"links",kind:"enum",label:"optLinks",options:[["fold","optLinksFold"],["full","optLinksFull"],["hide","optLinksHide"]]},{key:"click",kind:"enum",label:"optClick",options:[["select","optClickSelect"],["open","optClickOpen"]]},{key:"shafts",kind:"bool",label:"optShafts"},{key:"animate",kind:"bool",label:"optAnimate"},{key:"temp_threshold",kind:"enum",label:"optThreshold",options:$t.map(s=>[s,`${s}°`])}]},{title:"grpSyn",opts:[{key:"syn_tab",kind:"bool",label:"optSynTab"},{key:"syn_columns",kind:"enum",label:"optSynColumns",options:[["all","optSynAll"],["few","optSynFew"],["custom","optSynCustom"]]},{key:"syn_hide_empty",kind:"bool",label:"optSynHideEmpty",hint:"optSynHideEmptyHint"},{key:"syn_switches",kind:"enum",label:"optSynSwitches",options:[["typed","optSynSwitchesTyped"],["all","optSynSwitchesAll"]],hint:"optSynSwitchesHint"},{key:"syn_phone_view",kind:"enum",label:"optSynPhoneView",options:[["table","optSynPhoneTable"],["cards","optSynPhoneCards"],["section","optSynPhoneSection"]],hint:"optSynPhoneViewHint"},{key:"syn_phone_light",kind:"enum",label:"optSynPhoneLight",options:[["bar","optSynPhoneLightBar"],["segments","optSynPhoneLightSegments"],["number","optSynPhoneLightNumber"]],hint:"optSynPhoneLightHint"},{key:"syn_phone_summary",kind:"enum",label:"optSynPhoneSummary",options:[["button","optSynPhoneSummaryButton"],["line","optSynPhoneSummaryLine"],["off","optSynPhoneSummaryOff"]],hint:"optSynPhoneSummaryHint"},{key:"syn_events",kind:"bool",label:"optSynEvents"},{key:"wall",kind:"bool",label:"optWall"}]},{title:"grpFire",opts:[{key:"fire_ui",kind:"bool",label:"optFireUi",hint:"optFireUiHint"},{key:"fire_column",kind:"enum",label:"optFireColumn",options:[["hidden","optFireHidden"],["dashed","optFireDashed"]]},{key:"ack",kind:"enum",label:"optAck",options:[["hold","optAckHold"],["confirm","optAckConfirm"],["tap","optAckTap"]]},{key:"ack_who",kind:"enum",label:"optAckWho",options:[["separate","optAckWhoSeparate"],["viewers","optAckWhoViewers"],["admin","optAckWhoAdmin"]]},{key:"alarm_bar",kind:"enum",label:"optAlarmBar",options:[["everywhere","optBarEverywhere"],["home","optBarHome"]]}]}],Rn=s=>s in Ba?y(s):String(s),Ba={};for(const s of Ca)for(const e of s.opts)if(e.kind==="enum")for(const[,t]of e.options)typeof t=="string"&&t.startsWith("opt")&&(Ba[t]=!0);let X=class extends F{constructor(){super(...arguments),this.bubbleSkin=new ts(this),this.draft={...ls()},this.canEdit=!1,this.busy=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),this.stop=yt(()=>{this.dirty||(this.draft={...ls()})}),b()&&is().then(s=>{this.canEdit=s.can_edit,Fe(s.settings["ui.xs"]),this.draft={...ls()}}).catch(()=>{})}firstUpdated(){va().params.get("focus")==="xs"&&requestAnimationFrame(()=>this.scrollIntoView({block:"start"}))}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}get dirty(){const s=ls();return Object.keys(Js).some(e=>JSON.stringify(this.draft[e])!==JSON.stringify(s[e]))}set(s,e){this.draft=kt({...this.draft,[s]:e}),this.message=""}async save(){this.busy=!0,this.error="";try{const s=await O({"ui.xs":{...this.draft}});C(),Fe(s.settings["ui.xs"]),xt(ls().syn_tab),this.draft={...ls()},this.message=y("setSaved"),setTimeout(()=>this.message="",2500)}catch(s){this.error=g(s)}finally{this.busy=!1}}renderCustom(s){if(this.draft.syn_columns!=="custom")return o;const e=new Set(this.draft.syn_custom),t=(n,a)=>this.set("syn_custom",We.filter(r=>r===n?a:e.has(r)));return i`<div class="row custom" data-xs-option="syn_custom"><span class="lbl">${y("optSynCustomPick")}<small>${y("optSynCustomHint")}</small>${e.size?o:i`<small class="warn" data-xs-custom-none>${y("optSynCustomNone")}</small>`}</span>
      <div class="cbs" role="group" aria-label=${y("optSynCustomPick")}>${We.map(n=>i`<label class="cb"><input type="checkbox" data-xs-col=${n} .checked=${e.has(n)} ?disabled=${!s||this.busy} @change=${a=>t(n,a.target.checked)} /><span>${y(Tn[n])}</span></label>`)}</div></div>`}renderOpt(s,e){return s.key==="syn_columns"?i`${this.renderEnumOrBool(s,e)}${this.renderCustom(e)}`:this.renderEnumOrBool(s,e)}renderEnumOrBool(s,e){const t=this.draft[s.key],n=Js[s.key];return s.kind==="bool"?i`<div class="row" data-xs-option=${s.key}><span class="lbl">${y(s.label)}${n===!0?i` <small>${y("setDefault")}</small>`:o}${s.hint?i`<small>${y(s.hint)}</small>`:o}</span>
        <sw-toggle ?checked=${t===!0} ?disabled=${!e||this.busy} label=${y(s.label)} labelHidden data-xs-toggle=${s.key} @change=${a=>this.set(s.key,a.detail.checked)}></sw-toggle></div>`:i`<div class="row" data-xs-option=${s.key}><span class="lbl">${y(s.label)}${s.hint?i`<small>${y(s.hint)}</small>`:o}</span>
      <select data-xs-select=${s.key} aria-label=${y(s.label)} ?disabled=${!e||this.busy} @change=${a=>{const r=a.target.value;this.set(s.key,typeof n=="number"?Number(r):r)}}>
        ${s.options.map(([a,r])=>i`<option value=${String(a)} ?selected=${t===a}>${Rn(r)}${a===n?` ${y("setDefault")}`:""}</option>`)}
      </select></div>`}render(){const s=this.canEdit&&b();return i`<sw-card heading=${y("setTitle")} subheading=${y("setSub")} data-xs-options>
      ${Ca.map(e=>i`<h4>${y(e.title)}</h4>${e.opts.map(t=>this.renderOpt(t,s))}`)}
      ${s?i`<div class="foot">
            <sw-button variant="primary" size="sm" icon="check" data-xs-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${y("setSave")}</sw-button>
            <sw-button variant="ghost" size="sm" data-xs-reset ?disabled=${this.busy} @click=${()=>this.draft={...Js}}>${y("setReset")}</sw-button>
            ${this.message?i`<span class="ok" role="status" data-xs-message>${this.message}</span>`:o}
            ${this.error?i`<span class="err" role="alert">${this.error}</span>`:o}
          </div>`:i`<div class="note">${y("cantEdit")}</div>`}
    </sw-card>`}};X.styles=[I`
    :host { display: block; }
    h4 { margin: 18px 0 4px; font-size: var(--sw-fs-md); color: var(--sw-heading); }
    h4:first-of-type { margin-block-start: 0; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-block-end: 1px solid var(--sw-border); }
    .row .lbl { font-weight: var(--sw-fw-medium); min-inline-size: 0; }
    .row .lbl small { display: block; color: var(--sw-text-3); font-weight: var(--sw-fw-regular); font-size: var(--sw-fs-xs); }
    select { font: inherit; min-block-size: 36px; max-inline-size: 60%; padding: 0 10px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border-strong); background: var(--sw-surface); color: var(--sw-text); }
    select:disabled { opacity: var(--sw-disabled-opacity, 0.6); }
    .foot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-block-start: 12px; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    ${ft}
    .note { color: var(--sw-text-3); font-size: var(--sw-fs-xs); margin-block-start: 8px; }
    .row.custom { align-items: flex-start; flex-wrap: wrap; }
    .row .lbl small.warn { color: var(--sw-warning-text, var(--sw-text-2)); }
    .cbs { display: flex; flex-wrap: wrap; gap: 4px 14px; max-inline-size: 60%; justify-content: flex-end; }
    .cb { display: inline-flex; align-items: center; gap: 6px; min-block-size: 36px; cursor: pointer; font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .cb input { inline-size: 18px; block-size: 18px; margin: 0; accent-color: var(--sw-accent); cursor: pointer; }
    .cb input:disabled, .cb input:disabled + span { cursor: default; opacity: var(--sw-disabled-opacity, 0.6); }
    @media (max-width: 767px) { .cbs { max-inline-size: 100%; justify-content: flex-start; } }
  `,as];ms([c()],X.prototype,"draft",2);ms([c()],X.prototype,"canEdit",2);ms([c()],X.prototype,"busy",2);ms([c()],X.prototype,"message",2);ms([c()],X.prototype,"error",2);X=ms([W("system-xs-options")],X);const Nn=()=>Z("brand"),Mn=s=>Hs("brand",s);function Pn(s,e){const t=new FormData;return t.append("file",e,e.name),xs(hs`brand/company-logo/${s}`,t)}const Dn=s=>ks(hs`brand/company-logo/${s}`),Hn=()=>Z("brand/white-label"),In=s=>Hs("brand/white-label",s);function Fn(s,e){const t=new FormData;return t.append("file",e,e.name),xs(hs`brand/white-label/logo/${s}`,t)}const Wn=s=>ks(hs`brand/white-label/logo/${s}`);function jn(s){const e=new FormData;return e.append("file",s,s.name),xs("brand/white-label/pack",e)}async function Vn(){const s=await _t("brand/white-label/pack");if(!s.ok)throw new Error(`pack ${s.status}`);St(await s.blob(),"smplwise-brand-pack.zip")}var Un=Object.defineProperty,Kn=Object.getOwnPropertyDescriptor,R=(s,e,t,n)=>{for(var a=n>1?void 0:n?Kn(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&Un(e,t,a),a};const qn="image/png,image/svg+xml,image/webp,image/jpeg,.png,.svg,.webp,.jpg,.jpeg",oe=s=>({size:s.size,logoSide:s.logoSide,companySize:s.companySize,darkMode:s.darkMode,companyName:s.companyName,kind:s.kind,projectName:s.projectName,titlePrefix:s.titlePrefix,titleMode:s.titleMode});let B=class extends F{constructor(){super(...arguments),this.tab="look",this.canEdit=!b(),this.saved=Rs(),this.draft=oe(Rs()),this.files={light:null,dark:null},this.busy=null,this.toaster=new _s(this,{ms:2500}),this.error="",this.warnings=[],this.dragOver=null,this.uploadName={}}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),b()&&(this.canEdit=M("system.configure"),Nn().then(s=>this.adopt(s)).catch(()=>{}))}adopt(s){this.files=s.files,s.company&&(this.saved=Xs(s,this.saved),ds(s),this.draft=oe(this.saved))}get dirty(){return JSON.stringify(this.draft)!==JSON.stringify(oe(this.saved))}set(s,e){this.draft={...this.draft,[s]:e}}get previewState(){return{companyName:this.draft.companyName,size:this.draft.size,companySize:this.draft.companySize,darkMode:this.draft.darkMode,files:this.saved.files}}async save(){this.busy="save",this.error="";try{if(b()){const s=this.draft,e=await Mn({company_name:s.companyName,company_kind:s.kind,logo_size:s.size,logo_side:s.logoSide,company_logo_size:s.companySize,dark_mode:s.darkMode,title_prefix:s.titlePrefix,title_mode:s.titleMode,project_name:s.projectName});this.adopt(e)}else this.saved={...this.saved,...this.draft},ds({company:{name:this.saved.companyName,kind:this.saved.kind,logo:this.saved.files,logo_file:this.saved.files},size:this.saved.size,logo_side:this.saved.logoSide,company_logo_size:this.saved.companySize,dark_mode:this.saved.darkMode,title:{prefix:this.saved.titlePrefix,mode:this.saved.titleMode},project:{name:this.saved.projectName}});this.flash(l("brandLogos.saved"))}catch(s){this.error=g(s)}finally{this.busy=null}}flash(s){this.toaster.show(s)}async onFile(s,e){if(!(!e||!this.canEdit)){this.busy=s,this.error="",this.warnings=[],this.uploadName={...this.uploadName,[s]:e.name};try{const t=await Pn(s,e);this.files=t.files,ds(t.view),this.saved=Xs(t.view,this.saved),this.warnings=t.warnings.map(n=>n.message),this.flash(l("brandLogos.uploaded"))}catch(t){this.error=g(t)}finally{this.busy=null}}}async onRemove(s){if(this.canEdit){this.busy=s,this.error="";try{const e=await Dn(s);this.files=e.files,ds(e),this.saved=Xs(e,this.saved),this.flash(l("brandLogos.removed"))}catch(e){this.error=g(e)}finally{this.busy=null}}}onTabKey(s){const t=["files","look","title","preview"].filter(d=>this.renderRoot.querySelector(`[data-logo-tab="${d}"]`)?.offsetParent!==null),n=t.indexOf(this.tab),a=getComputedStyle(this).direction==="rtl";let r;if(s.key==="Home")r=0;else if(s.key==="End")r=t.length-1;else if(s.key==="ArrowLeft")r=a?n+1:n-1;else if(s.key==="ArrowRight")r=a?n-1:n+1;else return;s.preventDefault(),this.tab=t[(r+t.length)%t.length],this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-logo-tab="${this.tab}"]`)?.focus())}pickFile(s){this.renderRoot.querySelector(`input[data-file="${s}"]`)?.click()}renderFileBox(s){const e=this.files[s],t=s==="dark",n=l(t?"brandLogos.darkTitle":"brandLogos.lightTitle"),a=this.busy===s,r=this.saved.files[s];return i`<div class="lbox" data-logo-box=${s}>
      <div class="lt"><b>${n}</b>${t?i`<span class="chip">${l("brandLogos.optional")}</span>`:o}<span class="sp"></span>
        ${this.canEdit&&e?i`<span class="acts"><sw-button size="sm" icon="refresh" ?disabled=${a} data-logo-replace=${s} @click=${()=>this.pickFile(s)}>${l("brandLogos.replace")}</sw-button>
              <sw-button size="sm" variant="danger" icon="trash" ?disabled=${a} data-logo-remove=${s} @click=${()=>void this.onRemove(s)}>${l("brandLogos.remove")}</sw-button></span>`:o}</div>
      <span class="muted">${l(t?"brandLogos.darkRules":"brandLogos.rules")}</span>
      ${e&&r?i`<div class=${`tile ${t?"dark":"light"}`} data-logo-preview=${s}>
              <sw-brand kind="company" .h=${48} .maxw=${220} scheme=${t?"dark":"light"} .previewMode=${t?"file":"plate"} .previewState=${{files:t?{light:null,dark:r}:{light:r,dark:null},companyName:this.draft.companyName,companySize:"same"}} .previewSize=${"m"}></sw-brand>
            </div>
            <div class="meta"><span class="ltr">${e.mime==="image/svg+xml"?"SVG":"PNG"} · ${Math.max(1,Math.round(e.bytes/1024))} KB · ${e.width}×${e.height}</span>${e.uploaded_by?i`<span>· ${l("brandLogos.uploadedBy")} ${e.uploaded_by}</span>`:o}</div>`:i`<div class=${`drop ${this.dragOver===s?"over":""}`} data-logo-drop=${s} tabindex=${this.canEdit?0:-1}
            @dragover=${d=>{this.canEdit&&(d.preventDefault(),this.dragOver=s)}}
            @dragleave=${()=>this.dragOver=null}
            @drop=${d=>{d.preventDefault(),this.dragOver=null,this.onFile(s,d.dataTransfer?.files?.[0])}}
            @keydown=${d=>{this.canEdit&&(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),this.pickFile(s))}}>
            ${a?i`<span>${l("brandLogos.uploading")} ${this.uploadName[s]??""}</span>`:i`<sw-icon name="upload" size=${22}></sw-icon><span>${l(t?"brandLogos.dropDark":"brandLogos.dropHere")}</span>
                  ${this.canEdit?i`<sw-button size="sm" data-logo-choose=${s} @click=${()=>this.pickFile(s)}>${l("brandLogos.choose")}</sw-button>`:o}`}
          </div>`}
      <input type="file" accept=${qn} data-file=${s} @change=${d=>{const h=d.target;this.onFile(s,h.files?.[0]),h.value=""}} />
    </div>`}renderFiles(){return i`<div class="g2">${this.renderFileBox("light")}${this.renderFileBox("dark")}</div>
      ${this.warnings.map(s=>i`<span class="warn" role="status" data-logo-warning><sw-icon name="warning" size=${14}></sw-icon>${s}</span>`)}`}renderLook(){const s=this.draft,e=ye[s.size],t=ye[s.companySize==="same"?s.size:s.companySize],n=s.darkMode==="file"&&!this.saved.files.dark;return i`<div class="fld"><span class="lbl">${l("brandLogos.sizeLabel")}<span class="muted">${l("brandLogos.sizeHint")}</span></span>
        <div class="ctlrow">
          <sw-segmented label=${l("brandLogos.sizeLabel")} data-logo-size value=${s.size} ?disabled=${!this.canEdit}
            .options=${Et.map(a=>({value:a,label:l(`brandLogos.size_${a}`),attrs:{"data-size":a}}))}
            @change=${a=>this.set("size",a.detail.value)}></sw-segmented>
          <span class="muted ltr px" data-logo-size-px>${Math.round(36*e)}px · ${Math.round(28*e)}px</span>
        </div></div>
      <div class="fld"><span class="lbl">${l("brandLogos.companySizeLabel")}<span class="muted">${l("brandLogos.companySizeHint")}</span></span>
        <div class="ctlrow">
          <sw-segmented label=${l("brandLogos.companySizeLabel")} data-logo-company-size value=${s.companySize} ?disabled=${!this.canEdit}
            .options=${Lt.map(a=>({value:a,label:l(a==="same"?"brandLogos.csize_same":`brandLogos.size_${a}`),attrs:{"data-company-size":a}}))}
            @change=${a=>this.set("companySize",a.detail.value)}></sw-segmented>
          <span class="muted ltr px" data-logo-company-size-px>${Math.round(34*t)}px</span>
        </div></div>
      <div class="fld"><span class="lbl">${l("brandLogos.sideLabel")}<span class="muted">${l("brandLogos.sideHint")}</span></span>
        <sw-segmented label=${l("brandLogos.sideLabel")} data-logo-side value=${s.logoSide} ?disabled=${!this.canEdit}
            .options=${zt.map(a=>({value:a,label:l(`brandLogos.side_${a}`),attrs:{"data-side":a}}))}
            @change=${a=>this.set("logoSide",a.detail.value)}></sw-segmented></div>
      <div class="fld"><span class="lbl">${l("brandLogos.darkLabel")}<span class="muted">${l("brandLogos.darkHint")}</span></span>
        <div class="opts" role="group" aria-label=${l("brandLogos.darkLabel")} data-logo-darkmode>
          ${Ct.map(a=>i`<button type="button" class="opt" aria-pressed=${s.darkMode===a?"true":"false"} data-dark-mode=${a} ?disabled=${!this.canEdit} @click=${()=>this.set("darkMode",a)}>
            <span class="tile dark"><sw-brand kind="company" .h=${26} .maxw=${150} scheme="dark" .previewMode=${a} .previewSize=${"m"} .previewState=${{files:this.saved.files,companyName:s.companyName,companySize:"same"}}></sw-brand></span>
            <b>${l(`brandLogos.mode_${a}`)}${a==="invert"?i`<span class="chip ok">${l("brandLogos.recommended")}</span>`:o}</b>
            <span class="d">${l(`brandLogos.mode_${a}_d`)}</span></button>`)}
        </div>
        ${n?i`<span class="warn" role="status" data-logo-nodark><sw-icon name="warning" size=${14}></sw-icon>${l("brandLogos.noDarkFile")}<sw-button size="sm" variant="ghost" @click=${()=>this.tab="files"}>${l("brandLogos.toUpload")}</sw-button></span>`:o}
      </div>`}renderTitle(){const s=this.draft;return i`<div class="g2">
        <label class="fld"><span class="lbl">${l("brandLogos.nameLabel")}<span class="muted">${l("brandLogos.nameHint")}</span></span>
          <input class="inp" maxlength="60" data-brand-name .value=${s.companyName} ?disabled=${!this.canEdit} @input=${e=>this.set("companyName",e.target.value)} /></label>
        <div class="fld"><span class="lbl">${l("brandLogos.kindLabel")}</span>
          <sw-segmented label=${l("brandLogos.kindLabel")} value=${s.kind} ?disabled=${!this.canEdit}
            .options=${Bt.map(e=>({value:e,label:l(`brandLogos.kind_${e}`),attrs:{"data-kind":e}}))}
            @change=${e=>this.set("kind",e.detail.value)}></sw-segmented></div>
      </div>
      <div class="g2">
        <label class="fld"><span class="lbl">${l("brandLogos.projectLabel")}<span class="muted">${l("brandLogos.projectHint")}</span></span>
          <input class="inp" maxlength="60" data-brand-project .value=${s.projectName} ?disabled=${!this.canEdit} @input=${e=>this.set("projectName",e.target.value)} /></label>
        <label class="fld"><span class="lbl">${l("brandLogos.prefixLabel")}<span class="muted">${l("brandLogos.prefixHint")}</span></span>
          <input class="inp ltr" maxlength="40" data-brand-prefix .value=${s.titlePrefix} ?disabled=${!this.canEdit} @input=${e=>this.set("titlePrefix",e.target.value)} /></label>
      </div>
      <div class="fld"><span class="lbl">${l("brandLogos.modeLabel")}</span>
        <sw-segmented label=${l("brandLogos.modeLabel")} data-logo-titlemode value=${s.titleMode} ?disabled=${!this.canEdit}
            .options=${At.map(e=>({value:e,label:l(`brandLogos.tmode_${e}`),attrs:{"data-title-mode":e}}))}
            @change=${e=>this.set("titleMode",e.detail.value)}></sw-segmented></div>
      ${this.renderTabDemo()}`}renderTabDemo(){const s=this.draft;return i`<div class="tabdemo"><div class="ctab"><sw-brand kind="product" mark decorative .h=${14}></sw-brand><span class="ttl" data-brand-title>${Ot(s.titlePrefix,s.titleMode,s.companyName,s.projectName)}</span></div><small>${l("brandLogos.tabDemo")}</small></div>`}renderMini(s){const e=s==="light"?"l":"d",t=i`<sw-brand kind="company" .h=${20} .maxw=${64} scheme=${s} decorative .previewMode=${this.draft.darkMode} .previewSize=${this.draft.size} .previewState=${this.previewState}></sw-brand>`,n=this.draft.logoSide==="start";return i`<div><div class=${`mini ${e}`} data-logo-mini=${s}><div class="bar" data-side=${this.draft.logoSide}>
        ${n?i`${t}<i class="ttl"></i><span class="sp"></span>`:i`<i class="ttl"></i><span class="sp"></span>${t}`}
        <span class="pill"></span><sw-brand kind="product" .h=${18} scheme=${s} decorative .previewSize=${this.draft.size}></sw-brand></div>
        <div class="body"><i></i><i></i><i></i></div></div>
      <span class="cap">${l(s==="light"?"brandLogos.previewLightCap":"brandLogos.previewDarkCap")}</span></div>`}render(){const s=[["files","brandLogos.tabFiles"],["look","brandLogos.tabLook"],["title","brandLogos.tabTitle"],["preview","brandLogos.tabPreview"]];return i`<sw-card data-brand-logos-card>
      <div class="bcard">
        <div class="top"><div><div class="bhead">${l("brandLogos.heading")}</div>
          <div class="muted">${l("brandLogos.subheading")}</div></div>
          <span class="grow"></span>${this.canEdit?o:i`<span class="msg" data-logo-readonly><sw-icon name="lock" size=${13}></sw-icon>${l("brandLogos.readOnly")}</span>`}</div>
        <div class="tabs" role="tablist" aria-label=${l("brandLogos.tabs")} @keydown=${e=>this.onTabKey(e)}>
          ${s.map(([e,t])=>i`<button type="button" role="tab" id=${`blt-${e}`} aria-controls=${`blp-${e}`} tabindex=${this.tab===e?0:-1} class=${e==="preview"?"ptab":""} aria-selected=${this.tab===e?"true":"false"} data-logo-tab=${e} @click=${()=>this.tab=e}>${l(t)}</button>`)}
        </div>
        <div class="grid">
          <div class="main">
            <section class=${`pnl ${this.tab==="files"?"on":""}`} role="tabpanel" id="blp-files" aria-labelledby="blt-files" data-logo-panel="files">${this.renderFiles()}</section>
            <section class=${`pnl ${this.tab==="look"?"on":""}`} role="tabpanel" id="blp-look" aria-labelledby="blt-look" data-logo-panel="look">${this.renderLook()}</section>
            <section class=${`pnl ${this.tab==="title"?"on":""}`} role="tabpanel" id="blp-title" aria-labelledby="blt-title" data-logo-panel="title">${this.renderTitle()}</section>
          </div>
          <aside class=${`side ${this.tab==="preview"?"on":""}`} id="blp-preview" data-logo-panel="preview" aria-label=${l("brandLogos.previewTitle")}>
            <b>${l("brandLogos.previewTitle")}</b>
            ${this.renderMini("light")}${this.renderMini("dark")}
            ${this.renderTabDemo()}
            <span class="muted">${l("brandLogos.previewNote")}</span>
          </aside>
        </div>
        <div class="foot">
          ${this.canEdit?i`<sw-button variant="primary" size="sm" icon="check" data-logo-save ?disabled=${!this.dirty||this.busy==="save"} @click=${()=>void this.save()}>${l("brandLogos.save")}</sw-button>`:o}
          ${this.canEdit&&this.dirty&&!this.message&&!this.error?i`<span class="msg warn" role="status" data-logo-dirty>${l("brandLogos.unsaved")}</span>`:o}
          ${this.message?i`<span class="msg ok" role="status" data-logo-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:o}
          ${this.error?i`<span class="msg err" role="alert" data-logo-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:o}
          <span class="grow"></span><span class="muted">${l("brandLogos.stays")}</span>
        </div>
      </div>
    </sw-card>`}};B.styles=[Fs,I`
    :host {
      display: block;
    }
    .bcard {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .tabs {
      display: inline-flex;
      align-self: flex-start;
      gap: 2px;
      padding: 3px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
      max-inline-size: 100%;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .tabs button {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      min-block-size: 36px;
      padding: 0 14px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      white-space: nowrap;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
    }
    .tabs button:active {
      transform: scale(var(--sw-press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .tabs button:hover:not([aria-selected='true']) {
        color: var(--sw-text);
        background: var(--sw-hover-wash);
      }
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
    }
    .tabs button:focus-visible,
    .opt:focus-visible,
    .drop:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .tabs .ptab {
      display: none;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 16px;
      align-items: start;
    }
    .pnl {
      display: none;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .pnl.on {
      display: flex;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-inline-start: 16px;
      border-inline-start: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .side > b {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    @media (max-width: 899px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .side {
        display: none;
        padding: 0;
        border: 0;
      }
      .side.on {
        display: flex;
      }
      .tabs .ptab {
        display: inline-flex;
      }
    }
    .g2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 599px) {
      .g2 {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .fld {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-inline-size: 0;
    }
    .fld > .lbl {
      display: flex;
      flex-direction: column;
      gap: 1px;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
    }
    .inp {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface-solid, var(--sw-surface));
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      min-block-size: 34px;
      padding: 0 12px;
      inline-size: 100%;
      box-sizing: border-box;
    }
    .inp:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
    }
    /* CR-CMP2-SELECTS-2450 (owner N11): the keys are sw-segmented - the same key as the skin card above it on this page
       (system-design); it wraps inside the card on a phone (the five company sizes) */
    sw-segmented {
      align-self: flex-start;
    }
    .ctlrow {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .px {
      font-variant-numeric: tabular-nums;
    }
    .bhead {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.005em;
    }
    .top .grow {
      flex: 1;
    }
    .grid > .main {
      min-inline-size: 0;
    }
    /* the browser-tab demo sits in the preview column on a wide screen; in the names panel only where that column is a tab */
    .pnl .tabdemo {
      display: none;
    }
    @media (max-width: 899px) {
      .pnl .tabdemo {
        display: flex;
      }
    }
    /* a phone: a wrapped key row fills its lines evenly instead of leaving a ragged track */
    @media (max-width: 599px) {
      sw-segmented {
        display: flex;
        align-self: stretch;
        --sw-seg-key-flex: 1 1 auto;
      }
    }
    .lbox {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      min-inline-size: 0;
    }
    .lbox .lt {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-block-size: 28px;
    }
    .lbox .lt b {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
    }
    .lbox .lt .sp {
      flex: 1;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      border-radius: var(--sw-r-pill);
      padding: 2px 9px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .chip.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .acts {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tile {
      display: grid;
      place-items: center;
      min-block-size: 84px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 12px;
    }
    /* the two preview surfaces are fixed colours on purpose: they show the OTHER scheme, whatever scheme the page is in */
    .tile.light,
    .mini.l {
      background: #ffffff;
    }
    .tile.dark,
    .mini.d {
      background: #0d1220;
    }
    .drop {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-block-size: 84px;
      padding: 8px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      text-align: center;
    }
    .drop.over {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .drop.bad {
      border-color: var(--sw-danger);
    }
    .meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .opts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    /* a phone: each dark-background option is a compact row (the swatch beside its text); the three tall cards made the panel three
       screens long */
    @media (max-width: 599px) {
      .opts {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
      }
      .opt {
        display: grid;
        grid-template-columns: 112px minmax(0, 1fr);
        grid-template-rows: auto 1fr;
        column-gap: 10px;
        row-gap: 2px;
        align-items: start;
      }
      .opt .tile {
        grid-row: 1 / span 2;
        min-block-size: 52px;
        align-self: stretch;
      }
    }
    .opt {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1.5px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      min-inline-size: 0;
    }
    .opt[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      box-shadow: 0 0 0 1px var(--sw-accent) inset;
    }
    .opt[disabled] {
      cursor: default;
    }
    .opt .tile {
      min-block-size: 56px;
      padding: 8px;
    }
    .opt b {
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .opt .d {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      line-height: 1.4;
    }
    .mini {
      border-radius: var(--sw-r-md);
      border: 1px solid var(--sw-border-strong);
      overflow: hidden;
    }
    .mini .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 40px;
      padding: 5px 12px;
    }
    .mini.l .bar {
      background: #ffffff;
      border-block-end: 1px solid #e7ebf2;
    }
    .mini.d .bar {
      background: #151c2c;
      border-block-end: 1px solid #232e45;
    }
    .mini .body {
      block-size: 40px;
      padding: 8px 12px;
      display: flex;
      gap: 6px;
    }
    .mini .body i {
      display: block;
      flex: 1;
      border-radius: var(--sw-r-xs);
    }
    .mini.l .body {
      background: #f5f7fb;
    }
    .mini.l .body i {
      background: #ffffff;
      border: 1px solid #e7ebf2;
    }
    .mini.d .body i {
      background: #151c2c;
      border: 1px solid #232e45;
    }
    /* LOGOSIDE-295: the stub stands for the page title: side start = the logos take the start of the row before the title, side end = the title
       takes the start and the logos sit beside the SmplWise logo */
    .mini .ttl {
      flex: none;
      inline-size: 34px;
      block-size: 8px;
      border-radius: var(--sw-r-pill);
      background: #8896af;
      opacity: 0.45;
    }
    .mini .sp {
      flex: 1;
    }
    .mini .pill {
      inline-size: 44px;
      block-size: 20px;
      border-radius: var(--sw-r-pill);
      border: 1px solid #8896af;
      opacity: 0.5;
    }
    .cap {
      display: block;
      margin-block-start: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: center;
    }
    .tabdemo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-3);
    }
    .ctab {
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
      block-size: 26px;
      padding: 0 12px;
      border-radius: var(--sw-r-sm) var(--sw-r-sm) 0 0;
      background: var(--sw-surface);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
    }
    .ctab .ttl {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      unicode-bidi: plaintext;
    }
    .tabdemo small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .warn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    .foot .grow {
      flex: 1;
    }
    input[type='file'] {
      display: none;
    }
  `];R([c()],B.prototype,"tab",2);R([c()],B.prototype,"canEdit",2);R([c()],B.prototype,"saved",2);R([c()],B.prototype,"draft",2);R([c()],B.prototype,"files",2);R([c()],B.prototype,"busy",2);R([c()],B.prototype,"error",2);R([c()],B.prototype,"warnings",2);R([c()],B.prototype,"dragOver",2);R([c()],B.prototype,"uploadName",2);B=R([W("system-brand-logos")],B);var Gn=Object.defineProperty,Yn=Object.getOwnPropertyDescriptor,Y=(s,e,t,n)=>{for(var a=n>1?void 0:n?Yn(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&Gn(e,t,a),a};const Qn="image/png,image/svg+xml,image/webp,image/jpeg,.png,.svg,.webp,.jpg,.jpeg",Jn="application/zip,.zip",Xn=Object.keys(Ns),de=s=>({enabled:s.enabled,name:s.name,contact:s.contact,accent:s.accent});let T=class extends F{constructor(){super(...arguments),this.tab="profile",this.canEdit=!b(),this.saved=Rs().wl,this.draft=de(Rs().wl),this.files={light:null,dark:null},this.busy=null,this.toaster=new _s(this,{ms:2500}),this.error="",this.warnings=[]}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),b()&&(this.canEdit=M("system.configure"),Hn().then(s=>this.adopt(s)).catch(()=>{}))}adopt(s){this.files=s.files,this.saved={...Tt({...s,enabled:!0}),enabled:s.enabled},this.draft=de(this.saved),ds({installer:s.enabled?{...s}:{enabled:!1}})}get dirty(){return JSON.stringify(this.draft)!==JSON.stringify(de(this.saved))}set(s,e){this.draft={...this.draft,[s]:e}}flash(s){this.toaster.show(s)}async save(){this.busy="save",this.error="";try{b()?this.adopt(await In({...this.draft})):(this.saved={...this.saved,...this.draft},ds({installer:this.saved.enabled?{...this.saved,logo_file:this.saved.files}:{enabled:!1}})),this.flash(l("whiteLabel.saved"))}catch(s){this.error=g(s)}finally{this.busy=null}}async onFile(s,e){if(!(!e||!this.canEdit||!b())){this.busy=s,this.error="",this.warnings=[];try{const t=await Fn(s,e);this.warnings=t.warnings.map(n=>n.message),this.adopt(t.view)}catch(t){this.error=g(t)}finally{this.busy=null}}}async onRemove(s){if(!(!this.canEdit||!b())){this.busy=s,this.error="";try{this.adopt(await Wn(s))}catch(e){this.error=g(e)}finally{this.busy=null}}}async onExport(){this.busy="pack",this.error="";try{await Vn(),this.flash(l("whiteLabel.exported"))}catch(s){this.error=g(s)}finally{this.busy=null}}async onImport(s){if(!(!s||!this.canEdit||!b())){this.busy="pack",this.error="";try{this.adopt(await jn(s)),this.flash(l("whiteLabel.imported"))}catch(e){this.error=g(e)}finally{this.busy=null}}}pick(s){this.renderRoot.querySelector(s)?.click()}renderProfile(){const s=this.draft;return i`<div class="sw-main"><span class="t"><b>${l("whiteLabel.switchLabel")}</b><span class="muted">${l("whiteLabel.switchHint")}</span></span>
        <span class="chip ${s.enabled?"ok":""}" data-wl-state>${l(s.enabled?"whiteLabel.on":"whiteLabel.off")}</span>
        <sw-toggle .checked=${Rt(s.enabled)} label=${l("whiteLabel.switchLabel")} labelHidden data-wl-enabled ?disabled=${!this.canEdit} @change=${Nt(s.enabled,()=>this.set("enabled",!s.enabled))}></sw-toggle></div>
      <div class="g2">
        <label class="fld"><span class="lbl">${l("whiteLabel.nameLabel")}<span class="muted">${l("whiteLabel.nameHint")}</span></span>
          <input class="inp" maxlength="60" data-wl-name .value=${s.name} ?disabled=${!this.canEdit} @input=${e=>this.set("name",e.target.value)} /></label>
        <label class="fld"><span class="lbl">${l("whiteLabel.contactLabel")}<span class="muted">${l("whiteLabel.contactHint")}</span></span>
          <input class="inp" maxlength="120" data-wl-contact .value=${s.contact} ?disabled=${!this.canEdit} @input=${e=>this.set("contact",e.target.value)} /></label>
      </div>
      <div class="fld"><span class="lbl">${l("whiteLabel.accentLabel")}<span class="muted">${l("whiteLabel.accentHint")}</span></span>
        <div class="swrow" role="group" aria-label=${l("whiteLabel.accentLabel")} data-wl-accent>
          <button type="button" class="sw" aria-pressed=${s.accent==="default"?"true":"false"} data-accent="default" ?disabled=${!this.canEdit} @click=${()=>this.set("accent","default")}><span class="dot" style="background:var(--sw-surface-3)"></span>${l("whiteLabel.accentDefault")}</button>
          ${Xn.map(e=>i`<button type="button" class="sw" aria-pressed=${s.accent===e?"true":"false"} data-accent=${e} ?disabled=${!this.canEdit} @click=${()=>this.set("accent",e)}><span class="dot" style=${`background:${Ns[e]}`}></span>${l(`brandColors.preset_${e}`)}</button>`)}
        </div></div>`}renderFileBox(s){const e=this.files[s],t=s==="dark",n=this.busy===s,a=this.saved.files[s],r=b();return i`<div class="lbox" data-wl-box=${s}>
      <div class="lt"><b>${l(t?"brandLogos.darkTitle":"brandLogos.lightTitle")}</b>${t?i`<span class="chip">${l("brandLogos.optional")}</span>`:o}<span class="sp"></span>
        ${this.canEdit&&r&&e?i`<span class="acts"><sw-button size="sm" icon="refresh" ?disabled=${n} data-wl-replace=${s} @click=${()=>this.pick(`input[data-wl-file="${s}"]`)}>${l("brandLogos.replace")}</sw-button>
              <sw-button size="sm" variant="danger" icon="trash" ?disabled=${n} data-wl-remove=${s} @click=${()=>void this.onRemove(s)}>${l("brandLogos.remove")}</sw-button></span>`:o}</div>
      <span class="muted">${l("brandLogos.rules")}</span>
      ${e&&a?i`<div class=${`tile ${t?"dark":"light"}`} data-wl-preview=${s}>
              <sw-brand kind="installer" .h=${48} .maxw=${220} scheme=${t?"dark":"light"} .previewMode=${"file"} .previewState=${{wl:{...this.saved,enabled:!0,files:t?{light:null,dark:a}:{light:a,dark:null}}}} .previewSize=${"m"}></sw-brand>
            </div>
            <div class="meta"><span class="ltr">${e.mime==="image/svg+xml"?"SVG":"PNG"} · ${Math.max(1,Math.round(e.bytes/1024))} KB · ${e.width}×${e.height}</span></div>`:i`<div class="drop" data-wl-drop=${s}>
            ${n?i`<span>${l("brandLogos.uploading")}</span>`:r?i`<sw-icon name="upload" size=${22}></sw-icon><span>${l(t?"brandLogos.dropDark":"brandLogos.dropHere")}</span>
                  ${this.canEdit?i`<sw-button size="sm" data-wl-choose=${s} @click=${()=>this.pick(`input[data-wl-file="${s}"]`)}>${l("brandLogos.choose")}</sw-button>`:o}`:i`<span data-wl-needserver>${l("whiteLabel.needServer")}</span>`}
          </div>`}
      <input type="file" accept=${Qn} data-wl-file=${s} @change=${d=>{const h=d.target;this.onFile(s,h.files?.[0]),h.value=""}} />
    </div>`}renderLogos(){return i`<div class="g2">${this.renderFileBox("light")}${this.renderFileBox("dark")}</div>
      ${this.warnings.map(s=>i`<span class="warn" role="status" data-wl-warning><sw-icon name="warning" size=${14}></sw-icon>${s}</span>`)}`}renderPack(){const s=b();return i`<div class="lbox"><b>${l("whiteLabel.packTitle")}</b><span class="muted">${l("whiteLabel.packHint")}</span>
        <div class="acts">
          <sw-button size="sm" icon="download" data-wl-export ?disabled=${!s||!this.canEdit||this.busy==="pack"} @click=${()=>void this.onExport()}>${l("whiteLabel.export")}</sw-button>
          <sw-button size="sm" icon="upload" data-wl-import ?disabled=${!s||!this.canEdit||this.busy==="pack"} @click=${()=>this.pick("input[data-wl-pack]")}>${l("whiteLabel.import")}</sw-button>
        </div>
        <span class="muted">${l("whiteLabel.importNote")}</span>
        ${s?o:i`<span class="muted" data-wl-needserver>${l("whiteLabel.needServer")}</span>`}
        <input type="file" accept=${Jn} data-wl-pack @change=${e=>{const t=e.target;this.onImport(t.files?.[0]),t.value=""}} />
      </div>`}renderMini(s){const e={...this.saved,...this.draft,enabled:!0},t=e.accent==="default"?"var(--sw-accent)":Ns[e.accent];return i`<div><div class=${`mini ${s==="light"?"l":"d"}`} data-wl-mini=${s}>
        <sw-brand kind="installer" .h=${28} .maxw=${160} scheme=${s} decorative .previewMode=${"file"} .previewState=${{wl:e}} .previewSize=${"m"}></sw-brand>
        ${e.name?i`<b>${e.name}</b>`:o}${e.contact?i`<span class="c">${e.contact}</span>`:o}
        <span class="bar" style=${`background:${t}`}></span></div>
      <span class="cap">${l(s==="light"?"brandLogos.previewLightCap":"brandLogos.previewDarkCap")}</span></div>`}render(){const s=[["profile","whiteLabel.tabProfile"],["logos","whiteLabel.tabLogos"],["pack","whiteLabel.tabPack"],["preview","whiteLabel.tabPreview"]];return i`<sw-card data-wl-card>
      <div class="bcard">
        <div class="top"><div><div style="font-size:var(--sw-fs-lg);font-weight:var(--sw-fw-semibold);color:var(--sw-heading)">${l("whiteLabel.heading")}</div>
          <div class="muted">${l("whiteLabel.subheading")}</div></div>
          <span style="flex:1"></span>${this.canEdit?o:i`<span class="msg" data-wl-readonly><sw-icon name="lock" size=${13}></sw-icon>${l("whiteLabel.readOnly")}</span>`}</div>
        <div class="tabs" role="tablist" aria-label=${l("whiteLabel.tabs")}>
          ${s.map(([e,t])=>i`<button type="button" role="tab" class=${e==="preview"?"ptab":""} aria-selected=${this.tab===e?"true":"false"} data-wl-tab=${e} @click=${()=>this.tab=e}>${l(t)}</button>`)}
        </div>
        <div class="grid">
          <div style="min-inline-size:0">
            <section class=${`pnl ${this.tab==="profile"?"on":""}`} data-wl-panel="profile">${this.renderProfile()}</section>
            <section class=${`pnl ${this.tab==="logos"?"on":""}`} data-wl-panel="logos">${this.renderLogos()}</section>
            <section class=${`pnl ${this.tab==="pack"?"on":""}`} data-wl-panel="pack">${this.renderPack()}</section>
          </div>
          <aside class=${`side ${this.tab==="preview"?"on":""}`} data-wl-panel="preview" aria-label=${l("whiteLabel.previewTitle")}>
            <b>${l("whiteLabel.previewTitle")} · ${l("whiteLabel.previewLogin")}</b>
            ${this.renderMini("light")}${this.renderMini("dark")}
            ${this.draft.enabled?o:i`<span class="muted" data-wl-previewoff>${l("whiteLabel.previewOff")}</span>`}
          </aside>
        </div>
        <div class="foot">
          ${this.canEdit?i`<sw-button variant="primary" size="sm" icon="check" data-wl-save ?disabled=${!this.dirty||this.busy==="save"} @click=${()=>void this.save()}>${l("whiteLabel.save")}</sw-button>`:o}
          ${this.message?i`<span class="msg ok" role="status" data-wl-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:o}
          ${this.error?i`<span class="msg err" role="alert" data-wl-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:o}
          <span class="grow"></span><span class="muted">${l("whiteLabel.stays")}</span>
        </div>
      </div>
    </sw-card>`}};T.styles=[Fs,I`
    :host { display: block; }
    .bcard { display: flex; flex-direction: column; gap: 10px; }
    .top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .tabs { display: inline-flex; align-self: flex-start; gap: 2px; padding: 3px; border-radius: var(--sw-r-md); background: var(--sw-surface-3); max-inline-size: 100%; overflow-x: auto; scrollbar-width: none; }
    .tabs button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; min-block-size: 28px; padding: 0 12px; border-radius: var(--sw-r-sm); color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); white-space: nowrap; }
    .tabs button[aria-selected='true'] { background: var(--sw-seg-key, var(--sw-surface)); color: var(--sw-seg-key-ink, var(--sw-accent-text)); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
    .tabs button:focus-visible, .sw:focus-visible, .dot:focus-visible, .drop:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    .tabs .ptab { display: none; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
    .pnl { display: none; flex-direction: column; gap: 12px; min-inline-size: 0; }
    .pnl.on { display: flex; }
    .side { display: flex; flex-direction: column; gap: 10px; padding-inline-start: 16px; border-inline-start: 1px solid var(--sw-border); min-inline-size: 0; }
    .side > b { font-size: var(--sw-fs-base); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    @media (max-width: 899px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
      .side { display: none; padding: 0; border: 0; }
      .side.on { display: flex; }
      .tabs .ptab { display: inline-flex; }
    }
    .g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
    @media (max-width: 599px) { .g2 { grid-template-columns: minmax(0, 1fr); } }
    .fld { display: flex; flex-direction: column; gap: 5px; min-inline-size: 0; }
    .fld > .lbl { display: flex; flex-direction: column; gap: 1px; font-size: var(--sw-fs-base); font-weight: var(--sw-fw-medium); color: var(--sw-text); }
    .inp { font: inherit; color: var(--sw-text); background: var(--sw-surface-solid, var(--sw-surface)); border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); min-block-size: 34px; padding: 0 12px; inline-size: 100%; box-sizing: border-box; }
    .inp:disabled { opacity: var(--sw-disabled-opacity, 0.5); }
    .swrow { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .sw { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 6px; border: 1.5px solid var(--sw-border-strong); border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .sw[aria-pressed='true'] { border-color: var(--sw-accent); background: var(--sw-accent-soft); }
    .sw[disabled] { cursor: default; opacity: var(--sw-disabled-opacity, 0.5); }
    .dot { inline-size: 16px; block-size: 16px; border-radius: 50%; border: 1px solid var(--sw-border-strong); flex: none; }
    .sw-main { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
    .sw-main .t { flex: 1; display: flex; flex-direction: column; gap: 1px; min-inline-size: 0; }
    .sw-main .t b { font-weight: var(--sw-fw-semibold); }
    .lbox { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-surface-2); min-inline-size: 0; }
    .lbox .lt { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-block-size: 28px; }
    .lbox .lt b { font-size: var(--sw-fs-base); font-weight: var(--sw-fw-medium); }
    .lbox .lt .sp { flex: 1; }
    .acts { display: flex; gap: 6px; flex-wrap: wrap; }
    .tile { display: grid; place-items: center; min-block-size: 84px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); padding: 12px; }
    .tile.light, .mini.l { background: #ffffff; }
    .tile.dark, .mini.d { background: #0d1220; color: #e8edf7; }
    .drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-block-size: 84px; padding: 8px; border: 1.5px dashed var(--sw-border-strong); border-radius: var(--sw-r-md); color: var(--sw-text-2); font-size: var(--sw-fs-sm); text-align: center; }
    .meta { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .mini { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 10px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border-strong); text-align: center; color: #1d2433; }
    .mini.d { color: #e8edf7; }
    .mini b { font-size: var(--sw-fs-sm); overflow-wrap: anywhere; unicode-bidi: plaintext; }
    .mini span.c { font-size: var(--sw-fs-xs); opacity: 0.8; overflow-wrap: anywhere; unicode-bidi: plaintext; }
    .mini .bar { inline-size: 40px; block-size: 4px; border-radius: var(--sw-r-2xs); margin-block-start: 4px; }
    .cap { display: block; margin-block-start: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-3); text-align: center; }
    .warn { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
    .foot .grow { flex: 1; }
    .chip { display: inline-flex; border-radius: var(--sw-r-pill); padding: 2px 9px; font-size: var(--sw-fs-xs); background: var(--sw-surface-3); color: var(--sw-text-2); }
    .chip.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
    input[type='file'] { display: none; }
  `];Y([c()],T.prototype,"tab",2);Y([c()],T.prototype,"canEdit",2);Y([c()],T.prototype,"saved",2);Y([c()],T.prototype,"draft",2);Y([c()],T.prototype,"files",2);Y([c()],T.prototype,"busy",2);Y([c()],T.prototype,"error",2);Y([c()],T.prototype,"warnings",2);T=Y([W("system-brand-installer")],T);var Zn=Object.defineProperty,sr=Object.getOwnPropertyDescriptor,rs=(s,e,t,n)=>{for(var a=n>1?void 0:n?sr(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&Zn(e,t,a),a};const er=[Mt,...Object.keys(Ns)];let G=class extends F{constructor(){super(...arguments),this.draft=je(),this.saved=je(),this.canEdit=!b(),this.busy=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),b()&&(this.canEdit=M("system.configure"),is().then(s=>{this.canEdit=s.can_edit;const e={accent:fs(s.settings["ui.accent"]),toggle:fs(s.settings["ui.toggle_on"],"toggle")};this.saved=e,this.draft={...e}}).catch(()=>{}))}get dirty(){return this.draft.accent!==this.saved.accent||this.draft.toggle!==this.saved.toggle}pick(s,e){this.draft={...this.draft,[s]:fs(e,s)}}async save(){this.busy=!0,this.error="";try{if(b()){const s=await O({"ui.accent":this.draft.accent,"ui.toggle_on":this.draft.toggle});C(),this.saved={accent:fs(s.settings["ui.accent"]),toggle:fs(s.settings["ui.toggle_on"],"toggle")}}else this.saved={...this.draft};Pt(this.saved.accent,this.saved.toggle),this.draft={...this.saved},this.message=l("brandColors.saved"),setTimeout(()=>this.message="",2500)}catch(s){this.error=g(s)}finally{this.busy=!1}}renderRow(s){const e=this.draft[s],t=Ve(e)??Ue,n=e.startsWith("#"),a=s==="toggle"&&e===Zs,r=s==="accent"?"brandColors.accentLabel":"brandColors.toggleLabel",d=s==="accent"?"brandColors.accentHint":"brandColors.toggleHint",h=s==="accent"&&Dt(t)<3;return i`<div class="row" data-brand-row=${s}>
      <span class="lbl">${l(r)}<span class="muted">${l(d)}</span></span>
      <div class="swatches" role="group" aria-label=${l(r)}>
        ${s==="toggle"?i`<button type="button" class="sw follow" data-brand-option=${Zs} title=${l("brandColors.preset_accent")} aria-label=${l("brandColors.preset_accent")} aria-pressed=${a?"true":"false"}
            ?disabled=${!this.canEdit} @click=${()=>this.pick(s,Zs)}><sw-icon name="link" size=${18}></sw-icon></button>`:o}
        ${er.map(u=>{const $=l(`brandColors.preset_${u}`);return i`<button type="button" class="sw" data-brand-option=${u} title=${$} aria-label=${$} aria-pressed=${e===u?"true":"false"}
            ?disabled=${!this.canEdit} style=${P({background:Ve(u)??Ue})} @click=${()=>this.pick(s,u)}></button>`})}
        <label class="custom">
          <input type="color" data-brand-custom=${s} aria-label=${`${l(r)} - ${l("brandColors.custom")}`} aria-pressed=${n?"true":"false"}
            .value=${t} ?disabled=${!this.canEdit} @input=${u=>this.pick(s,u.target.value)} />
          ${l("brandColors.custom")}
        </label>
      </div>
      ${a?i`<span class="hint" data-brand-follow>${l("brandColors.accentFollowHint")}</span>`:o}
      ${h?i`<span class="warn" role="status" data-brand-low-contrast>${l("brandColors.lowContrast")}</span>`:o}
    </div>`}render(){return i`<sw-card heading=${l("brandColors.heading")} subheading=${l("brandColors.subheading")} data-brand-card>
      ${this.renderRow("accent")}
      ${this.renderRow("toggle")}
      <div class="foot">
        <sw-button variant="primary" size="sm" icon="check" data-brand-save ?disabled=${!this.canEdit||!this.dirty||this.busy} @click=${()=>void this.save()}>${l("brandColors.save")}</sw-button>
        ${this.message?i`<span class="msg ok" role="status" data-brand-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:o}
        ${this.error?i`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:o}
      </div>
    </sw-card>`}};G.styles=[Fs,I`
    .row {
      display: grid;
      gap: 8px;
    }
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .sw {
      all: unset;
      box-sizing: border-box;
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--sw-r-pill);
      border: 2px solid var(--sw-border-strong);
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .sw[aria-pressed='true'] {
      border-color: var(--sw-text);
      box-shadow: 0 0 0 2px var(--sw-surface), 0 0 0 4px var(--sw-text);
    }
    .sw:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 3px;
    }
    .sw[disabled] {
      cursor: default;
      opacity: 0.7;
    }
    /* "same as the accent": a swatch painted with the live accent, marked by a link glyph */
    .sw.follow {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .custom {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .custom input {
      inline-size: 44px;
      block-size: 44px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      cursor: pointer;
    }
    .custom input[aria-pressed='true'] {
      outline: 2px solid var(--sw-text);
      outline-offset: 2px;
    }
    .warn {
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
  `];rs([c()],G.prototype,"draft",2);rs([c()],G.prototype,"saved",2);rs([c()],G.prototype,"canEdit",2);rs([c()],G.prototype,"busy",2);rs([c()],G.prototype,"message",2);rs([c()],G.prototype,"error",2);G=rs([W("system-brand-colors")],G);const Aa={layout:{label:"סידור הלשונית",text:"כרטיס אחד פתוח בכל פעם, לצד הכותרות או מתחת לכותרת · שתי לשוניות: התצוגה לחוד, ההכרזות והקול לחוד · רשימה אחת: הכול ברצף",cards:"כרטיסים: כותרות בצד",accordion:"כרטיסים: נפתחים במקום",defaultMark:"(ברירת מחדל)",tabs:"שתי לשוניות",list:"רשימה אחת"},voiceTab:"הכרזות וקול",voiceTabSub:"הכרזות לעמדות, מנוע ההקראה ושיחות נכנסות",announceSub:"יעדי ההכרזה, מנוע ההקראה הקבוע והמשפטים המוכנים. כל שינוי נשמר עם כפתור השמירה של הכרטיס הזה.",cardsLabel:"חלקי הלשונית",title:{screens:"מתגי מסכי כניסה",area:"אזור WisKey והטמעה",display:"תצוגת מסך התחנות",announce:"הכרזות",calls:"שיחות נכנסות מעמדות",parity:"השוואה למסכי האינטרקום",checklist:"בדיקה ידנית צד לצד",pairing:"חיבור Arx ל-WisKey",diagnostics:"WisKey רואה את Arx כ־",validation:"בדיקת קבלה לעמדות"},sum:{loading:"טוען…",failed:"לא נטען",allWiskey:"כל המסכים: WisKey מוטמע",allArx:"כל המסכים: Arx",someArx:"Arx: {list} · השאר WisKey מוטמע",areaShown:"האזור מוצג",areaHidden:"האזור מוסתר לכולם",phoneOn:"הטמעה בטלפון: מופעלת",phoneOff:"הטמעה בטלפון: כבויה",hint:"רמז שיחה: {v}",talk:"דיבור: {v}",talkShown:"מוצג",media:"וידאו: {v}",engineDefault:"מנוע: ברירת המחדל",engine:"מנוע: {v}",phrasesBuiltIn:"משפטים מובנים",phrases:"{n} משפטים",callsOff:"כבוי",callsEveryone:"לכל מי שרשאי לענות",callsRoles:"לתפקידים נבחרים ({n})",callsStationsAll:"כל העמדות",callsStations:"{n} עמדות",callsRing:"עם צלצול",callsQuiet:"בלי צלצול",parityIdle:"עוד לא הורצה",parityBusy:"בודק…",parityFailed:"הבדיקה נכשלה",checklist:"{done} מתוך {all} נבדקו",pairingTalkReady:"דיבור מוכן",pairingTalkNot:"דיבור לא מוכן",diagIdle:"עדיין לא נבדק",diagFailed:"הבדיקה נכשלה",diag:"זהות השירות: {service} · ערוץ הרקע: {background}",validation:"לכל עמדה, רצה רק בלחיצה",unsaved:"יש שינויים שלא נשמרו"}},Oa=us("en","i18n/settings-cards","en");function A(){return Ps(["en"])==="en"?Oa:Aa}function K(s,e){return ge(s,e)}Ds("i18n/settings-cards",{he:Aa,en:Oa});const ys="access.settings_layout",Ta=["cards","accordion","tabs","list"],Ra="cards";function pa(s){return s==="cards"||s==="accordion"}function As(s){return Ta.includes(s)?s:Ra}const Na=["screens","area","display","announce","calls","parity","checklist","pairing","diagnostics","validation"],U="access-voice",ps="access-control",ar=["announce","calls"];function tr(s){return ar.includes(s)?U:ps}function Ms(s){return typeof s=="string"&&Na.includes(s)?s:null}function ir(s,e,t){const n=Ms(s);return n&&e.includes(n)?n:s===""&&!t?"":e[0]??""}function nr(s,e,t){return s!==e||t?e:""}const rr="sw.settings.access-cards.open";function Ma(s){return`${rr}.${s||"local"}`}function lr(s,e){try{const t=s?.getItem(Ma(e));return t===""?"":Ms(t)}catch{return null}}function or(s,e,t){try{s?.setItem(Ma(e),t)}catch{}}function dr(s){const e=A().sum,t=s.filter(n=>n.choice==="smplwise").map(n=>n.label);return t.length?t.length===s.length?e.allArx:K(e.someArx,{list:t.join(", ")}):e.allWiskey}function cr(s,e,t){const n=A();return[s?n.sum.areaHidden:n.sum.areaShown,e?n.sum.phoneOn:n.sum.phoneOff,n.layout[t]].join(" · ")}function ll(s,e,t){const n=A().sum;return[K(n.hint,{v:s}),K(n.talk,{v:e}),K(n.media,{v:t})].join(" · ")}function ol(s,e,t){const n=A().sum;return[s,e?K(n.engine,{v:e}):n.engineDefault,t?K(n.phrases,{n:t}):n.phrasesBuiltIn].join(" · ")}function dl(s,e,t,n){const a=A().sum;return s==="off"?a.callsOff:[s==="roles"?K(a.callsRoles,{n:e}):a.callsEveryone,t?K(a.callsStations,{n:t}):a.callsStationsAll,n?a.callsRing:a.callsQuiet].join(" · ")}function cl(s,e){return K(A().sum.checklist,{done:s,all:e})}function ua(s,e){return e?`${A().sum.unsaved} · ${s}`:s}const me="access-fold-summary",ha=new WeakMap;function pl(s,e){const t=`${e.card}
${e.present}
${e.summary}`;ha.get(s)!==t&&(ha.set(s,t),s.dispatchEvent(new CustomEvent(me,{detail:e,bubbles:!0,composed:!0})))}var pr=Object.defineProperty,ur=Object.getOwnPropertyDescriptor,w=(s,e,t,n)=>{for(var a=n>1?void 0:n?ur(e,t):e,r=s.length-1,d;r>=0;r--)(d=s[r])&&(a=(n?d(e,t,a):d(a))||a);return n&&a&&pr(e,t,a),a};const hr=[["auto","אוטומטי — ברירת המחדל"],["sub","תמיד זרם משני"],["transcode","תמיד תרגום"],["off","כבוי (הזרם כמו שהוא)"]],br=[["skip","לדלג ולהמשיך — ברירת המחדל"],["stop","לעצור את כל ההמרה"]],ce=[{screen:"overview",label:"מרכז הכניסה",href:"#/wiskey/overview",detail:"עמדות, צלצולים, פתיחת דלת ושיחה"},{screen:"events",label:"פעילות",href:"#/wiskey/events",detail:"יומן הכניסות והאירועים"},{screen:"people",label:"אנשים",href:"#/wiskey/people",detail:"כולל עורך האדם וקליטת כרטיס שנפתחים ממנו"},{screen:"stations",label:"תחנות ודלתות",href:"#/wiskey/devices",detail:'התחנות, פתיחת דלת, מענה לשיחה והכרזה; לשונית "עמדות" של WisKey'},{screen:"schedules",label:"לוחות זמנים",href:"#/wiskey/schedules",detail:"תוכניות הדלתות, ספריית לוחות הזמנים והצעות הפריסה, לצפייה בלבד; ב־WisKey הם בכלי הניהול, ולכן בבחירת WisKey אין לשונית נפרדת"}],Pa='כשהתקנת WisKey האוטומטית פעילה, "התקן / עדכן" עלול להפעיל מחדש את Home Assistant',mr={general:"המראה של המערכת, הניווט, הזמן והאינטגרציות",tabs:"אילו לשוניות מוצגות בכל אזור, באיזה סדר ובאיזה סגנון",media:"תעבורת וידאו, קיר המצלמות, מסך הפתיחה, מכסות ושמירת נתונים",map:"איך מפות הקומה נפתחות ומה מוצג בסרגל המפלסים",buildings:"איזה שם במערכת הבית שייך לאיזה בניין אצלנו, ותצוגת ריבוי הבניינים",ha:"החיבור לתשתית, הגשר והצימוד שלו","access-control":"אילו מסכי WisKey מוטמעים ואילו נבנו כאן",devices:"המראה של מסכי החשמל וההתקנים לכל המשתמשים",remote:"כניסה מרחוק, אימות, הכניסות הפעילות והווידאו מבחוץ",mobile:"שיתוף הנתונים של אפליקציית הטלפון ומדיניות החיישנים",health:"מצב נפרד לכל רכיב, הבדיקות ותור העבודות",backup:"גיבויים של הפרויקט, העלאה, שחזור וגיבוי אוטומטי",support:"חבילת תמיכה מצונזרת"},cs=[{id:"general",label:"מראה ותצוגה"},{id:"tabs",label:"לשוניות"},{id:"media",label:"וידאו ומדיה"},{id:"map",label:"מפה"},{id:"buildings",label:"בניינים ומיפוי"},{id:"ha",label:"גשר Arx"},{id:"access-control",label:"מתגי מסכי כניסה"},{id:"devices",label:"חשמל והתקנים"},{id:"remote",label:"גישה מרחוק"},{id:"mobile",label:"אפליקציה לנייד"},{id:"health",label:"בריאות ועבודות"},{id:"backup",label:"גיבוי ושחזור"},{id:"support",label:"תמיכה"}];function wr(s){if(s!=="tabs")return cs;const e=cs.findIndex(t=>t.id===ps);return[...cs.slice(0,e+1),{id:U,label:A().voiceTab},...cs.slice(e+1)]}const ba=()=>N(()=>import("./system-diagnostics-access-BPva_gxY.js"),__vite__mapDeps([0]),import.meta.url),we={tabs:()=>N(()=>import("./system-diagnostics-tabs-BIwS3xz4.js"),__vite__mapDeps([0]),import.meta.url),media:()=>N(()=>import("./system-diagnostics-media-B5qw_14Q.js"),__vite__mapDeps([0]),import.meta.url),map:()=>N(()=>import("./system-diagnostics-map-BmWpvAtn.js"),__vite__mapDeps([0]),import.meta.url),buildings:()=>N(()=>import("./system-diagnostics-buildings-DLdcAnnN.js"),__vite__mapDeps([0]),import.meta.url),[ps]:ba,[U]:ba,devices:()=>N(()=>import("./system-diagnostics-devices-DrUspz-F.js"),__vite__mapDeps([0]),import.meta.url),remote:()=>N(()=>import("./system-diagnostics-remote-DTQnjauX.js"),__vite__mapDeps([0]),import.meta.url),mobile:()=>N(()=>import("./system-diagnostics-mobile-Bm_grEJa.js"),__vite__mapDeps([0]),import.meta.url),health:()=>N(()=>import("./system-diagnostics-health-BGz5DPta.js"),__vite__mapDeps([0]),import.meta.url),backup:()=>N(()=>import("./system-diagnostics-backup-Dtp_qic1.js"),__vite__mapDeps([0]),import.meta.url)};let m=class extends F{constructor(){super(...arguments),this.bubbleSkin=new ts(this),this.tabsMode=new Ht(this,"settings"),this.tab="general",this.phone=typeof matchMedia=="function"&&matchMedia("(max-width: 767px)").matches,this.phoneMq=null,this.onPhoneMq=s=>{this.phone=s.matches},this.settings=null,this.canEdit=!1,this.ownQuality=void 0,this.siteLoc=null,this.nvrChannels=null,this.floorTree=[],this.draft={},this.streams=null,this.go2rtc=null,this.foreign=0,this.sessions=[],this.busy=!1,this.toaster=new _s(this,{ms:2500}),this.loadFailed={ha:"",health:"",backup:""},this.errors={},this.settingsFailed=!1,this.summary=null,this.summaryFailed="",this.version="",this.ha=null,this.pairing=null,this.showCode=!1,this.regenArmed=!1,this.copied=!1,this.report=null,this.reportBusy=!1,this.backups=null,this.backupPolicy={},this.backupBusy=!1,this.backupNote="",this.backupPassword="",this.restorePassword="",this.restoreSkip=!1,this.restoreCanSkip=!1,this.backupMinBusy=!1,this.localSafetyBusy=!1,this.restoreSafety="",this.backupMsg="",this.meterBackup=null,this.meterBackupBusy=!1,this.meterBackupError="",this.skins=null,this.skinsTest=null,this.skinsBusy=!1,this.skinsError="",this.restoreTarget=null,this.removeTarget=null,this.restoreMode="replace",this.restoreAccess=!1,this.restoreConfirm="",this.accessOpen=null,this.accessWide=!0,this.foldSummary={},this.foldPresent={},this.accessLink=null,this.health=null,this.tabChunks=new Map,this.onFoldSummary=s=>{const e=s.detail;e&&(s.stopPropagation(),this.foldSummary[e.card]!==e.summary&&(this.foldSummary={...this.foldSummary,[e.card]:e.summary}),this.foldPresent[e.card]!==e.present&&(this.foldPresent={...this.foldPresent,[e.card]:e.present}))},this.onHash=()=>{const s=window.location.hash;(s.startsWith("#/system/diagnostics")||s==="#/system")&&this.readTab()}}get phoneSelect(){return this.phone&&It()==="dropdown"}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.readTab(),this.tab==="general"&&this.loadSummary(),window.addEventListener("hashchange",this.onHash),this.addEventListener(me,this.onFoldSummary),typeof matchMedia=="function"&&(this.phoneMq=matchMedia("(max-width: 767px)"),this.phone=this.phoneMq.matches,this.phoneMq.addEventListener("change",this.onPhoneMq)),this.loadSettings()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),this.removeEventListener(me,this.onFoldSummary),this.phoneMq?.removeEventListener("change",this.onPhoneMq),this.phoneMq=null,clearTimeout(this.copiedTimer)}flash(s,e){this.toaster.show(s,{ms:e})}setError(s,e){(this.errors[s]??"")!==e&&(this.errors={...this.errors,[s]:e})}errorOf(s){return this.errors[s]??""}setLoadFailed(s,e){this.loadFailed[s]!==e&&(this.loadFailed={...this.loadFailed,[s]:e})}async loadSummary(){if(b()){this.summaryFailed="";try{this.summary=await Ft()}catch(s){this.summaryFailed=g(s)}}}readTab(){const s=va().params,e=s.get("tab")??"general",t=Ms(s.get("card"));t&&(e===ps||e===U)&&(this.accessLink=t,this.requestUpdate()),e!==this.tab&&(cs.some(n=>n.id===e)||e===U)&&this.openTab(e,!1)}layoutKnown(){return!b()||this.settings!==null||this.settingsFailed}accessLayout(){return As(this.settings?.[ys])}ensureTabChunk(s){const e=we[s];!e||this.tabChunks.has(s)||(this.tabChunks.set(s,"loading"),e().then(()=>"ready",t=>(console.warn(`settings tab chunk "${s}" failed to load`,t),"failed")).then(t=>{this.tabChunks.set(s,t),this.requestUpdate()}))}retryTabChunk(s){this.tabChunks.delete(s),this.ensureTabChunk(s),this.requestUpdate()}willUpdate(){this.syncAccessTab(),this.ensureTabChunk(this.tab)}syncAccessTab(){if(!this.layoutKnown())return;const s=this.accessLayout();this.tab===U&&s!=="tabs"&&(this.tab=ps,this.accessLink||(this.accessLink="announce"));const e=this.accessLink;e&&(this.accessLink=null,pa(s)?this.accessOpen=e:s==="tabs"&&(this.tab===ps||this.tab===U)&&(this.tab=tr(e)))}openTab(s,e=!0){this.tab=s,s==="general"&&this.loadSummary(),s==="health"&&this.loadReport(),s==="backup"&&this.loadBackups(),s==="media"&&this.loadMedia(),s==="ha"&&this.loadHa(),e&&Wt("/system/diagnostics",s==="general"?void 0:new URLSearchParams({tab:s}))}async loadSettings(){if(b()){try{const[s,e]=await Promise.all([is(),Z("health").catch(()=>null)]);this.settings=s.settings,this.canEdit=s.can_edit,this.nvrChannels=s.nvr_channels??null,this.draft={},this.version=e?.version??"",this.health=e??null}catch(s){this.settingsFailed=!0,this.setError(this.tab,g(s))}this.canEdit&&(this.tab==="media"?this.loadMedia():this.tab==="ha"&&this.loadHa()),jt().then(s=>this.floorTree=s.sites).catch(()=>{}),Ii().then(s=>this.ownQuality=s),this.loadSiteLocation()}}async loadSiteLocation(){this.siteLoc=(await Wi(!0).catch(()=>null))?.location??null}renderSiteLocation(s){const e=!s||!this.canEdit,t=this.value("site.location_source")==="manual"?"manual":"home",n=this.siteLoc?.home??null,a=n?`${v("מיקום הבית בהגדרות Home Assistant: {lat}, {lon}",{lat:n.latitude.toFixed(2),lon:n.longitude.toFixed(2)})}${n.time_zone?` · ${n.time_zone}`:""}`:v("מיקום הבית עדיין לא נקרא מ־Home Assistant; עד אז השמש מחושבת למרכז הארץ"),r=(d,h,u)=>i`<sw-field class="ctl"><input type="text" inputmode="decimal" data-ltr
        aria-label=${u} placeholder=${u} data-set-site=${h} ?disabled=${e} .value=${String(this.value(d)??"")}
        @change=${$=>this.set(d,$.target.value.trim())} /></sw-field>`;return i`<div class="row" data-set-site-location-row><span class="lbl">${v("מיקום האתר לשמש בתלת־ממד")}<span class="muted">${a}</span></span>
        <sw-field class="ctl"><select data-set-site-location ?disabled=${e} @change=${d=>this.set("site.location_source",d.target.value==="manual"?"manual":"home")}>
          <option value="home" ?selected=${t==="home"}>${v("לפי מיקום הבית (ברירת מחדל)")}</option><option value="manual" ?selected=${t==="manual"}>${v("ידני")}</option>
        </select></sw-field></div>
      ${t==="manual"?i`<div class="row" data-set-site-manual-row><span class="lbl">${v("מיקום ידני")}<span class="muted">${v("קו רוחב וקו אורך במעלות (צפון ומזרח חיוביים); בלי שניהם — מיקום הבית")}</span></span>
            ${r("site.latitude","lat",v("קו רוחב"))}${r("site.longitude","lon",v("קו אורך"))}</div>`:o}`}async saveOwnQuality(s){const e=s===""?null:Di(s);s!==""&&e===null||(this.ownQuality=e,await Fi(e))}async loadMedia(){if(this.loadSkins(),!(!b()||!this.canEdit||zs()))try{const[s,e]=await Promise.all([Vt(),Ut()]);this.streams=s.streams,this.go2rtc=s.go2rtc,this.foreign=s.foreign_streams,this.sessions=e.sessions,this.setError("media","")}catch(s){this.streams=[],this.setError("media",g(s))}}async loadHa(s=!1){if(b()){this.setError("ha",""),this.setLoadFailed("ha","");try{this.ha=await Kt(),this.canEdit&&!se()&&(this.pairing=await qt(s)),s&&(this.regenArmed=!1,this.showCode=!0,this.flash(Gt(this.pairing?.announced),this.pairing?.announced?6e3:12e3))}catch(e){const t=g(e);this.setError("ha",t),this.setLoadFailed("ha",t)}}}async copyCode(){if(this.pairing)try{await navigator.clipboard.writeText(this.pairing.pairing_code??""),this.copied=!0,clearTimeout(this.copiedTimer),this.copiedTimer=setTimeout(()=>this.copied=!1,2e3)}catch{this.showCode=!0}}async installBridgeNow(){this.busy=!0,this.setError("ha","");try{const s=await Yt(),e=s.state==="installed_pending"?"האינטגרציה הועתקה ל־Home Assistant; הפעל מחדש את Home Assistant ואשר את הגשר שהתגלה.":s.state==="active"?"האינטגרציה פעילה.":s.state==="not_available"?"תיקיית ההגדרות של Home Assistant אינה נגישה ל־Add-on.":`מצב: ${s.state}`;this.toaster.show(e,{ms:0}),await this.loadHa(),this.flash(e,6e3)}catch(s){this.setError("ha",g(s))}finally{this.busy=!1}}integrationText(s){switch(s.state){case"active":return`פעילה ב־Home Assistant (גרסה ${s.active_version??"?"})`;case"installed_pending":return`הועתקה לתיקיית ההגדרות של HA (גרסה ${s.installed_version??"?"}) ב־${Q(s.installed_at)} · הפעל מחדש את Home Assistant ואז אשר את "SMPLWISE Bridge" שהתגלה בהגדרות → מכשירים ושירותים`;case"update_pending":return`עודכנה לגרסה ${s.installed_version??"?"} אך Home Assistant עדיין מריץ ${s.active_version??"?"} · נדרש Restart ל־Home Assistant`;case"not_installed":return"טרם הועתקה";case"error":return`ההעתקה נכשלה (${s.last_error??""})`;default:return s.last_error==="ha_config_not_mapped"?"ה־Add-on לא רואה את תיקיית ההגדרות של Home Assistant (המיפוי homeassistant_config לא ניתן) · התקנה ידנית לפי השלבים למטה":s.last_error==="source_missing"?"קבצי האינטגרציה חסרים בתמונת ה־Add-on · התקנה ידנית לפי השלבים למטה":`ההתקנה האוטומטית נכשלה (${s.last_error??"סיבה לא ידועה"}) · התקנה ידנית לפי השלבים למטה`}}renderIntegration(s){const e=s.integration;if(!e)return o;const t=e.state==="active"?"live":e.state==="installed_pending"||e.state==="update_pending"?"stale":e.state==="error"?"error":"unknown",n=e.state==="active"?"פעילה":e.state==="installed_pending"?"ממתינה ל־Restart":e.state==="update_pending"?"עדכון ממתין":e.state==="error"?"שגיאה":e.state==="not_installed"?"לא הותקנה":"לא זמין";return i`<div class="row"><span class="lbl">התקנת האינטגרציה ב־Home Assistant<span class="muted">${this.integrationText(e)}${e.discovery_posted_at?` · הוכרזה ל־Supervisor ${Q(e.discovery_posted_at)}`:""} · ${Pa}</span></span><span class="end"><sw-badge kind=${t} label=${n}></sw-badge>${this.canEdit&&!se()&&e.state!=="not_available"?i`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.installBridgeNow()}>התקן / עדכן</sw-button>`:o}</span></div>`}renderHa(){if(!b())return i`<div class="sections"><sw-card heading="גשר Arx"><div class="muted">נתוני הדגמה — הסטטוס והצימוד זמינים מול השרת.</div></sw-card></div>`;const s=this.ha,e=s?.sync,t=this.pairing;return i`<div class="sections">
      <sw-card heading="חיבור ל־Home Assistant" subheading="קריאה בלבד: מצבים, רישום ישויות, אזורים וקומות">
        ${s?i`
            <div class="row"><span class="lbl">גישה ל־API של Home Assistant<span class="muted">${s.configured?"דרך ה־Supervisor (homeassistant_api) או HA_URL בפיתוח":"לא מוגדר — ה־Add-on לא קיבל SUPERVISOR_TOKEN"}</span></span><sw-badge kind=${s.configured?"live":"offline"}></sw-badge></div>
            <div class="row"><span class="lbl">סנכרון מצבים (WebSocket)<span class="muted">${e?.connected?`מחובר · HA ${e.ha_version??"?"} · ${e.entities} ישויות · אירוע אחרון ${Q(e.last_event_at)}`:`${Ai(e?.last_error)} · ${e?.reconnects??0} חיבורים מחדש`}</span></span><sw-badge kind=${e?.connected?"live":"offline"}></sw-badge></div>
            <div class="row"><span class="lbl">רישום ישויות (registry)<span class="muted">עודכן ${Q(e?.last_registry_at)} · תמונת מצב ${Q(e?.last_snapshot_at)}</span></span><sw-button size="sm" @click=${()=>Qt("/system/entities")}>לקטלוג</sw-button></div>`:this.loadFailed.ha?i`<sw-state-panel compact state="error" heading="מצב החיבור לא נטען" hint=${this.loadFailed.ha} actionLabel="נסו שוב" @action=${()=>void this.loadHa()}></sw-state-panel>`:i`<sw-state-panel compact state="loading"></sw-state-panel>`}
      </sw-card>
      <sw-card heading="גשר Arx (אינטגרציה ב־Home Assistant)" subheading="פעולות על ישויות רצות רק דרך הגשר, בזהות המשתמש, לפי ההרשאות של Home Assistant">
        ${s?i`${this.renderIntegration(s)}<div class="row"><span class="lbl">צימוד<span class="muted">${s.bridge.paired?`מצומד מאז ${Q(s.bridge.paired_at)}`:"לא מצומד — פעולות HA ייחסמו עד להתקנת הגשר"}</span></span><sw-badge kind=${s.bridge.paired?"live":"stale"} label=${s.bridge.paired?"מצומד":"לא מצומד"}></sw-badge></div>
            <div class="row"><span class="lbl">ספריית משתמשי HA<span class="muted">${s.bridge.directory_users} משתמשים · עודכן ${Q(s.bridge.last_directory_at)}</span></span><sw-badge kind=${s.bridge.directory_users?"recorded":"unknown"}></sw-badge></div>`:o}
        ${t?i`<div class="row"><span class="lbl">כתובת ה־Add-on ברשת של HA<span class="muted">להדביק בשדה "כתובת" של האינטגרציה</span></span><code class="ltr">${t.addon_url}</code></div>
            <div class="row"><span class="lbl">קוד צימוד<span class="muted">סוד משותף; מוצג רק למנהלי מערכת ונרשם באודיט</span></span><span class="end">${t.pairing_code===null?i`<span class="muted" data-pairing-replaced>הוחלף במפתח מתחלף (Key rotation)</span>`:i`<code class="ltr">${this.showCode?t.pairing_code:"••••••••••••"}</code><sw-button size="sm" @click=${()=>this.showCode=!this.showCode}>${this.showCode?"הסתר":"הצג"}</sw-button><sw-button size="sm" @click=${()=>this.copyCode()}>${this.copied?"הועתק":"העתק"}</sw-button>`}</span></div>
            <div class="row"><span class="lbl">יצירת קוד חדש<span class="muted" data-regen-hint>${Jt(t.announce_path)}</span></span>${this.regenArmed?i`<span class="end"><sw-button size="sm" variant="danger" @click=${()=>this.loadHa(!0)}>אשר יצירה</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.regenArmed=!1}>ביטול</sw-button></span>`:i`<sw-button size="sm" @click=${()=>this.regenArmed=!0}>צור קוד חדש</sw-button>`}</div>`:se()?i`<div class="muted" data-ha-local-only>${Xt}</div>`:this.canEdit?o:i`<div class="muted">קוד הצימוד מוצג למנהלי מערכת בלבד.</div>`}
      </sw-card>
      <sw-card heading="התקנת הגשר (פעם אחת)">
        <ol class="steps">
          <li>ה־Add-on מעתיק בעצמו את <code class="ltr">custom_components/smplwise_bridge</code> אל תיקיית ההגדרות של Home Assistant (השורה "התקנת האינטגרציה" למעלה). אם זה לא זמין: העתק את התיקייה מהמאגר אל <code class="ltr">/config/custom_components/</code>, או הוסף את המאגר ב־HACS כ־Custom repository מסוג Integration.</li>
          <li>הפעל מחדש את Home Assistant (הגדרות → מערכת → הפעלה מחדש) כדי שהרכיב ייטען.</li>
          <li>הגדרות → מכשירים ושירותים: אשר את <strong>SMPLWISE Bridge</strong> שהתגלה (קוד הצימוד כבר מולא). אם לא הופיע: הוספת אינטגרציה → SMPLWISE Bridge והדבקת הכתובת והקוד מהמסך הזה.</li>
          <li>הסטטוס למעלה יתעדכן ל"מצומד"; ספריית המשתמשים נשלחת כל דקה ומאפשרת להקצות תפקידים למשתמשי HA.</li>
        </ol>
        <div class="muted">הגשר מריץ רק פעולות מרשימת ההיתר (תאורה, מתגים, מאווררים, תריסים, מנעולים, כפתורים, סקריפטים, סצנות) ורק עבור משתמש HA קיים ופעיל. ה־Supervisor token של ה־Add-on אינו משמש לפעולות.</div>
      </sw-card>
    </div>`}set(s,e){this.draft={...this.draft,[s]:e}}playbackWarning(){const s=this.nvrChannels,e=Number(this.value("playback.max_sessions")??0);return!s||!e||e*2<=s?"":`${e} סשני ניגון במקביל זה יותר ממחצית הערוצים שה־NVR בנוי להם (${s}). זה עלול להעמיס על ה־NVR ולפגוע בהקלטה ובצפייה החיה. השמירה אפשרית.`}liveCapWarning(s){const e=this.nvrChannels,t=Number(this.value(s)??0);return!e||!t||t*2<=e?"":`${t} ${s==="media.max_live_sessions"?"זרמים חיים במקביל":"זרמים חיים לכל כניסה מרחוק"} זה יותר ממחצית הערוצים שה־NVR בנוי להם (${e}). זה עלול להעמיס על ה־NVR ולפגוע בהקלטה. השמירה אפשרית.`}viewValue(s,e){return this.draft["plan.view"]?.[s]??this.settings?.["plan.view"]?.[s]??e}setView(s){this.set("plan.view",{...this.draft["plan.view"]??{},...s})}bakeValue(s,e){return this.draft["plan.bakes"]?.[s]??this.settings?.["plan.bakes"]?.[s]??e}setBakes(s){this.set("plan.bakes",{...this.draft["plan.bakes"]??{},...s})}value(s){return this.draft[s]??this.settings?.[s]}async save(){if(!Object.keys(this.draft).length)return;const s=this.tab;this.busy=!0,this.setError(s,"");try{const e=await O(this.draft);this.settings=e.settings,this.draft={},C(),Zt(e.settings),si(e.settings),ei(e.settings),ai(e.settings),ti(e.settings["devices.glass_scheme"]),this.loadSiteLocation(),this.flash("ההגדרות נשמרו",2500)}catch(e){this.setError(s,g(e))}finally{this.busy=!1}}async sync(){this.busy=!0,this.setError("media","");try{const s=await ii();this.toaster.show(`זרמים: ${s.created} נוצרו, ${s.updated} עודכנו, ${s.unchanged} ללא שינוי · ${s.foreign_streams_untouched} זרמים זרים לא נגעו`,{ms:0}),await this.loadMedia()}catch(s){this.setError("media",g(s))}finally{this.busy=!1}}renderDesign(){if(!b())return o;const s="ui.tile_layout"in this.draft||"ui.long_lists"in this.draft,e=ea(this.value("ui.long_lists"))?this.value("ui.long_lists"):Ke,t=this.value("ui.tile_layout")??"auto",n=ni(),a=ri(t);return i`<sw-card heading="עיצוב הממשק">
      <div class="row" data-tile-layout-row><span class="lbl">פריסת אריחים<span class="muted">אריחי הסיכום בתמונת המצב ובחשמל והתקנים: כרטיסים גבוהים, או קומפקטיים - מלבן עם הסמל לצד הערך. אוטומטי: קומפקטי בטלפון, כרטיסים במסך רחב. חל על כל המשתמשים אחרי שמירה; דפדפן שכבר פתוח מקבל את השינוי בטעינה הבאה של הדף</span></span><span class="ctl" style="display:flex;flex-direction:column;align-items:stretch;gap:4px"><sw-field><select data-set-tile-layout ?disabled=${!this.canEdit} @change=${r=>this.set("ui.tile_layout",r.target.value)}>${ee.map(r=>i`<option value=${r} ?selected=${t===r}>${ae[r]}</option>`)}</select></sw-field>${n?i`<span class="muted" data-tile-override-note>עקיפה מקומית פעילה בדפדפן הזה: ${ae[n]} · <sw-button size="sm" variant="ghost" data-tile-override-clear @click=${()=>{qe(null),this.requestUpdate()}}>בטל עקיפה</sw-button></span>`:o}</span></div>
      <div class="row"><span class="lbl">פריסת אריחים בדפדפן הזה<span class="muted">עקיפה אישית שנשמרת במכשיר; לא משנה את ברירת המחדל</span></span><sw-field class="ctl"><select data-set-tile-override @change=${r=>{const d=r.target.value;qe(ee.includes(d)?d:null),this.requestUpdate()}}><option value="" ?selected=${!n}>לפי ברירת המחדל</option>${ee.map(r=>i`<option value=${r} ?selected=${n===r}>${ae[r]}</option>`)}</select></sw-field></div>
      <div class="row" data-long-lists-row><span class="lbl">${l("longLists.label")}<span class="muted">${l("longLists.hint")}</span></span><sw-field class="ctl"><select data-set-long-lists ?disabled=${!this.canEdit} @change=${r=>this.set("ui.long_lists",ea(r.target.value)?r.target.value:Ke)}>${li.map(r=>i`<option value=${r} ?selected=${e===r}>${l(`longLists.${r}`)}</option>`)}</select></sw-field></div>
      <div class="tile-preview" data-tile-preview=${a} aria-label=${`תצוגה מקדימה: ${a==="compact"?"קומפקטי":"כרטיסים"}`}>
        <sw-kpi icon="bolt" value="0/33" label="מתגים פעילים" tone="neutral" layout=${a}></sw-kpi>
        <sw-kpi icon="lock" value="8/8" label="מנעולים נעולים" detail="הכול נעול" tone="live" layout=${a}></sw-kpi>
      </div>
      ${this.canEdit?this.renderSaveRow({tab:"general",size:"sm",disabled:!s||this.busy,onSave:()=>this.saveDesign(),label:"שמור עיצוב"}):o}
    </sw-card>`}async saveDesign(){await this.save(),this.settings&&oi(this.settings["ui.tile_layout"]),this.settings&&zi(this.settings["ui.long_lists"])}renderSaveRow(s){const e=this.tab===s.tab,t=Si(s.hook??"data-save-row");return Ei`<div class="foot sticky"><sw-button variant="primary" size=${s.size??"md"} icon="check" ${t} ?disabled=${s.disabled} @click=${s.onSave}>${s.label??"שמור"}</sw-button>${e&&this.message?i`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:o}${e&&this.errorOf(s.tab)?i`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.errorOf(s.tab)}</span>`:o}</div>`}renderNvrLessNotice(s){return i`<sw-card heading="מצב ללא NVR" subheading=${s} data-nvr-less-settings>
      <div class="muted">ההתקנה פועלת ללא NVR, ולכן ההגדרות של וידאו, הקלטות, ייצוא וחיפוש אירועים מוסתרות כאן. הן יחזרו כמו שהיו כשיחובר NVR בהגדרות ‹ חיבורים.</div>
    </sw-card>`}renderGeneral(){if(!b())return this.renderGeneralDemo();const s=zs(),e=this.value("time.zone");return i`<div class="sections">
      ${this.renderDesign()}
      <system-design></system-design>
      <system-brand-logos></system-brand-logos>
      <system-brand-installer></system-brand-installer>
      <system-brand-colors></system-brand-colors>
      ${Ge?i`<system-look></system-look>`:o}
      <system-nav-size></system-nav-size>
      <system-mobile-options></system-mobile-options>
      <system-xs-options></system-xs-options>
      <sw-card heading="זמן ומיקום">
        <div class="row" data-general-zone><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><span class="ltr">${typeof e=="string"&&e?e:"—"}</span></div>
      </sw-card>
      ${s?this.renderNvrLessNotice("מדיניות האחסון נקראת מה־NVR"):o}
      <sw-card heading="אינטגרציות">
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">זרמים בשם smplwise_* בלבד · זרמים זרים לא ייגעו</span></span><sw-button size="sm" @click=${()=>this.openTab("media")}>הגדרה</sw-button></div>
        <div class="row"><span class="lbl">גשר Arx<span class="muted">קטלוג ישויות, פעולות בשם המשתמש וספריית המשתמשים</span></span><sw-button size="sm" @click=${()=>this.openTab("ha")}>הגדרה</sw-button></div>
      </sw-card>
      <sw-card heading="בריאות המערכת">${this.renderGeneralHealth()}</sw-card>
    </div>`}renderGeneralHealth(){const s=this.summary,e=i`<sw-button size="sm" icon="activity" data-general-health-open @click=${()=>this.openTab("health")}>הרצת דיאגנוסטיקה</sw-button>`;if(!s)return this.summaryFailed?i`<div class="row" data-general-health="failed"><span class="health"><i class="dot" data-status="error"></i><span class="lbl">מצב המערכת לא נטען<span class="muted">${this.summaryFailed}</span></span></span><span class="end"><sw-button size="sm" variant="ghost" @click=${()=>void this.loadSummary()}>נסו שוב</sw-button>${e}</span></div>`:i`<div class="row" data-general-health="loading"><span class="health"><i class="dot" data-status="off"></i><span class="lbl">בודק את מצב המערכת…</span></span>${e}</div>`;const t=s.status==="ok"?"הכל תקין":s.status==="warn"?"יש מה לבדוק":s.status==="error"?"יש תקלה":te[s.status],n=s.items.filter(d=>d.status==="warn"||d.status==="error"),a=n.length?n.map(d=>`${d.label}: ${te[d.status]}`).join(" · "):"כל הרכיבים תקינים",r=s.checked_at?` · נבדק ${Ye(new Date(s.checked_at))}`:"";return i`<div class="row" data-general-health=${s.status}><span class="health"><i class="dot" data-status=${s.status}></i><span class="lbl">${t}<span class="muted">${a}${r}</span></span></span>${e}</div>`}renderGeneralDemo(){const s=zs();return i`<div class="sections">
      ${this.renderDesign()}
      <system-design></system-design>
      <system-brand-logos></system-brand-logos>
      <system-brand-installer></system-brand-installer>
      <system-brand-colors></system-brand-colors>
      ${Ge?i`<system-look></system-look>`:o}
      <system-nav-size></system-nav-size>
      <system-mobile-options></system-mobile-options>
      <system-xs-options></system-xs-options>
      <sw-card heading="זמן ומיקום">
        <div class="row"><span class="lbl">אזור זמן לתצוגה<span class="muted">פנימית הכל UTC; שעון קיץ לפי התאריך המבוקש</span></span><sw-field class="ctl"><select><option>(UTC+02:00) Asia/Jerusalem</option></select></sw-field></div>
        ${s?o:i`<div class="row"><span class="lbl">פרופיל זמן של ה־NVR<span class="muted">נקבע לפי ראיות לדגם ולקושחה</span></span><sw-field class="ctl"><select><option>hikvision · ds-76xx · שעון מקומי</option></select></sw-field></div>`}
        ${b()?o:i`<div class="row"><span class="lbl">NTP במכשיר<span class="muted">pool.ntp.org · סטייה 2 שנ׳</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>`}
      </sw-card>
      ${s?this.renderNvrLessNotice("מדיניות האחסון נקראת מה־NVR"):i`<sw-card heading="מדיניות אחסון (קריאה מה־NVR)">
        <div class="row"><span class="lbl">שמירת הקלטות</span><sw-field class="ctl"><select disabled><option>לפי מקום פנוי (overwrite)</option></select></sw-field></div>
        <div class="row"><span class="lbl">כשהאחסון מתמלא</span><sw-field class="ctl"><select disabled><option>דריסת הישן ביותר</option></select></sw-field></div>
        <div class="row"><span class="lbl">התראת אחסון נמוך<span class="muted">מתחת ל־10% פנוי</span></span><sw-toggle checked label="פעיל"></sw-toggle></div>
      </sw-card>`}
      <sw-card heading="אינטגרציות">
        <div class="row"><span class="lbl">go2rtc (חיצוני)<span class="muted">זרמים בשם smplwise_* בלבד · זרמים זרים לא ייגעו</span></span><span class="end"><sw-toggle checked label="מופעל"></sw-toggle><sw-button size="sm" @click=${()=>this.openTab("media")}>הגדרה</sw-button></span></div>
        <div class="row"><span class="lbl">גשר Arx<span class="muted">קטלוג ישויות, פעולות בשם המשתמש וספריית המשתמשים</span></span><sw-button size="sm" @click=${()=>this.openTab("ha")}>הגדרה</sw-button></div>
      </sw-card>
      <sw-card heading="בריאות המערכת">
        <div class="row"><span class="health"><i class="dot"></i><span class="lbl">מצב חלקי<span class="muted">גשר HA טרם חובר · שאר הרכיבים תקינים</span></span></span><sw-button size="sm" icon="activity">הרצת דיאגנוסטיקה</sw-button></div>
      </sw-card>
    </div>`}renderMedia(){const s=b(),e=Object.keys(this.draft).length>0,t=zs(),n=t?[["devices","ראשי (ברירת מחדל)"],["explore","מפת קומה"]]:[["devices","ראשי (ברירת מחדל)"],["explore","מפת קומה"],["live","סקירה (לייב)"],["wall","כל המצלמות"],["events","מרכז אירועים"],["playback","הקלטות"]];return i`<div class="sections">
      ${t?this.renderNvrLessNotice("הגדרות הווידאו וההקלטות אינן בשימוש"):o}
      <sw-card heading=${t?"תצוגה ומפה":"תעבורת וידאו"} subheading=${t?"מסך הפתיחה, המפה והתלת-ממד":"ברירת המחדל לכל הנגנים; כל נגן יכול לעקוף אותה לדפדפן הנוכחי"}>
        ${t?o:i`<div class="row"><span class="lbl">תעבורה ברירת מחדל<span class="muted">אוטומטי (ברירת המחדל): WebRTC תחילה (השהיה נמוכה), ו־MSE רק כש־WebRTC אינו זמין · WebRTC בלבד: לעולם לא MSE · MSE בלבד: בחירה מכוונת ללקוח שאצלו WebRTC בלתי אפשרי (אין UDP ישיר ל־go2rtc: Ingress, Cloudflare, CGNAT)</span></span>
          <sw-field class="ctl"><select data-set-transport-default ?disabled=${!s||!this.canEdit} @change=${a=>this.set("media.transport_default",a.target.value)}>
            ${["auto","webrtc","mse"].map(a=>i`<option value=${a} ?selected=${(this.value("media.transport_default")??Qe)===a}>${a===Qe?`${Je(a)} — ברירת המחדל`:Je(a)}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">הודעות על אופן ההזרמה<span class="muted">הודעה על הנגן כשהווידאו עובר ב־MSE במקום WebRTC, ושורות ההסבר מתחת למצלמה. כבוי (ברירת מחדל): המסך נקי, והתג על הנגן ממשיך להראות מה מתנגן ומסביר בריחוף. הפעלה מתאימה למי שבודק בעיית תעבורה</span></span>
          <sw-field class="ctl"><select data-set-video-notices ?disabled=${!s||!this.canEdit} @change=${a=>this.set("media.video_notices",a.target.value)}>
            <option value="false" ?selected=${String(this.value("media.video_notices")??"false")!=="true"}>מוסתרות</option><option value="true" ?selected=${String(this.value("media.video_notices")??"false")==="true"}>מוצגות</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">קידוד H.265 בדפדפן<span class="muted">מצלמה שהזרם שלה H.265 ודפדפן שלא מפענח אותו (Chrome ו־Edge ב־WebRTC). אוטומטי (ברירת מחדל): הזרם האחר של המצלמה כשהוא H.264, אחרת תרגום ל־H.264 בשרת הווידאו, אחרת הודעה על האריח · תמיד זרם משני: רק הזרם האחר · תמיד תרגום: רק תרגום · כבוי: הזרם כמו שהוא. קידוד ה־NVR לא משתנה</span></span>
          <sw-field class="ctl"><select data-set-h265-policy ?disabled=${!s||!this.canEdit} @change=${a=>this.set("media.h265_policy",a.target.value)}>
            ${hr.map(([a,r])=>i`<option value=${a} ?selected=${di(this.value("media.h265_policy"))===a}>${r}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">תרגומים במקביל<span class="muted">כמה מצלמות שונות מתורגמות ל־H.264 בו־זמנית (התרגום כבד על המעבד של שרת הווידאו). מעבר למכסה האריח מציג תמונה מתעדכנת עם הודעה. 0 = בלי תרגום</span></span>
          <sw-field class="ctl"><select data-set-h265-transcodes ?disabled=${!s||!this.canEdit} @change=${a=>this.set("media.h265_max_transcodes",Number(a.target.value))}>
            ${[0,1,2,3,4,6,8].map(a=>i`<option value=${a} ?selected=${Number(this.value("media.h265_max_transcodes")??2)===a}>${a===2?`${a} — ברירת המחדל`:a===0?"0 — בלי תרגום":a}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">מצלמה שה־NVR מסרב לשנות<span class="muted">בהמרת קידוד לכמה מצלמות (למשל הכל ל־H.264). לדלג ולהמשיך (ברירת מחדל): המצלמה נשארת כמו שהיא, נרשמת בדוח הבדיקה, וההמרה ממשיכה · לעצור: ההמרה נעצרת במצלמה הראשונה שנדחתה. אפשר לשנות גם לפני כל המרה</span></span>
          <sw-field class="ctl"><select data-set-batch-refusal ?disabled=${!s||!this.canEdit} @change=${a=>this.set("nvr.batch_on_refusal",a.target.value)}>
            ${br.map(([a,r])=>i`<option value=${a} ?selected=${(this.value("nvr.batch_on_refusal")==="stop"?"stop":"skip")===a}>${r}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">פרופיל לקיר המצלמות<span class="muted">משני חוסך CPU ורוחב פס; ראשי לתצוגה בודדת</span></span>
          <sw-field class="ctl"><select ?disabled=${!s||!this.canEdit} @change=${a=>this.set("media.wall_profile",a.target.value)}>
            <option value="sub" ?selected=${(this.value("media.wall_profile")??"sub")==="sub"}>משני</option><option value="main" ?selected=${this.value("media.wall_profile")==="main"}>ראשי</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מצלמות בקיר כברירת מחדל<span class="muted">כל דפדפן זוכר את הבחירה האחרונה שלו; זו נקודת הפתיחה. מעל מכסת הזרמים החיים האריחים מציגים צילום</span></span>
          <sw-field class="ctl"><select data-set-wall-count ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.wall_count",Number(a.target.value))}>
            ${[1,2,4,6,8,9,12,16,20,25,32].map(a=>i`<option value=${a} ?selected=${Number(this.value("ui.wall_count")??4)===a}>${a}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">פריסת קיוסק כברירת מחדל<span class="muted">עמודות × שורות בעמוד; קישור קיוסק עם cols/rows גובר</span></span>
          <sw-field class="ctl"><select data-set-kiosk-layout ?disabled=${!s||!this.canEdit} @change=${a=>{const[r,d]=a.target.value.split("x").map(Number);this.set("ui.kiosk_cols",r),this.set("ui.kiosk_rows",d)}}>
            ${[[2,2],[3,2],[3,3],[4,3],[4,4],[5,4],[6,4]].map(([a,r])=>i`<option value=${`${a}x${r}`} ?selected=${Number(this.value("ui.kiosk_cols")??3)===a&&Number(this.value("ui.kiosk_rows")??2)===r}>${a}×${r} · ${a*r} מצלמות</option>`)}
          </select></sw-field></div>
        <div class="row" data-set-wall-phone-bar-row><span class="lbl">${ji}<span class="muted">${Vi}</span></span>
          <sw-field class="ctl"><select data-set-wall-phone-bar ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.wall_phone_bar",aa(a.target.value))}>
            ${Ui.map(([a,r])=>i`<option value=${a} ?selected=${aa(this.value("ui.wall_phone_bar"))===a}>${r}</option>`)}
          </select></sw-field></div>`}
        <div class="row"><span class="lbl">מסך פתיחה<span class="muted">המסך שהמערכת נפתחת עליו כשהכתובת לא מציינת מסך (ריענון של הכתובת הראשית)</span></span>
          <sw-field class="ctl"><select data-set-start-route ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.start_route",a.target.value)}>
            ${n.map(([a,r])=>i`<option value=${a} ?selected=${String(this.value("ui.start_route")??"devices")===a}>${r}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">הסתרת המפה<span class="muted">מסיר את אזור המפה מהניווט לכל המשתמשים; למשתמש בודד: תפקיד בלי ההרשאה map.read</span></span>
          <sw-field class="ctl"><select data-set-hide-map ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.hide_map",a.target.value)}>
            <option value="false" ?selected=${String(this.value("ui.hide_map")??"false")!=="true"}>מוצגת</option><option value="true" ?selected=${String(this.value("ui.hide_map")??"false")==="true"}>מוסתרת</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">גודל תצוגת WisKey<span class="muted">רגיל: ממלא את אזור התוכן. מותאם: WisKey מוצג בגודל וירטואלי גדול יותר ומוקטן, כך שנכנסים בו יותר כרטיסים ואריחים. מסך מלא: מכסה את כל החלון (יציאה: כפתור קטן בפינה, Esc או חזרה)</span></span>
          <sw-field class="ctl"><select data-set-wiskey-size ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.wiskey_size",a.target.value)}>
            ${[["normal","רגיל"],["fit","מותאם"],["full","מסך מלא"]].map(([a,r])=>i`<option value=${a} ?selected=${(this.value("ui.wiskey_size")??"normal")===a}>${r}</option>`)}
          </select></sw-field></div>
        ${(this.value("ui.wiskey_size")??"normal")==="fit"?i`<div class="row"><span class="lbl">קנה מידה במצב מותאם<span class="muted">100% זהה לרגיל; ככל שהמספר נמוך יותר WisKey מציג יותר, בכתב קטן יותר</span></span>
              <sw-field class="ctl"><select data-set-wiskey-scale ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.wiskey_scale",a.target.value)}>
                ${["100","90","80","70"].map(a=>i`<option value=${a} ?selected=${String(this.value("ui.wiskey_scale")??"90")===a}>${a}%</option>`)}
              </select></sw-field></div>`:o}
        <div class="row"><span class="lbl">מספר כרטיסים בסקירת WisKey<span class="muted">נקודת הפתיחה בכל טעינה; משתמש יכול לבחור אחרת בחשבון שלו. שינוי בתוך WisKey אינו נשמר. אוטומטי: WisKey מחליט לפי הגודל הפנוי</span></span>
          <sw-field class="ctl"><select data-set-wiskey-density ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.wiskey_density",a.target.value)}>
            ${["auto","4","6","8","9","12"].map(a=>i`<option value=${a} ?selected=${String(this.value("ui.wiskey_density")??"auto")===a}>${a==="auto"?"אוטומטי":a}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">מספר מצלמות בקיר WisKey<span class="muted">נקודת הפתיחה של קיר המצלמות; משתמש יכול לבחור אחרת בחשבון שלו. ברירת מחדל: 4 (12 דורש מספיק מצלמות פעילות ורוחב פס)</span></span>
          <sw-field class="ctl"><select data-set-wiskey-wall ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.wiskey_wall",a.target.value)}>
            ${["auto","4","9","12"].map(a=>i`<option value=${a} ?selected=${String(this.value("ui.wiskey_wall")??"auto")===a}>${a==="auto"?"ברירת מחדל":a}</option>`)}
          </select></sw-field></div>
        ${t?o:i`<div class="row"><span class="lbl">HA recorder כמקור משני להיסטוריה<span class="muted">במפה ההיסטורית: כשההיסטוריה המקומית לא יודעת מצב של ישות, הוא נקרא מה־recorder של Home Assistant ומסומן כמקור משני</span></span>
          <sw-field class="ctl"><select data-set-ha-secondary ?disabled=${!s||!this.canEdit} @change=${a=>this.set("history.ha_secondary",a.target.value)}>
            <option value="false" ?selected=${String(this.value("history.ha_secondary")??"false")!=="true"}>כבוי</option><option value="true" ?selected=${String(this.value("history.ha_secondary")??"false")==="true"}>פעיל</option>
          </select></sw-field></div>`}
        ${t?o:i`<div class="row" data-set-timescrub-row><span class="lbl">ציר זמן במפה ההיסטורית<span class="muted">שכבות, ניגון תקופה ופסי שינויים לכל שכבה במפה ההיסטורית</span></span>
          <sw-field class="ctl"><select data-set-timescrub ?disabled=${!s||!this.canEdit} @change=${a=>this.set("history.timescrub",a.target.value)}>
            <option value="false" ?selected=${String(this.value("history.timescrub")??"false")!=="true"}>כבוי</option><option value="true" ?selected=${String(this.value("history.timescrub")??"false")==="true"}>פעיל</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">טווח ניגון מרבי (ימים)<span class="muted">החלון הארוך ביותר שבקשת ניגון אחת יכולה לכסות</span></span><sw-field class="ctl"><input type="number" min="1" max="30" data-ltr data-set-range-max-days ?disabled=${!s||!this.canEdit} .value=${String(this.value("history.range_max_days")??7)} @change=${a=>this.set("history.range_max_days",Number(a.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">נוכחות בהיסטוריה - ימי שמירה<span class="muted">מצבי חיישני תנועה ונוכחות ישנים יותר נמחקים מההיסטוריה המקומית</span></span><sw-field class="ctl"><input type="number" min="1" max="30" data-ltr data-set-presence-retention ?disabled=${!s||!this.canEdit} .value=${String(this.value("history.presence_retention_days")??7)} @change=${a=>this.set("history.presence_retention_days",Number(a.target.value))} /></sw-field></div>`}
        <div class="row"><span class="lbl">מידות לפני כיול<span class="muted">בעורך התוכנית, כשגרסת התוכנית עדיין לא כוילה: להציג אורכים ושטחים משוערים עם ≈, או להסתיר מטרים עד הכיול</span></span>
          <sw-field class="ctl"><select data-set-plan-estimates ?disabled=${!s||!this.canEdit} @change=${a=>this.set("plan.estimates",a.target.value)}>
            <option value="true" ?selected=${String(this.value("plan.estimates")??"true")!=="false"}>משוערות עם ≈</option><option value="false" ?selected=${String(this.value("plan.estimates")??"true")==="false"}>מוסתרות עד כיול</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מפלסים בפתיחת מפה<span class="muted">המפלס שמוצג כברירת מחדל בכל מפה; שבבי המפלסים ממשיכים לאפשר מעבר בין מפלסים</span></span>
          <sw-field class="ctl"><select data-set-plan-levels ?disabled=${!s||!this.canEdit} @change=${a=>this.set("plan.levels",a.target.value)}>
            <option value="all" ?selected=${String(this.value("plan.levels")??"all")!=="default"}>כל המפלסים יחד</option><option value="default" ?selected=${String(this.value("plan.levels")??"all")==="default"}>מפלס ברירת המחדל של הקומה</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מצב תצוגה ברירת מחדל<span class="muted">מצב התלת-ממד במפה לכל המשתמשים. רק במצב אוטומטי התצוגה יורדת לבד לסכמטי; בחירה ידנית נשארת</span></span>
          <sw-field class="ctl"><select data-set-plan-quality ?disabled=${!s||!this.canEdit} @change=${a=>this.set("plan.quality",a.target.value)}>
            ${Oi.map(a=>i`<option value=${Ni(a)} ?selected=${(Mi(this.value("plan.quality"))??"auto")===a}>${Ti[a]} — ${Ri[a]}</option>`)}
          </select></sw-field></div>
        <div class="row" data-plan-quality-own-row><span class="lbl">מצב התצוגה שלי<span class="muted">גובר על ברירת המחדל, רק עבורך; גם הבחירה בסרגל התלת-ממד נשמרת כאן</span></span>
          <sw-field class="ctl"><select data-set-plan-quality-own ?disabled=${this.ownQuality===void 0} @change=${a=>void this.saveOwnQuality(a.target.value)}>
            <option value="" ?selected=${!this.ownQuality}>לפי ברירת המחדל</option>
            ${Pi.map(a=>i`<option value=${a} ?selected=${this.ownQuality===a}>${Hi[a]}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">דעיכת סימון תנועה במפה<span class="muted">חדר שזוהתה בו תנועה נצבע בכחול; הצבע דוהה במשך הזמן הזה אחרי שהתנועה פסקה (כבוי: רק בזמן התנועה)</span></span>
          <sw-field class="ctl"><select data-set-plan-presence-fade ?disabled=${!s||!this.canEdit} @change=${a=>this.set("plan.presence_fade",a.target.value)}>
            ${[["off","כבוי — רק בזמן תנועה"],["1","דקה"],["2","2 דקות"],["3","3 דקות"],["5","5 דקות"],["10","10 דקות"],["15","15 דקות"],["30","30 דקות"],["60","שעה"]].map(([a,r])=>i`<option value=${a} ?selected=${String(this.value("plan.presence_fade")??"3")===a}>${r}</option>`)}
          </select></sw-field></div>
        <div class="row" data-set-stills-row><span class="lbl">מסך קיר — תצוגת התוכנית<span class="muted">מסך קיר מציג תלת־ממד חי; תמונות מוכנות חוסכות חום וסוללה. קומה בלי תמונות מוכנות נשארת בתלת־ממד חי</span></span>
          <sw-field class="ctl"><select data-set-wall-display ?disabled=${!s||!this.canEdit} @change=${a=>this.setView({wall_display:a.target.value})}>
            <option value="live" ?selected=${this.viewValue("wall_display","live")!=="stills"}>תלת־ממד חי</option><option value="stills" ?selected=${this.viewValue("wall_display","live")==="stills"}>תמונות מוכנות</option>
          </select></sw-field></div>
        <div class="row" data-set-kiosk-idle-row><span class="lbl">מסך קיר — מעבר לתמונה מוכנה<span class="muted">אחרי הזמן הזה בלי נגיעה ובלי שינוי בתוכנית, מסך קיר עובר לתמונה המוכנה ומפסיק לצייר פריימים; נגיעה או שינוי מחזירים את התלת־ממד. כל מסך קיר יכול לקבוע זאת בעצמו (הגדרות ‹ מסכי קיר)</span></span>
          <sw-field class="ctl"><select data-set-kiosk-idle ?disabled=${!s||!this.canEdit} @change=${a=>this.setView({kiosk_idle_s:Number(a.target.value)})}>
            ${[[0,"לעולם לא"],[10,"10 שניות"],[30,"30 שניות"],[120,"2 דקות"],[600,"10 דקות"]].map(([a,r])=>i`<option value=${a} ?selected=${this.viewValue("kiosk_idle_s",30)===a}>${r}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">תמונות מוכנות — סגנונות ושעות<span class="muted">מה „הכן תמונות ותאורה” מצייר לכל קומה: יותר סגנונות ושעות = יותר תמונות ואחסון</span></span>
          <sw-field class="ctl"><select data-set-bake-styles ?disabled=${!s||!this.canEdit} @change=${a=>this.setBakes({styles:a.target.value.split(",")})}>
            ${[["light,dark","שני הסגנונות"],["light","אדריכלי בהיר"],["dark","תאום דיגיטלי כהה"]].map(([a,r])=>i`<option value=${a} ?selected=${this.bakeValue("styles",["light","dark"]).join(",")===a}>${r}</option>`)}
          </select></sw-field>
          <sw-field class="ctl"><select data-set-bake-bands ?disabled=${!s||!this.canEdit} @change=${a=>this.setBakes({bands:a.target.value.split(",")})}>
            ${[["day,sunset,night","יום, שקיעה ולילה"],["day,night","יום ולילה"],["day","יום בלבד"]].map(([a,r])=>i`<option value=${a} ?selected=${this.bakeValue("bands",["day","sunset","night"]).join(",")===a}>${r}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">תמונות מוכנות — הפעלה ומבטים<span class="muted">ידני: העורך לוחץ „הכן תמונות ותאורה”. אוטומטי: ההכנה מתחילה לבד כשעורך פותח קומה שתמונותיה חסרות או אינן מעודכנות (בדפדפן שלו)</span></span>
          <sw-field class="ctl"><select data-set-bake-trigger ?disabled=${!s||!this.canEdit} @change=${a=>this.setBakes({bake_trigger:a.target.value})}>
            <option value="manual" ?selected=${this.bakeValue("bake_trigger","manual")!=="auto"}>ידני — בלחיצה</option><option value="auto" ?selected=${this.bakeValue("bake_trigger","manual")==="auto"}>אוטומטי — בפתיחת קומה</option>
          </select></sw-field>
          <sw-field class="ctl"><select data-set-bake-views ?disabled=${!s||!this.canEdit} @change=${a=>this.setBakes({bake_views:a.target.value})}>
            <option value="iso" ?selected=${this.bakeValue("bake_views","iso")!=="iso_top"}>מבט איזומטרי בלבד</option><option value="iso_top" ?selected=${this.bakeValue("bake_views","iso")==="iso_top"}>איזומטרי ומבט מלמעלה</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">תמונות מוכנות — גודל ומפת תאורה<span class="muted">מפת התאורה מוסיפה הצללה רכה ואור מנורות לתצוגה הריאליסטית</span></span>
          <sw-field class="ctl"><select data-set-bake-size ?disabled=${!s||!this.canEdit} @change=${a=>this.setBakes({size:a.target.value})}>
            ${["1280x800","1600x1000","1920x1200"].map(a=>i`<option value=${a} ?selected=${this.bakeValue("size","1600x1000")===a}>${a.replace("x","×")}</option>`)}
          </select></sw-field>
          <sw-field class="ctl"><select data-set-bake-lightmap ?disabled=${!s||!this.canEdit} @change=${a=>this.setBakes({lightmap:a.target.value==="true"})}>
            <option value="true" ?selected=${this.bakeValue("lightmap",!0)!==!1}>עם מפת תאורה</option><option value="false" ?selected=${this.bakeValue("lightmap",!0)===!1}>בלי מפת תאורה</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">אחסון לתמונות מוכנות<span class="muted">לכל קומה / לכל המערכת. כשנגמר המקום נמחקות קודם תמונות שאינן מעודכנות; תמונות מעודכנות לא נמחקות לבד</span></span>
          <sw-field class="ctl"><select data-set-bake-floor-cap ?disabled=${!s||!this.canEdit} @change=${a=>this.setBakes({floor_cap_mb:Number(a.target.value)})}>
            ${[16,32,64,128,256].map(a=>i`<option value=${a} ?selected=${this.bakeValue("floor_cap_mb",64)===a}>${a} MB לקומה</option>`)}
          </select></sw-field>
          <sw-field class="ctl"><select data-set-bake-total-cap ?disabled=${!s||!this.canEdit} @change=${a=>this.setBakes({total_cap_mb:Number(a.target.value)})}>
            ${[128,256,512,1024,2048].map(a=>i`<option value=${a} ?selected=${this.bakeValue("total_cap_mb",512)===a}>${a>=1024?`${a/1024} GB`:`${a} MB`} בסך הכול</option>`)}
          </select></sw-field></div>
        ${s&&this.canEdit?this.renderSiteLocation(s):o}
        <div class="row" data-global-search-row><span class="lbl">${ia("label")}<span class="muted">${ia("hint")}</span></span>
          <sw-search-access .mode=${Gi(this.value("ui.global_search"))} .roles=${String(this.value("ui.global_search_roles")??"")} ?disabled=${!s||!this.canEdit}
            @sw-search-access-change=${a=>{this.set("ui.global_search",a.detail.mode),this.set("ui.global_search_roles",qi(a.detail.roles).join(","))}}></sw-search-access></div>
        ${t?o:i`<div class="row"><span class="lbl">הסתרת חיפוש AI<span class="muted">מסיר את הלשונית מהניווט; המסך עצמו נשאר זמין בכתובת</span></span>
          <sw-field class="ctl"><select data-set-hide-search ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.hide_search",a.target.value)}>
            <option value="false" ?selected=${String(this.value("ui.hide_search")??"false")!=="true"}>מוצג</option><option value="true" ?selected=${String(this.value("ui.hide_search")??"false")==="true"}>מוסתר</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">תמונת מצב באבטחה<span class="muted">העמוד הראשון בלייב; כשהוא מוסתר, לייב נפתח על כל המצלמות והכתובת הישנה מפנה אליהן</span></span>
          <sw-field class="ctl"><select data-set-security-snapshot ?disabled=${!s||!this.canEdit} @change=${a=>this.set("ui.security_snapshot",a.target.value)}>
            <option value="true" ?selected=${String(this.value("ui.security_snapshot")??"true")!=="false"}>מוצגת</option><option value="false" ?selected=${String(this.value("ui.security_snapshot")??"true")==="false"}>מוסתרת</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">מקסימום זרמים חיים במקביל<span class="muted">מגן על ה־NVR; מעבר למכסה מוצג צילום בלבד</span></span><sw-field class="ctl"><input type="number" min="1" max="128" data-ltr data-live-max-sessions ?disabled=${!s||!this.canEdit} .value=${String(this.value("media.max_live_sessions")??16)} @change=${a=>this.set("media.max_live_sessions",Number(a.target.value))} /></sw-field></div>
        ${this.liveCapWarning("media.max_live_sessions")?i`<div class="err" data-live-warning style="margin-block-start:-4px">${this.liveCapWarning("media.max_live_sessions")}</div>`:o}
        <div class="row"><span class="lbl">רעננות צילום (שניות)<span class="muted">snapshot מה־NVR לאריחים; cache בשרת</span></span><sw-field class="ctl"><input type="number" min="5" max="3600" data-ltr ?disabled=${!s||!this.canEdit} .value=${String(this.value("snapshots.max_age_s")??60)} @change=${a=>this.set("snapshots.max_age_s",Number(a.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">סשני ניגון במקביל<span class="muted">כל ניגון = זרם playback אחד מה־NVR דרך go2rtc</span></span><sw-field class="ctl"><input type="number" min="1" max="128" data-ltr data-playback-max-sessions ?disabled=${!s||!this.canEdit} .value=${String(this.value("playback.max_sessions")??4)} @change=${a=>this.set("playback.max_sessions",Number(a.target.value))} /></sw-field></div>
        ${this.playbackWarning()?i`<div class="err" data-playback-warning style="margin-block-start:-4px">${this.playbackWarning()}</div>`:o}
        <div class="row" data-set-cross-sync-row><span class="lbl">ניגון מסונכרן בין מקליטים (ניסיוני)<span class="muted">לא הוכח על שני מקליטים אמיתיים. כבוי: ניגון מסונכרן רק למצלמות של אותו NVR. פעיל: כל מצלמה מנוגנת לפי אזור הזמן וסטיית השעון של המקליט שלה</span></span>
          <sw-field class="ctl"><select data-set-cross-sync ?disabled=${!s||!this.canEdit} @change=${a=>this.set("playback.cross_recorder_sync",a.target.value)}>
            <option value="false" ?selected=${String(this.value("playback.cross_recorder_sync")??"false")!=="true"}>כבוי</option><option value="true" ?selected=${String(this.value("playback.cross_recorder_sync")??"false")==="true"}>פעיל (ניסיוני)</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">פקיעת סשן ניגון ללא פעילות (שניות)<span class="muted">אחרי הזמן הזה הזרם נמחק מ־go2rtc אוטומטית</span></span><sw-field class="ctl"><input type="number" min="60" max="3600" data-ltr ?disabled=${!s||!this.canEdit} .value=${String(this.value("playback.lease_s")??600)} @change=${a=>this.set("playback.lease_s",Number(a.target.value))} /></sw-field></div>
        <div class="row" data-set-stall-row><span class="lbl">זיהוי תקיעה בניגון (שניות)<span class="muted">ללא התקדמות בזמן הזה הנגן מציג "מתחבר מחדש" וממשיך מאותה נקודה</span></span><sw-field class="ctl"><input type="number" min="2" max="30" data-ltr data-set-stall-s ?disabled=${!s||!this.canEdit} .value=${String(this.value("playback.stall_s")??5)} @change=${a=>this.set("playback.stall_s",Number(a.target.value))} /></sw-field></div>
        <div class="row" data-set-stall-attempts-row><span class="lbl">ניסיונות חיבור מחדש אוטומטיים<span class="muted">אחריהם: "הניגון נעצר" עם כפתור נסה שוב. 0 = בלי ניסיון אוטומטי</span></span><sw-field class="ctl"><input type="number" min="0" max="5" data-ltr data-set-stall-attempts ?disabled=${!s||!this.canEdit} .value=${String(this.value("playback.auto_resume_attempts")??3)} @change=${a=>this.set("playback.auto_resume_attempts",Number(a.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">גודל ייצוא מקסימלי (MB)<span class="muted">לפי הנפח המשוער של קבצי ה־NVR בטווח</span></span><sw-field class="ctl"><input type="number" min="50" max="20480" data-ltr ?disabled=${!s||!this.canEdit} .value=${String(this.value("exports.max_mb")??2048)} @change=${a=>this.set("exports.max_mb",Number(a.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת קבצי ייצוא (ימים)<span class="muted">אחרי התקופה הקבצים נמחקים מ־/data/exports</span></span><sw-field class="ctl"><input type="number" min="1" max="365" data-ltr ?disabled=${!s||!this.canEdit} .value=${String(this.value("exports.retention_days")??7)} @change=${a=>this.set("exports.retention_days",Number(a.target.value))} /></sw-field></div>`}
        <div class="row"><span class="lbl">שמירת אירועים (ימים)<span class="muted">אירועים ישנים יותר נמחקים מהמאגר המקומי</span></span><sw-field class="ctl"><input type="number" min="1" max="3650" data-ltr data-set-events-retention ?disabled=${!s||!this.canEdit} .value=${String(this.value("events.retention_days")??30)} @change=${a=>this.set("events.retention_days",Number(a.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת היסטוריית פעילות (ימים)<span class="muted">מי הדליק, כיבה או שינה התקן; שורות ישנות יותר נמחקות</span></span><sw-field class="ctl"><input type="number" min="7" max="365" data-ltr data-set-activity-retention ?disabled=${!s||!this.canEdit} .value=${String(this.value("device_activity.retention_days")??90)} @change=${a=>this.set("device_activity.retention_days",Number(a.target.value))} /></sw-field></div>
        <div class="row"><span class="lbl">שמירת אודיט (ימים)<span class="muted">מי עשה מה ומתי — כתיבות ל־NVR, שינויי הרשאות, ייצוא; שורות ישנות יותר נמחקות</span></span><sw-field class="ctl"><input type="number" min="30" max="3650" data-ltr data-set-audit-retention ?disabled=${!s||!this.canEdit} .value=${String(this.value("audit.retention_days")??365)} @change=${a=>this.set("audit.retention_days",Number(a.target.value))} /></sw-field></div>
        ${t?o:i`<div class="row"><span class="lbl">גודל מרבי לחבילת ראיות (MB)<span class="muted">אימות וייבוא של חבילה מהתקנה אחרת; הקובץ נכתב לקובץ זמני ונמחק</span></span><sw-field class="ctl"><input type="number" min="16" max="4096" data-ltr data-set-import-max ?disabled=${!s||!this.canEdit} .value=${String(this.value("cases.import_max_mb")??512)} @change=${a=>this.set("cases.import_max_mb",Number(a.target.value))} /></sw-field></div>`}
        <div class="row"><span class="lbl">אזור זמן של האתר וה־NVR<span class="muted">IANA · חיפוש והקלטות מתורגמים לשעון הקיר של ה־NVR לפי הכלל הזה (כולל שעון קיץ)</span></span><sw-field class="ctl"><input type="text" data-ltr ?disabled=${!s||!this.canEdit} .value=${String(this.value("time.zone")??"Asia/Jerusalem")} @change=${a=>this.set("time.zone",a.target.value.trim())} /></sw-field></div>
        <div class="row" data-set-fast-network-row><span class="lbl">שרת: רכיב תקשורת מהיר<span class="muted">רכיבי התקשורת המהירים (uvloop ו־httptools) במקום הרגילים. כבוי (ברירת המחדל) יציב יותר. השינוי חל אחרי הפעלה מחדש של התוסף</span></span>
          <sw-field class="ctl"><select data-set-fast-network ?disabled=${!s||!this.canEdit} @change=${a=>this.set("server.fast_network",a.target.value)}>
            <option value="false" ?selected=${String(this.value("server.fast_network")??"false")!=="true"}>כבוי</option><option value="true" ?selected=${String(this.value("server.fast_network")??"false")==="true"}>פעיל</option>
          </select></sw-field></div>
        <div class="row" data-set-video-notice-row><span class="lbl">התראה על שירות וידאו לא זמין<span class="muted">כמה זמן שירות הווידאו לא עונה לפני שמנהלי המערכת מקבלים התראה. הפסקה קצרה (הפעלה מחדש של השירות) לא שולחת התראה</span></span>
          <sw-field class="ctl"><select data-set-video-notice-after ?disabled=${!s||!this.canEdit} @change=${a=>this.set("media.video_notice_after_min",Number(a.target.value))}>
            ${ci.map(a=>i`<option value=${a} ?selected=${pi(this.value("media.video_notice_after_min"))===a}>אחרי ${ui(a)}</option>`)}
          </select></sw-field></div>
        ${this.renderSaveRow({tab:"media",disabled:!e||this.busy||!s,onSave:()=>this.save()})}
        ${s?o:i`<div class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</div>`}
      </sw-card>
      ${t?o:i`<system-timeline-colors></system-timeline-colors>`}
      ${this.renderSkins()}
      <sw-card heading="שירות וידאו" subheading="שירותי הווידאו שנמצאו בהתקנה, מצבם, ובאיזה מהם המערכת משתמשת" data-video-services-card>
        ${!s||!this.canEdit?i`<div class="muted">${s?"נדרשת הרשאת מנהל מערכת.":"נתוני הדגמה."}</div>`:i`<sw-video-service-picker @video-service-changed=${()=>this.loadMedia()}></sw-video-service-picker>`}
      </sw-card>
      <sw-card heading="go2rtc" subheading="זרמים של המוצר בשרת החיצוני (קריאה); זרמים זרים אינם מוצגים ואינם משתנים">
        ${!s||!this.canEdit?i`<div class="muted">${s?"נדרשת הרשאת מנהל מערכת.":"נתוני הדגמה."}</div>`:i`<div class="row"><span class="lbl">שרת<span class="muted">${this.go2rtc?`גרסה ${String(this.go2rtc.version??"?")}`:"לא נבדק"}</span></span><span class="end"><sw-button size="sm" icon="refresh" ?disabled=${this.busy} @click=${()=>this.loadMedia()}>בדיקה</sw-button><sw-button size="sm" variant="primary" icon="link" ?disabled=${this.busy} @click=${()=>this.sync()}>סנכרון זרמים</sw-button></span></div>
              ${this.streams===null?o:this.streams.length?this.streams.map(a=>{const r=hi(a);return i`<div class="stream" data-stream-state=${r.state}><span>${a.name}</span><span>${r.text}</span></div>`}):i`<div class="muted">אין עדיין זרמים של המוצר — לחץ "סנכרון זרמים".</div>`}
              ${this.streams!==null?i`<div class="muted" style="margin-block-start:6px">${this.foreign} זרמים זרים (אינטרקום, מצלמות אחרות) קיימים בשרת ולא נגענו בהם.</div>`:o}`}
      </sw-card>
      ${s&&this.canEdit?i`<sw-card heading="זרמים חיים כרגע" subheading="sessions דרך ה־relay של ה־Add-on">
            ${this.sessions.length?this.sessions.map(a=>i`<div class="row"><span class="lbl">${a.stream}<span class="muted">${a.username} · ${a.seconds} שנ׳ · ${(a.bytes_down/1024/1024).toFixed(1)} MB</span></span></div>`):i`<div class="muted">אין זרמים פתוחים.</div>`}
          </sw-card>`:o}
    </div>`}renderDefaultFloor(s){const e=String(this.value("map.default_floor")??""),t=this.floorTree.flatMap(n=>(n.buildings??[]).map(a=>({label:`${n.name} ‹ ${a.name}`,floors:a.floors??[]}))).filter(n=>n.floors.length);return i`<div class="row"><span class="lbl">קומת ברירת מחדל במפה<span class="muted">הקומה שנפתחת ראשונה כשנכנסים ללשונית "מפת קומה"; אוטומטי: הקומה הראשונה שהמשתמש רשאי לראות. משתמש שאינו רשאי לראות את הקומה שנבחרה מקבל את הקומה הראשונה שלו</span></span>
      <sw-field class="ctl"><select data-set-default-floor ?disabled=${!s||!this.canEdit} @change=${n=>this.set("map.default_floor",n.target.value)}>
        <option value="" ?selected=${e===""}>אוטומטי</option>
        ${t.map(n=>i`<optgroup label=${n.label}>${n.floors.map(a=>i`<option value=${a.id} ?selected=${a.id===e}>${a.name}</option>`)}</optgroup>`)}
      </select></sw-field></div>`}renderMap(){const s=b(),e=Object.keys(this.draft).length>0,t=this.value("plan.surfaces")??["devices","area"],n=(a,r,d,h)=>i`<sw-field class="ctl"><select data-set=${d} ?disabled=${!s||!this.canEdit}
        @change=${u=>this.set(a,u.target.value)}>${h.map(([u,$])=>i`<option value=${u} ?selected=${String(this.value(a)??r)===u}>${$}</option>`)}</select></sw-field>`;return i`<div class="sections">
      <sw-card heading="מפה" subheading="איך מפות הקומה נפתחות ומה מוצג בסרגל המפלסים" data-settings-map>
        ${this.renderDefaultFloor(s)}
        <div class="row"><span class="lbl">תצוגת פתיחה של מפה<span class="muted">המפה החיה, המפה ההיסטורית ודף האירוע נפתחים בתצוגה הזו כשלקומה יש מבנה; הכפתור 2D / 3D ממשיך להחליף בכל ביקור</span></span>
          ${n("map.default_view","2d","map-default-view",[["2d","דו-ממד (2D)"],["3d","תלת-ממד (3D)"]])}</div>
        <div class="row"><span class="lbl">מפלסים בפתיחת מפה<span class="muted">המפלס שמוצג כברירת מחדל בכל מפה; שבבי המפלסים ממשיכים לאפשר מעבר בין מפלסים</span></span>
          ${n("plan.levels","all","map-plan-levels",[["all","כל המפלסים יחד"],["default","מפלס ברירת המחדל של הקומה"]])}</div>
        <div class="row"><span class="lbl">מפלסים של חלל משותף<span class="muted">בעורך של הקומה שמציגה חלל משותף (חלל בגובה כפול שהרצפה שלו בקומה אחרת): להציג בסרגל המפלסים גם את מפלסי הקומה שלו ("מפלס ראשי · קומה -1")</span></span>
          ${n("map.shared_levels","show","map-shared-levels",[["show","מוצגים"],["hide","מוסתרים"]])}</div>
        <div class="row" data-plan-surfaces><span class="lbl">התוכנית החיה מחוץ ללשונית המפה<span class="muted">איפה עוד מוצגת תוכנית הקומה עם מצבי החדרים; כל מקום לחוד</span></span>
          <span class="ctl" style="display:flex;flex-direction:column;gap:6px">
            ${[["devices",'תצוגת "תוכנית" במסך חשמל והתקנים (העץ נשאר בצד)'],["area",'כרטיס "על התוכנית" בדף האזור']].map(([a,r])=>i`<label class="chk"><input type="checkbox" data-set-plan-surface=${a} ?disabled=${!s||!this.canEdit} .checked=${t.includes(a)} @change=${d=>this.set("plan.surfaces",d.target.checked?[...t.filter(h=>h!==a),a]:t.filter(h=>h!==a))} /> ${r}</label>`)}
          </span></div>
        <div class="row" data-camsuggest-distance><span class="lbl">הצעת מצלמה לאזור: טווח מרבי<span class="muted">בעורך התוכנית, כפתור "הצע מצלמה קרובה" באזור מציע רק מצלמות שנמצאות בתוך הטווח הזה מקצה האזור, באחוזים מרוחב התוכנית. ההצעה לא נשמרת עד שלוחצים "קבל"</span></span>
          ${n("plan.camsuggest_distance","35","camsuggest-distance",[["10","10%"],["20","20%"],["35","35%"],["50","50%"],["75","75%"],["100","100%"]])}</div>
        <div class="row" data-camsuggest-fov><span class="lbl">הצעת מצלמה לאזור: משקל כיוון הצילום<span class="muted">מצלמה עם שדה ראייה ידוע שאינה פונה אל האזור יורדת בדירוג; "מרחק בלבד" מתעלם מהכיוון, "חובה" מסתיר מצלמה שמחטיאה את האזור לגמרי</span></span>
          ${n("plan.camsuggest_fov","50","camsuggest-fov",[["0","מרחק בלבד"],["25","נמוך"],["50","בינוני"],["75","גבוה"],["100","חובה"]])}</div>
        <div class="row" data-camsuggest-count><span class="lbl">הצעת מצלמה לאזור: מספר הצעות</span>
          ${n("plan.camsuggest_count","3","camsuggest-count",[["1","אחת"],["2","שתיים"],["3","שלוש"]])}</div>
        <!-- PLAN3D-R32-ANSWERS-2438 (owner round 32): the 3D map's rows (room labels, room card, all floors) moved into the one
             "מפה תלת־ממדית" card below (system-plan-view), with the look dials and the plan wizard's thresholds -->
        ${this.renderSaveRow({tab:"map",hook:"data-save-map",disabled:!e||this.busy||!s,onSave:()=>this.save()})}
        ${s?o:i`<div class="muted">נתוני הדגמה: ההגדרות נשמרות רק מול השרת.</div>`}
      </sw-card>
      <system-plan-view data-section="plan-view"></system-plan-view>
      ${s&&this.canEdit?i`<plan-area-links-admin data-section="area-links"></plan-area-links-admin>`:o}
    </div>`}renderSkins(){const s=b(),e=this.skins,n=["skins.model","skins.privacy_ack","skins.budget_renders_per_floor","skins.budget_monthly"].some(d=>d in this.draft),a=String(this.value("skins.privacy_ack")??"false")==="true",r=this.skinsTest;return i`<sw-card data-skins heading="סקינים מרונדרים (AI)" subheading="תמונה פוטוריאליסטית של קומה מספק רינדור חיצוני — נשלחת רק אחרי אישור, פעם אחת לקומה, ונשמרת לשימוש חוזר">
      <div class="row"><span class="lbl">ספק ומודל<span class="muted">OpenAI (עריכת תמונה לפי תמונת בקרה). המודל ניתן לשינוי כשיוצא מודל חדש</span></span>
        <sw-field class="ctl"><input type="text" data-ltr data-set-skins-model ?disabled=${!s||!this.canEdit} .value=${String(this.value("skins.model")??"gpt-image-1.5")} @change=${d=>this.set("skins.model",d.target.value.trim())} /></sw-field></div>
      <div class="row" data-skins-key><span class="lbl">מפתח API<span class="muted">מוזן בהגדרות ‹ חיבורים ‹ סודות ונשמר מוצפן; לא ביומנים, והמסך יודע רק אם הוגדר</span></span>
        <sw-badge kind=${e?.key_configured?"live":"unknown"} label=${e?e.key_configured?"מוגדר":"לא מוגדר":"—"}></sw-badge></div>
      <div class="row" data-skins-leaves style="flex-direction:column;align-items:stretch"><span class="lbl">מה יוצא מהמתקן לספק כשנשלח רינדור</span>
        <ul class="steps">${(e?.leaves??[]).map(d=>i`<li>${d}</li>`)}</ul>
        <span class="lbl">מה לעולם לא נשלח</span>
        <ul class="steps">${(e?.never_leaves??[]).map(d=>i`<li>${d}</li>`)}</ul></div>
      <div class="row"><span class="lbl">אישור פרטיות<span class="muted">כל עוד לא אושר, שום דבר לא נשלח — גם לא בדיקת החיבור</span></span>
        <sw-field class="ctl"><select data-set-skins-ack ?disabled=${!s||!this.canEdit} @change=${d=>this.set("skins.privacy_ack",d.target.value)}>
          <option value="false" ?selected=${!a}>לא אושר — לא נשלח דבר</option><option value="true" ?selected=${a}>אושר — מותר לשלוח את המתואר למעלה</option>
        </select></sw-field></div>
      <div class="row"><span class="lbl">רינדורים לקומה<span class="muted">לכל קומה ולכל גרסת מבנה (ברירת מחדל 4)</span></span><sw-field class="ctl"><input type="number" min="0" max="6" data-ltr data-set-skins-per-floor ?disabled=${!s||!this.canEdit} .value=${String(this.value("skins.budget_renders_per_floor")??4)} @change=${d=>this.set("skins.budget_renders_per_floor",Number(d.target.value))} /></sw-field></div>
      <div class="row"><span class="lbl">רינדורים בחודש<span class="muted">${e?`נוצלו החודש ${e.budget.used_month} מתוך ${e.budget.monthly_cap} (כולל בדיקות חיבור)`:"לכל ההתקנה, לחודש קלנדרי"}</span></span><sw-field class="ctl"><input type="number" min="0" max="500" data-ltr data-set-skins-monthly ?disabled=${!s||!this.canEdit} .value=${String(this.value("skins.budget_monthly")??20)} @change=${d=>this.set("skins.budget_monthly",Number(d.target.value))} /></sw-field></div>
      ${e?i`<div class="muted" data-skins-estimate>הערכת עלות לרינדור של קומה (${e.estimate.size}, ${e.estimate.quality}): כ־$${e.estimate.cost_estimate_usd} — הערכה בלבד, לא מחירון מאומת; העלות בפועל מופיעה בחשבון OpenAI.</div>`:o}
      ${this.canEdit&&s?i`<div class="foot">
            <sw-button variant="primary" icon="check" data-save-skins ?disabled=${!n||this.busy} @click=${()=>this.save().then(()=>this.loadSkins())}>שמור</sw-button>
            <sw-button icon="send" data-skins-test ?disabled=${this.skinsBusy||n} @click=${()=>this.runSkinsTest()}>בדיקת חיבור לספק הרינדור</sw-button>
            ${n?i`<span class="muted" style="align-self:center">שמור קודם — הבדיקה משתמשת בהגדרות השמורות</span>`:o}
          </div>
          <div class="muted">הבדיקה שולחת תמונת ניסיון סינתטית אחת בגודל 64×64 (פסי צבע ולוח שחמט — לא תוכנית ולא תמונה מהמתקן) עם הנחיה קבועה, נרשמת ביומן, ונספרת בתקציב החודשי.</div>`:o}
      ${this.skinsBusy?i`<div class="muted" data-skins-test-busy>שולח בקשת בדיקה…</div>`:o}
      ${this.skinsError?i`<div class="err" data-skins-test-error>${this.skinsError}</div>`:o}
      ${r?i`<div class="row" data-skins-test-result data-ok=${r.ok?"true":"false"}><span class="lbl">${r.ok?`הספק ענה: HTTP ${r.http_status}`:r.http_status?`הספק סירב: HTTP ${r.http_status}`:"הספק לא ענה"}<span class="muted">${r.model}${r.message?` · ${r.message}`:""}${r.request_id?` · ${r.request_id}`:""}${r.ok&&!r.image?" · התשובה לא כללה תמונה":""}</span></span>
            ${r.image?i`<img data-skins-test-image src=${r.image} alt="תשובת הספק לבדיקה" style="inline-size:96px;block-size:96px;object-fit:cover;border-radius:var(--sw-r-xs);border:1px solid var(--sw-border)" />`:o}</div>`:e?.last_test?i`<div class="muted" data-skins-last-test>בדיקה אחרונה: ${Q(e.last_test.created_at)} · ${e.last_test.status==="ok"?"הצליחה":`נכשלה (${e.last_test.error_code??e.last_test.http_status??""})`}</div>`:o}
    </sw-card>`}async loadSkins(){if(b())try{this.skins=await Ci()}catch{this.skins=null}}async runSkinsTest(){this.skinsBusy=!0,this.skinsError="",this.skinsTest=null;try{this.skinsTest=await Bi()}catch(s){this.skinsError=g(s)}finally{this.skinsBusy=!1,this.loadSkins()}}renderAccessControl(){if(!this.layoutKnown())return i`<div class="sections"><sw-state-panel compact state="loading"></sw-state-panel></div>`;const s=this.accessLayout();return pa(s)?this.renderAccessCards(s==="accordion"):this.renderAccessList(s)}accessDirty(s="all"){const e=ce.some(n=>`access.ui.${n.screen}`in this.draft),t="ui.hide_wiskey"in this.draft||"access.phone_embed"in this.draft||ys in this.draft;return s==="screens"?e:s==="area"?t:e||t}accessChoice(s,e=!1){const t=e?this.settings?.[`access.ui.${s}`]:this.value(`access.ui.${s}`);return String(t??"wiskey")==="smplwise"?"smplwise":"wiskey"}rowHideWiskey(s){return i`<div class="row"><span class="lbl">הצג את WisKey במערכת<span class="muted">הסתרה מסירה את כל אזור WisKey מהניווט לכל המשתמשים, ללא תלות בתפקיד; הבחירות למסכים הבודדים למטה חלות רק כשהאזור מוצג</span></span>
          <sw-field class="ctl"><select data-set-hide-wiskey ?disabled=${!s||!this.canEdit} @change=${e=>this.set("ui.hide_wiskey",e.target.value)}>
            <option value="false" ?selected=${String(this.value("ui.hide_wiskey")??"false")!=="true"}>מוצג</option><option value="true" ?selected=${String(this.value("ui.hide_wiskey")??"false")==="true"}>מוסתר</option>
          </select></sw-field></div>`}rowsScreens(s){return ce.map(e=>i`<div class="row"><span class="lbl">${e.label}<span class="muted">${e.detail} · <span class="ltr">${e.href}</span></span></span>
            <sw-field class="ctl"><select data-set-access-ui=${e.screen} ?disabled=${!s||!this.canEdit} @change=${t=>this.set(`access.ui.${e.screen}`,t.target.value)}>
              <option value="wiskey" ?selected=${this.accessChoice(e.screen)==="wiskey"}>WisKey (מוטמע)</option>
              <option value="smplwise" ?selected=${this.accessChoice(e.screen)==="smplwise"}>Arx</option>
            </select></sw-field></div>`)}rowPhoneEmbed(s){return i`<div class="row"><span class="lbl">הטמעה גם באפליקציית הטלפון (ניסיוני)<span class="muted">כבוי: באפליקציית הטלפון WisKey לא מוטמע - מוצג המסך של Arx או הערה, עם "פתח ב-WisKey". מופעל: Arx מעביר את ההזדהות של האפליקציה לתשתית המערכת שבתוך המסגרת. אם ההזדהות לא מצליחה, המסך חוזר לבד להתנהגות הרגילה.</span></span>
          <sw-field class="ctl"><select data-set-phone-embed ?disabled=${!s||!this.canEdit} @change=${e=>this.set("access.phone_embed",e.target.value)}>
            <option value="false" ?selected=${String(this.value("access.phone_embed")??"false")!=="true"}>כבוי</option><option value="true" ?selected=${String(this.value("access.phone_embed")??"false")==="true"}>מופעל</option>
          </select></sw-field></div>`}rowLayout(s){const e=A().layout,t=As(this.value(ys));return i`<div class="row" data-access-layout-row><span class="lbl">${e.label}<span class="muted">${e.text}</span></span>
          <sw-field class="ctl"><select data-set-access-layout aria-label=${e.label} ?disabled=${!s||!this.canEdit} @change=${n=>this.set(ys,As(n.target.value))}>
            ${Ta.map(n=>i`<option value=${n} ?selected=${t===n}>${n===Ra?`${e[n]} ${e.defaultMark}`:e[n]}</option>`)}
          </select></sw-field></div>`}rowFixed(){return i`<div class="row" data-access-ui-fixed><span class="lbl">שאר מסכי WisKey (סנכרון, בריאות, יומן שינויים, ניהול)<span class="muted">קיימים רק ב־WisKey, ולכן תמיד מוטמעים</span></span><sw-field class="ctl"><select disabled><option selected>WisKey (מוטמע) · קבוע</option></select></sw-field></div>`}accessNotes(){return i`<div class="muted" style="margin-block-start:8px">במסך מוטמע הדפדפן מריץ את הממשק של WisKey עצמו בתוך תשתית המערכת, עם החיבור של המשתמש אליה: ההרשאות, האישורים והאודיט שם הם של WisKey, לא של Arx. "פתח בחלון מלא" פותח את אותו לוח בלשונית נפרדת.</div>
        <div class="muted" data-access-ui-embed-api style="margin-block-start:6px">ההטמעה משתמשת בממשק ההטמעה של WisKey (WisKey 2.0.0-rc.19 ומעלה): הלשוניות נבנות מהמסכים ש־WisKey מתיר למשתמש והמעבר ביניהן נעשה בהודעות; בגרסאות WisKey ישנות יותר ההטמעה עוברת אוטומטית לשיטה הקודמת.</div>
        <div class="muted" data-access-ui-warning style="margin-block-start:6px;color:var(--sw-text)"><b>שים לב:</b> משתמש שחשבון תשתית המערכת שלו מחזיק ב־WisKey הרשאת ניהול (manage), או שהוא מנהל תשתית המערכת, יכול בתוך WisKey המוטמע לפתוח דלתות ולערוך אנשים (PIN, כרטיסים, תוקף) — בלי שלב האישור של Arx ובלי רישום באודיט של Arx. התיעוד של הפעולות האלה נמצא רק ביומן של WisKey.</div>`}accessSave(s,e,t){return this.canEdit?this.renderSaveRow({tab:"access-control",hook:e,disabled:!t||this.busy||!s,onSave:()=>this.save()}):i`<div class="muted">${s?"שינוי הבחירה דורש הרשאת מנהל מערכת.":"נתוני הדגמה: ההגדרות נשמרות רק מול השרת."}</div>`}renderAccessList(s){const e=b();return i`<div class="sections" data-access-layout=${s}>
      <sw-card heading="מתגי מסכי כניסה" subheading="לכל מסך: הממשק המקורי של WisKey מוטמע כמו שהוא, או המסך שנבנה ב־Arx. הלשונית נשארת באותו מקום ובאותו שם.">
        ${this.rowHideWiskey(e)}
        ${this.rowsScreens(e)}
        ${this.rowPhoneEmbed(e)}
        ${this.rowLayout(e)}
        ${this.rowFixed()}
        ${this.accessNotes()}
        ${this.accessSave(e,"data-save-access-ui",this.accessDirty())}
      </sw-card>
      ${s==="tabs"?i`<system-access-display show="display"></system-access-display>`:i`<system-access-display></system-access-display><system-call-banner></system-call-banner>`}
      ${!e||M("access.admin.read")?i`<system-access-parity></system-access-parity>`:o}
      <system-wiskey-pairing></system-wiskey-pairing>
      <system-wiskey-diagnostics></system-wiskey-diagnostics>
      <system-wiskey-validation-card></system-wiskey-validation-card>
    </div>`}renderAccessVoice(){return i`<div class="sections" data-access-layout="tabs" data-access-voice>
      <system-access-display show="announce"></system-access-display>
      <system-call-banner></system-call-banner>
    </div>`}cardPresent(s){const e=this.foldPresent[s];if(e!==void 0)return e;const t=b();switch(s){case"parity":case"checklist":return!t||M("access.admin.read");case"calls":case"pairing":case"diagnostics":return t&&M("system.configure");case"validation":return t&&bi("access.stations.manage");default:return!0}}cardSummary(s){if(s==="screens")return ua(dr(ce.map(e=>({label:e.label,choice:this.accessChoice(e.screen,!0)}))),this.accessDirty("screens"));if(s==="area"){const e=this.settings;return ua(cr(String(e?.["ui.hide_wiskey"]??"false")==="true",String(e?.["access.phone_embed"]??"false")==="true",As(e?.[ys])),this.accessDirty("area"))}return this.foldSummary[s]??A().sum.loading}pressCard(s,e,t){const n=Ms(s);if(!n)return;const a=nr(e,n,t);this.accessOpen=a,or(ta(),Xe.me?.user.id,a)}renderAccessCards(s=!1){const e=b(),t=A(),n=Na.map(f=>({id:f,title:t.title[f],summary:this.cardSummary(f),hidden:!this.cardPresent(f)})),a=n.filter(f=>!f.hidden).map(f=>f.id),r=this.accessOpen??lr(ta(),Xe.me?.user.id),d=!s&&this.accessWide,h=ir(r,a,d),u=!e||M("access.admin.read"),$=(f,L)=>i`<div class="afold-body" slot=${`b-${f}`} role="region" aria-label=${t.title[f]} data-access-fold=${f} ?hidden=${f!==h}>${L}</div>`;return i`<sw-fold-cards class="afolds" data-access-layout=${s?"accordion":"cards"} ?inplace=${s} label=${t.cardsLabel} .cards=${n} .open=${h}
        @fold-toggle=${f=>this.pressCard(f.detail.id,h,d)} @fold-wide=${f=>this.accessWide=f.detail.wide}>
      ${$("screens",i`<sw-card data-access-ui-card="screens">${this.rowsScreens(e)}${this.rowFixed()}${this.accessSave(e,"data-save-access-ui",this.accessDirty())}</sw-card>`)}
      ${$("area",i`<sw-card data-access-ui-card="area">${this.rowHideWiskey(e)}${this.rowPhoneEmbed(e)}${this.rowLayout(e)}${this.accessNotes()}${this.accessSave(e,"data-save-access-area",this.accessDirty())}</sw-card>`)}
      ${$("display",i`<system-access-display show="display" bare></system-access-display>`)}
      ${$("announce",i`<system-access-display show="announce" bare></system-access-display>`)}
      ${$("calls",i`<system-call-banner bare></system-call-banner>`)}
      ${$("parity",u?i`<system-access-parity show="report" bare></system-access-parity>`:o)}
      ${$("checklist",u?i`<system-access-parity show="checklist" bare></system-access-parity>`:o)}
      ${$("pairing",i`<system-wiskey-pairing bare></system-wiskey-pairing>`)}
      ${$("diagnostics",i`<system-wiskey-diagnostics bare></system-wiskey-diagnostics>`)}
      ${$("validation",i`<system-wiskey-validation-card bare></system-wiskey-validation-card>`)}
    </sw-fold-cards>`}renderRemote(){const s=b(),e=!s||!this.canEdit,n=["remote.policy","remote.admins_default","remote.session","remote.idle_lock_minutes","remote.default_profile","remote.mse_fallback","remote.require_mfa_admin","security.second_factor_policy","remote.max_live_streams","remote.wall_profile","app.android_url","app.android_version","app.android_sha256"].some(h=>h in this.draft),a=(h,u)=>String(this.value(h)??u),r=(h,u,$)=>i`<sw-field class="ctl"><select data-set-remote=${h} ?disabled=${e} @change=${f=>this.set(h,f.target.value)}>
        ${$.map(([f,L])=>i`<option value=${f} ?selected=${a(h,u)===f}>${L}</option>`)}
      </select></sw-field>`,d=a("remote.session","rolling_90d")==="rolling_90d_idle_lock";return i`<div class="sections" data-remote-settings>
      ${mi()?i`<sw-card heading="אפליקציית Android" subheading="האפליקציה שומרת רשימת שרתים; אפשר לעבור ביניהם בכל רגע." data-remote-android-app>
            <div class="row" data-remote-android-switch><span class="lbl">שרתים באפליקציה<span class="muted">רשימת השרתים של האפליקציה: מעבר לשרת אחר, הוספה ועריכה</span></span><sw-button size="sm" icon="list" data-arx-switch-server @click=${()=>wi()}>החלף שרת</sw-button></div>
          </sw-card>`:o}
      <sw-card heading="גישה מרחוק · SmplWise Arx" subheading="כניסה דרך https://&lt;שם ה־Home Assistant&gt;/arx עם מסך הכניסה של המערכת (שם משתמש וסיסמה של Home Assistant). הערוץ עצמו מופעל באפשרות ה־add-on remote_access.">
        <div class="row"><span class="lbl">מי רשאי להיכנס מרחוק<span class="muted">דגל אישי: רק משתמשים שהופעלה להם גישה מרחוק במסך משתמשים והרשאות · כל בעל תפקיד: כל משתמש Home Assistant עם תפקיד כלשהו במערכת</span></span>
          ${r("remote.policy","flag",[["flag","דגל אישי לכל משתמש"],["any_role","כל משתמש עם תפקיד"]])}</div>
        <div class="row" data-remote-admins-default-row><span class="lbl">מנהלים – גישה מרחוק כברירת מחדל<span class="muted">מנהל מערכת נכנס מרחוק בלי דגל אישי · חל על "דגל אישי לכל משתמש"</span></span>
          ${r("remote.admins_default","true",[["true","מופעלת"],["false","כבויה"]])}</div>
        <div class="row"><span class="lbl">שמירת הכניסה בדפדפן<span class="muted">90 יום מתחדשים: כמו האפליקציה של Home Assistant · עד סגירת הדפדפן: הכניסה נמחקת בסגירה · 90 יום עם נעילה: כניסה חוזרת אחרי זמן ללא פעילות</span></span>
          ${r("remote.session","rolling_90d",[["rolling_90d","90 יום מתחדשים"],["browser_session","עד סגירת הדפדפן"],["rolling_90d_idle_lock","90 יום עם נעילה בחוסר פעילות"]])}</div>
        <div class="muted" data-remote-shared-login style="margin-block-start:6px">שימו לב: הכניסה ל־Arx מחברת את אותו דפדפן גם ל־Home Assistant בכתובת <span class="ltr">/</span> של אותו שם מתחם (כדי ש־WisKey ייפתח מחובר). ב"עד סגירת הדפדפן" החיבור ל־Home Assistant קיים רק כל עוד דף Arx פתוח; בנעילה בחוסר פעילות הוא מבוטל כשהנעילה מופעלת ב־Arx, אבל עד שפותחים את Arx שוב, Home Assistant בכתובת <span class="ltr">/</span> עדיין פתוח באותו דפדפן. יציאה מ־Arx מנתקת משניהם.</div>
        ${d?i`<div class="row"><span class="lbl">נעילה אחרי (דקות ללא פעילות)<span class="muted">5 עד 10080 דקות · ברירת מחדל 720 (12 שעות)</span></span>
              <sw-field class="ctl"><input type="number" min="5" max="10080" step="5" data-set-remote="remote.idle_lock_minutes" .value=${a("remote.idle_lock_minutes","720")} ?disabled=${e} @change=${h=>this.set("remote.idle_lock_minutes",Number(h.target.value))} /></sw-field></div>`:o}
        <div class="row"><span class="lbl">אימות דו־שלבי למנהלים<span class="muted">כשמופעל: משתמש עם הרשאות ניהול נכנס מרחוק רק אם הפעיל MFA בפרופיל ה־Home Assistant שלו</span></span>
          ${r("remote.require_mfa_admin","false",[["false","רשות"],["true","חובה למנהלים"]])}</div>
        <div class="row" data-second-factor-policy-row><span class="lbl">${l("secondFactor.policyLabel")}</span>
          ${r("security.second_factor_policy","optional",[["optional",l("secondFactor.policyOptional")],["admins",l("secondFactor.policyAdmins")]])}</div>
      </sw-card>
      <sw-card heading="הורדת אפליקציית Android" subheading="מוצגת במסך הכניסה רק למי שנכנס ממכשיר Android, ורק כשהוגדרה כתובת. ריק = לא מוצגת." data-card="remote.android-download" data-android-download-settings>
        <div class="row"><span class="lbl">כתובת הורדה<span class="muted">https בלבד</span></span>
          <sw-field class="ctl"><input type="url" inputmode="url" maxlength="2000" placeholder="https://" data-ltr data-set-remote="app.android_url" .value=${a("app.android_url","")} ?disabled=${e} @change=${h=>this.set("app.android_url",h.target.value.trim())} /></sw-field></div>
        <div class="row"><span class="lbl">תווית גרסה<span class="muted">לא חובה</span></span>
          <sw-field class="ctl"><input type="text" maxlength="32" data-ltr data-set-remote="app.android_version" .value=${a("app.android_version","")} ?disabled=${e} @change=${h=>this.set("app.android_version",h.target.value.trim())} /></sw-field></div>
        <div class="row"><span class="lbl">SHA-256<span class="muted">לא חובה · מוצג לאימות הקובץ</span></span>
          <sw-field class="ctl"><input type="text" maxlength="64" spellcheck="false" data-ltr data-set-remote="app.android_sha256" .value=${a("app.android_sha256","")} ?disabled=${e} @change=${h=>this.set("app.android_sha256",h.target.value.trim())} /></sw-field></div>
      </sw-card>
      ${s?i`<sw-card heading="כניסות פעילות מרחוק" subheading=${this.canEdit?"כל הכניסות הפעילות של כל המשתמשים: דפדפן או אפליקציה, מאיפה (מדינה או כתובת מוסתרת), מתי. ניתוק סוגר מיד את חיבורי הווידאו והעדכונים שלה, והכניסה הזו לא תוכל לחזור בלי כניסה מחדש.":"הכניסות הפעילות שלך מרחוק."} data-card="remote.sessions" data-remote-sessions-card>
            <sw-remote-sessions scope=${this.canEdit?"all":"own"} @remote-signed-out=${()=>void gi("logout")}></sw-remote-sessions>
          </sw-card>`:o}
      ${s&&M("system.configure")?i`<system-app-signin></system-app-signin>`:o}
      ${s&&this.canEdit?i`<sw-card heading="מדיניות אבטחת תוכן (CSP)" subheading="מדיניות מחמירה יותר לגישה מרחוק: בלי תגיות עיצוב מוטמעות בדף. היא רצה קודם במצב דיווח בלבד; אחרי שעוברים על הדיווחים כאן אפשר לאכוף אותה." data-card="remote.csp" data-csp-card>
            <sw-csp-reports .canEdit=${this.canEdit}></sw-csp-reports>
          </sw-card>`:o}
      <sw-card heading="וידאו מרחוק" subheading="WebRTC עובר ישירות בין הדפדפן ל־go2rtc; MSE מעביר את הווידאו עצמו דרך המנהרה ולכן הוא רק מוצא אחרון.">
        <div class="row"><span class="lbl">זרם ברירת מחדל<span class="muted">הזרם שצופה מרוחק מקבל ראשון, ב־WebRTC</span></span>
          ${r("remote.default_profile","main",[["main","ראשי (main)"],["sub","משני (sub)"]])}</div>
        <div class="row" data-remote-wall-profile-row><span class="lbl">איכות בקיר המצלמות מבחוץ<span class="muted">הזרם שכל אריח בקיר "כל המצלמות" מנגן מרחוק; אפשר לשנות גם במכשיר עצמו, בקיר.<br /><span data-remote-wall-hint>זרם ראשי בקיר דורש חיבור מהיר; במכשיר נייד מוצגות רק המצלמות שעל המסך</span></span></span>
          ${r("remote.wall_profile","sub",[["sub","רגילה (זרם משני)"],["main","גבוהה (זרם ראשי)"]])}</div>
        <div class="row"><span class="lbl">MSE כמוצא אחרון<span class="muted">כש־WebRTC לא מתחבר או לא מפענח (לא כשהתעבורה היא WebRTC בלבד). כבוי: אין וידאו דרך המנהרה בכלל</span></span>
          ${r("remote.mse_fallback","true",[["true","מותר (מוצג לצופה)"],["false","אסור"]])}</div>
        <div class="row"><span class="lbl">זרמים חיים לכל כניסה<span class="muted">כמה צפיות חיות במקביל מותרות לכל דפדפן או אפליקציה שנכנסו מרחוק (1 עד 128, ברירת מחדל 16); הצפייה הבאה נדחית עם הסבר. המכסה הכללית של המערכת חלה בנוסף<br /><span data-remote-cap-hint>מומלץ: לפחות כמספר המצלמות בקיר</span>${this.health?.remote?.live_streams!=null?i` · <span data-remote-live-now>פעילים עכשיו: ${this.health.remote.live_streams}</span>`:o}</span></span>
          <sw-field class="ctl"><input type="number" min="1" max="128" data-ltr data-set-remote="remote.max_live_streams" .value=${a("remote.max_live_streams","16")} ?disabled=${e} @change=${h=>this.set("remote.max_live_streams",Number(h.target.value))} /></sw-field></div>
        ${this.liveCapWarning("remote.max_live_streams")?i`<div class="err" data-remote-live-warning style="margin-block-start:-4px">${this.liveCapWarning("remote.max_live_streams")}</div>`:o}
        ${this.renderCodecSummary()}
        <div class="muted" data-remote-codec-hint style="margin-block-start:8px">דפדפנים מפענחים ב־WebRTC רק H.264 ללא B-frames; H.265 לא מתנגן ב־WebRTC ברוב הדפדפנים. אם הזרם הראשי של ה־NVR אינו כזה, הגדירו בו H.264 ללא B-frames או בחרו כאן בזרם המשני.</div>
      </sw-card>
      ${s&&M("system.configure")?i`<system-video-conn-test></system-video-conn-test>`:o}
      ${this.canEdit?this.renderSaveRow({tab:"remote",hook:"data-save-remote",disabled:!n||this.busy,onSave:()=>this.save()}):i`<div class="muted">${s?"שינוי ההגדרות דורש הרשאת מנהל מערכת.":"נתוני הדגמה: ההגדרות נשמרות רק מול השרת."}</div>`}
    </div>`}renderCodecSummary(){const s=this.health?.video_codecs,t=i`<a href="#/system/diagnostics?tab=health" data-remote-codec-link @click=${a=>{a.preventDefault(),this.openTab("health")}}>לפירוט בבריאות המערכת</a>`;let n;return b()?s?s.checked?n=`זרם ראשי: ${s.main.ok} מתוך ${s.checked} מצלמות מתנגנים ב־WebRTC${s.main.no?` · ${s.main.no} לא יתנגנו`:""}${s.main.unknown?` · ${s.main.unknown} לא ידוע`:""} · זרם משני: ${s.sub.ok} מתוך ${s.checked}`:n="קידוד הזרמים טרם נקרא מה־NVR (נקרא בגילוי המצלמות הבא).":n="קידוד הזרמים לא נקרא.":n="נתוני הדגמה: קידוד הזרמים נקרא מה־NVR רק מול השרת.",i`<div class="row" data-remote-codec-summary><span class="lbl">קידוד הזרמים ב־NVR<span class="muted">${n}</span></span>${b()?t:o}</div>`}renderDevices(){const s=b(),e=!s||!this.canEdit,t=["devices.style","devices.default_view","devices.density","devices.show_sensors","devices.area_row","devices.floor_row","devices.theme","devices.scheme","devices.glass_scheme","devices.area_design"],n={...this.settings??{},...this.draft}["devices.area_design"]==="sections"?"sections":"tiles",a=t.some(u=>u in this.draft),r=vi({...this.settings??{},...this.draft}),d=u=>this.set("devices.style",u),h=(u,$,f)=>i`<button type="button" class="swatch" data-devices-swatch=${u} aria-pressed=${String(r.style===u)} ?disabled=${e} @click=${()=>d(u)}>
      <span class=${`sw-prev ${u}`} aria-hidden="true"><i class="tree"></i><i class="on"></i><i></i><i></i><i class="on"></i></span>
      <span class="cap">${$}<span class="muted">${f}</span></span>
    </button>`;return i`<div class="sections">
      <system-home-screen></system-home-screen>
      <sw-card data-devices-settings heading="חשמל והתקנים" subheading="המראה של מסכי החשמל וההתקנים לכל המשתמשים במתקן. תצוגה בלבד: כללי הבטיחות של פעולות מרוכזות (חלון אישור, תוקף, בלי מנעולים, אזעקה ושחרור דלתות) אינם הגדרה.">
        <div class="row"><span class="lbl">סגנון<span class="muted">Arx הוא המראה של שאר המערכת; זכוכית היא הסגנון מהמוקאפ שאושר: משטחים שקופים ומטושטשים, אריחים מעוגלים עם אייקון. שניהם מימין לשמאל.</span></span>
          <sw-field class="ctl"><select data-set-devices-style ?disabled=${e} @change=${u=>d(u.target.value==="glass"?"glass":"smplwise")}>
            <option value="smplwise" ?selected=${r.style==="smplwise"}>Arx</option><option value="glass" ?selected=${r.style==="glass"}>זכוכית</option>
          </select></sw-field></div>
        <div class="swatches" role="group" aria-label="תצוגה מקדימה של הסגנונות" data-devices-style-preview>
          ${h("smplwise","Arx","לבן, קווים דקים")}
          ${h("glass","זכוכית","שקוף, מעוגל, אייקונים")}
        </div>
        <devices-theme-picker data-devices-theme-picker .theme=${r.theme} .scheme=${r.scheme} ?disabled=${e} @devices-pick=${u=>this.set(u.detail.key,u.detail.value)}></devices-theme-picker>
        <div class="row" data-glass-scheme-row><span class="lbl">${l("glassScheme.label")}<span class="muted">${l("glassScheme.hint")}</span></span>
          <sw-field class="ctl"><select data-set-glass-scheme ?disabled=${e} @change=${u=>this.set("devices.glass_scheme",u.target.value)}>
            ${fi.map(u=>i`<option value=${u} ?selected=${r.glassScheme===u}>${l(`glassScheme.${u}`)}</option>`)}
          </select></sw-field></div>
        <div class="row"><span class="lbl">תצוגת הפתיחה של המבנה<span class="muted">מה שמשתמש רואה בפעם הראשונה. מי שבחר בעצמו "כרטיסים" או "אריחים" ממשיך עם הבחירה שלו.</span></span>
          <sw-field class="ctl"><select data-set-devices-view ?disabled=${e} @change=${u=>this.set("devices.default_view",u.target.value==="tiles"?"tiles":"cards")}>
            <option value="cards" ?selected=${r.defaultView==="cards"}>כרטיסים: עץ המבנה וכרטיסי קומה</option><option value="tiles" ?selected=${r.defaultView==="tiles"}>אריחים: אריח לכל אזור</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">כיוון מסך האזור<span class="muted">אריחים צפופים: כרטיס לכל סוג התקנים, בעמודות. מקטעים ברצף: קטע אחרי קטע עם הכותרת בצד והחיישנים לצידם. משתמש עם ההרשאה "התאמה אישית של מסכי חשמל והתקנים" יכול לבחור אחרת רק לעצמו.</span></span>
          <sw-field class="ctl"><select data-set-devices-area-design ?disabled=${e} @change=${u=>this.set("devices.area_design",u.target.value==="sections"?"sections":"tiles")}>
            <option value="tiles" ?selected=${n==="tiles"}>אריחים צפופים</option><option value="sections" ?selected=${n==="sections"}>מקטעים ברצף</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">צפיפות<span class="muted">דחוסה: אריחים, שורות ורווחים קטנים יותר, יותר אזורים במסך אחד</span></span>
          <sw-field class="ctl"><select data-set-devices-density ?disabled=${e} @change=${u=>this.set("devices.density",u.target.value==="compact"?"compact":"comfortable")}>
            <option value="comfortable" ?selected=${r.density==="comfortable"}>מרווחת</option><option value="compact" ?selected=${r.density==="compact"}>דחוסה</option>
          </select></sw-field></div>
        <div class="row"><span class="lbl">חיישנים<span class="muted">כרטיס החיישנים במסך האזור ומונה החיישנים במסך המבנה</span></span>
          <sw-field class="ctl"><select data-set-devices-sensors ?disabled=${e} @change=${u=>this.set("devices.show_sensors",u.target.value==="false"?"false":"true")}>
            <option value="true" ?selected=${r.showSensors}>מוצג</option><option value="false" ?selected=${!r.showSensors}>מוסתר</option>
          </select></sw-field></div>
        <div data-area-row-setting style="margin-block:12px">
          <div class="lbl" style="margin-block-end:8px"><strong>מה מוצג ליד שם האזור</strong><span class="muted">בשורת כל אזור ובכותרת הקומה, שורה אחת בלי גלישה. הסדר קובע: בטלפון מוצגים רק הפריטים שמעל הקו, השאר נאספים ל־+N. כל השאר תמיד בתוך האזור. מי שמוגדרת לו התאמה אישית של המסך יכול לבחור אחרת לעצמו.</span></div>
          <area-row-editor style="display:block;max-inline-size:460px" data-area-row-editor-settings .area=${r.areaRow} .floor=${r.floorRow} ?disabled=${e} @area-row-change=${u=>{this.set("devices.area_row",u.detail.area),this.set("devices.floor_row",u.detail.floor)}}></area-row-editor>
        </div>
        <div class="muted" data-devices-layout-next style="margin-block-start:8px">הפריסה עצמה (מיקום וגודל של כרטיסים ואריחים, כותרת, אייקון, גודל טקסט וצבע לפי תפקיד) נערכת במסך המבנה ובמסך האזור, בכפתור "ערוך פריסה".</div>
        ${this.canEdit&&s?this.renderSaveRow({tab:"devices",hook:"data-save-devices",disabled:!a||this.busy,onSave:()=>this.save()}):i`<div class="muted" data-devices-readonly>${s?"שינוי ההגדרות דורש הרשאת מנהל מערכת.":"נתוני הדגמה: ההגדרות נשמרות רק מול השרת."}</div>`}
      </sw-card>
      ${s&&this.canEdit?i`<devices-climate-kind-admin data-section="climate-kind"></devices-climate-kind-admin>`:o}
      ${s&&this.canEdit?i`<devices-type-admin data-section="device-types"></devices-type-admin>`:o}
      ${s&&this.canEdit?i`<devices-protected-switches data-section="protected-switches"></devices-protected-switches>`:o}
    </div>`}async loadReport(s=!1){if(b()){this.reportBusy=!0,this.setLoadFailed("health","");try{this.report=await $i(s)}catch(e){this.setLoadFailed("health",g(e))}finally{this.reportBusy=!1}}}renderReport(){const s=this.report;if(!s)return i`<div class="sections"><sw-card heading="בריאות המערכת">${this.loadFailed.health&&!this.reportBusy?i`<sw-state-panel compact state="error" heading="דוח הבריאות לא נטען" hint=${this.loadFailed.health} actionLabel="נסו שוב" @action=${()=>void this.loadReport(!0)}></sw-state-panel>`:i`<sw-state-panel compact state="loading" heading=${this.reportBusy?"בודק…":"טוען…"}></sw-state-panel>`}</sw-card>${this.loadFailed.health?this.renderLogExport():o}</div>`;const e=Ye(new Date(s.checked_at),{seconds:!0});return i`<div class="sections">
      <sw-card heading="בריאות המערכת" subheading="מצב נפרד לכל רכיב, לא נורה אחת">
        <div class="hsum"><sw-badge kind=${Ze[s.status]} label=${s.status==="ok"?"הכל תקין":s.status==="warn"?"יש מה לבדוק":"יש תקלה"}></sw-badge><span>גרסה <span class="ltr">${s.version}</span> · פעיל ${yi(s.uptime_s)} · נבדק <span class="ltr" data-health-checked>${e}</span></span><span class="grow"></span><sw-button size="sm" icon="refresh" ?disabled=${this.reportBusy} @click=${()=>this.loadReport(!0)}>${this.reportBusy?"בודק…":"בדוק עכשיו"}</sw-button></div>
        ${s.installation&&!s.installation.supported?i`<div class="hcard error" role="alert" data-health-unsupported=${s.installation.reason??""}><div class="hh"><span>התקנה לא נתמכת</span></div><div class="hd">${s.installation.message} ${s.installation.action}</div></div>`:o}
        <div class="hgrid">${s.checks.map(t=>i`<div class="hcard ${t.status}" data-health-card=${t.id}><div class="hh"><span>${t.label}</span><sw-badge kind=${Ze[t.status]} label=${te[t.status]}></sw-badge></div><div class="hd">${t.detail}</div>${this.renderVideoHints(t)}</div>`)}</div>
        <div class="muted" style="margin-block-start:10px">בדיקות המכשירים (NVR, go2rtc) נשמרות ${s.probe_ttl_s} שניות; "בדוק עכשיו" מריץ אותן מחדש. זרמים זרים ב־go2rtc לעולם אינם נוגעים.</div>
      </sw-card>
      ${s.mode!=="ha_only"?i`<recorder-health-panel ?manage=${this.canEdit}></recorder-health-panel>`:o}
      ${s.mode!=="ha_only"&&this.canEdit?i`<camera-image-health-settings></camera-image-health-settings>`:o}
      ${this.renderLogExport()}
    </div>`}renderLogExport(){return this.canEdit?i`<health-log-export></health-log-export>`:o}renderVideoHints(s){const e=s.id==="video_webrtc"?s.meta.main_not_webrtc??[]:[];return e.length?i`<ul class="hd" data-video-hints style="margin:6px 0 0;padding-inline-start:18px">${e.map(t=>i`<li data-video-hint=${t.camera_id}>${t.hint}</li>`)}</ul>`:o}renderHealth(){return b()?this.renderReport():i`<div class="sections">
      <sw-card heading="מצבים נפרדים, לא נורה אחת">${ki.map(s=>i`<div class="row"><span class="lbl">${s.name}<span class="muted">${s.detail}</span></span><sw-badge kind=${s.state}></sw-badge></div>`)}
        <div class="row"><span class="lbl">הקלטה ב־NVR<span class="muted">5/10 ערוצים מקליטים כרגע (לפי תצורה)</span></span><sw-badge kind="live"></sw-badge></div>
        <div class="row"><span class="lbl">זרמים פעילים<span class="muted">4 חיים · 1 ניגון · 0 יתומים</span></span><sw-badge kind="live"></sw-badge></div>
      </sw-card>
      <sw-card heading="תור עבודות">${xi.map(s=>i`<div class="row"><span class="lbl">${s.title}<span class="muted">${s.status}</span></span><span style="display:flex;align-items:center;gap:10px"><span class="bar ${s.status.startsWith("נכשל")?"fail":""}"><i style="--p:${s.progress}%"></i></span><span class="ltr">${s.progress}%</span></span></div>`)}</sw-card>
    </div>`}async loadBackups(){if(b()){cn().then(s=>this.meterBackup=s),this.setLoadFailed("backup","");try{const s=await tn();this.backups=s.backups,this.backupPolicy=s.policy}catch(s){this.setLoadFailed("backup",g(s)),this.backups=[]}}}async toggleMeterBackup(s){const e=this.meterBackup;if(!(!e||this.meterBackupBusy)){this.meterBackupBusy=!0,this.meterBackupError="",this.meterBackup={...e,on:s};try{this.meterBackup=await pn(s)??{...e,on:s}}catch(t){this.meterBackup=e,this.meterBackupError=g(t)}finally{this.meterBackupBusy=!1}}}renderMeterBackup(){const s=this.meterBackup;if(!s)return o;const e=s.bytes!=null&&s.bytes>0?` (כרגע ${Cs(s.bytes)})`:"";return i`<div class="row" data-backup-meters><span class="lbl">נתוני מוני החשמל<span class="muted">${s.on?`כל הקריאות נכנסות לגיבוי${e}`:"בלי הקריאות עצמן; מונים, חיובים וסיכומים יומיים נכנסים תמיד"}</span></span>
        <sw-toggle data-backup-meters-toggle ?checked=${s.on} ?disabled=${!s.editable||this.meterBackupBusy} label="לכלול את נתוני המונים בגיבוי" labelHidden
          @change=${t=>void this.toggleMeterBackup(t.detail.checked)}></sw-toggle></div>
      ${this.meterBackupError?i`<div class="msg err" role="alert" data-backup-meters-error>${this.meterBackupError}</div>`:o}`}async createBackup(){this.backupBusy=!0,this.backupMsg="",this.setError("backup","");try{const s=this.backupPassword,e=await nn({note:this.backupNote.trim(),...s?{backup_password:s}:{}});this.backupNote="",this.backupPassword="";const t=e.sensitive?.state==="encrypted"?k("createdEncrypted"):(e.sensitive?.counts?.password_hashes??0)>0?k("createdOmitted"):"";this.backupMsg=`הגיבוי ${e.name} נוצר (${Cs(e.bytes)})${t?` · ${t}`:""}`,await this.loadBackups()}catch(s){this.setError("backup",g(s))}finally{this.backupBusy=!1}}backupMin(){const s=Number(this.settings?.["backup.password_min"]??12);return Number.isFinite(s)?Math.max(8,Math.min(64,Math.round(s))):12}async saveBackupMin(s){const e=Number(s.value);if(!Number.isInteger(e)||e<8||e>64){this.setError("backup",k("minRange")),s.value=String(this.backupMin());return}this.backupMinBusy=!0,this.setError("backup","");try{const t=await O({"backup.password_min":e});this.settings=t.settings,C(),this.backupMsg=k("minSaved")}catch(t){this.setError("backup",g(t)),s.value=String(this.backupMin())}finally{this.backupMinBusy=!1}}async toggleLocalScope(s){this.localSafetyBusy=!0,this.setError("backup","");try{const e=await O({"backup.local_restore_scope":s?"project+access":"project"});this.settings=e.settings,C(),this.backupMsg=_("saved")}catch(e){this.setError("backup",g(e))}finally{this.localSafetyBusy=!1}}async toggleLocalSafety(s){this.localSafetyBusy=!0,this.setError("backup","");try{const e=await O({"backup.safety_before_local_restore":s?"on":"off"});this.settings=e.settings,C(),this.backupMsg=_("saved")}catch(e){this.setError("backup",g(e))}finally{this.localSafetyBusy=!1}}async onBackupFile(s){if(s){this.backupBusy=!0,this.backupMsg="",this.setError("backup","");try{const e=await dn(s);this.backupMsg=`הקובץ הועלה כ־${e.name}; עכשיו אפשר לשחזר ממנו`,await this.loadBackups()}catch(e){this.setError("backup",g(e))}finally{this.backupBusy=!1}}}async removeBackup(s){this.removeTarget=null,this.backupBusy=!0,this.setError("backup","");try{await rn(s.name),this.backupMsg=`הגיבוי ${s.name} נמחק`,await this.loadBackups()}catch(e){this.setError("backup",g(e))}finally{this.backupBusy=!1}}renderRemoveDialog(s){return i`<sw-dialog open heading="למחוק את הגיבוי?" subheading=${s.name} data-backup-remove-dialog @close=${()=>this.removeTarget=null}>
      <div class="hint" style="font-size:var(--sw-fs-sm)">${this.fmtWhen(s.created_at)} · ${Cs(s.bytes)} · ${ra[s.kind]??s.kind}${s.note?` · ${s.note}`:""}. הקובץ נמחק מ־/data/backups ואי אפשר לשחזר ממנו אחר כך; עותק שהורד למחשב אינו מושפע.</div>
      <div slot="footer"><sw-button variant="danger" icon="trash" ?disabled=${this.backupBusy} data-backup-remove-go @click=${()=>void this.removeBackup(s)}>${this.backupBusy?"מוחק…":"מחק"}</sw-button><sw-button variant="ghost" @click=${()=>this.removeTarget=null}>ביטול</sw-button></div>
    </sw-dialog>`}openRestore(s){this.restoreTarget=s,this.setError("backup",""),this.restoreMode="replace",this.restoreAccess=na(this.settings?.["backup.local_restore_scope"])==="project+access",this.restoreConfirm="",this.restorePassword="",this.restoreSkip=!1,this.restoreCanSkip=!1,this.restoreSafety=""}async doRestore(){const s=this.restoreTarget;if(!(!s||this.restoreConfirm!=="RESTORE")){this.backupBusy=!0,this.setError("backup","");try{const e=this.restorePassword,t=await ln(s.name,{mode:this.restoreMode,scope:this.restoreAccess?"project+access":"project",confirm:this.restoreConfirm,...e?{backup_password:e}:{},...this.restoreSkip?{skip_sensitive:!0}:{},...ne(this.settings?.["backup.safety_before_local_restore"])?an(this.restoreSafety):{}});this.restorePassword="",this.restoreSafety="";const n=t.safety_archive?` · ${_("safetyDone",{safety:t.safety_archive.name})}`:"",a=Object.entries(t.tables).filter(([d])=>re[d]).map(([d,h])=>`${h} ${re[d]}`),r=t.passwords?.need_reset_count?` · ${k("resultNeedReset",{n:t.passwords.need_reset_count})}`:"";this.backupMsg=`שוחזר מ־${s.name} (${t.mode==="replace"?"החלפה":"מיזוג"}): ${a.join(", ")} · ${t.files} קבצים${t.files_skipped?` · ${t.files_skipped} קבצים לא שוחזרו`:""}${r}${n}`,this.restoreTarget=null,C(),await this.loadBackups()}catch(e){this.setError("backup",e instanceof sa&&e.code.startsWith("safety_password_")?sn(e.code,e.body.details):g(e)),this.restoreCanSkip=e instanceof sa&&e.body.details?.can_skip===!0,this.restorePassword="",this.restoreSafety=""}finally{this.backupBusy=!1}}}fmtWhen(s){return _i(new Date(s))}renderBackupRow(s){const e=["sites","floors","plan_versions","map_anchors","spatial_zones","cameras"].filter(t=>s.tables[t]!==void 0).map(t=>`${s.tables[t]} ${re[t]}`).join(" · ");return i`<div class="brow" data-backup-row>
      <div>
        <div class="name"><span class="ltr">${s.name}</span><sw-badge kind=${s.kind.startsWith("auto")?"neutral":s.kind==="upload"?"stale":"live"} label=${ra[s.kind]??s.kind}></sw-badge>${this.renderSensitiveBadge(s)}${s.valid?o:i`<sw-badge kind="error" label="קובץ לא תקין"></sw-badge>`}</div>
        <div class="sub">${this.fmtWhen(s.created_at)} · ${Cs(s.bytes)} · גרסה ${s.app_version??"?"}${s.note?` · ${s.note}`:""}</div>
        ${e?i`<div class="sub">${e} · ${s.files} קבצי תוכנית</div>`:o}
      </div>
      <div class="acts">
        <a href=${on(s.name)} download=${s.name} data-backup-download><sw-button size="sm" icon="download">הורד</sw-button></a>
        <sw-button size="sm" icon="history" ?disabled=${!s.valid||this.backupBusy} data-backup-restore @click=${()=>this.openRestore(s)}>שחזר</sw-button>
        <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.backupBusy} data-backup-remove @click=${()=>this.removeTarget=s}>מחק</sw-button>
      </div>
    </div>`}renderSensitiveBadge(s){const e=s.sensitive;return e?.state==="encrypted"?i`<sw-badge kind="neutral" data-backup-sensitive="encrypted" label=${k("badgeEncrypted")}></sw-badge>`:e?.state==="legacy"?i`<sw-badge kind="stale" data-backup-sensitive="legacy" label=${k("badgeLegacy")}></sw-badge>`:e?.state==="omitted"&&(e.counts?.password_hashes??0)>0?i`<sw-badge kind="neutral" data-backup-sensitive="omitted" label=${k("badgeOmitted")}></sw-badge>`:o}renderRestoreSensitive(s){const e=s.sensitive;return e?.state==="encrypted"?i`<div class="row" data-restore-sensitive><span class="lbl">${k("restoreLabel")}<span class="muted">${k("restoreHint",{n:e.counts?.password_hashes??0})}</span></span>
          <input class="note-in" type="password" autocomplete="off" data-restore-password ?disabled=${this.restoreSkip} .value=${this.restorePassword} @input=${t=>this.restorePassword=t.target.value} /></div>
        ${this.restoreCanSkip||this.restoreSkip?i`<div class="row" data-restore-skip-row><span class="lbl">${k("restoreSkip")}<span class="muted">${k("restoreSkipHint")}</span></span><sw-toggle data-restore-skip ?checked=${this.restoreSkip} label=${k("restoreSkip")} labelHidden @change=${t=>{this.restoreSkip=t.detail.checked,this.restoreSkip&&(this.restorePassword="")}}></sw-toggle></div>`:o}`:e?.state==="legacy"?i`<div class="msg err" role="note" data-restore-legacy>${k("restoreLegacy")}</div>`:e?.state==="omitted"&&(e.counts?.password_hashes??0)>0?i`<div class="muted" data-restore-omitted>${k("restoreOmitted")}</div>`:o}renderRestoreSafety(){return ne(this.settings?.["backup.safety_before_local_restore"])?i`<div class="row" data-restore-safety-row><span class="lbl">${_("safetyPassword")}<span class="muted">${_("safetyHint")}</span></span>
      <input class="note-in" type="password" autocomplete="new-password" data-restore-safety placeholder=${_("safetyPlaceholder",{n:this.backupMin()})}
        .value=${this.restoreSafety} @input=${s=>this.restoreSafety=s.target.value} /></div>`:i`<div class="muted" role="note" data-restore-safety-off>${_("safetyOff")}</div>`}renderRestoreDialog(s){return i`<sw-dialog open heading="שחזור גיבוי" subheading=${s.name} @close=${()=>this.restoreTarget=null}>
      <div class="row"><span class="lbl">אופן השחזור<span class="muted">${this.restoreMode==="replace"?"הנתונים הנוכחיים של הפרויקט מוחלפים במה שבגיבוי":"רק פריטים שחסרים היום מתווספים; הקיימים נשארים"}</span></span>
        <select data-restore-mode @change=${e=>this.restoreMode=e.target.value}><option value="replace" ?selected=${this.restoreMode==="replace"}>החלפה</option><option value="merge" ?selected=${this.restoreMode==="merge"}>מיזוג</option></select></div>
      <div class="row"><span class="lbl">${_("accessLabel")}<span class="muted">${_("accessHint")}</span></span><sw-toggle data-restore-access ?checked=${this.restoreAccess} label=${_("accessLabel")} labelHidden @change=${e=>this.restoreAccess=e.detail.checked}></sw-toggle></div>
      ${this.renderRestoreSensitive(s)}
      ${this.renderRestoreSafety()}
      ${this.errorOf("backup")?i`<div class="msg err" role="alert" data-restore-error><sw-icon name="warning" size=${13}></sw-icon>${this.errorOf("backup")}</div>`:o}
      <div class="muted" style="margin-block-start:8px">הגיבוי מגרסה ${s.app_version??"?"} מ־${this.fmtWhen(s.created_at)}. השחזור נרשם באודיט. לאישור הקלד <code>RESTORE</code>:</div>
      <input class="confirm-in" data-restore-confirm placeholder="RESTORE" .value=${this.restoreConfirm} @input=${e=>this.restoreConfirm=e.target.value} />
      <div slot="footer"><sw-button variant="danger" icon="history" ?disabled=${this.restoreConfirm!=="RESTORE"||this.backupBusy} data-restore-go @click=${()=>this.doRestore()}>${this.backupBusy?"משחזר…":"שחזר עכשיו"}</sw-button><sw-button variant="ghost" @click=${()=>this.restoreTarget=null}>ביטול</sw-button></div>
    </sw-dialog>`}renderBackup(){const s=this.backups??[];return i`<div class="sections">
      <sw-card heading="גיבויים של הפרויקט" subheading="אתרים, קומות, תוכניות, עוגנים, אזורים, מצלמות והגדרות · בלי סודות גלויים ובלי וידאו">
        <div class="row"><span class="lbl">גיבוי ידני עכשיו<span class="muted">נשמר בתוך התוסף (/data/backups) ואפשר להוריד למחשב</span></span>
          <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input class="note-in" placeholder="הערה (אופציונלי)" .value=${this.backupNote} @input=${e=>this.backupNote=e.target.value} /><sw-button variant="primary" size="sm" icon="download" ?disabled=${this.backupBusy||!b()} data-backup-create @click=${()=>this.createBackup()}>${this.backupBusy?"עובד…":"צור גיבוי"}</sw-button></span></div>
        <div class="row" data-backup-password-row><span class="lbl">${k("createLabel")}<span class="muted">${k("createHint")}</span></span>
          <input class="note-in" type="password" autocomplete="new-password" data-backup-password placeholder=${k("createPlaceholder",{n:this.backupMin()})} .value=${this.backupPassword} @input=${e=>this.backupPassword=e.target.value} /></div>
        <div class="row" data-backup-min-row><span class="lbl">${k("minLabel")}<span class="muted">${k("minHint")}</span></span>
          <input class="note-in" type="number" min="8" max="64" data-ltr data-backup-min ?disabled=${!b()||!this.canEdit||this.backupMinBusy} .value=${String(this.backupMin())} @change=${e=>void this.saveBackupMin(e.target)} /></div>
        <div class="row" data-backup-local-scope-row><span class="lbl">${_("localScope")}<span class="muted">${_("localScopeHint")}</span></span>
          <sw-toggle data-backup-local-scope ?checked=${na(this.settings?.["backup.local_restore_scope"])==="project+access"} ?disabled=${!b()||!this.canEdit||this.localSafetyBusy}
            label=${_("localScope")} labelHidden @change=${e=>void this.toggleLocalScope(e.detail.checked)}></sw-toggle></div>
        <div class="row" data-backup-local-safety-row><span class="lbl">${_("localSafety")}<span class="muted">${_("localSafetyHint")}</span></span>
          <sw-toggle data-backup-local-safety ?checked=${ne(this.settings?.["backup.safety_before_local_restore"])} ?disabled=${!b()||!this.canEdit||this.localSafetyBusy}
            label=${_("localSafety")} labelHidden @change=${e=>void this.toggleLocalSafety(e.detail.checked)}></sw-toggle></div>
        <div class="row"><span class="lbl">העלאת גיבוי<span class="muted">קובץ zip שהורד מכאן (גם מהתקנה קודמת); אחרי ההעלאה לוחצים "שחזר"</span></span>
          <span><input type="file" accept=".zip,application/zip" hidden @change=${e=>{const t=e.target;this.onBackupFile(t.files?.[0]),t.value=""}} /><sw-button size="sm" icon="upload" ?disabled=${this.backupBusy||!b()} @click=${()=>this.renderRoot.querySelector("input[type=file]")?.click()}>בחר קובץ…</sw-button></span></div>
        ${this.renderMeterBackup()}
        ${this.backupMsg?i`<div class="msg ok" role="status" data-backup-msg><sw-icon name="check" size=${13}></sw-icon>${this.backupMsg}</div>`:o}
        ${this.errorOf("backup")&&!this.restoreTarget?i`<div class="msg err" role="alert" data-backup-error><sw-icon name="warning" size=${13}></sw-icon>${this.errorOf("backup")}</div>`:o}
        ${b()?this.backups===null?i`<sw-state-panel compact state="loading"></sw-state-panel>`:s.length?i`<div class="blist" data-backups>${s.map(e=>this.renderBackupRow(e))}</div>`:this.loadFailed?i`<sw-state-panel compact state="error" heading="רשימת הגיבויים לא נטענה" hint=${this.loadFailed.backup} actionLabel="נסו שוב" @action=${()=>void this.loadBackups()}></sw-state-panel>`:i`<sw-state-panel icon="history" compact state="empty" heading="עדיין אין גיבויים" hint="הראשון ייווצר אוטומטית לפני העדכון הבא, או עכשיו בלחיצה."></sw-state-panel>`:i`<div class="muted">נתוני הדגמה: הגיבויים עובדים מול השרת.</div>`}
      </sw-card>
      ${b()&&M("backup.manage")?i`<sw-offbox-backup data-offbox-section></sw-offbox-backup>`:o}
      <sw-card heading="אוטומטי ו־Rollback">
        <div class="row"><span class="lbl">לפני כל עדכון גרסה<span class="muted">עותק של הנתונים נכתב לפני שהגרסה החדשה נוגעת במסד; נשמרים ${this.backupPolicy["auto-pre-upgrade"]??5} האחרונים</span></span><sw-badge kind="live" label="פעיל"></sw-badge></div>
        <div class="row"><span class="lbl">יומי<span class="muted">עותק אחד ביום, נשמרים ${this.backupPolicy["auto-daily"]??7} האחרונים</span></span><sw-badge kind="live" label="פעיל"></sw-badge></div>
        <div class="row"><span class="lbl">Rollback<span class="muted">חוזרים לגרסה קודמת דרך Home Assistant ואז משחזרים את הגיבוי "לפני עדכון" (החלפה)</span></span><span class="ltr">${this.version||"…"}</span></div>
        <div class="row"><span class="lbl">גיבוי Home Assistant<span class="muted">ה־Add-on מוגדר backup: hot, ולכן /data (כולל הגיבויים האלה) נכלל גם בגיבוי המלא של HA</span></span></div>
      </sw-card>
    </div>
    ${this.restoreTarget?this.renderRestoreDialog(this.restoreTarget):o}
    ${this.removeTarget?this.renderRemoveDialog(this.removeTarget):o}`}renderSupport(){return i`<div class="sections"><sw-card heading="חבילת תמיכה מצונזרת">
      <div class="muted" style="padding-block-end:8px">כוללת logs עם request/session/job id, מדדים, capability matrix, גרסאות. לא כוללת וידאו, תוכניות, סודות או כתובות מלאות ללא הסכמה.</div>
      <div class="row"><span class="lbl">כלול תוכניות קומה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="row"><span class="lbl">כלול תמונות מצלמה</span><sw-toggle label="לא"></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" icon="download" disabled>יצירת חבילה (בהמשך)</sw-button></div>
    </sw-card></div>`}renderTab(){const s=we[this.tab]?this.tabChunks.get(this.tab):"ready";return s==="failed"?i`<div class="sections"><sw-state-panel compact state="error" heading="הלשונית לא נטענה" hint="בדקו את החיבור ונסו שוב" actionLabel="נסו שוב" data-tab-chunk-failed @action=${()=>this.retryTabChunk(this.tab)}></sw-state-panel></div>`:s!=="ready"?i`<div class="sections" data-tab-chunk-loading><sw-state-panel compact state="loading"></sw-state-panel></div>`:this.tab==="general"?this.renderGeneral():this.tab==="tabs"?i`<system-tabs-config></system-tabs-config>`:this.tab==="media"?this.renderMedia():this.tab==="map"?this.renderMap():this.tab==="buildings"?i`<system-mapping></system-mapping>`:this.tab==="ha"?this.renderHa():this.tab==="access-control"?this.renderAccessControl():this.tab===U?this.renderAccessVoice():this.tab==="devices"?this.renderDevices():this.tab==="remote"?this.renderRemote():this.tab==="mobile"?i`<system-presence></system-presence>`:this.tab==="health"?this.renderHealth():this.tab==="backup"?this.renderBackup():this.renderSupport()}render(){const s=this.layoutKnown()?wr(this.accessLayout()):cs,e=s.find(t=>t.id===this.tab)??s[0];return i`
      <sw-page crumbs=${e.id==="general"?"הגדרות":"הגדרות | כללי"} heading=${e.label} subheading=${`${(e.id===U?A().voiceTabSub:mr[e.id])??""}${b()?"":" · נתוני הדגמה"}`}>
        <sw-tabs underline data-settings-tabs .variant=${this.phoneSelect?"dropdown":this.tabsMode.props("").variant} ?adaptive=${this.phoneSelect?!1:this.tabsMode.props("").adaptive} ?tall=${this.phoneSelect} ?block=${this.phoneSelect} dd-style=${this.tabsMode.ddStyle} dd-size=${this.tabsMode.ddSize} dd-ring=${this.tabsMode.ddRing} dd-panel=${this.tabsMode.ddPanel} group-label="קטגוריה" .items=${s} .active=${this.tab} @change=${t=>this.openTab(t.detail.id)}></sw-tabs>
        ${this.message&&this.tab==="ha"?i`<div class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</div>`:o}
        ${this.errorOf("ha")&&this.tab==="ha"?i`<div class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.errorOf("ha")}</div>`:o}
        ${this.renderTab()}
      </sw-page>
    `}};m.styles=[Fs,I`
    .steps {
      margin: 0;
      padding-inline-start: 20px;
      font-size: var(--sw-fs-sm);
      line-height: 1.6;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    /* K88: the plan.surfaces check rows */
    .chk {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .health {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .health .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-stale);
    }
    /* CR-DIAG-DEFECTS-2436: the General tab's live health row (the demo's dot has no data-status and keeps the colour above) */
    .health .dot[data-status='ok'] {
      background: var(--sw-live);
    }
    .health .dot[data-status='error'] {
      background: var(--sw-offline);
    }
    .health .dot[data-status='off'] {
      background: var(--sw-border, currentColor);
      opacity: 0.6;
    }
    .hgrid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); /* CR-026 guard: a 300px column overflowed a 320px phone */
      gap: 10px;
    }
    /* R5-SYSTEM-297: a health card is a well of the ladder (surface-2, no hairline); a failing one is a FILLED danger / stale field,
       not a coloured outline; its name reads at 14/600 in the heading ink */
    .hcard {
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      padding: 12px 14px;
      background: var(--sw-surface-2);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hcard.error {
      background: var(--sw-danger-soft);
      border-color: color-mix(in srgb, var(--sw-danger) 35%, transparent);
    }
    .hcard.warn {
      background: var(--sw-stale-soft);
      border-color: color-mix(in srgb, var(--sw-stale) 35%, transparent);
    }
    .hcard .hh {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
    }
    .hcard .hd {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      line-height: 1.5;
    }
    .hsum {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 10px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .hsum .grow {
      flex: 1;
    }
    .blist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-block-start: 8px;
    }
    .brow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px 12px;
      align-items: center;
      padding: 10px 12px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .brow .name {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .brow .sub {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .brow .acts {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .brow a {
      text-decoration: none;
    }
    .note-in {
      inline-size: 200px;
      min-block-size: var(--sw-ctl-h-md);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: 5px 10px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .note-in:focus,
    .confirm-in:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .confirm-in {
      inline-size: 100%;
      box-sizing: border-box;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: 8px 10px;
      font: inherit;
      font-family: var(--sw-font-mono);
      direction: ltr;
      margin-block-start: 8px;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    /* owner 2026-09-29: the live preview of "פריסת אריחים" (two sample tiles in the chosen shape) */
    .tile-preview {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 170px));
      gap: 8px;
      padding-block: 4px 8px;
    }
    .bar {
      block-size: 6px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-3);
      inline-size: 140px;
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      inline-size: var(--p);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    /* CR-007 6a: הגדרות › חשמל והתקנים - the two style previews (static swatches, no screen is rendered) */
    .swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .swatch {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 6px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    .swatch[aria-pressed='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 2px var(--sw-accent-soft);
    }
    .swatch:disabled {
      cursor: default;
    }
    .swatch .cap {
      display: flex;
      align-items: center;
      gap: 6px;
      padding-inline: 2px;
      font-weight: var(--sw-fw-medium);
    }
    .swatch .cap .muted {
      font-weight: var(--sw-fw-regular);
    }
    .sw-prev {
      inline-size: 176px;
      block-size: 104px;
      border-radius: var(--sw-r-sm);
      padding: 8px;
      display: grid;
      grid-template-columns: 44px 1fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 6px;
      overflow: hidden;
    }
    .sw-prev i {
      display: block;
      border-radius: var(--sw-r-2xs);
    }
    .sw-prev .tree {
      grid-row: 1 / 3;
    }
    /* POLISH4-WP7: the two style previews read tokens only (no literal colours). The Arx preview is the flat ladder (surface-2 ground,
       solid tiles on a hairline); the glass preview is the same ground with translucent tiles and a tinted bloom, so both follow
       the light / dark scheme instead of staying pinned to one. */
    .sw-prev.smplwise {
      background: var(--sw-surface-2);
    }
    .sw-prev.smplwise i {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-1);
    }
    .sw-prev.smplwise i.on {
      background: linear-gradient(180deg, var(--sw-warning-soft), var(--sw-surface) 70%);
      border-color: color-mix(in srgb, var(--sw-warning) 40%, transparent);
    }
    .sw-prev.glass {
      background: radial-gradient(140px 80px at 85% -10%, color-mix(in srgb, var(--sw-warning) 45%, transparent), transparent 60%), radial-gradient(120px 80px at 10% 110%, color-mix(in srgb, var(--sw-accent) 50%, transparent), transparent 60%), var(--sw-surface-2);
    }
    .sw-prev.glass i {
      border-radius: var(--sw-r-md);
      background: color-mix(in srgb, var(--sw-surface-solid) 62%, transparent);
      border: 1px solid var(--sw-border-strong);
      box-shadow: var(--sw-shadow-2);
      display: flex;
      align-items: flex-start;
      padding: 5px;
    }
    .sw-prev.glass i::before {
      content: '';
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--sw-text-3);
      opacity: 0.45;
    }
    .sw-prev.glass i.tree::before {
      display: none;
    }
    .sw-prev.glass i.on {
      background: linear-gradient(135deg, color-mix(in srgb, var(--sw-accent) 55%, transparent), color-mix(in srgb, var(--sw-accent) 15%, transparent)), color-mix(in srgb, var(--sw-surface-solid) 62%, transparent);
      border-color: color-mix(in srgb, var(--sw-accent) 45%, transparent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--sw-accent) 40%, transparent);
    }
    .stream {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: var(--sw-fs-xs);
      padding: 5px 0;
      border-block-end: 1px solid var(--sw-border);
      font-family: var(--sw-font-mono);
      direction: ltr;
    }
    /* POLISH4-WP7 press + hover: the style swatch presses in on pointer-down (the same give as every key); hover only on a fine pointer */
    .swatch {
      transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .swatch:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    .swatch:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .swatch:hover:not(:disabled):not([aria-pressed='true']) {
        border-color: var(--sw-accent);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .swatch {
        transition-duration: 0ms;
      }
    }
    @media (max-width: 767px) {
      /* border-box: the full-width field keeps its padding and border inside the row (BACKUP-HASH-ENC's password / minimum
         fields stand alone in a stacked row and ran 7 px past the card at 390 - 2.7.0 gate) */
      .note-in {
        inline-size: 100%;
        box-sizing: border-box;
      }
      /* POLISH4-WP7 (D15): the rest of the host's fixed widths give way on a phone. A backup row stacks its name over its actions, the
         two preview tiles share the width, the style swatches take a line each, and a usage bar fills its row. */
      .brow {
        grid-template-columns: minmax(0, 1fr);
      }
      .brow .acts sw-button {
        flex: 1 1 auto;
      }
      .tile-preview {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .swatch {
        flex: 1 1 100%;
      }
      .sw-prev {
        inline-size: 100%;
        box-sizing: border-box;
      }
      .bar {
        inline-size: 100%;
        max-inline-size: 100%;
      }
      .hsum {
        align-items: flex-start;
      }
    }
    /* SETTINGS-INTERCOM-CARDS-2401 (layout a): the cards of "מתגי מסכי כניסה" take the page's width (the open card stands beside the
       headers) and draw their rows a step denser, so every open card fits 1366x768 without a scroll */
    sw-fold-cards.afolds {
      max-inline-size: 1180px;
    }
    /* SETTINGS-CARDS-ACCORDION-2402: in place, one column of cards - the settings column's own width (as the list) */
    sw-fold-cards.afolds[inplace] {
      max-inline-size: 880px;
    }
    .afold-body {
      min-inline-size: 0;
      --sw-set-row-pad: 8px 14px;
      --sw-set-row-gap: 4px;
    }
    .afold-body > * {
      --sw-card-pad: 14px;
    }
    /* SKIN-QA-2403: a short window in a skin with a taller page head (sw-fold-cards FOLD_TIGHT_ROOM) - the rows one more step denser */
    sw-fold-cards.afolds[tight] .afold-body {
      --sw-set-row-pad: 6px 12px;
    }
  `,as];w([c()],m.prototype,"tab",2);w([c()],m.prototype,"phone",2);w([c()],m.prototype,"settings",2);w([c()],m.prototype,"canEdit",2);w([c()],m.prototype,"ownQuality",2);w([c()],m.prototype,"siteLoc",2);w([c()],m.prototype,"nvrChannels",2);w([c()],m.prototype,"floorTree",2);w([c()],m.prototype,"draft",2);w([c()],m.prototype,"streams",2);w([c()],m.prototype,"go2rtc",2);w([c()],m.prototype,"foreign",2);w([c()],m.prototype,"sessions",2);w([c()],m.prototype,"busy",2);w([c()],m.prototype,"loadFailed",2);w([c()],m.prototype,"errors",2);w([c()],m.prototype,"summary",2);w([c()],m.prototype,"summaryFailed",2);w([c()],m.prototype,"version",2);w([c()],m.prototype,"ha",2);w([c()],m.prototype,"pairing",2);w([c()],m.prototype,"showCode",2);w([c()],m.prototype,"regenArmed",2);w([c()],m.prototype,"copied",2);w([c()],m.prototype,"report",2);w([c()],m.prototype,"reportBusy",2);w([c()],m.prototype,"backups",2);w([c()],m.prototype,"backupPolicy",2);w([c()],m.prototype,"backupBusy",2);w([c()],m.prototype,"backupNote",2);w([c()],m.prototype,"backupPassword",2);w([c()],m.prototype,"restorePassword",2);w([c()],m.prototype,"restoreSkip",2);w([c()],m.prototype,"restoreCanSkip",2);w([c()],m.prototype,"backupMinBusy",2);w([c()],m.prototype,"localSafetyBusy",2);w([c()],m.prototype,"restoreSafety",2);w([c()],m.prototype,"backupMsg",2);w([c()],m.prototype,"meterBackup",2);w([c()],m.prototype,"meterBackupBusy",2);w([c()],m.prototype,"meterBackupError",2);w([c()],m.prototype,"skins",2);w([c()],m.prototype,"skinsTest",2);w([c()],m.prototype,"skinsBusy",2);w([c()],m.prototype,"skinsError",2);w([c()],m.prototype,"restoreTarget",2);w([c()],m.prototype,"removeTarget",2);w([c()],m.prototype,"restoreMode",2);w([c()],m.prototype,"restoreAccess",2);w([c()],m.prototype,"restoreConfirm",2);w([c()],m.prototype,"accessOpen",2);w([c()],m.prototype,"accessWide",2);w([c()],m.prototype,"foldSummary",2);w([c()],m.prototype,"foldPresent",2);w([c()],m.prototype,"health",2);m=w([W("system-diagnostics")],m);const ul=Object.freeze(Object.defineProperty({__proto__:null,BRIDGE_INSTALL_RESTART_WARNING:Pa,get SystemDiagnostics(){return m},TAB_CHUNKS:we},Symbol.toStringTag,{value:"Module"}));export{Wr as A,qr as B,Ar as C,jr as D,Gr as E,Yr as F,en as G,Ur as H,Kr as I,il as J,Hr as K,Jr as L,Xr as M,sl as N,el as O,A as P,K as Q,pl as R,Ki as S,ua as T,dl as U,ol as V,ll as W,cl as X,ul as Y,ia as a,na as b,Nr as c,Zr as d,Tr as e,Rr as f,Mr as g,Ir as h,Fr as i,Dr as j,Vr as k,Or as l,Qr as m,al as n,_ as o,qi as p,Zi as q,tl as r,Gi as s,Br as t,Pr as u,rl as v,nl as w,an as x,sn as y,Cs as z};
