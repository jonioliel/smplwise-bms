import{gz as be,j as z,k as p,a as Z,aX as ee,ri as me,hz as Q,af as C,rj as fe,rk as ge,rl as we,dO as ve,rm as ye,dN as xe,ci as ke,a2 as _e,a3 as Ie,bE as X,dl as Y,q as x,dw as J,b as d,rn as Oe,A as $,hp as ze,hr as Ce,hq as Ee,io as Te,ip as Le,ro as Se,rp as De,ai as D,m as A,z as te,cj as i,rq as Fe,rr as Pe,rb as F,an as Re,F as Ne,bg as se,bw as W,rs as Ae,aj as P,iG as oe,ae as je,aE as m,aU as pe}from"./index-kIGDECLR.js";import"./home-screen-options-DNpF2bVt.js";import{b as ae}from"./bubble-chrome-CAs08QP2.js";import{t as b}from"./system-a-DQIryptR.js";import"./area-row-editor-B8iGHuEQ.js";import{t as h}from"./media-DbQR64L_.js";import"./sw-logo-art-PLtEZJxU.js";var qe=Object.defineProperty,Ke=Object.getOwnPropertyDescriptor,w=(t,e,s,a)=>{for(var o=a>1?void 0:a?Ke(e,s):e,r=t.length-1,c;r>=0;r--)(c=t[r])&&(o=(a?c(e,s,o):c(o))||o);return a&&o&&qe(e,s,o),o};function Be(t,e){const s=(o,r,c,u,k="wg")=>D`<rect class=${k} x=${o} y=${r} width=${c} height=${u} rx="3"/>`,a=(o,r,c)=>D`${[0,1,2,3,4,5].map(u=>s(o+u*c/6,r,c/6-2,7,"kp"))}`;if(t==="a")return D`${s(4,4,30,22)}${s(37,4,30,22)}${s(70,4,22,22)}${s(95,4,21,22)}${a(4,30,112)}
      ${s(4,41,24,34,"fl")}${s(31,41,42,34,"fl")}${s(76,41,40,34,"fl")}`;if(t==="b"){const o=e==="end"?4:84,r=e==="end"?38:4;return D`${a(r,4,78)}${s(o,4,32,14)}${s(o,21,32,22)}${s(o,46,32,12)}${s(o,61,32,14)}
      ${s(r,15,34,28,"fl")}${s(r+38,15,40,28,"fl")}${s(r,46,78,29,"fl")}`}return D`${s(4,4,28,14)}${s(35,4,28,14)}${s(66,4,24,14)}${s(93,4,23,14)}${a(4,22,112)}
    ${s(4,34,34,41,"fl")}${s(41,34,34,41,"fl")}${s(78,34,38,41,"fl")}`}let g=class extends Z{constructor(){super(...arguments),this.bubbleSkin=new ee(this),this.direction=me,this.side="end",this.form={screen:Q(C()?null:fe()),info:"auto",view:"cards"},this.areas=[],this.buildings=[],this.floorTitleLines=ge,this.bulkIdle=we,this.canEdit=!1,this.busy=!1,this.message="",this.error=""}connectedCallback(){super.connectedCallback(),C()&&(ve().then(t=>{this.canEdit=t.can_edit;const e=ye(t.settings);this.direction=e.direction,this.side=e.side;const s=t.settings,a=xe(s);this.form={screen:Q(s["home.screen"]),info:a.infoStyle,view:s["devices.default_view"]==="tiles"?"tiles":"cards"},this.floorTitleLines=a.floorTitleLines,this.bulkIdle=a.bulkIdle}).catch(()=>{}),ke().then(t=>this.areas=t.floors.flatMap(e=>e.areas.map(s=>({id:s.area_id,name:s.name,floor:e.name,counts:s.counts})))).catch(()=>this.areas=[]),Promise.all([_e(),Ie()]).then(([t,e])=>this.buildings=t?e.sites.flatMap(s=>(s.buildings??[]).map(a=>({id:a.id,name:a.name}))):[]).catch(()=>this.buildings=[]))}async save(t){if(!this.canEdit||this.busy)return;const e={direction:this.direction,side:this.side};this.direction=t.direction??this.direction,this.side=t.side??this.side,this.busy=!0,this.error="";try{const s={};t.direction&&(s["home.direction"]=t.direction),t.side&&(s["home.side"]=t.side),await X("settings",s),Y(),this.message=b("המסך הראשי נשמר"),setTimeout(()=>this.message="",2500)}catch(s){this.direction=e.direction,this.side=e.side,this.error=x(s)}finally{this.busy=!1}}async saveChoice(t,e){if(!this.canEdit||this.busy||!C())return;const s={floorTitleLines:this.floorTitleLines,bulkIdle:this.bulkIdle};t==="home.floor_title_lines"?this.floorTitleLines=e:this.bulkIdle=e,this.busy=!0,this.error="";try{await X("settings",{[t]:e}),Y(),this.message=J("saved"),setTimeout(()=>this.message="",2500)}catch(a){this.floorTitleLines=s.floorTitleLines,this.bulkIdle=s.bulkIdle,this.error=x(a)}finally{this.busy=!1}}choiceRow(t,e,s,a,o,r,c){return d`<div class="row" data-home-choice=${e}><span>${t}</span><sw-segmented label=${t} value=${o} ?disabled=${r||this.busy} @change=${u=>c(u.detail.value)}
      .options=${s.map(u=>({value:u,label:a[u],attrs:{"data-home-choice-option":u}}))}></sw-segmented></div>`}async saveForm(t){if(!this.canEdit||this.busy||!C())return;const e=this.form,s=Oe(e,t);if(Object.keys(s).length){this.form=t,this.busy=!0,this.error="";try{const a=await X("settings",s);Y(),a?.settings?.["home.screen"]&&(this.form={...t,screen:Q(a.settings["home.screen"])}),this.message=J("saved"),setTimeout(()=>this.message="",2500)}catch(a){this.form=e,this.error=x(a)}finally{this.busy=!1}}}render(){const t=!this.canEdit||!C();return d`<sw-card heading=${b("מסך ראשי")} subheading=${b("הכיוון של מסך ״ראשי״ לכל המשתמשים במתקן")} data-home-screen-settings>
      <div class="opts" role="group" aria-label=${b("כיוון המסך הראשי")}>
        ${ze.map(e=>d`<button type="button" class="opt" data-home-dir-option=${e} aria-pressed=${String(this.direction===e)} ?disabled=${t||this.busy} @click=${()=>void this.save({direction:e})}>
            <svg class="thumb" viewBox="0 0 120 80" aria-hidden="true" data-home-dir-thumb=${e}>${Be(e,this.side)}</svg>
            <span class="cap"><span class="let">${Ce[e]}</span>${Ee[e]}</span>
          </button>`)}
      </div>
      ${this.direction==="b"?d`<div class="row"><span>${b("צד הלוח")}</span><sw-segmented label=${b("צד הלוח")} value=${this.side} ?disabled=${t||this.busy} @change=${e=>void this.save({side:e.detail.value})}
      .options=${Te.map(e=>({value:e,label:Le[e],attrs:{"data-home-side-option":e}}))}></sw-segmented></div>`:$}
      <h3 class="hs-h" data-home-screen-options-heading>${J("heading")}</h3>
      <home-screen-options .value=${this.form} .areas=${this.areas} .buildings=${this.buildings} ?editable=${!t&&!this.busy} @hs-change=${e=>void this.saveForm(e.detail)}></home-screen-options>
      ${this.choiceRow(b("שם קומה ארוך בכותרת כרטיס"),"floor-title-lines",Se,{2:b("שתי שורות"),3:b("שלוש שורות"),1:b("שורה אחת עם ...")},this.floorTitleLines,t,e=>void this.saveChoice("home.floor_title_lines",e))}
      ${this.choiceRow(b('כפתור "כבה הכל" כשאין מה לכבות'),"bulk-idle",De,{disabled:b("מושבת"),enabled:b("לחיץ תמיד")},this.bulkIdle,t,e=>void this.saveChoice("home.bulk_idle",e))}
      <div class="row">
        <sw-button size="sm" icon="edit" data-home-edit-link @click=${()=>location.hash="#/devices/building?edit=1"} ?disabled=${t}>${b("עריכת המסך הראשי")}</sw-button>
        ${this.message?d`<span class="ok" role="status" data-home-message>${this.message}</span>`:$}
        ${this.error?d`<span class="err" role="alert">${this.error}</span>`:$}
        ${t?d`<span class="muted">${C()?b("שינוי ההגדרות דורש הרשאת מנהל מערכת."):b("נתוני הדגמה: ההגדרות נשמרות רק מול השרת.")}</span>`:$}
      </div>
    </sw-card>`}};g.styles=[z`
    :host {
      display: block;
    }
    .opts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
    }
    button.opt {
      all: unset;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      border: 2px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      cursor: pointer;
    }
    button.opt[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    button.opt:disabled {
      cursor: default;
      opacity: 0.75;
    }
    button.opt:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    svg.thumb {
      inline-size: 100%;
      block-size: auto;
      aspect-ratio: 120 / 80;
      background: var(--sw-bg);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    svg.thumb .wg {
      fill: var(--sw-accent);
      opacity: 0.85;
    }
    svg.thumb .kp {
      fill: var(--sw-border-strong);
    }
    svg.thumb .fl {
      fill: var(--sw-surface-3);
      stroke: var(--sw-border-strong);
      stroke-width: 0.6;
    }
    .cap {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
    }
    .cap .let {
      color: var(--sw-accent-text);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-block-start: 12px;
    }
    .ok {
      color: var(--sw-live);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    ${be}
    .hs-h {
      margin: 18px 0 8px;
      font-size: var(--sw-fs-md);
      color: var(--sw-heading);
    }
  `,ae];w([p()],g.prototype,"direction",2);w([p()],g.prototype,"side",2);w([p()],g.prototype,"form",2);w([p()],g.prototype,"areas",2);w([p()],g.prototype,"buildings",2);w([p()],g.prototype,"floorTitleLines",2);w([p()],g.prototype,"bulkIdle",2);w([p()],g.prototype,"canEdit",2);w([p()],g.prototype,"busy",2);w([p()],g.prototype,"message",2);w([p()],g.prototype,"error",2);g=w([A("system-home-screen")],g);var Ue=Object.defineProperty,Me=Object.getOwnPropertyDescriptor,H=(t,e,s,a)=>{for(var o=a>1?void 0:a?Me(e,s):e,r=t.length-1,c;r>=0;r--)(c=t[r])&&(o=(a?c(e,s,o):c(o))||o);return a&&o&&Ue(e,s,o),o};let E=class extends Z{constructor(){super(...arguments),this.theme="default",this.scheme="light",this.disabled=!1}pick(t,e){this.dispatchEvent(new CustomEvent("devices-pick",{detail:{key:t,value:e},bubbles:!0,composed:!0}))}render(){return d`<div class="lbl">${i("ערכת צבעים")}<span class="muted">${i("הצבעים של אזור החשמל וההתקנים בסגנון זכוכית, בהיר וכהה, וצבעי הכרטיסים שנבחרים בעורך הפריסה (לפי תפקיד: הדגשה, חם, קריר ...) - בשני הסגנונות.")}</span></div>
      <div class="themes" role="group" aria-label=${i("ערכת צבעים")} data-devices-themes>
        ${Fe.map(t=>{const e=s=>d`<span class="prev" style=${F({background:s.preview.backdrop})}>
            <i style=${F({background:s.preview.surface})}></i>
            <i style=${F({background:`linear-gradient(135deg, color-mix(in srgb, ${s.preview.on} 55%, transparent), ${s.preview.surface})`})}></i>
            <b style=${F({background:s.preview.accent})}></b>
          </span>`;return d`<button type="button" class="theme" data-devices-theme-swatch=${t.id} aria-pressed=${String(this.theme===t.id)} ?disabled=${this.disabled} @click=${()=>this.pick("devices.theme",t.id)}>
            <span class="pair" aria-hidden="true">${e(t.light)}${e(t.dark)}</span>
            <span class="roles" aria-hidden="true">${Pe.map(s=>d`<span style=${F({background:`rgb(${t.light.roles[s].rgb})`})}></span>`)}</span>
            <span class="cap">${t.name}<span class="muted">${t.hint}</span></span>
          </button>`})}
      </div>
      <div class="scheme">
        <span class="lbl">${i("בהיר או כהה")}<span class="muted">${i('ברירת המחדל בהיר, כמו שאר המערכת. "לפי המכשיר" עובר לכהה רק במכשיר שמוגדר כהה. חל על סגנון הזכוכית.')}</span></span>
        <select data-set-devices-scheme ?disabled=${this.disabled} @change=${t=>this.pick("devices.scheme",t.target.value)}>
          <option value="light" ?selected=${this.scheme==="light"}>${i("בהיר")}</option>
          <option value="dark" ?selected=${this.scheme==="dark"}>${i("כהה")}</option>
          <option value="auto" ?selected=${this.scheme==="auto"}>${i("לפי המכשיר")}</option>
        </select>
      </div>`}};E.styles=z`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .lbl {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .muted {
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .themes {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    /* R5-DEVICES-297: a swatch is a raised key (shadow 1, no outline); the chosen one carries the accent ring and a deeper shadow;
       a press sinks it, hover for a fine pointer only */
    button.theme {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      border: 2px solid transparent;
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2);
      box-shadow: var(--sw-shadow-1);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-base);
      text-align: start;
      cursor: pointer;
      inline-size: 184px;
      transition: transform var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-med) var(--sw-ease), border-color var(--sw-t-med) var(--sw-ease);
    }
    @media (hover: hover) and (pointer: fine) {
      button.theme:hover:not(:disabled) {
        box-shadow: var(--sw-shadow-2);
      }
    }
    button.theme:active:not(:disabled) {
      transform: scale(var(--sw-press-scale, 1));
    }
    button.theme[aria-pressed='true'] {
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2), 0 0 0 3px var(--sw-accent-soft);
    }
    @media (prefers-reduced-motion: reduce) {
      button.theme {
        transition-duration: 0.01ms;
      }
    }
    button.theme:disabled {
      cursor: default;
    }
    .pair {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      block-size: 76px;
    }
    .prev {
      border-radius: var(--sw-r-sm);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: hidden;
    }
    .prev i {
      display: block;
      border-radius: var(--sw-r-2xs);
      block-size: 14px;
    }
    .prev b {
      display: block;
      inline-size: 60%;
      block-size: 6px;
      border-radius: 3px;
    }
    .roles {
      display: flex;
      gap: 3px;
      padding-inline: 2px;
    }
    .roles span {
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }
    .cap {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding-inline: 2px;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .cap .muted {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .scheme {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    select {
      min-block-size: 32px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      padding-inline: 8px;
    }
  `;H([te()],E.prototype,"theme",2);H([te()],E.prototype,"scheme",2);H([te({type:Boolean})],E.prototype,"disabled",2);E=H([A("devices-theme-picker")],E);var He=Object.defineProperty,T=(t,e,s,a)=>{for(var o=void 0,r=t.length-1,c;r>=0;r--)(c=t[r])&&(o=c(e,s,o)||o);return o&&He(e,s,o),o};const ie=z`
  table {
    inline-size: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--sw-fs-base);
  }
  th,
  td {
    text-align: start;
    padding: 10px 10px;
    border-block-end: 1px solid var(--sw-border);
    vertical-align: middle;
  }
  th {
    background: var(--sw-surface-2);
    color: var(--sw-heading, var(--sw-text));
    font-weight: var(--sw-fw-bold);
    white-space: nowrap;
  }
  th:first-child {
    border-start-start-radius: var(--sw-r-md);
  }
  th:last-child {
    border-start-end-radius: var(--sw-r-md);
  }
`,he=z`
  :host {
    display: block;
  }
  .bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-block-end: 8px;
  }
  input[type='search'],
  select {
    font: inherit;
    font-size: var(--sw-fs-sm);
    min-block-size: 36px;
    padding: 0 10px;
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
  }
  input[type='search'] {
    flex: 1;
    min-inline-size: 180px;
  }
  .note,
  .muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  td:nth-child(2) {
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-heading, var(--sw-text));
  }
  input[type='checkbox'] {
    inline-size: 18px;
    block-size: 18px;
  }
  .cards {
    display: none;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding-block: 8px;
  }
  @media (max-width: 599px) {
    table {
      display: none;
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 2px 10px;
      align-items: center;
      padding: 10px 12px;
      border: 0;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      min-block-size: 48px;
      font-weight: var(--sw-fw-semibold);
    }
    .card .sub {
      grid-column: 2;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-2);
    }
    .actions.bulk {
      position: sticky;
      inset-block-end: 0;
      background: var(--sw-surface);
      border-block-start: 1px solid var(--sw-border);
      z-index: 1;
    }
  }
`,R=100;class V extends Z{constructor(){super(...arguments),this.rows=null,this.error="",this.sections=[]}connectedCallback(){super.connectedCallback(),this.load().then(()=>{const e=Re().params.get("section");e!==null&&this.sections.includes(e)&&requestAnimationFrame(()=>this.scrollIntoView({block:"start"}))})}async load(){try{this.rows=await this.fetchRows(),this.error=""}catch(e){this.error=x(e)}}errorCard(e){return d`<sw-card heading=${this.heading}><sw-state-panel compact state="error" heading=${e} hint=${this.error}></sw-state-panel></sw-card>`}loadingCard(){return d`<sw-card heading=${this.heading}><sw-state-panel compact state="loading"></sw-state-panel></sw-card>`}}T([p()],V.prototype,"rows");T([p()],V.prototype,"error");class L extends V{constructor(){super(...arguments),this.selected=new Set,this.shown=R,this.busy=!1,this.result="",this.last=null}setFilter(e){this.f={...this.f,...e},this.shown=R}toggle(e,s,a,o){const r=new Set(this.selected),c=a&&this.last?this.range(o,this.last,e):[e];for(const u of c)s?r.add(u):r.delete(u);this.last=e,this.selected=r}floorOptions(e){return[...new Map(e.filter(s=>s.floor_id).map(s=>[s.floor_id,s.floor_name??s.floor_id])).entries()]}areaOptions(e){const s=this.f.floor;return[...new Map(e.filter(a=>a.area_id&&(!s||a.floor_id===s)).map(a=>[a.area_id,a.area_name??a.area_id])).entries()]}place(e){return[e.floor_name,e.area_name].filter(Boolean).join(` ${i("‹")} `)||i("ללא שיוך")}async postChunks(e,s,a){let o=0,r=0;for(const c of this.chunk(s)){const u=await Ne(e,{entity_ids:c,...a});o+=u.changed,r+=u.refused}return{changed:o,refused:r}}}T([p()],L.prototype,"selected");T([p()],L.prototype,"shown");T([p()],L.prototype,"busy");T([p()],L.prototype,"result");var Ve=Object.defineProperty,Ge=Object.getOwnPropertyDescriptor,ue=(t,e,s,a)=>{for(var o=a>1?void 0:a?Ge(e,s):e,r=t.length-1,c;r>=0;r--)(c=t[r])&&(o=(a?c(e,s,o):c(o))||o);return a&&o&&Ve(e,s,o),o};const Qe={ac:i("מיזוג"),heating:i("חימום")};let M=class extends V{constructor(){super(...arguments),this.busyId="",this.heading=i("מיזוג וחימום")}async fetchRows(){return(await se("devices/climate-kinds")).climate}async choose(t,e){this.busyId=t.entity_id;try{await W(`devices/entities/${encodeURIComponent(t.entity_id)}/climate-kind`,{kind:e}),this.error="",await this.load()}catch(s){this.error=x(s)}finally{this.busyId=""}}render(){const t=this.heading;return this.rows===null&&this.error?this.errorCard(i("לא ניתן לטעון את התקני האקלים")):this.rows?this.rows.length?d`<sw-card heading=${t} subheading=${i("התקן שאינו יכול לקרר (אין לו מצב קירור, ייבוש או מאוורר) נספר כחימום. אפשר לקבוע ידנית לכל התקן.")} data-climate-kind-admin>
      <table>
        <thead><tr><th>${i("שם")}</th><th>${i("אזור")}</th><th>${i("סוג")}</th></tr></thead>
        <tbody>${this.rows.map(e=>d`<tr data-entity=${e.entity_id}>
            <td>${P(oe(e))}<div class="muted tech" ${Ae} dir="ltr" title=${i("מזהה טכני (להעתקה)")}>${e.entity_id}</div></td>
            <td>${e.area_name??i("ללא שיוך")}</td>
            <td><select data-climate-kind=${e.entity_id} aria-label=${i("סוג {name}",{name:oe(e)})} ?disabled=${this.busyId===e.entity_id} @change=${s=>void this.choose(e,s.target.value)}>
              <option value="auto" ?selected=${e.set===null}>${i("אוטומטי ({type})",{type:Qe[e.auto]})}</option>
              <option value="ac" ?selected=${e.set==="ac"}>${i("מיזוג")}</option>
              <option value="heating" ?selected=${e.set==="heating"}>${i("חימום")}</option>
            </select></td>
          </tr>`)}</tbody>
      </table>
      ${this.error?d`<div class="err" role="alert">${this.error}</div>`:$}
    </sw-card>`:$:this.loadingCard()}};M.styles=[ie,z`
    :host {
      display: block;
    }
    td:first-child {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    select {
      font: inherit;
      font-size: var(--sw-fs-base);
      min-block-size: 38px;
      padding: 0 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .tech {
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      user-select: all;
      overflow-wrap: anywhere;
    }
    .err {
      color: var(--sw-danger);
    }
  `];ue([p()],M.prototype,"busyId",2);M=ue([A("devices-climate-kind-admin")],M);const Xe=["valve","water_heater"],ne=["switch","outlet","light","fan","heater","water_heater","valve"],_={switch:i("מתג"),outlet:i("שקע"),light:i("תאורה"),fan:i("מאוורר"),heater:i("תנור חימום"),water_heater:i("דוד מים"),valve:i("ברז / השקיה")},le={q:"",kind:"",source:"",floor:"",area:""},Ye=t=>!!(t.q.trim()||t.kind||t.source||t.floor||t.area);function Je(t,e){const s=e.q.trim().toLocaleLowerCase();return t.filter(a=>!(e.kind&&a.kind!==e.kind||e.source==="manual"&&a.set===null||e.source==="auto"&&a.set!==null||e.floor&&a.floor_id!==e.floor||e.area&&a.area_id!==e.area||s&&![a.name,a.entity_id,a.area_name??"",a.floor_name??""].some(o=>o.toLocaleLowerCase().includes(s))))}function We(t,e,s){const a=t.filter(r=>e.has(r.entity_id));if(s==="auto")return{ids:a.filter(r=>r.set!==null).map(r=>r.entity_id),skipped:0};const o=a.filter(r=>r.options.includes(s));return{ids:o.filter(r=>r.set!==s).map(r=>r.entity_id),skipped:a.length-o.length}}function Ze(t,e,s){const a=e?t.findIndex(r=>r.entity_id===e):-1,o=t.findIndex(r=>r.entity_id===s);return a<0||o<0?[s]:t.slice(Math.min(a,o),Math.max(a,o)+1).map(r=>r.entity_id)}const et=500;function tt(t,e=et){const s=[];for(let a=0;a<t.length;a+=e)s.push(t.slice(a,a+e));return s}const st=t=>t==="auto"?i("אוטומטי"):_[t];function at(t,e){return t==="auto"?i("להחזיר {n} התקנים לסוג אוטומטי (לפי השם)?",{n:e}):i('לקבוע את הסוג "{type}" ל־{n} התקנים?',{type:_[t],n:e})}function it(t,e,s){const a=t==="auto"?i("{n} התקנים חזרו לסוג אוטומטי",{n:e}):i('נקבע הסוג "{type}" ל־{n} התקנים',{type:_[t],n:e});return s?`${a}. ${i("{n} לא שונו.",{n:s})}`:`${a}.`}var rt=Object.defineProperty,ot=Object.getOwnPropertyDescriptor,j=(t,e,s,a)=>{for(var o=a>1?void 0:a?ot(e,s):e,r=t.length-1,c;r>=0;r--)(c=t[r])&&(o=(a?c(e,s,o):c(o))||o);return a&&o&&rt(e,s,o),o};let I=class extends L{constructor(){super(...arguments),this.bubbleSkin=new ee(this),this.f={...le},this.bulkKind="water_heater",this.confirm=null,this.busyId="",this.heading=i("סוגי התקנים"),this.sections=["device-types"],this.range=Ze,this.chunk=t=>tt(t)}async fetchRows(){return(await se("devices/device-types")).devices}async chooseOne(t,e){this.busyId=t.entity_id;try{await W(`devices/entities/${encodeURIComponent(t.entity_id)}/device-type`,{kind:e}),this.result="",await this.load()}catch(s){this.result=x(s),await this.load()}finally{this.busyId=""}}async apply(){const t=this.confirm;if(t){this.busy=!0;try{const{changed:e,refused:s}=await this.postChunks("devices/device-types",t.ids,{kind:t.kind});this.result=it(t.kind,e,s),this.selected=new Set}catch(e){this.result=x(e)}finally{this.confirm=null,this.busy=!1,await this.load()}}}async setBulkOn(t,e){this.busyId=t.entity_id;try{await W(`devices/entities/${encodeURIComponent(t.entity_id)}/bulk-on`,{allowed:e}),this.result=""}catch(s){this.result=x(s)}finally{this.busyId="",await this.load()}}bulkOn(t){return!t.set||!Xe.includes(t.set)?$:d`<label class="bulk-on muted"><sw-toggle size="sm" labelHidden in-label label=${i("לכלול בהדלק הכל")} data-type-bulk-on=${t.entity_id} .checked=${!!t.bulk_on_allowed}
        ?disabled=${this.busyId===t.entity_id||this.busy}
        @change=${e=>void this.setBulkOn(t,je(e))}></sw-toggle>${i("לכלול בהדלק הכל")}</label>`}typeSelect(t){return d`<select data-type-select=${t.entity_id} aria-label=${i("סוג {name}",{name:t.name})} ?disabled=${this.busyId===t.entity_id||this.busy}
      @change=${e=>void this.chooseOne(t,e.target.value)}>
      <option value="auto" ?selected=${t.set===null}>${i("אוטומטי ({type})",{type:_[t.auto]})}</option>
      ${t.options.map(e=>d`<option value=${e} ?selected=${t.set===e}>${_[e]}</option>`)}
    </select>`}render(){const t=this.heading,e=this.rows;if(this.error&&!e)return this.errorCard(i("לא ניתן לטעון את ההתקנים"));if(!e)return this.loadingCard();const s=this.f,a=Je(e,s),o=a.slice(0,this.shown),r=this.floorOptions(e),c=this.areaOptions(e),u=l=>this.place(l),k=l=>{if(l.set===null)return d`<span class="muted" data-type-source="auto">${i("אוטומטי")}</span>`;const v=l.set_at?pe(new Date(l.set_at)):"";return d`<span class="manual" data-type-source="manual">${i("ידני")}</span>${l.set_by||v?d`<div class="muted">${[l.set_by,v].filter(Boolean).join(" · ")}</div>`:$}`},S=l=>d`<input type="checkbox" data-type-row=${l.entity_id} aria-label=${i("בחר {name}",{name:l.name})} .checked=${this.selected.has(l.entity_id)} @click=${v=>this.toggle(l.entity_id,v.currentTarget.checked,v.shiftKey,a)} />`,y=We(e,this.selected,this.bulkKind),B=e.filter(l=>l.set!==null).length;return d`<sw-card heading=${t} subheading=${i("הסוג של מתג נקבע לפי השם שלו, למשל 'דוד' או 'ברז'. אפשר לקבוע סוג ידנית - הוא קובע את הסמל ואת הכרטיס בחלון הפעילות.")} data-device-types>
      ${e.length?d`<div class="bar">
              <input type="search" data-type-search placeholder=${i("חיפוש לפי שם, אזור או מזהה…")} aria-label=${i("חיפוש התקנים")} .value=${s.q} @input=${l=>this.setFilter({q:l.target.value})} />
              <select data-type-filter-kind aria-label=${i("סוג")} @change=${l=>this.setFilter({kind:l.target.value})}>
                <option value="" ?selected=${!s.kind}>${i("כל הסוגים")}</option>
                ${ne.map(l=>d`<option value=${l} ?selected=${s.kind===l}>${_[l]}</option>`)}
              </select>
              <select data-type-filter-source aria-label=${i("מקור")} @change=${l=>this.setFilter({source:l.target.value})}>
                <option value="" ?selected=${!s.source}>${i("אוטומטי וידני")}</option>
                <option value="auto" ?selected=${s.source==="auto"}>${i("אוטומטי")}</option>
                <option value="manual" ?selected=${s.source==="manual"}>${i("ידני")} (${m(B)})</option>
              </select>
              <select data-type-floor aria-label=${i("קומה")} @change=${l=>this.setFilter({floor:l.target.value,area:""})}><option value="">${i("כל הקומות")}</option>${r.map(([l,v])=>d`<option value=${l} ?selected=${s.floor===l}>${v}</option>`)}</select>
              <select data-type-area aria-label=${i("אזור")} @change=${l=>this.setFilter({area:l.target.value})}><option value="">${i("כל האזורים")}</option>${c.map(([l,v])=>d`<option value=${l} ?selected=${s.area===l}>${v}</option>`)}</select>
              ${Ye(s)?d`<sw-button size="sm" variant="ghost" data-type-reset @click=${()=>this.setFilter({...le})}>${i("נקה סינון")}</sw-button>`:$}
            </div>
            <div class="note" data-type-counts>${a.length===e.length?i("{n} התקנים",{n:m(e.length)}):i("{n} מתוך {total} התקנים",{n:m(a.length),total:m(e.length)})}</div>`:$}
      ${a.length?d`<table>
              <thead><tr><th><span class="muted">${i("בחירה")}</span></th><th>${i("שם")}</th><th>${i("קומה ‹ אזור")}</th><th>${i("סוג")}</th><th>${i("מקור")}</th></tr></thead>
              <tbody>${o.map(l=>d`<tr data-entity=${l.entity_id}><td>${S(l)}</td><td>${P(l.name)}<div class="muted">${l.entity_id}</div></td><td>${u(l)}</td><td>${this.typeSelect(l)}${this.bulkOn(l)}</td><td>${k(l)}</td></tr>`)}</tbody>
            </table>
            <div class="cards">${o.map(l=>d`<div class="card" data-entity=${l.entity_id}>${S(l)}<span>${P(l.name)}</span><span class="sub">${u(l)} · ${k(l)}</span>${this.typeSelect(l)}${this.bulkOn(l)}</div>`)}</div>`:d`<sw-state-panel icon=${e.length?"filter":"sensor"} compact state="empty" heading=${e.length?i("אין התקנים שמתאימים לסינון"):i("אין מתגים")} data-type-empty></sw-state-panel>`}
      ${a.length>this.shown?d`<sw-button size="sm" data-type-more @click=${()=>this.shown+=R}>${i("הצג עוד")} (${m(a.length-this.shown)})</sw-button>`:$}
      ${e.length?d`<div class="actions bulk">
            <span data-type-selected>${i("נבחרו {n}",{n:m(this.selected.size)})}</span>
            <sw-button size="sm" data-type-all ?disabled=${!a.length} @click=${()=>this.selected=new Set([...this.selected,...a.map(l=>l.entity_id)])}>${i("בחר הכול")} (${m(a.length)})</sw-button>
            <sw-button size="sm" variant="ghost" data-type-clear ?disabled=${!this.selected.size} @click=${()=>this.selected=new Set}>${i("נקה בחירה")}</sw-button>
            <select data-type-bulk-kind aria-label=${i("סוג לנבחרים")} @change=${l=>this.bulkKind=l.target.value}>
              ${ne.map(l=>d`<option value=${l} ?selected=${this.bulkKind===l}>${_[l]}</option>`)}
              <option value="auto" ?selected=${this.bulkKind==="auto"}>${i("החזר לאוטומטי")}</option>
            </select>
            <sw-button size="sm" variant="primary" data-type-bulk-apply ?disabled=${!y.ids.length||this.busy} @click=${()=>this.confirm={kind:this.bulkKind,ids:y.ids}}>${i("החל על הנבחרים")}${y.ids.length?` (${m(y.ids.length)})`:""}</sw-button>
            ${y.skipped?d`<span class="muted" data-type-skipped>${i("{n} לא יכולים לקבל את הסוג הזה",{n:m(y.skipped)})}</span>`:$}
          </div>`:$}
      ${this.result?d`<div class="note" role="status" data-type-result>${this.result}</div>`:$}
      ${this.confirm?this.renderConfirm(this.confirm):$}
    </sw-card>`}renderConfirm(t){return d`<sw-dialog open ?locked=${this.busy} data-type-dialog heading=${i("שינוי סוג")} @close=${()=>this.confirm=null}>
      <div data-type-question>${at(t.kind,t.ids.length)}</div>
      <div class="actions">
        <sw-button data-type-cancel autofocus @click=${()=>this.confirm=null}>${i("ביטול")}</sw-button>
        <sw-button variant="primary" data-type-confirm ?disabled=${this.busy} @click=${()=>void this.apply()}>${st(t.kind)} (${m(t.ids.length)})</sw-button>
      </div>
    </sw-dialog>`}};I.styles=[he,ie,z`
    .manual {
      font-weight: var(--sw-fw-bold);
      color: var(--sw-accent-text, var(--sw-text));
    }
    td select {
      min-inline-size: 180px;
    }
    .err {
      color: var(--sw-danger);
    }
    .bulk-on {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-block-start: 4px;
      min-block-size: 32px;
    }
    @media (max-width: 599px) {
      .card {
        gap: 4px 10px;
      }
      .card select,
      .card .bulk-on {
        grid-column: 2;
        inline-size: 100%;
      }
    }
  `,ae];j([p()],I.prototype,"f",2);j([p()],I.prototype,"bulkKind",2);j([p()],I.prototype,"confirm",2);j([p()],I.prototype,"busyId",2);I=j([A("devices-type-admin")],I);const nt=t=>t==="dismiss"?"unprotect":t,N=t=>t.alarm_managed||t.doors_layer||!!t.media_managed,q=t=>t.suggested&&!t.protected;function lt(t){return t.alarm_managed?"alarm":t.doors_layer?"doors":t.media_managed?"media":t.protected?"protected":q(t)?"suggested":"unprotected"}const dt={alarm:h("נשלט ממסך האזעקה"),doors:h("בשכבת הדלתות"),media:h("נשלט ממסך המולטימדיה"),suggested:h("מוצע להגנה"),protected:h("מוגן"),unprotected:h("לא מוגן")},de={q:"",status:"",category:"",floor:"",area:"",sort:"name"};function ct(t,e){const s=e.q.trim().toLowerCase(),a=t.filter(r=>!(s&&!`${r.name} ${r.area_name??""} ${r.floor_name??""} ${r.entity_id}`.toLowerCase().includes(s)||e.status==="protected"&&!r.protected||e.status==="suggested"&&!q(r)||e.status==="unprotected"&&r.protected||e.category&&r.category!==e.category||e.floor&&r.floor_id!==e.floor||e.area&&r.area_id!==e.area)),o=r=>e.sort==="area"?`${r.floor_name??"￿"} ${r.area_name??"￿"} ${r.name}`:r.name;return a.sort((r,c)=>o(r).localeCompare(o(c),"he"))}const pt=t=>!!(t.q.trim()||t.status||t.category||t.floor||t.area),ce=t=>t.filter(e=>q(e)&&!N(e)).map(e=>e.entity_id);function ht(t,e,s){const a=s?.protected??e.filter(r=>r.protected).length,o=s?.suggested??e.filter(q).length;return`${h("{shown} מתוך {total} מתגים · {protectedN} מוגנים",{shown:t,total:s?.switches??e.length,protectedN:a})}${o?h(" · {suggestedN} מוצעים להגנה",{suggestedN:o}):""}`}function ut(t,e,s){const a=e?t.findIndex(r=>r.entity_id===e):-1,o=t.findIndex(r=>r.entity_id===s);return a<0||o<0?[s]:t.slice(Math.min(a,o),Math.max(a,o)+1).filter(r=>!N(r)).map(r=>r.entity_id)}function U(t,e,s){return e.filter(a=>s.has(a.entity_id)&&!N(a)).filter(a=>t==="protect"?!a.protected:t==="unprotect"?a.protected:q(a)).map(a=>a.entity_id)}const $t=500;function bt(t,e=$t){const s=[];for(let a=0;a<t.length;a+=e)s.push(t.slice(a,a+e));return s}function mt(t,e,s){return`${t==="protect"||t==="approve"?h("הוגנו {changed} מתגים",{changed:e}):t==="unprotect"?h("הוסרה ההגנה מ־{changed} מתגים",{changed:e}):h("נדחתה ההצעה ל־{changed} מתגים",{changed:e})}${s?h(" · {refused} לא שונו (נשלטים ממסך אחר, בשכבת הדלתות או שאינם מתגים)",{refused:s}):""}`}const ft={protect:{heading:h("הגנה על מתגים"),button:h("הגן"),danger:!1},approve:{heading:h("הגנה על המתגים המוצעים"),button:h("הגן"),danger:!1},unprotect:{heading:h("הסרת הגנה"),button:h("הסר הגנה"),danger:!0},dismiss:{heading:h("דחיית הצעה"),button:h("דחה הצעה"),danger:!1}};function gt(t,e){return t==="unprotect"?h("{n} מתגים ייכללו ב'כבה הכל' ובפעולות קבוצתיות. להמשיך?",{n:e}):t==="dismiss"?h("לדחות את ההצעה להגן על {n} מתגים? הם ימשיכו להיכלל ב'כבה הכל' ובפעולות קבוצתיות.",{n:e}):h("להגן על {n} מתגים? הם לא ייכללו ב'כבה הכל' ובפעולות קבוצתיות.",{n:e})}var wt=Object.defineProperty,vt=Object.getOwnPropertyDescriptor,K=(t,e,s,a)=>{for(var o=a>1?void 0:a?vt(e,s):e,r=t.length-1,c;r>=0;r--)(c=t[r])&&(o=(a?c(e,s,o):c(o))||o);return a&&o&&wt(e,s,o),o};let O=class extends L{constructor(){super(...arguments),this.bubbleSkin=new ee(this),this.summary=null,this.categories=[],this.f={...de},this.confirm=null,this.heading=i("מתגים מוגנים"),this.sections=["protected-switches","bulk-safe"],this.range=ut,this.chunk=t=>bt(t)}async fetchRows(){const t=await se("devices/bulk-protected");return this.summary=t.summary,this.categories=t.categories??[],t.switches}ask(t,e){e.length&&(this.confirm={action:t,ids:e})}async apply(){const t=this.confirm;if(t){this.busy=!0;try{const{changed:e,refused:s}=await this.postChunks("devices/bulk-protected",t.ids,{action:nt(t.action)});this.result=mt(t.action,e,s),this.selected=new Set,this.confirm=null,await this.load()}catch(e){this.result=x(e),this.confirm=null,await this.load()}finally{this.busy=!1}}}render(){const t=this.rows,e=this.heading;if(this.error)return this.errorCard(i("לא ניתן לטעון את המתגים"));if(!t)return this.loadingCard();const s=this.f,a=ct(t,s),o=a.slice(0,this.shown),r=this.floorOptions(t),c=this.areaOptions(t),u=a.filter(n=>!N(n)),k=ce(t).length,S=n=>this.place(n),y=n=>{const f=lt(n);return d`<span class=${f==="protected"?"yes":f==="suggested"?"wait":"no"} data-status=${f}>${dt[f]}</span>`},B=n=>n.source==="auto"?d`<span title=${n.rule??""}>${i("הצעה אוטומטית")}${n.category_label?` · ${n.category_label}`:""}</span>`:n.source==="manual"?i("ידני"):d`<span class="muted">—</span>`,l=n=>n.protected&&n.reviewed?d`<span class="yes" aria-label=${i("אושר")}>✓</span>`:d`<span class="muted">—</span>`,v=n=>{const f=n.reviewed_at??n.marked_at,$e=n.reviewed_at?n.reviewed_by:n.marked_by;return f?[$e,pe(new Date(f))].filter(Boolean).join(" · "):""},re=n=>d`<input type="checkbox" data-protected-row=${n.entity_id} aria-label=${i("בחר {name}",{name:n.name})} .checked=${this.selected.has(n.entity_id)} ?disabled=${N(n)} @click=${f=>this.toggle(n.entity_id,f.currentTarget.checked,f.shiftKey,a)} />`,G=n=>U(n,t,this.selected).length;return d`<sw-card heading=${e} subheading=${i("מתגים מוגנים לא נכללים ב'כבה הכל' ובפעולות קבוצתיות. אפשר עדיין להפעיל אותם לבד, בתזמון ובאוטומציה.")} data-protected-switches>
      ${k?d`<div class="strip" role="status" data-protected-strip>
            <span class="grow">${i("{n} מתגים מוצעים להגנה לפי השם או הסוג שלהם. הם נכללים ב'כבה הכל' עד שתאשרו",{n:m(k)})}</span>
            <sw-button size="sm" data-protected-show @click=${()=>this.setFilter({status:"suggested"})}>${i("הצג")}</sw-button>
            <sw-button size="sm" variant="primary" data-protected-approve-all ?disabled=${this.busy} @click=${()=>this.ask("approve",ce(t))}>${i("הגן על כולם")}</sw-button>
          </div>`:$}
      <div class="bar">
        <input type="search" data-protected-search placeholder=${i("חיפוש לפי שם, אזור או מזהה…")} aria-label=${i("חיפוש מתגים")} .value=${s.q} @input=${n=>this.setFilter({q:n.target.value})} />
        <select data-protected-status aria-label=${i("סטטוס")} @change=${n=>this.setFilter({status:n.target.value})}>
          <option value="" ?selected=${!s.status}>${i("הכל")}</option>
          <option value="protected" ?selected=${s.status==="protected"}>${i("מוגנים")}</option>
          <option value="suggested" ?selected=${s.status==="suggested"}>${i("מוצעים להגנה")}</option>
          <option value="unprotected" ?selected=${s.status==="unprotected"}>${i("לא מוגנים")}</option>
        </select>
        <select data-protected-category aria-label=${i("קטגוריה")} @change=${n=>this.setFilter({category:n.target.value})}><option value="">${i("כל הקטגוריות")}</option>${this.categories.map(n=>d`<option value=${n.id} ?selected=${s.category===n.id}>${n.label}</option>`)}</select>
        <select data-protected-floor aria-label=${i("קומה")} @change=${n=>this.setFilter({floor:n.target.value,area:""})}><option value="">${i("כל הקומות")}</option>${r.map(([n,f])=>d`<option value=${n} ?selected=${s.floor===n}>${f}</option>`)}</select>
        <select data-protected-area aria-label=${i("אזור")} @change=${n=>this.setFilter({area:n.target.value})}><option value="">${i("כל האזורים")}</option>${c.map(([n,f])=>d`<option value=${n} ?selected=${s.area===n}>${f}</option>`)}</select>
        ${pt(s)?d`<sw-button size="sm" variant="ghost" data-protected-reset @click=${()=>{this.f={...de,sort:s.sort},this.shown=R}}>${i("נקה סינון")}</sw-button>`:$}
      </div>
      <div class="note" data-protected-counts>${ht(a.length,t,this.summary)}</div>
      ${a.length?d`<table>
              <thead><tr>
                <th><span class="muted">${i("בחירה")}</span></th>
                <th aria-sort=${s.sort==="name"?"ascending":"none"}><button type="button" data-protected-sort="name" @click=${()=>this.setFilter({sort:"name"})}>${i("שם")}</button></th>
                <th aria-sort=${s.sort==="area"?"ascending":"none"}><button type="button" data-protected-sort="area" @click=${()=>this.setFilter({sort:"area"})}>${i("קומה ‹ אזור")}</button></th>
                <th>${i("מוגן")}</th><th>${i("מקור")}</th><th>${i("אושר")}</th><th>${i("שונה על ידי")}</th>
              </tr></thead>
              <tbody>${o.map(n=>d`<tr data-entity=${n.entity_id}><td>${re(n)}</td><td>${P(n.name)}<div class="muted">${n.entity_id}</div></td><td>${S(n)}</td><td>${y(n)}</td><td>${B(n)}</td><td>${l(n)}</td><td class="muted">${v(n)}</td></tr>`)}</tbody>
            </table>
            <div class="cards">${o.map(n=>d`<label class="card" data-entity=${n.entity_id}>${re(n)}<span>${P(n.name)} · ${y(n)}</span><span class="sub">${S(n)}${n.source?d` · ${B(n)}`:$}</span></label>`)}</div>`:d`<sw-state-panel icon=${t.length?"filter":"power"} compact state="empty" heading=${t.length?i("אין מתגים שמתאימים לסינון"):i("אין מתגים")} data-protected-empty></sw-state-panel>`}
      ${a.length>this.shown?d`<sw-button size="sm" data-protected-more @click=${()=>this.shown+=R}>${i("הצג עוד")} (${m(a.length-this.shown)})</sw-button>`:$}
      <div class="actions bulk">
        <span data-protected-selected>${i("נבחרו {n} מתוך {total}",{n:m(this.selected.size),total:m(t.length)})}</span>
        <sw-button size="sm" data-protected-all ?disabled=${!u.length} @click=${()=>this.selected=new Set([...this.selected,...u.map(n=>n.entity_id)])}>${i("בחר הכול")} (${m(u.length)})</sw-button>
        <sw-button size="sm" variant="ghost" data-protected-clear ?disabled=${!this.selected.size} @click=${()=>this.selected=new Set}>${i("נקה בחירה")}</sw-button>
        <sw-button size="sm" variant="primary" data-protected-do-protect ?disabled=${!G("protect")} @click=${()=>this.ask("protect",U("protect",t,this.selected))}>${i("הגן")}</sw-button>
        <sw-button size="sm" data-protected-do-dismiss ?disabled=${!G("dismiss")} @click=${()=>this.ask("dismiss",U("dismiss",t,this.selected))}>${i("דחה הצעה")}</sw-button>
        <sw-button size="sm" data-protected-do-unprotect ?disabled=${!G("unprotect")} @click=${()=>this.ask("unprotect",U("unprotect",t,this.selected))}>${i("הסר הגנה")}</sw-button>
      </div>
      ${this.result?d`<div class="note" role="status" data-protected-result>${this.result}</div>`:$}
      ${this.confirm===null?$:this.renderConfirm(this.confirm)}
    </sw-card>`}renderConfirm(t){const e=ft[t.action];return d`<sw-dialog open ?locked=${this.busy} data-protected-dialog=${t.action} heading=${e.heading} @close=${()=>this.confirm=null}>
      <div data-protected-question>${gt(t.action,t.ids.length)}</div>
      ${t.action==="unprotect"?d`<div class="warn">${i("מתג יכול להיות דוד, משאבה או שער - ודאו שבטוח לכבות ולהדליק אותו יחד עם שאר המתגים.")}</div>`:$}
      <div class="actions">
        <sw-button data-protected-cancel autofocus @click=${()=>this.confirm=null}>${i("ביטול")}</sw-button>
        <sw-button variant=${e.danger?"danger":"primary"} data-protected-confirm ?disabled=${this.busy} @click=${()=>void this.apply()}>${e.button} (${m(t.ids.length)})</sw-button>
      </div>
    </sw-dialog>`}};O.styles=[he,ie,z`
    .strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      padding: 12px 14px;
      margin-block-end: 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text, var(--sw-text));
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
    }
    .strip .grow {
      flex: 1;
      min-inline-size: 200px;
    }
    th button {
      font: inherit;
      font-weight: var(--sw-fw-bold);
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
      color: inherit;
    }
    .yes,
    .wait,
    .no {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 26px;
      padding: 0 10px;
      border-radius: 999px;
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
    }
    .yes {
      background: var(--sw-success-soft);
      color: var(--sw-success-text, var(--sw-success));
    }
    .wait {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text, var(--sw-warning));
    }
    .no {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .warn {
      padding: 8px 10px;
      margin-block: 8px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-warning-soft);
      font-size: var(--sw-fs-sm);
    }
  `,ae];K([p()],O.prototype,"summary",2);K([p()],O.prototype,"categories",2);K([p()],O.prototype,"f",2);K([p()],O.prototype,"confirm",2);O=K([A("devices-protected-switches")],O);
