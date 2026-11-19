import{i as K,P as Z,a3 as v,a4 as T,a5 as H,A as u,U as t,a6 as L,a7 as I,b as r,a8 as ss,a9 as es,aa as E,Q as ts,ab as D,ac as R,ad as C,ae as is,af as os,ag as as,ah as A,Y as z,ai as rs,aj as y,ak as ns,al as ls,am as j,an as ds,ao as cs,ap as hs,aq as ps,ar as us,as as fs,at as ms,R as gs,n as q,a as ws,X as bs,au as vs,av as $s,aw as xs,ax as ks,g as ys,ay as _s,j as g,k as zs}from"./index-DJHEuoub.js";import{o as U}from"./architect-request-dialog-BG4sacJx.js";import"./sw-floor-iso-DdhrGr3F.js";import{g as Ds}from"./geometry-Dt4Eeb6r.js";import{k as Os,b as Fs,i as Ls,a as Is}from"./scene-builder-Cu5ORt4x.js";import{f as X}from"./connector-targets-ClcWoNdA.js";import{f as Bs,D as Ns}from"./shared-space-CKuDIAAl.js";import{xsTile as Ps,xsTileStyles as Es}from"./sw-xsection-DNtVcSEq.js";import"./sw-floor-home-link-i5zSjajH.js";import"./devices-tiles-panel-D2poobjm.js";import"./sw-logo-art-MaHPMZFI.js";import"./material-resolve-D0nDdkyx.js";import"./map-BSAdvTQ5.js";import"./zones-e9UW_q16.js";import"./door-path-logic-CX6MWF5O.js";var Ms=Object.defineProperty,Ss=Object.getOwnPropertyDescriptor,f=(s,e,i,a)=>{for(var l=a>1?void 0:a?Ss(e,i):e,h=s.length-1,c;h>=0;h--)(c=s[h])&&(l=(a?c(e,i,l):c(l))||l);return a&&l&&Ms(e,i,l),l};let p=class extends K{constructor(){super(...arguments),this.phone=new Z(this),this.buildingId="bld-a",this.tree=null,this.selected=null,this.tab="floors",this.dialog=null,this.busy=!1,this.error="",this.formName="",this.formLevel=0,this.isos=new Map,this.isoPending=new Set,this.xsData=null,this.sheetOpen=!1,this.hoverId=null,this.lightsOf=null,this.multiOn=!1,this.linkDocs=new Map,this.rowBoxes=null,this.boxesHeight=0,this.cardsEl=null,this.homeRouteDone="",this.lightsAllowed=s=>s.nodata||s.lights===null?!1:!v()||this.xsData?.demo?!0:T("devices.read")&&H(s)!==null}pruned(){const s=(this.tree?.sites??[]).flatMap(e=>(e.buildings??[]).flatMap(i=>(i.floors??[]).map(a=>a.published_version_id))).filter(e=>!!e);return Os(this.isos,s)}isoFor(s){const e=s.published_version_id;return!e||this.tree?.source!=="api"?null:this.isos.has(e)?this.isos.get(e)??null:(this.isoPending.has(e)||(this.isoPending.add(e),Ds(e).then(i=>{const a=Fs({doc:i.doc,width:s.plan_width_px||i.doc.dimensions.width_px,height:s.plan_height_px||i.doc.dimensions.height_px,anchors:[],entityStates:{},circuitStates:{},layers:{objects:!1,cameras:!1,entities:!1,zones:!1}});this.isos=this.pruned().set(e,a.parts.some(l=>l.kind==="wall")?Ls(a):null),this.linkDocs=new Map(this.linkDocs).set(e,{floorId:s.id,connectors:i.doc.connectors,levels:i.doc.levels,floorHeightM:Bs(i.doc)})}).catch(()=>{this.isos=this.pruned().set(e,null)}).finally(()=>this.isoPending.delete(e))),null)}renderLinks(s){const e=s.map(o=>o.published_version_id?this.linkDocs.get(o.published_version_id):void 0).filter(o=>!!o),i=X(e,s.map(o=>({id:o.id,name:o.name})));if(!i.length)return u;const a=[...s].sort((o,m)=>o.level-m.level||o.sort_order-m.sort_order),l=34/3,h=o=>(o.published_version_id?this.linkDocs.get(o.published_version_id)?.floorHeightM:void 0)??Ns,c=new Map;let d=0;for(const o of a)c.set(o.id,d),d+=h(o)*l;const $=a.length?c.get(a[a.length-1].id):0,x=o=>$-(c.get(o)??0),b=(o,m)=>{const w=Is(m[0],m[1]);return{x:w.x,y:w.y+x(o)}},k=o=>[[0,0],[1,0],[1,1],[0,1]].map(([m,w])=>b(o,[m,w])).map(m=>`${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(" "),_=72+$;return r`<sw-card heading=${t("קשרים בין קומות")} subheading=${t("מדרגות ומעליות שמקשרות קומות (מבנה מפורסם)")} data-floor-links>
      <div class="links">
        <svg class="stack" viewBox=${`0 0 120 ${_}`} aria-hidden="true">
          ${a.map(o=>L`<g data-stack-floor=${o.id}><polygon class="plate" points=${k(o.id)} /><text class="pname" x="2" y=${(x(o.id)+38).toFixed(1)}>${o.name}</text></g>`)}
          ${i.map(o=>{const m=b(o.a.floorId,o.a.at),w=o.b?b(o.b.floorId,o.b.at):null;return L`<g data-stack-link=${o.id}>
              ${w?L`<line class="lk" x1=${m.x} y1=${m.y} x2=${w.x} y2=${w.y} />`:u}
              <circle class="lkdot" cx=${m.x} cy=${m.y} r="2.2" />${w?L`<circle class="lkdot" cx=${w.x} cy=${w.y} r="2.2" />`:u}
            </g>`})}
        </svg>
        <ul class="lklist">
          ${i.map(o=>r`<li data-link-row=${o.id}>${o.kindLabel}: ${I(o.a.label)} ↔ ${I(o.b?.label??o.farLabel)}${o.b?"":t(" (התאום עדיין לא פורסם)")}</li>`)}
        </ul>
      </div>
    </sw-card>`}connectedCallback(){super.connectedCallback(),this.reload(),this.stopXs=ss(()=>this.requestUpdate()),this.stopFire=es(()=>this.requestUpdate()),E().then(s=>this.xsData=s),ts().then(s=>this.multiOn=s)}disconnectedCallback(){this.cardsObs?.disconnect(),this.cardsObs=void 0,this.cardsEl=null,this.stopXs?.(),this.stopFire?.(),super.disconnectedCallback()}updated(s){s.has("buildingId")&&s.get("buildingId")!==void 0&&(this.selected=null),this.watchCards(),this.measureCards(),this.openHomeFromRoute()}openHomeFromRoute(){const s=D().params.get("ha");if(!s||s===this.homeRouteDone||!this.tree)return;const e=this.context,a=(e&&this.demoN()?R(this.demoN(),e.building):e?.building)?.floors?.find(l=>l.id===s);this.homeRouteDone=s,a&&!this.dialog&&this.openDialog({kind:"home",floor:a})}watchCards(){const s=this.renderRoot.querySelector(".cards[data-align]");if(s!==this.cardsEl){if(this.cardsObs?.disconnect(),this.cardsEl=s,!s){this.rowBoxes&&(this.rowBoxes=null);return}this.cardsObs??=new ResizeObserver(()=>this.measureCards()),this.cardsObs.observe(s),s.querySelectorAll("[data-floor-card]").forEach(e=>this.cardsObs.observe(e))}}measureCards(){const s=this.cardsEl;if(!s)return;const e=s.getBoundingClientRect(),i=[...s.querySelectorAll("[data-floor-card]")].map(h=>{const c=h.getBoundingClientRect();return{id:h.dataset.floorCard,top:Math.round(c.top-e.top),height:Math.round(c.height)}}),a=Math.round(e.height);this.rowBoxes&&this.rowBoxes.length===i.length&&this.rowBoxes.every((h,c)=>h.id===i[c].id&&h.top===i[c].top&&h.height===i[c].height)||(this.rowBoxes=i),a!==this.boxesHeight&&(this.boxesHeight=a)}xsEff(){return v()?C():is(C(),D().params)}demoN(){if(v())return 0;const s=Number(D().params.get("xsdemo"));return Number.isInteger(s)&&s>=1&&s<=40?s:0}sectionBeside(){return!this.phone.matches&&this.xsEff().desktop_place!=="off"}demoData(){return v()?null:D().params.get("xsdata")}signalsFor(s){return!v()||this.xsData?.demo?os([...s].sort((e,i)=>i.level-e.level||i.sort_order-e.sort_order),this.demoData()):as(s,this.xsData?.tree??null,this.xsData?.people??null,A(this.xsData,this.context?.site),{switches:this.xsEff().syn_switches})}pickFloor(s,e=!1){this.selected===s||e&&this.xsEff().click==="open"?z(`/explore/floors/${s}`):this.selected=s}linksFor(s){const e=s.map(i=>i.published_version_id?this.linkDocs.get(i.published_version_id):void 0).filter(i=>!!i);return X(e,s.map(i=>({id:i.id,name:i.name})))}renderLights(){const s=this.lightsOf,e=!v()||!!this.xsData?.demo,i=s&&!e?H(s):null;return r`<devices-tiles-panel kind="lights" data-floor-lights=${s?.id??""} ?open=${!!s} pairedMaster
      scope=${i?.scope??"building"} scopeId=${i?.scopeId??""} scopeName=${s?.name??""} .areaFilter=${i?i.areaIds:null} switches=${this.xsEff().syn_switches}
      .building=${i?rs(this.multiOn,this.context?.site.buildings?.length??0,this.context?.building.id):""}
      headingText=${s?y("floorLightsTitle",{name:s.name}):""}
      @panel-close=${()=>this.lightsOf=null} @panel-changed=${()=>void E().then(a=>this.xsData=a)}></devices-tiles-panel>`}renderFloorsTab(s,e,i){const a=this.tree,l=this.xsEff(),h=this.phone.matches,c=this.signalsFor(s),d=new Map(c.map(n=>[n.id,n])),$=ns(c,l),x=this.linksFor(s),b=x.length?ls(x):i||!v()?[{kind:"stairs",label:t("מדרגות"),floors:c.map(n=>n.id)}]:[],k=D().params.get("firemock");l.fire_ui?j(k,c):j(null);const _=l.fire_ui?ds().floors:null,o=h?cs(l.phone_place,s.length):"none",{step:m,cols:w}=hs(s.length,h),M=l.many==="near"?ps(s,e?.id??null,2):s,W=us(l.links,s.length,window.innerHeight)||h,G=h&&o==="side",B=this.sectionBeside()&&w===1&&M.length===s.length,Y=!this.phone.restricted("structure")&&(!v()||T("site.content.configure")),Q=M.map(n=>{const O=r`<button class="floor ${e?.id===n.id?"on":""} ${this.hoverId===n.id?"hl":""}" data-floor-card=${n.id} @click=${()=>this.pickFloor(n.id)} @pointerenter=${P=>P.pointerType==="mouse"&&(this.hoverId=n.id)} @pointerleave=${P=>P.pointerType==="mouse"&&(this.hoverId=null)} aria-pressed=${e?.id===n.id}>
        <div class="txt">
          <div class="title">${I(n.name)}</div>
          <div class="counts">${t("{n} מצלמות",{n:n.camera_count})}${n.shared_camera_count?r` <span class="shared" data-floor-shared=${n.id}>${t("(+{n} משותפות)",{n:n.shared_camera_count})}</span>`:u} · ${t("{n} פריטים במפה",{n:n.anchor_count})} · ${t("מפלס {level}",{level:fs(n.level)})}${n.has_plan?"":t(" · אין תוכנית עדיין")}${n.draft_version_id?t(" · טיוטה ממתינה לפרסום"):""}</div>
        </div>
        <sw-floor-iso data-floor-iso=${n.id} .rooms=${a.source==="demo"?ms(n.id):[]} .iso=${this.isoFor(n)} ?selected=${e?.id===n.id} ?empty=${!n.has_plan} width=${128}></sw-floor-iso>
        <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
      </button>`,F=d.get(n.id);return G&&F?r`<div class="frow">${O}${Ps(F,l,e?.id===n.id,()=>this.pickFloor(n.id),$)}</div>`:O}),V=r`<div class="actions" data-floor-actions>
      ${this.phone.restricted("structure")?u:r`<div>
            <sw-button icon="plus" @click=${()=>this.openDialog({kind:"floor"})}>${t("קומה חדשה")}</sw-button>
            <sw-button variant="ghost" icon="building" @click=${()=>this.openDialog({kind:"building"})}>${t("מבנה חדש")}</sw-button>
          </div>`}
      ${e?r`<div>
            ${this.phone.restricted("structure")?u:r`<sw-button variant="ghost" icon="edit" @click=${()=>this.openDialog({kind:"rename",floor:e})}>${t("עריכה")}</sw-button>
                <sw-button variant="ghost" icon="link" data-home-link-btn @click=${()=>this.openDialog({kind:"home",floor:e})}>${y("homeLinkBtn")}</sw-button>
                <sw-button variant="ghost" icon="trash" @click=${()=>this.openDialog({kind:"delete",floor:e,force:!1})}>${t("מחיקה")}</sw-button>
                <sw-button icon="upload" @click=${()=>z(`/explore/floors/${e.id}/import`)}>${e.has_plan?t("תוכנית חדשה"):t("העלאת תוכנית")}</sw-button>
                <sw-button icon="sparkle" data-plan-wizard @click=${()=>z(`/explore/floors/${e.id}/wizard`)}>${t("תוכנית מתמונה")}</sw-button>`}
            ${e.has_plan||e.draft_version_id?u:r`<sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>U()}>${t("בקשה לאדריכל")}</sw-button>`}
            ${d.get(e.id)&&$.light&&this.lightsAllowed(d.get(e.id))?r`<sw-button variant="ghost" icon="light" data-floor-lights-open=${e.id} @click=${()=>this.lightsOf=d.get(e.id)}>${y("floorLightsBtn")}</sw-button>`:u}
            <sw-button variant="primary" icon="map" @click=${()=>z(`/explore/floors/${e.id}`)}>${t("פתח את {name}",{name:e.name})}</sw-button>
          </div>`:u}
    </div>`,S=r`<sw-xsection .floors=${c} .links=${b} .opts=${l} .fire=${_} selectedId=${e?.id??""} hoverId=${this.hoverId??""}
      .rowBoxes=${B?this.rowBoxes:null} boxesHeight=${B?this.boxesHeight:0} ?canLink=${Y} .lightsOk=${this.lightsAllowed}
      @xs-lights=${n=>{this.lightsOf=d.get(n.detail.id)??null}}
      @xs-link=${n=>{const O=s.find(F=>F.id===n.detail.id);O&&this.openDialog({kind:"home",floor:O})}}
      @xs-pick=${n=>this.pickFloor(n.detail.id,!0)} @xs-hover=${n=>this.hoverId=n.detail.id}></sw-xsection>`,N=this.sectionBeside(),J=r`<div class="list" data-floor-list data-step=${m} data-cols=${w} data-many=${l.many}>
      ${s.length?u:r`<div class="empty">${this.phone.restricted("structure")?t("למבנה הזה אין עדיין קומות. הוספת קומות ותוכניות זמינה במחשב."):t("למבנה הזה אין עדיין קומות. הוסף קומה, ואז העלה תוכנית (PDF או תמונה).")}<div style="margin-block-start:10px"><sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>U()}>${t("בקשה לאדריכל")}</sw-button></div></div>`}
      ${h&&o==="card"?r`<sw-xs-compact .floors=${c} .opts=${l} selectedId=${e?.id??""} @xs-open-sheet=${()=>this.sheetOpen=!0}></sw-xs-compact>`:u}
      <div class="cards" data-step=${m} data-cols=${w} ?data-align=${B}>${Q}</div>
      ${W?this.renderLinksFolded(x):this.renderLinks(s)}
      ${this.error&&!this.dialog?r`<div class="err" role="alert">${this.error}</div>`:u}
      ${V}
    </div>`;return r`<div class="fl ${N?`beside ${l.desktop_place}`:""}" data-xs-place=${h?o:N?l.desktop_place:"off"}>
      ${J}
      ${N?r`<aside class="xscol" data-xs-col>${S}</aside>`:u}
      ${this.sheetOpen&&h&&s.length?r`<sw-dialog open heading=${y("sectionSheetTitle")} data-xs-sheet @close=${()=>this.sheetOpen=!1}>
            <div class="xssheet">${S}</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.sheetOpen=!1}>${y("close")}</sw-button>
          </sw-dialog>`:u}
    </div>`}renderLinksFolded(s){return s.length?r`<div class="linkrow" data-floor-links-folded><sw-icon name="layers" size=${14}></sw-icon><span class="lt">${y("linksTitle")}</span>
      <span class="ll">${s.map(e=>`${e.kindLabel}: ${e.a.label} ↔ ${e.b?.label??e.farLabel}${e.b?"":` ${y("linksPending")}`}`).join(" · ")}</span></div>`:u}async reload(){try{this.tree=await gs(),this.error=""}catch(s){this.error=q(s)}}get context(){if(!this.tree)return null;for(const i of this.tree.sites)for(const a of i.buildings??[])if(a.id===this.buildingId)return{site:i,building:a};const s=this.tree.sites[0],e=s?.buildings?.[0];return s&&e?{site:s,building:e}:null}async run(s){this.busy=!0,this.error="";try{await s(),this.dialog=null,await this.reload()}catch(e){e instanceof ws&&e.code==="has_anchors"&&this.dialog?.kind==="delete"?(this.dialog={...this.dialog,force:!0},this.error=`${e.body.user_message} ${t("({n} פריטים)",{n:e.body.details.anchors??""})}`):this.error=q(e)}finally{this.busy=!1}}openDialog(s){this.phone.restricted("structure")||(this.error="",this.formName=s?.kind==="rename"?s.floor.name:"",this.formLevel=s?.kind==="rename"?s.floor.level:0,this.dialog=s)}renderDialog(s){const e=this.dialog;if(!e||this.phone.restricted("structure"))return u;const i=this.tree?.source==="demo",a=r`<sw-field label=${t("שם")}><input .value=${this.formName} @input=${d=>this.formName=d.target.value} placeholder=${t("למשל: קומה 1")} autofocus /></sw-field>`,l=r`<sw-field label=${t("מפלס (0 = קרקע, שלילי = מרתף)")} hint=${t("קובע את סדר התצוגה בין הקומות")}><input type="number" data-ltr .value=${String(this.formLevel)} @input=${d=>this.formLevel=Number(d.target.value)} /></sw-field>`,h=this.error?r`<div class="err" role="alert">${this.error}</div>`:u,c=i?r`<div class="err">${t("נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.")}</div>`:u;switch(e.kind){case"floor":return r`<sw-dialog open heading=${t("קומה חדשה")} subheading=${`${s.name}`} @close=${()=>this.dialog=null}>
          ${a}${l}${h}${c}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||i} @click=${()=>this.run(async()=>{const d=await ks(s.id,{name:this.formName.trim(),level:this.formLevel});this.selected=d.id})}>${t("הוסף קומה")}</sw-button>
        </sw-dialog>`;case"rename":return r`<sw-dialog open heading=${t("עריכת קומה")} subheading=${e.floor.name} @close=${()=>this.dialog=null}>
          ${a}${l}${h}${c}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||i} @click=${()=>this.run(()=>xs(e.floor.id,{name:this.formName.trim(),level:this.formLevel}))}>${t("שמירה")}</sw-button>
        </sw-dialog>`;case"delete":return r`<sw-dialog open heading=${t("מחיקת קומה")} subheading=${e.floor.name} @close=${()=>this.dialog=null}>
          <div style="font-size:var(--sw-fs-sm)">${e.force?t("על הקומה מוצבים פריטים. מחיקה תסיר אותם מהמפה (ההיסטוריה נשמרת באודיט). להמשיך?"):t("הקומה תוסר מהמערכת. תוכניות שפורסמו נשמרות בארכיון; מצלמות והקלטות ב־NVR אינן נמחקות.")}</div>
          ${h}${c}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
          <sw-button slot="footer" variant="danger" ?disabled=${this.busy||i} @click=${()=>this.run(async()=>{await $s(e.floor.id,e.force),this.selected===e.floor.id&&(this.selected=null)})}>${e.force?t("מחק כולל הפריטים"):t("מחק קומה")}</sw-button>
        </sw-dialog>`;case"home":{const d=s.floors??[],$=i||!v()?vs(d,this.demoData()==="none"?"none":this.demoData()==="sparse"?"sparse":"ha"):this.xsData?.tree??null,x=new Map((this.tree?.sites??[]).flatMap(b=>(b.buildings??[]).flatMap(k=>(k.floors??[]).map(_=>[_.id,(b.buildings?.length??0)>1?`${k.name} · ${_.name}`:_.name]))));return r`<sw-floor-home-link .floor=${e.floor} .floors=${d} .floorNames=${x} .tree=${$} .links=${this.xsData?.links??null}
          ?singleBuilding=${A(this.xsData,this.context?.site).singleBuilding} ?demo=${i||!v()}
          @close=${()=>this.dialog=null}
          @saved=${b=>{this.dialog=null,this.xsData&&(this.xsData={...this.xsData,links:b.detail.links}),E().then(k=>this.xsData=k)}}></sw-floor-home-link>`}case"building":return r`<sw-dialog open heading=${t("מבנה חדש")} subheading=${this.context?.site.name??""} @close=${()=>this.dialog=null}>
          ${a}${h}${c}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||i} @click=${()=>this.run(async()=>{const d=await bs(this.context.site.id,{name:this.formName.trim()});z(`/explore/buildings/${d.id}/floors`)})}>${t("הוסף מבנה")}</sw-button>
        </sw-dialog>`}}render(){if(!this.tree)return r`<sw-page heading=${t("קומות")}><sw-state-panel icon="floor" state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const s=this.context;if(!s)return r`<sw-page heading=${t("קומות")} subheading=${t("אין עדיין אתרים ומבנים")}>
        <sw-state-panel icon="floor" state="empty" heading=${t("עוד אין מבנים")} hint=${t("צור אתר ומבנה כדי להוסיף קומות ותוכניות.")}>
          <div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>z("/explore/sites")}>${t("לאתרים")}</sw-button></div>
        </sw-state-panel>
      </sw-page>`;const{site:e}=s,i=this.demoN()?R(this.demoN(),s.building,D().params.get("xsnames")==="long"):s.building,a=i.floors??[],l=a.find(d=>d.id===this.selected)??a[0]??null,h=a.reduce((d,$)=>d+$.camera_count,0),c=this.tree;return r`
      <sw-page heading=${i.name} subheading=${`${e.address||e.name} · ${t("{n} קומות",{n:a.length})}${c.source==="demo"?t(" · נתוני הדגמה"):""}`} crumbs=${`${t("אתרים")} | ${e.name} | ${i.name}`}>
        ${this.sectionBeside()?u:r`<div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>`}
        <div class="tabsrow"><sw-tabs .items=${[{id:"floors",label:t("קומות"),count:a.length},{id:"cameras",label:t("מצלמות"),count:h},{id:"details",label:t("פרטים")}]} .active=${this.tab} @change=${d=>this.tab=d.detail.id}></sw-tabs>
          ${this.phone.matches&&this.tab==="floors"&&this.xsEff().phone_place==="sheet"&&a.length?r`<sw-button class="xsbtn" size="sm" variant="ghost" data-xs-sheet-btn @click=${()=>this.sheetOpen=!0}>${y("sectionOpenBtn")}</sw-button>`:u}
        </div>
        ${this.tab==="floors"?this.renderFloorsTab(a,l,c.source==="demo"):this.tab==="cameras"?r`<div class="cams">${a.map(d=>r`<sw-card heading=${I(d.name)} subheading=${t("{n} מצלמות",{n:d.camera_count})} interactive @click=${()=>z(`/explore/floors/${d.id}`)}></sw-card>`)}</div>`:r`<sw-card heading=${t("פרטי המבנה")}>
                <dl>
                  <dt>${t("אתר")}</dt><dd>${e.name}</dd>
                  <dt>${t("כתובת")}</dt><dd>${e.address||"—"}</dd>
                  <dt>${t("אזור זמן")}</dt><dd><span class="ltr">${e.timezone}</span></dd>
                  <dt>${t("קומות")}</dt><dd>${a.length} · ${t("{n} עם תוכנית מפורסמת",{n:a.filter(d=>d.has_plan).length})}</dd>
                  <dt>${t("קשרים בין קומות")}</dt><dd>${t('מדרגות ומעלית בין קומות מוגדרות בעורך התוכנית ("מחבר אל"); הקשרים שפורסמו מופיעים בלשונית הקומות')}</dd>
                </dl>
              </sw-card>`}
        ${this.renderDialog(i)}
        ${this.renderLights()}
      </sw-page>
    `}};p.styles=[Es,ys`
    .links {
      display: flex;
      gap: 18px;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    svg.stack {
      inline-size: 180px;
      block-size: auto;
      overflow: visible;
    }
    svg.stack .plate {
      fill: var(--sw-surface);
      stroke: var(--sw-border-strong);
      stroke-width: 0.8;
    }
    /* POLISH4 WP6 (D13): the floor name was a 6px literal in viewBox units (120 units drawn at 180 px = 9 px on screen, in text-3).
       It is now the type scale's smallest step on screen: 2xs divided by the 1.5 draw scale, in the secondary ink (4.5:1 on the plate). */
    svg.stack .pname {
      font-size: calc(var(--sw-fs-2xs) * 2 / 3);
      fill: var(--sw-text-2);
    }
    svg.stack .lk {
      stroke: var(--sw-accent);
      stroke-width: 1.4;
      stroke-dasharray: 3 2;
    }
    svg.stack .lkdot {
      fill: var(--sw-accent);
    }
    .lklist {
      margin: 0;
      padding-inline-start: 18px;
      font-size: var(--sw-fs-sm);
      display: grid;
      gap: 4px;
    }
    .pic {
      inline-size: 112px;
      block-size: 72px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      position: relative;
      box-shadow: var(--sw-shadow-1);
    }
    .pic sw-scene {
      position: absolute;
      inset: 0;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-inline-size: 720px;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
      border: 1.5px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      text-align: start;
      font: inherit;
      color: inherit;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease);
    }
    .floor.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .floor .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .title {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .counts {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .counts .shared {
      color: var(--sw-accent-text);
    }
    .chev {
      color: var(--sw-text-3);
    }
    .floor.on .chev {
      color: var(--sw-accent);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .actions div {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-xs);
    }
    .empty {
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 24px;
      text-align: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
      max-inline-size: 520px;
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .cams {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): the floor rows are the hero objects - large radius, a 17/700 heading, the
       counts as a 13/500 line with tabular digits; the selected floor is a FILLED accent field with the accent edge and shadow 2
       (not a 3 px halo around a white card). Press on pointer-down; hover only with a fine pointer. */
    .pic {
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-2);
    }
    .floor {
      padding: 12px 16px;
      border-color: transparent;
      border-radius: var(--sw-r-lg);
      transition: border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
    }
    .floor:active {
      transform: scale(var(--sw-press-scale));
    }
    .floor.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2);
    }
    /* POLISH4 WP6 (D12): the floor rows have one hover, the fine-pointer one below; the ungated :hover and its (hover: none) undo are gone,
       so a tap on a tablet never leaves a row raised */
    .title {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      letter-spacing: -0.01em;
    }
    .floor.on .title {
      color: var(--sw-accent-text);
    }
    .counts {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-2);
      margin-block-start: 4px;
      font-variant-numeric: tabular-nums;
    }
    .floor.on .counts {
      color: var(--sw-text);
    }
    .empty {
      background: var(--sw-surface-2);
      font-weight: var(--sw-fw-medium);
    }
    dd {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    dt {
      color: var(--sw-text-2);
    }
    /* R5-MAPS-297 loop 2: three steps, not one - the unselected floors are WELLS (surface 2, no shadow, no edge), the selected floor is the
       one hero (accent field, 2 px accent edge, shadow 2), the heading 20/700 and the counts 14/500 with 700 digits. */
    .floor {
      background: var(--sw-surface-2);
      box-shadow: none;
      border-width: 2px;
      padding: 14px 18px;
    }
    .floor.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2);
    }
    @media (hover: hover) and (pointer: fine) {
      .floor:hover:not(.on) {
        background: var(--sw-surface-3);
        border-color: transparent;
        box-shadow: none;
      }
    }
    .title {
      font-size: var(--sw-fs-2xl);
      /* break-ui (shots/final/floors-worst-*): a 90-character unbreakable name ran out of the row; a name wraps to two lines at most */
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .counts {
      overflow-wrap: anywhere;
    }
    .counts {
      font-size: var(--sw-fs-md);
    }
    .pic {
      inline-size: 124px;
      block-size: 80px;
    }
    /* 2.29.0: the cross-section beside the list. The list is frozen (no scroll): its cards share the height and shrink in steps; the section takes the free area. */
    :host {
      display: block;
      block-size: 100%;
    }
    sw-page {
      block-size: 100%;
      box-sizing: border-box;
    }
    .tabsrow {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .fl {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      min-block-size: 0;
      block-size: 100%;
    }
    .fl.beside {
      grid-template-columns: minmax(0, 720px) minmax(0, 1fr);
    }
    .fl.beside.right .xscol {
      order: -1;
    }
    .xscol {
      min-inline-size: 0;
      min-block-size: 0;
      block-size: 100%;
      max-block-size: 100%;
    }
    @media (max-width: 1023px) {
      .fl.beside {
        grid-template-columns: minmax(0, 1fr) minmax(0, 300px);
      }
    }
    .list {
      min-block-size: 0;
      max-inline-size: none;
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-block-size: 0;
    }
    .cards[data-cols='2'] {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .frow {
      display: flex;
      gap: 8px;
      align-items: stretch;
    }
    .frow > .floor {
      flex: 1;
      min-inline-size: 0;
    }
    .floor.hl:not(.on) {
      background: var(--sw-surface-3);
    }
    /* the steps: the more floors, the smaller the card (no scrolling) */
    .cards[data-step='1'] { gap: 8px; }
    .cards[data-step='1'] .floor { padding: 10px 16px; }
    .cards[data-step='1'] .title { font-size: var(--sw-fs-xl); }
    .cards[data-step='1'] .counts { font-size: var(--sw-fs-sm); }
    .cards[data-step='1'] sw-floor-iso { display: none; }
    .cards[data-step='2'] { gap: 6px; }
    .cards[data-step='2'] .floor { padding: 7px 14px; border-radius: var(--sw-r-md); }
    .cards[data-step='2'] .title { font-size: var(--sw-fs-lg); }
    .cards[data-step='2'] .counts { font-size: var(--sw-fs-xs); }
    .cards[data-step='2'] sw-floor-iso, .cards[data-step='2'] .chev { display: none; }
    .cards[data-step='3'] { gap: 4px; }
    .cards[data-step='3'] .floor { padding: 4px 12px; border-radius: var(--sw-r-sm); border-width: 1.5px; }
    .cards[data-step='3'] .title { font-size: var(--sw-fs-md); -webkit-line-clamp: 1; line-clamp: 1; }
    .cards[data-step='3'] .counts, .cards[data-step='3'] sw-floor-iso, .cards[data-step='3'] .chev { display: none; }
    .linkrow {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .linkrow .lt { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); white-space: nowrap; }
    .linkrow .ll { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* SYNOPTIC-HA-2310: the column has the page's height and the cards give way inside it (they shrank in steps but could still run under
       the actions at 12 floors); the section's rows follow the cards' boxes, so both columns keep one rhythm. */
    .fl.beside { grid-template-rows: minmax(0, 1fr); }
    .fl.beside .list { min-block-size: 0; }
    .fl.beside .cards { flex: 0 1 auto; }
    .fl.beside .cards > .floor { flex: 0 1 auto; min-block-size: 0; overflow: hidden; }
    .xssheet { block-size: min(72dvh, 640px); min-block-size: 360px; }
    .xsbtn { margin-inline-start: auto; }
    @media (max-width: 767px) {
      .fl { block-size: auto; }
      .floor { padding: 10px 12px; gap: 10px; }
      .frow .floor sw-floor-iso { display: none; }
      .frow .floor .chev { display: none; }
      .title { font-size: var(--sw-fs-xl); }
      .counts { font-size: var(--sw-fs-sm); }
      .cards[data-step='1'] .title, .cards[data-step='2'] .title { font-size: var(--sw-fs-md); }
      .cards[data-step='3'] .title { font-size: var(--sw-fs-sm); }
      .xscol { display: none; }
    }
  `];f([_s()],p.prototype,"buildingId",2);f([g()],p.prototype,"tree",2);f([g()],p.prototype,"selected",2);f([g()],p.prototype,"tab",2);f([g()],p.prototype,"dialog",2);f([g()],p.prototype,"busy",2);f([g()],p.prototype,"error",2);f([g()],p.prototype,"formName",2);f([g()],p.prototype,"formLevel",2);f([g()],p.prototype,"isos",2);f([g()],p.prototype,"xsData",2);f([g()],p.prototype,"sheetOpen",2);f([g()],p.prototype,"hoverId",2);f([g()],p.prototype,"lightsOf",2);f([g()],p.prototype,"multiOn",2);f([g()],p.prototype,"linkDocs",2);f([g()],p.prototype,"rowBoxes",2);f([g()],p.prototype,"boxesHeight",2);p=f([zs("explore-floors")],p);export{p as ExploreFloors};
