import{a as F,af as L,i as $,a_ as I,T as g,a$ as T,aw as j,au as P,j as z,ak as k,b0 as O,b1 as B,A as p,e as a,b2 as C,b3 as A,b4 as U,b5 as X,b6 as G,b7 as _,E as N,F as R,G as c,H as W}from"./index-BKxQRAkH.js";import{o as H}from"./architect-request-dialog-CANyH7ba.js";import"./sw-steps-BOAvn1A3.js";import{a as V,i as q}from"./geometry-dwbRoqf7.js";import{s as K}from"./candidates-CS7-ly_Q.js";import"./sw-logo-art-Va6y_cIM.js";var J=Object.defineProperty,Y=Object.getOwnPropertyDescriptor,d=(t,s,i,e)=>{for(var r=e>1?void 0:e?Y(s,i):s,f=t.length-1,m;f>=0;f--)(m=t[f])&&(r=(e?m(s,i,r):m(r))||r);return e&&r&&J(s,i,r),r};const M=["קובץ","עמוד","חיתוך וסיבוב","שם והערות","שמירה ופרסום"];function E(t,s){if(!(t instanceof z))return{code:"failed",text:g(t),retry:t instanceof TypeError};const i=t.body.details,e=r=>Array.isArray(i?.[r])?(i?.[r]).map(String).join(", "):"";switch(t.code){case"dxf_timeout":{const r=typeof i?.timeout_s=="number"?` (${i.timeout_s} שנ׳)`:"";return{code:t.code,text:s==="load"?`קריאת השרטוט לא הסתיימה בזמן${r}. נסה שוב.`:`הייבוא לא הסתיים בזמן${r}. נסה שוב, או מפה פחות שכבות (סמן "התעלם" לשכבות שאינן מבנה).`,retry:!0}}case"unknown_item":return{code:t.code,text:`פריט שנבחר לבלוק לא קיים בספרייה${e("items")?`: ${e("items")}`:""}. בחר פריט אחר (או "עצם כללי") ונסה שוב.`,retry:!1};case"unknown_layer":return{code:t.code,text:`שכבה במיפוי לא קיימת בקובץ${e("unknown")?`: ${e("unknown")}`:""}. המיפוי נטען מחדש מהשרטוט.`,retry:!1};case"no_layers":return{code:t.code,text:'יש למפות לפחות שכבה אחת (יעד שאינו "התעלם").',retry:!1};case"not_dxf":return{code:t.code,text:"הגרסה השמורה לא נוצרה מקובץ DXF, ולכן אין מה למפות.",retry:!1};case"dxf_unitless":return{code:t.code,text:'לקובץ אין יחידות: בחר יחידות בכרטיס "DXF · שכבות, יחידות וקנה מידה" לפני הייבוא.',retry:!1};default:return{code:t.code||"failed",text:g(t),retry:!!t.body.retryable}}}function D(t){return t>=1024*1024?`${(t/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(t/1024))} KB`}let l=class extends F{constructor(){super(...arguments),this.floorId="",this.step=0,this.tree=null,this.assets=[],this.asset=null,this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.notes="",this.version=null,this.preview=null,this.busy=!1,this.error="",this.dragOver=!1,this.dxf=null,this.dxfLayers=null,this.dxfUnits=null,this.dxfBusy=!1,this.previewBust=0,this.dxfEnt=null,this.dxfEntLoading=!1,this.layerMap={},this.blockMap={},this.importing=!1,this.importSecs=0,this.imported=null,this.dxfMapErr=null,this.dxfStale=!1,this.canStructure=null,this.mapAssetId="",this.entToken=0,this.importToken=0,this.startCrop=t=>{if(t.button!==0)return;const s=t.currentTarget,i=s.getBoundingClientRect(),e=n=>({x:Math.min(1,Math.max(0,(n.clientX-i.left)/i.width)),y:Math.min(1,Math.max(0,(n.clientY-i.top)/i.height))}),r=e(t);s.setPointerCapture(t.pointerId),t.preventDefault();const f=n=>{const v=e(n),w=Math.min(r.x,v.x),b=Math.min(r.y,v.y),h=Math.abs(v.x-r.x),u=Math.abs(v.y-r.y);h>.01&&u>.01&&(this.crop={x:+w.toFixed(4),y:+b.toFixed(4),w:+h.toFixed(4),h:+u.toFixed(4)})},m=()=>{s.removeEventListener("pointermove",f),s.removeEventListener("pointerup",m),s.removeEventListener("pointercancel",m),(this.crop.w<.02||this.crop.h<.02)&&(this.crop={x:0,y:0,w:1,h:1})};s.addEventListener("pointermove",f),s.addEventListener("pointerup",m),s.addEventListener("pointercancel",m)}}connectedCallback(){super.connectedCallback(),this.init()}async init(){try{this.tree=await L(),$()&&this.floorId&&(this.assets=(await I(this.floorId)).assets)}catch(t){this.error=g(t)}}get floor(){return this.tree&&this.floorId?T(this.tree,this.floorId):null}updated(t){if(t.has("asset")&&$()){const s=this.asset;s&&s.kind==="dxf"&&(!this.dxf||this.dxf.asset_id!==s.id)?this.loadDxf(s.id):(!s||s.kind!=="dxf")&&(this.dxf=null)}if((t.has("version")||t.has("asset"))&&$()){const s=this.asset,i=this.version;i&&s&&s.kind==="dxf"&&i.asset_id===s.id?(t.has("version")&&t.get("version")?.id!==i.id&&this.resetDxfMap(),(!this.dxfEnt||this.dxfEnt.asset_id!==s.id)&&this.loadDxfEntities(s.id),this.canStructure===null&&this.loadFloorRights()):(!i||!s||s.kind!=="dxf")&&(this.dxfEnt=null,this.resetDxfMap())}}disconnectedCallback(){super.disconnectedCallback(),this.stopImportTimer()}resetDxfMap(){this.importToken++,this.imported=null,this.dxfMapErr=null,this.dxfStale=!1}async loadFloorRights(){if(j("map.edit")){this.canStructure=!0;return}try{this.canStructure=(await P(this.floorId)).permissions.structure}catch{this.canStructure=!1}}async loadDxfEntities(t,s={}){const i=++this.entToken;this.dxfEntLoading=!0,this.dxfMapErr=null;try{const e=await V(t);if(i!==this.entToken||this.asset?.id!==t)return;const r=this.mapAssetId===e.asset_id,f=new Set(e.targets.map(h=>h.id)),m=new Set(e.catalog_choices.map(h=>h.id).filter(h=>h!==null)),n=new Set(s.layers??[]),v=new Set(s.items??[]),w=h=>{if(n.has(h))return"ignore";const u=this.layerMap[h];return r&&u!==void 0&&f.has(u)?u:void 0},b=(h,u)=>{if(!r||!(h in this.blockMap))return;const o=this.blockMap[h];return o===null?u===null?null:void 0:m.has(o)&&!v.has(o)?o:void 0};this.dxfEnt=e,this.mapAssetId=e.asset_id,this.layerMap=Object.fromEntries(e.layers.map(h=>[h.name,h.count?w(h.name)??h.suggested:"ignore"])),this.blockMap=Object.fromEntries(e.blocks.map(h=>{const u=b(h.name,h.suggested.catalog_id);return[h.name,u===void 0?h.suggested.catalog_id:u]})),this.imported=null}catch(e){i===this.entToken&&(this.dxfMapErr={...E(e,"load"),action:"load"})}finally{i===this.entToken&&(this.dxfEntLoading=!1)}}importBody(t){const s=Object.fromEntries(Object.entries(this.layerMap).filter(([,e])=>e!=="ignore")),i={};for(const e of t.blocks){const r=this.blockMap[e.name];typeof r=="string"&&r!==e.suggested.catalog_id&&(i[e.name]=r)}return{layer_map:s,block_map:i}}stopImportTimer(){this.importTimer!==void 0&&window.clearInterval(this.importTimer),this.importTimer=void 0}async importDxf(){const t=this.version,s=this.dxfEnt;if(!t||!s||this.importing)return;const i=this.importBody(s);if(!Object.keys(i.layer_map).length){this.dxfMapErr={code:"no_layers",text:'יש למפות לפחות שכבה אחת (יעד שאינו "התעלם").',retry:!1,action:"import"};return}const e=++this.importToken;this.importing=!0,this.importSecs=0,this.dxfMapErr=null,this.imported=null;const r=Date.now();this.importTimer=window.setInterval(()=>this.importSecs=Math.round((Date.now()-r)/1e3),1e3);try{const f=await q(t.id,i);e===this.importToken&&!this.dxfStale&&this.version?.id===t.id&&(this.imported=f)}catch(f){if(e!==this.importToken)return;const m=E(f,"import");if(this.dxfMapErr={...m,action:"import"},m.code==="unknown_layer"||m.code==="unknown_item"){const n=f instanceof z?f.body.details:{},v=w=>Array.isArray(w)?w.filter(b=>typeof b=="string"):[];this.dxfEnt=null,this.loadDxfEntities(s.asset_id,{layers:v(n?.unknown),items:v(n?.items)}).then(()=>{this.dxfMapErr||(this.dxfMapErr={...m,action:"import"})})}}finally{this.stopImportTimer(),this.importing=!1}}openEditorWithCandidates(){const t=this.version,s=this.imported;!t||!s||!this.canStructure||(K(t.id,s),k(`/explore/floors/${this.floorId}/edit`,{candidates:"dxf"}))}setLayerTarget(t,s){this.layerMap={...this.layerMap,[t]:s},this.imported=null,this.dxfMapErr?.action==="import"&&(this.dxfMapErr=null)}setBlockItem(t,s){this.blockMap={...this.blockMap,[t]:s},this.imported=null,this.dxfMapErr?.action==="import"&&(this.dxfMapErr=null)}async loadDxf(t){try{const s=await O(t);this.dxf=s,this.dxfLayers=s.options.layers,this.dxfUnits=s.options.units??(s.info?.units&&s.info.units!=="unitless"?s.info.units:null)}catch(s){this.error=g(s)}}toggleDxfLayer(t){const s=this.dxf?.info?.layers.filter(e=>e.drawable>0).map(e=>e.name)??[],i=this.dxfLayers??s;this.dxfLayers=i.includes(t)?i.filter(e=>e!==t):[...i,t]}async applyDxf(){if(this.dxf){this.dxfBusy=!0,this.error="";try{const t=this.dxf.info?.layers.filter(i=>i.drawable>0).map(i=>i.name)??[],s=this.dxfLayers&&this.dxfLayers.length!==t.length?this.dxfLayers:null;this.dxf=await B(this.dxf.asset_id,{layers:s,units:this.dxfUnits}),this.dxfLayers=this.dxf.options.layers,this.previewBust=Date.now(),this.version&&this.version.asset_id===this.dxf.asset_id&&(this.dxfStale=!0,this.importToken++,this.imported=null,this.loadDxfEntities(this.dxf.asset_id))}catch(t){this.error=g(t)}finally{this.dxfBusy=!1}}}renderDxf(){const t=this.dxf;if(!t||!t.info)return p;const s=t.info.layers.filter(n=>n.drawable>0).map(n=>n.name),i=this.dxfLayers??s,e=t.info.extent,r=Object.entries(t.render?.skipped??t.info.unsupported),f=t.render?.meters_per_px,m=t.render?.units&&t.render.units!=="unitless";return a`<sw-card heading="DXF · שכבות, יחידות וקנה מידה" subheading=${`${t.adapter.library} (${t.adapter.license}) · המקור נשמר כפי שהועלה; התצוגה נגזרת ממנו`} data-dxf>
      <div class="note">גרסה ${t.info.version} · יחידות בקובץ: <strong data-dxf-units>${t.info.units}</strong>${e?a` · היקף ${e.width.toFixed(0)} × ${e.height.toFixed(0)} יחידות`:p}${m&&e&&f?a` · כ־${(e.width*(f*t.render.px_per_unit)).toFixed(1)} × ${(e.height*(f*t.render.px_per_unit)).toFixed(1)} מ׳`:p}</div>
      <div class="note">ישויות: ${Object.entries(t.info.entity_counts).map(([n,v])=>`${n} ${v}`).join(" · ")}</div>
      ${r.length?a`<div class="err" data-dxf-partial>המרה חלקית: ${r.map(([n,v])=>`${v} × ${n}`).join(", ")} לא מצוירים (טקסטים, מילויים, מידות וגופים תלת־ממדיים אינם מומרים). הדבר יוצג גם על הגרסה.</div>`:a`<div class="note">כל הישויות בקובץ מצוירות.</div>`}
      <div class="note" style="margin-block-start:6px">שכבות (${i.length} מתוך ${s.length}):</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px 12px">${t.info.layers.map(n=>a`<label style="display:flex;gap:6px;align-items:center;font-size:var(--sw-fs-sm)"><input type="checkbox" data-dxf-layer=${n.name} .checked=${i.includes(n.name)} ?disabled=${n.drawable===0} @change=${()=>this.toggleDxfLayer(n.name)} /> <span class="ltr">${n.name}</span> <span class="note">(${n.drawable})</span></label>`)}</div>
      <div class="row" style="margin-block-start:8px;align-items:center;gap:8px">
        <sw-field label="יחידות השרטוט"><select data-dxf-units-select @change=${n=>this.dxfUnits=n.target.value||null}><option value="" ?selected=${!this.dxfUnits}>לפי הקובץ (${t.info.units})</option>${t.units_choices.map(n=>a`<option value=${n} ?selected=${this.dxfUnits===n}>${n}</option>`)}</select></sw-field>
        <sw-button size="sm" variant="primary" data-dxf-apply ?disabled=${this.dxfBusy||i.length===0} @click=${()=>this.applyDxf()}>החל ורנדר מחדש</sw-button>
      </div>
      ${t.render?a`<div class="note" style="margin-block-start:6px" data-dxf-render>רונדר: ${t.render.width}×${t.render.height} px · ${t.render.rendered} ישויות מ־${t.render.layers.length} שכבות${f?` · ${(f*100).toFixed(2)} ס״מ לפיקסל (מיחידות ${t.render.units}; ייכנס לגרסה כקנה מידה)`:" · קנה מידה לא ידוע: הקובץ ללא יחידות, בחר יחידות או כייל מאוחר יותר"}</div>`:p}
      <div class="note">DWG אינו נתמך (פורמט סגור) — יש להמיר ל־DXF לפני הייבוא.</div>
    </sw-card>`}renderDxfMap(){const t=this.version,s=this.asset;if(!t||!s||s.kind!=="dxf"||t.asset_id!==s.id)return p;const i=this.dxfEnt,e=this.dxfMapErr,r=this.dxfEntLoading||this.importing,f=e?a`<div class="err" role="alert" data-dxf-map-error=${e.code}>${e.text}${e.retry?a` <sw-button size="sm" variant="ghost" icon="refresh" data-dxf-retry ?disabled=${r} @click=${()=>e.action==="load"?void this.loadDxfEntities(s.id):void this.importDxf()}>נסה שוב</sw-button>`:p}</div>`:p,m="DXF · מיפוי שכבות ובלוקים למבנה",n="שכבות → קירות / דלתות / חלונות / עצמים / חדרים; בלוקים → פריטי ספרייה. התוצאה נכנסת לעורך כמועמדים, לא לטיוטה";if(!i)return a`<sw-card heading=${m} subheading=${n} data-dxf-map aria-busy=${r?"true":"false"}>
        ${this.dxfEntLoading?a`<div class="note" data-dxf-map-loading>קורא את השכבות והבלוקים של השרטוט…</div>`:p}${f}
      </sw-card>`;const v=i.metres_per_unit===null,w=Object.values(this.layerMap).filter(o=>o!=="ignore").length,b=i.layers.filter(o=>this.layerMap[o.name]==="rooms").length,h=i.layers.some(o=>this.layerMap[o.name]==="objects"),u=this.imported;return a`<sw-card heading=${m} subheading=${n} data-dxf-map aria-busy=${r?"true":"false"}>
      ${v?a`<div class="err" data-dxf-map-units>לקובץ אין יחידות: בחר יחידות בכרטיס "DXF · שכבות, יחידות וקנה מידה", לחץ "החל ורנדר מחדש" ושמור גרסה חדשה - רק אז המידות במטרים אמיתיים.</div>`:a`<div class="note">יחידות: <span class="ltr">${i.units}</span> · המידות ייכנסו במטרים אמיתיים (מדוד)</div>`}
      ${this.dxfStale?a`<div class="err" data-dxf-map-stale>השרטוט רונדר מחדש אחרי שמירת הגרסה, והגרסה השמורה כבר לא תואמת אותו. שמור גרסה חדשה לפני הייבוא.
            <sw-button size="sm" variant="primary" icon="check" data-dxf-map-resave ?disabled=${this.busy} @click=${()=>this.save()}>שמור גרסה חדשה</sw-button></div>`:p}
      <div class="mapwrap" data-dxf-map-layers>
        <table class="map">
          <thead><tr><th scope="col">שכבה</th><th scope="col">ישויות</th><th scope="col" class="sample">דוגמה</th><th scope="col">יעד</th></tr></thead>
          <tbody>
            ${i.layers.map((o,y)=>a`<tr data-dxf-map-row=${o.name} class=${o.count?"":"muted"}>
              <td><label for=${`dxf-map-layer-${y}`} class="ltr">${o.name}</label>${o.in_render?p:a` <span class="note">(לא מצוירת)</span>`}</td>
              <td><span class="ltr">${o.count}</span>${o.count?a` <span class="note ltr kinds">${Object.entries(o.kinds).map(([x,S])=>`${x} ${S}`).join(", ")}</span>`:p}</td>
              <td class="ltr sample">${o.sample}</td>
              <td><select id=${`dxf-map-layer-${y}`} data-dxf-map-target aria-label=${`יעד לשכבה ${o.name}`} ?disabled=${!o.count||this.importing} @change=${x=>this.setLayerTarget(o.name,x.target.value)}>
                ${i.targets.map(x=>a`<option value=${x.id} ?selected=${(this.layerMap[o.name]??"ignore")===x.id}>${x.label}</option>`)}
              </select></td>
            </tr>`)}
          </tbody>
        </table>
      </div>
      ${i.blocks.length?a`<div class="note" style="margin-block-start:8px">בלוקים (${i.blocks.length}) - נכנסים כעצמים רק מתוך שכבות שמופו ל"עצמים"${h?"":' (כרגע אף שכבה לא ממופה ל"עצמים")'}; בלוק בלי התאמה נכנס כ"עצם כללי", בלוק של דלת או חלון אינו עצם:</div>
            <div class="mapwrap" data-dxf-map-blocks>
              <table class="map">
                <thead><tr><th scope="col">בלוק</th><th scope="col">מופעים</th><th scope="col" data-dxf-block-size-unit=${v?"drawing":"m"}>${v?"מידות (יחידות שרטוט)":"מידות (מ׳)"}</th><th scope="col">פריט</th></tr></thead>
                <tbody>
                  ${i.blocks.map((o,y)=>a`<tr data-dxf-block-row=${o.name}>
                    <td><label for=${`dxf-map-block-${y}`} class="ltr">${o.name}</label></td>
                    <td class="ltr">${o.count}</td>
                    <td class="ltr nowrap">${o.size_m[0].toFixed(2)} × ${o.size_m[1].toFixed(2)}</td>
                    <td><select id=${`dxf-map-block-${y}`} data-dxf-block-target aria-label=${`פריט לבלוק ${o.name}`} ?disabled=${this.importing} @change=${x=>this.setBlockItem(o.name,x.target.value||null)}>
                      ${o.suggested.catalog_id===null?a`<option value="" data-dxf-block-none ?selected=${(this.blockMap[o.name]??null)===null}>לא עצם (דלת/חלון)</option>`:p}
                      ${i.catalog_choices.filter(x=>x.id!==null).map(x=>a`<option value=${x.id??""} ?selected=${this.blockMap[o.name]===x.id}>${x.name}</option>`)}
                    </select></td>
                  </tr>`)}
                </tbody>
              </table>
            </div>`:p}
      <div class="row" style="margin-block-start:8px">
        <sw-button variant="primary" size="sm" icon="sparkle" data-dxf-import aria-busy=${this.importing?"true":"false"} ?disabled=${v||this.dxfStale||r||!w} @click=${()=>this.importDxf()}>${this.importing?`מייבא… ${this.importSecs} שנ׳`:"ייבא כמועמדים"}</sw-button>
        <span class="note" data-dxf-map-count>${w?`${w} שכבות ממופות`:"אף שכבה לא ממופה - בחר יעד לשכבה אחת לפחות"}${b?" · חדרים נכנסים דרך קבלת האזורים, לא כמבנה":""}</span>
      </div>
      ${this.importing?a`<div class="note" data-dxf-importing>קורא את השרטוט בשרת; שרטוט גדול עשוי לקחת עד דקה.</div>`:p}
      ${f}
      ${u?a`<div class="ok" data-dxf-imported>נמצאו מועמדים: קירות ${u.walls.length} · פתחים ${u.openings.length} · עצמים ${u.objects?.length??0} · <span data-dxf-imported-rooms>חדרים: ${u.rooms?.length??0} (דרך קבלת האזורים)</span></div>
            ${u.existing_auto.walls+u.existing_auto.openings+(u.existing_auto.objects??0)?a`<div class="note" data-dxf-imported-existing>בטיוטת המבנה כבר יש פריטים מיובאים: קירות ${u.existing_auto.walls} · פתחים ${u.existing_auto.openings} · עצמים ${u.existing_auto.objects??0}; בעורך אפשר להחליף אותם.</div>`:p}
            ${this.canStructure?a`<div class="row" style="margin-block-start:6px">
                  <sw-button variant="primary" size="sm" icon="edit" data-dxf-open-editor @click=${()=>this.openEditorWithCandidates()}>המשך לעורך</sw-button>
                  <span class="note">העורך ייפתח בכלי "זיהוי" עם המועמדים בשכבה מקווקווה; שם מאשרים או דוחים. שום דבר לא נשמר עד האישור.</span>
                </div>`:a`<div class="note" data-dxf-no-edit>${this.canStructure===null?"בודק הרשאות עריכה…":"אין לך הרשאת עריכת מבנה בקומה זו, ולכן אי אפשר לאשר את המועמדים. עורך הקומה יכול לייבא אותם מהמסך הזה."}</div>`}`:p}
    </sw-card>`}async onFile(t){if(!(!t||!this.floorId)){this.busy=!0,this.error="";try{this.asset=await C(this.floorId,t),this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.version=null,this.step=this.asset.page_count>1?1:2,this.assets=[this.asset,...this.assets.filter(s=>s.id!==this.asset.id)]}catch(s){this.error=g(s)}finally{this.busy=!1}}}async save(){if(!(!this.asset||!this.floorId)){this.busy=!0,this.error="";try{const t=this.crop.x===0&&this.crop.y===0&&this.crop.w===1&&this.crop.h===1;this.version=await A(this.floorId,{asset_id:this.asset.id,page:this.page,rotation:this.rotation,crop:t?null:this.crop,notes:this.notes})}catch(t){this.error=g(t)}finally{this.busy=!1}}}async openPublish(){if(this.version){this.preview={data:null,error:""};try{const t=await U(this.version.id);this.preview&&(this.preview={data:t,error:""})}catch(t){this.preview={data:null,error:g(t)}}}}async publish(){if(this.version){this.busy=!0,this.error="";try{this.version=await X(this.version.id),this.preview=null}catch(t){this.error=g(t),this.preview&&(this.preview={...this.preview,error:g(t)})}finally{this.busy=!1}}}renderPublishPreview(){const t=this.preview;if(!t)return p;const s=t.data,i=s?.anchors;return a`<sw-dialog open heading="פרסום התוכנית" subheading="מה ישתנה לצופים במפה" data-import-publish-preview ?locked=${this.busy} @close=${()=>this.preview=null}>
      ${t.error?a`<div class="err">${t.error}</div>`:p}
      ${!s&&!t.error?a`<sw-state-panel state="loading" compact></sw-state-panel>`:p}
      ${s?a`<ul class="steps" data-import-publish-summary>
            <li>${s.from?`מחליפה את הגרסה שפורסמה ב-${G(new Date(s.from.published_at??s.from.created_at))}`:"הרקע הראשון של הקומה"}</li>
            <li>${i?.total?`${i.total} פריטים מוצבים: ${i.carried} עוברים כמו שהם${i.needs_alignment?`, ${i.needs_alignment} דורשים בדיקת מיקום על הרקע החדש`:""}`:"אין פריטים מוצבים על הקומה"}</li>
            <li>${s.geometry.same?"המבנה (קירות, פתחים, עצמים) נשאר כפי שהוא":`המבנה משתנה (${s.geometry.changes.length} שדות)`}</li>
          </ul>
          ${i?.items.filter(e=>e.outcome==="needs_alignment").slice(0,8).map(e=>a`<div class="note">· ${e.name}</div>`)}`:p}
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>this.preview=null}>ביטול</sw-button>
        <sw-button variant="primary" icon="check" data-import-publish-confirm ?disabled=${this.busy||!s} @click=${()=>this.publish()}>פרסם</sw-button>
      </div>
    </sw-dialog>`}setCrop(t,s){const i=Math.max(0,Math.min(100,s))/100,e={...this.crop,[t]:i};e.x+e.w>1&&(e.w=1-e.x),e.y+e.h>1&&(e.h=1-e.y),e.w<=.02&&(e.w=.02),e.h<=.02&&(e.h=.02),this.crop=e}previewUrl(){const t=this.asset?.pages.find(i=>i.page===this.page)??this.asset?.pages[0];if(!t)return"";const s=_(t.preview_url)+(this.previewBust?`${t.preview_url.includes("?")?"&":"?"}v=${this.previewBust}`:"");return this.rotation?`${s}${s.includes("?")?"&":"?"}rotation=${this.rotation}`:s}renderStep(){const t=this.asset;switch(this.step){case 0:return a`
          <label class="drop ${this.dragOver?"over":""}" @dragover=${s=>{s.preventDefault(),this.dragOver=!0}} @dragleave=${()=>this.dragOver=!1} @drop=${s=>{s.preventDefault(),this.dragOver=!1,this.onFile(s.dataTransfer?.files[0])}}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dxf,application/pdf,image/png,image/jpeg,image/vnd.dxf" @change=${s=>void this.onFile(s.target.files?.[0])} />
            <div>
              <div class="ic"><sw-icon name="upload" size=${20}></sw-icon></div>
              <strong>${this.busy?"מעלה…":"גרור לכאן PDF, תמונה או DXF של התוכנית, או לחץ לבחירה"}</strong>
              <small>PDF עד 20 עמודים, PNG / JPG, DXF (AutoCAD; DWG יש להמיר) · עד 40 MB · הזיהוי לפי תוכן הקובץ · המקור נשמר ללא שינוי</small>
            </div>
          </label>
          ${this.assets.length?a`<div class="assets"><div class="note" style="margin-block-end:4px">קבצים שכבר הועלו לקומה זו:</div>${this.assets.map(s=>a`<button @click=${()=>{this.asset=s,this.page=1,this.step=s.page_count>1?1:2}}><span>${s.original_name}</span><span class="ltr">${s.page_count} עמ׳ · ${D(s.bytes)}</span></button>`)}</div>`:p}`;case 1:return a`<div class="note">בחר את העמוד שמכיל את התוכנית של הקומה.</div>
          <div class="pages">${t?.pages.map(s=>a`<button class="pg ${s.page===this.page?"on":""}" @click=${()=>this.page=s.page}><img src=${_(s.preview_url)} alt=${`עמוד ${s.page}`} loading="lazy" />עמוד ${s.page}</button>`)}</div>`;case 2:{const s=this.crop,i=s.x===0&&s.y===0&&s.w===1&&s.h===1;return a`
          <div class="preview">
            <div class="frame" @pointerdown=${this.startCrop}>
              <img src=${this.previewUrl()} alt="תצוגה מקדימה (אחרי סיבוב)" />
              ${i?p:a`<div class="cropbox" style="left:${s.x*100}%;top:${s.y*100}%;width:${s.w*100}%;height:${s.h*100}%"></div>`}
              <div class="hint">${i?"גרור מלבן על התוכנית כדי לחתוך":`חיתוך ${Math.round(s.w*100)}%×${Math.round(s.h*100)}% · גרור שוב כדי לשנות`}</div>
            </div>
          </div>
          <div class="row">
            <sw-button size="sm" icon="refresh" @click=${()=>{this.rotation=(this.rotation+90)%360,this.crop={x:0,y:0,w:1,h:1}}}>סובב 90°</sw-button>
            <sw-badge kind="neutral" label=${`סיבוב ${this.rotation}°`}></sw-badge>
            <sw-button size="sm" variant="ghost" icon="fit" ?disabled=${i} @click=${()=>this.crop={x:0,y:0,w:1,h:1}}>אפס חיתוך</sw-button>
            <span class="note">התצוגה כבר מסובבת; המלבן המקווקו הוא בדיוק מה שיישמר. אפשר גם להזין אחוזים.</span>
          </div>
          <div class="two">
            <sw-field label="שמאל %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(s.x*100))} @change=${e=>this.setCrop("x",Number(e.target.value))} /></sw-field>
            <sw-field label="עליון %"><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(s.y*100))} @change=${e=>this.setCrop("y",Number(e.target.value))} /></sw-field>
            <sw-field label="רוחב %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(s.w*100))} @change=${e=>this.setCrop("w",Number(e.target.value))} /></sw-field>
            <sw-field label="גובה %"><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(s.h*100))} @change=${e=>this.setCrop("h",Number(e.target.value))} /></sw-field>
          </div>`}case 3:return a`
          <sw-field label="קומה"><input .value=${this.floor?.floor.name??""} disabled /></sw-field>
          <sw-field label="הערות לגרסה (אופציונלי)" hint="למשל: תוכנית מעודכנת אחרי שיפוץ 2026"><input .value=${this.notes} @input=${s=>this.notes=s.target.value} /></sw-field>
          <div class="note">קנה מידה (מטרים לפיקסל) יכויל בעורך בשתי נקודות ומרחק ידוע; עד אז מרחקים מוצגים כמשוערים.</div>`;default:return a`
          ${this.version?a`<div class="ok"><sw-icon name="check" size=${14}></sw-icon>הגרסה נשמרה (${this.version.width_px}×${this.version.height_px} px) · ${this.version.status==="published"?"פורסמה — היא הרקע של הקומה":"טיוטה — עורכי הקומה רואים אותה, צופים עדיין לא"}</div>
                <div class="preview" style="min-block-size:220px"><img src=${_(this.version.image_url)} alt="רקע התוכנית" /></div>`:a`<div class="note">סיכום: ${t?.original_name} · עמוד ${this.page} · סיבוב ${this.rotation}° · חיתוך ${Math.round(this.crop.w*100)}%×${Math.round(this.crop.h*100)}%. השמירה מייצרת רקע נגזר; המקור לא משתנה.</div>`}
          <div class="row">
            ${this.version?p:a`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.save()}>שמור כטיוטה</sw-button>`}
            ${this.version&&this.version.status==="draft"?a`<sw-button variant="primary" icon="check" data-import-publish ?disabled=${this.busy} @click=${()=>void this.openPublish()}>פרסום</sw-button>`:p}
            ${this.renderPublishPreview()}
            ${this.version?a`<sw-button icon="map" @click=${()=>k(`/explore/floors/${this.floorId}`)}>פתח במפה</sw-button><sw-button variant="ghost" icon="edit" @click=${()=>k(`/explore/floors/${this.floorId}/edit`)}>הצב מצלמות</sw-button>`:p}
          </div>
          ${t?.kind==="dxf"?this.renderDxfMap():p}`}}renderDemo(){return a`<sw-card><sw-state-panel icon="map" state="empty" heading="ייבוא תוכנית עובד מול השרת" hint="בתצוגת ההדגמה אין שרת מחובר. במערכת המותקנת המסך מעלה PDF/PNG, בוחר עמוד, מסובב וחותך, ומפרסם גרסה."></sw-state-panel></sw-card>`}render(){const t=this.floor,s=this.step===0?!!this.asset:this.step===1?!!this.asset:!0;return a`
      <sw-page heading=${t?`ייבוא תוכנית ל${t.floor.name}`:"ייבוא תוכנית"} subheading="המקור נשמר ללא שינוי; כל תיקון הוא שכבה נגזרת" crumbs=${t?`אתרים | ${t.site.name} | ${t.building.name} | ${t.floor.name}`:"אתרים"}>
        ${t&&!t.floor.has_plan&&!t.floor.draft_version_id?a`<sw-button slot="actions" variant="ghost" icon="mail" data-architect-request @click=${()=>H()}>בקשה לאדריכל</sw-button>`:p}
        ${$()?!this.floorId||this.tree&&!t?a`<sw-state-panel icon="map" state="empty" heading="בחר קומה" hint="ייבוא תוכנית מתחיל מדף הקומות."><div style="margin-block-start:10px"><sw-button variant="primary" @click=${()=>k("/explore/sites")}>לאתרים</sw-button></div></sw-state-panel>`:a`
                <sw-card><sw-steps .steps=${M} .current=${this.step}></sw-steps></sw-card>
                <div class="layout">
                  <div class="stage">${this.renderStep()}${this.error?a`<div class="err">${this.error}</div>`:p}</div>
                  <div class="side">
                    <sw-card heading="קובץ">
                      ${this.asset?a`<div class="note">${this.asset.original_name}</div><div class="row" style="margin-block-start:6px"><sw-badge kind="neutral" label=${`${this.asset.mime.split("/")[1].toUpperCase()} · ${D(this.asset.bytes)} · ${this.asset.page_count} עמ׳`}></sw-badge></div><div class="note ltr" style="margin-block-start:6px">sha256 ${this.asset.sha256.slice(0,16)}…</div>`:a`<div class="note">עדיין לא נבחר קובץ.</div>`}
                    </sw-card>
                    ${this.renderDxf()}
                    <sw-card heading="בטיחות">
                      <div class="note">הקובץ מזוהה לפי תוכנו; PDF מרונדר בתהליך נפרד עם מגבלת זמן; SVG נדחה עד sanitization. תוכן טקסטואלי בתוך הקובץ הוא נתון בלבד.</div>
                    </sw-card>
                    <div class="foot">
                      <sw-button variant="ghost" icon="chevron" ?disabled=${this.step===0||this.busy} @click=${()=>this.step=Math.max(0,this.step-1)}>הקודם</sw-button>
                      ${this.step<M.length-1?a`<sw-button variant="primary" ?disabled=${!s||this.busy} @click=${()=>this.step=Math.min(M.length-1,this.step+1)}>הבא</sw-button>`:p}
                    </div>
                  </div>
                </div>`:this.renderDemo()}
      </sw-page>
    `}};l.styles=N`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stage {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      padding: 14px;
      min-block-size: 360px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .drop {
      flex: 1;
      min-block-size: 300px;
      border: 1.5px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    .drop.over {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .drop .ic {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin: 0 auto 8px;
    }
    .drop small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 4px;
    }
    input[type='file'] {
      display: none;
    }
    .pages {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
    .pg {
      border: 1.5px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: 6px;
      background: var(--sw-surface);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .pg.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .pg img {
      inline-size: 100%;
      aspect-ratio: 1;
      object-fit: contain;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-2xs);
      display: block;
      margin-block-end: 4px;
    }
    .preview {
      position: relative;
      flex: 1;
      min-block-size: 320px;
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      display: grid;
      place-items: center;
    }
    .preview .frame {
      position: relative;
      display: inline-block;
      line-height: 0;
      cursor: crosshair;
      touch-action: none;
      user-select: none;
      overflow: hidden;
    }
    .preview .frame img {
      max-inline-size: 100%;
      max-block-size: 420px;
      display: block;
      pointer-events: none;
    }
    .preview .cropbox {
      position: absolute;
      border: 2px dashed var(--sw-accent);
      box-shadow: 0 0 0 9999px color-mix(in srgb, var(--sw-overlay) 60%, transparent);
      pointer-events: none;
      box-sizing: border-box;
    }
    .preview .hint {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      font-size: var(--sw-fs-xs);
      border-radius: var(--sw-r-xs);
      padding: 3px 8px;
      line-height: 1.4;
      pointer-events: none;
    }
    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .assets button {
      display: flex;
      justify-content: space-between;
      inline-size: 100%;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
      margin-block-end: 4px;
    }
    /* T086: the DXF mapping tables scroll inside their own box on a narrow screen, never the page */
    .stage {
      min-inline-size: 0;
    }
    .mapwrap {
      max-inline-size: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    table.map {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    table.map th,
    table.map td {
      text-align: start;
      padding: 4px 6px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
    }
    table.map th {
      font-weight: 600;
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    table.map td.sample {
      max-inline-size: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    table.map tr.muted {
      color: var(--sw-text-2);
    }
    table.map select {
      font: inherit;
      max-inline-size: 140px;
    }
    table.map .nowrap {
      white-space: nowrap;
    }
    /* phone: the sample column and the kind breakdown give way so the target select stays in view */
    @media (max-width: 767px) {
      table.map .sample,
      table.map .kinds {
        display: none;
      }
    }
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): the stage is the hero step (large radius, shadow 2); the drop zone and the
       preview are wells on the scheme's own surface (the preview and the page thumbnails were a fixed #f3f5f9 - a light box in the dark
       scheme); the picked page is a FILLED accent field, not a halo; press feedback on the page tiles and the asset rows. */
    .stage {
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2);
    }
    .drop {
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-lg);
      font-weight: var(--sw-fw-medium);
    }
    .drop strong {
      display: block;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
    }
    .drop .ic {
      background: transparent;
      border: 1.5px dashed var(--sw-border-strong);
      color: var(--sw-text-2);
    }
    .drop.over {
      color: var(--sw-text);
    }
    /* POLISH4 WP6 (D12): the drop zone answers a hovering mouse only (fine pointer); a tap on a tablet opens the picker with no sticky wash */
    @media (hover: hover) and (pointer: fine) {
      .drop:hover {
        border-color: var(--sw-accent);
        background: var(--sw-accent-soft);
        color: var(--sw-text);
      }
    }
    .pg {
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .pg:active {
      transform: scale(var(--sw-press-scale));
    }
    .pg.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: none;
    }
    .pg img,
    .preview {
      background: var(--sw-surface-2);
    }
    .ok {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
    }
    .assets button {
      transition: background var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    .assets button:active {
      transform: scale(var(--sw-press-scale));
    }
    table.map th {
      color: var(--sw-text);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;d([R()],l.prototype,"floorId",2);d([c()],l.prototype,"step",2);d([c()],l.prototype,"tree",2);d([c()],l.prototype,"assets",2);d([c()],l.prototype,"asset",2);d([c()],l.prototype,"page",2);d([c()],l.prototype,"rotation",2);d([c()],l.prototype,"crop",2);d([c()],l.prototype,"notes",2);d([c()],l.prototype,"version",2);d([c()],l.prototype,"preview",2);d([c()],l.prototype,"busy",2);d([c()],l.prototype,"error",2);d([c()],l.prototype,"dragOver",2);d([c()],l.prototype,"dxf",2);d([c()],l.prototype,"dxfLayers",2);d([c()],l.prototype,"dxfUnits",2);d([c()],l.prototype,"dxfBusy",2);d([c()],l.prototype,"previewBust",2);d([c()],l.prototype,"dxfEnt",2);d([c()],l.prototype,"dxfEntLoading",2);d([c()],l.prototype,"layerMap",2);d([c()],l.prototype,"blockMap",2);d([c()],l.prototype,"importing",2);d([c()],l.prototype,"importSecs",2);d([c()],l.prototype,"imported",2);d([c()],l.prototype,"dxfMapErr",2);d([c()],l.prototype,"dxfStale",2);d([c()],l.prototype,"canStructure",2);l=d([W("explore-plan-import")],l);export{l as ExplorePlanImport};
//# sourceMappingURL=explore-plan-import-HlZDkapU.js.map
