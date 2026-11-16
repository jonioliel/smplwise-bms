import{a as $,S as y,q as i,K as w,bD as x,bI as _,bm as k,cx as S,aS as z,cd as A,ak as I,cy as g,ct as b,p as m,cu as T,cz as v,br as u,cA as F,a4 as P,i as q,r as d,x as D}from"./index-C5kZ9jiu.js";import"./sw-table-BPsqqbv1.js";import"./sw-chip-C5B_TIu4.js";import{s as E}from"./ha-sync-status-9DcgxODD.js";import"./sw-logo-art-Va6y_cIM.js";var O=Object.defineProperty,j=Object.getOwnPropertyDescriptor,o=(t,a,s,e)=>{for(var r=e>1?void 0:e?j(a,s):a,c=t.length-1,p;c>=0;c--)(p=t[c])&&(r=(e?p(a,s,r):p(r))||r);return e&&r&&O(a,s,r),r};const f=[{id:"lock.main_door",name:"דלת כניסה",domain:"lock",area:"לובי",state:"נעול",fresh:"live",placed:!0,actions:"נעילה / פתיחה (grant נפרד)"},{id:"light.lobby",name:"תאורת לובי",domain:"light",area:"לובי",state:"דולק · 80%",fresh:"live",placed:!0,actions:"הדלקה / כיבוי / עמעום"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",domain:"binary_sensor",area:"אולם",state:"ללא תנועה",fresh:"live",placed:!0,actions:"קריאה בלבד"},{id:"climate.hall",name:"מזגן אולם",domain:"climate",area:"אולם",state:"קירור · 23°",fresh:"stale",placed:!1,actions:"יעד טמפרטורה (allowlist)"},{id:"cover.parking_gate",name:"שער חניה",domain:"cover",area:"חניה",state:"סגור",fresh:"live",placed:!1,actions:"פתיחה / סגירה (רגיש)"},{id:"script.night_mode",name:"מצב לילה",domain:"script",area:"—",state:"—",fresh:"unknown",placed:!1,actions:"חסום עד allowlist"},{id:"sensor.power_main",name:"צריכת חשמל",domain:"sensor",area:"חדר מכונות",state:"4.2 kW",fresh:"live",placed:!1,actions:"קריאה בלבד"},{id:"camera.intercom_m2",name:"אינטרקום M2",domain:"camera",area:"כניסה",state:"זמין",fresh:"live",placed:!1,actions:"צפייה (provider נפרד)"}];function C(t){return t==="lock"||t==="cover"?"lock":t==="light"||t==="switch"||t==="fan"?"light":t==="camera"?"camera":t==="climate"||t==="script"||t==="scene"||t==="button"||t==="automation"?"activity":"sensor"}let l=class extends ${constructor(){super(...arguments),this.bubbleSkin=new y(this),this.selected=null,this.domain="all",this.q="",this.area="",this.onlyPlaced=!1,this.cat=null,this.error="",this.loading=!1,this.sync=null,this.firstFloorId=null,this.stopWs=null,this.searchTimer=0,this.structureAgain=!1,this.columns=[{key:"name",label:"ישות",render:t=>i`<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:grid;place-items:center;inline-size:26px;block-size:26px;border-radius:var(--sw-r-xs);background:var(--sw-accent-soft);color:var(--sw-accent)"><sw-icon name=${C(String(t.domain))} size=${13}></sw-icon></span><span><strong>${String(t.name)}</strong><div class="ltr" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${String(t.id)}</div></span></span>`},{key:"domain",label:"Domain",ltr:!0},{key:"area",label:"אזור"},{key:"state",label:"מצב"},{key:"fresh",label:"רעננות",render:t=>i`<sw-badge kind=${t.fresh} label=${t.fresh==="live"||t.fresh==="neutral"?"עדכני":t.fresh==="stale"?"מיושן":t.fresh==="offline"?"לא זמין":"לא ידוע"}></sw-badge>`},{key:"placed",label:"במפה",render:t=>t.placed?i`<sw-badge kind="recorded" label="מוצב"></sw-badge>`:i`<span style="color:var(--sw-text-3)">לא</span>`}]}get forbidden(){return w()&&!x("system.configure")}connectedCallback(){super.connectedCallback(),this.q=_().params.get("q")??"",w()&&!this.forbidden&&(this.load(),k().then(t=>this.firstFloorId=S(t)?.id??null).catch(()=>{}),this.stopWs=z(t=>{if(t.type==="entity_state_changed"&&this.cat){const a=this.cat.entities.findIndex(s=>s.entity_id===t.entity.entity_id);if(a>=0){const s=[...this.cat.entities];s[a]={...s[a],...t.entity,placements:s[a].placements,actions:s[a].actions},this.cat={...this.cat,entities:s}}}else t.type==="heartbeat"?this.sync=t.sync:t.type==="ha_sync_state"&&this.sync?this.sync={...this.sync,connected:t.connected}:t.type==="structure_changed"&&this.reloadForStructure()}))}disconnectedCallback(){super.disconnectedCallback(),this.stopWs?.(),this.stopWs=null}reloadForStructure(){this.loading?this.structureAgain=!0:this.load()}async load(){this.loading=!0,this.error="";try{this.cat=await A({domain:this.domain==="all"?void 0:this.domain,q:this.q||void 0,area:this.area||void 0,placed:this.onlyPlaced?!0:void 0,limit:800}),this.sync=this.cat.sync}catch(t){this.error=I(t)}finally{this.loading=!1,this.structureAgain&&(this.structureAgain=!1,this.load())}}onSearch(t){this.q=t,window.clearTimeout(this.searchTimer),this.searchTimer=window.setTimeout(()=>void this.load(),250)}toRow(t){return{id:t.entity_id,name:t.name||t.original_name||t.entity_id,domain:t.domain,area:t.area_name??"—",state:b(t),fresh:g(t),placed:!!t.placements?.length,actions:t.actions?.length?t.actions.map(a=>`${a.label}${a.sensitive?" (רגיש)":""}`).join(" / "):"קריאה בלבד"}}renderApiDrawer(t){const a=g(t),s=Object.entries(t.attributes).filter(([e])=>e!=="friendly_name"&&e!=="icon").slice(0,14);return i`<sw-drawer open heading=${t.name||t.original_name||t.entity_id} subheading=${t.entity_id} @close=${()=>this.selected=null}>
      <dl>
        <dt>מצב</dt><dd><sw-badge kind=${a} label=${b(t)}></sw-badge></dd>
        <dt>Domain</dt><dd><span class="ltr">${t.domain}</span> · ${T(t.domain)}${t.device_class?i` · <span class="ltr">${t.device_class}</span>`:m}</dd>
        <dt>אזור</dt><dd>${t.area_name??"—"}${t.ha_floor_name?` · ${t.ha_floor_name}`:""}</dd>
        <dt>שינוי אחרון</dt><dd>${v(t.last_changed)}</dd>
        <dt>נראה לאחרונה</dt><dd>${v(t.state_seen_at)}${t.fresh?"":" · הסנכרון מנותק"}</dd>
        <dt>אינטגרציה</dt><dd><span class="ltr">${t.platform??"—"}</span></dd>
        <dt>פעולות נתמכות</dt><dd>${t.actions?.length?t.actions.map(e=>`${e.label}${e.sensitive?" (רגיש)":""}`).join(" / "):"קריאה בלבד"}</dd>
        <dt>במפה</dt><dd>${t.placements?.length?i`<span class="chips">${t.placements.map(e=>i`<sw-chip @click=${()=>u(`/explore/floors/${e.floor_id}`)}>${e.floor_name}</sw-chip>`)}</span>`:"לא מוצב"}</dd>
      </dl>
      ${s.length?i`<div class="attrs">${s.map(([e,r])=>i`<span>${e}</span><span>${typeof r=="object"?JSON.stringify(r):String(r)}</span>`)}</div>`:m}
      <div class="note">הקטלוג הוא שיקוף לקריאה בלבד של תשתית המערכת. הפעולות רצות בזהות המשתמש; שליטה מהמפה דורשת הרשאת ha.entity.control.</div>
      <div slot="footer">
        ${t.placements?.length?i`<sw-button variant="primary" icon="map" @click=${()=>u(`/explore/floors/${t.placements[0].floor_id}`)}>הצג במפה</sw-button>`:F("structure")?m:i`<sw-button variant="primary" icon="map" ?disabled=${!this.firstFloorId} title=${this.firstFloorId?"פותח את עורך התוכנית עם הישות מוכנה להצבה":"אין קומות עדיין"} @click=${()=>this.firstFloorId&&u(`/explore/floors/${this.firstFloorId}/edit`,{entity:t.entity_id})}>הצב במפה</sw-button>`}
      </div>
    </sw-drawer>`}renderApi(){const t=this.cat,a=this.sync,s=t?t.entities.map(n=>this.toRow(n)):[],e=t?Object.entries(t.domains).sort((n,h)=>h[1]-n[1]):[],r=t?.entities.find(n=>n.entity_id===this.selected),c=e.reduce((n,[,h])=>n+h,0),p=a?`${c} ישויות בקטלוג · ${a.connected?`סנכרון פעיל · גרסה ${a.ha_version??""}`:`הסנכרון ${E(a.last_error)}`}`:"טוען את הקטלוג…";return i`
      <sw-page crumbs="הגדרות" heading="קטלוג ההתקנים" subheading=${p}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.loading} @click=${()=>this.load()}>רענון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" .value=${this.q} @input=${n=>this.onSearch(n.target.value)} /></sw-field>
          <sw-field><select aria-label="אזור" @change=${n=>{this.area=n.target.value,this.load()}}><option value="">כל האזורים</option>${(t?.areas??[]).map(n=>i`<option value=${n.area_id} ?selected=${n.area_id===this.area}>${n.area_name??n.area_id}</option>`)}</select></sw-field>
          <sw-chip ?selected=${this.onlyPlaced} icon="map" @click=${()=>{this.onlyPlaced=!this.onlyPlaced,this.load()}}>מוצבות בלבד</sw-chip>
        </div>
        <div class="filters">
          <sw-chip ?selected=${this.domain==="all"} count=${c} @click=${()=>{this.domain="all",this.load()}}>הכל</sw-chip>
          ${e.map(([n,h])=>i`<sw-chip ?selected=${n===this.domain} count=${h} @click=${()=>{this.domain=n,this.load()}}><span class="ltr">${n}</span></sw-chip>`)}
        </div>
        <div class="stage">
          ${this.error?i`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`:t?s.length?i`<sw-table .columns=${this.columns} .rows=${s} .selected=${this.selected} @row-select=${n=>this.selected=n.detail.id}></sw-table>`:i`<sw-state-panel icon=${c?"filter":"list"} state="empty" heading=${c?"אין ישויות שתואמות את הסינון":"הקטלוג ריק"} hint=${c?"נקה את החיפוש או בחר domain אחר.":a?.connected?"ההסנכרון פעיל אך טרם התקבלו מצבים.":"לא מחובר לתשתית המערכת. בדוק בהגדרות → כללי."}></sw-state-panel>`:i`<sw-state-panel state="loading"></sw-state-panel>`}
          ${r?this.renderApiDrawer(r):m}
        </div>
      </sw-page>
    `}render(){if(this.forbidden)return i`<sw-page crumbs="הגדרות" heading="קטלוג ההתקנים"><sw-state-panel state="forbidden" data-entities-forbidden></sw-state-panel></sw-page>`;if(w())return this.renderApi();const t=["all",...new Set(f.map(e=>e.domain))],a=f.filter(e=>this.domain==="all"||e.domain===this.domain),s=f.find(e=>e.id===this.selected);return i`
      <sw-page crumbs="הגדרות" heading="קטלוג ההתקנים" subheading="${f.length} ישויות מורשות לחיבור · הצבה על המפה ושליטה הן הרשאות נפרדות · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" /></sw-field>
          ${t.map(e=>i`<sw-chip ?selected=${e===this.domain} @click=${()=>this.domain=e}>${e==="all"?"הכל":e}</sw-chip>`)}
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${a} .selected=${this.selected} @row-select=${e=>this.selected=e.detail.id}></sw-table>
          ${s?i`<sw-drawer open heading=${s.name} subheading=${s.id} @close=${()=>this.selected=null}>
                <dl>
                  <dt>מצב</dt><dd><sw-badge kind=${s.fresh} label=${s.state}></sw-badge></dd>
                  <dt>Domain</dt><dd><span class="ltr">${s.domain}</span></dd>
                  <dt>אזור</dt><dd>${s.area}</dd>
                  <dt>פעולות נתמכות</dt><dd>${s.actions}</dd>
                  <dt>במפה</dt><dd>${s.placed?"קומה 0":"לא מוצב"}</dd>
                </dl>
                <div class="note">ישות מ־domain לא מוכר מקבלת כרטיס כללי לקריאה בלבד. scripts ו־scenes חסומים עד allowlist.</div>
                <div slot="footer">
                  <sw-button variant="primary" icon="map">${s.placed?"הצג במפה":"הצב במפה"}</sw-button>
                  <sw-button variant="ghost">פתח בתשתית המערכת</sw-button>
                </div>
              </sw-drawer>`:""}
        </div>
      </sw-page>
    `}};l.styles=[q`
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
      text-align: left;
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
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
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
  `,P];o([d()],l.prototype,"selected",2);o([d()],l.prototype,"domain",2);o([d()],l.prototype,"q",2);o([d()],l.prototype,"area",2);o([d()],l.prototype,"onlyPlaced",2);o([d()],l.prototype,"cat",2);o([d()],l.prototype,"error",2);o([d()],l.prototype,"loading",2);o([d()],l.prototype,"sync",2);o([d()],l.prototype,"firstFloorId",2);l=o([D("explore-entities")],l);export{l as ExploreEntities,C as domainIcon};
//# sourceMappingURL=explore-entities-CZVbrhgU.js.map
