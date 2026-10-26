const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-BonxfBTz.css"])))=>i.map(i=>d[i]);
import{bg as W,bh as Zs,bi as Js,bj as ti,bk as ei,bl as si,bm as ii,bn as ni,bo as Te,bp as ze,bq as oi,br as ai,bs as ri,bt as $e,aR as li,bu as hi,bv as Le,bw as Ie,bx as dt,by as Jt,bz as ci,bA as di,bB as ui,bC as te,bD as pi,bE as fi,bF as mi,an as Rs,ao as R,ap as C,a as Cs,G as L,bG as B,I as T,aq as Ns,bH as wi,bI as gi,bJ as vi,bK as bi,bL as yi,bM as ee,bN as ki,bO as Tt,bP as se,bQ as zt,bR as xi,bS as Mi,bT as De,bU as Si,bV as _i,au as Pi,bW as Ai,bX as Ei,bY as Ti,bZ as zi,b_ as $i,b$ as Li,c0 as Ii,c1 as $t,c2 as Di,c3 as Ri,c4 as Ci,c5 as Ni,c6 as Fi,c7 as Re,c8 as Oi,c9 as me,ca as qi,cb as Gi,cc as Ui,cd as Hi,ce as Wi,cf as Bi,cg as ji,ch as Ki,ci as V,cj as Ce,ck as Xi,cl as Ne,cm as Yi,cn as Vi}from"./index-BXZiJGFX.js";import{co as Qa}from"./index-BXZiJGFX.js";import{a as I,C as st,z as Qi,R as Kt,E as Xt,G as Zi,I as Fe,J as At,K as mt,V as wt,B as at,F as et,P as tt,Q as gt,b as X,X as Vt,M as H,Y as it,_ as nt,$ as Q,n as ot,a0 as Fs,a1 as Os,a2 as qs,a3 as Oe,a4 as Gs,a5 as St,a6 as we,a7 as Ji,a8 as Us,a9 as tn,aa as en,ab as Pe,ac as sn,O as qe,ad as nn,ae as on,af as an,ag as Ge,ah as rn,ai as ln,aj as K,ak as xt,al as ut,am as hn,v as cn,an as dn,x as un,ao as pn,ap as fn,aq as mn,ar as Ue,as as wn,at as gn}from"./three-D1RWuQvV.js";import"./transit-logic-DKeOUjSD.js";function Hs(s,t,e=[0,0,0]){const i=s.length/3,o=new Float32Array(i*2),n=t>0?t:1;for(let a=0;a+2<i;a+=3){const r=a*3,l=s[r+3]-s[r],h=s[r+4]-s[r+1],d=s[r+5]-s[r+2],p=s[r+6]-s[r],u=s[r+7]-s[r+1],f=s[r+8]-s[r+2],v=Math.abs(h*f-d*u),w=Math.abs(d*p-l*f),y=Math.abs(l*u-h*p);for(let b=0;b<3;b++){const A=r+b*3,S=s[A]+e[0],z=s[A+1]+e[1],c=s[A+2]+e[2];let m,g;v>=w&&v>=y?(m=c,g=z):w>=y?(m=S,g=c):(m=S,g=z),o[(a+b)*2]=m/n,o[(a+b)*2+1]=g/n}}return o}function vn(s,t,e){if(!t)return Float32Array.from(s);const i=new Float32Array(t.length*e);for(let o=0;o<t.length;o++)for(let n=0;n<e;n++)i[o*e+n]=s[t[o]*e+n];return i}function bn(s,t){const e=t*9,i=s[e+3]-s[e],o=s[e+4]-s[e+1],n=s[e+5]-s[e+2],a=s[e+6]-s[e],r=s[e+7]-s[e+1],l=s[e+8]-s[e+2],h=o*l-n*r,d=n*a-i*l,p=i*r-o*a,u=Math.hypot(h,d,p)||1;return[h/u,d/u,p/u]}function yn(s,t){const e=Math.floor(s.length/9),i=Array.from({length:e},(l,h)=>bn(s,h)),o=l=>`${Math.round(s[l*3]*1e4)},${Math.round(s[l*3+1]*1e4)},${Math.round(s[l*3+2]*1e4)}`,n=new Map;for(let l=0;l<e*3;l++){const h=o(l),d=n.get(h);d?d.push(Math.floor(l/3)):n.set(h,[Math.floor(l/3)])}const a=Math.cos(t),r=new Float32Array(e*9);for(let l=0;l<e*3;l++){const h=i[Math.floor(l/3)];let d=0,p=0,u=0;for(const v of n.get(o(l))??[]){const w=i[v];w[0]*h[0]+w[1]*h[1]+w[2]*h[2]>=a&&(d+=w[0],p+=w[1],u+=w[2])}const f=Math.hypot(d,p,u)||1;r[l*3]=d/f,r[l*3+1]=p/f,r[l*3+2]=u/f}return r}const kn=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function xn(s,t){const e=new Array(16).fill(0);for(let i=0;i<4;i++)for(let o=0;o<4;o++)for(let n=0;n<4;n++)e[i*4+o]+=s[n*4+o]*t[i*4+n];return e}function Mn(s,t,e){const[i,o,n,a]=t,[r,l,h]=e;return[(1-2*(o*o+n*n))*r,2*(i*o+n*a)*r,2*(i*n-o*a)*r,0,2*(i*o-n*a)*l,(1-2*(i*i+n*n))*l,2*(o*n+i*a)*l,0,2*(i*n+o*a)*h,2*(o*n-i*a)*h,(1-2*(i*i+o*o))*h,0,s[0],s[1],s[2],1]}function Sn(s,t,e,i){return[s[0]*t+s[4]*e+s[8]*i+s[12],s[1]*t+s[5]*e+s[9]*i+s[13],s[2]*t+s[6]*e+s[10]*i+s[14]]}const _n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};function Pn(s){const t=new DataView(s);if(t.getUint32(0,!0)!==1179937895)throw new Error("not a GLB");let e=12,i=null,o=null;for(;e+8<=s.byteLength;){const f=t.getUint32(e,!0),v=t.getUint32(e+4,!0);v===1313821514?i=JSON.parse(new TextDecoder().decode(new Uint8Array(s,e+8,f))):v===5130562&&(o=new DataView(s,e+8,f)),e+=8+f}if(!i||!o)throw new Error("GLB without JSON or BIN");const n=i,a=o,r=f=>{const v=n.accessors[f],w=n.bufferViews[v.bufferView],y=_n[v.type]??1,b=v.componentType===5126||v.componentType===5125?4:v.componentType===5123||v.componentType===5122?2:1,A=w.byteStride||y*b,S=(w.byteOffset??0)+(v.byteOffset??0),z=[];for(let c=0;c<v.count;c++)for(let m=0;m<y;m++){const g=S+c*A+m*b;z.push(v.componentType===5126?a.getFloat32(g,!0):v.componentType===5125?a.getUint32(g,!0):v.componentType===5123?a.getUint16(g,!0):v.componentType===5122?a.getInt16(g,!0):a.getUint8(g))}return z},l=[],h=[1/0,1/0,1/0],d=[-1/0,-1/0,-1/0],p=(f,v)=>{const w=n.nodes[f],y=w.matrix&&w.matrix.length===16?w.matrix:Mn(w.translation??[0,0,0],w.rotation??[0,0,0,1],w.scale??[1,1,1]),b=xn(v,y);if(w.mesh!==void 0)for(const A of n.meshes[w.mesh].primitives){if((A.mode??4)!==4||A.attributes.POSITION===void 0)continue;const S=r(A.attributes.POSITION),z=A.indices!==void 0?r(A.indices):null,c=vn(S,z,3);for(let m=0;m<c.length;m+=3){const g=Sn(b,c[m],c[m+1],c[m+2]);c[m]=g[0],c[m+1]=g[1],c[m+2]=g[2];for(let k=0;k<3;k++)h[k]=Math.min(h[k],g[k]),d[k]=Math.max(d[k],g[k])}l.push({positions:c,material:(A.material!==void 0?n.materials?.[A.material]?.name:"")??""})}for(const A of w.children??[])p(A,b)},u=n.scenes?.[n.scene??0]?.nodes??n.nodes.map((f,v)=>v);for(const f of u)p(f,kn);if(!l.length)throw new Error("GLB without triangles");return{primitives:l,min:h,max:d}}function An(s,t,e,i,o){const n=t[0]-s[0]>1e-6?e/(t[0]-s[0]):1,a=t[1]-s[1]>1e-6?i/(t[1]-s[1]):1,r=t[2]-s[2]>1e-6?o/(t[2]-s[2]):1,l=Math.min(n,a,r);return{scale:[Math.min(n,l*1.15),Math.min(a,l*1.15),Math.min(r,l*1.15)],offset:[-(s[0]+t[0])/2,-s[1],-(s[2]+t[2])/2]}}function En(s,t){const e=Math.sin(s*12.9898+t*78.233)*43758.5453;return 1+((e-Math.floor(e))*.1-.05)}const Tn={rung:"lite",style:"light",furniture:"models",textures:"files",sectionCut:!0},ht=new Map(ni.map(s=>[s.id,s])),Z=s=>s*Math.PI/180,Ws=new Set(["floor","wall","lintel","sill","head","door","window","object","connector","camera","room"]),zn=new Set(["wall","lintel","sill","head","door","window","object","connector","camera","ceiling"]),$n=.5,Ln=Z(35);class In{constructor(t,e){this.base=t,this.onLoad=e,this.loader=new Qi,this.textures=new Map,this.failed=new Set,this.mats=new Map,this.pendingLoads=0,this.clip=null,this.style="light",this.source="files",this.rung="lite"}get pending(){return this.pendingLoads}tex(t,e){if(this.failed.has(t))return null;let i=this.textures.get(t);return i||(this.pendingLoads++,i=this.loader.load(t,()=>{this.pendingLoads--,this.onLoad()},void 0,()=>{this.pendingLoads--,this.failed.add(t);for(const o of this.mats.values())(o.m.map===i||o.m.normalMap===i||o.m.roughnessMap===i)&&(o.m.map=null,o.m.normalMap=null,o.m.roughnessMap=null,o.m.aoMap=null,o.m.roughness=ht.get(o.id)?.roughness??1,o.m.needsUpdate=!0);this.onLoad()}),i.wrapS=Kt,i.wrapT=Kt,i.colorSpace=e?Xt:Zi,i.anisotropy=4,this.textures.set(t,i),i)}tint(t){return new st(t?.tint[this.style]??"#cccccc").getHex()}get(t,e="std",i=!0){const o=`${t}|${e}|${i?1:0}|${this.rung==="realistic"&&e==="glass"?"phys":""}`,n=this.mats.get(o);if(n)return n.m;const a=ht.get(t);let r;if(e==="glass"||a?.glass){const l=W[this.style].glass,h=t==="glass_frosted";this.rung==="realistic"&&!h?r=new Fe({color:l.tint,transmission:.92,roughness:.05,ior:1.5,clearcoat:.6,thickness:.01,transparent:!0,opacity:1,envMapIntensity:l.env,side:At}):r=new mt({color:h?14674419:l.tint,transparent:!0,opacity:h?.62:l.opacity,roughness:.05,metalness:0,envMapIntensity:1.4,depthWrite:!1,side:At,forceSinglePass:!0})}else{const l=a?.metalness??0;r=new mt({color:this.tint(a),roughness:a?.roughness??1,metalness:l,envMapIntensity:l>.5?1:.7});const h=e==="nomap"||this.source!=="files"?null:Zs(t,this.base);if(h){const d=this.tex(h.color,!0),p=this.tex(h.normal,!1),u=this.tex(h.roughAo,!1);d&&p&&u&&(r.map=d,r.normalMap=p,r.normalScale=new wt(a?.normal??1,a?.normal??1),r.roughnessMap=u,r.aoMap=u,r.aoMapIntensity=.6,r.roughness=1)}e.startsWith("slot:")&&(r.roughness=Number(e.slice(5))),e==="floor"&&(r.roughness*=W[this.style].rig.floorSheen)}return r.userData.materialId=t,i&&(r.clippingPlanes=this.clip),r.clipShadows=!0,this.mats.set(o,{id:t,variant:e,m:r}),r}setStyle(t){this.style=t;const e=W[t].glass;for(const i of this.mats.values()){const o=ht.get(i.id);if(i.variant==="glass"||o?.glass){i.id!=="glass_frosted"&&i.m.color.setHex(e.tint),i.m.envMapIntensity=e.env,!(i.m instanceof Fe)&&i.id!=="glass_frosted"&&(i.m.opacity=e.opacity);continue}i.m.color.setHex(this.tint(o)),i.variant==="floor"&&(i.m.roughness=(i.m.map?1:o?.roughness??1)*W[t].rig.floorSheen)}}setClip(t){this.clip=t;for(const[e,i]of this.mats)e.split("|")[2]==="1"&&(i.m.clippingPlanes=t)}setRung(t){if(t!==this.rung){this.rung=t;for(const[e,i]of[...this.mats])(i.variant==="glass"||ht.get(i.id)?.glass)&&(i.m.dispose(),this.mats.delete(e))}}setSource(t){if(t!==this.source){this.source=t;for(const e of this.mats.values())e.m.dispose();this.mats.clear()}}dispose(){for(const t of this.mats.values())t.m.dispose();for(const t of this.textures.values())t.dispose();this.mats.clear(),this.textures.clear()}}class Dn{constructor(t,e){this.base=t,this.onLoad=e,this.cache=new Map,this.loading=new Set,this.version=0}get pending(){return this.loading.size}template(t){if(this.cache.has(t))return this.cache.get(t);this.loading.has(t)||(this.loading.add(t),fetch(ti(t,this.base)).then(e=>e.ok?e.arrayBuffer():Promise.reject(new Error(`HTTP ${e.status}`))).then(e=>{const i=Pn(e),o=i.primitives.map(n=>{const a=new at;return a.setAttribute("position",new et(n.positions,3)),a.setAttribute("normal",new et(yn(n.positions,Ln),3)),{geometry:a,slot:n.material}});this.cache.set(t,{model:i,geos:o})}).catch(e=>{console.warn(`sw-plan-3d: model ${t} failed, the procedural family draws instead`,e),this.cache.set(t,null)}).finally(()=>{this.loading.delete(t),this.version++,this.onLoad()}))}dispose(){for(const t of this.cache.values())for(const e of t?.geos??[])e.geometry.dispose();this.cache.clear()}}let He=null,pt=null,Mt=null,We=null;function Qt(s,t,e){const i=document.createElement("canvas");i.width=s,i.height=t;const o=i.getContext("2d");return o&&e(o),new Pe(i)}function Bs(){return He??=Qt(128,128,s=>{const t=s.createRadialGradient(64,64,0,64,64,64);t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.45,"rgba(0,0,0,0.75)"),t.addColorStop(.8,"rgba(0,0,0,0.18)"),t.addColorStop(1,"rgba(0,0,0,0)"),s.fillStyle=t,s.fillRect(0,0,128,128)}),He}function Rn(){return pt||(pt=Qt(4,64,s=>{const t=s.createLinearGradient(0,0,0,64);t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.35,"rgba(0,0,0,0.45)"),t.addColorStop(1,"rgba(0,0,0,0)"),s.fillStyle=t,s.fillRect(0,0,4,64)}),pt.wrapS=Kt,pt.wrapT=tn,pt.flipY=!1),pt}function Be(){return We??=Qt(256,256,s=>{const t=s.createRadialGradient(128,128,0,128,128,128);t.addColorStop(0,"#fff"),t.addColorStop(.55,"#fff"),t.addColorStop(1,"#000"),s.fillStyle=t,s.fillRect(0,0,256,256)}),We}function Cn(){return Mt||(Mt=Qt(1024,128,s=>{s.fillStyle="#000",s.fillRect(0,0,1024,128);let t=77;const e=()=>(t=t*1664525+1013904223>>>0,t/4294967296);s.fillStyle="#fff",s.beginPath(),s.moveTo(0,128);for(let i=0;i<=1024;i+=8)s.lineTo(i,128-(60+22*Math.sin(i*.02)+14*Math.sin(i*.071+1.3)+e()*10));s.lineTo(1024,128),s.closePath(),s.fill()}),Mt.wrapS=Kt,Mt.repeat.set(6,1)),Mt}class js{constructor(){this.pos=[],this.nrm=[],this.ranges=[],this.parts=[]}push(t,e,i){const o=t.index?t.toNonIndexed():t,n=o.getAttribute("position"),a=o.getAttribute("normal"),r=new en().getNormalMatrix(e),l=new I;this.ranges.push(this.pos.length/9),this.parts.push(i);for(let h=0;h<n.count;h++)l.set(n.getX(h),n.getY(h),n.getZ(h)).applyMatrix4(e),this.pos.push(l.x,l.y,l.z),a?(l.set(a.getX(h),a.getY(h),a.getZ(h)).applyMatrix3(r).normalize(),this.nrm.push(l.x,l.y,l.z)):this.nrm.push(0,1,0);o!==t&&o.dispose()}geometry(t){const e=new at,i=new Float32Array(this.pos);return e.setAttribute("position",new St(i,3)),e.setAttribute("normal",new St(new Float32Array(this.nrm),3)),e.setAttribute("uv",new St(Hs(i,t),2)),e.computeBoundingSphere(),e}}const lt=(s,t,e=[1,1,1])=>new X().compose(new I(s[0],s[1],s[2]),new nt().setFromEuler(new Q(Z(t[0]),Z(t[1]),Z(t[2]),"YXZ")),new I(e[0],e[1],e[2]));function _t(s,t,e,i,o){let n;const[a,r,l]=[Math.max(t[0],.001),Math.max(t[1],.001),Math.max(t[2],.001)];s==="rbox"&&e>0?n=new Ji(a,r,l,Math.min(a,r,l)<.12?1:2,Math.min(e,Math.min(a,r,l)/2-1e-4)):s==="cyl"||s==="cylinder"?n=new Vt(a/2*i,a/2,r,14):s==="sphere"?n=new Gs(.5,12,8).scale(a,r,l):n=new gt(a,r,l);const h=n.index?n.toNonIndexed():n;return h!==n&&n.dispose(),h.setAttribute("uv",new St(Hs(h.getAttribute("position").array,o),2)),h}const je=s=>s.map(t=>Math.round(t*1e3)).join("x");function ge(s,t,e,i=!1){if(s.length<3)return null;const o=Us.triangulateShape(s.map(([r,l])=>new wt(r,l)),[]),n=[];for(const[r,l,h]of o){const[d,p,u]=[s[r],s[l],s[h]],f=(p[0]-d[0])*(u[1]-d[1])-(u[0]-d[0])*(p[1]-d[1]);Math.abs(f)<1e-10||(f>0!==i?n.push(d[0],t+e,d[1],u[0],t+e,u[1],p[0],t+e,p[1]):n.push(d[0],t+e,d[1],p[0],t+e,p[1],u[0],t+e,u[1]))}if(!n.length)return null;const a=new at;return a.setAttribute("position",new et(n,3)),a.computeVertexNormals(),a}function Nn(s){const{real:t,settings:e,mats:i,models:o}=s,n={root:new tt,lookup:new Map,leaves:new Map,shutters:new Map,bulbs:new Map,caps:null,stats:{meshes:0,instanced:0,merged:0,models:0}};n.root.name="real";const a=new Set(s.desc.levels.map(c=>c.id)),r=s.heavy,l=new Set(r?[]:t.replaced),h=new Set,d=[];if(e.furniture==="models"&&!r)for(const c of t.models){const m=ei[c.item];if(!m||!a.has(c.level_id))continue;const g=o.template(m.file);g&&(h.add(c.owner),d.push({row:c,entry:m,tpl:g}))}const p=new Map,u=new Map,f=(c,m,g,k)=>{const M=`${c??""}|${m}|${g}|${zn.has(k)?"c":"n"}`;let x=p.get(M);return x||p.set(M,x=new js),x},v=new gt(1,1,1),w=(c,m)=>({id:c.id,kind:m,userData:c.userData});for(const c of s.parts){if(!Ws.has(c.kind)||l.has(c.id)||h.has(c.id)||c.kind==="room")continue;const m=t.materials[c.id]??"plaster_white";if(c.kind==="window"||m==="glass"||m==="glass_frosted"){f(c.level_id,m==="glass_frosted"?"glass_frosted":"glass","glass",c.kind).push(v,lt(c.position,c.rotation,[Math.max(c.size[0],.001),Math.max(c.size[1],.001),Math.max(c.size[2],.001)]),w(c,c.kind));continue}if(c.kind==="door"&&c.shape==="box"){n.leaves.set(c.id,Fn(c,t,s,i,n));continue}if((c.kind==="object"||c.kind==="camera")&&(c.shape==="box"||c.shape==="cylinder")){const M=r?0:t.radius[c.id]??0,x=c.shape==="cylinder"?"cyl":M>0?"rbox":"box",$=`${c.level_id}|${x}|${je(c.size)}|${M}|${m}`;let N=u.get($);N||u.set($,N={shape:x,size:c.size,radius:M,taper:1,material:m,variant:"std",level:c.level_id,shadow:!0,items:[]}),N.items.push({matrix:lt(c.position,c.rotation),part:w(c,c.kind)});continue}if(c.shape==="prism"){const M=qn(c);M&&f(c.level_id,m,"std",c.kind).push(M,new X().makeTranslation(c.position[0],c.position[1],c.position[2]),w(c,c.kind));continue}if(c.shape!=="box"&&c.shape!=="cylinder")continue;const g=c.kind==="floor"?"floor":"std",k=c.shape==="cylinder"?new Vt(.5,.5,1,16):v;f(c.level_id,m,g,c.kind).push(k,lt(c.position,c.rotation,[Math.max(c.size[0],.001),Math.max(c.size[1],.001),Math.max(c.size[2],.001)]),w(c,c.kind)),k!==v&&k.dispose()}if(!r)for(const c of t.parts){if(!a.has(c.level_id??"")&&c.level_id!==null||h.has(c.owner)||n.leaves.has(c.owner))continue;const m={id:c.id,kind:c.userData.kind==="opening"?"door":"object",userData:c.userData};if(c.bulb){const M=On(i,c.bulb,n),x=_t(c.shape,c.size,c.radius??0,c.taper??1,1),$=new H(x,M);$.applyMatrix4(lt(c.position,c.rotation)),$.name=c.id,$.userData.ownMaterial=!0,n.lookup.set($,[m]),n.root.add($),n.stats.meshes++;continue}if(c.userData.kind==="wall"||c.userData.kind==="opening"){const M=_t(c.shape,c.size,c.radius??0,c.taper??1,1);f(c.level_id,c.material,"std","wall").push(M,lt(c.position,c.rotation),m),M.dispose();continue}const g=`${c.level_id}|${c.shape}|${je(c.size)}|${c.radius??0}|${c.taper??1}|${c.material}|${c.shadow?1:0}`;let k=u.get(g);k||u.set(g,k={shape:c.shape,size:c.size,radius:c.radius??0,taper:c.taper??1,material:c.material,variant:"std",level:c.level_id,shadow:c.shadow,items:[]}),k.items.push({matrix:lt(c.position,c.rotation),part:m})}for(const c of t.floors){if(!a.has(c.level_id))continue;const m=ge(c.polygon,c.y,.006);m&&f(c.level_id,c.material,"floor","floor").push(m,new X,{id:c.id,kind:"room",userData:{id:c.zone,kind:"zone"}})}for(const c of t.ceilings??[]){if(!a.has(c.level_id))continue;const m=ge(c.polygon,c.y-.006,.006,!0);m&&f(c.level_id,c.material,"std","ceiling").push(m,new X,{id:c.id,kind:"room",userData:{id:c.zone,kind:"zone"}})}for(const[c,m]of[...p].sort((g,k)=>g[0]<k[0]?-1:1)){const[g,k,M,x]=c.split("|"),$=ht.get(k),N=m.geometry($?.tile_m??1),G=i.get(k,M==="glass"?"glass":M,x==="c"),E=new H(N,G);E.name=`merged|${g}|${k}|${M}`,E.userData.ranges=Uint32Array.from(m.ranges);const D=M==="glass";E.castShadow=!D,E.receiveShadow=!D,D&&(E.renderOrder=2),n.lookup.set(E,m.parts),n.root.add(E),n.stats.merged++}for(const[c,m]of[...u].sort((g,k)=>g[0]<k[0]?-1:1)){const g=ht.get(m.material),k=_t(m.shape,m.size,m.radius,m.taper,g?.tile_m??1),M=new it(k,i.get(m.material,m.variant,!0),m.items.length);m.items.forEach((x,$)=>M.setMatrixAt($,x.matrix)),M.instanceMatrix.needsUpdate=!0,M.computeBoundingSphere(),M.castShadow=m.shadow,M.receiveShadow=!0,M.name=`inst|${c}`,n.lookup.set(M,m.items.map(x=>x.part)),n.root.add(M),n.stats.instanced++}const y=new Map;for(const{row:c,entry:m,tpl:g}of d){const k=`${c.level_id}|${m.file}`;let M=y.get(k);M||y.set(k,M={entry:m,tpl:g,level:c.level_id,list:[]});const x=An(g.model.min,g.model.max,c.size[0],c.size[1],c.size[2]),$={id:c.owner,kind:"object",userData:{id:c.id.slice(6),kind:"object"}};for(const N of c.tiles){const G=new X().compose(new I(N[0],N[1],N[2]),new nt().setFromEuler(new Q(0,Z(c.yaw),0,"YXZ")),new I(...x.scale));G.multiply(new X().makeTranslation(x.offset[0],x.offset[1],x.offset[2])),M.list.push({m:G,part:$,j:En(N[0],N[2])})}}for(const[c,m]of[...y].sort((g,k)=>g[0]<k[0]?-1:1))m.tpl.geos.forEach((g,k)=>{const M=m.entry.slots[g.slot]??m.entry.fallback,x=new it(g.geometry,i.get(M,`slot:${si[g.slot]??.6}`,!0),m.list.length),$=new st;m.list.forEach((N,G)=>{x.setMatrixAt(G,N.m),x.setColorAt(G,$.setScalar(N.j))}),x.instanceMatrix.needsUpdate=!0,x.instanceColor&&(x.instanceColor.needsUpdate=!0),x.computeBoundingSphere(),x.castShadow=!0,x.receiveShadow=!0,x.name=`model|${c}|${k}`,x.userData.shared=!0,n.lookup.set(x,m.list.map(N=>N.part)),n.root.add(x),n.stats.models++});for(const c of t.shutters){if(!a.has(c.level_id))continue;const m=new gt(c.width,1,.04).translate(0,-.5,0),g=new H(m,i.get("shutter","std",!0));g.position.set(c.position[0],c.position[1],c.position[2]),g.rotation.set(0,Z(c.yaw),0,"YXZ"),g.scale.y=Math.max(.001,c.down*c.height),g.visible=c.down>.001,g.castShadow=!0,g.name=c.id,n.lookup.set(g,[{id:c.id,kind:"window",userData:{id:c.id.slice(8),kind:"opening"}}]),n.shutters.set(c.id,{mesh:g,height:c.height}),n.root.add(g)}const b=W[e.style],A=new Map(s.desc.levels.map(c=>[c.id,c.elevation_m])),S=Gn(s.parts.filter(c=>c.kind==="wall"&&c.shape==="box"&&c.userData.kind==="wall"&&Math.abs(c.position[1]-c.size[1]/2-(A.get(c.level_id??"")??0))<.02));if(S){const c=new ot({map:Rn(),color:0,transparent:!0,opacity:b.post.junctionAlpha,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),m=new H(S,c);m.name="ao-strips",m.renderOrder=1,m.userData.ownMaterial=!0,n.root.add(m)}const z=s.parts.filter(c=>c.kind==="object"&&(c.shape==="box"||c.shape==="cylinder")&&c.position[1]-c.size[1]/2<=(A.get(c.level_id??"")??0)+$n);if(z.length){const c=new ot({map:Bs(),color:0,transparent:!0,opacity:b.post.blobAlpha,depthWrite:!1}),m=new gt(1,0,1),g=new it(m,c,z.length);z.forEach((k,M)=>g.setMatrixAt(M,new X().compose(new I(k.position[0],k.position[1]-k.size[1]/2+.008,k.position[2]),new nt().setFromEuler(new Q(0,Z(k.rotation[1]),0,"YXZ")),new I(k.size[0]*1.3+.1,1,k.size[2]*1.3+.1)))),g.instanceMatrix.needsUpdate=!0,g.computeBoundingSphere(),g.name="ao-blobs",g.renderOrder=1,g.userData.ownMaterial=!0,n.root.add(g)}if(t.caps.length){const c=new tt;c.name="caps";const m=new Map;for(const g of t.caps)a.has(g.level_id)&&m.set(g.level_id,[...m.get(g.level_id)??[],g]);for(const[g,k]of[...m].sort((M,x)=>M[0]<x[0]?-1:1)){const M=[],x=[];for(const j of k){const F=j.polygon;for(let O=1;O+1<F.length;O++)M.push(F[0][0],j.y,F[0][1],F[O+1][0],j.y,F[O+1][1],F[O][0],j.y,F[O][1]);for(let O=0;O<F.length;O++)x.push(F[O][0],j.y+.002,F[O][1],F[(O+1)%F.length][0],j.y+.002,F[(O+1)%F.length][1])}const $=new at;$.setAttribute("position",new et(M,3)),$.computeVertexNormals();const N=new ot({color:b.cut.cap,side:At}),G=new H($,N);G.name=`caps|${g}`,G.userData={level:g,ownMaterial:!0},c.add(G);const E=new at;E.setAttribute("position",new et(x,3));const D=new Fs(E,new Os({color:b.cut.edge??b.cut.cap,transparent:!0,opacity:.9}));D.name=`capedge|${g}`,D.userData={level:g,edge:!0,ownMaterial:!0},D.visible=b.cut.edge!==null,c.add(D)}n.caps=c,n.root.add(c)}return v.dispose(),n.stats.meshes+=n.root.children.length,n}function Fn(s,t,e,i,o){const n=new tt;n.name=s.id,n.position.set(s.position[0],s.position[1],s.position[2]),n.quaternion.setFromEuler(new Q(Z(s.rotation[0]),Z(s.rotation[1]),Z(s.rotation[2]),"YXZ"));const a=t.materials[s.id]??"door_wood",r=new H(_t(e.heavy?"box":"rbox",s.size,t.radius[s.id]??.006,1,ht.get(a)?.tile_m??1),a==="glass"?i.get("glass","glass",!0):i.get(a,"std",!0));if(r.castShadow=!0,r.receiveShadow=!0,r.name=`${s.id}|leaf`,n.add(r),o.lookup.set(r,[{id:s.id,kind:"door",userData:s.userData}]),!e.heavy){const l=new X().compose(n.position,n.quaternion,new I(1,1,1)).invert(),h=new js;for(const d of t.parts){if(d.owner!==s.id)continue;const p=_t(d.shape,d.size,d.radius??0,d.taper??1,.5);h.push(p,l.clone().multiply(lt(d.position,d.rotation)),{id:d.id,kind:"door",userData:d.userData}),p.dispose()}if(h.parts.length){const d=new H(h.geometry(.5),i.get("metal_light","std",!0));d.name=`${s.id}|metal`,d.castShadow=!0,o.lookup.set(d,h.parts),d.userData.ranges=Uint32Array.from(h.ranges),n.add(d)}}return o.root.add(n),n}function On(s,t,e){let i=e.bulbs.get(t);return i||(i=s.get("plastic","std",!0).clone(),i.color.setHex(15921128),i.emissive.setRGB(0,0,0),i.userData.ownMaterial=!0,e.bulbs.set(t,i)),i}function qn(s){return ge(s.polygon??[],0,s.size[1])}function Gn(s){const t=[],e=[],i=(n,a,r,l,h)=>{t.push(...n,...a,...r,...n,...r,...l),e.push(0,0,h,0,h,1,0,0,h,1,0,1)};for(const n of s){const[a,r,l]=n.size;if(a<.32)continue;const h=Z(n.rotation[1]),d=Math.cos(h),p=-Math.sin(h),u=-p,f=d,v=n.position[1]-r/2,w=a/.5;for(const y of[-1,1]){const b=n.position[0]+u*y*(l/2),A=n.position[2]+f*y*(l/2),S=[b-d*a/2,A-p*a/2],z=[b+d*a/2,A+p*a/2],c=u*y*.3,m=f*y*.3;i([S[0],v+.006,S[1]],[z[0],v+.006,z[1]],[z[0]+c,v+.006,z[1]+m],[S[0]+c,v+.006,S[1]+m],w);const g=.004;i([S[0]+u*y*g,v,S[1]+f*y*g],[z[0]+u*y*g,v,z[1]+f*y*g],[z[0]+u*y*g,v+.3,z[1]+f*y*g],[S[0]+u*y*g,v+.3,S[1]+f*y*g],w)}}if(!t.length)return null;const o=new at;return o.setAttribute("position",new et(t,3)),o.setAttribute("uv",new et(e,2)),o.computeVertexNormals(),o}function Un(s,t,e){const i=W[t],o=new tt;o.name="exterior";const n=(s.x0+s.x1)/2,a=(s.z0+s.z1)/2,r=s.x1-s.x0,l=s.z1-s.z0,h=Math.hypot(r,l)*.8+20,d=s.y0-.06,p=e?new mt({color:i.ground.disc,roughness:1,transparent:!0,alphaMap:Be(),depthWrite:!1}):new ot({color:i.ground.disc,transparent:!0,alphaMap:Be(),depthWrite:!1}),u=new H(new qs(2*h,2*h).rotateX(-Math.PI/2),p);u.position.set(n,d,a),u.receiveShadow=e,u.name="ground",u.renderOrder=-2;const f=new H(new gt(r+3,0,l+3),new ot({map:Bs(),color:0,transparent:!0,opacity:i.ground.contact,depthWrite:!1}));f.position.set(n,d+.01,a),f.name="ground-contact",f.renderOrder=-1;const v=new Vt(i.horizon.radius,i.horizon.radius,i.horizon.height,64,1,!0),w=new H(v,new ot({color:i.horizon.color,alphaMap:Cn(),transparent:!0,side:Oe,depthWrite:!1,fog:!1}));w.position.set(n,d+i.horizon.height/2,a),w.name="horizon",w.renderOrder=-3;const y=new Gs(400,32,16);y.setAttribute("color",new St(new Float32Array(y.getAttribute("position").count*3),3));const b=new H(y,new ot({vertexColors:!0,side:Oe,toneMapped:!1,fog:!1,depthWrite:!1}));b.frustumCulled=!1,b.renderOrder=-10,b.name="sky",b.position.set(n,0,a);const A=new we;A.add(new H(y,b.material));for(const S of[b,w,u,f])S.userData.ownMaterial=!0;for(const S of[b,w,u,f])S.userData.skipAO=!0;return o.add(b,w,u,f),{root:o,dome:b,domeScene:A,disc:u,contact:f,band:w}}function Hn(s,t,e,i){const o=W[i],n=s.dome.geometry,a=n.getAttribute("position"),r=n.getAttribute("color"),l=new I,h=new I(...e).normalize(),d=o.rig.skyScale,p=t.hemiGround.map(u=>(u*.9+.1)*o.backdrop.groundTint);for(let u=0;u<a.count;u++){l.fromBufferAttribute(a,u).normalize();let f;if(l.y<0)f=p;else{const y=Math.pow(l.y,.55);f=[0,1,2].map(b=>(t.skyHorizon[b]+(t.skyTop[b]-t.skyHorizon[b])*y)*d)}const v=Math.max(0,l.dot(h)),w=h.y>-.05?Math.pow(v,400)*.9+Math.pow(v,12)*.18*t.day:0;r.setXYZ(u,Math.min(1,f[0]+w*t.sunColor[0]),Math.min(1,f[1]+w*t.sunColor[1]),Math.min(1,f[2]+w*t.sunColor[2]))}r.needsUpdate=!0}function Wn(s,t){const e=W[t],i=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255],o=h=>`rgb(${h.map(d=>Math.round(Math.max(0,Math.min(1,d))*255)).join(", ")})`,n=(h,d)=>o(h.map((p,u)=>(p+d[u])/2)),a=s.night>.5,r=i(a?e.backdrop.topNight:e.backdrop.topDay),l=i(a?e.backdrop.horizonNight:e.backdrop.horizonDay);return[n(r,s.skyTop.map(h=>h*e.rig.skyScale)),n(l,s.skyHorizon.map(h=>h*e.rig.skyScale)),o(s.hemiGround.map(h=>h*e.backdrop.groundTint*.9+.08))]}function Ke(s){const[t,e,i]=ii(s);return new st(t,e,i)}const Xe=()=>Js;function Bn(s){s.traverse(t=>{const e=t;if(e.isMesh||t.isLineSegments){e.userData.shared||e.geometry?.dispose();const i=e.material;e.userData.ownMaterial&&i&&!Array.isArray(i)&&i.dispose()}})}const jn=350,Ks=650,Kn=.06,Xn=.6,ie=3e3,Ye=45,Lt=8,ve=2048,Ve={objectShadows:!0,lambertObjects:!1,shadowMapPx:ve,occlusion:!0},Qe={objectShadows:!1,lambertObjects:!0,shadowMapPx:1024,occlusion:!0},Ze=.28,Yn=64,Vn=6,Qn=.35,Zn=.88,Je=8,It=Math.PI/2-.02,Jn=new Set(["glow","cone","tint"]),to=new Set(["wall","lintel","sill","head","door","object","connector","camera"]),eo=new Set(["floor","wall","object","connector","room","tint","lintel","sill","head"]),so=new Set(["wall","lintel","sill","head","door","connector"]),be=new Set(["chip","entity"]),io=new Set(["wall","object","connector"]),no=.5,Dt=(()=>{const s=Math.hypot(-.6,1.1,-.25);return[-.6/s,1.1/s,-.25/s]})(),oo="map-wall-3d",ts="map-structure",es=.025,ss=16777215,is=15133682,ns=2.1,os=16774108,as=3,ao=1.12,rs=2767974,ls=857124,hs=.75,Rt=12570879,cs=.55,ro=.9,ds=2.6,us=9347276,lo=160,ho=100,U=s=>s*Math.PI/180;function ne(s){const t=new I(s.dir[0],Math.max(s.dir[1],-.2),s.dir[2]).normalize();return[t.x,t.y,t.z]}const ps=s=>s.kind==="object"&&Math.max(s.size[0],s.size[1],s.size[2])<Xn,oe=s=>s.kind==="floor"?"floor":s.color==="map-glass"?"glass":s.kind==="object"?"object":"std",Pt=(s,t)=>s.length===t.length&&s.every((e,i)=>e===t[i]),co=(s,t)=>{if(!s||!t)return s===t;if(s.length!==t.length)return!1;for(let e=0;e<s.length;e++)if(s[e][0]!==t[e][0]||s[e][1]!==t[e][1])return!1;return!0},uo=(s,t)=>s.id===t.id&&s.kind===t.kind&&s.shape===t.shape&&s.color===t.color&&s.group===t.group&&s.level_id===t.level_id&&s.text===t.text&&Pt(s.position,t.position)&&Pt(s.size,t.size)&&Pt(s.rotation,t.rotation)&&co(s.polygon,t.polygon)&&(s.opacity===t.opacity||s.kind==="tint"),po=(s,t)=>s.text===t.text&&s.color===t.color&&s.opacity===t.opacity&&Pt(s.position,t.position)&&Pt(s.size,t.size)&&s.userData.id===t.userData.id&&s.userData.kind===t.userData.kind;function fo(s,t){if(s===t||s.parts.length!==t.parts.length||s.levels.length!==t.levels.length||s.size[0]!==t.size[0]||s.size[1]!==t.size[1])return!1;for(let o=0;o<s.levels.length;o++){const n=s.levels[o],a=t.levels[o];if(n.id!==a.id||n.elevation_m!==a.elevation_m||n.ceiling_height_m!==a.ceiling_height_m)return!1}let e=!1,i=!1;for(let o=0;o<s.parts.length;o++){const n=s.parts[o],a=t.parts[o];if(be.has(n.kind)&&n.kind===a.kind&&n.id===a.id&&n.level_id===a.level_id&&n.shape===a.shape){po(n,a)||(e=i=!0);continue}if(!uo(n,a))return!1;n.opacity!==a.opacity&&(e=!0)}return i&&(s.real||t.real)&&JSON.stringify(s.real??null)!==JSON.stringify(t.real??null)?!1:e}function mo(){const s=[-.5,.5],t=[];for(const i of s)for(const o of s)t.push(-.5,i,o,.5,i,o),t.push(i,-.5,o,i,.5,o),t.push(i,o,-.5,i,o,.5);const e=new at;return e.setAttribute("position",new et(t,3)),e}function wo(){const t=document.createElement("canvas");t.width=64,t.height=64;const e=t.getContext("2d");if(e){const o=e.createImageData(64,64);for(let n=0;n<64;n++)for(let a=0;a<64;a++){const r=Math.abs((a+.5)/64-.5)*2,l=Math.abs((n+.5)/64-.5)*2,h=Math.max(r,l),d=Math.min(1,Math.max(0,(h-.5)/.5)),p=(1-d*d*(3-2*d))*.42,u=(n*64+a)*4;o.data[u+3]=Math.round(p*255)}e.putImageData(o,0,0)}const i=new Pe(t);return i.colorSpace=Xt,i}function go(s,t){const e=[];for(const r of s){const l=e[e.length-1];(!l||Math.hypot(r[0]-l[0],r[1]-l[1])>1e-6)&&e.push(r)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let i=0;for(let r=0;r<e.length;r++){const l=e[r],h=e[(r+1)%e.length];i+=l[0]*h[1]-h[0]*l[1]}if(Math.abs(i)<1e-8)return null;const o=Us.triangulateShape(e.map(([r,l])=>new wt(r,l)),[]),n=[];for(const[r,l,h]of o){const[d,p,u]=[e[r],e[l],e[h]];Math.abs((p[0]-d[0])*(u[1]-d[1])-(u[0]-d[0])*(p[1]-d[1]))<1e-10||(n.push(d[0],t,d[1],p[0],t,p[1],u[0],t,u[1]),n.push(d[0],0,d[1],u[0],0,u[1],p[0],0,p[1]))}for(let r=0;r<e.length;r++){const l=e[r],h=e[(r+1)%e.length];n.push(l[0],0,l[1],h[0],0,h[1],h[0],t,h[1],l[0],0,l[1],h[0],t,h[1],l[0],t,l[1])}const a=new at;return a.setAttribute("position",new et(n,3)),a.computeVertexNormals(),a}class Ae{constructor(t){this.opts=t,this.scene=new we,this.persp=new sn(50,1,.05,2e3),this.ortho=new qe(-1,1,1,-1,.05,4e3),this.active=this.persp,this.root=new tt,this.unitBox=new gt(1,1,1),this.unitCylinder=new Vt(.5,.5,1,24),this.unitPlane=new qs(1,1).rotateX(-Math.PI/2),this.boxEdges=mo(),this.materials=new Map,this.aoMaterial=null,this.raycaster=new nn,this.glowPool=[],this.lights=new tt,this.sun=null,this.lookup=new Map,this.placed=new Map,this.tints=new Map,this.cones=[],this.cutPlanes=null,this.builds=0,this.smallGroups=[],this.outline=null,this.desc=null,this.extent=null,this.selectedId=null,this.preset="iso",this.orthoFrame=null,this.cutAzimuth=null,this.cutNow=new Set,this.caps=null,this.night=!1,this.framed=!1,this.hideSmall=!1,this.heavy=!1,this.heavyOverride=null,this.disposed=!1,this.continuous=!1,this.paused=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.walking=null,this.realMats=null,this.realModels=null,this.realBuilt=null,this.exterior=null,this.post=null,this.postRung=null,this.postLoading=!1,this.pmrem=null,this.envTarget=null,this.envElevation=null,this.sunInput={utcMs:Date.now(),latitude:Te.latitude,longitude:Te.longitude},this.sunPos=null,this.recipe=ze(45),this.rig=null,this.clipPlane=new on(new I(0,-1,0),0),this.poolKey="",this.interior=null,this.anims=[],this.motion=!0,this.lastFrameInfo={calls:0,triangles:0},this.onRestored=()=>{this.markShadows(),this.invalidate()},this.realDprCap=oi,this.realRebuildTimer=0,this.builtModels=0,this.projSize=new wt,this.projV=new I,this.lastHitPoint=new I,this.onDown=i=>{i.isPrimary&&(this.pressed={x:i.clientX,y:i.clientY,id:i.pointerId})},this.onUp=i=>{const o=this.pressed;!o||i.pointerId!==o.id||(this.pressed=null,!(i.button!==0||Math.hypot(i.clientX-o.x,i.clientY-o.y)>Vn)&&this.opts.onSelect(this.pick(i.clientX,i.clientY),i.clientX,i.clientY))},this.onCancel=i=>{this.pressed?.id===i.pointerId&&(this.pressed=null)},this.onMove=i=>{if(this.pressed||i.pointerType==="touch"||!i.isPrimary)return;const o=this.pick(i.clientX,i.clientY),n=o?o.partId:null;if(n===this.lastHover)return;this.lastHover=n;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(o,i.clientX-a.left,i.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||this.paused||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const i=this.walking?this.stepFly():this.controls.update(),o=this.stepAnims(),n=this.stepInterior(),a=i||o||n;if(this.hideSmall){const h=this.walking?!0:this.active===this.ortho?this.ortho.top/(this.ortho.zoom||1)<Ye/2:this.persp.position.distanceTo(this.controls.target)<Ye;for(const d of this.smallGroups)d.visible!==h&&(d.visible=h,this.markShadows())}this.updateCutaway(),this.drawFrame(),this.opts.onDraw?.(),this.frames++;const r=performance.now();this.windowStart||(this.windowStart=r),this.windowFrames++,r-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(r-this.windowStart)),this.windowStart=r,this.windowFrames=0);const l=a||this.continuous;(!l||r-this.lastReport>=1e3)&&(this.lastReport=r,this.opts.onFrame(this.frames,this.fps)),l?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.interiorAt=0,this.quality=t.quality??1,this.night=!!t.night,this.real={...Tn,...t.real??{}},typeof t.dprCap=="number"&&Number.isFinite(t.dprCap)&&t.dprCap>0&&(this.realDprCap=t.dprCap),this.renderer=new an({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.basePixelRatio=t.pixelRatio??Math.min(2,window.devicePixelRatio||1),this.renderer.setPixelRatio(this.basePixelRatio),this.renderer.outputColorSpace=Xt,this.renderer.shadowMap.type=Ge,this.outlineMaterial=new Os({color:new st(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new rn(this.persp,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=It,this.controls.addEventListener("change",this.invalidate),this.scene.add(this.lights),this.applyQuality();for(let i=0;i<Lt;i++){const o=new ln(16777215,0,1,2);this.glowPool.push(o),this.scene.add(o)}this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.onRestored),this.resize()}get camera(){return this.active}getQuality(){return this.quality}config(){return this.heavyOverride??(this.heavy?Qe:Ve)}heavyConfig(){return{heavy:this.heavy,...this.config()}}setHeavyConfig(t){this.heavyOverride=t?{...this.heavy?Qe:Ve,...t}:null;for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.desc=null,this.setDescription(e),this.setSelected(i)}this.invalidate()}rendererInfo(){const t=this.renderer.getContext(),e=t.getExtension("WEBGL_debug_renderer_info");return{vendor:String(e?t.getParameter(e.UNMASKED_VENDOR_WEBGL):t.getParameter(t.VENDOR)),renderer:String(e?t.getParameter(e.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER))}}benchFrames(t=60){const e=this.renderer.getContext(),i=new Uint8Array(4);this.controls.update(),this.updateCutaway();const o=()=>{this.drawFrame(),e.readPixels(0,0,1,1,e.RGBA,e.UNSIGNED_BYTE,i)};o();const n=performance.now();for(let a=0;a<t;a++)o();return(performance.now()-n)/t}setNight(t){if(t!==this.night){this.night=t,this.applyQuality();for(const e of this.glowPool)e.intensity>0&&(e.intensity=Je*(t?ds:1));this.invalidate()}}getNight(){return this.night}setQuality(t){if(t!==this.quality){this.quality=t,this.applyQuality();for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.setDescription(e),this.setSelected(i)}this.invalidate()}}applyQuality(){for(const e of[...this.lights.children])this.lights.remove(e),(e instanceof K||e instanceof xt||e instanceof ut)&&e.dispose();this.sun=null,this.rig=null,this.cutAzimuth=null,this.cutNow.clear();const t=this.night;if(this.renderer.localClippingEnabled=this.quality===3,this.renderer.shadowMap.autoUpdate=!1,this.renderer.shadowMap.needsUpdate=!0,this.renderer.shadowMap.type=this.quality===3?hn:Ge,this.applyPixelRatio(),this.scene.environment=null,this.scene.fog=null,this.quality===3){this.applyRealRig();return}if(this.quality===2){this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=cn,this.renderer.toneMappingExposure=t?ro:ao,this.lights.add(t?new ut(rs,ls,hs):new ut(ss,is,ns));const e=t?new K(Rt,cs):new K(os,as);e.castShadow=!0,e.shadow.mapSize.set(ve,ve),e.shadow.bias=-4e-4,e.shadow.normalBias=.03,this.lights.add(e),this.lights.add(e.target),this.sun=e,this.fitSun()}else{this.renderer.shadowMap.enabled=!1,this.renderer.toneMapping=dn,this.renderer.toneMappingExposure=1,this.lights.add(t?new xt(us,.7):new xt(16777215,1.6));const e=t?new K(Rt,.5):new K(16777215,1.4);e.position.set(1,2,1.2),this.lights.add(e)}}applyPixelRatio(){const t=this.quality===3?this.real.rung:this.quality===2?"full":"schematic",e=ai(t,this.basePixelRatio,this.realDprCap);this.renderer.getPixelRatio()!==e&&this.renderer.setPixelRatio(e),this.quality===3&&this.post?.setPixelRatio(e)}fitSun(){const t=this.sun,e=this.extent;if(!t||!e)return;const i=(e.x0+e.x1)/2,o=(e.y0+e.y1)/2,n=(e.z0+e.z1)/2,a=Math.max(Math.hypot(e.x1-e.x0,e.y1-e.y0,e.z1-e.z0)/2,2)*1.05+(this.quality===3?4:0),r=this.quality===3&&this.sunPos?ne(this.sunPos):Dt;t.position.set(i+r[0]*a*2,o+r[1]*a*2,n+r[2]*a*2),t.target.position.set(i,o,n),t.target.updateMatrixWorld();const l=this.quality===3?this.real.rung==="realistic"&&!this.heavy?2048:1024:this.config().shadowMapPx;t.shadow.mapSize.x!==l&&(t.shadow.mapSize.set(l,l),t.shadow.map?.dispose(),t.shadow.map=null);const h=t.shadow.camera;h.left=-a,h.right=a,h.top=a,h.bottom=-a,h.near=.1,h.far=a*4,h.updateProjectionMatrix(),t.shadow.needsUpdate=!0,this.markShadows()}markShadows(){this.renderer.shadowMap.needsUpdate=!0}applyRealRig(){const t=W[this.real.style].rig;this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=un;const e=new ut(16777215,4478310,1),i=new K(16777215,3);i.castShadow=!0,i.shadow.bias=-4e-4,i.shadow.normalBias=.025,i.shadow.blurSamples=12,i.shadow.radius=this.real.rung==="realistic"?t.shadowRadius:3;const o=new K(12570879,0),n=new K(8177919,0);this.lights.add(e,i,i.target,o,n),this.sun=i,this.rig={hemi:e,sun:i,moon:o,rim:n},this.fitSun(),this.applyTime()}applyTime(){if(this.quality!==3||!this.rig)return;const t=W[this.real.style],e=t.rig,i=this.desc?.real?.north_deg??0,o=ri(this.sunInput.utcMs,this.sunInput.latitude,this.sunInput.longitude,i);this.sunPos=o;const n=ze(o.elevation);this.recipe=n;const{hemi:a,sun:r,moon:l,rim:h}=this.rig,d=this.interior?(e.interiorFill[0]+(e.interiorFill[1]-e.interiorFill[0])*this.interior.value)*.7:1;r.intensity=n.sunIntensity*.55*e.sunScale,r.color.setRGB(n.sunColor[0],n.sunColor[1],n.sunColor[2]),r.visible=o.elevation>-3,r.castShadow=o.elevation>-3,a.color.setRGB(n.hemiSky[0],n.hemiSky[1],n.hemiSky[2]),a.groundColor.setRGB(n.hemiGround[0],n.hemiGround[1],n.hemiGround[2]),a.intensity=n.hemiIntensity*e.hemiScale*d,l.intensity=n.moon*e.moonScale;const p=this.extent,u=p?new I((p.x0+p.x1)/2,0,(p.z0+p.z1)/2):new I,f=p?Math.hypot(p.x1-p.x0,p.z1-p.z0)+10:20;if(l.position.copy(u).add(new I(-f,f*.9,f*.4)),l.target=r.target,e.rim){const v=ne(o);h.color.setHex(e.rim.color),h.intensity=e.rim.intensity*(this.walking?.6:1),h.position.copy(u).addScaledVector(new I(-v[0],.5,-v[2]).normalize(),f),h.target=r.target}else h.intensity=0;if(this.renderer.toneMappingExposure=n.exposure*(e.exposureDay+(e.exposureNight-e.exposureDay)*n.night)*(this.walking?1.05:1),this.fitSun(),this.scene.environmentIntensity=(e.envNight+(e.envDay-e.envNight)*n.day)*d,this.walking){const v=e.fog,w=new st(v.color).multiplyScalar(1-n.night*.6);this.scene.fog=new pn(w.getHex(),v.density)}else this.scene.fog=null;if(this.exterior){Hn(this.exterior,n,ne(o),this.real.style),this.exterior.disc.material.color.setHex(t.ground.disc).lerp(new st(t.ground.discNight),n.night);const w=Math.round(o.elevation)*1e3+Math.round(o.azimuth/5);if(w!==this.envElevation){this.envElevation=w,this.pmrem??=new fn(this.renderer);const y=this.pmrem.fromScene(this.exterior.domeScene,0,1,1e3);this.envTarget?.dispose(),this.envTarget=y}this.scene.environment=this.envTarget?.texture??null}this.applyLamps(),this.post?.setLook(this.real.style,n.night),this.renderer.shadowMap.needsUpdate=!0,this.invalidate()}applyLamps(){if(this.quality!==3)return;const t=this.desc?.real,e=W[this.real.style].rig,i=this.recipe.night,o=(t?.lamps??[]).map(l=>({...l}));for(const l of this.desc?.parts??[])l.kind==="glow"&&l.userData.kind==="entity"&&o.push({id:l.id,owner:l.id,level_id:l.level_id??"",position:l.position,kind:"ceiling",color_k:3e3,lumens:800,on:!0});for(const[l,h]of this.realBuilt?.bulbs??[]){const d=o.find(p=>p.id===`lamp:${l}`);d?.on?(h.emissive.copy(Ke(d.color_k)),h.emissiveIntensity=e.lampEmissiveDay+(e.lampEmissiveNight-e.lampEmissiveDay)*i):h.emissiveIntensity=0}const n=this.active.position,a=$e(o,[n.x,n.y,n.z],Lt);this.poolKey=a.map(l=>l.id).join(",");const r=e.lampPoolDay+(e.lampPoolNight-e.lampPoolDay)*i;this.glowPool.forEach((l,h)=>{const d=a[h];if(!d){l.intensity=0;return}const p=d.kind==="floor"?6:d.kind==="wall"?5:11;l.color.copy(Ke(d.color_k)),l.intensity=p*r*Math.min(2,Math.max(.4,Math.sqrt(d.lumens/1200))),l.distance=0,l.decay=2;const u=d.kind==="floor"||d.kind==="wall"?.05:d.kind==="pendant"?.25:.45;l.position.set(d.position[0],d.position[1]-u,d.position[2])})}applyCut(){if(this.quality!==3||!this.realMats)return;const t=this.desc,e=t&&t.levels.length?[...t.levels].sort((a,r)=>r.elevation_m-a.elevation_m||(a.id<r.id?-1:1))[0]:null,i=!!e&&this.real.sectionCut&&!this.walking&&typeof this.preset=="string",o=e?e.elevation_m+e.ceiling_height_m*.6:0;this.clipPlane.constant=o,this.realMats.setClip(i?[this.clipPlane]:null);for(const a of this.cones)Array.isArray(a.material)||(a.material.clippingPlanes=i?[this.clipPlane]:null);this.cutPlanes=i?[this.clipPlane]:null,this.post?.setClip(this.cutPlanes);const n=this.realBuilt?.caps;if(n)for(const a of n.children)a.visible=i&&a.userData.level===e.id&&(!a.userData.edge||W[this.real.style].cut.edge!==null);this.renderer.shadowMap.needsUpdate=!0}setRealSettings(t){const e=this.real,{dprCap:i,motion:o,...n}=t;typeof o=="boolean"&&(this.motion=o);const a=typeof i=="number"&&Number.isFinite(i)&&i>0&&i!==this.realDprCap;if(a&&(this.realDprCap=i),this.real={...this.real,...n},this.quality!==3)return;const r=e.rung!==this.real.rung||e.furniture!==this.real.furniture||e.textures!==this.real.textures;if(e.style!==this.real.style){this.realMats?.setStyle(this.real.style);const l=W[this.real.style];this.exterior&&(this.exterior.band.material.color.setHex(l.horizon.color),this.exterior.contact.material.opacity=l.ground.contact);for(const h of this.realBuilt?.caps?.children??[]){const d=h.material;h.userData.edge?d.color.setHex(l.cut.edge??l.cut.cap):d.color.setHex(l.cut.cap)}this.envElevation=null,this.recolour(),r||this.applyTime()}r?(this.realMats?.setRung(this.real.rung),this.realMats?.setSource(this.real.textures),this.applyQuality(),this.rebuildNow()):(this.applyCut(),a&&this.applyPixelRatio()),this.invalidate()}getRealSettings(){return{...this.real}}setSun(t){this.sunInput={...this.sunInput,...t},this.applyTime()}sunState(){return this.sunPos?{elevation:this.sunPos.elevation,azimuth:this.sunPos.azimuth,night:this.recipe.night,day:this.recipe.day}:null}skyBackdrop(){return Wn(this.recipe,this.real.style)}setInterior(t){t===null?this.interior=null:this.interior={target:t,value:this.interior?.value??t},this.applyTime()}get realPending(){return(this.realMats?.pending??0)+(this.realModels?.pending??0)+(this.postLoading?1:0)}get postPasses(){return this.post?.passes??[]}get postClip(){return this.post?.clip?.map(t=>Math.round(t.constant*1e3)/1e3)??null}get realStats(){return this.realBuilt?.stats??null}ensurePost(){if(this.quality!==3||this.postLoading||this.post&&this.postRung===this.real.rung)return;this.post?.dispose(),this.post=null,this.postLoading=!0;const t=this.real.rung;li(async()=>{const{PostChain:e}=await import("./post-chain-x3OIPzsn.js");return{PostChain:e}},__vite__mapDeps([0]),import.meta.url).then(({PostChain:e})=>{if(this.disposed||this.quality!==3||this.real.rung!==t)return;const i=this.opts.mount.clientWidth||1,o=this.opts.mount.clientHeight||1;this.post=new e(this.renderer,this.scene,this.active,t,i,o,this.real.style),this.post.setLook(this.real.style,this.recipe.night),this.post.setClip(this.cutPlanes),this.postRung=t}).catch(e=>console.warn("sw-plan-3d: post chain failed to load, drawing without it",e)).finally(()=>{this.postLoading=!1,this.opts.onAsset?.(),this.invalidate()})}rebuildNow(){if(!this.desc)return;const t=this.desc,e=this.selectedId;this.desc=null,this.setDescription(t),this.setSelected(e)}stateOf(t){return this.quality!==3?null:t==="danger"?"open_door":t==="map-presence"?"presence":null}material(t,e,i=!1,o="std"){const n=this.quality>=2&&o==="object"&&this.config().lambertObjects,a=this.stateOf(t),r=`${t}|${e}|${i?2:1}|${this.quality>=2?n?"object-lambert":o:"l1"}${a?`|s3:${this.real.style}`:""}`;let l=this.materials.get(r);if(!l){const h=i?{side:At,forceSinglePass:!0}:{},d=this.quality>=2&&t===ts&&o==="std"?oo:t,p=a?new st(W[this.real.style].states[a]):new st(this.opts.color(d));let u;this.quality>=2&&o==="glass"?u=new mt({color:p,roughness:.12,metalness:.25,transparent:!0,opacity:Math.max(e,.35),depthWrite:!1,side:At,forceSinglePass:!0}):a==="open_door"?u=new mt({color:p,emissive:p,emissiveIntensity:.9,roughness:.6,metalness:0,...h}):this.quality>=2&&!n?u=new mt({color:p,roughness:o==="floor"?1:.88,metalness:0,transparent:e<1,opacity:e,depthWrite:e>=1,...h}):u=new mn({color:p,transparent:e<1,opacity:e,depthWrite:e>=1,...h}),l={token:d,material:u,state:a},this.materials.set(r,l)}return l.material}recolour(){for(const{token:t,material:e,state:i}of this.materials.values())i?(e.color.set(W[this.real.style].states[i]),"emissive"in e&&e.emissiveIntensity>0&&e.emissive.copy(e.color)):e.color.set(this.opts.color(t));for(const t of this.tints.values()){const e=t.userData.state;e&&!Array.isArray(t.material)&&t.material.color.set(W[this.real.style].states[e])}this.outlineMaterial.color.set(this.opts.color("accent"))}statePart(t){return t.kind!=="tint"?t:t.id.endsWith("#lit")?null:t.id.endsWith("#presence-ring")?{...t,opacity:Math.round(t.opacity*.45*1e4)/1e4}:t.id.endsWith("#presence")?{...t,opacity:Math.round(t.opacity*.35*1e4)/1e4}:t}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new Q(U(e.rotation[0]),U(e.rotation[1]),U(e.rotation[2]),"YXZ"))}plateOpacity(t,e=this.desc){const i=e?.levels??[];if(t.kind!=="floor"||i.length<2)return t.opacity;const o=Math.min(...i.map(a=>a.elevation_m)),n=i.find(a=>a.id===t.level_id);return n&&n.elevation_m>o?Math.min(t.opacity,Qn):t.opacity}shadows(t,e){if(this.quality<2)return;const i=this.config().objectShadows;t.castShadow=(i?to:so).has(e.kind)&&e.color!=="map-glass",t.receiveShadow=eo.has(e.kind)&&(i||e.kind!=="object")}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const i=e.getContext("2d");i&&(i.globalAlpha=Zn,i.fillStyle=this.opts.color("surface"),i.beginPath(),i.roundRect(8,16,496,96,48),i.fill(),i.globalAlpha=1,i.fillStyle=this.opts.color(t.color),i.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',i.textAlign="center",i.textBaseline="middle",i.direction="rtl",i.fillText(t.text??"",256,66,480));const o=new Pe(e);o.colorSpace=Xt;const n=new Ue(new wn({map:o,transparent:!0,depthTest:!0}));return n.position.set(t.position[0],t.position[1],t.position[2]),n.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),n}single(t,e){if(t.shape==="box"||t.shape==="cylinder"){const i=new H(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t,e),!1,oe(t)));return this.transform(i,t),i.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),this.shadows(i,t),i}if(t.shape==="prism"){const i=go(t.polygon??[],t.size[1]);if(!i)return null;const o=this.material(t.color,t.opacity,!0,oe(t)),n=t.kind==="tint"||t.kind==="cone"?o.clone():o,a=new H(i,n);return t.kind==="tint"?(a.userData.ownMaterial=!0,a.userData.state=this.stateOf(t.color)):t.kind==="cone"&&(a.userData.ownMaterial=!0,a.userData.cone=!0),a.position.set(t.position[0],t.position[1],t.position[2]),this.shadows(a,t),a}return be.has(t.kind)?null:t.shape==="sprite"?this.label(t):null}occlusion(t,e){if(this.quality!==2||!this.config().occlusion)return null;const i=new Map(e.levels.map(u=>[u.id,u.elevation_m])),o=e.levels.length?Math.min(...e.levels.map(u=>u.elevation_m)):0,n=t.filter(u=>io.has(u.kind)&&(u.shape==="box"||u.shape==="cylinder")&&u.position[1]-u.size[1]/2<=(i.get(u.level_id??"")??o)+no);if(!n.length)return null;this.aoMaterial||(this.aoMaterial=new ot({map:wo(),color:0,transparent:!0,depthWrite:!1}));const a=new it(this.unitPlane,this.aoMaterial,n.length),r=new X,l=new nt,h=new Q,d=new I,p=new I;return n.forEach((u,f)=>{l.setFromEuler(h.set(0,U(u.rotation[1]),0,"YXZ")),d.set(u.position[0],u.position[1]-u.size[1]/2+.012,u.position[2]),p.set(u.size[0]+2*Ze,1,u.size[2]+2*Ze),r.compose(d,l,p),a.setMatrixAt(f,r)}),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),a.name="ao",a.renderOrder=1,a}realise(t,e,i=!1){const o={root:new tt,lookup:new Map,small:[],placed:new Map,glows:[],ao:null,real:null},n=new Map,a=[];if(this.quality===3&&!i&&e.real){this.realMats??=new In(this.opts.assetBase??Xe(),()=>this.onRealAsset()),this.realModels??=new Dn(this.opts.assetBase??Xe(),()=>this.onRealAsset()),this.realMats.setStyle(this.real.style),this.realMats.setRung(this.real.rung),this.realMats.setSource(this.real.textures);const u=Nn({desc:e,real:e.real,parts:t,settings:this.real,heavy:e.parts.length>ie,mats:this.realMats,models:this.realModels});o.real=u,o.root.add(u.root);for(const[f,v]of u.lookup)o.lookup.set(f,v);t=t.filter(f=>!Ws.has(f.kind)).map(f=>this.statePart(f)).filter(f=>f!==null)}for(const u of t)if(u.group&&(u.shape==="box"||u.shape==="cylinder")){const f=n.get(u.group);f?f.push(u):n.set(u.group,[u])}else a.push(u);const r=new X,l=new nt,h=new I,d=new I,p=new Q;for(const[u,f]of n){const v=f[0],w=new it(v.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(v.color,v.opacity,!1,oe(v)),f.length);f.forEach((y,b)=>{l.setFromEuler(p.set(U(y.rotation[0]),U(y.rotation[1]),U(y.rotation[2]),"YXZ")),h.set(y.position[0],y.position[1],y.position[2]),d.set(Math.max(y.size[0],.001),Math.max(y.size[1],.001),Math.max(y.size[2],.001)),r.compose(h,l,d),w.setMatrixAt(b,r),o.placed.set(y.id,{obj:w,index:b,part:y})}),w.instanceMatrix.needsUpdate=!0,w.computeBoundingSphere(),w.name=u,this.shadows(w,v),o.lookup.set(w,f),o.root.add(w),f.every(ps)&&o.small.push(w)}for(const u of a){if(u.shape==="light"){o.glows.push(u);continue}const f=this.single(u,e);f&&(f.name=u.id,Jn.has(u.kind)||o.lookup.set(f,[u]),f instanceof H&&(u.shape==="box"||u.shape==="cylinder")&&o.placed.set(u.id,{obj:f,index:0,part:u}),o.root.add(f),ps(u)&&o.small.push(f))}return o.ao=this.occlusion(t,e),o.ao&&o.root.add(o.ao),o}disposeGroup(t){for(const e of[...t.children]){if(t.remove(e),e.name==="real"||e.name==="exterior"){Bn(e);continue}e instanceof it?e.dispose():e instanceof H&&e.geometry!==this.unitBox&&e.geometry!==this.unitCylinder&&e.geometry.dispose(),e instanceof H&&e.userData.ownMaterial&&!Array.isArray(e.material)&&e.material.dispose(),e instanceof Ue&&(e.material.map?.dispose(),e.material.dispose())}}clear(){this.setSelected(null),this.disposeGroup(this.root);for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.placed.clear(),this.tints.clear(),this.cones=[],this.smallGroups=[],this.cutAzimuth=null,this.cutNow.clear(),this.caps=null,this.realBuilt=null,this.exterior=null,this.envElevation=null}onRealAsset(){this.invalidate();const t=this.realModels?.version??0;this.quality===3&&t!==this.builtModels&&!this.realRebuildTimer&&(this.realRebuildTimer=window.setTimeout(()=>{this.realRebuildTimer=0,!this.disposed&&this.quality===3&&this.rebuildNow()},30)),this.opts.onAsset?.()}setDescription(t){if(this.desc&&fo(this.desc,t)){for(const n of t.parts){if(n.kind!=="tint")continue;const a=this.quality===3&&t.real?this.statePart(n):n,r=this.tints.get(n.id);a&&r&&!Array.isArray(r.material)&&(r.material.opacity=a.opacity)}this.desc=t,this.invalidate();return}const e=new Map;for(const[n,a]of this.realBuilt?.leaves??[])e.set(n,{p:a.position.clone(),q:a.quaternion.clone(),sy:a.scale.y});for(const[n,a]of this.realBuilt?.shutters??[])e.set(n,{p:a.mesh.position.clone(),q:a.mesh.quaternion.clone(),sy:a.mesh.scale.y});this.anims=[],this.clear(),this.markShadows(),this.recolour(),this.desc=t,this.extent=hi(t),this.heavy=t.parts.length>ie,this.builds++,this.builtModels=this.realModels?.version??0;const i=this.realise(t.parts,t);if(this.realBuilt=i.real,i.real&&this.extent){this.exterior=Un(this.extent,this.real.style,this.real.rung==="realistic"),this.root.add(this.exterior.root);const n=performance.now(),a=(r,l)=>{const h=e.get(r);if(!h||!this.motion)return;const d={p:l.position.clone(),q:l.quaternion.clone(),sy:l.scale.y};h.p.distanceTo(d.p)<1e-4&&h.q.angleTo(d.q)<1e-4&&Math.abs(h.sy-d.sy)<1e-4||(l.position.copy(h.p),l.quaternion.copy(h.q),l.scale.y=h.sy,l.visible=!0,this.anims.push({obj:l,from:h,to:d,t0:n,ms:jn}))};for(const[r,l]of i.real.leaves)a(r,l);for(const[r,l]of i.real.shutters)a(r,l.mesh)}for(const n of[...i.root.children])this.root.add(n),n instanceof H&&n.userData.cone?this.cones.push(n):n instanceof H&&n.userData.ownMaterial&&this.tints.set(n.name,n);this.lookup=i.lookup,this.placed=i.placed,this.smallGroups=i.small;let o=0;for(const n of i.glows){const a=this.glowPool[o++];a&&(a.color.set(this.opts.color(n.color)),a.intensity=Je*(this.night?ds:1),a.distance=Math.max(n.size[0],1),a.position.set(n.position[0],n.position[1],n.position[2]))}if(this.hideSmall=t.parts.length>ie,!this.hideSmall)for(const n of this.smallGroups)n.visible=!0;this.fitSun(),this.framed||(this.framed=this.setPreset("iso")),this.updateCutaway(),this.quality===3&&(this.ensurePost(),this.applyCut(),this.applyTime()),this.invalidate()}stepAnims(){if(!this.anims.length)return!1;const t=performance.now();return this.anims=this.anims.filter(e=>{const i=Math.min(1,(t-e.t0)/e.ms),o=i<.5?2*i*i:1-Math.pow(-2*i+2,2)/2;return e.obj.position.lerpVectors(e.from.p,e.to.p,o),e.obj.quaternion.slerpQuaternions(e.from.q,e.to.q,o),e.obj.scale.y=e.from.sy+(e.to.sy-e.from.sy)*o,i>=1&&e.to.sy<=.001&&e.obj.name.startsWith("shutter:")&&(e.obj.visible=!1),i<1}),this.renderer.shadowMap.needsUpdate=!0,this.anims.length>0}setSelected(t){if(this.selectedId=t,this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(n=>n.userData.id===t&&n.kind!=="cone"&&n.kind!=="floor"&&n.kind!=="tint"&&!be.has(n.kind)&&(n.shape==="box"||n.shape==="cylinder"||n.shape==="prism"||n.shape==="sprite")).slice(0,Yn);if(!e.length)return;const i=new tt,o=new Map(this.desc.levels.map(n=>[n.id,n.elevation_m]));for(const n of e){const a=new Fs(this.boxEdges,this.outlineMaterial),r=this.cutNow.has(n.id)?Le(n,o.get(n.level_id??"")??0,te):{y:n.position[1],h:n.size[1]};if(r){if(n.shape==="prism"){const l=n.polygon??[];if(!l.length)continue;const h=l.map(f=>f[0]),d=l.map(f=>f[1]),p=Math.max(...h)-Math.min(...h),u=Math.max(...d)-Math.min(...d);a.position.set(n.position[0]+(Math.max(...h)+Math.min(...h))/2,n.position[1]+n.size[1]/2,n.position[2]+(Math.max(...d)+Math.min(...d))/2),a.scale.set(p*1.04+.05,n.size[1]*1.04+.05,u*1.04+.05)}else this.transform(a,n),a.position.y=r.y,a.scale.set(n.size[0]*1.06+.05,r.h*1.06+.05,(n.shape==="sprite"?.1:n.size[2])*1.06+.05);a.renderOrder=10,i.add(a)}}this.outline=i,this.root.add(i),this.invalidate()}useCamera(t){t!==this.active&&(this.active=t,this.controls.object=t)}applyOrthoFrame(){const t=this.orthoFrame;if(!t)return;const e=this.persp.aspect||1;let i=t.halfW,o=t.halfH;i/o<e?i=o*e:o=i/e,this.ortho.left=-i,this.ortho.right=i,this.ortho.top=o,this.ortho.bottom=-o,this.ortho.updateProjectionMatrix()}setPreset(t){const e=this.desc,i=this.extent;if(!e||!i)return!1;if(this.walking)return typeof t!="string"&&!e.parts.some(d=>d.id===t.camera&&d.kind==="camera")?!1:(this.walking.prevPreset=t,!0);const o=(i.x0+i.x1)/2,n=(i.z0+i.z1)/2,a=i.x1-i.x0,r=i.z1-i.z0,l=(d,p)=>Math.max(p,d/(this.persp.aspect||1),4)/(2*Math.tan(U(this.persp.fov/2))),h=Math.max(0,...e.levels.map(d=>d.elevation_m+d.ceiling_height_m));if(t==="top")this.useCamera(this.persp),this.controls.maxPolarAngle=It,this.persp.position.set(o,h+l(a,r)*1.2,n+.001),this.controls.target.set(o,0,n);else if(t==="iso"){this.useCamera(this.ortho),this.controls.maxPolarAngle=It;const d=Ie(i,this.persp.aspect||1);this.orthoFrame=d,this.ortho.zoom=1,this.applyOrthoFrame(),this.ortho.position.set(d.target[0]+dt[0]*d.dist,d.target[1]+dt[1]*d.dist,d.target[2]+dt[2]*d.dist),this.controls.target.set(d.target[0],d.target[1],d.target[2])}else if(t==="persp"){this.useCamera(this.persp),this.controls.maxPolarAngle=It;const d=Math.hypot(a,r),p=l(d,d*.62)*1.45;this.persp.position.set(o+Jt[0]*p,Jt[1]*p,n+Jt[2]*p),this.controls.target.set(o,0,n)}else{const d=e.parts.find(u=>u.id===t.camera&&u.kind==="camera");if(!d)return!1;this.useCamera(this.persp);const p=new I(0,0,-1).applyEuler(new Q(U(d.rotation[0]),U(d.rotation[1]),U(d.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.persp.position.set(d.position[0],d.position[1],d.position[2]),this.controls.target.set(d.position[0]+p.x*6,d.position[1]+p.y*6,d.position[2]+p.z*6)}return this.preset=t,this.controls.update(),this.updateCutaway(),this.applyCut(),this.invalidate(),!0}walkQuaternion(t){return new nt().setFromEuler(new Q(U(t.pitch_deg),-U(t.heading_deg),0,"YXZ"))}enterWalk(t,e,i=Ks){const o=this.active.position.clone(),n=this.active.quaternion.clone();this.walking||(this.walking={prevPreset:this.preset,fov:e,fly:null}),this.walking.fov=e,this.useCamera(this.persp),this.controls.enabled=!1,this.persp.fov=e,this.persp.near=Kn,this.persp.updateProjectionMatrix();const a=new I(t.x,t.y,t.z),r=this.walkQuaternion(t);this.walking.fly=i>0?{from:o,fromQ:n,to:a,toQ:r,t0:performance.now(),ms:i}:null,this.walking.fly||(this.persp.position.copy(a),this.persp.quaternion.copy(r)),this.updateCutaway(),this.applyCut(),this.applyTime(),this.invalidate()}setWalkPose(t){if(!this.walking)return;const e=this.walking.fly;e?(e.to.set(t.x,t.y,t.z),e.toQ.copy(this.walkQuaternion(t))):(this.persp.position.set(t.x,t.y,t.z),this.persp.quaternion.copy(this.walkQuaternion(t))),this.invalidate()}setWalkFov(t){this.walking&&(this.walking.fov=t,this.persp.fov=t,this.persp.updateProjectionMatrix(),this.invalidate())}exitWalk(){const t=this.walking;t&&(this.walking=null,this.controls.enabled=!0,this.persp.fov=50,this.persp.near=.05,this.persp.updateProjectionMatrix(),this.cutAzimuth=Number.NaN,this.interior=null,this.setPreset(t.prevPreset)||this.setPreset("iso"),this.applyTime())}get isWalking(){return this.walking!==null}floorPoint(t,e,i){const o=this.renderer.domElement.getBoundingClientRect();if(!o.width||!o.height)return null;this.active.updateMatrixWorld(),this.raycaster.setFromCamera(new wt((t-o.left)/o.width*2-1,-((e-o.top)/o.height)*2+1),this.active);const{origin:n,direction:a}=this.raycaster.ray;if(Math.abs(a.y)<1e-6)return null;const r=(i-n.y)/a.y;return!(r>0)||r>500?null:[n.x+a.x*r,n.z+a.z*r]}pickCentre(t=1/0){const e=this.renderer.domElement.getBoundingClientRect();return this.pick(e.left+e.width/2,e.top+e.height/2,t)}pickAt(t,e,i=1/0){const o=this.pick(t,e,i);return o?{...o,point:[this.lastHitPoint.x,this.lastHitPoint.y,this.lastHitPoint.z]}:null}projectPoint(t){this.active.updateMatrixWorld();const e=new I(t[0],t[1],t[2]).project(this.active);if(e.z>1)return null;const i=this.opts.mount.clientWidth,o=this.opts.mount.clientHeight;return{x:(e.x+1)/2*i,y:(1-e.y)/2*o}}projectPoints(t){this.active.updateMatrixWorld(),this.renderer.getSize(this.projSize);const e=this.projSize.x,i=this.projSize.y,o=this.projV;return t.map(n=>(o.set(n[0],n[1],n[2]).project(this.active),o.z>1?null:{x:(o.x+1)/2*e,y:(1-o.y)/2*i}))}wantedCutAzimuth(){const t=this.extent;if(this.walking||this.quality!==2||!t||typeof this.preset!="string")return null;const e=this.active.position;if(e.y<=t.y1)return null;const i=(t.x0+t.x1)/2,o=(t.z0+t.z1)/2;return Math.hypot(e.x-i,e.z-o)<.5?null:ci(di(e.x,e.z,i,o))}writeBox(t,e,i){const o=t.part,n=new nt().setFromEuler(new Q(U(o.rotation[0]),U(o.rotation[1]),U(o.rotation[2]),"YXZ")),a=i<=0,r=new I(o.position[0],e,o.position[2]),l=a?new I(1e-4,1e-4,1e-4):new I(Math.max(o.size[0],.001),Math.max(i,.001),Math.max(o.size[2],.001));t.obj instanceof it?(t.obj.setMatrixAt(t.index,new X().compose(r,n,l)),t.obj.instanceMatrix.needsUpdate=!0):(t.obj.position.copy(r),t.obj.scale.copy(l))}updateCutaway(){const t=this.wantedCutAzimuth();if(t===this.cutAzimuth)return;this.cutAzimuth=t;const e=this.desc;if(!e||!this.extent)return;const i=new Set(t===null?[]:ui(e,t,this.extent)),o=new Map(e.levels.map(n=>[n.id,n.elevation_m]));for(const n of this.cutNow){if(i.has(n))continue;const a=this.placed.get(n);a&&this.writeBox(a,a.part.position[1],a.part.size[1])}for(const n of i){if(this.cutNow.has(n))continue;const a=this.placed.get(n);if(!a)continue;const r=Le(a.part,o.get(a.part.level_id??"")??0,te);r?this.writeBox(a,r.y,r.h):this.writeBox(a,(o.get(a.part.level_id??"")??0)-1,0)}this.cutNow=i,this.rebuildCaps(o),this.sun&&(this.sun.shadow.needsUpdate=!0),this.markShadows(),this.selectedId&&this.setSelected(this.selectedId)}rebuildCaps(t){this.caps&&(this.root.remove(this.caps),this.caps.dispose(),this.caps=null);const e=[...this.cutNow].sort().map(r=>this.placed.get(r)).filter(r=>!!r&&r.part.kind==="wall");if(!e.length||this.quality!==2)return;const i=new it(this.unitBox,this.material(ts,1,!1,"floor"),e.length),o=new X,n=new nt,a=new Q;e.forEach((r,l)=>{const h=r.part,d=(t.get(h.level_id??"")??0)+te;n.setFromEuler(a.set(U(h.rotation[0]),U(h.rotation[1]),U(h.rotation[2]),"YXZ")),o.compose(new I(h.position[0],d+es/2-.004,h.position[2]),n,new I(h.size[0]+.004,es,h.size[2]+.004)),i.setMatrixAt(l,o)}),i.instanceMatrix.needsUpdate=!0,i.computeBoundingSphere(),i.name="caps",i.castShadow=!0,this.caps=i,this.root.add(i)}cutawayNow(){return[...this.cutNow].sort()}get buildCount(){return this.builds}pick(t,e,i=1/0){const o=this.renderer.domElement.getBoundingClientRect();if(!o.width||!o.height)return null;this.raycaster.setFromCamera(new wt((t-o.left)/o.width*2-1,-((e-o.top)/o.height)*2+1),this.active);const n=[...this.lookup.keys()].filter(a=>a.visible);for(const a of this.raycaster.intersectObjects(n,!1)){if(a.distance>i)return null;const r=this.lookup.get(a.object);if(!r)continue;const l=a.object.userData.ranges;let h=a.instanceId??0;if(l&&a.instanceId===void 0&&a.faceIndex!==void 0&&a.faceIndex!==null){let p=0,u=l.length-1;for(;p<u;){const f=p+u+1>>1;l[f]<=a.faceIndex?p=f:u=f-1}h=p}const d=r[h];if(d){if(d.kind==="floor"){if(this.plateOpacity(d)<1)continue;return null}return this.lastHitPoint.copy(a.point),{id:d.userData.id,kind:d.userData.kind,partId:d.id}}}return null}setPaused(t){this.disposed||t===this.paused||(this.paused=t,t?(cancelAnimationFrame(this.raf),this.raf=0,this.windowStart=0,this.windowFrames=0):this.invalidate())}get isPaused(){return this.paused}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.post?.setSize(t,e),this.persp.aspect=t/e,this.persp.updateProjectionMatrix(),this.applyOrthoFrame(),this.invalidate()}drawFrame(){if(this.quality===3){const t=this.active.position,e=this.desc?.real?.lamps??[];e.length>Lt&&$e(e,[t.x,t.y,t.z],Lt).map(i=>i.id).join(",")!==this.poolKey&&this.applyLamps(),this.renderer.info.reset(),this.renderer.info.autoReset=!1,this.post?(this.post.setCamera(this.active),this.post.draw()):this.renderer.render(this.scene,this.active),this.lastFrameInfo={calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles},this.renderer.info.autoReset=!0;return}this.renderer.render(this.scene,this.active)}stepInterior(){const t=this.interior;if(!t||this.quality!==3)return!1;const e=performance.now(),i=this.interiorAt?Math.min(.1,(e-this.interiorAt)/1e3):.016;if(this.interiorAt=e,Math.abs(t.target-t.value)<.01)return this.interiorAt=0,!1;t.value+=(t.target-t.value)*Math.min(1,i*3);const o=W[this.real.style].rig,n=(o.interiorFill[0]+(o.interiorFill[1]-o.interiorFill[0])*t.value)*.7;return this.rig&&(this.rig.hemi.intensity=this.recipe.hemiIntensity*o.hemiScale*n),this.scene.environmentIntensity=(o.envNight+(o.envDay-o.envNight)*this.recipe.day)*n,!0}stepFly(){const t=this.walking?.fly;if(!t)return!1;const e=Math.min(1,(performance.now()-t.t0)/t.ms),i=e<.5?2*e*e:1-Math.pow(-2*e+2,2)/2;return this.persp.position.lerpVectors(t.from,t.to,i),this.persp.quaternion.slerpQuaternions(t.fromQ,t.toQ,i),e>=1&&this.walking&&(this.walking.fly=null),e<1}redrawNow(){this.disposed||this.paused||(cancelAnimationFrame(this.raf),this.raf=0,this.frame())}capture(){return this.walking||this.controls.update(),this.updateCutaway(),this.drawFrame(),this.renderer.domElement.toDataURL("image/png")}renderThumbnail(t,e,i=lo,o=ho){const n=t.parts.filter(b=>b.level_id===e&&b.kind!=="cone"&&b.shape!=="sprite"&&b.shape!=="light");if(!t.levels.some(b=>b.id===e))return null;const a={...t,levels:t.levels.filter(b=>b.id===e),parts:n},r=this.realise(n,a,!0),l=new we;if(l.add(r.root),this.quality>=2){l.add(this.night?new ut(rs,ls,hs):new ut(ss,is,ns));const b=this.night?new K(Rt,cs):new K(os,as);b.position.set(Dt[0]*50,Dt[1]*50,Dt[2]*50),l.add(b)}else{l.add(this.night?new xt(us,.7):new xt(16777215,1.6));const b=this.night?new K(Rt,.5):new K(16777215,1.4);b.position.set(1,2,1.2),l.add(b)}const h=this.renderer.domElement,d=this.renderer.getPixelRatio(),{w:p,h:u}=pi(i,o,h.width/d,h.height/d);if(p<8||u<8)return this.disposeGroup(r.root),null;const f=Ie(fi(t,e),p/u),v=new qe(-f.halfW,f.halfW,f.halfH,-f.halfH,.05,4e3);v.position.set(f.target[0]+dt[0]*f.dist,f.target[1]+dt[1]*f.dist,f.target[2]+dt[2]*f.dist),v.lookAt(f.target[0],f.target[1],f.target[2]),v.updateProjectionMatrix();let w=null;const y=this.renderer.shadowMap.enabled;try{this.renderer.shadowMap.enabled=!1,this.renderer.setScissorTest(!0),this.renderer.setScissor(0,0,p,u),this.renderer.setViewport(0,0,p,u),this.renderer.render(l,v);const b=document.createElement("canvas");b.width=p,b.height=u;const A=b.getContext("2d");A&&(A.drawImage(h,0,h.height-u*d,p*d,u*d,0,0,p,u),w=b.toDataURL("image/png"))}catch(b){console.warn("sw-plan-3d: thumbnail failed",b)}finally{this.renderer.setScissorTest(!1),this.renderer.setViewport(0,0,h.width/d,h.height/d),this.renderer.shadowMap.enabled=y,this.disposeGroup(r.root),this.invalidate()}return w}async exportGltf(){const t=new tt;for(const i of this.root.children)i!==this.outline&&t.add(i.clone());return await new gn().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.onRestored),this.controls.removeEventListener("change",this.invalidate),this.controls.dispose(),window.clearTimeout(this.realRebuildTimer),this.clear(),this.post?.dispose(),this.realMats?.dispose(),this.realModels?.dispose(),this.envTarget?.dispose(),this.pmrem?.dispose();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.aoMaterial&&(this.aoMaterial.map?.dispose(),this.aoMaterial.dispose()),this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.unitPlane.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}function vo(s,t,e,i,o){const n=document.createElement("div");n.setAttribute("aria-hidden","true"),n.dataset.skinControl="",n.style.cssText=`position:fixed;left:-1600px;top:0;width:${e}px;height:${i}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(n);let a=null;try{if(a=new Ae({mount:n,color:t,onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1}),a.setDescription(s),!a.setPreset("iso"))return null;a.capture();const r=a.renderer.domElement;if(r.width!==e||r.height!==i)return null;const l=document.createElement("canvas");l.width=e,l.height=i;const h=l.getContext("2d");return h?(h.fillStyle=o,h.fillRect(0,0,e,i),h.drawImage(r,0,0),l.toDataURL("image/png")):null}catch(r){return console.warn("sw-plan-3d: control image failed",r),null}finally{a?.dispose(),n.remove()}}const ye=2500,bo=ye+1500,yo=1e4,ko=3,fs=3e3;function ms(s,t,e){return new Promise(i=>{let o=!1;const n=setTimeout(()=>{o||(o=!0,i(e))},t);s.then(a=>{o||(o=!0,clearTimeout(n),i(a))},()=>{o||(o=!0,clearTimeout(n),i(e))})})}const Ct=1e-6;function xo(s,t=2){const e=new Map,i=s.filter(n=>n.w>0&&n.h>0).slice().sort((n,a)=>a.y-n.y||(n.id<a.id?-1:n.id>a.id?1:0)),o=[];for(const n of i){const a=n.x-n.w/2,r=n.x+n.w/2;let l=n.y;for(let h=0;h<=o.length;h++){const d=o.find(p=>a<p.r-Ct&&r>p.l+Ct&&l-n.h<p.b+t-Ct&&l>p.t-t+Ct);if(!d)break;l=d.t-t}o.push({l:a,r,t:l-n.h,b:l}),e.set(n.id,Math.round((l-n.y)*100)/100)}for(const n of s)e.has(n.id)||e.set(n.id,0);return e}const q=.25,Mo=4e5,So=.85,_o=.8,Nt=4,ke=(s,t,e)=>Math.min(e,Math.max(t,s)),ws=s=>Math.round(s*1e4)/1e4+0;function xe(s,t,e){let i=!1;for(let o=0,n=e.length-1;o<e.length;n=o++){const[a,r]=e[o],[l,h]=e[n];r>t!=h>t&&s<(l-a)*(t-r)/(h-r)+a&&(i=!i)}return i}function Ee(s,t,e){const i=e.b[0]-e.a[0],o=e.b[1]-e.a[1],n=i*i+o*o,a=n>0?ke(((s-e.a[0])*i+(t-e.a[1])*o)/n,0,1):0,r=e.a[0]+a*i,l=e.a[1]+a*o;return{d:Math.hypot(s-r,t-l),cx:r,cz:l}}class Po{constructor(){this.f=[],this.k=[]}get size(){return this.k.length}less(t,e){return this.f[t]<this.f[e]||this.f[t]===this.f[e]&&this.k[t]<this.k[e]}swap(t,e){[this.f[t],this.f[e]]=[this.f[e],this.f[t]],[this.k[t],this.k[e]]=[this.k[e],this.k[t]]}push(t,e){this.f.push(t),this.k.push(e);let i=this.k.length-1;for(;i>0;){const o=i-1>>1;if(!this.less(i,o))break;this.swap(i,o),i=o}}pop(){const t=this.k[0],e=this.f.pop(),i=this.k.pop();if(this.k.length){this.f[0]=e,this.k[0]=i;let o=0;for(;;){const n=2*o+1,a=n+1;let r=o;if(n<this.k.length&&this.less(n,r)&&(r=n),a<this.k.length&&this.less(a,r)&&(r=a),r===o)break;this.swap(o,r),o=r}}return t}}function Xs(s,t){const e=s.bands.filter(i=>i.from===t||i.to===t).flatMap(i=>i.sides);return[...s.levels.find(i=>i.id===t)?.segs??[],...e]}function Ao(s,t,e){const i=s.levels.find(p=>p.id===t);if(!i)return null;const o=i.extent,n=Math.max(1,Math.ceil((o.maxX-o.minX)/q)),a=Math.max(1,Math.ceil((o.maxZ-o.minZ)/q));if(n*a>Mo)return null;const r=Xs(s,t),l=new Uint8Array(n*a),h=e*So;for(const p of r){const u=h+p.r,f=Math.max(0,Math.floor((Math.min(p.a[0],p.b[0])-u-o.minX)/q)),v=Math.min(n-1,Math.floor((Math.max(p.a[0],p.b[0])+u-o.minX)/q)),w=Math.max(0,Math.floor((Math.min(p.a[1],p.b[1])-u-o.minZ)/q)),y=Math.min(a-1,Math.floor((Math.max(p.a[1],p.b[1])+u-o.minZ)/q));for(let b=w;b<=y;b++)for(let A=f;A<=v;A++){const S=b*n+A;l[S]||Ee(o.minX+(A+.5)*q,o.minZ+(b+.5)*q,p).d<u&&(l[S]=1)}}const d=new Map;for(const p of r)p.kind==="object"&&(d.get(p.id)??d.set(p.id,[]).get(p.id)).push(p);for(const p of d.values()){if(p.length<3)continue;const u=p.map(S=>S.a),f=u.map(S=>S[0]),v=u.map(S=>S[1]),w=Math.max(0,Math.floor((Math.min(...f)-o.minX)/q)),y=Math.min(n-1,Math.floor((Math.max(...f)-o.minX)/q)),b=Math.max(0,Math.floor((Math.min(...v)-o.minZ)/q)),A=Math.min(a-1,Math.floor((Math.max(...v)-o.minZ)/q));for(let S=b;S<=A;S++)for(let z=w;z<=y;z++)xe(o.minX+(z+.5)*q,o.minZ+(S+.5)*q,u)&&(l[S*n+z]=1)}return{level:t,minX:o.minX,minZ:o.minZ,cols:n,rows:a,blocked:l,segs:r}}const gs=new WeakMap;function Eo(s,t,e){let i=gs.get(s);i||(i=new Map,gs.set(s,i));const o=`${t}|${e}`;if(i.has(o))return i.get(o)??null;const n=Ao(s,t,e);return i.set(o,n),n}function Me(s,t,e,i){const o=Math.hypot(t[0]-s[0],t[1]-s[1]);if(o<1e-6)return!0;const n=Math.max(2,Math.ceil(o/.1));for(let a=0;a<=n;a++){const r=s[0]+(t[0]-s[0])*a/n,l=s[1]+(t[1]-s[1])*a/n;for(const h of e)if(Ee(r,l,h).d<i*_o+h.r)return!1}return!0}function To(s,t,e,i,o){const n=Eo(s,t,o);if(!n)return null;const{cols:a,rows:r,minX:l,minZ:h,blocked:d}=n,p=(E,D)=>[ke(Math.floor((E-l)/q),0,a-1),ke(Math.floor((D-h)/q),0,r-1)],[u,f]=p(e[0],e[1]);let[v,w]=p(i[0],i[1]),y=i[0],b=i[1];if(d[w*a+v]){let E=null;for(let D=-Nt;D<=Nt;D++)for(let j=-Nt;j<=Nt;j++){const F=v+j,O=w+D;if(F<0||O<0||F>=a||O>=r||d[O*a+F])continue;const Et=j*j+D*D;(!E||Et<E.d)&&(E={i:F,j:O,d:Et})}if(!E)return null;v=E.i,w=E.j,y=l+(v+.5)*q,b=h+(w+.5)*q}const A=f*a+u,S=w*a+v,z=new Float64Array(a*r).fill(1/0),c=new Int32Array(a*r).fill(-1),m=new Uint8Array(a*r),g=(E,D)=>Math.hypot(E-v,D-w),k=new Po;z[A]=0,k.push(g(u,f),A);const M=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];for(;k.size;){const E=k.pop();if(m[E])continue;if(E===S)break;m[E]=1;const D=E%a,j=(E-D)/a;for(const[F,O,Et]of M){const yt=D+F,kt=j+O;if(yt<0||kt<0||yt>=a||kt>=r)continue;const ct=kt*a+yt;if(d[ct]||m[ct]||F&&O&&(d[j*a+yt]||d[kt*a+D]))continue;const Zt=z[E]+Et;Zt<z[ct]-1e-12&&(z[ct]=Zt,c[ct]=E,k.push(Zt+g(yt,kt),ct))}}if(S!==A&&c[S]<0)return null;const x=[];for(let E=S;E>=0&&E!==A;E=c[E])x.push([l+(E%a+.5)*q,h+(Math.floor(E/a)+.5)*q]);x.reverse(),x.push([y,b]);const $=[];let N=[e[0],e[1]],G=0;for(;G<x.length;){let E=G;for(let D=x.length-1;D>G;D--)if(Me(N,x[D],n.segs,o)){E=D;break}$.push([ws(x[E][0]),ws(x[E][1])]),N=x[E],G=E+1}return $}const Ft=.28,zo=1.4,$o=2.8,Lo=120,Io=220,Do=.1,Ro=1/60,Ot=70,vs=[1.2,2],qt=1.65,bs=.02,ys=.45,Y=.3,Co=1.2,No=.1,Fo={forward:0,strafe:0,turn:0,run:!1},Oo=s=>{let t=((s+180)%360+360)%360-180;return t===-180&&(t=180),t},Gt=s=>(s%360+360)%360,J=(s,t,e)=>Math.min(e,Math.max(t,s)),Ut=s=>Math.round(s*1e4)/1e4+0;class qo{constructor(t,e={}){this.x=0,this.z=0,this.heading=0,this.pitch=0,this.level="",this.eye=qt,this.eyeTarget=qt,this.eyeHold=null,this.path=null,this.levels=new Map,this.doors=new Map,this.room=void 0,this.crossShown=null,this.edge=!1,this.blockedDoor=null,this.clock=0,this.progress=null,this.setEyeHeight(e.eye_m??qt,!0),this.setWorld(t);const i=t.starts.find(o=>o.id===t.defaultStart)??t.starts[0];i?this.place(i):this.level=t.levels[0]?.id??""}setWorld(t){if(this.world=t,this.levels=new Map(t.levels.map(e=>[e.id,e])),this.doors=new Map(t.doors.map(e=>[e.id,e])),this.level&&!this.levels.has(this.level)&&(this.level=t.levels[0]?.id??""),this.path?.length){const e=Xs(t,this.level);let i=[this.x,this.z];for(const o of this.path){if(!Me(i,o,e,Ft))return this.cancelPath(),[{type:"path-blocked"}];i=o}}return[]}cancelPath(){this.path=null,this.progress=null}setEyeHeight(t,e=!1){this.eyeTarget=J(Number.isFinite(t)?t:qt,vs[0],vs[1]),e&&(this.eye=this.eyeTarget)}place(t){const e=[];if(t.level!==this.level&&this.levels.has(t.level)&&e.push({type:"level",level:t.level}),this.level=this.levels.has(t.level)?t.level:this.level||this.world.levels[0]?.id||"",this.heading=Gt(t.heading_deg),this.pitch=J(t.pitch_deg,-Ot,Ot),this.cancelPath(),this.crossShown=null,this.eyeHold=t.eye_m,t.eye_m!==null&&(this.eye=t.eye_m),this.x=t.x,this.z=t.z,t.kind!=="camera"){const[i,o]=this.collide(t.x,t.z,this.segmentsFor(this.level,!!this.ground(t.x,t.z,this.level).band)).p;this.x=i,this.z=o}return this.noteRoom(e),e}placeAt(t,e,i=this.level,o=this.heading){return this.place({id:"at",kind:"centre",label:"",level:i,x:t,z:e,heading_deg:o,pitch_deg:this.pitch,eye_m:null})}look(t,e){this.heading=Gt(this.heading+t),this.pitch=J(this.pitch+e,-Ot,Ot)}ground(t,e,i){const o=this.levels.get(i);for(const n of this.world.bands)if(!(n.from!==i&&n.to!==i)){for(let a=0;a<n.ramps.length;a++){const r=n.ramps[a],l=r.b[0]-r.a[0],h=r.b[1]-r.a[1],d=Math.hypot(l,h);if(d<1e-6)continue;const p=l/d,u=h/d,f=t-r.a[0],v=e-r.a[1],w=f*p+v*u;if(Math.abs(-f*u+v*p)<=r.width/2&&w>=-.05&&w<=d+.05){const b=J(w/d,0,1);return{y:r.y0+(r.y1-r.y0)*b,band:n,ramp:a,along:w}}}for(const a of n.landings)if(xe(t,e,a.poly))return{y:a.y,band:n,ramp:-1,along:0}}return{y:o?.elevation_m??0,band:null,ramp:-1,along:0}}segmentsFor(t,e){const i=this.world.bands.filter(o=>o.from===t||o.to===t).flatMap(o=>o.sides);return e?i:[...this.levels.get(t)?.segs??[],...i]}collide(t,e,i){let o=null;for(let n=0;n<3;n++){let a=!1;for(const r of i){const l=Ft+r.r,h=Ee(t,e,r);if(h.d>=l)continue;let d,p;if(h.d<1e-9){const u=r.b[0]-r.a[0],f=r.b[1]-r.a[1],v=Math.hypot(u,f)||1;d=-f/v,p=u/v}else d=(t-h.cx)/h.d,p=(e-h.cz)/h.d;t=h.cx+d*(l+1e-4),e=h.cz+p*(l+1e-4),a=!0,o??=r}if(!a)break}return{p:[t,e],hit:o}}step(t,e=Fo){const i=[],o=J(Number.isFinite(t)?t:0,0,Do),n=Math.max(1,Math.ceil(o/Ro-1e-9));for(let r=0;r<n;r++)this.sub(o/n,e,i);const a=this.eyeHold??this.eyeTarget;return this.eye+=(a-this.eye)*Math.min(1,o*6),Math.abs(a-this.eye)<1e-4&&(this.eye=a),i}sub(t,e,i){this.clock+=t,e.turn&&(this.heading=Gt(this.heading+J(e.turn,-1,1)*Lo*t));let o=J(e.forward,-1,1),n=J(e.strafe,-1,1),a=e.run;if(o||n)this.cancelPath();else if(this.path&&this.path.length){const[g,k]=this.path[0];if(Math.hypot(g-this.x,k-this.z)<.15){this.path.shift(),this.path.length||(this.cancelPath(),i.push({type:"arrived"}));return}const x=this.progress;if(!x||Math.hypot(this.x-x.x,this.z-x.z)>=No)this.progress={x:this.x,z:this.z,at:this.clock};else if(this.clock-x.at>Co){this.cancelPath(),i.push({type:"path-blocked"});return}const $=Oo(mi(g-this.x,k-this.z)-this.heading);this.heading=Gt(this.heading+Math.sign($)*Math.min(Math.abs($),Io*t)),o=Math.abs($)<35?1:.2,n=0,a=!1}if(!o&&!n)return;const r=this.heading*Math.PI/180,l=a?$o:zo,h=Math.min(1,Math.hypot(o,n)),d=Math.hypot(o,n)||1,p=Math.sin(r),u=-Math.cos(r),f=Math.cos(r),v=Math.sin(r);let w=this.x+(p*o+f*n)/d*h*l*t,y=this.z+(u*o+v*n)/d*h*l*t;const b=this.ground(this.x,this.z,this.level),A=!!b.band&&!!this.ground(w,y,this.level).band,S=this.collide(w,y,this.segmentsFor(this.level,A));if([w,y]=S.p,S.hit&&S.hit.kind==="door"){if(this.blockedDoor!==S.hit.id){const g=this.doors.get(S.hit.id);g&&i.push({type:"blocked",door:g})}this.blockedDoor=S.hit.id}else this.blockedDoor=null;const z=this.levels.get(this.level);if(z&&!this.ground(w,y,this.level).band){const g=z.extent,k=J(w,g.minX+Y,Math.max(g.minX+Y,g.maxX-Y)),M=J(y,g.minZ+Y,Math.max(g.minZ+Y,g.maxZ-Y)),x=k!==w||M!==y;x&&!this.edge&&i.push({type:"edge"}),this.edge=x,w=k,y=M}(Math.abs(w-this.x)>1e-7||Math.abs(y-this.z)>1e-7)&&(this.eyeHold=null),this.x=w,this.z=y;const c=this.ground(this.x,this.z,this.level),m=c.band??b.band;if(m){const g=m.ramps.length-1,k=G=>c.band===m&&c.ramp===G||b.band===m&&b.ramp===G,M=m.ramps[g],x=Math.hypot(M.b[0]-M.a[0],M.b[1]-M.a[1]),$=k(g)?this.alongOf(M):-1/0,N=k(0)?this.alongOf(m.ramps[0]):1/0;m.to&&this.level===m.from&&$>x-bs?this.switchLevel(m.to,i):m.to&&this.level===m.to&&N<bs&&this.switchLevel(m.from,i),m.farFloor&&$>x-ys&&this.crossShown!==m.id?(this.crossShown=m.id,i.push({type:"cross-floor",band:m.id,floor:m.farFloor})):m.farFloor&&$<=x-ys-.3&&(this.crossShown=null)}this.noteRoom(i)}alongOf(t){const e=t.b[0]-t.a[0],i=t.b[1]-t.a[1],o=Math.hypot(e,i)||1;return((this.x-t.a[0])*e+(this.z-t.a[1])*i)/o}switchLevel(t,e){t===this.level||!this.levels.has(t)||(this.level=t,e.push({type:"level",level:t}))}noteRoom(t){const e=this.world.rooms.find(o=>o.level===this.level&&xe(this.x,this.z,o.poly))??null,i=e?.id??null;i!==this.room&&(this.room!==void 0&&t.push({type:"room",room:e}),this.room=i)}pose(){const t=this.ground(this.x,this.z,this.level);return{x:Ut(this.x),y:Ut(t.y+this.eye),z:Ut(this.z),heading_deg:Math.round(this.heading*1e3)/1e3+0,pitch_deg:Math.round(this.pitch*1e3)/1e3+0,level:this.level,ground:Ut(t.y),band:t.band?.id??null}}lineFree(t,e,i){return Me(t,e,i,Ft)}pathTo(t,e){const i=To(this.world,this.level,[this.x,this.z],[t,e],Ft);return i?(this.path=i,this.progress=null,i):null}}const Go=.3,Yt=70,Uo=50,Ho=80,Wo=120,Bo=(s,t,e)=>Math.min(e,Math.max(t,s)),Se=s=>Math.round(s*1e3)/1e3+0,vt=s=>Se(Bo(Number.isFinite(s)?s:Yt,Uo,Ho));function jo(s,t,e=Yt,i=Go){const o=i*(vt(e)/Yt);return[Se(-s*o),Se(t*o)]}function Ko(s,t,e){if(!(t>1e-6)||!(e>1e-6))return vt(s);const i=Math.tan(vt(s)/2*Math.PI/180);return vt(2*Math.atan(i*t/e)*180/Math.PI)}const ks=(s,t)=>Math.hypot(s[0]-t[0],s[1]-t[1]);class Xo{constructor(t=Wo){this.h=0,this.p=0,this.tau=Math.max(.001,t/3e3)}add(t,e){this.h+=t,this.p+=e}get pending(){return Math.abs(this.h)>1e-4||Math.abs(this.p)>1e-4}step(t){if(!this.pending)return this.h=0,this.p=0,[0,0];const e=t>0?1-Math.exp(-t/this.tau):0;let i=this.h*e,o=this.p*e;return Math.abs(this.h-i)<=1e-4&&(i=this.h),Math.abs(this.p-o)<=1e-4&&(o=this.p),this.h-=i,this.p-=o,[i,o]}flush(){const t=[this.h,this.p];return this.h=0,this.p=0,t}clear(){this.h=0,this.p=0}}const Yo=56,Vo=8,Qo=84,Zo=10,_e={forward:0,strafe:0,run:!1,engaged:!1,knob:[0,0]},Ht=s=>Math.round(s*1e6)/1e6+0;function Jo(s,t,e={}){const i=e.radius??Yo,o=Math.min(e.dead??Vo,i-1e-6),n=e.runAt??Qo,a=e.snapDeg??Zo;if(!Number.isFinite(s)||!Number.isFinite(t))return _e;const r=Math.hypot(s,t),l=r>i?i/r:1,h=[Ht(s*l),Ht(t*l)];if(r<=o)return{..._e,knob:h};const d=Math.min(1,(r-o)/(i-o));let p=-t/r,u=s/r;const f=Math.atan2(Math.abs(s),Math.abs(t))*180/Math.PI;return f<a?(u=0,p=Math.sign(p)):f>90-a&&(p=0,u=Math.sign(u)),{forward:Ht(p*d),strafe:Ht(u*d),run:r>=n,engaged:!0,knob:h}}const ae=500,xs=10,ta=110,ea=.05;class sa{constructor(t,e=Yt){this.bounds=t,this.fingers=new Map,this.pinch=null,this.fovNow=vt(e)}get fov(){return this.fovNow}setFov(t){this.fovNow=vt(t)}get count(){return this.fingers.size}get stick(){for(const t of this.fingers.values())if(t.role==="stick"&&t.engaged)return{state:t.lastStick,origin:[t.x0,t.y0]};return null}isLeft(t){const e=this.bounds();return t-e.left<e.width/2}down(t){if(this.fingers.has(t.id))return[];const e=this.isLeft(t.x),i={id:t.id,x0:t.x,y0:t.y,x:t.x,y:t.y,lx:t.x,ly:t.y,t0:t.t,role:e?"stick":"look",left:e,armed:!0,engaged:!1,lastStick:_e};if(this.fingers.size===0)return this.fingers.set(t.id,i),[];if(this.fingers.size>=2)return i.role="rest",i.armed=!1,this.fingers.set(t.id,i),[];const o=[...this.fingers.values()][0],n=Math.hypot(o.x-t.x,o.y-t.y)<=ta;return(o.left===e||n)&&o.armed&&o.role!=="rest"?(o.role="pinch",o.armed=!1,i.role="pinch",i.armed=!1,this.fingers.set(t.id,i),this.pinch={a:o.id,b:i.id,dist:ks([o.x,o.y],[i.x,i.y]),fov:this.fovNow},[]):(o.armed=!1,o.role!=="rest"&&o.left===e&&(i.role="rest",i.armed=!1),this.fingers.set(t.id,i),[])}move(t){const e=this.fingers.get(t.id);if(!e)return[];e.x=t.x,e.y=t.y;const i=[],o=Math.hypot(e.x-e.x0,e.y-e.y0)>xs;if(e.role==="stick"){const n=Jo(e.x-e.x0,e.y-e.y0);n.engaged?(e.engaged=!0,e.armed=!1,(n.forward!==e.lastStick.forward||n.strafe!==e.lastStick.strafe||n.run!==e.lastStick.run||n.knob[0]!==e.lastStick.knob[0]||n.knob[1]!==e.lastStick.knob[1]||!e.lastStick.engaged)&&(e.lastStick=n,i.push({type:"stick",forward:n.forward,strafe:n.strafe,run:n.run,origin:[e.x0,e.y0],knob:n.knob}))):e.engaged?(e.lastStick={...n,engaged:!0},i.push({type:"stick",forward:0,strafe:0,run:!1,origin:[e.x0,e.y0],knob:n.knob})):o&&(e.armed=!1)}else if(e.role==="look"){if(o&&(e.armed=!1),!e.armed){const[n,a]=jo(e.x-e.lx,e.y-e.ly,this.fovNow);e.lx=e.x,e.ly=e.y,(n||a)&&i.push({type:"look",dHeading:n,dPitch:a})}}else if(e.role==="pinch"&&this.pinch){const n=this.fingers.get(this.pinch.a),a=this.fingers.get(this.pinch.b);if(n&&a){const r=Ko(this.pinch.fov,this.pinch.dist,ks([n.x,n.y],[a.x,a.y]));Math.abs(r-this.fovNow)>=ea&&(this.fovNow=r,i.push({type:"fov",fov:r}))}}return i}up(t){const e=this.fingers.get(t.id);if(!e)return[];e.x=t.x,e.y=t.y,this.fingers.delete(t.id);const i=[];return e.role==="stick"&&e.engaged?i.push({type:"stick-end"}):(e.role==="stick"||e.role==="look")&&e.armed&&t.t-e.t0<ae&&Math.hypot(e.x-e.x0,e.y-e.y0)<=xs&&i.push({type:"tap",x:e.x,y:e.y}),e.role==="pinch"&&this.endPinch(),i}cancel(t){const e=this.fingers.get(t.id);return e?(e.armed=!1,this.up(t)):[]}reset(){const t=[];for(const e of this.fingers.values())e.role==="stick"&&e.engaged&&t.push({type:"stick-end"});return this.fingers.clear(),this.pinch=null,t}endPinch(){this.pinch=null;for(const t of this.fingers.values())t.role==="pinch"&&(t.role="rest",t.armed=!1)}nextDeadline(){const t=this.candidate();return t?t.t0+ae:null}candidate(){if(this.fingers.size!==1)return null;const t=[...this.fingers.values()][0];return t.armed&&(t.role==="stick"||t.role==="look")?t:null}tick(t){const e=this.candidate();return!e||t-e.t0<ae?[]:(e.armed=!1,[{type:"long-press",x:e.x,y:e.y}])}}const Ys=4e3,Vs=2;function Qs(s){return s.filter(t=>t.kind==="saved")}class ia{constructor(t,e={}){this.stops=t,this.i=-1,this.due=1/0,this.dwell=Math.max(1,e.dwellMs??Ys),this.loop=!!e.loop}get playable(){return this.stops.length>=Vs}get playing(){return this.i>=0}get index(){return this.i}get dueAt(){return this.i>=0?this.due:null}start(t){return this.playable?(this.i=0,this.due=t+this.dwell,{index:0,stop:this.stops[0]}):null}advance(t){if(this.i<0||t<this.due)return null;const e=this.i+1;if(e>=this.stops.length){if(!this.loop)return this.stop(),"end";this.i=0}else this.i=e;return this.due=t+this.dwell,{index:this.i,stop:this.stops[this.i]}}stop(){this.i=-1,this.due=1/0}}const Wt=.22,na=24,oa=2e3,aa=150;class ra{constructor(t,e,i){this.host=e,this.keys=new Set,this.raf=0,this.last=0,this.drag=null,this.locked=!1,this.mode="drag",this.fpsWindow=null,this.disposed=!1,this.touchStick=null,this.longTimer=0,this.longDue=null,this.route=null,this.routeTimer=0,this.fadeTimer=0,this.tick=n=>{if(this.raf=0,this.disposed)return;const a=this.last?(n-this.last)/1e3:1/60;if(this.last=n,this.ease?.pending){const[l,h]=this.ease.step(a);(l||h)&&this.ctrl.look(l,h)}const r=this.ctrl.step(a,this.input());this.host.onPose(),r.length&&this.host.onEvents(r),this.watchFps(n),this.busy()?this.raf=requestAnimationFrame(this.tick):this.fpsWindow=null},this.onKeyDown=n=>{if(this.typing(n)||n.ctrlKey||n.metaKey||n.altKey)return;const a=n.code;if(a==="Escape"){n.preventDefault(),this.host.onExit();return}if(a==="Enter"){if(this.onControl(n))return;n.preventDefault(),this.host.onAct();return}if(a==="KeyQ"||a==="KeyE"){n.preventDefault(),this.host.onInput?.("key"),this.cancelRoute(),this.ctrl.look(a==="KeyQ"?-45:45,0),this.host.onPose();return}const r=/^Digit([1-9])$/.exec(a);if(r){const h=this.ctrl.world.starts.filter(d=>d.kind==="saved")[Number(r[1])-1];h&&(n.preventDefault(),this.host.onInput?.("key"),this.goTo(h));return}["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","ShiftLeft","ShiftRight"].includes(a)&&(n.preventDefault(),this.host.onInput?.("key"),this.cancelRoute(),this.keys.add(a),this.kick())},this.onKeyUp=n=>{this.keys.delete(n.code)},this.onBlur=()=>{this.keys.clear(),this.endTouches()},this.onHidden=()=>{document.hidden&&this.endTouches()},this.onTouch=n=>{if(n.pointerType==="mouse")return;n.stopPropagation(),(n.type==="pointerdown"||n.type==="pointermove")&&n.preventDefault();const a={id:n.pointerId,x:n.clientX,y:n.clientY,t:performance.now()};let r;if(n.type==="pointerdown"){this.host.onInput?.("touch"),this.cancelRoute();try{this.host.canvas.setPointerCapture(n.pointerId)}catch{}r=this.touch.down(a)}else n.type==="pointermove"?r=this.touch.move(a):n.type==="pointerup"?r=this.touch.up(a):r=this.touch.cancel(a);this.apply(r),this.armLong()},this.onContextMenu=n=>{n.preventDefault()},this.onDown=n=>{if(n.pointerType!=="mouse"||n.button!==0)return;this.host.onInput?.("mouse"),this.cancelRoute();const a=this.host.canvas;if(!this.locked&&this.wantsLock())try{const r=a.requestPointerLock?.();r&&typeof r.catch=="function"&&r.catch(()=>{})}catch{}this.locked||(this.drag={id:n.pointerId,x:n.clientX,y:n.clientY})},this.onMove=n=>{const a=this.drag;if(n.pointerType!=="mouse"||!a||n.pointerId!==a.id)return;const r=n.clientX-a.x,l=n.clientY-a.y;a.x=n.clientX,a.y=n.clientY,this.ctrl.look(-r*Wt,l*Wt),this.host.onPose()},this.onUp=n=>{this.drag&&n.pointerId===this.drag.id&&(this.drag=null)},this.onLockChange=()=>{this.locked=document.pointerLockElement===this.host.canvas},this.onLockedMove=n=>{this.locked&&(this.ctrl.look(n.movementX*Wt,-n.movementY*Wt),this.host.onPose())},this.ctrl=new qo(t,{eye_m:i.eye_m}),i.start&&this.ctrl.place(i.start),this.mode=i.mouseMode,this.routeDwellMs=i.routeDwellMs??Ys,this.fadeMs=i.fadeMs??aa,this.ease=i.ease===!1?null:new Xo,this.surface=e.surface??e.canvas.parentElement??e.canvas,this.touch=new sa(()=>this.surface.getBoundingClientRect(),i.fov),window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onHidden),document.addEventListener("pointerlockchange",this.onLockChange);const o=e.canvas;o.addEventListener("pointerdown",this.onDown),o.addEventListener("pointermove",this.onMove),o.addEventListener("pointerup",this.onUp),o.addEventListener("pointercancel",this.onUp),o.addEventListener("mousemove",this.onLockedMove),o.addEventListener("contextmenu",this.onContextMenu);for(const n of["pointerdown","pointermove","pointerup","pointercancel"])this.surface.addEventListener(n,this.onTouch,!0)}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),window.clearTimeout(this.longTimer),window.clearTimeout(this.routeTimer),window.clearTimeout(this.fadeTimer),window.removeEventListener("keydown",this.onKeyDown),window.removeEventListener("keyup",this.onKeyUp),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onHidden),document.removeEventListener("pointerlockchange",this.onLockChange);const t=this.host.canvas;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointercancel",this.onUp),t.removeEventListener("mousemove",this.onLockedMove),t.removeEventListener("contextmenu",this.onContextMenu);for(const e of["pointerdown","pointermove","pointerup","pointercancel"])this.surface.removeEventListener(e,this.onTouch,!0);this.locked&&document.pointerLockElement===t&&document.exitPointerLock?.(),this.host.onStick?.(null),this.host.onFade?.(!1)}setMouseMode(t){this.mode=t,t==="drag"&&this.locked&&document.exitPointerLock?.()}setWorld(t){const e=this.ctrl.setWorld(t);e.length&&this.host.onEvents(e),this.kick()}setFov(t){this.touch.setFov(t)}wantsLock(){if(this.mode==="lock")return!0;if(this.mode!=="auto")return!1;try{return window.self===window.top}catch{return!1}}input(){const t=this.keys,e=(...a)=>a.some(r=>t.has(r));let i=(e("KeyW","ArrowUp")?1:0)-(e("KeyS","ArrowDown")?1:0),o=(e("KeyD")?1:0)-(e("KeyA")?1:0);const n=(e("ArrowRight")?1:0)-(e("ArrowLeft")?1:0);return this.touchStick&&(i=i||this.touchStick.forward,o=o||this.touchStick.strafe),{forward:i,strafe:o,turn:n,run:e("ShiftLeft","ShiftRight")||!!(this.touchStick&&(this.touchStick.forward||this.touchStick.strafe)&&this.touchStick.run)}}busy(){const t=this.input();return!!(t.forward||t.strafe||t.turn||this.ctrl.path||this.ease?.pending||Math.abs(this.ctrl.eye-this.ctrl.eyeTarget)>1e-4)}kick(){this.raf||this.disposed||(this.last=0,this.raf=requestAnimationFrame(this.tick))}watchFps(t){const e=this.fpsWindow;if(!e){this.fpsWindow={t0:t,frames:0};return}e.frames++;const i=t-e.t0;if(i<oa)return;const o=e.frames*1e3/i;this.fpsWindow={t0:t,frames:0},o<na&&!document.hidden&&this.host.onLowFps(o)}typing(t){return t.composedPath().some(i=>i instanceof HTMLElement&&(i.tagName==="INPUT"||i.tagName==="SELECT"||i.tagName==="TEXTAREA"||i.isContentEditable))}onControl(t){return t.composedPath().some(e=>e instanceof HTMLElement&&(e.tagName==="BUTTON"||e.tagName==="A"))}endTouches(){window.clearTimeout(this.longTimer),this.longDue=null,this.apply(this.touch.reset()),this.touchStick=null,this.host.onStick?.(null)}goTo(t){this.cancelRoute(),this.jump(t)}jump(t){const e=this.ctrl.place(t);this.ease?.clear(),this.host.onPose(),e.length&&this.host.onEvents(e),this.kick()}walkTo(t,e){const i=!!this.ctrl.pathTo(t,e);return i&&this.kick(),i}playRoute(){const t=new ia(Qs(this.ctrl.world.starts),{dwellMs:this.routeDwellMs}),e=t.start(performance.now());return e?(this.cancelRoute(),this.route=t,this.host.onRoute?.({playing:!0}),this.showStop(e.stop,e.index),this.armRoute(),!0):!1}get routePlaying(){return this.route!==null}cancelRoute(){window.clearTimeout(this.routeTimer),window.clearTimeout(this.fadeTimer),this.route&&(this.route.stop(),this.route=null,this.host.onFade?.(!1),this.host.onRoute?.({playing:!1}))}armRoute(){window.clearTimeout(this.routeTimer);const t=this.route?.dueAt;t!=null&&(this.routeTimer=window.setTimeout(()=>this.routeTick(),Math.max(0,t-performance.now())+1))}routeTick(){const t=this.route;if(!t||this.disposed)return;const e=t.advance(performance.now());if(e===null){this.armRoute();return}if(e==="end"){this.route=null,this.host.onRoute?.({playing:!1});return}this.showStop(e.stop,e.index),this.armRoute()}showStop(t,e){const i=()=>{!this.route||this.disposed||(this.jump(t),this.host.onFade?.(!1),this.host.onRoute?.({playing:!0,index:e,label:t.label}))};window.clearTimeout(this.fadeTimer),this.fadeMs>0&&this.host.onFade?(this.host.onFade(!0),this.fadeTimer=window.setTimeout(i,this.fadeMs)):i()}apply(t){for(const e of t)switch(e.type){case"stick":this.touchStick={forward:e.forward,strafe:e.strafe,run:e.run},this.host.onStick?.({origin:e.origin,knob:e.knob,run:e.run}),this.kick();break;case"stick-end":this.touchStick=null,this.host.onStick?.(null);break;case"look":this.ease?(this.ease.add(e.dHeading,e.dPitch),this.kick()):(this.ctrl.look(e.dHeading,e.dPitch),this.host.onPose());break;case"fov":this.host.onFov?.(e.fov);break;case"tap":this.host.onTap?.(e.x,e.y);break;case"long-press":this.host.onLongPress?.(e.x,e.y);break}}armLong(){const t=this.touch.nextDeadline();t!==this.longDue&&(window.clearTimeout(this.longTimer),this.longDue=t,!(t===null||this.disposed)&&(this.longTimer=window.setTimeout(()=>{this.longDue=null,this.apply(this.touch.tick(performance.now())),this.armLong()},Math.max(0,t-performance.now())+1)))}get stickVector(){return this.touchStick?{forward:this.touchStick.forward,strafe:this.touchStick.strafe}:null}get pointerLocked(){return this.locked}}const la={now:()=>Date.now(),setTimeout:(s,t)=>globalThis.setTimeout(s,t),clearTimeout:s=>globalThis.clearTimeout(s)};function Ms(s){const t=typeof s=="number"?s:Number(s);return Number.isFinite(t)&&t>0?Math.round(t*1e3):0}class ha{constructor(t){this.opts=t,this.phaseNow="active",this.timer=null,this.timerDue=0,this.holds=new Set,this.disposed=!1,this.sched=t.scheduler??la,this.wakeOnChange=t.wakeOnChange!==!1,this.ms=Ms(t.idleS),this.lastActivity=this.sched.now(),this.arm()}get phase(){return this.phaseNow}get idleS(){return this.ms/1e3}input(){this.disposed||(this.lastActivity=this.sched.now(),this.phaseNow==="idle"&&this.set("active","input"))}change(){if(!this.disposed){if(this.phaseNow==="idle"){this.wakeOnChange&&(this.lastActivity=this.sched.now(),this.set("active","change"));return}this.lastActivity=this.sched.now()}}hold(t,e){if(!this.disposed){if(e){this.holds.add(t),this.lastActivity=this.sched.now(),this.phaseNow==="idle"?this.set("active","hold"):this.clear();return}this.holds.delete(t)&&(this.lastActivity=this.sched.now(),this.arm())}}setVisible(t){this.disposed||!t||(this.lastActivity=this.sched.now(),this.phaseNow==="idle"&&this.set("active","visible"))}setIdleS(t){if(this.disposed)return;const e=Ms(t);if(e!==this.ms){if(this.ms=e,this.lastActivity=this.sched.now(),this.phaseNow==="idle"){this.set("active","config");return}this.clear(),this.arm()}}dispose(){this.disposed=!0,this.clear(),this.holds.clear()}set(t,e){t!==this.phaseNow&&(this.phaseNow=t,t==="active"?this.arm():this.clear(),this.opts.onChange(t,e))}clear(){this.timer!==null&&this.sched.clearTimeout(this.timer),this.timer=null,this.timerDue=0}arm(){if(this.disposed||this.ms<=0||this.phaseNow==="idle"||this.holds.size>0){this.clear();return}const t=this.lastActivity+this.ms;this.timer!==null&&this.timerDue<=t||(this.clear(),this.timerDue=t,this.timer=this.sched.setTimeout(()=>this.fire(),Math.max(0,t-this.sched.now())))}fire(){if(this.timer=null,this.timerDue=0,!(this.disposed||this.phaseNow!=="active"||this.holds.size>0||this.ms<=0)){if(this.sched.now()-this.lastActivity<this.ms){this.arm();return}this.set("idle","timeout")}}}class ca{constructor(){this.reasons=new Set}set(t,e){const i=this.paused;return e?this.reasons.add(t):this.reasons.delete(t),i!==this.paused}has(t){return this.reasons.has(t)}get paused(){return this.reasons.size>0}}const da=1200,re="sw.plan3d.lockrefused";function ua(){let s=null;return{doc:document,frame:()=>{try{if(window.self===window.top)return null;const t=window.frameElement;if(!t)return null;const e=t.getAttribute("sandbox");return{sandbox:e===null?null:e.split(/\s+/).filter(Boolean)}}catch{return null}},supported:()=>typeof Element<"u"&&typeof Element.prototype.requestPointerLock=="function",store:{get:()=>{try{return sessionStorage.getItem(re)??s}catch{return s}},set:t=>{s=t;try{t===null?sessionStorage.removeItem(re):sessionStorage.setItem(re,t)}catch{}}},setTimeout:(t,e)=>window.setTimeout(t,e),clearTimeout:t=>window.clearTimeout(t)}}const Ss=s=>s==="unsupported"||s==="frame-sandbox"||s==="refused";class pa{constructor(t=ua(),e){this.env=t,this.onRefused=e,this.attached=0,this.reported=!1,this.lockedOnce=!1,this.onError=()=>{this.refuse("refused")},this.onChange=()=>{this.env.doc.pointerLockElement&&(this.lockedOnce=!0)}}get blocked(){if(!this.env.supported())return"unsupported";const t=this.env.frame();if(t&&t.sandbox&&!t.sandbox.includes("allow-pointer-lock"))return"frame-sandbox";const e=this.env.store.get();return Ss(e)?e:null}effectiveMode(t){return t!=="drag"&&this.blocked?"drag":t}attach(){this.attached++===0&&(this.env.doc.addEventListener("pointerlockerror",this.onError),this.env.doc.addEventListener("pointerlockchange",this.onChange));let t=!1;return()=>{t||(t=!0,--this.attached===0&&(this.env.doc.removeEventListener("pointerlockerror",this.onError),this.env.doc.removeEventListener("pointerlockchange",this.onChange)))}}reset(){this.env.store.set(null),this.reported=!1}request(t){const e=this.blocked;if(e)return Promise.resolve({state:"blocked",reason:e});const i=t.requestPointerLock;if(typeof i!="function")return Promise.resolve(this.refuse("unsupported"));const{doc:o}=this.env;return new Promise(n=>{let a=null,r=!1;const l=p=>{r||(r=!0,o.removeEventListener("pointerlockchange",h),o.removeEventListener("pointerlockerror",d),a!==null&&this.env.clearTimeout(a),n(p))},h=()=>{o.pointerLockElement===t&&(this.lockedOnce=!0,l({state:"locked"}))},d=()=>l(this.refuse("refused"));o.addEventListener("pointerlockchange",h),o.addEventListener("pointerlockerror",d),a=this.env.setTimeout(()=>l(this.refuse("refused")),da);try{const p=i.call(t);p&&typeof p.then=="function"&&p.then(()=>{o.pointerLockElement===t&&(this.lockedOnce=!0,l({state:"locked"}))},()=>l(this.refuse("refused")))}catch{l(this.refuse("refused"))}})}refuse(t){return this.lockedOnce&&t==="refused"?{state:"refused",reason:t}:(Ss(this.env.store.get())||this.env.store.set(t),this.reported||(this.reported=!0,this.onRefused?.(t)),{state:"refused",reason:t})}}const le=6;function fa(s,t){const e=Math.max(.001,s.maxX-s.minX),i=Math.max(.001,s.maxZ-s.minZ),o=t-2*le,n=o/Math.max(e,i),a=le+(o-e*n)/2,r=le+(o-i*n)/2;return{size:t,k:n,toPx:(l,h)=>[a+(l-s.minX)*n,r+(h-s.minZ)*n],toM:(l,h)=>[s.minX+(l-a)/n,s.minZ+(h-r)/n]}}function ma(s,t,e,i,o,n){const a=t.levels.find(u=>u.id===e.level);if(s.clearRect(0,0,o,o),!a)return null;const r=fa(a.extent,o);s.fillStyle=n.bg,s.beginPath(),s.roundRect(0,0,o,o,10),s.fill();for(const u of t.rooms)u.level===a.id&&(s.beginPath(),u.poly.forEach(([f,v],w)=>{const[y,b]=r.toPx(f,v);w?s.lineTo(y,b):s.moveTo(y,b)}),s.closePath(),s.fillStyle=n.room,s.fill());const l=(u,f,v,w)=>{const[y,b]=r.toPx(u[0],u[1]),[A,S]=r.toPx(f[0],f[1]);s.strokeStyle=v,s.lineWidth=w,s.beginPath(),s.moveTo(y,b),s.lineTo(A,S),s.stroke()};s.lineCap="round";for(const u of a.segs)u.kind!=="door"&&l(u.a,u.b,u.kind==="window"?n.window:u.kind==="object"?n.object:u.kind==="low"?n.low:n.wall,u.kind==="object"?1:Math.max(1.5,u.r*2*r.k));for(const u of t.doors)u.level===a.id&&l(u.a,u.b,u.passable?n.doorOpen:n.doorClosed,2.5);for(const u of t.bands)if(!(u.from!==a.id&&u.to!==a.id)){for(const f of u.sides)l(f.a,f.b,n.stair,1);for(const f of u.ramps){const v=Math.hypot(f.b[0]-f.a[0],f.b[1]-f.a[1])||1,w=[-(f.b[1]-f.a[1])/v,(f.b[0]-f.a[0])/v],y=Math.max(2,Math.round(v/.3));for(let b=1;b<y;b++){const A=b/y,S=f.a[0]+(f.b[0]-f.a[0])*A,z=f.a[1]+(f.b[1]-f.a[1])*A;l([S+w[0]*f.width/2,z+w[1]*f.width/2],[S-w[0]*f.width/2,z-w[1]*f.width/2],n.stair,.75)}}}if(i&&i.length){s.setLineDash([3,3]);let u=[e.x,e.z];for(const f of i)l(u,f,n.path,2),u=f;s.setLineDash([])}const[h,d]=r.toPx(e.x,e.z),p=(e.heading_deg-90)*Math.PI/180;return s.fillStyle=n.meRing,s.beginPath(),s.moveTo(h,d),s.arc(h,d,22,p-.5,p+.5),s.closePath(),s.fill(),s.fillStyle=n.me,s.beginPath(),s.arc(h,d,4,0,Math.PI*2),s.fill(),r}var wa=Object.defineProperty,ga=Object.getOwnPropertyDescriptor,bt=(s,t,e,i)=>{for(var o=i>1?void 0:i?ga(t,e):t,n=s.length-1,a;n>=0;n--)(a=s[n])&&(o=(i?a(t,e,o):a(o))||o);return i&&o&&wa(t,e,o),o};const _s=640,Ps=["saved","door","room","camera","centre"],As={saved:"walk.kindSaved",door:"walk.kindDoor",room:"walk.kindRoom",camera:"walk.kindCamera",centre:"walk.kindCentre"},Bt=s=>s in As?B(As[s]):s,Es=28;let rt=class extends Cs{constructor(){super(...arguments),this.starts=[],this.shown=null,this.routePlaying=!1,this.compact=!1,this.open=!1,this.swipe=null,this.suppressClick=!1,this.onGrabDown=s=>{this.swipe={y:s.clientY,id:s.pointerId,moved:!1}},this.onGrabMove=s=>{const t=this.swipe;if(!t||s.pointerId!==t.id||t.moved)return;const e=s.clientY-t.y;e<=-Es?(this.open=!0,t.moved=!0):e>=Es&&(this.open=!1,t.moved=!0)},this.onGrabUp=s=>{if(!this.swipe||s.pointerId!==this.swipe.id)return;const t=this.swipe.moved;this.swipe=null,t&&(this.suppressClick=!0,window.setTimeout(()=>this.suppressClick=!1,80))},this.onGrabClick=()=>{if(this.suppressClick){this.suppressClick=!1;return}this.open=!this.open}}connectedCallback(){super.connectedCallback();const s=this.getRootNode().host??this;this.compact=s.clientWidth>0&&s.clientWidth<=_s,typeof ResizeObserver<"u"&&(this.ro=new ResizeObserver(()=>{const t=s.clientWidth;t>0&&(this.compact=t<=_s)}),this.ro.observe(s))}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}setStick(s){const t=this.renderRoot.querySelector(".stick");if(!t)return;if(!s){t.hidden=!0;return}const e=this.getBoundingClientRect();t.hidden=!1,t.style.transform=`translate(${Math.round(s.origin[0]-e.left)}px, ${Math.round(s.origin[1]-e.top)}px)`,t.toggleAttribute("data-run",s.run);const i=t.querySelector(".knob");i&&(i.style.transform=`translate(${Math.round(s.knob[0])}px, ${Math.round(s.knob[1])}px)`)}setTarget(s){const t=this.renderRoot.querySelector(".target");if(t){if(!s){t.hidden=!0;return}t.hidden=!1,t.style.transform=`translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`}}setFade(s){this.renderRoot.querySelector(".fade")?.toggleAttribute("data-on",s)}get sheetOpen(){return this.compact&&this.open}emit(s,t){this.dispatchEvent(new CustomEvent(s,{detail:t}))}onField(s,t){const e=Number(t.target.value);Number.isFinite(e)&&this.emit("hud-field",{key:s,value:e})}goto(s){s&&(this.emit("hud-goto",{id:s}),this.open=!1)}toggleRoute(){this.emit("hud-route",{play:!this.routePlaying})}routeButton(){return Qs(this.starts).length<Vs?L:T`<button type="button" class="btn ${this.compact?"":"ghost"}" data-walk-route aria-pressed=${this.routePlaying?"true":"false"} @click=${()=>this.toggleRoute()}>${this.routePlaying?B("walk.routeStop"):B("walk.route")}</button>`}fields(){const s=this.shown;return s?T`<label class="num">x <input type="number" step="0.1" inputmode="decimal" data-walk-x aria-label=${B("walk.xMetres")} .value=${s.x.toFixed(2)} @change=${t=>this.onField("x",t)} /></label>
      <label class="num">y <input type="number" step="0.1" inputmode="decimal" data-walk-y aria-label=${B("walk.yMetres")} .value=${s.z.toFixed(2)} @change=${t=>this.onField("z",t)} /></label>
      <label class="num">${B("walk.heading")} <input type="number" step="5" inputmode="numeric" data-walk-heading aria-label=${B("walk.headingDeg")} .value=${String(s.heading)} @change=${t=>this.onField("heading",t)} /></label>`:L}bar(){const s=Ps.filter(t=>this.starts.some(e=>e.kind===t));return T`<div class="walkbar" role="group" aria-label=${B("walk.bar")} data-walk-bar>
      <button type="button" class="btn ghost" data-walk-exit @click=${()=>this.emit("hud-exit",null)}>${B("walk.exit")}</button>
      <select data-walk-start aria-label=${B("walk.standAt")} @change=${t=>{const e=t.target,i=e.value;e.value="",this.goto(i)}}>
        <option value="">${B("walk.standAt")}</option>
        ${s.map(t=>T`<optgroup label=${Bt(t)}>${this.starts.filter(e=>e.kind===t).map(e=>T`<option value=${e.id}>${e.label||Bt(t)}</option>`)}</optgroup>`)}
      </select>
      ${this.routeButton()}
      ${this.fields()}
    </div>`}sheet(){const s=Ps.filter(t=>this.starts.some(e=>e.kind===t));return T`<div class="sheet" role="group" aria-label=${B("walk.bar")} data-walk-bar data-walk-sheet data-open=${this.open?"true":"false"}>
      ${this.open?T`<div class="body" id="walk-sheet-body" data-walk-sheet-body>
            ${s.map(t=>T`<div class="group"><h4>${Bt(t)}</h4>
              <div class="places">${this.starts.filter(e=>e.kind===t).map(e=>T`<button type="button" class="btn" data-walk-place=${e.id} @click=${()=>this.goto(e.id)}>${e.label||Bt(t)}</button>`)}</div></div>`)}
            <div class="fields">${this.fields()}</div>
          </div>`:L}
      <div class="row">
        <button type="button" class="btn ghost" data-walk-exit @click=${()=>this.emit("hud-exit",null)}>${B("walk.exit")}</button>
        <button type="button" class="btn" data-walk-sheet-toggle aria-expanded=${this.open?"true":"false"} aria-controls="walk-sheet-body"
          style="touch-action: none" @pointerdown=${this.onGrabDown} @pointermove=${this.onGrabMove} @pointerup=${this.onGrabUp} @pointercancel=${this.onGrabUp} @click=${this.onGrabClick}>${B("walk.standAt")}<i class="chev" aria-hidden="true"></i></button>
        <span class="gap"></span>
        ${this.routeButton()}
      </div>
    </div>`}render(){return T`<i class="stick" hidden aria-hidden="true"><i class="knob"></i></i><i class="target" hidden aria-hidden="true"></i><i class="fade" aria-hidden="true"></i>${this.compact?this.sheet():this.bar()}`}};rt.styles=Rs`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
      direction: rtl;
      --hud-tap: var(--sw-touch-desktop);
    }
    /* a finger needs 44 px: below 1100 px and on a coarse pointer whatever the desktop dial says */
    @media (max-width: 1100px), (pointer: coarse) {
      :host {
        --hud-tap: 44px;
      }
    }
    [hidden] {
      display: none !important;
    }
    /* ---- the joystick: a ring under the thumb and a knob; moved by transforms from setStick (no Lit render per frame) */
    .stick {
      position: absolute;
      left: 0;
      top: 0;
      inline-size: 112px;
      block-size: 112px;
      margin: -56px 0 0 -56px;
      border-radius: 50%;
      border: 2px solid var(--sw-on-video-2);
      background: color-mix(in srgb, var(--sw-video-scrim) 30%, transparent);
      box-shadow: 0 0 0 1px var(--sw-video-scrim); /* a dark edge: the white ring alone vanishes on a white wall */
      box-sizing: border-box;
      pointer-events: none;
    }
    .stick[data-run] {
      border-color: var(--sw-accent);
    }
    .knob {
      position: absolute;
      left: 50%;
      top: 50%;
      inline-size: 44px;
      block-size: 44px;
      margin: -22px 0 0 -22px;
      border-radius: 50%;
      background: var(--sw-accent);
      border: 2px solid var(--sw-on-video);
      box-sizing: border-box;
      box-shadow: var(--sw-shadow-2);
    }
    /* ---- where a tap sent the walk */
    .target {
      position: absolute;
      left: 0;
      top: 0;
      inline-size: 28px;
      block-size: 28px;
      margin: -14px 0 0 -14px;
      border-radius: 50%;
      border: 3px solid var(--sw-live);
      background: color-mix(in srgb, var(--sw-live) 22%, transparent);
      box-sizing: border-box;
      pointer-events: none;
      animation: pulse calc(var(--sw-t-med) * 6) ease-in-out infinite alternate;
    }
    @keyframes pulse {
      from {
        opacity: 0.55;
      }
      to {
        opacity: 1;
      }
    }
    /* ---- the dim between two saved positions of a route */
    .fade {
      position: absolute;
      inset: 0;
      background: var(--sw-video-bg);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .fade[data-on] {
      opacity: 0.85;
    }
    /* ---- the controls both layouts share */
    .btn {
      min-inline-size: var(--hud-tap);
      min-block-size: var(--hud-tap);
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding-inline: var(--sw-s-3);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      touch-action: manipulation;
    }
    .btn.ghost {
      background: transparent;
      border-color: transparent;
      color: var(--sw-text-2);
    }
    .btn[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .btn:focus-visible,
    select:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .chev {
      display: block;
      inline-size: 9px;
      block-size: 9px;
      border-left: 2px solid currentColor; /* physical: the chevron is a shape, not text (RTL must not turn it sideways) */
      border-top: 2px solid currentColor;
      transform: translateY(2px) rotate(45deg);
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .btn[aria-expanded='true'] .chev {
      transform: translateY(-2px) rotate(225deg);
    }
    label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    input {
      inline-size: 72px;
      min-block-size: var(--hud-tap);
      box-sizing: border-box;
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      padding: 3px 6px;
      background: var(--sw-surface);
      color: var(--sw-text);
      direction: ltr;
    }
    select {
      min-block-size: var(--hud-tap);
      box-sizing: border-box;
      font: inherit;
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 4px 10px;
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 170px;
    }
    /* ---- the floating bar (a desktop, a tablet, any view wider than 640 px) */
    .walkbar {
      position: absolute;
      inset-block-end: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 6px 8px;
      border-radius: var(--sw-r-md);
      /* over the live 3D scene the bar is opaque (owner 2026-10-13, like the phone sheet below): the menu surface and the strong hairline, no blur */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
      max-inline-size: calc(100% - 24px);
      overflow-x: auto;
      pointer-events: auto;
      color: var(--sw-text);
    }
    /* ---- the phone: a bottom sheet that opens upward from one row of controls */
    .sheet {
      --hud-tap: 44px;
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      max-block-size: min(64%, 480px);
      border-start-start-radius: var(--sw-r-xl);
      border-start-end-radius: var(--sw-r-xl);
      /* over a live 3D scene the bottom sheet (places, fields) is a menu: fully opaque so the text always reads, whatever the look dial or the
         skin says (owner 2026-10-13; it was 94 % of the solid twin under a blur) */
      background: var(--sw-menu-surface);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), var(--sw-shadow-3);
      color: var(--sw-text);
      padding-block-end: env(safe-area-inset-bottom, 0px);
      pointer-events: auto;
    }
    .sheet .body {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      touch-action: pan-y;
      padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-1);
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .sheet .group {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
    }
    .sheet .group h4 {
      margin: 0;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .sheet .places,
    .sheet .fields {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    /* a long position name (up to 40 characters) stays inside the sheet */
    .sheet .places .btn {
      max-inline-size: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sheet .fields {
      gap: var(--sw-s-3);
    }
    .sheet label {
      font-size: var(--sw-fs-sm);
    }
    .sheet input {
      inline-size: 84px;
      font-size: var(--sw-fs-md);
    }
    .sheet .row {
      flex: none;
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
    }
    .sheet .row .gap {
      flex: 1;
    }
    .sheet .body + .row {
      border-block-start: 1px solid var(--sw-border);
    }
  `;bt([R({attribute:!1})],rt.prototype,"starts",2);bt([R({attribute:!1})],rt.prototype,"shown",2);bt([R({type:Boolean})],rt.prototype,"routePlaying",2);bt([C()],rt.prototype,"compact",2);bt([C()],rt.prototype,"open",2);rt=bt([Ns("sw-walk-hud")],rt);const va=new Set(["entity","camera","object","opening"]);function ba(s,t,e,i){if(t.path&&t.path.length)return t.cancelPath(),{kind:"cancel"};const o=s.pickAt(e,i),n=o&&o.kind!=="zone"&&o.kind!=="level"?[o.point[0],o.point[2]]:s.floorPoint(e,i,t.pose().ground);if(!n)return{kind:"none"};const a=t.pathTo(n[0],n[1]);return!a||!a.length?{kind:"unreachable"}:{kind:"walk",target:a[a.length-1],path:a}}function ya(s,t,e){const i=s.pickAt(t,e);return i&&va.has(i.kind)?i:null}class ka{constructor(t){this.host=t,this.last=null,this.ringShown=!1,this.minimapId=null}get touch(){return this.last==="touch"}hooks(){return{onTap:(t,e)=>this.tap(t,e),onLongPress:(t,e)=>this.longPress(t,e),onFov:t=>this.host.view()?.setWalkFov(t),onStick:t=>this.host.hud()?.setStick(t),onInput:t=>this.input(t),onFade:t=>this.host.hud()?.setFade(t),onRoute:t=>this.route(t)}}reset(){this.last=null,this.ringShown=!1,this.minimapId=null,this.host.touching(!1)}input(t){t!==this.last&&(this.last=t,this.host.touching(t==="touch"))}tap(t,e){const i=this.host.walk(),o=this.host.view();if(!i||!o)return;const n=ba(o,i.ctrl,t,e);n.kind==="walk"?i.kick():n.kind==="unreachable"&&this.host.message(B("walk.noWay"),"warn"),this.updateTarget()}longPress(t,e){const i=this.host.view(),o=i?ya(i,t,e):null;if(o){try{navigator.vibrate?.(12)}catch{}this.host.select(o)}}route(t){const e=this.host.hud();e&&(e.routePlaying=t.playing),t.label&&this.host.message(t.label,"info")}updateTarget(){const t=this.host.hud(),e=this.host.walk(),i=this.host.view();if(!t||!e||!i)return;const o=e.ctrl.path;if(!o||!o.length){this.ringShown&&(this.ringShown=!1,t.setTarget(null));return}const n=o[o.length-1],a=i.projectPoint([n[0],e.ctrl.pose().ground,n[1]]);this.ringShown=!!a,t.setTarget(a)}goto(t){const e=this.host.world()?.starts.find(i=>i.id===t.detail.id);e&&this.host.walk()?.goTo(e)}field(t){const e=this.host.walk();if(!e)return;const{key:i,value:o}=t.detail,n=e.ctrl;e.goTo({id:"field",kind:"centre",label:"",level:n.level,x:i==="x"?o:n.x,z:i==="z"?o:n.z,heading_deg:i==="heading"?o:n.heading,pitch_deg:n.pitch,eye_m:null})}routeToggle(t){t.detail.play?this.host.walk()?.playRoute():this.host.walk()?.cancelRoute()}minimapDown(t){if(!(t.pointerType==="mouse"&&t.button!==0)){this.input(t.pointerType==="mouse"?"mouse":"touch"),this.minimapId=t.pointerId;try{t.currentTarget.setPointerCapture(t.pointerId)}catch{}t.preventDefault(),this.minimapGo(t)}}minimapMove(t){t.pointerId===this.minimapId&&this.minimapGo(t)}minimapUp(t){t.pointerId===this.minimapId&&(this.minimapId=null)}minimapGo(t){const e=this.host.minimap(),i=this.host.walk();if(!e||!i)return;const o=t.currentTarget.getBoundingClientRect();let[n,a]=e.toM(t.clientX-o.left,t.clientY-o.top);const r=this.host.world()?.levels.find(l=>l.id===i.ctrl.level)?.extent;r&&(n=Math.min(Math.max(n,r.minX+Y),Math.max(r.minX+Y,r.maxX-Y)),a=Math.min(Math.max(a,r.minZ+Y),Math.max(r.minZ+Y,r.maxZ-Y))),i.goTo({id:"minimap",kind:"centre",label:"",level:i.ctrl.level,x:n,z:a,heading_deg:i.ctrl.heading,pitch_deg:i.ctrl.pitch,eye_m:null})}}const xa={live:"live-text",recorded:"recorded-text",offline:"offline-text",stale:"stale-text",unknown:"unknown-text",danger:"danger-text",warning:"warning-text",success:"live-text",forbidden:"forbidden-text",accent:"accent-text","text-3":"text-2","map-label":"text-2"},Ma=s=>`var(--sw-${xa[s]??s})`,Ts={color:"#ffb98a",alpha:.42},Sa=.9;class Ka{constructor(){this.recipe=wi,this.quality=2,this.view=null,this.mount=null}async render(t,e){this.release();const i=performance.now(),{width:o,height:n}=e,a=gi(t(e.variant),e.levelId,e.variant),r=document.createElement("div");r.setAttribute("aria-hidden","true"),r.dataset.stillBake="",r.style.cssText=`position:fixed;left:${-(o+64)}px;top:0;width:${o}px;height:${n}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(r),this.mount=r;const l=new Ae({mount:r,color:bi(e.style),onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1,night:vi(e.band).night});if(this.view=l,l.setDescription(a),!l.setPreset(e.preset))throw new Error("המבט של התמונה המוכנה אינו זמין לקומה זו.");l.capture();const h=l.renderer.domElement;if(h.width!==o||h.height!==n)throw new Error("גודל הציור אינו תואם את גודל התמונה המוכנה.");const d=document.createElement("canvas");d.width=o,d.height=n;const p=d.getContext("2d");if(!p)throw new Error("ציור דו־ממדי אינו זמין בדפדפן.");p.fillStyle=yi(e.style,e.band),p.fillRect(0,0,o,n),p.drawImage(h,0,0),e.band==="sunset"&&(p.globalCompositeOperation="multiply",p.globalAlpha=Ts.alpha,p.fillStyle=Ts.color,p.fillRect(0,0,o,n),p.globalCompositeOperation="source-over",p.globalAlpha=1);const u=await _a(d),f=w=>{const y=l.projectPoint(w);return y?[y.x,y.y]:null};let v="";try{const w=l.rendererInfo();v=`${w.vendor} ${w.renderer}`.trim().slice(0,160)}catch{v=""}return{blob:u,project:f,renderer:v,ms:Math.round(performance.now()-i)}}release(){this.view?.dispose(),this.view=null,this.mount?.remove(),this.mount=null}dispose(){this.release()}}function _a(s){const t=e=>new Promise(i=>s.toBlob(o=>i(o),e,Sa));return t("image/webp").then(async e=>{if(e&&e.type==="image/webp")return e;const i=await t("image/jpeg");if(!i)throw new Error("קידוד התמונה נכשל.");return i})}function Xa(s,t,e){const i=document.createElement("canvas");i.width=s,i.height=t;const o=i.getContext("2d");if(!o)return Promise.reject(new Error("ציור דו־ממדי אינו זמין בדפדפן."));const n=o.createImageData(s,t);return n.data.set(e),o.putImageData(n,0,0),new Promise((a,r)=>i.toBlob(l=>l?a(l):r(new Error("קידוד מפת התאורה נכשל.")),"image/png"))}var Pa=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,P=(s,t,e,i)=>{for(var o=i>1?void 0:i?Aa(t,e):t,n=s.length-1,a;n>=0;n--)(a=s[n])&&(o=(i?a(t,e,o):a(o))||o);return i&&o&&Pa(t,e,o),o};const Ea="ייצוא glTF נכשל",Ta="עבר לרמה סכמטית — קצב הפריימים היה נמוך",za=s=>s==="schematic"?Ta:`עבר ל${me[s]} — קצב הפריימים היה נמוך`,$a=6e4,La=4e3,jt="sw.plan3d.fallback",zs="sw.plan3d.night",he="sw.plan3d.walkguard",Ia=30,$s=6,Da=2,Ls=["pointerdown","pointermove","keydown","wheel","touchstart"],Ra="נעילת סמן אינה זמינה בדף הזה — המבט נשאר בגרירה",ce={desktop:62,touch:70,portrait:76},de=3.5,Ca=2600,Na=[],Fa=[0,0,0];function Oa(s,t){return s===t?!0:!t||s.length!==t.length?!1:s.every((e,i)=>e.id===t[i].id&&e.name===t[i].name&&e.elevation_m===t[i].elevation_m)}function qa(s,t){if(s===t)return!0;if(!t)return!1;const e=Object.keys(s);return e.length!==Object.keys(t).length?!1:e.every(i=>{const o=s[i],n=t[i];return!!n&&o.presence===n.presence&&o.open===n.open&&o.lit===n.lit})}const Is=new WeakMap;function ue(s,t,e){let i=Is.get(s);i||Is.set(s,i={}),!(i[t]===e&&s.style[t]===e)&&(i[t]=e,s.style[t]=e)}function Ga(s){return s.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}function Ua(s,t){const e=s.bands.find(l=>l.farFloor?.id===t),i=e?.ramps[0];if(!e||!i)return null;const o=Math.hypot(i.b[0]-i.a[0],i.b[1]-i.a[1])||1,n=(i.b[0]-i.a[0])/o,a=(i.b[1]-i.a[1])/o,r=(Math.atan2(-n,a)*180/Math.PI+360)%360;return{id:`twin:${e.id}`,kind:"centre",label:"",level:e.from,x:i.a[0]-n*.6,z:i.a[1]-a*.6,heading_deg:r,pitch_deg:0,eye_m:null}}function Ds(s,t){const e=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());if(!e)return s;const i=e[1].length===3?e[1].split("").map(o=>o+o).join(""):e[1];return`rgba(${parseInt(i.slice(0,2),16)}, ${parseInt(i.slice(2,4),16)}, ${parseInt(i.slice(4,6),16)}, ${t})`}const Ha={wall:"קיר",opening:"פתח",object:"עצם",connector:"מחבר",camera:"מצלמה",entity:"ישות",zone:"חדר",label:"תווית",level:"מפלס"},pe=(s,t)=>{try{return(s==="local"?localStorage:sessionStorage).getItem(t)}catch{return null}},ft=(s,t,e)=>{try{const i=s==="local"?localStorage:sessionStorage;e===null?i.removeItem(t):i.setItem(t,e)}catch{}},fe=s=>s==="schematic"?"1":s==="full"?"2":s;let _=class extends Cs{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.frameKey=null,this.cameras=[],this.labels={},this.exportName="plan-3d",this.levels=[],this.activeLevel=null,this.thumbnailScene=null,this.levelDots={},this.qualityDefault=null,this.minFps=Ia,this.continuous=!1,this.walkable=!1,this.stillsAvailable=!1,this.idleS=0,this.changeKey="",this.qualityForce=null,this.kiosk=!1,this.themeForce=null,this.sunAt=null,this.walkState="off",this.walkShown=null,this.walkAim=null,this.walkNote=null,this.crossFloor=null,this.viewDials={...ee},this.idle=!1,this.hasIdleStill=!1,this.kioskIdle=null,this.pauseGate=new ca,this.lockGate=new pa(void 0,()=>this.onLockRefused()),this.lockStop=null,this.onActivity=()=>this.kioskIdle?.input(),this.walk=null,this.walkNoteTimer=0,this.walkShownAt=0,this.walkAimAt=0,this.minimapFrame=null,this.walkArrivedFrom=null,this.hover=null,this.overlays=[],this.overlayById=new Map,this.pillSizes=new Map,this.hiddenPills=0,this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.chosen=ki(),this.installMode=null,this.fallbackRung=Tt(pe("session",jt)),this.perfHint=null,this.walkDrop=Tt(pe("session",he)),this.dialsReady=!1,this.timeManual=null,this.timeOpen=!1,this.sunShown=null,this.site=se(null),this.clockTimer=0,this.night=pe("local",zs)==="1",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null,this.probe=null,this.probeTimer=0,this.probed=!1,this.probePending=!1,this.thumbs=new Map,this.thumbsFor=null,this.thumbsQuality=null,this.thumbPass=0,this.settingsAsked=!1,this.ownAsked=!1,this.overlayEls=null,this.realisticNotified=null,this.onVisibility=()=>{this.kioskIdle?.setVisible(!document.hidden),this.setPause("hidden",document.hidden),document.hidden?this.probe&&(this.endProbe(!1),this.probePending=!0):this.probePending&&(zt(this.rung)||this.measuresLevel1())&&this.view&&this.startProbe()},this.onIdleSlot=s=>{this.hasIdleStill=s.target.assignedElements().length>0},this.routeDwellMs=0,this.ui=new ka({view:()=>this.view,walk:()=>this.walk,hud:()=>this.renderRoot.querySelector("sw-walk-hud"),world:()=>this.description?.walk??null,minimap:()=>this.minimapFrame,select:s=>this.emitSelect(s),message:(s,t)=>this.walkMessage(s,t),touching:s=>{this.toggleAttribute("data-walk-touch",s),s&&(this.walkAim=null)}}),this.minimapPalette=null,this.cornerSent=void 0}firstUpdated(){this.watchBar(),this.init()}watchBar(){const s=this.renderRoot.querySelector(".bar");!s||typeof ResizeObserver>"u"||(this.barRo?.disconnect(),this.barRo=new ResizeObserver(()=>{const t=Math.ceil(s.getBoundingClientRect().height);t>0&&this.style.setProperty("--bar-h",`${t}px`)}),this.barRo.observe(s))}connectedCallback(){super.connectedCallback(),this.pauseGate.set("hidden",document.hidden)&&this.toggleAttribute("data-paused",this.pauseGate.paused),this.hasUpdated&&!this.view&&this.init(),document.addEventListener("visibilitychange",this.onVisibility),this.lockStop??=this.lockGate.attach(),this.hasUpdated&&this.setupIdle()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("visibilitychange",this.onVisibility),this.lockStop?.(),this.lockStop=null,this.disposeIdle(),window.clearInterval(this.clockTimer),this.themeObserver?.disconnect(),this.themeObserver=void 0,this.realisticNotified=null,this.cornerSent=void 0,this.ro?.disconnect(),this.barRo?.disconnect(),cancelAnimationFrame(this.thumbPass),this.thumbPass=0,this.endProbe(!1),this.probed=!1,this.probePending=!1,this.stopWalk(!1),window.clearTimeout(this.walkNoteTimer),this.view?.dispose(),this.view=null,this.applied=null,this.thumbs.clear(),this.thumbsFor=null,window.clearTimeout(this.toastTimer)}get mode(){const s=this.dialsReady&&this.viewDials.quality!=="auto"?this.viewDials.quality:null,t=Tt(this.qualityDefault);return this.qualityForce??this.chosen??s??t??this.installMode??"auto"}get autoStartRung(){return xi(this.viewDials.default_view,2)}get rung(){const s=Mi(this.mode,this.autoStartRung,this.fallbackRung),t=this.walkDrop;return this.walkState==="on"&&t&&De.indexOf(t)>De.indexOf(s)?t:s}get quality(){return Si(this.rung)}get fallback(){return this.mode==="auto"&&this.fallbackRung!==null&&this.rung===this.fallbackRung}init(){if(this.ownAsked||(this.ownAsked=!0,_i().then(s=>{s&&s!==this.chosen&&(this.chosen=s)})),!this.settingsAsked){this.settingsAsked=!0;const s=ms(Pi().then(e=>e),fs,{}).catch(()=>({})),t=ms(Ai().then(e=>({dials:e.effective,location:e.location})),fs,{dials:{...ee},location:void 0}).catch(()=>({dials:{...ee},location:void 0}));Promise.all([s,t]).then(([e,i])=>{this.installMode=Tt(e["plan.quality"])??"schematic",this.site=se(i.location,e["time.zone"]);const o=i.dials;this.viewDials={...o,mouse_mode:this.lockGate.effectiveMode(o.mouse_mode)},this.dialsReady=!0}).finally(()=>{this.isConnected&&!this.view&&this.init()});return}try{this.view=new Ae({mount:this.stage,color:s=>getComputedStyle(this).getPropertyValue(`--sw-${s}`).trim()||"#888888",onSelect:(s,t,e)=>this.onViewSelect(s,t,e),onHover:(s,t,e)=>this.setHover(s,t,e),onFrame:(s,t)=>{this.setAttribute("data-frames",String(s)),this.setAttribute("data-fps",String(t)),this.onProbeFrame(s)},onDraw:()=>this.layoutOverlays(),onAsset:()=>this.setAttribute("data-real-pending",String(this.view?.realPending??0)),quality:this.quality,night:this.night,real:this.realSettings(),dprCap:this.viewDials.dpr_cap}),this.toggleAttribute("data-night",this.night)}catch(s){console.warn("sw-plan-3d: WebGL failed to start",s),this.error=Ei,this.dispatchEvent(new CustomEvent("stills-fallback",{detail:{reason:"webgl"},bubbles:!0,composed:!0}));return}this.view.setContinuous(this.continuous),this.view.setPaused(this.pauseGate.paused),this.view.setRealSettings({motion:this.viewDials.motion}),this.applySun(),this.startClock(),this.watchTheme(),this.notifyRealistic(),this.ro=new ResizeObserver(()=>this.view?.resize()),this.ro.observe(this),this.presetApplied=!1,this.setAttribute("data-quality",String(this.quality)),this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}willUpdate(s){if(!(s.has("description")||s.has("activeLevel")||s.has("selectedId")||s.has("hover")||s.has("walkState")))return;const t=this.description?.parts??[],e=t.filter(o=>o.kind==="chip");let i=t.filter(o=>o.kind==="entity"&&(!this.activeLevel||o.level_id===this.activeLevel));if(this.hiddenPills=0,this.walkState==="on")i=i.filter(o=>o.userData.id===this.selectedId||o.userData.id===this.hover?.id);else if(i.length>(this.quality===3&&this.clientWidth>0&&this.clientWidth<Ti?zi:$i)){const o=i.filter(n=>n.userData.id===this.selectedId||n.userData.id===this.hover?.id||n.color!=="text-3");this.hiddenPills=i.length-o.length,i=o}this.overlays=[...e,...i],this.overlayById=new Map(this.overlays.map(o=>[o.id,o]))}updated(s){if(this.overlayEls=null,this.syncCorner(),s.has("sunAt")&&this.toggleAttribute("data-sun-fixed",this.sunAt!==null),this.syncKiosk(s),!this.view)return;const t=s.has("frameKey")&&s.get("frameKey")!==void 0;t&&(this.presetApplied=!1),t&&this.walkState==="on"&&(this.walkArrivedFrom=String(s.get("frameKey")??"")),s.has("description")&&this.description&&this.apply(this.description),s.has("description")&&this.syncWalk(),t&&!this.presetApplied&&this.applied&&this.frame(),(s.has("selectedId")||s.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),s.has("preset")&&s.get("preset")!==void 0&&this.applyPreset(this.preset),s.has("continuous")&&!this.probe&&this.view.setContinuous(this.continuous),s.has("sunAt")&&this.applySun(),this.applyQuality(),this.layoutOverlays()}layoutOverlays(){const s=this.view;if(!s||!this.overlays.length)return;const t=this.overlayEls??=[...this.renderRoot.querySelectorAll("[data-3d-part]")].map(a=>({el:a,p:this.overlayById.get(a.getAttribute("data-3d-part")??"")??null})),e=s.projectPoints(t.map(({p:a})=>a?.position??Fa)),i=[];t.forEach(({el:a,p:r},l)=>{const h=r?e[l]:null;if(!r||!h){ue(a,"display","none");return}ue(a,"display","block"),i.push({el:a,p:r,x:Math.round(h.x),y:Math.round(h.y)})});const o=[];for(const a of i){if(a.p.kind==="chip")continue;const r=`${a.p.id}|${a.p.text??""}`;let l=this.pillSizes.get(r);l||(l={w:a.el.offsetWidth,h:a.el.offsetHeight},l.w>0&&l.h>0&&this.pillSizes.set(r,l)),o.push({id:a.p.id,x:a.x,y:a.y-$s,w:l.w,h:l.h})}const n=o.length>1?xo(o,Da):null;for(const{el:a,p:r,x:l,y:h}of i)ue(a,"transform",r.kind==="chip"?`translate(${l}px, ${h}px) translate(-50%, -50%)`:`translate(${l}px, ${h-$s+Math.round(n?.get(r.id)??0)}px) translate(-50%, -100%)`)}apply(s){s!==this.applied&&(this.applied=s,this.view?.setDescription(s),this.setAttribute("data-parts",String(s.parts.length)),this.toggleAttribute("data-estimated",s.estimated),this.presetApplied||this.frame(),this.view?.setSelected(this.selectedId),(zt(this.rung)||this.measuresLevel1())&&!this.probed&&this.startProbe())}realSettings(){return{rung:this.rung==="realistic"?"realistic":"lite",style:Li(this.themeForce??this.viewDials.style,this.uiTheme()),furniture:this.viewDials.furniture,textures:this.viewDials.textures,sectionCut:this.viewDials.section_cut}}uiTheme(){return this.themeForce??(document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light")}watchTheme(){this.themeObserver||typeof MutationObserver>"u"||(this.themeObserver=new MutationObserver(()=>{this.minimapPalette=null,this.view?.setRealSettings({style:this.realSettings().style}),this.applySun(),this.requestUpdate()}),this.themeObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["data-theme"]}))}notifyRealistic(){const s=this.quality===3;s!==this.realisticNotified&&(this.realisticNotified=s,this.dispatchEvent(new CustomEvent("realistic-change",{detail:{on:s},bubbles:!0,composed:!0})))}applyQuality(){const s=this.quality,t=this.rung;if(this.setAttribute("data-quality",String(s)),this.setAttribute("data-rung",t),this.setAttribute("data-quality-mode",this.mode),!this.view)return;const e=t==="realistic"?"realistic":"lite",i=this.view.getQuality()===s&&(s!==3||this.view.getRealSettings().rung===e);this.view.setRealSettings({rung:e}),!i&&(this.view.setQuality(s),this.thumbs.clear(),this.probed=!1,this.notifyRealistic(),this.applySun(),(zt(t)||this.measuresLevel1())&&this.applied?this.startProbe():this.endProbe(!1),this.requestUpdate())}sunInstant(){if(this.sunAt!==null&&Number.isFinite(this.sunAt))return this.sunAt;const s=this.timeManual;return s?Ii(s.ymd[0],s.ymd[1],s.ymd[2],s.hour,this.site.zone):Date.now()}applySun(){const s=this.view;if(!s)return;const t=this.sunInstant();s.setSun({utcMs:t,latitude:this.site.latitude,longitude:this.site.longitude});const e=s.sunState();if(this.quality===3&&e){const i=$t(t,this.site.zone);this.sunShown={hour:i.hour+i.minute/60,band:Di(e.elevation),elevation:Math.round(e.elevation)};const[o,n,a]=s.skyBackdrop();this.style.setProperty("--sky-top",o),this.style.setProperty("--sky-hor",n),this.style.setProperty("--sky-bot",a),this.setAttribute("data-sun-elevation",String(Math.round(e.elevation))),this.setAttribute("data-style",s.getRealSettings().style)}else this.sunShown=null}setSite(s){this.site=se(s,this.site.zone),this.applySun(),this.requestUpdate()}startClock(){window.clearInterval(this.clockTimer),this.viewDials.time_source==="manual"&&!this.timeManual&&this.setTimeHour($t(Date.now(),this.site.zone).hour),this.clockTimer=window.setInterval(()=>{!this.timeManual&&this.sunAt===null&&this.quality===3&&this.applySun()},$a)}setTimeHour(s){const t=$t(Date.now(),this.site.zone),e=this.timeManual?.ymd??[t.year,t.month,t.day];this.timeManual={hour:Math.max(0,Math.min(24,s)),ymd:e},this.applySun()}setTimeDate(s){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!t)return;const e=this.timeManual?.hour??this.sunShown?.hour??12;this.timeManual={hour:e,ymd:[Number(t[1]),Number(t[2]),Number(t[3])]},this.applySun()}timeNow(){this.timeManual=null,this.applySun()}setNight(s){s!==this.night&&(this.night=s,ft("local",zs,s?"1":null),this.toggleAttribute("data-night",s),this.view?.setNight(s),this.thumbs.clear(),this.requestUpdate())}get isNight(){return this.night}setQuality(s){this.setMode(Ri(s))}setMode(s){const t=this.perfHint;this.chosen=s,Ci(s),this.fallbackRung=null,this.perfHint=null,this.walkDrop=null,ft("session",jt,null),ft("session",he,null),this.probed=!1,s==="auto"&&t&&(this.fallbackRung=t,ft("session",jt,fe(t)))}startProbe(){if(this.endProbe(!1),this.probed=!0,!this.view||this.minFps<=0)return;if(document.hidden||this.pauseGate.paused){this.probePending=!0;return}this.probePending=!1;const s=performance.now();this.probe={until:0,t0:0,f0:0,start:Number(this.getAttribute("data-frames")??0),s0:s,lt:0,lf:0,watch:new Ni(this.minFps,Fi(this.minFps),ye)},this.view.setContinuous(!0),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),yo)}onProbeFrame(s){const t=this.probe;if(!t)return;if(document.hidden){this.endProbe(!1),this.probePending=!0;return}const e=performance.now();if(!t.t0){if(s-t.start<ko)return;t.t0=t.lt=e,t.f0=t.lf=s,t.until=e+ye,window.clearTimeout(this.probeTimer),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),bo);return}const i=t.watch.sample((s-t.lf)*1e3/Math.max(1,e-t.lt),t.lt,e);t.lt=e,t.lf=s,!(!i&&e<t.until)&&(this.setAttribute("data-probe-fps",String(Math.round((s-t.f0)*1e3/Math.max(1,e-t.t0)))),this.endProbe(!1),i&&this.onLowFps())}endProbe(s){window.clearTimeout(this.probeTimer),this.probeTimer=0;const t=this.probe;if(this.probe=null,this.view?.setContinuous(this.continuous),s&&t&&document.hidden){this.probePending=!0;return}if(s&&t){const e=Number(this.getAttribute("data-frames")??0),i=performance.now(),o=t.t0?(e-t.f0)*1e3/Math.max(1,i-t.t0):0;this.setAttribute("data-probe-fps",String(Math.round(o))),(t.t0?t.watch.sample((e-t.lf)*1e3/Math.max(1,i-t.lt),t.lt,i):t.watch.sample(0,t.s0,i))&&this.onLowFps()}}onLowFps(){const s=Re(this.rung);if(!s){this.measuresLevel1()&&this.dispatchEvent(new CustomEvent("stills-fallback",{detail:{reason:"fps"},bubbles:!0,composed:!0}));return}this.mode==="auto"?(this.fallbackRung=s,ft("session",jt,fe(s))):this.perfHint=s}syncKiosk(s){s.has("idleS")&&this.setupIdle(),s.has("themeForce")&&(this.minimapPalette=null),s.has("themeForce")&&s.get("themeForce")!==void 0&&this.view&&(this.view.setRealSettings({style:this.realSettings().style}),this.applySun()),s.has("changeKey")&&s.get("changeKey")!==void 0&&this.kioskIdle?.change(),s.has("walkState")&&this.kioskIdle?.hold("walk",this.walkState!=="off")}setupIdle(){const s=this.idleS;if(!(s>0)){this.disposeIdle();return}if(this.kioskIdle){this.kioskIdle.setIdleS(s);return}this.kioskIdle=new ha({idleS:s,onChange:(t,e)=>this.onIdlePhase(t==="idle",e)});for(const t of Ls)window.addEventListener(t,this.onActivity,{capture:!0,passive:!0});this.walkState!=="off"&&this.kioskIdle.hold("walk",!0)}disposeIdle(){if(this.kioskIdle){this.kioskIdle.dispose(),this.kioskIdle=null;for(const s of Ls)window.removeEventListener(s,this.onActivity,{capture:!0});this.idle&&this.onIdlePhase(!1,"config")}}onIdlePhase(s,t){this.idle=s,this.toggleAttribute("data-idle",s),this.setPause("idle",s),this.dispatchEvent(new CustomEvent("kiosk-idle",{detail:{idle:s,reason:t},bubbles:!0,composed:!0}))}setPause(s,t){this.pauseGate.set(s,t)&&this.applyPause()}applyPause(){const s=this.pauseGate.paused;s&&this.probe&&(this.endProbe(!1),this.probePending=!0),this.view?.setPaused(s),this.toggleAttribute("data-paused",s),s||(this.requestUpdate(),this.probePending&&this.view&&(zt(this.rung)||this.measuresLevel1())&&this.startProbe())}onLockRefused(){this.viewDials={...this.viewDials,mouse_mode:"drag"},this.walk?.setMouseMode("drag"),this.walkState==="on"&&this.walkMessage(Ra,"info")}measuresLevel1(){return this.fallback&&this.stillsAvailable&&this.rung==="schematic"}frame(){this.presetApplied=!0,this.view?.setPreset(this.preset)?this.setAttribute("data-preset",typeof this.preset=="string"?this.preset:"camera"):this.view?.setPreset("iso")&&this.setAttribute("data-preset","iso")}applyPreset(s){this.view?.setPreset(s)&&this.setAttribute("data-preset",typeof s=="string"?s:"camera")}pickPreset(s){this.preset=s,this.applyPreset(s)}labelOf(s){return this.labels[s.id]??Ha[s.kind]??s.id}emitSelect(s){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:s?.id??null,kind:s?.kind??null},bubbles:!0,composed:!0}))}setHover(s,t,e){this.hover=s?{id:s.id,kind:s.kind,label:this.labelOf(s),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}pickLevel(s){const t=this.activeLevel===s?null:s;this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t},bubbles:!0,composed:!0}))}playRoute(){return this.walk?.playRoute()??!1}stopRoute(){this.walk?.cancelRoute()}get routePlaying(){return this.walk?.routePlaying??!1}requestWalk(){this.walkState!=="off"||!this.view||(this.walkState="requested",this.description?.walk?this.startWalk():this.dispatchEvent(new CustomEvent("walk-change",{detail:{on:!0},bubbles:!0,composed:!0})))}syncWalk(){const s=this.description?.walk;if(this.walkState==="requested"&&s)this.startWalk();else if(this.walkState==="on")if(!s)this.stopWalk(!0);else if(this.walkArrivedFrom!==null&&s!==this.walk?.ctrl.world){const t=this.walkArrivedFrom;this.walkArrivedFrom=null,this.startWalk(Ua(s,t)??void 0)}else this.walk?.setWorld(s)}get walking(){return this.walkState==="on"}get walkController(){return this.walk?.ctrl??null}walkFov(){return this.clientHeight>this.clientWidth*1.15?ce.portrait:typeof matchMedia=="function"&&matchMedia("(pointer: coarse)").matches?ce.touch:ce.desktop}startWalk(s){const t=this.description?.walk,e=this.view;if(!t||!e){this.walkState="off";return}this.walk?.dispose(),this.minimapPalette=null;const i=s??t.starts.find(n=>n.id===t.defaultStart)??t.starts[0]??null,o=this.walkFov();this.walk=new ra(t,{canvas:e.renderer.domElement,onPose:()=>this.onWalkPose(),onEvents:n=>this.onWalkEvents(n),onExit:()=>this.stopWalk(!0),onAct:()=>this.walkAct(),onLowFps:()=>this.onWalkLowFps(),...this.ui.hooks()},{eye_m:this.viewDials.eye_m,mouseMode:this.viewDials.mouse_mode,start:i,fov:o,ease:this.viewDials.motion,fadeMs:this.viewDials.motion?void 0:0,routeDwellMs:this.routeDwellMs||void 0}),e.enterWalk(this.walkCameraPose(),o,this.viewDials.motion?Ks:0),this.endProbe(!1),this.walkState="on",this.crossFloor=null,this.setAttribute("data-walk",""),this.setAttribute("data-walk-level",this.walk.ctrl.level),this.updateComplete.then(()=>this.onWalkPose(!0))}stopWalk(s){this.walkState!=="off"&&(this.walk?.dispose(),this.walk=null,this.view?.exitWalk(),this.walkState="off",this.walkShown=null,this.walkAim=null,this.crossFloor=null,this.minimapFrame=null,this.minimapPalette=null,this.ui.reset(),this.removeAttribute("data-walk"),this.removeAttribute("data-walk-pos"),this.removeAttribute("data-walk-level"),s&&this.dispatchEvent(new CustomEvent("walk-change",{detail:{on:!1},bubbles:!0,composed:!0})))}walkCameraPose(){const s=this.walk.ctrl.pose();return{x:s.x,y:s.y,z:s.z,heading_deg:s.heading_deg,pitch_deg:s.pitch_deg}}onWalkPose(s=!1){const t=this.walk,e=this.view;if(!t||!e)return;const i=t.ctrl.pose();e.setWalkPose(i),this.drawWalkMinimap(),this.ui.updateTarget(),this.setAttribute("data-walk-pos",`${i.x.toFixed(2)},${i.z.toFixed(2)},${i.heading_deg.toFixed(1)}`);const o=performance.now();(s||o-this.walkShownAt>120)&&(this.walkShownAt=o,this.walkShown={x:i.x,z:i.z,heading:Math.round(i.heading_deg),level:i.level}),(s||o-this.walkAimAt>150)&&!this.ui.touch&&(this.walkAimAt=o,requestAnimationFrame(()=>{if(!this.walk||!this.view)return;const n=this.view.pickCentre(de),a=n&&["entity","camera","object","opening"].includes(n.kind)?n:null;a?.partId!==this.walkAim?.partId&&(this.walkAim=a)}))}onWalkEvents(s){for(const t of s)t.type==="level"?(this.setAttribute("data-walk-level",t.level),this.activeLevel!==null&&this.activeLevel!==t.level&&this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t.level},bubbles:!0,composed:!0}))):t.type==="cross-floor"?this.crossFloor=t.floor:t.type==="blocked"?this.walkMessage(`הדלת ${Oi[t.door.state]}`,"warn"):t.type==="edge"?this.walkMessage("קצה התוכנית","info"):t.type==="path-blocked"?this.walkMessage(B("walk.noWay"),"warn"):t.type==="room"&&(this.view?.setInterior(t.room?this.description?.real?.rooms[t.room.id]?.daylight??null:null),t.room?.name&&this.walkMessage(t.room.name,"info"))}walkMessage(s,t){this.walkNote={text:s,tone:t},window.clearTimeout(this.walkNoteTimer),this.walkNoteTimer=window.setTimeout(()=>this.walkNote=null,Ca)}walkAct(){const s=this.view?.pickCentre(de)??null;s&&this.emitSelect(s)}onWalkLowFps(){const s=Re(this.rung);s&&(this.viewDials.walk_guard?(this.walkDrop=s,ft("session",he,fe(s)),this.walkMessage(`הסיור עבר ל${me[s]} — קצב הפריימים היה נמוך`,"info")):this.perfHint=s)}onViewSelect(s,t,e){const i=this.walk;if(this.walkState!=="on"||!i){this.emitSelect(s);return}if(i.pointerLocked){const n=this.view?.pickCentre(de)??null;n&&this.emitSelect(n);return}if(s&&s.kind!=="zone"){this.emitSelect(s);return}if(t===void 0||e===void 0)return;const o=this.view?.floorPoint(t,e,i.ctrl.pose().ground);o&&!i.walkTo(o[0],o[1])&&this.walkMessage("אין דרך פתוחה לשם","warn")}drawWalkMinimap(){const s=this.renderRoot.querySelector("canvas.minimap"),t=this.walk,e=this.description?.walk;if(!s||!t||!e)return;const i=s.clientWidth||160,o=Math.min(2,window.devicePixelRatio||1);s.width!==Math.round(i*o)&&(s.width=Math.round(i*o),s.height=Math.round(i*o));const n=s.getContext("2d");n&&(n.setTransform(o,0,0,o,0,0),this.minimapFrame=ma(n,e,t.ctrl.pose(),t.ctrl.path,i,this.minimapPalette??=this.readMinimapPalette()))}readMinimapPalette(){const s=getComputedStyle(this),t=(i,o)=>s.getPropertyValue(`--sw-${i}`).trim()||o,e=t("accent","#2767ed");return{bg:t("surface-solid","#ffffff"),wall:t("map-structure","#56617a"),low:t("map-wall","#9aa3b5"),window:t("map-glass","#7fb2ff"),doorOpen:t("live","#22c55e"),doorClosed:t("danger","#ef4444"),object:t("text-3","#9aa3b5"),stair:t("text-2","#6b7f99"),room:Ds(e,.07),path:t("live","#22c55e"),me:e,meRing:Ds(e,.25)}}renderWalk(){return this.walkState!=="on"||!this.walk?L:T`
      <canvas class="minimap" data-walk-minimap role="img" aria-label="מפה קטנה של המפלס; לחיצה מעבירה לנקודה"
        @pointerdown=${s=>this.ui.minimapDown(s)} @pointermove=${s=>this.ui.minimapMove(s)}
        @pointerup=${s=>this.ui.minimapUp(s)} @pointercancel=${s=>this.ui.minimapUp(s)}></canvas>
      <span class="cross" ?data-aim=${!!this.walkAim} aria-hidden="true"></span>
      ${this.walkAim?T`<span class="pill aim" data-walk-aim>${this.labelOf(this.walkAim)} · Enter</span>`:L}
      ${this.walkNote?T`<span class="pill walknote" role="status" data-tone=${this.walkNote.tone} data-walk-note>${this.walkNote.text}</span>`:L}
      ${this.crossFloor?T`<span class="pill cross-floor" role="status" data-walk-cross=${this.crossFloor.id}>המדרגות ממשיכות ל${this.crossFloor.name??"קומה אחרת"}
            <sw-button size="lg" variant="ghost" data-walk-cross-go @click=${()=>this.dispatchEvent(new CustomEvent("floor-request",{detail:{floorId:this.crossFloor.id},bubbles:!0,composed:!0}))}>המשך לקומה</sw-button></span>`:L}
      <sw-walk-hud .starts=${this.description?.walk?.starts??Na} .shown=${this.walkShown}
        @hud-exit=${()=>this.stopWalk(!0)} @hud-goto=${s=>this.ui.goto(s)} @hud-field=${s=>this.ui.field(s)} @hud-route=${s=>this.ui.routeToggle(s)}></sw-walk-hud>`}thumbFor(s){const t=this.thumbnailScene;if(!t||!this.view)return"";(this.thumbsFor!==t||this.thumbsQuality!==this.quality)&&(this.thumbs.clear(),this.thumbsFor=t,this.thumbsQuality=this.quality);const e=this.thumbs.get(s);return e===void 0&&this.scheduleThumbs(),e??""}scheduleThumbs(){this.thumbPass||this.pauseGate.paused||(this.thumbPass=requestAnimationFrame(()=>{this.thumbPass=0;const s=this.thumbnailScene,t=this.view;if(!s||!t||this.thumbsFor!==s)return;let e=!1;for(const i of this.levels){if(this.thumbs.has(i.id))continue;const o=t.renderThumbnail(s,i.id);o&&(this.thumbs.set(i.id,o),e=!0)}e&&t.redrawNow(),this.setAttribute("data-3d-thumbs",String(this.thumbs.size)),e&&this.requestUpdate()}))}get thumbnailCount(){return this.thumbs.size}toScreen(s){return this.view?.projectPoint(s)??null}capture(){return this.view?.capture()??null}captureControl(s){return vo(s,Ki,ji,Bi,Wi)}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const s=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(s)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${Ga(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(s){console.warn("sw-plan-3d: glTF export failed",s),this.showToast(Ea)}finally{this.exporting=!1}}}showToast(s){this.toast=s,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",La)}renderStrip(){if(this.levels.length<2||!this.thumbnailScene||!this.ready)return L;const s=[...this.levels].sort((t,e)=>e.elevation_m-t.elevation_m||(t.id<e.id?-1:1));return this.thumbs=qi(this.thumbs,s.map(t=>t.id)),T`<div class="strip" role="group" aria-label="מפלסים" data-3d-strip>
      ${s.map(t=>{const e=this.levelDots[t.id];return T`<button type="button" data-3d-thumb=${t.id} aria-pressed=${this.activeLevel===t.id?"true":"false"} title=${`${t.name} · ${t.elevation_m>=0?"+":"−"}${Math.abs(t.elevation_m).toFixed(1)} מ׳`} @click=${()=>this.pickLevel(t.id)}>
          <span class="pic"><img alt="" src=${this.thumbFor(t.id)} />${e&&(e.presence>0||e.open||e.lit)?T`<span class="dots" data-3d-dots=${t.id}>${e.presence>0?T`<i data-dot="presence" title="תנועה" style=${`--fade:${Math.max(.35,e.presence).toFixed(2)}`}></i>`:L}${e.open?T`<i data-dot="open" title="פתח פתוח"></i>`:L}${e.lit?T`<i data-dot="lit" title="תאורה דולקת"></i>`:L}</span>`:L}</span><span>${t.name}</span>
        </button>`})}
    </div>`}cornerKind(){return this.walkState==="on"?this.walk?"minimap":null:this.quality===3&&this.sunShown&&this.sunAt===null&&!this.kiosk?"pill":null}syncCorner(){const s=this.cornerKind();s!==this.cornerSent&&(this.cornerSent=s,s?this.setAttribute("data-corner",s):this.removeAttribute("data-corner"),this.dispatchEvent(new CustomEvent("hud-corner",{detail:{corner:s},bubbles:!0,composed:!0})))}renderTime(){const s=this.sunShown;if(!s||this.walkState==="on"||this.sunAt!==null)return L;const t=s.band==="day"?"☀":s.band==="night"?"☾":"◐",e=$t(Date.now(),this.site.zone),i=this.timeManual?.ymd??[e.year,e.month,e.day],o=`${i[0]}-${String(i[1]).padStart(2,"0")}-${String(i[2]).padStart(2,"0")}`;return T`<div class="timepill" role="group" aria-label="שעה ביום" data-3d-time data-band=${s.band}>
        <button type="button" class="tp" aria-expanded=${this.timeOpen?"true":"false"} data-3d-time-toggle @click=${()=>this.timeOpen=!this.timeOpen}><span aria-hidden="true">${t}</span> <span class="hh" data-3d-time-label>${Gi(s.hour)}</span></button>
        ${this.timeManual?T`<button type="button" class="now" data-3d-time-now @click=${()=>this.timeNow()}>עכשיו</button>`:L}
      </div>
      ${this.timeOpen?T`<div class="timepop" data-3d-time-pop>
            <input type="range" min="0" max="24" step="0.25" aria-label="שעה ביום" data-3d-time-slider .value=${String(s.hour)} @input=${n=>this.setTimeHour(Number(n.target.value))} />
            <div class="row"><input type="date" lang=${Hi()} aria-label="תאריך" data-3d-time-date .value=${o} @change=${n=>this.setTimeDate(n.target.value)} /><span>${Ui[s.band]} · שמש ${s.elevation}°</span></div>
            ${this.site.known?L:T`<div class="muted" data-3d-site-default>מיקום האתר לא הוגדר: מרכז הארץ</div>`}
          </div>`:L}`}render(){const s=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,""),e=this.quality;return T`
      <div class="stage"></div>
      ${!this.ready&&!this.error?T`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>`:L}
      ${this.error?T`<div class="spinner err" data-3d-error>${this.error}</div>`:L}
      ${this.overlays.length?T`<div class="overlay">${this.overlays.map(i=>i.kind==="chip"?T`<span class="chip" aria-hidden="true" data-3d-chip=${i.userData.id} data-3d-chip-part=${i.id} data-3d-part=${i.id}>${i.text??""}</span>`:T`<button type="button" class="lbl" tabindex="-1" data-3d-label=${i.userData.id} data-3d-part=${i.id} aria-pressed=${this.selectedId===i.userData.id?"true":"false"} style=${`--lbl: ${Ma(i.color)}`} @click=${()=>this.emitSelect({id:i.userData.id,kind:i.userData.kind,partId:i.id})}>${i.text??""}</button>`)}${this.hiddenPills?T`<span class="more" data-3d-more=${this.hiddenPills} title="ישויות ללא מצב מיוחד מוסתרות במבט הכללי; בחירה ברשימה או במפלס מציגה אותן">+${this.hiddenPills} ישויות</span>`:L}</div>`:L}
      ${this.renderStrip()}
      ${this.renderWalk()}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${s==="top"} @click=${()=>this.pickPreset("top")}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${s==="iso"} @click=${()=>this.pickPreset("iso")}>איזומטרי</sw-chip>
        <sw-chip data-preset-persp ?selected=${s==="persp"} @click=${()=>this.pickPreset("persp")}>פרספקטיבה</sw-chip>
        ${this.cameras.length?T`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${t} @change=${i=>this.onCameraChange(i)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map(i=>T`<option value=${i.id} ?selected=${i.id===t}>${i.label}</option>`)}
            </select>`:L}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-auto title="אוטומטי: מתחיל ברמת ברירת המחדל ויורד רמה כשהמכשיר איטי" ?selected=${this.mode==="auto"} @click=${()=>this.setMode("auto")}>אוטומטי</sw-chip>
        <sw-chip data-quality-1 title="רמה סכמטית: חומרים שטוחים, בלי צללים" ?selected=${this.mode!=="auto"&&e===1} @click=${()=>this.setQuality(1)}>סכמטי</sw-chip>
        <sw-chip data-quality-2 title="רמה מלאה: צללים רכים, חומרים, חיתוך קירות" ?selected=${this.mode!=="auto"&&e===2} @click=${()=>this.setQuality(2)}>מלא</sw-chip>
        <sw-chip data-quality-3-lite title="ריאליסטי קל: חומרים אמיתיים, שמש ושמיים, בלי האפקטים הכבדים" ?selected=${this.mode==="lite"} @click=${()=>this.setMode("lite")}>ריאליסטי קל</sw-chip>
        <sw-chip data-quality-3 title="ריאליסטי: חומרים אמיתיים, שמש לפי שעה, הצללה עדינה וזכוכית" ?selected=${this.mode==="realistic"} @click=${()=>this.setMode("realistic")}>ריאליסטי</sw-chip>
        ${e<3?T`<sw-chip data-night-toggle title="מצב לילה: שמיים כהים, אור ירח, החדרים הדלוקים זוהרים" ?selected=${this.night} aria-pressed=${this.night} @click=${()=>this.setNight(!this.night)}>לילה</sw-chip>`:L}
        ${this.walkable?T`<sw-chip data-walk-btn title="סיור בגובה עין: W A S D או החצים להליכה, Shift לריצה, גרירה להסתכלות, לחיצה על הרצפה להליכה לשם, Esc ליציאה" ?selected=${this.walkState!=="off"} @click=${()=>this.requestWalk()}>${this.walkState==="requested"?"טוען סיור…":"סיור"}</sw-chip>`:L}
        <!-- ST7-odd: a surface like the chips beside it - a ghost control over the rendered picture faded into whatever lay behind it -->
        <sw-button size="sm" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?"מייצא…":"ייצוא glTF"}</sw-button>
      </div>
      ${this.description?.estimated?T`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>`:L}
      ${this.fallback?T`<div class="note fb" role="status" data-3d-fallback>${za(this.rung)}</div>`:L}
      ${this.perfHint?T`<div class="pill hint" role="status" data-3d-low-fps=${this.perfHint}>התצוגה איטית במכשיר הזה
            <sw-button size="sm" variant="ghost" data-3d-low-fps-switch @click=${()=>this.setMode(this.perfHint)}>מעבר ל${me[this.perfHint]}</sw-button>
            <button type="button" class="x" aria-label="סגירה" data-3d-low-fps-close @click=${()=>this.perfHint=null}>×</button></div>`:L}
      ${e===3?this.renderTime():L}
      ${e===3?T`<div class="vignette" aria-hidden="true"></div>`:L}
      ${this.toast?T`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:L}
      ${this.hover?T`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:L}
      <div class="idle-still" data-idle-still ?data-on=${this.idle&&this.hasIdleStill} aria-hidden=${this.idle&&this.hasIdleStill?"false":"true"}><slot name="idle-still" @slotchange=${this.onIdleSlot}></slot></div>
    `}onCameraChange(s){const t=s.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};_.styles=Rs`
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
    /* the night sky is dark whatever the theme: the bar and the strip stand on its own opaque navy (a translucent backdrop showed the scene through the chips' row) */
    :host([data-night]) .bar,
    :host([data-night]) .strip {
      background: #0f1729;
      color: #dfe7f5;
    }
    /* CR-029 S1 / S2, level 3: the sky behind the canvas follows the sun and the style (the element sets the stops), the
       canvas carries the style's grade and the vignette (LOOK_SPEC section 1, G2) */
    :host([data-quality='3']) {
      background: linear-gradient(180deg, var(--sky-top, #cfdff2) 0%, var(--sky-hor, #eef3f9) 62%, var(--sky-bot, #d4d8dd) 100%);
    }
    :host([data-quality='3']) .stage canvas {
      filter: contrast(1.06) saturate(1.05);
    }
    :host([data-quality='3'][data-style='dark']) .stage canvas {
      filter: contrast(1.08);
    }
    .vignette {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: radial-gradient(ellipse at center, transparent 45%, rgba(20, 24, 32, 0.32) 100%);
    }
    :host([data-style='dark']) .vignette {
      background: radial-gradient(ellipse at center, transparent 45%, rgba(0, 0, 0, 0.4) 100%);
    }
    /* the top-end corner (map/hud-layout.ts): the pill, its picker and the walk's minimap start past a docked list of the host (--hud-end), and the
       host stacks its circuit buttons below them (this element reports what it keeps there: hud-corner) */
    .timepill {
      position: absolute;
      inset-block-start: ${V}px;
      inset-inline-end: var(--hud-end, ${V}px);
      z-index: var(--sw-z-map-ui);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px;
      border-radius: 999px;
      /* a HUD panel over the 3D canvas is opaque (owner 2026-10-13, styles/menu-surface.ts): the menu surface and the strong hairline, no blur */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      box-shadow: 0 8px 24px rgba(17, 24, 39, 0.1);
      direction: rtl;
    }
    .timepill button {
      font: inherit;
      border: 0;
      background: transparent;
      color: var(--sw-text);
      border-radius: 999px;
      padding: 4px 10px;
      cursor: pointer;
    }
    .timepill .tp .hh {
      font-size: 14px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      direction: ltr;
      display: inline-block;
    }
    .timepill .now {
      font-size: var(--sw-fs-xs);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .timepop {
      position: absolute;
      inset-block-start: ${Yi-4}px;
      inset-inline-end: var(--hud-end, ${V}px);
      /* a menu: it opens over whatever stands under the pill (the host's circuit buttons, the level bar, the floor strip) and above all of it */
      z-index: calc(var(--sw-z-map-ui) + 1);
      display: grid;
      gap: 6px;
      box-sizing: border-box;
      inline-size: min(280px, calc(100% - 24px));
      max-inline-size: calc(100% - var(--hud-end, ${V}px) - ${V}px);
      padding: 10px 12px;
      border-radius: 12px;
      /* the time-of-day picker (date + slider + presets) is a menu over the canvas: opaque, never see-through (owner 2026-10-13); the pill above it is opaque too (second report, same day) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      box-shadow: 0 8px 24px rgba(17, 24, 39, 0.1);
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .timepop input[type='range'] {
      inline-size: 100%;
      direction: ltr;
    }
    .timepop .row {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }
    .timepop input[type='date'] {
      font: inherit;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      padding: 2px 6px;
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .timepop .muted {
      color: var(--sw-text-2);
    }
    /* the slow-device notice: under the host's level bar when that has a row of its own (--hud-hint-top, set by the floor map), and above the
       columns it may cross on a phone - a transient notice, with its own buttons, never hidden behind a chip */
    .pill.hint {
      inset-block-start: var(--hud-hint-top, 56px);
      z-index: calc(var(--sw-z-map-ui) + 1);
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .pill.hint .x {
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      font: inherit;
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
      /* the chips, the select and the export button float on the canvas with no box of their own: the shared controls read --sw-surface, so
         here it is the opaque menu surface, and their hover fill that surface washed 8 % towards the ink (an opaque mix of two tokens the glass
         screens bridge, so it is right in every skin, scheme and glass palette) - glass everywhere else (owner 2026-10-13). Tesla draws its
         chips and secondary buttons flat and transparent on the page: they take the fill from --hud-fill (skins/tesla.ts), so here too. */
      --sw-surface: var(--sw-menu-surface);
      --sw-surface-2: color-mix(in srgb, var(--sw-menu-surface) 92%, var(--sw-text));
      --hud-fill: var(--sw-menu-surface);
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
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-menu-surface);
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
      box-shadow: 0 0 0 1.5px var(--sw-menu-surface);
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
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
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
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
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
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
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
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      direction: rtl;
    }
    .note.fb {
      inset-block-end: 40px;
    }
    /* the bar wraps when it carries every mode chip: the notes stand above it, never over a chip */
    @media (min-width: 641px) {
      :host .note {
        inset-block-end: calc(18px + var(--bar-h, 0px));
      }
      :host .note.fb {
        inset-block-end: calc(46px + var(--bar-h, 0px));
      }
    }
    .spinner {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      background: var(--sw-menu-surface);
    }
    .toast {
      position: absolute;
      inset-block-start: 12px;
      left: calc(50% + (var(--hud-end, ${V}px) - ${V}px) / 2); /* physical: centred whatever the direction - in the free band, past a docked list of the host */
      transform: translateX(-50%);
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 4px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger-text);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
    }
    .err {
      color: var(--sw-danger);
    }
    /* CR-029 S4, the walk: a crosshair, the minimap in the top start corner, one floating walk bar, short notes */
    .cross {
      position: absolute;
      left: 50%;
      top: 50%;
      inline-size: 12px;
      block-size: 12px;
      margin: -6px 0 0 -6px;
      border: 2px solid color-mix(in srgb, var(--sw-surface) 85%, transparent);
      border-radius: 50%;
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--sw-text) 35%, transparent);
      pointer-events: none;
      transition: transform 120ms ease;
    }
    .cross[data-aim] {
      transform: scale(1.5);
      border-color: var(--sw-map-lit);
    }
    .aim {
      position: absolute;
      left: 50%;
      top: calc(50% + 18px);
      transform: translateX(-50%);
      pointer-events: none;
    }
    .minimap {
      position: absolute;
      inset-block-start: ${V}px;
      inset-inline-start: var(--hud-end, ${V}px);
      inline-size: ${Ce}px;
      block-size: ${Ce}px;
      border-radius: 10px;
      box-shadow: var(--sw-shadow-1);
      cursor: pointer;
      z-index: var(--sw-z-map-ui);
      touch-action: none;
    }
    .pill {
      position: absolute;
      left: calc(50% + (var(--hud-end, ${V}px) - ${V}px) / 2); /* the free band's centre: past a docked list of the host */
      transform: translateX(-50%);
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 4px 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
      direction: rtl;
      white-space: nowrap;
    }
    /* the aim label hangs under the crosshair, which is the canvas's centre whatever a host list takes at the edge */
    .pill.aim {
      left: 50%;
    }
    .pill.walknote {
      inset-block-end: 64px;
    }
    .pill.walknote[data-tone='warn'] {
      color: var(--sw-danger-text);
    }
    .pill.cross-floor {
      inset-block-start: 12px;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    /* the one button of the stair's prompt is a finger's target on a phone (S5-A): 44 px whatever the control scale says */
    .pill.cross-floor sw-button {
      --sw-ctl-h-lg: 44px;
    }
    :host([data-walk]) .bar,
    :host([data-walk]) .strip {
      display: none;
    }
    /* S5-A: a finger has no crosshair and no "Enter" hint; the stage is not selectable and a long press is the walk's, not a menu */
    :host([data-walk-touch]) .cross,
    :host([data-walk-touch]) .pill.aim {
      display: none;
    }
    :host([data-walk]) .stage {
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    @media (max-width: ${Xi}px) {
      .minimap {
        inline-size: ${Ne}px;
        block-size: ${Ne}px;
      }
      /* above the bottom sheet's row */
      .pill.walknote {
        inset-block-end: 84px;
      }
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
    /* CR-029 S5-B, the wall display's bare view: the plan and nothing to operate (no bar, level strip, time pill, hints, tooltips) */
    :host([kiosk]) .bar,
    :host([kiosk]) .strip,
    :host([kiosk]) .timepill,
    :host([kiosk]) .timepop,
    :host([kiosk]) .note,
    :host([kiosk]) .pill,
    :host([kiosk]) .toast,
    :host([kiosk]) .tip {
      display: none;
    }
    :host([kiosk]) .stage,
    :host([kiosk]) .overlay {
      pointer-events: none;
    }
    :host([kiosk]) .spinner:not(.err) {
      display: none;
    }
    /* the idle still: the host's baked picture over the stopped view; it takes the wake touch, fades in and out, and is
       always laid out (hidden, not removed) so its picture is loaded before the view idles */
    .idle-still {
      position: absolute;
      inset: 0;
      z-index: calc(var(--sw-z-map-ui) + 2);
      visibility: hidden;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--sw-t-state) ease, visibility 0s linear var(--sw-t-state);
      background: var(--sw-map-bg);
    }
    .idle-still[data-on] {
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
      transition: opacity var(--sw-t-state) ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .idle-still,
      .idle-still[data-on] {
        transition: none;
      }
    }
  `;P([R({attribute:!1})],_.prototype,"description",2);P([R()],_.prototype,"selectedId",2);P([R({attribute:!1})],_.prototype,"preset",2);P([R()],_.prototype,"frameKey",2);P([R({attribute:!1})],_.prototype,"cameras",2);P([R({attribute:!1})],_.prototype,"labels",2);P([R()],_.prototype,"exportName",2);P([R({attribute:!1,hasChanged:(s,t)=>!Oa(s,t)})],_.prototype,"levels",2);P([R()],_.prototype,"activeLevel",2);P([R({attribute:!1})],_.prototype,"thumbnailScene",2);P([R({attribute:!1,hasChanged:(s,t)=>!qa(s,t)})],_.prototype,"levelDots",2);P([R({attribute:!1})],_.prototype,"qualityDefault",2);P([R({type:Number})],_.prototype,"minFps",2);P([R({type:Boolean,reflect:!0,attribute:"data-measure"})],_.prototype,"continuous",2);P([R({type:Boolean})],_.prototype,"walkable",2);P([R({type:Boolean})],_.prototype,"stillsAvailable",2);P([R({type:Number})],_.prototype,"idleS",2);P([R()],_.prototype,"changeKey",2);P([R({attribute:!1})],_.prototype,"qualityForce",2);P([R({type:Boolean,reflect:!0})],_.prototype,"kiosk",2);P([R({attribute:!1})],_.prototype,"themeForce",2);P([R({attribute:!1})],_.prototype,"sunAt",2);P([C()],_.prototype,"walkState",2);P([C()],_.prototype,"walkShown",2);P([C()],_.prototype,"walkAim",2);P([C()],_.prototype,"walkNote",2);P([C()],_.prototype,"crossFloor",2);P([C()],_.prototype,"idle",2);P([C()],_.prototype,"hasIdleStill",2);P([C()],_.prototype,"hover",2);P([C()],_.prototype,"ready",2);P([C()],_.prototype,"exporting",2);P([C()],_.prototype,"error",2);P([C()],_.prototype,"toast",2);P([C()],_.prototype,"chosen",2);P([C()],_.prototype,"installMode",2);P([C()],_.prototype,"fallbackRung",2);P([C()],_.prototype,"perfHint",2);P([C()],_.prototype,"walkDrop",2);P([C()],_.prototype,"dialsReady",2);P([C()],_.prototype,"timeManual",2);P([C()],_.prototype,"timeOpen",2);P([C()],_.prototype,"sunShown",2);P([C()],_.prototype,"night",2);P([Vi(".stage")],_.prototype,"stage",2);P([R({type:Number})],_.prototype,"routeDwellMs",2);_=P([Ns("sw-plan-3d")],_);export{Ia as DEFAULT_MIN_FPS,jt as FALLBACK_KEY,zs as NIGHT_KEY,$i as PILL_CAP,bo as PROBE_FALLBACK_MS,yo as PROBE_FIRST_FRAME_MS,ye as PROBE_MS,ko as PROBE_WARM_FRAMES,Qa as QUALITY_KEY,fs as SETTINGS_WAIT_MS,Ka as SceneStillRenderer,_ as SwPlan3d,de as WALK_ACT_M,ce as WALK_FOV,he as WALK_GUARD_KEY,Xa as encodePng,qa as sameDots,Oa as sameLevels,Ua as twinStart,Ds as withAlpha};
//# sourceMappingURL=sw-plan-3d-DLAyxXQH.js.map
