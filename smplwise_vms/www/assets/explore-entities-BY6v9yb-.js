import{a as $,S as y,e as i,i as w,aV as x,a_ as _,aE as k,bU as S,a7 as z,bM as A,Y as P,bV as g,bP as b,A as m,bQ as T,bW as v,aJ as u,bX as F,C as I,E,G as d,H as q}from"./index-CmpXuSwg.js";import"./sw-table-CeDA6KgX.js";import"./sw-chip-_3Mv8RG5.js";import{s as C}from"./ha-sync-status-9DcgxODD.js";import"./sw-logo-art-Va6y_cIM.js";var D=Object.defineProperty,O=Object.getOwnPropertyDescriptor,o=(e,a,s,t)=>{for(var r=t>1?void 0:t?O(a,s):a,c=e.length-1,p;c>=0;c--)(p=e[c])&&(r=(t?p(a,s,r):p(r))||r);return t&&r&&D(a,s,r),r};const f=[{id:"lock.main_door",name:"דלת כניסה",domain:"lock",area:"לובי",state:"נעול",fresh:"live",placed:!0,actions:"נעילה / פתיחה (grant נפרד)"},{id:"light.lobby",name:"תאורת לובי",domain:"light",area:"לובי",state:"דולק · 80%",fresh:"live",placed:!0,actions:"הדלקה / כיבוי / עמעום"},{id:"binary_sensor.hall_motion",name:"תנועה באולם",domain:"binary_sensor",area:"אולם",state:"ללא תנועה",fresh:"live",placed:!0,actions:"קריאה בלבד"},{id:"climate.hall",name:"מזגן אולם",domain:"climate",area:"אולם",state:"קירור · 23°",fresh:"stale",placed:!1,actions:"יעד טמפרטורה (allowlist)"},{id:"cover.parking_gate",name:"שער חניה",domain:"cover",area:"חניה",state:"סגור",fresh:"live",placed:!1,actions:"פתיחה / סגירה (רגיש)"},{id:"script.night_mode",name:"מצב לילה",domain:"script",area:"—",state:"—",fresh:"unknown",placed:!1,actions:"חסום עד allowlist"},{id:"sensor.power_main",name:"צריכת חשמל",domain:"sensor",area:"חדר מכונות",state:"4.2 kW",fresh:"live",placed:!1,actions:"קריאה בלבד"},{id:"camera.intercom_m2",name:"אינטרקום M2",domain:"camera",area:"כניסה",state:"זמין",fresh:"live",placed:!1,actions:"צפייה (provider נפרד)"}];function j(e){return e==="lock"||e==="cover"?"lock":e==="light"||e==="switch"||e==="fan"?"light":e==="camera"?"camera":e==="climate"||e==="script"||e==="scene"||e==="button"||e==="automation"?"activity":"sensor"}let l=class extends ${constructor(){super(...arguments),this.bubbleSkin=new y(this),this.selected=null,this.domain="all",this.q="",this.area="",this.onlyPlaced=!1,this.cat=null,this.error="",this.loading=!1,this.sync=null,this.firstFloorId=null,this.stopWs=null,this.searchTimer=0,this.structureAgain=!1,this.columns=[{key:"name",label:"ישות",render:e=>i`<span style="display:inline-flex;align-items:center;gap:8px"><span style="display:grid;place-items:center;inline-size:26px;block-size:26px;border-radius:var(--sw-r-xs);background:var(--sw-accent-soft);color:var(--sw-accent)"><sw-icon name=${j(String(e.domain))} size=${13}></sw-icon></span><span><strong>${String(e.name)}</strong><div class="ltr" style="font-size:var(--sw-fs-xs);color:var(--sw-text-3)">${String(e.id)}</div></span></span>`},{key:"domain",label:"Domain",ltr:!0},{key:"area",label:"אזור"},{key:"state",label:"מצב"},{key:"fresh",label:"רעננות",render:e=>i`<sw-badge kind=${e.fresh} label=${e.fresh==="live"||e.fresh==="neutral"?"עדכני":e.fresh==="stale"?"מיושן":e.fresh==="offline"?"לא זמין":"לא ידוע"}></sw-badge>`},{key:"placed",label:"במפה",render:e=>e.placed?i`<sw-badge kind="recorded" label="מוצב"></sw-badge>`:i`<span style="color:var(--sw-text-3)">לא</span>`}]}get forbidden(){return w()&&!x("system.configure")}connectedCallback(){super.connectedCallback(),this.q=_().params.get("q")??"",w()&&!this.forbidden&&(this.load(),k().then(e=>this.firstFloorId=S(e)?.id??null).catch(()=>{}),this.stopWs=z(e=>{if(e.type==="entity_state_changed"&&this.cat){const a=this.cat.entities.findIndex(s=>s.entity_id===e.entity.entity_id);if(a>=0){const s=[...this.cat.entities];s[a]={...s[a],...e.entity,placements:s[a].placements,actions:s[a].actions},this.cat={...this.cat,entities:s}}}else e.type==="heartbeat"?this.sync=e.sync:e.type==="ha_sync_state"&&this.sync?this.sync={...this.sync,connected:e.connected}:e.type==="structure_changed"&&this.reloadForStructure()}))}disconnectedCallback(){super.disconnectedCallback(),this.stopWs?.(),this.stopWs=null}reloadForStructure(){this.loading?this.structureAgain=!0:this.load()}async load(){this.loading=!0,this.error="";try{this.cat=await A({domain:this.domain==="all"?void 0:this.domain,q:this.q||void 0,area:this.area||void 0,placed:this.onlyPlaced?!0:void 0,limit:800}),this.sync=this.cat.sync}catch(e){this.error=P(e)}finally{this.loading=!1,this.structureAgain&&(this.structureAgain=!1,this.load())}}onSearch(e){this.q=e,window.clearTimeout(this.searchTimer),this.searchTimer=window.setTimeout(()=>void this.load(),250)}toRow(e){return{id:e.entity_id,name:e.name||e.original_name||e.entity_id,domain:e.domain,area:e.area_name??"—",state:b(e),fresh:g(e),placed:!!e.placements?.length,actions:e.actions?.length?e.actions.map(a=>`${a.label}${a.sensitive?" (רגיש)":""}`).join(" / "):"קריאה בלבד"}}renderApiDrawer(e){const a=g(e),s=Object.entries(e.attributes).filter(([t])=>t!=="friendly_name"&&t!=="icon").slice(0,14);return i`<sw-drawer open heading=${e.name||e.original_name||e.entity_id} subheading=${e.entity_id} @close=${()=>this.selected=null}>
      <dl>
        <dt>מצב</dt><dd><sw-badge kind=${a} label=${b(e)}></sw-badge></dd>
        <dt>Domain</dt><dd><span class="ltr">${e.domain}</span> · ${T(e.domain)}${e.device_class?i` · <span class="ltr">${e.device_class}</span>`:m}</dd>
        <dt>אזור</dt><dd>${e.area_name??"—"}${e.ha_floor_name?` · ${e.ha_floor_name}`:""}</dd>
        <dt>שינוי אחרון</dt><dd>${v(e.last_changed)}</dd>
        <dt>נראה לאחרונה</dt><dd>${v(e.state_seen_at)}${e.fresh?"":" · הסנכרון מנותק"}</dd>
        <dt>אינטגרציה</dt><dd><span class="ltr">${e.platform??"—"}</span></dd>
        <dt>פעולות נתמכות</dt><dd>${e.actions?.length?e.actions.map(t=>`${t.label}${t.sensitive?" (רגיש)":""}`).join(" / "):"קריאה בלבד"}</dd>
        <dt>במפה</dt><dd>${e.placements?.length?i`<span class="chips">${e.placements.map(t=>i`<sw-chip @click=${()=>u(`/explore/floors/${t.floor_id}`)}>${t.floor_name}</sw-chip>`)}</span>`:"לא מוצב"}</dd>
      </dl>
      ${s.length?i`<div class="attrs">${s.map(([t,r])=>i`<span>${t}</span><span>${typeof r=="object"?JSON.stringify(r):String(r)}</span>`)}</div>`:m}
      <div class="note">הקטלוג הוא שיקוף לקריאה בלבד של תשתית המערכת. הפעולות רצות בזהות המשתמש; שליטה מהמפה דורשת הרשאת ha.entity.control.</div>
      <div slot="footer">
        ${e.placements?.length?i`<sw-button variant="primary" icon="map" @click=${()=>u(`/explore/floors/${e.placements[0].floor_id}`)}>הצג במפה</sw-button>`:F("structure")?m:i`<sw-button variant="primary" icon="map" ?disabled=${!this.firstFloorId} title=${this.firstFloorId?"פותח את עורך התוכנית עם הישות מוכנה להצבה":"אין קומות עדיין"} @click=${()=>this.firstFloorId&&u(`/explore/floors/${this.firstFloorId}/edit`,{entity:e.entity_id})}>הצב במפה</sw-button>`}
      </div>
    </sw-drawer>`}renderApi(){const e=this.cat,a=this.sync,s=e?e.entities.map(n=>this.toRow(n)):[],t=e?Object.entries(e.domains).sort((n,h)=>h[1]-n[1]):[],r=e?.entities.find(n=>n.entity_id===this.selected),c=t.reduce((n,[,h])=>n+h,0),p=a?`${c} ישויות בקטלוג · ${a.connected?`סנכרון פעיל · גרסה ${a.ha_version??""}`:`הסנכרון ${C(a.last_error)}`}`:"טוען את הקטלוג…";return i`
      <sw-page crumbs="הגדרות" heading="קטלוג ההתקנים" subheading=${p}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.loading} @click=${()=>this.load()}>רענון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" .value=${this.q} @input=${n=>this.onSearch(n.target.value)} /></sw-field>
          <sw-field><select aria-label="אזור" @change=${n=>{this.area=n.target.value,this.load()}}><option value="">כל האזורים</option>${(e?.areas??[]).map(n=>i`<option value=${n.area_id} ?selected=${n.area_id===this.area}>${n.area_name??n.area_id}</option>`)}</select></sw-field>
          <sw-chip ?selected=${this.onlyPlaced} icon="map" @click=${()=>{this.onlyPlaced=!this.onlyPlaced,this.load()}}>מוצבות בלבד</sw-chip>
        </div>
        <div class="filters">
          <sw-chip ?selected=${this.domain==="all"} count=${c} @click=${()=>{this.domain="all",this.load()}}>הכל</sw-chip>
          ${t.map(([n,h])=>i`<sw-chip ?selected=${n===this.domain} count=${h} @click=${()=>{this.domain=n,this.load()}}><span class="ltr">${n}</span></sw-chip>`)}
        </div>
        <div class="stage">
          ${this.error?i`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`:e?s.length?i`<sw-table .columns=${this.columns} .rows=${s} .selected=${this.selected} @row-select=${n=>this.selected=n.detail.id}></sw-table>`:i`<sw-state-panel icon=${c?"filter":"list"} state="empty" heading=${c?"אין ישויות שתואמות את הסינון":"הקטלוג ריק"} hint=${c?"נקה את החיפוש או בחר domain אחר.":a?.connected?"ההסנכרון פעיל אך טרם התקבלו מצבים.":"לא מחובר לתשתית המערכת. בדוק בהגדרות → כללי."}></sw-state-panel>`:i`<sw-state-panel state="loading"></sw-state-panel>`}
          ${r?this.renderApiDrawer(r):m}
        </div>
      </sw-page>
    `}render(){if(this.forbidden)return i`<sw-page crumbs="הגדרות" heading="קטלוג ההתקנים"><sw-state-panel state="forbidden" data-entities-forbidden></sw-state-panel></sw-page>`;if(w())return this.renderApi();const e=["all",...new Set(f.map(t=>t.domain))],a=f.filter(t=>this.domain==="all"||t.domain===this.domain),s=f.find(t=>t.id===this.selected);return i`
      <sw-page crumbs="הגדרות" heading="קטלוג ההתקנים" subheading="${f.length} ישויות מורשות לחיבור · הצבה על המפה ושליטה הן הרשאות נפרדות · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">סנכרון</sw-button>
        <div class="filters">
          <sw-field class="search"><input type="search" placeholder="חיפוש לפי שם, entity_id או אזור" /></sw-field>
          ${e.map(t=>i`<sw-chip ?selected=${t===this.domain} @click=${()=>this.domain=t}>${t==="all"?"הכל":t}</sw-chip>`)}
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${a} .selected=${this.selected} @row-select=${t=>this.selected=t.detail.id}></sw-table>
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
    `}};l.styles=[E`
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
  `,I];o([d()],l.prototype,"selected",2);o([d()],l.prototype,"domain",2);o([d()],l.prototype,"q",2);o([d()],l.prototype,"area",2);o([d()],l.prototype,"onlyPlaced",2);o([d()],l.prototype,"cat",2);o([d()],l.prototype,"error",2);o([d()],l.prototype,"loading",2);o([d()],l.prototype,"sync",2);o([d()],l.prototype,"firstFloorId",2);l=o([q("explore-entities")],l);export{l as ExploreEntities,j as domainIcon};
//# sourceMappingURL=explore-entities-BY6v9yb-.js.map
