const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as S}from"./sw-logo-art-PLtEZJxU.js";import{g as N,ax as f,j as u,i as E,cd as M,ce as O,n as C,A as p,ai as o,b as i,cf as H,cg as P,a6 as $,ar as R,k as B}from"./index-Cwrvr-7C.js";var j=Object.defineProperty,I=Object.getOwnPropertyDescriptor,c=(s,t,h,m)=>{for(var d=m>1?void 0:m?I(t,h):t,n=s.length-1,a;n>=0;n--)(a=s[n])&&(d=(m?a(t,h,d):a(d))||d);return m&&d&&j(t,h,d),d};let x=null;const T={manual:"homeLinkSrcManual",link:"homeLinkSrcLink",map:"homeLinkSrcMap",level:"homeLinkSrcLevel",name:"homeLinkSrcName"};let l=class extends E{constructor(){super(...arguments),this.floors=[],this.floorNames=new Map,this.tree=null,this.links=null,this.singleBuilding=!0,this.demo=!1,this.haFloors=[],this.modes={},this.busy=!1,this.error="",this.view=x,this.seeded=""}willUpdate(){this.floor&&this.seeded!==this.floor.id&&(this.seeded=this.floor.id,this.haFloors=this.savedHaFloors(),this.modes={})}savedHaFloors(){return(this.links?.floors??[]).filter(s=>s.floor_id===this.floor.id).map(s=>s.ha_floor_id)}draft(s=this.modes,t=this.haFloors){const h=this.floor.id,m=(this.links?.floors??[]).filter(n=>n.floor_id!==h&&!t.includes(n.ha_floor_id));for(const n of t)m.push({ha_floor_id:n,floor_id:h});const d=new Map((this.links?.areas??[]).map(n=>[n.area_id,n.floor_id]));for(const[n,a]of Object.entries(s))a==="auto"?d.delete(n):d.set(n,a==="include"?h:null);return{floors:m,areas:[...d.entries()].map(([n,a])=>({area_id:n,floor_id:a}))}}matchAll(s=this.modes,t=this.haFloors){return M(this.floors,this.tree,{links:this.draft(s,t),singleBuilding:this.singleBuilding})}dropArea(s){const t={...this.modes,[s]:"auto"},h=this.matchAll(t).get(this.floor.id).areas.some(m=>m.area.area_id===s);this.modes=h?{...this.modes,[s]:"exclude"}:t}reset(){const s={};for(const t of this.links?.areas??[])t.floor_id===this.floor.id&&(s[t.area_id]="auto");for(const t of this.matchAll().get(this.floor.id).excluded)s[t.area.area_id]="auto";this.haFloors=[],this.modes=s}async save(){this.busy=!0,this.error="";try{const s=await O(this.floor.id,{ha_floor_ids:this.haFloors,areas:this.modes});this.dispatchEvent(new CustomEvent("saved",{detail:{links:s},bubbles:!0,composed:!0}))}catch(s){this.error=C(s)}finally{this.busy=!1}}connectedCallback(){super.connectedCallback(),!this.view&&S(()=>import("./sw-xsection-DTnn1zN8.js"),__vite__mapDeps([0]),import.meta.url).then(s=>{x=s,this.view=s},s=>console.warn("cross-section chunk failed to load",s))}render(){const s=this.view;if(!s)return p;const t=this.floor,h=this.tree,m=()=>this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}));if(!h)return i`<sw-dialog open heading=${o("homeLinkTitle")} subheading=${o("homeLinkSub",{name:t.name})} data-home-link>
        <div class="none">${o("homeLinkNoTree")}</div>
        <sw-button slot="footer" variant="ghost" @click=${m}>${o("homeLinkCancel")}</sw-button>
      </sw-dialog>`;const d=this.draft(),n=this.matchAll(),a=n.get(t.id),k=H(h),y=new Map(k.map(e=>[e.floor_id,e.name])),b=new Map(d.floors.map(e=>[e.ha_floor_id,e.floor_id])),_=e=>e?this.floorNames.get(e)??this.floors.find(r=>r.id===e)?.name??e:o("homeLinkUnassigned"),g=new Map;for(const e of this.floors)if(e.id!==t.id)for(const r of n.get(e.id)?.areas??[])g.set(r.area.area_id,e.name);const F=new Set(a.areas.map(e=>e.area.area_id)),w=new Map;for(const e of P(h)){if(F.has(e.area.area_id)||e.area.map?.floor_id)continue;const r=e.haFloorId?y.get(e.haFloorId)??e.haFloorId:o("homeLinkNoFloor");w.set(r,[...w.get(r)??[],e])}const L=s.matchLine(a),A=Object.keys(this.modes).length>0||JSON.stringify([...this.haFloors].sort())!==JSON.stringify(this.savedHaFloors().sort()),z=this.haFloors.length>0||d.areas.some(e=>e.floor_id===t.id)||a.excluded.length>0;return i`<sw-dialog open heading=${o("homeLinkTitle")} subheading=${o("homeLinkSub",{name:t.name})} data-home-link>
      <div class="sec first">
        <h3>${o("homeLinkFloors",{n:a.haFloors.length})}</h3>
        ${a.haFloors.length?i`<ul data-home-floors>${a.haFloors.map(e=>i`<li data-home-floor=${e.id}>
              <span class="n" dir="auto">${$(e.name)}</span>
              <span class="tag" data-src=${a.how??""}>${a.how==="link"?o("matchLink"):`${o("homeLinkSrcAuto")} · ${o(s.HOW_KEY[a.how??"level"])}`}</span>
              ${a.how==="link"?i`<sw-button size="sm" variant="ghost" icon="close" data-home-floor-remove=${e.id} @click=${()=>this.haFloors=this.haFloors.filter(r=>r!==e.id)}>${o("homeLinkRemove")}</sw-button>`:i`<span></span>`}
            </li>`)}</ul>`:i`<div class="none">${o("homeLinkFloorsNone")}</div>`}
        ${a.suggestion?i`<div class="sug" data-home-suggest><span>${o("homeLinkSuggest",{floor:a.suggestion.haFloorName,how:o(s.HOW_KEY[a.suggestion.why])})}</span>
              <sw-button size="sm" variant="primary" data-home-confirm @click=${()=>this.haFloors=[...this.haFloors,a.suggestion.haFloorId]}>${o("homeLinkConfirm")}</sw-button></div>`:p}
        <sw-field label=${o("homeLinkAddFloor")} hint=${o("homeLinkAutoHint")}>
          <select data-home-floor-add @change=${e=>{const r=e.target;r.value&&!this.haFloors.includes(r.value)&&(this.haFloors=[...this.haFloors,r.value]),r.value=""}}>
            <option value="" selected>${o("homeLinkAddFloorPick")}</option>
            ${k.filter(e=>!this.haFloors.includes(e.floor_id)).map(e=>i`<option value=${e.floor_id}>${e.name}${e.level!==null?` · ${o("level",{n:R(e.level)})}`:""}${b.has(e.floor_id)?` ${o("homeLinkElsewhere",{floor:_(b.get(e.floor_id))})}`:""}</option>`)}
          </select>
        </sw-field>
      </div>
      ${L?i`<div class="now" data-home-now>${L.text}</div>`:p}
      <div class="sec">
        <h3>${o("homeLinkAreas",{n:a.areas.length})}</h3>
        ${a.areas.length?i`<ul data-home-areas>${a.areas.map(e=>i`<li data-home-area=${e.area.area_id}>
              <span class="n" dir="auto" title=${e.area.name}>${$(e.area.name)}</span>
              <span class="tag" data-src=${e.source}>${o(T[e.source])}</span>
              ${e.source==="map"?i`<span class="w" title=${o("homeLinkMapNote")}>${o("homeLinkSrcMap")}</span>`:i`<sw-button size="sm" variant="ghost" icon="close" data-home-remove=${e.area.area_id} @click=${()=>this.dropArea(e.area.area_id)}>${o("homeLinkRemove")}</sw-button>`}
            </li>`)}</ul>`:i`<div class="none">${o("homeLinkAreasNone")}</div>`}
      </div>
      ${a.excluded.length||a.missing.length?i`<div class="sec">
            <h3>${o("homeLinkExcluded")}</h3>
            <ul>
              ${a.excluded.map(e=>i`<li class="off" data-home-excluded=${e.area.area_id}><span class="n" dir="auto">${$(e.area.name)}</span>
                <span class="w">${e.to?o("homeLinkMovedTo",{floor:_(e.to)}):o("homeLinkUnassigned")}</span>
                <sw-button size="sm" variant="ghost" data-home-restore=${e.area.area_id} @click=${()=>this.modes={...this.modes,[e.area.area_id]:"auto"}}>${o("homeLinkRestore")}</sw-button></li>`)}
              ${a.missing.map(e=>i`<li class="off" data-home-missing=${e}><span class="n">${o("homeLinkMissing",{id:e})}</span><span></span>
                <sw-button size="sm" variant="ghost" @click=${()=>{this.haFloors=this.haFloors.filter(r=>r!==e),this.modes={...this.modes,[e]:"auto"}}}>${o("homeLinkRemove")}</sw-button></li>`)}
            </ul>
          </div>`:p}
      <div class="sec">
        <sw-field label=${o("homeLinkAdd")}>
          <select data-home-add @change=${e=>{const r=e.target;r.value&&(this.modes={...this.modes,[r.value]:"include"}),r.value=""}}>
            <option value="" selected>${o("homeLinkAddPick")}</option>
            ${[...w.entries()].map(([e,r])=>i`<optgroup label=${e}>${r.map(v=>i`<option value=${v.area.area_id}>${v.area.name}${g.has(v.area.area_id)?` ${o("homeLinkElsewhere",{floor:g.get(v.area.area_id)})}`:""}</option>`)}</optgroup>`)}
          </select>
        </sw-field>
      </div>
      ${this.error?i`<div class="err">${this.error}</div>`:p}
      ${this.demo?i`<div class="note">${o("homeLinkDemo")}</div>`:p}
      ${z?i`<sw-button slot="footer" variant="ghost" data-home-reset @click=${()=>this.reset()}>${o("homeLinkReset")}</sw-button>`:p}
      <sw-button slot="footer" variant="ghost" @click=${m}>${o("homeLinkCancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-home-save ?disabled=${this.busy||this.demo||!A} @click=${()=>this.save()}>${o("homeLinkSave")}</sw-button>
    </sw-dialog>`}};l.styles=N`
    :host { display: contents; }
    .sec { display: grid; gap: 8px; margin-block-start: 14px; }
    .sec.first { margin-block-start: 0; }
    h3 { margin: 0; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-block-size: 40px; padding: 0 6px 0 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); }
    li .n { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sw-heading); font-weight: var(--sw-fw-medium); }
    li.off .n { color: var(--sw-text-3); }
    li .w { color: var(--sw-text-3); font-size: 12px; white-space: nowrap; }
    .tag { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; background: var(--sw-surface); color: var(--sw-text-2); box-shadow: inset 0 0 0 1px var(--sw-border); white-space: nowrap; }
    .tag[data-src='manual'], .tag[data-src='link'] { background: var(--sw-accent-soft); color: var(--sw-accent-text, var(--sw-accent)); box-shadow: none; }
    .none, .now { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .none { color: var(--sw-text-3); }
    .sug { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border-radius: var(--sw-r-md); background: var(--sw-accent-soft); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .sug span { flex: 1 1 200px; min-inline-size: 0; }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-xs); margin-block-start: 10px; }
    .note { color: var(--sw-text-3); font-size: var(--sw-fs-xs); margin-block-start: 10px; }
    select { inline-size: 100%; }
  `;c([f({attribute:!1})],l.prototype,"floor",2);c([f({attribute:!1})],l.prototype,"floors",2);c([f({attribute:!1})],l.prototype,"floorNames",2);c([f({attribute:!1})],l.prototype,"tree",2);c([f({attribute:!1})],l.prototype,"links",2);c([f({type:Boolean})],l.prototype,"singleBuilding",2);c([f({type:Boolean})],l.prototype,"demo",2);c([u()],l.prototype,"haFloors",2);c([u()],l.prototype,"modes",2);c([u()],l.prototype,"busy",2);c([u()],l.prototype,"error",2);c([u()],l.prototype,"view",2);l=c([B("sw-floor-home-link")],l);
