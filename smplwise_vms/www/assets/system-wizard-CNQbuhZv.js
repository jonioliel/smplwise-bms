import{a as z,S as _,uO as S,uP as T,i as c,uQ as x,uR as E,T as $,uS as R,j as P,uT as b,uU as y,A as r,e as t,uV as h,uW as v,aw as C,l as D,uX as N,uY as A,uZ as O,rx as L,C as j,E as V,G as f,H as I}from"./index-Cke5lP-r.js";import{o as U}from"./architect-request-dialog-C_IMRjRg.js";import"./nvr-connection-form-vLITk9J_.js";import"./sw-logo-art-Va6y_cIM.js";import"./frigate-control-BGtd89T_.js";import"./recorders-BZ3NdlEv.js";import"./nvr-h264-preset-CWl-CnDx.js";var q=Object.defineProperty,X=Object.getOwnPropertyDescriptor,u=(s,a,e,i)=>{for(var n=i>1?void 0:i?X(a,e):a,l=s.length-1,o;l>=0;l--)(o=s[l])&&(n=(i?o(a,e,n):o(n))||n);return i&&n&&q(a,e,n),n};function H(s){window.dispatchEvent(new CustomEvent("sw-setup-state",{detail:b(s)}))}const M={done:"check",todo:"info",failed:"warning",skipped:"minus",not_applicable:"minus"},Y={live:"נבדק מול המכשיר",background:"לפי עבודות הרקע של המערכת",local:"לפי בסיס הנתונים של המערכת"},k=new Set(["no_floor","no_plan"]);function w(s){return s.replace(/(^|[^\w\u200E])([+-]\d)/g,"$1‎$2")}function m(s){if(!s)return"";const a=new Date(s);return Number.isNaN(a.getTime())?String(s):a.toLocaleString("he-IL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}let p=class extends z{constructor(){super(...arguments),this.bubbleSkin=new _(this),this.data=null,this.error="",this.busy=new Set,this.notes={},this.demoPlaced=!1,this.stopDismissal=null}connectedCallback(){super.connectedCallback(),this.stopDismissal=S(()=>this.requestUpdate()),N()||T(),this.load(!0)}disconnectedCallback(){this.stopDismissal?.(),this.stopDismissal=null,super.disconnectedCallback()}set(s){this.data=s,this.error="",c()&&H(s)}async load(s=!1){if(!c()){this.set(x(this.demoPlaced));return}try{this.set(await E())}catch(a){this.error=$(a);return}if(s)for(const a of this.data?.steps??[])a.source==="background"&&a.status!=="not_applicable"&&this.check(a.id,!0)}async check(s,a=!1){if(!this.busy.has(s)){this.busy=new Set(this.busy).add(s),this.notes={...this.notes,[s]:""};try{c()?this.merge(await R(s),s):(await new Promise(e=>setTimeout(e,500)),s==="camera"&&(this.demoPlaced=!0),this.set(x(this.demoPlaced,s)))}catch(e){const i=e instanceof P&&e.status===429;a&&i||(this.notes={...this.notes,[s]:$(e)})}finally{const e=new Set(this.busy);e.delete(s),this.busy=e,!e.size&&c()&&this.load(!1)}}}merge(s,a){const e=s.steps.find(d=>d.id===a);if(!this.data||!e){this.set(s);return}const i=this.data.steps.map(d=>d.id===a?e:d),n=i.filter(d=>d.status!=="not_applicable"),l=n.filter(d=>d.status==="done").length,o=s.installation??this.data.installation,g=b({steps:i,installation:o});this.set({...this.data,steps:i,done:l,total:n.length,ready:g.ready,installation:o,next:g.next,checked_at:s.checked_at,checked:a})}checkAll(){for(const s of this.data?.steps??[])s.status!=="not_applicable"&&this.check(s.id)}jump(s){this.renderRoot.querySelector(`[data-step="${s}"]`)?.scrollIntoView({behavior:"smooth",block:"start"})}renderRail(s){return t`<ol class="rail" aria-label="שלבי ההתקנה" data-wizard-rail>
      ${s.steps.map(a=>t`<li class=${a.status} data-rail-step=${a.id} data-status=${a.status}>
        <button type="button" @click=${()=>this.jump(a.id)} aria-label=${`${a.index}. ${a.title}: ${y[a.status]}`}>
          <span class="dot">${a.status==="done"?t`<sw-icon name="check" size=${13}></sw-icon>`:a.status==="failed"?"!":a.index}</span>
          <span class="lbl">${a.title}${h(a)?t` <small class="opt">· ${v.optional}</small>`:r}</span>
        </button>
      </li>`)}
    </ol>`}renderSummary(s){const a=s.installation;return t`${a&&!a.supported?t`<div class="problem failed" role="alert" data-wizard-unsupported=${a.reason??""}>
          <sw-icon name="warning" size=${16}></sw-icon>
          <div><b>${a.message??""}</b><span>מה עושים: ${a.action??""}</span></div>
        </div>`:r}${this.renderProgress(s)}`}renderProgress(s){const a=s.steps.filter(o=>o.status==="not_applicable").length,e=b(s),i=s.steps.filter(o=>h(o)&&o.status!=="not_applicable"&&o.status!=="done").length;if(e.ready&&s.mode==="ha_only")return t`<div class="summary ready" role="status" data-wizard-ready data-wizard-mode="ha_only">
        <span class="big"><sw-icon name="check" size=${22}></sw-icon></span>
        <div class="txt"><b>מוכן לעבודה</b><span>כל ${e.total} השלבים הנדרשים עברו · ${a} דולגו (מצב ללא NVR)${i?` · ${i} אופציונליים`:""} · נבדק ${m(s.checked_at)}</span></div>
        <div class="go">
          <sw-button size="sm" variant="primary" icon="map" @click=${()=>window.location.hash="#/explore/sites"}>למפה</sw-button>
          <sw-button size="sm" icon="bolt" @click=${()=>window.location.hash="#/devices/building"}>לחשמל והתקנים</sw-button>
        </div>
      </div>`;if(e.ready)return t`<div class="summary ready" role="status" data-wizard-ready>
        <span class="big"><sw-icon name="check" size=${22}></sw-icon></span>
        <div class="txt"><b>מוכן לעבודה</b><span>${a||i?`כל ${e.total} השלבים הנדרשים עברו${a?` · ${a} דולגו`:""}${i?` · ${i} אופציונליים נותרו`:""}`:"כל ששת השלבים עברו"} · נבדק ${m(s.checked_at)}</span></div>
        <div class="go">
          <sw-button size="sm" variant="primary" icon="live" @click=${()=>window.location.hash="#/live/wall"}>לכל המצלמות</sw-button>
          <sw-button size="sm" icon="map" @click=${()=>window.location.hash="#/explore/sites"}>למפה</sw-button>
          <sw-button size="sm" icon="list" @click=${()=>window.location.hash="#/investigate/events"}>לאירועים</sw-button>
        </div>
      </div>`;const n=s.steps.find(o=>o.id===e.next),l=s.steps.filter(o=>o.status==="failed").length;return t`<div class="summary" role="status" data-wizard-progress>
      <span class="count"><b>${e.done}</b>/${e.total}</span>
      <div class="txt"><b>${e.done} מתוך ${e.total} שלבים הושלמו${l?` · ${l} נכשלו`:""}${a?` · ${a} דולגו${s.mode==="ha_only"?" (מצב ללא NVR)":""}`:""}</b>${n?t`<span>השלב הבא: ${n.index}. ${n.title} — ${w(n.summary)}</span>`:r}</div>
      ${n?t`<div class="go"><sw-button size="sm" variant="primary" @click=${()=>this.jump(n.id)}>לשלב ${n.index}</sw-button></div>`:r}
      ${this.renderRestore()}
    </div>`}renderRestore(){return A()?t`<div class="go"><sw-button size="sm" variant="ghost" icon="info" data-setup-hint-restore @click=${()=>void O()}>${v.show}</sw-button></div>`:r}renderStep(s){const a=this.busy.has(s.id),e=this.notes[s.id];return t`<section class="step ${s.status}" data-step=${s.id} data-status=${s.status} data-source=${s.source} aria-labelledby=${`h-${s.id}`}>
      <header>
        <span class="num">${s.index}</span>
        <div class="head">
          <h3 id=${`h-${s.id}`}>${s.title}${h(s)?t` <small class="opt" data-step-optional>(${v.optional})</small>`:r}</h3>
          <span class="meta">${Y[s.source]}${s.checked_at?` · ${m(s.checked_at)}`:""}</span>
        </div>
        <span class="pill ${s.status}" data-step-status><sw-icon name=${M[s.status]} size=${13}></sw-icon>${s.status_label??y[s.status]}</span>
        ${s.status==="not_applicable"?r:t`<sw-button size="sm" icon="refresh" ?disabled=${a} data-check=${s.id} @click=${()=>this.check(s.id)}>${a?"בודק…":"בדוק שוב"}</sw-button>`}
      </header>
      <p class="sum" data-step-summary>${w(s.summary)}</p>
      ${s.problem?t`<div class="problem ${s.status}" role=${s.status==="failed"?"alert":"note"} data-step-problem=${s.problem.code}>
            <sw-icon name=${s.status==="failed"?"warning":"info"} size=${16}></sw-icon>
            <div>
              <b>${w(s.problem.message)}</b>
              <span data-step-action>מה עושים: ${w(s.problem.action)}</span>
              ${s.problem.link||s.id==="floor"&&k.has(s.problem.code)?t`<span class="links">${s.problem.link?t`<a href=${s.problem.link.href} data-step-link>${s.problem.link.label} ‹</a>`:r}${s.id==="floor"&&k.has(s.problem.code)?t`<button type="button" class="linkbtn" data-architect-request @click=${()=>U()}>בקשה לאדריכל ‹</button>`:r}</span>`:r}
            </div>
          </div>`:r}
      ${e?t`<div class="note" data-step-note>${e}</div>`:r}
      ${s.id==="nvr"&&(s.status==="todo"||s.status==="failed")&&c()&&C("system.configure")?t`<div class="conn" data-wizard-nvr-form><nvr-connection-form context="wizard" @nvr-connection-saved=${()=>void this.load(!1)} @nvr-connection-removed=${()=>void this.load(!1)}></nvr-connection-form></div>`:r}
      ${s.warnings.length?t`<ul class="warnings" data-step-warnings>${s.warnings.map(i=>t`<li data-warning=${i.code}><sw-icon name="info" size=${13}></sw-icon><span>${w(i.message)}${i.link?t` <a href=${i.link.href}>${i.link.label} ‹</a>`:r}</span></li>`)}</ul>`:r}
      ${s.facts.length?t`<dl class="facts" data-step-facts>${s.facts.map(i=>t`<div class="fact"><dt>${i.label}</dt><dd class=${i.tone}>${w(i.value)}</dd></div>`)}</dl>`:r}
      <div class="foot"><a href=${s.settings_link.href} data-settings-link>${s.settings_link.label} ‹</a></div>
    </section>`}render(){const s=this.data,a=this.busy.size>0,e=s?.mode==="ha_only"?"מצב ללא NVR · התקנה ‹ NVR ‹ תשתית המערכת ‹ go2rtc ‹ קומה · שלב המצלמה מדולג":"התקנה ‹ NVR ‹ תשתית המערכת ‹ go2rtc ‹ קומה ‹ מצלמה";return t`<sw-page heading="אשף התקנה" subheading=${`${e} · הבדיקות קוראות בלבד מהמכשירים${c()?"":" · נתוני הדגמה"}`}>
      <sw-button slot="actions" icon="refresh" ?disabled=${!s||a} data-check-all @click=${()=>this.checkAll()}>${a?"בודק…":"בדוק הכול"}</sw-button>
      ${this.error?t`<sw-state-panel state="error" heading="מצב ההתקנה לא נטען" hint=${this.error}></sw-state-panel>`:r}
      ${s?t`<div class="wrap" data-wizard>
            ${this.renderRail(s)}
            ${this.renderSummary(s)}
            ${s.steps.map(i=>this.renderStep(i))}
            ${!c()||D("site.content.configure")?t`<sw-card heading="שלב רשות · בניינים ומיפוי" subheading="כשבאותה מערכת בית יש כמה בניינים: איזה שם שייך לאיזה בניין. אפשר גם אחר כך, מהגדרות ‹ בניינים ומיפוי." data-wizard-mapping><system-mapping compact></system-mapping></sw-card>`:r}
            <p class="hint">סטיית שעון עד ${s.thresholds.drift_ok_s} שנ׳ תקינה, עד ${s.thresholds.drift_fail_s} שנ׳ אזהרה, מעבר לזה השלב נכשל. "בדוק שוב" אפשרי פעם ב־${s.check_every_s} שנ׳ לכל שלב; בדיקה מול מכשיר מוצגת ${Math.round(s.live_ttl_s/60)} דקות.</p>
          </div>`:this.error?r:t`<sw-state-panel state="loading" heading="קורא את מצב ההתקנה…"></sw-state-panel>`}
    </sw-page>`}};p.styles=[L,V`
    .wrap {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-inline-size: 920px;
    }
    .rail {
      list-style: none;
      margin: 0;
      padding: 14px 16px;
      display: flex;
      gap: 4px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      overflow-x: auto;
      scrollbar-width: none;
    }
    .rail li {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      align-items: flex-start;
      position: relative;
    }
    .rail li:not(:last-child)::after {
      content: '';
      position: absolute;
      inset-inline-start: calc(50% + 20px);
      inset-inline-end: calc(-50% + 20px);
      inset-block-start: 15px;
      block-size: 3px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-border);
    }
    .rail li.done:not(:last-child)::after {
      background: var(--sw-live);
    }
    .rail button {
      all: unset;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      inline-size: 100%;
      text-align: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .rail button:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
      border-radius: var(--sw-r-xs);
    }
    .rail button {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      transition: transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    .rail button:active {
      transform: scale(var(--sw-press-scale));
    }
    .dot {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-text-2);
      position: relative;
      z-index: 1;
      box-shadow: var(--sw-shadow-1);
    }
    .done .dot {
      background: var(--sw-live);
      border-color: var(--sw-live);
      color: var(--sw-text-inverse);
    }
    .failed .dot {
      background: var(--sw-danger);
      border-color: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .todo .dot {
      border-color: var(--sw-warning);
      color: var(--sw-warning);
    }
    .lbl {
      overflow: hidden;
      text-overflow: ellipsis;
      max-inline-size: 100%;
    }
    .opt {
      font-weight: 400;
      opacity: 0.75;
      font-size: 0.85em;
    }
    /* R5-SYSTEM-297: the verdict is the hero of the wizard - the large radius, shadow 2, a 20/800 line, a 48 px status disc */
    .summary {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      flex-wrap: wrap;
    }
    .summary.ready {
      background: var(--sw-live-soft);
      border-color: var(--sw-live);
    }
    .summary .big {
      display: grid;
      place-items: center;
      inline-size: 48px;
      block-size: 48px;
      border-radius: 50%;
      background: var(--sw-live);
      color: var(--sw-text-inverse);
      box-shadow: var(--sw-shadow-2);
    }
    .summary .count {
      font-size: var(--sw-fs-xl);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .summary .count b {
      font-size: var(--sw-fs-3xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.03em;
      color: var(--sw-heading, var(--sw-text));
    }
    .summary .txt {
      flex: 1;
      min-inline-size: 200px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: var(--sw-fs-md);
    }
    .summary .txt b {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--sw-text));
    }
    .summary .txt span {
      color: var(--sw-text-2);
    }
    .summary .go {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    /* R5-SYSTEM-297: a step is a card of the ladder (the large radius, shadow 2 + the light line, a 17/700 title); its state stays a
       filled edge and a filled pill (status as a field) */
    /* loop 2 (impeccable detect: "side-tab accent border" on the 5 px edge): the status moves off the card edge into the step
       disc, a FILLED field (success / danger / warning soft + the dark ink), beside the filled status pill */
    .step {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-margin-block-start: 12px;
    }
    .step.done .num {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .step.failed .num {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .step.todo .num {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .step header {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .num {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 50%;
      background: var(--sw-surface-3);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      box-shadow: inset 0 1px 0 var(--sw-highlight), var(--sw-shadow-1);
    }
    .head {
      flex: 1;
      min-inline-size: 160px;
      display: flex;
      flex-direction: column;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.01em;
      color: var(--sw-heading, var(--sw-text));
    }
    .meta {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .pill.done {
      background: var(--sw-live-soft);
      color: var(--sw-success);
    }
    .pill.failed {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .pill.todo {
      background: var(--sw-warning-soft);
      color: var(--sw-warning);
    }
    .pill.not_applicable {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .step.not_applicable {
      opacity: 0.85;
    }
    .problem.not_applicable {
      background: var(--sw-surface-2);
    }
    .sum {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    .problem {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      font-size: var(--sw-fs-sm);
      line-height: 1.55;
    }
    .problem.failed {
      background: var(--sw-danger-soft);
    }
    .problem sw-icon {
      flex: none;
      margin-block-start: 2px;
      color: var(--sw-warning);
    }
    .problem.failed sw-icon {
      color: var(--sw-danger);
    }
    .problem div {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    a {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      text-decoration: none;
    }
    @media (hover: hover) and (pointer: fine) {
      a:hover,
      .linkbtn:hover {
        text-decoration: underline;
      }
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 18px;
    }
    .linkbtn {
      all: unset;
      cursor: pointer;
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .linkbtn:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
      border-radius: var(--sw-r-2xs);
    }
    /* a finger needs 44px */
    @media (pointer: coarse) {
      .links a,
      .linkbtn {
        display: inline-flex;
        align-items: center;
        min-block-size: 44px;
      }
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .conn {
      padding-block: 4px;
      min-inline-size: 0;
    }
    .warnings {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .warnings li {
      display: flex;
      gap: 6px;
      align-items: flex-start;
      overflow-wrap: anywhere;
    }
    .warnings sw-icon {
      flex: none;
      color: var(--sw-warning);
      margin-block-start: 1px;
    }
    .facts {
      margin: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 24px;
    }
    .fact {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .fact dt {
      color: var(--sw-text-3);
    }
    .fact dd {
      margin: 0;
      color: var(--sw-text-2);
      text-align: end;
      overflow-wrap: anywhere;
      min-inline-size: 0;
    }
    /* loop 2: a toned fact value is a FILLED pill (status as a field), not a coloured word on white */
    dd.ok,
    dd.warn,
    dd.err {
      display: inline-flex;
      align-items: center;
      justify-self: end;
      min-block-size: 24px;
      padding: 1px 10px;
      border-radius: var(--sw-r-pill);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.4;
    }
    dd.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    dd.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    dd.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .foot {
      font-size: var(--sw-fs-xs);
    }
    .hint {
      margin: 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .rail {
        padding: 10px 8px;
      }
      .lbl {
        display: none;
      }
      .rail li:not(:last-child)::after {
        inset-inline-start: calc(50% + 16px);
        inset-inline-end: calc(-50% + 16px);
      }
      .facts {
        grid-template-columns: 1fr;
      }
      .step {
        padding: 12px;
      }
      .step header sw-button {
        margin-inline-start: auto;
      }
    }
  `,j];u([f()],p.prototype,"data",2);u([f()],p.prototype,"error",2);u([f()],p.prototype,"busy",2);u([f()],p.prototype,"notes",2);p=u([I("system-wizard")],p);export{p as SystemWizard,H as announceSetup};
//# sourceMappingURL=system-wizard-CNQbuhZv.js.map
