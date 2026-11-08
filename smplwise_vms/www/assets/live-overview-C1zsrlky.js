import{E as j,a as M,S as W,qv as U,i as q,K as Z,eD as G,g as L,qw as K,qx as J,O as Q,j as X,n as N,bg as Y,qy as _,qz as C,R as ee,e as l,qA as te,qB as se,qC as ie,A as E,qD as y,bf as I,eS as ae,ak as g,w as O,qE as re,qF as le,qG as B,qH as S,qI as A,eR as ne,q as oe,qJ as de,qK as ce,C as ve,G as m,H as pe}from"./index-CCDqf4A8.js";import{g as he,f as V}from"./storage-D08kk49I.js";import{d as me}from"./recordings-DFvqvsh_.js";import{a as we}from"./ha-sync-status-9DcgxODD.js";import"./sw-logo-art-Va6y_cIM.js";const ue=j`
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
`;var fe=Object.defineProperty,ge=Object.getOwnPropertyDescriptor,h=(a,n,v,r)=>{for(var s=r>1?void 0:r?ge(n,v):n,i=a.length-1,d;i>=0;i--)(d=a[i])&&(s=(r?d(n,v,s):d(s))||s);return r&&s&&fe(n,v,s),s};function P(a){return a<5?"לילה טוב":a<12?"בוקר טוב":a<17?"צהריים טובים":a<21?"ערב טוב":"לילה טוב"}const be={person:"var(--sw-tl-person)",vehicle:"var(--sw-tl-vehicle)",motion:"var(--sw-tl-motion)",line:"var(--sw-tl-line)",offline:"var(--sw-tl-offline)",door:"var(--sw-tl-door)"},$e={"כניסה ראשית":"entrance","חצר אחורית":"backyard",מחסן:"warehouse",לובי:"lobby","חניה מקורה":"parking"};let c=class extends M{constructor(){super(...arguments),this.bubbleSkin=new W(this),this.cams=null,this.recorder=null,this.sites=null,this.summary=null,this.summaryDenied=!1,this.recent=[],this.storage=null,this.health=null,this.raw=null,this.tz="Asia/Jerusalem",this.now=new Date,this.loaded=!1,this.loadFailed=!1,this.timer=0,this.clockTimer=0,this.tiles=new U(this)}connectedCallback(){super.connectedCallback(),q()&&(this.load(),this.timer=window.setInterval(()=>void this.load(),6e4),this.clockTimer=window.setInterval(()=>this.now=new Date,3e4))}disconnectedCallback(){window.clearInterval(this.timer),window.clearInterval(this.clockTimer),super.disconnectedCallback()}async load(){this.loadStorage();const[a,n,v,r,s,i,d]=await Promise.allSettled([Z(),G(),L("sites?tree=true"),K(),J({limit:6}),Q(),L("health")]);a.status==="fulfilled"&&(this.tz=a.value["time.zone"]??this.tz),n.status==="fulfilled"?(this.cams=n.value.cameras.filter(o=>o.enabled&&o.recorder_enabled!==!1),this.recorder=n.value.recorder):this.cams===null&&(this.cams=[]),v.status==="fulfilled"?this.sites=v.value.sites:this.sites===null&&(this.sites=[]),r.status==="fulfilled"?this.summary=r.value:this.summaryDenied=r.reason instanceof X&&r.reason.status===403,s.status==="fulfilled"&&(this.recent=s.value.events),i.status==="fulfilled"&&(this.health=i.value),d.status==="fulfilled"&&(this.raw=d.value),this.loadFailed=[n,v,i,d].every(o=>o.status==="rejected")&&this.cams?.length===0&&this.health===null,this.loaded=!0,this.now=new Date}async loadStorage(){try{this.storage=await he()}catch{this.storage=null}}fmtTime(a){return N(new Date(a),{timeZone:this.tz})}spots(){const a=[],n=this.cams??[];for(const s of n.filter(i=>i.status==="offline")){const i=s.last_seen_at?` · נראתה לאחרונה ${this.fmtTime(s.last_seen_at)}`:"";Y(s)?a.push({kind:"critical",title:`מצלמה מנותקת: ${s.name}`,meta:`מצלמה ללא מקליט${i}`,why:"מוצג כי המצלמה אינה עונה בכתובת הווידאו שלה",link:`#/live/cameras/${s.id}`}):a.push({kind:"critical",title:`מצלמה מנותקת: ${s.name}`,meta:`ערוץ ${s.channel}${i}`,why:"מוצג כי ה־NVR מדווח שהערוץ אינו מחובר",link:`#/live/cameras/${s.id}`})}for(const s of(this.health?.items??[]).filter(i=>i.status!=="ok"))a.push({kind:s.status==="error"?"critical":"alert",title:s.label,meta:`בדיקת מערכת · ${_[s.status]}`,why:"מוצג כי בדיקת הבריאות של ה־Add-on מדווחת על כך",link:"#/system/diagnostics"});const v=this.summary?.today.unacked??0;if(v>0){const s=Object.entries(this.summary?.today.by_type??{}).sort((i,d)=>d[1]-i[1]).slice(0,3).map(([i,d])=>`${C[i]??i} ${d}`).join(" · ");a.push({kind:"alert",title:`${v} אירועים שלא נבדקו היום`,meta:s,why:"מוצג כי אירועים ממתינים לסימון טיפול במרכז האירועים",link:"#/investigate/events"})}const r=this.raw?.events.ingest;return r?.connected&&!r.events_stored&&!r.last_event_at&&a.push({kind:"info",title:"ה־NVR לא שלח התראות מאז ההפעלה",meta:"אירועי תנועה נגזרים מההקלטות כל 10 דקות",why:'מוצג כי זרם ההתראות מחובר אך ריק — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה',link:"#/system/setup"}),this.raw?.home_assistant.configured&&!this.raw.home_assistant.connected&&a.push({kind:"alert",title:"אין חיבור לתשתית המערכת",meta:we(this.raw.home_assistant.last_error),why:"מוצג כי מצבי הישויות והדלתות עלולים להיות מיושנים",link:"#/system/setup"}),a}renderApi(){const a=ee.me?.user,n=a?.display_name||a?.username||"",v=Number(this.now.toLocaleString("en-GB",{hour:"numeric",hour12:!1,timeZone:this.tz})),r=this.cams??[],s=r.filter(e=>e.status==="online").length,i=this.sites??[],d=i.flatMap(e=>(e.buildings??[]).flatMap(p=>p.floors??[])),o=this.health,t=o?o.status==="ok"?"live":o.status==="warn"?"stale":"offline":"neutral",f=o?.items.find(e=>e.status!=="ok"),T=this.loaded?this.spots():[],w=this.storage,b=w?.totals??null,$=b?.used_pct??null,x=34,R=2*Math.PI*x,D=r.filter(e=>e.status==="online").slice(0,2),k=this.tiles.layout;return this.loaded&&this.loadFailed?l`<sw-page heading=${`${P(v)}${n?`, ${n}`:""}`}><sw-state-panel state="error" actionLabel="נסו שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`:l`
      <sw-page heading=${`${P(v)}${n?`, ${n}`:""}`} subheading=${o?`מצב המערכת: ${_[o.status]}${f?` · ${f.label}`:" · כל הבדיקות תקינות"}`:"קורא את מצב המערכת…"}>
        <div slot="actions" class="date">${this.now.toLocaleDateString("he-IL",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:this.tz})}<br />${N(this.now,{timeZone:this.tz})}</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi data-overview-tile="cameras" icon="camera" tone=${r.length&&s===r.length?"live":s?"stale":"offline"} value=${`${s}/${r.length}`} label="מצלמות" detail=${y()?this.recorder?`מחוברות · ${this.recorder.model??this.recorder.name}`:"מחוברות":te} layout=${k} href=${y()?I("nvr")?"#/system/devices?sort=offline":"#/live/wall":se} hint=${y()?"פתח את רשימת המצלמות":ie} ?data-webrtc-required=${!y()}></sw-kpi>
          <sw-kpi data-overview-tile="sites" icon="building" value=${String(i.length)} label="אתרים" detail=${`${d.length} קומות · ${d.filter(e=>e.has_plan).length} עם תוכנית`} tone="neutral" layout=${k} href="#/explore/sites" hint="פתח את האתרים"></sw-kpi>
          <sw-kpi data-overview-tile="events" icon="bell" value=${this.summaryDenied?"—":String(this.summary?.today.total??0)} label="אירועים" detail=${this.summaryDenied?"ללא הרשאה לאירועים":"היום"} tone="neutral" badge=${this.summary?.today.unacked?`${this.summary.today.unacked} לבדיקה`:""} layout=${k} href=${`#/investigate/events?date=${me(this.now,this.tz)}`} hint="פתח את אירועי היום"></sw-kpi>
          <sw-kpi data-overview-tile="health" icon="shield" tone=${t} value=${o?_[o.status]:"…"} label="מצב מערכת" detail=${f?f.label:"NVR, go2rtc, תשתית המערכת ואחסון"} layout=${k} href="#/system/diagnostics?tab=health" hint="פתח את פרטי הבריאות"></sw-kpi>
        </div>
        ${D.length?l`<div class="fav" data-overview-favorites>
              ${D.map(e=>l`<sw-camera-tile name=${e.name} state="live" cameraId=${e.id} poster=${ae(e.id)} .stillRefresh=${e.live_kind==="still"?e.still_refresh_s??10:0} noDemo @click=${()=>g(`/live/cameras/${e.id}`)}></sw-camera-tile>`)}
            </div>`:E}
        <div class="row2">
          ${w&&b&&I("nvr")?l`<sw-card heading="אחסון" subheading=${w.cached?"מהמטמון · נמדד מול ה־NVR":"נמדד מול ה־NVR"}>
                <div class="donut">
                  <svg viewBox="0 0 84 84" role="img" aria-label=${`אחסון בשימוש ${$??0}%`}>
                    ${O`<circle cx="42" cy="42" r=${x} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                    <circle cx="42" cy="42" r=${x} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${R*($??0)/100} ${R}`} transform="rotate(-90 42 42)" />
                    <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">${$??0}%</text>`}
                  </svg>
                  <div class="txt">
                    <div class="big">${V(b.used_mb)} מתוך ${V(b.capacity_mb)}</div>
                    <div class="bar"><i style=${`inline-size:${$??0}%`}></i></div>
                    <div class="muted">${w.retention.measured_days_min!==null?`הקלטה ישנה ביותר ≈ ${w.retention.measured_days_min}${w.retention.measured_days_max!==null&&w.retention.measured_days_max!==w.retention.measured_days_min?`–${w.retention.measured_days_max}`:""} ימים (נמדד)`:w.retention.measured_reason}${w.work_mode?` · ${w.work_mode}`:""} · ${b.disks} דיסקים</div>
                  </div>
                </div>
              </sw-card>`:E}
          <sw-card heading="אתרים ומבנים" subheading=${i.length?`${i.length} אתרים · ${d.length} קומות`:"עדיין לא הוגדרו אתרים"}>
            ${i.map(e=>{const p=(e.buildings??[]).flatMap(u=>u.floors??[]),z=p.filter(u=>u.has_plan).length,F=p.reduce((u,H)=>u+H.camera_count,0);return l`<div class="hrow link" role="link" tabindex="0" @click=${()=>g("/explore/sites")} @keydown=${u=>{(u.key==="Enter"||u.key===" ")&&(u.preventDefault(),g("/explore/sites"))}}><span>${e.name}<div class="muted">${(e.buildings??[]).length} מבנים · ${p.length} קומות · ${F} מצלמות מוצבות · ${z}/${p.length} תוכניות</div></span><span class="status"><i style=${`--c:${p.length&&z===p.length?"var(--sw-live)":"var(--sw-stale)"}`}></i>${p.length&&z===p.length?"תוכניות מפורסמות":"חסרות תוכניות"}</span></div>`})}
            ${this.recorder?l`<div class="hrow"><span>NVR · ${this.recorder.name}<div class="muted">${this.recorder.model??""} · ${s}/${r.length} מצלמות מחוברות</div></span><span class="status"><i style=${`--c:${s===r.length?"var(--sw-live)":"var(--sw-offline)"}`}></i>${s===r.length?"מחובר":`${r.length-s} מנותקות`}</span></div>`:E}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card fill heading="אירועים אחרונים" subheading=${this.summary?`${this.summary.today.total} היום · ${this.summary.today.measured} נמדדו · ${this.summary.today.inferred} נגזרו מהקלטה`:""}>
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${this.recent.length?this.recent.map(e=>l`<div class="ev" data-overview-event role="link" tabindex="0" @click=${()=>g(`/investigate/events/${e.id}`)} @keydown=${p=>{(p.key==="Enter"||p.key===" ")&&(p.preventDefault(),g(`/investigate/events/${e.id}`))}}>
                    ${e.thumbnail==="ready"?l`<img class="thumb" src=${le(e.id)} alt="" loading="lazy" />`:l`<div class="none"><sw-icon name=${e.type==="offline"||e.type==="coverage_gap"?"offline":e.type==="door"||e.type==="io"?"door":e.type==="person"?"user":e.type==="vehicle"?"route":"bell"} size=${14}></sw-icon></div>`}
                    <div class="txt"><b style=${`--tone:${re[e.type]??"var(--sw-tl-offline)"}`}><i></i>${C[e.type]??e.type}${e.acked_at?"":" · לבדיקה"}</b><small>${e.camera_name??e.details?.name??"ללא מצלמה"} · ${e.confidence==="inferred"?"נגזר מהקלטה":e.source==="ha"?"חיישן התקן":"התראה"}</small></div>
                    <time>${this.fmtTime(e.occurred_at)}</time>
                  </div>`):l`<div class="muted">${this.loaded?"אין אירועים ב־24 השעות האחרונות":"טוען…"}</div>`}
          </sw-card>
          <sw-card fill heading="דורש תשומת לב" subheading="כל פריט מסביר מדוע הוא מוצג">
            ${T.length?T.map(e=>l`<div class="spot ${e.kind}" data-overview-spot>
                    <div class="ic"><sw-icon name=${e.kind==="critical"?"offline":e.kind==="info"?"info":"warning"} size=${15}></sw-icon></div>
                    <div><div class="t">${e.title}</div><div class="muted">${e.meta}</div><div class="why">${e.why}</div></div>
                    <div class="actions"><a href=${e.link}><sw-button size="sm">פתח</sw-button></a></div>
                  </div>`):l`<div class="muted" data-overview-calm>${this.loaded?"הכול תקין — אין פריטים שדורשים תשומת לב כרגע.":"בודק…"}</div>`}
          </sw-card>
        </div>
      </sw-page>
    `}render(){if(q())return this.renderApi();const a=B.filter(t=>t.state==="live"||t.state==="stale").length,n=S.filter(t=>!t.acked),v=[{kind:"critical",title:"מצלמה מנותקת: מסדרון מזרחי",meta:"קומה 0 · מאז 07:55",why:"מוצג כי אין הקלטה ממצלמה זו כבר שעתיים",link:"#/system/devices"},{kind:"alert",title:`${n.length} אירועים שלא נבדקו`,meta:"אדם בכניסה הראשית 10:14, רכב בחצר 09:42",why:"מוצג כי אירועי אדם/רכב מחכים לסימון טיפול",link:"#/investigate/events"},{kind:"alert",title:"החיבור לתשתית המערכת לא רענן",meta:"סנכרון אחרון לפני 4 דק׳",why:"מוצג כי מצבי הישויות עלולים להיות מיושנים",link:"#/system/diagnostics"}],r=.68,s=34,i=2*Math.PI*s,d=B.filter(t=>t.state==="live").slice(0,2),o=this.tiles.layout;return l`
      <sw-page heading="בוקר טוב, יוני" subheading="המערכת פועלת · גשר לא רענן · נתוני הדגמה">
        <div slot="actions" class="date">יום שני, 14 בספטמבר 2026<br />10:24</div>
        <div class="kpis" data-overview-kpis>
          <sw-kpi data-overview-tile="cameras" icon="camera" tone="live" value=${String(a)} label="מצלמות" detail="מחוברות" layout=${o} href="#/system/devices?sort=offline" hint="פתח את רשימת המצלמות"></sw-kpi>
          <sw-kpi data-overview-tile="sites" icon="building" value=${String(A.length)} label="אתרים" detail="פעילים" tone="neutral" layout=${o} href="#/explore/sites" hint="פתח את האתרים"></sw-kpi>
          <sw-kpi data-overview-tile="events" icon="bell" value=${String(S.length)} label="אירועים" detail="ב־24 השעות" tone="neutral" badge=${`${n.length} חדשים`} layout=${o} href="#/investigate/events" hint="פתח את האירועים"></sw-kpi>
          <sw-kpi data-overview-tile="health" icon="shield" tone="stale" value="חלקי" label="מצב מערכת" detail="גשר לא רענן" layout=${o} href="#/system/diagnostics?tab=health" hint="פתח את פרטי הבריאות"></sw-kpi>
        </div>
        <div class="fav">
          ${d.map(t=>l`<sw-camera-tile name=${t.name} state=${t.state} scene=${ne[t.id]??"lobby"} @click=${()=>g(`/live/cameras/${t.id}`)}></sw-camera-tile>`)}
        </div>
        <div class="row2">
          <sw-card heading="אחסון">
            <div class="donut">
              <svg viewBox="0 0 84 84" role="img" aria-label="אחסון בשימוש 68%">
                ${O`<circle cx="42" cy="42" r=${s} fill="none" stroke="var(--sw-surface-3)" stroke-width="9" />
                <circle cx="42" cy="42" r=${s} fill="none" stroke="var(--sw-accent)" stroke-width="9" stroke-linecap="round" stroke-dasharray=${`${i*r} ${i}`} transform="rotate(-90 42 42)" />
                <text x="42" y="47" text-anchor="middle" font-size="15" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">68%</text>`}
              </svg>
              <div class="txt">
                <div class="big">${oe("1.3 TB מתוך 1.9 TB")}</div>
                <div class="bar"><i></i></div>
                <div class="muted">הקלטה ישנה ביותר ≈ 11 ימים (נמדד) · overwrite פעיל</div>
              </div>
            </div>
          </sw-card>
          <sw-card heading="בריאות האתרים">
            ${A.map(t=>l`<div class="hrow"><span>${t.name}<div class="muted">${t.online}/${t.cameras} מצלמות · ${t.alerts} התראות</div></span><span class="status"><i style="--c:${t.health==="live"?"var(--sw-live)":t.health==="offline"?"var(--sw-danger)":"var(--sw-stale)"}"></i>${t.health==="live"?"מחובר":t.health==="offline"?"מנותק":"חלקי"}</span></div>`)}
            ${de.slice(0,2).map(t=>l`<div class="hrow"><span>${t.name}<div class="muted">${t.detail}</div></span><span class="status"><i style="--c:${t.state==="live"?"var(--sw-live)":"var(--sw-stale)"}"></i>${t.state==="live"?"מחובר":"לא רענן"}</span></div>`)}
          </sw-card>
        </div>
        <div class="row3">
          <sw-card fill heading="אירועים אחרונים">
            <a slot="actions" class="seeall" href="#/investigate/events">הצג הכל</a>
            ${S.slice(0,5).map(t=>l`<div class="ev" role="link" tabindex="0" @click=${()=>g("/investigate/events")} @keydown=${f=>{(f.key==="Enter"||f.key===" ")&&(f.preventDefault(),g("/investigate/events"))}}>
                ${t.type==="offline"||t.type==="door"?l`<div class="none"><sw-icon name=${t.type==="offline"?"offline":"door"} size=${14}></sw-icon></div>`:l`<sw-scene kind=${$e[t.camera]??"lobby"}></sw-scene>`}
                <div class="txt"><b style="--tone:${be[t.type]}"><i></i>${ce[t.type]}</b><small>${t.camera} · ${t.floor}</small></div>
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
    `}};c.styles=[ve,ue,j`
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
  `];h([m()],c.prototype,"cams",2);h([m()],c.prototype,"recorder",2);h([m()],c.prototype,"sites",2);h([m()],c.prototype,"summary",2);h([m()],c.prototype,"summaryDenied",2);h([m()],c.prototype,"recent",2);h([m()],c.prototype,"storage",2);h([m()],c.prototype,"health",2);h([m()],c.prototype,"raw",2);h([m()],c.prototype,"tz",2);h([m()],c.prototype,"now",2);h([m()],c.prototype,"loaded",2);h([m()],c.prototype,"loadFailed",2);c=h([pe("live-overview")],c);export{c as LiveOverview};
//# sourceMappingURL=live-overview-C1zsrlky.js.map
