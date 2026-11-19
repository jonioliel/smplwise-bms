import{t as F}from"./map-CsCJvpdZ.js";import{a5 as d,bG as Lt,cC as Wt,bH as Rt,g as _t,ax as x,j,e3 as Ot,i as At,A as m,ez as B,b as Bt,k as Tt}from"./index-DkcUEx2W.js";import{a0 as Gt,aB as Nt,aC as Pt,aD as Ct,Q as ht,aE as dt,aF as Vt,aG as Q,aH as tt,aI as Xt,aJ as pt,aK as rt,aL as A,aM as Yt,aN as Zt,aO as mt,aP as Kt,aQ as K,aR as St,aS as Ut,aT as qt,aU as Jt,G as Qt,aV as te,t as ee,n as se,aW as ie,aX as ne,b as st,a4 as oe,m as ae,f as re,u as le,s as ce,p as he,aY as de,aZ as pe,a_ as ue,a$ as ge}from"./shared-space-DKTsb1Kv.js";import{c as fe,O as xt,i as it,d as $e}from"./candidates-CBvFWCSp.js";const ye=60,me=56,xe=2.5,lt=["error","offline","stale","unknown","forbidden","partial","historic","recorded","live","neutral"],wt=t=>{const e=lt.indexOf(t);return e<0?lt.length:e};function we(t){let e="neutral",s=lt.length;for(const i of t)wt(i)<s&&(s=wt(i),e=i);return e}function ve(t,e){const s=e.threshold??ye;if(t.length<=s||e.scale>=(e.maxScale??xe))return{singles:t,clusters:[]};const i=e.cellPx??me,o=new Set(e.keepIds??[]),n=[],a=new Map;for(const c of t){if(o.has(c.id)){n.push(c);continue}const l=Math.floor(c.x*e.planWidth*e.scale/i),h=Math.floor(c.y*e.planHeight*e.scale/i),p=`${l}:${h}`,u=a.get(p);u?u.push(c):a.set(p,[c])}const r=[];for(const c of a.values()){if(c.length===1){n.push(c[0]);continue}const l={};for(const p of c)l[p.state]=(l[p.state]??0)+1;const h=c.map(p=>p.id).sort();r.push({id:`cluster:${h[0]}+${h.length}`,x:c.reduce((p,u)=>p+u.x,0)/c.length,y:c.reduce((p,u)=>p+u.y,0)/c.length,members:c,state:we(c.map(p=>p.state)),byState:l})}return{singles:n,clusters:r}}function be(t){return{x0:Math.min(...t.members.map(e=>e.x)),y0:Math.min(...t.members.map(e=>e.y)),x1:Math.max(...t.members.map(e=>e.x)),y1:Math.max(...t.members.map(e=>e.y))}}const ke={box:d`<rect x="5" y="5" width="14" height="14" rx="1.5"/>`,cylinder:d`<circle cx="12" cy="12" r="7"/>`,chair:d`<rect x="7" y="10" width="10" height="7" rx="1.5"/><path d="M7 10V6h10v4M8 17v3M16 17v3"/>`,table:d`<rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M6 16v3M18 16v3"/>`,sofa:d`<path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6H4z"/><path d="M4 14h16M7 9V7h10v2"/>`,bed:d`<rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M4 13h16M6 9V6h5v3M6 18v2M18 18v2"/>`,cabinet:d`<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M12 4v16M9 11h1M14 11h1"/>`,lamp:d`<circle cx="12" cy="11" r="5"/><path d="M12 16v3M9 20h6M8 5l1 1M16 5l-1 1"/>`,panel:d`<rect x="6" y="4" width="12" height="16" rx="1"/><path d="M9 8h6M9 11h6M9 14h3"/>`,socket:d`<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M10 10v4M14 10v4"/>`,extinguisher:d`<rect x="9" y="8" width="6" height="12" rx="3"/><path d="M12 8V5M9 5h6M15 9l3-2"/>`,smoke:d`<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 5v2M12 17v2"/>`,exit:d`<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M9 12h7M13 9l3 3-3 3"/>`,aed:d`<path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.5 12 20 12 20z"/><path d="M12 9l-1.5 3h3L12 15"/>`,medical:d`<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M12 9v6M9 12h6"/>`,goal:d`<rect x="4" y="6" width="16" height="10"/><path d="M4 16v3M20 16v3M8 6v10M12 6v10M16 6v10"/>`,mat:d`<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v8M12 8v8M17 8v8"/>`,stairs:d`<path d="M4 20h4v-4h4v-4h4V8h4"/>`,elevator:d`<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>`,doorstation:d`<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 13h6M9 16h6"/>`,tree:d`<circle cx="12" cy="10" r="6"/><path d="M12 16v5M9 21h6"/>`,sanitary:d`<path d="M6 10h12v3a6 6 0 0 1-12 0z"/><path d="M12 10V5M9 5h6"/>`,office:d`<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/>`,parking:d`<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>`};function Me(t){return ke[Gt.includes(t)?t:"box"]}const Pe=150,vt=.5,Ce=1e-6,U=4,G=1e-9,D=(t,e)=>[t[0]-e[0],t[1]-e[1]],O=(t,e)=>t[0]*e[0]+t[1]*e[1],Ft=(t,e)=>t[0]*e[1]-t[1]*e[0],ut=t=>Math.hypot(t[0],t[1]),q=t=>{const e=ut(t);return e>G?[t[0]/e,t[1]/e]:[1,0]},T=(t,e)=>Math.atan2(Ft(t,e),O(t,e));function Se(t,e){const s=[];for(const i of t){if(!Number.isFinite(i[0])||!Number.isFinite(i[1]))continue;const o=s[s.length-1];o&&Math.hypot(i[0]-o[0],i[1]-o[1])<vt||s.push([i[0],i[1]])}if(e)for(;s.length>1&&Math.hypot(s[0][0]-s[s.length-1][0],s[0][1]-s[s.length-1][1])<vt;)s.pop();return s}function nt(t,e,s,i){const o=Ft(D(e,t),D(s,e)),n=t[0],a=t[1],r=e[0]-n,c=e[1]-a,l=s[0]-n,h=s[1]-a,p=2*(r*h-c*l),u=Math.max(O(D(e,t),D(e,t)),O(D(s,t),D(s,t)),1);if(Math.abs(p)<=1e-9*u)return q(D(s,t));const y=r*r+c*c,b=l*l+h*h,w=n+(h*y-c*b)/p,M=a+(r*b-l*y)/p,P=[i[0]-w,i[1]-M],k=o>0?1:-1;return q([-P[1]*k,P[0]*k])}function Fe(t,e,s){return T(D(e,t),D(s,e))}function Ee(t,e){const s=t.length,i=new Array(s),o=new Array(s),n=Pe*Math.PI/180,a=l=>t[(l%s+s)%s],r=new Array(s).fill(!1);for(let l=0;l<s;l++)!e&&(l===0||l===s-1)||s<3||(r[l]=Math.abs(Fe(a(l-1),a(l),a(l+1)))>n);const c=(l,h)=>{const p=a(l+h);if(!(e?s>=3&&!r[((l+h)%s+s)%s]:l+2*h>=0&&l+2*h<s&&!r[l+h]))return q(h===1?D(p,a(l)):D(a(l),p));const y=a(l+2*h);return h===1?nt(a(l),p,y,a(l)):nt(y,p,a(l),a(l))};for(let l=0;l<s;l++){const h=!e&&(l===0||l===s-1);if(s===2){const u=q(D(a(1),a(0)));i[l]=u,o[l]=u;continue}if(h){const u=l===0?c(0,1):c(s-1,-1);i[l]=u,o[l]=u;continue}if(r[l]){i[l]=c(l,-1),o[l]=c(l,1);continue}const p=nt(a(l-1),a(l),a(l+1),a(l));i[l]=p,o[l]=p}return{tin:i,tout:o}}function bt(t,e,s){const i=D(e,t);if(ut(i)<=G)return 0;const o=T(s,i),n=Math.tan(o/2);return Math.abs(n)<1e-9?0:Math.max(-U,Math.min(U,n))}function De(t,e,s){const i=D(e,t);if(ut(i)<=G)return 0;const o=T(i,s),n=Math.tan(o/2);return Math.abs(n)<1e-9?0:Math.max(-U,Math.min(U,n))}function Ie(t,e,s,i){const o=D(s,t),n=[e[0]+i[0],e[1]+i[1]],a=O(o,o);if(a<=G)return null;const r=O(o,n),c=2*(1-O(e,i));let l;if(Math.abs(c)<=1e-12){const u=O(o,i);if(Math.abs(u)<=1e-12)return[(t[0]+s[0])/2,(t[1]+s[1])/2];l=a/(4*u)}else{const u=r*r+c*a;l=(-r+Math.sqrt(Math.max(0,u)))/c}if(!Number.isFinite(l))return null;const h=[(t[0]+s[0]+l*(e[0]-i[0]))/2,(t[1]+s[1]+l*(e[1]-i[1]))/2],p=Math.sqrt(a);return Math.hypot(h[0]-t[0],h[1]-t[1])<1e-6*p||Math.hypot(h[0]-s[0],h[1]-s[1])<1e-6*p?null:h}function Et(t,e={}){const s=!!e.closed,i=Se(t,s),o=e.round??(y=>y);if(i.length<2)return{pts:i.map(y=>[y[0],y[1]]),bulges:[],through:i.map((y,b)=>b)};const n=s&&i.length>=2;if(n&&i.length===2)return{pts:[i[0],i[1],[i[0][0],i[0][1]]],bulges:[1,1],through:[0,1]};const a=i.length,{tin:r,tout:c}=Ee(i,n),l=[i[0]],h=[],p=[0],u=n?a:a-1;for(let y=0;y<u;y++){const b=i[y],w=(y+1)%a,M=i[w],P=c[y],k=r[w],S=D(M,b),R=Math.abs(T(P,S)-T(S,k))<=Ce?null:Ie(b,P,M,k);if(!R)h.push(bt(b,M,P));else{const L=o(R);h.push(bt(b,L,P)),l.push(L),h.push(De(L,M,k))}l.push(w===0?[i[0][0],i[0][1]]:M),w!==0&&p.push(l.length-1)}return{pts:l,bulges:h,through:p}}function ze(t){let e=Number.POSITIVE_INFINITY;for(let s=0;s<t.bulges.length;s++){const i=t.bulges[s];if(Math.abs(i)<=G)continue;const n=Math.hypot(t.pts[s+1][0]-t.pts[s][0],t.pts[s+1][1]-t.pts[s][1])*(1+i*i)/(4*Math.abs(i));n<e&&(e=n)}return e}const Z=t=>[rt(Math.min(1,Math.max(0,t[0]))),rt(Math.min(1,Math.max(0,t[1])))],H=(t,e,s)=>[t[0]*e,t[1]*s];function gt(t,e,s,i,o,n,a){const r=Pt(Ct({...e,polyline:s.map(Z)},i),a),{pts:c,bulges:l}=A(r,o,n),h=dt(c,l),p=t.openings.map(u=>{if(u.wall_id!==e.id||!(h>0))return u;const y=H(Yt(e,u.t,o,n),o,n),b=rt(Math.min(1,Math.max(0,Zt(c,l,y).s/h)));return b===u.t?u:{...u,t:b}});return{...t,walls:t.walls.map(u=>u.id===e.id?r:u),openings:p}}const _=(t,e)=>t.walls.find(s=>s.id===e);function Ue(t,e,s,i,o,n){const a=_(t,e);if(!a||s<0||s>=a.polyline.length-1)return t;const r=Xt(H(a.polyline[s],o,n),H(i,o,n),H(a.polyline[s+1],o,n));return ft(t,e,s,r,o,n)}function ft(t,e,s,i,o,n){const a=_(t,e);if(!a||s<0||s>=a.polyline.length-1||!Number.isFinite(i))return t;const r=pt(a),c=Math.abs(i)<1e-4?0:Math.max(-mt,Math.min(mt,Math.round(i*1e6)/1e6));return r[s]===c?t:(r[s]=c,gt(t,a,a.polyline,r,o,n))}const qe=(t,e,s,i,o)=>ft(t,e,s,0,i,o);function Je(t,e,s,i,o,n,a){const r=_(t,e);if(!r||s<0||s>=r.polyline.length-1||!(i>0)||!(o>0))return null;const c=pt(r)[s],l=Ut(H(r.polyline[s],n,a),H(r.polyline[s+1],n,a),i/o,c<0?-1:1,Math.abs(c)>1);return l===null?null:ft(t,e,s,l,n,a)}function Qe(t,e,s,i,o){if(e<0||e>=t.polyline.length-1)return null;const n=Kt(H(t.polyline[e],s,i),H(t.polyline[e+1],s,i),pt(t)[e]);return Number.isFinite(n)?n*o:null}function ts(t,e,s,i,o){const n=H(t.polyline[e],s,i),a=H(t.polyline[e+1],s,i);return Math.hypot(a[0]-n[0],a[1]-n[1])/2*o}function es(t,e,s,i,o,n,a){const r=_(t,e);if(!r||!(i>0)||!(o>0))return null;const{pts:c,bulges:l}=A(r,n,a),h=K(c,l,s,i/o);return h?gt(t,r,h.pts.map(p=>[p[0]/n,p[1]/a]),h.bulges,n,a):null}function ss(t,e,s,i,o){const{pts:n,bulges:a}=A(t,s,i);let r=0,c=1e6;if(!K(n,a,e,1e-6))return 0;for(let l=0;l<60;l++){const h=(r+c)/2;K(n,a,e,h)?r=h:c=h}return r*o}function He(t,e,s,i){const{pts:o,bulges:n}=A(t,s,i),a=o[e],r=o[e+1],{p:c}=St([a,r],[n[e]],dt([a,r],[n[e]])/2);return[c[0]/s,c[1]/i]}function is(t,e,s,i){const{pts:o,bulges:n}=A(t,s,i);return K(o,n,e,1e-6)!==null}const Dt=512,ns=255;function It(t,e,s,i){const o=a=>H(Z([a[0]/s,a[1]/i]),s,i),n=Et(t.map(a=>H(Z(a),s,i)),{closed:e,round:o});return{polyline:n.pts.map(a=>Z([a[0]/s,a[1]/i])),bulges:n.bulges.map(a=>Math.abs(a)<1e-6?0:Math.round(a*1e6)/1e6),through:n.through}}function zt(t){const e=Q(t);return e?e.map(s=>[t.polyline[s][0],t.polyline[s][1]]):null}function os(t,e,s,i,o,n){const a=It(e,s,o,n);if(a.through.length<2||a.polyline.length<2||a.polyline.length>Dt)return null;const r=Nt(t,a.polyline,i),c=r.doc.walls.map(l=>l.id===r.id?Pt(Ct(l,a.bulges),a.through):l);return{doc:ht({...r.doc,walls:c}),id:r.id}}function $t(t,e,s,i,o){const n=_(t,e);if(!n)return t;const a=It(s,tt(n.polyline),i,o);return a.through.length<2||a.polyline.length>Dt?t:ht(gt(t,n,a.polyline,a.bulges,i,o,a.through))}function as(t,e,s,i,o,n){const a=_(t,e),r=a?zt(a):null;return!a||!r||s<0||s>=r.length?t:$t(t,e,r.map((c,l)=>l===s?i:c),o,n)}function rs(t,e,s,i,o){const n=_(t,e),a=n?Q(n):null;if(!n||!a)return null;const{pts:r,bulges:c}=A(n,s,i),l=qt(r,c),p=tt(n.polyline)?[...a,r.length-1]:a;let u=0,y;{let k=-1;for(let S=0;S<p.length-1;S++){const z=l[p[S+1]]-l[p[S]];z>k&&(k=z,u=S)}y=(l[p[u]]+l[p[u+1]])/2}const b=l[p[u]],w=l[p[u+1]];if(!(y-b>1)||!(w-y>1))return null;const M=St(r,c,y,l).p,P=a.map(k=>[n.polyline[k][0],n.polyline[k][1]]);return P.splice(u+1,0,[M[0]/s,M[1]/i]),{doc:$t(t,e,P,s,i),k:u+1}}function ls(t,e,s,i,o){const n=_(t,e),a=n?zt(n):null;if(!n||!a||s<0||s>=a.length)return{doc:t,wallRemoved:!1};const r=a.filter((c,l)=>l!==s);return r.length<2?{doc:ht({...t,walls:t.walls.filter(c=>c.id!==e),openings:t.openings.filter(c=>c.wall_id!==e)}),wallRemoved:!0}:{doc:$t(t,e,r,i,o),wallRemoved:!1}}function cs(t,e){const s=Q(t);if(!s)return-1;const i=tt(t.polyline);return s.indexOf(i&&e===t.polyline.length-1?0:e)}function hs(t,e,s,i,o){const n=Et(t.map(a=>H(a,s,i)),{closed:e});return n.pts.length<2?{path:[],lengthM:0,minRadiusM:Number.POSITIVE_INFINITY}:{path:Vt(n.pts,n.bulges,.5).map(a=>[a[0]/s,a[1]/i]),lengthM:dt(n.pts,n.bulges)*o,minRadiusM:ze(n)*o}}function W(t,e){let s=!0;const i=()=>s?(s=!1,t.removeEventListener("pointermove",o),t.removeEventListener("pointerup",n),t.removeEventListener("pointercancel",a),!0):!1,o=r=>{s&&e.move(r)},n=r=>{i()&&e.commit(r)},a=r=>{i()&&e.cancel(r)};return t.addEventListener("pointermove",o),t.addEventListener("pointerup",n),t.addEventListener("pointercancel",a),()=>void i()}const yt={modeCurve:"כיפוף",hintCurve:"גרור את הנקודה שבאמצע קטע של הקיר הנבחר כדי לכופף אותו; לחיצה על פינה מאפשרת לעגל אותה. (C)",tipCurve:"כיפוף (C): כיפוף קטע של קיר קיים ועיגול פינות",bendOpen:"כיפוף ועיגול פינות",bendDone:"סיום כיפוף",modeCurved:"קיר מעוגל",hintCurved:'לחץ נקודות לאורך הקשת והקיר נבנה דרכן. לחיצה כפולה, Enter או "סיום" בונים; לחיצה על הנקודה הראשונה סוגרת חדר עגול; Backspace מבטל נקודה; Esc מבטל.',tipCurved:"קיר מעוגל (R): לוחצים נקודות על הקשת והקיר נבנה דרכן",draft:"קיר מעוגל",points:"נקודות",length:"אורך",minRadius:"רדיוס",straightLine:"ישר",finish:"סיום",undoPoint:"בטל נקודה",closeHint:"לחיצה על הנקודה הראשונה סוגרת",pointsWall:"קיר דרך נקודות",pointHandle:"נקודת קשת",addPoint:"הוסף נקודה",removePoint:"הסר נקודה",pointsNote:"גרירת נקודה מעצבת את הקשת מחדש; נקודה נבחרת נמחקת ב-Delete.",segment:"קטע",radius:"רדיוס (מ׳)",straight:"ישר",straighten:"יישור",corner:"פינה",roundCorner:"עיגול פינה",apply:"החל",radiusTooSmall:"הרדיוס קטן מחצי אורך הקטע",cornerCannot:"אי אפשר לעגל את הפינה ברדיוס הזה",segmentHandle:"אמצע קטע",area:"שטח פנימי"},Ht=Lt("en","i18n/plan-curves","en"),je={he:yt,en:Ht};function Le(){return Wt(["en"])}function kt(t,e=Le()){return je[e][t]??yt[t]}Rt("i18n/plan-curves",{he:yt,en:Ht});const N={a:1,b:0,c:0,d:1,e:0,f:0};function jt(t,e,s){return t===0?{x:0,y:0}:t===1?{x:e,y:0}:t===2?{x:e,y:s}:{x:0,y:s}}function ct(t,e,s){if(!t||t.length!==4||!(e>0)||!(s>0))return N;let i=0,o=0,n=0,a=0,r=0,c=0,l=0,h=0,p=0,u=0,y=0,b=0;for(let v=0;v<4;v++){const C=jt(v,e,s),E={x:t[v][0]*e,y:t[v][1]*s};if(!Number.isFinite(E.x)||!Number.isFinite(E.y))return N;i+=C.x*C.x,o+=C.x*C.y,n+=C.x,a+=C.y*C.y,r+=C.y,c+=1,l+=C.x*E.x,h+=C.y*E.x,p+=E.x,u+=C.x*E.y,y+=C.y*E.y,b+=E.y}const w=[[i,o,n],[o,a,r],[n,r,c]],M=Mt(w,[l,h,p]),P=Mt(w,[u,y,b]);if(!M||!P)return N;const[k,S,z]=M,[R,L,g]=P;return![k,R,S,L,z,g].every(Number.isFinite)||Math.abs(k*L-R*S)<1e-9?N:{a:k,b:R,c:S,d:L,e:z,f:g}}function Mt(t,e){const s=V(t);if(Math.abs(s)<1e-9)return null;const i=o=>t.map((n,a)=>n.map((r,c)=>c===o?e[a]:r));return[V(i(0))/s,V(i(1))/s,V(i(2))/s]}function V(t){return t[0][0]*(t[1][1]*t[2][2]-t[1][2]*t[2][1])-t[0][1]*(t[1][0]*t[2][2]-t[1][2]*t[2][0])+t[0][2]*(t[1][0]*t[2][1]-t[1][1]*t[2][0])}function We(t,e){return{x:t.a*e.x+t.c*e.y+t.e,y:t.b*e.x+t.d*e.y+t.f}}function Re(t){return`matrix(${[t.a,t.b,t.c,t.d,t.e,t.f].map(e=>+e.toFixed(5)).join(" ")})`}function ds(t,e,s){const i=ct(t,e,s),o=Math.hypot(e,s)||1;let n=0;for(let a=0;a<4;a++){const r=We(i,jt(a,e,s)),c={x:t[a][0]*e,y:t[a][1]*s};n=Math.max(n,Math.hypot(r.x-c.x,r.y-c.y)/o)}return n}function ps(t,e,s){const i=t.map(o=>[o[0],o[1]]);return i[e]=[J(s.x,-1,2),J(s.y,-1,2)],i}function us(t,e,s){return t.map(i=>[J(i[0]+e,-1,2),J(i[1]+s,-1,2)])}function J(t,e,s){return Math.min(s,Math.max(e,t))}function gs(t){if(!t||t.length!==4)return!0;const e=[[0,0],[1,0],[1,1],[0,1]];return t.every((s,i)=>Math.abs(s[0]-e[i][0])<1e-6&&Math.abs(s[1]-e[i][1])<1e-6)}var _e=Object.defineProperty,Oe=Object.getOwnPropertyDescriptor,$=(t,e,s,i)=>{for(var o=i>1?void 0:i?Oe(e,s):e,n=t.length-1,a;n>=0;n--)(a=t[n])&&(o=(i?a(e,s,o):a(o))||o);return i&&o&&_e(e,s,o),o};const ot=.2,Ae=24,Be=20,X=6,Y={live:"var(--sw-accent)",recorded:"var(--sw-accent)",historic:"var(--sw-accent)",offline:"var(--sw-offline)",stale:"var(--sw-stale)",unknown:"var(--sw-unknown)",forbidden:"var(--sw-forbidden)",error:"var(--sw-danger)",neutral:"var(--sw-surface)",partial:"var(--sw-stale)"},Te={camera:d`<path d="M-7 -4.5A1.5 1.5 0 0 1 -5.5 -6H-2l1.5-2h5L6 -6h1.5A1.5 1.5 0 0 1 9 -4.5v9A1.5 1.5 0 0 1 7.5 6h-13A1.5 1.5 0 0 1 -7 4.5z" transform="translate(-1 0) scale(0.9)"/><circle cx="-1" cy="0" r="3"/>`,lock:d`<rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/>`,light:d`<path d="M-3 6h6M-2 8.5h4"/><path d="M0 -8a5 5 0 0 0-3 9c.7.5 1.2 1.3 1.2 2.2h3.6c0-.9.5-1.7 1.2-2.2A5 5 0 0 0 0 -8z"/>`,binary_sensor:d`<circle cx="0" cy="0" r="2"/><path d="M-4.5 -4.5a6.4 6.4 0 0 0 0 9M4.5 -4.5a6.4 6.4 0 0 1 0 9"/>`};function Ge(t){let e=0,s=0,i=0;for(let o=0;o<t.length;o++){const n=t[o],a=t[(o+1)%t.length],r=n.x*a.y-a.x*n.y;e+=r,s+=(n.x+a.x)*r,i+=(n.y+a.y)*r}if(Math.abs(e)<1e-12){const o=t.length||1;return{x:t.reduce((n,a)=>n+a.x,0)/o,y:t.reduce((n,a)=>n+a.y,0)/o}}return{x:s/(3*e),y:i/(3*e)}}const I=t=>t.map(e=>`${e[0]},${e[1]}`).join(" "),at=t=>t.shiftKey===!0,Ne=(t,e)=>{if(t===e)return!0;const s=Object.keys(t);return s.length!==Object.keys(e).length?!1:s.every(i=>{const o=t[i],n=e[i];return!!n&&o.x===n.x&&o.y===n.y&&o.rotation===n.rotation})},Ve=8;let f=class extends At{constructor(){super(...arguments),this.planWidth=1e3,this.planHeight=700,this.plan=null,this.markers=[],this.clusterThreshold=60,this.selectedId=null,this.selectedIds=[],this.dimEntities=!1,this.alwaysLabel=!1,this.imageUrl=null,this.editable=!1,this.placing=!1,this.coneRadius=140,this.zones=[],this.selectedZoneId=null,this.selectedZoneVertex=null,this.zoneLabels=!0,this.roomStates=null,this.draftPoints=[],this.boxSelect=!1,this.geometry=null,this.structureLevel=null,this.issueIds=[],this.selectedGeomId=null,this.highlightIds=[],this.multiDrag=!1,this.marquee=!1,this.panMode=!1,this.catalog=null,this.anchorPositions={},this.circuitStates={},this.entityStates={},this.hideStructure=!1,this.hideObjects=!1,this.hideConnectors=!1,this.hideImage=!1,this.floorImage=null,this.hideFloorImage=!1,this.clipCoverage=!0,this.coverage=new Jt,this.covPoints=new Map,this.primCache=null,this.stairCache=null,this.circuitCache=null,this.geomDrag="none",this.selectedVertex=null,this.curveHandles=!1,this.selectedSegment=null,this.arcPreview=[],this.curveDraft=[],this.curvePointHandles=!1,this.cornerSnapPx=0,this.wallDraft=[],this.hoverPoint=null,this.rulers=[],this.gridStep=0,this.guides=[],this.candidates=null,this.candidateStates={},this.selectedCandidateId=null,this.candidateEditable=!1,this.ghost=null,this.ghostNote="",this.ghostWarn=!1,this.ghostHandles=[],this.candHover=null,this.candDrag=null,this.candCache=null,this.geomDragAt=null,this.geomPress=!1,this.coarse=typeof window<"u"&&!!window.matchMedia?.("(any-pointer: coarse)").matches,this.hoverFrame=0,this.hoverEvent=null,this.box=null,this.boxStart=null,this.boxGeom=null,this.spacePan=!1,this.onSpaceKey=t=>{if(t.code!=="Space"&&t.key!==" ")return;if(t.type==="keyup"){this.spacePan&&(this.spacePan=!1,t.preventDefault());return}if(!this.marquee||t.ctrlKey||t.metaKey||t.altKey)return;const e=t.composedPath(),s=e[0],i=s instanceof Element&&!!s.closest('button, input, select, textarea, a[href], [contenteditable="true"], [contenteditable=""], [role="button"], [role="slider"]');(e.includes(this)&&!i||s===document.body||s===document.documentElement||s===window||s===document)&&(t.preventDefault(),this.spacePan=!0)},this.onSpaceBlur=()=>this.spacePan=!1,this.hlCache=null,this.scale=1,this.tx=0,this.ty=0,this.hoverId=null,this.dragging=null,this.orienting=null,this.shaping=null,this.zoneDraft=null,this.zonePending=null,this.lastVertexPress=null,this.pointers=new Map,this.lastPan=null,this.lastPinchDist=0,this.dragMoved=!1,this.fitted=!1,this.minScale=ot,this.onWheel=t=>{t.preventDefault();const e=this.getBoundingClientRect();this.zoomBy(t.deltaY<0?1.15:1/1.15,t.clientX-e.left,t.clientY-e.top)},this.onMarkerPointerDown=(t,e)=>{if(!this.editable||e.button!==0||this.placing||this.panActive)return;e.stopPropagation(),e.preventDefault(),this.dragging={id:t.id,x:t.x,y:t.y},this.viewport.setPointerCapture(e.pointerId);const s=n=>{const a=this.getBoundingClientRect(),r=this.toPlan(n.clientX-a.left,n.clientY-a.top);this.dragging={id:t.id,x:r.x,y:r.y}},i=n=>{const a=this.getBoundingClientRect(),r=this.toPlan(n.clientX-a.left,n.clientY-a.top),c=Math.abs(r.x-t.x)>5e-4||Math.abs(r.y-t.y)>5e-4;this.dragging=null,c?this.dispatchEvent(new CustomEvent("marker-move",{detail:{id:t.id,x:r.x,y:r.y},bubbles:!0,composed:!0})):this.select(t,n),this.swallowClick()},o=()=>{this.dragging=null,this.swallowClick()};W(this.viewport,{move:s,commit:i,cancel:o})},this.onPointerDown=t=>{if(this.pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this.dragMoved=!1,t.button===1&&t.preventDefault(),this.pointers.size===1){const e=this.boxSelect&&t.button===0&&!t.shiftKey&&!this.editable&&!this.placing,s=this.marquee&&!this.panActive&&t.button===0&&t.pointerType!=="touch"&&!this.placing;if(e||s){const i=this.getBoundingClientRect();this.boxStart={x:t.clientX-i.left,y:t.clientY-i.top},this.boxGeom=s?{add:t.shiftKey}:null,this.lastPan=null;return}this.lastPan={x:t.clientX,y:t.clientY},this.viewport.classList.add("dragging")}else this.pointers.size===2&&(this.lastPinchDist=this.pinchDistance(),this.lastPan=null,this.boxStart=null,this.boxGeom=null,this.box=null)},this.onPointerMove=t=>{if(this.placing&&!this.geomPress&&t.pointerType!=="touch"&&this.queueHover(t),!!this.pointers.has(t.pointerId)){if(this.pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this.pointers.size===2){const e=this.pinchDistance();if(this.lastPinchDist>0){const[s,i]=[...this.pointers.values()],o=this.getBoundingClientRect();this.zoomBy(e/this.lastPinchDist,(s.x+i.x)/2-o.left,(s.y+i.y)/2-o.top)}this.lastPinchDist=e,this.dragMoved=!0;return}if(this.boxStart){const e=this.getBoundingClientRect(),s=t.clientX-e.left,i=t.clientY-e.top;!this.dragMoved&&Math.abs(s-this.boxStart.x)+Math.abs(i-this.boxStart.y)>3&&(this.dragMoved=!0,this.viewport.hasPointerCapture(t.pointerId)||this.viewport.setPointerCapture(t.pointerId)),this.dragMoved&&(this.box={x0:Math.min(this.boxStart.x,s),y0:Math.min(this.boxStart.y,i),x1:Math.max(this.boxStart.x,s),y1:Math.max(this.boxStart.y,i)});return}if(this.lastPan){const e=t.clientX-this.lastPan.x,s=t.clientY-this.lastPan.y;!this.dragMoved&&Math.abs(e)+Math.abs(s)>2&&(this.dragMoved=!0,this.viewport.hasPointerCapture(t.pointerId)||this.viewport.setPointerCapture(t.pointerId)),this.tx+=e,this.ty+=s,this.lastPan={x:t.clientX,y:t.clientY}}}},this.onPointerUp=t=>{if(this.pointers.delete(t.pointerId),this.boxStart&&this.pointers.size===0){const e=this.box,s=this.boxGeom;if(this.boxStart=null,this.boxGeom=null,this.box=null,e&&s&&e.x1-e.x0>=4&&e.y1-e.y0>=4){const i=this.toPlan(e.x0,e.y0),o=this.toPlan(e.x1,e.y1);this.dispatchEvent(new CustomEvent("geom-box",{detail:{x0:i.x,y0:i.y,x1:o.x,y1:o.y,add:s.add},bubbles:!0,composed:!0}))}else if(e&&e.x1-e.x0>=4&&e.y1-e.y0>=4){const i=this.markers.filter(o=>{const n=this.toScreen(o.x,o.y);return n.x>=e.x0&&n.x<=e.x1&&n.y>=e.y0&&n.y<=e.y1}).map(o=>o.id);this.dispatchEvent(new CustomEvent("box-select",{detail:{ids:i},bubbles:!0,composed:!0}))}}if(this.pointers.size===0)this.lastPan=null,this.viewport.classList.remove("dragging");else if(this.pointers.size===1){const[e]=[...this.pointers.values()];this.lastPan={x:e.x,y:e.y}}},this.onBackgroundClick=t=>{if(!(this.dragMoved||this.panActive)){if(this.placing){const e=this.getBoundingClientRect(),s=this.toPlan(t.clientX-e.left,t.clientY-e.top);this.dispatchEvent(new CustomEvent("plan-click",{detail:{x:+s.x.toFixed(4),y:+s.y.toFixed(4),shift:t.shiftKey},bubbles:!0,composed:!0}));return}this.dispatchEvent(new CustomEvent("marker-select",{detail:{id:null},bubbles:!0,composed:!0}))}},this.onHandlePointerDown=(t,e,s)=>{if(!this.editable||s.button!==0||this.panActive)return;s.stopPropagation(),s.preventDefault();const i=this.getBoundingClientRect(),o=t.rotation??0,n=t.fov??90,a=e==="left"?o+n/2:o-n/2;this.orienting={id:t.id,rotation:o,fov:n},this.viewport.setPointerCapture(s.pointerId);const r=p=>{const u=this.bearingTo(t,p.clientX-i.left,p.clientY-i.top);if(e==="dir")return{rotation:Math.round(u),fov:n};let y=e==="left"?a-u:u-a;y=(y%360+360)%360;const b=Math.max(10,Math.min(180,Math.round(y))),w=e==="left"?a-b/2:a+b/2;return{rotation:Math.round((w%360+360)%360),fov:b}},c=p=>{this.orienting={id:t.id,...r(p)}},l=p=>{const u=r(p);this.orienting=null,this.swallowClick(),(u.rotation!==o||u.fov!==n)&&this.dispatchEvent(new CustomEvent("marker-orient",{detail:{id:t.id,...u},bubbles:!0,composed:!0}))},h=()=>{this.orienting=null,this.swallowClick()};W(this.viewport,{move:c,commit:l,cancel:h})},this.onRangePointerDown=(t,e)=>{if(!this.editable||e.button!==0||this.panActive)return;e.stopPropagation(),e.preventDefault();const s=this.getBoundingClientRect(),i=t.radius??this.coneRadius/this.planWidth;this.shaping={id:t.id,radius:i},this.viewport.setPointerCapture(e.pointerId);const o=c=>{const l=this.toScreen(t.x,t.y),h=Math.hypot(c.clientX-s.left-l.x,c.clientY-s.top-l.y)/this.scale;return+Math.max(.02,Math.min(1,h/this.planWidth)).toFixed(4)},n=c=>this.shaping={id:t.id,radius:o(c)},a=c=>{const l=o(c);this.shaping=null,this.swallowClick(),l!==i&&this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:t.id,radius:l},bubbles:!0,composed:!0}))},r=()=>{this.shaping=null,this.swallowClick()};W(this.viewport,{move:n,commit:a,cancel:r})},this.onCoverageVertexDown=(t,e,s)=>{if(!this.editable||s.button!==0||!t.polygon)return;s.stopPropagation(),s.preventDefault();const i=Date.now();if(this.lastVertexPress&&this.lastVertexPress.id===t.id&&this.lastVertexPress.index===e&&i-this.lastVertexPress.at<450){this.lastVertexPress=null,this.editPolygon(t,{remove:e});return}this.lastVertexPress={id:t.id,index:e,at:i};const o=this.getBoundingClientRect(),n=t.polygon.map(p=>({...p}));this.shaping={id:t.id,polygon:n},this.viewport.setPointerCapture(s.pointerId);let a=!1;const r=p=>{const u=this.toPlan(p.clientX-o.left,p.clientY-o.top),y=n.map(b=>({...b}));return y[e]={x:+Math.max(0,Math.min(1,u.x)).toFixed(4),y:+Math.max(0,Math.min(1,u.y)).toFixed(4)},y},c=p=>{a=!0,this.shaping={id:t.id,polygon:r(p)}},l=p=>{const u=r(p);this.shaping=null,this.swallowClick(),a&&this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:t.id,polygon:u},bubbles:!0,composed:!0}))},h=()=>{this.shaping=null,this.swallowClick()};W(this.viewport,{move:c,commit:l,cancel:h})},this.itemClick=t=>{this.nearCorner(t.clientX,t.clientY)||t.stopPropagation()},this.gridCache=null,this.floorImageSeq=Math.floor(Math.random()*1e9)}get panActive(){return this.spacePan||this.panMode}get highlightSet(){return this.hlCache?.ids!==this.highlightIds&&(this.hlCache={ids:this.highlightIds,set:new Set(this.highlightIds)}),this.hlCache.set}zoomDockRect(){const t=this.renderRoot.querySelector(".zoomdock")?.getBoundingClientRect();return t&&t.width>0&&t.height>0?t:null}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.fitted||this.fit()}),this.resizeObserver.observe(this),window.addEventListener("keydown",this.onSpaceKey),window.addEventListener("keyup",this.onSpaceKey),window.addEventListener("blur",this.onSpaceBlur)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onSpaceKey),window.removeEventListener("keyup",this.onSpaceKey),window.removeEventListener("blur",this.onSpaceBlur),this.spacePan=!1,this.resizeObserver?.disconnect(),cancelAnimationFrame(this.hoverFrame),this.hoverFrame=0,this.clearZonePending()}willUpdate(t){const e=this.zonePending;if(e&&t.has("zones")){const s=this.zones.find(i=>i.id===e.id);(!s||s.polygon!==e.before&&JSON.stringify(s.polygon)!==JSON.stringify(e.before))&&this.clearZonePending()}}emitZoneEdit(t,e){this.zonePending&&window.clearTimeout(this.zonePending.timer),this.zoneDraft={id:t.id,polygon:e},this.zonePending={id:t.id,before:t.polygon,timer:window.setTimeout(()=>this.clearZonePending(),5e3)},this.dispatchEvent(new CustomEvent("zone-edit",{detail:{id:t.id,polygon:e},bubbles:!0,composed:!0}))}clearZonePending(){const t=this.zonePending;t&&(window.clearTimeout(t.timer),this.zoneDraft?.id===t.id&&(this.zoneDraft=null),this.zonePending=null)}updated(t){(t.has("planWidth")||t.has("planHeight"))&&(this.fitted=!1,this.fit()),(t.has("scale")||t.has("tx")||t.has("ty"))&&this.dispatchEvent(new CustomEvent("view-change",{bubbles:!0,composed:!0}))}get zoom(){return this.scale}getView(){return this.fitted?{scale:this.scale,tx:this.tx,ty:this.ty}:null}setView(t){!Number.isFinite(t.scale)||!Number.isFinite(t.tx)||!Number.isFinite(t.ty)||(this.scale=Math.max(this.minScale,Math.min(X,t.scale)),this.tx=t.tx,this.ty=t.ty,this.fitted=!0)}focusMarker(t){const e=this.renderRoot.querySelector(`g.marker[data-id="${CSS.escape(t)}"]`);return e?.focus(),!!e}toScreen(t,e){return{x:this.tx+t*this.planWidth*this.scale,y:this.ty+e*this.planHeight*this.scale}}fit(){const t=this.clientWidth,e=this.clientHeight;if(!t||!e||!this.planWidth||!this.planHeight)return;const s=24,i=Math.min((t-s*2)/this.planWidth,(e-s*2)/this.planHeight);this.minScale=Math.min(ot,i),this.scale=Math.max(this.minScale,Math.min(X,i)),this.tx=(t-this.planWidth*this.scale)/2,this.ty=(e-this.planHeight*this.scale)/2,this.fitted=!0}centerOn(t,e){const s=this.clientWidth,i=this.clientHeight;!s||!i||(this.tx=s/2-t*this.planWidth*this.scale,this.ty=i/2-e*this.planHeight*this.scale,this.fitted=!0)}zoomToBox(t,e,s,i,o=48,n=0){const a=this.clientWidth,r=this.clientHeight;if(!a||!r||!this.planWidth||!this.planHeight)return;const c=Math.max(1e-6,s-t)*this.planWidth,l=Math.max(1e-6,i-e)*this.planHeight,h=Math.min((a-48)/this.planWidth,(r-48)/this.planHeight),p=n>0?Math.min(2.5,Math.max(h*n,h)):2.5,u=Math.max(ot,Math.min(X,Math.min((a-o*2)/c,(r-o*2)/l,p)));this.scale=u,this.tx=a/2-(t+s)/2*this.planWidth*u,this.ty=r/2-(e+i)/2*this.planHeight*u,this.fitted=!0}zoomBy(t,e,s){const i=this.clientWidth,o=this.clientHeight,n=e??i/2,a=s??o/2,r=Math.max(this.minScale,Math.min(X,this.scale*t)),c=r/this.scale;this.tx=n-(n-this.tx)*c,this.ty=a-(a-this.ty)*c,this.scale=r,this.fitted=!0}toPlan(t,e){return{x:Math.min(1,Math.max(0,(t-this.tx)/this.scale/this.planWidth)),y:Math.min(1,Math.max(0,(e-this.ty)/this.scale/this.planHeight))}}pinchDistance(){const[t,e]=[...this.pointers.values()];return Math.hypot(t.x-e.x,t.y-e.y)}swallowClick(){this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0)}select(t,e){if(this.dragMoved)return;e.stopPropagation();const s=this.toScreen(t.x,t.y),i={id:t.id,sx:s.x,sy:s.y};this.dispatchEvent(new CustomEvent("marker-select",{detail:i,bubbles:!0,composed:!0}))}selectZone(t,e){this.dragMoved||this.placing||this.panActive||(e.stopPropagation(),this.dispatchEvent(new CustomEvent("zone-select",{detail:{id:t.id,add:at(e)},bubbles:!0,composed:!0})))}onVertexPointerDown(t,e,s,i=!1){if(!this.editable||s.button!==0||this.panActive||(s.stopPropagation(),s.preventDefault(),this.zonePending?.id===t.id))return;if(!i){const h=this.lastVertexPress,p=performance.now();if(h&&h.id===t.id&&h.index===e&&p-h.at<450){this.lastVertexPress=null,this.removeVertex(t,e,s);return}this.lastVertexPress={id:t.id,index:e,at:p}}const o=this.getBoundingClientRect();let n=t.polygon.map(h=>({x:h.x,y:h.y})),a=e;if(i){const h=n[e],p=n[(e+1)%n.length];n.splice(e+1,0,{x:+((h.x+p.x)/2).toFixed(4),y:+((h.y+p.y)/2).toFixed(4)}),a=e+1}this.zoneDraft={id:t.id,polygon:n},this.viewport.setPointerCapture(s.pointerId);const r=h=>{const p=this.toPlan(h.clientX-o.left,h.clientY-o.top);n=n.map((u,y)=>y===a?{x:+p.x.toFixed(4),y:+p.y.toFixed(4)}:u),this.zoneDraft={id:t.id,polygon:n}},c=()=>{const h=i||n.some((p,u)=>p.x!==t.polygon[u].x||p.y!==t.polygon[u].y);this.zoneDraft=null,this.swallowClick(),h?this.emitZoneEdit(t,n):i||this.dispatchEvent(new CustomEvent("zone-vertex-select",{detail:{id:t.id,index:e},bubbles:!0,composed:!0}))},l=()=>{this.zoneDraft=null,this.swallowClick()};W(this.viewport,{move:r,commit:c,cancel:l})}onZoneBodyPointerDown(t,e){if(this.panActive)return;if(this.multiDrag&&this.editable&&!t.candidate&&!this.placing&&this.pointers.size===0&&this.highlightSet.has(t.id)){this.onGeomDragStart("zone",t.id,0,e);return}if(!this.editable||e.button!==0||this.placing||t.candidate||this.selectedZoneId!==t.id||this.pointers.size>0||(e.stopPropagation(),e.preventDefault(),this.zonePending?.id===t.id))return;this.releaseFieldFocus();const s=this.getBoundingClientRect(),i=this.toPlan(e.clientX-s.left,e.clientY-s.top);let o=t.polygon,n=!1;this.viewport.setPointerCapture(e.pointerId);const a=p=>{const u=this.toPlan(p.clientX-s.left,p.clientY-s.top);!n&&Math.hypot((u.x-i.x)*this.planWidth,(u.y-i.y)*this.planHeight)*this.scale<3||(n=!0,o=ge(t.polygon,u.x-i.x,u.y-i.y),this.zoneDraft={id:t.id,polygon:o})},r=()=>{this.zoneDraft=null,this.swallowClick()},c=e.shiftKey,l=()=>{r(),n&&o.some((p,u)=>p.x!==t.polygon[u].x||p.y!==t.polygon[u].y)?this.emitZoneEdit(t,o):!n&&c&&this.dispatchEvent(new CustomEvent("zone-select",{detail:{id:t.id,add:!0},bubbles:!0,composed:!0}))},h=()=>r();W(this.viewport,{move:a,commit:l,cancel:h})}removeVertex(t,e,s){s.stopPropagation(),!(!this.editable||t.polygon.length<=3)&&this.emitZoneEdit(t,t.polygon.filter((i,o)=>o!==e))}renderZoneHandles(t,e){const s=1/this.scale,i=this.planWidth,o=this.planHeight;return d`<g class="zone-handles">
      ${e.map((n,a)=>{const r=e[(a+1)%e.length];return d`<circle class="vmid" cx=${((n.x+r.x)/2*i).toFixed(1)} cy=${((n.y+r.y)/2*o).toFixed(1)} r=${(4*s).toFixed(2)} stroke-width=${(1.2*s).toFixed(2)} role="button" aria-label=${F("הוסף פינה")}
          @pointerdown=${c=>this.onVertexPointerDown(t,a,c,!0)} @click=${c=>c.stopPropagation()} />`})}
      ${e.map((n,a)=>d`<circle class="vtx ${a===this.selectedZoneVertex?"on":""}" data-vertex=${a} cx=${(n.x*i).toFixed(1)} cy=${(n.y*o).toFixed(1)} r=${(6*s).toFixed(2)} stroke-width=${(1.6*s).toFixed(2)} role="slider" aria-label=${F("פינה {n}",{n:a+1})}
          @pointerdown=${r=>this.onVertexPointerDown(t,a,r)} @click=${r=>r.stopPropagation()} />`)}
    </g>`}renderZone(t){if(t.polygon.length<3)return m;const e=1/this.scale,s=this.zoneDraft?.id===t.id?this.zoneDraft.polygon:t.polygon,i=s.map(w=>`${(w.x*this.planWidth).toFixed(1)},${(w.y*this.planHeight).toFixed(1)}`).join(" "),o=Ge(s),n=this.selectedZoneId===t.id,a=!n&&this.highlightSet.has(t.id),r=n||a,c=Math.max(36,t.name.length*7+18),l=s.map(w=>w.x),h=s.map(w=>w.y),p=(Math.max(...l)-Math.min(...l))*this.planWidth*this.scale,u=(Math.max(...h)-Math.min(...h))*this.planHeight*this.scale,y=r||t.candidate||p>=c+12&&u>=30,b=this.editable&&(n||a&&this.multiDrag)&&!t.candidate&&!this.placing;return d`
      <g class="zone ${r?"selected":""} ${t.candidate?"candidate":""} ${b?"movable":""}" style="--zc:${t.color}" role="button" tabindex="0" aria-label=${t.name} aria-pressed=${r}
         data-zone=${t.id}
         @click=${w=>this.selectZone(t,w)} @keydown=${w=>(w.key==="Enter"||w.key===" ")&&this.selectZone(t,w)}>
        <polygon data-zone-body points=${i} stroke-width=${((r?2.2:1.4)*e).toFixed(2)} @pointerdown=${w=>this.onZoneBodyPointerDown(t,w)} />
        ${this.renderZoneState(t,i,s,o)}
        ${t.chipTone==="occupied"?d`<polygon class="ptint" data-building-tint="occupied" data-zone-id=${t.id} points=${i} />`:m}
        ${this.zoneLabels&&t.name&&y?d`<g transform="translate(${this.zoneLabelPoint(t,s,o).x.toFixed(1)} ${this.zoneLabelPoint(t,s,o).y.toFixed(1)}) scale(${e})">
              <rect class="zl-bg" x=${-c/2} y="-10" width=${c} height="20" rx="10" />
              <text class="zl" y="3.5">${t.name}</text>
            </g>`:m}
        ${t.chip&&(y||!t.name)?this.renderZoneChip(t,t.chip,s,o):m}
        ${this.editable&&n&&!t.candidate?this.renderZoneHandles(t,s):m}
      </g>`}renderSharedOutlines(){const t=(this.geometry?.shared_spaces??[]).filter(i=>(i.other_polygon?.length??0)>=3);if(!t.length)return m;const e=1/this.scale,s=this.geometry?Qt(this.geometry):[];return d`<g class="shared-outlines" aria-hidden="true">${s.map(i=>{const o=F("כניסה לטריבונה"),n=o.length*6.2+12;return d`<g class="tribune-entry" data-tribune-entry=${i.objectId} data-tribune-door=${i.openingId} transform="translate(${(i.point[0]*this.planWidth).toFixed(1)} ${(i.point[1]*this.planHeight).toFixed(1)}) scale(${e})">
        <circle r="6" /><path d="M -3 -1.5 L 0 1.8 L 3 -1.5" /><g transform="translate(0 -16)"><rect x=${-n/2} y="-8" width=${n} height="16" rx="8" /><text y="3.5">${o}</text></g>
      </g>`})}${t.map(i=>{const o=i.other_polygon.map(l=>`${(l.x*this.planWidth).toFixed(1)},${(l.y*this.planHeight).toFixed(1)}`).join(" "),n=te(i),a=i.other_polygon.reduce((l,h)=>h.y<l.y?h:l,i.other_polygon[0]),r=i.other_label??"",c=Math.max(40,r.length*6.2+12);return d`<g class="shared-other ${n?"upper":"lower"}" data-shared-outline=${i.zone_id} data-shared-level=${n?"upper":"lower"}>
        <polygon points=${o} stroke-width=${((n?1.6:1.1)*e).toFixed(2)} stroke-dasharray=${`${(6*e).toFixed(2)} ${(4*e).toFixed(2)}`} />
        <g transform="translate(${(a.x*this.planWidth).toFixed(1)} ${(a.y*this.planHeight-10*e).toFixed(1)}) scale(${e})"><rect x=${-c/2} y="-8" width=${c} height="16" rx="8" /><text y="3.5">${r}</text></g>
      </g>`})}</g>`}renderZoneChip(t,e,s,i){const o=1/this.scale,n=this.zoneLabelPoint(t,s,i),a=t.chipTone==="occupied"?14:0,r=Math.max(40,e.length*6.2+14+a),c=(t.name&&this.zoneLabels?20:0)+(this.roomStates?.rooms[t.id]?.temperature!=null?22:0);return d`<g class="zchip" data-zone-chip=${t.id} data-tone=${t.chipTone??m} transform="translate(${n.x.toFixed(1)} ${(n.y+c*o).toFixed(1)}) scale(${o})">
      <rect x=${-r/2} y="-8" width=${r} height="16" rx="8" /><text y="3.5" x=${a?-a/2+1:0}>${e}</text>
      ${a?d`<g class="pi" transform=${`translate(${r/2-9} 0)`}><circle cx="-2" cy="-2" r="1.8" /><path d="M-5.2 3.2 q3.2 -4 6.4 0" /><circle cx="2.6" cy="-1.4" r="1.3" /></g>`:m}
    </g>`}renderZoneState(t,e,s,i){const o=this.roomStates?.rooms[t.id];if(!o)return m;const n=1/this.scale,a=o.temperature!==null?ee(o.temperature):null,r=this.zoneLabelPoint(t,s,i),c=a?Math.max(30,a.length*7+14):0,l=o.presenceFade.toFixed(3);return d`
      ${o.lit?d`<polygon class="tint" data-room-tint="lit" data-zone-id=${t.id} points=${e} />`:m}
      ${o.presenceFade>0&&!o.lit?d`<polygon class="tint" data-room-tint="presence" data-zone-id=${t.id} data-fade=${l} points=${e} style=${`--fade:${l}`} />`:m}
      ${o.presenceFade>0?d`<clipPath id=${`zc-${t.id}`}><polygon points=${e} /></clipPath><polygon class="tint" data-room-tint="presence-edge" data-zone-id=${t.id} data-fade=${l} points=${e} clip-path=${`url(#zc-${t.id})`} stroke-width=${(7*n).toFixed(2)} style=${`--fade:${l}`} />`:m}
      ${a?d`<g class="tchip" data-room-temp=${t.id} transform="translate(${r.x.toFixed(1)} ${(r.y+(t.name&&this.zoneLabels?24:0)*n).toFixed(1)}) scale(${n})">
            <rect x=${-c/2} y="-9" width=${c} height="18" rx="9" /><text y="3.5">${a}</text>
          </g>`:m}`}renderOpenMark(t,e,s,i){if(!this.roomStates?.openOpenings.includes(t))return m;const o=(e[0][0]+e[1][0])/2,n=(e[0][1]+e[1][1])/2,a=i?i.arcs.map((r,c)=>({a:r,hinge:i.leaves[c]?.[0]??e[0],tip:i.leaves[c]?.[1]??[o,n]})):[];return d`
      ${a.map(({a:r,hinge:c})=>d`<path class="open-wedge" data-open-wedge=${t} d=${`M ${c[0]} ${c[1]} L ${r.from[0]} ${r.from[1]} A ${r.r} ${r.r} 0 0 ${r.sweep} ${r.to[0]} ${r.to[1]} Z`} stroke-width=${s} />`)}
      <line class="open-mark" data-open-mark=${t} x1=${e[0][0]} y1=${e[0][1]} x2=${e[1][0]} y2=${e[1][1]} stroke-width=${6*s} />
      ${a.length?a.map(({tip:r})=>d`<circle class="open-dot" cx=${r[0]} cy=${r[1]} r=${4*s} stroke-width=${1.5*s} />`):d`<circle class="open-dot" cx=${o} cy=${n} r=${4*s} stroke-width=${1.5*s} />`}`}zoneLabelPoint(t,e,s){const i=1/this.scale,o=e.map(r=>r.x*this.planWidth),n=e.map(r=>r.y*this.planHeight),a=Math.max(36,t.name.length*7+18)*i;switch(t.labelPos){case"top":return{x:s.x*this.planWidth,y:Math.min(...n)-14*i};case"bottom":return{x:s.x*this.planWidth,y:Math.max(...n)+14*i};case"left":return{x:Math.min(...o)-a/2-6*i,y:s.y*this.planHeight};case"right":return{x:Math.max(...o)+a/2+6*i,y:s.y*this.planHeight};default:return{x:s.x*this.planWidth,y:s.y*this.planHeight}}}static labelOffset(t,e,s){switch(t){case"top":return{x:0,y:-(e+14)};case"left":return{x:-(e+8+s/2),y:0};case"right":return{x:e+8+s/2,y:0};default:return{x:0,y:e+14}}}renderDraft(){const t=this.draftPoints;if(!t.length)return m;const e=1/this.scale,s=t.map(o=>({x:o.x*this.planWidth,y:o.y*this.planHeight})),i=s.map(o=>`${o.x.toFixed(1)},${o.y.toFixed(1)}`).join(" ");return d`<g class="draft" pointer-events="none">
      ${s.length>=3?d`<polygon points=${i} stroke-width=${(1.5*e).toFixed(2)} />`:d`<polyline points=${i} stroke-width=${(1.5*e).toFixed(2)} />`}
      ${s.map((o,n)=>d`<circle cx=${o.x.toFixed(1)} cy=${o.y.toFixed(1)} r=${((n===0?5.5:3.5)*e).toFixed(2)} stroke-width=${(1.5*e).toFixed(2)} />`)}
    </g>`}bearingTo(t,e,s){const i=this.toScreen(t.x,t.y);return((Math.atan2(s-i.y,e-i.x)*180/Math.PI+90)%360+360)%360}radiusOf(t){const e=this.shaping?.id===t.id&&this.shaping.radius!==void 0?this.shaping.radius:t.radius;return e?Math.max(12,e*this.planWidth):this.coneRadius}editPolygon(t,e){if(!t.polygon)return;let s=t.polygon.map(i=>({...i}));if("remove"in e){if(s.length<=3)return;s=s.filter((i,o)=>o!==e.remove)}else{const i=s[e.insertAfter],o=s[(e.insertAfter+1)%s.length];if(s.length>=40)return;s.splice(e.insertAfter+1,0,{x:+((i.x+o.x)/2).toFixed(4),y:+((i.y+o.y)/2).toFixed(4)})}this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:t.id,polygon:s},bubbles:!0,composed:!0}))}polygonPath(t){const e=this.shaping?.id===t.id&&this.shaping.polygon?this.shaping.polygon:t.polygon;return!e||e.length<3?null:e.map(s=>`${((s.x-t.x)*this.planWidth).toFixed(1)},${((s.y-t.y)*this.planHeight).toFixed(1)}`).join(" ")}clippedCoverage(t,e,s,i){const o=this.geometry;if(!this.clipCoverage||!o||t.polygon)return null;const n=se(o,t.level);if(!ie(o,n))return null;const a=this.coverage.polygon(t.id,{x:e.x,y:e.y,rotation:s,fov:i,radiusPx:this.radiusOf(t),level:n},o,this.planWidth,this.planHeight,this.entityStates,this.catalog??void 0),r=this.covPoints.get(t.id);if(r&&r.pts===a)return r.points;const c=a.map(l=>`${((l[0]-e.x)*this.planWidth).toFixed(2)},${((l[1]-e.y)*this.planHeight).toFixed(2)}`).join(" ");return this.covPoints.set(t.id,{pts:a,points:c}),c}renderPolygonHandles(t){const e=this.shaping?.id===t.id&&this.shaping.polygon?this.shaping.polygon:t.polygon;if(!e)return m;const s=1/this.scale,i=o=>({x:(o.x-t.x)*this.planWidth,y:(o.y-t.y)*this.planHeight});return d`
      ${e.map((o,n)=>{const a=i(o),r=i(e[(n+1)%e.length]);return d`
          <circle class="handle mid" cx=${((a.x+r.x)/2).toFixed(1)} cy=${((a.y+r.y)/2).toFixed(1)} r=${(4.5*s).toFixed(1)} data-cov-mid=${n} role="button" aria-label=${F("הוסף נקודה")}
            @pointerdown=${c=>{c.stopPropagation(),c.preventDefault()}} @click=${c=>{c.stopPropagation(),this.editPolygon(t,{insertAfter:n})}} />
          <circle class="handle" cx=${a.x.toFixed(1)} cy=${a.y.toFixed(1)} r=${(6.5*s).toFixed(1)} data-cov-vertex=${n} role="slider" aria-label=${F("נקודת כיסוי")}
            @pointerdown=${c=>this.onCoverageVertexDown(t,n,c)} @dblclick=${c=>{c.stopPropagation(),this.editPolygon(t,{remove:n})}} />`})}
    `}renderHandles(t,e,s){const i=this.radiusOf(t),o=1/this.scale,n=(h,p)=>({x:Math.cos(f.rad(h))*p,y:Math.sin(f.rad(h))*p}),a=n(e-s/2,i),r=n(e+s/2,i),c=n(e,i*.72),l=7*o;return d`
      <line class="handle-line" x1="0" y1="0" x2=${c.x.toFixed(1)} y2=${c.y.toFixed(1)} />
      <rect class="handle" x=${(a.x-l).toFixed(1)} y=${(a.y-l).toFixed(1)} width=${(l*2).toFixed(1)} height=${(l*2).toFixed(1)} rx=${(1.5*o).toFixed(1)} role="slider" aria-label=${F("קצה שדה ראייה")} @pointerdown=${h=>this.onHandlePointerDown(t,"left",h)} @click=${h=>h.stopPropagation()} />
      <rect class="handle" x=${(r.x-l).toFixed(1)} y=${(r.y-l).toFixed(1)} width=${(l*2).toFixed(1)} height=${(l*2).toFixed(1)} rx=${(1.5*o).toFixed(1)} role="slider" aria-label=${F("קצה שדה ראייה")} @pointerdown=${h=>this.onHandlePointerDown(t,"right",h)} @click=${h=>h.stopPropagation()} />
      <circle class="handle" cx=${c.x.toFixed(1)} cy=${c.y.toFixed(1)} r=${(8*o).toFixed(1)} role="slider" aria-label=${F("כיוון מבט")} @pointerdown=${h=>this.onHandlePointerDown(t,"dir",h)} @click=${h=>h.stopPropagation()} />
      <circle class="handle range" cx=${n(e,i).x.toFixed(1)} cy=${n(e,i).y.toFixed(1)} r=${(6.5*o).toFixed(1)} role="slider" aria-label=${F("טווח כיסוי")} data-cov-range @pointerdown=${h=>this.onRangePointerDown(t,h)} />
    `}static rad(t){return(t-90)*Math.PI/180}fovPath(t,e,s){const i=f.rad(t-e/2),o=f.rad(t+e/2),n=Math.cos(i)*s,a=Math.sin(i)*s,r=Math.cos(o)*s,c=Math.sin(o)*s;return`M0 0 L${n.toFixed(1)} ${a.toFixed(1)} A${s} ${s} 0 ${e>180?1:0} 1 ${r.toFixed(1)} ${c.toFixed(1)} Z`}clustered(){if(this.editable||this.placing||!this.clusterThreshold)return{singles:this.markers,clusters:[]};const t=[...this.selectedId?[this.selectedId]:[],...this.selectedIds,...this.highlightIds];return ve(this.markers,{planWidth:this.planWidth,planHeight:this.planHeight,scale:this.scale,threshold:this.clusterThreshold,keepIds:t})}expandCluster(t,e){if(this.dragMoved)return;e.stopPropagation();const s=be(t);this.zoomToBox(s.x0,s.y0,s.x1,s.y1,72),this.updateComplete.then(()=>{this.focusMarker(t.members[0].id)||this.renderRoot.querySelector("g.marker.cluster")?.focus()})}renderCluster(t){const e=1/this.scale,s=t.members.length,i=s>=100?20:s>=10?17:14,o=Y[t.state]??Y.neutral,n=Object.entries(t.byState).map(([a,r])=>`${r} ${B(`states.${a}`)}`).join(", ");return d`
      <g class="marker cluster ${t.state}" transform="translate(${t.x*this.planWidth} ${t.y*this.planHeight})" data-cluster=${t.id} data-count=${s} data-state=${t.state}
         tabindex="0" role="button" aria-label=${`${B("floor.cluster")}: ${s} - ${n}`}
         @click=${a=>this.expandCluster(t,a)}
         @keydown=${a=>{(a.key==="Enter"||a.key===" ")&&(a.preventDefault(),this.expandCluster(t,a))}}>
        <g transform="scale(${e})">
          <circle class="halo" r=${i+9} />
          <circle class="ring" r=${i+4} />
          <circle class="pin" r=${i} fill=${o} />
          <text class="count">${s}</text>
        </g>
      </g>`}renderMarker(t){const e=this.dragging?.id===t.id?this.dragging:t,s=this.orienting?.id===t.id?this.orienting:null,i=s?s.rotation:t.rotation??0,o=s?s.fov:t.fov,n=e.x*this.planWidth,a=e.y*this.planHeight,r=1/this.scale,c=t.kind==="camera",l=Y[t.state]??Y.neutral,h=this.selectedId===t.id||this.selectedIds.includes(t.id),p=this.alwaysLabel||h||this.hoverId===t.id,u=Math.max(44,t.label.length*6.5+16),y=this.dimEntities&&!c,b=c?13:11;return d`
      <g class="marker ${t.state} ${h?"selected":""} ${y?"dimmed":""} ${this.editable?"editable":""}"
         transform="translate(${n} ${a})" data-id=${t.id}
         tabindex="0" role="button" aria-label=${t.label} aria-pressed=${h}
         @mouseenter=${()=>this.hoverId=t.id} @mouseleave=${()=>this.hoverId=null}
         @pointerdown=${w=>this.onMarkerPointerDown(t,w)}
         @click=${w=>this.placing?void 0:this.editable?w.stopPropagation():this.select(t,w)}
         @keydown=${w=>(w.key==="Enter"||w.key===" ")&&this.select(t,w)}>
        ${c&&o&&t.state!=="forbidden"?(()=>{const w=this.polygonPath(t);if(w)return d`<polygon class="fov ${t.state==="offline"?"off":""}" data-cov-polygon points=${w} />`;const M=this.clippedCoverage(t,e,i,o);return M?d`<polygon class="fov ${t.state==="offline"?"off":""}" data-cov-clipped points=${M} />`:d`<path class="fov ${t.state==="offline"?"off":""}" d=${this.fovPath(i,o,this.radiusOf(t))} />`})():m}
        ${c&&o&&this.editable&&h&&!this.dragging?this.polygonPath(t)?this.renderPolygonHandles(t):this.renderHandles(t,i,o):m}
        <g transform="scale(${r})">
          <circle class="halo" r=${b+9} />
          <circle class="pin" r=${b} fill=${l} />
          <g class="icon" transform="scale(${c?.85:.75})">${Te[t.kind]}</g>
          ${t.state==="offline"?d`<line x1="-9" y1="-9" x2="9" y2="9" stroke="#fff" stroke-width="2.5" />`:m}
          ${t.state==="forbidden"?d`<g transform="translate(8 -8)"><circle r="6.5" fill="#fff" /><g fill="none" stroke="var(--sw-forbidden)" stroke-width="1.5" transform="scale(0.45)"><rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/></g></g>`:m}
          ${p?d`<g transform="translate(${f.labelOffset(t.labelPos,b,u).x.toFixed(1)} ${f.labelOffset(t.labelPos,b,u).y.toFixed(1)})" data-label-pos=${t.labelPos??"auto"}>
                <rect class="lbl-bg" x=${-u/2} y="-10" width=${u} height="20" rx="6" />
                <text class="lbl" y="3.5">${t.label}</text>
              </g>`:m}
        </g>
      </g>
    `}primitives(t){const e=this.primCache;if(e&&e.doc===t&&e.w===this.planWidth&&e.h===this.planHeight&&e.level===this.structureLevel&&e.catalog===this.catalog&&Ne(e.anchors,this.anchorPositions))return e.prims;const s=Object.keys(this.anchorPositions).length?ne(t,this.anchorPositions):t,i=st(s,this.planWidth,this.planHeight,this.structureLevel,this.catalog??void 0);return this.primCache={doc:t,w:this.planWidth,h:this.planHeight,level:this.structureLevel,catalog:this.catalog,anchors:this.anchorPositions,prims:i},i}circuitTokens(){const t=this.geometry;if(!t)return new Map;if(this.circuitCache?.doc!==t){const e=new Map;for(const s of t.circuits){const i=oe(s.color_token);i&&e.set(s.id,i)}this.circuitCache={doc:t,tokens:e}}return this.circuitCache.tokens}stairOf(t){const e=this.geometry;if(!e)return null;const s=this.stairCache;if(!s||s.doc!==e||s.w!==this.planWidth||s.h!==this.planHeight){const{scale:i}=ae(e),o=new Map,n=new Map(e.levels.map(r=>[r.id,r])),a=re(e);for(const r of e.connectors)o.set(r.id,le(r,this.planWidth,this.planHeight,i,{descending:ce(n,r,a)<0}));this.stairCache={doc:e,w:this.planWidth,h:this.planHeight,plans:o}}return this.stairCache.plans.get(t)??null}renderStair(t,e,s,i){const o=e.walk[0];return d`<g class="conn stair ${s}" data-connector=${t.id} data-kind=${t.ckind} data-shape=${e.shape} data-flights=${e.flights.map(n=>n.steps).join("+")}>
      ${e.landings.map(n=>d`<polygon class="slanding" data-stair-landing points=${I(n)} stroke-width=${1.2*i} />`)}
      ${e.flights.map((n,a)=>d`<g data-stair-flight=${a}><polygon class="sflight" points=${I(n.outline)} stroke-width=${1.2*i} />
        ${n.treads.map(([r,c])=>d`<line class="stread" x1=${r[0]} y1=${r[1]} x2=${c[0]} y2=${c[1]} stroke-width=${.8*i} />`)}</g>`)}
      ${e.breakLine?d`<line class="sbreak" data-stair-break x1=${e.breakLine[0][0]} y1=${e.breakLine[0][1]} x2=${e.breakLine[1][0]} y2=${e.breakLine[1][1]} stroke-width=${1.4*i} />`:m}
      <polyline class="swalk" points=${I(e.walk)} stroke-width=${1.4*i} marker-end="url(#sw-arrow)" />
      ${o?d`<circle class="sstart" cx=${o[0]} cy=${o[1]} r=${3*i} />`:m}
      <text class="clabel" data-conn-text x=${t.lx} y=${t.ly-7*i} font-size=${12*i}>${t.label}</text>
      ${e.caption?d`<text class="clabel scap" data-stair-caption x=${t.lx} y=${t.ly+8*i} font-size=${10.5*i}>${e.caption}</text>`:m}
    </g>`}renderStructure(){const t=this.geometry;if(!t)return m;const e=1/this.scale,s=new Set(this.issueIds),i=this.highlightSet,o=this.primitives(t).filter(n=>n.kind==="object"?!this.hideObjects:n.kind==="connector"?!this.hideConnectors:!this.hideStructure);return d`<g class="structure" data-structure style=${`--inv: ${e}`}>${o.map(n=>this.renderPrimitive(n,e,s,i))}</g>`}renderPrimitive(t,e,s,i=new Set){const o=`${t.id===this.selectedGeomId||i.has(t.id)?"sel":""} ${s.has(t.id)?"issue":""}`;switch(t.kind){case"wall":{if(!t.glass)return d`<g class="wall-g ${o}" data-wall=${t.id}><polyline class="wall" points=${I(t.points)} stroke-width=${t.width} /></g>`;const{band:n}=de(t.width),a=I(t.points);return d`<g class="wall-g glasswall ${o}" data-wall=${t.id} data-wall-glass>
          <polyline class="wall gframe" points=${a} stroke-width=${t.width} />
          <polyline class="gpane" points=${a} stroke-width=${n} />
          <polyline class="gline" points=${a} stroke-width=${Math.min(n*.5,1.2*e)} />
        </g>`}case"glazing":return d`<g class="glazing ${o}" data-glazing=${t.id} data-panels=${t.panels.length}>
          ${t.mullions.map(([n,a])=>d`<line class="mullion" x1=${n[0]} y1=${n[1]} x2=${a[0]} y2=${a[1]} stroke-width=${Math.max(t.mullion,1.2*e)} />`)}
          ${t.panels.filter(n=>n.operation).map(n=>d`<line class="operable" data-operable=${n.index} data-operation=${n.operation??""} x1=${n.a[0]} y1=${n.a[1]} x2=${n.b[0]} y2=${n.b[1]}
            stroke-width=${1.4*e} stroke-dasharray=${`${3*e} ${2*e}`} />${this.renderOpenMark(he(t.id,n.index),[n.a,n.b],e)}`)}
        </g>`;case"door":return d`<g class="opening ${o}" data-opening=${t.id} data-kind="door">
          ${t.leaves.map(([n,a])=>d`<line class="leaf" x1=${n[0]} y1=${n[1]} x2=${a[0]} y2=${a[1]} stroke-width=${1.6*e} />`)}
          ${t.arcs.map(n=>d`<path class="arc" d=${`M ${n.from[0]} ${n.from[1]} A ${n.r} ${n.r} 0 0 ${n.sweep} ${n.to[0]} ${n.to[1]}`} stroke-width=${1.1*e} stroke-dasharray=${`${4*e} ${3*e}`} />`)}
          ${this.renderOpenMark(t.id,t.gap,e,t)}
        </g>`;case"window":return d`<g class="opening ${o}" data-opening=${t.id} data-kind="window">${t.lines.map(([n,a])=>d`<line class="glass" x1=${n[0]} y1=${n[1]} x2=${a[0]} y2=${a[1]} stroke-width=${1.6*e} />`)}${this.renderOpenMark(t.id,t.gap,e)}</g>`;case"passage":return d`<g class="opening ${o}" data-opening=${t.id} data-kind="passage"><line class="gapline" x1=${t.gap[0][0]} y1=${t.gap[0][1]} x2=${t.gap[1][0]} y2=${t.gap[1][1]} stroke-width=${e} stroke-dasharray=${`${2*e} ${3*e}`} /></g>`;case"connector":{const n=this.stairOf(t.id);return n?this.renderStair(t,n,o,e):d`<g class="conn ${o}" data-connector=${t.id} data-kind=${t.ckind}>
          <path class="cbody" d=${`M ${t.points.map(a=>`${a[0]} ${a[1]}`).join(" L ")}`} stroke-width=${t.width} />
          <path class="carrow" d=${`M ${t.arrow.from[0]} ${t.arrow.from[1]} L ${t.arrow.to[0]} ${t.arrow.to[1]}`} stroke-width=${2*e} marker-end="url(#sw-arrow)" />
          <text class="clabel" data-conn-text x=${t.lx} y=${t.ly} font-size=${12*e}>${t.label}</text>
        </g>`}case"object":{const n=t.anchor?.startsWith("ha_entity:")?t.anchor.slice(10):null,a=t.circuit_id!==null&&this.circuitStates[t.circuit_id]==="on"||n!==null&&this.entityStates[n]==="on",r=t.circuit_id!==null?this.circuitTokens().get(t.circuit_id):void 0,c=Math.min(3,Math.max(.35,Math.min(t.w,t.h)*.6/24));return d`<g class="obj ${o} ${a?"glow":""}" data-object=${t.id} data-item=${t.item_id} data-shape=${t.shape} data-circuit=${t.circuit_id??m} ?data-glow=${a}
             style=${`--oc: var(--sw-obj-${t.color});${r?` --kc: var(--sw-${r});`:""}`}>
          ${t.shape==="cylinder"?d`<ellipse class="fp" cx=${t.cx} cy=${t.cy} rx=${t.w/2} ry=${t.h/2} transform=${`rotate(${t.rotation} ${t.cx} ${t.cy})`} stroke-width=${1.2*e} />`:d`<polygon class="fp" points=${I(t.corners)} stroke-width=${1.2*e} />`}
          ${t.steps.map(([l,h])=>d`<line class="step" x1=${l[0]} y1=${l[1]} x2=${h[0]} y2=${h[1]} stroke-width=${e} />`)}
          <g class="sym" transform=${`translate(${t.cx} ${t.cy}) rotate(${t.rotation}) scale(${c}) translate(-12 -12)`} stroke-width=${1.6/c}>${Me(t.icon)}</g>
          ${t.label&&this.scale>=.6?d`<text class="olabel" x=${t.cx} y=${t.cy+t.h/2+12*e} font-size=${11*e}>${t.label}</text>`:m}
        </g>`}case"label":return d`<text class="glabel ${o}" data-label=${t.id} x=${t.x} y=${t.y} font-size=${t.size}>${t.text}</text>`}}queueHover(t){const e=this.getBoundingClientRect(),s=this.toPlan(t.clientX-e.left,t.clientY-e.top),i=t.composedPath()[0],o=i instanceof Element&&!!i.closest("[data-hit-opening], [data-hit-label]")&&!this.nearCorner(t.clientX,t.clientY);this.hoverEvent={x:s.x,y:s.y,shift:t.shiftKey,item:o},!this.hoverFrame&&(this.hoverFrame=requestAnimationFrame(()=>{this.hoverFrame=0;const n=this.hoverEvent;n&&this.dispatchEvent(new CustomEvent("plan-hover",{detail:n,bubbles:!0,composed:!0}))}))}pickGeom(t,e){this.panActive||(e.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("geom-select",{detail:{id:t,kind:"wall",add:at(e)},bubbles:!0,composed:!0})))}pickConnector(t,e){this.panActive||(e.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("geom-select",{detail:{id:t,kind:"connector"},bubbles:!0,composed:!0})))}renderObjectHandles(t,e){const s=l=>[(t.corners[l][0]+t.corners[(l+1)%4][0])/2,(t.corners[l][1]+t.corners[(l+1)%4][1])/2],i=s(0),o=i[0]-t.cx,n=i[1]-t.cy,a=Math.hypot(o,n)||1,r=[i[0]+o/a*18*e,i[1]+n/a*18*e],c=5*e;return d`<g class="ohandles">
      <line class="handle-line" x1=${i[0]} y1=${i[1]} x2=${r[0]} y2=${r[1]} />
      ${[0,1,2,3].map(l=>{const h=s(l);return d`<rect class="handle" data-object-stretch=${l} x=${h[0]-c} y=${h[1]-c} width=${c*2} height=${c*2} rx=${1.5*e} role="slider" aria-label=${F("מתיחה")}
          @pointerdown=${p=>this.onGeomDragStart("object-stretch",t.id,l,p)} @click=${p=>p.stopPropagation()} />`})}
      <circle class="handle" data-object-rotate cx=${r[0]} cy=${r[1]} r=${7*e} role="slider" aria-label=${F("סיבוב")} @pointerdown=${l=>this.onGeomDragStart("object-rotate",t.id,0,l)} @click=${l=>l.stopPropagation()} />
    </g>`}nearCorner(t,e){const s=this.geometry,i=this.cornerSnapPx;if(!s||!(i>0))return!1;const o=this.getBoundingClientRect(),n=this.toPlan(t-o.left,e-o.top);return s.walls.some(a=>a.polyline.some(r=>Math.hypot((r[0]-n.x)*this.planWidth,(r[1]-n.y)*this.planHeight)*this.scale<=i))}releaseFieldFocus(){let t=document.activeElement;for(;t?.shadowRoot?.activeElement;)t=t.shadowRoot.activeElement;(t instanceof HTMLInputElement||t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement)&&t.blur()}touchPick(t,e,s){s.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("geom-select",{detail:{id:t,kind:e,add:at(s)},bubbles:!0,composed:!0}))}touchLocked(t){return this.coarse&&t!==this.selectedGeomId&&!(this.multiDrag&&this.highlightSet.has(t))}onGeomDragStart(t,e,s,i){const o=t.startsWith("object")||t.startsWith("connector");if(this.panActive||i.button!==0||this.geomDrag==="none"||(t==="vertex"||t==="segment"||t==="wall"||t==="zone")&&this.geomDrag!=="all"||o&&this.geomDrag==="items"||!o&&this.geomDrag==="objects"||t!=="vertex"&&t!=="segment"&&t!=="curve-point"&&this.nearCorner(i.clientX,i.clientY))return;i.stopPropagation(),i.preventDefault(),this.releaseFieldFocus();const n=this.getBoundingClientRect(),a=this.toPlan(i.clientX-n.left,i.clientY-n.top);let r=!1,c=a,l={shift:i.shiftKey,alt:i.altKey,ctrl:i.ctrlKey||i.metaKey};const h=P=>({kind:t,id:e,index:s,x:+P.x.toFixed(5),y:+P.y.toFixed(5),sx:+a.x.toFixed(5),sy:+a.y.toFixed(5),...l}),p=(P,k)=>this.dispatchEvent(new CustomEvent(P,{detail:k,bubbles:!0,composed:!0}));this.geomPress=!0,this.viewport.setPointerCapture(i.pointerId);const u=P=>{l={shift:P.shiftKey,alt:P.altKey,ctrl:P.ctrlKey||P.metaKey};const k=this.toPlan(P.clientX-n.left,P.clientY-n.top);!r&&Math.hypot((k.x-a.x)*this.planWidth,(k.y-a.y)*this.planHeight)*this.scale<3||(r=!0,c=k,this.geomDragAt={x:k.x,y:k.y},p("geom-drag-move",h(k)))},y=()=>{this.geomDragAt=null,this.geomPress=!1,this.swallowClick()},b=i.shiftKey,w=()=>{y(),r?p("geom-drag",h(c)):t==="zone"?p("zone-select",{id:e,add:b}):t==="segment"?p("geom-select",{id:e,kind:"wall",segment:s,add:b}):p("geom-select",t==="vertex"||t==="curve-point"?{id:e,kind:"wall",vertex:s,add:b}:{id:e,kind:t.startsWith("object")?"object":t.startsWith("connector")?"connector":t,add:b})},M=()=>{y(),r&&p("geom-drag-cancel",h(c))};W(this.viewport,{move:u,commit:w,cancel:M})}renderGeomHits(){const t=this.geometry,e=this.geomDrag;if(!t||e==="none")return m;const s=1/this.scale,i=this.planWidth,o=this.planHeight,n=this.primitives(t),a=e==="all"?n.filter(g=>g.kind==="wall"):[],r=e==="objects"?[]:n.filter(g=>g.kind==="door"||g.kind==="window"||g.kind==="passage"),c=e==="objects"?[]:n.filter(g=>g.kind==="label"),l=new Map;for(const g of n)g.kind==="wall"&&l.set(g.id,Math.max(l.get(g.id)??0,g.width));const h=new Map(t.openings.map(g=>[g.id,g.wall_id])),p=e==="all"?t.walls.find(g=>g.id===this.selectedGeomId):void 0,u=this.curvePointHandles&&(e==="all"||e==="items")?t.walls.find(g=>g.id===this.selectedGeomId):void 0,y=u?Q(u):null,b=this.coarse?Be:12,w=this.geomDragAt,M=e==="all"||e==="objects",P=M?n.filter(g=>g.kind==="object"&&!this.hideObjects):[],k=M?n.filter(g=>g.kind==="connector"&&!this.hideConnectors):[],S=M&&!w?P.find(g=>g.id===this.selectedGeomId):void 0,z=M?t.connectors.find(g=>g.id===this.selectedGeomId):void 0,R=this.multiDrag?this.highlightSet:new Set,L=g=>g===this.selectedGeomId||R.has(g);return d`<g class="geom-hits">
      ${k.map(g=>d`<path class="hit" data-hit-connector=${g.id} d=${`M ${g.points.map(v=>`${v[0]} ${v[1]}`).join(" L ")}`} stroke-width=${Math.max(g.width,12*s)}
          @pointerdown=${v=>g.id===this.selectedGeomId&&z&&!z.object_id?this.onGeomDragStart("connector",g.id,0,v):void 0}
          @click=${v=>this.pickConnector(g.id,v)} />`)}
      ${a.filter(g=>!L(g.id)).map(g=>d`<polyline class="hit" data-hit-wall=${g.id} points=${I(g.points)} stroke-width=${Math.max(g.width,b*s)} @click=${v=>this.pickGeom(g.id,v)} />`)}
      ${pe(P,this.selectedGeomId).map(g=>d`<polygon class="hit ohit" data-hit-object=${g.id} points=${I(ue(g,Ae*s))}
          @pointerdown=${v=>this.touchLocked(g.id)?void 0:this.onGeomDragStart(v.altKey?"object-duplicate":"object",g.id,0,v)}
          @click=${v=>this.touchLocked(g.id)?this.touchPick(g.id,"object",v):v.stopPropagation()} />`)}
      ${z&&!z.object_id?z.polyline.map((g,v)=>d`<circle class="gvtx" data-connector-vertex=${v} cx=${g[0]*i} cy=${g[1]*o} r=${6*s} stroke-width=${1.6*s} aria-label=${F("פינת מחבר {n}",{n:v+1})}
          @pointerdown=${C=>this.onGeomDragStart("connector-vertex",z.id,v,C)} @click=${C=>C.stopPropagation()} />`):m}
      ${S?this.renderObjectHandles(S,s):m}
      ${a.filter(g=>L(g.id)).map(g=>d`<polyline class="hit whit" data-hit-wall=${g.id} data-wall-body points=${I(g.points)} stroke-width=${Math.max(g.width,b*s)}
          @pointerdown=${v=>this.onGeomDragStart("wall",g.id,0,v)} @click=${v=>v.stopPropagation()} />`)}
      ${r.map(g=>d`<line class="hit" data-hit-opening=${g.id} x1=${g.gap[0][0]} y1=${g.gap[0][1]} x2=${g.gap[1][0]} y2=${g.gap[1][1]} stroke-width=${Math.max(28*s,l.get(h.get(g.id)??"")??0)}
          @pointerdown=${v=>this.touchLocked(g.id)?void 0:this.onGeomDragStart("opening",g.id,0,v)} @click=${v=>this.touchLocked(g.id)?this.touchPick(g.id,"opening",v):this.itemClick(v)} />`)}
      ${c.map(g=>d`<circle class="hit" data-hit-label=${g.id} cx=${g.x} cy=${g.y} r=${Math.max(g.size,10*s)}
          @pointerdown=${v=>this.touchLocked(g.id)?void 0:this.onGeomDragStart("label",g.id,0,v)} @click=${v=>this.touchLocked(g.id)?this.touchPick(g.id,"label",v):this.itemClick(v)} />`)}
      ${u&&y?y.map((g,v)=>{const C=u.polyline[g];return d`<circle class="gvtx gpt ${g===this.selectedVertex?"on":""}" data-curve-point=${v} data-wall-vertex=${g} cx=${C[0]*i} cy=${C[1]*o} r=${(this.coarse?9:6.5)*s} stroke-width=${1.8*s}
          role="slider" aria-label=${`${kt("pointHandle")} ${v+1}`} @pointerdown=${E=>this.onGeomDragStart("curve-point",u.id,g,E)} @click=${E=>E.stopPropagation()} />`}):m}
      ${p&&!(y&&u?.id===p.id)?(tt(p.polyline)?p.polyline.slice(0,-1):p.polyline).map((g,v)=>d`<circle class="gvtx ${v===this.selectedVertex?"on":""}" data-wall-vertex=${v} cx=${g[0]*i} cy=${g[1]*o} r=${6*s} stroke-width=${1.6*s} aria-label=${F("פינת קיר {n}",{n:v+1})}
          @pointerdown=${C=>this.onGeomDragStart("vertex",p.id,v,C)} @click=${C=>C.stopPropagation()} />`):m}
      ${p&&this.curveHandles?p.polyline.slice(1).map((g,v)=>{const C=He(p,v,i,o),E=5.5*s;return d`<rect class="gseg ${v===this.selectedSegment?"on":""}" data-wall-segment=${v} x=${C[0]*i-E} y=${C[1]*o-E} width=${2*E} height=${2*E}
          transform=${`rotate(45 ${C[0]*i} ${C[1]*o})`} stroke-width=${1.6*s} aria-label=${`${kt("segmentHandle")} ${v+1}`}
          @pointerdown=${et=>this.onGeomDragStart("segment",p.id,v,et)} @click=${et=>et.stopPropagation()} />`}):m}
      ${w?d`<circle class="gdrag" cx=${w.x*i} cy=${w.y*o} r=${5*s} stroke-width=${1.5*s} />`:m}
    </g>`}candidatePrims(t){const e=this.geometry;if(!e)return[];const s=this.candCache;if(s&&s.set===t&&s.doc===e&&s.w===this.planWidth&&s.h===this.planHeight&&s.catalog===this.catalog)return s.prims;const i=st(fe(e,t),this.planWidth,this.planHeight,null,this.catalog??void 0);return this.candCache={set:t,doc:e,w:this.planWidth,h:this.planHeight,catalog:this.catalog,prims:i},i}candConfidence(t,e){return t.walls.find(s=>s.id===e)?.confidence??t.openings.find(s=>s.id===e)?.confidence??t.objects.find(s=>s.id===e)?.confidence??0}candAnchor(t,e){const s=t.find(i=>i.id===e);if(!s)return null;if(s.kind==="wall"){const i=s.points[0],o=s.points[s.points.length-1];return[(i[0]+o[0])/2,(i[1]+o[1])/2]}return s.kind==="door"||s.kind==="window"||s.kind==="passage"?[(s.gap[0][0]+s.gap[1][0])/2,(s.gap[0][1]+s.gap[1][1])/2]:null}renderCandidates(){const t=this.candidates;if(!t)return m;const e=this.candidatePrims(t),s=1/this.scale,i=l=>`cand ${this.candidateStates[l]??"accepted"} ${l===this.selectedCandidateId?"sel":""} ${it(t,l)?"outside":""}`,o=l=>({state:this.candidateStates[l]??"accepted",score:this.candConfidence(t,l).toFixed(2)}),n=this.candHover??this.selectedCandidateId,a=n?this.candAnchor(e,n):null,r=n?`${F("ביטחון {v}",{v:this.candConfidence(t,n).toFixed(2)})}${it(t,n)?` · ${xt}`:""}`:"",c=(r.length*7+16)*s;return d`<g class="candidates" data-candidates>
      ${e.map(l=>{const h=o(l.id);switch(l.kind){case"wall":return it(t,l.id)?d`<g class=${i(l.id)} data-candidate=${l.id} data-kind="wall" data-state=${h.state} data-score=${h.score} data-outside-main><title>${xt}</title><polyline class="cwall" points=${I(l.points)} stroke-width=${l.width} /></g>`:d`<g class=${i(l.id)} data-candidate=${l.id} data-kind="wall" data-state=${h.state} data-score=${h.score}><polyline class="cwall" points=${I(l.points)} stroke-width=${l.width} /></g>`;case"door":return d`<g class=${i(l.id)} data-candidate=${l.id} data-kind="door" data-state=${h.state} data-score=${h.score}>
              ${l.leaves.map(([p,u])=>d`<line class="cleaf" x1=${p[0]} y1=${p[1]} x2=${u[0]} y2=${u[1]} stroke-width=${1.6*s} />`)}
              ${l.arcs.map(p=>d`<path class="carc" d=${`M ${p.from[0]} ${p.from[1]} A ${p.r} ${p.r} 0 0 ${p.sweep} ${p.to[0]} ${p.to[1]}`} stroke-width=${1.1*s} />`)}
            </g>`;case"window":return d`<g class=${i(l.id)} data-candidate=${l.id} data-kind="window" data-state=${h.state} data-score=${h.score}>${l.lines.map(([p,u])=>d`<line class="cglass" x1=${p[0]} y1=${p[1]} x2=${u[0]} y2=${u[1]} stroke-width=${1.6*s} />`)}</g>`;case"passage":return d`<g class=${i(l.id)} data-candidate=${l.id} data-kind="passage" data-state=${h.state} data-score=${h.score}><line class="cgap" x1=${l.gap[0][0]} y1=${l.gap[0][1]} x2=${l.gap[1][0]} y2=${l.gap[1][1]} stroke-width=${s} /></g>`;case"object":return d`<g class=${i(l.id)} data-candidate=${l.id} data-kind="object" data-item=${l.item_id} data-state=${h.state} data-score=${h.score} aria-label=${$e(l.item_id)}>
              <polygon class="cobj" points=${I(l.corners)} stroke-width=${1.6*s} />
              ${l.steps.map(([p,u])=>d`<line class="crow" x1=${p[0]} y1=${p[1]} x2=${u[0]} y2=${u[1]} stroke-width=${s} />`)}
            </g>`;default:return m}})}
      ${a?d`<g class="cand-score" data-cand-score data-cand-score-for=${n??""}><rect x=${a[0]-c/2} y=${a[1]-22*s} width=${c} height=${20*s} rx=${10*s} stroke-width=${s} /><text x=${a[0]} y=${a[1]-12*s} font-size=${12*s}>${r}</text></g>`:m}
    </g>`}pickCandidate(t,e){e.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("candidate-select",{detail:{id:t},bubbles:!0,composed:!0}))}onCandDragStart(t,e,s){if(!this.candidateEditable||s.button!==0)return;s.stopPropagation(),s.preventDefault(),this.releaseFieldFocus();const i=this.getBoundingClientRect(),o=this.toPlan(s.clientX-i.left,s.clientY-i.top);let n=!1,a=o;this.viewport.setPointerCapture(s.pointerId);const r=p=>{const u=this.toPlan(p.clientX-i.left,p.clientY-i.top);!n&&Math.hypot((u.x-o.x)*this.planWidth,(u.y-o.y)*this.planHeight)*this.scale<3||(n=!0,a=u,this.candDrag={x:u.x,y:u.y})},c=()=>{this.candDrag=null,this.swallowClick()},l=()=>{c(),n&&this.dispatchEvent(new CustomEvent("candidate-drag",{detail:{id:t,index:e,x:+a.x.toFixed(5),y:+a.y.toFixed(5)},bubbles:!0,composed:!0}))},h=()=>c();W(this.viewport,{move:r,commit:l,cancel:h})}renderCandidateHits(){const t=this.candidates;if(!t)return m;const e=this.candidatePrims(t),s=1/this.scale,i=this.planWidth,o=this.planHeight,n=t.walls.find(r=>r.id===this.selectedCandidateId),a=this.candDrag;return d`<g class="cand-hits">
      ${e.map(r=>{const c=()=>this.candHover=r.id,l=()=>this.candHover=null;return r.kind==="wall"?d`<polyline class="hit" data-cand-hit=${r.id} points=${I(r.points)} stroke-width=${Math.max(r.width,12*s)} @click=${h=>this.pickCandidate(r.id,h)} @pointerenter=${c} @pointerleave=${l} />`:r.kind==="door"||r.kind==="window"||r.kind==="passage"?d`<line class="hit" data-cand-hit=${r.id} x1=${r.gap[0][0]} y1=${r.gap[0][1]} x2=${r.gap[1][0]} y2=${r.gap[1][1]} stroke-width=${14*s} @click=${h=>this.pickCandidate(r.id,h)} @pointerenter=${c} @pointerleave=${l} />`:m})}
      ${n&&this.candidateEditable?n.polyline.map((r,c)=>d`<circle class="cvtx" data-cand-vertex=${c} cx=${r[0]*i} cy=${r[1]*o} r=${6*s} stroke-width=${1.6*s} aria-label=${F("קצה מועמד {n}",{n:c+1})}
          @pointerdown=${l=>this.onCandDragStart(n.id,c,l)} @click=${l=>l.stopPropagation()} />`):m}
      ${a?d`<circle class="gdrag" cx=${a.x*i} cy=${a.y*o} r=${5*s} stroke-width=${1.5*s} />`:m}
    </g>`}renderGhost(){const t=this.ghost;if(!t)return m;const e=st(t,this.planWidth,this.planHeight),s=1/this.scale,i=this.planWidth,o=this.planHeight,n=e.find(h=>h.kind==="door"),a=t.walls.find(h=>h.id.startsWith("ghost-wall")),r=this.ghostNote,c=(r.length*7+18)*s;let l=null;if(n){const h=[(n.gap[0][0]+n.gap[1][0])/2,(n.gap[0][1]+n.gap[1][1])/2],p=n.leaves[0]?.[1]??h,u=n.gap[1][0]-n.gap[0][0],y=n.gap[1][1]-n.gap[0][1],b=Math.hypot(u,y)||1;let w=-y/b,M=u/b;(p[0]-h[0])*w+(p[1]-h[1])*M>0&&(w=-w,M=-M);const k=Math.max(0,...e.filter(S=>S.kind==="wall").map(S=>S.width))/2+Math.abs(w)*(c/2+8*s)+Math.abs(M)*18*s;l=[h[0]+w*k,h[1]+M*k+10*s]}return d`<g class="ghost" data-door-ghost data-ghost-new-wall=${a?"yes":"no"}>
        ${e.filter(h=>h.kind==="wall"&&!!a&&h.id===a.id).map(h=>d`<polyline class="gwall" points=${I(h.points)} stroke-width=${Math.max(h.width,2*s)} />`)}
        ${n?d`<line class="ggap" x1=${n.gap[0][0]} y1=${n.gap[0][1]} x2=${n.gap[1][0]} y2=${n.gap[1][1]} stroke-width=${1.2*s} />
          ${n.leaves.map(([h,p])=>d`<line class="gleaf" data-ghost-leaf x1=${h[0]} y1=${h[1]} x2=${p[0]} y2=${p[1]} stroke-width=${2*s} />`)}
          ${n.arcs.map(h=>d`<path class="garc" d=${`M ${h.from[0]} ${h.from[1]} A ${h.r} ${h.r} 0 0 ${h.sweep} ${h.to[0]} ${h.to[1]}`} stroke-width=${1.4*s} />`)}`:m}
        ${l&&r?d`<g class="ghost-note ${this.ghostWarn?"warn":""}" data-ghost-note><rect x=${l[0]-c/2} y=${l[1]-34*s} width=${c} height=${20*s} rx=${10*s} stroke-width=${s} /><text x=${l[0]} y=${l[1]-24*s} font-size=${12*s}>${r}</text></g>`:m}
      </g>
      <g class="ghost-hits">
        ${n?d`<line class="hit" data-ghost-accept x1=${n.gap[0][0]} y1=${n.gap[0][1]} x2=${n.gap[1][0]} y2=${n.gap[1][1]} stroke-width=${24*s}
            @pointerdown=${h=>h.stopPropagation()} @click=${h=>this.ghostEvent(h,{id:"accept",phase:"click"})}><title>${F("אישור הדלת (Enter)")}</title></line>`:m}
        ${this.ghostHandles.map(h=>{const p=h.at[0]*i,u=h.at[1]*o;if(h.id==="width"){const y=6*s;return d`<rect class="ghandle drag" data-ghost-handle="width" x=${p-y} y=${u-y} width=${2*y} height=${2*y} stroke-width=${1.6*s} role="slider" aria-label=${h.label}
              @pointerdown=${b=>this.onGhostDrag(b)} @click=${b=>b.stopPropagation()}><title>${h.label}</title></rect>`}return d`<g data-ghost-handle=${h.id}><circle class="ghandle" cx=${p} cy=${u} r=${9*s} stroke-width=${1.6*s} role="button" aria-label=${h.label}
              @pointerdown=${y=>y.stopPropagation()} @click=${y=>this.ghostEvent(y,{id:h.id,phase:"click"})}><title>${h.label}</title></circle>
            <text class="gglyph" x=${p} y=${u} font-size=${11*s}>${h.id==="hinge"?"⇄":"⇅"}</text></g>`})}
      </g>`}ghostEvent(t,e){t.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("ghost-handle",{detail:e,bubbles:!0,composed:!0}))}onGhostDrag(t){if(t.button!==0)return;t.stopPropagation(),t.preventDefault(),this.releaseFieldFocus();const e=this.getBoundingClientRect();let s=!1;this.viewport.setPointerCapture(t.pointerId);const i=(r,c)=>{const l=this.toPlan(c.clientX-e.left,c.clientY-e.top);this.dispatchEvent(new CustomEvent("ghost-handle",{detail:{id:"width",phase:r,x:+l.x.toFixed(5),y:+l.y.toFixed(5)},bubbles:!0,composed:!0}))},o=r=>{s=!0,i("move",r)},n=r=>{s&&i("end",r),this.swallowClick()},a=()=>this.swallowClick();W(this.viewport,{move:o,commit:n,cancel:a})}renderWallDraft(){const t=this.wallDraft,e=this.hoverPoint,s=this.arcPreview,i=this.curveDraft;if(!t.length&&!e&&!s.length&&!i.length)return m;const o=1/this.scale,n=this.planWidth,a=this.planHeight,r=[...t,...e&&t.length?[e]:[]].map(c=>`${c[0]*n},${c[1]*a}`).join(" ");return d`<g class="wdraft" pointer-events="none">
      ${s.length?d`<polyline data-arc-preview data-curve-preview points=${s.map(c=>`${c[0]*n},${c[1]*a}`).join(" ")} stroke-width=${2*o} stroke-dasharray=${`${6*o} ${4*o}`} />`:m}
      ${i.map((c,l)=>d`<circle data-curve-draft-point=${l} cx=${c[0]*n} cy=${c[1]*a} r=${(l===0&&i.length>=3?6:4)*o} stroke-width=${1.5*o} />`)}
      ${t.length?d`<polyline points=${r} stroke-width=${2*o} stroke-dasharray=${`${6*o} ${4*o}`} />`:m}
      ${t.map(c=>d`<circle cx=${c[0]*n} cy=${c[1]*a} r=${3.5*o} stroke-width=${1.5*o} />`)}
      ${e?d`<circle class="snap" data-hover-point cx=${e[0]*n} cy=${e[1]*a} r=${4.5*o} stroke-width=${1.5*o} />`:m}
    </g>`}renderGrid(){const t=this.gridStep,e=this.planWidth,s=this.planHeight;if(!(t>0)||!(e>0)||!(s>0))return m;let i=1;for(;t*i*this.scale<Ve&&i<1024;)i*=2;const o=`${t}:${i}:${e}:${s}`;if(this.gridCache?.key!==o){const n=t*i,a=[];for(let r=0;r*n<=e+1e-6;r++)a.push(`M${+(r*n).toFixed(2)} 0V${s}`);for(let r=0;r*n<=s+1e-6;r++)a.push(`M0 ${+(r*n).toFixed(2)}H${e}`);this.gridCache={key:o,d:a.join(""),every:i}}return d`<path class="grid" data-grid data-grid-px=${String(t)} data-grid-every=${String(this.gridCache.every)} d=${this.gridCache.d} />`}renderGuides(){if(!this.guides.length)return m;const t=this.planWidth,e=this.planHeight;return d`<g class="guides" pointer-events="none">${this.guides.map(s=>s.axis==="x"?d`<line class="guide" data-guide="x" data-at=${String(s.at)} x1=${s.at} y1="0" x2=${s.at} y2=${e} />`:d`<line class="guide" data-guide="y" data-at=${String(s.at)} x1="0" y1=${s.at} x2=${t} y2=${s.at} />`)}</g>`}renderRulers(){if(!this.rulers.length)return m;const t=1/this.scale,e=this.planWidth,s=this.planHeight;return d`<g class="rulers" pointer-events="none">
      ${this.rulers.map(i=>{const o=i.a[0]*e,n=i.a[1]*s,a=i.b[0]*e,r=i.b[1]*s,c=(o+a)/2,l=(n+r)/2,h=(i.label.length*7+14)*t;return d`<g class="ruler ${i.tone}" data-ruler>
          <line x1=${o} y1=${n} x2=${a} y2=${r} stroke-width=${2*t} stroke-dasharray=${i.tone==="muted"?`${4*t} ${3*t}`:m} />
          <circle cx=${o} cy=${n} r=${3.5*t} stroke-width=${1.5*t} />
          <circle cx=${a} cy=${r} r=${3.5*t} stroke-width=${1.5*t} />
          ${i.label?d`<rect x=${c-h/2} y=${l-11*t} width=${h} height=${22*t} rx=${11*t} stroke-width=${t} /><text x=${c} y=${l} font-size=${12*t}>${i.label}</text>`:m}
        </g>`})}
    </g>`}renderFloorImage(){const t=this.floorImage;if(!t||this.hideFloorImage||!t.off&&!t.on)return m;const e=this.planWidth,s=this.planHeight,i=Re(ct(t.corners,e,s)),o=t.off??t.on,n=t.off&&t.on?this.zones.filter(r=>this.roomStates?.rooms[r.id]?.lit):[],a=`fi-lit-${this.floorImageSeq}`;return d`<g data-floor-image class="floor-image" opacity=${t.opacity??1} transform=${i}>
      <image data-floor-image-off href=${o} x="0" y="0" width=${e} height=${s} preserveAspectRatio="none" />
      ${n.length?d`<clipPath id=${a} clipPathUnits="userSpaceOnUse">${n.map(r=>d`<polygon points=${this.litClipPoints(r)} />`)}</clipPath>
        <image data-floor-image-on href=${t.on} x="0" y="0" width=${e} height=${s} preserveAspectRatio="none" clip-path="url(#${a})" />`:m}
    </g>`}litClipPoints(t){const e=this.floorImage,s=ct(e.corners,this.planWidth,this.planHeight),i=s.a*s.d-s.b*s.c||1;return t.polygon.map(o=>{const n=o.x*this.planWidth-s.e,a=o.y*this.planHeight-s.f;return`${((s.d*n-s.c*a)/i).toFixed(1)},${((-s.b*n+s.a*a)/i).toFixed(1)}`}).join(" ")}render(){return Bt`
      <div class="viewport ${this.placing?"placing":""} ${this.boxSelect?"boxing":""} ${this.marquee?"marquee":""} ${this.panActive?"spacepan":""}" data-space-pan=${this.panActive?"on":m} @wheel=${this.onWheel} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
           @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp} @click=${this.onBackgroundClick}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label=${F("תוכנית קומה")}>
          <defs><marker id="sw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path class="carrowhead" d="M0 0L10 5L0 10z" /></marker>
            <pattern id="sw-glass-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><rect class="glass-hatch-bg" width="4" height="4" /><line class="glass-hatch-line" x1="0" y1="0" x2="0" y2="4" /></pattern></defs>
          <g transform="translate(${this.tx} ${this.ty}) scale(${this.scale})">
            ${this.imageUrl&&!this.hideImage?d`<image data-plan-image href=${this.imageUrl} x="0" y="0" width=${this.planWidth} height=${this.planHeight} preserveAspectRatio="none" />`:this.imageUrl?d`<rect class="sheet" data-plan-sheet x="0" y="0" width=${this.planWidth} height=${this.planHeight} />`:m}
            ${this.plan??m}
            ${this.renderFloorImage()}
            ${this.renderGrid()}
            ${this.zones.map(t=>this.renderZone(t))}
            ${this.renderSharedOutlines()}
            ${this.renderStructure()}
            ${this.renderGeomHits()}
            ${this.renderCandidates()}
            ${this.renderCandidateHits()}
            ${this.renderGhost()}
            ${(()=>{const t=this.clustered();return d`${t.singles.map(e=>this.renderMarker(e))}${t.clusters.map(e=>this.renderCluster(e))}`})()}
            ${this.renderDraft()}
            ${this.renderWallDraft()}
            ${this.renderRulers()}
            ${this.renderGuides()}
          </g>
          ${this.box?d`<rect class="box" data-box x=${this.box.x0.toFixed(1)} y=${this.box.y0.toFixed(1)} width=${(this.box.x1-this.box.x0).toFixed(1)} height=${(this.box.y1-this.box.y0).toFixed(1)} />`:m}
        </svg>
      </div>
      <div class="zoomdock">
        <div class="controls" role="group" aria-label=${F("זום")}>
          <sw-button variant="ghost" size="sm" iconOnly icon="plus" label=${B("floor.zoomIn")} @click=${()=>this.zoomBy(1.25)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="minus" label=${B("floor.zoomOut")} @click=${()=>this.zoomBy(.8)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="fit" label=${B("floor.fit")} @click=${()=>{this.fitted=!1,this.fit()}}></sw-button>
        </div>
        <div class="scale" aria-live="polite">${Math.round(this.scale*100)}%</div>
      </div>
    `}};f.styles=_t`
    :host {
      display: block;
      position: relative;
      direction: ltr;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 320px;
      background: var(--sw-map-bg);
      overflow: hidden;
      touch-action: none;
      user-select: none;
      border-radius: inherit;
    }
    .viewport {
      position: absolute;
      inset: 0;
      cursor: grab;
    }
    .viewport.dragging {
      cursor: grabbing;
    }
    .viewport.boxing {
      cursor: crosshair;
    }
    .viewport.marquee:not(.dragging):not(.spacepan) {
      cursor: default; /* a drag on the plan draws the selection rectangle here, it does not pan (T085 multi-select) */
    }
    /* the plan picture hidden: a plain sheet of the plan's size on the map ground, edged by a hairline at every zoom */
    rect.sheet {
      fill: var(--sw-surface);
      stroke: var(--sw-border-strong);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    /* T085: the grid (a hairline at every zoom, under the drawing) and the alignment guides of a drag (over it) */
    path.grid {
      fill: none;
      stroke: var(--sw-border-strong);
      stroke-opacity: 0.55;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    line.guide {
      stroke: var(--sw-danger);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    rect.box {
      fill: color-mix(in srgb, var(--sw-accent) 14%, transparent);
      stroke: var(--sw-accent);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      pointer-events: none;
    }
    .viewport.placing {
      cursor: crosshair;
    }
    .handle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      stroke-width: 1.6;
      cursor: grab;
    }
    .handle:active {
      cursor: grabbing;
    }
    .handle.mid {
      fill: var(--sw-accent);
      stroke: var(--sw-surface);
      opacity: 0.8;
      cursor: copy;
    }
    .handle.range {
      fill: var(--sw-accent);
      stroke: #fff;
      cursor: ns-resize;
    }
    .handle-line {
      stroke: var(--sw-accent);
      stroke-width: 1;
      stroke-dasharray: 3 3;
      opacity: 0.7;
      pointer-events: none;
    }
    svg {
      inline-size: 100%;
      block-size: 100%;
      display: block;
    }
    .marker {
      cursor: pointer;
      outline: none;
    }
    .marker.editable {
      cursor: grab;
    }
    .marker.editable:active {
      cursor: grabbing;
    }
    .marker .halo {
      fill: var(--sw-accent);
      opacity: 0;
      pointer-events: none; /* an invisible halo must never steal clicks from a neighbouring pin */
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .marker.selected .halo,
    .marker:focus-visible .halo,
    .marker:hover .halo {
      opacity: 0.18;
    }
    .marker .pin {
      stroke: #fff;
      stroke-width: 2.5;
      filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.28));
    }
    .marker.neutral .pin {
      stroke: var(--sw-border-strong);
      stroke-width: 1.5;
    }
    .marker .icon {
      fill: none;
      stroke: #fff;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .marker.neutral .icon {
      stroke: var(--sw-text);
    }
    .marker.stale .pin,
    .marker.partial .pin,
    .marker.unknown .pin {
      stroke-dasharray: 3 2;
    }
    .marker.cluster .pin {
      stroke: var(--sw-surface);
    }
    .marker.cluster .count {
      fill: #fff;
      font: 700 12px var(--sw-font, inherit);
      text-anchor: middle;
      dominant-baseline: central;
      pointer-events: none;
      direction: ltr;
    }
    .marker.cluster .ring {
      fill: none;
      stroke: var(--sw-accent);
      stroke-width: 1.5;
      opacity: 0.45;
      pointer-events: none;
    }
    .marker.dimmed {
      opacity: 0.55;
    }
    /* the label pills drawn over the plan (a device name, a room name, a temperature, a shared room, the tribune entry) are opaque (owner 2026-10-13,
       styles/menu-surface.ts): they were glass or a white 92 % that carried the dark scheme's light ink */
    .marker .lbl-bg {
      fill: var(--sw-menu-surface);
      filter: drop-shadow(0 1px 3px rgba(15, 23, 42, 0.18));
      pointer-events: none;
    }
    .marker .lbl {
      pointer-events: none;
      font-family: var(--sw-font);
      font-size: 11px;
      font-weight: 600;
      fill: var(--sw-text);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .zone {
      cursor: pointer;
      outline: none;
    }
    .zone polygon {
      fill: var(--zc);
      fill-opacity: 0.1;
      stroke: var(--zc);
      stroke-opacity: 0.7;
      stroke-linejoin: round;
      transition: fill-opacity var(--sw-t-fast) var(--sw-ease);
    }
    .zone:hover polygon,
    .zone:focus-visible polygon,
    .zone.selected polygon {
      fill-opacity: 0.22;
      stroke-opacity: 1;
    }
    .zone.candidate polygon {
      stroke-dasharray: 6 4;
      fill-opacity: 0.14;
    }
    /* the state layer (CR-006 1b): tints over the zone's own fill, no pointer events of their own */
    .zone .tint {
      pointer-events: none;
      stroke: none;
    }
    .zone .tint[data-room-tint='lit'] {
      fill: var(--sw-map-lit);
      fill-opacity: 0.45;
    }
    /* the full blue fill only in a room that is not lit; the inset edge band always (the same cue on a lit room) */
    .zone .tint[data-room-tint='presence'] {
      fill: var(--sw-map-presence);
      fill-opacity: calc(0.3 * var(--fade, 1));
    }
    .zone .tint[data-room-tint='presence-edge'] {
      fill: none;
      stroke: var(--sw-map-presence);
      stroke-opacity: calc(0.85 * var(--fade, 1));
      stroke-linejoin: round;
    }
    .zone .tchip {
      pointer-events: none;
    }
    .zone .tchip rect {
      fill: var(--sw-menu-surface);
      stroke: var(--sw-map-temp);
      stroke-opacity: 0.35;
      stroke-width: 1;
    }
    .zone .tchip text {
      font-family: var(--sw-font);
      font-size: 11px;
      font-weight: 600;
      fill: var(--sw-map-temp);
      text-anchor: middle;
      direction: ltr;
    }
    .opening .open-mark {
      stroke: var(--sw-danger);
      stroke-linecap: round;
      fill: none;
      pointer-events: none;
      filter: drop-shadow(0 0 calc(3px * var(--inv, 1)) var(--sw-danger));
    }
    .opening .open-wedge {
      fill: var(--sw-danger);
      fill-opacity: 0.2;
      stroke: var(--sw-danger);
      stroke-opacity: 0.6;
      pointer-events: none;
    }
    .opening .open-dot {
      fill: var(--sw-danger);
      stroke: var(--sw-surface);
      pointer-events: none;
    }
    .zone .zchip {
      pointer-events: none;
    }
    .shared-other {
      pointer-events: none;
    }
    .shared-other polygon {
      fill: none;
      stroke: var(--sw-accent);
      stroke-opacity: 0.75;
    }
    .shared-other.upper polygon {
      fill: var(--sw-accent);
      fill-opacity: 0.07;
    }
    .shared-other rect {
      fill: var(--sw-menu-surface);
      stroke: var(--sw-accent);
      stroke-opacity: 0.5;
      stroke-width: 1;
    }
    .tribune-entry {
      pointer-events: none;
    }
    .tribune-entry circle {
      fill: var(--sw-accent);
      stroke: #fff;
      stroke-width: 1.5;
    }
    .tribune-entry path {
      fill: none;
      stroke: #fff;
      stroke-width: 1.6;
    }
    .tribune-entry rect {
      fill: var(--sw-menu-surface);
      stroke: var(--sw-accent);
      stroke-opacity: 0.6;
      stroke-width: 1;
    }
    .tribune-entry text {
      font-family: var(--sw-font);
      font-size: 10px;
      font-weight: 600;
      fill: var(--sw-text);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .shared-other text {
      font-family: var(--sw-font);
      font-size: 10px;
      font-weight: 600;
      fill: var(--sw-text-2);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    /* PRESENCE-2280 (mockup round 7): the occupancy chip - green only for "active", neutral solid for empty, dashed for "no data" */
    .zone .zchip[data-tone='occupied'] rect {
      fill: color-mix(in srgb, var(--sw-success) 20%, var(--sw-menu-surface));
      stroke: var(--sw-success-text);
      stroke-opacity: 0.55;
      stroke-dasharray: none;
    }
    .zone .zchip[data-tone='occupied'] text {
      fill: var(--sw-success-text);
      font-weight: 700;
    }
    .zone .zchip[data-tone='occupied'] .pi {
      fill: none;
      stroke: var(--sw-success-text);
      stroke-width: 1.2;
      stroke-linecap: round;
    }
    .zone .zchip[data-tone='clear'] rect {
      fill: var(--sw-menu-surface);
      stroke: var(--sw-border-strong, var(--sw-border));
      stroke-opacity: 1;
      stroke-dasharray: none;
    }
    .zone .zchip[data-tone='unknown'] rect {
      fill: var(--sw-menu-surface);
      stroke: var(--sw-text-3);
      stroke-opacity: 0.9;
    }
    .zone .zchip[data-tone='unknown'] text {
      fill: var(--sw-text-3);
    }
    .zone .ptint {
      pointer-events: none;
      stroke: none;
      fill: var(--sw-success);
      fill-opacity: 0.16;
    }
    .zone .zchip rect {
      fill: color-mix(in srgb, var(--zc) 14%, var(--sw-menu-surface));
      fill-opacity: 1;
      stroke: var(--zc);
      stroke-opacity: 0.6;
      stroke-width: 1;
      stroke-dasharray: 3 2;
    }
    .zone .zchip text {
      font-family: var(--sw-font);
      font-size: 10px;
      font-weight: 600;
      fill: var(--sw-text-2);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .zone .zl-bg {
      fill: var(--sw-menu-surface);
      stroke: var(--zc);
      stroke-opacity: 0.55;
      stroke-width: 1;
      pointer-events: none;
    }
    .zone .zl {
      pointer-events: none;
      font-family: var(--sw-font);
      font-size: 11.5px;
      font-weight: 600;
      fill: var(--sw-text);
      text-anchor: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .vtx {
      fill: var(--sw-surface);
      stroke: var(--zc);
      cursor: grab;
    }
    .vtx:active {
      cursor: grabbing;
    }
    .vtx.on {
      fill: var(--zc);
    }
    .zone.selected.movable polygon {
      cursor: move; /* the selected zone moves as a whole by its body (0.1.87) */
    }
    .vmid {
      fill: var(--zc);
      fill-opacity: 0.55;
      stroke: var(--sw-surface);
      cursor: copy;
    }
    .draft polyline,
    .draft polygon {
      fill: var(--sw-accent);
      fill-opacity: 0.12;
      stroke: var(--sw-accent);
      stroke-dasharray: 5 4;
      stroke-linejoin: round;
    }
    .draft polyline {
      fill: none;
    }
    .draft circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .structure {
      pointer-events: none;
    }
    .structure .wall {
      fill: none;
      stroke: var(--sw-map-structure);
      stroke-linecap: butt;
      stroke-linejoin: miter;
    }
    /* Window walls (document 2.1): the frame band keeps the structure colour, the pane band inside is the glass colour
       over the canvas with a diagonal hatch (the pattern sw-glass-hatch), the centre line and the mullions on top. */
    .structure .gpane {
      fill: none;
      stroke: url(#sw-glass-hatch);
      stroke-linecap: butt;
      stroke-linejoin: miter;
    }
    .structure .gline {
      fill: none;
      stroke: var(--sw-map-glass);
      stroke-linecap: butt;
    }
    .structure .mullion {
      stroke: var(--sw-map-structure);
      stroke-linecap: butt;
    }
    .structure .operable {
      stroke: var(--sw-accent);
    }
    .glass-hatch-bg {
      fill: color-mix(in srgb, var(--sw-map-glass) 22%, var(--sw-surface));
    }
    .glass-hatch-line {
      stroke: var(--sw-map-glass);
      stroke-width: 0.9;
    }
    .structure .glazing.sel .mullion,
    .structure .glasswall.sel .gline {
      stroke: var(--sw-accent);
    }
    .structure .glazing.issue .mullion,
    .structure .glasswall.issue .gline {
      stroke: var(--sw-danger);
    }
    .structure .leaf,
    .structure .arc {
      fill: none;
      stroke: var(--sw-accent);
    }
    .structure .glass {
      stroke: var(--sw-map-glass);
    }
    .structure .gapline {
      stroke: var(--sw-map-structure);
    }
    .structure .glabel {
      fill: var(--sw-map-label);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    /* Selection, then validation issues: same specificity, so an item that is both shows the issue red. */
    .structure .sel .wall {
      stroke: var(--sw-accent);
    }
    .structure .opening.sel {
      filter: drop-shadow(0 0 2px var(--sw-accent));
    }
    .structure .opening.sel .leaf,
    .structure .opening.sel .arc,
    .structure .opening.sel .glass,
    .structure .opening.sel .gapline {
      stroke: var(--sw-accent-hover);
    }
    .structure .glabel.sel {
      fill: var(--sw-accent);
    }
    .structure .issue .wall,
    .structure .opening.issue .leaf,
    .structure .opening.issue .arc,
    .structure .opening.issue .glass,
    .structure .opening.issue .gapline {
      stroke: var(--sw-danger);
    }
    .structure .glabel.issue {
      fill: var(--sw-danger);
    }
    /* T085: connectors (a wide translucent band along the polyline, an arrow, the level delta) and objects (a tinted
       footprint in the item's colour, a symbol, an optional label); a lamp glows while its circuit's switch is on. */
    .structure .conn .cbody {
      fill: none;
      stroke: var(--sw-map-structure);
      stroke-opacity: 0.22;
      stroke-linecap: butt;
    }
    .structure .conn .carrow {
      fill: none;
      stroke: var(--sw-map-structure);
    }
    .carrowhead {
      fill: var(--sw-map-structure);
    }
    /* T085 stairs: flights with a line per riser, a plain landing, the walking line with its start dot and arrow, the
       break line across the first flight (the plan convention) */
    .structure .stair .sflight,
    .structure .stair .slanding {
      fill: color-mix(in srgb, var(--sw-map-structure) 7%, transparent);
      stroke: var(--sw-map-structure);
      stroke-linejoin: round;
    }
    .structure .stair .slanding {
      fill: color-mix(in srgb, var(--sw-map-structure) 12%, transparent);
    }
    .structure .stair .stread {
      stroke: var(--sw-map-structure);
      stroke-opacity: 0.75;
    }
    .structure .stair .swalk,
    .structure .stair .sbreak {
      fill: none;
      stroke: var(--sw-map-structure);
    }
    .structure .stair .sstart {
      fill: var(--sw-map-structure);
    }
    .structure .stair.sel .sflight,
    .structure .stair.sel .slanding {
      stroke: var(--sw-accent);
    }
    .structure .stair .scap {
      font-weight: 500;
    }
    .structure .conn .clabel,
    .structure .obj .olabel {
      fill: var(--sw-map-label);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .structure .obj .fp {
      fill: var(--oc);
      fill-opacity: 0.18;
      stroke: var(--oc);
    }
    .structure .obj .step {
      stroke: var(--oc);
    }
    .structure .obj .sym {
      fill: none;
      stroke: var(--oc);
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .structure .obj[data-circuit] .fp {
      stroke: var(--kc, var(--oc));
      stroke-width: calc(2px * var(--inv, 1));
    }
    .structure .obj.glow .fp {
      fill: var(--sw-map-glow);
      fill-opacity: 0.6;
      stroke: var(--sw-map-glow);
      filter: drop-shadow(0 0 calc(6px * var(--inv, 1)) var(--sw-map-glow));
    }
    .structure .obj.sel .fp {
      stroke: var(--sw-accent);
      stroke-width: calc(2px * var(--inv, 1));
    }
    .structure .obj.issue .fp {
      stroke: var(--sw-danger);
    }
    .structure .conn.sel .cbody,
    .structure .conn.sel .carrow {
      stroke: var(--sw-accent);
    }
    .structure .conn.issue .cbody {
      stroke: var(--sw-danger);
    }
    .geom-hits .hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: stroke;
      cursor: pointer;
    }
    .geom-hits circle.hit {
      pointer-events: all;
      cursor: grab;
    }
    .geom-hits line.hit {
      cursor: grab; /* an opening slides along its wall, whatever the wall's direction */
    }
    .geom-hits .ohit {
      pointer-events: all;
      cursor: move;
    }
    .geom-hits path.hit {
      pointer-events: stroke;
    }
    .geom-hits .hit.whit {
      cursor: move; /* the selected wall moves as a whole by its body (0.1.87) */
    }
    .candidates {
      pointer-events: none;
    }
    .candidates .cwall {
      fill: none;
      stroke: var(--sw-map-candidate);
      stroke-linecap: butt;
      stroke-dasharray: 8 5;
      opacity: 0.85;
    }
    .candidates .cleaf,
    .candidates .carc,
    .candidates .cglass,
    .candidates .cgap {
      fill: none;
      stroke: var(--sw-map-candidate);
      stroke-dasharray: 5 4;
    }
    /* detector 1.4: an object candidate (a tribune, a column) - its outline and a tribune's rows, dashed */
    .candidates .cobj,
    .candidates .crow {
      fill: none;
      stroke: var(--sw-map-candidate);
      stroke-dasharray: 6 4;
    }
    .candidates .cand.rejected {
      opacity: 0.28;
    }
    /* T087 review: a wall candidate outside the main structure - its own short dash in the warning colour, also when
       selected (the selection keeps it solid-free so the flag stays readable) */
    .candidates .cand.outside .cwall,
    .candidates .cand.outside.sel .cwall {
      stroke: var(--sw-warning);
      stroke-dasharray: 2 4;
    }
    .candidates .cand.sel .cwall {
      opacity: 1;
      stroke-dasharray: none;
    }
    .candidates .cand.sel .cleaf,
    .candidates .cand.sel .carc,
    .candidates .cand.sel .cglass,
    .candidates .cand.sel .cgap {
      stroke-dasharray: none;
    }
    .cand-score rect {
      fill: var(--sw-menu-surface);
      stroke: var(--sw-map-candidate);
    }
    .cand-score text {
      fill: var(--sw-text);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .ghost {
      pointer-events: none;
    }
    .ghost .gwall {
      fill: none;
      stroke: var(--sw-accent);
      stroke-dasharray: 6 4;
      opacity: 0.55;
    }
    .ghost .gleaf,
    .ghost .garc,
    .ghost .ggap {
      fill: none;
      stroke: var(--sw-accent);
      stroke-dasharray: 5 3;
    }
    .ghost-note rect {
      fill: var(--sw-menu-surface);
      stroke: var(--sw-accent);
    }
    .ghost-note.warn rect {
      stroke: var(--sw-warning);
    }
    .ghost-note text {
      fill: var(--sw-text);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .ghost-hits .hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: stroke;
      cursor: pointer;
    }
    .ghost-hits .ghandle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      pointer-events: all;
      cursor: pointer;
    }
    .ghost-hits .ghandle.drag {
      cursor: ew-resize;
    }
    .ghost-hits .gglyph {
      fill: var(--sw-accent);
      font-family: var(--sw-font);
      font-weight: 700;
      text-anchor: middle;
      dominant-baseline: central;
      pointer-events: none;
    }
    .cand-hits .hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: stroke;
      cursor: pointer;
    }
    .cand-hits .cvtx {
      fill: var(--sw-surface);
      stroke: var(--sw-map-candidate);
      pointer-events: all;
      cursor: grab;
    }
    .gvtx {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      cursor: grab;
    }
    .gvtx.on {
      fill: var(--sw-accent);
    }
    .gseg {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      cursor: grab;
    }
    .gseg.on {
      fill: var(--sw-accent);
    }
    .gdrag {
      fill: var(--sw-accent);
      fill-opacity: 0.35;
      stroke: var(--sw-accent);
      pointer-events: none;
    }
    .wdraft polyline {
      fill: none;
      stroke: var(--sw-accent);
    }
    .wdraft circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .wdraft circle.snap {
      fill: var(--sw-accent);
    }
    .ruler line {
      stroke: var(--sw-accent);
    }
    .ruler.muted line {
      stroke: var(--sw-text-2);
    }
    .ruler circle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
    }
    .ruler rect {
      fill: var(--sw-menu-surface);
      stroke: var(--sw-border-strong);
    }
    .ruler text {
      fill: var(--sw-text);
      font-family: var(--sw-font);
      font-weight: 600;
      text-anchor: middle;
      dominant-baseline: middle;
      direction: rtl;
      unicode-bidi: plaintext;
    }
    .fov {
      fill: var(--sw-fov);
      stroke: var(--sw-accent);
      stroke-opacity: 0.25;
      stroke-width: 1;
    }
    .fov.off {
      fill: rgba(154, 163, 181, 0.14);
      stroke: var(--sw-offline);
    }
    /* the zoom buttons and the scale readout stand in one row at the bottom-end corner: the readout follows the buttons' real width (a skin's buttons
       are 26, 36 or 44 px wide - Bubble's 52 px column lay 8 px over a readout fixed at 56 px). While the host's phone sheet (the side list) covers
       the bottom of the plan they stand above it (--hud-bottom, set by the floor map: map/hud-layout.ts). */
    .zoomdock {
      position: absolute;
      left: var(--sw-s-3);
      bottom: var(--hud-bottom, var(--sw-s-3));
      display: flex;
      align-items: flex-end;
      gap: 10px;
      z-index: var(--sw-z-map-ui);
      pointer-events: none; /* the row's own gap takes no drag from the plan */
    }
    .zoomdock > * {
      pointer-events: auto;
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: 2px;
      /* the zoom buttons and the readout float over the drawing: opaque (owner 2026-10-13, styles/menu-surface.ts) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: 10px;
      box-shadow: var(--sw-shadow-2);
      padding: 3px;
    }
    .scale {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      padding: 2px 8px;
      font-family: var(--sw-font-mono);
      box-shadow: var(--sw-shadow-1);
    }
  `;$([x({type:Number})],f.prototype,"planWidth",2);$([x({type:Number})],f.prototype,"planHeight",2);$([x({attribute:!1})],f.prototype,"plan",2);$([x({attribute:!1})],f.prototype,"markers",2);$([x({type:Number})],f.prototype,"clusterThreshold",2);$([x()],f.prototype,"selectedId",2);$([x({attribute:!1})],f.prototype,"selectedIds",2);$([x({type:Boolean})],f.prototype,"dimEntities",2);$([x({type:Boolean})],f.prototype,"alwaysLabel",2);$([x()],f.prototype,"imageUrl",2);$([x({type:Boolean})],f.prototype,"editable",2);$([x({type:Boolean})],f.prototype,"placing",2);$([x({type:Number})],f.prototype,"coneRadius",2);$([x({attribute:!1})],f.prototype,"zones",2);$([x()],f.prototype,"selectedZoneId",2);$([x({attribute:!1})],f.prototype,"selectedZoneVertex",2);$([x({type:Boolean})],f.prototype,"zoneLabels",2);$([x({attribute:!1})],f.prototype,"roomStates",2);$([x({attribute:!1})],f.prototype,"draftPoints",2);$([x({type:Boolean})],f.prototype,"boxSelect",2);$([x({attribute:!1})],f.prototype,"geometry",2);$([x()],f.prototype,"structureLevel",2);$([x({attribute:!1})],f.prototype,"issueIds",2);$([x()],f.prototype,"selectedGeomId",2);$([x({attribute:!1})],f.prototype,"highlightIds",2);$([x({type:Boolean})],f.prototype,"multiDrag",2);$([x({type:Boolean})],f.prototype,"marquee",2);$([x({type:Boolean})],f.prototype,"panMode",2);$([x({attribute:!1})],f.prototype,"catalog",2);$([x({attribute:!1})],f.prototype,"anchorPositions",2);$([x({attribute:!1})],f.prototype,"circuitStates",2);$([x({attribute:!1})],f.prototype,"entityStates",2);$([x({type:Boolean})],f.prototype,"hideStructure",2);$([x({type:Boolean})],f.prototype,"hideObjects",2);$([x({type:Boolean})],f.prototype,"hideConnectors",2);$([x({type:Boolean})],f.prototype,"hideImage",2);$([x({attribute:!1})],f.prototype,"floorImage",2);$([x({type:Boolean})],f.prototype,"hideFloorImage",2);$([x({type:Boolean})],f.prototype,"clipCoverage",2);$([x()],f.prototype,"geomDrag",2);$([x({attribute:!1})],f.prototype,"selectedVertex",2);$([x({type:Boolean})],f.prototype,"curveHandles",2);$([x({attribute:!1})],f.prototype,"selectedSegment",2);$([x({attribute:!1})],f.prototype,"arcPreview",2);$([x({attribute:!1})],f.prototype,"curveDraft",2);$([x({type:Boolean})],f.prototype,"curvePointHandles",2);$([x({type:Number})],f.prototype,"cornerSnapPx",2);$([x({attribute:!1})],f.prototype,"wallDraft",2);$([x({attribute:!1})],f.prototype,"hoverPoint",2);$([x({attribute:!1})],f.prototype,"rulers",2);$([x({type:Number})],f.prototype,"gridStep",2);$([x({attribute:!1})],f.prototype,"guides",2);$([x({attribute:!1})],f.prototype,"candidates",2);$([x({attribute:!1})],f.prototype,"candidateStates",2);$([x()],f.prototype,"selectedCandidateId",2);$([x({type:Boolean})],f.prototype,"candidateEditable",2);$([x({attribute:!1})],f.prototype,"ghost",2);$([x()],f.prototype,"ghostNote",2);$([x({type:Boolean})],f.prototype,"ghostWarn",2);$([x({attribute:!1})],f.prototype,"ghostHandles",2);$([j()],f.prototype,"candHover",2);$([j()],f.prototype,"candDrag",2);$([j()],f.prototype,"geomDragAt",2);$([j()],f.prototype,"box",2);$([j()],f.prototype,"spacePan",2);$([j()],f.prototype,"scale",2);$([j()],f.prototype,"tx",2);$([j()],f.prototype,"ty",2);$([j()],f.prototype,"hoverId",2);$([j()],f.prototype,"dragging",2);$([j()],f.prototype,"orienting",2);$([j()],f.prototype,"shaping",2);$([j()],f.prototype,"zoneDraft",2);$([Ot(".viewport")],f.prototype,"viewport",2);f=$([Tt("sw-plan-canvas")],f);export{ns as M,zt as a,Qe as b,kt as c,is as d,ss as e,cs as f,us as g,ps as h,ct as i,ds as j,Re as k,We as l,ts as m,os as n,hs as o,Ge as p,as as q,Ue as r,Me as s,ls as t,gs as u,es as v,qe as w,Je as x,rs as y};
