import{bs as R,bu as Z,br as Q,bt as ee,j as L,k as l,a as H,p as te,kb as se,dl as C,q as y,c as $,fo as x,b as r,A as d,ae as D,m as K,bg as ae,bv as F,cc as ie,cL as o,no as A,np as S,nq as re}from"./index-bjkrEUAJ.js";import{b as oe,o as c,c as ne,d as le,e as de,f as ce,u as pe,g as he,h as ge,i as P,j as ue,k as fe,C as ve,G as z,l as be,m as me,n as ye,q as T,r as $e,v as G,w as we,x as ke,y as xe,z as _,A as _e,B as Ee,D as De,E as Se,F as Te,H as Re,I as Ce,J as Ae,K as Pe,L as ze,M as Ge,N as O,O as Oe}from"./system-diagnostics-b7Hdclpx.js";import{s as q}from"./settings-BsA9TwNg.js";import"./sw-pager-BBiB50zH.js";import"./sw-table-D5UAWIHJ.js";import{b as N,a as Ne}from"./confirm-words-C_y6pwcn.js";import"./sw-logo-art-PLtEZJxU.js";import"./static-CqLt9T_B.js";import"./long-lists-Cv9KxDlh.js";import"./skins-DyKYiooR.js";import"./plan-view-AwIs-a5N.js";import"./bubble-chrome-wRf-BHoZ.js";import"./system-a-BqOtLkqY.js";import"./toast-controller-BPX0Tkjm.js";import"./live-C6uZlfj2.js";import"./ha-sync-status-CavxdTMn.js";import"./quality-mode-B7FZjEMA.js";import"./map-BZRrpbPO.js";import"./quality-ladder-D71YGCxn.js";import"./plan-quality-Czls8Lbg.js";import"./wall-phone-bar-DI4czEOU.js";import"./media-BZ0T2v6O.js";import"./safe-storage-BOOiiGOc.js";const E={cardTitle:"עותקים מחוץ למכונה",cardSub:"עותק מוצפן של הגיבוי היומי נשלח ליעד חיצוני ונבדק אחרי ההעלאה",empty:"אין יעדים",addS3:"הוספת יעד S3",addSftp:"הוספת יעד SFTP",kind_s3:"S3 (תואם)",kind_sftp:"SFTP",kind_local:"תיקייה",enabled:"פעיל",disabled:"כבוי",name:"שם",endpoint:"כתובת השירות",bucket:"דלי (bucket)",region:"אזור",prefix:"תיקייה בדלי",path_style:"כתובת בסגנון path",access_key:"מזהה מפתח גישה",secret_key:"מפתח סודי",host:"שרת",port:"פורט",username:"משתמש",remote_dir:"תיקייה בשרת",host_key:"מפתח השרת (קבוע)",hostKeyHint:"השורה ssh-ed25519 … של השרת, או טביעת SHA256:…",key:"מפתח פרטי",secretSet:"שמור · השאירו ריק כדי לא לשנות",secretMissing:"לא הוגדר",retention:"שמירה",keep_last:"אחרונים",keep_daily:"ימים",keep_weekly:"שבועות",keep_monthly:"חודשים",save:"שמירה",cancel:"ביטול",edit:"עריכה",remove:"מחיקה",removeConfirm:"למחוק את היעד? העותקים שכבר נמצאים ביעד לא נמחקים.",test:"בדיקת חיבור",testOk:"החיבור תקין: נכתב, נקרא ונמחק קובץ בדיקה",dryRun:"בדיקה יבשה",dryRunOk:"יועלה {name}; יימחקו {n} עותקים ישנים",pushNow:"העלאה עכשיו",pushStarted:"ההעלאה התחילה",lastPush:"עותק אחרון",lastTest:"בדיקה אחרונה",lastDrill:"בדיקת שחזור",never:"עדיין לא",ok:"תקין",failed:"נכשל",verified:"נבדק",saved:"היעד נשמר",keyTitle:"מפתח ההצפנה",keySub:"נשמר רק בהתקנה הזו. בלי המפתח אי אפשר לפתוח את העותקים.",keyActive:"מפתח פעיל",keyNone:"ייווצר בהעלאה הראשונה",keyExported:"יוצא",keyNotExported:"לא יוצא",keyExport:"ייצוא המפתח",keyExportTitle:"ייצוא מפתח ההצפנה",keyExportWarn:"המפתח יוצג פעם אחת בלבד. שמרו אותו מחוץ למכונה (מנהל סיסמאות או נייר). כל מי שמחזיק בו יכול לפתוח את העותקים.",keyExportConfirm:"לאישור הקלידו EXPORT",keyExportWhat:"מפתח ההצפנה הוא הסוד שמצפין את עותקי הגיבוי החיצוניים. רק הוא פותח אותם.",keyExportNoRestore:"בלי המפתח אי אפשר לשחזר גיבוי.",keyExportLost:"אם המפתח אבד, הגיבוי אבד, וגם אנחנו לא נוכל לפתוח אותו.",keyExportStore:"שמרו את המפתח מחוץ למערכת הזו, במנהל סיסמאות או על נייר, ולא בגיבוי עצמו.",keyExportAck:"הבנתי ששומרים את המפתח מחוץ למערכת ושבלעדיו אי אפשר לשחזר",keyShown:"העתיקו עכשיו. המפתח לא יוצג שוב.",copy:"העתקה",copied:"הועתק",keyRotate:"החלפת מפתח",keyRotateTitle:"החלפת מפתח ההצפנה",keyRotateWarn:"עותקים חדשים יוצפנו במפתח חדש. המפתחות הקודמים נשמרים, והעותקים הישנים ממשיכים להיפתח. יש לייצא גם את המפתח החדש.",keyRotateConfirm:"לאישור הקלידו ROTATE",keyRotated:"המפתח הוחלף",keyImport:"ייבוא מפתח",keyImportHint:"מפתח שיוצא מהתקנה קודמת (SWXB-KEY-1:…)",keyImported:"המפתח נוסף",keys:"{n} מפתחות",drillTitle:"בדיקת שחזור",drillSub:"הגיבוי משוחזר לתיקייה זמנית ונבדק. המסד הפעיל לא משתנה.",drillRun:"בדיקה עכשיו",drillRunTarget:"בדיקת העותק המוצפן",drillRunning:"הבדיקה רצה…",drillMonthly:"בדיקה חודשית",drillLocal:"גיבוי מקומי",drillOffbox:"עותק מחוץ למכונה",pass:"עבר",fail:"נכשל",sftpMissing:"רכיב ה־SFTP לא מותקן בגרסה הזו",err_auth_failed:"פרטי הכניסה נדחו",err_host_key_mismatch:"מפתח השרת לא תואם למפתח השמור",err_host_key_required:"יש להדביק את מפתח השרת",err_bucket_missing:"הדלי לא קיים",err_object_missing:"הקובץ לא נמצא ביעד",err_destination_unavailable:"היעד לא זמין",err_permission_denied:"אין הרשאת כתיבה ביעד",err_verify_hash_mismatch:"הקובץ שהועלה לא תואם",err_verify_plain_mismatch:"העותק לא נפתח כמו המקור",err_credential_missing:"חסרים פרטי גישה",err_secrets_missing:"חסרים פרטי גישה",err_key_unreadable:"המפתח הפרטי לא נקרא",err_key_missing:"אין מפתח הצפנה",err_key_mismatch:"העותק הוצפן במפתח שלא נמצא כאן",err_key_already_exported:"המפתח כבר יוצא. לייצוא נוסף יש להחליף מפתח.",err_key_import_invalid:"זה לא מפתח מיוצא תקין",err_archive_missing:"אין גיבוי להעלאה",err_destination_invalid:"אחד השדות לא תקין",err_push_running:"העברה אחרת רצה",err_transport_not_available:"רכיב ההעברה לא מותקן",err_offbox_fetch:"העותק לא הורד או לא נפתח",addGdrive:"הוספת Google Drive",kind_gdrive:"Google Drive",client_id:"מזהה לקוח (Client ID)",client_secret:"סוד הלקוח (Client secret)",folder_name:"שם התיקייה ב־Drive",prune_mode:"מחיקת עותקים ישנים",prune_delete:"מחיקה מיידית",prune_trash:"העברה לאשפה (נספרת במכסה 30 יום)",chunk_mib:"גודל מקטע העלאה (MiB)",quota_margin_pct:"מרווח מכסה (%)",min_free_mib:"מקום פנוי מינימלי (MiB)",gdriveSetupHint:'יש ליצור פעם אחת לקוח OAuth מסוג "TVs and Limited Input devices" בחשבון Google שלכם ולהדביק כאן את המזהה והסוד. ההרשאה מוגבלת לקבצים שהמערכת יצרה בלבד.',gdriveKeyFirst:"לפני ההפעלה יש לייצא את מפתח ההצפנה: ב־Drive נשמר רק עותק מוצפן, ובלי המפתח אי אפשר לפתוח אותו.",gdriveConnected:"חשבון Google מחובר",gdriveNotConnected:"לא חובר חשבון Google",gdriveConnect:"חיבור חשבון Google",gdriveReconnect:"חיבור מחדש",gdriveDisconnect:"ניתוק החשבון",gdriveDisconnected:"החשבון נותק והיעד כובה",gdriveCodeTitle:"חיבור חשבון Google",gdriveStep1:"בטלפון או במחשב אחר, פתחו את {url}",gdriveStep2:"הקלידו את הקוד",gdriveStep3:"התחברו לחשבון Google ואשרו גישה לתיקיית הגיבוי",gdriveWaiting:"ממתין לאישור…",gdriveDone:"החשבון חובר. אפשר להפעיל את היעד.",gdriveDenied:"האישור נדחה ב־Google. אם לא לחצתם 'ביטול' - כנראה החשבון לא נוסף כמשתמש בדיקה (ב־Google Auth Platform, במסך Audience, ברשימת Test users).",gdriveExpired:"הקוד פג. יש ללחוץ שוב על חיבור.",gdriveEnableAfter:"אפשר להפעיל אחרי חיבור החשבון",gdriveBlockedHint:"אם Google מציג 'Access blocked' או 'הגישה חסומה' - החשבון לא נוסף כמשתמש בדיקה. מוסיפים אותו ב־Google Auth Platform, במסך Audience, ברשימת Test users (Add users).",gdriveDiagnose:"בדיקת חיבור Google",gdriveDiagTitle:"בדיקת חיבור Google",gdriveDiagRunning:"בודק מול Google…",gdriveDiagFix:"מה לעשות:",gdriveDiagAgain:"בדיקה חוזרת",gdriveDiagNote:"הבדיקה לא משנה דבר: לא נוצרת תיקייה ב־Drive ולא נשמר דבר.",err_quota_exceeded:"אין מספיק מקום פנוי ב־Google Drive",err_rate_limited:"Google Drive מגביל כרגע את קצב הבקשות; ננסה שוב",err_gdrive_reconnect_required:"החיבור ל־Google Drive פג או בוטל; יש לחבר מחדש",err_gdrive_not_connected:"לא חובר חשבון Google",err_gdrive_client_invalid:"Google דחה את מזהה הלקוח או הסוד",err_gdrive_client_missing:"חסרים מזהה הלקוח או הסוד",err_gdrive_scope_refused:"Google לא אישר את ההרשאה לתיקיית הגיבוי",err_gdrive_token_via_connect:"האסימון מתקבל רק דרך חיבור החשבון",err_gdrive_client_type:"סוג הלקוח ב־Google שגוי (צריך 'TVs and Limited Input devices')",err_gdrive_client_not_found:"Google לא מכיר את מזהה הלקוח (נמחק או הועתק חלקית)",err_gdrive_consent_not_configured:"מסך ההסכמה לא הוגדר בפרויקט ב־Google Cloud",err_gdrive_api_disabled:"Google Drive API לא הופעל בפרויקט ב־Google Cloud",err_remote_error:"תשובה לא צפויה מהיעד",err_other:"שגיאה בהעברה"},W=R("en","i18n/backup-offbox","en"),V=R("ar","i18n/backup-offbox","ar"),U=R("ru","i18n/backup-offbox","ru");function X(){return ee(["en","ar","ru"])}const Me={he:E,en:W,ar:V,ru:U},je=["ar","ru"];function a(e,t,s=X()){const i=Me[s][e]??E[e]??e;return Q(i,t)}function w(e,t=X()){const s=`err_${e??""}`;return s in E?a(s,void 0,t):a("err_other",void 0,t)}function Ie(e,t,s){return e==="EXPORT"&&t&&!s}Z("i18n/backup-offbox",{he:E,en:W,ar:V,ru:U},je);var Be=Object.defineProperty,Le=Object.getOwnPropertyDescriptor,u=(e,t,s,i)=>{for(var n=i>1?void 0:i?Le(t,s):t,h=e.length-1,g;h>=0;h--)(g=e[h])&&(n=(i?g(t,s,n):g(n))||n);return i&&n&&Be(t,s,n),n};let p=class extends H{constructor(){super(...arguments),this.status=null,this.drill=null,this.form=null,this.clear=[],this.busy="",this.msg=null,this.dialog=null,this.confirm="",this.acked=!1,this.shownKey="",this.copied=!1,this.importText="",this.copies=null,this.pick="",this.prep=null,this.rAccess=!0,this.rPassword="",this.rSkip=!1,this.rErr="",this.rSafety="",this.scopeDefault="project+access",this.minChars=12,this.gCode=null,this.gState="idle",this.gErr="",this.gDiag=null,this.gDiagBusy=!1}connectedCallback(){super.connectedCallback(),this.load(),this.loadPrefs()}async loadPrefs(e=!1){try{const t=await te(e);this.scopeDefault=oe(t["backup.offbox_restore_scope"]);const s=Number(t["backup.password_min"]??12);this.minChars=Number.isFinite(s)?Math.max(8,Math.min(64,Math.round(s))):12}catch{}}async saveScopeDefault(e){const t=e?"project+access":"project",s=this.scopeDefault;this.scopeDefault=t,await this.act("scope",async()=>{try{await se({"backup.offbox_restore_scope":t}),C()}catch(i){throw this.scopeDefault=s,i}},c("saved"))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.poll),window.clearTimeout(this.gTimer)}async load(){try{[this.status,this.drill]=await Promise.all([ne(),le()])}catch(e){this.msg={ok:!1,text:y(e)}}(this.status?.running||this.drill?.running)&&(window.clearTimeout(this.poll),this.poll=window.setTimeout(()=>void this.load(),2e3))}fail(e){const t=e instanceof $?e.code:void 0;this.msg={ok:!1,text:t?w(t):y(e)}}async act(e,t,s){this.busy=e,this.msg=null;try{await t(),s&&(this.msg={ok:!0,text:s}),await this.load()}catch(i){this.fail(i)}finally{this.busy=""}}edit(e,t="s3"){this.clear=[],this.msg=null,this.form=e?{id:e.id,name:e.name,kind:e.kind,enabled:e.enabled,config:{...e.config},secrets:{},retention:{...e.retention}}:de(t)}async save(){const e=this.form;e&&await this.act("save",async()=>{const t=ce(e,this.clear);e.kind==="gdrive"&&!(e.id&&this.status?.targets.find(s=>s.id===e.id)?.secrets.refresh_token)&&(t.enabled=!1),e.id?await pe(e.id,t):await he(t),this.form=null},a("saved"))}async test(e){this.busy=`test:${e.id}`,this.msg=null;try{const t=await ge(e.id);this.msg=t.ok?{ok:!0,text:a("testOk")}:{ok:!1,text:w(t.error)},await this.load()}catch(t){this.fail(t)}finally{this.busy=""}}async dry(e){this.busy=`dry:${e.id}`,this.msg=null;try{const s=(await P(e.id,!0)).result;this.msg=s?.ok&&s.plan?{ok:!0,text:a("dryRunOk",{name:s.plan.upload.name,n:s.plan.delete.length})}:{ok:!1,text:w(s?.error)}}catch(t){this.fail(t)}finally{this.busy=""}}when(e){return e?x(new Date(e)):a("never")}runBadge(e,t){return e?r`<span class="run" data-run=${e.action}>${a(t)}
      <sw-badge kind=${e.ok?"live":"error"} label=${e.ok?e.verified?a("verified"):a("ok"):a("failed")}></sw-badge>
      <span class="muted">${this.when(e.finished_at??e.started_at)}${e.ok?"":` · ${w(e.error)}`}</span></span>`:r`<span class="muted">${a(t)} · ${a("never")}</span>`}renderTarget(e){const t=this.busy,s=e.kind==="sftp"&&this.status&&!this.status.transports.sftp,i=e.kind==="gdrive"?e.gdrive??{connected:!1,connected_at:null}:null,n=!!i&&!i.connected&&!e.enabled;return r`<div class="target" data-offbox-target=${e.id}>
      <div class="head">
        <span class="name">${e.name}<span class="muted"> · ${a(`kind_${e.kind}`)}</span></span>
        <sw-toggle controlled ?checked=${e.enabled} label=${e.enabled?a("enabled"):a("disabled")} ?disabled=${!!t||n}
          title=${n?a("gdriveEnableAfter"):d}
          @change=${h=>void this.act(`en:${e.id}`,()=>ue(e.id,h.detail.checked))}></sw-toggle>
      </div>
      ${i?r`<div class="gd" data-offbox-gdrive=${i.connected?"connected":"not-connected"}>
            <sw-badge kind=${i.connected?"live":"partial"} label=${i.connected?a("gdriveConnected"):a("gdriveNotConnected")}></sw-badge>
            ${i.connected&&i.connected_at?r`<span class="muted">${this.when(i.connected_at)}</span>`:d}
            <sw-button size="sm" variant=${i.connected?"ghost":"primary"} icon="link" ?disabled=${!!t} data-offbox-gdrive-connect
              @click=${()=>void this.openGdrive(e)}>${i.connected?a("gdriveReconnect"):a("gdriveConnect")}</sw-button>
            <sw-button size="sm" variant="ghost" icon="check" ?disabled=${!!t} data-offbox-gdrive-diagnose
              @click=${()=>void this.openDiag(e)}>${a("gdriveDiagnose")}</sw-button>
            ${i.connected?r`<sw-button size="sm" variant="ghost" ?disabled=${!!t} data-offbox-gdrive-disconnect
                  @click=${()=>void this.act(`gdoff:${e.id}`,()=>fe(e.id),a("gdriveDisconnected"))}>${a("gdriveDisconnect")}</sw-button>`:d}
          </div>
          ${this.status?.key.keys.some(h=>h.exported)?d:r`<div class="msg warn" role="note" data-offbox-gdrive-keyfirst>${a("gdriveKeyFirst")}</div>`}`:d}
      <div class="runs">${this.runBadge(e.last.push,"lastPush")}${this.runBadge(e.last.test,"lastTest")}${this.runBadge(e.last.drill,"lastDrill")}</div>
      ${s?r`<div class="msg err" role="note">${a("sftpMissing")}</div>`:d}
      <div class="actions">
        <sw-button size="sm" icon="check" ?disabled=${!!t} data-offbox-test @click=${()=>void this.test(e)}>${a("test")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!t} data-offbox-dry @click=${()=>void this.dry(e)}>${a("dryRun")}</sw-button>
        <sw-button size="sm" variant="primary" icon="upload" ?disabled=${!!t||this.status?.running} data-offbox-push
          @click=${()=>void this.act(`push:${e.id}`,()=>P(e.id),a("pushStarted"))}>${a("pushNow")}</sw-button>
        <sw-button size="sm" variant="ghost" icon="download" ?disabled=${!!t||!this.status?.key.active} data-offbox-restore-open
          @click=${()=>void this.openRestore(e)}>${c("open")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!t} data-offbox-edit @click=${()=>this.edit(e)}>${a("edit")}</sw-button>
        <sw-button size="sm" variant="ghost" icon="trash" ?disabled=${!!t} data-offbox-remove @click=${()=>{this.dialog={remove:e}}}>${a("remove")}</sw-button>
      </div>
    </div>`}setCfg(e,t){this.form&&(this.form={...this.form,config:{...this.form.config,[e]:t}})}setSecret(e,t){this.form&&(this.form={...this.form,secrets:{...this.form.secrets,[e]:t}},this.clear=this.clear.filter(s=>s!==e))}renderForm(){const e=this.form;if(!e||e.kind==="local")return d;const t=e.kind,s=e.id?this.status?.targets.find(n=>n.id===e.id)?.secrets??{}:{},i=t!=="gdrive"||!!s.refresh_token;return r`<div class="form" data-offbox-form=${t}>
      ${t==="gdrive"?r`<div class="muted" role="note" data-offbox-gdrive-hint>${a("gdriveSetupHint")}</div>`:d}
      <label class="row"><span class="lbl">${a("name")}</span><input class="ctl" data-f="name" .value=${e.name} maxlength="80"
        @input=${n=>{this.form&&(this.form={...this.form,name:n.target.value})}} /></label>
      ${ve[t].map(n=>{const h=e.config[n];if(n==="prune_mode")return r`<label class="row"><span class="lbl">${a("prune_mode")}</span><select class="ctl" data-f="prune_mode" .value=${String(h??"delete")}
            @change=${g=>this.setCfg(n,g.target.value)}>
              <option value="delete" ?selected=${h!=="trash"}>${a("prune_delete")}</option>
              <option value="trash" ?selected=${h==="trash"}>${a("prune_trash")}</option></select></label>`;if(n in z){const g=z[n];return r`<label class="row"><span class="lbl">${a(n)}</span><input class="ctl num" data-ltr data-f=${n} type="number" min=${g.min} max=${g.max}
            .value=${String(h??g.fallback)} @input=${v=>this.setCfg(n,v.target.value)} /></label>`}return n==="path_style"?r`<div class="row"><span class="lbl">${a("path_style")}</span><sw-toggle ?checked=${!!h} label=${a("path_style")} labelHidden
            @change=${g=>this.setCfg(n,g.detail.checked)}></sw-toggle></div>`:n==="host_key"?r`<label class="row stack"><span class="lbl">${a("host_key")}<span class="muted">${a("hostKeyHint")}</span></span>
            <textarea class="ctl wide" data-ltr data-f="host_key" rows="2" spellcheck="false" .value=${String(h??"")}
              @input=${g=>this.setCfg(n,g.target.value)}></textarea></label>`:r`<label class="row"><span class="lbl">${a(n)}</span><input class="ctl" data-ltr data-f=${n} type=${n==="port"?"number":"text"}
          .value=${String(h??"")} @input=${g=>this.setCfg(n,g.target.value)} /></label>`})}
      ${be[t].map(n=>{const h=!!s[n]&&!this.clear.includes(n),g=a(h?"secretSet":"secretMissing");return n==="key"?r`<label class="row stack"><span class="lbl">${a("key")}</span><textarea class="ctl wide" data-ltr data-secret=${n} rows="3" spellcheck="false" autocomplete="off"
              placeholder=${g} .value=${e.secrets[n]??""} @input=${v=>this.setSecret(n,v.target.value)}></textarea></label>`:r`<label class="row"><span class="lbl">${a(n)}</span><input class="ctl" data-ltr data-secret=${n} type="password" autocomplete="new-password"
              placeholder=${g} .value=${e.secrets[n]??""} @input=${v=>this.setSecret(n,v.target.value)} /></label>`})}
      <div class="row"><span class="lbl">${a("retention")}</span><span class="ret">
        ${["keep_last","keep_daily","keep_weekly","keep_monthly"].map(n=>r`<label><input type="number" min=${n==="keep_last"?1:0} max="1000"
          data-f=${n} .value=${String(e.retention[n])} @input=${h=>{this.form&&(this.form={...this.form,retention:{...this.form.retention,[n]:Number(h.target.value)}})}} />
          <span class="muted">${a(n)}</span></label>`)}</span></div>
      <div class="row"><span class="lbl">${a("enabled")}${i?d:r`<span class="muted">${a("gdriveEnableAfter")}</span>`}</span>
        <sw-toggle ?checked=${e.enabled&&i} label=${a("enabled")} labelHidden ?disabled=${!i}
        @change=${n=>{this.form&&(this.form={...this.form,enabled:n.detail.checked})}}></sw-toggle></div>
      <div class="foot"><sw-button variant="primary" ?disabled=${!!this.busy||!e.name.trim()} data-offbox-save @click=${()=>void this.save()}>${a("save")}</sw-button>
        <sw-button variant="ghost" @click=${()=>{this.form=null}}>${a("cancel")}</sw-button></div>
    </div>`}async doExport(){await this.act("export",async()=>{const e=await me();this.shownKey=e.key,this.confirm=""})}async copyKey(){try{await navigator.clipboard.writeText(this.shownKey),this.copied=!0}catch{this.copied=!1}}async openRestore(e){this.dialog={restore:e},this.copies=null,this.pick="",this.prep=null,this.rErr="",this.rAccess=this.scopeDefault==="project+access",this.rSafety="";try{this.copies=(await ye(e.id)).copies,this.pick=this.copies[0]?.name??""}catch(t){this.copies=[],this.rErr=t instanceof $?T(t.code):y(t)}}async doPrepare(e){if(this.pick){this.busy="prepare",this.rErr="";try{this.prep=await $e(e.id,this.pick)}catch(t){this.rErr=t instanceof $?T(t.code):y(t)}finally{this.busy=""}}}async doRestore(){const e=this.prep;if(!(!e||!G(this.confirm,!!this.busy))){this.busy="restore",this.rErr="";try{const t=await we({stage_id:e.id,confirm:this.confirm,scope:this.rAccess?"project+access":"project",...this.rPassword?{backup_password:this.rPassword}:{},...this.rSkip?{skip_sensitive:!0}:{},...ke(this.rSafety)});this.prep=null,this.rPassword="",this.rSafety="",C(),this.closeDialog(),this.msg={ok:!0,text:c("done",{name:t.object,n:Object.keys(t.tables).length,files:t.files,safety:t.safety_archive.name})},await this.load()}catch(t){this.rErr=t instanceof $?t.code.startsWith("safety_password_")?xe(t.code,t.body.details):t.body.details?.can_skip?y(t):T(t.code):y(t),this.rPassword="",this.rSafety=""}finally{this.busy=""}}}renderRestore(e){const t=this.prep,s=i=>i.stamp?this.when(i.stamp):"";return r`<sw-dialog open heading=${c("title")} subheading=${e.name} data-offbox-restore-dialog @close=${()=>this.closeDialog()}>
      ${this.rErr?r`<div class="msg err" role="alert" data-offbox-restore-err>${this.rErr}</div>`:d}
      ${t?r`<div class="msg ok" role="status">${c("verified")}</div>
            <dl class="row facts" data-offbox-restore-facts>
              <div><dt>${c("summary_version")}</dt><dd><code data-ltr>${t.app_version??"-"}</code></dd></div>
              <div><dt>${c("summary_schema")}</dt><dd><code data-ltr>${t.schema_version}</code></dd></div>
              <div><dt>${c("summary_tables")}</dt><dd class="num">${Object.keys(t.tables).length} / ${t.files}</dd></div>
              <div><dt>${c("summary_key")}</dt><dd><code data-ltr>${t.key_id}</code></dd></div>
            </dl>
            <div class="msg warn" role="note">${c("warnDestructive")}</div>
            <label class="ack"><sw-toggle size="sm" labelHidden in-label label=${c("includeAccess")} data-offbox-restore-access .checked=${this.rAccess}
              @change=${i=>{this.rAccess=D(i)}}></sw-toggle><span>${c("includeAccess")}</span></label>
            ${t.sensitive==="encrypted"?r`<label class="row"><span class="lbl">${c("password")}</span><input class="ctl" type="password" autocomplete="off" data-offbox-restore-password
                  .value=${this.rPassword} ?disabled=${this.rSkip} @input=${i=>{this.rPassword=i.target.value}} /></label>
                <label class="ack"><sw-toggle size="sm" labelHidden in-label label=${c("skipSensitive")} data-offbox-restore-skip .checked=${this.rSkip}
                  @change=${i=>{this.rSkip=D(i)}}></sw-toggle><span>${c("skipSensitive")}</span></label>`:d}
            <label class="row" data-offbox-restore-safety-row><span class="lbl">${c("safetyPassword")}<span class="muted">${c("safetyHint")}</span></span>
              <input class="ctl" type="password" autocomplete="new-password" data-offbox-restore-safety placeholder=${c("safetyPlaceholder",{n:this.minChars})}
                .value=${this.rSafety} @input=${i=>{this.rSafety=i.target.value}} /></label>
            <div class="muted">${c("confirmHint")}</div>
            <input class="confirm-in" data-ltr data-offbox-restore-confirm placeholder="RESTORE" .value=${this.confirm}
              @input=${i=>{this.confirm=i.target.value}} />`:this.copies===null?r`<div class="muted">${c("loading")}</div>`:this.copies.length===0?r`<div class="muted" data-offbox-restore-none>${c("none")}</div>`:r`<div class="muted">${c("pick")}</div>
              ${this.copies.slice(0,5).map((i,n)=>r`<label class="ack" data-offbox-copy=${i.name}><input type="radio" name="offbox-copy" .checked=${this.pick===i.name}
                  @change=${()=>{this.pick=i.name}} /><span><code data-ltr>${i.name}</code><span class="muted"> · ${_(i.bytes)}${s(i)?` · ${s(i)}`:""}${n===0?` · ${c("newest")}`:""}</span></span></label>`)}`}
      <div slot="footer">
        ${t?r`<sw-button variant="danger" icon="download" ?disabled=${!G(this.confirm,!!this.busy)} data-offbox-restore-go
              @click=${()=>void this.doRestore()}>${this.busy==="restore"?c("restoring"):c("restore")}</sw-button>`:r`<sw-button variant="primary" icon="download" ?disabled=${!this.pick||!!this.busy} data-offbox-prepare
              @click=${()=>void this.doPrepare(e)}>${this.busy==="prepare"?c("preparing"):c("prepare")}</sw-button>`}
        <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${c("cancel")}</sw-button>
      </div>
    </sw-dialog>`}async openGdrive(e){window.clearTimeout(this.gTimer),this.dialog={gdrive:e},this.gCode=null,this.gErr="",this.gState="idle";try{this.gCode=await _e(e.id),this.gState="waiting",this.schedulePoll(e,this.gCode.interval)}catch(t){this.gErr=t instanceof $?w(t.code):y(t)}}schedulePoll(e,t){window.clearTimeout(this.gTimer),this.gTimer=window.setTimeout(()=>void this.pollGdrive(e),Ee(t))}async pollGdrive(e){const t=this.dialog;if(!(!t||typeof t!="object"||!("gdrive"in t)||t.gdrive.id!==e.id))try{const s=await De(e.id);if(Se(s.state)){this.schedulePoll(e,s.interval??this.gCode?.interval);return}this.gState=s.state==="connected"?"connected":s.state==="denied"?"denied":"expired",s.state==="connected"&&await this.load()}catch(s){this.gState="idle",this.gErr=s instanceof $?w(s.code):y(s)}}renderGdrive(e){const t=this.gCode,s=this.gState,i=t&&Te(t.verification_url)?t.verification_url:"https://www.google.com/device";return r`<sw-dialog open heading=${a("gdriveCodeTitle")} subheading=${e.name} data-offbox-gdrive-dialog @close=${()=>this.closeDialog()}>
      ${this.gErr?r`<div class="msg err" role="alert" data-offbox-gdrive-err>${this.gErr}</div>`:d}
      ${s==="connected"?r`<div class="msg ok" role="status" data-offbox-gdrive-done>${a("gdriveDone")}</div>`:s==="denied"||s==="expired"?r`<div class="msg err" role="alert" data-offbox-gdrive-end=${s}>${a(s==="denied"?"gdriveDenied":"gdriveExpired")}</div>`:t?r`<ol class="steps" data-offbox-gdrive-steps>
                <li>${a("gdriveStep1",{url:""})}<a data-ltr href=${i} target="_blank" rel="noopener noreferrer">${i.replace("https://","")}</a></li>
                <li>${a("gdriveStep2")}<div class="code" data-ltr data-offbox-gdrive-code aria-live="polite">${t.user_code}</div></li>
                <li>${a("gdriveStep3")}</li></ol>
              <div class="muted" role="status">${a("gdriveWaiting")}</div>
              <div class="muted" role="note" data-offbox-gdrive-blocked>${a("gdriveBlockedHint")}</div>`:this.gErr?d:r`<div class="muted">…</div>`}
      <div slot="footer">
        ${s==="denied"||s==="expired"?r`<sw-button variant="primary" icon="link" data-offbox-gdrive-retry @click=${()=>void this.openGdrive(e)}>${a("gdriveConnect")}</sw-button>`:d}
        <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${a(s==="connected"?"ok":"cancel")}</sw-button>
      </div>
    </sw-dialog>`}async openDiag(e){this.dialog={gdiag:e},this.gDiag=null,this.gErr="",this.gDiagBusy=!0;try{this.gDiag=await Re(e.id)}catch(t){this.gErr=t instanceof $?w(t.code):y(t)}finally{this.gDiagBusy=!1}}renderDiag(e){const t=this.gDiag;return r`<sw-dialog open heading=${a("gdriveDiagTitle")} subheading=${e.name} data-offbox-gdrive-diag @close=${()=>this.closeDialog()}>
      ${this.gErr?r`<div class="msg err" role="alert">${this.gErr}</div>`:d}
      ${this.gDiagBusy?r`<div class="muted" role="status">${a("gdriveDiagRunning")}</div>`:d}
      ${t?r`<div class="msg ${t.ok?"ok":"err"}" role=${t.ok?"status":"alert"} data-offbox-gdrive-diag-summary=${t.ok?"ok":"fail"}>${t.summary}</div>
            <ul class="diag" data-offbox-gdrive-diag-list>
              ${t.checks.map(s=>r`<li data-check=${s.id} data-status=${s.status}>
                <span class="dh"><sw-badge kind=${Ce(s.status)} label=${s.title}></sw-badge></span>
                <span>${s.message}</span>
                ${s.fix&&s.status!=="ok"?r`<span class="muted fix"><b>${a("gdriveDiagFix")}</b> ${s.fix}</span>`:d}
              </li>`)}
            </ul>
            <div class="muted">${a("gdriveDiagNote")}</div>`:d}
      <div slot="footer">
        <sw-button variant="primary" icon="check" ?disabled=${this.gDiagBusy} data-offbox-gdrive-diag-again @click=${()=>void this.openDiag(e)}>${a("gdriveDiagAgain")}</sw-button>
        <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${a("ok")}</sw-button>
      </div>
    </sw-dialog>`}closeDialog(){this.gDiag=null,this.gDiagBusy=!1,window.clearTimeout(this.gTimer),this.gCode=null,this.gErr="",this.gState="idle",this.prep&&Ae(this.prep.id).catch(()=>{}),this.prep=null,this.copies=null,this.pick="",this.rErr="",this.rPassword="",this.rSafety="",this.rSkip=!1,this.dialog=null,this.confirm="",this.acked=!1,this.shownKey="",this.copied=!1}renderDialog(){const e=this.dialog;if(!e)return d;if(typeof e=="object"&&"restore"in e)return this.renderRestore(e.restore);if(typeof e=="object"&&"gdrive"in e)return this.renderGdrive(e.gdrive);if(typeof e=="object"&&"gdiag"in e)return this.renderDiag(e.gdiag);if(typeof e=="object")return r`<sw-dialog open heading=${a("remove")} subheading=${e.remove.name} data-offbox-remove-dialog @close=${()=>this.closeDialog()}>
        <div class="muted">${a("removeConfirm")}</div>
        <div slot="footer"><sw-button variant="danger" icon="trash" ?disabled=${!!this.busy} data-offbox-remove-go
          @click=${()=>void this.act("remove",async()=>{await Pe(e.remove.id),this.closeDialog()})}>${a("remove")}</sw-button>
          <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${a("cancel")}</sw-button></div>
      </sw-dialog>`;const t=e==="export",s=t?"EXPORT":"ROTATE";return r`<sw-dialog open heading=${a(t?"keyExportTitle":"keyRotateTitle")} data-offbox-key-dialog=${e} @close=${()=>this.closeDialog()}>
      ${this.shownKey?r`<div class="msg ok" role="status">${a("keyShown")}</div>
            <textarea class="keybox" data-ltr readonly rows="3" data-offbox-key-text .value=${this.shownKey}></textarea>`:r`<div class="msg warn" role="note">${a(t?"keyExportWarn":"keyRotateWarn")}</div>
            ${t?r`<ul class="keyfacts" data-offbox-key-facts>
                  <li>${a("keyExportWhat")}</li><li>${a("keyExportNoRestore")}</li><li>${a("keyExportLost")}</li><li>${a("keyExportStore")}</li></ul>
                <label class="ack"><sw-toggle size="sm" labelHidden in-label label=${a("keyExportAck")} data-offbox-ack .checked=${this.acked}
                  @change=${i=>{this.acked=D(i)}}></sw-toggle><span>${a("keyExportAck")}</span></label>`:d}
            <div class="muted">${a(t?"keyExportConfirm":"keyRotateConfirm")}</div>
            <input class="confirm-in" data-ltr data-offbox-confirm placeholder=${s} .value=${this.confirm} @input=${i=>{this.confirm=i.target.value}} />`}
      <div slot="footer">
        ${this.shownKey?r`<sw-button variant="primary" icon="copy" data-offbox-copy @click=${()=>void this.copyKey()}>${this.copied?a("copied"):a("copy")}</sw-button>`:r`<sw-button variant=${t?"primary":"danger"} ?disabled=${t?!Ie(this.confirm,this.acked,!!this.busy):this.confirm!==s||!!this.busy} data-offbox-key-go
              @click=${()=>void(t?this.doExport():this.act("rotate",async()=>{await ze(),this.closeDialog()},a("keyRotated")))}>${a(t?"keyExport":"keyRotate")}</sw-button>`}
        <sw-button variant="ghost" @click=${()=>this.closeDialog()}>${a("cancel")}</sw-button>
      </div>
    </sw-dialog>`}renderKey(){const e=this.status?.key,t=e?.keys.find(s=>s.active);return r`<sw-card heading=${a("keyTitle")} subheading=${a("keySub")} data-offbox-key>
      <div class="row"><span class="lbl">${a("keyActive")}${e&&e.keys.length>1?r`<span class="muted">${a("keys",{n:e.keys.length})}</span>`:d}</span>
        <span class="end">${t?r`<code data-ltr>${t.id}</code> <sw-badge kind=${t.exported?"live":"partial"} label=${t.exported?a("keyExported"):a("keyNotExported")}></sw-badge>`:r`<span class="muted">${a("keyNone")}</span>`}</span></div>
      <div class="actions">
        <sw-button size="sm" icon="lock" ?disabled=${!!this.busy||!!t?.exported} data-offbox-export @click=${()=>{this.dialog="export"}}>${a("keyExport")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${!!this.busy||!t} data-offbox-rotate @click=${()=>{this.dialog="rotate"}}>${a("keyRotate")}</sw-button>
      </div>
      <div class="row"><span class="lbl">${a("keyImport")}<span class="muted">${a("keyImportHint")}</span></span>
        <span class="end"><input class="ctl" data-ltr type="password" autocomplete="off" data-offbox-import .value=${this.importText}
          @input=${s=>{this.importText=s.target.value}} />
          <sw-button size="sm" ?disabled=${!this.importText.trim()||!!this.busy} data-offbox-import-go
            @click=${()=>void this.act("import",async()=>{await Ge(this.importText),this.importText=""},a("keyImported"))}>${a("keyImport")}</sw-button></span></div>
    </sw-card>`}renderDrill(){const e=this.drill,t=(this.status?.targets??[]).filter(i=>i.enabled),s=i=>i?r`<sw-badge kind=${i.result==="PASS"?"live":"error"} label=${i.result==="PASS"?a("pass"):a("fail")}></sw-badge> <span class="muted">${this.when(i.finished_at)}</span>`:r`<span class="muted">${a("never")}</span>`;return r`<sw-card heading=${a("drillTitle")} subheading=${a("drillSub")} data-offbox-drill>
      <div class="row"><span class="lbl">${a("drillLocal")}</span><span class="end">${s(e?.last??null)}
        <sw-button size="sm" ?disabled=${!!e?.running||!!this.busy} data-drill-run @click=${()=>void this.act("drill",()=>O())}>${e?.running?a("drillRunning"):a("drillRun")}</sw-button></span></div>
      ${t.length?r`<div class="row"><span class="lbl">${a("drillOffbox")}</span><span class="end">${s(e?.last_offbox??null)}
            ${t.map(i=>r`<sw-button size="sm" variant="ghost" ?disabled=${!!e?.running||!!this.busy} data-drill-run-target=${i.id}
              @click=${()=>void this.act("drill",()=>O(i.id))}>${t.length>1?`${a("drillRunTarget")} · ${i.name}`:a("drillRunTarget")}</sw-button>`)}</span></div>`:d}
      <div class="row"><span class="lbl">${a("drillMonthly")}</span><sw-toggle controlled ?checked=${!!e?.schedule.monthly} label=${a("drillMonthly")} labelHidden data-drill-monthly
        @change=${i=>void this.act("monthly",()=>Oe(i.detail.checked))}></sw-toggle></div>
    </sw-card>`}render(){const e=this.status;return r`
      <sw-card heading=${a("cardTitle")} subheading=${a("cardSub")} data-offbox>
        ${e===null?r`<div class="muted">…</div>`:e.targets.length?e.targets.map(t=>this.renderTarget(t)):r`<div class="muted" data-offbox-empty>${a("empty")}</div>`}
        ${this.form?this.renderForm():r`<div class="actions">
          <sw-button size="sm" icon="plus" data-offbox-add="s3" @click=${()=>this.edit(void 0,"s3")}>${a("addS3")}</sw-button>
          <sw-button size="sm" icon="plus" data-offbox-add="sftp" @click=${()=>this.edit(void 0,"sftp")}>${a("addSftp")}</sw-button>
          <sw-button size="sm" icon="plus" data-offbox-add="gdrive" @click=${()=>this.edit(void 0,"gdrive")}>${a("addGdrive")}</sw-button></div>`}
        <div class="row" data-offbox-scope-default><span class="lbl">${c("scopeDefault")}<span class="muted">${c("scopeDefaultHint")}</span></span>
          <sw-toggle ?checked=${this.scopeDefault==="project+access"} label=${c("scopeDefault")} labelHidden ?disabled=${!!this.busy} data-offbox-scope-toggle
            @change=${t=>void this.saveScopeDefault(t.detail.checked)}></sw-toggle></div>
        ${this.msg?r`<div class="msg ${this.msg.ok?"ok":"err"}" role=${this.msg.ok?"status":"alert"} data-offbox-msg>${this.msg.text}</div>`:d}
      </sw-card>
      ${this.renderKey()}
      ${this.renderDrill()}
      ${this.renderDialog()}`}};p.styles=[q,L`
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
  `];u([l()],p.prototype,"status",2);u([l()],p.prototype,"drill",2);u([l()],p.prototype,"form",2);u([l()],p.prototype,"clear",2);u([l()],p.prototype,"busy",2);u([l()],p.prototype,"msg",2);u([l()],p.prototype,"dialog",2);u([l()],p.prototype,"confirm",2);u([l()],p.prototype,"acked",2);u([l()],p.prototype,"shownKey",2);u([l()],p.prototype,"copied",2);u([l()],p.prototype,"importText",2);u([l()],p.prototype,"copies",2);u([l()],p.prototype,"pick",2);u([l()],p.prototype,"prep",2);u([l()],p.prototype,"rAccess",2);u([l()],p.prototype,"rPassword",2);u([l()],p.prototype,"rSkip",2);u([l()],p.prototype,"rErr",2);u([l()],p.prototype,"rSafety",2);u([l()],p.prototype,"scopeDefault",2);u([l()],p.prototype,"minChars",2);u([l()],p.prototype,"gCode",2);u([l()],p.prototype,"gState",2);u([l()],p.prototype,"gErr",2);u([l()],p.prototype,"gDiag",2);u([l()],p.prototype,"gDiagBusy",2);p=u([K("sw-offbox-backup")],p);const Y=["update","create","manual","keep","same","skip","info"],He=["create","update"],J={"Content-Type":"application/octet-stream"},Ke=()=>ae("migration/legacy"),Fe=e=>F("migration/legacy/dry-run",{method:"POST",body:e,headers:J}),qe=(e,t,s)=>F("migration/legacy/apply"+ie({plan_digest:t,confirm:s}),{method:"POST",body:e,headers:J}),M=e=>He.reduce((t,s)=>t+(e.summary[s]??0),0);function We(e){const t=new Map;for(const s of e)t.has(s.area)||t.set(s.area,t.size);return e.map((s,i)=>({it:s,i})).sort((s,i)=>t.get(s.it.area)-t.get(i.it.area)||s.i-i.i).map(s=>s.it)}function Ve(e,t,s){const i=We(e),n=Math.max(1,Math.ceil(i.length/s)),h=Math.min(Math.max(1,t),n),g=new Map;for(const k of i)g.set(k.area,(g.get(k.area)??0)+1);const v=[];let b="";for(const k of i.slice((h-1)*s,h*s))k.area!==b&&(b=k.area,v.push({kind:"head",id:`head:${b}`,area:b,count:g.get(b)??0})),v.push({kind:"item",...k});return{rows:v,pages:n,page:h}}var Ue=Object.defineProperty,Xe=Object.getOwnPropertyDescriptor,m=(e,t,s,i)=>{for(var n=i>1?void 0:i?Xe(t,s):t,h=e.length-1,g;h>=0;h--)(g=e[h])&&(n=(i?g(t,s,n):g(n))||n);return i&&n&&Ue(t,s,n),n};const Ye=8,Je=5,Ze=3,j={update:o("יועתק"),create:o("ייווצר"),manual:o("לטיפול ידני"),keep:o("נשמר כמו שהוא"),same:o("כבר זהה"),skip:o("לא מועבר"),info:o("לידיעה")},I={update:"historic",create:"historic",manual:"partial",keep:"neutral",same:"neutral",skip:"unknown",info:"neutral"},Qe={cameras:o("מצלמות"),connection:o("חיבור ה־NVR"),options:o("אפשרויות התוסף"),people:o("אנשים והרשאות"),time:o("זמן ההקלטות"),manual_recording:o("הקלטות ידניות"),events:o("יומן האירועים"),layouts:o("פריסות"),schedules:o("לוחות זמנים"),notifications:o("התראות"),override:o("קובץ ההתאמות")},et={"connection.host":o("כתובת ה־NVR"),"connection.http_port":o("פורט HTTP"),"connection.rtsp_port":o("פורט RTSP"),"connection.user":o("משתמש NVR"),"connection.password":o("סיסמת NVR"),"people.app_pin":o("PIN של היישום"),"people.technician_pin":o("PIN טכנאי"),"time.display_offset":o("הסטת השעה בהקלטות"),"layouts.live_grid":o("פריסת הצפייה החיה"),"schedules.recording":o("לוחות זמנים להקלטה"),"notifications.all":o("התראות")},tt={json:o("קובץ JSON"),jsonl:o("יומן אירועים (JSON lines)"),zip:o("ארכיון ZIP"),tar:o("ארכיון TAR"),ha_backup:o("גיבוי מלא של מערכת הבית"),export:o("ייצוא של כלי ההעברה")},st={options:o("אפשרויות התוסף"),override:o("קובץ ההתאמות"),events:o("יומן האירועים"),addon_meta:o("פרטי התוסף")},B=e=>Y.includes(e),at=e=>e.slice(0,12);let f=class extends H{constructor(){super(...arguments),this.status=null,this.absent=!1,this.loadErr="",this.file=null,this.report=null,this.busy="",this.err="",this.stale=!1,this.page=1,this.dialog=!1,this.confirm="",this.dialogErr="",this.result=null,this.phone=typeof matchMedia=="function"&&matchMedia(A).matches,this.phoneMq=null,this.onPhoneMq=e=>{this.phone=e.matches}}updated(e){e.has("result")&&this.result&&S(this.result.already_applied?o("הקובץ הזה כבר יובא: לא השתנה דבר ולא נכתב גיבוי."):o("הייבוא הסתיים: הועתקו {n} כינויים, {m} נשארו כמו שהם.",{n:this.result.applied,m:this.result.unchanged})),e.has("err")&&this.err&&S(this.err,"assertive"),e.has("dialogErr")&&this.dialogErr&&S(this.dialogErr,"assertive")}connectedCallback(){super.connectedCallback(),typeof matchMedia=="function"&&(this.phoneMq=matchMedia(A),this.phoneMq.addEventListener("change",this.onPhoneMq)),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.phoneMq?.removeEventListener("change",this.onPhoneMq)}async load(){this.loadErr="";try{this.status=await Ke()}catch(e){e instanceof $&&(e.status===403||e.status===404)?this.absent=!0:this.loadErr=y(e)}}pickFile(){this.renderRoot.querySelector("input[data-legacy-file]")?.click()}async onFile(e){e&&(this.file=e,this.result=null,await this.check())}async check(){if(!(!this.file||this.busy)){this.busy="check",this.err="",this.report=null,this.stale=!1,this.page=1;try{this.report=await Fe(this.file)}catch(e){this.err=y(e)}finally{this.busy=""}}}reset(){this.file=null,this.report=null,this.result=null,this.err="",this.stale=!1,this.page=1}openApply(){this.confirm="",this.dialogErr="",this.dialog=!0}async apply(){const e=this.report;if(!(!e||!this.file||this.busy||!N("legacy_import_apply",this.confirm))){this.busy="apply",this.dialogErr="";try{const t=await qe(this.file,e.plan_digest,this.confirm);this.result=t,this.dialog=!1,this.report=null,this.file=null,t.backup&&this.dispatchEvent(new CustomEvent("backups-changed",{bubbles:!0,composed:!0})),this.load()}catch(t){t instanceof $&&t.status===409&&t.code==="legacy_plan_changed"?(this.dialog=!1,this.stale=!0,this.err=y(t)):this.dialogErr=y(t)}finally{this.busy="",this.confirm="",this.updateComplete.then(()=>re(this.renderRoot.querySelector("[data-legacy-result], [data-legacy-error], [data-legacy-dialog-error]")))}}}subject(e){const t=e.target?.channel;if((e.area==="cameras"||e.area==="manual_recording")&&t!==void 0&&t!==null){const s=o("ערוץ {ch}",{ch:String(t)});return e.value?`${s} · ${e.value}`:s}return e.area==="events"?o("{n} רשומות",{n:Number(e.target?.rows??0)}):et[e.id]??e.value??e.id.slice(e.area.length+1)}columns(){const e=t=>t;return[{key:"subject",label:o("פריט"),width:"30%",card:"title",kind:"truncate",cellTitle:t=>this.subject(e(t)),render:t=>r`<bdi>${this.subject(e(t))}</bdi>`},{key:"action",label:o("פעולה"),width:"9rem",card:"badge",kind:"status",render:t=>{const s=e(t).action;return r`<sw-badge kind=${B(s)?I[s]:"neutral"} label=${B(s)?j[s]:s}></sw-badge>`}},{key:"note",label:o("הסבר"),card:"show",render:t=>r`<span style="white-space:normal">${e(t).note}</span>`}]}renderPick(){const e=this.status?_(this.status.max_bytes):"…";return r`<div class="row" data-legacy-pick><span class="lbl">${o("קובץ מהמערכת הישנה")}<span class="muted">${o("גיבוי מלא של מערכת הבית (לא מוצפן), ZIP / TAR של קבצי התוסף, או הייצוא שלו · עד {max} · הקובץ לא נשמר",{max:e})}</span></span>
      <span class="end"><input type="file" hidden data-legacy-file accept=".json,.jsonl,.zip,.tar,.tgz,.gz,application/json,application/zip,application/x-tar,application/gzip"
        @change=${t=>{const s=t.target;this.onFile(s.files?.[0]),s.value=""}} />
        <sw-button size="sm" icon="upload" ?disabled=${!!this.busy||!this.status} data-legacy-choose @click=${()=>this.pickFile()}>${this.busy==="check"?o("בודק…"):this.file?o("קובץ אחר…"):o("בחר קובץ…")}</sw-button></span></div>
      <div class="hint">${o("קודם רק בדיקה: מוצג מה ייווצר, ישתנה, יישמר או יידרש ממך. שום דבר לא משתנה עד האישור.")}</div>`}renderSource(e){const t=e.source,s=t.found.map(i=>st[i]??i).join(" · ");return r`<div class="src" data-legacy-source>
      <span class="name"><bdi>${this.file?.name??""}</bdi></span>
      <span class="muted">${tt[t.container]??t.container} · ${_(t.bytes)} · ${o("גרסה {v}",{v:t.legacy_version??"?"})}${s?r` · ${o("נמצאו: {found}",{found:s})}`:d}</span>
    </div>`}renderSummary(e){const t=Y.filter(s=>(e.summary[s]??0)>0);return r`<div class="sum" data-legacy-summary>${t.map(s=>r`<sw-badge data-legacy-count=${s} kind=${I[s]} label=${`${j[s]} · ${e.summary[s]}`}></sw-badge>`)}</div>`}renderTable(e){const t=this.phone?Je:Ye,{rows:s,pages:i,page:n}=Ve(e.items,this.page,t),h=v=>{const b=v;return b.kind==="head"?`${Qe[b.area]??b.area} · ${b.count}`:null},g=v=>{const b=v;return b.kind==="head"?{"data-legacy-group":b.area}:{"data-legacy-item":b.id,"data-action":b.action}};return r`<sw-table bare static-rows data-legacy-items .columns=${this.columns()} .rows=${s} rowKey="id"
        .groupHeading=${h} .rowAttrs=${g} emptyText=${o("בקובץ אין פריטים של המערכת הישנה")}></sw-table>
      ${i>1?r`<div class="pager"><sw-pager data-legacy-pager .page=${n} .pages=${i} @page-change=${v=>this.page=v.detail.page}></sw-pager></div>`:d}`}renderReport(e){const t=M(e),s=e.applied_before[0];return r`${this.renderSource(e)}
      ${this.renderSummary(e)}
      ${e.warnings.map(i=>r`<div class="msg warn" role="note" data-legacy-warning=${i.code}><sw-icon name="warning" size=${13}></sw-icon>${i.note}</div>`)}
      ${s?r`<div class="msg ok" role="note" data-legacy-applied-before><sw-icon name="history" size=${13}></sw-icon>${o("הקובץ הזה כבר יובא ב־{when}. ייבוא חוזר לא ישנה דבר שכבר הועתק.",{when:x(new Date(s.at))})}</div>`:d}
      ${this.renderTable(e)}
      <div class="foot">
        <sw-button variant="primary" icon="upload" ?disabled=${!!this.busy||this.stale||t===0} data-legacy-apply-open @click=${()=>this.openApply()}>${o("ייבוא…")}</sw-button>
        <sw-button variant="ghost" icon="refresh" ?disabled=${!!this.busy} data-legacy-recheck @click=${()=>void this.check()}>${o("לבדוק שוב")}</sw-button>
        <sw-button variant="ghost" ?disabled=${!!this.busy} data-legacy-clear @click=${()=>this.reset()}>${o("ביטול")}</sw-button>
        <span class="muted" data-legacy-writes>${t===0?o("אין מה לייבא: כל מה שאפשר להעתיק כבר נמצא ב־Arx."):o("ישתנו {n} כינויי מצלמות ריקים. ב־NVR, במערכת הבית וב־go2rtc לא ישתנה דבר.",{n:t})}</span>
      </div>`}renderResult(e){const t=e.cameras.map(s=>s.channel).join(", ");return r`<div class="msg ok" data-legacy-result>
        <sw-icon name="check" size=${13}></sw-icon>${e.already_applied?o("הקובץ הזה כבר יובא: לא השתנה דבר ולא נכתב גיבוי."):o("הייבוא הסתיים: הועתקו {n} כינויים, {m} נשארו כמו שהם.",{n:e.applied,m:e.unchanged})}
      </div>
      <dl class="facts" data-legacy-result-facts>
        <div><dt>${o("גיבוי לפני השינוי")}</dt><dd data-legacy-result-backup>${e.backup?r`<span class="ltr block">${e.backup.name}</span><span class="muted size">${_(e.backup.bytes)}</span>`:o("לא נדרש")}</dd></div>
        ${t?r`<div><dt>${o("ערוצים שעודכנו")}</dt><dd class="num"><span class="ltr" data-legacy-result-channels>${t}</span></dd></div>`:d}
        <div><dt>${o("נרשם")}</dt><dd>${x(new Date(e.run.at))}${e.run.by?r` · <bdi>${e.run.by}</bdi>`:d}</dd></div>
        <div><dt>${o("טביעת הקובץ")}</dt><dd><code class="ltr">${at(e.run.sha256)}</code></dd></div>
      </dl>
      <div class="hint">${o("הפעולה נרשמה ביומן הפעולות. אפשר לחזור למצב הקודם בשחזור הגיבוי שלמעלה.")}</div>
      <div class="foot"><sw-button size="sm" data-legacy-done @click=${()=>this.reset()}>${o("סיום")}</sw-button></div>`}renderRuns(e){return!e.runs.length||this.report?d:r`<div class="runs" data-legacy-runs>
      <div class="grouplabel">${o("ייבואים קודמים")}</div>
      ${e.runs.slice(0,Ze).map(t=>r`<div class="run" data-legacy-run>
        <span>${x(new Date(t.at))}${t.by?r` · <bdi>${t.by}</bdi>`:d}</span>
        <span class="muted">${o("הועתקו {n} · ללא שינוי {m}",{n:t.applied,m:t.unchanged})}${t.backup?r` · <bdi class="ltr">${t.backup}</bdi>`:d}</span>
      </div>`)}
    </div>`}renderDialog(e){const t=Ne("legacy_import_apply"),s=N("legacy_import_apply",this.confirm)!==null,i=`⁨${this.status?.backup_kind??"auto-pre-legacy-import"}⁩`;return r`<sw-dialog open heading=${o("ייבוא מהמערכת הישנה")} subheading=${this.file?.name??""} data-legacy-dialog @close=${()=>{this.busy!=="apply"&&(this.dialog=!1)}}>
      <div class="msg ok" role="note" data-legacy-dialog-backup><sw-icon name="history" size=${13}></sw-icon>${o("לפני כל שינוי ייכתב גיבוי של הפרויקט ({kind}). אם הגיבוי לא נכתב - שום דבר לא משתנה.",{kind:i})}</div>
      <div class="muted" data-legacy-dialog-what>${o("ישתנו ב־Arx {n} כינויי מצלמות שריקים היום. כינוי קיים לא נדרס. ב־NVR, במערכת הבית וב־go2rtc לא ישתנה דבר.",{n:M(e)})}</div>
      ${this.dialogErr?r`<div class="msg err" data-legacy-dialog-error><sw-icon name="warning" size=${13}></sw-icon>${this.dialogErr}</div>`:d}
      <label class="muted cw" for="legacy-confirm">${o("לאישור הקלידו")} <b class="word" data-legacy-word>${t}</b></label>
      <input id="legacy-confirm" class="confirm-in" dir="auto" autocomplete="off" data-legacy-confirm placeholder=${t} .value=${this.confirm}
        @input=${n=>this.confirm=n.target.value} @keydown=${n=>{n.key==="Enter"&&s&&this.apply()}} />
      <div slot="footer"><sw-button variant="primary" icon="upload" ?disabled=${!s||!!this.busy} data-legacy-apply @click=${()=>void this.apply()}>${this.busy==="apply"?o("מייבא…"):o("ייבא עכשיו")}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.busy==="apply"} @click=${()=>this.dialog=!1}>${o("ביטול")}</sw-button></div>
    </sw-dialog>`}render(){if(this.absent)return d;const e=this.status;return r`<sw-card heading=${o("ייבוא מהמערכת הישנה")} subheading=${o("מהתוסף הקודם (גרסה {v}) · מנהלי מערכת בלבד",{v:e?.legacy_version??"1.5.27"})} data-legacy-import>
      ${this.loadErr?r`<sw-state-panel compact state="error" heading=${o("מצב הייבוא לא נטען")} hint=${this.loadErr} actionLabel=${o("נסו שוב")} @action=${()=>void this.load()}></sw-state-panel>`:e?r`${this.result?this.renderResult(this.result):this.renderPick()}
              ${this.err?r`<div class="msg err" data-legacy-error><sw-icon name="warning" size=${13}></sw-icon><span>${this.err}</span>
                ${this.stale?r`<sw-button size="sm" icon="refresh" data-legacy-rerun @click=${()=>void this.check()}>${o("להריץ את הבדיקה שוב")}</sw-button>`:d}</div>`:d}
              ${this.busy==="check"?r`<sw-state-panel compact state="loading" data-legacy-checking></sw-state-panel>`:d}
              ${this.report&&!this.result?this.renderReport(this.report):d}
              ${this.renderRuns(e)}`:r`<sw-state-panel compact state="loading"></sw-state-panel>`}
    </sw-card>
    ${this.dialog&&this.report?this.renderDialog(this.report):d}`}};f.styles=[q,L`
    :host { display: block; }
    .end { display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--sw-s-2); }
    .src { display: grid; gap: var(--sw-s-1); padding-block: var(--sw-s-2); }
    .src .name { font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); overflow-wrap: anywhere; }
    .sum { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); padding-block-end: var(--sw-s-2); }
    .pager { display: flex; justify-content: flex-end; padding-block-start: var(--sw-s-2); }
    .foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sw-s-2); }
    .runs { display: grid; gap: var(--sw-s-1); padding-block-start: var(--sw-s-3); }
    .run { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--sw-s-1) var(--sw-s-3); font-size: var(--sw-fs-sm); }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: var(--sw-s-2) var(--sw-s-4); margin: 0; padding-block: var(--sw-s-2); }
    .facts dt { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .facts dd { margin: 0; font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); overflow-wrap: anywhere; }
    .facts .num { font-variant-numeric: tabular-nums; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .facts .block { display: block; text-align: end; }
    .facts .size { display: block; font-weight: var(--sw-fw-regular, normal); font-size: var(--sw-fs-sm); }
    .word { color: var(--sw-heading, var(--sw-text)); unicode-bidi: isolate; }
    code { font-family: var(--sw-font-mono, monospace); }
    .cw { display: block; margin-block-start: var(--sw-s-3); }
    .confirm-in { inline-size: 100%; box-sizing: border-box; font: inherit; margin-block-start: var(--sw-s-2); padding: var(--sw-s-2) var(--sw-s-3);
      border: thin solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); }
    .confirm-in:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 0; border-color: var(--sw-accent); }
    @media (pointer: coarse) {
      .confirm-in { min-block-size: var(--sw-ctl-h-lg); }
    }
  `];m([l()],f.prototype,"status",2);m([l()],f.prototype,"absent",2);m([l()],f.prototype,"loadErr",2);m([l()],f.prototype,"file",2);m([l()],f.prototype,"report",2);m([l()],f.prototype,"busy",2);m([l()],f.prototype,"err",2);m([l()],f.prototype,"stale",2);m([l()],f.prototype,"page",2);m([l()],f.prototype,"dialog",2);m([l()],f.prototype,"confirm",2);m([l()],f.prototype,"dialogErr",2);m([l()],f.prototype,"result",2);m([l()],f.prototype,"phone",2);f=m([K("sw-legacy-import")],f);
