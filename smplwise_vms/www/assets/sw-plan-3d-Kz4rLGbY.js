import{i as _t,p as Pt,W as At,A as z,k as Et,b as y,a as It,n as x,r as S,e as Ct,t as Tt}from"./index-CzG1QRGW.js";import{S as X,P as Lt,O as V,G as I,B as Ft,C as $t,a as Ot,R as Rt,W as Dt,b as Y,c as Nt,L as qt,d as K,e as Bt,f as Ht,D as C,A as N,H as q,g as Ut,N as Gt,M as Z,h as J,i as jt,E as _,j as yt,k as tt,l as Wt,m as L,n as Yt,I as T,Q as F,V as M,o as $,p as Qt,q as Mt,r as Xt,s as zt,F as St,t as Vt}from"./three-DcroZdrW.js";const et=Math.SQRT2,B=Math.sqrt(3),H=Math.sqrt(6),P=[1/B,1/B,1/B],U=(()=>{const i=Math.hypot(1,.85,1);return[1/i,.85/i,1/i]})(),Kt=[1/et,0,-1/et],Zt=[-1/H,2/H,-1/H],Jt=1.08,R=.7,te=10,ee=Math.cos(65*Math.PI/180),se=new Set(["wall"]),ie=new Set(["lintel","sill","head","window","door"]),oe=1,D=i=>i*Math.PI/180,st=(i,t)=>i[0]*t[0]+i[1]*t[1]+i[2]*t[2];function kt(i){const t=i.parts.filter(r=>r.kind==="floor"&&r.shape==="box");let e=1/0,s=1/0,o=-1/0,n=-1/0;for(const r of t)e=Math.min(e,r.position[0]-r.size[0]/2),o=Math.max(o,r.position[0]+r.size[0]/2),s=Math.min(s,r.position[2]-r.size[2]/2),n=Math.max(n,r.position[2]+r.size[2]/2);Number.isFinite(e)||([e,s,o,n]=[0,0,i.size[0],i.size[1]]);const a=i.levels.length?i.levels:[{id:"",elevation_m:0,ceiling_height_m:2.8}],l=Math.min(...a.map(r=>r.elevation_m)),d=Math.max(...a.map(r=>r.elevation_m+r.ceiling_height_m));return{x0:e,z0:s,x1:o,z1:n,y0:l,y1:d}}function ne(i,t){const e=i.levels.find(c=>c.id===t),s=i.parts.filter(c=>c.level_id===t),o=s.find(c=>c.kind==="floor"&&c.shape==="box"),n=e?e.elevation_m:0,a=e?e.elevation_m+e.ceiling_height_m:n+2.8;if(o)return{x0:o.position[0]-o.size[0]/2,x1:o.position[0]+o.size[0]/2,z0:o.position[2]-o.size[2]/2,z1:o.position[2]+o.size[2]/2,y0:n,y1:a};if(!s.length)return{x0:0,z0:0,x1:i.size[0],z1:i.size[1],y0:n,y1:a};let l=1/0,d=1/0,r=-1/0,h=-1/0;for(const c of s){const p=Math.hypot(c.size[0],c.size[2])/2;l=Math.min(l,c.position[0]-p),r=Math.max(r,c.position[0]+p),d=Math.min(d,c.position[2]-p),h=Math.max(h,c.position[2]+p)}return{x0:l,z0:d,x1:r,z1:h,y0:n,y1:a}}function it(i,t,e=Jt){const s=(i.x0+i.x1)/2,o=(i.y0+i.y1)/2,n=(i.z0+i.z1)/2;let a=1/0,l=-1/0,d=1/0,r=-1/0;for(const u of[i.x0,i.x1])for(const g of[i.y0,i.y1])for(const k of[i.z0,i.z1]){const f=[u-s,g-o,k-n],E=st(f,Kt),Q=st(f,Zt);a=Math.min(a,E),l=Math.max(l,E),d=Math.min(d,Q),r=Math.max(r,Q)}let h=Math.max((l-a)/2,1)*e,c=Math.max((r-d)/2,1)*e;const p=t>0&&Number.isFinite(t)?t:1;h/c<p?h=c*p:c=h/p;const w=Math.hypot(i.x1-i.x0,i.y1-i.y0,i.z1-i.z0);return{target:[s,o,n],halfW:h,halfH:c,dist:Math.max(w*2,20)}}function ae(i,t,e,s){return(Math.atan2(t-s,i-e)*180/Math.PI%360+360)%360}function re(i,t=te){const e=(i%360+360)%360;return(Math.floor(e/t)*t+t/2)%360}function le(i,t,e,s=0){const o=D(i.rotation[1]),n=t-i.position[0],a=e-i.position[2],l=n*Math.cos(o)-a*Math.sin(o),d=n*Math.sin(o)+a*Math.cos(o);return Math.abs(l)<=i.size[0]/2+s&&Math.abs(d)<=i.size[2]/2+s}function he(i,t,e=kt(i)){const s=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,n=Math.cos(D(t)),a=Math.sin(D(t)),l=[];for(const r of i.parts){if(!se.has(r.kind)||r.shape!=="box")continue;const h=r.position[0]-s,c=r.position[2]-o;if(Math.hypot(h,c)<1e-6||h*n+c*a<=0)continue;const w=D(r.rotation[1]);let u=Math.sin(w),g=Math.cos(w);u*h+g*c<0&&(u=-u,g=-g),!(u*n+g*a<ee)&&l.push(r)}const d=new Set(l.map(r=>r.id));for(const r of i.parts)ie.has(r.kind)&&l.some(h=>h.level_id===r.level_id&&le(h,r.position[0],r.position[2],oe))&&d.add(r.id);return[...d].sort()}function ot(i,t,e=R){const s=i.size[1],o=i.position[1]-s/2,n=t+e;if(o>=n-1e-6)return null;if(o+s<=n+1e-6)return{y:i.position[1],h:s};const a=n-o;return{y:o+a/2,h:a}}const ce=.6,nt=3e3,at=45,pe=8,rt=2048,lt=.28,de=64,ue=6,fe=.35,me=.88,we=8,O=Math.PI/2-.02,be=new Set(["glow","cone"]),ge=new Set(["wall","lintel","sill","head","door","object","connector","camera"]),ve=new Set(["floor","wall","object","connector","room","lintel","sill","head"]),xe=new Set(["wall","lintel","sill","head","door","connector"]),ye=new Set(["wall","object","connector"]),Me=.5,A=(()=>{const i=Math.hypot(-.6,1.1,-.25);return[-.6/i,1.1/i,-.25/i]})(),ze="map-wall-3d",ht="map-structure",ct=.025,pt=16777215,dt=15133682,ut=2.1,ft=16774108,mt=3,Se=1.12,ke=160,_e=100,v=i=>i*Math.PI/180,wt=i=>i.kind==="object"&&Math.max(i.size[0],i.size[1],i.size[2])<ce,G=i=>i.kind==="floor"?"floor":i.color==="map-glass"?"glass":"std";function Pe(){const i=[-.5,.5],t=[];for(const s of i)for(const o of i)t.push(-.5,s,o,.5,s,o),t.push(s,-.5,o,s,.5,o),t.push(s,o,-.5,s,o,.5);const e=new zt;return e.setAttribute("position",new St(t,3)),e}function Ae(){const t=document.createElement("canvas");t.width=64,t.height=64;const e=t.getContext("2d");if(e){const o=e.createImageData(64,64);for(let n=0;n<64;n++)for(let a=0;a<64;a++){const l=Math.abs((a+.5)/64-.5)*2,d=Math.abs((n+.5)/64-.5)*2,r=Math.max(l,d),h=Math.min(1,Math.max(0,(r-.5)/.5)),c=(1-h*h*(3-2*h))*.42,p=(n*64+a)*4;o.data[p+3]=Math.round(c*255)}e.putImageData(o,0,0)}const s=new yt(t);return s.colorSpace=Y,s}function Ee(i,t){const e=[];for(const l of i){const d=e[e.length-1];(!d||Math.hypot(l[0]-d[0],l[1]-d[1])>1e-6)&&e.push(l)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let s=0;for(let l=0;l<e.length;l++){const d=e[l],r=e[(l+1)%e.length];s+=d[0]*r[1]-r[0]*d[1]}if(Math.abs(s)<1e-8)return null;const o=Vt.triangulateShape(e.map(([l,d])=>new Mt(l,d)),[]),n=[];for(const[l,d,r]of o){const[h,c,p]=[e[l],e[d],e[r]];Math.abs((c[0]-h[0])*(p[1]-h[1])-(p[0]-h[0])*(c[1]-h[1]))<1e-10||(n.push(h[0],t,h[1],c[0],t,c[1],p[0],t,p[1]),n.push(h[0],0,h[1],p[0],0,p[1],c[0],0,c[1]))}for(let l=0;l<e.length;l++){const d=e[l],r=e[(l+1)%e.length];n.push(d[0],0,d[1],r[0],0,r[1],r[0],t,r[1],d[0],0,d[1],r[0],t,r[1],d[0],t,d[1])}const a=new zt;return a.setAttribute("position",new St(n,3)),a.computeVertexNormals(),a}class Ie{constructor(t){this.opts=t,this.scene=new X,this.persp=new Lt(50,1,.05,2e3),this.ortho=new V(-1,1,1,-1,.05,4e3),this.active=this.persp,this.root=new I,this.unitBox=new Ft(1,1,1),this.unitCylinder=new $t(.5,.5,1,24),this.unitPlane=new Ot(1,1).rotateX(-Math.PI/2),this.boxEdges=Pe(),this.materials=new Map,this.aoMaterial=null,this.raycaster=new Rt,this.glowPool=[],this.lights=new I,this.sun=null,this.lookup=new Map,this.placed=new Map,this.smallGroups=[],this.outline=null,this.desc=null,this.extent=null,this.selectedId=null,this.preset="iso",this.orthoFrame=null,this.cutAzimuth=null,this.cutNow=new Set,this.caps=null,this.framed=!1,this.hideSmall=!1,this.heavy=!1,this.disposed=!1,this.continuous=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.onDown=s=>{s.isPrimary&&(this.pressed={x:s.clientX,y:s.clientY,id:s.pointerId})},this.onUp=s=>{const o=this.pressed;!o||s.pointerId!==o.id||(this.pressed=null,!(s.button!==0||Math.hypot(s.clientX-o.x,s.clientY-o.y)>ue)&&this.opts.onSelect(this.pick(s.clientX,s.clientY)))},this.onCancel=s=>{this.pressed?.id===s.pointerId&&(this.pressed=null)},this.onMove=s=>{if(this.pressed||s.pointerType==="touch"||!s.isPrimary)return;const o=this.pick(s.clientX,s.clientY),n=o?o.partId:null;if(n===this.lastHover)return;this.lastHover=n;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(o,s.clientX-a.left,s.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const s=this.controls.update();if(this.hideSmall){const a=this.active===this.ortho?this.ortho.top/(this.ortho.zoom||1)<at/2:this.persp.position.distanceTo(this.controls.target)<at;for(const l of this.smallGroups)l.visible=a}this.updateCutaway(),this.renderer.render(this.scene,this.active),this.frames++;const o=performance.now();this.windowStart||(this.windowStart=o),this.windowFrames++,o-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(o-this.windowStart)),this.windowStart=o,this.windowFrames=0);const n=s||this.continuous;(!n||o-this.lastReport>=1e3)&&(this.lastReport=o,this.opts.onFrame(this.frames,this.fps)),n?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.quality=t.quality??1,this.renderer=new Dt({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),this.renderer.outputColorSpace=Y,this.renderer.shadowMap.type=Nt,this.outlineMaterial=new qt({color:new K(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new Bt(this.persp,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=O,this.controls.addEventListener("change",this.invalidate),this.scene.add(this.lights),this.applyQuality();for(let s=0;s<pe;s++){const o=new Ht(16777215,0,1,2);this.glowPool.push(o),this.scene.add(o)}this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.invalidate),this.resize()}get camera(){return this.active}getQuality(){return this.quality}setQuality(t){if(t!==this.quality){this.quality=t,this.applyQuality();for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,s=this.selectedId;this.setDescription(e),this.setSelected(s)}this.invalidate()}}applyQuality(){for(const t of[...this.lights.children])this.lights.remove(t),(t instanceof C||t instanceof N||t instanceof q)&&t.dispose();if(this.sun=null,this.cutAzimuth=null,this.cutNow.clear(),this.quality===2){this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=Ut,this.renderer.toneMappingExposure=Se,this.lights.add(new q(pt,dt,ut));const t=new C(ft,mt);t.castShadow=!0,t.shadow.mapSize.set(rt,rt),t.shadow.bias=-4e-4,t.shadow.normalBias=.03,this.lights.add(t),this.lights.add(t.target),this.sun=t,this.fitSun()}else{this.renderer.shadowMap.enabled=!1,this.renderer.toneMapping=Gt,this.renderer.toneMappingExposure=1,this.lights.add(new N(16777215,1.6));const t=new C(16777215,1.4);t.position.set(1,2,1.2),this.lights.add(t)}}fitSun(){const t=this.sun,e=this.extent;if(!t||!e)return;const s=(e.x0+e.x1)/2,o=(e.y0+e.y1)/2,n=(e.z0+e.z1)/2,a=Math.max(Math.hypot(e.x1-e.x0,e.y1-e.y0,e.z1-e.z0)/2,2)*1.05;t.position.set(s+A[0]*a*2,o+A[1]*a*2,n+A[2]*a*2),t.target.position.set(s,o,n),t.target.updateMatrixWorld();const l=t.shadow.camera;l.left=-a,l.right=a,l.top=a,l.bottom=-a,l.near=.1,l.far=a*4,l.updateProjectionMatrix(),t.shadow.needsUpdate=!0}material(t,e,s=!1,o="std"){const n=`${t}|${e}|${s?2:1}|${this.quality===2?o:"l1"}`;let a=this.materials.get(n);if(!a){const l=s?{side:J,forceSinglePass:!0}:{},d=this.quality===2&&t===ht&&o==="std"?ze:t,r=new K(this.opts.color(d));let h;this.quality===2&&o==="glass"?h=new Z({color:r,roughness:.12,metalness:.25,transparent:!0,opacity:Math.max(e,.35),depthWrite:!1,side:J,forceSinglePass:!0}):this.quality===2?h=new Z({color:r,roughness:o==="floor"?1:.88,metalness:0,transparent:e<1,opacity:e,depthWrite:e>=1,...l}):h=new jt({color:r,transparent:e<1,opacity:e,depthWrite:e>=1,...l}),a={token:d,material:h},this.materials.set(n,a)}return a.material}recolour(){for(const{token:t,material:e}of this.materials.values())e.color.set(this.opts.color(t));this.outlineMaterial.color.set(this.opts.color("accent"))}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new _(v(e.rotation[0]),v(e.rotation[1]),v(e.rotation[2]),"YXZ"))}plateOpacity(t,e=this.desc){const s=e?.levels??[];if(t.kind!=="floor"||s.length<2)return t.opacity;const o=Math.min(...s.map(a=>a.elevation_m)),n=s.find(a=>a.id===t.level_id);return n&&n.elevation_m>o?Math.min(t.opacity,fe):t.opacity}shadows(t,e){this.quality===2&&(t.castShadow=(this.heavy?xe:ge).has(e.kind)&&e.color!=="map-glass",t.receiveShadow=ve.has(e.kind)&&!(this.heavy&&e.kind==="object"))}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const s=e.getContext("2d");s&&(s.globalAlpha=me,s.fillStyle=this.opts.color("surface"),s.beginPath(),s.roundRect(8,16,496,96,48),s.fill(),s.globalAlpha=1,s.fillStyle=this.opts.color(t.color),s.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',s.textAlign="center",s.textBaseline="middle",s.direction="rtl",s.fillText(t.text??"",256,66,480));const o=new yt(e);o.colorSpace=Y;const n=new tt(new Wt({map:o,transparent:!0,depthTest:!0}));return n.position.set(t.position[0],t.position[1],t.position[2]),n.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),n}single(t,e){if(t.shape==="box"||t.shape==="cylinder"){const s=new L(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t,e),!1,G(t)));return this.transform(s,t),s.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),this.shadows(s,t),s}if(t.shape==="prism"){const s=Ee(t.polygon??[],t.size[1]);if(!s)return null;const o=new L(s,this.material(t.color,t.opacity,!0,G(t)));return o.position.set(t.position[0],t.position[1],t.position[2]),this.shadows(o,t),o}return t.shape==="sprite"?this.label(t):null}occlusion(t,e){if(this.quality!==2)return null;const s=new Map(e.levels.map(p=>[p.id,p.elevation_m])),o=e.levels.length?Math.min(...e.levels.map(p=>p.elevation_m)):0,n=t.filter(p=>ye.has(p.kind)&&(p.shape==="box"||p.shape==="cylinder")&&p.position[1]-p.size[1]/2<=(s.get(p.level_id??"")??o)+Me);if(!n.length)return null;this.aoMaterial||(this.aoMaterial=new Yt({map:Ae(),color:0,transparent:!0,depthWrite:!1}));const a=new T(this.unitPlane,this.aoMaterial,n.length),l=new $,d=new F,r=new _,h=new M,c=new M;return n.forEach((p,w)=>{d.setFromEuler(r.set(0,v(p.rotation[1]),0,"YXZ")),h.set(p.position[0],p.position[1]-p.size[1]/2+.012,p.position[2]),c.set(p.size[0]+2*lt,1,p.size[2]+2*lt),l.compose(h,d,c),a.setMatrixAt(w,l)}),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),a.name="ao",a.renderOrder=1,a}realise(t,e){const s={root:new I,lookup:new Map,small:[],placed:new Map,glows:[],ao:null},o=new Map,n=[];for(const c of t)if(c.group&&(c.shape==="box"||c.shape==="cylinder")){const p=o.get(c.group);p?p.push(c):o.set(c.group,[c])}else n.push(c);const a=new $,l=new F,d=new M,r=new M,h=new _;for(const[c,p]of o){const w=p[0],u=new T(w.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(w.color,w.opacity,!1,G(w)),p.length);p.forEach((g,k)=>{l.setFromEuler(h.set(v(g.rotation[0]),v(g.rotation[1]),v(g.rotation[2]),"YXZ")),d.set(g.position[0],g.position[1],g.position[2]),r.set(Math.max(g.size[0],.001),Math.max(g.size[1],.001),Math.max(g.size[2],.001)),a.compose(d,l,r),u.setMatrixAt(k,a),s.placed.set(g.id,{obj:u,index:k,part:g})}),u.instanceMatrix.needsUpdate=!0,u.computeBoundingSphere(),u.name=c,this.shadows(u,w),s.lookup.set(u,p),s.root.add(u),p.every(wt)&&s.small.push(u)}for(const c of n){if(c.shape==="light"){s.glows.push(c);continue}const p=this.single(c,e);p&&(p.name=c.id,be.has(c.kind)||s.lookup.set(p,[c]),p instanceof L&&(c.shape==="box"||c.shape==="cylinder")&&s.placed.set(c.id,{obj:p,index:0,part:c}),s.root.add(p),wt(c)&&s.small.push(p))}return s.ao=this.occlusion(t,e),s.ao&&s.root.add(s.ao),s}disposeGroup(t){for(const e of[...t.children])t.remove(e),e instanceof T?e.dispose():e instanceof L&&e.geometry!==this.unitBox&&e.geometry!==this.unitCylinder&&e.geometry.dispose(),e instanceof tt&&(e.material.map?.dispose(),e.material.dispose())}clear(){this.setSelected(null),this.disposeGroup(this.root);for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.placed.clear(),this.smallGroups=[],this.cutAzimuth=null,this.cutNow.clear(),this.caps=null}setDescription(t){this.clear(),this.recolour(),this.desc=t,this.extent=kt(t),this.heavy=t.parts.length>nt;const e=this.realise(t.parts,t);for(const o of[...e.root.children])this.root.add(o);this.lookup=e.lookup,this.placed=e.placed,this.smallGroups=e.small;let s=0;for(const o of e.glows){const n=this.glowPool[s++];n&&(n.color.set(this.opts.color(o.color)),n.intensity=we,n.distance=Math.max(o.size[0],1),n.position.set(o.position[0],o.position[1],o.position[2]))}if(this.hideSmall=t.parts.length>nt,!this.hideSmall)for(const o of this.smallGroups)o.visible=!0;this.fitSun(),this.framed||(this.framed=this.setPreset("iso")),this.updateCutaway(),this.invalidate()}setSelected(t){if(this.selectedId=t,this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(n=>n.userData.id===t&&n.kind!=="cone"&&n.kind!=="floor"&&(n.shape==="box"||n.shape==="cylinder"||n.shape==="prism"||n.shape==="sprite")).slice(0,de);if(!e.length)return;const s=new I,o=new Map(this.desc.levels.map(n=>[n.id,n.elevation_m]));for(const n of e){const a=new Qt(this.boxEdges,this.outlineMaterial),l=this.cutNow.has(n.id)?ot(n,o.get(n.level_id??"")??0,R):{y:n.position[1],h:n.size[1]};if(l){if(n.shape==="prism"){const d=n.polygon??[];if(!d.length)continue;const r=d.map(w=>w[0]),h=d.map(w=>w[1]),c=Math.max(...r)-Math.min(...r),p=Math.max(...h)-Math.min(...h);a.position.set(n.position[0]+(Math.max(...r)+Math.min(...r))/2,n.position[1]+n.size[1]/2,n.position[2]+(Math.max(...h)+Math.min(...h))/2),a.scale.set(c*1.04+.05,n.size[1]*1.04+.05,p*1.04+.05)}else this.transform(a,n),a.position.y=l.y,a.scale.set(n.size[0]*1.06+.05,l.h*1.06+.05,(n.shape==="sprite"?.1:n.size[2])*1.06+.05);a.renderOrder=10,s.add(a)}}this.outline=s,this.root.add(s),this.invalidate()}useCamera(t){t!==this.active&&(this.active=t,this.controls.object=t)}applyOrthoFrame(){const t=this.orthoFrame;if(!t)return;const e=this.persp.aspect||1;let s=t.halfW,o=t.halfH;s/o<e?s=o*e:o=s/e,this.ortho.left=-s,this.ortho.right=s,this.ortho.top=o,this.ortho.bottom=-o,this.ortho.updateProjectionMatrix()}setPreset(t){const e=this.desc,s=this.extent;if(!e||!s)return!1;const o=(s.x0+s.x1)/2,n=(s.z0+s.z1)/2,a=s.x1-s.x0,l=s.z1-s.z0,d=(h,c)=>Math.max(c,h/(this.persp.aspect||1),4)/(2*Math.tan(v(this.persp.fov/2))),r=Math.max(0,...e.levels.map(h=>h.elevation_m+h.ceiling_height_m));if(t==="top")this.useCamera(this.persp),this.controls.maxPolarAngle=O,this.persp.position.set(o,r+d(a,l)*1.2,n+.001),this.controls.target.set(o,0,n);else if(t==="iso"){this.useCamera(this.ortho),this.controls.maxPolarAngle=O;const h=it(s,this.persp.aspect||1);this.orthoFrame=h,this.ortho.zoom=1,this.applyOrthoFrame(),this.ortho.position.set(h.target[0]+P[0]*h.dist,h.target[1]+P[1]*h.dist,h.target[2]+P[2]*h.dist),this.controls.target.set(h.target[0],h.target[1],h.target[2])}else if(t==="persp"){this.useCamera(this.persp),this.controls.maxPolarAngle=O;const h=Math.hypot(a,l),c=d(h,h*.62)*1.45;this.persp.position.set(o+U[0]*c,U[1]*c,n+U[2]*c),this.controls.target.set(o,0,n)}else{const h=e.parts.find(p=>p.id===t.camera&&p.kind==="camera");if(!h)return!1;this.useCamera(this.persp);const c=new M(0,0,-1).applyEuler(new _(v(h.rotation[0]),v(h.rotation[1]),v(h.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.persp.position.set(h.position[0],h.position[1],h.position[2]),this.controls.target.set(h.position[0]+c.x*6,h.position[1]+c.y*6,h.position[2]+c.z*6)}return this.preset=t,this.controls.update(),this.updateCutaway(),this.invalidate(),!0}projectPoint(t){this.active.updateMatrixWorld();const e=new M(t[0],t[1],t[2]).project(this.active);if(e.z>1)return null;const s=this.opts.mount.clientWidth,o=this.opts.mount.clientHeight;return{x:(e.x+1)/2*s,y:(1-e.y)/2*o}}wantedCutAzimuth(){const t=this.extent;if(this.quality!==2||!t||typeof this.preset!="string")return null;const e=this.active.position;if(e.y<=t.y1)return null;const s=(t.x0+t.x1)/2,o=(t.z0+t.z1)/2;return Math.hypot(e.x-s,e.z-o)<.5?null:re(ae(e.x,e.z,s,o))}writeBox(t,e,s){const o=t.part,n=new F().setFromEuler(new _(v(o.rotation[0]),v(o.rotation[1]),v(o.rotation[2]),"YXZ")),a=s<=0,l=new M(o.position[0],e,o.position[2]),d=a?new M(1e-4,1e-4,1e-4):new M(Math.max(o.size[0],.001),Math.max(s,.001),Math.max(o.size[2],.001));t.obj instanceof T?(t.obj.setMatrixAt(t.index,new $().compose(l,n,d)),t.obj.instanceMatrix.needsUpdate=!0):(t.obj.position.copy(l),t.obj.scale.copy(d))}updateCutaway(){const t=this.wantedCutAzimuth();if(t===this.cutAzimuth)return;this.cutAzimuth=t;const e=this.desc;if(!e||!this.extent)return;const s=new Set(t===null?[]:he(e,t,this.extent)),o=new Map(e.levels.map(n=>[n.id,n.elevation_m]));for(const n of this.cutNow){if(s.has(n))continue;const a=this.placed.get(n);a&&this.writeBox(a,a.part.position[1],a.part.size[1])}for(const n of s){if(this.cutNow.has(n))continue;const a=this.placed.get(n);if(!a)continue;const l=ot(a.part,o.get(a.part.level_id??"")??0,R);l?this.writeBox(a,l.y,l.h):this.writeBox(a,(o.get(a.part.level_id??"")??0)-1,0)}this.cutNow=s,this.rebuildCaps(o),this.sun&&(this.sun.shadow.needsUpdate=!0),this.selectedId&&this.setSelected(this.selectedId)}rebuildCaps(t){this.caps&&(this.root.remove(this.caps),this.caps.dispose(),this.caps=null);const e=[...this.cutNow].sort().map(l=>this.placed.get(l)).filter(l=>!!l&&l.part.kind==="wall");if(!e.length||this.quality!==2)return;const s=new T(this.unitBox,this.material(ht,1,!1,"floor"),e.length),o=new $,n=new F,a=new _;e.forEach((l,d)=>{const r=l.part,h=(t.get(r.level_id??"")??0)+R;n.setFromEuler(a.set(v(r.rotation[0]),v(r.rotation[1]),v(r.rotation[2]),"YXZ")),o.compose(new M(r.position[0],h+ct/2-.004,r.position[2]),n,new M(r.size[0]+.004,ct,r.size[2]+.004)),s.setMatrixAt(d,o)}),s.instanceMatrix.needsUpdate=!0,s.computeBoundingSphere(),s.name="caps",s.castShadow=!0,this.caps=s,this.root.add(s)}cutawayNow(){return[...this.cutNow].sort()}pick(t,e){const s=this.renderer.domElement.getBoundingClientRect();if(!s.width||!s.height)return null;this.raycaster.setFromCamera(new Mt((t-s.left)/s.width*2-1,-((e-s.top)/s.height)*2+1),this.active);const o=[...this.lookup.keys()].filter(n=>n.visible);for(const n of this.raycaster.intersectObjects(o,!1)){const a=this.lookup.get(n.object);if(!a)continue;const l=a[n.instanceId??0];if(l){if(l.kind==="floor"){if(this.plateOpacity(l)<1)continue;return null}return{id:l.userData.id,kind:l.userData.kind,partId:l.id}}}return null}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.persp.aspect=t/e,this.persp.updateProjectionMatrix(),this.applyOrthoFrame(),this.invalidate()}capture(){return this.controls.update(),this.updateCutaway(),this.renderer.render(this.scene,this.active),this.renderer.domElement.toDataURL("image/png")}renderThumbnail(t,e,s=ke,o=_e){const n=t.parts.filter(f=>f.level_id===e&&f.kind!=="cone"&&f.shape!=="sprite"&&f.shape!=="light");if(!t.levels.some(f=>f.id===e))return null;const a={...t,levels:t.levels.filter(f=>f.id===e),parts:n},l=this.realise(n,a),d=new X;if(d.add(l.root),this.quality===2){d.add(new q(pt,dt,ut));const f=new C(ft,mt);f.position.set(A[0]*50,A[1]*50,A[2]*50),d.add(f)}else{d.add(new N(16777215,1.6));const f=new C(16777215,1.4);f.position.set(1,2,1.2),d.add(f)}const r=it(ne(t,e),s/o),h=new V(-r.halfW,r.halfW,r.halfH,-r.halfH,.05,4e3);h.position.set(r.target[0]+P[0]*r.dist,r.target[1]+P[1]*r.dist,r.target[2]+P[2]*r.dist),h.lookAt(r.target[0],r.target[1],r.target[2]),h.updateProjectionMatrix();const c=this.renderer.domElement,p=this.renderer.getPixelRatio(),w=Math.min(s,Math.floor(c.width/p)),u=Math.min(o,Math.floor(c.height/p));let g=null;const k=this.renderer.shadowMap.enabled;try{if(w<8||u<8)return null;this.renderer.shadowMap.enabled=!1,this.renderer.setScissorTest(!0),this.renderer.setScissor(0,0,w,u),this.renderer.setViewport(0,0,w,u),this.renderer.render(d,h);const f=document.createElement("canvas");f.width=w,f.height=u;const E=f.getContext("2d");E&&(E.drawImage(c,0,c.height-u*p,w*p,u*p,0,0,w,u),g=f.toDataURL("image/png"))}catch(f){console.warn("sw-plan-3d: thumbnail failed",f)}finally{this.renderer.setScissorTest(!1),this.renderer.setViewport(0,0,c.width/p,c.height/p),this.renderer.shadowMap.enabled=k,this.disposeGroup(l.root),this.invalidate()}return g}async exportGltf(){const t=new I;for(const s of this.root.children)s!==this.outline&&t.add(s.clone());return await new Xt().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.invalidate),this.controls.removeEventListener("change",this.invalidate),this.controls.dispose(),this.clear();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.aoMaterial&&(this.aoMaterial.map?.dispose(),this.aoMaterial.dispose()),this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.unitPlane.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}var Ce=Object.defineProperty,Te=Object.getOwnPropertyDescriptor,b=(i,t,e,s)=>{for(var o=s>1?void 0:s?Te(t,e):t,n=i.length-1,a;n>=0;n--)(a=i[n])&&(o=(s?a(t,e,o):a(o))||o);return s&&o&&Ce(t,e,o),o};const Le="ייצוא glTF נכשל",Fe="עבר לרמה סכמטית — קצב הפריימים היה נמוך",$e=4e3,bt="sw.plan3d.quality",j="sw.plan3d.fallback",gt=2500,Oe=1e4,Re=3,De=30;function Ne(i){return i.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}const qe={wall:"קיר",opening:"פתח",object:"עצם",connector:"מחבר",camera:"מצלמה",entity:"ישות",zone:"חדר",label:"תווית",level:"מפלס"},vt=(i,t)=>{try{return(i==="local"?localStorage:sessionStorage).getItem(t)}catch{return null}},W=(i,t,e)=>{try{const s=i==="local"?localStorage:sessionStorage;e===null?s.removeItem(t):s.setItem(t,e)}catch{}},xt=i=>i===2||i==="2"?2:i===1||i==="1"?1:null;let m=class extends _t{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.cameras=[],this.labels={},this.exportName="plan-3d",this.levels=[],this.activeLevel=null,this.thumbnailScene=null,this.qualityDefault=null,this.minFps=De,this.continuous=!1,this.hover=null,this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.chosen=xt(vt("local",bt)),this.installDefault=null,this.fallback=vt("session",j)==="1",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null,this.probe=null,this.probeTimer=0,this.probed=!1,this.probePending=!1,this.thumbs=new Map,this.thumbsFor=null,this.thumbsQuality=null,this.settingsAsked=!1,this.onVisibility=()=>{document.hidden?this.probe&&(this.endProbe(!1),this.probePending=!0):this.probePending&&this.quality===2&&this.view&&this.startProbe()}}firstUpdated(){this.init()}connectedCallback(){super.connectedCallback(),this.hasUpdated&&!this.view&&this.init(),document.addEventListener("visibilitychange",this.onVisibility)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("visibilitychange",this.onVisibility),this.ro?.disconnect(),this.endProbe(!1),this.probed=!1,this.probePending=!1,this.view?.dispose(),this.view=null,this.applied=null,this.thumbs.clear(),this.thumbsFor=null,window.clearTimeout(this.toastTimer)}get quality(){return this.fallback?1:this.chosen??this.qualityDefault??this.installDefault??1}init(){if(this.chosen===null&&this.qualityDefault===null&&this.installDefault===null&&!this.settingsAsked){this.settingsAsked=!0,Pt().then(i=>{this.installDefault=xt(i["plan.quality"])??1}).catch(()=>{this.installDefault=1}).finally(()=>{this.isConnected&&!this.view&&this.init()});return}try{this.view=new Ie({mount:this.stage,color:i=>getComputedStyle(this).getPropertyValue(`--sw-${i}`).trim()||"#888888",onSelect:i=>this.emitSelect(i),onHover:(i,t,e)=>this.setHover(i,t,e),onFrame:(i,t)=>{this.setAttribute("data-frames",String(i)),this.setAttribute("data-fps",String(t)),this.onProbeFrame(i)},quality:this.quality})}catch(i){console.warn("sw-plan-3d: WebGL failed to start",i),this.error=At;return}this.view.setContinuous(this.continuous),this.ro=new ResizeObserver(()=>this.view?.resize()),this.ro.observe(this),this.presetApplied=!1,this.setAttribute("data-quality",String(this.quality)),this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}updated(i){this.view&&(i.has("description")&&this.description&&this.apply(this.description),(i.has("selectedId")||i.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),i.has("preset")&&i.get("preset")!==void 0&&this.applyPreset(this.preset),i.has("continuous")&&!this.probe&&this.view.setContinuous(this.continuous),this.applyQuality())}apply(i){i!==this.applied&&(this.applied=i,this.view?.setDescription(i),this.setAttribute("data-parts",String(i.parts.length)),this.toggleAttribute("data-estimated",i.estimated),this.presetApplied||(this.applyPreset(this.preset),this.presetApplied=!0),this.view?.setSelected(this.selectedId),this.quality===2&&!this.probed&&this.startProbe())}applyQuality(){const i=this.quality;this.setAttribute("data-quality",String(i)),!(!this.view||this.view.getQuality()===i)&&(this.view.setQuality(i),this.thumbs.clear(),this.probed=!1,i===2&&this.applied?this.startProbe():this.endProbe(!1),this.requestUpdate())}setQuality(i){this.chosen=i,W("local",bt,String(i)),i===2&&this.fallback&&(this.fallback=!1,W("session",j,null))}startProbe(){if(this.endProbe(!1),this.probed=!0,!(!this.view||this.minFps<=0)){if(document.hidden){this.probePending=!0;return}this.probePending=!1,this.probe={until:0,t0:0,f0:0,start:Number(this.getAttribute("data-frames")??0)},this.view.setContinuous(!0),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),Oe)}}onProbeFrame(i){const t=this.probe;if(!t)return;if(document.hidden){this.endProbe(!1),this.probePending=!0;return}const e=performance.now();if(!t.t0){if(i-t.start<Re)return;t.t0=e,t.f0=i,t.until=e+gt,window.clearTimeout(this.probeTimer),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),gt+600);return}if(e<t.until)return;const s=(i-t.f0)*1e3/(e-t.t0);this.setAttribute("data-probe-fps",String(Math.round(s))),this.endProbe(!1),s<this.minFps&&this.fallBack()}endProbe(i){window.clearTimeout(this.probeTimer),this.probeTimer=0;const t=this.probe;if(this.probe=null,this.view?.setContinuous(this.continuous),i&&t&&document.hidden){this.probePending=!0;return}if(i&&t){const e=Number(this.getAttribute("data-frames")??0),s=t.t0?(e-t.f0)*1e3/Math.max(1,performance.now()-t.t0):0;this.setAttribute("data-probe-fps",String(Math.round(s))),s<this.minFps&&this.fallBack()}}fallBack(){this.fallback=!0,W("session",j,"1")}applyPreset(i){this.view?.setPreset(i)&&this.setAttribute("data-preset",typeof i=="string"?i:"camera")}pickPreset(i){this.preset=i,this.applyPreset(i)}labelOf(i){return this.labels[i.id]??qe[i.kind]??i.id}emitSelect(i){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:i?.id??null,kind:i?.kind??null},bubbles:!0,composed:!0}))}setHover(i,t,e){this.hover=i?{id:i.id,kind:i.kind,label:this.labelOf(i),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}pickLevel(i){const t=this.activeLevel===i?null:i;this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t},bubbles:!0,composed:!0}))}thumbFor(i){const t=this.thumbnailScene;if(!t||!this.view)return"";(this.thumbsFor!==t||this.thumbsQuality!==this.quality)&&(this.thumbs.clear(),this.thumbsFor=t,this.thumbsQuality=this.quality);const e=this.thumbs.get(i);if(e!==void 0)return e;const s=this.view.renderThumbnail(t,i)??"";return this.thumbs.set(i,s),s}get thumbnailCount(){return this.thumbs.size}toScreen(i){return this.view?.projectPoint(i)??null}capture(){return this.view?.capture()??null}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const i=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(i)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${Ne(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(i){console.warn("sw-plan-3d: glTF export failed",i),this.showToast(Le)}finally{this.exporting=!1}}}showToast(i){this.toast=i,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",$e)}renderStrip(){if(this.levels.length<2||!this.thumbnailScene||!this.ready)return z;const i=[...this.levels].sort((t,e)=>e.elevation_m-t.elevation_m||(t.id<e.id?-1:1));return this.thumbs=Et(this.thumbs,i.map(t=>t.id)),y`<div class="strip" role="group" aria-label="מפלסים" data-3d-strip>
      ${i.map(t=>y`<button type="button" data-3d-thumb=${t.id} aria-pressed=${this.activeLevel===t.id?"true":"false"} title=${`${t.name} · ${t.elevation_m>=0?"+":"−"}${Math.abs(t.elevation_m).toFixed(1)} מ׳`} @click=${()=>this.pickLevel(t.id)}>
          <img alt="" src=${this.thumbFor(t.id)} /><span>${t.name}</span>
        </button>`)}
    </div>`}render(){const i=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,""),e=this.quality;return y`
      <div class="stage"></div>
      ${!this.ready&&!this.error?y`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>`:z}
      ${this.error?y`<div class="spinner err" data-3d-error>${this.error}</div>`:z}
      ${this.renderStrip()}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${i==="top"} @click=${()=>this.pickPreset("top")}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${i==="iso"} @click=${()=>this.pickPreset("iso")}>איזומטרי</sw-chip>
        <sw-chip data-preset-persp ?selected=${i==="persp"} @click=${()=>this.pickPreset("persp")}>פרספקטיבה</sw-chip>
        ${this.cameras.length?y`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${t} @change=${s=>this.onCameraChange(s)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map(s=>y`<option value=${s.id} ?selected=${s.id===t}>${s.label}</option>`)}
            </select>`:z}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-1 title="רמה סכמטית: חומרים שטוחים, בלי צללים" ?selected=${e===1} @click=${()=>this.setQuality(1)}>סכמטי</sw-chip>
        <sw-chip data-quality-2 title="רמה מלאה: צללים רכים, חומרים, חיתוך קירות" ?selected=${e===2} @click=${()=>this.setQuality(2)}>מלא</sw-chip>
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?"מייצא…":"ייצוא glTF"}</sw-button>
      </div>
      ${this.description?.estimated?y`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>`:z}
      ${this.fallback?y`<div class="note fb" role="status" data-3d-fallback>${Fe}</div>`:z}
      ${this.toast?y`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:z}
      ${this.hover?y`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:z}
    `}onCameraChange(i){const t=i.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};m.styles=It`
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
      inset-block-end: 52px;
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
        inset-block-end: 44px;
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
  `;b([x({attribute:!1})],m.prototype,"description",2);b([x()],m.prototype,"selectedId",2);b([x({attribute:!1})],m.prototype,"preset",2);b([x({attribute:!1})],m.prototype,"cameras",2);b([x({attribute:!1})],m.prototype,"labels",2);b([x()],m.prototype,"exportName",2);b([x({attribute:!1})],m.prototype,"levels",2);b([x()],m.prototype,"activeLevel",2);b([x({attribute:!1})],m.prototype,"thumbnailScene",2);b([x({attribute:!1})],m.prototype,"qualityDefault",2);b([x({type:Number})],m.prototype,"minFps",2);b([x({type:Boolean,reflect:!0,attribute:"data-measure"})],m.prototype,"continuous",2);b([S()],m.prototype,"hover",2);b([S()],m.prototype,"ready",2);b([S()],m.prototype,"exporting",2);b([S()],m.prototype,"error",2);b([S()],m.prototype,"toast",2);b([S()],m.prototype,"chosen",2);b([S()],m.prototype,"installDefault",2);b([S()],m.prototype,"fallback",2);b([Ct(".stage")],m.prototype,"stage",2);m=b([Tt("sw-plan-3d")],m);export{De as DEFAULT_MIN_FPS,j as FALLBACK_KEY,Oe as PROBE_FIRST_FRAME_MS,gt as PROBE_MS,Re as PROBE_WARM_FRAMES,bt as QUALITY_KEY,m as SwPlan3d};
//# sourceMappingURL=sw-plan-3d-Kz4rLGbY.js.map
