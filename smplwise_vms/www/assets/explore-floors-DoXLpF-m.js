import{i as es,V as ts,a7 as y,a8 as H,a9 as R,A as m,aa as M,ab as I,b as a,ac as os,ad as is,ae as E,W as as,af as O,ag as C,ah as j,ai as rs,aj as ns,ak as ls,al as q,a0 as z,am as ds,an as D,ao as cs,ap as hs,aq as U,ar as ps,as as ms,at as fs,au as gs,av as us,aw as k,ax as ws,X as vs,n as B,a as W,$ as bs,ay as $s,az as xs,aA as ks,aB as ys,g as _s,v as zs,j as w,k as Ds}from"./index-c_ii2C2N.js";import{o as X}from"./architect-request-dialog-P0h0RW0A.js";import"./sw-floor-iso-K5dVG45H.js";import{g as Os}from"./geometry-ivQ0BUZ6.js";import{k as Fs,b as Ls,i as Ms,a as Is}from"./scene-builder-Ch9ALu4e.js";import{f as G}from"./connector-targets-CJOIyFii.js";import{f as Bs,D as Ns}from"./shared-space-CYRY5_kn.js";import{xsTile as Ts,xsTileStyles as Ps}from"./sw-xsection-CNpFnx0-.js";import{m as Es,p as Ss,a as V,b as As,r as Hs,c as Rs}from"./mb-safety-BBLMuYiA.js";import"./devices-tiles-panel-B23rI4sM.js";import{t}from"./media-ChiRjfra.js";import"./sw-logo-art-PLtEZJxU.js";import"./material-resolve-BxrmBmFX.js";import"./map-LwWxHFbf.js";import"./zones--OU0BCMz.js";import"./if-defined-CapqhvJU.js";import"./devices-controls-fo0DLBpi.js";import"./device-commands-BmOpAxOf.js";import"./lock-reason-CQMNnpKp.js";import"./door-path-logic-DUGzLbN0.js";var Cs=Object.defineProperty,js=Object.getOwnPropertyDescriptor,u=(s,e,o,r)=>{for(var i=r>1?void 0:r?js(e,o):e,h=s.length-1,d;h>=0;h--)(d=s[h])&&(i=(r?d(e,o,i):d(i))||i);return r&&i&&Cs(e,o,i),i};let f=class extends es{constructor(){super(...arguments),this.phone=new ts(this),this.buildingId="bld-a",this.tree=null,this.selected=null,this.tab="floors",this.dialog=null,this.busy=!1,this.error="",this.formName="",this.formLevel=0,this.isos=new Map,this.isoPending=new Set,this.xsData=null,this.sheetOpen=!1,this.hoverId=null,this.lightsOf=null,this.multiOn=!1,this.linkDocs=new Map,this.rowBoxes=null,this.boxesHeight=0,this.cardsEl=null,this.homeRouteDone="",this.lightsAllowed=s=>s.nodata||s.lights===null?!1:!y()||this.xsData?.demo?!0:H("devices.read")&&R(s)!==null}pruned(){const s=(this.tree?.sites??[]).flatMap(e=>(e.buildings??[]).flatMap(o=>(o.floors??[]).map(r=>r.published_version_id))).filter(e=>!!e);return Fs(this.isos,s)}isoFor(s){const e=s.published_version_id;return!e||this.tree?.source!=="api"?null:this.isos.has(e)?this.isos.get(e)??null:(this.isoPending.has(e)||(this.isoPending.add(e),Os(e).then(o=>{const r=Ls({doc:o.doc,width:s.plan_width_px||o.doc.dimensions.width_px,height:s.plan_height_px||o.doc.dimensions.height_px,anchors:[],entityStates:{},circuitStates:{},layers:{objects:!1,cameras:!1,entities:!1,zones:!1}});this.isos=this.pruned().set(e,r.parts.some(i=>i.kind==="wall")?Ms(r):null),this.linkDocs=new Map(this.linkDocs).set(e,{floorId:s.id,connectors:o.doc.connectors,levels:o.doc.levels,floorHeightM:Bs(o.doc)})}).catch(()=>{this.isos=this.pruned().set(e,null)}).finally(()=>this.isoPending.delete(e))),null)}renderLinks(s){const e=s.map(n=>n.published_version_id?this.linkDocs.get(n.published_version_id):void 0).filter(n=>!!n),o=G(e,s.map(n=>({id:n.id,name:n.name})));if(!o.length)return m;const r=[...s].sort((n,g)=>n.level-g.level||n.sort_order-g.sort_order),i=34/3,h=n=>(n.published_version_id?this.linkDocs.get(n.published_version_id)?.floorHeightM:void 0)??Ns,d=new Map;let l=0;for(const n of r)d.set(n.id,l),l+=h(n)*i;const b=r.length?d.get(r[r.length-1].id):0,$=n=>b-(d.get(n)??0),x=(n,g)=>{const v=Is(g[0],g[1]);return{x:v.x,y:v.y+$(n)}},p=n=>[[0,0],[1,0],[1,1],[0,1]].map(([g,v])=>x(n,[g,v])).map(g=>`${g.x.toFixed(1)},${g.y.toFixed(1)}`).join(" "),_=72+b;return a`<sw-card heading=${t("קשרים בין קומות")} subheading=${t("מדרגות ומעליות שמקשרות קומות (מבנה מפורסם)")} data-floor-links>
      <div class="links">
        <svg class="stack" viewBox=${`0 0 120 ${_}`} aria-hidden="true">
          ${r.map(n=>M`<g data-stack-floor=${n.id}><polygon class="plate" points=${p(n.id)} /><text class="pname" x="2" y=${($(n.id)+38).toFixed(1)}>${n.name}</text></g>`)}
          ${o.map(n=>{const g=x(n.a.floorId,n.a.at),v=n.b?x(n.b.floorId,n.b.at):null;return M`<g data-stack-link=${n.id}>
              ${v?M`<line class="lk" x1=${g.x} y1=${g.y} x2=${v.x} y2=${v.y} />`:m}
              <circle class="lkdot" cx=${g.x} cy=${g.y} r="2.2" />${v?M`<circle class="lkdot" cx=${v.x} cy=${v.y} r="2.2" />`:m}
            </g>`})}
        </svg>
        <ul class="lklist">
          ${o.map(n=>a`<li data-link-row=${n.id}>${n.kindLabel}: ${I(n.a.label)} ↔ ${I(n.b?.label??n.farLabel)}${n.b?"":t(" (התאום עדיין לא פורסם)")}</li>`)}
        </ul>
      </div>
    </sw-card>`}connectedCallback(){super.connectedCallback(),this.reload(),this.stopXs=os(()=>this.requestUpdate()),this.stopFire=is(()=>this.requestUpdate()),E().then(s=>this.xsData=s),as().then(s=>this.multiOn=s)}disconnectedCallback(){this.cardsObs?.disconnect(),this.cardsObs=void 0,this.cardsEl=null,this.stopXs?.(),this.stopFire?.(),super.disconnectedCallback()}updated(s){s.has("buildingId")&&s.get("buildingId")!==void 0&&(this.selected=null),this.watchCards(),this.measureCards(),this.openHomeFromRoute()}openHomeFromRoute(){const s=O().params.get("ha");if(!s||s===this.homeRouteDone||!this.tree)return;const e=this.context,r=(e&&this.demoN()?C(this.demoN(),e.building):e?.building)?.floors?.find(i=>i.id===s);this.homeRouteDone=s,r&&!this.dialog&&this.openDialog({kind:"home",floor:r})}watchCards(){const s=this.renderRoot.querySelector(".cards[data-align]");if(s!==this.cardsEl){if(this.cardsObs?.disconnect(),this.cardsEl=s,!s){this.rowBoxes&&(this.rowBoxes=null);return}this.cardsObs??=new ResizeObserver(()=>this.measureCards()),this.cardsObs.observe(s),s.querySelectorAll("[data-floor-card]").forEach(e=>this.cardsObs.observe(e))}}measureCards(){const s=this.cardsEl;if(!s)return;const e=s.getBoundingClientRect(),o=[...s.querySelectorAll("[data-floor-card]")].map(h=>{const d=h.getBoundingClientRect();return{id:h.dataset.floorCard,top:Math.round(d.top-e.top),height:Math.round(d.height)}}),r=Math.round(e.height);this.rowBoxes&&this.rowBoxes.length===o.length&&this.rowBoxes.every((h,d)=>h.id===o[d].id&&h.top===o[d].top&&h.height===o[d].height)||(this.rowBoxes=o),r!==this.boxesHeight&&(this.boxesHeight=r)}xsEff(){return y()?j():rs(j(),O().params)}demoN(){if(y())return 0;const s=Number(O().params.get("xsdemo"));return Number.isInteger(s)&&s>=1&&s<=40?s:0}sectionBeside(){return!this.phone.matches&&this.xsEff().desktop_place!=="off"}demoData(){return y()?null:O().params.get("xsdata")}signalsFor(s){return!y()||this.xsData?.demo?ns([...s].sort((e,o)=>o.level-e.level||o.sort_order-e.sort_order),this.demoData()):ls(s,this.xsData?.tree??null,this.xsData?.people??null,q(this.xsData,this.context?.site),{switches:this.xsEff().syn_switches})}pickFloor(s,e=!1){this.selected===s||e&&this.xsEff().click==="open"?z(`/explore/floors/${s}`):this.selected=s}linksFor(s){const e=s.map(o=>o.published_version_id?this.linkDocs.get(o.published_version_id):void 0).filter(o=>!!o);return G(e,s.map(o=>({id:o.id,name:o.name})))}renderLights(){const s=this.lightsOf,e=!y()||!!this.xsData?.demo,o=s&&!e?R(s):null;return a`<devices-tiles-panel kind="lights" data-floor-lights=${s?.id??""} ?open=${!!s} pairedMaster
      scope=${o?.scope??"building"} scopeId=${o?.scopeId??""} scopeName=${s?.name??""} .areaFilter=${o?o.areaIds:null} switches=${this.xsEff().syn_switches}
      .building=${o?ds(this.multiOn,this.context?.site.buildings?.length??0,this.context?.building.id):""}
      headingText=${s?D("floorLightsTitle",{name:s.name}):""}
      @panel-close=${()=>this.lightsOf=null} @panel-changed=${()=>void E().then(r=>this.xsData=r)}></devices-tiles-panel>`}renderFloorsTab(s,e,o){const r=this.tree,i=this.xsEff(),h=this.phone.matches,d=this.signalsFor(s),l=new Map(d.map(c=>[c.id,c])),b=cs(d,i),$=this.linksFor(s),x=$.length?hs($):o||!y()?[{kind:"stairs",label:t("מדרגות"),floors:d.map(c=>c.id)}]:[],p=O().params.get("firemock");i.fire_ui?U(p,d):U(null);const _=i.fire_ui?ps().floors:null,n=h?ms(i.phone_place,s.length):"none",{step:g,cols:v}=fs(s.length,h),S=i.many==="near"?gs(s,e?.id??null,2):s,Y=us(i.links,s.length,window.innerHeight)||h,J=h&&n==="side",N=this.sectionBeside()&&v===1&&S.length===s.length,K=!this.phone.restricted("structure")&&(!y()||H("site.content.configure")),Q=S.map(c=>{const F=a`<button class="floor ${e?.id===c.id?"on":""} ${this.hoverId===c.id?"hl":""}" data-floor-card=${c.id} @click=${()=>this.pickFloor(c.id)} @pointerenter=${P=>P.pointerType==="mouse"&&(this.hoverId=c.id)} @pointerleave=${P=>P.pointerType==="mouse"&&(this.hoverId=null)} aria-pressed=${e?.id===c.id}>
        <div class="txt">
          <div class="title">${I(c.name)}</div>
          <div class="counts">${t("{n} מצלמות",{n:c.camera_count})}${c.shared_camera_count?a` <span class="shared" data-floor-shared=${c.id}>${t("(+{n} משותפות)",{n:c.shared_camera_count})}</span>`:m} · ${t("{n} פריטים במפה",{n:c.anchor_count})} · ${t("מפלס {level}",{level:k(c.level)})}${c.has_plan?"":t(" · אין תוכנית עדיין")}${c.draft_version_id?t(" · טיוטה ממתינה לפרסום"):""}</div>
        </div>
        <sw-floor-iso data-floor-iso=${c.id} .rooms=${r.source==="demo"?ws(c.id):[]} .iso=${this.isoFor(c)} ?selected=${e?.id===c.id} ?empty=${!c.has_plan} width=${128}></sw-floor-iso>
        <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
      </button>`,L=l.get(c.id);return J&&L?a`<div class="frow">${F}${Ts(L,i,e?.id===c.id,()=>this.pickFloor(c.id),b)}</div>`:F}),Z=a`<div class="actions" data-floor-actions>
      ${this.phone.restricted("structure")?m:a`<div>
            <sw-button icon="plus" @click=${()=>this.openDialog({kind:"floor"})}>${t("קומה חדשה")}</sw-button>
            <sw-button variant="ghost" icon="building" @click=${()=>this.openDialog({kind:"building"})}>${t("מבנה חדש")}</sw-button>
          </div>`}
      ${e?a`<div>
            ${this.phone.restricted("structure")?m:a`<sw-button variant="ghost" icon="edit" @click=${()=>this.openDialog({kind:"rename",floor:e})}>${t("עריכה")}</sw-button>
                <sw-button variant="ghost" icon="link" data-home-link-btn @click=${()=>this.openDialog({kind:"home",floor:e})}>${D("homeLinkBtn")}</sw-button>
                <sw-button variant="ghost" icon="trash" @click=${()=>this.openDialog({kind:"delete",floor:e,force:!1})}>${t("מחיקה")}</sw-button>
                <sw-button icon="upload" @click=${()=>z(`/explore/floors/${e.id}/import`)}>${e.has_plan?t("תוכנית חדשה"):t("העלאת תוכנית")}</sw-button>
                <sw-button icon="sparkle" data-plan-wizard @click=${()=>z(`/explore/floors/${e.id}/wizard`)}>${t("תוכנית מתמונה")}</sw-button>`}
            ${e.has_plan||e.draft_version_id?m:a`<sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>X()}>${t("בקשה לאדריכל")}</sw-button>`}
            ${l.get(e.id)&&b.light&&this.lightsAllowed(l.get(e.id))?a`<sw-button variant="ghost" icon="light" data-floor-lights-open=${e.id} @click=${()=>this.lightsOf=l.get(e.id)}>${D("floorLightsBtn")}</sw-button>`:m}
            <sw-button variant="primary" icon="map" @click=${()=>z(`/explore/floors/${e.id}`)}>${t("פתח את {name}",{name:e.name})}</sw-button>
          </div>`:m}
    </div>`,A=a`<sw-xsection .floors=${d} .links=${x} .opts=${i} .fire=${_} selectedId=${e?.id??""} hoverId=${this.hoverId??""}
      .rowBoxes=${N?this.rowBoxes:null} boxesHeight=${N?this.boxesHeight:0} ?canLink=${K} .lightsOk=${this.lightsAllowed}
      @xs-lights=${c=>{this.lightsOf=l.get(c.detail.id)??null}}
      @xs-link=${c=>{const F=s.find(L=>L.id===c.detail.id);F&&this.openDialog({kind:"home",floor:F})}}
      @xs-pick=${c=>this.pickFloor(c.detail.id,!0)} @xs-hover=${c=>this.hoverId=c.detail.id}></sw-xsection>`,T=this.sectionBeside(),ss=a`<div class="list" data-floor-list data-step=${g} data-cols=${v} data-many=${i.many}>
      ${s.length?m:a`<div class="empty">${this.phone.restricted("structure")?t("למבנה הזה אין עדיין קומות. הוספת קומות ותוכניות זמינה במחשב."):t("למבנה הזה אין עדיין קומות. הוסף קומה, ואז העלה תוכנית (PDF או תמונה).")}<div style="margin-block-start:10px"><sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>X()}>${t("בקשה לאדריכל")}</sw-button></div></div>`}
      ${h&&n==="card"?a`<sw-xs-compact .floors=${d} .opts=${i} selectedId=${e?.id??""} @xs-open-sheet=${()=>this.sheetOpen=!0}></sw-xs-compact>`:m}
      <div class="cards" data-step=${g} data-cols=${v} ?data-align=${N}>${Q}</div>
      ${Y?this.renderLinksFolded($):this.renderLinks(s)}
      ${this.error&&!this.dialog?a`<div class="err" role="alert">${this.error}</div>`:m}
      ${Z}
    </div>`;return a`<div class="fl ${T?`beside ${i.desktop_place}`:""}" data-xs-place=${h?n:T?i.desktop_place:"off"}>
      ${ss}
      ${T?a`<aside class="xscol" data-xs-col>${A}</aside>`:m}
      ${this.sheetOpen&&h&&s.length?a`<sw-dialog open heading=${D("sectionSheetTitle")} data-xs-sheet @close=${()=>this.sheetOpen=!1}>
            <div class="xssheet">${A}</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.sheetOpen=!1}>${D("close")}</sw-button>
          </sw-dialog>`:m}
    </div>`}renderLinksFolded(s){return s.length?a`<div class="linkrow" data-floor-links-folded><sw-icon name="layers" size=${14}></sw-icon><span class="lt">${D("linksTitle")}</span>
      <span class="ll">${s.map(e=>`${e.kindLabel}: ${e.a.label} ↔ ${e.b?.label??e.farLabel}${e.b?"":` ${D("linksPending")}`}`).join(" · ")}</span></div>`:m}async reload(){try{this.tree=await vs(),this.error=""}catch(s){this.error=B(s)}}get context(){if(!this.tree)return null;for(const o of this.tree.sites)for(const r of o.buildings??[])if(r.id===this.buildingId)return{site:o,building:r};const s=this.tree.sites[0],e=s?.buildings?.[0];return s&&e?{site:s,building:e}:null}async run(s){this.busy=!0,this.error="";try{await s(),this.dialog=null,await this.reload()}catch(e){e instanceof W&&e.code==="has_anchors"&&this.dialog?.kind==="delete"?(this.dialog={...this.dialog,force:!0},this.error=`${e.body.user_message} ${t("({n} פריטים)",{n:e.body.details.anchors??""})}`):this.error=B(e)}finally{this.busy=!1}}openDialog(s){this.phone.restricted("structure")||(this.error="",this.formName=s?.kind==="rename"?s.floor.name:"",this.formLevel=s?.kind==="rename"?s.floor.level:0,this.dialog=s)}renderDialog(s){const e=this.dialog;if(!e||this.phone.restricted("structure"))return m;const o=this.tree?.source==="demo",r=a`<sw-field label=${t("שם")}><input .value=${this.formName} @input=${l=>this.formName=l.target.value} placeholder=${t("למשל: קומה 1")} autofocus /></sw-field>`,i=a`<sw-field label=${t("מפלס (0 = קרקע, שלילי = מרתף)")} hint=${t("קובע את סדר התצוגה בין הקומות")}><input type="number" data-ltr .value=${String(this.formLevel)} @input=${l=>this.formLevel=Number(l.target.value)} /></sw-field>`,h=this.error?a`<div class="err" role="alert">${this.error}</div>`:m,d=o?a`<div class="err">${t("נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.")}</div>`:m;switch(e.kind){case"floor":return a`<sw-dialog open heading=${t("קומה חדשה")} subheading=${`${s.name}`} @close=${()=>this.dialog=null}>
          ${r}${i}${h}${d}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||o} @click=${()=>this.run(async()=>{const l=await ys(s.id,{name:this.formName.trim(),level:this.formLevel});this.selected=l.id})}>${t("הוסף קומה")}</sw-button>
        </sw-dialog>`;case"rename":return a`<sw-dialog open heading=${t("עריכת קומה")} subheading=${e.floor.name} @close=${()=>this.dialog=null}>
          ${r}${i}${this.moveTargets(s).length?a`<div class="moverow" data-floor-move-row><span>${t("הקומה שייכת ל{name}",{name:s.name})}</span>
                <sw-button size="sm" variant="ghost" icon="building" data-floor-move-open @click=${()=>this.openMove(e.floor,s)}>${t("העברה לבניין אחר")}</sw-button></div>`:m}${h}${d}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||o} @click=${()=>this.run(()=>ks(e.floor.id,{name:this.formName.trim(),level:this.formLevel}))}>${t("שמירה")}</sw-button>
        </sw-dialog>`;case"delete":return a`<sw-dialog open heading=${t("מחיקת קומה")} subheading=${e.floor.name} @close=${()=>this.dialog=null}>
          <div style="font-size:var(--sw-fs-sm)">${e.force?t("על הקומה מוצבים פריטים. מחיקה תסיר אותם מהמפה (ההיסטוריה נשמרת באודיט). להמשיך?"):t("הקומה תוסר מהמערכת. תוכניות שפורסמו נשמרות בארכיון; מצלמות והקלטות ב־NVR אינן נמחקות.")}</div>
          ${h}${d}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
          <sw-button slot="footer" variant="danger" ?disabled=${this.busy||o} @click=${()=>this.run(async()=>{await xs(e.floor.id,e.force),this.selected===e.floor.id&&(this.selected=null)})}>${e.force?t("מחק כולל הפריטים"):t("מחק קומה")}</sw-button>
        </sw-dialog>`;case"home":{const l=s.floors??[],b=o||!y()?$s(l,this.demoData()==="none"?"none":this.demoData()==="sparse"?"sparse":"ha"):this.xsData?.tree??null,$=new Map((this.tree?.sites??[]).flatMap(x=>(x.buildings??[]).flatMap(p=>(p.floors??[]).map(_=>[_.id,(x.buildings?.length??0)>1?`${p.name} · ${_.name}`:_.name]))));return a`<sw-floor-home-link .floor=${e.floor} .floors=${l} .floorNames=${$} .tree=${b} .links=${this.xsData?.links??null}
          ?singleBuilding=${q(this.xsData,this.context?.site).singleBuilding} ?demo=${o||!y()}
          @close=${()=>this.dialog=null}
          @saved=${x=>{this.dialog=null,this.xsData&&(this.xsData={...this.xsData,links:x.detail.links}),E().then(p=>this.xsData=p)}}></sw-floor-home-link>`}case"move":return this.renderMove(e,s,o);case"building":return a`<sw-dialog open heading=${t("מבנה חדש")} subheading=${this.context?.site.name??""} @close=${()=>this.dialog=null}>
          ${r}${h}${d}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||o} @click=${()=>this.run(async()=>{const l=await bs(this.context.site.id,{name:this.formName.trim()});z(`/explore/buildings/${l.id}/floors`)})}>${t("הוסף מבנה")}</sw-button>
        </sw-dialog>`}}moveTargets(s){return Es(this.context?.site.buildings,s.id)}openMove(s,e){const o=this.moveTargets(e)[0];this.error="",this.dialog={kind:"move",floor:s,target:o?.id??"",preview:null,ack:!1},o&&this.loadMove(s,e,o.id)}async loadMove(s,e,o){const r=this.dialog;if(r?.kind==="move"){this.dialog={...r,target:o,preview:null,ack:!1};try{const i=this.moveTargets(e).find(l=>l.id===o),h=await Ss(s.id,o,{floorName:s.name,floorLevel:s.level,fromId:e.id,fromName:e.name,toName:i?.name??""}),d=this.dialog;d?.kind==="move"&&d.target===o&&(this.dialog={...d,preview:h})}catch(i){this.error=B(i)}}}async doMove(s,e){if(!(!s.preview||!V(s.preview,s.ack).canMove||this.busy)){this.busy=!0,this.error="";try{await As(s.floor.id,s.target,s.preview.digest),this.dialog=null,this.selected===s.floor.id&&(this.selected=null),await this.reload(),z(`/explore/buildings/${s.target}/floors`)}catch(o){this.error=B(o),o instanceof W&&o.code==="preview_stale"&&this.loadMove(s.floor,e,s.target)}finally{this.busy=!1}}}renderMove(s,e,o){const r=this.moveTargets(e),i=s.preview,h=V(i,s.ack),d=p=>{if(!i)return"";const{shown:_,more:n}=Rs(i,p);return`${_.map(g=>g.name).join(", ")}${n?` ${t("ועוד {n}",{n:k(n)})}`:""}`},l=i?.moves_with,b=i?.warnings.find(p=>p.code==="level_clash"),$=i?.blockers.find(p=>p.code==="shared_room"),x=this.error?a`<div class="err" role="alert">${this.error}</div>`:m;return a`<sw-dialog open heading=${t("העברת קומה לבניין אחר")} subheading=${`${s.floor.name} · ${e.name}`} data-floor-move @close=${()=>this.dialog=null}>
      <sw-dropdown tall block icon="building" label=${t("לאיזה בניין")} data-floor-move-target .items=${r.map(p=>({id:p.id,label:p.name}))} .value=${s.target}
        @change=${p=>{p.stopPropagation(),p.detail.id&&p.detail.id!==s.target&&this.loadMove(s.floor,e,p.detail.id)}}></sw-dropdown>
      ${i&&l?a`<div class="mv" data-floor-move-preview>
            ${$?a`<div class="ln block" data-floor-move-blocked><b>${t("אי אפשר להעביר: חדר משותף מחבר את הקומה לקומה שתישאר בבניין אחר")}</b><span>${$.items.map(p=>String(p.name??"")).join(", ")} · ${t("בטלו קודם את השיתוף בעורך התוכנית.")}</span></div>`:m}
            ${i.people.loses?a`<div class="ln lose" data-floor-move-loses=${i.people.loses}><b>${t("{n} אנשים יאבדו גישה לקומה",{n:k(i.people.loses)})}</b><span>${d("loses")}</span>
                  <span>${t("כדי שאיש לא יישאר בלי גישה, תנו להם קודם הרשאה לבניין {name}.",{name:i.to_building.name})}</span></div>`:a`<div class="ln" data-floor-move-loses="0"><b>${t("אף אחד לא יאבד גישה לקומה")}</b></div>`}
            ${i.people.gains?a`<div class="ln" data-floor-move-gains=${i.people.gains}><b>${t("{n} אנשים יקבלו גישה לקומה",{n:k(i.people.gains)})}</b><span>${d("gains")}</span></div>`:m}
            ${i.people.changes?a`<div class="ln" data-floor-move-changes=${i.people.changes}><b>${t("ל־{n} אנשים ישתנו ההרשאות בקומה",{n:k(i.people.changes)})}</b><span>${d("changes")}</span></div>`:m}
            <div class="ln"><b>${t("עובר יחד עם הקומה")}</b><span>${t("{plans} תוכניות · {anchors} פריטים במפה, מהם {cameras} מצלמות · {bindings} הרשאות לקומה · {areas} אזורים ממופים · {records} רשומות",{plans:k(l.plans),anchors:k(l.anchors),cameras:k(l.cameras),bindings:k(l.floor_bindings),areas:k(l.areas),records:k(Hs(i))})}</span></div>
            ${b?a`<div class="ln" data-floor-move-clash><b>${t("בבניין {name} כבר יש קומה באותו מפלס",{name:i.to_building.name})}</b><span>${b.items.map(p=>String(p.name??"")).join(", ")} · ${t("זה מותר.")}</span></div>`:m}
            ${h.needsAck&&!$?a`<sw-toggle class="ack" data-floor-move-ack .checked=${s.ack} label=${t("אני מבין ש־{n} אנשים יאבדו גישה",{n:k(i.people.loses)})}
                @change=${p=>{p.stopPropagation(),this.dialog={...s,ack:p.detail.checked}}}></sw-toggle>`:m}
          </div>`:this.error?m:a`<div class="mv"><span>${t("בודק מי יושפע…")}</span></div>`}
      ${x}${o?a`<div class="err">${t("נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.")}</div>`:m}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>${t("ביטול")}</sw-button>
      <sw-button slot="footer" variant=${i?.people.loses?"danger":"primary"} icon="building" data-floor-move-confirm ?disabled=${!h.canMove||this.busy||o} @click=${()=>void this.doMove(s,e)}>${t("העבר את הקומה")}</sw-button>
    </sw-dialog>`}render(){if(!this.tree)return a`<sw-page heading=${t("קומות")}><sw-state-panel icon="floor" state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const s=this.context;if(!s)return a`<sw-page heading=${t("קומות")} subheading=${t("אין עדיין אתרים ומבנים")}>
        <sw-state-panel icon="floor" state="empty" heading=${t("עוד אין מבנים")} hint=${t("צור אתר ומבנה כדי להוסיף קומות ותוכניות.")}>
          <div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>z("/explore/sites")}>${t("לאתרים")}</sw-button></div>
        </sw-state-panel>
      </sw-page>`;const{site:e}=s,o=this.demoN()?C(this.demoN(),s.building,O().params.get("xsnames")==="long"):s.building,r=o.floors??[],i=r.find(l=>l.id===this.selected)??r[0]??null,h=r.reduce((l,b)=>l+b.camera_count,0),d=this.tree;return a`
      <sw-page heading=${o.name} subheading=${`${e.address||e.name} · ${t("{n} קומות",{n:r.length})}${d.source==="demo"?t(" · נתוני הדגמה"):""}`} crumbs=${`${t("אתרים")} | ${e.name} | ${o.name}`}>
        ${this.sectionBeside()?m:a`<div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>`}
        <div class="tabsrow"><sw-tabs .items=${[{id:"floors",label:t("קומות"),count:r.length},{id:"cameras",label:t("מצלמות"),count:h},{id:"details",label:t("פרטים")}]} .active=${this.tab} @change=${l=>this.tab=l.detail.id}></sw-tabs>
          ${this.phone.matches&&this.tab==="floors"&&this.xsEff().phone_place==="sheet"&&r.length?a`<sw-button class="xsbtn" size="sm" variant="ghost" data-xs-sheet-btn @click=${()=>this.sheetOpen=!0}>${D("sectionOpenBtn")}</sw-button>`:m}
        </div>
        ${this.tab==="floors"?this.renderFloorsTab(r,i,d.source==="demo"):this.tab==="cameras"?a`<div class="cams">${r.map(l=>a`<sw-card heading=${I(l.name)} subheading=${t("{n} מצלמות",{n:l.camera_count})} interactive @click=${()=>z(`/explore/floors/${l.id}`)}></sw-card>`)}</div>`:a`<sw-card heading=${t("פרטי המבנה")}>
                <dl>
                  <dt>${t("אתר")}</dt><dd>${e.name}</dd>
                  <dt>${t("כתובת")}</dt><dd>${e.address||"—"}</dd>
                  <dt>${t("אזור זמן")}</dt><dd><span class="ltr">${e.timezone}</span></dd>
                  <dt>${t("קומות")}</dt><dd>${r.length} · ${t("{n} עם תוכנית מפורסמת",{n:r.filter(l=>l.has_plan).length})}</dd>
                  <dt>${t("קשרים בין קומות")}</dt><dd>${t('מדרגות ומעלית בין קומות מוגדרות בעורך התוכנית ("מחבר אל"); הקשרים שפורסמו מופיעים בלשונית הקומות')}</dd>
                </dl>
              </sw-card>`}
        ${this.renderDialog(o)}
        ${this.renderLights()}
      </sw-page>
    `}};f.styles=[Ps,_s`
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
    /* MULTI-BUILDING-SAFETY-2500: the floor's building in the edit dialog, and the move preview */
    .moverow {
      display: flex;
      gap: var(--sw-s-3);
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-block-start: var(--sw-s-1);
      padding-block-start: var(--sw-s-3);
      border-block-start: thin solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .mv {
      display: grid;
      gap: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      margin-block-start: var(--sw-s-2);
    }
    .mv .ln {
      display: grid;
      gap: calc(var(--sw-s-1) / 2);
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
    }
    .mv .ln b {
      color: var(--sw-heading);
    }
    .mv .ln span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .mv .ln.lose,
    .mv .ln.block {
      background: var(--sw-danger-soft);
    }
    .mv .ln.lose b,
    .mv .ln.block b {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .mv .ack {
      display: block;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-danger-text);
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
  `];u([zs()],f.prototype,"buildingId",2);u([w()],f.prototype,"tree",2);u([w()],f.prototype,"selected",2);u([w()],f.prototype,"tab",2);u([w()],f.prototype,"dialog",2);u([w()],f.prototype,"busy",2);u([w()],f.prototype,"error",2);u([w()],f.prototype,"formName",2);u([w()],f.prototype,"formLevel",2);u([w()],f.prototype,"isos",2);u([w()],f.prototype,"xsData",2);u([w()],f.prototype,"sheetOpen",2);u([w()],f.prototype,"hoverId",2);u([w()],f.prototype,"lightsOf",2);u([w()],f.prototype,"multiOn",2);u([w()],f.prototype,"linkDocs",2);u([w()],f.prototype,"rowBoxes",2);u([w()],f.prototype,"boxesHeight",2);f=u([Ds("explore-floors")],f);export{f as ExploreFloors};
