import{i as Pt,p as At,W as Et,A as x,k as Tt,b as v,a as Ct,n as M,r as S,e as It,t as Lt}from"./index-CHMyNHX1.js";import{S as V,P as $t,O as K,G as C,B as Ft,C as Dt,a as Rt,R as Ot,W as Nt,b as Q,c as qt,L as Bt,d as Z,e as Ht,f as Ut,D as I,A as N,H as q,g as Gt,N as jt,M as J,h as tt,i as Wt,E as _,j as xt,k as et,l as Yt,m as P,n as Qt,I as L,Q as $,V as z,o as F,p as Xt,q as Mt,r as Vt,s as zt,F as St,t as Kt}from"./three-DcroZdrW.js";const st=Math.SQRT2,B=Math.sqrt(3),H=Math.sqrt(6),A=[1/B,1/B,1/B],U=(()=>{const s=Math.hypot(1,.85,1);return[1/s,.85/s,1/s]})(),Zt=[1/st,0,-1/st],Jt=[-1/H,2/H,-1/H],te=1.08,R=.7,ee=10,se=Math.cos(65*Math.PI/180),ie=new Set(["wall"]),oe=new Set(["lintel","sill","head","window","door","marker"]),ne=1,O=s=>s*Math.PI/180,it=(s,t)=>s[0]*t[0]+s[1]*t[1]+s[2]*t[2];function kt(s){const t=s.parts.filter(l=>l.kind==="floor"&&l.shape==="box");let e=1/0,i=1/0,o=-1/0,n=-1/0;for(const l of t)e=Math.min(e,l.position[0]-l.size[0]/2),o=Math.max(o,l.position[0]+l.size[0]/2),i=Math.min(i,l.position[2]-l.size[2]/2),n=Math.max(n,l.position[2]+l.size[2]/2);Number.isFinite(e)||([e,i,o,n]=[0,0,s.size[0],s.size[1]]);const a=s.levels.length?s.levels:[{id:"",elevation_m:0,ceiling_height_m:2.8}],r=Math.min(...a.map(l=>l.elevation_m)),d=Math.max(...a.map(l=>l.elevation_m+l.ceiling_height_m));return{x0:e,z0:i,x1:o,z1:n,y0:r,y1:d}}function ae(s,t){const e=s.levels.find(c=>c.id===t),i=s.parts.filter(c=>c.level_id===t),o=i.find(c=>c.kind==="floor"&&c.shape==="box"),n=e?e.elevation_m:0,a=e?e.elevation_m+e.ceiling_height_m:n+2.8;if(o)return{x0:o.position[0]-o.size[0]/2,x1:o.position[0]+o.size[0]/2,z0:o.position[2]-o.size[2]/2,z1:o.position[2]+o.size[2]/2,y0:n,y1:a};if(!i.length)return{x0:0,z0:0,x1:s.size[0],z1:s.size[1],y0:n,y1:a};let r=1/0,d=1/0,l=-1/0,h=-1/0;for(const c of i){const p=Math.hypot(c.size[0],c.size[2])/2;r=Math.min(r,c.position[0]-p),l=Math.max(l,c.position[0]+p),d=Math.min(d,c.position[2]-p),h=Math.max(h,c.position[2]+p)}return{x0:r,z0:d,x1:l,z1:h,y0:n,y1:a}}function ot(s,t,e=te){const i=(s.x0+s.x1)/2,o=(s.y0+s.y1)/2,n=(s.z0+s.z1)/2;let a=1/0,r=-1/0,d=1/0,l=-1/0;for(const b of[s.x0,s.x1])for(const g of[s.y0,s.y1])for(const k of[s.z0,s.z1]){const m=[b-i,g-o,k-n],T=it(m,Zt),X=it(m,Jt);a=Math.min(a,T),r=Math.max(r,T),d=Math.min(d,X),l=Math.max(l,X)}let h=Math.max((r-a)/2,1)*e,c=Math.max((l-d)/2,1)*e;const p=t>0&&Number.isFinite(t)?t:1;h/c<p?h=c*p:c=h/p;const u=Math.hypot(s.x1-s.x0,s.y1-s.y0,s.z1-s.z0);return{target:[i,o,n],halfW:h,halfH:c,dist:Math.max(u*2,20)}}function re(s,t,e,i){return(Math.atan2(t-i,s-e)*180/Math.PI%360+360)%360}function le(s,t=ee){const e=(s%360+360)%360;return(Math.floor(e/t)*t+t/2)%360}function he(s,t,e,i=0){const o=O(s.rotation[1]),n=t-s.position[0],a=e-s.position[2],r=n*Math.cos(o)-a*Math.sin(o),d=n*Math.sin(o)+a*Math.cos(o);return Math.abs(r)<=s.size[0]/2+i&&Math.abs(d)<=s.size[2]/2+i}function ce(s,t,e=kt(s)){const i=(e.x0+e.x1)/2,o=(e.z0+e.z1)/2,n=Math.cos(O(t)),a=Math.sin(O(t)),r=[];for(const l of s.parts){if(!ie.has(l.kind)||l.shape!=="box")continue;const h=l.position[0]-i,c=l.position[2]-o;if(Math.hypot(h,c)<1e-6||h*n+c*a<=0)continue;const u=O(l.rotation[1]);let b=Math.sin(u),g=Math.cos(u);b*h+g*c<0&&(b=-b,g=-g),!(b*n+g*a<se)&&r.push(l)}const d=new Set(r.map(l=>l.id));for(const l of s.parts)oe.has(l.kind)&&r.some(h=>h.level_id===l.level_id&&he(h,l.position[0],l.position[2],ne))&&d.add(l.id);return[...d].sort()}function pe(s,t,e,i){return{w:Math.max(0,Math.min(s,Math.floor(e))),h:Math.max(0,Math.min(t,Math.floor(i)))}}function nt(s,t,e=R){const i=s.size[1],o=s.position[1]-i/2,n=t+e;if(o>=n-1e-6)return null;if(o+i<=n+1e-6)return{y:s.position[1],h:i};const a=n-o;return{y:o+a/2,h:a}}const de=.6,at=3e3,rt=45,ue=8,lt=2048,ht=.28,fe=64,me=6,we=.35,be=.88,ge=8,D=Math.PI/2-.02,ve=new Set(["glow","cone","tint"]),ye=new Set(["wall","lintel","sill","head","door","object","connector","camera"]),xe=new Set(["floor","wall","object","connector","room","tint","lintel","sill","head"]),Me=new Set(["wall","lintel","sill","head","door","connector"]),ze=new Set(["wall","object","connector"]),Se=.5,E=(()=>{const s=Math.hypot(-.6,1.1,-.25);return[-.6/s,1.1/s,-.25/s]})(),ke="map-wall-3d",ct="map-structure",pt=.025,dt=16777215,ut=15133682,ft=2.1,mt=16774108,wt=3,_e=1.12,Pe=160,Ae=100,y=s=>s*Math.PI/180,bt=s=>s.kind==="object"&&Math.max(s.size[0],s.size[1],s.size[2])<de,G=s=>s.kind==="floor"?"floor":s.color==="map-glass"?"glass":"std",j=(s,t)=>s.length===t.length&&s.every((e,i)=>e===t[i]),Ee=(s,t)=>{if(!s||!t)return s===t;if(s.length!==t.length)return!1;for(let e=0;e<s.length;e++)if(s[e][0]!==t[e][0]||s[e][1]!==t[e][1])return!1;return!0},Te=(s,t)=>s.id===t.id&&s.kind===t.kind&&s.shape===t.shape&&s.color===t.color&&s.group===t.group&&s.level_id===t.level_id&&s.text===t.text&&j(s.position,t.position)&&j(s.size,t.size)&&j(s.rotation,t.rotation)&&Ee(s.polygon,t.polygon)&&(s.opacity===t.opacity||s.kind==="tint");function Ce(s,t){if(s===t||s.parts.length!==t.parts.length||s.levels.length!==t.levels.length||s.size[0]!==t.size[0]||s.size[1]!==t.size[1])return!1;for(let i=0;i<s.levels.length;i++){const o=s.levels[i],n=t.levels[i];if(o.id!==n.id||o.elevation_m!==n.elevation_m||o.ceiling_height_m!==n.ceiling_height_m)return!1}let e=!1;for(let i=0;i<s.parts.length;i++){const o=s.parts[i],n=t.parts[i];if(!Te(o,n))return!1;o.opacity!==n.opacity&&(e=!0)}return e}function Ie(){const s=[-.5,.5],t=[];for(const i of s)for(const o of s)t.push(-.5,i,o,.5,i,o),t.push(i,-.5,o,i,.5,o),t.push(i,o,-.5,i,o,.5);const e=new zt;return e.setAttribute("position",new St(t,3)),e}function Le(){const t=document.createElement("canvas");t.width=64,t.height=64;const e=t.getContext("2d");if(e){const o=e.createImageData(64,64);for(let n=0;n<64;n++)for(let a=0;a<64;a++){const r=Math.abs((a+.5)/64-.5)*2,d=Math.abs((n+.5)/64-.5)*2,l=Math.max(r,d),h=Math.min(1,Math.max(0,(l-.5)/.5)),c=(1-h*h*(3-2*h))*.42,p=(n*64+a)*4;o.data[p+3]=Math.round(c*255)}e.putImageData(o,0,0)}const i=new xt(t);return i.colorSpace=Q,i}function $e(s,t){const e=[];for(const r of s){const d=e[e.length-1];(!d||Math.hypot(r[0]-d[0],r[1]-d[1])>1e-6)&&e.push(r)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let i=0;for(let r=0;r<e.length;r++){const d=e[r],l=e[(r+1)%e.length];i+=d[0]*l[1]-l[0]*d[1]}if(Math.abs(i)<1e-8)return null;const o=Kt.triangulateShape(e.map(([r,d])=>new Mt(r,d)),[]),n=[];for(const[r,d,l]of o){const[h,c,p]=[e[r],e[d],e[l]];Math.abs((c[0]-h[0])*(p[1]-h[1])-(p[0]-h[0])*(c[1]-h[1]))<1e-10||(n.push(h[0],t,h[1],c[0],t,c[1],p[0],t,p[1]),n.push(h[0],0,h[1],p[0],0,p[1],c[0],0,c[1]))}for(let r=0;r<e.length;r++){const d=e[r],l=e[(r+1)%e.length];n.push(d[0],0,d[1],l[0],0,l[1],l[0],t,l[1],d[0],0,d[1],l[0],t,l[1],d[0],t,d[1])}const a=new zt;return a.setAttribute("position",new St(n,3)),a.computeVertexNormals(),a}class Fe{constructor(t){this.opts=t,this.scene=new V,this.persp=new $t(50,1,.05,2e3),this.ortho=new K(-1,1,1,-1,.05,4e3),this.active=this.persp,this.root=new C,this.unitBox=new Ft(1,1,1),this.unitCylinder=new Dt(.5,.5,1,24),this.unitPlane=new Rt(1,1).rotateX(-Math.PI/2),this.boxEdges=Ie(),this.materials=new Map,this.aoMaterial=null,this.raycaster=new Ot,this.glowPool=[],this.lights=new C,this.sun=null,this.lookup=new Map,this.placed=new Map,this.tints=new Map,this.builds=0,this.smallGroups=[],this.outline=null,this.desc=null,this.extent=null,this.selectedId=null,this.preset="iso",this.orthoFrame=null,this.cutAzimuth=null,this.cutNow=new Set,this.caps=null,this.framed=!1,this.hideSmall=!1,this.heavy=!1,this.disposed=!1,this.continuous=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.onDown=i=>{i.isPrimary&&(this.pressed={x:i.clientX,y:i.clientY,id:i.pointerId})},this.onUp=i=>{const o=this.pressed;!o||i.pointerId!==o.id||(this.pressed=null,!(i.button!==0||Math.hypot(i.clientX-o.x,i.clientY-o.y)>me)&&this.opts.onSelect(this.pick(i.clientX,i.clientY)))},this.onCancel=i=>{this.pressed?.id===i.pointerId&&(this.pressed=null)},this.onMove=i=>{if(this.pressed||i.pointerType==="touch"||!i.isPrimary)return;const o=this.pick(i.clientX,i.clientY),n=o?o.partId:null;if(n===this.lastHover)return;this.lastHover=n;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(o,i.clientX-a.left,i.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const i=this.controls.update();if(this.hideSmall){const a=this.active===this.ortho?this.ortho.top/(this.ortho.zoom||1)<rt/2:this.persp.position.distanceTo(this.controls.target)<rt;for(const r of this.smallGroups)r.visible=a}this.updateCutaway(),this.renderer.render(this.scene,this.active),this.opts.onDraw?.(),this.frames++;const o=performance.now();this.windowStart||(this.windowStart=o),this.windowFrames++,o-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(o-this.windowStart)),this.windowStart=o,this.windowFrames=0);const n=i||this.continuous;(!n||o-this.lastReport>=1e3)&&(this.lastReport=o,this.opts.onFrame(this.frames,this.fps)),n?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.quality=t.quality??1,this.renderer=new Nt({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),this.renderer.outputColorSpace=Q,this.renderer.shadowMap.type=qt,this.outlineMaterial=new Bt({color:new Z(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new Ht(this.persp,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=D,this.controls.addEventListener("change",this.invalidate),this.scene.add(this.lights),this.applyQuality();for(let i=0;i<ue;i++){const o=new Ut(16777215,0,1,2);this.glowPool.push(o),this.scene.add(o)}this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.invalidate),this.resize()}get camera(){return this.active}getQuality(){return this.quality}setQuality(t){if(t!==this.quality){this.quality=t,this.applyQuality();for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.setDescription(e),this.setSelected(i)}this.invalidate()}}applyQuality(){for(const t of[...this.lights.children])this.lights.remove(t),(t instanceof I||t instanceof N||t instanceof q)&&t.dispose();if(this.sun=null,this.cutAzimuth=null,this.cutNow.clear(),this.quality===2){this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=Gt,this.renderer.toneMappingExposure=_e,this.lights.add(new q(dt,ut,ft));const t=new I(mt,wt);t.castShadow=!0,t.shadow.mapSize.set(lt,lt),t.shadow.bias=-4e-4,t.shadow.normalBias=.03,this.lights.add(t),this.lights.add(t.target),this.sun=t,this.fitSun()}else{this.renderer.shadowMap.enabled=!1,this.renderer.toneMapping=jt,this.renderer.toneMappingExposure=1,this.lights.add(new N(16777215,1.6));const t=new I(16777215,1.4);t.position.set(1,2,1.2),this.lights.add(t)}}fitSun(){const t=this.sun,e=this.extent;if(!t||!e)return;const i=(e.x0+e.x1)/2,o=(e.y0+e.y1)/2,n=(e.z0+e.z1)/2,a=Math.max(Math.hypot(e.x1-e.x0,e.y1-e.y0,e.z1-e.z0)/2,2)*1.05;t.position.set(i+E[0]*a*2,o+E[1]*a*2,n+E[2]*a*2),t.target.position.set(i,o,n),t.target.updateMatrixWorld();const r=t.shadow.camera;r.left=-a,r.right=a,r.top=a,r.bottom=-a,r.near=.1,r.far=a*4,r.updateProjectionMatrix(),t.shadow.needsUpdate=!0}material(t,e,i=!1,o="std"){const n=`${t}|${e}|${i?2:1}|${this.quality===2?o:"l1"}`;let a=this.materials.get(n);if(!a){const r=i?{side:tt,forceSinglePass:!0}:{},d=this.quality===2&&t===ct&&o==="std"?ke:t,l=new Z(this.opts.color(d));let h;this.quality===2&&o==="glass"?h=new J({color:l,roughness:.12,metalness:.25,transparent:!0,opacity:Math.max(e,.35),depthWrite:!1,side:tt,forceSinglePass:!0}):this.quality===2?h=new J({color:l,roughness:o==="floor"?1:.88,metalness:0,transparent:e<1,opacity:e,depthWrite:e>=1,...r}):h=new Wt({color:l,transparent:e<1,opacity:e,depthWrite:e>=1,...r}),a={token:d,material:h},this.materials.set(n,a)}return a.material}recolour(){for(const{token:t,material:e}of this.materials.values())e.color.set(this.opts.color(t));this.outlineMaterial.color.set(this.opts.color("accent"))}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new _(y(e.rotation[0]),y(e.rotation[1]),y(e.rotation[2]),"YXZ"))}plateOpacity(t,e=this.desc){const i=e?.levels??[];if(t.kind!=="floor"||i.length<2)return t.opacity;const o=Math.min(...i.map(a=>a.elevation_m)),n=i.find(a=>a.id===t.level_id);return n&&n.elevation_m>o?Math.min(t.opacity,we):t.opacity}shadows(t,e){this.quality===2&&(t.castShadow=(this.heavy?Me:ye).has(e.kind)&&e.color!=="map-glass",t.receiveShadow=xe.has(e.kind)&&!(this.heavy&&e.kind==="object"))}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const i=e.getContext("2d");i&&(i.globalAlpha=be,i.fillStyle=this.opts.color("surface"),i.beginPath(),i.roundRect(8,16,496,96,48),i.fill(),i.globalAlpha=1,i.fillStyle=this.opts.color(t.color),i.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',i.textAlign="center",i.textBaseline="middle",i.direction="rtl",i.fillText(t.text??"",256,66,480));const o=new xt(e);o.colorSpace=Q;const n=new et(new Yt({map:o,transparent:!0,depthTest:!0}));return n.position.set(t.position[0],t.position[1],t.position[2]),n.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),n}single(t,e){if(t.shape==="box"||t.shape==="cylinder"){const i=new P(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t,e),!1,G(t)));return this.transform(i,t),i.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),this.shadows(i,t),i}if(t.shape==="prism"){const i=$e(t.polygon??[],t.size[1]);if(!i)return null;const o=this.material(t.color,t.opacity,!0,G(t)),n=t.kind==="tint"?o.clone():o,a=new P(i,n);return t.kind==="tint"&&(a.userData.ownMaterial=!0),a.position.set(t.position[0],t.position[1],t.position[2]),this.shadows(a,t),a}return t.kind==="chip"?null:t.shape==="sprite"?this.label(t):null}occlusion(t,e){if(this.quality!==2)return null;const i=new Map(e.levels.map(p=>[p.id,p.elevation_m])),o=e.levels.length?Math.min(...e.levels.map(p=>p.elevation_m)):0,n=t.filter(p=>ze.has(p.kind)&&(p.shape==="box"||p.shape==="cylinder")&&p.position[1]-p.size[1]/2<=(i.get(p.level_id??"")??o)+Se);if(!n.length)return null;this.aoMaterial||(this.aoMaterial=new Qt({map:Le(),color:0,transparent:!0,depthWrite:!1}));const a=new L(this.unitPlane,this.aoMaterial,n.length),r=new F,d=new $,l=new _,h=new z,c=new z;return n.forEach((p,u)=>{d.setFromEuler(l.set(0,y(p.rotation[1]),0,"YXZ")),h.set(p.position[0],p.position[1]-p.size[1]/2+.012,p.position[2]),c.set(p.size[0]+2*ht,1,p.size[2]+2*ht),r.compose(h,d,c),a.setMatrixAt(u,r)}),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),a.name="ao",a.renderOrder=1,a}realise(t,e){const i={root:new C,lookup:new Map,small:[],placed:new Map,glows:[],ao:null},o=new Map,n=[];for(const c of t)if(c.group&&(c.shape==="box"||c.shape==="cylinder")){const p=o.get(c.group);p?p.push(c):o.set(c.group,[c])}else n.push(c);const a=new F,r=new $,d=new z,l=new z,h=new _;for(const[c,p]of o){const u=p[0],b=new L(u.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(u.color,u.opacity,!1,G(u)),p.length);p.forEach((g,k)=>{r.setFromEuler(h.set(y(g.rotation[0]),y(g.rotation[1]),y(g.rotation[2]),"YXZ")),d.set(g.position[0],g.position[1],g.position[2]),l.set(Math.max(g.size[0],.001),Math.max(g.size[1],.001),Math.max(g.size[2],.001)),a.compose(d,r,l),b.setMatrixAt(k,a),i.placed.set(g.id,{obj:b,index:k,part:g})}),b.instanceMatrix.needsUpdate=!0,b.computeBoundingSphere(),b.name=c,this.shadows(b,u),i.lookup.set(b,p),i.root.add(b),p.every(bt)&&i.small.push(b)}for(const c of n){if(c.shape==="light"){i.glows.push(c);continue}const p=this.single(c,e);p&&(p.name=c.id,ve.has(c.kind)||i.lookup.set(p,[c]),p instanceof P&&(c.shape==="box"||c.shape==="cylinder")&&i.placed.set(c.id,{obj:p,index:0,part:c}),i.root.add(p),bt(c)&&i.small.push(p))}return i.ao=this.occlusion(t,e),i.ao&&i.root.add(i.ao),i}disposeGroup(t){for(const e of[...t.children])t.remove(e),e instanceof L?e.dispose():e instanceof P&&e.geometry!==this.unitBox&&e.geometry!==this.unitCylinder&&e.geometry.dispose(),e instanceof P&&e.userData.ownMaterial&&!Array.isArray(e.material)&&e.material.dispose(),e instanceof et&&(e.material.map?.dispose(),e.material.dispose())}clear(){this.setSelected(null),this.disposeGroup(this.root);for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.placed.clear(),this.tints.clear(),this.smallGroups=[],this.cutAzimuth=null,this.cutNow.clear(),this.caps=null}setDescription(t){if(this.desc&&Ce(this.desc,t)){for(const o of t.parts){if(o.kind!=="tint")continue;const n=this.tints.get(o.id);n&&!Array.isArray(n.material)&&(n.material.opacity=o.opacity)}this.desc=t,this.invalidate();return}this.clear(),this.recolour(),this.desc=t,this.extent=kt(t),this.heavy=t.parts.length>at,this.builds++;const e=this.realise(t.parts,t);for(const o of[...e.root.children])this.root.add(o),o instanceof P&&o.userData.ownMaterial&&this.tints.set(o.name,o);this.lookup=e.lookup,this.placed=e.placed,this.smallGroups=e.small;let i=0;for(const o of e.glows){const n=this.glowPool[i++];n&&(n.color.set(this.opts.color(o.color)),n.intensity=ge,n.distance=Math.max(o.size[0],1),n.position.set(o.position[0],o.position[1],o.position[2]))}if(this.hideSmall=t.parts.length>at,!this.hideSmall)for(const o of this.smallGroups)o.visible=!0;this.fitSun(),this.framed||(this.framed=this.setPreset("iso")),this.updateCutaway(),this.invalidate()}setSelected(t){if(this.selectedId=t,this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(n=>n.userData.id===t&&n.kind!=="cone"&&n.kind!=="floor"&&n.kind!=="tint"&&n.kind!=="chip"&&(n.shape==="box"||n.shape==="cylinder"||n.shape==="prism"||n.shape==="sprite")).slice(0,fe);if(!e.length)return;const i=new C,o=new Map(this.desc.levels.map(n=>[n.id,n.elevation_m]));for(const n of e){const a=new Xt(this.boxEdges,this.outlineMaterial),r=this.cutNow.has(n.id)?nt(n,o.get(n.level_id??"")??0,R):{y:n.position[1],h:n.size[1]};if(r){if(n.shape==="prism"){const d=n.polygon??[];if(!d.length)continue;const l=d.map(u=>u[0]),h=d.map(u=>u[1]),c=Math.max(...l)-Math.min(...l),p=Math.max(...h)-Math.min(...h);a.position.set(n.position[0]+(Math.max(...l)+Math.min(...l))/2,n.position[1]+n.size[1]/2,n.position[2]+(Math.max(...h)+Math.min(...h))/2),a.scale.set(c*1.04+.05,n.size[1]*1.04+.05,p*1.04+.05)}else this.transform(a,n),a.position.y=r.y,a.scale.set(n.size[0]*1.06+.05,r.h*1.06+.05,(n.shape==="sprite"?.1:n.size[2])*1.06+.05);a.renderOrder=10,i.add(a)}}this.outline=i,this.root.add(i),this.invalidate()}useCamera(t){t!==this.active&&(this.active=t,this.controls.object=t)}applyOrthoFrame(){const t=this.orthoFrame;if(!t)return;const e=this.persp.aspect||1;let i=t.halfW,o=t.halfH;i/o<e?i=o*e:o=i/e,this.ortho.left=-i,this.ortho.right=i,this.ortho.top=o,this.ortho.bottom=-o,this.ortho.updateProjectionMatrix()}setPreset(t){const e=this.desc,i=this.extent;if(!e||!i)return!1;const o=(i.x0+i.x1)/2,n=(i.z0+i.z1)/2,a=i.x1-i.x0,r=i.z1-i.z0,d=(h,c)=>Math.max(c,h/(this.persp.aspect||1),4)/(2*Math.tan(y(this.persp.fov/2))),l=Math.max(0,...e.levels.map(h=>h.elevation_m+h.ceiling_height_m));if(t==="top")this.useCamera(this.persp),this.controls.maxPolarAngle=D,this.persp.position.set(o,l+d(a,r)*1.2,n+.001),this.controls.target.set(o,0,n);else if(t==="iso"){this.useCamera(this.ortho),this.controls.maxPolarAngle=D;const h=ot(i,this.persp.aspect||1);this.orthoFrame=h,this.ortho.zoom=1,this.applyOrthoFrame(),this.ortho.position.set(h.target[0]+A[0]*h.dist,h.target[1]+A[1]*h.dist,h.target[2]+A[2]*h.dist),this.controls.target.set(h.target[0],h.target[1],h.target[2])}else if(t==="persp"){this.useCamera(this.persp),this.controls.maxPolarAngle=D;const h=Math.hypot(a,r),c=d(h,h*.62)*1.45;this.persp.position.set(o+U[0]*c,U[1]*c,n+U[2]*c),this.controls.target.set(o,0,n)}else{const h=e.parts.find(p=>p.id===t.camera&&p.kind==="camera");if(!h)return!1;this.useCamera(this.persp);const c=new z(0,0,-1).applyEuler(new _(y(h.rotation[0]),y(h.rotation[1]),y(h.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.persp.position.set(h.position[0],h.position[1],h.position[2]),this.controls.target.set(h.position[0]+c.x*6,h.position[1]+c.y*6,h.position[2]+c.z*6)}return this.preset=t,this.controls.update(),this.updateCutaway(),this.invalidate(),!0}projectPoint(t){this.active.updateMatrixWorld();const e=new z(t[0],t[1],t[2]).project(this.active);if(e.z>1)return null;const i=this.opts.mount.clientWidth,o=this.opts.mount.clientHeight;return{x:(e.x+1)/2*i,y:(1-e.y)/2*o}}wantedCutAzimuth(){const t=this.extent;if(this.quality!==2||!t||typeof this.preset!="string")return null;const e=this.active.position;if(e.y<=t.y1)return null;const i=(t.x0+t.x1)/2,o=(t.z0+t.z1)/2;return Math.hypot(e.x-i,e.z-o)<.5?null:le(re(e.x,e.z,i,o))}writeBox(t,e,i){const o=t.part,n=new $().setFromEuler(new _(y(o.rotation[0]),y(o.rotation[1]),y(o.rotation[2]),"YXZ")),a=i<=0,r=new z(o.position[0],e,o.position[2]),d=a?new z(1e-4,1e-4,1e-4):new z(Math.max(o.size[0],.001),Math.max(i,.001),Math.max(o.size[2],.001));t.obj instanceof L?(t.obj.setMatrixAt(t.index,new F().compose(r,n,d)),t.obj.instanceMatrix.needsUpdate=!0):(t.obj.position.copy(r),t.obj.scale.copy(d))}updateCutaway(){const t=this.wantedCutAzimuth();if(t===this.cutAzimuth)return;this.cutAzimuth=t;const e=this.desc;if(!e||!this.extent)return;const i=new Set(t===null?[]:ce(e,t,this.extent)),o=new Map(e.levels.map(n=>[n.id,n.elevation_m]));for(const n of this.cutNow){if(i.has(n))continue;const a=this.placed.get(n);a&&this.writeBox(a,a.part.position[1],a.part.size[1])}for(const n of i){if(this.cutNow.has(n))continue;const a=this.placed.get(n);if(!a)continue;const r=nt(a.part,o.get(a.part.level_id??"")??0,R);r?this.writeBox(a,r.y,r.h):this.writeBox(a,(o.get(a.part.level_id??"")??0)-1,0)}this.cutNow=i,this.rebuildCaps(o),this.sun&&(this.sun.shadow.needsUpdate=!0),this.selectedId&&this.setSelected(this.selectedId)}rebuildCaps(t){this.caps&&(this.root.remove(this.caps),this.caps.dispose(),this.caps=null);const e=[...this.cutNow].sort().map(r=>this.placed.get(r)).filter(r=>!!r&&r.part.kind==="wall");if(!e.length||this.quality!==2)return;const i=new L(this.unitBox,this.material(ct,1,!1,"floor"),e.length),o=new F,n=new $,a=new _;e.forEach((r,d)=>{const l=r.part,h=(t.get(l.level_id??"")??0)+R;n.setFromEuler(a.set(y(l.rotation[0]),y(l.rotation[1]),y(l.rotation[2]),"YXZ")),o.compose(new z(l.position[0],h+pt/2-.004,l.position[2]),n,new z(l.size[0]+.004,pt,l.size[2]+.004)),i.setMatrixAt(d,o)}),i.instanceMatrix.needsUpdate=!0,i.computeBoundingSphere(),i.name="caps",i.castShadow=!0,this.caps=i,this.root.add(i)}cutawayNow(){return[...this.cutNow].sort()}get buildCount(){return this.builds}pick(t,e){const i=this.renderer.domElement.getBoundingClientRect();if(!i.width||!i.height)return null;this.raycaster.setFromCamera(new Mt((t-i.left)/i.width*2-1,-((e-i.top)/i.height)*2+1),this.active);const o=[...this.lookup.keys()].filter(n=>n.visible);for(const n of this.raycaster.intersectObjects(o,!1)){const a=this.lookup.get(n.object);if(!a)continue;const r=a[n.instanceId??0];if(r){if(r.kind==="floor"){if(this.plateOpacity(r)<1)continue;return null}return{id:r.userData.id,kind:r.userData.kind,partId:r.id}}}return null}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.persp.aspect=t/e,this.persp.updateProjectionMatrix(),this.applyOrthoFrame(),this.invalidate()}redrawNow(){this.disposed||(cancelAnimationFrame(this.raf),this.raf=0,this.frame())}capture(){return this.controls.update(),this.updateCutaway(),this.renderer.render(this.scene,this.active),this.renderer.domElement.toDataURL("image/png")}renderThumbnail(t,e,i=Pe,o=Ae){const n=t.parts.filter(m=>m.level_id===e&&m.kind!=="cone"&&m.shape!=="sprite"&&m.shape!=="light");if(!t.levels.some(m=>m.id===e))return null;const a={...t,levels:t.levels.filter(m=>m.id===e),parts:n},r=this.realise(n,a),d=new V;if(d.add(r.root),this.quality===2){d.add(new q(dt,ut,ft));const m=new I(mt,wt);m.position.set(E[0]*50,E[1]*50,E[2]*50),d.add(m)}else{d.add(new N(16777215,1.6));const m=new I(16777215,1.4);m.position.set(1,2,1.2),d.add(m)}const l=this.renderer.domElement,h=this.renderer.getPixelRatio(),{w:c,h:p}=pe(i,o,l.width/h,l.height/h);if(c<8||p<8)return this.disposeGroup(r.root),null;const u=ot(ae(t,e),c/p),b=new K(-u.halfW,u.halfW,u.halfH,-u.halfH,.05,4e3);b.position.set(u.target[0]+A[0]*u.dist,u.target[1]+A[1]*u.dist,u.target[2]+A[2]*u.dist),b.lookAt(u.target[0],u.target[1],u.target[2]),b.updateProjectionMatrix();let g=null;const k=this.renderer.shadowMap.enabled;try{this.renderer.shadowMap.enabled=!1,this.renderer.setScissorTest(!0),this.renderer.setScissor(0,0,c,p),this.renderer.setViewport(0,0,c,p),this.renderer.render(d,b);const m=document.createElement("canvas");m.width=c,m.height=p;const T=m.getContext("2d");T&&(T.drawImage(l,0,l.height-p*h,c*h,p*h,0,0,c,p),g=m.toDataURL("image/png"))}catch(m){console.warn("sw-plan-3d: thumbnail failed",m)}finally{this.renderer.setScissorTest(!1),this.renderer.setViewport(0,0,l.width/h,l.height/h),this.renderer.shadowMap.enabled=k,this.disposeGroup(r.root),this.invalidate()}return g}async exportGltf(){const t=new C;for(const i of this.root.children)i!==this.outline&&t.add(i.clone());return await new Vt().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.invalidate),this.controls.removeEventListener("change",this.invalidate),this.controls.dispose(),this.clear();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.aoMaterial&&(this.aoMaterial.map?.dispose(),this.aoMaterial.dispose()),this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.unitPlane.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}const _t=2500,De=_t+1500,Re=1e4,Oe=3,Ne=3e3;function qe(s,t,e){return new Promise(i=>{let o=!1;const n=setTimeout(()=>{o||(o=!0,i(e))},t);s.then(a=>{o||(o=!0,clearTimeout(n),i(a))},()=>{o||(o=!0,clearTimeout(n),i(e))})})}var Be=Object.defineProperty,He=Object.getOwnPropertyDescriptor,w=(s,t,e,i)=>{for(var o=i>1?void 0:i?He(t,e):t,n=s.length-1,a;n>=0;n--)(a=s[n])&&(o=(i?a(t,e,o):a(o))||o);return i&&o&&Be(t,e,o),o};const Ue="ייצוא glTF נכשל",Ge="עבר לרמה סכמטית — קצב הפריימים היה נמוך",je=4e3,gt="sw.plan3d.quality",W="sw.plan3d.fallback",We=30;function Ye(s){return s.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}const Qe={wall:"קיר",opening:"פתח",object:"עצם",connector:"מחבר",camera:"מצלמה",entity:"ישות",zone:"חדר",label:"תווית",level:"מפלס"},vt=(s,t)=>{try{return(s==="local"?localStorage:sessionStorage).getItem(t)}catch{return null}},Y=(s,t,e)=>{try{const i=s==="local"?localStorage:sessionStorage;e===null?i.removeItem(t):i.setItem(t,e)}catch{}},yt=s=>s===2||s==="2"?2:s===1||s==="1"?1:null;let f=class extends Pt{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.cameras=[],this.labels={},this.exportName="plan-3d",this.levels=[],this.activeLevel=null,this.thumbnailScene=null,this.levelDots={},this.qualityDefault=null,this.minFps=We,this.continuous=!1,this.hover=null,this.chips=[],this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.chosen=yt(vt("local",gt)),this.installDefault=null,this.fallback=vt("session",W)==="1",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null,this.probe=null,this.probeTimer=0,this.probed=!1,this.probePending=!1,this.thumbs=new Map,this.thumbsFor=null,this.thumbsQuality=null,this.thumbPass=0,this.settingsAsked=!1,this.onVisibility=()=>{document.hidden?this.probe&&(this.endProbe(!1),this.probePending=!0):this.probePending&&this.quality===2&&this.view&&this.startProbe()}}firstUpdated(){this.init()}connectedCallback(){super.connectedCallback(),this.hasUpdated&&!this.view&&this.init(),document.addEventListener("visibilitychange",this.onVisibility)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("visibilitychange",this.onVisibility),this.ro?.disconnect(),cancelAnimationFrame(this.thumbPass),this.thumbPass=0,this.endProbe(!1),this.probed=!1,this.probePending=!1,this.view?.dispose(),this.view=null,this.applied=null,this.thumbs.clear(),this.thumbsFor=null,window.clearTimeout(this.toastTimer)}get quality(){return this.fallback?1:this.chosen??this.qualityDefault??this.installDefault??1}init(){if(this.chosen===null&&this.qualityDefault===null&&this.installDefault===null&&!this.settingsAsked){this.settingsAsked=!0,qe(At().then(s=>yt(s["plan.quality"])??1),Ne,1).then(s=>{this.installDefault=s}).finally(()=>{this.isConnected&&!this.view&&this.init()});return}try{this.view=new Fe({mount:this.stage,color:s=>getComputedStyle(this).getPropertyValue(`--sw-${s}`).trim()||"#888888",onSelect:s=>this.emitSelect(s),onHover:(s,t,e)=>this.setHover(s,t,e),onFrame:(s,t)=>{this.setAttribute("data-frames",String(s)),this.setAttribute("data-fps",String(t)),this.onProbeFrame(s)},onDraw:()=>this.layoutChips(),quality:this.quality})}catch(s){console.warn("sw-plan-3d: WebGL failed to start",s),this.error=Et;return}this.view.setContinuous(this.continuous),this.ro=new ResizeObserver(()=>this.view?.resize()),this.ro.observe(this),this.presetApplied=!1,this.setAttribute("data-quality",String(this.quality)),this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}updated(s){this.view&&(s.has("description")&&this.description&&this.apply(this.description),(s.has("selectedId")||s.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),s.has("preset")&&s.get("preset")!==void 0&&this.applyPreset(this.preset),s.has("continuous")&&!this.probe&&this.view.setContinuous(this.continuous),this.applyQuality(),this.layoutChips())}layoutChips(){const s=this.view;if(!s||!this.chips.length)return;this.renderRoot.querySelectorAll("[data-3d-chip]").forEach((e,i)=>{const o=this.chips[i],n=o?s.projectPoint(o.position):null;if(!n){e.style.display="none";return}e.style.display="block",e.style.transform=`translate(${Math.round(n.x)}px, ${Math.round(n.y)}px) translate(-50%, -50%)`})}apply(s){s!==this.applied&&(this.applied=s,this.view?.setDescription(s),this.chips=s.parts.filter(t=>t.kind==="chip"),this.setAttribute("data-parts",String(s.parts.length)),this.toggleAttribute("data-estimated",s.estimated),this.presetApplied||(this.applyPreset(this.preset),this.presetApplied=!0),this.view?.setSelected(this.selectedId),this.quality===2&&!this.probed&&this.startProbe())}applyQuality(){const s=this.quality;this.setAttribute("data-quality",String(s)),!(!this.view||this.view.getQuality()===s)&&(this.view.setQuality(s),this.thumbs.clear(),this.probed=!1,s===2&&this.applied?this.startProbe():this.endProbe(!1),this.requestUpdate())}setQuality(s){this.chosen=s,Y("local",gt,String(s)),s===2&&this.fallback&&(this.fallback=!1,Y("session",W,null))}startProbe(){if(this.endProbe(!1),this.probed=!0,!(!this.view||this.minFps<=0)){if(document.hidden){this.probePending=!0;return}this.probePending=!1,this.probe={until:0,t0:0,f0:0,start:Number(this.getAttribute("data-frames")??0)},this.view.setContinuous(!0),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),Re)}}onProbeFrame(s){const t=this.probe;if(!t)return;if(document.hidden){this.endProbe(!1),this.probePending=!0;return}const e=performance.now();if(!t.t0){if(s-t.start<Oe)return;t.t0=e,t.f0=s,t.until=e+_t,window.clearTimeout(this.probeTimer),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),De);return}if(e<t.until)return;const i=(s-t.f0)*1e3/(e-t.t0);this.setAttribute("data-probe-fps",String(Math.round(i))),this.endProbe(!1),i<this.minFps&&this.fallBack()}endProbe(s){window.clearTimeout(this.probeTimer),this.probeTimer=0;const t=this.probe;if(this.probe=null,this.view?.setContinuous(this.continuous),s&&t&&document.hidden){this.probePending=!0;return}if(s&&t){const e=Number(this.getAttribute("data-frames")??0),i=t.t0?(e-t.f0)*1e3/Math.max(1,performance.now()-t.t0):0;this.setAttribute("data-probe-fps",String(Math.round(i))),i<this.minFps&&this.fallBack()}}fallBack(){this.fallback=!0,Y("session",W,"1")}applyPreset(s){this.view?.setPreset(s)&&this.setAttribute("data-preset",typeof s=="string"?s:"camera")}pickPreset(s){this.preset=s,this.applyPreset(s)}labelOf(s){return this.labels[s.id]??Qe[s.kind]??s.id}emitSelect(s){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:s?.id??null,kind:s?.kind??null},bubbles:!0,composed:!0}))}setHover(s,t,e){this.hover=s?{id:s.id,kind:s.kind,label:this.labelOf(s),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}pickLevel(s){const t=this.activeLevel===s?null:s;this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t},bubbles:!0,composed:!0}))}thumbFor(s){const t=this.thumbnailScene;if(!t||!this.view)return"";(this.thumbsFor!==t||this.thumbsQuality!==this.quality)&&(this.thumbs.clear(),this.thumbsFor=t,this.thumbsQuality=this.quality);const e=this.thumbs.get(s);return e===void 0&&this.scheduleThumbs(),e??""}scheduleThumbs(){this.thumbPass||(this.thumbPass=requestAnimationFrame(()=>{this.thumbPass=0;const s=this.thumbnailScene,t=this.view;if(!s||!t||this.thumbsFor!==s)return;let e=!1;for(const i of this.levels){if(this.thumbs.has(i.id))continue;const o=t.renderThumbnail(s,i.id);o&&(this.thumbs.set(i.id,o),e=!0)}e&&t.redrawNow(),this.setAttribute("data-3d-thumbs",String(this.thumbs.size)),e&&this.requestUpdate()}))}get thumbnailCount(){return this.thumbs.size}toScreen(s){return this.view?.projectPoint(s)??null}capture(){return this.view?.capture()??null}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const s=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(s)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${Ye(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(s){console.warn("sw-plan-3d: glTF export failed",s),this.showToast(Ue)}finally{this.exporting=!1}}}showToast(s){this.toast=s,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",je)}renderStrip(){if(this.levels.length<2||!this.thumbnailScene||!this.ready)return x;const s=[...this.levels].sort((t,e)=>e.elevation_m-t.elevation_m||(t.id<e.id?-1:1));return this.thumbs=Tt(this.thumbs,s.map(t=>t.id)),v`<div class="strip" role="group" aria-label="מפלסים" data-3d-strip>
      ${s.map(t=>{const e=this.levelDots[t.id];return v`<button type="button" data-3d-thumb=${t.id} aria-pressed=${this.activeLevel===t.id?"true":"false"} title=${`${t.name} · ${t.elevation_m>=0?"+":"−"}${Math.abs(t.elevation_m).toFixed(1)} מ׳`} @click=${()=>this.pickLevel(t.id)}>
          <span class="pic"><img alt="" src=${this.thumbFor(t.id)} />${e&&(e.presence>0||e.open||e.lit)?v`<span class="dots" data-3d-dots=${t.id}>${e.presence>0?v`<i data-dot="presence" title="תנועה" style=${`--fade:${Math.max(.35,e.presence).toFixed(2)}`}></i>`:x}${e.open?v`<i data-dot="open" title="פתח פתוח"></i>`:x}${e.lit?v`<i data-dot="lit" title="תאורה דולקת"></i>`:x}</span>`:x}</span><span>${t.name}</span>
        </button>`})}
    </div>`}render(){const s=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,""),e=this.quality;return v`
      <div class="stage"></div>
      ${!this.ready&&!this.error?v`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>`:x}
      ${this.error?v`<div class="spinner err" data-3d-error>${this.error}</div>`:x}
      ${this.chips.length?v`<div class="chips" aria-hidden="true">${this.chips.map(i=>v`<span class="chip" data-3d-chip=${i.userData.id} data-3d-chip-part=${i.id}>${i.text??""}</span>`)}</div>`:x}
      ${this.renderStrip()}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${s==="top"} @click=${()=>this.pickPreset("top")}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${s==="iso"} @click=${()=>this.pickPreset("iso")}>איזומטרי</sw-chip>
        <sw-chip data-preset-persp ?selected=${s==="persp"} @click=${()=>this.pickPreset("persp")}>פרספקטיבה</sw-chip>
        ${this.cameras.length?v`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${t} @change=${i=>this.onCameraChange(i)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map(i=>v`<option value=${i.id} ?selected=${i.id===t}>${i.label}</option>`)}
            </select>`:x}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-1 title="רמה סכמטית: חומרים שטוחים, בלי צללים" ?selected=${e===1} @click=${()=>this.setQuality(1)}>סכמטי</sw-chip>
        <sw-chip data-quality-2 title="רמה מלאה: צללים רכים, חומרים, חיתוך קירות" ?selected=${e===2} @click=${()=>this.setQuality(2)}>מלא</sw-chip>
        <sw-button size="sm" variant="ghost" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?"מייצא…":"ייצוא glTF"}</sw-button>
      </div>
      ${this.description?.estimated?v`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>`:x}
      ${this.fallback?v`<div class="note fb" role="status" data-3d-fallback>${Ge}</div>`:x}
      ${this.toast?v`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:x}
      ${this.hover?v`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:x}
    `}onCameraChange(s){const t=s.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};f.styles=Ct`
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
    .chips {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .chip {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate(-50%, -50%);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 1px 7px;
      font-size: var(--sw-fs-xs);
      font-weight: 600;
      color: var(--sw-map-temp);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
      display: none;
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
  `;w([M({attribute:!1})],f.prototype,"description",2);w([M()],f.prototype,"selectedId",2);w([M({attribute:!1})],f.prototype,"preset",2);w([M({attribute:!1})],f.prototype,"cameras",2);w([M({attribute:!1})],f.prototype,"labels",2);w([M()],f.prototype,"exportName",2);w([M({attribute:!1})],f.prototype,"levels",2);w([M()],f.prototype,"activeLevel",2);w([M({attribute:!1})],f.prototype,"thumbnailScene",2);w([M({attribute:!1})],f.prototype,"levelDots",2);w([M({attribute:!1})],f.prototype,"qualityDefault",2);w([M({type:Number})],f.prototype,"minFps",2);w([M({type:Boolean,reflect:!0,attribute:"data-measure"})],f.prototype,"continuous",2);w([S()],f.prototype,"hover",2);w([S()],f.prototype,"chips",2);w([S()],f.prototype,"ready",2);w([S()],f.prototype,"exporting",2);w([S()],f.prototype,"error",2);w([S()],f.prototype,"toast",2);w([S()],f.prototype,"chosen",2);w([S()],f.prototype,"installDefault",2);w([S()],f.prototype,"fallback",2);w([It(".stage")],f.prototype,"stage",2);f=w([Lt("sw-plan-3d")],f);export{We as DEFAULT_MIN_FPS,W as FALLBACK_KEY,De as PROBE_FALLBACK_MS,Re as PROBE_FIRST_FRAME_MS,_t as PROBE_MS,Oe as PROBE_WARM_FRAMES,gt as QUALITY_KEY,Ne as SETTINGS_WAIT_MS,f as SwPlan3d};
//# sourceMappingURL=sw-plan-3d-DPnEv32j.js.map
