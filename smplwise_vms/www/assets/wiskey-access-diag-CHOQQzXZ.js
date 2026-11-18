import{b4 as v,bn as M,i0 as U,h$ as K,cE as B,cG as j,bE as G,i as Q,a3 as Y,a as N,n as k,b as n,A as c,ei as Z,g as J,ay as X,j as l,k as ee}from"./index-BiEy1mLY.js";import{U as q,o as ie,b as te}from"./wiskey-format-BHz0qsef.js";import{a as O}from"./deep-links-Xyxg7QFI.js";import"./sw-logo-art-MaHPMZFI.js";import"./wiskey-Crws_8DU.js";const y=e=>{const i=new URLSearchParams;for(const[a,o]of Object.entries(e))o!=null&&o!==""&&i.set(a,String(o));const s=i.toString();return s?`?${s}`:""},m="access-control/diag",se=()=>v(m),ae=(e,i,s=0,a=25)=>v(`${m}/options${y({kind:e,query:i,offset:s,limit:a})}`),ne=(e,i,s,a)=>v(`${m}/scenario${y({user_id:e,station_id:i,lock_id:s,at:a})}`),oe=(e,i,s)=>v(`${m}/compare${y({left_kind:e,left_id:i,right_kind:e,right_id:s})}`),re=(e,i)=>v(`${m}/compare-doors${y({left:e,right:i})}`),de=(e,i,s="all",a=0,o="")=>v(`${m}/reviews${y({station_id:e,lock_id:i,state:s,offset:a,limit:50,snapshot:o})}`),le=(e,i,s)=>v(`${m}/reviews/preview${y({user_id:e,station_id:i,lock_id:s})}`),ce=(e="all",i="current",s=0,a="")=>v(`${m}/quality${y({kind:e,state:i,offset:s,limit:50,snapshot:a})}`),pe=e=>v(`${m}/lifecycle${y({days:e})}`),ue=()=>v(`${m}/sync`),he=e=>v(`${m}/stations/${encodeURIComponent(e)}/permission-audit`);function me(e,i=K()){const s=new Date(i+15e3).toISOString().replace(/\.\d{3}Z$/,"Z");return M(`${m}/reviews/decide`,{...e,confirmed:!0,client_request_id:U(),expires_at:s})}const z={title:"אבחון הרשאות",sub:"למה דלת נפתחה או לא נפתחה, מי מאבד גישה בקרוב, ומה דורש סקירה",loading:"טוען…",noPermission:"אין הרשאה לאבחון הרשאות",noPermissionHint:"נדרשת צפייה בבקרת הכניסה בכל ההתקנה.",loadError:"לא ניתן לטעון את אבחון ההרשאות",retry:"נסו שוב",unavailable:"מערכת בקרת הכניסה אינה זמינה כרגע",unsupported:"הבדיקה הזו אינה זמינה במערכת בקרת הכניסה המותקנת",openPanel:"פתיחה בחלון האינטרקום",peopleNeeded:"הבדיקה הזו מציגה אנשים ודורשת צפייה באנשים בכל ההתקנה.",readOnly:"קריאה בלבד · לא נשלח דבר לעמדה",notPhysical:"זו תחזית לפי המדיניות שבמערכת. מה שקרה בדלת עצמה לא נבדק כאן.",fetched:"עודכן {t}",v_scenario:"האם יכול לפתוח",v_compare:"השוואה",v_reviews:"סקירות תקופתיות",v_quality:"איכות נתונים",v_lifecycle:"פג תוקף בקרוב",v_audit:"ביקורת עמדה",v_sync:"סנכרון",views:"תצוגות אבחון",person:"אדם",personPh:"חיפוש לפי שם",pickPerson:"בחירת אדם",noMatches:"לא נמצאו התאמות",door:"דלת",pickDoor:"בחירת דלת",doorLabel:"{station} · דלת {n}",doorNamed:"{station} · {door}",when:"מתי",now:"עכשיו",atTime:"בזמן מסוים",check:"בדיקה",checking:"בודק…",timeInvalid:"הזמן אינו תקין",timeAmbiguous:"השעה הזו חוזרת פעמיים במעבר שעון. בחרו שעה אחרת.",timeMissing:"השעה הזו אינה קיימת במעבר שעון. בחרו שעה אחרת.",yes:"כן, מורשה לפתוח",no:"לא מורשה לפתוח",answerFor:"{person} · {door} · {at}",why:"למה",r_allowed:"יש לו הרשאה לדלת הזו, בתוקף ובתוך לוח הזמנים.",r_archived:"האדם בארכיון.",r_inactive:"האדם מושבת.",r_no_assignment:"אין לו הרשאה בעמדה הזו.",r_lock_not_assigned:"יש לו הרשאה בעמדה, אבל לא לדלת הזו.",r_outside_validity:"מחוץ לתקופת התוקף שלו.",r_outside_schedule:"מחוץ ללוח הזמנים שלו בשעה הזו.",r_unknown:"מערכת בקרת הכניסה החזירה סיבה שאינה מוכרת.",src_inherited:"ההרשאה מגיעה מקבוצה: {groups}",src_personal_allow:"הרשאה אישית לעמדה הזו",src_personal_deny:"חסימה אישית בעמדה הזו",src_assignment:"הרשאה ישירה לעמדה",src_none:"אין לו הרשאה כלשהי לדלת הזו",src_restricted:"מקור ההרשאה מוסתר בהיקף ההרשאות שלך",src_group_policy:"מדיניות קבוצה",src_unknown:"מקור ההרשאה לא ידוע",validity:"תוקף",validityAlways:"ללא הגבלת תוקף",validityUntil:"עד {t}",validityFrom:"מ־{t}",validityRange:"{from} – {until}",schedule:"לוח זמנים",t_unrestricted:"ללא הגבלת שעות",t_ha:"לפי לוח זמנים של המערכת",t_native:"לפי לוח זמנים בעמדה",t_unknown:"לא ידוע",draftIgnored:"יש טיוטת לוח זמנים שעדיין לא הוחלה, והיא לא נחשבת.",holidays:"חגים",holidaysNote:"מערכת בקרת הכניסה אינה מחשבת חגים בבדיקה הזו.",station:"עמדה",stationOnline:"מחוברת",stationOffline:"לא מחוברת",sync:"סנכרון לעמדה",sync_synced:"מסונכרן",sync_pending:"ממתין לסנכרון",sync_syncing:"מסנכרן",sync_offline:"העמדה לא מחוברת",sync_conflict:"התנגשות",sync_error:"שגיאת סנכרון",sync_delete_pending:"ממתין למחיקה",sync_unknown:"לא ידוע",syncBehind:"השינוי האחרון עדיין לא הגיע לעמדה.",lastSync:"סנכרון אחרון {t}",evidence:"בדיקה אחרונה בעמדה ({t}): {range}",person_archived:"בארכיון",person_inactive:"מושבת",compareKind:"מה משווים",k_people:"שני אנשים",k_groups:"שתי קבוצות",k_doors:"שתי דלתות",group:"קבוצה",groupPh:"חיפוש קבוצה",first:"ראשון",second:"שני",compare:"השוואה",rel_shared:"שניהם",rel_left_only:"רק {name}",rel_right_only:"רק {name}",rel_neither:"אף אחד",rel_unknown:"לא ידוע",sumShared:"משותף",doorsCompareHint:"מי מורשה בכל אחת משתי הדלתות, לפי המדיניות שבמערכת.",noAssignment:"ללא הרשאה בעמדה",incomplete:"הרשימה חלקית (יותר מ־1,000 אנשים או שהנתונים השתנו בזמן הקריאה).",noRows:"אין דלתות להשוואה",noPeopleRows:"אף אחד לא משויך לשתי הדלתות",reviewDoor:"דלת לסקירה",st_all:"הכול",st_pending:"לא נסקר",st_due:"הגיע מועד",st_stale:"השתנה מאז הסקירה",st_completed:"נסקר",st_followup:"למעקב",st_archived:"בארכיון",st_unknown:"לא ידוע",granted:"מורשה",notGranted:"לא מורשה",lastDecision:"החלטה אחרונה: {d} · {t}",decidedBy:"על ידי {who}",nextReview:"סקירה הבאה {t}",d_keep:"להשאיר",d_followup:"למעקב",d_unknown:"לא ידוע",review:"סקירה",noReviews:"אין אנשים עם הרשאה בדלת הזו",reviewTitle:"סקירת הרשאה",reviewHint:"ההחלטה נרשמת כקבלה במערכת בקרת הכניסה. היא לא משנה הרשאות ולא נשלחת לעמדה.",decision:"החלטה",reason:"סיבה",reasonPh:"למשל: נבדק מול רשימת העובדים",cadence:"הסקירה הבאה בעוד",days:"{n} ימים",history:"היסטוריה",noHistory:"אין החלטות קודמות",confirmTitle:"לרשום את ההחלטה?",confirmBody:"{decision} את ההרשאה של {person} ל{door}. סקירה הבאה בעוד {n} ימים.",confirm:"רישום ההחלטה",cancel:"ביטול",close:"סגירה",saving:"שומר…",saved:"ההחלטה נרשמה",decideViewOnly:"רישום החלטה אינו זמין כאן. אפשר לרשום אותה בחלון האינטרקום.",decideNoPermission:"אין לך הרשאה לנהל אנשים בעמדה הזו - צפייה בלבד.",stale:"הנתונים השתנו מאז שנטענו. טענו מחדש.",reload:"טעינה מחדש",more:"עוד",prev:"הקודם",next:"הבא",pageOf:"{from}–{to} מתוך {total}",q_all:"כל הבעיות",q_missing:"חסר",q_invalid:"לא תקין",q_duplicate:"כפילות",q_current:"פעילים",q_archived:"בארכיון",q_everyone:"כולם",scanned:"נבדקו {n} אנשים",peopleIssues:"אנשים עם בעיות",noIssues:"לא נמצאו בעיות בנתונים",dupWith:"זהה ל־{names}",c_missing_phone:"חסר מספר טלפון",c_invalid_phone:"מספר טלפון לא תקין",c_duplicate_display_name:"שם זהה לאדם אחר",c_duplicate_phone:"טלפון זהה לאדם אחר",c_duplicate_profile:"ערך זהה בשדה ייחודי: {label}",c_profile_required:"חסר שדה חובה: {label}",c_profile:"שדה {label}: ערך לא תקין",c_other:"בעיה בנתונים",window:"בתוך",lifeHint:"מי מאבד גישה בתקופה הקרובה לפי תאריך סיום התוקף.",expiring:"יאבדו גישה",expired:"התוקף פג",temporary:"מבקרים וקבלנים",duplicates:"כפילויות אפשריות",withoutCred:"פעילים בלי אמצעי זיהוי",credHidden:"הרשימה הזו דורשת צפייה בפרטים רגישים.",inDays:"בעוד {n} ימים",inHours:"בעוד {n} שעות",agoDays:"לפני {n} ימים",today:"היום",noneExpiring:"אף אחד לא מאבד גישה בתקופה הזו",tmp_active:"פעיל",tmp_upcoming:"טרם התחיל",tmp_expired:"פג תוקף",tmp_inactive:"מושבת",tmp_unknown:"",doorsCount:"{n} עמדות",cat_staff:"עובד",cat_visitor:"מבקר",cat_contractor:"קבלן",cat_unknown:"",dup_display_name:"אותו שם",dup_phone:"אותו טלפון",dup_card_last4:"כרטיסים עם אותן ספרות אחרונות",dup_unknown:"כפילות",truncated:"מוצגים 200 הראשונים בלבד.",auditHint:"משווה את המשתמשים שבעמדה למה שמערכת בקרת הכניסה מצפה שיהיה בה. קריאה בלבד - לא נכתב דבר לעמדה.",runAudit:"בדיקת העמדה",auditing:"קורא מהעמדה…",auditFor:"בדיקה של {station} · {t}",a_matched:"תואם",a_drift:"שונה",a_unmanaged:"לא מנוהל",a_unverified:"לא נבדק",a_unknown:"לא ידוע",unmanagedUser:"משתמש בעמדה שאינו במערכת",diff_presence:"קיים / לא קיים",diff_display_name:"שם",diff_user_type:"סוג משתמש",diff_validity:"תוקף",diff_door_rights:"דלתות",diff_pin:"קוד",diff_schedule:"לוח זמנים",diff_privileged:"הרשאת ניהול",diff_other_credentials:"אמצעי זיהוי אחרים",diff_cards:"כרטיסים",diff_other:"אחר",auditIncomplete:"בעמדה יותר מ־1,000 משתמשים - הבדיקה חלקית.",pickStation:"בחירת עמדה",stationOfflineNote:"העמדה לא מחוברת ולכן אי אפשר לבדוק אותה.",noAuditYet:'בחרו עמדה ולחצו "בדיקת העמדה".',syncHint:"מצב עובדי הסנכרון של מערכת בקרת הכניסה. העמדות מזוהות בקוד מקוצר בלבד.",version:"גרסה {v}",stationRef:"עמדה {ref}",worker:"עובד פעיל",pendingReq:"בקשה ממתינה",targets:"{n} אנשים לעדכון",recentFailures:"כשלים אחרונים",recent:"שלבים אחרונים",noFailures:"אין כשלים בשלבים האחרונים",noStations:"אין עמדות",e_forbidden:"אין הרשאה",e_generic:"הבקשה נכשלה"},H={title:"Access diagnostics",sub:"Why a door opened or did not open, who loses access soon, and what needs a review",loading:"Loading…",noPermission:"No permission for access diagnostics",noPermissionHint:"Viewing access control across the whole installation is required.",loadError:"Access diagnostics could not be loaded",retry:"Try again",unavailable:"The access control system is not available right now",unsupported:"This check is not available in the installed access control system",openPanel:"Open in the intercom window",peopleNeeded:"This check shows people and needs viewing people across the whole installation.",readOnly:"Read only · nothing is sent to the station",notPhysical:"This is a forecast by the policy in the system. What actually happened at the door is not checked here.",fetched:"Updated {t}",v_scenario:"Can they open?",v_compare:"Compare",v_reviews:"Periodic reviews",v_quality:"Data quality",v_lifecycle:"Expiring soon",v_audit:"Station audit",v_sync:"Sync",views:"Diagnostics views",person:"Person",personPh:"Search by name",pickPerson:"Choose a person",noMatches:"No matches found",door:"Door",pickDoor:"Choose a door",doorLabel:"{station} · door {n}",doorNamed:"{station} · {door}",when:"When",now:"Now",atTime:"At a set time",check:"Check",checking:"Checking…",timeInvalid:"The time is not valid",timeAmbiguous:"This time occurs twice at the clock change. Choose another time.",timeMissing:"This time does not exist at the clock change. Choose another time.",yes:"Yes, allowed to open",no:"Not allowed to open",answerFor:"{person} · {door} · {at}",why:"Why",r_allowed:"They have permission for this door, within its validity and within the schedule.",r_archived:"The person is archived.",r_inactive:"The person is deactivated.",r_no_assignment:"They have no permission on this station.",r_lock_not_assigned:"They have permission on the station, but not for this door.",r_outside_validity:"Outside their validity period.",r_outside_schedule:"Outside their schedule at this time.",r_unknown:"The access control system returned a reason that is not recognised.",src_inherited:"The permission comes from a group: {groups}",src_personal_allow:"Personal permission on this station",src_personal_deny:"Personal block on this station",src_assignment:"Direct permission on the station",src_none:"They have no permission at all for this door",src_restricted:"The source of the permission is hidden by the scope of your permissions",src_group_policy:"Group policy",src_unknown:"The source of the permission is unknown",validity:"Validity",validityAlways:"No validity limit",validityUntil:"Until {t}",validityFrom:"From {t}",validityRange:"{from} – {until}",schedule:"Schedule",t_unrestricted:"No time limit",t_ha:"By a system schedule",t_native:"By a schedule on the station",t_unknown:"Unknown",draftIgnored:"There is a draft schedule that has not been applied yet, and it is not counted.",holidays:"Holidays",holidaysNote:"The access control system does not take holidays into account in this check.",station:"Station",stationOnline:"Online",stationOffline:"Offline",sync:"Sync to the station",sync_synced:"Synced",sync_pending:"Waiting to sync",sync_syncing:"Syncing",sync_offline:"The station is offline",sync_conflict:"Conflict",sync_error:"Sync error",sync_delete_pending:"Waiting to be deleted",sync_unknown:"Unknown",syncBehind:"The latest change has not reached the station yet.",lastSync:"Last sync {t}",evidence:"Last check at the station ({t}): {range}",person_archived:"Archived",person_inactive:"Deactivated",compareKind:"What to compare",k_people:"Two people",k_groups:"Two groups",k_doors:"Two doors",group:"Group",groupPh:"Search for a group",first:"First",second:"Second",compare:"Compare",rel_shared:"Both",rel_left_only:"Only {name}",rel_right_only:"Only {name}",rel_neither:"Neither",rel_unknown:"Unknown",sumShared:"Shared",doorsCompareHint:"Who is allowed at each of the two doors, by the policy in the system.",noAssignment:"No permission on the station",incomplete:"The list is partial (more than 1,000 people, or the data changed while it was being read).",noRows:"No doors to compare",noPeopleRows:"Nobody is assigned to both doors",reviewDoor:"Door to review",st_all:"All",st_pending:"Not reviewed",st_due:"Due",st_stale:"Changed since the review",st_completed:"Reviewed",st_followup:"Follow up",st_archived:"Archived",st_unknown:"Unknown",granted:"Allowed",notGranted:"Not allowed",lastDecision:"Last decision: {d} · {t}",decidedBy:"by {who}",nextReview:"Next review {t}",d_keep:"Keep",d_followup:"Follow up",d_unknown:"Unknown",review:"Review",noReviews:"Nobody has permission at this door",reviewTitle:"Permission review",reviewHint:"The decision is recorded as a receipt in the access control system. It does not change permissions and is not sent to the station.",decision:"Decision",reason:"Reason",reasonPh:"For example: checked against the staff list",cadence:"Next review in",days:"{n} days",history:"History",noHistory:"No earlier decisions",confirmTitle:"Record the decision?",confirmBody:"{decision}: {person}'s permission for {door}. Next review in {n} days.",confirm:"Record the decision",cancel:"Cancel",close:"Close",saving:"Saving…",saved:"The decision was recorded",decideViewOnly:"Recording a decision is not available here. You can record it in the intercom window.",decideNoPermission:"You do not have permission to manage people on this station - view only.",stale:"The data changed since it was loaded. Reload.",reload:"Reload",more:"More",prev:"Previous",next:"Next",pageOf:"{from}–{to} of {total}",q_all:"All issues",q_missing:"Missing",q_invalid:"Invalid",q_duplicate:"Duplicate",q_current:"Active",q_archived:"Archived",q_everyone:"Everyone",scanned:"{n} people checked",peopleIssues:"People with issues",noIssues:"No data issues found",dupWith:"Same as {names}",c_missing_phone:"Phone number missing",c_invalid_phone:"Phone number not valid",c_duplicate_display_name:"Same name as another person",c_duplicate_phone:"Same phone as another person",c_duplicate_profile:"Same value in a unique field: {label}",c_profile_required:"Required field missing: {label}",c_profile:"{label} field: value not valid",c_other:"Data issue",window:"Within",lifeHint:"Who loses access in the coming period, by the end date of their validity.",expiring:"Will lose access",expired:"Expired",temporary:"Visitors and contractors",duplicates:"Possible duplicates",withoutCred:"Active without credentials",credHidden:"This list needs permission to view sensitive details.",inDays:"In {n} days",inHours:"In {n} hours",agoDays:"{n} days ago",today:"Today",noneExpiring:"Nobody loses access in this period",tmp_active:"Active",tmp_upcoming:"Not started yet",tmp_expired:"Expired",tmp_inactive:"Deactivated",tmp_unknown:"",doorsCount:"{n} stations",cat_staff:"Staff",cat_visitor:"Visitor",cat_contractor:"Contractor",cat_unknown:"",dup_display_name:"Same name",dup_phone:"Same phone",dup_card_last4:"Cards with the same last digits",dup_unknown:"Duplicate",truncated:"Only the first 200 are shown.",auditHint:"Compares the users on the station with what the access control system expects to be there. Read only - nothing is written to the station.",runAudit:"Check the station",auditing:"Reading from the station…",auditFor:"Check of {station} · {t}",a_matched:"Matches",a_drift:"Differs",a_unmanaged:"Not managed",a_unverified:"Not checked",a_unknown:"Unknown",unmanagedUser:"A user on the station who is not in the system",diff_presence:"Present / absent",diff_display_name:"Name",diff_user_type:"User type",diff_validity:"Validity",diff_door_rights:"Doors",diff_pin:"Code",diff_schedule:"Schedule",diff_privileged:"Admin rights",diff_other_credentials:"Other credentials",diff_cards:"Cards",diff_other:"Other",auditIncomplete:"The station has more than 1,000 users - the check is partial.",pickStation:"Choose a station",stationOfflineNote:"The station is offline, so it cannot be checked.",noAuditYet:'Choose a station and press "Check the station".',syncHint:"The state of the access control system's sync workers. Stations are identified by a short code only.",version:"Version {v}",stationRef:"Station {ref}",worker:"Worker running",pendingReq:"Request waiting",targets:"{n} people to update",recentFailures:"Recent failures",recent:"Recent steps",noFailures:"No failures in the recent steps",noStations:"No stations",e_forbidden:"No permission",e_generic:"The request failed"};function t(e,i={}){const s=(B(["en"])==="en"?H[e]:void 0)??z[e]??e;return j(s,i)}function h(e,i,s={}){return Object.prototype.hasOwnProperty.call(z,e)?t(e,s):t(i,s)}G("i18n/access-diag",{he:z,en:H});const I=["scenario","compare","reviews","quality","lifecycle","audit","sync"];function E(e){const i=e?.get("view")??"";return I.includes(i)?i:"scenario"}const ve="/wiskey/access-diag",fe=e=>`#${ve}${e==="scenario"?"":`?view=${e}`}`,ge={scenario:"scenario",compare:"compare",reviews:"reviews",quality:"quality",lifecycle:"lifecycle",audit:"permission_audit",sync:"sync"},we=["scenario","compare","reviews","quality","lifecycle","audit"];function A(e,i){return e?e.features[ge[i]]?.available===!1?"unsupported":we.includes(i)&&!e.can.people?"people":"ok":"ok"}const F=(e,i)=>`${e}:${i}`;function f(e){const i=/^(.+):([12])$/.exec(e);return i?{station_id:i[1],lock_id:Number(i[2])}:null}function W(e){const i=[];for(const s of e??[])for(const a of s.doors){const o=a.name?t("doorNamed",{station:s.name,door:a.name}):s.doors.length===1?s.name:t("doorLabel",{station:s.name,n:a.lock_id});i.push({key:F(s.id,a.lock_id),station_id:s.id,lock_id:a.lock_id,label:o,online:s.online})}return i}function b(e,i,s){return i?W(e).find(a=>a.key===F(i,s??1))?.label??i:"—"}function g(e,i=q){if(!e||!/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(e))return"";const s=Date.parse(e);if(!Number.isFinite(s))return"";const a=new Date(s+ie(s,i??q)*1e3).toISOString();return`${Number(a.slice(8,10))}.${Number(a.slice(5,7))}.${a.slice(0,4)} ${a.slice(11,16)}`}function $(e,i=q){return g(e,i).split(" ")[0]??""}function R(e){if(e==null||!Number.isFinite(e))return"";if(e<0){const i=Math.floor(-e/86400);return i>=1?t("agoDays",{n:i}):t("today")}if(e<86400){const i=Math.max(1,Math.round(e/3600));return i>=24?t("inDays",{n:1}):t("inHours",{n:i})}return t("inDays",{n:Math.round(e/86400)})}function T(e,i,s){const a=$(e,s),o=$(i,s);return a&&o?t("validityRange",{from:a,until:o}):o?t("validityUntil",{t:o}):a?t("validityFrom",{t:a}):t("validityAlways")}function P(e){return e?e.source==="inherited"?t("src_inherited",{groups:e.groups.map(i=>i.name||i.id).join(", ")||"—"}):h(`src_${e.source}`,"src_unknown"):t("src_unknown")}function ye(e,i,s){const a=e.desired.reason,o=[{id:"reason",tone:e.desired.allowed?"ok":"bad",label:t("why"),text:h(`r_${a}`,"r_unknown")}];if(e.source){const _=e.source.source==="personal_deny"||e.source.source==="none";o.push({id:"source",tone:e.source.granted?"ok":_?"bad":"warn",label:t("group"),text:P(e.source)})}const p=e.person;if(p){const _=p.archived?t("person_archived"):p.active===!1?t("person_inactive"):"",C=T(p.valid_from,p.valid_until,s),V=a==="outside_validity"||a==="archived"||a==="inactive";o.push({id:"validity",tone:V?"bad":"info",label:t("validity"),text:_?`${_} · ${C}`:C})}o.push({id:"schedule",tone:a==="outside_schedule"?"bad":"info",label:t("schedule"),text:h(`t_${e.desired.timing_mode}`,"t_unknown")+(e.desired.draft_ignored?` · ${t("draftIgnored")}`:"")}),o.push({id:"holidays",tone:"info",label:t("holidays"),text:t("holidaysNote")}),i&&o.push({id:"station",tone:i.online?"info":"warn",label:t("station"),text:`${i.name} · ${i.online?t("stationOnline"):t("stationOffline")}`});const u=e.observed,D=[h(`sync_${u.sync_state}`,"sync_unknown")];!u.revision_matches&&u.sync_state!=="unknown"&&D.push(t("syncBehind")),u.last_sync_at&&D.push(t("lastSync",{t:g(u.last_sync_at,s)})),o.push({id:"sync",tone:u.sync_state==="synced"&&u.revision_matches?"info":"warn",label:t("sync"),text:D.join(" · ")});const w=u.timing;if(w.status!=="unavailable"&&w.checked_at&&(w.valid_from||w.valid_until)){const _=`${g(w.valid_from,s)||"…"} – ${g(w.valid_until,s)||"…"}`;o.push({id:"evidence",tone:w.interval_contains_target===!1?"warn":"info",label:t("schedule"),text:t("evidence",{t:g(w.checked_at,s),range:_})})}return o}function x(e,i,s){return e==="left_only"?t("rel_left_only",{name:i}):e==="right_only"?t("rel_right_only",{name:s}):h(`rel_${e}`,"rel_unknown")}function S(e){return e==="shared"?"ok":e==="neither"||e==="unknown"?"neutral":"warn"}function _e(e){const i=[];for(const s of e){const a=i[i.length-1];a&&a.station_id===s.station_id?a.rows.push(s):i.push({station_id:s.station_id,station_name:s.station_name||s.station_id,rows:[s]})}return i}const $e=["all","pending","due","stale","followup","completed","archived"];function be(e){return e==="completed"?"ok":e==="due"||e==="stale"?"bad":e==="pending"||e==="followup"?"warn":"neutral"}const ke=[30,90,180,365];function L(e){const i=e.split(/\s+/).filter(Boolean).join(" ");return!i||i.length>500||/[\u0000-\u001f]/.test(i)?null:i}function xe(e){const i=e.label||e.field_id||"—";return e.code.startsWith("duplicate_profile")?t("c_duplicate_profile",{label:i}):e.code==="profile_required"?t("c_profile_required",{label:i}):e.code.startsWith("profile_")?t("c_profile",{label:i}):h(`c_${e.code}`,"c_other",{label:i})}function Se(e){return h(`diff_${e}`,"diff_other")}function De(e){const i=e.filter(a=>a.state==="expiring").sort((a,o)=>(a.seconds_remaining??0)-(o.seconds_remaining??0)),s=e.filter(a=>a.state!=="expiring").sort((a,o)=>(o.seconds_remaining??0)-(a.seconds_remaining??0));return[...i,...s]}const qe=[7,14,30,60,90];var Re=Object.defineProperty,Te=Object.getOwnPropertyDescriptor,d=(e,i,s,a)=>{for(var o=a>1?void 0:a?Te(i,s):i,p=e.length-1,u;p>=0;p--)(u=e[p])&&(o=(a?u(i,s,o):u(o))||o);return a&&o&&Re(i,s,o),o};function Pe(e){const i=e.valid_until?Date.parse(e.valid_until):NaN;return Number.isFinite(i)?`${t("expiring")} ${R(Math.round((i-Date.now())/1e3))}`:t("expiring")}const ze={reviews:"access.reviews",compare:"access.compare",quality:"people.quality",lifecycle:"people.lifecycle",audit:"audit.panel",scenario:"people.unmanaged",sync:"sync.run"};let r=class extends Q{constructor(){super(...arguments),this.route=null,this.view="scenario",this.home=null,this.homeLoad="loading",this.homeError="",this.load="idle",this.error="",this.head=null,this.person=null,this.door="",this.whenMode="now",this.whenValue="",this.timeError="",this.scenario=null,this.queries={},this.options={},this.openPicker="",this.cmpKind="person",this.left=null,this.right=null,this.leftDoor="",this.rightDoor="",this.comparison=null,this.doorComparison=null,this.reviewDoor="",this.reviewState="all",this.reviews=null,this.reviewOffset=0,this.openReview=null,this.preview=null,this.previewError="",this.decision="keep",this.reason="",this.cadence=90,this.confirming=!1,this.saving=!1,this.decideLine=null,this.qKind="all",this.qState="current",this.quality=null,this.days=30,this.lifecycle=null,this.auditStation="",this.audit=null,this.sync=null,this.seq=0,this.searchTimer=0}connectedCallback(){super.connectedCallback(),this.loadHome()}disconnectedCallback(){window.clearTimeout(this.searchTimer),super.disconnectedCallback()}willUpdate(e){if(e.has("route")){const i=E(this.route?.params);i!==this.view&&(this.view=i,this.resetView(),this.homeLoad==="ready"&&this.autoLoad())}}resetView(){this.seq++,this.load="idle",this.error="",this.head=null,this.openPicker=""}get zone(){return this.home?.default_zone??null}get doors(){return W(this.home?.doors)}async loadHome(){if(this.homeLoad="loading",!Y()){this.homeLoad="forbidden";return}try{this.home=await se(),this.view=E(this.route?.params);const e=this.doors[0]?.key??"";this.door||=e,this.reviewDoor||=e,this.leftDoor||=e,this.rightDoor||=this.doors[1]?.key??e,this.auditStation||=this.home.doors?.find(i=>i.online)?.id??"",this.homeLoad="ready",this.autoLoad()}catch(e){this.homeLoad=e instanceof N&&e.status===403?"forbidden":"error",this.homeError=k(e)}}autoLoad(){A(this.home,this.view)==="ok"&&(this.view==="reviews"&&this.reviewDoor?this.loadReviews(0):this.view==="quality"?this.loadQuality(0):this.view==="lifecycle"?this.loadLifecycle():this.view==="sync"&&this.loadSync())}async run(e,i){const s=++this.seq;this.load="loading",this.error="";try{const a=await e();if(s!==this.seq)return;if(this.head=a,a.state!=="ready"||!i(a)){this.load="error",this.error=a.state==="unsupported"||a.state==="forbidden"?t("unsupported"):t("unavailable");return}this.load="ready"}catch(a){if(s!==this.seq)return;this.load="error",this.error=a instanceof N&&a.code==="diag_unsupported"?t("unsupported"):k(a)}}search(e,i,s){this.queries={...this.queries,[e]:s},this.openPicker=e,window.clearTimeout(this.searchTimer),this.searchTimer=window.setTimeout(async()=>{try{const a=await ae(i,s.trim(),0,8);if(this.queries[e]!==s)return;this.options={...this.options,[e]:a.options?.records??[]}}catch{this.options={...this.options,[e]:[]}}},250)}renderPicker(e,i,s,a,o){if(s)return n`<label class="f">${o}
        <span class="chosen" data-diag-chosen=${e}><span>${s.name||s.id}</span>
          <button type="button" aria-label=${t("pickPerson")} @click=${()=>a(null)}><sw-icon name="close" size=${16}></sw-icon></button></span></label>`;const p=this.options[e];return n`<label class="f">${o}
      <input type="search" data-diag-picker=${e} autocomplete="off" placeholder=${t(i==="person"?"personPh":"groupPh")} .value=${this.queries[e]??""}
        @input=${u=>this.search(e,i,u.target.value)} @focus=${()=>this.search(e,i,this.queries[e]??"")}
        @keydown=${u=>u.key==="Escape"&&(this.openPicker="")} />
      ${this.openPicker===e&&p?n`<ul class="picker-list" role="listbox" data-diag-options=${e}>
            ${p.length?p.map(u=>n`<li role="option" aria-selected="false"><button type="button" data-diag-option=${u.id}
                  @click=${()=>{a({id:u.id,name:u.name}),this.openPicker=""}}>${u.name||u.id}${u.archived?n`<span class="muted">· ${t("person_archived")}</span>`:c}</button></li>`):n`<li class="none">${t("noMatches")}</li>`}
          </ul>`:c}
    </label>`}renderDoorSelect(e,i,s,a){return n`<div class="f"><span>${e}</span>
      <sw-dropdown block data-diag-door=${a} label=${e} .value=${i}
        .items=${this.doors.map(o=>({id:o.key,label:`${o.label}${o.online?"":` · ${t("stationOffline")}`}`}))}
        @change=${o=>s(o.detail.id)}></sw-dropdown></div>`}render(){const e=t("title");return this.homeLoad==="loading"?n`<sw-page heading=${e}><sw-state-panel state="loading" heading=${t("loading")} data-diag-state="loading"></sw-state-panel></sw-page>`:this.homeLoad==="forbidden"?n`<sw-page heading=${e}><sw-state-panel quiet state="forbidden" heading=${t("noPermission")} hint=${t("noPermissionHint")} data-diag-state="forbidden"></sw-state-panel></sw-page>`:this.homeLoad==="error"||!this.home?n`<sw-page heading=${e}><sw-state-panel state="error" heading=${t("loadError")} hint=${this.homeError} actionLabel=${t("retry")} @action=${()=>void this.loadHome()}
        data-diag-state="error"></sw-state-panel></sw-page>`:n`<sw-page wide heading=${e} subheading=${t("sub")} data-diag data-diag-state="ready" data-diag-view=${this.view}>
      <div class="stack">
        <nav class="views" aria-label=${t("views")} data-diag-views>
          ${I.map(i=>n`<a href=${fe(i)} data-diag-tab=${i} aria-current=${i===this.view?"page":"false"}>${h(`v_${i}`,"title")}</a>`)}
        </nav>
        ${this.renderView()}
      </div>
      ${this.renderReviewDialog()}
    </sw-page>`}renderView(){const e=A(this.home,this.view),i=ze[this.view];if(e==="unsupported")return n`<div class="card" data-diag-unsupported=${this.view}><p class="note">${t("unsupported")}</p>
        ${i?n`<a class="link" href=${O(i)} data-diag-panel>${t("openPanel")}</a>`:c}</div>`;if(e==="people")return n`<div class="card" data-diag-people-needed><p class="note">${t("peopleNeeded")}</p></div>`;switch(this.view){case"scenario":return this.renderScenario();case"compare":return this.renderCompare();case"reviews":return this.renderReviews();case"quality":return this.renderQuality();case"lifecycle":return this.renderLifecycle();case"audit":return this.renderAudit();default:return this.renderSync()}}status(){return this.load==="loading"?n`<sw-state-panel compact state="loading" heading=${t("loading")} data-diag-loading></sw-state-panel>`:this.load==="error"?n`<p class="note bad" role="alert" data-diag-error>${this.error}</p>`:c}fetched(){const e=this.head?.fetched_at;return e?n`<span class="muted" data-diag-fetched>${t("fetched",{t:g(e,this.zone)})}</span>`:c}async check(){const e=f(this.door);if(!this.person||!e)return;let i=null;if(this.timeError="",this.whenMode==="at"){try{i=te(this.whenValue,this.zone??void 0)}catch(a){const o=a.message;this.timeError=t(o==="clock_ambiguous"?"timeAmbiguous":o==="clock_nonexistent"?"timeMissing":"timeInvalid");return}if(!i){this.timeError=t("timeInvalid");return}}const s=this.person;await this.run(()=>ne(s.id,e.station_id,e.lock_id,i),a=>(this.scenario=a,!!a.scenario))}renderScenario(){const e=this.load==="ready"?this.scenario:null;return n`<section class="card" data-diag-scenario>
        <div class="form">
          ${this.renderPicker("scenario","person",this.person,i=>this.person=i,t("person"))}
          ${this.renderDoorSelect(t("door"),this.door,i=>this.door=i,"scenario")}
          <div class="f">
            <span class="muted">${t("when")}</span>
            <div class="seg" role="group" aria-label=${t("when")}>
              <button type="button" aria-pressed=${String(this.whenMode==="now")} data-diag-when="now" @click=${()=>this.whenMode="now"}>${t("now")}</button>
              <button type="button" aria-pressed=${String(this.whenMode==="at")} data-diag-when="at" @click=${()=>this.whenMode="at"}>${t("atTime")}</button>
            </div>
          </div>
          ${this.whenMode==="at"?n`<label class="f">${t("atTime")}<input type="datetime-local" lang=${Z()} data-diag-at .value=${this.whenValue}
                @input=${i=>this.whenValue=i.target.value} /></label>`:c}
        </div>
        ${this.timeError?n`<p class="note bad" role="alert" data-diag-time-error>${this.timeError}</p>`:c}
        <div class="acts">
          <sw-button variant="primary" icon="search" data-diag-check ?disabled=${!this.person||!this.door||this.load==="loading"} @click=${()=>void this.check()}>
            ${this.load==="loading"?t("checking"):t("check")}</sw-button>
          <span class="muted">${t("readOnly")}</span>
        </div>
      </section>
      ${this.status()}
      ${e&&e.scenario?this.renderAnswer(e):c}`}renderAnswer(e){const i=e.scenario,s=i.desired.allowed,a=e.station?e.station.door_name?t("doorNamed",{station:e.station.name,door:e.station.door_name}):b(this.home?.doors,i.station_id,i.lock_id):"—",o=ye(i,e.station,this.zone);return n`<section class="card" data-diag-answer=${s?"yes":"no"} data-diag-reason=${i.desired.reason} aria-live="polite">
      <div class="verdict ${s?"ok":"bad"}">
        <sw-icon name=${s?"check":"lock"} size=${28}></sw-icon>
        <div><b>${t(s?"yes":"no")}</b>
          <span class="sub">${t("answerFor",{person:i.person?.name||this.person?.name||"—",door:a,at:g(i.at,this.zone)})}</span></div>
      </div>
      <dl class="lines">
        ${o.map(p=>n`<dt data-diag-line=${p.id}><span class="dot ${p.tone}"></span>${p.label}</dt><dd>${p.text}</dd>`)}
      </dl>
      <p class="note">${t("notPhysical")}</p>
      <div class="acts">${this.fetched()}</div>
    </section>`}async compare(){if(this.comparison=null,this.doorComparison=null,this.cmpKind==="doors"){await this.run(()=>re(this.leftDoor,this.rightDoor),a=>(this.doorComparison=a.doors,!!a.doors));return}if(!this.left||!this.right)return;const e=this.cmpKind,[i,s]=[this.left.id,this.right.id];await this.run(()=>oe(e,i,s),a=>(this.comparison=a.compare,!!a.compare))}setKind(e){e!==this.cmpKind&&(this.cmpKind=e,this.left=null,this.right=null,this.comparison=null,this.doorComparison=null,this.resetView())}renderCompare(){const e=this.cmpKind,i=e==="doors"?this.leftDoor&&this.rightDoor&&this.leftDoor!==this.rightDoor:!!(this.left&&this.right);return n`<section class="card" data-diag-compare=${e}>
        <div class="seg" role="group" aria-label=${t("compareKind")}>
          ${["person","group","doors"].map(s=>n`<button type="button" aria-pressed=${String(e===s)} data-diag-kind=${s}
            @click=${()=>this.setKind(s)}>${t(s==="person"?"k_people":s==="group"?"k_groups":"k_doors")}</button>`)}
        </div>
        <div class="form">
          ${e==="doors"?n`${this.renderDoorSelect(t("first"),this.leftDoor,s=>this.leftDoor=s,"left")}${this.renderDoorSelect(t("second"),this.rightDoor,s=>this.rightDoor=s,"right")}`:n`${this.renderPicker("left",e,this.left,s=>this.left=s,t("first"))}${this.renderPicker("right",e,this.right,s=>this.right=s,t("second"))}`}
        </div>
        <div class="acts"><sw-button variant="primary" icon="layers" data-diag-run ?disabled=${!i||this.load==="loading"} @click=${()=>void this.compare()}>${t("compare")}</sw-button>
          ${e==="doors"?n`<span class="muted">${t("doorsCompareHint")}</span>`:c}</div>
      </section>
      ${this.status()}
      ${this.load==="ready"&&this.comparison?this.renderComparison(this.comparison):c}
      ${this.load==="ready"&&this.doorComparison?this.renderDoorComparison(this.doorComparison):c}`}summary(e,i,s){return n`<div class="kpis" data-diag-summary>
      <sw-kpi layout="compact" icon="users" data-diag-kpi="shared" label=${t("sumShared")} value=${String(e.shared??0)}></sw-kpi>
      <sw-kpi layout="compact" icon="door" data-diag-kpi="left_only" label=${x("left_only",i,s)} value=${String(e.left_only??0)}></sw-kpi>
      <sw-kpi layout="compact" icon="door" data-diag-kpi="right_only" label=${x("right_only",i,s)} value=${String(e.right_only??0)}></sw-kpi>
      <sw-kpi layout="compact" icon="lock" data-diag-kpi="neither" label=${t("rel_neither")} value=${String(e.neither??0)}></sw-kpi>
    </div>`}renderComparison(e){const[i,s]=[e.left.name||e.left.id||t("first"),e.right.name||e.right.id||t("second")],a=_e(e.rows);return n`<section class="card" data-diag-comparison>
      ${this.summary(e.summary,i,s)}
      ${a.length?a.map(o=>n`<h3>${o.station_name}</h3><ul class="rows">${o.rows.map(p=>n`<li data-diag-row=${`${p.station_id}:${p.lock_id}`}>
            <span class="name">${b(this.home?.doors,p.station_id,p.lock_id)}</span>
            <sw-badge kind=${S(p.relation)==="ok"?"live":S(p.relation)==="warn"?"partial":"neutral"} label=${x(p.relation,i,s)}
              data-diag-relation=${p.relation}></sw-badge>
            <div class="side"><span><b>${i}:</b> ${p.left.granted?t("granted"):t("notGranted")} · ${P(p.left)}</span>
              <span><b>${s}:</b> ${p.right.granted?t("granted"):t("notGranted")} · ${P(p.right)}</span></div>
          </li>`)}</ul>`):n`<p class="note">${t("noRows")}</p>`}
      <div class="acts">${this.fetched()}</div>
    </section>`}renderDoorComparison(e){const i=b(this.home?.doors,f(this.leftDoor)?.station_id??null,f(this.leftDoor)?.lock_id??1),s=b(this.home?.doors,f(this.rightDoor)?.station_id??null,f(this.rightDoor)?.lock_id??1);return n`<section class="card" data-diag-door-comparison>
      ${this.summary(e.summary,i,s)}
      ${e.complete?c:n`<p class="note">${t("incomplete")}</p>`}
      ${e.rows.length?n`<ul class="rows">${e.rows.map(a=>n`<li data-diag-person=${a.user_id}>
            <span class="name">${a.display_name||a.user_id}${a.archived?n` <span class="muted">· ${t("person_archived")}</span>`:c}</span>
            <sw-badge kind=${S(a.relation)==="ok"?"live":S(a.relation)==="warn"?"partial":"neutral"} label=${x(a.relation,i,s)}
              data-diag-relation=${a.relation}></sw-badge>
            <div class="side"><span><b>${i}:</b> ${a.left_assigned?a.left?t("granted"):t("notGranted"):t("noAssignment")}</span>
              <span><b>${s}:</b> ${a.right_assigned?a.right?t("granted"):t("notGranted"):t("noAssignment")}</span></div>
          </li>`)}</ul>`:n`<p class="note">${t("noPeopleRows")}</p>`}
      <div class="acts">${this.fetched()}</div>
    </section>`}async loadReviews(e){const i=f(this.reviewDoor);if(!i)return;const s=e?this.reviews?.snapshot??"":"";await this.run(()=>de(i.station_id,i.lock_id,this.reviewState,e,s),a=>(this.reviews=a.reviews,this.reviewOffset=e,!!a.reviews))}renderReviews(){const e=this.load==="ready"?this.reviews:null;return n`<section class="card" data-diag-reviews>
        <div class="form">${this.renderDoorSelect(t("reviewDoor"),this.reviewDoor,i=>{this.reviewDoor=i,this.loadReviews(0)},"reviews")}</div>
        <div class="seg" role="group" aria-label=${t("v_reviews")}>
          ${$e.map(i=>n`<button type="button" aria-pressed=${String(this.reviewState===i)} data-diag-state-filter=${i}
            @click=${()=>{this.reviewState=i,this.loadReviews(0)}}>${h(`st_${i}`,"st_unknown")}${e&&i!=="all"?` (${e.summary[i]??0})`:""}</button>`)}
        </div>
      </section>
      ${this.status()}
      ${e?this.renderReviewList(e):c}`}renderReviewList(e){return e.stale?n`<p class="note" data-diag-stale>${t("stale")} <sw-button size="sm" @click=${()=>void this.loadReviews(0)}>${t("reload")}</sw-button></p>`:n`<section class="card" data-diag-review-list>
      ${e.records.length?n`<ul class="rows">${e.records.map(i=>n`<li data-diag-review=${i.user_id} data-diag-status=${i.status}>
            <span class="name">${i.display_name||i.user_id}</span>
            <sw-badge kind=${i.central.granted?"live":"offline"} label=${i.central.granted?t("granted"):t("notGranted")}></sw-badge>
            <sw-badge kind=${{ok:"live",warn:"partial",bad:"error",neutral:"neutral"}[be(i.status)]} label=${h(`st_${i.status}`,"st_unknown")}></sw-badge>
            <sw-button size="sm" variant="secondary" data-diag-open-review @click=${()=>void this.openReviewOf(i)}>${t("review")}</sw-button>
            ${i.latest?n`<span class="detail">${t("lastDecision",{d:h(`d_${i.latest.decision}`,"d_unknown"),t:$(i.latest.at,this.zone)})}${i.latest.arx_actor?` · ${t("decidedBy",{who:i.latest.arx_actor})}`:""}${i.latest.due_at?` · ${t("nextReview",{t:$(i.latest.due_at,this.zone)})}`:""}</span>`:c}
          </li>`)}</ul>`:n`<p class="note">${t("noReviews")}</p>`}
      ${this.pager(e,i=>void this.loadReviews(i))}
    </section>`}pager(e,i){const s=(e.offset??0)+1,a=(e.offset??0)+e.records.length;return n`<div class="pager">
      <span class="muted">${e.total?t("pageOf",{from:s,to:a,total:e.total}):""} ${this.fetched()}</span>
      ${e.previous_offset!==null||e.next_offset!==null?n`<div class="acts"><sw-button size="sm" ?disabled=${e.previous_offset===null} @click=${()=>i(e.previous_offset??0)}>${t("prev")}</sw-button>
            <sw-button size="sm" ?disabled=${e.next_offset===null} data-diag-next @click=${()=>i(e.next_offset??0)}>${t("next")}</sw-button></div>`:c}
    </div>`}async openReviewOf(e){const i=f(this.reviewDoor);if(i){this.openReview=e,this.preview=null,this.previewError="",this.decision="keep",this.reason="",this.cadence=90,this.confirming=!1,this.decideLine=null;try{const s=await le(e.user_id,i.station_id,i.lock_id);if(this.openReview!==e)return;this.preview=s,s.preview||(this.previewError=t("unavailable"))}catch(s){this.openReview===e&&(this.previewError=k(s))}}}closeReview(){if(this.saving)return;const e=this.decideLine?.ok;this.openReview=null,this.preview=null,e&&this.loadReviews(this.reviewOffset)}async submitDecision(){const e=this.preview?.preview,i=f(this.reviewDoor),s=L(this.reason);if(!(!e||!i||!s||e.person_revision===null||!e.user_id)){this.saving=!0,this.decideLine=null;try{const a=await me({user_id:e.user_id,station_id:i.station_id,lock_id:i.lock_id,person_revision:e.person_revision,fingerprint:e.fingerprint,latest_id:e.latest_id,decision:this.decision,reason:s,cadence_days:this.cadence});this.decideLine={ok:!0,text:`${t("saved")} · ${t("nextReview",{t:$(a.receipt.due_at,this.zone)})}`}}catch(a){this.decideLine={ok:!1,text:k(a)}}finally{this.saving=!1,this.confirming=!1}}}renderReviewDialog(){const e=this.openReview;if(!e)return c;const i=this.preview?.preview??null,s=this.preview?.decide,a=!!(s&&s.available===!0&&s.allowed&&this.home?.can.decide),o=b(this.home?.doors,f(this.reviewDoor)?.station_id??null,f(this.reviewDoor)?.lock_id??1),p=L(this.reason);return n`<sw-dialog open wide heading=${t("reviewTitle")} subheading=${`${e.display_name} · ${o}`} ?locked=${this.saving} @close=${()=>this.closeReview()} data-diag-review-dialog>
      ${this.previewError?n`<p class="note bad" role="alert">${this.previewError}</p>`:c}
      ${!i&&!this.previewError?n`<sw-state-panel compact state="loading" heading=${t("loading")}></sw-state-panel>`:c}
      ${i?n`<dl class="lines">
            <dt>${t("door")}</dt><dd>${i.central.granted?t("granted"):t("notGranted")}</dd>
            <dt>${t("validity")}</dt><dd>${i.central.archived?`${t("person_archived")} · `:i.central.active?"":`${t("person_inactive")} · `}${T(i.central.valid_from,i.central.valid_until,this.zone)}</dd>
            <dt>${t("schedule")}</dt><dd>${h(`t_${i.central.timing_mode}`,"t_unknown")}${i.central.schedule?.periods.length?` · ${i.central.schedule.periods.map(u=>`${u.start}–${u.end}`).join(", ")}`:""}</dd>
          </dl>
          <h3>${t("history")}</h3>
          ${i.history.length?n`<ul class="rows">${i.history.map(u=>n`<li><span class="name">${h(`d_${u.decision}`,"d_unknown")} · ${$(u.at,this.zone)}</span>
                <span class="detail">${u.reason}${u.arx_actor?` · ${t("decidedBy",{who:u.arx_actor})}`:""}</span></li>`)}</ul>`:n`<p class="muted">${t("noHistory")}</p>`}
          <p class="note">${t("reviewHint")}</p>
          ${this.decideLine?n`<p class="note ${this.decideLine.ok?"ok":"bad"}" role="status" data-diag-decide-line>${this.decideLine.text}</p>`:c}
          ${a&&!this.decideLine?.ok?this.renderDecideForm(e.display_name,o,p):c}
          ${a?c:n`<p class="note" data-diag-view-only>${s&&s.available===!0&&!s.allowed?t("decideNoPermission"):t("decideViewOnly")}</p>
                <a class="link" href=${O("access.reviews")} data-diag-panel>${t("openPanel")}</a>`}`:c}
      <sw-button slot="footer" ?disabled=${this.saving} @click=${()=>this.closeReview()}>${t("close")}</sw-button>
    </sw-dialog>`}renderDecideForm(e,i,s){return this.confirming?n`<div class="card" role="group" data-diag-confirm>
        <b>${t("confirmTitle")}</b>
        <span>${t("confirmBody",{decision:h(`d_${this.decision}`,"d_unknown"),person:e,door:i,n:this.cadence})}</span>
        <div class="acts end"><sw-button ?disabled=${this.saving} @click=${()=>this.confirming=!1}>${t("cancel")}</sw-button>
          <sw-button variant="primary" ?disabled=${this.saving} data-diag-confirm-yes @click=${()=>void this.submitDecision()}>${this.saving?t("saving"):t("confirm")}</sw-button></div>
      </div>`:n`<div class="form" data-diag-decide>
      <div class="f"><span class="muted">${t("decision")}</span>
        <div class="seg" role="group" aria-label=${t("decision")}>
          ${["keep","followup"].map(a=>n`<button type="button" aria-pressed=${String(this.decision===a)} data-diag-decision=${a} @click=${()=>this.decision=a}>${t(a==="keep"?"d_keep":"d_followup")}</button>`)}
        </div></div>
      <div class="f"><span>${t("cadence")}</span>
        <sw-dropdown block data-diag-cadence label=${t("cadence")} .value=${String(this.cadence)}
          .items=${ke.map(a=>({id:String(a),label:t("days",{n:a})}))}
          @change=${a=>this.cadence=Number(a.detail.id)}></sw-dropdown></div>
      <label class="f" style="grid-column: 1 / -1">${t("reason")}
        <textarea maxlength="500" data-diag-reason placeholder=${t("reasonPh")} .value=${this.reason} @input=${a=>this.reason=a.target.value}></textarea></label>
      <div class="acts" style="grid-column: 1 / -1"><sw-button variant="primary" icon="check" data-diag-decide-go ?disabled=${!s} @click=${()=>this.confirming=!0}>${t("confirm")}</sw-button></div>
    </div>`}async loadQuality(e){const i=e?this.quality?.snapshot??"":"";await this.run(()=>ce(this.qKind,this.qState,e,i),s=>(this.quality=s.quality,!!s.quality))}renderQuality(){const e=this.load==="ready"?this.quality:null;return n`<section class="card" data-diag-quality-filters>
        <div class="seg" role="group" aria-label=${t("v_quality")}>
          ${["all","missing","invalid","duplicate"].map(i=>n`<button type="button" aria-pressed=${String(this.qKind===i)} data-diag-qkind=${i}
            @click=${()=>{this.qKind=i,this.loadQuality(0)}}>${t(i==="all"?"q_all":i==="missing"?"q_missing":i==="invalid"?"q_invalid":"q_duplicate")}</button>`)}
        </div>
        <div class="seg" role="group" aria-label=${t("v_quality")}>
          ${["current","archived","all"].map(i=>n`<button type="button" aria-pressed=${String(this.qState===i)} data-diag-qstate=${i}
            @click=${()=>{this.qState=i,this.loadQuality(0)}}>${t(i==="current"?"q_current":i==="archived"?"q_archived":"q_everyone")}</button>`)}
        </div>
      </section>
      ${this.status()}
      ${e?e.stale?n`<p class="note">${t("stale")} <sw-button size="sm" @click=${()=>void this.loadQuality(0)}>${t("reload")}</sw-button></p>`:n`<section class="card" data-diag-quality>
              <div class="kpis" data-diag-quality-kpis>
                <sw-kpi layout="compact" icon="users" data-diag-kpi="people" tone=${e.summary.people?"stale":"neutral"} label=${t("peopleIssues")} value=${String(e.summary.people)}></sw-kpi>
                <sw-kpi layout="compact" icon="warning" data-diag-kpi="missing" label=${t("q_missing")} value=${String(e.summary.missing)}></sw-kpi>
                <sw-kpi layout="compact" icon="warning" data-diag-kpi="invalid" label=${t("q_invalid")} value=${String(e.summary.invalid)}></sw-kpi>
                <sw-kpi layout="compact" icon="copy" data-diag-kpi="duplicate" label=${t("q_duplicate")} value=${String(e.summary.duplicate)}></sw-kpi>
              </div>
              <span class="muted">${t("scanned",{n:e.coverage.scanned})}</span>
              ${e.records.length?n`<ul class="rows">${e.records.map(i=>n`<li data-diag-quality-row=${i.id}>
                    <span class="name">${i.display_name||i.id}${i.employee_no?n` <span class="muted">· ${i.employee_no}</span>`:c}${i.archived?n` <span class="muted">· ${t("person_archived")}</span>`:c}</span>
                    <div class="detail chips">${i.issues.map(s=>n`<span class="chip" data-diag-issue=${s.code}>${xe(s)}${s.related_people.length?` · ${t("dupWith",{names:s.related_people.map(a=>a.display_name).join(", ")})}`:""}</span>`)}</div>
                  </li>`)}</ul>`:n`<p class="note">${t("noIssues")}</p>`}
              ${this.pager(e,i=>void this.loadQuality(i))}
            </section>`:c}`}async loadLifecycle(){await this.run(()=>pe(this.days),e=>(this.lifecycle=e.lifecycle,!!e.lifecycle))}lifeRow(e,i){return n`<li data-diag-life=${e.id}>
      <span class="name">${e.display_name||e.id}${e.employee_no?n` <span class="muted">· ${e.employee_no}</span>`:c}</span>
      ${e.access_category!=="unknown"?n`<span class="chip">${h(`cat_${e.access_category}`,"cat_unknown")}</span>`:c}
      <span class="muted">${i}</span>
      <span class="detail">${T(e.valid_from,e.valid_until,this.zone)} · ${t("doorsCount",{n:e.assignment_count})}</span>
    </li>`}renderLifecycle(){const e=this.load==="ready"?this.lifecycle:null;return n`<section class="card" data-diag-life-filters>
        <div class="acts"><span class="muted">${t("window")}</span>
          <div class="seg" role="group" aria-label=${t("window")}>
            ${qe.map(i=>n`<button type="button" aria-pressed=${String(this.days===i)} data-diag-days=${i} @click=${()=>{this.days=i,this.loadLifecycle()}}>${t("days",{n:i})}</button>`)}
          </div></div>
        <span class="muted">${t("lifeHint")}</span>
      </section>
      ${this.status()}
      ${e?n`<section class="card" data-diag-lifecycle>
            <div class="kpis" data-diag-lifecycle-kpis>
              <sw-kpi layout="compact" icon="clock" data-diag-kpi="expiring" label=${t("expiring")} value=${String(e.summary.expiring)}></sw-kpi>
              <sw-kpi layout="compact" icon="calendar" data-diag-kpi="expired" label=${t("expired")} value=${String(e.summary.expired)}></sw-kpi>
              <sw-kpi layout="compact" icon="user" data-diag-kpi="temporary" label=${t("temporary")} value=${String(e.temporary.summary.total??0)}></sw-kpi>
              <sw-kpi layout="compact" icon="lock" data-diag-kpi="without_credentials" label=${t("withoutCred")} value=${String(e.summary.without_credentials)}></sw-kpi>
            </div>
            <h3>${t("expiring")}</h3>
            ${e.expirations.length?n`<ul class="rows">${De(e.expirations).map(i=>this.lifeRow(i,i.state==="expired"?`${t("expired")} · ${R(i.seconds_remaining)}`:R(i.seconds_remaining)))}</ul>`:n`<p class="note">${t("noneExpiring")}</p>`}
            ${e.truncated.expirations?n`<p class="muted">${t("truncated")}</p>`:c}
            ${e.temporary.users.length?n`<h3>${t("temporary")}</h3><ul class="rows">${e.temporary.users.map(i=>this.lifeRow(i,[h(`tmp_${i.state??"unknown"}`,"tmp_unknown"),i.expiring_soon?Pe(i):""].filter(Boolean).join(" · ")))}</ul>`:c}
            ${e.duplicates.length?n`<h3>${t("duplicates")}</h3><ul class="rows">${e.duplicates.map(i=>n`<li><span class="name">${i.users.map(s=>s.display_name||s.id).join(" · ")}</span>
                  <span class="chip">${h(`dup_${i.reason}`,"dup_unknown")}</span></li>`)}</ul>`:c}
            <h3>${t("withoutCred")}</h3>
            ${e.without_credentials===null?n`<p class="muted" data-diag-cred-hidden>${t("credHidden")}</p>`:n`<ul class="rows">${e.without_credentials.map(i=>this.lifeRow(i,""))}</ul>`}
            <div class="acts">${this.fetched()}</div>
          </section>`:c}`}async runAudit(){const e=this.auditStation;e&&(this.audit=null,await this.run(()=>he(e),i=>(this.audit=i.audit,!!i.audit)))}renderAudit(){const e=this.home?.doors??[],i=this.load==="ready"?this.audit:null,s=e.find(o=>o.id===this.auditStation),a={drift:0,unmanaged:1,unverified:2,unknown:3,matched:4};return n`<section class="card" data-diag-audit-form>
        <span class="muted">${t("auditHint")}</span>
        <div class="form">
          <div class="f"><span>${t("station")}</span>
            <sw-dropdown block data-diag-audit-station label=${t("station")} .value=${this.auditStation}
              .items=${e.map(o=>({id:o.id,label:`${o.name}${o.online?"":` · ${t("stationOffline")}`}`}))}
              @change=${o=>this.auditStation=o.detail.id}></sw-dropdown></div>
        </div>
        ${s&&!s.online?n`<p class="note">${t("stationOfflineNote")}</p>`:c}
        <div class="acts"><sw-button variant="primary" icon="shield" data-diag-run-audit ?disabled=${!s||!s.online||this.load==="loading"} @click=${()=>void this.runAudit()}>
          ${this.load==="loading"?t("auditing"):t("runAudit")}</sw-button><span class="muted">${t("readOnly")}</span></div>
      </section>
      ${this.status()}
      ${i?n`<section class="card" data-diag-audit>
            <span class="muted">${t("auditFor",{station:s?.name??i.station_id??"",t:g(i.checked_at,this.zone)})}</span>
            <div class="kpis" data-diag-audit-kpis>${["matched","drift","unmanaged","unverified"].map(o=>n`<sw-kpi layout="compact" data-diag-kpi=${o}
              icon=${o==="matched"?"check":o==="drift"?"warning":o==="unmanaged"?"lock":"help"} tone=${o==="matched"?"live":o==="drift"&&i.counts[o]?"stale":"neutral"}
              label=${h(`a_${o}`,"a_unknown")} value=${String(i.counts[o])}></sw-kpi>`)}</div>
            ${i.complete?c:n`<p class="note">${t("auditIncomplete")}</p>`}
            <ul class="rows">${[...i.rows].sort((o,p)=>a[o.status]-a[p.status]).map(o=>n`<li data-diag-audit-row=${o.status}>
              <span class="name">${o.display_name||(o.status==="unmanaged"?t("unmanagedUser"):"—")}${o.employee_no?n` <span class="muted">· ${o.employee_no}</span>`:c}</span>
              <sw-badge kind=${o.status==="matched"?"live":o.status==="drift"?"partial":o.status==="unmanaged"?"error":"unknown"} label=${h(`a_${o.status}`,"a_unknown")}></sw-badge>
              ${o.differences.length?n`<div class="detail chips">${o.differences.map(p=>n`<span class="chip">${Se(p)}</span>`)}</div>`:c}
            </li>`)}</ul>
          </section>`:!this.audit&&this.load==="idle"?n`<p class="muted">${t("noAuditYet")}</p>`:c}`}async loadSync(){await this.run(()=>ue(),e=>(this.sync=e.diagnostics,!!e.diagnostics))}renderSync(){const e=this.load==="ready"?this.sync:null,i=e?Object.entries(e.failures):[];return n`<section class="card"><span class="muted">${t("syncHint")}</span>
        <div class="acts"><sw-button size="sm" icon="refresh" data-diag-sync-refresh ?disabled=${this.load==="loading"} @click=${()=>void this.loadSync()}>${t("reload")}</sw-button>
          ${e?.integration_version?n`<span class="muted">${t("version",{v:e.integration_version})}</span>`:c}</div></section>
      ${this.status()}
      ${e?n`<section class="card" data-diag-sync>
            ${e.stations.length?n`<ul class="rows">${e.stations.map(s=>n`<li data-diag-sync-station=${s.station_ref}>
                  <span class="name">${t("stationRef",{ref:s.station_ref.slice(0,6)})}</span>
                  <sw-badge kind=${s.state==="synced"?"live":s.state==="error"||s.state==="conflict"?"error":s.state==="offline"?"offline":"partial"} label=${h(`sync_${s.state}`,"sync_unknown")}></sw-badge>
                  ${s.last_error?n`<span class="chip">${s.last_error}</span>`:c}
                  <span class="detail">${[s.worker_active?t("worker"):"",s.pending_request?t("pendingReq"):"",s.reconciliation_targets?t("targets",{n:s.reconciliation_targets}):""].filter(Boolean).join(" · ")}</span>
                </li>`)}</ul>`:n`<p class="note">${t("noStations")}</p>`}
            <h3>${t("recentFailures")}</h3>
            ${i.length?n`<div class="chips">${i.map(([s,a])=>n`<span class="chip" data-diag-failure=${s}>${s} · ${a}</span>`)}</div>`:n`<p class="muted">${t("noFailures")}</p>`}
            <h3>${t("recent")}</h3>
            <ul class="rows">${e.recent.slice(0,12).map(s=>n`<li><span class="name">${t("stationRef",{ref:s.station_ref.slice(0,6)})} · ${s.step}</span>
              <sw-badge kind=${s.outcome==="failed"?"error":s.outcome==="succeeded"?"live":"neutral"} label=${s.outcome}></sw-badge>
              <span class="muted">${g(s.at,this.zone)}${s.error?` · ${s.error}`:""}</span></li>`)}</ul>
            <div class="acts">${this.fetched()}</div>
          </section>`:c}`}};r.styles=J`
    :host {
      display: block;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .views {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .views a {
      display: inline-flex;
      align-items: center;
      min-block-size: 44px;
      padding-inline: 14px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    .views a[aria-current='page'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .views a:hover:not([aria-current='page']) {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .views a:focus-visible,
    a.link:focus-visible,
    button:focus-visible,
    select:focus-visible,
    input:focus-visible,
    textarea:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      min-inline-size: 0;
    }
    .card h2 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .form {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
      gap: 12px;
      align-items: end;
    }
    label.f,
    div.f {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-inline-size: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      position: relative;
    }
    input,
    select,
    textarea {
      min-block-size: 44px;
      box-sizing: border-box;
      inline-size: 100%;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    textarea {
      min-block-size: 72px;
      padding-block: 8px;
      resize: vertical;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .acts.end {
      justify-content: flex-end;
    }
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .seg button {
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
    }
    .picker-list {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline: 0;
      z-index: var(--sw-z-drawer);
      margin: 0;
      padding: 4px;
      list-style: none;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
    }
    .picker-list button {
      display: flex;
      inline-size: 100%;
      min-block-size: 44px;
      align-items: center;
      gap: 8px;
      padding-inline: 8px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: none;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      text-align: start;
      cursor: pointer;
    }
    .picker-list button:hover {
      background: var(--sw-surface-2);
    }
    .picker-list .none {
      padding: 8px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .chosen {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 44px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .chosen span {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chosen button {
      display: inline-grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: none;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .verdict {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: var(--sw-r-md);
    }
    .verdict.ok {
      background: var(--sw-success-soft);
    }
    .verdict.bad {
      background: var(--sw-danger-soft);
    }
    .verdict b {
      display: block;
      font-size: var(--sw-fs-lg);
    }
    .verdict .sub,
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .verdict.ok sw-icon {
      color: var(--sw-success);
    }
    .verdict.bad sw-icon {
      color: var(--sw-danger);
    }
    dl.lines {
      display: grid;
      grid-template-columns: minmax(6rem, max-content) 1fr;
      gap: 8px 14px;
      margin: 0;
    }
    dl.lines dt {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    dl.lines dd {
      margin: 0;
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      flex: none;
      background: var(--sw-text-3);
    }
    .dot.ok {
      background: var(--sw-success);
    }
    .dot.bad {
      background: var(--sw-danger);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .note {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .note.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .note.ok {
      background: var(--sw-success-soft);
      color: var(--sw-text);
    }
    ul.rows {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    ul.rows > li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    ul.rows > li:last-child {
      border-block-end: 0;
    }
    .name {
      flex: 1 1 10rem;
      min-inline-size: 0;
      font-weight: var(--sw-fw-medium);
      overflow-wrap: anywhere;
    }
    .detail {
      flex-basis: 100%;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--sw-kpi-compact-col-min, 168px)), 1fr));
      gap: 8px;
    }
    h3 {
      margin: 4px 0 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    a.link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .side {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
      flex-basis: 100%;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .side b {
      color: var(--sw-text);
      font-weight: var(--sw-fw-medium);
    }
    .radio {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      font-size: var(--sw-fs-sm);
    }
    .radio input {
      inline-size: 18px;
      min-block-size: 18px;
      block-size: 18px;
    }
    sw-button {
      min-block-size: 44px;
    }
    @media (max-width: 560px) {
      dl.lines {
        grid-template-columns: 1fr;
        gap: 2px;
      }
      dl.lines dd {
        margin-block-end: 8px;
      }
      .side {
        grid-template-columns: 1fr;
      }
    }
  `;d([X({attribute:!1})],r.prototype,"route",2);d([l()],r.prototype,"view",2);d([l()],r.prototype,"home",2);d([l()],r.prototype,"homeLoad",2);d([l()],r.prototype,"homeError",2);d([l()],r.prototype,"load",2);d([l()],r.prototype,"error",2);d([l()],r.prototype,"head",2);d([l()],r.prototype,"person",2);d([l()],r.prototype,"door",2);d([l()],r.prototype,"whenMode",2);d([l()],r.prototype,"whenValue",2);d([l()],r.prototype,"timeError",2);d([l()],r.prototype,"scenario",2);d([l()],r.prototype,"queries",2);d([l()],r.prototype,"options",2);d([l()],r.prototype,"openPicker",2);d([l()],r.prototype,"cmpKind",2);d([l()],r.prototype,"left",2);d([l()],r.prototype,"right",2);d([l()],r.prototype,"leftDoor",2);d([l()],r.prototype,"rightDoor",2);d([l()],r.prototype,"comparison",2);d([l()],r.prototype,"doorComparison",2);d([l()],r.prototype,"reviewDoor",2);d([l()],r.prototype,"reviewState",2);d([l()],r.prototype,"reviews",2);d([l()],r.prototype,"reviewOffset",2);d([l()],r.prototype,"openReview",2);d([l()],r.prototype,"preview",2);d([l()],r.prototype,"previewError",2);d([l()],r.prototype,"decision",2);d([l()],r.prototype,"reason",2);d([l()],r.prototype,"cadence",2);d([l()],r.prototype,"confirming",2);d([l()],r.prototype,"saving",2);d([l()],r.prototype,"decideLine",2);d([l()],r.prototype,"qKind",2);d([l()],r.prototype,"qState",2);d([l()],r.prototype,"quality",2);d([l()],r.prototype,"days",2);d([l()],r.prototype,"lifecycle",2);d([l()],r.prototype,"auditStation",2);d([l()],r.prototype,"audit",2);d([l()],r.prototype,"sync",2);r=d([ee("wiskey-access-diag")],r);export{r as WiskeyAccessDiag};
