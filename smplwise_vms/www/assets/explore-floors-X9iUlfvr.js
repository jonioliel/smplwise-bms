import{a as J,aX as K,i as b,l as H,bf as S,A as p,w as F,q as L,e as a,bg as Q,bh as ss,bi as E,aY as es,bj as z,bk as T,bl as C,bm as ts,bn as is,bo as os,bp as R,b2 as _,bq as as,br as k,bs as rs,bt as ns,bu as A,bv as ls,bw as ds,bx as cs,by as hs,bz as ps,bA as us,bB as fs,bC as ws,aZ as gs,Y as j,j as ms,b1 as bs,bD as vs,bE as xs,bF as $s,bG as ks,bH as ys,E as _s,F as zs,G as w,H as Ds}from"./index-BbQM-cPX.js";import{o as q}from"./architect-request-dialog-Cue3ca_X.js";import"./sw-floor-iso-5nLqIp6z.js";import{g as Os}from"./geometry-fkBTxFr2.js";import{k as Fs,b as Ls,i as Is,a as Bs}from"./scene-builder-CCeqJPRq.js";import{f as X}from"./connector-targets-Cw_oqhYV.js";import{f as Ns,D as Es}from"./shared-space-BTa6F2DE.js";import"./sw-logo-art-Va6y_cIM.js";import"./material-resolve-Wx1HTW0e.js";import"./zones-5tiOKOEp.js";var Ps=Object.defineProperty,Ms=Object.getOwnPropertyDescriptor,u=(s,e,t,o)=>{for(var n=o>1?void 0:o?Ms(e,t):e,c=s.length-1,d;c>=0;c--)(d=s[c])&&(n=(o?d(e,t,n):d(n))||n);return o&&n&&Ps(e,t,n),n};let h=class extends J{constructor(){super(...arguments),this.phone=new K(this),this.buildingId="bld-a",this.tree=null,this.selected=null,this.tab="floors",this.dialog=null,this.busy=!1,this.error="",this.formName="",this.formLevel=0,this.isos=new Map,this.isoPending=new Set,this.xsData=null,this.sheetOpen=!1,this.hoverId=null,this.lightsOf=null,this.multiOn=!1,this.linkDocs=new Map,this.rowBoxes=null,this.boxesHeight=0,this.cardsEl=null,this.homeRouteDone="",this.lightsAllowed=s=>s.nodata||s.lights===null?!1:!b()||this.xsData?.demo?!0:H("devices.read")&&S(s)!==null}pruned(){const s=(this.tree?.sites??[]).flatMap(e=>(e.buildings??[]).flatMap(t=>(t.floors??[]).map(o=>o.published_version_id))).filter(e=>!!e);return Fs(this.isos,s)}isoFor(s){const e=s.published_version_id;return!e||this.tree?.source!=="api"?null:this.isos.has(e)?this.isos.get(e)??null:(this.isoPending.has(e)||(this.isoPending.add(e),Os(e).then(t=>{const o=Ls({doc:t.doc,width:s.plan_width_px||t.doc.dimensions.width_px,height:s.plan_height_px||t.doc.dimensions.height_px,anchors:[],entityStates:{},circuitStates:{},layers:{objects:!1,cameras:!1,entities:!1,zones:!1}});this.isos=this.pruned().set(e,o.parts.some(n=>n.kind==="wall")?Is(o):null),this.linkDocs=new Map(this.linkDocs).set(e,{floorId:s.id,connectors:t.doc.connectors,levels:t.doc.levels,floorHeightM:Ns(t.doc)})}).catch(()=>{this.isos=this.pruned().set(e,null)}).finally(()=>this.isoPending.delete(e))),null)}renderLinks(s){const e=s.map(i=>i.published_version_id?this.linkDocs.get(i.published_version_id):void 0).filter(i=>!!i),t=X(e,s.map(i=>({id:i.id,name:i.name})));if(!t.length)return p;const o=[...s].sort((i,f)=>i.level-f.level||i.sort_order-f.sort_order),n=34/3,c=i=>(i.published_version_id?this.linkDocs.get(i.published_version_id)?.floorHeightM:void 0)??Es,d=new Map;let l=0;for(const i of o)d.set(i.id,l),l+=c(i)*n;const v=o.length?d.get(o[o.length-1].id):0,x=i=>v-(d.get(i)??0),m=(i,f)=>{const g=Bs(f[0],f[1]);return{x:g.x,y:g.y+x(i)}},$=i=>[[0,0],[1,0],[1,1],[0,1]].map(([f,g])=>m(i,[f,g])).map(f=>`${f.x.toFixed(1)},${f.y.toFixed(1)}`).join(" "),y=72+v;return a`<sw-card heading="קשרים בין קומות" subheading="מדרגות ומעליות שמקשרות קומות (מבנה מפורסם)" data-floor-links>
      <div class="links">
        <svg class="stack" viewBox=${`0 0 120 ${y}`} aria-hidden="true">
          ${o.map(i=>F`<g data-stack-floor=${i.id}><polygon class="plate" points=${$(i.id)} /><text class="pname" x="2" y=${(x(i.id)+38).toFixed(1)}>${i.name}</text></g>`)}
          ${t.map(i=>{const f=m(i.a.floorId,i.a.at),g=i.b?m(i.b.floorId,i.b.at):null;return F`<g data-stack-link=${i.id}>
              ${g?F`<line class="lk" x1=${f.x} y1=${f.y} x2=${g.x} y2=${g.y} />`:p}
              <circle class="lkdot" cx=${f.x} cy=${f.y} r="2.2" />${g?F`<circle class="lkdot" cx=${g.x} cy=${g.y} r="2.2" />`:p}
            </g>`})}
        </svg>
        <ul class="lklist">
          ${t.map(i=>a`<li data-link-row=${i.id}>${i.kindLabel}: ${L(i.a.label)} ↔ ${L(i.b?.label??i.farLabel)}${i.b?"":" (התאום עדיין לא פורסם)"}</li>`)}
        </ul>
      </div>
    </sw-card>`}connectedCallback(){super.connectedCallback(),this.reload(),this.stopXs=Q(()=>this.requestUpdate()),this.stopFire=ss(()=>this.requestUpdate()),E().then(s=>this.xsData=s),es().then(s=>this.multiOn=s)}disconnectedCallback(){this.cardsObs?.disconnect(),this.cardsObs=void 0,this.cardsEl=null,this.stopXs?.(),this.stopFire?.(),super.disconnectedCallback()}updated(s){s.has("buildingId")&&s.get("buildingId")!==void 0&&(this.selected=null),this.watchCards(),this.measureCards(),this.openHomeFromRoute()}openHomeFromRoute(){const s=z().params.get("ha");if(!s||s===this.homeRouteDone||!this.tree)return;const e=this.context,o=(e&&this.demoN()?T(this.demoN(),e.building):e?.building)?.floors?.find(n=>n.id===s);this.homeRouteDone=s,o&&!this.dialog&&this.openDialog({kind:"home",floor:o})}watchCards(){const s=this.renderRoot.querySelector(".cards[data-align]");if(s!==this.cardsEl){if(this.cardsObs?.disconnect(),this.cardsEl=s,!s){this.rowBoxes&&(this.rowBoxes=null);return}this.cardsObs??=new ResizeObserver(()=>this.measureCards()),this.cardsObs.observe(s),s.querySelectorAll("[data-floor-card]").forEach(e=>this.cardsObs.observe(e))}}measureCards(){const s=this.cardsEl;if(!s)return;const e=s.getBoundingClientRect(),t=[...s.querySelectorAll("[data-floor-card]")].map(c=>{const d=c.getBoundingClientRect();return{id:c.dataset.floorCard,top:Math.round(d.top-e.top),height:Math.round(d.height)}}),o=Math.round(e.height);this.rowBoxes&&this.rowBoxes.length===t.length&&this.rowBoxes.every((c,d)=>c.id===t[d].id&&c.top===t[d].top&&c.height===t[d].height)||(this.rowBoxes=t),o!==this.boxesHeight&&(this.boxesHeight=o)}xsEff(){return b()?C():ts(C(),z().params)}demoN(){if(b())return 0;const s=Number(z().params.get("xsdemo"));return Number.isInteger(s)&&s>=1&&s<=40?s:0}sectionBeside(){return!this.phone.matches&&this.xsEff().desktop_place!=="off"}demoData(){return b()?null:z().params.get("xsdata")}signalsFor(s){return!b()||this.xsData?.demo?is([...s].sort((e,t)=>t.level-e.level||t.sort_order-e.sort_order),this.demoData()):os(s,this.xsData?.tree??null,this.xsData?.people??null,R(this.xsData,this.context?.site),{switches:this.xsEff().syn_switches})}pickFloor(s,e=!1){this.selected===s||e&&this.xsEff().click==="open"?_(`/explore/floors/${s}`):this.selected=s}linksFor(s){const e=s.map(t=>t.published_version_id?this.linkDocs.get(t.published_version_id):void 0).filter(t=>!!t);return X(e,s.map(t=>({id:t.id,name:t.name})))}renderLights(){const s=this.lightsOf,e=!b()||!!this.xsData?.demo,t=s&&!e?S(s):null;return a`<devices-tiles-panel kind="lights" data-floor-lights=${s?.id??""} ?open=${!!s} pairedMaster
      scope=${t?.scope??"building"} scopeId=${t?.scopeId??""} scopeName=${s?.name??""} .areaFilter=${t?t.areaIds:null} switches=${this.xsEff().syn_switches}
      .building=${t?as(this.multiOn,this.context?.site.buildings?.length??0,this.context?.building.id):""}
      headingText=${s?k("floorLightsTitle",{name:s.name}):""}
      @panel-close=${()=>this.lightsOf=null} @panel-changed=${()=>void E().then(o=>this.xsData=o)}></devices-tiles-panel>`}renderFloorsTab(s,e,t){const o=this.tree,n=this.xsEff(),c=this.phone.matches,d=this.signalsFor(s),l=new Map(d.map(r=>[r.id,r])),v=rs(d,n),x=this.linksFor(s),m=x.length?ns(x):t||!b()?[{kind:"stairs",label:"מדרגות",floors:d.map(r=>r.id)}]:[],$=z().params.get("firemock");n.fire_ui?A($,d):A(null);const y=n.fire_ui?ls().floors:null,i=c?ds(n.phone_place,s.length):"none",{step:f,cols:g}=cs(s.length,c),P=n.many==="near"?hs(s,e?.id??null,2):s,G=ps(n.links,s.length,window.innerHeight)||c,U=c&&i==="side",I=this.sectionBeside()&&g===1&&P.length===s.length,W=!this.phone.restricted("structure")&&(!b()||H("site.content.configure")),Y=P.map(r=>{const D=a`<button class="floor ${e?.id===r.id?"on":""} ${this.hoverId===r.id?"hl":""}" data-floor-card=${r.id} @click=${()=>this.pickFloor(r.id)} @pointerenter=${N=>N.pointerType==="mouse"&&(this.hoverId=r.id)} @pointerleave=${N=>N.pointerType==="mouse"&&(this.hoverId=null)} aria-pressed=${e?.id===r.id}>
        <div class="txt">
          <div class="title">${L(r.name)}</div>
          <div class="counts">${r.camera_count} מצלמות${r.shared_camera_count?a` <span class="shared" data-floor-shared=${r.id}>(+${r.shared_camera_count} משותפות)</span>`:p} · ${r.anchor_count} פריטים במפה · מפלס ${us(r.level)}${r.has_plan?"":" · אין תוכנית עדיין"}${r.draft_version_id?" · טיוטה ממתינה לפרסום":""}</div>
        </div>
        <sw-floor-iso data-floor-iso=${r.id} .rooms=${o.source==="demo"?fs(r.id):[]} .iso=${this.isoFor(r)} ?selected=${e?.id===r.id} ?empty=${!r.has_plan} width=${128}></sw-floor-iso>
        <span class="chev"><sw-icon name="chevron" size=${16}></sw-icon></span>
      </button>`,O=l.get(r.id);return U&&O?a`<div class="frow">${D}${ws(O,n,e?.id===r.id,()=>this.pickFloor(r.id),v)}</div>`:D}),V=a`<div class="actions" data-floor-actions>
      ${this.phone.restricted("structure")?p:a`<div>
            <sw-button icon="plus" @click=${()=>this.openDialog({kind:"floor"})}>קומה חדשה</sw-button>
            <sw-button variant="ghost" icon="building" @click=${()=>this.openDialog({kind:"building"})}>מבנה חדש</sw-button>
          </div>`}
      ${e?a`<div>
            ${this.phone.restricted("structure")?p:a`<sw-button variant="ghost" icon="edit" @click=${()=>this.openDialog({kind:"rename",floor:e})}>עריכה</sw-button>
                <sw-button variant="ghost" icon="link" data-home-link-btn @click=${()=>this.openDialog({kind:"home",floor:e})}>${k("homeLinkBtn")}</sw-button>
                <sw-button variant="ghost" icon="trash" @click=${()=>this.openDialog({kind:"delete",floor:e,force:!1})}>מחיקה</sw-button>
                <sw-button icon="upload" @click=${()=>_(`/explore/floors/${e.id}/import`)}>${e.has_plan?"תוכנית חדשה":"העלאת תוכנית"}</sw-button>
                <sw-button icon="sparkle" data-plan-wizard @click=${()=>_(`/explore/floors/${e.id}/wizard`)}>תוכנית מתמונה</sw-button>`}
            ${e.has_plan||e.draft_version_id?p:a`<sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>q()}>בקשה לאדריכל</sw-button>`}
            ${l.get(e.id)&&v.light&&this.lightsAllowed(l.get(e.id))?a`<sw-button variant="ghost" icon="light" data-floor-lights-open=${e.id} @click=${()=>this.lightsOf=l.get(e.id)}>${k("floorLightsBtn")}</sw-button>`:p}
            <sw-button variant="primary" icon="map" @click=${()=>_(`/explore/floors/${e.id}`)}>פתח את ${e.name}</sw-button>
          </div>`:p}
    </div>`,M=a`<sw-xsection .floors=${d} .links=${m} .opts=${n} .fire=${y} selectedId=${e?.id??""} hoverId=${this.hoverId??""}
      .rowBoxes=${I?this.rowBoxes:null} boxesHeight=${I?this.boxesHeight:0} ?canLink=${W} .lightsOk=${this.lightsAllowed}
      @xs-lights=${r=>{this.lightsOf=l.get(r.detail.id)??null}}
      @xs-link=${r=>{const D=s.find(O=>O.id===r.detail.id);D&&this.openDialog({kind:"home",floor:D})}}
      @xs-pick=${r=>this.pickFloor(r.detail.id,!0)} @xs-hover=${r=>this.hoverId=r.detail.id}></sw-xsection>`,B=this.sectionBeside(),Z=a`<div class="list" data-floor-list data-step=${f} data-cols=${g} data-many=${n.many}>
      ${s.length?p:a`<div class="empty">${this.phone.restricted("structure")?"למבנה הזה אין עדיין קומות. הוספת קומות ותוכניות זמינה במחשב.":"למבנה הזה אין עדיין קומות. הוסף קומה, ואז העלה תוכנית (PDF או תמונה)."}<div style="margin-block-start:10px"><sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>q()}>בקשה לאדריכל</sw-button></div></div>`}
      ${c&&i==="card"?a`<sw-xs-compact .floors=${d} .opts=${n} selectedId=${e?.id??""} @xs-open-sheet=${()=>this.sheetOpen=!0}></sw-xs-compact>`:p}
      <div class="cards" data-step=${f} data-cols=${g} ?data-align=${I}>${Y}</div>
      ${G?this.renderLinksFolded(x):this.renderLinks(s)}
      ${this.error&&!this.dialog?a`<div class="err" role="alert">${this.error}</div>`:p}
      ${V}
    </div>`;return a`<div class="fl ${B?`beside ${n.desktop_place}`:""}" data-xs-place=${c?i:B?n.desktop_place:"off"}>
      ${Z}
      ${B?a`<aside class="xscol" data-xs-col>${M}</aside>`:p}
      ${this.sheetOpen&&c&&s.length?a`<sw-dialog open heading=${k("sectionSheetTitle")} data-xs-sheet @close=${()=>this.sheetOpen=!1}>
            <div class="xssheet">${M}</div>
            <sw-button slot="footer" variant="ghost" @click=${()=>this.sheetOpen=!1}>${k("close")}</sw-button>
          </sw-dialog>`:p}
    </div>`}renderLinksFolded(s){return s.length?a`<div class="linkrow" data-floor-links-folded><sw-icon name="layers" size=${14}></sw-icon><span class="lt">${k("linksTitle")}</span>
      <span class="ll">${s.map(e=>`${e.kindLabel}: ${e.a.label} ↔ ${e.b?.label??e.farLabel}${e.b?"":` ${k("linksPending")}`}`).join(" · ")}</span></div>`:p}async reload(){try{this.tree=await gs(),this.error=""}catch(s){this.error=j(s)}}get context(){if(!this.tree)return null;for(const t of this.tree.sites)for(const o of t.buildings??[])if(o.id===this.buildingId)return{site:t,building:o};const s=this.tree.sites[0],e=s?.buildings?.[0];return s&&e?{site:s,building:e}:null}async run(s){this.busy=!0,this.error="";try{await s(),this.dialog=null,await this.reload()}catch(e){e instanceof ms&&e.code==="has_anchors"&&this.dialog?.kind==="delete"?(this.dialog={...this.dialog,force:!0},this.error=`${e.body.user_message} (${e.body.details.anchors??""} פריטים)`):this.error=j(e)}finally{this.busy=!1}}openDialog(s){this.phone.restricted("structure")||(this.error="",this.formName=s?.kind==="rename"?s.floor.name:"",this.formLevel=s?.kind==="rename"?s.floor.level:0,this.dialog=s)}renderDialog(s){const e=this.dialog;if(!e||this.phone.restricted("structure"))return p;const t=this.tree?.source==="demo",o=a`<sw-field label="שם"><input .value=${this.formName} @input=${l=>this.formName=l.target.value} placeholder="למשל: קומה 1" autofocus /></sw-field>`,n=a`<sw-field label="מפלס (0 = קרקע, שלילי = מרתף)" hint="קובע את סדר התצוגה בין הקומות"><input type="number" data-ltr .value=${String(this.formLevel)} @input=${l=>this.formLevel=Number(l.target.value)} /></sw-field>`,c=this.error?a`<div class="err" role="alert">${this.error}</div>`:p,d=t?a`<div class="err">נתוני הדגמה: אין שרת מחובר, השינוי לא יישמר.</div>`:p;switch(e.kind){case"floor":return a`<sw-dialog open heading="קומה חדשה" subheading=${`${s.name}`} @close=${()=>this.dialog=null}>
          ${o}${n}${c}${d}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||t} @click=${()=>this.run(async()=>{const l=await ks(s.id,{name:this.formName.trim(),level:this.formLevel});this.selected=l.id})}>הוסף קומה</sw-button>
        </sw-dialog>`;case"rename":return a`<sw-dialog open heading="עריכת קומה" subheading=${e.floor.name} @close=${()=>this.dialog=null}>
          ${o}${n}${c}${d}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||t} @click=${()=>this.run(()=>$s(e.floor.id,{name:this.formName.trim(),level:this.formLevel}))}>שמירה</sw-button>
        </sw-dialog>`;case"delete":return a`<sw-dialog open heading="מחיקת קומה" subheading=${e.floor.name} @close=${()=>this.dialog=null}>
          <div style="font-size:var(--sw-fs-sm)">${e.force?"על הקומה מוצבים פריטים. מחיקה תסיר אותם מהמפה (ההיסטוריה נשמרת באודיט). להמשיך?":"הקומה תוסר מהמערכת. תוכניות שפורסמו נשמרות בארכיון; מצלמות והקלטות ב־NVR אינן נמחקות."}</div>
          ${c}${d}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="danger" ?disabled=${this.busy||t} @click=${()=>this.run(async()=>{await xs(e.floor.id,e.force),this.selected===e.floor.id&&(this.selected=null)})}>${e.force?"מחק כולל הפריטים":"מחק קומה"}</sw-button>
        </sw-dialog>`;case"home":{const l=s.floors??[],v=t||!b()?vs(l,this.demoData()==="none"?"none":this.demoData()==="sparse"?"sparse":"ha"):this.xsData?.tree??null,x=new Map((this.tree?.sites??[]).flatMap(m=>(m.buildings??[]).flatMap($=>($.floors??[]).map(y=>[y.id,(m.buildings?.length??0)>1?`${$.name} · ${y.name}`:y.name]))));return a`<sw-floor-home-link .floor=${e.floor} .floors=${l} .floorNames=${x} .tree=${v} .links=${this.xsData?.links??null}
          ?singleBuilding=${R(this.xsData,this.context?.site).singleBuilding} ?demo=${t||!b()}
          @close=${()=>this.dialog=null}
          @saved=${m=>{this.dialog=null,this.xsData&&(this.xsData={...this.xsData,links:m.detail.links}),E().then($=>this.xsData=$)}}></sw-floor-home-link>`}case"building":return a`<sw-dialog open heading="מבנה חדש" subheading=${this.context?.site.name??""} @close=${()=>this.dialog=null}>
          ${o}${c}${d}
          <sw-button slot="footer" variant="ghost" @click=${()=>this.dialog=null}>ביטול</sw-button>
          <sw-button slot="footer" variant="primary" ?disabled=${!this.formName.trim()||this.busy||t} @click=${()=>this.run(async()=>{const l=await bs(this.context.site.id,{name:this.formName.trim()});_(`/explore/buildings/${l.id}/floors`)})}>הוסף מבנה</sw-button>
        </sw-dialog>`}}render(){if(!this.tree)return a`<sw-page heading="קומות"><sw-state-panel icon="floor" state=${this.error?"error":"loading"} hint=${this.error}></sw-state-panel></sw-page>`;const s=this.context;if(!s)return a`<sw-page heading="קומות" subheading="אין עדיין אתרים ומבנים">
        <sw-state-panel icon="floor" state="empty" heading="עוד אין מבנים" hint="צור אתר ומבנה כדי להוסיף קומות ותוכניות.">
          <div style="margin-block-start:10px"><sw-button variant="primary" icon="plus" @click=${()=>_("/explore/sites")}>לאתרים</sw-button></div>
        </sw-state-panel>
      </sw-page>`;const{site:e}=s,t=this.demoN()?T(this.demoN(),s.building,z().params.get("xsnames")==="long"):s.building,o=t.floors??[],n=o.find(l=>l.id===this.selected)??o[0]??null,c=o.reduce((l,v)=>l+v.camera_count,0),d=this.tree;return a`
      <sw-page heading=${t.name} subheading=${`${e.address||e.name} · ${o.length} קומות${d.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${e.name} | ${t.name}`}>
        ${this.sectionBeside()?p:a`<div slot="actions" class="pic"><sw-scene kind="building"></sw-scene></div>`}
        <div class="tabsrow"><sw-tabs .items=${[{id:"floors",label:"קומות",count:o.length},{id:"cameras",label:"מצלמות",count:c},{id:"details",label:"פרטים"}]} .active=${this.tab} @change=${l=>this.tab=l.detail.id}></sw-tabs>
          ${this.phone.matches&&this.tab==="floors"&&this.xsEff().phone_place==="sheet"&&o.length?a`<sw-button class="xsbtn" size="sm" variant="ghost" data-xs-sheet-btn @click=${()=>this.sheetOpen=!0}>${k("sectionOpenBtn")}</sw-button>`:p}
        </div>
        ${this.tab==="floors"?this.renderFloorsTab(o,n,d.source==="demo"):this.tab==="cameras"?a`<div class="cams">${o.map(l=>a`<sw-card heading=${L(l.name)} subheading="${l.camera_count} מצלמות" interactive @click=${()=>_(`/explore/floors/${l.id}`)}></sw-card>`)}</div>`:a`<sw-card heading="פרטי המבנה">
                <dl>
                  <dt>אתר</dt><dd>${e.name}</dd>
                  <dt>כתובת</dt><dd>${e.address||"—"}</dd>
                  <dt>אזור זמן</dt><dd><span class="ltr">${e.timezone}</span></dd>
                  <dt>קומות</dt><dd>${o.length} · ${o.filter(l=>l.has_plan).length} עם תוכנית מפורסמת</dd>
                  <dt>קשרים בין קומות</dt><dd>מדרגות ומעלית בין קומות מוגדרות בעורך התוכנית ("מחבר אל"); הקשרים שפורסמו מופיעים בלשונית הקומות</dd>
                </dl>
              </sw-card>`}
        ${this.renderDialog(t)}
        ${this.renderLights()}
      </sw-page>
    `}};h.styles=[ys,_s`
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
  `];u([zs()],h.prototype,"buildingId",2);u([w()],h.prototype,"tree",2);u([w()],h.prototype,"selected",2);u([w()],h.prototype,"tab",2);u([w()],h.prototype,"dialog",2);u([w()],h.prototype,"busy",2);u([w()],h.prototype,"error",2);u([w()],h.prototype,"formName",2);u([w()],h.prototype,"formLevel",2);u([w()],h.prototype,"isos",2);u([w()],h.prototype,"xsData",2);u([w()],h.prototype,"sheetOpen",2);u([w()],h.prototype,"hoverId",2);u([w()],h.prototype,"lightsOf",2);u([w()],h.prototype,"multiOn",2);u([w()],h.prototype,"linkDocs",2);u([w()],h.prototype,"rowBoxes",2);u([w()],h.prototype,"boxesHeight",2);h=u([Ds("explore-floors")],h);export{h as ExploreFloors};
//# sourceMappingURL=explore-floors-X9iUlfvr.js.map
