import{g,b6 as x,ba as f,b9 as z,E as k,G as o,a as $,R as w,A as l,e as a,tb as R,tc as E,td as C,te as D,H as m}from"./index-DqJBc8eX.js";import{l as y}from"./live-BR4H1WeG.js";import"./sw-chip-BkdL83jX.js";import{fmtWhen as S}from"./access-CloU-baO.js";const I=()=>g("access/door-grants"),q=(e,t,s)=>x("access/door-grants/subjects",{subject_kind:e,subject_id:t,enabled:s,confirmed:!0}),L=(e,t,s)=>f(`access/door-grants/roles/${encodeURIComponent(e)}`,{enabled:t,revision:s,confirmed:!0}),O=()=>g("intercom/door-map"),T=(e,t,s)=>f(`intercom/door-map/${encodeURIComponent(e)}`,{station_id:t,relay:s,confirmed:!0}),A=e=>z(`intercom/door-map/${encodeURIComponent(e)}`),P=()=>x("intercom/door-map/apply-suggestions",{confirmed:!0}),U=(e,t)=>f(`intercom/stations/${encodeURIComponent(e)}/placement`,{...t,confirmed:!0}),G=()=>g("doors/settings"),H=e=>f("doors/settings",{editor_block:e,confirmed:!0}),M=()=>g("intercom/door-path-inventory");function N(e){return e.answer==="never"?"לעולם לא":e.answer==="yes"||e.includes?"כן":"לא - אפשר לתת למשתמשים בנפרד"}const j="ההרשאה כוללת גם צפייה ביומן הכניסות ובאנשי הקשר של האינטרקום.";function W(e,t){return t?`לתת ל${e} הרשאה לפתוח דלתות? ${j}`:`להסיר מ${e} את ההרשאה לפתוח דלתות?`}function B(e,t){return t?`לכלול פתיחת דלתות בתפקיד ${e}? ${j}`:`להסיר פתיחת דלתות מהתפקיד ${e}?`}function Q(e){return e.other.length?`שיוך אחר: ${e.other.map(t=>`${t.role_name} · ${t.scope_name}`).join(", ")}`:""}function K(e,t){const s=t.trim().toLowerCase();return s?e.filter(i=>i.name.toLowerCase().includes(s)):e}function V(e){return e?e.building_id?`building:${e.building_id}`:e.site_id?`site:${e.site_id}`:"":""}function F(e){return e.startsWith("building:")?{site_id:null,building_id:e.slice(9)}:e.startsWith("site:")?{site_id:e.slice(5),building_id:null}:{site_id:null,building_id:null}}function J(e){const t=[{value:"",label:"כל ההתקנה (ללא שיוך)"}];for(const s of e.sites){t.push({value:`site:${s.id}`,label:`אתר · ${s.name}`});for(const i of e.buildings.filter(n=>n.site_id===s.id))t.push({value:`building:${i.id}`,label:`${s.name} · ${i.name}`})}return t}function X(e,t){const s=t.station_id?e.stations.filter(n=>n.id===t.station_id):e.stations,i=[];for(const n of s)for(const d of n.relays)i.push({value:`${n.id}#${d.physical_index}`,label:`${n.name} · ${d.name||`ממסר ${d.physical_index}`}`});return i}function Y(e){const t=e.lastIndexOf("#");if(t<=0)return null;const s=Number(e.slice(t+1));return Number.isInteger(s)&&s>=1?{station_id:e.slice(0,t),relay:s}:null}function Z(e){return e.mapping&&e.mapping.valid?{tone:"live",text:e.mapping.source==="manual"?"משויך ידנית":"משויך"}:e.mapping?{tone:"stale",text:"השיוך אינו תקף כרגע - יש לשייך מחדש"}:e.suggestion?{tone:"unknown",text:"הצעה לשיוך מוכנה"}:{tone:"unknown",text:"לא משויך - הדלת לא תיפתח מ-Arx"}}const ee=[{id:"all",label:"הכול"},{id:"blocked",label:"הרצה נחסמת"},{id:"disable",label:"דורש השבתה"},{id:"review",label:"לבדיקה ידנית"}];function te(e,t){return t==="blocked"?e.filter(s=>s.run_guard!=="unchanged"):t==="disable"?e.filter(s=>s.disable_required):t==="review"?e.filter(s=>s.run_guard==="refused_unresolvable"):e}function _(e){if(!e.wiskey_present)return"אין דלתות אינטרקום בהתקנה";const t=e.counts;if(!t.items)return"אין פריטים שפותחים דלתות";const s=[`${t.items} פריטים`,`${t.door_steps} שלבי פתיחה`];return t.unresolvable&&s.push(`${t.unresolvable} לבדיקה ידנית`),t.disable_required&&s.push(`${t.disable_required} דורשים השבתה`),s.join(" · ")}const se={enabled:"פעיל",disabled:"מושבת",ready:"זמין",gone:"נמחק",unknown:"מצב לא ידוע"};function ae(e){return[e.kind_text,e.origin_text,se[e.state]].join(" · ")}function ne(e){const t=e.author?`נכתב בידי ${e.author}`:"כותב לא ידוע",s=e.approver?`אושר בידי ${e.approver}${e.approver_status==="approved"?"":` (${e.approver_text})`}`:e.approver_text;return`${t} · ${s}`}function ie(e,t){return e.last_run?`הרצה אחרונה: ${t(e.last_run.at)}`:"לא הורץ"}function re(e){return e.doors.length?e.doors.join(", "):e.door_steps?`${e.door_steps} שלבי פתיחה`:e.lock_steps?`${e.lock_steps} שלבי נעילה`:"לא ניתן לזהות"}function oe(e){return e.run_guard==="refused_unresolvable"?"stale":e.run_guard==="refused_not_converted"?"unknown":"neutral"}var le=Object.defineProperty,de=Object.getOwnPropertyDescriptor,r=(e,t,s,i)=>{for(var n=i>1?void 0:i?de(t,s):t,d=e.length-1,p;d>=0;d--)(p=e[d])&&(n=(i?p(t,s,n):p(n))||n);return i&&n&&le(t,s,n),n};const v=k`
  :host {
    display: block;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sw-s-3);
    flex-wrap: wrap;
    padding: var(--sw-s-2) 0;
    border-block-end: 1px solid var(--sw-border);
  }
  .row:last-child {
    border-block-end: 0;
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  .name {
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text);
  }
  .sub {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-sm);
  }
  h3 {
    margin: var(--sw-s-4) 0 var(--sw-s-1);
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
  }
  input,
  select {
    font: inherit;
    color: var(--sw-text);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    padding: var(--sw-s-1) var(--sw-s-2);
    min-block-size: 36px;
    max-inline-size: 100%;
  }
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  .tools {
    display: flex;
    gap: var(--sw-s-2);
    flex-wrap: wrap;
    align-items: center;
    margin-block-end: var(--sw-s-2);
  }
  .err {
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-sm);
  }
  .ctl {
    display: flex;
    gap: var(--sw-s-2);
    align-items: center;
    flex-wrap: wrap;
  }
  /* MEDIA-POLISH-2331: the cards of one element stack with the settings' own rhythm (no inline margins on the cards) */
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--sw-s-3);
  }
  /* one caption above a list of switches instead of the same label repeated beside every switch (each switch keeps its own name) */
  .colhead {
    display: flex;
    justify-content: space-between;
    gap: var(--sw-s-3);
    padding-block: var(--sw-s-1);
    border-block-end: 1px solid var(--sw-border);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .tools input[type='search'] {
    flex: 0 1 280px;
    min-inline-size: 0;
  }
  .row select {
    max-inline-size: min(100%, 320px);
  }
  /* touch: the fields are 44 px targets */
  @media (pointer: coarse) {
    input,
    select {
      min-block-size: 44px;
    }
  }
  @media (max-width: 767px) {
    .tools input[type='search'] {
      flex: 1 1 100%;
    }
    .ctl {
      inline-size: 100%;
    }
    .ctl select {
      flex: 1 1 auto;
      max-inline-size: none;
    }
  }
`;let u=class extends ${constructor(){super(...arguments),this.data=null,this.error="",this.busy=!1,this.q="",this.pending=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await I(),this.error=""}catch(e){this.error=w(e)}}async confirm(){const e=this.pending;if(e){this.busy=!0;try{e.kind==="subject"?await q(e.row.kind,e.row.id,e.enabled):await L(e.role.id,e.enabled,e.role.revision??1),this.pending=null,await this.load()}catch(t){this.error=w(t),this.pending=null}finally{this.busy=!1}}}subjectRow(e){const t=Q(e);return a`<div class="row" data-door-grant=${`${e.kind}:${e.id}`}>
      <div class="who"><span class="name">${e.name}</span>${t?a`<span class="sub">${t}</span>`:l}</div>
      <sw-toggle label=${`רשאי לפתוח דלתות: ${e.name}`} labelHidden .checked=${y(e.granted)} ?disabled=${this.busy||!this.data?.can_manage_subjects||!e.active&&!e.granted}
        @change=${s=>{this.pending={kind:"subject",row:e,enabled:s.detail.checked},this.requestUpdate()}}></sw-toggle>
    </div>`}roleRow(e){return e.custom?a`<div class="row" data-door-role=${e.id}>
      <div class="who"><span class="name">${e.name}</span><span class="sub">תפקיד מותאם</span></div>
      <sw-toggle label=${`כולל פתיחת דלתות: ${e.name}`} labelHidden .checked=${y(e.includes)} ?disabled=${this.busy||!e.editable}
        @change=${t=>{this.pending={kind:"role",role:e,enabled:t.detail.checked},this.requestUpdate()}}></sw-toggle>
    </div>`:a`<div class="row" data-door-role=${e.id}><div class="who"><span class="name">${e.name}</span><span class="sub">תפקיד מובנה</span></div><span class="sub" data-door-role-answer>${N(e)}</span></div>`}render(){if(this.error&&!this.data)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.data,t=K([...e.users,...e.groups],this.q),s=this.pending,i=s?s.kind==="subject"?s.row.name:s.role.name:"";return a`<sw-card heading="פתיחת דלתות" subheading="מי רשאי לפתוח דלתות אינטרקום מ-Arx · ברירת המחדל: כל הדלתות בהתקנה" data-door-grants-card>
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:l}
      <h3>משתמשים וקבוצות</h3>
      <div class="tools">
        <input type="search" placeholder="חיפוש לפי שם" aria-label="חיפוש לפי שם" .value=${this.q} @input=${n=>this.q=n.target.value} />
        <span class="sub">רק דלתות מסוימות: שיוך התפקיד "פותח דלתות" לעמדה, בלשונית המשתמשים או הקבוצות</span>
      </div>
      ${t.length?a`<div class="colhead" aria-hidden="true"><span>שם</span><span>רשאי לפתוח דלתות</span></div>${t.map(n=>this.subjectRow(n))}`:a`<sw-state-panel icon="door" state="empty" heading="אין משתמשים או קבוצות"></sw-state-panel>`}
      ${e.can_manage_roles?a`<h3>תפקידים</h3><div class="colhead" aria-hidden="true"><span>תפקיד</span><span>כולל פתיחת דלתות</span></div>${e.roles.map(n=>this.roleRow(n))}`:l}
      ${s?a`<sw-dialog open heading="פתיחת דלתות" data-door-grant-confirm @close=${()=>{this.pending=null}}>
            <p>${s.kind==="subject"?W(i,s.enabled):B(i,s.enabled)}</p>
            <sw-button slot="footer" variant="ghost" @click=${()=>{this.pending=null}}>ביטול</sw-button>
            <sw-button slot="footer" variant=${s.enabled?"primary":"danger"} data-door-grant-ok ?disabled=${this.busy} @click=${()=>this.confirm()}>אישור</sw-button>
          </sw-dialog>`:l}
    </sw-card>`}};u.styles=[v];r([o()],u.prototype,"data",2);r([o()],u.prototype,"error",2);r([o()],u.prototype,"busy",2);r([o()],u.prototype,"q",2);r([o()],u.prototype,"pending",2);u=r([m("sw-door-grants")],u);let c=class extends ${constructor(){super(...arguments),this.map=null,this.error="",this.busy=!1,this.picks={},this.settings=null,this.confirmEditor=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.map=await O(),this.settings=await G(),this.error=""}catch(e){this.error=w(e)}}async run(e){this.busy=!0;try{await e(),await this.load()}catch(t){this.error=w(t)}finally{this.busy=!1}}lockRow(e,t){const s=Z(t),i=X(e,t),n=t.mapping?`${t.mapping.station_id}#${t.mapping.relay}`:t.suggestion?`${t.suggestion.station_id}#${t.suggestion.relay}`:"",d=this.picks[t.entity_id]??n,p=Y(d);return a`<div class="row" data-door-map=${t.entity_id}>
      <div class="who"><span class="name">${t.name}</span><sw-badge kind=${s.tone} label=${s.text}></sw-badge></div>
      <div class="ctl">
        <select aria-label=${`ממסר עבור ${t.name}`} @change=${b=>this.picks={...this.picks,[t.entity_id]:b.target.value}}>
          <option value="" ?selected=${!d}>בחירת ממסר</option>
          ${i.map(b=>a`<option value=${b.value} ?selected=${b.value===d}>${b.label}</option>`)}
        </select>
        <sw-button size="sm" variant="primary" data-door-map-save ?disabled=${this.busy||!p||t.mapping?.valid&&d===n}
          @click=${()=>p&&this.run(()=>T(t.entity_id,p.station_id,p.relay))}>שמירה</sw-button>
        ${t.mapping?a`<sw-button size="sm" variant="ghost" data-door-map-clear ?disabled=${this.busy} @click=${()=>this.run(()=>A(t.entity_id))}>ביטול שיוך</sw-button>`:l}
      </div>
    </div>`}editorCard(e){const t=e.editor_block==="blocked"?"allowed":"blocked";return a`<sw-card heading="פריטים שפותחים דלתות" subheading="עורכי האוטומציות, הסקריפטים, הסצנות והתזמונים · הבדיקה נעשית בשרת בעת שמירה" data-door-editor-card>
      <div class="row" data-door-editor-block>
        <div class="who"><span class="name">${R(e.editor_block)}</span><span class="sub">${E(e)}</span></div>
        <sw-button size="sm" data-door-editor-switch ?disabled=${this.busy||t==="allowed"&&!e.editor_allowed_available} @click=${()=>{this.confirmEditor=t}}>${t==="allowed"?"לאפשר":"לחסום"}</sw-button>
      </div>
      <h3>תזמוני נעילה שלא יעבדו</h3>
      ${e.lock_jobs.length?e.lock_jobs.map(s=>a`<div class="row" data-door-lock-job=${s.schedule_id}><span class="name">${C(s)}</span></div>`):a`<sw-state-panel icon="door" state="empty" heading="אין תזמוני נעילה על דלתות אינטרקום"></sw-state-panel>`}
      ${this.confirmEditor?a`<sw-dialog open heading="פריטים שפותחים דלתות" data-door-editor-confirm @close=${()=>{this.confirmEditor=null}}>
            <p>${D(this.confirmEditor)}</p>
            <sw-button slot="footer" variant="ghost" @click=${()=>{this.confirmEditor=null}}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-door-editor-ok ?disabled=${this.busy} @click=${()=>{const s=this.confirmEditor;this.confirmEditor=null,s&&this.run(()=>H(s))}}>אישור</sw-button>
          </sw-dialog>`:l}
    </sw-card>`}render(){if(this.error&&!this.map)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.map)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.map,t=J(e),s=e.locks.filter(i=>i.suggestion).length;return a`<div class="stack">
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:l}
      <sw-card heading="מיקום תחנות" subheading="שיוך תחנה לאתר או למבנה: הרשאת פתיחה באתר או במבנה חלה גם על התחנות שבו" data-door-placement-card>
        ${e.stations.length?e.stations.map(i=>a`<div class="row" data-door-placement=${i.name}>
              <div class="who"><span class="name">${i.name}</span>${i.online?l:a`<span class="sub">התחנה לא זמינה</span>`}</div>
              <select aria-label=${`מיקום ${i.name}`} ?disabled=${this.busy} @change=${n=>this.run(()=>U(i.id,F(n.target.value)))}>
                ${t.map(n=>a`<option value=${n.value} ?selected=${n.value===V(i.placement)}>${n.label}</option>`)}
              </select>
            </div>`):a`<sw-state-panel icon="door" state="empty" heading="אין תחנות" hint=${e.has_copy?"WisKey לא מסר תחנות.":"נתוני WisKey אינם זמינים כרגע."}></sw-state-panel>`}
      </sw-card>
      <sw-card heading="שיוך דלתות" subheading="לכל מנעול אינטרקום: התחנה והממסר שהוא פותח · שיוך מפורש בלבד, לא לפי שם" data-door-map-card>
        ${s?a`<div class="tools"><sw-button size="sm" data-door-map-apply ?disabled=${this.busy} @click=${()=>this.run(()=>P())}>אישור ${s} הצעות חד-משמעיות</sw-button></div>`:l}
        ${e.locks.length?e.locks.map(i=>this.lockRow(e,i)):a`<sw-state-panel icon="door" state="empty" heading="אין מנעולי אינטרקום"></sw-state-panel>`}
      </sw-card>
      ${this.settings?this.editorCard(this.settings):l}
    </div>`}};c.styles=[v];r([o()],c.prototype,"map",2);r([o()],c.prototype,"error",2);r([o()],c.prototype,"busy",2);r([o()],c.prototype,"picks",2);r([o()],c.prototype,"settings",2);r([o()],c.prototype,"confirmEditor",2);c=r([m("sw-door-setup")],c);let h=class extends ${constructor(){super(...arguments),this.inv=null,this.error="",this.busy=!1,this.filter="all"}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.busy=!0;try{this.inv=await M(),this.error=""}catch(e){this.error=w(e)}finally{this.busy=!1}}itemRow(e){return a`<div class="row item" data-door-item=${e.key}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${ae(e)}</span>
        <span class="sub">${ne(e)} · ${ie(e,S)}</span>
      </div>
      <div class="facts">
        <sw-badge kind=${oe(e)} label=${e.run_guard_text}></sw-badge>
        <span class="sub">דלתות: ${re(e)}</span>
        <span class="sub">הצעה: ${e.suggestion_text}</span>
        ${e.unresolved.length?a`<span class="warn">${e.unresolved.join(" · ")}</span>`:l}
        ${e.disable_required?a`<span class="warn" data-door-item-disable>דורש השבתה - פועל לבד ואין לו מאשר תקף</span>`:l}
      </div>
    </div>`}render(){if(this.error&&!this.inv)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.inv)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.inv,t=te(e.items,this.filter);return a`<sw-card heading="פריטים שפותחים דלתות" subheading=${`דוח לקריאה בלבד · ${_(e)}`} data-door-inventory-card style="margin-block-start: var(--sw-s-3)">
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:l}
      <div class="tools">
        <div class="chips" role="group" aria-label="סינון">
          ${ee.map(s=>a`<sw-chip data-door-inventory-filter=${s.id} ?selected=${this.filter===s.id} @click=${()=>this.filter=s.id}>${s.label}</sw-chip>`)}
        </div>
        <sw-button size="sm" variant="ghost" data-door-inventory-refresh ?disabled=${this.busy} @click=${()=>this.load()}>רענון</sw-button>
      </div>
      ${t.length?t.map(s=>this.itemRow(s)):a`<sw-state-panel icon=${e.items.length?"filter":"door"} state="empty" heading=${e.items.length?"אין פריטים בסינון הזה":_(e)}></sw-state-panel>`}
    </sw-card>`}};h.styles=[v,k`
      .chips {
        display: flex;
        gap: var(--sw-s-1);
        flex-wrap: wrap;
      }
      .item .who {
        flex: 1 1 260px;
      }
      .facts {
        display: flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-start;
        flex: 1 1 220px;
        min-inline-size: 0;
      }
      .warn {
        color: var(--sw-warning-text, var(--sw-text-2));
        font-size: var(--sw-fs-sm);
      }
    `];r([o()],h.prototype,"inv",2);r([o()],h.prototype,"error",2);r([o()],h.prototype,"busy",2);r([o()],h.prototype,"filter",2);h=r([m("sw-door-inventory")],h);
//# sourceMappingURL=system-doors-Dk3EPHMD.js.map
