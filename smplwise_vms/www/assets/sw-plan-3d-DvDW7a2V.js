import{k as It,l as Lt,W as Tt,o as x,q as $t,t as g,u as Rt,w as Dt,x as Ot,y as Ft,z as Nt,B as M,E as z,G as Bt,H as qt}from"./index-DjbdBU_b.js";import{S as V,P as Gt,O as Z,G as I,B as Ht,C as Ut,a as jt,R as Wt,W as Yt,b as K,c as Kt,L as Qt,d as J,e as Xt,f as Vt,D as L,A as N,H as B,g as Zt,N as Jt,M as tt,h as et,i as te,E as _,j as zt,k as st,l as ee,m as P,n as se,I as T,Q as $,V as S,o as R,p as ie,q as kt,r as oe,s as _t,F as Pt,t as ne}from"./three-DcroZdrW.js";const it=Math.SQRT2,q=Math.sqrt(3),G=Math.sqrt(6),A=[1/q,1/q,1/q],H=(()=>{const i=Math.hypot(1,.85,1);return[1/i,.85/i,1/i]})(),ae=[1/it,0,-1/it],re=[-1/G,2/G,-1/G],le=1.08,O=.7,he=60,ce=10,de=Math.cos(65*Math.PI/180),pe=new Set(["wall"]),ue=new Set(["lintel","sill","head","window","door","marker"]),fe=1,F=i=>i*Math.PI/180,ot=(i,t)=>i[0]*t[0]+i[1]*t[1]+i[2]*t[2];function At(i){const t=i.parts.filter(l=>l.kind==="floor"&&l.shape==="box");let e=1/0,s=1/0,o=-1/0,n=-1/0;for(const l of t)e=Math.min(e,l.position[0]-l.size[0]/2),o=Math.max(o,l.position[0]+l.size[0]/2),s=Math.min(s,l.position[2]-l.size[2]/2),n=Math.max(n,l.position[2]+l.size[2]/2);Number.isFinite(e)||([e,s,o,n]=[0,0,i.size[0],i.size[1]]);const a=i.levels.length?i.levels:[{id:"",elevation_m:0,ceiling_height_m:2.8}],r=Math.min(...a.map(l=>l.elevation_m)),d=Math.max(...a.map(l=>l.elevation_m+l.ceiling_height_m));return{x0:e,z0:s,x1:o,z1:n,y0:r,y1:d}}function me(i,t){const e=i.levels.find(c=>c.id===t),s=i.parts.filter(c=>c.level_id===t),o=s.find(c=>c.kind==="floor"&&c.shape==="box"),n=e?e.elevation_m:0,a=e?e.elevation_m+e.ceiling_height_m:n+2.8;if(o)return{x0:o.position[0]-o.size[0]/2,x1:o.position[0]+o.size[0]/2,z0:o.position[2]-o.size[2]/2,z1:o.position[2]+o.size[2]/2,y0:n,y1:a};if(!s.length)return{x0:0,z0:0,x1:i.size[0],z1:i.size[1],y0:n,y1:a};let r=1/0,d=1/0,l=-1/0,h=-1/0;for(const c of s){const p=Math.hypot(c.size[0],c.size[2])/2;r=Math.min(r,c.position[0]-p),l=Math.max(l,c.position[0]+p),d=Math.min(d,c.position[2]-p),h=Math.max(h,c.position[2]+p)}return{x0:r,z0:d,x1:l,z1:h,y0:n,y1:a}}function nt(i,t,e=le){const s=(i.x0+i.x1)/2,o=(i.y0+i.y1)/2,n=(i.z0+i.z1)/2;let a=1/0,r=-1/0,d=1/0,l=-1/0;for(const b of[i.x0,i.x1])for(const v of[i.y0,i.y1])for(const k of[i.z0,i.z1]){const m=[b-s,v-o,k-n],C=ot(m,ae),X=ot(m,re);a=Math.min(a,C),r=Math.max(r,C),d=Math.min(d,X),l=Math.max(l,X)}let h=Math.max((r-a)/2,1)*e,c=Math.max((l-d)/2,1)*e;const p=t>0&&Number.isFinite(t)?t:1;h/c<p?h=c*p:c=h/p;const u=Math.hypot(i.x1-i.x0,i.y1-i.y0,i.z1-i.z0);return{target:[s,o,n],halfW:h,halfH:c,dist:Math.max(u*2,20)}}function we(i,t,e,s){return(Math.atan2(t-s,i-e)*180/Math.PI%360+360)%360}function be(i,t=ce){const e=(i%360+360)%360;return(Math.floor(e/t)*t+t/2)%360}function ve(i,t,e,s=0){const o=F(i.rotation[1]),n=t-i.position[0],a=e-i.position[2],r=n*Math.cos(o)-a*Math.sin(o),d=n*Math.sin(o)+a*Math.cos(o);return Math.abs(r)<=i.size[0]/2+s&&Math.abs(d)<=i.size[2]/2+s}function ge(i,t,e=At(i)){const s=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,n=Math.cos(F(t)),a=Math.sin(F(t)),r=[];for(const l of i.parts){if(!pe.has(l.kind)||l.shape!=="box")continue;const h=l.position[0]-s,c=l.position[2]-o;if(Math.hypot(h,c)<1e-6||h*n+c*a<=0)continue;const u=F(l.rotation[1]);let b=Math.sin(u),v=Math.cos(u);b*h+v*c<0&&(b=-b,v=-v),!(b*n+v*a<de)&&r.push(l)}const d=new Set(r.map(l=>l.id));for(const l of i.parts)ue.has(l.kind)&&r.some(h=>h.level_id===l.level_id&&ve(h,l.position[0],l.position[2],fe))&&d.add(l.id);return[...d].sort()}function ye(i,t,e,s){return{w:Math.max(0,Math.min(i,Math.floor(e))),h:Math.max(0,Math.min(t,Math.floor(s)))}}function at(i,t,e=O){const s=i.size[1],o=i.position[1]-s/2,n=t+e;if(o>=n-1e-6)return null;if(o+s<=n+1e-6)return{y:i.position[1],h:s};const a=n-o;return{y:o+a/2,h:a}}const xe=.6,rt=3e3,lt=45,Me=8,Q=2048,ht={objectShadows:!0,lambertObjects:!1,shadowMapPx:Q,occlusion:!0},ct={objectShadows:!1,lambertObjects:!0,shadowMapPx:1024,occlusion:!0},dt=.28,Se=64,ze=6,ke=.35,_e=.88,Pe=8,D=Math.PI/2-.02,Ae=new Set(["glow","cone","tint"]),Ee=new Set(["wall","lintel","sill","head","door","object","connector","camera"]),Ce=new Set(["floor","wall","object","connector","room","tint","lintel","sill","head"]),Ie=new Set(["wall","lintel","sill","head","door","connector"]),pt=new Set(["chip","entity"]),Le=new Set(["wall","object","connector"]),Te=.5,E=(()=>{const i=Math.hypot(-.6,1.1,-.25);return[-.6/i,1.1/i,-.25/i]})(),$e="map-wall-3d",ut="map-structure",ft=.025,mt=16777215,wt=15133682,bt=2.1,vt=16774108,gt=3,Re=1.12,De=160,Oe=100,y=i=>i*Math.PI/180,yt=i=>i.kind==="object"&&Math.max(i.size[0],i.size[1],i.size[2])<xe,U=i=>i.kind==="floor"?"floor":i.color==="map-glass"?"glass":i.kind==="object"?"object":"std",j=(i,t)=>i.length===t.length&&i.every((e,s)=>e===t[s]),Fe=(i,t)=>{if(!i||!t)return i===t;if(i.length!==t.length)return!1;for(let e=0;e<i.length;e++)if(i[e][0]!==t[e][0]||i[e][1]!==t[e][1])return!1;return!0},Ne=(i,t)=>i.id===t.id&&i.kind===t.kind&&i.shape===t.shape&&i.color===t.color&&i.group===t.group&&i.level_id===t.level_id&&i.text===t.text&&j(i.position,t.position)&&j(i.size,t.size)&&j(i.rotation,t.rotation)&&Fe(i.polygon,t.polygon)&&(i.opacity===t.opacity||i.kind==="tint");function Be(i,t){if(i===t||i.parts.length!==t.parts.length||i.levels.length!==t.levels.length||i.size[0]!==t.size[0]||i.size[1]!==t.size[1])return!1;for(let s=0;s<i.levels.length;s++){const o=i.levels[s],n=t.levels[s];if(o.id!==n.id||o.elevation_m!==n.elevation_m||o.ceiling_height_m!==n.ceiling_height_m)return!1}let e=!1;for(let s=0;s<i.parts.length;s++){const o=i.parts[s],n=t.parts[s];if(!Ne(o,n))return!1;o.opacity!==n.opacity&&(e=!0)}return e}function qe(){const i=[-.5,.5],t=[];for(const s of i)for(const o of i)t.push(-.5,s,o,.5,s,o),t.push(s,-.5,o,s,.5,o),t.push(s,o,-.5,s,o,.5);const e=new _t;return e.setAttribute("position",new Pt(t,3)),e}function Ge(){const t=document.createElement("canvas");t.width=64,t.height=64;const e=t.getContext("2d");if(e){const o=e.createImageData(64,64);for(let n=0;n<64;n++)for(let a=0;a<64;a++){const r=Math.abs((a+.5)/64-.5)*2,d=Math.abs((n+.5)/64-.5)*2,l=Math.max(r,d),h=Math.min(1,Math.max(0,(l-.5)/.5)),c=(1-h*h*(3-2*h))*.42,p=(n*64+a)*4;o.data[p+3]=Math.round(c*255)}e.putImageData(o,0,0)}const s=new zt(t);return s.colorSpace=K,s}function He(i,t){const e=[];for(const r of i){const d=e[e.length-1];(!d||Math.hypot(r[0]-d[0],r[1]-d[1])>1e-6)&&e.push(r)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let s=0;for(let r=0;r<e.length;r++){const d=e[r],l=e[(r+1)%e.length];s+=d[0]*l[1]-l[0]*d[1]}if(Math.abs(s)<1e-8)return null;const o=ne.triangulateShape(e.map(([r,d])=>new kt(r,d)),[]),n=[];for(const[r,d,l]of o){const[h,c,p]=[e[r],e[d],e[l]];Math.abs((c[0]-h[0])*(p[1]-h[1])-(p[0]-h[0])*(c[1]-h[1]))<1e-10||(n.push(h[0],t,h[1],c[0],t,c[1],p[0],t,p[1]),n.push(h[0],0,h[1],p[0],0,p[1],c[0],0,c[1]))}for(let r=0;r<e.length;r++){const d=e[r],l=e[(r+1)%e.length];n.push(d[0],0,d[1],l[0],0,l[1],l[0],t,l[1],d[0],0,d[1],l[0],t,l[1],d[0],t,d[1])}const a=new _t;return a.setAttribute("position",new Pt(n,3)),a.computeVertexNormals(),a}class Et{constructor(t){this.opts=t,this.scene=new V,this.persp=new Gt(50,1,.05,2e3),this.ortho=new Z(-1,1,1,-1,.05,4e3),this.active=this.persp,this.root=new I,this.unitBox=new Ht(1,1,1),this.unitCylinder=new Ut(.5,.5,1,24),this.unitPlane=new jt(1,1).rotateX(-Math.PI/2),this.boxEdges=qe(),this.materials=new Map,this.aoMaterial=null,this.raycaster=new Wt,this.glowPool=[],this.lights=new I,this.sun=null,this.lookup=new Map,this.placed=new Map,this.tints=new Map,this.builds=0,this.smallGroups=[],this.outline=null,this.desc=null,this.extent=null,this.selectedId=null,this.preset="iso",this.orthoFrame=null,this.cutAzimuth=null,this.cutNow=new Set,this.caps=null,this.framed=!1,this.hideSmall=!1,this.heavy=!1,this.heavyOverride=null,this.disposed=!1,this.continuous=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.onDown=s=>{s.isPrimary&&(this.pressed={x:s.clientX,y:s.clientY,id:s.pointerId})},this.onUp=s=>{const o=this.pressed;!o||s.pointerId!==o.id||(this.pressed=null,!(s.button!==0||Math.hypot(s.clientX-o.x,s.clientY-o.y)>ze)&&this.opts.onSelect(this.pick(s.clientX,s.clientY)))},this.onCancel=s=>{this.pressed?.id===s.pointerId&&(this.pressed=null)},this.onMove=s=>{if(this.pressed||s.pointerType==="touch"||!s.isPrimary)return;const o=this.pick(s.clientX,s.clientY),n=o?o.partId:null;if(n===this.lastHover)return;this.lastHover=n;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(o,s.clientX-a.left,s.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const s=this.controls.update();if(this.hideSmall){const a=this.active===this.ortho?this.ortho.top/(this.ortho.zoom||1)<lt/2:this.persp.position.distanceTo(this.controls.target)<lt;for(const r of this.smallGroups)r.visible=a}this.updateCutaway(),this.renderer.render(this.scene,this.active),this.opts.onDraw?.(),this.frames++;const o=performance.now();this.windowStart||(this.windowStart=o),this.windowFrames++,o-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(o-this.windowStart)),this.windowStart=o,this.windowFrames=0);const n=s||this.continuous;(!n||o-this.lastReport>=1e3)&&(this.lastReport=o,this.opts.onFrame(this.frames,this.fps)),n?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.quality=t.quality??1,this.renderer=new Yt({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(t.pixelRatio??Math.min(2,window.devicePixelRatio||1)),this.renderer.outputColorSpace=K,this.renderer.shadowMap.type=Kt,this.outlineMaterial=new Qt({color:new J(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new Xt(this.persp,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=D,this.controls.addEventListener("change",this.invalidate),this.scene.add(this.lights),this.applyQuality();for(let s=0;s<Me;s++){const o=new Vt(16777215,0,1,2);this.glowPool.push(o),this.scene.add(o)}this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.invalidate),this.resize()}get camera(){return this.active}getQuality(){return this.quality}config(){return this.heavyOverride??(this.heavy?ct:ht)}heavyConfig(){return{heavy:this.heavy,...this.config()}}setHeavyConfig(t){this.heavyOverride=t?{...this.heavy?ct:ht,...t}:null;for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,s=this.selectedId;this.desc=null,this.setDescription(e),this.setSelected(s)}this.invalidate()}rendererInfo(){const t=this.renderer.getContext(),e=t.getExtension("WEBGL_debug_renderer_info");return{vendor:String(e?t.getParameter(e.UNMASKED_VENDOR_WEBGL):t.getParameter(t.VENDOR)),renderer:String(e?t.getParameter(e.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER))}}benchFrames(t=60){const e=this.renderer.getContext(),s=new Uint8Array(4);this.controls.update(),this.updateCutaway();const o=()=>{this.renderer.render(this.scene,this.active),e.readPixels(0,0,1,1,e.RGBA,e.UNSIGNED_BYTE,s)};o();const n=performance.now();for(let a=0;a<t;a++)o();return(performance.now()-n)/t}setQuality(t){if(t!==this.quality){this.quality=t,this.applyQuality();for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,s=this.selectedId;this.setDescription(e),this.setSelected(s)}this.invalidate()}}applyQuality(){for(const t of[...this.lights.children])this.lights.remove(t),(t instanceof L||t instanceof N||t instanceof B)&&t.dispose();if(this.sun=null,this.cutAzimuth=null,this.cutNow.clear(),this.quality===2){this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=Zt,this.renderer.toneMappingExposure=Re,this.lights.add(new B(mt,wt,bt));const t=new L(vt,gt);t.castShadow=!0,t.shadow.mapSize.set(Q,Q),t.shadow.bias=-4e-4,t.shadow.normalBias=.03,this.lights.add(t),this.lights.add(t.target),this.sun=t,this.fitSun()}else{this.renderer.shadowMap.enabled=!1,this.renderer.toneMapping=Jt,this.renderer.toneMappingExposure=1,this.lights.add(new N(16777215,1.6));const t=new L(16777215,1.4);t.position.set(1,2,1.2),this.lights.add(t)}}fitSun(){const t=this.sun,e=this.extent;if(!t||!e)return;const s=(e.x0+e.x1)/2,o=(e.y0+e.y1)/2,n=(e.z0+e.z1)/2,a=Math.max(Math.hypot(e.x1-e.x0,e.y1-e.y0,e.z1-e.z0)/2,2)*1.05;t.position.set(s+E[0]*a*2,o+E[1]*a*2,n+E[2]*a*2),t.target.position.set(s,o,n),t.target.updateMatrixWorld();const r=this.config().shadowMapPx;t.shadow.mapSize.x!==r&&(t.shadow.mapSize.set(r,r),t.shadow.map?.dispose(),t.shadow.map=null);const d=t.shadow.camera;d.left=-a,d.right=a,d.top=a,d.bottom=-a,d.near=.1,d.far=a*4,d.updateProjectionMatrix(),t.shadow.needsUpdate=!0}material(t,e,s=!1,o="std"){const n=this.quality===2&&o==="object"&&this.config().lambertObjects,a=`${t}|${e}|${s?2:1}|${this.quality===2?n?"object-lambert":o:"l1"}`;let r=this.materials.get(a);if(!r){const d=s?{side:et,forceSinglePass:!0}:{},l=this.quality===2&&t===ut&&o==="std"?$e:t,h=new J(this.opts.color(l));let c;this.quality===2&&o==="glass"?c=new tt({color:h,roughness:.12,metalness:.25,transparent:!0,opacity:Math.max(e,.35),depthWrite:!1,side:et,forceSinglePass:!0}):this.quality===2&&!n?c=new tt({color:h,roughness:o==="floor"?1:.88,metalness:0,transparent:e<1,opacity:e,depthWrite:e>=1,...d}):c=new te({color:h,transparent:e<1,opacity:e,depthWrite:e>=1,...d}),r={token:l,material:c},this.materials.set(a,r)}return r.material}recolour(){for(const{token:t,material:e}of this.materials.values())e.color.set(this.opts.color(t));this.outlineMaterial.color.set(this.opts.color("accent"))}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new _(y(e.rotation[0]),y(e.rotation[1]),y(e.rotation[2]),"YXZ"))}plateOpacity(t,e=this.desc){const s=e?.levels??[];if(t.kind!=="floor"||s.length<2)return t.opacity;const o=Math.min(...s.map(a=>a.elevation_m)),n=s.find(a=>a.id===t.level_id);return n&&n.elevation_m>o?Math.min(t.opacity,ke):t.opacity}shadows(t,e){if(this.quality!==2)return;const s=this.config().objectShadows;t.castShadow=(s?Ee:Ie).has(e.kind)&&e.color!=="map-glass",t.receiveShadow=Ce.has(e.kind)&&(s||e.kind!=="object")}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const s=e.getContext("2d");s&&(s.globalAlpha=_e,s.fillStyle=this.opts.color("surface"),s.beginPath(),s.roundRect(8,16,496,96,48),s.fill(),s.globalAlpha=1,s.fillStyle=this.opts.color(t.color),s.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',s.textAlign="center",s.textBaseline="middle",s.direction="rtl",s.fillText(t.text??"",256,66,480));const o=new zt(e);o.colorSpace=K;const n=new st(new ee({map:o,transparent:!0,depthTest:!0}));return n.position.set(t.position[0],t.position[1],t.position[2]),n.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),n}single(t,e){if(t.shape==="box"||t.shape==="cylinder"){const s=new P(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t,e),!1,U(t)));return this.transform(s,t),s.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),this.shadows(s,t),s}if(t.shape==="prism"){const s=He(t.polygon??[],t.size[1]);if(!s)return null;const o=this.material(t.color,t.opacity,!0,U(t)),n=t.kind==="tint"?o.clone():o,a=new P(s,n);return t.kind==="tint"&&(a.userData.ownMaterial=!0),a.position.set(t.position[0],t.position[1],t.position[2]),this.shadows(a,t),a}return pt.has(t.kind)?null:t.shape==="sprite"?this.label(t):null}occlusion(t,e){if(this.quality!==2||!this.config().occlusion)return null;const s=new Map(e.levels.map(p=>[p.id,p.elevation_m])),o=e.levels.length?Math.min(...e.levels.map(p=>p.elevation_m)):0,n=t.filter(p=>Le.has(p.kind)&&(p.shape==="box"||p.shape==="cylinder")&&p.position[1]-p.size[1]/2<=(s.get(p.level_id??"")??o)+Te);if(!n.length)return null;this.aoMaterial||(this.aoMaterial=new se({map:Ge(),color:0,transparent:!0,depthWrite:!1}));const a=new T(this.unitPlane,this.aoMaterial,n.length),r=new R,d=new $,l=new _,h=new S,c=new S;return n.forEach((p,u)=>{d.setFromEuler(l.set(0,y(p.rotation[1]),0,"YXZ")),h.set(p.position[0],p.position[1]-p.size[1]/2+.012,p.position[2]),c.set(p.size[0]+2*dt,1,p.size[2]+2*dt),r.compose(h,d,c),a.setMatrixAt(u,r)}),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),a.name="ao",a.renderOrder=1,a}realise(t,e){const s={root:new I,lookup:new Map,small:[],placed:new Map,glows:[],ao:null},o=new Map,n=[];for(const c of t)if(c.group&&(c.shape==="box"||c.shape==="cylinder")){const p=o.get(c.group);p?p.push(c):o.set(c.group,[c])}else n.push(c);const a=new R,r=new $,d=new S,l=new S,h=new _;for(const[c,p]of o){const u=p[0],b=new T(u.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(u.color,u.opacity,!1,U(u)),p.length);p.forEach((v,k)=>{r.setFromEuler(h.set(y(v.rotation[0]),y(v.rotation[1]),y(v.rotation[2]),"YXZ")),d.set(v.position[0],v.position[1],v.position[2]),l.set(Math.max(v.size[0],.001),Math.max(v.size[1],.001),Math.max(v.size[2],.001)),a.compose(d,r,l),b.setMatrixAt(k,a),s.placed.set(v.id,{obj:b,index:k,part:v})}),b.instanceMatrix.needsUpdate=!0,b.computeBoundingSphere(),b.name=c,this.shadows(b,u),s.lookup.set(b,p),s.root.add(b),p.every(yt)&&s.small.push(b)}for(const c of n){if(c.shape==="light"){s.glows.push(c);continue}const p=this.single(c,e);p&&(p.name=c.id,Ae.has(c.kind)||s.lookup.set(p,[c]),p instanceof P&&(c.shape==="box"||c.shape==="cylinder")&&s.placed.set(c.id,{obj:p,index:0,part:c}),s.root.add(p),yt(c)&&s.small.push(p))}return s.ao=this.occlusion(t,e),s.ao&&s.root.add(s.ao),s}disposeGroup(t){for(const e of[...t.children])t.remove(e),e instanceof T?e.dispose():e instanceof P&&e.geometry!==this.unitBox&&e.geometry!==this.unitCylinder&&e.geometry.dispose(),e instanceof P&&e.userData.ownMaterial&&!Array.isArray(e.material)&&e.material.dispose(),e instanceof st&&(e.material.map?.dispose(),e.material.dispose())}clear(){this.setSelected(null),this.disposeGroup(this.root);for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.placed.clear(),this.tints.clear(),this.smallGroups=[],this.cutAzimuth=null,this.cutNow.clear(),this.caps=null}setDescription(t){if(this.desc&&Be(this.desc,t)){for(const o of t.parts){if(o.kind!=="tint")continue;const n=this.tints.get(o.id);n&&!Array.isArray(n.material)&&(n.material.opacity=o.opacity)}this.desc=t,this.invalidate();return}this.clear(),this.recolour(),this.desc=t,this.extent=At(t),this.heavy=t.parts.length>rt,this.builds++;const e=this.realise(t.parts,t);for(const o of[...e.root.children])this.root.add(o),o instanceof P&&o.userData.ownMaterial&&this.tints.set(o.name,o);this.lookup=e.lookup,this.placed=e.placed,this.smallGroups=e.small;let s=0;for(const o of e.glows){const n=this.glowPool[s++];n&&(n.color.set(this.opts.color(o.color)),n.intensity=Pe,n.distance=Math.max(o.size[0],1),n.position.set(o.position[0],o.position[1],o.position[2]))}if(this.hideSmall=t.parts.length>rt,!this.hideSmall)for(const o of this.smallGroups)o.visible=!0;this.fitSun(),this.framed||(this.framed=this.setPreset("iso")),this.updateCutaway(),this.invalidate()}setSelected(t){if(this.selectedId=t,this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(n=>n.userData.id===t&&n.kind!=="cone"&&n.kind!=="floor"&&n.kind!=="tint"&&!pt.has(n.kind)&&(n.shape==="box"||n.shape==="cylinder"||n.shape==="prism"||n.shape==="sprite")).slice(0,Se);if(!e.length)return;const s=new I,o=new Map(this.desc.levels.map(n=>[n.id,n.elevation_m]));for(const n of e){const a=new ie(this.boxEdges,this.outlineMaterial),r=this.cutNow.has(n.id)?at(n,o.get(n.level_id??"")??0,O):{y:n.position[1],h:n.size[1]};if(r){if(n.shape==="prism"){const d=n.polygon??[];if(!d.length)continue;const l=d.map(u=>u[0]),h=d.map(u=>u[1]),c=Math.max(...l)-Math.min(...l),p=Math.max(...h)-Math.min(...h);a.position.set(n.position[0]+(Math.max(...l)+Math.min(...l))/2,n.position[1]+n.size[1]/2,n.position[2]+(Math.max(...h)+Math.min(...h))/2),a.scale.set(c*1.04+.05,n.size[1]*1.04+.05,p*1.04+.05)}else this.transform(a,n),a.position.y=r.y,a.scale.set(n.size[0]*1.06+.05,r.h*1.06+.05,(n.shape==="sprite"?.1:n.size[2])*1.06+.05);a.renderOrder=10,s.add(a)}}this.outline=s,this.root.add(s),this.invalidate()}useCamera(t){t!==this.active&&(this.active=t,this.controls.object=t)}applyOrthoFrame(){const t=this.orthoFrame;if(!t)return;const e=this.persp.aspect||1;let s=t.halfW,o=t.halfH;s/o<e?s=o*e:o=s/e,this.ortho.left=-s,this.ortho.right=s,this.ortho.top=o,this.ortho.bottom=-o,this.ortho.updateProjectionMatrix()}setPreset(t){const e=this.desc,s=this.extent;if(!e||!s)return!1;const o=(s.x0+s.x1)/2,n=(s.z0+s.z1)/2,a=s.x1-s.x0,r=s.z1-s.z0,d=(h,c)=>Math.max(c,h/(this.persp.aspect||1),4)/(2*Math.tan(y(this.persp.fov/2))),l=Math.max(0,...e.levels.map(h=>h.elevation_m+h.ceiling_height_m));if(t==="top")this.useCamera(this.persp),this.controls.maxPolarAngle=D,this.persp.position.set(o,l+d(a,r)*1.2,n+.001),this.controls.target.set(o,0,n);else if(t==="iso"){this.useCamera(this.ortho),this.controls.maxPolarAngle=D;const h=nt(s,this.persp.aspect||1);this.orthoFrame=h,this.ortho.zoom=1,this.applyOrthoFrame(),this.ortho.position.set(h.target[0]+A[0]*h.dist,h.target[1]+A[1]*h.dist,h.target[2]+A[2]*h.dist),this.controls.target.set(h.target[0],h.target[1],h.target[2])}else if(t==="persp"){this.useCamera(this.persp),this.controls.maxPolarAngle=D;const h=Math.hypot(a,r),c=d(h,h*.62)*1.45;this.persp.position.set(o+H[0]*c,H[1]*c,n+H[2]*c),this.controls.target.set(o,0,n)}else{const h=e.parts.find(p=>p.id===t.camera&&p.kind==="camera");if(!h)return!1;this.useCamera(this.persp);const c=new S(0,0,-1).applyEuler(new _(y(h.rotation[0]),y(h.rotation[1]),y(h.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.persp.position.set(h.position[0],h.position[1],h.position[2]),this.controls.target.set(h.position[0]+c.x*6,h.position[1]+c.y*6,h.position[2]+c.z*6)}return this.preset=t,this.controls.update(),this.updateCutaway(),this.invalidate(),!0}projectPoint(t){this.active.updateMatrixWorld();const e=new S(t[0],t[1],t[2]).project(this.active);if(e.z>1)return null;const s=this.opts.mount.clientWidth,o=this.opts.mount.clientHeight;return{x:(e.x+1)/2*s,y:(1-e.y)/2*o}}wantedCutAzimuth(){const t=this.extent;if(this.quality!==2||!t||typeof this.preset!="string")return null;const e=this.active.position;if(e.y<=t.y1)return null;const s=(t.x0+t.x1)/2,o=(t.z0+t.z1)/2;return Math.hypot(e.x-s,e.z-o)<.5?null:be(we(e.x,e.z,s,o))}writeBox(t,e,s){const o=t.part,n=new $().setFromEuler(new _(y(o.rotation[0]),y(o.rotation[1]),y(o.rotation[2]),"YXZ")),a=s<=0,r=new S(o.position[0],e,o.position[2]),d=a?new S(1e-4,1e-4,1e-4):new S(Math.max(o.size[0],.001),Math.max(s,.001),Math.max(o.size[2],.001));t.obj instanceof T?(t.obj.setMatrixAt(t.index,new R().compose(r,n,d)),t.obj.instanceMatrix.needsUpdate=!0):(t.obj.position.copy(r),t.obj.scale.copy(d))}updateCutaway(){const t=this.wantedCutAzimuth();if(t===this.cutAzimuth)return;this.cutAzimuth=t;const e=this.desc;if(!e||!this.extent)return;const s=new Set(t===null?[]:ge(e,t,this.extent)),o=new Map(e.levels.map(n=>[n.id,n.elevation_m]));for(const n of this.cutNow){if(s.has(n))continue;const a=this.placed.get(n);a&&this.writeBox(a,a.part.position[1],a.part.size[1])}for(const n of s){if(this.cutNow.has(n))continue;const a=this.placed.get(n);if(!a)continue;const r=at(a.part,o.get(a.part.level_id??"")??0,O);r?this.writeBox(a,r.y,r.h):this.writeBox(a,(o.get(a.part.level_id??"")??0)-1,0)}this.cutNow=s,this.rebuildCaps(o),this.sun&&(this.sun.shadow.needsUpdate=!0),this.selectedId&&this.setSelected(this.selectedId)}rebuildCaps(t){this.caps&&(this.root.remove(this.caps),this.caps.dispose(),this.caps=null);const e=[...this.cutNow].sort().map(r=>this.placed.get(r)).filter(r=>!!r&&r.part.kind==="wall");if(!e.length||this.quality!==2)return;const s=new T(this.unitBox,this.material(ut,1,!1,"floor"),e.length),o=new R,n=new $,a=new _;e.forEach((r,d)=>{const l=r.part,h=(t.get(l.level_id??"")??0)+O;n.setFromEuler(a.set(y(l.rotation[0]),y(l.rotation[1]),y(l.rotation[2]),"YXZ")),o.compose(new S(l.position[0],h+ft/2-.004,l.position[2]),n,new S(l.size[0]+.004,ft,l.size[2]+.004)),s.setMatrixAt(d,o)}),s.instanceMatrix.needsUpdate=!0,s.computeBoundingSphere(),s.name="caps",s.castShadow=!0,this.caps=s,this.root.add(s)}cutawayNow(){return[...this.cutNow].sort()}get buildCount(){return this.builds}pick(t,e){const s=this.renderer.domElement.getBoundingClientRect();if(!s.width||!s.height)return null;this.raycaster.setFromCamera(new kt((t-s.left)/s.width*2-1,-((e-s.top)/s.height)*2+1),this.active);const o=[...this.lookup.keys()].filter(n=>n.visible);for(const n of this.raycaster.intersectObjects(o,!1)){const a=this.lookup.get(n.object);if(!a)continue;const r=a[n.instanceId??0];if(r){if(r.kind==="floor"){if(this.plateOpacity(r)<1)continue;return null}return{id:r.userData.id,kind:r.userData.kind,partId:r.id}}}return null}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.persp.aspect=t/e,this.persp.updateProjectionMatrix(),this.applyOrthoFrame(),this.invalidate()}redrawNow(){this.disposed||(cancelAnimationFrame(this.raf),this.raf=0,this.frame())}capture(){return this.controls.update(),this.updateCutaway(),this.renderer.render(this.scene,this.active),this.renderer.domElement.toDataURL("image/png")}renderThumbnail(t,e,s=De,o=Oe){const n=t.parts.filter(m=>m.level_id===e&&m.kind!=="cone"&&m.shape!=="sprite"&&m.shape!=="light");if(!t.levels.some(m=>m.id===e))return null;const a={...t,levels:t.levels.filter(m=>m.id===e),parts:n},r=this.realise(n,a),d=new V;if(d.add(r.root),this.quality===2){d.add(new B(mt,wt,bt));const m=new L(vt,gt);m.position.set(E[0]*50,E[1]*50,E[2]*50),d.add(m)}else{d.add(new N(16777215,1.6));const m=new L(16777215,1.4);m.position.set(1,2,1.2),d.add(m)}const l=this.renderer.domElement,h=this.renderer.getPixelRatio(),{w:c,h:p}=ye(s,o,l.width/h,l.height/h);if(c<8||p<8)return this.disposeGroup(r.root),null;const u=nt(me(t,e),c/p),b=new Z(-u.halfW,u.halfW,u.halfH,-u.halfH,.05,4e3);b.position.set(u.target[0]+A[0]*u.dist,u.target[1]+A[1]*u.dist,u.target[2]+A[2]*u.dist),b.lookAt(u.target[0],u.target[1],u.target[2]),b.updateProjectionMatrix();let v=null;const k=this.renderer.shadowMap.enabled;try{this.renderer.shadowMap.enabled=!1,this.renderer.setScissorTest(!0),this.renderer.setScissor(0,0,c,p),this.renderer.setViewport(0,0,c,p),this.renderer.render(d,b);const m=document.createElement("canvas");m.width=c,m.height=p;const C=m.getContext("2d");C&&(C.drawImage(l,0,l.height-p*h,c*h,p*h,0,0,c,p),v=m.toDataURL("image/png"))}catch(m){console.warn("sw-plan-3d: thumbnail failed",m)}finally{this.renderer.setScissorTest(!1),this.renderer.setViewport(0,0,l.width/h,l.height/h),this.renderer.shadowMap.enabled=k,this.disposeGroup(r.root),this.invalidate()}return v}async exportGltf(){const t=new I;for(const s of this.root.children)s!==this.outline&&t.add(s.clone());return await new oe().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.invalidate),this.controls.removeEventListener("change",this.invalidate),this.controls.dispose(),this.clear();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.aoMaterial&&(this.aoMaterial.map?.dispose(),this.aoMaterial.dispose()),this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.unitPlane.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}function Ue(i,t,e,s,o){const n=document.createElement("div");n.setAttribute("aria-hidden","true"),n.dataset.skinControl="",n.style.cssText=`position:fixed;left:-1600px;top:0;width:${e}px;height:${s}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(n);let a=null;try{if(a=new Et({mount:n,color:t,onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1}),a.setDescription(i),!a.setPreset("iso"))return null;a.capture();const r=a.renderer.domElement;if(r.width!==e||r.height!==s)return null;const d=document.createElement("canvas");d.width=e,d.height=s;const l=d.getContext("2d");return l?(l.fillStyle=o,l.fillRect(0,0,e,s),l.drawImage(r,0,0),d.toDataURL("image/png")):null}catch(r){return console.warn("sw-plan-3d: control image failed",r),null}finally{a?.dispose(),n.remove()}}const Ct=2500,je=Ct+1500,We=1e4,Ye=3,Ke=3e3;function Qe(i,t,e){return new Promise(s=>{let o=!1;const n=setTimeout(()=>{o||(o=!0,s(e))},t);i.then(a=>{o||(o=!0,clearTimeout(n),s(a))},()=>{o||(o=!0,clearTimeout(n),s(e))})})}var Xe=Object.defineProperty,Ve=Object.getOwnPropertyDescriptor,w=(i,t,e,s)=>{for(var o=s>1?void 0:s?Ve(t,e):t,n=i.length-1,a;n>=0;n--)(a=i[n])&&(o=(s?a(t,e,o):a(o))||o);return s&&o&&Xe(t,e,o),o};const Ze="ייצוא glTF נכשל",Je="עבר לרמה סכמטית — קצב הפריימים היה נמוך",ts=4e3,xt="sw.plan3d.quality",W="sw.plan3d.fallback",es=30,ss=6;function is(i){return i.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}const os={wall:"קיר",opening:"פתח",object:"עצם",connector:"מחבר",camera:"מצלמה",entity:"ישות",zone:"חדר",label:"תווית",level:"מפלס"},Mt=(i,t)=>{try{return(i==="local"?localStorage:sessionStorage).getItem(t)}catch{return null}},Y=(i,t,e)=>{try{const s=i==="local"?localStorage:sessionStorage;e===null?s.removeItem(t):s.setItem(t,e)}catch{}},St=i=>i===2||i==="2"?2:i===1||i==="1"?1:null;let f=class extends It{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.frameKey=null,this.cameras=[],this.labels={},this.exportName="plan-3d",this.levels=[],this.activeLevel=null,this.thumbnailScene=null,this.levelDots={},this.qualityDefault=null,this.minFps=es,this.continuous=!1,this.hover=null,this.overlays=[],this.overlayById=new Map,this.hiddenPills=0,this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.chosen=St(Mt("local",xt)),this.installDefault=null,this.fallback=Mt("session",W)==="1",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null,this.probe=null,this.probeTimer=0,this.probed=!1,this.probePending=!1,this.thumbs=new Map,this.thumbsFor=null,this.thumbsQuality=null,this.thumbPass=0,this.settingsAsked=!1,this.onVisibility=()=>{document.hidden?this.probe&&(this.endProbe(!1),this.probePending=!0):this.probePending&&this.quality===2&&this.view&&this.startProbe()}}firstUpdated(){this.watchBar(),this.init()}watchBar(){const i=this.renderRoot.querySelector(".bar");!i||typeof ResizeObserver>"u"||(this.barRo?.disconnect(),this.barRo=new ResizeObserver(()=>{const t=Math.ceil(i.getBoundingClientRect().height);t>0&&this.style.setProperty("--bar-h",`${t}px`)}),this.barRo.observe(i))}connectedCallback(){super.connectedCallback(),this.hasUpdated&&!this.view&&this.init(),document.addEventListener("visibilitychange",this.onVisibility)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("visibilitychange",this.onVisibility),this.ro?.disconnect(),this.barRo?.disconnect(),cancelAnimationFrame(this.thumbPass),this.thumbPass=0,this.endProbe(!1),this.probed=!1,this.probePending=!1,this.view?.dispose(),this.view=null,this.applied=null,this.thumbs.clear(),this.thumbsFor=null,window.clearTimeout(this.toastTimer)}get quality(){return this.fallback?1:this.chosen??this.qualityDefault??this.installDefault??1}init(){if(this.chosen===null&&this.qualityDefault===null&&this.installDefault===null&&!this.settingsAsked){this.settingsAsked=!0,Qe(Lt().then(i=>St(i["plan.quality"])??1),Ke,1).then(i=>{this.installDefault=i}).finally(()=>{this.isConnected&&!this.view&&this.init()});return}try{this.view=new Et({mount:this.stage,color:i=>getComputedStyle(this).getPropertyValue(`--sw-${i}`).trim()||"#888888",onSelect:i=>this.emitSelect(i),onHover:(i,t,e)=>this.setHover(i,t,e),onFrame:(i,t)=>{this.setAttribute("data-frames",String(i)),this.setAttribute("data-fps",String(t)),this.onProbeFrame(i)},onDraw:()=>this.layoutOverlays(),quality:this.quality})}catch(i){console.warn("sw-plan-3d: WebGL failed to start",i),this.error=Tt;return}this.view.setContinuous(this.continuous),this.ro=new ResizeObserver(()=>this.view?.resize()),this.ro.observe(this),this.presetApplied=!1,this.setAttribute("data-quality",String(this.quality)),this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}willUpdate(i){if(!(i.has("description")||i.has("activeLevel")||i.has("selectedId")||i.has("hover")))return;const t=this.description?.parts??[],e=t.filter(o=>o.kind==="chip");let s=t.filter(o=>o.kind==="entity"&&(!this.activeLevel||o.level_id===this.activeLevel));if(this.hiddenPills=0,s.length>he){const o=s.filter(n=>n.userData.id===this.selectedId||n.userData.id===this.hover?.id||n.color!=="text-3");this.hiddenPills=s.length-o.length,s=o}this.overlays=[...e,...s],this.overlayById=new Map(this.overlays.map(o=>[o.id,o]))}updated(i){if(!this.view)return;const t=i.has("frameKey")&&i.get("frameKey")!==void 0;t&&(this.presetApplied=!1),i.has("description")&&this.description&&this.apply(this.description),t&&!this.presetApplied&&this.applied&&this.frame(),(i.has("selectedId")||i.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),i.has("preset")&&i.get("preset")!==void 0&&this.applyPreset(this.preset),i.has("continuous")&&!this.probe&&this.view.setContinuous(this.continuous),this.applyQuality(),this.layoutOverlays()}layoutOverlays(){const i=this.view;if(!i||!this.overlays.length)return;this.renderRoot.querySelectorAll("[data-3d-part]").forEach(e=>{const s=this.overlayById.get(e.getAttribute("data-3d-part")??""),o=s?i.projectPoint(s.position):null;if(!s||!o){e.style.display="none";return}e.style.display="block",e.style.transform=s.kind==="chip"?`translate(${Math.round(o.x)}px, ${Math.round(o.y)}px) translate(-50%, -50%)`:`translate(${Math.round(o.x)}px, ${Math.round(o.y)-ss}px) translate(-50%, -100%)`})}apply(i){i!==this.applied&&(this.applied=i,this.view?.setDescription(i),this.setAttribute("data-parts",String(i.parts.length)),this.toggleAttribute("data-estimated",i.estimated),this.presetApplied||this.frame(),this.view?.setSelected(this.selectedId),this.quality===2&&!this.probed&&this.startProbe())}applyQuality(){const i=this.quality;this.setAttribute("data-quality",String(i)),!(!this.view||this.view.getQuality()===i)&&(this.view.setQuality(i),this.thumbs.clear(),this.probed=!1,i===2&&this.applied?this.startProbe():this.endProbe(!1),this.requestUpdate())}setQuality(i){this.chosen=i,Y("local",xt,String(i)),i===2&&this.fallback&&(this.fallback=!1,Y("session",W,null))}startProbe(){if(this.endProbe(!1),this.probed=!0,!(!this.view||this.minFps<=0)){if(document.hidden){this.probePending=!0;return}this.probePending=!1,this.probe={until:0,t0:0,f0:0,start:Number(this.getAttribute("data-frames")??0)},this.view.setContinuous(!0),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),We)}}onProbeFrame(i){const t=this.probe;if(!t)return;if(document.hidden){this.endProbe(!1),this.probePending=!0;return}const e=performance.now();if(!t.t0){if(i-t.start<Ye)return;t.t0=e,t.f0=i,t.until=e+Ct,window.clearTimeout(this.probeTimer),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),je);return}if(e<t.until)return;const s=(i-t.f0)*1e3/(e-t.t0);this.setAttribute("data-probe-fps",String(Math.round(s))),this.endProbe(!1),s<this.minFps&&this.fallBack()}endProbe(i){window.clearTimeout(this.probeTimer),this.probeTimer=0;const t=this.probe;if(this.probe=null,this.view?.setContinuous(this.continuous),i&&t&&document.hidden){this.probePending=!0;return}if(i&&t){const e=Number(this.getAttribute("data-frames")??0),s=t.t0?(e-t.f0)*1e3/Math.max(1,performance.now()-t.t0):0;this.setAttribute("data-probe-fps",String(Math.round(s))),s<this.minFps&&this.fallBack()}}fallBack(){this.fallback=!0,Y("session",W,"1")}frame(){this.presetApplied=!0,this.view?.setPreset(this.preset)?this.setAttribute("data-preset",typeof this.preset=="string"?this.preset:"camera"):this.view?.setPreset("iso")&&this.setAttribute("data-preset","iso")}applyPreset(i){this.view?.setPreset(i)&&this.setAttribute("data-preset",typeof i=="string"?i:"camera")}pickPreset(i){this.preset=i,this.applyPreset(i)}labelOf(i){return this.labels[i.id]??os[i.kind]??i.id}emitSelect(i){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:i?.id??null,kind:i?.kind??null},bubbles:!0,composed:!0}))}setHover(i,t,e){this.hover=i?{id:i.id,kind:i.kind,label:this.labelOf(i),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}pickLevel(i){const t=this.activeLevel===i?null:i;this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t},bubbles:!0,composed:!0}))}thumbFor(i){const t=this.thumbnailScene;if(!t||!this.view)return"";(this.thumbsFor!==t||this.thumbsQuality!==this.quality)&&(this.thumbs.clear(),this.thumbsFor=t,this.thumbsQuality=this.quality);const e=this.thumbs.get(i);return e===void 0&&this.scheduleThumbs(),e??""}scheduleThumbs(){this.thumbPass||(this.thumbPass=requestAnimationFrame(()=>{this.thumbPass=0;const i=this.thumbnailScene,t=this.view;if(!i||!t||this.thumbsFor!==i)return;let e=!1;for(const s of this.levels){if(this.thumbs.has(s.id))continue;const o=t.renderThumbnail(i,s.id);o&&(this.thumbs.set(s.id,o),e=!0)}e&&t.redrawNow(),this.setAttribute("data-3d-thumbs",String(this.thumbs.size)),e&&this.requestUpdate()}))}get thumbnailCount(){return this.thumbs.size}toScreen(i){return this.view?.projectPoint(i)??null}capture(){return this.view?.capture()??null}captureControl(i){return Ue(i,Ft,Ot,Dt,Rt)}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const i=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(i)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${is(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(i){console.warn("sw-plan-3d: glTF export failed",i),this.showToast(Ze)}finally{this.exporting=!1}}}showToast(i){this.toast=i,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",ts)}renderStrip(){if(this.levels.length<2||!this.thumbnailScene||!this.ready)return x;const i=[...this.levels].sort((t,e)=>e.elevation_m-t.elevation_m||(t.id<e.id?-1:1));return this.thumbs=$t(this.thumbs,i.map(t=>t.id)),g`<div class="strip" role="group" aria-label="מפלסים" data-3d-strip>
      ${i.map(t=>{const e=this.levelDots[t.id];return g`<button type="button" data-3d-thumb=${t.id} aria-pressed=${this.activeLevel===t.id?"true":"false"} title=${`${t.name} · ${t.elevation_m>=0?"+":"−"}${Math.abs(t.elevation_m).toFixed(1)} מ׳`} @click=${()=>this.pickLevel(t.id)}>
          <span class="pic"><img alt="" src=${this.thumbFor(t.id)} />${e&&(e.presence>0||e.open||e.lit)?g`<span class="dots" data-3d-dots=${t.id}>${e.presence>0?g`<i data-dot="presence" title="תנועה" style=${`--fade:${Math.max(.35,e.presence).toFixed(2)}`}></i>`:x}${e.open?g`<i data-dot="open" title="פתח פתוח"></i>`:x}${e.lit?g`<i data-dot="lit" title="תאורה דולקת"></i>`:x}</span>`:x}</span><span>${t.name}</span>
        </button>`})}
    </div>`}render(){const i=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,""),e=this.quality;return g`
      <div class="stage"></div>
      ${!this.ready&&!this.error?g`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>`:x}
      ${this.error?g`<div class="spinner err" data-3d-error>${this.error}</div>`:x}
      ${this.overlays.length?g`<div class="overlay">${this.overlays.map(s=>s.kind==="chip"?g`<span class="chip" aria-hidden="true" data-3d-chip=${s.userData.id} data-3d-chip-part=${s.id} data-3d-part=${s.id}>${s.text??""}</span>`:g`<button type="button" class="lbl" tabindex="-1" data-3d-label=${s.userData.id} data-3d-part=${s.id} aria-pressed=${this.selectedId===s.userData.id?"true":"false"} style=${`--lbl: var(--sw-${s.color})`} @click=${()=>this.emitSelect({id:s.userData.id,kind:s.userData.kind,partId:s.id})}>${s.text??""}</button>`)}${this.hiddenPills?g`<span class="more" data-3d-more=${this.hiddenPills} title="ישויות ללא מצב מיוחד מוסתרות במבט הכללי; בחירה ברשימה או במפלס מציגה אותן">+${this.hiddenPills} ישויות</span>`:x}</div>`:x}
      ${this.renderStrip()}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${i==="top"} @click=${()=>this.pickPreset("top")}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${i==="iso"} @click=${()=>this.pickPreset("iso")}>איזומטרי</sw-chip>
        <sw-chip data-preset-persp ?selected=${i==="persp"} @click=${()=>this.pickPreset("persp")}>פרספקטיבה</sw-chip>
        ${this.cameras.length?g`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${t} @change=${s=>this.onCameraChange(s)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map(s=>g`<option value=${s.id} ?selected=${s.id===t}>${s.label}</option>`)}
            </select>`:x}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-1 title="רמה סכמטית: חומרים שטוחים, בלי צללים" ?selected=${e===1} @click=${()=>this.setQuality(1)}>סכמטי</sw-chip>
        <sw-chip data-quality-2 title="רמה מלאה: צללים רכים, חומרים, חיתוך קירות" ?selected=${e===2} @click=${()=>this.setQuality(2)}>מלא</sw-chip>
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?"מייצא…":"ייצוא glTF"}</sw-button>
      </div>
      ${this.description?.estimated?g`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>`:x}
      ${this.fallback?g`<div class="note fb" role="status" data-3d-fallback>${Je}</div>`:x}
      ${this.toast?g`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:x}
      ${this.hover?g`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:x}
    `}onCameraChange(i){const t=i.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};f.styles=Nt`
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
    /* level 2: the sky-gradient backdrop behind the transparent canvas (the two map-sky tokens of the theme) */
    :host([data-quality='2']) {
      background: linear-gradient(180deg, var(--sw-map-sky) 0%, var(--sw-map-sky-horizon) 100%);
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
    .bar .sep {
      inline-size: 1px;
      block-size: 18px;
      background: var(--sw-border-strong);
    }
    /* the strip stands on the bar's side (inline-start of the RTL bar = the right edge), above it, growing upward:
       the host's floor buttons and level chips own the top edge, the note the other bottom corner */
    .strip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: max(52px, calc(20px + var(--bar-h, 0px)));
      z-index: var(--sw-z-map-ui);
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: calc(100% - 120px);
      overflow: auto;
      direction: rtl;
    }
    .strip button {
      display: grid;
      gap: 2px;
      padding: 4px;
      inline-size: 96px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      text-align: center;
    }
    .strip button img {
      display: block;
      inline-size: 88px;
      block-size: 55px;
      object-fit: contain;
      border-radius: 4px;
      background: var(--sw-surface-3);
    }
    .strip button[aria-pressed='true'] {
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      box-shadow: 0 0 0 1px var(--sw-accent);
    }
    .strip button span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .strip button .pic {
      position: relative;
    }
    /* the state dots (CR-006 1b): presence blue with the fade's opacity, an open opening red, a lit room warm - over the
       thumbnail's top-right corner (the strip is RTL: the inline start), never drawn into the cached picture */
    .strip button .dots {
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      display: flex;
      gap: 3px;
      pointer-events: none;
    }
    .strip button .dots i {
      display: block;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      box-shadow: 0 0 0 1.5px var(--sw-surface);
    }
    .strip button .dots i[data-dot='presence'] {
      background: var(--sw-map-presence);
      opacity: var(--fade, 1);
    }
    .strip button .dots i[data-dot='open'] {
      background: var(--sw-danger);
    }
    .strip button .dots i[data-dot='lit'] {
      background: var(--sw-map-lit);
    }
    .overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .chip,
    .lbl {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 1px 7px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      color: var(--sw-map-temp);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
      display: none;
    }
    /* an entity pill: its state token as the colour (stale / live / text-3), a click selects the entity as its
       sprite used to; the selected one carries the accent ring the 3D outline gives a box */
    .lbl {
      color: var(--lbl, var(--sw-text));
      pointer-events: auto;
      cursor: pointer;
    }
    .lbl[aria-pressed='true'] {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 1px var(--sw-accent);
    }
    /* the "+N" hint of the pill cap: the top start corner (the strip and the bar own the bottom) */
    .more {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 1px 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: rtl;
      white-space: nowrap;
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
    .note.fb {
      inset-block-end: 40px;
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
      .note:not(.fb) {
        display: none;
      }
      .note.fb {
        inset-block-end: auto;
        inset-block-start: 8px;
        inset-inline-end: 8px;
      }
      /* the phone: a row of small thumbnails above the bar instead of a column up the side */
      .strip {
        inset-inline-start: 8px;
        inset-block-end: max(44px, calc(12px + var(--bar-h, 0px)));
        flex-direction: row;
        max-inline-size: calc(100% - 16px);
        max-block-size: none;
        gap: 4px;
      }
      .strip button {
        inline-size: 64px;
        padding: 3px;
      }
      .strip button img {
        inline-size: 56px;
        block-size: 35px;
      }
    }
  `;w([M({attribute:!1})],f.prototype,"description",2);w([M()],f.prototype,"selectedId",2);w([M({attribute:!1})],f.prototype,"preset",2);w([M()],f.prototype,"frameKey",2);w([M({attribute:!1})],f.prototype,"cameras",2);w([M({attribute:!1})],f.prototype,"labels",2);w([M()],f.prototype,"exportName",2);w([M({attribute:!1})],f.prototype,"levels",2);w([M()],f.prototype,"activeLevel",2);w([M({attribute:!1})],f.prototype,"thumbnailScene",2);w([M({attribute:!1})],f.prototype,"levelDots",2);w([M({attribute:!1})],f.prototype,"qualityDefault",2);w([M({type:Number})],f.prototype,"minFps",2);w([M({type:Boolean,reflect:!0,attribute:"data-measure"})],f.prototype,"continuous",2);w([z()],f.prototype,"hover",2);w([z()],f.prototype,"ready",2);w([z()],f.prototype,"exporting",2);w([z()],f.prototype,"error",2);w([z()],f.prototype,"toast",2);w([z()],f.prototype,"chosen",2);w([z()],f.prototype,"installDefault",2);w([z()],f.prototype,"fallback",2);w([Bt(".stage")],f.prototype,"stage",2);f=w([qt("sw-plan-3d")],f);export{es as DEFAULT_MIN_FPS,W as FALLBACK_KEY,he as PILL_CAP,je as PROBE_FALLBACK_MS,We as PROBE_FIRST_FRAME_MS,Ct as PROBE_MS,Ye as PROBE_WARM_FRAMES,xt as QUALITY_KEY,Ke as SETTINGS_WAIT_MS,f as SwPlan3d};
//# sourceMappingURL=sw-plan-3d-DvDW7a2V.js.map
