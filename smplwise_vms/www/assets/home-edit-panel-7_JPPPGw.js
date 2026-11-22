import{i0 as A,d7 as s,A as g,a6 as E,i1 as j,b as r,i2 as B,i3 as G,i4 as T,i5 as X,i6 as D,i7 as J,i8 as S,i9 as O,ia as V,ib as Q,ic as Z,id as ee,i as te,ie as ae,ig as se,ih as ie,ii as oe,ij as ne,ik as le,il as re,im as de,io as ce,ip as he,iq as pe,bd as me,cp as F,ir as b,is as I,it as C,iu as R,iv as ge,iw as we,ix as ue,iy as W,iz as M,iA as N,iB as ve,iC as L,iD as U,iE as fe,iF as q,fi as y,iG as H,iH as $e,iI as K,iJ as be,iK as x,iL as P,iM as k,g as ye,ax as f,j as xe,k as ke}from"./index-CPuzFb4-.js";import{b as Ee}from"./settings-BBKucUsS.js";import"./sw-logo-art-PLtEZJxU.js";function Y(e,t){const o=e.config[t].style;return r`<div class="f">${s("תצוגה בסגנון Bubble")}<sw-segmented label=${t==="clock"?s("תצוגת השעון"):s("תצוגת מזג האוויר")} value=${o} @change=${a=>e.setConfig(i=>i[t].style=a.detail.value)}
    .options=${V.map(a=>({value:a,label:Q[a],attrs:{"data-home-style":`${t}:${a}`}}))}></sw-segmented></div>`}function _e(e){const t=e.config.agenda,o=e.candidates?.calendars??[],a=t.calendars,i=(n,p)=>e.setConfig(u=>{const c=u.agenda.calendars.filter(d=>d!==n);u.agenda.calendars=p?[...c,n].slice(0,A):c}),l=a.length>=A;return r`<div class="f wide" data-home-agenda-calendars>${s("יומנים (עד {n})",{n:A})}
      ${o.length?r`<div class="fields">${o.map(n=>{const p=a.includes(n.entity_id);return r`<label class="check" data-home-agenda-cal-row=${n.entity_id}><input type="checkbox" data-home-agenda-cal=${n.entity_id} .checked=${p} ?disabled=${!p&&l} @change=${u=>i(n.entity_id,u.target.checked)} />${E(n.name)}${n.event?r`<span class="val">${j(n.event,e.now,e.zone)}</span>`:g}</label>`})}</div>`:r`<div class="err" data-home-agenda-none>${s("לא נמצאו יומנים בקטלוג.")}</div>`}
      ${a.filter(n=>!o.some(p=>p.entity_id===n)).map(n=>r`<label class="check" data-home-agenda-cal-row=${n}><input type="checkbox" data-home-agenda-cal=${n} checked @change=${p=>i(n,p.target.checked)} />${n}<span class="val">${s("לא בקטלוג")}</span></label>`)}
    </div>
    <div class="f">${s("טווח")}<sw-segmented label=${s("טווח היומן")} value=${String(t.days)} @change=${n=>e.setConfig(p=>p.agenda.days=B.find(u=>String(u)===n.detail.value)??p.agenda.days)}
      .options=${B.map(n=>({value:String(n),label:G[n],attrs:{"data-home-agenda-days":String(n)}}))}></sw-segmented></div>`}function ze(e){const t=e.config.launcher.items,o=e.candidates?.scenes??[],a=e.candidates?.scripts??[],i=(d,h)=>t.some(v=>v.kind===d&&v.id===h),l=t.length>=T,n=(d,h)=>{!h||i(d,h)||l||e.setConfig(v=>v.launcher.items.push({kind:d,id:h,label:""}))},p=(d,h)=>e.setConfig(v=>{const $=v.launcher.items;if(h<0||h>=$.length)return;const[_]=$.splice(d,1);$.splice(h,0,_)}),u=d=>d.kind==="route"?Z(d.id)?.label??d.id:d.kind==="quick"?O[d.id]??d.id:(d.kind==="scene"?o:a).find(h=>h.entity_id===d.id)?.name??ee(d.id),c=(d,h,v)=>r`<label class="f">${h}
    <select data-home-launch-add=${d} ?disabled=${l||!v.length} @change=${$=>{const _=$.target;n(d,_.value),_.value=""}}>
      <option value="">${v.length?s("הוסף…"):s("אין")}</option>
      ${v.filter($=>!i(d,$.id)).map($=>r`<option value=${$.id}>${$.name}</option>`)}
    </select></label>`;return r`<div class="f wide" data-home-launch-items>${s("פריטים (עד {n})",{n:T})}
      ${t.length?t.map((d,h)=>r`<div class="extra" data-home-launch-item=${`${d.kind}:${d.id}`}>
              <span class="val" style="direction:inherit"><b>${X[d.kind]}</b> · ${E(u(d))}</span>
              <input type="text" aria-label=${s("כותרת")} data-home-launch-label=${h} maxlength=${D} .value=${d.label} placeholder=${u(d)} @input=${v=>e.setConfig($=>$.launcher.items[h].label=v.target.value)} />
              <span style="display:inline-flex;gap:4px">
                <button type="button" class="ib" data-home-launch-up=${h} aria-label=${s("הקדם")} ?disabled=${h===0} @click=${()=>p(h,h-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
                <button type="button" class="ib" data-home-launch-down=${h} aria-label=${s("אחר")} ?disabled=${h===t.length-1} @click=${()=>p(h,h+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
                <button type="button" class="ib" data-home-launch-remove=${h} aria-label=${s("הסר פריט")} @click=${()=>e.setConfig(v=>v.launcher.items.splice(h,1))}><sw-icon name="close" size=${13}></sw-icon></button>
              </span>
            </div>`):r`<span class="val" style="direction:inherit" data-home-launch-empty>${s("אין פריטים: הווידג׳ט מוסתר עד שיתווסף פריט.")}</span>`}
    </div>
    ${c("route",s("מסך"),J.map(d=>({id:d.id,name:d.label})))}
    ${c("scene",s("סצנה"),o.map(d=>({id:d.entity_id,name:d.name})))}
    ${c("script",s("סקריפט"),a.map(d=>({id:d.entity_id,name:d.name})))}
    ${c("quick",s("פעולה מהירה"),S.map(d=>({id:d,name:O[d]})))}`}var Ae=Object.defineProperty,Ce=Object.getOwnPropertyDescriptor,w=(e,t,o,a)=>{for(var i=a>1?void 0:a?Ce(t,o):t,l=e.length-1,n;l>=0;l--)(n=e[l])&&(i=(a?n(t,o,i):n(i))||i);return a&&i&&Ae(t,o,i),i};function z(e,t,o,a){const i=e.some(l=>l.entity_id===t);return[r`<option value="" ?selected=${!t}>${o}</option>`,...a&&!t&&e.some(l=>l.entity_id===a.entity_id)?[r`<option value=${a.entity_id}>${s("הצעה: {name}",{name:k(a)})}</option>`]:[],...t&&!i?[r`<option value=${t} selected>${k({entity_id:t},s("חיישן שנבחר (אינו זמין כעת)"))}</option>`]:[],...e.map(l=>r`<option value=${l.entity_id} ?selected=${l.entity_id===t}>${k(l)}</option>`)]}let m=class extends te{constructor(){super(...arguments),this.candidates=null,this.candidatesError="",this.floors=[],this.elevators=[],this.temperatureUnits=[],this.generators=!1,this.doors=!1,this.notices=!1,this.presence=!1,this.xsection=!1,this.open="",this.flat=!1,this.dragFloor=""}change(e){this.dispatchEvent(new CustomEvent("home-draft",{detail:{...this.draft,...e},bubbles:!0,composed:!0}))}setConfig(e){const t=JSON.parse(JSON.stringify(this.draft.config));e(t),this.change({config:t})}setWidget(e,t){this.setConfig(o=>Object.assign(o[e],t))}setPhoneOn(e,t){this.setConfig(o=>o[e].phone_on=t===o[e].on?null:t)}toggleOpen(e){this.dispatchEvent(new CustomEvent("home-edit-open",{detail:{id:this.open===e?"":e},bubbles:!0,composed:!0}))}get listed(){return this.draft.config.order.filter(e=>(e!=="elevators"||this.elevators.length>0)&&(e!=="temperature"||this.temperatureUnits.length>0)&&(e!=="generators"||this.generators)&&(e!=="doors"||this.doors)&&(e!=="notices"||this.notices)&&(e!=="presence"||this.presence)&&(e!=="xsection"||this.xsection))}moveW(e,t){const o=this.listed;this.setConfig(a=>a.order=ae(a.order,o,e,t)),this.updateComplete.then(()=>requestAnimationFrame(()=>this.renderRoot.querySelector(`[data-home-wrow="${e}"] [data-home-wmove]:not([disabled])`)?.focus()))}get view(){return se(this.draft.config,this.baseData,this.candidates)}render(){const e=this.draft;if(!e)return g;const t=this.floors.map(i=>i.id),o=this.listed,a=o.filter(i=>e.config[i].on).length;return r`<section class="home-edit" data-home-edit aria-label=${s("הגדרות המסך הראשי")}>
      <div class="col">
        <div class="grp" role="group" aria-labelledby="he-screen-h">
        <h3 id="he-screen-h">${s("המסך")}</h3>
        <label class="f" data-home-title-field>${s("כותרת המסך")}
          <input type="text" data-home-title maxlength=${ie} .value=${e.title} placeholder=${oe} @input=${i=>this.change({title:i.target.value})} />
        </label>
        <div class="row">
          <div class="lbl" id="he-dir">${s("כיוון")}
            <sw-segmented label=${s("כיוון")} data-home-directions value=${e.direction} @change=${i=>this.change({direction:i.detail.value})}
              .options=${ne.map(i=>({value:i,label:`${le[i]} · ${re[i]}`,attrs:{"data-home-direction":i}}))}></sw-segmented>
          </div>
          ${e.direction==="b"?r`<div class="lbl" id="he-side">${s("צד הלוח")}
                <sw-segmented label=${s("צד הלוח")} value=${e.side} @change=${i=>this.change({side:i.detail.value})}
                  .options=${de.map(i=>({value:i,label:ce[i],attrs:{"data-home-side":i}}))}></sw-segmented>
              </div>`:g}
        </div>
        <div class="lbl" id="he-phone">${s("בנייד: איך הווידג׳טים מוצגים")}
          <sw-segmented label=${s("בנייד: איך הווידג׳טים מוצגים")} data-home-phone-layouts value=${e.config.phone_layout} @change=${i=>this.setConfig(l=>l.phone_layout=i.detail.value)}
            .options=${he.map(i=>({value:i,label:pe[i],attrs:{"data-home-phone-layout":i}}))}></sw-segmented>
        </div>
        </div>
        <div class="grp" role="group" aria-labelledby="he-widgets-h">
          <div class="gh-row">
            <h3 id="he-widgets-h">${s("ווידג׳טים")}</h3>
            <span class="cnt" data-home-widgets-count>${s("{shown}/{total} מוצגים",{shown:a,total:o.length})}</span>
            <span class="sp"></span>
            <sw-button size="sm" variant="ghost" icon="refresh" data-home-reset-widgets @click=${()=>this.dispatchEvent(new CustomEvent("home-reset",{bubbles:!0,composed:!0}))}>${s("אפס ווידג׳טים לברירת מחדל")}</sw-button>
          </div>
          ${this.candidatesError?r`<div class="err" role="alert" data-home-candidates-error><sw-icon name="warning" size=${14}></sw-icon>${this.candidatesError}</div>`:this.candidates===null?r`<div class="note" role="status" data-home-candidates-loading>${s("טוען את רשימת הישויות…")}</div>`:g}
          <div class="wl">${me(o,i=>i,(i,l)=>this.widgetRow(i,l))}</div>
        </div>
      </div>
      <div class="col" data-home-floors-col>
        <div class="grp">
        <h3 id="he-floors-lbl">${s("סדר הקומות")}</h3>
        ${t.length?r`<p class="hint">${s("גרור קומה או השתמש בחצים. הקומה הראשונה מוצגת ראשונה.")}</p>`:r`<p class="hint" data-home-floors-empty>${s("אין עדיין קומות במבנה.")}</p>`}
        <ol data-home-floors aria-labelledby="he-floors-lbl">
          ${t.map((i,l)=>r`<li class=${F({floor:!0,dragging:this.dragFloor===i})} data-home-floor=${i} draggable="true"
              @dragstart=${n=>this.onFloorDrag(n,i)} @dragend=${()=>this.dragFloor=""} @dragover=${n=>this.dragFloor&&n.preventDefault()} @drop=${n=>this.onFloorDrop(n,t,l)}>
              <span class="grip" aria-hidden="true"><sw-icon name="grip" size=${14}></sw-icon></span>
              <span class="pos" aria-hidden="true">${l+1}</span>
              <span class="nm">${E(this.floors[l].name)}</span>
              <button type="button" data-home-floor-up=${i} aria-label=${s("העבר את {name} למעלה",{name:this.floors[l].name})} title=${s("למעלה")} ?disabled=${l===0} @click=${()=>this.moveFloor(t,i,l-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
              <button type="button" data-home-floor-down=${i} aria-label=${s("העבר את {name} למטה",{name:this.floors[l].name})} title=${s("למטה")} ?disabled=${l===t.length-1} @click=${()=>this.moveFloor(t,i,l+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
            </li>`)}
        </ol>
        </div>
      </div>
    </section>`}widgetRow(e,t){const o=this.draft,a=o.config[e],i=this.open===e,l=this.listed.length-1;return r`<div class=${F({w:!0,off:!a.on,open:i})} data-home-wrow=${e}>
      <div class="w-top">
        <label class="check"><input type="checkbox" data-home-toggle=${e} .checked=${a.on} @change=${n=>this.setWidget(e,{on:n.target.checked})} aria-label=${s("הצג {name}",{name:b[e]})} /><span class="w-name">${b[e]}</span></label>
        <sw-segmented label=${s("גודל: {name}",{name:b[e]})} value=${a.sizes[o.direction]} ?disabled=${!a.on} @change=${n=>this.setConfig(p=>p[e].sizes[o.direction]=n.detail.value)}
          .options=${I.map(n=>({value:n,label:C[n],attrs:{"data-home-wsize":`${e}:${n}`}}))}></sw-segmented>
        <span class="grow"></span>
        <button type="button" class="ib" data-home-wmove=${e} data-home-wearlier=${e} aria-label=${s("הקדם את {name}",{name:b[e]})} title=${s("הקדם")} ?disabled=${t===0} @click=${()=>this.moveW(e,t-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
        <button type="button" class="ib" data-home-wmove=${e} data-home-wlater=${e} aria-label=${s("אחר את {name}",{name:b[e]})} title=${s("אחר")} ?disabled=${t===l} @click=${()=>this.moveW(e,t+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
        <button type="button" class="ib" data-home-wopen=${e} aria-expanded=${String(i)} aria-label=${s("הגדרות: {name}",{name:b[e]})} title=${s("הגדרות")} @click=${()=>this.toggleOpen(e)}><sw-icon name=${i?"chevronDown":"chevronBack"} size=${14}></sw-icon></button>
      </div>
      <div class="w-phone" data-home-wphone=${e}>
        <span class="pl">${s("בנייד")}</span>
        <label class="check"><input type="checkbox" data-home-phone-on=${e} .checked=${R(a,!0)} aria-label=${s("הצג בנייד: {name}",{name:b[e]})} @change=${n=>this.setPhoneOn(e,n.target.checked)} />${s("הצג")}</label>
        <select data-home-phone-size=${e} aria-label=${s("גודל בנייד: {name}",{name:b[e]})} ?disabled=${!R(a,!0)} @change=${n=>this.setWidget(e,{phone_size:n.target.value||null})}>
          <option value="" ?selected=${!a.phone_size}>${s("אוטומטי ({size})",{size:C[ge({...a,phone_size:null},o.direction,!0)]})}</option>
          ${I.map(n=>r`<option value=${n} ?selected=${a.phone_size===n}>${C[n]}</option>`)}
        </select>
      </div>
      ${i?r`<div class="w-body" data-home-wbody=${e}>
            <label class="f">${s("כותרת")} <input type="text" data-home-label=${e} maxlength=${D} .value=${a.label} placeholder=${b[e]} @input=${n=>this.setWidget(e,{label:n.target.value})} /></label>
            ${e==="clock"?this.clockBody():e==="weather"?this.weatherBody():e==="shabbat"?this.shabbatBody():e==="alarm"?this.alarmBody():e==="agenda"?_e(this.bv1):e==="launcher"?ze(this.bv1):e==="elevators"?this.elevatorsBody():e==="temperature"?this.temperatureBody():e==="media"||e==="generators"||e==="doors"?g:this.quickBody()}
          </div>`:g}
    </div>`}get bv1(){return{config:this.draft.config,candidates:this.candidates,now:new Date,zone:"Asia/Jerusalem",setConfig:e=>this.setConfig(e)}}clockBody(){const e=this.draft.config,t=this.candidates?.sensors??[],o=this.suggestion("date");return r`<div class="f">${s("תצוגה")}<sw-segmented label=${s("תצוגת השעון")} value=${e.clock.mode} @change=${a=>this.setWidget("clock",{mode:a.detail.value})}
      .options=${we.map(a=>({value:a,label:ue[a],attrs:{"data-home-clock-mode":a}}))}></sw-segmented></div>
      ${Y(this.bv1,"clock")}
      <div class="f"><label class="check"><input type="checkbox" data-home-clock-seconds .checked=${e.clock.seconds} @change=${a=>this.setWidget("clock",{seconds:a.target.checked})} />${s("עם שניות (בגודל גדול)")}</label>
        <label class="check"><input type="checkbox" data-home-clock-hebrew ?disabled=${e.clock.mode!=="datetime"} .checked=${e.clock.hebrew} @change=${a=>this.setWidget("clock",{hebrew:a.target.checked})} />${s("תאריך עברי")}</label></div>
      <label class="f wide">${s("חיישן התאריך העברי")}<select data-home-cal="date" ?disabled=${!e.clock.hebrew} @change=${a=>this.setCal("date",a.target.value)}>${z(t,e.calendar.date,s("לא נבחר: מחושב בדפדפן"),o)}</select></label>`}weatherBody(){const t=this.draft.config.weather,o=this.candidates?.weather??[],a=this.view.weather,i=a?.offers??["condition"],l=this.candidates?.sensors??[],n=c=>r`<label class="check" data-home-wfield-row=${c}><input type="checkbox" data-home-wfield=${c} .checked=${t.fields.includes(c)} @change=${d=>this.toggleField(c,d.target.checked)} />${L[c]}${a?.values[c]?r`<span class="val">${a.values[c].v}${a.values[c].unit?` ${a.values[c].unit}`:""}</span>`:g}</label>`,p=W.filter(c=>i.includes(c)),u=i.includes("forecast");return r`<label class="f wide">${s("ישות מזג האוויר")}
        <select data-home-weather-entity @change=${c=>this.pickWeather(c.target.value)}>${z(o,t.entity,s("לא נבחר"))}</select></label>
      ${Y(this.bv1,"weather")}
      ${t.entity&&!a?r`<div class="err wide" data-home-wx-missing>${s("הישות לא נמצאה בקטלוג.")}</div>`:g}
      ${a&&!a.available?r`<div class="err wide" data-home-wx-unavailable>${s("הישות לא זמינה כרגע: הווידג׳ט מוסתר עד שתחזור.")}</div>`:g}
      ${a?r`<div class="f wide" data-home-wfields>${s("מה להציג (רק מה שהישות מדווחת)")}
            <div class="fields">${p.map(n)}</div></div>
          ${u?r`<div class="f wide">${s("אורך התחזית")}<sw-segmented label=${s("אורך התחזית")} value=${String(t.forecast)} ?disabled=${!t.fields.includes("forecast")}
              @change=${c=>this.setWidget("weather",{forecast:M.find(d=>String(d)===c.detail.value)??t.forecast})}
              .options=${M.map(c=>({value:String(c),label:c==="max"?s("מקסימום ({n})",{n:N(a.forecast_len,"max")}):`${c} (${N(a.forecast_len,c)})`,attrs:{"data-home-forecast-len":String(c)}}))}></sw-segmented></div>`:g}
          <div class="f wide" data-home-wsources>${s("מקור אחר לשדה (לא חובה)")}
            ${ve.filter(c=>t.fields.includes(c)).map(c=>r`<div class="frow"><span>${L[c]}</span><select data-home-wsource=${c} aria-label=${L[c]} @change=${d=>this.setSource(c,d.target.value)}>${z(l,t.sources[c]??"",s("מישות מזג האוויר"))}</select></div>`)}
          </div>`:g}`}toggleField(e,t){this.setConfig(o=>{const a=o.weather.fields.filter(i=>i!==e);o.weather.fields=t?W.filter(i=>i===e||a.includes(i)):a})}pickWeather(e){this.setConfig(t=>{t.weather.entity=e,t.weather.sources={};const a=this.candidates?.weather.find(i=>i.entity_id===e)?.offers??[];e&&a.length&&!t.weather.fields.some(i=>a.includes(i))&&(t.weather.fields=["temperature","condition","humidity","wind","forecast"].filter(i=>a.includes(i)))})}setSource(e,t){this.setConfig(o=>{t?o.weather.sources[e]=t:delete o.weather.sources[e]})}suggestion(e){const t=this.candidates?.suggested_calendar?.[e],o=t?this.candidates?.sensors.find(a=>a.entity_id===t):void 0;return o?{entity_id:o.entity_id,name:o.name}:void 0}setCal(e,t){this.setConfig(o=>o.calendar[e]=t)}suggestAll(){this.setConfig(e=>{for(const t of U)!e.calendar[t]&&this.candidates?.suggested_calendar?.[t]&&(e.calendar[t]=this.candidates.suggested_calendar[t])})}shabbatBody(){const e=this.draft.config.calendar,t=this.candidates?.sensors??[],o=(l,n,p)=>{const u=t.filter(h=>h.suggested),c=t.filter(h=>!h.suggested),d=h=>r`<option value=${h.entity_id} ?selected=${h.entity_id===l}>${k(h)}</option>`;return r`<option value="" ?selected=${!l}>${n}</option>
        ${p&&!l?r`<option value=${p.entity_id}>${s("הצעה: {name}",{name:k(p)})}</option>`:g}
        ${l&&!t.some(h=>h.entity_id===l)?r`<option value=${l} selected>${k({entity_id:l},s("חיישן שנבחר (אינו זמין כעת)"))}</option>`:g}
        ${u.length?r`<optgroup label=${s("לוח שנה עברי")}>${u.map(d)}</optgroup>`:g}
        <optgroup label=${s("כל החיישנים")}>${c.map(d)}</optgroup>`},a=U.some(l=>!e[l]&&this.candidates?.suggested_calendar?.[l]),i=["parsha","candles","havdalah","holiday"].map(l=>r`<label class="f">${fe[l]}<select data-home-cal=${l} @change=${n=>this.setCal(l,n.target.value)}>${o(e[l],s("לא נבחר"),this.suggestion(l))}</select></label>`);return r`${i}
      ${a?r`<div class="wide"><sw-button size="sm" data-home-suggest @click=${()=>this.suggestAll()}>${s("מלא הצעות אוטומטיות")}</sw-button></div>`:g}
      <div class="f wide" data-home-extras>${s("שדות נוספים (עד {n})",{n:q})}
        ${e.extras.map((l,n)=>r`<div class="extra" data-home-extra=${n}>
            <select aria-label=${s("חיישן")} data-home-extra-entity=${n} @change=${p=>this.setExtra(n,{entity_id:p.target.value})}>${o(l.entity_id,s("בחר חיישן"))}</select>
            <input type="text" aria-label=${s("כותרת")} data-home-extra-label=${n} maxlength=${D} .value=${l.label} placeholder=${s("כותרת")} @input=${p=>this.setExtra(n,{label:p.target.value})} />
            <button type="button" class="ib" data-home-extra-remove=${n} aria-label=${s("הסר שדה")} @click=${()=>this.setConfig(p=>p.calendar.extras.splice(n,1))}><sw-icon name="close" size=${13}></sw-icon></button>
          </div>`)}
        ${e.extras.length<q?r`<div><sw-button size="sm" icon="plus" data-home-extra-add @click=${()=>this.setConfig(l=>l.calendar.extras.push({entity_id:"",label:""}))}>${s("הוסף שדה")}</sw-button></div>`:g}
      </div>`}setExtra(e,t){this.setConfig(o=>Object.assign(o.calendar.extras[e],t))}elevatorsBody(){const e=this.draft.config.elevators;return r`<div class="f wide">${y("displayMode")}<sw-segmented label=${y("displayMode")} value=${e.mode} @change=${t=>this.setWidget("elevators",{mode:t.detail.value})}
      .options=${H.map(t=>({value:t,label:y($e[t]),attrs:{"data-home-elevators-mode":t}}))}></sw-segmented></div>
      <div class="f wide">${y("filter")}<sw-segmented label=${y("filter")} value=${e.filter} @change=${t=>this.setWidget("elevators",{filter:t.detail.value})}
        .options=${K.map(t=>({value:t,label:y(be[t]),attrs:{"data-home-elevators-filter":t}}))}></sw-segmented></div>
      <div class="f wide" data-home-elevators-include>${y("include")}
        <div class="fields">${this.elevators.map(t=>r`<label class="check"><input type="checkbox" data-home-elevator-include=${t.id} .checked=${!e.hidden.includes(t.id)}
          @change=${o=>this.setWidget("elevators",{hidden:o.target.checked?e.hidden.filter(a=>a!==t.id):[...e.hidden,t.id]})} />${E(t.name)}</label>`)}</div></div>`}temperatureBody(){const e=this.draft.config.temperature,t={combined:"wModeCombined",cards:"wModeCards",both:"wModeBoth"},o={all:"wFilterAll",alerts:"wFilterAlerts"};return r`<div class="f wide">${x("wDisplayMode")}<sw-segmented label=${x("wDisplayMode")} value=${e.mode} @change=${a=>this.setWidget("temperature",{mode:a.detail.value})}
      .options=${H.map(a=>({value:a,label:x(t[a]),attrs:{"data-home-temp-mode":a}}))}></sw-segmented></div>
      <div class="f wide">${x("wFilter")}<sw-segmented label=${x("wFilter")} value=${e.filter} @change=${a=>this.setWidget("temperature",{filter:a.detail.value})}
        .options=${K.map(a=>({value:a,label:x(o[a]),attrs:{"data-home-temp-filter":a}}))}></sw-segmented></div>
      <div class="f wide" data-home-temp-include>${x("wInclude")}
        <div class="fields">${this.temperatureUnits.map(a=>r`<label class="check"><input type="checkbox" data-home-temp-include=${a.id} .checked=${!e.hidden.includes(a.id)}
          @change=${i=>this.setWidget("temperature",{hidden:i.target.checked?e.hidden.filter(l=>l!==a.id):[...e.hidden,a.id]})} />${E(a.name)}</label>`)}</div></div>`}alarmBody(){const e=this.draft.config.alarm,t=this.candidates?.alarms??[];return r`<label class="f">${s("לוח האזעקה")}<select data-home-alarm-entity @change=${o=>this.setWidget("alarm",{entity:o.target.value})}>${z(t,e.entity,s("אוטומטי: הדחוף ביותר"))}</select></label>`}quickBody(){const e=this.draft.config.quick;return r`<div class="f wide">${s("פעולות")}
      <div class="fields">${S.map(t=>r`<label class="check"><input type="checkbox" data-home-quick-action=${t} .checked=${e.actions.includes(t)} @change=${o=>this.toggleAction(t,o.target.checked)} />${O[t]}</label>`)}</div></div>`}toggleAction(e,t){this.setConfig(o=>o.quick.actions=S.filter(a=>a===e?t:o.quick.actions.includes(a)))}moveFloor(e,t,o){const a=o<e.indexOf(t);this.change({floorOrder:P(e,t,o)}),this.updateComplete.then(()=>requestAnimationFrame(()=>{const i=this.renderRoot,l=`[data-home-floor="${CSS.escape(t)}"]`;i.querySelector(`${l} [data-home-floor-${a?"up":"down"}]:not([disabled])`)?.focus()??i.querySelector(`${l} button:not([disabled])`)?.focus()}))}onFloorDrag(e,t){this.dragFloor=t,e.dataTransfer?.setData("text/plain",t),e.dataTransfer&&(e.dataTransfer.effectAllowed="move")}onFloorDrop(e,t,o){e.preventDefault();const a=this.dragFloor;this.dragFloor="",a&&this.change({floorOrder:P(t,a,o)})}};m.styles=[Ee,ye`
      :host {
        display: block;
        --he-well: color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border));
        --sw-seg-h: var(--sw-ctl-h-md);
        /* HOME-EDIT-DRAWER-2351: the panel lays itself out by its OWN width (the drawer is ~340-420 px on a wide screen) */
        container-type: inline-size;
      }
      :host([flat]) .home-edit {
        padding: 0;
        border: 0;
        border-radius: 0;
        background: none;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        box-shadow: none;
      }
      .home-edit {
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
        gap: var(--sw-s-4) var(--sw-s-6);
        padding: var(--sw-s-4);
        border: 1px dashed var(--sw-border-strong);
        border-radius: var(--sw-r-lg);
        background: var(--sw-surface);
        -webkit-backdrop-filter: var(--sw-glass-blur);
        backdrop-filter: var(--sw-glass-blur);
        box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-5);
        min-inline-size: 0;
      }
      .grp {
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-3);
        min-inline-size: 0;
      }
      .gh-row {
        display: flex;
        align-items: center;
        gap: var(--sw-s-2) var(--sw-s-3);
        flex-wrap: wrap;
        min-block-size: var(--sw-ctl-h-md);
      }
      .gh-row .sp {
        flex: 1;
      }
      h3 {
        margin: 0;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-bold);
        color: var(--sw-heading);
        letter-spacing: -0.01em;
      }
      .cnt {
        display: inline-flex;
        align-items: center;
        min-block-size: 20px;
        padding-inline: var(--sw-s-2);
        border-radius: var(--sw-r-pill);
        background: var(--he-well);
        color: var(--sw-text-2);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-semibold);
        font-variant-numeric: tabular-nums;
      }
      .hint {
        margin: 0;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .f,
      .lbl {
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-1h);
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-medium);
        color: var(--sw-text-2);
        min-inline-size: 0;
      }
      input[type='text'],
      select {
        box-sizing: border-box;
        min-block-size: var(--sw-ctl-h-md);
        max-inline-size: 100%;
        padding-inline: var(--sw-s-2);
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-xs);
        background: var(--sw-surface);
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-regular);
        transition: border-color var(--sw-t-hover) var(--sw-ease-color);
      }
      input[type='text']::placeholder {
        color: var(--sw-text-3);
      }
      select:disabled {
        opacity: 0.5;
      }
      input[type='checkbox'] {
        inline-size: 16px;
        block-size: 16px;
        margin: 0;
        accent-color: var(--sw-accent);
        flex: none;
      }
      input:focus-visible,
      select:focus-visible,
      button:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: 2px;
      }
      /* CR-CMP2-SEGMENTED-C-2450: every choice of the panel is sw-segmented (the settings key; --sw-seg-h above keeps the control
         height); it sits at the start of its row and wraps, a disabled choice dims to the panel's 0.45 */
      sw-segmented {
        align-self: flex-start;
        flex: 0 1 auto;
        --sw-disabled-opacity: 0.45;
      }
      .row {
        display: flex;
        align-items: flex-start;
        gap: var(--sw-s-3) var(--sw-s-4);
        flex-wrap: wrap;
      }
      .check {
        display: inline-flex;
        align-items: center;
        gap: var(--sw-s-2);
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-regular);
        color: var(--sw-text);
        cursor: pointer;
      }
      .check:has(input:disabled) {
        color: var(--sw-text-3);
        cursor: default;
      }
      /* the widgets: one list of wells */
      .wl {
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-2);
      }
      .w {
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-2);
        padding: var(--sw-s-2) var(--sw-s-3);
        border: 1px solid transparent;
        border-radius: var(--sw-r-md);
        background: var(--he-well);
        transition: border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color);
      }
      .w.open {
        border-color: var(--sw-accent);
        background: var(--sw-surface-2);
      }
      /* a widget that is off: its name and its phone line step back; the switch itself keeps full contrast (was the whole row at 70 %) */
      .w.off .w-name {
        color: var(--sw-text-3);
      }
      /* DARK-REVIEW-2342: by the muted ink instead of opacity 0.6 (which read 3.4-3.8:1 on the dark well, 2.7-3.1:1 in light; the
         placement select on that line is still live) - the same step back as the name */
      .w.off .w-phone {
        color: var(--sw-text-3);
      }
      .w-top {
        display: flex;
        align-items: center;
        gap: var(--sw-s-2) var(--sw-s-3);
        flex-wrap: wrap;
      }
      .w-phone {
        display: flex;
        align-items: center;
        gap: var(--sw-s-1h) var(--sw-s-3);
        flex-wrap: wrap;
        padding-block-start: var(--sw-s-2);
        border-block-start: 1px dashed var(--sw-border);
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-2);
      }
      .w-phone .pl {
        font-weight: var(--sw-fw-semibold);
        min-inline-size: 44px;
      }
      .w-phone select {
        min-block-size: var(--sw-ctl-h-sm);
        font-size: var(--sw-fs-xs);
      }
      .w-name {
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-md);
        color: var(--sw-heading);
        min-inline-size: 84px;
      }
      .w-top .grow {
        flex: 1;
      }
      .w-body {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: var(--sw-s-3);
        align-items: start;
        padding-block-start: var(--sw-s-3);
        border-block-start: 1px solid var(--sw-border);
      }
      .w-body > .wide {
        grid-column: 1 / -1;
      }
      .ib,
      .floor button {
        display: inline-grid;
        place-items: center;
        inline-size: var(--sw-ctl-h-md);
        block-size: var(--sw-ctl-h-md);
        padding: 0;
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-xs);
        background: var(--sw-surface);
        color: var(--sw-text);
        cursor: pointer;
        transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .ib[aria-expanded='true'] {
        background: var(--sw-accent-soft);
        border-color: var(--sw-accent);
        color: var(--sw-accent-text);
      }
      @media (hover: hover) and (pointer: fine) {
        .ib:hover:not(:disabled),
        .floor button:hover:not(:disabled) {
          background: var(--sw-hover-wash);
        }
        input[type='text']:hover,
        select:hover:not(:disabled) {
          border-color: var(--sw-text-3);
        }
      }
      .ib:active:not(:disabled),
      .floor button:active:not(:disabled) {
        transform: scale(var(--sw-press-scale));
      }
      .ib:disabled,
      .floor button:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .fields {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sw-s-2) var(--sw-s-4);
      }
      .frow {
        display: grid;
        grid-template-columns: minmax(110px, auto) minmax(0, 1fr);
        gap: var(--sw-s-1) var(--sw-s-2);
        align-items: center;
        font-weight: var(--sw-fw-regular);
      }
      .frow select {
        min-block-size: var(--sw-ctl-h-sm);
        font-size: var(--sw-fs-xs);
      }
      .val {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        font-variant-numeric: tabular-nums;
        direction: ltr;
        unicode-bidi: isolate;
      }
      .extra {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto;
        gap: var(--sw-s-1h);
        align-items: center;
      }
      .err,
      .note {
        display: flex;
        align-items: center;
        gap: var(--sw-s-1h);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-medium);
      }
      .err {
        color: var(--sw-danger-text);
      }
      .note {
        color: var(--sw-text-3);
      }
      ol {
        margin: 0;
        padding: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: var(--sw-s-1h);
      }
      .floor {
        display: flex;
        align-items: center;
        gap: var(--sw-s-2);
        padding-block: var(--sw-s-1);
        padding-inline: var(--sw-s-2) var(--sw-s-1);
        border-radius: var(--sw-r-sm);
        background: var(--he-well);
        transition: opacity var(--sw-t-hover) var(--sw-ease-color);
      }
      .floor.dragging {
        opacity: 0.5;
      }
      .grip {
        color: var(--sw-text-3);
        cursor: grab;
        display: inline-flex;
        touch-action: none;
      }
      .nm {
        flex: 1;
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
      }
      .pos {
        min-inline-size: 2ch;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      @media (max-width: 899px) {
        .home-edit {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      /* HOME-EDIT-DRAWER-2351: narrow by its own width (the drawer): one column, the field label over its picker, the extra
         calendar field's title under its sensor - the phone's arrangement without the phone's 44 px targets */
      @container (max-width: 640px) {
        .home-edit {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      @container (max-width: 460px) {
        .w-name {
          min-inline-size: 0;
        }
        .frow {
          grid-template-columns: minmax(0, 1fr);
        }
        .extra {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .extra input {
          grid-column: 1 / -1;
          grid-row: 2;
        }
      }
      /* a phone: one column of controls, 44 px targets, the extra calendar field's title under its sensor */
      @media (max-width: 767px) {
        :host {
          --sw-seg-h: var(--sw-touch-desktop);
        }
        .home-edit {
          padding: var(--sw-s-3);
        }
        .ib,
        .floor button {
          inline-size: var(--sw-touch-desktop);
          block-size: var(--sw-touch-desktop);
        }
        input[type='text'],
        select,
        .w-phone select,
        .frow select {
          min-block-size: var(--sw-touch-desktop);
          font-size: var(--sw-fs-md);
        }
        .w {
          padding: var(--sw-s-3);
        }
        .w-name {
          min-inline-size: 0;
        }
        .frow {
          grid-template-columns: minmax(0, 1fr);
        }
        .extra {
          grid-template-columns: minmax(0, 1fr) auto;
        }
        .extra input {
          grid-column: 1 / -1;
          grid-row: 2;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .ib,
        .floor button,
        .w,
        .floor {
          transition-duration: 0ms;
        }
      }
    `];w([f({attribute:!1})],m.prototype,"draft",2);w([f({attribute:!1})],m.prototype,"candidates",2);w([f({attribute:!1})],m.prototype,"candidatesError",2);w([f({attribute:!1})],m.prototype,"baseData",2);w([f({attribute:!1})],m.prototype,"floors",2);w([f({attribute:!1})],m.prototype,"elevators",2);w([f({attribute:!1})],m.prototype,"temperatureUnits",2);w([f({type:Boolean})],m.prototype,"generators",2);w([f({type:Boolean})],m.prototype,"doors",2);w([f({type:Boolean})],m.prototype,"notices",2);w([f({type:Boolean})],m.prototype,"presence",2);w([f({type:Boolean})],m.prototype,"xsection",2);w([f()],m.prototype,"open",2);w([f({type:Boolean,reflect:!0})],m.prototype,"flat",2);w([xe()],m.prototype,"dragFloor",2);m=w([ke("home-edit-panel")],m);export{m as HomeEditPanel};
