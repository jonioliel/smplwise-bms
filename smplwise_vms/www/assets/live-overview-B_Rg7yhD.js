import{j as H,a as G,aX as V,eK as Z,lA as J,af as R,p as K,eG as Q,bg as L,h as X,c as Y,e as F,lB as ee,eL as E,s as te,b as c,lC as se,lD as ie,lE as ae,A as y,u as re,kl as z,bp as M,eH as ne,a8 as b,ai as A,aj as D,eI as P,eU as T,lF as B,eJ as oe,lG as le,lH as de,k as m,m as ce}from"./index-bjkrEUAJ.js";import{e as pe,l as ve,E as I,f as he,t as me}from"./events-BIZ5s4Ra.js";import{a as ue,f as N}from"./storage-_RzpYzN0.js";import{d as we}from"./recordings-Cm7wJqzc.js";import{b as fe}from"./bubble-chrome-wRf-BHoZ.js";import{a as ge}from"./ha-sync-status-CavxdTMn.js";import{t as e}from"./live-Bmq3HC8D.js";import"./sw-logo-art-PLtEZJxU.js";const be=H`
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
`,$e=34;function ye(s,l,r=$e){if(l.every(t=>t<=s+.5))return l.length;const n=l.filter(t=>t<=s-r+.5).length;return Math.max(1,n)}var ke=Object.defineProperty,xe=Object.getOwnPropertyDescriptor,h=(s,l,r,n)=>{for(var t=n>1?void 0:n?xe(l,r):l,o=s.length-1,d;o>=0;o--)(d=s[o])&&(t=(n?d(l,r,t):d(t))||t);return n&&t&&ke(l,r,t),t};function j(s){return s<5?e("לילה טוב"):s<12?e("בוקר טוב"):s<17?e("צהריים טובים"):s<21?e("ערב טוב"):e("לילה טוב")}const ze={person:"var(--sw-tl-person)",vehicle:"var(--sw-tl-vehicle)",motion:"var(--sw-tl-motion)",line:"var(--sw-tl-line)",offline:"var(--sw-tl-offline)",door:"var(--sw-tl-door)"},_e={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking"};let v=class extends G{constructor(){super(...arguments),this.bubbleSkin=new V(this),this.cams=null,this.recorder=null,this.sites=null,this.summary=null,this.summaryDenied=!1,this.recent=[],this.storage=null,this.health=null,this.raw=null,this.tz="Asia/Jerusalem",this.now=new Date,this.loaded=!1,this.spotFit=null,this.spotPage=0,this.spotMeasure=!0,this.spotObserver=null,this.spotCount=-1,this.loadFailed=!1,this.poller=new Z(this),this.clockTimer=0,this.tiles=new J(this)}connectedCallback(){super.connectedCallback(),R()&&(this.load(),this.poller.every("overview",6e4,()=>this.load()),this.clockTimer=window.setInterval(()=>this.now=new Date,3e4))}disconnectedCallback(){this.spotObserver?.disconnect(),this.spotObserver=null,window.clearInterval(this.clockTimer),super.disconnectedCallback()}async load(){this.loadStorage();const[s,l,r,n,t,o,d]=await Promise.allSettled([K(),Q(),L("sites?tree=true"),pe(),ve({limit:6}),X(),L("health")]);s.status==="fulfilled"&&(this.tz=s.value["time.zone"]??this.tz),l.status==="fulfilled"?(this.cams=l.value.cameras.filter(p=>p.enabled&&p.recorder_enabled!==!1),this.recorder=l.value.recorder):this.cams===null&&(this.cams=[]),r.status==="fulfilled"?this.sites=r.value.sites:this.sites===null&&(this.sites=[]),n.status==="fulfilled"?this.summary=n.value:this.summaryDenied=n.reason instanceof Y&&n.reason.status===403,t.status==="fulfilled"&&(this.recent=t.value.events),o.status==="fulfilled"&&(this.health=o.value),d.status==="fulfilled"&&(this.raw=d.value),this.loadFailed=[l,r,o,d].every(p=>p.status==="rejected")&&this.cams?.length===0&&this.health===null,this.loaded=!0,this.now=new Date}async loadStorage(){try{this.storage=await ue()}catch{this.storage=null}}fmtTime(s){return F(new Date(s),{timeZone:this.tz})}spots(){const s=[],l=this.cams??[];for(const t of l.filter(o=>o.status==="offline")){const o=t.last_seen_at?` · ${e("נראתה לאחרונה {time}",{time:this.fmtTime(t.last_seen_at)})}`:"";ee(t)?s.push({kind:"critical",title:e("מצלמה מנותקת: {name}",{name:t.name}),meta:`${e("מצלמה ללא מקליט")}${o}`,why:e("מוצג כי המצלמה אינה עונה בכתובת הווידאו שלה"),link:`#/live/cameras/${t.id}`}):s.push({kind:"critical",title:e("מצלמה מנותקת: {name}",{name:t.name}),meta:`${e("ערוץ {n}",{n:t.channel})}${o}`,why:e("מוצג כי המקליט מדווח שהערוץ אינו מחובר"),link:`#/live/cameras/${t.id}`})}for(const t of(this.health?.items??[]).filter(o=>o.status!=="ok"))s.push({kind:t.status==="error"?"critical":"alert",title:t.label,meta:`${e("בדיקת מערכת")} · ${E[t.status]}`,why:e("מוצג כי בדיקת הבריאות של ה־Add-on מדווחת על כך"),link:"#/system/diagnostics"});const r=this.summary?.today.unacked??0;if(r>0){const t=Object.entries(this.summary?.today.by_type??{}).sort((o,d)=>d[1]-o[1]).slice(0,3).map(([o,d])=>`${I[o]??o} ${d}`).join(" · ");s.push({kind:"alert",title:e("{n} אירועים שלא נבדקו היום",{n:r}),meta:t,why:e("מוצג כי אירועים ממתינים לסימון טיפול במרכז האירועים"),link:"#/investigate/events"})}const n=this.raw?.events.ingest;return n?.connected&&!n.events_stored&&!n.last_event_at&&s.push({kind:"info",title:e("המקליט לא שלח התראות מאז ההפעלה"),meta:e("אירועי תנועה נגזרים מההקלטות כל 10 דקות"),why:e('מוצג כי זרם ההתראות מחובר אך ריק — במקליט יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה'),link:"#/system/setup"}),this.raw?.home_assistant.configured&&!this.raw.home_assistant.connected&&s.push({kind:"alert",title:e("אין חיבור לתשתית המערכת"),meta:ge(this.raw.home_assistant.last_error),why:e("מוצג כי מצבי הישויות והדלתות עלולים להיות מיושנים"),link:"#/system/setup"}),s}renderApi(){const s=te.me?.user,l=s?.display_name||s?.username||"",r=Number(this.now.toLocaleString("en-GB",{hour:"numeric",hour12:!1,timeZone:this.tz})),n=this.cams??[],t=n.filter(i=>i.status==="online").length,o=this.sites??[],d=o.flatMap(i=>(i.buildings??[]).flatMap(u=>u.floors??[])),p=this.health,a=p?p.status==="ok"?"live":p.status==="warn"?"stale":"offline":"neutral",g=p?.items.find(i=>i.status!=="ok"),q=this.loaded?this.spots():[],w=this.storage,$=w?.totals??null,k=$?.used_pct??null,_=34,C=2*Math.PI*_,O=n.filter(i=>i.status==="online").slice(0,2),x=this.tiles.layout;return this.loaded&&this.loadFailed?c`<sw-page heading=${`${j(r)}${l?`, ${l}`:""}`}><sw-state-panel state="error" actionLabel=${e("נסו שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`:c`
      <sw-page heading=${`${j(r)}${l?`, ${l}`:""}`} subheading=${p?`${e("מצב המערכת: {status}",{status:E[p.status]})}${g?` · ${g.label}`:` · ${e("כל הבדיקות תקינות")}`}`:e("קורא את מצב המערכת…")}>
        <div slot="actions" class="date">${this.now.toLocaleDateString(re(),{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:this.tz})}<br />${F(this.now,{timeZone:this.tz})}</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi data-overview-tile="cameras" icon="camera" tone=${n.length&&t===n.length?"live":t?"stale":"offline"} value=${`${t}/${n.length}`} label=${e("מצלמות")} detail=${z()?this.recorder?`${e("מחוברות")} · ${this.recorder.model??this.recorder.name}`:e("מחוברות"):se} layout=${x} href=${z()?M("nvr")?"#/system/devices?sort=offline":"#/live/wall":ie} hint=${z()?e("פתח את רשימת המצלמות"):ae} ?data-webrtc-required=${!z()}></sw-kpi>
          <sw-kpi data-overview-tile="sites" icon="building" value=${String(o.length)} label=${e("אתרים")} detail=${`${e("{n} קומות",{n:d.length})} · ${e("{n} עם תוכנית",{n:d.filter(i=>i.has_plan).length})}`} tone="neutral" layout=${x} href="#/explore/sites" hint=${e("פתח את האתרים")}></sw-kpi>
          <sw-kpi data-overview-tile="events" icon="bell" value=${this.summaryDenied?"—":String(this.summary?.today.total??0)} label=${e("אירועים")} detail=${this.summaryDenied?e("ללא הרשאה לאירועים"):e("היום")} tone="neutral" badge=${this.summary?.today.unacked?e("{n} לבדיקה",{n:this.summary.today.unacked}):""} layout=${x} href=${`#/investigate/events?date=${we(this.now,this.tz)}`} hint=${e("פתח את אירועי היום")}></sw-kpi>
          <sw-kpi data-overview-tile="health" icon="shield" tone=${a} value=${p?E[p.status]:"…"} label=${e("מצב מערכת")} detail=${g?g.label:e("מקליט, go2rtc, תשתית המערכת ואחסון")} layout=${x} href="#/system/diagnostics?tab=health" hint=${e("פתח את פרטי הבריאות")}></sw-kpi>
        </div>
        ${O.length?c`<div class="fav" data-overview-favorites>
              ${O.map(i=>c`<sw-camera-tile name=${i.name} state="live" cameraId=${i.id} poster=${ne(i.id)} .stillRefresh=${i.live_kind==="still"?i.still_refresh_s??10:0} noDemo @click=${()=>b(`/live/cameras/${i.id}`)}></sw-camera-tile>`)}
            </div>`:y}
        <div class="row2">
          ${w&&$&&M("nvr")?c`<sw-card heading=${e("אחסון")} subheading=${w.cached?e("מהמטמון · נמדד מול המקליט"):e("נמדד מול המקליט")}>
                <div class="donut">
                  <svg viewBox="0 0 84 84" role="img" aria-label=${e("אחסון בשימוש {pct}%",{pct:k??0})}>
                    ${A`<circle cx="42" cy="42" r=${_} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                    <circle cx="42" cy="42" r=${_} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${C*(k??0)/100} ${C}`} transform="rotate(-90 42 42)" />
                    <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">${k??0}%</text>`}
                  </svg>
                  <div class="txt">
                    <div class="big">${e("{used} מתוך {total}",{used:N($.used_mb),total:N($.capacity_mb)})}</div>
                    <div class="bar"><i style=${`inline-size:${k??0}%`}></i></div>
                    <div class="muted">${w.retention.measured_days_min!==null?e("הקלטה ישנה ביותר ≈ {days} ימים (נמדד)",{days:`${w.retention.measured_days_min}${w.retention.measured_days_max!==null&&w.retention.measured_days_max!==w.retention.measured_days_min?`–${w.retention.measured_days_max}`:""}`}):w.retention.measured_reason}${w.work_mode?` · ${w.work_mode}`:""} · ${e("{n} דיסקים",{n:$.disks})}</div>
                  </div>
                </div>
              </sw-card>`:y}
          <sw-card heading=${e("אתרים ומבנים")} subheading=${o.length?`${e("{n} אתרים",{n:o.length})} · ${e("{n} קומות",{n:d.length})}`:e("עדיין לא הוגדרו אתרים")}>
            <div class="hgrid">${o.map(i=>{const u=(i.buildings??[]).flatMap(f=>f.floors??[]),S=u.filter(f=>f.has_plan).length,U=u.reduce((f,W)=>f+W.camera_count,0);return c`<div class="hrow link" role="link" tabindex="0" @click=${()=>b("/explore/sites")} @keydown=${f=>{(f.key==="Enter"||f.key===" ")&&(f.preventDefault(),b("/explore/sites"))}}><span>${i.name}<div class="muted">${e("{n} מבנים",{n:(i.buildings??[]).length})} · ${e("{n} קומות",{n:u.length})} · ${e("{n} מצלמות מוצבות",{n:U})} · ${e("{n}/{total} תוכניות",{n:S,total:u.length})}</div></span><span class="status"><i style=${`--c:${u.length&&S===u.length?"var(--sw-live)":"var(--sw-stale)"}`}></i>${u.length&&S===u.length?e("תוכניות מפורסמות"):e("חסרות תוכניות")}</span></div>`})}
            ${this.recorder?c`<div class="hrow"><span>${e("מקליט")} · ${this.recorder.name}<div class="muted">${this.recorder.model??""} · ${e("{n}/{total} מצלמות מחוברות",{n:t,total:n.length})}</div></span><span class="status"><i style=${`--c:${t===n.length?"var(--sw-live)":"var(--sw-offline)"}`}></i>${t===n.length?e("מחובר"):e("{n} מנותקות",{n:n.length-t})}</span></div>`:y}</div>
          </sw-card>
        </div>
        <div class="row3">
          <sw-card fill heading=${e("אירועים אחרונים")} subheading=${this.summary?`${e("{n} היום",{n:this.summary.today.total})} · ${e("{n} נמדדו",{n:this.summary.today.measured})} · ${e("{n} נגזרו מהקלטה",{n:this.summary.today.inferred})}`:""}>
            <a slot="actions" class="seeall" href="#/investigate/events">${e("הצג הכל")}</a>
            ${this.recent.length?this.recent.map(i=>c`<div class="ev" data-overview-event role="link" tabindex="0" @click=${()=>b(`/investigate/events/${i.id}`)} @keydown=${u=>{(u.key==="Enter"||u.key===" ")&&(u.preventDefault(),b(`/investigate/events/${i.id}`))}}>
                    ${i.thumbnail==="ready"?c`<img class="thumb" src=${me(i.id)} alt="" loading="lazy" />`:c`<div class="none"><sw-icon name=${i.type==="offline"||i.type==="coverage_gap"?"offline":i.type==="door"||i.type==="io"?"door":i.type==="person"?"user":i.type==="vehicle"?"route":"bell"} size=${14}></sw-icon></div>`}
                    <div class="txt"><b style=${`--tone:${he[i.type]??"var(--sw-tl-offline)"}`}><i></i>${I[i.type]??i.type}${i.acked_at?"":` · ${e("לבדיקה")}`}</b><small>${i.camera_name??i.details?.name??e("ללא מצלמה")} · ${i.confidence==="inferred"?e("נגזר מהקלטה"):i.source==="ha"?e("חיישן התקן"):e("התראה")}</small></div>
                    <time>${this.fmtTime(i.occurred_at)}</time>
                  </div>`):c`<div class="muted">${this.loaded?e("אין אירועים ב־24 השעות האחרונות"):e("טוען…")}</div>`}
          </sw-card>
          ${this.renderAttention(q,c`<div class="muted" data-overview-calm>${this.loaded?e("הכול תקין — אין פריטים שדורשים תשומת לב כרגע."):e("בודק…")}</div>`)}
        </div>
      </sw-page>
    `}renderAttention(s,l){s.length!==this.spotCount&&(this.spotCount=s.length,this.spotMeasure=!0);const r=this.spotFit!==null&&this.spotFit<s.length?this.spotFit:null,n=r?Math.ceil(s.length/r):1,t=Math.min(this.spotPage,n-1),o=r?s.slice(t*r,t*r+r):s;return c`<sw-card fill clip data-overview-attention heading=${e("דורש תשומת לב")} subheading=${e("כל פריט מסביר מדוע הוא מוצג")}>
      ${s.length?o.map(d=>c`<div class="spot ${d.kind}" data-overview-spot>
              <div class="ic"><sw-icon name=${d.kind==="critical"?"offline":d.kind==="info"?"info":"warning"} size=${15}></sw-icon></div>
              <div class="sbody"><div class="t" title=${d.title}>${d.title}</div><div class="muted" title=${d.meta}>${d.meta}</div><div class="why" title=${d.why}>${d.why}</div></div>
              <div class="actions"><a href=${d.link}><sw-button size="sm">${e("פתח")}</sw-button></a></div>
            </div>`):l}
      ${r?c`<div class="spotpager" data-overview-spot-pager>
            <button type="button" data-spot-prev aria-label=${e("הפריטים הקודמים")} ?disabled=${t===0} @click=${()=>this.spotPage=t-1}><sw-icon name="chevron" size=${14}></sw-icon></button>
            <span data-overview-spot-range>${e("{range} מתוך {total}",{range:r===1?String(t+1):D(`${t*r+1}–${Math.min(s.length,t*r+r)}`),total:s.length})}</span>
            <button type="button" data-spot-next aria-label=${e("הפריטים הבאים")} ?disabled=${t>=n-1} @click=${()=>this.spotPage=t+1}><sw-icon name="chevronBack" size=${14}></sw-icon></button>
          </div>`:y}
    </sw-card>`}updated(){if(!this.renderRoot.querySelector("sw-card[data-overview-attention]"))return;const l=this.renderRoot.querySelector("sw-page");if(!this.spotObserver&&l&&typeof ResizeObserver<"u"&&(this.spotObserver=new ResizeObserver(()=>{this.spotMeasure=!0,this.requestUpdate()}),this.spotObserver.observe(l)),!!this.spotMeasure){if(this.spotFit!==null){this.spotFit=null;return}requestAnimationFrame(()=>this.measureSpots())}}measureSpots(){if(!this.spotMeasure||this.spotFit!==null)return;this.spotMeasure=!1;const s=this.renderRoot.querySelector("sw-card[data-overview-attention]"),l=typeof matchMedia=="function"&&matchMedia("(min-width: 1024px)").matches,r=s?.shadowRoot?.querySelector(".body"),n=s?[...s.querySelectorAll("[data-overview-spot]")]:[];if(!l||!r||!n.length)return;const t=parseFloat(getComputedStyle(r).paddingBottom||"0")||0,o=ye(r.getBoundingClientRect().top+r.clientHeight-t,n.map(d=>d.getBoundingClientRect().bottom));o<n.length&&(this.spotFit=o)}render(){if(R())return this.renderApi();const s=P.filter(a=>a.state==="live"||a.state==="stale").length,l=T.filter(a=>!a.acked),r=[{kind:"critical",title:e("מצלמה מנותקת: מסדרון מזרחי"),meta:e("קומה 0 · מאז 07:55"),why:e("מוצג כי אין הקלטה ממצלמה זו כבר שעתיים"),link:"#/system/devices"},{kind:"alert",title:e("{unackedCount} אירועים שלא נבדקו",{unackedCount:l.length}),meta:e("אדם בכניסה הראשית 10:14, רכב בחצר 09:42"),why:e("מוצג כי אירועי אדם/רכב מחכים לסימון טיפול"),link:"#/investigate/events"},{kind:"alert",title:e("החיבור לתשתית המערכת לא רענן"),meta:e("סנכרון אחרון לפני 4 דק׳"),why:e("מוצג כי מצבי הישויות עלולים להיות מיושנים"),link:"#/system/diagnostics"}],n=.68,t=34,o=2*Math.PI*t,d=P.filter(a=>a.state==="live").slice(0,2),p=this.tiles.layout;return c`
      <sw-page heading=${e("בוקר טוב, יוני")} subheading=${e("המערכת פועלת · גשר לא רענן · נתוני הדגמה")}>
        <div slot="actions" class="date">${e("יום שני, 14 בספטמבר 2026")}<br />10:24</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi data-overview-tile="cameras" icon="camera" tone="live" value=${String(s)} label=${e("מצלמות")} detail=${e("מחוברות")} layout=${p} href="#/system/devices?sort=offline" hint=${e("פתח את רשימת המצלמות")}></sw-kpi>
          <sw-kpi data-overview-tile="sites" icon="building" value=${String(B.length)} label=${e("אתרים")} detail=${e("פעילים")} tone="neutral" layout=${p} href="#/explore/sites" hint=${e("פתח את האתרים")}></sw-kpi>
          <sw-kpi data-overview-tile="events" icon="bell" value=${String(T.length)} label=${e("אירועים")} detail=${e("ב־24 השעות")} tone="neutral" badge=${e("{n} חדשים",{n:l.length})} layout=${p} href="#/investigate/events" hint=${e("פתח את האירועים")}></sw-kpi>
          <sw-kpi data-overview-tile="health" icon="shield" tone="stale" value=${e("חלקי")} label=${e("מצב מערכת")} detail=${e("גשר לא רענן")} layout=${p} href="#/system/diagnostics?tab=health" hint=${e("פתח את פרטי הבריאות")}></sw-kpi>
        </div>
        <div class="fav">
          ${d.map(a=>c`<sw-camera-tile name=${a.name} state=${a.state} scene=${oe[a.id]??"lobby"} @click=${()=>b(`/live/cameras/${a.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="row2">
          <sw-card heading=${e("אחסון")}>
            <div class="donut">
              <svg viewBox="0 0 84 84" role="img" aria-label=${e("אחסון בשימוש 68%")}>
                ${A`<circle cx="42" cy="42" r=${t} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                <circle cx="42" cy="42" r=${t} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${o*n} ${o}`} transform="rotate(-90 42 42)" />
                <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">68%</text>`}
              </svg>
              <div class="txt">
                <div class="big">${D(e("1.3 TB מתוך 1.9 TB"))}</div>
                <div class="bar"><i></i></div>
                <div class="muted">${e("הקלטה ישנה ביותר ≈ 11 ימים (נמדד) · overwrite פעיל")}</div>
              </div>
            </div>
          </sw-card>
          <sw-card heading=${e("בריאות האתרים")}>
            <div class="hgrid">${B.map(a=>c`<div class="hrow"><span>${a.name}<div class="muted">${e("{n}/{total} מצלמות",{n:a.online,total:a.cameras})} · ${e("{n} התראות",{n:a.alerts})}</div></span><span class="status"><i style="--c:${a.health==="live"?"var(--sw-live)":a.health==="offline"?"var(--sw-danger)":"var(--sw-stale)"}"></i>${a.health==="live"?e("מחובר"):a.health==="offline"?e("מנותק"):e("חלקי")}</span></div>`)}
            ${le.slice(0,2).map(a=>c`<div class="hrow"><span>${a.name}<div class="muted">${a.detail}</div></span><span class="status"><i style="--c:${a.state==="live"?"var(--sw-live)":"var(--sw-stale)"}"></i>${a.state==="live"?e("מחובר"):e("לא רענן")}</span></div>`)}</div>
          </sw-card>
        </div>
        <div class="row3">
          <sw-card fill heading=${e("אירועים אחרונים")}>
            <a slot="actions" class="seeall" href="#/investigate/events">${e("הצג הכל")}</a>
            ${T.slice(0,5).map(a=>c`<div class="ev" role="link" tabindex="0" @click=${()=>b("/investigate/events")} @keydown=${g=>{(g.key==="Enter"||g.key===" ")&&(g.preventDefault(),b("/investigate/events"))}}>
                ${a.type==="offline"||a.type==="door"?c`<div class="none"><sw-icon name=${a.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:c`<sw-scene kind=${_e[a.camera]??"lobby"}></sw-scene>`}
                <div class="txt"><b style="--tone:${ze[a.type]}"><i></i>${de[a.type]}</b><small>${a.camera} · ${a.floor}</small></div>
                <time>${a.time}</time>
              </div>`)}
          </sw-card>
          ${this.renderAttention(r,y)}
        </div>
      </sw-page>
    `}};v.styles=[fe,be,H`
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
  `];h([m()],v.prototype,"cams",2);h([m()],v.prototype,"recorder",2);h([m()],v.prototype,"sites",2);h([m()],v.prototype,"summary",2);h([m()],v.prototype,"summaryDenied",2);h([m()],v.prototype,"recent",2);h([m()],v.prototype,"storage",2);h([m()],v.prototype,"health",2);h([m()],v.prototype,"raw",2);h([m()],v.prototype,"tz",2);h([m()],v.prototype,"now",2);h([m()],v.prototype,"loaded",2);h([m()],v.prototype,"spotFit",2);h([m()],v.prototype,"spotPage",2);h([m()],v.prototype,"loadFailed",2);v=h([ce("live-overview")],v);export{v as LiveOverview};
