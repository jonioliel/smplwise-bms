const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{t as A}from"./map-DIVHt38h.js";import{_ as Xo,g as Pe,ay as O,j as G,i as fo,A as C,ex as Q,b as T,k as mo,p as Vo,ei as Yo,e1 as Zo}from"./index-BiEy1mLY.js";import"./sw-chip-BQ9CHl2g.js";import{r as X,co as dt,cp as ee,t as Ts}from"./shared-space-Da3pEjYM.js";import{G as ft,C as et,M as q,B as at,z as tt,n as mt,E as Ct,m as Ls,I as Ce,J as xs,V as kt,K as $e,P as Lt,Q as Ds,Z as Qo,e as Jo,A as tn,f as en,a as N,X as sn,Y as on,l as wo,L as ss,_ as nn,R as Tt,$ as Zt,a0 as Rs,D as an,k as rn,a1 as ln,a2 as Dt,F as gt,a3 as Qt,b as ot,a4 as ze,a5 as vt,a6 as bt,a7 as ht,a8 as Me,a9 as hn,aa as go,ab as vo,ac as Is,ad as bo,ae as is,af as cn,ag as dn,ah as un,O as Cs,ai as pn,aj as fn,ak as mn,al as Fs,am as wn,an as gn,ao as st,ap as Bt,aq as _t,ar as vn,v as bn,as as yn,x as kn,at as xn,au as Mn,av as Sn,aw as Os,ax as An,ay as _n}from"./three-DDbvttH0.js";import{N as Ns,k as Pn,m as Bs,o as $n,p as qs,q as Hs,r as zn,P as se,t as En,u as Us,I as Pt,v as Tn,w as Ln,x as Dn,C as Fe,y as Rn,l as In,S as Cn,c as Fn,z as On,A as Nn,B as Bn,D as Ws,E as qn,F as yo}from"./still-bake-CO7rou9p.js";import{M as Hn}from"./material-resolve-CPTkio5k.js";import{L as j,t as Un,P as Wn,m as Gn,M as jn,S as Gs,d as Kn,s as Xn,D as Vn,k as Yn}from"./scene-builder-D3-ObELs.js";import{k as ko,D as js,l as Ks,a as Zn,s as Qn,p as Xs,r as Oe,b as qt,m as Jn,c as ta,t as ea,h as sa,T as ia}from"./sun-CNQRe6EW.js";import{o as Ms,O as oa,h as xo}from"./lightmap-bake-fElBDDra.js";import{D as na,p as aa,a as ie,b as oe,c as ra,d as la,e as Vs,r as ha,l as ca,n as Ys,R as os}from"./quality-ladder-L2mQ8k40.js";import{D as Ne,p as da,i as ua,j as pa,k as fa,l as ma}from"./plan-view-B455B6Na.js";import{d as wa,W as ga}from"./webgl-BRgkjlE6.js";import{F as va,r as ba}from"./quality-mode-BOXrAc_5.js";import{c as ya,l as ka,s as xa,Q as Ma}from"./plan-quality-BE9bZD9p.js";import{D as Mo,m as Sa,o as Aa,q as _a,r as Zs,t as Pa,u as $a,v as za,w as Ea,H as lt,j as Qs,d as Ta,k as Js,b as La}from"./hud-layout-DL7PXjw3.js";function So(s,t,e=[0,0,0]){const i=s.length/3,n=new Float32Array(i*2),o=t>0?t:1;for(let a=0;a+2<i;a+=3){const r=a*3,l=s[r+3]-s[r],h=s[r+4]-s[r+1],c=s[r+5]-s[r+2],u=s[r+6]-s[r],d=s[r+7]-s[r+1],p=s[r+8]-s[r+2],m=Math.abs(h*p-c*d),w=Math.abs(c*u-l*p),v=Math.abs(l*d-h*u);for(let g=0;g<3;g++){const z=r+g*3,k=s[z]+e[0],P=s[z+1]+e[1],E=s[z+2]+e[2];let _,$;m>=w&&m>=v?(_=E,$=P):w>=v?(_=k,$=E):(_=k,$=P),n[(a+g)*2]=_/o,n[(a+g)*2+1]=$/o}}return n}function Da(s,t,e){if(!t)return Float32Array.from(s);const i=new Float32Array(t.length*e);for(let n=0;n<t.length;n++)for(let o=0;o<e;o++)i[n*e+o]=s[t[n]*e+o];return i}function Ra(s,t){const e=t*9,i=s[e+3]-s[e],n=s[e+4]-s[e+1],o=s[e+5]-s[e+2],a=s[e+6]-s[e],r=s[e+7]-s[e+1],l=s[e+8]-s[e+2],h=n*l-o*r,c=o*a-i*l,u=i*r-n*a,d=Math.hypot(h,c,u)||1;return[h/d,c/d,u/d]}function Ia(s,t){const e=Math.floor(s.length/9),i=Array.from({length:e},(l,h)=>Ra(s,h)),n=l=>`${Math.round(s[l*3]*1e4)},${Math.round(s[l*3+1]*1e4)},${Math.round(s[l*3+2]*1e4)}`,o=new Map;for(let l=0;l<e*3;l++){const h=n(l),c=o.get(h);c?c.push(Math.floor(l/3)):o.set(h,[Math.floor(l/3)])}const a=Math.cos(t),r=new Float32Array(e*9);for(let l=0;l<e*3;l++){const h=i[Math.floor(l/3)];let c=0,u=0,d=0;for(const m of o.get(n(l))??[]){const w=i[m];w[0]*h[0]+w[1]*h[1]+w[2]*h[2]>=a&&(c+=w[0],u+=w[1],d+=w[2])}const p=Math.hypot(c,u,d);if(!(p>1e-9)){r[l*3+1]=1;continue}r[l*3]=c/p,r[l*3+1]=u/p,r[l*3+2]=d/p}return r}const Ca=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];function Fa(s,t){const e=new Array(16).fill(0);for(let i=0;i<4;i++)for(let n=0;n<4;n++)for(let o=0;o<4;o++)e[i*4+n]+=s[o*4+n]*t[i*4+o];return e}function Oa(s,t,e){const[i,n,o,a]=t,[r,l,h]=e;return[(1-2*(n*n+o*o))*r,2*(i*n+o*a)*r,2*(i*o-n*a)*r,0,2*(i*n-o*a)*l,(1-2*(i*i+o*o))*l,2*(n*o+i*a)*l,0,2*(i*o+n*a)*h,2*(n*o-i*a)*h,(1-2*(i*i+n*n))*h,0,s[0],s[1],s[2],1]}function Na(s,t,e,i){return[s[0]*t+s[4]*e+s[8]*i+s[12],s[1]*t+s[5]*e+s[9]*i+s[13],s[2]*t+s[6]*e+s[10]*i+s[14]]}const Ba={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};function qa(s){const t=new DataView(s);if(t.getUint32(0,!0)!==1179937895)throw new Error("not a GLB");let e=12,i=null,n=null;for(;e+8<=s.byteLength;){const p=t.getUint32(e,!0),m=t.getUint32(e+4,!0);m===1313821514?i=JSON.parse(new TextDecoder().decode(new Uint8Array(s,e+8,p))):m===5130562&&(n=new DataView(s,e+8,p)),e+=8+p}if(!i||!n)throw new Error("GLB without JSON or BIN");const o=i,a=n,r=p=>{const m=o.accessors[p],w=o.bufferViews[m.bufferView],v=Ba[m.type]??1,g=m.componentType===5126||m.componentType===5125?4:m.componentType===5123||m.componentType===5122?2:1,z=w.byteStride||v*g,k=(w.byteOffset??0)+(m.byteOffset??0),P=[];for(let E=0;E<m.count;E++)for(let _=0;_<v;_++){const $=k+E*z+_*g;P.push(m.componentType===5126?a.getFloat32($,!0):m.componentType===5125?a.getUint32($,!0):m.componentType===5123?a.getUint16($,!0):m.componentType===5122?a.getInt16($,!0):a.getUint8($))}return P},l=[],h=[1/0,1/0,1/0],c=[-1/0,-1/0,-1/0],u=(p,m)=>{const w=o.nodes[p],v=w.matrix&&w.matrix.length===16?w.matrix:Oa(w.translation??[0,0,0],w.rotation??[0,0,0,1],w.scale??[1,1,1]),g=Fa(m,v);if(w.mesh!==void 0)for(const z of o.meshes[w.mesh].primitives){if((z.mode??4)!==4||z.attributes.POSITION===void 0)continue;const k=r(z.attributes.POSITION),P=z.indices!==void 0?r(z.indices):null,E=Da(k,P,3);for(let _=0;_<E.length;_+=3){const $=Na(g,E[_],E[_+1],E[_+2]);E[_]=$[0],E[_+1]=$[1],E[_+2]=$[2];for(let f=0;f<3;f++)h[f]=Math.min(h[f],$[f]),c[f]=Math.max(c[f],$[f])}l.push({positions:E,material:(z.material!==void 0?o.materials?.[z.material]?.name:"")??""})}for(const z of w.children??[])u(z,g)},d=o.scenes?.[o.scene??0]?.nodes??o.nodes.map((p,m)=>m);for(const p of d)u(p,Ca);if(!l.length)throw new Error("GLB without triangles");return{primitives:l,min:h,max:c}}function Ha(s,t,e,i,n){const o=t[0]-s[0]>1e-6?e/(t[0]-s[0]):1,a=t[1]-s[1]>1e-6?i/(t[1]-s[1]):1,r=t[2]-s[2]>1e-6?n/(t[2]-s[2]):1,l=Math.min(o,a,r);return{scale:[Math.min(o,l*1.15),Math.min(a,l*1.15),Math.min(r,l*1.15)],offset:[-(s[0]+t[0])/2,-s[1],-(s[2]+t[2])/2]}}function Ua(s,t){const e=Math.sin(s*12.9898+t*78.233)*43758.5453;return 1+((e-Math.floor(e))*.1-.05)}const Wa=.75,Ga=.36,ja=.14,Ka=.55,Xa=.05,Va=.07,Ss={marks:"bar_edge",light:"bar",alarm:"pulse"};function ti(s){return(s.alarm??0)>.001?"alarm":s.presence>.001?"presence":s.lit>.001?"light":null}function Ya(s,t){return s?s==="light"?{bar:t.light!=="none",line:t.light==="bar_floor",floor:!1}:t.marks==="floor"?{bar:!1,line:!1,floor:!0}:t.marks==="bar"?{bar:!0,line:!1,floor:!1}:{bar:!0,line:!0,floor:!0}:{bar:!1,line:!1,floor:!1}}function Za(s,t){return t?.72+.28*Math.sin(s/1400*Math.PI*2):1}function ei(s,t,e){const i=s.y+s.ceiling;return t!==null&&e===s.level_id?Math.min(i,t):i}const Qa=1.5,Ja={floor:1.5,wall:1.3,pendant:1.7},J=s=>Math.round(s*1e4)/1e4;function ns(s){let t=0;for(let e=0;e<s.length;e++)t+=s[e][0]*s[(e+1)%s.length][1]-s[(e+1)%s.length][0]*s[e][1];return t/2}function Ht(s,t){const e=s.length>2&&s[0][0]===s[s.length-1][0]&&s[0][1]===s[s.length-1][1]?s.slice(0,-1):s.slice(),i=e.length;if(i<3)return[];const n=ns(e);if(Math.abs(n)<1e-6)return[];const o=n>0?e:[...e].reverse();if(!(t>0))return o.map(([h,c])=>[J(h),J(c)]);const a=(h,c)=>{const u=c[0]-h[0],d=c[1]-h[1],p=Math.hypot(u,d)||1;return[-d/p,u/p]},r=[];for(let h=0;h<i;h++){const c=a(o[(h+i-1)%i],o[h]),u=a(o[h],o[(h+1)%i]),d=1+c[0]*u[0]+c[1]*u[1],p=d>1e-6?Math.min(t/d,2.5*t):2.5*t;r.push([J(o[h][0]+(c[0]+u[0])*p),J(o[h][1]+(c[1]+u[1])*p)])}const l=ns(r);if(!(l>0)||l>n*Math.sign(n))return[];for(let h=0;h<i;h++){const c=[o[(h+1)%i][0]-o[h][0],o[(h+1)%i][1]-o[h][1]],u=[r[(h+1)%i][0]-r[h][0],r[(h+1)%i][1]-r[h][1]];if(c[0]*u[0]+c[1]*u[1]<=0&&Math.hypot(c[0],c[1])>2*t)return[]}return r}function Ao(s,t,e){let i=!1;for(let n=0,o=e.length-1;n<e.length;o=n++){const[a,r]=e[n],[l,h]=e[o];r>t!=h>t&&s<(l-a)*(t-r)/(h-r||1e-12)+a&&(i=!i)}return i}function tr(s){let t=0,e=0,i=0;for(let n=0;n<s.length;n++){const[o,a]=s[n],[r,l]=s[(n+1)%s.length],h=o*l-r*a;t+=h,e+=(o+r)*h,i+=(a+l)*h}return Math.abs(t)<1e-9?[s.reduce((n,o)=>n+o[0],0)/Math.max(1,s.length),s.reduce((n,o)=>n+o[1],0)/Math.max(1,s.length)]:[e/(3*t),i/(3*t)]}function er(s,t){const e=s.map(u=>u[0]),i=s.map(u=>u[1]),n=Math.max(Math.max(...e)-Math.min(...e),Math.max(...i)-Math.min(...i)),o=Math.abs(ns(s)),[a,r]=tr(s),l=t.filter(u=>u.on&&Ao(u.position[0],u.position[2],s)).sort((u,d)=>u.id<d.id?-1:1),h=[{x:J(a),z:J(r),r:J(Math.max(1.6,n*.78)),w:l.length?.45:.9}],c=Math.min(3.2,Math.max(1.4,Math.sqrt(o)*.6));for(const u of l.slice(0,6))h.push({x:J(u.position[0]),z:J(u.position[2]),r:J(Ja[u.kind]??c),w:J(Math.min(1.4,Math.max(.6,Math.sqrt(u.lumens/1e3))))});return h}function si(s,t,e){let i=0;for(const n of e){const o=Math.hypot(s-n.x,t-n.z)/n.r;i=Math.max(i,n.w*Math.exp(-2.2*o*o))}return i}function sr(s,t,e){const i=new Map;for(const a of s){if(a.kind!=="tint"||!a.id.startsWith("room:"))continue;const r=a.id.lastIndexOf("#");if(r<0)continue;const l=a.userData?.id??a.id.slice(5,r),h=a.id.slice(r+1);if(h!=="lit"&&h!=="presence"&&h!=="presence-ring"&&h!=="alarm")continue;const c=i.get(l)??{lit:!1,presence:0,alarm:!1,polygon:null,level:a.level_id??""};h==="alarm"?(c.alarm=!0,c.polygon=a.polygon??c.polygon):h==="lit"?(c.lit=!0,c.polygon=a.polygon??c.polygon):h==="presence"?(c.presence=Math.max(c.presence,a.opacity/Ga),c.polygon??=a.polygon??null):c.presence=Math.max(c.presence,a.opacity/Wa),i.set(l,c)}const n=new Map(t.map(a=>[a.id,a])),o=[];for(const[a,r]of[...i].sort((l,h)=>l[0]<h[0]?-1:1)){if(!r.polygon||r.polygon.length<3)continue;const l=Ht(r.polygon,0),h=Ht(r.polygon,ja);if(!h.length||!l.length)continue;const c=n.get(r.level),u=e.filter(m=>m.level_id===r.level),d=u.filter(m=>m.on&&Ao(m.position[0],m.position[2],h)),p=c?.ceiling_height_m??2.8;o.push({zone:a,level_id:r.level,y:c?.elevation_m??0,polygon:h,band:Ht(h,Ka),pools:er(h,u),color_k:d.length?Math.round(d.reduce((m,w)=>m+w.color_k,0)/d.length):2900,wash:J(Math.min(Qa,p*.6-.12)),lit:r.lit?1:0,presence:J(Math.max(0,Math.min(1,r.presence))),alarm:r.alarm?1:0,outline:l,barInner:Ht(l,Xa),lineInner:Ht(h,Va),ceiling:p})}return o}function ir(s,t=.4){const e=[],i=s.polygon;for(let n=0;n<i.length;n++){const o=i[n],a=i[(n+1)%i.length],r=Math.hypot(a[0]-o[0],a[1]-o[1]),l=Math.max(1,Math.ceil(r/t));for(let h=0;h<l;h++){const c=h/l,u=(h+1)/l,d=[o[0]+(a[0]-o[0])*c,o[1]+(a[1]-o[1])*c],p=[o[0]+(a[0]-o[0])*u,o[1]+(a[1]-o[1])*u];e.push({a:d,b:p,sa:J(Math.min(1,.3+.7*si(d[0],d[1],s.pools))),sb:J(Math.min(1,.3+.7*si(p[0],p[1],s.pools)))})}}return e}function ii(s,t){const e=Math.max(0,Math.min(1,t)),i=s==="dark"?1.15:1,n=(o,a)=>J((o+(a-o)*e)*i);return{floor:n(.35,1.3),wall:n(.1,.36),presFloor:n(.05,.07),presEdge:n(.3,.42),presWall:n(.1,.16)}}const or=450,As=.014;let oi=null,Be=null,qe=null;function _s(s,t,e){const i=document.createElement("canvas");i.width=s,i.height=t;const n=i.getContext("2d");n&&e(n);const o=new $e(i);return o.wrapS=Lt,o.wrapT=Lt,o}function nr(){return oi??=_s(128,128,s=>{const t=s.createRadialGradient(64,64,0,64,64,64);for(let e=0;e<=10;e++){const i=e/10;t.addColorStop(i,`rgba(255,255,255,${Math.exp(-3.2*i*i)*(1-i*i)})`)}s.fillStyle=t,s.fillRect(0,0,128,128)}),oi}function ni(){return Be||(Be=_s(4,64,s=>{const t=s.createLinearGradient(0,64,0,0);t.addColorStop(0,"rgba(255,255,255,0.75)"),t.addColorStop(.22,"rgba(255,255,255,1)"),t.addColorStop(.6,"rgba(255,255,255,0.4)"),t.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=t,s.fillRect(0,0,4,64)})),Be}function ai(){return qe||(qe=_s(4,64,s=>{const t=s.createLinearGradient(0,64,0,0);t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.3,"rgba(255,255,255,0.45)"),t.addColorStop(1,"rgba(255,255,255,0)"),s.fillStyle=t,s.fillRect(0,0,4,64)})),qe}function ar(s){return xs.triangulateShape(s.map(([e,i])=>new kt(e,i)),[]).map(([e,i,n])=>[s[e],s[i],s[n]])}function He(s,t){const e=ar(s.polygon),i=[],n=[],o=[],a=s.y+As,r=t?s.pools:[{x:0,z:0,r:1e9,w:1}];for(const h of r)for(const c of e)for(const u of[c[0],c[2],c[1]])i.push(u[0],a,u[1]),n.push(t?(u[0]-h.x)/(2*h.r)+.5:.5,t?(u[1]-h.z)/(2*h.r)+.5:.5),o.push(Math.min(1,h.w),Math.min(1,h.w),Math.min(1,h.w));const l=new at;return l.setAttribute("position",new tt(new Float32Array(i),3)),l.setAttribute("uv",new tt(new Float32Array(n),2)),l.setAttribute("color",new tt(new Float32Array(o),3)),l.computeBoundingSphere(),l}function rr(s){const t=[],e=[],i=[],n=s.y+.01,o=s.y+s.wash;for(const r of ir(s)){const l=[r.a[0],n,r.a[1]],h=[r.b[0],n,r.b[1]],c=[r.b[0],o,r.b[1]],u=[r.a[0],o,r.a[1]];t.push(...l,...h,...c,...l,...c,...u),e.push(0,0,1,0,1,1,0,0,1,1,0,1);for(const d of[r.sa,r.sb,r.sb,r.sa,r.sb,r.sa])i.push(d,d,d)}const a=new at;return a.setAttribute("position",new tt(new Float32Array(t),3)),a.setAttribute("uv",new tt(new Float32Array(e),2)),a.setAttribute("color",new tt(new Float32Array(i),3)),a.computeBoundingSphere(),a}function ri(s){const t=s.polygon,e=s.band;if(e.length!==t.length)return null;const i=[],n=[],o=s.y+As+.002;for(let r=0;r<t.length;r++){const l=(r+1)%t.length,h=Math.hypot(t[l][0]-t[r][0],t[l][1]-t[r][1]);i.push(t[r][0],o,t[r][1],e[l][0],o,e[l][1],t[l][0],o,t[l][1],t[r][0],o,t[r][1],e[r][0],o,e[r][1],e[l][0],o,e[l][1]),n.push(0,0,h,1,h,0,0,0,0,1,h,1)}const a=new at;return a.setAttribute("position",new tt(new Float32Array(i),3)),a.setAttribute("uv",new tt(new Float32Array(n),2)),a.computeBoundingSphere(),a}function li(s,t,e){if(s.length<3||t.length!==s.length)return null;const i=[];for(let o=0;o<s.length;o++){const a=(o+1)%s.length,r=s,l=t;i.push(r[o][0],e,r[o][1],l[a][0],e,l[a][1],r[a][0],e,r[a][1],r[o][0],e,r[o][1],l[o][0],e,l[o][1],l[a][0],e,l[a][1])}const n=new at;return n.setAttribute("position",new tt(new Float32Array(i),3)),n.computeBoundingSphere(),n}const lr={light:15769648,dark:16758087};function hi(s,t){const e=j[t].states;return s==="alarm"?e.open_door:s==="presence"?e.presence:lr[t]}const hr=()=>typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,$t=s=>new mt({transparent:!0,depthWrite:!1,fog:!1,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2,side:Ct,...s});class cr{constructor(t,e,i,n=null,o=0,a=Ss){this.root=new ft,this.entries=new Map,this.clip=null,this.pulse=1,this.root.name="room-glow",this.style=e,this.night=i,this.marks=a,this.look=ii(e,i);const r=new Set;for(const l of t){r.add(l.zone);const h=n?.get(l.zone),c=h?{lit:h.lit,presence:h.presence}:n?{lit:0,presence:0}:{lit:l.lit,presence:l.presence};this.add(l,c,{lit:l.lit,presence:l.presence},o)}if(n)for(const[l,h]of[...n].sort((c,u)=>c[0]<u[0]?-1:1))!r.has(l)&&(h.lit>.001||h.presence>.001)&&this.add({...h.room,alarm:0},{lit:h.lit,presence:h.presence},{lit:0,presence:0},o);this.apply()}add(t,e,i,n){const o=ti({alarm:t.alarm,presence:i.presence,lit:i.lit})??ti({presence:e.presence,lit:e.lit}),a=Ya(o,this.marks),r={room:t,cur:{...e},from:{...e},to:{...i},t0:n,mark:o,layers:a,meshes:{}},l=new et(...ko(t.color_k)),h=new et(j[this.style].states.presence),c=e.lit>0||i.lit>0,u=(e.presence>0||i.presence>0)&&this.marks.marks!=="bar",d=(m,w,v)=>(m.name=`glow:${t.zone}#${w}`,m.renderOrder=v,m.userData={ownMaterial:!0,skipAO:!0,glow:w,zone:t.zone,level:t.level_id},m.frustumCulled=!0,this.root.add(m),m);let p=null;if((c||u)&&(p=rr(t)),c&&(r.meshes.litFloor=d(new q(He(t,!0),$t({map:nr(),color:l,vertexColors:!0,blending:en,blendEquation:tn,blendSrc:Jo,blendDst:Ds,blendSrcAlpha:Qo,blendDstAlpha:Ds,premultipliedAlpha:!0})),"lit-floor",3),r.meshes.litWall=d(new q(p,$t({map:ni(),color:l,vertexColors:!0,blending:Ls})),"lit-wall",3)),u){r.meshes.presFill=d(new q(He(t,!1),$t({color:h,blending:Ce})),"pres-fill",2);const m=ri(t);m&&(r.meshes.presEdge=d(new q(m,$t({map:ai(),color:h,blending:Ce})),"pres-edge",2));const w=d(new q(p,$t({map:ni(),color:h,blending:Ls})),"pres-wall",3);r.meshes.presWall=w,c&&(w.userData.sharedGeometry=!0)}if(o){const m=hi(o,this.style),w=v=>$t({color:m,toneMapped:!1,blending:Ce,...v});if(a.bar){const v=li(t.outline,t.barInner,0);if(v){const g=d(new q(v,w({})),"mark-bar",5);g.position.y=ei(t,null,null)+.006,r.meshes.markBar=g}}if(a.line){const v=li(t.polygon,t.lineInner,t.y+As+.004);v&&(r.meshes.markLine=d(new q(v,w({})),"mark-line",4))}if(o==="alarm"&&a.floor){this.marks.marks==="floor"&&(r.meshes.alarmFill=d(new q(He(t,!1),w({})),"alarm-fill",2));const v=ri(t);v&&(r.meshes.alarmBand=d(new q(v,w({map:ai()})),"alarm-band",3))}}this.entries.set(t.zone,r)}setCut(t,e){for(const i of this.entries.values())i.meshes.markBar&&(i.meshes.markBar.position.y=ei(i.room,t,e)+.006)}pulsing(t){if(!t||this.marks.alarm!=="pulse"||hr())return!1;for(const e of this.entries.values())if(e.mark==="alarm")return!0;return!1}apply(){const t=this.look;for(const e of this.entries.values()){const i=(o,a)=>{if(!o)return;const r=o.material;r.opacity=a,o.visible=a>.002};i(e.meshes.litFloor,t.floor*e.cur.lit),i(e.meshes.litWall,t.wall*e.cur.lit),i(e.meshes.presFill,t.presFloor*e.cur.presence*(1-e.cur.lit)),i(e.meshes.presEdge,t.presEdge*e.cur.presence),i(e.meshes.presWall,t.presWall*e.cur.presence);const n=e.mark==="alarm"?this.pulse:e.mark==="presence"?e.cur.presence:e.mark==="light"?e.cur.lit*(1-.5*Math.max(0,Math.min(1,this.night))):0;i(e.meshes.markBar,(e.mark==="light"?.85:.95)*n),i(e.meshes.markLine,(e.mark==="light"?.6:.85)*n),i(e.meshes.alarmBand,.5*n),i(e.meshes.alarmFill,.22*n)}}setLook(t,e){if(this.look=ii(t,e),this.night=e,t!==this.style){this.style=t;const i=j[t].states.presence;for(const n of this.entries.values()){for(const o of[n.meshes.presFill,n.meshes.presEdge,n.meshes.presWall])o?.material?.color.setHex(i);if(n.mark)for(const o of[n.meshes.markBar,n.meshes.markLine,n.meshes.alarmBand,n.meshes.alarmFill])o?.material?.color.setHex(hi(n.mark,t))}}this.apply()}setClip(t){this.clip=t;for(const e of this.entries.values())for(const i of[e.meshes.litWall,e.meshes.presWall])i&&(i.material.clippingPlanes=t)}get clipPlanes(){return this.clip}updateWeights(t){for(const e of t){const i=this.entries.get(e.zone);i&&(i.to={lit:e.lit,presence:e.presence},i.cur={...i.to},i.from={...i.to})}this.apply()}tick(t,e=!0){const i=this.pulsing(e);this.pulse=Za(t,i);let n=i;for(const o of this.entries.values()){if(o.cur.lit===o.to.lit&&o.cur.presence===o.to.presence)continue;const a=e?Math.min(1,Math.max(0,(t-o.t0)/or)):1,r=a<.5?2*a*a:1-Math.pow(-2*a+2,2)/2;o.cur={lit:o.from.lit+(o.to.lit-o.from.lit)*r,presence:o.from.presence+(o.to.presence-o.from.presence)*r},a<1?n=!0:o.cur={...o.to}}return this.apply(),n}state(){return new Map([...this.entries].map(([t,e])=>[t,{room:e.room,lit:e.cur.lit,presence:e.cur.presence}]))}stats(){let t=0,e=0;return this.root.traverse(i=>{i.isMesh&&(t++,i.visible&&e++)}),{rooms:this.entries.size,meshes:t,visible:e}}dispose(){this.root.traverse(t=>{const e=t;e.isMesh&&(e.userData.sharedGeometry||e.geometry.dispose(),e.material.dispose())}),this.root.clear(),this.entries.clear()}}const ci="aovol-1",Ps=24,wt=1.1,as=.2,rs=128,dr=64,_o=.12,ne=.4,ur=new Set(["wall","lintel","sill","head","object","connector"]),it=s=>Math.round(s*1e4)/1e4;function pr(s){const t=new Set(s.levels.map(n=>n.id)),e=s.parts.filter(n=>n.level_id!==null&&t.has(n.level_id)&&ur.has(n.kind)&&Ms(n)!==null).map(n=>({level_id:n.level_id,kind:n.kind,shape:n.shape,position:n.position,size:n.size,rotation:n.rotation,opacity:n.opacity}));return{levels:s.levels.map(n=>({id:n.id,elevation_m:n.elevation_m,ceiling_height_m:n.ceiling_height_m})),parts:e}}function Po(s){const t=[ci,String(Ps),String(wt),String(as),String(rs)];for(const o of s.levels)t.push(`L${o.id}:${it(o.elevation_m)}:${it(o.ceiling_height_m)}`);for(const o of s.parts)t.push(`${o.level_id}|${o.kind}|${o.shape}|${o.position.map(it).join(",")}|${o.size.map(it).join(",")}|${it(o.rotation[1])}`);const e=t.join(";");let i=2166136261,n=1523705862;for(let o=0;o<e.length;o++){const a=e.charCodeAt(o);i=Math.imul(i^a,16777619)>>>0,n=Math.imul(n^a,16777621)>>>0}return`${ci}:${i.toString(16).padStart(8,"0")}${n.toString(16).padStart(8,"0")}:${s.parts.length}`}function fr(s){if(!s.levels.length)return null;const t=s.parts.map(p=>Ms(p)).filter(p=>p!==null);if(!t.length)return null;let e=1/0,i=-1/0,n=1/0,o=-1/0;for(const p of t)e=Math.min(e,p.minX),i=Math.max(i,p.maxX),n=Math.min(n,p.minZ),o=Math.max(o,p.maxZ);e-=ne,n-=ne,i+=ne,o+=ne;const a=Math.min(...s.levels.map(p=>p.elevation_m)),r=Math.max(...s.levels.map(p=>p.elevation_m+p.ceiling_height_m)),l=Math.max(as,(i-e)/rs,(o-n)/rs),h=Math.max(as,(r-a)/dr),c=Math.max(2,Math.ceil((i-e)/l)),u=Math.max(2,Math.ceil((o-n)/l)),d=Math.max(2,Math.ceil((r-a)/h));return{origin:[it(e),it(a),it(n)],texel:[it(l),it(h)],dims:[c,d,u],size:[it(c*l),it(d*h),it(u*l)]}}function mr(s=xo(Ps)){let t=0;for(const e of s){if(e[0]>=0)continue;const i=_o/-e[0];i<wt&&(t+=1-i/wt)}return 1-t/s.length}async function wr(s,t={}){const e=fr(s);if(!e)return null;const i=t.now??(()=>Date.now()),n=i(),[o,a,r]=e.dims,[l,h]=e.texel,[c,u,d]=e.origin,p=xo(Ps),m=p.map(y=>[y[0],-y[1],y[2]]),w=s.levels.map(y=>{const M=s.parts.filter(S=>S.level_id===y.id).map(S=>Ms(S)).filter(S=>S!==null);return{level:y,grid:new oa(M,c,d,c+e.size[0],d+e.size[2])}}),v=y=>{let M=null;for(const S of w)y>=S.level.elevation_m&&y<S.level.elevation_m+S.level.ceiling_height_m+1e-6&&(!M||S.level.elevation_m>M.level.elevation_m)&&(M=S);return M},g=o*a*r,z=new Float32Array(g).fill(1),k=new Float32Array(g).fill(1),P=new Uint8Array(g);let E=0,_=0;const $=[0,0,0],f=p.length;for(let y=0;y<r;y++){$[2]=d+(y+.5)*l;for(let M=0;M<a;M++){$[1]=u+(M+.5)*h;const S=v($[1]);if(!S)continue;const L=S.level.elevation_m;for(let x=0;x<o;x++){$[0]=c+(x+.5)*l;const I=x+o*(M+a*y);if(S.grid.contains($)){P[I]=1,E++;continue}let B=0,H=0;for(let F=0;F<f;F++){const K=S.grid.cast($,p[F],wt);K<wt&&(B+=1-K/wt);const W=m[F];let U=S.grid.cast($,W,wt);const rt=($[1]-L)/-W[1];rt>=0&&rt<U&&(U=rt),U<wt&&(H+=1-U/wt)}_+=2*f,z[I]=1-B/f,k[I]=1-(B+H)/(2*f)}}t.yieldSlice&&await t.yieldSlice(y,r)}gr(z,k,P,o,a,r);const b=new Uint8Array(g*2);for(let y=0;y<g;y++)b[2*y]=Math.round(Math.min(1,Math.max(0,z[y]))*255),b[2*y+1]=Math.round(Math.min(1,Math.max(0,k[y]))*255);return{key:Po(s),plan:e,data:b,wallRef:Math.round(mr(p)*1e4)/1e4,stats:{texels:g,inside:E,rays:_,ms:Math.round(i()-n)}}}function gr(s,t,e,i,n,o){const a=(r,l,h)=>r+i*(l+n*h);for(let r=0;r<2;r++){const l=[];for(let h=0;h<o;h++)for(let c=0;c<n;c++)for(let u=0;u<i;u++){const d=a(u,c,h);if(!e[d])continue;let p=0,m=0,w=0;const v=(g,z,k)=>{if(g<0||z<0||k<0||g>=i||z>=n||k>=o)return;const P=a(g,z,k);e[P]||(p+=s[P],m+=t[P],w++)};v(u-1,c,h),v(u+1,c,h),v(u,c,h-1),v(u,c,h+1),v(u,c-1,h),v(u,c+1,h),w&&l.push([d,p/w,m/w])}for(const[h,c,u]of l)s[h]=c,t[h]=u,e[h]=0}}const Ee={strength:1,direct:.7,power:1.5};function $o(s,t,e,i){const n=new sn(s,t,e,i);return n.format=on,n.type=wo,n.minFilter=ss,n.magFilter=ss,n.wrapS=Lt,n.wrapT=Lt,n.wrapR=Lt,n.unpackAlignment=1,n.generateMipmaps=!1,n.needsUpdate=!0,n}const zo=()=>$o(new Uint8Array([255,255]),1,1,1);function vr(){return{swAoVol:{value:zo()},swAoOrigin:{value:new N(0,0,0)},swAoSize:{value:new N(1,1,1)},swAoStrength:{value:0},swAoWallRef:{value:1},swAoDirect:{value:Ee.direct}}}function di(s,t){if(s.swAoVol.value.dispose(),!t){s.swAoVol.value=zo(),s.swAoStrength.value=0;return}const[e,i,n]=t.plan.dims;s.swAoVol.value=$o(t.data,e,i,n),s.swAoOrigin.value.set(...t.plan.origin),s.swAoSize.value.set(...t.plan.size),s.swAoWallRef.value=Math.max(.05,t.wallRef),s.swAoStrength.value=Ee.strength}function br(s){s.swAoVol.value.dispose()}const yr=`
varying vec3 vSwAoPos;
varying vec3 vSwAoN;`,kr=`
	vec4 swAoW = vec4( transformed, 1.0 );
	vec3 swAoNo = objectNormal;
	#ifdef USE_INSTANCING
		swAoW = instanceMatrix * swAoW;
		swAoNo = mat3( instanceMatrix ) * swAoNo;
	#endif
	vSwAoPos = ( modelMatrix * swAoW ).xyz;
	vSwAoN = mat3( modelMatrix ) * swAoNo;`,xr=`
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
	vec3 q = ( vSwAoPos + n * ${_o.toFixed(3)} - swAoOrigin ) / swAoSize;
	if ( any( lessThan( q, vec3( 0.0 ) ) ) || any( greaterThan( q, vec3( 1.0 ) ) ) ) return 1.0;
	vec2 ao = texture( swAoVol, q ).rg;
	float side = clamp( ao.g / swAoWallRef, 0.0, 1.0 );
	float a = mix( side, ao.r, smoothstep( 0.35, 0.9, n.y ) );
	a = pow( a, ${Ee.power.toFixed(2)} ); // deepen the contact: the open (1) stays open
	return mix( 1.0, a, swAoStrength );
}`,Mr=`
	{
		float swAo = swBakedAo();
		reflectedLight.indirectDiffuse *= swAo;
		reflectedLight.indirectSpecular *= mix( 1.0, swAo, 0.8 );
		reflectedLight.directDiffuse *= mix( 1.0, swAo, swAoDirect );
	}`;function Sr(s,t){if(s.userData.swAo)return;s.userData.swAo=!0;const e=s.onBeforeCompile;s.onBeforeCompile=(n,o)=>{e.call(s,n,o),Object.assign(n.uniforms,t),n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>${yr}`).replace("#include <worldpos_vertex>",`#include <worldpos_vertex>${kr}`),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>${xr}`).replace("#include <aomap_fragment>",`#include <aomap_fragment>${Mr}`)};const i=s.customProgramCacheKey.bind(s);s.customProgramCacheKey=()=>`${i()}|swao1`}const ae={edge:.55,reflect:.9,max:.88,power:4};function Ar(s){s.userData.swGlass||(s.userData.swGlass=!0,s.onBeforeCompile=t=>{t.fragmentShader=t.fragmentShader.replace("#include <opaque_fragment>",`{
		float swF = pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), ${ae.power.toFixed(1)} );
		float swR = dot( reflectedLight.indirectSpecular + reflectedLight.directSpecular, vec3( 0.2126, 0.7152, 0.0722 ) );
		diffuseColor.a = clamp( diffuseColor.a + swF * ${ae.edge.toFixed(3)} + swR * ${ae.reflect.toFixed(3)}, 0.0, ${ae.max.toFixed(3)} );
	}
	#include <opaque_fragment>`)},s.customProgramCacheKey=()=>"swglass1")}const $s="marble",Te="finish_marble",Jt="finish_ceramic",te="finish_travertine";function _r(s){return s==="wood"?"oak":s==="ceramic"?Jt:s==="travertine"?te:Te}const Eo=s=>s===Jt?"ceramic":s===te?"travertine":"marble",Pr=[{id:Te,group:"floor",he:A("שיש קלקטה מלוטש"),tile_m:2.4,tint:{light:"#ffffff",dark:"#868b95"},roughness:.32,metalness:0,normal:0,set:null,aliases:[]},{id:Jt,group:"floor",he:A("קרמיקה יוקרתית"),tile_m:2.4,tint:{light:"#ffffff",dark:"#80848c"},roughness:.4,metalness:0,normal:0,set:null,aliases:[]},{id:te,group:"floor",he:A("טרוורטין"),tile_m:2.4,tint:{light:"#ffffff",dark:"#857f76"},roughness:.55,metalness:0,normal:0,set:null,aliases:[]}],$r=s=>s===Te||s===Jt||s===te;function At(s,t,e){let i=Math.imul(s,374761393)+Math.imul(t,668265263)+Math.imul(e,2147483647)|0;return i=Math.imul(i^i>>>13,1274126177),i^=i>>>16,(i>>>0)/4294967296}function ls(s,t,e,i){const n=s*e,o=t*e,a=Math.floor(n),r=Math.floor(o),l=n-a,h=o-r,c=l*l*(3-2*l),u=h*h*(3-2*h),d=g=>(g%e+e)%e,p=At(d(a),d(r),i),m=At(d(a+1),d(r),i),w=At(d(a),d(r+1),i),v=At(d(a+1),d(r+1),i);return p+(m-p)*c+(w-p)*u+(p-m-w+v)*c*u}function Mt(s,t,e,i,n){let o=0,a=.5,r=0;for(let l=0;l<i;l++)o+=ls(s,t,e<<l,n+l*17)*a,r+=a,a*=.5;return o/r}const ut=s=>s<0?0:s>1?1:s,Y=(s,t,e)=>s+(t-s)*e,Z=128;function Ut(s){const t=new Float32Array(Z*Z);for(let e=0;e<Z;e++)for(let i=0;i<Z;i++)t[e*Z+i]=s(i/Z,e/Z);return t}function Wt(s,t,e){const i=t*Z,n=e*Z,o=Math.floor(i),a=Math.floor(n),r=i-o,l=n-a,h=o%Z,c=a%Z,u=(o+1)%Z,d=(a+1)%Z,p=s[c*Z+h],m=s[c*Z+u],w=s[d*Z+h],v=s[d*Z+u];return p+(m-p)*r+(w-p)*l+(p-m-w+v)*r*l}function zr(s,t=512,e=!0){const i=new Uint8Array(t*t*4),n=Eo(s),o=n==="marble",a=o?[246,244,239]:n==="travertine"?[226,210,184]:[214,207,196],r=o?[228,224,216]:n==="travertine"?[205,186,156]:[198,191,180],l=o?[118,108,94]:n==="travertine"?[178,156,124]:[190,182,170],h=o?[214,211,205]:n==="travertine"?[196,182,160]:[160,154,146],c=n==="travertine"?Ut((v,g)=>Mt(v,g,3,4,131)):null,u=t/2,d=o?Ut((v,g)=>Mt(v,g,4,4,11)):null,p=o?Ut((v,g)=>Mt(v,g,3,4,29)):null,m=o?Ut((v,g)=>Mt(v,g,5,3,47)):null,w=o?Ut((v,g)=>Mt(v,g,2,3,61)):null;for(let v=0;v<t;v++){const g=v/t;for(let z=0;z<t;z++){const k=o&&z>=u?(t-z)/t:z/t;let P,E,_;if(o){const b=Wt(d,k,g),y=Wt(p,k,g),M=Wt(w,k,g),S=1-Math.abs(Math.sin(Math.PI*(2*k+1*g+y*1.6))),L=1-Math.abs(Math.sin(Math.PI*(1*k-3*g+Wt(m,k,g)*2.2))),x=S*S,I=x*x,B=I*I*I*I,H=L*L,F=H*H*H*H,K=F*F*F*F,W=ut((M-.42)*3.6),U=ut((.5-M)*2.4),Nt=(B*B*.82+I*x*.3)*W,Ko=(K*F*.22+F*.05)*U,De=ut(Nt+Ko),Re=ut((b-.45)*1.4)*.35,Ie=(ls(k,g,96,101)-.5)*.035;P=Y(Y(a[0],r[0],Re),l[0],De)*(1+Ie),E=Y(Y(a[1],r[1],Re),l[1],De)*(1+Ie),_=Y(Y(a[2],r[2],Re),l[2],De)*(1+Ie)}else if(n==="travertine"){const b=z<u?0:1,y=v<u?0:1,M=(At(b,y,9)-.5)*.06,S=Wt(c,k,g),L=.5+.5*Math.sin(Math.PI*2*(g*9+S*1.4+b*.37)),x=.5+.5*Math.sin(Math.PI*2*(g*31+S*2.3)),I=ut(Math.pow(L,6)*.65+Math.pow(x,10)*.3),B=(ls(k,g,64,141)-.5)*.1,H=ut(.62+M+B-I*.55);P=Y(r[0],a[0],H),E=Y(r[1],a[1],H),_=Y(r[2],a[2],H);const F=I*.35;P=Y(P,l[0],F),E=Y(E,l[1],F),_=Y(_,l[2],F),At(Math.floor(z/3),Math.floor(v/2),151)>.985&&(P*=.72,E*=.7,_*=.66)}else{const b=z<u?0:1,y=v<u?0:1,M=(At(b,y,5)-.5)*.05,S=(Mt(k,g,32,2,71)-.5)*.08+(Mt(k,g,6,3,83)-.5)*.1,L=ut(.5+M+S);P=Y(r[0],a[0],L)+(L-.5)*6,E=Y(r[1],a[1],L)+(L-.5)*6,_=Y(r[2],a[2],L)+(L-.5)*6}const $=1;if(e&&(z%u<$||v%u<$)){const b=o?.55:.9;P=Y(P,h[0],b),E=Y(E,h[1],b),_=Y(_,h[2],b)}const f=(v*t+z)*4;i[f]=Math.round(ut(P/255)*255),i[f+1]=Math.round(ut(E/255)*255),i[f+2]=Math.round(ut(_/255)*255),i[f+3]=255}}return i}function Er(s,t=512){const e=Eo(s),i=e==="marble",n=new Uint8Array(t*t*4),o=new Uint8Array(t*t*4),a=t/2,r=1,l=To(s).data,h=d=>d<=0?1:d===1?.45:0,c=d=>{const p=d%a;return Math.min(Math.max(p-r+1,0),a-p)},u=(d,p)=>Math.max(h(c((d%t+t)%t)),h(c((p%t+t)%t)));for(let d=0;d<t;d++)for(let p=0;p<t;p++){const m=(d*t+p)*4,w=p%a<r||d%a<r,v=(l[m]*.2126+l[m+1]*.7152+l[m+2]*.0722)/255,g=i?.12+(.95-v)*.35:e==="travertine"?.42+(.86-v)*.5:.26+(.84-v)*.2,z=w?i?.75:.85:Math.min(e==="travertine"?.7:.45,Math.max(.08,g));n[m]=w?205:255,n[m+1]=Math.round(z*255),n[m+2]=0,n[m+3]=255;const k=(u(p+1,d)-u(p-1,d))*.5,P=(u(p,d+1)-u(p,d-1))*.5,E=k*.9,_=-P*.9,$=1/Math.hypot(E,_,1);o[m]=Math.round((E*$*.5+.5)*255),o[m+1]=Math.round((_*$*.5+.5)*255),o[m+2]=Math.round(($*.5+.5)*255),o[m+3]=255}return{rough:n,normal:o}}const ui=new Map;function Tr(s){let t=ui.get(s);return t||ui.set(s,t=Er(s)),{...t,size:Math.round(Math.sqrt(t.rough.length/4))}}const pi=new Map;function To(s){let t=pi.get(s);return t||pi.set(s,t=zr(s)),{data:t,size:Math.round(Math.sqrt(t.length/4))}}const Lr={[Te]:1,[Jt]:.8,[te]:.3,tiles_white:.4,tiles_grey:.35,floor_sport:.3,oak:.22},Dr=s=>Lr[s]??0,Rr=s=>1-.25*Math.min(1,Math.max(0,s)),Ir={value:0};function Cr(s,t){if(s.userData.swRefl!==void 0||!(t>0))return;s.userData.swRefl=t;const e=s.onBeforeCompile;s.onBeforeCompile=(n,o)=>{e.call(s,n,o),n.uniforms.swReflOn=Ir,n.uniforms.swReflA={value:Rr(t)},n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform float swReflOn;
uniform float swReflA;`).replace("#include <dithering_fragment>",`#include <dithering_fragment>
if ( swReflOn > 0.5 ) gl_FragColor.a = swReflA;`)};const i=s.customProgramCacheKey.bind(s);s.customProgramCacheKey=()=>`${i()}|swrefl1`}const Fr=20,Jc={light:{strength:.7,maxDist:4},dark:{strength:.75,maxDist:4}},td=`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,ed=`
#define SW_STEPS ${Fr}
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
}`,Or=1.25;function Nr(s,t){const e=s.ceiling_height_m*.6;return s.elevation_m+(t==="mid"?e:Math.min(Or,e))}const Br={rung:"lite",style:"light",furniture:"models",textures:"files",sectionCut:!0,backdrop:"sky",floorFinish:$s,reflections:!0,wallCut:"low",marks:Ss},yt=new Map([...Hn,...Pr].map(s=>[s.id,s])),ct=s=>s*Math.PI/180,Lo=new Set(["floor","wall","lintel","sill","head","door","window","object","connector","camera","room"]),qr=new Set(["wall","lintel","sill","head","door","window","object","connector","camera","ceiling"]),Hr=.5,fi=.8,Ur=.35,Wr=ct(35);function Do(s,t){return sr(t,s.levels,s.real?.lamps??[])}class Gr{constructor(t,e){this.base=t,this.onLoad=e,this.loader=new nn,this.textures=new Map,this.failed=new Set,this.mats=new Map,this.pendingLoads=0,this.clip=null,this.roughMean=new Map,this.ao=null,this.style="light",this.source="files",this.rung="lite"}get pending(){return this.pendingLoads}tex(t,e){if(this.failed.has(t))return null;let i=this.textures.get(t);return i||(this.pendingLoads++,i=this.loader.load(t,n=>{this.pendingLoads--,!e&&t.endsWith("rough_ao.jpg")&&this.measureRoughness(t,n),this.onLoad()},void 0,()=>{this.pendingLoads--,this.failed.add(t);for(const n of this.mats.values())(n.m.map===i||n.m.normalMap===i||n.m.roughnessMap===i)&&(n.m.map=null,n.m.normalMap=null,n.m.roughnessMap=null,n.m.aoMap=null,n.m.roughness=yt.get(n.id)?.roughness??1,n.m.needsUpdate=!0);this.onLoad()}),i.wrapS=Tt,i.wrapT=Tt,i.colorSpace=e?Zt:Rs,i.anisotropy=8,this.textures.set(t,i),i)}finishMap(t,e="color"){const i=e==="color"?`finish:${t}`:`finish:${t}:${e}`;let n=this.textures.get(i);if(n)return n;let o,a;if(e==="color")({data:o,size:a}=To(t));else{const l=Tr(t);o=e==="rough"?l.rough:l.normal,a=l.size}const r=new an(o,a,a,rn,wo);return r.wrapS=Tt,r.wrapT=Tt,r.colorSpace=e==="color"?Zt:Rs,r.magFilter=ss,r.minFilter=ln,r.generateMipmaps=!0,r.anisotropy=8,r.needsUpdate=!0,r.name=i,this.textures.set(i,n=r),n}measureRoughness(t,e){try{const i=e.image,o=(typeof OffscreenCanvas<"u"?new OffscreenCanvas(16,16):Object.assign(document.createElement("canvas"),{width:16,height:16})).getContext("2d");if(!o||!i?.width)return;o.drawImage(i,0,0,16,16);const a=o.getImageData(0,0,16,16).data;let r=0;for(let h=1;h<a.length;h+=4)r+=a[h];const l=r/(a.length/4)/255;if(!(l>.02))return;this.roughMean.set(t,l);for(const h of this.mats.values())h.m.roughnessMap===e&&this.fitRoughness(h.m,h.id,h.variant)}catch{}}fitRoughness(t,e,i){const n=yt.get(e);let o;for(const[r,l]of this.roughMean)this.textures.get(r)===t.roughnessMap&&(o=l);let a=o?jr(n?.roughness??1,o):1;i.startsWith("slot:")&&(a=Number(i.slice(5))),i==="floor"&&(a*=j[this.style].rig.floorSheen),t.roughness=a}roughnessOf(){const t={};for(const e of this.mats.values())(e.variant==="std"||e.variant==="floor")&&(t[`${e.id}|${e.variant}`]=Math.round(e.m.roughness*1e3)/1e3);return t}tint(t){return new et(t?.tint[this.style]??"#cccccc").getHex()}get(t,e="std",i=!0){const n=`${t}|${e}|${i?1:0}`,o=this.mats.get(n);if(o)return o.m;const a=e.startsWith("vc:"),r=a?e.slice(3):e,l=yt.get(t);let h;if(r==="glass"||l?.glass){const c=j[this.style].glass,u=t==="glass_frosted";h=new Dt({color:u?14674419:c.tint,transparent:!0,opacity:u?.62:c.opacity,roughness:u?.35:.04,metalness:0,envMapIntensity:u?1:c.env,depthWrite:!1,side:Ct,forceSinglePass:!0}),u||Ar(h)}else{const c=l?.metalness??0;h=new Dt({color:this.tint(l),roughness:l?.roughness??1,metalness:c,envMapIntensity:c>.5?1:.7});const u=r==="nomap"||this.source!=="files"?null:Un(t,this.base);if(u){const d=this.tex(u.color,!0),p=this.tex(u.normal,!1),m=this.tex(u.roughAo,!1);d&&p&&m&&(h.map=d,h.normalMap=p,h.normalScale=new kt(l?.normal??1,l?.normal??1),h.roughnessMap=m,h.aoMap=m,h.aoMapIntensity=.6,h.roughness=1)}else r!=="nomap"&&this.source==="files"&&$r(t)&&(h.map=this.finishMap(t),h.roughnessMap=this.finishMap(t,"rough"),h.aoMap=h.roughnessMap,h.aoMapIntensity=.5,h.normalMap=this.finishMap(t,"normal"),h.normalScale=new kt(fi,fi),h.roughness=1,h.envMapIntensity=Ur);h.roughnessMap?this.fitRoughness(h,t,r):(r.startsWith("slot:")&&(h.roughness=Number(r.slice(5))),r==="floor"&&(h.roughness*=j[this.style].rig.floorSheen)),this.ao&&Sr(h,this.ao),r==="floor"&&Cr(h,Dr(t))}return h.userData.materialId=t,a&&(h.vertexColors=!0),i&&(h.clippingPlanes=this.clip),h.clipShadows=!0,this.mats.set(n,{id:t,variant:r,m:h}),h}setStyle(t){this.style=t;const e=j[t].glass;for(const i of this.mats.values()){const n=yt.get(i.id);if(i.variant==="glass"||n?.glass){i.id!=="glass_frosted"&&i.m.color.setHex(e.tint),i.m.envMapIntensity=e.env,i.id!=="glass_frosted"&&(i.m.opacity=e.opacity);continue}i.m.color.setHex(this.tint(n)),i.variant==="floor"&&(i.m.roughnessMap?this.fitRoughness(i.m,i.id,i.variant):i.m.roughness=(n?.roughness??1)*j[t].rig.floorSheen)}}setClip(t){this.clip=t;for(const[e,i]of this.mats)e.split("|")[2]==="1"&&(i.m.clippingPlanes=t)}setRung(t){if(t!==this.rung){this.rung=t;for(const[e,i]of[...this.mats])(i.variant==="glass"||yt.get(i.id)?.glass)&&(i.m.dispose(),this.mats.delete(e))}}setSource(t){if(t!==this.source){this.source=t;for(const e of this.mats.values())e.m.dispose();this.mats.clear()}}dispose(){for(const t of this.mats.values())t.m.dispose();for(const t of this.textures.values())t.dispose();this.mats.clear(),this.textures.clear()}}const mi=[.75,1.5];function jr(s,t){return t>.02?Math.round(Math.min(mi[1],Math.max(mi[0],s/t))*1e3)/1e3:1}class Kr{constructor(t,e){this.base=t,this.onLoad=e,this.cache=new Map,this.loading=new Set,this.version=0}get pending(){return this.loading.size}template(t){if(this.cache.has(t))return this.cache.get(t);this.loading.has(t)||(this.loading.add(t),fetch(Gn(t,this.base)).then(e=>e.ok?e.arrayBuffer():Promise.reject(new Error(`HTTP ${e.status}`))).then(e=>{const i=qa(e),n=i.primitives.map(o=>{const a=new at;return a.setAttribute("position",new gt(o.positions,3)),a.setAttribute("normal",new gt(Ia(o.positions,Wr),3)),{geometry:a,slot:o.material}});this.cache.set(t,{model:i,geos:n})}).catch(e=>{console.warn(`sw-plan-3d: model ${t} failed, the procedural family draws instead`,e),this.cache.set(t,null)}).finally(()=>{this.loading.delete(t),this.version++,this.onLoad()}))}dispose(){for(const t of this.cache.values())for(const e of t?.geos??[])e.geometry.dispose();this.cache.clear()}}let wi=null,zt=null,Gt=null,gi=null;function Le(s,t,e){const i=document.createElement("canvas");i.width=s,i.height=t;const n=i.getContext("2d");return n&&e(n),new $e(i)}function Xr(){return wi??=Le(128,128,s=>{const t=s.createRadialGradient(64,64,0,64,64,64);t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.45,"rgba(0,0,0,0.75)"),t.addColorStop(.8,"rgba(0,0,0,0.18)"),t.addColorStop(1,"rgba(0,0,0,0)"),s.fillStyle=t,s.fillRect(0,0,128,128)}),wi}function Vr(s,t){const e=Math.max(s[0],.02)/2,i=Math.max(s[2],.02)/2,n=Math.round((.04+.12*Math.min(1,Math.max(0,s[1])))*1e3)/1e3,o=t?Math.min(e,i):Math.min(.04,e,i);return{hx:e,hz:i,margin:n,corner:o}}const Yr=`
float swContact(vec2 p, vec4 b) {
  vec2 q = abs(p) - b.xy + b.w;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - b.w;
  if (d > 0.0) { float t = 1.0 - clamp(d / max(b.z, 1e-3), 0.0, 1.0); return t * t; }
  return 1.0;
}`;function Zr(s){s.onBeforeCompile=t=>{t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
attribute vec4 aBox;
varying vec2 vSwLocal;
varying vec4 vSwBox;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vSwLocal = position.xz * 2.0 * (aBox.xy + aBox.z);
vSwBox = aBox;`),t.fragmentShader=t.fragmentShader.replace("#include <common>",`#include <common>
varying vec2 vSwLocal;
varying vec4 vSwBox;
${Yr}`).replace("#include <alphatest_fragment>",`diffuseColor.a *= swContact(vSwLocal, vSwBox);
#include <alphatest_fragment>`)},s.customProgramCacheKey=()=>"sw-contact-blob"}function Qr(){return zt||(zt=Le(4,64,s=>{const t=s.createLinearGradient(0,0,0,64);t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.35,"rgba(0,0,0,0.45)"),t.addColorStop(1,"rgba(0,0,0,0)"),s.fillStyle=t,s.fillRect(0,0,4,64)}),zt.wrapS=Tt,zt.wrapT=Lt,zt.flipY=!1),zt}function vi(){return gi??=Le(256,256,s=>{const t=s.createRadialGradient(128,128,0,128,128,128);t.addColorStop(0,"#fff"),t.addColorStop(.55,"#fff"),t.addColorStop(1,"#000"),s.fillStyle=t,s.fillRect(0,0,256,256)}),gi}function Jr(){return Gt||(Gt=Le(1024,128,s=>{s.fillStyle="#000",s.fillRect(0,0,1024,128);let t=77;const e=()=>(t=t*1664525+1013904223>>>0,t/4294967296);s.fillStyle="#fff",s.beginPath(),s.moveTo(0,128);for(let i=0;i<=1024;i+=8)s.lineTo(i,128-(60+22*Math.sin(i*.02)+14*Math.sin(i*.071+1.3)+e()*10));s.lineTo(1024,128),s.closePath(),s.fill()}),Gt.wrapS=Tt,Gt.repeat.set(6,1)),Gt}class hs{constructor(){this.pos=[],this.nrm=[],this.ranges=[],this.parts=[],this.uv=[],this.ownUv=!1,this.col=null}push(t,e,i,n={}){const o=t.index?t.toNonIndexed():t,a=o.getAttribute("position"),r=o.getAttribute("normal"),l=n.ownUv?o.getAttribute("uv"):null;l&&(this.ownUv=!0);for(let u=0;u<a.count;u++)l?this.uv.push(l.getX(u),l.getY(u)):this.uv.push(NaN,NaN);if(n.jitter!==void 0){this.col??=[];for(let u=0;u<a.count;u++)this.col.push(n.jitter,n.jitter,n.jitter)}const h=new dn().getNormalMatrix(e),c=new N;this.ranges.push(this.pos.length/9),this.parts.push(i);for(let u=0;u<a.count;u++)c.set(a.getX(u),a.getY(u),a.getZ(u)).applyMatrix4(e),this.pos.push(c.x,c.y,c.z),r?(c.set(r.getX(u),r.getY(u),r.getZ(u)).applyMatrix3(h).normalize(),this.nrm.push(c.x,c.y,c.z)):this.nrm.push(0,1,0);o!==t&&o.dispose()}geometry(t){const e=new at,i=new Float32Array(this.pos);if(e.setAttribute("position",new tt(i,3)),e.setAttribute("normal",new tt(new Float32Array(this.nrm),3)),t!==null){const n=So(i,t);if(this.ownUv)for(let o=0;o<n.length;o++)Number.isNaN(this.uv[o])||(n[o]=this.uv[o]);e.setAttribute("uv",new tt(n,2))}return this.col&&e.setAttribute("color",new tt(new Float32Array(this.col),3)),e.computeBoundingSphere(),e}}const St=(s,t,e=[1,1,1])=>new ot().compose(new N(s[0],s[1],s[2]),new bt().setFromEuler(new ht(ct(t[0]),ct(t[1]),ct(t[2]),"YXZ")),new N(e[0],e[1],e[2]));function Vt(s,t,e,i,n){let o;const[a,r,l]=[Math.max(t[0],.001),Math.max(t[1],.001),Math.max(t[2],.001)];s==="rbox"&&e>0?o=new cn(a,r,l,Math.min(a,r,l)<.12?1:2,Math.min(e,Math.min(a,r,l)/2-1e-4)):s==="cyl"||s==="cylinder"?o=new ze(a/2*i,a/2,r,14):s==="sphere"?o=new bo(.5,12,8).scale(a,r,l):o=new Qt(a,r,l);const h=o.index?o.toNonIndexed():o;return h!==o&&o.dispose(),h.setAttribute("uv",new tt(So(h.getAttribute("position").array,n),2)),h}const bi=s=>s.map(t=>Math.round(t*1e3)).join("x");function cs(s,t,e,i=!1){if(s.length<3)return null;const n=xs.triangulateShape(s.map(([r,l])=>new kt(r,l)),[]),o=[];for(const[r,l,h]of n){const[c,u,d]=[s[r],s[l],s[h]],p=(u[0]-c[0])*(d[1]-c[1])-(d[0]-c[0])*(u[1]-c[1]);Math.abs(p)<1e-10||(p>0!==i?o.push(c[0],t+e,c[1],d[0],t+e,d[1],u[0],t+e,u[1]):o.push(c[0],t+e,c[1],u[0],t+e,u[1],d[0],t+e,d[1]))}if(!o.length)return null;const a=new at;return a.setAttribute("position",new gt(o,3)),a.computeVertexNormals(),a}function tl(s,t){return s.finish?_r(t.floorFinish??$s):s.material}const el=24e3;function yi(s,t){return s>=2&&s*t>el}function sl(s){const{real:t,settings:e,mats:i,models:n}=s,o={root:new ft,lookup:new Map,leaves:new Map,shutters:new Map,bulbs:new Map,caps:null,glow:null,stats:{meshes:0,instanced:0,merged:0,models:0,furnitureMerged:0}};o.root.name="real";const a=new Set(s.desc.levels.map(f=>f.id)),r=s.heavy,l=s.mergeFurniture!==!1,h=new Set(r?[]:t.replaced),c=new Set,u=[];if(e.furniture==="models"&&!r)for(const f of t.models){const b=jn[f.item];if(!b||!a.has(f.level_id))continue;const y=n.template(b.file);y&&(c.add(f.owner),u.push({row:f,entry:b,tpl:y}))}const d=new Map,p=new Map,m=(f,b,y,M,S=!0)=>{const L=`${f??""}|${b}|${y}|${qr.has(M)?"c":"n"}|${S||y==="glass"?1:0}`;let x=d.get(L);return x||d.set(L,x=new hs),x},w=new Map,v=new Qt(1,1,1),g=(f,b)=>({id:f.id,kind:b,userData:f.userData});for(const f of s.parts){if(!Lo.has(f.kind)||h.has(f.id)||c.has(f.id)||f.kind==="room")continue;const b=t.materials[f.id]??"plaster_white";if(f.kind==="window"||b==="glass"||b==="glass_frosted"){m(f.level_id,b==="glass_frosted"?"glass_frosted":"glass","glass",f.kind).push(v,St(f.position,f.rotation,[Math.max(f.size[0],.001),Math.max(f.size[1],.001),Math.max(f.size[2],.001)]),g(f,f.kind));continue}if(f.kind==="door"&&f.shape==="box"){o.leaves.set(f.id,il(f,t,s,i,o));continue}if((f.kind==="object"||f.kind==="camera")&&(f.shape==="box"||f.shape==="cylinder")){const S=r?0:t.radius[f.id]??0,L=f.shape==="cylinder"?"cyl":S>0?"rbox":"box",x=`${f.level_id}|${L}|${bi(f.size)}|${S}|${b}`;let I=p.get(x);I||p.set(x,I={shape:L,size:f.size,radius:S,taper:1,material:b,variant:"std",level:f.level_id,shadow:!0,items:[]}),I.items.push({matrix:St(f.position,f.rotation),part:g(f,f.kind)});continue}if(f.shape==="prism"){const S=nl(f);S&&m(f.level_id,b,"std",f.kind).push(S,new ot().makeTranslation(f.position[0],f.position[1],f.position[2]),g(f,f.kind));continue}if(f.shape!=="box"&&f.shape!=="cylinder")continue;const y=f.kind==="floor"?"floor":"std",M=f.shape==="cylinder"?new ze(.5,.5,1,16):v;m(f.level_id,b,y,f.kind).push(M,St(f.position,f.rotation,[Math.max(f.size[0],.001),Math.max(f.size[1],.001),Math.max(f.size[2],.001)]),g(f,f.kind)),M!==v&&M.dispose()}if(!r)for(const f of t.parts){if(!a.has(f.level_id??"")&&f.level_id!==null||c.has(f.owner)||o.leaves.has(f.owner))continue;const b={id:f.id,kind:f.userData.kind==="opening"?"door":"object",userData:f.userData};if(f.bulb){const S=ol(i,f.bulb,o),L=Vt(f.shape,f.size,f.radius??0,f.taper??1,1),x=new q(L,S);x.applyMatrix4(St(f.position,f.rotation)),x.name=f.id,x.userData.ownMaterial=!0,o.lookup.set(x,[b]),o.root.add(x),o.stats.meshes++;continue}if(f.userData.kind==="wall"||f.userData.kind==="opening"){const S=Vt(f.shape,f.size,f.radius??0,f.taper??1,1);m(f.level_id,f.material,"std","wall").push(S,St(f.position,f.rotation),b),S.dispose();continue}const y=`${f.level_id}|${f.shape}|${bi(f.size)}|${f.radius??0}|${f.taper??1}|${f.material}|${f.shadow?1:0}`;let M=p.get(y);M||p.set(y,M={shape:f.shape,size:f.size,radius:f.radius??0,taper:f.taper??1,material:f.material,variant:"std",level:f.level_id,shadow:f.shadow,items:[]}),M.items.push({matrix:St(f.position,f.rotation),part:b})}for(const f of t.floors){if(!a.has(f.level_id))continue;const b=cs(f.polygon,f.y,.006),y=tl(f,e);b&&m(f.level_id,y,"floor","floor").push(b,new ot,{id:f.id,kind:"room",userData:{id:f.zone,kind:"zone"}})}for(const f of t.ceilings??[]){if(!a.has(f.level_id))continue;const b=cs(f.polygon,f.y-.006,.006,!0);b&&m(f.level_id,f.material,"std","ceiling").push(b,new ot,{id:f.id,kind:"room",userData:{id:f.zone,kind:"zone"}})}const z=[];for(const[f,b]of[...p].sort((y,M)=>y[0]<M[0]?-1:1)){const y=yt.get(b.material),M=Vt(b.shape,b.size,b.radius,b.taper,y?.tile_m??1);if(l&&!yi(b.items.length,M.getAttribute("position").count/3)){const S=m(b.level,b.material,b.variant,"object",b.shadow);for(const L of b.items)S.push(M,L.matrix,L.part,{ownUv:!0});M.dispose(),o.stats.furnitureMerged+=b.items.length;continue}z.push([f,b,M])}for(const[f,b]of[...d].sort((y,M)=>y[0]<M[0]?-1:1)){const[y,M,S,L,x]=f.split("|"),I=yt.get(M),B=b.geometry(I?.tile_m??1),H=i.get(M,S==="glass"?"glass":S,L==="c"),F=new q(B,H);F.name=`merged|${y}|${M}|${S}${x==="0"?"|noshadow":""}`,F.userData.ranges=Uint32Array.from(b.ranges);const K=S==="glass";F.castShadow=!K&&x!=="0",F.receiveShadow=!K,K&&(F.renderOrder=2),o.lookup.set(F,b.parts),o.root.add(F),o.stats.merged++}for(const[f,b,y]of z){const M=new vt(y,i.get(b.material,b.variant,!0),b.items.length);b.items.forEach((S,L)=>M.setMatrixAt(L,S.matrix)),M.instanceMatrix.needsUpdate=!0,M.computeBoundingSphere(),M.castShadow=b.shadow,M.receiveShadow=!0,M.name=`inst|${f}`,o.lookup.set(M,b.items.map(S=>S.part)),o.root.add(M),o.stats.instanced++}const k=new Map;for(const{row:f,entry:b,tpl:y}of u){const M=`${f.level_id}|${b.file}`;let S=k.get(M);S||k.set(M,S={entry:b,tpl:y,level:f.level_id,list:[]});const L=Ha(y.model.min,y.model.max,f.size[0],f.size[1],f.size[2]),x={id:f.owner,kind:"object",userData:{id:f.id.slice(6),kind:"object"}};for(const I of f.tiles){const B=new ot().compose(new N(I[0],I[1],I[2]),new bt().setFromEuler(new ht(0,ct(f.yaw),0,"YXZ")),new N(...L.scale));B.multiply(new ot().makeTranslation(L.offset[0],L.offset[1],L.offset[2])),S.list.push({m:B,part:x,j:Ua(I[0],I[2])})}}for(const[f,b]of[...k].sort((y,M)=>y[0]<M[0]?-1:1)){const y=b.tpl.geos.reduce((M,S)=>M+S.geometry.getAttribute("position").count/3,0);if(l&&!yi(b.list.length,y)){b.tpl.geos.forEach(M=>{const S=b.entry.slots[M.slot]??b.entry.fallback,L=`${b.level}|${S}|slot:${Gs[M.slot]??.6}`;let x=w.get(L);x||w.set(L,x=new hs);for(const I of b.list)x.push(M.geometry,I.m,I.part,{jitter:I.j})}),o.stats.furnitureMerged+=b.list.length;continue}b.tpl.geos.forEach((M,S)=>{const L=b.entry.slots[M.slot]??b.entry.fallback,x=new vt(M.geometry,i.get(L,`slot:${Gs[M.slot]??.6}`,!0),b.list.length),I=new et;b.list.forEach((B,H)=>{x.setMatrixAt(H,B.m),x.setColorAt(H,I.setScalar(B.j))}),x.instanceMatrix.needsUpdate=!0,x.instanceColor&&(x.instanceColor.needsUpdate=!0),x.computeBoundingSphere(),x.castShadow=!0,x.receiveShadow=!0,x.name=`model|${f}|${S}`,x.userData.shared=!0,o.lookup.set(x,b.list.map(B=>B.part)),o.root.add(x),o.stats.models++})}for(const[f,b]of[...w].sort((y,M)=>y[0]<M[0]?-1:1)){const[y,M,S]=f.split("|"),L=new q(b.geometry(null),i.get(M,`vc:${S}`,!0));L.name=`model-merged|${y}|${M}|${S}`,L.userData.ranges=Uint32Array.from(b.ranges),L.castShadow=!0,L.receiveShadow=!0,o.lookup.set(L,b.parts),o.root.add(L),o.stats.models++}for(const f of t.shutters){if(!a.has(f.level_id))continue;const b=new Qt(f.width,1,.04).translate(0,-.5,0),y=new q(b,i.get("shutter","std",!0));y.position.set(f.position[0],f.position[1],f.position[2]),y.rotation.set(0,ct(f.yaw),0,"YXZ"),y.scale.y=Math.max(.001,f.down*f.height),y.visible=f.down>.001,y.castShadow=!0,y.name=f.id,o.lookup.set(y,[{id:f.id,kind:"window",userData:{id:f.id.slice(8),kind:"opening"}}]),o.shutters.set(f.id,{mesh:y,height:f.height}),o.root.add(y)}const P=j[e.style],E=new Map(s.desc.levels.map(f=>[f.id,f.elevation_m])),_=al(s.parts.filter(f=>f.kind==="wall"&&f.shape==="box"&&f.userData.kind==="wall"&&Math.abs(f.position[1]-f.size[1]/2-(E.get(f.level_id??"")??0))<.02));if(_){const f=new mt({map:Qr(),color:0,transparent:!0,opacity:P.post.junctionAlpha,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),b=new q(_,f);b.name="ao-strips",b.renderOrder=1,b.userData.ownMaterial=!0,b.userData.skipAO=!0,o.root.add(b)}const $=s.parts.filter(f=>f.kind==="object"&&(f.shape==="box"||f.shape==="cylinder")&&f.position[1]-f.size[1]/2<=(E.get(f.level_id??"")??0)+Hr);if($.length){const f=new mt({color:0,transparent:!0,opacity:P.post.blobAlpha,depthWrite:!1});Zr(f);const b=new Me(1,1).rotateX(-Math.PI/2),y=new vt(b,f,$.length),M=new Float32Array($.length*4);$.forEach((S,L)=>{const x=Vr(S.size,S.shape==="cylinder");M.set([x.hx,x.hz,x.margin,x.corner],L*4);const I=S.size[1]>.1?.024:.006;y.setMatrixAt(L,new ot().compose(new N(S.position[0],S.position[1]-S.size[1]/2+I,S.position[2]),new bt().setFromEuler(new ht(0,ct(S.rotation[1]),0,"YXZ")),new N(2*(x.hx+x.margin),1,2*(x.hz+x.margin))))}),b.setAttribute("aBox",new hn(M,4)),y.instanceMatrix.needsUpdate=!0,y.computeBoundingSphere(),y.name="ao-blobs",y.renderOrder=1,y.userData.ownMaterial=!0,y.userData.skipAO=!0,o.root.add(y)}if(t.caps.length){const f=new ft;f.name="caps";const b=new Map;for(const y of t.caps)a.has(y.level_id)&&b.set(y.level_id,[...b.get(y.level_id)??[],y]);for(const[y,M]of[...b].sort((S,L)=>S[0]<L[0]?-1:1)){const S=[],L=[];for(const K of M){const W=K.polygon;for(let U=1;U+1<W.length;U++)S.push(W[0][0],K.y,W[0][1],W[U+1][0],K.y,W[U+1][1],W[U][0],K.y,W[U][1]);for(let U=0;U<W.length;U++)L.push(W[U][0],K.y+.002,W[U][1],W[(U+1)%W.length][0],K.y+.002,W[(U+1)%W.length][1])}const x=new at;x.setAttribute("position",new gt(S,3)),x.computeVertexNormals();const I=new mt({color:P.cut.cap,side:Ct}),B=new q(x,I);B.name=`caps|${y}`,B.userData={level:y,ownMaterial:!0},f.add(B);const H=new at;H.setAttribute("position",new gt(L,3));const F=new go(H,new vo({color:P.cut.edge??P.cut.cap,transparent:!0,opacity:.9}));F.name=`capedge|${y}`,F.userData={level:y,edge:!0,ownMaterial:!0},F.visible=P.cut.edge!==null,f.add(F)}o.caps=f,o.root.add(f)}if(s.glow){const f=Do(s.desc,s.parts),b=s.glow.prev&&[...s.glow.prev.values()].every(y=>a.has(y.room.level_id))?s.glow.prev:null;(f.length||b&&b.size)&&(o.glow=new cr(f,e.style,s.glow.night,b,s.glow.now,e.marks??Ss),o.root.add(o.glow.root))}return v.dispose(),o.stats.meshes+=o.root.children.length,o}function il(s,t,e,i,n){const o=new ft;o.name=s.id,o.position.set(s.position[0],s.position[1],s.position[2]),o.quaternion.setFromEuler(new ht(ct(s.rotation[0]),ct(s.rotation[1]),ct(s.rotation[2]),"YXZ"));const a=t.materials[s.id]??"door_wood",r=new q(Vt(e.heavy?"box":"rbox",s.size,t.radius[s.id]??.006,1,yt.get(a)?.tile_m??1),a==="glass"?i.get("glass","glass",!0):i.get(a,"std",!0));if(r.castShadow=!0,r.receiveShadow=!0,r.name=`${s.id}|leaf`,o.add(r),n.lookup.set(r,[{id:s.id,kind:"door",userData:s.userData}]),!e.heavy){const l=new ot().compose(o.position,o.quaternion,new N(1,1,1)).invert(),h=new hs;for(const c of t.parts){if(c.owner!==s.id)continue;const u=Vt(c.shape,c.size,c.radius??0,c.taper??1,.5);h.push(u,l.clone().multiply(St(c.position,c.rotation)),{id:c.id,kind:"door",userData:c.userData}),u.dispose()}if(h.parts.length){const c=new q(h.geometry(.5),i.get("metal_light","std",!0));c.name=`${s.id}|metal`,c.castShadow=!0,n.lookup.set(c,h.parts),c.userData.ranges=Uint32Array.from(h.ranges),o.add(c)}}return n.root.add(o),o}function ol(s,t,e){let i=e.bulbs.get(t);return i||(i=s.get("plastic","std",!0).clone(),i.color.setHex(15921128),i.emissive.setRGB(0,0,0),i.userData.ownMaterial=!0,e.bulbs.set(t,i)),i}function nl(s){return cs(s.polygon??[],0,s.size[1])}function al(s){const t=[],e=[],i=(o,a,r,l,h)=>{t.push(...o,...a,...r,...o,...r,...l),e.push(0,0,h,0,h,1,0,0,h,1,0,1)};for(const o of s){const[a,r,l]=o.size;if(a<.32)continue;const h=ct(o.rotation[1]),c=Math.cos(h),u=-Math.sin(h),d=-u,p=c,m=o.position[1]-r/2,w=a/.5;for(const v of[-1,1]){const g=o.position[0]+d*v*(l/2),z=o.position[2]+p*v*(l/2),k=[g-c*a/2,z-u*a/2],P=[g+c*a/2,z+u*a/2],E=d*v*.3,_=p*v*.3;i([k[0],m+.006,k[1]],[P[0],m+.006,P[1]],[P[0]+E,m+.006,P[1]+_],[k[0]+E,m+.006,k[1]+_],w);const $=.004;i([k[0]+d*v*$,m,k[1]+p*v*$],[P[0]+d*v*$,m,P[1]+p*v*$],[P[0]+d*v*$,m+.3,P[1]+p*v*$],[k[0]+d*v*$,m+.3,k[1]+p*v*$],w)}}if(!t.length)return null;const n=new at;return n.setAttribute("position",new gt(t,3)),n.setAttribute("uv",new gt(e,2)),n.computeVertexNormals(),n}function rl(s,t,e){const i=j[t],n=new ft;n.name="exterior";const o=(s.x0+s.x1)/2,a=(s.z0+s.z1)/2,r=s.x1-s.x0,l=s.z1-s.z0,h=Math.hypot(r,l)*.8+20,c=s.y0-.06,u=e?new Dt({color:i.ground.disc,roughness:1,transparent:!0,alphaMap:vi(),depthWrite:!1}):new mt({color:i.ground.disc,transparent:!0,alphaMap:vi(),depthWrite:!1}),d=new q(new Me(2*h,2*h).rotateX(-Math.PI/2),u);d.position.set(o,c,a),d.receiveShadow=e,d.name="ground",d.renderOrder=-2;const p=new q(new Qt(r+3,0,l+3),new mt({map:Xr(),color:0,transparent:!0,opacity:i.ground.contact,depthWrite:!1}));p.position.set(o,c+.01,a),p.name="ground-contact",p.renderOrder=-1;const m=new ze(i.horizon.radius,i.horizon.radius,i.horizon.height,64,1,!0),w=new q(m,new mt({color:i.horizon.color,alphaMap:Jr(),transparent:!0,side:Is,depthWrite:!1,fog:!1}));w.position.set(o,c+i.horizon.height/2,a),w.name="horizon",w.renderOrder=-3;const v=new bo(400,32,16);v.setAttribute("color",new tt(new Float32Array(v.getAttribute("position").count*3),3));const g=new q(v.clone(),new mt({vertexColors:!0,side:Is,toneMapped:!1,fog:!1,depthWrite:!1}));g.frustumCulled=!1,g.renderOrder=-10,g.name="sky",g.position.set(o,0,a);const z=new is,k=new q(v,g.material);z.add(k);const P=[],E=(_,$,f)=>{const b=new q(new Me(_,$),new mt({color:16777215,side:Ct,toneMapped:!1,fog:!1}));b.position.set(...f),b.lookAt(0,0,0),b.userData.ownMaterial=!0,P.push(b),z.add(b)};E(260,260,[0,180,0]),E(220,90,[-200,60,60]),E(160,70,[170,40,-150]);for(const _ of[g,w,d,p])_.userData.ownMaterial=!0;for(const _ of[g,w,d,p])_.userData.skipAO=!0;return g.userData.extra=[...P,k],n.add(g,w,d,p),{root:n,dome:g,domeScene:z,disc:d,contact:p,band:w,softboxes:P,iblDome:k}}function ll(s,t){const e=t==="dark"?.55:1,i=Math.max(0,Math.min(1,s.day)),n=Math.max(0,Math.min(1,s.night)),o=(1.25*i+.06*n)*e,a=(.55*i+.03*n)*e,r=(.35*i+.22*n)*e;return[[o,o,o*1.02],[a*.96,a,a*1.06],[r,r*.78,r*.55]]}function hl(s,t,e,i,n){const o=j[n];s.dome.visible=e,s.band.visible=t==="sky";const a=s.disc.material,r=t==="studio";s.disc.scale.setScalar(r&&!e?Rt.discScale:1);const l=a.isMeshStandardMaterial===!0;if(r){const u=new et(Rt.disc[n]).lerp(new et(Rt.discNight[n]),i.night);l?(a.color.copy(u).multiplyScalar(.15),a.emissive.copy(u)):a.color.copy(u)}else a.color.setHex(o.ground.disc).lerp(new et(o.ground.discNight),i.night),l&&a.emissive.setRGB(0,0,0);s.contact.material.opacity=r&&!e?Math.min(.8,o.ground.contact*1.6):o.ground.contact;const h=s.iblDome?.geometry.getAttribute("color"),c=s.dome.geometry.getAttribute("color");!h||h===c||(r?cl(s.dome,i,n):c.array.set(h.array),c.needsUpdate=!0)}function cl(s,t,e){const[i,n,o]=ds(t,e,"studio").map(c=>new et(c)),a=s.geometry.getAttribute("position"),r=s.geometry.getAttribute("color"),l=new N,h=new et;for(let c=0;c<a.count;c++)l.fromBufferAttribute(a,c).normalize(),l.y>=0?h.copy(n).lerp(i,Math.pow(l.y,.6)):h.copy(n).lerp(o,Math.min(1,-l.y*4)),r.setXYZ(c,h.r,h.g,h.b)}const Rt={day:{light:["#1b2536","#3a4a63","#0d121b"],dark:["#0c121d","#1e2b40","#05080d"]},night:{light:["#080d18","#1f2e4a","#03050a"],dark:["#05080f","#142037","#020306"]},disc:{light:724758,dark:527121},discNight:{light:922655,dark:593173},discScale:.42};function dl(s,t,e,i){const n=j[i],o=(s.iblDome??s.dome).geometry,a=o.getAttribute("position"),r=o.getAttribute("color"),l=new N,h=new N(...e).normalize(),c=n.rig.skyScale,u=t.hemiGround.map(d=>(d*.9+.1)*n.backdrop.groundTint);for(let d=0;d<a.count;d++){l.fromBufferAttribute(a,d).normalize();let p;if(l.y<0)p=u;else{const v=Math.pow(l.y,.55);p=[0,1,2].map(g=>(t.skyHorizon[g]+(t.skyTop[g]-t.skyHorizon[g])*v)*c)}const m=Math.max(0,l.dot(h)),w=h.y>-.05?Math.pow(m,400)*.9+Math.pow(m,12)*.18*t.day:0;r.setXYZ(d,Math.min(1,p[0]+w*t.sunColor[0]),Math.min(1,p[1]+w*t.sunColor[1]),Math.min(1,p[2]+w*t.sunColor[2]))}r.needsUpdate=!0,ll(t,i).forEach((d,p)=>{const m=s.softboxes?.[p];m&&m.material.color.setRGB(d[0],d[1],d[2])})}function ds(s,t,e="sky"){const i=j[t];if(e==="studio"){const c=m=>[1,3,5].map(w=>parseInt(m.slice(w,w+2),16)),u=Rt.day[t],d=Rt.night[t],p=Math.max(0,Math.min(1,s.night));return[0,1,2].map(m=>`rgb(${c(u[m]).map((w,v)=>Math.round(w+(c(d[m])[v]-w)*p)).join(", ")})`)}const n=c=>[parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255],o=c=>`rgb(${c.map(u=>Math.round(Math.max(0,Math.min(1,u))*255)).join(", ")})`,a=(c,u)=>o(c.map((d,p)=>(d+u[p])/2)),r=s.night>.5,l=n(r?i.backdrop.topNight:i.backdrop.topDay),h=n(r?i.backdrop.horizonNight:i.backdrop.horizonDay);return[a(l,s.skyTop.map(c=>c*i.rig.skyScale)),a(h,s.skyHorizon.map(c=>c*i.rig.skyScale)),o(s.hemiGround.map(c=>c*i.backdrop.groundTint*.9+.08))]}function ki(s){const[t,e,i]=ko(s);return new et(t,e,i)}const xi=()=>Wn;function ul(s){s.traverse(t=>{const e=t;if(e.isMesh||t.isLineSegments){e.userData.shared||e.geometry?.dispose();const i=e.material;e.userData.ownMaterial&&i&&!Array.isArray(i)&&i.dispose();for(const n of e.userData.extra??[])n.geometry.dispose(),n.material.dispose()}})}const pl="sw-plan3d-ao",Ft="volumes",fl=12;function Ro(){return new Promise(s=>{try{if(typeof indexedDB>"u")return s(null);const t=indexedDB.open(pl,1);t.onupgradeneeded=()=>{const e=t.result;e.objectStoreNames.contains(Ft)||e.createObjectStore(Ft,{keyPath:"key"}).createIndex("at","at")},t.onsuccess=()=>s(t.result),t.onerror=()=>s(null),t.onblocked=()=>s(null)}catch{s(null)}})}async function ml(s){const t=await Ro();if(!t)return null;try{return await new Promise(e=>{const i=t.transaction(Ft,"readonly").objectStore(Ft).get(s);i.onsuccess=()=>{const o=i.result?.volume;e(o&&o.key===s&&o.data instanceof Uint8Array?o:null)},i.onerror=()=>e(null)})}catch{return null}finally{t.close()}}async function Mi(s){const t=await Ro();if(t)try{await new Promise(e=>{const i=t.transaction(Ft,"readwrite"),n=i.objectStore(Ft);n.put({key:s.key,at:Date.now(),volume:s});const o=n.index("at").getAllKeys();o.onsuccess=()=>{const a=o.result;for(const r of a.slice(0,Math.max(0,a.length-fl)))n.delete(r)},i.oncomplete=()=>e(),i.onerror=()=>e(),i.onabort=()=>e()})}catch{}finally{t.close()}}let pt,wl=0;const Kt=new Map;function gl(){if(pt!==void 0)return pt;try{pt=typeof Worker>"u"?null:new Worker(new URL(""+new URL("ao-volume.worker-BzTe3uRf.js",import.meta.url).href,import.meta.url),{type:"module"}),pt&&(pt.onmessage=s=>{const t=Kt.get(s.data.id);t&&(Kt.delete(s.data.id),s.data.error?t.reject(new Error(s.data.error)):t.resolve(s.data.volume??null))},pt.onerror=s=>{s.preventDefault(),pt?.terminate(),pt=null;for(const t of Kt.values())t.reject(new Error("ao worker failed"));Kt.clear()})}catch{pt=null}return pt}const vl=()=>new Promise(s=>setTimeout(s,0));async function bl(s,t,e=!0){if(e){const o=await ml(t);if(o)return{volume:o,source:"cache"}}const i=gl();if(i)try{const o=++wl,a=await new Promise((r,l)=>{Kt.set(o,{resolve:r,reject:l}),i.postMessage({id:o,input:s})});return a&&e&&Mi(a),{volume:a,source:"worker"}}catch{}const n=await wr(s,{yieldSlice:vl,now:()=>performance.now()});return n&&e&&Mi(n),{volume:n,source:"main"}}const yl=350,Io=650,kl=.06,xl=.6,Ue=3e3,Si=45,re=8,us=2048,Ai={objectShadows:!0,lambertObjects:!1,shadowMapPx:us,occlusion:!0},_i={objectShadows:!1,lambertObjects:!0,shadowMapPx:1024,occlusion:!0},Pi=.28,Ml=180,Sl=.4,Al=8,_l=64,Pl=6,$l=.35,zl=.88,$i=8,jt=Math.PI/2-.02,El=new Set(["glow","cone","tint"]),Tl=new Set(["wall","lintel","sill","head","door","object","connector","camera"]),Ll=new Set(["floor","wall","object","connector","room","tint","lintel","sill","head"]),Dl=new Set(["wall","lintel","sill","head","door","connector"]),ps=new Set(["chip","entity"]),Rl=new Set(["wall","object","connector"]),Il=.5,le=(()=>{const s=Math.hypot(-.6,1.1,-.25);return[-.6/s,1.1/s,-.25/s]})(),Cl="map-wall-3d",zi="map-structure",Ei=.025,Ti=16777215,Li=15133682,Di=2.1,Ri=16774108,Ii=3,Fl=1.12,Ci=2767974,Fi=857124,Oi=.75,he=12570879,Ni=.55,Ol=.9,Bi=2.6,qi=9347276,Nl=10334952,Bl=.55,ql=.35,We=[.55,.45,.7],Hl=160,Ul=100,Wl=new N,Hi=s=>[s.x0,s.x1,s.z0,s.z1,s.y0,s.y1].map(t=>t.toFixed(2)).join(",");function Ui(s){const t=new st(Nl,s);return t.name="night-fill",t.position.set(We[0]*10,We[1]*10,We[2]*10),t}function Ge(s){const t=new N(s.dir[0],Math.max(s.dir[1],-.2),s.dir[2]).normalize();return[t.x,t.y,t.z]}const Wi=s=>s.kind==="object"&&Math.max(s.size[0],s.size[1],s.size[2])<xl,je=s=>s.kind==="floor"?"floor":s.color==="map-glass"?"glass":s.kind==="object"?"object":"std",Yt=(s,t)=>s.length===t.length&&s.every((e,i)=>e===t[i]),Gl=(s,t)=>{if(!s||!t)return s===t;if(s.length!==t.length)return!1;for(let e=0;e<s.length;e++)if(s[e][0]!==t[e][0]||s[e][1]!==t[e][1])return!1;return!0},jl=(s,t)=>s.id===t.id&&s.kind===t.kind&&s.shape===t.shape&&s.color===t.color&&s.group===t.group&&s.level_id===t.level_id&&s.text===t.text&&Yt(s.position,t.position)&&Yt(s.size,t.size)&&Yt(s.rotation,t.rotation)&&Gl(s.polygon,t.polygon)&&(s.opacity===t.opacity||s.kind==="tint"),Kl=(s,t)=>s.text===t.text&&s.color===t.color&&s.opacity===t.opacity&&Yt(s.position,t.position)&&Yt(s.size,t.size)&&s.userData.id===t.userData.id&&s.userData.kind===t.userData.kind;function Xl(s,t){if(s===t||s.parts.length!==t.parts.length||s.levels.length!==t.levels.length||s.size[0]!==t.size[0]||s.size[1]!==t.size[1])return!1;for(let n=0;n<s.levels.length;n++){const o=s.levels[n],a=t.levels[n];if(o.id!==a.id||o.elevation_m!==a.elevation_m||o.ceiling_height_m!==a.ceiling_height_m)return!1}let e=!1,i=!1;for(let n=0;n<s.parts.length;n++){const o=s.parts[n],a=t.parts[n];if(ps.has(o.kind)&&o.kind===a.kind&&o.id===a.id&&o.level_id===a.level_id&&o.shape===a.shape){Kl(o,a)||(e=i=!0);continue}if(!jl(o,a))return!1;o.opacity!==a.opacity&&(e=!0)}return i&&(s.real||t.real)&&JSON.stringify(s.real??null)!==JSON.stringify(t.real??null)?!1:e}function Vl(){const s=[-.5,.5],t=[];for(const i of s)for(const n of s)t.push(-.5,i,n,.5,i,n),t.push(i,-.5,n,i,.5,n),t.push(i,n,-.5,i,n,.5);const e=new at;return e.setAttribute("position",new gt(t,3)),e}function Yl(){const t=document.createElement("canvas");t.width=64,t.height=64;const e=t.getContext("2d");if(e){const n=e.createImageData(64,64);for(let o=0;o<64;o++)for(let a=0;a<64;a++){const r=Math.abs((a+.5)/64-.5)*2,l=Math.abs((o+.5)/64-.5)*2,h=Math.max(r,l),c=Math.min(1,Math.max(0,(h-.5)/.5)),u=(1-c*c*(3-2*c))*.42,d=(o*64+a)*4;n.data[d+3]=Math.round(u*255)}e.putImageData(n,0,0)}const i=new $e(t);return i.colorSpace=Zt,i}function Zl(s,t){const e=[];for(const r of s){const l=e[e.length-1];(!l||Math.hypot(r[0]-l[0],r[1]-l[1])>1e-6)&&e.push(r)}for(;e.length>1&&Math.hypot(e[0][0]-e[e.length-1][0],e[0][1]-e[e.length-1][1])<=1e-6;)e.pop();if(e.length<3||!(t>0))return null;let i=0;for(let r=0;r<e.length;r++){const l=e[r],h=e[(r+1)%e.length];i+=l[0]*h[1]-h[0]*l[1]}if(Math.abs(i)<1e-8)return null;const n=xs.triangulateShape(e.map(([r,l])=>new kt(r,l)),[]),o=[];for(const[r,l,h]of n){const[c,u,d]=[e[r],e[l],e[h]];Math.abs((u[0]-c[0])*(d[1]-c[1])-(d[0]-c[0])*(u[1]-c[1]))<1e-10||(o.push(c[0],t,c[1],u[0],t,u[1],d[0],t,d[1]),o.push(c[0],0,c[1],d[0],0,d[1],u[0],0,u[1]))}for(let r=0;r<e.length;r++){const l=e[r],h=e[(r+1)%e.length];o.push(l[0],0,l[1],h[0],0,h[1],h[0],t,h[1],l[0],0,l[1],h[0],t,h[1],l[0],t,l[1])}const a=new at;return a.setAttribute("position",new gt(o,3)),a.computeVertexNormals(),a}class zs{constructor(t){this.opts=t,this.scene=new is,this.persp=new un(50,1,.05,2e3),this.ortho=new Cs(-1,1,1,-1,.05,4e3),this.active=this.persp,this.root=new ft,this.unitBox=new Qt(1,1,1),this.unitCylinder=new ze(.5,.5,1,24),this.unitPlane=new Me(1,1).rotateX(-Math.PI/2),this.boxEdges=Vl(),this.materials=new Map,this.aoMaterial=null,this.raycaster=new pn,this.glowPool=[],this.lights=new ft,this.sun=null,this.lookup=new Map,this.placed=new Map,this.tints=new Map,this.cones=[],this.cutPlanes=null,this.builds=0,this.smallGroups=[],this.outline=null,this.desc=null,this.extent=null,this.selectedId=null,this.preset="iso",this.orthoFrame=null,this.frameInsetsPx={...Ns},this.userCamera=!1,this.cutAzimuth=null,this.cutNow=new Set,this.caps=null,this.night=!1,this.framed=!1,this.hideSmall=!1,this.heavy=!1,this.heavyOverride=null,this.disposed=!1,this.continuous=!1,this.paused=!1,this.raf=0,this.frames=0,this.fps=0,this.windowStart=0,this.windowFrames=0,this.lastReport=0,this.pressed=null,this.lastHover=null,this.walking=null,this.realMats=null,this.realModels=null,this.realBuilt=null,this.exterior=null,this.post=null,this.postRung=null,this.postLoading=!1,this.pmrem=null,this.envTarget=null,this.envElevation=null,this.sunInput={utcMs:Date.now(),latitude:js.latitude,longitude:js.longitude},this.sunPos=null,this.recipe=Ks(45),this.rig=null,this.clipPlane=new fn(new N(0,-1,0),0),this.poolKey="",this.glowCarry=null,this.aoUniforms=vr(),this.aoKey=null,this.aoPending=0,this.aoEnabled=!0,this.aoLast=null,this.interior=null,this.anims=[],this.motion=!0,this.lastFrameInfo={calls:0,triangles:0},this.mergeFurniture=!0,this.restoredCount=0,this.onUserCamera=()=>{this.userCamera=!0},this.fittedKey="",this.onRestored=()=>{this.restoredCount++,this.markShadows(),!this.disposed&&this.quality===3&&(this.post?.dispose(),this.post=null,this.postRung=null,this.envTarget?.dispose(),this.envTarget=null,this.pmrem?.dispose(),this.pmrem=null,this.envElevation=null,this.ensurePost(),this.applyTime()),this.invalidate()},this.realDprCap=na,this.realRebuildTimer=0,this.builtModels=0,this.zoomGen=0,this.projSize=new kt,this.projV=new N,this.lastHitPoint=new N,this.onDown=i=>{i.isPrimary&&(this.pressed={x:i.clientX,y:i.clientY,id:i.pointerId})},this.onUp=i=>{const n=this.pressed;!n||i.pointerId!==n.id||(this.pressed=null,!(i.button!==0||Math.hypot(i.clientX-n.x,i.clientY-n.y)>Pl)&&this.opts.onSelect(this.pick(i.clientX,i.clientY),i.clientX,i.clientY))},this.onCancel=i=>{this.pressed?.id===i.pointerId&&(this.pressed=null)},this.onMove=i=>{if(this.pressed||i.pointerType==="touch"||!i.isPrimary)return;const n=this.pick(i.clientX,i.clientY),o=n?n.partId:null;if(o===this.lastHover)return;this.lastHover=o;const a=this.renderer.domElement.getBoundingClientRect();this.opts.onHover(n,i.clientX-a.left,i.clientY-a.top)},this.onLeave=()=>{this.lastHover!==null&&(this.lastHover=null,this.opts.onHover(null,0,0))},this.invalidate=()=>{this.disposed||this.raf||this.paused||(this.raf=requestAnimationFrame(this.frame))},this.frame=()=>{if(this.raf=0,this.disposed)return;const i=this.walking?this.stepFly():this.controls.update(),n=this.stepAnims(),o=this.stepInterior(),a=this.realBuilt?.glow?.tick(performance.now(),this.motion)??!1,r=i||n||o||a;if(this.hideSmall){const c=this.walking?!0:this.active===this.ortho?this.ortho.top/(this.ortho.zoom||1)<Si/2:this.persp.position.distanceTo(this.controls.target)<Si;for(const u of this.smallGroups)u.visible!==c&&(u.visible=c,this.markShadows())}this.updateCutaway(),this.drawFrame(),this.opts.onDraw?.(),this.frames++;const l=performance.now();this.windowStart||(this.windowStart=l),this.windowFrames++,l-this.windowStart>=1e3&&(this.fps=Math.round(this.windowFrames*1e3/(l-this.windowStart)),this.windowStart=l,this.windowFrames=0);const h=r||this.continuous;(!h||l-this.lastReport>=1e3)&&(this.lastReport=l,this.opts.onFrame(this.frames,this.fps)),h?this.invalidate():(this.windowStart=0,this.windowFrames=0)},this.interiorAt=0,this.quality=t.quality??1,this.night=!!t.night,this.real={...Br,...t.real??{}},typeof t.dprCap=="number"&&Number.isFinite(t.dprCap)&&t.dprCap>0&&(this.realDprCap=t.dprCap),this.renderer=new mn({antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.basePixelRatio=t.pixelRatio??Math.min(2,window.devicePixelRatio||1),this.renderer.setPixelRatio(this.basePixelRatio),this.renderer.outputColorSpace=Zt,this.renderer.shadowMap.type=Fs,this.outlineMaterial=new vo({color:new et(t.color("accent")),depthTest:!1,transparent:!0});const e=this.renderer.domElement;e.style.display="block",e.style.touchAction="none",t.mount.appendChild(e),this.controls=new wn(this.persp,e),this.controls.enableDamping=!0,this.controls.dampingFactor=.12,this.controls.maxPolarAngle=jt,this.controls.addEventListener("change",this.invalidate),this.controls.addEventListener("start",this.onUserCamera),this.scene.add(this.lights),this.applyQuality();for(let i=0;i<re;i++)this.glowPool.push(new gn(16777215,0,1,2));this.syncGlowPool(),this.scene.add(this.root),e.addEventListener("pointerdown",this.onDown),e.addEventListener("pointerup",this.onUp),e.addEventListener("pointermove",this.onMove),e.addEventListener("pointerleave",this.onLeave),e.addEventListener("pointercancel",this.onCancel),e.addEventListener("webglcontextrestored",this.onRestored),this.resize()}get camera(){return this.active}getQuality(){return this.quality}config(){return this.heavyOverride??(this.heavy?_i:Ai)}heavyConfig(){return{heavy:this.heavy,...this.config()}}setHeavyConfig(t){this.heavyOverride=t?{...this.heavy?_i:Ai,...t}:null;for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.desc=null,this.setDescription(e),this.setSelected(i)}this.invalidate()}rendererInfo(){const t=this.renderer.getContext(),e=t.getExtension("WEBGL_debug_renderer_info");return{vendor:String(e?t.getParameter(e.UNMASKED_VENDOR_WEBGL):t.getParameter(t.VENDOR)),renderer:String(e?t.getParameter(e.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER))}}benchFrames(t=60){const e=this.renderer.getContext(),i=new Uint8Array(4);this.controls.update(),this.updateCutaway();const n=()=>{this.drawFrame(),e.readPixels(0,0,1,1,e.RGBA,e.UNSIGNED_BYTE,i)};n();const o=performance.now();for(let a=0;a<t;a++)n();return(performance.now()-o)/t}setNight(t){if(t!==this.night){this.night=t,this.applyQuality();for(const e of this.glowPool)e.intensity>0&&(e.intensity=$i*(t?Bi:1));this.invalidate()}}getNight(){return this.night}setQuality(t){if(t!==this.quality){this.quality=t,this.applyQuality(),this.syncGlowPool();for(const{material:e}of this.materials.values())e.dispose();if(this.materials.clear(),this.desc){const e=this.desc,i=this.selectedId;this.setDescription(e),this.setSelected(i)}this.invalidate()}}applyQuality(){for(const e of[...this.lights.children])this.lights.remove(e),(e instanceof st||e instanceof Bt||e instanceof _t)&&e.dispose();this.sun=null,this.rig=null,this.cutAzimuth=null,this.cutNow.clear();const t=this.night;if(this.renderer.localClippingEnabled=this.quality===3,this.renderer.shadowMap.autoUpdate=!1,this.renderer.shadowMap.needsUpdate=!0,this.renderer.shadowMap.type=this.quality===3?vn:Fs,this.applyPixelRatio(),this.scene.environment=null,this.scene.fog=null,this.quality===3){this.applyRealRig();return}if(this.quality===2){this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=bn,this.renderer.toneMappingExposure=t?Ol:Fl,this.lights.add(t?new _t(Ci,Fi,Oi):new _t(Ti,Li,Di));const e=t?new st(he,Ni):new st(Ri,Ii);e.castShadow=!0,e.shadow.mapSize.set(us,us),e.shadow.bias=-4e-4,e.shadow.normalBias=.03,this.lights.add(e),this.lights.add(e.target),this.sun=e,this.fitSun(),t&&this.lights.add(Ui(Bl))}else{this.renderer.shadowMap.enabled=!1,this.renderer.toneMapping=yn,this.renderer.toneMappingExposure=1,this.lights.add(t?new Bt(qi,.7):new Bt(16777215,1.6));const e=t?new st(he,.5):new st(16777215,1.4);e.position.set(1,2,1.2),this.lights.add(e),t&&this.lights.add(Ui(ql))}}applyPixelRatio(){const t=this.quality===3?this.real.rung:this.quality===2?"full":"schematic",e=aa(t,this.basePixelRatio,this.realDprCap);this.renderer.getPixelRatio()!==e&&this.renderer.setPixelRatio(e),this.quality===3&&this.post?.setPixelRatio(e)}fitSun(){const t=this.sun,e=this.extent;if(!t||!e)return;const i=(e.x0+e.x1)/2,n=(e.y0+e.y1)/2,o=(e.z0+e.z1)/2,a=Math.max(Math.hypot(e.x1-e.x0,e.y1-e.y0,e.z1-e.z0)/2,2)*1.05+(this.quality===3?4:0),r=this.quality===3&&this.sunPos?Ge(this.sunPos):le;t.position.set(i+r[0]*a*2,n+r[1]*a*2,o+r[2]*a*2),t.target.position.set(i,n,o),t.target.updateMatrixWorld();const l=this.quality===3?this.real.rung==="realistic"&&!this.heavy?2048:1024:this.config().shadowMapPx;t.shadow.mapSize.x!==l&&(t.shadow.mapSize.set(l,l),t.shadow.map?.dispose(),t.shadow.map=null),this.quality===3&&this.real.rung==="realistic"&&(t.shadow.radius=Zn(a,l,j[this.real.style].rig.shadowRadius));const h=t.shadow.camera;h.left=-a,h.right=a,h.top=a,h.bottom=-a,h.near=.1,h.far=a*4,h.updateProjectionMatrix(),t.shadow.needsUpdate=!0,this.markShadows()}markShadows(){this.renderer.shadowMap.needsUpdate=!0}syncGlowPool(){const t=Pn(this.quality,this.glowPool.some(e=>e.intensity>0));for(const e of this.glowPool)t&&e.parent!==this.scene?this.scene.add(e):!t&&e.parent&&e.removeFromParent()}get glowLightsInScene(){return this.glowPool.filter(t=>t.parent===this.scene).length}refit(){this.opts.fit!=="content"||this.userCamera||this.walking||typeof this.preset!="string"||!this.desc||this.setPreset(this.preset)}frameInsetFractions(){const t=this.opts.mount;return Bs(this.frameInsetsPx,t.clientWidth||1,t.clientHeight||1)}setFrameInsets(t){const e=this.frameInsetsPx;e.top===t.top&&e.right===t.right&&e.bottom===t.bottom&&e.left===t.left||(this.frameInsetsPx={...t},this.refit())}applyRealRig(){const t=j[this.real.style].rig;this.renderer.shadowMap.enabled=!0,this.renderer.toneMapping=kn;const e=new _t(16777215,4478310,1),i=new st(16777215,3);i.castShadow=!0,i.shadow.bias=-4e-4,i.shadow.normalBias=.025,i.shadow.blurSamples=12,i.shadow.radius=this.real.rung==="realistic"?t.shadowRadius:3;const n=new st(12570879,0),o=new st(8177919,0);this.lights.add(e,i,i.target,n,o),this.sun=i,this.rig={hemi:e,sun:i,moon:n,rim:o},this.fitSun(),this.applyTime()}applyTime(){if(this.quality!==3||!this.rig)return;const e=j[this.real.style].rig,i=this.desc?.real?.north_deg??0,n=Qn(this.sunInput.utcMs,this.sunInput.latitude,this.sunInput.longitude,i);this.sunPos=n;const o=Ks(n.elevation);this.recipe=o;const{hemi:a,sun:r,moon:l,rim:h}=this.rig,c=this.interior?(e.interiorFill[0]+(e.interiorFill[1]-e.interiorFill[0])*this.interior.value)*.7:1;r.intensity=o.sunIntensity*.55*e.sunScale,r.color.setRGB(o.sunColor[0],o.sunColor[1],o.sunColor[2]),r.visible=n.elevation>-3,r.castShadow=n.elevation>-3,a.color.setRGB(o.hemiSky[0],o.hemiSky[1],o.hemiSky[2]),a.groundColor.setRGB(o.hemiGround[0],o.hemiGround[1],o.hemiGround[2]),a.intensity=o.hemiIntensity*e.hemiScale*c,l.intensity=o.moon*e.moonScale;const u=this.extent,d=u?new N((u.x0+u.x1)/2,0,(u.z0+u.z1)/2):new N,p=u?Math.hypot(u.x1-u.x0,u.z1-u.z0)+10:20;if(l.position.copy(d).add(new N(-p,p*.9,p*.4)),l.target=r.target,e.rim){const m=Ge(n);h.color.setHex(e.rim.color),h.intensity=e.rim.intensity*(this.walking?.6:1),h.position.copy(d).addScaledVector(new N(-m[0],.5,-m[2]).normalize(),p),h.target=r.target}else h.intensity=0;if(this.renderer.toneMappingExposure=o.exposure*(e.exposureDay+(e.exposureNight-e.exposureDay)*o.night)*(this.walking?1.05:1),this.fitSun(),this.scene.environmentIntensity=(e.envNight+(e.envDay-e.envNight)*o.day)*c,this.walking){const m=e.fog,w=new et(m.color).multiplyScalar(1-o.night*.6);this.real.backdrop==="studio"&&w.set(ds(o,this.real.style,"studio")[2]),this.scene.fog=new xn(w.getHex(),m.density)}else this.scene.fog=null;if(this.exterior){dl(this.exterior,o,Ge(n),this.real.style),hl(this.exterior,this.real.backdrop??"sky",!!this.walking,o,this.real.style);const m=Math.round(n.elevation)*1e3+Math.round(n.azimuth/5);if(m!==this.envElevation){this.envElevation=m,this.pmrem??=new Mn(this.renderer);const w=this.pmrem.fromScene(this.exterior.domeScene,0,1,1e3);this.envTarget?.dispose(),this.envTarget=w}this.scene.environment=this.envTarget?.texture??null}this.applyLamps(),this.realBuilt?.glow?.setLook(this.real.style,o.night),this.post?.setLook(this.real.style,o.night),this.renderer.shadowMap.needsUpdate=!0,this.invalidate()}applyLamps(){if(this.quality!==3)return;const t=this.desc?.real,e=j[this.real.style].rig,i=this.recipe.night,n=(t?.lamps??[]).map(l=>({...l}));for(const l of this.desc?.parts??[])l.kind==="glow"&&l.userData.kind==="entity"&&n.push({id:l.id,owner:l.id,level_id:l.level_id??"",position:l.position,kind:"ceiling",color_k:3e3,lumens:800,on:!0});for(const[l,h]of this.realBuilt?.bulbs??[]){const c=n.find(u=>u.id===`lamp:${l}`);c?.on?(h.emissive.copy(ki(c.color_k)),h.emissiveIntensity=e.lampEmissiveDay+(e.lampEmissiveNight-e.lampEmissiveDay)*i):h.emissiveIntensity=0}const o=this.active.position,a=Xs(n,[o.x,o.y,o.z],re);this.poolKey=a.map(l=>l.id).join(",");const r=e.lampPoolDay+(e.lampPoolNight-e.lampPoolDay)*i;this.glowPool.forEach((l,h)=>{const c=a[h];if(!c){l.intensity=0;return}const u=c.kind==="floor"?6:c.kind==="wall"?5:11;l.color.copy(ki(c.color_k)),l.intensity=u*r*Math.min(2,Math.max(.4,Math.sqrt(c.lumens/1200))),l.distance=0,l.decay=2;const d=c.kind==="floor"||c.kind==="wall"?.05:c.kind==="pendant"?.25:.45;l.position.set(c.position[0],c.position[1]-d,c.position[2])})}applyCut(){if(this.quality!==3||!this.realMats)return;const t=this.desc,e=t&&t.levels.length?[...t.levels].sort((r,l)=>l.elevation_m-r.elevation_m||(r.id<l.id?-1:1))[0]:null,i=!!e&&this.real.sectionCut&&!this.walking&&typeof this.preset=="string",n=e?Nr(e,this.real.wallCut):0;this.clipPlane.constant=n,this.realMats.setClip(i?[this.clipPlane]:null);for(const r of this.cones)Array.isArray(r.material)||(r.material.clippingPlanes=i?[this.clipPlane]:null);this.cutPlanes=i?[this.clipPlane]:null,this.post?.setClip(this.cutPlanes),this.realBuilt?.glow?.setClip(this.cutPlanes);const o=this.realBuilt?.caps,a=e?n-(e.elevation_m+e.ceiling_height_m*.6):0;if(o)for(const r of o.children)r.visible=i&&r.userData.level===e.id&&(!r.userData.edge||j[this.real.style].cut.edge!==null),r.position.y=r.userData.level===e?.id?a:0;this.realBuilt?.glow?.setCut(i?n:null,i?e.id:null),this.renderer.shadowMap.needsUpdate=!0}setRealSettings(t){const e=this.real,{dprCap:i,motion:n,...o}=t;typeof n=="boolean"&&(this.motion=n);const a=typeof i=="number"&&Number.isFinite(i)&&i>0&&i!==this.realDprCap;if(a&&(this.realDprCap=i),this.real={...this.real,...o},this.quality!==3)return;const r=e.rung!==this.real.rung||e.furniture!==this.real.furniture||e.textures!==this.real.textures||e.floorFinish!==this.real.floorFinish||JSON.stringify(e.marks??null)!==JSON.stringify(this.real.marks??null);if(e.style!==this.real.style){this.realMats?.setStyle(this.real.style);const l=j[this.real.style];this.exterior&&(this.exterior.band.material.color.setHex(l.horizon.color),this.exterior.contact.material.opacity=l.ground.contact);for(const h of this.realBuilt?.caps?.children??[]){const c=h.material;h.userData.edge?c.color.setHex(l.cut.edge??l.cut.cap):c.color.setHex(l.cut.cap)}this.envElevation=null,this.recolour(),r||this.applyTime()}else e.backdrop!==this.real.backdrop&&!r&&this.applyTime();this.post?.setReflections(this.real.reflections!==!1),r?(this.realMats?.setRung(this.real.rung),this.realMats?.setSource(this.real.textures),this.applyQuality(),this.rebuildNow()):(this.applyCut(),a&&this.applyPixelRatio()),this.invalidate()}getRealSettings(){return{...this.real}}setSun(t){this.sunInput={...this.sunInput,...t},this.applyTime()}sunState(){return this.sunPos?{elevation:this.sunPos.elevation,azimuth:this.sunPos.azimuth,night:this.recipe.night,day:this.recipe.day}:null}skyBackdrop(){return ds(this.recipe,this.real.style,this.real.backdrop??"sky")}setInterior(t){t===null?this.interior=null:this.interior={target:t,value:this.interior?.value??t},this.applyTime()}get realPending(){return(this.realMats?.pending??0)+(this.realModels?.pending??0)+(this.postLoading?1:0)+this.aoPending}get postPasses(){return this.post?.passes??[]}get floorReflections(){return this.post?.reflections??!1}get postClip(){return this.post?.clip?.map(t=>Math.round(t.constant*1e3)/1e3)??null}get realStats(){return this.realBuilt?.stats??null}requestBakedAo(t){const e=pr(t),i=Po(e);if(i===this.aoKey)return;this.aoKey=i,di(this.aoUniforms,null),this.post?.setBakedAo(!1),this.aoPending++;const n=performance.now();bl(e,i).then(({volume:o,source:a})=>{this.disposed||this.aoKey!==i||(this.setVolume(o),this.aoLast=o?{key:i,source:a,ms:Math.round(performance.now()-n),dims:[...o.plan.dims],bytes:o.data.length,bakeMs:o.stats.ms}:null)}).catch(o=>console.warn("sw-plan-3d: baked AO failed, drawing without it",o)).finally(()=>{this.aoPending--,!this.disposed&&(this.opts.onAsset?.(),this.invalidate())})}setVolume(t){di(this.aoUniforms,t),this.aoEnabled||(this.aoUniforms.swAoStrength.value=0),this.post?.setBakedAo(!!t&&this.aoEnabled)}setBakedAo(t){this.aoEnabled=t;const e=this.aoLast!==null&&this.aoUniforms.swAoVol.value.image.width>1;this.aoUniforms.swAoStrength.value=t&&e?Ee.strength:0,this.post?.setBakedAo(t&&e),this.invalidate()}get bakedAo(){return this.aoLast?{...this.aoLast,strength:this.aoUniforms.swAoStrength.value,gtao:this.post?.gtaoState??null}:null}get postGrade(){return this.post?.grade??null}get realRoughness(){return this.realMats?.roughnessOf()??{}}ensurePost(){if(this.quality!==3||this.postLoading||this.post&&this.postRung===this.real.rung)return;this.post?.dispose(),this.post=null,this.postLoading=!0;const t=this.real.rung;Xo(async()=>{const{PostChain:e}=await import("./post-chain-CIYzTqsp.js");return{PostChain:e}},__vite__mapDeps([0]),import.meta.url).then(({PostChain:e})=>{if(this.disposed||this.quality!==3||this.real.rung!==t)return;const i=this.opts.mount.clientWidth||1,n=this.opts.mount.clientHeight||1;this.post=new e(this.renderer,this.scene,this.active,t,i,n,this.real.style),this.post.setLook(this.real.style,this.recipe.night),this.post.setClip(this.cutPlanes),this.post.setBakedAo(this.aoEnabled&&this.aoUniforms.swAoStrength.value>0),this.post.setReflections(this.real.reflections!==!1),this.postRung=t}).catch(e=>console.warn("sw-plan-3d: post chain failed to load, drawing without it",e)).finally(()=>{this.postLoading=!1,this.opts.onAsset?.(),this.invalidate()})}rebuildNow(){if(!this.desc)return;const t=this.desc,e=this.selectedId;this.desc=null,this.setDescription(t),this.setSelected(e)}stateOf(t){return this.quality!==3?null:t==="danger"?"open_door":t==="map-presence"?"presence":null}material(t,e,i=!1,n="std"){const o=this.quality>=2&&n==="object"&&this.config().lambertObjects,a=this.stateOf(t),r=`${t}|${e}|${i?2:1}|${this.quality>=2?o?"object-lambert":n:"l1"}${a?`|s3:${this.real.style}`:""}`;let l=this.materials.get(r);if(!l){const h=i?{side:Ct,forceSinglePass:!0}:{},c=this.quality>=2&&t===zi&&n==="std"?Cl:t,u=a?new et(j[this.real.style].states[a]):new et(this.opts.color(c));let d;this.quality>=2&&n==="glass"?d=new Dt({color:u,roughness:.12,metalness:.25,transparent:!0,opacity:Math.max(e,.35),depthWrite:!1,side:Ct,forceSinglePass:!0}):a==="open_door"?d=new Dt({color:u,emissive:u,emissiveIntensity:.9,roughness:.6,metalness:0,...h}):this.quality>=2&&!o?d=new Dt({color:u,roughness:n==="floor"?1:.88,metalness:0,transparent:e<1,opacity:e,depthWrite:e>=1,...h}):d=new Sn({color:u,transparent:e<1,opacity:e,depthWrite:e>=1,...h}),l={token:c,material:d,state:a},this.materials.set(r,l)}return l.material}recolour(){for(const{token:t,material:e,state:i}of this.materials.values())i?(e.color.set(j[this.real.style].states[i]),"emissive"in e&&e.emissiveIntensity>0&&e.emissive.copy(e.color)):e.color.set(this.opts.color(t));for(const t of this.tints.values()){const e=t.userData.state;e&&!Array.isArray(t.material)&&t.material.color.set(j[this.real.style].states[e])}this.outlineMaterial.color.set(this.opts.color("accent"))}statePart(t){return t.kind!=="tint"?t:t.id.endsWith("#lit")||t.id.endsWith("#presence-ring")||t.id.endsWith("#presence")||t.id.endsWith("#alarm")?null:t}transform(t,e){t.position.set(e.position[0],e.position[1],e.position[2]),t.quaternion.setFromEuler(new ht(X(e.rotation[0]),X(e.rotation[1]),X(e.rotation[2]),"YXZ"))}plateOpacity(t,e=this.desc){const i=e?.levels??[];if(t.kind!=="floor"||i.length<2)return t.opacity;const n=Math.min(...i.map(a=>a.elevation_m)),o=i.find(a=>a.id===t.level_id);return o&&o.elevation_m>n?Math.min(t.opacity,$l):t.opacity}shadows(t,e){if(this.quality<2)return;const i=this.config().objectShadows;t.castShadow=(i?Tl:Dl).has(e.kind)&&e.color!=="map-glass",t.receiveShadow=Ll.has(e.kind)&&(i||e.kind!=="object")}label(t){const e=document.createElement("canvas");e.width=512,e.height=128;const i=e.getContext("2d");i&&(i.globalAlpha=zl,i.fillStyle=this.opts.color("surface"),i.beginPath(),i.roundRect(8,16,496,96,48),i.fill(),i.globalAlpha=1,i.fillStyle=this.opts.color(t.color),i.font='bold 44px Heebo, "Segoe UI", Arial, sans-serif',i.textAlign="center",i.textBaseline="middle",i.direction="rtl",i.fillText(t.text??"",256,66,480));const n=new $e(e);n.colorSpace=Zt;const o=new Os(new An({map:n,transparent:!0,depthTest:!0}));return o.position.set(t.position[0],t.position[1],t.position[2]),o.scale.set(Math.max(t.size[0],.5),Math.max(t.size[1],.2),1),o}single(t,e){if(t.shape==="box"||t.shape==="cylinder"){const i=new q(t.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(t.color,this.plateOpacity(t,e),!1,je(t)));return this.transform(i,t),i.scale.set(Math.max(t.size[0],.001),Math.max(t.size[1],.001),Math.max(t.size[2],.001)),this.shadows(i,t),i}if(t.shape==="prism"){const i=Zl(t.polygon??[],t.size[1]);if(!i)return null;const n=this.material(t.color,t.opacity,!0,je(t)),o=t.kind==="tint"||t.kind==="cone"?n.clone():n,a=new q(i,o);return t.kind==="tint"?(a.userData.ownMaterial=!0,a.userData.state=this.stateOf(t.color)):t.kind==="cone"&&(a.userData.ownMaterial=!0,a.userData.cone=!0),a.position.set(t.position[0],t.position[1],t.position[2]),this.shadows(a,t),a}return ps.has(t.kind)||t.kind==="label"&&this.opts.fit==="content"?null:t.shape==="sprite"?this.label(t):null}occlusion(t,e){if(this.quality!==2||!this.config().occlusion)return null;const i=new Map(e.levels.map(d=>[d.id,d.elevation_m])),n=e.levels.length?Math.min(...e.levels.map(d=>d.elevation_m)):0,o=t.filter(d=>Rl.has(d.kind)&&(d.shape==="box"||d.shape==="cylinder")&&d.position[1]-d.size[1]/2<=(i.get(d.level_id??"")??n)+Il);if(!o.length)return null;this.aoMaterial||(this.aoMaterial=new mt({map:Yl(),color:0,transparent:!0,depthWrite:!1}));const a=new vt(this.unitPlane,this.aoMaterial,o.length),r=new ot,l=new bt,h=new ht,c=new N,u=new N;return o.forEach((d,p)=>{l.setFromEuler(h.set(0,X(d.rotation[1]),0,"YXZ")),c.set(d.position[0],d.position[1]-d.size[1]/2+.012,d.position[2]),u.set(d.size[0]+2*Pi,1,d.size[2]+2*Pi),r.compose(c,l,u),a.setMatrixAt(p,r)}),a.instanceMatrix.needsUpdate=!0,a.computeBoundingSphere(),a.name="ao",a.renderOrder=1,a}realise(t,e,i=!1){const n={root:new ft,lookup:new Map,small:[],placed:new Map,glows:[],ao:null,real:null},o=new Map,a=[];if(this.quality===3&&!i&&e.real){this.realMats??=new Gr(this.opts.assetBase??xi(),()=>this.onRealAsset()),this.realMats.ao=this.aoUniforms,this.realModels??=new Kr(this.opts.assetBase??xi(),()=>this.onRealAsset()),this.realMats.setStyle(this.real.style),this.realMats.setRung(this.real.rung),this.realMats.setSource(this.real.textures);const d={night:this.recipe.night,prev:this.motion?this.glowCarry:null,now:performance.now()},p=sl({desc:e,real:e.real,parts:t,settings:this.real,heavy:e.parts.length>Ue,mats:this.realMats,models:this.realModels,glow:d,mergeFurniture:this.mergeFurniture});n.real=p,n.root.add(p.root);for(const[m,w]of p.lookup)n.lookup.set(m,w);t=t.filter(m=>!Lo.has(m.kind)).map(m=>this.statePart(m)).filter(m=>m!==null)}for(const d of t)if(d.group&&(d.shape==="box"||d.shape==="cylinder")){const p=o.get(d.group);p?p.push(d):o.set(d.group,[d])}else a.push(d);const r=new ot,l=new bt,h=new N,c=new N,u=new ht;for(const[d,p]of o){const m=p[0],w=new vt(m.shape==="cylinder"?this.unitCylinder:this.unitBox,this.material(m.color,m.opacity,!1,je(m)),p.length);p.forEach((v,g)=>{l.setFromEuler(u.set(X(v.rotation[0]),X(v.rotation[1]),X(v.rotation[2]),"YXZ")),h.set(v.position[0],v.position[1],v.position[2]),c.set(Math.max(v.size[0],.001),Math.max(v.size[1],.001),Math.max(v.size[2],.001)),r.compose(h,l,c),w.setMatrixAt(g,r),n.placed.set(v.id,{obj:w,index:g,part:v})}),w.instanceMatrix.needsUpdate=!0,w.computeBoundingSphere(),w.name=d,this.shadows(w,m),n.lookup.set(w,p),n.root.add(w),p.every(Wi)&&n.small.push(w)}for(const d of a){if(d.shape==="light"){n.glows.push(d);continue}const p=this.single(d,e);p&&(p.name=d.id,El.has(d.kind)||n.lookup.set(p,[d]),p instanceof q&&(d.shape==="box"||d.shape==="cylinder")&&n.placed.set(d.id,{obj:p,index:0,part:d}),n.root.add(p),Wi(d)&&n.small.push(p))}return n.ao=this.occlusion(t,e),n.ao&&n.root.add(n.ao),n}disposeGroup(t){for(const e of[...t.children]){if(t.remove(e),e.name==="real"||e.name==="exterior"){ul(e);continue}e instanceof vt?e.dispose():e instanceof q&&e.geometry!==this.unitBox&&e.geometry!==this.unitCylinder&&e.geometry.dispose(),e instanceof q&&e.userData.ownMaterial&&!Array.isArray(e.material)&&e.material.dispose(),e instanceof Os&&(e.material.map?.dispose(),e.material.dispose())}}clear(){this.setSelected(null),this.disposeGroup(this.root);for(const t of this.glowPool)t.intensity=0;this.lookup.clear(),this.placed.clear(),this.tints.clear(),this.cones=[],this.smallGroups=[],this.cutAzimuth=null,this.cutNow.clear(),this.caps=null,this.realBuilt=null,this.exterior=null,this.envElevation=null}onRealAsset(){this.invalidate();const t=this.realModels?.version??0;this.quality===3&&t!==this.builtModels&&!this.realRebuildTimer&&(this.realRebuildTimer=window.setTimeout(()=>{this.realRebuildTimer=0,!this.disposed&&this.quality===3&&this.rebuildNow()},30)),this.opts.onAsset?.()}setDescription(t){if(this.desc&&Xl(this.desc,t)){for(const o of t.parts){if(o.kind!=="tint")continue;const a=this.quality===3&&t.real?this.statePart(o):o,r=this.tints.get(o.id);a&&r&&!Array.isArray(r.material)&&(r.material.opacity=a.opacity)}this.realBuilt?.glow?.updateWeights(Do(t,t.parts)),this.desc=t,this.invalidate();return}const e=new Map;for(const[o,a]of this.realBuilt?.leaves??[])e.set(o,{p:a.position.clone(),q:a.quaternion.clone(),sy:a.scale.y});for(const[o,a]of this.realBuilt?.shutters??[])e.set(o,{p:a.mesh.position.clone(),q:a.mesh.quaternion.clone(),sy:a.mesh.scale.y});this.anims=[],this.glowCarry=this.realBuilt?this.realBuilt.glow?.state()??new Map:null,this.clear(),this.markShadows(),this.recolour(),this.desc=t,this.extent=$n(t),this.heavy=t.parts.length>Ue,this.builds++,this.builtModels=this.realModels?.version??0;const i=this.realise(t.parts,t);if(this.realBuilt=i.real,i.real&&this.requestBakedAo(t),i.real&&this.extent){this.exterior=rl(this.extent,this.real.style,this.real.rung==="realistic"),this.root.add(this.exterior.root);const o=performance.now(),a=(r,l)=>{const h=e.get(r);if(!h||!this.motion)return;const c={p:l.position.clone(),q:l.quaternion.clone(),sy:l.scale.y};h.p.distanceTo(c.p)<1e-4&&h.q.angleTo(c.q)<1e-4&&Math.abs(h.sy-c.sy)<1e-4||(l.position.copy(h.p),l.quaternion.copy(h.q),l.scale.y=h.sy,l.visible=!0,this.anims.push({obj:l,from:h,to:c,t0:o,ms:yl}))};for(const[r,l]of i.real.leaves)a(r,l);for(const[r,l]of i.real.shutters)a(r,l.mesh)}for(const o of[...i.root.children])this.root.add(o),o instanceof q&&o.userData.cone?this.cones.push(o):o instanceof q&&o.userData.ownMaterial&&this.tints.set(o.name,o);this.lookup=i.lookup,this.placed=i.placed,this.smallGroups=i.small;let n=0;for(const o of i.glows){const a=this.glowPool[n++];a&&(a.color.set(this.opts.color(o.color)),a.intensity=$i*(this.night?Bi:1),a.distance=Math.max(o.size[0],1),a.position.set(o.position[0],o.position[1],o.position[2]))}if(this.syncGlowPool(),this.hideSmall=t.parts.length>Ue,!this.hideSmall)for(const o of this.smallGroups)o.visible=!0;this.fitSun(),this.framed?this.opts.fit==="content"&&Hi(qs(t))!==this.fittedKey&&this.refit():this.framed=this.setPreset("iso"),this.updateCutaway(),this.quality===3&&(this.ensurePost(),this.applyCut(),this.applyTime()),this.invalidate()}stepAnims(){if(!this.anims.length)return!1;const t=performance.now();return this.anims=this.anims.filter(e=>{const i=Math.min(1,(t-e.t0)/e.ms),n=i<.5?2*i*i:1-Math.pow(-2*i+2,2)/2;return e.obj.position.lerpVectors(e.from.p,e.to.p,n),e.obj.quaternion.slerpQuaternions(e.from.q,e.to.q,n),e.obj.scale.y=e.from.sy+(e.to.sy-e.from.sy)*n,i>=1&&e.to.sy<=.001&&e.obj.name.startsWith("shutter:")&&(e.obj.visible=!1),i<1}),this.renderer.shadowMap.needsUpdate=!0,this.anims.length>0}setSelected(t){if(this.selectedId=t,this.outline&&(this.root.remove(this.outline),this.outline=null,this.invalidate()),!t||!this.desc)return;const e=this.desc.parts.filter(o=>o.userData.id===t&&o.kind!=="cone"&&o.kind!=="floor"&&o.kind!=="tint"&&!ps.has(o.kind)&&(o.shape==="box"||o.shape==="cylinder"||o.shape==="prism"||o.shape==="sprite")).slice(0,_l);if(!e.length)return;const i=new ft,n=new Map(this.desc.levels.map(o=>[o.id,o.elevation_m]));for(const o of e){const a=new go(this.boxEdges,this.outlineMaterial),r=this.cutNow.has(o.id)?Hs(o,n.get(o.level_id??"")??0,Fe):{y:o.position[1],h:o.size[1]};if(r){if(o.shape==="prism"){const l=o.polygon??[];if(!l.length)continue;const h=l.map(p=>p[0]),c=l.map(p=>p[1]),u=Math.max(...h)-Math.min(...h),d=Math.max(...c)-Math.min(...c);a.position.set(o.position[0]+(Math.max(...h)+Math.min(...h))/2,o.position[1]+o.size[1]/2,o.position[2]+(Math.max(...c)+Math.min(...c))/2),a.scale.set(u*1.04+.05,o.size[1]*1.04+.05,d*1.04+.05)}else this.transform(a,o),a.position.y=r.y,a.scale.set(o.size[0]*1.06+.05,r.h*1.06+.05,(o.shape==="sprite"?.1:o.size[2])*1.06+.05);a.renderOrder=10,i.add(a)}}this.outline=i,this.root.add(i),this.invalidate()}zoomBy(t){if(this.walking||!(t>0)||t===1)return;this.userCamera=!0;const e=this.extent,i=e?Math.max(4,Math.hypot(e.x1-e.x0,e.z1-e.z0)):20,n=performance.now(),o=this.active,a=o===this.ortho,r=this.ortho.zoom,l=Math.min(Al,Math.max(Sl,r*t)),h=this.persp.position.clone().sub(this.controls.target),c=h.length(),u=Math.min(i*4,Math.max(1.2,c/t)),d=++this.zoomGen,p=()=>{if(d!==this.zoomGen||this.disposed||this.active!==o)return;const m=this.motion?Math.min(1,(performance.now()-n)/Ml):1,w=1-Math.pow(1-m,3);a?(this.ortho.zoom=r+(l-r)*w,this.ortho.updateProjectionMatrix()):this.persp.position.copy(this.controls.target).addScaledVector(h,(c+(u-c)*w)/(c||1)),this.controls.update(),this.invalidate(),m<1&&requestAnimationFrame(p)};p()}useCamera(t){t!==this.active&&(this.active=t,this.controls.object=t)}applyOrthoFrame(){const t=this.orthoFrame;if(!t)return;const e=this.persp.aspect||1;let i=t.halfW,n=t.halfH;i/n<e?i=n*e:n=i/e,this.ortho.left=-i,this.ortho.right=i,this.ortho.top=n,this.ortho.bottom=-n,this.ortho.updateProjectionMatrix()}setPreset(t){const e=this.desc,i=this.extent;if(!e||!i)return!1;if(this.walking)return typeof t!="string"&&!e.parts.some(p=>p.id===t.camera&&p.kind==="camera")?!1:(this.walking.prevPreset=t,!0);const n=(i.x0+i.x1)/2,o=(i.z0+i.z1)/2,a=i.x1-i.x0,r=i.z1-i.z0,l=(p,m)=>Math.max(m,p/(this.persp.aspect||1),4)/(2*Math.tan(X(this.persp.fov/2))),h=Math.max(0,...e.levels.map(p=>p.elevation_m+p.ceiling_height_m)),c=this.opts.fit==="content"&&typeof t=="string"?qs(e):null;c&&(this.fittedKey=Hi(c));const u=this.opts.mount,d=c?Bs(this.frameInsetsPx,u.clientWidth||1,u.clientHeight||1):Ns;if(this.zoomGen++,typeof t=="string"&&(this.userCamera=!1),c&&(t==="top"||t==="persp")){this.useCamera(this.persp),this.controls.maxPolarAngle=jt;const p=zn(c,t==="top"?[0,1,0]:se,this.persp.fov,this.persp.aspect||1,d);this.persp.position.set(p.position[0],p.position[1],p.position[2]+(t==="top"?.001:0)),this.controls.target.set(p.target[0],p.target[1],p.target[2])}else if(t==="top")this.useCamera(this.persp),this.controls.maxPolarAngle=jt,this.persp.position.set(n,h+l(a,r)*1.2,o+.001),this.controls.target.set(n,0,o);else if(t==="iso"){this.useCamera(this.ortho),this.controls.maxPolarAngle=jt;const p=c?En(c,this.persp.aspect||1,d):Us(i,this.persp.aspect||1);this.orthoFrame=p,this.ortho.zoom=1,this.applyOrthoFrame(),this.ortho.position.set(p.target[0]+Pt[0]*p.dist,p.target[1]+Pt[1]*p.dist,p.target[2]+Pt[2]*p.dist),this.controls.target.set(p.target[0],p.target[1],p.target[2])}else if(t==="persp"){this.useCamera(this.persp),this.controls.maxPolarAngle=jt;const p=Math.hypot(a,r),m=l(p,p*.62)*1.45;this.persp.position.set(n+se[0]*m,se[1]*m,o+se[2]*m),this.controls.target.set(n,0,o)}else{const p=e.parts.find(w=>w.id===t.camera&&w.kind==="camera");if(!p)return!1;this.useCamera(this.persp);const m=new N(0,0,-1).applyEuler(new ht(X(p.rotation[0]),X(p.rotation[1]),X(p.rotation[2]),"YXZ"));this.controls.maxPolarAngle=Math.PI,this.persp.position.set(p.position[0],p.position[1],p.position[2]),this.controls.target.set(p.position[0]+m.x*6,p.position[1]+m.y*6,p.position[2]+m.z*6)}return this.preset=t,this.controls.update(),this.updateCutaway(),this.applyCut(),this.invalidate(),!0}walkQuaternion(t){return new bt().setFromEuler(new ht(X(t.pitch_deg),-X(t.heading_deg),0,"YXZ"))}enterWalk(t,e,i=Io){const n=this.active.position.clone(),o=this.active.quaternion.clone();this.walking||(this.walking={prevPreset:this.preset,fov:e,fly:null}),this.walking.fov=e,this.useCamera(this.persp),this.controls.enabled=!1,this.persp.fov=e,this.persp.near=kl,this.persp.updateProjectionMatrix();const a=new N(t.x,t.y,t.z),r=this.walkQuaternion(t);this.walking.fly=i>0?{from:n,fromQ:o,to:a,toQ:r,t0:performance.now(),ms:i}:null,this.walking.fly||(this.persp.position.copy(a),this.persp.quaternion.copy(r)),this.updateCutaway(),this.applyCut(),this.applyTime(),this.invalidate()}setWalkPose(t){if(!this.walking)return;const e=this.walking.fly;e?(e.to.set(t.x,t.y,t.z),e.toQ.copy(this.walkQuaternion(t))):(this.persp.position.set(t.x,t.y,t.z),this.persp.quaternion.copy(this.walkQuaternion(t))),this.invalidate()}setWalkFov(t){this.walking&&(this.walking.fov=t,this.persp.fov=t,this.persp.updateProjectionMatrix(),this.invalidate())}exitWalk(){const t=this.walking;t&&(this.walking=null,this.controls.enabled=!0,this.persp.fov=50,this.persp.near=.05,this.persp.updateProjectionMatrix(),this.cutAzimuth=Number.NaN,this.interior=null,this.setPreset(t.prevPreset)||this.setPreset("iso"),this.applyTime())}get isWalking(){return this.walking!==null}floorPoint(t,e,i){const n=this.renderer.domElement.getBoundingClientRect();if(!n.width||!n.height)return null;this.active.updateMatrixWorld(),this.raycaster.setFromCamera(new kt((t-n.left)/n.width*2-1,-((e-n.top)/n.height)*2+1),this.active);const{origin:o,direction:a}=this.raycaster.ray;if(Math.abs(a.y)<1e-6)return null;const r=(i-o.y)/a.y;return!(r>0)||r>500?null:[o.x+a.x*r,o.z+a.z*r]}pickCentre(t=1/0){const e=this.renderer.domElement.getBoundingClientRect();return this.pick(e.left+e.width/2,e.top+e.height/2,t)}pickAt(t,e,i=1/0){const n=this.pick(t,e,i);return n?{...n,point:[this.lastHitPoint.x,this.lastHitPoint.y,this.lastHitPoint.z]}:null}projectPoint(t){this.active.updateMatrixWorld();const e=new N(t[0],t[1],t[2]).project(this.active);if(e.z>1)return null;const i=this.opts.mount.clientWidth,n=this.opts.mount.clientHeight;return{x:(e.x+1)/2*i,y:(1-e.y)/2*n}}projectPoints(t){this.active.updateMatrixWorld(),this.renderer.getSize(this.projSize);const e=this.projSize.x,i=this.projSize.y,n=this.projV;return t.map(o=>(n.set(o[0],o[1],o[2]).project(this.active),n.z>1?null:{x:(n.x+1)/2*e,y:(1-n.y)/2*i}))}wantedCutAzimuth(){const t=this.extent;if(this.walking||this.quality!==2||!t||typeof this.preset!="string")return null;const e=this.active.position;if(e.y<=t.y1)return null;const i=this.controls.target;return Math.hypot(e.x-i.x,e.z-i.z)<.5?null:Tn(Ln(e.x,e.z,i.x,i.z))}writeBox(t,e,i){const n=t.part,o=new bt().setFromEuler(new ht(X(n.rotation[0]),X(n.rotation[1]),X(n.rotation[2]),"YXZ")),a=i<=0,r=new N(n.position[0],e,n.position[2]),l=a?new N(1e-4,1e-4,1e-4):new N(Math.max(n.size[0],.001),Math.max(i,.001),Math.max(n.size[2],.001));t.obj instanceof vt?(t.obj.setMatrixAt(t.index,new ot().compose(r,o,l)),t.obj.instanceMatrix.needsUpdate=!0):(t.obj.position.copy(r),t.obj.scale.copy(l))}updateCutaway(){const t=this.wantedCutAzimuth();if(t===this.cutAzimuth)return;this.cutAzimuth=t;const e=this.desc;if(!e||!this.extent)return;const i=new Set(t===null?[]:Dn(e,t,this.extent)),n=new Map(e.levels.map(o=>[o.id,o.elevation_m]));for(const o of this.cutNow){if(i.has(o))continue;const a=this.placed.get(o);a&&this.writeBox(a,a.part.position[1],a.part.size[1])}for(const o of i){if(this.cutNow.has(o))continue;const a=this.placed.get(o);if(!a)continue;const r=Hs(a.part,n.get(a.part.level_id??"")??0,Fe);r?this.writeBox(a,r.y,r.h):this.writeBox(a,(n.get(a.part.level_id??"")??0)-1,0)}this.cutNow=i,this.rebuildCaps(n),this.sun&&(this.sun.shadow.needsUpdate=!0),this.markShadows(),this.selectedId&&this.setSelected(this.selectedId)}rebuildCaps(t){this.caps&&(this.root.remove(this.caps),this.caps.dispose(),this.caps=null);const e=[...this.cutNow].sort().map(r=>this.placed.get(r)).filter(r=>!!r&&r.part.kind==="wall");if(!e.length||this.quality!==2)return;const i=new vt(this.unitBox,this.material(zi,1,!1,"floor"),e.length),n=new ot,o=new bt,a=new ht;e.forEach((r,l)=>{const h=r.part,c=(t.get(h.level_id??"")??0)+Fe;o.setFromEuler(a.set(X(h.rotation[0]),X(h.rotation[1]),X(h.rotation[2]),"YXZ")),n.compose(new N(h.position[0],c+Ei/2-.004,h.position[2]),o,new N(h.size[0]+.004,Ei,h.size[2]+.004)),i.setMatrixAt(l,n)}),i.instanceMatrix.needsUpdate=!0,i.computeBoundingSphere(),i.name="caps",i.castShadow=!0,this.caps=i,this.root.add(i)}cutawayNow(){return[...this.cutNow].sort()}get buildCount(){return this.builds}pick(t,e,i=1/0){const n=this.renderer.domElement.getBoundingClientRect();if(!n.width||!n.height)return null;this.raycaster.setFromCamera(new kt((t-n.left)/n.width*2-1,-((e-n.top)/n.height)*2+1),this.active);const o=[...this.lookup.keys()].filter(a=>a.visible);for(const a of this.raycaster.intersectObjects(o,!1)){if(a.distance>i)return null;const r=this.lookup.get(a.object);if(!r)continue;const l=a.object.userData.ranges;let h=a.instanceId??0;if(l&&a.instanceId===void 0&&a.faceIndex!==void 0&&a.faceIndex!==null){let u=0,d=l.length-1;for(;u<d;){const p=u+d+1>>1;l[p]<=a.faceIndex?u=p:d=p-1}h=u}const c=r[h];if(c){if(c.kind==="floor"){if(this.plateOpacity(c)<1)continue;return null}return this.lastHitPoint.copy(a.point),{id:c.userData.id,kind:c.userData.kind,partId:c.id}}}return null}setPaused(t){this.disposed||t===this.paused||(this.paused=t,t?(cancelAnimationFrame(this.raf),this.raf=0,this.windowStart=0,this.windowFrames=0):this.invalidate())}get isPaused(){return this.paused}setContinuous(t){this.continuous=t,this.windowStart=0,this.windowFrames=0,this.invalidate()}resize(){const t=this.opts.mount.clientWidth||1,e=this.opts.mount.clientHeight||1;this.renderer.setSize(t,e),this.post?.setSize(t,e),this.persp.aspect=t/e,this.persp.updateProjectionMatrix(),this.applyOrthoFrame(),this.refit(),this.invalidate()}followSky(){const t=this.exterior;if(!t)return;const e=t.root.userData.home??={dome:t.dome.position.clone(),band:t.band.position.clone(),bandH:t.band.geometry.parameters?.height??7},i=this.real.backdrop==="studio"&&!this.walking,n=i?Rt.discScale:1,o=this.active.position;if(this.active!==this.persp||i){t.dome.position.copy(this.active===this.persp?o:e.dome),t.band.position.copy(e.band),t.band.visible=!i,t.disc.scale.setScalar(n);return}t.dome.position.set(o.x,o.y,o.z);const a=e.band.y-e.bandH/2,r=o.y-a;t.band.visible=r<e.bandH*2.5&&this.real.backdrop!=="studio",t.band.position.set(o.x,e.band.y,o.z);const l=this.persp.getWorldDirection(Wl),c=Math.asin(Math.max(-1,Math.min(1,-l.y)))-X(this.persp.fov/2),u=c>.02&&r>0?Math.min(380,r/Math.tan(c)):380,d=t.disc.geometry.parameters?.width??1,p=Math.hypot(o.x-t.disc.position.x,o.z-t.disc.position.z),m=(u+p)/.55/(d/2);t.disc.scale.setScalar(Math.max(n,Math.min(m,800/(d/2))))}drawFrame(){if(this.quality===3){this.followSky();const t=this.active.position,e=this.desc?.real?.lamps??[];e.length>re&&Xs(e,[t.x,t.y,t.z],re).map(i=>i.id).join(",")!==this.poolKey&&this.applyLamps(),this.renderer.info.reset(),this.renderer.info.autoReset=!1,this.post?(this.post.setCamera(this.active),this.post.draw()):this.renderer.render(this.scene,this.active),this.lastFrameInfo={calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles},this.renderer.info.autoReset=!0;return}this.renderer.render(this.scene,this.active)}stepInterior(){const t=this.interior;if(!t||this.quality!==3)return!1;const e=performance.now(),i=this.interiorAt?Math.min(.1,(e-this.interiorAt)/1e3):.016;if(this.interiorAt=e,Math.abs(t.target-t.value)<.01)return this.interiorAt=0,!1;t.value+=(t.target-t.value)*Math.min(1,i*3);const n=j[this.real.style].rig,o=(n.interiorFill[0]+(n.interiorFill[1]-n.interiorFill[0])*t.value)*.7;return this.rig&&(this.rig.hemi.intensity=this.recipe.hemiIntensity*n.hemiScale*o),this.scene.environmentIntensity=(n.envNight+(n.envDay-n.envNight)*this.recipe.day)*o,!0}stepFly(){const t=this.walking?.fly;if(!t)return!1;const e=Math.min(1,(performance.now()-t.t0)/t.ms),i=e<.5?2*e*e:1-Math.pow(-2*e+2,2)/2;return this.persp.position.lerpVectors(t.from,t.to,i),this.persp.quaternion.slerpQuaternions(t.fromQ,t.toQ,i),e>=1&&this.walking&&(this.walking.fly=null),e<1}redrawNow(){this.disposed||this.paused||(cancelAnimationFrame(this.raf),this.raf=0,this.frame())}capture(){return this.walking||this.controls.update(),this.updateCutaway(),this.drawFrame(),this.renderer.domElement.toDataURL("image/png")}renderThumbnail(t,e,i=Hl,n=Ul){const o=t.parts.filter(g=>g.level_id===e&&g.kind!=="cone"&&g.shape!=="sprite"&&g.shape!=="light");if(!t.levels.some(g=>g.id===e))return null;const a={...t,levels:t.levels.filter(g=>g.id===e),parts:o},r=this.realise(o,a,!0),l=new is;if(l.add(r.root),this.quality>=2){l.add(this.night?new _t(Ci,Fi,Oi):new _t(Ti,Li,Di));const g=this.night?new st(he,Ni):new st(Ri,Ii);g.position.set(le[0]*50,le[1]*50,le[2]*50),l.add(g)}else{l.add(this.night?new Bt(qi,.7):new Bt(16777215,1.6));const g=this.night?new st(he,.5):new st(16777215,1.4);g.position.set(1,2,1.2),l.add(g)}const h=this.renderer.domElement,c=this.renderer.getPixelRatio(),{w:u,h:d}=Rn(i,n,h.width/c,h.height/c);if(u<8||d<8)return this.disposeGroup(r.root),null;const p=Us(In(t,e),u/d),m=new Cs(-p.halfW,p.halfW,p.halfH,-p.halfH,.05,4e3);m.position.set(p.target[0]+Pt[0]*p.dist,p.target[1]+Pt[1]*p.dist,p.target[2]+Pt[2]*p.dist),m.lookAt(p.target[0],p.target[1],p.target[2]),m.updateProjectionMatrix();let w=null;const v=this.renderer.shadowMap.enabled;try{this.renderer.shadowMap.enabled=!1,this.renderer.setScissorTest(!0),this.renderer.setScissor(0,0,u,d),this.renderer.setViewport(0,0,u,d),this.renderer.render(l,m);const g=document.createElement("canvas");g.width=u,g.height=d;const z=g.getContext("2d");z&&(z.drawImage(h,0,h.height-d*c,u*c,d*c,0,0,u,d),w=g.toDataURL("image/png"))}catch(g){console.warn("sw-plan-3d: thumbnail failed",g)}finally{this.renderer.setScissorTest(!1),this.renderer.setViewport(0,0,h.width/c,h.height/c),this.renderer.shadowMap.enabled=v,this.disposeGroup(r.root),this.invalidate()}return w}async exportGltf(){const t=new ft;for(const i of this.root.children)i!==this.outline&&t.add(i.clone());return await new _n().parseAsync(t,{binary:!1,onlyVisible:!1})}dispose(){this.disposed=!0,br(this.aoUniforms),cancelAnimationFrame(this.raf),this.raf=0;const t=this.renderer.domElement;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerleave",this.onLeave),t.removeEventListener("pointercancel",this.onCancel),t.removeEventListener("webglcontextrestored",this.onRestored),this.controls.removeEventListener("change",this.invalidate),this.controls.removeEventListener("start",this.onUserCamera),this.controls.dispose(),window.clearTimeout(this.realRebuildTimer),this.clear(),this.post?.dispose(),this.realMats?.dispose(),this.realModels?.dispose(),this.envTarget?.dispose(),this.pmrem?.dispose();for(const{material:e}of this.materials.values())e.dispose();for(const e of this.glowPool)e.dispose();this.aoMaterial&&(this.aoMaterial.map?.dispose(),this.aoMaterial.dispose()),this.outlineMaterial.dispose(),this.boxEdges.dispose(),this.unitBox.dispose(),this.unitCylinder.dispose(),this.unitPlane.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss(),t.remove()}}function Ql(s,t,e,i,n){const o=document.createElement("div");o.setAttribute("aria-hidden","true"),o.dataset.skinControl="",o.style.cssText=`position:fixed;left:-1600px;top:0;width:${e}px;height:${i}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(o);let a=null;try{if(a=new zs({mount:o,color:t,onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1}),a.setDescription(s),!a.setPreset("iso"))return null;a.capture();const r=a.renderer.domElement;if(r.width!==e||r.height!==i)return null;const l=document.createElement("canvas");l.width=e,l.height=i;const h=l.getContext("2d");return h?(h.fillStyle=n,h.fillRect(0,0,e,i),h.drawImage(r,0,0),l.toDataURL("image/png")):null}catch(r){return console.warn("sw-plan-3d: control image failed",r),null}finally{a?.dispose(),o.remove()}}const Se=2500,Co=Se+1500,Fo=1e4,Oo=3,fs=3e3;function Gi(s,t,e){return new Promise(i=>{let n=!1;const o=setTimeout(()=>{n||(n=!0,i(e))},t);s.then(a=>{n||(n=!0,clearTimeout(o),i(a))},()=>{n||(n=!0,clearTimeout(o),i(e))})})}const ce=1e-6;function Ae(s,t=2,e){const i=new Map,n=s.filter(a=>a.w>0&&a.h>0).slice().sort((a,r)=>r.y-a.y||(a.id<r.id?-1:a.id>r.id?1:0)),o=[];if(e?.size)for(const a of n)e.has(a.id)&&(o.push({l:a.x-a.w/2,r:a.x+a.w/2,t:a.y-a.h,b:a.y}),i.set(a.id,0));for(const a of n){if(i.has(a.id))continue;const r=a.x-a.w/2,l=a.x+a.w/2;let h=a.y;for(let c=0;c<=o.length;c++){const u=o.find(d=>r<d.r-ce&&l>d.l+ce&&h-a.h<d.b+t-ce&&h>d.t-t+ce);if(!u)break;h=u.t-t}o.push({l:r,r:l,t:h-a.h,b:h}),i.set(a.id,Math.round((h-a.y)*100)/100)}for(const a of s)i.has(a.id)||i.set(a.id,0);return i}const V=.25,Jl=4e5,th=.85,eh=.8,de=4,ms=(s,t,e)=>Math.min(e,Math.max(t,s)),ji=s=>Math.round(s*1e4)/1e4+0;function ws(s,t,e){let i=!1;for(let n=0,o=e.length-1;n<e.length;o=n++){const[a,r]=e[n],[l,h]=e[o];r>t!=h>t&&s<(l-a)*(t-r)/(h-r)+a&&(i=!i)}return i}function Es(s,t,e){const i=e.b[0]-e.a[0],n=e.b[1]-e.a[1],o=i*i+n*n,a=o>0?ms(((s-e.a[0])*i+(t-e.a[1])*n)/o,0,1):0,r=e.a[0]+a*i,l=e.a[1]+a*n;return{d:Math.hypot(s-r,t-l),cx:r,cz:l}}class sh{constructor(){this.f=[],this.k=[]}get size(){return this.k.length}less(t,e){return this.f[t]<this.f[e]||this.f[t]===this.f[e]&&this.k[t]<this.k[e]}swap(t,e){[this.f[t],this.f[e]]=[this.f[e],this.f[t]],[this.k[t],this.k[e]]=[this.k[e],this.k[t]]}push(t,e){this.f.push(t),this.k.push(e);let i=this.k.length-1;for(;i>0;){const n=i-1>>1;if(!this.less(i,n))break;this.swap(i,n),i=n}}pop(){const t=this.k[0],e=this.f.pop(),i=this.k.pop();if(this.k.length){this.f[0]=e,this.k[0]=i;let n=0;for(;;){const o=2*n+1,a=o+1;let r=n;if(o<this.k.length&&this.less(o,r)&&(r=o),a<this.k.length&&this.less(a,r)&&(r=a),r===n)break;this.swap(n,r),n=r}}return t}}function No(s,t){const e=s.bands.filter(i=>i.from===t||i.to===t).flatMap(i=>i.sides);return[...s.levels.find(i=>i.id===t)?.segs??[],...e]}function ih(s,t,e){const i=s.levels.find(u=>u.id===t);if(!i)return null;const n=i.extent,o=Math.max(1,Math.ceil((n.maxX-n.minX)/V)),a=Math.max(1,Math.ceil((n.maxZ-n.minZ)/V));if(o*a>Jl)return null;const r=No(s,t),l=new Uint8Array(o*a),h=e*th;for(const u of r){const d=h+u.r,p=Math.max(0,Math.floor((Math.min(u.a[0],u.b[0])-d-n.minX)/V)),m=Math.min(o-1,Math.floor((Math.max(u.a[0],u.b[0])+d-n.minX)/V)),w=Math.max(0,Math.floor((Math.min(u.a[1],u.b[1])-d-n.minZ)/V)),v=Math.min(a-1,Math.floor((Math.max(u.a[1],u.b[1])+d-n.minZ)/V));for(let g=w;g<=v;g++)for(let z=p;z<=m;z++){const k=g*o+z;l[k]||Es(n.minX+(z+.5)*V,n.minZ+(g+.5)*V,u).d<d&&(l[k]=1)}}const c=new Map;for(const u of r)u.kind==="object"&&(c.get(u.id)??c.set(u.id,[]).get(u.id)).push(u);for(const u of c.values()){if(u.length<3)continue;const d=u.map(k=>k.a),p=d.map(k=>k[0]),m=d.map(k=>k[1]),w=Math.max(0,Math.floor((Math.min(...p)-n.minX)/V)),v=Math.min(o-1,Math.floor((Math.max(...p)-n.minX)/V)),g=Math.max(0,Math.floor((Math.min(...m)-n.minZ)/V)),z=Math.min(a-1,Math.floor((Math.max(...m)-n.minZ)/V));for(let k=g;k<=z;k++)for(let P=w;P<=v;P++)ws(n.minX+(P+.5)*V,n.minZ+(k+.5)*V,d)&&(l[k*o+P]=1)}return{level:t,minX:n.minX,minZ:n.minZ,cols:o,rows:a,blocked:l,segs:r}}const Ki=new WeakMap;function oh(s,t,e){let i=Ki.get(s);i||(i=new Map,Ki.set(s,i));const n=`${t}|${e}`;if(i.has(n))return i.get(n)??null;const o=ih(s,t,e);return i.set(n,o),o}function gs(s,t,e,i){const n=Math.hypot(t[0]-s[0],t[1]-s[1]);if(n<1e-6)return!0;const o=Math.max(2,Math.ceil(n/.1));for(let a=0;a<=o;a++){const r=s[0]+(t[0]-s[0])*a/o,l=s[1]+(t[1]-s[1])*a/o;for(const h of e)if(Es(r,l,h).d<i*eh+h.r)return!1}return!0}function nh(s,t,e,i,n){const o=oh(s,t,n);if(!o)return null;const{cols:a,rows:r,minX:l,minZ:h,blocked:c}=o,u=(x,I)=>[ms(Math.floor((x-l)/V),0,a-1),ms(Math.floor((I-h)/V),0,r-1)],[d,p]=u(e[0],e[1]);let[m,w]=u(i[0],i[1]),v=i[0],g=i[1];if(c[w*a+m]){let x=null;for(let I=-de;I<=de;I++)for(let B=-de;B<=de;B++){const H=m+B,F=w+I;if(H<0||F<0||H>=a||F>=r||c[F*a+H])continue;const K=B*B+I*I;(!x||K<x.d)&&(x={i:H,j:F,d:K})}if(!x)return null;m=x.i,w=x.j,v=l+(m+.5)*V,g=h+(w+.5)*V}const z=p*a+d,k=w*a+m,P=new Float64Array(a*r).fill(1/0),E=new Int32Array(a*r).fill(-1),_=new Uint8Array(a*r),$=(x,I)=>Math.hypot(x-m,I-w),f=new sh;P[z]=0,f.push($(d,p),z);const b=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];for(;f.size;){const x=f.pop();if(_[x])continue;if(x===k)break;_[x]=1;const I=x%a,B=(x-I)/a;for(const[H,F,K]of b){const W=I+H,U=B+F;if(W<0||U<0||W>=a||U>=r)continue;const rt=U*a+W;if(c[rt]||_[rt]||H&&F&&(c[B*a+W]||c[U*a+I]))continue;const Nt=P[x]+K;Nt<P[rt]-1e-12&&(P[rt]=Nt,E[rt]=x,f.push(Nt+$(W,U),rt))}}if(k!==z&&E[k]<0)return null;const y=[];for(let x=k;x>=0&&x!==z;x=E[x])y.push([l+(x%a+.5)*V,h+(Math.floor(x/a)+.5)*V]);y.reverse(),y.push([v,g]);const M=[];let S=[e[0],e[1]],L=0;for(;L<y.length;){let x=L;for(let I=y.length-1;I>L;I--)if(gs(S,y[I],o.segs,n)){x=I;break}M.push([ji(y[x][0]),ji(y[x][1])]),S=y[x],L=x+1}return M}const ue=.28,ah=1.4,rh=2.8,lh=120,hh=220,ch=.1,dh=1/60,pe=70,Xi=[1.2,2],fe=1.65,Vi=.02,Yi=.45,nt=.3,uh=1.2,ph=.1,fh={forward:0,strafe:0,turn:0,run:!1},mh=s=>{let t=((s+180)%360+360)%360-180;return t===-180&&(t=180),t},me=s=>(s%360+360)%360;class wh{constructor(t,e={}){this.x=0,this.z=0,this.heading=0,this.pitch=0,this.level="",this.eye=fe,this.eyeTarget=fe,this.eyeHold=null,this.path=null,this.levels=new Map,this.doors=new Map,this.room=void 0,this.crossShown=null,this.edge=!1,this.blockedDoor=null,this.clock=0,this.progress=null,this.setEyeHeight(e.eye_m??fe,!0),this.setWorld(t);const i=t.starts.find(n=>n.id===t.defaultStart)??t.starts[0];i?this.place(i):this.level=t.levels[0]?.id??""}setWorld(t){if(this.world=t,this.levels=new Map(t.levels.map(e=>[e.id,e])),this.doors=new Map(t.doors.map(e=>[e.id,e])),this.level&&!this.levels.has(this.level)&&(this.level=t.levels[0]?.id??""),this.path?.length){const e=No(t,this.level);let i=[this.x,this.z];for(const n of this.path){if(!gs(i,n,e,ue))return this.cancelPath(),[{type:"path-blocked"}];i=n}}return[]}cancelPath(){this.path=null,this.progress=null}setEyeHeight(t,e=!1){this.eyeTarget=dt(Number.isFinite(t)?t:fe,Xi[0],Xi[1]),e&&(this.eye=this.eyeTarget)}place(t){const e=[];if(t.level!==this.level&&this.levels.has(t.level)&&e.push({type:"level",level:t.level}),this.level=this.levels.has(t.level)?t.level:this.level||this.world.levels[0]?.id||"",this.heading=me(t.heading_deg),this.pitch=dt(t.pitch_deg,-pe,pe),this.cancelPath(),this.crossShown=null,this.eyeHold=t.eye_m,t.eye_m!==null&&(this.eye=t.eye_m),this.x=t.x,this.z=t.z,t.kind!=="camera"){const[i,n]=this.collide(t.x,t.z,this.segmentsFor(this.level,!!this.ground(t.x,t.z,this.level).band)).p;this.x=i,this.z=n}return this.noteRoom(e),e}placeAt(t,e,i=this.level,n=this.heading){return this.place({id:"at",kind:"centre",label:"",level:i,x:t,z:e,heading_deg:n,pitch_deg:this.pitch,eye_m:null})}look(t,e){this.heading=me(this.heading+t),this.pitch=dt(this.pitch+e,-pe,pe)}ground(t,e,i){const n=this.levels.get(i);for(const o of this.world.bands)if(!(o.from!==i&&o.to!==i)){for(let a=0;a<o.ramps.length;a++){const r=o.ramps[a],l=r.b[0]-r.a[0],h=r.b[1]-r.a[1],c=Math.hypot(l,h);if(c<1e-6)continue;const u=l/c,d=h/c,p=t-r.a[0],m=e-r.a[1],w=p*u+m*d;if(Math.abs(-p*d+m*u)<=r.width/2&&w>=-.05&&w<=c+.05){const g=dt(w/c,0,1);return{y:r.y0+(r.y1-r.y0)*g,band:o,ramp:a,along:w}}}for(const a of o.landings)if(ws(t,e,a.poly))return{y:a.y,band:o,ramp:-1,along:0}}return{y:n?.elevation_m??0,band:null,ramp:-1,along:0}}segmentsFor(t,e){const i=this.world.bands.filter(n=>n.from===t||n.to===t).flatMap(n=>n.sides);return e?i:[...this.levels.get(t)?.segs??[],...i]}collide(t,e,i){let n=null;for(let o=0;o<3;o++){let a=!1;for(const r of i){const l=ue+r.r,h=Es(t,e,r);if(h.d>=l)continue;let c,u;if(h.d<1e-9){const d=r.b[0]-r.a[0],p=r.b[1]-r.a[1],m=Math.hypot(d,p)||1;c=-p/m,u=d/m}else c=(t-h.cx)/h.d,u=(e-h.cz)/h.d;t=h.cx+c*(l+1e-4),e=h.cz+u*(l+1e-4),a=!0,n??=r}if(!a)break}return{p:[t,e],hit:n}}step(t,e=fh){const i=[],n=dt(Number.isFinite(t)?t:0,0,ch),o=Math.max(1,Math.ceil(n/dh-1e-9));for(let r=0;r<o;r++)this.sub(n/o,e,i);const a=this.eyeHold??this.eyeTarget;return this.eye+=(a-this.eye)*Math.min(1,n*6),Math.abs(a-this.eye)<1e-4&&(this.eye=a),i}sub(t,e,i){this.clock+=t,e.turn&&(this.heading=me(this.heading+dt(e.turn,-1,1)*lh*t));let n=dt(e.forward,-1,1),o=dt(e.strafe,-1,1),a=e.run;if(n||o)this.cancelPath();else if(this.path&&this.path.length){const[$,f]=this.path[0];if(Math.hypot($-this.x,f-this.z)<.15){this.path.shift(),this.path.length||(this.cancelPath(),i.push({type:"arrived"}));return}const y=this.progress;if(!y||Math.hypot(this.x-y.x,this.z-y.z)>=ph)this.progress={x:this.x,z:this.z,at:this.clock};else if(this.clock-y.at>uh){this.cancelPath(),i.push({type:"path-blocked"});return}const M=mh(Kn($-this.x,f-this.z)-this.heading);this.heading=me(this.heading+Math.sign(M)*Math.min(Math.abs(M),hh*t)),n=Math.abs(M)<35?1:.2,o=0,a=!1}if(!n&&!o)return;const r=this.heading*Math.PI/180,l=a?rh:ah,h=Math.min(1,Math.hypot(n,o)),c=Math.hypot(n,o)||1,u=Math.sin(r),d=-Math.cos(r),p=Math.cos(r),m=Math.sin(r);let w=this.x+(u*n+p*o)/c*h*l*t,v=this.z+(d*n+m*o)/c*h*l*t;const g=this.ground(this.x,this.z,this.level),z=!!g.band&&!!this.ground(w,v,this.level).band,k=this.collide(w,v,this.segmentsFor(this.level,z));if([w,v]=k.p,k.hit&&k.hit.kind==="door"){if(this.blockedDoor!==k.hit.id){const $=this.doors.get(k.hit.id);$&&i.push({type:"blocked",door:$})}this.blockedDoor=k.hit.id}else this.blockedDoor=null;const P=this.levels.get(this.level);if(P&&!this.ground(w,v,this.level).band){const $=P.extent,f=dt(w,$.minX+nt,Math.max($.minX+nt,$.maxX-nt)),b=dt(v,$.minZ+nt,Math.max($.minZ+nt,$.maxZ-nt)),y=f!==w||b!==v;y&&!this.edge&&i.push({type:"edge"}),this.edge=y,w=f,v=b}(Math.abs(w-this.x)>1e-7||Math.abs(v-this.z)>1e-7)&&(this.eyeHold=null),this.x=w,this.z=v;const E=this.ground(this.x,this.z,this.level),_=E.band??g.band;if(_){const $=_.ramps.length-1,f=L=>E.band===_&&E.ramp===L||g.band===_&&g.ramp===L,b=_.ramps[$],y=Math.hypot(b.b[0]-b.a[0],b.b[1]-b.a[1]),M=f($)?this.alongOf(b):-1/0,S=f(0)?this.alongOf(_.ramps[0]):1/0;_.to&&this.level===_.from&&M>y-Vi?this.switchLevel(_.to,i):_.to&&this.level===_.to&&S<Vi&&this.switchLevel(_.from,i),_.farFloor&&M>y-Yi&&this.crossShown!==_.id?(this.crossShown=_.id,i.push({type:"cross-floor",band:_.id,floor:_.farFloor})):_.farFloor&&M<=y-Yi-.3&&(this.crossShown=null)}this.noteRoom(i)}alongOf(t){const e=t.b[0]-t.a[0],i=t.b[1]-t.a[1],n=Math.hypot(e,i)||1;return((this.x-t.a[0])*e+(this.z-t.a[1])*i)/n}switchLevel(t,e){t===this.level||!this.levels.has(t)||(this.level=t,e.push({type:"level",level:t}))}noteRoom(t){const e=this.world.rooms.find(n=>n.level===this.level&&ws(this.x,this.z,n.poly))??null,i=e?.id??null;i!==this.room&&(this.room!==void 0&&t.push({type:"room",room:e}),this.room=i)}pose(){const t=this.ground(this.x,this.z,this.level);return{x:ee(this.x),y:ee(t.y+this.eye),z:ee(this.z),heading_deg:Math.round(this.heading*1e3)/1e3+0,pitch_deg:Math.round(this.pitch*1e3)/1e3+0,level:this.level,ground:ee(t.y),band:t.band?.id??null}}lineFree(t,e,i){return gs(t,e,i,ue)}pathTo(t,e){const i=nh(this.world,this.level,[this.x,this.z],[t,e],ue);return i?(this.path=i,this.progress=null,i):null}}const gh=.3,_e=70,vh=50,bh=80,yh=120,kh=(s,t,e)=>Math.min(e,Math.max(t,s)),vs=s=>Math.round(s*1e3)/1e3+0,It=s=>vs(kh(Number.isFinite(s)?s:_e,vh,bh));function xh(s,t,e=_e,i=gh){const n=i*(It(e)/_e);return[vs(-s*n),vs(t*n)]}function Mh(s,t,e){if(!(t>1e-6)||!(e>1e-6))return It(s);const i=Math.tan(It(s)/2*Math.PI/180);return It(2*Math.atan(i*t/e)*180/Math.PI)}const Zi=(s,t)=>Math.hypot(s[0]-t[0],s[1]-t[1]);class Sh{constructor(t=yh){this.h=0,this.p=0,this.tau=Math.max(.001,t/3e3)}add(t,e){this.h+=t,this.p+=e}get pending(){return Math.abs(this.h)>1e-4||Math.abs(this.p)>1e-4}step(t){if(!this.pending)return this.h=0,this.p=0,[0,0];const e=t>0?1-Math.exp(-t/this.tau):0;let i=this.h*e,n=this.p*e;return Math.abs(this.h-i)<=1e-4&&(i=this.h),Math.abs(this.p-n)<=1e-4&&(n=this.p),this.h-=i,this.p-=n,[i,n]}flush(){const t=[this.h,this.p];return this.h=0,this.p=0,t}clear(){this.h=0,this.p=0}}const Ah=56,_h=8,Ph=84,$h=10,bs={forward:0,strafe:0,run:!1,engaged:!1,knob:[0,0]},we=s=>Math.round(s*1e6)/1e6+0;function zh(s,t,e={}){const i=e.radius??Ah,n=Math.min(e.dead??_h,i-1e-6),o=e.runAt??Ph,a=e.snapDeg??$h;if(!Number.isFinite(s)||!Number.isFinite(t))return bs;const r=Math.hypot(s,t),l=r>i?i/r:1,h=[we(s*l),we(t*l)];if(r<=n)return{...bs,knob:h};const c=Math.min(1,(r-n)/(i-n));let u=-t/r,d=s/r;const p=Math.atan2(Math.abs(s),Math.abs(t))*180/Math.PI;return p<a?(d=0,u=Math.sign(u)):p>90-a&&(u=0,d=Math.sign(d)),{forward:we(u*c),strafe:we(d*c),run:r>=o,engaged:!0,knob:h}}const Ke=500,Qi=10,Eh=110,Th=.05;class Lh{constructor(t,e=_e){this.bounds=t,this.fingers=new Map,this.pinch=null,this.fovNow=It(e)}get fov(){return this.fovNow}setFov(t){this.fovNow=It(t)}get count(){return this.fingers.size}get stick(){for(const t of this.fingers.values())if(t.role==="stick"&&t.engaged)return{state:t.lastStick,origin:[t.x0,t.y0]};return null}isLeft(t){const e=this.bounds();return t-e.left<e.width/2}down(t){if(this.fingers.has(t.id))return[];const e=this.isLeft(t.x),i={id:t.id,x0:t.x,y0:t.y,x:t.x,y:t.y,lx:t.x,ly:t.y,t0:t.t,role:e?"stick":"look",left:e,armed:!0,engaged:!1,lastStick:bs};if(this.fingers.size===0)return this.fingers.set(t.id,i),[];if(this.fingers.size>=2)return i.role="rest",i.armed=!1,this.fingers.set(t.id,i),[];const n=[...this.fingers.values()][0],o=Math.hypot(n.x-t.x,n.y-t.y)<=Eh;return(n.left===e||o)&&n.armed&&n.role!=="rest"?(n.role="pinch",n.armed=!1,i.role="pinch",i.armed=!1,this.fingers.set(t.id,i),this.pinch={a:n.id,b:i.id,dist:Zi([n.x,n.y],[i.x,i.y]),fov:this.fovNow},[]):(n.armed=!1,n.role!=="rest"&&n.left===e&&(i.role="rest",i.armed=!1),this.fingers.set(t.id,i),[])}move(t){const e=this.fingers.get(t.id);if(!e)return[];e.x=t.x,e.y=t.y;const i=[],n=Math.hypot(e.x-e.x0,e.y-e.y0)>Qi;if(e.role==="stick"){const o=zh(e.x-e.x0,e.y-e.y0);o.engaged?(e.engaged=!0,e.armed=!1,(o.forward!==e.lastStick.forward||o.strafe!==e.lastStick.strafe||o.run!==e.lastStick.run||o.knob[0]!==e.lastStick.knob[0]||o.knob[1]!==e.lastStick.knob[1]||!e.lastStick.engaged)&&(e.lastStick=o,i.push({type:"stick",forward:o.forward,strafe:o.strafe,run:o.run,origin:[e.x0,e.y0],knob:o.knob}))):e.engaged?(e.lastStick={...o,engaged:!0},i.push({type:"stick",forward:0,strafe:0,run:!1,origin:[e.x0,e.y0],knob:o.knob})):n&&(e.armed=!1)}else if(e.role==="look"){if(n&&(e.armed=!1),!e.armed){const[o,a]=xh(e.x-e.lx,e.y-e.ly,this.fovNow);e.lx=e.x,e.ly=e.y,(o||a)&&i.push({type:"look",dHeading:o,dPitch:a})}}else if(e.role==="pinch"&&this.pinch){const o=this.fingers.get(this.pinch.a),a=this.fingers.get(this.pinch.b);if(o&&a){const r=Mh(this.pinch.fov,this.pinch.dist,Zi([o.x,o.y],[a.x,a.y]));Math.abs(r-this.fovNow)>=Th&&(this.fovNow=r,i.push({type:"fov",fov:r}))}}return i}up(t){const e=this.fingers.get(t.id);if(!e)return[];e.x=t.x,e.y=t.y,this.fingers.delete(t.id);const i=[];return e.role==="stick"&&e.engaged?i.push({type:"stick-end"}):(e.role==="stick"||e.role==="look")&&e.armed&&t.t-e.t0<Ke&&Math.hypot(e.x-e.x0,e.y-e.y0)<=Qi&&i.push({type:"tap",x:e.x,y:e.y}),e.role==="pinch"&&this.endPinch(),i}cancel(t){const e=this.fingers.get(t.id);return e?(e.armed=!1,this.up(t)):[]}reset(){const t=[];for(const e of this.fingers.values())e.role==="stick"&&e.engaged&&t.push({type:"stick-end"});return this.fingers.clear(),this.pinch=null,t}endPinch(){this.pinch=null;for(const t of this.fingers.values())t.role==="pinch"&&(t.role="rest",t.armed=!1)}nextDeadline(){const t=this.candidate();return t?t.t0+Ke:null}candidate(){if(this.fingers.size!==1)return null;const t=[...this.fingers.values()][0];return t.armed&&(t.role==="stick"||t.role==="look")?t:null}tick(t){const e=this.candidate();return!e||t-e.t0<Ke?[]:(e.armed=!1,[{type:"long-press",x:e.x,y:e.y}])}}const Bo=4e3,qo=2;function Ho(s){return s.filter(t=>t.kind==="saved")}class Dh{constructor(t,e={}){this.stops=t,this.i=-1,this.due=1/0,this.dwell=Math.max(1,e.dwellMs??Bo),this.loop=!!e.loop}get playable(){return this.stops.length>=qo}get playing(){return this.i>=0}get index(){return this.i}get dueAt(){return this.i>=0?this.due:null}start(t){return this.playable?(this.i=0,this.due=t+this.dwell,{index:0,stop:this.stops[0]}):null}advance(t){if(this.i<0||t<this.due)return null;const e=this.i+1;if(e>=this.stops.length){if(!this.loop)return this.stop(),"end";this.i=0}else this.i=e;return this.due=t+this.dwell,{index:this.i,stop:this.stops[this.i]}}stop(){this.i=-1,this.due=1/0}}const ge=.22,Rh=24,Ih=2e3,Ch=150;class Fh{constructor(t,e,i){this.host=e,this.keys=new Set,this.raf=0,this.last=0,this.drag=null,this.locked=!1,this.mode="drag",this.fpsWindow=null,this.disposed=!1,this.touchStick=null,this.longTimer=0,this.longDue=null,this.route=null,this.routeTimer=0,this.fadeTimer=0,this.tick=o=>{if(this.raf=0,this.disposed)return;const a=this.last?(o-this.last)/1e3:1/60;if(this.last=o,this.ease?.pending){const[l,h]=this.ease.step(a);(l||h)&&this.ctrl.look(l,h)}const r=this.ctrl.step(a,this.input());this.host.onPose(),r.length&&this.host.onEvents(r),this.watchFps(o),this.busy()?this.raf=requestAnimationFrame(this.tick):this.fpsWindow=null},this.onKeyDown=o=>{if(this.typing(o)||o.ctrlKey||o.metaKey||o.altKey)return;const a=o.code;if(a==="Escape"){o.preventDefault(),this.host.onExit();return}if(a==="Enter"){if(this.onControl(o))return;o.preventDefault(),this.host.onAct();return}if(a==="KeyQ"||a==="KeyE"){o.preventDefault(),this.host.onInput?.("key"),this.cancelRoute(),this.ctrl.look(a==="KeyQ"?-45:45,0),this.host.onPose();return}const r=/^Digit([1-9])$/.exec(a);if(r){const h=this.ctrl.world.starts.filter(c=>c.kind==="saved")[Number(r[1])-1];h&&(o.preventDefault(),this.host.onInput?.("key"),this.goTo(h));return}["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","ShiftLeft","ShiftRight"].includes(a)&&(o.preventDefault(),this.host.onInput?.("key"),this.cancelRoute(),this.keys.add(a),this.kick())},this.onKeyUp=o=>{this.keys.delete(o.code)},this.onBlur=()=>{this.keys.clear(),this.endTouches()},this.onHidden=()=>{document.hidden&&this.endTouches()},this.onTouch=o=>{if(o.pointerType==="mouse")return;o.stopPropagation(),(o.type==="pointerdown"||o.type==="pointermove")&&o.preventDefault();const a={id:o.pointerId,x:o.clientX,y:o.clientY,t:performance.now()};let r;if(o.type==="pointerdown"){this.host.onInput?.("touch"),this.cancelRoute();try{this.host.canvas.setPointerCapture(o.pointerId)}catch{}r=this.touch.down(a)}else o.type==="pointermove"?r=this.touch.move(a):o.type==="pointerup"?r=this.touch.up(a):r=this.touch.cancel(a);this.apply(r),this.armLong()},this.onContextMenu=o=>{o.preventDefault()},this.onDown=o=>{if(o.pointerType!=="mouse"||o.button!==0)return;this.host.onInput?.("mouse"),this.cancelRoute();const a=this.host.canvas;if(!this.locked&&this.wantsLock())try{const r=a.requestPointerLock?.();r&&typeof r.catch=="function"&&r.catch(()=>{})}catch{}this.locked||(this.drag={id:o.pointerId,x:o.clientX,y:o.clientY})},this.onMove=o=>{const a=this.drag;if(o.pointerType!=="mouse"||!a||o.pointerId!==a.id)return;const r=o.clientX-a.x,l=o.clientY-a.y;a.x=o.clientX,a.y=o.clientY,this.ctrl.look(-r*ge,l*ge),this.host.onPose()},this.onUp=o=>{this.drag&&o.pointerId===this.drag.id&&(this.drag=null)},this.onLockChange=()=>{this.locked=document.pointerLockElement===this.host.canvas},this.onLockedMove=o=>{this.locked&&(this.ctrl.look(o.movementX*ge,-o.movementY*ge),this.host.onPose())},this.ctrl=new wh(t,{eye_m:i.eye_m}),i.start&&this.ctrl.place(i.start),this.mode=i.mouseMode,this.routeDwellMs=i.routeDwellMs??Bo,this.fadeMs=i.fadeMs??Ch,this.ease=i.ease===!1?null:new Sh,this.surface=e.surface??e.canvas.parentElement??e.canvas,this.touch=new Lh(()=>this.surface.getBoundingClientRect(),i.fov),window.addEventListener("keydown",this.onKeyDown),window.addEventListener("keyup",this.onKeyUp),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onHidden),document.addEventListener("pointerlockchange",this.onLockChange);const n=e.canvas;n.addEventListener("pointerdown",this.onDown),n.addEventListener("pointermove",this.onMove),n.addEventListener("pointerup",this.onUp),n.addEventListener("pointercancel",this.onUp),n.addEventListener("mousemove",this.onLockedMove),n.addEventListener("contextmenu",this.onContextMenu);for(const o of["pointerdown","pointermove","pointerup","pointercancel"])this.surface.addEventListener(o,this.onTouch,!0)}dispose(){this.disposed=!0,cancelAnimationFrame(this.raf),window.clearTimeout(this.longTimer),window.clearTimeout(this.routeTimer),window.clearTimeout(this.fadeTimer),window.removeEventListener("keydown",this.onKeyDown),window.removeEventListener("keyup",this.onKeyUp),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onHidden),document.removeEventListener("pointerlockchange",this.onLockChange);const t=this.host.canvas;t.removeEventListener("pointerdown",this.onDown),t.removeEventListener("pointermove",this.onMove),t.removeEventListener("pointerup",this.onUp),t.removeEventListener("pointercancel",this.onUp),t.removeEventListener("mousemove",this.onLockedMove),t.removeEventListener("contextmenu",this.onContextMenu);for(const e of["pointerdown","pointermove","pointerup","pointercancel"])this.surface.removeEventListener(e,this.onTouch,!0);this.locked&&document.pointerLockElement===t&&document.exitPointerLock?.(),this.host.onStick?.(null),this.host.onFade?.(!1)}setMouseMode(t){this.mode=t,t==="drag"&&this.locked&&document.exitPointerLock?.()}setWorld(t){const e=this.ctrl.setWorld(t);e.length&&this.host.onEvents(e),this.kick()}setFov(t){this.touch.setFov(t)}wantsLock(){if(this.mode==="lock")return!0;if(this.mode!=="auto")return!1;try{return window.self===window.top}catch{return!1}}input(){const t=this.keys,e=(...a)=>a.some(r=>t.has(r));let i=(e("KeyW","ArrowUp")?1:0)-(e("KeyS","ArrowDown")?1:0),n=(e("KeyD")?1:0)-(e("KeyA")?1:0);const o=(e("ArrowRight")?1:0)-(e("ArrowLeft")?1:0);return this.touchStick&&(i=i||this.touchStick.forward,n=n||this.touchStick.strafe),{forward:i,strafe:n,turn:o,run:e("ShiftLeft","ShiftRight")||!!(this.touchStick&&(this.touchStick.forward||this.touchStick.strafe)&&this.touchStick.run)}}busy(){const t=this.input();return!!(t.forward||t.strafe||t.turn||this.ctrl.path||this.ease?.pending||Math.abs(this.ctrl.eye-this.ctrl.eyeTarget)>1e-4)}kick(){this.raf||this.disposed||(this.last=0,this.raf=requestAnimationFrame(this.tick))}watchFps(t){const e=this.fpsWindow;if(!e){this.fpsWindow={t0:t,frames:0};return}e.frames++;const i=t-e.t0;if(i<Ih)return;const n=e.frames*1e3/i;this.fpsWindow={t0:t,frames:0},n<Rh&&!document.hidden&&this.host.onLowFps(n)}typing(t){return t.composedPath().some(i=>i instanceof HTMLElement&&(i.tagName==="INPUT"||i.tagName==="SELECT"||i.tagName==="TEXTAREA"||i.isContentEditable))}onControl(t){return t.composedPath().some(e=>e instanceof HTMLElement&&(e.tagName==="BUTTON"||e.tagName==="A"))}endTouches(){window.clearTimeout(this.longTimer),this.longDue=null,this.apply(this.touch.reset()),this.touchStick=null,this.host.onStick?.(null)}goTo(t){this.cancelRoute(),this.jump(t)}jump(t){const e=this.ctrl.place(t);this.ease?.clear(),this.host.onPose(),e.length&&this.host.onEvents(e),this.kick()}walkTo(t,e){const i=!!this.ctrl.pathTo(t,e);return i&&this.kick(),i}playRoute(){const t=new Dh(Ho(this.ctrl.world.starts),{dwellMs:this.routeDwellMs}),e=t.start(performance.now());return e?(this.cancelRoute(),this.route=t,this.host.onRoute?.({playing:!0}),this.showStop(e.stop,e.index),this.armRoute(),!0):!1}get routePlaying(){return this.route!==null}cancelRoute(){window.clearTimeout(this.routeTimer),window.clearTimeout(this.fadeTimer),this.route&&(this.route.stop(),this.route=null,this.host.onFade?.(!1),this.host.onRoute?.({playing:!1}))}armRoute(){window.clearTimeout(this.routeTimer);const t=this.route?.dueAt;t!=null&&(this.routeTimer=window.setTimeout(()=>this.routeTick(),Math.max(0,t-performance.now())+1))}routeTick(){const t=this.route;if(!t||this.disposed)return;const e=t.advance(performance.now());if(e===null){this.armRoute();return}if(e==="end"){this.route=null,this.host.onRoute?.({playing:!1});return}this.showStop(e.stop,e.index),this.armRoute()}showStop(t,e){const i=()=>{!this.route||this.disposed||(this.jump(t),this.host.onFade?.(!1),this.host.onRoute?.({playing:!0,index:e,label:t.label}))};window.clearTimeout(this.fadeTimer),this.fadeMs>0&&this.host.onFade?(this.host.onFade(!0),this.fadeTimer=window.setTimeout(i,this.fadeMs)):i()}apply(t){for(const e of t)switch(e.type){case"stick":this.touchStick={forward:e.forward,strafe:e.strafe,run:e.run},this.host.onStick?.({origin:e.origin,knob:e.knob,run:e.run}),this.kick();break;case"stick-end":this.touchStick=null,this.host.onStick?.(null);break;case"look":this.ease?(this.ease.add(e.dHeading,e.dPitch),this.kick()):(this.ctrl.look(e.dHeading,e.dPitch),this.host.onPose());break;case"fov":this.host.onFov?.(e.fov);break;case"tap":this.host.onTap?.(e.x,e.y);break;case"long-press":this.host.onLongPress?.(e.x,e.y);break}}armLong(){const t=this.touch.nextDeadline();t!==this.longDue&&(window.clearTimeout(this.longTimer),this.longDue=t,!(t===null||this.disposed)&&(this.longTimer=window.setTimeout(()=>{this.longDue=null,this.apply(this.touch.tick(performance.now())),this.armLong()},Math.max(0,t-performance.now())+1)))}get stickVector(){return this.touchStick?{forward:this.touchStick.forward,strafe:this.touchStick.strafe}:null}get pointerLocked(){return this.locked}}const Oh={now:()=>Date.now(),setTimeout:(s,t)=>globalThis.setTimeout(s,t),clearTimeout:s=>globalThis.clearTimeout(s)};function Ji(s){const t=typeof s=="number"?s:Number(s);return Number.isFinite(t)&&t>0?Math.round(t*1e3):0}class Nh{constructor(t){this.opts=t,this.phaseNow="active",this.timer=null,this.timerDue=0,this.holds=new Set,this.disposed=!1,this.sched=t.scheduler??Oh,this.wakeOnChange=t.wakeOnChange!==!1,this.ms=Ji(t.idleS),this.lastActivity=this.sched.now(),this.arm()}get phase(){return this.phaseNow}get idleS(){return this.ms/1e3}input(){this.disposed||(this.lastActivity=this.sched.now(),this.phaseNow==="idle"&&this.set("active","input"))}change(){if(!this.disposed){if(this.phaseNow==="idle"){this.wakeOnChange&&(this.lastActivity=this.sched.now(),this.set("active","change"));return}this.lastActivity=this.sched.now()}}hold(t,e){if(!this.disposed){if(e){this.holds.add(t),this.lastActivity=this.sched.now(),this.phaseNow==="idle"?this.set("active","hold"):this.clear();return}this.holds.delete(t)&&(this.lastActivity=this.sched.now(),this.arm())}}setVisible(t){this.disposed||!t||(this.lastActivity=this.sched.now(),this.phaseNow==="idle"&&this.set("active","visible"))}setIdleS(t){if(this.disposed)return;const e=Ji(t);if(e!==this.ms){if(this.ms=e,this.lastActivity=this.sched.now(),this.phaseNow==="idle"){this.set("active","config");return}this.clear(),this.arm()}}dispose(){this.disposed=!0,this.clear(),this.holds.clear()}set(t,e){t!==this.phaseNow&&(this.phaseNow=t,t==="active"?this.arm():this.clear(),this.opts.onChange(t,e))}clear(){this.timer!==null&&this.sched.clearTimeout(this.timer),this.timer=null,this.timerDue=0}arm(){if(this.disposed||this.ms<=0||this.phaseNow==="idle"||this.holds.size>0){this.clear();return}const t=this.lastActivity+this.ms;this.timer!==null&&this.timerDue<=t||(this.clear(),this.timerDue=t,this.timer=this.sched.setTimeout(()=>this.fire(),Math.max(0,t-this.sched.now())))}fire(){if(this.timer=null,this.timerDue=0,!(this.disposed||this.phaseNow!=="active"||this.holds.size>0||this.ms<=0)){if(this.sched.now()-this.lastActivity<this.ms){this.arm();return}this.set("idle","timeout")}}}class Bh{constructor(){this.reasons=new Set}set(t,e){const i=this.paused;return e?this.reasons.add(t):this.reasons.delete(t),i!==this.paused}has(t){return this.reasons.has(t)}get paused(){return this.reasons.size>0}}const qh=1200,Xe="sw.plan3d.lockrefused";function Hh(){let s=null;return{doc:document,frame:()=>{try{if(window.self===window.top)return null;const t=window.frameElement;if(!t)return null;const e=t.getAttribute("sandbox");return{sandbox:e===null?null:e.split(/\s+/).filter(Boolean)}}catch{return null}},supported:()=>typeof Element<"u"&&typeof Element.prototype.requestPointerLock=="function",store:{get:()=>{try{return sessionStorage.getItem(Xe)??s}catch{return s}},set:t=>{s=t;try{t===null?sessionStorage.removeItem(Xe):sessionStorage.setItem(Xe,t)}catch{}}},setTimeout:(t,e)=>window.setTimeout(t,e),clearTimeout:t=>window.clearTimeout(t)}}const to=s=>s==="unsupported"||s==="frame-sandbox"||s==="refused";class Uh{constructor(t=Hh(),e){this.env=t,this.onRefused=e,this.attached=0,this.reported=!1,this.lockedOnce=!1,this.onError=()=>{this.refuse("refused")},this.onChange=()=>{this.env.doc.pointerLockElement&&(this.lockedOnce=!0)}}get blocked(){if(!this.env.supported())return"unsupported";const t=this.env.frame();if(t&&t.sandbox&&!t.sandbox.includes("allow-pointer-lock"))return"frame-sandbox";const e=this.env.store.get();return to(e)?e:null}effectiveMode(t){return t!=="drag"&&this.blocked?"drag":t}attach(){this.attached++===0&&(this.env.doc.addEventListener("pointerlockerror",this.onError),this.env.doc.addEventListener("pointerlockchange",this.onChange));let t=!1;return()=>{t||(t=!0,--this.attached===0&&(this.env.doc.removeEventListener("pointerlockerror",this.onError),this.env.doc.removeEventListener("pointerlockchange",this.onChange)))}}reset(){this.env.store.set(null),this.reported=!1}request(t){const e=this.blocked;if(e)return Promise.resolve({state:"blocked",reason:e});const i=t.requestPointerLock;if(typeof i!="function")return Promise.resolve(this.refuse("unsupported"));const{doc:n}=this.env;return new Promise(o=>{let a=null,r=!1;const l=u=>{r||(r=!0,n.removeEventListener("pointerlockchange",h),n.removeEventListener("pointerlockerror",c),a!==null&&this.env.clearTimeout(a),o(u))},h=()=>{n.pointerLockElement===t&&(this.lockedOnce=!0,l({state:"locked"}))},c=()=>l(this.refuse("refused"));n.addEventListener("pointerlockchange",h),n.addEventListener("pointerlockerror",c),a=this.env.setTimeout(()=>l(this.refuse("refused")),qh);try{const u=i.call(t);u&&typeof u.then=="function"&&u.then(()=>{n.pointerLockElement===t&&(this.lockedOnce=!0,l({state:"locked"}))},()=>l(this.refuse("refused")))}catch{l(this.refuse("refused"))}})}refuse(t){return this.lockedOnce&&t==="refused"?{state:"refused",reason:t}:(to(this.env.store.get())||this.env.store.set(t),this.reported||(this.reported=!0,this.onRefused?.(t)),{state:"refused",reason:t})}}const Ve=6;function Wh(s,t){const e=Math.max(.001,s.maxX-s.minX),i=Math.max(.001,s.maxZ-s.minZ),n=t-2*Ve,o=n/Math.max(e,i),a=Ve+(n-e*o)/2,r=Ve+(n-i*o)/2;return{size:t,k:o,toPx:(l,h)=>[a+(l-s.minX)*o,r+(h-s.minZ)*o],toM:(l,h)=>[s.minX+(l-a)/o,s.minZ+(h-r)/o]}}function Gh(s,t,e,i,n,o){const a=t.levels.find(d=>d.id===e.level);if(s.clearRect(0,0,n,n),!a)return null;const r=Wh(a.extent,n);s.fillStyle=o.bg,s.beginPath(),s.roundRect(0,0,n,n,10),s.fill();for(const d of t.rooms)d.level===a.id&&(s.beginPath(),d.poly.forEach(([p,m],w)=>{const[v,g]=r.toPx(p,m);w?s.lineTo(v,g):s.moveTo(v,g)}),s.closePath(),s.fillStyle=o.room,s.fill());const l=(d,p,m,w)=>{const[v,g]=r.toPx(d[0],d[1]),[z,k]=r.toPx(p[0],p[1]);s.strokeStyle=m,s.lineWidth=w,s.beginPath(),s.moveTo(v,g),s.lineTo(z,k),s.stroke()};s.lineCap="round";for(const d of a.segs)d.kind!=="door"&&l(d.a,d.b,d.kind==="window"?o.window:d.kind==="object"?o.object:d.kind==="low"?o.low:o.wall,d.kind==="object"?1:Math.max(1.5,d.r*2*r.k));for(const d of t.doors)d.level===a.id&&l(d.a,d.b,d.passable?o.doorOpen:o.doorClosed,2.5);for(const d of t.bands)if(!(d.from!==a.id&&d.to!==a.id)){for(const p of d.sides)l(p.a,p.b,o.stair,1);for(const p of d.ramps){const m=Math.hypot(p.b[0]-p.a[0],p.b[1]-p.a[1])||1,w=[-(p.b[1]-p.a[1])/m,(p.b[0]-p.a[0])/m],v=Math.max(2,Math.round(m/.3));for(let g=1;g<v;g++){const z=g/v,k=p.a[0]+(p.b[0]-p.a[0])*z,P=p.a[1]+(p.b[1]-p.a[1])*z;l([k+w[0]*p.width/2,P+w[1]*p.width/2],[k-w[0]*p.width/2,P-w[1]*p.width/2],o.stair,.75)}}}if(i&&i.length){s.setLineDash([3,3]);let d=[e.x,e.z];for(const p of i)l(d,p,o.path,2),d=p;s.setLineDash([])}const[h,c]=r.toPx(e.x,e.z),u=(e.heading_deg-90)*Math.PI/180;return s.fillStyle=o.meRing,s.beginPath(),s.moveTo(h,c),s.arc(h,c,22,u-.5,u+.5),s.closePath(),s.fill(),s.fillStyle=o.me,s.beginPath(),s.arc(h,c,4,0,Math.PI*2),s.fill(),r}var jh=Object.defineProperty,Kh=Object.getOwnPropertyDescriptor,Ot=(s,t,e,i)=>{for(var n=i>1?void 0:i?Kh(t,e):t,o=s.length-1,a;o>=0;o--)(a=s[o])&&(n=(i?a(t,e,n):a(n))||n);return i&&n&&jh(t,e,n),n};const eo=640,so=["saved","door","room","camera","centre"],io={saved:"walk.kindSaved",door:"walk.kindDoor",room:"walk.kindRoom",camera:"walk.kindCamera",centre:"walk.kindCentre"},ve=s=>s in io?Q(io[s]):s,oo=28;let xt=class extends fo{constructor(){super(...arguments),this.starts=[],this.shown=null,this.routePlaying=!1,this.compact=!1,this.open=!1,this.swipe=null,this.suppressClick=!1,this.onGrabDown=s=>{this.swipe={y:s.clientY,id:s.pointerId,moved:!1}},this.onGrabMove=s=>{const t=this.swipe;if(!t||s.pointerId!==t.id||t.moved)return;const e=s.clientY-t.y;e<=-oo?(this.open=!0,t.moved=!0):e>=oo&&(this.open=!1,t.moved=!0)},this.onGrabUp=s=>{if(!this.swipe||s.pointerId!==this.swipe.id)return;const t=this.swipe.moved;this.swipe=null,t&&(this.suppressClick=!0,window.setTimeout(()=>this.suppressClick=!1,80))},this.onGrabClick=()=>{if(this.suppressClick){this.suppressClick=!1;return}this.open=!this.open}}connectedCallback(){super.connectedCallback();const s=this.getRootNode().host??this;this.compact=s.clientWidth>0&&s.clientWidth<=eo,typeof ResizeObserver<"u"&&(this.ro=new ResizeObserver(()=>{const t=s.clientWidth;t>0&&(this.compact=t<=eo)}),this.ro.observe(s))}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}setStick(s){const t=this.renderRoot.querySelector(".stick");if(!t)return;if(!s){t.hidden=!0;return}const e=this.getBoundingClientRect();t.hidden=!1,t.style.transform=`translate(${Math.round(s.origin[0]-e.left)}px, ${Math.round(s.origin[1]-e.top)}px)`,t.toggleAttribute("data-run",s.run);const i=t.querySelector(".knob");i&&(i.style.transform=`translate(${Math.round(s.knob[0])}px, ${Math.round(s.knob[1])}px)`)}setTarget(s){const t=this.renderRoot.querySelector(".target");if(t){if(!s){t.hidden=!0;return}t.hidden=!1,t.style.transform=`translate(${Math.round(s.x)}px, ${Math.round(s.y)}px)`}}setFade(s){this.renderRoot.querySelector(".fade")?.toggleAttribute("data-on",s)}get sheetOpen(){return this.compact&&this.open}emit(s,t){this.dispatchEvent(new CustomEvent(s,{detail:t}))}onField(s,t){const e=Number(t.target.value);Number.isFinite(e)&&this.emit("hud-field",{key:s,value:e})}goto(s){s&&(this.emit("hud-goto",{id:s}),this.open=!1)}toggleRoute(){this.emit("hud-route",{play:!this.routePlaying})}routeButton(){return Ho(this.starts).length<qo?C:T`<button type="button" class="btn ${this.compact?"":"ghost"}" data-walk-route aria-pressed=${this.routePlaying?"true":"false"} @click=${()=>this.toggleRoute()}>${this.routePlaying?Q("walk.routeStop"):Q("walk.route")}</button>`}fields(){const s=this.shown;return s?T`<label class="num">x <input type="number" step="0.1" inputmode="decimal" data-walk-x aria-label=${Q("walk.xMetres")} .value=${s.x.toFixed(2)} @change=${t=>this.onField("x",t)} /></label>
      <label class="num">y <input type="number" step="0.1" inputmode="decimal" data-walk-y aria-label=${Q("walk.yMetres")} .value=${s.z.toFixed(2)} @change=${t=>this.onField("z",t)} /></label>
      <label class="num">${Q("walk.heading")} <input type="number" step="5" inputmode="numeric" data-walk-heading aria-label=${Q("walk.headingDeg")} .value=${String(s.heading)} @change=${t=>this.onField("heading",t)} /></label>`:C}bar(){const s=so.filter(t=>this.starts.some(e=>e.kind===t));return T`<div class="walkbar" role="group" aria-label=${Q("walk.bar")} data-walk-bar>
      <button type="button" class="btn ghost" data-walk-exit @click=${()=>this.emit("hud-exit",null)}>${Q("walk.exit")}</button>
      <select data-walk-start aria-label=${Q("walk.standAt")} @change=${t=>{const e=t.target,i=e.value;e.value="",this.goto(i)}}>
        <option value="">${Q("walk.standAt")}</option>
        ${s.map(t=>T`<optgroup label=${ve(t)}>${this.starts.filter(e=>e.kind===t).map(e=>T`<option value=${e.id}>${e.label||ve(t)}</option>`)}</optgroup>`)}
      </select>
      ${this.routeButton()}
      ${this.fields()}
    </div>`}sheet(){const s=so.filter(t=>this.starts.some(e=>e.kind===t));return T`<div class="sheet" role="group" aria-label=${Q("walk.bar")} data-walk-bar data-walk-sheet data-open=${this.open?"true":"false"}>
      ${this.open?T`<div class="body" id="walk-sheet-body" data-walk-sheet-body>
            ${s.map(t=>T`<div class="group"><h4>${ve(t)}</h4>
              <div class="places">${this.starts.filter(e=>e.kind===t).map(e=>T`<button type="button" class="btn" data-walk-place=${e.id} @click=${()=>this.goto(e.id)}>${e.label||ve(t)}</button>`)}</div></div>`)}
            <div class="fields">${this.fields()}</div>
          </div>`:C}
      <div class="row">
        <button type="button" class="btn ghost" data-walk-exit @click=${()=>this.emit("hud-exit",null)}>${Q("walk.exit")}</button>
        <button type="button" class="btn" data-walk-sheet-toggle aria-expanded=${this.open?"true":"false"} aria-controls="walk-sheet-body"
          style="touch-action: none" @pointerdown=${this.onGrabDown} @pointermove=${this.onGrabMove} @pointerup=${this.onGrabUp} @pointercancel=${this.onGrabUp} @click=${this.onGrabClick}>${Q("walk.standAt")}<i class="chev" aria-hidden="true"></i></button>
        <span class="gap"></span>
        ${this.routeButton()}
      </div>
    </div>`}render(){return T`<i class="stick" hidden aria-hidden="true"><i class="knob"></i></i><i class="target" hidden aria-hidden="true"></i><i class="fade" aria-hidden="true"></i>${this.compact?this.sheet():this.bar()}`}};xt.styles=Pe`
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
  `;Ot([O({attribute:!1})],xt.prototype,"starts",2);Ot([O({attribute:!1})],xt.prototype,"shown",2);Ot([O({type:Boolean})],xt.prototype,"routePlaying",2);Ot([G()],xt.prototype,"compact",2);Ot([G()],xt.prototype,"open",2);xt=Ot([mo("sw-walk-hud")],xt);const Xh=new Set(["entity","camera","object","opening"]);function Vh(s,t,e,i){if(t.path&&t.path.length)return t.cancelPath(),{kind:"cancel"};const n=s.pickAt(e,i),o=n&&n.kind!=="zone"&&n.kind!=="level"?[n.point[0],n.point[2]]:s.floorPoint(e,i,t.pose().ground);if(!o)return{kind:"none"};const a=t.pathTo(o[0],o[1]);return!a||!a.length?{kind:"unreachable"}:{kind:"walk",target:a[a.length-1],path:a}}function Yh(s,t,e){const i=s.pickAt(t,e);return i&&Xh.has(i.kind)?i:null}class Zh{constructor(t){this.host=t,this.last=null,this.ringShown=!1,this.minimapId=null}get touch(){return this.last==="touch"}hooks(){return{onTap:(t,e)=>this.tap(t,e),onLongPress:(t,e)=>this.longPress(t,e),onFov:t=>this.host.view()?.setWalkFov(t),onStick:t=>this.host.hud()?.setStick(t),onInput:t=>this.input(t),onFade:t=>this.host.hud()?.setFade(t),onRoute:t=>this.route(t)}}reset(){this.last=null,this.ringShown=!1,this.minimapId=null,this.host.touching(!1)}input(t){t!==this.last&&(this.last=t,this.host.touching(t==="touch"))}tap(t,e){const i=this.host.walk(),n=this.host.view();if(!i||!n)return;const o=Vh(n,i.ctrl,t,e);o.kind==="walk"?i.kick():o.kind==="unreachable"&&this.host.message(Q("walk.noWay"),"warn"),this.updateTarget()}longPress(t,e){const i=this.host.view(),n=i?Yh(i,t,e):null;if(n){try{navigator.vibrate?.(12)}catch{}this.host.select(n)}}route(t){const e=this.host.hud();e&&(e.routePlaying=t.playing),t.label&&this.host.message(t.label,"info")}updateTarget(){const t=this.host.hud(),e=this.host.walk(),i=this.host.view();if(!t||!e||!i)return;const n=e.ctrl.path;if(!n||!n.length){this.ringShown&&(this.ringShown=!1,t.setTarget(null));return}const o=n[n.length-1],a=i.projectPoint([o[0],e.ctrl.pose().ground,o[1]]);this.ringShown=!!a,t.setTarget(a)}goto(t){const e=this.host.world()?.starts.find(i=>i.id===t.detail.id);e&&this.host.walk()?.goTo(e)}field(t){const e=this.host.walk();if(!e)return;const{key:i,value:n}=t.detail,o=e.ctrl;e.goTo({id:"field",kind:"centre",label:"",level:o.level,x:i==="x"?n:o.x,z:i==="z"?n:o.z,heading_deg:i==="heading"?n:o.heading,pitch_deg:o.pitch,eye_m:null})}routeToggle(t){t.detail.play?this.host.walk()?.playRoute():this.host.walk()?.cancelRoute()}minimapDown(t){if(!(t.pointerType==="mouse"&&t.button!==0)){this.input(t.pointerType==="mouse"?"mouse":"touch"),this.minimapId=t.pointerId;try{t.currentTarget.setPointerCapture(t.pointerId)}catch{}t.preventDefault(),this.minimapGo(t)}}minimapMove(t){t.pointerId===this.minimapId&&this.minimapGo(t)}minimapUp(t){t.pointerId===this.minimapId&&(this.minimapId=null)}minimapGo(t){const e=this.host.minimap(),i=this.host.walk();if(!e||!i)return;const n=t.currentTarget.getBoundingClientRect();let[o,a]=e.toM(t.clientX-n.left,t.clientY-n.top);const r=this.host.world()?.levels.find(l=>l.id===i.ctrl.level)?.extent;r&&(o=Math.min(Math.max(o,r.minX+nt),Math.max(r.minX+nt,r.maxX-nt)),a=Math.min(Math.max(a,r.minZ+nt),Math.max(r.minZ+nt,r.maxZ-nt))),i.goTo({id:"minimap",kind:"centre",label:"",level:i.ctrl.level,x:o,z:a,heading_deg:i.ctrl.heading,pitch_deg:i.ctrl.pitch,eye_m:null})}}const no=1.35,Qh=100,Jh=700;function tc(s,t){return s<Jh?null:s-12-t-12>=Qh?"row":"above"}function ec(s,t){if(typeof ResizeObserver>"u")return;const e=()=>{const n=tc(s.clientWidth,t.getBoundingClientRect().width);n?s.setAttribute("data-zoom-room",n):s.removeAttribute("data-zoom-room")},i=new ResizeObserver(e);return i.observe(s),i.observe(t),e(),i}const sc=Pe`
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
`;function ic(s,t){return s?T`<div class="zoom" role="group" aria-label=${A("זום")} data-3d-zoom>
    <button type="button" aria-label=${A("התרחקות")} title=${A("התרחקות")} data-3d-zoom-out @click=${()=>t(1/no)}><sw-icon name="minus" size="18" aria-hidden="true"></sw-icon></button>
    <button type="button" aria-label=${A("התקרבות")} title=${A("התקרבות")} data-3d-zoom-in @click=${()=>t(no)}><sw-icon name="plus" size="18" aria-hidden="true"></sw-icon></button>
  </div>`:C}const oc={live:"live-text",recorded:"recorded-text",offline:"offline-text",stale:"stale-text",unknown:"unknown-text",danger:"danger-text",warning:"warning-text",success:"live-text",forbidden:"forbidden-text",accent:"accent-text","text-3":"text-2","map-label":"text-2"},nc=s=>`var(--sw-${oc[s]??s})`,ao=264,ac=160,rc=240,lc=6;class hc{constructor(t){this.host=t,this.pills=[],this.tags=[],this.prefs=Mo,this.selected=null,this.hidden=!1,this.active=!0,this.phoneW=640,this.lod="mid",this.near=null,this.pop=null,this.pinned=!1,this.hoverTimer=0,this.sizes=new Map,this.placed=new Map,this.onDown=e=>{if(!this.pop)return;e.composedPath().some(n=>n instanceof HTMLElement&&(n.classList.contains("rpop")||n.classList.contains("rp")))||this.closePop()},this.onKey=e=>{e.key==="Escape"&&this.closePop()},t.addController(this)}request(t,e){this.host.requestUpdate(t,e)}hostConnected(){this.host.addEventListener("pointerdown",this.onDown,!0),this.host.addEventListener("keydown",this.onKey)}hostDisconnected(){window.clearTimeout(this.hoverTimer),this.host.removeEventListener("pointerdown",this.onDown,!0),this.host.removeEventListener("keydown",this.onKey)}summarised(t){if(!this.active||!this.pills.length||this.prefs.mode==="device")return!1;for(const e of this.pills)if(e.devices.some(i=>i.anchorId===t))return!(this.prefs.mode==="room"&&e.id===this.near);return!1}closePop(){if(!this.pop)return;const t=this.pop;this.pop=null,this.pinned=!1,this.request("pillPop",t)}openPop(t,e){window.clearTimeout(this.hoverTimer);const i=this.pop;this.pop=t,this.pinned=e,i!==t&&this.request("pillPop",i)}emit(t,e){this.host.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}onPillClick(t,e){if(t.stopPropagation(),this.prefs.tap==="card"||!e.devices.length){this.closePop(),this.emit("room-open",{id:e.id});return}this.pop===e.id&&this.pinned?this.closePop():this.openPop(e.id,!0)}onPillEnter(t,e){t.pointerType!=="mouse"||this.prefs.tap==="card"||!e.devices.length||this.pinned||(window.clearTimeout(this.hoverTimer),this.hoverTimer=window.setTimeout(()=>this.openPop(e.id,!1),ac))}onLeave(t){t.pointerType!=="mouse"||this.pinned||(window.clearTimeout(this.hoverTimer),this.hoverTimer=window.setTimeout(()=>this.closePop(),rc))}onPopEnter(){window.clearTimeout(this.hoverTimer)}pill(t,e,i){const n=Sa(t),o=Aa(t),a=_a(t),r=this.selected===t.id||this.pop===t.id,l=(c,u)=>T`<button type="button" class=${`rp ${c}${i?" dim":""}`} data-room-pill=${t.id} data-rp-part=${t.id} data-tone=${n} data-lod=${e}
      aria-label=${Ea(t)} aria-pressed=${r?"true":"false"} aria-haspopup=${this.prefs.tap==="popover"&&t.devices.length?"dialog":C}
      @click=${d=>this.onPillClick(d,t)} @pointerenter=${d=>this.onPillEnter(d,t)} @pointerleave=${d=>this.onLeave(d)}>${u}</button>`;if(o&&!a)return this.prefs.quiet==="bubble"?l("",T`<span class="n">${t.name}</span><i class="sep"></i><span class="s">${A("הכול סגור")}</span>`):l("quiet",T`<span class="n">${t.name}</span>`);if(a&&e!=="far")return l("sole",T`<sw-icon name=${a.icon} size=${13}></sw-icon><span class="n">${a.label}</span>${a.words?T`<i class="sep"></i><span class="s" data-kind=${a.kind}>${a.words}</span>`:C}`);if(e==="far")return l("far",T`<span class="n">${t.name}</span>${t.open?T`<i class="b open">${t.open}</i>`:C}${t.presence?T`<i class="b pres"></i>`:C}${t.lit?T`<i class="b lit">${t.lit}</i>`:C}`);const h=[];return t.open&&h.push(T`<span class="s open">${Zs(t.open)}</span>`),t.presence&&h.push(T`<span class="s pres"><sw-icon name="user" size=${13}></sw-icon></span>`),t.lit&&h.push(T`<span class="s lit"><sw-icon name="light" size=${13}></sw-icon><span class="num">${t.lit}</span></span>`),t.temp!==null&&h.push(T`<span class="s num">${Ts(t.temp)}</span>`),l("",T`<span class="n">${t.name}</span>${h.map(c=>T`<i class="sep"></i>${c}`)}`)}row(t){return T`<button type="button" class="row" data-kind=${t.kind} data-rp-device=${t.anchorId} @click=${e=>{e.stopPropagation(),this.closePop(),this.emit("part-select",{id:t.anchorId,kind:"entity"})}}>
      <sw-icon name=${t.icon} size=${15}></sw-icon><span class="l">${t.label}</span><span class="v">${t.words}</span></button>`}popover(t){const e=Pa(t,6);return T`<div class="rpop" role="dialog" aria-label=${t.name} data-room-pop=${t.id} @pointerenter=${()=>this.onPopEnter()} @pointerleave=${i=>this.onLeave(i)} @click=${i=>i.stopPropagation()}>
      <h3>${t.name}<small>${A("{n} התקנים",{n:t.devices.length})}</small></h3>
      ${e.open.length?T`<div class="grp">${A("פתוחים ({n})",{n:t.devices.filter(i=>i.kind==="open").length})}</div>${e.open.map(i=>this.row(i))}`:C}
      ${e.lit.length?T`<div class="grp">${A("אורות דולקים ({n})",{n:t.devices.filter(i=>i.kind==="lit").length})}</div>${e.lit.map(i=>this.row(i))}`:C}
      ${e.rest.length?T`<div class="grp">${A("מצב")}</div>${e.rest.map(i=>this.row(i))}`:C}
      ${e.more?T`<div class="moredev">${A("ועוד {n} התקנים בכרטיס החדר",{n:e.more})}</div>`:C}
      <button type="button" class="card" data-room-pop-card @click=${i=>{i.stopPropagation(),this.closePop(),this.emit("room-open",{id:t.id})}}>${A("כרטיס החדר")}<sw-icon name="chevron" size=${13}></sw-icon></button>
    </div>`}tag(t,e){return T`<button type="button" class=${`ltag ${t.state}${e?" fixed":""}`} data-level-tag=${t.id} data-lt-part=${e?C:t.id} aria-pressed=${t.state==="sel"?"true":"false"}
      @click=${i=>{i.stopPropagation(),this.emit("stack-level",{id:t.id,enter:!1})}}>
      <span class="lvl num">${t.short}</span><span class="tx"><b>${t.name}</b><span class="sum">
        ${t.open?T`<span class="open"><sw-icon name="door" size=${12}></sw-icon>${Zs(t.open)}</span>`:C}
        ${t.presence?T`<span class="pres"><sw-icon name="user" size=${12}></sw-icon>${A("נוכחות")}</span>`:C}
        ${t.lit?T`<span class="lit"><sw-icon name="light" size=${12}></sw-icon><span class="num">${t.lit}</span></span>`:C}
        ${t.temp!==null?T`<span class="num">${Ts(t.temp)}</span>`:C}
        ${!t.open&&!t.presence&&!t.lit&&t.temp===null?T`<span>${A("הכול סגור")}</span>`:C}</span></span></button>`}render(){if(!this.active||!this.pills.length&&!this.tags.length)return C;const t=this.tags.find(i=>i.state==="sel")??null,e=this.pop?this.pills.find(i=>i.id===this.pop):null;return T`<div class="rplayer" data-room-pills=${this.pills.length} data-pill-lod=${this.lod} data-pill-near=${this.near??""}>
      ${this.hidden?C:this.pills.map(i=>i.id===this.near&&this.prefs.mode==="room"?C:this.pill(i,this.near?"far":this.lod,!!this.near&&i.id!==this.near))}
      ${e?this.popover(e):C}
      ${t?T`<div class="ltcol" role="group" aria-label=${A("קומות")} data-level-column>${[...this.tags].reverse().map(i=>this.tag(i,!0))}
            <div class="ltcta"><button type="button" class="enter" data-stack-enter @click=${i=>{i.stopPropagation(),this.emit("stack-level",{id:t.id,enter:!0})}}>${A("פתח את הקומה")}<sw-icon name="chevron" size=${13}></sw-icon></button></div></div>`:this.tags.map(i=>this.tag(i,!1))}
    </div>`}layout(t,e,i){if(!this.active||!this.pills.length&&!this.tags.length)return;const o=this.host.renderRoot.querySelector(".rplayer");if(!o)return;const a=!this.tags.some(k=>k.state==="sel"),r=[];for(const k of this.pills)r.push(k.pos,[k.pos[0]+1,k.pos[1],k.pos[2]],[k.pos[0],k.pos[1],k.pos[2]+1]);if(a)for(const k of this.tags)r.push(k.pos);const l=t.projectPoints(r),h=new Map;this.pills.forEach((k,P)=>{const E=l[P*3],_=l[P*3+1],$=l[P*3+2];if(!E)return;const f=Math.max(_?Math.hypot(_.x-E.x,_.y-E.y):0,$?Math.hypot($.x-E.x,$.y-E.y):0);h.set(k.id,{x:E.x,y:E.y,pxPerM:f})});const c=[...h.values()].map(k=>k.pxPerM).sort((k,P)=>k-P),u=$a(c.length?c[Math.floor(c.length/2)]:0,e,this.phoneW),d=e>=this.phoneW&&!this.hidden?za(this.pills,h,e,i):null;if(u!==this.lod||d!==this.near){const k={lod:this.lod,near:this.near};this.lod=u,this.near=d,this.request("pillNear",k)}const p=[...o.querySelectorAll("[data-rp-part]")],m=[],w=new Map;for(const k of p){const P=k.getAttribute("data-rp-part")??"",E=h.get(P);if(!E){k.style.display="none";continue}k.style.display="flex";const _=`${P}|${k.textContent??""}|${k.getAttribute("data-lod")}`;let $=this.sizes.get(_);$||($={w:k.offsetWidth,h:k.offsetHeight},$.w>0&&this.sizes.set(_,$)),m.push({id:P,x:Math.round(E.x),y:Math.round(E.y)-lc,w:$.w,h:$.h}),w.set(P,k)}const v=m.length>1?Ae(m,3):null;this.placed.clear();for(const k of m){const P=w.get(k.id),E=k.y+Math.round(v?.get(k.id)??0),_=`translate(${k.x}px, ${E}px) translate(-50%, -100%)`;P.style.transform!==_&&(P.style.transform=_),this.placed.set(k.id,{x:k.x,y:E,w:k.w,h:k.h})}const g=o.querySelector(".rpop"),z=this.pop?this.placed.get(this.pop):null;if(g&&z){const k=g.offsetHeight,P=Math.max(8,Math.min(e-ao-8,z.x-ao/2));let E=z.y+8;const _=E+k>i-8;_&&(E=Math.max(8,z.y-z.h-8-k)),g.style.transformOrigin=`${Math.round(z.x-P)}px ${_?"100%":"0"}`,g.style.transform=`translate(${Math.round(P)}px, ${Math.round(E)}px)`,g.style.visibility="visible"}else g&&(g.style.visibility="hidden");if(a){const k=this.pills.length*3,P=[...o.querySelectorAll("[data-lt-part]")],E=[],_=new Map;this.tags.forEach((f,b)=>{const y=P.find(I=>I.getAttribute("data-lt-part")===f.id),M=l[k+b];if(!y)return;if(!M){y.style.display="none";return}y.style.display="flex";const S=y.offsetWidth,L=y.offsetHeight,x=Math.max(8,Math.min(e-S-8,Math.round(M.x)+14));E.push({id:f.id,x:x+S/2,y:Math.round(M.y)+L/2,w:S,h:L}),_.set(f.id,{el:y,x,y:Math.round(M.y)+L/2,w:S})});const $=E.length>1?Ae(E,6):null;for(const[f,b]of _){const y=`translate(${b.x}px, ${b.y+Math.round($?.get(f)??0)}px) translate(0, -100%)`;b.el.style.transform!==y&&(b.el.style.transform=y)}}}}const cc=Pe`
  /* the spread view's backdrop when \`map.stack_backdrop\` is dark (round 28 Q7 b): the night sky whatever the theme */
  :host([data-stack-dark]) {
    background: var(--sw-map-stack-night);
  }
  /* PLAN3D-R32-ANSWERS-2438 (owner note on Q-MAP-7): locked to the light look - the day sky whatever the theme */
  :host([data-stack-light]) {
    background: var(--sw-map-stack-day);
  }
  .rplayer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 1;
  }
  .rp,
  .ltag {
    position: absolute;
    left: 0;
    top: 0;
    display: none;
    align-items: center;
    gap: 5px;
    pointer-events: auto;
    cursor: pointer;
    font: inherit;
    direction: rtl;
    white-space: nowrap;
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-border-strong);
    color: var(--sw-text);
    box-shadow: var(--sw-shadow-1);
    transition: opacity 160ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1)), box-shadow 160ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1)), scale 120ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  }
  .rp {
    border-radius: var(--sw-r-pill);
    padding: 3px 10px;
    min-height: 26px;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    line-height: 1.2;
  }
  .rp .n {
    font-weight: 700;
  }
  .rp .sep {
    inline-size: 1px;
    block-size: 12px;
    background: var(--sw-border-strong);
  }
  .rp .s {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-weight: 600;
    color: var(--sw-text-2);
  }
  .rp .s.open,
  .rp .s[data-kind='open'] {
    color: var(--sw-danger-text);
  }
  .rp .s.pres,
  .rp .s[data-kind='pres'] {
    color: var(--sw-accent-text);
  }
  .rp .s.lit,
  .rp .s[data-kind='lit'] {
    color: var(--sw-warning-text);
  }
  .rp .num,
  .ltag .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .rp[data-tone='open'] {
    border-color: var(--sw-danger-text);
  }
  .rp.quiet {
    color: var(--sw-text-2);
    font-weight: 600;
    box-shadow: none;
  }
  .rp.quiet .n {
    font-weight: 600;
  }
  .rp.far {
    gap: 4px;
    padding-inline: 8px 5px;
  }
  .rp .b {
    display: inline-grid;
    place-items: center;
    min-inline-size: 17px;
    block-size: 17px;
    padding: 0 4px;
    border-radius: var(--sw-r-pill);
    font-style: normal;
    font-size: var(--sw-fs-2xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--sw-menu-surface);
  }
  .rp .b.open {
    background: var(--sw-danger-text);
  }
  .rp .b.lit {
    background: var(--sw-warning-text);
  }
  .rp .b.pres {
    min-inline-size: 9px;
    block-size: 9px;
    padding: 0;
    background: var(--sw-accent-text);
  }
  .rp.dim {
    opacity: 0.62;
  }
  .rp[aria-pressed='true'] {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 1px var(--sw-accent), var(--sw-shadow-2);
    opacity: 1;
  }
  .rp:focus-visible,
  .ltag:focus-visible,
  .rpop button:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 2px;
  }
  @media (hover: hover) and (pointer: fine) {
    .rp:hover {
      box-shadow: var(--sw-shadow-2);
      opacity: 1;
    }
  }
  .rp:active {
    scale: 0.97;
  }
  /* the popover: a small card under its pill */
  .rpop {
    position: absolute;
    left: 0;
    top: 0;
    inline-size: 264px;
    visibility: hidden;
    pointer-events: auto;
    direction: rtl;
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-md);
    box-shadow: var(--sw-shadow-3);
    padding: 10px 10px 8px;
    color: var(--sw-text);
    font-size: var(--sw-fs-sm);
    animation: rp-in 150ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
    transform-origin: top center;
  }
  @keyframes rp-in {
    from {
      opacity: 0;
      scale: 0.97;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rpop {
      animation: rp-fade 150ms ease;
    }
    .rp,
    .ltag {
      transition: none;
    }
  }
  @keyframes rp-fade {
    from {
      opacity: 0;
    }
  }
  .rpop h3 {
    margin: 0 4px 6px;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .rpop h3 small {
    font-weight: 500;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .rpop .grp {
    margin: 6px 4px 2px;
    font-size: var(--sw-fs-2xs);
    font-weight: 700;
    color: var(--sw-text-2);
  }
  .rpop .row {
    display: flex;
    align-items: center;
    gap: 8px;
    inline-size: 100%;
    min-block-size: 32px;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: var(--sw-menu-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    text-align: start;
    cursor: pointer;
  }
  @media (hover: hover) and (pointer: fine) {
    .rpop .row:hover {
      background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
    }
  }
  .rpop .row sw-icon {
    color: var(--sw-text-2);
  }
  .rpop .row .l {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rpop .row .v {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .rpop .row[data-kind='open'] .v,
  .rpop .row[data-kind='open'] sw-icon {
    color: var(--sw-danger-text);
  }
  .rpop .row[data-kind='lit'] .v,
  .rpop .row[data-kind='lit'] sw-icon {
    color: var(--sw-warning-text);
  }
  .rpop .row[data-kind='pres'] .v,
  .rpop .row[data-kind='pres'] sw-icon {
    color: var(--sw-accent-text);
  }
  .rpop .moredev {
    margin: 4px 6px 0;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .rpop .card,
  .ltcta .enter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    inline-size: 100%;
    min-block-size: 36px;
    margin-block-start: 8px;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    cursor: pointer;
  }
  .rpop .card:active,
  .ltcta .enter:active {
    scale: 0.98;
  }
  /* the spread levels' tags */
  .ltag {
    gap: 10px;
    padding: 7px 12px 7px 14px;
    border-radius: var(--sw-r-md);
    text-align: start;
    font-size: var(--sw-fs-sm);
  }
  .ltag .lvl {
    display: inline-grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--sw-r-sm);
    background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
    color: var(--sw-accent-text);
    font-weight: 800;
  }
  .ltag .tx {
    display: grid;
    gap: 2px;
  }
  .ltag b {
    font-weight: 700;
  }
  .ltag .sum {
    display: flex;
    gap: 10px;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .ltag .sum > span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .ltag .open {
    color: var(--sw-danger-text);
  }
  .ltag .pres {
    color: var(--sw-accent-text);
  }
  .ltag .lit {
    color: var(--sw-warning-text);
  }
  .ltag.sel {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 1px var(--sw-accent), var(--sw-shadow-2);
  }
  .ltag.away {
    opacity: 0.7;
  }
  .ltcol {
    position: absolute;
    inset-inline-start: 12px;
    inset-block-start: 12px;
    display: grid;
    gap: 8px;
    pointer-events: auto;
    max-inline-size: 260px;
  }
  .ltcol .ltag {
    position: static;
    display: flex;
  }
  @media (max-width: 640px) {
    .ltag {
      padding: 5px 9px;
    }
    .ltag .sum {
      display: none;
    }
    .rpop {
      inline-size: min(264px, calc(100% - 16px));
    }
  }
`,dc=.62,uc=420,pc=6,fc=(s,t)=>[s[0]-t[0],s[1]-t[1],s[2]-t[2]],Ye=(s,t)=>[s[0]+t[0],s[1]+t[1],s[2]+t[2]],Ze=(s,t)=>[s[0]*t,s[1]*t,s[2]*t],Qe=s=>Math.hypot(s[0],s[1],s[2]);function mc(s,t,e,i,n){const o=Math.max(40,n.stageW-i.left-i.right),a=Math.max(40,n.stageH-i.top-i.bottom),r=i.left+o/2-n.stageW/2,l=i.top+a/2-n.stageH/2,h=Math.max(1,e)/dc,c=Math.min(o,a),u=fc(s.position,s.target);let d=s.zoom,p=Qe(u),m;if(n.orthoHalfH!==null)d=Math.min(pc,Math.max(s.zoom,2*n.orthoHalfH*c/(n.stageH*h))),m=2*n.orthoHalfH/d/n.stageH;else{const z=Math.tan(n.fov/2*Math.PI/180);p=Math.max(2,Math.min(p,h*n.stageH/(c*2*z))),m=2*p*z/n.stageH}const w=Ye(Ze(n.right,-r*m),Ze(n.up,l*m)),v=Ye(t,w),g=Qe(u)>0?Ze(u,p/Qe(u)):u;return{position:Ye(v,g),target:v,zoom:d}}const wc=s=>1-Math.pow(1-s,3),ro=(s,t,e)=>[s[0]+(t[0]-s[0])*e,s[1]+(t[1]-s[1])*e,s[2]+(t[2]-s[2])*e];class gc{constructor(t){this.apply=t,this.raf=0}move(t,e,i){cancelAnimationFrame(this.raf);const n=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches;if(!i||n){this.apply(e);return}const o=performance.now(),a=r=>{const l=wc(Math.min(1,(r-o)/uc));this.apply({position:ro(t.position,e.position,l),target:ro(t.target,e.target,l),zoom:t.zoom+(e.zoom-t.zoom)*l}),l<1&&(this.raf=requestAnimationFrame(a))};this.raf=requestAnimationFrame(a)}stop(){cancelAnimationFrame(this.raf)}}const lo={color:"#ffb98a",alpha:.42},vc=.9;class bc{constructor(){this.recipe=Cn,this.quality=2,this.view=null,this.mount=null}async render(t,e){this.release();const i=performance.now(),{width:n,height:o}=e,a=Fn(t(e.variant),e.levelId,e.variant),r=document.createElement("div");r.setAttribute("aria-hidden","true"),r.dataset.stillBake="",r.style.cssText=`position:fixed;left:${-(n+64)}px;top:0;width:${n}px;height:${o}px;overflow:hidden;pointer-events:none;`,document.body.appendChild(r),this.mount=r;const l=new zs({mount:r,color:Nn(e.style),onSelect:()=>{},onHover:()=>{},onFrame:()=>{},quality:2,pixelRatio:1,night:On(e.band).night});if(this.view=l,l.setDescription(a),!l.setPreset(e.preset))throw new Error(A("המבט של התמונה המוכנה אינו זמין לקומה זו."));l.capture();const h=l.renderer.domElement;if(h.width!==n||h.height!==o)throw new Error(A("גודל הציור אינו תואם את גודל התמונה המוכנה."));const c=document.createElement("canvas");c.width=n,c.height=o;const u=c.getContext("2d");if(!u)throw new Error(A("ציור דו־ממדי אינו זמין בדפדפן."));u.fillStyle=Bn(e.style,e.band),u.fillRect(0,0,n,o),u.drawImage(h,0,0),e.band==="sunset"&&(u.globalCompositeOperation="multiply",u.globalAlpha=lo.alpha,u.fillStyle=lo.color,u.fillRect(0,0,n,o),u.globalCompositeOperation="source-over",u.globalAlpha=1);const d=await yc(c),p=w=>{const v=l.projectPoint(w);return v?[v.x,v.y]:null};let m="";try{const w=l.rendererInfo();m=`${w.vendor} ${w.renderer}`.trim().slice(0,160)}catch{m=""}return{blob:d,project:p,renderer:m,ms:Math.round(performance.now()-i)}}release(){this.view?.dispose(),this.view=null,this.mount?.remove(),this.mount=null}dispose(){this.release()}}function yc(s){const t=e=>new Promise(i=>s.toBlob(n=>i(n),e,vc));return t("image/webp").then(async e=>{if(e&&e.type==="image/webp")return e;const i=await t("image/jpeg");if(!i)throw new Error(A("קידוד התמונה נכשל."));return i})}function kc(s,t,e){const i=document.createElement("canvas");i.width=s,i.height=t;const n=i.getContext("2d");if(!n)return Promise.reject(new Error(A("ציור דו־ממדי אינו זמין בדפדפן.")));const o=n.createImageData(s,t);return o.data.set(e),n.putImageData(o,0,0),new Promise((a,r)=>i.toBlob(l=>l?a(l):r(new Error(A("קידוד מפת התאורה נכשל."))),"image/png"))}var xc=Object.defineProperty,Mc=Object.getOwnPropertyDescriptor,R=(s,t,e,i)=>{for(var n=i>1?void 0:i?Mc(t,e):t,o=s.length-1,a;o>=0;o--)(a=s[o])&&(n=(i?a(t,e,n):a(n))||n);return i&&n&&xc(t,e,n),n};const Sc=A("ייצוא glTF נכשל"),Ac=A("עבר לרמה סכמטית — קצב הפריימים היה נמוך"),_c=s=>s==="schematic"?Ac:A("עבר ל{rung} — קצב הפריימים היה נמוך",{rung:os[s]}),Pc=6e4,$c=4e3,Xt="sw.plan3d.fallback",ys="sw.plan3d.night",ye="sw.plan3d.walkguard",Uo=30,ho=6,co=2,uo=["pointerdown","pointermove","keydown","wheel","touchstart"],zc=A("נעילת סמן אינה זמינה בדף הזה — המבט נשאר בגרירה"),ke={desktop:62,touch:70,portrait:76},xe=3.5,Ec=2600,Tc=[],Lc=[0,0,0];function Wo(s,t){return s===t?!0:!t||s.length!==t.length?!1:s.every((e,i)=>e.id===t[i].id&&e.name===t[i].name&&e.elevation_m===t[i].elevation_m)}function Go(s,t){if(s===t)return!0;if(!t)return!1;const e=Object.keys(s);return e.length!==Object.keys(t).length?!1:e.every(i=>{const n=s[i],o=t[i];return!!o&&n.presence===o.presence&&n.open===o.open&&n.lit===o.lit})}const po=new WeakMap;function Je(s,t,e){let i=po.get(s);i||po.set(s,i={}),!(i[t]===e&&s.style[t]===e)&&(i[t]=e,s.style[t]=e)}function Dc(s){return s.replace(/[\s/\\:*?"<>|]+/g,"-").replace(/-{2,}/g,"-").replace(/^-|-$/g,"")||"plan-3d"}function jo(s,t){const e=s.bands.find(l=>l.farFloor?.id===t),i=e?.ramps[0];if(!e||!i)return null;const n=Math.hypot(i.b[0]-i.a[0],i.b[1]-i.a[1])||1,o=(i.b[0]-i.a[0])/n,a=(i.b[1]-i.a[1])/n,r=(Math.atan2(-o,a)*180/Math.PI+360)%360;return{id:`twin:${e.id}`,kind:"centre",label:"",level:e.from,x:i.a[0]-o*.6,z:i.a[1]-a*.6,heading_deg:r,pitch_deg:0,eye_m:null}}function ks(s,t){const e=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());if(!e)return s;const i=e[1].length===3?e[1].split("").map(n=>n+n).join(""):e[1];return`rgba(${parseInt(i.slice(0,2),16)}, ${parseInt(i.slice(2,4),16)}, ${parseInt(i.slice(4,6),16)}, ${t})`}const Rc={wall:A("קיר"),opening:A("פתח"),object:A("עצם"),connector:A("מחבר"),camera:A("מצלמה"),entity:A("ישות"),zone:A("חדר"),label:A("תווית"),level:A("מפלס")},ts=(s,t)=>{try{return(s==="local"?localStorage:sessionStorage).getItem(t)}catch{return null}},Et=(s,t,e)=>{try{const i=s==="local"?localStorage:sessionStorage;e===null?i.removeItem(t):i.setItem(t,e)}catch{}},be=12,Ic=52,Cc=480,es=s=>s==="schematic"?"1":s==="full"?"2":s;let D=class extends fo{constructor(){super(...arguments),this.description=null,this.selectedId=null,this.preset="iso",this.frameKey=null,this.cameras=[],this.labels={},this.exportName="plan-3d",this.levels=[],this.activeLevel=null,this.thumbnailScene=null,this.levelDots={},this.qualityDefault=null,this.minFps=Uo,this.continuous=!1,this.walkable=!1,this.stillsAvailable=!1,this.idleS=0,this.changeKey="",this.qualityForce=null,this.kiosk=!1,this.themeForce=null,this.backdrop=null,this.shownBackdrop="sky",this.sunAt=null,this.roomPills=[],this.pillPrefs=Mo,this.levelTags=[],this.pillsHidden=!1,this.focusRoom=null,this.stackDark=!1,this.stackLight=!1,this.reflAutoOff=!1,this.moodCache=null,this.pillLayer=new hc(this),this.focusFrom=null,this.focusMover=new gc(s=>this.applyPose(s)),this.walkState="off",this.walkShown=null,this.walkAim=null,this.walkNote=null,this.crossFloor=null,this.viewDials={...Ne},this.idle=!1,this.hasIdleStill=!1,this.kioskIdle=null,this.pauseGate=new Bh,this.lockGate=new Uh(void 0,()=>this.onLockRefused()),this.lockStop=null,this.onActivity=()=>this.kioskIdle?.input(),this.walk=null,this.walkNoteTimer=0,this.walkShownAt=0,this.walkAimAt=0,this.minimapFrame=null,this.walkArrivedFrom=null,this.hover=null,this.overlays=[],this.overlayById=new Map,this.pillSizes=new Map,this.hiddenPills=0,this.ready=!1,this.exporting=!1,this.error="",this.toast="",this.chosen=ya(),this.gpu=wa(),this.installMode=null,this.fallbackRung=ie(ts("session",Xt)),this.perfHint=null,this.walkDrop=ie(ts("session",ye)),this.dialsReady=!1,this.timeManual=null,this.timeOpen=!1,this.sunShown=null,this.site=Oe(null),this.clockTimer=0,this.night=ts("local",ys)==="1",this.toastTimer=0,this.view=null,this.presetApplied=!1,this.applied=null,this.probe=null,this.probeTimer=0,this.probed=!1,this.probePending=!1,this.thumbs=new Map,this.thumbsFor=null,this.thumbsQuality=null,this.thumbPass=0,this.settingsAsked=!1,this.ownAsked=!1,this.overlayEls=null,this.realisticNotified=null,this.onVisibility=()=>{this.kioskIdle?.setVisible(!document.hidden),this.setPause("hidden",document.hidden),document.hidden?this.probe&&(this.endProbe(!1),this.probePending=!0):this.probePending&&(oe(this.rung)||this.measuresLevel1())&&this.view&&this.startProbe()},this.onIdleSlot=s=>{this.hasIdleStill=s.target.assignedElements().length>0},this.routeDwellMs=0,this.ui=new Zh({view:()=>this.view,walk:()=>this.walk,hud:()=>this.renderRoot.querySelector("sw-walk-hud"),world:()=>this.description?.walk??null,minimap:()=>this.minimapFrame,select:s=>this.emitSelect(s),message:(s,t)=>this.walkMessage(s,t),touching:s=>{this.toggleAttribute("data-walk-touch",s),s&&(this.walkAim=null)}}),this.minimapPalette=null,this.cornerSent=void 0}firstUpdated(){this.watchBar(),this.init()}watchBar(){const s=this.renderRoot.querySelector(".bar");!s||typeof ResizeObserver>"u"||(this.barRo?.disconnect(),this.zoomRo?.disconnect(),this.barRo=new ResizeObserver(()=>{const t=Math.ceil(s.getBoundingClientRect().height);t>0&&this.style.setProperty("--bar-h",`${t}px`),this.syncFrameInsets()}),this.barRo.observe(s),this.zoomRo?.disconnect(),this.zoomRo=ec(this,s))}syncFrameInsets(){if(!this.view)return;const s=this.kiosk,t=s?null:this.renderRoot.querySelector(".bar"),e=t?Math.ceil(t.getBoundingClientRect().height):0,i=this.clientHeight,n=!s&&i>=Cc?Ic:be;this.view.setFrameInsets({top:n,right:be,bottom:e?e+12+4:be,left:be})}connectedCallback(){super.connectedCallback(),this.pauseGate.set("hidden",document.hidden)&&this.toggleAttribute("data-paused",this.pauseGate.paused),this.hasUpdated&&!this.view&&this.init(),document.addEventListener("visibilitychange",this.onVisibility),this.lockStop??=this.lockGate.attach(),this.hasUpdated&&this.setupIdle()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("visibilitychange",this.onVisibility),this.lockStop?.(),this.lockStop=null,this.disposeIdle(),window.clearInterval(this.clockTimer),this.themeObserver?.disconnect(),this.themeObserver=void 0,this.realisticNotified=null,this.cornerSent=void 0,this.ro?.disconnect(),this.barRo?.disconnect(),this.zoomRo?.disconnect(),cancelAnimationFrame(this.thumbPass),this.thumbPass=0,this.endProbe(!1),this.probed=!1,this.probePending=!1,this.stopWalk(!1),window.clearTimeout(this.walkNoteTimer),this.view?.dispose(),this.view=null,this.applied=null,this.thumbs.clear(),this.thumbsFor=null,window.clearTimeout(this.toastTimer)}get mode(){const s=this.dialsReady&&this.viewDials.quality!=="auto"?this.viewDials.quality:null,t=ie(this.qualityDefault);return this.qualityForce??this.chosen??s??t??this.installMode??"auto"}get autoStartRung(){return ra(this.viewDials.default_view,2,this.gpu)}get rung(){const s=la(this.mode,this.autoStartRung,this.fallbackRung),t=this.walkDrop;return this.walkState==="on"&&t&&Vs.indexOf(t)>Vs.indexOf(s)?t:s}get quality(){return ha(this.rung)}get fallback(){return this.mode==="auto"&&this.fallbackRung!==null&&this.rung===this.fallbackRung}init(){if(this.ownAsked||(this.ownAsked=!0,ka().then(s=>{s&&s!==this.chosen&&(this.chosen=s)})),!this.settingsAsked){this.settingsAsked=!0;const s=Gi(Vo().then(e=>e),fs,{}).catch(()=>({})),t=Gi(da().then(e=>({dials:e.effective,location:e.location})),fs,{dials:{...Ne},location:void 0}).catch(()=>({dials:{...Ne},location:void 0}));Promise.all([s,t]).then(([e,i])=>{this.installMode=ie(e["plan.quality"])??"schematic",this.site=Oe(i.location,e["time.zone"]);const n=i.dials;this.viewDials={...n,mouse_mode:this.lockGate.effectiveMode(n.mouse_mode)},this.shownBackdrop=this.backdrop??(n.backdrop==="studio"?"studio":"sky"),this.dialsReady=!0}).finally(()=>{this.isConnected&&!this.view&&this.init()});return}try{this.view=new zs({mount:this.stage,color:s=>getComputedStyle(this).getPropertyValue(`--sw-${s}`).trim()||"#888888",onSelect:(s,t,e)=>this.onViewSelect(s,t,e),onHover:(s,t,e)=>this.setHover(s,t,e),onFrame:(s,t)=>{this.setAttribute("data-frames",String(s)),this.setAttribute("data-fps",String(t)),this.onProbeFrame(s)},onDraw:()=>this.layoutOverlays(),onAsset:()=>this.setAttribute("data-real-pending",String(this.view?.realPending??0)),quality:this.quality,night:this.night,real:this.realSettings(),dprCap:this.viewDials.dpr_cap,fit:"content"}),this.syncFrameInsets(),this.toggleAttribute("data-night",this.night)}catch(s){console.warn("sw-plan-3d: WebGL failed to start",s),this.error=ga,this.dispatchEvent(new CustomEvent("stills-fallback",{detail:{reason:"webgl"},bubbles:!0,composed:!0}));return}this.view.setContinuous(this.continuous),this.view.setPaused(this.pauseGate.paused),this.view.setRealSettings({motion:this.viewDials.motion}),this.applySun(),this.startClock(),this.watchTheme(),this.notifyRealistic(),this.ro=new ResizeObserver(()=>{this.view?.resize(),this.syncFrameInsets()}),this.ro.observe(this),this.presetApplied=!1,this.setAttribute("data-quality",String(this.quality)),this.description&&this.apply(this.description),this.ready=!0,this.setAttribute("data-ready",""),this.setAttribute("data-selected",this.selectedId??"")}willUpdate(s){if(s.has("backdrop")&&(this.shownBackdrop=this.backdrop??(this.viewDials.backdrop==="studio"?"studio":"sky")),this.syncPillLayer(s),!(s.has("description")||s.has("activeLevel")||s.has("selectedId")||s.has("hover")||s.has("walkState")||s.has("roomPills")||s.has("pillPrefs")||s.has("pillNear")))return;const t=this.description?.parts??[],e=t.filter(r=>r.kind==="chip"),i=this.description?.levels??[],n=i.length?i.reduce((r,l)=>l.elevation_m>r.elevation_m?l:r).id:null,o=this.walkState==="on"?[]:t.filter(r=>r.kind==="label"&&(this.activeLevel?r.level_id===this.activeLevel:!n||r.level_id===n||r.level_id===null));let a=t.filter(r=>r.kind==="entity"&&(!this.activeLevel||r.level_id===this.activeLevel));if(this.roomPills.length&&(a=a.filter(r=>r.userData.id===this.selectedId||r.userData.id===this.hover?.id||!this.pillLayer.summarised(r.userData.id))),this.hiddenPills=0,this.walkState==="on")a=a.filter(r=>r.userData.id===this.selectedId||r.userData.id===this.hover?.id);else if(a.length>(this.quality===3&&this.clientWidth>0&&this.clientWidth<Ws?qn:yo)){const r=a.filter(l=>l.userData.id===this.selectedId||l.userData.id===this.hover?.id||l.color!=="text-3");this.hiddenPills=a.length-r.length,a=r}this.overlays=[...o,...e,...a],this.overlayById=new Map(this.overlays.map(r=>[r.id,r]))}updated(s){if(this.overlayEls=null,this.syncCorner(),s.has("sunAt")&&this.toggleAttribute("data-sun-fixed",this.sunAt!==null),this.syncKiosk(s),!this.view)return;const t=s.has("frameKey")&&s.get("frameKey")!==void 0;t&&(this.presetApplied=!1),t&&this.walkState==="on"&&(this.walkArrivedFrom=String(s.get("frameKey")??"")),s.has("description")&&this.description&&this.apply(this.description),s.has("description")&&this.syncWalk(),t&&!this.presetApplied&&this.applied&&this.frame(),(s.has("selectedId")||s.has("description"))&&(this.view.setSelected(this.selectedId),this.setAttribute("data-selected",this.selectedId??"")),(s.has("preset")&&s.get("preset")!==void 0||t)&&(this.focusFrom=null),s.has("preset")&&s.get("preset")!==void 0&&this.applyPreset(this.preset),s.has("focusRoom")&&this.syncFocus(),s.has("continuous")&&!this.probe&&this.view.setContinuous(this.continuous),s.has("sunAt")&&this.applySun(),this.applyQuality(),this.layoutOverlays()}syncPillLayer(s){const t=this.pillLayer;t.pills=this.roomPills,t.hidden=this.pillsHidden,t.tags=this.levelTags,t.prefs=this.pillPrefs,t.selected=this.focusRoom?.id??null,t.active=this.walkState!=="on"&&!this.kiosk,t.phoneW=Ws,s.has("roomPills")&&t.pop&&!this.roomPills.some(e=>e.id===t.pop)&&t.closePop()}currentPose(){const s=this.view;if(!s)return null;const t=this.preset==="iso"?s.ortho:s.persp,e=s.controls.target;return{position:[t.position.x,t.position.y,t.position.z],target:[e.x,e.y,e.z],zoom:t.zoom}}applyPose(s){const t=this.view;if(!t||this.walkState==="on")return;const e=this.preset==="iso"?t.ortho:t.persp;e.position.set(s.position[0],s.position[1],s.position[2]),t.controls.target.set(s.target[0],s.target[1],s.target[2]),e.zoom!==s.zoom&&(e.zoom=s.zoom,e.updateProjectionMatrix()),t.controls.update()}syncFocus(){const s=this.view;if(!s||this.walkState==="on")return;const t=this.viewDials.motion!==!1,e=this.focusRoom,i=this.currentPose();if(!i)return;if(!e){this.focusFrom&&this.focusMover.move(i,this.focusFrom,t),this.focusFrom=null;return}if(typeof this.preset!="string")return;const n=this.preset==="iso",o=n?s.ortho:s.persp;o.updateMatrixWorld();const a=o.matrixWorld.elements;this.focusFrom??=i;const r=mc(i,e.pos,e.extent,e.inset,{right:[a[0],a[1],a[2]],up:[a[4],a[5],a[6]],orthoHalfH:n?s.ortho.top:null,fov:s.persp.fov,stageW:this.clientWidth,stageH:this.clientHeight});this.focusMover.move(i,r,t)}layoutOverlays(){const s=this.view;if(s&&this.pillLayer.layout(s,this.clientWidth,this.clientHeight),!s||!this.overlays.length)return;const t=this.overlayEls??=[...this.renderRoot.querySelectorAll("[data-3d-part]")].map(l=>({el:l,p:this.overlayById.get(l.getAttribute("data-3d-part")??"")??null})),e=s.projectPoints(t.map(({p:l})=>l?.position??Lc)),i=[];t.forEach(({el:l,p:h},c)=>{const u=h?e[c]:null;if(!h||!u){Je(l,"display","none");return}Je(l,"display","block"),i.push({el:l,p:h,x:Math.round(u.x),y:Math.round(u.y)})});const n=[],o=[],a=[];for(const l of i){const h=`${l.p.id}|${l.p.text??""}`;let c=this.pillSizes.get(h);c||(c={w:l.el.offsetWidth,h:l.el.offsetHeight},c.w>0&&c.h>0&&this.pillSizes.set(h,c)),l.p.kind==="label"?o.push({id:l.p.id,x:l.x,y:l.y+c.h/2,w:c.w,h:c.h}):l.p.kind==="chip"?a.push({id:l.p.id,x:l.x,y:l.y+c.h/2,w:c.w,h:c.h}):n.push({id:l.p.id,x:l.x,y:l.y-ho,w:c.w,h:c.h})}const r=new Map(n.length>1?Ae(n,co):[]);if(o.length){const l=n.map(c=>({...c,y:c.y+(r.get(c.id)??0)})),h=new Set([...a,...l].map(c=>c.id));for(const[c,u]of Ae([...a,...l,...o],co,h))h.has(c)||r.set(c,u)}for(const{el:l,p:h,x:c,y:u}of i){const d=Math.round(r?.get(h.id)??0);Je(l,"transform",h.kind==="chip"||h.kind==="label"?`translate(${c}px, ${u+d}px) translate(-50%, -50%)`:`translate(${c}px, ${u-ho+d}px) translate(-50%, -100%)`)}}apply(s){s!==this.applied&&(this.applied=s,this.view?.setDescription(s),this.setAttribute("data-parts",String(s.parts.length)),this.toggleAttribute("data-estimated",s.estimated),this.presetApplied||this.frame(),this.view?.setSelected(this.selectedId),(oe(this.rung)||this.measuresLevel1())&&!this.probed&&this.startProbe())}realSettings(){const s=this.viewDials;return{rung:this.rung==="realistic"?"realistic":"lite",style:Xn(this.themeForce??s.style,this.uiTheme()),furniture:s.furniture,textures:s.textures,sectionCut:s.section_cut,backdrop:this.shownBackdrop,floorFinish:s.floor_finish??$s,reflections:this.reflectionsOn(),wallCut:s.wall_cut==="mid"?"mid":"low",marks:{marks:s.room_marks??"bar_edge",light:s.light_mark??"bar",alarm:s.alarm_motion??"pulse"}}}reflectionsOn(){const s=this.viewDials;return s.floor_reflections===!1?!1:!(s.reflections_auto!==!1&&(this.gpu==="weak"||this.reflAutoOff))}uiTheme(){return this.themeForce??(document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light")}watchTheme(){this.themeObserver||typeof MutationObserver>"u"||(this.themeObserver=new MutationObserver(()=>{this.minimapPalette=null,this.view?.setRealSettings({style:this.realSettings().style}),this.applySun(),this.requestUpdate()}),this.themeObserver.observe(document.documentElement,{attributes:!0,attributeFilter:["data-theme"]}))}notifyRealistic(){const s=this.quality===3;s!==this.realisticNotified&&(this.realisticNotified=s,this.dispatchEvent(new CustomEvent("realistic-change",{detail:{on:s},bubbles:!0,composed:!0})))}applyQuality(){const s=this.quality,t=this.rung;if(this.setAttribute("data-quality",String(s)),this.setAttribute("data-rung",t),this.setAttribute("data-quality-mode",this.mode),!this.view)return;const e=t==="realistic"?"realistic":"lite",i=this.view.getQuality()===s&&(s!==3||this.view.getRealSettings().rung===e);this.view.setRealSettings({rung:e}),!i&&(this.view.setQuality(s),this.thumbs.clear(),this.probed=!1,this.notifyRealistic(),this.applySun(),(oe(t)||this.measuresLevel1())&&this.applied?this.startProbe():this.endProbe(!1),this.requestUpdate())}sunInstant(){if(this.sunAt!==null&&Number.isFinite(this.sunAt))return this.sunAt;const s=this.timeManual;if(!s){const t=this.lockedMood();if(t==="auto")return Date.now();const e=qt(Date.now(),this.site.zone),i=[e.year,e.month,e.day],n=`${t}|${i.join("-")}|${this.site.zone}|${this.site.latitude}|${this.site.longitude}`;return this.moodCache?.key!==n&&(this.moodCache={key:n,at:Jn(t,i,this.site.zone,this.site.latitude,this.site.longitude)}),this.moodCache.at}return ta(s.ymd[0],s.ymd[1],s.ymd[2],s.hour,this.site.zone)}lockedMood(){if(this.stackDark)return"night";if(this.stackLight)return"day";const s=this.viewDials.light_mood;return s==="day"||s==="evening"||s==="night"?s:"auto"}applySun(){const s=this.view;if(!s)return;const t=this.sunInstant();s.setSun({utcMs:t,latitude:this.site.latitude,longitude:this.site.longitude});const e=s.sunState();if(this.quality===3&&e){const i=qt(t,this.site.zone);this.sunShown={hour:i.hour+i.minute/60,band:ea(e.elevation),elevation:Math.round(e.elevation)};const[n,o,a]=s.skyBackdrop();this.style.setProperty("--sky-top",n),this.style.setProperty("--sky-hor",o),this.style.setProperty("--sky-bot",a),this.setAttribute("data-sun-elevation",String(Math.round(e.elevation))),this.setAttribute("data-style",s.getRealSettings().style)}else this.sunShown=null}setSite(s){this.site=Oe(s,this.site.zone),this.applySun(),this.requestUpdate()}startClock(){window.clearInterval(this.clockTimer),this.viewDials.time_source==="manual"&&!this.timeManual&&this.setTimeHour(qt(Date.now(),this.site.zone).hour),this.clockTimer=window.setInterval(()=>{!this.timeManual&&this.sunAt===null&&this.quality===3&&this.applySun()},Pc)}setTimeHour(s){const t=qt(Date.now(),this.site.zone),e=this.timeManual?.ymd??[t.year,t.month,t.day];this.timeManual={hour:Math.max(0,Math.min(24,s)),ymd:e},this.applySun()}setTimeDate(s){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);if(!t)return;const e=this.timeManual?.hour??this.sunShown?.hour??12;this.timeManual={hour:e,ymd:[Number(t[1]),Number(t[2]),Number(t[3])]},this.applySun()}timeNow(){this.timeManual=null,this.applySun()}setNight(s){s!==this.night&&(this.night=s,Et("local",ys,s?"1":null),this.toggleAttribute("data-night",s),this.view?.setNight(s),this.thumbs.clear(),this.requestUpdate())}get isNight(){return this.night}setQuality(s){this.setMode(ca(s))}setMode(s){const t=this.perfHint;this.chosen=s,xa(s),this.fallbackRung=null,this.perfHint=null,this.walkDrop=null,Et("session",Xt,null),Et("session",ye,null),this.probed=!1,s==="auto"&&t&&(this.fallbackRung=t,Et("session",Xt,es(t)))}startProbe(){if(this.endProbe(!1),this.probed=!0,!this.view||this.minFps<=0)return;if(document.hidden||this.pauseGate.paused){this.probePending=!0;return}this.probePending=!1;const s=performance.now();this.probe={until:0,t0:0,f0:0,start:Number(this.getAttribute("data-frames")??0),s0:s,lt:0,lf:0,watch:new va(this.minFps,ba(this.minFps),Se)},this.view.setContinuous(!0),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),Fo)}onProbeFrame(s){const t=this.probe;if(!t)return;if(document.hidden){this.endProbe(!1),this.probePending=!0;return}const e=performance.now();if(!t.t0){if(s-t.start<Oo)return;t.t0=t.lt=e,t.f0=t.lf=s,t.until=e+Se,window.clearTimeout(this.probeTimer),this.probeTimer=window.setTimeout(()=>this.endProbe(!0),Co);return}const i=t.watch.sample((s-t.lf)*1e3/Math.max(1,e-t.lt),t.lt,e);t.lt=e,t.lf=s,!(!i&&e<t.until)&&(this.setAttribute("data-probe-fps",String(Math.round((s-t.f0)*1e3/Math.max(1,e-t.t0)))),this.endProbe(!1),i&&this.onLowFps())}endProbe(s){window.clearTimeout(this.probeTimer),this.probeTimer=0;const t=this.probe;if(this.probe=null,this.view?.setContinuous(this.continuous),s&&t&&document.hidden){this.probePending=!0;return}if(s&&t){const e=Number(this.getAttribute("data-frames")??0),i=performance.now(),n=t.t0?(e-t.f0)*1e3/Math.max(1,i-t.t0):0;this.setAttribute("data-probe-fps",String(Math.round(n))),(t.t0?t.watch.sample((e-t.lf)*1e3/Math.max(1,i-t.lt),t.lt,i):t.watch.sample(0,t.s0,i))&&this.onLowFps()}}onLowFps(){if(this.rung==="realistic"&&this.viewDials.reflections_auto!==!1&&this.reflectionsOn()){this.reflAutoOff=!0,this.setAttribute("data-reflections-auto-off",""),this.view?.setRealSettings({reflections:!1}),queueMicrotask(()=>{this.isConnected&&this.view&&this.startProbe()});return}const s=Ys(this.rung);if(!s){this.measuresLevel1()&&this.dispatchEvent(new CustomEvent("stills-fallback",{detail:{reason:"fps"},bubbles:!0,composed:!0}));return}this.mode==="auto"?(this.fallbackRung=s,Et("session",Xt,es(s))):this.perfHint=s}syncKiosk(s){(s.has("stackDark")&&s.get("stackDark")!==void 0||s.has("stackLight")&&s.get("stackLight")!==void 0)&&this.applySun(),s.has("idleS")&&this.setupIdle(),s.has("themeForce")&&(this.minimapPalette=null),s.has("themeForce")&&s.get("themeForce")!==void 0&&this.view&&(this.view.setRealSettings({style:this.realSettings().style}),this.applySun()),s.has("shownBackdrop")&&s.get("shownBackdrop")!==void 0&&this.view&&(this.view.setRealSettings({backdrop:this.shownBackdrop}),this.applySun()),s.has("changeKey")&&s.get("changeKey")!==void 0&&this.kioskIdle?.change(),s.has("walkState")&&this.kioskIdle?.hold("walk",this.walkState!=="off")}setupIdle(){const s=this.idleS;if(!(s>0)){this.disposeIdle();return}if(this.kioskIdle){this.kioskIdle.setIdleS(s);return}this.kioskIdle=new Nh({idleS:s,onChange:(t,e)=>this.onIdlePhase(t==="idle",e)});for(const t of uo)window.addEventListener(t,this.onActivity,{capture:!0,passive:!0});this.walkState!=="off"&&this.kioskIdle.hold("walk",!0)}disposeIdle(){if(this.kioskIdle){this.kioskIdle.dispose(),this.kioskIdle=null;for(const s of uo)window.removeEventListener(s,this.onActivity,{capture:!0});this.idle&&this.onIdlePhase(!1,"config")}}onIdlePhase(s,t){this.idle=s,this.toggleAttribute("data-idle",s),this.setPause("idle",s),this.dispatchEvent(new CustomEvent("kiosk-idle",{detail:{idle:s,reason:t},bubbles:!0,composed:!0}))}setPause(s,t){this.pauseGate.set(s,t)&&this.applyPause()}applyPause(){const s=this.pauseGate.paused;s&&this.probe&&(this.endProbe(!1),this.probePending=!0),this.view?.setPaused(s),this.toggleAttribute("data-paused",s),s||(this.requestUpdate(),this.probePending&&this.view&&(oe(this.rung)||this.measuresLevel1())&&this.startProbe())}onLockRefused(){this.viewDials={...this.viewDials,mouse_mode:"drag"},this.walk?.setMouseMode("drag"),this.walkState==="on"&&this.walkMessage(zc,"info")}measuresLevel1(){return this.fallback&&this.stillsAvailable&&this.rung==="schematic"}frame(){this.presetApplied=!0,this.view?.setPreset(this.preset)?this.setAttribute("data-preset",typeof this.preset=="string"?this.preset:"camera"):this.view?.setPreset("iso")&&this.setAttribute("data-preset","iso")}applyPreset(s){this.view?.setPreset(s)&&this.setAttribute("data-preset",typeof s=="string"?s:"camera")}pickPreset(s){this.preset=s,this.applyPreset(s)}labelOf(s){return this.labels[s.id]??Rc[s.kind]??s.id}emitSelect(s){this.dispatchEvent(new CustomEvent("part-select",{detail:{id:s?.id??null,kind:s?.kind??null},bubbles:!0,composed:!0}))}setHover(s,t,e){this.hover=s?{id:s.id,kind:s.kind,label:this.labelOf(s),x:t,y:e}:null,this.dispatchEvent(new CustomEvent("part-hover",{detail:this.hover,bubbles:!0,composed:!0}))}pickLevel(s){const t=this.activeLevel===s?null:s;this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t},bubbles:!0,composed:!0}))}playRoute(){return this.walk?.playRoute()??!1}stopRoute(){this.walk?.cancelRoute()}get routePlaying(){return this.walk?.routePlaying??!1}requestWalk(){this.walkState!=="off"||!this.view||(this.walkState="requested",this.description?.walk?this.startWalk():this.dispatchEvent(new CustomEvent("walk-change",{detail:{on:!0},bubbles:!0,composed:!0})))}syncWalk(){const s=this.description?.walk;if(this.walkState==="requested"&&s)this.startWalk();else if(this.walkState==="on")if(!s)this.stopWalk(!0);else if(this.walkArrivedFrom!==null&&s!==this.walk?.ctrl.world){const t=this.walkArrivedFrom;this.walkArrivedFrom=null,this.startWalk(jo(s,t)??void 0)}else this.walk?.setWorld(s)}get walking(){return this.walkState==="on"}get walkController(){return this.walk?.ctrl??null}walkFov(){return this.clientHeight>this.clientWidth*1.15?ke.portrait:typeof matchMedia=="function"&&matchMedia("(pointer: coarse)").matches?ke.touch:ke.desktop}startWalk(s){const t=this.description?.walk,e=this.view;if(!t||!e){this.walkState="off";return}this.walk?.dispose(),this.minimapPalette=null;const i=s??t.starts.find(o=>o.id===t.defaultStart)??t.starts[0]??null,n=this.walkFov();this.walk=new Fh(t,{canvas:e.renderer.domElement,onPose:()=>this.onWalkPose(),onEvents:o=>this.onWalkEvents(o),onExit:()=>this.stopWalk(!0),onAct:()=>this.walkAct(),onLowFps:()=>this.onWalkLowFps(),...this.ui.hooks()},{eye_m:this.viewDials.eye_m,mouseMode:this.viewDials.mouse_mode,start:i,fov:n,ease:this.viewDials.motion,fadeMs:this.viewDials.motion?void 0:0,routeDwellMs:this.routeDwellMs||void 0}),e.enterWalk(this.walkCameraPose(),n,this.viewDials.motion?Io:0),this.endProbe(!1),this.walkState="on",this.crossFloor=null,this.setAttribute("data-walk",""),this.setAttribute("data-walk-level",this.walk.ctrl.level),this.updateComplete.then(()=>this.onWalkPose(!0))}stopWalk(s){this.walkState!=="off"&&(this.walk?.dispose(),this.walk=null,this.view?.exitWalk(),this.walkState="off",this.walkShown=null,this.walkAim=null,this.crossFloor=null,this.minimapFrame=null,this.minimapPalette=null,this.ui.reset(),this.removeAttribute("data-walk"),this.removeAttribute("data-walk-pos"),this.removeAttribute("data-walk-level"),s&&this.dispatchEvent(new CustomEvent("walk-change",{detail:{on:!1},bubbles:!0,composed:!0})))}walkCameraPose(){const s=this.walk.ctrl.pose();return{x:s.x,y:s.y,z:s.z,heading_deg:s.heading_deg,pitch_deg:s.pitch_deg}}onWalkPose(s=!1){const t=this.walk,e=this.view;if(!t||!e)return;const i=t.ctrl.pose();e.setWalkPose(i),this.drawWalkMinimap(),this.ui.updateTarget(),this.setAttribute("data-walk-pos",`${i.x.toFixed(2)},${i.z.toFixed(2)},${i.heading_deg.toFixed(1)}`);const n=performance.now();(s||n-this.walkShownAt>120)&&(this.walkShownAt=n,this.walkShown={x:i.x,z:i.z,heading:Math.round(i.heading_deg),level:i.level}),(s||n-this.walkAimAt>150)&&!this.ui.touch&&(this.walkAimAt=n,requestAnimationFrame(()=>{if(!this.walk||!this.view)return;const o=this.view.pickCentre(xe),a=o&&["entity","camera","object","opening"].includes(o.kind)?o:null;a?.partId!==this.walkAim?.partId&&(this.walkAim=a)}))}onWalkEvents(s){for(const t of s)t.type==="level"?(this.setAttribute("data-walk-level",t.level),this.activeLevel!==null&&this.activeLevel!==t.level&&this.dispatchEvent(new CustomEvent("level-select",{detail:{id:t.level},bubbles:!0,composed:!0}))):t.type==="cross-floor"?this.crossFloor=t.floor:t.type==="blocked"?this.walkMessage(A("הדלת {state}",{state:Vn[t.door.state]}),"warn"):t.type==="edge"?this.walkMessage(A("קצה התוכנית"),"info"):t.type==="path-blocked"?this.walkMessage(Q("walk.noWay"),"warn"):t.type==="room"&&(this.view?.setInterior(t.room?this.description?.real?.rooms[t.room.id]?.daylight??null:null),t.room?.name&&this.walkMessage(t.room.name,"info"))}walkMessage(s,t){this.walkNote={text:s,tone:t},window.clearTimeout(this.walkNoteTimer),this.walkNoteTimer=window.setTimeout(()=>this.walkNote=null,Ec)}walkAct(){const s=this.view?.pickCentre(xe)??null;s&&this.emitSelect(s)}onWalkLowFps(){const s=Ys(this.rung);s&&(this.viewDials.walk_guard?(this.walkDrop=s,Et("session",ye,es(s)),this.walkMessage(A("הסיור עבר ל{rung} — קצב הפריימים היה נמוך",{rung:os[s]}),"info")):this.perfHint=s)}onViewSelect(s,t,e){const i=this.walk;if(this.walkState!=="on"||!i){this.emitSelect(s);return}if(i.pointerLocked){const o=this.view?.pickCentre(xe)??null;o&&this.emitSelect(o);return}if(s&&s.kind!=="zone"){this.emitSelect(s);return}if(t===void 0||e===void 0)return;const n=this.view?.floorPoint(t,e,i.ctrl.pose().ground);n&&!i.walkTo(n[0],n[1])&&this.walkMessage(A("אין דרך פתוחה לשם"),"warn")}drawWalkMinimap(){const s=this.renderRoot.querySelector("canvas.minimap"),t=this.walk,e=this.description?.walk;if(!s||!t||!e)return;const i=s.clientWidth||160,n=Math.min(2,window.devicePixelRatio||1);s.width!==Math.round(i*n)&&(s.width=Math.round(i*n),s.height=Math.round(i*n));const o=s.getContext("2d");o&&(o.setTransform(n,0,0,n,0,0),this.minimapFrame=Gh(o,e,t.ctrl.pose(),t.ctrl.path,i,this.minimapPalette??=this.readMinimapPalette()))}readMinimapPalette(){const s=getComputedStyle(this),t=(i,n)=>s.getPropertyValue(`--sw-${i}`).trim()||n,e=t("accent","#2767ed");return{bg:t("surface-solid","#ffffff"),wall:t("map-structure","#56617a"),low:t("map-wall","#9aa3b5"),window:t("map-glass","#7fb2ff"),doorOpen:t("live","#22c55e"),doorClosed:t("danger","#ef4444"),object:t("text-3","#9aa3b5"),stair:t("text-2","#6b7f99"),room:ks(e,.07),path:t("live","#22c55e"),me:e,meRing:ks(e,.25)}}renderWalk(){return this.walkState!=="on"||!this.walk?C:T`
      <canvas class="minimap" data-walk-minimap role="img" aria-label=${A("מפה קטנה של המפלס; לחיצה מעבירה לנקודה")}
        @pointerdown=${s=>this.ui.minimapDown(s)} @pointermove=${s=>this.ui.minimapMove(s)}
        @pointerup=${s=>this.ui.minimapUp(s)} @pointercancel=${s=>this.ui.minimapUp(s)}></canvas>
      <span class="cross" ?data-aim=${!!this.walkAim} aria-hidden="true"></span>
      ${this.walkAim?T`<span class="pill aim" data-walk-aim>${this.labelOf(this.walkAim)} · Enter</span>`:C}
      ${this.walkNote?T`<span class="pill walknote" role="status" data-tone=${this.walkNote.tone} data-walk-note>${this.walkNote.text}</span>`:C}
      ${this.crossFloor?T`<span class="pill cross-floor" role="status" data-walk-cross=${this.crossFloor.id}>${A("המדרגות ממשיכות ל{floor}",{floor:this.crossFloor.name??A("קומה אחרת")})}
            <sw-button size="lg" variant="ghost" data-walk-cross-go @click=${()=>this.dispatchEvent(new CustomEvent("floor-request",{detail:{floorId:this.crossFloor.id},bubbles:!0,composed:!0}))}>${A("המשך לקומה")}</sw-button></span>`:C}
      <sw-walk-hud .starts=${this.description?.walk?.starts??Tc} .shown=${this.walkShown}
        @hud-exit=${()=>this.stopWalk(!0)} @hud-goto=${s=>this.ui.goto(s)} @hud-field=${s=>this.ui.field(s)} @hud-route=${s=>this.ui.routeToggle(s)}></sw-walk-hud>`}thumbFor(s){const t=this.thumbnailScene;if(!t||!this.view)return"";(this.thumbsFor!==t||this.thumbsQuality!==this.quality)&&(this.thumbs.clear(),this.thumbsFor=t,this.thumbsQuality=this.quality);const e=this.thumbs.get(s);return e===void 0&&this.scheduleThumbs(),e??""}scheduleThumbs(){this.thumbPass||this.pauseGate.paused||(this.thumbPass=requestAnimationFrame(()=>{this.thumbPass=0;const s=this.thumbnailScene,t=this.view;if(!s||!t||this.thumbsFor!==s)return;let e=!1;for(const i of this.levels){if(this.thumbs.has(i.id))continue;const n=t.renderThumbnail(s,i.id);n&&(this.thumbs.set(i.id,n),e=!0)}e&&t.redrawNow(),this.setAttribute("data-3d-thumbs",String(this.thumbs.size)),e&&this.requestUpdate()}))}get thumbnailCount(){return this.thumbs.size}toScreen(s){return this.view?.projectPoint(s)??null}capture(){return this.view?.capture()??null}captureControl(s){return Ql(s,ma,fa,pa,ua)}async exportGltf(){if(!this.view)throw new Error("3D view not ready");return this.view.exportGltf()}async download(){if(!this.exporting){this.exporting=!0;try{const s=await this.exportGltf(),t=URL.createObjectURL(new Blob([JSON.stringify(s)],{type:"model/gltf+json"})),e=document.createElement("a");e.href=t,e.download=`${Dc(this.exportName)}.gltf`,e.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(s){console.warn("sw-plan-3d: glTF export failed",s),this.showToast(Sc)}finally{this.exporting=!1}}}showToast(s){this.toast=s,window.clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",$c)}renderStrip(){if(this.levels.length<2||!this.thumbnailScene||!this.ready)return C;const s=[...this.levels].sort((t,e)=>e.elevation_m-t.elevation_m||(t.id<e.id?-1:1));return this.thumbs=Yn(this.thumbs,s.map(t=>t.id)),T`<div class="strip" role="group" aria-label=${A("מפלסים")} data-3d-strip>
      ${s.map(t=>{const e=this.levelDots[t.id];return T`<button type="button" data-3d-thumb=${t.id} aria-pressed=${this.activeLevel===t.id?"true":"false"} title=${`${t.name} · ${t.elevation_m>=0?"+":"−"}${Math.abs(t.elevation_m).toFixed(1)} ${A("מ׳")}`} @click=${()=>this.pickLevel(t.id)}>
          <span class="pic"><img alt="" src=${this.thumbFor(t.id)} />${e&&(e.presence>0||e.open||e.lit)?T`<span class="dots" data-3d-dots=${t.id}>${e.presence>0?T`<i data-dot="presence" title=${A("תנועה")} style=${`--fade:${Math.max(.35,e.presence).toFixed(2)}`}></i>`:C}${e.open?T`<i data-dot="open" title=${A("פתח פתוח")}></i>`:C}${e.lit?T`<i data-dot="lit" title=${A("תאורה דולקת")}></i>`:C}</span>`:C}</span><span>${t.name}</span>
        </button>`})}
    </div>`}cornerKind(){return this.walkState==="on"?this.walk?"minimap":null:this.quality===3&&this.sunShown&&this.sunAt===null&&!this.kiosk?"pill":null}syncCorner(){const s=this.cornerKind();s!==this.cornerSent&&(this.cornerSent=s,s?this.setAttribute("data-corner",s):this.removeAttribute("data-corner"),this.dispatchEvent(new CustomEvent("hud-corner",{detail:{corner:s},bubbles:!0,composed:!0})))}renderTime(){const s=this.sunShown;if(!s||this.walkState==="on"||this.sunAt!==null)return C;const t=s.band==="day"?"☀":s.band==="night"?"☾":"◐",e=qt(Date.now(),this.site.zone),i=this.timeManual?.ymd??[e.year,e.month,e.day],n=`${i[0]}-${String(i[1]).padStart(2,"0")}-${String(i[2]).padStart(2,"0")}`;return T`<div class="timepill" role="group" aria-label=${A("שעה ביום")} data-3d-time data-band=${s.band}>
        <button type="button" class="tp" aria-expanded=${this.timeOpen?"true":"false"} data-3d-time-toggle @click=${()=>this.timeOpen=!this.timeOpen}><span aria-hidden="true">${t}</span> <span class="hh" data-3d-time-label>${sa(s.hour)}</span></button>
        ${this.timeManual?T`<button type="button" class="now" data-3d-time-now @click=${()=>this.timeNow()}>${A("עכשיו")}</button>`:C}
      </div>
      ${this.timeOpen?T`<div class="timepop" data-3d-time-pop>
            <input type="range" min="0" max="24" step="0.25" aria-label=${A("שעה ביום")} data-3d-time-slider .value=${String(s.hour)} @input=${o=>this.setTimeHour(Number(o.target.value))} />
            <div class="row"><input type="date" lang=${Yo()} aria-label=${A("תאריך")} data-3d-time-date .value=${n} @change=${o=>this.setTimeDate(o.target.value)} /><span>${ia[s.band]} · ${A("שמש")} ${s.elevation}°</span></div>
            ${this.site.known?C:T`<div class="muted" data-3d-site-default>${A("מיקום האתר לא הוגדר: מרכז הארץ")}</div>`}
          </div>`:C}`}render(){const s=typeof this.preset=="string"?this.preset:"camera",t=typeof this.preset=="string"?"":this.preset.camera.replace(/^cam:/,""),e=this.quality;return T`
      <div class="stage"></div>
      ${!this.ready&&!this.error?T`<div class="spinner" data-3d-spinner>${A("טוען תלת-ממד…")}</div>`:C}
      ${this.error?T`<div class="spinner err" data-3d-error>${this.error}</div>`:C}
      ${this.overlays.length?T`<div class="overlay">${this.overlays.map(i=>i.kind==="label"?T`<span class="room" aria-hidden="true" data-3d-room=${i.userData.id} data-3d-part=${i.id}>${i.text??""}</span>`:i.kind==="chip"?T`<span class="chip" aria-hidden="true" data-3d-chip=${i.userData.id} data-3d-chip-part=${i.id} data-3d-part=${i.id}>${i.text??""}</span>`:T`<button type="button" class="lbl" tabindex="-1" data-3d-label=${i.userData.id} data-3d-part=${i.id} aria-pressed=${this.selectedId===i.userData.id?"true":"false"} style=${`--lbl: ${nc(i.color)}`} @click=${()=>this.emitSelect({id:i.userData.id,kind:i.userData.kind,partId:i.id})}>${i.text??""}</button>`)}${this.hiddenPills?T`<span class="more" data-3d-more=${this.hiddenPills} title=${A("ישויות ללא מצב מיוחד מוסתרות במבט הכללי; בחירה ברשימה או במפלס מציגה אותן")}>${A("+{n} ישויות",{n:this.hiddenPills})}</span>`:C}</div>`:C}
      ${this.pillLayer.render()}
      ${this.renderStrip()}
      ${this.renderWalk()}
      <div class="bar" role="group" aria-label=${A("תצוגות מוכנות")} data-3d-bar>
        <sw-chip data-preset-top ?selected=${s==="top"} @click=${()=>this.pickPreset("top")}>${A("מלמעלה")}</sw-chip>
        <sw-chip data-preset-iso ?selected=${s==="iso"} @click=${()=>this.pickPreset("iso")}>${A("איזומטרי")}</sw-chip>
        <sw-chip data-preset-persp ?selected=${s==="persp"} @click=${()=>this.pickPreset("persp")}>${A("פרספקטיבה")}</sw-chip>
        ${this.cameras.length?T`<select data-preset-camera aria-label=${A("מבט מהמצלמה")} .value=${t} @change=${i=>this.onCameraChange(i)}>
              <option value="">${A("מבט מהמצלמה…")}</option>
              ${this.cameras.map(i=>T`<option value=${i.id} ?selected=${i.id===t}>${i.label}</option>`)}
            </select>`:C}
        <span class="sep" aria-hidden="true"></span>
        <sw-chip data-quality-auto title=${A("אוטומטי: מתחיל ברמת ברירת המחדל ויורד רמה כשהמכשיר איטי")} ?selected=${this.mode==="auto"} @click=${()=>this.setMode("auto")}>${A("אוטומטי")}</sw-chip>
        <sw-chip data-quality-1 title=${A("רמה סכמטית: חומרים שטוחים, בלי צללים")} ?selected=${this.mode!=="auto"&&e===1} @click=${()=>this.setQuality(1)}>${A("סכמטי")}</sw-chip>
        <sw-chip data-quality-2 title=${A("רמה מלאה: צללים רכים, חומרים, חיתוך קירות")} ?selected=${this.mode!=="auto"&&e===2} @click=${()=>this.setQuality(2)}>${A("מלא")}</sw-chip>
        <sw-chip data-quality-3-lite title=${A("ריאליסטי קל: חומרים אמיתיים, שמש ושמיים, בלי האפקטים הכבדים")} ?selected=${this.mode==="lite"} @click=${()=>this.setMode("lite")}>${A("ריאליסטי קל")}</sw-chip>
        <sw-chip data-quality-3 title=${A("ריאליסטי: חומרים אמיתיים, שמש לפי שעה, הצללה עדינה וזכוכית")} ?selected=${this.mode==="realistic"} @click=${()=>this.setMode("realistic")}>${A("ריאליסטי")}</sw-chip>
        ${e<3?T`<sw-chip data-night-toggle title=${A("מצב לילה: שמיים כהים, אור ירח, החדרים הדלוקים זוהרים")} ?selected=${this.night} aria-pressed=${this.night} @click=${()=>this.setNight(!this.night)}>${A("לילה")}</sw-chip>`:C}
        ${this.walkable?T`<sw-chip data-walk-btn title=${A("סיור בגובה עין: W A S D או החצים להליכה, Shift לריצה, גרירה להסתכלות, לחיצה על הרצפה להליכה לשם, Esc ליציאה")} ?selected=${this.walkState!=="off"} @click=${()=>this.requestWalk()}>${this.walkState==="requested"?A("טוען סיור…"):A("סיור")}</sw-chip>`:C}
        <!-- ST7-odd: a surface like the chips beside it - a ghost control over the rendered picture faded into whatever lay behind it -->
        <sw-button size="sm" icon="download" data-export-gltf ?disabled=${!this.ready||this.exporting} @click=${()=>this.download()}>${this.exporting?A("מייצא…"):A("ייצוא glTF")}</sw-button>
      </div>
      ${ic(this.ready&&!this.error,i=>this.view?.zoomBy(i))}
      ${this.description?.estimated?T`<div class="note" data-3d-estimated>${A("≈ מידות משוערות (התוכנית לא כוילה)")}</div>`:C}
      ${this.fallback?T`<div class="note fb" role="status" data-3d-fallback>${_c(this.rung)}</div>`:C}
      ${this.perfHint?T`<div class="pill hint" role="status" data-3d-low-fps=${this.perfHint}>${A("התצוגה איטית במכשיר הזה")}
            <sw-button size="sm" variant="ghost" data-3d-low-fps-switch @click=${()=>this.setMode(this.perfHint)}>${A("מעבר ל{rung}",{rung:os[this.perfHint]})}</sw-button>
            <button type="button" class="x" aria-label=${A("סגירה")} data-3d-low-fps-close @click=${()=>this.perfHint=null}>×</button></div>`:C}
      ${e===3?this.renderTime():C}
      ${e===3?T`<div class="vignette" aria-hidden="true"></div>`:C}
      ${this.toast?T`<div class="toast" role="status" data-3d-toast>${this.toast}</div>`:C}
      ${this.hover?T`<div class="tip" data-3d-tip data-3d-tip-kind=${this.hover.kind} style=${`left:${this.hover.x}px;top:${this.hover.y}px`}>${this.hover.label}</div>`:C}
      <div class="idle-still" data-idle-still ?data-on=${this.idle&&this.hasIdleStill} aria-hidden=${this.idle&&this.hasIdleStill?"false":"true"}><slot name="idle-still" @slotchange=${this.onIdleSlot}></slot></div>
    `}onCameraChange(s){const t=s.target.value;t&&this.pickPreset({camera:`cam:${t}`})}};D.styles=[Pe`
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
      inset-block-start: ${lt}px;
      inset-inline-end: var(--hud-end, ${lt}px);
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
      inset-block-start: ${La-4}px;
      inset-inline-end: var(--hud-end, ${lt}px);
      /* a menu: it opens over whatever stands under the pill (the host's circuit buttons, the level bar, the floor strip) and above all of it */
      z-index: calc(var(--sw-z-map-ui) + 1);
      display: grid;
      gap: 6px;
      box-sizing: border-box;
      inline-size: min(280px, calc(100% - 24px));
      max-inline-size: calc(100% - var(--hud-end, ${lt}px) - ${lt}px);
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
    /* the selected chip's soft field (classic skin rule 1, AUDIT30-B-SHARED) is a translucent accent in the dark schemes: over the canvas it
       is the same tint laid on the opaque menu surface (an opaque mix), so the scene never shows through it (evidence-menu-opaque) */
    :host-context(html[data-theme='dark']) .bar {
      --sw-accent-soft: color-mix(in srgb, var(--sw-accent) 20%, var(--sw-menu-surface));
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
      left: calc(50% + (var(--hud-end, ${lt}px) - ${lt}px) / 2); /* physical: centred whatever the direction - in the free band, past a docked list of the host */
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
      inset-block-start: ${lt}px;
      inset-inline-start: var(--hud-end, ${lt}px);
      inline-size: ${Qs}px;
      block-size: ${Qs}px;
      border-radius: 10px;
      box-shadow: var(--sw-shadow-1);
      cursor: pointer;
      z-index: var(--sw-z-map-ui);
      touch-action: none;
    }
    .pill {
      position: absolute;
      left: calc(50% + (var(--hud-end, ${lt}px) - ${lt}px) / 2); /* the free band's centre: past a docked list of the host */
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
    @media (max-width: ${Ta}px) {
      .minimap {
        inline-size: ${Js}px;
        block-size: ${Js}px;
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
  `,cc,sc];R([O({attribute:!1})],D.prototype,"description",2);R([O()],D.prototype,"selectedId",2);R([O({attribute:!1})],D.prototype,"preset",2);R([O()],D.prototype,"frameKey",2);R([O({attribute:!1})],D.prototype,"cameras",2);R([O({attribute:!1})],D.prototype,"labels",2);R([O()],D.prototype,"exportName",2);R([O({attribute:!1,hasChanged:(s,t)=>!Wo(s,t)})],D.prototype,"levels",2);R([O()],D.prototype,"activeLevel",2);R([O({attribute:!1})],D.prototype,"thumbnailScene",2);R([O({attribute:!1,hasChanged:(s,t)=>!Go(s,t)})],D.prototype,"levelDots",2);R([O({attribute:!1})],D.prototype,"qualityDefault",2);R([O({type:Number})],D.prototype,"minFps",2);R([O({type:Boolean,reflect:!0,attribute:"data-measure"})],D.prototype,"continuous",2);R([O({type:Boolean})],D.prototype,"walkable",2);R([O({type:Boolean})],D.prototype,"stillsAvailable",2);R([O({type:Number})],D.prototype,"idleS",2);R([O()],D.prototype,"changeKey",2);R([O({attribute:!1})],D.prototype,"qualityForce",2);R([O({type:Boolean,reflect:!0})],D.prototype,"kiosk",2);R([O({attribute:!1})],D.prototype,"themeForce",2);R([O({attribute:!1})],D.prototype,"backdrop",2);R([O({reflect:!0,attribute:"data-backdrop"})],D.prototype,"shownBackdrop",2);R([O({attribute:!1})],D.prototype,"sunAt",2);R([O({attribute:!1})],D.prototype,"roomPills",2);R([O({attribute:!1})],D.prototype,"pillPrefs",2);R([O({attribute:!1})],D.prototype,"levelTags",2);R([O({type:Boolean})],D.prototype,"pillsHidden",2);R([O({attribute:!1,hasChanged:(s,t)=>JSON.stringify(s??null)!==JSON.stringify(t??null)})],D.prototype,"focusRoom",2);R([O({type:Boolean,reflect:!0,attribute:"data-stack-dark"})],D.prototype,"stackDark",2);R([O({type:Boolean,reflect:!0,attribute:"data-stack-light"})],D.prototype,"stackLight",2);R([G()],D.prototype,"walkState",2);R([G()],D.prototype,"walkShown",2);R([G()],D.prototype,"walkAim",2);R([G()],D.prototype,"walkNote",2);R([G()],D.prototype,"crossFloor",2);R([G()],D.prototype,"idle",2);R([G()],D.prototype,"hasIdleStill",2);R([G()],D.prototype,"hover",2);R([G()],D.prototype,"ready",2);R([G()],D.prototype,"exporting",2);R([G()],D.prototype,"error",2);R([G()],D.prototype,"toast",2);R([G()],D.prototype,"chosen",2);R([G()],D.prototype,"gpu",2);R([G()],D.prototype,"installMode",2);R([G()],D.prototype,"fallbackRung",2);R([G()],D.prototype,"perfHint",2);R([G()],D.prototype,"walkDrop",2);R([G()],D.prototype,"dialsReady",2);R([G()],D.prototype,"timeManual",2);R([G()],D.prototype,"timeOpen",2);R([G()],D.prototype,"sunShown",2);R([G()],D.prototype,"night",2);R([Zo(".stage")],D.prototype,"stage",2);R([O({type:Number})],D.prototype,"routeDwellMs",2);D=R([mo("sw-plan-3d")],D);const sd=Object.freeze(Object.defineProperty({__proto__:null,DEFAULT_MIN_FPS:Uo,FALLBACK_KEY:Xt,NIGHT_KEY:ys,PILL_CAP:yo,PROBE_FALLBACK_MS:Co,PROBE_FIRST_FRAME_MS:Fo,PROBE_MS:Se,PROBE_WARM_FRAMES:Oo,QUALITY_KEY:Ma,SETTINGS_WAIT_MS:fs,SceneStillRenderer:bc,get SwPlan3d(){return D},WALK_ACT_M:xe,WALK_FOV:ke,WALK_GUARD_KEY:ye,encodePng:kc,sameDots:Go,sameLevels:Wo,twinStart:jo,withAlpha:ks},Symbol.toStringTag,{value:"Module"}));export{Ir as R,ed as S,td as a,Jc as b,sd as s};
