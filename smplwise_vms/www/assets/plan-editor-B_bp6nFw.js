import{cL as S,ai as D,j as we,z as at,k as R,a as st,q as _e,aj as it,b as r,A as u,m as nt,bs as H,bt as fe,bu as ve,r8 as ze,cB as Fe,ae as L}from"./index-HK12zoPD.js";import{c as lt,e as rt,r as ot}from"./zones-BDPdYDwE.js";import{b as Se,O as Q,i as ee,d as Me}from"./candidates-Bo51K38h.js";import{i as dt,o as ct,c as ut,a as pt}from"./connector-targets-CV8b-vmJ.js";import{ai as Ae,aj as $t,ak as bt,al as mt,am as G,f as gt,m as ht,an as wt,ao as ft,ap as vt,aq as me,ar as Le,as as xt,S as kt,at as yt,au as X,av as Ce,ad as _t,aw as C,ax as zt,ay as St,az as Mt,aA as At,aB as te,aC as W,aD as Lt,aE as Pe,aF as Ct,aG as Ot,aH as Et,aI as Dt,aJ as It,H as Tt,aK as Nt,aL as ae,aM as se,aN as ie,aO as Ft,aP as Pt,aQ as jt,aR as Rt,aS as Oe,aT as Ht,aU as Gt,aV as Wt,aW as Bt}from"./shared-space-B61nN6RW.js";import{s as Ut}from"./plan-catalog-B5nf1rIt.js";import{c as k,s as Kt,a as Xt,b as qt,m as Zt,d as Yt,e as Jt,f as Vt}from"./sw-plan-canvas-BEW60qMC.js";import{M as ge,m as je}from"./material-resolve-CzMVyesD.js";import{s as Qt}from"./sun-D6esIgvO.js";import{t as m}from"./media-BcD4JgoJ.js";var ea=Object.defineProperty,ta=Object.getOwnPropertyDescriptor,T=(e,a,s,n)=>{for(var i=n>1?void 0:n?ta(a,s):a,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(n?l(a,s,i):l(i))||i);return n&&i&&ea(a,s,i),i};const ne={camera:S("מצלמה"),door:S("עמדת דלת"),device:S("התקן"),station:S("עמדת WisKey")},aa={camera:D`<path d="M3 8h11v8H3zM14 11l5-3v8l-5-3"/>`,door:D`<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 13h6M9 16h6"/>`,device:D`<circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>`,station:D`<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="9" r="2.2"/><path d="M9 15h6M9 18h6"/>`};let O=class extends st{constructor(){super(...arguments),this.zoneId="",this.data=null,this.error="",this.busy=!1,this.pick="",this.q="",this.loadedFor=""}updated(){this.zoneId&&this.zoneId!==this.loadedFor&&this.load()}async load(){const e=this.zoneId;this.loadedFor=e,this.error="";try{const a=await lt(e);this.zoneId===e&&(this.data=a,this.pick="",this.q="")}catch(a){this.zoneId===e&&(this.data=null,this.error=_e(a))}}async change(e,a){this.busy=!0,this.error="";try{a?await rt(this.zoneId,e.resource_type,e.resource_id):await ot(this.zoneId,e.resource_type,e.resource_id),await this.load(),this.dispatchEvent(new CustomEvent("members-changed",{bubbles:!0,composed:!0}))}catch(s){this.error=_e(s)}finally{this.busy=!1}}where(e){return e.kind==="station"?S("מוצג בכל קומות החלל"):e.floors.length?e.floors.map(a=>it(a.name)).join(", "):S("לא מוצב")}render(){const e=this.data;if(!e)return r`${this.error?r`<div class="err" data-members-error>${this.error}</div>`:r`<div class="note">${S("טוען חברים…")}</div>`}`;const a=e.candidates??[],s=this.q.trim().toLowerCase(),n=s?a.filter(o=>`${ne[o.kind]} ${o.name} ${o.resource_id}`.toLowerCase().includes(s)):a,i=n.find(o=>`${o.resource_type}|${o.resource_id}`===this.pick);return r`<h4>${S("חברים בחלל המשותף")}</h4>
      <div data-members-list>
        ${e.members.length?e.members.map(o=>r`<div class="row" data-member=${`${o.resource_type}:${o.resource_id}`}>
              <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" data-member-icon=${o.kind}>${aa[o.kind]}</svg>
              <span class="kind">${ne[o.kind]}</span>
              <div class="main">${o.name}<span>${this.where(o)}</span></div>
              ${e.can_manage?r`<sw-button size="sm" variant="ghost" data-member-remove ?disabled=${this.busy} @click=${()=>this.change(o,!1)}>${S("הסר")}</sw-button>`:u}
            </div>`):r`<div class="note">${S("אין חברים שמוצגים לך.")}</div>`}
      </div>
      ${e.can_manage?r`<div class="add">
            <input class="search" type="search" data-member-search aria-label=${S("חיפוש מצלמה, עמדה או התקן להוספה")} placeholder=${S("חיפוש מצלמה, עמדה או התקן")} .value=${this.q} @input=${o=>{this.q=o.target.value,this.pick=""}} />
            <select data-member-pick aria-label=${S("בחר מצלמה, עמדה או התקן להוספה")} .value=${this.pick} @change=${o=>this.pick=o.target.value}>
              <option value="">${S("בחר מצלמה, התקן או עמדת WisKey…")}</option>
              ${n.map(o=>r`<option value=${`${o.resource_type}|${o.resource_id}`}>${ne[o.kind]} · ${o.name} · ${this.where(o)}</option>`)}
            </select>
            <sw-button size="sm" icon="plus" data-member-add ?disabled=${this.busy||!i} @click=${()=>i&&this.change(i,!0)}>${S("הוסף")}</sw-button>
          </div>
          <div class="note">${S("חבר מוצג בכל הקומות של החלל, לכל מי שמורשה לראות אותו. הוספה והסרה דורשות הרשאת עריכה והצבה בשתי הקומות.")}</div>`:r`<div class="note" data-members-readonly>${S("לקריאה בלבד: הוספה והסרה דורשות הרשאת עריכה והצבה בכל הקומות של החלל.")}</div>`}
      ${this.error?r`<div class="err" data-members-error>${this.error}</div>`:u}`}};O.styles=we`
    :host {
      display: block;
      font-family: var(--sw-font);
      color: var(--sw-text-1, inherit);
    }
    h4 {
      margin: 0 0 6px;
      font-size: var(--sw-fs-base);
      font-weight: 600;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-top: 1px solid var(--sw-border);
      font-size: var(--sw-fs-base);
    }
    .row .main {
      flex: 1;
      min-width: 0;
    }
    .row .main span {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .ic {
      width: 16px;
      height: 16px;
      flex: none;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
      color: var(--sw-text-2);
    }
    .search {
      flex: 1 1 100%;
      font: inherit;
      font-size: var(--sw-fs-base);
      padding: 4px 8px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: inherit;
    }
    .kind {
      font-size: var(--sw-fs-xs);
      padding: 1px 6px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .add {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    select {
      flex: 1;
      min-width: 140px;
      font: inherit;
      font-size: var(--sw-fs-base);
      padding: 4px 6px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: inherit;
    }
    .note,
    .err {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      margin-top: 6px;
    }
    .err {
      color: var(--sw-error, var(--sw-danger-text));
    }
  `;T([at()],O.prototype,"zoneId",2);T([R()],O.prototype,"data",2);T([R()],O.prototype,"error",2);T([R()],O.prototype,"busy",2);T([R()],O.prototype,"pick",2);T([R()],O.prototype,"q",2);O=T([nt("sw-share-members")],O);const Y={dxf:"DXF",dxfPicture:"DXF + תמונה",exportPackage:"חבילה",importPackage:"ייבוא חבילה",title:"ייבוא חבילת תוכנית",checking:"בודק את החבילה…",importing:"מייבא…",source:"מקור",draft:"טיוטה",published:"מפורסם",signedHere:"חתומה במערכת הזו",signedForeign:"חתומה במערכת אחרת",trustForeign:"אני סומך על המקור",mode:"אופן הייבוא",replace:"החלפה",merge:"מיזוג",changes:"שינויים בטיוטה",noChanges:"אין שינויים",added:"נוספו",removed:"הוסרו",changed:"השתנו",calibration:"הכיול משתנה",otherDrawing:"שרטוט אחר: בדוק מיקומים אחרי הייבוא",newerApp:"נוצרה בגרסה חדשה יותר",missing:"חסרים במערכת",unplaced:"לא ממוקמים בקומה",itemsAdded:"יתווספו לספרייה",itemsDiffer:"בספרייה גרסה אחרת",issues:"בעיות לבדיקה",importDraft:"ייבוא לטיוטה",cancel:"ביטול",imported:"החבילה יובאה לטיוטה",saved:"החבילה נשמרה",walls:"קירות",openings:"פתחים",labels:"תוויות",objects:"עצמים",connectors:"מעברים",levels:"מפלסים",circuits:"מעגלים",groups:"קבוצות",rooms:"חדרים",cameras:"מצלמות וישויות",switches:"מפסקים",items:"פריטים מותאמים"},Re=H("en","i18n/plan-package","en"),sa={he:Y,en:Re};function He(){return fe(["en"])}function P(e,a=He()){return sa[a][e]??Y[e]}function ps(e,a=He()){return e in Y?P(e,a):e}ve("i18n/plan-package",{he:Y,en:Re});const J={ifc:"IFC",importIfc:"ייבוא IFC",origin:"מיובאים מ־IFC",reading:"קורא את קובץ ה־IFC…",loaded:"המועמדים מהקובץ מוצגים לאישור",nothing:"לא נמצא בקובץ מה לייבא לקומה הזו",read:"נקראו",skipped:"דולגו",storey:"קומה בקובץ",storeys:"קומות בקובץ",moved:"המודל הוזז לראשית התוכנית",tooBig:"המודל גדול מהתוכנית",walls:"קירות",openings:"פתחים",objects:"עצמים",rooms:"חדרים",more:"ועוד",r_unsupported_class:"סוג לא נתמך",r_no_geometry:"בלי גאומטריה קריאה",r_curved_geometry:"גאומטריה מעוקלת",r_tilted_geometry:"גאומטריה מוטה",r_unsupported_geometry:"גאומטריה לא נתמכת",r_unsupported_profile:"פרופיל לא נתמך",r_unsupported_transform:"טרנספורמציה לא נתמכת",r_no_storey:"לא משויך לקומה",r_other_storey:"קומה אחרת בקובץ",r_placement_cycle:"מיקום מעגלי",r_unsupported_placement:"מיקום לא נתמך",r_bad_placement:"מיקום לא תקין",r_bad_number:"מספר לא תקין",r_outside_plan:"מחוץ לתוכנית",r_opening_off_wall:"פתח רחוק מהקיר",r_host_wall_skipped:"הקיר שלו דולג",r_host_not_wall:"לא בקיר",r_unsupported_filling:"מילוי פתח לא נתמך",r_live_device:"מצלמה / ישות (לא מיובאות)",r_connector_not_imported:"מעבר בין מפלסים (לא מיובא)",r_limit:"מעבר למכסה"},Ge=H("en","i18n/plan-ifc","en"),ia={he:J,en:Ge};function V(){return fe(["en"])}function A(e,a=V()){return ia[a][e]??J[e]}function na(e,a=V()){const s=`r_${e}`;return s in J?A(s,a):e}function la(e,a=V()){const s=e.counts,n=["walls","openings","rooms","objects"].filter(l=>s[l]>0).map(l=>`${s[l]} ${A(l,a)}`),i=[`${A("read",a)} ${n.length?n.join(", "):"0"}`];e.skipped_total&&i.push(`${A("skipped",a)} ${e.skipped_total}`);const o=e.storeys.find(l=>l.chosen);return e.storeys.length>1&&o&&i.push(`${o.name} (${e.storeys.length} ${A("storeys",a)})`),e.alignment.fits?(e.alignment.dx_m||e.alignment.dy_m)&&i.push(A("moved",a)):i.push(`${A("tooBig",a)} (${e.alignment.needed_m?.[0]??"?"} × ${e.alignment.needed_m?.[1]??"?"} מ׳)`),i.join(" · ")}function ra(e,a=8,s=V()){const n=Object.entries(e.skipped_by_reason).sort((l,d)=>d[1]-l[1]||l[0].localeCompare(d[0])),i=n.slice(0,a).map(([l,d])=>`${na(l,s)}: ${d}`),o=n.slice(a).reduce((l,[,d])=>l+d,0);return o&&i.push(`${A("more",s)} ${o}`),i}ve("i18n/plan-ifc",{he:J,en:Ge});const xe={kind:"קיר זכוכית",alias:"קיר מסך",tool:"קיר זכוכית",toolTip:"קיר זכוכית / קיר מסך (G): מציירים קיר שכולו זיגוג, ישר או מעוגל",toolHint:"לחץ נקודה אחר נקודה כמו בקיר רגיל: נוצר קיר זכוכית עם לוחות ומליונים. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, Esc מבטל.",toolHintCurved:'לחץ נקודות לאורך הקשת: נוצר קיר זכוכית מעוגל דרכן. לחיצה כפולה, Enter או "סיום" בונים, Esc מבטל.',shape:"צורה",shapeStraight:"ישר",shapeCurved:"מעוגל",frameDepth:"עומק מסגרת (מ׳)",glazing:"זיגוג",panels:"לוחות",panelWidth:"רוחב לוח (מ׳)",panelCount:"מספר לוחות",panelCountAuto:"אוטומטי",mullion:"רוחב מליון (מ׳)",sill:"גובה אדן (מ׳)",glazedHeight:"גובה זיגוג (מ׳)",glazedHeightAuto:"עד ראש הקיר",tint:"גוון",autoDivide:"חלוקה שווה",autoMin:"מינימום (מ׳)",autoMax:"מקסימום (מ׳)",autoNone:"אין חלוקה שווה בטווח הזה",operable:"לוחות נפתחים",operation:"פתיחה",entity:"ישות",noEntity:"ללא",panel:"לוח",toGlass:"המר לקיר זכוכית",toSolid:"המר לקיר רגיל",desktopOnly:"בדסקטופ בלבד",tint_clear:"שקוף",tint_tinted:"כהה",tint_frosted:"חלבי",tint_reflective:"מחזיר אור",op_casement_left:"ציר שמאל",op_casement_right:"ציר ימין",op_tilt:"נטוי",op_sliding:"הזזה",op_awning:"קיפ"},We=H("en","i18n/plan-glass","en"),oa={he:xe,en:We};function da(){return fe(["en"])}function g(e,a=da()){return oa[a][e]??xe[e]}const ca=(e,a)=>g(`tint_${e}`,a),ua=(e,a)=>g(`op_${e}`,a);ve("i18n/plan-glass",{he:xe,en:We});const pa={wall:["wall","floor"],floor:["floor","outdoor"],ceiling:["ceiling","wall"],object:["object","door","window"]},$a={wall:m("קירות"),ceiling:m("תקרות"),floor:m("רצפות"),outdoor:m("חוץ"),object:m("עצמים"),door:m("דלתות"),window:m("חלונות וזכוכית")},ba={light:m("בהיר"),dark:m("כהה")};function ma(e){const a=pa[e];return[...ge].filter(s=>a.includes(s.group)).sort((s,n)=>a.indexOf(s.group)-a.indexOf(n.group))}const ga=(e,a)=>je(e)?.tint[a]??"transparent",le=e=>je(e)?.he??e;function Be(e,a){const s=e.value??e.defaultId,n=e.value!==null,i=ma(e.host),o=[...new Set(ge.map(l=>l.group))];return r`<div class="matf" data-material-field=${e.key}>
    <div class="mathead">
      <span class="lbl">${e.label}<span class="muted" data-material-current>${n?le(s):m("ברירת מחדל: {name}",{name:le(e.defaultId)})}</span></span>
      <sw-segmented size="sm" label=${m("תצוגה מקדימה לפי סגנון")} value=${e.style} @change=${l=>a.setStyle(l.detail.value)}
        .options=${["light","dark"].map(l=>({value:l,label:ba[l],attrs:{"data-material-style":l}}))}></sw-segmented>
    </div>
    <div class="swatches" role="group" aria-label=${e.label}>
      ${i.map(l=>r`<button type="button" class="swatch" data-material-pick=${l.id} aria-pressed=${n&&s===l.id?"true":"false"} aria-label=${l.he} title=${l.he} ?disabled=${e.disabled}
          style=${ze({"--sw-swatch":l.tint[e.style]})} @click=${()=>a.pick(n&&s===l.id?null:l.id)}><i aria-hidden="true"></i></button>`)}
    </div>
    <div class="two">
      <sw-field label=${m("כל החומרים")}><select data-material-select ?disabled=${e.disabled} aria-label=${m("{label} - כל החומרים",{label:e.label})} @change=${l=>a.pick(l.target.value||null)}>
        <option value="" ?selected=${!n}>${m("ברירת מחדל ({name})",{name:le(e.defaultId)})}</option>
        ${o.map(l=>r`<optgroup label=${$a[l]??l}>${ge.filter(d=>d.group===l).map(d=>r`<option value=${d.id} ?selected=${n&&s===d.id}>${d.he}</option>`)}</optgroup>`)}
      </select></sw-field>
      <button type="button" class="matreset" data-material-reset ?disabled=${e.disabled||!n} @click=${()=>a.pick(null)}>
        <i class="dot" aria-hidden="true" style=${ze({background:ga(e.defaultId,e.style)})}></i>${m("ברירת מחדל")}
      </button>
    </div>
  </div>`}function ha(e,a,s,n){const i=Math.atan2(s-e,-(n-a))*180/Math.PI;return Math.round((i%360+360)%360*10)/10}function re(e){return[m("צפון"),m("צפון-מזרח"),m("מזרח"),m("דרום-מזרח"),m("דרום"),m("דרום-מערב"),m("מערב"),m("צפון-מערב")][Math.round((e%360+360)%360/45)%8]}function wa(e,a,s){const n=Qt(e,a.latitude,a.longitude,s);return{planDeg:((n.azimuth-s)%360+360)%360,elevation:n.elevation,azimuth:n.azimuth}}const z=60,B=(e,a)=>[z+a*Math.sin(e*Math.PI/180),z-a*Math.cos(e*Math.PI/180)];function $s(e,a){const s=e.northDeg??0,n=wa(e.nowMs,e.site,s),i=n.elevation>0,o=(360-s)%360,[l,d]=B(o,z-14),[$,p]=B(n.planDeg,z-8),h=c=>{const b=c.shiftKey?15:1,w=c.key==="ArrowRight"||c.key==="ArrowUp"?b:c.key==="ArrowLeft"||c.key==="ArrowDown"?-b:c.key==="Home"?-s:null;w!==null&&(c.preventDefault(),a.set(Math.round((s+w)*10)/10))};let f=!1;const x=c=>{const w=c.currentTarget.getBoundingClientRect();return(360-ha(w.left+w.width/2,w.top+w.height/2,c.clientX,c.clientY))%360};return r`<sw-card heading=${m("צפון")} subheading=${e.northDeg===null?m("לא הוגדר: למעלה בתוכנית = צפון"):m("למעלה בתוכנית פונה ל{wind} ({deg}°)",{wind:re(s),deg:s})} data-north-card>
    <div class="northrow">
      <svg class="dial" data-north-dial viewBox=${`0 0 ${z*2} ${z*2}`} role="slider" tabindex=${e.disabled?-1:0} aria-label=${m("צפון התוכנית")} aria-valuemin="0" aria-valuemax="359" aria-valuenow=${Math.round(s)} aria-valuetext=${`${s}° - ${re(s)}`}
        @keydown=${h}
        @pointerdown=${c=>{e.disabled||(f=!0,c.currentTarget.setPointerCapture(c.pointerId),a.set(x(c)))}}
        @pointermove=${c=>{f&&a.set(x(c))}}
        @pointerup=${c=>{f=!1,c.currentTarget.releasePointerCapture(c.pointerId)}}
        @pointercancel=${()=>{f=!1}}>
        <circle class="face" cx=${z} cy=${z} r=${z-2}></circle>
        ${[0,90,180,270].map(c=>{const[b,w]=B(c,z-4),[v,_]=B(c,z-10);return D`<line class="tick" x1=${b} y1=${w} x2=${v} y2=${_}></line>`})}
        <path class="plan-up" d=${`M ${z-5} 14 L ${z} 6 L ${z+5} 14 Z`}></path>
        <line class="needle" x1=${z} y1=${z} x2=${l} y2=${d}></line>
        <circle class="hub" cx=${z} cy=${z} r="4"></circle>
        <text class="n" x=${l} y=${d} dy="-7" text-anchor="middle">N</text>
        ${i?D`<g class="sun" data-north-sun transform=${`translate(${$} ${p})`}><circle r="5"></circle>${[0,45,90,135,180,225,270,315].map(c=>D`<line x1="0" y1="-7" x2="0" y2="-9" transform=${`rotate(${c})`}></line>`)}</g>`:u}
      </svg>
      <div class="northctl">
        <sw-field label=${m("כיוון הצפון (°)")} hint=${m("כמה מעלות הצפון סוטה מלמעלה בתוכנית, עם כיוון השעון")}><input type="number" min="0" max="359.9" step="0.5" inputmode="decimal" data-ltr data-north-deg .value=${e.northDeg===null?"":String(s)} ?disabled=${e.disabled}
          @change=${c=>{const b=c.target.value.trim();if(!b)return a.set(null);const w=parseFloat(b);Number.isFinite(w)&&a.set(w)}} /></sw-field>
        <div class="note" data-north-sun-note>${i?m("השמש עכשיו ב{wind}, {deg}° מעל האופק",{wind:re(n.azimuth),deg:Math.round(n.elevation)}):m("השמש מתחת לאופק עכשיו")}${e.site.known?"":m(" · מיקום האתר לא הוגדר: מרכז הארץ (הגדרות ‹ מפה)")}</div>
        <div class="btns"><button type="button" class="tbtn ghost" data-north-reset ?disabled=${e.disabled||e.northDeg===null} @click=${()=>a.set(null)}>${m("למעלה = צפון")}</button></div>
      </div>
    </div>
    <div class="note">${m("גרור את המחוג, או השתמש בחצים (Shift = 15°). הצפון קובע את מסלול השמש בתצוגה הריאליסטית ובתמונות המוכנות.")}</div>
  </sw-card>`}function bs(e){const a=new Set(e.map(s=>s.name.trim()));for(let s=1;;s++)if(!a.has(m("עמדה {i}",{i:s})))return m("עמדה {i}",{i:s})}function fa(e,a,s,n){return{x:Math.round(e.x*a*n*10)/10,y:Math.round(e.y*s*n*10)/10}}function ms(e,a,s){const n=.045*a,i=e.heading_deg*Math.PI/180;return{a:[e.x,e.y],b:[e.x+Math.sin(i)*n/a,e.y-Math.cos(i)*n/s]}}function gs(e,a){const s=e.positions.length>=Ae,n=i=>e.levels.find(o=>o.id===i)?.name??i;return r`<sw-card heading=${m("עמדות סיור")} subheading=${e.positions.length?m("{length} עמדות · הסדר כאן הוא סדר המסלול",{length:e.positions.length}):m("נקודות מבט שמורות לסיור בגובה עין")} data-walk-card>
    ${e.armed?r`<div class="note armed" data-walk-armed role="status">${e.armed==="new"?m("לחץ על התוכנית במקום שבו עומדים · Esc לביטול"):m("לחץ על התוכנית כדי להזיז את העמדה · Esc לביטול")}</div>`:u}
    ${e.positions.length?r`<ol class="walklist" aria-label=${m("עמדות סיור")}>
          ${e.positions.map((i,o)=>{const l=fa(i,e.W,e.H,e.scale);return r`<li class=${`walkrow${e.focused===i.id?" on":""}${e.armed===i.id?" armed":""}`} data-walk-row=${i.id}>
              <span class="idx" aria-hidden="true">${o+1}</span>
              <input class="name" type="text" maxlength=${$t} data-walk-name aria-label=${m("שם העמדה {n}",{n:o+1})} .value=${i.name} ?disabled=${e.disabled}
                @keydown=${d=>{d.key==="Enter"&&d.target.blur()}}
                @change=${d=>a.rename(i.id,d.target.value)} />
              <button type="button" class="star" data-walk-default aria-label=${i.is_default?m("עמדת הפתיחה של הסיור"):m("קבע כעמדת הפתיחה")} aria-pressed=${i.is_default?"true":"false"} title=${i.is_default?m("עמדת הפתיחה"):m("עמדת הפתיחה של הסיור")} ?disabled=${e.disabled} @click=${()=>a.setDefault(i.id)}><sw-icon name="star" size=${16}></sw-icon></button>
              <span class="where">
                ${e.levels.length>1?r`<select data-walk-level aria-label=${m("מפלס")} ?disabled=${e.disabled} @change=${d=>a.setLevel(i.id,d.target.value)}>${e.levels.map(d=>r`<option value=${d.id} ?selected=${d.id===i.level_id}>${d.name}</option>`)}</select>`:r`<span class="muted">${n(i.level_id)}</span>`}
                <span class="muted" data-walk-pos>${e.estimated?"≈ ":""}<span class="ltr">${l.x} / ${l.y}</span> ${m("מ׳")}</span>
                <label class="muted hd">${m("כיוון")} <input type="number" min="0" max="359" step="5" inputmode="numeric" data-ltr data-walk-heading aria-label=${m("כיוון המבט במעלות")} .value=${String(Math.round(i.heading_deg))} ?disabled=${e.disabled}
                  @change=${d=>{const $=parseFloat(d.target.value);Number.isFinite($)&&a.setHeading(i.id,$)}} />°</label>
              </span>
              <span class="acts">
                <button type="button" data-walk-go aria-label=${m("עבור לעמדה בתוכנית")} title=${m("הצג בתוכנית")} @click=${()=>a.goTo(i.id)}><sw-icon name="target" size=${16}></sw-icon></button>
                <button type="button" data-walk-place aria-label=${m("הזז את העמדה בלחיצה על התוכנית")} title=${m("הזז בלחיצה על התוכנית")} aria-pressed=${e.armed===i.id?"true":"false"} ?disabled=${e.disabled} @click=${()=>a.arm(e.armed===i.id?null:i.id)}><sw-icon name="move" size=${16}></sw-icon></button>
                <button type="button" data-walk-up aria-label=${m("הקדם במסלול")} title=${m("למעלה")} ?disabled=${e.disabled||o===0} @click=${()=>a.move(i.id,-1)}><sw-icon name="arrowUp" size=${16}></sw-icon></button>
                <button type="button" data-walk-down aria-label=${m("אחר במסלול")} title=${m("למטה")} ?disabled=${e.disabled||o===e.positions.length-1} @click=${()=>a.move(i.id,1)}><sw-icon name="arrowDown" size=${16}></sw-icon></button>
                <button type="button" class="danger" data-walk-delete aria-label=${m("מחק את העמדה")} title=${m("מחק")} ?disabled=${e.disabled} @click=${()=>a.remove(i.id)}><sw-icon name="trash" size=${16}></sw-icon></button>
              </span>
            </li>`})}
        </ol>`:r`<div class="note" data-walk-empty>${m("עדיין אין עמדות שמורות. עמדה היא מקום וכיוון מבט שהסיור יכול לקפוץ אליהם (מקשים 1-9 בסיור).")}</div>`}
    <div class="btns">
      <button type="button" class=${e.armed==="new"?"tbtn primary":"tbtn"} data-walk-add ?disabled=${e.disabled||s} title=${s?m("עד {MAX_WALK_POSITIONS} עמדות",{MAX_WALK_POSITIONS:Ae}):m("לחיצה על התוכנית מציבה את העמדה")} @click=${()=>a.arm(e.armed==="new"?null:"new")}><sw-icon name="plus" size=${16}></sw-icon>${e.armed==="new"?m("בטל הצבה"):m("עמדה חדשה")}</button>
    </div>
  </sw-card>`}const hs=we`
  /* a text button sized by the desktop touch dial (the shared sw-button's sm / md sizes stay 26-30 px) */
  .tbtn {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-block-size: var(--sw-touch-desktop, 44px);
    min-inline-size: var(--sw-touch-desktop, 44px);
    padding: 0 14px;
    border-radius: var(--sw-r-pill);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    color: var(--sw-text);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
  }
  .tbtn.ghost {
    border-color: transparent;
    background: transparent;
    color: var(--sw-text-2);
  }
  .tbtn.primary {
    border-color: var(--sw-accent);
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  /* SETUPPLAN-POLISH-2331: every pressable control of the three cards gives on pointer-down (emil-design-eng: 120 ms, transform only,
     the shared --sw-press-scale) and keeps its hover for a pointer that hovers - a tap no longer leaves a grey wash behind (mobile-native) */
  .tbtn,
  .swatch,
  .matreset,
  .walkrow button {
    transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .tbtn:active:not([disabled]),
  .swatch:active:not([disabled]),
  .matreset:active:not([disabled]),
  .walkrow button:active:not([disabled]) {
    transform: scale(var(--sw-press-scale));
  }
  @media (prefers-reduced-motion: reduce) {
    .tbtn,
    .swatch,
    .matreset,
    .walkrow button {
      transition-duration: 0ms;
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .tbtn:hover:not([disabled]),
    .matreset:hover:not([disabled]) {
      background: var(--sw-surface-3);
    }
    .tbtn.primary:hover:not([disabled]) {
      background: var(--sw-accent-hover);
    }
    .swatch:hover:not([disabled]):not([aria-pressed='true']) {
      box-shadow: inset 0 0 0 1px var(--sw-text-3);
    }
  }
  .tbtn:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .tbtn[disabled] {
    opacity: 0.5;
    cursor: default;
  }
  .matf {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-block: 6px;
  }
  .mathead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .mathead .lbl {
    display: flex;
    flex-direction: column;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    font-weight: var(--sw-fw-medium);
  }
  /* CR-CMP2-SEGMENTED-C-2450: the light / dark preview keys are sw-segmented; the card keeps its small track (2 px, the small
     radius) and its 44 px square key with the extra-small regular label */
  .mathead sw-segmented {
    --sw-seg-pad: 2px;
    --sw-seg-radius: var(--sw-r-sm);
    --sw-seg-btn-radius: calc(var(--sw-r-sm) - 2px);
    --sw-seg-h: var(--sw-touch-desktop, 44px);
    --sw-seg-key-min-w: var(--sw-touch-desktop, 44px);
    --sw-seg-key-pad: 8px;
    --sw-seg-fs: var(--sw-fs-xs);
    --sw-seg-fw: var(--sw-fw-regular);
    --sw-seg-on-fw: var(--sw-fw-semibold);
    /* CR-SEG-MODULE-LOOK-2470: the sw-segmented default is the module look now; this key keeps the old default values it used */
    --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface));
    --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-accent-text));
  }
  .swatch:focus-visible,
  .matreset:focus-visible,
  .dial:focus-visible,
  .walkrow button:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--sw-touch-desktop, 44px), 1fr));
    gap: 6px;
  }
  .swatch {
    all: unset;
    box-sizing: border-box;
    display: block;
    aspect-ratio: 1;
    min-inline-size: var(--sw-touch-desktop, 44px);
    min-block-size: var(--sw-touch-desktop, 44px);
    border-radius: var(--sw-r-sm);
    background: var(--sw-swatch, var(--sw-surface-3));
    box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    cursor: pointer;
    position: relative;
  }
  .swatch[aria-pressed='true'] {
    box-shadow: inset 0 0 0 2px var(--sw-accent), 0 0 0 2px var(--sw-surface);
  }
  .swatch[aria-pressed='true']::after {
    content: '';
    position: absolute;
    inset: 30%;
    border-radius: 50%;
    background: var(--sw-accent);
    box-shadow: 0 0 0 2px var(--sw-text-inverse);
  }
  .swatch[disabled] {
    cursor: default;
    opacity: 0.5;
  }
  .matreset {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: end;
    min-block-size: var(--sw-touch-desktop, 44px);
    padding: 0 10px;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    color: var(--sw-text);
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .matreset[disabled] {
    opacity: 0.5;
    cursor: default;
  }
  .matreset .dot {
    inline-size: 12px;
    block-size: 12px;
    border-radius: var(--sw-r-2xs);
    box-shadow: inset 0 0 0 1px var(--sw-border-strong);
  }
  /* the north compass */
  .northrow {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }
  .dial {
    inline-size: 120px;
    block-size: 120px;
    border-radius: 50%;
    cursor: grab;
    touch-action: none;
    direction: ltr;
  }
  .dial .face {
    fill: var(--sw-surface-2);
    stroke: var(--sw-border-strong);
    stroke-width: 1.5;
  }
  .dial .tick {
    stroke: var(--sw-text-3);
    stroke-width: 1.5;
  }
  .dial .plan-up {
    fill: var(--sw-text-3);
  }
  .dial .needle {
    stroke: var(--sw-danger);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .dial .hub {
    fill: var(--sw-text);
  }
  .dial .n {
    fill: var(--sw-danger-text);
    font-size: var(--sw-fs-xs); /* 11px, from the type scale (unit-token-lint; integration 2.4.7) */
    font-weight: var(--sw-fw-bold);
  }
  .dial .sun circle {
    fill: var(--sw-warning);
  }
  .dial .sun line {
    stroke: var(--sw-warning);
    stroke-width: 1.5;
  }
  .northctl {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-inline-size: 0;
  }
  .matf select,
  .northctl input {
    min-block-size: var(--sw-touch-desktop, 44px);
  }
  /* the saved walk positions */
  .note.armed {
    color: var(--sw-accent-text);
    background: var(--sw-accent-soft);
    border-radius: var(--sw-r-sm);
    padding: 6px 8px;
  }
  .walklist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .walkrow {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    grid-template-areas: 'idx name star' 'idx where where' 'idx acts acts';
    gap: 4px 8px;
    align-items: center;
    /* the inline padding is always there, so focusing a row (.on) tints it without shifting its contents sideways */
    padding: 8px 6px;
    border-block-end: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    transition: background var(--sw-t-hover) var(--sw-ease-color);
  }
  .walkrow:last-child {
    border-block-end: 0;
  }
  .walkrow.on {
    background: var(--sw-accent-soft);
  }
  .walkrow.armed {
    box-shadow: inset 0 0 0 2px var(--sw-accent);
  }
  .walkrow .name:focus-visible,
  .walkrow .where select:focus-visible,
  .walkrow .hd input:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .walkrow .idx {
    grid-area: idx;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .walkrow .name {
    grid-area: name;
    min-inline-size: 0;
    inline-size: 100%;
    box-sizing: border-box;
    min-block-size: var(--sw-touch-desktop, 44px);
    padding: 4px 8px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
  }
  .walkrow .star {
    grid-area: star;
  }
  .walkrow .where {
    grid-area: where;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: center;
    font-size: var(--sw-fs-xs);
  }
  .walkrow .where select,
  .walkrow .hd input {
    font: inherit;
    font-size: var(--sw-fs-xs);
    min-block-size: var(--sw-touch-desktop, 44px);
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    padding: 2px 6px;
  }
  .walkrow .hd {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .walkrow .hd input {
    inline-size: 64px;
  }
  .walkrow .ltr {
    direction: ltr;
    unicode-bidi: isolate;
    font-variant-numeric: tabular-nums;
  }
  .walkrow .acts {
    grid-area: acts;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .walkrow button {
    all: unset;
    box-sizing: border-box;
    display: inline-grid;
    place-items: center;
    min-inline-size: var(--sw-touch-desktop, 44px);
    min-block-size: var(--sw-touch-desktop, 44px);
    border-radius: var(--sw-r-sm);
    color: var(--sw-text-2);
    cursor: pointer;
  }
  @media (hover: hover) and (pointer: fine) {
    .walkrow button:hover:not([disabled]) {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .walkrow button.danger:hover:not([disabled]) {
      color: var(--sw-danger-text);
      background: var(--sw-danger-soft);
    }
  }
  .walkrow button[aria-pressed='true'] {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  /* the default (start) position: the star is filled in the warm accent, not just a pressed wash */
  .walkrow .star[aria-pressed='true'] {
    background: transparent;
    color: var(--sw-warning);
    /* A11Y-POLISHED-2342: the bare warning read 2.0-2.15:1 on white in light; light draws the star in the warning ink (dark unchanged;
       an engine without light-dark() keeps the line above) */
    color: light-dark(var(--sw-warning-text), var(--sw-warning));
  }
  .walkrow button[disabled] {
    opacity: 0.4;
    cursor: default;
  }
  @media (pointer: coarse) {
    .swatch,
    .walkrow button,
    .matreset,
    .walkrow .where select,
    .walkrow .hd input,
    .walkrow .name,
    .matf select,
    .northctl input {
      min-block-size: 44px;
    }
  }
`,t=Fe("msg/plan-studio",H("en","i18n/msg/plan-studio","en")),ws=["wall","curved","glass"],oe=t("גרירת פתח קיים מזיזה אותו לאורך הקיר; חצים להזזה עדינה (Shift = צעד גדול)"),Ue=t("לחץ על קיר, פתח, תווית או עצם כדי לבחור. קיר זז רק אחרי שנבחר: גרירת גוף הקיר הנבחר מזיזה את כולו, גרירת פינה שלו משנה את צורתו. פתח נגרר לאורך הקיר, תווית ועצם למקומם; החצים מזיזים בעדינות את מה שנבחר (Shift = צעד גדול) · Esc מבטל את הבחירה. במסך מגע כל פריט זז רק אחרי שנבחר, כך שהזזת המפה באצבע לא מזיזה פריטים."),va=t("לחץ על סמל דלת בתוכנית (או על הקיר במקום הדלת): תוצג הצעה מקווקוות - רוחב, ציר וכיוון פתיחה לפי הסמל. Enter או לחיצה על ההצעה מאשרים, לחיצה על סמל הבא מאשרת ומציעה את הבאה, Esc מבטל."),xa=t("סמן דלת (D): לחיצה על סמל דלת בשרטוט מציעה את הדלת לפי הסמל"),de=[{id:"select",label:t("בחירה"),hint:Ue},{id:"wall",label:t("קיר"),hint:t("לחץ נקודה אחר נקודה. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, לחיצה על הנקודה הראשונה סוגרת מתאר, Shift מבטל הצמדה לזוויות, Backspace מוחק נקודה.")},{id:"curved",label:k("modeCurved"),hint:k("hintCurved"),tip:k("tipCurved"),key:"R"},{id:"glass",label:g("tool"),hint:g("toolHint"),tip:g("toolTip"),key:"G",aria:`${g("tool")} (${g("alias")})`},{id:"door",label:t("דלת"),hint:t("לחץ על קיר כדי להציב דלת. כיוון הפתיחה והציר נקבעים כאן בפאנל."),drag:oe},{id:"markdoor",label:t("סמן דלת"),hint:va,tip:xa,key:"D"},{id:"window",label:t("חלון"),hint:t("לחץ על קיר כדי להציב חלון."),drag:oe},{id:"passage",label:t("מעבר"),hint:t("פתח בלי דלת בקיר."),drag:oe},{id:"label",label:t("תווית"),hint:t("לחץ במקום התווית ואז הקלד את הטקסט כאן בפאנל."),drag:t("גרירת תווית קיימת מזיזה אותה; חצים להזזה עדינה (Shift = צעד גדול)")},{id:"curve",label:k("modeCurve"),hint:k("hintCurve"),tip:k("tipCurve"),key:"C",chip:!1}],ka={curved:!1,thickness_m:mt,panel_width_m:bt.panel_width_m},q={exterior:t("חיצוני"),interior:t("פנימי"),partition:t("מחיצה"),railing:t("מעקה"),low:t("קיר נמוך"),glass:t("קיר זכוכית")},he=e=>e==="glass"?g("kind"):q[e],ya="exterior";function ce(e,a){return a===e.kind?{}:a==="glass"?Dt(e):e.kind==="glass"?It(a):{kind:a}}const U={door:t("דלת"),window:t("חלון"),passage:t("מעבר")},Ee={right:t("לצד ימין של הקיר"),left:t("לצד שמאל של הקיר"),double:t("כנף כפולה"),sliding:t("הזזה"),none:t("ללא כנף")},De={start:t("בצד תחילת הקיר"),end:t("בצד סוף הקיר")},_a={start:t("לצד שמאל של הקיר"),end:t("לצד ימין של הקיר")},ue=e=>e==="double"||e==="sliding",Z={idle:t("טיוטת המבנה"),pending:t("שינויים ממתינים לשמירה…"),saving:t("שומר…"),saved:t("הטיוטה נשמרה · הצופים יראו אותה אחרי פרסום"),error:t("השמירה נכשלה")},fs={walls:t("קירות"),openings:t("פתחים"),labels:t("תוויות"),levels:t("מפלסים"),rooms:t("חדרים"),objects:t("עצמים"),circuits:t("מעגלי תאורה"),connectors:t("מחברים"),groups:t("קבוצות")};function I(e,a,s=!0){return a&&!s?t("לא מכויל"):t("{v}{v2} מ׳",{v:a?"≈":"",v2:e<10?e.toFixed(2):e.toFixed(1)})}function y(e,a,s){return e===1?a:`${e} ${s}`}function Ie(e){return e.walls.filter(a=>a.source!=="manual").length+e.openings.filter(a=>a.source!=="manual").length}function j(e){return t("1 מ׳ = {v} פיקסלים בתוכנית",{v:(1/e).toFixed(1)})}function Ke(e,a,s=!0){return a&&!s?t("לא מכויל"):t("{v}{v2} מ״ר",{v:a?"≈":"",v2:e<100?e.toFixed(1):e.toFixed(0)})}const M=e=>parseFloat(e.target.value);function vs(e,a){const{scale:s,estimated:n}=ht(e.doc),i=e.issues.filter($=>$.severity==="error"),o=e.issues.filter($=>$.severity==="warning"),l=de.find($=>$.id===e.mode)??de[0],d=!e.doc.walls.length&&!e.doc.openings.length&&!e.doc.labels.length;return e.compact?r`<sw-card heading=${t("מבנה")} subheading=${Z[e.saveState]} data-studio-panel data-studio-compact data-studio-save=${e.saveState}>
      <div class="note" data-select-geom-hint>${Ue}</div>
      ${e.sel?Te(e,e.sel,a,s,n):u}
      ${e.saveState==="error"?r`<div class="err">${e.saveError} ${e.conflict?r`<button class="linkbtn" data-studio-reload @click=${()=>a.reload()}>${t("טען מחדש")}</button>`:r`<button class="linkbtn" data-studio-retry @click=${()=>a.retry()}>${t("נסה שוב")}</button>`}</div>`:u}
    </sw-card>`:r`<sw-card heading=${t("מבנה")} subheading=${Z[e.saveState]} data-studio-panel data-studio-save=${e.saveState}>
    <div class="modes" role="group" aria-label=${t("כלי ציור")}>
      ${de.filter($=>$.chip!==!1).map($=>r`<button class=${$.id===e.mode?"on":""} data-studio-mode=${$.id} aria-pressed=${$.id===e.mode} title=${$.tip??u} aria-label=${$.aria??u} aria-keyshortcuts=${$.key??u} @click=${()=>a.setMode($.id)}>${$.label}</button>`)}
    </div>
    <div class="note">${e.mode==="glass"&&e.glassDraw?.curved?g("toolHintCurved"):l.hint}</div>
    ${l.drag?r`<div class="note" data-studio-drag-hint>${l.drag}</div>`:u}
    ${e.mode==="curve"?r`<div class="btns"><sw-button size="sm" variant="ghost" data-bend-done @click=${()=>a.setMode("select")}>${k("bendDone")}</sw-button></div>`:u}
    ${e.mode==="wall"||e.mode==="curved"?za(e.wallDefaults,a):u}
    ${e.mode==="glass"?Sa(e.glassDraw??ka,a):u}
    <div class="row"><span class="lbl">${t("קנה מידה")}<span class="muted" data-studio-scale>${e.doc.dimensions.calibration?.status==="estimated"?t("≈ {fmtScale} (הערכה, לא מדוד)",{fmtScale:j(s)}):n?e.showEstimates?t("לא מכויל: מידות משוערות (≈)"):t("לא מכויל: מידות מוסתרות עד הכיול"):j(s)}</span></span><sw-button size="sm" icon="scale" data-studio-calibrate @click=${()=>a.calibrate()}>${t(n?"כיול":"כיול מחדש")}</sw-button></div>
    <div class="note" data-studio-counts>${y(e.doc.walls.length,t("קיר אחד"),t("קירות"))} · ${y(e.doc.openings.length,t("פתח אחד"),t("פתחים"))} · ${y(e.doc.labels.length,t("תווית אחת"),t("תוויות"))}${Ie(e.doc)?r` · <span data-studio-auto-count>${t("{autoCount} אוטומטיים / מיובאים",{autoCount:Ie(e.doc)})}</span>`:u}</div>
    ${e.sel?Te(e,e.sel,a,s,n):u}
    ${i.length||o.length?Ia(i,o,a):u}
    ${d&&e.copyCandidates.length?Ta(e.copyCandidates,a,e.busy):u}
    <div class="exports" role="group" aria-label=${t("ייצוא המבנה")}>
      <a class="btnlink" data-export-svg href=${e.exportSvg} download>SVG</a>
      <a class="btnlink" data-export-png href=${e.exportPng} download>PNG</a>
      <a class="btnlink" data-export-dxf href=${e.exportDxf} download>${P("dxf")}</a>
      <button class="btnlink" data-export-dxf-package ?disabled=${e.busy} @click=${()=>a.exportPackage(!0)}>${P("dxfPicture")}</button>
      <button class="btnlink" data-export-json @click=${()=>a.exportJson()}>JSON</button>
      <button class="btnlink" data-export-package ?disabled=${e.busy} @click=${()=>a.exportPackage()}>${P("exportPackage")}</button>
      <label class="btnlink" data-import-package-label>${P("importPackage")}<input type="file" accept=".zip,application/zip" data-import-package hidden ?disabled=${e.busy}
        @change=${$=>{const p=$.target.files?.[0];p&&a.importPackage(p),$.target.value=""}} /></label>
      <a class="btnlink" data-export-ifc href=${e.exportIfc} download>${A("ifc")}</a>
      <label class="btnlink" data-import-ifc-label>${A("importIfc")}<input type="file" accept=".ifc,application/x-step,model/ifc" data-import-ifc hidden ?disabled=${e.busy}
        @change=${$=>{const p=$.target.files?.[0];p&&a.importIfc(p),$.target.value=""}} /></label>
      <span class="note">${t("ייצוא הטיוטה כפי שהיא")}</span>
    </div>
    ${e.saveState==="error"?r`<div class="err">${e.saveError} ${e.conflict?r`<button class="linkbtn" data-studio-reload @click=${()=>a.reload()}>${t("טען מחדש")}</button>`:r`<button class="linkbtn" data-studio-retry @click=${()=>a.retry()}>${t("נסה שוב")}</button>`}</div>`:u}
  </sw-card>`}function za(e,a){return r`<div class="two">
    <sw-field label=${t("עובי קיר (מ׳)")}><input type="number" min="0.01" max="3" step="0.01" data-ltr data-wall-thickness .value=${String(e.thickness_m)}
      @change=${s=>{const n=M(s);n>0&&n<=3&&a.setWallDefaults({...e,thickness_m:n})}} /></sw-field>
    <sw-field label=${t("סוג קיר")}><select aria-label=${t("סוג קיר")} data-wall-kind @change=${s=>a.setWallDefaults({...e,kind:s.target.value})}>
      ${Object.keys(q).map(s=>r`<option value=${s} ?selected=${e.kind===s}>${he(s)}</option>`)}
    </select></sw-field>
  </div>`}function Sa(e,a){const s=n=>a.setGlassDraw?.({...e,...n});return r`<div class="modes" role="group" aria-label=${g("shape")} data-glass-shape>
      <button class=${e.curved?"":"on"} data-glass-shape-straight aria-pressed=${!e.curved} @click=${()=>s({curved:!1})}>${g("shapeStraight")}</button>
      <button class=${e.curved?"on":""} data-glass-shape-curved aria-pressed=${e.curved} @click=${()=>s({curved:!0})}>${g("shapeCurved")}</button>
    </div>
    <div class="two">
      <sw-field label=${g("panelWidth")}><input type="number" data-ltr data-glass-draw-width min=${C[0]} max=${C[1]} step="0.05" .value=${String(e.panel_width_m)}
        @change=${n=>{const i=M(n);i>=C[0]&&i<=C[1]&&s({panel_width_m:i})}} /></sw-field>
      <sw-field label=${g("frameDepth")}><input type="number" data-ltr data-glass-draw-depth min="0.01" max="3" step="0.01" .value=${String(e.thickness_m)}
        @change=${n=>{const i=M(n);i>0&&i<=3&&s({thickness_m:i})}} /></sw-field>
    </div>`}function Xe(e,a,s){return e.length<2?u:r`<sw-field label=${t("מפלס")}><select data-item-level @change=${n=>s(n.target.value)}>${e.map(n=>r`<option value=${n.id} ?selected=${n.id===a}>${t("{name} ({elevation_m} מ׳)",{name:n.name,elevation_m:n.elevation_m})}</option>`)}</select></sw-field>`}function Te(e,a,s,n,i){if(a.kind==="wall"){const l=e.doc.walls.find(d=>d.id===a.id);return l?Ma(l,e,s,n,i):u}if(a.kind==="opening"){const l=e.doc.openings.find(d=>d.id===a.id);return l?Ea(l,e,s,n,i):u}const o=e.doc.labels.find(l=>l.id===a.id);return o?Da(o,e,s):u}function Ma(e,a,s,n,i){const o=Pe(e,a.W,a.H)*n,l=a.doc.openings.filter(p=>p.wall_id===e.id).length,d=Ct(e,a.W,a.H,n),$=Xt(e);return r`<div class="sel" data-selected-wall=${e.id}>
    <div class="selhead"><strong>${e.kind==="glass"?he(e.kind):t("קיר {v}",{v:q[e.kind]})}</strong><span class="muted">${I(o,i,a.showEstimates)} · ${y(l,t("פתח אחד"),t("פתחים"))}${d!==null?r` · ${k("area")} <span data-wall-area>${Ke(d,i,a.showEstimates)}</span>`:u}</span></div>
    ${qe(e)}
    ${e.external_ids?.origin==="door_tool"?r`<div class="note" data-wall-door-tool>${t('קטע קיר שנוסף עם דלת בכלי "סמן דלת": בדוק את עוביו ואת החיבור לקירות הסמוכים.')}</div>`:u}
    <div class="two">
      <sw-field label=${t("עובי (מ׳)")}><input type="number" min="0.01" max="3" step="0.01" data-ltr .value=${String(e.thickness_m)}
        @change=${p=>{const h=M(p);h>0&&h<=3&&s.patchWall(e.id,{thickness_m:h})}} /></sw-field>
      <sw-field label=${t("סוג")}><select aria-label=${t("סוג קיר")} data-selected-wall-kind ?disabled=${!!a.phone&&e.kind==="glass"} @change=${p=>s.patchWall(e.id,ce(e,p.target.value))}>
        ${Object.keys(q).map(p=>r`<option value=${p} ?selected=${e.kind===p} ?disabled=${!!a.phone&&p==="glass"&&e.kind!=="glass"}>${he(p)}</option>`)}
      </select></sw-field>
    </div>
    ${e.kind==="glass"?Ca(e,a,s,o):u}
    ${s.setMaterial&&a.materials&&e.kind!=="glass"?Be({key:`walls:${e.id}`,label:t("חומר הקיר"),host:"wall",value:e.material_id??null,defaultId:a.materials.walls[e.id]??"plaster_white",style:a.materialStyle??"light"},{pick:p=>s.setMaterial("walls",e.id,p),setStyle:p=>s.setMaterialStyle?.(p)}):u}
    <sw-field label=${t("גובה (מ׳, ריק = עד התקרה)")}><input type="number" min="0.1" max="50" step="0.1" data-ltr .value=${e.height_m===null?"":String(e.height_m)}
      @change=${p=>{const h=p.target.value.trim(),f=parseFloat(h);h?f>0&&f<=50&&s.patchWall(e.id,{height_m:f}):s.patchWall(e.id,{height_m:null})}} /></sw-field>
    ${Xe(a.levels,e.level_id,p=>s.setLevel(e.id,p))}
    ${Ye(e.tags,p=>s.patchWall(e.id,{tags:p}))}
    ${a.mode==="curve"?La(e,a,s,n):u}
    ${$?Aa(e,$.length,a,s):u}
    ${a.mode==="select"&&a.sel?.vertex!==void 0&&!$?r`<div class="note" data-selected-vertex=${a.sel.vertex}>${t("פינה {v} נבחרה: החצים מזיזים אותה (Shift = צעד גדול); {v2}",{v:a.sel.vertex+1,v2:Ot(e.polyline)?t("Delete מוחק את הפינה."):t("Delete מוחק את כל הקיר, כי בלי הפינה לא נשאר קיר.")})}</div>`:u}
    ${!a.phone&&!a.compact&&a.mode==="select"?r`<div class="btns"><sw-button size="sm" variant="ghost" data-wall-bend title=${k("tipCurve")} @click=${()=>s.setMode("curve")}>${k("bendOpen")}</sw-button></div>`:u}
    <div class="btns">${e.kind==="glass"?r`<sw-button size="sm" variant="ghost" data-wall-to-solid ?disabled=${!!a.phone} title=${a.phone?g("desktopOnly"):u} @click=${()=>s.patchWall(e.id,ce(e,ya))}>${g("toSolid")}</sw-button>`:r`<sw-button size="sm" variant="ghost" data-wall-to-glass ?disabled=${!!a.phone} title=${a.phone?g("desktopOnly"):u} @click=${()=>s.patchWall(e.id,ce(e,"glass"))}>${g("toGlass")}</sw-button>`}</div>
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>s.remove(e.id)}>${t("מחק קיר")}</sw-button><span class="note">${t("הפתחים שבקיר נמחקים איתו")}</span></div>
  </div>`}function Aa(e,a,s,n){const i=s.sel?.id===e.id&&s.sel.vertex!==void 0?Vt(e,s.sel.vertex):-1;return r`<div class="curvepts" data-curve-points=${a}>
    <div class="note">${k("pointsWall")} · ${a} ${k("points")}${i>=0?r` · <span data-curve-point-selected=${i}>${k("pointHandle")} ${i+1}</span>`:u}</div>
    ${s.phone?u:r`<div class="btns"><sw-button size="sm" variant="ghost" data-curve-add @click=${()=>n.addCurvePoint?.(e.id)}>${k("addPoint")}</sw-button>${i>=0?r`<sw-button size="sm" variant="ghost" data-curve-remove @click=${()=>n.removeCurvePoint?.(e.id,i)}>${k("removePoint")}</sw-button>`:u}</div>
        <div class="note">${k("pointsNote")}</div>`}
  </div>`}function La(e,a,s,n){const i=a.sel?.id===e.id?a.sel.segment:void 0,o=a.sel?.id===e.id?a.sel.vertex:void 0;if(i!==void 0&&i<e.polyline.length-1){const l=qt(e,i,a.W,a.H,n),d=Zt(e,i,a.W,a.H,n),$=p=>{const h=p.target,f=h.value.trim(),x=parseFloat(f);f?x>0&&s.setSegmentRadius?.(e.id,i,x):s.setSegmentRadius?.(e.id,i,null),h.value=l===null?"":l.toFixed(2)};return r`<div class="two" data-curve-segment=${i}>
      <sw-field label=${`${k("segment")} ${i+1} · ${k("radius")}`}><input type="number" min=${d.toFixed(2)} step="0.05" data-ltr data-segment-radius
        placeholder=${k("straight")} .value=${l===null?"":l.toFixed(2)} @change=${$} /></sw-field>
      <div class="btns"><sw-button size="sm" variant="ghost" data-segment-straighten ?disabled=${l===null} @click=${()=>s.setSegmentRadius?.(e.id,i,null)}>${k("straighten")}</sw-button></div>
    </div>`}if(o!==void 0&&Yt(e,o,a.W,a.H)){const l=Jt(e,o,a.W,a.H,n),d=Math.min(.5,l);return r`<div class="two" data-curve-corner=${o}>
      <sw-field label=${`${k("roundCorner")} ${o+1} · ${k("radius")}`}><input type="number" min="0.01" max=${l.toFixed(2)} step="0.05" data-ltr data-corner-radius
        .value=${d.toFixed(2)} /></sw-field>
      <div class="btns"><sw-button size="sm" data-corner-apply @click=${$=>{const p=$.currentTarget.closest("[data-curve-corner]")?.querySelector("input"),h=parseFloat(p?.value??String(d));h>0&&s.roundCorner?.(e.id,o,h)}}>${k("apply")}</sw-button></div>
    </div>`}return u}const E={range:[Ft,Pt]};function Ca(e,a,s,n){const i=Tt(e),o=Nt(n,i),l=!!a.phone,d=c=>s.patchWall(e.id,{glazing:Bt(e,c,n)}),$=(c,[b,w],v)=>{const _=M(c);Number.isFinite(_)&&_>=b&&_<=w&&v(_)},p=(c,b,w)=>{c.target.value.trim()?$(c,b,w):w(null)},h=new Set(i.operable.map(c=>c.panel)),f=c=>{const b=a.entityChoices??[];return c&&!b.some(w=>w.id===c)?[...b,{id:c,name:c}]:b},x=()=>{const[c,b]=E.range,w=Wt(e,n,Math.min(c,b),Math.max(c,b));w?s.patchWall(e.id,{glazing:w}):s.say?.(g("autoNone"))};return r`<div class="glazing" data-glazing-inspector=${e.id} data-glazing-panels=${o}>
    <div class="selhead"><strong>${g("glazing")}</strong><span class="muted" data-glazing-summary>${t("{n} {glassT} · {v} מ׳",{n:o,glassT:g("panels"),v:(n/o).toFixed(2)})}</span></div>
    <div class="two">
      <sw-field label=${g("panelWidth")}><input type="number" data-ltr data-glazing-width min=${C[0]} max=${C[1]} step="0.05" ?disabled=${l} .value=${String(i.panel_width_m)}
        @change=${c=>$(c,C,b=>d({panel_width_m:b,panel_count:null}))} /></sw-field>
      <sw-field label=${g("panelCount")}><input type="number" data-ltr data-glazing-count min="1" max="200" step="1" ?disabled=${l} placeholder=${g("panelCountAuto")} .value=${i.panel_count===null?"":String(i.panel_count)}
        @change=${c=>p(c,[1,200],b=>d({panel_count:b===null?null:Math.round(b)}))} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${g("autoMin")}><input type="number" data-ltr data-glazing-auto-min min="0.2" max="6" step="0.05" ?disabled=${l} .value=${String(E.range[0])}
        @change=${c=>$(c,C,b=>E.range=[b,E.range[1]])} /></sw-field>
      <sw-field label=${g("autoMax")}><input type="number" data-ltr data-glazing-auto-max min="0.2" max="6" step="0.05" ?disabled=${l} .value=${String(E.range[1])}
        @change=${c=>$(c,C,b=>E.range=[E.range[0],b])} /></sw-field>
    </div>
    <div class="btns"><sw-button size="sm" data-glazing-auto ?disabled=${l} title=${l?g("desktopOnly"):u} @click=${x}>${g("autoDivide")}</sw-button></div>
    <div class="two">
      <sw-field label=${g("mullion")}><input type="number" data-ltr data-glazing-mullion min=${ae[0]} max=${ae[1]} step="0.01" ?disabled=${l} .value=${String(i.mullion_m)}
        @change=${c=>$(c,ae,b=>d({mullion_m:b}))} /></sw-field>
      <sw-field label=${g("sill")}><input type="number" data-ltr data-glazing-sill min=${se[0]} max=${se[1]} step="0.05" ?disabled=${l} .value=${String(i.sill_m)}
        @change=${c=>$(c,se,b=>d({sill_m:b}))} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${g("glazedHeight")}><input type="number" data-ltr data-glazing-height min=${ie[0]} max=${ie[1]} step="0.05" ?disabled=${l} placeholder=${g("glazedHeightAuto")} .value=${i.glazed_height_m===null?"":String(i.glazed_height_m)}
        @change=${c=>p(c,ie,b=>d({glazed_height_m:b}))} /></sw-field>
      <sw-field label=${g("tint")}><select data-glazing-tint ?disabled=${l} @change=${c=>d({tint:c.target.value})}>
        ${jt.map(c=>r`<option value=${c} ?selected=${i.tint===c}>${ca(c)}</option>`)}</select></sw-field>
    </div>
    <sw-field label=${g("operable")}><div class="panelchips" role="group" aria-label=${g("operable")} data-glazing-chips>
      ${Array.from({length:o},(c,b)=>r`<button type="button" class=${h.has(b)?"on":""} data-glazing-panel=${b} aria-pressed=${h.has(b)?"true":"false"} ?disabled=${l}
        aria-label=${`${g("panel")} ${b+1}`} @click=${()=>s.patchWall(e.id,{glazing:Rt(i,b)})}>${b+1}</button>`)}
    </div></sw-field>
    ${i.operable.map(c=>r`<div class="two" data-operable-row=${c.panel}>
      <sw-field label=${`${g("panel")} ${c.panel+1} · ${g("operation")}`}><select data-operable-operation ?disabled=${l}
        @change=${b=>s.patchWall(e.id,{glazing:Oe(i,c.panel,{operation:b.target.value})})}>
        ${Ht.map(b=>r`<option value=${b} ?selected=${c.operation===b}>${ua(b)}</option>`)}</select></sw-field>
      <sw-field label=${g("entity")}><select data-operable-entity ?disabled=${l}
        @change=${b=>{const w=b.target.value;s.patchWall(e.id,{glazing:Oe(i,c.panel,{anchor_ref:w?{resource_type:"ha_entity",resource_id:w}:null})})}}>
        <option value="" ?selected=${!c.anchor_ref}>${g("noEntity")}</option>
        ${f(c.anchor_ref?.resource_id??null).map(b=>r`<option value=${b.id} ?selected=${c.anchor_ref?.resource_id===b.id}>${b.name}</option>`)}
      </select></sw-field>
    </div>`)}
  </div>`}function Oa(e,a,s,n,i){const o=a.doc.walls.find(x=>x.id===e.wall_id),l=o?Pe(o,a.W,a.H)*n:0;if(!(l>0))return u;const[d,$]=Gt(e.width_m,l),p=x=>i?(x*100).toFixed(1):(x*l).toFixed(2),h=x=>{const c=x.target,b=parseFloat(c.value),w=Number.isFinite(b)?Math.min($,Math.max(d,i?b/100:b/l)):e.t;w!==e.t&&s.patchOpening(e.id,{t:w}),c.value=p(w)},f=t("חצים מזיזים את הפתח לכיוון החץ לאורך הקיר.");return i?r`<sw-field label=${t("מיקום על הקיר (%)")} hint=${t("מרכז הפתח: 0 = תחילת הקיר, 100 = סופו. {keys}",{keys:f})}><input type="number" min="0" max="100" step="0.1" data-ltr data-opening-percent
        aria-label=${t("מיקום על הקיר (%)")} .value=${p(e.t)} @change=${h} /></sw-field>`:r`<sw-field label=${t("מרחק מתחילת הקיר (מ׳)")} hint=${t("עד מרכז הפתח; אורך הקיר {lengthM} מ׳. {keys}",{lengthM:l.toFixed(2),keys:f})}><input type="number" min=${(d*l).toFixed(2)} max=${($*l).toFixed(2)} step="0.01"
        data-ltr data-opening-distance aria-label=${t("מרחק מתחילת הקיר (מ׳)")} .value=${p(e.t)} @change=${h} /></sw-field>`}function Ea(e,a,s,n,i){return r`<div class="sel" data-selected-opening=${e.id}>
    <div class="selhead"><strong>${U[e.kind]}</strong><span class="muted">${t("{width_m} מ׳ רוחב{v}",{width_m:e.width_m.toFixed(2),v:e.anchor_ref?t(" · מקושר לישות"):""})}</span></div>
    ${qe(e)}
    <div class="two">
      <sw-field label=${t("סוג")}><select aria-label=${t("סוג פתח")} @change=${o=>s.patchOpening(e.id,Et(o.target.value))}>
        ${Object.keys(U).map(o=>r`<option value=${o} ?selected=${e.kind===o}>${U[o]}</option>`)}
      </select></sw-field>
      <sw-field label=${t("רוחב (מ׳)")}><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(e.width_m)}
        @change=${o=>{const l=M(o);l>0&&l<=10&&s.patchOpening(e.id,{width_m:l})}} /></sw-field>
    </div>
    ${Oa(e,a,s,n,i)}
    <div class="two">
      <sw-field label=${t("גובה (מ׳)")}><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(e.height_m)}
        @change=${o=>{const l=M(o);l>0&&l<=10&&s.patchOpening(e.id,{height_m:l})}} /></sw-field>
      ${e.kind==="window"?r`<sw-field label=${t("גובה אדן (מ׳)")}><input type="number" min="0" max="10" step="0.05" data-ltr .value=${String(e.sill_m)}
            @change=${o=>{const l=M(o);l>=0&&l<=10&&s.patchOpening(e.id,{sill_m:l})}} /></sw-field>`:u}
    </div>
    ${e.kind==="door"?r`<div class="two">
          <sw-field label=${t("כיוון פתיחה")}><select aria-label=${t("כיוון פתיחה")} @change=${o=>s.patchOpening(e.id,{swing:o.target.value})}>
            ${Object.keys(Ee).map(o=>r`<option value=${o} ?selected=${e.swing===o}>${Ee[o]}</option>`)}
          </select></sw-field>
          <sw-field label=${ue(e.swing)?t("צד הפתיחה"):t("ציר")}><select aria-label=${ue(e.swing)?t("צד הפתיחה"):t("ציר")} data-opening-hinge @change=${o=>s.patchOpening(e.id,{hinge:o.target.value})}>
            ${Object.keys(De).map(o=>r`<option value=${o} ?selected=${e.hinge===o}>${(ue(e.swing)?_a:De)[o]}</option>`)}
          </select></sw-field>
        </div>`:u}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>s.remove(e.id)}>${t("מחק {v}",{v:U[e.kind]})}</sw-button></div>
  </div>`}function Da(e,a,s){return r`<div class="sel" data-selected-label=${e.id}>
    <sw-field label=${t("טקסט")}><input type="text" maxlength="80" data-label-text .value=${e.text}
      @change=${n=>{const i=n.target.value.trim();i&&s.patchLabel(e.id,{text:i})}} /></sw-field>
    <sw-field label=${t("גודל")}><input type="number" min="6" max="200" step="1" data-ltr .value=${String(e.size)}
      @change=${n=>{const i=M(n);i>=6&&i<=200&&s.patchLabel(e.id,{size:i})}} /></sw-field>
    ${Xe(a.levels,e.level_id,n=>s.setLevel(e.id,n))}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>s.remove(e.id)}>${t("מחק תווית")}</sw-button></div>
  </div>`}function Ia(e,a,s){return r`<div class="issues" data-studio-issues>
    <div class="ilbl">${e.length?t("{errorsCount} שגיאות חוסמות פרסום",{errorsCount:e.length}):t("אין שגיאות חוסמות")}${a.length?t(" · {warningsCount} אזהרות",{warningsCount:a.length}):""}</div>
    ${[...e,...a].slice(0,20).map(n=>r`<button class="issue ${n.severity}" data-issue=${n.code} data-issue-id=${n.id??""} ?disabled=${!n.id} @click=${()=>{n.id&&s.focus(n.id)}}>${n.message}</button>`)}
  </div>`}function Ta(e,a,s){return r`<div class="copy" data-copy-candidates>
    <div class="ilbl">${t("להתחיל ממבנה קיים?")}</div>
    ${e.map(n=>r`<button class="issue" data-copy-from=${n.version_id} ?disabled=${s} @click=${()=>a.copyFrom(n.version_id)}>
      <span>${t("העתק {countLabel} ו{v}{countLabel2} מגרסה {v2}",{countLabel:y(n.walls,t("קיר אחד"),t("קירות")),v:n.openings===1?"":t("־"),countLabel2:y(n.openings,t("פתח אחד"),t("פתחים")),v2:n.status==="published"?t("מפורסמת"):n.status==="draft"?t("בטיוטה"):t("מהארכיון")})}</span>
      <span class="muted">${n.same_drawing?t("אותו שרטוט"):t("שרטוט אחר: המיקומים לא מיושרים, בדוק אותם")}</span>
    </button>`)}
  </div>`}function xs(e,a,s,n,i,o){const l=parseFloat(e.metres),d=e.pixels!==null&&e.pixels<5,$=e.pairs??[],p=!!e.a&&!!e.b&&e.pixels!==null&&e.pixels>=5&&l>0&&l<=1e3,h=(p||$.length>0)&&!e.busy,f=p&&$.length<3&&!e.busy&&!!i,x=e.showEstimates?t("התוכנית לא מכוילת: מידות מוצגות כמשוערות (≈)"):t("התוכנית לא מכוילת: מידות מוסתרות עד הכיול (הגדרות)");return r`<sw-card heading=${t("כיול קנה מידה")} subheading=${e.estimated?x:t("מכויל · {fmtScale}",{fmtScale:j(e.scale)})} data-calib-panel>
    <ol class="steps">
      <li class=${e.a?"done":""}>${t("לחץ על נקודה שהמרחק ממנה ידוע, למשל פינת קיר")}</li>
      <li class=${e.b?"done":""}>${t("לחץ על הנקודה השנייה")}</li>
      <li>${t("הקלד את המרחק האמיתי ביניהן")}</li>
    </ol>
    <sw-field label=${t("מרחק (מ׳)")}><input type="number" min="0.01" max="1000" step="0.01" data-ltr data-calib-metres .value=${e.metres} ?disabled=${!e.b}
      @input=${c=>a(c.target.value)} /></sw-field>
    ${e.pixels!==null?r`<div class=${d?"note err":"note"}>${t("{pixels} פיקסלים בתוכנית{v}",{pixels:e.pixels.toFixed(0),v:d?t(" · הנקודות קרובות מדי"):l>0?t(" · 1 מ׳ = {v} פיקסלים",{v:(e.pixels/l).toFixed(1)}):""})}</div>`:u}
    ${$.length?r`<div class="note" data-calib-pairs>${t("זוגות שנמדדו:")} ${$.map((c,b)=>r`<span class="pair" data-calib-pair=${b}>${t("{metres} מ׳ / {pixels} px",{metres:c.metres,pixels:c.pixels.toFixed(0)})}${o?r` <button type="button" class="x" aria-label=${t("הסר זוג")} data-calib-drop=${b} @click=${()=>o(b)}>×</button>`:u}</span>`)}</div>`:u}
    <div class="btns">
      <sw-button variant="primary" size="sm" icon="check" data-calib-save ?disabled=${!h} @click=${s}>${t("שמור כיול{v}",{v:$.length?t(" ({v} זוגות)",{v:$.length+(p?1:0)}):""})}</sw-button>
      ${i?r`<sw-button size="sm" icon="plus" data-calib-add ?disabled=${!f} title=${t("עד ארבעה זוגות; הממוצע משוקלל לפי האורך ומוצגת הסטייה")} @click=${i}>${t("זוג נוסף")}</sw-button>`:u}
      <sw-button variant="ghost" size="sm" data-calib-reset @click=${n}>${t("נקה נקודות")}</sw-button>
    </div>
    ${e.result?r`<div class="note" data-calib-result>${e.result}</div>`:u}
    ${e.warning?r`<div class="err" data-calib-warning>${e.warning}</div>`:u}
    <div class="note">${t("המיקומים על המפה לא זזים, רק המטרים משתנים. הכיול נכנס לטיוטת המבנה והצופים רואים אותו אחרי פרסום.")}</div>
  </sw-card>`}function ks(e,a,s,n,i,o,l){const d=e.length>1?wt(e,a,s)*n:0,$=t(i?o?"לא מכויל: הערכים משוערים (≈)":"לא מכויל: המידות מוסתרות עד הכיול (הגדרות)":"לפי הכיול של גרסת התוכנית");return r`<sw-card heading=${t("מדידה")} subheading=${$} data-measure-panel>
    <div class="note">${t("לחץ נקודות על התוכנית. Shift מבטל הצמדה לזוויות, Esc מנקה.")}</div>
    <div class="measure-val" data-measure-distance>${e.length>1?I(d,i,o):"—"}</div>
    ${e.length>=3?r`<div class="note">${t("שטח המצולע")} <span class="measure-val" data-measure-area>${Ke(ft(e,a,s,n),i,o)}</span> ${t("· היקף {fmtMetres}",{fmtMetres:I(vt(e,a,s,n),i,o)})}</div>`:u}
    <div class="btns"><sw-button variant="ghost" size="sm" data-measure-clear ?disabled=${!e.length} @click=${l}>${t("נקה")}</sw-button></div>
  </sw-card>`}const Na=[{key:"sectionLines",attr:"section",label:t("קווי חתך החוצים את המבנה אינם קירות")},{key:"joinGaps",attr:"join",label:t("רווח קטן מ־30 ס״מ בלי סימון - קיר אחד")},{key:"stepsRegions",attr:"steps",label:t("הצע טריבונה משורות מקבילות")},{key:"columns",attr:"columns",label:t("הצע עמודים וקו מעטפת ביניהם")}],K={wall:t("קיר"),door:t("דלת"),window:t("חלון"),passage:t("מעבר")},Fa={wall:t("רק קירות"),door:t("רק דלתות"),window:t("רק חלונות"),passage:t("רק מעברים")},Pa={auto:t("זוהה אוטומטית"),imported:t("יובא מ־DXF")},pe=300,ja=e=>Math.max(.3,Math.round((e-.2)*100)/100);function qe(e){return e.source==="manual"?u:r`<span class="badge" data-auto-badge=${e.source}>${t("{v} · ביטחון {confidence}",{v:Pa[e.source]??e.source,confidence:e.confidence.toFixed(2)})}</span>`}function Ne(e,a){return e.walls.some(s=>s.id===a)?"wall":e.openings.find(s=>s.id===a)?.kind??"wall"}function $e(e,a){return e.walls.find(s=>s.id===a)?.confidence??e.openings.find(s=>s.id===a)?.confidence??0}function Ra(e,a,s){const n=a.walls.find(o=>o.id===s);if(n)return t("עובי {fmtMetres}",{fmtMetres:I(n.thickness_m,e.estimated,e.showEstimates)});const i=a.openings.find(o=>o.id===s);return i?t("רוחב {fmtMetres}",{fmtMetres:I(i.width_m,e.estimated,e.showEstimates)}):""}function ys(e,a){const s=e.cands,n=e.opts;return r`<sw-card heading=${t("זיהוי אוטומטי")} subheading=${t("קירות, דלתות וחלונות מהתוכנית · עיבוד מקומי, ללא AI וללא שליחה החוצה")} data-detect-panel data-detect-state=${e.run.busy?"running":s?"candidates":"idle"} aria-busy=${e.run.busy||e.busy?"true":"false"}>
    ${s?Ga(e,s,a):r`<div class="note">${t('הזיהוי מציע מועמדים בשכבה נפרדת (כחול מקווקו). דבר לא נשמר עד "אשר", ודבר לא מתפרסם בלי פרסום.')}</div>
          <div class="chks">
            <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t("קירות")} data-detect-walls .checked=${n.walls} @change=${i=>{const o=L(i);a.setOpts({...n,walls:o,openings:o&&n.openings})}}></sw-toggle> ${t("קירות")}</label>
            <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t("פתחים (דלתות, חלונות, מעברים)")} data-detect-openings .checked=${n.openings} ?disabled=${!n.walls} @change=${i=>a.setOpts({...n,openings:L(i)})}></sw-toggle> ${t("פתחים (דלתות, חלונות, מעברים)")}</label>
            <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t("קירות חלולים (חיצוניים דקים)")} data-detect-hollow .checked=${n.hollow!==!1} ?disabled=${!n.walls} @change=${i=>a.setOpts({...n,hollow:L(i)})}></sw-toggle> ${t("קירות חלולים (חיצוניים דקים)")}</label>
            ${Na.map(i=>r`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${i.label} data-detect-rule=${i.attr} .checked=${n[i.key]!==!1} ?disabled=${!n.walls} @change=${o=>a.setOpts({...n,[i.key]:L(o)})}></sw-toggle> ${i.label}</label>`)}
          </div>
          <sw-field label=${t("עוצמת ניקוי: {strength} (קל ← חזק)",{strength:n.strength.toFixed(2)})}><input type="range" min="0.3" max="1" step="0.05" data-detect-strength .value=${String(n.strength)}
            @input=${i=>a.setOpts({...n,strength:parseFloat(i.target.value)})} /></sw-field>
          ${e.autoInDraft?r`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t("החלף אוטומטיים קודמים")} data-detect-replace .checked=${n.replaceAuto} @change=${i=>a.setOpts({...n,replaceAuto:L(i)})}></sw-toggle> ${t("החלף אוטומטיים קודמים ({autoInDraft} בטיוטה)",{autoInDraft:e.autoInDraft})}</label>`:u}
          ${e.autoRemovable&&a.removeAuto?Ha(e,a):u}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="sparkle" data-detect-run aria-busy=${e.run.busy?"true":"false"} ?disabled=${e.run.busy||!n.walls||e.busy} @click=${()=>a.run()}>${e.run.busy?r`${t("מזהה…")} <span data-detect-elapsed>${e.run.elapsed}</span> ${t("שנ׳")}`:t("זהה אוטומטית")}</sw-button>
            ${e.run.busy?r`<span class="note">${t("הזיהוי רץ בשרת{v}; הכפתור ייפתח כשיסיים.",{v:e.run.limitS?t(" (עד {limitS} שניות)",{limitS:e.run.limitS}):""})}</span>`:u}
          </div>
          ${e.run.error?r`<div class="err" role="alert" data-detect-error=${e.run.timedOut?"detect_timeout":"failed"}>${e.run.error}</div>
                ${e.run.timedOut&&n.strength>.3?r`<div class="btns"><sw-button size="sm" icon="refresh" data-detect-retry ?disabled=${e.run.busy||e.busy} @click=${()=>a.retryLighter()}>${t("נסה שוב בעוצמה {v}",{v:ja(n.strength).toFixed(2)})}</sw-button></div>`:u}`:u}`}
  </sw-card>`}function Ha(e,a){const s=e.autoRemovable??0;return e.removeAutoAsk?r`<div class="note" role="alert" data-detect-remove-auto-ask>${t("להסיר מהטיוטה {n} פריטים שזוהו אוטומטית? פריטים שצוירו ביד, יובאו או ננעלו נשארים. אפשר להחזיר בביטול שינוי (Ctrl+Z).",{n:s})}</div>
        <div class="btns">
          <sw-button variant="danger" size="sm" icon="trash" data-detect-remove-auto-confirm ?disabled=${e.busy||e.run.busy} @click=${()=>a.removeAuto?.("confirm")}>${t("הסר {n} פריטים",{n:s})}</sw-button>
          <sw-button variant="ghost" size="sm" data-detect-remove-auto-cancel @click=${()=>a.removeAuto?.("cancel")}>${t("ביטול")}</sw-button>
        </div>`:r`<div class="btns"><sw-button variant="ghost" size="sm" icon="trash" data-detect-remove-auto ?disabled=${e.busy||e.run.busy} @click=${()=>a.removeAuto?.("ask")}>${t("הסר את כל מה שזוהה אוטומטית ({n})",{n:s})}</sw-button></div>`}function Ga(e,a,s){const n=a.set,i=[...n.walls.map(c=>c.id),...n.openings.map(c=>c.id)],l=["wall","door","window","passage"].filter(c=>c==="wall"?n.walls.length>0:n.openings.some(b=>b.kind===c)),d=a.sel&&i.includes(a.sel)?{id:a.sel,kind:Ne(n,a.sel),score:$e(n,a.sel)}:null,$=e.acceptError,p=new Set($?.ids??[]),h=a.existingAuto.walls+a.existingAuto.openings+(a.existingAuto.objects??0),f=a.source!=="detect"?t("מיובאים"):t("אוטומטיים"),x=a.source==="dxf"?t(" · מיובאים מ־DXF"):a.source==="ifc"?` · ${A("origin")}`:a.elapsedMs!==null?t(" · זוהו ב־{v} שנ׳",{v:(a.elapsedMs/1e3).toFixed(1)}):"";return r`<div class="note" data-detect-summary>${y(n.walls.length,t("קיר אחד"),t("קירות"))} · ${y(n.openings.length,t("פתח אחד"),t("פתחים"))}${n.objects.length?` · ${y(n.objects.length,t("עצם אחד"),t("עצמים"))}`:""} · <span data-detect-accepted>${e.acceptedCount}</span> ${t("מסומנים לאישור{origin}",{origin:x})}</div>
    ${Se(n)?r`<div class="note warn" data-detect-outside-main>${Se(n)}</div>`:u}
    ${a.ifc?r`<div class="note" data-ifc-summary>${la(a.ifc)}</div>
      ${a.ifc.skipped_total?r`<ul class="note ifc-skipped" data-ifc-skipped>${ra(a.ifc).map(c=>r`<li>${c}</li>`)}</ul>`:u}`:u}
    ${i.length?u:r`<div class="note" data-detect-empty>${t('לא נמצאו קירות. נסה עוצמת ניקוי אחרת, או צייר בכלי "מבנה".')}</div>`}
    ${a.hint&&e.estimated&&e.canEstimate&&!e.hintApplied?r`<div class="hint" data-calib-hint>
          <div>${t("התוכנית לא מכוילת. לפי רוחב דלת אופייני (0.9 מ׳, {countLabel}):",{countLabel:y(a.hint.doors,t("דלת אחת"),t("דלתות"))})} <strong>${j(a.hint.scale_m_per_px)}</strong> ${t("— משוער.")}</div>
          <div class="btns"><sw-button size="sm" icon="scale" data-calib-hint-apply ?disabled=${e.busy} @click=${()=>s.applyHint()}>${t("השתמש בהערכה")}</sw-button><span class="note">${t("מומלץ לפני האישור: המידות במטרים של המועמדים יחושבו לפי ההערכה, ויוצגו עם ≈ עד כיול בשתי נקודות")}</span></div>
        </div>`:e.hintApplied?r`<div class="note" data-calib-hint-applied>${t("קנה מידה משוער נשמר (≈ {fmtScale}); כיול בשתי נקודות יחליף אותו",{fmtScale:j(e.scale)})}</div>`:u}
    <div class="modes" role="group" aria-label=${t("קבלת מועמדים")}>
      <button data-detect-accept-all ?disabled=${e.busy} @click=${()=>s.acceptAll()}>${t("קבל הכול")}</button>
      <button data-detect-accept-conf ?disabled=${e.busy} @click=${()=>s.acceptAbove(.8)}>${t("קבל מעל 0.8")}</button>
      ${l.map(c=>r`<button data-detect-accept-kind=${c} ?disabled=${e.busy} @click=${()=>s.acceptKinds([c])}>${Fa[c]}</button>`)}
      <button data-detect-reject-all ?disabled=${e.busy} @click=${()=>s.rejectAll()}>${t("דחה הכול")}</button>
    </div>
    <div class="note">${e.narrow?r`<span data-detect-phone-note>${t("בטלפון אפשר לקבל או לדחות מועמדים; תיקון קצוות של קיר מועמד זמין במסך רחב.")}</span>`:t("לחיצה על מועמד במפה או על התיבה ברשימה מקבלת / דוחה אותו; גרירת קצה של הקיר המסומן מתקנת אותו לפני האישור.")}</div>
    <div class="dlist" data-cand-list>
      ${i.slice(0,pe).map(c=>{const b=Ne(n,c),w=a.states[c]??"accepted";return r`<div class="dcand ${w} ${c===a.sel?"on":""} ${p.has(c)?"bad":""}" data-cand-row=${c} data-cand-state=${w} ?data-cand-bad=${p.has(c)}>
          <input type="checkbox" aria-label=${t("קבל {v}",{v:K[b]})} .checked=${w==="accepted"} ?disabled=${e.busy} @change=${()=>s.toggle(c)} />
          <button class="linkbtn" aria-label=${`${K[b]} ${$e(n,c).toFixed(2)}${ee(n,c)?` ${Q}`:""}`} @click=${()=>s.focus(c)}>${K[b]}</button>
          ${ee(n,c)?r`<span class="outside" data-cand-outside-main>${Q}</span>`:u}
          <span class="muted ltr" aria-hidden="true">${$e(n,c).toFixed(2)}</span>
        </div>`})}
      ${i.length>pe?r`<div class="note">${t("מוצגים {CAND_ROWS} הראשונים ברשימה; במפה מוצגים כולם.",{CAND_ROWS:pe})}</div>`:u}
    </div>
    ${d?r`<div class="note" data-cand-selected=${d.id}>${t("{v} נבחר{v2} · ביטחון {score} · {candSize} · {v3}",{v:K[d.kind],v2:ee(n,d.id)?` · ${Q}`:"",score:d.score.toFixed(2),candSize:Ra(e,n,d.id),v3:(a.states[d.id]??"accepted")==="accepted"?t("יאושר"):t("נדחה")})}</div>`:u}
    ${n.objects.length?r`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t("כולל {objectsSummary}",{objectsSummary:Me(n,a.source)})} data-detect-objects .checked=${e.objectsOn} @change=${c=>s.setObjects(L(c))}></sw-toggle> ${t("כולל {objectsSummary}",{objectsSummary:Me(n,a.source)})}</label>`:u}
    ${h?r`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t("החלף {earlier} קודמים",{earlier:f})} data-detect-replace .checked=${e.opts.replaceAuto} @change=${c=>s.setOpts({...e.opts,replaceAuto:L(c)})}></sw-toggle> ${t("החלף {earlier} קודמים ({existing} בטיוטה)",{earlier:f,existing:h})}</label>`:u}
    ${a.rooms?r`<div class="btns"><sw-button size="sm" icon="map" data-detect-rooms ?disabled=${e.busy} @click=${()=>s.importRooms()}>${t("ייבא {countLabel} כאזורים",{countLabel:y(a.rooms,t("חדר אחד"),t("חדרים"))})}</sw-button><span class="note">${t("החדרים נשמרים כאזורים, לא כחלק מהמבנה")}</span></div>`:u}
    ${$?r`<div class="err" role="alert" data-detect-accept-error=${$.code}>${$.message}</div>
          ${$.issues.length?r`<div class="issues" data-detect-issues>${$.issues.slice(0,20).map(c=>r`<button class="issue error" ?disabled=${!c.id||!i.includes(c.id)} @click=${()=>{c.id&&s.focus(c.id)}}>${c.message}</button>`)}</div>`:u}
          ${$.stale?r`<div class="btns"><sw-button size="sm" icon="refresh" data-detect-reload ?disabled=${e.busy} @click=${()=>s.reload()}>${t("טען את הטיוטה מחדש")}</sw-button><span class="note">${t("המועמדים נשארים; אחרי הטעינה אשר שוב")}</span></div>`:u}`:u}
    ${e.ask?r`<div class="hint" data-detect-replace-confirm>
          <div><strong>${t("להחליף את ה{earlier} הקודמים?",{earlier:f})}</strong></div>
          <div data-detect-replace-counts>${t("יוסרו מהטיוטה {countLabel} ו־{countLabel2}{v} {earlier} שנוספו קודם (פריטים נעולים נשארים).",{countLabel:y(e.ask.existing.walls,t("קיר אחד"),t("קירות")),countLabel2:y(e.ask.existing.openings,t("פתח אחד"),t("פתחים")),v:e.ask.existing.objects?t(" ו־{countLabel}",{countLabel:y(e.ask.existing.objects,t("עצם אחד"),t("עצמים"))}):"",earlier:f})}</div>
          ${e.ask.manualOnAuto?r`<div class="err" data-detect-replace-manual>${t("{countLabel} על קירות אלה {v} איתם.",{countLabel:y(e.ask.manualOnAuto,t("פתח ידני אחד"),t("פתחים ידניים")),v:e.ask.manualOnAuto===1?t("יוסר"):t("יוסרו")})}</div>`:r`<div class="note">${t("פתח ידני שיושב על קיר שיוסר — יוסר איתו.")}</div>`}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="check" data-detect-replace-go ?disabled=${e.busy} @click=${()=>s.confirmReplace()}>${t("החלף ואשר {acceptedCount}",{acceptedCount:e.acceptedCount})}</sw-button>
            <sw-button variant="ghost" size="sm" data-detect-replace-cancel ?disabled=${e.busy} @click=${()=>s.cancelReplace()}>${t("חזור")}</sw-button>
          </div>
        </div>`:r`<div class="btns">
          <sw-button variant="primary" size="sm" icon="check" data-detect-confirm ?disabled=${e.busy||!e.acceptedCount} @click=${()=>s.confirm()}>${t("אשר {acceptedCount}",{acceptedCount:e.acceptedCount})}</sw-button>
          <sw-button variant="ghost" size="sm" data-detect-discard ?disabled=${e.busy} @click=${()=>s.discard()}>${t("בטל")}</sw-button>
        </div>`}
    <div class="note">${t("האישור מוסיף לטיוטת המבנה בלבד (Ctrl+Z מבטל); הצופים יראו את התוצאה אחרי פרסום.")}</div>`}const be=60;let N=null;function Wa(e,a,s){if(N&&N.pool===e&&N.q===a&&N.category===s)return N.found;const n=Ut(e,a,s);return N={pool:e,q:a,category:s,found:n},n}function _s(e,a){const s=e.category==="recent"||e.category==="favorites",n=e.category==="recent"?e.recent.map(l=>e.lib.items.find(d=>d.id===l)).filter(l=>!!l):e.category==="favorites"?e.lib.items.filter(l=>e.favorites.includes(l.id)):e.lib.items,i=Wa(n,e.q,s?null:e.category),o=i.slice(0,be);return r`<sw-card heading=${t("ספריית עצמים")} subheading=${e.placing?t("לחץ על התוכנית כדי להציב: {he} · Esc לביטול",{he:e.placing.names.he}):t("{itemsCount} פריטים · חיפוש בעברית ובאנגלית",{itemsCount:e.lib.items.length})} data-library-panel data-studio-save=${e.saveState}>
    <sw-field><input type="search" data-lib-search placeholder=${t("חיפוש: כיסא, מטף, bleachers…")} .value=${e.q} @input=${l=>a.setQuery(l.target.value)} /></sw-field>
    <div class="modes" role="group" aria-label=${t("קטגוריות")}>
      <button class=${e.category===null?"on":""} data-lib-cat="all" @click=${()=>a.setCategory(null)}>${t("הכול")}</button>
      <button class=${e.category==="recent"?"on":""} data-lib-cat="recent" @click=${()=>a.setCategory("recent")}>${t("לאחרונה")}</button>
      <button class=${e.category==="favorites"?"on":""} data-lib-cat="favorites" @click=${()=>a.setCategory("favorites")}>${t("מועדפים")}</button>
      ${e.lib.categories.map(l=>r`<button class=${e.category===l.id?"on":""} data-lib-cat=${l.id} @click=${()=>a.setCategory(l.id)}>${l.he}</button>`)}
    </div>
    ${e.placing?r`<div class="btns"><sw-button size="sm" variant="ghost" data-lib-cancel @click=${()=>a.cancelPlacing()}>${t("סיים הצבה")}</sw-button></div>`:u}
    <div class="list libl">
      ${o.length?o.map(l=>r`<div class="libitem ${e.placing?.id===l.id?"on":""}" data-lib-item=${l.id} role="button" tabindex="0" draggable="true" title=${t("{he} · {w_m}×{d_m}×{h_m} מ׳",{he:l.names.he,w_m:l.size.w_m,d_m:l.size.d_m,h_m:l.size.h_m})}
          @dragstart=${d=>d.dataTransfer?.setData("text/x-sw-item",l.id)} @click=${()=>a.pick(l)} @keydown=${d=>(d.key==="Enter"||d.key===" ")&&a.pick(l)}>
          <span class="nm">${l.names.he}${l.custom?r` <span class="muted">${t("מותאם")}</span>`:u}</span>
          <span class="muted ltr">${l.size.w_m}×${l.size.d_m} m</span>
          <button class="fav ${e.favorites.includes(l.id)?"on":""}" data-lib-fav=${l.id} aria-label=${t("מועדף")} aria-pressed=${e.favorites.includes(l.id)?"true":"false"} @click=${d=>{d.stopPropagation(),a.toggleFavorite(l.id)}}><sw-icon name="star" size=${14}></sw-icon></button>
        </div>`):r`<div class="note">${e.category==="recent"?t("עדיין לא הוצבו פריטים בדפדפן הזה."):e.category==="favorites"?t("סמן את הכוכב ליד פריט כדי לשמור אותו כאן."):t("לא נמצאו פריטים.")}</div>`}
    </div>
    ${i.length>be?r`<div class="note" data-lib-more>${t("מוצגים {LIB_ROWS} · חפש או בחר קטגוריה",{LIB_ROWS:be})}</div>`:u}
    ${e.phone?r`<div class="note">${t("בטלפון: הצבה והזזה של עצם בודד; מערכים וציור קירות בדסקטופ.")}</div>`:u}
    ${e.canManage?r`<div class="exports" role="group" aria-label=${t("הספרייה המותאמת")}>
      <a class="btnlink" data-lib-export href=${e.exportHref} download>${t("ייצוא הספרייה המותאמת")}</a>
      <label class="btnlink">${t("ייבוא")}<input type="file" accept="application/json,.json" data-lib-import hidden @change=${l=>{const d=l.target.files?.[0];d&&a.importFile(d),l.target.value=""}} /></label>
    </div>`:u}
  </sw-card>`}function Ba(e,a,s,n,i){const o=e.params[a];if(s.type==="level")return r`<sw-field label=${s.he}><select data-object-param=${a} @change=${d=>i.patch(e.id,{params:{...e.params,[a]:d.target.value||null}})}>
      <option value="" ?selected=${!o}>${t("ללא")}</option>${n.filter(d=>d.id!==e.level_id).map(d=>r`<option value=${d.id} ?selected=${o===d.id}>${t("{name} ({elevation_m} מ׳)",{name:d.name,elevation_m:d.elevation_m})}</option>`)}</select></sw-field>`;const l=s.type==="int"?1:.1;return r`<sw-field label=${s.he}><input type="number" data-ltr data-object-param=${a} min=${String(s.min??"")} max=${String(s.max??"")} step=${String(l)} .value=${o==null?"":String(o)}
    @change=${d=>{const $=s.type==="int"?parseInt(d.target.value,10):parseFloat(d.target.value);Number.isFinite($)&&(s.min===void 0||$>=s.min)&&(s.max===void 0||$<=s.max)&&i.patch(e.id,{params:{...e.params,[a]:$}})}} /></sw-field>`}function zs(e,a){const s=e.o,n=e.item?.names.he??s.item_id,i=s.group_id?e.doc.groups.find(l=>l.id===s.group_id):void 0,o=(l,d)=>r`<sw-field label=${d}><input type="number" min="0.05" max="100" step="0.05" data-ltr ?data-object-w=${l==="w_m"} ?data-object-d=${l==="d_m"} ?data-object-h=${l==="h_m"} .value=${String(s.size[l])}
      @change=${$=>{const p=M($);p>=.05&&p<=100&&a.patch(s.id,{size:{...s.size,[l]:p}})}} /></sw-field>`;return r`<sw-card heading=${n} subheading=${e.item?`${e.lib_category(e.item)}${e.item.custom?t(" · פריט מותאם"):""}`:t("הפריט לא קיים בספרייה: העצם מצויר כתיבה")} data-selected-object=${s.id}>
    <sw-field label=${t("שם על המפה (אופציונלי)")}><input type="text" maxlength="80" data-object-label .value=${s.label??""} @change=${l=>a.patch(s.id,{label:l.target.value.trim()||null})} /></sw-field>
    ${s.anchor_ref?r`<div class="note" data-object-bound>${t("הגוף של {v}: המיקום, המצב וההרשאות מהעוגן.",{v:e.anchorName??s.anchor_ref.resource_id})} <button class="linkbtn" data-object-unbind @click=${()=>a.unbind(s.id)}>${t("נתק מהישות")}</button></div>`:u}
    <div class="two">
      <sw-field label=${t("מפלס")}><select data-item-level @change=${l=>a.patch(s.id,{level_id:l.target.value})}>${e.levels.map(l=>r`<option value=${l.id} ?selected=${l.id===s.level_id}>${l.name}</option>`)}</select></sw-field>
      <sw-field label=${t("סיבוב (°)")}><input type="number" min="0" max="359" step="1" data-ltr data-object-rotation .value=${String(Math.round(s.rotation_deg))} ?disabled=${!!s.anchor_ref}
        @change=${l=>{const d=M(l);Number.isFinite(d)&&a.patch(s.id,{rotation_deg:(Math.round(d)%360+360)%360})}} /></sw-field>
    </div>
    <div class="three">${o("w_m",t("רוחב (מ׳)"))}${o("d_m",t("עומק (מ׳)"))}${o("h_m",t("גובה (מ׳)"))}</div>
    <sw-field label=${t("גובה מהרצפה (מ׳)")}><input type="number" min="-50" max="500" step="0.05" data-ltr data-object-z .value=${String(s.z_m)} @change=${l=>{const d=M(l);d>=-50&&d<=500&&a.patch(s.id,{z_m:d})}} /></sw-field>
    ${e.item?Object.entries(e.item.params_schema).map(([l,d])=>Ba(s,l,d,e.levels,a)):u}
    ${a.setMaterial&&e.materialDefault?Be({key:`objects:${s.id}`,label:t("חומר"),host:"object",value:s.material_id??null,defaultId:e.materialDefault,style:e.materialStyle??"light"},{pick:l=>a.setMaterial(s.id,l),setStyle:l=>a.setMaterialStyle?.(l)}):u}
    ${Ye(s.tags,l=>a.patch(s.id,{tags:l}))}
    ${i?r`<div class="note" data-object-group>${t("חלק ממערך של {member_idsCount}",{member_idsCount:i.member_ids.length})}${a.selectGroup?r` · <button class="linkbtn" data-select-group @click=${()=>a.selectGroup?.(i.id)}>${t("בחר את המערך")}</button>`:u}</div>`:u}
    <div class="note">${t("{v} · חצים = הזזה עדינה (Shift = גדולה) · Alt+גרירה = שכפול · Delete = מחיקה",{v:e.estimated?e.showEstimates?t("המידות במטרים משוערות (≈) עד הכיול"):t("לא מכויל: המידות מוצגות כערכי הפריט"):t("המידות במטרים לפי הכיול")})}</div>
    <div class="btns">
      ${a.duplicate?r`<sw-button size="sm" icon="layers" data-object-duplicate title=${t("עותק ליד העצם, נבחר ומוכן לגרירה (גם Ctrl+D, או Alt+גרירה של העצם)")} @click=${()=>a.duplicate?.(s.id)}>${t("שכפל")}</sw-button>`:u}
      ${a.array?r`<sw-button size="sm" icon="grid" data-object-array ?disabled=${e.phone||!!s.anchor_ref||!!s.group_id} title=${e.phone?t("מערכים בדסקטופ בלבד"):s.group_id?t("העצם כבר במערך"):t("שורות × עמודות מהעצם הזה")} @click=${()=>a.array?.(s.id)}>${t("מערך")}</sw-button>`:u}
      ${e.canManage&&a.custom?r`<sw-button size="sm" icon="plus" data-object-custom @click=${()=>a.custom?.(s.id)}>${t("צור פריט מזה")}</sw-button>`:u}
      <sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>a.remove(s.id)}>${t("מחק")}</sw-button>
    </div>
  </sw-card>`}function Ss(e,a,s){const n=e.params;return r`<sw-card heading=${e.kind==="array"?t("מערך של {member_idsCount}",{member_idsCount:e.member_ids.length}):t("קבוצה של {member_idsCount}",{member_idsCount:e.member_ids.length})} subheading=${a?a.names.he:""} data-selected-group=${e.id}>
    ${e.kind==="array"&&n.rows?r`<div class="note">${t("{rows} שורות ×",{rows:n.rows})} ${n.cols} ${t("עמודות · רווח")} ${n.spacing_x_m} × ${n.spacing_y_m} ${t("מ׳")}</div>`:u}
    <div class="note">${t("גרירת אחד העצמים מזיזה את כל המערך · Delete מוחק (ושואל אם למחוק גם את העצמים)")}</div>
    <div class="btns">
      ${e.member_ids[0]?r`<sw-button size="sm" variant="ghost" data-group-first @click=${()=>s.select(e.member_ids[0])}>${t("בחר עצם אחד")}</sw-button>`:u}
      <sw-button size="sm" variant="danger" icon="trash" data-group-delete @click=${()=>s.askDelete(e.id)}>${t("מחק מערך")}</sw-button>
    </div>
  </sw-card>`}const Ua=t("Shift+לחיצה מוסיפה קיר, עצם או אזור לבחירה או מוציאה אותו ממנה; גרירת מלבן מרקע ריק בוחרת את מה שנמצא בתוכו במלואו; Ctrl+A בוחר את כל מה שמוצג במפלס; Esc מנקה. הזזת התוכנית: רווח + גרירה, או גרירה בכפתור האמצעי; גלגלת לזום."),Ka=[{title:t("בחירה"),items:[{keys:t("Shift+לחיצה"),desc:t("מוסיף פריט לבחירה או מוציא אותו ממנה")},{keys:t("גרירת מלבן מרקע ריק"),desc:t("בוחרת את כל מה שבתוכה במלואו")},{keys:"Ctrl+A",desc:t("בוחר את כל מה שמוצג במפלס הנוכחי")},{keys:"Esc",desc:t("מנקה את הבחירה, או סוגר את הפעולה הפתוחה")}]},{title:t("עריכה"),items:[{keys:"Delete / Backspace",desc:t("מוחק את מה שנבחר")},{keys:"Ctrl+D",desc:t("משכפל את מה שנבחר")},{keys:t("Alt+גרירה"),desc:t("גורר עותק, במקום להזיז את המקור")},{keys:t("חצים"),desc:t("מזיזים את הנבחר צעד קטן; Shift+חץ = צעד גדול")},{keys:"Ctrl+Z / Ctrl+Y",desc:t("ביטול וחזרה על הפעולה האחרונה")},{keys:"Ctrl+S",desc:t("שמירה")}]},{title:t("תצוגה וניווט"),items:[{keys:t("רווח+גרירה, או גרירה בכפתור האמצעי"),desc:t("מזיז את התוכנית (פאן)")},{keys:t("כפתור היד בסרגל העליון"),desc:t("מצב הזזה קבוע: כל גרירה מזיזה את התוכנית, עד לחיצה חוזרת עליו או Esc")},{keys:t("גלגלת העכבר"),desc:t("זום פנימה והחוצה סביב הסמן")}]},{title:t("כלים ספציפיים"),items:[{keys:t("ציור קיר (מבנה)"),desc:t("Enter מסיים את הקיר; Backspace/Delete מוחק את הנקודה האחרונה")},{keys:"D",desc:t("סמן דלת (כלי המבנה): לחיצה על סמל דלת מציעה אותה; Enter מאשר, Esc מבטל את ההצעה")},{keys:"R",desc:k("tipCurved")},{keys:"G",desc:g("toolTip")},{keys:"C",desc:k("tipCurve")},{keys:t("ציור אזור"),desc:t("לחיצה מוסיפה פינה; Enter מסיים משלוש פינות; Esc מבטל")},{keys:t("מפלסים ומחברים"),desc:t("Esc מבטל את נקודת ההתחלה שנבחרה למחבר")},{keys:t("מדידה / כיול"),desc:t("Esc מנקה את הנקודות שנבחרו עד כה")},{keys:t("זיהוי אוטומטי"),desc:t("Delete/Backspace מסיר מועמד נבחר; Esc סוגר וחוזר לכלי הבחירה")},{keys:t("מעגלי תאורה"),desc:t("Esc מבטל את סוג הגוף הממתין להצבה, ואז סוגר את מצב חברי המעגל")}]}];function Ms(e){return r`<sw-dialog open heading=${t("קיצורי מקלדת")} subheading=${t("כל הקיצורים הפעילים כרגע בעורך התוכנית")} data-shortcuts-dialog @close=${e}>
    <div class="shortcuts">
      ${Ka.map(a=>r`<div class="shortcuts-group" data-shortcuts-group=${a.title}>
          <h4>${a.title}</h4>
          ${a.items.map(s=>r`<div class="shortcuts-row" data-shortcuts-row><kbd>${s.keys}</kbd><span>${s.desc}</span></div>`)}
        </div>`)}
    </div>
    <sw-button slot="footer" variant="primary" data-shortcuts-close @click=${e}>${t("סגור")}</sw-button>
  </sw-dialog>`}function Ze(e,a,s){const n=l=>{const d=l?Mt(l.value):null;!l||!d||(a(d),l.value="")},i=!!(e.full||e.disabled),o=e.bulk?t("לחיצה על תגית מסירה אותה מכל הנבחרים שיש להם אותה (המספר: כמה מהם); תגית חדשה נוספת לכולם"):e.full?t("הגעת למקסימום של {TAG_MAX_COUNT} תגיות; לחיצה על תגית מסירה אותה",{TAG_MAX_COUNT:me}):t("לסימון ולבחירה מהירה (בחירה לפי תגית ליד המפלסים) · לחיצה על תגית מסירה אותה · עד {TAG_MAX_COUNT} תגיות של {TAG_MAX_LEN} תווים",{TAG_MAX_COUNT:me,TAG_MAX_LEN:Le});return r`<sw-field label=${e.bulk?t("תגיות בבחירה"):t("תגיות")} hint=${o}><div class="tagsfield" data-tags-field>
    ${e.chips.length?r`<div class="tagchips" data-tag-chips>${e.chips.map(l=>r`<sw-chip icon="close" data-tag=${l.tag} data-tag-count=${e.bulk&&l.count!==void 0?String(l.count):u} .count=${e.bulk?l.count:void 0}
          title=${e.bulk?t('הסר את "{tag}" מכל הנבחרים',{tag:l.tag}):t('הסר את התגית "{tag}"',{tag:l.tag})} @click=${()=>{e.disabled||s(l.tag)}}>${l.tag}</sw-chip>`)}</div>`:r`<div class="note" data-tag-none>${e.bulk?t("לאף פריט בבחירה אין תגיות"):t("אין תגיות")}</div>`}
    <div class="tagadd">
      <input type="text" maxlength=${String(Le)} data-tag-input aria-label=${e.bulk?t("תגית להוספה לכל הנבחרים"):t("תגית חדשה")} placeholder=${t("תגית חדשה, למשל: מטבח")} ?disabled=${i}
        @keydown=${l=>{l.key==="Enter"&&(l.preventDefault(),n(l.target))}} />
      <sw-button size="sm" icon="plus" data-tag-add ?disabled=${i} @click=${l=>n(l.currentTarget.parentElement?.querySelector("input"))}>${e.bulk?t("הוסף לכולם"):t("הוסף")}</sw-button>
    </div>
  </div></sw-field>`}function Ye(e,a){const s=n=>{n!==e&&!(e===void 0&&!n.length)&&a(n)};return Ze({chips:(e??[]).map(n=>({tag:n})),full:(e?.length??0)>=me},n=>s(St(e,n)),n=>s(zt(e,n)))}function As(e,a){return r`<select class="tagpick" data-tag-select aria-label=${t("בחירה לפי תגית")} title=${t("בוחר את כל הקירות, העצמים והאזורים עם התגית, במפלס המוצג")}
    @change=${s=>{const n=s.target,i=n.value;n.value="",i&&a(i)}}>
    <option value="" selected>${t("בחירה לפי תגית…")}</option>${e.map(s=>r`<option value=${s.tag}>${s.tag} (${s.count})</option>`)}
  </select>`}const Xa=[{mode:"left",label:t("יישור לשמאל"),title:t("הקצוות השמאליים של העצמים על הקצה השמאלי של הבחירה")},{mode:"right",label:t("יישור לימין"),title:t("הקצוות הימניים של העצמים על הקצה הימני של הבחירה")},{mode:"top",label:t("יישור למעלה"),title:t("הקצוות העליונים של העצמים על הקצה העליון של הבחירה")},{mode:"bottom",label:t("יישור למטה"),title:t("הקצוות התחתונים של העצמים על הקצה התחתון של הבחירה")},{mode:"center-y",label:t("מרכזים בקו אופקי"),title:t("מרכזי העצמים על קו אופקי אחד, באמצע הבחירה (למשל שורת מנורות)")},{mode:"center-x",label:t("מרכזים בקו אנכי"),title:t("מרכזי העצמים על קו אנכי אחד, באמצע הבחירה")}];function qa(e,a){if(e.alignable<2)return r``;const s=e.walls+e.zones,n=t("ביחס למסגרת של {alignable} העצמים שנבחרו · צעד ביטול אחד{v}",{alignable:e.alignable,v:s?t(" · קירות ואזורים שבבחירה לא זזים"):""});return r`<sw-field label=${t("יישור ופיזור העצמים")} hint=${n}><div class="alignbtns" data-multi-align>
    ${Xa.map(i=>r`<sw-button size="sm" variant="ghost" data-align=${i.mode} title=${i.title} ?disabled=${e.busy} @click=${()=>a.align(i.mode)}>${i.label}</sw-button>`)}
    <sw-button size="sm" variant="ghost" data-distribute="x" ?disabled=${e.busy||e.alignable<3} title=${e.alignable<3?t("פיזור צריך לפחות שלושה עצמים"):t("רווחים שווים בין העצמים לרוחב; הקיצוניים נשארים במקומם")} @click=${()=>a.distribute("x")}>${t("פיזור שווה לרוחב")}</sw-button>
    <sw-button size="sm" variant="ghost" data-distribute="y" ?disabled=${e.busy||e.alignable<3} title=${e.alignable<3?t("פיזור צריך לפחות שלושה עצמים"):t("רווחים שווים בין העצמים לגובה; הקיצוניים נשארים במקומם")} @click=${()=>a.distribute("y")}>${t("פיזור שווה לגובה")}</sw-button>
  </div></sw-field>`}const Za=[t("צפוף מאוד"),t("צפוף"),t("בינוני"),t("מרווח"),t("רחב"),t("רחב מאוד")];function Ls(e,a,s){const n=e.estimated&&!e.showEstimates,i=(l,d)=>n?Za[d]??I(l,!1):I(l,e.estimated),o=e.estimated?t("לפי קנה מידה משוער עד שהתוכנית תכויל"):t("לפי קנה המידה המכויל של התוכנית");return r`<div class="gridopts" data-grid-options>
    <label><sw-toggle size="sm" labelHidden in-label label=${t("רשת עזר")} data-grid-toggle .checked=${e.on} @change=${l=>a(L(l))}></sw-toggle> ${t("רשת עזר")}</label>
    <div class="note">${t("גרירה והצבה של עצם נצמדות לצמתי הרשת; Ctrl בזמן הגרירה - בלי הצמדה.")}</div>
    <sw-field label=${t("מרווח הרשת")} hint=${o}>
      <select data-grid-step ?disabled=${!e.on} @change=${l=>s(Number(l.target.value))}>
        ${e.steps.map((l,d)=>r`<option value=${String(l)} ?selected=${l===e.stepM}>${i(l,d)}</option>`)}
      </select>
    </sw-field>
    <div class="note">${t("בזמן גרירה של עצם מופיעים קווי יישור כשקצה או מרכז שלו מתיישר עם עצם אחר, והעצם נצמד אליהם.")}</div>
  </div>`}function Cs(e,a){const s=e.walls+e.objects+e.zones,n=[e.walls?y(e.walls,t("קיר אחד"),t("קירות")):"",e.objects?y(e.objects,t("עצם אחד"),t("עצמים")):"",e.zones?y(e.zones,t("אזור אחד"),t("אזורים")):""].filter(Boolean).join(" · ");return r`<sw-card heading=${t("{total} פריטים נבחרו",{total:s})} subheading=${`${n} · ${Z[e.saveState]}`} data-multi-panel data-multi-count=${s} data-studio-save=${e.saveState}>
    <div class="note">${t("גרירת אחד מהם מזיזה את כולם יחד · Delete מוחק את כולם · Ctrl+D משכפל את העצמים שבבחירה")}</div>
    ${e.zones?r`<div class="note" data-multi-zones-note>${t("הזזה, מחיקה, תגיות ומפלס של אזורים נשמרים מיד ואינם חלק מהביטול (Ctrl+Z); קירות ועצמים חוזרים בצעד ביטול אחד")}</div>`:u}
    ${e.note?r`<div class="note multinote" data-multi-note role="status">${e.note}</div>`:u}
    ${qa(e,a)}
    ${Ze({chips:e.tags,bulk:!0,disabled:e.busy},i=>a.addTag(i),i=>a.removeTag(i))}
    ${e.levels.length>1?r`<sw-field label=${t("העבר את כל הבחירה למפלס")} hint=${t("קירות ועצמים בצעד ביטול אחד; הפתחים עוברים עם הקיר שלהם")}>
          <select data-multi-level ?disabled=${e.busy} @change=${i=>{const o=i.target,l=o.value;o.value="",l&&a.setLevel(l)}}>
            <option value="" selected>${t("בחר מפלס…")}</option>${e.levels.map(i=>r`<option value=${i.id}>${t("{name} ({elevation_m} מ׳)",{name:i.name,elevation_m:i.elevation_m})}</option>`)}
          </select></sw-field>`:u}
    ${e.lights?r`<sw-field label=${t("הוסף למעגל תאורה")} hint=${e.lights===s?t("כל הנבחרים הם גופי תאורה"):t("רק {countLabel}; קירות, אזורים ועצמים אחרים לא",{countLabel:y(e.lights,t("גוף התאורה שבבחירה מצטרף"),t("גופי התאורה שבבחירה מצטרפים"))})}>
          ${e.circuits.length?r`<div class="tagchips" data-multi-circuits>${e.circuits.map(i=>r`<sw-chip dot=${ye(i.color_token)} data-multi-circuit=${i.id} title=${t("הוסף את גופי התאורה שבבחירה למעגל {name}",{name:i.name})} @click=${()=>{e.busy||a.joinCircuit(i.id)}}>${i.name}</sw-chip>`)}</div>`:r`<div class="note" data-multi-no-circuits>${t('אין עדיין מעגלים בקומה; צור מעגל בכלי "מעגלי תאורה".')}</div>`}
        </sw-field>`:u}
    <div class="btns">
      ${e.objects?r`<sw-button size="sm" icon="layers" data-multi-duplicate ?disabled=${e.busy} title=${t("עותק של כל העצמים שנבחרו, כגוש אחד ליד הבחירה (גם Ctrl+D)")} @click=${()=>a.duplicate()}>${e.objects===1?t("שכפל את העצם"):t("שכפל {objects} עצמים",{objects:e.objects})}</sw-button>`:u}
      <sw-button size="sm" variant="danger" icon="trash" data-multi-delete ?disabled=${e.busy} @click=${()=>a.remove()}>${t("מחק הכל")}</sw-button>
      <sw-button size="sm" variant="ghost" data-multi-clear @click=${()=>a.clear()}>${t("נקה בחירה")}</sw-button>
    </div>
    <div class="note" data-multi-hint>${Ua}</div>
  </sw-card>`}function Os(e,a,s,n){const i=Math.floor(e.rows)*Math.floor(e.cols),o=i>=2&&i<=e.max&&e.spacingX>0&&e.spacingY>0,l=d=>parseFloat(d.target.value);return r`<sw-dialog open heading=${t("מערך")} subheading=${t("שורות × עמודות של {v}; העצם שנבחר הוא הראשון",{v:e.item?.names.he??t("העצם")})} data-array-dialog @close=${n}>
    ${e.error?r`<div class="err" data-array-error>${e.error}</div>`:u}
    <div class="two">
      <sw-field label=${t("שורות")}><input type="number" min="1" max="60" step="1" data-ltr data-array-rows .value=${String(e.rows)} @input=${d=>a({rows:Math.max(1,l(d)||1)})} /></sw-field>
      <sw-field label=${t("עמודות")}><input type="number" min="1" max="60" step="1" data-ltr data-array-cols .value=${String(e.cols)} @input=${d=>a({cols:Math.max(1,l(d)||1)})} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${t("רווח בין עמודות (מ׳)")}><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sx .value=${String(e.spacingX)} @input=${d=>a({spacingX:l(d)})} /></sw-field>
      <sw-field label=${t("רווח בין שורות (מ׳)")}><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sy .value=${String(e.spacingY)} @input=${d=>a({spacingY:l(d)})} /></sw-field>
    </div>
    <sw-field label=${t("כיוון (°)")} hint=${t("0 = העמודות ימינה והשורות למטה; 90 = מסובב")}><input type="number" min="0" max="359" step="1" data-ltr data-array-dir .value=${String(e.directionDeg)} @input=${d=>a({directionDeg:l(d)||0})} /></sw-field>
    <div class="note" data-array-total>${t("{total} עצמים{v}",{total:i,v:i>e.max?t(" · יותר מ־{max} במערך אחד",{max:e.max}):""})}</div>
    <sw-button slot="footer" variant="ghost" data-array-cancel @click=${n}>${t("ביטול")}</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-array-create ?disabled=${!o} @click=${s}>${t("צור מערך")}</sw-button>
  </sw-dialog>`}function Es(e,a,s,n){return r`<sw-dialog open heading=${t("מחיקת מערך")} subheading=${t("המערך מכיל {count} עצמים",{count:e})} data-group-delete-dialog @close=${n}>
    <div class="note">${t("למחוק גם את העצמים, או להשאיר אותם על המפה כעצמים בודדים?")}</div>
    <sw-button slot="footer" variant="ghost" data-group-delete-cancel @click=${n}>${t("ביטול")}</sw-button>
    <sw-button slot="footer" data-group-delete-keep @click=${s}>${t("השאר את העצמים")}</sw-button>
    <sw-button slot="footer" variant="danger" icon="trash" data-group-delete-all @click=${a}>${t("מחק הכול")}</sw-button>
  </sw-dialog>`}function Ds(e,a,s,n,i){const o=p=>parseFloat(p.target.value),l=p=>p>=.05&&p<=100,d=!(l(e.size.w_m)&&l(e.size.d_m)&&l(e.size.h_m)),$=(p,h)=>r`<sw-field label=${h}><input type="number" min="0.05" max="100" step="0.05" data-ltr ?data-custom-w=${p==="w_m"} ?data-custom-d=${p==="d_m"} ?data-custom-h=${p==="h_m"}
      aria-invalid=${l(e.size[p])?"false":"true"} style=${l(e.size[p])?"":"border-color: var(--sw-danger)"} .value=${Number.isFinite(e.size[p])?String(e.size[p]):""}
      @input=${f=>s({size:{...e.size,[p]:o(f)}})} /></sw-field>`;return r`<sw-dialog open heading=${t("פריט מותאם")} subheading=${e.basedOn?t("מבוסס על {v}: הפריט החדש נשמר בספרייה של המתקן",{v:a.items.find(p=>p.id===e.basedOn)?.names.he??e.basedOn}):t("פריט חדש בספרייה של המתקן")} data-custom-dialog @close=${i}>
    ${e.error?r`<div class="err">${e.error}</div>`:u}
    <div class="two">
      <sw-field label=${t("שם (עברית)")}><input type="text" maxlength="80" data-custom-name .value=${e.nameHe} @input=${p=>s({nameHe:p.target.value})} /></sw-field>
      <sw-field label=${t("שם (אנגלית, לחיפוש)")}><input type="text" maxlength="80" data-ltr data-custom-name-en .value=${e.nameEn} @input=${p=>s({nameEn:p.target.value})} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${t("קטגוריה")}><select data-custom-category @change=${p=>s({category:p.target.value})}>${a.categories.map(p=>r`<option value=${p.id} ?selected=${p.id===e.category}>${p.he}</option>`)}</select></sw-field>
      <sw-field label=${t("צורה")}><select data-custom-shape @change=${p=>s({shape:p.target.value})}>${xt.map(p=>r`<option value=${p} ?selected=${p===e.shape}>${p}</option>`)}</select></sw-field>
    </div>
    <div class="two">
      <sw-field label=${t("סמל")}><select data-custom-icon @change=${p=>s({icon:p.target.value})}>${kt.map(p=>r`<option value=${p} ?selected=${p===e.icon}>${p}</option>`)}</select></sw-field>
      <sw-field label=${t("צבע")}><select data-custom-color @change=${p=>s({color:p.target.value})}>${yt.map(p=>r`<option value=${p} ?selected=${p===e.color}>${p}</option>`)}</select></sw-field>
    </div>
    <div class="three">${$("w_m",t("רוחב (מ׳)"))}${$("d_m",t("עומק (מ׳)"))}${$("h_m",t("גובה (מ׳)"))}</div>
    ${d?r`<div class="err" data-custom-size-error>${t("כל מידה בין 0.05 ל־100 מ׳")}</div>`:u}
    <div class="note">${t("הגובה מהרצפה, הפרמטרים וסוגי הישויות נלקחים מהפריט שעליו הוא מבוסס.")}</div>
    <sw-button slot="footer" variant="ghost" data-custom-cancel @click=${i}>${t("ביטול")}</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-custom-create ?disabled=${e.busy||!e.nameHe.trim()||d} @click=${n}>${e.busy?t("שומר…"):t("צור פריט")}</sw-button>
  </sw-dialog>`}function Is(e,a,s,n,i){if(e.length<2&&!n)return r``;const o=l=>r`<sw-chip data-level-chip=${l.id} ?selected=${a===l.id} @click=${()=>s(l.id)}>${t("{name} · {v}{v2} מ׳",{name:l.name,v:l.elevation_m>=0?"+":"−",v2:Math.abs(l.elevation_m).toFixed(1)})}</sw-chip>`;return r`<div class="levelchips" role="group" aria-label=${t("מפלסים")} data-level-chips>
    <sw-chip data-level-chip="all" ?selected=${a===null} @click=${()=>s(null)}>${t("כל המפלסים")}</sw-chip>
    ${[...e].sort((l,d)=>d.elevation_m-l.elevation_m).map(l=>i?r`<span class="levelchip">${o(l)}<sw-button variant="ghost" size="sm" iconOnly icon="edit" label=${t("עריכת המפלס {name}",{name:l.name})} data-level-edit=${l.id} @click=${()=>i(l.id)}></sw-button></span>`:o(l))}
    ${n?r`<sw-chip data-level-add icon="plus" @click=${n}>${t("מפלס")}</sw-chip>`:u}
  </div>`}function Ts(e,a){const s=o=>parseFloat(o.target.value),n=e.name.trim().length>0&&e.elevation>=-50&&e.elevation<=500&&e.ceiling>0&&e.ceiling<=50,i=e.id!==null;return r`<sw-dialog open heading=${t(i?"עריכת מפלס":"מפלס חדש")} subheading=${t("גובה הרצפה יחסית למפלס הראשי (0), וגובה התקרה מעליה")} data-level-dialog data-level-editing=${e.id??u} @close=${a.cancel}>
    ${e.error?r`<div class="err" data-level-error>${e.error}</div>`:u}
    <sw-field label=${t("שם")}><input type="text" maxlength="60" data-level-name placeholder=${t("למשל: אולם תחתון")} .value=${e.name} @input=${o=>a.change({name:o.target.value})} /></sw-field>
    <div class="two">
      <sw-field label=${t("גובה רצפה (מ׳)")} hint=${t("שלילי = מתחת למפלס הראשי")}><input type="number" min="-50" max="500" step="0.1" data-ltr data-level-elevation .value=${String(e.elevation)} @input=${o=>a.change({elevation:s(o)})} /></sw-field>
      <sw-field label=${t("גובה תקרה (מ׳)")}><input type="number" min="0.1" max="50" step="0.1" data-ltr data-level-ceiling .value=${String(e.ceiling)} @input=${o=>a.change({ceiling:s(o)})} /></sw-field>
    </div>
    ${i&&e.isDefault?r`<div class="note" data-level-is-default>${t("זה המפלס הראשי: פריטים חדשים מוצבים בו כשאין סינון מפלס.")}</div>`:u}
    ${i&&!e.isDefault?r`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t("הפוך למפלס הראשי")} data-level-make-default .checked=${e.makeDefault} @change=${o=>a.change({makeDefault:L(o)})}></sw-toggle> ${t("הפוך למפלס הראשי")}</label>`:u}
    ${i?r`<sw-button slot="footer" variant="danger" icon="trash" data-level-delete @click=${a.remove}>${t("מחק מפלס")}</sw-button>`:u}
    <sw-button slot="footer" variant="ghost" data-level-cancel @click=${a.cancel}>${t("ביטול")}</sw-button>
    ${i?r`<sw-button slot="footer" variant="primary" icon="check" data-level-save ?disabled=${!n} @click=${a.submit}>${t("שמור")}</sw-button>`:r`<sw-button slot="footer" variant="primary" icon="check" data-level-create ?disabled=${!n} @click=${a.submit}>${t("הוסף מפלס")}</sw-button>`}
  </sw-dialog>`}const F={stairs:t("מדרגות"),ramp:t("רמפה"),tribune:t("טריבונה"),elevator:t("מעלית"),ladder:t("סולם")};function ke(e,a){return a?e.find(s=>s.id===a)?.name??a:t("לא נבחר")}function Je(e,a){if(a.floor_ids.length){const s=a.far;return s?.missing?t("קומה שנמחקה"):s?.floor_name?s.level_name?`${s.floor_name} · ${s.level_name}`:s.floor_name:t("קומה אחרת")}return ke(e,a.level_to)}function Ve(e){return!!e.object_id||e.source==="auto"}const Ya={straight:[t("לחץ על תחילת המדרגות"),t("לחץ על סוף המדרגות")],l:[t("לחץ על תחילת המהלך הראשון"),t("לחץ על סוף המהלך הראשון (הכיוון והאורך)")],u:[t("לחץ על תחילת המהלך הראשון"),t("לחץ על סוף המהלך הראשון (הכיוון והאורך)")]};function Ns(e,a){const s=e.doc.levels,n=d=>ke(s,d),i=e.sel,o=d=>parseFloat(d.target.value),l=e.mode==="stairs"?Ya[e.stairShape][e.start?1:0]:e.mode?e.start?t("לחץ על הנקודה השנייה של {v}",{v:F[e.mode]}):t("לחץ על הנקודה הראשונה של {v}",{v:F[e.mode]}):"";return r`<sw-card heading=${t("מפלסים ומחברים")} subheading=${e.mode?`${l}${e.start?t(" · Esc לביטול"):""}`:t("מדרגות, רמפה, מעלית וסולם בין מפלסים ובין קומות")} data-connector-panel data-studio-save=${e.saveState}>
    <div class="modes" role="group" aria-label=${t("סוג מחבר")}>
      ${["stairs","ramp","elevator","ladder"].map(d=>r`<button class=${e.mode===d?"on":""} data-conn-mode=${d} aria-pressed=${e.mode===d} @click=${()=>a.setMode(e.mode===d?null:d)}>${F[d]}</button>`)}
    </div>
    ${e.mode==="stairs"?r`<div class="modes" role="group" aria-label=${t("צורת המדרגות")} data-stair-draw-shapes>
          ${Qe.map(d=>r`<button class=${e.stairShape===d?"on":""} data-stair-draw-shape=${d} aria-pressed=${e.stairShape===d} @click=${()=>a.setStairShape(d)}>${et[d]}</button>`)}
        </div>`:u}
    <sw-field label=${t("גובה קומה (רצפה עד רצפה, מ׳)")} hint=${t("כמה עולות מדרגות לקומה שמעל; ברירת מחדל 3")}><input type="number" min=${G[0]} max=${G[1]} step="0.05" data-ltr data-floor-height .value=${String(gt(e.doc))}
      @change=${d=>{const $=o(d);$>=G[0]&&$<=G[1]&&a.setFloorHeight(Math.round($*100)/100)}} /></sw-field>
    <div class="note">${t("שתי לחיצות על התוכנית מציירות מחבר (הצמדה לפינות קירות); במדרגות L ו־U הלחיצה השנייה קובעת את הכיוון ואת אורך המהלך הראשון, והפודסט והמהלך השני נוצרים לבד. מדרגות ומעלית מהספרייה מונחות כאן כמחבר. טריבונה היא עצם מהספרייה: המחבר שלה נוצר לבד כשמגדירים לאיזה מפלס היא יורדת.")}</div>
    ${e.doc.connectors.length?r`<div class="list">${e.doc.connectors.map(d=>r`<button class=${i?.id===d.id?"on":""} data-conn-row=${d.id} @click=${()=>a.select(d.id)}>
          <span>${F[d.kind]??d.kind}${Ve(d)?t(" (מעצם)"):""}</span><span class="note" style="margin:0">${n(d.level_from)} ← ${Je(s,d)}</span>
        </button>`)}</div>`:r`<div class="note">${t("עדיין אין מחברים בקומה.")}</div>`}
    ${i?tt(i,e,a,n,o):u}
  </sw-card>`}function Fs(e,a){const s=i=>ke(e.doc.levels,i),n=i=>parseFloat(i.target.value);return r`<sw-card heading=${t("מחבר")} subheading=${Z[e.saveState]} data-connector-panel data-studio-save=${e.saveState}>${tt(e.sel,e,a,s,n)}</sw-card>`}const Qe=["straight","l","u"],et={straight:t("ישר"),l:t("L (פנייה 90°)"),u:t("U (חצי סיבוב)")};function Ja(e,a,s){const n=e.shape==="l"||e.shape==="u"?e.shape:"straight",i=X(e),o=e.flights?.length?e.flights:[{steps:16}],l=o.length>1,d=$=>p=>{const h=Math.round(s(p));h>=1&&h<=te&&a.patchStair(e.id,{flights:o.map((f,x)=>x===$?{steps:h}:f)})};return r`<div class="stairs" data-stair-model=${i?n:"none"}>
    <div class="modes" role="group" aria-label=${t("צורת המדרגות")}>
      ${Qe.map($=>r`<button class=${i&&n===$?"on":""} data-stair-shape=${$} aria-pressed=${i&&n===$} @click=${()=>a.patchStair(e.id,{shape:$})}>${et[$]}</button>`)}
    </div>
    ${i?r`<div class="two">
          ${o.map(($,p)=>r`<sw-field label=${l?t("מדרגות במהלך {v}",{v:p+1}):t("מדרגות")}><input type="number" min="1" max=${te} step="1" data-ltr data-stair-steps=${p} .value=${String($.steps)} @change=${d(p)} /></sw-field>`)}
        </div>
        <div class="two">
          ${n!=="straight"?r`<sw-field label=${t("פנייה")}><select data-stair-turn @change=${$=>a.patchStair(e.id,{turn:$.target.value})}>
                <option value="right" ?selected=${e.turn!=="left"}>${t("ימינה")}</option><option value="left" ?selected=${e.turn==="left"}>${t("שמאלה")}</option></select></sw-field>`:r`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${t("פודסט באמצע")} data-stair-mid .checked=${l} @change=${$=>{const p=L($),h=o.reduce((f,x)=>f+x.steps,0);a.patchStair(e.id,{flights:p?[{steps:Math.max(1,Math.ceil(h/2))},{steps:Math.max(1,Math.floor(h/2))}]:[{steps:Math.min(te,h)}]})}}></sw-toggle> ${t("פודסט באמצע")}</label>`}
          ${l||n!=="straight"?r`<sw-field label=${t("עומק הפודסט (מ׳)")}><input type="number" min=${W[0]} max=${W[1]} step="0.1" data-ltr data-stair-landing .value=${String(e.landing_depth_m??e.width_m)}
                @change=${$=>{const p=s($);p>=W[0]&&p<=W[1]&&a.patchStair(e.id,{landing_depth_m:p})}} /></sw-field>`:u}
        </div>
        <div class="note" data-stair-caption-note>${t("{v} · גרירת פינה משנה את המסלול; שינוי כאן מסדר אותו מחדש מנקודת ההתחלה.",{v:Lt({flights:o,shape:n})||"—"})}</div>`:r`<div class="note">${t("בחר צורה כדי לצייר מהלכים, מדרגות ופודסט.")}</div>`}
    <div class="btns"><sw-button size="sm" variant="ghost" data-conn-rotate @click=${()=>a.rotate(e.id)}>${t("סובב 90°")}</sw-button></div>
  </div>`}function tt(e,a,s,n,i){const o=Ve(e),l=e.floor_ids.length>0,d=dt(a.doc,e),$=ct(a.doc,e),p=ut(a.doc,e,a.linkTargets),h=d?{...p,floors:p.floors.filter(v=>v.floorId===$)}:p,f=pt(a.doc,e),x=e.kind==="stairs"&&!o,c=x&&X(e)?Ce[0]:.05,b=x&&X(e)?Ce[1]:100,w=Je(a.doc.levels,e);return r`<div class="sel" data-selected-connector=${e.id}>
    <div class="selhead"><strong>${F[e.kind]??e.kind}</strong><span class="muted" data-conn-head-label>${Va(a.doc,e)}</span></div>
    ${o?r`<div class="note" data-conn-derived>${t("נגזר מעצם ({v}): המיקום, הרוחב והמפלסים מגיעים מהעצם; ערוך אותו בספריית העצמים.",{v:e.object_id??""})}</div>`:u}
    <div class="two">
      <sw-field label=${t("סוג")}><select data-conn-kind ?disabled=${o} @change=${v=>s.patch(e.id,{kind:v.target.value})}>${["stairs","ramp","elevator","ladder","tribune"].map(v=>r`<option value=${v} ?selected=${v===e.kind}>${F[v]}</option>`)}</select></sw-field>
      <sw-field label=${t("רוחב (מ׳)")}><input type="number" min=${c} max=${b} step="0.1" data-ltr data-conn-width ?disabled=${o} .value=${String(e.width_m)}
        @change=${v=>{const _=i(v);_>=c&&_<=b&&(x&&X(e)?s.patchStair(e.id,{width_m:_}):s.patch(e.id,{width_m:_}))}} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${t("ממפלס")}><select data-conn-from ?disabled=${o} @change=${v=>s.patch(e.id,{level_from:v.target.value})}>${a.doc.levels.map(v=>r`<option value=${v.id} ?selected=${v.id===e.level_from}>${v.name}</option>`)}</select></sw-field>
      <sw-field label=${t("מחבר אל")}><select data-conn-target aria-label=${t("מחבר אל: מפלס בקומה הזו או מפלס בקומה אחרת")} ?disabled=${o||a.linkBusy} @change=${v=>{const _=v.target.value;_&&s.setTarget(e.id,_)}}>
        <option value="" ?selected=${!f}>${l?t("{target} · בחר מפלס",{target:w}):t("בחר מפלס או קומה")}</option>
        ${h.here.length?r`<optgroup label=${t("בקומה הזו")}>${h.here.map(v=>r`<option value=${v.value} ?selected=${v.value===f}>${v.label}</option>`)}</optgroup>`:u}
        ${o?u:h.floors.map(v=>r`<optgroup label=${v.name}>${v.options.map(_=>r`<option value=${_.value} ?selected=${_.value===f}>${_.label}</option>`)}</optgroup>`)}
      </select></sw-field>
    </div>
    ${a.linkBusy?r`<div class="note" data-conn-linking>${t("מקשר לקומה השנייה…")}</div>`:u}
    ${d?r`<div class="note" data-conn-twin-origin>${t("אלה מדרגות שקושרו מקומה אחרת: כדי לקשר אותן לקומה שלישית, קשר מחדש מהקומה המקורית.")}</div>`:u}
    ${l&&!o?r`<div class="note" data-conn-twin-note>${t("מקושר אל {target}: אותו מחבר מופיע בטיוטה של שתי הקומות. הזזה כאן לא מזיזה את המדרגות בקומה השנייה, ולהפך.",{target:w})}</div>`:u}
    ${e.needs_placement?r`<div class="note warn" data-conn-placement>${t("מקם את המדרגות בקומה הזו: הן נוצרו במרכז התוכנית כי לשתי הקומות אין מסגרת משותפת. גרור אותן למקומן.")}</div>`:u}
    ${!e.needs_placement&&e.check_placement?r`<div class="note warn" data-conn-check-placement>${t("ודא את המיקום: צורת המדרגות עודכנה מהקומה השנייה והמסלול נבנה מחדש מנקודת ההתחלה שלהן כאן.")}</div>`:u}
    ${e.needs_placement||e.check_placement?r`<div class="btns"><sw-button size="sm" data-conn-confirm-place @click=${()=>s.confirmPlacement(e.id)}>${t("אישור מיקום")}</sw-button></div>`:u}
    ${x?Ja(e,s,i):u}
    <sw-field label=${t("תווית (אופציונלי; ריק = הפרש הגובה או הקומה)")}><input type="text" maxlength="80" data-conn-label ?disabled=${o} .value=${e.label??""} @change=${v=>s.patch(e.id,{label:v.target.value.trim()||null})} /></sw-field>
    <div class="note" data-conn-route>${n(e.level_from)} ← ${w}${o?"":t(" · גרירת פינה מזיזה פינה, גרירת המחבר הנבחר מזיזה את כולו")}</div>
    ${o?u:r`<div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>s.remove(e.id)}>${t("מחק מחבר")}</sw-button></div>`}
  </div>`}function Ps(e,a,s,n,i){return r`<sw-dialog open heading=${t("מחיקת מחבר בין קומות")} subheading=${t("המחבר מקושר אל {target}",{target:e})} data-twin-delete-dialog @close=${i}>
    ${a?r`<div class="note">${t("למחוק גם בקומה השנייה?")}</div><div class="note warn" data-twin-delete-immediate>${t("המחיקה בקומה השנייה מיידית: Ctrl+Z מחזיר את המדרגות רק כאן.")}</div>`:r`<div class="note" data-twin-delete-noperm>${t("אין לך הרשאת עריכה בקומה השנייה: המדרגות יימחקו רק כאן, והתאום שם יסומן כמקושר לשום מקום.")}</div>`}
    <sw-button slot="footer" variant="ghost" data-twin-delete-cancel @click=${i}>${t("ביטול")}</sw-button>
    <sw-button slot="footer" variant=${a?"secondary":"danger"} data-twin-delete-here @click=${n}>${t("רק בקומה הזו")}</sw-button>
    ${a?r`<sw-button slot="footer" variant="danger" icon="trash" data-twin-delete-both autofocus @click=${s}>${t("מחק בשתי הקומות")}</sw-button>`:u}
  </sw-dialog>`}function js(e,a,s,n){return r`<sw-dialog open heading=${t(e==="relink"?"קישור לקומה אחרת":"ביטול הקישור בין הקומות")} subheading=${t("המדרגות מקושרות עכשיו אל {target}",{target:a})} data-link-confirm-dialog=${e} @close=${n}>
    <div class="note">${t(e==="relink"?"הקישור לקומה חדשה ימחק את המדרגות מהקומה הנוכחית שלהן שם.":"המדרגות יובילו למפלס בקומה הזו, והתאום בקומה השנייה יימחק.")}</div>
    <div class="note warn">${t("המחיקה בקומה השנייה מיידית ואינה מתבטלת ב־Ctrl+Z.")}</div>
    <sw-button slot="footer" variant="ghost" data-link-confirm-cancel @click=${n}>${t("ביטול")}</sw-button>
    <sw-button slot="footer" variant="danger" data-link-confirm-ok @click=${s}>${t(e==="relink"?"קשר ומחק שם":"בטל קישור ומחק שם")}</sw-button>
  </sw-dialog>`}function Va(e,a){return At(new Map(e.levels.map(s=>[s.id,s])),a)}const Qa=t("לחץ על מנורה קיימת כדי להוסיף או להסיר אותה מהמעגל, או בחר סוג מנורה למטה ולחץ על התוכנית כדי להציב מנורה חדשה שכבר מחוברת למעגל"),es=e=>t("לחץ על התוכנית כדי להציב {he} ישירות במעגל · Esc לביטול",{he:e.names.he}),ye=e=>`var(--sw-${_t(e)??"circuit-1"})`;function Rs(e,a){const s=e.creating,n=e.sel;return r`<sw-card heading=${t("מעגלי תאורה")} subheading=${e.membersMode?e.placing?es(e.placing):Qa:t("כמה מנורות על ישות מפסק אחת")} data-circuit-panel data-studio-save=${e.saveState}>
    ${e.doc.circuits.length?r`<div class="list">${e.doc.circuits.map(i=>r`<button class=${n?.id===i.id?"on":""} data-circuit-row=${i.id} style=${`--kc: ${ye(i.color_token)}`} @click=${()=>a.select(n?.id===i.id?null:i.id)}>
          <span>${i.name}</span><span class="note ltr" style="margin:0">${i.member_ids.length} · ${e.power(i)} W · ${i.switch_entity_id}</span>
        </button>`)}</div>`:r`<div class="note">${t("עדיין אין מעגלים בקומה.")}</div>`}
    ${s?r`<div class="sel" data-circuit-new-form>
          <sw-field label=${t("שם המעגל")}><input type="text" maxlength="80" data-circuit-name placeholder=${t("למשל: אולם צפון")} .value=${s.name} @input=${i=>a.setNew({name:i.target.value})} /></sw-field>
          <sw-field label=${t("ישות המפסק (switch / light)")}><input type="search" data-ltr data-circuit-switch-q placeholder=${t("חיפוש בקטלוג")} .value=${s.q} @input=${i=>a.setNew({q:i.target.value})} /></sw-field>
          <div class="list">${s.results.slice(0,20).map(i=>r`<button class=${s.entity?.entity_id===i.entity_id?"on":""} data-circuit-switch=${i.entity_id} @click=${()=>a.setNew({entity:i})}><span>${i.name||i.original_name||i.entity_id}</span><span class="ltr">${i.entity_id}</span></button>`)}</div>
          <sw-field label=${t("צבע")}><select data-circuit-color @change=${i=>a.setNew({color:i.target.value})}>${e.colors.map((i,o)=>r`<option value=${i} ?selected=${i===s.color}>${t("מעגל {v}",{v:o+1})}</option>`)}</select></sw-field>
          <div class="btns"><sw-button variant="primary" size="sm" icon="check" data-circuit-create ?disabled=${s.busy||!s.name.trim()||!s.entity} @click=${()=>a.create()}>${t("צור מעגל")}</sw-button><sw-button variant="ghost" size="sm" data-circuit-cancel @click=${()=>a.cancelNew()}>${t("ביטול")}</sw-button></div>
        </div>`:r`<div class="btns"><sw-button size="sm" icon="plus" data-circuit-new @click=${()=>a.startNew()}>${t("מעגל חדש")}</sw-button></div>`}
    ${n&&!s?ts(n,e,a):u}
  </sw-card>`}function ts(e,a,s){return r`<div class="sel" data-selected-circuit=${e.id} style=${`--kc: ${ye(e.color_token)}`}>
    <div class="selhead"><strong>${e.name}</strong><span class="muted ltr">${e.switch_entity_id}</span></div>
    <div class="note"><span data-circuit-count>${y(e.member_ids.length,t("מנורה אחת"),t("מנורות"))}</span> · <span data-circuit-power>${a.power(e)} W</span></div>
    <div class="two">
      <sw-field label=${t("שם")}><input type="text" maxlength="80" data-circuit-rename .value=${e.name} @change=${n=>{const i=n.target.value.trim();i&&s.patch(e.id,{name:i})}} /></sw-field>
      <sw-field label=${t("צבע")}><select @change=${n=>s.patch(e.id,{color_token:n.target.value})}>${a.colors.map((n,i)=>r`<option value=${n} ?selected=${n===e.color_token}>${t("מעגל {v}",{v:i+1})}</option>`)}</select></sw-field>
    </div>
    <div class="btns">
      <sw-button size="sm" variant=${a.membersMode?"primary":"ghost"} icon="light" data-circuit-members aria-pressed=${a.membersMode} @click=${()=>s.toggleMembers()}>${a.membersMode?t("סיים בחירת מנורות"):t("הוסף / הסר מנורות")}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-circuit-delete @click=${()=>s.remove(e.id)}>${t("מחק מעגל")}</sw-button>
    </div>
    ${a.membersMode&&a.lamps.length?r`<div class="note">${t("מנורה חדשה: בחר סוג ולחץ על התוכנית (לחיצה נוספת על הסוג מבטלת)")}</div>
      <div class="modes lamps" role="group" aria-label=${t("סוג מנורה להצבה במעגל")} data-circuit-lamps>${a.lamps.map(n=>{const i=a.placing?.id===n.id;return r`<button class=${i?"on":""} data-circuit-lamp=${n.id} aria-pressed=${i} title=${t("{he} · {w_m}×{d_m} מ׳",{he:n.names.he,w_m:n.size.w_m,d_m:n.size.d_m})} @click=${()=>s.armLamp(i?null:n)}><svg viewBox="0 0 24 24" aria-hidden="true">${Kt(n.icon)}</svg><span>${n.names.he}</span></button>`})}</div>`:u}
    <div class="note">${t("המצב החי של המנורות נגזר מהמפסק; ההפעלה מהמפה החיה היא פעולת ההתקן הקיימת, באותן הרשאות.")}</div>
  </div>`}const Hs=we`
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-block-end: 8px;
  }
  .modes button,
  .btnlink {
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    color: var(--sw-text);
    border-radius: var(--sw-r-pill);
    padding: 4px 10px;
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    text-decoration: none;
  }
  .modes button.on {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .lamps button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .lamps svg {
    width: 14px;
    height: 14px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* A window wall's glazing: its own block under the wall fields; the panels that open are toggled as numbered chips. */
  .glazing {
    display: grid;
    gap: 8px;
    border-block-start: 1px dashed var(--sw-border);
    padding-block-start: 8px;
  }
  .panelchips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .panelchips button {
    min-width: 28px;
    min-height: 28px;
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    color: var(--sw-text);
    border-radius: var(--sw-r-sm);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    font-variant-numeric: tabular-nums;
  }
  .panelchips button.on {
    background: var(--sw-accent);
    border-color: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .panelchips button:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .panelchips button:focus-visible,
  .modes button:focus-visible,
  .btnlink:focus-visible,
  .issue:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 1px;
  }
  .sel {
    border-block-start: 1px solid var(--sw-border);
    margin-block-start: 10px;
    padding-block-start: 10px;
    display: grid;
    gap: 8px;
  }
  .selhead {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .selhead .muted,
  .issue .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .issues,
  .copy {
    display: grid;
    gap: 4px;
    margin-block-start: 10px;
  }
  .ilbl {
    font-weight: 600;
    font-size: var(--sw-fs-sm);
  }
  .issue {
    text-align: start;
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    color: var(--sw-text);
    border-radius: var(--sw-r-sm);
    padding: 6px 8px;
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    display: grid;
    gap: 2px;
  }
  .issue.error {
    border-color: var(--sw-danger);
  }
  .issue.warning {
    border-color: var(--sw-warning);
  }
  .issue:disabled {
    cursor: default;
    opacity: 0.7;
  }
  .exports {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-block-start: 10px;
  }
  .linkbtn {
    border: 0;
    background: none;
    color: var(--sw-accent);
    font: inherit;
    cursor: pointer;
    padding: 0;
  }
  .ifc-skipped {
    margin: 0;
    padding-inline-start: 18px;
  }
  .steps {
    margin: 0 0 8px;
    padding-inline-start: 18px;
    display: grid;
    gap: 2px;
    font-size: var(--sw-fs-sm);
  }
  .steps li.done {
    color: var(--sw-text-2);
    text-decoration: line-through;
  }
  .measure-val {
    font-family: var(--sw-font-mono);
    font-size: var(--sw-fs-lg);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .three {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }
  .libl {
    max-block-size: 320px;
  }
  .libitem {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .libitem.on {
    background: var(--sw-accent-soft);
    border-color: var(--sw-accent);
  }
  .libitem .nm {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .libitem .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .libitem .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .libitem .fav {
    border: 0;
    background: none;
    color: var(--sw-text-3);
    font: inherit;
    cursor: pointer;
    padding: 0 2px;
  }
  /* POLISH4 WP6 (D28): the favourite star drew in the bare warning hue (2.0-2.15:1 on the light card and on its warning wash); it takes the
     warning ink, which is the same hue in dark in every skin and >= 4.5:1 in light */
  .libitem .fav.on {
    color: var(--sw-warning-text);
  }
  .levelchips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .tagchips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-block-end: 6px;
  }
  .tagadd {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .tagadd input {
    flex: 1;
    min-inline-size: 0;
  }
  .tagpick {
    font: inherit;
    font-size: var(--sw-fs-sm);
    min-block-size: 28px;
    max-inline-size: 180px;
    padding-inline: 6px;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
  }
  .multinote {
    color: var(--sw-text);
    font-weight: var(--sw-fw-medium);
  }
  .alignbtns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .gridopts {
    display: grid;
    gap: 6px;
    margin-block-start: 10px;
    padding-block-start: 10px;
    border-block-start: 1px solid var(--sw-border);
  }
  .gridopts label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-sm);
  }
  .levelchip {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }
  .badge {
    display: inline-block;
    border: 1px solid var(--sw-map-candidate);
    color: var(--sw-accent-text);
    border-radius: var(--sw-r-pill);
    padding: 1px 8px;
    font-size: var(--sw-fs-sm);
    inline-size: fit-content;
  }
  .chks {
    display: grid;
    gap: 4px;
    margin-block-end: 6px;
  }
  .hint {
    border: 1px dashed var(--sw-map-candidate);
    border-radius: var(--sw-r-sm);
    padding: 8px;
    margin-block: 8px;
    display: grid;
    gap: 6px;
    font-size: var(--sw-fs-sm);
  }
  .hint .btns {
    margin-block-start: 0;
    align-items: center;
  }
  .dlist {
    display: grid;
    max-block-size: 240px;
    overflow: auto;
    margin-block: 6px;
  }
  .dcand {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    gap: 6px;
    align-items: center;
    padding: 3px 4px;
    border-block-end: 1px solid var(--sw-border);
    font-size: var(--sw-fs-sm);
  }
  /* T087 review: a wall candidate outside the main structure - dark text on the warning tint (the warning colour alone
     is too light for text on white) */
  .dcand .outside,
  .note.warn {
    color: var(--sw-text);
    background: var(--sw-warning-soft);
    /* R5-MAPS-297: the warning as a filled field with an inset hairline, not a 3 px coloured side edge (impeccable "side-tab") */
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 60%, transparent);
    border-radius: var(--sw-r-xs);
    padding-inline: 6px;
    font-weight: 600;
  }
  .dcand .linkbtn {
    text-align: start;
  }
  .dcand .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .dcand .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .dcand.rejected {
    opacity: 0.55;
  }
  .dcand.on {
    outline: 2px solid var(--sw-map-candidate);
    outline-offset: -2px;
    border-radius: var(--sw-r-xs);
  }
  .dcand.bad {
    background: var(--sw-danger-soft);
  }

  /* K88: the calibration pairs already taken */
  [data-calib-pairs] .pair {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-inline-end: 8px;
    padding: 1px 6px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-pill);
    direction: ltr;
  }
  [data-calib-pairs] .pair .x {
    border: 0;
    background: transparent;
    color: var(--sw-text-3);
    cursor: pointer;
    font: inherit;
    line-height: 1;
  }
  /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): an issue is a FILLED status field (danger / warning soft with an inset hairline),
     not a white box with a coloured outline; section labels and the measured value read as headings / display digits (the measurement in the
     interface face with tabular digits - monospace stays for code, taste-skill); the favourite star is a drawn icon; press feedback on every
     chip, mode and row; hover only with a fine pointer. */
  .modes button,
  .btnlink,
  .panelchips button,
  .issue,
  .libitem,
  .linkbtn,
  .libitem .fav {
    transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .modes button:active:not(:disabled),
  .btnlink:active,
  .panelchips button:active:not(:disabled),
  .issue:active:not(:disabled),
  .libitem:active,
  .libitem .fav:active {
    transform: scale(var(--sw-press-scale));
  }
  .modes button.on,
  .panelchips button.on {
    font-weight: var(--sw-fw-semibold);
  }
  .issue.error {
    background: var(--sw-danger-soft);
    border-color: transparent;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 55%, transparent);
  }
  .issue.warning {
    background: var(--sw-warning-soft);
    border-color: transparent;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-warning) 60%, transparent);
  }
  .issue.error .muted,
  .issue.warning .muted {
    color: var(--sw-text);
  }
  .ilbl,
  .selhead > b,
  .selhead > strong {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .measure-val {
    font-family: inherit;
    font-size: var(--sw-fs-2xl);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
    letter-spacing: -0.01em;
  }
  .libitem.on {
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-accent-text);
  }
  .libitem .fav {
    display: inline-grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--sw-r-xs);
  }
  .libitem .fav.on {
    background: var(--sw-warning-soft);
  }
  /* POLISH4 WP6 (D12 / D13): hover only under a fine pointer (it replaces the ungated :hover + (hover: none) undo) */
  @media (hover: hover) and (pointer: fine) {
    .libitem:hover:not(.on) {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
  }
  /* POLISH4 WP6 (D13): a finger on a tablet or a phone gets the 44 px touch target on the studio's small keys (the mode pills, the
     glazing panel chips and the favourite star); a mouse keeps the compact desktop rhythm */
  @media (pointer: coarse) {
    .modes button,
    .panelchips button,
    .btnlink {
      min-block-size: var(--sw-touch-desktop);
    }
    .panelchips button {
      min-inline-size: var(--sw-touch-desktop);
    }
    .libitem .fav {
      min-inline-size: var(--sw-touch-desktop);
      min-block-size: var(--sw-touch-desktop);
    }
  }
  /* POLISH4 WP6 (D13): on a phone the three-up number row (width / height / depth) keeps each field at least a thumb wide */
  @media (max-width: 479px) {
    .three {
      grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
    }
  }
  .badge {
    background: var(--sw-accent-soft);
    border-color: transparent;
    font-weight: var(--sw-fw-semibold);
  }
  .dcand.bad {
    border-radius: var(--sw-r-xs);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 55%, transparent);
  }
`,Gs=Fe("msg/plan-editor",H("en","i18n/msg/plan-editor","en"));export{gs as A,ks as B,F as C,ws as D,Ls as E,Fs as F,ka as G,Ze as H,fs as I,Is as J,As as K,es as L,Ua as M,Os as N,Ps as O,js as P,Es as Q,Ds as R,Z as S,Ts as T,Ms as U,ja as V,P as a,ps as b,hs as c,y as d,Je as e,Rs as f,I as g,g as h,Cs as i,Ve as j,j as k,ys as l,A as m,vs as n,Ss as o,He as p,zs as q,Ns as r,Hs as s,Gs as t,_s as u,ms as v,xs as w,$s as x,Be as y,bs as z};
