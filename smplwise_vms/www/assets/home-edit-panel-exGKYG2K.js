import{iG as A,d7 as s,A as m,a7 as _,iH as K,b as r,iI as P,iJ as Y,iK as B,iL as X,iM as S,iN as G,iO as D,iP as O,iQ as J,iR as V,iS as Q,iT as Z,i as ee,iU as te,iV as ae,iW as se,iX as oe,iY as ie,iZ as ne,i_ as re,i$ as le,j0 as de,j1 as ce,j2 as he,bc as pe,cs as T,j3 as $,j4 as I,j5 as C,j6 as F,j7 as ue,j8 as me,j9 as ge,ja as R,jb as we,jc as j,jd as be,je as L,jf as W,jg as ve,jh as M,fg as y,ji as N,jj as fe,jk as U,jl as $e,jm as x,jn as H,jo as k,g as ye,ay as b,j as xe,k as ke}from"./index-CkOaAZ0k.js";import{a as _e}from"./settings-mBGpMa3Z.js";import"./sw-logo-art-MaHPMZFI.js";function q(e,t){const i=e.config[t].style;return r`<div class="f">${s("תצוגה בסגנון Bubble")}<span class="seg" role="group" aria-label=${t==="clock"?s("תצוגת השעון"):s("תצוגת מזג האוויר")}>${J.map(a=>r`<button type="button" data-home-style=${`${t}:${a}`} aria-pressed=${String(i===a)} @click=${()=>e.setConfig(o=>o[t].style=a)}>${V[a]}</button>`)}</span></div>`}function Ee(e){const t=e.config.agenda,i=e.candidates?.calendars??[],a=t.calendars,o=(n,p)=>e.setConfig(v=>{const c=v.agenda.calendars.filter(d=>d!==n);v.agenda.calendars=p?[...c,n].slice(0,A):c}),l=a.length>=A;return r`<div class="f wide" data-home-agenda-calendars>${s("יומנים (עד {n})",{n:A})}
      ${i.length?r`<div class="fields">${i.map(n=>{const p=a.includes(n.entity_id);return r`<label class="check" data-home-agenda-cal-row=${n.entity_id}><input type="checkbox" data-home-agenda-cal=${n.entity_id} .checked=${p} ?disabled=${!p&&l} @change=${v=>o(n.entity_id,v.target.checked)} />${_(n.name)}${n.event?r`<span class="val">${K(n.event,e.now,e.zone)}</span>`:m}</label>`})}</div>`:r`<div class="err" data-home-agenda-none>${s("לא נמצאו יומנים בקטלוג.")}</div>`}
      ${a.filter(n=>!i.some(p=>p.entity_id===n)).map(n=>r`<label class="check" data-home-agenda-cal-row=${n}><input type="checkbox" data-home-agenda-cal=${n} checked @change=${p=>o(n,p.target.checked)} />${n}<span class="val">${s("לא בקטלוג")}</span></label>`)}
    </div>
    <div class="f">${s("טווח")}<span class="seg" role="group" aria-label=${s("טווח היומן")}>${P.map(n=>r`<button type="button" data-home-agenda-days=${n} aria-pressed=${String(t.days===n)} @click=${()=>e.setConfig(p=>p.agenda.days=n)}>${Y[n]}</button>`)}</span></div>`}function ze(e){const t=e.config.launcher.items,i=e.candidates?.scenes??[],a=e.candidates?.scripts??[],o=(d,h)=>t.some(w=>w.kind===d&&w.id===h),l=t.length>=B,n=(d,h)=>{!h||o(d,h)||l||e.setConfig(w=>w.launcher.items.push({kind:d,id:h,label:""}))},p=(d,h)=>e.setConfig(w=>{const f=w.launcher.items;if(h<0||h>=f.length)return;const[E]=f.splice(d,1);f.splice(h,0,E)}),v=d=>d.kind==="route"?Q(d.id)?.label??d.id:d.kind==="quick"?O[d.id]??d.id:(d.kind==="scene"?i:a).find(h=>h.entity_id===d.id)?.name??Z(d.id),c=(d,h,w)=>r`<label class="f">${h}
    <select data-home-launch-add=${d} ?disabled=${l||!w.length} @change=${f=>{const E=f.target;n(d,E.value),E.value=""}}>
      <option value="">${w.length?s("הוסף…"):s("אין")}</option>
      ${w.filter(f=>!o(d,f.id)).map(f=>r`<option value=${f.id}>${f.name}</option>`)}
    </select></label>`;return r`<div class="f wide" data-home-launch-items>${s("פריטים (עד {n})",{n:B})}
      ${t.length?t.map((d,h)=>r`<div class="extra" data-home-launch-item=${`${d.kind}:${d.id}`}>
              <span class="val" style="direction:inherit"><b>${X[d.kind]}</b> · ${_(v(d))}</span>
              <input type="text" aria-label=${s("כותרת")} data-home-launch-label=${h} maxlength=${S} .value=${d.label} placeholder=${v(d)} @input=${w=>e.setConfig(f=>f.launcher.items[h].label=w.target.value)} />
              <span style="display:inline-flex;gap:4px">
                <button type="button" class="ib" data-home-launch-up=${h} aria-label=${s("הקדם")} ?disabled=${h===0} @click=${()=>p(h,h-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
                <button type="button" class="ib" data-home-launch-down=${h} aria-label=${s("אחר")} ?disabled=${h===t.length-1} @click=${()=>p(h,h+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
                <button type="button" class="ib" data-home-launch-remove=${h} aria-label=${s("הסר פריט")} @click=${()=>e.setConfig(w=>w.launcher.items.splice(h,1))}><sw-icon name="close" size=${13}></sw-icon></button>
              </span>
            </div>`):r`<span class="val" style="direction:inherit" data-home-launch-empty>${s("אין פריטים: הווידג׳ט מוסתר עד שיתווסף פריט.")}</span>`}
    </div>
    ${c("route",s("מסך"),G.map(d=>({id:d.id,name:d.label})))}
    ${c("scene",s("סצנה"),i.map(d=>({id:d.entity_id,name:d.name})))}
    ${c("script",s("סקריפט"),a.map(d=>({id:d.entity_id,name:d.name})))}
    ${c("quick",s("פעולה מהירה"),D.map(d=>({id:d,name:O[d]})))}`}var Ae=Object.defineProperty,Ce=Object.getOwnPropertyDescriptor,g=(e,t,i,a)=>{for(var o=a>1?void 0:a?Ce(t,i):t,l=e.length-1,n;l>=0;l--)(n=e[l])&&(o=(a?n(t,i,o):n(o))||o);return a&&o&&Ae(t,i,o),o};function z(e,t,i,a){const o=e.some(l=>l.entity_id===t);return[r`<option value="" ?selected=${!t}>${i}</option>`,...a&&!t&&e.some(l=>l.entity_id===a.entity_id)?[r`<option value=${a.entity_id}>${s("הצעה: {name}",{name:k(a)})}</option>`]:[],...t&&!o?[r`<option value=${t} selected>${k({entity_id:t},s("חיישן שנבחר (אינו זמין כעת)"))}</option>`]:[],...e.map(l=>r`<option value=${l.entity_id} ?selected=${l.entity_id===t}>${k(l)}</option>`)]}let u=class extends ee{constructor(){super(...arguments),this.candidates=null,this.candidatesError="",this.floors=[],this.elevators=[],this.temperatureUnits=[],this.generators=!1,this.doors=!1,this.notices=!1,this.presence=!1,this.xsection=!1,this.open="",this.flat=!1,this.dragFloor=""}change(e){this.dispatchEvent(new CustomEvent("home-draft",{detail:{...this.draft,...e},bubbles:!0,composed:!0}))}setConfig(e){const t=JSON.parse(JSON.stringify(this.draft.config));e(t),this.change({config:t})}setWidget(e,t){this.setConfig(i=>Object.assign(i[e],t))}setPhoneOn(e,t){this.setConfig(i=>i[e].phone_on=t===i[e].on?null:t)}toggleOpen(e){this.dispatchEvent(new CustomEvent("home-edit-open",{detail:{id:this.open===e?"":e},bubbles:!0,composed:!0}))}get listed(){return this.draft.config.order.filter(e=>(e!=="elevators"||this.elevators.length>0)&&(e!=="temperature"||this.temperatureUnits.length>0)&&(e!=="generators"||this.generators)&&(e!=="doors"||this.doors)&&(e!=="notices"||this.notices)&&(e!=="presence"||this.presence)&&(e!=="xsection"||this.xsection))}moveW(e,t){const i=this.listed;this.setConfig(a=>a.order=te(a.order,i,e,t)),this.updateComplete.then(()=>requestAnimationFrame(()=>this.renderRoot.querySelector(`[data-home-wrow="${e}"] [data-home-wmove]:not([disabled])`)?.focus()))}get view(){return ae(this.draft.config,this.baseData,this.candidates)}render(){const e=this.draft;if(!e)return m;const t=this.floors.map(o=>o.id),i=this.listed,a=i.filter(o=>e.config[o].on).length;return r`<section class="home-edit" data-home-edit aria-label=${s("הגדרות המסך הראשי")}>
      <div class="col">
        <div class="grp" role="group" aria-labelledby="he-screen-h">
        <h3 id="he-screen-h">${s("המסך")}</h3>
        <label class="f" data-home-title-field>${s("כותרת המסך")}
          <input type="text" data-home-title maxlength=${se} .value=${e.title} placeholder=${oe} @input=${o=>this.change({title:o.target.value})} />
        </label>
        <div class="row">
          <div class="lbl" id="he-dir">${s("כיוון")}
            <span class="seg" role="group" aria-labelledby="he-dir" data-home-directions>
              ${ie.map(o=>r`<button type="button" data-home-direction=${o} aria-pressed=${String(e.direction===o)} @click=${()=>this.change({direction:o})}>${ne[o]} · ${re[o]}</button>`)}
            </span>
          </div>
          ${e.direction==="b"?r`<div class="lbl" id="he-side">${s("צד הלוח")}
                <span class="seg" role="group" aria-labelledby="he-side">${le.map(o=>r`<button type="button" data-home-side=${o} aria-pressed=${String(e.side===o)} @click=${()=>this.change({side:o})}>${de[o]}</button>`)}</span>
              </div>`:m}
        </div>
        <div class="lbl" id="he-phone">${s("בנייד: איך הווידג׳טים מוצגים")}
          <span class="seg" role="group" aria-labelledby="he-phone" data-home-phone-layouts>
            ${ce.map(o=>r`<button type="button" data-home-phone-layout=${o} aria-pressed=${String(e.config.phone_layout===o)} @click=${()=>this.setConfig(l=>l.phone_layout=o)}>${he[o]}</button>`)}
          </span>
        </div>
        </div>
        <div class="grp" role="group" aria-labelledby="he-widgets-h">
          <div class="gh-row">
            <h3 id="he-widgets-h">${s("ווידג׳טים")}</h3>
            <span class="cnt" data-home-widgets-count>${s("{shown}/{total} מוצגים",{shown:a,total:i.length})}</span>
            <span class="sp"></span>
            <sw-button size="sm" variant="ghost" icon="refresh" data-home-reset-widgets @click=${()=>this.dispatchEvent(new CustomEvent("home-reset",{bubbles:!0,composed:!0}))}>${s("אפס ווידג׳טים לברירת מחדל")}</sw-button>
          </div>
          ${this.candidatesError?r`<div class="err" role="alert" data-home-candidates-error><sw-icon name="warning" size=${14}></sw-icon>${this.candidatesError}</div>`:this.candidates===null?r`<div class="note" role="status" data-home-candidates-loading>${s("טוען את רשימת הישויות…")}</div>`:m}
          <div class="wl">${pe(i,o=>o,(o,l)=>this.widgetRow(o,l))}</div>
        </div>
      </div>
      <div class="col" data-home-floors-col>
        <div class="grp">
        <h3 id="he-floors-lbl">${s("סדר הקומות")}</h3>
        ${t.length?r`<p class="hint">${s("גרור קומה או השתמש בחצים. הקומה הראשונה מוצגת ראשונה.")}</p>`:r`<p class="hint" data-home-floors-empty>${s("אין עדיין קומות במבנה.")}</p>`}
        <ol data-home-floors aria-labelledby="he-floors-lbl">
          ${t.map((o,l)=>r`<li class=${T({floor:!0,dragging:this.dragFloor===o})} data-home-floor=${o} draggable="true"
              @dragstart=${n=>this.onFloorDrag(n,o)} @dragend=${()=>this.dragFloor=""} @dragover=${n=>this.dragFloor&&n.preventDefault()} @drop=${n=>this.onFloorDrop(n,t,l)}>
              <span class="grip" aria-hidden="true"><sw-icon name="grip" size=${14}></sw-icon></span>
              <span class="pos" aria-hidden="true">${l+1}</span>
              <span class="nm">${_(this.floors[l].name)}</span>
              <button type="button" data-home-floor-up=${o} aria-label=${s("העבר את {name} למעלה",{name:this.floors[l].name})} title=${s("למעלה")} ?disabled=${l===0} @click=${()=>this.moveFloor(t,o,l-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
              <button type="button" data-home-floor-down=${o} aria-label=${s("העבר את {name} למטה",{name:this.floors[l].name})} title=${s("למטה")} ?disabled=${l===t.length-1} @click=${()=>this.moveFloor(t,o,l+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
            </li>`)}
        </ol>
        </div>
      </div>
    </section>`}widgetRow(e,t){const i=this.draft,a=i.config[e],o=this.open===e,l=this.listed.length-1;return r`<div class=${T({w:!0,off:!a.on,open:o})} data-home-wrow=${e}>
      <div class="w-top">
        <label class="check"><input type="checkbox" data-home-toggle=${e} .checked=${a.on} @change=${n=>this.setWidget(e,{on:n.target.checked})} aria-label=${s("הצג {name}",{name:$[e]})} /><span class="w-name">${$[e]}</span></label>
        <span class="seg" role="group" aria-label=${s("גודל: {name}",{name:$[e]})}>${I.map(n=>r`<button type="button" data-home-wsize=${`${e}:${n}`} aria-pressed=${String(a.sizes[i.direction]===n)} ?disabled=${!a.on} @click=${()=>this.setConfig(p=>p[e].sizes[i.direction]=n)}>${C[n]}</button>`)}</span>
        <span class="grow"></span>
        <button type="button" class="ib" data-home-wmove=${e} data-home-wearlier=${e} aria-label=${s("הקדם את {name}",{name:$[e]})} title=${s("הקדם")} ?disabled=${t===0} @click=${()=>this.moveW(e,t-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
        <button type="button" class="ib" data-home-wmove=${e} data-home-wlater=${e} aria-label=${s("אחר את {name}",{name:$[e]})} title=${s("אחר")} ?disabled=${t===l} @click=${()=>this.moveW(e,t+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
        <button type="button" class="ib" data-home-wopen=${e} aria-expanded=${String(o)} aria-label=${s("הגדרות: {name}",{name:$[e]})} title=${s("הגדרות")} @click=${()=>this.toggleOpen(e)}><sw-icon name=${o?"chevronDown":"chevronBack"} size=${14}></sw-icon></button>
      </div>
      <div class="w-phone" data-home-wphone=${e}>
        <span class="pl">${s("בנייד")}</span>
        <label class="check"><input type="checkbox" data-home-phone-on=${e} .checked=${F(a,!0)} aria-label=${s("הצג בנייד: {name}",{name:$[e]})} @change=${n=>this.setPhoneOn(e,n.target.checked)} />${s("הצג")}</label>
        <select data-home-phone-size=${e} aria-label=${s("גודל בנייד: {name}",{name:$[e]})} ?disabled=${!F(a,!0)} @change=${n=>this.setWidget(e,{phone_size:n.target.value||null})}>
          <option value="" ?selected=${!a.phone_size}>${s("אוטומטי ({size})",{size:C[ue({...a,phone_size:null},i.direction,!0)]})}</option>
          ${I.map(n=>r`<option value=${n} ?selected=${a.phone_size===n}>${C[n]}</option>`)}
        </select>
      </div>
      ${o?r`<div class="w-body" data-home-wbody=${e}>
            <label class="f">${s("כותרת")} <input type="text" data-home-label=${e} maxlength=${S} .value=${a.label} placeholder=${$[e]} @input=${n=>this.setWidget(e,{label:n.target.value})} /></label>
            ${e==="clock"?this.clockBody():e==="weather"?this.weatherBody():e==="shabbat"?this.shabbatBody():e==="alarm"?this.alarmBody():e==="agenda"?Ee(this.bv1):e==="launcher"?ze(this.bv1):e==="elevators"?this.elevatorsBody():e==="temperature"?this.temperatureBody():e==="media"||e==="generators"||e==="doors"?m:this.quickBody()}
          </div>`:m}
    </div>`}get bv1(){return{config:this.draft.config,candidates:this.candidates,now:new Date,zone:"Asia/Jerusalem",setConfig:e=>this.setConfig(e)}}clockBody(){const e=this.draft.config,t=this.candidates?.sensors??[],i=this.suggestion("date");return r`<div class="f">${s("תצוגה")}<span class="seg" role="group" aria-label=${s("תצוגת השעון")}>${me.map(a=>r`<button type="button" data-home-clock-mode=${a} aria-pressed=${String(e.clock.mode===a)} @click=${()=>this.setWidget("clock",{mode:a})}>${ge[a]}</button>`)}</span></div>
      ${q(this.bv1,"clock")}
      <div class="f"><label class="check"><input type="checkbox" data-home-clock-seconds .checked=${e.clock.seconds} @change=${a=>this.setWidget("clock",{seconds:a.target.checked})} />${s("עם שניות (בגודל גדול)")}</label>
        <label class="check"><input type="checkbox" data-home-clock-hebrew ?disabled=${e.clock.mode!=="datetime"} .checked=${e.clock.hebrew} @change=${a=>this.setWidget("clock",{hebrew:a.target.checked})} />${s("תאריך עברי")}</label></div>
      <label class="f wide">${s("חיישן התאריך העברי")}<select data-home-cal="date" ?disabled=${!e.clock.hebrew} @change=${a=>this.setCal("date",a.target.value)}>${z(t,e.calendar.date,s("לא נבחר: מחושב בדפדפן"),i)}</select></label>`}weatherBody(){const t=this.draft.config.weather,i=this.candidates?.weather??[],a=this.view.weather,o=a?.offers??["condition"],l=this.candidates?.sensors??[],n=c=>r`<label class="check" data-home-wfield-row=${c}><input type="checkbox" data-home-wfield=${c} .checked=${t.fields.includes(c)} @change=${d=>this.toggleField(c,d.target.checked)} />${L[c]}${a?.values[c]?r`<span class="val">${a.values[c].v}${a.values[c].unit?` ${a.values[c].unit}`:""}</span>`:m}</label>`,p=R.filter(c=>o.includes(c)),v=o.includes("forecast");return r`<label class="f wide">${s("ישות מזג האוויר")}
        <select data-home-weather-entity @change=${c=>this.pickWeather(c.target.value)}>${z(i,t.entity,s("לא נבחר"))}</select></label>
      ${q(this.bv1,"weather")}
      ${t.entity&&!a?r`<div class="err wide" data-home-wx-missing>${s("הישות לא נמצאה בקטלוג.")}</div>`:m}
      ${a&&!a.available?r`<div class="err wide" data-home-wx-unavailable>${s("הישות לא זמינה כרגע: הווידג׳ט מוסתר עד שתחזור.")}</div>`:m}
      ${a?r`<div class="f wide" data-home-wfields>${s("מה להציג (רק מה שהישות מדווחת)")}
            <div class="fields">${p.map(n)}</div></div>
          ${v?r`<div class="f wide">${s("אורך התחזית")}<span class="seg" role="group" aria-label=${s("אורך התחזית")}>${we.map(c=>r`<button type="button" data-home-forecast-len=${c} aria-pressed=${String(t.forecast===c)} ?disabled=${!t.fields.includes("forecast")} @click=${()=>this.setWidget("weather",{forecast:c})}>${c==="max"?s("מקסימום ({n})",{n:j(a.forecast_len,"max")}):`${c} (${j(a.forecast_len,c)})`}</button>`)}</span></div>`:m}
          <div class="f wide" data-home-wsources>${s("מקור אחר לשדה (לא חובה)")}
            ${be.filter(c=>t.fields.includes(c)).map(c=>r`<div class="frow"><span>${L[c]}</span><select data-home-wsource=${c} aria-label=${L[c]} @change=${d=>this.setSource(c,d.target.value)}>${z(l,t.sources[c]??"",s("מישות מזג האוויר"))}</select></div>`)}
          </div>`:m}`}toggleField(e,t){this.setConfig(i=>{const a=i.weather.fields.filter(o=>o!==e);i.weather.fields=t?R.filter(o=>o===e||a.includes(o)):a})}pickWeather(e){this.setConfig(t=>{t.weather.entity=e,t.weather.sources={};const a=this.candidates?.weather.find(o=>o.entity_id===e)?.offers??[];e&&a.length&&!t.weather.fields.some(o=>a.includes(o))&&(t.weather.fields=["temperature","condition","humidity","wind","forecast"].filter(o=>a.includes(o)))})}setSource(e,t){this.setConfig(i=>{t?i.weather.sources[e]=t:delete i.weather.sources[e]})}suggestion(e){const t=this.candidates?.suggested_calendar?.[e],i=t?this.candidates?.sensors.find(a=>a.entity_id===t):void 0;return i?{entity_id:i.entity_id,name:i.name}:void 0}setCal(e,t){this.setConfig(i=>i.calendar[e]=t)}suggestAll(){this.setConfig(e=>{for(const t of W)!e.calendar[t]&&this.candidates?.suggested_calendar?.[t]&&(e.calendar[t]=this.candidates.suggested_calendar[t])})}shabbatBody(){const e=this.draft.config.calendar,t=this.candidates?.sensors??[],i=(l,n,p)=>{const v=t.filter(h=>h.suggested),c=t.filter(h=>!h.suggested),d=h=>r`<option value=${h.entity_id} ?selected=${h.entity_id===l}>${k(h)}</option>`;return r`<option value="" ?selected=${!l}>${n}</option>
        ${p&&!l?r`<option value=${p.entity_id}>${s("הצעה: {name}",{name:k(p)})}</option>`:m}
        ${l&&!t.some(h=>h.entity_id===l)?r`<option value=${l} selected>${k({entity_id:l},s("חיישן שנבחר (אינו זמין כעת)"))}</option>`:m}
        ${v.length?r`<optgroup label=${s("לוח שנה עברי")}>${v.map(d)}</optgroup>`:m}
        <optgroup label=${s("כל החיישנים")}>${c.map(d)}</optgroup>`},a=W.some(l=>!e[l]&&this.candidates?.suggested_calendar?.[l]),o=["parsha","candles","havdalah","holiday"].map(l=>r`<label class="f">${ve[l]}<select data-home-cal=${l} @change=${n=>this.setCal(l,n.target.value)}>${i(e[l],s("לא נבחר"),this.suggestion(l))}</select></label>`);return r`${o}
      ${a?r`<div class="wide"><sw-button size="sm" data-home-suggest @click=${()=>this.suggestAll()}>${s("מלא הצעות אוטומטיות")}</sw-button></div>`:m}
      <div class="f wide" data-home-extras>${s("שדות נוספים (עד {n})",{n:M})}
        ${e.extras.map((l,n)=>r`<div class="extra" data-home-extra=${n}>
            <select aria-label=${s("חיישן")} data-home-extra-entity=${n} @change=${p=>this.setExtra(n,{entity_id:p.target.value})}>${i(l.entity_id,s("בחר חיישן"))}</select>
            <input type="text" aria-label=${s("כותרת")} data-home-extra-label=${n} maxlength=${S} .value=${l.label} placeholder=${s("כותרת")} @input=${p=>this.setExtra(n,{label:p.target.value})} />
            <button type="button" class="ib" data-home-extra-remove=${n} aria-label=${s("הסר שדה")} @click=${()=>this.setConfig(p=>p.calendar.extras.splice(n,1))}><sw-icon name="close" size=${13}></sw-icon></button>
          </div>`)}
        ${e.extras.length<M?r`<div><sw-button size="sm" icon="plus" data-home-extra-add @click=${()=>this.setConfig(l=>l.calendar.extras.push({entity_id:"",label:""}))}>${s("הוסף שדה")}</sw-button></div>`:m}
      </div>`}setExtra(e,t){this.setConfig(i=>Object.assign(i.calendar.extras[e],t))}elevatorsBody(){const e=this.draft.config.elevators;return r`<div class="f wide">${y("displayMode")}<span class="seg" role="group" aria-label=${y("displayMode")}>${N.map(t=>r`<button type="button" data-home-elevators-mode=${t} aria-pressed=${String(e.mode===t)} @click=${()=>this.setWidget("elevators",{mode:t})}>${y(fe[t])}</button>`)}</span></div>
      <div class="f wide">${y("filter")}<span class="seg" role="group" aria-label=${y("filter")}>${U.map(t=>r`<button type="button" data-home-elevators-filter=${t} aria-pressed=${String(e.filter===t)} @click=${()=>this.setWidget("elevators",{filter:t})}>${y($e[t])}</button>`)}</span></div>
      <div class="f wide" data-home-elevators-include>${y("include")}
        <div class="fields">${this.elevators.map(t=>r`<label class="check"><input type="checkbox" data-home-elevator-include=${t.id} .checked=${!e.hidden.includes(t.id)}
          @change=${i=>this.setWidget("elevators",{hidden:i.target.checked?e.hidden.filter(a=>a!==t.id):[...e.hidden,t.id]})} />${_(t.name)}</label>`)}</div></div>`}temperatureBody(){const e=this.draft.config.temperature,t={combined:"wModeCombined",cards:"wModeCards",both:"wModeBoth"},i={all:"wFilterAll",alerts:"wFilterAlerts"};return r`<div class="f wide">${x("wDisplayMode")}<span class="seg" role="group" aria-label=${x("wDisplayMode")}>${N.map(a=>r`<button type="button" data-home-temp-mode=${a} aria-pressed=${String(e.mode===a)} @click=${()=>this.setWidget("temperature",{mode:a})}>${x(t[a])}</button>`)}</span></div>
      <div class="f wide">${x("wFilter")}<span class="seg" role="group" aria-label=${x("wFilter")}>${U.map(a=>r`<button type="button" data-home-temp-filter=${a} aria-pressed=${String(e.filter===a)} @click=${()=>this.setWidget("temperature",{filter:a})}>${x(i[a])}</button>`)}</span></div>
      <div class="f wide" data-home-temp-include>${x("wInclude")}
        <div class="fields">${this.temperatureUnits.map(a=>r`<label class="check"><input type="checkbox" data-home-temp-include=${a.id} .checked=${!e.hidden.includes(a.id)}
          @change=${o=>this.setWidget("temperature",{hidden:o.target.checked?e.hidden.filter(l=>l!==a.id):[...e.hidden,a.id]})} />${_(a.name)}</label>`)}</div></div>`}alarmBody(){const e=this.draft.config.alarm,t=this.candidates?.alarms??[];return r`<label class="f">${s("לוח האזעקה")}<select data-home-alarm-entity @change=${i=>this.setWidget("alarm",{entity:i.target.value})}>${z(t,e.entity,s("אוטומטי: הדחוף ביותר"))}</select></label>`}quickBody(){const e=this.draft.config.quick;return r`<div class="f wide">${s("פעולות")}
      <div class="fields">${D.map(t=>r`<label class="check"><input type="checkbox" data-home-quick-action=${t} .checked=${e.actions.includes(t)} @change=${i=>this.toggleAction(t,i.target.checked)} />${O[t]}</label>`)}</div></div>`}toggleAction(e,t){this.setConfig(i=>i.quick.actions=D.filter(a=>a===e?t:i.quick.actions.includes(a)))}moveFloor(e,t,i){const a=i<e.indexOf(t);this.change({floorOrder:H(e,t,i)}),this.updateComplete.then(()=>requestAnimationFrame(()=>{const o=this.renderRoot,l=`[data-home-floor="${CSS.escape(t)}"]`;o.querySelector(`${l} [data-home-floor-${a?"up":"down"}]:not([disabled])`)?.focus()??o.querySelector(`${l} button:not([disabled])`)?.focus()}))}onFloorDrag(e,t){this.dragFloor=t,e.dataTransfer?.setData("text/plain",t),e.dataTransfer&&(e.dataTransfer.effectAllowed="move")}onFloorDrop(e,t,i){e.preventDefault();const a=this.dragFloor;this.dragFloor="",a&&this.change({floorOrder:H(t,a,i)})}};u.styles=[_e,ye`
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
      .seg {
        align-self: flex-start;
        flex: 0 1 auto;
        flex-wrap: wrap;
      }
      .seg button {
        transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
      }
      .seg button:disabled {
        opacity: 0.45;
        cursor: default;
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
      .floor button:active:not(:disabled),
      .seg button:active:not(:disabled) {
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
        .seg button,
        .w,
        .floor {
          transition-duration: 0ms;
        }
      }
    `];g([b({attribute:!1})],u.prototype,"draft",2);g([b({attribute:!1})],u.prototype,"candidates",2);g([b({attribute:!1})],u.prototype,"candidatesError",2);g([b({attribute:!1})],u.prototype,"baseData",2);g([b({attribute:!1})],u.prototype,"floors",2);g([b({attribute:!1})],u.prototype,"elevators",2);g([b({attribute:!1})],u.prototype,"temperatureUnits",2);g([b({type:Boolean})],u.prototype,"generators",2);g([b({type:Boolean})],u.prototype,"doors",2);g([b({type:Boolean})],u.prototype,"notices",2);g([b({type:Boolean})],u.prototype,"presence",2);g([b({type:Boolean})],u.prototype,"xsection",2);g([b()],u.prototype,"open",2);g([b({type:Boolean,reflect:!0})],u.prototype,"flat",2);g([xe()],u.prototype,"dragFloor",2);u=g([ke("home-edit-panel")],u);export{u as HomeEditPanel};
