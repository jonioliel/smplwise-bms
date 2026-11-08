import{w as D,E as ue,F as Be,G as N,a as Ue,T as $e,q as Ke,e as l,A as c,H as qe,eZ as he}from"./index-CCDqf4A8.js";import{k as Xe,f as Ze,r as Ye}from"./zones-CnoXROhw.js";import{o as we,O as K,i as q,e as Je}from"./candidates-CS7-ly_Q.js";import{i as Ve,o as Qe,c as et,a as tt}from"./connector-targets-Cw_oqhYV.js";import{b4 as fe,b5 as at,b6 as st,b7 as it,b8 as T,f as nt,e as lt,b9 as rt,ba as ot,bb as dt,aj as oe,bc as ve,bd as ct,be as ut,bf as pt,bg as G,bh as xe,b2 as bt,bi as S,aG as gt,aH as mt,bj as $t,bk as ht,aT as X,bl as P,bm as wt,h as Ae,bn as ft,bo as vt,aN as xt,bp as kt,bq as yt,br as _t,bs as zt,bt as Z,bu as Y,bv as J,bw as St,bx as Mt,by as At,bz as Dt,bA as ke,bB as Et,o as Ct,bC as It,bD as Ot}from"./shared-space-cQPdH8Ge.js";import{s as Lt}from"./plan-catalog-eLkE46qz.js";import{g as v,t as Ft,u as Nt,v as Tt,w as Pt,x as jt,y as Rt,i as Ht}from"./sw-plan-canvas-C-31GjLG.js";import{M as de,m as De}from"./material-resolve-D9m-mkUG.js";import{s as Gt}from"./sun-D-xXkfn5.js";var Wt=Object.defineProperty,Bt=Object.getOwnPropertyDescriptor,C=(e,t,a,i)=>{for(var s=i>1?void 0:i?Bt(t,a):t,r=e.length-1,n;r>=0;r--)(n=e[r])&&(s=(i?n(t,a,s):n(s))||s);return i&&s&&Wt(t,a,s),s};const V={camera:"מצלמה",door:"עמדת דלת",device:"התקן",station:"עמדת WisKey"},Ut={camera:D`<path d="M3 8h11v8H3zM14 11l5-3v8l-5-3"/>`,door:D`<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 13h6M9 16h6"/>`,device:D`<circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>`,station:D`<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="9" r="2.2"/><path d="M9 15h6M9 18h6"/>`};let M=class extends Ue{constructor(){super(...arguments),this.zoneId="",this.data=null,this.error="",this.busy=!1,this.pick="",this.q="",this.loadedFor=""}updated(){this.zoneId&&this.zoneId!==this.loadedFor&&this.load()}async load(){const e=this.zoneId;this.loadedFor=e,this.error="";try{const t=await Xe(e);this.zoneId===e&&(this.data=t,this.pick="",this.q="")}catch(t){this.zoneId===e&&(this.data=null,this.error=$e(t))}}async change(e,t){this.busy=!0,this.error="";try{t?await Ze(this.zoneId,e.resource_type,e.resource_id):await Ye(this.zoneId,e.resource_type,e.resource_id),await this.load(),this.dispatchEvent(new CustomEvent("members-changed",{bubbles:!0,composed:!0}))}catch(a){this.error=$e(a)}finally{this.busy=!1}}where(e){return e.kind==="station"?"מוצג בכל קומות החלל":e.floors.length?e.floors.map(t=>Ke(t.name)).join(", "):"לא מוצב"}render(){const e=this.data;if(!e)return l`${this.error?l`<div class="err" data-members-error>${this.error}</div>`:l`<div class="note">טוען חברים…</div>`}`;const t=e.candidates??[],a=this.q.trim().toLowerCase(),i=a?t.filter(r=>`${V[r.kind]} ${r.name} ${r.resource_id}`.toLowerCase().includes(a)):t,s=i.find(r=>`${r.resource_type}|${r.resource_id}`===this.pick);return l`<h4>חברים בחלל המשותף</h4>
      <div data-members-list>
        ${e.members.length?e.members.map(r=>l`<div class="row" data-member=${`${r.resource_type}:${r.resource_id}`}>
              <svg class="ic" viewBox="0 0 24 24" aria-hidden="true" data-member-icon=${r.kind}>${Ut[r.kind]}</svg>
              <span class="kind">${V[r.kind]}</span>
              <div class="main">${r.name}<span>${this.where(r)}</span></div>
              ${e.can_manage?l`<sw-button size="sm" variant="ghost" data-member-remove ?disabled=${this.busy} @click=${()=>this.change(r,!1)}>הסר</sw-button>`:c}
            </div>`):l`<div class="note">אין חברים שמוצגים לך.</div>`}
      </div>
      ${e.can_manage?l`<div class="add">
            <input class="search" type="search" data-member-search aria-label="חיפוש מצלמה, עמדה או התקן להוספה" placeholder="חיפוש מצלמה, עמדה או התקן" .value=${this.q} @input=${r=>{this.q=r.target.value,this.pick=""}} />
            <select data-member-pick aria-label="בחר מצלמה, עמדה או התקן להוספה" .value=${this.pick} @change=${r=>this.pick=r.target.value}>
              <option value="">בחר מצלמה, התקן או עמדת WisKey…</option>
              ${i.map(r=>l`<option value=${`${r.resource_type}|${r.resource_id}`}>${V[r.kind]} · ${r.name} · ${this.where(r)}</option>`)}
            </select>
            <sw-button size="sm" icon="plus" data-member-add ?disabled=${this.busy||!s} @click=${()=>s&&this.change(s,!0)}>הוסף</sw-button>
          </div>
          <div class="note">חבר מוצג בכל הקומות של החלל, לכל מי שמורשה לראות אותו. הוספה והסרה דורשות הרשאת עריכה והצבה בשתי הקומות.</div>`:l`<div class="note" data-members-readonly>לקריאה בלבד: הוספה והסרה דורשות הרשאת עריכה והצבה בכל הקומות של החלל.</div>`}
      ${this.error?l`<div class="err" data-members-error>${this.error}</div>`:c}`}};M.styles=ue`
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
  `;C([Be()],M.prototype,"zoneId",2);C([N()],M.prototype,"data",2);C([N()],M.prototype,"error",2);C([N()],M.prototype,"busy",2);C([N()],M.prototype,"pick",2);C([N()],M.prototype,"q",2);M=C([qe("sw-share-members")],M);const pe={dxf:"DXF",dxfPicture:"DXF + תמונה",exportPackage:"חבילה",importPackage:"ייבוא חבילה",title:"ייבוא חבילת תוכנית",checking:"בודק את החבילה…",importing:"מייבא…",source:"מקור",draft:"טיוטה",published:"מפורסם",signedHere:"חתומה במערכת הזו",signedForeign:"חתומה במערכת אחרת",trustForeign:"אני סומך על המקור",mode:"אופן הייבוא",replace:"החלפה",merge:"מיזוג",changes:"שינויים בטיוטה",noChanges:"אין שינויים",added:"נוספו",removed:"הוסרו",changed:"השתנו",calibration:"הכיול משתנה",otherDrawing:"שרטוט אחר: בדוק מיקומים אחרי הייבוא",newerApp:"נוצרה בגרסה חדשה יותר",missing:"חסרים במערכת",unplaced:"לא ממוקמים בקומה",itemsAdded:"יתווספו לספרייה",itemsDiffer:"בספרייה גרסה אחרת",issues:"בעיות לבדיקה",importDraft:"ייבוא לטיוטה",cancel:"ביטול",imported:"החבילה יובאה לטיוטה",saved:"החבילה נשמרה",walls:"קירות",openings:"פתחים",labels:"תוויות",objects:"עצמים",connectors:"מעברים",levels:"מפלסים",circuits:"מעגלים",groups:"קבוצות",rooms:"חדרים",cameras:"מצלמות וישויות",switches:"מפסקים",items:"פריטים מותאמים"},Kt={dxf:"DXF",dxfPicture:"DXF + picture",exportPackage:"Package",importPackage:"Import package",title:"Import plan package",checking:"Checking the package…",importing:"Importing…",source:"Source",draft:"draft",published:"published",signedHere:"Signed by this system",signedForeign:"Signed by another system",trustForeign:"I trust this source",mode:"Import mode",replace:"Replace",merge:"Merge",changes:"Changes to the draft",noChanges:"No changes",added:"added",removed:"removed",changed:"changed",calibration:"Calibration changes",otherDrawing:"Different drawing: check positions after the import",newerApp:"Made by a newer version",missing:"Missing here",unplaced:"Not placed on this floor",itemsAdded:"Will be added to the library",itemsDiffer:"Library has another version",issues:"Issues to check",importDraft:"Import to draft",cancel:"Cancel",imported:"Package imported to the draft",saved:"Package saved",walls:"Walls",openings:"Openings",labels:"Labels",objects:"Objects",connectors:"Connectors",levels:"Levels",circuits:"Circuits",groups:"Groups",rooms:"Rooms",cameras:"Cameras and entities",switches:"Switches",items:"Custom items"},qt={he:pe,en:Kt};function Ee(){return(typeof document<"u"&&document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function L(e,t=Ee()){return qt[t][e]??pe[e]}function as(e,t=Ee()){return e in pe?L(e,t):e}const be={ifc:"IFC",importIfc:"ייבוא IFC",origin:"מיובאים מ־IFC",reading:"קורא את קובץ ה־IFC…",loaded:"המועמדים מהקובץ מוצגים לאישור",nothing:"לא נמצא בקובץ מה לייבא לקומה הזו",read:"נקראו",skipped:"דולגו",storey:"קומה בקובץ",storeys:"קומות בקובץ",moved:"המודל הוזז לראשית התוכנית",tooBig:"המודל גדול מהתוכנית",walls:"קירות",openings:"פתחים",objects:"עצמים",rooms:"חדרים",more:"ועוד",r_unsupported_class:"סוג לא נתמך",r_no_geometry:"בלי גאומטריה קריאה",r_curved_geometry:"גאומטריה מעוקלת",r_tilted_geometry:"גאומטריה מוטה",r_unsupported_geometry:"גאומטריה לא נתמכת",r_unsupported_profile:"פרופיל לא נתמך",r_unsupported_transform:"טרנספורמציה לא נתמכת",r_no_storey:"לא משויך לקומה",r_other_storey:"קומה אחרת בקובץ",r_placement_cycle:"מיקום מעגלי",r_unsupported_placement:"מיקום לא נתמך",r_bad_placement:"מיקום לא תקין",r_bad_number:"מספר לא תקין",r_outside_plan:"מחוץ לתוכנית",r_opening_off_wall:"פתח רחוק מהקיר",r_host_wall_skipped:"הקיר שלו דולג",r_host_not_wall:"לא בקיר",r_unsupported_filling:"מילוי פתח לא נתמך",r_live_device:"מצלמה / ישות (לא מיובאות)",r_connector_not_imported:"מעבר בין מפלסים (לא מיובא)",r_limit:"מעבר למכסה"},Xt={ifc:"IFC",importIfc:"Import IFC",origin:"imported from IFC",reading:"Reading the IFC file…",loaded:"The file’s candidates are shown for review",nothing:"Nothing in the file to import to this level",read:"Read",skipped:"skipped",storey:"storey in the file",storeys:"storeys in the file",moved:"the model was moved to the plan’s origin",tooBig:"the model is larger than the plan",walls:"walls",openings:"openings",objects:"objects",rooms:"rooms",more:"and",r_unsupported_class:"unsupported class",r_no_geometry:"no readable geometry",r_curved_geometry:"curved geometry",r_tilted_geometry:"tilted geometry",r_unsupported_geometry:"unsupported geometry",r_unsupported_profile:"unsupported profile",r_unsupported_transform:"unsupported transform",r_no_storey:"not in a storey",r_other_storey:"another storey of the file",r_placement_cycle:"cyclic placement",r_unsupported_placement:"unsupported placement",r_bad_placement:"invalid placement",r_bad_number:"invalid number",r_outside_plan:"outside the plan",r_opening_off_wall:"opening away from its wall",r_host_wall_skipped:"its wall was skipped",r_host_not_wall:"not in a wall",r_unsupported_filling:"unsupported opening filling",r_live_device:"camera / entity (never imported)",r_connector_not_imported:"level connector (not imported)",r_limit:"over the limit"},Zt={he:be,en:Xt};function U(){return(typeof document<"u"&&document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function z(e,t=U()){return Zt[t][e]??be[e]}function Yt(e,t=U()){const a=`r_${e}`;return a in be?z(a,t):e}function Jt(e,t=U()){const a=e.counts,i=["walls","openings","rooms","objects"].filter(n=>a[n]>0).map(n=>`${a[n]} ${z(n,t)}`),s=[`${z("read",t)} ${i.length?i.join(", "):"0"}`];e.skipped_total&&s.push(`${z("skipped",t)} ${e.skipped_total}`);const r=e.storeys.find(n=>n.chosen);return e.storeys.length>1&&r&&s.push(`${r.name} (${e.storeys.length} ${z("storeys",t)})`),e.alignment.fits?(e.alignment.dx_m||e.alignment.dy_m)&&s.push(z("moved",t)):s.push(`${z("tooBig",t)} (${e.alignment.needed_m?.[0]??"?"} × ${e.alignment.needed_m?.[1]??"?"} מ׳)`),s.join(" · ")}function Vt(e,t=8,a=U()){const i=Object.entries(e.skipped_by_reason).sort((n,o)=>o[1]-n[1]||n[0].localeCompare(o[0])),s=i.slice(0,t).map(([n,o])=>`${Yt(n,a)}: ${o}`),r=i.slice(t).reduce((n,[,o])=>n+o,0);return r&&s.push(`${z("more",a)} ${r}`),s}const Ce={kind:"קיר זכוכית",alias:"קיר מסך",tool:"קיר זכוכית",toolTip:"קיר זכוכית / קיר מסך (G): מציירים קיר שכולו זיגוג, ישר או מעוגל",toolHint:"לחץ נקודה אחר נקודה כמו בקיר רגיל: נוצר קיר זכוכית עם לוחות ומליונים. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, Esc מבטל.",toolHintCurved:'לחץ נקודות לאורך הקשת: נוצר קיר זכוכית מעוגל דרכן. לחיצה כפולה, Enter או "סיום" בונים, Esc מבטל.',shape:"צורה",shapeStraight:"ישר",shapeCurved:"מעוגל",frameDepth:"עומק מסגרת (מ׳)",glazing:"זיגוג",panels:"לוחות",panelWidth:"רוחב לוח (מ׳)",panelCount:"מספר לוחות",panelCountAuto:"אוטומטי",mullion:"רוחב מליון (מ׳)",sill:"גובה אדן (מ׳)",glazedHeight:"גובה זיגוג (מ׳)",glazedHeightAuto:"עד ראש הקיר",tint:"גוון",autoDivide:"חלוקה שווה",autoMin:"מינימום (מ׳)",autoMax:"מקסימום (מ׳)",autoNone:"אין חלוקה שווה בטווח הזה",operable:"לוחות נפתחים",operation:"פתיחה",entity:"ישות",noEntity:"ללא",panel:"לוח",toGlass:"המר לקיר זכוכית",toSolid:"המר לקיר רגיל",desktopOnly:"בדסקטופ בלבד",tint_clear:"שקוף",tint_tinted:"כהה",tint_frosted:"חלבי",tint_reflective:"מחזיר אור",op_casement_left:"ציר שמאל",op_casement_right:"ציר ימין",op_tilt:"נטוי",op_sliding:"הזזה",op_awning:"קיפ"},Qt={kind:"Glass wall",alias:"curtain wall",tool:"Glass wall",toolTip:"Glass wall / curtain wall (G): draw a wall that is all glazing, straight or curved",toolHint:"Click point after point as for a wall: a glass wall with panels and mullions is drawn. Enter or a second click on the last point finishes, Esc cancels.",toolHintCurved:'Click points along the curve: a curved glass wall is built through them. Double-click, Enter or "Finish" builds it, Esc cancels.',shape:"Shape",shapeStraight:"Straight",shapeCurved:"Curved",frameDepth:"Frame depth (m)",glazing:"Glazing",panels:"panels",panelWidth:"Panel width (m)",panelCount:"Panels",panelCountAuto:"auto",mullion:"Mullion width (m)",sill:"Sill height (m)",glazedHeight:"Glazed height (m)",glazedHeightAuto:"to the head",tint:"Tint",autoDivide:"Equal panels",autoMin:"Min (m)",autoMax:"Max (m)",autoNone:"No equal division fits this range",operable:"Opening panels",operation:"Opens",entity:"Entity",noEntity:"none",panel:"Panel",toGlass:"Convert to glass wall",toSolid:"Convert to solid wall",desktopOnly:"Desktop only",tint_clear:"Clear",tint_tinted:"Tinted",tint_frosted:"Frosted",tint_reflective:"Reflective",op_casement_left:"Left hinge",op_casement_right:"Right hinge",op_tilt:"Tilt",op_sliding:"Sliding",op_awning:"Awning"},ea={he:Ce,en:Qt};function ta(){return(typeof document<"u"&&document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function g(e,t=ta()){return ea[t][e]??Ce[e]}const aa=(e,t)=>g(`tint_${e}`,t),sa=(e,t)=>g(`op_${e}`,t),ia={wall:["wall","floor"],floor:["floor","outdoor"],ceiling:["ceiling","wall"],object:["object","door","window"]},na={wall:"קירות",ceiling:"תקרות",floor:"רצפות",outdoor:"חוץ",object:"עצמים",door:"דלתות",window:"חלונות וזכוכית"},la={light:"בהיר",dark:"כהה"};function ra(e){const t=ia[e];return[...de].filter(a=>t.includes(a.group)).sort((a,i)=>t.indexOf(a.group)-t.indexOf(i.group))}const oa=(e,t)=>De(e)?.tint[t]??"transparent",Q=e=>De(e)?.he??e;function Ie(e,t){const a=e.value??e.defaultId,i=e.value!==null,s=ra(e.host),r=[...new Set(de.map(n=>n.group))];return l`<div class="matf" data-material-field=${e.key}>
    <div class="mathead">
      <span class="lbl">${e.label}<span class="muted" data-material-current>${i?Q(a):`ברירת מחדל: ${Q(e.defaultId)}`}</span></span>
      <span class="seg sm" role="group" aria-label="תצוגה מקדימה לפי סגנון">
        ${["light","dark"].map(n=>l`<button type="button" data-material-style=${n} aria-pressed=${e.style===n?"true":"false"} @click=${()=>t.setStyle(n)}>${la[n]}</button>`)}
      </span>
    </div>
    <div class="swatches" role="group" aria-label=${e.label}>
      ${s.map(n=>l`<button type="button" class="swatch" data-material-pick=${n.id} aria-pressed=${i&&a===n.id?"true":"false"} aria-label=${n.he} title=${n.he} ?disabled=${e.disabled}
          style=${he({"--sw-swatch":n.tint[e.style]})} @click=${()=>t.pick(i&&a===n.id?null:n.id)}><i aria-hidden="true"></i></button>`)}
    </div>
    <div class="two">
      <sw-field label="כל החומרים"><select data-material-select ?disabled=${e.disabled} aria-label=${`${e.label} - כל החומרים`} @change=${n=>t.pick(n.target.value||null)}>
        <option value="" ?selected=${!i}>ברירת מחדל (${Q(e.defaultId)})</option>
        ${r.map(n=>l`<optgroup label=${na[n]??n}>${de.filter(o=>o.group===n).map(o=>l`<option value=${o.id} ?selected=${i&&a===o.id}>${o.he}</option>`)}</optgroup>`)}
      </select></sw-field>
      <button type="button" class="matreset" data-material-reset ?disabled=${e.disabled||!i} @click=${()=>t.pick(null)}>
        <i class="dot" aria-hidden="true" style=${he({background:oa(e.defaultId,e.style)})}></i>ברירת מחדל
      </button>
    </div>
  </div>`}function da(e,t,a,i){const s=Math.atan2(a-e,-(i-t))*180/Math.PI;return Math.round((s%360+360)%360*10)/10}function ee(e){return["צפון","צפון-מזרח","מזרח","דרום-מזרח","דרום","דרום-מערב","מערב","צפון-מערב"][Math.round((e%360+360)%360/45)%8]}function ca(e,t,a){const i=Gt(e,t.latitude,t.longitude,a);return{planDeg:((i.azimuth-a)%360+360)%360,elevation:i.elevation,azimuth:i.azimuth}}const y=60,j=(e,t)=>[y+t*Math.sin(e*Math.PI/180),y-t*Math.cos(e*Math.PI/180)];function ss(e,t){const a=e.northDeg??0,i=ca(e.nowMs,e.site,a),s=i.elevation>0,r=(360-a)%360,[n,o]=j(r,y-14),[p,u]=j(i.planDeg,y-8),m=d=>{const b=d.shiftKey?15:1,$=d.key==="ArrowRight"||d.key==="ArrowUp"?b:d.key==="ArrowLeft"||d.key==="ArrowDown"?-b:d.key==="Home"?-a:null;$!==null&&(d.preventDefault(),t.set(Math.round((a+$)*10)/10))};let h=!1;const f=d=>{const $=d.currentTarget.getBoundingClientRect();return(360-da($.left+$.width/2,$.top+$.height/2,d.clientX,d.clientY))%360};return l`<sw-card heading="צפון" subheading=${e.northDeg===null?"לא הוגדר: למעלה בתוכנית = צפון":`למעלה בתוכנית פונה ל${ee(a)} (${a}°)`} data-north-card>
    <div class="northrow">
      <svg class="dial" data-north-dial viewBox=${`0 0 ${y*2} ${y*2}`} role="slider" tabindex=${e.disabled?-1:0} aria-label="צפון התוכנית" aria-valuemin="0" aria-valuemax="359" aria-valuenow=${Math.round(a)} aria-valuetext=${`${a}° - ${ee(a)}`}
        @keydown=${m}
        @pointerdown=${d=>{e.disabled||(h=!0,d.currentTarget.setPointerCapture(d.pointerId),t.set(f(d)))}}
        @pointermove=${d=>{h&&t.set(f(d))}}
        @pointerup=${d=>{h=!1,d.currentTarget.releasePointerCapture(d.pointerId)}}
        @pointercancel=${()=>{h=!1}}>
        <circle class="face" cx=${y} cy=${y} r=${y-2}></circle>
        ${[0,90,180,270].map(d=>{const[b,$]=j(d,y-4),[w,k]=j(d,y-10);return D`<line class="tick" x1=${b} y1=${$} x2=${w} y2=${k}></line>`})}
        <path class="plan-up" d=${`M ${y-5} 14 L ${y} 6 L ${y+5} 14 Z`}></path>
        <line class="needle" x1=${y} y1=${y} x2=${n} y2=${o}></line>
        <circle class="hub" cx=${y} cy=${y} r="4"></circle>
        <text class="n" x=${n} y=${o} dy="-7" text-anchor="middle">N</text>
        ${s?D`<g class="sun" data-north-sun transform=${`translate(${p} ${u})`}><circle r="5"></circle>${[0,45,90,135,180,225,270,315].map(d=>D`<line x1="0" y1="-7" x2="0" y2="-9" transform=${`rotate(${d})`}></line>`)}</g>`:c}
      </svg>
      <div class="northctl">
        <sw-field label="כיוון הצפון (°)" hint="כמה מעלות הצפון סוטה מלמעלה בתוכנית, עם כיוון השעון"><input type="number" min="0" max="359.9" step="0.5" inputmode="decimal" data-ltr data-north-deg .value=${e.northDeg===null?"":String(a)} ?disabled=${e.disabled}
          @change=${d=>{const b=d.target.value.trim();if(!b)return t.set(null);const $=parseFloat(b);Number.isFinite($)&&t.set($)}} /></sw-field>
        <div class="note" data-north-sun-note>${s?`השמש עכשיו ב${ee(i.azimuth)}, ${Math.round(i.elevation)}° מעל האופק`:"השמש מתחת לאופק עכשיו"}${e.site.known?"":" · מיקום האתר לא הוגדר: מרכז הארץ (הגדרות ‹ מפה)"}</div>
        <div class="btns"><button type="button" class="tbtn ghost" data-north-reset ?disabled=${e.disabled||e.northDeg===null} @click=${()=>t.set(null)}>למעלה = צפון</button></div>
      </div>
    </div>
    <div class="note">גרור את המחוג, או השתמש בחצים (Shift = 15°). הצפון קובע את מסלול השמש בתצוגה הריאליסטית ובתמונות המוכנות.</div>
  </sw-card>`}function is(e){const t=new Set(e.map(a=>a.name.trim()));for(let a=1;;a++)if(!t.has(`עמדה ${a}`))return`עמדה ${a}`}function ua(e,t,a,i){return{x:Math.round(e.x*t*i*10)/10,y:Math.round(e.y*a*i*10)/10}}function ns(e,t,a){const i=.045*t,s=e.heading_deg*Math.PI/180;return{a:[e.x,e.y],b:[e.x+Math.sin(s)*i/t,e.y-Math.cos(s)*i/a]}}function ls(e,t){const a=e.positions.length>=fe,i=s=>e.levels.find(r=>r.id===s)?.name??s;return l`<sw-card heading="עמדות סיור" subheading=${e.positions.length?`${e.positions.length} עמדות · הסדר כאן הוא סדר המסלול`:"נקודות מבט שמורות לסיור בגובה עין"} data-walk-card>
    ${e.armed?l`<div class="note armed" data-walk-armed role="status">${e.armed==="new"?"לחץ על התוכנית במקום שבו עומדים · Esc לביטול":"לחץ על התוכנית כדי להזיז את העמדה · Esc לביטול"}</div>`:c}
    ${e.positions.length?l`<ol class="walklist" aria-label="עמדות סיור">
          ${e.positions.map((s,r)=>{const n=ua(s,e.W,e.H,e.scale);return l`<li class=${`walkrow${e.focused===s.id?" on":""}${e.armed===s.id?" armed":""}`} data-walk-row=${s.id}>
              <span class="idx" aria-hidden="true">${r+1}</span>
              <input class="name" type="text" maxlength=${at} data-walk-name aria-label=${`שם העמדה ${r+1}`} .value=${s.name} ?disabled=${e.disabled}
                @keydown=${o=>{o.key==="Enter"&&o.target.blur()}}
                @change=${o=>t.rename(s.id,o.target.value)} />
              <button type="button" class="star" data-walk-default aria-label=${s.is_default?"עמדת הפתיחה של הסיור":"קבע כעמדת הפתיחה"} aria-pressed=${s.is_default?"true":"false"} title=${s.is_default?"עמדת הפתיחה":"עמדת הפתיחה של הסיור"} ?disabled=${e.disabled} @click=${()=>t.setDefault(s.id)}><sw-icon name="star" size=${16}></sw-icon></button>
              <span class="where">
                ${e.levels.length>1?l`<select data-walk-level aria-label="מפלס" ?disabled=${e.disabled} @change=${o=>t.setLevel(s.id,o.target.value)}>${e.levels.map(o=>l`<option value=${o.id} ?selected=${o.id===s.level_id}>${o.name}</option>`)}</select>`:l`<span class="muted">${i(s.level_id)}</span>`}
                <span class="muted" data-walk-pos>${e.estimated?"≈ ":""}<span class="ltr">${n.x} / ${n.y}</span> מ׳</span>
                <label class="muted hd">כיוון <input type="number" min="0" max="359" step="5" inputmode="numeric" data-ltr data-walk-heading aria-label="כיוון המבט במעלות" .value=${String(Math.round(s.heading_deg))} ?disabled=${e.disabled}
                  @change=${o=>{const p=parseFloat(o.target.value);Number.isFinite(p)&&t.setHeading(s.id,p)}} />°</label>
              </span>
              <span class="acts">
                <button type="button" data-walk-go aria-label="עבור לעמדה בתוכנית" title="הצג בתוכנית" @click=${()=>t.goTo(s.id)}><sw-icon name="target" size=${16}></sw-icon></button>
                <button type="button" data-walk-place aria-label="הזז את העמדה בלחיצה על התוכנית" title="הזז בלחיצה על התוכנית" aria-pressed=${e.armed===s.id?"true":"false"} ?disabled=${e.disabled} @click=${()=>t.arm(e.armed===s.id?null:s.id)}><sw-icon name="move" size=${16}></sw-icon></button>
                <button type="button" data-walk-up aria-label="הקדם במסלול" title="למעלה" ?disabled=${e.disabled||r===0} @click=${()=>t.move(s.id,-1)}><sw-icon name="arrowUp" size=${16}></sw-icon></button>
                <button type="button" data-walk-down aria-label="אחר במסלול" title="למטה" ?disabled=${e.disabled||r===e.positions.length-1} @click=${()=>t.move(s.id,1)}><sw-icon name="arrowDown" size=${16}></sw-icon></button>
                <button type="button" class="danger" data-walk-delete aria-label="מחק את העמדה" title="מחק" ?disabled=${e.disabled} @click=${()=>t.remove(s.id)}><sw-icon name="trash" size=${16}></sw-icon></button>
              </span>
            </li>`})}
        </ol>`:l`<div class="note" data-walk-empty>עדיין אין עמדות שמורות. עמדה היא מקום וכיוון מבט שהסיור יכול לקפוץ אליהם (מקשים 1-9 בסיור).</div>`}
    <div class="btns">
      <button type="button" class=${e.armed==="new"?"tbtn primary":"tbtn"} data-walk-add ?disabled=${e.disabled||a} title=${a?`עד ${fe} עמדות`:"לחיצה על התוכנית מציבה את העמדה"} @click=${()=>t.arm(e.armed==="new"?null:"new")}><sw-icon name="plus" size=${16}></sw-icon>${e.armed==="new"?"בטל הצבה":"עמדה חדשה"}</button>
    </div>
  </sw-card>`}const rs=ue`
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
  .seg.sm button,
  .walkrow button {
    transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .tbtn:active:not([disabled]),
  .swatch:active:not([disabled]),
  .matreset:active:not([disabled]),
  .seg.sm button:active,
  .walkrow button:active:not([disabled]) {
    transform: scale(var(--sw-press-scale));
  }
  @media (prefers-reduced-motion: reduce) {
    .tbtn,
    .swatch,
    .matreset,
    .seg.sm button,
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
    .seg.sm button:not([aria-pressed='true']):hover {
      color: var(--sw-text);
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
  .seg.sm {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    background: var(--sw-surface-3);
    border-radius: var(--sw-r-sm);
  }
  .seg.sm button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    min-block-size: var(--sw-touch-desktop, 44px);
    min-inline-size: var(--sw-touch-desktop, 44px);
    justify-content: center;
    padding: 0 8px;
    border-radius: calc(var(--sw-r-sm) - 2px);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    cursor: pointer;
  }
  .seg.sm button[aria-pressed='true'] {
    background: var(--sw-seg-key, var(--sw-surface));
    color: var(--sw-seg-key-ink, var(--sw-accent-text));
    font-weight: var(--sw-fw-semibold);
    box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
  }
  .seg.sm button:focus-visible,
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
    .seg.sm button,
    .matreset,
    .walkrow .where select,
    .walkrow .hd input,
    .walkrow .name,
    .matf select,
    .northctl input {
      min-block-size: 44px;
    }
  }
`,os=["wall","curved","glass"],te="גרירת פתח קיים מזיזה אותו לאורך הקיר; חצים להזזה עדינה (Shift = צעד גדול)",Oe="לחץ על קיר, פתח, תווית או עצם כדי לבחור. קיר זז רק אחרי שנבחר: גרירת גוף הקיר הנבחר מזיזה את כולו, גרירת פינה שלו משנה את צורתו. פתח נגרר לאורך הקיר, תווית ועצם למקומם; החצים מזיזים בעדינות את מה שנבחר (Shift = צעד גדול) · Esc מבטל את הבחירה. במסך מגע כל פריט זז רק אחרי שנבחר, כך שהזזת המפה באצבע לא מזיזה פריטים.",pa="לחץ על סמל דלת בתוכנית (או על הקיר במקום הדלת): תוצג הצעה מקווקוות - רוחב, ציר וכיוון פתיחה לפי הסמל. Enter או לחיצה על ההצעה מאשרים, לחיצה על סמל הבא מאשרת ומציעה את הבאה, Esc מבטל.",ba="סמן דלת (D): לחיצה על סמל דלת בשרטוט מציעה את הדלת לפי הסמל",ae=[{id:"select",label:"בחירה",hint:Oe},{id:"wall",label:"קיר",hint:"לחץ נקודה אחר נקודה. Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים, לחיצה על הנקודה הראשונה סוגרת מתאר, Shift מבטל הצמדה לזוויות, Backspace מוחק נקודה."},{id:"curved",label:v("modeCurved"),hint:v("hintCurved"),tip:v("tipCurved"),key:"R"},{id:"glass",label:g("tool"),hint:g("toolHint"),tip:g("toolTip"),key:"G",aria:`${g("tool")} (${g("alias")})`},{id:"door",label:"דלת",hint:"לחץ על קיר כדי להציב דלת. כיוון הפתיחה והציר נקבעים כאן בפאנל.",drag:te},{id:"markdoor",label:"סמן דלת",hint:pa,tip:ba,key:"D"},{id:"window",label:"חלון",hint:"לחץ על קיר כדי להציב חלון.",drag:te},{id:"passage",label:"מעבר",hint:"פתח בלי דלת בקיר.",drag:te},{id:"label",label:"תווית",hint:"לחץ במקום התווית ואז הקלד את הטקסט כאן בפאנל.",drag:"גרירת תווית קיימת מזיזה אותה; חצים להזזה עדינה (Shift = צעד גדול)"},{id:"curve",label:v("modeCurve"),hint:v("hintCurve"),tip:v("tipCurve"),key:"C",chip:!1}],ga={curved:!1,thickness_m:it,panel_width_m:st.panel_width_m},W={exterior:"חיצוני",interior:"פנימי",partition:"מחיצה",railing:"מעקה",low:"קיר נמוך",glass:"קיר זכוכית"},ce=e=>e==="glass"?g("kind"):W[e],ma="exterior";function se(e,t){return t===e.kind?{}:t==="glass"?kt(e):e.kind==="glass"?yt(t):{kind:t}}const R={door:"דלת",window:"חלון",passage:"מעבר"},ye={right:"לצד ימין של הקיר",left:"לצד שמאל של הקיר",double:"כנף כפולה",sliding:"הזזה",none:"ללא כנף"},_e={start:"בצד תחילת הקיר",end:"בצד סוף הקיר"},$a={start:"לצד שמאל של הקיר",end:"לצד ימין של הקיר"},ie=e=>e==="double"||e==="sliding",B={idle:"טיוטת המבנה",pending:"שינויים ממתינים לשמירה…",saving:"שומר…",saved:"הטיוטה נשמרה · הצופים יראו אותה אחרי פרסום",error:"השמירה נכשלה"},ds={walls:"קירות",openings:"פתחים",labels:"תוויות",levels:"מפלסים",rooms:"חדרים",objects:"עצמים",circuits:"מעגלי תאורה",connectors:"מחברים",groups:"קבוצות"};function E(e,t,a=!0){return t&&!a?"לא מכויל":`${t?"≈":""}${e<10?e.toFixed(2):e.toFixed(1)} מ׳`}function x(e,t,a){return e===1?t:`${e} ${a}`}function ze(e){return e.walls.filter(t=>t.source!=="manual").length+e.openings.filter(t=>t.source!=="manual").length}function F(e){return`1 מ׳ = ${(1/e).toFixed(1)} פיקסלים בתוכנית`}function Le(e,t,a=!0){return t&&!a?"לא מכויל":`${t?"≈":""}${e<100?e.toFixed(1):e.toFixed(0)} מ״ר`}const _=e=>parseFloat(e.target.value);function cs(e,t){const{scale:a,estimated:i}=lt(e.doc),s=e.issues.filter(p=>p.severity==="error"),r=e.issues.filter(p=>p.severity==="warning"),n=ae.find(p=>p.id===e.mode)??ae[0],o=!e.doc.walls.length&&!e.doc.openings.length&&!e.doc.labels.length;return e.compact?l`<sw-card heading="מבנה" subheading=${B[e.saveState]} data-studio-panel data-studio-compact data-studio-save=${e.saveState}>
      <div class="note" data-select-geom-hint>${Oe}</div>
      ${e.sel?Se(e,e.sel,t,a,i):c}
      ${e.saveState==="error"?l`<div class="err">${e.saveError} ${e.conflict?l`<button class="linkbtn" data-studio-reload @click=${()=>t.reload()}>טען מחדש</button>`:l`<button class="linkbtn" data-studio-retry @click=${()=>t.retry()}>נסה שוב</button>`}</div>`:c}
    </sw-card>`:l`<sw-card heading="מבנה" subheading=${B[e.saveState]} data-studio-panel data-studio-save=${e.saveState}>
    <div class="modes" role="group" aria-label="כלי ציור">
      ${ae.filter(p=>p.chip!==!1).map(p=>l`<button class=${p.id===e.mode?"on":""} data-studio-mode=${p.id} aria-pressed=${p.id===e.mode} title=${p.tip??c} aria-label=${p.aria??c} aria-keyshortcuts=${p.key??c} @click=${()=>t.setMode(p.id)}>${p.label}</button>`)}
    </div>
    <div class="note">${e.mode==="glass"&&e.glassDraw?.curved?g("toolHintCurved"):n.hint}</div>
    ${n.drag?l`<div class="note" data-studio-drag-hint>${n.drag}</div>`:c}
    ${e.mode==="curve"?l`<div class="btns"><sw-button size="sm" variant="ghost" data-bend-done @click=${()=>t.setMode("select")}>${v("bendDone")}</sw-button></div>`:c}
    ${e.mode==="wall"||e.mode==="curved"?ha(e.wallDefaults,t):c}
    ${e.mode==="glass"?wa(e.glassDraw??ga,t):c}
    <div class="row"><span class="lbl">קנה מידה<span class="muted" data-studio-scale>${e.doc.dimensions.calibration?.status==="estimated"?`≈ ${F(a)} (הערכה, לא מדוד)`:i?e.showEstimates?"לא מכויל: מידות משוערות (≈)":"לא מכויל: מידות מוסתרות עד הכיול":F(a)}</span></span><sw-button size="sm" icon="scale" data-studio-calibrate @click=${()=>t.calibrate()}>${i?"כיול":"כיול מחדש"}</sw-button></div>
    <div class="note" data-studio-counts>${x(e.doc.walls.length,"קיר אחד","קירות")} · ${x(e.doc.openings.length,"פתח אחד","פתחים")} · ${x(e.doc.labels.length,"תווית אחת","תוויות")}${ze(e.doc)?l` · <span data-studio-auto-count>${ze(e.doc)} אוטומטיים / מיובאים</span>`:c}</div>
    ${e.sel?Se(e,e.sel,t,a,i):c}
    ${s.length||r.length?Sa(s,r,t):c}
    ${o&&e.copyCandidates.length?Ma(e.copyCandidates,t,e.busy):c}
    <div class="exports" role="group" aria-label="ייצוא המבנה">
      <a class="btnlink" data-export-svg href=${e.exportSvg} download>SVG</a>
      <a class="btnlink" data-export-png href=${e.exportPng} download>PNG</a>
      <a class="btnlink" data-export-dxf href=${e.exportDxf} download>${L("dxf")}</a>
      <button class="btnlink" data-export-dxf-package ?disabled=${e.busy} @click=${()=>t.exportPackage(!0)}>${L("dxfPicture")}</button>
      <button class="btnlink" data-export-json @click=${()=>t.exportJson()}>JSON</button>
      <button class="btnlink" data-export-package ?disabled=${e.busy} @click=${()=>t.exportPackage()}>${L("exportPackage")}</button>
      <label class="btnlink" data-import-package-label>${L("importPackage")}<input type="file" accept=".zip,application/zip" data-import-package hidden ?disabled=${e.busy}
        @change=${p=>{const u=p.target.files?.[0];u&&t.importPackage(u),p.target.value=""}} /></label>
      <a class="btnlink" data-export-ifc href=${e.exportIfc} download>${z("ifc")}</a>
      <label class="btnlink" data-import-ifc-label>${z("importIfc")}<input type="file" accept=".ifc,application/x-step,model/ifc" data-import-ifc hidden ?disabled=${e.busy}
        @change=${p=>{const u=p.target.files?.[0];u&&t.importIfc(u),p.target.value=""}} /></label>
      <span class="note">ייצוא הטיוטה כפי שהיא</span>
    </div>
    ${e.saveState==="error"?l`<div class="err">${e.saveError} ${e.conflict?l`<button class="linkbtn" data-studio-reload @click=${()=>t.reload()}>טען מחדש</button>`:l`<button class="linkbtn" data-studio-retry @click=${()=>t.retry()}>נסה שוב</button>`}</div>`:c}
  </sw-card>`}function ha(e,t){return l`<div class="two">
    <sw-field label="עובי קיר (מ׳)"><input type="number" min="0.01" max="3" step="0.01" data-ltr data-wall-thickness .value=${String(e.thickness_m)}
      @change=${a=>{const i=_(a);i>0&&i<=3&&t.setWallDefaults({...e,thickness_m:i})}} /></sw-field>
    <sw-field label="סוג קיר"><select aria-label="סוג קיר" data-wall-kind @change=${a=>t.setWallDefaults({...e,kind:a.target.value})}>
      ${Object.keys(W).map(a=>l`<option value=${a} ?selected=${e.kind===a}>${ce(a)}</option>`)}
    </select></sw-field>
  </div>`}function wa(e,t){const a=i=>t.setGlassDraw?.({...e,...i});return l`<div class="modes" role="group" aria-label=${g("shape")} data-glass-shape>
      <button class=${e.curved?"":"on"} data-glass-shape-straight aria-pressed=${!e.curved} @click=${()=>a({curved:!1})}>${g("shapeStraight")}</button>
      <button class=${e.curved?"on":""} data-glass-shape-curved aria-pressed=${e.curved} @click=${()=>a({curved:!0})}>${g("shapeCurved")}</button>
    </div>
    <div class="two">
      <sw-field label=${g("panelWidth")}><input type="number" data-ltr data-glass-draw-width min=${S[0]} max=${S[1]} step="0.05" .value=${String(e.panel_width_m)}
        @change=${i=>{const s=_(i);s>=S[0]&&s<=S[1]&&a({panel_width_m:s})}} /></sw-field>
      <sw-field label=${g("frameDepth")}><input type="number" data-ltr data-glass-draw-depth min="0.01" max="3" step="0.01" .value=${String(e.thickness_m)}
        @change=${i=>{const s=_(i);s>0&&s<=3&&a({thickness_m:s})}} /></sw-field>
    </div>`}function Fe(e,t,a){return e.length<2?c:l`<sw-field label="מפלס"><select data-item-level @change=${i=>a(i.target.value)}>${e.map(i=>l`<option value=${i.id} ?selected=${i.id===t}>${i.name} (${i.elevation_m} מ׳)</option>`)}</select></sw-field>`}function Se(e,t,a,i,s){if(t.kind==="wall"){const n=e.doc.walls.find(o=>o.id===t.id);return n?fa(n,e,a,i,s):c}if(t.kind==="opening"){const n=e.doc.openings.find(o=>o.id===t.id);return n?_a(n,e,a,i,s):c}const r=e.doc.labels.find(n=>n.id===t.id);return r?za(r,e,a):c}function fa(e,t,a,i,s){const r=Ae(e,t.W,t.H)*i,n=t.doc.openings.filter(u=>u.wall_id===e.id).length,o=ft(e,t.W,t.H,i),p=Nt(e);return l`<div class="sel" data-selected-wall=${e.id}>
    <div class="selhead"><strong>${e.kind==="glass"?ce(e.kind):`קיר ${W[e.kind]}`}</strong><span class="muted">${E(r,s,t.showEstimates)} · ${x(n,"פתח אחד","פתחים")}${o!==null?l` · ${v("area")} <span data-wall-area>${Le(o,s,t.showEstimates)}</span>`:c}</span></div>
    ${Ne(e)}
    ${e.external_ids?.origin==="door_tool"?l`<div class="note" data-wall-door-tool>קטע קיר שנוסף עם דלת בכלי "סמן דלת": בדוק את עוביו ואת החיבור לקירות הסמוכים.</div>`:c}
    <div class="two">
      <sw-field label="עובי (מ׳)"><input type="number" min="0.01" max="3" step="0.01" data-ltr .value=${String(e.thickness_m)}
        @change=${u=>{const m=_(u);m>0&&m<=3&&a.patchWall(e.id,{thickness_m:m})}} /></sw-field>
      <sw-field label="סוג"><select aria-label="סוג קיר" data-selected-wall-kind ?disabled=${!!t.phone&&e.kind==="glass"} @change=${u=>a.patchWall(e.id,se(e,u.target.value))}>
        ${Object.keys(W).map(u=>l`<option value=${u} ?selected=${e.kind===u} ?disabled=${!!t.phone&&u==="glass"&&e.kind!=="glass"}>${ce(u)}</option>`)}
      </select></sw-field>
    </div>
    ${e.kind==="glass"?ka(e,t,a,r):c}
    ${a.setMaterial&&t.materials&&e.kind!=="glass"?Ie({key:`walls:${e.id}`,label:"חומר הקיר",host:"wall",value:e.material_id??null,defaultId:t.materials.walls[e.id]??"plaster_white",style:t.materialStyle??"light"},{pick:u=>a.setMaterial("walls",e.id,u),setStyle:u=>a.setMaterialStyle?.(u)}):c}
    <sw-field label="גובה (מ׳, ריק = עד התקרה)"><input type="number" min="0.1" max="50" step="0.1" data-ltr .value=${e.height_m===null?"":String(e.height_m)}
      @change=${u=>{const m=u.target.value.trim(),h=parseFloat(m);m?h>0&&h<=50&&a.patchWall(e.id,{height_m:h}):a.patchWall(e.id,{height_m:null})}} /></sw-field>
    ${Fe(t.levels,e.level_id,u=>a.setLevel(e.id,u))}
    ${Pe(e.tags,u=>a.patchWall(e.id,{tags:u}))}
    ${t.mode==="curve"?xa(e,t,a,i):c}
    ${p?va(e,p.length,t,a):c}
    ${t.mode==="select"&&t.sel?.vertex!==void 0&&!p?l`<div class="note" data-selected-vertex=${t.sel.vertex}>פינה ${t.sel.vertex+1} נבחרה: החצים מזיזים אותה (Shift = צעד גדול); ${vt(e.polyline)?"Delete מוחק את הפינה.":"Delete מוחק את כל הקיר, כי בלי הפינה לא נשאר קיר."}</div>`:c}
    ${!t.phone&&!t.compact&&t.mode==="select"?l`<div class="btns"><sw-button size="sm" variant="ghost" data-wall-bend title=${v("tipCurve")} @click=${()=>a.setMode("curve")}>${v("bendOpen")}</sw-button></div>`:c}
    <div class="btns">${e.kind==="glass"?l`<sw-button size="sm" variant="ghost" data-wall-to-solid ?disabled=${!!t.phone} title=${t.phone?g("desktopOnly"):c} @click=${()=>a.patchWall(e.id,se(e,ma))}>${g("toSolid")}</sw-button>`:l`<sw-button size="sm" variant="ghost" data-wall-to-glass ?disabled=${!!t.phone} title=${t.phone?g("desktopOnly"):c} @click=${()=>a.patchWall(e.id,se(e,"glass"))}>${g("toGlass")}</sw-button>`}</div>
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>a.remove(e.id)}>מחק קיר</sw-button><span class="note">הפתחים שבקיר נמחקים איתו</span></div>
  </div>`}function va(e,t,a,i){const s=a.sel?.id===e.id&&a.sel.vertex!==void 0?Ht(e,a.sel.vertex):-1;return l`<div class="curvepts" data-curve-points=${t}>
    <div class="note">${v("pointsWall")} · ${t} ${v("points")}${s>=0?l` · <span data-curve-point-selected=${s}>${v("pointHandle")} ${s+1}</span>`:c}</div>
    ${a.phone?c:l`<div class="btns"><sw-button size="sm" variant="ghost" data-curve-add @click=${()=>i.addCurvePoint?.(e.id)}>${v("addPoint")}</sw-button>${s>=0?l`<sw-button size="sm" variant="ghost" data-curve-remove @click=${()=>i.removeCurvePoint?.(e.id,s)}>${v("removePoint")}</sw-button>`:c}</div>
        <div class="note">${v("pointsNote")}</div>`}
  </div>`}function xa(e,t,a,i){const s=t.sel?.id===e.id?t.sel.segment:void 0,r=t.sel?.id===e.id?t.sel.vertex:void 0;if(s!==void 0&&s<e.polyline.length-1){const n=Tt(e,s,t.W,t.H,i),o=Pt(e,s,t.W,t.H,i),p=u=>{const m=u.target,h=m.value.trim(),f=parseFloat(h);h?f>0&&a.setSegmentRadius?.(e.id,s,f):a.setSegmentRadius?.(e.id,s,null),m.value=n===null?"":n.toFixed(2)};return l`<div class="two" data-curve-segment=${s}>
      <sw-field label=${`${v("segment")} ${s+1} · ${v("radius")}`}><input type="number" min=${o.toFixed(2)} step="0.05" data-ltr data-segment-radius
        placeholder=${v("straight")} .value=${n===null?"":n.toFixed(2)} @change=${p} /></sw-field>
      <div class="btns"><sw-button size="sm" variant="ghost" data-segment-straighten ?disabled=${n===null} @click=${()=>a.setSegmentRadius?.(e.id,s,null)}>${v("straighten")}</sw-button></div>
    </div>`}if(r!==void 0&&jt(e,r,t.W,t.H)){const n=Rt(e,r,t.W,t.H,i);let o=Math.min(.5,n);return l`<div class="two" data-curve-corner=${r}>
      <sw-field label=${`${v("roundCorner")} ${r+1} · ${v("radius")}`}><input type="number" min="0.01" max=${n.toFixed(2)} step="0.05" data-ltr data-corner-radius
        .value=${o.toFixed(2)} @change=${p=>{o=parseFloat(p.target.value)}} /></sw-field>
      <div class="btns"><sw-button size="sm" data-corner-apply @click=${p=>{const u=p.currentTarget.closest("[data-curve-corner]")?.querySelector("input"),m=parseFloat(u?.value??String(o));m>0&&a.roundCorner?.(e.id,r,m)}}>${v("apply")}</sw-button></div>
    </div>`}return c}const A={range:[St,Mt]};function ka(e,t,a,i){const s=_t(e),r=zt(i,s),n=!!t.phone,o=d=>a.patchWall(e.id,{glazing:Ot(e,d,i)}),p=(d,[b,$],w)=>{const k=_(d);Number.isFinite(k)&&k>=b&&k<=$&&w(k)},u=(d,b,$)=>{d.target.value.trim()?p(d,b,$):$(null)},m=new Set(s.operable.map(d=>d.panel)),h=d=>{const b=t.entityChoices??[];return d&&!b.some($=>$.id===d)?[...b,{id:d,name:d}]:b},f=()=>{const[d,b]=A.range,$=It(e,i,Math.min(d,b),Math.max(d,b));$?a.patchWall(e.id,{glazing:$}):a.say?.(g("autoNone"))};return l`<div class="glazing" data-glazing-inspector=${e.id} data-glazing-panels=${r}>
    <div class="selhead"><strong>${g("glazing")}</strong><span class="muted" data-glazing-summary>${r} ${g("panels")} · ${(i/r).toFixed(2)} מ׳</span></div>
    <div class="two">
      <sw-field label=${g("panelWidth")}><input type="number" data-ltr data-glazing-width min=${S[0]} max=${S[1]} step="0.05" ?disabled=${n} .value=${String(s.panel_width_m)}
        @change=${d=>p(d,S,b=>o({panel_width_m:b,panel_count:null}))} /></sw-field>
      <sw-field label=${g("panelCount")}><input type="number" data-ltr data-glazing-count min="1" max="200" step="1" ?disabled=${n} placeholder=${g("panelCountAuto")} .value=${s.panel_count===null?"":String(s.panel_count)}
        @change=${d=>u(d,[1,200],b=>o({panel_count:b===null?null:Math.round(b)}))} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${g("autoMin")}><input type="number" data-ltr data-glazing-auto-min min="0.2" max="6" step="0.05" ?disabled=${n} .value=${String(A.range[0])}
        @change=${d=>p(d,S,b=>A.range=[b,A.range[1]])} /></sw-field>
      <sw-field label=${g("autoMax")}><input type="number" data-ltr data-glazing-auto-max min="0.2" max="6" step="0.05" ?disabled=${n} .value=${String(A.range[1])}
        @change=${d=>p(d,S,b=>A.range=[A.range[0],b])} /></sw-field>
    </div>
    <div class="btns"><sw-button size="sm" data-glazing-auto ?disabled=${n} title=${n?g("desktopOnly"):c} @click=${f}>${g("autoDivide")}</sw-button></div>
    <div class="two">
      <sw-field label=${g("mullion")}><input type="number" data-ltr data-glazing-mullion min=${Z[0]} max=${Z[1]} step="0.01" ?disabled=${n} .value=${String(s.mullion_m)}
        @change=${d=>p(d,Z,b=>o({mullion_m:b}))} /></sw-field>
      <sw-field label=${g("sill")}><input type="number" data-ltr data-glazing-sill min=${Y[0]} max=${Y[1]} step="0.05" ?disabled=${n} .value=${String(s.sill_m)}
        @change=${d=>p(d,Y,b=>o({sill_m:b}))} /></sw-field>
    </div>
    <div class="two">
      <sw-field label=${g("glazedHeight")}><input type="number" data-ltr data-glazing-height min=${J[0]} max=${J[1]} step="0.05" ?disabled=${n} placeholder=${g("glazedHeightAuto")} .value=${s.glazed_height_m===null?"":String(s.glazed_height_m)}
        @change=${d=>u(d,J,b=>o({glazed_height_m:b}))} /></sw-field>
      <sw-field label=${g("tint")}><select data-glazing-tint ?disabled=${n} @change=${d=>o({tint:d.target.value})}>
        ${At.map(d=>l`<option value=${d} ?selected=${s.tint===d}>${aa(d)}</option>`)}</select></sw-field>
    </div>
    <sw-field label=${g("operable")}><div class="panelchips" role="group" aria-label=${g("operable")} data-glazing-chips>
      ${Array.from({length:r},(d,b)=>l`<button type="button" class=${m.has(b)?"on":""} data-glazing-panel=${b} aria-pressed=${m.has(b)?"true":"false"} ?disabled=${n}
        aria-label=${`${g("panel")} ${b+1}`} @click=${()=>a.patchWall(e.id,{glazing:Dt(s,b)})}>${b+1}</button>`)}
    </div></sw-field>
    ${s.operable.map(d=>l`<div class="two" data-operable-row=${d.panel}>
      <sw-field label=${`${g("panel")} ${d.panel+1} · ${g("operation")}`}><select data-operable-operation ?disabled=${n}
        @change=${b=>a.patchWall(e.id,{glazing:ke(s,d.panel,{operation:b.target.value})})}>
        ${Et.map(b=>l`<option value=${b} ?selected=${d.operation===b}>${sa(b)}</option>`)}</select></sw-field>
      <sw-field label=${g("entity")}><select data-operable-entity ?disabled=${n}
        @change=${b=>{const $=b.target.value;a.patchWall(e.id,{glazing:ke(s,d.panel,{anchor_ref:$?{resource_type:"ha_entity",resource_id:$}:null})})}}>
        <option value="" ?selected=${!d.anchor_ref}>${g("noEntity")}</option>
        ${h(d.anchor_ref?.resource_id??null).map(b=>l`<option value=${b.id} ?selected=${d.anchor_ref?.resource_id===b.id}>${b.name}</option>`)}
      </select></sw-field>
    </div>`)}
  </div>`}function ya(e,t,a,i,s){const r=t.doc.walls.find(f=>f.id===e.wall_id),n=r?Ae(r,t.W,t.H)*i:0;if(!(n>0))return c;const[o,p]=Ct(e.width_m,n),u=f=>s?(f*100).toFixed(1):(f*n).toFixed(2),m=f=>{const d=f.target,b=parseFloat(d.value),$=Number.isFinite(b)?Math.min(p,Math.max(o,s?b/100:b/n)):e.t;$!==e.t&&a.patchOpening(e.id,{t:$}),d.value=u($)},h="חצים מזיזים את הפתח לכיוון החץ לאורך הקיר.";return s?l`<sw-field label="מיקום על הקיר (%)" hint=${`מרכז הפתח: 0 = תחילת הקיר, 100 = סופו. ${h}`}><input type="number" min="0" max="100" step="0.1" data-ltr data-opening-percent
        aria-label="מיקום על הקיר (%)" .value=${u(e.t)} @change=${m} /></sw-field>`:l`<sw-field label="מרחק מתחילת הקיר (מ׳)" hint=${`עד מרכז הפתח; אורך הקיר ${n.toFixed(2)} מ׳. ${h}`}><input type="number" min=${(o*n).toFixed(2)} max=${(p*n).toFixed(2)} step="0.01"
        data-ltr data-opening-distance aria-label="מרחק מתחילת הקיר (מ׳)" .value=${u(e.t)} @change=${m} /></sw-field>`}function _a(e,t,a,i,s){return l`<div class="sel" data-selected-opening=${e.id}>
    <div class="selhead"><strong>${R[e.kind]}</strong><span class="muted">${e.width_m.toFixed(2)} מ׳ רוחב${e.anchor_ref?" · מקושר לישות":""}</span></div>
    ${Ne(e)}
    <div class="two">
      <sw-field label="סוג"><select aria-label="סוג פתח" @change=${r=>a.patchOpening(e.id,xt(r.target.value))}>
        ${Object.keys(R).map(r=>l`<option value=${r} ?selected=${e.kind===r}>${R[r]}</option>`)}
      </select></sw-field>
      <sw-field label="רוחב (מ׳)"><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(e.width_m)}
        @change=${r=>{const n=_(r);n>0&&n<=10&&a.patchOpening(e.id,{width_m:n})}} /></sw-field>
    </div>
    ${ya(e,t,a,i,s)}
    <div class="two">
      <sw-field label="גובה (מ׳)"><input type="number" min="0.1" max="10" step="0.05" data-ltr .value=${String(e.height_m)}
        @change=${r=>{const n=_(r);n>0&&n<=10&&a.patchOpening(e.id,{height_m:n})}} /></sw-field>
      ${e.kind==="window"?l`<sw-field label="גובה אדן (מ׳)"><input type="number" min="0" max="10" step="0.05" data-ltr .value=${String(e.sill_m)}
            @change=${r=>{const n=_(r);n>=0&&n<=10&&a.patchOpening(e.id,{sill_m:n})}} /></sw-field>`:c}
    </div>
    ${e.kind==="door"?l`<div class="two">
          <sw-field label="כיוון פתיחה"><select aria-label="כיוון פתיחה" @change=${r=>a.patchOpening(e.id,{swing:r.target.value})}>
            ${Object.keys(ye).map(r=>l`<option value=${r} ?selected=${e.swing===r}>${ye[r]}</option>`)}
          </select></sw-field>
          <sw-field label=${ie(e.swing)?"צד הפתיחה":"ציר"}><select aria-label=${ie(e.swing)?"צד הפתיחה":"ציר"} data-opening-hinge @change=${r=>a.patchOpening(e.id,{hinge:r.target.value})}>
            ${Object.keys(_e).map(r=>l`<option value=${r} ?selected=${e.hinge===r}>${(ie(e.swing)?$a:_e)[r]}</option>`)}
          </select></sw-field>
        </div>`:c}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>a.remove(e.id)}>מחק ${R[e.kind]}</sw-button></div>
  </div>`}function za(e,t,a){return l`<div class="sel" data-selected-label=${e.id}>
    <sw-field label="טקסט"><input type="text" maxlength="80" data-label-text .value=${e.text}
      @change=${i=>{const s=i.target.value.trim();s&&a.patchLabel(e.id,{text:s})}} /></sw-field>
    <sw-field label="גודל"><input type="number" min="6" max="200" step="1" data-ltr .value=${String(e.size)}
      @change=${i=>{const s=_(i);s>=6&&s<=200&&a.patchLabel(e.id,{size:s})}} /></sw-field>
    ${Fe(t.levels,e.level_id,i=>a.setLevel(e.id,i))}
    <div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>a.remove(e.id)}>מחק תווית</sw-button></div>
  </div>`}function Sa(e,t,a){return l`<div class="issues" data-studio-issues>
    <div class="ilbl">${e.length?`${e.length} שגיאות חוסמות פרסום`:"אין שגיאות חוסמות"}${t.length?` · ${t.length} אזהרות`:""}</div>
    ${[...e,...t].slice(0,20).map(i=>l`<button class="issue ${i.severity}" data-issue=${i.code} data-issue-id=${i.id??""} ?disabled=${!i.id} @click=${()=>{i.id&&a.focus(i.id)}}>${i.message}</button>`)}
  </div>`}function Ma(e,t,a){return l`<div class="copy" data-copy-candidates>
    <div class="ilbl">להתחיל ממבנה קיים?</div>
    ${e.map(i=>l`<button class="issue" data-copy-from=${i.version_id} ?disabled=${a} @click=${()=>t.copyFrom(i.version_id)}>
      <span>העתק ${x(i.walls,"קיר אחד","קירות")} ו${i.openings===1?"":"־"}${x(i.openings,"פתח אחד","פתחים")} מגרסה ${i.status==="published"?"מפורסמת":i.status==="draft"?"בטיוטה":"מהארכיון"}</span>
      <span class="muted">${i.same_drawing?"אותו שרטוט":"שרטוט אחר: המיקומים לא מיושרים, בדוק אותם"}</span>
    </button>`)}
  </div>`}function us(e,t,a,i,s,r){const n=parseFloat(e.metres),o=e.pixels!==null&&e.pixels<5,p=e.pairs??[],u=!!e.a&&!!e.b&&e.pixels!==null&&e.pixels>=5&&n>0&&n<=1e3,m=(u||p.length>0)&&!e.busy,h=u&&p.length<3&&!e.busy&&!!s,f=e.showEstimates?"התוכנית לא מכוילת: מידות מוצגות כמשוערות (≈)":"התוכנית לא מכוילת: מידות מוסתרות עד הכיול (הגדרות)";return l`<sw-card heading="כיול קנה מידה" subheading=${e.estimated?f:`מכויל · ${F(e.scale)}`} data-calib-panel>
    <ol class="steps">
      <li class=${e.a?"done":""}>לחץ על נקודה שהמרחק ממנה ידוע, למשל פינת קיר</li>
      <li class=${e.b?"done":""}>לחץ על הנקודה השנייה</li>
      <li>הקלד את המרחק האמיתי ביניהן</li>
    </ol>
    <sw-field label="מרחק (מ׳)"><input type="number" min="0.01" max="1000" step="0.01" data-ltr data-calib-metres .value=${e.metres} ?disabled=${!e.b}
      @input=${d=>t(d.target.value)} /></sw-field>
    ${e.pixels!==null?l`<div class=${o?"note err":"note"}>${e.pixels.toFixed(0)} פיקסלים בתוכנית${o?" · הנקודות קרובות מדי":n>0?` · 1 מ׳ = ${(e.pixels/n).toFixed(1)} פיקסלים`:""}</div>`:c}
    ${p.length?l`<div class="note" data-calib-pairs>זוגות שנמדדו: ${p.map((d,b)=>l`<span class="pair" data-calib-pair=${b}>${d.metres} מ׳ / ${d.pixels.toFixed(0)} px${r?l` <button type="button" class="x" aria-label="הסר זוג" data-calib-drop=${b} @click=${()=>r(b)}>×</button>`:c}</span>`)}</div>`:c}
    <div class="btns">
      <sw-button variant="primary" size="sm" icon="check" data-calib-save ?disabled=${!m} @click=${a}>שמור כיול${p.length?` (${p.length+(u?1:0)} זוגות)`:""}</sw-button>
      ${s?l`<sw-button size="sm" icon="plus" data-calib-add ?disabled=${!h} title="עד ארבעה זוגות; הממוצע משוקלל לפי האורך ומוצגת הסטייה" @click=${s}>זוג נוסף</sw-button>`:c}
      <sw-button variant="ghost" size="sm" data-calib-reset @click=${i}>נקה נקודות</sw-button>
    </div>
    ${e.result?l`<div class="note" data-calib-result>${e.result}</div>`:c}
    ${e.warning?l`<div class="err" data-calib-warning>${e.warning}</div>`:c}
    <div class="note">המיקומים על המפה לא זזים, רק המטרים משתנים. הכיול נכנס לטיוטת המבנה והצופים רואים אותו אחרי פרסום.</div>
  </sw-card>`}function ps(e,t,a,i,s,r,n){const o=e.length>1?rt(e,t,a)*i:0;return l`<sw-card heading="מדידה" subheading=${s?r?"לא מכויל: הערכים משוערים (≈)":"לא מכויל: המידות מוסתרות עד הכיול (הגדרות)":"לפי הכיול של גרסת התוכנית"} data-measure-panel>
    <div class="note">לחץ נקודות על התוכנית. Shift מבטל הצמדה לזוויות, Esc מנקה.</div>
    <div class="measure-val" data-measure-distance>${e.length>1?E(o,s,r):"—"}</div>
    ${e.length>=3?l`<div class="note">שטח המצולע <span class="measure-val" data-measure-area>${Le(ot(e,t,a,i),s,r)}</span> · היקף ${E(dt(e,t,a,i),s,r)}</div>`:c}
    <div class="btns"><sw-button variant="ghost" size="sm" data-measure-clear ?disabled=${!e.length} @click=${n}>נקה</sw-button></div>
  </sw-card>`}const Aa=[{key:"sectionLines",attr:"section",label:"קווי חתך החוצים את המבנה אינם קירות"},{key:"joinGaps",attr:"join",label:"רווח קטן מ־30 ס״מ בלי סימון - קיר אחד"},{key:"stepsRegions",attr:"steps",label:"הצע טריבונה משורות מקבילות"},{key:"columns",attr:"columns",label:"הצע עמודים וקו מעטפת ביניהם"}],H={wall:"קיר",door:"דלת",window:"חלון",passage:"מעבר"},Da={wall:"רק קירות",door:"רק דלתות",window:"רק חלונות",passage:"רק מעברים"},Ea={auto:"זוהה אוטומטית",imported:"יובא מ־DXF"},ne=300,Ca=e=>Math.max(.3,Math.round((e-.2)*100)/100);function Ne(e){return e.source==="manual"?c:l`<span class="badge" data-auto-badge=${e.source}>${Ea[e.source]??e.source} · ביטחון ${e.confidence.toFixed(2)}</span>`}function Me(e,t){return e.walls.some(a=>a.id===t)?"wall":e.openings.find(a=>a.id===t)?.kind??"wall"}function le(e,t){return e.walls.find(a=>a.id===t)?.confidence??e.openings.find(a=>a.id===t)?.confidence??0}function Ia(e,t,a){const i=t.walls.find(r=>r.id===a);if(i)return`עובי ${E(i.thickness_m,e.estimated,e.showEstimates)}`;const s=t.openings.find(r=>r.id===a);return s?`רוחב ${E(s.width_m,e.estimated,e.showEstimates)}`:""}function bs(e,t){const a=e.cands,i=e.opts;return l`<sw-card heading="זיהוי אוטומטי" subheading="קירות, דלתות וחלונות מהתוכנית · עיבוד מקומי, ללא AI וללא שליחה החוצה" data-detect-panel data-detect-state=${e.run.busy?"running":a?"candidates":"idle"} aria-busy=${e.run.busy||e.busy?"true":"false"}>
    ${a?Oa(e,a,t):l`<div class="note">הזיהוי מציע מועמדים בשכבה נפרדת (כחול מקווקו). דבר לא נשמר עד "אשר", ודבר לא מתפרסם בלי פרסום.</div>
          <div class="chks">
            <label class="chk"><input type="checkbox" data-detect-walls .checked=${i.walls} @change=${s=>{const r=s.target.checked;t.setOpts({...i,walls:r,openings:r&&i.openings})}} /> קירות</label>
            <label class="chk"><input type="checkbox" data-detect-openings .checked=${i.openings} ?disabled=${!i.walls} @change=${s=>t.setOpts({...i,openings:s.target.checked})} /> פתחים (דלתות, חלונות, מעברים)</label>
            <label class="chk"><input type="checkbox" data-detect-hollow .checked=${i.hollow!==!1} ?disabled=${!i.walls} @change=${s=>t.setOpts({...i,hollow:s.target.checked})} /> קירות חלולים (חיצוניים דקים)</label>
            ${Aa.map(s=>l`<label class="chk"><input type="checkbox" data-detect-rule=${s.attr} .checked=${i[s.key]!==!1} ?disabled=${!i.walls} @change=${r=>t.setOpts({...i,[s.key]:r.target.checked})} /> ${s.label}</label>`)}
          </div>
          <sw-field label=${`עוצמת ניקוי: ${i.strength.toFixed(2)} (קל ← חזק)`}><input type="range" min="0.3" max="1" step="0.05" data-detect-strength .value=${String(i.strength)}
            @input=${s=>t.setOpts({...i,strength:parseFloat(s.target.value)})} /></sw-field>
          ${e.autoInDraft?l`<label class="chk"><input type="checkbox" data-detect-replace .checked=${i.replaceAuto} @change=${s=>t.setOpts({...i,replaceAuto:s.target.checked})} /> החלף אוטומטיים קודמים (${e.autoInDraft} בטיוטה)</label>`:c}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="sparkle" data-detect-run aria-busy=${e.run.busy?"true":"false"} ?disabled=${e.run.busy||!i.walls||e.busy} @click=${()=>t.run()}>${e.run.busy?l`מזהה… <span data-detect-elapsed>${e.run.elapsed}</span> שנ׳`:"זהה אוטומטית"}</sw-button>
            ${e.run.busy?l`<span class="note">הזיהוי רץ בשרת${e.run.limitS?` (עד ${e.run.limitS} שניות)`:""}; הכפתור ייפתח כשיסיים.</span>`:c}
          </div>
          ${e.run.error?l`<div class="err" role="alert" data-detect-error=${e.run.timedOut?"detect_timeout":"failed"}>${e.run.error}</div>
                ${e.run.timedOut&&i.strength>.3?l`<div class="btns"><sw-button size="sm" icon="refresh" data-detect-retry ?disabled=${e.run.busy||e.busy} @click=${()=>t.retryLighter()}>נסה שוב בעוצמה ${Ca(i.strength).toFixed(2)}</sw-button></div>`:c}`:c}`}
  </sw-card>`}function Oa(e,t,a){const i=t.set,s=[...i.walls.map(d=>d.id),...i.openings.map(d=>d.id)],n=["wall","door","window","passage"].filter(d=>d==="wall"?i.walls.length>0:i.openings.some(b=>b.kind===d)),o=t.sel&&s.includes(t.sel)?{id:t.sel,kind:Me(i,t.sel),score:le(i,t.sel)}:null,p=e.acceptError,u=new Set(p?.ids??[]),m=t.existingAuto.walls+t.existingAuto.openings+(t.existingAuto.objects??0),h=t.source!=="detect"?"מיובאים":"אוטומטיים",f=t.source==="dxf"?" · מיובאים מ־DXF":t.source==="ifc"?` · ${z("origin")}`:t.elapsedMs!==null?` · זוהו ב־${(t.elapsedMs/1e3).toFixed(1)} שנ׳`:"";return l`<div class="note" data-detect-summary>${x(i.walls.length,"קיר אחד","קירות")} · ${x(i.openings.length,"פתח אחד","פתחים")}${i.objects.length?` · ${x(i.objects.length,"עצם אחד","עצמים")}`:""} · <span data-detect-accepted>${e.acceptedCount}</span> מסומנים לאישור${f}</div>
    ${we(i)?l`<div class="note warn" data-detect-outside-main>${we(i)}</div>`:c}
    ${t.ifc?l`<div class="note" data-ifc-summary>${Jt(t.ifc)}</div>
      ${t.ifc.skipped_total?l`<ul class="note ifc-skipped" data-ifc-skipped>${Vt(t.ifc).map(d=>l`<li>${d}</li>`)}</ul>`:c}`:c}
    ${s.length?c:l`<div class="note" data-detect-empty>לא נמצאו קירות. נסה עוצמת ניקוי אחרת, או צייר בכלי "מבנה".</div>`}
    ${t.hint&&e.estimated&&e.canEstimate&&!e.hintApplied?l`<div class="hint" data-calib-hint>
          <div>התוכנית לא מכוילת. לפי רוחב דלת אופייני (0.9 מ׳, ${x(t.hint.doors,"דלת אחת","דלתות")}): <strong>${F(t.hint.scale_m_per_px)}</strong> — משוער.</div>
          <div class="btns"><sw-button size="sm" icon="scale" data-calib-hint-apply ?disabled=${e.busy} @click=${()=>a.applyHint()}>השתמש בהערכה</sw-button><span class="note">מומלץ לפני האישור: המידות במטרים של המועמדים יחושבו לפי ההערכה, ויוצגו עם ≈ עד כיול בשתי נקודות</span></div>
        </div>`:e.hintApplied?l`<div class="note" data-calib-hint-applied>קנה מידה משוער נשמר (≈ ${F(e.scale)}); כיול בשתי נקודות יחליף אותו</div>`:c}
    <div class="modes" role="group" aria-label="קבלת מועמדים">
      <button data-detect-accept-all ?disabled=${e.busy} @click=${()=>a.acceptAll()}>קבל הכול</button>
      <button data-detect-accept-conf ?disabled=${e.busy} @click=${()=>a.acceptAbove(.8)}>קבל מעל 0.8</button>
      ${n.map(d=>l`<button data-detect-accept-kind=${d} ?disabled=${e.busy} @click=${()=>a.acceptKinds([d])}>${Da[d]}</button>`)}
      <button data-detect-reject-all ?disabled=${e.busy} @click=${()=>a.rejectAll()}>דחה הכול</button>
    </div>
    <div class="note">${e.narrow?l`<span data-detect-phone-note>בטלפון אפשר לקבל או לדחות מועמדים; תיקון קצוות של קיר מועמד זמין במסך רחב.</span>`:"לחיצה על מועמד במפה או על התיבה ברשימה מקבלת / דוחה אותו; גרירת קצה של הקיר המסומן מתקנת אותו לפני האישור."}</div>
    <div class="dlist" data-cand-list>
      ${s.slice(0,ne).map(d=>{const b=Me(i,d),$=t.states[d]??"accepted";return l`<div class="dcand ${$} ${d===t.sel?"on":""} ${u.has(d)?"bad":""}" data-cand-row=${d} data-cand-state=${$} ?data-cand-bad=${u.has(d)}>
          <input type="checkbox" aria-label=${`קבל ${H[b]}`} .checked=${$==="accepted"} ?disabled=${e.busy} @change=${()=>a.toggle(d)} />
          <button class="linkbtn" aria-label=${`${H[b]} ${le(i,d).toFixed(2)}${q(i,d)?` ${K}`:""}`} @click=${()=>a.focus(d)}>${H[b]}</button>
          ${q(i,d)?l`<span class="outside" data-cand-outside-main>${K}</span>`:c}
          <span class="muted ltr" aria-hidden="true">${le(i,d).toFixed(2)}</span>
        </div>`})}
      ${s.length>ne?l`<div class="note">מוצגים ${ne} הראשונים ברשימה; במפה מוצגים כולם.</div>`:c}
    </div>
    ${o?l`<div class="note" data-cand-selected=${o.id}>${H[o.kind]} נבחר${q(i,o.id)?` · ${K}`:""} · ביטחון ${o.score.toFixed(2)} · ${Ia(e,i,o.id)} · ${(t.states[o.id]??"accepted")==="accepted"?"יאושר":"נדחה"}</div>`:c}
    ${i.objects.length?l`<label class="chk"><input type="checkbox" data-detect-objects .checked=${e.objectsOn} @change=${d=>a.setObjects(d.target.checked)} /> כולל ${Je(i,t.source)}</label>`:c}
    ${m?l`<label class="chk"><input type="checkbox" data-detect-replace .checked=${e.opts.replaceAuto} @change=${d=>a.setOpts({...e.opts,replaceAuto:d.target.checked})} /> החלף ${h} קודמים (${m} בטיוטה)</label>`:c}
    ${t.rooms?l`<div class="btns"><sw-button size="sm" icon="map" data-detect-rooms ?disabled=${e.busy} @click=${()=>a.importRooms()}>ייבא ${x(t.rooms,"חדר אחד","חדרים")} כאזורים</sw-button><span class="note">החדרים נשמרים כאזורים, לא כחלק מהמבנה</span></div>`:c}
    ${p?l`<div class="err" role="alert" data-detect-accept-error=${p.code}>${p.message}</div>
          ${p.issues.length?l`<div class="issues" data-detect-issues>${p.issues.slice(0,20).map(d=>l`<button class="issue error" ?disabled=${!d.id||!s.includes(d.id)} @click=${()=>{d.id&&a.focus(d.id)}}>${d.message}</button>`)}</div>`:c}
          ${p.stale?l`<div class="btns"><sw-button size="sm" icon="refresh" data-detect-reload ?disabled=${e.busy} @click=${()=>a.reload()}>טען את הטיוטה מחדש</sw-button><span class="note">המועמדים נשארים; אחרי הטעינה אשר שוב</span></div>`:c}`:c}
    ${e.ask?l`<div class="hint" data-detect-replace-confirm>
          <div><strong>להחליף את ה${h} הקודמים?</strong></div>
          <div data-detect-replace-counts>יוסרו מהטיוטה ${x(e.ask.existing.walls,"קיר אחד","קירות")} ו־${x(e.ask.existing.openings,"פתח אחד","פתחים")}${e.ask.existing.objects?` ו־${x(e.ask.existing.objects,"עצם אחד","עצמים")}`:""} ${h} שנוספו קודם (פריטים נעולים נשארים).</div>
          ${e.ask.manualOnAuto?l`<div class="err" data-detect-replace-manual>${x(e.ask.manualOnAuto,"פתח ידני אחד","פתחים ידניים")} על קירות אלה ${e.ask.manualOnAuto===1?"יוסר":"יוסרו"} איתם.</div>`:l`<div class="note">פתח ידני שיושב על קיר שיוסר — יוסר איתו.</div>`}
          <div class="btns">
            <sw-button variant="primary" size="sm" icon="check" data-detect-replace-go ?disabled=${e.busy} @click=${()=>a.confirmReplace()}>החלף ואשר ${e.acceptedCount}</sw-button>
            <sw-button variant="ghost" size="sm" data-detect-replace-cancel ?disabled=${e.busy} @click=${()=>a.cancelReplace()}>חזור</sw-button>
          </div>
        </div>`:l`<div class="btns">
          <sw-button variant="primary" size="sm" icon="check" data-detect-confirm ?disabled=${e.busy||!e.acceptedCount} @click=${()=>a.confirm()}>אשר ${e.acceptedCount}</sw-button>
          <sw-button variant="ghost" size="sm" data-detect-discard ?disabled=${e.busy} @click=${()=>a.discard()}>בטל</sw-button>
        </div>`}
    <div class="note">האישור מוסיף לטיוטת המבנה בלבד (Ctrl+Z מבטל); הצופים יראו את התוצאה אחרי פרסום.</div>`}const re=60;let I=null;function La(e,t,a){if(I&&I.pool===e&&I.q===t&&I.category===a)return I.found;const i=Lt(e,t,a);return I={pool:e,q:t,category:a,found:i},i}function gs(e,t){const a=e.category==="recent"||e.category==="favorites",i=e.category==="recent"?e.recent.map(n=>e.lib.items.find(o=>o.id===n)).filter(n=>!!n):e.category==="favorites"?e.lib.items.filter(n=>e.favorites.includes(n.id)):e.lib.items,s=La(i,e.q,a?null:e.category),r=s.slice(0,re);return l`<sw-card heading="ספריית עצמים" subheading=${e.placing?`לחץ על התוכנית כדי להציב: ${e.placing.names.he} · Esc לביטול`:`${e.lib.items.length} פריטים · חיפוש בעברית ובאנגלית`} data-library-panel data-studio-save=${e.saveState}>
    <sw-field><input type="search" data-lib-search placeholder="חיפוש: כיסא, מטף, bleachers…" .value=${e.q} @input=${n=>t.setQuery(n.target.value)} /></sw-field>
    <div class="modes" role="group" aria-label="קטגוריות">
      <button class=${e.category===null?"on":""} data-lib-cat="all" @click=${()=>t.setCategory(null)}>הכול</button>
      <button class=${e.category==="recent"?"on":""} data-lib-cat="recent" @click=${()=>t.setCategory("recent")}>לאחרונה</button>
      <button class=${e.category==="favorites"?"on":""} data-lib-cat="favorites" @click=${()=>t.setCategory("favorites")}>מועדפים</button>
      ${e.lib.categories.map(n=>l`<button class=${e.category===n.id?"on":""} data-lib-cat=${n.id} @click=${()=>t.setCategory(n.id)}>${n.he}</button>`)}
    </div>
    ${e.placing?l`<div class="btns"><sw-button size="sm" variant="ghost" data-lib-cancel @click=${()=>t.cancelPlacing()}>סיים הצבה</sw-button></div>`:c}
    <div class="list libl">
      ${r.length?r.map(n=>l`<div class="libitem ${e.placing?.id===n.id?"on":""}" data-lib-item=${n.id} role="button" tabindex="0" draggable="true" title=${`${n.names.he} · ${n.size.w_m}×${n.size.d_m}×${n.size.h_m} מ׳`}
          @dragstart=${o=>o.dataTransfer?.setData("text/x-sw-item",n.id)} @click=${()=>t.pick(n)} @keydown=${o=>(o.key==="Enter"||o.key===" ")&&t.pick(n)}>
          <span class="nm">${n.names.he}${n.custom?l` <span class="muted">מותאם</span>`:c}</span>
          <span class="muted ltr">${n.size.w_m}×${n.size.d_m} m</span>
          <button class="fav ${e.favorites.includes(n.id)?"on":""}" data-lib-fav=${n.id} aria-label="מועדף" aria-pressed=${e.favorites.includes(n.id)?"true":"false"} @click=${o=>{o.stopPropagation(),t.toggleFavorite(n.id)}}><sw-icon name="star" size=${14}></sw-icon></button>
        </div>`):l`<div class="note">${e.category==="recent"?"עדיין לא הוצבו פריטים בדפדפן הזה.":e.category==="favorites"?"סמן את הכוכב ליד פריט כדי לשמור אותו כאן.":"לא נמצאו פריטים."}</div>`}
    </div>
    ${s.length>re?l`<div class="note" data-lib-more>מוצגים ${re} · חפש או בחר קטגוריה</div>`:c}
    ${e.phone?l`<div class="note">בטלפון: הצבה והזזה של עצם בודד; מערכים וציור קירות בדסקטופ.</div>`:c}
    ${e.canManage?l`<div class="exports" role="group" aria-label="הספרייה המותאמת">
      <a class="btnlink" data-lib-export href=${e.exportHref} download>ייצוא הספרייה המותאמת</a>
      <label class="btnlink">ייבוא<input type="file" accept="application/json,.json" data-lib-import hidden @change=${n=>{const o=n.target.files?.[0];o&&t.importFile(o),n.target.value=""}} /></label>
    </div>`:c}
  </sw-card>`}function Fa(e,t,a,i,s){const r=e.params[t];if(a.type==="level")return l`<sw-field label=${a.he}><select data-object-param=${t} @change=${o=>s.patch(e.id,{params:{...e.params,[t]:o.target.value||null}})}>
      <option value="" ?selected=${!r}>ללא</option>${i.filter(o=>o.id!==e.level_id).map(o=>l`<option value=${o.id} ?selected=${r===o.id}>${o.name} (${o.elevation_m} מ׳)</option>`)}</select></sw-field>`;const n=a.type==="int"?1:.1;return l`<sw-field label=${a.he}><input type="number" data-ltr data-object-param=${t} min=${String(a.min??"")} max=${String(a.max??"")} step=${String(n)} .value=${r==null?"":String(r)}
    @change=${o=>{const p=a.type==="int"?parseInt(o.target.value,10):parseFloat(o.target.value);Number.isFinite(p)&&(a.min===void 0||p>=a.min)&&(a.max===void 0||p<=a.max)&&s.patch(e.id,{params:{...e.params,[t]:p}})}} /></sw-field>`}function ms(e,t){const a=e.o,i=e.item?.names.he??a.item_id,s=a.group_id?e.doc.groups.find(n=>n.id===a.group_id):void 0,r=(n,o)=>l`<sw-field label=${o}><input type="number" min="0.05" max="100" step="0.05" data-ltr ?data-object-w=${n==="w_m"} ?data-object-d=${n==="d_m"} ?data-object-h=${n==="h_m"} .value=${String(a.size[n])}
      @change=${p=>{const u=_(p);u>=.05&&u<=100&&t.patch(a.id,{size:{...a.size,[n]:u}})}} /></sw-field>`;return l`<sw-card heading=${i} subheading=${e.item?`${e.lib_category(e.item)}${e.item.custom?" · פריט מותאם":""}`:"הפריט לא קיים בספרייה: העצם מצויר כתיבה"} data-selected-object=${a.id}>
    <sw-field label="שם על המפה (אופציונלי)"><input type="text" maxlength="80" data-object-label .value=${a.label??""} @change=${n=>t.patch(a.id,{label:n.target.value.trim()||null})} /></sw-field>
    ${a.anchor_ref?l`<div class="note" data-object-bound>הגוף של ${e.anchorName??a.anchor_ref.resource_id}: המיקום, המצב וההרשאות מהעוגן. <button class="linkbtn" data-object-unbind @click=${()=>t.unbind(a.id)}>נתק מהישות</button></div>`:c}
    <div class="two">
      <sw-field label="מפלס"><select data-item-level @change=${n=>t.patch(a.id,{level_id:n.target.value})}>${e.levels.map(n=>l`<option value=${n.id} ?selected=${n.id===a.level_id}>${n.name}</option>`)}</select></sw-field>
      <sw-field label="סיבוב (°)"><input type="number" min="0" max="359" step="1" data-ltr data-object-rotation .value=${String(Math.round(a.rotation_deg))} ?disabled=${!!a.anchor_ref}
        @change=${n=>{const o=_(n);Number.isFinite(o)&&t.patch(a.id,{rotation_deg:(Math.round(o)%360+360)%360})}} /></sw-field>
    </div>
    <div class="three">${r("w_m","רוחב (מ׳)")}${r("d_m","עומק (מ׳)")}${r("h_m","גובה (מ׳)")}</div>
    <sw-field label="גובה מהרצפה (מ׳)"><input type="number" min="-50" max="500" step="0.05" data-ltr data-object-z .value=${String(a.z_m)} @change=${n=>{const o=_(n);o>=-50&&o<=500&&t.patch(a.id,{z_m:o})}} /></sw-field>
    ${e.item?Object.entries(e.item.params_schema).map(([n,o])=>Fa(a,n,o,e.levels,t)):c}
    ${t.setMaterial&&e.materialDefault?Ie({key:`objects:${a.id}`,label:"חומר",host:"object",value:a.material_id??null,defaultId:e.materialDefault,style:e.materialStyle??"light"},{pick:n=>t.setMaterial(a.id,n),setStyle:n=>t.setMaterialStyle?.(n)}):c}
    ${Pe(a.tags,n=>t.patch(a.id,{tags:n}))}
    ${s?l`<div class="note" data-object-group>חלק ממערך של ${s.member_ids.length}${t.selectGroup?l` · <button class="linkbtn" data-select-group @click=${()=>t.selectGroup?.(s.id)}>בחר את המערך</button>`:c}</div>`:c}
    <div class="note">${e.estimated?e.showEstimates?"המידות במטרים משוערות (≈) עד הכיול":"לא מכויל: המידות מוצגות כערכי הפריט":"המידות במטרים לפי הכיול"} · חצים = הזזה עדינה (Shift = גדולה) · Alt+גרירה = שכפול · Delete = מחיקה</div>
    <div class="btns">
      ${t.duplicate?l`<sw-button size="sm" icon="layers" data-object-duplicate title="עותק ליד העצם, נבחר ומוכן לגרירה (גם Ctrl+D, או Alt+גרירה של העצם)" @click=${()=>t.duplicate?.(a.id)}>שכפל</sw-button>`:c}
      ${t.array?l`<sw-button size="sm" icon="grid" data-object-array ?disabled=${e.phone||!!a.anchor_ref||!!a.group_id} title=${e.phone?"מערכים בדסקטופ בלבד":a.group_id?"העצם כבר במערך":"שורות × עמודות מהעצם הזה"} @click=${()=>t.array?.(a.id)}>מערך</sw-button>`:c}
      ${e.canManage&&t.custom?l`<sw-button size="sm" icon="plus" data-object-custom @click=${()=>t.custom?.(a.id)}>צור פריט מזה</sw-button>`:c}
      <sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>t.remove(a.id)}>מחק</sw-button>
    </div>
  </sw-card>`}function $s(e,t,a){const i=e.params;return l`<sw-card heading=${e.kind==="array"?`מערך של ${e.member_ids.length}`:`קבוצה של ${e.member_ids.length}`} subheading=${t?t.names.he:""} data-selected-group=${e.id}>
    ${e.kind==="array"&&i.rows?l`<div class="note">${i.rows} שורות × ${i.cols} עמודות · רווח ${i.spacing_x_m} × ${i.spacing_y_m} מ׳</div>`:c}
    <div class="note">גרירת אחד העצמים מזיזה את כל המערך · Delete מוחק (ושואל אם למחוק גם את העצמים)</div>
    <div class="btns">
      ${e.member_ids[0]?l`<sw-button size="sm" variant="ghost" data-group-first @click=${()=>a.select(e.member_ids[0])}>בחר עצם אחד</sw-button>`:c}
      <sw-button size="sm" variant="danger" icon="trash" data-group-delete @click=${()=>a.askDelete(e.id)}>מחק מערך</sw-button>
    </div>
  </sw-card>`}const Na="Shift+לחיצה מוסיפה קיר, עצם או אזור לבחירה או מוציאה אותו ממנה; גרירת מלבן מרקע ריק בוחרת את מה שנמצא בתוכו במלואו; Ctrl+A בוחר את כל מה שמוצג במפלס; Esc מנקה. הזזת התוכנית: רווח + גרירה, או גרירה בכפתור האמצעי; גלגלת לזום.",Ta=[{title:"בחירה",items:[{keys:"Shift+לחיצה",desc:"מוסיף פריט לבחירה או מוציא אותו ממנה"},{keys:"גרירת מלבן מרקע ריק",desc:"בוחרת את כל מה שבתוכה במלואו"},{keys:"Ctrl+A",desc:"בוחר את כל מה שמוצג במפלס הנוכחי"},{keys:"Esc",desc:"מנקה את הבחירה, או סוגר את הפעולה הפתוחה"}]},{title:"עריכה",items:[{keys:"Delete / Backspace",desc:"מוחק את מה שנבחר"},{keys:"Ctrl+D",desc:"משכפל את מה שנבחר"},{keys:"Alt+גרירה",desc:"גורר עותק, במקום להזיז את המקור"},{keys:"חצים",desc:"מזיזים את הנבחר צעד קטן; Shift+חץ = צעד גדול"},{keys:"Ctrl+Z / Ctrl+Y",desc:"ביטול וחזרה על הפעולה האחרונה"},{keys:"Ctrl+S",desc:"שמירה"}]},{title:"תצוגה וניווט",items:[{keys:"רווח+גרירה, או גרירה בכפתור האמצעי",desc:"מזיז את התוכנית (פאן)"},{keys:"כפתור היד בסרגל העליון",desc:"מצב הזזה קבוע: כל גרירה מזיזה את התוכנית, עד לחיצה חוזרת עליו או Esc"},{keys:"גלגלת העכבר",desc:"זום פנימה והחוצה סביב הסמן"}]},{title:"כלים ספציפיים",items:[{keys:"ציור קיר (מבנה)",desc:"Enter מסיים את הקיר; Backspace/Delete מוחק את הנקודה האחרונה"},{keys:"D",desc:"סמן דלת (כלי המבנה): לחיצה על סמל דלת מציעה אותה; Enter מאשר, Esc מבטל את ההצעה"},{keys:"R",desc:v("tipCurved")},{keys:"G",desc:g("toolTip")},{keys:"C",desc:v("tipCurve")},{keys:"ציור אזור",desc:"לחיצה מוסיפה פינה; Enter מסיים משלוש פינות; Esc מבטל"},{keys:"מפלסים ומחברים",desc:"Esc מבטל את נקודת ההתחלה שנבחרה למחבר"},{keys:"מדידה / כיול",desc:"Esc מנקה את הנקודות שנבחרו עד כה"},{keys:"זיהוי אוטומטי",desc:"Delete/Backspace מסיר מועמד נבחר; Esc סוגר וחוזר לכלי הבחירה"},{keys:"מעגלי תאורה",desc:"Esc מבטל את סוג הגוף הממתין להצבה, ואז סוגר את מצב חברי המעגל"}]}];function hs(e){return l`<sw-dialog open heading="קיצורי מקלדת" subheading="כל הקיצורים הפעילים כרגע בעורך התוכנית" data-shortcuts-dialog @close=${e}>
    <div class="shortcuts">
      ${Ta.map(t=>l`<div class="shortcuts-group" data-shortcuts-group=${t.title}>
          <h4>${t.title}</h4>
          ${t.items.map(a=>l`<div class="shortcuts-row" data-shortcuts-row><kbd>${a.keys}</kbd><span>${a.desc}</span></div>`)}
        </div>`)}
    </div>
    <sw-button slot="footer" variant="primary" data-shortcuts-close @click=${e}>סגור</sw-button>
  </sw-dialog>`}function Te(e,t,a){const i=n=>{const o=n?$t(n.value):null;!n||!o||(t(o),n.value="")},s=!!(e.full||e.disabled),r=e.bulk?"לחיצה על תגית מסירה אותה מכל הנבחרים שיש להם אותה (המספר: כמה מהם); תגית חדשה נוספת לכולם":e.full?`הגעת למקסימום של ${oe} תגיות; לחיצה על תגית מסירה אותה`:`לסימון ולבחירה מהירה (בחירה לפי תגית ליד המפלסים) · לחיצה על תגית מסירה אותה · עד ${oe} תגיות של ${ve} תווים`;return l`<sw-field label=${e.bulk?"תגיות בבחירה":"תגיות"} hint=${r}><div class="tagsfield" data-tags-field>
    ${e.chips.length?l`<div class="tagchips" data-tag-chips>${e.chips.map(n=>l`<sw-chip icon="close" data-tag=${n.tag} data-tag-count=${e.bulk&&n.count!==void 0?String(n.count):c} .count=${e.bulk?n.count:void 0}
          title=${e.bulk?`הסר את "${n.tag}" מכל הנבחרים`:`הסר את התגית "${n.tag}"`} @click=${()=>{e.disabled||a(n.tag)}}>${n.tag}</sw-chip>`)}</div>`:l`<div class="note" data-tag-none>${e.bulk?"לאף פריט בבחירה אין תגיות":"אין תגיות"}</div>`}
    <div class="tagadd">
      <input type="text" maxlength=${String(ve)} data-tag-input aria-label=${e.bulk?"תגית להוספה לכל הנבחרים":"תגית חדשה"} placeholder="תגית חדשה, למשל: מטבח" ?disabled=${s}
        @keydown=${n=>{n.key==="Enter"&&(n.preventDefault(),i(n.target))}} />
      <sw-button size="sm" icon="plus" data-tag-add ?disabled=${s} @click=${n=>i(n.currentTarget.parentElement?.querySelector("input"))}>${e.bulk?"הוסף לכולם":"הוסף"}</sw-button>
    </div>
  </div></sw-field>`}function Pe(e,t){const a=i=>{i!==e&&!(e===void 0&&!i.length)&&t(i)};return Te({chips:(e??[]).map(i=>({tag:i})),full:(e?.length??0)>=oe},i=>a(mt(e,i)),i=>a(gt(e,i)))}function ws(e,t){return l`<select class="tagpick" data-tag-select aria-label="בחירה לפי תגית" title="בוחר את כל הקירות, העצמים והאזורים עם התגית, במפלס המוצג"
    @change=${a=>{const i=a.target,s=i.value;i.value="",s&&t(s)}}>
    <option value="" selected>בחירה לפי תגית…</option>${e.map(a=>l`<option value=${a.tag}>${a.tag} (${a.count})</option>`)}
  </select>`}const Pa=[{mode:"left",label:"יישור לשמאל",title:"הקצוות השמאליים של העצמים על הקצה השמאלי של הבחירה"},{mode:"right",label:"יישור לימין",title:"הקצוות הימניים של העצמים על הקצה הימני של הבחירה"},{mode:"top",label:"יישור למעלה",title:"הקצוות העליונים של העצמים על הקצה העליון של הבחירה"},{mode:"bottom",label:"יישור למטה",title:"הקצוות התחתונים של העצמים על הקצה התחתון של הבחירה"},{mode:"center-y",label:"מרכזים בקו אופקי",title:"מרכזי העצמים על קו אופקי אחד, באמצע הבחירה (למשל שורת מנורות)"},{mode:"center-x",label:"מרכזים בקו אנכי",title:"מרכזי העצמים על קו אנכי אחד, באמצע הבחירה"}];function ja(e,t){if(e.alignable<2)return l``;const a=e.walls+e.zones,i=`ביחס למסגרת של ${e.alignable} העצמים שנבחרו · צעד ביטול אחד${a?" · קירות ואזורים שבבחירה לא זזים":""}`;return l`<sw-field label="יישור ופיזור העצמים" hint=${i}><div class="alignbtns" data-multi-align>
    ${Pa.map(s=>l`<sw-button size="sm" variant="ghost" data-align=${s.mode} title=${s.title} ?disabled=${e.busy} @click=${()=>t.align(s.mode)}>${s.label}</sw-button>`)}
    <sw-button size="sm" variant="ghost" data-distribute="x" ?disabled=${e.busy||e.alignable<3} title=${e.alignable<3?"פיזור צריך לפחות שלושה עצמים":"רווחים שווים בין העצמים לרוחב; הקיצוניים נשארים במקומם"} @click=${()=>t.distribute("x")}>פיזור שווה לרוחב</sw-button>
    <sw-button size="sm" variant="ghost" data-distribute="y" ?disabled=${e.busy||e.alignable<3} title=${e.alignable<3?"פיזור צריך לפחות שלושה עצמים":"רווחים שווים בין העצמים לגובה; הקיצוניים נשארים במקומם"} @click=${()=>t.distribute("y")}>פיזור שווה לגובה</sw-button>
  </div></sw-field>`}const Ra=["צפוף מאוד","צפוף","בינוני","מרווח","רחב","רחב מאוד"];function fs(e,t,a){const i=e.estimated&&!e.showEstimates,s=(n,o)=>i?Ra[o]??E(n,!1):E(n,e.estimated),r=e.estimated?"לפי קנה מידה משוער עד שהתוכנית תכויל":"לפי קנה המידה המכויל של התוכנית";return l`<div class="gridopts" data-grid-options>
    <label><input type="checkbox" data-grid-toggle .checked=${e.on} @change=${n=>t(n.target.checked)} /> רשת עזר</label>
    <div class="note">גרירה והצבה של עצם נצמדות לצמתי הרשת; Ctrl בזמן הגרירה - בלי הצמדה.</div>
    <sw-field label="מרווח הרשת" hint=${r}>
      <select data-grid-step ?disabled=${!e.on} @change=${n=>a(Number(n.target.value))}>
        ${e.steps.map((n,o)=>l`<option value=${String(n)} ?selected=${n===e.stepM}>${s(n,o)}</option>`)}
      </select>
    </sw-field>
    <div class="note">בזמן גרירה של עצם מופיעים קווי יישור כשקצה או מרכז שלו מתיישר עם עצם אחר, והעצם נצמד אליהם.</div>
  </div>`}function vs(e,t){const a=e.walls+e.objects+e.zones,i=[e.walls?x(e.walls,"קיר אחד","קירות"):"",e.objects?x(e.objects,"עצם אחד","עצמים"):"",e.zones?x(e.zones,"אזור אחד","אזורים"):""].filter(Boolean).join(" · ");return l`<sw-card heading=${`${a} פריטים נבחרו`} subheading=${`${i} · ${B[e.saveState]}`} data-multi-panel data-multi-count=${a} data-studio-save=${e.saveState}>
    <div class="note">גרירת אחד מהם מזיזה את כולם יחד · Delete מוחק את כולם · Ctrl+D משכפל את העצמים שבבחירה</div>
    ${e.zones?l`<div class="note" data-multi-zones-note>הזזה, מחיקה, תגיות ומפלס של אזורים נשמרים מיד ואינם חלק מהביטול (Ctrl+Z); קירות ועצמים חוזרים בצעד ביטול אחד</div>`:c}
    ${e.note?l`<div class="note multinote" data-multi-note role="status">${e.note}</div>`:c}
    ${ja(e,t)}
    ${Te({chips:e.tags,bulk:!0,disabled:e.busy},s=>t.addTag(s),s=>t.removeTag(s))}
    ${e.levels.length>1?l`<sw-field label="העבר את כל הבחירה למפלס" hint="קירות ועצמים בצעד ביטול אחד; הפתחים עוברים עם הקיר שלהם">
          <select data-multi-level ?disabled=${e.busy} @change=${s=>{const r=s.target,n=r.value;r.value="",n&&t.setLevel(n)}}>
            <option value="" selected>בחר מפלס…</option>${e.levels.map(s=>l`<option value=${s.id}>${s.name} (${s.elevation_m} מ׳)</option>`)}
          </select></sw-field>`:c}
    ${e.lights?l`<sw-field label="הוסף למעגל תאורה" hint=${e.lights===a?"כל הנבחרים הם גופי תאורה":`רק ${x(e.lights,"גוף התאורה שבבחירה מצטרף","גופי התאורה שבבחירה מצטרפים")}; קירות, אזורים ועצמים אחרים לא`}>
          ${e.circuits.length?l`<div class="tagchips" data-multi-circuits>${e.circuits.map(s=>l`<sw-chip dot=${me(s.color_token)} data-multi-circuit=${s.id} title=${`הוסף את גופי התאורה שבבחירה למעגל ${s.name}`} @click=${()=>{e.busy||t.joinCircuit(s.id)}}>${s.name}</sw-chip>`)}</div>`:l`<div class="note" data-multi-no-circuits>אין עדיין מעגלים בקומה; צור מעגל בכלי "מעגלי תאורה".</div>`}
        </sw-field>`:c}
    <div class="btns">
      ${e.objects?l`<sw-button size="sm" icon="layers" data-multi-duplicate ?disabled=${e.busy} title="עותק של כל העצמים שנבחרו, כגוש אחד ליד הבחירה (גם Ctrl+D)" @click=${()=>t.duplicate()}>${e.objects===1?"שכפל את העצם":`שכפל ${e.objects} עצמים`}</sw-button>`:c}
      <sw-button size="sm" variant="danger" icon="trash" data-multi-delete ?disabled=${e.busy} @click=${()=>t.remove()}>מחק הכל</sw-button>
      <sw-button size="sm" variant="ghost" data-multi-clear @click=${()=>t.clear()}>נקה בחירה</sw-button>
    </div>
    <div class="note" data-multi-hint>${Na}</div>
  </sw-card>`}function xs(e,t,a,i){const s=Math.floor(e.rows)*Math.floor(e.cols),r=s>=2&&s<=e.max&&e.spacingX>0&&e.spacingY>0,n=o=>parseFloat(o.target.value);return l`<sw-dialog open heading="מערך" subheading=${`שורות × עמודות של ${e.item?.names.he??"העצם"}; העצם שנבחר הוא הראשון`} data-array-dialog @close=${i}>
    ${e.error?l`<div class="err" data-array-error>${e.error}</div>`:c}
    <div class="two">
      <sw-field label="שורות"><input type="number" min="1" max="60" step="1" data-ltr data-array-rows .value=${String(e.rows)} @input=${o=>t({rows:Math.max(1,n(o)||1)})} /></sw-field>
      <sw-field label="עמודות"><input type="number" min="1" max="60" step="1" data-ltr data-array-cols .value=${String(e.cols)} @input=${o=>t({cols:Math.max(1,n(o)||1)})} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="רווח בין עמודות (מ׳)"><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sx .value=${String(e.spacingX)} @input=${o=>t({spacingX:n(o)})} /></sw-field>
      <sw-field label="רווח בין שורות (מ׳)"><input type="number" min="0.05" max="50" step="0.05" data-ltr data-array-sy .value=${String(e.spacingY)} @input=${o=>t({spacingY:n(o)})} /></sw-field>
    </div>
    <sw-field label="כיוון (°)" hint="0 = העמודות ימינה והשורות למטה; 90 = מסובב"><input type="number" min="0" max="359" step="1" data-ltr data-array-dir .value=${String(e.directionDeg)} @input=${o=>t({directionDeg:n(o)||0})} /></sw-field>
    <div class="note" data-array-total>${s} עצמים${s>e.max?` · יותר מ־${e.max} במערך אחד`:""}</div>
    <sw-button slot="footer" variant="ghost" data-array-cancel @click=${i}>ביטול</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-array-create ?disabled=${!r} @click=${a}>צור מערך</sw-button>
  </sw-dialog>`}function ks(e,t,a,i){return l`<sw-dialog open heading="מחיקת מערך" subheading=${`המערך מכיל ${e} עצמים`} data-group-delete-dialog @close=${i}>
    <div class="note">למחוק גם את העצמים, או להשאיר אותם על המפה כעצמים בודדים?</div>
    <sw-button slot="footer" variant="ghost" data-group-delete-cancel @click=${i}>ביטול</sw-button>
    <sw-button slot="footer" data-group-delete-keep @click=${a}>השאר את העצמים</sw-button>
    <sw-button slot="footer" variant="danger" icon="trash" data-group-delete-all @click=${t}>מחק הכול</sw-button>
  </sw-dialog>`}function ys(e,t,a,i,s){const r=u=>parseFloat(u.target.value),n=u=>u>=.05&&u<=100,o=!(n(e.size.w_m)&&n(e.size.d_m)&&n(e.size.h_m)),p=(u,m)=>l`<sw-field label=${m}><input type="number" min="0.05" max="100" step="0.05" data-ltr ?data-custom-w=${u==="w_m"} ?data-custom-d=${u==="d_m"} ?data-custom-h=${u==="h_m"}
      aria-invalid=${n(e.size[u])?"false":"true"} style=${n(e.size[u])?"":"border-color: var(--sw-danger)"} .value=${Number.isFinite(e.size[u])?String(e.size[u]):""}
      @input=${h=>a({size:{...e.size,[u]:r(h)}})} /></sw-field>`;return l`<sw-dialog open heading="פריט מותאם" subheading=${e.basedOn?`מבוסס על ${t.items.find(u=>u.id===e.basedOn)?.names.he??e.basedOn}: הפריט החדש נשמר בספרייה של המתקן`:"פריט חדש בספרייה של המתקן"} data-custom-dialog @close=${s}>
    ${e.error?l`<div class="err">${e.error}</div>`:c}
    <div class="two">
      <sw-field label="שם (עברית)"><input type="text" maxlength="80" data-custom-name .value=${e.nameHe} @input=${u=>a({nameHe:u.target.value})} /></sw-field>
      <sw-field label="שם (אנגלית, לחיפוש)"><input type="text" maxlength="80" data-ltr data-custom-name-en .value=${e.nameEn} @input=${u=>a({nameEn:u.target.value})} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="קטגוריה"><select data-custom-category @change=${u=>a({category:u.target.value})}>${t.categories.map(u=>l`<option value=${u.id} ?selected=${u.id===e.category}>${u.he}</option>`)}</select></sw-field>
      <sw-field label="צורה"><select data-custom-shape @change=${u=>a({shape:u.target.value})}>${ct.map(u=>l`<option value=${u} ?selected=${u===e.shape}>${u}</option>`)}</select></sw-field>
    </div>
    <div class="two">
      <sw-field label="סמל"><select data-custom-icon @change=${u=>a({icon:u.target.value})}>${ut.map(u=>l`<option value=${u} ?selected=${u===e.icon}>${u}</option>`)}</select></sw-field>
      <sw-field label="צבע"><select data-custom-color @change=${u=>a({color:u.target.value})}>${pt.map(u=>l`<option value=${u} ?selected=${u===e.color}>${u}</option>`)}</select></sw-field>
    </div>
    <div class="three">${p("w_m","רוחב (מ׳)")}${p("d_m","עומק (מ׳)")}${p("h_m","גובה (מ׳)")}</div>
    ${o?l`<div class="err" data-custom-size-error>כל מידה בין 0.05 ל־100 מ׳</div>`:c}
    <div class="note">הגובה מהרצפה, הפרמטרים וסוגי הישויות נלקחים מהפריט שעליו הוא מבוסס.</div>
    <sw-button slot="footer" variant="ghost" data-custom-cancel @click=${s}>ביטול</sw-button>
    <sw-button slot="footer" variant="primary" icon="check" data-custom-create ?disabled=${e.busy||!e.nameHe.trim()||o} @click=${i}>${e.busy?"שומר…":"צור פריט"}</sw-button>
  </sw-dialog>`}function _s(e,t,a,i,s){if(e.length<2&&!i)return l``;const r=n=>l`<sw-chip data-level-chip=${n.id} ?selected=${t===n.id} @click=${()=>a(n.id)}>${n.name} · ${n.elevation_m>=0?"+":"−"}${Math.abs(n.elevation_m).toFixed(1)} מ׳</sw-chip>`;return l`<div class="levelchips" role="group" aria-label="מפלסים" data-level-chips>
    <sw-chip data-level-chip="all" ?selected=${t===null} @click=${()=>a(null)}>כל המפלסים</sw-chip>
    ${[...e].sort((n,o)=>o.elevation_m-n.elevation_m).map(n=>s?l`<span class="levelchip">${r(n)}<sw-button variant="ghost" size="sm" iconOnly icon="edit" label=${`עריכת המפלס ${n.name}`} data-level-edit=${n.id} @click=${()=>s(n.id)}></sw-button></span>`:r(n))}
    ${i?l`<sw-chip data-level-add icon="plus" @click=${i}>מפלס</sw-chip>`:c}
  </div>`}function zs(e,t){const a=r=>parseFloat(r.target.value),i=e.name.trim().length>0&&e.elevation>=-50&&e.elevation<=500&&e.ceiling>0&&e.ceiling<=50,s=e.id!==null;return l`<sw-dialog open heading=${s?"עריכת מפלס":"מפלס חדש"} subheading="גובה הרצפה יחסית למפלס הראשי (0), וגובה התקרה מעליה" data-level-dialog data-level-editing=${e.id??c} @close=${t.cancel}>
    ${e.error?l`<div class="err" data-level-error>${e.error}</div>`:c}
    <sw-field label="שם"><input type="text" maxlength="60" data-level-name placeholder="למשל: אולם תחתון" .value=${e.name} @input=${r=>t.change({name:r.target.value})} /></sw-field>
    <div class="two">
      <sw-field label="גובה רצפה (מ׳)" hint="שלילי = מתחת למפלס הראשי"><input type="number" min="-50" max="500" step="0.1" data-ltr data-level-elevation .value=${String(e.elevation)} @input=${r=>t.change({elevation:a(r)})} /></sw-field>
      <sw-field label="גובה תקרה (מ׳)"><input type="number" min="0.1" max="50" step="0.1" data-ltr data-level-ceiling .value=${String(e.ceiling)} @input=${r=>t.change({ceiling:a(r)})} /></sw-field>
    </div>
    ${s&&e.isDefault?l`<div class="note" data-level-is-default>זה המפלס הראשי: פריטים חדשים מוצבים בו כשאין סינון מפלס.</div>`:c}
    ${s&&!e.isDefault?l`<label class="chk"><input type="checkbox" data-level-make-default .checked=${e.makeDefault} @change=${r=>t.change({makeDefault:r.target.checked})} /> הפוך למפלס הראשי</label>`:c}
    ${s?l`<sw-button slot="footer" variant="danger" icon="trash" data-level-delete @click=${t.remove}>מחק מפלס</sw-button>`:c}
    <sw-button slot="footer" variant="ghost" data-level-cancel @click=${t.cancel}>ביטול</sw-button>
    ${s?l`<sw-button slot="footer" variant="primary" icon="check" data-level-save ?disabled=${!i} @click=${t.submit}>שמור</sw-button>`:l`<sw-button slot="footer" variant="primary" icon="check" data-level-create ?disabled=${!i} @click=${t.submit}>הוסף מפלס</sw-button>`}
  </sw-dialog>`}const O={stairs:"מדרגות",ramp:"רמפה",tribune:"טריבונה",elevator:"מעלית",ladder:"סולם"};function ge(e,t){return t?e.find(a=>a.id===t)?.name??t:"לא נבחר"}function je(e,t){if(t.floor_ids.length){const a=t.far;return a?.missing?"קומה שנמחקה":a?.floor_name?a.level_name?`${a.floor_name} · ${a.level_name}`:a.floor_name:"קומה אחרת"}return ge(e,t.level_to)}function Re(e){return!!e.object_id||e.source==="auto"}const Ha={straight:["לחץ על תחילת המדרגות","לחץ על סוף המדרגות"],l:["לחץ על תחילת המהלך הראשון","לחץ על סוף המהלך הראשון (הכיוון והאורך)"],u:["לחץ על תחילת המהלך הראשון","לחץ על סוף המהלך הראשון (הכיוון והאורך)"]};function Ss(e,t){const a=e.doc.levels,i=o=>ge(a,o),s=e.sel,r=o=>parseFloat(o.target.value),n=e.mode==="stairs"?Ha[e.stairShape][e.start?1:0]:e.mode?e.start?`לחץ על הנקודה השנייה של ${O[e.mode]}`:`לחץ על הנקודה הראשונה של ${O[e.mode]}`:"";return l`<sw-card heading="מפלסים ומחברים" subheading=${e.mode?`${n}${e.start?" · Esc לביטול":""}`:"מדרגות, רמפה, מעלית וסולם בין מפלסים ובין קומות"} data-connector-panel data-studio-save=${e.saveState}>
    <div class="modes" role="group" aria-label="סוג מחבר">
      ${["stairs","ramp","elevator","ladder"].map(o=>l`<button class=${e.mode===o?"on":""} data-conn-mode=${o} aria-pressed=${e.mode===o} @click=${()=>t.setMode(e.mode===o?null:o)}>${O[o]}</button>`)}
    </div>
    ${e.mode==="stairs"?l`<div class="modes" role="group" aria-label="צורת המדרגות" data-stair-draw-shapes>
          ${He.map(o=>l`<button class=${e.stairShape===o?"on":""} data-stair-draw-shape=${o} aria-pressed=${e.stairShape===o} @click=${()=>t.setStairShape(o)}>${Ge[o]}</button>`)}
        </div>`:c}
    <sw-field label="גובה קומה (רצפה עד רצפה, מ׳)" hint="כמה עולות מדרגות לקומה שמעל; ברירת מחדל 3"><input type="number" min=${T[0]} max=${T[1]} step="0.05" data-ltr data-floor-height .value=${String(nt(e.doc))}
      @change=${o=>{const p=r(o);p>=T[0]&&p<=T[1]&&t.setFloorHeight(Math.round(p*100)/100)}} /></sw-field>
    <div class="note">שתי לחיצות על התוכנית מציירות מחבר (הצמדה לפינות קירות); במדרגות L ו־U הלחיצה השנייה קובעת את הכיוון ואת אורך המהלך הראשון, והפודסט והמהלך השני נוצרים לבד. מדרגות ומעלית מהספרייה מונחות כאן כמחבר. טריבונה היא עצם מהספרייה: המחבר שלה נוצר לבד כשמגדירים לאיזה מפלס היא יורדת.</div>
    ${e.doc.connectors.length?l`<div class="list">${e.doc.connectors.map(o=>l`<button class=${s?.id===o.id?"on":""} data-conn-row=${o.id} @click=${()=>t.select(o.id)}>
          <span>${O[o.kind]??o.kind}${Re(o)?" (מעצם)":""}</span><span class="note" style="margin:0">${i(o.level_from)} ← ${je(a,o)}</span>
        </button>`)}</div>`:l`<div class="note">עדיין אין מחברים בקומה.</div>`}
    ${s?We(s,e,t,i,r):c}
  </sw-card>`}function Ms(e,t){const a=s=>ge(e.doc.levels,s),i=s=>parseFloat(s.target.value);return l`<sw-card heading="מחבר" subheading=${B[e.saveState]} data-connector-panel data-studio-save=${e.saveState}>${We(e.sel,e,t,a,i)}</sw-card>`}const He=["straight","l","u"],Ge={straight:"ישר",l:"L (פנייה 90°)",u:"U (חצי סיבוב)"};function Ga(e,t,a){const i=e.shape==="l"||e.shape==="u"?e.shape:"straight",s=G(e),r=e.flights?.length?e.flights:[{steps:16}],n=r.length>1,o=p=>u=>{const m=Math.round(a(u));m>=1&&m<=X&&t.patchStair(e.id,{flights:r.map((h,f)=>f===p?{steps:m}:h)})};return l`<div class="stairs" data-stair-model=${s?i:"none"}>
    <div class="modes" role="group" aria-label="צורת המדרגות">
      ${He.map(p=>l`<button class=${s&&i===p?"on":""} data-stair-shape=${p} aria-pressed=${s&&i===p} @click=${()=>t.patchStair(e.id,{shape:p})}>${Ge[p]}</button>`)}
    </div>
    ${s?l`<div class="two">
          ${r.map((p,u)=>l`<sw-field label=${n?`מדרגות במהלך ${u+1}`:"מדרגות"}><input type="number" min="1" max=${X} step="1" data-ltr data-stair-steps=${u} .value=${String(p.steps)} @change=${o(u)} /></sw-field>`)}
        </div>
        <div class="two">
          ${i!=="straight"?l`<sw-field label="פנייה"><select data-stair-turn @change=${p=>t.patchStair(e.id,{turn:p.target.value})}>
                <option value="right" ?selected=${e.turn!=="left"}>ימינה</option><option value="left" ?selected=${e.turn==="left"}>שמאלה</option></select></sw-field>`:l`<label class="chk"><input type="checkbox" data-stair-mid .checked=${n} @change=${p=>{const u=p.target.checked,m=r.reduce((h,f)=>h+f.steps,0);t.patchStair(e.id,{flights:u?[{steps:Math.max(1,Math.ceil(m/2))},{steps:Math.max(1,Math.floor(m/2))}]:[{steps:Math.min(X,m)}]})}} /> פודסט באמצע</label>`}
          ${n||i!=="straight"?l`<sw-field label="עומק הפודסט (מ׳)"><input type="number" min=${P[0]} max=${P[1]} step="0.1" data-ltr data-stair-landing .value=${String(e.landing_depth_m??e.width_m)}
                @change=${p=>{const u=a(p);u>=P[0]&&u<=P[1]&&t.patchStair(e.id,{landing_depth_m:u})}} /></sw-field>`:c}
        </div>
        <div class="note" data-stair-caption-note>${wt({flights:r,shape:i})||"—"} · גרירת פינה משנה את המסלול; שינוי כאן מסדר אותו מחדש מנקודת ההתחלה.</div>`:l`<div class="note">בחר צורה כדי לצייר מהלכים, מדרגות ופודסט.</div>`}
    <div class="btns"><sw-button size="sm" variant="ghost" data-conn-rotate @click=${()=>t.rotate(e.id)}>סובב 90°</sw-button></div>
  </div>`}function We(e,t,a,i,s){const r=Re(e),n=e.floor_ids.length>0,o=Ve(t.doc,e),p=Qe(t.doc,e),u=et(t.doc,e,t.linkTargets),m=o?{...u,floors:u.floors.filter(w=>w.floorId===p)}:u,h=tt(t.doc,e),f=e.kind==="stairs"&&!r,d=f&&G(e)?xe[0]:.05,b=f&&G(e)?xe[1]:100,$=je(t.doc.levels,e);return l`<div class="sel" data-selected-connector=${e.id}>
    <div class="selhead"><strong>${O[e.kind]??e.kind}</strong><span class="muted" data-conn-head-label>${Wa(t.doc,e)}</span></div>
    ${r?l`<div class="note" data-conn-derived>נגזר מעצם (${e.object_id??""}): המיקום, הרוחב והמפלסים מגיעים מהעצם; ערוך אותו בספריית העצמים.</div>`:c}
    <div class="two">
      <sw-field label="סוג"><select data-conn-kind ?disabled=${r} @change=${w=>a.patch(e.id,{kind:w.target.value})}>${["stairs","ramp","elevator","ladder","tribune"].map(w=>l`<option value=${w} ?selected=${w===e.kind}>${O[w]}</option>`)}</select></sw-field>
      <sw-field label="רוחב (מ׳)"><input type="number" min=${d} max=${b} step="0.1" data-ltr data-conn-width ?disabled=${r} .value=${String(e.width_m)}
        @change=${w=>{const k=s(w);k>=d&&k<=b&&(f&&G(e)?a.patchStair(e.id,{width_m:k}):a.patch(e.id,{width_m:k}))}} /></sw-field>
    </div>
    <div class="two">
      <sw-field label="ממפלס"><select data-conn-from ?disabled=${r} @change=${w=>a.patch(e.id,{level_from:w.target.value})}>${t.doc.levels.map(w=>l`<option value=${w.id} ?selected=${w.id===e.level_from}>${w.name}</option>`)}</select></sw-field>
      <sw-field label="מחבר אל"><select data-conn-target aria-label="מחבר אל: מפלס בקומה הזו או מפלס בקומה אחרת" ?disabled=${r||t.linkBusy} @change=${w=>{const k=w.target.value;k&&a.setTarget(e.id,k)}}>
        <option value="" ?selected=${!h}>${n?`${$} · בחר מפלס`:"בחר מפלס או קומה"}</option>
        ${m.here.length?l`<optgroup label="בקומה הזו">${m.here.map(w=>l`<option value=${w.value} ?selected=${w.value===h}>${w.label}</option>`)}</optgroup>`:c}
        ${r?c:m.floors.map(w=>l`<optgroup label=${w.name}>${w.options.map(k=>l`<option value=${k.value} ?selected=${k.value===h}>${k.label}</option>`)}</optgroup>`)}
      </select></sw-field>
    </div>
    ${t.linkBusy?l`<div class="note" data-conn-linking>מקשר לקומה השנייה…</div>`:c}
    ${o?l`<div class="note" data-conn-twin-origin>אלה מדרגות שקושרו מקומה אחרת: כדי לקשר אותן לקומה שלישית, קשר מחדש מהקומה המקורית.</div>`:c}
    ${n&&!r?l`<div class="note" data-conn-twin-note>מקושר אל ${$}: אותו מחבר מופיע בטיוטה של שתי הקומות. הזזה כאן לא מזיזה את המדרגות בקומה השנייה, ולהפך.</div>`:c}
    ${e.needs_placement?l`<div class="note warn" data-conn-placement>מקם את המדרגות בקומה הזו: הן נוצרו במרכז התוכנית כי לשתי הקומות אין מסגרת משותפת. גרור אותן למקומן.</div>`:c}
    ${!e.needs_placement&&e.check_placement?l`<div class="note warn" data-conn-check-placement>ודא את המיקום: צורת המדרגות עודכנה מהקומה השנייה והמסלול נבנה מחדש מנקודת ההתחלה שלהן כאן.</div>`:c}
    ${e.needs_placement||e.check_placement?l`<div class="btns"><sw-button size="sm" data-conn-confirm-place @click=${()=>a.confirmPlacement(e.id)}>אישור מיקום</sw-button></div>`:c}
    ${f?Ga(e,a,s):c}
    <sw-field label="תווית (אופציונלי; ריק = הפרש הגובה או הקומה)"><input type="text" maxlength="80" data-conn-label ?disabled=${r} .value=${e.label??""} @change=${w=>a.patch(e.id,{label:w.target.value.trim()||null})} /></sw-field>
    <div class="note" data-conn-route>${i(e.level_from)} ← ${$}${r?"":" · גרירת פינה מזיזה פינה, גרירת המחבר הנבחר מזיזה את כולו"}</div>
    ${r?c:l`<div class="btns"><sw-button size="sm" variant="ghost" icon="trash" data-geom-delete @click=${()=>a.remove(e.id)}>מחק מחבר</sw-button></div>`}
  </div>`}function As(e,t,a,i,s){return l`<sw-dialog open heading="מחיקת מחבר בין קומות" subheading=${`המחבר מקושר אל ${e}`} data-twin-delete-dialog @close=${s}>
    ${t?l`<div class="note">למחוק גם בקומה השנייה?</div><div class="note warn" data-twin-delete-immediate>המחיקה בקומה השנייה מיידית: Ctrl+Z מחזיר את המדרגות רק כאן.</div>`:l`<div class="note" data-twin-delete-noperm>אין לך הרשאת עריכה בקומה השנייה: המדרגות יימחקו רק כאן, והתאום שם יסומן כמקושר לשום מקום.</div>`}
    <sw-button slot="footer" variant="ghost" data-twin-delete-cancel @click=${s}>ביטול</sw-button>
    <sw-button slot="footer" variant=${t?"secondary":"danger"} data-twin-delete-here @click=${i}>רק בקומה הזו</sw-button>
    ${t?l`<sw-button slot="footer" variant="danger" icon="trash" data-twin-delete-both autofocus @click=${a}>מחק בשתי הקומות</sw-button>`:c}
  </sw-dialog>`}function Ds(e,t,a,i){return l`<sw-dialog open heading=${e==="relink"?"קישור לקומה אחרת":"ביטול הקישור בין הקומות"} subheading=${`המדרגות מקושרות עכשיו אל ${t}`} data-link-confirm-dialog=${e} @close=${i}>
    <div class="note">${e==="relink"?"הקישור לקומה חדשה ימחק את המדרגות מהקומה הנוכחית שלהן שם.":"המדרגות יובילו למפלס בקומה הזו, והתאום בקומה השנייה יימחק."}</div>
    <div class="note warn">המחיקה בקומה השנייה מיידית ואינה מתבטלת ב־Ctrl+Z.</div>
    <sw-button slot="footer" variant="ghost" data-link-confirm-cancel @click=${i}>ביטול</sw-button>
    <sw-button slot="footer" variant="danger" data-link-confirm-ok @click=${a}>${e==="relink"?"קשר ומחק שם":"בטל קישור ומחק שם"}</sw-button>
  </sw-dialog>`}function Wa(e,t){return ht(new Map(e.levels.map(a=>[a.id,a])),t)}const Ba="לחץ על מנורה קיימת כדי להוסיף או להסיר אותה מהמעגל, או בחר סוג מנורה למטה ולחץ על התוכנית כדי להציב מנורה חדשה שכבר מחוברת למעגל",Ua=e=>`לחץ על התוכנית כדי להציב ${e.names.he} ישירות במעגל · Esc לביטול`,me=e=>`var(--sw-${bt(e)??"circuit-1"})`;function Es(e,t){const a=e.creating,i=e.sel;return l`<sw-card heading="מעגלי תאורה" subheading=${e.membersMode?e.placing?Ua(e.placing):Ba:"כמה מנורות על ישות מפסק אחת"} data-circuit-panel data-studio-save=${e.saveState}>
    ${e.doc.circuits.length?l`<div class="list">${e.doc.circuits.map(s=>l`<button class=${i?.id===s.id?"on":""} data-circuit-row=${s.id} style=${`--kc: ${me(s.color_token)}`} @click=${()=>t.select(i?.id===s.id?null:s.id)}>
          <span>${s.name}</span><span class="note ltr" style="margin:0">${s.member_ids.length} · ${e.power(s)} W · ${s.switch_entity_id}</span>
        </button>`)}</div>`:l`<div class="note">עדיין אין מעגלים בקומה.</div>`}
    ${a?l`<div class="sel" data-circuit-new-form>
          <sw-field label="שם המעגל"><input type="text" maxlength="80" data-circuit-name placeholder="למשל: אולם צפון" .value=${a.name} @input=${s=>t.setNew({name:s.target.value})} /></sw-field>
          <sw-field label="ישות המפסק (switch / light)"><input type="search" data-ltr data-circuit-switch-q placeholder="חיפוש בקטלוג" .value=${a.q} @input=${s=>t.setNew({q:s.target.value})} /></sw-field>
          <div class="list">${a.results.slice(0,20).map(s=>l`<button class=${a.entity?.entity_id===s.entity_id?"on":""} data-circuit-switch=${s.entity_id} @click=${()=>t.setNew({entity:s})}><span>${s.name||s.original_name||s.entity_id}</span><span class="ltr">${s.entity_id}</span></button>`)}</div>
          <sw-field label="צבע"><select data-circuit-color @change=${s=>t.setNew({color:s.target.value})}>${e.colors.map((s,r)=>l`<option value=${s} ?selected=${s===a.color}>מעגל ${r+1}</option>`)}</select></sw-field>
          <div class="btns"><sw-button variant="primary" size="sm" icon="check" data-circuit-create ?disabled=${a.busy||!a.name.trim()||!a.entity} @click=${()=>t.create()}>צור מעגל</sw-button><sw-button variant="ghost" size="sm" data-circuit-cancel @click=${()=>t.cancelNew()}>ביטול</sw-button></div>
        </div>`:l`<div class="btns"><sw-button size="sm" icon="plus" data-circuit-new @click=${()=>t.startNew()}>מעגל חדש</sw-button></div>`}
    ${i&&!a?Ka(i,e,t):c}
  </sw-card>`}function Ka(e,t,a){return l`<div class="sel" data-selected-circuit=${e.id} style=${`--kc: ${me(e.color_token)}`}>
    <div class="selhead"><strong>${e.name}</strong><span class="muted ltr">${e.switch_entity_id}</span></div>
    <div class="note"><span data-circuit-count>${x(e.member_ids.length,"מנורה אחת","מנורות")}</span> · <span data-circuit-power>${t.power(e)} W</span></div>
    <div class="two">
      <sw-field label="שם"><input type="text" maxlength="80" data-circuit-rename .value=${e.name} @change=${i=>{const s=i.target.value.trim();s&&a.patch(e.id,{name:s})}} /></sw-field>
      <sw-field label="צבע"><select @change=${i=>a.patch(e.id,{color_token:i.target.value})}>${t.colors.map((i,s)=>l`<option value=${i} ?selected=${i===e.color_token}>מעגל ${s+1}</option>`)}</select></sw-field>
    </div>
    <div class="btns">
      <sw-button size="sm" variant=${t.membersMode?"primary":"ghost"} icon="light" data-circuit-members aria-pressed=${t.membersMode} @click=${()=>a.toggleMembers()}>${t.membersMode?"סיים בחירת מנורות":"הוסף / הסר מנורות"}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-circuit-delete @click=${()=>a.remove(e.id)}>מחק מעגל</sw-button>
    </div>
    ${t.membersMode&&t.lamps.length?l`<div class="note">מנורה חדשה: בחר סוג ולחץ על התוכנית (לחיצה נוספת על הסוג מבטלת)</div>
      <div class="modes lamps" role="group" aria-label="סוג מנורה להצבה במעגל" data-circuit-lamps>${t.lamps.map(i=>{const s=t.placing?.id===i.id;return l`<button class=${s?"on":""} data-circuit-lamp=${i.id} aria-pressed=${s} title=${`${i.names.he} · ${i.size.w_m}×${i.size.d_m} מ׳`} @click=${()=>a.armLamp(s?null:i)}><svg viewBox="0 0 24 24" aria-hidden="true">${Ft(i.icon)}</svg><span>${i.names.he}</span></button>`})}</div>`:c}
    <div class="note">המצב החי של המנורות נגזר מהמפסק; ההפעלה מהמפה החיה היא פעולת ההתקן הקיימת, באותן הרשאות.</div>
  </div>`}const Cs=ue`
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
`;export{Ms as A,Te as B,O as C,os as D,ds as E,_s as F,ga as G,ws as H,Ua as I,xs as J,As as K,Ds as L,Na as M,ks as N,ys as O,zs as P,hs as Q,Ca as R,B as S,Cs as T,rs as U,L as a,as as b,x as c,je as d,Es as e,E as f,g,vs as h,Re as i,F as j,bs as k,z as l,cs as m,$s as n,ms as o,Ee as p,gs as q,Ss as r,ns as s,us as t,ss as u,Ie as v,is as w,ls as x,ps as y,fs as z};
//# sourceMappingURL=plan-studio-panel-BfSLMFdv.js.map
