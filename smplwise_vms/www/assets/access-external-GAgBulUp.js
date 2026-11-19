import{bA as Ws,cE as Ms,bG as ts,bH as Us,g as as,ax as P,j as h,i as is,n as S,sv as ps,m as Ks,A as c,b as i,bz as Fs,ek as O,d as Hs,k as ns,b5 as H,br as Gs,bm as Cs,t as m,a as qs,aL as Vs,p as Xs,iK as Qs,u as Ys,dK as hs,dr as us,sw as Zs,e2 as Js,bh as se,aU as ee}from"./index-DkcUEx2W.js";import{x as os,r as te,u as B,S as ms,a as ws,c as ae,b as ie,l as ne,d as oe,w as Y,e as re,f as fs,g as Z,h as q,i as J,t as le,j,k as ss,n as de,m as ce,D as pe,v as he,s as ue,o as me,B as we}from"./identity-card-BZHeFdJj.js";import{b as vs,l as fe,c as ve,r as ge,e as $e,f as be,h as ye,i as ke,j as xe,k as _e,n as gs,o as ze,q as Se,s as $s,t as bs,v as Te,w as De,x as Ne,y as Ae,p as Ce,z as qe,A as Oe,B as Ee,C as Pe,D as Re,E as Ie}from"./access-grants-Dh0hzw6c.js";import{t as ys}from"./tickets-s4-Ca3attjM.js";import{p as ks}from"./tickets-phone-verify-CPpW7h41.js";import{i as xs,d as Le,m as Be}from"./recordings-B2iUoREr.js";import{d as je,b as rs}from"./day-key-Bn1dxlC5.js";import{p as We}from"./pad-CImDeuHV.js";import{a as E,x as t,b as K}from"./access-external-CKqz1SWg.js";import{s as _,a as Me,t as Ue,w as Ke,l as Fe,b as He}from"./pending-model-CNochN8u.js";import{l as Ge}from"./lead-reserve-CByVlOBW.js";import"./sw-logo-art-PLtEZJxU.js";import"./access-people-DHLjwm4x.js";import"./wiskey-format-BPW9FmeY.js";import"./wiskey-COxHjiFt.js";const Ve=8,Os=200,Xe=1e3,Qe=[["07:00","12:00"],["07:00","16:00"],["08:00","17:00"],["12:00","20:00"],["07:00","20:00"],["00:00","24:00"]],Ye=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],_s=["he","en","ar","ru"];function Ze(){return{mode:"dir",q:"",contactId:null,np:{name:"",company:"",phone:"",lang:"he"},ticketId:"",purpose:"",doors:new Set,dq:"",from:"",until:"",dmode:"weekly",days:new Set([0,1,2,3,4]),dates:new Set,wins:[{s:"07:00",e:"16:00"}],cred:"pin",once:!1,notes:"",told:!1,path:"send",tried:!1}}function zs(s){return s.kind==="vendor"?"company":s.kind==="employee"?"employee":s.user_linked?"user":!s.active||s.erased?"inactive":"ok"}function M(s){return!!s&&!!s.has_phone&&!!s.phone_confirmed&&(s.phone_confirmed_via==="user"||s.phone_confirmed_via==="code")}function Je(s){return/^(05\d{8}|9725\d{8})$/.test(s.replace(/\D/g,""))}const st=(s,e)=>`${s}:${e}`;function G(s){const e=s.lastIndexOf(":");return[s.slice(0,e),Number(s.slice(e+1))]}function et(s){const e={};for(const a of s){const[n,o]=G(a);(e[n]??=[]).push(o)}for(const a of Object.keys(e))e[a].sort((n,o)=>n-o);return e}const F=s=>[...new Set([...s].map(e=>G(e)[0]))].sort();function tt(s,e){if(!e)return s;const a=new Set(e.stations.filter(n=>n.may_request).map(n=>n.station_id));return new Set([...s].filter(n=>a.has(G(n)[0])))}const D=s=>s==="24:00"?1440:Number(s.slice(0,2))*60+Number(s.slice(3,5));function ls(s,e){return je(s,e)}function at(s,e){if(!s||!e||e<s||ls(s,e)>31)return[];const a=[];for(let n=s;n<=e;n=rs(n,1))a.push(n);return a}const U=s=>s?`${s.slice(8,10)}.${s.slice(5,7)}`:"";function it(s,e,a,n){const o=xs(s,0,a);let d=xs(rs(e,1),0,a);const r=o.getTime()+n*864e5;d.getTime()>r&&(d=new Date(r));const w=p=>Ws(p);return{valid_from:w(o),valid_until:w(d)}}function nt(s,e){const a=[...s.wins].sort((n,o)=>D(n.s)-D(o.s)).map(n=>({start:n.s,end:n.e}));return s.dmode==="weekly"?{mode:"weekly",timezone:e,days:[...s.days].sort().map(n=>Ye[n]),dates:[],periods:a}:{mode:"dates",timezone:e,days:[],dates:[...s.dates].sort(),periods:a}}function ot(s,e,a,n){if(!s)return null;const o=rs(s,-1);return o<e||o===e&&n>=a*60?null:`${U(o)} ${We(a)}:00`}function es(s,e){const a=e.grantable;if(!a?.system_admin)return"blk_second";if(!a.reachable)return"blk_offline";const n=new Map(a.stations.map(d=>[d.station_id,d])),o=F(s.doors);return o.some(d=>!n.get(d)?.may_approve)?"blk_doors":s.cred==="pin"&&o.some(d=>!n.get(d)?.may_approve_pin)?"blk_pin":s.cred==="pin"&&s.mode==="new"?"blk_numberNew":s.cred==="pin"&&s.mode==="dir"&&s.contactId&&!M(e.contact)?"blk_number":null}function Ss(s,e){const a={};s.mode==="dir"?s.contactId||(a.person={key:"err_person"}):(s.np.name.trim().length<2&&(a.npName={key:"err_npName"}),Je(s.np.phone)||(a.npPhone={key:"err_npPhone"})),(s.purpose.length>Os||/\n/.test(s.purpose))&&(a.purpose={key:"err_purpose"});const n=s.doors.size;if(n===0?a.doors={key:"err_doorsNone"}:n>e.maxDoors&&(a.doors={key:"err_doorsMany",vars:{max:e.maxDoors,n:n-e.maxDoors}}),!s.from||!s.until?a.dates={key:"err_datesPick"}:s.until<s.from?a.dates={key:"err_datesOrder"}:s.until<e.today?a.dates={key:"err_datesPast"}:ls(s.from,s.until)>e.maxDays&&(a.dates={key:"err_datesLong",vars:{max:e.maxDays}}),s.dmode==="weekly"&&s.days.size===0&&(a.days={key:"err_days"}),s.dmode==="dates"&&s.dates.size===0&&(a.days={key:"err_datesNone"}),s.wins.some(o=>!o.s||!o.e||D(o.s)>=D(o.e)))a.wins={key:"err_winsOrder"};else{const o=[...s.wins].sort((d,r)=>D(d.s)-D(r.s));o.some((d,r)=>r>0&&D(o[r-1].e)>D(d.s))&&(a.wins={key:"err_winsOverlap"})}if(s.told||(a.told={key:"err_told"}),n&&e.approvers===0&&(a.path={key:"err_pathNone"}),s.path==="self"){const o=es(s,e);o&&(a.path=a.path??{key:o})}return a}function rt(s,e,a,n){return{contact_id:e,ticket_id:s.ticketId||null,doors:et(s.doors),...it(s.from,s.until,a,n),timing:nt(s,a),credential:s.cred,purpose:s.purpose.trim()||null,notes:s.notes.trim()||null,told:s.told,approve_now:s.path==="self",...s.cred==="pin"&&s.once?{code_mode:"single_entry"}:{}}}const ds={newBtn:"בקשת גישה",title:"בקשת גישת חוץ",close:"סגירה",cancel:"ביטול",loading:"טוען…",loadError:"לא ניתן לטעון את הטופס",who:"מי",fromDir:"מספר אנשי הקשר",newPerson:"אדם חדש",searchPerson:"חיפוש לפי שם, חברה או טלפון",noMatch:"לא נמצא",addNew:"הוספת אדם חדש",dirUnavailable:"אין לך גישה לספר אנשי הקשר. אפשר להוסיף אדם חדש.",change:"החלפה",confirmed:"אומת",notConfirmed:"לא אומת",noNumber:"אין מספר",sendCode:"שליחת קוד אימות",codeSent:"קוד אימות נשלח בוואטסאפ",liveAccess:"גישה פעילה · ייחשב הרחבה",liveShort:"גישה פעילה",dis_company:"חברה",dis_user:"משתמש Arx",dis_inactive:"לא פעיל או ממתין לאישור",dis_employee:"עובד ללא חשבון",fullName:"שם מלא",company:"חברה",whatsapp:"וואטסאפ",msgLang:"שפת ההודעות",onSave:"קוד אימות יישלח בוואטסאפ עם השמירה",lang_he:"עברית",lang_en:"אנגלית",lang_ar:"ערבית",lang_ru:"רוסית",extIdentity:"זהות מורחבת",locked:"נעול",purpose:"מטרה",optional:"רשות",ticket:"קריאה או הזמנת עבודה",none:"ללא",purposeVisit:"מטרת ההגעה",endsWithTicket:"הגישה מסתיימת כשהקריאה נסגרת",doors:"דלתות",searchDoor:"חיפוש עמדה או דלת",doorN:"דלת {n}",lockedStations:"עמדות ללא הרשאה ({n})",noStations:"אין עמדות שאפשר לבקש עבורן גישה.",offline:"WisKey לא זמין · רשימת הדלתות נכונה ל־{t}",offlineNoCopy:"WisKey לא זמין · אין רשימת דלתות",when:"מתי",tz:"אזור זמן: {tz}",from:"מתאריך",until:"עד תאריך (כולל)",daysOf:"{n} ימים · עד {max}",codeAt:"קוד יישלח {t}",codeAtOnce:"קוד יישלח מיד עם ההפעלה",weekdays:"ימים בשבוע",specificDates:"תאריכים מסוימים",pickRange:"בחרו קודם טווח תאריכים",d0:"א׳",d1:"ב׳",d2:"ג׳",d3:"ד׳",d4:"ה׳",d5:"ו׳",d6:"ש׳",winFrom:"משעה",winUntil:"עד שעה",remove:"הסרה",addWin:"חלון נוסף",cred:"אמצעי כניסה",credPin:"קוד אישי בוואטסאפ",credNone:"ללא קוד",credCard:"כרטיס",codeType:"סוג הקוד",codeWindow:"לכל התקופה",codeOnce:"לכניסה אחת",codeOnceNote:"הקוד מבוטל אחרי הכניסה הראשונה. במאמץ מיטבי: בשניות שעד הביטול כניסה נוספת עדיין אפשרית.",notes:"הערות",internal:"פנימי",path:"מסלול אישור",approveNow:"אני מאשר עכשיו",approveNowSub:"נשלח ל-WisKey מיד",sendApproval:"שליחה לאישור",sendApprovalSub:"המאשרים מקבלים התראה",apprCount:"{n} מאשרים לדלתות שנבחרו",apprNone:"אין מאשר לכל הדלתות",apprFollow:"המאשרים ייקבעו לפי הדלתות",autoApproval:"אישור אוטומטי",autoNone:"אין",blk_second:"נדרש אדם נוסף לאישור",blk_offline:"WisKey לא זמין",blk_doors:"אין לך הרשאת אישור לכל הדלתות",blk_pin:"אין לך הרשאה להפקת קוד",blk_numberNew:"המספר עוד לא אומת",blk_number:"המספר לא אומת",notice:"הודעת פרטיות לטכנאי",noticeLang:"{lang} · {v}",preview:"מה יישלח לטכנאי",previewBody:"SmplWise Arx: קוד הכניסה האישי שלך הוא {pin}. דלתות: {doors}. בתוקף {dates}, {hours}. הקוד אישי - אל תעביר אותו לאיש. הכניסות נרשמות (שם, שעה ודלת) לצורכי אבטחה בלבד.",previewNote:"הקוד נוצר רק במועד השליחה ונשלח ישירות לטכנאי. אף אחד ב־Arx לא רואה אותו.",err_person:"יש לבחור אדם או להוסיף חדש.",err_npName:"יש להזין שם מלא.",err_npPhone:"מספר וואטסאפ לא תקין.",err_doorsNone:"יש לבחור לפחות דלת אחת.",err_doorsMany:"אפשר עד {max} דלתות. הסירו {n}.",err_datesPick:"יש לבחור תאריכים.",err_datesOrder:"תאריך הסיום לפני תאריך ההתחלה.",err_datesPast:"החלון כבר הסתיים.",err_datesLong:"עד {max} ימים.",err_days:"יש לבחור לפחות יום אחד.",err_datesNone:"יש לבחור לפחות תאריך אחד.",err_winsOrder:"שעת הסיום לפני שעת ההתחלה.",err_winsOverlap:"שני חלונות חופפים.",err_told:"יש לאשר שהטכנאי קיבל את ההודעה.",err_pathNone:"אין מאשר שמחזיק הרשאה בכל הדלתות שנבחרו.",err_purpose:"עד 200 תווים, בשורה אחת.",fieldsToFix:"{n} שדות לתיקון",ok_send:"שליחה לאישור",ok_self:"אישור ושליחה ל-WisKey",done_send:"הבקשה נשלחה למאשרים",done_self:"אושר ונשלח ל-WisKey · עדיין לא פעיל",done_merged:"הגישה הקיימת צומצמה",done_selfFailed:"הבקשה נשמרה ונשלחה למאשרים. האישור לא בוצע: {why}",noperm_title:"אין לך הרשאה לבקש גישת חוץ",noperm_text:"נדרשת הרשאת ניהול קריאות עם ספקים חיצוניים, או הרשאת מתן גישת חוץ בעמדה אחת לפחות.",retry:"נסה שוב",checkAgain:"בדיקה שוב"},Es=ts("en","i18n/access-request","en"),Ps=ts("ar","i18n/access-request","ar"),Rs=ts("ru","i18n/access-request","ru"),lt={he:ds,en:Es,ar:Ps,ru:Rs},dt=["ar","ru"];function l(s,e,a=E()){const n=lt[a][s]??ds[s]??s;return Ms(n,e)}Us("i18n/access-request",{he:ds,en:Es,ar:Ps,ru:Rs},dt);var ct=Object.defineProperty,pt=Object.getOwnPropertyDescriptor,k=(s,e,a,n)=>{for(var o=n>1?void 0:n?pt(e,a):e,d=s.length-1,r;d>=0;d--)(r=s[d])&&(o=(n?r(e,a,o):r(o))||o);return n&&o&&ct(e,a,o),o};let b=class extends is{constructor(){super(...arguments),this.tz="Asia/Jerusalem",this.codeHour=18,this.live=new Set,this.noPerm=!1,this.cards=!1,this.f=Ze(),this.g=null,this.loadError="",this.contacts=null,this.dirError=!1,this.vendors=[],this.tickets=[],this.appr=null,this.notice=null,this.busy=!1,this.error="",this.sentCode=!1,this.apprKey="",this.noticeLang="",this.seq=0}connectedCallback(){super.connectedCallback(),this.noPerm||this.load()}updated(s){(s.has("f")||s.has("g"))&&(this.refreshApprovers(),this.refreshNotice())}today(){return Le(new Date,this.tz)}async load(){this.loadError="";try{this.g=await vs(this.f.ticketId||null)}catch(s){this.loadError=S(s);return}this.contacts!==null&&!this.dirError||(ys().contacts({}).then(s=>{const e=s.contacts.filter(a=>!a.erased);this.contacts=e,this.vendors=e.filter(a=>a.kind==="vendor"&&a.active)},()=>{this.contacts=[],this.dirError=!0}),ps()&&Ks().list({scope:"visible",status:"open",limit:50}).then(s=>this.tickets=s.items,()=>this.tickets=[]))}set(s){const e={...this.f,...s};e.path==="self"&&es(e,this.ctx(e))&&(e.path="send"),this.f=e}contact(s=this.f){return s.mode==="dir"&&s.contactId?this.contacts?.find(e=>e.id===s.contactId)??null:null}ctx(s=this.f){return{today:this.today(),maxDoors:this.g?.max_doors??4,maxDays:this.g?.max_days??14,grantable:this.g,contact:this.contact(s),approvers:this.appr?this.appr.count:null}}personLang(){if(this.f.mode==="new")return this.f.np.lang;const s=this.contact();return s?.lang&&_s.includes(s.lang)?s.lang:E()==="en"?"en":"he"}async refreshApprovers(){const s=F(this.f.doors),e=`${s.join(",")}|${this.f.cred}`;if(e===this.apprKey)return;if(this.apprKey=e,!s.length){this.appr=null;return}const a=++this.seq;try{const n=await fe(s,this.f.cred);a===this.seq&&(this.appr=n)}catch{a===this.seq&&(this.appr=null)}}async refreshNotice(){const s=this.personLang();if(!(s===this.noticeLang||!this.g)){this.noticeLang=s;try{this.notice=await ve(s)}catch{this.notice=null}}}async changeTicket(s){this.set({ticketId:s});try{const e=await vs(s||null);this.g=e,this.f={...this.f,doors:tt(this.f.doors,e)}}catch{}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}err(s,e){const a=s[e];return a?i`<span class="hint e" data-err=${e} role="alert">${l(a.key,a.vars)}</span>`:c}initials(s){return Fs(s)||"?"}whoSection(s){const e=this.f,a=i`<div class="seg" role="group" aria-label=${l("who")}>
      <button type="button" data-pmode="dir" aria-pressed=${String(e.mode==="dir")} @click=${()=>this.set({mode:"dir"})}><sw-icon name="users" size="15"></sw-icon>${l("fromDir")}</button>
      <button type="button" data-pmode="new" aria-pressed=${String(e.mode==="new")} @click=${()=>this.set({mode:"new"})}><sw-icon name="user" size="15"></sw-icon>${l("newPerson")}</button></div>`;let n;if(e.mode==="dir"){const o=this.contact();if(o){const d=M(o);n=i`<div class="who" data-person=${o.id}><span class="av">${this.initials(o.display_name)}</span><div style="min-inline-size:0"><b>${o.display_name}</b><small>${o.vendor_name||o.company||""}</small></div>
          <sw-button size="sm" data-person-change @click=${()=>this.set({contactId:null})}>${l("change")}</sw-button>
          <div class="acts"><span class="chip" data-tone=${d?"ok":"warn"}><sw-icon name="mail" size="13"></sw-icon>${o.phone?i`<span class="num">${o.phone}</span> · `:c}${d?l("confirmed"):o.has_phone?l("notConfirmed"):l("noNumber")}</span>
            ${!d&&o.has_phone?i`<sw-button size="sm" variant="ghost" ?disabled=${this.sentCode} data-send-code @click=${()=>this.sendCode(o.id)}>${this.sentCode?l("codeSent"):l("sendCode")}</sw-button>`:c}
            ${this.live.has(o.id)?i`<span class="chip" data-tone="acc">${l("liveAccess")}</span>`:c}</div></div>`}else{const d=e.q.trim().toLowerCase(),r=(this.contacts??[]).filter(p=>!d||`${p.display_name} ${p.company} ${p.vendor_name??""} ${p.phone??""}`.toLowerCase().includes(d)).slice(0,80),w=p=>{const $=zs(p);return $!=="ok"?i`<span class="chip" data-tone="off">${l(`dis_${$}`)}</span>`:this.live.has(p.id)?i`<span class="chip" data-tone="acc">${l("liveShort")}</span>`:M(p)?i`<span class="chip" data-tone="ok"><sw-icon name="check" size="12"></sw-icon>${l("confirmed")}</span>`:i`<span class="chip" data-tone="warn">${l("notConfirmed")}</span>`};n=i`<div class="search"><sw-icon name="search" size="16"></sw-icon><input class="in" type="search" data-person-search aria-invalid=${s.person?"true":"false"} placeholder=${l("searchPerson")} .value=${e.q}
            @input=${p=>this.set({q:p.target.value})} /></div>
          ${this.dirError?i`<p class="note">${l("dirUnavailable")}</p>`:this.contacts===null?i`<p class="note">${l("loading")}</p>`:r.length?i`<div class="plist" role="radiogroup" aria-label=${l("fromDir")}>${r.map(p=>{const $=zs(p)!=="ok";return i`<label class=${$?"dis":""} data-contact=${p.id}><input type="radio" name="pp" .disabled=${$} @change=${()=>this.pick(p)} />
                      <span class="av">${this.initials(p.display_name)}</span><span class="nm"><b>${p.display_name}</b><small>${p.vendor_name||p.company||""}${p.phone?i` · <span class="num">${p.phone}</span>`:c}</small></span>${w(p)}</label>`})}</div>`:i`<div class="row"><span class="note">${l("noMatch")}</span><sw-button size="sm" icon="plus" @click=${()=>this.set({mode:"new",np:{...e.np,name:e.q}})}>${l("addNew")}</sw-button></div>`}
          ${this.err(s,"person")}`}}else{const o=e.np,d=r=>this.set({np:{...o,...r}});n=i`<div class="f2">
          <div class="field"><label for="np-name">${l("fullName")}</label><input id="np-name" class="in" autocomplete="off" maxlength="80" aria-invalid=${s.npName?"true":"false"} .value=${o.name} @input=${r=>d({name:r.target.value})} />${this.err(s,"npName")}</div>
          <div class="field"><label for="np-co">${l("company")}</label><input id="np-co" class="in" autocomplete="off" maxlength="80" list="vendors" .value=${o.company} @input=${r=>d({company:r.target.value})} />
            <datalist id="vendors">${this.vendors.map(r=>i`<option value=${r.display_name}></option>`)}</datalist></div>
          <div class="field"><label for="np-ph">${l("whatsapp")}</label><input id="np-ph" class="in num" type="tel" inputmode="tel" autocomplete="off" placeholder="05X-XXXXXXX" style="text-align:start" aria-invalid=${s.npPhone?"true":"false"} .value=${o.phone} @input=${r=>d({phone:r.target.value})} />${this.err(s,"npPhone")}</div>
          <div class="field"><label for="np-lang">${l("msgLang")}</label><select id="np-lang" class="in" @change=${r=>d({lang:r.target.value})}>${_s.map(r=>i`<option value=${r} ?selected=${o.lang===r}>${l(`lang_${r}`)}</option>`)}</select></div>
        </div>
        <div class="row"><span class="chip" data-tone="warn"><sw-icon name="mail" size="13"></sw-icon>${l("onSave")}</span></div>`}return i`<section class="sec" data-sec="who"><h4><sw-icon name="user" size="14"></sw-icon>${l("who")}</h4>${a}${n}
      <div class="lockrow" data-extended-identity="locked"><sw-icon name="lock" size="16"></sw-icon><b>${l("extIdentity")}</b><span class="chip" data-tone="off">${l("locked")}</span></div></section>`}pick(s){this.sentCode=!1;const e={contactId:s.id};this.g?.system_admin&&M(s)&&this.g.reachable&&(e.path="self"),M(s)||(e.path="send"),this.set(e)}async sendCode(s){try{await ks.contactSend(s),this.sentCode=!0}catch(e){this.error=S(e)}}purposeSection(s){const e=this.f,a=ps();return i`<section class="sec" data-sec="purpose"><h4>${a?i`<sw-icon name="ticket" size="14"></sw-icon>`:c}${l("purpose")}<span class="chip" data-tone="off">${l("optional")}</span></h4>
      <div class="f2">${a?i`<div class="field"><label for="tk">${l("ticket")}</label><select id="tk" class="in" @change=${n=>this.changeTicket(n.target.value)}>
          <option value="" ?selected=${!e.ticketId}>${l("none")}</option>${this.tickets.map(n=>i`<option value=${n.id} ?selected=${e.ticketId===n.id}>#${n.number} · ${n.title}</option>`)}</select></div>`:c}
        <div class="field"><label for="pu">${l("purposeVisit")}</label><input id="pu" class="in" autocomplete="off" maxlength=${Os} aria-invalid=${s.purpose?"true":"false"} .value=${e.purpose} @input=${n=>this.set({purpose:n.target.value})} />${this.err(s,"purpose")}</div></div>
      ${a&&e.ticketId?i`<div class="row"><span class="chip" data-tone="acc"><sw-icon name="info" size="13"></sw-icon>${l("endsWithTicket")}</span></div>`:c}</section>`}stationBox(s,e){return i`<div class="st-h"><sw-icon name="door" size="14"></sw-icon><span>${s.name??s.station_id}</span></div>${s.relays.map(a=>{const n=st(s.station_id,a.relay);return i`<label class="cb"><input type="checkbox" data-door=${n} .checked=${this.f.doors.has(n)} .disabled=${!e} @change=${o=>{const d=new Set(this.f.doors);o.target.checked?d.add(n):d.delete(n),this.set({doors:d})}} /><span><b>${a.name||l("doorN",{n:a.relay})}</b><small>${l("doorN",{n:a.relay})}</small></span></label>`})}`}doorsSection(s){const e=this.g,a=this.f,n=e?.max_doors??4,o=a.dq.trim().toLowerCase(),d=e?.stations??[],r=u=>!o||`${u.name??""} ${u.relays.map(x=>x.name??"").join(" ")}`.toLowerCase().includes(o),w=d.filter(u=>u.may_request&&r(u)),p=d.filter(u=>!u.may_request&&r(u)),$=new Map(d.map(u=>[u.station_id,u])),y=u=>{const[x,R]=G(u),C=$.get(x),V=C?.relays.find(X=>X.relay===R)?.name;return i`<span class="chip door" data-tone="acc"><sw-icon name="door" size="13"></sw-icon>${C?.name??x} · ${V||l("doorN",{n:R})}</span>`};return i`<section class="sec" data-sec="doors"><h4><sw-icon name="door" size="14"></sw-icon>${l("doors")}<span class="sp"></span><span class="chip num" data-door-count data-tone=${a.doors.size>n?"err":"acc"}>${a.doors.size} / ${n}</span></h4>
      ${d.length>8?i`<div class="search"><sw-icon name="search" size="16"></sw-icon><input class="in" type="search" placeholder=${l("searchDoor")} .value=${a.dq} @input=${u=>this.set({dq:u.target.value})} /></div>`:c}
      ${a.doors.size?i`<div class="chips" data-chosen>${[...a.doors].map(y)}</div>`:c}
      ${w.length?i`<div class="stgrp" data-open-stations>${w.map(u=>this.stationBox(u,!0))}</div>`:i`<p class="note">${l("noStations")}</p>`}
      ${p.length?i`<details class="locked" data-locked-stations><summary><sw-icon name="lock" size="14"></sw-icon>${l("lockedStations",{n:p.length})}</summary><div class="stgrp" style="margin-block-start:8px">${p.map(u=>this.stationBox(u,!1))}</div></details>`:c}
      ${this.err(s,"doors")}</section>`}whenSection(s){const e=this.f,a=this.today(),n=this.g?.max_days??14,o=e.from&&e.until&&e.until>=e.from?ls(e.from,e.until):0,d=ot(e.from,a,this.codeHour,Be(new Date,this.tz)),r=at(e.from,e.until),w=(p,$)=>{const y=new Set(p);return y.has($)?y.delete($):y.add($),y};return i`<section class="sec" data-sec="when"><h4><sw-icon name="calendar" size="14"></sw-icon>${l("when")}<span class="sp"></span><span class="chip" data-tone="off"><sw-icon name="clock" size="12"></sw-icon>${l("tz",{tz:this.tz})}</span></h4>
      <div class="f2"><div class="field"><label for="vf">${l("from")}</label><input id="vf" class="in num" type="date" lang=${O()} min=${a} aria-invalid=${s.dates?"true":"false"} .value=${e.from} @change=${p=>this.set({from:p.target.value,dates:new Set})} /></div>
        <div class="field"><label for="vu">${l("until")}</label><input id="vu" class="in num" type="date" lang=${O()} min=${e.from||a} aria-invalid=${s.dates?"true":"false"} .value=${e.until} @change=${p=>this.set({until:p.target.value,dates:new Set})} /></div></div>
      ${this.err(s,"dates")}
      ${o&&!s.dates?i`<div class="row"><span class="chip" data-tone="acc">${l("daysOf",{n:o,max:n})}</span>${e.cred==="pin"?i`<span class="chip" data-tone="off"><sw-icon name="mail" size="12"></sw-icon>${d?l("codeAt",{t:d}):l("codeAtOnce")}</span>`:c}</div>`:c}
      <div class="seg" role="group"><button type="button" aria-pressed=${String(e.dmode==="weekly")} @click=${()=>this.set({dmode:"weekly"})}>${l("weekdays")}</button><button type="button" aria-pressed=${String(e.dmode==="dates")} @click=${()=>this.set({dmode:"dates"})}>${l("specificDates")}</button></div>
      ${e.dmode==="weekly"?i`<div class="pills" data-days>${[0,1,2,3,4,5,6].map(p=>i`<button type="button" class="pill" aria-pressed=${String(e.days.has(p))} data-day=${p} @click=${()=>this.set({days:w(e.days,p)})}>${l(`d${p}`)}</button>`)}</div>`:i`<div class="pills" data-dates>${r.length?r.map(p=>i`<button type="button" class="pill num" aria-pressed=${String(e.dates.has(p))} @click=${()=>this.set({dates:w(e.dates,p)})}>${U(p)}</button>`):i`<span class="chip" data-tone="off">${l("pickRange")}</span>`}</div>`}
      ${this.err(s,"days")}
      <div class="wins" data-wins>${e.wins.map((p,$)=>i`<div class="win">
          <input class="in num" type="time" lang=${O()} aria-label=${l("winFrom")} aria-invalid=${s.wins?"true":"false"} .value=${p.s} @change=${y=>this.setWin($,{s:y.target.value})} /><span>–</span>
          <input class="in num" type="time" lang=${O()} aria-label=${l("winUntil")} aria-invalid=${s.wins?"true":"false"} .value=${p.e==="24:00"?"23:59":p.e} @change=${y=>{const u=y.target.value;this.setWin($,{e:u==="23:59"?"24:00":u})}} />
          <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${l("remove")} ?disabled=${e.wins.length===1} @click=${()=>this.set({wins:e.wins.filter((y,u)=>u!==$)})}></sw-button></div>`)}</div>
      ${this.err(s,"wins")}
      <div class="pills">${Qe.map(([p,$])=>i`<button type="button" class="pill num" aria-pressed=${String(e.wins.length===1&&e.wins[0].s===p&&e.wins[0].e===$)} @click=${()=>this.set({wins:[{s:p,e:$}]})}>${p}–${$}</button>`)}
        <sw-button size="sm" variant="ghost" icon="plus" ?disabled=${e.wins.length>=Ve} @click=${()=>{const p=e.wins[e.wins.length-1];this.set({wins:[...e.wins,{s:p.e==="24:00"?"23:00":p.e,e:"24:00"}]})}}>${l("addWin")}</sw-button></div></section>`}setWin(s,e){this.set({wins:this.f.wins.map((a,n)=>n===s?{...a,...e}:a)})}credSection(){const s=this.f;return i`<section class="sec" data-sec="cred"><h4><sw-icon name="shield" size="14"></sw-icon>${l("cred")}</h4>
      <div class="seg" role="group"><button type="button" data-cred="pin" aria-pressed=${String(s.cred==="pin")} @click=${()=>this.set({cred:"pin"})}><sw-icon name="mail" size="14"></sw-icon>${l("credPin")}</button>
        <button type="button" data-cred="none" aria-pressed=${String(s.cred==="none")} @click=${()=>this.set({cred:"none"})}>${l("credNone")}</button>
        ${this.cards?i`<button type="button" data-cred="card" aria-pressed=${String(s.cred==="card")} @click=${()=>this.set({cred:"card"})}><sw-icon name="shield" size="14"></sw-icon>${l("credCard")}</button>`:i`<button type="button" disabled aria-pressed="false" data-cred="card"><sw-icon name="lock" size="14"></sw-icon>${l("credCard")}</button>`}</div>
      ${s.cred==="pin"?i`<div class="seg" role="group" aria-label=${l("codeType")} data-code-mode><button type="button" data-once="0" aria-pressed=${String(!s.once)} @click=${()=>this.set({once:!1})}>${l("codeWindow")}</button>
            <button type="button" data-once="1" aria-pressed=${String(s.once)} @click=${()=>this.set({once:!0})}>${l("codeOnce")}</button></div>
            ${s.once?i`<p class="note">${l("codeOnceNote")}</p>`:c}`:c}</section>`}notesSection(){return i`<section class="sec" data-sec="notes"><h4><sw-icon name="edit" size="14"></sw-icon>${l("notes")}<span class="chip" data-tone="off">${l("internal")}</span></h4>
      <textarea class="in" aria-label=${l("notes")} maxlength=${Xe} .value=${this.f.notes} @input=${s=>this.set({notes:s.target.value})}></textarea></section>`}pathSection(s){const e=this.f,a=es(e,this.ctx()),n=this.appr,o=F(e.doors);return i`<section class="sec" data-sec="path"><h4><sw-icon name="route" size="14"></sw-icon>${l("path")}</h4>
      <div class="radio">
        <label class="cb" data-path="self"><input type="radio" name="path" .checked=${e.path==="self"} .disabled=${!!a} @change=${()=>this.set({path:"self"})} />
          <span><b>${l("approveNow")}</b>${a?i`<span class="chip" data-tone="off" data-self-block=${a}><sw-icon name="lock" size="12"></sw-icon>${l(a)}</span>`:i`<small>${l("approveNowSub")}</small>`}</span></label>
        <label class="cb" data-path="send"><input type="radio" name="path" .checked=${e.path==="send"} @change=${()=>this.set({path:"send"})} /><span><b>${l("sendApproval")}</b><small>${l("sendApprovalSub")}</small></span></label>
      </div>
      <div class="apprs" data-approvers=${n?n.count:""}><span class="avs">${(n?.approvers??[]).slice(0,4).map(d=>i`<span title=${d.name}>${this.initials(d.name)}</span>`)}</span>
        <span>${o.length?n?n.count?l("apprCount",{n:n.count}):l("apprNone"):l("loading"):l("apprFollow")}</span></div>
      ${this.err(s,"path")}
      <div class="lockrow"><sw-icon name="lock" size="16"></sw-icon><b>${l("autoApproval")}</b><span class="chip" data-tone="off">${l("autoNone")}</span></div></section>`}noticeSection(s){const e=this.notice,a=e?.lang??this.personLang(),n=a==="he"||a==="ar"?"rtl":"ltr";return i`<section class="sec" data-sec="notice"><h4><sw-icon name="shield" size="14"></sw-icon>${l("notice")}<span class="sp"></span><span class="chip" data-tone="off">${l("noticeLang",{lang:l(`lang_${a}`),v:e?.version??"n2"})}</span></h4>
      <div class="ntext" dir=${n} lang=${a} data-notice-text>${e?.text??l("loading")}</div>
      <label class="cb" ?data-invalid=${!!s.told}><input type="checkbox" data-told .checked=${this.f.told} @change=${o=>this.set({told:o.target.checked})} /><span><b dir=${n} lang=${a}>${e?.attest??""}</b></span></label>
      ${this.err(s,"told")}</section>`}previewSection(){const s=this.f;if(s.cred!=="pin")return c;const e=new Map((this.g?.stations??[]).map(r=>[r.station_id,r.name??r.station_id])),a=F(s.doors).map(r=>e.get(r)??r).join(", ")||"-",n=!s.from||!s.until?"-":s.from===s.until?U(s.from):`${U(s.from)}-${U(s.until)}`,o=s.wins.map(r=>`${r.s}-${r.e}`).join(", "),d=l("previewBody",{doors:a,dates:n,hours:o}).split("{pin}");return i`<section class="sec" data-sec="preview"><h4><sw-icon name="mail" size="14"></sw-icon>${l("preview")}</h4>
      <div class="bubble" data-preview>${d[0]}<span class="pin" aria-label="••••••"><sw-icon name="lock" size="12"></sw-icon>••••••</span>${d[1]??""}</div>
      <p class="note"><sw-icon name="lock" size="13"></sw-icon>${l("previewNote")}</p></section>`}async submit(){this.f={...this.f,tried:!0};const s=Ss(this.f,this.ctx());if(Object.keys(s).length){await this.updateComplete,this.renderRoot.querySelector("[data-err]")?.scrollIntoView({block:"center",behavior:"smooth"});return}this.busy=!0,this.error="";try{let e=this.f.contactId;if(this.f.mode==="new"){const o=this.f.np,d=this.vendors.find(w=>w.display_name.trim()===o.company.trim()),r=await ys().createContact({kind:"person",display_name:o.name.trim(),company:d?"":o.company.trim(),vendor_id:d?.id??null,phone:o.phone.trim(),lang:o.lang,preferred_channel:"whatsapp"});e=r.id,this.contacts=[r,...this.contacts??[]],this.f={...this.f,mode:"dir",contactId:r.id};try{await ks.contactSend(r.id)}catch{}}const a=await ge(rt(this.f,e,this.tz,this.g?.max_days??14)),n=a.approval?a.approval.approved?l("done_self"):l("done_selfFailed",{why:a.approval.message}):a.outcome==="merged"?l("done_merged"):l("done_send");this.dispatchEvent(new CustomEvent("done",{detail:{text:n,grant:a.grant},bubbles:!0,composed:!0}))}catch(e){this.error=S(e)}finally{this.busy=!1}}render(){if(this.noPerm)return i`<sw-dialog open heading=${l("title")} data-request-noperm @close=${()=>this.close()}>
        <div class="nop"><div class="art"><sw-icon name="lock" size="26"></sw-icon></div><h3>${l("noperm_title")}</h3><p>${l("noperm_text")}</p></div>
        <div slot="footer" class="foot"><span class="sp"></span><sw-button @click=${()=>this.close()}>${l("close")}</sw-button></div></sw-dialog>`;const s=this.g;if(!s)return i`<sw-dialog open xl heading=${l("title")} data-request-dialog @close=${()=>this.close()}>
        ${this.loadError?i`<div class="loadstate" role="alert" data-request-load-error><sw-icon name="warning" size="22"></sw-icon><b class="err-line">${l("loadError")}</b><span>${this.loadError}</span></div>`:i`<div class="loadstate" role="status" data-request-loading>${l("loading")}</div>`}
        <div slot="footer" class="foot" ?data-request-load-error=${!!this.loadError}><span class="sp"></span>
          <sw-button variant="ghost" data-close @click=${()=>this.close()}>${l("close")}</sw-button>
          ${this.loadError?i`<sw-button variant="primary" icon="refresh" data-retry @click=${()=>this.load()}>${l("retry")}</sw-button>`:c}</div></sw-dialog>`;const e=this.f.tried?Ss(this.f,this.ctx()):{},a=Object.keys(e).length,n=!s.reachable,o=s.as_of?Hs(new Date(s.as_of),{timeZone:this.tz}):"";return i`<sw-dialog open xl heading=${l("title")} data-request-dialog @close=${()=>this.close()}>
      ${n?i`<div class="banner" data-tone="warn" data-offline role="status"><sw-icon name="offline" size="16"></sw-icon><span>${s.has_copy&&o?l("offline",{t:o}):l("offlineNoCopy")}</span><span class="sp"></span>
            <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>${l("checkAgain")}</sw-button></div>`:c}
      <div class="ap">
        <div class="col">${this.whoSection(e)}${this.purposeSection(e)}${this.doorsSection(e)}${this.whenSection(e)}${this.credSection()}${this.notesSection()}</div>
        <div class="col">${this.pathSection(e)}${this.noticeSection(e)}${this.previewSection()}</div>
      </div>
      ${this.error?i`<p class="err-line" role="alert" data-request-error>${this.error}</p>`:c}
      <div slot="footer" class="foot">${this.f.tried&&a?i`<span class="chip" data-tone="err" data-fix-count><sw-icon name="warning" size="13"></sw-icon>${l("fieldsToFix",{n:a})}</span>`:c}
        <span class="sp"></span><sw-button variant="ghost" @click=${()=>this.close()}>${l("cancel")}</sw-button>
        <sw-button variant="primary" data-request-ok icon=${this.f.path==="self"?"check":"share"} ?disabled=${this.busy} @click=${()=>this.submit()}>${this.f.path==="self"?l("ok_self"):l("ok_send")}</sw-button></div>
    </sw-dialog>`}};b.styles=[os,as`
      :host { display: contents; --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px)); --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px)); }
      .ap { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 22px; align-items: start; }
      .col { display: grid; gap: 20px; min-inline-size: 0; }
      .sec > h4 .sp { flex: 1; }
      .seg { display: flex; gap: 4px; padding: 3px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
      .seg button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 0; background: transparent; color: var(--sw-text-2);
        min-block-size: var(--sw-touch-desktop, 44px); border-radius: var(--sw-r-sm); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; padding: 0 10px; }
      .seg button[aria-pressed='true'] { background: var(--sw-seg-key, var(--sw-surface-solid)); color: var(--sw-seg-key-ink, var(--sw-heading)); font-weight: 600; box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1)); }
      .seg button:disabled { opacity: .5; cursor: not-allowed; }
      .seg button:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 1px; }
      .f2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
      textarea.in { min-block-size: 76px; padding-block: 8px; resize: vertical; }
      select.in { appearance: auto; }
      .search { position: relative; }
      .search sw-icon { position: absolute; inset-inline-start: 11px; inset-block-start: 50%; transform: translateY(-50%); color: var(--sw-text-3); pointer-events: none; }
      .search .in { padding-inline-start: 36px; }
      .plist { display: grid; max-block-size: 232px; overflow: auto; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-md); }
      .plist label { display: grid; grid-template-columns: 20px 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 12px; border-block-end: 1px solid var(--sw-border); cursor: pointer; }
      .plist label:last-child { border-block-end: 0; }
      @media (hover: hover) and (pointer: fine) { .plist label:hover { background: var(--sw-hover-wash); } } /* POLISH4-WP8: no sticky wash after a tap */
      .plist label.dis { cursor: not-allowed; opacity: .62; }
      .plist input { inline-size: 18px; block-size: 18px; margin: 0; accent-color: var(--sw-accent); }
      .av { inline-size: 34px; block-size: 34px; border-radius: 50%; background: var(--sw-accent-soft); color: var(--sw-accent-text); display: grid; place-items: center; font-size: var(--sw-fs-xs); font-weight: 700; flex: none; }
      .nm { min-inline-size: 0; }
      .nm b, .who b { display: block; color: var(--sw-heading); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .nm small, .who small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .who { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
      .who .acts { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .who b { white-space: normal; overflow-wrap: anywhere; }
      .lockrow { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-sm); border: 1px dashed var(--sw-border-strong); color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .lockrow b { color: var(--sw-heading); }
      .st-h { display: flex; align-items: center; gap: 6px; font-size: var(--sw-fs-sm); font-weight: 600; color: var(--sw-text-2); grid-column: 1 / -1; margin-block-start: 4px; min-inline-size: 0; }
      .st-h span { overflow-wrap: anywhere; }
      .stgrp { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .stgrp label.cb { align-items: center; }
      .stgrp label.cb:has(input:checked) { background: var(--sw-accent-soft); border-color: var(--sw-accent); }
      .stgrp label.cb:has(input:disabled) { opacity: .6; cursor: not-allowed; }
      .stgrp b { display: block; font-weight: 600; color: var(--sw-heading); overflow-wrap: anywhere; }
      details.locked summary { cursor: pointer; display: inline-flex; gap: 6px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text-2); padding: 0 2px; min-block-size: var(--sw-touch-desktop, 44px); list-style: none; }
      details.locked summary::-webkit-details-marker { display: none; }
      .pills { display: flex; flex-wrap: wrap; gap: 6px; }
      .pill { border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); color: var(--sw-text); border-radius: var(--sw-r-pill); min-block-size: var(--sw-touch-desktop, 44px); min-inline-size: 44px;
        padding: 0 12px; font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; }
      .pill[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); font-weight: 600; }
      .pill:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
      .wins { display: grid; gap: 8px; }
      .win { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto; gap: 8px; align-items: center; }
      .radio { display: grid; gap: 8px; }
      .radio label.cb:has(input:checked) { background: var(--sw-accent-soft); border-color: var(--sw-accent); }
      .radio label.cb:has(input:disabled) { cursor: not-allowed; }
      .radio b { display: block; color: var(--sw-heading); }
      .apprs { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .avs { display: inline-flex; }
      .avs span { inline-size: 28px; block-size: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-accent-soft); color: var(--sw-accent-text);
        font-size: var(--sw-fs-xs); font-weight: 700; border: 2px solid var(--sw-surface); margin-inline-start: -6px; }
      .avs span:first-child { margin-inline-start: 0; }
      .ntext { padding: 12px 14px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); line-height: 1.6; color: var(--sw-text); max-block-size: 160px; overflow: auto; }
      .bubble { padding: 12px 14px; border-radius: var(--sw-r-md); background: var(--sw-success-soft); color: var(--sw-text); font-size: var(--sw-fs-sm); line-height: 1.6; max-inline-size: 440px; }
      .pin { display: inline-flex; gap: 3px; align-items: center; padding: 0 6px; border-radius: var(--sw-r-xs); background: var(--sw-surface-3); letter-spacing: 2px; direction: ltr; }
      .banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--cs); color: var(--ct); font-weight: 600; font-size: var(--sw-fs-sm); }
      .banner .sp { flex: 1; }
      .loadstate { display: grid; justify-items: center; gap: 12px; text-align: center; padding: 24px 8px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .hint.e { color: var(--x-err-t); font-weight: 600; font-size: var(--sw-fs-xs); }
      .in[aria-invalid='true'], label.cb[data-invalid] { border-color: var(--sw-danger); }
      .foot { display: flex; gap: 8px; align-items: center; inline-size: 100%; flex-wrap: wrap; }
      .foot .sp { flex: 1; }
      .nop { display: grid; justify-items: center; gap: 10px; text-align: center; padding: 8px 4px 4px; }
      .nop .art { inline-size: 56px; block-size: 56px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); display: grid; place-items: center; color: var(--sw-text-2); }
      .nop h3 { margin: 0; font-size: var(--sw-fs-lg); color: var(--sw-heading); }
      .nop p { margin: 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); max-inline-size: 340px; }
      @media (max-width: 900px) {
        .ap { grid-template-columns: 1fr; }
      }
      @media (max-width: 560px) {
        .f2, .stgrp { grid-template-columns: 1fr; }
        .who { grid-template-columns: auto minmax(0, 1fr); }
        .who > sw-button { grid-column: 1 / -1; }
      }
    `];k([P()],b.prototype,"tz",2);k([P({type:Number})],b.prototype,"codeHour",2);k([P({attribute:!1})],b.prototype,"live",2);k([P({type:Boolean})],b.prototype,"noPerm",2);k([P({type:Boolean})],b.prototype,"cards",2);k([h()],b.prototype,"f",2);k([h()],b.prototype,"g",2);k([h()],b.prototype,"loadError",2);k([h()],b.prototype,"contacts",2);k([h()],b.prototype,"dirError",2);k([h()],b.prototype,"vendors",2);k([h()],b.prototype,"tickets",2);k([h()],b.prototype,"appr",2);k([h()],b.prototype,"notice",2);k([h()],b.prototype,"busy",2);k([h()],b.prototype,"error",2);k([h()],b.prototype,"sentCode",2);b=k([ns("access-request-dialog")],b);const A="/access/wiskey-visits",ht=()=>H(A),ut=(s={})=>{const e=new URLSearchParams;for(const[n,o]of Object.entries(s))o!==void 0&&o!==""&&e.set(n,String(o));const a=e.toString();return H(`${A}/visits${a?`?${a}`:""}`)},mt=()=>H(`${A}/templates`),wt=()=>H(`${A}/links`),ft=s=>Cs(`${A}/${encodeURIComponent(s)}/push`,{confirmed:!0}),vt=s=>Cs(`${A}/${encodeURIComponent(s)}/reconcile`),gt=s=>Gs(`${A}/settings`,{push:s}),Ts={visits:m("הצגת ביקורים ממערכת בקרת הכניסה"),templates:m("תבניות אורחים"),push:m("רישום הזמנות Arx במערכת בקרת הכניסה")};function $t(s){return["visits","templates","push"].map(e=>{const a=s[e];if(a?.available)return{name:e,label:Ts[e],tone:"ok",text:m("זמין")};const n=a?.message||(a?.reason?m("לא זמין ({reason})",{reason:a.reason}):m("לא זמין")),o=a?.reason==="push_off"?"off":"warn";return{name:e,label:Ts[e],tone:o,text:n}})}const Ds={pending:[m("ממתין לאישור"),"warn"],approved:[m("מאושר"),"ok"],rejected:[m("נדחה"),"err"],cancelled:[m("בוטל"),"off"],superseded:[m("הוחלף"),"off"],unknown:[m("לא ידוע"),"off"]};function bt(s){const[e,a]=Ds[s]??Ds.unknown;return{text:e,tone:a}}function yt(s){return s.origin==="arx"?{text:m("הזמנה של Arx"),tone:"acc"}:{text:m("נוצר במערכת בקרת הכניסה · צפייה בלבד"),tone:"off"}}const Ns={never:[m("לא נרשם"),"off"],sending:[m("בשליחה"),"acc"],pushed:[m("נרשם"),"ok"],refused:[m("נדחה"),"err"],not_sent:[m("לא נשלח"),"off"],unknown:[m("תוצאה לא ברורה"),"warn"]};function kt(s,e){const[a,n]=Ns[s.state]??Ns.never;if(s.state==="unknown")return{action:"reconcile",text:a,tone:n};if(s.state==="sending")return{action:"none",text:a,tone:n};if(s.state==="pushed"&&s.in_sync)return{action:"none",text:a,tone:n};const o=s.state==="pushed"&&!s.in_sync,d=o?m("נרשם · יש עדכון לשליחה"):a;return!e||!s.pushable?{action:"none",text:d,tone:o?"warn":n}:{action:"push",text:d,tone:o?"warn":n}}function xt(s){return s?s%1440===0?s===1440?m("יום"):m("{n} ימים",{n:s/1440}):s%60===0?s===60?m("שעה"):m("{n} שעות",{n:s/60}):m("{n} דקות",{n:s}):"—"}var _t=Object.defineProperty,zt=Object.getOwnPropertyDescriptor,N=(s,e,a,n)=>{for(var o=n>1?void 0:n?zt(e,a):e,d=s.length-1,r;d>=0;d--)(r=s[d])&&(o=(n?r(e,a,o):r(o))||o);return n&&o&&_t(e,a,o),o};let T=class extends is{constructor(){super(...arguments),this.home=null,this.off=!1,this.visits=null,this.templates=null,this.links=[],this.error="",this.busy=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{this.home=await ht()}catch(a){a instanceof qs&&(a.status===404||a.status===403)?this.off=!0:this.error=S(a);return}const s=this.home.capabilities,e=[wt().then(a=>this.links=a.links).catch(()=>this.links=[])];s.visits.available&&this.home.can.list&&e.push(ut({limit:50}).then(a=>this.visits=a.visits?.items??[]).catch(()=>this.visits=null)),s.templates.available&&e.push(mt().then(a=>this.templates=a.templates?.items??[]).catch(()=>this.templates=null)),await Promise.all(e)}async run(s,e){this.busy=s,this.error="";try{await e()}catch(a){this.error=S(a)}finally{this.busy="",await this.load()}}render(){if(this.off)return c;const s=this.home;if(!s)return this.error?i`<p class="err-line" role="alert">${this.error}</p>`:i`<p class="note">${m("טוען…")}</p>`;const e=s.capabilities.push;return i`
      <ul class="lines" data-visit-capabilities>
        ${$t(s.capabilities).map(a=>i`<li data-capability=${a.name} data-tone=${a.tone}><b>${a.label}</b><small>${a.text}</small></li>`)}
      </ul>
      ${s.can.settings&&e.offered?i`<p class="note"><sw-button size="sm" variant="ghost" data-visit-switch ?disabled=${!!this.busy}
          @click=${()=>this.run("switch",()=>gt(e.switch==="on"?"off":"on"))}>${e.switch==="on"?m("כיבוי הרישום"):m("הפעלת הרישום")}</sw-button></p>`:c}
      ${this.links.length?this.linksTable(e.available):c}
      ${this.visits?this.visitsTable(this.visits):c}
      ${this.templates?this.templatesTable(this.templates):c}
      ${this.error?i`<p class="err-line" role="alert">${this.error}</p>`:c}`}linksTable(s){return i`<h5>${m("הזמנות Arx")}</h5><table data-visit-links><tbody>${this.links.map(e=>{const a=kt(e,s);return i`<tr data-link=${e.invite_id}><td><span class="chip" data-tone=${a.tone}>${a.text}</span></td><td class="row-actions">
        ${a.action==="push"?i`<sw-button size="sm" ?disabled=${!!this.busy} @click=${()=>this.run(e.invite_id,()=>ft(e.invite_id))}>${m("רישום")}</sw-button>`:c}
        ${a.action==="reconcile"?i`<sw-button size="sm" variant="ghost" ?disabled=${!!this.busy} @click=${()=>this.run(e.invite_id,()=>vt(e.invite_id))}>${m("בדיקה מול מערכת בקרת הכניסה")}</sw-button>`:c}
      </td></tr>`})}</tbody></table>`}visitsTable(s){return s.length?i`<h5>${m("ביקורים במערכת בקרת הכניסה")}</h5><table data-visits><tbody>${s.map(e=>{const a=bt(e.status),n=yt(e);return i`<tr data-visit=${e.id}><td>${e.display_name??"—"}</td><td><span class="chip" data-tone=${a.tone}>${a.text}</span></td>
        <td><span class="chip" data-tone=${n.tone}>${n.text}</span></td></tr>`})}</tbody></table>`:i`<h5>${m("ביקורים במערכת בקרת הכניסה")}</h5><p class="note">${m("אין ביקורים.")}</p>`}templatesTable(s){return s.length?i`<h5>${m("תבניות אורחים")}</h5><table data-templates><tbody>${s.map(e=>i`<tr data-template=${e.id}><td>${e.label}</td>
      <td>${xt(e.duration_minutes)}</td><td>${m("{n} עמדות",{n:Object.keys(e.doors).length})}</td></tr>`)}</tbody></table>`:i`<h5>${m("תבניות אורחים")}</h5><p class="note">${m("אין תבניות.")}</p>`}};T.styles=[os,as`
      :host { display: block; }
      .lines { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
      .lines li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
      .lines b { font-weight: 600; }
      .lines small { color: var(--ct, var(--sw-text-2)); }
      table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); margin-block-start: 8px; }
      th, td { text-align: start; padding: 4px 6px; border-block-end: 1px solid var(--sw-border); vertical-align: top; }
      .row-actions { display: flex; gap: 6px; }
      .err-line { color: var(--sw-danger-text); margin: 6px 0 0; }
      h5 { margin: 12px 0 4px; font-size: var(--sw-fs-sm); }
      .note { color: var(--sw-text-2); margin: 4px 0 0; font-size: var(--sw-fs-sm); }
    `];N([h()],T.prototype,"home",2);N([h()],T.prototype,"off",2);N([h()],T.prototype,"visits",2);N([h()],T.prototype,"templates",2);N([h()],T.prototype,"links",2);N([h()],T.prototype,"error",2);N([h()],T.prototype,"busy",2);T=N([ns("wiskey-visits-panel")],T);var St=Object.defineProperty,Tt=Object.getOwnPropertyDescriptor,g=(s,e,a,n)=>{for(var o=n>1?void 0:n?Tt(e,a):e,d=s.length-1,r;d>=0;d--)(r=s[d])&&(o=(n?r(e,a,o):r(o))||o);return n&&o&&St(e,a,o),o};const Dt=15e3,Nt={attention:"kpiAttention",waiting:"kpiWaiting",moving:"kpiMoving",active:"kpiActive",history:"kpiHistory"},At={attention:"err",waiting:"acc",moving:"acc",active:"ok",history:"off"},W={rfq_order:"srcRfq",ticket:"srcTicket",manual:"srcManual"},As={missing:"err",scope:"err",unknown:"warn",sync_pending:"warn",name:"warn",unverified:"acc",idle_person:"off"},Ct={missing:"user",scope:"door",unknown:"help",sync_pending:"refresh",name:"edit",unverified:"help",idle_person:"user"},qt=["missing","scope","unknown","unverified"];function Ot(s,e){const a=URL.createObjectURL(s),n=document.createElement("a");n.href=a,n.download=e,n.rel="noopener",n.style.display="none",document.body.appendChild(n),n.click(),n.remove(),window.setTimeout(()=>URL.revokeObjectURL(a),3e4)}let v=class extends is{constructor(){super(...arguments),this.bubbleSkin=new Vs(this),this.route=null,this.data=null,this.error="",this.query={filter:"live",q:"",station:"",source:""},this.sel=null,this.detail=null,this.dialog=null,this.digest=null,this.drift=null,this.exporting=!1,this.pending=null,this.busy=!1,this.dlgError="",this.readiness=null,this.toasts=[],this.tz="Asia/Jerusalem",this.cardNo="",this.history=null,this.apDoors=new Set,this.apFrom="",this.apUntil="",this.apTold=!1,this.goneChecks=[!1,!1,!1],this.goneRef="",this.word="",this.draft=null,this.loadedAt=0,this.stale=!1,this.reading=null,this.rb=null,this.onResume=()=>{document.visibilityState==="visible"&&this.load()},this.toastSeq=0,this.routed=!1}connectedCallback(){super.connectedCallback(),Xs().then(s=>this.tz=String(s["time.zone"]||"Asia/Jerusalem")).catch(()=>{}),this.load(),this.loadDigest(),this.loadDrift(),this.timer=window.setInterval(()=>{document.visibilityState==="visible"&&!this.dialog&&this.load()},Dt),document.addEventListener("visibilitychange",this.onResume),window.addEventListener("online",this.onResume),this.unclock=Qs(()=>{this.sel&&this.requestUpdate()})}disconnectedCallback(){window.clearInterval(this.timer),document.removeEventListener("visibilitychange",this.onResume),window.removeEventListener("online",this.onResume),this.unclock?.(),super.disconnectedCallback()}updated(s){s.has("route")&&this.data&&!this.routed&&this.applyRoute()}applyRoute(){this.routed=!0;const s=this.route?.params,e=s?.get("grant");e&&this.data?.grants.some(a=>a.id===e)&&this.openDrawer(e),s?.get("digest")==="1"&&this.openDigest(),s?.get("request")==="1"&&this.openRequest(),s?.get("drift")==="1"&&this.openDrift()}async load(){this.loadPending();try{if(this.data=await $e(!0),this.error="",this.stale=!1,this.loadedAt=Date.now(),this.routed||this.applyRoute(),this.sel&&!this.dialog){const s=this.data.grants.find(e=>e.id===this.sel);s&&(this.detail={...s,closure:s.closure?{...s.closure,reference:this.detail?.closure?.reference}:null})}}catch(s){this.error=S(s),this.stale=!!this.data}}async loadPending(){try{this.pending=await be()}catch{this.pending=null}}async loadDigest(){try{this.digest=(await ye()).digest}catch{this.digest=null}}async loadDrift(){try{this.drift=(await ke()).drift}catch{this.drift=null}}async exportCsv(){this.exporting=!0;try{const s=await xe(E()==="he"?"he":"en");Ot(s.blob,s.filename),this.toast("exportDone",{n:s.rows})}catch(s){s instanceof qs&&s.body.code==="export_rate"?this.toast("exportRate"):(this.error=S(s),this.toast("failed"))}finally{this.exporting=!1}}toast(s,e){this.toastText(t(s,e))}toastText(s){const e=++this.toastSeq;this.toasts=[...this.toasts,{id:e,text:s}],window.setTimeout(()=>this.toasts=this.toasts.filter(a=>a.id!==e),3200)}fmt(s,e=!0){if(!s)return"";const a=new Date(s);if(Number.isNaN(a.getTime()))return"";try{return a.toLocaleString(Ys(),{timeZone:this.tz,...e?{day:"2-digit",month:"2-digit"}:{},hour:"2-digit",minute:"2-digit",hourCycle:"h23"})}catch{return a.toLocaleString()}}async openDrawer(s){this.sel=s,this.detail=this.data?.grants.find(e=>e.id===s)??null;try{const e=(await _e(s)).grant;this.sel===s&&(this.detail=e)}catch{}}closeDrawer(){this.sel=null,this.detail=null,this.rb=null,this.cardNo="",this.history=null}async act(s,e,a,n){this.busy=!0,this.dlgError="";try{return await s(),n?this.toastText(n):this.toast(e,a),await this.load(),this.sel&&await this.openDrawer(this.sel),this.loadDigest(),this.loadDrift(),!0}catch(o){return this.dlgError=S(o),this.dialog||this.toast("failed"),!1}finally{this.busy=!1}}async readBack(s){const e=this.data?.grants.find(a=>a.id===s)??(this.detail?.id===s?this.detail:null);this.reading=s,this.rb=null;try{const a=await gs(s),n=new Date().toISOString();await this.load();const o=this.data?.grants.find(r=>r.id===s)??a?.grant??null;if(this.sel===s&&await this.openDrawer(s),this.loadDigest(),!e)return;const d=te(e,o);d.kind==="changed"?this.toast("rb_changed",{state:t(d.key)}):(this.rb={id:s,at:n,kind:"still",key:d.key},this.sel!==s&&this.toast(d.key,{t:this.fmt(n,!1)}))}catch(a){this.rb={id:s,at:new Date().toISOString(),kind:"error",key:"rb_failed",why:S(a)},this.sel!==s&&this.toast("failed")}finally{this.reading=null}}rbLine(s){const e=this.rb;if(!e||e.id!==s.id)return c;const a=this.fmt(e.at,!1);return e.kind==="error"?i`<p class="rb-line" data-tone="err" role="alert" data-readback-result="error"><sw-icon name="warning" size="14"></sw-icon>${t("rb_failed",{t:a,why:e.why??""})}</p>`:i`<p class="rb-line" role="status" data-readback-result="still"><sw-icon name="clock" size="14"></sw-icon>${t(e.key,{t:a})}</p>`}readBtn(s,e,a){const n=this.reading===s.id,o=this.rb?.id===s.id;return i`<sw-button variant=${e?"primary":"secondary"} icon="refresh" data-action="read" aria-busy=${String(n)} ?disabled=${n||a||this.busy}
      @click=${()=>this.readBack(s.id)}>${n?t("rb_reading"):o?t("a_readAgain"):t("a_readNow")}</sw-button>`}confirm(s){this.word="",this.dlgError="",this.dialog={kind:"confirm",c:s}}name(s){return s.person.name||"—"}badge(s,e=!1){const a=B(s);return i`<span class="badge ${e?"soft":""}" data-tone=${ms[a]} data-ui-state=${a}><sw-icon name=${ws[a]} size="14"></sw-icon>${t(`st_${a}`)}</span>`}codeCell(s){const e=ae(s);if(!e)return i`<span class="chip" data-tone="off">${t("code_hidden")}</span>`;const a=e.key==="code_pending"?this.fmt(s.code_due_at):"";return i`<span class="chip" data-tone=${e.tone} data-code-state=${s.code_state??""}><sw-icon name=${e.tone==="warn"?"warning":"mail"} size="13"></sw-icon>${t(e.key,{when:a})}</span>${s.person.number?i`<small class="num">${t("whatsapp")} ${s.person.number}</small>`:c}`}doorChips(s){return i`<span class="chips">${s.doors.map(e=>i`<span class="chip door" data-tone="acc"><sw-icon name="door" size="13"></sw-icon>${e.name}</span>`)}${this.amendAdds(s).map(e=>i`<span class="chip door add"><sw-icon name="plus" size="13"></sw-icon>${e}</span>`)}</span>`}amendAdds(s){if(!s.pending_amendment)return[];const e=new Set(s.doors.map(n=>n.station_id)),a=new Map((this.data?.grants??[]).flatMap(n=>n.doors).map(n=>[n.station_id,n.name]));return Object.keys(s.pending_amendment.doors).filter(n=>!e.has(n)).map(n=>a.get(n)??n)}reasonText(s){return K(`reason_${s??"manual"}`,"reason_manual")}drawer(){const s=this.detail;if(!s)return c;const e=B(s),a=ie(s,!!this.data?.system_admin),n=ne(s),o=oe(s),d=ms[e],r=[s.company,t(s.category==="contractor"?"contractor":"visitor"),s.source_ref?`${t(W[s.source]??"srcManual")} ${s.source_ref}`:t(W[s.source]??"srcManual")].filter(Boolean).join(" · "),w=s.revoking_since?Math.max(0,(Date.now()-Date.parse(s.revoking_since))/6e4):0,p=s.link?.state==="wiskey_missing",$=Y(this.data),y=re(s,$);return i`<sw-drawer modal .open=${!0} heading=${this.name(s)} subheading=${r} data-grant-drawer=${s.id} @close=${()=>this.closeDrawer()}>
      <div class="db">
        <div class="dhead">${this.badge(s,!0)}${s.pending_amendment?i`<span class="chip" data-tone="acc">${t("widening")}</span>`:c}</div>
        <div class="callout" data-tone=${d}><sw-icon name=${ws[e]} size="18"></sw-icon><div><b>${t(`st_${e}`)}</b>${K(fs(s),"why_pending")}</div></div>
        ${e==="revoking"?i`<div class="callout" data-tone="off" data-revoke-box><sw-icon name="bell" size="18"></sw-icon><div><b>${t("openSince",{t:this.fmt(s.revoking_since),d:Z(w,E())})}</b>${this.reasonText(s.end_reason)}</div></div>`:c}
        ${y?this.readbackBox(s,y,a.readNow):c}
        ${s.pending_amendment?i`<section class="sec"><h4><sw-icon name="plus" size="14"></sw-icon>${t("amendTitle")}</h4><div class="diff"><span class="h"></span><span class="h">${t("amendNow")}</span><span class="h">${t("amendAsked")}</span>
              <span>${t("doorsTitle")}</span><span class="chips">${s.doors.map(u=>i`<span class="chip door" data-tone="acc">${u.name}</span>`)}</span><span class="chips">${s.doors.map(u=>i`<span class="chip door" data-tone="acc">${u.name}</span>`)}${this.amendAdds(s).map(u=>i`<span class="chip door add">${u}</span>`)}</span>
              <span>${t("dates")}</span><b class="num">${q(s.valid_from,s.valid_until,this.tz)}</b><b class="num">${q(s.pending_amendment.valid_from,s.pending_amendment.valid_until,this.tz)}</b></div></section>`:c}
        ${e==="sync"?i`<div class="callout" data-tone="warn"><sw-icon name="refresh" size="18"></sw-icon><div><b>${t("syncTitle")}</b>${t("syncText")}</div></div>`:c}
        ${e==="unknown"?i`<div class="ku"><div><h4><sw-icon name="check" size="14"></sw-icon>${t("un_known")}</h4><ul><li>${t("un_k1")}</li><li>${t("un_k2")}</li></ul></div>
              <div class="unk"><h4><sw-icon name="help" size="14"></sw-icon>${t("un_unknown")}</h4><ul><li>${t("un_u1")}</li><li>${t("un_u2")}</li><li>${t("un_u3")}</li></ul></div></div>`:c}
        <section class="sec"><h4><sw-icon name="layers" size="14"></sw-icon>${t(n.revoke?"ladderRevokeTitle":"ladderTitle")}</h4>
          <div class="ladder" style=${`--n:${n.steps.length}`} role="list" data-ladder>${n.steps.map(u=>i`<div class="stp" role="listitem" data-s=${u.mark}><i aria-hidden="true">${{done:"✓",cur:"•",unk:"?",stop:"!",no:""}[u.mark]}</i>${t(u.key)}</div>`)}</div>
          ${this.howBlock(e,p)}</section>
        <section class="sec"><h4><sw-icon name="door" size="14"></sw-icon>${t("doorsTitle")}${e==="unknown"?i`<span class="chip" data-tone="warn">${t("mapUnknown")}</span>`:c}</h4>
          <div class="dtable">${s.doors.flatMap(u=>u.relays.map(x=>i`<div data-door=${`${u.station_id}:${x}`}><span><b>${u.name}</b><small>${t("doorN",{n:x})}</small></span><span class="chip" data-tone=${o.tone}>${t(o.key)}</span></div>`))}</div></section>
        <section class="sec"><h4><sw-icon name="calendar" size="14"></sw-icon>${t("windowTitle")}</h4><div class="kv">
          <div><span>${t("dates")}</span><b class="num">${q(s.valid_from,s.valid_until,this.tz)}</b></div>
          <div><span>${t("hours")}</span><b class="num">${J(s,this.tz)}</b></div>
          <div><span>${t("source")}</span><b>${t(W[s.source]??"srcManual")} ${s.source_ref?i`<span class="num">${s.source_ref}</span>`:c}</b></div></div></section>
        ${s.credential==="pin"?i`<section class="sec"><h4><sw-icon name="mail" size="14"></sw-icon>${t("codeTitle")}</h4><div class="kv">
              <div><span>${t("codeState")}</span><b>${this.codeCell(s)}</b></div>
              ${s.person.number?i`<div><span>${t("sentTo")}</span><b class="num">${t("whatsapp")} ${s.person.number}</b></div>`:c}
              <div><span>${t("theCode")}</span><b style="color:var(--sw-text-3)"><sw-icon name="lock" size="14"></sw-icon> ${t("neverShown")}</b></div></div></section>`:c}
        ${this.cardBlock(s)}
        ${s.closure?.reference?i`<section class="sec"><h4><sw-icon name="info" size="14"></sw-icon>${t("gone_ref_label")}</h4><p style="margin:0" data-closure-reference>${s.closure.reference}</p></section>`:c}
        <section class="sec" data-grant-identity><access-identity-card compact contact-id=${s.person.contact_id} name=${this.name(s)} .tz=${this.tz} @changed=${()=>this.load()}></access-identity-card></section>
        ${this.timelineBlock(s)}
        ${y?c:this.rbLine(s)}
        ${this.historyBlock(s)}
        <div class="dfoot">${this.drawerActions(s,a,!!y,$)}</div>
      </div>
    </sw-drawer>`}howBlock(s,e){const a=[...s==="unknown"?["un_a1","un_a2","un_a3","un_a4"]:[],...s==="revoking"?e?["rv_missing1","rv_missing2"]:["rv_note1","rv_note2"]:[],"ladNote"];return i`<details class="more" data-how><summary><sw-icon name="info" size="14"></sw-icon>${t("moreWhy")}</summary><ul>${a.map(n=>i`<li>${t(n)}</li>`)}</ul></details>`}readbackBox(s,e,a){const n=e==="offline";return i`<div class="rb" data-readback=${e} data-tone=${n?"off":"warn"}>
      <span class="rb-mark" aria-hidden="true"><i></i></span>
      <div class="rb-t"><b>${t("rb_waitTitle")}</b><span>${n?t("rb_offline"):t("rb_waitText")}</span>${this.rbLine(s)}</div>
      ${a?this.readBtn(s,B(s)==="unknown",n):c}
    </div>`}cardBlock(s){if(s.credential!=="card")return c;const e=s.card_state??null,a=e==="attached"?"ok":e==="unknown"?"warn":e==="removed"?"off":"acc",n=s.state==="active"&&(e==="awaiting"||e==="unknown");return i`<section class="sec" data-card-block=${e??""}><h4><sw-icon name="lock" size="14"></sw-icon>${t("cardTitle")}</h4><div class="kv">
        <div><span>${t("codeState")}</span><b>${e?i`<span class="chip" data-tone=${a} data-card-state=${e}>${t(`card_${e}`)}</span>`:i`<span class="chip" data-tone="off">${t("code_hidden")}</span>`}</b></div>
        <div><span>${t("cardNo")}</span><b style="color:var(--sw-text-3)"><sw-icon name="lock" size="14"></sw-icon> ${t("cardNeverKept")}</b></div></div>
      ${n?i`<div class="row" style="margin-block-start:8px;flex-wrap:wrap;gap:8px">
          <input class="in" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="32" dir="ltr" aria-label=${t("cardNo")} placeholder=${t("cardNo")}
            data-card-no .value=${this.cardNo} @input=${o=>{this.cardNo=o.target.value}} style="flex:1 1 160px;min-inline-size:0" />
          <sw-button variant="primary" icon="check" data-action="card-save" ?disabled=${this.busy||!this.cardNo.trim()} @click=${()=>this.saveCard(s)}>${t("cardAttach")}</sw-button>
          <sw-button icon="lock" data-action="card-read" disabled title=${t("cardReadOff")}>${t("cardRead")}</sw-button></div>
          <p class="note" data-card-read-off><sw-icon name="info" size="14"></sw-icon>${t("cardReadOff")}</p>`:c}
    </section>`}async saveCard(s){const e=this.cardNo.trim();this.cardNo="",await this.act(()=>ze(s.id,s.revision,e),"cardAttachDone")}historyBlock(s){if(!this.data?.system_admin)return c;const e=this.history?.id===s.id?this.history:null,a=n=>n.by.kind==="page"?t("hist_page"):n.by.kind==="system"?t("hist_system"):n.by.name??"—";return i`<section class="sec" data-grant-history><h4><sw-icon name="history" size="14"></sw-icon>${t("histTitle")}</h4>
      ${e?e.error?i`<p class="err-line" role="alert">${e.error}</p>`:e.rows?e.rows.length?i`<ol class="tl" data-history>${e.rows.map(n=>i`<li data-history-action=${n.action}><time>${this.fmt(n.at)}</time><i data-tone=${n.decision==="denied"?"warn":"acc"}></i>
            <span>${K(`h_${n.action}`,"h_other")}${n.decision==="denied"?i` · <b>${t("hist_denied")}</b>`:c} · ${a(n)}${n.reason?i` · <small class="num">${n.reason}</small>`:c}</span></li>`)}</ol>`:i`<p class="note">${t("histEmpty")}</p>`:i`<sw-state-panel state="loading"></sw-state-panel>`:i`<sw-button size="sm" data-history-show @click=${()=>void this.loadHistory(s.id)}>${t("histShow")}</sw-button>`}
    </section>`}async loadHistory(s){this.history={id:s,rows:null,error:""};try{const e=(await Se(s)).history;this.history?.id===s&&(this.history={id:s,rows:e,error:""})}catch(e){this.history?.id===s&&(this.history={id:s,rows:null,error:S(e)})}}timelineBlock(s){const e=le(s);return e.length?i`<section class="sec"><h4><sw-icon name="clock" size="14"></sw-icon>${t("happened")}</h4><ol class="tl" data-timeline>${e.map(a=>i`<li><time>${this.fmt(a.at)}</time><i data-tone=${a.tone}></i><span>${t(a.key,a.key==="ev_revoking"?{reason:this.reasonText(a.vars?.reason??null)}:a.vars)}</span></li>`)}</ol></section>`:c}drawerActions(s,e,a=!1,n=!1){const o=[],d=this.name(s);return e.accept&&o.push(i`<sw-button variant="primary" icon="user" data-action="accept" ?disabled=${this.busy} @click=${()=>this.confirm({title:t("acceptQ"),body:i`<p>${t("acceptText")}</p>`,btn:t("a_accept"),run:()=>$s(s.person.contact_id),done:"acceptDone"})}>${t("a_accept")}</sw-button>`),e.approve&&o.push(i`<sw-button variant="primary" icon="check" data-action="approve" ?disabled=${this.busy} @click=${()=>this.openApprove(s)}>${s.pending_amendment?t("a_reviewWidening"):t("a_approve")}</sw-button>`),e.refuse&&o.push(i`<sw-button variant="danger" data-action="refuse" ?disabled=${this.busy} @click=${()=>this.confirm({title:t("refuseQ"),body:i`<p>${s.pending_amendment&&s.state!=="requested"?t("refuseWidenText"):t("refuseText")}</p>`,btn:t("a_refuse"),danger:!0,run:()=>bs(s.id,s.revision),done:"refuseDone"})}>${t("a_refuse")}</sw-button>`),e.retry&&o.push(i`<sw-button icon="refresh" data-action="retry" ?disabled=${this.busy||n} @click=${()=>this.act(()=>Te(s.id),"retryDone")}>${t("a_retry")}</sw-button>`),e.rotate&&o.push(i`<sw-button icon="refresh" data-action="rotate" ?disabled=${this.busy} @click=${()=>this.confirm({title:t("rotateQ"),body:i`<p>${t("rotateText",{n:s.person.number??"",left:Math.max(0,3-(s.code_sends??0))})}</p>`,btn:t("a_rotate"),run:()=>De(s.id,s.revision),done:"rotateDone"})}>${t("a_rotate")}</sw-button>`),e.readNow&&!a&&o.push(this.readBtn(s,!1,n)),o.push(i`<span class="sp"></span>`),e.gone&&o.push(i`<sw-button variant="danger" icon="user" data-action="gone" ?disabled=${this.busy} @click=${()=>this.openGone(s)}>${t("a_gone")}</sw-button>`),e.revoke&&o.push(i`<sw-button variant="danger" icon="lock" data-action="revoke" ?disabled=${this.busy} @click=${()=>this.confirm({title:t("revokeQ",{name:d}),body:i`<p>${t("revokeText")}</p>${this.doorChips(s)}`,btn:t("a_revoke"),danger:!0,run:()=>Ne(s.id),done:"revokeDone"})}>${t("a_revoke")}</sw-button>`),Object.values(e).some(Boolean)?i`${o}`:i`<span class="note">${t("noActions")}</span>`}openApprove(s){const e=s.pending_amendment,a=e?Object.entries(e.doors).flatMap(([d,r])=>r.map(w=>`${d}:${w}`)):s.doors.flatMap(d=>d.relays.map(r=>`${d.station_id}:${r}`));this.apDoors=new Set(a);const n=e?.valid_from??s.valid_from,o=e?.valid_until??s.valid_until;this.apFrom=j(n,this.tz),this.apUntil=ss(o,this.tz),this.apTold=!1,this.dlgError="",this.dialog={kind:"approve",id:s.id}}approveDialog(s){const e=s.pending_amendment,a=!!e&&s.state!=="requested",n=e?.valid_from??s.valid_from,o=e?.valid_until??s.valid_until,d=this.data?.rules,r=d?.max_days??14,w=de(n,o,this.apFrom,this.apUntil,this.tz,r),p=new Map((this.data?.grants??[]).flatMap(f=>f.doors).map(f=>[f.station_id,f.name])),$=e?Object.entries(e.doors).flatMap(([f,z])=>z.map(I=>({s:f,r:I,name:p.get(f)??f}))):s.doors.flatMap(f=>f.relays.map(z=>({s:f.station_id,r:z,name:f.name}))),y=new Set(s.doors.flatMap(f=>f.relays.map(z=>`${f.station_id}:${z}`))),u=this.apDoors.size,x=s.notice.find(f=>f.via==="page"),R=s.notice[0],C=!x&&!s.notice.some(f=>f.via==="approver"),V=u>0&&!w.error&&(!C||this.apTold)&&!this.busy,X=s.link?s.link.origin==="matched"?"ap_recordMatched":"ap_recordOurs":"ap_recordNew",cs={};for(const f of this.apDoors){const[z,I]=[f.slice(0,f.lastIndexOf(":")),Number(f.slice(f.lastIndexOf(":")+1))];(cs[z]??=[]).push(I)}const Is=[...new Set([...this.apDoors].map(f=>p.get(f.slice(0,f.lastIndexOf(":")))??""))].filter(Boolean).join(", "),Ls=()=>this.act(async()=>{await Re(s.id,{revision:s.revision,doors:cs,valid_from:w.valid_from,valid_until:w.valid_until,told:this.apTold||!C}),this.dialog=null},"ap_done"),Bs=w.error==="too_long"?t("ap_tooLong",{n:w.days,max:r}):w.error==="before"?t("ap_before"):w.error==="outside"?t("ap_outside"):t("ap_days",{n:w.days,max:r,tz:this.tz});return i`<sw-dialog open wide heading=${a?t("ap_widenTitle"):t("ap_title")} subheading=${t("ap_lead")} data-approve-dialog=${s.id} @close=${()=>this.dialog=null}>
      <div class="ap">
        <div class="stack">
          ${a?i`<div class="callout" data-tone="warn"><sw-icon name="plus" size="18"></sw-icon><div>${t("ap_widenCallout")}</div></div>`:c}
          <section class="sec"><h4><sw-icon name="user" size="14"></sw-icon>${t("ap_who")}</h4><div class="kv">
            <div><span>${this.name(s)}</span><b>${[s.company,t(s.category==="contractor"?"contractor":"visitor")].filter(Boolean).join(" · ")}</b></div>
            <div><span>${t("whatsapp")}</span><b class="num">${s.person.number??t("ap_noNumber")}</b></div>
            <div><span>${t("source")}</span><b>${t(W[s.source]??"srcManual")} ${s.source_ref??""}</b></div>
            <div><span>${t("ap_notice")}</span><b>${x?t("ap_noticePage",{v:x.version}):R?t("ap_noticeApprover",{v:R.version}):t("ap_noticeNone")}</b></div>
            <div><span>${t("ap_record")}</span><b>${t(X)}</b></div></div></section>
          <section class="sec"><h4><sw-icon name="door" size="14"></sw-icon>${t("ap_doors")} <span class="chip" data-tone="acc">${t("ap_doorsCount",{n:u,max:d?.max_doors??4})}</span></h4>
            <div class="dgrid">${$.map(({s:f,r:z,name:I})=>{const L=`${f}:${z}`;return i`<label class="cb"><input type="checkbox" data-approve-door=${L} .checked=${this.apDoors.has(L)} @change=${js=>{const Q=new Set(this.apDoors);js.target.checked?Q.add(L):Q.delete(L),this.apDoors=Q}} /><span><b>${I}</b><small>${t("doorN",{n:z})}${a&&!y.has(L)?` · ${t("dr_amend")}`:""}</small></span></label>`})}</div>
            <span class="note ${u?"":"e"}" style=${u?"":"color:var(--sw-danger-text);font-weight:600"}>${u?t("ap_onlyNarrow"):t("ap_pickOne")}</span></section>
          <section class="sec"><h4><sw-icon name="calendar" size="14"></sw-icon>${t("ap_window")}</h4>
            <div class="two"><div class="field"><label for="vf">${t("ap_from")}</label><input id="vf" class="in num" type="date" lang=${O()} .value=${this.apFrom} min=${j(n,this.tz)} max=${ss(o,this.tz)} @input=${f=>this.apFrom=f.target.value} /></div>
            <div class="field"><label for="vu">${t("ap_until")}</label><input id="vu" class="in num" type="date" lang=${O()} .value=${this.apUntil} min=${j(n,this.tz)} max=${ss(o,this.tz)} aria-invalid=${w.error?"true":"false"} @input=${f=>this.apUntil=f.target.value} /></div></div>
            <span class="note" style=${w.error?"color:var(--sw-danger-text);font-weight:600":""} data-window-hint>${Bs}</span></section>
          <section class="sec"><h4><sw-icon name="clock" size="14"></sw-icon>${t("ap_hours")}</h4><b class="num">${J({timing:e?.timing??s.timing,valid_from:n,valid_until:o},this.tz)}</b></section>
          ${C?i`<label class="cb"><input type="checkbox" data-approve-told .checked=${this.apTold} @change=${f=>this.apTold=f.target.checked} /><span>${t("ap_told")}</span></label>`:c}
        </div>
        <div class="stack">
          <div class="callout" data-tone="acc"><sw-icon name="shield" size="18"></sw-icon><div><b>${t("ap_nothingTitle")}</b>${t("ap_nothingText")}</div></div>
          <section class="sec"><h4><sw-icon name="mail" size="14"></sw-icon>${t("ap_msgTitle")}</h4>
            <div class="bubble" data-approve-message>${t("ap_msgBody",{doors:Is||"-",dates:w.error?"-":q(w.valid_from,w.valid_until,this.tz)})}</div>
            <p class="note"><sw-icon name="lock" size="14"></sw-icon>${t("ap_msgNote")}</p></section>
          <section class="sec"><h4><sw-icon name="refresh" size="14"></sw-icon>${t("ap_after")}</h4>
            <div class="flow"><div><b>1 · ${t("ap_f1")}</b>${t("ap_f1t")}</div><div><b>2 · ${t("ap_f2")}</b>${t("ap_f2t")}</div><div><b>3 · ${t("ap_f3")}</b>${t("ap_f3t")}</div><div><b>4 · ${t("ap_f4")}</b><span class="num">${s.code_due_at?this.fmt(s.code_due_at):t("r_codeAtValue",{h:d?.code_hour??18})}</span></div></div></section>
        </div>
      </div>
      ${this.dlgError?i`<p class="err-line" role="alert">${this.dlgError}</p>`:c}
      <div class="dfoot"><sw-button variant="danger" ?disabled=${this.busy} @click=${()=>this.confirm({title:t("refuseQ"),body:i`<p>${a?t("refuseWidenText"):t("refuseText")}</p>`,btn:a?t("ap_refuseWiden"):t("a_refuse"),danger:!0,run:()=>bs(s.id,s.revision),done:"refuseDone"})}>${a?t("ap_refuseWiden"):t("a_refuse")}</sw-button>
        <span class="sp"></span><sw-button variant="ghost" @click=${()=>this.dialog=null}>${t("back")}</sw-button>
        <sw-button variant="primary" icon="check" data-approve-ok ?disabled=${!V} @click=${Ls}>${t("ap_ok")}</sw-button></div>
    </sw-dialog>`}openGone(s){this.goneChecks=[!1,!1,!1],this.goneRef="",this.word="",this.dlgError="",this.dialog={kind:"gone",id:s.id}}goneDialog(s){const e=hs("access_gone"),a=ce(this.goneRef),n=this.goneChecks.every(Boolean)&&a&&us("access_gone",this.word)&&!this.busy,o=["gone_ch1","gone_ch2","gone_ch3"];return i`<sw-dialog open wide heading=${t("gone_title")} subheading=${`${this.name(s)} · ${t("gone_sub")}`} data-gone-dialog=${s.id} @close=${()=>this.dialog=null}>
      <div class="stack">
        <div class="ku"><div><h4><sw-icon name="check" size="14"></sw-icon>${t("gone_knows")}</h4><ul><li>${t("gone_k1")}</li>${s.link?.origin==="created_from_arx"?i`<li>${t("gone_k2")}</li>`:c}</ul></div>
          <div class="unk"><h4><sw-icon name="help" size="14"></sw-icon>${t("gone_cannot")}</h4><ul><li>${t("gone_c1")}</li><li>${t("gone_c2")}</li></ul></div></div>
        <div class="callout" data-tone="acc"><sw-icon name="info" size="18"></sw-icon><div><b>${t("gone_does")}</b><ul><li>${t("gone_d1")}</li><li>${t("gone_d2")}</li><li>${t("gone_d3")}</li><li>${t("gone_d4")}</li></ul></div></div>
        <section class="sec"><h4><sw-icon name="check" size="14"></sw-icon>${t("gone_checked")}</h4>${o.map((d,r)=>i`<label class="cb"><input type="checkbox" data-gone-check=${r} .checked=${this.goneChecks[r]} @change=${w=>{const p=[...this.goneChecks];p[r]=w.target.checked,this.goneChecks=p}} /><span>${t(d)}</span></label>`)}</section>
        <div class="field"><label for="gref">${t("gone_ref")}</label><input id="gref" class="in" maxlength="128" placeholder=${t("gone_refPh")} .value=${this.goneRef} aria-invalid=${this.goneRef&&!a?"true":"false"} @input=${d=>this.goneRef=d.target.value} /><span class="hint ${this.goneRef&&!a?"e":""}">${t("gone_refHint")}</span></div>
        <div class="field"><label for="gw">${t("typeWord",{w:e})}</label><input id="gw" class="in" autocomplete="off" .value=${this.word} @input=${d=>this.word=d.target.value} /></div>
      </div>
      ${this.dlgError?i`<p class="err-line" role="alert">${this.dlgError}</p>`:c}
      <div class="dfoot"><span class="sp"></span><sw-button variant="ghost" @click=${()=>this.dialog=null}>${t("back")}</sw-button>
        <sw-button variant="danger" data-gone-ok ?disabled=${!n} @click=${()=>this.act(async()=>{await Ae(s.id,{reference:this.goneRef,confirm:this.word.trim(),checks:this.goneChecks}),this.dialog=null},"gone_done")}>${t("gone_ok")}</sw-button></div>
    </sw-dialog>`}confirmDialog(s){const e=!this.busy&&(!s.word||us(s.word,this.word));return i`<sw-dialog open heading=${s.title} data-confirm-dialog @close=${()=>this.dialog=null}>
      <div class="stack">${s.body}${s.word?i`<div class="field"><label for="cw">${t("typeWord",{w:hs(s.word)})}</label><input id="cw" class="in" autocomplete="off" .value=${this.word} @input=${a=>this.word=a.target.value} /></div>`:c}</div>
      ${this.dlgError?i`<p class="err-line" role="alert">${this.dlgError}</p>`:c}
      <div class="dfoot"><span class="sp"></span><sw-button variant="ghost" @click=${()=>this.dialog=null}>${t("back")}</sw-button>
        <sw-button variant=${s.danger?"danger":"primary"} data-confirm-ok ?disabled=${!e} @click=${async()=>{await this.act(s.run,s.done,void 0,s.doneText)&&(this.dialog=null)}}>${s.btn}</sw-button></div>
    </sw-dialog>`}openDigest(){this.loadDigest(),this.dialog={kind:"digest"}}digestDialog(){const s=this.digest,e=(a,n,o)=>i`<div class="mini"><b data-tone=${c}>${a}</b><span>${t(n)}</span></div>`;return i`<sw-dialog open wide heading=${t("dg_title")} subheading=${s?t("dg_period",{from:this.fmt(s.period.from),until:this.fmt(s.period.until)}):""} data-digest-dialog @close=${()=>this.dialog=null}>
      ${s?i`<div class="ap">
            <div class="stack">
              <section class="sec"><h4><sw-icon name="layers" size="14"></sw-icon>${t("dg_numbers")}</h4><div class="minis">
                ${e(s.counts.requests,"c_requests")}${e(s.counts.approved,"c_approved")}${e(s.counts.refused,"c_refused")}
                ${e(s.counts.ended_or_revoked,"c_ended")}${e(s.counts.closed_no_person,"c_noPerson")}${e(s.counts.confirmed_gone,"c_gone")}</div></section>
              <section class="sec"><h4><sw-icon name="warning" size="14"></sw-icon>${t("dg_gaps")}</h4>
                ${s.gaps.length?i`<div class="gaps">${s.gaps.map(a=>{const n=a.kind==="name"?"gap_name":a.kind==="scope"?"gap_scope":"gap_idle",o=a.kind==="name"?"gap_nameText":a.kind==="scope"?"gap_scopeText":"gap_idleText";return i`<div class="gap" data-gap=${a.kind} data-tone=${a.kind==="idle_person"?"acc":"warn"}><span class="ik"><sw-icon name=${a.kind==="idle_person"?"user":"warning"} size="15"></sw-icon></span>
                        <div><b>${t(n,{name:a.name??"—"})}</b>${t(o)}${a.since?` ${t("gap_since",{t:this.fmt(a.since)})}`:""}
                        ${a.kind==="scope"&&a.grant_id?i`<div class="row" style="margin-block-start:6px"><sw-button size="sm" ?disabled=${this.reading===a.grant_id||Y(this.data)} @click=${()=>this.readBack(a.grant_id)}>${this.reading===a.grant_id?t("rb_reading"):t("readBack")}</sw-button></div>`:c}</div></div>`})}</div>`:i`<p class="note">${t("dg_noGaps")}</p>`}</section>
            </div>
            <div class="stack">
              <section class="sec"><h4><sw-icon name="bell" size="14"></sw-icon>${t("dg_slow")}</h4>${s.slow_revokes.length?i`<div class="kv">${s.slow_revokes.map(a=>i`<div><span>${a.name??"—"}</span><b><span class="chip" data-tone=${a.open?"err":"off"}>${a.open?t("slowOpen",{d:Z(a.minutes,E())}):Z(a.minutes,E())}</span></b></div>`)}</div>`:i`<p class="note">${t("dg_noSlow")}</p>`}</section>
              <section class="sec"><h4><sw-icon name="users" size="14"></sw-icon>${t("dg_who")}</h4>${s.approvers.length?i`<div class="kv">${s.approvers.map(a=>i`<div><span>${a.name??"—"}</span><b class="num">${a.count}</b></div>`)}</div>`:i`<p class="note">${t("dg_noSlow")}</p>`}</section>
              <section class="sec"><h4><sw-icon name="mail" size="14"></sw-icon>${t("dg_codes")}</h4><div class="kv">
                <div><span>${t("codesSent")}</span><b class="num">${s.counts.codes_sent}</b></div><div><span>${t("codesReplaced")}</span><b class="num">${s.counts.codes_replaced}</b></div>
                <div><span>${t("codesNot")}</span><b class="num">${s.counts.codes_not_delivered}</b></div></div></section>
            </div>
          </div>
          <p class="note" style="margin-block-start:12px"><sw-icon name="info" size="14"></sw-icon>${t("dg_foot")}</p>`:i`<sw-state-panel state="loading"></sw-state-panel>`}
    </sw-dialog>`}openRequest(){this.dialog={kind:"request",noPerm:!this.data?.may_request||!this.data?.enabled}}requestDialog(s){const e=new Set((this.data?.grants??[]).filter(a=>["requested","approved","provisioning","active","unknown"].includes(a.state)).map(a=>a.person.contact_id));return i`<access-request-dialog .tz=${this.tz} .codeHour=${this.data?.rules.code_hour??18} .live=${e} ?noPerm=${s} ?cards=${this.data?.rules.cards==="on"} @close=${()=>this.dialog=null}
      @done=${a=>{this.dialog=null,this.toastText(a.detail.text),this.load().then(()=>a.detail.grant?this.openDrawer(a.detail.grant.id):void 0)}}></access-request-dialog>`}openDrift(){this.loadDrift(),this.dlgError="",this.dialog={kind:"drift"}}driftChecked(s){const e=[s.scope_checked_at,s.name_checked_at].filter(a=>!!a).sort().at(-1);return e?t("drChecked",{t:this.fmt(e)}):t("drNotChecked")}driftActions(s){const e=[],a=s.diffs.map(o=>o.kind),n=s.grant;return s.can.push_name&&a.includes("name")&&e.push(i`<sw-button size="sm" icon="refresh" data-drift-push=${s.link_id} ?disabled=${this.busy} @click=${()=>this.act(()=>Ce(s.link_id),"act_pushDone")}>${t("act_pushBtn")}</sw-button>`),n&&s.can.read_now&&a.some(o=>qt.includes(o))&&e.push(i`<sw-button size="sm" icon="refresh" data-drift-read=${n.id} ?disabled=${this.busy} @click=${()=>this.act(()=>gs(n.id),"readDone")}>${t("readBack")}</sw-button>`),n&&this.data?.grants.some(o=>o.id===n.id)&&e.push(i`<sw-button size="sm" variant="ghost" data-drift-open=${n.id} @click=${()=>{this.dialog=null,this.openDrawer(n.id)}}>${t("drOpen")}</sw-button>`),e}driftRow(s,e=!1){const a=s.diffs[0];return i`<div class="drow" role="listitem" data-drift-row=${s.contact_id} data-drift-kinds=${s.diffs.map(n=>n.kind).join(" ")} data-tone=${As[a.kind]}>
      <span class="ik" aria-hidden="true"><sw-icon name=${Ct[a.kind]} size="15"></sw-icon></span>
      <div class="dmain">
        <div class="dname"><b>${s.name??"—"}</b>${s.company?i`<small>${s.company}</small>`:c}${e?c:i`<span class="chip" data-tone="off">${t(`rec_${s.origin}`)}</span>`}</div>
        ${e?i`<span class="dk">${s.diffs.map(n=>t(`dk_${n.kind}`)).join(" · ")}</span>`:i`<ul class="dlist">${s.diffs.map(n=>i`<li data-drift-kind=${n.kind}><span class="chip" data-tone=${As[n.kind]}>${t(`dk_${n.kind}`)}</span><span>${t(`dkt_${n.kind}`)}${n.kind==="name"&&s.name?i` <b>${t("drArxName",{name:s.name})}</b>`:c}${n.kind==="idle_person"&&n.since?` ${t("gap_since",{t:this.fmt(n.since)})}`:""}</span></li>`)}</ul>
              ${s.grant?.doors.length?i`<span class="chips">${s.grant.doors.map(n=>i`<span class="chip door" data-tone="acc"><sw-icon name="door" size="13"></sw-icon>${n.name}</span>`)}</span>`:c}
              <small class="dwhen">${this.driftChecked(s)}</small>`}
      </div>
      ${e?c:i`<div class="dact">${this.driftActions(s)}</div>`}
    </div>`}driftDialog(){const s=this.drift;return i`<sw-dialog open wide heading=${t("drTitle")} subheading=${t("drLead")} data-drift-dialog @close=${()=>this.dialog=null}>
      ${s?i`<div class="stack">
            <div class="row"><span class="chip" data-tone="ok" data-drift-insync>${t("drInSync",{n:s.in_sync})}</span>${s.name_sync==="auto"?i`<span class="chip" data-tone="acc">${t("drAuto")}</span>`:c}</div>
            ${s.rows.length?i`<div class="drows" role="list">${s.rows.map(e=>this.driftRow(e))}</div>`:i`<sw-state-panel icon="layers" state="empty" heading=${t("drNone")} hint=${t("drNoneText")}></sw-state-panel>`}
          </div>`:i`<sw-state-panel state="loading"></sw-state-panel>`}
      ${this.dlgError?i`<p class="err-line" role="alert">${this.dlgError}</p>`:c}
      <div class="dfoot"><span class="sp"></span><sw-button variant="ghost" @click=${()=>this.dialog=null}>${t("back")}</sw-button></div>
    </sw-dialog>`}driftPanel(){const s=this.drift;return!s||!s.enabled?c:i`<section class="panel" data-drift-panel>
      <h3><sw-icon name="layers" size="18"></sw-icon>${t("drTitle")}<span class="sp"></span><span class="chip num" data-tone=${s.rows.length?"warn":"ok"}>${s.rows.length}</span></h3>
      ${s.rows.length?i`<div class="drows" role="list">${s.rows.slice(0,3).map(e=>this.driftRow(e,!0))}</div>`:i`<p class="lead">${t("drNoneText")}</p>`}
      <div class="row"><sw-button size="sm" data-open-drift @click=${()=>this.openDrift()}>${t("drAll",{n:s.rows.length})}</sw-button><span class="note">${t("drInSync",{n:s.in_sync})}</span></div>
    </section>`}openSettings(){const s=this.data?.screen;s&&(this.draft={...s},this.dlgError="",this.dialog={kind:"settings"},this.loadReadiness())}loadReadiness(){this.readiness=null,qe().then(s=>this.readiness=s).catch(()=>this.readiness="error")}activationSection(){const s=!!this.data?.enabled,e=this.readiness,a={ok:"ok",blocked:"err",unknown:"warn"},n=o=>this.act(async()=>{await Ie(o),await this.load(),this.loadReadiness()},"set_saved");return i`<section class="sec" data-sec="activation"><h4>${t("act_title")}</h4>
      <div class="seg" role="group" data-external-switch><button type="button" aria-pressed=${String(!s)} data-setting="external_grants:off" ?disabled=${this.busy} @click=${()=>s&&void n("off")}>${t("act_off")}</button>
        <button type="button" aria-pressed=${String(s)} data-setting="external_grants:on" ?disabled=${this.busy} @click=${()=>!s&&void n("on")}>${t("act_on")}</button></div>
      <h4>${t("rd_title")}</h4>
      ${e===null?i`<p class="note" data-readiness="loading">${t("rd_loading")}</p>`:e==="error"?i`<p class="err-line" data-readiness="error">${t("rd_error")}</p>`:i`<p class="note" data-readiness=${e.ready?"ready":"missing"}><b>${e.summary}</b></p>
          <ul class="rd" role="list">${e.lines.map(o=>i`<li data-rd=${o.key} data-rd-state=${o.state}><span class="chip" data-tone=${a[o.state]}>${t(`rd_${o.state}`)}</span>
            <span><b>${o.label}</b> · ${o.text}</span></li>`)}</ul>`}
    </section>`}settingsDialog(){const s=this.draft,e=(o,d)=>i`<div class="seg" role="group">${d.map(([r,w])=>i`<button type="button" aria-pressed=${String(s[o]===r)} data-setting=${`${String(o)}:${String(r)}`} @click=${()=>this.draft={...s,[o]:r}}>${t(w)}</button>`)}</div>`,a=pe.map(o=>({id:String(o),label:t(`day${o}`)})),n=Array.from({length:24},(o,d)=>({id:String(d),label:`${String(d).padStart(2,"0")}:00`}));return i`<sw-dialog open heading=${t("set_title")} subheading=${t("set_sub")} data-settings-dialog @close=${()=>this.dialog=null}>
      <div class="stack">
        ${this.activationSection()}
        <section class="sec"><h4>${t("set_placement")}</h4>${e("placement",[["access","pl_access"],["tickets","pl_tickets"],["both","pl_both"]])}</section>
        <section class="sec"><h4>${t("set_digest")}</h4>
          <div class="field"><label>${t("set_channel")}</label>${e("digest_channel",[["app","ch_app"],["app_whatsapp","ch_app_whatsapp"]])}</div>
          <div class="two"><sw-dropdown tall label=${t("set_day")} .items=${a} .value=${String(s.digest_day)} @change=${o=>this.draft={...s,digest_day:Number(o.detail.id)}}></sw-dropdown>
          <sw-dropdown tall label=${t("set_hour")} .items=${n} .value=${String(s.digest_hour)} @change=${o=>this.draft={...s,digest_hour:Number(o.detail.id)}}></sw-dropdown></div></section>
        <section class="sec"><h4>${t("set_name")}</h4>${e("name_sync",[["manual","ns_manual"],["auto","ns_auto"]])}</section>
        <section class="sec"><h4>${t("set_arrival")}</h4>${e("arrival_after_grant",[["off","ar_off"],["on","ar_on"]])}</section>
        <section class="sec" data-visits-section><h4>${t("set_visits")}</h4><wiskey-visits-panel></wiskey-visits-panel></section>
      </div>
      ${this.dlgError?i`<p class="err-line" role="alert">${this.dlgError}</p>`:c}
      <div class="dfoot"><span class="sp"></span><sw-button variant="ghost" @click=${()=>this.dialog=null}>${t("back")}</sw-button>
        <sw-button variant="primary" data-settings-save ?disabled=${this.busy} @click=${()=>this.act(async()=>{await Oe(s),this.dialog=null,Zs({"access.external.placement":s.placement})},"set_saved")}>${t("set_save")}</sw-button></div>
    </sw-dialog>`}dialogs(){const s=this.dialog;if(!s)return c;if(s.kind==="confirm")return this.confirmDialog(s.c);if(s.kind==="digest")return this.digestDialog();if(s.kind==="drift")return this.driftDialog();if(s.kind==="settings")return this.draft?this.settingsDialog():c;if(s.kind==="request")return this.requestDialog(s.noPerm);const e=this.data?.grants.find(a=>a.id===s.id)??(this.detail?.id===s.id?this.detail:null);return e?s.kind==="approve"?this.approveDialog(e):s.kind==="gone"?this.goneDialog(e):c:c}pendingPanel(){const s=this.pending;return!s||!s.pending.length?c:i`<section class="tcard" data-pending-panel>
      <div class="filters"><b>${_("pendTitle")}</b><span class="chip" data-tone="acc" data-pending-count>${s.pending.length}</span></div>
      <div role="list">${Me(s.pending).map(e=>i`<div role="listitem" class="pd-r" data-pending=${e.contact_id}>
        <span class="pn"><b>${e.name||"—"}</b><small>${[e.vendor,Ue(e)].filter(Boolean).join(" · ")}</small></span>
        <span class="pd-w"><span class="num">${Ke(e)}</span><span class="chip" data-tone=${Fe(e)} data-left>${He(e)}</span></span>
        <span class="pd-a">
          <sw-button size="sm" variant="primary" data-pending-approve ?disabled=${this.busy} @click=${()=>this.confirm({title:_("approveQ",{name:e.name}),body:i`<p>${_("approveText")}</p>`,btn:_("approve"),run:()=>$s(e.contact_id),done:"failed",doneText:_("approveDone")})}>${_("approve")}</sw-button>
          <sw-button size="sm" variant="danger" data-pending-reject ?disabled=${this.busy} @click=${()=>this.confirm({title:_("rejectQ",{name:e.name}),body:i`<p>${_("rejectText")}</p>`,btn:_("reject"),danger:!0,run:()=>Ee(e.contact_id),done:"failed",doneText:_("rejectDone")})}>${_("reject")}</sw-button>
        </span></div>`)}</div>
    </section>`}side(){const s=this.digest,e=this.data?.rules,a=this.data?.screen,n=!this.data?.enabled,o=(d,r,w)=>i`<div class="mini"><b data-tone=${w??c}>${d}</b><span>${t(r)}</span></div>`;return i`<aside class="side">
      ${n||!s?c:i`<section class="panel" data-digest-panel>
            <h3><sw-icon name="calendar" size="18"></sw-icon>${t("weekTitle")}<span class="sp"></span><span class="chip num">${q(s.period.from,s.period.until,this.tz)}</span></h3>
            <div class="minis">${o(s.counts.approved,"d_approved")}${o(s.counts.refused,"d_refused")}${o(s.counts.ended_or_revoked,"d_ended")}
              ${o(s.slow_revokes.length,"d_slow","err")}${o(s.counts.codes_not_delivered,"d_notDelivered","warn")}${o(s.gaps.length,"d_gaps","warn")}</div>
            <p class="lead">${t("weekLead",{day:t(`day${a?.digest_day??0}`),hour:`${String(a?.digest_hour??8).padStart(2,"0")}:00`})}</p>
            <div><sw-button size="sm" data-open-digest @click=${()=>this.openDigest()}>${t("fullDigest")}</sw-button></div>
          </section>`}
      ${n?c:this.driftPanel()}
      <section class="panel" data-rules-panel>
        <h3><sw-icon name="filter" size="18"></sw-icon>${t("rulesTitle")}</h3>
        <div class="kv">
          <div><span>${t("r_feature")}</span><b>${n?i`<span class="chip" data-tone="off"><sw-icon name="lock" size="13"></sw-icon>${t("r_off")}</span>`:i`<span class="chip" data-tone="ok">${t("r_on")}</span>`}</b></div>
          ${e?i`<div><span>${t("r_longest")}</span><b>${t("r_days",{n:e.max_days})}</b></div>
                <div><span>${t("r_doorsPerGrant")}</span><b>${t("r_upTo",{n:e.max_doors})}</b></div>
                <div><span>${t("r_codeAt")}</span><b class="num">${t("r_codeAtValue",{h:e.code_hour})}</b></div>
                <div><span>${t("r_phoneWithin")}</span><b>${t("r_days",{n:e.phone_fresh_days})}</b></div>
                <div><span>${t("r_local")}</span><b>${e.local_approvers==="on"?t("r_yes"):t("r_no")}</b></div>`:c}
        </div>
        <div class="lockrow" data-extended-identity="locked"><sw-icon name="lock" size="18"></sw-icon><div><b>${t("extTitle")}</b>${t("extText")}</div><input type="checkbox" disabled aria-label=${t("extTitle")} /></div>
      </section>
    </aside>`}statusBanners(s){const e=s.wiskey,a=Y(s),n=o=>o?this.fmt(o,j(o,this.tz)!==j(new Date().toISOString(),this.tz)):"";return i`${a?i`<div class="banner" data-tone="warn" data-banner="wiskey-offline" role="status"><sw-icon name="offline" size="18"></sw-icon>
          <span><b>${e?.as_of&&e.has_copy?t("wk_offTitle",{t:n(e.as_of)}):t("wk_offTitleNoTime")}</b> ${t("wk_offText")}</span><span class="sp"></span>
          <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>${t("checkAgain")}</sw-button></div>`:c}
      ${this.stale?i`<div class="banner" data-tone="warn" data-banner="stale" role="alert"><sw-icon name="warning" size="18"></sw-icon>
            <span><b>${t("stale_title",{t:n(new Date(this.loadedAt).toISOString())})}</b> ${t("stale_text")}</span><span class="sp"></span>
            <sw-button size="sm" icon="refresh" @click=${()=>this.load()}>${t("retry")}</sw-button></div>`:c}`}list(s){const e=!this.data?.enabled,a=he(s,this.query),n=[{id:"",label:t("allDoors")},...ue(s).map(r=>({id:r.id,label:r.name}))],o=[{id:"",label:t("allSources")},{id:"ticket",label:t("srcTicket")},{id:"rfq_order",label:t("srcRfq")},{id:"manual",label:t("srcManual")}];let d;if(a.length)d=i`<div class="gl-h" aria-hidden="true"><span>${t("colPerson")}</span><span>${t("colDoors")}</span><span>${t("colWindow")}</span><span>${t("colState")}</span><span>${t("colCode")}</span><span></span></div>
        <div class="gl-body" role="list">${a.map(r=>i`<button type="button" role="listitem" class="gl-r" data-grant=${r.id} data-ui-state=${B(r)} aria-current=${String(this.sel===r.id)} @click=${()=>this.openDrawer(r.id)}>
          <span class="pn"><b>${this.name(r)}</b><small>${[r.company,t(r.category==="contractor"?"contractor":"visitor")].filter(Boolean).join(" · ")}</small><span class="sr">${t(W[r.source]??"srcManual")}${r.source_ref?i` <span class="num">${r.source_ref}</span>`:c}</span></span>
          <span class="doors">${this.doorChips(r)}</span>
          <span class="win"><span class="num">${q(r.valid_from,r.valid_until,this.tz)}</span><small class="num">${J(r,this.tz)}</small></span>
          <span class="st"><span class="row">${this.badge(r)}${r.pending_amendment?i`<span class="chip" data-tone="acc">${t("widening")}</span>`:c}${r.code_mode==="single_entry"?i`<span class="chip" data-tone="acc" data-once>${t("once_chip")}</span>`:c}</span><span class="why">${K(fs(r),"why_pending")}</span></span>
          <span class="code">${r.credential==="pin"?this.codeCell(r):i`<span class="chip" data-tone="off">${t("code_not_needed")}</span>`}</span>
          <span class="chev"><sw-icon name="chevronBack" size="16"></sw-icon></span></button>`)}</div>`;else{const r=!s.length,[w,p]=e&&r?["emptyOffTitle","emptyOffText"]:r?["emptyTitle","emptyText"]:["noMatchTitle","noMatchText"],$=r&&!e&&!!this.data?.may_request;d=i`<div class="gl-body" style="padding:28px 16px" data-external-empty=${e&&r?"off":r?"empty":"filter"}><sw-state-panel icon="link" state="empty" heading=${t(w)} hint=${t(p)}
        actionLabel=${r?$?l("newBtn"):"":t("showAllOpen")} @action=${()=>$?this.openRequest():this.query={filter:"live",q:"",station:"",source:""}}></sw-state-panel></div>`}return i`<div class="tcard grants" data-grants-card>
      <div class="filters">
        <input class="in" type="search" aria-label=${t("search")} placeholder=${t("search")} .value=${this.query.q} @input=${r=>this.query={...this.query,q:r.target.value}} />
        <sw-dropdown tall .items=${n} .value=${this.query.station} label=${t("colDoors")} @change=${r=>this.query={...this.query,station:r.detail.id}}></sw-dropdown>
        <sw-dropdown tall .items=${o} .value=${this.query.source} label=${t("source")} @change=${r=>this.query={...this.query,source:r.detail.id}}></sw-dropdown>
        <span class="chip" data-tone="acc" data-shown>${t("shown",{n:a.length})}</span>
      </div>
      ${d}
      <div class="legend"><span><sw-icon name="lock" size="14"></sw-icon>${t("legendCode")}</span><span><sw-icon name="help" size="14"></sw-icon>${t("legendVerified")}</span></div>
    </div>`}render(){const s=this.data;if(!s&&this.error)return i`<sw-state-panel state="error" heading=${t("loadError")} hint=${this.error} actionLabel=${t("retry")} @action=${()=>this.load()}></sw-state-panel>`;if(!s)return i`<sw-state-panel state="loading"></sw-state-panel>`;const e=s.grants,a=me(e),n=e.filter(d=>B(d)==="revoking"),o=!s.enabled;return i`
      <div class="top lead-head">
        <div><h1>${t("title")}</h1><p class="sub">${t("sub")}</p></div>
        <span class="sp"></span>
        ${s.may_request&&!o?i`<sw-button variant="primary" icon="plus" data-open-request @click=${()=>this.openRequest()}>${l("newBtn")}</sw-button>`:c}
        <sw-button icon="download" data-export-csv ?disabled=${this.exporting||!e.length} @click=${()=>void this.exportCsv()}>${t("exportCsv")}</sw-button>
        ${s.system_admin?i`<sw-button icon="system" data-open-settings @click=${()=>this.openSettings()}>${t("settings")}</sw-button>
              <sw-button variant="danger" icon="lock" data-revoke-all ?disabled=${o||!e.some(d=>["requested","approved","provisioning","active","unknown"].includes(d.state))}
                @click=${()=>this.confirm({title:t("revokeAllQ"),body:i`<p>${t("revokeAllText")}</p>`,btn:t("revokeAll"),danger:!0,word:"access_revoke_all",run:()=>Pe(this.word.trim()),done:"revokeAllDone"})}>${t("revokeAll")}</sw-button>`:c}
      </div>
      ${o?i`<div class="banner" data-tone="off" data-banner="off"><sw-icon name="lock" size="18"></sw-icon><span><b>${t("offTitle")}</b> ${t("offText")}</span></div>`:c}
      ${n.length?i`<div class="banner" data-tone="err" data-banner="revoking"><sw-icon name="bell" size="18"></sw-icon><span><b>${t("revokingBanner",{n:n.length})}</b> · ${t("revokingBannerText")}</span><span class="sp"></span><sw-button size="sm" @click=${()=>this.openDrawer(n[0].id)}>${t("open")}</sw-button></div>`:c}
      ${this.statusBanners(s)}
      <div class="cols">
        <div class="main">
          <div class="kpis" role="group" aria-label=${t("filterLabel")}>${we.map(d=>i`<button type="button" class="kpi" data-kpi=${d} data-tone=${At[d]} aria-pressed=${String(this.query.filter===d)} @click=${()=>this.query={...this.query,filter:this.query.filter===d?"live":d}}><span class="dot" aria-hidden="true"></span><div><b>${a[d]}</b><span>${t(Nt[d])}</span></div></button>`)}</div>
          ${this.list(e)}
          ${this.pendingPanel()}
        </div>
        ${this.side()}
      </div>
      ${this.dialog?c:this.drawer()}
      ${this.dialogs()}
      <div class="toasts" aria-live="polite" ${Js()}>${this.toasts.map(d=>i`<div class="toast" data-toast><sw-icon name="check" size="16"></sw-icon>${d.text}</div>`)}</div>
    `}};v.styles=[os,Ge,se,as`
      :host { display: flex; flex-direction: column; gap: 14px; padding: 14px var(--sw-page-pad) 32px; max-inline-size: var(--sw-content-max); inline-size: 100%; box-sizing: border-box;
        /* SHAREDUI-295: every button of the screen, its drawer and dialogs is a 44 px target (the system-access screens do the same) */
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px)); --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px)); }
      .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; color: var(--sw-heading); }
      .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
      .top .sp { flex: 1; }
      .banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--cs); color: var(--ct); font-weight: var(--sw-fw-medium); flex-wrap: wrap; }
      .banner b { font-weight: var(--sw-fw-bold); }
      .banner .sp { flex: 1; }
      .cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
      .main, .side { display: grid; gap: 14px; min-inline-size: 0; }
      .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
      .kpi { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: var(--sw-r-md); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); cursor: pointer; text-align: start; font: inherit; color: inherit; min-inline-size: 0; min-block-size: var(--sw-touch-desktop); }
      .kpi .dot { inline-size: 11px; block-size: 11px; border-radius: 50%; background: var(--c); flex: none; }
      .kpi b { display: block; font-size: var(--sw-fs-2xl); line-height: 1.05; color: var(--sw-heading); font-variant-numeric: tabular-nums; }
      .kpi span { font-size: var(--sw-fs-sm); color: var(--sw-text-2); line-height: 1.25; display: block; }
      .kpi[aria-pressed='true'] { outline: 2px solid var(--sw-accent); outline-offset: -2px; }
      .kpi:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
      .tcard { border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); overflow: hidden; min-inline-size: 0; }
      .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 12px 14px; border-block-end: 1px solid var(--sw-border-strong); }
      .filters .in { flex: 1 1 200px; inline-size: auto; }
      .gl-h, .gl-r { display: grid; grid-template-columns: minmax(170px, 1.3fr) minmax(140px, 1fr) 100px minmax(200px, 2fr) 130px 16px; gap: 12px; align-items: start; padding: 10px 16px; }
      .gl-h { font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: var(--sw-fw-semibold); background: var(--sw-surface-2); border-block-end: 1px solid var(--sw-border-strong); }
      .gl-r { border: 0; border-block-end: 1px solid var(--sw-border); background: transparent; inline-size: 100%; text-align: start; color: inherit; cursor: pointer; font: inherit; }
      .gl-r:last-child { border-block-end: 0; }
      /* POLISH4-WP8: the row wash only on a fine pointer (it stuck after a tap on a tablet); a row gives on pointer-down */
      @media (hover: hover) and (pointer: fine) { .gl-r:hover { background: var(--sw-hover-wash); } }
      .gl-r { transition: background-color var(--sw-t-hover) var(--sw-ease-color); }
      .gl-r:active { background: var(--sw-hover-wash); }
      .kpi { transition: transform var(--sw-t-press) var(--sw-ease); }
      .kpi:active { transform: scale(var(--sw-press-scale)); }
      @media (prefers-reduced-motion: reduce) { .gl-r, .kpi { transition-duration: 0ms; } .kpi:active { transform: none; } }
      .gl-r[aria-current='true'] { background: var(--sw-accent-soft); }
      .gl-r:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: -2px; }
      .pn b { display: block; color: var(--sw-heading); font-weight: var(--sw-fw-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pn small, .win small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pn .sr { display: block; font-size: var(--sw-fs-xs); color: var(--sw-text-2); margin-block-start: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .st { display: grid; gap: 5px; min-inline-size: 0; }
      .st .why { font-size: var(--sw-fs-sm); color: var(--sw-text-2); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .code { display: grid; gap: 4px; justify-items: start; min-inline-size: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .chev { color: var(--sw-text-3); align-self: center; }
      /* SHAREDUI-295: the read-back wait - an indeterminate mark (still under reduced motion), never a number */
      .rb { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px; border-radius: var(--sw-r-md); background: var(--cs); }
      .rb-mark { inline-size: 28px; block-size: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-surface-solid); }
      .rb-mark i { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c); animation: rbpulse 1.8s ease-in-out infinite; }
      .rb[data-readback='offline'] .rb-mark i { animation: none; }
      @keyframes rbpulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.7); } }
      @media (prefers-reduced-motion: reduce) { .rb-mark i { animation: none; } }
      .rb-t { display: grid; gap: 2px; min-inline-size: 0; font-size: var(--sw-fs-sm); color: var(--sw-text); }
      .rb-t b { color: var(--sw-heading); }
      .rb-line { display: flex; gap: 6px; align-items: center; margin: 4px 0 0; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-text); }
      .rb-line[data-tone='err'] { color: var(--x-err-t); }
      @media (max-width: 600px) { .rb { grid-template-columns: auto minmax(0, 1fr); } .rb > sw-button { grid-column: 1 / -1; } }
      .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; padding: 10px 16px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); border-block-start: 1px solid var(--sw-border-strong); }
      .legend span { display: inline-flex; gap: 6px; align-items: center; }
      .panel { border-radius: var(--sw-r-lg); background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-1); padding: 16px; display: grid; gap: 12px; align-content: start; min-inline-size: 0; }
      .panel h3 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); display: flex; align-items: center; gap: 8px; }
      .panel h3 .sp { flex: 1; }
      .panel .lead { margin: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .minis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .mini { padding: 9px 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); display: grid; gap: 2px; }
      .mini b { font-size: var(--sw-fs-xl); color: var(--sw-heading); font-variant-numeric: tabular-nums; line-height: 1.1; }
      .mini b[data-tone] { color: var(--ct); }
      .mini span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); line-height: 1.25; }
      .lockrow { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-sm); border: 1px dashed var(--sw-border-strong); color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .lockrow b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-base); }
      .lockrow input { inline-size: 20px; block-size: 20px; }
      .db { display: grid; gap: 16px; padding-block-end: 8px; }
      .dfoot { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding-block-start: 12px; border-block-start: 1px solid var(--sw-border-strong); }
      .dfoot .sp { flex: 1; }
      .dhead { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .diff { display: grid; grid-template-columns: auto 1fr 1fr; gap: 8px 12px; padding: 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); align-items: start; }
      .diff .h { font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); }
      .flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .flow div { padding: 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); font-size: var(--sw-fs-xs); color: var(--sw-text-2); display: grid; gap: 4px; }
      .flow b { color: var(--sw-heading); font-size: var(--sw-fs-sm); }
      .bubble { padding: 12px 14px; border-radius: var(--sw-r-md); background: var(--sw-success-soft); color: var(--sw-text); font-size: var(--sw-fs-sm); line-height: 1.55; }
      .ap { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 18px; }
      .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .dgrid { display: grid; gap: 8px; }
      .toasts { position: fixed; inset-block-end: 24px; inset-inline: 0; display: grid; justify-items: center; gap: 8px; z-index: var(--sw-z-toast); pointer-events: none; }
      .toast { background: var(--sw-toast-bg); color: var(--sw-toast-text); padding: 10px 16px; border-radius: var(--sw-r-pill); box-shadow: var(--sw-shadow-2); font-size: var(--sw-fs-sm); display: inline-flex; gap: 8px; align-items: center; }
      .gaps { display: grid; gap: 8px; }
      .gap { display: grid; grid-template-columns: 28px 1fr; gap: 10px; padding: 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .gap b { display: block; color: var(--sw-heading); }
      .gap .ik { inline-size: 28px; block-size: 28px; border-radius: var(--sw-r-xs); display: grid; place-items: center; background: var(--cs); color: var(--ct); }
      .drows { display: grid; gap: 8px; }
      .drow { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 10px; padding: 10px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); align-items: start; }
      .drow .ik { inline-size: 28px; block-size: 28px; border-radius: var(--sw-r-xs); display: grid; place-items: center; background: var(--cs); color: var(--ct); }
      .drow .dmain { display: grid; gap: 6px; min-inline-size: 0; }
      .drow .dname { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; min-inline-size: 0; }
      .drow .dname b { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 100%; }
      .drow .dname small, .drow .dwhen { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .drow .dk { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .drow .dlist { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
      .drow .dlist li { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; line-height: 1.45; }
      .drow .dlist b { color: var(--sw-text); font-weight: var(--sw-fw-semibold); }
      .drow .dact { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
      .pd-r { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 16px; border-block-end: 1px solid var(--sw-border); }
      .pd-r:last-child { border-block-end: 0; }
      .pd-w { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
      .pd-a { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .seg { display: flex; flex-wrap: wrap; gap: 6px; }
      .seg button { border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); color: var(--sw-text); padding: 0 14px; border-radius: var(--sw-r-pill); min-block-size: var(--sw-touch-desktop); font: inherit; cursor: pointer; }
      .seg button[aria-pressed='true'] { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); font-weight: var(--sw-fw-semibold); }
      .seg button:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
      /* POLISH4-WP8 (D18, owner Q9a): the list card switches to its two-line rows by its OWN width (a narrow main column beside the side
         panels on a tablet), not only by the window's */
      .tcard.grants { container: xgrants / inline-size; }
      @container xgrants (max-width: 860px) {
        .gl-h { display: none; }
        .gl-r { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'pn chev' 'st st' 'doors doors' 'win code'; gap: 8px 12px; }
        .gl-r .pn { grid-area: pn; } .gl-r .st { grid-area: st; } .gl-r .doors { grid-area: doors; } .gl-r .win { grid-area: win; } .gl-r .code { grid-area: code; justify-items: end; } .gl-r .chev { grid-area: chev; }
      }
      @media (max-width: 1180px) {
        .cols { grid-template-columns: 1fr; }
        .side { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
      }
      @media (max-width: 900px) {
        .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .gl-h { display: none; }
        .gl-r { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'pn chev' 'st st' 'doors doors' 'win code'; gap: 8px 12px; }
        .gl-r .pn { grid-area: pn; } .gl-r .st { grid-area: st; } .gl-r .doors { grid-area: doors; } .gl-r .win { grid-area: win; } .gl-r .code { grid-area: code; justify-items: end; } .gl-r .chev { grid-area: chev; }
        .ap { grid-template-columns: 1fr; }
      }
      @media (max-width: 600px) {
        .pd-r { grid-template-columns: 1fr; }
        .pd-a { justify-content: flex-start; }
        .top { flex-direction: column; align-items: stretch; }
        .top .sp { display: none; }
        .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .flow { grid-template-columns: 1fr 1fr; }
        .two { grid-template-columns: 1fr; }
        .minis { grid-template-columns: repeat(2, 1fr); }
        .gl-r .code { justify-items: start; }
        .drow { grid-template-columns: 28px minmax(0, 1fr); }
        .drow .dact { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; }
      }
      /* POLISH4-WP8 (D18, owner Q9a): from a 1024 px window up (and tall enough for a working list) the page itself never scrolls - the
         title, the banners and the KPI filters stay put, the grants list scrolls inside its card under its filters and column head, the
         side panels scroll in their own column when they are taller than the window. 1024-1180 keeps the two columns with a narrower side
         (the list card then shows its two-line rows). A phone, a narrow or a short window keeps the page scroll. */
      @media (min-width: 1024px) and (min-height: 600px) {
        :host { min-block-size: 0; overflow: hidden; padding-block-end: 16px; }
        .cols { flex: 1 1 auto; min-block-size: 0; grid-template-rows: minmax(0, 1fr); align-items: stretch; }
        .main { display: flex; flex-direction: column; gap: 14px; min-block-size: 0; }
        .main > .kpis { flex: none; }
        .main > .tcard.grants { flex: 1 1 auto; min-block-size: 0; display: flex; flex-direction: column; }
        .tcard.grants > .filters, .tcard.grants > .gl-h, .tcard.grants > .legend { flex: none; }
        .tcard.grants > .gl-body { flex: 1 1 auto; min-block-size: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--sw-border-strong) transparent; }
        .main > [data-pending-panel] { flex: 0 1 auto; min-block-size: 0; max-block-size: 38%; overflow-y: auto; scrollbar-width: thin; }
        .side { min-block-size: 0; overflow-y: auto; align-content: start; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--sw-border-strong) transparent; }
      }
      @media (min-width: 1024px) and (max-width: 1180px) and (min-height: 600px) {
        .cols { grid-template-columns: minmax(0, 1fr) 290px; }
        .side { grid-template-columns: minmax(0, 1fr); }
        .kpi { padding: 9px 10px; gap: 8px; }
      }
    `,ee];g([P({attribute:!1})],v.prototype,"route",2);g([h()],v.prototype,"data",2);g([h()],v.prototype,"error",2);g([h()],v.prototype,"query",2);g([h()],v.prototype,"sel",2);g([h()],v.prototype,"detail",2);g([h()],v.prototype,"dialog",2);g([h()],v.prototype,"digest",2);g([h()],v.prototype,"drift",2);g([h()],v.prototype,"exporting",2);g([h()],v.prototype,"pending",2);g([h()],v.prototype,"busy",2);g([h()],v.prototype,"dlgError",2);g([h()],v.prototype,"readiness",2);g([h()],v.prototype,"toasts",2);g([h()],v.prototype,"tz",2);g([h()],v.prototype,"cardNo",2);g([h()],v.prototype,"history",2);g([h()],v.prototype,"apDoors",2);g([h()],v.prototype,"apFrom",2);g([h()],v.prototype,"apUntil",2);g([h()],v.prototype,"apTold",2);g([h()],v.prototype,"goneChecks",2);g([h()],v.prototype,"goneRef",2);g([h()],v.prototype,"word",2);g([h()],v.prototype,"draft",2);g([h()],v.prototype,"loadedAt",2);g([h()],v.prototype,"stale",2);g([h()],v.prototype,"reading",2);g([h()],v.prototype,"rb",2);v=g([ns("access-external-screen")],v);export{v as AccessExternalScreen};
