import{a as z,aX as S,af as p,fZ as g,f_ as _,f$ as u,c as x,q as h,g0 as E,dL as e,g1 as O,g2 as T,g3 as D,g4 as C,g5 as R,g6 as N,g7 as $,b as i,g8 as k,A as d,g9 as j,ga as A,gb as L,gc as P,gd as I,ge as H,bo as M,gf as X,ae as K,gg as U,gh as f,gi as G,gj as q,gk as B,aM as F,u as V,j as Y,k as l,m as Z}from"./index-HK12zoPD.js";import{a as J}from"./settings-DYAYUgHz.js";import"./sw-logo-art-PLtEZJxU.js";var Q=Object.defineProperty,W=Object.getOwnPropertyDescriptor,o=(s,a,t,n)=>{for(var c=n>1?void 0:n?W(a,t):a,v=s.length-1,w;v>=0;v--)(w=s[v])&&(c=(n?w(a,t,c):w(c))||c);return n&&c&&Q(a,t,c),c};const ss={ok:"check",attention:"info",blocked:"warning",pending:"clock",not_applicable:"minus"},m=54,y=2*Math.PI*m;function b(s){if(!s)return"";const a=new Date(s);return Number.isNaN(a.getTime())?String(s):a.toLocaleString(V(),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}let r=class extends z{constructor(){super(...arguments),this.bubbleSkin=new S(this),this.report=null,this.error="",this.forbidden=!1,this.busy=!1,this.note="",this.kpi="all",this.pane="checks",this.customer="",this.printed=!1,this.handoverNote="",this.settingsOpen=!1,this.draft={},this.settingsError="",this.demoOpen=!1,this.demo=null,this.demoSet={dataset:"residential",scenario:"normal",hours:4},this.demoError=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(this.error="",!p()){this.report=g();return}try{this.report=await _(),u(this.report),this.forbidden=!1}catch(s){s instanceof x&&s.status===403?this.forbidden=!0:this.error=h(s)}}async checkAll(){if(!this.busy){this.busy=!0,this.note="";try{p()?(this.report=await E(),u(this.report)):(await new Promise(s=>setTimeout(s,400)),this.report=g())}catch(s){this.note=s instanceof x&&s.status===429?e("הבדיקה הורצה הרגע. אפשר שוב בעוד {s} שנ׳.",{s:s.body.details?.retry_after_s??30}):h(s)}finally{this.busy=!1}}}async recordHandover(s){if(!this.busy){this.busy=!0,this.note="";try{p()?(this.report=await O(s,this.customer,this.handoverNote,this.printed),u(this.report)):this.report={...g(),handover:{...g().handover,done:s}}}catch(a){this.note=h(a)}finally{this.busy=!1}}}openSettings(){this.report&&(this.draft={...this.report.settings},this.settingsError="",this.settingsOpen=!0)}setDraft(s,a){this.draft={...this.draft,[s]:a}}async saveSettings(){if(!this.report)return;const s=T(this.report.settings,this.draft);if(!Object.keys(s).length){this.settingsOpen=!1;return}for(const[a,t]of Object.entries(s))if(!D(a,t)){this.settingsError=e("ערך לא תקין: יש להזין מספר שלם בטווח המותר.");return}this.busy=!0;try{p()&&await C(s),this.settingsOpen=!1,await this.load()}catch(a){this.settingsError=h(a)}finally{this.busy=!1}}async openDemo(){if(this.demoError="",this.demoOpen=!0,p())try{this.demo=await R()}catch(s){this.demoError=h(s)}}async confirmDemo(){this.busy=!0,this.demoError="";try{p()?(await N(this.demoSet.dataset,this.demoSet.scenario,this.demoSet.hours),window.location.reload()):this.demoOpen=!1}catch(s){this.demoError=h(s)}finally{this.busy=!1}}ring(s){const a=y*s.score/100;return i`<div class="ring" data-tone=${$(s.level)} role="img" aria-label=${e("ציון מוכנות {score} מתוך 100",{score:s.score})} data-score-ring>
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r=${m}></circle><circle class="fg" cx="60" cy="60" r=${m} stroke-dasharray=${`${a} ${y}`}></circle></svg>
      <div class="v"><b data-score>${s.score}</b><small>${e("מתוך 100")}</small></div>
    </div>`}hero(s){const a=s.handover.blockers.map(n=>s.checks.find(c=>c.id===n)?.title??n),t=s.history[1];return i`<section class="panel hero" data-tone=${$(s.level)} data-hero>
      ${this.ring(s)}
      <div class="lvl">
        <div class="name"><span data-level>${k[s.level]}</span>${a.length?i`<span class="badge blocked" data-blockers><sw-icon name="warning" size=${12}></sw-icon>${a.length===1?e("חסם אחד"):e("{n} חסמים",{n:a.length})}</span>`:d}</div>
        <div class="hint" data-advice>${e("מסירה ללקוח מומלצת מציון {score} ובלי חסמים. זו המלצה בלבד: אפשר למסור גם קודם, והמסירה תירשם עם הציון שהיה.",{score:s.bands.advice})}</div>
        <div class="scale" aria-hidden="true"><span class=${s.score>=0?"on":""}></span><span class=${s.score>=s.bands.almost_min?"on":""}></span><span class=${s.score>=s.bands.advice?"on":""}></span></div>
        <div class="scale-l" aria-hidden="true"><span>${e("בהקמה")} · 0-${s.bands.almost_min-1}</span><span>${e("כמעט מוכן")} · ${s.bands.almost_min}-${s.bands.advice-1}</span><span>${e("מוכן למסירה")} · ${s.bands.advice}+</span></div>
        <div class="gates">${a.map(n=>i`<span class="chip blocked">${e("חסם: {name}",{name:n})}</span>`)}${t?i`<span class="chip">${e("ציון קודם: {score} ({time})",{score:t.score,time:b(t.at)})}</span>`:d}</div>
      </div>
    </section>`}kpis(s){const a=j(s.checks);return i`<div class="kpis" role="group" aria-label=${e("סינון לפי מצב")} data-kpis>
      ${A.map(t=>i`<button type="button" class="kpi" data-k=${t} data-look=${t} aria-pressed=${this.kpi===t?"true":"false"} @click=${()=>this.kpi=t}><span class="dot" aria-hidden="true"></span><div><b>${a[t]}</b><span class="l">${L[t]}</span></div></button>`)}
    </div>`}row(s){const a=P(s),t=s.fraction===null?0:Math.round(s.fraction*100);return i`<article class="row" data-check=${s.id} data-status=${s.status}>
      <span class="disc" data-status=${s.status} aria-hidden="true"><sw-icon name=${ss[s.status]} size=${14}></sw-icon></span>
      <div class="main">
        <div class="t"><h3>${s.title}</h3><span class="badge ${s.status}" data-check-status>${I[s.status]}</span>${s.critical?i`<span class="chip crit">${e("קריטי")}</span>`:d}<span class="chip">${s.source==="computed"?e("נמדד"):e("מאושר ידנית")}</span></div>
        <p class="sum">${s.summary}</p>
        ${s.applicable?i`<div class="bar" aria-hidden="true"><i style=${`inline-size:${t}%`}></i></div>`:d}
        ${s.facts.length?i`<div class="facts">${s.facts.slice(0,4).map(n=>i`<span class="chip ${n.ok===!1?"warn":n.ok?"good":""}">${n.label}: ${n.value}</span>`)}</div>`:d}
      </div>
      <div class="end">${s.applicable?i`<span class="pts" data-points>${a.got}/${a.of}</span>`:d}${s.next?i`<a class=${`go ${s.status==="blocked"?"pri":""}`} href=${s.next.href} data-next-link>${s.next.label} ‹</a>`:d}</div>
    </article>`}checks(s){const a=H(s.checks,this.kpi);return i`<section class="col checks" data-checks aria-label=${e("הבדיקות")}>
      ${a.length?M(a,t=>t.id,t=>this.row(t)):i`<sw-state-panel icon="rule" state="empty" compact heading=${e("אין בדיקות במצב הזה")}></sw-state-panel>`}
    </section>`}steps(s){return i`<div class="panel" data-steps><div class="hd"><h2>${e("הצעדים הבאים")}</h2><span class="mut">${e("לפי תרומה לציון")}</span></div>
      ${s.next_steps.length?i`<ol class="next">${s.next_steps.map((a,t)=>i`<li><span class="n">${t+1}</span><a href=${a.href} data-step-link><b>${a.title}</b><span>${a.label}</span></a>${a.gain?i`<span class="gain" data-gain>${X(a.gain)}</span>`:d}</li>`)}</ol>`:i`<p class="mut">${e("אין צעדים פתוחים.")}</p>`}
    </div>`}handoverCard(s){const a=s.handover,t=a.done;return i`<div class="panel" data-handover><div class="hd"><h2>${e("מסירה ללקוח")}</h2><span class="chip ${t?"good":""}" data-handover-state>${t?e("נרשמה"):e("ממתין")}</span></div>
      <p class="mut">${a.advice_met?e("הציון עומד בהמלצה ({score}+) וללא חסמים.",{score:a.advice_score}):e("המלצה: ציון {score}+ וללא חסמים. אפשר לרשום מסירה גם קודם.",{score:a.advice_score})}</p>
      ${t?d:i`<div class="form"><label>${e("שם הלקוח")}<input class="inp" type="text" maxlength="120" .value=${this.customer} @input=${n=>this.customer=n.target.value} data-customer></label>
            <label class="inline"><sw-toggle size="sm" labelHidden in-label label=${e("המדריך המודפס נמסר")} data-readiness-printed .checked=${this.printed} @change=${n=>this.printed=K(n)}></sw-toggle>${e("המדריך המודפס נמסר")}</label></div>`}
      ${!t&&!a.advice_met?i`<p class="warn" data-below-advice><sw-icon name="info" size=${13}></sw-icon>${a.blockers.length?e("המסירה תירשם כמוקדמת: ציון {score} ו־{n} חסמים.",{score:s.score,n:a.blockers.length}):e("המסירה תירשם כמוקדמת: ציון {score}.",{score:s.score})}</p>`:d}
      <div class="btns"><sw-button size="sm" variant=${t?"secondary":"primary"} ?disabled=${this.busy} data-handover-btn @click=${()=>void this.recordHandover(!t)}>${t?e("ביטול רישום המסירה"):a.advice_met?e("רישום מסירה"):e("רישום מסירה מוקדמת")}</sw-button></div>
    </div>`}historyCard(s){return i`<div class="panel" data-history><div class="hd"><h2>${e("היסטוריה")}</h2></div>
      ${s.history.length?i`<ul class="hist">${s.history.map((a,t)=>i`<li><span class="dot ${a.level}"></span><span class="t">${e("ציון {score}",{score:a.score})} · ${k[a.level]}${t===0?` ${e("(אחרון)")}`:""}</span><span class="w">${b(a.at)}</span></li>`)}</ul>`:i`<p class="mut">${e('עדיין לא נרשם ציון. "בדוק הכול" רושם את הראשון.')}</p>`}
    </div>`}settingsDialog(s){return i`<sw-dialog ?open=${this.settingsOpen} wide heading=${e("הגדרות סף ומשקלים")} subheading=${e("כל הספים והמשקלים של המוכנות. נשמר בהתקנה ונרשם באודיט.")} ?locked=${this.busy} @close=${()=>this.settingsOpen=!1} data-settings-dialog>
      <div class="sform">
        ${U.map(a=>i`<label><span>${a.label}</span><span class="u"><input class="inp num" inputmode="numeric" .value=${this.draft[a.key]??""} @input=${t=>this.setDraft(a.key,t.target.value.trim())} data-setting=${a.key}>${a.unit}</span></label>`)}
        <h4>${e("משקל כל בדיקה (0 = לא נספרת)")}</h4>
        ${s.checks.map(a=>i`<label><span>${a.title}</span><span class="u"><input class="inp num" inputmode="numeric" .value=${this.draft[f(a.id)]??""} @input=${t=>this.setDraft(f(a.id),t.target.value.trim())} data-setting=${f(a.id)}>${e("נק׳")}</span></label>`)}
        ${this.settingsError?i`<p class="err" role="alert" data-settings-error>${this.settingsError}</p>`:d}
      </div>
      <div slot="footer" class="dfoot"><sw-button variant="ghost" @click=${()=>this.settingsOpen=!1}>${e("ביטול")}</sw-button><sw-button variant="primary" ?disabled=${this.busy} data-settings-save @click=${()=>void this.saveSettings()}>${e("שמירה")}</sw-button></div>
    </sw-dialog>`}demoDialog(){const s=this.demo,a=p()&&s!==null&&!s.can_run;return i`<sw-dialog ?open=${this.demoOpen} heading=${e("מצב הדגמה")} subheading=${e("התקנה לדוגמה על מסד נתונים נפרד")} ?locked=${this.busy} @close=${()=>this.demoOpen=!1} data-demo-dialog>
      <div class="sform">
        <label><span>${e("מערך נתונים")}</span><sw-field><select class="inp" .value=${this.demoSet.dataset} @change=${t=>this.demoSet={...this.demoSet,dataset:t.target.value}} data-demo-dataset>${(s?.datasets??["residential","office","retail"]).map(t=>i`<option value=${t} ?selected=${this.demoSet.dataset===t}>${G[t]}</option>`)}</select></sw-field></label>
        <label><span>${e("תרחיש")}</span><sw-field><select class="inp" .value=${this.demoSet.scenario} @change=${t=>this.demoSet={...this.demoSet,scenario:t.target.value}} data-demo-scenario>${(s?.scenarios??["normal","cameras_offline","new_installation"]).map(t=>i`<option value=${t} ?selected=${this.demoSet.scenario===t}>${q[t]}</option>`)}</select></sw-field></label>
        <label><span>${e("משך")}</span><sw-field><select class="inp" .value=${String(this.demoSet.hours)} @change=${t=>this.demoSet={...this.demoSet,hours:Number(t.target.value)}} data-demo-hours>${B.map(t=>i`<option value=${t} ?selected=${this.demoSet.hours===t}>${t===24?e("עד 24 שעות (מקסימום)"):e("{n} ש׳",{n:t})}</option>`)}</select></sw-field></label>
        <p class="warn"><sw-icon name="warning" size=${14}></sw-icon>${e("הנתונים מדומים ונפרדים מההתקנה האמיתית. פעולות למצלמות, לדלתות ולמכשירים חסומות. כל המשתמשים רואים שההדגמה פועלת. ההדגמה מסתיימת בעצמה, ואיתחול המערכת מסיים אותה. הפעלה ויציאה נרשמות באודיט.")}</p>
        ${a?i`<p class="err" role="alert" data-demo-denied>${e('אין לך הרשאה להפעיל הדגמה (נדרשת ההרשאה "הפעלת מצב הדגמה").')}</p>`:d}
        ${this.demoError?i`<p class="err" role="alert" data-demo-error>${this.demoError}</p>`:d}
      </div>
      <div slot="footer" class="dfoot"><sw-button variant="ghost" @click=${()=>this.demoOpen=!1}>${e("ביטול")}</sw-button><sw-button variant="primary" icon="play" ?disabled=${this.busy||a} data-demo-start @click=${()=>void this.confirmDemo()}>${e("הפעלת הדגמה")}</sw-button></div>
    </sw-dialog>`}render(){const s=this.report,a=s?`${e("מערכת")} · ${e("{n} בדיקות",{n:s.checks.length})} · ${e("הבדיקות קוראות בלבד מהמכשירים")} · ${e("נבדק {time}",{time:b(s.checked_at)})}${p()?"":` · ${e("נתוני הדגמה")}`}`:`${e("מערכת")} · ${e("הבדיקות קוראות בלבד מהמכשירים")}`;return i`<sw-page heading=${e("מוכנות ההתקנה")} subheading=${a}>
      <span slot="actions" class="acts">
        ${p()&&!F("demo.run")?d:i`<sw-button icon="play" ?disabled=${!s} data-open-demo @click=${()=>void this.openDemo()}>${e("מצב הדגמה")}</sw-button>`}
        <sw-button icon="wrench" ?disabled=${!s} data-open-settings @click=${()=>this.openSettings()}>${e("הגדרות סף")}</sw-button>
        <sw-button variant="primary" icon="refresh" ?disabled=${!s||this.busy} data-check-all @click=${()=>void this.checkAll()}>${this.busy?e("בודק…"):e("בדוק הכול")}</sw-button>
      </span>
      ${this.forbidden?i`<sw-state-panel state="forbidden" heading=${e("אין הרשאה למסך הזה")} hint=${e("מוכנות ההתקנה פתוחה למי שמגדיר את המערכת.")}></sw-state-panel>`:this.error?i`<sw-state-panel state="error" heading=${e("מצב המוכנות לא נטען")} hint=${this.error} actionLabel=${e("ניסיון חוזר")} @action=${()=>void this.load()}></sw-state-panel>`:s?i`<div class="fit" data-readiness>
                ${this.note?i`<p class="note" role="status" data-note>${this.note}</p>`:d}
                ${this.hero(s)}${this.kpis(s)}
                <div class="panes" role="tablist" aria-label=${e("חלוקת המסך")} data-panes>
                  ${["checks","steps","handover"].map(t=>i`<button type="button" role="tab" aria-selected=${this.pane===t?"true":"false"} @click=${()=>this.pane=t}>${t==="checks"?e("בדיקות"):t==="steps"?e("צעדים"):e("מסירה והיסטוריה")}</button>`)}
                </div>
                <div class="cols" data-pane=${this.pane}>
                  ${this.checks(s)}
                  <div class="col side">${this.steps(s)}${this.handoverCard(s)}${this.historyCard(s)}</div>
                </div>
              </div>`:i`<sw-state-panel state="loading" heading=${e("קורא את מצב ההתקנה…")}></sw-state-panel>`}
      ${s?this.settingsDialog(s):d}${this.demoDialog()}
    </sw-page>`}};r.styles=[J,Y`
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
    /* CMP2-POLISH-2480 (owner N49): the warning / success badges keep their colours, the label is the dark ink of that colour
       (--sw-on-warning / --sw-on-success, >= 4.5:1) - white on green / orange was under 3:1 */
    .badge.attention {
      background: var(--sw-warning);
      color: var(--sw-on-warning);
    }
    .badge.ok {
      background: var(--sw-success);
      color: var(--sw-on-success);
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
  `];o([l()],r.prototype,"report",2);o([l()],r.prototype,"error",2);o([l()],r.prototype,"forbidden",2);o([l()],r.prototype,"busy",2);o([l()],r.prototype,"note",2);o([l()],r.prototype,"kpi",2);o([l()],r.prototype,"pane",2);o([l()],r.prototype,"customer",2);o([l()],r.prototype,"printed",2);o([l()],r.prototype,"handoverNote",2);o([l()],r.prototype,"settingsOpen",2);o([l()],r.prototype,"draft",2);o([l()],r.prototype,"settingsError",2);o([l()],r.prototype,"demoOpen",2);o([l()],r.prototype,"demo",2);o([l()],r.prototype,"demoSet",2);o([l()],r.prototype,"demoError",2);r=o([Z("system-readiness")],r);export{r as SystemReadiness};
