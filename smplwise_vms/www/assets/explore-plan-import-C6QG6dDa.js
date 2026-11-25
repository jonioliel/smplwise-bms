import{i as F,a2 as j,ae as k,aJ as I,o as b,aK as T,aL as P,aM as O,a as S,a7 as _,aN as B,aO as C,A as c,b as r,aP as A,aQ as U,aR as X,aS as N,aT as G,aU as M,aV as R,g as W,y as V,j as h,k as K}from"./index-BMsqo0rz.js";import{o as q}from"./architect-request-dialog-1wTSbryd.js";import"./sw-steps-D6VpO0Vt.js";import{a as H,i as J}from"./geometry-NthfSGbB.js";import{s as Q}from"./candidates-C_XQPE_R.js";import{t as e}from"./media-DMkSACmg.js";import"./sw-logo-art-PLtEZJxU.js";import"./map-Ce8gybQ2.js";var Y=Object.defineProperty,Z=Object.getOwnPropertyDescriptor,p=(t,s,a,i)=>{for(var o=i>1?void 0:i?Z(s,a):s,u=t.length-1,v;u>=0;u--)(v=t[u])&&(o=(i?v(s,a,o):v(o))||o);return i&&o&&Y(s,a,o),o};const D=[e("קובץ"),e("עמוד"),e("חיתוך וסיבוב"),e("שם והערות"),e("שמירה ופרסום")];function E(t,s){if(!(t instanceof S))return{code:"failed",text:b(t),retry:t instanceof TypeError};const a=t.body.details,i=o=>Array.isArray(a?.[o])?(a?.[o]).map(String).join(", "):"";switch(t.code){case"dxf_timeout":{const o=typeof a?.timeout_s=="number"?e(" ({timeout_s} שנ׳)",{timeout_s:a.timeout_s}):"";return{code:t.code,text:s==="load"?e("קריאת השרטוט לא הסתיימה בזמן{s}. נסה שוב.",{s:o}):e('הייבוא לא הסתיים בזמן{s}. נסה שוב, או מפה פחות שכבות (סמן "התעלם" לשכבות שאינן מבנה).',{s:o}),retry:!0}}case"unknown_item":return{code:t.code,text:e('פריט שנבחר לבלוק לא קיים בספרייה{list}. בחר פריט אחר (או "עצם כללי") ונסה שוב.',{list:i("items")?`: ${i("items")}`:""}),retry:!1};case"unknown_layer":return{code:t.code,text:e("שכבה במיפוי לא קיימת בקובץ{list}. המיפוי נטען מחדש מהשרטוט.",{list:i("unknown")?`: ${i("unknown")}`:""}),retry:!1};case"no_layers":return{code:t.code,text:e('יש למפות לפחות שכבה אחת (יעד שאינו "התעלם").'),retry:!1};case"not_dxf":return{code:t.code,text:e("הגרסה השמורה לא נוצרה מקובץ DXF, ולכן אין מה למפות."),retry:!1};case"dxf_unitless":return{code:t.code,text:e('לקובץ אין יחידות: בחר יחידות בכרטיס "DXF · שכבות, יחידות וקנה מידה" לפני הייבוא.'),retry:!1};default:return{code:t.code||"failed",text:b(t),retry:!!t.body.retryable}}}function z(t){return t>=1024*1024?`${(t/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(t/1024))} KB`}let d=class extends F{constructor(){super(...arguments),this.floorId="",this.step=0,this.tree=null,this.assets=[],this.asset=null,this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.notes="",this.version=null,this.preview=null,this.busy=!1,this.error="",this.dragOver=!1,this.dxf=null,this.dxfLayers=null,this.dxfUnits=null,this.dxfBusy=!1,this.previewBust=0,this.dxfEnt=null,this.dxfEntLoading=!1,this.layerMap={},this.blockMap={},this.importing=!1,this.importSecs=0,this.imported=null,this.dxfMapErr=null,this.dxfStale=!1,this.canStructure=null,this.mapAssetId="",this.entToken=0,this.importToken=0,this.startCrop=t=>{if(t.button!==0)return;const s=t.currentTarget,a=s.getBoundingClientRect(),i=l=>({x:Math.min(1,Math.max(0,(l.clientX-a.left)/a.width)),y:Math.min(1,Math.max(0,(l.clientY-a.top)/a.height))}),o=i(t);s.setPointerCapture(t.pointerId),t.preventDefault();const u=l=>{const w=i(l),g=Math.min(o.x,w.x),$=Math.min(o.y,w.y),f=Math.abs(w.x-o.x),m=Math.abs(w.y-o.y);f>.01&&m>.01&&(this.crop={x:+g.toFixed(4),y:+$.toFixed(4),w:+f.toFixed(4),h:+m.toFixed(4)})},v=()=>{s.removeEventListener("pointermove",u),s.removeEventListener("pointerup",v),s.removeEventListener("pointercancel",v),(this.crop.w<.02||this.crop.h<.02)&&(this.crop={x:0,y:0,w:1,h:1})};s.addEventListener("pointermove",u),s.addEventListener("pointerup",v),s.addEventListener("pointercancel",v)}}connectedCallback(){super.connectedCallback(),this.init()}async init(){try{this.tree=await j(),k()&&this.floorId&&(this.assets=(await I(this.floorId)).assets)}catch(t){this.error=b(t)}}get floor(){return this.tree&&this.floorId?T(this.tree,this.floorId):null}updated(t){if(t.has("asset")&&k()){const s=this.asset;s&&s.kind==="dxf"&&(!this.dxf||this.dxf.asset_id!==s.id)?this.loadDxf(s.id):(!s||s.kind!=="dxf")&&(this.dxf=null)}if((t.has("version")||t.has("asset"))&&k()){const s=this.asset,a=this.version;a&&s&&s.kind==="dxf"&&a.asset_id===s.id?(t.has("version")&&t.get("version")?.id!==a.id&&this.resetDxfMap(),(!this.dxfEnt||this.dxfEnt.asset_id!==s.id)&&this.loadDxfEntities(s.id),this.canStructure===null&&this.loadFloorRights()):(!a||!s||s.kind!=="dxf")&&(this.dxfEnt=null,this.resetDxfMap())}}disconnectedCallback(){super.disconnectedCallback(),this.stopImportTimer()}resetDxfMap(){this.importToken++,this.imported=null,this.dxfMapErr=null,this.dxfStale=!1}async loadFloorRights(){if(P("map.edit")){this.canStructure=!0;return}try{this.canStructure=(await O(this.floorId)).permissions.structure}catch{this.canStructure=!1}}async loadDxfEntities(t,s={}){const a=++this.entToken;this.dxfEntLoading=!0,this.dxfMapErr=null;try{const i=await H(t);if(a!==this.entToken||this.asset?.id!==t)return;const o=this.mapAssetId===i.asset_id,u=new Set(i.targets.map(f=>f.id)),v=new Set(i.catalog_choices.map(f=>f.id).filter(f=>f!==null)),l=new Set(s.layers??[]),w=new Set(s.items??[]),g=f=>{if(l.has(f))return"ignore";const m=this.layerMap[f];return o&&m!==void 0&&u.has(m)?m:void 0},$=(f,m)=>{if(!o||!(f in this.blockMap))return;const n=this.blockMap[f];return n===null?m===null?null:void 0:v.has(n)&&!w.has(n)?n:void 0};this.dxfEnt=i,this.mapAssetId=i.asset_id,this.layerMap=Object.fromEntries(i.layers.map(f=>[f.name,f.count?g(f.name)??f.suggested:"ignore"])),this.blockMap=Object.fromEntries(i.blocks.map(f=>{const m=$(f.name,f.suggested.catalog_id);return[f.name,m===void 0?f.suggested.catalog_id:m]})),this.imported=null}catch(i){a===this.entToken&&(this.dxfMapErr={...E(i,"load"),action:"load"})}finally{a===this.entToken&&(this.dxfEntLoading=!1)}}importBody(t){const s=Object.fromEntries(Object.entries(this.layerMap).filter(([,i])=>i!=="ignore")),a={};for(const i of t.blocks){const o=this.blockMap[i.name];typeof o=="string"&&o!==i.suggested.catalog_id&&(a[i.name]=o)}return{layer_map:s,block_map:a}}stopImportTimer(){this.importTimer!==void 0&&window.clearInterval(this.importTimer),this.importTimer=void 0}async importDxf(){const t=this.version,s=this.dxfEnt;if(!t||!s||this.importing)return;const a=this.importBody(s);if(!Object.keys(a.layer_map).length){this.dxfMapErr={code:"no_layers",text:e('יש למפות לפחות שכבה אחת (יעד שאינו "התעלם").'),retry:!1,action:"import"};return}const i=++this.importToken;this.importing=!0,this.importSecs=0,this.dxfMapErr=null,this.imported=null;const o=Date.now();this.importTimer=window.setInterval(()=>this.importSecs=Math.round((Date.now()-o)/1e3),1e3);try{const u=await J(t.id,a);i===this.importToken&&!this.dxfStale&&this.version?.id===t.id&&(this.imported=u)}catch(u){if(i!==this.importToken)return;const v=E(u,"import");if(this.dxfMapErr={...v,action:"import"},v.code==="unknown_layer"||v.code==="unknown_item"){const l=u instanceof S?u.body.details:{},w=g=>Array.isArray(g)?g.filter($=>typeof $=="string"):[];this.dxfEnt=null,this.loadDxfEntities(s.asset_id,{layers:w(l?.unknown),items:w(l?.items)}).then(()=>{this.dxfMapErr||(this.dxfMapErr={...v,action:"import"})})}}finally{this.stopImportTimer(),this.importing=!1}}openEditorWithCandidates(){const t=this.version,s=this.imported;!t||!s||!this.canStructure||(Q(t.id,s),_(`/explore/floors/${this.floorId}/edit`,{candidates:"dxf"}))}setLayerTarget(t,s){this.layerMap={...this.layerMap,[t]:s},this.imported=null,this.dxfMapErr?.action==="import"&&(this.dxfMapErr=null)}setBlockItem(t,s){this.blockMap={...this.blockMap,[t]:s},this.imported=null,this.dxfMapErr?.action==="import"&&(this.dxfMapErr=null)}async loadDxf(t){try{const s=await B(t);this.dxf=s,this.dxfLayers=s.options.layers,this.dxfUnits=s.options.units??(s.info?.units&&s.info.units!=="unitless"?s.info.units:null)}catch(s){this.error=b(s)}}toggleDxfLayer(t){const s=this.dxf?.info?.layers.filter(i=>i.drawable>0).map(i=>i.name)??[],a=this.dxfLayers??s;this.dxfLayers=a.includes(t)?a.filter(i=>i!==t):[...a,t]}async applyDxf(){if(this.dxf){this.dxfBusy=!0,this.error="";try{const t=this.dxf.info?.layers.filter(a=>a.drawable>0).map(a=>a.name)??[],s=this.dxfLayers&&this.dxfLayers.length!==t.length?this.dxfLayers:null;this.dxf=await C(this.dxf.asset_id,{layers:s,units:this.dxfUnits}),this.dxfLayers=this.dxf.options.layers,this.previewBust=Date.now(),this.version&&this.version.asset_id===this.dxf.asset_id&&(this.dxfStale=!0,this.importToken++,this.imported=null,this.loadDxfEntities(this.dxf.asset_id))}catch(t){this.error=b(t)}finally{this.dxfBusy=!1}}}renderDxf(){const t=this.dxf;if(!t||!t.info)return c;const s=t.info.layers.filter(l=>l.drawable>0).map(l=>l.name),a=this.dxfLayers??s,i=t.info.extent,o=Object.entries(t.render?.skipped??t.info.unsupported),u=t.render?.meters_per_px,v=t.render?.units&&t.render.units!=="unitless";return r`<sw-card heading=${e("DXF · שכבות, יחידות וקנה מידה")} subheading=${e("{library} ({license}) · המקור נשמר כפי שהועלה; התצוגה נגזרת ממנו",{library:t.adapter.library,license:t.adapter.license})} data-dxf>
      <div class="note">${e("גרסה {version} · יחידות בקובץ:",{version:t.info.version})} <strong data-dxf-units>${t.info.units}</strong>${i?r` · ${e("היקף {w} × {h} יחידות",{w:i.width.toFixed(0),h:i.height.toFixed(0)})}`:c}${v&&i&&u?r` · ${e("כ־{w} × {h} מ׳",{w:(i.width*(u*t.render.px_per_unit)).toFixed(1),h:(i.height*(u*t.render.px_per_unit)).toFixed(1)})}`:c}</div>
      <div class="note">${e("ישויות:")} ${Object.entries(t.info.entity_counts).map(([l,w])=>`${l} ${w}`).join(" · ")}</div>
      ${o.length?r`<div class="err" data-dxf-partial>${e("המרה חלקית: {list} לא מצוירים (טקסטים, מילויים, מידות וגופים תלת־ממדיים אינם מומרים). הדבר יוצג גם על הגרסה.",{list:o.map(([l,w])=>`${w} × ${l}`).join(", ")})}</div>`:r`<div class="note">${e("כל הישויות בקובץ מצוירות.")}</div>`}
      <div class="note" style="margin-block-start:6px">${e("שכבות ({n} מתוך {total}):",{n:a.length,total:s.length})}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px 12px">${t.info.layers.map(l=>r`<label style="display:flex;gap:6px;align-items:center;font-size:var(--sw-fs-sm)"><input type="checkbox" data-dxf-layer=${l.name} .checked=${a.includes(l.name)} ?disabled=${l.drawable===0} @change=${()=>this.toggleDxfLayer(l.name)} /> <span class="ltr">${l.name}</span> <span class="note">(${l.drawable})</span></label>`)}</div>
      <div class="row" style="margin-block-start:8px;align-items:center;gap:8px">
        <sw-field label=${e("יחידות השרטוט")}><select data-dxf-units-select @change=${l=>this.dxfUnits=l.target.value||null}><option value="" ?selected=${!this.dxfUnits}>${e("לפי הקובץ ({units})",{units:t.info.units})}</option>${t.units_choices.map(l=>r`<option value=${l} ?selected=${this.dxfUnits===l}>${l}</option>`)}</select></sw-field>
        <sw-button size="sm" variant="primary" data-dxf-apply ?disabled=${this.dxfBusy||a.length===0} @click=${()=>this.applyDxf()}>${e("החל ורנדר מחדש")}</sw-button>
      </div>
      ${t.render?r`<div class="note" style="margin-block-start:6px" data-dxf-render>${e("רונדר: {w}×{h} px · {n} ישויות מ־{layers} שכבות",{w:t.render.width,h:t.render.height,n:t.render.rendered,layers:t.render.layers.length})}${u?e(" · {cm} ס״מ לפיקסל (מיחידות {units}; ייכנס לגרסה כקנה מידה)",{cm:(u*100).toFixed(2),units:t.render.units}):e(" · קנה מידה לא ידוע: הקובץ ללא יחידות, בחר יחידות או כייל מאוחר יותר")}</div>`:c}
      <div class="note">${e("DWG אינו נתמך (פורמט סגור) — יש להמיר ל־DXF לפני הייבוא.")}</div>
    </sw-card>`}renderDxfMap(){const t=this.version,s=this.asset;if(!t||!s||s.kind!=="dxf"||t.asset_id!==s.id)return c;const a=this.dxfEnt,i=this.dxfMapErr,o=this.dxfEntLoading||this.importing,u=i?r`<div class="err" role="alert" data-dxf-map-error=${i.code}>${i.text}${i.retry?r` <sw-button size="sm" variant="ghost" icon="refresh" data-dxf-retry ?disabled=${o} @click=${()=>i.action==="load"?void this.loadDxfEntities(s.id):void this.importDxf()}>${e("נסה שוב")}</sw-button>`:c}</div>`:c,v=e("DXF · מיפוי שכבות ובלוקים למבנה"),l=e("שכבות → קירות / דלתות / חלונות / עצמים / חדרים; בלוקים → פריטי ספרייה. התוצאה נכנסת לעורך כמועמדים, לא לטיוטה");if(!a)return r`<sw-card heading=${v} subheading=${l} data-dxf-map aria-busy=${o?"true":"false"}>
        ${this.dxfEntLoading?r`<div class="note" data-dxf-map-loading>${e("קורא את השכבות והבלוקים של השרטוט…")}</div>`:c}${u}
      </sw-card>`;const w=a.metres_per_unit===null,g=Object.values(this.layerMap).filter(n=>n!=="ignore").length,$=a.layers.filter(n=>this.layerMap[n.name]==="rooms").length,f=a.layers.some(n=>this.layerMap[n.name]==="objects"),m=this.imported;return r`<sw-card heading=${v} subheading=${l} data-dxf-map aria-busy=${o?"true":"false"}>
      ${w?r`<div class="err" data-dxf-map-units>${e('לקובץ אין יחידות: בחר יחידות בכרטיס "DXF · שכבות, יחידות וקנה מידה", לחץ "החל ורנדר מחדש" ושמור גרסה חדשה - רק אז המידות במטרים אמיתיים.')}</div>`:r`<div class="note">${e("יחידות:")} <span class="ltr">${a.units}</span> · ${e("המידות ייכנסו במטרים אמיתיים (מדוד)")}</div>`}
      ${this.dxfStale?r`<div class="err" data-dxf-map-stale>${e("השרטוט רונדר מחדש אחרי שמירת הגרסה, והגרסה השמורה כבר לא תואמת אותו. שמור גרסה חדשה לפני הייבוא.")}
            <sw-button size="sm" variant="primary" icon="check" data-dxf-map-resave ?disabled=${this.busy} @click=${()=>this.save()}>${e("שמור גרסה חדשה")}</sw-button></div>`:c}
      <div class="mapwrap" data-dxf-map-layers>
        <table class="map">
          <thead><tr><th scope="col">${e("שכבה")}</th><th scope="col">${e("ישויות")}</th><th scope="col" class="sample">${e("דוגמה")}</th><th scope="col">${e("יעד")}</th></tr></thead>
          <tbody>
            ${a.layers.map((n,y)=>r`<tr data-dxf-map-row=${n.name} class=${n.count?"":"muted"}>
              <td><label for=${`dxf-map-layer-${y}`} class="ltr">${n.name}</label>${n.in_render?c:r` <span class="note">${e("(לא מצוירת)")}</span>`}</td>
              <td><span class="ltr">${n.count}</span>${n.count?r` <span class="note ltr kinds">${Object.entries(n.kinds).map(([x,L])=>`${x} ${L}`).join(", ")}</span>`:c}</td>
              <td class="ltr sample">${n.sample}</td>
              <td><select id=${`dxf-map-layer-${y}`} data-dxf-map-target aria-label=${e("יעד לשכבה {name}",{name:n.name})} ?disabled=${!n.count||this.importing} @change=${x=>this.setLayerTarget(n.name,x.target.value)}>
                ${a.targets.map(x=>r`<option value=${x.id} ?selected=${(this.layerMap[n.name]??"ignore")===x.id}>${x.label}</option>`)}
              </select></td>
            </tr>`)}
          </tbody>
        </table>
      </div>
      ${a.blocks.length?r`<div class="note" style="margin-block-start:8px">${e('בלוקים ({n}) - נכנסים כעצמים רק מתוך שכבות שמופו ל"עצמים"',{n:a.blocks.length})}${f?"":e(' (כרגע אף שכבה לא ממופה ל"עצמים")')}${e('; בלוק בלי התאמה נכנס כ"עצם כללי", בלוק של דלת או חלון אינו עצם:')}</div>
            <div class="mapwrap" data-dxf-map-blocks>
              <table class="map">
                <thead><tr><th scope="col">${e("בלוק")}</th><th scope="col">${e("מופעים")}</th><th scope="col" data-dxf-block-size-unit=${w?"drawing":"m"}>${w?e("מידות (יחידות שרטוט)"):e("מידות (מ׳)")}</th><th scope="col">${e("פריט")}</th></tr></thead>
                <tbody>
                  ${a.blocks.map((n,y)=>r`<tr data-dxf-block-row=${n.name}>
                    <td><label for=${`dxf-map-block-${y}`} class="ltr">${n.name}</label></td>
                    <td class="ltr">${n.count}</td>
                    <td class="ltr nowrap">${n.size_m[0].toFixed(2)} × ${n.size_m[1].toFixed(2)}</td>
                    <td><select id=${`dxf-map-block-${y}`} data-dxf-block-target aria-label=${e("פריט לבלוק {name}",{name:n.name})} ?disabled=${this.importing} @change=${x=>this.setBlockItem(n.name,x.target.value||null)}>
                      ${n.suggested.catalog_id===null?r`<option value="" data-dxf-block-none ?selected=${(this.blockMap[n.name]??null)===null}>${e("לא עצם (דלת/חלון)")}</option>`:c}
                      ${a.catalog_choices.filter(x=>x.id!==null).map(x=>r`<option value=${x.id??""} ?selected=${this.blockMap[n.name]===x.id}>${x.name}</option>`)}
                    </select></td>
                  </tr>`)}
                </tbody>
              </table>
            </div>`:c}
      <div class="row" style="margin-block-start:8px">
        <sw-button variant="primary" size="sm" icon="sparkle" data-dxf-import aria-busy=${this.importing?"true":"false"} ?disabled=${w||this.dxfStale||o||!g} @click=${()=>this.importDxf()}>${this.importing?e("מייבא… {importSecs} שנ׳",{importSecs:this.importSecs}):e("ייבא כמועמדים")}</sw-button>
        <span class="note" data-dxf-map-count>${g?e("{mapped} שכבות ממופות",{mapped:g}):e("אף שכבה לא ממופה - בחר יעד לשכבה אחת לפחות")}${$?e(" · חדרים נכנסים דרך קבלת האזורים, לא כמבנה"):""}</span>
      </div>
      ${this.importing?r`<div class="note" data-dxf-importing>${e("קורא את השרטוט בשרת; שרטוט גדול עשוי לקחת עד דקה.")}</div>`:c}
      ${u}
      ${m?r`<div class="ok" data-dxf-imported>${e("נמצאו מועמדים: קירות {walls} · פתחים {openings} · עצמים {objects}",{walls:m.walls.length,openings:m.openings.length,objects:m.objects?.length??0})} · <span data-dxf-imported-rooms>${e("חדרים: {rooms} (דרך קבלת האזורים)",{rooms:m.rooms?.length??0})}</span></div>
            ${m.existing_auto.walls+m.existing_auto.openings+(m.existing_auto.objects??0)?r`<div class="note" data-dxf-imported-existing>${e("בטיוטת המבנה כבר יש פריטים מיובאים: קירות {walls} · פתחים {openings} · עצמים {objects}; בעורך אפשר להחליף אותם.",{walls:m.existing_auto.walls,openings:m.existing_auto.openings,objects:m.existing_auto.objects??0})}</div>`:c}
            ${this.canStructure?r`<div class="row" style="margin-block-start:6px">
                  <sw-button variant="primary" size="sm" icon="edit" data-dxf-open-editor @click=${()=>this.openEditorWithCandidates()}>${e("המשך לעורך")}</sw-button>
                  <span class="note">${e('העורך ייפתח בכלי "זיהוי" עם המועמדים בשכבה מקווקווה; שם מאשרים או דוחים. שום דבר לא נשמר עד האישור.')}</span>
                </div>`:r`<div class="note" data-dxf-no-edit>${this.canStructure===null?e("בודק הרשאות עריכה…"):e("אין לך הרשאת עריכת מבנה בקומה זו, ולכן אי אפשר לאשר את המועמדים. עורך הקומה יכול לייבא אותם מהמסך הזה.")}</div>`}`:c}
    </sw-card>`}async onFile(t){if(!(!t||!this.floorId)){this.busy=!0,this.error="";try{this.asset=await A(this.floorId,t),this.page=1,this.rotation=0,this.crop={x:0,y:0,w:1,h:1},this.version=null,this.step=this.asset.page_count>1?1:2,this.assets=[this.asset,...this.assets.filter(s=>s.id!==this.asset.id)]}catch(s){this.error=b(s)}finally{this.busy=!1}}}async save(){if(!(!this.asset||!this.floorId)){this.busy=!0,this.error="";try{const t=this.crop.x===0&&this.crop.y===0&&this.crop.w===1&&this.crop.h===1;this.version=await U(this.floorId,{asset_id:this.asset.id,page:this.page,rotation:this.rotation,crop:t?null:this.crop,notes:this.notes})}catch(t){this.error=b(t)}finally{this.busy=!1}}}async openPublish(){if(this.version){this.preview={data:null,error:""};try{const t=await X(this.version.id);this.preview&&(this.preview={data:t,error:""})}catch(t){this.preview={data:null,error:b(t)}}}}async publish(){if(this.version){this.busy=!0,this.error="";try{this.version=await N(this.version.id),this.preview=null}catch(t){this.error=b(t),this.preview&&(this.preview={...this.preview,error:b(t)})}finally{this.busy=!1}}}renderPublishPreview(){const t=this.preview;if(!t)return c;const s=t.data,a=s?.anchors;return r`<sw-dialog open heading=${e("פרסום התוכנית")} subheading=${e("מה ישתנה לצופים במפה")} data-import-publish-preview ?locked=${this.busy} @close=${()=>this.preview=null}>
      ${t.error?r`<div class="err">${t.error}</div>`:c}
      ${!s&&!t.error?r`<sw-state-panel state="loading" compact></sw-state-panel>`:c}
      ${s?r`<ul class="steps" data-import-publish-summary>
            <li>${s.from?e("מחליפה את הגרסה שפורסמה ב-{when}",{when:G(new Date(s.from.published_at??s.from.created_at))}):e("הרקע הראשון של הקומה")}</li>
            <li>${a?.total?`${e("{total} פריטים מוצבים: {carried} עוברים כמו שהם",{total:a.total,carried:a.carried})}${a.needs_alignment?e(", {n} דורשים בדיקת מיקום על הרקע החדש",{n:a.needs_alignment}):""}`:e("אין פריטים מוצבים על הקומה")}</li>
            <li>${s.geometry.same?e("המבנה (קירות, פתחים, עצמים) נשאר כפי שהוא"):e("המבנה משתנה ({length} שדות)",{length:s.geometry.changes.length})}</li>
          </ul>
          ${a?.items.filter(i=>i.outcome==="needs_alignment").slice(0,8).map(i=>r`<div class="note">· ${i.name}</div>`)}`:c}
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>this.preview=null}>${e("ביטול")}</sw-button>
        <sw-button variant="primary" icon="check" data-import-publish-confirm ?disabled=${this.busy||!s} @click=${()=>this.publish()}>${e("פרסם")}</sw-button>
      </div>
    </sw-dialog>`}setCrop(t,s){const a=Math.max(0,Math.min(100,s))/100,i={...this.crop,[t]:a};i.x+i.w>1&&(i.w=1-i.x),i.y+i.h>1&&(i.h=1-i.y),i.w<=.02&&(i.w=.02),i.h<=.02&&(i.h=.02),this.crop=i}previewUrl(){const t=this.asset?.pages.find(a=>a.page===this.page)??this.asset?.pages[0];if(!t)return"";const s=M(t.preview_url)+(this.previewBust?`${t.preview_url.includes("?")?"&":"?"}v=${this.previewBust}`:"");return this.rotation?`${s}${s.includes("?")?"&":"?"}rotation=${this.rotation}`:s}renderStep(){const t=this.asset;switch(this.step){case 0:return r`
          <label class="drop ${this.dragOver?"over":""}" @dragover=${s=>{s.preventDefault(),this.dragOver=!0}} @dragleave=${()=>this.dragOver=!1} @drop=${s=>{s.preventDefault(),this.dragOver=!1,this.onFile(s.dataTransfer?.files[0])}}>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dxf,application/pdf,image/png,image/jpeg,image/vnd.dxf" @change=${s=>void this.onFile(s.target.files?.[0])} />
            <div>
              <div class="ic"><sw-icon name="upload" size=${20}></sw-icon></div>
              <strong>${this.busy?e("מעלה…"):e("גרור לכאן PDF, תמונה או DXF של התוכנית, או לחץ לבחירה")}</strong>
              <small>${e("PDF עד 20 עמודים, PNG / JPG, DXF (AutoCAD; DWG יש להמיר) · עד 40 MB · הזיהוי לפי תוכן הקובץ · המקור נשמר ללא שינוי")}</small>
            </div>
          </label>
          ${this.assets.length?r`<div class="assets"><div class="note" style="margin-block-end:4px">${e("קבצים שכבר הועלו לקומה זו:")}</div>${this.assets.map(s=>r`<button @click=${()=>{this.asset=s,this.page=1,this.step=s.page_count>1?1:2}}><span>${s.original_name}</span><span class="ltr">${e("{n} עמ׳",{n:s.page_count})} · ${z(s.bytes)}</span></button>`)}</div>`:c}`;case 1:return r`<div class="note">${e("בחר את העמוד שמכיל את התוכנית של הקומה.")}</div>
          <div class="pages">${t?.pages.map(s=>r`<button class="pg ${s.page===this.page?"on":""}" @click=${()=>this.page=s.page}><img src=${M(s.preview_url)} alt=${e("עמוד {page}",{page:s.page})} loading="lazy" />${e("עמוד {page}",{page:s.page})}</button>`)}</div>`;case 2:{const s=this.crop,a=s.x===0&&s.y===0&&s.w===1&&s.h===1;return r`
          <div class="preview">
            <div class="frame" @pointerdown=${this.startCrop}>
              <img src=${this.previewUrl()} alt=${e("תצוגה מקדימה (אחרי סיבוב)")} />
              ${a?c:r`<div class="cropbox" style="left:${s.x*100}%;top:${s.y*100}%;width:${s.w*100}%;height:${s.h*100}%"></div>`}
              <div class="hint">${a?e("גרור מלבן על התוכנית כדי לחתוך"):e("חיתוך {w}%×{h}% · גרור שוב כדי לשנות",{w:Math.round(s.w*100),h:Math.round(s.h*100)})}</div>
            </div>
          </div>
          <div class="row">
            <sw-button size="sm" icon="refresh" @click=${()=>{this.rotation=(this.rotation+90)%360,this.crop={x:0,y:0,w:1,h:1}}}>${e("סובב 90°")}</sw-button>
            <sw-badge kind="neutral" label=${e("סיבוב {rotation}°",{rotation:this.rotation})}></sw-badge>
            <sw-button size="sm" variant="ghost" icon="fit" ?disabled=${a} @click=${()=>this.crop={x:0,y:0,w:1,h:1}}>${e("אפס חיתוך")}</sw-button>
            <span class="note">${e("התצוגה כבר מסובבת; המלבן המקווקו הוא בדיוק מה שיישמר. אפשר גם להזין אחוזים.")}</span>
          </div>
          <div class="two">
            <sw-field label=${e("שמאל %")}><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(s.x*100))} @change=${i=>this.setCrop("x",Number(i.target.value))} /></sw-field>
            <sw-field label=${e("עליון %")}><input type="number" min="0" max="98" data-ltr .value=${String(Math.round(s.y*100))} @change=${i=>this.setCrop("y",Number(i.target.value))} /></sw-field>
            <sw-field label=${e("רוחב %")}><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(s.w*100))} @change=${i=>this.setCrop("w",Number(i.target.value))} /></sw-field>
            <sw-field label=${e("גובה %")}><input type="number" min="2" max="100" data-ltr .value=${String(Math.round(s.h*100))} @change=${i=>this.setCrop("h",Number(i.target.value))} /></sw-field>
          </div>`}case 3:return r`
          <sw-field label=${e("קומה")}><input .value=${this.floor?.floor.name??""} disabled /></sw-field>
          <sw-field label=${e("הערות לגרסה (אופציונלי)")} hint=${e("למשל: תוכנית מעודכנת אחרי שיפוץ 2026")}><input .value=${this.notes} @input=${s=>this.notes=s.target.value} /></sw-field>
          <div class="note">${e("קנה מידה (מטרים לפיקסל) יכויל בעורך בשתי נקודות ומרחק ידוע; עד אז מרחקים מוצגים כמשוערים.")}</div>`;default:return r`
          ${this.version?r`<div class="ok"><sw-icon name="check" size=${14}></sw-icon>${e("הגרסה נשמרה ({w}×{h} px)",{w:this.version.width_px,h:this.version.height_px})} · ${this.version.status==="published"?e("פורסמה — היא הרקע של הקומה"):e("טיוטה — עורכי הקומה רואים אותה, צופים עדיין לא")}</div>
                <div class="preview" style="min-block-size:220px"><img src=${M(this.version.image_url)} alt=${e("רקע התוכנית")} /></div>`:r`<div class="note">${e("סיכום: {name} · עמוד {page} · סיבוב {rotation}° · חיתוך {w}%×{h}%. השמירה מייצרת רקע נגזר; המקור לא משתנה.",{name:t?.original_name??"",page:this.page,rotation:this.rotation,w:Math.round(this.crop.w*100),h:Math.round(this.crop.h*100)})}</div>`}
          <div class="row">
            ${this.version?c:r`<sw-button variant="primary" icon="check" ?disabled=${this.busy} @click=${()=>this.save()}>${e("שמור כטיוטה")}</sw-button>`}
            ${this.version&&this.version.status==="draft"?r`<sw-button variant="primary" icon="check" data-import-publish ?disabled=${this.busy} @click=${()=>void this.openPublish()}>${e("פרסום")}</sw-button>`:c}
            ${this.renderPublishPreview()}
            ${this.version?r`<sw-button icon="map" @click=${()=>_(`/explore/floors/${this.floorId}`)}>${e("פתח במפה")}</sw-button><sw-button variant="ghost" icon="edit" @click=${()=>_(`/explore/floors/${this.floorId}/edit`)}>${e("הצב מצלמות")}</sw-button>`:c}
          </div>
          ${t?.kind==="dxf"?this.renderDxfMap():c}`}}renderDemo(){return r`<sw-card><sw-state-panel icon="map" state="empty" heading=${e("ייבוא תוכנית עובד מול השרת")} hint=${e("בתצוגת ההדגמה אין שרת מחובר. במערכת המותקנת המסך מעלה PDF/PNG, בוחר עמוד, מסובב וחותך, ומפרסם גרסה.")}></sw-state-panel></sw-card>`}render(){const t=this.floor,s=this.step===0?!!this.asset:this.step===1?!!this.asset:!0;return r`
      <sw-page heading=${t?e("ייבוא תוכנית ל{name}",{name:t.floor.name}):e("ייבוא תוכנית")} subheading=${e("המקור נשמר ללא שינוי; כל תיקון הוא שכבה נגזרת")} crumbs=${t?`${e("אתרים")} | ${t.site.name} | ${t.building.name} | ${t.floor.name}`:e("אתרים")}>
        ${t&&!t.floor.has_plan&&!t.floor.draft_version_id?r`<sw-button slot="actions" variant="ghost" icon="mail" data-architect-request @click=${()=>q()}>${e("בקשה לאדריכל")}</sw-button>`:c}
        ${k()?!this.floorId||this.tree&&!t?r`<sw-state-panel icon="map" state="empty" heading=${e("בחר קומה")} hint=${e("ייבוא תוכנית מתחיל מדף הקומות.")}><div style="margin-block-start:10px"><sw-button variant="primary" @click=${()=>_("/explore/sites")}>${e("לאתרים")}</sw-button></div></sw-state-panel>`:r`
                <sw-card><sw-steps .steps=${D} .current=${this.step}></sw-steps></sw-card>
                <div class="layout">
                  <div class="stage">${this.renderStep()}${this.error?r`<div class="err">${this.error}</div>`:c}</div>
                  <div class="side">
                    <sw-card heading=${e("קובץ")}>
                      ${this.asset?r`<div class="note">${this.asset.original_name}</div><div class="row" style="margin-block-start:6px"><sw-badge kind="neutral" label=${`${this.asset.mime.split("/")[1].toUpperCase()} · ${z(this.asset.bytes)} · ${e("{n} עמ׳",{n:this.asset.page_count})}`}></sw-badge></div><div class="note ltr" style="margin-block-start:6px">sha256 ${this.asset.sha256.slice(0,16)}…</div>`:r`<div class="note">${e("עדיין לא נבחר קובץ.")}</div>`}
                    </sw-card>
                    ${this.renderDxf()}
                    <sw-card heading=${e("בטיחות")}>
                      <div class="note">${e("הקובץ מזוהה לפי תוכנו; PDF מרונדר בתהליך נפרד עם מגבלת זמן; SVG נדחה עד sanitization. תוכן טקסטואלי בתוך הקובץ הוא נתון בלבד.")}</div>
                    </sw-card>
                    <div class="foot">
                      <sw-button variant="ghost" icon="chevron" ?disabled=${this.step===0||this.busy} @click=${()=>this.step=Math.max(0,this.step-1)}>${e("הקודם")}</sw-button>
                      ${this.step<D.length-1?r`<sw-button variant="primary" ?disabled=${!s||this.busy} @click=${()=>this.step=Math.min(D.length-1,this.step+1)}>${e("הבא")}</sw-button>`:c}
                    </div>
                  </div>
                </div>`:this.renderDemo()}
      </sw-page>
    `}};d.styles=W`
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
    ${R}
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
      font-weight: var(--sw-fw-semibold);
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
  `;p([V()],d.prototype,"floorId",2);p([h()],d.prototype,"step",2);p([h()],d.prototype,"tree",2);p([h()],d.prototype,"assets",2);p([h()],d.prototype,"asset",2);p([h()],d.prototype,"page",2);p([h()],d.prototype,"rotation",2);p([h()],d.prototype,"crop",2);p([h()],d.prototype,"notes",2);p([h()],d.prototype,"version",2);p([h()],d.prototype,"preview",2);p([h()],d.prototype,"busy",2);p([h()],d.prototype,"error",2);p([h()],d.prototype,"dragOver",2);p([h()],d.prototype,"dxf",2);p([h()],d.prototype,"dxfLayers",2);p([h()],d.prototype,"dxfUnits",2);p([h()],d.prototype,"dxfBusy",2);p([h()],d.prototype,"previewBust",2);p([h()],d.prototype,"dxfEnt",2);p([h()],d.prototype,"dxfEntLoading",2);p([h()],d.prototype,"layerMap",2);p([h()],d.prototype,"blockMap",2);p([h()],d.prototype,"importing",2);p([h()],d.prototype,"importSecs",2);p([h()],d.prototype,"imported",2);p([h()],d.prototype,"dxfMapErr",2);p([h()],d.prototype,"dxfStale",2);p([h()],d.prototype,"canStructure",2);d=p([K("explore-plan-import")],d);export{d as ExplorePlanImport};
