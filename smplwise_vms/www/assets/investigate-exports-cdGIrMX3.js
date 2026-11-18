import{i as y,aL as k,eO as _,a3 as v,a as z,n as m,cv as g,d as b,A as l,b as a,Y as $,fm as D,aU as T,g as A,j as u,k as E}from"./index-CkOaAZ0k.js";import{l as P,c as I,d as S,f as x,e as q,a as C}from"./exports-DvTa6m0q.js";import{I as O}from"./investigate-r5-css-CNcHuIOU.js";import{t}from"./investigate-B-MtmE0p.js";import"./sw-logo-art-MaHPMZFI.js";import"./bytes-QYSxC3WX.js";var J=Object.defineProperty,L=Object.getOwnPropertyDescriptor,p=(s,r,n,o)=>{for(var e=o>1?void 0:o?L(r,n):r,i=s.length-1,d;i>=0;i--)(d=s[i])&&(e=(o?d(r,n,e):d(e))||e);return o&&e&&J(r,n,e),e};const h={queued:t("ממתין"),running:t("מוריד"),done:t("הושלם"),partial:t("חלקי"),failed:t("נכשל"),cancelled:t("בוטל"),interrupted:t("הופסק"),paused_disk_full:t("מושהה · אין מקום בדיסק")},N={queued:"neutral",running:"live",done:"recorded",partial:"partial",failed:"error",cancelled:"unknown",interrupted:"stale",paused_disk_full:"stale"},V={failed:"bad",interrupted:"warn",partial:"warn",paused_disk_full:"warn"},f=["queued","running","paused_disk_full"],M=["failed","interrupted","partial","paused_disk_full"];let c=class extends y{constructor(){super(...arguments),this.bubbleSkin=new k(this),this.jobs=null,this.ffmpeg=!0,this.error="",this.forbidden=!1,this.confirmDelete=null,this.busy=!1,this.poller=new _(this),this.pausedPolledAt=0}connectedCallback(){super.connectedCallback(),v()&&(this.load(),this.poller.every("jobs",3e3,()=>this.poll()))}async load(){try{const s=await P();this.jobs=s.jobs,this.ffmpeg=s.ffmpeg,this.error="",this.forbidden=!1}catch(s){this.forbidden=s instanceof z&&s.status===403,this.error=m(s)}}poll(){if(this.jobs?.some(s=>s.state==="queued"||s.state==="running"))return this.load();if(this.jobs?.some(s=>s.state==="paused_disk_full")&&Date.now()-this.pausedPolledAt>=3e4)return this.pausedPolledAt=Date.now(),this.load()}range(s,r,n){const o=new Date(s),e=new Date(r),i={timeZone:n,seconds:!0},d=g(o,{timeZone:n}),w=g(e,{timeZone:n});return d===w?`${d} · ${b(o,i)}–${b(e,i)}`:`${d} ${b(o,i)} – ${w} ${b(e,i)}`}async cancel(s){try{await I(s.id),await this.load()}catch(r){this.error=m(r)}}async removeJob(s){this.busy=!0;try{await S(s.id),this.confirmDelete=null,await this.load()}catch(r){this.error=m(r)}finally{this.busy=!1}}renderJob(s){const r=Math.round((s.progress??0)*100),n=s.files.filter(i=>i.state==="downloaded"||i.state==="remuxed").length,o=s.state==="running",e=s.state==="failed"?"fail":s.state==="partial"?"partial":s.state==="done"?"done":"";return a`<div class="job" data-export-job data-job-state=${s.state} data-tone=${V[s.state]??l}>
      <div>
        <div class="title"><strong>${s.camera_name}</strong><sw-badge kind=${N[s.state]} label=${h[s.state]}></sw-badge></div>
        <div class="range"><span class="ltr">${this.range(s.requested_from,s.requested_to,s.timezone)}</span></div>
        <div class="meta">${t("{done} מתוך {total} קבצים ירדו",{done:n,total:s.files.length})} · ${t("משוער {size}",{size:x(s.estimate_bytes)})}${s.actual_from?a` · ${t("בפועל")} <span class="ltr">${this.range(s.actual_from,s.actual_to??s.actual_from,s.timezone)}</span>`:l}</div>
        ${s.error?a`<div class="meta" style="color:var(--sw-danger-text)">${s.error}</div>`:l}
        ${s.note&&(s.state==="done"||s.state==="partial")?a`<div class="meta">${s.note}</div>`:l}
        ${s.sha256?a`<div class="meta"><span class="ltr" title=${`sha256 ${s.sha256}`}>sha256 ${s.sha256.slice(0,12)}… · ${s.container}</span></div>`:l}
      </div>
      <div>
        <div class="pct"><b>${r}%</b><span>${o?x(s.files.reduce((i,d)=>i+d.bytes,0)):h[s.state]}</span></div>
        <div class="bar ${e}" role="progressbar" aria-label=${`${s.camera_name} · ${h[s.state]}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${r}><i style="inline-size:${r}%"></i></div>
      </div>
      <div class="actions">
        ${s.download_ready?a`<a href=${q(s.id)} download=${s.output_name??""}><sw-button size="sm" variant="primary" icon="download">${t("הורדה")}</sw-button></a><a href=${C(s.id)} target="_blank" rel="noopener"><sw-button size="sm" variant="ghost" icon="list">${t("מניפסט")}</sw-button></a>`:l}
        ${f.includes(s.state)?a`<sw-button size="sm" variant="ghost" icon="close" data-export-cancel @click=${()=>this.cancel(s)}>${t("בטל")}</sw-button>`:a`<sw-button size="sm" variant="ghost" icon="trash" data-export-delete @click=${()=>this.confirmDelete=s}>${t("מחק")}</sw-button>`}
      </div>
    </div>`}renderApi(){if(this.forbidden&&!this.jobs)return a`<sw-state-panel state="forbidden" hint=${t("ייצוא והורדה דורשים הרשאת ייצוא וידאו.")}></sw-state-panel>`;if(this.error&&!this.jobs)return a`<sw-state-panel state="error" hint=${this.error} actionLabel=${t("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;if(!this.jobs)return a`<sw-state-panel state="loading"></sw-state-panel>`;if(!this.jobs.length)return a`<sw-state-panel icon="download" state="empty" heading=${t("אין עבודות ייצוא")} hint=${t("פתח הקלטה, בחר טווח ולחץ ייצוא.")}><div style="margin-block-start:10px"><sw-button variant="primary" icon="history" @click=${()=>$("/investigate/playback")}>${t("להקלטות")}</sw-button></div></sw-state-panel>`;const s=this.jobs.filter(e=>f.includes(e.state)),r=this.jobs.filter(e=>!f.includes(e.state)),n=this.jobs.filter(e=>M.includes(e.state)).length,o=this.jobs.filter(e=>e.state==="done").length;return a`
      <div class="summary" data-export-summary>
        <div class="r5-well"><span class="r5-num sm">${s.length}</span><span class="r5-sub">${t("בתהליך")}</span></div>
        <div class="r5-well"><span class="r5-num sm">${o}</span><span class="r5-sub">${t("הושלמו במלואם")}</span></div>
        <div class="r5-well" data-tone=${n?"warn":l}><span class="r5-num sm">${n}</span><span class="r5-sub">${t("דורשים תשומת לב")}</span></div>
      </div>
      ${this.ffmpeg?l:a`<div class="warn">${t("ffmpeg לא זמין בשרת: קבצי הייצוא נמסרים במיכל המקורי של המקליט (Hikvision PS, ניתן לניגון ב־VLC) ולא נחתכים לטווח המדויק.")}</div>`}
      ${this.error?a`<div class="warn" role="alert">${this.error}</div>`:l}
      <div class="list" data-export-list>
        ${s.length?a`<div class="group">${t("פעילות")} <b>${s.length}</b></div>${s.map(e=>this.renderJob(e))}`:l}
        ${r.length?a`<div class="group">${t("הסתיימו")} <b>${r.length}</b></div>${r.map(e=>this.renderJob(e))}`:l}
      </div>
      <div class="foot">${t("ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר בייצוא, לא שהצילום אותנטי מאז המצלמה. הקבצים נמחקים אוטומטית אחרי תקופת השמירה שבהגדרות.")}</div>
      ${this.confirmDelete?a`<sw-dialog open heading=${t("מחיקת עבודת ייצוא")} subheading=${`${this.confirmDelete.camera_name} · ${this.range(this.confirmDelete.requested_from,this.confirmDelete.requested_to,this.confirmDelete.timezone)}`} @close=${()=>this.confirmDelete=null}>
            <div class="meta">${t("הקבצים שירדו לשרת יימחקו. ההקלטה עצמה במקליט לא נפגעת, ואפשר לייצא את הטווח שוב.")}</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.confirmDelete=null}>${t("ביטול")}</sw-button>
            <sw-button slot="footer" variant="danger" icon="trash" data-export-delete-confirm ?disabled=${this.busy} @click=${()=>this.removeJob(this.confirmDelete)}>${t("מחק")}</sw-button>
          </sw-dialog>`:l}
    `}renderDemo(){return a`
      <div class="list">
        ${D.map(s=>a`<div class="job" data-state=${s.status.startsWith("נכשל")?"fail":s.progress===100?"done":"run"}>
            <div><div class="title"><strong>${s.title}</strong></div><div class="meta">${s.size} · ${s.hash}</div></div>
            <div><div class="pct"><b>${s.progress}%</b><span>${s.status}</span></div><div class="bar ${s.status.startsWith("נכשל")?"fail":""}"><i style="inline-size:${s.progress}%"></i></div></div>
            <div class="actions">
              ${s.progress===100?a`<sw-button size="sm" icon="download">${t("הורדה")}</sw-button>`:s.status.startsWith("נכשל")?a`<sw-button size="sm" icon="refresh">${t("נסה שוב")}</sw-button>`:a`<sw-button size="sm" variant="ghost" icon="close">${t("בטל")}</sw-button>`}
            </div>
          </div>`)}
      </div>
      <div class="foot">${t("ההורדה נבדקת מול ההרשאה בזמן היצירה, הביצוע וההורדה. sha256 מוכיח שהקובץ תואם ל־hash שנשמר, לא שהצילום אותנטי מאז המצלמה.")}</div>
    `}render(){const s=v();return a`
      <sw-page heading=${t("ייצוא והורדות")} subheading=${s?t("עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה"):t("עבודות עמידות · ייצוא חלקי אינו מסומן כהצלחה מלאה · נתוני הדגמה")}>
        <sw-button slot="actions" variant="primary" icon="download" @click=${()=>$("/investigate/playback")}>${t("ייצוא חדש")}</sw-button>
        ${s?this.renderApi():this.renderDemo()}
      </sw-page>
    `}};c.styles=[A`
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
  `,T,O];p([u()],c.prototype,"jobs",2);p([u()],c.prototype,"ffmpeg",2);p([u()],c.prototype,"error",2);p([u()],c.prototype,"forbidden",2);p([u()],c.prototype,"confirmDelete",2);p([u()],c.prototype,"busy",2);c=p([E("investigate-exports")],c);export{c as InvestigateExports};
