import{E as I,a as W,S as U,qV as Z,i as O,K as G,f8 as K,g as C,qW as Q,aa as X,O as J,j as Y,n as L,b_ as ee,qX as S,qY as F,R as te,e as d,qZ as se,q_ as ie,q$ as ae,A as $,r0 as x,bZ as M,aB as re,b2 as g,w as N,r1 as oe,r2 as ne,q as A,r3 as D,r4 as E,r5 as P,fm as le,r6 as de,r7 as ce,C as pe,G as h,H as ve}from"./index-k1cto_iv.js";import{g as he,f as q}from"./storage-DGBPhf6t.js";import{d as me}from"./recordings-wnAvo9An.js";import{a as ue}from"./ha-sync-status-9DcgxODD.js";import"./sw-logo-art-Va6y_cIM.js";const we=I`
  :host {
    --lv-tile-compact-min-block: 60px;
    --lv-tile-compact-pad-block: 8px;
    --lv-tile-compact-pad-inline: 12px;
    --lv-tile-compact-gap: 10px;
    --lv-tile-compact-icon: 32px;
    --lv-tile-compact-value-fs: 17px;
    --lv-tile-compact-col-min: 168px;
    --lv-tile-compact-cols-phone: 2;
    --lv-tile-compact-grid-gap: 8px;
    --sw-kpi-compact-min-block: var(--lv-tile-compact-min-block);
    --sw-kpi-compact-pad-block: var(--lv-tile-compact-pad-block);
    --sw-kpi-compact-pad-inline: var(--lv-tile-compact-pad-inline);
    --sw-kpi-compact-gap: var(--lv-tile-compact-gap);
    --sw-kpi-compact-icon: var(--lv-tile-compact-icon);
    --sw-kpi-compact-value-fs: var(--lv-tile-compact-value-fs);
  }
`,fe=34;function ge(t,n,a=fe){if(n.every(e=>e<=t+.5))return n.length;const r=n.filter(e=>e<=t-a+.5).length;return Math.max(1,r)}var be=Object.defineProperty,$e=Object.getOwnPropertyDescriptor,v=(t,n,a,r)=>{for(var e=r>1?void 0:r?$e(n,a):n,o=t.length-1,l;o>=0;o--)(l=t[o])&&(e=(r?l(n,a,e):l(e))||e);return r&&e&&be(n,a,e),e};function B(t){return t<5?"לילה טוב":t<12?"בוקר טוב":t<17?"צהריים טובים":t<21?"ערב טוב":"לילה טוב"}const ye={person:"var(--sw-tl-person)",vehicle:"var(--sw-tl-vehicle)",motion:"var(--sw-tl-motion)",line:"var(--sw-tl-line)",offline:"var(--sw-tl-offline)",door:"var(--sw-tl-door)"},ke={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking"};let p=class extends W{constructor(){super(...arguments),this.bubbleSkin=new U(this),this.cams=null,this.recorder=null,this.sites=null,this.summary=null,this.summaryDenied=!1,this.recent=[],this.storage=null,this.health=null,this.raw=null,this.tz="Asia/Jerusalem",this.now=new Date,this.loaded=!1,this.spotFit=null,this.spotPage=0,this.spotMeasure=!0,this.spotObserver=null,this.spotCount=-1,this.loadFailed=!1,this.timer=0,this.clockTimer=0,this.tiles=new Z(this)}connectedCallback(){super.connectedCallback(),O()&&(this.load(),this.timer=window.setInterval(()=>void this.load(),6e4),this.clockTimer=window.setInterval(()=>this.now=new Date,3e4))}disconnectedCallback(){this.spotObserver?.disconnect(),this.spotObserver=null,window.clearInterval(this.timer),window.clearInterval(this.clockTimer),super.disconnectedCallback()}async load(){this.loadStorage();const[t,n,a,r,e,o,l]=await Promise.allSettled([G(),K(),C("sites?tree=true"),Q(),X({limit:6}),J(),C("health")]);t.status==="fulfilled"&&(this.tz=t.value["time.zone"]??this.tz),n.status==="fulfilled"?(this.cams=n.value.cameras.filter(c=>c.enabled&&c.recorder_enabled!==!1),this.recorder=n.value.recorder):this.cams===null&&(this.cams=[]),a.status==="fulfilled"?this.sites=a.value.sites:this.sites===null&&(this.sites=[]),r.status==="fulfilled"?this.summary=r.value:this.summaryDenied=r.reason instanceof Y&&r.reason.status===403,e.status==="fulfilled"&&(this.recent=e.value.events),o.status==="fulfilled"&&(this.health=o.value),l.status==="fulfilled"&&(this.raw=l.value),this.loadFailed=[n,a,o,l].every(c=>c.status==="rejected")&&this.cams?.length===0&&this.health===null,this.loaded=!0,this.now=new Date}async loadStorage(){try{this.storage=await he()}catch{this.storage=null}}fmtTime(t){return L(new Date(t),{timeZone:this.tz})}spots(){const t=[],n=this.cams??[];for(const e of n.filter(o=>o.status==="offline")){const o=e.last_seen_at?` · נראתה לאחרונה ${this.fmtTime(e.last_seen_at)}`:"";ee(e)?t.push({kind:"critical",title:`מצלמה מנותקת: ${e.name}`,meta:`מצלמה ללא מקליט${o}`,why:"מוצג כי המצלמה אינה עונה בכתובת הווידאו שלה",link:`#/live/cameras/${e.id}`}):t.push({kind:"critical",title:`מצלמה מנותקת: ${e.name}`,meta:`ערוץ ${e.channel}${o}`,why:"מוצג כי ה־NVR מדווח שהערוץ אינו מחובר",link:`#/live/cameras/${e.id}`})}for(const e of(this.health?.items??[]).filter(o=>o.status!=="ok"))t.push({kind:e.status==="error"?"critical":"alert",title:e.label,meta:`בדיקת מערכת · ${S[e.status]}`,why:"מוצג כי בדיקת הבריאות של ה־Add-on מדווחת על כך",link:"#/system/diagnostics"});const a=this.summary?.today.unacked??0;if(a>0){const e=Object.entries(this.summary?.today.by_type??{}).sort((o,l)=>l[1]-o[1]).slice(0,3).map(([o,l])=>`${F[o]??o} ${l}`).join(" · ");t.push({kind:"alert",title:`${a} אירועים שלא נבדקו היום`,meta:e,why:"מוצג כי אירועים ממתינים לסימון טיפול במרכז האירועים",link:"#/investigate/events"})}const r=this.raw?.events.ingest;return r?.connected&&!r.events_stored&&!r.last_event_at&&t.push({kind:"info",title:"ה־NVR לא שלח התראות מאז ההפעלה",meta:"אירועי תנועה נגזרים מההקלטות כל 10 דקות",why:'מוצג כי זרם ההתראות מחובר אך ריק — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה',link:"#/system/setup"}),this.raw?.home_assistant.configured&&!this.raw.home_assistant.connected&&t.push({kind:"alert",title:"אין חיבור לתשתית המערכת",meta:ue(this.raw.home_assistant.last_error),why:"מוצג כי מצבי הישויות והדלתות עלולים להיות מיושנים",link:"#/system/setup"}),t}renderApi(){const t=te.me?.user,n=t?.display_name||t?.username||"",a=Number(this.now.toLocaleString("en-GB",{hour:"numeric",hour12:!1,timeZone:this.tz})),r=this.cams??[],e=r.filter(s=>s.status==="online").length,o=this.sites??[],l=o.flatMap(s=>(s.buildings??[]).flatMap(m=>m.floors??[])),c=this.health,i=c?c.status==="ok"?"live":c.status==="warn"?"stale":"offline":"neutral",f=c?.items.find(s=>s.status!=="ok"),V=this.loaded?this.spots():[],u=this.storage,b=u?.totals??null,y=b?.used_pct??null,z=34,R=2*Math.PI*z,T=r.filter(s=>s.status==="online").slice(0,2),k=this.tiles.layout;return this.loaded&&this.loadFailed?d`<sw-page heading=${`${B(a)}${n?`, ${n}`:""}`}><sw-state-panel state="error" actionLabel="נסו שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`:d`
      <sw-page heading=${`${B(a)}${n?`, ${n}`:""}`} subheading=${c?`מצב המערכת: ${S[c.status]}${f?` · ${f.label}`:" · כל הבדיקות תקינות"}`:"קורא את מצב המערכת…"}>
        <div slot="actions" class="date">${this.now.toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:this.tz})}<br />${L(this.now,{timeZone:this.tz})}</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi data-overview-tile="cameras" icon="camera" tone=${r.length&&e===r.length?"live":e?"stale":"offline"} value=${`${e}/${r.length}`} label="מצלמות" detail=${x()?this.recorder?`מחוברות · ${this.recorder.model??this.recorder.name}`:"מחוברות":se} layout=${k} href=${x()?M("nvr")?"#/system/devices?sort=offline":"#/live/wall":ie} hint=${x()?"פתח את רשימת המצלמות":ae} ?data-webrtc-required=${!x()}></sw-kpi>
          <sw-kpi data-overview-tile="sites" icon="building" value=${String(o.length)} label="אתרים" detail=${`${l.length} קומות · ${l.filter(s=>s.has_plan).length} עם תוכנית`} tone="neutral" layout=${k} href="#/explore/sites" hint="פתח את האתרים"></sw-kpi>
          <sw-kpi data-overview-tile="events" icon="bell" value=${this.summaryDenied?"—":String(this.summary?.today.total??0)} label="אירועים" detail=${this.summaryDenied?"ללא הרשאה לאירועים":"היום"} tone="neutral" badge=${this.summary?.today.unacked?`${this.summary.today.unacked} לבדיקה`:""} layout=${k} href=${`#/investigate/events?date=${me(this.now,this.tz)}`} hint="פתח את אירועי היום"></sw-kpi>
          <sw-kpi data-overview-tile="health" icon="shield" tone=${i} value=${c?S[c.status]:"…"} label="מצב מערכת" detail=${f?f.label:"NVR, go2rtc, תשתית המערכת ואחסון"} layout=${k} href="#/system/diagnostics?tab=health" hint="פתח את פרטי הבריאות"></sw-kpi>
        </div>
        ${T.length?d`<div class="fav" data-overview-favorites>
              ${T.map(s=>d`<sw-camera-tile name=${s.name} state="live" cameraId=${s.id} poster=${re(s.id)} .stillRefresh=${s.live_kind==="still"?s.still_refresh_s??10:0} noDemo @click=${()=>g(`/live/cameras/${s.id}`)}></sw-camera-tile>`)}
            </div>`:$}
        <div class="row2">
          ${u&&b&&M("nvr")?d`<sw-card heading="אחסון" subheading=${u.cached?"מהמטמון · נמדד מול ה־NVR":"נמדד מול ה־NVR"}>
                <div class="donut">
                  <svg viewBox="0 0 84 84" role="img" aria-label=${`אחסון בשימוש ${y??0}%`}>
                    ${N`<circle cx="42" cy="42" r=${z} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                    <circle cx="42" cy="42" r=${z} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${R*(y??0)/100} ${R}`} transform="rotate(-90 42 42)" />
                    <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">${y??0}%</text>`}
                  </svg>
                  <div class="txt">
                    <div class="big">${q(b.used_mb)} מתוך ${q(b.capacity_mb)}</div>
                    <div class="bar"><i style=${`inline-size:${y??0}%`}></i></div>
                    <div class="muted">${u.retention.measured_days_min!==null?`הקלטה ישנה ביותר ≈ ${u.retention.measured_days_min}${u.retention.measured_days_max!==null&&u.retention.measured_days_max!==u.retention.measured_days_min?`–${u.retention.measured_days_max}`:""} ימים (נמדד)`:u.retention.measured_reason}${u.work_mode?` · ${u.work_mode}`:""} · ${b.disks} דיסקים</div>
                  </div>
                </div>
              </sw-card>`:$}
          <sw-card heading="אתרים ומבנים" subheading=${o.length?`${o.length} אתרים · ${l.length} קומות`:"עדיין לא הוגדרו אתרים"}>
            <div class="hgrid">${o.map(s=>{const m=(s.buildings??[]).flatMap(w=>w.floors??[]),_=m.filter(w=>w.has_plan).length,j=m.reduce((w,H)=>w+H.camera_count,0);return d`<div class="hrow link" role="link" tabindex="0" @click=${()=>g("/explore/sites")} @keydown=${w=>{(w.key==="Enter"||w.key===" ")&&(w.preventDefault(),g("/explore/sites"))}}><span>${s.name}<div class="muted">${(s.buildings??[]).length} מבנים · ${m.length} קומות · ${j} מצלמות מוצבות · ${_}/${m.length} תוכניות</div></span><span class="status"><i style=${`--c:${m.length&&_===m.length?"var(--sw-live)":"var(--sw-stale)"}`}></i>${m.length&&_===m.length?"תוכניות מפורסמות":"חסרות תוכניות"}</span></div>`})}
            ${this.recorder?d`<div class="hrow"><span>NVR · ${this.recorder.name}<div class="muted">${this.recorder.model??""} · ${e}/${r.length} מצלמות מחוברות</div></span><span class="status"><i style=${`--c:${e===r.length?"var(--sw-live)":"var(--sw-offline)"}`}></i>${e===r.length?"מחובר":`${r.length-e} מנותקות`}</span></div>`:$}</div>
          </sw-card>
        </div>
        <div class="row3">
          <sw-card fill heading="אירועים אחרונים" subheading=${this.summary?`${this.summary.today.total} היום · ${this.summary.today.measured} נמדדו · ${this.summary.today.inferred} נגזרו מהקלטה`:""}>
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${this.recent.length?this.recent.map(s=>d`<div class="ev" data-overview-event role="link" tabindex="0" @click=${()=>g(`/investigate/events/${s.id}`)} @keydown=${m=>{(m.key==="Enter"||m.key===" ")&&(m.preventDefault(),g(`/investigate/events/${s.id}`))}}>
                    ${s.thumbnail==="ready"?d`<img class="thumb" src=${ne(s.id)} alt="" loading="lazy" />`:d`<div class="none"><sw-icon name=${s.type==="offline"||s.type==="coverage_gap"?"offline":s.type==="door"||s.type==="io"?"door":s.type==="person"?"user":s.type==="vehicle"?"route":"bell"} size=${14}></sw-icon></div>`}
                    <div class="txt"><b style=${`--tone:${oe[s.type]??"var(--sw-tl-offline)"}`}><i></i>${F[s.type]??s.type}${s.acked_at?"":" · לבדיקה"}</b><small>${s.camera_name??s.details?.name??"ללא מצלמה"} · ${s.confidence==="inferred"?"נגזר מהקלטה":s.source==="ha"?"חיישן התקן":"התראה"}</small></div>
                    <time>${this.fmtTime(s.occurred_at)}</time>
                  </div>`):d`<div class="muted">${this.loaded?"אין אירועים ב־24 השעות האחרונות":"טוען…"}</div>`}
          </sw-card>
          ${this.renderAttention(V,d`<div class="muted" data-overview-calm>${this.loaded?"הכול תקין — אין פריטים שדורשים תשומת לב כרגע.":"בודק…"}</div>`)}
        </div>
      </sw-page>
    `}renderAttention(t,n){t.length!==this.spotCount&&(this.spotCount=t.length,this.spotMeasure=!0);const a=this.spotFit!==null&&this.spotFit<t.length?this.spotFit:null,r=a?Math.ceil(t.length/a):1,e=Math.min(this.spotPage,r-1),o=a?t.slice(e*a,e*a+a):t;return d`<sw-card fill clip data-overview-attention heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
      ${t.length?o.map(l=>d`<div class="spot ${l.kind}" data-overview-spot>
              <div class="ic"><sw-icon name=${l.kind==="critical"?"offline":l.kind==="info"?"info":"warning"} size=${15}></sw-icon></div>
              <div class="sbody"><div class="t" title=${l.title}>${l.title}</div><div class="muted" title=${l.meta}>${l.meta}</div><div class="why" title=${l.why}>${l.why}</div></div>
              <div class="actions"><a href=${l.link}><sw-button size="sm">פתח</sw-button></a></div>
            </div>`):n}
      ${a?d`<div class="spotpager" data-overview-spot-pager>
            <button type="button" data-spot-prev aria-label="הפריטים הקודמים" ?disabled=${e===0} @click=${()=>this.spotPage=e-1}><sw-icon name="chevron" size=${14}></sw-icon></button>
            <span data-overview-spot-range>${a===1?String(e+1):A(`${e*a+1}–${Math.min(t.length,e*a+a)}`)} מתוך ${t.length}</span>
            <button type="button" data-spot-next aria-label="הפריטים הבאים" ?disabled=${e>=r-1} @click=${()=>this.spotPage=e+1}><sw-icon name="chevronBack" size=${14}></sw-icon></button>
          </div>`:$}
    </sw-card>`}updated(){if(!this.renderRoot.querySelector("sw-card[data-overview-attention]"))return;const n=this.renderRoot.querySelector("sw-page");if(!this.spotObserver&&n&&typeof ResizeObserver<"u"&&(this.spotObserver=new ResizeObserver(()=>{this.spotMeasure=!0,this.requestUpdate()}),this.spotObserver.observe(n)),!!this.spotMeasure){if(this.spotFit!==null){this.spotFit=null;return}requestAnimationFrame(()=>this.measureSpots())}}measureSpots(){if(!this.spotMeasure||this.spotFit!==null)return;this.spotMeasure=!1;const t=this.renderRoot.querySelector("sw-card[data-overview-attention]"),n=typeof matchMedia=="function"&&matchMedia("(min-width: 1024px)").matches,a=t?.shadowRoot?.querySelector(".body"),r=t?[...t.querySelectorAll("[data-overview-spot]")]:[];if(!n||!a||!r.length)return;const e=parseFloat(getComputedStyle(a).paddingBottom||"0")||0,o=ge(a.getBoundingClientRect().top+a.clientHeight-e,r.map(l=>l.getBoundingClientRect().bottom));o<r.length&&(this.spotFit=o)}render(){if(O())return this.renderApi();const t=D.filter(i=>i.state==="live"||i.state==="stale").length,n=E.filter(i=>!i.acked),a=[{kind:"critical",title:"מצלמה מנותקת: מסדרון מזרחי",meta:"קומה 0 · מאז 07:55",why:"מוצג כי אין הקלטה ממצלמה זו כבר שעתיים",link:"#/system/devices"},{kind:"alert",title:`${n.length} אירועים שלא נבדקו`,meta:"אדם בכניסה הראשית 10:14, רכב בחצר 09:42",why:"מוצג כי אירועי אדם/רכב מחכים לסימון טיפול",link:"#/investigate/events"},{kind:"alert",title:"החיבור לתשתית המערכת לא רענן",meta:"סנכרון אחרון לפני 4 דק׳",why:"מוצג כי מצבי הישויות עלולים להיות מיושנים",link:"#/system/diagnostics"}],r=.68,e=34,o=2*Math.PI*e,l=D.filter(i=>i.state==="live").slice(0,2),c=this.tiles.layout;return d`
      <sw-page heading="בוקר טוב, יוני" subheading="המערכת פועלת · גשר לא רענן · נתוני הדגמה">
        <div slot="actions" class="date">יום שני, 14 בספטמבר 2026<br />10:24</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi data-overview-tile="cameras" icon="camera" tone="live" value=${String(t)} label="מצלמות" detail="מחוברות" layout=${c} href="#/system/devices?sort=offline" hint="פתח את רשימת המצלמות"></sw-kpi>
          <sw-kpi data-overview-tile="sites" icon="building" value=${String(P.length)} label="אתרים" detail="פעילים" tone="neutral" layout=${c} href="#/explore/sites" hint="פתח את האתרים"></sw-kpi>
          <sw-kpi data-overview-tile="events" icon="bell" value=${String(E.length)} label="אירועים" detail="ב־24 השעות" tone="neutral" badge=${`${n.length} חדשים`} layout=${c} href="#/investigate/events" hint="פתח את האירועים"></sw-kpi>
          <sw-kpi data-overview-tile="health" icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר לא רענן" layout=${c} href="#/system/diagnostics?tab=health" hint="פתח את פרטי הבריאות"></sw-kpi>
        </div>
        <div class="fav">
          ${l.map(i=>d`<sw-camera-tile name=${i.name} state=${i.state} scene=${le[i.id]??"lobby"} @click=${()=>g(`/live/cameras/${i.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="row2">
          <sw-card heading="אחסון">
            <div class="donut">
              <svg viewBox="0 0 84 84" role="img" aria-label="אחסון בשימוש 68%">
                ${N`<circle cx="42" cy="42" r=${e} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                <circle cx="42" cy="42" r=${e} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${o*r} ${o}`} transform="rotate(-90 42 42)" />
                <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">68%</text>`}
              </svg>
              <div class="txt">
                <div class="big">${A("1.3 TB מתוך 1.9 TB")}</div>
                <div class="bar"><i></i></div>
                <div class="muted">הקלטה ישנה ביותר ≈ 11 ימים (נמדד) · overwrite פעיל</div>
              </div>
            </div>
          </sw-card>
          <sw-card heading="בריאות האתרים">
            <div class="hgrid">${P.map(i=>d`<div class="hrow"><span>${i.name}<div class="muted">${i.online}/${i.cameras} מצלמות · ${i.alerts} התראות</div></span><span class="status"><i style="--c:${i.health==="live"?"var(--sw-live)":i.health==="offline"?"var(--sw-danger)":"var(--sw-stale)"}"></i>${i.health==="live"?"מחובר":i.health==="offline"?"מנותק":"חלקי"}</span></div>`)}
            ${de.slice(0,2).map(i=>d`<div class="hrow"><span>${i.name}<div class="muted">${i.detail}</div></span><span class="status"><i style="--c:${i.state==="live"?"var(--sw-live)":"var(--sw-stale)"}"></i>${i.state==="live"?"מחובר":"לא רענן"}</span></div>`)}</div>
          </sw-card>
        </div>
        <div class="row3">
          <sw-card fill heading="אירועים אחרונים">
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${E.slice(0,5).map(i=>d`<div class="ev" role="link" tabindex="0" @click=${()=>g("/investigate/events")} @keydown=${f=>{(f.key==="Enter"||f.key===" ")&&(f.preventDefault(),g("/investigate/events"))}}>
                ${i.type==="offline"||i.type==="door"?d`<div class="none"><sw-icon name=${i.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:d`<sw-scene kind=${ke[i.camera]??"lobby"}></sw-scene>`}
                <div class="txt"><b style="--tone:${ye[i.type]}"><i></i>${ce[i.type]}</b><small>${i.camera} · ${i.floor}</small></div>
                <time>${i.time}</time>
              </div>`)}
          </sw-card>
          ${this.renderAttention(a,$)}
        </div>
      </sw-page>
    `}};p.styles=[pe,we,I`
    .date {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      text-align: end;
      line-height: 1.3;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .row2 {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      gap: 12px;
      align-items: stretch;
    }
    .row3 {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .donut {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .donut svg {
      inline-size: 84px;
      block-size: 84px;
      flex-shrink: 0;
    }
    .donut .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .donut .big {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .bar {
      block-size: 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      overflow: hidden;
      margin-block: 6px 4px;
    }
    .bar i {
      display: block;
      block-size: 100%;
      inline-size: 68%;
      background: var(--sw-accent);
    }
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .hrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .hrow:last-child {
      border-block-end: 0;
    }
    .hrow.link {
      cursor: pointer;
      border-radius: var(--sw-r-xs);
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    /* POLISH4-WP2: the wash follows a hovering fine pointer only (it stuck on a tapped row on touch) */
    @media (hover: hover) and (pointer: fine) {
      .hrow.link:hover,
      .ev:hover {
        background: var(--sw-hover-wash);
      }
    }
    .hrow.link:focus-visible,
    .ev:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
      border-radius: var(--sw-r-xs);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c);
    }
    .ev {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 4px;
      margin-inline: -4px;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      border-radius: var(--sw-r-xs);
      transition: background var(--sw-t-fast) var(--sw-ease);
    }
    .ev:last-child {
      border-block-end: 0;
    }
    .ev sw-scene,
    .ev img.thumb,
    .ev .none {
      inline-size: 56px;
      block-size: 36px;
      border-radius: var(--sw-r-xs);
      flex-shrink: 0;
      overflow: hidden;
    }
    .ev img.thumb {
      object-fit: cover;
      display: block;
      background: var(--sw-surface-3);
    }
    .spot.info .ic {
      color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .ev .none {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .ev .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .ev .txt b {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
    }
    .ev .txt b i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--tone);
      flex-shrink: 0;
    }
    .ev .txt small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      display: block;
    }
    .ev time {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .spot {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      align-items: flex-start;
      font-size: var(--sw-fs-sm);
    }
    .spot:last-child {
      border-block-end: 0;
    }
    .spot .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
      flex-shrink: 0;
    }
    .spot.critical .ic {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .spot.critical .t {
      color: var(--sw-danger-text);
    }
    .spot .t {
      font-weight: var(--sw-fw-semibold);
    }
    .spot .actions a {
      text-decoration: none;
    }
    .spot .why {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .spot .actions {
      margin-inline-start: auto;
      align-self: center;
    }
    .spot .sbody {
      min-inline-size: 0;
      flex: 1 1 auto;
    }
    /* WARMUP-POLISH-2421: the attention pager (a desktop card pages its items instead of scrolling) */
    .spotpager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      block-size: 30px;
      margin-block-start: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .spotpager button {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
      padding: 0;
    }
    .spotpager button:disabled {
      opacity: 0.4;
      cursor: default;
    }
    @media (min-width: 1024px) {
      /* one line each for the meta and the reason on a desktop (the full text is the tooltip): more items fit before the pager */
      .spot .sbody > .muted,
      .spot .sbody > .why {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    .seeall {
      color: var(--sw-accent-text);
      text-decoration: none;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .fav {
      display: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    @media (max-width: 1023px) {
      .row2,
      .row3 {
        grid-template-columns: 1fr;
      }
    }
    /* NOSCROLL-297 (owner rule: a control screen fits the viewport on a desktop): the page takes the screen's height and the last
       row - the recent events and the attention list, the two naturally long lists - takes what is left; each list scrolls inside
       its own card (sw-card fill). Below 200 px of room the row keeps that height and the page scrolls as before (a very short window). */
    @media (min-width: 1024px) {
      sw-page {
        block-size: 100%;
      }
      .row3 {
        flex: 0 1 auto;
        min-block-size: 200px;
        grid-template-rows: minmax(0, 1fr);
      }
      .row3 > sw-card {
        max-block-size: 100%;
      }
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .fav {
        display: grid;
      }
      .date {
        display: none;
      }
    }
    /* owner 2026-09-29: compact tiles (ui.tile_layout) - rectangles, icon beside the value; the sizes are the
       --lv-tile-* knobs (styles/tile-knobs.ts). Four across on a desktop, the knob's column count on a phone. */
    :host([data-tile-layout='compact']) .kpis {
      grid-template-columns: repeat(auto-fit, minmax(var(--lv-tile-compact-col-min), 1fr));
      grid-auto-rows: 1fr;
      gap: var(--lv-tile-compact-grid-gap);
      padding-block-start: 6px; /* room for a badge riding the tile's top corner */
    }
    @media (min-width: 1024px) {
      :host([data-tile-layout='compact']) .kpis {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
    @media (max-width: 599px) {
      :host([data-tile-layout='compact']) .kpis {
        grid-template-columns: repeat(var(--lv-tile-compact-cols-phone), minmax(0, 1fr));
      }
    }
    /* R5-LIVE-297 (the HOMEFABLE method on the live overview, structure unchanged): three surface tiers - the four counters are the
       hero (a 32 px / 800 display numeral through the sw-kpi value hook), the cards the second tier, every row inside a card a WELL
       (surface-2, rounded, no hairline); a state is a filled field (the tone's tint behind a dot and a bold word), not a dot on white;
       the critical attention item is a filled danger field; rows sink on pointer-down and tint on hover only under a fine pointer */
    .kpis {
      --sw-kpi-value-fs: var(--sw-fs-4xl);
      --sw-kpi-value-fw: 800;
    }
    .donut svg {
      inline-size: 96px;
      block-size: 96px;
    }
    .donut .big {
      font-size: var(--sw-fs-2xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--sw-heading);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      block-size: 10px;
      border-radius: var(--sw-r-pill);
      margin-block: 8px 6px;
    }
    .bar i {
      border-radius: var(--sw-r-pill);
    }
    .hrow,
    .ev,
    .spot {
      border-block-end: 0;
      margin-inline: 0;
      margin-block-end: 5px;
      padding: 7px 12px; /* loop 1: 9 px left two events in view at 1440 x 900 */
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .hrow:last-child,
    .ev:last-child,
    .spot:last-child {
      margin-block-end: 0;
    }
    /* NOSCROLL-1366-2437: the health rows sit in a grid; on a short desktop (1366x768 class) they take two columns, so the row of
       health / storage gives the last row (events, attention) the room it needs and the page does not scroll. From 1280 px only:
       at 1024x768 the half-width cells and the lower floor squeezed the attention card below one item (entry check 2026-11-12) */
    .hgrid {
      display: grid;
      gap: 5px;
    }
    .hgrid > .hrow {
      margin-block-end: 0;
    }
    @media (min-width: 1280px) and (max-height: 860px) {
      .hgrid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .row3 {
        min-block-size: 160px;
      }
    }
    .hrow > span:first-child,
    .spot .t,
    .ev .txt b {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .ev time {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .ev sw-scene,
    .ev img.thumb,
    .ev .none {
      inline-size: 64px;
      block-size: 40px;
      border-radius: var(--sw-r-sm);
    }
    .status {
      position: relative;
      isolation: isolate;
      flex: none;
      min-block-size: 26px;
      padding: 0 11px;
      gap: 7px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .status i::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--c) 20%, var(--sw-surface));
    }
    .spot {
      align-items: center;
    }
    .spot .ic {
      inline-size: 36px;
      block-size: 36px;
      border-radius: 50%;
    }
    .spot.critical {
      background: var(--sw-danger-soft);
    }
    .spot.critical .ic {
      background: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .spot .why {
      color: var(--sw-text-2);
    }
    .seeall {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .hrow.link,
    .ev {
      transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    @media (hover: hover) and (pointer: fine) {
      .hrow.link:hover,
      .ev:hover {
        background: var(--sw-surface-3);
      }
    }
    .hrow.link:active,
    .ev:active {
      transform: scale(var(--sw-press-scale, 0.98));
      background: var(--sw-pressed-wash);
    }
    @media (prefers-reduced-motion: reduce) {
      .hrow.link:active,
      .ev:active {
        transform: none;
      }
    }
  `];v([h()],p.prototype,"cams",2);v([h()],p.prototype,"recorder",2);v([h()],p.prototype,"sites",2);v([h()],p.prototype,"summary",2);v([h()],p.prototype,"summaryDenied",2);v([h()],p.prototype,"recent",2);v([h()],p.prototype,"storage",2);v([h()],p.prototype,"health",2);v([h()],p.prototype,"raw",2);v([h()],p.prototype,"tz",2);v([h()],p.prototype,"now",2);v([h()],p.prototype,"loaded",2);v([h()],p.prototype,"spotFit",2);v([h()],p.prototype,"spotPage",2);v([h()],p.prototype,"loadFailed",2);p=v([ve("live-overview")],p);export{p as LiveOverview};
//# sourceMappingURL=live-overview-DXEonf6Q.js.map
