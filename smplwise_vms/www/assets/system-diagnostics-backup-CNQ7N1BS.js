import{bG as y,bH as C,cE as G,cC as P,g as A,j as c,i as z,p as O,kn as B,dM as w,n as u,a as f,ft as K,b as o,A as p,k as j}from"./index-DkcUEx2W.js";import{b as M,o as l,c as H,d as I,e as N,f as F,u as L,g as W,h as q,i as k,j as V,k as X,C as U,G as x,l as Y,m as J,n as Q,q as $,r as Z,v as _,w as ee,x as te,y as se,z as ie,A as ae,B as oe,D as re,E as ne,F as le,H as de,I as ce,J as pe,K as he,L as ge,M as ue,N as D,O as fe}from"./system-diagnostics-BurXJUJ7.js";import{s as ve}from"./settings-Dsy9KBNg.js";import"./sw-logo-art-PLtEZJxU.js";import"./static-uXwPZ7cF.js";import"./long-lists-CuzkbAQF.js";import"./skins-BD5YVADK.js";import"./plan-view-Bex3zCOq.js";import"./ha-sync-status-ZWp1dJzN.js";import"./quality-mode-qG3DSOOI.js";import"./map-CsCJvpdZ.js";import"./quality-ladder-BJdzM0n9.js";import"./plan-quality-aRqUSGwU.js";import"./wall-phone-bar-BH-79e8R.js";import"./safe-storage-BOOiiGOc.js";const m={cardTitle:"עותקים מחוץ למכונה",cardSub:"עותק מוצפן של הגיבוי היומי נשלח ליעד חיצוני ונבדק אחרי ההעלאה",empty:"אין יעדים",addS3:"הוספת יעד S3",addSftp:"הוספת יעד SFTP",kind_s3:"S3 (תואם)",kind_sftp:"SFTP",kind_local:"תיקייה",enabled:"פעיל",disabled:"כבוי",name:"שם",endpoint:"כתובת השירות",bucket:"דלי (bucket)",region:"אזור",prefix:"תיקייה בדלי",path_style:"כתובת בסגנון path",access_key:"מזהה מפתח גישה",secret_key:"מפתח סודי",host:"שרת",port:"פורט",username:"משתמש",remote_dir:"תיקייה בשרת",host_key:"מפתח השרת (קבוע)",hostKeyHint:"השורה ssh-ed25519 … של השרת, או טביעת SHA256:…",key:"מפתח פרטי",secretSet:"שמור · השאירו ריק כדי לא לשנות",secretMissing:"לא הוגדר",retention:"שמירה",keep_last:"אחרונים",keep_daily:"ימים",keep_weekly:"שבועות",keep_monthly:"חודשים",save:"שמירה",cancel:"ביטול",edit:"עריכה",remove:"מחיקה",removeConfirm:"למחוק את היעד? העותקים שכבר נמצאים ביעד לא נמחקים.",test:"בדיקת חיבור",testOk:"החיבור תקין: נכתב, נקרא ונמחק קובץ בדיקה",dryRun:"בדיקה יבשה",dryRunOk:"יועלה {name}; יימחקו {n} עותקים ישנים",pushNow:"העלאה עכשיו",pushStarted:"ההעלאה התחילה",lastPush:"עותק אחרון",lastTest:"בדיקה אחרונה",lastDrill:"בדיקת שחזור",never:"עדיין לא",ok:"תקין",failed:"נכשל",verified:"נבדק",saved:"היעד נשמר",keyTitle:"מפתח ההצפנה",keySub:"נשמר רק בהתקנה הזו. בלי המפתח אי אפשר לפתוח את העותקים.",keyActive:"מפתח פעיל",keyNone:"ייווצר בהעלאה הראשונה",keyExported:"יוצא",keyNotExported:"לא יוצא",keyExport:"ייצוא המפתח",keyExportTitle:"ייצוא מפתח ההצפנה",keyExportWarn:"המפתח יוצג פעם אחת בלבד. שמרו אותו מחוץ למכונה (מנהל סיסמאות או נייר). כל מי שמחזיק בו יכול לפתוח את העותקים.",keyExportConfirm:"לאישור הקלידו EXPORT",keyExportWhat:"מפתח ההצפנה הוא הסוד שמצפין את עותקי הגיבוי החיצוניים. רק הוא פותח אותם.",keyExportNoRestore:"בלי המפתח אי אפשר לשחזר גיבוי.",keyExportLost:"אם המפתח אבד, הגיבוי אבד, וגם אנחנו לא נוכל לפתוח אותו.",keyExportStore:"שמרו את המפתח מחוץ למערכת הזו, במנהל סיסמאות או על נייר, ולא בגיבוי עצמו.",keyExportAck:"הבנתי ששומרים את המפתח מחוץ למערכת ושבלעדיו אי אפשר לשחזר",keyShown:"העתיקו עכשיו. המפתח לא יוצג שוב.",copy:"העתקה",copied:"הועתק",keyRotate:"החלפת מפתח",keyRotateTitle:"החלפת מפתח ההצפנה",keyRotateWarn:"עותקים חדשים יוצפנו במפתח חדש. המפתחות הקודמים נשמרים, והעותקים הישנים ממשיכים להיפתח. יש לייצא גם את המפתח החדש.",keyRotateConfirm:"לאישור הקלידו ROTATE",keyRotated:"המפתח הוחלף",keyImport:"ייבוא מפתח",keyImportHint:"מפתח שיוצא מהתקנה קודמת (SWXB-KEY-1:…)",keyImported:"המפתח נוסף",keys:"{n} מפתחות",drillTitle:"בדיקת שחזור",drillSub:"הגיבוי משוחזר לתיקייה זמנית ונבדק. המסד הפעיל לא משתנה.",drillRun:"בדיקה עכשיו",drillRunTarget:"בדיקת העותק המוצפן",drillRunning:"הבדיקה רצה…",drillMonthly:"בדיקה חודשית",drillLocal:"גיבוי מקומי",drillOffbox:"עותק מחוץ למכונה",pass:"עבר",fail:"נכשל",sftpMissing:"רכיב ה־SFTP לא מותקן בגרסה הזו",err_auth_failed:"פרטי הכניסה נדחו",err_host_key_mismatch:"מפתח השרת לא תואם למפתח השמור",err_host_key_required:"יש להדביק את מפתח השרת",err_bucket_missing:"הדלי לא קיים",err_object_missing:"הקובץ לא נמצא ביעד",err_destination_unavailable:"היעד לא זמין",err_permission_denied:"אין הרשאת כתיבה ביעד",err_verify_hash_mismatch:"הקובץ שהועלה לא תואם",err_verify_plain_mismatch:"העותק לא נפתח כמו המקור",err_credential_missing:"חסרים פרטי גישה",err_secrets_missing:"חסרים פרטי גישה",err_key_unreadable:"המפתח הפרטי לא נקרא",err_key_missing:"אין מפתח הצפנה",err_key_mismatch:"העותק הוצפן במפתח שלא נמצא כאן",err_key_already_exported:"המפתח כבר יוצא. לייצוא נוסף יש להחליף מפתח.",err_key_import_invalid:"זה לא מפתח מיוצא תקין",err_archive_missing:"אין גיבוי להעלאה",err_destination_invalid:"אחד השדות לא תקין",err_push_running:"העברה אחרת רצה",err_transport_not_available:"רכיב ההעברה לא מותקן",err_offbox_fetch:"העותק לא הורד או לא נפתח",addGdrive:"הוספת Google Drive",kind_gdrive:"Google Drive",client_id:"מזהה לקוח (Client ID)",client_secret:"סוד הלקוח (Client secret)",folder_name:"שם התיקייה ב־Drive",prune_mode:"מחיקת עותקים ישנים",prune_delete:"מחיקה מיידית",prune_trash:"העברה לאשפה (נספרת במכסה 30 יום)",chunk_mib:"גודל מקטע העלאה (MiB)",quota_margin_pct:"מרווח מכסה (%)",min_free_mib:"מקום פנוי מינימלי (MiB)",gdriveSetupHint:'יש ליצור פעם אחת לקוח OAuth מסוג "TVs and Limited Input devices" בחשבון Google שלכם ולהדביק כאן את המזהה והסוד. ההרשאה מוגבלת לקבצים שהמערכת יצרה בלבד.',gdriveKeyFirst:"לפני ההפעלה יש לייצא את מפתח ההצפנה: ב־Drive נשמר רק עותק מוצפן, ובלי המפתח אי אפשר לפתוח אותו.",gdriveConnected:"חשבון Google מחובר",gdriveNotConnected:"לא חובר חשבון Google",gdriveConnect:"חיבור חשבון Google",gdriveReconnect:"חיבור מחדש",gdriveDisconnect:"ניתוק החשבון",gdriveDisconnected:"החשבון נותק והיעד כובה",gdriveCodeTitle:"חיבור חשבון Google",gdriveStep1:"בטלפון או במחשב אחר, פתחו את {url}",gdriveStep2:"הקלידו את הקוד",gdriveStep3:"התחברו לחשבון Google ואשרו גישה לתיקיית הגיבוי",gdriveWaiting:"ממתין לאישור…",gdriveDone:"החשבון חובר. אפשר להפעיל את היעד.",gdriveDenied:"האישור נדחה ב־Google. אם לא לחצתם 'ביטול' - כנראה החשבון לא נוסף כמשתמש בדיקה (ב־Google Auth Platform, במסך Audience, ברשימת Test users).",gdriveExpired:"הקוד פג. יש ללחוץ שוב על חיבור.",gdriveEnableAfter:"אפשר להפעיל אחרי חיבור החשבון",gdriveBlockedHint:"אם Google מציג 'Access blocked' או 'הגישה חסומה' - החשבון לא נוסף כמשתמש בדיקה. מוסיפים אותו ב־Google Auth Platform, במסך Audience, ברשימת Test users (Add users).",gdriveDiagnose:"בדיקת חיבור Google",gdriveDiagTitle:"בדיקת חיבור Google",gdriveDiagRunning:"בודק מול Google…",gdriveDiagFix:"מה לעשות:",gdriveDiagAgain:"בדיקה חוזרת",gdriveDiagNote:"הבדיקה לא משנה דבר: לא נוצרת תיקייה ב־Drive ולא נשמר דבר.",err_quota_exceeded:"אין מספיק מקום פנוי ב־Google Drive",err_rate_limited:"Google Drive מגביל כרגע את קצב הבקשות; ננסה שוב",err_gdrive_reconnect_required:"החיבור ל־Google Drive פג או בוטל; יש לחבר מחדש",err_gdrive_not_connected:"לא חובר חשבון Google",err_gdrive_client_invalid:"Google דחה את מזהה הלקוח או הסוד",err_gdrive_client_missing:"חסרים מזהה הלקוח או הסוד",err_gdrive_scope_refused:"Google לא אישר את ההרשאה לתיקיית הגיבוי",err_gdrive_token_via_connect:"האסימון מתקבל רק דרך חיבור החשבון",err_gdrive_client_type:"סוג הלקוח ב־Google שגוי (צריך 'TVs and Limited Input devices')",err_gdrive_client_not_found:"Google לא מכיר את מזהה הלקוח (נמחק או הועתק חלקית)",err_gdrive_consent_not_configured:"מסך ההסכמה לא הוגדר בפרויקט ב־Google Cloud",err_gdrive_api_disabled:"Google Drive API לא הופעל בפרויקט ב־Google Cloud",err_remote_error:"תשובה לא צפויה מהיעד",err_other:"שגיאה בהעברה"},S=y("en","i18n/backup-offbox","en"),E=y("ar","i18n/backup-offbox","ar"),T=y("ru","i18n/backup-offbox","ru");function R(){return P(["en","ar","ru"])}const be={he:m,en:S,ar:E,ru:T},me=["ar","ru"];function s(e,t,i=R()){const a=be[i][e]??m[e]??e;return G(a,t)}function v(e,t=R()){const i=`err_${e??""}`;return i in m?s(i,void 0,t):s("err_other",void 0,t)}function $e(e,t,i){return e==="EXPORT"&&t&&!i}C("i18n/backup-offbox",{he:m,en:S,ar:E,ru:T},me);var ye=Object.defineProperty,we=Object.getOwnPropertyDescriptor,d=(e,t,i,a)=>{for(var r=a>1?void 0:a?we(t,i):t,h=e.length-1,g;h>=0;h--)(g=e[h])&&(r=(a?g(t,i,r):g(r))||r);return a&&r&&ye(t,i,r),r};let n=class extends z{constructor(){super(...arguments),this.status=null,this.drill=null,this.form=null,this.clear=[],this.busy="",this.msg=null,this.dialog=null,this.confirm="",this.acked=!1,this.shownKey="",this.copied=!1,this.importText="",this.copies=null,this.pick="",this.prep=null,this.rAccess=!0,this.rPassword="",this.rSkip=!1,this.rErr="",this.rSafety="",this.scopeDefault="project+access",this.minChars=12,this.gCode=null,this.gState="idle",this.gErr="",this.gDiag=null,this.gDiagBusy=!1}connectedCallback(){super.connectedCallback(),this.load(),this.loadPrefs()}async loadPrefs(e=!1){try{const t=await O(e);this.scopeDefault=M(t["backup.offbox_restore_scope"]);const i=Number(t["backup.password_min"]??12);this.minChars=Number.isFinite(i)?Math.max(8,Math.min(64,Math.round(i))):12}catch{}}async saveScopeDefault(e){const t=e?"project+access":"project",i=this.scopeDefault;this.scopeDefault=t,await this.act("scope",async()=>{try{await B({"backup.offbox_restore_scope":t}),w()}catch(a){throw this.scopeDefault=i,a}},l("saved"))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.poll),window.clearTimeout(this.gTimer)}async load(){try{[this.status,this.drill]=await Promise.all([H(),I()])}catch(e){this.msg={ok:!1,text:u(e)}}(this.status?.running||this.drill?.running)&&(window.clearTimeout(this.poll),this.poll=window.setTimeout(()=>void this.load(),2e3))}fail(e){const t=e instanceof f?e.code:void 0;this.msg={ok:!1,text:t?v(t):u(e)}}async act(e,t,i){this.busy=e,this.msg=null;try{await t(),i&&(this.msg={ok:!0,text:i}),await this.load()}catch(a){this.fail(a)}finally{this.busy=""}}edit(e,t="s3"){this.clear=[],this.msg=null,this.form=e?{id:e.id,name:e.name,kind:e.kind,enabled:e.enabled,config:{...e.config},secrets:{},retention:{...e.retention}}:N(t)}async save(){const e=this.form;e&&await this.act("save",async()=>{const t=F(e,this.clear);e.kind==="gdrive"&&!(e.id&&this.status?.targets.find(i=>i.id===e.id)?.secrets.refresh_token)&&(t.enabled=!1),e.id?await L(e.id,t):await W(t),this.form=null},s("saved"))}async test(e){this.busy=`test:${e.id}`,this.msg=null;try{const t=await q(e.id);this.msg=t.ok?{ok:!0,text:s("testOk")}:{ok:!1,text:v(t.error)},await this.load()}catch(t){this.fail(t)}finally{this.busy=""}}async dry(e){this.busy=`dry:${e.id}`,this.msg=null;try{const i=(await k(e.id,!0)).result;this.msg=i?.ok&&i.plan?{ok:!0,text:s("dryRunOk",{name:i.plan.upload.name,n:i.plan.delete.length})}:{ok:!1,text:v(i?.error)}}catch(t){this.fail(t)}finally{this.busy=""}}when(e){return e?K(new Date(e)):s("never")}runBadge(e,t){return e?o`<span class="run" data-run=${e.action}>${s(t)}
      <sw-badge kind=${e.ok?"live":"error"} label=${e.ok?e.verified?s("verified"):s("ok"):s("failed")}></sw-badge>
      <span class="muted">${this.when(e.finished_at??e.started_at)}${e.ok?"":` · ${v(e.error)}`}</span></span>`:o`<span class="muted">${s(t)} · ${s("never")}</span>`}renderTarget(e){const t=this.busy,i=e.kind==="sftp"&&this.status&&!this.status.transports.sftp,a=e.kind==="gdrive"?e.gdrive??{connected:!1,connected_at:null}:null,r=!!a&&!a.connected&&!e.enabled;return o`<div class="target" data-offbox-target=${e.id}>
      <div class="head">
        <span class="name">${e.name}<span class="muted"> · ${s(`kind_${e.kind}`)}</span></span>
        <sw-toggle ?checked=${e.enabled} label=${e.enabled?s("enabled"):s("disabled")} ?disabled=${!!t||r}
          title=${r?s("gdriveEnableAfter"):p}
          @change=${h=>void this.act(`en:${e.id}`,()=>V(e.id,h.detail.checked))}></sw-toggle>
      </div>
      ${a?o`<div class="gd" data-offbox-gdrive=${a.connected?"connected":"not-connected"}>
            <sw-badge kind=${a.connected?"live":"partial"} label=${a.connected?s("gdriveConnected"):s("gdriveNotConnected")}></sw-badge>
            ${a.connected&&a.connected_at?o`<span class="muted">${this.when(a.connected_at)}</span>`:p}
            <sw-button size="sm" variant=${a.connected?"ghost":"primary"} icon="link" ?disabled=${!!t} data-offbox-gdrive-connect
              @click=${()=>void this.openGdrive(e)}>${a.connected?s("gdriveReconnect"):s("gdriveConnect")}</sw-button>
            <sw-button size="sm" variant="ghost" icon="check" ?disabled=${!!t} data-offbox-gdrive-diagnose
              @click=${()=>void this.openDiag(e)}>${s("gdriveDiagnose")}</sw-button>
            ${a.connected?o`<sw-button size="sm" variant="ghost" ?disabled=${!!t} data-offbox-gdrive-disconnect
                  @click=${()=>void this.act(`gdoff:${e.id}`,()=>X(e.id),s("gdriveDisconnected"))}>${s("gdriveDisconnect")}</sw-button>`:p}
          </div>
          ${this.status?.key.keys.some(h=>h.exported)?p:o`<div class="msg warn" role="note" data-offbox-gdrive-keyfirst>${s("gdriveKeyFirst")}</div>`}`:p}
      <div class="runs">${this.runBadge(e.last.push,"lastPush")}${this.runBadge(e.last.test,"lastTest")}${this.runBadge(e.last.drill,"lastDrill")}</div>
      ${i?o`<div class="msg err" role="note">${s("sftpMissing")}</div>`:p}
      <div class="actions">
        <sw-button size="sm" icon="check" ?disabled=${!!t} data-offbox-test @click=${()=>void this.test(e)}>${s("test")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!t} data-offbox-dry @click=${()=>void this.dry(e)}>${s("dryRun")}</sw-button>
        <sw-button size="sm" variant="primary" icon="upload" ?disabled=${!!t||this.status?.running} data-offbox-push
          @click=${()=>void this.act(`push:${e.id}`,()=>k(e.id),s("pushStarted"))}>${s("pushNow")}</sw-button>
        <sw-button size="sm" variant="ghost" icon="download" ?disabled=${!!t||!this.status?.key.active} data-offbox-restore-open
          @click=${()=>void this.openRestore(e)}>${l("open")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!t} data-offbox-edit @click=${()=>this.edit(e)}>${s("edit")}</sw-button>
        <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${!!t} data-offbox-remove @click=${()=>{this.dialog={remove:e}}}>${s("remove")}</sw-button>
      </div>
    </div>`}setCfg(e,t){this.form&&(this.form={...this.form,config:{...this.form.config,[e]:t}})}setSecret(e,t){this.form&&(this.form={...this.form,secrets:{...this.form.secrets,[e]:t}},this.clear=this.clear.filter(i=>i!==e))}renderForm(){const e=this.form;if(!e||e.kind==="local")return p;const t=e.kind,i=e.id?this.status?.targets.find(r=>r.id===e.id)?.secrets??{}:{},a=t!=="gdrive"||!!i.refresh_token;return o`<div class="form" data-offbox-form=${t}>
      ${t==="gdrive"?o`<div class="muted" role="note" data-offbox-gdrive-hint>${s("gdriveSetupHint")}</div>`:p}
      <label class="row"><span class="lbl">${s("name")}</span><input class="ctl" data-f="name" .value=${e.name} maxlength="80"
        @input=${r=>{this.form&&(this.form={...this.form,name:r.target.value})}} /></label>
      ${U[t].map(r=>{const h=e.config[r];if(r==="prune_mode")return o`<label class="row"><span class="lbl">${s("prune_mode")}</span><select class="ctl" data-f="prune_mode" .value=${String(h??"delete")}
            @change=${g=>this.setCfg(r,g.target.value)}>
              <option value="delete" ?selected=${h!=="trash"}>${s("prune_delete")}</option>
              <option value="trash" ?selected=${h==="trash"}>${s("prune_trash")}</option></select></label>`;if(r in x){const g=x[r];return o`<label class="row"><span class="lbl">${s(r)}</span><input class="ctl num" data-ltr data-f=${r} type="number" min=${g.min} max=${g.max}
            .value=${String(h??g.fallback)} @input=${b=>this.setCfg(r,b.target.value)} /></label>`}return r==="path_style"?o`<div class="row"><span class="lbl">${s("path_style")}</span><sw-toggle ?checked=${!!h} label=${s("path_style")} labelHidden
            @change=${g=>this.setCfg(r,g.detail.checked)}></sw-toggle></div>`:r==="host_key"?o`<label class="row stack"><span class="lbl">${s("host_key")}<span class="muted">${s("hostKeyHint")}</span></span>
            <textarea class="ctl wide" data-ltr data-f="host_key" rows="2" spellcheck="false" .value=${String(h??"")}
              @input=${g=>this.setCfg(r,g.target.value)}></textarea></label>`:o`<label class="row"><span class="lbl">${s(r)}</span><input class="ctl" data-ltr data-f=${r} type=${r==="port"?"number":"text"}
          .value=${String(h??"")} @input=${g=>this.setCfg(r,g.target.value)} /></label>`})}
      ${Y[t].map(r=>{const h=!!i[r]&&!this.clear.includes(r),g=s(h?"secretSet":"secretMissing");return r==="key"?o`<label class="row stack"><span class="lbl">${s("key")}</span><textarea class="ctl wide" data-ltr data-secret=${r} rows="3" spellcheck="false" autocomplete="off"
              placeholder=${g} .value=${e.secrets[r]??""} @input=${b=>this.setSecret(r,b.target.value)}></textarea></label>`:o`<label class="row"><span class="lbl">${s(r)}</span><input class="ctl" data-ltr data-secret=${r} type="password" autocomplete="new-password"
              placeholder=${g} .value=${e.secrets[r]??""} @input=${b=>this.setSecret(r,b.target.value)} /></label>`})}
      <div class="row"><span class="lbl">${s("retention")}</span><span class="ret">
        ${["keep_last","keep_daily","keep_weekly","keep_monthly"].map(r=>o`<label><input type="number" min=${r==="keep_last"?1:0} max="1000"
          data-f=${r} .value=${String(e.retention[r])} @input=${h=>{this.form&&(this.form={...this.form,retention:{...this.form.retention,[r]:Number(h.target.value)}})}} />
          <span class="muted">${s(r)}</span></label>`)}</span></div>
      <div class="row"><span class="lbl">${s("enabled")}${a?p:o`<span class="muted">${s("gdriveEnableAfter")}</span>`}</span>
        <sw-toggle ?checked=${e.enabled&&a} label=${s("enabled")} labelHidden ?disabled=${!a}
        @change=${r=>{this.form&&(this.form={...this.form,enabled:r.detail.checked})}}></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" ?disabled=${!!this.busy||!e.name.trim()} data-offbox-save @click=${()=>void this.save()}>${s("save")}</sw-button>
        <sw-button variant="ghost" @click=${()=>{this.form=null}}>${s("cancel")}</sw-button></div>
    </div>`}async doExport(){await this.act("export",async()=>{const e=await J();this.shownKey=e.key,this.confirm=""})}async copyKey(){try{await navigator.clipboard.writeText(this.shownKey),this.copied=!0}catch{this.copied=!1}}async openRestore(e){this.dialog={restore:e},this.copies=null,this.pick="",this.prep=null,this.rErr="",this.rAccess=this.scopeDefault==="project+access",this.rSafety="";try{this.copies=(await Q(e.id)).copies,this.pick=this.copies[0]?.name??""}catch(t){this.copies=[],this.rErr=t instanceof f?$(t.code):u(t)}}async doPrepare(e){if(this.pick){this.busy="prepare",this.rErr="";try{this.prep=await Z(e.id,this.pick)}catch(t){this.rErr=t instanceof f?$(t.code):u(t)}finally{this.busy=""}}}async doRestore(){const e=this.prep;if(!(!e||!_(this.confirm,!!this.busy))){this.busy="restore",this.rErr="";try{const t=await ee({stage_id:e.id,confirm:this.confirm,scope:this.rAccess?"project+access":"project",...this.rPassword?{backup_password:this.rPassword}:{},...this.rSkip?{skip_sensitive:!0}:{},...te(this.rSafety)});this.prep=null,this.rPassword="",this.rSafety="",w(),this.closeDialog(),this.msg={ok:!0,text:l("done",{name:t.object,n:Object.keys(t.tables).length,files:t.files,safety:t.safety_archive.name})},await this.load()}catch(t){this.rErr=t instanceof f?t.code.startsWith("safety_password_")?se(t.code,t.body.details):t.body.details?.can_skip?u(t):$(t.code):u(t),this.rPassword="",this.rSafety=""}finally{this.busy=""}}}renderRestore(e){const t=this.prep,i=a=>a.stamp?this.when(a.stamp):"";return o`<sw-dialog open heading=${l("title")} subheading=${e.name} data-offbox-restore-dialog @close=${()=>this.closeDialog()}>
      ${this.rErr?o`<div class="msg err" role="alert" data-offbox-restore-err>${this.rErr}</div>`:p}
      ${t?o`<div class="msg ok" role="status">${l("verified")}</div>
            <dl class="row facts" data-offbox-restore-facts>
              <div><dt>${l("summary_version")}</dt><dd><code data-ltr>${t.app_version??"-"}</code></dd></div>
              <div><dt>${l("summary_schema")}</dt><dd><code data-ltr>${t.schema_version}</code></dd></div>
              <div><dt>${l("summary_tables")}</dt><dd class="num">${Object.keys(t.tables).length} / ${t.files}</dd></div>
              <div><dt>${l("summary_key")}</dt><dd><code data-ltr>${t.key_id}</code></dd></div>
            </dl>
            <div class="msg warn" role="note">${l("warnDestructive")}</div>
            <label class="ack"><input type="checkbox" data-offbox-restore-access .checked=${this.rAccess}
              @change=${a=>{this.rAccess=a.target.checked}} /><span>${l("includeAccess")}</span></label>
            ${t.sensitive==="encrypted"?o`<label class="row"><span class="lbl">${l("password")}</span><input class="ctl" type="password" autocomplete="off" data-offbox-restore-password
                  .value=${this.rPassword} ?disabled=${this.rSkip} @input=${a=>{this.rPassword=a.target.value}} /></label>
                <label class="ack"><input type="checkbox" data-offbox-restore-skip .checked=${this.rSkip}
                  @change=${a=>{this.rSkip=a.target.checked}} /><span>${l("skipSensitive")}</span></label>`:p}
            <label class="row" data-offbox-restore-safety-row><span class="lbl">${l("safetyPassword")}<span class="muted">${l("safetyHint")}</span></span>
              <input class="ctl" type="password" autocomplete="new-password" data-offbox-restore-safety placeholder=${l("safetyPlaceholder",{n:this.minChars})}
                .value=${this.rSafety} @input=${a=>{this.rSafety=a.target.value}} /></label>
            <div class="muted">${l("confirmHint")}</div>
            <input class="confirm-in" data-ltr data-offbox-restore-confirm placeholder="RESTORE" .value=${this.confirm}
              @input=${a=>{this.confirm=a.target.value}} />`:this.copies===null?o`<div class="muted">${l("loading")}</div>`:this.copies.length===0?o`<div class="muted" data-offbox-restore-none>${l("none")}</div>`:o`<div class="muted">${l("pick")}</div>
              ${this.copies.slice(0,5).map((a,r)=>o`<label class="ack" data-offbox-copy=${a.name}><input type="radio" name="offbox-copy" .checked=${this.pick===a.name}
                  @change=${()=>{this.pick=a.name}} /><span><code data-ltr>${a.name}</code><span class="muted"> · ${ie(a.bytes)}${i(a)?` · ${i(a)}`:""}${r===0?` · ${l("newest")}`:""}</span></span></label>`)}`}
      <div slot="footer">
        ${t?o`<sw-button variant="danger" icon="download" ?disabled=${!_(this.confirm,!!this.busy)} data-offbox-restore-go
              @click=${()=>void this.doRestore()}>${this.busy==="restore"?l("restoring"):l("restore")}</sw-button>`:o`<sw-button variant="primary" icon="download" ?disabled=${!this.pick||!!this.busy} data-offbox-prepare
              @click=${()=>void this.doPrepare(e)}>${this.busy==="prepare"?l("preparing"):l("prepare")}</sw-button>`}
        <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${l("cancel")}</sw-button>
      </div>
    </sw-dialog>`}async openGdrive(e){window.clearTimeout(this.gTimer),this.dialog={gdrive:e},this.gCode=null,this.gErr="",this.gState="idle";try{this.gCode=await ae(e.id),this.gState="waiting",this.schedulePoll(e,this.gCode.interval)}catch(t){this.gErr=t instanceof f?v(t.code):u(t)}}schedulePoll(e,t){window.clearTimeout(this.gTimer),this.gTimer=window.setTimeout(()=>void this.pollGdrive(e),oe(t))}async pollGdrive(e){const t=this.dialog;if(!(!t||typeof t!="object"||!("gdrive"in t)||t.gdrive.id!==e.id))try{const i=await re(e.id);if(ne(i.state)){this.schedulePoll(e,i.interval??this.gCode?.interval);return}this.gState=i.state==="connected"?"connected":i.state==="denied"?"denied":"expired",i.state==="connected"&&await this.load()}catch(i){this.gState="idle",this.gErr=i instanceof f?v(i.code):u(i)}}renderGdrive(e){const t=this.gCode,i=this.gState,a=t&&le(t.verification_url)?t.verification_url:"https://www.google.com/device";return o`<sw-dialog open heading=${s("gdriveCodeTitle")} subheading=${e.name} data-offbox-gdrive-dialog @close=${()=>this.closeDialog()}>
      ${this.gErr?o`<div class="msg err" role="alert" data-offbox-gdrive-err>${this.gErr}</div>`:p}
      ${i==="connected"?o`<div class="msg ok" role="status" data-offbox-gdrive-done>${s("gdriveDone")}</div>`:i==="denied"||i==="expired"?o`<div class="msg err" role="alert" data-offbox-gdrive-end=${i}>${s(i==="denied"?"gdriveDenied":"gdriveExpired")}</div>`:t?o`<ol class="steps" data-offbox-gdrive-steps>
                <li>${s("gdriveStep1",{url:""})}<a data-ltr href=${a} target="_blank" rel="noopener noreferrer">${a.replace("https://","")}</a></li>
                <li>${s("gdriveStep2")}<div class="code" data-ltr data-offbox-gdrive-code aria-live="polite">${t.user_code}</div></li>
                <li>${s("gdriveStep3")}</li></ol>
              <div class="muted" role="status">${s("gdriveWaiting")}</div>
              <div class="muted" role="note" data-offbox-gdrive-blocked>${s("gdriveBlockedHint")}</div>`:this.gErr?p:o`<div class="muted">…</div>`}
      <div slot="footer">
        ${i==="denied"||i==="expired"?o`<sw-button variant="primary" icon="link" data-offbox-gdrive-retry @click=${()=>void this.openGdrive(e)}>${s("gdriveConnect")}</sw-button>`:p}
        <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${s(i==="connected"?"ok":"cancel")}</sw-button>
      </div>
    </sw-dialog>`}async openDiag(e){this.dialog={gdiag:e},this.gDiag=null,this.gErr="",this.gDiagBusy=!0;try{this.gDiag=await de(e.id)}catch(t){this.gErr=t instanceof f?v(t.code):u(t)}finally{this.gDiagBusy=!1}}renderDiag(e){const t=this.gDiag;return o`<sw-dialog open heading=${s("gdriveDiagTitle")} subheading=${e.name} data-offbox-gdrive-diag @close=${()=>this.closeDialog()}>
      ${this.gErr?o`<div class="msg err" role="alert">${this.gErr}</div>`:p}
      ${this.gDiagBusy?o`<div class="muted" role="status">${s("gdriveDiagRunning")}</div>`:p}
      ${t?o`<div class="msg ${t.ok?"ok":"err"}" role=${t.ok?"status":"alert"} data-offbox-gdrive-diag-summary=${t.ok?"ok":"fail"}>${t.summary}</div>
            <ul class="diag" data-offbox-gdrive-diag-list>
              ${t.checks.map(i=>o`<li data-check=${i.id} data-status=${i.status}>
                <span class="dh"><sw-badge kind=${ce(i.status)} label=${i.title}></sw-badge></span>
                <span>${i.message}</span>
                ${i.fix&&i.status!=="ok"?o`<span class="muted fix"><b>${s("gdriveDiagFix")}</b> ${i.fix}</span>`:p}
              </li>`)}
            </ul>
            <div class="muted">${s("gdriveDiagNote")}</div>`:p}
      <div slot="footer">
        <sw-button variant="primary" icon="check" ?disabled=${this.gDiagBusy} data-offbox-gdrive-diag-again @click=${()=>void this.openDiag(e)}>${s("gdriveDiagAgain")}</sw-button>
        <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${s("ok")}</sw-button>
      </div>
    </sw-dialog>`}closeDialog(){this.gDiag=null,this.gDiagBusy=!1,window.clearTimeout(this.gTimer),this.gCode=null,this.gErr="",this.gState="idle",this.prep&&pe(this.prep.id).catch(()=>{}),this.prep=null,this.copies=null,this.pick="",this.rErr="",this.rPassword="",this.rSafety="",this.rSkip=!1,this.dialog=null,this.confirm="",this.acked=!1,this.shownKey="",this.copied=!1}renderDialog(){const e=this.dialog;if(!e)return p;if(typeof e=="object"&&"restore"in e)return this.renderRestore(e.restore);if(typeof e=="object"&&"gdrive"in e)return this.renderGdrive(e.gdrive);if(typeof e=="object"&&"gdiag"in e)return this.renderDiag(e.gdiag);if(typeof e=="object")return o`<sw-dialog open heading=${s("remove")} subheading=${e.remove.name} data-offbox-remove-dialog @close=${()=>this.closeDialog()}>
        <div class="muted">${s("removeConfirm")}</div>
        <div slot="footer"><sw-button variant="danger" icon="trash" ?disabled=${!!this.busy} data-offbox-remove-go
          @click=${()=>void this.act("remove",async()=>{await he(e.remove.id),this.closeDialog()})}>${s("remove")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${s("cancel")}</sw-button></div>
      </sw-dialog>`;const t=e==="export",i=t?"EXPORT":"ROTATE";return o`<sw-dialog open heading=${s(t?"keyExportTitle":"keyRotateTitle")} data-offbox-key-dialog=${e} @close=${()=>this.closeDialog()}>
      ${this.shownKey?o`<div class="msg ok" role="status">${s("keyShown")}</div>
            <textarea class="keybox" data-ltr readonly rows="3" data-offbox-key-text .value=${this.shownKey}></textarea>`:o`<div class="msg warn" role="note">${s(t?"keyExportWarn":"keyRotateWarn")}</div>
            ${t?o`<ul class="keyfacts" data-offbox-key-facts>
                  <li>${s("keyExportWhat")}</li><li>${s("keyExportNoRestore")}</li><li>${s("keyExportLost")}</li><li>${s("keyExportStore")}</li></ul>
                <label class="ack"><input type="checkbox" data-offbox-ack .checked=${this.acked}
                  @change=${a=>{this.acked=a.target.checked}} /><span>${s("keyExportAck")}</span></label>`:p}
            <div class="muted">${s(t?"keyExportConfirm":"keyRotateConfirm")}</div>
            <input class="confirm-in" data-ltr data-offbox-confirm placeholder=${i} .value=${this.confirm} @input=${a=>{this.confirm=a.target.value}} />`}
      <div slot="footer">
        ${this.shownKey?o`<sw-button variant="primary" icon="copy" data-offbox-copy @click=${()=>void this.copyKey()}>${this.copied?s("copied"):s("copy")}</sw-button>`:o`<sw-button variant=${t?"primary":"danger"} ?disabled=${t?!$e(this.confirm,this.acked,!!this.busy):this.confirm!==i||!!this.busy} data-offbox-key-go
              @click=${()=>void(t?this.doExport():this.act("rotate",async()=>{await ge(),this.closeDialog()},s("keyRotated")))}>${s(t?"keyExport":"keyRotate")}</sw-button>`}
        <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${s("cancel")}</sw-button>
      </div>
    </sw-dialog>`}renderKey(){const e=this.status?.key,t=e?.keys.find(i=>i.active);return o`<sw-card heading=${s("keyTitle")} subheading=${s("keySub")} data-offbox-key>
      <div class="row"><span class="lbl">${s("keyActive")}${e&&e.keys.length>1?o`<span class="muted">${s("keys",{n:e.keys.length})}</span>`:p}</span>
        <span class="end">${t?o`<code data-ltr>${t.id}</code> <sw-badge kind=${t.exported?"live":"partial"} label=${t.exported?s("keyExported"):s("keyNotExported")}></sw-badge>`:o`<span class="muted">${s("keyNone")}</span>`}</span></div>
      <div class="actions">
        <sw-button size="sm" icon="lock" ?disabled=${!!this.busy||!!t?.exported} data-offbox-export @click=${()=>{this.dialog="export"}}>${s("keyExport")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!this.busy||!t} data-offbox-rotate @click=${()=>{this.dialog="rotate"}}>${s("keyRotate")}</sw-button>
      </div>
      <div class="row"><span class="lbl">${s("keyImport")}<span class="muted">${s("keyImportHint")}</span></span>
        <span class="end"><input class="ctl" data-ltr type="password" autocomplete="off" data-offbox-import .value=${this.importText}
          @input=${i=>{this.importText=i.target.value}} />
          <sw-button size="sm" ?disabled=${!this.importText.trim()||!!this.busy} data-offbox-import-go
            @click=${()=>void this.act("import",async()=>{await ue(this.importText),this.importText=""},s("keyImported"))}>${s("keyImport")}</sw-button></span></div>
    </sw-card>`}renderDrill(){const e=this.drill,t=(this.status?.targets??[]).filter(a=>a.enabled),i=a=>a?o`<sw-badge kind=${a.result==="PASS"?"live":"error"} label=${a.result==="PASS"?s("pass"):s("fail")}></sw-badge> <span class="muted">${this.when(a.finished_at)}</span>`:o`<span class="muted">${s("never")}</span>`;return o`<sw-card heading=${s("drillTitle")} subheading=${s("drillSub")} data-offbox-drill>
      <div class="row"><span class="lbl">${s("drillLocal")}</span><span class="end">${i(e?.last??null)}
        <sw-button size="sm" ?disabled=${!!e?.running||!!this.busy} data-drill-run @click=${()=>void this.act("drill",()=>D())}>${e?.running?s("drillRunning"):s("drillRun")}</sw-button></span></div>
      ${t.length?o`<div class="row"><span class="lbl">${s("drillOffbox")}</span><span class="end">${i(e?.last_offbox??null)}
            ${t.map(a=>o`<sw-button size="sm" variant="ghost" ?disabled=${!!e?.running||!!this.busy} data-drill-run-target=${a.id}
              @click=${()=>void this.act("drill",()=>D(a.id))}>${t.length>1?`${s("drillRunTarget")} · ${a.name}`:s("drillRunTarget")}</sw-button>`)}</span></div>`:p}
      <div class="row"><span class="lbl">${s("drillMonthly")}</span><sw-toggle ?checked=${!!e?.schedule.monthly} label=${s("drillMonthly")} labelHidden data-drill-monthly
        @change=${a=>void this.act("monthly",()=>fe(a.detail.checked))}></sw-toggle></div>
    </sw-card>`}render(){const e=this.status;return o`
      <sw-card heading=${s("cardTitle")} subheading=${s("cardSub")} data-offbox>
        ${e===null?o`<div class="muted">…</div>`:e.targets.length?e.targets.map(t=>this.renderTarget(t)):o`<div class="muted" data-offbox-empty>${s("empty")}</div>`}
        ${this.form?this.renderForm():o`<div class="actions">
          <sw-button size="sm" icon="plus" data-offbox-add="s3" @click=${()=>this.edit(void 0,"s3")}>${s("addS3")}</sw-button>
          <sw-button size="sm" icon="plus" data-offbox-add="sftp" @click=${()=>this.edit(void 0,"sftp")}>${s("addSftp")}</sw-button>
          <sw-button size="sm" icon="plus" data-offbox-add="gdrive" @click=${()=>this.edit(void 0,"gdrive")}>${s("addGdrive")}</sw-button></div>`}
        <div class="row" data-offbox-scope-default><span class="lbl">${l("scopeDefault")}<span class="muted">${l("scopeDefaultHint")}</span></span>
          <sw-toggle ?checked=${this.scopeDefault==="project+access"} label=${l("scopeDefault")} labelHidden ?disabled=${!!this.busy} data-offbox-scope-toggle
            @change=${t=>void this.saveScopeDefault(t.detail.checked)}></sw-toggle></div>
        ${this.msg?o`<div class="msg ${this.msg.ok?"ok":"err"}" role=${this.msg.ok?"status":"alert"} data-offbox-msg>${this.msg.text}</div>`:p}
      </sw-card>
      ${this.renderKey()}
      ${this.renderDrill()}
      ${this.renderDialog()}`}};n.styles=[ve,A`
    :host { display: grid; gap: var(--sw-s-4); }
    .target { display: grid; gap: 6px; padding-block: 10px; border-block-end: 1px solid var(--sw-border); }
    .target:last-of-type { border-block-end: 0; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .name { font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); }
    .runs { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--sw-fs-sm); }
    .run { display: inline-flex; align-items: center; gap: 6px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; padding-block: 6px; }
    .form { display: grid; gap: 2px; padding-block: 8px; }
    .ret { display: flex; flex-wrap: wrap; gap: 10px; }
    .ret label { display: inline-flex; align-items: center; gap: 4px; }
    .ret input { inline-size: 64px; }
    input.ctl, textarea.ctl, .ret input, .confirm-in, .keybox { font: inherit; padding: 6px 8px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm);
      background: var(--sw-surface); color: var(--sw-text); min-inline-size: 0; }
    .keyfacts { margin: 0; padding-inline-start: 18px; display: grid; gap: 4px; }
    .ack { display: flex; gap: 8px; align-items: flex-start; }
    textarea.ctl, .keybox { inline-size: 100%; box-sizing: border-box; font-family: var(--sw-font-mono, monospace); font-size: var(--sw-fs-sm); }
    [data-ltr] { direction: ltr; text-align: start; }
    .end { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    code { font-family: var(--sw-font-mono, monospace); }
    /* OFFBOX-RESTORE-2300: the verified copy's facts in ONE well (four cells, one line where the dialog is wide), so the restore dialog
       holds the safety password row without scrolling on a tablet or a phone */
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px 16px; margin: 0; }
    .facts dt { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .facts dd { margin: 0; font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); overflow-wrap: anywhere; }
    .facts .num { font-variant-numeric: tabular-nums; }
    /* GDRIVEBK-2310: the Google connection row and the consent dialog (the code is LTR, large, monospace) */
    .gd { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    select.ctl { font: inherit; padding: 6px 8px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm);
      background: var(--sw-surface); color: var(--sw-text); min-inline-size: 0; }
    input.num { inline-size: 96px; }
    .steps { margin: 0; padding-inline-start: 20px; display: grid; gap: 10px; }
    .steps a { color: var(--sw-accent-text, var(--sw-accent)); font-weight: var(--sw-fw-semibold); }
    .code { margin-block-start: 6px; font-family: var(--sw-font-mono, monospace); font-size: var(--sw-fs-xl, 1.5rem); letter-spacing: 0.12em;
      font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); }
    /* GDRIVE-READY-2351: the connection check - one row per step, the fix under it */
    .diag { margin: 0; padding: 0; list-style: none; display: grid; gap: 10px; }
    .diag li { display: grid; gap: 2px; }
    .diag .fix { font-size: var(--sw-fs-sm); }
    /* POLISH4-WP7: a visible focus ring on the plain fields, and on a phone the head, the action keys and the fields wrap onto the width */
    input.ctl:focus-visible, textarea.ctl:focus-visible, select.ctl:focus-visible, .ret input:focus-visible, .confirm-in:focus-visible, .keybox:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; border-color: var(--sw-accent); }
    @media (max-width: 767px) {
      .head { flex-wrap: wrap; }
      .actions sw-button, .gd sw-button { flex: 1 1 auto; }
      input.ctl, select.ctl { inline-size: 100%; box-sizing: border-box; }
      .code { overflow-wrap: anywhere; }
    }
    @media (pointer: coarse) {
      input.ctl, select.ctl, .ret input, input.num { min-block-size: 44px; }
    }
  `];d([c()],n.prototype,"status",2);d([c()],n.prototype,"drill",2);d([c()],n.prototype,"form",2);d([c()],n.prototype,"clear",2);d([c()],n.prototype,"busy",2);d([c()],n.prototype,"msg",2);d([c()],n.prototype,"dialog",2);d([c()],n.prototype,"confirm",2);d([c()],n.prototype,"acked",2);d([c()],n.prototype,"shownKey",2);d([c()],n.prototype,"copied",2);d([c()],n.prototype,"importText",2);d([c()],n.prototype,"copies",2);d([c()],n.prototype,"pick",2);d([c()],n.prototype,"prep",2);d([c()],n.prototype,"rAccess",2);d([c()],n.prototype,"rPassword",2);d([c()],n.prototype,"rSkip",2);d([c()],n.prototype,"rErr",2);d([c()],n.prototype,"rSafety",2);d([c()],n.prototype,"scopeDefault",2);d([c()],n.prototype,"minChars",2);d([c()],n.prototype,"gCode",2);d([c()],n.prototype,"gState",2);d([c()],n.prototype,"gErr",2);d([c()],n.prototype,"gDiag",2);d([c()],n.prototype,"gDiagBusy",2);n=d([j("sw-offbox-backup")],n);
