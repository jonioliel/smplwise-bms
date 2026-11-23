import{cn as T,bE as H,g as N,j as p,i as q,aK as K,a1 as v,dG as M,m as k,b3 as G,bl as Q,jZ as U,de as Z,b as o,A as d,k as V,mn as B,mo as J,aq as $,a5 as y}from"./index-BYRaM0w7.js";import{p as E,D as L,s as P,P as A,a as _,b as X,R as Y,e as tt,f as st}from"./plan-view-5M2dvpWf.js";import{b as et}from"./bubble-chrome-BtjbJxHL.js";import{s as W}from"./settings-kC3vgv__.js";import{n as z,K as at,a as it}from"./wizard-prefs-Dim0c-R4.js";import{T as rt}from"./toast-controller-BPX0Tkjm.js";import{z as nt}from"./zones-D8I-3A3Y.js";import{t as n}from"./media-DNFqfkUG.js";import"./sw-logo-art-PLtEZJxU.js";const s=T("msg/plan-view-card",H("en","i18n/msg/plan-view-card","en")),S={style:s("אוטומטי: בהיר עם ערכת נושא בהירה, כהה עם כהה"),default_view:s("במה נפתחת התצוגה התלת־ממדית: סכמטי לכולם, ריאליסטי - בחירה אישית בדפדפן הזה"),furniture:s("דגמים: ריהוט מפורט מהספרייה; גאומטרי: צורות פשוטות (קל יותר למחשב)"),textures:s("קבצי חומרים: טקסטורות אמיתיות; גאומטרי: גוון אחיד לכל חומר"),wall_display:s("מסך קיר מציג תלת־ממד חי או תמונות מוכנות (חוסך חום וסוללה)"),time_source:s("לפי שעון האתר השמש זזה עם היום; ידני: בוחרים שעה בסרגל"),mouse_mode:s("איך מסובבים את המבט בסיור: גרירה, נעילת סמן, או אוטומטי לפי המסך"),quality:s("אוטומטי יורד בדרגה כשהמחשב מתקשה; דרגה קבועה נשארת"),kiosk_idle_s:s("אחרי כמה זמן בלי שינוי מסך הקיר עובר לתמונה מוכנה"),eye_m:s("גובה העין בסיור בגובה עין"),dpr_cap:s("כמה פיקסלים לכל נקודת מסך לכל היותר; נמוך יותר = מהיר יותר"),section_cut:s("במבט מלמעלה הקירות נחתכים כדי לראות פנימה"),show_temps:s("טמפרטורת החדר על הרצפה כשיש חיישן"),motion:s("דלתות נפתחות, אור משתנה ותנועת מצלמה"),walk_guard:s("כשהסיור רץ לאט, האיכות יורדת דרגה עד סוף הסיור"),backdrop:s("בתצוגה הריאליסטית: שמיים לפי השעה, או רקע כהה בהדרגה בלי קו אופק (מראה של הדמיה אדריכלית)"),floor_finish:s("בתצוגה הריאליסטית: ממה עשויה רצפת חדרי המגורים - שיש קלקטה מלוטש, קרמיקה יוקרתית, טרוורטין או פרקט עץ (חדרים רטובים, חניה וגינה נשארים כפי שהם)"),floor_reflections:s("בתצוגה הריאליסטית: הרהיטים והחלונות משתקפים בשיש ובקרמיקה המבריקים; כיבוי חוסך מעט עבודה למחשב"),wall_cut:s("במבט מלמעלה: קירות נמוכים מראים את כל החדרים מכל זווית, וראשי הקירות נושאים את סימון מצב החדר"),reflections_auto:s("במכשיר חלש, וכשהתמונה מתחילה להאט, ההשתקפות ברצפה נכבית ראשונה; סימוני מצב החדר לא יורדים אף פעם"),room_marks:s("נוכחות ואזעקה: פס צבע על ראש הקיר ופס דק לאורך הקירות ברצפה, או צביעת הרצפה כמו קודם"),light_mark:s("ביום כמעט לא רואים שהמנורה דולקת: פס ענבר דק על ראש הקיר מסמן חדר עם אור דולק"),alarm_motion:s("חדר באזעקה מסומן באדום. למי שביקש במכשיר שלו פחות תנועה האדום קבוע בכל מקרה"),light_mood:s("אוטומטי: יום, ערב חם ולילה לפי השעה באתר; נעילה שומרת מראה קבוע (מסך קיר, מוקד)")},ot={0:s("לעולם לא"),10:s("10 שניות"),30:s("30 שניות"),120:s("2 דקות"),600:s("10 דקות")},I=[{key:"map.room_pills",group:"labels",he:s("תוויות על המפה"),hint:s("תווית אחת לכל חדר מסכמת מה פתוח, נוכחות, אורות וטמפרטורה; בהתקרבות לחדר כל התקן מופיע לחוד"),options:[["room",s("תווית לכל חדר, התקנים בהתקרבות")],["room_always",s("תווית לכל חדר תמיד")],["device",s("תווית לכל התקן")]]},{key:"map.room_pill_tap",group:"labels",he:s("נגיעה בתווית של חדר"),hint:s("חלון פירוט קטן, וממנו ממשיכים לכרטיס החדר"),options:[["popover",s("חלון פירוט קטן, ממנו לכרטיס")],["card",s("ישר לכרטיס החדר")]]},{key:"map.room_pill_quiet",group:"labels",he:s("חדר שאין בו מה לדווח"),hint:s("הכול סגור וכבוי ואין טמפרטורה"),options:[["name",s("רק שם החדר")],["hide",s("לא להציג כלום")],["bubble",s('תווית "הכול סגור"')]]},{key:"map.room_card_place",group:"labels",he:s("מיקום כרטיס החדר"),hint:s("במחשב ובטאבלט: פאנל בצד והחדר זז למרכז השטח שנשאר; בטלפון הכרטיס הוא תמיד גיליון שעולה מלמטה"),options:[["side",s("פאנל בצד")],["float",s("כרטיס צף בפינה")],["sheet_tablet",s("מחשב: פאנל, טאבלט: גיליון")]]},{key:"map.room_card_confirm",group:"labels",he:s("אישור לפני פעולה בכרטיס החדר"),hint:s("דלתות, שערים ואזעקה דורשים אישור תמיד, כמו בשאר המערכת"),options:[["system",s("דלתות, שערים ואזעקה")],["bulk",s('גם "כבה הכול" וסגירת תריסים')]]},{key:"map.room_card_camera",group:"labels",he:s("המצלמה בכרטיס החדר"),hint:s("וידאו חי מתחיל מיד כשהכרטיס נפתח (בזרם המשני) ונעצר כשהוא נסגר"),options:[["live",s("וידאו חי מיד")],["snapshot",s("תמונה מתעדכנת, וידאו בלחיצה")],["none",s("בלי מצלמה")]]},{key:"map.stack_backdrop",group:"stack",he:s("רקע בתצוגת כל הקומות"),hint:s("לפי מצב בהיר / כהה והשעה, כמו קומה אחת; או נעול למראה בהיר או כהה קבוע"),options:[["theme",s("לפי המצב והשעה")],["light",s("תמיד בהיר")],["dark",s("תמיד כהה")]]},{key:"map.stack_pick",group:"stack",he:s("בחירת קומה בתצוגת כל הקומות"),hint:s("נגיעה ראשונה מגדילה את הקומה ומראה את החדרים שלה, נגיעה שנייה נכנסת"),options:[["two_tap",s("נגיעה מגדילה, שנייה נכנסת")],["one_tap",s("נגיעה אחת נכנסת")]]}];var lt=Object.defineProperty,ct=Object.getOwnPropertyDescriptor,w=(t,e,a,r)=>{for(var l=r>1?void 0:r?ct(e,a):e,i=t.length-1,c;i>=0;i--)(c=t[i])&&(l=(r?c(e,a,l):c(l))||l);return r&&l&&lt(e,a,l),l};const C="__follow",j=(t,e)=>t==="kiosk_idle_s"?ot[Number(e)]??String(e):st[String(e)]??String(e),O=(t,e)=>t==="eye_m"?s("{n} מ׳",{n:e.toFixed(2)}):`×${e.toFixed(2)}`;let u=class extends q{constructor(){super(...arguments),this.bubbleSkin=new K(this),this.target="own",this.prefs=null,this.draft={},this.siteStored={lat:"",lon:""},this.siteDraft=null,this.canEdit=!v(),this.mapStored={},this.mapDraft={},this.wizard=null,this.wizardErr="",this.busy=!1,this.toaster=new rt(this,{ms:2500}),this.error=""}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{if(this.prefs=await E(!0),v()){const t=await M();this.canEdit=t.can_edit;const e=t.settings["site.latitude"],a=t.settings["site.longitude"];this.siteStored={lat:e==null?"":String(e),lon:a==null?"":String(a)},this.mapStored=this.mapOf(t.settings)}}catch(t){this.error=k(t)}this.loadWizard()}mapOf(t){const e={};for(const a of I){const r=t[a.key];typeof r=="string"&&a.options.some(([l])=>l===r)&&(e[a.key]=r)}return e}async loadWizard(){if(!v()){this.wizard??=z(null);return}try{const t=await G("me/prefs");this.wizard=z(t.prefs["plan.wizard"])}catch{this.wizard=z(null)}}async setWizard(t){const a={...this.wizard??z(null),...t};if(a.review_min>=a.auto_accept){this.wizardErr=s("הסף התחתון צריך להיות נמוך מהסף העליון.");return}this.wizardErr="",this.busy=!0,this.error="";try{v()&&await Q("me/prefs",{"plan.wizard":a}),this.wizard=a,this.flash(s("ההעדפה נשמרה"))}catch(r){this.error=k(r)}finally{this.busy=!1}}mapValue(t){return this.mapDraft[t.key]??this.mapStored[t.key]??t.options[0][0]}setMap(t,e){const a={...this.mapDraft};e===(this.mapStored[t.key]??t.options[0][0])?delete a[t.key]:a[t.key]=e,this.mapDraft=a,this.toaster.clear()}siteValue(t){return this.draft[t]??this.prefs?.site[t]??L[t]}get dirty(){return Object.keys(this.draft).length>0||Object.keys(this.mapDraft).length>0||!!this.siteDraft&&(this.siteDraft.lat!==this.siteStored.lat||this.siteDraft.lon!==this.siteStored.lon)}flash(t){this.toaster.show(t)}setInst(t,e){const a={...this.draft};e===(this.prefs?.site[t]??L[t])?delete a[t]:a[t]=e,this.draft=a,this.toaster.clear()}async saveInstallation(){const t={};Object.keys(this.draft).length&&(t["plan.view"]={...this.draft});for(const[a,r]of Object.entries(this.mapDraft))t[a]=r;const e=this.siteDraft;if(e){e.lat!==this.siteStored.lat&&(t["site.latitude"]=e.lat),e.lon!==this.siteStored.lon&&(t["site.longitude"]=e.lon);const a=parseFloat(e.lat),r=parseFloat(e.lon);if(e.lat&&(!Number.isFinite(a)||Math.abs(a)>90)||e.lon&&(!Number.isFinite(r)||Math.abs(r)>180)){this.error=s("מיקום האתר: קו רוחב בין -90 ל-90, קו אורך בין -180 ל-180.");return}if(e.lat===""!=(e.lon==="")){this.error=s("מיקום האתר: צריך גם קו רוחב וגם קו אורך (או שניהם ריקים).");return}}if(Object.keys(t).length){this.busy=!0,this.error="";try{if(v()){const a=await U(t);Z();const r=a.settings["site.latitude"],l=a.settings["site.longitude"];this.siteStored={lat:r==null?"":String(r),lon:l==null?"":String(l)},this.mapStored=this.mapOf(a.settings),this.prefs=await E(!0)}else{const a=this.prefs??await E();this.prefs={...a,site:{...a.site,...this.draft},effective:{...a.effective,...this.draft,...a.own}},e&&(this.siteStored={...e}),this.mapStored={...this.mapStored,...this.mapDraft}}this.draft={},this.mapDraft={},this.siteDraft=null,this.flash(s("ברירת המחדל נשמרה"))}catch(a){this.error=k(a)}finally{this.busy=!1}}}async setOwn(t,e){this.busy=!0,this.error="";try{this.prefs=await P({[t]:e}),this.flash(s("ההעדפה נשמרה"))}catch(a){this.error=k(a)}finally{this.busy=!1}}async clearOwn(){const t=Object.fromEntries(A.map(e=>[e,null]));this.busy=!0,this.error="";try{this.prefs=await P(t),this.flash(s("ההעדפה נמחקה"))}catch(e){this.error=k(e)}finally{this.busy=!1}}get instDisabled(){return this.busy||!this.canEdit}seg(t,e,a,r,l,i,c,h){const g=[...a?[{value:C,label:s("לפי ההתקנה"),attrs:{"data-view-follow":e}}]:[],...r.map(b=>({value:String(b),label:i(b),attrs:{"data-view-option":`${e}:${b}`}}))],D=l===null?a?C:"":String(l);return o`<sw-segmented label=${t} .options=${g} value=${D} ?disabled=${c}
      @change=${b=>{const R=b.detail.value;if(R===C)h(null);else{const x=r.find(F=>String(F)===R);x!==void 0&&h(x)}}}></sw-segmented>`}choiceRow(t){const e=this.target==="own",a=A.includes(t),r=X[t],l=t==="default_view"?"schematic":this.siteValue(t),i=e?this.prefs?.own[t]??null:l,c=e?this.busy||!a:this.instDisabled||t==="default_view",h=e&&i===null?`${s("לפי ההתקנה: {value}",{value:j(t,l)})} · ${S[t]}`:S[t];return o`<div class="row" data-view-row=${t}>
      <span class="lbl">${_[t]}<span class="muted">${h}</span></span>
      ${this.seg(_[t],t,e&&a,r,i,g=>j(t,g),c,g=>g===null?void this.setOwn(t,null):e?void this.setOwn(t,g):this.setInst(t,g))}
    </div>`}flagRow(t){const e=this.target==="own",a=this.siteValue(t),r=e?this.prefs?.own[t]??null:a,l=e?this.busy:this.instDisabled,i=h=>s(h?"פעיל":"כבוי"),c=e&&r===null?`${s("לפי ההתקנה: {value}",{value:i(a)})} · ${S[t]}`:S[t];return o`<div class="row" data-view-row=${t}>
      <span class="lbl">${_[t]}<span class="muted">${c}</span></span>
      ${this.seg(_[t],t,e,[!0,!1],r,i,l,h=>h===null?void this.setOwn(t,null):e?void this.setOwn(t,h):this.setInst(t,h))}
    </div>`}rangeRow(t){const e=this.target==="own",[a,r,l]=Y[t],i=this.siteValue(t),c=this.prefs?.own[t],h=e&&c===void 0,g=e?c??i:i,D=e?this.busy:this.instDisabled,b=R=>{const x=tt(t,Number(R.target.value));e?this.setOwn(t,x):this.setInst(t,x)};return o`<div class="row" data-view-row=${t}>
      <span class="lbl">${_[t]}<span class="muted">${h?s("לפי ההתקנה: {value}",{value:O(t,i)}):O(t,g)} · ${S[t]}</span></span>
      <span class="range">
        ${e?o`<button type="button" data-view-follow=${t} aria-pressed=${h?"true":"false"} ?disabled=${D} @click=${()=>void this.setOwn(t,null)}>${s("לפי ההתקנה")}</button>`:d}
        <input type="range" data-view-range=${t} min=${a} max=${r} step=${l} .value=${String(g)} ?disabled=${D} aria-label=${_[t]} aria-valuetext=${O(t,g)} @input=${e?d:b} @change=${b} />
        <output>${O(t,g)}</output>
      </span>
    </div>`}mapRow(t){const e=this.mapValue(t);return o`<div class="row" data-map-row=${t.key}>
      <span class="lbl">${t.he}<span class="muted">${t.hint}</span></span>
      ${this.seg(t.he,t.key,!1,t.options.map(([a])=>a),e,a=>t.options.find(([r])=>r===a)?.[1]??a,this.instDisabled,a=>a!==null&&this.setMap(t,a))}
    </div>`}wizardRows(){const t=this.wizard??z(null),e=(a,r,l)=>o`<div class="row" data-wizard-row=${a}>
      <span class="lbl">${r}<span class="muted">${l}</span></span>
      <sw-field class="ctl"><input type="number" inputmode="numeric" min="5" max="99" step="1" data-ltr data-wizard-pct=${a} aria-label=${r} .value=${String(t[a])} ?disabled=${this.busy}
        @change=${i=>{const c=i.target,h=Math.round(Number(c.value));Number.isFinite(h)&&h>=5&&h<=99?this.setWizard({[a]:h}):c.value=String(t[a])}} /></sw-field>
    </div>`;return o`${e("auto_accept",s("נכנס בלי בדיקה מעל (%)"),s("פריט שזוהה בביטחון גבוה מזה נכנס לתוכנית לבד"))}
      ${e("review_min",s("לא נכנס בלי אישור מתחת ל־(%)"),s("בין שני הספים הפריט מסומן לבדיקה"))}
      <div class="row" data-wizard-row="unreviewed">
        <span class="lbl">${s("פריט לבדיקה שדילגת עליו")}<span class="muted">${s("נכנס כמו שזוהה, או לא נכנס")}</span></span>
        ${this.seg(s("פריט לבדיקה שדילגת עליו"),"wizard.unreviewed",!1,["as_detected","reject"],t.unreviewed,a=>s(a==="as_detected"?"נכנס כמו שזוהה":"לא נכנס"),this.busy,a=>a&&void this.setWizard({unreviewed:a}))}
      </div>
      <div class="row" data-wizard-row="kit">
        <span class="lbl">${s("ערכת סגנון ראשונה")}<span class="muted">${s("הערכה שמסומנת כשמגיעים לשלב הסגנון; בכל תוכנית אפשר לבחור אחרת")}</span></span>
        ${this.seg(s("ערכת סגנון ראשונה"),"wizard.kit",!1,at,t.kit,a=>it[a],this.busy,a=>a&&void this.setWizard({kit:a}))}
      </div>
      ${this.wizardErr?o`<div class="row"><span class="msg err" role="alert" data-wizard-error><sw-icon name="warning" size=${13}></sw-icon>${this.wizardErr}</span></div>`:d}`}siteRow(){const t=this.siteDraft??this.siteStored,e=a=>{this.siteDraft={...this.siteDraft??this.siteStored,...a},this.toaster.clear()};return o`<div class="row" data-view-row="site">
      <span class="lbl">${s("מיקום האתר — ידני")}<span class="muted">${s('קו רוחב וקו אורך במעלות, לחישוב מסלול השמש. חל רק כשמקור המיקום הוא "ידני" (הגדרות ‹ כללי ‹ וידאו ומדיה ‹ מיקום האתר לשמש בתלת־ממד); אחרת השמש לפי מיקום הבית')}</span></span>
      <span class="site">
        <sw-field label=${s("קו רוחב")}><input type="text" inputmode="decimal" data-ltr data-site-lat placeholder="32.08" .value=${t.lat} ?disabled=${this.instDisabled} @input=${a=>e({lat:a.target.value.trim()})} /></sw-field>
        <sw-field label=${s("קו אורך")}><input type="text" inputmode="decimal" data-ltr data-site-lon placeholder="34.78" .value=${t.lon} ?disabled=${this.instDisabled} @input=${a=>e({lon:a.target.value.trim()})} /></sw-field>
      </span>
    </div>`}render(){const t=this.target==="own",e=a=>I.filter(r=>r.group===a).map(r=>this.mapRow(r));return o`<sw-card heading=${s("מפה תלת־ממדית")} subheading=${s("תוויות וכרטיס החדר, כל הקומות, מראה, סימוני מצב, שעה ואור, תוכנית מתמונה, סיור ואיכות - לכל ההתקנה ולעצמי")} data-plan-view-card data-settings-map3d>
      <div class="row scope">
        <span class="lbl">${s("למי")}<span class="muted">${s(t?"ההעדפה שלי: כל שינוי נשמר מיד ותקף בכל מכשיר שלי. התוויות, כרטיס החדר והריצוף נקבעים בברירת המחדל של ההתקנה":"ברירת המחדל של ההתקנה: נשמרת בכפתור")}</span></span>
        <sw-segmented label=${s("למי")} value=${this.target} @change=${a=>this.target=a.detail.value}
          .options=${[{value:"own",label:s("ההעדפה שלי"),attrs:{"data-view-target":"own"}},{value:"installation",label:s("ברירת המחדל של ההתקנה"),attrs:{"data-view-target":"installation"}}]}></sw-segmented>
      </div>
      ${t?d:o`<h4 class="sub">${s("תוויות וכרטיס החדר")}</h4>${e("labels")}<h4 class="sub">${s("כל הקומות")}</h4>${e("stack")}`}
      <h4 class="sub">${s("מראה")}</h4>
      ${this.choiceRow("style")}
      ${this.choiceRow("backdrop")}
      ${this.choiceRow("default_view")}
      ${t?d:o`${this.choiceRow("furniture")}${this.choiceRow("textures")}${this.choiceRow("floor_finish")}`}
      ${this.choiceRow("wall_cut")}
      ${this.flagRow("floor_reflections")}
      ${this.flagRow("reflections_auto")}
      ${this.flagRow("section_cut")}
      ${this.flagRow("show_temps")}
      ${this.flagRow("motion")}
      <h4 class="sub">${s("סימוני מצב החדר")}</h4>
      ${this.choiceRow("room_marks")}
      ${this.choiceRow("light_mark")}
      ${this.choiceRow("alarm_motion")}
      <h4 class="sub">${s("שעה ואור")}</h4>
      ${this.choiceRow("time_source")}
      ${this.choiceRow("light_mood")}
      ${t?d:this.siteRow()}
      ${t?o`<h4 class="sub">${s("תוכנית חדשה מתמונה")}</h4>${this.wizardRows()}`:d}
      <h4 class="sub">${s("סיור בגובה עין")}</h4>
      ${this.rangeRow("eye_m")}
      ${this.choiceRow("mouse_mode")}
      ${this.flagRow("walk_guard")}
      <h4 class="sub">${s("איכות ומסכים")}</h4>
      ${this.choiceRow("quality")}
      ${this.rangeRow("dpr_cap")}
      ${t?d:o`${this.choiceRow("wall_display")}${this.choiceRow("kiosk_idle_s")}`}
      <div class="foot">
        ${t?o`<sw-button variant="ghost" size="sm" data-view-clear-own ?disabled=${this.busy||!Object.keys(this.prefs?.own??{}).length} @click=${()=>void this.clearOwn()}>${s("לפי ההתקנה בכל האפשרויות")}</sw-button>`:o`<sw-button variant="primary" size="sm" icon="check" data-view-save ?disabled=${this.instDisabled||!this.dirty} @click=${()=>void this.saveInstallation()}>${s("שמור")}</sw-button>
              <sw-button variant="ghost" size="sm" data-view-reset ?disabled=${this.instDisabled||!this.dirty} @click=${()=>{this.draft={},this.mapDraft={},this.siteDraft=null}}>${s("בטל שינויים")}</sw-button>
              ${this.dirty&&!this.instDisabled?o`<span class="dirty" data-view-dirty>${s("יש שינויים שלא נשמרו")}</span>`:d}
              ${!this.canEdit&&v()?o`<span class="note">${s("שינוי ברירת המחדל דורש הרשאת מנהל מערכת.")}</span>`:d}
              ${v()?d:o`<span class="note">${s("נתוני הדגמה: ההגדרות נשמרות רק מול השרת.")}</span>`}`}
        ${this.message?o`<span class="msg ok" role="status" data-view-message><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:d}
        ${this.error?o`<span class="msg err" role="alert" data-view-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:d}
      </div>
    </sw-card>`}};u.styles=[W,N`
    :host {
      display: block;
    }
    .row {
      flex-wrap: wrap;
    }
    .row .lbl {
      min-inline-size: 120px;
      flex: 1 1 200px;
    }
    /* the scope switch heads the card: the one choice that changes what every row below means */
    .row.scope {
      background: transparent;
      padding-inline: 0;
      padding-block: 0 var(--sw-s-3);
      border-block-end: 1px solid var(--sw-border);
      border-radius: 0;
    }
    .row.scope + .sub {
      margin-block-start: var(--sw-s-3);
    }
    /* a sub-heading inside the card: the settings group-label scale, one step down (a heading, not a grey caption) */
    .sub {
      margin: var(--sw-s-4) 0 var(--sw-s-2);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.005em;
    }
    /* the settings segment (sw-segmented, CR-CMP2-SELECTS-2450), wrapping instead of clipping (five kiosk choices at 320 px).
       SEG-MODULE-LOOK-2480 (owner Q5 / Q6, 22.11): the module look, 28 px on a desktop like every settings page (the page's own 44 px
       desktop key went); 44 px under a finger (the coarse-pointer rule below) */
    sw-segmented {
      flex: 0 1 auto;
    }
    .dirty {
      font-size: var(--sw-fs-sm);
      color: var(--sw-warning-text);
      font-weight: var(--sw-fw-semibold);
    }
    .range button:focus-visible,
    .range input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .range {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-inline-size: 0;
      flex-wrap: wrap;
    }
    .range input[type='range'] {
      flex: 1 1 140px;
      min-inline-size: 120px;
      accent-color: var(--sw-accent);
      block-size: var(--sw-touch-desktop, 44px);
      margin: 0;
    }
    .range output {
      min-inline-size: 64px;
      padding-inline: 16px; /* clear of the pill's rounded corner in the bubble skin */
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
    }
    .range button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      min-block-size: var(--sw-touch-desktop, 44px);
      padding: 0 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      background: var(--sw-surface);
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .range button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    .range button[aria-pressed='true'] {
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
      background: var(--sw-accent);
      font-weight: var(--sw-fw-semibold);
    }
    .range button[disabled] {
      cursor: default;
      opacity: 0.6;
    }
    @media (prefers-reduced-motion: reduce) {
      .range button {
        transition-duration: 0ms;
      }
    }
    .site {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      inline-size: 100%;
      max-inline-size: 320px;
    }
    .site input {
      min-block-size: var(--sw-touch-desktop, 44px);
    }
    /* PLAN3D-R32-ANSWERS-2438: the plan wizard's two thresholds (a percent each) on the same 44 px dial */
    input[data-wizard-pct] {
      min-block-size: var(--sw-touch-desktop, 44px);
      inline-size: 96px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .foot {
      margin-block-start: var(--sw-s-4);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (pointer: coarse) {
      sw-segmented {
        --sw-seg-h: 44px;
      }
      .range button {
        min-block-size: 44px;
      }
    }
  `,et];w([p()],u.prototype,"target",2);w([p()],u.prototype,"prefs",2);w([p()],u.prototype,"draft",2);w([p()],u.prototype,"siteStored",2);w([p()],u.prototype,"siteDraft",2);w([p()],u.prototype,"canEdit",2);w([p()],u.prototype,"mapStored",2);w([p()],u.prototype,"mapDraft",2);w([p()],u.prototype,"wizard",2);w([p()],u.prototype,"wizardErr",2);w([p()],u.prototype,"busy",2);w([p()],u.prototype,"error",2);u=w([V("system-plan-view")],u);var dt=Object.defineProperty,pt=Object.getOwnPropertyDescriptor,f=(t,e,a,r)=>{for(var l=r>1?void 0:r?pt(e,a):e,i=t.length-1,c;i>=0;i--)(c=t[i])&&(l=(r?c(e,a,l):c(l))||l);return r&&l&&dt(e,a,l),l};let m=class extends q{constructor(){super(...arguments),this.table=null,this.error="",this.busy=!1,this.note="",this.filter="all",this.query="",this.selected=new Set}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.error="";try{this.table=await B(),this.selected=new Set([...this.selected].filter(t=>this.table.rows.some(e=>e.zone_id===t&&e.status==="suggested")))}catch(t){this.error=k(t)}}rows(){const t=this.table;if(!t)return[];const e=this.query.trim().toLowerCase();return t.rows.filter(a=>(this.filter==="all"||a.status===this.filter)&&(!e||a.zone_name.toLowerCase().includes(e)||(a.area_name??"").toLowerCase().includes(e)||(a.suggestion?.area_name??"").toLowerCase().includes(e)||a.floor_name.toLowerCase().includes(e)))}toggle(t,e){const a=new Set(this.selected);e?a.add(t):a.delete(t),this.selected=a}async apply(t,e){if(t.length){this.busy=!0,this.error="",this.note="";try{const a=await J(t);this.table=a,this.selected=new Set,this.note=a.changed?`${e}: ${$(a.changed)}`:n("אין שינוי"),setTimeout(()=>this.note="",3e3)}catch(a){this.error=k(a)}finally{this.busy=!1}}}acceptSelected(){const t=this.table?.rows.filter(e=>this.selected.has(e.zone_id)&&e.suggestion)??[];this.apply(t.map(e=>({zone_id:e.zone_id,area_id:e.suggestion.area_id})),n("חדרים קושרו"))}acceptAll(){const t=this.rows().filter(e=>e.status==="suggested"&&e.suggestion);this.apply(t.map(e=>({zone_id:e.zone_id,area_id:e.suggestion.area_id})),n("חדרים קושרו"))}render(){const t=this.table;if(this.error&&!t)return o`<sw-card heading=${n("קישור חדרים לאזורים")}><sw-state-panel compact state="error" hint=${this.error} data-area-links-error></sw-state-panel></sw-card>`;if(!t)return o`<sw-card heading=${n("קישור חדרים לאזורים")}><sw-state-panel compact state="loading"></sw-state-panel></sw-card>`;const e=this.rows(),a=e.filter(i=>i.status==="suggested"),r=a.filter(i=>this.selected.has(i.zone_id)).length,l=i=>i>=1?n("שם זהה"):i>=.8?n("שם מכיל"):n("מילים משותפות");return o`<sw-card heading=${n("קישור חדרים לאזורים")} subheading=${n("חדר בתוכנית מצביע על אזור בעץ ההתקנים: 'הצג על המפה' מהעץ ומדף האזור, ולחיצה על החדר במפה פותחת את האזור. ההצעות לפי שם; הקישור נשמר כאן בלבד")} data-area-links>
      <div class="counts" data-area-links-counts>
        <span class="count ok">${n("מקושרים")} <b>${$(t.counts.linked)}</b></span><span class="count sug">${n("הצעות")} <b>${$(t.counts.suggested)}</b></span><span class="count">${n("ללא הצעה")} <b>${$(t.counts.none)}</b></span>
        ${t.counts.dangling?o`<span class="count err">${n("קישור לאזור שנמחק")} <b>${$(t.counts.dangling)}</b></span>`:d}
      </div>
      <div class="bar" role="toolbar" aria-label=${n("סינון ואישור הצעות")}>
        <sw-field><select data-area-links-filter aria-label=${n("הצג")} .value=${this.filter} @change=${i=>this.filter=i.target.value}>
          <option value="all">${n("הכול")}</option><option value="suggested">${n("עם הצעה")}</option><option value="linked">${n("מקושרים")}</option><option value="none">${n("ללא הצעה")}</option>
        </select></sw-field>
        <sw-field class="search"><input type="search" placeholder=${n("חיפוש חדר או אזור")} aria-label=${n("חיפוש חדר או אזור")} data-area-links-search .value=${this.query} @input=${i=>this.query=i.target.value} /></sw-field>
        <span class="grow"></span>
        <span class="acts">
          <sw-button size="sm" data-area-links-select-all ?disabled=${!a.length||this.busy} @click=${()=>this.selected=new Set(a.map(i=>i.zone_id))}>${n("בחר הצעות")} (${$(a.length)})</sw-button>
          <sw-button size="sm" data-area-links-accept-all ?disabled=${!a.length||this.busy} @click=${()=>this.acceptAll()}>${n("אשר את כל ההצעות")}</sw-button>
          <sw-button size="sm" variant="primary" icon="check" data-area-links-accept ?disabled=${!r||this.busy} @click=${()=>this.acceptSelected()}>${n("אשר הצעות")}${r?` (${$(r)})`:""}</sw-button>
        </span>
      </div>
      ${e.length?o`<div class="tablewrap"><table data-area-links-table>
            <thead><tr><th scope="col"><span class="sr">${n("בחירה")}</span></th><th scope="col">${n("חדר")}</th><th scope="col">${n("קומה")}</th><th scope="col">${n("אזור")}</th><th scope="col"><span class="sr">${n("פעולה")}</span></th></tr></thead>
            <tbody>
              ${e.map(i=>o`<tr data-area-link-row=${i.zone_id} data-status=${i.status}>
                <td class="pick">${i.status==="suggested"?o`<input type="checkbox" aria-label=${n("אשר הצעה ל{zone_name}",{zone_name:i.zone_name})} .checked=${this.selected.has(i.zone_id)} ?disabled=${this.busy} @change=${c=>this.toggle(i.zone_id,c.target.checked)} />`:d}</td>
                <td class="room">${y(i.zone_name||n("חדר ללא שם"))}<div class="muted">${nt(i.kind)}<span class="phone"> · ${y(i.floor_name)}</span></div></td>
                <td class="floor">${y(i.floor_name)}<div class="muted">${y(i.building_name)}</div></td>
                <td class="area">
                  <select data-area-link-select aria-label=${n("האזור של {name}",{name:i.zone_name||n("החדר")})} ?disabled=${this.busy} @change=${c=>void this.apply([{zone_id:i.zone_id,area_id:c.target.value||null}],n("עודכן"))}>
                    <option value="" ?selected=${!i.area_id}>${i.status==="suggested"?n("ללא קישור (יש הצעה)"):n("ללא קישור")}</option>
                    ${t.areas.map(c=>o`<option value=${c.area_id} ?selected=${i.area_id===c.area_id}>${y(c.name)}${c.floor_name?` · ${y(c.floor_name)}`:""}</option>`)}
                  </select>
                  ${i.status==="suggested"&&i.suggestion?o`<div class="sugline muted" data-area-link-suggestion><sw-icon name="link" size=${12}></sw-icon>${n("הצעה:")} ${y(i.suggestion.area_name)} · ${l(i.suggestion.score)}</div>`:d}
                  ${i.dangling?o`<div class="gone"><sw-icon name="warning" size=${12}></sw-icon>${n("האזור שהיה מקושר כבר לא קיים")}</div>`:d}
                </td>
                <td class="act">${i.area_id?o`<sw-button size="sm" variant="ghost" data-area-link-clear ?disabled=${this.busy} @click=${()=>void this.apply([{zone_id:i.zone_id,area_id:null}],n("נותקו"))}>${n("נתק")}</sw-button>`:d}</td>
              </tr>`)}
            </tbody>
          </table></div>`:t.rows.length?o`<sw-state-panel icon="filter" compact state="empty" heading=${n("אין חדרים שמתאימים לסינון")} actionLabel=${n("נקה סינון")} @action=${()=>{this.filter="all",this.query=""}} data-area-links-empty></sw-state-panel>`:o`<sw-state-panel icon="link" compact state="empty" heading=${n("אין חדרים בתוכניות")} hint=${n("חדרים נוצרים בעורך התוכנית (זיהוי מהתוכנית או ציור ידני).")} data-area-links-empty></sw-state-panel>`}
      ${this.note||this.error?o`<div class="foot">
            ${this.note?o`<span class="msg ok" role="status" data-area-links-note><sw-icon name="check" size=${13}></sw-icon>${this.note}</span>`:d}
            ${this.error?o`<span class="msg err" role="alert" data-area-links-error><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:d}
          </div>`:d}
    </sw-card>`}};m.styles=[W,N`
    :host {
      display: block;
    }
    .counts {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
      margin-block-end: var(--sw-s-3);
    }
    .count {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 26px;
      padding: 1px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
    }
    .count b {
      font-variant-numeric: tabular-nums;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .count.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .count.sug {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .count.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .count.ok b,
    .count.sug b,
    .count.err b {
      color: inherit;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
      margin-block-end: var(--sw-s-3);
    }
    .bar sw-field {
      flex: 0 1 auto;
    }
    .bar .search {
      flex: 1 1 200px;
      min-inline-size: 0;
    }
    .bar input[type='search'] {
      inline-size: 100%;
      min-inline-size: 160px;
    }
    .bar .grow {
      flex: 1;
    }
    .bar .acts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .tablewrap {
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
      overflow: hidden;
    }
    table {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    th,
    td {
      text-align: start;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    tbody tr:last-child td {
      border-block-end: 0;
    }
    th {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
    }
    td.pick {
      inline-size: 44px;
    }
    td.pick input {
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
      accent-color: var(--sw-accent);
      cursor: pointer;
    }
    td.room {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    td.act {
      text-align: end;
      inline-size: 1%;
      white-space: nowrap;
    }
    tr[data-status='suggested'] td {
      background: color-mix(in srgb, var(--sw-accent-soft) 45%, transparent);
    }
    @media (hover: hover) and (pointer: fine) {
      tbody tr:hover td {
        background: var(--sw-hover-wash);
      }
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular);
    }
    select[data-area-link-select] {
      inline-size: 100%;
      max-inline-size: 260px;
      min-block-size: 36px;
      font: inherit;
      padding: 4px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    select[data-area-link-select]:focus-visible,
    td.pick input:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .sugline {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-block-start: 4px;
      color: var(--sw-accent-text);
    }
    .gone {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-block-start: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger-text);
    }
    /* the floor moves under the room name on a phone (its column folds away; the data stays) */
    .phone {
      display: none;
    }
    @media (max-width: 767px) {
      .phone {
        display: inline;
      }
      .bar .grow {
        display: none;
      }
      .bar .acts {
        flex: 1 1 100%;
      }
      thead {
        display: none;
      }
      tbody tr {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'pick room act' 'pick area area';
        gap: 6px var(--sw-s-2);
        align-items: center;
        padding: 10px 12px;
        border-block-end: 1px solid var(--sw-border);
      }
      tbody tr:last-child {
        border-block-end: 0;
      }
      tbody tr[data-status='suggested'] {
        background: color-mix(in srgb, var(--sw-accent-soft) 45%, transparent);
      }
      tbody td {
        padding: 0;
        border: 0;
        background: transparent;
      }
      td.pick {
        grid-area: pick;
        inline-size: auto;
        align-self: start;
        padding-block-start: 2px;
      }
      td.room {
        grid-area: room;
      }
      td.floor {
        display: none;
      }
      td.area {
        grid-area: area;
      }
      td.act {
        grid-area: act;
        inline-size: auto;
      }
      select[data-area-link-select] {
        max-inline-size: none;
        min-block-size: 44px;
      }
    }
  `];f([p()],m.prototype,"table",2);f([p()],m.prototype,"error",2);f([p()],m.prototype,"busy",2);f([p()],m.prototype,"note",2);f([p()],m.prototype,"filter",2);f([p()],m.prototype,"query",2);f([p()],m.prototype,"selected",2);m=f([V("plan-area-links-admin")],m);
