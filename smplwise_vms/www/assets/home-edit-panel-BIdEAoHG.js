import{i5 as A,dD as s,A as w,aj as E,i6 as G,b as r,i7 as B,i8 as X,i9 as T,ia as V,ib as L,ic as J,id as S,ie as O,ig as Q,ih as Z,ii as ee,ij as te,a as ae,ik as se,il as ie,im as oe,io as le,hq as ne,hs as re,hr as de,ip as ce,iq as he,ht as pe,hu as me,bo as ge,cV as I,hv as $,ae as F,hw as R,hx as C,ir as W,is as we,it as ue,iu as ve,iv as M,iw as N,ix as H,iy as fe,iz as D,iA as U,iB as be,iC as q,fe as y,hj as K,iD as P,iE as $e,iF as x,iG as j,iH as k,j as ye,z as u,k as xe,m as ke}from"./index-CVsAtsN7.js";import{b as Ee}from"./settings-Dmo75PEI.js";import{M as _e}from"./personal-mode-fjrVUUIE.js";import"./sw-logo-art-PLtEZJxU.js";function Y(e,t){const o=e.config[t].style;return r`<div class="f">${s("תצוגה בסגנון Bubble")}<sw-segmented label=${t==="clock"?s("תצוגת השעון"):s("תצוגת מזג האוויר")} value=${o} @change=${a=>e.setConfig(i=>i[t].style=a.detail.value)}
    .options=${Q.map(a=>({value:a,label:Z[a],attrs:{"data-home-style":`${t}:${a}`}}))}></sw-segmented></div>`}function ze(e){const t=e.config.agenda,o=e.candidates?.calendars??[],a=t.calendars,i=(l,p)=>e.setConfig(v=>{const c=v.agenda.calendars.filter(d=>d!==l);v.agenda.calendars=p?[...c,l].slice(0,A):c}),n=a.length>=A;return r`<div class="f wide" data-home-agenda-calendars>${s("יומנים (עד {n})",{n:A})}
      ${o.length?r`<div class="fields">${o.map(l=>{const p=a.includes(l.entity_id);return r`<label class="check" data-home-agenda-cal-row=${l.entity_id}><input type="checkbox" data-home-agenda-cal=${l.entity_id} .checked=${p} ?disabled=${!p&&n} @change=${v=>i(l.entity_id,v.target.checked)} />${E(l.name)}${l.event?r`<span class="val">${G(l.event,e.now,e.zone)}</span>`:w}</label>`})}</div>`:r`<div class="err" data-home-agenda-none>${s("לא נמצאו יומנים בקטלוג.")}</div>`}
      ${a.filter(l=>!o.some(p=>p.entity_id===l)).map(l=>r`<label class="check" data-home-agenda-cal-row=${l}><input type="checkbox" data-home-agenda-cal=${l} checked @change=${p=>i(l,p.target.checked)} />${l}<span class="val">${s("לא בקטלוג")}</span></label>`)}
    </div>
    <div class="f">${s("טווח")}<sw-segmented label=${s("טווח היומן")} value=${String(t.days)} @change=${l=>e.setConfig(p=>p.agenda.days=B.find(v=>String(v)===l.detail.value)??p.agenda.days)}
      .options=${B.map(l=>({value:String(l),label:X[l],attrs:{"data-home-agenda-days":String(l)}}))}></sw-segmented></div>`}function Ae(e){const t=e.config.launcher.items,o=e.candidates?.scenes??[],a=e.candidates?.scripts??[],i=(d,h)=>t.some(f=>f.kind===d&&f.id===h),n=t.length>=T,l=(d,h)=>{!h||i(d,h)||n||e.setConfig(f=>f.launcher.items.push({kind:d,id:h,label:""}))},p=(d,h)=>e.setConfig(f=>{const b=f.launcher.items;if(h<0||h>=b.length)return;const[_]=b.splice(d,1);b.splice(h,0,_)}),v=d=>d.kind==="route"?ee(d.id)?.label??d.id:d.kind==="quick"?O[d.id]??d.id:(d.kind==="scene"?o:a).find(h=>h.entity_id===d.id)?.name??te(d.id),c=(d,h,f)=>r`<label class="f">${h}
    <select data-home-launch-add=${d} ?disabled=${n||!f.length} @change=${b=>{const _=b.target;l(d,_.value),_.value=""}}>
      <option value="">${f.length?s("הוסף…"):s("אין")}</option>
      ${f.filter(b=>!i(d,b.id)).map(b=>r`<option value=${b.id}>${b.name}</option>`)}
    </select></label>`;return r`<div class="f wide" data-home-launch-items>${s("פריטים (עד {n})",{n:T})}
      ${t.length?t.map((d,h)=>r`<div class="extra" data-home-launch-item=${`${d.kind}:${d.id}`}>
              <span class="val" style="direction:inherit"><b>${V[d.kind]}</b> · ${E(v(d))}</span>
              <input type="text" aria-label=${s("כותרת")} data-home-launch-label=${h} maxlength=${L} .value=${d.label} placeholder=${v(d)} @input=${f=>e.setConfig(b=>b.launcher.items[h].label=f.target.value)} />
              <span style="display:inline-flex;gap:4px">
                <button type="button" class="ib" data-home-launch-up=${h} aria-label=${s("הקדם")} ?disabled=${h===0} @click=${()=>p(h,h-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
                <button type="button" class="ib" data-home-launch-down=${h} aria-label=${s("אחר")} ?disabled=${h===t.length-1} @click=${()=>p(h,h+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
                <button type="button" class="ib" data-home-launch-remove=${h} aria-label=${s("הסר פריט")} @click=${()=>e.setConfig(f=>f.launcher.items.splice(h,1))}><sw-icon name="close" size=${13}></sw-icon></button>
              </span>
            </div>`):r`<span class="val" style="direction:inherit" data-home-launch-empty>${s("אין פריטים: הווידג׳ט מוסתר עד שיתווסף פריט.")}</span>`}
    </div>
    ${c("route",s("מסך"),J.map(d=>({id:d.id,name:d.label})))}
    ${c("scene",s("סצנה"),o.map(d=>({id:d.entity_id,name:d.name})))}
    ${c("script",s("סקריפט"),a.map(d=>({id:d.entity_id,name:d.name})))}
    ${c("quick",s("פעולה מהירה"),S.map(d=>({id:d,name:O[d]})))}`}var Ce=Object.defineProperty,De=Object.getOwnPropertyDescriptor,g=(e,t,o,a)=>{for(var i=a>1?void 0:a?De(t,o):t,n=e.length-1,l;n>=0;n--)(l=e[n])&&(i=(a?l(t,o,i):l(i))||i);return a&&i&&Ce(t,o,i),i};function z(e,t,o,a){const i=e.some(n=>n.entity_id===t);return[r`<option value="" ?selected=${!t}>${o}</option>`,...a&&!t&&e.some(n=>n.entity_id===a.entity_id)?[r`<option value=${a.entity_id}>${s("הצעה: {name}",{name:k(a)})}</option>`]:[],...t&&!i?[r`<option value=${t} selected>${k({entity_id:t},s("חיישן שנבחר (אינו זמין כעת)"))}</option>`]:[],...e.map(n=>r`<option value=${n.entity_id} ?selected=${n.entity_id===t}>${k(n)}</option>`)]}let m=class extends ae{constructor(){super(...arguments),this.candidates=null,this.candidatesError="",this.floors=[],this.elevators=[],this.temperatureUnits=[],this.generators=!1,this.doors=!1,this.notices=!1,this.presence=!1,this.xsection=!1,this.open="",this.flat=!1,this.busy=!1,this.dragFloor=""}change(e){this.dispatchEvent(new CustomEvent("home-draft",{detail:{...this.draft,...e},bubbles:!0,composed:!0}))}setConfig(e){const t=JSON.parse(JSON.stringify(this.draft.config));e(t),this.change({config:t})}setWidget(e,t){this.setConfig(o=>Object.assign(o[e],t))}setPhoneOn(e,t){this.setConfig(o=>o[e].phone_on=t===o[e].on?null:t)}toggleOpen(e){this.dispatchEvent(new CustomEvent("home-edit-open",{detail:{id:this.open===e?"":e},bubbles:!0,composed:!0}))}get listed(){return this.draft.config.order.filter(e=>(e!=="elevators"||this.elevators.length>0)&&(e!=="temperature"||this.temperatureUnits.length>0)&&(e!=="generators"||this.generators)&&(e!=="doors"||this.doors)&&(e!=="notices"||this.notices)&&(e!=="presence"||this.presence)&&(e!=="xsection"||this.xsection))}moveW(e,t){const o=this.listed;this.setConfig(a=>a.order=se(a.order,o,e,t)),this.updateComplete.then(()=>requestAnimationFrame(()=>this.renderRoot.querySelector(`[data-home-wrow="${e}"] [data-home-wmove]:not([disabled])`)?.focus()))}get view(){return ie(this.draft.config,this.baseData,this.candidates)}render(){const e=this.draft;if(!e)return w;const t=this.floors.map(i=>i.id),o=this.listed,a=o.filter(i=>e.config[i].on).length;return r`<section class="home-edit" data-home-edit aria-label=${s("הגדרות המסך הראשי")}>
      <div class="col">
        <div class="grp" role="group" aria-labelledby="he-screen-h">
        <h3 id="he-screen-h">${s("המסך")}</h3>
        <label class="f" data-home-title-field>${s("כותרת המסך")}
          <input type="text" data-home-title maxlength=${oe} .value=${e.title} placeholder=${le} @input=${i=>this.change({title:i.target.value})} />
        </label>
        <div class="row">
          <div class="lbl" id="he-dir">${s("כיוון")}
            <sw-segmented label=${s("כיוון")} data-home-directions value=${e.direction} @change=${i=>this.change({direction:i.detail.value})}
              .options=${ne.map(i=>({value:i,label:`${re[i]} · ${de[i]}`,attrs:{"data-home-direction":i}}))}></sw-segmented>
          </div>
          ${e.direction==="b"?r`<div class="lbl" id="he-side">${s("צד הלוח")}
                <sw-segmented label=${s("צד הלוח")} value=${e.side} @change=${i=>this.change({side:i.detail.value})}
                  .options=${ce.map(i=>({value:i,label:he[i],attrs:{"data-home-side":i}}))}></sw-segmented>
              </div>`:w}
        </div>
        <div class="lbl" id="he-phone">${s("בנייד: איך הווידג׳טים מוצגים")}
          <sw-segmented label=${s("בנייד: איך הווידג׳טים מוצגים")} data-home-phone-layouts value=${e.config.phone_layout} @change=${i=>this.setConfig(n=>n.phone_layout=i.detail.value)}
            .options=${pe.map(i=>({value:i,label:me[i],attrs:{"data-home-phone-layout":i}}))}></sw-segmented>
        </div>
        </div>
        <div class="grp" role="group" aria-labelledby="he-widgets-h">
          <div class="gh-row">
            <h3 id="he-widgets-h">${s("ווידג׳טים")}</h3>
            <span class="cnt" data-home-widgets-count>${s("{shown}/{total} מוצגים",{shown:a,total:o.length})}</span>
            <span class="sp"></span>
            <sw-button size="sm" variant="ghost" icon="refresh" data-home-reset-widgets @click=${()=>this.dispatchEvent(new CustomEvent("home-reset",{bubbles:!0,composed:!0}))}>${s("אפס ווידג׳טים לברירת מחדל")}</sw-button>
          </div>
          ${this.candidatesError?r`<div class="err" role="alert" data-home-candidates-error><sw-icon name="warning" size=${14}></sw-icon>${this.candidatesError}</div>`:this.candidates===null?r`<div class="note" role="status" data-home-candidates-loading>${s("טוען את רשימת הישויות…")}</div>`:w}
          <div class="wl">${ge(o,i=>i,(i,n)=>this.widgetRow(i,n))}</div>
        </div>
      </div>
      <div class="col" data-home-floors-col>
        <div class="grp">
        <h3 id="he-floors-lbl">${s("סדר הקומות")}</h3>
        ${t.length?r`<p class="hint">${s("גרור קומה או השתמש בחצים. הקומה הראשונה מוצגת ראשונה.")}</p>`:r`<p class="hint" data-home-floors-empty>${s("אין עדיין קומות במבנה.")}</p>`}
        <ol data-home-floors aria-labelledby="he-floors-lbl">
          ${t.map((i,n)=>r`<li class=${I({floor:!0,dragging:this.dragFloor===i})} data-home-floor=${i} draggable="true"
              @dragstart=${l=>this.onFloorDrag(l,i)} @dragend=${()=>this.dragFloor=""} @dragover=${l=>this.dragFloor&&l.preventDefault()} @drop=${l=>this.onFloorDrop(l,t,n)}>
              <span class="grip" aria-hidden="true"><sw-icon name="grip" size=${14}></sw-icon></span>
              <span class="pos" aria-hidden="true">${n+1}</span>
              <span class="nm">${E(this.floors[n].name)}</span>
              <button type="button" data-home-floor-up=${i} aria-label=${s("העבר את {name} למעלה",{name:this.floors[n].name})} title=${s("למעלה")} ?disabled=${n===0} @click=${()=>this.moveFloor(t,i,n-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
              <button type="button" data-home-floor-down=${i} aria-label=${s("העבר את {name} למטה",{name:this.floors[n].name})} title=${s("למטה")} ?disabled=${n===t.length-1} @click=${()=>this.moveFloor(t,i,n+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
            </li>`)}
        </ol>
        </div>
      </div>
    </section>`}widgetRow(e,t){const o=this.draft,a=o.config[e],i=this.open===e,n=this.listed.length-1;return r`<div class=${I({w:!0,off:!a.on,open:i})} data-home-wrow=${e}>
      <div class="w-top">
        <label class="check"><sw-toggle size="sm" labelHidden in-label label=${s("הצג {name}",{name:$[e]})} data-home-toggle=${e} .checked=${a.on} ?disabled=${this.busy} @change=${l=>this.setWidget(e,{on:F(l)})}></sw-toggle><span class="w-name">${$[e]}</span></label>
        <sw-segmented label=${s("גודל: {name}",{name:$[e]})} value=${a.sizes[o.direction]} ?disabled=${!a.on} @change=${l=>this.setConfig(p=>p[e].sizes[o.direction]=l.detail.value)}
          .options=${R.map(l=>({value:l,label:C[l],attrs:{"data-home-wsize":`${e}:${l}`}}))}></sw-segmented>
        <span class="grow"></span>
        <button type="button" class="ib" data-home-wmove=${e} data-home-wearlier=${e} aria-label=${s("הקדם את {name}",{name:$[e]})} title=${s("הקדם")} ?disabled=${t===0} @click=${()=>this.moveW(e,t-1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
        <button type="button" class="ib" data-home-wmove=${e} data-home-wlater=${e} aria-label=${s("אחר את {name}",{name:$[e]})} title=${s("אחר")} ?disabled=${t===n} @click=${()=>this.moveW(e,t+1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
        <button type="button" class="ib" data-home-wopen=${e} aria-expanded=${String(i)} aria-label=${s("הגדרות: {name}",{name:$[e]})} title=${s("הגדרות")} @click=${()=>this.toggleOpen(e)}><sw-icon name=${i?"chevronDown":"chevronBack"} size=${14}></sw-icon></button>
      </div>
      <div class="w-phone" data-home-wphone=${e}>
        <span class="pl">${s("בנייד")}</span>
        <label class="check"><sw-toggle size="sm" labelHidden in-label label=${s("הצג בנייד: {name}",{name:$[e]})} data-home-phone-on=${e} .checked=${W(a,!0)} ?disabled=${this.busy} @change=${l=>this.setPhoneOn(e,F(l))}></sw-toggle>${s("הצג")}</label>
        <select data-home-phone-size=${e} aria-label=${s("גודל בנייד: {name}",{name:$[e]})} ?disabled=${!W(a,!0)} @change=${l=>this.setWidget(e,{phone_size:l.target.value||null})}>
          <option value="" ?selected=${!a.phone_size}>${s("אוטומטי ({size})",{size:C[we({...a,phone_size:null},o.direction,!0)]})}</option>
          ${R.map(l=>r`<option value=${l} ?selected=${a.phone_size===l}>${C[l]}</option>`)}
        </select>
      </div>
      ${i?r`<div class="w-body" data-home-wbody=${e}>
            <label class="f">${s("כותרת")} <input type="text" data-home-label=${e} maxlength=${L} .value=${a.label} placeholder=${$[e]} @input=${l=>this.setWidget(e,{label:l.target.value})} /></label>
            ${e==="clock"?this.clockBody():e==="weather"?this.weatherBody():e==="shabbat"?this.shabbatBody():e==="alarm"?this.alarmBody():e==="agenda"?ze(this.bv1):e==="launcher"?Ae(this.bv1):e==="elevators"?this.elevatorsBody():e==="temperature"?this.temperatureBody():e==="media"||e==="generators"||e==="doors"?w:this.quickBody()}
          </div>`:w}
    </div>`}get bv1(){return{config:this.draft.config,candidates:this.candidates,now:new Date,zone:"Asia/Jerusalem",setConfig:e=>this.setConfig(e)}}clockBody(){const e=this.draft.config,t=this.candidates?.sensors??[],o=this.suggestion("date");return r`<div class="f">${s("תצוגה")}<sw-segmented label=${s("תצוגת השעון")} value=${e.clock.mode} @change=${a=>this.setWidget("clock",{mode:a.detail.value})}
      .options=${ue.map(a=>({value:a,label:ve[a],attrs:{"data-home-clock-mode":a}}))}></sw-segmented></div>
      ${Y(this.bv1,"clock")}
      <div class="f"><label class="check"><input type="checkbox" data-home-clock-seconds .checked=${e.clock.seconds} @change=${a=>this.setWidget("clock",{seconds:a.target.checked})} />${s("עם שניות (בגודל גדול)")}</label>
        <label class="check"><input type="checkbox" data-home-clock-hebrew ?disabled=${e.clock.mode!=="datetime"} .checked=${e.clock.hebrew} @change=${a=>this.setWidget("clock",{hebrew:a.target.checked})} />${s("תאריך עברי")}</label></div>
      <label class="f wide">${s("חיישן התאריך העברי")}<select data-home-cal="date" ?disabled=${!e.clock.hebrew} @change=${a=>this.setCal("date",a.target.value)}>${z(t,e.calendar.date,s("לא נבחר: מחושב בדפדפן"),o)}</select></label>`}weatherBody(){const t=this.draft.config.weather,o=this.candidates?.weather??[],a=this.view.weather,i=a?.offers??["condition"],n=this.candidates?.sensors??[],l=c=>r`<label class="check" data-home-wfield-row=${c}><input type="checkbox" data-home-wfield=${c} .checked=${t.fields.includes(c)} @change=${d=>this.toggleField(c,d.target.checked)} />${D[c]}${a?.values[c]?r`<span class="val">${a.values[c].v}${a.values[c].unit?` ${a.values[c].unit}`:""}</span>`:w}</label>`,p=M.filter(c=>i.includes(c)),v=i.includes("forecast");return r`<label class="f wide">${s("ישות מזג האוויר")}
        <select data-home-weather-entity @change=${c=>this.pickWeather(c.target.value)}>${z(o,t.entity,s("לא נבחר"))}</select></label>
      ${Y(this.bv1,"weather")}
      ${t.entity&&!a?r`<div class="err wide" data-home-wx-missing>${s("הישות לא נמצאה בקטלוג.")}</div>`:w}
      ${a&&!a.available?r`<div class="err wide" data-home-wx-unavailable>${s("הישות לא זמינה כרגע: הווידג׳ט מוסתר עד שתחזור.")}</div>`:w}
      ${a?r`<div class="f wide" data-home-wfields>${s("מה להציג (רק מה שהישות מדווחת)")}
            <div class="fields">${p.map(l)}</div></div>
          ${v?r`<div class="f wide">${s("אורך התחזית")}<sw-segmented label=${s("אורך התחזית")} value=${String(t.forecast)} ?disabled=${!t.fields.includes("forecast")}
              @change=${c=>this.setWidget("weather",{forecast:N.find(d=>String(d)===c.detail.value)??t.forecast})}
              .options=${N.map(c=>({value:String(c),label:c==="max"?s("מקסימום ({n})",{n:H(a.forecast_len,"max")}):`${c} (${H(a.forecast_len,c)})`,attrs:{"data-home-forecast-len":String(c)}}))}></sw-segmented></div>`:w}
          <div class="f wide" data-home-wsources>${s("מקור אחר לשדה (לא חובה)")}
            ${fe.filter(c=>t.fields.includes(c)).map(c=>r`<div class="frow"><span>${D[c]}</span><select data-home-wsource=${c} aria-label=${D[c]} @change=${d=>this.setSource(c,d.target.value)}>${z(n,t.sources[c]??"",s("מישות מזג האוויר"))}</select></div>`)}
          </div>`:w}`}toggleField(e,t){this.setConfig(o=>{const a=o.weather.fields.filter(i=>i!==e);o.weather.fields=t?M.filter(i=>i===e||a.includes(i)):a})}pickWeather(e){this.setConfig(t=>{t.weather.entity=e,t.weather.sources={};const a=this.candidates?.weather.find(i=>i.entity_id===e)?.offers??[];e&&a.length&&!t.weather.fields.some(i=>a.includes(i))&&(t.weather.fields=["temperature","condition","humidity","wind","forecast"].filter(i=>a.includes(i)))})}setSource(e,t){this.setConfig(o=>{t?o.weather.sources[e]=t:delete o.weather.sources[e]})}suggestion(e){const t=this.candidates?.suggested_calendar?.[e],o=t?this.candidates?.sensors.find(a=>a.entity_id===t):void 0;return o?{entity_id:o.entity_id,name:o.name}:void 0}setCal(e,t){this.setConfig(o=>o.calendar[e]=t)}suggestAll(){this.setConfig(e=>{for(const t of U)!e.calendar[t]&&this.candidates?.suggested_calendar?.[t]&&(e.calendar[t]=this.candidates.suggested_calendar[t])})}shabbatBody(){const e=this.draft.config.calendar,t=this.candidates?.sensors??[],o=(n,l,p)=>{const v=t.filter(h=>h.suggested),c=t.filter(h=>!h.suggested),d=h=>r`<option value=${h.entity_id} ?selected=${h.entity_id===n}>${k(h)}</option>`;return r`<option value="" ?selected=${!n}>${l}</option>
        ${p&&!n?r`<option value=${p.entity_id}>${s("הצעה: {name}",{name:k(p)})}</option>`:w}
        ${n&&!t.some(h=>h.entity_id===n)?r`<option value=${n} selected>${k({entity_id:n},s("חיישן שנבחר (אינו זמין כעת)"))}</option>`:w}
        ${v.length?r`<optgroup label=${s("לוח שנה עברי")}>${v.map(d)}</optgroup>`:w}
        <optgroup label=${s("כל החיישנים")}>${c.map(d)}</optgroup>`},a=U.some(n=>!e[n]&&this.candidates?.suggested_calendar?.[n]),i=["parsha","candles","havdalah","holiday"].map(n=>r`<label class="f">${be[n]}<select data-home-cal=${n} @change=${l=>this.setCal(n,l.target.value)}>${o(e[n],s("לא נבחר"),this.suggestion(n))}</select></label>`);return r`${i}
      ${a?r`<div class="wide"><sw-button size="sm" data-home-suggest @click=${()=>this.suggestAll()}>${s("מלא הצעות אוטומטיות")}</sw-button></div>`:w}
      <div class="f wide" data-home-extras>${s("שדות נוספים (עד {n})",{n:q})}
        ${e.extras.map((n,l)=>r`<div class="extra" data-home-extra=${l}>
            <select aria-label=${s("חיישן")} data-home-extra-entity=${l} @change=${p=>this.setExtra(l,{entity_id:p.target.value})}>${o(n.entity_id,s("בחר חיישן"))}</select>
            <input type="text" aria-label=${s("כותרת")} data-home-extra-label=${l} maxlength=${L} .value=${n.label} placeholder=${s("כותרת")} @input=${p=>this.setExtra(l,{label:p.target.value})} />
            <button type="button" class="ib" data-home-extra-remove=${l} aria-label=${s("הסר שדה")} @click=${()=>this.setConfig(p=>p.calendar.extras.splice(l,1))}><sw-icon name="close" size=${13}></sw-icon></button>
          </div>`)}
        ${e.extras.length<q?r`<div><sw-button size="sm" icon="plus" data-home-extra-add @click=${()=>this.setConfig(n=>n.calendar.extras.push({entity_id:"",label:""}))}>${s("הוסף שדה")}</sw-button></div>`:w}
      </div>`}setExtra(e,t){this.setConfig(o=>Object.assign(o.calendar.extras[e],t))}elevatorsBody(){const e=this.draft.config.elevators;return r`<div class="f wide">${y("displayMode")}<sw-segmented label=${y("displayMode")} value=${e.mode} @change=${t=>this.setWidget("elevators",{mode:t.detail.value})}
      .options=${K.map(t=>({value:t,label:y(_e[t]),attrs:{"data-home-elevators-mode":t}}))}></sw-segmented></div>
      <div class="f wide">${y("filter")}<sw-segmented label=${y("filter")} value=${e.filter} @change=${t=>this.setWidget("elevators",{filter:t.detail.value})}
        .options=${P.map(t=>({value:t,label:y($e[t]),attrs:{"data-home-elevators-filter":t}}))}></sw-segmented></div>
      <div class="f wide" data-home-elevators-include>${y("include")}
        <div class="fields">${this.elevators.map(t=>r`<label class="check"><input type="checkbox" data-home-elevator-include=${t.id} .checked=${!e.hidden.includes(t.id)}
          @change=${o=>this.setWidget("elevators",{hidden:o.target.checked?e.hidden.filter(a=>a!==t.id):[...e.hidden,t.id]})} />${E(t.name)}</label>`)}</div></div>`}temperatureBody(){const e=this.draft.config.temperature,t={combined:"wModeCombined",cards:"wModeCards",both:"wModeBoth"},o={all:"wFilterAll",alerts:"wFilterAlerts"};return r`<div class="f wide">${x("wDisplayMode")}<sw-segmented label=${x("wDisplayMode")} value=${e.mode} @change=${a=>this.setWidget("temperature",{mode:a.detail.value})}
      .options=${K.map(a=>({value:a,label:x(t[a]),attrs:{"data-home-temp-mode":a}}))}></sw-segmented></div>
      <div class="f wide">${x("wFilter")}<sw-segmented label=${x("wFilter")} value=${e.filter} @change=${a=>this.setWidget("temperature",{filter:a.detail.value})}
        .options=${P.map(a=>({value:a,label:x(o[a]),attrs:{"data-home-temp-filter":a}}))}></sw-segmented></div>
      <div class="f wide" data-home-temp-include>${x("wInclude")}
        <div class="fields">${this.temperatureUnits.map(a=>r`<label class="check"><input type="checkbox" data-home-temp-include=${a.id} .checked=${!e.hidden.includes(a.id)}
          @change=${i=>this.setWidget("temperature",{hidden:i.target.checked?e.hidden.filter(n=>n!==a.id):[...e.hidden,a.id]})} />${E(a.name)}</label>`)}</div></div>`}alarmBody(){const e=this.draft.config.alarm,t=this.candidates?.alarms??[];return r`<label class="f">${s("לוח האזעקה")}<select data-home-alarm-entity @change=${o=>this.setWidget("alarm",{entity:o.target.value})}>${z(t,e.entity,s("אוטומטי: הדחוף ביותר"))}</select></label>`}quickBody(){const e=this.draft.config.quick;return r`<div class="f wide">${s("פעולות")}
      <div class="fields">${S.map(t=>r`<label class="check"><input type="checkbox" data-home-quick-action=${t} .checked=${e.actions.includes(t)} @change=${o=>this.toggleAction(t,o.target.checked)} />${O[t]}</label>`)}</div></div>`}toggleAction(e,t){this.setConfig(o=>o.quick.actions=S.filter(a=>a===e?t:o.quick.actions.includes(a)))}moveFloor(e,t,o){const a=o<e.indexOf(t);this.change({floorOrder:j(e,t,o)}),this.updateComplete.then(()=>requestAnimationFrame(()=>{const i=this.renderRoot,n=`[data-home-floor="${CSS.escape(t)}"]`;i.querySelector(`${n} [data-home-floor-${a?"up":"down"}]:not([disabled])`)?.focus()??i.querySelector(`${n} button:not([disabled])`)?.focus()}))}onFloorDrag(e,t){this.dragFloor=t,e.dataTransfer?.setData("text/plain",t),e.dataTransfer&&(e.dataTransfer.effectAllowed="move")}onFloorDrop(e,t,o){e.preventDefault();const a=this.dragFloor;this.dragFloor="",a&&this.change({floorOrder:j(t,a,o)})}};m.styles=[Ee,ye`
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
      /* HAND-SWITCH-HOME-EDIT-2500: a widget's on / off switch keeps its 32 x 18 track beside the name */
      .check sw-toggle {
        flex: none;
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
    `];g([u({attribute:!1})],m.prototype,"draft",2);g([u({attribute:!1})],m.prototype,"candidates",2);g([u({attribute:!1})],m.prototype,"candidatesError",2);g([u({attribute:!1})],m.prototype,"baseData",2);g([u({attribute:!1})],m.prototype,"floors",2);g([u({attribute:!1})],m.prototype,"elevators",2);g([u({attribute:!1})],m.prototype,"temperatureUnits",2);g([u({type:Boolean})],m.prototype,"generators",2);g([u({type:Boolean})],m.prototype,"doors",2);g([u({type:Boolean})],m.prototype,"notices",2);g([u({type:Boolean})],m.prototype,"presence",2);g([u({type:Boolean})],m.prototype,"xsection",2);g([u()],m.prototype,"open",2);g([u({type:Boolean,reflect:!0})],m.prototype,"flat",2);g([u({type:Boolean})],m.prototype,"busy",2);g([xe()],m.prototype,"dragFloor",2);m=g([ke("home-edit-panel")],m);export{m as HomeEditPanel};
