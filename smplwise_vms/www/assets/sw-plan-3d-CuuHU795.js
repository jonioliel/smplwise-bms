const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as Po,E as cs,F as O,G as q,a as Ki,A as F,fe as Y,e as R,H as Xi,K as Eo,co as zo,ca as To}from"./index-BbQM-cPX.js";import"./sw-chip-LaKUjmzQ.js";import{G as ut,C as Q,M as U,B as ht,z as J,n as pt,E as It,m as vs,I as ds,V as yt,J as Me,K as Tt,P as bs,Z as Do,e as Lo,A as Ro,f as Io,Q as ys,a as C,X as Co,Y as $o,l as Vi,L as je,_ as Fo,R as zt,$ as Kt,a0 as ks,D as Oo,k as No,a1 as Bo,a2 as Dt,F as mt,a3 as Xt,b as ot,a4 as Se,a5 as gt,a6 as vt,a7 as rt,a8 as ye,a9 as Uo,aa as Yi,ab as Zi,ac as xs,ad as Qi,ae as He,af as qo,ag as Go,ah as Wo,O as Ms,ai as jo,aj as Ho,ak as Ko,al as Ss,am as Xo,an as Vo,ao as tt,ap as Ot,aq as St,ar as Yo,v as Zo,as as Qo,x as Jo,at as tn,au as en,av as sn,aw as As,ax as on,ay as nn}from"./three-BQ4B-482.js";import{N as _s,g as an,i as Ps,d as rn,e as Es,f as zs,p as ln,P as Vt,h as hn,j as Ts,I as At,q as cn,k as dn,l as un,C as Te,m as pn,o as fn,S as mn,r as wn,t as gn,u as vn,v as bn,w as yn,x as kn,y as Ji}from"./still-bake-BmvxQb4h.js";import{M as xn}from"./material-resolve-Wx1HTW0e.js";import{L as W,t as Mn,P as Sn,m as An,M as _n,S as Ds,c as Pn,s as En,D as zn,k as Tn}from"./scene-builder-CCeqJPRq.js";import{k as to,D as Ls,l as Rs,a as Dn,s as Ln,p as Is,r as De,b as Rn,c as Yt,t as In,h as Cn,T as $n}from"./sun-C6tBcKaa.js";import{o as us,O as Fn,h as eo}from"./lightmap-bake-DbQjgGI7.js";import{D as On,p as Nn,a as Zt,b as Qt,c as Bn,d as Un,e as Cs,r as qn,l as Gn,n as $s,R as Ke}from"./quality-ladder--PzUvYhW.js";import{D as Le,p as Wn,i as jn,j as Hn,k as Kn,l as Xn}from"./plan-view-99BKjZdx.js";import{d as Vn,W as Yn}from"./webgl-CibXTSfY.js";import{F as Zn,r as Qn}from"./quality-mode-Lw2uUGRc.js";import{c as Jn,l as ta,s as ea,Q as sa}from"./plan-quality-BoIqywNU.js";import{H as at,i as Fs,d as ia,j as Os,b as oa}from"./hud-layout-E9SCGK9C.js";function so(s,t,e=[0,0,0]){const i=s.length/3,n=new Float32Array(i*2),o=t>0?t:1;for(let a=0;a+2<i;a+=3){const r=a*3,l=s[r+3]-s[r],h=s[r+4]-s[r+1],c=s[r+5]-s[r+2],d=s[r+6]-s[r],u=s[r+7]-s[r+1],p=s[r+8]-s[r+2],m=Math.abs(h*p-c*u),w=Math.abs(c*d-l*p),y=Math.abs(l*u-h*d);for(let b=0;b<3;b++){const P=r+b*3,S=s[P]+e[0],E=s[P+1]+e[1],I=s[P+2]+e[2];let _,A;m>=w&&m>=y?(_=I,A=E):w>=y?(_=S,A=I):(_=S,A=E),n[(a+b)*2]=_/o,n[(a+b)*2+1]=A/o}}return n}function na(s,t,e){if(!t)return Float32Array.from(s);const i=new Float32Array(t.length*e);for(let n=0;n<t.length;n++)for(let o=0;o<e;o++)i[n*e+o]=s[t[n]*e+o];return i}function aa(s,t){const e=t*9,i=s[e+3]-s[e],n=s[e+4]-s[e+1],o=s[e+5]-s[e+2],a=s[e+6]-s[e],r=s[e+7]-s[e+1],l=s[e+8]-s[e+2],h=n*l-o*r,c=o*a-i*l,d=i*r-n*a,u=Math.hypot(h,c,d)||1;return[h/u,c/u,d/u]}function ra(s,t){const e=Math.floor(s.length/9),i=Array.from({length:e},(l,h)=>aa(s,h)),n=l=>`${Math.round(s[l*3]*1e4)},${Math.round(s[l*3+1]*1e4)},${Math.round(s[l*3+2]*1e4)}`,o=new Map;for(let l=0;l<e*3;l++){const h=n(l),c=o.get(h);c?c.push(Math.floor(l/3)):o.set(h,[Math.floor(l/3)])}const a=Math.cos(t),r=new Float32Array(e*9);for(let l=0;l<e*3;l++){const h=i[Math.floor(l/3)];let c=0,d=0,u=0;for(const m of o.get(n(l))??[]){const w=i[m];w[0]*h[0]+w[1]*h[1]+w[2]*h[2]>=a&&(c+=w[0],d+=w[1],u+=w[2])}const p=Math.hypot(c,d,u);if(!(p>1e-9)){r[l*3+1]=1;continue}r[l*3]=c/p,r[l*3+1]=d/p,r[l*3+2]=u/p}return r}const la=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function ha(s,t){const e=new Array(16).fill(0);for(let i=0;i<4;i++)for(let n=0;n<4;n++)for(let o=0;o<4;o++)e[i*4+n]+=s[o*4+n]*t[i*4+o];return e}function ca(s,t,e){const[i,n,o,a]=t,[r,l,h]=e;return[(1-2*(n*n+o*o))*r,2*(i*n+o*a)*r,2*(i*o-n*a)*r,0,2*(i*n-o*a)*l,(1-2*(i*i+o*o))*l,2*(n*o+i*a)*l,0,2*(i*o+n*a)*h,2*(n*o-i*a)*h,(1-2*(i*i+n*n))*h,0,s[0],s[1],s[2],1]}function da(s,t,e,i){return[s[0]*t+s[4]*e+s[8]*i+s[12],s[1]*t+s[5]*e+s[9]*i+s[13],s[2]*t+s[6]*e+s[10]*i+s[14]]}const ua={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};function pa(s){const t=new DataView(s);if(t.getUint32(0,!0)!==1179937895)throw new Error("not a GLB");let e=12,i=null,n=null;for(;e+8<=s.byteLength;){const p=t.getUint32(e,!0),m=t.getUint32(e+4,!0);m===1313821514?i=JSON.parse(new TextDecoder().decode(new Uint8Array(s,e+8,p))):m===5130562&&(n=new DataView(s,e+8,p)),e+=8+p}if(!i||!n)throw new Error("GLB without JSON or BIN");const o=i,a=n,r=p=>{const m=o.accessors[p],w=o.bufferViews[m.bufferView],y=ua[m.type]??1,b=m.componentType===5126||m.componentType===5125?4:m.componentType===5123||m.componentType===5122?2:1,P=w.byteStride||y*b,S=(w.byteOffset??0)+(m.byteOffset??0),E=[];for(let I=0;I<m.count;I++)for(let _=0;_<y;_++){const A=S+I*P+_*b;E.push(m.componentType===5126?a.getFloat32(A,!0):m.componentType===5125?a.getUint32(A,!0):m.componentType===5123?a.getUint16(A,!0):m.componentType===5122?a.getInt16(A,!0):a.getUint8(A))}return E},l=[],h=[1/0,1/0,1/0],c=[-1/0,-1/0,-1/0],d=(p,m)=>{const w=o.nodes[p],y=w.matrix&&w.matrix.length===16?w.matrix:ca(w.translation??[0,0,0],w.rotation??[0,0,0,1],w.scale??[1,1,1]),b=ha(m,y);if(w.mesh!==void 0)for(const P of o.meshes[w.mesh].primitives){if((P.mode??4)!==4||P.attributes.POSITION===void 0)continue;const S=r(P.attributes.POSITION),E=P.indices!==void 0?r(P.indices):null,I=na(S,E,3);for(let _=0;_<I.length;_+=3){const A=da(b,I[_],I[_+1],I[_+2]);I[_]=A[0],I[_+1]=A[1],I[_+2]=A[2];for(let f=0;f<3;f++)h[f]=Math.min(h[f],A[f]),c[f]=Math.max(c[f],A[f])}l.push({positions:I,material:(P.material!==void 0?o.materials?.[P.material]?.name:"")??""})}for(const P of w.children??[])d(P,b)},u=o.scenes?.[o.scene??0]?.nodes??o.nodes.map((p,m)=>m);for(const p of u)d(p,la);if(!l.length)throw new Error("GLB without triangles");return{primitives:l,min:h,max:c}}function fa(s,t,e,i,n){const o=t[0]-s[0]>1e-6?e/(t[0]-s[0]):1,a=t[1]-s[1]>1e-6?i/(t[1]-s[1]):1,r=t[2]-s[2]>1e-6?n/(t[2]-s[2]):1,l=Math.min(o,a,r);return{scale:[Math.min(o,l*1.15),Math.min(a,l*1.15),Math.min(r,l*1.15)],offset:[-(s[0]+t[0])/2,-s[1],-(s[2]+t[2])/2]}}function ma(s,t){const e=Math.sin(s*12.9898+t*78.233)*43758.5453;return 1+((e-Math.floor(e))*.1-.05)}const wa=.75,ga=.36,va=.14,ba=.55,ya=1.5,ka={floor:1.5,wall:1.3,pendant:1.7},Z=s=>Math.round(s*1e4)/1e4;function Xe(s){let t=0;for(let e=0;e<s.length;e++)t+=s[e][0]*s[(e+1)%s.length][1]-s[(e+1)%s.length][0]*s[e][1];return t/2}function Ns(s,t){const e=s.length>2&&s[0][0]===s[s.length-1][0]&&s[0][1]===s[s.length-1][1]?s.slice(0,-1):s.slice(),i=e.length;if(i<3)return[];const n=Xe(e);if(Math.abs(n)<1e-6)return[];const o=n>0?e:[...e].reverse();if(!(t>0))return o.map(([h,c])=>[Z(h),Z(c)]);const a=(h,c)=>{const d=c[0]-h[0],u=c[1]-h[1],p=Math.hypot(d,u)||1;return[-u/p,d/p]},r=[];for(let h=0;h<i;h++){const c=a(o[(h+i-1)%i],o[h]),d=a(o[h],o[(h+1)%i]),u=1+c[0]*d[0]+c[1]*d[1],p=u>1e-6?Math.min(t/u,2.5*t):2.5*t;r.push([Z(o[h][0]+(c[0]+d[0])*p),Z(o[h][1]+(c[1]+d[1])*p)])}const l=Xe(r);if(!(l>0)||l>n*Math.sign(n))return[];for(let h=0;h<i;h++){const c=[o[(h+1)%i][0]-o[h][0],o[(h+1)%i][1]-o[h][1]],d=[r[(h+1)%i][0]-r[h][0],r[(h+1)%i][1]-r[h][1]];if(c[0]*d[0]+c[1]*d[1]<=0&&Math.hypot(c[0],c[1])>2*t)return[]}return r}function io(s,t,e){let i=!1;for(let n=0,o=e.length-1;n<e.length;o=n++){const[a,r]=e[n],[l,h]=e[o];r>t!=h>t&&s<(l-a)*(t-r)/(h-r||1e-12)+a&&(i=!i)}return i}function xa(s){let t=0,e=0,i=0;for(let n=0;n<s.length;n++){const[o,a]=s[n],[r,l]=s[(n+1)%s.length],h=o*l-r*a;t+=h,e+=(o+r)*h,i+=(a+l)*h}return Math.abs(t)<1e-9?[s.reduce((n,o)=>n+o[0],0)/Math.max(1,s.length),s.reduce((n,o)=>n+o[1],0)/Math.max(1,s.length)]:[e/(3*t),i/(3*t)]}function Ma(s,t){const e=s.map(d=>d[0]),i=s.map(d=>d[1]),n=Math.max(Math.max(...e)-Math.min(...e),Math.max(...i)-Math.min(...i)),o=Math.abs(Xe(s)),[a,r]=xa(s),l=t.filter(d=>d.on&&io(d.position[0],d.position[2],s)).sort((d,u)=>d.id<u.id?-1:1),h=[{x:Z(a),z:Z(r),r:Z(Math.max(1.6,n*.78)),w:l.length?.45:.9}],c=Math.min(3.2,Math.max(1.4,Math.sqrt(o)*.6));for(const d of l.slice(0,6))h.push({x:Z(d.position[0]),z:Z(d.position[2]),r:Z(ka[d.kind]??c),w:Z(Math.min(1.4,Math.max(.6,Math.sqrt(d.lumens/1e3))))});return h}function Bs(s,t,e){let i=0;for(const n of e){const o=Math.hypot(s-n.x,t-n.z)/n.r;i=Math.max(i,n.w*Math.exp(-2.2*o*o))}return i}function Sa(s,t,e){const i=new Map;for(const a of s){if(a.kind!=="tint"||!a.id.startsWith("room:"))continue;const r=a.id.lastIndexOf("#");if(r<0)continue;const l=a.userData?.id??a.id.slice(5,r),h=a.id.slice(r+1);if(h!=="lit"&&h!=="presence"&&h!=="presence-ring")continue;const c=i.get(l)??{lit:!1,presence:0,polygon:null,level:a.level_id??""};h==="lit"?(c.lit=!0,c.polygon=a.polygon??c.polygon):h==="presence"?(c.presence=Math.max(c.presence,a.opacity/ga),c.polygon??=a.polygon??null):c.presence=Math.max(c.presence,a.opacity/wa),i.set(l,c)}const n=new Map(t.map(a=>[a.id,a])),o=[];for(const[a,r]of[...i].sort((l,h)=>l[0]<h[0]?-1:1)){if(!r.polygon||r.polygon.length<3)continue;const l=Ns(r.polygon,va);if(!l.length)continue;const h=n.get(r.level),c=e.filter(p=>p.level_id===r.level),d=c.filter(p=>p.on&&io(p.position[0],p.position[2],l)),u=h?.ceiling_height_m??2.8;o.push({zone:a,level_id:r.level,y:h?.elevation_m??0,polygon:l,band:Ns(l,ba),pools:Ma(l,c),color_k:d.length?Math.round(d.reduce((p,m)=>p+m.color_k,0)/d.length):2900,wash:Z(Math.min(ya,u*.6-.12)),lit:r.lit?1:0,presence:Z(Math.max(0,Math.min(1,r.presence)))})}return o}function Aa(s,t=.4){const e=[],i=s.polygon;for(let n=0;n<i.length;n++){const o=i[n],a=i[(n+1)%i.length],r=Math.hypot(a[0]-o[0],a[1]-o[1]),l=Math.max(1,Math.ceil(r/t));for(let h=0;h<l;h++){const c=h/l,d=(h+1)/l,u=[o[0]+(a[0]-o[0])*c,o[1]+(a[1]-o[1])*c],p=[o[0]+(a[0]-o[0])*d,o[1]+(a[1]-o[1])*d];e.push({a:u,b:p,sa:Z(Math.min(1,.3+.7*Bs(u[0],u[1],s.pools))),sb:Z(Math.min(1,.3+.7*Bs(p[0],p[1],s.pools)))})}}return e}function Us(s,t){const e=Math.max(0,Math.min(1,t)),i=s==="dark"?1.15:1,n=(o,a)=>Z((o+(a-o)*e)*i);return{floor:n(.35,1.3),wall:n(.1,.36),presFloor:n(.05,.07),presEdge:n(.3,.42),presWall:n(.1,.16)}}const _a=450,oo=.014;let qs=null,Re=null,Ie=null;function ps(s,t,e){const i=document.createElement("canvas");i.width=s,i.height=t;const n=i.getContext("2d");n&&e(n);const o=new Me(i);return o.wrapS=Tt,o.wrapT=Tt,o}function Pa(){return qs??=ps(128,128,s=>{const t=s.createRadialGradient(64,64,0,64,64,64);for(let e=0;e<=10;e++){const i=e/10;t.addColorStop(i,`rgba(255,255,255,${Math.exp(-3.2*i*i)*(1-i*i)})`)}s.fillStyle=t,s.fillRect(0,0,128,128)}),qs}function Gs(){return Re||(Re=ps(4,64,s=>{const t=s.createLinearGradient(0,64,0,0);t.addColorStop(0,"rgba(255,255,255,0.75)"),t.addColorStop(.22,"rgba(255,255,255,1)"),t.addColorStop(.6,"rgba(255,255,255,0.4)"),t.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=t,s.fillRect(0,0,4,64)})),Re}function Ea(){return Ie||(Ie=ps(4,64,s=>{const t=s.createLinearGradient(0,64,0,0);t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.3,"rgba(255,255,255,0.45)"),t.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=t,s.fillRect(0,0,4,64)})),Ie}function za(s){return ds.triangulateShape(s.map(([e,i])=>new yt(e,i)),[]).map(([e,i,n])=>[s[e],s[i],s[n]])}function Ws(s,t){const e=za(s.polygon),i=[],n=[],o=[],a=s.y+oo,r=t?s.pools:[{x:0,z:0,r:1e9,w:1}];for(const h of r)for(const c of e)for(const d of[c[0],c[2],c[1]])i.push(d[0],a,d[1]),n.push(t?(d[0]-h.x)/(2*h.r)+.5:.5,t?(d[1]-h.z)/(2*h.r)+.5:.5),o.push(Math.min(1,h.w),Math.min(1,h.w),Math.min(1,h.w));const l=new ht;return l.setAttribute("position",new J(new Float32Array(i),3)),l.setAttribute("uv",new J(new Float32Array(n),2)),l.setAttribute("color",new J(new Float32Array(o),3)),l.computeBoundingSphere(),l}function Ta(s){const t=[],e=[],i=[],n=s.y+.01,o=s.y+s.wash;for(const r of Aa(s)){const l=[r.a[0],n,r.a[1]],h=[r.b[0],n,r.b[1]],c=[r.b[0],o,r.b[1]],d=[r.a[0],o,r.a[1]];t.push(...l,...h,...c,...l,...c,...d),e.push(0,0,1,0,1,1,0,0,1,1,0,1);for(const u of[r.sa,r.sb,r.sb,r.sa,r.sb,r.sa])i.push(u,u,u)}const a=new ht;return a.setAttribute("position",new J(new Float32Array(t),3)),a.setAttribute("uv",new J(new Float32Array(e),2)),a.setAttribute("color",new J(new Float32Array(i),3)),a.computeBoundingSphere(),a}function Da(s){const t=s.polygon,e=s.band;if(e.length!==t.length)return null;const i=[],n=[],o=s.y+oo+.002;for(let r=0;r<t.length;r++){const l=(r+1)%t.length,h=Math.hypot(t[l][0]-t[r][0],t[l][1]-t[r][1]);i.push(t[r][0],o,t[r][1],e[l][0],o,e[l][1],t[l][0],o,t[l][1],t[r][0],o,t[r][1],e[r][0],o,e[r][1],e[l][0],o,e[l][1]),n.push(0,0,h,1,h,0,0,0,0,1,h,1)}const a=new ht;return a.setAttribute("position",new J(new Float32Array(i),3)),a.setAttribute("uv",new J(new Float32Array(n),2)),a.computeBoundingSphere(),a}const Nt=s=>new pt({transparent:!0,depthWrite:!1,fog:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:It,...s});class La{constructor(t,e,i,n=null,o=0){this.root=new ut,this.entries=new Map,this.clip=null,this.root.name="room-glow",this.style=e,this.look=Us(e,i);const a=new Set;for(const r of t){a.add(r.zone);const l=n?.get(r.zone),h=l?{lit:l.lit,presence:l.presence}:n?{lit:0,presence:0}:{lit:r.lit,presence:r.presence};this.add(r,h,{lit:r.lit,presence:r.presence},o)}if(n)for(const[r,l]of[...n].sort((h,c)=>h[0]<c[0]?-1:1))!a.has(r)&&(l.lit>.001||l.presence>.001)&&this.add(l.room,{lit:l.lit,presence:l.presence},{lit:0,presence:0},o);this.apply()}add(t,e,i,n){const o={room:t,cur:{...e},from:{...e},to:{...i},t0:n,meshes:{}},a=new Q(...to(t.color_k)),r=new Q(W[this.style].states.presence),l=e.lit>0||i.lit>0,h=e.presence>0||i.presence>0,c=(u,p,m)=>(u.name=`glow:${t.zone}#${p}`,u.renderOrder=m,u.userData={ownMaterial:!0,skipAO:!0,glow:p,zone:t.zone,level:t.level_id},u.frustumCulled=!0,this.root.add(u),u);let d=null;if((l||h)&&(d=Ta(t)),l&&(o.meshes.litFloor=c(new U(Ws(t,!0),Nt({map:Pa(),color:a,vertexColors:!0,blending:Io,blendEquation:Ro,blendSrc:Lo,blendDst:bs,blendSrcAlpha:Do,blendDstAlpha:bs,premultipliedAlpha:!0})),"lit-floor",3),o.meshes.litWall=c(new U(d,Nt({map:Gs(),color:a,vertexColors:!0,blending:vs})),"lit-wall",3)),h){o.meshes.presFill=c(new U(Ws(t,!1),Nt({color:r,blending:ys})),"pres-fill",2);const u=Da(t);u&&(o.meshes.presEdge=c(new U(u,Nt({map:Ea(),color:r,blending:ys})),"pres-edge",2));const p=c(new U(d,Nt({map:Gs(),color:r,blending:vs})),"pres-wall",3);o.meshes.presWall=p,l&&(p.userData.sharedGeometry=!0)}this.entries.set(t.zone,o)}apply(){const t=this.look;for(const e of this.entries.values()){const i=(n,o)=>{if(!n)return;const a=n.material;a.opacity=o,n.visible=o>.002};i(e.meshes.litFloor,t.floor*e.cur.lit),i(e.meshes.litWall,t.wall*e.cur.lit),i(e.meshes.presFill,t.presFloor*e.cur.presence*(1-e.cur.lit)),i(e.meshes.presEdge,t.presEdge*e.cur.presence),i(e.meshes.presWall,t.presWall*e.cur.presence)}}setLook(t,e){if(this.look=Us(t,e),t!==this.style){this.style=t;const i=W[t].states.presence;for(const n of this.entries.values())for(const o of[n.meshes.presFill,n.meshes.presEdge,n.meshes.presWall])o?.material?.color.setHex(i)}this.apply()}setClip(t){this.clip=t;for(const e of this.entries.values())for(const i of[e.meshes.litWall,e.meshes.presWall])i&&(i.material.clippingPlanes=t)}get clipPlanes(){return this.clip}updateWeights(t){for(const e of t){const i=this.entries.get(e.zone);i&&(i.to={lit:e.lit,presence:e.presence},i.cur={...i.to},i.from={...i.to})}this.apply()}tick(t,e=!0){let i=!1;for(const n of this.entries.values()){if(n.cur.lit===n.to.lit&&n.cur.presence===n.to.presence)continue;const o=e?Math.min(1,Math.max(0,(t-n.t0)/_a)):1,a=o<.5?2*o*o:1-Math.pow(-2*o+2,2)/2;n.cur={lit:n.from.lit+(n.to.lit-n.from.lit)*a,presence:n.from.presence+(n.to.presence-n.from.presence)*a},o<1?i=!0:n.cur={...n.to}}return this.apply(),i}state(){return new Map([...this.entries].map(([t,e])=>[t,{room:e.room,lit:e.cur.lit,presence:e.cur.presence}]))}stats(){let t=0,e=0;return this.root.traverse(i=>{i.isMesh&&(t++,i.visible&&e++)}),{rooms:this.entries.size,meshes:t,visible:e}}dispose(){this.root.traverse(t=>{const e=t;e.isMesh&&(e.userData.sharedGeometry||e.geometry.dispose(),e.material.dispose())}),this.root.clear(),this.entries.clear()}}const js="aovol-1",fs=24,ft=1.1,Ve=.2,Ye=128,Ra=64,no=.12,Jt=.4,Ia=new Set(["wall","lintel","sill","head","object","connector"]),et=s=>Math.round(s*1e4)/1e4;function Ca(s){const t=new Set(s.levels.map(n=>n.id)),e=s.parts.filter(n=>n.level_id!==null&&t.has(n.level_id)&&Ia.has(n.kind)&&us(n)!==null).map(n=>({level_id:n.level_id,kind:n.kind,shape:n.shape,position:n.position,size:n.size,rotation:n.rotation,opacity:n.opacity}));return{levels:s.levels.map(n=>({id:n.id,elevation_m:n.elevation_m,ceiling_height_m:n.ceiling_height_m})),parts:e}}function ao(s){const t=[js,String(fs),String(ft),String(Ve),String(Ye)];for(const o of s.levels)t.push(`L${o.id}:${et(o.elevation_m)}:${et(o.ceiling_height_m)}`);for(const o of s.parts)t.push(`${o.level_id}|${o.kind}|${o.shape}|${o.position.map(et).join(",")}|${o.size.map(et).join(",")}|${et(o.rotation[1])}`);const e=t.join(";");let i=2166136261,n=1523705862;for(let o=0;o<e.length;o++){const a=e.charCodeAt(o);i=Math.imul(i^a,16777619)>>>0,n=Math.imul(n^a,16777621)>>>0}return`${js}:${i.toString(16).padStart(8,"0")}${n.toString(16).padStart(8,"0")}:${s.parts.length}`}function $a(s){if(!s.levels.length)return null;const t=s.parts.map(p=>us(p)).filter(p=>p!==null);if(!t.length)return null;let e=1/0,i=-1/0,n=1/0,o=-1/0;for(const p of t)e=Math.min(e,p.minX),i=Math.max(i,p.maxX),n=Math.min(n,p.minZ),o=Math.max(o,p.maxZ);e-=Jt,n-=Jt,i+=Jt,o+=Jt;const a=Math.min(...s.levels.map(p=>p.elevation_m)),r=Math.max(...s.levels.map(p=>p.elevation_m+p.ceiling_height_m)),l=Math.max(Ve,(i-e)/Ye,(o-n)/Ye),h=Math.max(Ve,(r-a)/Ra),c=Math.max(2,Math.ceil((i-e)/l)),d=Math.max(2,Math.ceil((o-n)/l)),u=Math.max(2,Math.ceil((r-a)/h));return{origin:[et(e),et(a),et(n)],texel:[et(l),et(h)],dims:[c,u,d],size:[et(c*l),et(u*h),et(d*l)]}}function Fa(s=eo(fs)){let t=0;for(const e of s){if(e[0]>=0)continue;const i=no/-e[0];i<ft&&(t+=1-i/ft)}return 1-t/s.length}async function Oa(s,t={}){const e=$a(s);if(!e)return null;const i=t.now??(()=>Date.now()),n=i(),[o,a,r]=e.dims,[l,h]=e.texel,[c,d,u]=e.origin,p=eo(fs),m=p.map(v=>[v[0],-v[1],v[2]]),w=s.levels.map(v=>{const k=s.parts.filter(M=>M.level_id===v.id).map(M=>us(M)).filter(M=>M!==null);return{level:v,grid:new Fn(k,c,u,c+e.size[0],u+e.size[2])}}),y=v=>{let k=null;for(const M of w)v>=M.level.elevation_m&&v<M.level.elevation_m+M.level.ceiling_height_m+1e-6&&(!k||M.level.elevation_m>k.level.elevation_m)&&(k=M);return k},b=o*a*r,P=new Float32Array(b).fill(1),S=new Float32Array(b).fill(1),E=new Uint8Array(b);let I=0,_=0;const A=[0,0,0],f=p.length;for(let v=0;v<r;v++){A[2]=u+(v+.5)*l;for(let k=0;k<a;k++){A[1]=d+(k+.5)*h;const M=y(A[1]);if(!M)continue;const z=M.level.elevation_m;for(let x=0;x<o;x++){A[0]=c+(x+.5)*l;const L=x+o*(k+a*v);if(M.grid.contains(A)){E[L]=1,I++;continue}let $=0,j=0;for(let N=0;N<f;N++){const H=M.grid.cast(A,p[N],ft);H<ft&&($+=1-H/ft);const G=m[N];let B=M.grid.cast(A,G,ft);const st=(A[1]-z)/-G[1];st>=0&&st<B&&(B=st),B<ft&&(j+=1-B/ft)}_+=2*f,P[L]=1-$/f,S[L]=1-($+j)/(2*f)}}t.yieldSlice&&await t.yieldSlice(v,r)}Na(P,S,E,o,a,r);const g=new Uint8Array(b*2);for(let v=0;v<b;v++)g[2*v]=Math.round(Math.min(1,Math.max(0,P[v]))*255),g[2*v+1]=Math.round(Math.min(1,Math.max(0,S[v]))*255);return{key:ao(s),plan:e,data:g,wallRef:Math.round(Fa(p)*1e4)/1e4,stats:{texels:b,inside:I,rays:_,ms:Math.round(i()-n)}}}function Na(s,t,e,i,n,o){const a=(r,l,h)=>r+i*(l+n*h);for(let r=0;r<2;r++){const l=[];for(let h=0;h<o;h++)for(let c=0;c<n;c++)for(let d=0;d<i;d++){const u=a(d,c,h);if(!e[u])continue;let p=0,m=0,w=0;const y=(b,P,S)=>{if(b<0||P<0||S<0||b>=i||P>=n||S>=o)return;const E=a(b,P,S);e[E]||(p+=s[E],m+=t[E],w++)};y(d-1,c,h),y(d+1,c,h),y(d,c,h-1),y(d,c,h+1),y(d,c-1,h),y(d,c+1,h),w&&l.push([u,p/w,m/w])}for(const[h,c,d]of l)s[h]=c,t[h]=d,e[h]=0}}const Ae={strength:1,direct:.7,power:1.5};function ro(s,t,e,i){const n=new Co(s,t,e,i);return n.format=$o,n.type=Vi,n.minFilter=je,n.magFilter=je,n.wrapS=Tt,n.wrapT=Tt,n.wrapR=Tt,n.unpackAlignment=1,n.generateMipmaps=!1,n.needsUpdate=!0,n}const lo=()=>ro(new Uint8Array([255,255]),1,1,1);function Ba(){return{swAoVol:{value:lo()},swAoOrigin:{value:new C(0,0,0)},swAoSize:{value:new C(1,1,1)},swAoStrength:{value:0},swAoWallRef:{value:1},swAoDirect:{value:Ae.direct}}}function Hs(s,t){if(s.swAoVol.value.dispose(),!t){s.swAoVol.value=lo(),s.swAoStrength.value=0;return}const[e,i,n]=t.plan.dims;s.swAoVol.value=ro(t.data,e,i,n),s.swAoOrigin.value.set(...t.plan.origin),s.swAoSize.value.set(...t.plan.size),s.swAoWallRef.value=Math.max(.05,t.wallRef),s.swAoStrength.value=Ae.strength}function Ua(s){s.swAoVol.value.dispose()}const qa=`
varying vec3 vSwAoPos;
varying vec3 vSwAoN;`,Ga=`
	vec4 swAoW = vec4( transformed, 1.0 );
	vec3 swAoNo = objectNormal;
	#ifdef USE_INSTANCING
		swAoW = instanceMatrix * swAoW;
		swAoNo = mat3( instanceMatrix ) * swAoNo;
	#endif
	vSwAoPos = ( modelMatrix * swAoW ).xyz;
	vSwAoN = mat3( modelMatrix ) * swAoNo;`,Wa=`
uniform highp sampler3D swAoVol;
uniform vec3 swAoOrigin;
uniform vec3 swAoSize;
uniform float swAoStrength;
uniform float swAoWallRef;
uniform float swAoDirect;
varying vec3 vSwAoPos;
varying vec3 vSwAoN;
float swBakedAo() {
	if ( swAoStrength <= 0.0 ) return 1.0;
	float nl = length( vSwAoN );
	if ( !( nl > 1e-4 ) ) return 1.0; // a part without normals (a NaN here would spread through the bloom over the frame)
	vec3 n = vSwAoN / nl;
	vec3 q = ( vSwAoPos + n * ${no.toFixed(3)} - swAoOrigin ) / swAoSize;
	if ( any( lessThan( q, vec3( 0.0 ) ) ) || any( greaterThan( q, vec3( 1.0 ) ) ) ) return 1.0;
	vec2 ao = texture( swAoVol, q ).rg;
	float side = clamp( ao.g / swAoWallRef, 0.0, 1.0 );
	float a = mix( side, ao.r, smoothstep( 0.35, 0.9, n.y ) );
	a = pow( a, ${Ae.power.toFixed(2)} ); // deepen the contact: the open (1) stays open
	return mix( 1.0, a, swAoStrength );
}`,ja=`
	{
		float swAo = swBakedAo();
		reflectedLight.indirectDiffuse *= swAo;
		reflectedLight.indirectSpecular *= mix( 1.0, swAo, 0.8 );
		reflectedLight.directDiffuse *= mix( 1.0, swAo, swAoDirect );
	}`;function Ha(s,t){if(s.userData.swAo)return;s.userData.swAo=!0;const e=s.onBeforeCompile;s.onBeforeCompile=(n,o)=>{e.call(s,n,o),Object.assign(n.uniforms,t),n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>${qa}`).replace("#include <worldpos_vertex>",`#include <worldpos_vertex>${Ga}`),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>${Wa}`).replace("#include <aomap_fragment>",`#include <aomap_fragment>${ja}`)};const i=s.customProgramCacheKey.bind(s);s.customProgramCacheKey=()=>`${i()}|swao1`}const te={edge:.55,reflect:.9,max:.88,power:4};function Ka(s){s.userData.swGlass||(s.userData.swGlass=!0,s.onBeforeCompile=t=>{t.fragmentShader=t.fragmentShader.replace("#include <opaque_fragment>",`{
		float swF = pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), ${te.power.toFixed(1)} );
		float swR = dot( reflectedLight.indirectSpecular + reflectedLight.directSpecular, vec3( 0.2126, 0.7152, 0.0722 ) );
		diffuseColor.a = clamp( diffuseColor.a + swF * ${te.edge.toFixed(3)} + swR * ${te.reflect.toFixed(3)}, 0.0, ${te.max.toFixed(3)} );
	}
	#include <opaque_fragment>`)},s.customProgramCacheKey=()=>"swglass1")}const ms="marble",_e="finish_marble",$t="finish_ceramic";function Xa(s){return s==="wood"?"oak":s==="ceramic"?$t:_e}const Va=[{id:_e,group:"floor",he:"שיש",tile_m:2.4,tint:{light:"#ffffff",dark:"#868b95"},roughness:.32,metalness:0,normal:0,set:null,aliases:[]},{id:$t,group:"floor",he:"קרמיקה יוקרתית",tile_m:2.4,tint:{light:"#ffffff",dark:"#80848c"},roughness:.4,metalness:0,normal:0,set:null,aliases:[]}],Ya=s=>s===_e||s===$t;function qt(s,t,e){let i=Math.imul(s,374761393)+Math.imul(t,668265263)+Math.imul(e,2147483647)|0;return i=Math.imul(i^i>>>13,1274126177),i^=i>>>16,(i>>>0)/4294967296}function ho(s,t,e,i){const n=s*e,o=t*e,a=Math.floor(n),r=Math.floor(o),l=n-a,h=o-r,c=l*l*(3-2*l),d=h*h*(3-2*h),u=b=>(b%e+e)%e,p=qt(u(a),u(r),i),m=qt(u(a+1),u(r),i),w=qt(u(a),u(r+1),i),y=qt(u(a+1),u(r+1),i);return p+(m-p)*c+(w-p)*d+(p-m-w+y)*c*d}function _t(s,t,e,i,n){let o=0,a=.5,r=0;for(let l=0;l<i;l++)o+=ho(s,t,e<<l,n+l*17)*a,r+=a,a*=.5;return o/r}const wt=s=>s<0?0:s>1?1:s,it=(s,t,e)=>s+(t-s)*e,V=128;function ee(s){const t=new Float32Array(V*V);for(let e=0;e<V;e++)for(let i=0;i<V;i++)t[e*V+i]=s(i/V,e/V);return t}function se(s,t,e){const i=t*V,n=e*V,o=Math.floor(i),a=Math.floor(n),r=i-o,l=n-a,h=o%V,c=a%V,d=(o+1)%V,u=(a+1)%V,p=s[c*V+h],m=s[c*V+d],w=s[u*V+h],y=s[u*V+d];return p+(m-p)*r+(w-p)*l+(p-m-w+y)*r*l}function Za(s,t=512,e=!0){const i=new Uint8Array(t*t*4),n=s!==$t,o=n?[239,237,232]:[214,207,196],a=n?[212,211,209]:[198,191,180],r=n?[146,146,150]:[190,182,170],l=n?[214,211,205]:[160,154,146],h=t/2,c=n?ee((m,w)=>_t(m,w,4,4,11)):null,d=n?ee((m,w)=>_t(m,w,3,4,29)):null,u=n?ee((m,w)=>_t(m,w,5,3,47)):null,p=n?ee((m,w)=>_t(m,w,2,3,61)):null;for(let m=0;m<t;m++){const w=m/t;for(let y=0;y<t;y++){const b=n&&y>=h?(t-y)/t:y/t;let P,S,E;if(n){const A=se(c,b,w),f=se(d,b,w),g=se(p,b,w),v=1-Math.abs(Math.sin(Math.PI*(2*b+1*w+f*1.6))),k=1-Math.abs(Math.sin(Math.PI*(1*b-3*w+se(u,b,w)*2.2))),M=v*v,z=M*M,x=z*z*z*z,L=k*k,$=L*L*L*L,j=$*$*$*$,N=wt((g-.34)*3.2),H=wt((.62-g)*3),B=(x*x*.55+z*M*.22)*N,st=(j*$*.34+$*.1)*H,xt=wt(B+st),Ee=wt((A-.4)*1.6)*.5,ze=(ho(b,w,96,101)-.5)*.035;P=it(it(o[0],a[0],Ee),r[0],xt)*(1+ze),S=it(it(o[1],a[1],Ee),r[1],xt)*(1+ze),E=it(it(o[2],a[2],Ee),r[2],xt)*(1+ze)}else{const A=y<h?0:1,f=m<h?0:1,g=(qt(A,f,5)-.5)*.05,v=(_t(b,w,32,2,71)-.5)*.08+(_t(b,w,6,3,83)-.5)*.1,k=wt(.5+g+v);P=it(a[0],o[0],k)+(k-.5)*6,S=it(a[1],o[1],k)+(k-.5)*6,E=it(a[2],o[2],k)+(k-.5)*6}const I=1;if(e&&(y%h<I||m%h<I)){const A=n?.55:.9;P=it(P,l[0],A),S=it(S,l[1],A),E=it(E,l[2],A)}const _=(m*t+y)*4;i[_]=Math.round(wt(P/255)*255),i[_+1]=Math.round(wt(S/255)*255),i[_+2]=Math.round(wt(E/255)*255),i[_+3]=255}}return i}function Qa(s,t=512){const e=s!==$t,i=new Uint8Array(t*t*4),n=new Uint8Array(t*t*4),o=t/2,a=1,r=co(s).data,l=d=>d<=0?1:d===1?.45:0,h=d=>{const u=d%o;return Math.min(Math.max(u-a+1,0),o-u)},c=(d,u)=>Math.max(l(h((d%t+t)%t)),l(h((u%t+t)%t)));for(let d=0;d<t;d++)for(let u=0;u<t;u++){const p=(d*t+u)*4,m=u%o<a||d%o<a,w=(r[p]*.2126+r[p+1]*.7152+r[p+2]*.0722)/255,y=e?.17+(.93-w)*.35:.26+(.84-w)*.2,b=m?e?.75:.85:Math.min(.45,Math.max(.08,y));i[p]=m?205:255,i[p+1]=Math.round(b*255),i[p+2]=0,i[p+3]=255;const P=(c(u+1,d)-c(u-1,d))*.5,S=(c(u,d+1)-c(u,d-1))*.5,E=P*.9,I=-S*.9,_=1/Math.hypot(E,I,1);n[p]=Math.round((E*_*.5+.5)*255),n[p+1]=Math.round((I*_*.5+.5)*255),n[p+2]=Math.round((_*.5+.5)*255),n[p+3]=255}return{rough:i,normal:n}}const Ks=new Map;function Ja(s){let t=Ks.get(s);return t||Ks.set(s,t=Qa(s)),{...t,size:Math.round(Math.sqrt(t.rough.length/4))}}const Xs=new Map;function co(s){let t=Xs.get(s);return t||Xs.set(s,t=Za(s)),{data:t,size:Math.round(Math.sqrt(t.length/4))}}const tr={[_e]:1,[$t]:.8,tiles_white:.4,tiles_grey:.35,floor_sport:.3,oak:.22},er=s=>tr[s]??0,sr=s=>1-.25*Math.min(1,Math.max(0,s)),ir={value:0};function or(s,t){if(s.userData.swRefl!==void 0||!(t>0))return;s.userData.swRefl=t;const e=s.onBeforeCompile;s.onBeforeCompile=(n,o)=>{e.call(s,n,o),n.uniforms.swReflOn=ir,n.uniforms.swReflA={value:sr(t)},n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform float swReflOn;
uniform float swReflA;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
if ( swReflOn > 0.5 ) gl_FragColor.a = swReflA;`)};const i=s.customProgramCacheKey.bind(s);s.customProgramCacheKey=()=>`${i()}|swrefl1`}const nr=20,nc={light:{strength:.7,maxDist:4},dark:{strength:.75,maxDist:4}},ac=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,rc=`
#define SW_STEPS ${nr}
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform mat4 uProj;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform float uStrength;
uniform float uMaxDist;
uniform float uThickness;
uniform vec2 uTexel;
varying vec2 vUv;

vec3 swViewPos( vec2 uv, float d ) {
  vec4 c = uInvProj * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
  return c.xyz / c.w;
}
vec2 swProject( vec3 q ) {
  vec4 c = uProj * vec4( q, 1.0 );
  return c.xy / c.w * 0.5 + 0.5;
}
float swIgn( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }

void main() {
  vec4 col = texture2D( tDiffuse, vUv );
  float a = col.a;
  if ( a < 0.7 || a > 0.996 ) { gl_FragColor = col; return; }
  col.a = 1.0;
  float k = clamp( ( 1.0 - a ) * 4.0, 0.0, 1.0 );
  float d = texture2D( tDepth, vUv ).x;
  vec3 n = normalize( texture2D( tNormal, vUv ).xyz * 2.0 - 1.0 );
  vec3 nw = normalize( mat3( uCamWorld ) * n );
  if ( d >= 1.0 || nw.y < 0.85 ) { gl_FragColor = col; return; }
  vec3 P = swViewPos( vUv, d );
  vec3 V = uProj[ 3 ][ 3 ] > 0.5 ? vec3( 0.0, 0.0, - 1.0 ) : normalize( P );
  vec3 R = normalize( reflect( V, n ) );
  float stepLen = uMaxDist / float( SW_STEPS );
  float t = stepLen * ( 0.25 + 0.75 * swIgn( gl_FragCoord.xy ) );
  float prevT = 0.0;
  vec2 huv = vec2( 0.0 );
  float hit = 0.0;
  for ( int i = 0; i < SW_STEPS; i ++ ) {
    vec3 Q = P + R * t;
    vec2 uv = swProject( Q );
    if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) break;
    float sd = texture2D( tDepth, uv ).x;
    if ( sd < 1.0 ) {
      float dz = swViewPos( uv, sd ).z - Q.z;
      if ( dz > 0.0 && dz < uThickness ) {
        float lo = prevT;
        float hi = t;
        for ( int j = 0; j < 4; j ++ ) {
          float mid = 0.5 * ( lo + hi );
          vec3 M = P + R * mid;
          vec2 muv = swProject( M );
          if ( swViewPos( muv, texture2D( tDepth, muv ).x ).z - M.z > 0.0 ) { hi = mid; uv = muv; } else lo = mid;
        }
        huv = uv;
        hit = 1.0;
        t = hi;
        break;
      }
    }
    prevT = t;
    t += stepLen;
  }
  if ( hit > 0.0 ) {
    vec2 e = smoothstep( 0.0, 0.06, huv ) * ( 1.0 - smoothstep( 0.94, 1.0, huv ) );
    float fade = e.x * e.y * ( 1.0 - smoothstep( 0.45 * uMaxDist, uMaxDist, t ) );
    float cosv = clamp( dot( - V, n ), 0.0, 1.0 );
    float fres = mix( 0.4, 1.0, pow( 1.0 - cosv, 3.0 ) );
    // three taps across the hit soften the jittered march's stipple (a polished, not a mirror, finish)
    vec2 px = uTexel * 1.5;
    vec3 rc = ( texture2D( tDiffuse, huv ).rgb * 2.0 + texture2D( tDiffuse, huv + vec2( px.x, 0.0 ) ).rgb + texture2D( tDiffuse, huv - vec2( 0.0, px.y ) ).rgb ) * 0.25;
    col.rgb = mix( col.rgb, rc, clamp( k * uStrength * fade * fres, 0.0, 1.0 ) );
  }
  gl_FragColor = col;
}`,ar={rung:"lite",style:"light",furniture:"models",textures:"files",sectionCut:!0,backdrop:"sky",floorFinish:ms,reflections:!0},bt=new Map([...xn,...Va].map(s=>[s.id,s])),lt=s=>s*Math.PI/180,uo=new Set(["floor","wall","lintel","sill","head","door","window","object","connector","camera","room"]),rr=new Set(["wall","lintel","sill","head","door","window","object","connector","camera","ceiling"]),lr=.5,Vs=.8,hr=.35,cr=lt(35);function po(s,t){return Sa(t,s.levels,s.real?.lamps??[])}class dr{constructor(t,e){this.base=t,this.onLoad=e,this.loader=new Fo,this.textures=new Map,this.failed=new Set,this.mats=new Map,this.pendingLoads=0,this.clip=null,this.roughMean=new Map,this.ao=null,this.style="light",this.source="files",this.rung="lite"}get pending(){return this.pendingLoads}tex(t,e){if(this.failed.has(t))return null;let i=this.textures.get(t);return i||(this.pendingLoads++,i=this.loader.load(t,n=>{this.pendingLoads--,!e&&t.endsWith("rough_ao.jpg")&&this.measureRoughness(t,n),this.onLoad()},void 0,()=>{this.pendingLoads--,this.failed.add(t);for(const n of this.mats.values())(n.m.map===i||n.m.normalMap===i||n.m.roughnessMap===i)&&(n.m.map=null,n.m.normalMap=null,n.m.roughnessMap=null,n.m.aoMap=null,n.m.roughness=bt.get(n.id)?.roughness??1,n.m.needsUpdate=!0);this.onLoad()}),i.wrapS=zt,i.wrapT=zt,i.colorSpace=e?Kt:ks,i.anisotropy=8,this.textures.set(t,i),i)}finishMap(t,e="color"){const i=e==="color"?`finish:${t}`:`finish:${t}:${e}`;let n=this.textures.get(i);if(n)return n;let o,a;if(e==="color")({data:o,size:a}=co(t));else{const l=Ja(t);o=e==="rough"?l.rough:l.normal,a=l.size}const r=new Oo(o,a,a,No,Vi);return r.wrapS=zt,r.wrapT=zt,r.colorSpace=e==="color"?Kt:ks,r.magFilter=je,r.minFilter=Bo,r.generateMipmaps=!0,r.anisotropy=8,r.needsUpdate=!0,r.name=i,this.textures.set(i,n=r),n}measureRoughness(t,e){try{const i=e.image,o=(typeof OffscreenCanvas<"u"?new OffscreenCanvas(16,16):Object.assign(document.createElement("canvas"),{width:16,height:16})).getContext("2d");if(!o||!i?.width)return;o.drawImage(i,0,0,16,16);const a=o.getImageData(0,0,16,16).data;let r=0;for(let h=1;h<a.length;h+=4)r+=a[h];const l=r/(a.length/4)/255;if(!(l>.02))return;this.roughMean.set(t,l);for(const h of this.mats.values())h.m.roughnessMap===e&&this.fitRoughness(h.m,h.id,h.variant)}catch{}}fitRoughness(t,e,i){const n=bt.get(e);let o;for(const[r,l]of this.roughMean)this.textures.get(r)===t.roughnessMap&&(o=l);let a=o?ur(n?.roughness??1,o):1;i.startsWith("slot:")&&(a=Number(i.slice(5))),i==="floor"&&(a*=W[this.style].rig.floorSheen),t.roughness=a}roughnessOf(){const t={};for(const e of this.mats.values())(e.variant==="std"||e.variant==="floor")&&(t[`${e.id}|${e.variant}`]=Math.round(e.m.roughness*1e3)/1e3);return t}tint(t){return new Q(t?.tint[this.style]??"#cccccc").getHex()}get(t,e="std",i=!0){const n=`${t}|${e}|${i?1:0}`,o=this.mats.get(n);if(o)return o.m;const a=e.startsWith("vc:"),r=a?e.slice(3):e,l=bt.get(t);let h;if(r==="glass"||l?.glass){const c=W[this.style].glass,d=t==="glass_frosted";h=new Dt({color:d?14674419:c.tint,transparent:!0,opacity:d?.62:c.opacity,roughness:d?.35:.04,metalness:0,envMapIntensity:d?1:c.env,depthWrite:!1,side:It,forceSinglePass:!0}),d||Ka(h)}else{const c=l?.metalness??0;h=new Dt({color:this.tint(l),roughness:l?.roughness??1,metalness:c,envMapIntensity:c>.5?1:.7});const d=r==="nomap"||this.source!=="files"?null:Mn(t,this.base);if(d){const u=this.tex(d.color,!0),p=this.tex(d.normal,!1),m=this.tex(d.roughAo,!1);u&&p&&m&&(h.map=u,h.normalMap=p,h.normalScale=new yt(l?.normal??1,l?.normal??1),h.roughnessMap=m,h.aoMap=m,h.aoMapIntensity=.6,h.roughness=1)}else r!=="nomap"&&this.source==="files"&&Ya(t)&&(h.map=this.finishMap(t),h.roughnessMap=this.finishMap(t,"rough"),h.aoMap=h.roughnessMap,h.aoMapIntensity=.5,h.normalMap=this.finishMap(t,"normal"),h.normalScale=new yt(Vs,Vs),h.roughness=1,h.envMapIntensity=hr);h.roughnessMap?this.fitRoughness(h,t,r):(r.startsWith("slot:")&&(h.roughness=Number(r.slice(5))),r==="floor"&&(h.roughness*=W[this.style].rig.floorSheen)),this.ao&&Ha(h,this.ao),r==="floor"&&or(h,er(t))}return h.userData.materialId=t,a&&(h.vertexColors=!0),i&&(h.clippingPlanes=this.clip),h.clipShadows=!0,this.mats.set(n,{id:t,variant:r,m:h}),h}setStyle(t){this.style=t;const e=W[t].glass;for(const i of this.mats.values()){const n=bt.get(i.id);if(i.variant==="glass"||n?.glass){i.id!=="glass_frosted"&&i.m.color.setHex(e.tint),i.m.envMapIntensity=e.env,i.id!=="glass_frosted"&&(i.m.opacity=e.opacity);continue}i.m.color.setHex(this.tint(n)),i.variant==="floor"&&(i.m.roughnessMap?this.fitRoughness(i.m,i.id,i.variant):i.m.roughness=(n?.roughness??1)*W[t].rig.floorSheen)}}setClip(t){this.clip=t;for(const[e,i]of this.mats)e.split("|")[2]==="1"&&(i.m.clippingPlanes=t)}setRung(t){if(t!==this.rung){this.rung=t;for(const[e,i]of[...this.mats])(i.variant==="glass"||bt.get(i.id)?.glass)&&(i.m.dispose(),this.mats.delete(e))}}setSource(t){if(t!==this.source){this.source=t;for(const e of this.mats.values())e.m.dispose();this.mats.clear()}}dispose(){for(const t of this.mats.values())t.m.dispose();for(const t of this.textures.values())t.dispose();this.mats.clear(),this.textures.clear()}}const Ys=[.75,1.5];function ur(s,t){return t>.02?Math.round(Math.min(Ys[1],Math.max(Ys[0],s/t))*1e3)/1e3:1}class pr{constructor(t,e){this.base=t,this.onLoad=e,this.cache=new Map,this.loading=new Set,this.version=0}get pending(){return this.loading.size}template(t){if(this.cache.has(t))return this.cache.get(t);this.loading.has(t)||(this.loading.add(t),fetch(An(t,this.base)).then(e=>e.ok?e.arrayBuffer():Promise.reject(new Error(`HTTP ${e.status}`))).then(e=>{const i=pa(e),n=i.primitives.map(o=>{const a=new ht;return a.setAttribute("position",new mt(o.positions,3)),a.setAttribute("normal",new mt(ra(o.positions,cr),3)),{geometry:a,slot:o.material}});this.cache.set(t,{model:i,geos:n})}).catch(e=>{console.warn(`sw-plan-3d: model ${t} failed, the procedural family draws instead`,e),this.cache.set(t,null)}).finally(()=>{this.loading.delete(t),this.version++,this.onLoad()}))}dispose(){for(const t of this.cache.values())for(const e of t?.geos??[])e.geometry.dispose();this.cache.clear()}}let Zs=null,Pt=null,Bt=null,Qs=null;function Pe(s,t,e){const i=document.createElement("canvas");i.width=s,i.height=t;const n=i.getContext("2d");return n&&e(n),new Me(i)}function fr(){return Zs??=Pe(128,128,s=>{const t=s.createRadialGradient(64,64,0,64,64,64);t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.45,"rgba(0,0,0,0.75)"),t.addColorStop(.8,"rgba(0,0,0,0.18)"),t.addColorStop(1,"rgba(0,0,0,0)"),s.fillStyle=t,s.fillRect(0,0,128,128)}),Zs}function mr(s,t){const e=Math.max(s[0],.02)/2,i=Math.max(s[2],.02)/2,n=Math.round((.04+.12*Math.min(1,Math.max(0,s[1])))*1e3)/1e3,o=t?Math.min(e,i):Math.min(.04,e,i);return{hx:e,hz:i,margin:n,corner:o}}const wr=`
float swContact(vec2 p, vec4 b) {
  vec2 q = abs(p) - b.xy + b.w;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - b.w;
  if (d > 0.0) { float t = 1.0 - clamp(d / max(b.z, 1e-3), 0.0, 1.0); return t * t; }
  return 1.0;
}`;function gr(s){s.onBeforeCompile=t=>{t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
attribute vec4 aBox;
varying vec2 vSwLocal;
varying vec4 vSwBox;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vSwLocal = position.xz * 2.0 * (aBox.xy + aBox.z);
vSwBox = aBox;`),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
varying vec2 vSwLocal;
varying vec4 vSwBox;
${wr}`).replace("#include <alphatest_fragment>",`diffuseColor.a *= swContact(vSwLocal, vSwBox);
#include <alphatest_fragment>`)},s.customProgramCacheKey=()=>"sw-contact-blob"}function vr(){return Pt||(Pt=Pe(4,64,s=>{const t=s.createLinearGradient(0,0,0,64);t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.35,"rgba(0,0,0,0.45)"),t.addColorStop(1,"rgba(0,0,0,0)"),s.fillStyle=t,s.fillRect(0,0,4,64)}),Pt.wrapS=zt,Pt.wrapT=Tt,Pt.flipY=!1),Pt}function Js(){return Qs??=Pe(256,256,s=>{const t=s.createRadialGradient(128,128,0,128,128,128);t.addColorStop(0,"#fff"),t.addColorStop(.55,"#fff"),t.addColorStop(1,"#000"),s.fillStyle=t,s.fillRect(0,0,256,256)}),Qs}function br(){return Bt||(Bt=Pe(1024,128,s=>{s.fillStyle="#000",s.fillRect(0,0,1024,128);let t=77;const e=()=>(t=t*1664525+1013904223>>>0,t/4294967296);s.fillStyle="#fff",s.beginPath(),s.moveTo(0,128);for(let i=0;i<=1024;i+=8)s.lineTo(i,128-(60+22*Math.sin(i*.02)+14*Math.sin(i*.071+1.3)+e()*10));s.lineTo(1024,128),s.closePath(),s.fill()}),Bt.wrapS=zt,Bt.repeat.set(6,1)),Bt}class Ze{constructor(){this.pos=[],this.nrm=[],this.ranges=[],this.parts=[],this.uv=[],this.ownUv=!1,this.col=null}push(t,e,i,n={}){const o=t.index?t.toNonIndexed():t,a=o.getAttribute("position"),r=o.getAttribute("normal"),l=n.ownUv?o.getAttribute("uv"):null;l&&(this.ownUv=!0);for(let d=0;d<a.count;d++)l?this.uv.push(l.getX(d),l.getY(d)):this.uv.push(NaN,NaN);if(n.jitter!==void 0){this.col??=[];for(let d=0;d<a.count;d++)this.col.push(n.jitter,n.jitter,n.jitter)}const h=new Go().getNormalMatrix(e),c=new C;this.ranges.push(this.pos.length/9),this.parts.push(i);for(let d=0;d<a.count;d++)c.set(a.getX(d),a.getY(d),a.getZ(d)).applyMatrix4(e),this.pos.push(c.x,c.y,c.z),r?(c.set(r.getX(d),r.getY(d),r.getZ(d)).applyMatrix3(h).normalize(),this.nrm.push(c.x,c.y,c.z)):this.nrm.push(0,1,0);o!==t&&o.dispose()}geometry(t){const e=new ht,i=new Float32Array(this.pos);if(e.setAttribute("position",new J(i,3)),e.setAttribute("normal",new J(new Float32Array(this.nrm),3)),t!==null){const n=so(i,t);if(this.ownUv)for(let o=0;o<n.length;o++)Number.isNaN(this.uv[o])||(n[o]=this.uv[o]);e.setAttribute("uv",new J(n,2))}return this.col&&e.setAttribute("color",new J(new Float32Array(this.col),3)),e.computeBoundingSphere(),e}}const Mt=(s,t,e=[1,1,1])=>new ot().compose(new C(s[0],s[1],s[2]),new vt().setFromEuler(new rt(lt(t[0]),lt(t[1]),lt(t[2]),"YXZ")),new C(e[0],e[1],e[2]));function jt(s,t,e,i,n){let o;const[a,r,l]=[Math.max(t[0],.001),Math.max(t[1],.001),Math.max(t[2],.001)];s==="rbox"&&e>0?o=new qo(a,r,l,Math.min(a,r,l)<.12?1:2,Math.min(e,Math.min(a,r,l)/2-1e-4)):s==="cyl"||s==="cylinder"?o=new Se(a/2*i,a/2,r,14):s==="sphere"?o=new Qi(.5,12,8).scale(a,r,l):o=new Xt(a,r,l);const h=o.index?o.toNonIndexed():o;return h!==o&&o.dispose(),h.setAttribute("uv",new J(so(h.getAttribute("position").array,n),2)),h}const ti=s=>s.map(t=>Math.round(t*1e3)).join("x");function Qe(s,t,e,i=!1){if(s.length<3)return null;const n=ds.triangulateShape(s.map(([r,l])=>new yt(r,l)),[]),o=[];for(const[r,l,h]of n){const[c,d,u]=[s[r],s[l],s[h]],p=(d[0]-c[0])*(u[1]-c[1])-(u[0]-c[0])*(d[1]-c[1]);Math.abs(p)<1e-10||(p>0!==i?o.push(c[0],t+e,c[1],u[0],t+e,u[1],d[0],t+e,d[1]):o.push(c[0],t+e,c[1],d[0],t+e,d[1],u[0],t+e,u[1]))}if(!o.length)return null;const a=new ht;return a.setAttribute("position",new mt(o,3)),a.computeVertexNormals(),a}function yr(s,t){return s.finish?Xa(t.floorFinish??ms):s.material}const kr=24e3;function ei(s,t){return s>=2&&s*t>kr}function xr(s){const{real:t,settings:e,mats:i,models:n}=s,o={root:new ut,lookup:new Map,leaves:new Map,shutters:new Map,bulbs:new Map,caps:null,glow:null,stats:{meshes:0,instanced:0,merged:0,models:0,furnitureMerged:0}};o.root.name="real";const a=new Set(s.desc.levels.map(f=>f.id)),r=s.heavy,l=s.mergeFurniture!==!1,h=new Set(r?[]:t.replaced),c=new Set,d=[];if(e.furniture==="models"&&!r)for(const f of t.models){const g=_n[f.item];if(!g||!a.has(f.level_id))continue;const v=n.template(g.file);v&&(c.add(f.owner),d.push({row:f,entry:g,tpl:v}))}const u=new Map,p=new Map,m=(f,g,v,k,M=!0)=>{const z=`${f??""}|${g}|${v}|${rr.has(k)?"c":"n"}|${M||v==="glass"?1:0}`;let x=u.get(z);return x||u.set(z,x=new Ze),x},w=new Map,y=new Xt(1,1,1),b=(f,g)=>({id:f.id,kind:g,userData:f.userData});for(const f of s.parts){if(!uo.has(f.kind)||h.has(f.id)||c.has(f.id)||f.kind==="room")continue;const g=t.materials[f.id]??"plaster_white";if(f.kind==="window"||g==="glass"||g==="glass_frosted"){m(f.level_id,g==="glass_frosted"?"glass_frosted":"glass","glass",f.kind).push(y,Mt(f.position,f.rotation,[Math.max(f.size[0],.001),Math.max(f.size[1],.001),Math.max(f.size[2],.001)]),b(f,f.kind));continue}if(f.kind==="door"&&f.shape==="box"){o.leaves.set(f.id,Mr(f,t,s,i,o));continue}if((f.kind==="object"||f.kind==="camera")&&(f.shape==="box"||f.shape==="cylinder")){const M=r?0:t.radius[f.id]??0,z=f.shape==="cylinder"?"cyl":M>0?"rbox":"box",x=`${f.level_id}|${z}|${ti(f.size)}|${M}|${g}`;let L=p.get(x);L||p.set(x,L={shape:z,size:f.size,radius:M,taper:1,material:g,variant:"std",level:f.level_id,shadow:!0,items:[]}),L.items.push({matrix:Mt(f.position,f.rotation),part:b(f,f.kind)});continue}if(f.shape==="prism"){const M=Ar(f);M&&m(f.level_id,g,"std",f.kind).push(M,new ot().makeTranslation(f.position[0],f.position[1],f.position[2]),b(f,f.kind));continue}if(f.shape!=="box"&&f.shape!=="cylinder")continue;const v=f.kind==="floor"?"floor":"std",k=f.shape==="cylinder"?new Se(.5,.5,1,16):y;m(f.level_id,g,v,f.kind).push(k,Mt(f.position,f.rotation,[Math.max(f.size[0],.001),Math.max(f.size[1],.001),Math.max(f.size[2],.001)]),b(f,f.kind)),k!==y&&k.dispose()}if(!r)for(const f of t.parts){if(!a.has(f.level_id??"")&&f.level_id!==null||c.has(f.owner)||o.leaves.has(f.owner))continue;const g={id:f.id,kind:f.userData.kind==="opening"?"door":"object",userData:f.userData};if(f.bulb){const M=Sr(i,f.bulb,o),z=jt(f.shape,f.size,f.radius??0,f.taper??1,1),x=new U(z,M);x.applyMatrix4(Mt(f.position,f.rotation)),x.name=f.id,x.userData.ownMaterial=!0,o.lookup.set(x,[g]),o.root.add(x),o.stats.meshes++;continue}if(f.userData.kind==="wall"||f.userData.kind==="opening"){const M=jt(f.shape,f.size,f.radius??0,f.taper??1,1);m(f.level_id,f.material,"std","wall").push(M,Mt(f.position,f.rotation),g),M.dispose();continue}const v=`${f.level_id}|${f.shape}|${ti(f.size)}|${f.radius??0}|${f.taper??1}|${f.material}|${f.shadow?1:0}`;let k=p.get(v);k||p.set(v,k={shape:f.shape,size:f.size,radius:f.radius??0,taper:f.taper??1,material:f.material,variant:"std",level:f.level_id,shadow:f.shadow,items:[]}),k.items.push({matrix:Mt(f.position,f.rotation),part:g})}for(const f of t.floors){if(!a.has(f.level_id))continue;const g=Qe(f.polygon,f.y,.006),v=yr(f,e);g&&m(f.level_id,v,"floor","floor").push(g,new ot,{id:f.id,kind:"room",userData:{id:f.zone,kind:"zone"}})}for(const f of t.ceilings??[]){if(!a.has(f.level_id))continue;const g=Qe(f.polygon,f.y-.006,.006,!0);g&&m(f.level_id,f.material,"std","ceiling").push(g,new ot,{id:f.id,kind:"room",userData:{id:f.zone,kind:"zone"}})}const P=[];for(const[f,g]of[...p].sort((v,k)=>v[0]<k[0]?-1:1)){const v=bt.get(g.material),k=jt(g.shape,g.size,g.radius,g.taper,v?.tile_m??1);if(l&&!ei(g.items.length,k.getAttribute("position").count/3)){const M=m(g.level,g.material,g.variant,"object",g.shadow);for(const z of g.items)M.push(k,z.matrix,z.part,{ownUv:!0});k.dispose(),o.stats.furnitureMerged+=g.items.length;continue}P.push([f,g,k])}for(const[f,g]of[...u].sort((v,k)=>v[0]<k[0]?-1:1)){const[v,k,M,z,x]=f.split("|"),L=bt.get(k),$=g.geometry(L?.tile_m??1),j=i.get(k,M==="glass"?"glass":M,z==="c"),N=new U($,j);N.name=`merged|${v}|${k}|${M}${x==="0"?"|noshadow":""}`,N.userData.ranges=Uint32Array.from(g.ranges);const H=M==="glass";N.castShadow=!H&&x!=="0",N.receiveShadow=!H,H&&(N.renderOrder=2),o.lookup.set(N,g.parts),o.root.add(N),o.stats.merged++}for(const[f,g,v]of P){const k=new gt(v,i.get(g.material,g.variant,!0),g.items.length);g.items.forEach((M,z)=>k.setMatrixAt(z,M.matrix)),k.instanceMatrix.needsUpdate=!0,k.computeBoundingSphere(),k.castShadow=g.shadow,k.receiveShadow=!0,k.name=`inst|${f}`,o.lookup.set(k,g.items.map(M=>M.part)),o.root.add(k),o.stats.instanced++}const S=new Map;for(const{row:f,entry:g,tpl:v}of d){const k=`${f.level_id}|${g.file}`;let M=S.get(k);M||S.set(k,M={entry:g,tpl:v,level:f.level_id,list:[]});const z=fa(v.model.min,v.model.max,f.size[0],f.size[1],f.size[2]),x={id:f.owner,kind:"object",userData:{id:f.id.slice(6),kind:"object"}};for(const L of f.tiles){const $=new ot().compose(new C(L[0],L[1],L[2]),new vt().setFromEuler(new rt(0,lt(f.yaw),0,"YXZ")),new C(...z.scale));$.multiply(new ot().makeTranslation(z.offset[0],z.offset[1],z.offset[2])),M.list.push({m:$,part:x,j:ma(L[0],L[2])})}}for(const[f,g]of[...S].sort((v,k)=>v[0]<k[0]?-1:1)){const v=g.tpl.geos.reduce((k,M)=>k+M.geometry.getAttribute("position").count/3,0);if(l&&!ei(g.list.length,v)){g.tpl.geos.forEach(k=>{const M=g.entry.slots[k.slot]??g.entry.fallback,z=`${g.level}|${M}|slot:${Ds[k.slot]??.6}`;let x=w.get(z);x||w.set(z,x=new Ze);for(const L of g.list)x.push(k.geometry,L.m,L.part,{jitter:L.j})}),o.stats.furnitureMerged+=g.list.length;continue}g.tpl.geos.forEach((k,M)=>{const z=g.entry.slots[k.slot]??g.entry.fallback,x=new gt(k.geometry,i.get(z,`slot:${Ds[k.slot]??.6}`,!0),g.list.length),L=new Q;g.list.forEach(($,j)=>{x.setMatrixAt(j,$.m),x.setColorAt(j,L.setScalar($.j))}),x.instanceMatrix.needsUpdate=!0,x.instanceColor&&(x.instanceColor.needsUpdate=!0),x.computeBoundingSphere(),x.castShadow=!0,x.receiveShadow=!0,x.name=`model|${f}|${M}`,x.userData.shared=!0,o.lookup.set(x,g.list.map($=>$.part)),o.root.add(x),o.stats.models++})}for(const[f,g]of[...w].sort((v,k)=>v[0]<k[0]?-1:1)){const[v,k,M]=f.split("|"),z=new U(g.geometry(null),i.get(k,`vc:${M}`,!0));z.name=`model-merged|${v}|${k}|${M}`,z.userData.ranges=Uint32Array.from(g.ranges),z.castShadow=!0,z.receiveShadow=!0,o.lookup.set(z,g.parts),o.root.add(z),o.stats.models++}for(const f of t.shutters){if(!a.has(f.level_id))continue;const g=new Xt(f.width,1,.04).translate(0,-.5,0),v=new U(g,i.get("shutter","std",!0));v.position.set(f.position[0],f.position[1],f.position[2]),v.rotation.set(0,lt(f.yaw),0,"YXZ"),v.scale.y=Math.max(.001,f.down*f.height),v.visible=f.down>.001,v.castShadow=!0,v.name=f.id,o.lookup.set(v,[{id:f.id,kind:"window",userData:{id:f.id.slice(8),kind:"opening"}}]),o.shutters.set(f.id,{mesh:v,height:f.height}),o.root.add(v)}const E=W[e.style],I=new Map(s.desc.levels.map(f=>[f.id,f.elevation_m])),_=_r(s.parts.filter(f=>f.kind==="wall"&&f.shape==="box"&&f.userData.kind==="wall"&&Math.abs(f.position[1]-f.size[1]/2-(I.get(f.level_id??"")??0))<.02));if(_){const f=new pt({map:vr(),color:0,transparent:!0,opacity:E.post.junctionAlpha,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),g=new U(_,f);g.name="ao-strips",g.renderOrder=1,g.userData.ownMaterial=!0,g.userData.skipAO=!0,o.root.add(g)}const A=s.parts.filter(f=>f.kind==="object"&&(f.shape==="box"||f.shape==="cylinder")&&f.position[1]-f.size[1]/2<=(I.get(f.level_id??"")??0)+lr);if(A.length){const f=new pt({color:0,transparent:!0,opacity:E.post.blobAlpha,depthWrite:!1});gr(f);const g=new ye(1,1).rotateX(-Math.PI/2),v=new gt(g,f,A.length),k=new Float32Array(A.length*4);A.forEach((M,z)=>{const x=mr(M.size,M.shape==="cylinder");k.set([x.hx,x.hz,x.margin,x.corner],z*4);const L=M.size[1]>.1?.024:.006;v.setMatrixAt(z,new ot().compose(new C(M.position[0],M.position[1]-M.size[1]/2+L,M.position[2]),new vt().setFromEuler(new rt(0,lt(M.rotation[1]),0,"YXZ")),new C(2*(x.hx+x.margin),1,2*(x.hz+x.margin))))}),g.setAttribute("aBox",new Uo(k,4)),v.instanceMatrix.needsUpdate=!0,v.computeBoundingSphere(),v.name="ao-blobs",v.renderOrder=1,v.userData.ownMaterial=!0,v.userData.skipAO=!0,o.root.add(v)}if(t.caps.length){const f=new ut;f.name="caps";const g=new Map;for(const v of t.caps)a.has(v.level_id)&&g.set(v.level_id,[...g.get(v.level_id)??[],v]);for(const[v,k]of[...g].sort((M,z)=>M[0]<z[0]?-1:1)){const M=[],z=[];for(const H of k){const G=H.polygon;for(let B=1;B+1<G.length;B++)M.push(G[0][0],H.y,G[0][1],G[B+1][0],H.y,G[B+1][1],G[B][0],H.y,G[B][1]);for(let B=0;B<G.length;B++)z.push(G[B][0],H.y+.002,G[B][1],G[(B+1)%G.length][0],H.y+.002,G[(B+1)%G.length][1])}const x=new ht;x.setAttribute("position",new mt(M,3)),x.computeVertexNormals();const L=new pt({color:E.cut.cap,side:It}),$=new U(x,L);$.name=`caps|${v}`,$.userData={level:v,ownMaterial:!0},f.add($);const j=new ht;j.setAttribute("position",new mt(z,3));const N=new Yi(j,new Zi({color:E.cut.edge??E.cut.cap,transparent:!0,opacity:.9}));N.name=`capedge|${v}`,N.userData={level:v,edge:!0,ownMaterial:!0},N.visible=E.cut.edge!==null,f.add(N)}o.caps=f,o.root.add(f)}if(s.glow){const f=po(s.desc,s.parts),g=s.glow.prev&&[...s.glow.prev.values()].every(v=>a.has(v.room.level_id))?s.glow.prev:null;(f.length||g&&g.size)&&(o.glow=new La(f,e.style,s.glow.night,g,s.glow.now),o.root.add(o.glow.root))}return y.dispose(),o.stats.meshes+=o.root.children.length,o}function Mr(s,t,e,i,n){const o=new ut;o.name=s.id,o.position.set(s.position[0],s.position[1],s.position[2]),o.quaternion.setFromEuler(new rt(lt(s.rotation[0]),lt(s.rotation[1]),lt(s.rotation[2]),"YXZ"));const a=t.materials[s.id]??"door_wood",r=new U(jt(e.heavy?"box":"rbox",s.size,t.radius[s.id]??.006,1,bt.get(a)?.tile_m??1),a==="glass"?i.get("glass","glass",!0):i.get(a,"std",!0));if(r.castShadow=!0,r.receiveShadow=!0,r.name=`${s.id}|leaf`,o.add(r),n.lookup.set(r,[{id:s.id,kind:"door",userData:s.userData}]),!e.heavy){const l=new ot().compose(o.position,o.quaternion,new C(1,1,1)).invert(),h=new Ze;for(const c of t.parts){if(c.owner!==s.id)continue;const d=jt(c.shape,c.size,c.radius??0,c.taper??1,.5);h.push(d,l.clone().multiply(Mt(c.position,c.rotation)),{id:c.id,kind:"door",userData:c.userData}),d.dispose()}if(h.parts.length){const c=new U(h.geometry(.5),i.get("metal_light","std",!0));c.name=`${s.id}|metal`,c.castShadow=!0,n.lookup.set(c,h.parts),c.userData.ranges=Uint32Array.from(h.ranges),o.add(c)}}return n.root.add(o),o}function Sr(s,t,e){let i=e.bulbs.get(t);return i||(i=s.get("plastic","std",!0).clone(),i.color.setHex(15921128),i.emissive.setRGB(0,0,0),i.userData.ownMaterial=!0,e.bulbs.set(t,i)),i}function Ar(s){return Qe(s.polygon??[],0,s.size[1])}function _r(s){const t=[],e=[],i=(o,a,r,l,h)=>{t.push(...o,...a,...r,...o,...r,...l),e.push(0,0,h,0,h,1,0,0,h,1,0,1)};for(const o of s){const[a,r,l]=o.size;if(a<.32)continue;const h=lt(o.rotation[1]),c=Math.cos(h),d=-Math.sin(h),u=-d,p=c,m=o.position[1]-r/2,w=a/.5;for(const y of[-1,1]){const b=o.position[0]+u*y*(l/2),P=o.position[2]+p*y*(l/2),S=[b-c*a/2,P-d*a/2],E=[b+c*a/2,P+d*a/2],I=u*y*.3,_=p*y*.3;i([S[0],m+.006,S[1]],[E[0],m+.006,E[1]],[E[0]+I,m+.006,E[1]+_],[S[0]+I,m+.006,S[1]+_],w);const A=.004;i([S[0]+u*y*A,m,S[1]+p*y*A],[E[0]+u*y*A,m,E[1]+p*y*A],[E[0]+u*y*A,m+.3,E[1]+p*y*A],[S[0]+u*y*A,m+.3,S[1]+p*y*A],w)}}if(!t.length)return null;const n=new ht;return n.setAttribute("position",new mt(t,3)),n.setAttribute("uv",new mt(e,2)),n.computeVertexNormals(),n}function Pr(s,t,e){const i=W[t],n=new ut;n.name="exterior";const o=(s.x0+s.x1)/2,a=(s.z0+s.z1)/2,r=s.x1-s.x0,l=s.z1-s.z0,h=Math.hypot(r,l)*.8+20,c=s.y0-.06,d=e?new Dt({color:i.ground.disc,roughness:1,transparent:!0,alphaMap:Js(),depthWrite:!1}):new pt({color:i.ground.disc,transparent:!0,alphaMap:Js(),depthWrite:!1}),u=new U(new ye(2*h,2*h).rotateX(-Math.PI/2),d);u.position.set(o,c,a),u.receiveShadow=e,u.name="ground",u.renderOrder=-2;const p=new U(new Xt(r+3,0,l+3),new pt({map:fr(),color:0,transparent:!0,opacity:i.ground.contact,depthWrite:!1}));p.position.set(o,c+.01,a),p.name="ground-contact",p.renderOrder=-1;const m=new Se(i.horizon.radius,i.horizon.radius,i.horizon.height,64,1,!0),w=new U(m,new pt({color:i.horizon.color,alphaMap:br(),transparent:!0,side:xs,depthWrite:!1,fog:!1}));w.position.set(o,c+i.horizon.height/2,a),w.name="horizon",w.renderOrder=-3;const y=new Qi(400,32,16);y.setAttribute("color",new J(new Float32Array(y.getAttribute("position").count*3),3));const b=new U(y.clone(),new pt({vertexColors:!0,side:xs,toneMapped:!1,fog:!1,depthWrite:!1}));b.frustumCulled=!1,b.renderOrder=-10,b.name="sky",b.position.set(o,0,a);const P=new He,S=new U(y,b.material);P.add(S);const E=[],I=(_,A,f)=>{const g=new U(new ye(_,A),new pt({color:16777215,side:It,toneMapped:!1,fog:!1}));g.position.set(...f),g.lookAt(0,0,0),g.userData.ownMaterial=!0,E.push(g),P.add(g)};I(260,260,[0,180,0]),I(220,90,[-200,60,60]),I(160,70,[170,40,-150]);for(const _ of[b,w,u,p])_.userData.ownMaterial=!0;for(const _ of[b,w,u,p])_.userData.skipAO=!0;return b.userData.extra=[...E,S],n.add(b,w,u,p),{root:n,dome:b,domeScene:P,disc:u,contact:p,band:w,softboxes:E,iblDome:S}}function Er(s,t){const e=t==="dark"?.55:1,i=Math.max(0,Math.min(1,s.day)),n=Math.max(0,Math.min(1,s.night)),o=(1.25*i+.06*n)*e,a=(.55*i+.03*n)*e,r=(.35*i+.22*n)*e;return[[o,o,o*1.02],[a*.96,a,a*1.06],[r,r*.78,r*.55]]}function zr(s,t,e,i,n){const o=W[n];s.dome.visible=e,s.band.visible=t==="sky";const a=s.disc.material,r=t==="studio";s.disc.scale.setScalar(r&&!e?Lt.discScale:1);const l=a.isMeshStandardMaterial===!0;if(r){const d=new Q(Lt.disc[n]).lerp(new Q(Lt.discNight[n]),i.night);l?(a.color.copy(d).multiplyScalar(.15),a.emissive.copy(d)):a.color.copy(d)}else a.color.setHex(o.ground.disc).lerp(new Q(o.ground.discNight),i.night),l&&a.emissive.setRGB(0,0,0);s.contact.material.opacity=r&&!e?Math.min(.8,o.ground.contact*1.6):o.ground.contact;const h=s.iblDome?.geometry.getAttribute("color"),c=s.dome.geometry.getAttribute("color");!h||h===c||(r?Tr(s.dome,i,n):c.array.set(h.array),c.needsUpdate=!0)}function Tr(s,t,e){const[i,n,o]=Je(t,e,"studio").map(c=>new Q(c)),a=s.geometry.getAttribute("position"),r=s.geometry.getAttribute("color"),l=new C,h=new Q;for(let c=0;c<a.count;c++)l.fromBufferAttribute(a,c).normalize(),l.y>=0?h.copy(n).lerp(i,Math.pow(l.y,.6)):h.copy(n).lerp(o,Math.min(1,-l.y*4)),r.setXYZ(c,h.r,h.g,h.b)}const Lt={day:{light:["#1b2536","#3a4a63","#0d121b"],dark:["#0c121d","#1e2b40","#05080d"]},night:{light:["#080d18","#1f2e4a","#03050a"],dark:["#05080f","#142037","#020306"]},disc:{light:724758,dark:527121},discNight:{light:922655,dark:593173},discScale:.42};function Dr(s,t,e,i){const n=W[i],o=(s.iblDome??s.dome).geometry,a=o.getAttribute("position"),r=o.getAttribute("color"),l=new C,h=new C(...e).normalize(),c=n.rig.skyScale,d=t.hemiGround.map(u=>(u*.9+.1)*n.backdrop.groundTint);for(let u=0;u<a.count;u++){l.fromBufferAttribute(a,u).normalize();let p;if(l.y<0)p=d;else{const y=Math.pow(l.y,.55);p=[0,1,2].map(b=>(t.skyHorizon[b]+(t.skyTop[b]-t.skyHorizon[b])*y)*c)}const m=Math.max(0,l.dot(h)),w=h.y>-.05?Math.pow(m,400)*.9+Math.pow(m,12)*.18*t.day:0;r.setXYZ(u,Math.min(1,p[0]+w*t.sunColor[0]),Math.min(1,p[1]+w*t.sunColor[1]),Math.min(1,p[2]+w*t.sunColor[2]))}r.needsUpdate=!0,Er(t,i).forEach((u,p)=>{const m=s.softboxes?.[p];m&&m.material.color.setRGB(u[0],u[1],u[2])})}function Je(s,t,e="sky"){const i=W[t];if(e==="studio"){const c=m=>[1,3,5].map(w=>parseInt(m.slice(w,w+2),16)),d=Lt.day[t],u=Lt.night[t],p=Math.max(0,Math.min(1,s.night));return[0,1,2].map(m=>`rgb(${c(d[m]).map((w,y)=>Math.round(w+(c(u[m])[y]-w)*p)).join(", ")})`)}const n=c=>[parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255],o=c=>`rgb(${c.map(d=>Math.round(Math.max(0,Math.min(1,d))*255)).join(", ")})`,a=(c,d)=>o(c.map((u,p)=>(u+d[p])/2)),r=s.night>.5,l=n(r?i.backdrop.topNight:i.backdrop.topDay),h=n(r?i.backdrop.horizonNight:i.backdrop.horizonDay);return[a(l,s.skyTop.map(c=>c*i.rig.skyScale)),a(h,s.skyHorizon.map(c=>c*i.rig.skyScale)),o(s.hemiGround.map(c=>c*i.backdrop.groundTint*.9+.08))]}function si(s){const[t,e,i]=to(s);return new Q(t,e,i)}const ii=()=>Sn;function Lr(s){s.traverse(t=>{const e=t;if(e.isMesh||t.isLineSegments){e.userData.shared||e.geometry?.dispose();const i=e.material;e.userData.ownMaterial&&i&&!Array.isArray(i)&&i.dispose();for(const n of e.userData.extra??[])n.geometry.dispose(),n.material.dispose()}})}const Rr="sw-plan3d-ao",Ct="volumes",Ir=12;function fo(){return new Promise(s=>{try{if(typeof indexedDB>"u")return s(null);const t=indexedDB.open(Rr,1);t.onupgradeneeded=()=>{const e=t.result;e.objectStoreNames.contains(Ct)||e.createObjectStore(Ct,{keyPath:"key"}).createIndex("at","at")},t.onsuccess=()=>s(t.result),t.onerror=()=>s(null),t.onblocked=()=>s(null)}catch{s(null)}})}async function Cr(s){const t=await fo();if(!t)return null;try{return await new Promise(e=>{const i=t.transaction(Ct,"readonly").objectStore(Ct).get(s);i.onsuccess=()=>{const o=i.result?.volume;e(o&&o.key===s&&o.data instanceof Uint8Array?o:null)},i.onerror=()=>e(null)})}catch{return null}finally{t.close()}}async function oi(s){const t=await fo();if(t)try{await new Promise(e=>{const i=t.transaction(Ct,"readwrite"),n=i.objectStore(Ct);n.put({key:s.key,at:Date.now(),volume:s});const o=n.index("at").getAllKeys();o.onsuccess=()=>{const a=o.result;for(const r of a.slice(0,Math.max(0,a.length-Ir)))n.delete(r)},i.oncomplete=()=>e(),i.onerror=()=>e(),i.onabort=()=>e()})}catch{}finally{t.close()}}let ct,$r=0;const Gt=new Map;function Fr(){if(ct!==void 0)return ct;try{ct=typeof Worker>"u"?null:new Worker(new URL(""+new URL("ao-volume.worker-BzTe3uRf.js",import.meta.url).href,import.meta.url),{type:"module"}),ct&&(ct.onmessage=s=>{const t=Gt.get(s.data.id);t&&(Gt.delete(s.data.id),s.data.error?t.reject(new Error(s.data.error)):t.resolve(s.data.volume??null))},ct.onerror=s=>{s.preventDefault(),ct?.terminate(),ct=null;for(const t of Gt.values())t.reject(new Error("ao worker failed"));Gt.clear()})}catch{ct=null}return ct}const Or=()=>new Promise(s=>setTimeout(s,0));async function Nr(s,t,e=!0){if(e){const o=await Cr(t);if(o)return{volume:o,source:"cache"}}const i=Fr();if(i)try{const o=++$r,a=await new Promise((r,l)=>{Gt.set(o,{resolve:r,reject:l}),i.postMessage({id:o,input:s})});return a&&e&&oi(a),{volume:a,source:"worker"}}catch{}const n=await Oa(s,{yieldSlice:Or,now:()=>performance.now()});return n&&e&&oi(n),{volume:n,source:"main"}}const Br=350,mo=650,Ur=.06,qr=.6,Ce=3e3,ni=45,ie=8,ts=2048,ai={objectShadows:!0,lambertObjects:!1,shadowMapPx:ts,occlusion:!0},ri={objectShadows:!1,lambertObjects:!0,shadowMapPx:1024,occlusion:!0},li=.28,Gr=180,Wr=.4,jr=8,Hr=64,Kr=6,Xr=.35,Vr=.88,hi=8,Ut=Math.PI/2-.02,Yr=new Set(["glow","cone","tint"]),Zr=new Set(["wall","lintel","sill","head","door","object","connector","camera"]),Qr=new Set(["floor","wall","object","connector","room","tint","lintel","sill","head"]),Jr=new Set(["wall","lintel","sill","head","door","connector"]),es=new Set(["chip","entity"]),tl=new Set(["wall","object","connector"]),el=.5,oe=(()=>{const s=Math.hypot(-.6,1.1,-.25);return[-.6/s,1.1/s,-.25/s]})(),sl="map-wall-3d",ci="map-structure",di=.025,ui=16777215,pi=15133682,fi=2.1,mi=16774108,wi=3,il=1.12,gi=2767974,vi=857124,bi=.75,ne=12570879,yi=.55,ol=.9,ki=2.6,xi=9347276,nl=10334952,al=.55,rl=.35,$e=[.55,.45,.7],ll=160,hl=100,K=s=>s*Math.PI/180,cl=new C,Mi=s=>[s.x0,s.x1,s.z0,s.z1,s.y0,s.y1].map(t=>t.toFixed(2)).join(",");function Si(s){const t=new tt(nl,s);return t.name="night-fill",t.position.set($e[0]*10,$e[1]*10,$e[2]*10),t}function Fe(s){const t=new C(s.dir[0],Math.max(s.dir[1],-.2),s.dir[2]).normalize();return[t.x,t.y,t.z]}const Ai=s=>s.kind==="object"&&Math.max(s.size[0],s.size[1],s.size[2])<qr,Oe=s=>s.kind==="floor"?"floor":s.color==="map-glass"?"glass":s.kind==="object"?"object":"std",Ht=(s,t)=>s.length===t.length&&s.every((e,i)=>e===t[i]),dl=(s,t)=>{if(!s||!t)return s===t;if(s.length!==t.length)return!1;for(let e=0;e<s.length;e++)if(s[e][0]!==t[e][0]||s[e][1]!==t[e][1])return!1;return!0},ul=(s,t)=>s.id===t.id&&s.kind===t.kind&&s.shape===t.shape&&s.color===t.color&&s.group===t.group&&s.level_id===t.level_id&&s.text===t.text&&Ht(s.position,t.position)&&Ht(s.size,t.size)&&Ht(s.rotation,t.rotation)&&dl(s.polygon,t.polygon)&&(s.opacity===t.opacity||s.kind==="tint"),pl=(s,t)=>s.text===t.text&&s.color===t.color&&s.opacity===t.opacity&&Ht(s.position,t.position)&&Ht(s.size,t.size)&&s.userData.id===t.userData.id&&s.userData.kind===t.userData.kind;function fl(s,t){if(s===t||s.parts.length!==t.parts.length||s.levels.length!==t.levels.length||s.size[0]!==t.size[0]||s.size[1]!==t.size[1])return!1;for(let n=0;n<s.levels.length;n++){const o=s.levels[n],a=t.levels[n];if(o.id!==a.id||o.elevation_m!==a.elevation_m||o.ceiling_height_m!==a.ceiling_height_m)return!1}let e=!1,i=!1;for(let n=0;n<s.parts.length;n++){const o=s.parts[n],a=t.parts[n];if(es.has(o.kind)&&o.kind===a.kind&&o.id===a.id&&o.level_id===a.level_id&&o.shape===a.shape){pl(o,a)||(e=i=!0);continue}if(!ul(o,a))return!1;o.opacity!==a.opacity&&(e=!0)}return i&&(s.real||t.real)&&JSON.stringify(s.real??null)!==JSON.stringify(t.real??null)?!1:e}function ml(){const s=[-.5,.5],t=[];for(const i of s)for(const n of s)t.push(-.5,i,n,.5,i,n),t.push(i,-.5,n,i,.5,n),t.push(i,n,-.5,i,n,.5);const e=new ht;return e.setAttribute("position",new mt(t,3)),e}function wl(){const t=document.createElement("canvas");t.width=64,t.height=64;const e=t.getContext("2d");if(e){const n=e.createImageData(64,64);for(let o=0;o<64;o++)for(let a=0;a<64;a++){const r=Math.abs((a+.5)/64-.5)*2,l=Math.abs((o+.5)/64-.5)*2,h=Math.max(r,l),c=Math.min(1,Math.max(0,(h-.5)/.5)),d=(1-c*c*(3-2*c))*.42,u=(o*64+a)*4;n.data[u+3]=Math.round(d*255)}e.putImageData(n,0,0)}const i=new Me(t);return i.colorSpace=Kt,i}function gl(s,t){const e=[];for(const r of s){const l=e[e.length-1];(!l||Math.hypot(r[0]-l[0],r[1]-l[1])>1e-6)&&e.push(r)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let i=0;for(let r=0;r<e.length;r++){const l=e[r],h=e[(r+1)%e.length];i+=l[0]*h[1]-h[0]*l[1]}if(Math.abs(i)<1e-8)return null;const n=ds.triangulateShape(e.map(([r,l])=>new yt(r,l)),[]),o=[];for(const[r,l,h]of n){const[c,d,u]=[e[r],e[l],e[h]];Math.abs((d[0]-c[0])*(u[1]-c[1])-(u[0]-c[0])*(d[1]-c[1]))<1e-10||(o.push(c[0],t,c[1],d[0],t,d[1],u[0],t,u[1]),o.push(c[0],0,c[1],u[0],0,u[1],d[0],0,d[1]))}for(let r=0;r<e.length;r++){const l=e[r],h=e[(r+1)%e.length];o.push(l[0],0,l[1],h[0],0,h[1],h[0],t,h[1],l[0],0,l[1],h[0],t,h[1],l[0],t,l[1])}const a=new ht;return a.setAttribute("position",new mt(o,3)),a.computeVertexNormals(),a}class ws{constructor(t){this.opts=t,this.scene=new He,this.persp=new Wo(50,1,.05,2e3),this.ortho=new Ms(-1,1,1,-1,.05,4e3),this.active=this.persp,this.root=new ut,this.unitBox=new Xt(1,1,1),this.unitCylinder=new Se(.5,.5,1,24),this.unitPlane=new ye(1,1).rotateX(-Math.PI/2),this.boxEdges=ml(),this.materials=new Map,this.aoMaterial=null,this.raycaster=new jo,this.glowPool=[],this.lights=new ut,this.sun=null,this.lookup=new Map,this.placed=new Map,this.tints=new Map,this.cones=[],this.cutPlanes=null,this.builds=0,this.smallGroups=[],this.outline=null,this.desc=null,this.extent=null,this.selectedId=null,this.preset="iso",this.orthoFrame=null,this.frameInsetsPx={..._s},this.userCamera=!1,this.cutAzimuth=null,this.cutNow=new Set,this.caps=null,this.night=!1,this.framed=!1,this.hideSmall=!1,this.heavy=!1,this.heavyOverride=null,this.disposed=!1,this.continuous=!1,this.paused=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.walking=null,this.realMats=null,this.realModels=null,this.realBuilt=null,this.exterior=null,this.post=null,this.postRung=null,this.postLoading=!1,this.pmrem=null,this.envTarget=null,this.envElevation=null,this.sunInput={utcMs:Date.now(),latitude:Ls.latitude,longitude:Ls.longitude},this.sunPos=null,this.recipe=Rs(45),this.rig=null,this.clipPlane=new Ho(new C(0,-1,0),0),this.poolKey="",this.glowCarry=null,this.aoUniforms=Ba(),this.aoKey=null,this.aoPending=0,this.aoEnabled=!0,this.aoLast=null,this.interior=null,this.anims=[],this.motion=!0,this.lastFrameInfo={calls:0,triangles:0},this.mergeFurniture=!0,this.restoredCount=0,this.onUserCamera=()=>{this.userCamera=!0},this.fittedKey="",this.onRestored=()=>{this.restoredCount++,this.markShadows(),!this.disposed&&this.quality===3&&(this.post?.dispose(),this.post=null,this.postRung=null,this.envTarget?.dispose(),this.envTarget=null,this.pmrem?.dispose(),this.pmrem=null,this.envElevation=null,this.ensurePost(),this.applyTime()),this.invalidate()},this.realDprCap=On,this.realRebuildTimer=0,this.builtModels=0,this.zoomGen=0,this.projSize=new yt,this.projV=new C,this.lastHitPoint=new C,this.onDown=i=>{i.isPrimary&&(this.pressed={x:i.clientX,y:i.clientY,id:i.pointerId})},this.onUp=i=>{const n=this.pressed;!n||i.pointerId!==n.id||(this.pressed=null,!(i.button!==0||Math.hypot(i.clientX-n.x,i.clientY-n.y)>Kr)&&this.opts.onSelect(this.pick(i.clientX,i.clientY),i.clientX,i.clientY))},this.onCancel=i=>{this.pressed?.id===i.pointerId&&(this.pressed=null)},this.onMove=i=>{if(this.pressed||i.pointerType==="touch"||!i.isPrimary)return;const n=this.pick(i.clientX,i.clientY),o=n?n.partId:null;if(o===this.lastHover)return;this.lastHover=o;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(n,i.clientX-a.left,i.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||this.paused||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const i=this.walking?this.stepFly():this.controls.update(),n=this.stepAnims(),o=this.stepInterior(),a=this.realBuilt?.glow?.tick(performance.now(),this.motion)??!1,r=i||n||o||a;if(this.hideSmall){const c=this.walking?!0:this.active===this.ortho?this.ortho.top/(this.ortho.zoom||1)<ni/2:this.persp.position.distanceTo(this.controls.target)<ni;for(const d of this.smallGroups)d.visible!==c&&(d.visible=c,this.markShadows())}this.updateCutaway(),this.drawFrame(),this.opts.onDraw?.(),this.frames++;const l=performance.now();this.windowStart||(this.windowStart=l),this.windowFrames++,l-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(l-this.windowStart)),this.windowStart=l,this.windowFrames=0);const h=r||this.continuous;(!h||l-this.lastReport>=1e3)&&(this.lastReport=l,this.opts.onFrame(this.frames,this.fps)),h?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.interiorAt=0,this.quality=t.quality??1,this.night=!!t.night,this.real={...ar,...t.real??{}},typeof t.dprCap=="number"&&Number.isFinite(t.dprCap)&&t.dprCap>0&&(this.realDprCap=t.dprCap),this.renderer=new Ko({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.basePixelRatio=t.pixelRatio??Math.min(2,window.devicePixelRatio||1),this.renderer.setPixelRatio(this.basePixelRatio),this.renderer.outputColorSpace=Kt,this.renderer.shadowMap.type=Ss,this.outlineMaterial=new Zi({color:new Q(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new Xo(this.persp,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=Ut,this.controls.addEventListener("change",this.invalidate),this.controls.addEventListener("start",this.onUserCamera),this.scene.add(this.lights),this.applyQuality();for(let i=0;i<ie;i++)this.glowPool.push(new Vo(16777215,0,1,2));this.syncGlowPool(),this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.onRestored),this.resize()}get camera(){return this.active}getQuality(){return this.quality}config(){return this.heavyOverride??(this.heavy?ri:ai)}heavyConfig(){return{heavy:this.heavy,...this.config()}}setHeavyConfig(t){this.heavyOverride=t?{...this.heavy?ri:ai,...t}:null;for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.desc=null,this.setDescription(e),this.setSelected(i)}this.invalidate()}rendererInfo(){const t=this.renderer.getContext(),e=t.getExtension("WEBGL_debug_renderer_info");return{vendor:String(e?t.getParameter(e.UNMASKED_VENDOR_WEBGL):t.getParameter(t.VENDOR)),renderer:String(e?t.getParameter(e.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER))}}benchFrames(t=60){const e=this.renderer.getContext(),i=new Uint8Array(4);this.controls.update(),this.updateCutaway();const n=()=>{this.drawFrame(),e.readPixels(0,0,1,1,e.RGBA,e.UNSIGNED_BYTE,i)};n();const o=performance.now();for(let a=0;a<t;a++)n();return(performance.now()-o)/t}setNight(t){if(t!==this.night){this.night=t,this.applyQuality();for(const e of this.glowPool)e.intensity>0&&(e.intensity=hi*(t?ki:1));this.invalidate()}}getNight(){return this.night}setQuality(t){if(t!==this.quality){this.quality=t,this.applyQuality(),this.syncGlowPool();for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.setDescription(e),this.setSelected(i)}this.invalidate()}}applyQuality(){for(const e of[...this.lights.children])this.lights.remove(e),(e instanceof tt||e instanceof Ot||e instanceof St)&&e.dispose();this.sun=null,this.rig=null,this.cutAzimuth=null,this.cutNow.clear();const t=this.night;if(this.renderer.localClippingEnabled=this.quality===3,this.renderer.shadowMap.autoUpdate=!1,this.renderer.shadowMap.needsUpdate=!0,this.renderer.shadowMap.type=this.quality===3?Yo:Ss,this.applyPixelRatio(),this.scene.environment=null,this.scene.fog=null,this.quality===3){this.applyRealRig();return}if(this.quality===2){this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=Zo,this.renderer.toneMappingExposure=t?ol:il,this.lights.add(t?new St(gi,vi,bi):new St(ui,pi,fi));const e=t?new tt(ne,yi):new tt(mi,wi);e.castShadow=!0,e.shadow.mapSize.set(ts,ts),e.shadow.bias=-4e-4,e.shadow.normalBias=.03,this.lights.add(e),this.lights.add(e.target),this.sun=e,this.fitSun(),t&&this.lights.add(Si(al))}else{this.renderer.shadowMap.enabled=!1,this.renderer.toneMapping=Qo,this.renderer.toneMappingExposure=1,this.lights.add(t?new Ot(xi,.7):new Ot(16777215,1.6));const e=t?new tt(ne,.5):new tt(16777215,1.4);e.position.set(1,2,1.2),this.lights.add(e),t&&this.lights.add(Si(rl))}}applyPixelRatio(){const t=this.quality===3?this.real.rung:this.quality===2?"full":"schematic",e=Nn(t,this.basePixelRatio,this.realDprCap);this.renderer.getPixelRatio()!==e&&this.renderer.setPixelRatio(e),this.quality===3&&this.post?.setPixelRatio(e)}fitSun(){const t=this.sun,e=this.extent;if(!t||!e)return;const i=(e.x0+e.x1)/2,n=(e.y0+e.y1)/2,o=(e.z0+e.z1)/2,a=Math.max(Math.hypot(e.x1-e.x0,e.y1-e.y0,e.z1-e.z0)/2,2)*1.05+(this.quality===3?4:0),r=this.quality===3&&this.sunPos?Fe(this.sunPos):oe;t.position.set(i+r[0]*a*2,n+r[1]*a*2,o+r[2]*a*2),t.target.position.set(i,n,o),t.target.updateMatrixWorld();const l=this.quality===3?this.real.rung==="realistic"&&!this.heavy?2048:1024:this.config().shadowMapPx;t.shadow.mapSize.x!==l&&(t.shadow.mapSize.set(l,l),t.shadow.map?.dispose(),t.shadow.map=null),this.quality===3&&this.real.rung==="realistic"&&(t.shadow.radius=Dn(a,l,W[this.real.style].rig.shadowRadius));const h=t.shadow.camera;h.left=-a,h.right=a,h.top=a,h.bottom=-a,h.near=.1,h.far=a*4,h.updateProjectionMatrix(),t.shadow.needsUpdate=!0,this.markShadows()}markShadows(){this.renderer.shadowMap.needsUpdate=!0}syncGlowPool(){const t=an(this.quality,this.glowPool.some(e=>e.intensity>0));for(const e of this.glowPool)t&&e.parent!==this.scene?this.scene.add(e):!t&&e.parent&&e.removeFromParent()}get glowLightsInScene(){return this.glowPool.filter(t=>t.parent===this.scene).length}refit(){this.opts.fit!=="content"||this.userCamera||this.walking||typeof this.preset!="string"||!this.desc||this.setPreset(this.preset)}frameInsetFractions(){const t=this.opts.mount;return Ps(this.frameInsetsPx,t.clientWidth||1,t.clientHeight||1)}setFrameInsets(t){const e=this.frameInsetsPx;e.top===t.top&&e.right===t.right&&e.bottom===t.bottom&&e.left===t.left||(this.frameInsetsPx={...t},this.refit())}applyRealRig(){const t=W[this.real.style].rig;this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=Jo;const e=new St(16777215,4478310,1),i=new tt(16777215,3);i.castShadow=!0,i.shadow.bias=-4e-4,i.shadow.normalBias=.025,i.shadow.blurSamples=12,i.shadow.radius=this.real.rung==="realistic"?t.shadowRadius:3;const n=new tt(12570879,0),o=new tt(8177919,0);this.lights.add(e,i,i.target,n,o),this.sun=i,this.rig={hemi:e,sun:i,moon:n,rim:o},this.fitSun(),this.applyTime()}applyTime(){if(this.quality!==3||!this.rig)return;const e=W[this.real.style].rig,i=this.desc?.real?.north_deg??0,n=Ln(this.sunInput.utcMs,this.sunInput.latitude,this.sunInput.longitude,i);this.sunPos=n;const o=Rs(n.elevation);this.recipe=o;const{hemi:a,sun:r,moon:l,rim:h}=this.rig,c=this.interior?(e.interiorFill[0]+(e.interiorFill[1]-e.interiorFill[0])*this.interior.value)*.7:1;r.intensity=o.sunIntensity*.55*e.sunScale,r.color.setRGB(o.sunColor[0],o.sunColor[1],o.sunColor[2]),r.visible=n.elevation>-3,r.castShadow=n.elevation>-3,a.color.setRGB(o.hemiSky[0],o.hemiSky[1],o.hemiSky[2]),a.groundColor.setRGB(o.hemiGround[0],o.hemiGround[1],o.hemiGround[2]),a.intensity=o.hemiIntensity*e.hemiScale*c,l.intensity=o.moon*e.moonScale;const d=this.extent,u=d?new C((d.x0+d.x1)/2,0,(d.z0+d.z1)/2):new C,p=d?Math.hypot(d.x1-d.x0,d.z1-d.z0)+10:20;if(l.position.copy(u).add(new C(-p,p*.9,p*.4)),l.target=r.target,e.rim){const m=Fe(n);h.color.setHex(e.rim.color),h.intensity=e.rim.intensity*(this.walking?.6:1),h.position.copy(u).addScaledVector(new C(-m[0],.5,-m[2]).normalize(),p),h.target=r.target}else h.intensity=0;if(this.renderer.toneMappingExposure=o.exposure*(e.exposureDay+(e.exposureNight-e.exposureDay)*o.night)*(this.walking?1.05:1),this.fitSun(),this.scene.environmentIntensity=(e.envNight+(e.envDay-e.envNight)*o.day)*c,this.walking){const m=e.fog,w=new Q(m.color).multiplyScalar(1-o.night*.6);this.real.backdrop==="studio"&&w.set(Je(o,this.real.style,"studio")[2]),this.scene.fog=new tn(w.getHex(),m.density)}else this.scene.fog=null;if(this.exterior){Dr(this.exterior,o,Fe(n),this.real.style),zr(this.exterior,this.real.backdrop??"sky",!!this.walking,o,this.real.style);const m=Math.round(n.elevation)*1e3+Math.round(n.azimuth/5);if(m!==this.envElevation){this.envElevation=m,this.pmrem??=new en(this.renderer);const w=this.pmrem.fromScene(this.exterior.domeScene,0,1,1e3);this.envTarget?.dispose(),this.envTarget=w}this.scene.environment=this.envTarget?.texture??null}this.applyLamps(),this.realBuilt?.glow?.setLook(this.real.style,o.night),this.post?.setLook(this.real.style,o.night),this.renderer.shadowMap.needsUpdate=!0,this.invalidate()}applyLamps(){if(this.quality!==3)return;const t=this.desc?.real,e=W[this.real.style].rig,i=this.recipe.night,n=(t?.lamps??[]).map(l=>({...l}));for(const l of this.desc?.parts??[])l.kind==="glow"&&l.userData.kind==="entity"&&n.push({id:l.id,owner:l.id,level_id:l.level_id??"",position:l.position,kind:"ceiling",color_k:3e3,lumens:800,on:!0});for(const[l,h]of this.realBuilt?.bulbs??[]){const c=n.find(d=>d.id===`lamp:${l}`);c?.on?(h.emissive.copy(si(c.color_k)),h.emissiveIntensity=e.lampEmissiveDay+(e.lampEmissiveNight-e.lampEmissiveDay)*i):h.emissiveIntensity=0}const o=this.active.position,a=Is(n,[o.x,o.y,o.z],ie);this.poolKey=a.map(l=>l.id).join(",");const r=e.lampPoolDay+(e.lampPoolNight-e.lampPoolDay)*i;this.glowPool.forEach((l,h)=>{const c=a[h];if(!c){l.intensity=0;return}const d=c.kind==="floor"?6:c.kind==="wall"?5:11;l.color.copy(si(c.color_k)),l.intensity=d*r*Math.min(2,Math.max(.4,Math.sqrt(c.lumens/1200))),l.distance=0,l.decay=2;const u=c.kind==="floor"||c.kind==="wall"?.05:c.kind==="pendant"?.25:.45;l.position.set(c.position[0],c.position[1]-u,c.position[2])})}applyCut(){if(this.quality!==3||!this.realMats)return;const t=this.desc,e=t&&t.levels.length?[...t.levels].sort((a,r)=>r.elevation_m-a.elevation_m||(a.id<r.id?-1:1))[0]:null,i=!!e&&this.real.sectionCut&&!this.walking&&typeof this.preset=="string",n=e?e.elevation_m+e.ceiling_height_m*.6:0;this.clipPlane.constant=n,this.realMats.setClip(i?[this.clipPlane]:null);for(const a of this.cones)Array.isArray(a.material)||(a.material.clippingPlanes=i?[this.clipPlane]:null);this.cutPlanes=i?[this.clipPlane]:null,this.post?.setClip(this.cutPlanes),this.realBuilt?.glow?.setClip(this.cutPlanes);const o=this.realBuilt?.caps;if(o)for(const a of o.children)a.visible=i&&a.userData.level===e.id&&(!a.userData.edge||W[this.real.style].cut.edge!==null);this.renderer.shadowMap.needsUpdate=!0}setRealSettings(t){const e=this.real,{dprCap:i,motion:n,...o}=t;typeof n=="boolean"&&(this.motion=n);const a=typeof i=="number"&&Number.isFinite(i)&&i>0&&i!==this.realDprCap;if(a&&(this.realDprCap=i),this.real={...this.real,...o},this.quality!==3)return;const r=e.rung!==this.real.rung||e.furniture!==this.real.furniture||e.textures!==this.real.textures||e.floorFinish!==this.real.floorFinish;if(e.style!==this.real.style){this.realMats?.setStyle(this.real.style);const l=W[this.real.style];this.exterior&&(this.exterior.band.material.color.setHex(l.horizon.color),this.exterior.contact.material.opacity=l.ground.contact);for(const h of this.realBuilt?.caps?.children??[]){const c=h.material;h.userData.edge?c.color.setHex(l.cut.edge??l.cut.cap):c.color.setHex(l.cut.cap)}this.envElevation=null,this.recolour(),r||this.applyTime()}else e.backdrop!==this.real.backdrop&&!r&&this.applyTime();this.post?.setReflections(this.real.reflections!==!1),r?(this.realMats?.setRung(this.real.rung),this.realMats?.setSource(this.real.textures),this.applyQuality(),this.rebuildNow()):(this.applyCut(),a&&this.applyPixelRatio()),this.invalidate()}getRealSettings(){return{...this.real}}setSun(t){this.sunInput={...this.sunInput,...t},this.applyTime()}sunState(){return this.sunPos?{elevation:this.sunPos.elevation,azimuth:this.sunPos.azimuth,night:this.recipe.night,day:this.recipe.day}:null}skyBackdrop(){return Je(this.recipe,this.real.style,this.real.backdrop??"sky")}setInterior(t){t===null?this.interior=null:this.interior={target:t,value:this.interior?.value??t},this.applyTime()}get realPending(){return(this.realMats?.pending??0)+(this.realModels?.pending??0)+(this.postLoading?1:0)+this.aoPending}get postPasses(){return this.post?.passes??[]}get floorReflections(){return this.post?.reflections??!1}get postClip(){return this.post?.clip?.map(t=>Math.round(t.constant*1e3)/1e3)??null}get realStats(){return this.realBuilt?.stats??null}requestBakedAo(t){const e=Ca(t),i=ao(e);if(i===this.aoKey)return;this.aoKey=i,Hs(this.aoUniforms,null),this.post?.setBakedAo(!1),this.aoPending++;const n=performance.now();Nr(e,i).then(({volume:o,source:a})=>{this.disposed||this.aoKey!==i||(this.setVolume(o),this.aoLast=o?{key:i,source:a,ms:Math.round(performance.now()-n),dims:[...o.plan.dims],bytes:o.data.length,bakeMs:o.stats.ms}:null)}).catch(o=>console.warn("sw-plan-3d: baked AO failed, drawing without it",o)).finally(()=>{this.aoPending--,!this.disposed&&(this.opts.onAsset?.(),this.invalidate())})}setVolume(t){Hs(this.aoUniforms,t),this.aoEnabled||(this.aoUniforms.swAoStrength.value=0),this.post?.setBakedAo(!!t&&this.aoEnabled)}setBakedAo(t){this.aoEnabled=t;const e=this.aoLast!==null&&this.aoUniforms.swAoVol.value.image.width>1;this.aoUniforms.swAoStrength.value=t&&e?Ae.strength:0,this.post?.setBakedAo(t&&e),this.invalidate()}get bakedAo(){return this.aoLast?{...this.aoLast,strength:this.aoUniforms.swAoStrength.value,gtao:this.post?.gtaoState??null}:null}get postGrade(){return this.post?.grade??null}get realRoughness(){return this.realMats?.roughnessOf()??{}}ensurePost(){if(this.quality!==3||this.postLoading||this.post&&this.postRung===this.real.rung)return;this.post?.dispose(),this.post=null,this.postLoading=!0;const t=this.real.rung;Po(async()=>{const{PostChain:e}=await import("./post-chain-CX0cNCaj.js");return{PostChain:e}},__vite__mapDeps([0]),import.meta.url).then(({PostChain:e})=>{if(this.disposed||this.quality!==3||this.real.rung!==t)return;const i=this.opts.mount.clientWidth||1,n=this.opts.mount.clientHeight||1;this.post=new e(this.renderer,this.scene,this.active,t,i,n,this.real.style),this.post.setLook(this.real.style,this.recipe.night),this.post.setClip(this.cutPlanes),this.post.setBakedAo(this.aoEnabled&&this.aoUniforms.swAoStrength.value>0),this.post.setReflections(this.real.reflections!==!1),this.postRung=t}).catch(e=>console.warn("sw-plan-3d: post chain failed to load, drawing without it",e)).finally(()=>{this.postLoading=!1,this.opts.onAsset?.(),this.invalidate()})}rebuildNow(){if(!this.desc)return;const t=this.desc,e=this.selectedId;this.desc=null,this.setDescription(t),this.setSelected(e)}stateOf(t){return this.quality!==3?null:t==="danger"?"open_door":t==="map-presence"?"presence":null}material(t,e,i=!1,n="std"){const o=this.quality>=2&&n==="object"&&this.config().lambertObjects,a=this.stateOf(t),r=`${t}|${e}|${i?2:1}|${this.quality>=2?o?"object-lambert":n:"l1"}${a?`|s3:${this.real.style}`:""}`;let l=this.materials.get(r);if(!l){const h=i?{side:It,forceSinglePass:!0}:{},c=this.quality>=2&&t===ci&&n==="std"?sl:t,d=a?new Q(W[this.real.style].states[a]):new Q(this.opts.color(c));let u;this.quality>=2&&n==="glass"?u=new Dt({color:d,roughness:.12,metalness:.25,transparent:!0,opacity:Math.max(e,.35),depthWrite:!1,side:It,forceSinglePass:!0}):a==="open_door"?u=new Dt({color:d,emissive:d,emissiveIntensity:.9,roughness:.6,metalness:0,...h}):this.quality>=2&&!o?u=new Dt({color:d,roughness:n==="floor"?1:.88,metalness:0,transparent:e<1,opacity:e,depthWrite:e>=1,...h}):u=new sn({color:d,transparent:e<1,opacity:e,depthWrite:e>=1,...h}),l={token:c,material:u,state:a},this.materials.set(r,l)}return l.material}recolour(){for(const{token:t,material:e,state:i}of this.materials.values())i?(e.color.set(W[this.real.style].states[i]),"emissive"in e&&e.emissiveIntensity>0&&e.emissive.copy(e.color)):e.color.set(this.opts.color(t));for(const t of this.tints.values()){const e=t.userData.state;e&&!Array.isArray(t.material)&&t.material.color.set(W[this.real.style].states[e])}this.outlineMaterial.color.set(this.opts.color("accent"))}statePart(t){return t.kind!=="tint"?t:t.id.endsWith("#lit")||t.id.endsWith("#presence-ring")||t.id.endsWith("#presence")?null:t}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new rt(K(e.rotation[0]),K(e.rotation[1]),K(e.rotation[2]),"YXZ"))}plateOpacity(t,e=this.desc){const i=e?.levels??[];if(t.kind!=="floor"||i.length<2)return t.opacity;const n=Math.min(...i.map(a=>a.elevation_m)),o=i.find(a=>a.id===t.level_id);return o&&o.elevation_m>n?Math.min(t.opacity,Xr):t.opacity}shadows(t,e){if(this.quality<2)return;const i=this.config().objectShadows;t.castShadow=(i?Zr:Jr).has(e.kind)&&e.color!=="map-glass",t.receiveShadow=Qr.has(e.kind)&&(i||e.kind!=="object")}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const i=e.getContext("2d");i&&(i.globalAlpha=Vr,i.fillStyle=this.opts.color("surface"),i.beginPath(),i.roundRect(8,16,496,96,48),i.fill(),i.globalAlpha=1,i.fillStyle=this.opts.color(t.color),i.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',i.textAlign="center",i.textBaseline="middle",i.direction="rtl",i.fillText(t.text??"",256,66,480));const n=new Me(e);n.colorSpace=Kt;const o=new As(new on({map:n,transparent:!0,depthTest:!0}));return o.position.set(t.position[0],t.position[1],t.position[2]),o.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),o}single(t,e){if(t.shape==="box"||t.shape==="cylinder"){const i=new U(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t,e),!1,Oe(t)));return this.transform(i,t),i.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),this.shadows(i,t),i}if(t.shape==="prism"){const i=gl(t.polygon??[],t.size[1]);if(!i)return null;const n=this.material(t.color,t.opacity,!0,Oe(t)),o=t.kind==="tint"||t.kind==="cone"?n.clone():n,a=new U(i,o);return t.kind==="tint"?(a.userData.ownMaterial=!0,a.userData.state=this.stateOf(t.color)):t.kind==="cone"&&(a.userData.ownMaterial=!0,a.userData.cone=!0),a.position.set(t.position[0],t.position[1],t.position[2]),this.shadows(a,t),a}return es.has(t.kind)||t.kind==="label"&&this.opts.fit==="content"?null:t.shape==="sprite"?this.label(t):null}occlusion(t,e){if(this.quality!==2||!this.config().occlusion)return null;const i=new Map(e.levels.map(u=>[u.id,u.elevation_m])),n=e.levels.length?Math.min(...e.levels.map(u=>u.elevation_m)):0,o=t.filter(u=>tl.has(u.kind)&&(u.shape==="box"||u.shape==="cylinder")&&u.position[1]-u.size[1]/2<=(i.get(u.level_id??"")??n)+el);if(!o.length)return null;this.aoMaterial||(this.aoMaterial=new pt({map:wl(),color:0,transparent:!0,depthWrite:!1}));const a=new gt(this.unitPlane,this.aoMaterial,o.length),r=new ot,l=new vt,h=new rt,c=new C,d=new C;return o.forEach((u,p)=>{l.setFromEuler(h.set(0,K(u.rotation[1]),0,"YXZ")),c.set(u.position[0],u.position[1]-u.size[1]/2+.012,u.position[2]),d.set(u.size[0]+2*li,1,u.size[2]+2*li),r.compose(c,l,d),a.setMatrixAt(p,r)}),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),a.name="ao",a.renderOrder=1,a}realise(t,e,i=!1){const n={root:new ut,lookup:new Map,small:[],placed:new Map,glows:[],ao:null,real:null},o=new Map,a=[];if(this.quality===3&&!i&&e.real){this.realMats??=new dr(this.opts.assetBase??ii(),()=>this.onRealAsset()),this.realMats.ao=this.aoUniforms,this.realModels??=new pr(this.opts.assetBase??ii(),()=>this.onRealAsset()),this.realMats.setStyle(this.real.style),this.realMats.setRung(this.real.rung),this.realMats.setSource(this.real.textures);const u={night:this.recipe.night,prev:this.motion?this.glowCarry:null,now:performance.now()},p=xr({desc:e,real:e.real,parts:t,settings:this.real,heavy:e.parts.length>Ce,mats:this.realMats,models:this.realModels,glow:u,mergeFurniture:this.mergeFurniture});n.real=p,n.root.add(p.root);for(const[m,w]of p.lookup)n.lookup.set(m,w);t=t.filter(m=>!uo.has(m.kind)).map(m=>this.statePart(m)).filter(m=>m!==null)}for(const u of t)if(u.group&&(u.shape==="box"||u.shape==="cylinder")){const p=o.get(u.group);p?p.push(u):o.set(u.group,[u])}else a.push(u);const r=new ot,l=new vt,h=new C,c=new C,d=new rt;for(const[u,p]of o){const m=p[0],w=new gt(m.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(m.color,m.opacity,!1,Oe(m)),p.length);p.forEach((y,b)=>{l.setFromEuler(d.set(K(y.rotation[0]),K(y.rotation[1]),K(y.rotation[2]),"YXZ")),h.set(y.position[0],y.position[1],y.position[2]),c.set(Math.max(y.size[0],.001),Math.max(y.size[1],.001),Math.max(y.size[2],.001)),r.compose(h,l,c),w.setMatrixAt(b,r),n.placed.set(y.id,{obj:w,index:b,part:y})}),w.instanceMatrix.needsUpdate=!0,w.computeBoundingSphere(),w.name=u,this.shadows(w,m),n.lookup.set(w,p),n.root.add(w),p.every(Ai)&&n.small.push(w)}for(const u of a){if(u.shape==="light"){n.glows.push(u);continue}const p=this.single(u,e);p&&(p.name=u.id,Yr.has(u.kind)||n.lookup.set(p,[u]),p instanceof U&&(u.shape==="box"||u.shape==="cylinder")&&n.placed.set(u.id,{obj:p,index:0,part:u}),n.root.add(p),Ai(u)&&n.small.push(p))}return n.ao=this.occlusion(t,e),n.ao&&n.root.add(n.ao),n}disposeGroup(t){for(const e of[...t.children]){if(t.remove(e),e.name==="real"||e.name==="exterior"){Lr(e);continue}e instanceof gt?e.dispose():e instanceof U&&e.geometry!==this.unitBox&&e.geometry!==this.unitCylinder&&e.geometry.dispose(),e instanceof U&&e.userData.ownMaterial&&!Array.isArray(e.material)&&e.material.dispose(),e instanceof As&&(e.material.map?.dispose(),e.material.dispose())}}clear(){this.setSelected(null),this.disposeGroup(this.root);for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.placed.clear(),this.tints.clear(),this.cones=[],this.smallGroups=[],this.cutAzimuth=null,this.cutNow.clear(),this.caps=null,this.realBuilt=null,this.exterior=null,this.envElevation=null}onRealAsset(){this.invalidate();const t=this.realModels?.version??0;this.quality===3&&t!==this.builtModels&&!this.realRebuildTimer&&(this.realRebuildTimer=window.setTimeout(()=>{this.realRebuildTimer=0,!this.disposed&&this.quality===3&&this.rebuildNow()},30)),this.opts.onAsset?.()}setDescription(t){if(this.desc&&fl(this.desc,t)){for(const o of t.parts){if(o.kind!=="tint")continue;const a=this.quality===3&&t.real?this.statePart(o):o,r=this.tints.get(o.id);a&&r&&!Array.isArray(r.material)&&(r.material.opacity=a.opacity)}this.realBuilt?.glow?.updateWeights(po(t,t.parts)),this.desc=t,this.invalidate();return}const e=new Map;for(const[o,a]of this.realBuilt?.leaves??[])e.set(o,{p:a.position.clone(),q:a.quaternion.clone(),sy:a.scale.y});for(const[o,a]of this.realBuilt?.shutters??[])e.set(o,{p:a.mesh.position.clone(),q:a.mesh.quaternion.clone(),sy:a.mesh.scale.y});this.anims=[],this.glowCarry=this.realBuilt?this.realBuilt.glow?.state()??new Map:null,this.clear(),this.markShadows(),this.recolour(),this.desc=t,this.extent=rn(t),this.heavy=t.parts.length>Ce,this.builds++,this.builtModels=this.realModels?.version??0;const i=this.realise(t.parts,t);if(this.realBuilt=i.real,i.real&&this.requestBakedAo(t),i.real&&this.extent){this.exterior=Pr(this.extent,this.real.style,this.real.rung==="realistic"),this.root.add(this.exterior.root);const o=performance.now(),a=(r,l)=>{const h=e.get(r);if(!h||!this.motion)return;const c={p:l.position.clone(),q:l.quaternion.clone(),sy:l.scale.y};h.p.distanceTo(c.p)<1e-4&&h.q.angleTo(c.q)<1e-4&&Math.abs(h.sy-c.sy)<1e-4||(l.position.copy(h.p),l.quaternion.copy(h.q),l.scale.y=h.sy,l.visible=!0,this.anims.push({obj:l,from:h,to:c,t0:o,ms:Br}))};for(const[r,l]of i.real.leaves)a(r,l);for(const[r,l]of i.real.shutters)a(r,l.mesh)}for(const o of[...i.root.children])this.root.add(o),o instanceof U&&o.userData.cone?this.cones.push(o):o instanceof U&&o.userData.ownMaterial&&this.tints.set(o.name,o);this.lookup=i.lookup,this.placed=i.placed,this.smallGroups=i.small;let n=0;for(const o of i.glows){const a=this.glowPool[n++];a&&(a.color.set(this.opts.color(o.color)),a.intensity=hi*(this.night?ki:1),a.distance=Math.max(o.size[0],1),a.position.set(o.position[0],o.position[1],o.position[2]))}if(this.syncGlowPool(),this.hideSmall=t.parts.length>Ce,!this.hideSmall)for(const o of this.smallGroups)o.visible=!0;this.fitSun(),this.framed?this.opts.fit==="content"&&Mi(Es(t))!==this.fittedKey&&this.refit():this.framed=this.setPreset("iso"),this.updateCutaway(),this.quality===3&&(this.ensurePost(),this.applyCut(),this.applyTime()),this.invalidate()}stepAnims(){if(!this.anims.length)return!1;const t=performance.now();return this.anims=this.anims.filter(e=>{const i=Math.min(1,(t-e.t0)/e.ms),n=i<.5?2*i*i:1-Math.pow(-2*i+2,2)/2;return e.obj.position.lerpVectors(e.from.p,e.to.p,n),e.obj.quaternion.slerpQuaternions(e.from.q,e.to.q,n),e.obj.scale.y=e.from.sy+(e.to.sy-e.from.sy)*n,i>=1&&e.to.sy<=.001&&e.obj.name.startsWith("shutter:")&&(e.obj.visible=!1),i<1}),this.renderer.shadowMap.needsUpdate=!0,this.anims.length>0}setSelected(t){if(this.selectedId=t,this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(o=>o.userData.id===t&&o.kind!=="cone"&&o.kind!=="floor"&&o.kind!=="tint"&&!es.has(o.kind)&&(o.shape==="box"||o.shape==="cylinder"||o.shape==="prism"||o.shape==="sprite")).slice(0,Hr);if(!e.length)return;const i=new ut,n=new Map(this.desc.levels.map(o=>[o.id,o.elevation_m]));for(const o of e){const a=new Yi(this.boxEdges,this.outlineMaterial),r=this.cutNow.has(o.id)?zs(o,n.get(o.level_id??"")??0,Te):{y:o.position[1],h:o.size[1]};if(r){if(o.shape==="prism"){const l=o.polygon??[];if(!l.length)continue;const h=l.map(p=>p[0]),c=l.map(p=>p[1]),d=Math.max(...h)-Math.min(...h),u=Math.max(...c)-Math.min(...c);a.position.set(o.position[0]+(Math.max(...h)+Math.min(...h))/2,o.position[1]+o.size[1]/2,o.position[2]+(Math.max(...c)+Math.min(...c))/2),a.scale.set(d*1.04+.05,o.size[1]*1.04+.05,u*1.04+.05)}else this.transform(a,o),a.position.y=r.y,a.scale.set(o.size[0]*1.06+.05,r.h*1.06+.05,(o.shape==="sprite"?.1:o.size[2])*1.06+.05);a.renderOrder=10,i.add(a)}}this.outline=i,this.root.add(i),this.invalidate()}zoomBy(t){if(this.walking||!(t>0)||t===1)return;this.userCamera=!0;const e=this.extent,i=e?Math.max(4,Math.hypot(e.x1-e.x0,e.z1-e.z0)):20,n=performance.now(),o=this.active,a=o===this.ortho,r=this.ortho.zoom,l=Math.min(jr,Math.max(Wr,r*t)),h=this.persp.position.clone().sub(this.controls.target),c=h.length(),d=Math.min(i*4,Math.max(1.2,c/t)),u=++this.zoomGen,p=()=>{if(u!==this.zoomGen||this.disposed||this.active!==o)return;const m=this.motion?Math.min(1,(performance.now()-n)/Gr):1,w=1-Math.pow(1-m,3);a?(this.ortho.zoom=r+(l-r)*w,this.ortho.updateProjectionMatrix()):this.persp.position.copy(this.controls.target).addScaledVector(h,(c+(d-c)*w)/(c||1)),this.controls.update(),this.invalidate(),m<1&&requestAnimationFrame(p)};p()}useCamera(t){t!==this.active&&(this.active=t,this.controls.object=t)}applyOrthoFrame(){const t=this.orthoFrame;if(!t)return;const e=this.persp.aspect||1;let i=t.halfW,n=t.halfH;i/n<e?i=n*e:n=i/e,this.ortho.left=-i,this.ortho.right=i,this.ortho.top=n,this.ortho.bottom=-n,this.ortho.updateProjectionMatrix()}setPreset(t){const e=this.desc,i=this.extent;if(!e||!i)return!1;if(this.walking)return typeof t!="string"&&!e.parts.some(p=>p.id===t.camera&&p.kind==="camera")?!1:(this.walking.prevPreset=t,!0);const n=(i.x0+i.x1)/2,o=(i.z0+i.z1)/2,a=i.x1-i.x0,r=i.z1-i.z0,l=(p,m)=>Math.max(m,p/(this.persp.aspect||1),4)/(2*Math.tan(K(this.persp.fov/2))),h=Math.max(0,...e.levels.map(p=>p.elevation_m+p.ceiling_height_m)),c=this.opts.fit==="content"&&typeof t=="string"?Es(e):null;c&&(this.fittedKey=Mi(c));const d=this.opts.mount,u=c?Ps(this.frameInsetsPx,d.clientWidth||1,d.clientHeight||1):_s;if(this.zoomGen++,typeof t=="string"&&(this.userCamera=!1),c&&(t==="top"||t==="persp")){this.useCamera(this.persp),this.controls.maxPolarAngle=Ut;const p=ln(c,t==="top"?[0,1,0]:Vt,this.persp.fov,this.persp.aspect||1,u);this.persp.position.set(p.position[0],p.position[1],p.position[2]+(t==="top"?.001:0)),this.controls.target.set(p.target[0],p.target[1],p.target[2])}else if(t==="top")this.useCamera(this.persp),this.controls.maxPolarAngle=Ut,this.persp.position.set(n,h+l(a,r)*1.2,o+.001),this.controls.target.set(n,0,o);else if(t==="iso"){this.useCamera(this.ortho),this.controls.maxPolarAngle=Ut;const p=c?hn(c,this.persp.aspect||1,u):Ts(i,this.persp.aspect||1);this.orthoFrame=p,this.ortho.zoom=1,this.applyOrthoFrame(),this.ortho.position.set(p.target[0]+At[0]*p.dist,p.target[1]+At[1]*p.dist,p.target[2]+At[2]*p.dist),this.controls.target.set(p.target[0],p.target[1],p.target[2])}else if(t==="persp"){this.useCamera(this.persp),this.controls.maxPolarAngle=Ut;const p=Math.hypot(a,r),m=l(p,p*.62)*1.45;this.persp.position.set(n+Vt[0]*m,Vt[1]*m,o+Vt[2]*m),this.controls.target.set(n,0,o)}else{const p=e.parts.find(w=>w.id===t.camera&&w.kind==="camera");if(!p)return!1;this.useCamera(this.persp);const m=new C(0,0,-1).applyEuler(new rt(K(p.rotation[0]),K(p.rotation[1]),K(p.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.persp.position.set(p.position[0],p.position[1],p.position[2]),this.controls.target.set(p.position[0]+m.x*6,p.position[1]+m.y*6,p.position[2]+m.z*6)}return this.preset=t,this.controls.update(),this.updateCutaway(),this.applyCut(),this.invalidate(),!0}walkQuaternion(t){return new vt().setFromEuler(new rt(K(t.pitch_deg),-K(t.heading_deg),0,"YXZ"))}enterWalk(t,e,i=mo){const n=this.active.position.clone(),o=this.active.quaternion.clone();this.walking||(this.walking={prevPreset:this.preset,fov:e,fly:null}),this.walking.fov=e,this.useCamera(this.persp),this.controls.enabled=!1,this.persp.fov=e,this.persp.near=Ur,this.persp.updateProjectionMatrix();const a=new C(t.x,t.y,t.z),r=this.walkQuaternion(t);this.walking.fly=i>0?{from:n,fromQ:o,to:a,toQ:r,t0:performance.now(),ms:i}:null,this.walking.fly||(this.persp.position.copy(a),this.persp.quaternion.copy(r)),this.updateCutaway(),this.applyCut(),this.applyTime(),this.invalidate()}setWalkPose(t){if(!this.walking)return;const e=this.walking.fly;e?(e.to.set(t.x,t.y,t.z),e.toQ.copy(this.walkQuaternion(t))):(this.persp.position.set(t.x,t.y,t.z),this.persp.quaternion.copy(this.walkQuaternion(t))),this.invalidate()}setWalkFov(t){this.walking&&(this.walking.fov=t,this.persp.fov=t,this.persp.updateProjectionMatrix(),this.invalidate())}exitWalk(){const t=this.walking;t&&(this.walking=null,this.controls.enabled=!0,this.persp.fov=50,this.persp.near=.05,this.persp.updateProjectionMatrix(),this.cutAzimuth=Number.NaN,this.interior=null,this.setPreset(t.prevPreset)||this.setPreset("iso"),this.applyTime())}get isWalking(){return this.walking!==null}floorPoint(t,e,i){const n=this.renderer.domElement.getBoundingClientRect();if(!n.width||!n.height)return null;this.active.updateMatrixWorld(),this.raycaster.setFromCamera(new yt((t-n.left)/n.width*2-1,-((e-n.top)/n.height)*2+1),this.active);const{origin:o,direction:a}=this.raycaster.ray;if(Math.abs(a.y)<1e-6)return null;const r=(i-o.y)/a.y;return!(r>0)||r>500?null:[o.x+a.x*r,o.z+a.z*r]}pickCentre(t=1/0){const e=this.renderer.domElement.getBoundingClientRect();return this.pick(e.left+e.width/2,e.top+e.height/2,t)}pickAt(t,e,i=1/0){const n=this.pick(t,e,i);return n?{...n,point:[this.lastHitPoint.x,this.lastHitPoint.y,this.lastHitPoint.z]}:null}projectPoint(t){this.active.updateMatrixWorld();const e=new C(t[0],t[1],t[2]).project(this.active);if(e.z>1)return null;const i=this.opts.mount.clientWidth,n=this.opts.mount.clientHeight;return{x:(e.x+1)/2*i,y:(1-e.y)/2*n}}projectPoints(t){this.active.updateMatrixWorld(),this.renderer.getSize(this.projSize);const e=this.projSize.x,i=this.projSize.y,n=this.projV;return t.map(o=>(n.set(o[0],o[1],o[2]).project(this.active),n.z>1?null:{x:(n.x+1)/2*e,y:(1-n.y)/2*i}))}wantedCutAzimuth(){const t=this.extent;if(this.walking||this.quality!==2||!t||typeof this.preset!="string")return null;const e=this.active.position;if(e.y<=t.y1)return null;const i=this.controls.target;return Math.hypot(e.x-i.x,e.z-i.z)<.5?null:cn(dn(e.x,e.z,i.x,i.z))}writeBox(t,e,i){const n=t.part,o=new vt().setFromEuler(new rt(K(n.rotation[0]),K(n.rotation[1]),K(n.rotation[2]),"YXZ")),a=i<=0,r=new C(n.position[0],e,n.position[2]),l=a?new C(1e-4,1e-4,1e-4):new C(Math.max(n.size[0],.001),Math.max(i,.001),Math.max(n.size[2],.001));t.obj instanceof gt?(t.obj.setMatrixAt(t.index,new ot().compose(r,o,l)),t.obj.instanceMatrix.needsUpdate=!0):(t.obj.position.copy(r),t.obj.scale.copy(l))}updateCutaway(){const t=this.wantedCutAzimuth();if(t===this.cutAzimuth)return;this.cutAzimuth=t;const e=this.desc;if(!e||!this.extent)return;const i=new Set(t===null?[]:un(e,t,this.extent)),n=new Map(e.levels.map(o=>[o.id,o.elevation_m]));for(const o of this.cutNow){if(i.has(o))continue;const a=this.placed.get(o);a&&this.writeBox(a,a.part.position[1],a.part.size[1])}for(const o of i){if(this.cutNow.has(o))continue;const a=this.placed.get(o);if(!a)continue;const r=zs(a.part,n.get(a.part.level_id??"")??0,Te);r?this.writeBox(a,r.y,r.h):this.writeBox(a,(n.get(a.part.level_id??"")??0)-1,0)}this.cutNow=i,this.rebuildCaps(n),this.sun&&(this.sun.shadow.needsUpdate=!0),this.markShadows(),this.selectedId&&this.setSelected(this.selectedId)}rebuildCaps(t){this.caps&&(this.root.remove(this.caps),this.caps.dispose(),this.caps=null);const e=[...this.cutNow].sort().map(r=>this.placed.get(r)).filter(r=>!!r&&r.part.kind==="wall");if(!e.length||this.quality!==2)return;const i=new gt(this.unitBox,this.material(ci,1,!1,"floor"),e.length),n=new ot,o=new vt,a=new rt;e.forEach((r,l)=>{const h=r.part,c=(t.get(h.level_id??"")??0)+Te;o.setFromEuler(a.set(K(h.rotation[0]),K(h.rotation[1]),K(h.rotation[2]),"YXZ")),n.compose(new C(h.position[0],c+di/2-.004,h.position[2]),o,new C(h.size[0]+.004,di,h.size[2]+.004)),i.setMatrixAt(l,n)}),i.instanceMatrix.needsUpdate=!0,i.computeBoundingSphere(),i.name="caps",i.castShadow=!0,this.caps=i,this.root.add(i)}cutawayNow(){return[...this.cutNow].sort()}get buildCount(){return this.builds}pick(t,e,i=1/0){const n=this.renderer.domElement.getBoundingClientRect();if(!n.width||!n.height)return null;this.raycaster.setFromCamera(new yt((t-n.left)/n.width*2-1,-((e-n.top)/n.height)*2+1),this.active);const o=[...this.lookup.keys()].filter(a=>a.visible);for(const a of this.raycaster.intersectObjects(o,!1)){if(a.distance>i)return null;const r=this.lookup.get(a.object);if(!r)continue;const l=a.object.userData.ranges;let h=a.instanceId??0;if(l&&a.instanceId===void 0&&a.faceIndex!==void 0&&a.faceIndex!==null){let d=0,u=l.length-1;for(;d<u;){const p=d+u+1>>1;l[p]<=a.faceIndex?d=p:u=p-1}h=d}const c=r[h];if(c){if(c.kind==="floor"){if(this.plateOpacity(c)<1)continue;return null}return this.lastHitPoint.copy(a.point),{id:c.userData.id,kind:c.userData.kind,partId:c.id}}}return null}setPaused(t){this.disposed||t===this.paused||(this.paused=t,t?(cancelAnimationFrame(this.raf),this.raf=0,this.windowStart=0,this.windowFrames=0):this.invalidate())}get isPaused(){return this.paused}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.post?.setSize(t,e),this.persp.aspect=t/e,this.persp.updateProjectionMatrix(),this.applyOrthoFrame(),this.refit(),this.invalidate()}followSky(){const t=this.exterior;if(!t)return;const e=t.root.userData.home??={dome:t.dome.position.clone(),band:t.band.position.clone(),bandH:t.band.geometry.parameters?.height??7},i=this.real.backdrop==="studio"&&!this.walking,n=i?Lt.discScale:1,o=this.active.position;if(this.active!==this.persp||i){t.dome.position.copy(this.active===this.persp?o:e.dome),t.band.position.copy(e.band),t.band.visible=!i,t.disc.scale.setScalar(n);return}t.dome.position.set(o.x,o.y,o.z);const a=e.band.y-e.bandH/2,r=o.y-a;t.band.visible=r<e.bandH*2.5&&this.real.backdrop!=="studio",t.band.position.set(o.x,e.band.y,o.z);const l=this.persp.getWorldDirection(cl),c=Math.asin(Math.max(-1,Math.min(1,-l.y)))-K(this.persp.fov/2),d=c>.02&&r>0?Math.min(380,r/Math.tan(c)):380,u=t.disc.geometry.parameters?.width??1,p=Math.hypot(o.x-t.disc.position.x,o.z-t.disc.position.z),m=(d+p)/.55/(u/2);t.disc.scale.setScalar(Math.max(n,Math.min(m,800/(u/2))))}drawFrame(){if(this.quality===3){this.followSky();const t=this.active.position,e=this.desc?.real?.lamps??[];e.length>ie&&Is(e,[t.x,t.y,t.z],ie).map(i=>i.id).join(",")!==this.poolKey&&this.applyLamps(),this.renderer.info.reset(),this.renderer.info.autoReset=!1,this.post?(this.post.setCamera(this.active),this.post.draw()):this.renderer.render(this.scene,this.active),this.lastFrameInfo={calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles},this.renderer.info.autoReset=!0;return}this.renderer.render(this.scene,this.active)}stepInterior(){const t=this.interior;if(!t||this.quality!==3)return!1;const e=performance.now(),i=this.interiorAt?Math.min(.1,(e-this.interiorAt)/1e3):.016;if(this.interiorAt=e,Math.abs(t.target-t.value)<.01)return this.interiorAt=0,!1;t.value+=(t.target-t.value)*Math.min(1,i*3);const n=W[this.real.style].rig,o=(n.interiorFill[0]+(n.interiorFill[1]-n.interiorFill[0])*t.value)*.7;return this.rig&&(this.rig.hemi.intensity=this.recipe.hemiIntensity*n.hemiScale*o),this.scene.environmentIntensity=(n.envNight+(n.envDay-n.envNight)*this.recipe.day)*o,!0}stepFly(){const t=this.walking?.fly;if(!t)return!1;const e=Math.min(1,(performance.now()-t.t0)/t.ms),i=e<.5?2*e*e:1-Math.pow(-2*e+2,2)/2;return this.persp.position.lerpVectors(t.from,t.to,i),this.persp.quaternion.slerpQuaternions(t.fromQ,t.toQ,i),e>=1&&this.walking&&(this.walking.fly=null),e<1}redrawNow(){this.disposed||this.paused||(cancelAnimationFrame(this.raf),this.raf=0,this.frame())}capture(){return this.walking||this.controls.update(),this.updateCutaway(),this.drawFrame(),this.renderer.domElement.toDataURL("image/png")}renderThumbnail(t,e,i=ll,n=hl){const o=t.parts.filter(b=>b.level_id===e&&b.kind!=="cone"&&b.shape!=="sprite"&&b.shape!=="light");if(!t.levels.some(b=>b.id===e))return null;const a={...t,levels:t.levels.filter(b=>b.id===e),parts:o},r=this.realise(o,a,!0),l=new He;if(l.add(r.root),this.quality>=2){l.add(this.night?new St(gi,vi,bi):new St(ui,pi,fi));const b=this.night?new tt(ne,yi):new tt(mi,wi);b.position.set(oe[0]*50,oe[1]*50,oe[2]*50),l.add(b)}else{l.add(this.night?new Ot(xi,.7):new Ot(16777215,1.6));const b=this.night?new tt(ne,.5):new tt(16777215,1.4);b.position.set(1,2,1.2),l.add(b)}const h=this.renderer.domElement,c=this.renderer.getPixelRatio(),{w:d,h:u}=pn(i,n,h.width/c,h.height/c);if(d<8||u<8)return this.disposeGroup(r.root),null;const p=Ts(fn(t,e),d/u),m=new Ms(-p.halfW,p.halfW,p.halfH,-p.halfH,.05,4e3);m.position.set(p.target[0]+At[0]*p.dist,p.target[1]+At[1]*p.dist,p.target[2]+At[2]*p.dist),m.lookAt(p.target[0],p.target[1],p.target[2]),m.updateProjectionMatrix();let w=null;const y=this.renderer.shadowMap.enabled;try{this.renderer.shadowMap.enabled=!1,this.renderer.setScissorTest(!0),this.renderer.setScissor(0,0,d,u),this.renderer.setViewport(0,0,d,u),this.renderer.render(l,m);const b=document.createElement("canvas");b.width=d,b.height=u;const P=b.getContext("2d");P&&(P.drawImage(h,0,h.height-u*c,d*c,u*c,0,0,d,u),w=b.toDataURL("image/png"))}catch(b){console.warn("sw-plan-3d: thumbnail failed",b)}finally{this.renderer.setScissorTest(!1),this.renderer.setViewport(0,0,h.width/c,h.height/c),this.renderer.shadowMap.enabled=y,this.disposeGroup(r.root),this.invalidate()}return w}async exportGltf(){const t=new ut;for(const i of this.root.children)i!==this.outline&&t.add(i.clone());return await new nn().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,Ua(this.aoUniforms),cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.onRestored),this.controls.removeEventListener("change",this.invalidate),this.controls.removeEventListener("start",this.onUserCamera),this.controls.dispose(),window.clearTimeout(this.realRebuildTimer),this.clear(),this.post?.dispose(),this.realMats?.dispose(),this.realModels?.dispose(),this.envTarget?.dispose(),this.pmrem?.dispose();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.aoMaterial&&(this.aoMaterial.map?.dispose(),this.aoMaterial.dispose()),this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.unitPlane.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}function vl(s,t,e,i,n){const o=document.createElement("div");o.setAttribute("aria-hidden","true"),o.dataset.skinControl="",o.style.cssText=`position:fixed;left:-1600px;top:0;width:${e}px;height:${i}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(o);let a=null;try{if(a=new ws({mount:o,color:t,onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1}),a.setDescription(s),!a.setPreset("iso"))return null;a.capture();const r=a.renderer.domElement;if(r.width!==e||r.height!==i)return null;const l=document.createElement("canvas");l.width=e,l.height=i;const h=l.getContext("2d");return h?(h.fillStyle=n,h.fillRect(0,0,e,i),h.drawImage(r,0,0),l.toDataURL("image/png")):null}catch(r){return console.warn("sw-plan-3d: control image failed",r),null}finally{a?.dispose(),o.remove()}}const ke=2500,wo=ke+1500,go=1e4,vo=3,ss=3e3;function _i(s,t,e){return new Promise(i=>{let n=!1;const o=setTimeout(()=>{n||(n=!0,i(e))},t);s.then(a=>{n||(n=!0,clearTimeout(o),i(a))},()=>{n||(n=!0,clearTimeout(o),i(e))})})}const ae=1e-6;function Pi(s,t=2,e){const i=new Map,n=s.filter(a=>a.w>0&&a.h>0).slice().sort((a,r)=>r.y-a.y||(a.id<r.id?-1:a.id>r.id?1:0)),o=[];if(e?.size)for(const a of n)e.has(a.id)&&(o.push({l:a.x-a.w/2,r:a.x+a.w/2,t:a.y-a.h,b:a.y}),i.set(a.id,0));for(const a of n){if(i.has(a.id))continue;const r=a.x-a.w/2,l=a.x+a.w/2;let h=a.y;for(let c=0;c<=o.length;c++){const d=o.find(u=>r<u.r-ae&&l>u.l+ae&&h-a.h<u.b+t-ae&&h>u.t-t+ae);if(!d)break;h=d.t-t}o.push({l:r,r:l,t:h-a.h,b:h}),i.set(a.id,Math.round((h-a.y)*100)/100)}for(const a of s)i.has(a.id)||i.set(a.id,0);return i}const X=.25,bl=4e5,yl=.85,kl=.8,re=4,is=(s,t,e)=>Math.min(e,Math.max(t,s)),Ei=s=>Math.round(s*1e4)/1e4+0;function os(s,t,e){let i=!1;for(let n=0,o=e.length-1;n<e.length;o=n++){const[a,r]=e[n],[l,h]=e[o];r>t!=h>t&&s<(l-a)*(t-r)/(h-r)+a&&(i=!i)}return i}function gs(s,t,e){const i=e.b[0]-e.a[0],n=e.b[1]-e.a[1],o=i*i+n*n,a=o>0?is(((s-e.a[0])*i+(t-e.a[1])*n)/o,0,1):0,r=e.a[0]+a*i,l=e.a[1]+a*n;return{d:Math.hypot(s-r,t-l),cx:r,cz:l}}class xl{constructor(){this.f=[],this.k=[]}get size(){return this.k.length}less(t,e){return this.f[t]<this.f[e]||this.f[t]===this.f[e]&&this.k[t]<this.k[e]}swap(t,e){[this.f[t],this.f[e]]=[this.f[e],this.f[t]],[this.k[t],this.k[e]]=[this.k[e],this.k[t]]}push(t,e){this.f.push(t),this.k.push(e);let i=this.k.length-1;for(;i>0;){const n=i-1>>1;if(!this.less(i,n))break;this.swap(i,n),i=n}}pop(){const t=this.k[0],e=this.f.pop(),i=this.k.pop();if(this.k.length){this.f[0]=e,this.k[0]=i;let n=0;for(;;){const o=2*n+1,a=o+1;let r=n;if(o<this.k.length&&this.less(o,r)&&(r=o),a<this.k.length&&this.less(a,r)&&(r=a),r===n)break;this.swap(n,r),n=r}}return t}}function bo(s,t){const e=s.bands.filter(i=>i.from===t||i.to===t).flatMap(i=>i.sides);return[...s.levels.find(i=>i.id===t)?.segs??[],...e]}function Ml(s,t,e){const i=s.levels.find(d=>d.id===t);if(!i)return null;const n=i.extent,o=Math.max(1,Math.ceil((n.maxX-n.minX)/X)),a=Math.max(1,Math.ceil((n.maxZ-n.minZ)/X));if(o*a>bl)return null;const r=bo(s,t),l=new Uint8Array(o*a),h=e*yl;for(const d of r){const u=h+d.r,p=Math.max(0,Math.floor((Math.min(d.a[0],d.b[0])-u-n.minX)/X)),m=Math.min(o-1,Math.floor((Math.max(d.a[0],d.b[0])+u-n.minX)/X)),w=Math.max(0,Math.floor((Math.min(d.a[1],d.b[1])-u-n.minZ)/X)),y=Math.min(a-1,Math.floor((Math.max(d.a[1],d.b[1])+u-n.minZ)/X));for(let b=w;b<=y;b++)for(let P=p;P<=m;P++){const S=b*o+P;l[S]||gs(n.minX+(P+.5)*X,n.minZ+(b+.5)*X,d).d<u&&(l[S]=1)}}const c=new Map;for(const d of r)d.kind==="object"&&(c.get(d.id)??c.set(d.id,[]).get(d.id)).push(d);for(const d of c.values()){if(d.length<3)continue;const u=d.map(S=>S.a),p=u.map(S=>S[0]),m=u.map(S=>S[1]),w=Math.max(0,Math.floor((Math.min(...p)-n.minX)/X)),y=Math.min(o-1,Math.floor((Math.max(...p)-n.minX)/X)),b=Math.max(0,Math.floor((Math.min(...m)-n.minZ)/X)),P=Math.min(a-1,Math.floor((Math.max(...m)-n.minZ)/X));for(let S=b;S<=P;S++)for(let E=w;E<=y;E++)os(n.minX+(E+.5)*X,n.minZ+(S+.5)*X,u)&&(l[S*o+E]=1)}return{level:t,minX:n.minX,minZ:n.minZ,cols:o,rows:a,blocked:l,segs:r}}const zi=new WeakMap;function Sl(s,t,e){let i=zi.get(s);i||(i=new Map,zi.set(s,i));const n=`${t}|${e}`;if(i.has(n))return i.get(n)??null;const o=Ml(s,t,e);return i.set(n,o),o}function ns(s,t,e,i){const n=Math.hypot(t[0]-s[0],t[1]-s[1]);if(n<1e-6)return!0;const o=Math.max(2,Math.ceil(n/.1));for(let a=0;a<=o;a++){const r=s[0]+(t[0]-s[0])*a/o,l=s[1]+(t[1]-s[1])*a/o;for(const h of e)if(gs(r,l,h).d<i*kl+h.r)return!1}return!0}function Al(s,t,e,i,n){const o=Sl(s,t,n);if(!o)return null;const{cols:a,rows:r,minX:l,minZ:h,blocked:c}=o,d=(x,L)=>[is(Math.floor((x-l)/X),0,a-1),is(Math.floor((L-h)/X),0,r-1)],[u,p]=d(e[0],e[1]);let[m,w]=d(i[0],i[1]),y=i[0],b=i[1];if(c[w*a+m]){let x=null;for(let L=-re;L<=re;L++)for(let $=-re;$<=re;$++){const j=m+$,N=w+L;if(j<0||N<0||j>=a||N>=r||c[N*a+j])continue;const H=$*$+L*L;(!x||H<x.d)&&(x={i:j,j:N,d:H})}if(!x)return null;m=x.i,w=x.j,y=l+(m+.5)*X,b=h+(w+.5)*X}const P=p*a+u,S=w*a+m,E=new Float64Array(a*r).fill(1/0),I=new Int32Array(a*r).fill(-1),_=new Uint8Array(a*r),A=(x,L)=>Math.hypot(x-m,L-w),f=new xl;E[P]=0,f.push(A(u,p),P);const g=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];for(;f.size;){const x=f.pop();if(_[x])continue;if(x===S)break;_[x]=1;const L=x%a,$=(x-L)/a;for(const[j,N,H]of g){const G=L+j,B=$+N;if(G<0||B<0||G>=a||B>=r)continue;const st=B*a+G;if(c[st]||_[st]||j&&N&&(c[$*a+G]||c[B*a+L]))continue;const xt=E[x]+H;xt<E[st]-1e-12&&(E[st]=xt,I[st]=x,f.push(xt+A(G,B),st))}}if(S!==P&&I[S]<0)return null;const v=[];for(let x=S;x>=0&&x!==P;x=I[x])v.push([l+(x%a+.5)*X,h+(Math.floor(x/a)+.5)*X]);v.reverse(),v.push([y,b]);const k=[];let M=[e[0],e[1]],z=0;for(;z<v.length;){let x=z;for(let L=v.length-1;L>z;L--)if(ns(M,v[L],o.segs,n)){x=L;break}k.push([Ei(v[x][0]),Ei(v[x][1])]),M=v[x],z=x+1}return k}const le=.28,_l=1.4,Pl=2.8,El=120,zl=220,Tl=.1,Dl=1/60,he=70,Ti=[1.2,2],ce=1.65,Di=.02,Li=.45,nt=.3,Ll=1.2,Rl=.1,Il={forward:0,strafe:0,turn:0,run:!1},Cl=s=>{let t=((s+180)%360+360)%360-180;return t===-180&&(t=180),t},de=s=>(s%360+360)%360,dt=(s,t,e)=>Math.min(e,Math.max(t,s)),ue=s=>Math.round(s*1e4)/1e4+0;class $l{constructor(t,e={}){this.x=0,this.z=0,this.heading=0,this.pitch=0,this.level="",this.eye=ce,this.eyeTarget=ce,this.eyeHold=null,this.path=null,this.levels=new Map,this.doors=new Map,this.room=void 0,this.crossShown=null,this.edge=!1,this.blockedDoor=null,this.clock=0,this.progress=null,this.setEyeHeight(e.eye_m??ce,!0),this.setWorld(t);const i=t.starts.find(n=>n.id===t.defaultStart)??t.starts[0];i?this.place(i):this.level=t.levels[0]?.id??""}setWorld(t){if(this.world=t,this.levels=new Map(t.levels.map(e=>[e.id,e])),this.doors=new Map(t.doors.map(e=>[e.id,e])),this.level&&!this.levels.has(this.level)&&(this.level=t.levels[0]?.id??""),this.path?.length){const e=bo(t,this.level);let i=[this.x,this.z];for(const n of this.path){if(!ns(i,n,e,le))return this.cancelPath(),[{type:"path-blocked"}];i=n}}return[]}cancelPath(){this.path=null,this.progress=null}setEyeHeight(t,e=!1){this.eyeTarget=dt(Number.isFinite(t)?t:ce,Ti[0],Ti[1]),e&&(this.eye=this.eyeTarget)}place(t){const e=[];if(t.level!==this.level&&this.levels.has(t.level)&&e.push({type:"level",level:t.level}),this.level=this.levels.has(t.level)?t.level:this.level||this.world.levels[0]?.id||"",this.heading=de(t.heading_deg),this.pitch=dt(t.pitch_deg,-he,he),this.cancelPath(),this.crossShown=null,this.eyeHold=t.eye_m,t.eye_m!==null&&(this.eye=t.eye_m),this.x=t.x,this.z=t.z,t.kind!=="camera"){const[i,n]=this.collide(t.x,t.z,this.segmentsFor(this.level,!!this.ground(t.x,t.z,this.level).band)).p;this.x=i,this.z=n}return this.noteRoom(e),e}placeAt(t,e,i=this.level,n=this.heading){return this.place({id:"at",kind:"centre",label:"",level:i,x:t,z:e,heading_deg:n,pitch_deg:this.pitch,eye_m:null})}look(t,e){this.heading=de(this.heading+t),this.pitch=dt(this.pitch+e,-he,he)}ground(t,e,i){const n=this.levels.get(i);for(const o of this.world.bands)if(!(o.from!==i&&o.to!==i)){for(let a=0;a<o.ramps.length;a++){const r=o.ramps[a],l=r.b[0]-r.a[0],h=r.b[1]-r.a[1],c=Math.hypot(l,h);if(c<1e-6)continue;const d=l/c,u=h/c,p=t-r.a[0],m=e-r.a[1],w=p*d+m*u;if(Math.abs(-p*u+m*d)<=r.width/2&&w>=-.05&&w<=c+.05){const b=dt(w/c,0,1);return{y:r.y0+(r.y1-r.y0)*b,band:o,ramp:a,along:w}}}for(const a of o.landings)if(os(t,e,a.poly))return{y:a.y,band:o,ramp:-1,along:0}}return{y:n?.elevation_m??0,band:null,ramp:-1,along:0}}segmentsFor(t,e){const i=this.world.bands.filter(n=>n.from===t||n.to===t).flatMap(n=>n.sides);return e?i:[...this.levels.get(t)?.segs??[],...i]}collide(t,e,i){let n=null;for(let o=0;o<3;o++){let a=!1;for(const r of i){const l=le+r.r,h=gs(t,e,r);if(h.d>=l)continue;let c,d;if(h.d<1e-9){const u=r.b[0]-r.a[0],p=r.b[1]-r.a[1],m=Math.hypot(u,p)||1;c=-p/m,d=u/m}else c=(t-h.cx)/h.d,d=(e-h.cz)/h.d;t=h.cx+c*(l+1e-4),e=h.cz+d*(l+1e-4),a=!0,n??=r}if(!a)break}return{p:[t,e],hit:n}}step(t,e=Il){const i=[],n=dt(Number.isFinite(t)?t:0,0,Tl),o=Math.max(1,Math.ceil(n/Dl-1e-9));for(let r=0;r<o;r++)this.sub(n/o,e,i);const a=this.eyeHold??this.eyeTarget;return this.eye+=(a-this.eye)*Math.min(1,n*6),Math.abs(a-this.eye)<1e-4&&(this.eye=a),i}sub(t,e,i){this.clock+=t,e.turn&&(this.heading=de(this.heading+dt(e.turn,-1,1)*El*t));let n=dt(e.forward,-1,1),o=dt(e.strafe,-1,1),a=e.run;if(n||o)this.cancelPath();else if(this.path&&this.path.length){const[A,f]=this.path[0];if(Math.hypot(A-this.x,f-this.z)<.15){this.path.shift(),this.path.length||(this.cancelPath(),i.push({type:"arrived"}));return}const v=this.progress;if(!v||Math.hypot(this.x-v.x,this.z-v.z)>=Rl)this.progress={x:this.x,z:this.z,at:this.clock};else if(this.clock-v.at>Ll){this.cancelPath(),i.push({type:"path-blocked"});return}const k=Cl(Pn(A-this.x,f-this.z)-this.heading);this.heading=de(this.heading+Math.sign(k)*Math.min(Math.abs(k),zl*t)),n=Math.abs(k)<35?1:.2,o=0,a=!1}if(!n&&!o)return;const r=this.heading*Math.PI/180,l=a?Pl:_l,h=Math.min(1,Math.hypot(n,o)),c=Math.hypot(n,o)||1,d=Math.sin(r),u=-Math.cos(r),p=Math.cos(r),m=Math.sin(r);let w=this.x+(d*n+p*o)/c*h*l*t,y=this.z+(u*n+m*o)/c*h*l*t;const b=this.ground(this.x,this.z,this.level),P=!!b.band&&!!this.ground(w,y,this.level).band,S=this.collide(w,y,this.segmentsFor(this.level,P));if([w,y]=S.p,S.hit&&S.hit.kind==="door"){if(this.blockedDoor!==S.hit.id){const A=this.doors.get(S.hit.id);A&&i.push({type:"blocked",door:A})}this.blockedDoor=S.hit.id}else this.blockedDoor=null;const E=this.levels.get(this.level);if(E&&!this.ground(w,y,this.level).band){const A=E.extent,f=dt(w,A.minX+nt,Math.max(A.minX+nt,A.maxX-nt)),g=dt(y,A.minZ+nt,Math.max(A.minZ+nt,A.maxZ-nt)),v=f!==w||g!==y;v&&!this.edge&&i.push({type:"edge"}),this.edge=v,w=f,y=g}(Math.abs(w-this.x)>1e-7||Math.abs(y-this.z)>1e-7)&&(this.eyeHold=null),this.x=w,this.z=y;const I=this.ground(this.x,this.z,this.level),_=I.band??b.band;if(_){const A=_.ramps.length-1,f=z=>I.band===_&&I.ramp===z||b.band===_&&b.ramp===z,g=_.ramps[A],v=Math.hypot(g.b[0]-g.a[0],g.b[1]-g.a[1]),k=f(A)?this.alongOf(g):-1/0,M=f(0)?this.alongOf(_.ramps[0]):1/0;_.to&&this.level===_.from&&k>v-Di?this.switchLevel(_.to,i):_.to&&this.level===_.to&&M<Di&&this.switchLevel(_.from,i),_.farFloor&&k>v-Li&&this.crossShown!==_.id?(this.crossShown=_.id,i.push({type:"cross-floor",band:_.id,floor:_.farFloor})):_.farFloor&&k<=v-Li-.3&&(this.crossShown=null)}this.noteRoom(i)}alongOf(t){const e=t.b[0]-t.a[0],i=t.b[1]-t.a[1],n=Math.hypot(e,i)||1;return((this.x-t.a[0])*e+(this.z-t.a[1])*i)/n}switchLevel(t,e){t===this.level||!this.levels.has(t)||(this.level=t,e.push({type:"level",level:t}))}noteRoom(t){const e=this.world.rooms.find(n=>n.level===this.level&&os(this.x,this.z,n.poly))??null,i=e?.id??null;i!==this.room&&(this.room!==void 0&&t.push({type:"room",room:e}),this.room=i)}pose(){const t=this.ground(this.x,this.z,this.level);return{x:ue(this.x),y:ue(t.y+this.eye),z:ue(this.z),heading_deg:Math.round(this.heading*1e3)/1e3+0,pitch_deg:Math.round(this.pitch*1e3)/1e3+0,level:this.level,ground:ue(t.y),band:t.band?.id??null}}lineFree(t,e,i){return ns(t,e,i,le)}pathTo(t,e){const i=Al(this.world,this.level,[this.x,this.z],[t,e],le);return i?(this.path=i,this.progress=null,i):null}}const Fl=.3,xe=70,Ol=50,Nl=80,Bl=120,Ul=(s,t,e)=>Math.min(e,Math.max(t,s)),as=s=>Math.round(s*1e3)/1e3+0,Rt=s=>as(Ul(Number.isFinite(s)?s:xe,Ol,Nl));function ql(s,t,e=xe,i=Fl){const n=i*(Rt(e)/xe);return[as(-s*n),as(t*n)]}function Gl(s,t,e){if(!(t>1e-6)||!(e>1e-6))return Rt(s);const i=Math.tan(Rt(s)/2*Math.PI/180);return Rt(2*Math.atan(i*t/e)*180/Math.PI)}const Ri=(s,t)=>Math.hypot(s[0]-t[0],s[1]-t[1]);class Wl{constructor(t=Bl){this.h=0,this.p=0,this.tau=Math.max(.001,t/3e3)}add(t,e){this.h+=t,this.p+=e}get pending(){return Math.abs(this.h)>1e-4||Math.abs(this.p)>1e-4}step(t){if(!this.pending)return this.h=0,this.p=0,[0,0];const e=t>0?1-Math.exp(-t/this.tau):0;let i=this.h*e,n=this.p*e;return Math.abs(this.h-i)<=1e-4&&(i=this.h),Math.abs(this.p-n)<=1e-4&&(n=this.p),this.h-=i,this.p-=n,[i,n]}flush(){const t=[this.h,this.p];return this.h=0,this.p=0,t}clear(){this.h=0,this.p=0}}const jl=56,Hl=8,Kl=84,Xl=10,rs={forward:0,strafe:0,run:!1,engaged:!1,knob:[0,0]},pe=s=>Math.round(s*1e6)/1e6+0;function Vl(s,t,e={}){const i=e.radius??jl,n=Math.min(e.dead??Hl,i-1e-6),o=e.runAt??Kl,a=e.snapDeg??Xl;if(!Number.isFinite(s)||!Number.isFinite(t))return rs;const r=Math.hypot(s,t),l=r>i?i/r:1,h=[pe(s*l),pe(t*l)];if(r<=n)return{...rs,knob:h};const c=Math.min(1,(r-n)/(i-n));let d=-t/r,u=s/r;const p=Math.atan2(Math.abs(s),Math.abs(t))*180/Math.PI;return p<a?(u=0,d=Math.sign(d)):p>90-a&&(d=0,u=Math.sign(u)),{forward:pe(d*c),strafe:pe(u*c),run:r>=o,engaged:!0,knob:h}}const Ne=500,Ii=10,Yl=110,Zl=.05;class Ql{constructor(t,e=xe){this.bounds=t,this.fingers=new Map,this.pinch=null,this.fovNow=Rt(e)}get fov(){return this.fovNow}setFov(t){this.fovNow=Rt(t)}get count(){return this.fingers.size}get stick(){for(const t of this.fingers.values())if(t.role==="stick"&&t.engaged)return{state:t.lastStick,origin:[t.x0,t.y0]};return null}isLeft(t){const e=this.bounds();return t-e.left<e.width/2}down(t){if(this.fingers.has(t.id))return[];const e=this.isLeft(t.x),i={id:t.id,x0:t.x,y0:t.y,x:t.x,y:t.y,lx:t.x,ly:t.y,t0:t.t,role:e?"stick":"look",left:e,armed:!0,engaged:!1,lastStick:rs};if(this.fingers.size===0)return this.fingers.set(t.id,i),[];if(this.fingers.size>=2)return i.role="rest",i.armed=!1,this.fingers.set(t.id,i),[];const n=[...this.fingers.values()][0],o=Math.hypot(n.x-t.x,n.y-t.y)<=Yl;return(n.left===e||o)&&n.armed&&n.role!=="rest"?(n.role="pinch",n.armed=!1,i.role="pinch",i.armed=!1,this.fingers.set(t.id,i),this.pinch={a:n.id,b:i.id,dist:Ri([n.x,n.y],[i.x,i.y]),fov:this.fovNow},[]):(n.armed=!1,n.role!=="rest"&&n.left===e&&(i.role="rest",i.armed=!1),this.fingers.set(t.id,i),[])}move(t){const e=this.fingers.get(t.id);if(!e)return[];e.x=t.x,e.y=t.y;const i=[],n=Math.hypot(e.x-e.x0,e.y-e.y0)>Ii;if(e.role==="stick"){const o=Vl(e.x-e.x0,e.y-e.y0);o.engaged?(e.engaged=!0,e.armed=!1,(o.forward!==e.lastStick.forward||o.strafe!==e.lastStick.strafe||o.run!==e.lastStick.run||o.knob[0]!==e.lastStick.knob[0]||o.knob[1]!==e.lastStick.knob[1]||!e.lastStick.engaged)&&(e.lastStick=o,i.push({type:"stick",forward:o.forward,strafe:o.strafe,run:o.run,origin:[e.x0,e.y0],knob:o.knob}))):e.engaged?(e.lastStick={...o,engaged:!0},i.push({type:"stick",forward:0,strafe:0,run:!1,origin:[e.x0,e.y0],knob:o.knob})):n&&(e.armed=!1)}else if(e.role==="look"){if(n&&(e.armed=!1),!e.armed){const[o,a]=ql(e.x-e.lx,e.y-e.ly,this.fovNow);e.lx=e.x,e.ly=e.y,(o||a)&&i.push({type:"look",dHeading:o,dPitch:a})}}else if(e.role==="pinch"&&this.pinch){const o=this.fingers.get(this.pinch.a),a=this.fingers.get(this.pinch.b);if(o&&a){const r=Gl(this.pinch.fov,this.pinch.dist,Ri([o.x,o.y],[a.x,a.y]));Math.abs(r-this.fovNow)>=Zl&&(this.fovNow=r,i.push({type:"fov",fov:r}))}}return i}up(t){const e=this.fingers.get(t.id);if(!e)return[];e.x=t.x,e.y=t.y,this.fingers.delete(t.id);const i=[];return e.role==="stick"&&e.engaged?i.push({type:"stick-end"}):(e.role==="stick"||e.role==="look")&&e.armed&&t.t-e.t0<Ne&&Math.hypot(e.x-e.x0,e.y-e.y0)<=Ii&&i.push({type:"tap",x:e.x,y:e.y}),e.role==="pinch"&&this.endPinch(),i}cancel(t){const e=this.fingers.get(t.id);return e?(e.armed=!1,this.up(t)):[]}reset(){const t=[];for(const e of this.fingers.values())e.role==="stick"&&e.engaged&&t.push({type:"stick-end"});return this.fingers.clear(),this.pinch=null,t}endPinch(){this.pinch=null;for(const t of this.fingers.values())t.role==="pinch"&&(t.role="rest",t.armed=!1)}nextDeadline(){const t=this.candidate();return t?t.t0+Ne:null}candidate(){if(this.fingers.size!==1)return null;const t=[...this.fingers.values()][0];return t.armed&&(t.role==="stick"||t.role==="look")?t:null}tick(t){const e=this.candidate();return!e||t-e.t0<Ne?[]:(e.armed=!1,[{type:"long-press",x:e.x,y:e.y}])}}const yo=4e3,ko=2;function xo(s){return s.filter(t=>t.kind==="saved")}class Jl{constructor(t,e={}){this.stops=t,this.i=-1,this.due=1/0,this.dwell=Math.max(1,e.dwellMs??yo),this.loop=!!e.loop}get playable(){return this.stops.length>=ko}get playing(){return this.i>=0}get index(){return this.i}get dueAt(){return this.i>=0?this.due:null}start(t){return this.playable?(this.i=0,this.due=t+this.dwell,{index:0,stop:this.stops[0]}):null}advance(t){if(this.i<0||t<this.due)return null;const e=this.i+1;if(e>=this.stops.length){if(!this.loop)return this.stop(),"end";this.i=0}else this.i=e;return this.due=t+this.dwell,{index:this.i,stop:this.stops[this.i]}}stop(){this.i=-1,this.due=1/0}}const fe=.22,th=24,eh=2e3,sh=150;class ih{constructor(t,e,i){this.host=e,this.keys=new Set,this.raf=0,this.last=0,this.drag=null,this.locked=!1,this.mode="drag",this.fpsWindow=null,this.disposed=!1,this.touchStick=null,this.longTimer=0,this.longDue=null,this.route=null,this.routeTimer=0,this.fadeTimer=0,this.tick=o=>{if(this.raf=0,this.disposed)return;const a=this.last?(o-this.last)/1e3:1/60;if(this.last=o,this.ease?.pending){const[l,h]=this.ease.step(a);(l||h)&&this.ctrl.look(l,h)}const r=this.ctrl.step(a,this.input());this.host.onPose(),r.length&&this.host.onEvents(r),this.watchFps(o),this.busy()?this.raf=requestAnimationFrame(this.tick):this.fpsWindow=null},this.onKeyDown=o=>{if(this.typing(o)||o.ctrlKey||o.metaKey||o.altKey)return;const a=o.code;if(a==="Escape"){o.preventDefault(),this.host.onExit();return}if(a==="Enter"){if(this.onControl(o))return;o.preventDefault(),this.host.onAct();return}if(a==="KeyQ"||a==="KeyE"){o.preventDefault(),this.host.onInput?.("key"),this.cancelRoute(),this.ctrl.look(a==="KeyQ"?-45:45,0),this.host.onPose();return}const r=/^Digit([1-9])$/.exec(a);if(r){const h=this.ctrl.world.starts.filter(c=>c.kind==="saved")[Number(r[1])-1];h&&(o.preventDefault(),this.host.onInput?.("key"),this.goTo(h));return}["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","ShiftLeft","ShiftRight"].includes(a)&&(o.preventDefault(),this.host.onInput?.("key"),this.cancelRoute(),this.keys.add(a),this.kick())},this.onKeyUp=o=>{this.keys.delete(o.code)},this.onBlur=()=>{this.keys.clear(),this.endTouches()},this.onHidden=()=>{document.hidden&&this.endTouches()},this.onTouch=o=>{if(o.pointerType==="mouse")return;o.stopPropagation(),(o.type==="pointerdown"||o.type==="pointermove")&&o.preventDefault();const a={id:o.pointerId,x:o.clientX,y:o.clientY,t:performance.now()};let r;if(o.type==="pointerdown"){this.host.onInput?.("touch"),this.cancelRoute();try{this.host.canvas.setPointerCapture(o.pointerId)}catch{}r=this.touch.down(a)}else o.type==="pointermove"?r=this.touch.move(a):o.type==="pointerup"?r=this.touch.up(a):r=this.touch.cancel(a);this.apply(r),this.armLong()},this.onContextMenu=o=>{o.preventDefault()},this.onDown=o=>{if(o.pointerType!=="mouse"||o.button!==0)return;this.host.onInput?.("mouse"),this.cancelRoute();const a=this.host.canvas;if(!this.locked&&this.wantsLock())try{const r=a.requestPointerLock?.();r&&typeof r.catch=="function"&&r.catch(()=>{})}catch{}this.locked||(this.drag={id:o.pointerId,x:o.clientX,y:o.clientY})},this.onMove=o=>{const a=this.drag;if(o.pointerType!=="mouse"||!a||o.pointerId!==a.id)return;const r=o.clientX-a.x,l=o.clientY-a.y;a.x=o.clientX,a.y=o.clientY,this.ctrl.look(-r*fe,l*fe),this.host.onPose()},this.onUp=o=>{this.drag&&o.pointerId===this.drag.id&&(this.drag=null)},this.onLockChange=()=>{this.locked=document.pointerLockElement===this.host.canvas},this.onLockedMove=o=>{this.locked&&(this.ctrl.look(o.movementX*fe,-o.movementY*fe),this.host.onPose())},this.ctrl=new $l(t,{eye_m:i.eye_m}),i.start&&this.ctrl.place(i.start),this.mode=i.mouseMode,this.routeDwellMs=i.routeDwellMs??yo,this.fadeMs=i.fadeMs??sh,this.ease=i.ease===!1?null:new Wl,this.surface=e.surface??e.canvas.parentElement??e.canvas,this.touch=new Ql(()=>this.surface.getBoundingClientRect(),i.fov),window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onHidden),document.addEventListener("pointerlockchange",this.onLockChange);const n=e.canvas;n.addEventListener("pointerdown",this.onDown),n.addEventListener("pointermove",this.onMove),n.addEventListener("pointerup",this.onUp),n.addEventListener("pointercancel",this.onUp),n.addEventListener("mousemove",this.onLockedMove),n.addEventListener("contextmenu",this.onContextMenu);for(const o of["pointerdown","pointermove","pointerup","pointercancel"])this.surface.addEventListener(o,this.onTouch,!0)}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),window.clearTimeout(this.longTimer),window.clearTimeout(this.routeTimer),window.clearTimeout(this.fadeTimer),window.removeEventListener("keydown",this.onKeyDown),window.removeEventListener("keyup",this.onKeyUp),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onHidden),document.removeEventListener("pointerlockchange",this.onLockChange);const t=this.host.canvas;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointercancel",this.onUp),t.removeEventListener("mousemove",this.onLockedMove),t.removeEventListener("contextmenu",this.onContextMenu);for(const e of["pointerdown","pointermove","pointerup","pointercancel"])this.surface.removeEventListener(e,this.onTouch,!0);this.locked&&document.pointerLockElement===t&&document.exitPointerLock?.(),this.host.onStick?.(null),this.host.onFade?.(!1)}setMouseMode(t){this.mode=t,t==="drag"&&this.locked&&document.exitPointerLock?.()}setWorld(t){const e=this.ctrl.setWorld(t);e.length&&this.host.onEvents(e),this.kick()}setFov(t){this.touch.setFov(t)}wantsLock(){if(this.mode==="lock")return!0;if(this.mode!=="auto")return!1;try{return window.self===window.top}catch{return!1}}input(){const t=this.keys,e=(...a)=>a.some(r=>t.has(r));let i=(e("KeyW","ArrowUp")?1:0)-(e("KeyS","ArrowDown")?1:0),n=(e("KeyD")?1:0)-(e("KeyA")?1:0);const o=(e("ArrowRight")?1:0)-(e("ArrowLeft")?1:0);return this.touchStick&&(i=i||this.touchStick.forward,n=n||this.touchStick.strafe),{forward:i,strafe:n,turn:o,run:e("ShiftLeft","ShiftRight")||!!(this.touchStick&&(this.touchStick.forward||this.touchStick.strafe)&&this.touchStick.run)}}busy(){const t=this.input();return!!(t.forward||t.strafe||t.turn||this.ctrl.path||this.ease?.pending||Math.abs(this.ctrl.eye-this.ctrl.eyeTarget)>1e-4)}kick(){this.raf||this.disposed||(this.last=0,this.raf=requestAnimationFrame(this.tick))}watchFps(t){const e=this.fpsWindow;if(!e){this.fpsWindow={t0:t,frames:0};return}e.frames++;const i=t-e.t0;if(i<eh)return;const n=e.frames*1e3/i;this.fpsWindow={t0:t,frames:0},n<th&&!document.hidden&&this.host.onLowFps(n)}typing(t){return t.composedPath().some(i=>i instanceof HTMLElement&&(i.tagName==="INPUT"||i.tagName==="SELECT"||i.tagName==="TEXTAREA"||i.isContentEditable))}onControl(t){return t.composedPath().some(e=>e instanceof HTMLElement&&(e.tagName==="BUTTON"||e.tagName==="A"))}endTouches(){window.clearTimeout(this.longTimer),this.longDue=null,this.apply(this.touch.reset()),this.touchStick=null,this.host.onStick?.(null)}goTo(t){this.cancelRoute(),this.jump(t)}jump(t){const e=this.ctrl.place(t);this.ease?.clear(),this.host.onPose(),e.length&&this.host.onEvents(e),this.kick()}walkTo(t,e){const i=!!this.ctrl.pathTo(t,e);return i&&this.kick(),i}playRoute(){const t=new Jl(xo(this.ctrl.world.starts),{dwellMs:this.routeDwellMs}),e=t.start(performance.now());return e?(this.cancelRoute(),this.route=t,this.host.onRoute?.({playing:!0}),this.showStop(e.stop,e.index),this.armRoute(),!0):!1}get routePlaying(){return this.route!==null}cancelRoute(){window.clearTimeout(this.routeTimer),window.clearTimeout(this.fadeTimer),this.route&&(this.route.stop(),this.route=null,this.host.onFade?.(!1),this.host.onRoute?.({playing:!1}))}armRoute(){window.clearTimeout(this.routeTimer);const t=this.route?.dueAt;t!=null&&(this.routeTimer=window.setTimeout(()=>this.routeTick(),Math.max(0,t-performance.now())+1))}routeTick(){const t=this.route;if(!t||this.disposed)return;const e=t.advance(performance.now());if(e===null){this.armRoute();return}if(e==="end"){this.route=null,this.host.onRoute?.({playing:!1});return}this.showStop(e.stop,e.index),this.armRoute()}showStop(t,e){const i=()=>{!this.route||this.disposed||(this.jump(t),this.host.onFade?.(!1),this.host.onRoute?.({playing:!0,index:e,label:t.label}))};window.clearTimeout(this.fadeTimer),this.fadeMs>0&&this.host.onFade?(this.host.onFade(!0),this.fadeTimer=window.setTimeout(i,this.fadeMs)):i()}apply(t){for(const e of t)switch(e.type){case"stick":this.touchStick={forward:e.forward,strafe:e.strafe,run:e.run},this.host.onStick?.({origin:e.origin,knob:e.knob,run:e.run}),this.kick();break;case"stick-end":this.touchStick=null,this.host.onStick?.(null);break;case"look":this.ease?(this.ease.add(e.dHeading,e.dPitch),this.kick()):(this.ctrl.look(e.dHeading,e.dPitch),this.host.onPose());break;case"fov":this.host.onFov?.(e.fov);break;case"tap":this.host.onTap?.(e.x,e.y);break;case"long-press":this.host.onLongPress?.(e.x,e.y);break}}armLong(){const t=this.touch.nextDeadline();t!==this.longDue&&(window.clearTimeout(this.longTimer),this.longDue=t,!(t===null||this.disposed)&&(this.longTimer=window.setTimeout(()=>{this.longDue=null,this.apply(this.touch.tick(performance.now())),this.armLong()},Math.max(0,t-performance.now())+1)))}get stickVector(){return this.touchStick?{forward:this.touchStick.forward,strafe:this.touchStick.strafe}:null}get pointerLocked(){return this.locked}}const oh={now:()=>Date.now(),setTimeout:(s,t)=>globalThis.setTimeout(s,t),clearTimeout:s=>globalThis.clearTimeout(s)};function Ci(s){const t=typeof s=="number"?s:Number(s);return Number.isFinite(t)&&t>0?Math.round(t*1e3):0}class nh{constructor(t){this.opts=t,this.phaseNow="active",this.timer=null,this.timerDue=0,this.holds=new Set,this.disposed=!1,this.sched=t.scheduler??oh,this.wakeOnChange=t.wakeOnChange!==!1,this.ms=Ci(t.idleS),this.lastActivity=this.sched.now(),this.arm()}get phase(){return this.phaseNow}get idleS(){return this.ms/1e3}input(){this.disposed||(this.lastActivity=this.sched.now(),this.phaseNow==="idle"&&this.set("active","input"))}change(){if(!this.disposed){if(this.phaseNow==="idle"){this.wakeOnChange&&(this.lastActivity=this.sched.now(),this.set("active","change"));return}this.lastActivity=this.sched.now()}}hold(t,e){if(!this.disposed){if(e){this.holds.add(t),this.lastActivity=this.sched.now(),this.phaseNow==="idle"?this.set("active","hold"):this.clear();return}this.holds.delete(t)&&(this.lastActivity=this.sched.now(),this.arm())}}setVisible(t){this.disposed||!t||(this.lastActivity=this.sched.now(),this.phaseNow==="idle"&&this.set("active","visible"))}setIdleS(t){if(this.disposed)return;const e=Ci(t);if(e!==this.ms){if(this.ms=e,this.lastActivity=this.sched.now(),this.phaseNow==="idle"){this.set("active","config");return}this.clear(),this.arm()}}dispose(){this.disposed=!0,this.clear(),this.holds.clear()}set(t,e){t!==this.phaseNow&&(this.phaseNow=t,t==="active"?this.arm():this.clear(),this.opts.onChange(t,e))}clear(){this.timer!==null&&this.sched.clearTimeout(this.timer),this.timer=null,this.timerDue=0}arm(){if(this.disposed||this.ms<=0||this.phaseNow==="idle"||this.holds.size>0){this.clear();return}const t=this.lastActivity+this.ms;this.timer!==null&&this.timerDue<=t||(this.clear(),this.timerDue=t,this.timer=this.sched.setTimeout(()=>this.fire(),Math.max(0,t-this.sched.now())))}fire(){if(this.timer=null,this.timerDue=0,!(this.disposed||this.phaseNow!=="active"||this.holds.size>0||this.ms<=0)){if(this.sched.now()-this.lastActivity<this.ms){this.arm();return}this.set("idle","timeout")}}}class ah{constructor(){this.reasons=new Set}set(t,e){const i=this.paused;return e?this.reasons.add(t):this.reasons.delete(t),i!==this.paused}has(t){return this.reasons.has(t)}get paused(){return this.reasons.size>0}}const rh=1200,Be="sw.plan3d.lockrefused";function lh(){let s=null;return{doc:document,frame:()=>{try{if(window.self===window.top)return null;const t=window.frameElement;if(!t)return null;const e=t.getAttribute("sandbox");return{sandbox:e===null?null:e.split(/\s+/).filter(Boolean)}}catch{return null}},supported:()=>typeof Element<"u"&&typeof Element.prototype.requestPointerLock=="function",store:{get:()=>{try{return sessionStorage.getItem(Be)??s}catch{return s}},set:t=>{s=t;try{t===null?sessionStorage.removeItem(Be):sessionStorage.setItem(Be,t)}catch{}}},setTimeout:(t,e)=>window.setTimeout(t,e),clearTimeout:t=>window.clearTimeout(t)}}const $i=s=>s==="unsupported"||s==="frame-sandbox"||s==="refused";class hh{constructor(t=lh(),e){this.env=t,this.onRefused=e,this.attached=0,this.reported=!1,this.lockedOnce=!1,this.onError=()=>{this.refuse("refused")},this.onChange=()=>{this.env.doc.pointerLockElement&&(this.lockedOnce=!0)}}get blocked(){if(!this.env.supported())return"unsupported";const t=this.env.frame();if(t&&t.sandbox&&!t.sandbox.includes("allow-pointer-lock"))return"frame-sandbox";const e=this.env.store.get();return $i(e)?e:null}effectiveMode(t){return t!=="drag"&&this.blocked?"drag":t}attach(){this.attached++===0&&(this.env.doc.addEventListener("pointerlockerror",this.onError),this.env.doc.addEventListener("pointerlockchange",this.onChange));let t=!1;return()=>{t||(t=!0,--this.attached===0&&(this.env.doc.removeEventListener("pointerlockerror",this.onError),this.env.doc.removeEventListener("pointerlockchange",this.onChange)))}}reset(){this.env.store.set(null),this.reported=!1}request(t){const e=this.blocked;if(e)return Promise.resolve({state:"blocked",reason:e});const i=t.requestPointerLock;if(typeof i!="function")return Promise.resolve(this.refuse("unsupported"));const{doc:n}=this.env;return new Promise(o=>{let a=null,r=!1;const l=d=>{r||(r=!0,n.removeEventListener("pointerlockchange",h),n.removeEventListener("pointerlockerror",c),a!==null&&this.env.clearTimeout(a),o(d))},h=()=>{n.pointerLockElement===t&&(this.lockedOnce=!0,l({state:"locked"}))},c=()=>l(this.refuse("refused"));n.addEventListener("pointerlockchange",h),n.addEventListener("pointerlockerror",c),a=this.env.setTimeout(()=>l(this.refuse("refused")),rh);try{const d=i.call(t);d&&typeof d.then=="function"&&d.then(()=>{n.pointerLockElement===t&&(this.lockedOnce=!0,l({state:"locked"}))},()=>l(this.refuse("refused")))}catch{l(this.refuse("refused"))}})}refuse(t){return this.lockedOnce&&t==="refused"?{state:"refused",reason:t}:($i(this.env.store.get())||this.env.store.set(t),this.reported||(this.reported=!0,this.onRefused?.(t)),{state:"refused",reason:t})}}const Ue=6;function ch(s,t){const e=Math.max(.001,s.maxX-s.minX),i=Math.max(.001,s.maxZ-s.minZ),n=t-2*Ue,o=n/Math.max(e,i),a=Ue+(n-e*o)/2,r=Ue+(n-i*o)/2;return{size:t,k:o,toPx:(l,h)=>[a+(l-s.minX)*o,r+(h-s.minZ)*o],toM:(l,h)=>[s.minX+(l-a)/o,s.minZ+(h-r)/o]}}function dh(s,t,e,i,n,o){const a=t.levels.find(u=>u.id===e.level);if(s.clearRect(0,0,n,n),!a)return null;const r=ch(a.extent,n);s.fillStyle=o.bg,s.beginPath(),s.roundRect(0,0,n,n,10),s.fill();for(const u of t.rooms)u.level===a.id&&(s.beginPath(),u.poly.forEach(([p,m],w)=>{const[y,b]=r.toPx(p,m);w?s.lineTo(y,b):s.moveTo(y,b)}),s.closePath(),s.fillStyle=o.room,s.fill());const l=(u,p,m,w)=>{const[y,b]=r.toPx(u[0],u[1]),[P,S]=r.toPx(p[0],p[1]);s.strokeStyle=m,s.lineWidth=w,s.beginPath(),s.moveTo(y,b),s.lineTo(P,S),s.stroke()};s.lineCap="round";for(const u of a.segs)u.kind!=="door"&&l(u.a,u.b,u.kind==="window"?o.window:u.kind==="object"?o.object:u.kind==="low"?o.low:o.wall,u.kind==="object"?1:Math.max(1.5,u.r*2*r.k));for(const u of t.doors)u.level===a.id&&l(u.a,u.b,u.passable?o.doorOpen:o.doorClosed,2.5);for(const u of t.bands)if(!(u.from!==a.id&&u.to!==a.id)){for(const p of u.sides)l(p.a,p.b,o.stair,1);for(const p of u.ramps){const m=Math.hypot(p.b[0]-p.a[0],p.b[1]-p.a[1])||1,w=[-(p.b[1]-p.a[1])/m,(p.b[0]-p.a[0])/m],y=Math.max(2,Math.round(m/.3));for(let b=1;b<y;b++){const P=b/y,S=p.a[0]+(p.b[0]-p.a[0])*P,E=p.a[1]+(p.b[1]-p.a[1])*P;l([S+w[0]*p.width/2,E+w[1]*p.width/2],[S-w[0]*p.width/2,E-w[1]*p.width/2],o.stair,.75)}}}if(i&&i.length){s.setLineDash([3,3]);let u=[e.x,e.z];for(const p of i)l(u,p,o.path,2),u=p;s.setLineDash([])}const[h,c]=r.toPx(e.x,e.z),d=(e.heading_deg-90)*Math.PI/180;return s.fillStyle=o.meRing,s.beginPath(),s.moveTo(h,c),s.arc(h,c,22,d-.5,d+.5),s.closePath(),s.fill(),s.fillStyle=o.me,s.beginPath(),s.arc(h,c,4,0,Math.PI*2),s.fill(),r}var uh=Object.defineProperty,ph=Object.getOwnPropertyDescriptor,Ft=(s,t,e,i)=>{for(var n=i>1?void 0:i?ph(t,e):t,o=s.length-1,a;o>=0;o--)(a=s[o])&&(n=(i?a(t,e,n):a(n))||n);return i&&n&&uh(t,e,n),n};const Fi=640,Oi=["saved","door","room","camera","centre"],Ni={saved:"walk.kindSaved",door:"walk.kindDoor",room:"walk.kindRoom",camera:"walk.kindCamera",centre:"walk.kindCentre"},me=s=>s in Ni?Y(Ni[s]):s,Bi=28;let kt=class extends Ki{constructor(){super(...arguments),this.starts=[],this.shown=null,this.routePlaying=!1,this.compact=!1,this.open=!1,this.swipe=null,this.suppressClick=!1,this.onGrabDown=s=>{this.swipe={y:s.clientY,id:s.pointerId,moved:!1}},this.onGrabMove=s=>{const t=this.swipe;if(!t||s.pointerId!==t.id||t.moved)return;const e=s.clientY-t.y;e<=-Bi?(this.open=!0,t.moved=!0):e>=Bi&&(this.open=!1,t.moved=!0)},this.onGrabUp=s=>{if(!this.swipe||s.pointerId!==this.swipe.id)return;const t=this.swipe.moved;this.swipe=null,t&&(this.suppressClick=!0,window.setTimeout(()=>this.suppressClick=!1,80))},this.onGrabClick=()=>{if(this.suppressClick){this.suppressClick=!1;return}this.open=!this.open}}connectedCallback(){super.connectedCallback();const s=this.getRootNode().host??this;this.compact=s.clientWidth>0&&s.clientWidth<=Fi,typeof ResizeObserver<"u"&&(this.ro=new ResizeObserver(()=>{const t=s.clientWidth;t>0&&(this.compact=t<=Fi)}),this.ro.observe(s))}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}setStick(s){const t=this.renderRoot.querySelector(".stick");if(!t)return;if(!s){t.hidden=!0;return}const e=this.getBoundingClientRect();t.hidden=!1,t.style.transform=`translate(${Math.round(s.origin[0]-e.left)}px, ${Math.round(s.origin[1]-e.top)}px)`,t.toggleAttribute("data-run",s.run);const i=t.querySelector(".knob");i&&(i.style.transform=`translate(${Math.round(s.knob[0])}px, ${Math.round(s.knob[1])}px)`)}setTarget(s){const t=this.renderRoot.querySelector(".target");if(t){if(!s){t.hidden=!0;return}t.hidden=!1,t.style.transform=`translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`}}setFade(s){this.renderRoot.querySelector(".fade")?.toggleAttribute("data-on",s)}get sheetOpen(){return this.compact&&this.open}emit(s,t){this.dispatchEvent(new CustomEvent(s,{detail:t}))}onField(s,t){const e=Number(t.target.value);Number.isFinite(e)&&this.emit("hud-field",{key:s,value:e})}goto(s){s&&(this.emit("hud-goto",{id:s}),this.open=!1)}toggleRoute(){this.emit("hud-route",{play:!this.routePlaying})}routeButton(){return xo(this.starts).length<ko?F:R`<button type="button" class="btn ${this.compact?"":"ghost"}" data-walk-route aria-pressed=${this.routePlaying?"true":"false"} @click=${()=>this.toggleRoute()}>${this.routePlaying?Y("walk.routeStop"):Y("walk.route")}</button>`}fields(){const s=this.shown;return s?R`<label class="num">x <input type="number" step="0.1" inputmode="decimal" data-walk-x aria-label=${Y("walk.xMetres")} .value=${s.x.toFixed(2)} @change=${t=>this.onField("x",t)} /></label>
      <label class="num">y <input type="number" step="0.1" inputmode="decimal" data-walk-y aria-label=${Y("walk.yMetres")} .value=${s.z.toFixed(2)} @change=${t=>this.onField("z",t)} /></label>
      <label class="num">${Y("walk.heading")} <input type="number" step="5" inputmode="numeric" data-walk-heading aria-label=${Y("walk.headingDeg")} .value=${String(s.heading)} @change=${t=>this.onField("heading",t)} /></label>`:F}bar(){const s=Oi.filter(t=>this.starts.some(e=>e.kind===t));return R`<div class="walkbar" role="group" aria-label=${Y("walk.bar")} data-walk-bar>
      <button type="button" class="btn ghost" data-walk-exit @click=${()=>this.emit("hud-exit",null)}>${Y("walk.exit")}</button>
      <select data-walk-start aria-label=${Y("walk.standAt")} @change=${t=>{const e=t.target,i=e.value;e.value="",this.goto(i)}}>
        <option value="">${Y("walk.standAt")}</option>
        ${s.map(t=>R`<optgroup label=${me(t)}>${this.starts.filter(e=>e.kind===t).map(e=>R`<option value=${e.id}>${e.label||me(t)}</option>`)}</optgroup>`)}
      </select>
      ${this.routeButton()}
      ${this.fields()}
    </div>`}sheet(){const s=Oi.filter(t=>this.starts.some(e=>e.kind===t));return R`<div class="sheet" role="group" aria-label=${Y("walk.bar")} data-walk-bar data-walk-sheet data-open=${this.open?"true":"false"}>
      ${this.open?R`<div class="body" id="walk-sheet-body" data-walk-sheet-body>
            ${s.map(t=>R`<div class="group"><h4>${me(t)}</h4>
              <div class="places">${this.starts.filter(e=>e.kind===t).map(e=>R`<button type="button" class="btn" data-walk-place=${e.id} @click=${()=>this.goto(e.id)}>${e.label||me(t)}</button>`)}</div></div>`)}
            <div class="fields">${this.fields()}</div>
          </div>`:F}
      <div class="row">
        <button type="button" class="btn ghost" data-walk-exit @click=${()=>this.emit("hud-exit",null)}>${Y("walk.exit")}</button>
        <button type="button" class="btn" data-walk-sheet-toggle aria-expanded=${this.open?"true":"false"} aria-controls="walk-sheet-body"
          style="touch-action: none" @pointerdown=${this.onGrabDown} @pointermove=${this.onGrabMove} @pointerup=${this.onGrabUp} @pointercancel=${this.onGrabUp} @click=${this.onGrabClick}>${Y("walk.standAt")}<i class="chev" aria-hidden="true"></i></button>
        <span class="gap"></span>
        ${this.routeButton()}
      </div>
    </div>`}render(){return R`<i class="stick" hidden aria-hidden="true"><i class="knob"></i></i><i class="target" hidden aria-hidden="true"></i><i class="fade" aria-hidden="true"></i>${this.compact?this.sheet():this.bar()}`}};kt.styles=cs`
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
  `;Ft([O({attribute:!1})],kt.prototype,"starts",2);Ft([O({attribute:!1})],kt.prototype,"shown",2);Ft([O({type:Boolean})],kt.prototype,"routePlaying",2);Ft([q()],kt.prototype,"compact",2);Ft([q()],kt.prototype,"open",2);kt=Ft([Xi("sw-walk-hud")],kt);const fh=new Set(["entity","camera","object","opening"]);function mh(s,t,e,i){if(t.path&&t.path.length)return t.cancelPath(),{kind:"cancel"};const n=s.pickAt(e,i),o=n&&n.kind!=="zone"&&n.kind!=="level"?[n.point[0],n.point[2]]:s.floorPoint(e,i,t.pose().ground);if(!o)return{kind:"none"};const a=t.pathTo(o[0],o[1]);return!a||!a.length?{kind:"unreachable"}:{kind:"walk",target:a[a.length-1],path:a}}function wh(s,t,e){const i=s.pickAt(t,e);return i&&fh.has(i.kind)?i:null}class gh{constructor(t){this.host=t,this.last=null,this.ringShown=!1,this.minimapId=null}get touch(){return this.last==="touch"}hooks(){return{onTap:(t,e)=>this.tap(t,e),onLongPress:(t,e)=>this.longPress(t,e),onFov:t=>this.host.view()?.setWalkFov(t),onStick:t=>this.host.hud()?.setStick(t),onInput:t=>this.input(t),onFade:t=>this.host.hud()?.setFade(t),onRoute:t=>this.route(t)}}reset(){this.last=null,this.ringShown=!1,this.minimapId=null,this.host.touching(!1)}input(t){t!==this.last&&(this.last=t,this.host.touching(t==="touch"))}tap(t,e){const i=this.host.walk(),n=this.host.view();if(!i||!n)return;const o=mh(n,i.ctrl,t,e);o.kind==="walk"?i.kick():o.kind==="unreachable"&&this.host.message(Y("walk.noWay"),"warn"),this.updateTarget()}longPress(t,e){const i=this.host.view(),n=i?wh(i,t,e):null;if(n){try{navigator.vibrate?.(12)}catch{}this.host.select(n)}}route(t){const e=this.host.hud();e&&(e.routePlaying=t.playing),t.label&&this.host.message(t.label,"info")}updateTarget(){const t=this.host.hud(),e=this.host.walk(),i=this.host.view();if(!t||!e||!i)return;const n=e.ctrl.path;if(!n||!n.length){this.ringShown&&(this.ringShown=!1,t.setTarget(null));return}const o=n[n.length-1],a=i.projectPoint([o[0],e.ctrl.pose().ground,o[1]]);this.ringShown=!!a,t.setTarget(a)}goto(t){const e=this.host.world()?.starts.find(i=>i.id===t.detail.id);e&&this.host.walk()?.goTo(e)}field(t){const e=this.host.walk();if(!e)return;const{key:i,value:n}=t.detail,o=e.ctrl;e.goTo({id:"field",kind:"centre",label:"",level:o.level,x:i==="x"?n:o.x,z:i==="z"?n:o.z,heading_deg:i==="heading"?n:o.heading,pitch_deg:o.pitch,eye_m:null})}routeToggle(t){t.detail.play?this.host.walk()?.playRoute():this.host.walk()?.cancelRoute()}minimapDown(t){if(!(t.pointerType==="mouse"&&t.button!==0)){this.input(t.pointerType==="mouse"?"mouse":"touch"),this.minimapId=t.pointerId;try{t.currentTarget.setPointerCapture(t.pointerId)}catch{}t.preventDefault(),this.minimapGo(t)}}minimapMove(t){t.pointerId===this.minimapId&&this.minimapGo(t)}minimapUp(t){t.pointerId===this.minimapId&&(this.minimapId=null)}minimapGo(t){const e=this.host.minimap(),i=this.host.walk();if(!e||!i)return;const n=t.currentTarget.getBoundingClientRect();let[o,a]=e.toM(t.clientX-n.left,t.clientY-n.top);const r=this.host.world()?.levels.find(l=>l.id===i.ctrl.level)?.extent;r&&(o=Math.min(Math.max(o,r.minX+nt),Math.max(r.minX+nt,r.maxX-nt)),a=Math.min(Math.max(a,r.minZ+nt),Math.max(r.minZ+nt,r.maxZ-nt))),i.goTo({id:"minimap",kind:"centre",label:"",level:i.ctrl.level,x:o,z:a,heading_deg:i.ctrl.heading,pitch_deg:i.ctrl.pitch,eye_m:null})}}const Ui=1.35,vh=100,bh=700;function yh(s,t){return s<bh?null:s-12-t-12>=vh?"row":"above"}function kh(s,t){if(typeof ResizeObserver>"u")return;const e=()=>{const n=yh(s.clientWidth,t.getBoundingClientRect().width);n?s.setAttribute("data-zoom-room",n):s.removeAttribute("data-zoom-room")},i=new ResizeObserver(e);return i.observe(s),i.observe(t),e(),i}const xh=cs`
  .zoom {
    position: absolute;
    inset-inline-end: 12px;
    inset-block-end: 12px;
    z-index: var(--sw-z-map-ui);
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-border-strong);
    box-shadow: var(--sw-shadow-1);
    direction: rtl;
  }
  .zoom button {
    display: inline-grid;
    place-items: center;
    inline-size: 36px;
    block-size: 30px;
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    color: var(--sw-text-2);
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s, transform 0.12s;
  }
  .zoom button:hover {
    background: color-mix(in srgb, var(--sw-menu-surface) 88%, var(--sw-text));
    color: var(--sw-text);
  }
  .zoom button:active {
    transform: scale(0.94);
  }
  .zoom button:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 1px;
  }
  /* watchZoomRoom: on the bar's row where it leaves room, else just above the bar's row (the notes of that corner move up
     over it); never over a chip, and the bar never wraps for it. A narrow element (a phone, an event's card) has none. */
  :host(:not([data-zoom-room])) .zoom {
    display: none;
  }
  :host([data-zoom-room='above']) .zoom {
    inset-block-end: calc(18px + var(--bar-h, 0px));
  }
  @media (min-width: 641px) {
    :host([data-zoom-room='above']) .note {
      inset-block-end: calc(62px + var(--bar-h, 0px));
    }
    :host([data-zoom-room='above']) .note.fb {
      inset-block-end: calc(90px + var(--bar-h, 0px));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .zoom button {
      transition: none;
    }
  }
  :host([data-walk]) .zoom,
  :host([kiosk]) .zoom {
    display: none;
  }
`;function Mh(s,t){return s?R`<div class="zoom" role="group" aria-label="זום" data-3d-zoom>
    <button type="button" aria-label="התרחקות" title="התרחקות" data-3d-zoom-out @click=${()=>t(1/Ui)}><sw-icon name="minus" size="18" aria-hidden="true"></sw-icon></button>
    <button type="button" aria-label="התקרבות" title="התקרבות" data-3d-zoom-in @click=${()=>t(Ui)}><sw-icon name="plus" size="18" aria-hidden="true"></sw-icon></button>
  </div>`:F}const Sh={live:"live-text",recorded:"recorded-text",offline:"offline-text",stale:"stale-text",unknown:"unknown-text",danger:"danger-text",warning:"warning-text",success:"live-text",forbidden:"forbidden-text",accent:"accent-text","text-3":"text-2","map-label":"text-2"},Ah=s=>`var(--sw-${Sh[s]??s})`,qi={color:"#ffb98a",alpha:.42},_h=.9;class Ph{constructor(){this.recipe=mn,this.quality=2,this.view=null,this.mount=null}async render(t,e){this.release();const i=performance.now(),{width:n,height:o}=e,a=wn(t(e.variant),e.levelId,e.variant),r=document.createElement("div");r.setAttribute("aria-hidden","true"),r.dataset.stillBake="",r.style.cssText=`position:fixed;left:${-(n+64)}px;top:0;width:${n}px;height:${o}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(r),this.mount=r;const l=new ws({mount:r,color:vn(e.style),onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1,night:gn(e.band).night});if(this.view=l,l.setDescription(a),!l.setPreset(e.preset))throw new Error("המבט של התמונה המוכנה אינו זמין לקומה זו.");l.capture();const h=l.renderer.domElement;if(h.width!==n||h.height!==o)throw new Error("גודל הציור אינו תואם את גודל התמונה המוכנה.");const c=document.createElement("canvas");c.width=n,c.height=o;const d=c.getContext("2d");if(!d)throw new Error("ציור דו־ממדי אינו זמין בדפדפן.");d.fillStyle=bn(e.style,e.band),d.fillRect(0,0,n,o),d.drawImage(h,0,0),e.band==="sunset"&&(d.globalCompositeOperation="multiply",d.globalAlpha=qi.alpha,d.fillStyle=qi.color,d.fillRect(0,0,n,o),d.globalCompositeOperation="source-over",d.globalAlpha=1);const u=await Eh(c),p=w=>{const y=l.projectPoint(w);return y?[y.x,y.y]:null};let m="";try{const w=l.rendererInfo();m=`${w.vendor} ${w.renderer}`.trim().slice(0,160)}catch{m=""}return{blob:u,project:p,renderer:m,ms:Math.round(performance.now()-i)}}release(){this.view?.dispose(),this.view=null,this.mount?.remove(),this.mount=null}dispose(){this.release()}}function Eh(s){const t=e=>new Promise(i=>s.toBlob(n=>i(n),e,_h));return t("image/webp").then(async e=>{if(e&&e.type==="image/webp")return e;const i=await t("image/jpeg");if(!i)throw new Error("קידוד התמונה נכשל.");return i})}function zh(s,t,e){const i=document.createElement("canvas");i.width=s,i.height=t;const n=i.getContext("2d");if(!n)return Promise.reject(new Error("ציור דו־ממדי אינו זמין בדפדפן."));const o=n.createImageData(s,t);return o.data.set(e),n.putImageData(o,0,0),new Promise((a,r)=>i.toBlob(l=>l?a(l):r(new Error("קידוד מפת התאורה נכשל.")),"image/png"))}var Th=Object.defineProperty,Dh=Object.getOwnPropertyDescriptor,D=(s,t,e,i)=>{for(var n=i>1?void 0:i?Dh(t,e):t,o=s.length-1,a;o>=0;o--)(a=s[o])&&(n=(i?a(t,e,n):a(n))||n);return i&&n&&Th(t,e,n),n};const Lh="ייצוא glTF נכשל",Rh="עבר לרמה סכמטית — קצב הפריימים היה נמוך",Ih=s=>s==="schematic"?Rh:`עבר ל${Ke[s]} — קצב הפריימים היה נמוך`,Ch=6e4,$h=4e3,Wt="sw.plan3d.fallback",ls="sw.plan3d.night",ge="sw.plan3d.walkguard",Mo=30,Gi=6,Wi=2,ji=["pointerdown","pointermove","keydown","wheel","touchstart"],Fh="נעילת סמן אינה זמינה בדף הזה — המבט נשאר בגרירה",ve={desktop:62,touch:70,portrait:76},be=3.5,Oh=2600,Nh=[],Bh=[0,0,0];function So(s,t){return s===t?!0:!t||s.length!==t.length?!1:s.every((e,i)=>e.id===t[i].id&&e.name===t[i].name&&e.elevation_m===t[i].elevation_m)}function Ao(s,t){if(s===t)return!0;if(!t)return!1;const e=Object.keys(s);return e.length!==Object.keys(t).length?!1:e.every(i=>{const n=s[i],o=t[i];return!!o&&n.presence===o.presence&&n.open===o.open&&n.lit===o.lit})}const Hi=new WeakMap;function qe(s,t,e){let i=Hi.get(s);i||Hi.set(s,i={}),!(i[t]===e&&s.style[t]===e)&&(i[t]=e,s.style[t]=e)}function Uh(s){return s.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}function _o(s,t){const e=s.bands.find(l=>l.farFloor?.id===t),i=e?.ramps[0];if(!e||!i)return null;const n=Math.hypot(i.b[0]-i.a[0],i.b[1]-i.a[1])||1,o=(i.b[0]-i.a[0])/n,a=(i.b[1]-i.a[1])/n,r=(Math.atan2(-o,a)*180/Math.PI+360)%360;return{id:`twin:${e.id}`,kind:"centre",label:"",level:e.from,x:i.a[0]-o*.6,z:i.a[1]-a*.6,heading_deg:r,pitch_deg:0,eye_m:null}}function hs(s,t){const e=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());if(!e)return s;const i=e[1].length===3?e[1].split("").map(n=>n+n).join(""):e[1];return`rgba(${parseInt(i.slice(0,2),16)}, ${parseInt(i.slice(2,4),16)}, ${parseInt(i.slice(4,6),16)}, ${t})`}const qh={wall:"קיר",opening:"פתח",object:"עצם",connector:"מחבר",camera:"מצלמה",entity:"ישות",zone:"חדר",label:"תווית",level:"מפלס"},Ge=(s,t)=>{try{return(s==="local"?localStorage:sessionStorage).getItem(t)}catch{return null}},Et=(s,t,e)=>{try{const i=s==="local"?localStorage:sessionStorage;e===null?i.removeItem(t):i.setItem(t,e)}catch{}},we=12,Gh=52,Wh=480,We=s=>s==="schematic"?"1":s==="full"?"2":s;let T=class extends Ki{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.frameKey=null,this.cameras=[],this.labels={},this.exportName="plan-3d",this.levels=[],this.activeLevel=null,this.thumbnailScene=null,this.levelDots={},this.qualityDefault=null,this.minFps=Mo,this.continuous=!1,this.walkable=!1,this.stillsAvailable=!1,this.idleS=0,this.changeKey="",this.qualityForce=null,this.kiosk=!1,this.themeForce=null,this.backdrop=null,this.shownBackdrop="sky",this.sunAt=null,this.walkState="off",this.walkShown=null,this.walkAim=null,this.walkNote=null,this.crossFloor=null,this.viewDials={...Le},this.idle=!1,this.hasIdleStill=!1,this.kioskIdle=null,this.pauseGate=new ah,this.lockGate=new hh(void 0,()=>this.onLockRefused()),this.lockStop=null,this.onActivity=()=>this.kioskIdle?.input(),this.walk=null,this.walkNoteTimer=0,this.walkShownAt=0,this.walkAimAt=0,this.minimapFrame=null,this.walkArrivedFrom=null,this.hover=null,this.overlays=[],this.overlayById=new Map,this.pillSizes=new Map,this.hiddenPills=0,this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.chosen=Jn(),this.gpu=Vn(),this.installMode=null,this.fallbackRung=Zt(Ge("session",Wt)),this.perfHint=null,this.walkDrop=Zt(Ge("session",ge)),this.dialsReady=!1,this.timeManual=null,this.timeOpen=!1,this.sunShown=null,this.site=De(null),this.clockTimer=0,this.night=Ge("local",ls)==="1",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null,this.probe=null,this.probeTimer=0,this.probed=!1,this.probePending=!1,this.thumbs=new Map,this.thumbsFor=null,this.thumbsQuality=null,this.thumbPass=0,this.settingsAsked=!1,this.ownAsked=!1,this.overlayEls=null,this.realisticNotified=null,this.onVisibility=()=>{this.kioskIdle?.setVisible(!document.hidden),this.setPause("hidden",document.hidden),document.hidden?this.probe&&(this.endProbe(!1),this.probePending=!0):this.probePending&&(Qt(this.rung)||this.measuresLevel1())&&this.view&&this.startProbe()},this.onIdleSlot=s=>{this.hasIdleStill=s.target.assignedElements().length>0},this.routeDwellMs=0,this.ui=new gh({view:()=>this.view,walk:()=>this.walk,hud:()=>this.renderRoot.querySelector("sw-walk-hud"),world:()=>this.description?.walk??null,minimap:()=>this.minimapFrame,select:s=>this.emitSelect(s),message:(s,t)=>this.walkMessage(s,t),touching:s=>{this.toggleAttribute("data-walk-touch",s),s&&(this.walkAim=null)}}),this.minimapPalette=null,this.cornerSent=void 0}firstUpdated(){this.watchBar(),this.init()}watchBar(){const s=this.renderRoot.querySelector(".bar");!s||typeof ResizeObserver>"u"||(this.barRo?.disconnect(),this.zoomRo?.disconnect(),this.barRo=new ResizeObserver(()=>{const t=Math.ceil(s.getBoundingClientRect().height);t>0&&this.style.setProperty("--bar-h",`${t}px`),this.syncFrameInsets()}),this.barRo.observe(s),this.zoomRo?.disconnect(),this.zoomRo=kh(this,s))}syncFrameInsets(){if(!this.view)return;const s=this.kiosk,t=s?null:this.renderRoot.querySelector(".bar"),e=t?Math.ceil(t.getBoundingClientRect().height):0,i=this.clientHeight,n=!s&&i>=Wh?Gh:we;this.view.setFrameInsets({top:n,right:we,bottom:e?e+12+4:we,left:we})}connectedCallback(){super.connectedCallback(),this.pauseGate.set("hidden",document.hidden)&&this.toggleAttribute("data-paused",this.pauseGate.paused),this.hasUpdated&&!this.view&&this.init(),document.addEventListener("visibilitychange",this.onVisibility),this.lockStop??=this.lockGate.attach(),this.hasUpdated&&this.setupIdle()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("visibilitychange",this.onVisibility),this.lockStop?.(),this.lockStop=null,this.disposeIdle(),window.clearInterval(this.clockTimer),this.themeObserver?.disconnect(),this.themeObserver=void 0,this.realisticNotified=null,this.cornerSent=void 0,this.ro?.disconnect(),this.barRo?.disconnect(),this.zoomRo?.disconnect(),cancelAnimationFrame(this.thumbPass),this.thumbPass=0,this.endProbe(!1),this.probed=!1,this.probePending=!1,this.stopWalk(!1),window.clearTimeout(this.walkNoteTimer),this.view?.dispose(),this.view=null,this.applied=null,this.thumbs.clear(),this.thumbsFor=null,window.clearTimeout(this.toastTimer)}get mode(){const s=this.dialsReady&&this.viewDials.quality!=="auto"?this.viewDials.quality:null,t=Zt(this.qualityDefault);return this.qualityForce??this.chosen??s??t??this.installMode??"auto"}get autoStartRung(){return Bn(this.viewDials.default_view,2,this.gpu)}get rung(){const s=Un(this.mode,this.autoStartRung,this.fallbackRung),t=this.walkDrop;return this.walkState==="on"&&t&&Cs.indexOf(t)>Cs.indexOf(s)?t:s}get quality(){return qn(this.rung)}get fallback(){return this.mode==="auto"&&this.fallbackRung!==null&&this.rung===this.fallbackRung}init(){if(this.ownAsked||(this.ownAsked=!0,ta().then(s=>{s&&s!==this.chosen&&(this.chosen=s)})),!this.settingsAsked){this.settingsAsked=!0;const s=_i(Eo().then(e=>e),ss,{}).catch(()=>({})),t=_i(Wn().then(e=>({dials:e.effective,location:e.location})),ss,{dials:{...Le},location:void 0}).catch(()=>({dials:{...Le},location:void 0}));Promise.all([s,t]).then(([e,i])=>{this.installMode=Zt(e["plan.quality"])??"schematic",this.site=De(i.location,e["time.zone"]);const n=i.dials;this.viewDials={...n,mouse_mode:this.lockGate.effectiveMode(n.mouse_mode)},this.shownBackdrop=this.backdrop??(n.backdrop==="studio"?"studio":"sky"),this.dialsReady=!0}).finally(()=>{this.isConnected&&!this.view&&this.init()});return}try{this.view=new ws({mount:this.stage,color:s=>getComputedStyle(this).getPropertyValue(`--sw-${s}`).trim()||"#888888",onSelect:(s,t,e)=>this.onViewSelect(s,t,e),onHover:(s,t,e)=>this.setHover(s,t,e),onFrame:(s,t)=>{this.setAttribute("data-frames",String(s)),this.setAttribute("data-fps",String(t)),this.onProbeFrame(s)},onDraw:()=>this.layoutOverlays(),onAsset:()=>this.setAttribute("data-real-pending",String(this.view?.realPending??0)),quality:this.quality,night:this.night,real:this.realSettings(),dprCap:this.viewDials.dpr_cap,fit:"content"}),this.syncFrameInsets(),this.toggleAttribute("data-night",this.night)}catch(s){console.warn("sw-plan-3d: WebGL failed to start",s),this.error=Yn,this.dispatchEvent(new CustomEvent("stills-fallback",{detail:{reason:"webgl"},bubbles:!0,composed:!0}));return}this.view.setContinuous(this.continuous),this.view.setPaused(this.pauseGate.paused),this.view.setRealSettings({motion:this.viewDials.motion}),this.applySun(),this.startClock(),this.watchTheme(),this.notifyRealistic(),this.ro=new ResizeObserver(()=>{this.view?.resize(),this.syncFrameInsets()}),this.ro.observe(this),this.presetApplied=!1,this.setAttribute("data-quality",String(this.quality)),this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}willUpdate(s){if(s.has("backdrop")&&(this.shownBackdrop=this.backdrop??(this.viewDials.backdrop==="studio"?"studio":"sky")),!(s.has("description")||s.has("activeLevel")||s.has("selectedId")||s.has("hover")||s.has("walkState")))return;const t=this.description?.parts??[],e=t.filter(r=>r.kind==="chip"),i=this.description?.levels??[],n=i.length?i.reduce((r,l)=>l.elevation_m>r.elevation_m?l:r).id:null,o=this.walkState==="on"?[]:t.filter(r=>r.kind==="label"&&(this.activeLevel?r.level_id===this.activeLevel:!n||r.level_id===n||r.level_id===null));let a=t.filter(r=>r.kind==="entity"&&(!this.activeLevel||r.level_id===this.activeLevel));if(this.hiddenPills=0,this.walkState==="on")a=a.filter(r=>r.userData.id===this.selectedId||r.userData.id===this.hover?.id);else if(a.length>(this.quality===3&&this.clientWidth>0&&this.clientWidth<yn?kn:Ji)){const r=a.filter(l=>l.userData.id===this.selectedId||l.userData.id===this.hover?.id||l.color!=="text-3");this.hiddenPills=a.length-r.length,a=r}this.overlays=[...o,...e,...a],this.overlayById=new Map(this.overlays.map(r=>[r.id,r]))}updated(s){if(this.overlayEls=null,this.syncCorner(),s.has("sunAt")&&this.toggleAttribute("data-sun-fixed",this.sunAt!==null),this.syncKiosk(s),!this.view)return;const t=s.has("frameKey")&&s.get("frameKey")!==void 0;t&&(this.presetApplied=!1),t&&this.walkState==="on"&&(this.walkArrivedFrom=String(s.get("frameKey")??"")),s.has("description")&&this.description&&this.apply(this.description),s.has("description")&&this.syncWalk(),t&&!this.presetApplied&&this.applied&&this.frame(),(s.has("selectedId")||s.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),s.has("preset")&&s.get("preset")!==void 0&&this.applyPreset(this.preset),s.has("continuous")&&!this.probe&&this.view.setContinuous(this.continuous),s.has("sunAt")&&this.applySun(),this.applyQuality(),this.layoutOverlays()}layoutOverlays(){const s=this.view;if(!s||!this.overlays.length)return;const t=this.overlayEls??=[...this.renderRoot.querySelectorAll("[data-3d-part]")].map(l=>({el:l,p:this.overlayById.get(l.getAttribute("data-3d-part")??"")??null})),e=s.projectPoints(t.map(({p:l})=>l?.position??Bh)),i=[];t.forEach(({el:l,p:h},c)=>{const d=h?e[c]:null;if(!h||!d){qe(l,"display","none");return}qe(l,"display","block"),i.push({el:l,p:h,x:Math.round(d.x),y:Math.round(d.y)})});const n=[],o=[],a=[];for(const l of i){const h=`${l.p.id}|${l.p.text??""}`;let c=this.pillSizes.get(h);c||(c={w:l.el.offsetWidth,h:l.el.offsetHeight},c.w>0&&c.h>0&&this.pillSizes.set(h,c)),l.p.kind==="label"?o.push({id:l.p.id,x:l.x,y:l.y+c.h/2,w:c.w,h:c.h}):l.p.kind==="chip"?a.push({id:l.p.id,x:l.x,y:l.y+c.h/2,w:c.w,h:c.h}):n.push({id:l.p.id,x:l.x,y:l.y-Gi,w:c.w,h:c.h})}const r=new Map(n.length>1?Pi(n,Wi):[]);if(o.length){const l=n.map(c=>({...c,y:c.y+(r.get(c.id)??0)})),h=new Set([...a,...l].map(c=>c.id));for(const[c,d]of Pi([...a,...l,...o],Wi,h))h.has(c)||r.set(c,d)}for(const{el:l,p:h,x:c,y:d}of i){const u=Math.round(r?.get(h.id)??0);qe(l,"transform",h.kind==="chip"||h.kind==="label"?`translate(${c}px, ${d+u}px) translate(-50%, -50%)`:`translate(${c}px, ${d-Gi+u}px) translate(-50%, -100%)`)}}apply(s){s!==this.applied&&(this.applied=s,this.view?.setDescription(s),this.setAttribute("data-parts",String(s.parts.length)),this.toggleAttribute("data-estimated",s.estimated),this.presetApplied||this.frame(),this.view?.setSelected(this.selectedId),(Qt(this.rung)||this.measuresLevel1())&&!this.probed&&this.startProbe())}realSettings(){return{rung:this.rung==="realistic"?"realistic":"lite",style:En(this.themeForce??this.viewDials.style,this.uiTheme()),furniture:this.viewDials.furniture,textures:this.viewDials.textures,sectionCut:this.viewDials.section_cut,backdrop:this.shownBackdrop,floorFinish:this.viewDials.floor_finish??ms,reflections:this.viewDials.floor_reflections!==!1}}uiTheme(){return this.themeForce??(document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light")}watchTheme(){this.themeObserver||typeof MutationObserver>"u"||(this.themeObserver=new MutationObserver(()=>{this.minimapPalette=null,this.view?.setRealSettings({style:this.realSettings().style}),this.applySun(),this.requestUpdate()}),this.themeObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["data-theme"]}))}notifyRealistic(){const s=this.quality===3;s!==this.realisticNotified&&(this.realisticNotified=s,this.dispatchEvent(new CustomEvent("realistic-change",{detail:{on:s},bubbles:!0,composed:!0})))}applyQuality(){const s=this.quality,t=this.rung;if(this.setAttribute("data-quality",String(s)),this.setAttribute("data-rung",t),this.setAttribute("data-quality-mode",this.mode),!this.view)return;const e=t==="realistic"?"realistic":"lite",i=this.view.getQuality()===s&&(s!==3||this.view.getRealSettings().rung===e);this.view.setRealSettings({rung:e}),!i&&(this.view.setQuality(s),this.thumbs.clear(),this.probed=!1,this.notifyRealistic(),this.applySun(),(Qt(t)||this.measuresLevel1())&&this.applied?this.startProbe():this.endProbe(!1),this.requestUpdate())}sunInstant(){if(this.sunAt!==null&&Number.isFinite(this.sunAt))return this.sunAt;const s=this.timeManual;return s?Rn(s.ymd[0],s.ymd[1],s.ymd[2],s.hour,this.site.zone):Date.now()}applySun(){const s=this.view;if(!s)return;const t=this.sunInstant();s.setSun({utcMs:t,latitude:this.site.latitude,longitude:this.site.longitude});const e=s.sunState();if(this.quality===3&&e){const i=Yt(t,this.site.zone);this.sunShown={hour:i.hour+i.minute/60,band:In(e.elevation),elevation:Math.round(e.elevation)};const[n,o,a]=s.skyBackdrop();this.style.setProperty("--sky-top",n),this.style.setProperty("--sky-hor",o),this.style.setProperty("--sky-bot",a),this.setAttribute("data-sun-elevation",String(Math.round(e.elevation))),this.setAttribute("data-style",s.getRealSettings().style)}else this.sunShown=null}setSite(s){this.site=De(s,this.site.zone),this.applySun(),this.requestUpdate()}startClock(){window.clearInterval(this.clockTimer),this.viewDials.time_source==="manual"&&!this.timeManual&&this.setTimeHour(Yt(Date.now(),this.site.zone).hour),this.clockTimer=window.setInterval(()=>{!this.timeManual&&this.sunAt===null&&this.quality===3&&this.applySun()},Ch)}setTimeHour(s){const t=Yt(Date.now(),this.site.zone),e=this.timeManual?.ymd??[t.year,t.month,t.day];this.timeManual={hour:Math.max(0,Math.min(24,s)),ymd:e},this.applySun()}setTimeDate(s){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!t)return;const e=this.timeManual?.hour??this.sunShown?.hour??12;this.timeManual={hour:e,ymd:[Number(t[1]),Number(t[2]),Number(t[3])]},this.applySun()}timeNow(){this.timeManual=null,this.applySun()}setNight(s){s!==this.night&&(this.night=s,Et("local",ls,s?"1":null),this.toggleAttribute("data-night",s),this.view?.setNight(s),this.thumbs.clear(),this.requestUpdate())}get isNight(){return this.night}setQuality(s){this.setMode(Gn(s))}setMode(s){const t=this.perfHint;this.chosen=s,ea(s),this.fallbackRung=null,this.perfHint=null,this.walkDrop=null,Et("session",Wt,null),Et("session",ge,null),this.probed=!1,s==="auto"&&t&&(this.fallbackRung=t,Et("session",Wt,We(t)))}startProbe(){if(this.endProbe(!1),this.probed=!0,!this.view||this.minFps<=0)return;if(document.hidden||this.pauseGate.paused){this.probePending=!0;return}this.probePending=!1;const s=performance.now();this.probe={until:0,t0:0,f0:0,start:Number(this.getAttribute("data-frames")??0),s0:s,lt:0,lf:0,watch:new Zn(this.minFps,Qn(this.minFps),ke)},this.view.setContinuous(!0),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),go)}onProbeFrame(s){const t=this.probe;if(!t)return;if(document.hidden){this.endProbe(!1),this.probePending=!0;return}const e=performance.now();if(!t.t0){if(s-t.start<vo)return;t.t0=t.lt=e,t.f0=t.lf=s,t.until=e+ke,window.clearTimeout(this.probeTimer),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),wo);return}const i=t.watch.sample((s-t.lf)*1e3/Math.max(1,e-t.lt),t.lt,e);t.lt=e,t.lf=s,!(!i&&e<t.until)&&(this.setAttribute("data-probe-fps",String(Math.round((s-t.f0)*1e3/Math.max(1,e-t.t0)))),this.endProbe(!1),i&&this.onLowFps())}endProbe(s){window.clearTimeout(this.probeTimer),this.probeTimer=0;const t=this.probe;if(this.probe=null,this.view?.setContinuous(this.continuous),s&&t&&document.hidden){this.probePending=!0;return}if(s&&t){const e=Number(this.getAttribute("data-frames")??0),i=performance.now(),n=t.t0?(e-t.f0)*1e3/Math.max(1,i-t.t0):0;this.setAttribute("data-probe-fps",String(Math.round(n))),(t.t0?t.watch.sample((e-t.lf)*1e3/Math.max(1,i-t.lt),t.lt,i):t.watch.sample(0,t.s0,i))&&this.onLowFps()}}onLowFps(){const s=$s(this.rung);if(!s){this.measuresLevel1()&&this.dispatchEvent(new CustomEvent("stills-fallback",{detail:{reason:"fps"},bubbles:!0,composed:!0}));return}this.mode==="auto"?(this.fallbackRung=s,Et("session",Wt,We(s))):this.perfHint=s}syncKiosk(s){s.has("idleS")&&this.setupIdle(),s.has("themeForce")&&(this.minimapPalette=null),s.has("themeForce")&&s.get("themeForce")!==void 0&&this.view&&(this.view.setRealSettings({style:this.realSettings().style}),this.applySun()),s.has("shownBackdrop")&&s.get("shownBackdrop")!==void 0&&this.view&&(this.view.setRealSettings({backdrop:this.shownBackdrop}),this.applySun()),s.has("changeKey")&&s.get("changeKey")!==void 0&&this.kioskIdle?.change(),s.has("walkState")&&this.kioskIdle?.hold("walk",this.walkState!=="off")}setupIdle(){const s=this.idleS;if(!(s>0)){this.disposeIdle();return}if(this.kioskIdle){this.kioskIdle.setIdleS(s);return}this.kioskIdle=new nh({idleS:s,onChange:(t,e)=>this.onIdlePhase(t==="idle",e)});for(const t of ji)window.addEventListener(t,this.onActivity,{capture:!0,passive:!0});this.walkState!=="off"&&this.kioskIdle.hold("walk",!0)}disposeIdle(){if(this.kioskIdle){this.kioskIdle.dispose(),this.kioskIdle=null;for(const s of ji)window.removeEventListener(s,this.onActivity,{capture:!0});this.idle&&this.onIdlePhase(!1,"config")}}onIdlePhase(s,t){this.idle=s,this.toggleAttribute("data-idle",s),this.setPause("idle",s),this.dispatchEvent(new CustomEvent("kiosk-idle",{detail:{idle:s,reason:t},bubbles:!0,composed:!0}))}setPause(s,t){this.pauseGate.set(s,t)&&this.applyPause()}applyPause(){const s=this.pauseGate.paused;s&&this.probe&&(this.endProbe(!1),this.probePending=!0),this.view?.setPaused(s),this.toggleAttribute("data-paused",s),s||(this.requestUpdate(),this.probePending&&this.view&&(Qt(this.rung)||this.measuresLevel1())&&this.startProbe())}onLockRefused(){this.viewDials={...this.viewDials,mouse_mode:"drag"},this.walk?.setMouseMode("drag"),this.walkState==="on"&&this.walkMessage(Fh,"info")}measuresLevel1(){return this.fallback&&this.stillsAvailable&&this.rung==="schematic"}frame(){this.presetApplied=!0,this.view?.setPreset(this.preset)?this.setAttribute("data-preset",typeof this.preset=="string"?this.preset:"camera"):this.view?.setPreset("iso")&&this.setAttribute("data-preset","iso")}applyPreset(s){this.view?.setPreset(s)&&this.setAttribute("data-preset",typeof s=="string"?s:"camera")}pickPreset(s){this.preset=s,this.applyPreset(s)}labelOf(s){return this.labels[s.id]??qh[s.kind]??s.id}emitSelect(s){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:s?.id??null,kind:s?.kind??null},bubbles:!0,composed:!0}))}setHover(s,t,e){this.hover=s?{id:s.id,kind:s.kind,label:this.labelOf(s),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}pickLevel(s){const t=this.activeLevel===s?null:s;this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t},bubbles:!0,composed:!0}))}playRoute(){return this.walk?.playRoute()??!1}stopRoute(){this.walk?.cancelRoute()}get routePlaying(){return this.walk?.routePlaying??!1}requestWalk(){this.walkState!=="off"||!this.view||(this.walkState="requested",this.description?.walk?this.startWalk():this.dispatchEvent(new CustomEvent("walk-change",{detail:{on:!0},bubbles:!0,composed:!0})))}syncWalk(){const s=this.description?.walk;if(this.walkState==="requested"&&s)this.startWalk();else if(this.walkState==="on")if(!s)this.stopWalk(!0);else if(this.walkArrivedFrom!==null&&s!==this.walk?.ctrl.world){const t=this.walkArrivedFrom;this.walkArrivedFrom=null,this.startWalk(_o(s,t)??void 0)}else this.walk?.setWorld(s)}get walking(){return this.walkState==="on"}get walkController(){return this.walk?.ctrl??null}walkFov(){return this.clientHeight>this.clientWidth*1.15?ve.portrait:typeof matchMedia=="function"&&matchMedia("(pointer: coarse)").matches?ve.touch:ve.desktop}startWalk(s){const t=this.description?.walk,e=this.view;if(!t||!e){this.walkState="off";return}this.walk?.dispose(),this.minimapPalette=null;const i=s??t.starts.find(o=>o.id===t.defaultStart)??t.starts[0]??null,n=this.walkFov();this.walk=new ih(t,{canvas:e.renderer.domElement,onPose:()=>this.onWalkPose(),onEvents:o=>this.onWalkEvents(o),onExit:()=>this.stopWalk(!0),onAct:()=>this.walkAct(),onLowFps:()=>this.onWalkLowFps(),...this.ui.hooks()},{eye_m:this.viewDials.eye_m,mouseMode:this.viewDials.mouse_mode,start:i,fov:n,ease:this.viewDials.motion,fadeMs:this.viewDials.motion?void 0:0,routeDwellMs:this.routeDwellMs||void 0}),e.enterWalk(this.walkCameraPose(),n,this.viewDials.motion?mo:0),this.endProbe(!1),this.walkState="on",this.crossFloor=null,this.setAttribute("data-walk",""),this.setAttribute("data-walk-level",this.walk.ctrl.level),this.updateComplete.then(()=>this.onWalkPose(!0))}stopWalk(s){this.walkState!=="off"&&(this.walk?.dispose(),this.walk=null,this.view?.exitWalk(),this.walkState="off",this.walkShown=null,this.walkAim=null,this.crossFloor=null,this.minimapFrame=null,this.minimapPalette=null,this.ui.reset(),this.removeAttribute("data-walk"),this.removeAttribute("data-walk-pos"),this.removeAttribute("data-walk-level"),s&&this.dispatchEvent(new CustomEvent("walk-change",{detail:{on:!1},bubbles:!0,composed:!0})))}walkCameraPose(){const s=this.walk.ctrl.pose();return{x:s.x,y:s.y,z:s.z,heading_deg:s.heading_deg,pitch_deg:s.pitch_deg}}onWalkPose(s=!1){const t=this.walk,e=this.view;if(!t||!e)return;const i=t.ctrl.pose();e.setWalkPose(i),this.drawWalkMinimap(),this.ui.updateTarget(),this.setAttribute("data-walk-pos",`${i.x.toFixed(2)},${i.z.toFixed(2)},${i.heading_deg.toFixed(1)}`);const n=performance.now();(s||n-this.walkShownAt>120)&&(this.walkShownAt=n,this.walkShown={x:i.x,z:i.z,heading:Math.round(i.heading_deg),level:i.level}),(s||n-this.walkAimAt>150)&&!this.ui.touch&&(this.walkAimAt=n,requestAnimationFrame(()=>{if(!this.walk||!this.view)return;const o=this.view.pickCentre(be),a=o&&["entity","camera","object","opening"].includes(o.kind)?o:null;a?.partId!==this.walkAim?.partId&&(this.walkAim=a)}))}onWalkEvents(s){for(const t of s)t.type==="level"?(this.setAttribute("data-walk-level",t.level),this.activeLevel!==null&&this.activeLevel!==t.level&&this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t.level},bubbles:!0,composed:!0}))):t.type==="cross-floor"?this.crossFloor=t.floor:t.type==="blocked"?this.walkMessage(`הדלת ${zn[t.door.state]}`,"warn"):t.type==="edge"?this.walkMessage("קצה התוכנית","info"):t.type==="path-blocked"?this.walkMessage(Y("walk.noWay"),"warn"):t.type==="room"&&(this.view?.setInterior(t.room?this.description?.real?.rooms[t.room.id]?.daylight??null:null),t.room?.name&&this.walkMessage(t.room.name,"info"))}walkMessage(s,t){this.walkNote={text:s,tone:t},window.clearTimeout(this.walkNoteTimer),this.walkNoteTimer=window.setTimeout(()=>this.walkNote=null,Oh)}walkAct(){const s=this.view?.pickCentre(be)??null;s&&this.emitSelect(s)}onWalkLowFps(){const s=$s(this.rung);s&&(this.viewDials.walk_guard?(this.walkDrop=s,Et("session",ge,We(s)),this.walkMessage(`הסיור עבר ל${Ke[s]} — קצב הפריימים היה נמוך`,"info")):this.perfHint=s)}onViewSelect(s,t,e){const i=this.walk;if(this.walkState!=="on"||!i){this.emitSelect(s);return}if(i.pointerLocked){const o=this.view?.pickCentre(be)??null;o&&this.emitSelect(o);return}if(s&&s.kind!=="zone"){this.emitSelect(s);return}if(t===void 0||e===void 0)return;const n=this.view?.floorPoint(t,e,i.ctrl.pose().ground);n&&!i.walkTo(n[0],n[1])&&this.walkMessage("אין דרך פתוחה לשם","warn")}drawWalkMinimap(){const s=this.renderRoot.querySelector("canvas.minimap"),t=this.walk,e=this.description?.walk;if(!s||!t||!e)return;const i=s.clientWidth||160,n=Math.min(2,window.devicePixelRatio||1);s.width!==Math.round(i*n)&&(s.width=Math.round(i*n),s.height=Math.round(i*n));const o=s.getContext("2d");o&&(o.setTransform(n,0,0,n,0,0),this.minimapFrame=dh(o,e,t.ctrl.pose(),t.ctrl.path,i,this.minimapPalette??=this.readMinimapPalette()))}readMinimapPalette(){const s=getComputedStyle(this),t=(i,n)=>s.getPropertyValue(`--sw-${i}`).trim()||n,e=t("accent","#2767ed");return{bg:t("surface-solid","#ffffff"),wall:t("map-structure","#56617a"),low:t("map-wall","#9aa3b5"),window:t("map-glass","#7fb2ff"),doorOpen:t("live","#22c55e"),doorClosed:t("danger","#ef4444"),object:t("text-3","#9aa3b5"),stair:t("text-2","#6b7f99"),room:hs(e,.07),path:t("live","#22c55e"),me:e,meRing:hs(e,.25)}}renderWalk(){return this.walkState!=="on"||!this.walk?F:R`
      <canvas class="minimap" data-walk-minimap role="img" aria-label="מפה קטנה של המפלס; לחיצה מעבירה לנקודה"
        @pointerdown=${s=>this.ui.minimapDown(s)} @pointermove=${s=>this.ui.minimapMove(s)}
        @pointerup=${s=>this.ui.minimapUp(s)} @pointercancel=${s=>this.ui.minimapUp(s)}></canvas>
      <span class="cross" ?data-aim=${!!this.walkAim} aria-hidden="true"></span>
      ${this.walkAim?R`<span class="pill aim" data-walk-aim>${this.labelOf(this.walkAim)} · Enter</span>`:F}
      ${this.walkNote?R`<span class="pill walknote" role="status" data-tone=${this.walkNote.tone} data-walk-note>${this.walkNote.text}</span>`:F}
      ${this.crossFloor?R`<span class="pill cross-floor" role="status" data-walk-cross=${this.crossFloor.id}>המדרגות ממשיכות ל${this.crossFloor.name??"קומה אחרת"}
            <sw-button size="lg" variant="ghost" data-walk-cross-go @click=${()=>this.dispatchEvent(new CustomEvent("floor-request",{detail:{floorId:this.crossFloor.id},bubbles:!0,composed:!0}))}>המשך לקומה</sw-button></span>`:F}
      <sw-walk-hud .starts=${this.description?.walk?.starts??Nh} .shown=${this.walkShown}
        @hud-exit=${()=>this.stopWalk(!0)} @hud-goto=${s=>this.ui.goto(s)} @hud-field=${s=>this.ui.field(s)} @hud-route=${s=>this.ui.routeToggle(s)}></sw-walk-hud>`}thumbFor(s){const t=this.thumbnailScene;if(!t||!this.view)return"";(this.thumbsFor!==t||this.thumbsQuality!==this.quality)&&(this.thumbs.clear(),this.thumbsFor=t,this.thumbsQuality=this.quality);const e=this.thumbs.get(s);return e===void 0&&this.scheduleThumbs(),e??""}scheduleThumbs(){this.thumbPass||this.pauseGate.paused||(this.thumbPass=requestAnimationFrame(()=>{this.thumbPass=0;const s=this.thumbnailScene,t=this.view;if(!s||!t||this.thumbsFor!==s)return;let e=!1;for(const i of this.levels){if(this.thumbs.has(i.id))continue;const n=t.renderThumbnail(s,i.id);n&&(this.thumbs.set(i.id,n),e=!0)}e&&t.redrawNow(),this.setAttribute("data-3d-thumbs",String(this.thumbs.size)),e&&this.requestUpdate()}))}get thumbnailCount(){return this.thumbs.size}toScreen(s){return this.view?.projectPoint(s)??null}capture(){return this.view?.capture()??null}captureControl(s){return vl(s,Xn,Kn,Hn,jn)}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const s=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(s)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${Uh(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(s){console.warn("sw-plan-3d: glTF export failed",s),this.showToast(Lh)}finally{this.exporting=!1}}}showToast(s){this.toast=s,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",$h)}renderStrip(){if(this.levels.length<2||!this.thumbnailScene||!this.ready)return F;const s=[...this.levels].sort((t,e)=>e.elevation_m-t.elevation_m||(t.id<e.id?-1:1));return this.thumbs=Tn(this.thumbs,s.map(t=>t.id)),R`<div class="strip" role="group" aria-label="מפלסים" data-3d-strip>
      ${s.map(t=>{const e=this.levelDots[t.id];return R`<button type="button" data-3d-thumb=${t.id} aria-pressed=${this.activeLevel===t.id?"true":"false"} title=${`${t.name} · ${t.elevation_m>=0?"+":"−"}${Math.abs(t.elevation_m).toFixed(1)} מ׳`} @click=${()=>this.pickLevel(t.id)}>
          <span class="pic"><img alt="" src=${this.thumbFor(t.id)} />${e&&(e.presence>0||e.open||e.lit)?R`<span class="dots" data-3d-dots=${t.id}>${e.presence>0?R`<i data-dot="presence" title="תנועה" style=${`--fade:${Math.max(.35,e.presence).toFixed(2)}`}></i>`:F}${e.open?R`<i data-dot="open" title="פתח פתוח"></i>`:F}${e.lit?R`<i data-dot="lit" title="תאורה דולקת"></i>`:F}</span>`:F}</span><span>${t.name}</span>
        </button>`})}
    </div>`}cornerKind(){return this.walkState==="on"?this.walk?"minimap":null:this.quality===3&&this.sunShown&&this.sunAt===null&&!this.kiosk?"pill":null}syncCorner(){const s=this.cornerKind();s!==this.cornerSent&&(this.cornerSent=s,s?this.setAttribute("data-corner",s):this.removeAttribute("data-corner"),this.dispatchEvent(new CustomEvent("hud-corner",{detail:{corner:s},bubbles:!0,composed:!0})))}renderTime(){const s=this.sunShown;if(!s||this.walkState==="on"||this.sunAt!==null)return F;const t=s.band==="day"?"☀":s.band==="night"?"☾":"◐",e=Yt(Date.now(),this.site.zone),i=this.timeManual?.ymd??[e.year,e.month,e.day],n=`${i[0]}-${String(i[1]).padStart(2,"0")}-${String(i[2]).padStart(2,"0")}`;return R`<div class="timepill" role="group" aria-label="שעה ביום" data-3d-time data-band=${s.band}>
        <button type="button" class="tp" aria-expanded=${this.timeOpen?"true":"false"} data-3d-time-toggle @click=${()=>this.timeOpen=!this.timeOpen}><span aria-hidden="true">${t}</span> <span class="hh" data-3d-time-label>${Cn(s.hour)}</span></button>
        ${this.timeManual?R`<button type="button" class="now" data-3d-time-now @click=${()=>this.timeNow()}>עכשיו</button>`:F}
      </div>
      ${this.timeOpen?R`<div class="timepop" data-3d-time-pop>
            <input type="range" min="0" max="24" step="0.25" aria-label="שעה ביום" data-3d-time-slider .value=${String(s.hour)} @input=${o=>this.setTimeHour(Number(o.target.value))} />
            <div class="row"><input type="date" lang=${zo()} aria-label="תאריך" data-3d-time-date .value=${n} @change=${o=>this.setTimeDate(o.target.value)} /><span>${$n[s.band]} · שמש ${s.elevation}°</span></div>
            ${this.site.known?F:R`<div class="muted" data-3d-site-default>מיקום האתר לא הוגדר: מרכז הארץ</div>`}
          </div>`:F}`}render(){const s=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,""),e=this.quality;return R`
      <div class="stage"></div>
      ${!this.ready&&!this.error?R`<div class="spinner" data-3d-spinner>טוען תלת-ממד…</div>`:F}
      ${this.error?R`<div class="spinner err" data-3d-error>${this.error}</div>`:F}
      ${this.overlays.length?R`<div class="overlay">${this.overlays.map(i=>i.kind==="label"?R`<span class="room" aria-hidden="true" data-3d-room=${i.userData.id} data-3d-part=${i.id}>${i.text??""}</span>`:i.kind==="chip"?R`<span class="chip" aria-hidden="true" data-3d-chip=${i.userData.id} data-3d-chip-part=${i.id} data-3d-part=${i.id}>${i.text??""}</span>`:R`<button type="button" class="lbl" tabindex="-1" data-3d-label=${i.userData.id} data-3d-part=${i.id} aria-pressed=${this.selectedId===i.userData.id?"true":"false"} style=${`--lbl: ${Ah(i.color)}`} @click=${()=>this.emitSelect({id:i.userData.id,kind:i.userData.kind,partId:i.id})}>${i.text??""}</button>`)}${this.hiddenPills?R`<span class="more" data-3d-more=${this.hiddenPills} title="ישויות ללא מצב מיוחד מוסתרות במבט הכללי; בחירה ברשימה או במפלס מציגה אותן">+${this.hiddenPills} ישויות</span>`:F}</div>`:F}
      ${this.renderStrip()}
      ${this.renderWalk()}
      <div class="bar" role="group" aria-label="תצוגות מוכנות" data-3d-bar>
        <sw-chip data-preset-top ?selected=${s==="top"} @click=${()=>this.pickPreset("top")}>מלמעלה</sw-chip>
        <sw-chip data-preset-iso ?selected=${s==="iso"} @click=${()=>this.pickPreset("iso")}>איזומטרי</sw-chip>
        <sw-chip data-preset-persp ?selected=${s==="persp"} @click=${()=>this.pickPreset("persp")}>פרספקטיבה</sw-chip>
        ${this.cameras.length?R`<select data-preset-camera aria-label="מבט מהמצלמה" .value=${t} @change=${i=>this.onCameraChange(i)}>
              <option value="">מבט מהמצלמה…</option>
              ${this.cameras.map(i=>R`<option value=${i.id} ?selected=${i.id===t}>${i.label}</option>`)}
            </select>`:F}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-auto title="אוטומטי: מתחיל ברמת ברירת המחדל ויורד רמה כשהמכשיר איטי" ?selected=${this.mode==="auto"} @click=${()=>this.setMode("auto")}>אוטומטי</sw-chip>
        <sw-chip data-quality-1 title="רמה סכמטית: חומרים שטוחים, בלי צללים" ?selected=${this.mode!=="auto"&&e===1} @click=${()=>this.setQuality(1)}>סכמטי</sw-chip>
        <sw-chip data-quality-2 title="רמה מלאה: צללים רכים, חומרים, חיתוך קירות" ?selected=${this.mode!=="auto"&&e===2} @click=${()=>this.setQuality(2)}>מלא</sw-chip>
        <sw-chip data-quality-3-lite title="ריאליסטי קל: חומרים אמיתיים, שמש ושמיים, בלי האפקטים הכבדים" ?selected=${this.mode==="lite"} @click=${()=>this.setMode("lite")}>ריאליסטי קל</sw-chip>
        <sw-chip data-quality-3 title="ריאליסטי: חומרים אמיתיים, שמש לפי שעה, הצללה עדינה וזכוכית" ?selected=${this.mode==="realistic"} @click=${()=>this.setMode("realistic")}>ריאליסטי</sw-chip>
        ${e<3?R`<sw-chip data-night-toggle title="מצב לילה: שמיים כהים, אור ירח, החדרים הדלוקים זוהרים" ?selected=${this.night} aria-pressed=${this.night} @click=${()=>this.setNight(!this.night)}>לילה</sw-chip>`:F}
        ${this.walkable?R`<sw-chip data-walk-btn title="סיור בגובה עין: W A S D או החצים להליכה, Shift לריצה, גרירה להסתכלות, לחיצה על הרצפה להליכה לשם, Esc ליציאה" ?selected=${this.walkState!=="off"} @click=${()=>this.requestWalk()}>${this.walkState==="requested"?"טוען סיור…":"סיור"}</sw-chip>`:F}
        <!-- ST7-odd: a surface like the chips beside it - a ghost control over the rendered picture faded into whatever lay behind it -->
        <sw-button size="sm" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?"מייצא…":"ייצוא glTF"}</sw-button>
      </div>
      ${Mh(this.ready&&!this.error,i=>this.view?.zoomBy(i))}
      ${this.description?.estimated?R`<div class="note" data-3d-estimated>≈ מידות משוערות (התוכנית לא כוילה)</div>`:F}
      ${this.fallback?R`<div class="note fb" role="status" data-3d-fallback>${Ih(this.rung)}</div>`:F}
      ${this.perfHint?R`<div class="pill hint" role="status" data-3d-low-fps=${this.perfHint}>התצוגה איטית במכשיר הזה
            <sw-button size="sm" variant="ghost" data-3d-low-fps-switch @click=${()=>this.setMode(this.perfHint)}>מעבר ל${Ke[this.perfHint]}</sw-button>
            <button type="button" class="x" aria-label="סגירה" data-3d-low-fps-close @click=${()=>this.perfHint=null}>×</button></div>`:F}
      ${e===3?this.renderTime():F}
      ${e===3?R`<div class="vignette" aria-hidden="true"></div>`:F}
      ${this.toast?R`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:F}
      ${this.hover?R`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:F}
      <div class="idle-still" data-idle-still ?data-on=${this.idle&&this.hasIdleStill} aria-hidden=${this.idle&&this.hasIdleStill?"false":"true"}><slot name="idle-still" @slotchange=${this.onIdleSlot}></slot></div>
    `}onCameraChange(s){const t=s.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};T.styles=[cs`
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
      /* PLAN3D-POLISH-2430: a faint ground glow under the building (the stage's lower middle) so the outer walls' outline reads
         against the night sky; the sky stays dark at the edges */
      background: radial-gradient(ellipse 60% 42% at 50% 60%, rgba(86, 116, 178, 0.34) 0%, rgba(86, 116, 178, 0) 100%), linear-gradient(180deg, #060b18 0%, #152442 100%);
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
    /* PLAN3D-REALISM-2432: the studio backdrop - a dark sky gradient with a soft glow behind the model */
    :host([data-quality='3'][data-backdrop='studio']) {
      background: radial-gradient(ellipse 95% 85% at 50% 44%, var(--sky-hor, #3a4a63) 0%, var(--sky-top, #1b2536) 62%, var(--sky-bot, #0d121b) 100%);
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
      inset-block-start: ${at}px;
      inset-inline-end: var(--hud-end, ${at}px);
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
      inset-block-start: ${oa-4}px;
      inset-inline-end: var(--hud-end, ${at}px);
      /* a menu: it opens over whatever stands under the pill (the host's circuit buttons, the level bar, the floor strip) and above all of it */
      z-index: calc(var(--sw-z-map-ui) + 1);
      display: grid;
      gap: 6px;
      box-sizing: border-box;
      inline-size: min(280px, calc(100% - 24px));
      max-inline-size: calc(100% - var(--hud-end, ${at}px) - ${at}px);
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
    .lbl,
    .room {
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
    /* PLAN3D-POLISH-2430: a room's name plate - one step larger than the chips and the pills, the body ink on the opaque menu
       surface (readable in both themes, over the day and the night picture), never a target (a click goes to the room under it) */
    .room {
      padding: 2px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: 600;
      color: var(--sw-text);
    }
    :host([data-night]:not([data-quality='3'])) .room {
      background: #0f1729;
      border-color: #33456b;
      color: #e8eefb;
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
      left: calc(50% + (var(--hud-end, ${at}px) - ${at}px) / 2); /* physical: centred whatever the direction - in the free band, past a docked list of the host */
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
      inset-block-start: ${at}px;
      inset-inline-start: var(--hud-end, ${at}px);
      inline-size: ${Fs}px;
      block-size: ${Fs}px;
      border-radius: 10px;
      box-shadow: var(--sw-shadow-1);
      cursor: pointer;
      z-index: var(--sw-z-map-ui);
      touch-action: none;
    }
    .pill {
      position: absolute;
      left: calc(50% + (var(--hud-end, ${at}px) - ${at}px) / 2); /* the free band's centre: past a docked list of the host */
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
    @media (max-width: ${ia}px) {
      .minimap {
        inline-size: ${Os}px;
        block-size: ${Os}px;
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
  `,xh];D([O({attribute:!1})],T.prototype,"description",2);D([O()],T.prototype,"selectedId",2);D([O({attribute:!1})],T.prototype,"preset",2);D([O()],T.prototype,"frameKey",2);D([O({attribute:!1})],T.prototype,"cameras",2);D([O({attribute:!1})],T.prototype,"labels",2);D([O()],T.prototype,"exportName",2);D([O({attribute:!1,hasChanged:(s,t)=>!So(s,t)})],T.prototype,"levels",2);D([O()],T.prototype,"activeLevel",2);D([O({attribute:!1})],T.prototype,"thumbnailScene",2);D([O({attribute:!1,hasChanged:(s,t)=>!Ao(s,t)})],T.prototype,"levelDots",2);D([O({attribute:!1})],T.prototype,"qualityDefault",2);D([O({type:Number})],T.prototype,"minFps",2);D([O({type:Boolean,reflect:!0,attribute:"data-measure"})],T.prototype,"continuous",2);D([O({type:Boolean})],T.prototype,"walkable",2);D([O({type:Boolean})],T.prototype,"stillsAvailable",2);D([O({type:Number})],T.prototype,"idleS",2);D([O()],T.prototype,"changeKey",2);D([O({attribute:!1})],T.prototype,"qualityForce",2);D([O({type:Boolean,reflect:!0})],T.prototype,"kiosk",2);D([O({attribute:!1})],T.prototype,"themeForce",2);D([O({attribute:!1})],T.prototype,"backdrop",2);D([O({reflect:!0,attribute:"data-backdrop"})],T.prototype,"shownBackdrop",2);D([O({attribute:!1})],T.prototype,"sunAt",2);D([q()],T.prototype,"walkState",2);D([q()],T.prototype,"walkShown",2);D([q()],T.prototype,"walkAim",2);D([q()],T.prototype,"walkNote",2);D([q()],T.prototype,"crossFloor",2);D([q()],T.prototype,"idle",2);D([q()],T.prototype,"hasIdleStill",2);D([q()],T.prototype,"hover",2);D([q()],T.prototype,"ready",2);D([q()],T.prototype,"exporting",2);D([q()],T.prototype,"error",2);D([q()],T.prototype,"toast",2);D([q()],T.prototype,"chosen",2);D([q()],T.prototype,"gpu",2);D([q()],T.prototype,"installMode",2);D([q()],T.prototype,"fallbackRung",2);D([q()],T.prototype,"perfHint",2);D([q()],T.prototype,"walkDrop",2);D([q()],T.prototype,"dialsReady",2);D([q()],T.prototype,"timeManual",2);D([q()],T.prototype,"timeOpen",2);D([q()],T.prototype,"sunShown",2);D([q()],T.prototype,"night",2);D([To(".stage")],T.prototype,"stage",2);D([O({type:Number})],T.prototype,"routeDwellMs",2);T=D([Xi("sw-plan-3d")],T);const lc=Object.freeze(Object.defineProperty({__proto__:null,DEFAULT_MIN_FPS:Mo,FALLBACK_KEY:Wt,NIGHT_KEY:ls,PILL_CAP:Ji,PROBE_FALLBACK_MS:wo,PROBE_FIRST_FRAME_MS:go,PROBE_MS:ke,PROBE_WARM_FRAMES:vo,QUALITY_KEY:sa,SETTINGS_WAIT_MS:ss,SceneStillRenderer:Ph,get SwPlan3d(){return T},WALK_ACT_M:be,WALK_FOV:ve,WALK_GUARD_KEY:ge,encodePng:zh,sameDots:Ao,sameLevels:So,twinStart:_o,withAlpha:hs},Symbol.toStringTag,{value:"Module"}));export{ir as R,rc as S,ac as a,nc as b,lc as s};
//# sourceMappingURL=sw-plan-3d-CuuHU795.js.map
