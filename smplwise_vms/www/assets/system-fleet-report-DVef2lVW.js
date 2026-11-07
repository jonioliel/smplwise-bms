import{b8 as D,g,bc as T,a as F,S as E,j as w,qg as C,e as i,A as m,g9 as O,C as H,E as R,G as c,H as W}from"./index-B6b85WR9.js";import"./sw-logo-art-Va6y_cIM.js";const h="fleet/report",p={status:()=>g(h),setEnabled:e=>T(h,{enabled:e}),setSilentAfter:e=>T(h,{silent_after_h:e}),log:()=>g(`${h}/log`),preview:()=>g(`${h}/preview`),enrollment:()=>g(`${h}/enrollment`),send:()=>D(`${h}/send`)},j={tab:"דיווח בריאות",title:"דיווח בריאות",sub:"פעם ביום המערכת שולחת ל-SmplWise דוח קצר על מצבה, כדי שתקלה תטופל לפני שהלקוח מרגיש בה.",keywords:"דיווח בריאות דוח יומי smplwise fleet צי התקנות מוכנות הדגמה נתוני דוגמה קוד רישום חתימה שקט",loading:"טוען את הגדרות הדיווח…",errorTitle:"הגדרות הדיווח לא נטענו",errorHint:"המערכת עצמה עובדת. רק העמוד הזה לא הצליח להיטען. נסו שוב בעוד רגע.",forbiddenTitle:"רק מנהל מערכת יכול לראות את דיווח הבריאות",retry:"נסו שוב",switchLabel:"שליחת דוח יומי",sendNow:"שליחת דוח עכשיו",sendRetry:"ניסיון שליחה עכשיו",sending:"שולח…",sentOk:"הדוח נשלח והתקבל.",sentFail:"השליחה נכשלה. הניסיון נשמר ברשימת הדוחות.",saveFail:"השינוי לא נשמר. נסו שוב.",stopNote:'בכיבוי נשלחת הודעה אחרונה אחת, "הדיווח הופסק", כדי ש-SmplWise יידעו שכיבית ולא שהמערכת נפלה.',offTitle:"הדיווח כבוי",offSub:"שום דבר לא נשלח ל-SmplWise. אם תהיה תקלה, נדע עליה רק כשהלקוח יתקשר.",offDo:'כדי להתחיל: הדליקו את המתג "שליחת דוח יומי".',offLast:"הדוח האחרון נשלח לפני הכיבוי: {when}",offLastNone:"עדיין לא נשלח אף דוח",stoppedSent:'הודעת "הדיווח הופסק" נשלחה ל-SmplWise.',stoppedFail:'הודעת "הדיווח הופסק" לא הגיעה ל-SmplWise. אצלם ההתקנה תופיע כ"לא מדווחת" עד שיעודכנו.',onTitle:"הדיווח פועל ותקין",onSub:"הדוח האחרון התקבל {when}. הבא נשלח לבד {next}.",onFirstTitle:"הדיווח פועל, מחכה לדוח הראשון",onFirstSub:"המתג דולק. הדוח הראשון יישלח בקרוב לבד, או עכשיו בלחיצה על הכפתור.",onDo:"אין מה לעשות.",onFirstDo:'אפשר ללחוץ "שליחת דוח עכשיו" כדי לראות שהחיבור עובד.',nourlTitle:"הדיווח דולק, אבל עדיין לא נשלח",nourlSub:"המתג דולק, אבל עוד לא הוגדר לאן לשלוח. לכן לא יצא אף דוח.",nourlDo:"מה לעשות: המתקין פותח את הגדרות ההתקנה ומזין את כתובת השרת של SmplWise. הלקוח לא צריך לעשות כלום.",nourlBad:"כתובת השרת שהוגדרה בהתקנה אינה תקינה. המתקין צריך לתקן אותה בהגדרות ההתקנה.",nourlLast:"עדיין לא נשלח אף דוח",failTitle:"השליחה האחרונה נכשלה",failSub:"הדוח של {when} לא הגיע ל-SmplWise. המערכת תנסה שוב לבד {next}.",failDo:'מה לעשות: לבדוק שיש אינטרנט באתר. אם יש, ללחוץ "ניסיון שליחה עכשיו". אם זה נכשל שוב, להתקשר ל-SmplWise.',readyTitleNone:"מוכנות ההתקנה: הכול מוכן",readyTitle:"מוכנות ההתקנה: {n} דברים עוד חסרים",readyTitleOne:"מוכנות ההתקנה: דבר אחד עוד חסר",readySub:"הרשימה המלאה, הספים והמשקלים נמצאים במסך המוכנות. הדוח היומי מראה ל-SmplWise רק את הציון ומה חסר.",readyAllOk:"כל מה שנדרש הוגדר.",readyUnavailable:"מוכנות ההתקנה לא נטענה. שאר העמוד תקין.",readyOpen:"למסך המוכנות ‹",sentTitle:"מה נשלח בדוח",sentCount:"· {n} פריטים",sentSub:"רק מספרים ומצבים (תקין / אזהרה / תקלה). לעולם לא: שמות, כתובות, סיסמאות, תמונות, אירועים, יומנים.",sentNever:"לעולם לא",sentIntro:"לפי נושא. כל פריט הוא מספר, זמן, כן/לא או מצב מרשימה קבועה.",techNames:"שמות טכניים",neverTitle:"מה לעולם לא יוצא מההתקנה",neverX:"גם לא בטעות: הדוח בנוי מרשימה סגורה, ואין בו מקום לדברים האלה",sentHeader:'בנוסף, בכותרת השליחה (לא בדוח עצמו) נשלח מספר אחד: אחרי כמה שעות בלי דוח ההתקנה נחשבת "לא מדווחת".',lastTitle:"דוחות אחרונים",colWhen:"מתי",colWhat:"מה קרה",colSeq:"מספר דוח",seqHint:"מספר הדוח רק עולה. אם בשרת חסר מספר, יודעים שדוח לא הגיע.",logEmpty:"עדיין לא נשלח אף דוח",logOk:"התקבל",logRejected:"נדחה בשרת",logUnreachable:"לא נשלח, אין חיבור",logRefused:"נעצר בבדיקה, לא נשלח",logStop:"הודעת הפסקה",exactTitle:"הדוח המדויק שנשלח",exactHint:"כמו שהשרת מקבל אותו. למנהל המערכת שרוצה לבדוק בעצמו.",exactNow:"הדוח שיישלח עכשיו",exactLast:"הדוח האחרון שנשלח",exactLoad:"טוען…",exactNone:"אין עדיין דוח להצגה.",techTitle:"חיבור ל-SmplWise ופרטים למתקין",techReady:"מחובר ל-SmplWise · חתימה תקינה",techAllSet:"הכול מוגדר. הדיווח יתחיל מיד עם ההדלקה.",techMissing:"חסר: לאן לשלוח",whereTo:"לאן נשלח הדוח",whereToHint:"המתקין מגדיר את זה פעם אחת בהגדרות ההתקנה. הלקוח לא צריך לגעת.",isSet:"הוגדר",notSet:"עדיין לא הוגדר",invalid:"הכתובת אינה תקינה",signature:"חתימה על הדוח",signatureHint:"כל דוח חתום במפתח של ההתקנה הזאת, כך שאי אפשר לזייף אותו.",signatureNone:"המפתח ייווצר עם ההדלקה",signatureOk:"תקינה",installId:"מספר ההתקנה",installIdHint:"מספר אקראי. זה מה שהשרת מכיר, לא שם או כתובת.",enrollCode:"קוד רישום",enrollHint:"המתקין מזין אותו פעם אחת בשרת של SmplWise, וכך השרת יודע שהדוחות מגיעים מכאן.",copy:"העתקה",copied:"הועתק",copyFail:"ההעתקה לא הצליחה. סמנו את הקוד והעתיקו ידנית.",silentLabel:'מתי נחשבת "לא מדווחת"',silentHint:'אחרי כמה שעות בלי אף דוח השרת של SmplWise מסמן את ההתקנה כ"לא מדווחת". ברירת המחדל {def} שעות.',hoursUnit:"שעות",silentSave:"שמירה",silentRange:"בין {min} ל-{max} שעות",silentSaved:"נשמר",g_report:"על הדוח עצמו",g_report_x:"איזה דוח זה ומתי נוצר",g_versions:"גרסאות",g_versions_x:"כדי לדעת מי צריך עדכון",g_components:"מצב חלקי המערכת",g_components_x:"תקין / אזהרה / תקלה לכל חלק",g_counts:"כמויות",g_counts_x:"מספרים בלבד, בלי שמות",g_alerts:"התראות פתוחות",g_alerts_x:"כמה, לא מה",g_disk:"דיסק",g_backup:"גיבוי",g_update:"עדכון",g_readiness:"מוכנות",g_readiness_x:"מה עוד חסר להתקנה",ty_const:"קבוע",ty_id:"מספר אקראי",ty_num:"מספר",ty_time:"זמן",ty_enum:"מצב מרשימה",ty_bool:"כן / לא",ty_version:"מספר גרסה",ty_list:"רשימה קבועה"},q={tab:"Health report",title:"Health report",sub:"Once a day the system sends SmplWise a short report on its state, so a fault is handled before the customer feels it.",loading:"Loading the report settings…",errorTitle:"The report settings did not load",errorHint:"The system itself is working. Only this page failed to load. Try again in a moment.",forbiddenTitle:"Only a system administrator can see the health report",retry:"Try again",switchLabel:"Send a daily report",sendNow:"Send a report now",sendRetry:"Try sending now",offTitle:"Reporting is off",onTitle:"Reporting is on and healthy",nourlTitle:"Reporting is on, but nothing is sent yet",failTitle:"The last send failed",sentTitle:"What is sent in the report",lastTitle:"Recent reports",techTitle:"SmplWise connection and installer details",copy:"Copy",copied:"Copied",readyOpen:"Open the readiness screen ›"};function I(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function t(e,s){const a=(I()==="en"?q[e]:void 0)??j[e]??e;return s?a.replace(/\{(\w+)\}/g,(n,r)=>r in s?String(s[r]):n):a}function z(e){return e.enabled?e.receiver_configured?e.last_result&&e.last_result!=="ok"?"failed":"on":"nourl":"off"}const v=e=>String(e).padStart(2,"0");function N(e){if(!e)return null;const s=new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(e)?e:`${e}Z`);return Number.isNaN(s.getTime())?null:s}const b=e=>`${v(e.getHours())}:${v(e.getMinutes())}`,f=e=>e.getFullYear()*1e4+(e.getMonth()+1)*100+e.getDate();function y(e,s=new Date){const a=N(e);if(!a)return"";const n=new Date(s);n.setDate(n.getDate()-1);const r=new Date(s);return r.setDate(r.getDate()+1),f(a)===f(s)?`היום ${b(a)}`:f(a)===f(n)?`אתמול ${b(a)}`:f(a)===f(r)?`מחר ${b(a)}`:`${`${v(a.getDate())}.${v(a.getMonth()+1)}${a.getFullYear()===s.getFullYear()?"":`.${a.getFullYear()}`}`} · ${b(a)}`}function _(e,s=new Date){const a=y(e,s);if(!a)return"";const n=a.match(/^(היום|אתמול|מחר) (\d\d:\d\d)$/);if(n)return`${n[1]} בשעה ${n[2]}`;const[r,u]=a.split(" · ");return`ב-${r} בשעה ${u}`}function A(e,s=new Date){const a=N(e.last_attempt_at);if(!a)return null;const n=e.last_result==="ok"?e.period_h:e.retry_h,r=new Date(a.getTime()+n*36e5);return r.getTime()<=s.getTime()?null:r}function x(e,s){const a=A(e,s);return a?_(a.toISOString(),s):"בקרוב"}function $(e,s=new Date){const a=z(e),n=y(e.last_attempt_at,s),r=_(e.last_ok_at,s),u=e.last_seq>0?` · דוח מספר ${e.last_seq}`:"";return a==="off"?{view:a,tone:"mute",icon:"power",title:t("offTitle"),sub:t("offSub"),doText:t("offDo"),canSend:!1,lastLine:e.last_ok_at?t("offLast",{when:y(e.last_ok_at,s)}):t("offLastNone"),techLine:e.receiver_configured?t("techAllSet"):t("techMissing")}:a==="nourl"?{view:a,tone:"warn",icon:"warning",title:t("nourlTitle"),sub:t("nourlSub"),doText:e.receiver_problem==="receiver_url_invalid"?t("nourlBad"):t("nourlDo"),canSend:!1,lastLine:t("nourlLast"),techLine:t("techMissing")}:a==="failed"?{view:a,tone:"bad",icon:"warning",title:t("failTitle"),sub:t("failSub",{when:_(e.last_attempt_at,s),next:x(e,s)}),doText:t("failDo"),canSend:!0,lastLine:`${n} · ${k(e.last_result)}${e.retry_h?` · הניסיון הבא ${x(e,s)}`:""}`,techLine:t("techReady")}:e.last_ok_at?{view:a,tone:"ok",icon:"check",title:t("onTitle"),sub:t("onSub",{when:r,next:x(e,s)}),doText:t("onDo"),canSend:!0,lastLine:`${n} · ${t("logOk")}${u}`,techLine:t("techReady")}:{view:a,tone:"ok",icon:"info",title:t("onFirstTitle"),sub:t("onFirstSub"),doText:t("onFirstDo"),canSend:!0,lastLine:t("nourlLast"),techLine:t("techReady")}}function k(e){switch(e){case"ok":return t("logOk");case"rejected":return t("logRejected");case"unreachable":return t("logUnreachable");case"schema_refused":return t("logRefused");default:return""}}function B(e){return e==="ok"?"ok":e==="rejected"?"warn":"bad"}function P(e,s=new Date){return e.map(a=>({id:a.id,when:y(a.at,s),tone:B(a.result),seq:a.seq==null?"":String(a.seq),text:a.trigger==="stop"?`${t("logStop")} · ${k(a.result)}`:k(a.result)}))}function U(e){return e===0?t("readyTitleNone"):e===1?t("readyTitleOne"):t("readyTitle",{n:e})}function M(e,s){const a=Number(e);return e.trim()===""||!Number.isInteger(a)?t("silentRange",{min:s[0],max:s[1]}):a<s[0]||a>s[1]?t("silentRange",{min:s[0],max:s[1]}):null}const L=[{id:"report",title:"g_report",sub:"g_report_x",fields:[["גרסת מבנה הדוח","schema","const"],["מספר ההתקנה (אקראי)","installation_id","id"],["מספר רץ של הדוח","seq","num"],["מתי נוצר, לדקה","generated_at","time"],["מערכת אמיתית או הדגמה","mode","enum"],["נתוני דוגמה פועלים","demo_mode","bool"],["מצב כללי","overall","enum"],["שעות מאז ההדלקה","uptime_h","num"]]},{id:"versions",title:"g_versions",sub:"g_versions_x",fields:[["Arx","versions.addon","version"],["גשר","versions.bridge","version"],["גשר נדרש","versions.bridge_required","version"],["תשתית המערכת","versions.ha","version"],["שרת מדיה","versions.go2rtc","version"],["מסד נתונים","versions.db_schema","num"]]},{id:"components",title:"g_components",sub:"g_components_x",fields:[["מסד נתונים","components.db","enum"],["תיקיית נתונים","components.storage","enum"],["מקליט","components.nvr","enum"],["שרת מדיה","components.go2rtc","enum"],["סנכרון עם תשתית המערכת","components.ha_sync","enum"],["גשר","components.bridge","enum"],["קליטת אירועים","components.events_ingest","enum"],["עיבוד אירועים","components.events_derive","enum"],["איתור התקנים","components.discovery","enum"],["תמונות ממוזערות","components.thumbnails","enum"],["ייצוא","components.exports","enum"],["גיבויים","components.backups","enum"],["Frigate","components.frigate","enum"]]},{id:"counts",title:"g_counts",sub:"g_counts_x",fields:[["מצלמות","counts.cameras","num"],["מקליטים","counts.recorders","num"],["מקליטי Hikvision","counts.recorders_by_vendor.hikvision","num"],["מקליטי Provision-ISR","counts.recorders_by_vendor.provision_isr","num"],["שרתי Frigate","counts.recorders_by_vendor.frigate","num"],["מצלמות בלי מקליט","counts.recorders_by_vendor.none","num"],["התקנים בקטלוג","counts.ha_entities","num"],["תוכניות קומה שפורסמו","counts.floors_published","num"],["משתמשים פעילים","counts.users_active","num"],["מנהלי מערכת","counts.system_admins","num"]]},{id:"alerts",title:"g_alerts",sub:"g_alerts_x",fields:[["מידע","alerts_open.info","num"],["רגילות","alerts_open.alert","num"],["קריטיות","alerts_open.critical","num"]]},{id:"disk",title:"g_disk",fields:[["אחוז פנוי","disk.free_pct","num"],["GB פנויים","disk.free_gb","num"],["GB בסך הכול","disk.total_gb","num"]]},{id:"backup",title:"g_backup",fields:[["כמה גיבויים","backup.count","num"],["גיל הגיבוי האחרון, בשעות","backup.last_age_h","num"],["כמה יעדים מחוץ לשרת","backup.offbox_targets","num"]]},{id:"update",title:"g_update",fields:[["תוצאת בדיקת העדכון","update.check","enum"],["יש עדכון","update.available","bool"],["הגרסה החדשה ביותר","update.latest","version"]]},{id:"readiness",title:"g_readiness",sub:"g_readiness_x",fields:[["ציון","readiness.score","num"],["מוכנה למסירה","readiness.ready","bool"],["מה חסר (מרשימה קבועה)","readiness.missing","list"]]}],S=L.reduce((e,s)=>e+s.fields.length,0),Y={const:"ty_const",id:"ty_id",num:"ty_num",time:"ty_time",enum:"ty_enum",bool:"ty_bool",version:"ty_version",list:"ty_list"},G=["שמות אנשים","שמות מצלמות וחדרים","כתובת הנכס","כתובות רשת","מספרים סידוריים","סיסמאות ומפתחות","קישורים","דוא״ל","טלפון","אירועים","תמונות ווידאו","יומנים","טקסט שגיאה","מזהי התקנים","ערכי הגדרות"];function K(e){return e.length>24?`${e.slice(0,20)}…`:e}function V(e){return e&&e.length>10?`${e.slice(0,4)}…${e.slice(-4)}`:e??""}var X=Object.defineProperty,Z=Object.getOwnPropertyDescriptor,d=(e,s,a,n)=>{for(var r=n>1?void 0:n?Z(s,a):s,u=e.length-1,o;u>=0;u--)(o=e[u])&&(r=(n?o(s,a,r):o(r))||r);return n&&r&&X(s,a,r),r};let l=class extends F{constructor(){super(...arguments),this.bubbleSkin=new E(this),this.loadState="loading",this.status=null,this.log=[],this.readiness=null,this.readinessFailed=!1,this.enrollment=null,this.busy=!1,this.flash=null,this.techNames=!1,this.exact="last",this.nextBody=null,this.nextFailed=!1,this.silentDraft=null,this.silentError="",this.copied="idle",this.flashTimer=0,this.copyTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.flashTimer),window.clearTimeout(this.copyTimer)}async load(){this.loadState="loading";try{this.status=await p.status()}catch(e){this.loadState=e instanceof w&&e.status===403?"forbidden":"error";return}this.loadState="ready",await Promise.all([this.loadLog(),this.loadReadiness()])}async loadLog(){try{this.log=(await p.log()).items}catch{this.log=[]}}async loadReadiness(){try{this.readiness=await C(),this.readinessFailed=!1}catch{this.readiness=null,this.readinessFailed=!0}}say(e,s){this.flash={tone:e,text:s},window.clearTimeout(this.flashTimer),this.flashTimer=window.setTimeout(()=>this.flash=null,6e3)}async setEnabled(e){if(!this.busy){this.busy=!0;try{this.status=await p.setEnabled(e),!e&&this.status.stopped_at&&this.say(this.status.stopped_result==="ok"?"ok":"err",t(this.status.stopped_result==="ok"?"stoppedSent":"stoppedFail")),this.enrollment=null,await this.loadLog()}catch(s){this.say("err",s instanceof w&&s.body.user_message?s.body.user_message:t("saveFail"))}finally{this.busy=!1}}}async sendNow(){if(!this.busy){this.busy=!0;try{const e=await p.send();this.say(e.sent?"ok":"err",e.sent?t("sentOk"):t("sentFail"))}catch(e){this.say("err",e instanceof w&&e.body.user_message?e.body.user_message:t("sentFail"))}try{this.status=await p.status()}catch{}await this.loadLog(),this.busy=!1}}async saveSilent(){const e=this.status;if(!e||this.silentDraft===null||this.busy)return;const s=M(this.silentDraft,e.silent_range_h);if(s){this.silentError=s;return}this.busy=!0;try{this.status=await p.setSilentAfter(Number(this.silentDraft)),this.silentDraft=null,this.silentError="",this.say("ok",t("silentSaved"))}catch(a){this.silentError=a instanceof w&&a.body.user_message?a.body.user_message:t("saveFail")}finally{this.busy=!1}}async onTechToggle(e){if(!(e.detail.collapsed||this.enrollment||!this.status?.installation_id))try{this.enrollment=await p.enrollment()}catch{}}async onExactToggle(e){!e.target.open||this.log.some(s=>s.payload)||this.nextBody||await this.loadNext()}async loadNext(){this.exact="next",this.nextFailed=!1;try{this.nextBody=(await p.preview()).payload}catch{this.nextFailed=!0}}async copyCode(){const e=this.enrollment?.code;if(e){try{await navigator.clipboard.writeText(e),this.copied="ok"}catch{this.copied="fail"}window.clearTimeout(this.copyTimer),this.copyTimer=window.setTimeout(()=>this.copied="idle",3e3)}}answerCard(e){const s=$(e),a=s.tone==="bad"?"bad":s.tone==="warn"?"warn":"";return i`<sw-card data-card="answer">
      <div class="answer" data-answer data-view=${s.view}>
        <div class="ic ${s.tone==="ok"?"":s.tone}" aria-hidden="true"><sw-icon name=${s.icon} size=${24}></sw-icon></div>
        <div style="min-inline-size:0">
          <div class="t" data-answer-title>${s.title}</div>
          <div class="s">${s.sub}</div>
          <div class="do ${a}" data-answer-do>${s.doText}</div>
        </div>
        <div class="act">
          <label class="tog"><span>${t("switchLabel")}</span>
            <sw-toggle data-switch label=${t("switchLabel")} labelHidden .checked=${e.enabled} ?disabled=${this.busy}
              @change=${n=>void this.setEnabled(n.detail.checked)}></sw-toggle></label>
          <sw-button size="sm" variant=${s.view==="failed"?"primary":"secondary"} data-send ?disabled=${!s.canSend||this.busy} @click=${()=>void this.sendNow()}>${this.busy&&s.canSend?t("sending"):s.view==="failed"?t("sendRetry"):t("sendNow")}</sw-button>
        </div>
      </div>
    </sw-card>`}readyCard(){if(this.readinessFailed)return i`<sw-card data-card="ready"><p class="muted" data-ready-failed>${t("readyUnavailable")}</p></sw-card>`;const e=this.readiness;if(!e)return m;const s=e.checks.filter(a=>a.applicable&&(a.status==="attention"||a.status==="blocked"||a.status==="pending")).length;return i`<sw-card data-card="ready">
      <div class="ready" data-ready>
        <div class="ring" style=${`--v:${e.score}`} role="img" aria-label=${`${e.score}%`}><b data-ready-score>${e.score}%</b></div>
        <h3 class="rt"><span data-ready-title>${U(s)}</span><span class="csub">${t(s?"readySub":"readyAllOk")}</span></h3>
        <a class="link" data-ready-link href="#/system/readiness">${t("readyOpen")}</a>
      </div>
    </sw-card>`}sentCard(){return i`<sw-card collapsible collapsed data-card="sent" heading=${`${t("sentTitle")} ${t("sentCount",{n:S})}`} subheading=${t("sentSub")}>
      <div class="tools"><span class="hint grow">${t("sentIntro")}</span>
        <sw-button size="sm" variant=${this.techNames?"primary":"secondary"} data-tech-names aria-pressed=${String(this.techNames)} @click=${()=>this.techNames=!this.techNames}>${t("techNames")}</sw-button></div>
      <div class="fields ${this.techNames?"tech":""}" data-fields data-count=${S}>
        ${L.map(e=>i`<div class="fg" data-group=${e.id}>
          <h4><span>${t(e.title)}</span><span class="n">${e.fields.length}</span></h4>
          ${e.sub?i`<div class="gx">${t(e.sub)}</div>`:m}
          ${e.fields.map(([s,a,n])=>i`<div class="f" data-field=${a}><span class="l">${s}</span><span class="ty">${t(Y[n])}</span><code>${a}</code></div>`)}
        </div>`)}
      </div>
      <p class="hint" data-header-note>${t("sentHeader")}</p>
      <div class="grouplabel">${t("neverTitle")} <span class="muted">· ${t("neverX")}</span></div>
      <ul class="never" data-never>${G.map(e=>i`<li>${e}</li>`)}</ul>
    </sw-card>`}lastCard(e){const s=$(e),a=P(this.log),n=this.log.find(o=>o.payload)?.payload??null,r=this.exact==="next"||!n,u=r?this.nextBody:n;return i`<sw-card collapsible collapsed data-card="last" heading=${t("lastTitle")} subheading=${s.lastLine}>
      <table data-log>
        <thead><tr><th>${t("colWhen")}</th><th>${t("colWhat")}</th><th>${t("colSeq")}</th></tr></thead>
        <tbody>${a.length?a.map(o=>i`<tr data-log-row><td class="num">${o.when}</td><td><span class="msg ${o.tone==="mute"?"":o.tone==="bad"?"err":o.tone}">${o.text}</span></td><td class="num">${o.seq}</td></tr>`):i`<tr><td colspan="3" class="muted" data-log-empty>${t("logEmpty")}</td></tr>`}</tbody>
      </table>
      <div class="hint">${t("seqHint")}</div>
      <details class="exact" data-exact @toggle=${o=>void this.onExactToggle(o)}>
        <summary>${t("exactTitle")}<span class="hint">${t("exactHint")}</span></summary>
        <div class="tools">
          ${n?i`<sw-button size="sm" variant=${r?"secondary":"primary"} data-exact-last @click=${()=>this.exact="last"}>${t("exactLast")}</sw-button>`:m}
          <sw-button size="sm" variant=${r?"primary":"secondary"} data-exact-next @click=${()=>void this.loadNext()}>${t("exactNow")}</sw-button>
        </div>
        ${u?i`<pre class="json" data-json tabindex="0">${JSON.stringify(u,null,2)}</pre>`:i`<p class="hint" data-json-empty>${this.nextFailed?t("errorTitle"):r&&!this.nextBody?t("exactLoad"):t("exactNone")}</p>`}
      </details>
    </sw-card>`}techCard(e){const s=$(e),a=e.receiver_configured?i`<span class="msg ok" data-url-state="set">${t("isSet")}</span>`:i`<span class="msg warn" data-url-state=${e.receiver_problem==="receiver_url_invalid"?"invalid":"unset"}>${e.receiver_problem==="receiver_url_invalid"?t("invalid"):t("notSet")}</span>`,n=this.enrollment,r=this.silentDraft??String(e.silent_after_h),u=this.silentDraft!==null&&this.silentDraft!==String(e.silent_after_h);return i`<sw-card collapsible collapsed data-card="tech" heading=${t("techTitle")} subheading=${s.techLine} @sw-card-toggle=${o=>void this.onTechToggle(o)}>
      <div class="row"><span class="lbl">${t("whereTo")}<span class="muted">${t("whereToHint")}</span></span><span class="end">${a}</span></div>
      <div class="row"><span class="lbl">${t("signature")}<span class="muted">${t("signatureHint")}</span></span>
        <span class="end">${e.kid?i`<span class="msg ok">${t("signatureOk")}</span><code data-kid>${e.alg??"Ed25519"} · ${e.kid}</code>`:i`<span class="muted" data-kid-none>${t("signatureNone")}</span>`}</span></div>
      <div class="row"><span class="lbl">${t("installId")}<span class="muted">${t("installIdHint")}</span></span>
        <span class="end">${e.installation_id?i`<code data-install-id title=${e.installation_id}>${V(e.installation_id)}</code>`:i`<span class="muted">${t("signatureNone")}</span>`}</span></div>
      <div class="row"><span class="lbl">${t("enrollCode")}<span class="muted">${t("enrollHint")}</span></span>
        <span class="end">${n?i`<code data-enroll-code title=${n.code}>${K(n.code)}</code>
          <sw-button size="sm" data-copy @click=${()=>void this.copyCode()}>${this.copied==="ok"?t("copied"):t("copy")}</sw-button>
          ${this.copied==="fail"?i`<span class="msg err" role="alert" data-copy-fail>${t("copyFail")}</span>`:m}`:i`<span class="muted" data-enroll-none>${t("signatureNone")}</span>`}</span></div>
      <div class="row"><span class="lbl">${t("silentLabel")}<span class="muted">${t("silentHint",{def:e.silent_default_h})}</span>
          ${this.silentError?i`<span class="field-error" role="alert" data-silent-error>${this.silentError}</span>`:m}</span>
        <span class="end"><input class="in" inputmode="numeric" data-silent .value=${r} aria-label=${t("silentLabel")} aria-invalid=${this.silentError?"true":"false"} ?disabled=${this.busy}
            @input=${o=>{this.silentDraft=o.target.value,this.silentError=""}}
            @keydown=${o=>{o.key==="Enter"&&this.saveSilent()}} /><span class="muted">${t("hoursUnit")}</span>
          <sw-button size="sm" variant="primary" data-silent-save ?disabled=${!u||this.busy} @click=${()=>void this.saveSilent()}>${t("silentSave")}</sw-button></span></div>
      <div class="row"><span class="lbl"><span class="muted" data-stop-note>${t("stopNote")}</span></span></div>
    </sw-card>`}render(){const e=t("title");if(this.loadState==="loading")return i`<sw-page crumbs="הגדרות" heading=${e} subheading=${t("sub")} data-fleet-report data-state="loading">
        <div class="sections" aria-busy="true"><sw-card><div class="sk-answer"><span class="skl"></span><div class="sk-lines"><span class="skl" style="inline-size:40%;block-size:16px"></span><span class="skl" style="inline-size:70%"></span><span class="skl" style="inline-size:55%"></span></div></div></sw-card>
        ${[0,1,2].map(()=>i`<span class="skl sk-fold"></span>`)}
        <div class="hint">${t("loading")}</div></div></sw-page>`;if(this.loadState!=="ready"||!this.status){const a=this.loadState==="forbidden";return i`<sw-page crumbs="הגדרות" heading=${e} data-fleet-report data-state=${this.loadState}>
        <sw-state-panel icon="share" state=${a?"forbidden":"error"} heading=${t(a?"forbiddenTitle":"errorTitle")} hint=${a?"":t("errorHint")} actionLabel=${a?"":t("retry")}
          @action=${()=>void this.load()}></sw-state-panel></sw-page>`}const s=this.status;return i`<sw-page crumbs="הגדרות" heading=${e} subheading=${t("sub")} data-fleet-report data-state="ready" data-view=${z(s)}>
      <div class="sections">
        ${this.flash?i`<div class="msg ${this.flash.tone} flash" role=${this.flash.tone==="err"?"alert":"status"} data-flash>${this.flash.text}</div>`:m}
        ${this.answerCard(s)}${this.readyCard()}${this.sentCard()}${this.lastCard(s)}${this.techCard(s)}
      </div>
    </sw-page>`}};l.styles=[O,R`
    .sections {
      max-inline-size: 880px;
    }
    .flash {
      margin: 0;
    }
    .answer {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--sw-s-3);
      align-items: center;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: var(--sw-r-md);
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .ic.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .ic.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .ic.mute {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .t {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-xl);
      line-height: 1.25;
      color: var(--sw-heading, var(--sw-text));
      overflow-wrap: anywhere;
    }
    .s {
      margin-block-start: 2px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
      line-height: 1.45;
    }
    .do {
      margin-block-start: 6px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-base);
      line-height: 1.45;
    }
    .do.bad {
      color: var(--sw-danger-text);
    }
    .do.warn {
      color: var(--sw-warning-text);
    }
    .act {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--sw-s-2);
    }
    .tog {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
    }
    .ready {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      margin-block-end: var(--sw-s-2);
    }
    .ring {
      --v: 0;
      inline-size: 56px;
      block-size: 56px;
      border-radius: 50%;
      flex: none;
      display: grid;
      place-items: center;
      background: conic-gradient(var(--sw-accent) calc(var(--v) * 1%), var(--sw-surface-3) 0);
    }
    .ring b {
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      background: var(--sw-surface);
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-base);
      font-variant-numeric: tabular-nums;
    }
    h3.rt {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .rt .csub {
      display: block;
      margin-block-start: 2px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      line-height: 1.45;
    }
    .check .m {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-weight: var(--sw-fw-medium);
    }
    .check .m .muted {
      font-weight: var(--sw-fw-regular);
    }
    .chip {
      display: inline-block;
      margin-inline-start: 6px;
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    a.link {
      flex: none;
      display: inline-flex;
      align-items: center;
      min-block-size: 32px;
      padding-inline: 4px;
      border-radius: var(--sw-r-xs);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
      white-space: nowrap;
    }
    @media (hover: hover) and (pointer: fine) {
      a.link:hover {
        text-decoration: underline;
      }
    }
    a.link:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .tools {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      margin-block-end: var(--sw-s-2);
    }
    .tools .grow {
      flex: 1;
    }
    .fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 0 var(--sw-s-4);
    }
    .fg {
      padding-block-start: 10px;
      min-inline-size: 0;
    }
    .fg h4 {
      margin: 0 0 2px;
      display: flex;
      justify-content: space-between;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
    }
    .fg h4 .n {
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-medium);
      font-variant-numeric: tabular-nums;
    }
    .fg .gx {
      margin-block-end: 4px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .f {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0 8px;
      padding: 5px 0;
      border-block-end: 1px dashed var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .f .l {
      color: var(--sw-text-2);
    }
    .f .ty {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      white-space: nowrap;
    }
    .f code {
      display: none;
      grid-column: 1 / -1;
      justify-self: start;
      background: none;
      padding: 0;
      color: var(--sw-text-3);
    }
    .tech .f code {
      display: block;
    }
    .never {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .never li {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      text-decoration: line-through;
      text-decoration-color: var(--sw-danger);
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th {
      text-align: start;
      padding: 6px 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      border-block-end: 1px solid var(--sw-border);
    }
    td {
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    tr:last-child td {
      border-block-end: 0;
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    details.exact {
      margin-block-start: var(--sw-s-2);
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: var(--sw-s-2);
    }
    details.exact > summary {
      cursor: pointer;
      min-block-size: 40px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-base);
    }
    details.exact > summary:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    pre.json {
      margin: var(--sw-s-2) 0 0;
      padding: 12px 14px;
      max-block-size: 300px;
      overflow: auto;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-sm);
      direction: ltr;
      text-align: left;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-state);
      line-height: 1.5;
      color: var(--sw-text-2);
    }
    .row .end code {
      max-inline-size: 100%;
      overflow-wrap: anywhere;
    }
    .in {
      inline-size: 84px;
      min-block-size: 36px;
      padding: 0 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
    .in:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .in[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    .sk-answer {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: var(--sw-s-3);
      align-items: center;
    }
    .sk-answer .skl:first-child {
      block-size: 44px;
      border-radius: var(--sw-r-md);
    }
    .sk-lines {
      display: grid;
      gap: 10px;
    }
    .sk-fold {
      block-size: 56px;
      border-radius: var(--sw-r-lg);
    }
    .skl {
      display: block;
      block-size: 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-skeleton);
    }
    @media (prefers-reduced-motion: no-preference) {
      .skl {
        background: linear-gradient(90deg, var(--sw-skeleton) 0%, var(--sw-skeleton-shine) 50%, var(--sw-skeleton) 100%);
        background-size: 200% 100%;
        animation: shim 1.3s linear infinite;
      }
    }
    @keyframes shim {
      to {
        background-position: -200% 0;
      }
    }
    /* touch layouts: the readiness link and the folded-card summaries are 44 px targets */
    @media (max-width: 1100px) {
      a.link {
        min-block-size: 44px;
      }
      details.exact > summary {
        min-block-size: 44px;
      }
      .in {
        min-block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .answer {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .act {
        grid-column: 1 / -1;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding-block-start: var(--sw-s-2);
        border-block-start: 1px solid var(--sw-border);
      }
      .act sw-button {
        flex: 1;
      }
      .t {
        font-size: var(--sw-fs-lg);
      }
      .fields {
        grid-template-columns: 1fr;
      }
    }
  `,H];d([c()],l.prototype,"loadState",2);d([c()],l.prototype,"status",2);d([c()],l.prototype,"log",2);d([c()],l.prototype,"readiness",2);d([c()],l.prototype,"readinessFailed",2);d([c()],l.prototype,"enrollment",2);d([c()],l.prototype,"busy",2);d([c()],l.prototype,"flash",2);d([c()],l.prototype,"techNames",2);d([c()],l.prototype,"exact",2);d([c()],l.prototype,"nextBody",2);d([c()],l.prototype,"nextFailed",2);d([c()],l.prototype,"silentDraft",2);d([c()],l.prototype,"silentError",2);d([c()],l.prototype,"copied",2);l=d([W("system-fleet-report")],l);export{l as SystemFleetReport};
//# sourceMappingURL=system-fleet-report-DVef2lVW.js.map
