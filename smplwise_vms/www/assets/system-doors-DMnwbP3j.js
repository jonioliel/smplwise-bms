import{g,b7 as x,bb as f,ba as z,E as k,G as o,a as $,R as w,A as l,e as a,th as R,ti as E,tj as C,tk as D,H as m}from"./index-BJCfUqyq.js";import{l as y}from"./live-D8XIk3r7.js";import"./sw-chip-B5_aZ_-s.js";import{fmtWhen as S}from"./access-BBkpeAGj.js";const I=()=>g("access/door-grants"),q=(t,e,s)=>x("access/door-grants/subjects",{subject_kind:t,subject_id:e,enabled:s,confirmed:!0}),L=(t,e,s)=>f(`access/door-grants/roles/${encodeURIComponent(t)}`,{enabled:e,revision:s,confirmed:!0}),O=()=>g("intercom/door-map"),T=(t,e,s)=>f(`intercom/door-map/${encodeURIComponent(t)}`,{station_id:e,relay:s,confirmed:!0}),A=t=>z(`intercom/door-map/${encodeURIComponent(t)}`),P=()=>x("intercom/door-map/apply-suggestions",{confirmed:!0}),U=(t,e)=>f(`intercom/stations/${encodeURIComponent(t)}/placement`,{...e,confirmed:!0}),G=()=>g("doors/settings"),H=t=>f("doors/settings",{editor_block:t,confirmed:!0}),M=()=>g("intercom/door-path-inventory");function N(t){return t.answer==="never"?"לעולם לא":t.answer==="yes"||t.includes?"כן":"לא - אפשר לתת למשתמשים בנפרד"}const j="ההרשאה כוללת גם צפייה ביומן הכניסות ובאנשי הקשר של האינטרקום.";function W(t,e){return e?`לתת ל${t} הרשאה לפתוח דלתות? ${j}`:`להסיר מ${t} את ההרשאה לפתוח דלתות?`}function B(t,e){return e?`לכלול פתיחת דלתות בתפקיד ${t}? ${j}`:`להסיר פתיחת דלתות מהתפקיד ${t}?`}function Q(t){return t.other.length?`שיוך אחר: ${t.other.map(e=>`${e.role_name} · ${e.scope_name}`).join(", ")}`:""}function K(t,e){const s=e.trim().toLowerCase();return s?t.filter(i=>i.name.toLowerCase().includes(s)):t}function V(t){return t?t.building_id?`building:${t.building_id}`:t.site_id?`site:${t.site_id}`:"":""}function F(t){return t.startsWith("building:")?{site_id:null,building_id:t.slice(9)}:t.startsWith("site:")?{site_id:t.slice(5),building_id:null}:{site_id:null,building_id:null}}function J(t){const e=[{value:"",label:"כל ההתקנה (ללא שיוך)"}];for(const s of t.sites){e.push({value:`site:${s.id}`,label:`אתר · ${s.name}`});for(const i of t.buildings.filter(n=>n.site_id===s.id))e.push({value:`building:${i.id}`,label:`${s.name} · ${i.name}`})}return e}function X(t,e){const s=e.station_id?t.stations.filter(n=>n.id===e.station_id):t.stations,i=[];for(const n of s)for(const d of n.relays)i.push({value:`${n.id}#${d.physical_index}`,label:`${n.name} · ${d.name||`ממסר ${d.physical_index}`}`});return i}function Y(t){const e=t.lastIndexOf("#");if(e<=0)return null;const s=Number(t.slice(e+1));return Number.isInteger(s)&&s>=1?{station_id:t.slice(0,e),relay:s}:null}function Z(t){return t.mapping&&t.mapping.valid?{tone:"live",text:t.mapping.source==="manual"?"משויך ידנית":"משויך"}:t.mapping?{tone:"stale",text:"השיוך אינו תקף כרגע - יש לשייך מחדש"}:t.suggestion?{tone:"unknown",text:"הצעה לשיוך מוכנה"}:{tone:"unknown",text:"לא משויך - הדלת לא תיפתח מ-Arx"}}const tt=[{id:"all",label:"הכול"},{id:"blocked",label:"הרצה נחסמת"},{id:"disable",label:"דורש השבתה"},{id:"review",label:"לבדיקה ידנית"}];function et(t,e){return e==="blocked"?t.filter(s=>s.run_guard!=="unchanged"):e==="disable"?t.filter(s=>s.disable_required):e==="review"?t.filter(s=>s.run_guard==="refused_unresolvable"):t}function _(t){if(!t.wiskey_present)return"אין דלתות אינטרקום בהתקנה";const e=t.counts;if(!e.items)return"אין פריטים שפותחים דלתות";const s=[`${e.items} פריטים`,`${e.door_steps} שלבי פתיחה`];return e.unresolvable&&s.push(`${e.unresolvable} לבדיקה ידנית`),e.disable_required&&s.push(`${e.disable_required} דורשים השבתה`),s.join(" · ")}const st={enabled:"פעיל",disabled:"מושבת",ready:"זמין",gone:"נמחק",unknown:"מצב לא ידוע"};function at(t){return[t.kind_text,t.origin_text,st[t.state]].join(" · ")}function nt(t){const e=t.author?`נכתב בידי ${t.author}`:"כותב לא ידוע",s=t.approver?`אושר בידי ${t.approver}${t.approver_status==="approved"?"":` (${t.approver_text})`}`:t.approver_text;return`${e} · ${s}`}function it(t,e){return t.last_run?`הרצה אחרונה: ${e(t.last_run.at)}`:"לא הורץ"}function rt(t){return t.doors.length?t.doors.join(", "):t.door_steps?`${t.door_steps} שלבי פתיחה`:t.lock_steps?`${t.lock_steps} שלבי נעילה`:"לא ניתן לזהות"}function ot(t){return t.run_guard==="refused_unresolvable"?"stale":t.run_guard==="refused_not_converted"?"unknown":"neutral"}var lt=Object.defineProperty,dt=Object.getOwnPropertyDescriptor,r=(t,e,s,i)=>{for(var n=i>1?void 0:i?dt(e,s):e,d=t.length-1,p;d>=0;d--)(p=t[d])&&(n=(i?p(e,s,n):p(n))||n);return i&&n&&lt(e,s,n),n};const v=k`
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
`;let u=class extends ${constructor(){super(...arguments),this.data=null,this.error="",this.busy=!1,this.q="",this.pending=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await I(),this.error=""}catch(t){this.error=w(t)}}async confirm(){const t=this.pending;if(t){this.busy=!0;try{t.kind==="subject"?await q(t.row.kind,t.row.id,t.enabled):await L(t.role.id,t.enabled,t.role.revision??1),this.pending=null,await this.load()}catch(e){this.error=w(e),this.pending=null}finally{this.busy=!1}}}subjectRow(t){const e=Q(t);return a`<div class="row" data-door-grant=${`${t.kind}:${t.id}`}>
      <div class="who"><span class="name">${t.name}</span>${e?a`<span class="sub">${e}</span>`:l}</div>
      <sw-toggle label=${`רשאי לפתוח דלתות: ${t.name}`} labelHidden .checked=${y(t.granted)} ?disabled=${this.busy||!this.data?.can_manage_subjects||!t.active&&!t.granted}
        @change=${s=>{this.pending={kind:"subject",row:t,enabled:s.detail.checked},this.requestUpdate()}}></sw-toggle>
    </div>`}roleRow(t){return t.custom?a`<div class="row" data-door-role=${t.id}>
      <div class="who"><span class="name">${t.name}</span><span class="sub">תפקיד מותאם</span></div>
      <sw-toggle label=${`כולל פתיחת דלתות: ${t.name}`} labelHidden .checked=${y(t.includes)} ?disabled=${this.busy||!t.editable}
        @change=${e=>{this.pending={kind:"role",role:t,enabled:e.detail.checked},this.requestUpdate()}}></sw-toggle>
    </div>`:a`<div class="row" data-door-role=${t.id}><div class="who"><span class="name">${t.name}</span><span class="sub">תפקיד מובנה</span></div><span class="sub" data-door-role-answer>${N(t)}</span></div>`}render(){if(this.error&&!this.data)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return a`<sw-state-panel state="loading"></sw-state-panel>`;const t=this.data,e=K([...t.users,...t.groups],this.q),s=this.pending,i=s?s.kind==="subject"?s.row.name:s.role.name:"";return a`<sw-card heading="פתיחת דלתות" subheading="מי רשאי לפתוח דלתות אינטרקום מ-Arx · ברירת המחדל: כל הדלתות בהתקנה" data-door-grants-card>
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:l}
      <h3>משתמשים וקבוצות</h3>
      <div class="tools">
        <input type="search" placeholder="חיפוש לפי שם" aria-label="חיפוש לפי שם" .value=${this.q} @input=${n=>this.q=n.target.value} />
        <span class="sub">רק דלתות מסוימות: שיוך התפקיד "פותח דלתות" לעמדה, בלשונית המשתמשים או הקבוצות</span>
      </div>
      ${e.length?a`<div class="colhead" aria-hidden="true"><span>שם</span><span>רשאי לפתוח דלתות</span></div>${e.map(n=>this.subjectRow(n))}`:a`<sw-state-panel icon="door" state="empty" heading="אין משתמשים או קבוצות"></sw-state-panel>`}
      ${t.can_manage_roles?a`<h3>תפקידים</h3><div class="colhead" aria-hidden="true"><span>תפקיד</span><span>כולל פתיחת דלתות</span></div>${t.roles.map(n=>this.roleRow(n))}`:l}
      ${s?a`<sw-dialog open heading="פתיחת דלתות" data-door-grant-confirm @close=${()=>{this.pending=null}}>
            <p>${s.kind==="subject"?W(i,s.enabled):B(i,s.enabled)}</p>
            <sw-button slot="footer" variant="ghost" @click=${()=>{this.pending=null}}>ביטול</sw-button>
            <sw-button slot="footer" variant=${s.enabled?"primary":"danger"} data-door-grant-ok ?disabled=${this.busy} @click=${()=>this.confirm()}>אישור</sw-button>
          </sw-dialog>`:l}
    </sw-card>`}};u.styles=[v];r([o()],u.prototype,"data",2);r([o()],u.prototype,"error",2);r([o()],u.prototype,"busy",2);r([o()],u.prototype,"q",2);r([o()],u.prototype,"pending",2);u=r([m("sw-door-grants")],u);let c=class extends ${constructor(){super(...arguments),this.map=null,this.error="",this.busy=!1,this.picks={},this.settings=null,this.confirmEditor=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.map=await O(),this.settings=await G(),this.error=""}catch(t){this.error=w(t)}}async run(t){this.busy=!0;try{await t(),await this.load()}catch(e){this.error=w(e)}finally{this.busy=!1}}lockRow(t,e){const s=Z(e),i=X(t,e),n=e.mapping?`${e.mapping.station_id}#${e.mapping.relay}`:e.suggestion?`${e.suggestion.station_id}#${e.suggestion.relay}`:"",d=this.picks[e.entity_id]??n,p=Y(d);return a`<div class="row" data-door-map=${e.entity_id}>
      <div class="who"><span class="name">${e.name}</span><sw-badge kind=${s.tone} label=${s.text}></sw-badge></div>
      <div class="ctl">
        <select aria-label=${`ממסר עבור ${e.name}`} @change=${b=>this.picks={...this.picks,[e.entity_id]:b.target.value}}>
          <option value="" ?selected=${!d}>בחירת ממסר</option>
          ${i.map(b=>a`<option value=${b.value} ?selected=${b.value===d}>${b.label}</option>`)}
        </select>
        <sw-button size="sm" variant="primary" data-door-map-save ?disabled=${this.busy||!p||e.mapping?.valid&&d===n}
          @click=${()=>p&&this.run(()=>T(e.entity_id,p.station_id,p.relay))}>שמירה</sw-button>
        ${e.mapping?a`<sw-button size="sm" variant="ghost" data-door-map-clear ?disabled=${this.busy} @click=${()=>this.run(()=>A(e.entity_id))}>ביטול שיוך</sw-button>`:l}
      </div>
    </div>`}editorCard(t){const e=t.editor_block==="blocked"?"allowed":"blocked";return a`<sw-card heading="פריטים שפותחים דלתות" subheading="עורכי האוטומציות, הסקריפטים, הסצנות והתזמונים · הבדיקה נעשית בשרת בעת שמירה" data-door-editor-card>
      <div class="row" data-door-editor-block>
        <div class="who"><span class="name">${R(t.editor_block)}</span><span class="sub">${E(t)}</span></div>
        <sw-button size="sm" data-door-editor-switch ?disabled=${this.busy||e==="allowed"&&!t.editor_allowed_available} @click=${()=>{this.confirmEditor=e}}>${e==="allowed"?"לאפשר":"לחסום"}</sw-button>
      </div>
      <h3>תזמוני נעילה שלא יעבדו</h3>
      ${t.lock_jobs.length?t.lock_jobs.map(s=>a`<div class="row" data-door-lock-job=${s.schedule_id}><span class="name">${C(s)}</span></div>`):a`<sw-state-panel icon="door" state="empty" heading="אין תזמוני נעילה על דלתות אינטרקום"></sw-state-panel>`}
      ${this.confirmEditor?a`<sw-dialog open heading="פריטים שפותחים דלתות" data-door-editor-confirm @close=${()=>{this.confirmEditor=null}}>
            <p>${D(this.confirmEditor)}</p>
            <sw-button slot="footer" variant="ghost" @click=${()=>{this.confirmEditor=null}}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" data-door-editor-ok ?disabled=${this.busy} @click=${()=>{const s=this.confirmEditor;this.confirmEditor=null,s&&this.run(()=>H(s))}}>אישור</sw-button>
          </sw-dialog>`:l}
    </sw-card>`}render(){if(this.error&&!this.map)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.map)return a`<sw-state-panel state="loading"></sw-state-panel>`;const t=this.map,e=J(t),s=t.locks.filter(i=>i.suggestion).length;return a`<div class="stack">
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:l}
      <sw-card heading="מיקום תחנות" subheading="שיוך תחנה לאתר או למבנה: הרשאת פתיחה באתר או במבנה חלה גם על התחנות שבו" data-door-placement-card>
        ${t.stations.length?t.stations.map(i=>a`<div class="row" data-door-placement=${i.name}>
              <div class="who"><span class="name">${i.name}</span>${i.online?l:a`<span class="sub">התחנה לא זמינה</span>`}</div>
              <select aria-label=${`מיקום ${i.name}`} ?disabled=${this.busy} @change=${n=>this.run(()=>U(i.id,F(n.target.value)))}>
                ${e.map(n=>a`<option value=${n.value} ?selected=${n.value===V(i.placement)}>${n.label}</option>`)}
              </select>
            </div>`):a`<sw-state-panel icon="door" state="empty" heading="אין תחנות" hint=${t.has_copy?"WisKey לא מסר תחנות.":"נתוני WisKey אינם זמינים כרגע."}></sw-state-panel>`}
      </sw-card>
      <sw-card heading="שיוך דלתות" subheading="לכל מנעול אינטרקום: התחנה והממסר שהוא פותח · שיוך מפורש בלבד, לא לפי שם" data-door-map-card>
        ${s?a`<div class="tools"><sw-button size="sm" data-door-map-apply ?disabled=${this.busy} @click=${()=>this.run(()=>P())}>אישור ${s} הצעות חד-משמעיות</sw-button></div>`:l}
        ${t.locks.length?t.locks.map(i=>this.lockRow(t,i)):a`<sw-state-panel icon="door" state="empty" heading="אין מנעולי אינטרקום"></sw-state-panel>`}
      </sw-card>
      ${this.settings?this.editorCard(this.settings):l}
    </div>`}};c.styles=[v];r([o()],c.prototype,"map",2);r([o()],c.prototype,"error",2);r([o()],c.prototype,"busy",2);r([o()],c.prototype,"picks",2);r([o()],c.prototype,"settings",2);r([o()],c.prototype,"confirmEditor",2);c=r([m("sw-door-setup")],c);let h=class extends ${constructor(){super(...arguments),this.inv=null,this.error="",this.busy=!1,this.filter="all"}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.busy=!0;try{this.inv=await M(),this.error=""}catch(t){this.error=w(t)}finally{this.busy=!1}}itemRow(t){return a`<div class="row item" data-door-item=${t.key}>
      <div class="who">
        <span class="name">${t.name}</span>
        <span class="sub">${at(t)}</span>
        <span class="sub">${nt(t)} · ${it(t,S)}</span>
      </div>
      <div class="facts">
        <sw-badge kind=${ot(t)} label=${t.run_guard_text}></sw-badge>
        <span class="sub">דלתות: ${rt(t)}</span>
        <span class="sub">הצעה: ${t.suggestion_text}</span>
        ${t.unresolved.length?a`<span class="warn">${t.unresolved.join(" · ")}</span>`:l}
        ${t.disable_required?a`<span class="warn" data-door-item-disable>דורש השבתה - פועל לבד ואין לו מאשר תקף</span>`:l}
      </div>
    </div>`}render(){if(this.error&&!this.inv)return a`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.inv)return a`<sw-state-panel state="loading"></sw-state-panel>`;const t=this.inv,e=et(t.items,this.filter);return a`<sw-card heading="פריטים שפותחים דלתות" subheading=${`דוח לקריאה בלבד · ${_(t)}`} data-door-inventory-card style="margin-block-start: var(--sw-s-3)">
      ${this.error?a`<div class="err" role="alert">${this.error}</div>`:l}
      <div class="tools">
        <div class="chips" role="group" aria-label="סינון">
          ${tt.map(s=>a`<sw-chip data-door-inventory-filter=${s.id} ?selected=${this.filter===s.id} @click=${()=>this.filter=s.id}>${s.label}</sw-chip>`)}
        </div>
        <sw-button size="sm" variant="ghost" data-door-inventory-refresh ?disabled=${this.busy} @click=${()=>this.load()}>רענון</sw-button>
      </div>
      ${e.length?e.map(s=>this.itemRow(s)):a`<sw-state-panel icon=${t.items.length?"filter":"door"} state="empty" heading=${t.items.length?"אין פריטים בסינון הזה":_(t)}></sw-state-panel>`}
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
//# sourceMappingURL=system-doors-DMnwbP3j.js.map
