import{i as Bt,p as Ht,a1 as Gt,q as x,a2 as qt,o as v,a3 as Ut,a4 as jt,a5 as Wt,a6 as Yt,G as Kt,a7 as M,H as z,a8 as Qt,I as Xt}from"./index-YDf-pXFx.js";import{S as J,P as Vt,O as tt,G as C,B as Zt,C as Jt,a as te,R as ee,W as se,b as X,c as ie,L as ne,d as et,e as oe,f as ae,D as _,A as L,H as N,g as re,N as le,M as st,h as it,i as he,E as P,j as Lt,k as nt,l as ce,m as E,n as de,I as $,Q as O,V as S,o as R,p as pe,q as Nt,r as ue,s as $t,F as Ot,t as fe}from"./three-DcroZdrW.js";const ot=Math.SQRT2,q=Math.sqrt(3),U=Math.sqrt(6),A=[1/q,1/q,1/q],j=(()=>{const i=Math.hypot(1,.85,1);return[1/i,.85/i,1/i]})(),me=[1/ot,0,-1/ot],we=[-1/U,2/U,-1/U],ge=1.08,H=.7,be=60,ve=10,ye=Math.cos(65*Math.PI/180),xe=new Set(["wall"]),Me=new Set(["lintel","sill","head","window","door","marker"]),Se=1,G=i=>i*Math.PI/180,at=(i,t)=>i[0]*t[0]+i[1]*t[1]+i[2]*t[2];function Rt(i){const t=i.parts.filter(l=>l.kind==="floor"&&l.shape==="box");let e=1/0,s=1/0,n=-1/0,o=-1/0;for(const l of t)e=Math.min(e,l.position[0]-l.size[0]/2),n=Math.max(n,l.position[0]+l.size[0]/2),s=Math.min(s,l.position[2]-l.size[2]/2),o=Math.max(o,l.position[2]+l.size[2]/2);Number.isFinite(e)||([e,s,n,o]=[0,0,i.size[0],i.size[1]]);const a=i.levels.length?i.levels:[{id:"",elevation_m:0,ceiling_height_m:2.8}],r=Math.min(...a.map(l=>l.elevation_m)),d=Math.max(...a.map(l=>l.elevation_m+l.ceiling_height_m));return{x0:e,z0:s,x1:n,z1:o,y0:r,y1:d}}function _e(i,t){const e=i.levels.find(c=>c.id===t),s=i.parts.filter(c=>c.level_id===t),n=s.find(c=>c.kind==="floor"&&c.shape==="box"),o=e?e.elevation_m:0,a=e?e.elevation_m+e.ceiling_height_m:o+2.8;if(n)return{x0:n.position[0]-n.size[0]/2,x1:n.position[0]+n.size[0]/2,z0:n.position[2]-n.size[2]/2,z1:n.position[2]+n.size[2]/2,y0:o,y1:a};if(!s.length)return{x0:0,z0:0,x1:i.size[0],z1:i.size[1],y0:o,y1:a};let r=1/0,d=1/0,l=-1/0,h=-1/0;for(const c of s){const p=Math.hypot(c.size[0],c.size[2])/2;r=Math.min(r,c.position[0]-p),l=Math.max(l,c.position[0]+p),d=Math.min(d,c.position[2]-p),h=Math.max(h,c.position[2]+p)}return{x0:r,z0:d,x1:l,z1:h,y0:o,y1:a}}function rt(i,t,e=ge){const s=(i.x0+i.x1)/2,n=(i.y0+i.y1)/2,o=(i.z0+i.z1)/2;let a=1/0,r=-1/0,d=1/0,l=-1/0;for(const g of[i.x0,i.x1])for(const b of[i.y0,i.y1])for(const k of[i.z0,i.z1]){const w=[g-s,b-n,k-o],T=at(w,me),Z=at(w,we);a=Math.min(a,T),r=Math.max(r,T),d=Math.min(d,Z),l=Math.max(l,Z)}let h=Math.max((r-a)/2,1)*e,c=Math.max((l-d)/2,1)*e;const p=t>0&&Number.isFinite(t)?t:1;h/c<p?h=c*p:c=h/p;const u=Math.hypot(i.x1-i.x0,i.y1-i.y0,i.z1-i.z0);return{target:[s,n,o],halfW:h,halfH:c,dist:Math.max(u*2,20)}}function ze(i,t,e,s){return(Math.atan2(t-s,i-e)*180/Math.PI%360+360)%360}function ke(i,t=ve){const e=(i%360+360)%360;return(Math.floor(e/t)*t+t/2)%360}function Pe(i,t,e,s=0){const n=G(i.rotation[1]),o=t-i.position[0],a=e-i.position[2],r=o*Math.cos(n)-a*Math.sin(n),d=o*Math.sin(n)+a*Math.cos(n);return Math.abs(r)<=i.size[0]/2+s&&Math.abs(d)<=i.size[2]/2+s}function Ee(i,t,e=Rt(i)){const s=(e.x0+e.x1)/2,n=(e.z0+e.z1)/2,o=Math.cos(G(t)),a=Math.sin(G(t)),r=[];for(const l of i.parts){if(!xe.has(l.kind)||l.shape!=="box")continue;const h=l.position[0]-s,c=l.position[2]-n;if(Math.hypot(h,c)<1e-6||h*o+c*a<=0)continue;const u=G(l.rotation[1]);let g=Math.sin(u),b=Math.cos(u);g*h+b*c<0&&(g=-g,b=-b),!(g*o+b*a<ye)&&r.push(l)}const d=new Set(r.map(l=>l.id));for(const l of i.parts)Me.has(l.kind)&&r.some(h=>h.level_id===l.level_id&&Pe(h,l.position[0],l.position[2],Se))&&d.add(l.id);return[...d].sort()}function Ae(i,t,e,s){return{w:Math.max(0,Math.min(i,Math.floor(e))),h:Math.max(0,Math.min(t,Math.floor(s)))}}function lt(i,t,e=H){const s=i.size[1],n=i.position[1]-s/2,o=t+e;if(n>=o-1e-6)return null;if(n+s<=o+1e-6)return{y:i.position[1],h:s};const a=o-n;return{y:n+a/2,h:a}}const Ie=.6,ht=3e3,ct=45,Te=8,V=2048,dt={objectShadows:!0,lambertObjects:!1,shadowMapPx:V,occlusion:!0},pt={objectShadows:!1,lambertObjects:!0,shadowMapPx:1024,occlusion:!0},ut=.28,Ce=64,Le=6,Ne=.35,$e=.88,ft=8,D=Math.PI/2-.02,Oe=new Set(["glow","cone","tint"]),Re=new Set(["wall","lintel","sill","head","door","object","connector","camera"]),De=new Set(["floor","wall","object","connector","room","tint","lintel","sill","head"]),Fe=new Set(["wall","lintel","sill","head","door","connector"]),mt=new Set(["chip","entity"]),Be=new Set(["wall","object","connector"]),He=.5,I=(()=>{const i=Math.hypot(-.6,1.1,-.25);return[-.6/i,1.1/i,-.25/i]})(),Ge="map-wall-3d",wt="map-structure",gt=.025,bt=16777215,vt=15133682,yt=2.1,xt=16774108,Mt=3,qe=1.12,St=2767974,_t=857124,zt=.75,F=12570879,kt=.55,Ue=.9,Pt=2.6,Et=9347276,je=160,We=100,y=i=>i*Math.PI/180,At=i=>i.kind==="object"&&Math.max(i.size[0],i.size[1],i.size[2])<Ie,W=i=>i.kind==="floor"?"floor":i.color==="map-glass"?"glass":i.kind==="object"?"object":"std",Y=(i,t)=>i.length===t.length&&i.every((e,s)=>e===t[s]),Ye=(i,t)=>{if(!i||!t)return i===t;if(i.length!==t.length)return!1;for(let e=0;e<i.length;e++)if(i[e][0]!==t[e][0]||i[e][1]!==t[e][1])return!1;return!0},Ke=(i,t)=>i.id===t.id&&i.kind===t.kind&&i.shape===t.shape&&i.color===t.color&&i.group===t.group&&i.level_id===t.level_id&&i.text===t.text&&Y(i.position,t.position)&&Y(i.size,t.size)&&Y(i.rotation,t.rotation)&&Ye(i.polygon,t.polygon)&&(i.opacity===t.opacity||i.kind==="tint");function Qe(i,t){if(i===t||i.parts.length!==t.parts.length||i.levels.length!==t.levels.length||i.size[0]!==t.size[0]||i.size[1]!==t.size[1])return!1;for(let s=0;s<i.levels.length;s++){const n=i.levels[s],o=t.levels[s];if(n.id!==o.id||n.elevation_m!==o.elevation_m||n.ceiling_height_m!==o.ceiling_height_m)return!1}let e=!1;for(let s=0;s<i.parts.length;s++){const n=i.parts[s],o=t.parts[s];if(!Ke(n,o))return!1;n.opacity!==o.opacity&&(e=!0)}return e}function Xe(){const i=[-.5,.5],t=[];for(const s of i)for(const n of i)t.push(-.5,s,n,.5,s,n),t.push(s,-.5,n,s,.5,n),t.push(s,n,-.5,s,n,.5);const e=new $t;return e.setAttribute("position",new Ot(t,3)),e}function Ve(){const t=document.createElement("canvas");t.width=64,t.height=64;const e=t.getContext("2d");if(e){const n=e.createImageData(64,64);for(let o=0;o<64;o++)for(let a=0;a<64;a++){const r=Math.abs((a+.5)/64-.5)*2,d=Math.abs((o+.5)/64-.5)*2,l=Math.max(r,d),h=Math.min(1,Math.max(0,(l-.5)/.5)),c=(1-h*h*(3-2*h))*.42,p=(o*64+a)*4;n.data[p+3]=Math.round(c*255)}e.putImageData(n,0,0)}const s=new Lt(t);return s.colorSpace=X,s}function Ze(i,t){const e=[];for(const r of i){const d=e[e.length-1];(!d||Math.hypot(r[0]-d[0],r[1]-d[1])>1e-6)&&e.push(r)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let s=0;for(let r=0;r<e.length;r++){const d=e[r],l=e[(r+1)%e.length];s+=d[0]*l[1]-l[0]*d[1]}if(Math.abs(s)<1e-8)return null;const n=fe.triangulateShape(e.map(([r,d])=>new Nt(r,d)),[]),o=[];for(const[r,d,l]of n){const[h,c,p]=[e[r],e[d],e[l]];Math.abs((c[0]-h[0])*(p[1]-h[1])-(p[0]-h[0])*(c[1]-h[1]))<1e-10||(o.push(h[0],t,h[1],c[0],t,c[1],p[0],t,p[1]),o.push(h[0],0,h[1],p[0],0,p[1],c[0],0,c[1]))}for(let r=0;r<e.length;r++){const d=e[r],l=e[(r+1)%e.length];o.push(d[0],0,d[1],l[0],0,l[1],l[0],t,l[1],d[0],0,d[1],l[0],t,l[1],d[0],t,d[1])}const a=new $t;return a.setAttribute("position",new Ot(o,3)),a.computeVertexNormals(),a}class Dt{constructor(t){this.opts=t,this.scene=new J,this.persp=new Vt(50,1,.05,2e3),this.ortho=new tt(-1,1,1,-1,.05,4e3),this.active=this.persp,this.root=new C,this.unitBox=new Zt(1,1,1),this.unitCylinder=new Jt(.5,.5,1,24),this.unitPlane=new te(1,1).rotateX(-Math.PI/2),this.boxEdges=Xe(),this.materials=new Map,this.aoMaterial=null,this.raycaster=new ee,this.glowPool=[],this.lights=new C,this.sun=null,this.lookup=new Map,this.placed=new Map,this.tints=new Map,this.builds=0,this.smallGroups=[],this.outline=null,this.desc=null,this.extent=null,this.selectedId=null,this.preset="iso",this.orthoFrame=null,this.cutAzimuth=null,this.cutNow=new Set,this.caps=null,this.night=!1,this.framed=!1,this.hideSmall=!1,this.heavy=!1,this.heavyOverride=null,this.disposed=!1,this.continuous=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.onDown=s=>{s.isPrimary&&(this.pressed={x:s.clientX,y:s.clientY,id:s.pointerId})},this.onUp=s=>{const n=this.pressed;!n||s.pointerId!==n.id||(this.pressed=null,!(s.button!==0||Math.hypot(s.clientX-n.x,s.clientY-n.y)>Le)&&this.opts.onSelect(this.pick(s.clientX,s.clientY)))},this.onCancel=s=>{this.pressed?.id===s.pointerId&&(this.pressed=null)},this.onMove=s=>{if(this.pressed||s.pointerType==="touch"||!s.isPrimary)return;const n=this.pick(s.clientX,s.clientY),o=n?n.partId:null;if(o===this.lastHover)return;this.lastHover=o;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(n,s.clientX-a.left,s.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const s=this.controls.update();if(this.hideSmall){const a=this.active===this.ortho?this.ortho.top/(this.ortho.zoom||1)<ct/2:this.persp.position.distanceTo(this.controls.target)<ct;for(const r of this.smallGroups)r.visible=a}this.updateCutaway(),this.renderer.render(this.scene,this.active),this.opts.onDraw?.(),this.frames++;const n=performance.now();this.windowStart||(this.windowStart=n),this.windowFrames++,n-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(n-this.windowStart)),this.windowStart=n,this.windowFrames=0);const o=s||this.continuous;(!o||n-this.lastReport>=1e3)&&(this.lastReport=n,this.opts.onFrame(this.frames,this.fps)),o?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.quality=t.quality??1,this.night=!!t.night,this.renderer=new se({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(t.pixelRatio??Math.min(2,window.devicePixelRatio||1)),this.renderer.outputColorSpace=X,this.renderer.shadowMap.type=ie,this.outlineMaterial=new ne({color:new et(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new oe(this.persp,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=D,this.controls.addEventListener("change",this.invalidate),this.scene.add(this.lights),this.applyQuality();for(let s=0;s<Te;s++){const n=new ae(16777215,0,1,2);this.glowPool.push(n),this.scene.add(n)}this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.invalidate),this.resize()}get camera(){return this.active}getQuality(){return this.quality}config(){return this.heavyOverride??(this.heavy?pt:dt)}heavyConfig(){return{heavy:this.heavy,...this.config()}}setHeavyConfig(t){this.heavyOverride=t?{...this.heavy?pt:dt,...t}:null;for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,s=this.selectedId;this.desc=null,this.setDescription(e),this.setSelected(s)}this.invalidate()}rendererInfo(){const t=this.renderer.getContext(),e=t.getExtension("WEBGL_debug_renderer_info");return{vendor:String(e?t.getParameter(e.UNMASKED_VENDOR_WEBGL):t.getParameter(t.VENDOR)),renderer:String(e?t.getParameter(e.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER))}}benchFrames(t=60){const e=this.renderer.getContext(),s=new Uint8Array(4);this.controls.update(),this.updateCutaway();const n=()=>{this.renderer.render(this.scene,this.active),e.readPixels(0,0,1,1,e.RGBA,e.UNSIGNED_BYTE,s)};n();const o=performance.now();for(let a=0;a<t;a++)n();return(performance.now()-o)/t}setNight(t){if(t!==this.night){this.night=t,this.applyQuality();for(const e of this.glowPool)e.intensity>0&&(e.intensity=ft*(t?Pt:1));this.invalidate()}}getNight(){return this.night}setQuality(t){if(t!==this.quality){this.quality=t,this.applyQuality();for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,s=this.selectedId;this.setDescription(e),this.setSelected(s)}this.invalidate()}}applyQuality(){for(const e of[...this.lights.children])this.lights.remove(e),(e instanceof _||e instanceof L||e instanceof N)&&e.dispose();this.sun=null,this.cutAzimuth=null,this.cutNow.clear();const t=this.night;if(this.quality===2){this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=re,this.renderer.toneMappingExposure=t?Ue:qe,this.lights.add(t?new N(St,_t,zt):new N(bt,vt,yt));const e=t?new _(F,kt):new _(xt,Mt);e.castShadow=!0,e.shadow.mapSize.set(V,V),e.shadow.bias=-4e-4,e.shadow.normalBias=.03,this.lights.add(e),this.lights.add(e.target),this.sun=e,this.fitSun()}else{this.renderer.shadowMap.enabled=!1,this.renderer.toneMapping=le,this.renderer.toneMappingExposure=1,this.lights.add(t?new L(Et,.7):new L(16777215,1.6));const e=t?new _(F,.5):new _(16777215,1.4);e.position.set(1,2,1.2),this.lights.add(e)}}fitSun(){const t=this.sun,e=this.extent;if(!t||!e)return;const s=(e.x0+e.x1)/2,n=(e.y0+e.y1)/2,o=(e.z0+e.z1)/2,a=Math.max(Math.hypot(e.x1-e.x0,e.y1-e.y0,e.z1-e.z0)/2,2)*1.05;t.position.set(s+I[0]*a*2,n+I[1]*a*2,o+I[2]*a*2),t.target.position.set(s,n,o),t.target.updateMatrixWorld();const r=this.config().shadowMapPx;t.shadow.mapSize.x!==r&&(t.shadow.mapSize.set(r,r),t.shadow.map?.dispose(),t.shadow.map=null);const d=t.shadow.camera;d.left=-a,d.right=a,d.top=a,d.bottom=-a,d.near=.1,d.far=a*4,d.updateProjectionMatrix(),t.shadow.needsUpdate=!0}material(t,e,s=!1,n="std"){const o=this.quality===2&&n==="object"&&this.config().lambertObjects,a=`${t}|${e}|${s?2:1}|${this.quality===2?o?"object-lambert":n:"l1"}`;let r=this.materials.get(a);if(!r){const d=s?{side:it,forceSinglePass:!0}:{},l=this.quality===2&&t===wt&&n==="std"?Ge:t,h=new et(this.opts.color(l));let c;this.quality===2&&n==="glass"?c=new st({color:h,roughness:.12,metalness:.25,transparent:!0,opacity:Math.max(e,.35),depthWrite:!1,side:it,forceSinglePass:!0}):this.quality===2&&!o?c=new st({color:h,roughness:n==="floor"?1:.88,metalness:0,transparent:e<1,opacity:e,depthWrite:e>=1,...d}):c=new he({color:h,transparent:e<1,opacity:e,depthWrite:e>=1,...d}),r={token:l,material:c},this.materials.set(a,r)}return r.material}recolour(){for(const{token:t,material:e}of this.materials.values())e.color.set(this.opts.color(t));this.outlineMaterial.color.set(this.opts.color("accent"))}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new P(y(e.rotation[0]),y(e.rotation[1]),y(e.rotation[2]),"YXZ"))}plateOpacity(t,e=this.desc){const s=e?.levels??[];if(t.kind!=="floor"||s.length<2)return t.opacity;const n=Math.min(...s.map(a=>a.elevation_m)),o=s.find(a=>a.id===t.level_id);return o&&o.elevation_m>n?Math.min(t.opacity,Ne):t.opacity}shadows(t,e){if(this.quality!==2)return;const s=this.config().objectShadows;t.castShadow=(s?Re:Fe).has(e.kind)&&e.color!=="map-glass",t.receiveShadow=De.has(e.kind)&&(s||e.kind!=="object")}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const s=e.getContext("2d");s&&(s.globalAlpha=$e,s.fillStyle=this.opts.color("surface"),s.beginPath(),s.roundRect(8,16,496,96,48),s.fill(),s.globalAlpha=1,s.fillStyle=this.opts.color(t.color),s.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',s.textAlign="center",s.textBaseline="middle",s.direction="rtl",s.fillText(t.text??"",256,66,480));const n=new Lt(e);n.colorSpace=X;const o=new nt(new ce({map:n,transparent:!0,depthTest:!0}));return o.position.set(t.position[0],t.position[1],t.position[2]),o.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),o}single(t,e){if(t.shape==="box"||t.shape==="cylinder"){const s=new E(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t,e),!1,W(t)));return this.transform(s,t),s.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),this.shadows(s,t),s}if(t.shape==="prism"){const s=Ze(t.polygon??[],t.size[1]);if(!s)return null;const n=this.material(t.color,t.opacity,!0,W(t)),o=t.kind==="tint"?n.clone():n,a=new E(s,o);return t.kind==="tint"&&(a.userData.ownMaterial=!0),a.position.set(t.position[0],t.position[1],t.position[2]),this.shadows(a,t),a}return mt.has(t.kind)?null:t.shape==="sprite"?this.label(t):null}occlusion(t,e){if(this.quality!==2||!this.config().occlusion)return null;const s=new Map(e.levels.map(p=>[p.id,p.elevation_m])),n=e.levels.length?Math.min(...e.levels.map(p=>p.elevation_m)):0,o=t.filter(p=>Be.has(p.kind)&&(p.shape==="box"||p.shape==="cylinder")&&p.position[1]-p.size[1]/2<=(s.get(p.level_id??"")??n)+He);if(!o.length)return null;this.aoMaterial||(this.aoMaterial=new de({map:Ve(),color:0,transparent:!0,depthWrite:!1}));const a=new $(this.unitPlane,this.aoMaterial,o.length),r=new R,d=new O,l=new P,h=new S,c=new S;return o.forEach((p,u)=>{d.setFromEuler(l.set(0,y(p.rotation[1]),0,"YXZ")),h.set(p.position[0],p.position[1]-p.size[1]/2+.012,p.position[2]),c.set(p.size[0]+2*ut,1,p.size[2]+2*ut),r.compose(h,d,c),a.setMatrixAt(u,r)}),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),a.name="ao",a.renderOrder=1,a}realise(t,e){const s={root:new C,lookup:new Map,small:[],placed:new Map,glows:[],ao:null},n=new Map,o=[];for(const c of t)if(c.group&&(c.shape==="box"||c.shape==="cylinder")){const p=n.get(c.group);p?p.push(c):n.set(c.group,[c])}else o.push(c);const a=new R,r=new O,d=new S,l=new S,h=new P;for(const[c,p]of n){const u=p[0],g=new $(u.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(u.color,u.opacity,!1,W(u)),p.length);p.forEach((b,k)=>{r.setFromEuler(h.set(y(b.rotation[0]),y(b.rotation[1]),y(b.rotation[2]),"YXZ")),d.set(b.position[0],b.position[1],b.position[2]),l.set(Math.max(b.size[0],.001),Math.max(b.size[1],.001),Math.max(b.size[2],.001)),a.compose(d,r,l),g.setMatrixAt(k,a),s.placed.set(b.id,{obj:g,index:k,part:b})}),g.instanceMatrix.needsUpdate=!0,g.computeBoundingSphere(),g.name=c,this.shadows(g,u),s.lookup.set(g,p),s.root.add(g),p.every(At)&&s.small.push(g)}for(const c of o){if(c.shape==="light"){s.glows.push(c);continue}const p=this.single(c,e);p&&(p.name=c.id,Oe.has(c.kind)||s.lookup.set(p,[c]),p instanceof E&&(c.shape==="box"||c.shape==="cylinder")&&s.placed.set(c.id,{obj:p,index:0,part:c}),s.root.add(p),At(c)&&s.small.push(p))}return s.ao=this.occlusion(t,e),s.ao&&s.root.add(s.ao),s}disposeGroup(t){for(const e of[...t.children])t.remove(e),e instanceof $?e.dispose():e instanceof E&&e.geometry!==this.unitBox&&e.geometry!==this.unitCylinder&&e.geometry.dispose(),e instanceof E&&e.userData.ownMaterial&&!Array.isArray(e.material)&&e.material.dispose(),e instanceof nt&&(e.material.map?.dispose(),e.material.dispose())}clear(){this.setSelected(null),this.disposeGroup(this.root);for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.placed.clear(),this.tints.clear(),this.smallGroups=[],this.cutAzimuth=null,this.cutNow.clear(),this.caps=null}setDescription(t){if(this.desc&&Qe(this.desc,t)){for(const n of t.parts){if(n.kind!=="tint")continue;const o=this.tints.get(n.id);o&&!Array.isArray(o.material)&&(o.material.opacity=n.opacity)}this.desc=t,this.invalidate();return}this.clear(),this.recolour(),this.desc=t,this.extent=Rt(t),this.heavy=t.parts.length>ht,this.builds++;const e=this.realise(t.parts,t);for(const n of[...e.root.children])this.root.add(n),n instanceof E&&n.userData.ownMaterial&&this.tints.set(n.name,n);this.lookup=e.lookup,this.placed=e.placed,this.smallGroups=e.small;let s=0;for(const n of e.glows){const o=this.glowPool[s++];o&&(o.color.set(this.opts.color(n.color)),o.intensity=ft*(this.night?Pt:1),o.distance=Math.max(n.size[0],1),o.position.set(n.position[0],n.position[1],n.position[2]))}if(this.hideSmall=t.parts.length>ht,!this.hideSmall)for(const n of this.smallGroups)n.visible=!0;this.fitSun(),this.framed||(this.framed=this.setPreset("iso")),this.updateCutaway(),this.invalidate()}setSelected(t){if(this.selectedId=t,this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(o=>o.userData.id===t&&o.kind!=="cone"&&o.kind!=="floor"&&o.kind!=="tint"&&!mt.has(o.kind)&&(o.shape==="box"||o.shape==="cylinder"||o.shape==="prism"||o.shape==="sprite")).slice(0,Ce);if(!e.length)return;const s=new C,n=new Map(this.desc.levels.map(o=>[o.id,o.elevation_m]));for(const o of e){const a=new pe(this.boxEdges,this.outlineMaterial),r=this.cutNow.has(o.id)?lt(o,n.get(o.level_id??"")??0,H):{y:o.position[1],h:o.size[1]};if(r){if(o.shape==="prism"){const d=o.polygon??[];if(!d.length)continue;const l=d.map(u=>u[0]),h=d.map(u=>u[1]),c=Math.max(...l)-Math.min(...l),p=Math.max(...h)-Math.min(...h);a.position.set(o.position[0]+(Math.max(...l)+Math.min(...l))/2,o.position[1]+o.size[1]/2,o.position[2]+(Math.max(...h)+Math.min(...h))/2),a.scale.set(c*1.04+.05,o.size[1]*1.04+.05,p*1.04+.05)}else this.transform(a,o),a.position.y=r.y,a.scale.set(o.size[0]*1.06+.05,r.h*1.06+.05,(o.shape==="sprite"?.1:o.size[2])*1.06+.05);a.renderOrder=10,s.add(a)}}this.outline=s,this.root.add(s),this.invalidate()}useCamera(t){t!==this.active&&(this.active=t,this.controls.object=t)}applyOrthoFrame(){const t=this.orthoFrame;if(!t)return;const e=this.persp.aspect||1;let s=t.halfW,n=t.halfH;s/n<e?s=n*e:n=s/e,this.ortho.left=-s,this.ortho.right=s,this.ortho.top=n,this.ortho.bottom=-n,this.ortho.updateProjectionMatrix()}setPreset(t){const e=this.desc,s=this.extent;if(!e||!s)return!1;const n=(s.x0+s.x1)/2,o=(s.z0+s.z1)/2,a=s.x1-s.x0,r=s.z1-s.z0,d=(h,c)=>Math.max(c,h/(this.persp.aspect||1),4)/(2*Math.tan(y(this.persp.fov/2))),l=Math.max(0,...e.levels.map(h=>h.elevation_m+h.ceiling_height_m));if(t==="top")this.useCamera(this.persp),this.controls.maxPolarAngle=D,this.persp.position.set(n,l+d(a,r)*1.2,o+.001),this.controls.target.set(n,0,o);else if(t==="iso"){this.useCamera(this.ortho),this.controls.maxPolarAngle=D;const h=rt(s,this.persp.aspect||1);this.orthoFrame=h,this.ortho.zoom=1,this.applyOrthoFrame(),this.ortho.position.set(h.target[0]+A[0]*h.dist,h.target[1]+A[1]*h.dist,h.target[2]+A[2]*h.dist),this.controls.target.set(h.target[0],h.target[1],h.target[2])}else if(t==="persp"){this.useCamera(this.persp),this.controls.maxPolarAngle=D;const h=Math.hypot(a,r),c=d(h,h*.62)*1.45;this.persp.position.set(n+j[0]*c,j[1]*c,o+j[2]*c),this.controls.target.set(n,0,o)}else{const h=e.parts.find(p=>p.id===t.camera&&p.kind==="camera");if(!h)return!1;this.useCamera(this.persp);const c=new S(0,0,-1).applyEuler(new P(y(h.rotation[0]),y(h.rotation[1]),y(h.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.persp.position.set(h.position[0],h.position[1],h.position[2]),this.controls.target.set(h.position[0]+c.x*6,h.position[1]+c.y*6,h.position[2]+c.z*6)}return this.preset=t,this.controls.update(),this.updateCutaway(),this.invalidate(),!0}projectPoint(t){this.active.updateMatrixWorld();const e=new S(t[0],t[1],t[2]).project(this.active);if(e.z>1)return null;const s=this.opts.mount.clientWidth,n=this.opts.mount.clientHeight;return{x:(e.x+1)/2*s,y:(1-e.y)/2*n}}wantedCutAzimuth(){const t=this.extent;if(this.quality!==2||!t||typeof this.preset!="string")return null;const e=this.active.position;if(e.y<=t.y1)return null;const s=(t.x0+t.x1)/2,n=(t.z0+t.z1)/2;return Math.hypot(e.x-s,e.z-n)<.5?null:ke(ze(e.x,e.z,s,n))}writeBox(t,e,s){const n=t.part,o=new O().setFromEuler(new P(y(n.rotation[0]),y(n.rotation[1]),y(n.rotation[2]),"YXZ")),a=s<=0,r=new S(n.position[0],e,n.position[2]),d=a?new S(1e-4,1e-4,1e-4):new S(Math.max(n.size[0],.001),Math.max(s,.001),Math.max(n.size[2],.001));t.obj instanceof $?(t.obj.setMatrixAt(t.index,new R().compose(r,o,d)),t.obj.instanceMatrix.needsUpdate=!0):(t.obj.position.copy(r),t.obj.scale.copy(d))}updateCutaway(){const t=this.wantedCutAzimuth();if(t===this.cutAzimuth)return;this.cutAzimuth=t;const e=this.desc;if(!e||!this.extent)return;const s=new Set(t===null?[]:Ee(e,t,this.extent)),n=new Map(e.levels.map(o=>[o.id,o.elevation_m]));for(const o of this.cutNow){if(s.has(o))continue;const a=this.placed.get(o);a&&this.writeBox(a,a.part.position[1],a.part.size[1])}for(const o of s){if(this.cutNow.has(o))continue;const a=this.placed.get(o);if(!a)continue;const r=lt(a.part,n.get(a.part.level_id??"")??0,H);r?this.writeBox(a,r.y,r.h):this.writeBox(a,(n.get(a.part.level_id??"")??0)-1,0)}this.cutNow=s,this.rebuildCaps(n),this.sun&&(this.sun.shadow.needsUpdate=!0),this.selectedId&&this.setSelected(this.selectedId)}rebuildCaps(t){this.caps&&(this.root.remove(this.caps),this.caps.dispose(),this.caps=null);const e=[...this.cutNow].sort().map(r=>this.placed.get(r)).filter(r=>!!r&&r.part.kind==="wall");if(!e.length||this.quality!==2)return;const s=new $(this.unitBox,this.material(wt,1,!1,"floor"),e.length),n=new R,o=new O,a=new P;e.forEach((r,d)=>{const l=r.part,h=(t.get(l.level_id??"")??0)+H;o.setFromEuler(a.set(y(l.rotation[0]),y(l.rotation[1]),y(l.rotation[2]),"YXZ")),n.compose(new S(l.position[0],h+gt/2-.004,l.position[2]),o,new S(l.size[0]+.004,gt,l.size[2]+.004)),s.setMatrixAt(d,n)}),s.instanceMatrix.needsUpdate=!0,s.computeBoundingSphere(),s.name="caps",s.castShadow=!0,this.caps=s,this.root.add(s)}cutawayNow(){return[...this.cutNow].sort()}get buildCount(){return this.builds}pick(t,e){const s=this.renderer.domElement.getBoundingClientRect();if(!s.width||!s.height)return null;this.raycaster.setFromCamera(new Nt((t-s.left)/s.width*2-1,-((e-s.top)/s.height)*2+1),this.active);const n=[...this.lookup.keys()].filter(o=>o.visible);for(const o of this.raycaster.intersectObjects(n,!1)){const a=this.lookup.get(o.object);if(!a)continue;const r=a[o.instanceId??0];if(r){if(r.kind==="floor"){if(this.plateOpacity(r)<1)continue;return null}return{id:r.userData.id,kind:r.userData.kind,partId:r.id}}}return null}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.persp.aspect=t/e,this.persp.updateProjectionMatrix(),this.applyOrthoFrame(),this.invalidate()}redrawNow(){this.disposed||(cancelAnimationFrame(this.raf),this.raf=0,this.frame())}capture(){return this.controls.update(),this.updateCutaway(),this.renderer.render(this.scene,this.active),this.renderer.domElement.toDataURL("image/png")}renderThumbnail(t,e,s=je,n=We){const o=t.parts.filter(w=>w.level_id===e&&w.kind!=="cone"&&w.shape!=="sprite"&&w.shape!=="light");if(!t.levels.some(w=>w.id===e))return null;const a={...t,levels:t.levels.filter(w=>w.id===e),parts:o},r=this.realise(o,a),d=new J;if(d.add(r.root),this.quality===2){d.add(this.night?new N(St,_t,zt):new N(bt,vt,yt));const w=this.night?new _(F,kt):new _(xt,Mt);w.position.set(I[0]*50,I[1]*50,I[2]*50),d.add(w)}else{d.add(this.night?new L(Et,.7):new L(16777215,1.6));const w=this.night?new _(F,.5):new _(16777215,1.4);w.position.set(1,2,1.2),d.add(w)}const l=this.renderer.domElement,h=this.renderer.getPixelRatio(),{w:c,h:p}=Ae(s,n,l.width/h,l.height/h);if(c<8||p<8)return this.disposeGroup(r.root),null;const u=rt(_e(t,e),c/p),g=new tt(-u.halfW,u.halfW,u.halfH,-u.halfH,.05,4e3);g.position.set(u.target[0]+A[0]*u.dist,u.target[1]+A[1]*u.dist,u.target[2]+A[2]*u.dist),g.lookAt(u.target[0],u.target[1],u.target[2]),g.updateProjectionMatrix();let b=null;const k=this.renderer.shadowMap.enabled;try{this.renderer.shadowMap.enabled=!1,this.renderer.setScissorTest(!0),this.renderer.setScissor(0,0,c,p),this.renderer.setViewport(0,0,c,p),this.renderer.render(d,g);const w=document.createElement("canvas");w.width=c,w.height=p;const T=w.getContext("2d");T&&(T.drawImage(l,0,l.height-p*h,c*h,p*h,0,0,c,p),b=w.toDataURL("image/png"))}catch(w){console.warn("sw-plan-3d: thumbnail failed",w)}finally{this.renderer.setScissorTest(!1),this.renderer.setViewport(0,0,l.width/h,l.height/h),this.renderer.shadowMap.enabled=k,this.disposeGroup(r.root),this.invalidate()}return b}async exportGltf(){const t=new C;for(const s of this.root.children)s!==this.outline&&t.add(s.clone());return await new ue().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.invalidate),this.controls.removeEventListener("change",this.invalidate),this.controls.dispose(),this.clear();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.aoMaterial&&(this.aoMaterial.map?.dispose(),this.aoMaterial.dispose()),this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.unitPlane.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}function Je(i,t,e,s,n){const o=document.createElement("div");o.setAttribute("aria-hidden","true"),o.dataset.skinControl="",o.style.cssText=`position:fixed;left:-1600px;top:0;width:${e}px;height:${s}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(o);let a=null;try{if(a=new Dt({mount:o,color:t,onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1}),a.setDescription(i),!a.setPreset("iso"))return null;a.capture();const r=a.renderer.domElement;if(r.width!==e||r.height!==s)return null;const d=document.createElement("canvas");d.width=e,d.height=s;const l=d.getContext("2d");return l?(l.fillStyle=n,l.fillRect(0,0,e,s),l.drawImage(r,0,0),d.toDataURL("image/png")):null}catch(r){return console.warn("sw-plan-3d: control image failed",r),null}finally{a?.dispose(),o.remove()}}const Ft=2500,ts=Ft+1500,es=1e4,ss=3,is=3e3;function ns(i,t,e){return new Promise(s=>{let n=!1;const o=setTimeout(()=>{n||(n=!0,s(e))},t);i.then(a=>{n||(n=!0,clearTimeout(o),s(a))},()=>{n||(n=!0,clearTimeout(o),s(e))})})}var os=Object.defineProperty,as=Object.getOwnPropertyDescriptor,m=(i,t,e,s)=>{for(var n=s>1?void 0:s?as(t,e):t,o=i.length-1,a;o>=0;o--)(a=i[o])&&(n=(s?a(t,e,n):a(n))||n);return s&&n&&os(t,e,n),n};const rs="ייצוא glTF נכשל",ls="עבר לרמה סכמטית — קצב הפריימים היה נמוך",hs=4e3,It="sw.plan3d.quality",K="sw.plan3d.fallback",Tt="sw.plan3d.night",cs=30,ds=6;function ps(i){return i.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}const us={wall:"קיר",opening:"פתח",object:"עצם",connector:"מחבר",camera:"מצלמה",entity:"ישות",zone:"חדר",label:"תווית",level:"מפלס"},Q=(i,t)=>{try{return(i==="local"?localStorage:sessionStorage).getItem(t)}catch{return null}},B=(i,t,e)=>{try{const s=i==="local"?localStorage:sessionStorage;e===null?s.removeItem(t):s.setItem(t,e)}catch{}},Ct=i=>i===2||i==="2"?2:i===1||i==="1"?1:null;let f=class extends Bt{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.frameKey=null,this.cameras=[],this.labels={},this.exportName="plan-3d",this.levels=[],this.activeLevel=null,this.thumbnailScene=null,this.levelDots={},this.qualityDefault=null,this.minFps=cs,this.continuous=!1,this.hover=null,this.overlays=[],this.overlayById=new Map,this.hiddenPills=0,this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.chosen=Ct(Q("local",It)),this.installDefault=null,this.fallback=Q("session",K)==="1",this.night=Q("local",Tt)==="1",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null,this.probe=null,this.probeTimer=0,this.probed=!1,this.probePending=!1,this.thumbs=new Map,this.thumbsFor=null,this.thumbsQuality=null,this.thumbPass=0,this.settingsAsked=!1,this.onVisibility=()=>{document.hidden?this.probe&&(this.endProbe(!1),this.probePending=!0):this.probePending&&this.quality===2&&this.view&&this.startProbe()}}firstUpdated(){this.watchBar(),this.init()}watchBar(){const i=this.renderRoot.querySelector(".bar");!i||typeof ResizeObserver>"u"||(this.barRo?.disconnect(),this.barRo=new ResizeObserver(()=>{const t=Math.ceil(i.getBoundingClientRect().height);t>0&&this.style.setProperty("--bar-h",`${t}px`)}),this.barRo.observe(i))}connectedCallback(){super.connectedCallback(),this.hasUpdated&&!this.view&&this.init(),document.addEventListener("visibilitychange",this.onVisibility)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("visibilitychange",this.onVisibility),this.ro?.disconnect(),this.barRo?.disconnect(),cancelAnimationFrame(this.thumbPass),this.thumbPass=0,this.endProbe(!1),this.probed=!1,this.probePending=!1,this.view?.dispose(),this.view=null,this.applied=null,this.thumbs.clear(),this.thumbsFor=null,window.clearTimeout(this.toastTimer)}get quality(){return this.fallback?1:this.chosen??this.qualityDefault??this.installDefault??1}init(){if(this.chosen===null&&this.qualityDefault===null&&this.installDefault===null&&!this.settingsAsked){this.settingsAsked=!0,ns(Ht().then(i=>Ct(i["plan.quality"])??1),is,1).then(i=>{this.installDefault=i}).finally(()=>{this.isConnected&&!this.view&&this.init()});return}try{this.view=new Dt({mount:this.stage,color:i=>getComputedStyle(this).getPropertyValue(`--sw-${i}`).trim()||"#888888",onSelect:i=>this.emitSelect(i),onHover:(i,t,e)=>this.setHover(i,t,e),onFrame:(i,t)=>{this.setAttribute("data-frames",String(i)),this.setAttribute("data-fps",String(t)),this.onProbeFrame(i)},onDraw:()=>this.layoutOverlays(),quality:this.quality,night:this.night}),this.toggleAttribute("data-night",this.night)}catch(i){console.warn("sw-plan-3d: WebGL failed to start",i),this.error=Gt;return}this.view.setContinuous(this.continuous),this.ro=new ResizeObserver(()=>this.view?.resize()),this.ro.observe(this),this.presetApplied=!1,this.setAttribute("data-quality",String(this.quality)),this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}willUpdate(i){if(!(i.has("description")||i.has("activeLevel")||i.has("selectedId")||i.has("hover")))return;const t=this.description?.parts??[],e=t.filter(n=>n.kind==="chip");let s=t.filter(n=>n.kind==="entity"&&(!this.activeLevel||n.level_id===this.activeLevel));if(this.hiddenPills=0,s.length>be){const n=s.filter(o=>o.userData.id===this.selectedId||o.userData.id===this.hover?.id||o.color!=="text-3");this.hiddenPills=s.length-n.length,s=n}this.overlays=[...e,...s],this.overlayById=new Map(this.overlays.map(n=>[n.id,n]))}updated(i){if(!this.view)return;const t=i.has("frameKey")&&i.get("frameKey")!==void 0;t&&(this.presetApplied=!1),i.has("description")&&this.description&&this.apply(this.description),t&&!this.presetApplied&&this.applied&&this.frame(),(i.has("selectedId")||i.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),i.has("preset")&&i.get("preset")!==void 0&&this.applyPreset(this.preset),i.has("continuous")&&!this.probe&&this.view.setContinuous(this.continuous),this.applyQuality(),this.layoutOverlays()}layoutOverlays(){const i=this.view;if(!i||!this.overlays.length)return;this.renderRoot.querySelectorAll("[data-3d-part]").forEach(e=>{const s=this.overlayById.get(e.getAttribute("data-3d-part")??""),n=s?i.projectPoint(s.position):null;if(!s||!n){e.style.display="none";return}e.style.display="block",e.style.transform=s.kind==="chip"?`translate(${Math.round(n.x)}px, ${Math.round(n.y)}px) translate(-50%, -50%)`:`translate(${Math.round(n.x)}px, ${Math.round(n.y)-ds}px) translate(-50%, -100%)`})}apply(i){i!==this.applied&&(this.applied=i,this.view?.setDescription(i),this.setAttribute("data-parts",String(i.parts.length)),this.toggleAttribute("data-estimated",i.estimated),this.presetApplied||this.frame(),this.view?.setSelected(this.selectedId),this.quality===2&&!this.probed&&this.startProbe())}applyQuality(){const i=this.quality;this.setAttribute("data-quality",String(i)),!(!this.view||this.view.getQuality()===i)&&(this.view.setQuality(i),this.thumbs.clear(),this.probed=!1,i===2&&this.applied?this.startProbe():this.endProbe(!1),this.requestUpdate())}setNight(i){i!==this.night&&(this.night=i,B("local",Tt,i?"1":null),this.toggleAttribute("data-night",i),this.view?.setNight(i),this.thumbs.clear(),this.requestUpdate())}get isNight(){return this.night}setQuality(i){this.chosen=i,B("local",It,String(i)),i===2&&this.fallback&&(this.fallback=!1,B("session",K,null))}startProbe(){if(this.endProbe(!1),this.probed=!0,!(!this.view||this.minFps<=0)){if(document.hidden){this.probePending=!0;return}this.probePending=!1,this.probe={until:0,t0:0,f0:0,start:Number(this.getAttribute("data-frames")??0)},this.view.setContinuous(!0),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),es)}}onProbeFrame(i){const t=this.probe;if(!t)return;if(document.hidden){this.endProbe(!1),this.probePending=!0;return}const e=performance.now();if(!t.t0){if(i-t.start<ss)return;t.t0=e,t.f0=i,t.until=e+Ft,window.clearTimeout(this.probeTimer),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),ts);return}if(e<t.until)return;const s=(i-t.f0)*1e3/(e-t.t0);this.setAttribute("data-probe-fps",String(Math.round(s))),this.endProbe(!1),s<this.minFps&&this.fallBack()}endProbe(i){window.clearTimeout(this.probeTimer),this.probeTimer=0;const t=this.probe;if(this.probe=null,this.view?.setContinuous(this.continuous),i&&t&&document.hidden){this.probePending=!0;return}if(i&&t){const e=Number(this.getAttribute("data-frames")??0),s=t.t0?(e-t.f0)*1e3/Math.max(1,performance.now()-t.t0):0;this.setAttribute("data-probe-fps",String(Math.round(s))),s<this.minFps&&this.fallBack()}}fallBack(){this.fallback=!0,B("session",K,"1")}frame(){this.presetApplied=!0,this.view?.setPreset(this.preset)?this.setAttribute("data-preset",typeof this.preset=="string"?this.preset:"camera"):this.view?.setPreset("iso")&&this.setAttribute("data-preset","iso")}applyPreset(i){this.view?.setPreset(i)&&this.setAttribute("data-preset",typeof i=="string"?i:"camera")}pickPreset(i){this.preset=i,this.applyPreset(i)}labelOf(i){return this.labels[i.id]??us[i.kind]??i.id}emitSelect(i){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:i?.id??null,kind:i?.kind??null},bubbles:!0,composed:!0}))}setHover(i,t,e){this.hover=i?{id:i.id,kind:i.kind,label:this.labelOf(i),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}pickLevel(i){const t=this.activeLevel===i?null:i;this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t},bubbles:!0,composed:!0}))}thumbFor(i){const t=this.thumbnailScene;if(!t||!this.view)return"";(this.thumbsFor!==t||this.thumbsQuality!==this.quality)&&(this.thumbs.clear(),this.thumbsFor=t,this.thumbsQuality=this.quality);const e=this.thumbs.get(i);return e===void 0&&this.scheduleThumbs(),e??""}scheduleThumbs(){this.thumbPass||(this.thumbPass=requestAnimationFrame(()=>{this.thumbPass=0;const i=this.thumbnailScene,t=this.view;if(!i||!t||this.thumbsFor!==i)return;let e=!1;for(const s of this.levels){if(this.thumbs.has(s.id))continue;const n=t.renderThumbnail(i,s.id);n&&(this.thumbs.set(s.id,n),e=!0)}e&&t.redrawNow(),this.setAttribute("data-3d-thumbs",String(this.thumbs.size)),e&&this.requestUpdate()}))}get thumbnailCount(){return this.thumbs.size}toScreen(i){return this.view?.projectPoint(i)??null}capture(){return this.view?.capture()??null}captureControl(i){return Je(i,Yt,Wt,jt,Ut)}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const i=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(i)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${ps(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(i){console.warn("sw-plan-3d: glTF export failed",i),this.showToast(rs)}finally{this.exporting=!1}}}showToast(i){this.toast=i,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",hs)}renderStrip(){if(this.levels.length<2||!this.thumbnailScene||!this.ready)return x;const i=[...this.levels].sort((t,e)=>e.elevation_m-t.elevation_m||(t.id<e.id?-1:1));return this.thumbs=qt(this.thumbs,i.map(t=>t.id)),v`<div class="strip" role="group" aria-label="מפלסים" data-3d-strip>
      ${i.map(t=>{const e=this.levelDots[t.id];return v`<button type="button" data-3d-thumb=${t.id} aria-pressed=${this.activeLevel===t.id?"true":"false"} title=${`${t.name} · ${t.elevation_m>=0?"+":"−"}${Math.abs(t.elevation_m).toFixed(1)} מ׳`} @click=${()=>this.pickLevel(t.id)}>
          <span class="pic"><img alt="" src=${this.thumbFor(t.id)} />${e&&(e.presence>0||e.open||e.lit)?v`<span class="dots" data-3d-dots=${t.id}>${e.presence>0?v`<i data-dot="presence" title="תנועה" style=${`--fade:${Math.max(.35,e.presence).toFixed(2)}`}></i>`:x}${e.open?v`<i data-dot="open" title="פתח פתוח"></i>`:x}${e.lit?v`<i data-dot="lit" title="תאורה דולקת"></i>`:x}</span>`:x}</span><span>${t.name}</span>
        </button>`})}
    </div>`}render(){const i=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,""),e=this.quality;return v`
      <div class="stage"></div>
      ${!this.ready&&!this.error?v`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>`:x}
      ${this.error?v`<div class="spinner err" data-3d-error>${this.error}</div>`:x}
      ${this.overlays.length?v`<div class="overlay">${this.overlays.map(s=>s.kind==="chip"?v`<span class="chip" aria-hidden="true" data-3d-chip=${s.userData.id} data-3d-chip-part=${s.id} data-3d-part=${s.id}>${s.text??""}</span>`:v`<button type="button" class="lbl" tabindex="-1" data-3d-label=${s.userData.id} data-3d-part=${s.id} aria-pressed=${this.selectedId===s.userData.id?"true":"false"} style=${`--lbl: var(--sw-${s.color})`} @click=${()=>this.emitSelect({id:s.userData.id,kind:s.userData.kind,partId:s.id})}>${s.text??""}</button>`)}${this.hiddenPills?v`<span class="more" data-3d-more=${this.hiddenPills} title="ישויות ללא מצב מיוחד מוסתרות במבט הכללי; בחירה ברשימה או במפלס מציגה אותן">+${this.hiddenPills} ישויות</span>`:x}</div>`:x}
      ${this.renderStrip()}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${i==="top"} @click=${()=>this.pickPreset("top")}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${i==="iso"} @click=${()=>this.pickPreset("iso")}>איזומטרי</sw-chip>
        <sw-chip data-preset-persp ?selected=${i==="persp"} @click=${()=>this.pickPreset("persp")}>פרספקטיבה</sw-chip>
        ${this.cameras.length?v`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${t} @change=${s=>this.onCameraChange(s)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map(s=>v`<option value=${s.id} ?selected=${s.id===t}>${s.label}</option>`)}
            </select>`:x}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-1 title="רמה סכמטית: חומרים שטוחים, בלי צללים" ?selected=${e===1} @click=${()=>this.setQuality(1)}>סכמטי</sw-chip>
        <sw-chip data-quality-2 title="רמה מלאה: צללים רכים, חומרים, חיתוך קירות" ?selected=${e===2} @click=${()=>this.setQuality(2)}>מלא</sw-chip>
        <sw-chip data-night-toggle title="מצב לילה: שמיים כהים, אור ירח, החדרים הדלוקים זוהרים" ?selected=${this.night} aria-pressed=${this.night} @click=${()=>this.setNight(!this.night)}>לילה</sw-chip>
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?"מייצא…":"ייצוא glTF"}</sw-button>
      </div>
      ${this.description?.estimated?v`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>`:x}
      ${this.fallback?v`<div class="note fb" role="status" data-3d-fallback>${ls}</div>`:x}
      ${this.toast?v`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:x}
      ${this.hover?v`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:x}
    `}onCameraChange(i){const t=i.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};f.styles=Kt`
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
  `;m([M({attribute:!1})],f.prototype,"description",2);m([M()],f.prototype,"selectedId",2);m([M({attribute:!1})],f.prototype,"preset",2);m([M()],f.prototype,"frameKey",2);m([M({attribute:!1})],f.prototype,"cameras",2);m([M({attribute:!1})],f.prototype,"labels",2);m([M()],f.prototype,"exportName",2);m([M({attribute:!1})],f.prototype,"levels",2);m([M()],f.prototype,"activeLevel",2);m([M({attribute:!1})],f.prototype,"thumbnailScene",2);m([M({attribute:!1})],f.prototype,"levelDots",2);m([M({attribute:!1})],f.prototype,"qualityDefault",2);m([M({type:Number})],f.prototype,"minFps",2);m([M({type:Boolean,reflect:!0,attribute:"data-measure"})],f.prototype,"continuous",2);m([z()],f.prototype,"hover",2);m([z()],f.prototype,"ready",2);m([z()],f.prototype,"exporting",2);m([z()],f.prototype,"error",2);m([z()],f.prototype,"toast",2);m([z()],f.prototype,"chosen",2);m([z()],f.prototype,"installDefault",2);m([z()],f.prototype,"fallback",2);m([z()],f.prototype,"night",2);m([Qt(".stage")],f.prototype,"stage",2);f=m([Xt("sw-plan-3d")],f);export{cs as DEFAULT_MIN_FPS,K as FALLBACK_KEY,Tt as NIGHT_KEY,be as PILL_CAP,ts as PROBE_FALLBACK_MS,es as PROBE_FIRST_FRAME_MS,Ft as PROBE_MS,ss as PROBE_WARM_FRAMES,It as QUALITY_KEY,is as SETTINGS_WAIT_MS,f as SwPlan3d};
//# sourceMappingURL=sw-plan-3d-CaYhWdAq.js.map
