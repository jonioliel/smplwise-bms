import{a as $,S as y,i as v,j as k,T as b,z as f,n as u,A as o,e,ak as g,tx as _,C as z,E as D,G as p,H as T}from"./index-BGBybS0o.js";import{l as E,b as A,d as I,f as x,a as C,g as S}from"./exports-Dw9ZpYsr.js";import{I as P}from"./investigate-r5-css-BUzOeMQH.js";import"./sw-logo-art-Va6y_cIM.js";var q=Object.defineProperty,N=Object.getOwnPropertyDescriptor,c=(s,a,r,n)=>{for(var t=n>1?void 0:n?N(a,r):a,i=s.length-1,l;i>=0;i--)(l=s[i])&&(t=(n?l(a,r,t):l(t))||t);return n&&t&&q(a,r,t),t};const m={queued:"ממתין",running:"מוריד",done:"הושלם",partial:"חלקי",failed:"נכשל",cancelled:"בוטל",interrupted:"הופסק",paused_disk_full:"מושהה · אין מקום בדיסק"},O={queued:"neutral",running:"live",done:"recorded",partial:"partial",failed:"error",cancelled:"unknown",interrupted:"stale",paused_disk_full:"stale"},J={failed:"bad",interrupted:"warn",partial:"warn",paused_disk_full:"warn"},h=["queued","running","paused_disk_full"],V=["failed","interrupted","partial","paused_disk_full"];let d=class extends ${constructor(){super(...arguments),this.bubbleSkin=new y(this),this.jobs=null,this.ffmpeg=!0,this.error="",this.forbidden=!1,this.confirmDelete=null,this.busy=!1,this.pausedPolledAt=0}connectedCallback(){super.connectedCallback(),v()&&(this.load(),this.timer=window.setInterval(()=>this.poll(),3e3))}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.timer)}async load(){try{const s=await E();this.jobs=s.jobs,this.ffmpeg=s.ffmpeg,this.error="",this.forbidden=!1}catch(s){this.forbidden=s instanceof k&&s.status===403,this.error=b(s)}}poll(){this.jobs?.some(s=>s.state==="queued"||s.state==="running")?this.load():this.jobs?.some(s=>s.state==="paused_disk_full")&&Date.now()-this.pausedPolledAt>=3e4&&(this.pausedPolledAt=Date.now(),this.load())}range(s,a,r){const n=new Date(s),t=new Date(a),i={timeZone:r,seconds:!0},l=f(n,{timeZone:r}),w=f(t,{timeZone:r});return l===w?`${l} · ${u(n,i)}–${u(t,i)}`:`${l} ${u(n,i)} – ${w} ${u(t,i)}`}async cancel(s){try{await A(s.id),await this.load()}catch(a){this.error=b(a)}}async removeJob(s){this.busy=!0;try{await I(s.id),this.confirmDelete=null,await this.load()}catch(a){this.error=b(a)}finally{this.busy=!1}}renderJob(s){const a=Math.round((s.progress??0)*100),r=s.files.filter(i=>i.state==="downloaded"||i.state==="remuxed").length,n=s.state==="running",t=s.state==="failed"?"fail":s.state==="partial"?"partial":s.state==="done"?"done":"";return e`<div class="job" data-export-job data-job-state=${s.state} data-tone=${J[s.state]??o}>
      <div>
        <div class="title"><strong>${s.camera_name}</strong><sw-badge kind=${O[s.state]} label=${m[s.state]}></sw-badge></div>
        <div class="range"><span class="ltr">${this.range(s.requested_from,s.requested_to,s.timezone)}</span></div>
        <div class="meta">${r} מתוך ${s.files.length} קבצים ירדו · משוער ${x(s.estimate_bytes)}${s.actual_from?e` · בפועל <span class="ltr">${this.range(s.actual_from,s.actual_to??s.actual_from,s.timezone)}</span>`:o}</div>
        ${s.error?e`<div class="meta" style="color:var(--sw-danger-text)">${s.error}</div>`:o}
        ${s.note&&(s.state==="done"||s.state==="partial")?e`<div class="meta">${s.note}</div>`:o}
        ${s.sha256?e`<div class="meta"><span class="ltr" title=${`sha256 ${s.sha256}`}>sha256 ${s.sha256.slice(0,12)}… · ${s.container}</span></div>`:o}
      </div>
      <div>
        <div class="pct"><b>${a}%</b><span>${n?x(s.files.reduce((i,l)=>i+l.bytes,0)):m[s.state]}</span></div>
        <div class="bar ${t}" role="progressbar" aria-label=${`${s.camera_name} · ${m[s.state]}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${a}><i style="inline-size:${a}%"></i></div>
      </div>
      <div class="actions">
        ${s.download_ready?e`<a href=${C(s.id)} download=${s.output_name??""}><sw-button size="sm" variant="primary" icon="download">הורדה</sw-button></a><a href=${S(s.id)} target="_blank" rel="noopener"><sw-button size="sm" variant="ghost" icon="list">מניפסט</sw-button></a>`:o}
        ${h.includes(s.state)?e`<sw-button size="sm" variant="ghost" icon="close" data-export-cancel @click=${()=>this.cancel(s)}>בטל</sw-button>`:e`<sw-button size="sm" variant="ghost" icon="trash" data-export-delete @click=${()=>this.confirmDelete=s}>מחק</sw-button>`}
      </div>
    </div>`}renderApi(){if(this.forbidden&&!this.jobs)return e`<sw-state-panel state="forbidden" hint="ייצוא והורדה דורשים הרשאת ייצוא וידאו."></sw-state-panel>`;if(this.error&&!this.jobs)return e`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.jobs)return e`<sw-state-panel state="loading"></sw-state-panel>`;if(!this.jobs.length)return e`<sw-state-panel icon="download" state="empty" heading="אין עבודות ייצוא" hint="פתח הקלטה, בחר טווח ולחץ ייצוא."><div style="margin-block-start:10px"><sw-button variant="primary" icon="history" @click=${()=>g("/investigate/playback")}>להקלטות</sw-button></div></sw-state-panel>`;const s=this.jobs.filter(t=>h.includes(t.state)),a=this.jobs.filter(t=>!h.includes(t.state)),r=this.jobs.filter(t=>V.includes(t.state)).length,n=this.jobs.filter(t=>t.state==="done").length;return e`
      <div class="summary" data-export-summary>
        <div class="r5-well"><span class="r5-num sm">${s.length}</span><span class="r5-sub">בתהליך</span></div>
        <div class="r5-well"><span class="r5-num sm">${n}</span><span class="r5-sub">הושלמו במלואם</span></div>
        <div class="r5-well" data-tone=${r?"warn":o}><span class="r5-num sm">${r}</span><span class="r5-sub">דורשים תשומת לב</span></div>
      </div>
      ${this.ffmpeg?o:e`<div class="warn">ffmpeg לא זמין בשרת: קבצי הייצוא נמסרים במיכל המקורי של ה־NVR (Hikvision PS, ניתן לניגון ב־VLC) ולא נחתכים לטווח המדויק.</div>`}
      ${this.error?e`<div class="warn" role="alert">${this.error}</div>`:o}
      <div class="list" data-export-list>
        ${s.length?e`<div class="group">פעילות <b>${s.length}</b></div>${s.map(t=>this.renderJob(t))}`:o}
        ${a.length?e`<div class="group">הסתיימו <b>${a.length}</b></div>${a.map(t=>this.renderJob(t))}`:o}
      </div>
      <div class="foot">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר בייצוא, לא שהצילום אותנטי מאז המצלמה. הקבצים נמחקים אוטומטית אחרי תקופת השמירה שבהגדרות.</div>
      ${this.confirmDelete?e`<sw-dialog open heading="מחיקת עבודת ייצוא" subheading=${`${this.confirmDelete.camera_name} · ${this.range(this.confirmDelete.requested_from,this.confirmDelete.requested_to,this.confirmDelete.timezone)}`} @close=${()=>this.confirmDelete=null}>
            <div class="meta">הקבצים שירדו לשרת יימחקו. ההקלטה עצמה ב־NVR לא נפגעת, ואפשר לייצא את הטווח שוב.</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmDelete=null}>ביטול</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-export-delete-confirm ?disabled=${this.busy} @click=${()=>this.removeJob(this.confirmDelete)}>מחק</sw-button>
          </sw-dialog>`:o}
    `}renderDemo(){return e`
      <div class="list">
        ${_.map(s=>e`<div class="job" data-state=${s.status.startsWith("נכשל")?"fail":s.progress===100?"done":"run"}>
            <div><div class="title"><strong>${s.title}</strong></div><div class="meta">${s.size} · ${s.hash}</div></div>
            <div><div class="pct"><b>${s.progress}%</b><span>${s.status}</span></div><div class="bar ${s.status.startsWith("נכשל")?"fail":""}"><i style="inline-size:${s.progress}%"></i></div></div>
            <div class="actions">
              ${s.progress===100?e`<sw-button size="sm" icon="download">הורדה</sw-button>`:s.status.startsWith("נכשל")?e`<sw-button size="sm" icon="refresh">נסה שוב</sw-button>`:e`<sw-button size="sm" variant="ghost" icon="close">בטל</sw-button>`}
            </div>
          </div>`)}
      </div>
      <div class="foot">ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר, לא שהצילום אותנטי מאז המצלמה.</div>
    `}render(){const s=v();return e`
      <sw-page heading="ייצוא והורדות" subheading=${s?"עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה":"עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה · נתוני הדגמה"}>
        <sw-button slot="actions" variant="primary" icon="download" @click=${()=>g("/investigate/playback")}>ייצוא חדש</sw-button>
        ${s?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};d.styles=[D`
    /* INVREST-POLISH-2331: from a tablet up the screen takes the height the shell leaves it and never scrolls - the summary and the
       note stay put, the job list scrolls inside its own panel. A phone keeps the page scroll. */
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 0;
      min-inline-size: 0;
    }
    sw-page {
      flex: 1;
      min-block-size: 0;
    }
    @media (min-width: 768px) {
      sw-page {
        block-size: 100%;
      }
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      flex: none;
    }
    .summary .r5-well {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 10px 14px;
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
    }
    .summary .r5-well[data-tone='bad'] {
      background: var(--sw-danger-soft);
      box-shadow: none;
    }
    .summary .r5-well[data-tone='warn'] {
      background: var(--sw-warning-soft);
      box-shadow: none;
    }
    .summary .r5-sub {
      color: var(--sw-text-2);
    }
    /* the list panel: the page's primary object (radius lg, shadow 2); it scrolls in its own box */
    .list {
      flex: 0 1 auto;
      min-block-size: 0;
      overflow: auto;
      overscroll-behavior: contain;
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      padding: 4px 12px 12px;
    }
    .group {
      position: sticky;
      inset-block-start: 0;
      z-index: 1;
      background: var(--sw-surface);
      padding: 10px 4px 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
      display: flex;
      gap: 6px;
    }
    .group b {
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    /* a job is a well (tone step, rounded): what | how far | what you can do */
    .job {
      display: grid;
      grid-template-columns: minmax(0, 1fr) clamp(170px, 24%, 260px) minmax(0, auto);
      gap: var(--sw-s-3);
      align-items: center;
      padding: 12px 14px;
      margin-block-end: 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .job:last-child {
      margin-block-end: 0;
    }
    .job[data-tone='bad'] {
      background: var(--sw-danger-soft);
    }
    .job[data-tone='warn'] {
      background: var(--sw-warning-soft);
    }
    /* the demo rows' legacy tones */
    .job[data-state='fail'] {
      background: var(--sw-danger-soft);
    }
    .job[data-state='done'] {
      background: var(--sw-success-soft);
    }
    .title {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-block-end: 2px;
    }
    .title strong {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .range {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .pct {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-block-end: 6px;
    }
    .pct b {
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading);
    }
    .pct span {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      block-size: 8px;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--sw-text-3) 18%, transparent);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      border-radius: inherit;
      background: var(--sw-accent);
      transition: inline-size var(--sw-t-med) var(--sw-ease-out);
    }
    .bar.fail i {
      background: var(--sw-danger);
    }
    .bar.partial i {
      background: var(--sw-stale);
    }
    .bar.done i {
      background: var(--sw-success);
    }
    @media (prefers-reduced-motion: reduce) {
      .bar i {
        transition: none;
      }
    }
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .actions a {
      text-decoration: none;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .warn {
      font-size: var(--sw-fs-sm);
      color: var(--sw-warning-text);
      background: var(--sw-warning-soft);
      border-radius: var(--sw-r-sm);
      padding: 8px 12px;
      flex: none;
    }
    .foot {
      flex: none;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      max-inline-size: 90ch;
    }
    @media (max-width: 1023px) {
      .job {
        grid-template-columns: minmax(0, 1fr) clamp(150px, 30%, 220px);
      }
      .job .actions {
        grid-column: 1 / -1;
        justify-content: flex-start;
      }
    }
    @media (max-width: 767px) {
      .summary {
        gap: 6px;
      }
      .summary .r5-well {
        flex-direction: column;
        gap: 0;
        padding: 8px 10px;
      }
      .job {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .list {
        padding: 4px 8px 8px;
      }
    }
  `,z,P];c([p()],d.prototype,"jobs",2);c([p()],d.prototype,"ffmpeg",2);c([p()],d.prototype,"error",2);c([p()],d.prototype,"forbidden",2);c([p()],d.prototype,"confirmDelete",2);c([p()],d.prototype,"busy",2);d=c([T("investigate-exports")],d);export{d as InvestigateExports};
//# sourceMappingURL=investigate-exports-5ztujUMy.js.map
