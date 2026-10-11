import{i as Ht,a1 as qt,a2 as Gt,a3 as q,a4 as Ut,a5 as jt,p as Wt,a6 as Yt,a7 as Kt,a8 as Qt,a9 as Xt,aa as Vt,t as x,ab as Zt,q as v,ac as G,ad as U,ae as Jt,af as te,ag as ee,ah as se,G as ie,ai as M,H as _,aj as oe,I as ne}from"./index-C6sfJKF5.js";import{ak as Es}from"./index-C6sfJKF5.js";import{S as st,P as ae,O as it,G as L,B as re,C as le,a as he,R as ce,W as de,b as Z,c as pe,L as ue,d as ot,e as fe,f as me,D as k,A as C,H as $,g as we,N as ge,M as nt,h as at,i as be,E as P,j as Ot,k as rt,l as ve,m as A,n as ye,I as O,Q as N,V as S,o as F,p as xe,q as Nt,r as Me,s as Ft,F as Rt,t as Se}from"./three-DcroZdrW.js";const lt=Math.SQRT2,j=Math.sqrt(3),W=Math.sqrt(6),E=[1/j,1/j,1/j],Y=(()=>{const s=Math.hypot(1,.85,1);return[1/s,.85/s,1/s]})(),_e=[1/lt,0,-1/lt],ke=[-1/W,2/W,-1/W],ze=1.08,B=.7,Pe=60,Ae=10,Ee=Math.cos(65*Math.PI/180),Ie=new Set(["wall"]),Te=new Set(["lintel","sill","head","window","door","marker"]),Le=1,H=s=>s*Math.PI/180,ht=(s,t)=>s[0]*t[0]+s[1]*t[1]+s[2]*t[2];function Dt(s){const t=s.parts.filter(r=>r.kind==="floor"&&r.shape==="box");let e=1/0,i=1/0,o=-1/0,n=-1/0;for(const r of t)e=Math.min(e,r.position[0]-r.size[0]/2),o=Math.max(o,r.position[0]+r.size[0]/2),i=Math.min(i,r.position[2]-r.size[2]/2),n=Math.max(n,r.position[2]+r.size[2]/2);Number.isFinite(e)||([e,i,o,n]=[0,0,s.size[0],s.size[1]]);const a=s.levels.length?s.levels:[{id:"",elevation_m:0,ceiling_height_m:2.8}],l=Math.min(...a.map(r=>r.elevation_m)),d=Math.max(...a.map(r=>r.elevation_m+r.ceiling_height_m));return{x0:e,z0:i,x1:o,z1:n,y0:l,y1:d}}function Ce(s,t){const e=s.levels.find(c=>c.id===t),i=s.parts.filter(c=>c.level_id===t),o=i.find(c=>c.kind==="floor"&&c.shape==="box"),n=e?e.elevation_m:0,a=e?e.elevation_m+e.ceiling_height_m:n+2.8;if(o)return{x0:o.position[0]-o.size[0]/2,x1:o.position[0]+o.size[0]/2,z0:o.position[2]-o.size[2]/2,z1:o.position[2]+o.size[2]/2,y0:n,y1:a};if(!i.length)return{x0:0,z0:0,x1:s.size[0],z1:s.size[1],y0:n,y1:a};let l=1/0,d=1/0,r=-1/0,h=-1/0;for(const c of i){const p=Math.hypot(c.size[0],c.size[2])/2;l=Math.min(l,c.position[0]-p),r=Math.max(r,c.position[0]+p),d=Math.min(d,c.position[2]-p),h=Math.max(h,c.position[2]+p)}return{x0:l,z0:d,x1:r,z1:h,y0:n,y1:a}}function ct(s,t,e=ze){const i=(s.x0+s.x1)/2,o=(s.y0+s.y1)/2,n=(s.z0+s.z1)/2;let a=1/0,l=-1/0,d=1/0,r=-1/0;for(const g of[s.x0,s.x1])for(const b of[s.y0,s.y1])for(const z of[s.z0,s.z1]){const w=[g-i,b-o,z-n],T=ht(w,_e),et=ht(w,ke);a=Math.min(a,T),l=Math.max(l,T),d=Math.min(d,et),r=Math.max(r,et)}let h=Math.max((l-a)/2,1)*e,c=Math.max((r-d)/2,1)*e;const p=t>0&&Number.isFinite(t)?t:1;h/c<p?h=c*p:c=h/p;const u=Math.hypot(s.x1-s.x0,s.y1-s.y0,s.z1-s.z0);return{target:[i,o,n],halfW:h,halfH:c,dist:Math.max(u*2,20)}}function $e(s,t,e,i){return(Math.atan2(t-i,s-e)*180/Math.PI%360+360)%360}function Oe(s,t=Ae){const e=(s%360+360)%360;return(Math.floor(e/t)*t+t/2)%360}function Ne(s,t,e,i=0){const o=H(s.rotation[1]),n=t-s.position[0],a=e-s.position[2],l=n*Math.cos(o)-a*Math.sin(o),d=n*Math.sin(o)+a*Math.cos(o);return Math.abs(l)<=s.size[0]/2+i&&Math.abs(d)<=s.size[2]/2+i}function Fe(s,t,e=Dt(s)){const i=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,n=Math.cos(H(t)),a=Math.sin(H(t)),l=[];for(const r of s.parts){if(!Ie.has(r.kind)||r.shape!=="box")continue;const h=r.position[0]-(r.pivot?r.pivot[0]:i),c=r.position[2]-(r.pivot?r.pivot[1]:o);if(Math.hypot(h,c)<1e-6||h*n+c*a<=0)continue;const u=H(r.rotation[1]);let g=Math.sin(u),b=Math.cos(u);g*h+b*c<0&&(g=-g,b=-b),!(g*n+b*a<Ee)&&l.push(r)}const d=new Set(l.map(r=>r.id));for(const r of s.parts)Te.has(r.kind)&&l.some(h=>h.level_id===r.level_id&&Ne(h,r.position[0],r.position[2],Le))&&d.add(r.id);return[...d].sort()}function Re(s,t,e,i){return{w:Math.max(0,Math.min(s,Math.floor(e))),h:Math.max(0,Math.min(t,Math.floor(i)))}}function dt(s,t,e=B){const i=s.size[1],o=s.position[1]-i/2,n=t+e;if(o>=n-1e-6)return null;if(o+i<=n+1e-6)return{y:s.position[1],h:i};const a=n-o;return{y:o+a/2,h:a}}const De=.6,pt=3e3,ut=45,Be=8,J=2048,ft={objectShadows:!0,lambertObjects:!1,shadowMapPx:J,occlusion:!0},mt={objectShadows:!1,lambertObjects:!0,shadowMapPx:1024,occlusion:!0},wt=.28,He=64,qe=6,Ge=.35,Ue=.88,gt=8,R=Math.PI/2-.02,je=new Set(["glow","cone","tint"]),We=new Set(["wall","lintel","sill","head","door","object","connector","camera"]),Ye=new Set(["floor","wall","object","connector","room","tint","lintel","sill","head"]),Ke=new Set(["wall","lintel","sill","head","door","connector"]),bt=new Set(["chip","entity"]),Qe=new Set(["wall","object","connector"]),Xe=.5,I=(()=>{const s=Math.hypot(-.6,1.1,-.25);return[-.6/s,1.1/s,-.25/s]})(),Ve="map-wall-3d",vt="map-structure",yt=.025,xt=16777215,Mt=15133682,St=2.1,_t=16774108,kt=3,Ze=1.12,zt=2767974,Pt=857124,At=.75,D=12570879,Et=.55,Je=.9,It=2.6,Tt=9347276,ts=160,es=100,y=s=>s*Math.PI/180,Lt=s=>s.kind==="object"&&Math.max(s.size[0],s.size[1],s.size[2])<De,K=s=>s.kind==="floor"?"floor":s.color==="map-glass"?"glass":s.kind==="object"?"object":"std",Q=(s,t)=>s.length===t.length&&s.every((e,i)=>e===t[i]),ss=(s,t)=>{if(!s||!t)return s===t;if(s.length!==t.length)return!1;for(let e=0;e<s.length;e++)if(s[e][0]!==t[e][0]||s[e][1]!==t[e][1])return!1;return!0},is=(s,t)=>s.id===t.id&&s.kind===t.kind&&s.shape===t.shape&&s.color===t.color&&s.group===t.group&&s.level_id===t.level_id&&s.text===t.text&&Q(s.position,t.position)&&Q(s.size,t.size)&&Q(s.rotation,t.rotation)&&ss(s.polygon,t.polygon)&&(s.opacity===t.opacity||s.kind==="tint");function os(s,t){if(s===t||s.parts.length!==t.parts.length||s.levels.length!==t.levels.length||s.size[0]!==t.size[0]||s.size[1]!==t.size[1])return!1;for(let i=0;i<s.levels.length;i++){const o=s.levels[i],n=t.levels[i];if(o.id!==n.id||o.elevation_m!==n.elevation_m||o.ceiling_height_m!==n.ceiling_height_m)return!1}let e=!1;for(let i=0;i<s.parts.length;i++){const o=s.parts[i],n=t.parts[i];if(!is(o,n))return!1;o.opacity!==n.opacity&&(e=!0)}return e}function ns(){const s=[-.5,.5],t=[];for(const i of s)for(const o of s)t.push(-.5,i,o,.5,i,o),t.push(i,-.5,o,i,.5,o),t.push(i,o,-.5,i,o,.5);const e=new Ft;return e.setAttribute("position",new Rt(t,3)),e}function as(){const t=document.createElement("canvas");t.width=64,t.height=64;const e=t.getContext("2d");if(e){const o=e.createImageData(64,64);for(let n=0;n<64;n++)for(let a=0;a<64;a++){const l=Math.abs((a+.5)/64-.5)*2,d=Math.abs((n+.5)/64-.5)*2,r=Math.max(l,d),h=Math.min(1,Math.max(0,(r-.5)/.5)),c=(1-h*h*(3-2*h))*.42,p=(n*64+a)*4;o.data[p+3]=Math.round(c*255)}e.putImageData(o,0,0)}const i=new Ot(t);return i.colorSpace=Z,i}function rs(s,t){const e=[];for(const l of s){const d=e[e.length-1];(!d||Math.hypot(l[0]-d[0],l[1]-d[1])>1e-6)&&e.push(l)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let i=0;for(let l=0;l<e.length;l++){const d=e[l],r=e[(l+1)%e.length];i+=d[0]*r[1]-r[0]*d[1]}if(Math.abs(i)<1e-8)return null;const o=Se.triangulateShape(e.map(([l,d])=>new Nt(l,d)),[]),n=[];for(const[l,d,r]of o){const[h,c,p]=[e[l],e[d],e[r]];Math.abs((c[0]-h[0])*(p[1]-h[1])-(p[0]-h[0])*(c[1]-h[1]))<1e-10||(n.push(h[0],t,h[1],c[0],t,c[1],p[0],t,p[1]),n.push(h[0],0,h[1],p[0],0,p[1],c[0],0,c[1]))}for(let l=0;l<e.length;l++){const d=e[l],r=e[(l+1)%e.length];n.push(d[0],0,d[1],r[0],0,r[1],r[0],t,r[1],d[0],0,d[1],r[0],t,r[1],d[0],t,d[1])}const a=new Ft;return a.setAttribute("position",new Rt(n,3)),a.computeVertexNormals(),a}class Bt{constructor(t){this.opts=t,this.scene=new st,this.persp=new ae(50,1,.05,2e3),this.ortho=new it(-1,1,1,-1,.05,4e3),this.active=this.persp,this.root=new L,this.unitBox=new re(1,1,1),this.unitCylinder=new le(.5,.5,1,24),this.unitPlane=new he(1,1).rotateX(-Math.PI/2),this.boxEdges=ns(),this.materials=new Map,this.aoMaterial=null,this.raycaster=new ce,this.glowPool=[],this.lights=new L,this.sun=null,this.lookup=new Map,this.placed=new Map,this.tints=new Map,this.builds=0,this.smallGroups=[],this.outline=null,this.desc=null,this.extent=null,this.selectedId=null,this.preset="iso",this.orthoFrame=null,this.cutAzimuth=null,this.cutNow=new Set,this.caps=null,this.night=!1,this.framed=!1,this.hideSmall=!1,this.heavy=!1,this.heavyOverride=null,this.disposed=!1,this.continuous=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.onDown=i=>{i.isPrimary&&(this.pressed={x:i.clientX,y:i.clientY,id:i.pointerId})},this.onUp=i=>{const o=this.pressed;!o||i.pointerId!==o.id||(this.pressed=null,!(i.button!==0||Math.hypot(i.clientX-o.x,i.clientY-o.y)>qe)&&this.opts.onSelect(this.pick(i.clientX,i.clientY)))},this.onCancel=i=>{this.pressed?.id===i.pointerId&&(this.pressed=null)},this.onMove=i=>{if(this.pressed||i.pointerType==="touch"||!i.isPrimary)return;const o=this.pick(i.clientX,i.clientY),n=o?o.partId:null;if(n===this.lastHover)return;this.lastHover=n;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(o,i.clientX-a.left,i.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const i=this.controls.update();if(this.hideSmall){const a=this.active===this.ortho?this.ortho.top/(this.ortho.zoom||1)<ut/2:this.persp.position.distanceTo(this.controls.target)<ut;for(const l of this.smallGroups)l.visible=a}this.updateCutaway(),this.renderer.render(this.scene,this.active),this.opts.onDraw?.(),this.frames++;const o=performance.now();this.windowStart||(this.windowStart=o),this.windowFrames++,o-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(o-this.windowStart)),this.windowStart=o,this.windowFrames=0);const n=i||this.continuous;(!n||o-this.lastReport>=1e3)&&(this.lastReport=o,this.opts.onFrame(this.frames,this.fps)),n?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.quality=t.quality??1,this.night=!!t.night,this.renderer=new de({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(t.pixelRatio??Math.min(2,window.devicePixelRatio||1)),this.renderer.outputColorSpace=Z,this.renderer.shadowMap.type=pe,this.outlineMaterial=new ue({color:new ot(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new fe(this.persp,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=R,this.controls.addEventListener("change",this.invalidate),this.scene.add(this.lights),this.applyQuality();for(let i=0;i<Be;i++){const o=new me(16777215,0,1,2);this.glowPool.push(o),this.scene.add(o)}this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.invalidate),this.resize()}get camera(){return this.active}getQuality(){return this.quality}config(){return this.heavyOverride??(this.heavy?mt:ft)}heavyConfig(){return{heavy:this.heavy,...this.config()}}setHeavyConfig(t){this.heavyOverride=t?{...this.heavy?mt:ft,...t}:null;for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.desc=null,this.setDescription(e),this.setSelected(i)}this.invalidate()}rendererInfo(){const t=this.renderer.getContext(),e=t.getExtension("WEBGL_debug_renderer_info");return{vendor:String(e?t.getParameter(e.UNMASKED_VENDOR_WEBGL):t.getParameter(t.VENDOR)),renderer:String(e?t.getParameter(e.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER))}}benchFrames(t=60){const e=this.renderer.getContext(),i=new Uint8Array(4);this.controls.update(),this.updateCutaway();const o=()=>{this.renderer.render(this.scene,this.active),e.readPixels(0,0,1,1,e.RGBA,e.UNSIGNED_BYTE,i)};o();const n=performance.now();for(let a=0;a<t;a++)o();return(performance.now()-n)/t}setNight(t){if(t!==this.night){this.night=t,this.applyQuality();for(const e of this.glowPool)e.intensity>0&&(e.intensity=gt*(t?It:1));this.invalidate()}}getNight(){return this.night}setQuality(t){if(t!==this.quality){this.quality=t,this.applyQuality();for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.setDescription(e),this.setSelected(i)}this.invalidate()}}applyQuality(){for(const e of[...this.lights.children])this.lights.remove(e),(e instanceof k||e instanceof C||e instanceof $)&&e.dispose();this.sun=null,this.cutAzimuth=null,this.cutNow.clear();const t=this.night;if(this.quality===2){this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=we,this.renderer.toneMappingExposure=t?Je:Ze,this.lights.add(t?new $(zt,Pt,At):new $(xt,Mt,St));const e=t?new k(D,Et):new k(_t,kt);e.castShadow=!0,e.shadow.mapSize.set(J,J),e.shadow.bias=-4e-4,e.shadow.normalBias=.03,this.lights.add(e),this.lights.add(e.target),this.sun=e,this.fitSun()}else{this.renderer.shadowMap.enabled=!1,this.renderer.toneMapping=ge,this.renderer.toneMappingExposure=1,this.lights.add(t?new C(Tt,.7):new C(16777215,1.6));const e=t?new k(D,.5):new k(16777215,1.4);e.position.set(1,2,1.2),this.lights.add(e)}}fitSun(){const t=this.sun,e=this.extent;if(!t||!e)return;const i=(e.x0+e.x1)/2,o=(e.y0+e.y1)/2,n=(e.z0+e.z1)/2,a=Math.max(Math.hypot(e.x1-e.x0,e.y1-e.y0,e.z1-e.z0)/2,2)*1.05;t.position.set(i+I[0]*a*2,o+I[1]*a*2,n+I[2]*a*2),t.target.position.set(i,o,n),t.target.updateMatrixWorld();const l=this.config().shadowMapPx;t.shadow.mapSize.x!==l&&(t.shadow.mapSize.set(l,l),t.shadow.map?.dispose(),t.shadow.map=null);const d=t.shadow.camera;d.left=-a,d.right=a,d.top=a,d.bottom=-a,d.near=.1,d.far=a*4,d.updateProjectionMatrix(),t.shadow.needsUpdate=!0}material(t,e,i=!1,o="std"){const n=this.quality===2&&o==="object"&&this.config().lambertObjects,a=`${t}|${e}|${i?2:1}|${this.quality===2?n?"object-lambert":o:"l1"}`;let l=this.materials.get(a);if(!l){const d=i?{side:at,forceSinglePass:!0}:{},r=this.quality===2&&t===vt&&o==="std"?Ve:t,h=new ot(this.opts.color(r));let c;this.quality===2&&o==="glass"?c=new nt({color:h,roughness:.12,metalness:.25,transparent:!0,opacity:Math.max(e,.35),depthWrite:!1,side:at,forceSinglePass:!0}):this.quality===2&&!n?c=new nt({color:h,roughness:o==="floor"?1:.88,metalness:0,transparent:e<1,opacity:e,depthWrite:e>=1,...d}):c=new be({color:h,transparent:e<1,opacity:e,depthWrite:e>=1,...d}),l={token:r,material:c},this.materials.set(a,l)}return l.material}recolour(){for(const{token:t,material:e}of this.materials.values())e.color.set(this.opts.color(t));this.outlineMaterial.color.set(this.opts.color("accent"))}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new P(y(e.rotation[0]),y(e.rotation[1]),y(e.rotation[2]),"YXZ"))}plateOpacity(t,e=this.desc){const i=e?.levels??[];if(t.kind!=="floor"||i.length<2)return t.opacity;const o=Math.min(...i.map(a=>a.elevation_m)),n=i.find(a=>a.id===t.level_id);return n&&n.elevation_m>o?Math.min(t.opacity,Ge):t.opacity}shadows(t,e){if(this.quality!==2)return;const i=this.config().objectShadows;t.castShadow=(i?We:Ke).has(e.kind)&&e.color!=="map-glass",t.receiveShadow=Ye.has(e.kind)&&(i||e.kind!=="object")}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const i=e.getContext("2d");i&&(i.globalAlpha=Ue,i.fillStyle=this.opts.color("surface"),i.beginPath(),i.roundRect(8,16,496,96,48),i.fill(),i.globalAlpha=1,i.fillStyle=this.opts.color(t.color),i.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',i.textAlign="center",i.textBaseline="middle",i.direction="rtl",i.fillText(t.text??"",256,66,480));const o=new Ot(e);o.colorSpace=Z;const n=new rt(new ve({map:o,transparent:!0,depthTest:!0}));return n.position.set(t.position[0],t.position[1],t.position[2]),n.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),n}single(t,e){if(t.shape==="box"||t.shape==="cylinder"){const i=new A(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t,e),!1,K(t)));return this.transform(i,t),i.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),this.shadows(i,t),i}if(t.shape==="prism"){const i=rs(t.polygon??[],t.size[1]);if(!i)return null;const o=this.material(t.color,t.opacity,!0,K(t)),n=t.kind==="tint"?o.clone():o,a=new A(i,n);return t.kind==="tint"&&(a.userData.ownMaterial=!0),a.position.set(t.position[0],t.position[1],t.position[2]),this.shadows(a,t),a}return bt.has(t.kind)?null:t.shape==="sprite"?this.label(t):null}occlusion(t,e){if(this.quality!==2||!this.config().occlusion)return null;const i=new Map(e.levels.map(p=>[p.id,p.elevation_m])),o=e.levels.length?Math.min(...e.levels.map(p=>p.elevation_m)):0,n=t.filter(p=>Qe.has(p.kind)&&(p.shape==="box"||p.shape==="cylinder")&&p.position[1]-p.size[1]/2<=(i.get(p.level_id??"")??o)+Xe);if(!n.length)return null;this.aoMaterial||(this.aoMaterial=new ye({map:as(),color:0,transparent:!0,depthWrite:!1}));const a=new O(this.unitPlane,this.aoMaterial,n.length),l=new F,d=new N,r=new P,h=new S,c=new S;return n.forEach((p,u)=>{d.setFromEuler(r.set(0,y(p.rotation[1]),0,"YXZ")),h.set(p.position[0],p.position[1]-p.size[1]/2+.012,p.position[2]),c.set(p.size[0]+2*wt,1,p.size[2]+2*wt),l.compose(h,d,c),a.setMatrixAt(u,l)}),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),a.name="ao",a.renderOrder=1,a}realise(t,e){const i={root:new L,lookup:new Map,small:[],placed:new Map,glows:[],ao:null},o=new Map,n=[];for(const c of t)if(c.group&&(c.shape==="box"||c.shape==="cylinder")){const p=o.get(c.group);p?p.push(c):o.set(c.group,[c])}else n.push(c);const a=new F,l=new N,d=new S,r=new S,h=new P;for(const[c,p]of o){const u=p[0],g=new O(u.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(u.color,u.opacity,!1,K(u)),p.length);p.forEach((b,z)=>{l.setFromEuler(h.set(y(b.rotation[0]),y(b.rotation[1]),y(b.rotation[2]),"YXZ")),d.set(b.position[0],b.position[1],b.position[2]),r.set(Math.max(b.size[0],.001),Math.max(b.size[1],.001),Math.max(b.size[2],.001)),a.compose(d,l,r),g.setMatrixAt(z,a),i.placed.set(b.id,{obj:g,index:z,part:b})}),g.instanceMatrix.needsUpdate=!0,g.computeBoundingSphere(),g.name=c,this.shadows(g,u),i.lookup.set(g,p),i.root.add(g),p.every(Lt)&&i.small.push(g)}for(const c of n){if(c.shape==="light"){i.glows.push(c);continue}const p=this.single(c,e);p&&(p.name=c.id,je.has(c.kind)||i.lookup.set(p,[c]),p instanceof A&&(c.shape==="box"||c.shape==="cylinder")&&i.placed.set(c.id,{obj:p,index:0,part:c}),i.root.add(p),Lt(c)&&i.small.push(p))}return i.ao=this.occlusion(t,e),i.ao&&i.root.add(i.ao),i}disposeGroup(t){for(const e of[...t.children])t.remove(e),e instanceof O?e.dispose():e instanceof A&&e.geometry!==this.unitBox&&e.geometry!==this.unitCylinder&&e.geometry.dispose(),e instanceof A&&e.userData.ownMaterial&&!Array.isArray(e.material)&&e.material.dispose(),e instanceof rt&&(e.material.map?.dispose(),e.material.dispose())}clear(){this.setSelected(null),this.disposeGroup(this.root);for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.placed.clear(),this.tints.clear(),this.smallGroups=[],this.cutAzimuth=null,this.cutNow.clear(),this.caps=null}setDescription(t){if(this.desc&&os(this.desc,t)){for(const o of t.parts){if(o.kind!=="tint")continue;const n=this.tints.get(o.id);n&&!Array.isArray(n.material)&&(n.material.opacity=o.opacity)}this.desc=t,this.invalidate();return}this.clear(),this.recolour(),this.desc=t,this.extent=Dt(t),this.heavy=t.parts.length>pt,this.builds++;const e=this.realise(t.parts,t);for(const o of[...e.root.children])this.root.add(o),o instanceof A&&o.userData.ownMaterial&&this.tints.set(o.name,o);this.lookup=e.lookup,this.placed=e.placed,this.smallGroups=e.small;let i=0;for(const o of e.glows){const n=this.glowPool[i++];n&&(n.color.set(this.opts.color(o.color)),n.intensity=gt*(this.night?It:1),n.distance=Math.max(o.size[0],1),n.position.set(o.position[0],o.position[1],o.position[2]))}if(this.hideSmall=t.parts.length>pt,!this.hideSmall)for(const o of this.smallGroups)o.visible=!0;this.fitSun(),this.framed||(this.framed=this.setPreset("iso")),this.updateCutaway(),this.invalidate()}setSelected(t){if(this.selectedId=t,this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(n=>n.userData.id===t&&n.kind!=="cone"&&n.kind!=="floor"&&n.kind!=="tint"&&!bt.has(n.kind)&&(n.shape==="box"||n.shape==="cylinder"||n.shape==="prism"||n.shape==="sprite")).slice(0,He);if(!e.length)return;const i=new L,o=new Map(this.desc.levels.map(n=>[n.id,n.elevation_m]));for(const n of e){const a=new xe(this.boxEdges,this.outlineMaterial),l=this.cutNow.has(n.id)?dt(n,o.get(n.level_id??"")??0,B):{y:n.position[1],h:n.size[1]};if(l){if(n.shape==="prism"){const d=n.polygon??[];if(!d.length)continue;const r=d.map(u=>u[0]),h=d.map(u=>u[1]),c=Math.max(...r)-Math.min(...r),p=Math.max(...h)-Math.min(...h);a.position.set(n.position[0]+(Math.max(...r)+Math.min(...r))/2,n.position[1]+n.size[1]/2,n.position[2]+(Math.max(...h)+Math.min(...h))/2),a.scale.set(c*1.04+.05,n.size[1]*1.04+.05,p*1.04+.05)}else this.transform(a,n),a.position.y=l.y,a.scale.set(n.size[0]*1.06+.05,l.h*1.06+.05,(n.shape==="sprite"?.1:n.size[2])*1.06+.05);a.renderOrder=10,i.add(a)}}this.outline=i,this.root.add(i),this.invalidate()}useCamera(t){t!==this.active&&(this.active=t,this.controls.object=t)}applyOrthoFrame(){const t=this.orthoFrame;if(!t)return;const e=this.persp.aspect||1;let i=t.halfW,o=t.halfH;i/o<e?i=o*e:o=i/e,this.ortho.left=-i,this.ortho.right=i,this.ortho.top=o,this.ortho.bottom=-o,this.ortho.updateProjectionMatrix()}setPreset(t){const e=this.desc,i=this.extent;if(!e||!i)return!1;const o=(i.x0+i.x1)/2,n=(i.z0+i.z1)/2,a=i.x1-i.x0,l=i.z1-i.z0,d=(h,c)=>Math.max(c,h/(this.persp.aspect||1),4)/(2*Math.tan(y(this.persp.fov/2))),r=Math.max(0,...e.levels.map(h=>h.elevation_m+h.ceiling_height_m));if(t==="top")this.useCamera(this.persp),this.controls.maxPolarAngle=R,this.persp.position.set(o,r+d(a,l)*1.2,n+.001),this.controls.target.set(o,0,n);else if(t==="iso"){this.useCamera(this.ortho),this.controls.maxPolarAngle=R;const h=ct(i,this.persp.aspect||1);this.orthoFrame=h,this.ortho.zoom=1,this.applyOrthoFrame(),this.ortho.position.set(h.target[0]+E[0]*h.dist,h.target[1]+E[1]*h.dist,h.target[2]+E[2]*h.dist),this.controls.target.set(h.target[0],h.target[1],h.target[2])}else if(t==="persp"){this.useCamera(this.persp),this.controls.maxPolarAngle=R;const h=Math.hypot(a,l),c=d(h,h*.62)*1.45;this.persp.position.set(o+Y[0]*c,Y[1]*c,n+Y[2]*c),this.controls.target.set(o,0,n)}else{const h=e.parts.find(p=>p.id===t.camera&&p.kind==="camera");if(!h)return!1;this.useCamera(this.persp);const c=new S(0,0,-1).applyEuler(new P(y(h.rotation[0]),y(h.rotation[1]),y(h.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.persp.position.set(h.position[0],h.position[1],h.position[2]),this.controls.target.set(h.position[0]+c.x*6,h.position[1]+c.y*6,h.position[2]+c.z*6)}return this.preset=t,this.controls.update(),this.updateCutaway(),this.invalidate(),!0}projectPoint(t){this.active.updateMatrixWorld();const e=new S(t[0],t[1],t[2]).project(this.active);if(e.z>1)return null;const i=this.opts.mount.clientWidth,o=this.opts.mount.clientHeight;return{x:(e.x+1)/2*i,y:(1-e.y)/2*o}}wantedCutAzimuth(){const t=this.extent;if(this.quality!==2||!t||typeof this.preset!="string")return null;const e=this.active.position;if(e.y<=t.y1)return null;const i=(t.x0+t.x1)/2,o=(t.z0+t.z1)/2;return Math.hypot(e.x-i,e.z-o)<.5?null:Oe($e(e.x,e.z,i,o))}writeBox(t,e,i){const o=t.part,n=new N().setFromEuler(new P(y(o.rotation[0]),y(o.rotation[1]),y(o.rotation[2]),"YXZ")),a=i<=0,l=new S(o.position[0],e,o.position[2]),d=a?new S(1e-4,1e-4,1e-4):new S(Math.max(o.size[0],.001),Math.max(i,.001),Math.max(o.size[2],.001));t.obj instanceof O?(t.obj.setMatrixAt(t.index,new F().compose(l,n,d)),t.obj.instanceMatrix.needsUpdate=!0):(t.obj.position.copy(l),t.obj.scale.copy(d))}updateCutaway(){const t=this.wantedCutAzimuth();if(t===this.cutAzimuth)return;this.cutAzimuth=t;const e=this.desc;if(!e||!this.extent)return;const i=new Set(t===null?[]:Fe(e,t,this.extent)),o=new Map(e.levels.map(n=>[n.id,n.elevation_m]));for(const n of this.cutNow){if(i.has(n))continue;const a=this.placed.get(n);a&&this.writeBox(a,a.part.position[1],a.part.size[1])}for(const n of i){if(this.cutNow.has(n))continue;const a=this.placed.get(n);if(!a)continue;const l=dt(a.part,o.get(a.part.level_id??"")??0,B);l?this.writeBox(a,l.y,l.h):this.writeBox(a,(o.get(a.part.level_id??"")??0)-1,0)}this.cutNow=i,this.rebuildCaps(o),this.sun&&(this.sun.shadow.needsUpdate=!0),this.selectedId&&this.setSelected(this.selectedId)}rebuildCaps(t){this.caps&&(this.root.remove(this.caps),this.caps.dispose(),this.caps=null);const e=[...this.cutNow].sort().map(l=>this.placed.get(l)).filter(l=>!!l&&l.part.kind==="wall");if(!e.length||this.quality!==2)return;const i=new O(this.unitBox,this.material(vt,1,!1,"floor"),e.length),o=new F,n=new N,a=new P;e.forEach((l,d)=>{const r=l.part,h=(t.get(r.level_id??"")??0)+B;n.setFromEuler(a.set(y(r.rotation[0]),y(r.rotation[1]),y(r.rotation[2]),"YXZ")),o.compose(new S(r.position[0],h+yt/2-.004,r.position[2]),n,new S(r.size[0]+.004,yt,r.size[2]+.004)),i.setMatrixAt(d,o)}),i.instanceMatrix.needsUpdate=!0,i.computeBoundingSphere(),i.name="caps",i.castShadow=!0,this.caps=i,this.root.add(i)}cutawayNow(){return[...this.cutNow].sort()}get buildCount(){return this.builds}pick(t,e){const i=this.renderer.domElement.getBoundingClientRect();if(!i.width||!i.height)return null;this.raycaster.setFromCamera(new Nt((t-i.left)/i.width*2-1,-((e-i.top)/i.height)*2+1),this.active);const o=[...this.lookup.keys()].filter(n=>n.visible);for(const n of this.raycaster.intersectObjects(o,!1)){const a=this.lookup.get(n.object);if(!a)continue;const l=a[n.instanceId??0];if(l){if(l.kind==="floor"){if(this.plateOpacity(l)<1)continue;return null}return{id:l.userData.id,kind:l.userData.kind,partId:l.id}}}return null}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.persp.aspect=t/e,this.persp.updateProjectionMatrix(),this.applyOrthoFrame(),this.invalidate()}redrawNow(){this.disposed||(cancelAnimationFrame(this.raf),this.raf=0,this.frame())}capture(){return this.controls.update(),this.updateCutaway(),this.renderer.render(this.scene,this.active),this.renderer.domElement.toDataURL("image/png")}renderThumbnail(t,e,i=ts,o=es){const n=t.parts.filter(w=>w.level_id===e&&w.kind!=="cone"&&w.shape!=="sprite"&&w.shape!=="light");if(!t.levels.some(w=>w.id===e))return null;const a={...t,levels:t.levels.filter(w=>w.id===e),parts:n},l=this.realise(n,a),d=new st;if(d.add(l.root),this.quality===2){d.add(this.night?new $(zt,Pt,At):new $(xt,Mt,St));const w=this.night?new k(D,Et):new k(_t,kt);w.position.set(I[0]*50,I[1]*50,I[2]*50),d.add(w)}else{d.add(this.night?new C(Tt,.7):new C(16777215,1.6));const w=this.night?new k(D,.5):new k(16777215,1.4);w.position.set(1,2,1.2),d.add(w)}const r=this.renderer.domElement,h=this.renderer.getPixelRatio(),{w:c,h:p}=Re(i,o,r.width/h,r.height/h);if(c<8||p<8)return this.disposeGroup(l.root),null;const u=ct(Ce(t,e),c/p),g=new it(-u.halfW,u.halfW,u.halfH,-u.halfH,.05,4e3);g.position.set(u.target[0]+E[0]*u.dist,u.target[1]+E[1]*u.dist,u.target[2]+E[2]*u.dist),g.lookAt(u.target[0],u.target[1],u.target[2]),g.updateProjectionMatrix();let b=null;const z=this.renderer.shadowMap.enabled;try{this.renderer.shadowMap.enabled=!1,this.renderer.setScissorTest(!0),this.renderer.setScissor(0,0,c,p),this.renderer.setViewport(0,0,c,p),this.renderer.render(d,g);const w=document.createElement("canvas");w.width=c,w.height=p;const T=w.getContext("2d");T&&(T.drawImage(r,0,r.height-p*h,c*h,p*h,0,0,c,p),b=w.toDataURL("image/png"))}catch(w){console.warn("sw-plan-3d: thumbnail failed",w)}finally{this.renderer.setScissorTest(!1),this.renderer.setViewport(0,0,r.width/h,r.height/h),this.renderer.shadowMap.enabled=z,this.disposeGroup(l.root),this.invalidate()}return b}async exportGltf(){const t=new L;for(const i of this.root.children)i!==this.outline&&t.add(i.clone());return await new Me().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.invalidate),this.controls.removeEventListener("change",this.invalidate),this.controls.dispose(),this.clear();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.aoMaterial&&(this.aoMaterial.map?.dispose(),this.aoMaterial.dispose()),this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.unitPlane.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}function ls(s,t,e,i,o){const n=document.createElement("div");n.setAttribute("aria-hidden","true"),n.dataset.skinControl="",n.style.cssText=`position:fixed;left:-1600px;top:0;width:${e}px;height:${i}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(n);let a=null;try{if(a=new Bt({mount:n,color:t,onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1}),a.setDescription(s),!a.setPreset("iso"))return null;a.capture();const l=a.renderer.domElement;if(l.width!==e||l.height!==i)return null;const d=document.createElement("canvas");d.width=e,d.height=i;const r=d.getContext("2d");return r?(r.fillStyle=o,r.fillRect(0,0,e,i),r.drawImage(l,0,0),d.toDataURL("image/png")):null}catch(l){return console.warn("sw-plan-3d: control image failed",l),null}finally{a?.dispose(),n.remove()}}const tt=2500,hs=tt+1500,cs=1e4,ds=3,ps=3e3;function us(s,t,e){return new Promise(i=>{let o=!1;const n=setTimeout(()=>{o||(o=!0,i(e))},t);s.then(a=>{o||(o=!0,clearTimeout(n),i(a))},()=>{o||(o=!0,clearTimeout(n),i(e))})})}var fs=Object.defineProperty,ms=Object.getOwnPropertyDescriptor,m=(s,t,e,i)=>{for(var o=i>1?void 0:i?ms(t,e):t,n=s.length-1,a;n>=0;n--)(a=s[n])&&(o=(i?a(t,e,o):a(o))||o);return i&&o&&fs(t,e,o),o};const ws="ייצוא glTF נכשל",gs="עבר לרמה סכמטית — קצב הפריימים היה נמוך",bs="קצב הפריימים נמוך",vs="מעבר לסכמטי",ys=4e3,X="sw.plan3d.fallback",Ct="sw.plan3d.night",xs=30,Ms=6;function Ss(s){return s.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}const _s={wall:"קיר",opening:"פתח",object:"עצם",connector:"מחבר",camera:"מצלמה",entity:"ישות",zone:"חדר",label:"תווית",level:"מפלס"},$t=(s,t)=>{try{return(s==="local"?localStorage:sessionStorage).getItem(t)}catch{return null}},V=(s,t,e)=>{try{const i=s==="local"?localStorage:sessionStorage;e===null?i.removeItem(t):i.setItem(t,e)}catch{}};let f=class extends Ht{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.frameKey=null,this.cameras=[],this.labels={},this.exportName="plan-3d",this.levels=[],this.activeLevel=null,this.thumbnailScene=null,this.levelDots={},this.qualityDefault=null,this.minFps=xs,this.continuous=!1,this.hover=null,this.overlays=[],this.overlayById=new Map,this.hiddenPills=0,this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.chosen=qt(),this.installDefault=null,this.fallback=$t("session",X)==="1",this.lowFps=!1,this.night=$t("local",Ct)==="1",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null,this.probe=null,this.probeTimer=0,this.probed=!1,this.probePending=!1,this.thumbs=new Map,this.thumbsFor=null,this.thumbsQuality=null,this.thumbPass=0,this.settingsAsked=!1,this.ownAsked=!1,this.onVisibility=()=>{document.hidden?this.probe&&(this.endProbe(!1),this.probePending=!0):this.probePending&&this.quality===2&&this.view&&this.startProbe()}}firstUpdated(){this.watchBar(),this.init()}watchBar(){const s=this.renderRoot.querySelector(".bar");!s||typeof ResizeObserver>"u"||(this.barRo?.disconnect(),this.barRo=new ResizeObserver(()=>{const t=Math.ceil(s.getBoundingClientRect().height);t>0&&this.style.setProperty("--bar-h",`${t}px`)}),this.barRo.observe(s))}connectedCallback(){super.connectedCallback(),this.hasUpdated&&!this.view&&this.init(),document.addEventListener("visibilitychange",this.onVisibility)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("visibilitychange",this.onVisibility),this.ro?.disconnect(),this.barRo?.disconnect(),cancelAnimationFrame(this.thumbPass),this.thumbPass=0,this.endProbe(!1),this.probed=!1,this.probePending=!1,this.view?.dispose(),this.view=null,this.applied=null,this.thumbs.clear(),this.thumbsFor=null,window.clearTimeout(this.toastTimer)}get mode(){return Gt(this.chosen,q(this.qualityDefault)??this.installDefault)}get quality(){return Ut(this.mode,this.fallback)}init(){if(this.ownAsked||(this.ownAsked=!0,jt().then(s=>{s&&s!==this.chosen&&(this.chosen=s)})),this.chosen===null&&q(this.qualityDefault)===null&&this.installDefault===null&&!this.settingsAsked){this.settingsAsked=!0,us(Wt().then(s=>q(s["plan.quality"])??"schematic"),ps,"schematic").then(s=>{this.installDefault=s}).finally(()=>{this.isConnected&&!this.view&&this.init()});return}try{this.view=new Bt({mount:this.stage,color:s=>getComputedStyle(this).getPropertyValue(`--sw-${s}`).trim()||"#888888",onSelect:s=>this.emitSelect(s),onHover:(s,t,e)=>this.setHover(s,t,e),onFrame:(s,t)=>{this.setAttribute("data-frames",String(s)),this.setAttribute("data-fps",String(t)),this.onProbeFrame(s)},onDraw:()=>this.layoutOverlays(),quality:this.quality,night:this.night}),this.toggleAttribute("data-night",this.night)}catch(s){console.warn("sw-plan-3d: WebGL failed to start",s),this.error=Yt;return}this.view.setContinuous(this.continuous),this.ro=new ResizeObserver(()=>this.view?.resize()),this.ro.observe(this),this.presetApplied=!1,this.setAttribute("data-quality",String(this.quality)),this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}willUpdate(s){if(!(s.has("description")||s.has("activeLevel")||s.has("selectedId")||s.has("hover")))return;const t=this.description?.parts??[],e=t.filter(o=>o.kind==="chip");let i=t.filter(o=>o.kind==="entity"&&(!this.activeLevel||o.level_id===this.activeLevel));if(this.hiddenPills=0,i.length>Pe){const o=i.filter(n=>n.userData.id===this.selectedId||n.userData.id===this.hover?.id||n.color!=="text-3");this.hiddenPills=i.length-o.length,i=o}this.overlays=[...e,...i],this.overlayById=new Map(this.overlays.map(o=>[o.id,o]))}updated(s){if(!this.view)return;const t=s.has("frameKey")&&s.get("frameKey")!==void 0;t&&(this.presetApplied=!1),s.has("description")&&this.description&&this.apply(this.description),t&&!this.presetApplied&&this.applied&&this.frame(),(s.has("selectedId")||s.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),s.has("preset")&&s.get("preset")!==void 0&&this.applyPreset(this.preset),s.has("continuous")&&!this.probe&&this.view.setContinuous(this.continuous),this.applyQuality(),this.layoutOverlays()}layoutOverlays(){const s=this.view;if(!s||!this.overlays.length)return;this.renderRoot.querySelectorAll("[data-3d-part]").forEach(e=>{const i=this.overlayById.get(e.getAttribute("data-3d-part")??""),o=i?s.projectPoint(i.position):null;if(!i||!o){e.style.display="none";return}e.style.display="block",e.style.transform=i.kind==="chip"?`translate(${Math.round(o.x)}px, ${Math.round(o.y)}px) translate(-50%, -50%)`:`translate(${Math.round(o.x)}px, ${Math.round(o.y)-Ms}px) translate(-50%, -100%)`})}apply(s){s!==this.applied&&(this.applied=s,this.view?.setDescription(s),this.setAttribute("data-parts",String(s.parts.length)),this.toggleAttribute("data-estimated",s.estimated),this.presetApplied||this.frame(),this.view?.setSelected(this.selectedId),this.quality===2&&!this.probed&&this.startProbe())}applyQuality(){const s=this.quality;this.setAttribute("data-quality",String(s)),this.setAttribute("data-quality-mode",this.mode),!(!this.view||this.view.getQuality()===s)&&(this.view.setQuality(s),this.thumbs.clear(),this.probed=!1,s===2&&this.applied?this.startProbe():this.endProbe(!1),this.requestUpdate())}setNight(s){s!==this.night&&(this.night=s,V("local",Ct,s?"1":null),this.toggleAttribute("data-night",s),this.view?.setNight(s),this.thumbs.clear(),this.requestUpdate())}get isNight(){return this.night}setMode(s){const t=this.lowFps;this.chosen=s,this.lowFps=!1,Kt(s),s==="auto"&&t?this.fallBack():s==="full"&&this.fallback&&(this.fallback=!1,V("session",X,null))}setQuality(s){this.setMode(s===2?"full":"schematic")}startProbe(){if(this.endProbe(!1),this.probed=!0,!this.view||this.minFps<=0)return;if(document.hidden){this.probePending=!0;return}this.probePending=!1;const s=performance.now();this.probe={until:0,t0:0,f0:0,start:Number(this.getAttribute("data-frames")??0),s0:s,lt:0,lf:0,watch:new Qt(this.minFps,Xt(this.minFps),tt)},this.view.setContinuous(!0),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),cs)}onProbeFrame(s){const t=this.probe;if(!t)return;if(document.hidden){this.endProbe(!1),this.probePending=!0;return}const e=performance.now();if(!t.t0){if(s-t.start<ds)return;t.t0=t.lt=e,t.f0=t.lf=s,t.until=e+tt,window.clearTimeout(this.probeTimer),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),hs);return}const i=t.watch.sample((s-t.lf)*1e3/Math.max(1,e-t.lt),t.lt,e);t.lt=e,t.lf=s,!(!i&&e<t.until)&&(this.setAttribute("data-probe-fps",String(Math.round((s-t.f0)*1e3/Math.max(1,e-t.t0)))),this.endProbe(!1),i&&this.onLowFps())}endProbe(s){window.clearTimeout(this.probeTimer),this.probeTimer=0;const t=this.probe;if(this.probe=null,this.view?.setContinuous(this.continuous),s&&t&&document.hidden){this.probePending=!0;return}if(s&&t){const e=Number(this.getAttribute("data-frames")??0),i=performance.now(),o=t.t0?(e-t.f0)*1e3/Math.max(1,i-t.t0):0;this.setAttribute("data-probe-fps",String(Math.round(o))),(t.t0?t.watch.sample((e-t.lf)*1e3/Math.max(1,i-t.lt),t.lt,i):t.watch.sample(0,t.s0,i))&&this.onLowFps()}}onLowFps(){const s=Vt(this.mode);s==="downgrade"?this.fallBack():s==="hint"&&(this.lowFps=!0)}fallBack(){this.fallback=!0,V("session",X,"1")}frame(){this.presetApplied=!0,this.view?.setPreset(this.preset)?this.setAttribute("data-preset",typeof this.preset=="string"?this.preset:"camera"):this.view?.setPreset("iso")&&this.setAttribute("data-preset","iso")}applyPreset(s){this.view?.setPreset(s)&&this.setAttribute("data-preset",typeof s=="string"?s:"camera")}pickPreset(s){this.preset=s,this.applyPreset(s)}labelOf(s){return this.labels[s.id]??_s[s.kind]??s.id}emitSelect(s){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:s?.id??null,kind:s?.kind??null},bubbles:!0,composed:!0}))}setHover(s,t,e){this.hover=s?{id:s.id,kind:s.kind,label:this.labelOf(s),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}pickLevel(s){const t=this.activeLevel===s?null:s;this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t},bubbles:!0,composed:!0}))}thumbFor(s){const t=this.thumbnailScene;if(!t||!this.view)return"";(this.thumbsFor!==t||this.thumbsQuality!==this.quality)&&(this.thumbs.clear(),this.thumbsFor=t,this.thumbsQuality=this.quality);const e=this.thumbs.get(s);return e===void 0&&this.scheduleThumbs(),e??""}scheduleThumbs(){this.thumbPass||(this.thumbPass=requestAnimationFrame(()=>{this.thumbPass=0;const s=this.thumbnailScene,t=this.view;if(!s||!t||this.thumbsFor!==s)return;let e=!1;for(const i of this.levels){if(this.thumbs.has(i.id))continue;const o=t.renderThumbnail(s,i.id);o&&(this.thumbs.set(i.id,o),e=!0)}e&&t.redrawNow(),this.setAttribute("data-3d-thumbs",String(this.thumbs.size)),e&&this.requestUpdate()}))}get thumbnailCount(){return this.thumbs.size}toScreen(s){return this.view?.projectPoint(s)??null}capture(){return this.view?.capture()??null}captureControl(s){return ls(s,se,ee,te,Jt)}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const s=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(s)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${Ss(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(s){console.warn("sw-plan-3d: glTF export failed",s),this.showToast(ws)}finally{this.exporting=!1}}}showToast(s){this.toast=s,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",ys)}renderStrip(){if(this.levels.length<2||!this.thumbnailScene||!this.ready)return x;const s=[...this.levels].sort((t,e)=>e.elevation_m-t.elevation_m||(t.id<e.id?-1:1));return this.thumbs=Zt(this.thumbs,s.map(t=>t.id)),v`<div class="strip" role="group" aria-label="מפלסים" data-3d-strip>
      ${s.map(t=>{const e=this.levelDots[t.id];return v`<button type="button" data-3d-thumb=${t.id} aria-pressed=${this.activeLevel===t.id?"true":"false"} title=${`${t.name} · ${t.elevation_m>=0?"+":"−"}${Math.abs(t.elevation_m).toFixed(1)} מ׳`} @click=${()=>this.pickLevel(t.id)}>
          <span class="pic"><img alt="" src=${this.thumbFor(t.id)} />${e&&(e.presence>0||e.open||e.lit)?v`<span class="dots" data-3d-dots=${t.id}>${e.presence>0?v`<i data-dot="presence" title="תנועה" style=${`--fade:${Math.max(.35,e.presence).toFixed(2)}`}></i>`:x}${e.open?v`<i data-dot="open" title="פתח פתוח"></i>`:x}${e.lit?v`<i data-dot="lit" title="תאורה דולקת"></i>`:x}</span>`:x}</span><span>${t.name}</span>
        </button>`})}
    </div>`}render(){const s=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,""),e=this.quality,i=this.mode;return v`
      <div class="stage"></div>
      ${!this.ready&&!this.error?v`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>`:x}
      ${this.error?v`<div class="spinner err" data-3d-error>${this.error}</div>`:x}
      ${this.overlays.length?v`<div class="overlay">${this.overlays.map(o=>o.kind==="chip"?v`<span class="chip" aria-hidden="true" data-3d-chip=${o.userData.id} data-3d-chip-part=${o.id} data-3d-part=${o.id}>${o.text??""}</span>`:v`<button type="button" class="lbl" tabindex="-1" data-3d-label=${o.userData.id} data-3d-part=${o.id} aria-pressed=${this.selectedId===o.userData.id?"true":"false"} style=${`--lbl: var(--sw-${o.color})`} @click=${()=>this.emitSelect({id:o.userData.id,kind:o.userData.kind,partId:o.id})}>${o.text??""}</button>`)}${this.hiddenPills?v`<span class="more" data-3d-more=${this.hiddenPills} title="ישויות ללא מצב מיוחד מוסתרות במבט הכללי; בחירה ברשימה או במפלס מציגה אותן">+${this.hiddenPills} ישויות</span>`:x}</div>`:x}
      ${this.renderStrip()}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${s==="top"} @click=${()=>this.pickPreset("top")}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${s==="iso"} @click=${()=>this.pickPreset("iso")}>איזומטרי</sw-chip>
        <sw-chip data-preset-persp ?selected=${s==="persp"} @click=${()=>this.pickPreset("persp")}>פרספקטיבה</sw-chip>
        ${this.cameras.length?v`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${t} @change=${o=>this.onCameraChange(o)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map(o=>v`<option value=${o.id} ?selected=${o.id===t}>${o.label}</option>`)}
            </select>`:x}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-1 title=${G.schematic} ?selected=${i==="schematic"} @click=${()=>this.setMode("schematic")}>${U.schematic}</sw-chip>
        <sw-chip data-quality-2 title=${G.full} ?selected=${i==="full"} @click=${()=>this.setMode("full")}>${U.full}</sw-chip>
        <sw-chip data-quality-auto title=${G.auto} ?selected=${i==="auto"} @click=${()=>this.setMode("auto")}>${U.auto}</sw-chip>
        <sw-chip data-night-toggle title="מצב לילה: שמיים כהים, אור ירח, החדרים הדלוקים זוהרים" ?selected=${this.night} aria-pressed=${this.night} @click=${()=>this.setNight(!this.night)}>לילה</sw-chip>
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?"מייצא…":"ייצוא glTF"}</sw-button>
      </div>
      ${this.description?.estimated?v`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>`:x}
      ${this.fallback&&i==="auto"?v`<div class="note fb" role="status" data-3d-fallback>${gs}</div>`:x}
      ${this.lowFps&&i==="full"&&e===2?v`<div class="note fb hint" role="status" data-3d-low-fps>${bs}<button type="button" data-3d-low-fps-switch @click=${()=>this.setMode("schematic")}>${vs}</button><button type="button" class="x" aria-label="סגירה" data-3d-low-fps-close @click=${()=>this.lowFps=!1}>×</button></div>`:x}
      ${this.toast?v`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:x}
      ${this.hover?v`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:x}
    `}onCameraChange(s){const t=s.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};f.styles=ie`
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
    /* K88 night mode: a night sky whatever the theme (the dark theme's own sky tokens are its night) */
    :host([data-night]) {
      background: linear-gradient(180deg, #060b18 0%, #152442 100%);
    }
    :host([data-night]) .bar,
    :host([data-night]) .strip {
      background: color-mix(in srgb, #0f1729 80%, transparent);
      color: #dfe7f5;
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
    /* the low-frame-rate hint of a chosen full mode: a one-tap switch and a close, never in the way of the view */
    .note.hint {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .note.hint button {
      font: inherit;
      color: var(--sw-accent);
      background: none;
      border: 0;
      padding: 0 2px;
      cursor: pointer;
    }
    .note.hint button.x {
      color: var(--sw-text-2);
    }
    .note.hint button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
      border-radius: var(--sw-r-sm);
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
  `;m([M({attribute:!1})],f.prototype,"description",2);m([M()],f.prototype,"selectedId",2);m([M({attribute:!1})],f.prototype,"preset",2);m([M()],f.prototype,"frameKey",2);m([M({attribute:!1})],f.prototype,"cameras",2);m([M({attribute:!1})],f.prototype,"labels",2);m([M()],f.prototype,"exportName",2);m([M({attribute:!1})],f.prototype,"levels",2);m([M()],f.prototype,"activeLevel",2);m([M({attribute:!1})],f.prototype,"thumbnailScene",2);m([M({attribute:!1})],f.prototype,"levelDots",2);m([M({attribute:!1})],f.prototype,"qualityDefault",2);m([M({type:Number})],f.prototype,"minFps",2);m([M({type:Boolean,reflect:!0,attribute:"data-measure"})],f.prototype,"continuous",2);m([_()],f.prototype,"hover",2);m([_()],f.prototype,"ready",2);m([_()],f.prototype,"exporting",2);m([_()],f.prototype,"error",2);m([_()],f.prototype,"toast",2);m([_()],f.prototype,"chosen",2);m([_()],f.prototype,"installDefault",2);m([_()],f.prototype,"fallback",2);m([_()],f.prototype,"lowFps",2);m([_()],f.prototype,"night",2);m([oe(".stage")],f.prototype,"stage",2);f=m([ne("sw-plan-3d")],f);export{xs as DEFAULT_MIN_FPS,X as FALLBACK_KEY,Ct as NIGHT_KEY,Pe as PILL_CAP,hs as PROBE_FALLBACK_MS,cs as PROBE_FIRST_FRAME_MS,tt as PROBE_MS,ds as PROBE_WARM_FRAMES,Es as QUALITY_KEY,ps as SETTINGS_WAIT_MS,f as SwPlan3d};
//# sourceMappingURL=sw-plan-3d-pS5j-fnd.js.map
