import{g,aa as x,at as f,a9 as z,E as k,G as l,a as m,Y as b,A as o,e as a,uL as R,be as E,uM as C,uN as D,uO as S,uP as I,H as v}from"./index-DzLDO8kw.js";import{l as y}from"./live-DhVavdXM.js";import"./sw-chip-DXutn2u4.js";import{fmtWhen as L}from"./access-DRsBxxxH.js";const q=()=>g("access/door-grants"),O=(e,t,s)=>x("access/door-grants/subjects",{subject_kind:e,subject_id:t,enabled:s,confirmed:!0}),T=(e,t,s)=>f(`access/door-grants/roles/${encodeURIComponent(e)}`,{enabled:t,revision:s,confirmed:!0}),N=()=>g("intercom/door-map"),A=(e,t,s)=>f(`intercom/door-map/${encodeURIComponent(e)}`,{station_id:t,relay:s,confirmed:!0}),P=e=>z(`intercom/door-map/${encodeURIComponent(e)}`),M=()=>x("intercom/door-map/apply-suggestions",{confirmed:!0}),U=(e,t)=>f(`intercom/stations/${encodeURIComponent(e)}/placement`,{...t,confirmed:!0}),G=()=>g("doors/settings"),H=e=>f("doors/settings",{editor_block:e,confirmed:!0}),W=()=>g("intercom/door-path-inventory");function B(e){return e.answer==="never"?"לעולם לא":e.answer==="yes"||e.includes?"כן":"לא - אפשר לתת למשתמשים בנפרד"}const j="ההרשאה כוללת גם צפייה ביומן הכניסות ובאנשי הקשר של האינטרקום.";function Q(e,t){return t?`לתת ל${e} הרשאה לפתוח דלתות? ${j}`:`להסיר מ${e} את ההרשאה לפתוח דלתות?`}function K(e,t){return t?`לכלול פתיחת דלתות בתפקיד ${e}? ${j}`:`להסיר פתיחת דלתות מהתפקיד ${e}?`}function V(e){return e.other.length?`שיוך אחר: ${e.other.map(t=>`${t.role_name} · ${t.scope_name}`).join(", ")}`:""}function Y(e,t){const s=t.trim().toLowerCase();return s?e.filter(i=>i.name.toLowerCase().includes(s)):e}function F(e){return e?e.building_id?`building:${e.building_id}`:e.site_id?`site:${e.site_id}`:"":""}function J(e){return e.startsWith("building:")?{site_id:null,building_id:e.slice(9)}:e.startsWith("site:")?{site_id:e.slice(5),building_id:null}:{site_id:null,building_id:null}}function X(e){const t=[{value:"",label:"כל ההתקנה (ללא שיוך)"}];for(const s of e.sites){t.push({value:`site:${s.id}`,label:`אתר · ${s.name}`});for(const i of e.buildings.filter(n=>n.site_id===s.id))t.push({value:`building:${i.id}`,label:`${s.name} · ${i.name}`})}return t}function Z(e,t){const s=t.station_id?e.stations.filter(n=>n.id===t.station_id):e.stations,i=[];for(const n of s)for(const d of n.relays)i.push({value:`${n.id}#${d.physical_index}`,label:`${n.name} · ${d.name||`ממסר ${d.physical_index}`}`});return i}function ee(e){const t=e.lastIndexOf("#");if(t<=0)return null;const s=Number(e.slice(t+1));return Number.isInteger(s)&&s>=1?{station_id:e.slice(0,t),relay:s}:null}function te(e){return e.mapping&&e.mapping.valid?{tone:"live",text:e.mapping.source==="manual"?"משויך ידנית":"משויך"}:e.mapping?{tone:"stale",text:"השיוך אינו תקף כרגע - יש לשייך מחדש"}:e.suggestion?{tone:"unknown",text:"הצעה לשיוך מוכנה"}:{tone:"unknown",text:"לא משויך - הדלת לא תיפתח מ-Arx"}}const se=[{id:"all",label:"הכול"},{id:"blocked",label:"הרצה נחסמת"},{id:"disable",label:"דורש השבתה"},{id:"review",label:"לבדיקה ידנית"}];function ae(e,t){return t==="blocked"?e.filter(s=>s.run_guard!=="unchanged"):t==="disable"?e.filter(s=>s.disable_required):t==="review"?e.filter(s=>s.run_guard==="refused_unresolvable"):e}function _(e){if(!e.wiskey_present)return"אין דלתות אינטרקום בהתקנה";const t=e.counts;if(!t.items)return"אין פריטים שפותחים דלתות";const s=[`${t.items} פריטים`,`${t.door_steps} שלבי פתיחה`];return t.unresolvable&&s.push(`${t.unresolvable} לבדיקה ידנית`),t.disable_required&&s.push(`${t.disable_required} דורשים השבתה`),s.join(" · ")}const ne={enabled:"פעיל",disabled:"מושבת",ready:"זמין",gone:"נמחק",unknown:"מצב לא ידוע"};function ie(e){return[e.kind_text,e.origin_text,ne[e.state]].join(" · ")}function re(e){const t=e.author?`נכתב בידי ${e.author}`:"כותב לא ידוע",s=e.approver?`אושר בידי ${e.approver}${e.approver_status==="approved"?"":` (${e.approver_text})`}`:e.approver_text;return`${t} · ${s}`}function oe(e,t){return e.last_run?`הרצה אחרונה: ${t(e.last_run.at)}`:"לא הורץ"}function le(e){return e.doors.length?e.doors.join(", "):e.door_steps?`${e.door_steps} שלבי פתיחה`:e.lock_steps?`${e.lock_steps} שלבי נעילה`:"לא ניתן לזהות"}function de(e){return e.run_guard==="refused_unresolvable"?"stale":e.run_guard==="refused_not_converted"?"unknown":"neutral"}var ce=Object.defineProperty,pe=Object.getOwnPropertyDescriptor,r=(e,t,s,i)=>{for(var n=i>1?void 0:i?pe(t,s):t,d=e.length-1,p;d>=0;d--)(p=e[d])&&(n=(i?p(t,s,n):p(n))||n);return i&&n&&ce(t,s,n),n};const $=k`
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
  .notice {
    color: var(--sw-warning-text, var(--sw-text-2));
    font-size: var(--sw-fs-sm);
    padding: var(--sw-s-2) 0;
  }
  .notice a {
    color: var(--sw-accent-text, var(--sw-accent));
    text-decoration: underline;
    text-underline-offset: 2px;
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
`;let u=class extends m{constructor(){super(...arguments),this.data=null,this.error="",this.busy=!1,this.q="",this.pending=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await q(),this.error=""}catch(e){this.error=b(e)}}async confirm(){const e=this.pending;if(e){this.busy=!0;try{e.kind==="subject"?await O(e.row.kind,e.row.id,e.enabled):await T(e.role.id,e.enabled,e.role.revision??1),this.pending=null,await this.load()}catch(t){this.error=b(t),this.pending=null}finally{this.busy=!1}}}subjectRow(e){const t=V(e);return a`<div class="row" data-door-grant=${`${e.kind}:${e.id}`}>
      <div class="who"><span class="name">${e.name}</span>${t?a`<span class="sub">${t}</span>`:o}</div>
      <sw-toggle label=${`רשאי לפתוח דלתות: ${e.name}`} labelHidden .checked=${y(e.granted)} ?disabled=${this.busy||!this.data?.can_manage_subjects||!e.active&&!e.granted}
        @change=${s=>{this.pending={kind:"subject",row:e,enabled:s.detail.checked},this.requestUpdate()}}></sw-toggle>
    </div>`}unmappedNotice(e){const t=R(e.unmapped_doors,E("system.configure"));return t?a`<div class="notice" role="status" data-door-unmapped-notice>${t.text}${t.link?a` <a data-door-unmapped-link href=${t.link.href}>${t.link.label}</a>`:o}</div>`:o}roleRow(e){return e.custom?a`<div class="row" data-door-role=${e.id}>
      <div class="who"><span class="name">${e.name}</span><span class="sub">תפקיד מותאם</span></div>
      <sw-toggle label=${`כולל פתיחת דלתות: ${e.name}`} labelHidden .checked=${y(e.includes)} ?disabled=${this.busy||!e.editable}
        @change=${t=>{this.pending={kind:"role",role:e,enabled:t.detail.checked},this.requestUpdate()}}></sw-toggle>
    </div>`:a`<div class="row" data-door-role=${e.id}><div class="who"><span class="name">${e.name}</span><span class="sub">תפקיד מובנה</span></div><span class="sub" data-door-role-answer>${B(e)}</span></div>`}render(){if(this.error&&!this.data)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.data,t=Y([...e.users,...e.groups],this.q),s=this.pending,i=s?s.kind==="subject"?s.row.name:s.role.name:"";return a`<sw-card heading="פתיחת דלתות" subheading="מי רשאי לפתוח דלתות אינטרקום מ-Arx · ברירת המחדל: כל הדלתות בהתקנה" data-door-grants-card>
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:o}
      ${this.unmappedNotice(e)}
      <h3>משתמשים וקבוצות</h3>
      <div class="tools">
        <input type="search" placeholder="חיפוש לפי שם" aria-label="חיפוש לפי שם" .value=${this.q} @input=${n=>this.q=n.target.value} />
        <span class="sub">רק דלתות מסוימות: שיוך התפקיד "פותח דלתות" לעמדה, בלשונית המשתמשים או הקבוצות</span>
      </div>
      ${t.length?a`<div class="colhead" aria-hidden="true"><span>שם</span><span>רשאי לפתוח דלתות</span></div>${t.map(n=>this.subjectRow(n))}`:a`<sw-state-panel icon="door" state="empty" heading="אין משתמשים או קבוצות"></sw-state-panel>`}
      ${e.can_manage_roles?a`<h3>תפקידים</h3><div class="colhead" aria-hidden="true"><span>תפקיד</span><span>כולל פתיחת דלתות</span></div>${e.roles.map(n=>this.roleRow(n))}`:o}
      ${s?a`<sw-dialog open heading="פתיחת דלתות" data-door-grant-confirm @close=${()=>{this.pending=null}}>
            <p>${s.kind==="subject"?Q(i,s.enabled):K(i,s.enabled)}</p>
            <sw-button slot="footer" variant="ghost" @click=${()=>{this.pending=null}}>ביטול</sw-button>
            <sw-button slot="footer" variant=${s.enabled?"primary":"danger"} data-door-grant-ok ?disabled=${this.busy} @click=${()=>this.confirm()}>אישור</sw-button>
          </sw-dialog>`:o}
    </sw-card>`}};u.styles=[$];r([l()],u.prototype,"data",2);r([l()],u.prototype,"error",2);r([l()],u.prototype,"busy",2);r([l()],u.prototype,"q",2);r([l()],u.prototype,"pending",2);u=r([v("sw-door-grants")],u);let c=class extends m{constructor(){super(...arguments),this.map=null,this.error="",this.busy=!1,this.picks={},this.settings=null,this.confirmEditor=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.map=await N(),this.settings=await G(),this.error=""}catch(e){this.error=b(e)}}async run(e){this.busy=!0;try{await e(),await this.load()}catch(t){this.error=b(t)}finally{this.busy=!1}}lockRow(e,t){const s=te(t),i=Z(e,t),n=t.mapping?`${t.mapping.station_id}#${t.mapping.relay}`:t.suggestion?`${t.suggestion.station_id}#${t.suggestion.relay}`:"",d=this.picks[t.entity_id]??n,p=ee(d);return a`<div class="row" data-door-map=${t.entity_id}>
      <div class="who"><span class="name">${t.name}</span><sw-badge kind=${s.tone} label=${s.text}></sw-badge></div>
      <div class="ctl">
        <select aria-label=${`ממסר עבור ${t.name}`} @change=${w=>this.picks={...this.picks,[t.entity_id]:w.target.value}}>
          <option value="" ?selected=${!d}>בחירת ממסר</option>
          ${i.map(w=>a`<option value=${w.value} ?selected=${w.value===d}>${w.label}</option>`)}
        </select>
        <sw-button size="sm" variant="primary" data-door-map-save ?disabled=${this.busy||!p||t.mapping?.valid&&d===n}
          @click=${()=>p&&this.run(()=>A(t.entity_id,p.station_id,p.relay))}>שמירה</sw-button>
        ${t.mapping?a`<sw-button size="sm" variant="ghost" data-door-map-clear ?disabled=${this.busy} @click=${()=>this.run(()=>P(t.entity_id))}>ביטול שיוך</sw-button>`:o}
      </div>
    </div>`}editorCard(e){const t=e.editor_block==="blocked"?"allowed":"blocked";return a`<sw-card heading="פריטים שפותחים דלתות" subheading="עורכי האוטומציות, הסקריפטים, הסצנות והתזמונים · הבדיקה נעשית בשרת בעת שמירה" data-door-editor-card>
      <div class="row" data-door-editor-block>
        <div class="who"><span class="name">${C(e.editor_block)}</span><span class="sub">${D(e)}</span></div>
        <sw-button size="sm" data-door-editor-switch ?disabled=${this.busy||t==="allowed"&&!e.editor_allowed_available} @click=${()=>{this.confirmEditor=t}}>${t==="allowed"?"לאפשר":"לחסום"}</sw-button>
      </div>
      <h3>תזמוני נעילה שלא יעבדו</h3>
      ${e.lock_jobs.length?e.lock_jobs.map(s=>a`<div class="row" data-door-lock-job=${s.schedule_id}><span class="name">${S(s)}</span></div>`):a`<sw-state-panel icon="door" state="empty" heading="אין תזמוני נעילה על דלתות אינטרקום"></sw-state-panel>`}
      ${this.confirmEditor?a`<sw-dialog open heading="פריטים שפותחים דלתות" data-door-editor-confirm @close=${()=>{this.confirmEditor=null}}>
            <p>${I(this.confirmEditor)}</p>
            <sw-button slot="footer" variant="ghost" @click=${()=>{this.confirmEditor=null}}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-door-editor-ok ?disabled=${this.busy} @click=${()=>{const s=this.confirmEditor;this.confirmEditor=null,s&&this.run(()=>H(s))}}>אישור</sw-button>
          </sw-dialog>`:o}
    </sw-card>`}render(){if(this.error&&!this.map)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.map)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.map,t=X(e),s=e.locks.filter(i=>i.suggestion).length;return a`<div class="stack">
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:o}
      <sw-card heading="מיקום תחנות" subheading="שיוך תחנה לאתר או למבנה: הרשאת פתיחה באתר או במבנה חלה גם על התחנות שבו" data-door-placement-card>
        ${e.stations.length?e.stations.map(i=>a`<div class="row" data-door-placement=${i.name}>
              <div class="who"><span class="name">${i.name}</span>${i.online?o:a`<span class="sub">התחנה לא זמינה</span>`}</div>
              <select aria-label=${`מיקום ${i.name}`} ?disabled=${this.busy} @change=${n=>this.run(()=>U(i.id,J(n.target.value)))}>
                ${t.map(n=>a`<option value=${n.value} ?selected=${n.value===F(i.placement)}>${n.label}</option>`)}
              </select>
            </div>`):a`<sw-state-panel icon="door" state="empty" heading="אין תחנות" hint=${e.has_copy?"WisKey לא מסר תחנות.":"נתוני WisKey אינם זמינים כרגע."}></sw-state-panel>`}
      </sw-card>
      <sw-card heading="שיוך דלתות" subheading="לכל מנעול אינטרקום: התחנה והממסר שהוא פותח · שיוך מפורש בלבד, לא לפי שם" data-door-map-card>
        ${s?a`<div class="tools"><sw-button size="sm" data-door-map-apply ?disabled=${this.busy} @click=${()=>this.run(()=>M())}>אישור ${s} הצעות חד-משמעיות</sw-button></div>`:o}
        ${e.locks.length?e.locks.map(i=>this.lockRow(e,i)):a`<sw-state-panel icon="door" state="empty" heading="אין מנעולי אינטרקום"></sw-state-panel>`}
      </sw-card>
      ${this.settings?this.editorCard(this.settings):o}
    </div>`}};c.styles=[$];r([l()],c.prototype,"map",2);r([l()],c.prototype,"error",2);r([l()],c.prototype,"busy",2);r([l()],c.prototype,"picks",2);r([l()],c.prototype,"settings",2);r([l()],c.prototype,"confirmEditor",2);c=r([v("sw-door-setup")],c);let h=class extends m{constructor(){super(...arguments),this.inv=null,this.error="",this.busy=!1,this.filter="all"}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.busy=!0;try{this.inv=await W(),this.error=""}catch(e){this.error=b(e)}finally{this.busy=!1}}itemRow(e){return a`<div class="row item" data-door-item=${e.key}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${ie(e)}</span>
        <span class="sub">${re(e)} · ${oe(e,L)}</span>
      </div>
      <div class="facts">
        <sw-badge kind=${de(e)} label=${e.run_guard_text}></sw-badge>
        <span class="sub">דלתות: ${le(e)}</span>
        <span class="sub">הצעה: ${e.suggestion_text}</span>
        ${e.unresolved.length?a`<span class="warn">${e.unresolved.join(" · ")}</span>`:o}
        ${e.disable_required?a`<span class="warn" data-door-item-disable>דורש השבתה - פועל לבד ואין לו מאשר תקף</span>`:o}
      </div>
    </div>`}render(){if(this.error&&!this.inv)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.inv)return a`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.inv,t=ae(e.items,this.filter);return a`<sw-card heading="פריטים שפותחים דלתות" subheading=${`דוח לקריאה בלבד · ${_(e)}`} data-door-inventory-card style="margin-block-start: var(--sw-s-3)">
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:o}
      <div class="tools">
        <div class="chips" role="group" aria-label="סינון">
          ${se.map(s=>a`<sw-chip data-door-inventory-filter=${s.id} ?selected=${this.filter===s.id} @click=${()=>this.filter=s.id}>${s.label}</sw-chip>`)}
        </div>
        <sw-button size="sm" variant="ghost" data-door-inventory-refresh ?disabled=${this.busy} @click=${()=>this.load()}>רענון</sw-button>
      </div>
      ${t.length?t.map(s=>this.itemRow(s)):a`<sw-state-panel icon=${e.items.length?"filter":"door"} state="empty" heading=${e.items.length?"אין פריטים בסינון הזה":_(e)}></sw-state-panel>`}
    </sw-card>`}};h.styles=[$,k`
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
    `];r([l()],h.prototype,"inv",2);r([l()],h.prototype,"error",2);r([l()],h.prototype,"busy",2);r([l()],h.prototype,"filter",2);h=r([v("sw-door-inventory")],h);
//# sourceMappingURL=system-doors-CJqzTOr1.js.map
