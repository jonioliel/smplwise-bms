import{b4 as H,uJ as ge,a as N,bs as F,bn as k,h$ as we,i0 as be,cE as $e,bE as ke,cG as _e,g as z,ay as J,j as p,i as R,dq as xe,uK as Se,A as c,b as n,dI as Te,k as A,u as ne,ei as Q,dE as Ce}from"./index-CkOaAZ0k.js";import{s as B,h as oe,m as re,i as le,d as We,c as Ne}from"./settings-mBGpMa3Z.js";import{a as de}from"./wiskey-format-D8sxb_B6.js";import"./sw-logo-art-MaHPMZFI.js";import"./wiskey-Du_2sjw3.js";const _="access-control/installer",Ee=2e4;function $(e){return{confirmed:!0,client_request_id:be(),expires_at:new Date(we()+Ee).toISOString().replace(/\.\d{3}Z$/,"Z"),...e===void 0?{}:{typed_confirmation:e}}}const Oe=()=>H(`${_}/overview`),Ke=()=>H(`${_}/clock`),He=e=>H(`${_}/clock/stations/${encodeURIComponent(e)}`),Pe=(e,t)=>F(`${_}/clock/settings`,{...$(),revision:e,values:t}),ze=(e,t)=>k(`${_}/clock/host-apply`,{...$(t),revision:e}),Re=(e,t,s,i)=>k(`${_}/clock/stations/${encodeURIComponent(e)}/sync`,{...$(i),revision:t,copy_system:s});function j(e){if(e instanceof N){const t=e.body?.details??{},s=String(t.outcome??""),i=s==="refused"?"refused":s==="not_sent"?"not_sent":s==="unknown"?"unknown":[400,403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",a=Number(t.retry_after_s);return{status:i,code:String(t.wiskey_code??e.code??"")||null,message:e.body?.user_message??e.message,retryAfterS:Number.isFinite(a)&&a>0?a:null,expected:typeof t.expected=="string"?t.expected:null}}return{status:"unknown",code:"network",message:"",retryAfterS:null,expected:null}}function U(e,t,s=[]){return[...s.filter(a=>a in t),...Object.keys(t).filter(a=>!s.includes(a))].map(a=>{const r=e?e[a]:void 0,h=t[a];return{key:a,before:r,after:h,changed:JSON.stringify(r)!==JSON.stringify(h)}})}const Ae=e=>e.some(t=>t.changed),Be=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;function Ie(e){if(e.length<1||e.length>64)return!1;const t=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(e);if(t){const s=t.slice(1).map(Number);return!(s.some(i=>i>255)||s.every(i=>i===0)||s[0]>=224&&s[0]<=239)}return/^[0-9.]+$/.test(e)?!1:e.split(".").every(s=>Be.test(s))}function X(e){const t=[];return Ie(e.server.trim())||t.push("server"),(!Number.isInteger(e.port)||e.port<2||e.port>65535)&&t.push("port"),(!Number.isInteger(e.interval)||e.interval<1||e.interval>10080)&&t.push("interval"),t}function Me(e){if(e==null||!Number.isFinite(e))return"unknown";const t=Math.abs(e);return t<=5?"ok":t<=60?"warn":"err"}const D=["doorName","openDuration","relayReverseEnabled"],De=(e,t=!1)=>H(`${_}/technical/stations/${encodeURIComponent(e)}${t?"?fresh=true":""}`),Le=(e,t,s,i,a)=>F(`${_}/technical/stations/${encodeURIComponent(e)}/doors/${t}`,{...$(a),expected:s,changes:i});function ee(e,t){const s={};for(const i of D)t[i]!==void 0&&t[i]!==e[i]&&(s[i]=t[i]);return s}function qe(e,t){const s=[];for(const i of D){const a=e[i],r=t?.[i];if(a!==void 0)if(i==="doorName"){const h=String(a),m=r&&r.type!=="boolean"?r.max:64,y=r&&r.type!=="boolean"?r.min:1;(h.length<y||h.length>m||/[\u0000-\u001f]/.test(h))&&s.push(i)}else if(i==="openDuration"){const h=Number(a),m=r&&r.type!=="boolean"?r.max:255,y=r&&r.type!=="boolean"?r.min:0;(!Number.isInteger(h)||h<y||h>m)&&s.push(i)}else typeof a!="boolean"&&s.push(i)}return s}const je=(e,t)=>Object.keys(e).some(s=>t.includes(s)),Ue=ge.installer_pulse.he,Fe=(e,t)=>k(`${_}/onboarding`,{...$(),kind:e,...t?{entry_id:t}:{}}),Je=(e,t,s,i)=>k(`${_}/onboarding/${encodeURIComponent(e)}/steps/${t}`,{...$(i),input:s}),Ve=e=>k(`${_}/onboarding/${encodeURIComponent(e)}/abort`,$()),Ze=["locks","confirm_mapping"];function Z(e,t){const s={name:String(e.name??"").trim(),host:String(e.host??"").trim(),username:String(e.username??"").trim(),scheme:e.scheme==="https"?"https":"http",port:Number(e.port),verify_ssl:e.verify_ssl===!0,rtsp_port:Number(e.rtsp_port)},i=String(e.password??"");return(i||t==="user")&&(s.password=i),s}function te(e,t){const s=[],i=(a,r)=>typeof e[a]=="string"&&e[a].length>=1&&e[a].length<=r;i("name",64)||s.push("name"),typeof e.host=="string"&&/^[A-Za-z0-9.:\-[\]]{1,255}$/.test(e.host)||s.push("host"),i("username",64)||s.push("username"),t==="user"&&!i("password",128)&&s.push("password");for(const a of["port","rtsp_port"]){const r=e[a];(!Number.isInteger(r)||r<1||r>65535)&&s.push(a)}return s}const Ge=()=>H(`${_}/lifecycle`),Ye=(e,t="")=>H(`${_}/lifecycle/review?source_id=${encodeURIComponent(e)}&target_id=${encodeURIComponent(t)}`),Qe=(e,t)=>k(`${_}/lifecycle/prepare`,{...$(),source_id:e,...t?{target_id:t}:{}}),Xe=(e,t,s)=>k(`${_}/lifecycle/jobs/${encodeURIComponent(e.id??"")}/${t}`,{...$(s),fingerprint:e.fingerprint});function se(e){return e.state==="prepared"||e.state==="approved"?"apply":e.state==="applied"?"verify":e.state==="verified"||e.state==="removing"?"remove":null}const et=["prepared","applied","verified","removed"];function tt(e){if(e==="removing")return 2.5;const t=et.indexOf(e==="approved"?"prepared":e);return t<0?-1:t}const S=`${_}/platform`,st=()=>H(S),at=()=>H(`${S}/export`),it=(e,t,s)=>F(`${S}/stations/${encodeURIComponent(e)}`,{...$(),revision:t,values:s}),nt=(e,t)=>F(`${S}/webhook`,{...$(),revision:e,values:t}),ot=e=>k(`${S}/webhook/key`,$(e)),rt=(e,t)=>k(`${S}/import/preview`,{content:e,mapping:t}),lt=(e,t)=>k(`${S}/import/apply`,{...$(t),review_id:e}),dt=e=>k(`${S}/retention/preview`,{values:e}),ct=(e,t)=>k(`${S}/retention/apply`,{...$(t),review_id:e}),pt=(e,t,s,i)=>k(`${S}/${e}/preview`,{station_ids:t,door:s,changes:i}),ht=(e,t)=>k(`${S}/config/apply`,{...$(t),review_id:e}),ut=(e,t)=>k(`${S}/maintenance/enqueue`,{...$(t),review_id:e}),mt=e=>k(`${S}/maintenance/jobs/${encodeURIComponent(e.id??"")}/cancel`,{...$(),fingerprint:e.fingerprint});function vt(e){const t=[],s=/^(?:[01]\d|2[0-3]):[0-5]\d$/;return e.enabled&&e.days.length===0&&t.push("days"),(!e.start||!s.test(e.start))&&t.push("start"),(!e.end||!s.test(e.end))&&t.push("end"),!t.length&&(e.start??"")>=(e.end??"")&&t.push("end"),(!e.timezone||!/^[A-Za-z0-9_+\-/]{1,100}$/.test(e.timezone))&&t.push("timezone"),t}function ft(e){const t=[];if(e.enabled&&e.kinds.length===0&&t.push("kinds"),e.url||e.enabled)try{const s=new URL(e.url);(s.protocol!=="https:"||!s.hostname||s.username||s.password||s.search||s.hash||!["","443","8443"].includes(s.port))&&t.push("url")}catch{t.push("url")}return t}function yt(e){const t=e.filter(i=>i.state==="verified").length,s=e.length-t;return{verified:t,failed:s,partial:t>0&&s>0}}const ce={title:"התקנה ותחזוקת מערכת האינטרקום",sub:"כלי המתקין של WisKey - שעון, הגדרות טכניות של עמדות, הוספה והסרה של עמדות ותצורת המערכת. כל שינוי נשלח רק אחרי אישור, ונרשם ביומן.",tabs:{clock:"שעון",technical:"הגדרות עמדה",lifecycle:"הוספה והסרה",platform:"תצורת המערכת"},forbiddenTitle:"אין הרשאה",forbiddenHint:"הכלים האלה פתוחים רק למי שמגדיר את המערכת (הרשאת הגדרות מערכת בכל ההתקנה).",errorTitle:"לא ניתן לטעון",retry:"נסו שוב",reload:"רענון",loading:"טוען…",unavailableTool:"גרסת WisKey המותקנת אינה מציעה את הכלי הזה.",unknownTool:"עדיין לא ידוע אם WisKey מציע את הכלי הזה - אין כרגע חיבור פעיל.",feedDown:"החיבור ל־WisKey אינו פעיל כרגע. אפשר לצפות במה שנטען, אבל פעולות לא יישלחו.",none:"—",yes:"כן",no:"לא",online:"מחוברת",offline:"לא מחוברת",cancel:"ביטול",close:"סגירה",confirm:{typeToConfirm:"כדי לאשר, הקלידו בדיוק: {phrase}",typedLabel:"אישור בהקלדה",send:"אישור ושליחה",sending:"נשלח… ממתין לתשובה מ־WisKey ({s} שניות, עד כ־{max})",noChanges:"אין שינויים לשלוח.",before:"לפני",after:"אחרי",willChange:"מה ישתנה",once:"הפעולה נשלחת פעם אחת ולא חוזרת על עצמה מעצמה."},result:{completed:"בוצע",refused:"לא בוצע - WisKey דחה את הפעולה ({code}). לא השתנה דבר.",not_sent:"לא נשלח: {message}",unknown:"נשלח, אך לא התקבלה תשובה ברורה. ייתכן שבוצע - רעננו ובדקו לפני שמנסים שוב.",retryIn:"אפשר לנסות שוב בעוד {s} שניות."},clock:{settingsTitle:"שרת הזמן של מערכת האינטרקום",settingsHint:"ההגדרה נשמרת ב־WisKey בלבד. שמירה אינה משנה אף מכשיר - כתיבה לעמדות ולשרת נעשית בנפרד, למטה.",server:"שרת זמן (NTP)",port:"פורט",interval:"מרווח סנכרון (דקות)",revision:"גרסה {r}",save:"שמירה",defaults:"ברירת המחדל של WisKey: {server}, פורט {port}, כל {interval} דקות",invalid:{server:"כתובת לא תקינה (שם שרת או IPv4)",port:"פורט בין 2 ל־65535",interval:"בין 1 ל־10080 דקות"},saveHeading:"שמירת הגדרות השעון",hostTitle:"השעון של השרת",hostSupported:"השרת תומך בהגדרת NTP",hostUnsupported:"השרת אינו מאפשר ל־WisKey להגדיר NTP",hostSynced:"מסונכרן",hostNotSynced:"לא מסונכרן",hostServers:"שרתי זמן בשרת",hostApply:"החלה על השרת",hostApplyHeading:"החלת שרת הזמן על השרת",hostApplyBody:"שרת הזמן של השרת יוחלף ב־{server}. שרתי הגיבוי יימחקו. WisKey קורא את ההגדרה בחזרה ומאשר אותה.",hostApplyPort:"החלה על השרת אפשרית רק עם פורט 123.",hostApplied:"השרת הוגדר לשרת הזמן {server} (נקרא בחזרה ואושר).",stationsTitle:"השעון של כל עמדה",stationsHint:'המדידה האחרונה של WisKey מול השעון של השרת. "בדיקה" קוראת את המדידה העדכנית ביותר ש־WisKey שמר; קריאה חדשה מהמכשיר עצמו נמצאת בתחזוקת העמדה.',colStation:"עמדה",colSkew:"סטייה",colMode:"מצב שעון",colChecked:"נמדד",check:"בדיקה",sync:"כתיבת השעון לעמדה",syncHeading:"כתיבת הגדרות השעון לעמדה {name}",syncBody:"העמדה תוגדר לשרת הזמן {server} (פורט {port}, כל {interval} דקות) ולמצב שעון NTP. WisKey קורא את ההגדרה בחזרה ומודד את השעון.",copySystem:"להעתיק קודם את השעה של השרת לעמדה (שעה ידנית, ואז חזרה ל־NTP)",syncResult:"ההגדרה נכתבה ואושרה. שעון העמדה {verified} (סטייה {skew}).",verified:"מאומת",notVerified:"עדיין לא מאומת",skew:"{s} שנ׳",noClock:"אין מדידה",modes:{NTP:"NTP",manual:"ידני",satellite:"לוויין",platform:"פלטפורמה",NONE:"ללא",GB28181:"GB28181",unknown:"לא ידוע"},noStations:"אין עמדות להצגה.",sectionUnavailable:"החלק הזה לא נטען: {message}"}};function f(e,t){return _e(e,t)}const pe={pick:"עמדה",pickHint:"הנתונים נקראים מהמכשיר עצמו דרך WisKey. קריאה אורכת עד כדקה.",read:"קריאה מהעמדה",reread:"קריאה מחדש",readAt:"נקרא מהעמדה: {at}",offline:"העמדה אינה מחוברת - אפשר לקרוא את מה שנשמר, אבל לא לשנות.",door:"דלת {n}",notMapped:"הדלת אינה במיפוי הממסרים המאושר של העמדה, ולכן אי אפשר לשנות אותה מכאן.",doorError:"לא ניתן לקרוא את הדלת ({code}).",fields:{doorName:"שם הדלת",openDuration:"זמן פתיחה (שניות)",relayReverseEnabled:"היפוך ממסר"},bounds:"בין {min} ל־{max}",lengthBounds:"{min}-{max} תווים",relayOn:"הפוך",relayOff:"רגיל",relayWarn:'היפוך הממסר משנה את המשמעות של "נעול" ו"פתוח" במנעול. שינוי שגוי עלול להשאיר דלת פתוחה - נדרש אישור בהקלדה.',save:"שמירת הדלת",saveHeading:"שמירת ההגדרות של {door} בעמדה {name}",saveBody:"WisKey קורא את הדלת שוב, בודק שלא השתנתה מאז הקריאה, כותב רק את השדות שהשתנו וקורא בחזרה כדי לאמת.",saved:"נשמר ונקרא בחזרה מהעמדה.",invalid:"הערך מחוץ לטווח שהמכשיר מאפשר",features:"יכולות שהמכשיר מדווח",supported:"נתמך",notSupported:"לא נתמך",passwords:"סיסמאות ההרשאה במכשיר (קיום בלבד, לא הערכים)",pinState:{configured:"מוגדר קוד ציבורי",absent:"אין קוד ציבורי",unknown:"לא ידוע"},passwordNames:{engineeringConfigured:"סיסמת הנדסה",setupAlarmConfigured:"סיסמת דריכה",householderUnlockConfigured:"סיסמת פתיחה לדייר",antiHijackingConfigured:"סיסמת חטיפה",sendCardConfigured:"סיסמת כרטיס"},set:"מוגדרת",unset:"לא מוגדרת",relays:"מיפוי ממסרים מאושר",relayRow:"ממסר פיזי {physical} ← דלת API {api}",noRelays:"אין מיפוי ממסרים (עמדת מצלמה בלבד).",empty:"בחרו עמדה כדי לקרוא את ההגדרות הטכניות שלה."},he={addTitle:"הוספת עמדה",addHint:"האשף של WisKey: חיבור לעמדה, אימות זהות המכשיר ומיפוי הממסר. פרטי ההתחברות עוברים ל־WisKey בלבד - Arx לא שומר ולא רושם אותם.",addStart:"הוספת עמדה",reTitle:"התחברות מחדש לעמדה",reHint:"כתובת, משתמש או סיסמה חדשים לאותו מכשיר. WisKey מוודא שזה אותו מכשיר לפני שהוא שומר.",reStart:"התחברות מחדש",station:"עמדה",wizardTitle:{add:"הוספת עמדה",reconfigure:"התחברות מחדש לעמדה"},steps:{user:"פרטי חיבור",reconfigure:"פרטי חיבור",confirm_device:"אימות המכשיר",locks:"דלת",mapping:"בדיקת ממסר",confirm_mapping:"אישור הבדיקה",other:"שלב"},fields:{name:"שם העמדה",host:"כתובת (שם או IP)",username:"משתמש",password:"סיסמה",scheme:"פרוטוקול",port:"פורט",verify_ssl:"לאמת תעודת אבטחה",rtsp_port:"פורט וידאו (RTSP)",lock_name:"שם הדלת (רשות)",api_id:"ממסר לבדיקה",mode:"מה העמדה מפעילה",result:"מה קרה בבדיקה"},passwordKeep:"השאירו ריק כדי לשמור את הסיסמה הקיימת",modes:{camera_only:"מצלמה בלבד (בלי דלת)",map_active_relay:"מיפוי ממסר לדלת (כולל בדיקה)",keep_confirmed_mapping:"להשאיר את המיפוי המאושר"},results:{released_and_returned:"הדלת נפתחה ונסגרה כמצופה",choose_again:"לא הדלת הנכונה - לבחור ממסר אחר",camera_only:"לוותר על הדלת - מצלמה בלבד"},device:"WisKey זיהה את המכשיר",model:"דגם",firmware:"קושחה",serial:"מספר סידורי",deviceConfirm:"זו העמדה הנכונה",next:"המשך",cancel:"ביטול האשף",checking:"WisKey מתחבר למכשיר ובודק…",pulseWarn:"בשלב הזה WisKey שולח לממסר שנבחר פקודת פתיחה אחת כדי לוודא שזו הדלת הנכונה. ודאו שמישהו נמצא ליד הדלת ושאין סכנה בפתיחתה.",pulseButton:"פתיחת דלת לבדיקה",pulseHeading:"פתיחת הדלת לבדיקת הממסר",commitHeading:"שמירת העמדה ב־WisKey",commitBody:"WisKey ישמור את העמדה עם ההגדרות שנבחרו.",created:"העמדה {title} נוספה ל־WisKey. היא תופיע ברשימת העמדות אחרי הסנכרון הבא.",reconfigured:"פרטי החיבור של העמדה עודכנו ב־WisKey.",aborted:"האשף הסתיים בלי שינוי ({reason}).",cancelled:"האשף בוטל.",flowErrors:{invalid_auth:"שם המשתמש או הסיסמה שגויים",cannot_connect:"אין חיבור למכשיר בכתובת הזו",unsupported_device:"המכשיר אינו נתמך",invalid_response:"המכשיר החזיר תשובה לא צפויה",access_removal_pending:"יש אנשים שעדיין ממתינים להסרה מהעמדה - אי אפשר לעבור למצלמה בלבד",test_required:"יש לאשר את בדיקת הממסר",invalid_mapping:"ממסר לא תקין",unlock_failed:"פקודת הפתיחה נכשלה",confirmation_required:"יש לבחור מה קרה בבדיקה",other:"WisKey דחה את השלב"},abortReasons:{already_configured:"העמדה כבר קיימת",unique_id_mismatch:"זה מכשיר אחר",reconfigure_successful:"עודכן",already_in_progress:"אשף אחר כבר פתוח לעמדה הזו"},removeTitle:"הסרה או החלפה של עמדה",removeHint:"WisKey בודק את ההשפעה, מעביר או מסיר את האנשים מהעמדה, מוודא שהעמדה נוקתה, ורק אז מסיר אותה. בהחלפה - האנשים עוברים לעמדת היעד (הוסיפו אותה קודם באשף).",source:"העמדה שמוסרת",target:"עמדת יעד (להחלפה, רשות)",noTarget:"בלי - הסרה בלבד",review:"בדיקת השפעה",impact:"השפעה",people:"אנשים מושפעים",bindings:"שיוכים מוכרים",unknownOwners:"בעלים לא ידועים במכשיר",holdPrograms:"תוכניות פתיחה",nativeSchedules:"לוחות זמנים במכשיר",blockers:"חוסמים",noBlockers:"אין חוסמים",blockerText:{target_already_in_use:"עמדת היעד כבר בשימוש",target_ownership_unverified:"לא אומתה הבעלות על עמדת היעד",target_contains_accounts:"בעמדת היעד יש משתמשים",target_lock_mapping_incomplete:"מיפוי הדלתות בעמדת היעד חלקי",native_schedule_redeployment_required:"צריך לפרוס מחדש לוחות זמנים במכשיר",hold_programs_require_separate_review:"יש תוכניות פתיחה שדורשות בדיקה נפרדת",other:"חוסם אחר"},prepare:"הכנת ההסרה",prepareHeading:"הכנת הסרה של {name}",prepareBody:"WisKey יכין משימה ויקבע את מצב האנשים בעמדה. שום דבר עוד לא נמחק ולא מועבר.",jobs:"משימות הסרה והחלפה",noJobs:"אין משימות.",refresh:"רענון",states:{prepared:"הוכנה",approved:"אושרה",rejected:"נדחתה",applied:"האנשים הועברו",verified:"נוקתה",removing:"בהסרה",removed:"הוסרה",expired:"פג תוקף",failed:"נכשלה",unknown:"לא ידוע"},stepLabels:["הוכנה","אנשים","ניקוי","הוסרה"],actions:{apply:"העברת האנשים",verify:"בדיקת ניקוי",remove:"הסרת העמדה"},applyHeading:"העברת האנשים מ־{name}",applyBody:"WisKey יסיר את ההרשאות של {n} אנשים מהעמדה (ובהחלפה - יעביר אותן לעמדת היעד). זו פעולה שמשנה את המכשירים.",verifyHeading:"בדיקת הניקוי של {name}",verifyBody:"WisKey קורא את המכשיר ובודק שלא נשארו בו משתמשים וכרטיסים של המערכת.",removeHeading:"הסרת העמדה {name} מהמערכת",removeBody:"WisKey יסיר את הגדרת העמדה. כדי להחזיר אותה יהיה צריך להוסיף אותה מחדש באשף.",approval:"ב־WisKey מופעל אישור כפול. Arx אינו יכול לשמש כמאשר השני - האישור נעשה ב־WisKey עצמו.",doneJob:"המשימה עודכנה: {state}."},ue={healthTitle:"שלמות ונתונים",integrity:"בדיקת שלמות של WisKey",integrityOk:"כל המאגרים נטענו",integrityBad:"מאגר לא זמין: {list}",noWrites:"הבדיקה לא כתבה דבר.",components:{access:"אנשים והרשאות",panel_permissions:"הרשאות הלוח",appearance_settings:"מראה",profile_settings:"קבוצות ושדות",schedule_journal:"יומן לוחות זמנים",hold_programs:"תוכניות פתיחה",operations_center:"מרכז התפעול",events:"אירועים",operations_validation:"אימות מרכז התפעול"},events:"אירועים שמורים",eventsLine:"{records} רשומות · עד {limit} · כ־{rate} ביום",demo:"מצב הדגמה של WisKey זמין (בלי מכשיר ובלי כתיבה).",capacityTitle:"קיבולת העמדות",capacityHint:"משתמשים וכרטיסים מול הגבול שהמכשיר מדווח. התחזית היא הערכה לפי הקצב שנמדד.",users:"משתמשים",cards:"כרטיסים",daysTo:"כ־{d} ימים לגבול",alerts:{unknown:"לא ידוע",stale:"מדידה ישנה",at_limit:"בגבול",near_limit:"קרוב לגבול",growth_to_limit:"יגיע לגבול בקרוב",observed:"תקין"},metaTitle:"פרטי עמדה וחלון תחזוקה",metaHint:"אזור, אחראי, תגיות, ספי התרעה וחלון התחזוקה שבו WisKey רשאי לכתוב לעמדה.",zone:"אזור",owner:"אחראי",tags:"תגיות (מופרדות בפסיק)",thresholds:{offline:"התרעה על ניתוק (שניות)",sync_stalled:"סנכרון תקוע (שניות)",event_gap:"פער באירועים (שניות)"},windowOn:"להגביל כתיבה לחלון התחזוקה",days:["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],dayNames:"ימים",start:"משעה",end:"עד שעה",timezone:"אזור זמן",saveMeta:"שמירה",metaHeading:"שמירת פרטי העמדה {name}",metaBody:"נשמר במרכז התפעול של WisKey. שום מכשיר לא משתנה.",changeTitle:"שינוי הגדרה בכמה עמדות",changeHint:'WisKey קורא כל עמדה, מראה לפני ואחרי, ורק אחרי אישור כותב. "עכשיו" כותב מיד; "בחלון התחזוקה" מכניס לתור ש־WisKey מריץ בחלון של כל עמדה.',stations:"עמדות (עד 12)",door:"דלת",mode:"מתי",modeNow:"עכשיו",modeWindow:"בחלון התחזוקה",preview:"תצוגה מקדימה",previewEmpty:"אין עמדה שאפשר לשנות.",apply:"החלה",enqueue:"הכנסה לתור",applyHeading:"החלת השינוי על {n} עמדות",applyBody:"WisKey יכתוב לכל עמדה את השדות שהשתנו ויקרא בחזרה. כל עמדה מקבלת תוצאה משלה.",enqueueHeading:"תזמון השינוי ל־{n} עמדות",enqueueBody:"WisKey יכתוב לכל עמדה בתוך חלון התחזוקה שלה. ההתקדמות מופיעה בתור למטה.",receipts:"תוצאות לפי עמדה",receiptOk:"נכתב ואומת",receiptFail:"נכשל ({code})",partial:"חלק מהעמדות נכשלו - בדקו כל עמדה בנפרד.",queueTitle:"תור התחזוקה",noJobs:"התור ריק.",jobStates:{queued:"בתור",awaiting_approval:"ממתין לאישור",rejected:"נדחה",cancelled:"בוטל",verified:"הושלם",completed_with_errors:"הושלם עם שגיאות",expired:"פג תוקף",unknown:"לא ידוע"},rowStates:{pending:"ממתין",writing:"נכתב",verified:"אומת",failed:"נכשל",uncertain:"לא ודאי",cancelled:"בוטל",unknown:"לא ידוע"},cancelJob:"ביטול",cancelHeading:"ביטול משימת התחזוקה",cancelBody:"עמדות שעוד לא נכתבו לא ייכתבו. עמדות שכבר נכתבו נשארות כפי שהן.",retentionTitle:"שמירת אירועים",retentionHint:"כמה זמן וכמה רשומות WisKey שומר. תצוגה מקדימה מראה כמה רשומות יימחקו - המחיקה נעשית רק אחרי אישור בהקלדה.",retDays:"ימים (1-365)",retCount:"רשומות (100-20000)",retMb:"נפח (MB, 0.25-24)",retPreview:"כמה יימחק?",retRemoved:"יימחקו {removed} רשומות מתוך {before}.",retApply:"החלת המדיניות",retHeading:"החלת מדיניות שמירת האירועים",retBody:"{removed} רשומות אירוע יימחקו לצמיתות מ־WisKey.",webhookTitle:"שליחת אירועים (Webhook)",webhookHint:"WisKey שולח אירועים חתומים לכתובת https. מפתח החתימה מוצג פעם אחת לבקשה, ואינו נשמר ב־Arx.",webhookOn:"שליחה פעילה",url:"כתובת (https)",kinds:{access_event:"אירועי כניסה",security_denied:"כניסות שנדחו",configuration_result:"תוצאות שינויי הגדרות"},saveWebhook:"שמירה",webhookHeading:"שמירת ה־webhook",webhookBody:"WisKey יתחיל או יפסיק לשלוח לכתובת הזו מיד.",showKey:"הצגת מפתח החתימה",keyHeading:"הצגת מפתח החתימה",keyBody:"המפתח יוצג כאן פעם אחת. העתיקו אותו למקבל ה־webhook; Arx אינו שומר אותו.",keyShown:"מפתח החתימה (מוצג פעם אחת):",hideKey:"הסתרה",invalid:{url:"כתובת https בלבד, בלי פרמטרים",kinds:"בחרו לפחות סוג אחד",days:"בחרו לפחות יום אחד",start:"שעה לא תקינה",end:"שעת הסיום חייבת להיות אחרי ההתחלה",timezone:"אזור זמן לא תקין"},ioTitle:"ייצוא וייבוא תצורה",ioHint:"הקובץ כולל את פרטי העמדות ואת תבניות ההודעות בלבד - בלי אנשים, הרשאות, מפתחות או כתובות.",export:"ייצוא לקובץ",importLabel:"קובץ תצורה לייבוא",mapTo:"לאיזו עמדה כאן?",importPreview:"בדיקת הקובץ",importApply:"ייבוא",importHeading:"ייבוא התצורה",importBody:"פרטי {n} עמדות יוחלפו, וכל תבניות ההודעות של WisKey יוחלפו בתבניות שבקובץ ({t}).",imported:"התצורה יובאה ({n} עמדות).",saved:"נשמר."},me={title:"Intercom system installation and maintenance",sub:"WisKey's installer tools: the clock, station technical settings, adding and removing stations, and the system configuration. A change is sent only after confirmation, and is logged.",tabs:{clock:"Clock",technical:"Station settings",lifecycle:"Add and remove",platform:"System configuration"},forbiddenTitle:"No permission",forbiddenHint:"These tools are open only to people who configure the system (the system settings permission for the whole installation).",errorTitle:"Cannot load",retry:"Try again",reload:"Refresh",loading:"Loading…",unavailableTool:"The installed WisKey version does not offer this tool.",unknownTool:"It is not yet known whether WisKey offers this tool - there is no active connection right now.",feedDown:"The connection to WisKey is not active right now. You can view what has loaded, but actions will not be sent.",none:"—",yes:"Yes",no:"No",online:"Online",offline:"Offline",cancel:"Cancel",close:"Close",confirm:{typeToConfirm:"To confirm, type exactly: {phrase}",typedLabel:"Typed confirmation",send:"Confirm and send",sending:"Sending… waiting for a reply from WisKey ({s} s, up to about {max})",noChanges:"There are no changes to send.",before:"Before",after:"After",willChange:"What will change",once:"The action is sent once and is not repeated automatically."},result:{completed:"Done",refused:"Not done - WisKey refused the action ({code}). Nothing changed.",not_sent:"Not sent: {message}",unknown:"Sent, but no clear reply came back. It may have been done - refresh and check before trying again.",retryIn:"You can try again in {s} seconds."},clock:{settingsTitle:"Intercom system time server",settingsHint:"The setting is saved in WisKey only. Saving does not change any device - writing to the stations and to the server is done separately, below.",server:"Time server (NTP)",port:"Port",interval:"Sync interval (minutes)",revision:"Revision {r}",save:"Save",defaults:"WisKey's default: {server}, port {port}, every {interval} minutes",invalid:{server:"Invalid address (server name or IPv4)",port:"A port between 2 and 65535",interval:"Between 1 and 10080 minutes"},saveHeading:"Save the clock settings",hostTitle:"The server's clock",hostSupported:"The server supports NTP configuration",hostUnsupported:"The server does not let WisKey configure NTP",hostSynced:"Synced",hostNotSynced:"Not synced",hostServers:"The server's time servers",hostApply:"Apply to the server",hostApplyHeading:"Set the server's time server",hostApplyBody:"The server's time server will be replaced with {server}. The backup servers will be deleted. WisKey reads the setting back and confirms it.",hostApplyPort:"Applying to the server is possible only with port 123.",hostApplied:"The server now uses the time server {server} (read back and confirmed).",stationsTitle:"Each station's clock",stationsHint:`WisKey's latest measurement against the server's clock. "Check" reads the latest measurement WisKey saved; a new reading from the device itself is in the station's maintenance.`,colStation:"Station",colSkew:"Drift",colMode:"Clock mode",colChecked:"Measured",check:"Check",sync:"Write the clock to the station",syncHeading:"Write the clock settings to station {name}",syncBody:"The station will be set to the time server {server} (port {port}, every {interval} minutes) and to NTP clock mode. WisKey reads the setting back and measures the clock.",copySystem:"Copy the server's time to the station first (manual time, then back to NTP)",syncResult:"The setting was written and confirmed. Station clock: {verified} (drift {skew}).",verified:"verified",notVerified:"not yet verified",skew:"{s} s",noClock:"No measurement",modes:{NTP:"NTP",manual:"Manual",satellite:"Satellite",platform:"Platform",NONE:"None",GB28181:"GB28181",unknown:"Unknown"},noStations:"No stations to show.",sectionUnavailable:"This section did not load: {message}"}},ve={pick:"Station",pickHint:"The data is read from the device itself through WisKey. A read takes up to about a minute.",read:"Read from the station",reread:"Read again",readAt:"Read from the station: {at}",offline:"The station is offline - you can read what was saved, but not change it.",door:"Door {n}",notMapped:"The door is not in the station's confirmed relay mapping, so it cannot be changed from here.",doorError:"The door cannot be read ({code}).",fields:{doorName:"Door name",openDuration:"Open time (seconds)",relayReverseEnabled:"Reverse relay"},bounds:"Between {min} and {max}",lengthBounds:"{min}-{max} characters",relayOn:"Reversed",relayOff:"Normal",relayWarn:'Reversing the relay swaps what "locked" and "open" mean for the lock. A wrong change can leave a door open - typed confirmation is required.',save:"Save the door",saveHeading:"Save the settings of {door} on station {name}",saveBody:"WisKey reads the door again, checks that it has not changed since it was read, writes only the changed fields and reads back to verify.",saved:"Saved and read back from the station.",invalid:"The value is outside the range the device allows",features:"Capabilities the device reports",supported:"Supported",notSupported:"Not supported",passwords:"Authorisation passwords on the device (whether they are set, never the values)",pinState:{configured:"Public code set",absent:"No public code",unknown:"Unknown"},passwordNames:{engineeringConfigured:"Engineering password",setupAlarmConfigured:"Arming password",householderUnlockConfigured:"Resident unlock password",antiHijackingConfigured:"Duress password",sendCardConfigured:"Card password"},set:"Set",unset:"Not set",relays:"Confirmed relay mapping",relayRow:"Physical relay {physical} → API door {api}",noRelays:"No relay mapping (camera-only station).",empty:"Choose a station to read its technical settings."},fe={addTitle:"Add a station",addHint:"WisKey's wizard: connect to the station, verify the device's identity and map the relay. The sign-in details go to WisKey only - Arx neither stores nor logs them.",addStart:"Add a station",reTitle:"Reconnect a station",reHint:"A new address, user or password for the same device. WisKey makes sure it is the same device before it saves.",reStart:"Reconnect",station:"Station",wizardTitle:{add:"Add a station",reconfigure:"Reconnect a station"},steps:{user:"Connection details",reconfigure:"Connection details",confirm_device:"Device check",locks:"Door",mapping:"Relay test",confirm_mapping:"Confirm the test",other:"Step"},fields:{name:"Station name",host:"Address (name or IP)",username:"User",password:"Password",scheme:"Protocol",port:"Port",verify_ssl:"Verify the security certificate",rtsp_port:"Video port (RTSP)",lock_name:"Door name (optional)",api_id:"Relay to test",mode:"What the station operates",result:"What happened in the test"},passwordKeep:"Leave empty to keep the current password",modes:{camera_only:"Camera only (no door)",map_active_relay:"Map a relay to the door (with a test)",keep_confirmed_mapping:"Keep the confirmed mapping"},results:{released_and_returned:"The door opened and closed as expected",choose_again:"Not the right door - choose another relay",camera_only:"Skip the door - camera only"},device:"WisKey identified the device",model:"Model",firmware:"Firmware",serial:"Serial number",deviceConfirm:"This is the right station",next:"Continue",cancel:"Cancel the wizard",checking:"WisKey is connecting to the device and checking…",pulseWarn:"At this step WisKey sends the chosen relay one open command to make sure it is the right door. Make sure someone is at the door and that opening it is safe.",pulseButton:"Open the door for a test",pulseHeading:"Open the door to test the relay",commitHeading:"Save the station in WisKey",commitBody:"WisKey will save the station with the chosen settings.",created:"Station {title} was added to WisKey. It will appear in the station list after the next sync.",reconfigured:"The station's connection details were updated in WisKey.",aborted:"The wizard ended without a change ({reason}).",cancelled:"The wizard was cancelled.",flowErrors:{invalid_auth:"Wrong user name or password",cannot_connect:"No connection to the device at this address",unsupported_device:"The device is not supported",invalid_response:"The device returned an unexpected reply",access_removal_pending:"Some people are still waiting to be removed from the station - it cannot switch to camera only",test_required:"Confirm the relay test",invalid_mapping:"Invalid relay",unlock_failed:"The open command failed",confirmation_required:"Choose what happened in the test",other:"WisKey refused the step"},abortReasons:{already_configured:"The station already exists",unique_id_mismatch:"This is a different device",reconfigure_successful:"Updated",already_in_progress:"Another wizard is already open for this station"},removeTitle:"Remove or replace a station",removeHint:"WisKey checks the impact, moves or removes the people from the station, makes sure the station has been cleared, and only then removes it. When replacing, the people move to the target station (add it in the wizard first).",source:"The station being removed",target:"Target station (to replace it, optional)",noTarget:"None - remove only",review:"Check the impact",impact:"Impact",people:"People affected",bindings:"Known assignments",unknownOwners:"Unknown owners on the device",holdPrograms:"Hold-open programs",nativeSchedules:"Schedules on the device",blockers:"Blockers",noBlockers:"No blockers",blockerText:{target_already_in_use:"The target station is already in use",target_ownership_unverified:"Ownership of the target station was not verified",target_contains_accounts:"The target station has users on it",target_lock_mapping_incomplete:"The target station's door mapping is incomplete",native_schedule_redeployment_required:"Schedules on the device need to be deployed again",hold_programs_require_separate_review:"Some hold-open programs need a separate review",other:"Another blocker"},prepare:"Prepare the removal",prepareHeading:"Prepare the removal of {name}",prepareBody:"WisKey will prepare a job and set the state of the station's people. Nothing is deleted or moved yet.",jobs:"Removal and replacement jobs",noJobs:"No jobs.",refresh:"Refresh",states:{prepared:"Prepared",approved:"Approved",rejected:"Rejected",applied:"People moved",verified:"Cleared",removing:"Removing",removed:"Removed",expired:"Expired",failed:"Failed",unknown:"Unknown"},stepLabels:["Prepared","People","Clearing","Removed"],actions:{apply:"Move the people",verify:"Check the clearing",remove:"Remove the station"},applyHeading:"Move the people from {name}",applyBody:"WisKey will remove {n} people's permissions from the station (and, when replacing, move them to the target station). This action changes the devices.",verifyHeading:"Check that {name} is cleared",verifyBody:"WisKey reads the device and checks that none of the system's users and cards are left on it.",removeHeading:"Remove station {name} from the system",removeBody:"WisKey will remove the station setting. To bring it back, it would have to be added again in the wizard.",approval:"Dual approval is on in WisKey. Arx cannot act as the second approver - the approval is given in WisKey itself.",doneJob:"The job was updated: {state}."},ye={healthTitle:"Integrity and data",integrity:"WisKey integrity check",integrityOk:"All stores loaded",integrityBad:"Store unavailable: {list}",noWrites:"The check wrote nothing.",components:{access:"People and permissions",panel_permissions:"Panel permissions",appearance_settings:"Appearance",profile_settings:"Groups and fields",schedule_journal:"Schedule log",hold_programs:"Hold-open programs",operations_center:"Operations centre",events:"Events",operations_validation:"Operations centre validation"},events:"Stored events",eventsLine:"{records} records · up to {limit} · about {rate} a day",demo:"WisKey's demo mode is available (no device and no writes).",capacityTitle:"Station capacity",capacityHint:"Users and cards against the limit the device reports. The forecast is an estimate based on the measured rate.",users:"Users",cards:"Cards",daysTo:"About {d} days to the limit",alerts:{unknown:"Unknown",stale:"Old measurement",at_limit:"At the limit",near_limit:"Near the limit",growth_to_limit:"Will reach the limit soon",observed:"OK"},metaTitle:"Station details and maintenance window",metaHint:"Area, owner, tags, alert thresholds and the maintenance window in which WisKey may write to the station.",zone:"Area",owner:"Owner",tags:"Tags (comma-separated)",thresholds:{offline:"Offline alert (seconds)",sync_stalled:"Sync stalled (seconds)",event_gap:"Event gap (seconds)"},windowOn:"Limit writes to the maintenance window",days:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],dayNames:"Days",start:"From",end:"Until",timezone:"Time zone",saveMeta:"Save",metaHeading:"Save the details of station {name}",metaBody:"Saved in WisKey's operations centre. No device changes.",changeTitle:"Change a setting on several stations",changeHint:`WisKey reads each station, shows before and after, and writes only after confirmation. "Now" writes immediately; "In the maintenance window" adds it to a queue that WisKey runs in each station's window.`,stations:"Stations (up to 12)",door:"Door",mode:"When",modeNow:"Now",modeWindow:"In the maintenance window",preview:"Preview",previewEmpty:"No station can be changed.",apply:"Apply",enqueue:"Add to the queue",applyHeading:"Apply the change to {n} stations",applyBody:"WisKey will write the changed fields to each station and read them back. Each station gets its own result.",enqueueHeading:"Schedule the change for {n} stations",enqueueBody:"WisKey will write to each station within its maintenance window. Progress appears in the queue below.",receipts:"Results by station",receiptOk:"Written and verified",receiptFail:"Failed ({code})",partial:"Some stations failed - check each station separately.",queueTitle:"Maintenance queue",noJobs:"The queue is empty.",jobStates:{queued:"Queued",awaiting_approval:"Awaiting approval",rejected:"Rejected",cancelled:"Cancelled",verified:"Completed",completed_with_errors:"Completed with errors",expired:"Expired",unknown:"Unknown"},rowStates:{pending:"Pending",writing:"Writing",verified:"Verified",failed:"Failed",uncertain:"Uncertain",cancelled:"Cancelled",unknown:"Unknown"},cancelJob:"Cancel",cancelHeading:"Cancel the maintenance job",cancelBody:"Stations not yet written will not be written. Stations already written stay as they are.",retentionTitle:"Event retention",retentionHint:"How long and how many records WisKey keeps. The preview shows how many records will be deleted - deletion happens only after typed confirmation.",retDays:"Days (1-365)",retCount:"Records (100-20000)",retMb:"Size (MB, 0.25-24)",retPreview:"How much will be deleted?",retRemoved:"{removed} of {before} records will be deleted.",retApply:"Apply the policy",retHeading:"Apply the event retention policy",retBody:"{removed} event records will be permanently deleted from WisKey.",webhookTitle:"Event delivery (webhook)",webhookHint:"WisKey sends signed events to an https address. The signing key is shown once per request and is not stored in Arx.",webhookOn:"Delivery on",url:"Address (https)",kinds:{access_event:"Entry events",security_denied:"Denied entries",configuration_result:"Settings change results"},saveWebhook:"Save",webhookHeading:"Save the webhook",webhookBody:"WisKey will start or stop sending to this address immediately.",showKey:"Show the signing key",keyHeading:"Show the signing key",keyBody:"The key will be shown here once. Copy it to the webhook receiver; Arx does not store it.",keyShown:"Signing key (shown once):",hideKey:"Hide",invalid:{url:"An https address only, without parameters",kinds:"Choose at least one type",days:"Choose at least one day",start:"Invalid time",end:"The end time must be after the start",timezone:"Invalid time zone"},ioTitle:"Configuration export and import",ioHint:"The file holds the station details and the message templates only - no people, permissions, keys or addresses.",export:"Export to a file",importLabel:"Configuration file to import",mapTo:"Which station here?",importPreview:"Check the file",importApply:"Import",importHeading:"Import the configuration",importBody:"The details of {n} stations will be replaced, and all WisKey message templates will be replaced with the templates in the file ({t}).",imported:"The configuration was imported ({n} stations).",saved:"Saved."},V=$e(["en"])==="en",d=V?me:ce,v=V?ve:pe,l=V?fe:he,o=V?ye:ue;ke("i18n/wiskey-installer",{he:{installer:ce,technical:pe,lifecycle:he,platform:ue},en:{installer:me,technical:ve,lifecycle:fe,platform:ye}});var gt=Object.defineProperty,wt=Object.getOwnPropertyDescriptor,I=(e,t,s,i)=>{for(var a=i>1?void 0:i?wt(t,s):t,r=e.length-1,h;r>=0;r--)(h=e[r])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&gt(t,s,a),a};let K=class extends R{constructor(){super(...arguments),this.request=null,this.typed="",this.busy=!1,this.elapsed=0,this.outcome=null,this.timer=null}disconnectedCallback(){super.disconnectedCallback(),this.stopTimer()}updated(e){e.has("request")&&this.request&&(this.typed="",this.outcome=null,this.busy=!1,this.elapsed=0)}stopTimer(){this.timer!==null&&window.clearInterval(this.timer),this.timer=null}close(){this.busy||(this.request=null,this.dispatchEvent(new CustomEvent("closed",{bubbles:!0,composed:!0})))}get typedOk(){const e=this.request?.typed;if(!e)return!0;const t=i=>i.normalize("NFC").split(/\s+/).filter(Boolean).join(" "),s=this.wordKey;return s?xe(s,this.typed,null,t):t(this.typed)===t(e)}get wordKey(){const e=this.request;return e?.typed&&e.typedFixed?Se(e.typed):void 0}async send(){const e=this.request;if(!e||this.busy||!this.typedOk)return;this.busy=!0,this.outcome=null,this.elapsed=0;const t=Date.now();this.timer=window.setInterval(()=>this.elapsed=Math.floor((Date.now()-t)/1e3),1e3);try{const s=await e.send(e.typed?this.typed:void 0);this.stopTimer(),this.busy=!1,e.done?.(s),this.request=null,this.dispatchEvent(new CustomEvent("closed",{bubbles:!0,composed:!0}))}catch(s){this.stopTimer(),this.busy=!1,this.outcome=j(s),e.failed?.(this.outcome)}}outcomeLine(e){const t=e.status==="refused"||e.status==="not_sent"?"err":"warn",s=e.status==="refused"?f(d.result.refused,{code:e.code??""}):e.status==="not_sent"?f(d.result.not_sent,{message:e.message}):d.result.unknown;return n`<div class="msg ${t}" role="alert" data-outcome=${e.status}>
      ${s}${e.retryAfterS?n` ${f(d.result.retryIn,{s:Math.ceil(e.retryAfterS)})}`:c}
    </div>`}render(){const e=this.request,t=e?.maxSeconds??30,s=Math.min(100,Math.round(this.elapsed/t*100)),i=(a,r)=>a.show?a.show(r):r==null||r===""?d.none:String(r);return n`<sw-dialog ?open=${!!e} heading=${e?.heading??""} ?locked=${this.busy} @close=${()=>this.close()} data-installer-confirm>
      ${e?n`<div class="body">
            <div>${e.body}</div>
            ${e.extra?e.extra():c}
            ${e.diff&&e.diff.length?n`<table data-diff>
                  <thead><tr><th>${d.confirm.willChange}</th><th>${d.confirm.before}</th><th>${d.confirm.after}</th></tr></thead>
                  <tbody>
                    ${e.diff.map(a=>n`<tr ?data-changed=${a.changed} data-key=${a.key}><td>${a.label}</td><td>${i(a,a.before)}</td><td class="after">${i(a,a.after)}</td></tr>`)}
                  </tbody>
                </table>`:c}
            ${e.typed?n`<label class="typed">
                  <span>${d.confirm.typeToConfirm.split("{phrase}")[0]}<b dir="auto" data-phrase>${this.wordKey?Te(this.wordKey):e.typed}</b></span>
                  <input dir="auto" autocomplete="off" spellcheck="false" aria-label=${d.confirm.typedLabel} .value=${this.typed} ?disabled=${this.busy}
                    @input=${a=>this.typed=a.target.value} data-typed />
                </label>`:c}
            ${this.busy?n`<div class="wait" role="status" data-waiting>
                  <span>${f(d.confirm.sending,{s:this.elapsed,max:t})}</span>
                  <div class="bar" aria-hidden="true"><span style="inline-size:${s}%"></span></div>
                </div>`:c}
            ${this.outcome?this.outcomeLine(this.outcome):c}
            <div class="note">${d.confirm.once}</div>
          </div>`:c}
      <div slot="footer" class="actions">
        <sw-button variant=${e?.danger?"danger":"primary"} ?disabled=${this.busy||!this.typedOk||!!(this.outcome&&this.outcome.status==="unknown")}
          @click=${()=>void this.send()} data-confirm-send>${d.confirm.send}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>this.close()} data-confirm-cancel>${this.outcome?d.close:d.cancel}</sw-button>
      </div>
    </sw-dialog>`}};K.styles=[B,z`
      :host {
        display: contents;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: 12px;
        line-height: 1.5;
      }
      table {
        inline-size: 100%;
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
      }
      th,
      td {
        text-align: start;
        padding: 6px 8px;
        border-block-end: 1px solid var(--sw-border);
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      th {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-medium);
        font-size: var(--sw-fs-sm);
      }
      tr[data-changed] td.after {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      tr:not([data-changed]) td {
        color: var(--sw-text-3);
      }
      .typed {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .typed b {
        user-select: all;
        unicode-bidi: plaintext;
      }
      .typed input {
        font: inherit;
        min-block-size: 40px;
        padding: 0 10px;
        border: 1px solid var(--sw-border-strong, var(--sw-border));
        border-radius: var(--sw-r-md);
        background: var(--sw-surface);
        color: var(--sw-text);
      }
      .typed input:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: 1px;
      }
      .wait {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .bar {
        block-size: 4px;
        border-radius: 2px;
        background: var(--sw-surface-3);
        overflow: hidden;
      }
      .bar span {
        display: block;
        block-size: 100%;
        background: var(--sw-accent);
        transition: inline-size 1s linear;
      }
      .note {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
    `];I([J({attribute:!1})],K.prototype,"request",2);I([p()],K.prototype,"typed",2);I([p()],K.prototype,"busy",2);I([p()],K.prototype,"elapsed",2);I([p()],K.prototype,"outcome",2);K=I([A("wk-installer-confirm")],K);var bt=Object.defineProperty,$t=Object.getOwnPropertyDescriptor,E=(e,t,s,i)=>{for(var a=i>1?void 0:i?$t(t,s):t,r=e.length-1,h;r>=0;r--)(h=e[r])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&bt(t,s,a),a};const kt={kind:"iana",name:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"},u=d.clock;let C=class extends R{constructor(){super(...arguments),this.view=null,this.loadState="loading",this.loadError="",this.draft=null,this.confirm=null,this.flash=null,this.checks={},this.copySystem=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.view=await Ke();const e=this.view.settings.data;this.draft=e?{server:e.server??"",port:String(e.port??""),interval:String(e.interval??"")}:null,this.loadState="ready"}catch(e){this.loadState="error",this.loadError=e instanceof N?e.body.user_message:String(e)}}values(){return this.draft?{server:this.draft.server.trim().toLowerCase(),port:Number(this.draft.port),interval:Number(this.draft.interval)}:null}askSave(){const e=this.view?.settings.data,t=this.values();if(!e||!t||X(t).length)return;const s={server:u.server,port:u.port,interval:u.interval},i=U({server:e.server,port:e.port,interval:e.interval},t,["server","port","interval"]).map(a=>({...a,label:s[a.key]}));this.confirm={heading:u.saveHeading,body:u.settingsHint,diff:i,maxSeconds:10,send:()=>Pe(e.revision,t),done:()=>{this.flash={tone:"ok",text:d.result.completed},this.load()}}}askHost(){const e=this.view?.settings.data;!e||!this.view||(this.confirm={heading:u.hostApplyHeading,body:f(u.hostApplyBody,{server:e.server??""}),typed:this.view.host_typed_phrase,typedFixed:!0,danger:!0,maxSeconds:45,send:t=>ze(e.revision,t??""),done:()=>{this.flash={tone:"ok",text:f(u.hostApplied,{server:e.server??""})},this.load()}})}async check(e){this.checks={...this.checks,[e]:{busy:!0,clock:this.checks[e]?.clock??null,at:null,error:""}};try{const t=await He(e);this.checks={...this.checks,[e]:{busy:!1,clock:t.clock,at:t.fetched_at,error:""}}}catch(t){this.checks={...this.checks,[e]:{busy:!1,clock:null,at:null,error:t instanceof N?t.body.user_message:String(t)}}}}askSync(e){const t=this.view?.settings.data;t&&(this.copySystem=!1,this.confirm={heading:f(u.syncHeading,{name:e.name}),body:f(u.syncBody,{server:t.server??"",port:t.port??"",interval:t.interval??""}),typed:e.name,danger:!0,maxSeconds:55,extra:()=>n`<label class="opt"><input type="checkbox" .checked=${this.copySystem} @change=${s=>this.copySystem=s.target.checked} data-copy-system />
        <span>${u.copySystem}</span></label>`,send:s=>Re(e.id,t.revision,this.copySystem,s??""),done:s=>{const i=s.data,a=i.clock?.measurement.estimated_skew_seconds;this.flash={tone:i.clock_verified?"ok":"warn",text:f(u.syncResult,{verified:i.clock_verified?u.verified:u.notVerified,skew:a==null?d.none:f(u.skew,{s:a})})},this.check(e.id)}})}settingsCard(){const e=this.view.settings,t=e.data;if(!t||!this.draft)return n`<sw-card heading=${u.settingsTitle} data-clock-settings="error"><div class="msg err" role="alert">${f(u.sectionUnavailable,{message:e.error?.message??""})}</div></sw-card>`;const s=this.values(),i=X(s),a=Ae(U({server:t.server,port:t.port,interval:t.interval},s)),r=this.view.defaults,h=(m,y,T)=>n`<label class="f"><span>${y}</span>
        <input inputmode=${T} dir="ltr" .value=${this.draft[m]} aria-invalid=${i.includes(m)?"true":"false"} data-ntp=${m}
          @input=${q=>this.draft={...this.draft,[m]:q.target.value}} />
        ${i.includes(m)?n`<span class="field-error">${u.invalid[m]}</span>`:c}</label>`;return n`<sw-card heading=${u.settingsTitle} subheading=${f(u.revision,{r:t.revision})} data-clock-settings="ready">
      <div class="hint">${u.settingsHint}</div>
      <div class="form">${h("server",u.server,"text")}${h("port",u.port,"numeric")}${h("interval",u.interval,"numeric")}</div>
      <div class="hint">${f(u.defaults,r)}</div>
      <div class="foot"><sw-button variant="primary" ?disabled=${!a||i.length>0} @click=${()=>this.askSave()} data-clock-save>${u.save}</sw-button></div>
    </sw-card>`}hostCard(){const e=this.view.host,t=e.data,s=this.view.settings.data;if(!t)return n`<sw-card heading=${u.hostTitle} data-clock-host="error"><div class="msg err" role="alert">${f(u.sectionUnavailable,{message:e.error?.message??""})}</div></sw-card>`;const i=s?.port===123;return n`<sw-card heading=${u.hostTitle} data-clock-host="ready">
      <div class="check"><span>${t.supported?u.hostSupported:u.hostUnsupported}</span>
        <sw-badge kind=${t.supported?"live":"offline"} label=${t.supported?d.yes:d.no}></sw-badge></div>
      ${t.supported?n`<div class="check"><span>${t.synchronized?u.hostSynced:u.hostNotSynced}</span>
              <sw-badge kind=${t.synchronized?"live":"stale"} label=${t.synchronized?d.yes:d.no}></sw-badge></div>
            <div class="check"><span>${u.hostServers}</span><span class="val" dir="ltr">${t.config?.servers.join(", ")||d.none}</span></div>`:c}
      ${t.supported&&!i?n`<div class="hint">${u.hostApplyPort}</div>`:c}
      <div class="foot"><sw-button variant="secondary" ?disabled=${!t.supported||!i||!s} @click=${()=>this.askHost()} data-clock-host-apply>${u.hostApply}</sw-button></div>
    </sw-card>`}stationRow(e){const t=this.checks[e.id],s=t?.clock??e.clock,i=s?.skew_seconds??null,a=Me(i),r=this.view.settings.data;return n`<div class="st" data-station=${e.id} data-tone=${a}>
      <div class="name"><b dir="auto">${e.name}</b><span class="muted">${e.online?d.online:d.offline}</span></div>
      <div><span class="mlabel">${u.colSkew}</span><span class="tone-${a}">${i===null?u.noClock:f(u.skew,{s:i})}</span></div>
      <div><span class="mlabel">${u.colMode}</span>${s?.time_mode?u.modes[s.time_mode]??s.time_mode:d.none}</div>
      <div><span class="mlabel">${u.colChecked}</span><span class="muted">${s?.checked_at?de(s.checked_at,ne(),kt):d.none}</span>
        ${t?.error?n`<div class="field-error" role="alert">${t.error}</div>`:c}</div>
      <div class="acts">
        <sw-button size="sm" variant="ghost" ?disabled=${t?.busy} @click=${()=>void this.check(e.id)} data-clock-check>${u.check}</sw-button>
        <sw-button size="sm" variant="secondary" ?disabled=${!e.online||!r} @click=${()=>this.askSync(e)} data-clock-sync>${u.sync}</sw-button>
      </div>
    </div>`}stationsCard(){const e=this.view.stations;return n`<sw-card heading=${u.stationsTitle} data-clock-stations>
      <div class="hint">${u.stationsHint}</div>
      ${!e||e.length===0?n`<div class="hint">${u.noStations}</div>`:n`<div class="stations">
            <div class="st head" aria-hidden="true"><span>${u.colStation}</span><span>${u.colSkew}</span><span>${u.colMode}</span><span>${u.colChecked}</span><span></span></div>
            ${e.map(t=>this.stationRow(t))}
          </div>`}
    </sw-card>`}render(){return this.loadState==="loading"?n`<sw-state-panel state="loading" heading=${d.loading} compact data-clock="loading"></sw-state-panel>`:this.loadState==="error"||!this.view?n`<sw-state-panel state="error" heading=${d.errorTitle} hint=${this.loadError} actionLabel=${d.retry} @action=${()=>void this.load()} data-clock="error"></sw-state-panel>`:n`<div class="sections" data-clock="ready">
      ${this.view.feed!=="ready"?n`<div class="msg warn" role="status">${d.feedDown}</div>`:c}
      ${this.flash?n`<div class="msg ${this.flash.tone}" role=${this.flash.tone==="err"?"alert":"status"} data-flash>${this.flash.text}</div>`:c}
      ${this.settingsCard()}${this.hostCard()}${this.stationsCard()}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${()=>this.confirm=null}></wk-installer-confirm>`}};C.styles=[B,z`
      :host {
        display: block;
      }
      .form {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
      }
      @media (max-width: 640px) {
        .form {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
        .form label:first-child {
          grid-column: 1 / -1;
        }
      }
      label.f {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      label.f input {
        font: inherit;
        font-size: var(--sw-fs-md);
        min-block-size: 40px;
        padding: 0 10px;
        border: 1px solid var(--sw-border-strong, var(--sw-border));
        border-radius: var(--sw-r-md);
        background: var(--sw-surface);
        color: var(--sw-text);
        direction: ltr;
        text-align: start;
      }
      ${oe}
      .field-error {
        color: var(--sw-danger-text, var(--sw-err));
        font-size: var(--sw-fs-xs, var(--sw-fs-sm));
      }
      .stations {
        display: flex;
        flex-direction: column;
      }
      .st {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        padding: 10px 0;
        border-block-end: 1px solid var(--sw-border);
        font-variant-numeric: tabular-nums;
      }
      .st:last-child {
        border-block-end: 0;
      }
      .st.head {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
        padding-block: 4px;
      }
      .st .name {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .st .name b {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: var(--sw-fw-semibold);
      }
      .st .acts {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
      }
      .tone-ok {
        color: var(--sw-ok-text, var(--sw-text));
      }
      .tone-warn {
        color: var(--sw-warn-text, var(--sw-text));
      }
      .tone-err {
        color: var(--sw-danger-text, var(--sw-text));
      }
      ${re}
      .mlabel {
        display: none;
      }
      @media (max-width: 640px) {
        .st.head {
          display: none;
        }
        .st {
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          row-gap: 6px;
        }
        .st .name {
          grid-column: 1 / -1;
        }
        .st .acts {
          grid-column: 1 / -1;
          justify-content: flex-start;
        }
        .mlabel {
          display: inline;
          color: var(--sw-text-3);
          font-size: var(--sw-fs-sm);
          margin-inline-end: 4px;
        }
      }
      ${le}
      .opt input {
        margin-block-start: 4px;
        inline-size: 18px;
        block-size: 18px;
      }
    `];E([p()],C.prototype,"view",2);E([p()],C.prototype,"loadState",2);E([p()],C.prototype,"loadError",2);E([p()],C.prototype,"draft",2);E([p()],C.prototype,"confirm",2);E([p()],C.prototype,"flash",2);E([p()],C.prototype,"checks",2);E([p()],C.prototype,"copySystem",2);C=E([A("installer-clock")],C);const Y=z`
  ${We}
  label.f input,
  label.f select,
  label.f textarea,
  select.pick {
    font: inherit;
    font-size: var(--sw-fs-md);
    min-block-size: 40px;
    padding: 0 10px;
    border: 1px solid var(--sw-border-strong, var(--sw-border));
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    color: var(--sw-text);
    min-inline-size: 0;
  }
  label.f textarea {
    padding: 8px 10px;
    min-block-size: 120px;
    font-family: var(--sw-font-mono, ui-monospace, monospace);
    font-size: var(--sw-fs-sm);
  }
  label.f input:focus-visible,
  label.f select:focus-visible,
  label.f textarea:focus-visible,
  select.pick:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  label.f input:disabled,
  label.f select:disabled {
    background: var(--sw-surface-2, var(--sw-surface-3));
    color: var(--sw-text-3);
    cursor: not-allowed;
  }
  ${oe}
  .field-error {
    color: var(--sw-danger-text, var(--sw-err));
    font-size: var(--sw-fs-sm);
  }
  ${re}
  .pickrow {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
  }
  .pickrow label.f {
    flex: 1 1 220px;
  }
  .grid2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
    gap: 12px;
  }
  ${le}
  .opt input {
    margin-block-start: 4px;
    inline-size: 18px;
    block-size: 18px;
    accent-color: var(--sw-accent);
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .list {
    display: flex;
    flex-direction: column;
  }
  .list > .item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 0;
    border-block-end: 1px solid var(--sw-border);
    font-variant-numeric: tabular-nums;
  }
  .list > .item:last-child {
    border-block-end: 0;
  }
  .item .grow {
    flex: 1 1 200px;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .item .grow b {
    font-weight: var(--sw-fw-semibold);
    overflow-wrap: anywhere;
  }
  details > summary {
    cursor: pointer;
    color: var(--sw-text-2);
    padding-block: 6px;
  }
`;var _t=Object.defineProperty,xt=Object.getOwnPropertyDescriptor,O=(e,t,s,i)=>{for(var a=i>1?void 0:i?xt(t,s):t,r=e.length-1,h;r>=0;r--)(h=e[r])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&_t(t,s,a),a};const St={kind:"iana",name:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"},Tt=e=>t=>t==null?d.none:e==="relayReverseEnabled"?t?v.relayOn:v.relayOff:String(t);let W=class extends R{constructor(){super(...arguments),this.stations=[],this.stationId="",this.view=null,this.loading=!1,this.error="",this.drafts={},this.confirm=null,this.flash=null}async load(e=!1){if(this.stationId){this.loading=!0,this.error="";try{this.view=await De(this.stationId,e),this.drafts=Object.fromEntries(this.view.report.doors.filter(t=>t.door!==null&&t.values).map(t=>[t.door,{...t.values}]))}catch(t){this.view=null,this.error=t instanceof N?t.body.user_message:String(t)}finally{this.loading=!1}}}pick(e){this.stationId=e,this.view=null,this.flash=null,this.load()}setDraft(e,t,s){this.drafts={...this.drafts,[e]:{...this.drafts[e],[t]:s}}}askSave(e){const t=this.view;if(!t||e.door===null||!e.values)return;const s=e.door,i=e.values,a=ee(i,this.drafts[s]??{}),r=je(a,t.dangerous_fields),h=t.name??t.station_id;this.confirm={heading:f(v.saveHeading,{door:f(v.door,{n:s}),name:h}),body:r?`${v.saveBody} ${v.relayWarn}`:v.saveBody,diff:U(i,{...i,...a},D).map(m=>({...m,label:v.fields[m.key],show:Tt(m.key)})),typed:r?t.typed_phrase??h:void 0,danger:r,maxSeconds:40,send:m=>Le(t.station_id,s,i,a,m),done:m=>{const y=m.data,T=t.report.doors.map(q=>q.door===s?y:q);this.view={...t,report:{...t.report,doors:T}},this.drafts={...this.drafts,[s]:{...y.values??{}}},this.flash={tone:"ok",text:v.saved}}}}doorCard(e){const t=this.view,s=e.door??0;if(e.error||!e.values)return n`<sw-card heading=${f(v.door,{n:s})} data-door=${s}><div class="msg err" role="alert">${f(v.doorError,{code:e.error??""})}</div></sw-card>`;const i=t.editable_doors.includes(s)&&t.online!==!1,a=this.drafts[s]??e.values,r=qe(a,e.constraints),h=ee(e.values,a),m=y=>{const T=e.constraints?.[y];return!T||T.type==="boolean"?"":f(y==="doorName"?v.lengthBounds:v.bounds,{min:T.min,max:T.max})};return n`<sw-card heading=${f(v.door,{n:s})} data-door=${s} data-editable=${i?"true":"false"}>
      ${t.editable_doors.includes(s)?c:n`<div class="hint">${v.notMapped}</div>`}
      <div class="grid2">
        ${e.values.doorName!==void 0?n`<label class="f"><span>${v.fields.doorName}</span>
              <input dir="auto" .value=${String(a.doorName??"")} ?disabled=${!i} aria-invalid=${r.includes("doorName")?"true":"false"} data-field="doorName"
                @input=${y=>this.setDraft(s,"doorName",y.target.value)} />
              <span class="muted">${m("doorName")}</span>${r.includes("doorName")?n`<span class="field-error">${v.invalid}</span>`:c}</label>`:c}
        ${e.values.openDuration!==void 0?n`<label class="f"><span>${v.fields.openDuration}</span>
              <input inputmode="numeric" dir="ltr" .value=${String(a.openDuration??"")} ?disabled=${!i} aria-invalid=${r.includes("openDuration")?"true":"false"} data-field="openDuration"
                @input=${y=>{const T=y.target.value.trim();this.setDraft(s,"openDuration",T===""?NaN:Number(T))}} />
              <span class="muted">${m("openDuration")}</span>${r.includes("openDuration")?n`<span class="field-error">${v.invalid}</span>`:c}</label>`:c}
      </div>
      ${e.values.relayReverseEnabled!==void 0?n`<div class="relay">
            <label class="opt"><input type="checkbox" .checked=${!!a.relayReverseEnabled} ?disabled=${!i} data-field="relayReverseEnabled"
              @change=${y=>this.setDraft(s,"relayReverseEnabled",y.target.checked)} />
              <span>${v.fields.relayReverseEnabled}: <b>${a.relayReverseEnabled?v.relayOn:v.relayOff}</b></span></label>
            ${a.relayReverseEnabled!==e.values.relayReverseEnabled?n`<div class="msg warn" role="status">${v.relayWarn}</div>`:c}
          </div>`:c}
      ${i?n`<div class="foot"><sw-button variant="primary" ?disabled=${Object.keys(h).length===0||r.length>0} @click=${()=>this.askSave(e)} data-door-save>${v.save}</sw-button></div>`:c}
    </sw-card>`}factsCard(){const e=this.view.report,t=e.passwords;return n`<sw-card heading=${v.relays} data-relays>
        ${e.relay_selection.length?n`<div class="list">${e.relay_selection.map(s=>n`<div class="item"><span>${f(v.relayRow,{physical:s.physical_index,api:s.api_id})}${s.name?n` · <b dir="auto">${s.name}</b>`:c}</span></div>`)}</div>`:n`<div class="hint">${v.noRelays}</div>`}
      </sw-card>
      <sw-card heading=${v.passwords} data-passwords>
        ${t?n`<div class="check"><span>${v.pinState[t.public_pin_state??"unknown"]??t.public_pin_state}</span></div>
              ${Object.entries(v.passwordNames).map(([s,i])=>t.states[s]===null||t.states[s]===void 0?c:n`<div class="check"><span>${i}</span><span class="val">${t.states[s]?v.set:v.unset}</span></div>`)}`:n`<div class="hint">${e.password_error?f(v.doorError,{code:e.password_error}):d.none}</div>`}
      </sw-card>
      <sw-card heading=${v.features} data-features>
        <details><summary>${e.features.filter(s=>s.supported).length} / ${e.features.length}</summary>
          <div class="facts">${e.features.map(s=>n`<sw-badge kind=${s.supported?"live":"neutral"} label=${s.name}></sw-badge>`)}</div>
        </details>
      </sw-card>`}render(){const e=this.view;return n`<div class="sections" data-technical=${this.loading?"loading":e?"ready":this.error?"error":"empty"}>
      <sw-card>
        <div class="pickrow">
          <label class="f"><span>${v.pick}</span>
            <select class="pick" .value=${this.stationId} @change=${t=>this.pick(t.target.value)} data-station-pick>
              <option value="" ?selected=${!this.stationId}>—</option>
              ${this.stations.map(t=>n`<option value=${t.id} ?selected=${t.id===this.stationId}>${t.name}${t.online?"":` (${d.offline})`}</option>`)}
            </select></label>
          <sw-button variant="secondary" ?disabled=${!this.stationId||this.loading} @click=${()=>void this.load(!0)} data-reread>${e?v.reread:v.read}</sw-button>
        </div>
        <div class="hint">${e?.fetched_at?f(v.readAt,{at:de(e.report.checked_at??e.fetched_at,ne(),St)}):v.pickHint}</div>
      </sw-card>
      ${this.flash?n`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>`:c}
      ${this.loading?n`<sw-state-panel state="loading" heading=${d.loading} compact></sw-state-panel>`:c}
      ${!this.loading&&this.error?n`<sw-state-panel state="error" heading=${d.errorTitle} hint=${this.error} actionLabel=${d.retry} @action=${()=>void this.load(!0)} compact></sw-state-panel>`:c}
      ${!this.loading&&!e&&!this.error?n`<sw-state-panel icon="door" state="empty" heading=${v.empty} compact></sw-state-panel>`:c}
      ${!this.loading&&e?n`${e.online===!1?n`<div class="msg warn" role="status">${v.offline}</div>`:c}
            ${e.report.doors.map(t=>this.doorCard(t))}${this.factsCard()}`:c}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${()=>this.confirm=null}></wk-installer-confirm>`}};W.styles=[B,Y,z`
      :host {
        display: block;
      }
      .door-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .relay {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
    `];O([J({attribute:!1})],W.prototype,"stations",2);O([p()],W.prototype,"stationId",2);O([p()],W.prototype,"view",2);O([p()],W.prototype,"loading",2);O([p()],W.prototype,"error",2);O([p()],W.prototype,"drafts",2);O([p()],W.prototype,"confirm",2);O([p()],W.prototype,"flash",2);W=O([A("installer-technical")],W);var Ct=Object.defineProperty,Wt=Object.getOwnPropertyDescriptor,x=(e,t,s,i)=>{for(var a=i>1?void 0:i?Wt(t,s):t,r=e.length-1,h;r>=0;r--)(h=e[r])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&Ct(t,s,a),a};let b=class extends R{constructor(){super(...arguments),this.stations=[],this.list=null,this.listError="",this.flow=null,this.form={},this.busy=!1,this.stepError=null,this.reStation="",this.source="",this.target="",this.impact=null,this.reviewing=!1,this.reviewError="",this.confirm=null,this.flash=null}connectedCallback(){super.connectedCallback(),this.loadJobs()}async loadJobs(){try{this.list=await Ge(),this.listError=""}catch(e){this.listError=e instanceof N?e.body.user_message:String(e)}}async begin(e){this.busy=!0,this.stepError=null,this.flash=null;try{const t=await Fe(e,e==="reconfigure"?this.reStation:void 0);this.adopt(t.data,e)}catch(t){this.stepError=j(t)}finally{this.busy=!1}}adopt(e,t){if(e.type==="form"){const s=e.defaults;this.form=e.step_id==="user"||e.step_id==="reconfigure"?{name:String(s.name??""),host:String(s.host??""),username:String(s.username??"admin"),password:"",scheme:String(s.scheme??"http"),port:String(s.port??80),verify_ssl:s.verify_ssl!==!1,rtsp_port:String(s.rtsp_port??554),...this.flow?.step_id===e.step_id?{...this.form,password:""}:{}}:e.step_id==="locks"?{mode:String(e.choices.mode?.[0]??"camera_only"),lock_name:String(s.lock_name??"")}:e.step_id==="mapping"?{api_id:String(e.choices.api_id?.[0]??"")}:e.step_id==="confirm_mapping"?{result:"released_and_returned"}:{},this.flow={...e,kind:t};return}this.flow=null,this.form={},e.type==="create_entry"?this.flash={tone:"ok",text:f(l.created,{title:e.entry?.title??""})}:e.type==="abort"&&e.reason==="reconfigure_successful"?this.flash={tone:"ok",text:l.reconfigured}:e.type==="abort"&&(this.flash={tone:"warn",text:f(l.aborted,{reason:l.abortReasons[e.reason??""]??e.reason??""})}),this.loadJobs()}stepInput(){const t=this.flow.step_id;return t==="user"||t==="reconfigure"?Z(this.form,t):t==="locks"?{mode:this.form.mode,...this.form.mode!=="camera_only"||this.form.lock_name?{lock_name:String(this.form.lock_name??"")}:{}}:t==="mapping"?{api_id:Number(this.form.api_id),test_unlock:!0}:t==="confirm_mapping"?{result:this.form.result}:{}}async sendStep(e){const t=this.flow,s=await Je(t.flow_id,t.step_id,this.stepInput(),e);return this.form={...this.form,password:""},this.adopt(s.data,t.kind),s}async next(){const e=this.flow;if(!(!e||!e.step_id)){if(e.step_id==="mapping"){this.confirm={heading:l.pulseHeading,body:l.pulseWarn,typed:Ue,typedFixed:!0,danger:!0,maxSeconds:55,send:t=>this.sendStep(t)};return}if(Ze.includes(e.step_id)){this.confirm={heading:l.commitHeading,body:l.commitBody,maxSeconds:55,send:()=>this.sendStep()};return}this.busy=!0,this.stepError=null;try{await this.sendStep()}catch(t){this.form={...this.form,password:""},this.stepError=j(t)}finally{this.busy=!1}}}async cancelFlow(){const e=this.flow;if(e){this.busy=!0;try{await Ve(e.flow_id),this.flash={tone:"warn",text:l.cancelled}}catch(t){this.stepError=j(t)}finally{this.flow=null,this.form={},this.busy=!1}}}field(e,t="text",s=""){const i=this.flow&&(this.flow.step_id==="user"||this.flow.step_id==="reconfigure")?te(Z(this.form,this.flow.step_id),this.flow.step_id):[],a=String(this.form[e]??"")!==""||e==="password";return n`<label class="f"><span>${l.fields[e]}</span>
      <input type=${t==="number"?"text":t} inputmode=${t==="number"?"numeric":"text"} dir=${e==="name"?"auto":"ltr"}
        autocomplete=${t==="password"?"new-password":"off"} spellcheck="false" .value=${String(this.form[e]??"")} ?disabled=${this.busy}
        aria-invalid=${a&&i.includes(e)&&!(e==="password"&&!this.form.password)?"true":"false"} data-flow-field=${e}
        @input=${r=>this.form={...this.form,[e]:r.target.value}} />
      ${s?n`<span class="muted">${s}</span>`:c}</label>`}wizard(){const e=this.flow,t=e.step_id??"other",s=e.kind==="add"?["user","confirm_device","locks","mapping","confirm_mapping"]:["reconfigure","confirm_device","locks","mapping","confirm_mapping"],i=Object.values(e.errors??{});let a=n``,r=!this.busy;if(t==="user"||t==="reconfigure"){const m=te(Z(this.form,t),t);r=r&&m.length===0,a=n`<div class="grid2">
          ${this.field("name")}${this.field("host")}${this.field("username")}${this.field("password","password",t==="reconfigure"?l.passwordKeep:"")}
          <label class="f"><span>${l.fields.scheme}</span>
            <select .value=${String(this.form.scheme)} ?disabled=${this.busy} data-flow-field="scheme" @change=${y=>this.form={...this.form,scheme:y.target.value}}>
              ${(e.choices.scheme??["http","https"]).map(y=>n`<option value=${String(y)} ?selected=${String(y)===this.form.scheme}>${y}</option>`)}
            </select></label>
          ${this.field("port","number")}${this.field("rtsp_port","number")}
        </div>
        <label class="opt"><input type="checkbox" .checked=${this.form.verify_ssl===!0} ?disabled=${this.busy} data-flow-field="verify_ssl"
          @change=${y=>this.form={...this.form,verify_ssl:y.target.checked}} /><span>${l.fields.verify_ssl}</span></label>`}else t==="confirm_device"?a=n`<div class="hint">${l.device}</div>
        <div class="check"><span>${l.model}</span><span class="val" dir="ltr">${e.device?.model??d.none}</span></div>
        <div class="check"><span>${l.firmware}</span><span class="val" dir="ltr">${e.device?.firmware??d.none}</span></div>
        <div class="check"><span>${l.serial}</span><span class="val" dir="ltr">${e.device?.serial??d.none}</span></div>`:t==="locks"?a=n`<div class="radios" role="radiogroup" aria-label=${l.fields.mode}>
          ${(e.choices.mode??["camera_only"]).map(m=>n`<label class="opt"><input type="radio" name="mode" .checked=${this.form.mode===m} ?disabled=${this.busy} data-flow-mode=${String(m)}
              @change=${()=>this.form={...this.form,mode:String(m)}} /><span>${l.modes[String(m)]??m}</span></label>`)}
        </div>
        ${this.form.mode!=="camera_only"?this.field("lock_name"):c}`:t==="mapping"?a=n`<div class="msg warn" role="status">${l.pulseWarn}</div>
        <label class="f"><span>${l.fields.api_id}</span>
          <select .value=${String(this.form.api_id)} ?disabled=${this.busy} data-flow-field="api_id" @change=${m=>this.form={...this.form,api_id:m.target.value}}>
            ${(e.choices.api_id??[]).map(m=>n`<option value=${String(m)} ?selected=${String(m)===this.form.api_id}>${m}</option>`)}
          </select></label>`:t==="confirm_mapping"&&(a=n`<div class="radios" role="radiogroup" aria-label=${l.fields.result}>
        ${(e.choices.result??[]).map(m=>n`<label class="opt"><input type="radio" name="result" .checked=${this.form.result===m} ?disabled=${this.busy} data-flow-result=${String(m)}
            @change=${()=>this.form={...this.form,result:String(m)}} /><span>${l.results[String(m)]??m}</span></label>`)}
      </div>`);const h=t==="confirm_device"?l.deviceConfirm:t==="mapping"?l.pulseButton:l.next;return n`<sw-card heading=${l.wizardTitle[e.kind]} data-wizard=${t}>
      <div class="wizard-steps" aria-label=${l.wizardTitle[e.kind]}>
        ${s.map((m,y)=>n`<span aria-current=${m===t?"step":"false"}>${y+1}. ${l.steps[m]}</span>`)}
      </div>
      ${i.length?n`<div class="msg err" role="alert" data-flow-error>${i.map(m=>l.flowErrors[m]??l.flowErrors.other).join(" · ")}</div>`:c}
      ${a}
      ${this.busy?n`<div class="hint" role="status" data-flow-busy>${l.checking}</div>`:c}
      ${this.stepError?this.outcomeLine(this.stepError):c}
      <div class="foot">
        <sw-button variant=${t==="mapping"?"danger":"primary"} ?disabled=${!r} @click=${()=>void this.next()} data-flow-next>${h}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>void this.cancelFlow()} data-flow-cancel>${l.cancel}</sw-button>
      </div>
    </sw-card>`}outcomeLine(e){const t=e.status==="refused"?f(d.result.refused,{code:e.code??""}):e.status==="not_sent"?f(d.result.not_sent,{message:e.message}):d.result.unknown;return n`<div class="msg ${e.status==="unknown"?"warn":"err"}" role="alert" data-outcome=${e.status}>${t}</div>`}async review(){this.reviewing=!0,this.reviewError="",this.impact=null;try{this.impact=(await Ye(this.source,this.target)).review}catch(e){this.reviewError=e instanceof N?e.body.user_message:String(e)}finally{this.reviewing=!1}}name(e){return this.stations.find(t=>t.id===e)?.name??e??""}askPrepare(){const e=this.name(this.source);this.confirm={heading:f(l.prepareHeading,{name:e}),body:l.prepareBody,maxSeconds:55,send:()=>Qe(this.source,this.target||void 0),done:()=>{this.impact=null,this.loadJobs()}}}askJob(e){const t=se(e);if(!t)return;const s=e.source_name??e.source_id??"",i={apply:l.applyHeading,verify:l.verifyHeading,remove:l.removeHeading}[t],a={apply:f(l.applyBody,{n:e.affected_people??0}),verify:l.verifyBody,remove:l.removeBody}[t];this.confirm={heading:f(i,{name:s}),body:a,typed:t==="verify"?void 0:s,danger:t!=="verify",maxSeconds:55,send:r=>Xe(e,t,r),done:r=>{const h=r.data.job.state??"unknown";this.flash={tone:"ok",text:f(l.doneJob,{state:l.states[h]??h})},this.loadJobs()}}}impactView(e){const t=(s,i)=>n`<div class="num"><span class="muted">${s}</span><b>${i??d.none}</b></div>`;return n`<div data-impact>
      <div class="nums">${t(l.people,e.affected_people)}${t(l.bindings,e.known_bindings)}${t(l.unknownOwners,e.unknown_owners)}${t(l.holdPrograms,e.hold_programs)}${t(l.nativeSchedules,e.native_schedules)}</div>
      ${e.blockers.length?n`<div class="msg err" role="alert" data-blockers>${l.blockers}: ${e.blockers.map(s=>l.blockerText[s]??l.blockerText.other).join(" · ")}</div>`:n`<div class="msg ok" role="status">${l.noBlockers}</div>`}
      <div class="foot"><sw-button variant="primary" ?disabled=${e.blockers.length>0} @click=${()=>this.askPrepare()} data-prepare>${l.prepare}</sw-button></div>
    </div>`}jobRow(e){const t=tt(e.state),s=se(e);return n`<div class="item" data-job=${e.id??""} data-state=${e.state??""}>
      <div class="grow">
        <b dir="auto">${e.source_name??e.source_id}${e.target_name?n` ← <span dir="auto">${e.target_name}</span>`:c}</b>
        <div class="stepper" aria-hidden="true">${[0,1,2,3].map(i=>n`<i ?data-on=${t>=i}></i>`)}</div>
        <div class="stepper-labels" aria-hidden="true">${l.stepLabels.map(i=>n`<span>${i}</span>`)}</div>
        <span class="muted">${l.states[e.state??"unknown"]??e.state}${e.affected_people!==null?` · ${l.people}: ${e.affected_people}`:""}</span>
        ${e.require_approval?n`<span class="muted">${l.approval}</span>`:c}
      </div>
      ${s?n`<sw-button size="sm" variant=${s==="verify"?"secondary":"danger"} @click=${()=>this.askJob(e)} data-job-action=${s}>${l.actions[s]}</sw-button>`:c}
    </div>`}render(){const e=this.list?.stations??this.stations;return n`<div class="sections" data-lifecycle>
      ${this.flash?n`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>`:c}
      ${this.flow?this.wizard():n`<sw-card heading=${l.addTitle} data-add>
              <div class="hint">${l.addHint}</div>
              ${this.stepError?this.outcomeLine(this.stepError):c}
              <div class="foot"><sw-button variant="primary" ?disabled=${this.busy} @click=${()=>void this.begin("add")} data-add-start>${l.addStart}</sw-button></div>
            </sw-card>
            <sw-card heading=${l.reTitle} data-reconfigure>
              <div class="hint">${l.reHint}</div>
              <div class="pickrow">
                <label class="f"><span>${l.station}</span>
                  <select class="pick" @change=${t=>this.reStation=t.target.value} data-re-pick>
                    <option value="" ?selected=${!this.reStation}>—</option>
                    ${e.map(t=>n`<option value=${t.id} ?selected=${t.id===this.reStation}>${t.name}</option>`)}
                  </select></label>
                <sw-button variant="secondary" ?disabled=${!this.reStation||this.busy} @click=${()=>void this.begin("reconfigure")} data-re-start>${l.reStart}</sw-button>
              </div>
            </sw-card>`}
      <sw-card heading=${l.removeTitle} data-remove>
        <div class="hint">${l.removeHint}</div>
        <div class="pickrow">
          <label class="f"><span>${l.source}</span>
            <select class="pick" @change=${t=>(this.source=t.target.value,this.impact=null)} data-source-pick>
              <option value="" ?selected=${!this.source}>—</option>
              ${e.map(t=>n`<option value=${t.id} ?selected=${t.id===this.source}>${t.name}</option>`)}
            </select></label>
          <label class="f"><span>${l.target}</span>
            <select class="pick" @change=${t=>(this.target=t.target.value,this.impact=null)} data-target-pick>
              <option value="" ?selected=${!this.target}>${l.noTarget}</option>
              ${e.filter(t=>t.id!==this.source).map(t=>n`<option value=${t.id} ?selected=${t.id===this.target}>${t.name}</option>`)}
            </select></label>
          <sw-button variant="secondary" ?disabled=${!this.source||this.reviewing} @click=${()=>void this.review()} data-review>${l.review}</sw-button>
        </div>
        ${this.reviewing?n`<sw-state-panel state="loading" heading=${d.loading} compact></sw-state-panel>`:c}
        ${this.reviewError?n`<div class="msg err" role="alert" data-review-error>${this.reviewError}</div>`:c}
        ${this.impact?this.impactView(this.impact):c}
      </sw-card>
      <sw-card heading=${l.jobs} data-jobs>
        ${this.listError?n`<div class="msg err" role="alert">${this.listError}</div>`:c}
        ${this.list&&this.list.records.length===0?n`<div class="hint">${l.noJobs}</div>`:c}
        ${this.list&&this.list.records.length?n`<div class="list">${this.list.records.map(t=>this.jobRow(t))}</div>`:c}
        <div class="foot"><sw-button variant="ghost" size="sm" @click=${()=>void this.loadJobs()} data-jobs-refresh>${l.refresh}</sw-button></div>
      </sw-card>
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${()=>this.confirm=null}></wk-installer-confirm>`}};b.styles=[B,Y,z`
      :host {
        display: block;
      }
      .wizard-steps {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-block-end: 8px;
      }
      .wizard-steps span {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-3);
      }
      .wizard-steps span[aria-current='step'] {
        color: var(--sw-accent-text);
        font-weight: var(--sw-fw-semibold);
      }
      .radios {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .stepper {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px;
        margin-block: 6px;
      }
      .stepper i {
        display: block;
        block-size: 4px;
        border-radius: 2px;
        background: var(--sw-surface-3);
      }
      .stepper i[data-on] {
        background: var(--sw-accent);
      }
      .stepper-labels {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px;
        font-size: var(--sw-fs-xs, var(--sw-fs-sm));
        color: var(--sw-text-3);
      }
      .nums {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
        gap: 8px;
      }
      .num {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
      }
      .num b {
        font-size: var(--sw-fs-lg, var(--sw-fs-md));
        font-variant-numeric: tabular-nums;
      }
    `];x([J({attribute:!1})],b.prototype,"stations",2);x([p()],b.prototype,"list",2);x([p()],b.prototype,"listError",2);x([p()],b.prototype,"flow",2);x([p()],b.prototype,"form",2);x([p()],b.prototype,"busy",2);x([p()],b.prototype,"stepError",2);x([p()],b.prototype,"reStation",2);x([p()],b.prototype,"source",2);x([p()],b.prototype,"target",2);x([p()],b.prototype,"impact",2);x([p()],b.prototype,"reviewing",2);x([p()],b.prototype,"reviewError",2);x([p()],b.prototype,"confirm",2);x([p()],b.prototype,"flash",2);b=x([A("installer-lifecycle")],b);var Nt=Object.defineProperty,Et=Object.getOwnPropertyDescriptor,w=(e,t,s,i)=>{for(var a=i>1?void 0:i?Et(t,s):t,r=e.length-1,h;r>=0;r--)(h=e[r])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&Nt(t,s,a),a};const ae=()=>({zone:"",owner:"",tags:[],thresholds:{offline:600,sync_stalled:900,event_gap:600},window:{enabled:!1,days:[0,1,2,3,4,5,6],start:"00:00",end:"23:59",timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}}),ie=1048576,M=e=>e instanceof N?e.body.user_message:String(e);let g=class extends R{constructor(){super(...arguments),this.view=null,this.loadState="loading",this.loadError="",this.confirm=null,this.flash=null,this.metaStation="",this.meta=null,this.tagsText="",this.chosen=new Set,this.door=1,this.changeMode="config",this.changes={},this.preview=null,this.previewError="",this.receipts=null,this.ret={days:"30",count:"5000",mb:"16"},this.retPreview=null,this.hook=null,this.key="",this.importContent="",this.importMap={},this.importReview=null,this.importError=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.view=await st();const e=this.view.platform.data;e&&(this.hook={...e.webhook,kinds:[...e.webhook.kinds]},e.retention.days!==null&&(this.ret={days:String(e.retention.days),count:String(e.retention.count),mb:String(Math.round((e.retention.bytes??0)/ie*100)/100)})),this.metaStation&&this.pickMeta(this.metaStation),this.loadState="ready"}catch(e){this.loadState="error",this.loadError=M(e)}}get stations(){return this.view?.stations??[]}nameOf(e){return this.stations.find(t=>t.id===e)?.name??e??""}section(e,t,s,i){return e.data?n`<sw-card heading=${t} data-part=${s} data-state="ready">${i(e.data)}</sw-card>`:n`<sw-card heading=${t} data-part=${s} data-state="error"><div class="msg err" role="alert">${f(d.clock.sectionUnavailable,{message:e.error?.message??""})}</div></sw-card>`}healthCard(){const e=this.view;return this.section(e.integrity,o.healthTitle,"health",t=>{const s=t.checks.filter(a=>a.state!=="available"),i=e.platform.data?.event_usage;return n`<div class="check"><span>${o.integrity}</span>
          <sw-badge kind=${s.length?"error":"live"} label=${s.length?f(o.integrityBad,{list:s.map(a=>o.components[a.component??""]??a.component).join(", ")}):o.integrityOk}></sw-badge></div>
        ${i?n`<div class="check"><span>${o.events}</span><span class="val">${f(o.eventsLine,{records:String(i.records??d.none),limit:String(i.count_limit??d.none),rate:String(i.observed_records_per_day??d.none)})}</span></div>`:c}
        ${e.demo.data?n`<div class="hint">${o.demo}</div>`:c}
        <div class="hint">${o.noWrites}</div>`})}capacityCard(){return this.section(this.view.capacity,o.capacityTitle,"capacity",e=>n`<div class="hint">${o.capacityHint}</div>
      <div class="list">
        ${e.records.map(t=>{const s=(i,a)=>n`<div class="grow"><span class="muted">${i}: ${a.count??d.none} / ${a.advertised_limit??d.none} · ${o.alerts[a.alert??"unknown"]??a.alert}</span>
              <div class="bar" data-alert=${a.alert??"unknown"} aria-hidden="true"><span style="inline-size:${Math.min(100,a.used_percent??0)}%"></span></div>
              ${a.estimated_days_to_limit!==null?n`<span class="muted">${f(o.daysTo,{d:a.estimated_days_to_limit})}</span>`:c}</div>`;return n`<div class="item" data-capacity=${t.station_id??""}><div class="grow"><b dir="auto">${t.name??t.station_id}</b></div>${s(o.users,t.users)}${s(o.cards,t.cards)}</div>`})}
      </div>`)}pickMeta(e){this.metaStation=e;const t=this.view?.platform.data?.stations[e]?.values;this.meta=t?JSON.parse(JSON.stringify(t)):ae(),this.meta&&!this.meta.window&&(this.meta.window=ae().window),this.tagsText=(this.meta?.tags??[]).join(", ")}metaValues(){const e=this.meta;return{...e,zone:e.zone??"",owner:e.owner??"",tags:this.tagsText.split(",").map(t=>t.trim()).filter(Boolean),window:e.window}}askMeta(){const e=this.view?.platform.data;if(!e||!this.meta)return;const t=this.metaValues(),s=e.stations[this.metaStation]?.values??null;this.confirm={heading:f(o.metaHeading,{name:this.nameOf(this.metaStation)}),body:o.metaBody,diff:U(s?{zone:s.zone,owner:s.owner,tags:s.tags.join(", "),window:JSON.stringify(s.window)}:null,{zone:t.zone,owner:t.owner,tags:t.tags.join(", "),window:JSON.stringify(t.window)}).map(i=>({...i,label:i.key==="zone"?o.zone:i.key==="owner"?o.owner:i.key==="tags"?o.tags:o.windowOn})),maxSeconds:15,send:()=>it(this.metaStation,e.revision,t),done:()=>{this.flash={tone:"ok",text:o.saved},this.load()}}}metaCard(){const e=this.meta,t=e?.window,s=t?vt(t):[],i=a=>this.meta={...e,window:{...t,...a}};return n`<sw-card heading=${o.metaTitle} data-meta>
      <div class="hint">${o.metaHint}</div>
      <div class="pickrow"><label class="f"><span>${v.pick}</span>
        <select class="pick" @change=${a=>this.pickMeta(a.target.value)} data-meta-pick>
          <option value="" ?selected=${!this.metaStation}>—</option>
          ${this.stations.map(a=>n`<option value=${a.id} ?selected=${a.id===this.metaStation}>${a.name}</option>`)}
        </select></label></div>
      ${e&&t?n`<div class="grid2">
              <label class="f"><span>${o.zone}</span><input dir="auto" .value=${e.zone??""} @input=${a=>this.meta={...e,zone:a.target.value}} data-meta-field="zone" /></label>
              <label class="f"><span>${o.owner}</span><input dir="auto" .value=${e.owner??""} @input=${a=>this.meta={...e,owner:a.target.value}} /></label>
              <label class="f"><span>${o.tags}</span><input dir="auto" .value=${this.tagsText} @input=${a=>this.tagsText=a.target.value} /></label>
              ${["offline","sync_stalled","event_gap"].map(a=>n`<label class="f"><span>${o.thresholds[a]}</span><input inputmode="numeric" dir="ltr" .value=${String(e.thresholds[a]??"")}
                  @input=${r=>this.meta={...e,thresholds:{...e.thresholds,[a]:Number(r.target.value)}}} /></label>`)}
            </div>
            <label class="opt"><input type="checkbox" .checked=${t.enabled} @change=${a=>i({enabled:a.target.checked})} data-window-on /><span>${o.windowOn}</span></label>
            ${t.enabled?n`<div class="days" role="group" aria-label=${o.dayNames}>
                    ${o.days.map((a,r)=>n`<label><input type="checkbox" .checked=${t.days.includes(r)}
                      @change=${h=>i({days:h.target.checked?[...t.days,r].sort():t.days.filter(m=>m!==r)})} />${a}</label>`)}
                  </div>
                  <div class="grid2">
                    <label class="f"><span>${o.start}</span><input type="time" dir="ltr" lang=${Q()} .value=${t.start??""} aria-invalid=${s.includes("start")?"true":"false"} @input=${a=>i({start:a.target.value})} /></label>
                    <label class="f"><span>${o.end}</span><input type="time" dir="ltr" lang=${Q()} .value=${t.end??""} aria-invalid=${s.includes("end")?"true":"false"} @input=${a=>i({end:a.target.value})} /></label>
                    <label class="f"><span>${o.timezone}</span><input dir="ltr" .value=${t.timezone??""} @input=${a=>i({timezone:a.target.value})} /></label>
                  </div>
                  ${s.length?n`<div class="field-error" role="alert">${s.map(a=>o.invalid[a]??a).join(" · ")}</div>`:c}`:c}
            <div class="foot"><sw-button variant="primary" ?disabled=${s.length>0} @click=${()=>this.askMeta()} data-meta-save>${o.saveMeta}</sw-button></div>`:c}
    </sw-card>`}async runPreview(){this.preview=null,this.previewError="",this.receipts=null;try{this.preview=(await pt(this.changeMode,[...this.chosen],this.door,this.changes)).data}catch(e){this.previewError=M(e)}}askChange(){const e=this.preview,t=this.view.typed[this.changeMode==="config"?"config_apply":"maint_enqueue"];if(!e?.review_id)return;const s=e.count??0,i=this.changeMode==="config";this.confirm={heading:f(i?o.applyHeading:o.enqueueHeading,{n:s}),body:i?o.applyBody:o.enqueueBody,typed:t,typedFixed:!0,danger:!0,maxSeconds:58,send:a=>i?ht(e.review_id,a??""):ut(e.review_id,a??""),done:a=>{if(this.preview=null,i){this.receipts=a.data.receipts;const r=yt(this.receipts);this.flash=r.failed?{tone:"warn",text:o.partial}:{tone:"ok",text:d.result.completed}}else this.flash={tone:"ok",text:d.result.completed};this.load()}}}changeCard(){const e=(s,i)=>{const a={...this.changes};i===""||i===void 0||typeof i=="number"&&!Number.isFinite(i)?delete a[s]:a[s]=i,this.changes=a,this.preview=null},t=this.chosen.size>=1&&this.chosen.size<=12&&Object.keys(this.changes).length>0;return n`<sw-card heading=${o.changeTitle} data-change>
      <div class="hint">${o.changeHint}</div>
      <div class="days" role="group" aria-label=${o.stations}>
        ${this.stations.map(s=>n`<label><input type="checkbox" .checked=${this.chosen.has(s.id)} data-change-station=${s.id}
          @change=${i=>{const a=new Set(this.chosen);i.target.checked?a.add(s.id):a.delete(s.id),this.chosen=a,this.preview=null}} /><span dir="auto">${s.name}</span></label>`)}
      </div>
      <div class="grid2">
        <label class="f"><span>${o.door}</span><select @change=${s=>(this.door=Number(s.target.value),this.preview=null)} data-change-door>
          <option value="1" ?selected=${this.door===1}>1</option><option value="2" ?selected=${this.door===2}>2</option></select></label>
        <label class="f"><span>${o.mode}</span><select @change=${s=>(this.changeMode=s.target.value,this.preview=null)} data-change-mode>
          <option value="config" ?selected=${this.changeMode==="config"}>${o.modeNow}</option><option value="maintenance" ?selected=${this.changeMode==="maintenance"}>${o.modeWindow}</option></select></label>
        <label class="f"><span>${v.fields.doorName}</span><input dir="auto" .value=${String(this.changes.doorName??"")} @input=${s=>e("doorName",s.target.value)} data-change-field="doorName" /></label>
        <label class="f"><span>${v.fields.openDuration}</span><input inputmode="numeric" dir="ltr" .value=${String(this.changes.openDuration??"")}
          @input=${s=>{const i=s.target.value.trim();e("openDuration",i===""?"":Number(i))}} data-change-field="openDuration" /></label>
      </div>
      <div class="foot"><sw-button variant="secondary" ?disabled=${!t} @click=${()=>void this.runPreview()} data-change-preview>${o.preview}</sw-button></div>
      ${this.previewError?n`<div class="msg err" role="alert">${this.previewError}</div>`:c}
      ${this.preview?n`<div class="scroll"><table data-change-rows>
              <thead><tr><th>${v.pick}</th><th>${d.confirm.before}</th><th>${d.confirm.after}</th></tr></thead>
              <tbody>${this.preview.rows.map(s=>n`<tr data-row=${s.station_id??""}><td dir="auto">${s.name??s.station_id}</td>
                ${s.error?n`<td colspan="2" class="field-error">${s.error}</td>`:n`<td>${D.filter(i=>i in this.changes).map(i=>n`<div>${v.fields[i]}: ${String(s.before?.[i]??d.none)}</div>`)}</td>
                         <td>${D.filter(i=>i in this.changes).map(i=>n`<div><b>${v.fields[i]}: ${String(s.after?.[i]??d.none)}</b></div>`)}</td>`}</tr>`)}</tbody>
            </table></div>
            ${this.preview.review_id?n`<div class="foot"><sw-button variant="danger" @click=${()=>this.askChange()} data-change-apply>${this.changeMode==="config"?o.apply:o.enqueue}</sw-button></div>`:n`<div class="hint">${o.previewEmpty}</div>`}`:c}
      ${this.receipts?n`<div class="list" data-receipts aria-label=${o.receipts}>${this.receipts.map(s=>n`<div class="item" data-receipt=${s.station_id??""} data-state=${s.state??""}>
              <span dir="auto">${this.nameOf(s.station_id)}</span>
              <sw-badge kind=${s.state==="verified"?"live":"error"} label=${s.state==="verified"?o.receiptOk:f(o.receiptFail,{code:s.code??""})}></sw-badge></div>`)}</div>`:c}
    </sw-card>`}queueCard(){return this.section(this.view.maintenance,o.queueTitle,"queue",e=>e.records.length===0?n`<div class="hint">${o.noJobs}</div>`:n`<div class="list">${e.records.map(t=>n`<div class="item" data-maint-job=${t.id??""} data-state=${t.state??""}>
            <div class="grow"><b>${o.jobStates[t.state??"unknown"]??t.state}</b>
              ${t.rows.map(s=>n`<span class="muted"><span dir="auto">${s.name??s.station_id}</span> · ${o.rowStates[s.state??"unknown"]??s.state}${s.code?` (${s.code})`:""}</span>`)}</div>
            ${t.state==="queued"||t.state==="awaiting_approval"?n`<sw-button size="sm" variant="ghost" @click=${()=>this.confirm={heading:o.cancelHeading,body:o.cancelBody,maxSeconds:15,send:()=>mt(t),done:()=>void this.load()}} data-maint-cancel>${o.cancelJob}</sw-button>`:c}
          </div>`)}</div>`)}retValues(){return{days:Number(this.ret.days),count:Number(this.ret.count),bytes:Math.round(Number(this.ret.mb)*ie)}}async runRetPreview(){try{const e=(await dt(this.retValues())).data;this.retPreview={review_id:e.review_id,before:e.before,removed:e.removed}}catch(e){this.flash={tone:"warn",text:M(e)}}}retentionCard(){const e=this.retValues(),t=Number.isInteger(e.days)&&e.days>=1&&e.days<=365&&Number.isInteger(e.count)&&e.count>=100&&e.count<=2e4&&e.bytes>=262144&&e.bytes<=25165824,s=a=>r=>(this.ret={...this.ret,[a]:r.target.value},this.retPreview=null),i=this.retPreview;return n`<sw-card heading=${o.retentionTitle} data-retention>
      <div class="hint">${o.retentionHint}</div>
      <div class="grid2">
        <label class="f"><span>${o.retDays}</span><input inputmode="numeric" dir="ltr" .value=${this.ret.days} @input=${s("days")} data-ret="days" /></label>
        <label class="f"><span>${o.retCount}</span><input inputmode="numeric" dir="ltr" .value=${this.ret.count} @input=${s("count")} data-ret="count" /></label>
        <label class="f"><span>${o.retMb}</span><input inputmode="decimal" dir="ltr" .value=${this.ret.mb} @input=${s("mb")} data-ret="mb" /></label>
      </div>
      ${i?n`<div class="msg ${i.removed?"warn":"ok"}" role="status" data-ret-preview>${f(o.retRemoved,{removed:i.removed??0,before:i.before??0})}</div>`:c}
      <div class="foot">
        <sw-button variant="secondary" ?disabled=${!t} @click=${()=>void this.runRetPreview()} data-ret-check>${o.retPreview}</sw-button>
        ${i?n`<sw-button variant="danger" @click=${()=>this.confirm={heading:o.retHeading,body:f(o.retBody,{removed:i.removed??0}),typed:this.view.typed.retention_apply,typedFixed:!0,danger:!0,maxSeconds:30,send:a=>ct(i.review_id,a??""),done:()=>(this.retPreview=null,this.flash={tone:"ok",text:d.result.completed},void this.load())}} data-ret-apply>${o.retApply}</sw-button>`:c}
      </div>
    </sw-card>`}webhookCard(){const e=this.hook,t=this.view.platform.data;if(!e||!t)return n``;const s=ft(e),i=JSON.stringify({...e,kinds:[...e.kinds].sort()})!==JSON.stringify({...t.webhook,kinds:[...t.webhook.kinds].sort()});return n`<sw-card heading=${o.webhookTitle} data-webhook>
      <div class="hint">${o.webhookHint}</div>
      <label class="opt"><input type="checkbox" .checked=${e.enabled} @change=${a=>this.hook={...e,enabled:a.target.checked}} data-hook-on /><span>${o.webhookOn}</span></label>
      <label class="f"><span>${o.url}</span><input dir="ltr" inputmode="url" .value=${e.url} aria-invalid=${s.includes("url")?"true":"false"} @input=${a=>this.hook={...e,url:a.target.value.trim()}} data-hook-url />
        ${s.includes("url")?n`<span class="field-error">${o.invalid.url}</span>`:c}</label>
      <div class="days" role="group">${Object.entries(o.kinds).map(([a,r])=>n`<label><input type="checkbox" .checked=${e.kinds.includes(a)}
        @change=${h=>this.hook={...e,kinds:h.target.checked?[...e.kinds,a]:e.kinds.filter(m=>m!==a)}} />${r}</label>`)}</div>
      ${s.includes("kinds")?n`<div class="field-error">${o.invalid.kinds}</div>`:c}
      ${this.key?n`<div class="hint">${o.keyShown}</div><div class="key" data-hook-key>${this.key}</div>`:c}
      <div class="foot">
        <sw-button variant="primary" ?disabled=${!i||s.length>0} @click=${()=>this.confirm={heading:o.webhookHeading,body:o.webhookBody,maxSeconds:15,send:()=>nt(t.revision,{...e,kinds:[...e.kinds].sort()}),done:()=>(this.flash={tone:"ok",text:o.saved},void this.load())}} data-hook-save>${o.saveWebhook}</sw-button>
        ${this.key?n`<sw-button variant="ghost" @click=${()=>this.key=""} data-hook-hide>${o.hideKey}</sw-button>`:n`<sw-button variant="ghost" @click=${()=>this.confirm={heading:o.keyHeading,body:o.keyBody,typed:this.view.typed.webhook_key,typedFixed:!0,danger:!0,maxSeconds:15,send:a=>ot(a??""),done:a=>this.key=a.data.key}} data-hook-key-show>${o.showKey}</sw-button>`}
      </div>
    </sw-card>`}async download(){try{const e=await at(),t=new Blob([JSON.stringify(e.data,null,2)],{type:"application/json"}),s=document.createElement("a");s.href=URL.createObjectURL(t),s.download="intercom-configuration.json",s.click(),setTimeout(()=>URL.revokeObjectURL(s.href),1e3)}catch(e){this.flash={tone:"warn",text:M(e)}}}async readFile(e){const t=e.target.files?.[0];if(this.importReview=null,this.importError="",!!t){this.importContent=(await t.text()).slice(0,6e4);try{const s=JSON.parse(this.importContent);this.importMap=Object.fromEntries(Object.keys(s.stations??{}).map(i=>[i,this.stations.some(a=>a.id===i)?i:""]))}catch{this.importError=d.errorTitle}}}ioCard(){const e=this.importReview,t=Object.values(this.importMap).every(Boolean);return n`<sw-card heading=${o.ioTitle} data-io>
      <div class="hint">${o.ioHint}</div>
      <div class="foot"><sw-button variant="secondary" @click=${()=>void this.download()} data-export>${o.export}</sw-button></div>
      <label class="f"><span>${o.importLabel}</span><input type="file" accept="application/json,.json" @change=${s=>void this.readFile(s)} data-import-file /></label>
      ${Object.keys(this.importMap).map(s=>n`<label class="f"><span dir="auto">${s} → ${o.mapTo}</span>
        <select @change=${i=>(this.importMap={...this.importMap,[s]:i.target.value},this.importReview=null)} data-import-map=${s}>
          <option value="" ?selected=${!this.importMap[s]}>—</option>${this.stations.map(i=>n`<option value=${i.id} ?selected=${i.id===this.importMap[s]}>${i.name}</option>`)}
        </select></label>`)}
      ${this.importError?n`<div class="msg err" role="alert">${this.importError}</div>`:c}
      ${this.importContent?n`<div class="foot"><sw-button variant="secondary" ?disabled=${!t} @click=${async()=>{try{this.importReview=(await rt(this.importContent,this.importMap)).data,this.importError=""}catch(s){this.importError=M(s)}}} data-import-preview>${o.importPreview}</sw-button>
            ${e?n`<sw-button variant="danger" @click=${()=>this.confirm={heading:o.importHeading,body:f(o.importBody,{n:e.stations.length,t:e.templates??0}),typed:this.view.typed.import_apply,typedFixed:!0,danger:!0,maxSeconds:30,send:s=>lt(e.review_id,s??""),done:()=>(this.importReview=null,this.importContent="",this.importMap={},this.flash={tone:"ok",text:f(o.imported,{n:e.stations.length})},void this.load())}}
                  data-import-apply>${o.importApply}</sw-button>`:c}</div>`:c}
    </sw-card>`}render(){return this.loadState==="loading"?n`<sw-state-panel state="loading" heading=${d.loading} compact data-platform="loading"></sw-state-panel>`:this.loadState==="error"||!this.view?n`<sw-state-panel state="error" heading=${d.errorTitle} hint=${this.loadError} actionLabel=${d.retry} @action=${()=>void this.load()} data-platform="error"></sw-state-panel>`:n`<div class="sections" data-platform="ready">
      ${this.flash?n`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>`:c}
      ${this.healthCard()}${this.capacityCard()}${this.metaCard()}${this.changeCard()}${this.queueCard()}${this.retentionCard()}${this.webhookCard()}${this.ioCard()}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${()=>this.confirm=null}></wk-installer-confirm>`}};g.styles=[B,Y,z`
      :host {
        display: block;
      }
      table {
        inline-size: 100%;
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
      }
      th,
      td {
        text-align: start;
        padding: 6px 8px;
        border-block-end: 1px solid var(--sw-border);
        overflow-wrap: anywhere;
      }
      th {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-medium);
        font-size: var(--sw-fs-sm);
      }
      .scroll {
        overflow-x: auto;
      }
      .days {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .days label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .key {
        font-family: var(--sw-font-mono, ui-monospace, monospace);
        font-size: var(--sw-fs-sm);
        direction: ltr;
        overflow-wrap: anywhere;
        user-select: all;
        padding: 8px 10px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-3);
      }
      .bar {
        block-size: 6px;
        border-radius: 3px;
        background: var(--sw-surface-3);
        overflow: hidden;
        min-inline-size: 60px;
      }
      .bar span {
        display: block;
        block-size: 100%;
        background: var(--sw-accent);
      }
      .bar[data-alert='near_limit'] span,
      .bar[data-alert='growth_to_limit'] span {
        background: var(--sw-warn, var(--sw-accent));
      }
      .bar[data-alert='at_limit'] span {
        background: var(--sw-danger, var(--sw-err));
      }
    `];w([p()],g.prototype,"view",2);w([p()],g.prototype,"loadState",2);w([p()],g.prototype,"loadError",2);w([p()],g.prototype,"confirm",2);w([p()],g.prototype,"flash",2);w([p()],g.prototype,"metaStation",2);w([p()],g.prototype,"meta",2);w([p()],g.prototype,"tagsText",2);w([p()],g.prototype,"chosen",2);w([p()],g.prototype,"door",2);w([p()],g.prototype,"changeMode",2);w([p()],g.prototype,"changes",2);w([p()],g.prototype,"preview",2);w([p()],g.prototype,"previewError",2);w([p()],g.prototype,"receipts",2);w([p()],g.prototype,"ret",2);w([p()],g.prototype,"retPreview",2);w([p()],g.prototype,"hook",2);w([p()],g.prototype,"key",2);w([p()],g.prototype,"importContent",2);w([p()],g.prototype,"importMap",2);w([p()],g.prototype,"importReview",2);w([p()],g.prototype,"importError",2);g=w([A("installer-platform")],g);var Ot=Object.defineProperty,Kt=Object.getOwnPropertyDescriptor,L=(e,t,s,i)=>{for(var a=i>1?void 0:i?Kt(t,s):t,r=e.length-1,h;r>=0;r--)(h=e[r])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&Ot(t,s,a),a};const G=["clock","technical","lifecycle","platform"],Ht="#/system/intercom-installer";let P=class extends R{constructor(){super(...arguments),this.view="",this.overview=null,this.loadState="loading",this.loadError=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.loadState="loading";try{this.overview=await Oe(),this.loadState="ready"}catch(e){this.loadState=e instanceof N&&e.status===403?"forbidden":"error",this.loadError=e instanceof N?e.body.user_message:String(e)}}updated(){const e=this.renderRoot.querySelector("nav.tabs"),t=e?.querySelector('a[aria-current="page"]');if(e&&t){const s=e.getBoundingClientRect(),i=t.getBoundingClientRect();i.left<s.left?e.scrollLeft-=s.left-i.left+8:i.right>s.right&&(e.scrollLeft+=i.right-s.right+8)}}get tool(){return G.includes(this.view)?this.view:G[0]}body(e){const t=this.overview?.tools[e];if(t&&t.available===!1)return n`<sw-state-panel icon="wrench" state="empty" heading=${d.unavailableTool} hint=${t.missing.join(", ")} data-tool-unavailable></sw-state-panel>`;const s=t&&t.available===null?n`<div class="msg warn" role="status">${d.unknownTool}</div>`:c;return e==="clock"?n`${s}<installer-clock></installer-clock>`:e==="technical"?n`${s}<installer-technical .stations=${this.overview?.stations??[]}></installer-technical>`:e==="lifecycle"?n`${s}<installer-lifecycle .stations=${this.overview?.stations??[]}></installer-lifecycle>`:e==="platform"?n`${s}<installer-platform></installer-platform>`:n``}render(){const e=(s,i)=>n`<sw-page crumbs=${Ce("הגדרות")} heading=${d.title} subheading=${d.sub} data-installer data-state=${i}>${s}</sw-page>`;if(this.loadState==="loading")return e(n`<sw-state-panel state="loading" heading=${d.loading}></sw-state-panel>`,"loading");if(this.loadState==="forbidden")return e(n`<sw-state-panel state="forbidden" heading=${d.forbiddenTitle} hint=${d.forbiddenHint}></sw-state-panel>`,"forbidden");if(this.loadState==="error")return e(n`<sw-state-panel state="error" heading=${d.errorTitle} hint=${this.loadError} actionLabel=${d.retry} @action=${()=>void this.load()}></sw-state-panel>`,"error");const t=this.tool;return e(n`<nav class="tabs" aria-label=${d.title}>
          ${G.map(s=>n`<a href="${Ht}/${s}" aria-current=${s===t?"page":"false"} data-installer-tab=${s}>${d.tabs[s]}</a>`)}
        </nav>
        <div data-installer-tool=${t}>${this.body(t)}</div>`,"ready")}};P.styles=[B,z`
      ${Ne}
    `];L([J()],P.prototype,"view",2);L([p()],P.prototype,"overview",2);L([p()],P.prototype,"loadState",2);L([p()],P.prototype,"loadError",2);P=L([A("system-intercom-installer")],P);export{Ht as INSTALLER_HREF,G as INSTALLER_TOOLS,P as SystemIntercomInstaller};
