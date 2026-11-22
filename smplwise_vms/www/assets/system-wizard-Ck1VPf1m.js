import{i as _,aL as S,fT as T,fU as E,a2 as p,fV as $,fW as R,n as y,fX as P,a as D,fY as g,dE as e,fZ as k,A as n,b as i,f_ as h,f$ as v,aA as N,a3 as A,u as C,g0 as L,g1 as O,g2 as j,aU as U,g as V,j as m,k as I}from"./index-Cwrvr-7C.js";import{o as q}from"./architect-request-dialog-CHG9Ik4m.js";import"./system-diagnostics-buildings-DTmU-UcM.js";import"./nvr-connection-form-BkwDQ-Gx.js";import{a as X}from"./settings-C0oL8AFl.js";import"./sw-logo-art-PLtEZJxU.js";import"./sw-floor-home-link-aeIJisay.js";import"./frigate-control-CrItZ085.js";import"./recorders-Dc3h3s2z.js";import"./nvr-h264-preset-DFeAC18U.js";var M=Object.defineProperty,Y=Object.getOwnPropertyDescriptor,f=(s,a,t,r)=>{for(var o=r>1?void 0:r?Y(a,t):a,d=s.length-1,l;d>=0;d--)(l=s[d])&&(o=(r?l(a,t,o):l(o))||o);return r&&o&&M(a,t,o),o};function F(s){window.dispatchEvent(new CustomEvent("sw-setup-state",{detail:g(s)}))}const H={done:"check",todo:"info",failed:"warning",skipped:"minus",not_applicable:"minus"},W={live:e("נבדק מול המכשיר"),background:e("לפי עבודות הרקע של המערכת"),local:e("לפי בסיס הנתונים של המערכת")},z=new Set(["no_floor","no_plan"]);function u(s){return s.replace(/(^|[^\w\u200E])([+-]\d)/g,"$1‎$2")}function b(s){if(!s)return"";const a=new Date(s);return Number.isNaN(a.getTime())?String(s):a.toLocaleString(C(),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}let w=class extends _{constructor(){super(...arguments),this.bubbleSkin=new S(this),this.data=null,this.error="",this.busy=new Set,this.notes={},this.demoPlaced=!1,this.stopDismissal=null}connectedCallback(){super.connectedCallback(),this.stopDismissal=T(()=>this.requestUpdate()),L()||E(),this.load(!0)}disconnectedCallback(){this.stopDismissal?.(),this.stopDismissal=null,super.disconnectedCallback()}set(s){this.data=s,this.error="",p()&&F(s)}async load(s=!1){if(!p()){this.set($(this.demoPlaced));return}try{this.set(await R())}catch(a){this.error=y(a);return}if(s)for(const a of this.data?.steps??[])a.source==="background"&&a.status!=="not_applicable"&&this.check(a.id,!0)}async check(s,a=!1){if(!this.busy.has(s)){this.busy=new Set(this.busy).add(s),this.notes={...this.notes,[s]:""};try{p()?this.merge(await P(s),s):(await new Promise(t=>setTimeout(t,500)),s==="camera"&&(this.demoPlaced=!0),this.set($(this.demoPlaced,s)))}catch(t){const r=t instanceof D&&t.status===429;a&&r||(this.notes={...this.notes,[s]:y(t)})}finally{const t=new Set(this.busy);t.delete(s),this.busy=t,!t.size&&p()&&this.load(!1)}}}merge(s,a){const t=s.steps.find(c=>c.id===a);if(!this.data||!t){this.set(s);return}const r=this.data.steps.map(c=>c.id===a?t:c),o=r.filter(c=>c.status!=="not_applicable"),d=o.filter(c=>c.status==="done").length,l=s.installation??this.data.installation,x=g({steps:r,installation:l});this.set({...this.data,steps:r,done:d,total:o.length,ready:x.ready,installation:l,next:x.next,checked_at:s.checked_at,checked:a})}checkAll(){for(const s of this.data?.steps??[])s.status!=="not_applicable"&&this.check(s.id)}jump(s){this.renderRoot.querySelector(`[data-step="${s}"]`)?.scrollIntoView({behavior:"smooth",block:"start"})}renderRail(s){return i`<ol class="rail" aria-label=${e("שלבי ההתקנה")} data-wizard-rail>
      ${s.steps.map(a=>i`<li class=${a.status} data-rail-step=${a.id} data-status=${a.status}>
        <button type="button" @click=${()=>this.jump(a.id)} aria-label=${`${a.index}. ${a.title}: ${k[a.status]}`}>
          <span class="dot">${a.status==="done"?i`<sw-icon name="check" size=${13}></sw-icon>`:a.status==="failed"?"!":a.index}</span>
          <span class="lbl">${a.title}${h(a)?i` <small class="opt">· ${v.optional}</small>`:n}</span>
        </button>
      </li>`)}
    </ol>`}renderSummary(s){const a=s.installation;return i`${a&&!a.supported?i`<div class="problem failed" role="alert" data-wizard-unsupported=${a.reason??""}>
          <sw-icon name="warning" size=${16}></sw-icon>
          <div><b>${a.message??""}</b><span>${e("מה עושים:")} ${a.action??""}</span></div>
        </div>`:n}${this.renderProgress(s)}`}renderProgress(s){const a=s.steps.filter(l=>l.status==="not_applicable").length,t=g(s),r=s.steps.filter(l=>h(l)&&l.status!=="not_applicable"&&l.status!=="done").length;if(t.ready&&s.mode==="ha_only")return i`<div class="summary ready" role="status" data-wizard-ready data-wizard-mode="ha_only">
        <span class="big"><sw-icon name="check" size=${22}></sw-icon></span>
        <div class="txt"><b>${e("מוכן לעבודה")}</b><span>${e("כל {n} השלבים הנדרשים עברו",{n:t.total})} · ${e("{n} דולגו (מצב ללא NVR)",{n:a})}${r?` · ${e("{n} אופציונליים",{n:r})}`:""} · ${e("נבדק {time}",{time:b(s.checked_at)})}</span></div>
        <div class="go">
          <sw-button size="sm" variant="primary" icon="map" @click=${()=>window.location.hash="#/explore/sites"}>${e("למפה")}</sw-button>
          <sw-button size="sm" icon="bolt" @click=${()=>window.location.hash="#/devices/building"}>${e("לחשמל והתקנים")}</sw-button>
        </div>
      </div>`;if(t.ready)return i`<div class="summary ready" role="status" data-wizard-ready>
        <span class="big"><sw-icon name="check" size=${22}></sw-icon></span>
        <div class="txt"><b>${e("מוכן לעבודה")}</b><span>${a||r?`${e("כל {n} השלבים הנדרשים עברו",{n:t.total})}${a?` · ${e("{n} דולגו",{n:a})}`:""}${r?` · ${e("{n} אופציונליים נותרו",{n:r})}`:""}`:e("כל ששת השלבים עברו")} · ${e("נבדק {time}",{time:b(s.checked_at)})}</span></div>
        <div class="go">
          <sw-button size="sm" variant="primary" icon="live" @click=${()=>window.location.hash="#/live/wall"}>${e("לכל המצלמות")}</sw-button>
          <sw-button size="sm" icon="map" @click=${()=>window.location.hash="#/explore/sites"}>${e("למפה")}</sw-button>
          <sw-button size="sm" icon="list" @click=${()=>window.location.hash="#/investigate/events"}>${e("לאירועים")}</sw-button>
        </div>
      </div>`;const o=s.steps.find(l=>l.id===t.next),d=s.steps.filter(l=>l.status==="failed").length;return i`<div class="summary" role="status" data-wizard-progress>
      <span class="count"><b>${t.done}</b>/${t.total}</span>
      <div class="txt"><b>${e("{done} מתוך {total} שלבים הושלמו",{done:t.done,total:t.total})}${d?` · ${e("{n} נכשלו",{n:d})}`:""}${a?` · ${e("{n} דולגו",{n:a})}${s.mode==="ha_only"?` ${e("(מצב ללא NVR)")}`:""}`:""}</b>${o?i`<span>${e("השלב הבא:")} ${o.index}. ${o.title} — ${u(o.summary)}</span>`:n}</div>
      ${o?i`<div class="go"><sw-button size="sm" variant="primary" @click=${()=>this.jump(o.id)}>${e("לשלב {n}",{n:o.index})}</sw-button></div>`:n}
      ${this.renderRestore()}
    </div>`}renderRestore(){return O()?i`<div class="go"><sw-button size="sm" variant="ghost" icon="info" data-setup-hint-restore @click=${()=>void j()}>${v.show}</sw-button></div>`:n}renderStep(s){const a=this.busy.has(s.id),t=this.notes[s.id];return i`<section class="step ${s.status}" data-step=${s.id} data-status=${s.status} data-source=${s.source} aria-labelledby=${`h-${s.id}`}>
      <header>
        <span class="num">${s.index}</span>
        <div class="head">
          <h3 id=${`h-${s.id}`}>${s.title}${h(s)?i` <small class="opt" data-step-optional>(${v.optional})</small>`:n}</h3>
          <span class="meta">${W[s.source]}${s.checked_at?` · ${b(s.checked_at)}`:""}</span>
        </div>
        <span class="pill ${s.status}" data-step-status><sw-icon name=${H[s.status]} size=${13}></sw-icon>${s.status_label??k[s.status]}</span>
        ${s.status==="not_applicable"?n:i`<sw-button size="sm" icon="refresh" ?disabled=${a} data-check=${s.id} @click=${()=>this.check(s.id)}>${a?e("בודק…"):e("בדוק שוב")}</sw-button>`}
      </header>
      <p class="sum" data-step-summary>${u(s.summary)}</p>
      ${s.problem?i`<div class="problem ${s.status}" role=${s.status==="failed"?"alert":"note"} data-step-problem=${s.problem.code}>
            <sw-icon name=${s.status==="failed"?"warning":"info"} size=${16}></sw-icon>
            <div>
              <b>${u(s.problem.message)}</b>
              <span data-step-action>${e("מה עושים:")} ${u(s.problem.action)}</span>
              ${s.problem.link||s.id==="floor"&&z.has(s.problem.code)?i`<span class="links">${s.problem.link?i`<a href=${s.problem.link.href} data-step-link>${s.problem.link.label} ‹</a>`:n}${s.id==="floor"&&z.has(s.problem.code)?i`<button type="button" class="linkbtn" data-architect-request @click=${()=>q()}>${e("בקשה לאדריכל ‹")}</button>`:n}</span>`:n}
            </div>
          </div>`:n}
      ${t?i`<div class="note" data-step-note>${t}</div>`:n}
      ${s.id==="nvr"&&(s.status==="todo"||s.status==="failed")&&p()&&N("system.configure")?i`<div class="conn" data-wizard-nvr-form><nvr-connection-form context="wizard" @nvr-connection-saved=${()=>void this.load(!1)} @nvr-connection-removed=${()=>void this.load(!1)}></nvr-connection-form></div>`:n}
      ${s.warnings.length?i`<ul class="warnings" data-step-warnings>${s.warnings.map(r=>i`<li data-warning=${r.code}><sw-icon name="info" size=${13}></sw-icon><span>${u(r.message)}${r.link?i` <a href=${r.link.href}>${r.link.label} ‹</a>`:n}</span></li>`)}</ul>`:n}
      ${s.facts.length?i`<dl class="facts" data-step-facts>${s.facts.map(r=>i`<div class="fact"><dt>${r.label}</dt><dd class=${r.tone}>${u(r.value)}</dd></div>`)}</dl>`:n}
      <div class="foot"><a href=${s.settings_link.href} data-settings-link>${s.settings_link.label} ‹</a></div>
    </section>`}render(){const s=this.data,a=this.busy.size>0,t=s?.mode==="ha_only"?e("מצב ללא NVR · התקנה ‹ NVR ‹ תשתית המערכת ‹ go2rtc ‹ קומה · שלב המצלמה מדולג"):e("התקנה ‹ NVR ‹ תשתית המערכת ‹ go2rtc ‹ קומה ‹ מצלמה");return i`<sw-page heading=${e("אשף התקנה")} subheading=${`${t} · ${e("הבדיקות קוראות בלבד מהמכשירים")}${p()?"":` · ${e("נתוני הדגמה")}`}`}>
      <sw-button slot="actions" icon="refresh" ?disabled=${!s||a} data-check-all @click=${()=>this.checkAll()}>${a?e("בודק…"):e("בדוק הכול")}</sw-button>
      ${this.error?i`<sw-state-panel state="error" heading=${e("מצב ההתקנה לא נטען")} hint=${this.error}></sw-state-panel>`:n}
      ${s?i`<div class="wrap" data-wizard>
            ${this.renderRail(s)}
            ${this.renderSummary(s)}
            ${s.steps.map(r=>this.renderStep(r))}
            ${!p()||A("site.content.configure")?i`<sw-card heading=${e("שלב רשות · בניינים ומיפוי")} subheading=${e("כשבאותה מערכת בית יש כמה בניינים: איזה שם שייך לאיזה בניין. אפשר גם אחר כך, מהגדרות ‹ בניינים ומיפוי.")} data-wizard-mapping><system-mapping compact></system-mapping></sw-card>`:n}
            <p class="hint">${e('סטיית שעון עד {ok} שנ׳ תקינה, עד {fail} שנ׳ אזהרה, מעבר לזה השלב נכשל. "בדוק שוב" אפשרי פעם ב־{every} שנ׳ לכל שלב; בדיקה מול מכשיר מוצגת {min} דקות.',{ok:s.thresholds.drift_ok_s,fail:s.thresholds.drift_fail_s,every:s.check_every_s,min:Math.round(s.live_ttl_s/60)})}</p>
          </div>`:this.error?n:i`<sw-state-panel state="loading" heading=${e("קורא את מצב ההתקנה…")}></sw-state-panel>`}
    </sw-page>`}};w.styles=[X,V`
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
      font-weight: var(--sw-fw-regular);
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
  `,U];f([m()],w.prototype,"data",2);f([m()],w.prototype,"error",2);f([m()],w.prototype,"busy",2);f([m()],w.prototype,"notes",2);w=f([I("system-wizard")],w);export{w as SystemWizard};
