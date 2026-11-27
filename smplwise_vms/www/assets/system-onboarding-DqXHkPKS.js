import{a as f,aX as v,gl as h,gm as m,gn as $,af as c,aM as x,go as p,fZ as y,fS as u,fP as k,fQ as z,f_ as S,q as O,gp as _,A as l,dL as t,b as e,gq as P,gr as C,bo as E,gs as T,gt as j,gu as D,gv as L,j as q,k as w,m as A}from"./index-bjkrEUAJ.js";import{b as R}from"./bubble-chrome-wRf-BHoZ.js";import{a as I}from"./settings-BsA9TwNg.js";import"./sw-logo-art-PLtEZJxU.js";var U=Object.defineProperty,M=Object.getOwnPropertyDescriptor,d=(s,a,r,i)=>{for(var n=i>1?void 0:i?M(a,r):a,b=s.length-1,g;b>=0;b--)(g=s[b])&&(n=(i?g(a,r,n):g(n))||n);return i&&n&&U(a,r,n),n};const X={done:()=>t("הושלם"),open:()=>t("לביצוע"),info:()=>t("מידע")},F={done:"live",open:"partial",info:"neutral"};let o=class extends f{constructor(){super(...arguments),this.bubbleSkin=new v(this),this.items=null,this.error="",this.partial=!1,this.busy=!1,this.stops=[]}connectedCallback(){super.connectedCallback(),this.stops.push(h(()=>this.requestUpdate()),m(()=>this.requestUpdate())),T()||$(),this.load()}disconnectedCallback(){for(const s of this.stops)s();this.stops=[],super.disconnectedCallback()}get forbidden(){return c()&&!x("system.configure")}async load(){if(!c()){this.items=p(u(k(!1)),y());return}if(!this.forbidden){this.busy=!0;try{const[s,a]=await Promise.allSettled([z(),S()]);if(s.status==="rejected"&&a.status==="rejected"){this.error=O(s.reason);return}this.error="",this.partial=a.status==="rejected",this.items=p(s.status==="fulfilled"?u(s.value):null,a.status==="fulfilled"?a.value:null)}finally{this.busy=!1}}}renderSummary(s){const a=_(s),r=L(),i=a.total>0&&a.done===a.total;return e`<sw-card class="summary" ?data-all-done=${i} heading=${i?t("כל השלבים הושלמו"):t("{done} מתוך {total} שלבים הושלמו",{done:a.done,total:a.total})}
      subheading=${i?t("ההתקנה מוכנה לעבודה. אפשר להסתיר את הרשימה; היא נשארת זמינה מהגדרות ‹ תמיכה."):a.next?t("השלב הבא: {title}",{title:a.next.title}):""} data-onboarding-summary>
      <div class="bar" role="progressbar" aria-label=${t("התקדמות")} aria-valuemin="0" aria-valuemax=${a.total} aria-valuenow=${a.done}><i style=${`inline-size:${a.total?Math.round(a.done/a.total*100):0}%`}></i></div>
      <div class="go">
        ${a.next?e`<sw-button size="sm" variant="primary" data-onboarding-next @click=${()=>window.location.hash=a.next?.href??""}>${a.next.linkLabel}</sw-button>`:l}
        ${r?e`<sw-button size="sm" variant="ghost" icon="info" data-onboarding-restore @click=${()=>void j()}>${t("הצג שוב את הרשימה")}</sw-button>`:e`<sw-button size="sm" variant="ghost" icon="close" data-onboarding-dismiss @click=${()=>void P()}>${t("הסתר את הרשימה")}</sw-button>`}
      </div>
      ${r?e`<p class="note" role="status" data-onboarding-hidden>${t("הרשימה מוסתרת אצלך: היא לא נפתחת מעצמה ואין לה שורה מתחת ללשוניות.")}</p>`:l}
      ${c()&&!D()?e`<p class="note" role="status" data-onboarding-off>${t("הרשימה כבויה בהתקנה הזו: היא לא נפתחת מעצמה לאף אחד. מדליקים אותה בהגדרות ‹ תמיכה.")}</p>`:l}
    </sw-card>`}renderItem(s,a){return e`<li class="item" data-onboarding-item=${s.id} data-state=${s.state}>
      <span class="disc" data-state=${s.state} aria-hidden="true">${s.state==="done"?e`<sw-icon name="check" size=${14}></sw-icon>`:s.state==="info"?e`<sw-icon name="info" size=${14}></sw-icon>`:a}</span>
      <div class="main">
        <div class="t"><h3>${s.title}</h3><sw-badge kind=${F[s.state]} label=${X[s.state]()} data-onboarding-state></sw-badge>${s.optional&&s.state!=="info"?e`<span class="opt">${t("רשות")}</span>`:l}</div>
        <p class="sum">${s.detail}</p>
      </div>
      <a class="go" href=${s.href} data-onboarding-link>${s.linkLabel} ‹</a>
    </li>`}render(){const s=this.items,a=`${t("מה מגדירים קודם בהתקנה חדשה, לפי הסדר")} · ${t("כל שורה מובילה למסך שבו עושים אותה")}${c()?"":` · ${t("נתוני הדגמה")}`}`;return e`<sw-page heading=${t("תחילת עבודה")} subheading=${a}>
      ${this.forbidden?l:e`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} data-onboarding-refresh @click=${()=>void this.load()}>${this.busy?t("בודק…"):t("רענון")}</sw-button>`}
      ${this.forbidden?e`<sw-state-panel state="forbidden" heading=${t("אין הרשאה למסך הזה")} hint=${t("רשימת תחילת העבודה פתוחה למי שמגדיר את המערכת.")}></sw-state-panel>`:this.error?e`<sw-state-panel state="error" heading=${t("הרשימה לא נטענה")} hint=${this.error} actionLabel=${t("ניסיון חוזר")} @action=${()=>void this.load()}></sw-state-panel>`:s?e`<div class="wrap" data-onboarding>
                ${this.renderSummary(s)}
                ${this.partial?e`<p class="note" role="status" data-onboarding-partial>${t("בדיקות המוכנות לא נקראו, לכן מוצגים רק אשף ההתקנה ודף התמיכה.")}</p>`:l}
                <sw-card heading=${t("השלבים")}>
                  <ol class="list" aria-label=${t("השלבים")}>${E(s,r=>r.id,(r,i)=>this.renderItem(r,i+1))}</ol>
                </sw-card>
                <p class="hint">${t('המצב של כל שלב נמדד באשף ההתקנה ובמוכנות ההתקנה, ומתעדכן ב"רענון". מדריך התפעול היומיומי והתמיכה:')} <a href=${C}>${t("הגדרות ‹ תמיכה")}</a></p>
              </div>`:e`<sw-state-panel state="loading" heading=${t("קורא את מצב ההתקנה…")}></sw-state-panel>`}
    </sw-page>`}};o.styles=[I,q`
    .wrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      max-inline-size: calc(var(--sw-s-10) * 23); /* the wizard's 920: the settings column */
    }
    .bar {
      block-size: var(--sw-s-1h);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      border-radius: inherit;
      background: var(--sw-live);
    }
    .go {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      margin-block-start: var(--sw-s-3);
    }
    .note {
      margin: var(--sw-s-2) 0 0;
      padding: var(--sw-s-1h) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .wrap > .note {
      margin: 0;
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .item {
      display: flex;
      align-items: flex-start;
      gap: var(--sw-s-3);
      padding: var(--sw-s-3) 0;
    }
    .item + .item {
      border-block-start: thin solid var(--sw-border);
    }
    .disc {
      flex: none;
      display: grid;
      place-items: center;
      inline-size: var(--sw-s-8);
      block-size: var(--sw-s-8);
      border-radius: 50%;
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
    }
    .disc[data-state='done'] {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .disc[data-state='info'] {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .main {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .t {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .opt {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .sum {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .item .go {
      flex: none;
      margin: 0;
      align-self: center;
      color: var(--sw-accent);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    .item .go:hover {
      text-decoration: underline;
    }
    .hint {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .hint a {
      color: var(--sw-accent);
    }
    @media (max-width: 37.5em) {
      .item {
        flex-wrap: wrap;
      }
      .item .go {
        flex-basis: 100%;
        padding-inline-start: calc(var(--sw-s-8) + var(--sw-s-3));
      }
    }
  `,R];d([w()],o.prototype,"items",2);d([w()],o.prototype,"error",2);d([w()],o.prototype,"partial",2);d([w()],o.prototype,"busy",2);o=d([A("system-onboarding")],o);export{o as SystemOnboarding};
