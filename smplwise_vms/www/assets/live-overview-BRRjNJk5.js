import{E as j,a as F,S as H,pC as Z,i as N,J as G,pD as J,g as D,pE as U,pF as W,M as K,j as q,n as C,pG as z,pH as I,Q,e as l,A as _,e1 as X,aj as g,w as O,pI as Y,pJ as ee,pK as V,pL as E,pM as A,e0 as te,q as se,pN as ie,pO as ae,C as re,G as m,H as le}from"./index-Bd8RPmTw.js";import{g as ne,f as P}from"./storage-BYOtsDbh.js";import{d as oe}from"./recordings-CfcOhLkH.js";import{a as de}from"./ha-sync-status-pHb_c94a.js";import"./sw-logo-art-Va6y_cIM.js";const ce=j`
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
`;var ve=Object.defineProperty,pe=Object.getOwnPropertyDescriptor,h=(r,n,v,i)=>{for(var s=i>1?void 0:i?pe(n,v):n,a=r.length-1,d;a>=0;a--)(d=r[a])&&(s=(i?d(n,v,s):d(s))||s);return i&&s&&ve(n,v,s),s};function R(r){return r<5?"לילה טוב":r<12?"בוקר טוב":r<17?"צהריים טובים":r<21?"ערב טוב":"לילה טוב"}const he={person:"var(--sw-tl-person)",vehicle:"var(--sw-tl-vehicle)",motion:"var(--sw-tl-motion)",line:"var(--sw-tl-line)",offline:"var(--sw-tl-offline)",door:"var(--sw-tl-door)"},me={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking"};let c=class extends F{constructor(){super(...arguments),this.bubbleSkin=new H(this),this.cams=null,this.recorder=null,this.sites=null,this.summary=null,this.summaryDenied=!1,this.recent=[],this.storage=null,this.health=null,this.raw=null,this.tz="Asia/Jerusalem",this.now=new Date,this.loaded=!1,this.loadFailed=!1,this.timer=0,this.clockTimer=0,this.tiles=new Z(this)}connectedCallback(){super.connectedCallback(),N()&&(this.load(),this.timer=window.setInterval(()=>void this.load(),6e4),this.clockTimer=window.setInterval(()=>this.now=new Date,3e4))}disconnectedCallback(){window.clearInterval(this.timer),window.clearInterval(this.clockTimer),super.disconnectedCallback()}async load(){this.loadStorage();const[r,n,v,i,s,a,d]=await Promise.allSettled([G(),J(),D("sites?tree=true"),U(),W({limit:6}),K(),D("health")]);r.status==="fulfilled"&&(this.tz=r.value["time.zone"]??this.tz),n.status==="fulfilled"?(this.cams=n.value.cameras.filter(o=>o.enabled&&o.recorder_enabled!==!1),this.recorder=n.value.recorder):this.cams===null&&(this.cams=[]),v.status==="fulfilled"?this.sites=v.value.sites:this.sites===null&&(this.sites=[]),i.status==="fulfilled"?this.summary=i.value:this.summaryDenied=i.reason instanceof q&&i.reason.status===403,s.status==="fulfilled"&&(this.recent=s.value.events),a.status==="fulfilled"&&(this.health=a.value),d.status==="fulfilled"&&(this.raw=d.value),this.loadFailed=[n,v,a,d].every(o=>o.status==="rejected")&&this.cams?.length===0&&this.health===null,this.loaded=!0,this.now=new Date}async loadStorage(){try{this.storage=await ne()}catch{this.storage=null}}fmtTime(r){return C(new Date(r),{timeZone:this.tz})}spots(){const r=[],n=this.cams??[];for(const s of n.filter(a=>a.status==="offline"))r.push({kind:"critical",title:`מצלמה מנותקת: ${s.name}`,meta:`ערוץ ${s.channel}${s.last_seen_at?` · נראתה לאחרונה ${this.fmtTime(s.last_seen_at)}`:""}`,why:"מוצג כי ה־NVR מדווח שהערוץ אינו מחובר",link:`#/live/cameras/${s.id}`});for(const s of(this.health?.items??[]).filter(a=>a.status!=="ok"))r.push({kind:s.status==="error"?"critical":"alert",title:s.label,meta:`בדיקת מערכת · ${z[s.status]}`,why:"מוצג כי בדיקת הבריאות של ה־Add-on מדווחת על כך",link:"#/system/diagnostics"});const v=this.summary?.today.unacked??0;if(v>0){const s=Object.entries(this.summary?.today.by_type??{}).sort((a,d)=>d[1]-a[1]).slice(0,3).map(([a,d])=>`${I[a]??a} ${d}`).join(" · ");r.push({kind:"alert",title:`${v} אירועים שלא נבדקו היום`,meta:s,why:"מוצג כי אירועים ממתינים לסימון טיפול במרכז האירועים",link:"#/investigate/events"})}const i=this.raw?.events.ingest;return i?.connected&&!i.events_stored&&!i.last_event_at&&r.push({kind:"info",title:"ה־NVR לא שלח התראות מאז ההפעלה",meta:"אירועי תנועה נגזרים מההקלטות כל 10 דקות",why:'מוצג כי זרם ההתראות מחובר אך ריק — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה',link:"#/system/setup"}),this.raw?.home_assistant.configured&&!this.raw.home_assistant.connected&&r.push({kind:"alert",title:"אין חיבור לתשתית המערכת",meta:de(this.raw.home_assistant.last_error),why:"מוצג כי מצבי הישויות והדלתות עלולים להיות מיושנים",link:"#/system/setup"}),r}renderApi(){const r=Q.me?.user,n=r?.display_name||r?.username||"",v=Number(this.now.toLocaleString("en-GB",{hour:"numeric",hour12:!1,timeZone:this.tz})),i=this.cams??[],s=i.filter(e=>e.status==="online").length,a=this.sites??[],d=a.flatMap(e=>(e.buildings??[]).flatMap(p=>p.floors??[])),o=this.health,t=o?o.status==="ok"?"live":o.status==="warn"?"stale":"offline":"neutral",f=o?.items.find(e=>e.status!=="ok"),S=this.loaded?this.spots():[],w=this.storage,b=w?.totals??null,$=b?.used_pct??null,y=34,T=2*Math.PI*y,L=i.filter(e=>e.status==="online").slice(0,2),k=this.tiles.layout;return this.loaded&&this.loadFailed?l`<sw-page heading=${`${R(v)}${n?`, ${n}`:""}`}><sw-state-panel state="error" actionLabel="נסו שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`:l`
      <sw-page heading=${`${R(v)}${n?`, ${n}`:""}`} subheading=${o?`מצב המערכת: ${z[o.status]}${f?` · ${f.label}`:" · כל הבדיקות תקינות"}`:"קורא את מצב המערכת…"}>
        <div slot="actions" class="date">${this.now.toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:this.tz})}<br />${C(this.now,{timeZone:this.tz})}</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi data-overview-tile="cameras" icon="camera" tone=${i.length&&s===i.length?"live":s?"stale":"offline"} value=${`${s}/${i.length}`} label="מצלמות" detail=${this.recorder?`מחוברות · ${this.recorder.model??this.recorder.name}`:"מחוברות"} layout=${k} href="#/system/devices?sort=offline" hint="פתח את רשימת המצלמות"></sw-kpi>
          <sw-kpi data-overview-tile="sites" icon="building" value=${String(a.length)} label="אתרים" detail=${`${d.length} קומות · ${d.filter(e=>e.has_plan).length} עם תוכנית`} tone="neutral" layout=${k} href="#/explore/sites" hint="פתח את האתרים"></sw-kpi>
          <sw-kpi data-overview-tile="events" icon="bell" value=${this.summaryDenied?"—":String(this.summary?.today.total??0)} label="אירועים" detail=${this.summaryDenied?"ללא הרשאה לאירועים":"היום"} tone="neutral" badge=${this.summary?.today.unacked?`${this.summary.today.unacked} לבדיקה`:""} layout=${k} href=${`#/investigate/events?date=${oe(this.now,this.tz)}`} hint="פתח את אירועי היום"></sw-kpi>
          <sw-kpi data-overview-tile="health" icon="shield" tone=${t} value=${o?z[o.status]:"…"} label="מצב מערכת" detail=${f?f.label:"NVR, go2rtc, תשתית המערכת ואחסון"} layout=${k} href="#/system/diagnostics?tab=health" hint="פתח את פרטי הבריאות"></sw-kpi>
        </div>
        ${L.length?l`<div class="fav" data-overview-favorites>
              ${L.map(e=>l`<sw-camera-tile name=${e.name} state="live" cameraId=${e.id} poster=${X(e.id)} .stillRefresh=${e.live_kind==="still"?e.still_refresh_s??10:0} noDemo @click=${()=>g(`/live/cameras/${e.id}`)}></sw-camera-tile>`)}
            </div>`:_}
        <div class="row2">
          ${w&&b?l`<sw-card heading="אחסון" subheading=${w.cached?"מהמטמון · נמדד מול ה־NVR":"נמדד מול ה־NVR"}>
                <div class="donut">
                  <svg viewBox="0 0 84 84" role="img" aria-label=${`אחסון בשימוש ${$??0}%`}>
                    ${O`<circle cx="42" cy="42" r=${y} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                    <circle cx="42" cy="42" r=${y} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${T*($??0)/100} ${T}`} transform="rotate(-90 42 42)" />
                    <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">${$??0}%</text>`}
                  </svg>
                  <div class="txt">
                    <div class="big">${P(b.used_mb)} מתוך ${P(b.capacity_mb)}</div>
                    <div class="bar"><i style=${`inline-size:${$??0}%`}></i></div>
                    <div class="muted">${w.retention.measured_days_min!==null?`הקלטה ישנה ביותר ≈ ${w.retention.measured_days_min}${w.retention.measured_days_max!==null&&w.retention.measured_days_max!==w.retention.measured_days_min?`–${w.retention.measured_days_max}`:""} ימים (נמדד)`:w.retention.measured_reason}${w.work_mode?` · ${w.work_mode}`:""} · ${b.disks} דיסקים</div>
                  </div>
                </div>
              </sw-card>`:_}
          <sw-card heading="אתרים ומבנים" subheading=${a.length?`${a.length} אתרים · ${d.length} קומות`:"עדיין לא הוגדרו אתרים"}>
            ${a.map(e=>{const p=(e.buildings??[]).flatMap(u=>u.floors??[]),x=p.filter(u=>u.has_plan).length,B=p.reduce((u,M)=>u+M.camera_count,0);return l`<div class="hrow link" role="link" tabindex="0" @click=${()=>g("/explore/sites")} @keydown=${u=>{(u.key==="Enter"||u.key===" ")&&(u.preventDefault(),g("/explore/sites"))}}><span>${e.name}<div class="muted">${(e.buildings??[]).length} מבנים · ${p.length} קומות · ${B} מצלמות מוצבות · ${x}/${p.length} תוכניות</div></span><span class="status"><i style=${`--c:${p.length&&x===p.length?"var(--sw-live)":"var(--sw-stale)"}`}></i>${p.length&&x===p.length?"תוכניות מפורסמות":"חסרות תוכניות"}</span></div>`})}
            ${this.recorder?l`<div class="hrow"><span>NVR · ${this.recorder.name}<div class="muted">${this.recorder.model??""} · ${s}/${i.length} מצלמות מחוברות</div></span><span class="status"><i style=${`--c:${s===i.length?"var(--sw-live)":"var(--sw-offline)"}`}></i>${s===i.length?"מחובר":`${i.length-s} מנותקות`}</span></div>`:_}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card fill heading="אירועים אחרונים" subheading=${this.summary?`${this.summary.today.total} היום · ${this.summary.today.measured} נמדדו · ${this.summary.today.inferred} נגזרו מהקלטה`:""}>
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${this.recent.length?this.recent.map(e=>l`<div class="ev" data-overview-event role="link" tabindex="0" @click=${()=>g(`/investigate/events/${e.id}`)} @keydown=${p=>{(p.key==="Enter"||p.key===" ")&&(p.preventDefault(),g(`/investigate/events/${e.id}`))}}>
                    ${e.thumbnail==="ready"?l`<img class="thumb" src=${ee(e.id)} alt="" loading="lazy" />`:l`<div class="none"><sw-icon name=${e.type==="offline"||e.type==="coverage_gap"?"offline":e.type==="door"||e.type==="io"?"door":e.type==="person"?"user":e.type==="vehicle"?"route":"bell"} size=${14}></sw-icon></div>`}
                    <div class="txt"><b style=${`--tone:${Y[e.type]??"var(--sw-tl-offline)"}`}><i></i>${I[e.type]??e.type}${e.acked_at?"":" · לבדיקה"}</b><small>${e.camera_name??e.details?.name??"ללא מצלמה"} · ${e.confidence==="inferred"?"נגזר מהקלטה":e.source==="ha"?"חיישן התקן":"התראה"}</small></div>
                    <time>${this.fmtTime(e.occurred_at)}</time>
                  </div>`):l`<div class="muted">${this.loaded?"אין אירועים ב־24 השעות האחרונות":"טוען…"}</div>`}
          </sw-card>
          <sw-card fill heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
            ${S.length?S.map(e=>l`<div class="spot ${e.kind}" data-overview-spot>
                    <div class="ic"><sw-icon name=${e.kind==="critical"?"offline":e.kind==="info"?"info":"warning"} size=${15}></sw-icon></div>
                    <div><div class="t">${e.title}</div><div class="muted">${e.meta}</div><div class="why">${e.why}</div></div>
                    <div class="actions"><a href=${e.link}><sw-button size="sm">פתח</sw-button></a></div>
                  </div>`):l`<div class="muted" data-overview-calm>${this.loaded?"הכול תקין — אין פריטים שדורשים תשומת לב כרגע.":"בודק…"}</div>`}
          </sw-card>
        </div>
      </sw-page>
    `}render(){if(N())return this.renderApi();const r=V.filter(t=>t.state==="live"||t.state==="stale").length,n=E.filter(t=>!t.acked),v=[{kind:"critical",title:"מצלמה מנותקת: מסדרון מזרחי",meta:"קומה 0 · מאז 07:55",why:"מוצג כי אין הקלטה ממצלמה זו כבר שעתיים",link:"#/system/devices"},{kind:"alert",title:`${n.length} אירועים שלא נבדקו`,meta:"אדם בכניסה הראשית 10:14, רכב בחצר 09:42",why:"מוצג כי אירועי אדם/רכב מחכים לסימון טיפול",link:"#/investigate/events"},{kind:"alert",title:"החיבור לתשתית המערכת לא רענן",meta:"סנכרון אחרון לפני 4 דק׳",why:"מוצג כי מצבי הישויות עלולים להיות מיושנים",link:"#/system/diagnostics"}],i=.68,s=34,a=2*Math.PI*s,d=V.filter(t=>t.state==="live").slice(0,2),o=this.tiles.layout;return l`
      <sw-page heading="בוקר טוב, יוני" subheading="המערכת פועלת · גשר לא רענן · נתוני הדגמה">
        <div slot="actions" class="date">יום שני, 14 בספטמבר 2026<br />10:24</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi data-overview-tile="cameras" icon="camera" tone="live" value=${String(r)} label="מצלמות" detail="מחוברות" layout=${o} href="#/system/devices?sort=offline" hint="פתח את רשימת המצלמות"></sw-kpi>
          <sw-kpi data-overview-tile="sites" icon="building" value=${String(A.length)} label="אתרים" detail="פעילים" tone="neutral" layout=${o} href="#/explore/sites" hint="פתח את האתרים"></sw-kpi>
          <sw-kpi data-overview-tile="events" icon="bell" value=${String(E.length)} label="אירועים" detail="ב־24 השעות" tone="neutral" badge=${`${n.length} חדשים`} layout=${o} href="#/investigate/events" hint="פתח את האירועים"></sw-kpi>
          <sw-kpi data-overview-tile="health" icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר לא רענן" layout=${o} href="#/system/diagnostics?tab=health" hint="פתח את פרטי הבריאות"></sw-kpi>
        </div>
        <div class="fav">
          ${d.map(t=>l`<sw-camera-tile name=${t.name} state=${t.state} scene=${te[t.id]??"lobby"} @click=${()=>g(`/live/cameras/${t.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="row2">
          <sw-card heading="אחסון">
            <div class="donut">
              <svg viewBox="0 0 84 84" role="img" aria-label="אחסון בשימוש 68%">
                ${O`<circle cx="42" cy="42" r=${s} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                <circle cx="42" cy="42" r=${s} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${a*i} ${a}`} transform="rotate(-90 42 42)" />
                <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">68%</text>`}
              </svg>
              <div class="txt">
                <div class="big">${se("1.3 TB מתוך 1.9 TB")}</div>
                <div class="bar"><i></i></div>
                <div class="muted">הקלטה ישנה ביותר ≈ 11 ימים (נמדד) · overwrite פעיל</div>
              </div>
            </div>
          </sw-card>
          <sw-card heading="בריאות האתרים">
            ${A.map(t=>l`<div class="hrow"><span>${t.name}<div class="muted">${t.online}/${t.cameras} מצלמות · ${t.alerts} התראות</div></span><span class="status"><i style="--c:${t.health==="live"?"var(--sw-live)":t.health==="offline"?"var(--sw-danger)":"var(--sw-stale)"}"></i>${t.health==="live"?"מחובר":t.health==="offline"?"מנותק":"חלקי"}</span></div>`)}
            ${ie.slice(0,2).map(t=>l`<div class="hrow"><span>${t.name}<div class="muted">${t.detail}</div></span><span class="status"><i style="--c:${t.state==="live"?"var(--sw-live)":"var(--sw-stale)"}"></i>${t.state==="live"?"מחובר":"לא רענן"}</span></div>`)}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card fill heading="אירועים אחרונים">
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${E.slice(0,5).map(t=>l`<div class="ev" role="link" tabindex="0" @click=${()=>g("/investigate/events")} @keydown=${f=>{(f.key==="Enter"||f.key===" ")&&(f.preventDefault(),g("/investigate/events"))}}>
                ${t.type==="offline"||t.type==="door"?l`<div class="none"><sw-icon name=${t.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:l`<sw-scene kind=${me[t.camera]??"lobby"}></sw-scene>`}
                <div class="txt"><b style="--tone:${he[t.type]}"><i></i>${ae[t.type]}</b><small>${t.camera} · ${t.floor}</small></div>
                <time>${t.time}</time>
              </div>`)}
          </sw-card>
          <sw-card fill heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
            ${v.map(t=>l`<div class="spot ${t.kind}">
                <div class="ic"><sw-icon name=${t.kind==="critical"?"offline":"warning"} size=${15}></sw-icon></div>
                <div><div class="t">${t.title}</div><div class="muted">${t.meta}</div><div class="why">${t.why}</div></div>
                <div class="actions"><a href=${t.link}><sw-button size="sm">פתח</sw-button></a></div>
              </div>`)}
          </sw-card>
        </div>
      </sw-page>
    `}};c.styles=[re,ce,j`
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
  `];h([m()],c.prototype,"cams",2);h([m()],c.prototype,"recorder",2);h([m()],c.prototype,"sites",2);h([m()],c.prototype,"summary",2);h([m()],c.prototype,"summaryDenied",2);h([m()],c.prototype,"recent",2);h([m()],c.prototype,"storage",2);h([m()],c.prototype,"health",2);h([m()],c.prototype,"raw",2);h([m()],c.prototype,"tz",2);h([m()],c.prototype,"now",2);h([m()],c.prototype,"loaded",2);h([m()],c.prototype,"loadFailed",2);c=h([le("live-overview")],c);export{c as LiveOverview};
//# sourceMappingURL=live-overview-BRRjNJk5.js.map
