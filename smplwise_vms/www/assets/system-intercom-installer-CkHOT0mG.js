import{g as P,j as O,bc as U,b8 as k,by as re,bz as ne,g9 as I,E as R,F,G as p,a as B,A as c,e as r,H as K,bP as Y}from"./index-BKxQRAkH.js";import{f as ie}from"./wiskey-format-DJ4vUeXA.js";import"./sw-logo-art-Va6y_cIM.js";const x="access-control/installer",oe=2e4;function b(e){return{confirmed:!0,client_request_id:ne(),expires_at:new Date(re()+oe).toISOString().replace(/\.\d{3}Z$/,"Z"),...e===void 0?{}:{typed_confirmation:e}}}const le=()=>P(`${x}/overview`),de=()=>P(`${x}/clock`),ce=e=>P(`${x}/clock/stations/${encodeURIComponent(e)}`),pe=(e,t)=>U(`${x}/clock/settings`,{...b(),revision:e,values:t}),he=(e,t)=>k(`${x}/clock/host-apply`,{...b(t),revision:e}),ue=(e,t,s,i)=>k(`${x}/clock/stations/${encodeURIComponent(e)}/sync`,{...b(i),revision:t,copy_system:s});function j(e){if(e instanceof O){const t=e.body?.details??{},s=String(t.outcome??""),i=s==="refused"?"refused":s==="not_sent"?"not_sent":s==="unknown"?"unknown":[400,403,404,409,415,422,429].includes(e.status)?"not_sent":"unknown",a=Number(t.retry_after_s);return{status:i,code:String(t.wiskey_code??e.code??"")||null,message:e.body?.user_message??e.message,retryAfterS:Number.isFinite(a)&&a>0?a:null,expected:typeof t.expected=="string"?t.expected:null}}return{status:"unknown",code:"network",message:"",retryAfterS:null,expected:null}}function J(e,t,s=[]){return[...s.filter(a=>a in t),...Object.keys(t).filter(a=>!s.includes(a))].map(a=>{const o=e?e[a]:void 0,h=t[a];return{key:a,before:o,after:h,changed:JSON.stringify(o)!==JSON.stringify(h)}})}const ve=e=>e.some(t=>t.changed),me=/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;function fe(e){if(e.length<1||e.length>64)return!1;const t=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(e);if(t){const s=t.slice(1).map(Number);return!(s.some(i=>i>255)||s.every(i=>i===0)||s[0]>=224&&s[0]<=239)}return/^[0-9.]+$/.test(e)?!1:e.split(".").every(s=>me.test(s))}function Q(e){const t=[];return fe(e.server.trim())||t.push("server"),(!Number.isInteger(e.port)||e.port<2||e.port>65535)&&t.push("port"),(!Number.isInteger(e.interval)||e.interval<1||e.interval>10080)&&t.push("interval"),t}function ge(e){if(e==null||!Number.isFinite(e))return"unknown";const t=Math.abs(e);return t<=5?"ok":t<=60?"warn":"err"}const D=["doorName","openDuration","relayReverseEnabled"],we=(e,t=!1)=>P(`${x}/technical/stations/${encodeURIComponent(e)}${t?"?fresh=true":""}`),$e=(e,t,s,i,a)=>U(`${x}/technical/stations/${encodeURIComponent(e)}/doors/${t}`,{...b(a),expected:s,changes:i});function X(e,t){const s={};for(const i of D)t[i]!==void 0&&t[i]!==e[i]&&(s[i]=t[i]);return s}function ye(e,t){const s=[];for(const i of D){const a=e[i],o=t?.[i];if(a!==void 0)if(i==="doorName"){const h=String(a),v=o&&o.type!=="boolean"?o.max:64,g=o&&o.type!=="boolean"?o.min:1;(h.length<g||h.length>v||/[\u0000-\u001f]/.test(h))&&s.push(i)}else if(i==="openDuration"){const h=Number(a),v=o&&o.type!=="boolean"?o.max:255,g=o&&o.type!=="boolean"?o.min:0;(!Number.isInteger(h)||h<g||h>v)&&s.push(i)}else typeof a!="boolean"&&s.push(i)}return s}const be=(e,t)=>Object.keys(e).some(s=>t.includes(s)),ke="פתיחת דלת לבדיקה",xe=(e,t)=>k(`${x}/onboarding`,{...b(),kind:e,...t?{entry_id:t}:{}}),_e=(e,t,s,i)=>k(`${x}/onboarding/${encodeURIComponent(e)}/steps/${t}`,{...b(i),input:s}),Se=e=>k(`${x}/onboarding/${encodeURIComponent(e)}/abort`,b()),Ce=["locks","confirm_mapping"];function Z(e,t){const s={name:String(e.name??"").trim(),host:String(e.host??"").trim(),username:String(e.username??"").trim(),scheme:e.scheme==="https"?"https":"http",port:Number(e.port),verify_ssl:e.verify_ssl===!0,rtsp_port:Number(e.rtsp_port)},i=String(e.password??"");return(i||t==="user")&&(s.password=i),s}function ee(e,t){const s=[],i=(a,o)=>typeof e[a]=="string"&&e[a].length>=1&&e[a].length<=o;i("name",64)||s.push("name"),typeof e.host=="string"&&/^[A-Za-z0-9.:\-[\]]{1,255}$/.test(e.host)||s.push("host"),i("username",64)||s.push("username"),t==="user"&&!i("password",128)&&s.push("password");for(const a of["port","rtsp_port"]){const o=e[a];(!Number.isInteger(o)||o<1||o>65535)&&s.push(a)}return s}const Te=()=>P(`${x}/lifecycle`),Ee=(e,t="")=>P(`${x}/lifecycle/review?source_id=${encodeURIComponent(e)}&target_id=${encodeURIComponent(t)}`),Oe=(e,t)=>k(`${x}/lifecycle/prepare`,{...b(),source_id:e,...t?{target_id:t}:{}}),ze=(e,t,s)=>k(`${x}/lifecycle/jobs/${encodeURIComponent(e.id??"")}/${t}`,{...b(s),fingerprint:e.fingerprint});function te(e){return e.state==="prepared"||e.state==="approved"?"apply":e.state==="applied"?"verify":e.state==="verified"||e.state==="removing"?"remove":null}const Ne=["prepared","applied","verified","removed"];function He(e){if(e==="removing")return 2.5;const t=Ne.indexOf(e==="approved"?"prepared":e);return t<0?-1:t}const S=`${x}/platform`,Pe=()=>P(S),We=()=>P(`${S}/export`),Re=(e,t,s)=>U(`${S}/stations/${encodeURIComponent(e)}`,{...b(),revision:t,values:s}),Ie=(e,t)=>U(`${S}/webhook`,{...b(),revision:e,values:t}),Be=e=>k(`${S}/webhook/key`,b(e)),Ke=(e,t)=>k(`${S}/import/preview`,{content:e,mapping:t}),Me=(e,t)=>k(`${S}/import/apply`,{...b(t),review_id:e}),Le=e=>k(`${S}/retention/preview`,{values:e}),De=(e,t)=>k(`${S}/retention/apply`,{...b(t),review_id:e}),Ae=(e,t,s,i)=>k(`${S}/${e}/preview`,{station_ids:t,door:s,changes:i}),qe=(e,t)=>k(`${S}/config/apply`,{...b(t),review_id:e}),je=(e,t)=>k(`${S}/maintenance/enqueue`,{...b(t),review_id:e}),Je=e=>k(`${S}/maintenance/jobs/${encodeURIComponent(e.id??"")}/cancel`,{...b(),fingerprint:e.fingerprint});function Ue(e){const t=[],s=/^(?:[01]\d|2[0-3]):[0-5]\d$/;return e.enabled&&e.days.length===0&&t.push("days"),(!e.start||!s.test(e.start))&&t.push("start"),(!e.end||!s.test(e.end))&&t.push("end"),!t.length&&(e.start??"")>=(e.end??"")&&t.push("end"),(!e.timezone||!/^[A-Za-z0-9_+\-/]{1,100}$/.test(e.timezone))&&t.push("timezone"),t}function Fe(e){const t=[];if(e.enabled&&e.kinds.length===0&&t.push("kinds"),e.url||e.enabled)try{const s=new URL(e.url);(s.protocol!=="https:"||!s.hostname||s.username||s.password||s.search||s.hash||!["","443","8443"].includes(s.port))&&t.push("url")}catch{t.push("url")}return t}function Ze(e){const t=e.filter(i=>i.state==="verified").length,s=e.length-t;return{verified:t,failed:s,partial:t>0&&s>0}}const d={title:"התקנה ותחזוקת מערכת האינטרקום",sub:"כלי המתקין של WisKey - שעון, הגדרות טכניות של עמדות, הוספה והסרה של עמדות ותצורת המערכת. כל שינוי נשלח רק אחרי אישור, ונרשם ביומן.",tabs:{clock:"שעון",technical:"הגדרות עמדה",lifecycle:"הוספה והסרה",platform:"תצורת המערכת"},forbiddenTitle:"אין הרשאה",forbiddenHint:"הכלים האלה פתוחים רק למי שמגדיר את המערכת (הרשאת הגדרות מערכת בכל ההתקנה).",errorTitle:"לא ניתן לטעון",retry:"נסו שוב",loading:"טוען…",unavailableTool:"גרסת WisKey המותקנת אינה מציעה את הכלי הזה.",unknownTool:"עדיין לא ידוע אם WisKey מציע את הכלי הזה - אין כרגע חיבור פעיל.",feedDown:"החיבור ל־WisKey אינו פעיל כרגע. אפשר לצפות במה שנטען, אבל פעולות לא יישלחו.",none:"—",yes:"כן",no:"לא",online:"מחוברת",offline:"לא מחוברת",cancel:"ביטול",close:"סגירה",confirm:{typeToConfirm:"כדי לאשר, הקלידו בדיוק: {phrase}",typedLabel:"אישור בהקלדה",send:"אישור ושליחה",sending:"נשלח… ממתין לתשובה מ־WisKey ({s} שניות, עד כ־{max})",before:"לפני",after:"אחרי",willChange:"מה ישתנה",once:"הפעולה נשלחת פעם אחת ולא חוזרת על עצמה מעצמה."},result:{completed:"בוצע",refused:"לא בוצע - WisKey דחה את הפעולה ({code}). לא השתנה דבר.",not_sent:"לא נשלח: {message}",unknown:"נשלח, אך לא התקבלה תשובה ברורה. ייתכן שבוצע - רעננו ובדקו לפני שמנסים שוב.",retryIn:"אפשר לנסות שוב בעוד {s} שניות."},clock:{settingsTitle:"שרת הזמן של מערכת האינטרקום",settingsHint:"ההגדרה נשמרת ב־WisKey בלבד. שמירה אינה משנה אף מכשיר - כתיבה לעמדות ולשרת נעשית בנפרד, למטה.",server:"שרת זמן (NTP)",port:"פורט",interval:"מרווח סנכרון (דקות)",revision:"גרסה {r}",save:"שמירה",defaults:"ברירת המחדל של WisKey: {server}, פורט {port}, כל {interval} דקות",invalid:{server:"כתובת לא תקינה (שם שרת או IPv4)",port:"פורט בין 2 ל־65535",interval:"בין 1 ל־10080 דקות"},saveHeading:"שמירת הגדרות השעון",hostTitle:"השעון של השרת",hostSupported:"השרת תומך בהגדרת NTP",hostUnsupported:"השרת אינו מאפשר ל־WisKey להגדיר NTP",hostSynced:"מסונכרן",hostNotSynced:"לא מסונכרן",hostServers:"שרתי זמן בשרת",hostApply:"החלה על השרת",hostApplyHeading:"החלת שרת הזמן על השרת",hostApplyBody:"שרת הזמן של השרת יוחלף ב־{server}. שרתי הגיבוי יימחקו. WisKey קורא את ההגדרה בחזרה ומאשר אותה.",hostApplyPort:"החלה על השרת אפשרית רק עם פורט 123.",hostApplied:"השרת הוגדר לשרת הזמן {server} (נקרא בחזרה ואושר).",stationsTitle:"השעון של כל עמדה",stationsHint:'המדידה האחרונה של WisKey מול השעון של השרת. "בדיקה" קוראת את המדידה העדכנית ביותר ש־WisKey שמר; קריאה חדשה מהמכשיר עצמו נמצאת בתחזוקת העמדה.',colStation:"עמדה",colSkew:"סטייה",colMode:"מצב שעון",colChecked:"נמדד",check:"בדיקה",sync:"כתיבת השעון לעמדה",syncHeading:"כתיבת הגדרות השעון לעמדה {name}",syncBody:"העמדה תוגדר לשרת הזמן {server} (פורט {port}, כל {interval} דקות) ולמצב שעון NTP. WisKey קורא את ההגדרה בחזרה ומודד את השעון.",copySystem:"להעתיק קודם את השעה של השרת לעמדה (שעה ידנית, ואז חזרה ל־NTP)",syncResult:"ההגדרה נכתבה ואושרה. שעון העמדה {verified} (סטייה {skew}).",verified:"מאומת",notVerified:"עדיין לא מאומת",skew:"{s} שנ׳",noClock:"אין מדידה",modes:{NTP:"NTP",manual:"ידני",satellite:"לוויין",platform:"פלטפורמה",NONE:"ללא",GB28181:"GB28181",unknown:"לא ידוע"},noStations:"אין עמדות להצגה.",sectionUnavailable:"החלק הזה לא נטען: {message}"}};function f(e,t){return e.replace(/\{(\w+)\}/g,(s,i)=>i in t?String(t[i]):`{${i}}`)}const m={pick:"עמדה",pickHint:"הנתונים נקראים מהמכשיר עצמו דרך WisKey. קריאה אורכת עד כדקה.",read:"קריאה מהעמדה",reread:"קריאה מחדש",readAt:"נקרא מהעמדה: {at}",offline:"העמדה אינה מחוברת - אפשר לקרוא את מה שנשמר, אבל לא לשנות.",door:"דלת {n}",notMapped:"הדלת אינה במיפוי הממסרים המאושר של העמדה, ולכן אי אפשר לשנות אותה מכאן.",doorError:"לא ניתן לקרוא את הדלת ({code}).",fields:{doorName:"שם הדלת",openDuration:"זמן פתיחה (שניות)",relayReverseEnabled:"היפוך ממסר"},bounds:"בין {min} ל־{max}",lengthBounds:"{min}-{max} תווים",relayOn:"הפוך",relayOff:"רגיל",relayWarn:'היפוך הממסר משנה את המשמעות של "נעול" ו"פתוח" במנעול. שינוי שגוי עלול להשאיר דלת פתוחה - נדרש אישור בהקלדה.',save:"שמירת הדלת",saveHeading:"שמירת ההגדרות של {door} בעמדה {name}",saveBody:"WisKey קורא את הדלת שוב, בודק שלא השתנתה מאז הקריאה, כותב רק את השדות שהשתנו וקורא בחזרה כדי לאמת.",saved:"נשמר ונקרא בחזרה מהעמדה.",invalid:"הערך מחוץ לטווח שהמכשיר מאפשר",features:"יכולות שהמכשיר מדווח",passwords:"סיסמאות ההרשאה במכשיר (קיום בלבד, לא הערכים)",pinState:{configured:"מוגדר קוד ציבורי",absent:"אין קוד ציבורי",unknown:"לא ידוע"},passwordNames:{engineeringConfigured:"סיסמת הנדסה",setupAlarmConfigured:"סיסמת דריכה",householderUnlockConfigured:"סיסמת פתיחה לדייר",antiHijackingConfigured:"סיסמת חטיפה",sendCardConfigured:"סיסמת כרטיס"},set:"מוגדרת",unset:"לא מוגדרת",relays:"מיפוי ממסרים מאושר",relayRow:"ממסר פיזי {physical} ← דלת API {api}",noRelays:"אין מיפוי ממסרים (עמדת מצלמה בלבד).",empty:"בחרו עמדה כדי לקרוא את ההגדרות הטכניות שלה."},l={addTitle:"הוספת עמדה",addHint:"האשף של WisKey: חיבור לעמדה, אימות זהות המכשיר ומיפוי הממסר. פרטי ההתחברות עוברים ל־WisKey בלבד - Arx לא שומר ולא רושם אותם.",addStart:"הוספת עמדה",reTitle:"התחברות מחדש לעמדה",reHint:"כתובת, משתמש או סיסמה חדשים לאותו מכשיר. WisKey מוודא שזה אותו מכשיר לפני שהוא שומר.",reStart:"התחברות מחדש",station:"עמדה",wizardTitle:{add:"הוספת עמדה",reconfigure:"התחברות מחדש לעמדה"},steps:{user:"פרטי חיבור",reconfigure:"פרטי חיבור",confirm_device:"אימות המכשיר",locks:"דלת",mapping:"בדיקת ממסר",confirm_mapping:"אישור הבדיקה",other:"שלב"},fields:{name:"שם העמדה",host:"כתובת (שם או IP)",username:"משתמש",password:"סיסמה",scheme:"פרוטוקול",port:"פורט",verify_ssl:"לאמת תעודת אבטחה",rtsp_port:"פורט וידאו (RTSP)",lock_name:"שם הדלת (רשות)",api_id:"ממסר לבדיקה",mode:"מה העמדה מפעילה",result:"מה קרה בבדיקה"},passwordKeep:"השאירו ריק כדי לשמור את הסיסמה הקיימת",modes:{camera_only:"מצלמה בלבד (בלי דלת)",map_active_relay:"מיפוי ממסר לדלת (כולל בדיקה)",keep_confirmed_mapping:"להשאיר את המיפוי המאושר"},results:{released_and_returned:"הדלת נפתחה ונסגרה כמצופה",choose_again:"לא הדלת הנכונה - לבחור ממסר אחר",camera_only:"לוותר על הדלת - מצלמה בלבד"},device:"WisKey זיהה את המכשיר",model:"דגם",firmware:"קושחה",serial:"מספר סידורי",deviceConfirm:"זו העמדה הנכונה",next:"המשך",cancel:"ביטול האשף",checking:"WisKey מתחבר למכשיר ובודק…",pulseWarn:"בשלב הזה WisKey שולח לממסר שנבחר פקודת פתיחה אחת כדי לוודא שזו הדלת הנכונה. ודאו שמישהו נמצא ליד הדלת ושאין סכנה בפתיחתה.",pulseButton:"פתיחת דלת לבדיקה",pulseHeading:"פתיחת הדלת לבדיקת הממסר",commitHeading:"שמירת העמדה ב־WisKey",commitBody:"WisKey ישמור את העמדה עם ההגדרות שנבחרו.",created:"העמדה {title} נוספה ל־WisKey. היא תופיע ברשימת העמדות אחרי הסנכרון הבא.",reconfigured:"פרטי החיבור של העמדה עודכנו ב־WisKey.",aborted:"האשף הסתיים בלי שינוי ({reason}).",cancelled:"האשף בוטל.",flowErrors:{invalid_auth:"שם המשתמש או הסיסמה שגויים",cannot_connect:"אין חיבור למכשיר בכתובת הזו",unsupported_device:"המכשיר אינו נתמך",invalid_response:"המכשיר החזיר תשובה לא צפויה",access_removal_pending:"יש אנשים שעדיין ממתינים להסרה מהעמדה - אי אפשר לעבור למצלמה בלבד",test_required:"יש לאשר את בדיקת הממסר",invalid_mapping:"ממסר לא תקין",unlock_failed:"פקודת הפתיחה נכשלה",confirmation_required:"יש לבחור מה קרה בבדיקה",other:"WisKey דחה את השלב"},abortReasons:{already_configured:"העמדה כבר קיימת",unique_id_mismatch:"זה מכשיר אחר",reconfigure_successful:"עודכן",already_in_progress:"אשף אחר כבר פתוח לעמדה הזו"},removeTitle:"הסרה או החלפה של עמדה",removeHint:"WisKey בודק את ההשפעה, מעביר או מסיר את האנשים מהעמדה, מוודא שהעמדה נוקתה, ורק אז מסיר אותה. בהחלפה - האנשים עוברים לעמדת היעד (הוסיפו אותה קודם באשף).",source:"העמדה שמוסרת",target:"עמדת יעד (להחלפה, רשות)",noTarget:"בלי - הסרה בלבד",review:"בדיקת השפעה",impact:"השפעה",people:"אנשים מושפעים",bindings:"שיוכים מוכרים",unknownOwners:"בעלים לא ידועים במכשיר",holdPrograms:"תוכניות פתיחה",nativeSchedules:"לוחות זמנים במכשיר",blockers:"חוסמים",noBlockers:"אין חוסמים",blockerText:{target_already_in_use:"עמדת היעד כבר בשימוש",target_ownership_unverified:"לא אומתה הבעלות על עמדת היעד",target_contains_accounts:"בעמדת היעד יש משתמשים",target_lock_mapping_incomplete:"מיפוי הדלתות בעמדת היעד חלקי",native_schedule_redeployment_required:"צריך לפרוס מחדש לוחות זמנים במכשיר",hold_programs_require_separate_review:"יש תוכניות פתיחה שדורשות בדיקה נפרדת",other:"חוסם אחר"},prepare:"הכנת ההסרה",prepareHeading:"הכנת הסרה של {name}",prepareBody:"WisKey יכין משימה ויקבע את מצב האנשים בעמדה. שום דבר עוד לא נמחק ולא מועבר.",jobs:"משימות הסרה והחלפה",noJobs:"אין משימות.",refresh:"רענון",states:{prepared:"הוכנה",approved:"אושרה",rejected:"נדחתה",applied:"האנשים הועברו",verified:"נוקתה",removing:"בהסרה",removed:"הוסרה",expired:"פג תוקף",failed:"נכשלה",unknown:"לא ידוע"},stepLabels:["הוכנה","אנשים","ניקוי","הוסרה"],actions:{apply:"העברת האנשים",verify:"בדיקת ניקוי",remove:"הסרת העמדה"},applyHeading:"העברת האנשים מ־{name}",applyBody:"WisKey יסיר את ההרשאות של {n} אנשים מהעמדה (ובהחלפה - יעביר אותן לעמדת היעד). זו פעולה שמשנה את המכשירים.",verifyHeading:"בדיקת הניקוי של {name}",verifyBody:"WisKey קורא את המכשיר ובודק שלא נשארו בו משתמשים וכרטיסים של המערכת.",removeHeading:"הסרת העמדה {name} מהמערכת",removeBody:"WisKey יסיר את הגדרת העמדה. כדי להחזיר אותה יהיה צריך להוסיף אותה מחדש באשף.",approval:"ב־WisKey מופעל אישור כפול. Arx אינו יכול לשמש כמאשר השני - האישור נעשה ב־WisKey עצמו.",doneJob:"המשימה עודכנה: {state}."},n={healthTitle:"שלמות ונתונים",integrity:"בדיקת שלמות של WisKey",integrityOk:"כל המאגרים נטענו",integrityBad:"מאגר לא זמין: {list}",noWrites:"הבדיקה לא כתבה דבר.",components:{access:"אנשים והרשאות",panel_permissions:"הרשאות הלוח",appearance_settings:"מראה",profile_settings:"קבוצות ושדות",schedule_journal:"יומן לוחות זמנים",hold_programs:"תוכניות פתיחה",operations_center:"מרכז התפעול",events:"אירועים",operations_validation:"אימות מרכז התפעול"},events:"אירועים שמורים",eventsLine:"{records} רשומות · עד {limit} · כ־{rate} ביום",demo:"מצב הדגמה של WisKey זמין (בלי מכשיר ובלי כתיבה).",capacityTitle:"קיבולת העמדות",capacityHint:"משתמשים וכרטיסים מול הגבול שהמכשיר מדווח. התחזית היא הערכה לפי הקצב שנמדד.",users:"משתמשים",cards:"כרטיסים",daysTo:"כ־{d} ימים לגבול",alerts:{unknown:"לא ידוע",stale:"מדידה ישנה",at_limit:"בגבול",near_limit:"קרוב לגבול",growth_to_limit:"יגיע לגבול בקרוב",observed:"תקין"},metaTitle:"פרטי עמדה וחלון תחזוקה",metaHint:"אזור, אחראי, תגיות, ספי התרעה וחלון התחזוקה שבו WisKey רשאי לכתוב לעמדה.",zone:"אזור",owner:"אחראי",tags:"תגיות (מופרדות בפסיק)",thresholds:{offline:"התרעה על ניתוק (שניות)",sync_stalled:"סנכרון תקוע (שניות)",event_gap:"פער באירועים (שניות)"},windowOn:"להגביל כתיבה לחלון התחזוקה",days:["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],dayNames:"ימים",start:"משעה",end:"עד שעה",timezone:"אזור זמן",saveMeta:"שמירה",metaHeading:"שמירת פרטי העמדה {name}",metaBody:"נשמר במרכז התפעול של WisKey. שום מכשיר לא משתנה.",changeTitle:"שינוי הגדרה בכמה עמדות",changeHint:'WisKey קורא כל עמדה, מראה לפני ואחרי, ורק אחרי אישור כותב. "עכשיו" כותב מיד; "בחלון התחזוקה" מכניס לתור ש־WisKey מריץ בחלון של כל עמדה.',stations:"עמדות (עד 12)",door:"דלת",mode:"מתי",modeNow:"עכשיו",modeWindow:"בחלון התחזוקה",preview:"תצוגה מקדימה",previewEmpty:"אין עמדה שאפשר לשנות.",apply:"החלה",enqueue:"הכנסה לתור",applyHeading:"החלת השינוי על {n} עמדות",applyBody:"WisKey יכתוב לכל עמדה את השדות שהשתנו ויקרא בחזרה. כל עמדה מקבלת תוצאה משלה.",enqueueHeading:"תזמון השינוי ל־{n} עמדות",enqueueBody:"WisKey יכתוב לכל עמדה בתוך חלון התחזוקה שלה. ההתקדמות מופיעה בתור למטה.",receipts:"תוצאות לפי עמדה",receiptOk:"נכתב ואומת",receiptFail:"נכשל ({code})",partial:"חלק מהעמדות נכשלו - בדקו כל עמדה בנפרד.",queueTitle:"תור התחזוקה",noJobs:"התור ריק.",jobStates:{queued:"בתור",awaiting_approval:"ממתין לאישור",rejected:"נדחה",cancelled:"בוטל",verified:"הושלם",completed_with_errors:"הושלם עם שגיאות",expired:"פג תוקף",unknown:"לא ידוע"},rowStates:{pending:"ממתין",writing:"נכתב",verified:"אומת",failed:"נכשל",uncertain:"לא ודאי",cancelled:"בוטל",unknown:"לא ידוע"},cancelJob:"ביטול",cancelHeading:"ביטול משימת התחזוקה",cancelBody:"עמדות שעוד לא נכתבו לא ייכתבו. עמדות שכבר נכתבו נשארות כפי שהן.",retentionTitle:"שמירת אירועים",retentionHint:"כמה זמן וכמה רשומות WisKey שומר. תצוגה מקדימה מראה כמה רשומות יימחקו - המחיקה נעשית רק אחרי אישור בהקלדה.",retDays:"ימים (1-365)",retCount:"רשומות (100-20000)",retMb:"נפח (MB, 0.25-24)",retPreview:"כמה יימחק?",retRemoved:"יימחקו {removed} רשומות מתוך {before}.",retApply:"החלת המדיניות",retHeading:"החלת מדיניות שמירת האירועים",retBody:"{removed} רשומות אירוע יימחקו לצמיתות מ־WisKey.",webhookTitle:"שליחת אירועים (Webhook)",webhookHint:"WisKey שולח אירועים חתומים לכתובת https. מפתח החתימה מוצג פעם אחת לבקשה, ואינו נשמר ב־Arx.",webhookOn:"שליחה פעילה",url:"כתובת (https)",kinds:{access_event:"אירועי כניסה",security_denied:"כניסות שנדחו",configuration_result:"תוצאות שינויי הגדרות"},saveWebhook:"שמירה",webhookHeading:"שמירת ה־webhook",webhookBody:"WisKey יתחיל או יפסיק לשלוח לכתובת הזו מיד.",showKey:"הצגת מפתח החתימה",keyHeading:"הצגת מפתח החתימה",keyBody:"המפתח יוצג כאן פעם אחת. העתיקו אותו למקבל ה־webhook; Arx אינו שומר אותו.",keyShown:"מפתח החתימה (מוצג פעם אחת):",hideKey:"הסתרה",invalid:{url:"כתובת https בלבד, בלי פרמטרים",kinds:"בחרו לפחות סוג אחד",days:"בחרו לפחות יום אחד",start:"שעה לא תקינה",end:"שעת הסיום חייבת להיות אחרי ההתחלה",timezone:"אזור זמן לא תקין"},ioTitle:"ייצוא וייבוא תצורה",ioHint:"הקובץ כולל את פרטי העמדות ואת תבניות ההודעות בלבד - בלי אנשים, הרשאות, מפתחות או כתובות.",export:"ייצוא לקובץ",importLabel:"קובץ תצורה לייבוא",mapTo:"לאיזו עמדה כאן?",importPreview:"בדיקת הקובץ",importApply:"ייבוא",importHeading:"ייבוא התצורה",importBody:"פרטי {n} עמדות יוחלפו, וכל תבניות ההודעות של WisKey יוחלפו בתבניות שבקובץ ({t}).",imported:"התצורה יובאה ({n} עמדות).",saved:"נשמר."};var Ve=Object.defineProperty,Ge=Object.getOwnPropertyDescriptor,M=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ge(t,s):t,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&Ve(t,s,a),a};let H=class extends B{constructor(){super(...arguments),this.request=null,this.typed="",this.busy=!1,this.elapsed=0,this.outcome=null,this.timer=null}disconnectedCallback(){super.disconnectedCallback(),this.stopTimer()}updated(e){e.has("request")&&this.request&&(this.typed="",this.outcome=null,this.busy=!1,this.elapsed=0)}stopTimer(){this.timer!==null&&window.clearInterval(this.timer),this.timer=null}close(){this.busy||(this.request=null,this.dispatchEvent(new CustomEvent("closed",{bubbles:!0,composed:!0})))}get typedOk(){const e=this.request?.typed;if(!e)return!0;const t=s=>s.normalize("NFC").split(/\s+/).filter(Boolean).join(" ");return t(this.typed)===t(e)}async send(){const e=this.request;if(!e||this.busy||!this.typedOk)return;this.busy=!0,this.outcome=null,this.elapsed=0;const t=Date.now();this.timer=window.setInterval(()=>this.elapsed=Math.floor((Date.now()-t)/1e3),1e3);try{const s=await e.send(e.typed?this.typed:void 0);this.stopTimer(),this.busy=!1,e.done?.(s),this.request=null,this.dispatchEvent(new CustomEvent("closed",{bubbles:!0,composed:!0}))}catch(s){this.stopTimer(),this.busy=!1,this.outcome=j(s),e.failed?.(this.outcome)}}outcomeLine(e){const t=e.status==="refused"||e.status==="not_sent"?"err":"warn",s=e.status==="refused"?f(d.result.refused,{code:e.code??""}):e.status==="not_sent"?f(d.result.not_sent,{message:e.message}):d.result.unknown;return r`<div class="msg ${t}" role="alert" data-outcome=${e.status}>
      ${s}${e.retryAfterS?r` ${f(d.result.retryIn,{s:Math.ceil(e.retryAfterS)})}`:c}
    </div>`}render(){const e=this.request,t=e?.maxSeconds??30,s=Math.min(100,Math.round(this.elapsed/t*100)),i=(a,o)=>a.show?a.show(o):o==null||o===""?d.none:String(o);return r`<sw-dialog ?open=${!!e} heading=${e?.heading??""} ?locked=${this.busy} @close=${()=>this.close()} data-installer-confirm>
      ${e?r`<div class="body">
            <div>${e.body}</div>
            ${e.extra?e.extra():c}
            ${e.diff&&e.diff.length?r`<table data-diff>
                  <thead><tr><th>${d.confirm.willChange}</th><th>${d.confirm.before}</th><th>${d.confirm.after}</th></tr></thead>
                  <tbody>
                    ${e.diff.map(a=>r`<tr ?data-changed=${a.changed} data-key=${a.key}><td>${a.label}</td><td>${i(a,a.before)}</td><td class="after">${i(a,a.after)}</td></tr>`)}
                  </tbody>
                </table>`:c}
            ${e.typed?r`<label class="typed">
                  <span>${d.confirm.typeToConfirm.split("{phrase}")[0]}<b dir="auto" data-phrase>${e.typed}</b></span>
                  <input dir="auto" autocomplete="off" spellcheck="false" aria-label=${d.confirm.typedLabel} .value=${this.typed} ?disabled=${this.busy}
                    @input=${a=>this.typed=a.target.value} data-typed />
                </label>`:c}
            ${this.busy?r`<div class="wait" role="status" data-waiting>
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
    </sw-dialog>`}};H.styles=[I,R`
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
    `];M([F({attribute:!1})],H.prototype,"request",2);M([p()],H.prototype,"typed",2);M([p()],H.prototype,"busy",2);M([p()],H.prototype,"elapsed",2);M([p()],H.prototype,"outcome",2);H=M([K("wk-installer-confirm")],H);var Ye=Object.defineProperty,Qe=Object.getOwnPropertyDescriptor,z=(e,t,s,i)=>{for(var a=i>1?void 0:i?Qe(t,s):t,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&Ye(t,s,a),a};const Xe={kind:"iana",name:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"},u=d.clock;let T=class extends B{constructor(){super(...arguments),this.view=null,this.loadState="loading",this.loadError="",this.draft=null,this.confirm=null,this.flash=null,this.checks={},this.copySystem=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.view=await de();const e=this.view.settings.data;this.draft=e?{server:e.server??"",port:String(e.port??""),interval:String(e.interval??"")}:null,this.loadState="ready"}catch(e){this.loadState="error",this.loadError=e instanceof O?e.body.user_message:String(e)}}values(){return this.draft?{server:this.draft.server.trim().toLowerCase(),port:Number(this.draft.port),interval:Number(this.draft.interval)}:null}askSave(){const e=this.view?.settings.data,t=this.values();if(!e||!t||Q(t).length)return;const s={server:u.server,port:u.port,interval:u.interval},i=J({server:e.server,port:e.port,interval:e.interval},t,["server","port","interval"]).map(a=>({...a,label:s[a.key]}));this.confirm={heading:u.saveHeading,body:u.settingsHint,diff:i,maxSeconds:10,send:()=>pe(e.revision,t),done:()=>{this.flash={tone:"ok",text:d.result.completed},this.load()}}}askHost(){const e=this.view?.settings.data;!e||!this.view||(this.confirm={heading:u.hostApplyHeading,body:f(u.hostApplyBody,{server:e.server??""}),typed:this.view.host_typed_phrase,danger:!0,maxSeconds:45,send:t=>he(e.revision,t??""),done:()=>{this.flash={tone:"ok",text:f(u.hostApplied,{server:e.server??""})},this.load()}})}async check(e){this.checks={...this.checks,[e]:{busy:!0,clock:this.checks[e]?.clock??null,at:null,error:""}};try{const t=await ce(e);this.checks={...this.checks,[e]:{busy:!1,clock:t.clock,at:t.fetched_at,error:""}}}catch(t){this.checks={...this.checks,[e]:{busy:!1,clock:null,at:null,error:t instanceof O?t.body.user_message:String(t)}}}}askSync(e){const t=this.view?.settings.data;t&&(this.copySystem=!1,this.confirm={heading:f(u.syncHeading,{name:e.name}),body:f(u.syncBody,{server:t.server??"",port:t.port??"",interval:t.interval??""}),typed:e.name,danger:!0,maxSeconds:55,extra:()=>r`<label class="opt"><input type="checkbox" .checked=${this.copySystem} @change=${s=>this.copySystem=s.target.checked} data-copy-system />
        <span>${u.copySystem}</span></label>`,send:s=>ue(e.id,t.revision,this.copySystem,s??""),done:s=>{const i=s.data,a=i.clock?.measurement.estimated_skew_seconds;this.flash={tone:i.clock_verified?"ok":"warn",text:f(u.syncResult,{verified:i.clock_verified?u.verified:u.notVerified,skew:a==null?d.none:f(u.skew,{s:a})})},this.check(e.id)}})}settingsCard(){const e=this.view.settings,t=e.data;if(!t||!this.draft)return r`<sw-card heading=${u.settingsTitle} data-clock-settings="error"><div class="msg err" role="alert">${f(u.sectionUnavailable,{message:e.error?.message??""})}</div></sw-card>`;const s=this.values(),i=Q(s),a=ve(J({server:t.server,port:t.port,interval:t.interval},s)),o=this.view.defaults,h=(v,g,C)=>r`<label class="f"><span>${g}</span>
        <input inputmode=${C} dir="ltr" .value=${this.draft[v]} aria-invalid=${i.includes(v)?"true":"false"} data-ntp=${v}
          @input=${q=>this.draft={...this.draft,[v]:q.target.value}} />
        ${i.includes(v)?r`<span class="field-error">${u.invalid[v]}</span>`:c}</label>`;return r`<sw-card heading=${u.settingsTitle} subheading=${f(u.revision,{r:t.revision})} data-clock-settings="ready">
      <div class="hint">${u.settingsHint}</div>
      <div class="form">${h("server",u.server,"text")}${h("port",u.port,"numeric")}${h("interval",u.interval,"numeric")}</div>
      <div class="hint">${f(u.defaults,o)}</div>
      <div class="foot"><sw-button variant="primary" ?disabled=${!a||i.length>0} @click=${()=>this.askSave()} data-clock-save>${u.save}</sw-button></div>
    </sw-card>`}hostCard(){const e=this.view.host,t=e.data,s=this.view.settings.data;if(!t)return r`<sw-card heading=${u.hostTitle} data-clock-host="error"><div class="msg err" role="alert">${f(u.sectionUnavailable,{message:e.error?.message??""})}</div></sw-card>`;const i=s?.port===123;return r`<sw-card heading=${u.hostTitle} data-clock-host="ready">
      <div class="check"><span>${t.supported?u.hostSupported:u.hostUnsupported}</span>
        <sw-badge kind=${t.supported?"live":"offline"} label=${t.supported?d.yes:d.no}></sw-badge></div>
      ${t.supported?r`<div class="check"><span>${t.synchronized?u.hostSynced:u.hostNotSynced}</span>
              <sw-badge kind=${t.synchronized?"live":"stale"} label=${t.synchronized?d.yes:d.no}></sw-badge></div>
            <div class="check"><span>${u.hostServers}</span><span class="val" dir="ltr">${t.config?.servers.join(", ")||d.none}</span></div>`:c}
      ${t.supported&&!i?r`<div class="hint">${u.hostApplyPort}</div>`:c}
      <div class="foot"><sw-button variant="secondary" ?disabled=${!t.supported||!i||!s} @click=${()=>this.askHost()} data-clock-host-apply>${u.hostApply}</sw-button></div>
    </sw-card>`}stationRow(e){const t=this.checks[e.id],s=t?.clock??e.clock,i=s?.skew_seconds??null,a=ge(i),o=this.view.settings.data;return r`<div class="st" data-station=${e.id} data-tone=${a}>
      <div class="name"><b dir="auto">${e.name}</b><span class="muted">${e.online?d.online:d.offline}</span></div>
      <div><span class="mlabel">${u.colSkew}</span><span class="tone-${a}">${i===null?u.noClock:f(u.skew,{s:i})}</span></div>
      <div><span class="mlabel">${u.colMode}</span>${s?.time_mode?u.modes[s.time_mode]??s.time_mode:d.none}</div>
      <div><span class="mlabel">${u.colChecked}</span><span class="muted">${s?.checked_at?ie(s.checked_at,"he-IL",Xe):d.none}</span>
        ${t?.error?r`<div class="field-error" role="alert">${t.error}</div>`:c}</div>
      <div class="acts">
        <sw-button size="sm" variant="ghost" ?disabled=${t?.busy} @click=${()=>void this.check(e.id)} data-clock-check>${u.check}</sw-button>
        <sw-button size="sm" variant="secondary" ?disabled=${!e.online||!o} @click=${()=>this.askSync(e)} data-clock-sync>${u.sync}</sw-button>
      </div>
    </div>`}stationsCard(){const e=this.view.stations;return r`<sw-card heading=${u.stationsTitle} data-clock-stations>
      <div class="hint">${u.stationsHint}</div>
      ${!e||e.length===0?r`<div class="hint">${u.noStations}</div>`:r`<div class="stations">
            <div class="st head" aria-hidden="true"><span>${u.colStation}</span><span>${u.colSkew}</span><span>${u.colMode}</span><span>${u.colChecked}</span><span></span></div>
            ${e.map(t=>this.stationRow(t))}
          </div>`}
    </sw-card>`}render(){return this.loadState==="loading"?r`<sw-state-panel state="loading" heading=${d.loading} compact data-clock="loading"></sw-state-panel>`:this.loadState==="error"||!this.view?r`<sw-state-panel state="error" heading=${d.errorTitle} hint=${this.loadError} actionLabel=${d.retry} @action=${()=>void this.load()} data-clock="error"></sw-state-panel>`:r`<div class="sections" data-clock="ready">
      ${this.view.feed!=="ready"?r`<div class="msg warn" role="status">${d.feedDown}</div>`:c}
      ${this.flash?r`<div class="msg ${this.flash.tone}" role=${this.flash.tone==="err"?"alert":"status"} data-flash>${this.flash.text}</div>`:c}
      ${this.settingsCard()}${this.hostCard()}${this.stationsCard()}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${()=>this.confirm=null}></wk-installer-confirm>`}};T.styles=[I,R`
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
      label.f input[aria-invalid='true'] {
        border-color: var(--sw-danger, var(--sw-err));
      }
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
      .muted {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
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
      .opt {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .opt input {
        margin-block-start: 4px;
        inline-size: 18px;
        block-size: 18px;
      }
    `];z([p()],T.prototype,"view",2);z([p()],T.prototype,"loadState",2);z([p()],T.prototype,"loadError",2);z([p()],T.prototype,"draft",2);z([p()],T.prototype,"confirm",2);z([p()],T.prototype,"flash",2);z([p()],T.prototype,"checks",2);z([p()],T.prototype,"copySystem",2);T=z([K("installer-clock")],T);const G=R`
  label.f {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
    min-inline-size: 0;
  }
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
  label.f input[aria-invalid='true'] {
    border-color: var(--sw-danger, var(--sw-err));
  }
  .field-error {
    color: var(--sw-danger-text, var(--sw-err));
    font-size: var(--sw-fs-sm);
  }
  .muted {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
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
  .opt {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
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
`;var et=Object.defineProperty,tt=Object.getOwnPropertyDescriptor,N=(e,t,s,i)=>{for(var a=i>1?void 0:i?tt(t,s):t,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&et(t,s,a),a};const st={kind:"iana",name:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"},at=e=>t=>t==null?d.none:e==="relayReverseEnabled"?t?m.relayOn:m.relayOff:String(t);let E=class extends B{constructor(){super(...arguments),this.stations=[],this.stationId="",this.view=null,this.loading=!1,this.error="",this.drafts={},this.confirm=null,this.flash=null}async load(e=!1){if(this.stationId){this.loading=!0,this.error="";try{this.view=await we(this.stationId,e),this.drafts=Object.fromEntries(this.view.report.doors.filter(t=>t.door!==null&&t.values).map(t=>[t.door,{...t.values}]))}catch(t){this.view=null,this.error=t instanceof O?t.body.user_message:String(t)}finally{this.loading=!1}}}pick(e){this.stationId=e,this.view=null,this.flash=null,this.load()}setDraft(e,t,s){this.drafts={...this.drafts,[e]:{...this.drafts[e],[t]:s}}}askSave(e){const t=this.view;if(!t||e.door===null||!e.values)return;const s=e.door,i=e.values,a=X(i,this.drafts[s]??{}),o=be(a,t.dangerous_fields),h=t.name??t.station_id;this.confirm={heading:f(m.saveHeading,{door:f(m.door,{n:s}),name:h}),body:o?`${m.saveBody} ${m.relayWarn}`:m.saveBody,diff:J(i,{...i,...a},D).map(v=>({...v,label:m.fields[v.key],show:at(v.key)})),typed:o?t.typed_phrase??h:void 0,danger:o,maxSeconds:40,send:v=>$e(t.station_id,s,i,a,v),done:v=>{const g=v.data,C=t.report.doors.map(q=>q.door===s?g:q);this.view={...t,report:{...t.report,doors:C}},this.drafts={...this.drafts,[s]:{...g.values??{}}},this.flash={tone:"ok",text:m.saved}}}}doorCard(e){const t=this.view,s=e.door??0;if(e.error||!e.values)return r`<sw-card heading=${f(m.door,{n:s})} data-door=${s}><div class="msg err" role="alert">${f(m.doorError,{code:e.error??""})}</div></sw-card>`;const i=t.editable_doors.includes(s)&&t.online!==!1,a=this.drafts[s]??e.values,o=ye(a,e.constraints),h=X(e.values,a),v=g=>{const C=e.constraints?.[g];return!C||C.type==="boolean"?"":f(g==="doorName"?m.lengthBounds:m.bounds,{min:C.min,max:C.max})};return r`<sw-card heading=${f(m.door,{n:s})} data-door=${s} data-editable=${i?"true":"false"}>
      ${t.editable_doors.includes(s)?c:r`<div class="hint">${m.notMapped}</div>`}
      <div class="grid2">
        ${e.values.doorName!==void 0?r`<label class="f"><span>${m.fields.doorName}</span>
              <input dir="auto" .value=${String(a.doorName??"")} ?disabled=${!i} aria-invalid=${o.includes("doorName")?"true":"false"} data-field="doorName"
                @input=${g=>this.setDraft(s,"doorName",g.target.value)} />
              <span class="muted">${v("doorName")}</span>${o.includes("doorName")?r`<span class="field-error">${m.invalid}</span>`:c}</label>`:c}
        ${e.values.openDuration!==void 0?r`<label class="f"><span>${m.fields.openDuration}</span>
              <input inputmode="numeric" dir="ltr" .value=${String(a.openDuration??"")} ?disabled=${!i} aria-invalid=${o.includes("openDuration")?"true":"false"} data-field="openDuration"
                @input=${g=>{const C=g.target.value.trim();this.setDraft(s,"openDuration",C===""?NaN:Number(C))}} />
              <span class="muted">${v("openDuration")}</span>${o.includes("openDuration")?r`<span class="field-error">${m.invalid}</span>`:c}</label>`:c}
      </div>
      ${e.values.relayReverseEnabled!==void 0?r`<div class="relay">
            <label class="opt"><input type="checkbox" .checked=${!!a.relayReverseEnabled} ?disabled=${!i} data-field="relayReverseEnabled"
              @change=${g=>this.setDraft(s,"relayReverseEnabled",g.target.checked)} />
              <span>${m.fields.relayReverseEnabled}: <b>${a.relayReverseEnabled?m.relayOn:m.relayOff}</b></span></label>
            ${a.relayReverseEnabled!==e.values.relayReverseEnabled?r`<div class="msg warn" role="status">${m.relayWarn}</div>`:c}
          </div>`:c}
      ${i?r`<div class="foot"><sw-button variant="primary" ?disabled=${Object.keys(h).length===0||o.length>0} @click=${()=>this.askSave(e)} data-door-save>${m.save}</sw-button></div>`:c}
    </sw-card>`}factsCard(){const e=this.view.report,t=e.passwords;return r`<sw-card heading=${m.relays} data-relays>
        ${e.relay_selection.length?r`<div class="list">${e.relay_selection.map(s=>r`<div class="item"><span>${f(m.relayRow,{physical:s.physical_index,api:s.api_id})}${s.name?r` · <b dir="auto">${s.name}</b>`:c}</span></div>`)}</div>`:r`<div class="hint">${m.noRelays}</div>`}
      </sw-card>
      <sw-card heading=${m.passwords} data-passwords>
        ${t?r`<div class="check"><span>${m.pinState[t.public_pin_state??"unknown"]??t.public_pin_state}</span></div>
              ${Object.entries(m.passwordNames).map(([s,i])=>t.states[s]===null||t.states[s]===void 0?c:r`<div class="check"><span>${i}</span><span class="val">${t.states[s]?m.set:m.unset}</span></div>`)}`:r`<div class="hint">${e.password_error?f(m.doorError,{code:e.password_error}):d.none}</div>`}
      </sw-card>
      <sw-card heading=${m.features} data-features>
        <details><summary>${e.features.filter(s=>s.supported).length} / ${e.features.length}</summary>
          <div class="facts">${e.features.map(s=>r`<sw-badge kind=${s.supported?"live":"neutral"} label=${s.name}></sw-badge>`)}</div>
        </details>
      </sw-card>`}render(){const e=this.view;return r`<div class="sections" data-technical=${this.loading?"loading":e?"ready":this.error?"error":"empty"}>
      <sw-card>
        <div class="pickrow">
          <label class="f"><span>${m.pick}</span>
            <select class="pick" .value=${this.stationId} @change=${t=>this.pick(t.target.value)} data-station-pick>
              <option value="" ?selected=${!this.stationId}>—</option>
              ${this.stations.map(t=>r`<option value=${t.id} ?selected=${t.id===this.stationId}>${t.name}${t.online?"":` (${d.offline})`}</option>`)}
            </select></label>
          <sw-button variant="secondary" ?disabled=${!this.stationId||this.loading} @click=${()=>void this.load(!0)} data-reread>${e?m.reread:m.read}</sw-button>
        </div>
        <div class="hint">${e?.fetched_at?f(m.readAt,{at:ie(e.report.checked_at??e.fetched_at,"he-IL",st)}):m.pickHint}</div>
      </sw-card>
      ${this.flash?r`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>`:c}
      ${this.loading?r`<sw-state-panel state="loading" heading=${d.loading} compact></sw-state-panel>`:c}
      ${!this.loading&&this.error?r`<sw-state-panel state="error" heading=${d.errorTitle} hint=${this.error} actionLabel=${d.retry} @action=${()=>void this.load(!0)} compact></sw-state-panel>`:c}
      ${!this.loading&&!e&&!this.error?r`<sw-state-panel icon="door" state="empty" heading=${m.empty} compact></sw-state-panel>`:c}
      ${!this.loading&&e?r`${e.online===!1?r`<div class="msg warn" role="status">${m.offline}</div>`:c}
            ${e.report.doors.map(t=>this.doorCard(t))}${this.factsCard()}`:c}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${()=>this.confirm=null}></wk-installer-confirm>`}};E.styles=[I,G,R`
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
    `];N([F({attribute:!1})],E.prototype,"stations",2);N([p()],E.prototype,"stationId",2);N([p()],E.prototype,"view",2);N([p()],E.prototype,"loading",2);N([p()],E.prototype,"error",2);N([p()],E.prototype,"drafts",2);N([p()],E.prototype,"confirm",2);N([p()],E.prototype,"flash",2);E=N([K("installer-technical")],E);var it=Object.defineProperty,rt=Object.getOwnPropertyDescriptor,_=(e,t,s,i)=>{for(var a=i>1?void 0:i?rt(t,s):t,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&it(t,s,a),a};let y=class extends B{constructor(){super(...arguments),this.stations=[],this.list=null,this.listError="",this.flow=null,this.form={},this.busy=!1,this.stepError=null,this.reStation="",this.source="",this.target="",this.impact=null,this.reviewing=!1,this.reviewError="",this.confirm=null,this.flash=null}connectedCallback(){super.connectedCallback(),this.loadJobs()}async loadJobs(){try{this.list=await Te(),this.listError=""}catch(e){this.listError=e instanceof O?e.body.user_message:String(e)}}async begin(e){this.busy=!0,this.stepError=null,this.flash=null;try{const t=await xe(e,e==="reconfigure"?this.reStation:void 0);this.adopt(t.data,e)}catch(t){this.stepError=j(t)}finally{this.busy=!1}}adopt(e,t){if(e.type==="form"){const s=e.defaults;this.form=e.step_id==="user"||e.step_id==="reconfigure"?{name:String(s.name??""),host:String(s.host??""),username:String(s.username??"admin"),password:"",scheme:String(s.scheme??"http"),port:String(s.port??80),verify_ssl:s.verify_ssl!==!1,rtsp_port:String(s.rtsp_port??554),...this.flow?.step_id===e.step_id?{...this.form,password:""}:{}}:e.step_id==="locks"?{mode:String(e.choices.mode?.[0]??"camera_only"),lock_name:String(s.lock_name??"")}:e.step_id==="mapping"?{api_id:String(e.choices.api_id?.[0]??"")}:e.step_id==="confirm_mapping"?{result:"released_and_returned"}:{},this.flow={...e,kind:t};return}this.flow=null,this.form={},e.type==="create_entry"?this.flash={tone:"ok",text:f(l.created,{title:e.entry?.title??""})}:e.type==="abort"&&e.reason==="reconfigure_successful"?this.flash={tone:"ok",text:l.reconfigured}:e.type==="abort"&&(this.flash={tone:"warn",text:f(l.aborted,{reason:l.abortReasons[e.reason??""]??e.reason??""})}),this.loadJobs()}stepInput(){const t=this.flow.step_id;return t==="user"||t==="reconfigure"?Z(this.form,t):t==="locks"?{mode:this.form.mode,...this.form.mode!=="camera_only"||this.form.lock_name?{lock_name:String(this.form.lock_name??"")}:{}}:t==="mapping"?{api_id:Number(this.form.api_id),test_unlock:!0}:t==="confirm_mapping"?{result:this.form.result}:{}}async sendStep(e){const t=this.flow,s=await _e(t.flow_id,t.step_id,this.stepInput(),e);return this.form={...this.form,password:""},this.adopt(s.data,t.kind),s}async next(){const e=this.flow;if(!(!e||!e.step_id)){if(e.step_id==="mapping"){this.confirm={heading:l.pulseHeading,body:l.pulseWarn,typed:ke,danger:!0,maxSeconds:55,send:t=>this.sendStep(t)};return}if(Ce.includes(e.step_id)){this.confirm={heading:l.commitHeading,body:l.commitBody,maxSeconds:55,send:()=>this.sendStep()};return}this.busy=!0,this.stepError=null;try{await this.sendStep()}catch(t){this.form={...this.form,password:""},this.stepError=j(t)}finally{this.busy=!1}}}async cancelFlow(){const e=this.flow;if(e){this.busy=!0;try{await Se(e.flow_id),this.flash={tone:"warn",text:l.cancelled}}catch(t){this.stepError=j(t)}finally{this.flow=null,this.form={},this.busy=!1}}}field(e,t="text",s=""){const i=this.flow&&(this.flow.step_id==="user"||this.flow.step_id==="reconfigure")?ee(Z(this.form,this.flow.step_id),this.flow.step_id):[],a=String(this.form[e]??"")!==""||e==="password";return r`<label class="f"><span>${l.fields[e]}</span>
      <input type=${t==="number"?"text":t} inputmode=${t==="number"?"numeric":"text"} dir=${e==="name"?"auto":"ltr"}
        autocomplete=${t==="password"?"new-password":"off"} spellcheck="false" .value=${String(this.form[e]??"")} ?disabled=${this.busy}
        aria-invalid=${a&&i.includes(e)&&!(e==="password"&&!this.form.password)?"true":"false"} data-flow-field=${e}
        @input=${o=>this.form={...this.form,[e]:o.target.value}} />
      ${s?r`<span class="muted">${s}</span>`:c}</label>`}wizard(){const e=this.flow,t=e.step_id??"other",s=e.kind==="add"?["user","confirm_device","locks","mapping","confirm_mapping"]:["reconfigure","confirm_device","locks","mapping","confirm_mapping"],i=Object.values(e.errors??{});let a=r``,o=!this.busy;if(t==="user"||t==="reconfigure"){const v=ee(Z(this.form,t),t);o=o&&v.length===0,a=r`<div class="grid2">
          ${this.field("name")}${this.field("host")}${this.field("username")}${this.field("password","password",t==="reconfigure"?l.passwordKeep:"")}
          <label class="f"><span>${l.fields.scheme}</span>
            <select .value=${String(this.form.scheme)} ?disabled=${this.busy} data-flow-field="scheme" @change=${g=>this.form={...this.form,scheme:g.target.value}}>
              ${(e.choices.scheme??["http","https"]).map(g=>r`<option value=${String(g)} ?selected=${String(g)===this.form.scheme}>${g}</option>`)}
            </select></label>
          ${this.field("port","number")}${this.field("rtsp_port","number")}
        </div>
        <label class="opt"><input type="checkbox" .checked=${this.form.verify_ssl===!0} ?disabled=${this.busy} data-flow-field="verify_ssl"
          @change=${g=>this.form={...this.form,verify_ssl:g.target.checked}} /><span>${l.fields.verify_ssl}</span></label>`}else t==="confirm_device"?a=r`<div class="hint">${l.device}</div>
        <div class="check"><span>${l.model}</span><span class="val" dir="ltr">${e.device?.model??d.none}</span></div>
        <div class="check"><span>${l.firmware}</span><span class="val" dir="ltr">${e.device?.firmware??d.none}</span></div>
        <div class="check"><span>${l.serial}</span><span class="val" dir="ltr">${e.device?.serial??d.none}</span></div>`:t==="locks"?a=r`<div class="radios" role="radiogroup" aria-label=${l.fields.mode}>
          ${(e.choices.mode??["camera_only"]).map(v=>r`<label class="opt"><input type="radio" name="mode" .checked=${this.form.mode===v} ?disabled=${this.busy} data-flow-mode=${String(v)}
              @change=${()=>this.form={...this.form,mode:String(v)}} /><span>${l.modes[String(v)]??v}</span></label>`)}
        </div>
        ${this.form.mode!=="camera_only"?this.field("lock_name"):c}`:t==="mapping"?a=r`<div class="msg warn" role="status">${l.pulseWarn}</div>
        <label class="f"><span>${l.fields.api_id}</span>
          <select .value=${String(this.form.api_id)} ?disabled=${this.busy} data-flow-field="api_id" @change=${v=>this.form={...this.form,api_id:v.target.value}}>
            ${(e.choices.api_id??[]).map(v=>r`<option value=${String(v)} ?selected=${String(v)===this.form.api_id}>${v}</option>`)}
          </select></label>`:t==="confirm_mapping"&&(a=r`<div class="radios" role="radiogroup" aria-label=${l.fields.result}>
        ${(e.choices.result??[]).map(v=>r`<label class="opt"><input type="radio" name="result" .checked=${this.form.result===v} ?disabled=${this.busy} data-flow-result=${String(v)}
            @change=${()=>this.form={...this.form,result:String(v)}} /><span>${l.results[String(v)]??v}</span></label>`)}
      </div>`);const h=t==="confirm_device"?l.deviceConfirm:t==="mapping"?l.pulseButton:l.next;return r`<sw-card heading=${l.wizardTitle[e.kind]} data-wizard=${t}>
      <div class="wizard-steps" aria-label=${l.wizardTitle[e.kind]}>
        ${s.map((v,g)=>r`<span aria-current=${v===t?"step":"false"}>${g+1}. ${l.steps[v]}</span>`)}
      </div>
      ${i.length?r`<div class="msg err" role="alert" data-flow-error>${i.map(v=>l.flowErrors[v]??l.flowErrors.other).join(" · ")}</div>`:c}
      ${a}
      ${this.busy?r`<div class="hint" role="status" data-flow-busy>${l.checking}</div>`:c}
      ${this.stepError?this.outcomeLine(this.stepError):c}
      <div class="foot">
        <sw-button variant=${t==="mapping"?"danger":"primary"} ?disabled=${!o} @click=${()=>void this.next()} data-flow-next>${h}</sw-button>
        <sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>void this.cancelFlow()} data-flow-cancel>${l.cancel}</sw-button>
      </div>
    </sw-card>`}outcomeLine(e){const t=e.status==="refused"?f(d.result.refused,{code:e.code??""}):e.status==="not_sent"?f(d.result.not_sent,{message:e.message}):d.result.unknown;return r`<div class="msg ${e.status==="unknown"?"warn":"err"}" role="alert" data-outcome=${e.status}>${t}</div>`}async review(){this.reviewing=!0,this.reviewError="",this.impact=null;try{this.impact=(await Ee(this.source,this.target)).review}catch(e){this.reviewError=e instanceof O?e.body.user_message:String(e)}finally{this.reviewing=!1}}name(e){return this.stations.find(t=>t.id===e)?.name??e??""}askPrepare(){const e=this.name(this.source);this.confirm={heading:f(l.prepareHeading,{name:e}),body:l.prepareBody,maxSeconds:55,send:()=>Oe(this.source,this.target||void 0),done:()=>{this.impact=null,this.loadJobs()}}}askJob(e){const t=te(e);if(!t)return;const s=e.source_name??e.source_id??"",i={apply:l.applyHeading,verify:l.verifyHeading,remove:l.removeHeading}[t],a={apply:f(l.applyBody,{n:e.affected_people??0}),verify:l.verifyBody,remove:l.removeBody}[t];this.confirm={heading:f(i,{name:s}),body:a,typed:t==="verify"?void 0:s,danger:t!=="verify",maxSeconds:55,send:o=>ze(e,t,o),done:o=>{const h=o.data.job.state??"unknown";this.flash={tone:"ok",text:f(l.doneJob,{state:l.states[h]??h})},this.loadJobs()}}}impactView(e){const t=(s,i)=>r`<div class="num"><span class="muted">${s}</span><b>${i??d.none}</b></div>`;return r`<div data-impact>
      <div class="nums">${t(l.people,e.affected_people)}${t(l.bindings,e.known_bindings)}${t(l.unknownOwners,e.unknown_owners)}${t(l.holdPrograms,e.hold_programs)}${t(l.nativeSchedules,e.native_schedules)}</div>
      ${e.blockers.length?r`<div class="msg err" role="alert" data-blockers>${l.blockers}: ${e.blockers.map(s=>l.blockerText[s]??l.blockerText.other).join(" · ")}</div>`:r`<div class="msg ok" role="status">${l.noBlockers}</div>`}
      <div class="foot"><sw-button variant="primary" ?disabled=${e.blockers.length>0} @click=${()=>this.askPrepare()} data-prepare>${l.prepare}</sw-button></div>
    </div>`}jobRow(e){const t=He(e.state),s=te(e);return r`<div class="item" data-job=${e.id??""} data-state=${e.state??""}>
      <div class="grow">
        <b dir="auto">${e.source_name??e.source_id}${e.target_name?r` ← <span dir="auto">${e.target_name}</span>`:c}</b>
        <div class="stepper" aria-hidden="true">${[0,1,2,3].map(i=>r`<i ?data-on=${t>=i}></i>`)}</div>
        <div class="stepper-labels" aria-hidden="true">${l.stepLabels.map(i=>r`<span>${i}</span>`)}</div>
        <span class="muted">${l.states[e.state??"unknown"]??e.state}${e.affected_people!==null?` · ${l.people}: ${e.affected_people}`:""}</span>
        ${e.require_approval?r`<span class="muted">${l.approval}</span>`:c}
      </div>
      ${s?r`<sw-button size="sm" variant=${s==="verify"?"secondary":"danger"} @click=${()=>this.askJob(e)} data-job-action=${s}>${l.actions[s]}</sw-button>`:c}
    </div>`}render(){const e=this.list?.stations??this.stations;return r`<div class="sections" data-lifecycle>
      ${this.flash?r`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>`:c}
      ${this.flow?this.wizard():r`<sw-card heading=${l.addTitle} data-add>
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
                    ${e.map(t=>r`<option value=${t.id} ?selected=${t.id===this.reStation}>${t.name}</option>`)}
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
              ${e.map(t=>r`<option value=${t.id} ?selected=${t.id===this.source}>${t.name}</option>`)}
            </select></label>
          <label class="f"><span>${l.target}</span>
            <select class="pick" @change=${t=>(this.target=t.target.value,this.impact=null)} data-target-pick>
              <option value="" ?selected=${!this.target}>${l.noTarget}</option>
              ${e.filter(t=>t.id!==this.source).map(t=>r`<option value=${t.id} ?selected=${t.id===this.target}>${t.name}</option>`)}
            </select></label>
          <sw-button variant="secondary" ?disabled=${!this.source||this.reviewing} @click=${()=>void this.review()} data-review>${l.review}</sw-button>
        </div>
        ${this.reviewing?r`<sw-state-panel state="loading" heading=${d.loading} compact></sw-state-panel>`:c}
        ${this.reviewError?r`<div class="msg err" role="alert" data-review-error>${this.reviewError}</div>`:c}
        ${this.impact?this.impactView(this.impact):c}
      </sw-card>
      <sw-card heading=${l.jobs} data-jobs>
        ${this.listError?r`<div class="msg err" role="alert">${this.listError}</div>`:c}
        ${this.list&&this.list.records.length===0?r`<div class="hint">${l.noJobs}</div>`:c}
        ${this.list&&this.list.records.length?r`<div class="list">${this.list.records.map(t=>this.jobRow(t))}</div>`:c}
        <div class="foot"><sw-button variant="ghost" size="sm" @click=${()=>void this.loadJobs()} data-jobs-refresh>${l.refresh}</sw-button></div>
      </sw-card>
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${()=>this.confirm=null}></wk-installer-confirm>`}};y.styles=[I,G,R`
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
    `];_([F({attribute:!1})],y.prototype,"stations",2);_([p()],y.prototype,"list",2);_([p()],y.prototype,"listError",2);_([p()],y.prototype,"flow",2);_([p()],y.prototype,"form",2);_([p()],y.prototype,"busy",2);_([p()],y.prototype,"stepError",2);_([p()],y.prototype,"reStation",2);_([p()],y.prototype,"source",2);_([p()],y.prototype,"target",2);_([p()],y.prototype,"impact",2);_([p()],y.prototype,"reviewing",2);_([p()],y.prototype,"reviewError",2);_([p()],y.prototype,"confirm",2);_([p()],y.prototype,"flash",2);y=_([K("installer-lifecycle")],y);var nt=Object.defineProperty,ot=Object.getOwnPropertyDescriptor,$=(e,t,s,i)=>{for(var a=i>1?void 0:i?ot(t,s):t,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&nt(t,s,a),a};const se=()=>({zone:"",owner:"",tags:[],thresholds:{offline:600,sync_stalled:900,event_gap:600},window:{enabled:!1,days:[0,1,2,3,4,5,6],start:"00:00",end:"23:59",timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}}),ae=1048576,L=e=>e instanceof O?e.body.user_message:String(e);let w=class extends B{constructor(){super(...arguments),this.view=null,this.loadState="loading",this.loadError="",this.confirm=null,this.flash=null,this.metaStation="",this.meta=null,this.tagsText="",this.chosen=new Set,this.door=1,this.changeMode="config",this.changes={},this.preview=null,this.previewError="",this.receipts=null,this.ret={days:"30",count:"5000",mb:"16"},this.retPreview=null,this.hook=null,this.key="",this.importContent="",this.importMap={},this.importReview=null,this.importError=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.view=await Pe();const e=this.view.platform.data;e&&(this.hook={...e.webhook,kinds:[...e.webhook.kinds]},e.retention.days!==null&&(this.ret={days:String(e.retention.days),count:String(e.retention.count),mb:String(Math.round((e.retention.bytes??0)/ae*100)/100)})),this.metaStation&&this.pickMeta(this.metaStation),this.loadState="ready"}catch(e){this.loadState="error",this.loadError=L(e)}}get stations(){return this.view?.stations??[]}nameOf(e){return this.stations.find(t=>t.id===e)?.name??e??""}section(e,t,s,i){return e.data?r`<sw-card heading=${t} data-part=${s} data-state="ready">${i(e.data)}</sw-card>`:r`<sw-card heading=${t} data-part=${s} data-state="error"><div class="msg err" role="alert">${f(d.clock.sectionUnavailable,{message:e.error?.message??""})}</div></sw-card>`}healthCard(){const e=this.view;return this.section(e.integrity,n.healthTitle,"health",t=>{const s=t.checks.filter(a=>a.state!=="available"),i=e.platform.data?.event_usage;return r`<div class="check"><span>${n.integrity}</span>
          <sw-badge kind=${s.length?"error":"live"} label=${s.length?f(n.integrityBad,{list:s.map(a=>n.components[a.component??""]??a.component).join(", ")}):n.integrityOk}></sw-badge></div>
        ${i?r`<div class="check"><span>${n.events}</span><span class="val">${f(n.eventsLine,{records:String(i.records??d.none),limit:String(i.count_limit??d.none),rate:String(i.observed_records_per_day??d.none)})}</span></div>`:c}
        ${e.demo.data?r`<div class="hint">${n.demo}</div>`:c}
        <div class="hint">${n.noWrites}</div>`})}capacityCard(){return this.section(this.view.capacity,n.capacityTitle,"capacity",e=>r`<div class="hint">${n.capacityHint}</div>
      <div class="list">
        ${e.records.map(t=>{const s=(i,a)=>r`<div class="grow"><span class="muted">${i}: ${a.count??d.none} / ${a.advertised_limit??d.none} · ${n.alerts[a.alert??"unknown"]??a.alert}</span>
              <div class="bar" data-alert=${a.alert??"unknown"} aria-hidden="true"><span style="inline-size:${Math.min(100,a.used_percent??0)}%"></span></div>
              ${a.estimated_days_to_limit!==null?r`<span class="muted">${f(n.daysTo,{d:a.estimated_days_to_limit})}</span>`:c}</div>`;return r`<div class="item" data-capacity=${t.station_id??""}><div class="grow"><b dir="auto">${t.name??t.station_id}</b></div>${s(n.users,t.users)}${s(n.cards,t.cards)}</div>`})}
      </div>`)}pickMeta(e){this.metaStation=e;const t=this.view?.platform.data?.stations[e]?.values;this.meta=t?JSON.parse(JSON.stringify(t)):se(),this.meta&&!this.meta.window&&(this.meta.window=se().window),this.tagsText=(this.meta?.tags??[]).join(", ")}metaValues(){const e=this.meta;return{...e,zone:e.zone??"",owner:e.owner??"",tags:this.tagsText.split(",").map(t=>t.trim()).filter(Boolean),window:e.window}}askMeta(){const e=this.view?.platform.data;if(!e||!this.meta)return;const t=this.metaValues(),s=e.stations[this.metaStation]?.values??null;this.confirm={heading:f(n.metaHeading,{name:this.nameOf(this.metaStation)}),body:n.metaBody,diff:J(s?{zone:s.zone,owner:s.owner,tags:s.tags.join(", "),window:JSON.stringify(s.window)}:null,{zone:t.zone,owner:t.owner,tags:t.tags.join(", "),window:JSON.stringify(t.window)}).map(i=>({...i,label:i.key==="zone"?n.zone:i.key==="owner"?n.owner:i.key==="tags"?n.tags:n.windowOn})),maxSeconds:15,send:()=>Re(this.metaStation,e.revision,t),done:()=>{this.flash={tone:"ok",text:n.saved},this.load()}}}metaCard(){const e=this.meta,t=e?.window,s=t?Ue(t):[],i=a=>this.meta={...e,window:{...t,...a}};return r`<sw-card heading=${n.metaTitle} data-meta>
      <div class="hint">${n.metaHint}</div>
      <div class="pickrow"><label class="f"><span>${m.pick}</span>
        <select class="pick" @change=${a=>this.pickMeta(a.target.value)} data-meta-pick>
          <option value="" ?selected=${!this.metaStation}>—</option>
          ${this.stations.map(a=>r`<option value=${a.id} ?selected=${a.id===this.metaStation}>${a.name}</option>`)}
        </select></label></div>
      ${e&&t?r`<div class="grid2">
              <label class="f"><span>${n.zone}</span><input dir="auto" .value=${e.zone??""} @input=${a=>this.meta={...e,zone:a.target.value}} data-meta-field="zone" /></label>
              <label class="f"><span>${n.owner}</span><input dir="auto" .value=${e.owner??""} @input=${a=>this.meta={...e,owner:a.target.value}} /></label>
              <label class="f"><span>${n.tags}</span><input dir="auto" .value=${this.tagsText} @input=${a=>this.tagsText=a.target.value} /></label>
              ${["offline","sync_stalled","event_gap"].map(a=>r`<label class="f"><span>${n.thresholds[a]}</span><input inputmode="numeric" dir="ltr" .value=${String(e.thresholds[a]??"")}
                  @input=${o=>this.meta={...e,thresholds:{...e.thresholds,[a]:Number(o.target.value)}}} /></label>`)}
            </div>
            <label class="opt"><input type="checkbox" .checked=${t.enabled} @change=${a=>i({enabled:a.target.checked})} data-window-on /><span>${n.windowOn}</span></label>
            ${t.enabled?r`<div class="days" role="group" aria-label=${n.dayNames}>
                    ${n.days.map((a,o)=>r`<label><input type="checkbox" .checked=${t.days.includes(o)}
                      @change=${h=>i({days:h.target.checked?[...t.days,o].sort():t.days.filter(v=>v!==o)})} />${a}</label>`)}
                  </div>
                  <div class="grid2">
                    <label class="f"><span>${n.start}</span><input type="time" dir="ltr" lang=${Y()} .value=${t.start??""} aria-invalid=${s.includes("start")?"true":"false"} @input=${a=>i({start:a.target.value})} /></label>
                    <label class="f"><span>${n.end}</span><input type="time" dir="ltr" lang=${Y()} .value=${t.end??""} aria-invalid=${s.includes("end")?"true":"false"} @input=${a=>i({end:a.target.value})} /></label>
                    <label class="f"><span>${n.timezone}</span><input dir="ltr" .value=${t.timezone??""} @input=${a=>i({timezone:a.target.value})} /></label>
                  </div>
                  ${s.length?r`<div class="field-error" role="alert">${s.map(a=>n.invalid[a]??a).join(" · ")}</div>`:c}`:c}
            <div class="foot"><sw-button variant="primary" ?disabled=${s.length>0} @click=${()=>this.askMeta()} data-meta-save>${n.saveMeta}</sw-button></div>`:c}
    </sw-card>`}async runPreview(){this.preview=null,this.previewError="",this.receipts=null;try{this.preview=(await Ae(this.changeMode,[...this.chosen],this.door,this.changes)).data}catch(e){this.previewError=L(e)}}askChange(){const e=this.preview,t=this.view.typed[this.changeMode==="config"?"config_apply":"maint_enqueue"];if(!e?.review_id)return;const s=e.count??0,i=this.changeMode==="config";this.confirm={heading:f(i?n.applyHeading:n.enqueueHeading,{n:s}),body:i?n.applyBody:n.enqueueBody,typed:t,danger:!0,maxSeconds:58,send:a=>i?qe(e.review_id,a??""):je(e.review_id,a??""),done:a=>{if(this.preview=null,i){this.receipts=a.data.receipts;const o=Ze(this.receipts);this.flash=o.failed?{tone:"warn",text:n.partial}:{tone:"ok",text:d.result.completed}}else this.flash={tone:"ok",text:d.result.completed};this.load()}}}changeCard(){const e=(s,i)=>{const a={...this.changes};i===""||i===void 0||typeof i=="number"&&!Number.isFinite(i)?delete a[s]:a[s]=i,this.changes=a,this.preview=null},t=this.chosen.size>=1&&this.chosen.size<=12&&Object.keys(this.changes).length>0;return r`<sw-card heading=${n.changeTitle} data-change>
      <div class="hint">${n.changeHint}</div>
      <div class="days" role="group" aria-label=${n.stations}>
        ${this.stations.map(s=>r`<label><input type="checkbox" .checked=${this.chosen.has(s.id)} data-change-station=${s.id}
          @change=${i=>{const a=new Set(this.chosen);i.target.checked?a.add(s.id):a.delete(s.id),this.chosen=a,this.preview=null}} /><span dir="auto">${s.name}</span></label>`)}
      </div>
      <div class="grid2">
        <label class="f"><span>${n.door}</span><select @change=${s=>(this.door=Number(s.target.value),this.preview=null)} data-change-door>
          <option value="1" ?selected=${this.door===1}>1</option><option value="2" ?selected=${this.door===2}>2</option></select></label>
        <label class="f"><span>${n.mode}</span><select @change=${s=>(this.changeMode=s.target.value,this.preview=null)} data-change-mode>
          <option value="config" ?selected=${this.changeMode==="config"}>${n.modeNow}</option><option value="maintenance" ?selected=${this.changeMode==="maintenance"}>${n.modeWindow}</option></select></label>
        <label class="f"><span>${m.fields.doorName}</span><input dir="auto" .value=${String(this.changes.doorName??"")} @input=${s=>e("doorName",s.target.value)} data-change-field="doorName" /></label>
        <label class="f"><span>${m.fields.openDuration}</span><input inputmode="numeric" dir="ltr" .value=${String(this.changes.openDuration??"")}
          @input=${s=>{const i=s.target.value.trim();e("openDuration",i===""?"":Number(i))}} data-change-field="openDuration" /></label>
      </div>
      <div class="foot"><sw-button variant="secondary" ?disabled=${!t} @click=${()=>void this.runPreview()} data-change-preview>${n.preview}</sw-button></div>
      ${this.previewError?r`<div class="msg err" role="alert">${this.previewError}</div>`:c}
      ${this.preview?r`<div class="scroll"><table data-change-rows>
              <thead><tr><th>${m.pick}</th><th>${d.confirm.before}</th><th>${d.confirm.after}</th></tr></thead>
              <tbody>${this.preview.rows.map(s=>r`<tr data-row=${s.station_id??""}><td dir="auto">${s.name??s.station_id}</td>
                ${s.error?r`<td colspan="2" class="field-error">${s.error}</td>`:r`<td>${D.filter(i=>i in this.changes).map(i=>r`<div>${m.fields[i]}: ${String(s.before?.[i]??d.none)}</div>`)}</td>
                         <td>${D.filter(i=>i in this.changes).map(i=>r`<div><b>${m.fields[i]}: ${String(s.after?.[i]??d.none)}</b></div>`)}</td>`}</tr>`)}</tbody>
            </table></div>
            ${this.preview.review_id?r`<div class="foot"><sw-button variant="danger" @click=${()=>this.askChange()} data-change-apply>${this.changeMode==="config"?n.apply:n.enqueue}</sw-button></div>`:r`<div class="hint">${n.previewEmpty}</div>`}`:c}
      ${this.receipts?r`<div class="list" data-receipts aria-label=${n.receipts}>${this.receipts.map(s=>r`<div class="item" data-receipt=${s.station_id??""} data-state=${s.state??""}>
              <span dir="auto">${this.nameOf(s.station_id)}</span>
              <sw-badge kind=${s.state==="verified"?"live":"error"} label=${s.state==="verified"?n.receiptOk:f(n.receiptFail,{code:s.code??""})}></sw-badge></div>`)}</div>`:c}
    </sw-card>`}queueCard(){return this.section(this.view.maintenance,n.queueTitle,"queue",e=>e.records.length===0?r`<div class="hint">${n.noJobs}</div>`:r`<div class="list">${e.records.map(t=>r`<div class="item" data-maint-job=${t.id??""} data-state=${t.state??""}>
            <div class="grow"><b>${n.jobStates[t.state??"unknown"]??t.state}</b>
              ${t.rows.map(s=>r`<span class="muted"><span dir="auto">${s.name??s.station_id}</span> · ${n.rowStates[s.state??"unknown"]??s.state}${s.code?` (${s.code})`:""}</span>`)}</div>
            ${t.state==="queued"||t.state==="awaiting_approval"?r`<sw-button size="sm" variant="ghost" @click=${()=>this.confirm={heading:n.cancelHeading,body:n.cancelBody,maxSeconds:15,send:()=>Je(t),done:()=>void this.load()}} data-maint-cancel>${n.cancelJob}</sw-button>`:c}
          </div>`)}</div>`)}retValues(){return{days:Number(this.ret.days),count:Number(this.ret.count),bytes:Math.round(Number(this.ret.mb)*ae)}}async runRetPreview(){try{const e=(await Le(this.retValues())).data;this.retPreview={review_id:e.review_id,before:e.before,removed:e.removed}}catch(e){this.flash={tone:"warn",text:L(e)}}}retentionCard(){const e=this.retValues(),t=Number.isInteger(e.days)&&e.days>=1&&e.days<=365&&Number.isInteger(e.count)&&e.count>=100&&e.count<=2e4&&e.bytes>=262144&&e.bytes<=25165824,s=a=>o=>(this.ret={...this.ret,[a]:o.target.value},this.retPreview=null),i=this.retPreview;return r`<sw-card heading=${n.retentionTitle} data-retention>
      <div class="hint">${n.retentionHint}</div>
      <div class="grid2">
        <label class="f"><span>${n.retDays}</span><input inputmode="numeric" dir="ltr" .value=${this.ret.days} @input=${s("days")} data-ret="days" /></label>
        <label class="f"><span>${n.retCount}</span><input inputmode="numeric" dir="ltr" .value=${this.ret.count} @input=${s("count")} data-ret="count" /></label>
        <label class="f"><span>${n.retMb}</span><input inputmode="decimal" dir="ltr" .value=${this.ret.mb} @input=${s("mb")} data-ret="mb" /></label>
      </div>
      ${i?r`<div class="msg ${i.removed?"warn":"ok"}" role="status" data-ret-preview>${f(n.retRemoved,{removed:i.removed??0,before:i.before??0})}</div>`:c}
      <div class="foot">
        <sw-button variant="secondary" ?disabled=${!t} @click=${()=>void this.runRetPreview()} data-ret-check>${n.retPreview}</sw-button>
        ${i?r`<sw-button variant="danger" @click=${()=>this.confirm={heading:n.retHeading,body:f(n.retBody,{removed:i.removed??0}),typed:this.view.typed.retention_apply,danger:!0,maxSeconds:30,send:a=>De(i.review_id,a??""),done:()=>(this.retPreview=null,this.flash={tone:"ok",text:d.result.completed},void this.load())}} data-ret-apply>${n.retApply}</sw-button>`:c}
      </div>
    </sw-card>`}webhookCard(){const e=this.hook,t=this.view.platform.data;if(!e||!t)return r``;const s=Fe(e),i=JSON.stringify({...e,kinds:[...e.kinds].sort()})!==JSON.stringify({...t.webhook,kinds:[...t.webhook.kinds].sort()});return r`<sw-card heading=${n.webhookTitle} data-webhook>
      <div class="hint">${n.webhookHint}</div>
      <label class="opt"><input type="checkbox" .checked=${e.enabled} @change=${a=>this.hook={...e,enabled:a.target.checked}} data-hook-on /><span>${n.webhookOn}</span></label>
      <label class="f"><span>${n.url}</span><input dir="ltr" inputmode="url" .value=${e.url} aria-invalid=${s.includes("url")?"true":"false"} @input=${a=>this.hook={...e,url:a.target.value.trim()}} data-hook-url />
        ${s.includes("url")?r`<span class="field-error">${n.invalid.url}</span>`:c}</label>
      <div class="days" role="group">${Object.entries(n.kinds).map(([a,o])=>r`<label><input type="checkbox" .checked=${e.kinds.includes(a)}
        @change=${h=>this.hook={...e,kinds:h.target.checked?[...e.kinds,a]:e.kinds.filter(v=>v!==a)}} />${o}</label>`)}</div>
      ${s.includes("kinds")?r`<div class="field-error">${n.invalid.kinds}</div>`:c}
      ${this.key?r`<div class="hint">${n.keyShown}</div><div class="key" data-hook-key>${this.key}</div>`:c}
      <div class="foot">
        <sw-button variant="primary" ?disabled=${!i||s.length>0} @click=${()=>this.confirm={heading:n.webhookHeading,body:n.webhookBody,maxSeconds:15,send:()=>Ie(t.revision,{...e,kinds:[...e.kinds].sort()}),done:()=>(this.flash={tone:"ok",text:n.saved},void this.load())}} data-hook-save>${n.saveWebhook}</sw-button>
        ${this.key?r`<sw-button variant="ghost" @click=${()=>this.key=""} data-hook-hide>${n.hideKey}</sw-button>`:r`<sw-button variant="ghost" @click=${()=>this.confirm={heading:n.keyHeading,body:n.keyBody,typed:this.view.typed.webhook_key,danger:!0,maxSeconds:15,send:a=>Be(a??""),done:a=>this.key=a.data.key}} data-hook-key-show>${n.showKey}</sw-button>`}
      </div>
    </sw-card>`}async download(){try{const e=await We(),t=new Blob([JSON.stringify(e.data,null,2)],{type:"application/json"}),s=document.createElement("a");s.href=URL.createObjectURL(t),s.download="intercom-configuration.json",s.click(),setTimeout(()=>URL.revokeObjectURL(s.href),1e3)}catch(e){this.flash={tone:"warn",text:L(e)}}}async readFile(e){const t=e.target.files?.[0];if(this.importReview=null,this.importError="",!!t){this.importContent=(await t.text()).slice(0,6e4);try{const s=JSON.parse(this.importContent);this.importMap=Object.fromEntries(Object.keys(s.stations??{}).map(i=>[i,this.stations.some(a=>a.id===i)?i:""]))}catch{this.importError=d.errorTitle}}}ioCard(){const e=this.importReview,t=Object.values(this.importMap).every(Boolean);return r`<sw-card heading=${n.ioTitle} data-io>
      <div class="hint">${n.ioHint}</div>
      <div class="foot"><sw-button variant="secondary" @click=${()=>void this.download()} data-export>${n.export}</sw-button></div>
      <label class="f"><span>${n.importLabel}</span><input type="file" accept="application/json,.json" @change=${s=>void this.readFile(s)} data-import-file /></label>
      ${Object.keys(this.importMap).map(s=>r`<label class="f"><span dir="auto">${s} → ${n.mapTo}</span>
        <select @change=${i=>(this.importMap={...this.importMap,[s]:i.target.value},this.importReview=null)} data-import-map=${s}>
          <option value="" ?selected=${!this.importMap[s]}>—</option>${this.stations.map(i=>r`<option value=${i.id} ?selected=${i.id===this.importMap[s]}>${i.name}</option>`)}
        </select></label>`)}
      ${this.importError?r`<div class="msg err" role="alert">${this.importError}</div>`:c}
      ${this.importContent?r`<div class="foot"><sw-button variant="secondary" ?disabled=${!t} @click=${async()=>{try{this.importReview=(await Ke(this.importContent,this.importMap)).data,this.importError=""}catch(s){this.importError=L(s)}}} data-import-preview>${n.importPreview}</sw-button>
            ${e?r`<sw-button variant="danger" @click=${()=>this.confirm={heading:n.importHeading,body:f(n.importBody,{n:e.stations.length,t:e.templates??0}),typed:this.view.typed.import_apply,danger:!0,maxSeconds:30,send:s=>Me(e.review_id,s??""),done:()=>(this.importReview=null,this.importContent="",this.importMap={},this.flash={tone:"ok",text:f(n.imported,{n:e.stations.length})},void this.load())}}
                  data-import-apply>${n.importApply}</sw-button>`:c}</div>`:c}
    </sw-card>`}render(){return this.loadState==="loading"?r`<sw-state-panel state="loading" heading=${d.loading} compact data-platform="loading"></sw-state-panel>`:this.loadState==="error"||!this.view?r`<sw-state-panel state="error" heading=${d.errorTitle} hint=${this.loadError} actionLabel=${d.retry} @action=${()=>void this.load()} data-platform="error"></sw-state-panel>`:r`<div class="sections" data-platform="ready">
      ${this.flash?r`<div class="msg ${this.flash.tone}" role="status" data-flash>${this.flash.text}</div>`:c}
      ${this.healthCard()}${this.capacityCard()}${this.metaCard()}${this.changeCard()}${this.queueCard()}${this.retentionCard()}${this.webhookCard()}${this.ioCard()}
    </div>
    <wk-installer-confirm .request=${this.confirm} @closed=${()=>this.confirm=null}></wk-installer-confirm>`}};w.styles=[I,G,R`
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
    `];$([p()],w.prototype,"view",2);$([p()],w.prototype,"loadState",2);$([p()],w.prototype,"loadError",2);$([p()],w.prototype,"confirm",2);$([p()],w.prototype,"flash",2);$([p()],w.prototype,"metaStation",2);$([p()],w.prototype,"meta",2);$([p()],w.prototype,"tagsText",2);$([p()],w.prototype,"chosen",2);$([p()],w.prototype,"door",2);$([p()],w.prototype,"changeMode",2);$([p()],w.prototype,"changes",2);$([p()],w.prototype,"preview",2);$([p()],w.prototype,"previewError",2);$([p()],w.prototype,"receipts",2);$([p()],w.prototype,"ret",2);$([p()],w.prototype,"retPreview",2);$([p()],w.prototype,"hook",2);$([p()],w.prototype,"key",2);$([p()],w.prototype,"importContent",2);$([p()],w.prototype,"importMap",2);$([p()],w.prototype,"importReview",2);$([p()],w.prototype,"importError",2);w=$([K("installer-platform")],w);var lt=Object.defineProperty,dt=Object.getOwnPropertyDescriptor,A=(e,t,s,i)=>{for(var a=i>1?void 0:i?dt(t,s):t,o=e.length-1,h;o>=0;o--)(h=e[o])&&(a=(i?h(t,s,a):h(a))||a);return i&&a&&lt(t,s,a),a};const V=["clock","technical","lifecycle","platform"],ct="#/system/intercom-installer";let W=class extends B{constructor(){super(...arguments),this.view="",this.overview=null,this.loadState="loading",this.loadError=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.loadState="loading";try{this.overview=await le(),this.loadState="ready"}catch(e){this.loadState=e instanceof O&&e.status===403?"forbidden":"error",this.loadError=e instanceof O?e.body.user_message:String(e)}}updated(){const e=this.renderRoot.querySelector("nav.tabs"),t=e?.querySelector('a[aria-current="page"]');if(e&&t){const s=e.getBoundingClientRect(),i=t.getBoundingClientRect();i.left<s.left?e.scrollLeft-=s.left-i.left+8:i.right>s.right&&(e.scrollLeft+=i.right-s.right+8)}}get tool(){return V.includes(this.view)?this.view:V[0]}body(e){const t=this.overview?.tools[e];if(t&&t.available===!1)return r`<sw-state-panel icon="wrench" state="empty" heading=${d.unavailableTool} hint=${t.missing.join(", ")} data-tool-unavailable></sw-state-panel>`;const s=t&&t.available===null?r`<div class="msg warn" role="status">${d.unknownTool}</div>`:c;return e==="clock"?r`${s}<installer-clock></installer-clock>`:e==="technical"?r`${s}<installer-technical .stations=${this.overview?.stations??[]}></installer-technical>`:e==="lifecycle"?r`${s}<installer-lifecycle .stations=${this.overview?.stations??[]}></installer-lifecycle>`:e==="platform"?r`${s}<installer-platform></installer-platform>`:r``}render(){const e=(s,i)=>r`<sw-page crumbs="הגדרות" heading=${d.title} subheading=${d.sub} data-installer data-state=${i}>${s}</sw-page>`;if(this.loadState==="loading")return e(r`<sw-state-panel state="loading" heading=${d.loading}></sw-state-panel>`,"loading");if(this.loadState==="forbidden")return e(r`<sw-state-panel state="forbidden" heading=${d.forbiddenTitle} hint=${d.forbiddenHint}></sw-state-panel>`,"forbidden");if(this.loadState==="error")return e(r`<sw-state-panel state="error" heading=${d.errorTitle} hint=${this.loadError} actionLabel=${d.retry} @action=${()=>void this.load()}></sw-state-panel>`,"error");const t=this.tool;return e(r`<nav class="tabs" aria-label=${d.title}>
          ${V.map(s=>r`<a href="${ct}/${s}" aria-current=${s===t?"page":"false"} data-installer-tab=${s}>${d.tabs[s]}</a>`)}
        </nav>
        <div data-installer-tool=${t}>${this.body(t)}</div>`,"ready")}};W.styles=[I,R`
      :host {
        display: block;
      }
      nav.tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
        margin-block-end: 16px;
        border-block-end: 1px solid var(--sw-border);
      }
      nav.tabs::-webkit-scrollbar {
        display: none;
      }
      nav.tabs a {
        flex: none;
        padding: 10px 14px;
        color: var(--sw-text-2);
        text-decoration: none;
        font-weight: var(--sw-fw-medium);
        border-block-end: 2px solid transparent;
        margin-block-end: -1px;
        white-space: nowrap;
      }
      nav.tabs a[aria-current='page'] {
        color: var(--sw-accent-text);
        border-block-end-color: var(--sw-accent);
      }
      nav.tabs a:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: -2px;
      }
      @media (hover: hover) and (pointer: fine) {
        nav.tabs a:hover {
          color: var(--sw-text);
        }
      }
    `];A([F()],W.prototype,"view",2);A([p()],W.prototype,"overview",2);A([p()],W.prototype,"loadState",2);A([p()],W.prototype,"loadError",2);W=A([K("system-intercom-installer")],W);export{ct as INSTALLER_HREF,V as INSTALLER_TOOLS,W as SystemIntercomInstaller};
//# sourceMappingURL=system-intercom-installer-CkHOT0mG.js.map
