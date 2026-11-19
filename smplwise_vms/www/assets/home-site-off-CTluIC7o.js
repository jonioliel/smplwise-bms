import{i as _,a2 as m,db as E,a as x,d8 as t,n as y,dc as B,dd as C,b as l,de as b,A as $,ar as c,cp as z,g as P,j as f,k as j}from"./index-rXjlW4bK.js";import"./sw-logo-art-PLtEZJxU.js";var A=Object.defineProperty,D=Object.getOwnPropertyDescriptor,u=(s,i,e,a)=>{for(var r=a>1?void 0:a?D(i,e):i,v=s.length-1,n;v>=0;v--)(n=s[v])&&(r=(a?n(i,e,r):n(r))||r);return a&&r&&A(i,e,r),r};let d=class extends _{constructor(){super(...arguments),this.phase="closed",this.kind="all_off",this.buildings=[],this.checked={},this.single=!1,this.ack=!1,this.previews=[],this.records=[],this.error="",this.follow=null,this.close=()=>{this.phase!=="loading"&&(this.phase="closed")}}get running(){return this.phase==="running"||this.phase==="loading"}show(s){this.running||(this.kind=s.kind,this.buildings=s.buildings,this.checked={...s.checked},this.single=s.single,this.ack=!1,this.previews=[],this.records=[],this.error="",this.phase="pick",s.single&&this.load())}chosen(){return this.buildings.filter(s=>this.checked[s.id])}async load(){const s=this.chosen();if(this.phase="loading",!m()){this.previews=[],this.phase=s.some(i=>i.activeOn>0)?"confirm":"nothing";return}try{const i=[];for(const e of s)for(const a of e.targets)i.push({b:e.id,p:await E(a.scope,a.id,this.kind,void 0,void 0,void 0,a.building)});this.previews=i.filter(e=>e.p.count>0),this.phase=this.previews.length?"confirm":"nothing"}catch(i){this.error=i instanceof x&&i.status===403?t("אין לך הרשאה לפעולות מרוכזות בהיקף הזה."):y(i),this.phase="error"}}async confirm(){if(!(this.phase!=="confirm"||!m()||!this.single&&this.chosen().length>1&&!this.ack)){this.phase="running";try{const s=[];for(const i of this.previews)s.push(await B(i.p.scope,i.p.id,this.kind,i.p.digest,void 0,void 0,void 0,i.p.building_id));this.records=s,this.follow={stopped:!1},await Promise.all(s.map((i,e)=>C(i,a=>this.records=this.records.map((r,v)=>v===e?a:r),this.follow))),this.phase="result",this.dispatchEvent(new CustomEvent("bulk-done",{bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof x&&s.code==="target_changed"?t("רשימת ההתקנים השתנתה מאז שנפתח החלון, ולכן חלק מהפקודות לא נשלחו. פתחו את הפעולה מחדש."):y(s),this.phase="error",this.dispatchEvent(new CustomEvent("bulk-done",{bubbles:!0,composed:!0}))}}}disconnectedCallback(){super.disconnectedCallback(),this.follow&&(this.follow.stopped=!0)}render(){if(this.phase==="closed")return l`<sw-dialog data-site-off="closed"></sw-dialog>`;const s=this.chosen(),i=this.single?t("{action} ב{place}",{action:b[this.kind],place:s[0]?.name??""}):t("{action} באתר?",{action:b[this.kind]});return l`<sw-dialog open ?locked=${this.phase==="loading"} data-site-off=${this.phase} heading=${i} @close=${this.close}>${this.body(s)}</sw-dialog>`}body(s){const i=(n=t("ביטול"))=>l`<sw-button data-site-off-cancel autofocus @click=${this.close}>${n}</sw-button>`;if(this.phase==="pick"){const n=this.buildings.reduce((o,g)=>o+g.activeOn,0),h=this.buildings.some(o=>o.shared&&!this.checked[o.id]);return l`<p class="lead">${t("תאורה, מתגים, מיזוג, תריסים ומסכים - {n} פעילים ב־{buildings} בניינים. בחרו מה נכלל:",{n:c(n),buildings:c(this.buildings.length)})}</p>
        <ul class="list" data-site-off-list>
          ${this.buildings.map(o=>l`<li><label class=${z({b:!0,shared:o.shared})}>
            <input type="checkbox" data-site-off-building=${o.id} .checked=${!!this.checked[o.id]} @change=${g=>this.checked={...this.checked,[o.id]:g.target.checked}} />
            <span class="nm">${o.name}</span><span class="hint">${t("{n} דולקות",{n:c(o.lightsOn)})} · ${t("{n} פעילים",{n:c(o.activeOn)})}</span>
          </label></li>`)}
        </ul>
        ${h?l`<div class="note" data-site-off-shared-note>${t('"משותף" (חניון, שער, חדר חשמל) לא נכלל כברירת מחדל - הגדרה בהגדרות המסך הראשי.')}</div>`:$}
        <div class="actions">${i()}<sw-button variant="danger" icon="bolt" data-site-off-next ?disabled=${!s.length} @click=${()=>void this.load()}>${t("המשך")} · ${t("{n} בניינים",{n:c(s.length)})}</sw-button></div>`}if(this.phase==="loading")return l`<div class="muted" data-site-off-loading>${t("בודק מה דולק…")}</div><div class="actions">${i()}</div>`;if(this.phase==="error")return l`<div class="err" data-site-off-error>${this.error}</div><div class="actions">${i(t("סגור"))}</div>`;if(this.phase==="nothing")return l`<div class="big" data-site-off-nothing>${t("אין מה לכבות")}</div><div class="muted">${t("בבחירה הזאת הכול כבר כבוי או שאין התקנים שאושרו לפעולה קבוצתית.")}</div><div class="actions">${i(t("סגור"))}</div>`;if(this.phase==="confirm"){const n=!m(),h=n?s.reduce((p,w)=>p+w.activeOn,0):this.previews.reduce((p,w)=>p+w.p.count,0),o=!this.single&&s.length>1,g=this.single?s[0]?.name??"":t("{n} בניינים",{n:c(s.length)});return l`<div class="big" data-site-off-question data-count=${h}>${this.single?t("{action} ב{place}: {n} התקנים",{action:b[this.kind],place:g,n:c(h)}):t("{action} ב־{place}: {n} התקנים",{action:b[this.kind],place:g,n:c(h)})}</div>
        <ul class="list">${s.map(p=>{const w=n?p.activeOn:this.previews.filter(k=>k.b===p.id).reduce((k,O)=>k+O.p.count,0);return l`<li class="muted" data-site-off-sum=${p.id}>${p.name} · ${t("{n} התקנים",{n:c(w)})}</li>`})}</ul>
        ${o?l`<label class="ack"><input type="checkbox" data-site-off-ack .checked=${this.ack} @change=${p=>this.ack=p.target.checked} />${t("אני מאשר כיבוי ב־{n} בניינים",{n:c(s.length)})}</label>`:$}
        ${n?l`<div class="note">${t("נתוני הדגמה: אין שרת מחובר, לא יישלח דבר.")}</div>`:$}
        <div class="actions">${i()}<sw-button variant="danger" icon="bolt" data-site-off-confirm ?disabled=${n||o&&!this.ack} @click=${()=>void this.confirm()}>${b[this.kind]} (${c(h)})</sw-button></div>`}const e=this.records.reduce((n,h)=>n+h.counts.total,0),a=this.records.reduce((n,h)=>n+h.counts.confirmed+(h.counts.sent??0),0),r=this.phase==="result",v=e?Math.round(a/e*100):0;return l`<div class=${z({headline:!0,ok:r&&a===e,partial:r&&a<e})} data-site-off-result=${r?a===e?"ok":"partial":"running"}>
        ${r?a===e?t("בוצע"):t("בוצע חלקית: {n} לא אושרו",{n:c(e-a)}):t("{ok} מתוך {total} אושרו",{ok:c(a),total:c(e)})}
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax=${e} aria-valuenow=${a} aria-label=${t("אושרו")}><div style=${`inline-size:${v}%`}></div></div>
      <div class="muted">${r?t("התקן ייחשב כבוי רק כשיתקבל דיווח על כך."):t("אפשר לסגור את החלון; הפעולה ממשיכה בשרת.")}</div>
      <div class="actions">${i(t("סגור"))}</div>`}};d.styles=P`
    .lead {
      margin: 0 0 6px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
    }
    .list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .list li + li {
      border-block-start: 1px solid var(--sw-border);
    }
    label.b {
      display: flex;
      align-items: center;
      gap: 10px;
      min-block-size: 44px;
      cursor: pointer;
      font-size: var(--sw-fs-base);
      color: var(--sw-text);
    }
    label.b input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
    }
    label.b.shared .nm {
      color: var(--sw-shared-text);
    }
    label.b.shared input {
      accent-color: var(--sw-shared);
    }
    .nm {
      font-weight: var(--sw-fw-semibold);
    }
    .hint {
      margin-inline-start: auto;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
    }
    .note {
      margin-block-start: 10px;
      padding: 8px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-sm);
    }
    .big {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-block-end: 6px;
    }
    .ack {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-block-start: 12px;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-danger-text);
      cursor: pointer;
    }
    .ack input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-danger);
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-base);
    }
    .err {
      color: var(--sw-danger-text, var(--sw-danger));
      font-weight: var(--sw-fw-semibold);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 10px;
      border-block-start: 1px solid var(--sw-border);
      margin-block-start: 12px;
    }
    .headline {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
    }
    .headline.ok {
      color: var(--sw-success-text, var(--sw-success));
    }
    .headline.partial {
      color: var(--sw-warning-text, var(--sw-warning));
    }
    .bar {
      block-size: 12px;
      border-radius: 999px;
      background: var(--sw-surface-3);
      overflow: hidden;
      margin-block: 8px;
    }
    .bar > div {
      block-size: 100%;
      background: var(--sw-success);
      transition: inline-size var(--sw-t-med) var(--sw-ease);
    }
  `;u([f()],d.prototype,"phase",2);u([f()],d.prototype,"kind",2);u([f()],d.prototype,"buildings",2);u([f()],d.prototype,"checked",2);u([f()],d.prototype,"single",2);u([f()],d.prototype,"ack",2);u([f()],d.prototype,"previews",2);u([f()],d.prototype,"records",2);u([f()],d.prototype,"error",2);d=u([j("home-site-off")],d);export{d as HomeSiteOff};
