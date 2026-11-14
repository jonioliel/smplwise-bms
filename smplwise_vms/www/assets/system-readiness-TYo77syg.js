import{a as y,S as z,i as c,vy as h,qQ as S,vz as u,j as m,Y as p,vA as _,vB as E,vC as O,vD as T,vE as D,vF as C,vG as R,vH as x,e as t,vI as k,A as l,vJ as N,vK as A,vL as j,vM as I,vN as L,vO as P,ct as H,vP as M,vQ as X,vR as w,vS as G,vT as K,vU as U,be as B,s5 as F,E as Q,G as o,H as Y}from"./index-Cx0qJkOE.js";import"./sw-logo-art-Va6y_cIM.js";var q=Object.defineProperty,J=Object.getOwnPropertyDescriptor,n=(s,e,a,r)=>{for(var d=r>1?void 0:r?J(e,a):e,v=s.length-1,g;v>=0;v--)(g=s[v])&&(d=(r?g(e,a,d):g(d))||d);return r&&d&&q(e,a,d),d};const V={ok:"check",attention:"info",blocked:"warning",pending:"clock",not_applicable:"minus"},b=54,$=2*Math.PI*b;function f(s){if(!s)return"";const e=new Date(s);return Number.isNaN(e.getTime())?String(s):e.toLocaleString("he-IL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}let i=class extends y{constructor(){super(...arguments),this.bubbleSkin=new z(this),this.report=null,this.error="",this.forbidden=!1,this.busy=!1,this.note="",this.kpi="all",this.pane="checks",this.customer="",this.printed=!1,this.handoverNote="",this.settingsOpen=!1,this.draft={},this.settingsError="",this.demoOpen=!1,this.demo=null,this.demoSet={dataset:"residential",scenario:"normal",hours:4},this.demoError=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(this.error="",!c()){this.report=h();return}try{this.report=await S(),u(this.report),this.forbidden=!1}catch(s){s instanceof m&&s.status===403?this.forbidden=!0:this.error=p(s)}}async checkAll(){if(!this.busy){this.busy=!0,this.note="";try{c()?(this.report=await _(),u(this.report)):(await new Promise(s=>setTimeout(s,400)),this.report=h())}catch(s){this.note=s instanceof m&&s.status===429?`הבדיקה הורצה הרגע. אפשר שוב בעוד ${s.body.details?.retry_after_s??30} שנ׳.`:p(s)}finally{this.busy=!1}}}async recordHandover(s){if(!this.busy){this.busy=!0,this.note="";try{c()?(this.report=await E(s,this.customer,this.handoverNote,this.printed),u(this.report)):this.report={...h(),handover:{...h().handover,done:s}}}catch(e){this.note=p(e)}finally{this.busy=!1}}}openSettings(){this.report&&(this.draft={...this.report.settings},this.settingsError="",this.settingsOpen=!0)}setDraft(s,e){this.draft={...this.draft,[s]:e}}async saveSettings(){if(!this.report)return;const s=O(this.report.settings,this.draft);if(!Object.keys(s).length){this.settingsOpen=!1;return}for(const[e,a]of Object.entries(s))if(!T(e,a)){this.settingsError="ערך לא תקין: יש להזין מספר שלם בטווח המותר.";return}this.busy=!0;try{c()&&await D(s),this.settingsOpen=!1,await this.load()}catch(e){this.settingsError=p(e)}finally{this.busy=!1}}async openDemo(){if(this.demoError="",this.demoOpen=!0,c())try{this.demo=await C()}catch(s){this.demoError=p(s)}}async confirmDemo(){this.busy=!0,this.demoError="";try{c()?(await R(this.demoSet.dataset,this.demoSet.scenario,this.demoSet.hours),window.location.reload()):this.demoOpen=!1}catch(s){this.demoError=p(s)}finally{this.busy=!1}}ring(s){const e=$*s.score/100;return t`<div class="ring" data-tone=${x(s.level)} role="img" aria-label=${`ציון מוכנות ${s.score} מתוך 100`} data-score-ring>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r=${b}></circle><circle class="fg" cx="60" cy="60" r=${b} stroke-dasharray=${`${e} ${$}`}></circle></svg>
      <div class="v"><b data-score>${s.score}</b><small>מתוך 100</small></div>
    </div>`}hero(s){const e=s.handover.blockers.map(r=>s.checks.find(d=>d.id===r)?.title??r),a=s.history[1];return t`<section class="panel hero" data-tone=${x(s.level)} data-hero>
      ${this.ring(s)}
      <div class="lvl">
        <div class="name"><span data-level>${k[s.level]}</span>${e.length?t`<span class="badge blocked" data-blockers><sw-icon name="warning" size=${12}></sw-icon>${e.length===1?"חסם אחד":`${e.length} חסמים`}</span>`:l}</div>
        <div class="hint" data-advice>מסירה ללקוח מומלצת מציון ${s.bands.advice} ובלי חסמים. זו המלצה בלבד: אפשר למסור גם קודם, והמסירה תירשם עם הציון שהיה.</div>
        <div class="scale" aria-hidden="true"><span class=${s.score>=0?"on":""}></span><span class=${s.score>=s.bands.almost_min?"on":""}></span><span class=${s.score>=s.bands.advice?"on":""}></span></div>
        <div class="scale-l" aria-hidden="true"><span>בהקמה · 0-${s.bands.almost_min-1}</span><span>כמעט מוכן · ${s.bands.almost_min}-${s.bands.advice-1}</span><span>מוכן למסירה · ${s.bands.advice}+</span></div>
        <div class="gates">${e.map(r=>t`<span class="chip blocked">חסם: ${r}</span>`)}${a?t`<span class="chip">ציון קודם: ${a.score} (${f(a.at)})</span>`:l}</div>
      </div>
    </section>`}kpis(s){const e=N(s.checks);return t`<div class="kpis" role="group" aria-label="סינון לפי מצב" data-kpis>
      ${A.map(a=>t`<button type="button" class="kpi" data-k=${a} data-look=${a} aria-pressed=${this.kpi===a?"true":"false"} @click=${()=>this.kpi=a}><span class="dot" aria-hidden="true"></span><div><b>${e[a]}</b><span class="l">${j[a]}</span></div></button>`)}
    </div>`}row(s){const e=I(s),a=s.fraction===null?0:Math.round(s.fraction*100);return t`<article class="row" data-check=${s.id} data-status=${s.status}>
      <span class="disc" data-status=${s.status} aria-hidden="true"><sw-icon name=${V[s.status]} size=${14}></sw-icon></span>
      <div class="main">
        <div class="t"><h3>${s.title}</h3><span class="badge ${s.status}" data-check-status>${L[s.status]}</span>${s.critical?t`<span class="chip crit">קריטי</span>`:l}<span class="chip">${s.source==="computed"?"נמדד":"מאושר ידנית"}</span></div>
        <p class="sum">${s.summary}</p>
        ${s.applicable?t`<div class="bar" aria-hidden="true"><i style=${`inline-size:${a}%`}></i></div>`:l}
        ${s.facts.length?t`<div class="facts">${s.facts.slice(0,4).map(r=>t`<span class="chip ${r.ok===!1?"warn":r.ok?"good":""}">${r.label}: ${r.value}</span>`)}</div>`:l}
      </div>
      <div class="end">${s.applicable?t`<span class="pts" data-points>${e.got}/${e.of}</span>`:l}${s.next?t`<a class=${`go ${s.status==="blocked"?"pri":""}`} href=${s.next.href} data-next-link>${s.next.label} ‹</a>`:l}</div>
    </article>`}checks(s){const e=P(s.checks,this.kpi);return t`<section class="col checks" data-checks aria-label="הבדיקות">
      ${e.length?H(e,a=>a.id,a=>this.row(a)):t`<sw-state-panel icon="rule" state="empty" compact heading="אין בדיקות במצב הזה"></sw-state-panel>`}
    </section>`}steps(s){return t`<div class="panel" data-steps><div class="hd"><h2>הצעדים הבאים</h2><span class="mut">לפי תרומה לציון</span></div>
      ${s.next_steps.length?t`<ol class="next">${s.next_steps.map((e,a)=>t`<li><span class="n">${a+1}</span><a href=${e.href} data-step-link><b>${e.title}</b><span>${e.label}</span></a>${e.gain?t`<span class="gain" data-gain>${M(e.gain)}</span>`:l}</li>`)}</ol>`:t`<p class="mut">אין צעדים פתוחים.</p>`}
    </div>`}handoverCard(s){const e=s.handover,a=e.done;return t`<div class="panel" data-handover><div class="hd"><h2>מסירה ללקוח</h2><span class="chip ${a?"good":""}" data-handover-state>${a?"נרשמה":"ממתין"}</span></div>
      <p class="mut">${e.advice_met?`הציון עומד בהמלצה (${e.advice_score}+) וללא חסמים.`:`המלצה: ציון ${e.advice_score}+ וללא חסמים. אפשר לרשום מסירה גם קודם.`}</p>
      ${a?l:t`<div class="form"><label>שם הלקוח<input class="inp" type="text" maxlength="120" .value=${this.customer} @input=${r=>this.customer=r.target.value} data-customer></label>
            <label class="inline"><input type="checkbox" .checked=${this.printed} @change=${r=>this.printed=r.target.checked}>המדריך המודפס נמסר</label></div>`}
      ${!a&&!e.advice_met?t`<p class="warn" data-below-advice><sw-icon name="info" size=${13}></sw-icon>המסירה תירשם כמוקדמת: ציון ${s.score}${e.blockers.length?` ו־${e.blockers.length} חסמים`:""}.</p>`:l}
      <div class="btns"><sw-button size="sm" variant=${a?"secondary":"primary"} ?disabled=${this.busy} data-handover-btn @click=${()=>void this.recordHandover(!a)}>${a?"ביטול רישום המסירה":e.advice_met?"רישום מסירה":"רישום מסירה מוקדמת"}</sw-button></div>
    </div>`}historyCard(s){return t`<div class="panel" data-history><div class="hd"><h2>היסטוריה</h2></div>
      ${s.history.length?t`<ul class="hist">${s.history.map((e,a)=>t`<li><span class="dot ${e.level}"></span><span class="t">ציון ${e.score} · ${k[e.level]}${a===0?" (אחרון)":""}</span><span class="w">${f(e.at)}</span></li>`)}</ul>`:t`<p class="mut">עדיין לא נרשם ציון. "בדוק הכול" רושם את הראשון.</p>`}
    </div>`}settingsDialog(s){return t`<sw-dialog ?open=${this.settingsOpen} wide heading="הגדרות סף ומשקלים" subheading="כל הספים והמשקלים של המוכנות. נשמר בהתקנה ונרשם באודיט." ?locked=${this.busy} @close=${()=>this.settingsOpen=!1} data-settings-dialog>
      <div class="sform">
        ${X.map(e=>t`<label><span>${e.label}</span><span class="u"><input class="inp num" inputmode="numeric" .value=${this.draft[e.key]??""} @input=${a=>this.setDraft(e.key,a.target.value.trim())} data-setting=${e.key}>${e.unit}</span></label>`)}
        <h4>משקל כל בדיקה (0 = לא נספרת)</h4>
        ${s.checks.map(e=>t`<label><span>${e.title}</span><span class="u"><input class="inp num" inputmode="numeric" .value=${this.draft[w(e.id)]??""} @input=${a=>this.setDraft(w(e.id),a.target.value.trim())} data-setting=${w(e.id)}>נק׳</span></label>`)}
        ${this.settingsError?t`<p class="err" role="alert" data-settings-error>${this.settingsError}</p>`:l}
      </div>
      <div slot="footer" class="dfoot"><sw-button variant="ghost" @click=${()=>this.settingsOpen=!1}>ביטול</sw-button><sw-button variant="primary" ?disabled=${this.busy} data-settings-save @click=${()=>void this.saveSettings()}>שמירה</sw-button></div>
    </sw-dialog>`}demoDialog(){const s=this.demo,e=c()&&s!==null&&!s.can_run;return t`<sw-dialog ?open=${this.demoOpen} heading="מצב הדגמה" subheading="התקנה לדוגמה על מסד נתונים נפרד" ?locked=${this.busy} @close=${()=>this.demoOpen=!1} data-demo-dialog>
      <div class="sform">
        <label><span>מערך נתונים</span><select class="inp" .value=${this.demoSet.dataset} @change=${a=>this.demoSet={...this.demoSet,dataset:a.target.value}} data-demo-dataset>${(s?.datasets??["residential","office","retail"]).map(a=>t`<option value=${a} ?selected=${this.demoSet.dataset===a}>${G[a]}</option>`)}</select></label>
        <label><span>תרחיש</span><select class="inp" .value=${this.demoSet.scenario} @change=${a=>this.demoSet={...this.demoSet,scenario:a.target.value}} data-demo-scenario>${(s?.scenarios??["normal","cameras_offline","new_installation"]).map(a=>t`<option value=${a} ?selected=${this.demoSet.scenario===a}>${K[a]}</option>`)}</select></label>
        <label><span>משך</span><select class="inp" .value=${String(this.demoSet.hours)} @change=${a=>this.demoSet={...this.demoSet,hours:Number(a.target.value)}} data-demo-hours>${U.map(a=>t`<option value=${a} ?selected=${this.demoSet.hours===a}>${a===24?"עד 24 שעות (מקסימום)":`${a} ש׳`}</option>`)}</select></label>
        <p class="warn"><sw-icon name="warning" size=${14}></sw-icon>הנתונים מדומים ונפרדים מההתקנה האמיתית. פעולות למצלמות, לדלתות ולמכשירים חסומות. כל המשתמשים רואים שההדגמה פועלת. ההדגמה מסתיימת בעצמה, ואיתחול המערכת מסיים אותה. הפעלה ויציאה נרשמות באודיט.</p>
        ${e?t`<p class="err" role="alert" data-demo-denied>אין לך הרשאה להפעיל הדגמה (נדרשת ההרשאה "הפעלת מצב הדגמה").</p>`:l}
        ${this.demoError?t`<p class="err" role="alert" data-demo-error>${this.demoError}</p>`:l}
      </div>
      <div slot="footer" class="dfoot"><sw-button variant="ghost" @click=${()=>this.demoOpen=!1}>ביטול</sw-button><sw-button variant="primary" icon="play" ?disabled=${this.busy||e} data-demo-start @click=${()=>void this.confirmDemo()}>הפעלת הדגמה</sw-button></div>
    </sw-dialog>`}render(){const s=this.report,e=s?`מערכת · ${s.checks.length} בדיקות · הבדיקות קוראות בלבד מהמכשירים · נבדק ${f(s.checked_at)}${c()?"":" · נתוני הדגמה"}`:"מערכת · הבדיקות קוראות בלבד מהמכשירים";return t`<sw-page heading="מוכנות ההתקנה" subheading=${e}>
      <span slot="actions" class="acts">
        ${c()&&!B("demo.run")?l:t`<sw-button icon="play" ?disabled=${!s} data-open-demo @click=${()=>void this.openDemo()}>מצב הדגמה</sw-button>`}
        <sw-button icon="wrench" ?disabled=${!s} data-open-settings @click=${()=>this.openSettings()}>הגדרות סף</sw-button>
        <sw-button variant="primary" icon="refresh" ?disabled=${!s||this.busy} data-check-all @click=${()=>void this.checkAll()}>${this.busy?"בודק…":"בדוק הכול"}</sw-button>
      </span>
      ${this.forbidden?t`<sw-state-panel state="forbidden" heading="אין הרשאה למסך הזה" hint="מוכנות ההתקנה פתוחה למי שמגדיר את המערכת."></sw-state-panel>`:this.error?t`<sw-state-panel state="error" heading="מצב המוכנות לא נטען" hint=${this.error} actionLabel="ניסיון חוזר" @action=${()=>void this.load()}></sw-state-panel>`:s?t`<div class="fit" data-readiness>
                ${this.note?t`<p class="note" role="status" data-note>${this.note}</p>`:l}
                ${this.hero(s)}${this.kpis(s)}
                <div class="panes" role="tablist" aria-label="חלוקת המסך" data-panes>
                  ${["checks","steps","handover"].map(a=>t`<button type="button" role="tab" aria-selected=${this.pane===a?"true":"false"} @click=${()=>this.pane=a}>${a==="checks"?"בדיקות":a==="steps"?"צעדים":"מסירה והיסטוריה"}</button>`)}
                </div>
                <div class="cols" data-pane=${this.pane}>
                  ${this.checks(s)}
                  <div class="col side">${this.steps(s)}${this.handoverCard(s)}${this.historyCard(s)}</div>
                </div>
              </div>`:t`<sw-state-panel state="loading" heading="קורא את מצב ההתקנה…"></sw-state-panel>`}
      ${s?this.settingsDialog(s):l}${this.demoDialog()}
    </sw-page>`}};i.styles=[F,Q`
    :host {
      display: block;
      block-size: 100%;
      min-block-size: 0;
      overflow: hidden;
    }
    sw-page {
      block-size: 100%;
      min-block-size: 0;
      overflow: hidden;
    }
    .acts {
      display: contents;
    }
    .fit {
      flex: 1;
      min-block-size: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .note {
      margin: 0;
      padding: 6px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    /* R5-SYSTEM-297: the panels take the card step (the ladder's shadow 2 + light line, the large radius) */
    .panel {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      padding: 14px 16px;
    }
    /* the score is the one primary object of the page: the hero panel, a 120 px ring with a 40/800 figure */
    .hero {
      flex: none;
      display: flex;
      align-items: center;
      gap: 22px;
      padding: 16px 20px;
    }
    .ring {
      position: relative;
      flex: none;
      inline-size: 120px;
      block-size: 120px;
    }
    .ring svg {
      inline-size: 100%;
      block-size: 100%;
      transform: rotate(-90deg);
    }
    .ring circle {
      fill: none;
      stroke-width: 10;
    }
    .ring .bg {
      stroke: var(--sw-surface-3);
    }
    .ring .fg {
      stroke: var(--sw-danger);
      stroke-linecap: round;
      transition: stroke-dasharray var(--sw-t-fast) var(--sw-ease);
    }
    .ring[data-tone='warning'] .fg {
      stroke: var(--sw-warning);
    }
    .ring[data-tone='success'] .fg {
      stroke: var(--sw-success);
    }
    .ring .v {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
    }
    .ring .v b {
      font-size: var(--sw-fs-4xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.04em;
      line-height: 1;
      color: var(--sw-heading, var(--sw-text));
      font-variant-numeric: tabular-nums;
    }
    .ring .v small {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .lvl {
      min-inline-size: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .name {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--sw-text));
    }
    .hint {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
    .scale {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin-block-start: 2px;
    }
    .scale span {
      block-size: 6px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
    }
    .scale span.on {
      background: var(--sw-accent);
    }
    .scale-l {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      font-size: var(--sw-fs-2xs);
      color: var(--sw-text-3);
    }
    .gates {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .badge,
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 18px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .badge.blocked {
      background: var(--sw-danger);
      color: var(--sw-text-inverse);
    }
    .badge.attention {
      background: var(--sw-warning);
      color: var(--sw-text-inverse);
    }
    .badge.ok {
      background: var(--sw-success);
      color: var(--sw-text-inverse);
    }
    .badge.pending {
      background: var(--sw-unknown);
      color: var(--sw-text-inverse);
    }
    .badge.not_applicable {
      background: var(--sw-offline-soft);
      color: var(--sw-offline-text);
    }
    .chip.blocked,
    .chip.crit {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .chip.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip.good {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .kpis {
      flex: none;
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    /* the six counters are keys one step below the hero: surface-2 wells with a 22/800 figure, the chosen one a filled accent field;
       they give on press, and hover stays with a pointer that hovers */
    .kpi {
      all: unset;
      box-sizing: border-box;
      cursor: pointer;
      flex: 1 0 auto;
      min-inline-size: 104px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
      font-size: var(--sw-fs-base);
      color: var(--sw-text-2);
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    .kpi b {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.02em;
      color: var(--sw-heading, var(--sw-text));
      font-variant-numeric: tabular-nums;
    }
    @media (hover: hover) and (pointer: fine) {
      .kpi:hover {
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
      }
    }
    .kpi:active {
      transform: scale(var(--sw-press-scale));
    }
    @media (prefers-reduced-motion: reduce) {
      .kpi {
        transition-duration: 0ms;
      }
    }
    .kpi:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: var(--sw-focus-offset, 2px);
    }
    .kpi[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .kpi .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-accent);
      flex: none;
    }
    .kpi[data-look='blocked'] .dot {
      background: var(--sw-danger);
    }
    .kpi[data-look='attention'] .dot {
      background: var(--sw-warning);
    }
    .kpi[data-look='ok'] .dot {
      background: var(--sw-success);
    }
    .kpi[data-look='pending'] .dot {
      background: var(--sw-unknown);
    }
    .kpi[data-look='not_applicable'] .dot {
      background: var(--sw-offline);
    }
    .kpi b {
      display: block;
      font-size: var(--sw-fs-lg);
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--sw-text));
      line-height: 1.1;
    }
    .kpi .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .panes {
      display: none;
    }
    .cols {
      flex: 1;
      min-block-size: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 10px;
    }
    .col {
      min-block-size: 0;
      min-inline-size: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scrollbar-width: thin;
    }
    .col > * {
      flex: none;
    }
    .row {
      display: flex;
      gap: 10px;
      padding: 10px 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .row[data-status='blocked'] {
      border-color: var(--sw-danger);
    }
    .disc {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: 26px;
      block-size: 26px;
      border-radius: 50%;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .disc[data-status='ok'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .disc[data-status='attention'] {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .disc[data-status='blocked'] {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .main {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .t {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    h3,
    h2,
    h4 {
      margin: 0;
    }
    h3 {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
    }
    h2 {
      font-size: var(--sw-fs-md);
      color: var(--sw-heading, var(--sw-text));
    }
    .sum {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .bar {
      block-size: 5px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
    }
    .row[data-status='blocked'] .bar i {
      background: var(--sw-danger);
    }
    .row[data-status='ok'] .bar i {
      background: var(--sw-success);
    }
    .facts {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .end {
      flex: none;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }
    .pts {
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    a.go {
      display: inline-flex;
      align-items: center;
      min-block-size: 28px;
      padding-inline: 10px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
      white-space: nowrap;
    }
    a.go.pri {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    a.go:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: var(--sw-focus-offset, 2px);
    }
    .hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-block-end: 8px;
    }
    .mut {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin: 0;
    }
    .next {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .next li {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .next .n {
      flex: none;
      inline-size: 20px;
      block-size: 20px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .next a {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      color: inherit;
      text-decoration: none;
      font-size: var(--sw-fs-sm);
    }
    .next a span {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .gain {
      color: var(--sw-success-text);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-block-end: 8px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    label.inline {
      flex-direction: row;
      align-items: center;
      gap: 6px;
    }
    .inp {
      min-block-size: 32px;
      padding: 0 10px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    .inp:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: 0;
    }
    .inp.num {
      inline-size: 88px;
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    .warn {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 0 0 8px;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
    }
    .err {
      margin: 0;
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .hist {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .hist li {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .hist .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    .hist .dot.almost {
      background: var(--sw-warning);
    }
    .hist .dot.ready {
      background: var(--sw-success);
    }
    .hist .t {
      flex: 1;
    }
    .hist .w {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .sform {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-block: 4px;
    }
    .sform label {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
    .sform .u {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .sform select.inp {
      inline-size: 200px;
    }
    .sform h4 {
      margin-block-start: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-heading, var(--sw-text));
    }
    .dfoot {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    @media (max-width: 899px) {
      .hero {
        gap: 12px;
        padding: 10px 12px;
      }
      .ring {
        inline-size: 72px;
        block-size: 72px;
      }
      .ring .v b {
        font-size: var(--sw-fs-2xl);
      }
      .ring .v small,
      .scale-l,
      .hint {
        display: none;
      }
      .name {
        font-size: var(--sw-fs-lg);
      }
      .kpi {
        min-inline-size: 92px;
        padding: 6px 10px;
      }
      .panes {
        flex: none;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 4px;
        padding: 3px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-3);
      }
      .panes button {
        all: unset;
        box-sizing: border-box;
        cursor: pointer;
        text-align: center;
        padding: 6px 4px;
        border-radius: var(--sw-r-sm);
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-2);
      }
      .panes button[aria-selected='true'] {
        background: var(--sw-seg-key, var(--sw-surface));
        color: var(--sw-seg-key-ink, var(--sw-text));
        font-weight: var(--sw-fw-semibold);
        box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
      }
      .cols {
        grid-template-columns: minmax(0, 1fr);
      }
      .cols[data-pane='checks'] > .side,
      .cols[data-pane='steps'] > .checks,
      .cols[data-pane='handover'] > .checks {
        display: none;
      }
      .cols[data-pane='steps'] .side > [data-handover],
      .cols[data-pane='steps'] .side > [data-history],
      .cols[data-pane='handover'] .side > [data-steps] {
        display: none;
      }
      .row {
        flex-wrap: wrap;
      }
      .end {
        flex-direction: row;
        align-items: center;
        inline-size: 100%;
        justify-content: space-between;
      }
    }
  `];n([o()],i.prototype,"report",2);n([o()],i.prototype,"error",2);n([o()],i.prototype,"forbidden",2);n([o()],i.prototype,"busy",2);n([o()],i.prototype,"note",2);n([o()],i.prototype,"kpi",2);n([o()],i.prototype,"pane",2);n([o()],i.prototype,"customer",2);n([o()],i.prototype,"printed",2);n([o()],i.prototype,"handoverNote",2);n([o()],i.prototype,"settingsOpen",2);n([o()],i.prototype,"draft",2);n([o()],i.prototype,"settingsError",2);n([o()],i.prototype,"demoOpen",2);n([o()],i.prototype,"demo",2);n([o()],i.prototype,"demoSet",2);n([o()],i.prototype,"demoError",2);i=n([Y("system-readiness")],i);export{i as SystemReadiness};
//# sourceMappingURL=system-readiness-TYo77syg.js.map
