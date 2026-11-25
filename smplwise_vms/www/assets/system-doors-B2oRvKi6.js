import{bf as m,E as k,bv as f,cc as z,du as R,g as j,j as d,i as g,o as b,A as l,b as n,aL as C,k as v}from"./index-CqeTnh_F.js";import{l as _}from"./live-BLNpflQx.js";import"./sw-chip-SjQHeT2C.js";import{fmtWhen as S}from"./access-CJ1kgHaF.js";import{t}from"./system-a-D1gydlyw.js";import{e as D,b as I,c as L,d as T}from"./door-path-logic-DGj2fqpm.js";import{u as q}from"./lock-reason-CNcHbSzk.js";const A=()=>m("access/door-grants"),O=(e,s,a)=>k("access/door-grants/subjects",{subject_kind:e,subject_id:s,enabled:a,confirmed:!0}),N=(e,s,a)=>f(`access/door-grants/roles/${encodeURIComponent(e)}`,{enabled:s,revision:a,confirmed:!0}),P=()=>m("intercom/door-map"),U=(e,s,a)=>f(`intercom/door-map/${encodeURIComponent(e)}`,{station_id:s,relay:a,confirmed:!0}),M=e=>z(`intercom/door-map/${encodeURIComponent(e)}`),W=()=>k("intercom/door-map/apply-suggestions",{confirmed:!0}),B=(e,s)=>f(`intercom/stations/${encodeURIComponent(e)}/placement`,{...s,confirmed:!0}),G=()=>m("doors/settings"),H=e=>f("doors/settings",{editor_block:e,confirmed:!0}),Q=()=>m("intercom/door-path-inventory");function V(e){return e.answer==="never"?t("לעולם לא"):e.answer==="yes"||e.includes?t("כן"):t("לא - אפשר לתת למשתמשים בנפרד")}const E=t("ההרשאה כוללת גם צפייה ביומן הכניסות ובאנשי הקשר של האינטרקום.");function K(e,s){return s?`${t("לתת ל{name} הרשאה לפתוח דלתות?",{name:e})} ${E}`:t("להסיר מ{name} את ההרשאה לפתוח דלתות?",{name:e})}function F(e,s){return s?`${t("לכלול פתיחת דלתות בתפקיד {name}?",{name:e})} ${E}`:t("להסיר פתיחת דלתות מהתפקיד {name}?",{name:e})}function J(e){return e.other.length?`${t("שיוך אחר:")} ${e.other.map(s=>`${s.role_name} · ${s.scope_name}`).join(", ")}`:""}function X(e,s){const a=s.trim().toLowerCase();return a?e.filter(r=>r.name.toLowerCase().includes(a)):e}function Y(e){return e?e.building_id?`building:${e.building_id}`:e.site_id?`site:${e.site_id}`:"":""}function Z(e){return e.startsWith("building:")?{site_id:null,building_id:e.slice(9)}:e.startsWith("site:")?{site_id:e.slice(5),building_id:null}:{site_id:null,building_id:null}}function ee(e){const s=[{value:"",label:t("כל ההתקנה (ללא שיוך)")}];for(const a of e.sites){s.push({value:`site:${a.id}`,label:`${t("אתר")} · ${a.name}`});for(const r of e.buildings.filter(i=>i.site_id===a.id))s.push({value:`building:${r.id}`,label:`${a.name} · ${r.name}`})}return s}function te(e,s){const a=s.station_id?e.stations.filter(i=>i.id===s.station_id):e.stations,r=[];for(const i of a)for(const c of i.relays)r.push({value:`${i.id}#${c.physical_index}`,label:`${i.name} · ${c.name||t("ממסר {n}",{n:c.physical_index})}`});return r}function se(e){const s=e.lastIndexOf("#");if(s<=0)return null;const a=Number(e.slice(s+1));return Number.isInteger(a)&&a>=1?{station_id:e.slice(0,s),relay:a}:null}function ae(e){return e.mapping&&e.mapping.valid?{tone:"live",text:e.mapping.source==="manual"?t("משויך ידנית"):t("משויך")}:e.mapping?{tone:"stale",text:t("השיוך אינו תקף כרגע - יש לשייך מחדש")}:e.suggestion?{tone:"unknown",text:t("הצעה לשיוך מוכנה")}:{tone:"unknown",text:t("לא משויך - הדלת לא תיפתח מ-Arx")}}const ne=[{id:"all",label:t("הכול")},{id:"blocked",label:t("הרצה נחסמת")},{id:"disable",label:t("דורש השבתה")},{id:"review",label:t("לבדיקה ידנית")}];function ie(e,s){return s==="blocked"?e.filter(a=>a.run_guard!=="unchanged"):s==="disable"?e.filter(a=>a.disable_required):s==="review"?e.filter(a=>a.run_guard==="refused_unresolvable"):e}function x(e){if(!e.wiskey_present)return t("אין דלתות אינטרקום בהתקנה");const s=e.counts;if(!s.items)return t("אין פריטים שפותחים דלתות");const a=[t("{n} פריטים",{n:s.items}),t("{n} שלבי פתיחה",{n:s.door_steps})];return s.unresolvable&&a.push(t("{n} לבדיקה ידנית",{n:s.unresolvable})),s.disable_required&&a.push(t("{n} דורשים השבתה",{n:s.disable_required})),a.join(" · ")}const re={enabled:t("פעיל"),disabled:t("מושבת"),ready:t("זמין"),gone:t("נמחק"),unknown:t("מצב לא ידוע")};function oe(e){return[e.kind_text,e.origin_text,re[e.state]].join(" · ")}function le(e){const s=e.author?t("נכתב בידי {name}",{name:e.author}):t("כותב לא ידוע"),a=e.approver?`${t("אושר בידי {name}",{name:e.approver})}${e.approver_status==="approved"?"":` (${e.approver_text})`}`:e.approver_text;return`${s} · ${a}`}function de(e,s){return e.last_run?t("הרצה אחרונה: {time}",{time:s(e.last_run.at)}):t("לא הורץ")}function ce(e){return e.doors.length?e.doors.join(", "):e.door_steps?t("{n} שלבי פתיחה",{n:e.door_steps}):e.lock_steps?t("{n} שלבי נעילה",{n:e.lock_steps}):t("לא ניתן לזהות")}function pe(e){return e.run_guard==="refused_unresolvable"?"stale":e.run_guard==="refused_not_converted"?"unknown":"neutral"}t("השבתה ורישום"),t("הסבה למשימת דלת של Arx"),t("העברה לחלון פתיחה קבוע");t("הושבת"),t("הוסב למשימת דלת"),t("הועבר לחלון פתיחה");var ue=Object.defineProperty,he=Object.getOwnPropertyDescriptor,o=(e,s,a,r)=>{for(var i=r>1?void 0:r?he(s,a):s,c=e.length-1,u;c>=0;c--)(u=e[c])&&(i=(r?u(s,a,i):u(i))||i);return r&&i&&ue(s,a,i),i};const y=j`
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
  ${R}
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
    /* NATIVE-SELECT-A-2480: the select sits in the shared field; the field takes the select's place in the line */
    .ctl sw-field {
      flex: 1 1 auto;
    }
  }
`;let h=class extends g{constructor(){super(...arguments),this.data=null,this.error="",this.busy=!1,this.q="",this.pending=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.data=await A(),this.error=""}catch(e){this.error=b(e)}}async confirm(){const e=this.pending;if(e){this.busy=!0;try{e.kind==="subject"?await O(e.row.kind,e.row.id,e.enabled):await N(e.role.id,e.enabled,e.role.revision??1),this.pending=null,await this.load()}catch(s){this.error=b(s),this.pending=null}finally{this.busy=!1}}}subjectRow(e){const s=J(e);return n`<div class="row" data-door-grant=${`${e.kind}:${e.id}`}>
      <div class="who"><span class="name">${e.name}</span>${s?n`<span class="sub">${s}</span>`:l}</div>
      <sw-toggle label=${`${t("רשאי לפתוח דלתות")}: ${e.name}`} labelHidden .checked=${_(e.granted)} ?disabled=${this.busy||!this.data?.can_manage_subjects||!e.active&&!e.granted}
        @change=${a=>{this.pending={kind:"subject",row:e,enabled:a.detail.checked},this.requestUpdate()}}></sw-toggle>
    </div>`}unmappedNotice(e){const s=q(e.unmapped_doors,C("system.configure"));return s?n`<div class="notice" role="status" data-door-unmapped-notice>${s.text}${s.link?n` <a data-door-unmapped-link href=${s.link.href}>${s.link.label}</a>`:l}</div>`:l}roleRow(e){return e.custom?n`<div class="row" data-door-role=${e.id}>
      <div class="who"><span class="name">${e.name}</span><span class="sub">${t("תפקיד מותאם")}</span></div>
      <sw-toggle label=${`${t("כולל פתיחת דלתות")}: ${e.name}`} labelHidden .checked=${_(e.includes)} ?disabled=${this.busy||!e.editable}
        @change=${s=>{this.pending={kind:"role",role:e,enabled:s.detail.checked},this.requestUpdate()}}></sw-toggle>
    </div>`:n`<div class="row" data-door-role=${e.id}><div class="who"><span class="name">${e.name}</span><span class="sub">${t("תפקיד מובנה")}</span></div><span class="sub" data-door-role-answer>${V(e)}</span></div>`}render(){if(this.error&&!this.data)return n`<sw-state-panel state="error" hint=${this.error} actionLabel=${t("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;if(!this.data)return n`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.data,s=X([...e.users,...e.groups],this.q),a=this.pending,r=a?a.kind==="subject"?a.row.name:a.role.name:"";return n`<sw-card heading=${t("פתיחת דלתות")} subheading=${t("מי רשאי לפתוח דלתות אינטרקום מ-Arx · ברירת המחדל: כל הדלתות בהתקנה")} data-door-grants-card>
      ${this.error?n`<div class="err" role="alert">${this.error}</div>`:l}
      ${this.unmappedNotice(e)}
      <h3>${t("משתמשים וקבוצות")}</h3>
      <div class="tools">
        <input type="search" placeholder=${t("חיפוש לפי שם")} aria-label=${t("חיפוש לפי שם")} .value=${this.q} @input=${i=>this.q=i.target.value} />
        <span class="sub">${t('רק דלתות מסוימות: שיוך התפקיד "פותח דלתות" לעמדה, בלשונית המשתמשים או הקבוצות')}</span>
      </div>
      ${s.length?n`<div class="colhead" aria-hidden="true"><span>${t("שם")}</span><span>${t("רשאי לפתוח דלתות")}</span></div>${s.map(i=>this.subjectRow(i))}`:n`<sw-state-panel icon="door" state="empty" heading=${t("אין משתמשים או קבוצות")}></sw-state-panel>`}
      ${e.can_manage_roles?n`<h3>${t("תפקידים")}</h3><div class="colhead" aria-hidden="true"><span>${t("תפקיד")}</span><span>${t("כולל פתיחת דלתות")}</span></div>${e.roles.map(i=>this.roleRow(i))}`:l}
      ${a?n`<sw-dialog open heading=${t("פתיחת דלתות")} data-door-grant-confirm @close=${()=>{this.pending=null}}>
            <p>${a.kind==="subject"?K(r,a.enabled):F(r,a.enabled)}</p>
            <sw-button slot="footer" variant="ghost" @click=${()=>{this.pending=null}}>${t("ביטול")}</sw-button>
            <sw-button slot="footer" variant=${a.enabled?"primary":"danger"} data-door-grant-ok ?disabled=${this.busy} @click=${()=>this.confirm()}>${t("אישור")}</sw-button>
          </sw-dialog>`:l}
    </sw-card>`}};h.styles=[y];o([d()],h.prototype,"data",2);o([d()],h.prototype,"error",2);o([d()],h.prototype,"busy",2);o([d()],h.prototype,"q",2);o([d()],h.prototype,"pending",2);h=o([v("sw-door-grants")],h);let p=class extends g{constructor(){super(...arguments),this.map=null,this.error="",this.busy=!1,this.picks={},this.settings=null,this.confirmEditor=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.map=await P(),this.settings=await G(),this.error=""}catch(e){this.error=b(e)}}async run(e){this.busy=!0;try{await e(),await this.load()}catch(s){this.error=b(s)}finally{this.busy=!1}}lockRow(e,s){const a=ae(s),r=te(e,s),i=s.mapping?`${s.mapping.station_id}#${s.mapping.relay}`:s.suggestion?`${s.suggestion.station_id}#${s.suggestion.relay}`:"",c=this.picks[s.entity_id]??i,u=se(c);return n`<div class="row" data-door-map=${s.entity_id}>
      <div class="who"><span class="name">${s.name}</span><sw-badge kind=${a.tone} label=${a.text}></sw-badge></div>
      <div class="ctl">
        <sw-field><select aria-label=${t("ממסר עבור {name}",{name:s.name})} @change=${w=>this.picks={...this.picks,[s.entity_id]:w.target.value}}>
          <option value="" ?selected=${!c}>${t("בחירת ממסר")}</option>
          ${r.map(w=>n`<option value=${w.value} ?selected=${w.value===c}>${w.label}</option>`)}
        </select></sw-field>
        <sw-button size="sm" variant="primary" data-door-map-save ?disabled=${this.busy||!u||s.mapping?.valid&&c===i}
          @click=${()=>u&&this.run(()=>U(s.entity_id,u.station_id,u.relay))}>${t("שמירה")}</sw-button>
        ${s.mapping?n`<sw-button size="sm" variant="ghost" data-door-map-clear ?disabled=${this.busy} @click=${()=>this.run(()=>M(s.entity_id))}>${t("ביטול שיוך")}</sw-button>`:l}
      </div>
    </div>`}editorCard(e){const s=e.editor_block==="blocked"?"allowed":"blocked";return n`<sw-card heading=${t("פריטים שפותחים דלתות")} subheading=${t("עורכי האוטומציות, הסקריפטים, הסצנות והתזמונים · הבדיקה נעשית בשרת בעת שמירה")} data-door-editor-card>
      <div class="row" data-door-editor-block>
        <div class="who"><span class="name">${D(e.editor_block)}</span><span class="sub">${I(e)}</span></div>
        <sw-button size="sm" data-door-editor-switch ?disabled=${this.busy||s==="allowed"&&!e.editor_allowed_available} @click=${()=>{this.confirmEditor=s}}>${s==="allowed"?t("לאפשר"):t("לחסום")}</sw-button>
      </div>
      <h3>${t("תזמוני נעילה שלא יעבדו")}</h3>
      ${e.lock_jobs.length?e.lock_jobs.map(a=>n`<div class="row" data-door-lock-job=${a.schedule_id}><span class="name">${L(a)}</span></div>`):n`<sw-state-panel icon="door" state="empty" heading=${t("אין תזמוני נעילה על דלתות אינטרקום")}></sw-state-panel>`}
      ${this.confirmEditor?n`<sw-dialog open heading=${t("פריטים שפותחים דלתות")} data-door-editor-confirm @close=${()=>{this.confirmEditor=null}}>
            <p>${T(this.confirmEditor)}</p>
            <sw-button slot="footer" variant="ghost" @click=${()=>{this.confirmEditor=null}}>${t("ביטול")}</sw-button>
            <sw-button slot="footer" variant="primary" data-door-editor-ok ?disabled=${this.busy} @click=${()=>{const a=this.confirmEditor;this.confirmEditor=null,a&&this.run(()=>H(a))}}>${t("אישור")}</sw-button>
          </sw-dialog>`:l}
    </sw-card>`}render(){if(this.error&&!this.map)return n`<sw-state-panel state="error" hint=${this.error} actionLabel=${t("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;if(!this.map)return n`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.map,s=ee(e),a=e.locks.filter(r=>r.suggestion).length;return n`<div class="stack">
      ${this.error?n`<div class="err" role="alert">${this.error}</div>`:l}
      <sw-card heading=${t("מיקום תחנות")} subheading=${t("שיוך תחנה לאתר או למבנה: הרשאת פתיחה באתר או במבנה חלה גם על התחנות שבו")} data-door-placement-card>
        ${e.stations.length?e.stations.map(r=>n`<div class="row" data-door-placement=${r.name}>
              <div class="who"><span class="name">${r.name}</span>${r.online?l:n`<span class="sub">${t("התחנה לא זמינה")}</span>`}</div>
              <sw-field><select aria-label=${t("מיקום {name}",{name:r.name})} ?disabled=${this.busy} @change=${i=>this.run(()=>B(r.id,Z(i.target.value)))}>
                ${s.map(i=>n`<option value=${i.value} ?selected=${i.value===Y(r.placement)}>${i.label}</option>`)}
              </select></sw-field>
            </div>`):n`<sw-state-panel icon="door" state="empty" heading=${t("אין תחנות")} hint=${e.has_copy?t("WisKey לא מסר תחנות."):t("נתוני WisKey אינם זמינים כרגע.")}></sw-state-panel>`}
      </sw-card>
      <sw-card heading=${t("שיוך דלתות")} subheading=${t("לכל מנעול אינטרקום: התחנה והממסר שהוא פותח · שיוך מפורש בלבד, לא לפי שם")} data-door-map-card>
        ${a?n`<div class="tools"><sw-button size="sm" data-door-map-apply ?disabled=${this.busy} @click=${()=>this.run(()=>W())}>${t("אישור {n} הצעות חד-משמעיות",{n:a})}</sw-button></div>`:l}
        ${e.locks.length?e.locks.map(r=>this.lockRow(e,r)):n`<sw-state-panel icon="door" state="empty" heading=${t("אין מנעולי אינטרקום")}></sw-state-panel>`}
      </sw-card>
      ${this.settings?this.editorCard(this.settings):l}
    </div>`}};p.styles=[y];o([d()],p.prototype,"map",2);o([d()],p.prototype,"error",2);o([d()],p.prototype,"busy",2);o([d()],p.prototype,"picks",2);o([d()],p.prototype,"settings",2);o([d()],p.prototype,"confirmEditor",2);p=o([v("sw-door-setup")],p);let $=class extends g{constructor(){super(...arguments),this.inv=null,this.error="",this.busy=!1,this.filter="all"}connectedCallback(){super.connectedCallback(),this.load()}async load(){this.busy=!0;try{this.inv=await Q(),this.error=""}catch(e){this.error=b(e)}finally{this.busy=!1}}itemRow(e){return n`<div class="row item" data-door-item=${e.key}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${oe(e)}</span>
        <span class="sub">${le(e)} · ${de(e,S)}</span>
      </div>
      <div class="facts">
        <sw-badge kind=${pe(e)} label=${e.run_guard_text}></sw-badge>
        <span class="sub">${t("דלתות:")} ${ce(e)}</span>
        <span class="sub">${t("הצעה:")} ${e.suggestion_text}</span>
        ${e.unresolved.length?n`<span class="warn">${e.unresolved.join(" · ")}</span>`:l}
        ${e.disable_required?n`<span class="warn" data-door-item-disable>${t("דורש השבתה - פועל לבד ואין לו מאשר תקף")}</span>`:l}
      </div>
    </div>`}render(){if(this.error&&!this.inv)return n`<sw-state-panel state="error" hint=${this.error} actionLabel=${t("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;if(!this.inv)return n`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.inv,s=ie(e.items,this.filter);return n`<sw-card heading=${t("פריטים שפותחים דלתות")} subheading=${`${t("דוח לקריאה בלבד")} · ${x(e)}`} data-door-inventory-card style="margin-block-start: var(--sw-s-3)">
      ${this.error?n`<div class="err" role="alert">${this.error}</div>`:l}
      <div class="tools">
        <div class="chips" role="group" aria-label=${t("סינון")}>
          ${ne.map(a=>n`<sw-chip data-door-inventory-filter=${a.id} ?selected=${this.filter===a.id} @click=${()=>this.filter=a.id}>${a.label}</sw-chip>`)}
        </div>
        <sw-button size="sm" variant="ghost" data-door-inventory-refresh ?disabled=${this.busy} @click=${()=>this.load()}>${t("רענון")}</sw-button>
      </div>
      ${s.length?s.map(a=>this.itemRow(a)):n`<sw-state-panel icon=${e.items.length?"filter":"door"} state="empty" heading=${e.items.length?t("אין פריטים בסינון הזה"):x(e)}></sw-state-panel>`}
    </sw-card>`}};$.styles=[y,j`
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
    `];o([d()],$.prototype,"inv",2);o([d()],$.prototype,"error",2);o([d()],$.prototype,"busy",2);o([d()],$.prototype,"filter",2);$=o([v("sw-door-inventory")],$);
