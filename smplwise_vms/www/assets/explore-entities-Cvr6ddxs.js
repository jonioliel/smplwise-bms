import{i as y,aL as x,b as n,U as e,a2 as $,aA as _,aa as k,R as S,aM as z,aN as A,aO as T,n as P,aP as g,aQ as v,A as f,aR as F,aS as b,Y as u,aT as I,aU as q,aV as O,g as j,j as c,k as D}from"./index-rXjlW4bK.js";import"./sw-table-BkAxAukF.js";import"./sw-chip-DbEqThVX.js";import{s as E}from"./ha-sync-status-BRejKvkc.js";import"./sw-logo-art-PLtEZJxU.js";var C=Object.defineProperty,R=Object.getOwnPropertyDescriptor,d=(t,i,a,s)=>{for(var l=s>1?void 0:s?R(i,a):i,p=t.length-1,h;p>=0;p--)(h=t[p])&&(l=(s?h(i,a,l):h(l))||l);return s&&l&&C(i,a,l),l};const w=[{id:"lock.main_door",name:"דלת כניסה",domain:"lock",area:"לובי",state:"נעול",fresh:"live",placed:!0,actions:"נעילה / פתיחה (grant נפרד)"},{id:"light.lobby",name:"תאורת לובי",domain:"light",area:"לובי",state:"דולק · 80%",fresh:"live",placed:!0,actions:"הדלקה / כיבוי / עמעום"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",domain:"binary_sensor",area:"אולם",state:"ללא תנועה",fresh:"live",placed:!0,actions:"קריאה בלבד"},{id:"climate.hall",name:"מזגן אולם",domain:"climate",area:"אולם",state:"קירור · 23°",fresh:"stale",placed:!1,actions:"יעד טמפרטורה (allowlist)"},{id:"cover.parking_gate",name:"שער חניה",domain:"cover",area:"חניה",state:"סגור",fresh:"live",placed:!1,actions:"פתיחה / סגירה (רגיש)"},{id:"script.night_mode",name:"מצב לילה",domain:"script",area:"—",state:"—",fresh:"unknown",placed:!1,actions:"חסום עד allowlist"},{id:"sensor.power_main",name:"צריכת חשמל",domain:"sensor",area:"חדר מכונות",state:"4.2 kW",fresh:"live",placed:!1,actions:"קריאה בלבד"},{id:"camera.intercom_m2",name:"אינטרקום M2",domain:"camera",area:"כניסה",state:"זמין",fresh:"live",placed:!1,actions:"צפייה (provider נפרד)"}];function L(t){return t==="lock"||t==="cover"?"lock":t==="light"||t==="switch"||t==="fan"?"light":t==="camera"?"camera":t==="climate"||t==="script"||t==="scene"||t==="button"||t==="automation"?"activity":"sensor"}let o=class extends y{constructor(){super(...arguments),this.bubbleSkin=new x(this),this.selected=null,this.domain="all",this.q="",this.area="",this.onlyPlaced=!1,this.cat=null,this.error="",this.loading=!1,this.sync=null,this.firstFloorId=null,this.stopWs=null,this.searchTimer=0,this.structureAgain=!1,this.columns=[{key:"name",label:e("ישות"),render:t=>n`<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:grid;place-items:center;inline-size:26px;block-size:26px;border-radius:var(--sw-r-xs);background:var(--sw-accent-soft);color:var(--sw-accent)"><sw-icon name=${L(String(t.domain))} size=${13}></sw-icon></span><span><strong>${String(t.name)}</strong><div class="ltr" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${String(t.id)}</div></span></span>`},{key:"domain",label:"Domain",ltr:!0},{key:"area",label:e("אזור")},{key:"state",label:e("מצב")},{key:"fresh",label:e("רעננות"),render:t=>n`<sw-badge kind=${t.fresh} label=${t.fresh==="live"||t.fresh==="neutral"?e("עדכני"):t.fresh==="stale"?e("מיושן"):t.fresh==="offline"?e("לא זמין"):e("לא ידוע")}></sw-badge>`},{key:"placed",label:e("במפה"),render:t=>t.placed?n`<sw-badge kind="recorded" label=${e("מוצב")}></sw-badge>`:n`<span style="color:var(--sw-text-3)">${e("לא")}</span>`}]}get forbidden(){return $()&&!_("system.configure")}connectedCallback(){super.connectedCallback(),this.q=k().params.get("q")??"",$()&&!this.forbidden&&(this.load(),S().then(t=>this.firstFloorId=z(t)?.id??null).catch(()=>{}),this.stopWs=A(t=>{if(t.type==="entity_state_changed"&&this.cat){const i=this.cat.entities.findIndex(a=>a.entity_id===t.entity.entity_id);if(i>=0){const a=[...this.cat.entities];a[i]={...a[i],...t.entity,placements:a[i].placements,actions:a[i].actions},this.cat={...this.cat,entities:a}}}else t.type==="heartbeat"?this.sync=t.sync:t.type==="ha_sync_state"&&this.sync?this.sync={...this.sync,connected:t.connected}:t.type==="structure_changed"&&this.reloadForStructure()}))}disconnectedCallback(){super.disconnectedCallback(),this.stopWs?.(),this.stopWs=null}reloadForStructure(){this.loading?this.structureAgain=!0:this.load()}async load(){this.loading=!0,this.error="";try{this.cat=await T({domain:this.domain==="all"?void 0:this.domain,q:this.q||void 0,area:this.area||void 0,placed:this.onlyPlaced?!0:void 0,limit:800}),this.sync=this.cat.sync}catch(t){this.error=P(t)}finally{this.loading=!1,this.structureAgain&&(this.structureAgain=!1,this.load())}}onSearch(t){this.q=t,window.clearTimeout(this.searchTimer),this.searchTimer=window.setTimeout(()=>void this.load(),250)}toRow(t){return{id:t.entity_id,name:t.name||t.original_name||t.entity_id,domain:t.domain,area:t.area_name??"—",state:v(t),fresh:g(t),placed:!!t.placements?.length,actions:t.actions?.length?t.actions.map(i=>`${i.label}${i.sensitive?e(" (רגיש)"):""}`).join(" / "):e("קריאה בלבד")}}renderApiDrawer(t){const i=g(t),a=Object.entries(t.attributes).filter(([s])=>s!=="friendly_name"&&s!=="icon").slice(0,14);return n`<sw-drawer open heading=${t.name||t.original_name||t.entity_id} subheading=${t.entity_id} @close=${()=>this.selected=null}>
      <dl>
        <dt>${e("מצב")}</dt><dd><sw-badge kind=${i} label=${v(t)}></sw-badge></dd>
        <dt>Domain</dt><dd><span class="ltr">${t.domain}</span> · ${F(t.domain)}${t.device_class?n` · <span class="ltr">${t.device_class}</span>`:f}</dd>
        <dt>${e("אזור")}</dt><dd>${t.area_name??"—"}${t.ha_floor_name?` · ${t.ha_floor_name}`:""}</dd>
        <dt>${e("שינוי אחרון")}</dt><dd>${b(t.last_changed)}</dd>
        <dt>${e("נראה לאחרונה")}</dt><dd>${b(t.state_seen_at)}${t.fresh?"":e(" · הסנכרון מנותק")}</dd>
        <dt>${e("אינטגרציה")}</dt><dd><span class="ltr">${t.platform??"—"}</span></dd>
        <dt>${e("פעולות נתמכות")}</dt><dd>${t.actions?.length?t.actions.map(s=>`${s.label}${s.sensitive?e(" (רגיש)"):""}`).join(" / "):e("קריאה בלבד")}</dd>
        <dt>${e("במפה")}</dt><dd>${t.placements?.length?n`<span class="chips">${t.placements.map(s=>n`<sw-chip @click=${()=>u(`/explore/floors/${s.floor_id}`)}>${s.floor_name}</sw-chip>`)}</span>`:e("לא מוצב")}</dd>
      </dl>
      ${a.length?n`<div class="attrs">${a.map(([s,l])=>n`<span>${s}</span><span>${typeof l=="object"?JSON.stringify(l):String(l)}</span>`)}</div>`:f}
      <div class="note">${e("הקטלוג הוא שיקוף לקריאה בלבד של תשתית המערכת. הפעולות רצות בזהות המשתמש; שליטה מהמפה דורשת הרשאת ha.entity.control.")}</div>
      <div slot="footer">
        ${t.placements?.length?n`<sw-button variant="primary" icon="map" @click=${()=>u(`/explore/floors/${t.placements[0].floor_id}`)}>${e("הצג במפה")}</sw-button>`:I("structure")?f:n`<sw-button variant="primary" icon="map" ?disabled=${!this.firstFloorId} title=${this.firstFloorId?e("פותח את עורך התוכנית עם הישות מוכנה להצבה"):e("אין קומות עדיין")} @click=${()=>this.firstFloorId&&u(`/explore/floors/${this.firstFloorId}/edit`,{entity:t.entity_id})}>${e("הצב במפה")}</sw-button>`}
      </div>
    </sw-drawer>`}renderApi(){const t=this.cat,i=this.sync,a=t?t.entities.map(r=>this.toRow(r)):[],s=t?Object.entries(t.domains).sort((r,m)=>m[1]-r[1]):[],l=t?.entities.find(r=>r.entity_id===this.selected),p=s.reduce((r,[,m])=>r+m,0),h=i?`${e("{total} ישויות בקטלוג",{total:p})} · ${i.connected?e("סנכרון פעיל · גרסה {version}",{version:i.ha_version??""}):e("הסנכרון {state}",{state:E(i.last_error)})}`:e("טוען את הקטלוג…");return n`
      <sw-page crumbs=${e("הגדרות")} heading=${e("קטלוג ההתקנים")} subheading=${h}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.loading} @click=${()=>this.load()}>${e("רענון")}</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder=${e("חיפוש לפי שם, entity_id או אזור")} .value=${this.q} @input=${r=>this.onSearch(r.target.value)} /></sw-field>
          <sw-field><select aria-label=${e("אזור")} @change=${r=>{this.area=r.target.value,this.load()}}><option value="">${e("כל האזורים")}</option>${(t?.areas??[]).map(r=>n`<option value=${r.area_id} ?selected=${r.area_id===this.area}>${r.area_name??r.area_id}</option>`)}</select></sw-field>
          <sw-chip ?selected=${this.onlyPlaced} icon="map" @click=${()=>{this.onlyPlaced=!this.onlyPlaced,this.load()}}>${e("מוצבות בלבד")}</sw-chip>
        </div>
        <div class="filters">
          <sw-chip ?selected=${this.domain==="all"} count=${p} @click=${()=>{this.domain="all",this.load()}}>${e("הכל")}</sw-chip>
          ${s.map(([r,m])=>n`<sw-chip ?selected=${r===this.domain} count=${m} @click=${()=>{this.domain=r,this.load()}}><span class="ltr">${r}</span></sw-chip>`)}
        </div>
        <div class="stage">
          ${this.error?n`<sw-state-panel state="error" hint=${this.error} actionLabel=${e("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`:t?a.length?n`<sw-table .columns=${this.columns} .rows=${a} .selected=${this.selected} @row-select=${r=>this.selected=r.detail.id}></sw-table>`:n`<sw-state-panel icon=${p?"filter":"list"} state="empty" heading=${p?e("אין ישויות שתואמות את הסינון"):e("הקטלוג ריק")} hint=${p?e("נקה את החיפוש או בחר domain אחר."):i?.connected?e("ההסנכרון פעיל אך טרם התקבלו מצבים."):e("לא מחובר לתשתית המערכת. בדוק בהגדרות → כללי.")}></sw-state-panel>`:n`<sw-state-panel state="loading"></sw-state-panel>`}
          ${l?this.renderApiDrawer(l):f}
        </div>
      </sw-page>
    `}render(){if(this.forbidden)return n`<sw-page crumbs=${e("הגדרות")} heading=${e("קטלוג ההתקנים")}><sw-state-panel state="forbidden" data-entities-forbidden></sw-state-panel></sw-page>`;if($())return this.renderApi();const t=["all",...new Set(w.map(s=>s.domain))],i=w.filter(s=>this.domain==="all"||s.domain===this.domain),a=w.find(s=>s.id===this.selected);return n`
      <sw-page crumbs=${e("הגדרות")} heading=${e("קטלוג ההתקנים")} subheading=${e("{n} ישויות מורשות לחיבור · הצבה על המפה ושליטה הן הרשאות נפרדות · נתוני הדגמה",{n:w.length})}>
        <sw-button slot="actions" icon="refresh">${e("סנכרון")}</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder=${e("חיפוש לפי שם, entity_id או אזור")} /></sw-field>
          ${t.map(s=>n`<sw-chip ?selected=${s===this.domain} @click=${()=>this.domain=s}>${s==="all"?e("הכל"):s}</sw-chip>`)}
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${i} .selected=${this.selected} @row-select=${s=>this.selected=s.detail.id}></sw-table>
          ${a?n`<sw-drawer open heading=${a.name} subheading=${a.id} @close=${()=>this.selected=null}>
                <dl>
                  <dt>${e("מצב")}</dt><dd><sw-badge kind=${a.fresh} label=${a.state}></sw-badge></dd>
                  <dt>Domain</dt><dd><span class="ltr">${a.domain}</span></dd>
                  <dt>${e("אזור")}</dt><dd>${a.area}</dd>
                  <dt>${e("פעולות נתמכות")}</dt><dd>${a.actions}</dd>
                  <dt>${e("במפה")}</dt><dd>${a.placed?"קומה 0":e("לא מוצב")}</dd>
                </dl>
                <div class="note">${e("ישות מ־domain לא מוכר מקבלת כרטיס כללי לקריאה בלבד. scripts ו־scenes חסומים עד allowlist.")}</div>
                <div slot="footer">
                  <sw-button variant="primary" icon="map">${a.placed?e("הצג במפה"):e("הצב במפה")}</sw-button>
                  <sw-button variant="ghost">${e("פתח בתשתית המערכת")}</sw-button>
                </div>
              </sw-drawer>`:""}
        </div>
      </sw-page>
    `}};o.styles=[j`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .search {
      flex: 1;
      min-inline-size: 220px;
      max-inline-size: 420px;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 10px;
    }
    .attrs {
      margin-block-start: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 3px 10px;
      direction: ltr;
      text-align: start;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .statusline {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    ${O}
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): the drawer's key / value list is a well (surface 2, no hairlines) with the values as
       14/600 headings - the value is the answer; the keys stay the quiet column. The table itself is the shared sw-table (not touched). */
    dl {
      gap: 10px 14px;
      padding: 12px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      align-items: center;
    }
    dt {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    dd {
      font-size: var(--sw-fs-lg); /* loop 2: the value is the answer - 15/600 heading ink */
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .attrs {
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
    }
    .note {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
    }
  `,q];d([c()],o.prototype,"selected",2);d([c()],o.prototype,"domain",2);d([c()],o.prototype,"q",2);d([c()],o.prototype,"area",2);d([c()],o.prototype,"onlyPlaced",2);d([c()],o.prototype,"cat",2);d([c()],o.prototype,"error",2);d([c()],o.prototype,"loading",2);d([c()],o.prototype,"sync",2);d([c()],o.prototype,"firstFloorId",2);o=d([D("explore-entities")],o);export{o as ExploreEntities,L as domainIcon};
