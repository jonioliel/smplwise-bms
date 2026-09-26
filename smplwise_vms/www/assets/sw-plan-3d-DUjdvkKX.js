import{i as B,W as G,A as x,b as v,a as R,n as b,r as M,e as F,t as D}from"./index-Z2Bc0H0B.js";import{S as H,P as j,G as S,B as U,C as X,R as N,W,a as L,L as Y,b as E,O as V,A as q,D as K,c as Z,M as Q,d as J,E as P,e as tt,f as z,g as et,h as k,I as C,Q as st,V as y,i as it,j as ot,k as T,l as rt,m as $,F as I,n as nt}from"./three-Cd_z6Pdd.js";const at=.6,lt=3e3,ht=45,ct=8,pt=64,dt=6,ut=.35,mt=.88,ft=8,A=Math.PI/2-.02,wt=new Set(["glow","cone"]),f=i=>i*Math.PI/180,_=i=>i.kind==="object"&&Math.max(i.size[0],i.size[1],i.size[2])<at;function vt(){const i=[-.5,.5],t=[];for(const o of i)for(const s of i)t.push(-.5,o,s,.5,o,s),t.push(o,-.5,s,o,.5,s),t.push(o,s,-.5,o,s,.5);const e=new $;return e.setAttribute("position",new I(t,3)),e}function gt(i,t){const e=[];for(const a of i){const p=e[e.length-1];(!p||Math.hypot(a[0]-p[0],a[1]-p[1])>1e-6)&&e.push(a)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let o=0;for(let a=0;a<e.length;a++){const p=e[a],l=e[(a+1)%e.length];o+=p[0]*l[1]-l[0]*p[1]}if(Math.abs(o)<1e-8)return null;const s=nt.triangulateShape(e.map(([a,p])=>new T(a,p)),[]),r=[];for(const[a,p,l]of s){const[n,h,d]=[e[a],e[p],e[l]];Math.abs((h[0]-n[0])*(d[1]-n[1])-(d[0]-n[0])*(h[1]-n[1]))<1e-10||(r.push(n[0],t,n[1],h[0],t,h[1],d[0],t,d[1]),r.push(n[0],0,n[1],d[0],0,d[1],h[0],0,h[1]))}for(let a=0;a<e.length;a++){const p=e[a],l=e[(a+1)%e.length];r.push(p[0],0,p[1],l[0],0,l[1],l[0],t,l[1],p[0],0,p[1],l[0],t,l[1],p[0],t,p[1])}const c=new $;return c.setAttribute("position",new I(r,3)),c.computeVertexNormals(),c}class bt{constructor(t){this.opts=t,this.scene=new H,this.camera=new j(50,1,.05,2e3),this.root=new S,this.unitBox=new U(1,1,1),this.unitCylinder=new X(.5,.5,1,24),this.boxEdges=vt(),this.materials=new Map,this.raycaster=new N,this.glowPool=[],this.lookup=new Map,this.smallGroups=[],this.outline=null,this.desc=null,this.framed=!1,this.hideSmall=!1,this.disposed=!1,this.continuous=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.onDown=s=>{s.isPrimary&&(this.pressed={x:s.clientX,y:s.clientY,id:s.pointerId})},this.onUp=s=>{const r=this.pressed;!r||s.pointerId!==r.id||(this.pressed=null,!(s.button!==0||Math.hypot(s.clientX-r.x,s.clientY-r.y)>dt)&&this.opts.onSelect(this.pick(s.clientX,s.clientY)))},this.onCancel=s=>{this.pressed?.id===s.pointerId&&(this.pressed=null)},this.onMove=s=>{if(this.pressed||s.pointerType==="touch"||!s.isPrimary)return;const r=this.pick(s.clientX,s.clientY),c=r?r.partId:null;if(c===this.lastHover)return;this.lastHover=c;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(r,s.clientX-a.left,s.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const s=this.controls.update();if(this.hideSmall){const a=this.camera.position.distanceTo(this.controls.target)<ht;for(const p of this.smallGroups)p.visible=a}this.renderer.render(this.scene,this.camera),this.frames++;const r=performance.now();this.windowStart||(this.windowStart=r),this.windowFrames++,r-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(r-this.windowStart)),this.windowStart=r,this.windowFrames=0);const c=s||this.continuous;(!c||r-this.lastReport>=1e3)&&(this.lastReport=r,this.opts.onFrame(this.frames,this.fps)),c?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.renderer=new W({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),this.renderer.outputColorSpace=L,this.outlineMaterial=new Y({color:new E(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new V(this.camera,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=A,this.controls.addEventListener("change",this.invalidate),this.scene.add(new q(16777215,1.6));const o=new K(16777215,1.4);o.position.set(1,2,1.2),this.scene.add(o);for(let s=0;s<ct;s++){const r=new Z(16777215,0,1,2);this.glowPool.push(r),this.scene.add(r)}this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.invalidate),this.resize()}material(t,e,o=!1){const s=`${t}|${e}|${o?2:1}`;let r=this.materials.get(s);return r||(r={token:t,material:new Q({color:new E(this.opts.color(t)),transparent:e<1,opacity:e,depthWrite:e>=1,...o?{side:J,forceSinglePass:!0}:{}})},this.materials.set(s,r)),r.material}recolour(){for(const{token:t,material:e}of this.materials.values())e.color.set(this.opts.color(t));this.outlineMaterial.color.set(this.opts.color("accent"))}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new P(f(e.rotation[0]),f(e.rotation[1]),f(e.rotation[2]),"YXZ"))}plateOpacity(t){const e=this.desc?.levels??[];if(t.kind!=="floor"||e.length<2)return t.opacity;const o=Math.min(...e.map(r=>r.elevation_m)),s=e.find(r=>r.id===t.level_id);return s&&s.elevation_m>o?Math.min(t.opacity,ut):t.opacity}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const o=e.getContext("2d");o&&(o.globalAlpha=mt,o.fillStyle=this.opts.color("surface"),o.beginPath(),o.roundRect(8,16,496,96,48),o.fill(),o.globalAlpha=1,o.fillStyle=this.opts.color(t.color),o.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',o.textAlign="center",o.textBaseline="middle",o.direction="rtl",o.fillText(t.text??"",256,66,480));const s=new tt(e);s.colorSpace=L;const r=new z(new et({map:s,transparent:!0,depthTest:!0}));return r.position.set(t.position[0],t.position[1],t.position[2]),r.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),r}single(t){if(t.shape==="box"||t.shape==="cylinder"){const e=new k(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t)));return this.transform(e,t),e.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),e}if(t.shape==="prism"){const e=gt(t.polygon??[],t.size[1]);if(!e)return null;const o=new k(e,this.material(t.color,t.opacity,!0));return o.position.set(t.position[0],t.position[1],t.position[2]),o}return t.shape==="sprite"?this.label(t):null}clear(){this.setSelected(null);for(const t of[...this.root.children])this.root.remove(t),t instanceof C?t.dispose():t instanceof k&&t.geometry!==this.unitBox&&t.geometry!==this.unitCylinder&&t.geometry.dispose(),t instanceof z&&(t.material.map?.dispose(),t.material.dispose());for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.smallGroups=[]}setDescription(t){this.clear(),this.recolour(),this.desc=t;const e=new Map,o=[];for(const n of t.parts)if(n.group&&(n.shape==="box"||n.shape==="cylinder")){const h=e.get(n.group);h?h.push(n):e.set(n.group,[n])}else o.push(n);const s=new it,r=new st,c=new y,a=new y,p=new P;for(const[n,h]of e){const d=h[0],g=new C(d.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(d.color,d.opacity),h.length);h.forEach((w,O)=>{r.setFromEuler(p.set(f(w.rotation[0]),f(w.rotation[1]),f(w.rotation[2]),"YXZ")),c.set(w.position[0],w.position[1],w.position[2]),a.set(Math.max(w.size[0],.001),Math.max(w.size[1],.001),Math.max(w.size[2],.001)),s.compose(c,r,a),g.setMatrixAt(O,s)}),g.instanceMatrix.needsUpdate=!0,g.computeBoundingSphere(),g.name=n,this.lookup.set(g,h),this.root.add(g),h.every(_)&&this.smallGroups.push(g)}let l=0;for(const n of o){if(n.shape==="light"){const d=this.glowPool[l++];if(!d)continue;d.color.set(this.opts.color(n.color)),d.intensity=ft,d.distance=Math.max(n.size[0],1),d.position.set(n.position[0],n.position[1],n.position[2]);continue}const h=this.single(n);h&&(h.name=n.id,wt.has(n.kind)||this.lookup.set(h,[n]),this.root.add(h),_(n)&&this.smallGroups.push(h))}if(this.hideSmall=t.parts.length>lt,!this.hideSmall)for(const n of this.smallGroups)n.visible=!0;this.framed||(this.framed=this.setPreset("iso")),this.invalidate()}setSelected(t){if(this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(s=>s.userData.id===t&&s.kind!=="cone"&&s.kind!=="floor"&&(s.shape==="box"||s.shape==="cylinder"||s.shape==="prism"||s.shape==="sprite")).slice(0,pt);if(!e.length)return;const o=new S;for(const s of e){const r=new ot(this.boxEdges,this.outlineMaterial);if(s.shape==="prism"){const c=s.polygon??[];if(!c.length)continue;const a=c.map(h=>h[0]),p=c.map(h=>h[1]),l=Math.max(...a)-Math.min(...a),n=Math.max(...p)-Math.min(...p);r.position.set(s.position[0]+(Math.max(...a)+Math.min(...a))/2,s.position[1]+s.size[1]/2,s.position[2]+(Math.max(...p)+Math.min(...p))/2),r.scale.set(l*1.04+.05,s.size[1]*1.04+.05,n*1.04+.05)}else this.transform(r,s),r.scale.set(s.size[0]*1.06+.05,s.size[1]*1.06+.05,(s.shape==="sprite"?.1:s.size[2])*1.06+.05);r.renderOrder=10,o.add(r)}this.outline=o,this.root.add(o),this.invalidate()}setPreset(t){const e=this.desc;if(!e)return!1;const[o,s]=e.size,r=o/2,c=s/2,a=(l,n)=>Math.max(n,l/(this.camera.aspect||1),4)/(2*Math.tan(f(this.camera.fov/2))),p=Math.max(0,...e.levels.map(l=>l.elevation_m+l.ceiling_height_m));if(t==="top")this.controls.maxPolarAngle=A,this.camera.position.set(r,p+a(o,s)*1.2,c+.001),this.controls.target.set(r,0,c);else if(t==="iso"){this.controls.maxPolarAngle=A;const l=Math.hypot(o,s),n=a(l,l*.62)*1.45,h=new y(1,.85,1).normalize();this.camera.position.set(r+h.x*n,h.y*n,c+h.z*n),this.controls.target.set(r,0,c)}else{const l=e.parts.find(h=>h.id===t.camera&&h.kind==="camera");if(!l)return!1;const n=new y(0,0,-1).applyEuler(new P(f(l.rotation[0]),f(l.rotation[1]),f(l.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.camera.position.set(l.position[0],l.position[1],l.position[2]),this.controls.target.set(l.position[0]+n.x*6,l.position[1]+n.y*6,l.position[2]+n.z*6)}return this.controls.update(),this.invalidate(),!0}projectPoint(t){this.camera.updateMatrixWorld();const e=new y(t[0],t[1],t[2]).project(this.camera);if(e.z>1)return null;const o=this.opts.mount.clientWidth,s=this.opts.mount.clientHeight;return{x:(e.x+1)/2*o,y:(1-e.y)/2*s}}pick(t,e){const o=this.renderer.domElement.getBoundingClientRect();if(!o.width||!o.height)return null;this.raycaster.setFromCamera(new T((t-o.left)/o.width*2-1,-((e-o.top)/o.height)*2+1),this.camera);const s=[...this.lookup.keys()].filter(r=>r.visible);for(const r of this.raycaster.intersectObjects(s,!1)){const c=this.lookup.get(r.object);if(!c)continue;const a=c[r.instanceId??0];if(a){if(a.kind==="floor"){if(this.plateOpacity(a)<1)continue;return null}return{id:a.userData.id,kind:a.userData.kind,partId:a.id}}}return null}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.camera.aspect=t/e,this.camera.updateProjectionMatrix(),this.invalidate()}async exportGltf(){const t=new S;for(const o of this.root.children)o!==this.outline&&t.add(o.clone());return await new rt().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.invalidate),this.controls.removeEventListener("change",this.invalidate),this.controls.dispose(),this.clear();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}var xt=Object.defineProperty,yt=Object.getOwnPropertyDescriptor,m=(i,t,e,o)=>{for(var s=o>1?void 0:o?yt(t,e):t,r=i.length-1,c;r>=0;r--)(c=i[r])&&(s=(o?c(t,e,s):c(s))||s);return o&&s&&xt(t,e,s),s};const Mt="ייצוא glTF נכשל",St=4e3;function Pt(i){return i.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}const kt={wall:"קיר",opening:"פתח",object:"עצם",connector:"מחבר",camera:"מצלמה",entity:"ישות",zone:"חדר",label:"תווית",level:"מפלס"};let u=class extends B{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.cameras=[],this.labels={},this.exportName="plan-3d",this.continuous=!1,this.hover=null,this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null}firstUpdated(){this.init()}connectedCallback(){super.connectedCallback(),this.hasUpdated&&!this.view&&this.init()}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),this.view?.dispose(),this.view=null,this.applied=null,window.clearTimeout(this.toastTimer)}init(){try{this.view=new bt({mount:this.stage,color:i=>getComputedStyle(this).getPropertyValue(`--sw-${i}`).trim()||"#888888",onSelect:i=>this.emitSelect(i),onHover:(i,t,e)=>this.setHover(i,t,e),onFrame:(i,t)=>{this.setAttribute("data-frames",String(i)),this.setAttribute("data-fps",String(t))}})}catch(i){console.warn("sw-plan-3d: WebGL failed to start",i),this.error=G;return}this.view.setContinuous(this.continuous),this.ro=new ResizeObserver(()=>this.view?.resize()),this.ro.observe(this),this.presetApplied=!1,this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}updated(i){this.view&&(i.has("description")&&this.description&&this.apply(this.description),(i.has("selectedId")||i.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),i.has("preset")&&i.get("preset")!==void 0&&this.applyPreset(this.preset),i.has("continuous")&&this.view.setContinuous(this.continuous))}apply(i){i!==this.applied&&(this.applied=i,this.view?.setDescription(i),this.setAttribute("data-parts",String(i.parts.length)),this.toggleAttribute("data-estimated",i.estimated),this.presetApplied||(this.applyPreset(this.preset),this.presetApplied=!0),this.view?.setSelected(this.selectedId))}applyPreset(i){this.view?.setPreset(i)&&this.setAttribute("data-preset",typeof i=="string"?i:"camera")}pickPreset(i){this.preset=i,this.applyPreset(i)}labelOf(i){return this.labels[i.id]??kt[i.kind]??i.id}emitSelect(i){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:i?.id??null,kind:i?.kind??null},bubbles:!0,composed:!0}))}setHover(i,t,e){this.hover=i?{id:i.id,kind:i.kind,label:this.labelOf(i),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}toScreen(i){return this.view?.projectPoint(i)??null}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const i=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(i)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${Pt(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(i){console.warn("sw-plan-3d: glTF export failed",i),this.showToast(Mt)}finally{this.exporting=!1}}}showToast(i){this.toast=i,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",St)}render(){const i=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,"");return v`
      <div class="stage"></div>
      ${!this.ready&&!this.error?v`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>`:x}
      ${this.error?v`<div class="spinner err" data-3d-error>${this.error}</div>`:x}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${i==="top"} @click=${()=>this.pickPreset("top")}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${i==="iso"} @click=${()=>this.pickPreset("iso")}>איזומטרי</sw-chip>
        ${this.cameras.length?v`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${t} @change=${e=>this.onCameraChange(e)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map(e=>v`<option value=${e.id} ?selected=${e.id===t}>${e.label}</option>`)}
            </select>`:x}
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?"מייצא…":"ייצוא glTF"}</sw-button>
      </div>
      ${this.description?.estimated?v`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>`:x}
      ${this.toast?v`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:x}
      ${this.hover?v`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:x}
    `}onCameraChange(i){const t=i.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};u.styles=R`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 240px;
      background: var(--sw-map-bg);
      direction: ltr;
      overflow: hidden;
      border-radius: inherit;
    }
    .stage {
      position: absolute;
      inset: 0;
    }
    .stage canvas {
      inline-size: 100% !important;
      block-size: 100% !important;
    }
    .bar {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      max-inline-size: calc(100% - 24px);
      direction: rtl;
    }
    .bar select {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border: 1px solid var(--sw-border-strong);
      border-radius: 999px;
      padding: 4px 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 160px;
    }
    .tip {
      position: absolute;
      z-index: var(--sw-z-map-ui);
      pointer-events: none;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
      transform: translate(-50%, -140%);
    }
    .note {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      direction: rtl;
    }
    .spinner {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    .toast {
      position: absolute;
      inset-block-start: 12px;
      left: 50%; /* physical: centred whatever the direction */
      transform: translateX(-50%);
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 4px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
    }
    .err {
      color: var(--sw-danger);
    }
    @media (max-width: 640px) {
      .bar {
        inset-inline-start: 8px;
        inset-block-end: 8px;
        gap: 4px;
      }
      .note {
        display: none;
      }
    }
  `;m([b({attribute:!1})],u.prototype,"description",2);m([b()],u.prototype,"selectedId",2);m([b({attribute:!1})],u.prototype,"preset",2);m([b({attribute:!1})],u.prototype,"cameras",2);m([b({attribute:!1})],u.prototype,"labels",2);m([b()],u.prototype,"exportName",2);m([b({type:Boolean,reflect:!0,attribute:"data-measure"})],u.prototype,"continuous",2);m([M()],u.prototype,"hover",2);m([M()],u.prototype,"ready",2);m([M()],u.prototype,"exporting",2);m([M()],u.prototype,"error",2);m([M()],u.prototype,"toast",2);m([F(".stage")],u.prototype,"stage",2);u=m([D("sw-plan-3d")],u);export{u as SwPlan3d};
//# sourceMappingURL=sw-plan-3d-DUjdvkKX.js.map
