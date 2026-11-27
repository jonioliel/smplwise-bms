const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as b}from"./sw-logo-art-PLtEZJxU.js";import{j as C,z as f,k as p,a as R,hT as P,hU as T,q as H,A as u,av as t,b as r,hV as D,hW as I,aj as $,aE as j,m as B,af as v,bg as E,cb as A,cc as V,F as q,bw as M}from"./index-bjkrEUAJ.js";var U=Object.defineProperty,W=Object.getOwnPropertyDescriptor,m=(e,s,a,l)=>{for(var h=l>1?void 0:l?W(s,a):s,n=e.length-1,i;n>=0;n--)(i=e[n])&&(h=(l?i(s,a,h):i(h))||h);return l&&h&&U(s,a,h),h};let F=null;const K={manual:"homeLinkSrcManual",link:"homeLinkSrcLink",map:"homeLinkSrcMap",level:"homeLinkSrcLevel",name:"homeLinkSrcName"};let c=class extends R{constructor(){super(...arguments),this.floors=[],this.floorNames=new Map,this.tree=null,this.links=null,this.singleBuilding=!0,this.demo=!1,this.haFloors=[],this.modes={},this.busy=!1,this.error="",this.view=F,this.seeded=""}willUpdate(){this.floor&&this.seeded!==this.floor.id&&(this.seeded=this.floor.id,this.haFloors=this.savedHaFloors(),this.modes={})}savedHaFloors(){return(this.links?.floors??[]).filter(e=>e.floor_id===this.floor.id).map(e=>e.ha_floor_id)}draft(e=this.modes,s=this.haFloors){const a=this.floor.id,l=(this.links?.floors??[]).filter(n=>n.floor_id!==a&&!s.includes(n.ha_floor_id));for(const n of s)l.push({ha_floor_id:n,floor_id:a});const h=new Map((this.links?.areas??[]).map(n=>[n.area_id,n.floor_id]));for(const[n,i]of Object.entries(e))i==="auto"?h.delete(n):h.set(n,i==="include"?a:null);return{floors:l,areas:[...h.entries()].map(([n,i])=>({area_id:n,floor_id:i}))}}matchAll(e=this.modes,s=this.haFloors){return P(this.floors,this.tree,{links:this.draft(e,s),singleBuilding:this.singleBuilding})}dropArea(e){const s={...this.modes,[e]:"auto"},a=this.matchAll(s).get(this.floor.id).areas.some(l=>l.area.area_id===e);this.modes=a?{...this.modes,[e]:"exclude"}:s}reset(){const e={};for(const s of this.links?.areas??[])s.floor_id===this.floor.id&&(e[s.area_id]="auto");for(const s of this.matchAll().get(this.floor.id).excluded)e[s.area.area_id]="auto";this.haFloors=[],this.modes=e}async save(){this.busy=!0,this.error="";try{const e=await T(this.floor.id,{ha_floor_ids:this.haFloors,areas:this.modes});this.dispatchEvent(new CustomEvent("saved",{detail:{links:e},bubbles:!0,composed:!0}))}catch(e){this.error=H(e)}finally{this.busy=!1}}connectedCallback(){super.connectedCallback(),!this.view&&b(()=>import("./sw-xsection-DtBEBdBm.js"),__vite__mapDeps([0]),import.meta.url).then(e=>{F=e,this.view=e},e=>console.warn("cross-section chunk failed to load",e))}render(){const e=this.view;if(!e)return u;const s=this.floor,a=this.tree,l=()=>this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}));if(!a)return r`<sw-dialog open heading=${t("homeLinkTitle")} subheading=${t("homeLinkSub",{name:s.name})} data-home-link>
        <div class="none">${t("homeLinkNoTree")}</div>
        <sw-button slot="footer" variant="ghost" @click=${l}>${t("homeLinkCancel")}</sw-button>
      </sw-dialog>`;const h=this.draft(),n=this.matchAll(),i=n.get(s.id),_=D(a),z=new Map(_.map(o=>[o.floor_id,o.name])),L=new Map(h.floors.map(o=>[o.ha_floor_id,o.floor_id])),y=o=>o?this.floorNames.get(o)??this.floors.find(d=>d.id===o)?.name??o:t("homeLinkUnassigned"),g=new Map;for(const o of this.floors)if(o.id!==s.id)for(const d of n.get(o.id)?.areas??[])g.set(d.area.area_id,o.name);const O=new Set(i.areas.map(o=>o.area.area_id)),k=new Map;for(const o of I(a)){if(O.has(o.area.area_id)||o.area.map?.floor_id)continue;const d=o.haFloorId?z.get(o.haFloorId)??o.haFloorId:t("homeLinkNoFloor");k.set(d,[...k.get(d)??[],o])}const x=e.matchLine(i),S=Object.keys(this.modes).length>0||JSON.stringify([...this.haFloors].sort())!==JSON.stringify(this.savedHaFloors().sort()),N=this.haFloors.length>0||h.areas.some(o=>o.floor_id===s.id)||i.excluded.length>0;return r`<sw-dialog open heading=${t("homeLinkTitle")} subheading=${t("homeLinkSub",{name:s.name})} data-home-link>
      <div class="sec first">
        <h3>${t("homeLinkFloors",{n:i.haFloors.length})}</h3>
        ${i.haFloors.length?r`<ul data-home-floors>${i.haFloors.map(o=>r`<li data-home-floor=${o.id}>
              <span class="n" dir="auto">${$(o.name)}</span>
              <span class="tag" data-src=${i.how??""}>${i.how==="link"?t("matchLink"):`${t("homeLinkSrcAuto")} · ${t(e.HOW_KEY[i.how??"level"])}`}</span>
              ${i.how==="link"?r`<sw-button size="sm" variant="ghost" icon="close" data-home-floor-remove=${o.id} @click=${()=>this.haFloors=this.haFloors.filter(d=>d!==o.id)}>${t("homeLinkRemove")}</sw-button>`:r`<span></span>`}
            </li>`)}</ul>`:r`<div class="none">${t("homeLinkFloorsNone")}</div>`}
        ${i.suggestion?r`<div class="sug" data-home-suggest><span>${t("homeLinkSuggest",{floor:i.suggestion.haFloorName,how:t(e.HOW_KEY[i.suggestion.why])})}</span>
              <sw-button size="sm" variant="primary" data-home-confirm @click=${()=>this.haFloors=[...this.haFloors,i.suggestion.haFloorId]}>${t("homeLinkConfirm")}</sw-button></div>`:u}
        <sw-field label=${t("homeLinkAddFloor")} hint=${t("homeLinkAutoHint")}>
          <select data-home-floor-add @change=${o=>{const d=o.target;d.value&&!this.haFloors.includes(d.value)&&(this.haFloors=[...this.haFloors,d.value]),d.value=""}}>
            <option value="" selected>${t("homeLinkAddFloorPick")}</option>
            ${_.filter(o=>!this.haFloors.includes(o.floor_id)).map(o=>r`<option value=${o.floor_id}>${o.name}${o.level!==null?` · ${t("level",{n:j(o.level)})}`:""}${L.has(o.floor_id)?` ${t("homeLinkElsewhere",{floor:y(L.get(o.floor_id))})}`:""}</option>`)}
          </select>
        </sw-field>
      </div>
      ${x?r`<div class="now" data-home-now>${x.text}</div>`:u}
      <div class="sec">
        <h3>${t("homeLinkAreas",{n:i.areas.length})}</h3>
        ${i.areas.length?r`<ul data-home-areas>${i.areas.map(o=>r`<li data-home-area=${o.area.area_id}>
              <span class="n" dir="auto" title=${o.area.name}>${$(o.area.name)}</span>
              <span class="tag" data-src=${o.source}>${t(K[o.source])}</span>
              ${o.source==="map"?r`<span class="w" title=${t("homeLinkMapNote")}>${t("homeLinkSrcMap")}</span>`:r`<sw-button size="sm" variant="ghost" icon="close" data-home-remove=${o.area.area_id} @click=${()=>this.dropArea(o.area.area_id)}>${t("homeLinkRemove")}</sw-button>`}
            </li>`)}</ul>`:r`<div class="none">${t("homeLinkAreasNone")}</div>`}
      </div>
      ${i.excluded.length||i.missing.length?r`<div class="sec">
            <h3>${t("homeLinkExcluded")}</h3>
            <ul>
              ${i.excluded.map(o=>r`<li class="off" data-home-excluded=${o.area.area_id}><span class="n" dir="auto">${$(o.area.name)}</span>
                <span class="w">${o.to?t("homeLinkMovedTo",{floor:y(o.to)}):t("homeLinkUnassigned")}</span>
                <sw-button size="sm" variant="ghost" data-home-restore=${o.area.area_id} @click=${()=>this.modes={...this.modes,[o.area.area_id]:"auto"}}>${t("homeLinkRestore")}</sw-button></li>`)}
              ${i.missing.map(o=>r`<li class="off" data-home-missing=${o}><span class="n">${t("homeLinkMissing",{id:o})}</span><span></span>
                <sw-button size="sm" variant="ghost" @click=${()=>{this.haFloors=this.haFloors.filter(d=>d!==o),this.modes={...this.modes,[o]:"auto"}}}>${t("homeLinkRemove")}</sw-button></li>`)}
            </ul>
          </div>`:u}
      <div class="sec">
        <sw-field label=${t("homeLinkAdd")}>
          <select data-home-add @change=${o=>{const d=o.target;d.value&&(this.modes={...this.modes,[d.value]:"include"}),d.value=""}}>
            <option value="" selected>${t("homeLinkAddPick")}</option>
            ${[...k.entries()].map(([o,d])=>r`<optgroup label=${o}>${d.map(w=>r`<option value=${w.area.area_id}>${w.area.name}${g.has(w.area.area_id)?` ${t("homeLinkElsewhere",{floor:g.get(w.area.area_id)})}`:""}</option>`)}</optgroup>`)}
          </select>
        </sw-field>
      </div>
      ${this.error?r`<div class="err">${this.error}</div>`:u}
      ${this.demo?r`<div class="note">${t("homeLinkDemo")}</div>`:u}
      ${N?r`<sw-button slot="footer" variant="ghost" data-home-reset @click=${()=>this.reset()}>${t("homeLinkReset")}</sw-button>`:u}
      <sw-button slot="footer" variant="ghost" @click=${l}>${t("homeLinkCancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-home-save ?disabled=${this.busy||this.demo||!S} @click=${()=>this.save()}>${t("homeLinkSave")}</sw-button>
    </sw-dialog>`}};c.styles=C`
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
  `;m([f({attribute:!1})],c.prototype,"floor",2);m([f({attribute:!1})],c.prototype,"floors",2);m([f({attribute:!1})],c.prototype,"floorNames",2);m([f({attribute:!1})],c.prototype,"tree",2);m([f({attribute:!1})],c.prototype,"links",2);m([f({type:Boolean})],c.prototype,"singleBuilding",2);m([f({type:Boolean})],c.prototype,"demo",2);m([p()],c.prototype,"haFloors",2);m([p()],c.prototype,"modes",2);m([p()],c.prototype,"busy",2);m([p()],c.prototype,"error",2);m([p()],c.prototype,"view",2);c=m([B("sw-floor-home-link")],c);const J=["required","skip"];function Q(e,s){return(e??[]).filter(a=>a.id!==s)}function X(e,s){if(!e)return{canMove:!1,needsAck:!1};const a=e.people.loses>0;return{canMove:e.can_move&&e.blockers.length===0&&(!a||s),needsAck:a}}function Z(e,s,a=6){const l=e.people.items.filter(i=>i.change===s),h=s==="loses"?e.people.loses:s==="gains"?e.people.gains:e.people.changes,n=l.slice(0,a);return{shown:n,more:Math.max(0,h-n.length)}}function ee(e){const s=e.moves_with.records;return s.tickets+s.ticket_rfqs+s.maint_tasks+s.notices+s.incidents}function oe(e,s){if(!e)return{canEnable:!1,blocked:!1};const a=e.blocking>0;return{canEnable:!a&&s,blocked:a}}const se=e=>e!=="skip";function te(e){const s={blocking:0,warning:1,info:2};return e.findings.map((a,l)=>({f:a,i:l})).sort((a,l)=>s[a.f.severity]-s[l.f.severity]||a.i-l.i).map(a=>a.f)}async function ae(e,s,a){return v()?E(A`floors/${e}/move-preview`+V({building:s})):(await b(async()=>{const{demoPreview:l}=await import("./mb-safety-demo-DzKk6NUa.js");return{demoPreview:l}},[],import.meta.url)).demoPreview(e,s,a)}async function ie(e,s,a){if(!v())throw new Error("demo");return q(A`floors/${e}/move`,{building_id:s,preview_digest:a})}async function re(){return v()?E("home/multi-building/check"):(await b(async()=>{const{demoCheck:e}=await import("./mb-safety-demo-DzKk6NUa.js");return{demoCheck:e}},[],import.meta.url)).demoCheck()}async function ne(e){return v()?M("home/multi-building/review",{mode:e}):{mode:e}}const le=["on","off"];async function de(e){return v()?M("home/multi-building/filter",{mode:e}):{mode:e}}export{le as F,J as R,X as a,ie as b,Z as c,oe as d,ne as e,re as l,Q as m,se as n,te as o,ae as p,ee as r,de as s};
