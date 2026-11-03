import{w as d,E as Ht,F as m,G as I,bq as It,a as zt,A as v,dU as A,e as jt,H as Wt}from"./index-22diBytU.js";import{be as Rt,a as _t,bE as bt,bF as kt,aD as lt,bG as ct,bH as At,a4 as q,ax as J,bI as Ot,bJ as ht,bK as _,p as Tt,bL as Bt,bM as ft,bN as Gt,bO as Y,bP as Mt,bQ as Nt,bR as Vt,bS as Xt,bT as Yt,a_ as Zt,bU as Kt,bV as Ut,x as qt,bW as tt,b2 as Jt,e as Qt,f as te,bX as ee,bY as se,bZ as ie,b_ as ne,b$ as oe,c0 as ae,ab as re}from"./shared-space-grpjARZ8.js";import{g as le,O as $t,i as et,h as ce}from"./candidates-CS7-ly_Q.js";const he=60,de=56,pe=2.5,ot=["error","offline","stale","unknown","forbidden","partial","historic","recorded","live","neutral"],vt=t=>{const e=ot.indexOf(t);return e<0?ot.length:e};function ue(t){let e="neutral",s=ot.length;for(const i of t)vt(i)<s&&(s=vt(i),e=i);return e}function ge(t,e){const s=e.threshold??he;if(t.length<=s||e.scale>=(e.maxScale??pe))return{singles:t,clusters:[]};const i=e.cellPx??de,a=new Set(e.keepIds??[]),n=[],o=new Map;for(const c of t){if(a.has(c.id)){n.push(c);continue}const r=Math.floor(c.x*e.planWidth*e.scale/i),h=Math.floor(c.y*e.planHeight*e.scale/i),p=`${r}:${h}`,u=o.get(p);u?u.push(c):o.set(p,[c])}const l=[];for(const c of o.values()){if(c.length===1){n.push(c[0]);continue}const r={};for(const p of c)r[p.state]=(r[p.state]??0)+1;const h=c.map(p=>p.id).sort();l.push({id:`cluster:${h[0]}+${h.length}`,x:c.reduce((p,u)=>p+u.x,0)/c.length,y:c.reduce((p,u)=>p+u.y,0)/c.length,members:c,state:ue(c.map(p=>p.state)),byState:r})}return{singles:n,clusters:l}}function fe(t){return{x0:Math.min(...t.members.map(e=>e.x)),y0:Math.min(...t.members.map(e=>e.y)),x1:Math.max(...t.members.map(e=>e.x)),y1:Math.max(...t.members.map(e=>e.y))}}const $e={box:d`<rect x="5" y="5" width="14" height="14" rx="1.5"/>`,cylinder:d`<circle cx="12" cy="12" r="7"/>`,chair:d`<rect x="7" y="10" width="10" height="7" rx="1.5"/><path d="M7 10V6h10v4M8 17v3M16 17v3"/>`,table:d`<rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M6 16v3M18 16v3"/>`,sofa:d`<path d="M4 11a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6H4z"/><path d="M4 14h16M7 9V7h10v2"/>`,bed:d`<rect x="4" y="9" width="16" height="9" rx="1.5"/><path d="M4 13h16M6 9V6h5v3M6 18v2M18 18v2"/>`,cabinet:d`<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M12 4v16M9 11h1M14 11h1"/>`,lamp:d`<circle cx="12" cy="11" r="5"/><path d="M12 16v3M9 20h6M8 5l1 1M16 5l-1 1"/>`,panel:d`<rect x="6" y="4" width="12" height="16" rx="1"/><path d="M9 8h6M9 11h6M9 14h3"/>`,socket:d`<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M10 10v4M14 10v4"/>`,extinguisher:d`<rect x="9" y="8" width="6" height="12" rx="3"/><path d="M12 8V5M9 5h6M15 9l3-2"/>`,smoke:d`<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 5v2M12 17v2"/>`,exit:d`<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M9 12h7M13 9l3 3-3 3"/>`,aed:d`<path d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.5 12 20 12 20z"/><path d="M12 9l-1.5 3h3L12 15"/>`,medical:d`<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M12 9v6M9 12h6"/>`,goal:d`<rect x="4" y="6" width="16" height="10"/><path d="M4 16v3M20 16v3M8 6v10M12 6v10M16 6v10"/>`,mat:d`<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v8M12 8v8M17 8v8"/>`,stairs:d`<path d="M4 20h4v-4h4v-4h4V8h4"/>`,elevator:d`<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M12 3v18M8 10l1.5-2 1.5 2M14.5 14l1.5 2 1.5-2"/>`,doorstation:d`<rect x="7" y="3" width="10" height="18" rx="2"/><circle cx="12" cy="8" r="2"/><path d="M9 13h6M9 16h6"/>`,tree:d`<circle cx="12" cy="10" r="6"/><path d="M12 16v5M9 21h6"/>`,sanitary:d`<path d="M6 10h12v3a6 6 0 0 1-12 0z"/><path d="M12 10V5M9 5h6"/>`,office:d`<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M8 20h8M12 16v4"/>`,parking:d`<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>`};function ve(t){return $e[Rt.includes(t)?t:"box"]}const me=150,mt=.5,ye=1e-6,Z=4,T=1e-9,F=(t,e)=>[t[0]-e[0],t[1]-e[1]],R=(t,e)=>t[0]*e[0]+t[1]*e[1],Pt=(t,e)=>t[0]*e[1]-t[1]*e[0],dt=t=>Math.hypot(t[0],t[1]),K=t=>{const e=dt(t);return e>T?[t[0]/e,t[1]/e]:[1,0]},O=(t,e)=>Math.atan2(Pt(t,e),R(t,e));function we(t,e){const s=[];for(const i of t){if(!Number.isFinite(i[0])||!Number.isFinite(i[1]))continue;const a=s[s.length-1];a&&Math.hypot(i[0]-a[0],i[1]-a[1])<mt||s.push([i[0],i[1]])}if(e)for(;s.length>1&&Math.hypot(s[0][0]-s[s.length-1][0],s[0][1]-s[s.length-1][1])<mt;)s.pop();return s}function st(t,e,s,i){const a=Pt(F(e,t),F(s,e)),n=t[0],o=t[1],l=e[0]-n,c=e[1]-o,r=s[0]-n,h=s[1]-o,p=2*(l*h-c*r),u=Math.max(R(F(e,t),F(e,t)),R(F(s,t),F(s,t)),1);if(Math.abs(p)<=1e-9*u)return K(F(s,t));const y=l*l+c*c,b=r*r+h*h,w=n+(h*y-c*b)/p,k=o+(l*b-r*y)/p,P=[i[0]-w,i[1]-k],M=a>0?1:-1;return K([-P[1]*M,P[0]*M])}function xe(t,e,s){return O(F(e,t),F(s,e))}function be(t,e){const s=t.length,i=new Array(s),a=new Array(s),n=me*Math.PI/180,o=r=>t[(r%s+s)%s],l=new Array(s).fill(!1);for(let r=0;r<s;r++)!e&&(r===0||r===s-1)||s<3||(l[r]=Math.abs(xe(o(r-1),o(r),o(r+1)))>n);const c=(r,h)=>{const p=o(r+h);if(!(e?s>=3&&!l[((r+h)%s+s)%s]:r+2*h>=0&&r+2*h<s&&!l[r+h]))return K(h===1?F(p,o(r)):F(o(r),p));const y=o(r+2*h);return h===1?st(o(r),p,y,o(r)):st(y,p,o(r),o(r))};for(let r=0;r<s;r++){const h=!e&&(r===0||r===s-1);if(s===2){const u=K(F(o(1),o(0)));i[r]=u,a[r]=u;continue}if(h){const u=r===0?c(0,1):c(s-1,-1);i[r]=u,a[r]=u;continue}if(l[r]){i[r]=c(r,-1),a[r]=c(r,1);continue}const p=st(o(r-1),o(r),o(r+1),o(r));i[r]=p,a[r]=p}return{tin:i,tout:a}}function yt(t,e,s){const i=F(e,t);if(dt(i)<=T)return 0;const a=O(s,i),n=Math.tan(a/2);return Math.abs(n)<1e-9?0:Math.max(-Z,Math.min(Z,n))}function ke(t,e,s){const i=F(e,t);if(dt(i)<=T)return 0;const a=O(i,s),n=Math.tan(a/2);return Math.abs(n)<1e-9?0:Math.max(-Z,Math.min(Z,n))}function Me(t,e,s,i){const a=F(s,t),n=[e[0]+i[0],e[1]+i[1]],o=R(a,a);if(o<=T)return null;const l=R(a,n),c=2*(1-R(e,i));let r;if(Math.abs(c)<=1e-12){const u=R(a,i);if(Math.abs(u)<=1e-12)return[(t[0]+s[0])/2,(t[1]+s[1])/2];r=o/(4*u)}else{const u=l*l+c*o;r=(-l+Math.sqrt(Math.max(0,u)))/c}if(!Number.isFinite(r))return null;const h=[(t[0]+s[0]+r*(e[0]-i[0]))/2,(t[1]+s[1]+r*(e[1]-i[1]))/2],p=Math.sqrt(o);return Math.hypot(h[0]-t[0],h[1]-t[1])<1e-6*p||Math.hypot(h[0]-s[0],h[1]-s[1])<1e-6*p?null:h}function Ct(t,e={}){const s=!!e.closed,i=we(t,s),a=e.round??(y=>y);if(i.length<2)return{pts:i.map(y=>[y[0],y[1]]),bulges:[],through:i.map((y,b)=>b)};const n=s&&i.length>=2;if(n&&i.length===2)return{pts:[i[0],i[1],[i[0][0],i[0][1]]],bulges:[1,1],through:[0,1]};const o=i.length,{tin:l,tout:c}=be(i,n),r=[i[0]],h=[],p=[0],u=n?o:o-1;for(let y=0;y<u;y++){const b=i[y],w=(y+1)%o,k=i[w],P=c[y],M=l[w],E=F(k,b),j=Math.abs(O(P,E)-O(E,M))<=ye?null:Me(b,P,k,M);if(!j)h.push(yt(b,k,P));else{const z=a(j);h.push(yt(b,z,P)),r.push(z),h.push(ke(z,k,M))}r.push(w===0?[i[0][0],i[0][1]]:k),w!==0&&p.push(r.length-1)}return{pts:r,bulges:h,through:p}}function Pe(t){let e=Number.POSITIVE_INFINITY;for(let s=0;s<t.bulges.length;s++){const i=t.bulges[s];if(Math.abs(i)<=T)continue;const n=Math.hypot(t.pts[s+1][0]-t.pts[s][0],t.pts[s+1][1]-t.pts[s][1])*(1+i*i)/(4*Math.abs(i));n<e&&(e=n)}return e}const at=t=>Math.round(t*1e5)/1e5,X=t=>[at(Math.min(1,Math.max(0,t[0]))),at(Math.min(1,Math.max(0,t[1])))],H=(t,e,s)=>[t[0]*e,t[1]*s];function pt(t,e,s,i,a,n,o){const l=bt(kt({...e,polyline:s.map(X)},i),o),{pts:c,bulges:r}=_(l,a,n),h=ct(c,r),p=t.openings.map(u=>{if(u.wall_id!==e.id||!(h>0))return u;const y=H(Tt(e,u.t,a,n),a,n),b=at(Math.min(1,Math.max(0,Bt(c,r,y).s/h)));return b===u.t?u:{...u,t:b}});return{...t,walls:t.walls.map(u=>u.id===e.id?l:u),openings:p}}const W=(t,e)=>t.walls.find(s=>s.id===e);function Ge(t,e,s,i,a,n){const o=W(t,e);if(!o||s<0||s>=o.polyline.length-1)return t;const l=Ot(H(o.polyline[s],a,n),H(i,a,n),H(o.polyline[s+1],a,n));return ut(t,e,s,l,a,n)}function ut(t,e,s,i,a,n){const o=W(t,e);if(!o||s<0||s>=o.polyline.length-1||!Number.isFinite(i))return t;const l=ht(o),c=Math.abs(i)<1e-4?0:Math.max(-ft,Math.min(ft,Math.round(i*1e6)/1e6));return l[s]===c?t:(l[s]=c,pt(t,o,o.polyline,l,a,n))}const Ne=(t,e,s,i,a)=>ut(t,e,s,0,i,a);function Ve(t,e,s,i,a,n,o){const l=W(t,e);if(!l||s<0||s>=l.polyline.length-1||!(i>0)||!(a>0))return null;const c=ht(l)[s],r=Nt(H(l.polyline[s],n,o),H(l.polyline[s+1],n,o),i/a,c<0?-1:1,Math.abs(c)>1);return r===null?null:ut(t,e,s,r,n,o)}function Xe(t,e,s,i,a){if(e<0||e>=t.polyline.length-1)return null;const n=Gt(H(t.polyline[e],s,i),H(t.polyline[e+1],s,i),ht(t)[e]);return Number.isFinite(n)?n*a:null}function Ye(t,e,s,i,a){const n=H(t.polyline[e],s,i),o=H(t.polyline[e+1],s,i);return Math.hypot(o[0]-n[0],o[1]-n[1])/2*a}function Ze(t,e,s,i,a,n,o){const l=W(t,e);if(!l||!(i>0)||!(a>0))return null;const{pts:c,bulges:r}=_(l,n,o),h=Y(c,r,s,i/a);return h?pt(t,l,h.pts.map(p=>[p[0]/n,p[1]/o]),h.bulges,n,o):null}function Ke(t,e,s,i,a){const{pts:n,bulges:o}=_(t,s,i);let l=0,c=1e6;if(!Y(n,o,e,1e-6))return 0;for(let r=0;r<60;r++){const h=(l+c)/2;Y(n,o,e,h)?l=h:c=h}return l*a}function Ce(t,e,s,i){const{pts:a,bulges:n}=_(t,s,i),o=a[e],l=a[e+1],{p:c}=Mt([o,l],[n[e]],ct([o,l],[n[e]])/2);return[c[0]/s,c[1]/i]}function Ue(t,e,s,i){const{pts:a,bulges:n}=_(t,s,i);return Y(a,n,e,1e-6)!==null}const Et=512,qe=255;function St(t,e,s,i){const a=o=>H(X([o[0]/s,o[1]/i]),s,i),n=Ct(t.map(o=>H(X(o),s,i)),{closed:e,round:a});return{polyline:n.pts.map(o=>X([o[0]/s,o[1]/i])),bulges:n.bulges.map(o=>Math.abs(o)<1e-6?0:Math.round(o*1e6)/1e6),through:n.through}}function Ft(t){const e=q(t);return e?e.map(s=>[t.polyline[s][0],t.polyline[s][1]]):null}function Je(t,e,s,i,a,n){const o=St(e,s,a,n);if(o.through.length<2||o.polyline.length<2||o.polyline.length>Et)return null;const l=_t(t,o.polyline,i),c=l.doc.walls.map(r=>r.id===l.id?bt(kt(r,o.bulges),o.through):r);return{doc:lt({...l.doc,walls:c}),id:l.id}}function gt(t,e,s,i,a){const n=W(t,e);if(!n)return t;const o=St(s,J(n.polyline),i,a);return o.through.length<2||o.polyline.length>Et?t:lt(pt(t,n,o.polyline,o.bulges,i,a,o.through))}function Qe(t,e,s,i,a,n){const o=W(t,e),l=o?Ft(o):null;return!o||!l||s<0||s>=l.length?t:gt(t,e,l.map((c,r)=>r===s?i:c),a,n)}function ts(t,e,s,i,a){const n=W(t,e),o=n?q(n):null;if(!n||!o)return null;const{pts:l,bulges:c}=_(n,s,i),r=Vt(l,c),p=J(n.polyline)?[...o,l.length-1]:o;let u=0,y;{let M=-1;for(let E=0;E<p.length-1;E++){const D=r[p[E+1]]-r[p[E]];D>M&&(M=D,u=E)}y=(r[p[u]]+r[p[u+1]])/2}const b=r[p[u]],w=r[p[u+1]];if(!(y-b>1)||!(w-y>1))return null;const k=Mt(l,c,y,r).p,P=o.map(M=>[n.polyline[M][0],n.polyline[M][1]]);return P.splice(u+1,0,[k[0]/s,k[1]/i]),{doc:gt(t,e,P,s,i),k:u+1}}function es(t,e,s,i,a){const n=W(t,e),o=n?Ft(n):null;if(!n||!o||s<0||s>=o.length)return{doc:t,wallRemoved:!1};const l=o.filter((c,r)=>r!==s);return l.length<2?{doc:lt({...t,walls:t.walls.filter(c=>c.id!==e),openings:t.openings.filter(c=>c.wall_id!==e)}),wallRemoved:!0}:{doc:gt(t,e,l,i,a),wallRemoved:!1}}function ss(t,e){const s=q(t);if(!s)return-1;const i=J(t.polyline);return s.indexOf(i&&e===t.polyline.length-1?0:e)}function is(t,e,s,i,a){const n=Ct(t.map(o=>H(o,s,i)),{closed:e});return n.pts.length<2?{path:[],lengthM:0,minRadiusM:Number.POSITIVE_INFINITY}:{path:At(n.pts,n.bulges,.5).map(o=>[o[0]/s,o[1]/i]),lengthM:ct(n.pts,n.bulges)*a,minRadiusM:Pe(n)*a}}const Lt={modeCurve:"כיפוף",hintCurve:"גרור את הנקודה שבאמצע קטע של הקיר הנבחר כדי לכופף אותו; לחיצה על פינה מאפשרת לעגל אותה. (C)",tipCurve:"כיפוף (C): כיפוף קטע של קיר קיים ועיגול פינות",bendOpen:"כיפוף ועיגול פינות",bendDone:"סיום כיפוף",modeCurved:"קיר מעוגל",hintCurved:'לחץ נקודות לאורך הקשת והקיר נבנה דרכן. לחיצה כפולה, Enter או "סיום" בונים; לחיצה על הנקודה הראשונה סוגרת חדר עגול; Backspace מבטל נקודה; Esc מבטל.',tipCurved:"קיר מעוגל (R): לוחצים נקודות על הקשת והקיר נבנה דרכן",draft:"קיר מעוגל",points:"נקודות",length:"אורך",minRadius:"רדיוס",straightLine:"ישר",finish:"סיום",undoPoint:"בטל נקודה",closeHint:"לחיצה על הנקודה הראשונה סוגרת",pointsWall:"קיר דרך נקודות",pointHandle:"נקודת קשת",addPoint:"הוסף נקודה",removePoint:"הסר נקודה",pointsNote:"גרירת נקודה מעצבת את הקשת מחדש; נקודה נבחרת נמחקת ב-Delete.",segment:"קטע",radius:"רדיוס (מ׳)",straight:"ישר",straighten:"יישור",corner:"פינה",roundCorner:"עיגול פינה",apply:"החל",radiusTooSmall:"הרדיוס קטן מחצי אורך הקטע",cornerCannot:"אי אפשר לעגל את הפינה ברדיוס הזה",segmentHandle:"אמצע קטע",area:"שטח פנימי"},Ee={modeCurve:"Bend",hintCurve:"Drag the dot in the middle of a segment of the selected wall to bend it; click a corner to round it. (C)",tipCurve:"Bend (C): bend a segment of an existing wall and round corners",bendOpen:"Bend and round corners",bendDone:"Done bending",modeCurved:"Curved wall",hintCurved:'Click points along the curve and the wall is built through them. Double-click, Enter or "Finish" builds it; clicking the first point closes a round room; Backspace removes a point; Esc cancels.',tipCurved:"Curved wall (R): click points on the curve and the wall is built through them",draft:"Curved wall",points:"points",length:"Length",minRadius:"Radius",straightLine:"straight",finish:"Finish",undoPoint:"Remove point",closeHint:"clicking the first point closes it",pointsWall:"Wall through points",pointHandle:"Curve point",addPoint:"Add point",removePoint:"Remove point",pointsNote:"Dragging a point reshapes the curve; Delete removes the selected point.",segment:"Segment",radius:"Radius (m)",straight:"Straight",straighten:"Straighten",corner:"Corner",roundCorner:"Round corner",apply:"Apply",radiusTooSmall:"The radius is shorter than half the segment",cornerCannot:"This corner cannot take that radius",segmentHandle:"Segment middle",area:"Enclosed area"},Se={he:Lt,en:Ee};function Fe(){return(typeof document<"u"&&document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function wt(t,e=Fe()){return Se[e][t]??Lt[t]}const B={a:1,b:0,c:0,d:1,e:0,f:0};function Dt(t,e,s){return t===0?{x:0,y:0}:t===1?{x:e,y:0}:t===2?{x:e,y:s}:{x:0,y:s}}function rt(t,e,s){if(!t||t.length!==4||!(e>0)||!(s>0))return B;let i=0,a=0,n=0,o=0,l=0,c=0,r=0,h=0,p=0,u=0,y=0,b=0;for(let x=0;x<4;x++){const C=Dt(x,e,s),S={x:t[x][0]*e,y:t[x][1]*s};if(!Number.isFinite(S.x)||!Number.isFinite(S.y))return B;i+=C.x*C.x,a+=C.x*C.y,n+=C.x,o+=C.y*C.y,l+=C.y,c+=1,r+=C.x*S.x,h+=C.y*S.x,p+=S.x,u+=C.x*S.y,y+=C.y*S.y,b+=S.y}const w=[[i,a,n],[a,o,l],[n,l,c]],k=xt(w,[r,h,p]),P=xt(w,[u,y,b]);if(!k||!P)return B;const[M,E,D]=k,[j,z,g]=P;return![M,j,E,z,D,g].every(Number.isFinite)||Math.abs(M*z-j*E)<1e-9?B:{a:M,b:j,c:E,d:z,e:D,f:g}}function xt(t,e){const s=G(t);if(Math.abs(s)<1e-9)return null;const i=a=>t.map((n,o)=>n.map((l,c)=>c===a?e[o]:l));return[G(i(0))/s,G(i(1))/s,G(i(2))/s]}function G(t){return t[0][0]*(t[1][1]*t[2][2]-t[1][2]*t[2][1])-t[0][1]*(t[1][0]*t[2][2]-t[1][2]*t[2][0])+t[0][2]*(t[1][0]*t[2][1]-t[1][1]*t[2][0])}function Le(t,e){return{x:t.a*e.x+t.c*e.y+t.e,y:t.b*e.x+t.d*e.y+t.f}}function De(t){return`matrix(${[t.a,t.b,t.c,t.d,t.e,t.f].map(e=>+e.toFixed(5)).join(" ")})`}function ns(t,e,s){const i=rt(t,e,s),a=Math.hypot(e,s)||1;let n=0;for(let o=0;o<4;o++){const l=Le(i,Dt(o,e,s)),c={x:t[o][0]*e,y:t[o][1]*s};n=Math.max(n,Math.hypot(l.x-c.x,l.y-c.y)/a)}return n}function os(t,e,s){const i=t.map(a=>[a[0],a[1]]);return i[e]=[U(s.x,-1,2),U(s.y,-1,2)],i}function as(t,e,s){return t.map(i=>[U(i[0]+e,-1,2),U(i[1]+s,-1,2)])}function U(t,e,s){return Math.min(s,Math.max(e,t))}function rs(t){if(!t||t.length!==4)return!0;const e=[[0,0],[1,0],[1,1],[0,1]];return t.every((s,i)=>Math.abs(s[0]-e[i][0])<1e-6&&Math.abs(s[1]-e[i][1])<1e-6)}var He=Object.defineProperty,Ie=Object.getOwnPropertyDescriptor,$=(t,e,s,i)=>{for(var a=i>1?void 0:i?Ie(e,s):e,n=t.length-1,o;n>=0;n--)(o=t[n])&&(a=(i?o(e,s,a):o(a))||a);return i&&a&&He(e,s,a),a};const it=.2,ze=24,je=20,N=6,V={live:"var(--sw-accent)",recorded:"var(--sw-accent)",historic:"var(--sw-accent)",offline:"var(--sw-offline)",stale:"var(--sw-stale)",unknown:"var(--sw-unknown)",forbidden:"var(--sw-forbidden)",error:"var(--sw-danger)",neutral:"var(--sw-surface)",partial:"var(--sw-stale)"},We={camera:d`<path d="M-7 -4.5A1.5 1.5 0 0 1 -5.5 -6H-2l1.5-2h5L6 -6h1.5A1.5 1.5 0 0 1 9 -4.5v9A1.5 1.5 0 0 1 7.5 6h-13A1.5 1.5 0 0 1 -7 4.5z" transform="translate(-1 0) scale(0.9)"/><circle cx="-1" cy="0" r="3"/>`,lock:d`<rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/>`,light:d`<path d="M-3 6h6M-2 8.5h4"/><path d="M0 -8a5 5 0 0 0-3 9c.7.5 1.2 1.3 1.2 2.2h3.6c0-.9.5-1.7 1.2-2.2A5 5 0 0 0 0 -8z"/>`,binary_sensor:d`<circle cx="0" cy="0" r="2"/><path d="M-4.5 -4.5a6.4 6.4 0 0 0 0 9M4.5 -4.5a6.4 6.4 0 0 1 0 9"/>`};function Re(t){let e=0,s=0,i=0;for(let a=0;a<t.length;a++){const n=t[a],o=t[(a+1)%t.length],l=n.x*o.y-o.x*n.y;e+=l,s+=(n.x+o.x)*l,i+=(n.y+o.y)*l}if(Math.abs(e)<1e-12){const a=t.length||1;return{x:t.reduce((n,o)=>n+o.x,0)/a,y:t.reduce((n,o)=>n+o.y,0)/a}}return{x:s/(3*e),y:i/(3*e)}}const L=t=>t.map(e=>`${e[0]},${e[1]}`).join(" "),nt=t=>t.shiftKey===!0,_e=(t,e)=>{if(t===e)return!0;const s=Object.keys(t);return s.length!==Object.keys(e).length?!1:s.every(i=>{const a=t[i],n=e[i];return!!n&&a.x===n.x&&a.y===n.y&&a.rotation===n.rotation})},Ae=8;let f=class extends zt{constructor(){super(...arguments),this.planWidth=1e3,this.planHeight=700,this.plan=null,this.markers=[],this.clusterThreshold=60,this.selectedId=null,this.selectedIds=[],this.dimEntities=!1,this.alwaysLabel=!1,this.imageUrl=null,this.editable=!1,this.placing=!1,this.coneRadius=140,this.zones=[],this.selectedZoneId=null,this.selectedZoneVertex=null,this.zoneLabels=!0,this.roomStates=null,this.draftPoints=[],this.boxSelect=!1,this.geometry=null,this.structureLevel=null,this.issueIds=[],this.selectedGeomId=null,this.highlightIds=[],this.multiDrag=!1,this.marquee=!1,this.panMode=!1,this.catalog=null,this.anchorPositions={},this.circuitStates={},this.entityStates={},this.hideStructure=!1,this.hideObjects=!1,this.hideConnectors=!1,this.hideImage=!1,this.floorImage=null,this.hideFloorImage=!1,this.clipCoverage=!0,this.coverage=new Xt,this.covPoints=new Map,this.primCache=null,this.stairCache=null,this.circuitCache=null,this.geomDrag="none",this.selectedVertex=null,this.curveHandles=!1,this.selectedSegment=null,this.arcPreview=[],this.curveDraft=[],this.curvePointHandles=!1,this.cornerSnapPx=0,this.wallDraft=[],this.hoverPoint=null,this.rulers=[],this.gridStep=0,this.guides=[],this.candidates=null,this.candidateStates={},this.selectedCandidateId=null,this.candidateEditable=!1,this.ghost=null,this.ghostNote="",this.ghostWarn=!1,this.ghostHandles=[],this.candHover=null,this.candDrag=null,this.candCache=null,this.geomDragAt=null,this.geomPress=!1,this.coarse=typeof window<"u"&&!!window.matchMedia?.("(any-pointer: coarse)").matches,this.hoverFrame=0,this.hoverEvent=null,this.box=null,this.boxStart=null,this.boxGeom=null,this.spacePan=!1,this.onSpaceKey=t=>{if(t.code!=="Space"&&t.key!==" ")return;if(t.type==="keyup"){this.spacePan&&(this.spacePan=!1,t.preventDefault());return}if(!this.marquee||t.ctrlKey||t.metaKey||t.altKey)return;const e=t.composedPath(),s=e[0],i=s instanceof Element&&!!s.closest('button, input, select, textarea, a[href], [contenteditable="true"], [contenteditable=""], [role="button"], [role="slider"]');(e.includes(this)&&!i||s===document.body||s===document.documentElement||s===window||s===document)&&(t.preventDefault(),this.spacePan=!0)},this.onSpaceBlur=()=>this.spacePan=!1,this.hlCache=null,this.scale=1,this.tx=0,this.ty=0,this.hoverId=null,this.dragging=null,this.orienting=null,this.shaping=null,this.zoneDraft=null,this.zonePending=null,this.lastVertexPress=null,this.pointers=new Map,this.lastPan=null,this.lastPinchDist=0,this.dragMoved=!1,this.fitted=!1,this.minScale=it,this.onWheel=t=>{t.preventDefault();const e=this.getBoundingClientRect();this.zoomBy(t.deltaY<0?1.15:1/1.15,t.clientX-e.left,t.clientY-e.top)},this.onMarkerPointerDown=(t,e)=>{if(!this.editable||e.button!==0||this.placing||this.panActive)return;e.stopPropagation(),e.preventDefault(),this.dragging={id:t.id,x:t.x,y:t.y},this.viewport.setPointerCapture(e.pointerId);const s=a=>{const n=this.getBoundingClientRect(),o=this.toPlan(a.clientX-n.left,a.clientY-n.top);this.dragging={id:t.id,x:o.x,y:o.y}},i=a=>{this.viewport.removeEventListener("pointermove",s),this.viewport.removeEventListener("pointerup",i),this.viewport.removeEventListener("pointercancel",i);const n=this.getBoundingClientRect(),o=this.toPlan(a.clientX-n.left,a.clientY-n.top),l=Math.abs(o.x-t.x)>5e-4||Math.abs(o.y-t.y)>5e-4;this.dragging=null,l?this.dispatchEvent(new CustomEvent("marker-move",{detail:{id:t.id,x:o.x,y:o.y},bubbles:!0,composed:!0})):this.select(t,a),this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0)};this.viewport.addEventListener("pointermove",s),this.viewport.addEventListener("pointerup",i),this.viewport.addEventListener("pointercancel",i)},this.onPointerDown=t=>{if(this.pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this.dragMoved=!1,t.button===1&&t.preventDefault(),this.pointers.size===1){const e=this.boxSelect&&t.button===0&&!t.shiftKey&&!this.editable&&!this.placing,s=this.marquee&&!this.panActive&&t.button===0&&t.pointerType!=="touch"&&!this.placing;if(e||s){const i=this.getBoundingClientRect();this.boxStart={x:t.clientX-i.left,y:t.clientY-i.top},this.boxGeom=s?{add:t.shiftKey}:null,this.lastPan=null;return}this.lastPan={x:t.clientX,y:t.clientY},this.viewport.classList.add("dragging")}else this.pointers.size===2&&(this.lastPinchDist=this.pinchDistance(),this.lastPan=null,this.boxStart=null,this.boxGeom=null,this.box=null)},this.onPointerMove=t=>{if(this.placing&&!this.geomPress&&t.pointerType!=="touch"&&this.queueHover(t),!!this.pointers.has(t.pointerId)){if(this.pointers.set(t.pointerId,{x:t.clientX,y:t.clientY}),this.pointers.size===2){const e=this.pinchDistance();if(this.lastPinchDist>0){const[s,i]=[...this.pointers.values()],a=this.getBoundingClientRect();this.zoomBy(e/this.lastPinchDist,(s.x+i.x)/2-a.left,(s.y+i.y)/2-a.top)}this.lastPinchDist=e,this.dragMoved=!0;return}if(this.boxStart){const e=this.getBoundingClientRect(),s=t.clientX-e.left,i=t.clientY-e.top;!this.dragMoved&&Math.abs(s-this.boxStart.x)+Math.abs(i-this.boxStart.y)>3&&(this.dragMoved=!0,this.viewport.hasPointerCapture(t.pointerId)||this.viewport.setPointerCapture(t.pointerId)),this.dragMoved&&(this.box={x0:Math.min(this.boxStart.x,s),y0:Math.min(this.boxStart.y,i),x1:Math.max(this.boxStart.x,s),y1:Math.max(this.boxStart.y,i)});return}if(this.lastPan){const e=t.clientX-this.lastPan.x,s=t.clientY-this.lastPan.y;!this.dragMoved&&Math.abs(e)+Math.abs(s)>2&&(this.dragMoved=!0,this.viewport.hasPointerCapture(t.pointerId)||this.viewport.setPointerCapture(t.pointerId)),this.tx+=e,this.ty+=s,this.lastPan={x:t.clientX,y:t.clientY}}}},this.onPointerUp=t=>{if(this.pointers.delete(t.pointerId),this.boxStart&&this.pointers.size===0){const e=this.box,s=this.boxGeom;if(this.boxStart=null,this.boxGeom=null,this.box=null,e&&s&&e.x1-e.x0>=4&&e.y1-e.y0>=4){const i=this.toPlan(e.x0,e.y0),a=this.toPlan(e.x1,e.y1);this.dispatchEvent(new CustomEvent("geom-box",{detail:{x0:i.x,y0:i.y,x1:a.x,y1:a.y,add:s.add},bubbles:!0,composed:!0}))}else if(e&&e.x1-e.x0>=4&&e.y1-e.y0>=4){const i=this.markers.filter(a=>{const n=this.toScreen(a.x,a.y);return n.x>=e.x0&&n.x<=e.x1&&n.y>=e.y0&&n.y<=e.y1}).map(a=>a.id);this.dispatchEvent(new CustomEvent("box-select",{detail:{ids:i},bubbles:!0,composed:!0}))}}if(this.pointers.size===0)this.lastPan=null,this.viewport.classList.remove("dragging");else if(this.pointers.size===1){const[e]=[...this.pointers.values()];this.lastPan={x:e.x,y:e.y}}},this.onBackgroundClick=t=>{if(!(this.dragMoved||this.panActive)){if(this.placing){const e=this.getBoundingClientRect(),s=this.toPlan(t.clientX-e.left,t.clientY-e.top);this.dispatchEvent(new CustomEvent("plan-click",{detail:{x:+s.x.toFixed(4),y:+s.y.toFixed(4),shift:t.shiftKey},bubbles:!0,composed:!0}));return}this.dispatchEvent(new CustomEvent("marker-select",{detail:{id:null},bubbles:!0,composed:!0}))}},this.onHandlePointerDown=(t,e,s)=>{if(!this.editable||s.button!==0||this.panActive)return;s.stopPropagation(),s.preventDefault();const i=this.getBoundingClientRect(),a=t.rotation??0,n=t.fov??90,o=e==="left"?a+n/2:a-n/2;this.orienting={id:t.id,rotation:a,fov:n},this.viewport.setPointerCapture(s.pointerId);const l=h=>{const p=this.bearingTo(t,h.clientX-i.left,h.clientY-i.top);if(e==="dir")return{rotation:Math.round(p),fov:n};let u=e==="left"?o-p:p-o;u=(u%360+360)%360;const y=Math.max(10,Math.min(180,Math.round(u))),b=e==="left"?o-y/2:o+y/2;return{rotation:Math.round((b%360+360)%360),fov:y}},c=h=>{this.orienting={id:t.id,...l(h)}},r=h=>{this.viewport.removeEventListener("pointermove",c),this.viewport.removeEventListener("pointerup",r),this.viewport.removeEventListener("pointercancel",r);const p=l(h);this.orienting=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0),(p.rotation!==a||p.fov!==n)&&this.dispatchEvent(new CustomEvent("marker-orient",{detail:{id:t.id,...p},bubbles:!0,composed:!0}))};this.viewport.addEventListener("pointermove",c),this.viewport.addEventListener("pointerup",r),this.viewport.addEventListener("pointercancel",r)},this.onRangePointerDown=(t,e)=>{if(!this.editable||e.button!==0||this.panActive)return;e.stopPropagation(),e.preventDefault();const s=this.getBoundingClientRect(),i=t.radius??this.coneRadius/this.planWidth;this.shaping={id:t.id,radius:i},this.viewport.setPointerCapture(e.pointerId);const a=l=>{const c=this.toScreen(t.x,t.y),r=Math.hypot(l.clientX-s.left-c.x,l.clientY-s.top-c.y)/this.scale;return+Math.max(.02,Math.min(1,r/this.planWidth)).toFixed(4)},n=l=>this.shaping={id:t.id,radius:a(l)},o=l=>{this.viewport.removeEventListener("pointermove",n),this.viewport.removeEventListener("pointerup",o),this.viewport.removeEventListener("pointercancel",o);const c=a(l);this.shaping=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0),c!==i&&this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:t.id,radius:c},bubbles:!0,composed:!0}))};this.viewport.addEventListener("pointermove",n),this.viewport.addEventListener("pointerup",o),this.viewport.addEventListener("pointercancel",o)},this.onCoverageVertexDown=(t,e,s)=>{if(!this.editable||s.button!==0||!t.polygon)return;s.stopPropagation(),s.preventDefault();const i=Date.now();if(this.lastVertexPress&&this.lastVertexPress.id===t.id&&this.lastVertexPress.index===e&&i-this.lastVertexPress.at<450){this.lastVertexPress=null,this.editPolygon(t,{remove:e});return}this.lastVertexPress={id:t.id,index:e,at:i};const a=this.getBoundingClientRect(),n=t.polygon.map(h=>({...h}));this.shaping={id:t.id,polygon:n},this.viewport.setPointerCapture(s.pointerId);let o=!1;const l=h=>{const p=this.toPlan(h.clientX-a.left,h.clientY-a.top),u=n.map(y=>({...y}));return u[e]={x:+Math.max(0,Math.min(1,p.x)).toFixed(4),y:+Math.max(0,Math.min(1,p.y)).toFixed(4)},u},c=h=>{o=!0,this.shaping={id:t.id,polygon:l(h)}},r=h=>{this.viewport.removeEventListener("pointermove",c),this.viewport.removeEventListener("pointerup",r),this.viewport.removeEventListener("pointercancel",r);const p=l(h);this.shaping=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0),o&&this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:t.id,polygon:p},bubbles:!0,composed:!0}))};this.viewport.addEventListener("pointermove",c),this.viewport.addEventListener("pointerup",r),this.viewport.addEventListener("pointercancel",r)},this.itemClick=t=>{this.nearCorner(t.clientX,t.clientY)||t.stopPropagation()},this.gridCache=null,this.floorImageSeq=Math.floor(Math.random()*1e9)}get panActive(){return this.spacePan||this.panMode}get highlightSet(){return this.hlCache?.ids!==this.highlightIds&&(this.hlCache={ids:this.highlightIds,set:new Set(this.highlightIds)}),this.hlCache.set}zoomDockRect(){const t=this.renderRoot.querySelector(".zoomdock")?.getBoundingClientRect();return t&&t.width>0&&t.height>0?t:null}connectedCallback(){super.connectedCallback(),this.resizeObserver=new ResizeObserver(()=>{this.fitted||this.fit()}),this.resizeObserver.observe(this),window.addEventListener("keydown",this.onSpaceKey),window.addEventListener("keyup",this.onSpaceKey),window.addEventListener("blur",this.onSpaceBlur)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onSpaceKey),window.removeEventListener("keyup",this.onSpaceKey),window.removeEventListener("blur",this.onSpaceBlur),this.spacePan=!1,this.resizeObserver?.disconnect(),cancelAnimationFrame(this.hoverFrame),this.hoverFrame=0,this.clearZonePending()}willUpdate(t){const e=this.zonePending;if(e&&t.has("zones")){const s=this.zones.find(i=>i.id===e.id);(!s||s.polygon!==e.before&&JSON.stringify(s.polygon)!==JSON.stringify(e.before))&&this.clearZonePending()}}emitZoneEdit(t,e){this.zonePending&&window.clearTimeout(this.zonePending.timer),this.zoneDraft={id:t.id,polygon:e},this.zonePending={id:t.id,before:t.polygon,timer:window.setTimeout(()=>this.clearZonePending(),5e3)},this.dispatchEvent(new CustomEvent("zone-edit",{detail:{id:t.id,polygon:e},bubbles:!0,composed:!0}))}clearZonePending(){const t=this.zonePending;t&&(window.clearTimeout(t.timer),this.zoneDraft?.id===t.id&&(this.zoneDraft=null),this.zonePending=null)}updated(t){(t.has("planWidth")||t.has("planHeight"))&&(this.fitted=!1,this.fit()),(t.has("scale")||t.has("tx")||t.has("ty"))&&this.dispatchEvent(new CustomEvent("view-change",{bubbles:!0,composed:!0}))}get zoom(){return this.scale}getView(){return this.fitted?{scale:this.scale,tx:this.tx,ty:this.ty}:null}setView(t){!Number.isFinite(t.scale)||!Number.isFinite(t.tx)||!Number.isFinite(t.ty)||(this.scale=Math.max(this.minScale,Math.min(N,t.scale)),this.tx=t.tx,this.ty=t.ty,this.fitted=!0)}focusMarker(t){const e=this.renderRoot.querySelector(`g.marker[data-id="${CSS.escape(t)}"]`);return e?.focus(),!!e}toScreen(t,e){return{x:this.tx+t*this.planWidth*this.scale,y:this.ty+e*this.planHeight*this.scale}}fit(){const t=this.clientWidth,e=this.clientHeight;if(!t||!e||!this.planWidth||!this.planHeight)return;const s=24,i=Math.min((t-s*2)/this.planWidth,(e-s*2)/this.planHeight);this.minScale=Math.min(it,i),this.scale=Math.max(this.minScale,Math.min(N,i)),this.tx=(t-this.planWidth*this.scale)/2,this.ty=(e-this.planHeight*this.scale)/2,this.fitted=!0}centerOn(t,e){const s=this.clientWidth,i=this.clientHeight;!s||!i||(this.tx=s/2-t*this.planWidth*this.scale,this.ty=i/2-e*this.planHeight*this.scale,this.fitted=!0)}zoomToBox(t,e,s,i,a=48,n=0){const o=this.clientWidth,l=this.clientHeight;if(!o||!l||!this.planWidth||!this.planHeight)return;const c=Math.max(1e-6,s-t)*this.planWidth,r=Math.max(1e-6,i-e)*this.planHeight,h=Math.min((o-48)/this.planWidth,(l-48)/this.planHeight),p=n>0?Math.min(2.5,Math.max(h*n,h)):2.5,u=Math.max(it,Math.min(N,Math.min((o-a*2)/c,(l-a*2)/r,p)));this.scale=u,this.tx=o/2-(t+s)/2*this.planWidth*u,this.ty=l/2-(e+i)/2*this.planHeight*u,this.fitted=!0}zoomBy(t,e,s){const i=this.clientWidth,a=this.clientHeight,n=e??i/2,o=s??a/2,l=Math.max(this.minScale,Math.min(N,this.scale*t)),c=l/this.scale;this.tx=n-(n-this.tx)*c,this.ty=o-(o-this.ty)*c,this.scale=l,this.fitted=!0}toPlan(t,e){return{x:Math.min(1,Math.max(0,(t-this.tx)/this.scale/this.planWidth)),y:Math.min(1,Math.max(0,(e-this.ty)/this.scale/this.planHeight))}}pinchDistance(){const[t,e]=[...this.pointers.values()];return Math.hypot(t.x-e.x,t.y-e.y)}select(t,e){if(this.dragMoved)return;e.stopPropagation();const s=this.toScreen(t.x,t.y),i={id:t.id,sx:s.x,sy:s.y};this.dispatchEvent(new CustomEvent("marker-select",{detail:i,bubbles:!0,composed:!0}))}selectZone(t,e){this.dragMoved||this.placing||this.panActive||(e.stopPropagation(),this.dispatchEvent(new CustomEvent("zone-select",{detail:{id:t.id,add:nt(e)},bubbles:!0,composed:!0})))}onVertexPointerDown(t,e,s,i=!1){if(!this.editable||s.button!==0||this.panActive||(s.stopPropagation(),s.preventDefault(),this.zonePending?.id===t.id))return;if(!i){const r=this.lastVertexPress,h=performance.now();if(r&&r.id===t.id&&r.index===e&&h-r.at<450){this.lastVertexPress=null,this.removeVertex(t,e,s);return}this.lastVertexPress={id:t.id,index:e,at:h}}const a=this.getBoundingClientRect();let n=t.polygon.map(r=>({x:r.x,y:r.y})),o=e;if(i){const r=n[e],h=n[(e+1)%n.length];n.splice(e+1,0,{x:+((r.x+h.x)/2).toFixed(4),y:+((r.y+h.y)/2).toFixed(4)}),o=e+1}this.zoneDraft={id:t.id,polygon:n},this.viewport.setPointerCapture(s.pointerId);const l=r=>{const h=this.toPlan(r.clientX-a.left,r.clientY-a.top);n=n.map((p,u)=>u===o?{x:+h.x.toFixed(4),y:+h.y.toFixed(4)}:p),this.zoneDraft={id:t.id,polygon:n}},c=()=>{this.viewport.removeEventListener("pointermove",l),this.viewport.removeEventListener("pointerup",c),this.viewport.removeEventListener("pointercancel",c);const r=i||n.some((h,p)=>h.x!==t.polygon[p].x||h.y!==t.polygon[p].y);this.zoneDraft=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0),r?this.emitZoneEdit(t,n):i||this.dispatchEvent(new CustomEvent("zone-vertex-select",{detail:{id:t.id,index:e},bubbles:!0,composed:!0}))};this.viewport.addEventListener("pointermove",l),this.viewport.addEventListener("pointerup",c),this.viewport.addEventListener("pointercancel",c)}onZoneBodyPointerDown(t,e){if(this.panActive)return;if(this.multiDrag&&this.editable&&!t.candidate&&!this.placing&&this.pointers.size===0&&this.highlightSet.has(t.id)){this.onGeomDragStart("zone",t.id,0,e);return}if(!this.editable||e.button!==0||this.placing||t.candidate||this.selectedZoneId!==t.id||this.pointers.size>0||(e.stopPropagation(),e.preventDefault(),this.zonePending?.id===t.id))return;this.releaseFieldFocus();const s=this.getBoundingClientRect(),i=this.toPlan(e.clientX-s.left,e.clientY-s.top);let a=t.polygon,n=!1;this.viewport.setPointerCapture(e.pointerId);const o=p=>{const u=this.toPlan(p.clientX-s.left,p.clientY-s.top);!n&&Math.hypot((u.x-i.x)*this.planWidth,(u.y-i.y)*this.planHeight)*this.scale<3||(n=!0,a=re(t.polygon,u.x-i.x,u.y-i.y),this.zoneDraft={id:t.id,polygon:a})},l=()=>{this.viewport.removeEventListener("pointermove",o),this.viewport.removeEventListener("pointerup",r),this.viewport.removeEventListener("pointercancel",h),this.zoneDraft=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0)},c=e.shiftKey,r=()=>{l(),n&&a.some((p,u)=>p.x!==t.polygon[u].x||p.y!==t.polygon[u].y)?this.emitZoneEdit(t,a):!n&&c&&this.dispatchEvent(new CustomEvent("zone-select",{detail:{id:t.id,add:!0},bubbles:!0,composed:!0}))},h=()=>l();this.viewport.addEventListener("pointermove",o),this.viewport.addEventListener("pointerup",r),this.viewport.addEventListener("pointercancel",h)}removeVertex(t,e,s){s.stopPropagation(),!(!this.editable||t.polygon.length<=3)&&this.emitZoneEdit(t,t.polygon.filter((i,a)=>a!==e))}renderZoneHandles(t,e){const s=1/this.scale,i=this.planWidth,a=this.planHeight;return d`<g class="zone-handles">
      ${e.map((n,o)=>{const l=e[(o+1)%e.length];return d`<circle class="vmid" cx=${((n.x+l.x)/2*i).toFixed(1)} cy=${((n.y+l.y)/2*a).toFixed(1)} r=${(4*s).toFixed(2)} stroke-width=${(1.2*s).toFixed(2)} role="button" aria-label="הוסף פינה"
          @pointerdown=${c=>this.onVertexPointerDown(t,o,c,!0)} @click=${c=>c.stopPropagation()} />`})}
      ${e.map((n,o)=>d`<circle class="vtx ${o===this.selectedZoneVertex?"on":""}" data-vertex=${o} cx=${(n.x*i).toFixed(1)} cy=${(n.y*a).toFixed(1)} r=${(6*s).toFixed(2)} stroke-width=${(1.6*s).toFixed(2)} role="slider" aria-label=${`פינה ${o+1}`}
          @pointerdown=${l=>this.onVertexPointerDown(t,o,l)} @click=${l=>l.stopPropagation()} />`)}
    </g>`}renderZone(t){if(t.polygon.length<3)return v;const e=1/this.scale,s=this.zoneDraft?.id===t.id?this.zoneDraft.polygon:t.polygon,i=s.map(w=>`${(w.x*this.planWidth).toFixed(1)},${(w.y*this.planHeight).toFixed(1)}`).join(" "),a=Re(s),n=this.selectedZoneId===t.id,o=!n&&this.highlightSet.has(t.id),l=n||o,c=Math.max(36,t.name.length*7+18),r=s.map(w=>w.x),h=s.map(w=>w.y),p=(Math.max(...r)-Math.min(...r))*this.planWidth*this.scale,u=(Math.max(...h)-Math.min(...h))*this.planHeight*this.scale,y=l||t.candidate||p>=c+12&&u>=30,b=this.editable&&(n||o&&this.multiDrag)&&!t.candidate&&!this.placing;return d`
      <g class="zone ${l?"selected":""} ${t.candidate?"candidate":""} ${b?"movable":""}" style="--zc:${t.color}" role="button" tabindex="0" aria-label=${t.name} aria-pressed=${l}
         data-zone=${t.id}
         @click=${w=>this.selectZone(t,w)} @keydown=${w=>(w.key==="Enter"||w.key===" ")&&this.selectZone(t,w)}>
        <polygon data-zone-body points=${i} stroke-width=${((l?2.2:1.4)*e).toFixed(2)} @pointerdown=${w=>this.onZoneBodyPointerDown(t,w)} />
        ${this.renderZoneState(t,i,s,a)}
        ${t.chipTone==="occupied"?d`<polygon class="ptint" data-building-tint="occupied" data-zone-id=${t.id} points=${i} />`:v}
        ${this.zoneLabels&&t.name&&y?d`<g transform="translate(${this.zoneLabelPoint(t,s,a).x.toFixed(1)} ${this.zoneLabelPoint(t,s,a).y.toFixed(1)}) scale(${e})">
              <rect class="zl-bg" x=${-c/2} y="-10" width=${c} height="20" rx="10" />
              <text class="zl" y="3.5">${t.name}</text>
            </g>`:v}
        ${t.chip&&(y||!t.name)?this.renderZoneChip(t,t.chip,s,a):v}
        ${this.editable&&n&&!t.candidate?this.renderZoneHandles(t,s):v}
      </g>`}renderSharedOutlines(){const t=(this.geometry?.shared_spaces??[]).filter(i=>(i.other_polygon?.length??0)>=3);if(!t.length)return v;const e=1/this.scale,s=this.geometry?Yt(this.geometry):[];return d`<g class="shared-outlines" aria-hidden="true">${s.map(i=>{const a="כניסה לטריבונה",n=a.length*6.2+12;return d`<g class="tribune-entry" data-tribune-entry=${i.objectId} data-tribune-door=${i.openingId} transform="translate(${(i.point[0]*this.planWidth).toFixed(1)} ${(i.point[1]*this.planHeight).toFixed(1)}) scale(${e})">
        <circle r="6" /><path d="M -3 -1.5 L 0 1.8 L 3 -1.5" /><g transform="translate(0 -16)"><rect x=${-n/2} y="-8" width=${n} height="16" rx="8" /><text y="3.5">${a}</text></g>
      </g>`})}${t.map(i=>{const a=i.other_polygon.map(r=>`${(r.x*this.planWidth).toFixed(1)},${(r.y*this.planHeight).toFixed(1)}`).join(" "),n=i.other_label==="מפלס עליון",o=i.other_polygon.reduce((r,h)=>h.y<r.y?h:r,i.other_polygon[0]),l=i.other_label??"",c=Math.max(40,l.length*6.2+12);return d`<g class="shared-other ${n?"upper":"lower"}" data-shared-outline=${i.zone_id} data-shared-level=${n?"upper":"lower"}>
        <polygon points=${a} stroke-width=${((n?1.6:1.1)*e).toFixed(2)} stroke-dasharray=${`${(6*e).toFixed(2)} ${(4*e).toFixed(2)}`} />
        <g transform="translate(${(o.x*this.planWidth).toFixed(1)} ${(o.y*this.planHeight-10*e).toFixed(1)}) scale(${e})"><rect x=${-c/2} y="-8" width=${c} height="16" rx="8" /><text y="3.5">${l}</text></g>
      </g>`})}</g>`}renderZoneChip(t,e,s,i){const a=1/this.scale,n=this.zoneLabelPoint(t,s,i),o=t.chipTone==="occupied"?14:0,l=Math.max(40,e.length*6.2+14+o),c=(t.name&&this.zoneLabels?20:0)+(this.roomStates?.rooms[t.id]?.temperature!=null?22:0);return d`<g class="zchip" data-zone-chip=${t.id} data-tone=${t.chipTone??v} transform="translate(${n.x.toFixed(1)} ${(n.y+c*a).toFixed(1)}) scale(${a})">
      <rect x=${-l/2} y="-8" width=${l} height="16" rx="8" /><text y="3.5" x=${o?-o/2+1:0}>${e}</text>
      ${o?d`<g class="pi" transform=${`translate(${l/2-9} 0)`}><circle cx="-2" cy="-2" r="1.8" /><path d="M-5.2 3.2 q3.2 -4 6.4 0" /><circle cx="2.6" cy="-1.4" r="1.3" /></g>`:v}
    </g>`}renderZoneState(t,e,s,i){const a=this.roomStates?.rooms[t.id];if(!a)return v;const n=1/this.scale,o=a.temperature!==null?Zt(a.temperature):null,l=this.zoneLabelPoint(t,s,i),c=o?Math.max(30,o.length*7+14):0,r=a.presenceFade.toFixed(3);return d`
      ${a.lit?d`<polygon class="tint" data-room-tint="lit" data-zone-id=${t.id} points=${e} />`:v}
      ${a.presenceFade>0&&!a.lit?d`<polygon class="tint" data-room-tint="presence" data-zone-id=${t.id} data-fade=${r} points=${e} style=${`--fade:${r}`} />`:v}
      ${a.presenceFade>0?d`<clipPath id=${`zc-${t.id}`}><polygon points=${e} /></clipPath><polygon class="tint" data-room-tint="presence-edge" data-zone-id=${t.id} data-fade=${r} points=${e} clip-path=${`url(#zc-${t.id})`} stroke-width=${(7*n).toFixed(2)} style=${`--fade:${r}`} />`:v}
      ${o?d`<g class="tchip" data-room-temp=${t.id} transform="translate(${l.x.toFixed(1)} ${(l.y+(t.name&&this.zoneLabels?24:0)*n).toFixed(1)}) scale(${n})">
            <rect x=${-c/2} y="-9" width=${c} height="18" rx="9" /><text y="3.5">${o}</text>
          </g>`:v}`}renderOpenMark(t,e,s,i){if(!this.roomStates?.openOpenings.includes(t))return v;const a=(e[0][0]+e[1][0])/2,n=(e[0][1]+e[1][1])/2,o=i?i.arcs.map((l,c)=>({a:l,hinge:i.leaves[c]?.[0]??e[0],tip:i.leaves[c]?.[1]??[a,n]})):[];return d`
      ${o.map(({a:l,hinge:c})=>d`<path class="open-wedge" data-open-wedge=${t} d=${`M ${c[0]} ${c[1]} L ${l.from[0]} ${l.from[1]} A ${l.r} ${l.r} 0 0 ${l.sweep} ${l.to[0]} ${l.to[1]} Z`} stroke-width=${s} />`)}
      <line class="open-mark" data-open-mark=${t} x1=${e[0][0]} y1=${e[0][1]} x2=${e[1][0]} y2=${e[1][1]} stroke-width=${6*s} />
      ${o.length?o.map(({tip:l})=>d`<circle class="open-dot" cx=${l[0]} cy=${l[1]} r=${4*s} stroke-width=${1.5*s} />`):d`<circle class="open-dot" cx=${a} cy=${n} r=${4*s} stroke-width=${1.5*s} />`}`}zoneLabelPoint(t,e,s){const i=1/this.scale,a=e.map(l=>l.x*this.planWidth),n=e.map(l=>l.y*this.planHeight),o=Math.max(36,t.name.length*7+18)*i;switch(t.labelPos){case"top":return{x:s.x*this.planWidth,y:Math.min(...n)-14*i};case"bottom":return{x:s.x*this.planWidth,y:Math.max(...n)+14*i};case"left":return{x:Math.min(...a)-o/2-6*i,y:s.y*this.planHeight};case"right":return{x:Math.max(...a)+o/2+6*i,y:s.y*this.planHeight};default:return{x:s.x*this.planWidth,y:s.y*this.planHeight}}}static labelOffset(t,e,s){switch(t){case"top":return{x:0,y:-(e+14)};case"left":return{x:-(e+8+s/2),y:0};case"right":return{x:e+8+s/2,y:0};default:return{x:0,y:e+14}}}renderDraft(){const t=this.draftPoints;if(!t.length)return v;const e=1/this.scale,s=t.map(a=>({x:a.x*this.planWidth,y:a.y*this.planHeight})),i=s.map(a=>`${a.x.toFixed(1)},${a.y.toFixed(1)}`).join(" ");return d`<g class="draft" pointer-events="none">
      ${s.length>=3?d`<polygon points=${i} stroke-width=${(1.5*e).toFixed(2)} />`:d`<polyline points=${i} stroke-width=${(1.5*e).toFixed(2)} />`}
      ${s.map((a,n)=>d`<circle cx=${a.x.toFixed(1)} cy=${a.y.toFixed(1)} r=${((n===0?5.5:3.5)*e).toFixed(2)} stroke-width=${(1.5*e).toFixed(2)} />`)}
    </g>`}bearingTo(t,e,s){const i=this.toScreen(t.x,t.y);return((Math.atan2(s-i.y,e-i.x)*180/Math.PI+90)%360+360)%360}radiusOf(t){const e=this.shaping?.id===t.id&&this.shaping.radius!==void 0?this.shaping.radius:t.radius;return e?Math.max(12,e*this.planWidth):this.coneRadius}editPolygon(t,e){if(!t.polygon)return;let s=t.polygon.map(i=>({...i}));if("remove"in e){if(s.length<=3)return;s=s.filter((i,a)=>a!==e.remove)}else{const i=s[e.insertAfter],a=s[(e.insertAfter+1)%s.length];if(s.length>=40)return;s.splice(e.insertAfter+1,0,{x:+((i.x+a.x)/2).toFixed(4),y:+((i.y+a.y)/2).toFixed(4)})}this.dispatchEvent(new CustomEvent("marker-coverage",{detail:{id:t.id,polygon:s},bubbles:!0,composed:!0}))}polygonPath(t){const e=this.shaping?.id===t.id&&this.shaping.polygon?this.shaping.polygon:t.polygon;return!e||e.length<3?null:e.map(s=>`${((s.x-t.x)*this.planWidth).toFixed(1)},${((s.y-t.y)*this.planHeight).toFixed(1)}`).join(" ")}clippedCoverage(t,e,s,i){const a=this.geometry;if(!this.clipCoverage||!a||t.polygon)return null;const n=Kt(a,t.level);if(!Ut(a,n))return null;const o=this.coverage.polygon(t.id,{x:e.x,y:e.y,rotation:s,fov:i,radiusPx:this.radiusOf(t),level:n},a,this.planWidth,this.planHeight,this.entityStates,this.catalog??void 0),l=this.covPoints.get(t.id);if(l&&l.pts===o)return l.points;const c=o.map(r=>`${((r[0]-e.x)*this.planWidth).toFixed(2)},${((r[1]-e.y)*this.planHeight).toFixed(2)}`).join(" ");return this.covPoints.set(t.id,{pts:o,points:c}),c}renderPolygonHandles(t){const e=this.shaping?.id===t.id&&this.shaping.polygon?this.shaping.polygon:t.polygon;if(!e)return v;const s=1/this.scale,i=a=>({x:(a.x-t.x)*this.planWidth,y:(a.y-t.y)*this.planHeight});return d`
      ${e.map((a,n)=>{const o=i(a),l=i(e[(n+1)%e.length]);return d`
          <circle class="handle mid" cx=${((o.x+l.x)/2).toFixed(1)} cy=${((o.y+l.y)/2).toFixed(1)} r=${(4.5*s).toFixed(1)} data-cov-mid=${n} role="button" aria-label="הוסף נקודה"
            @pointerdown=${c=>{c.stopPropagation(),c.preventDefault()}} @click=${c=>{c.stopPropagation(),this.editPolygon(t,{insertAfter:n})}} />
          <circle class="handle" cx=${o.x.toFixed(1)} cy=${o.y.toFixed(1)} r=${(6.5*s).toFixed(1)} data-cov-vertex=${n} role="slider" aria-label="נקודת כיסוי"
            @pointerdown=${c=>this.onCoverageVertexDown(t,n,c)} @dblclick=${c=>{c.stopPropagation(),this.editPolygon(t,{remove:n})}} />`})}
    `}renderHandles(t,e,s){const i=this.radiusOf(t),a=1/this.scale,n=(h,p)=>({x:Math.cos(f.rad(h))*p,y:Math.sin(f.rad(h))*p}),o=n(e-s/2,i),l=n(e+s/2,i),c=n(e,i*.72),r=7*a;return d`
      <line class="handle-line" x1="0" y1="0" x2=${c.x.toFixed(1)} y2=${c.y.toFixed(1)} />
      <rect class="handle" x=${(o.x-r).toFixed(1)} y=${(o.y-r).toFixed(1)} width=${(r*2).toFixed(1)} height=${(r*2).toFixed(1)} rx=${(1.5*a).toFixed(1)} role="slider" aria-label="קצה שדה ראייה" @pointerdown=${h=>this.onHandlePointerDown(t,"left",h)} @click=${h=>h.stopPropagation()} />
      <rect class="handle" x=${(l.x-r).toFixed(1)} y=${(l.y-r).toFixed(1)} width=${(r*2).toFixed(1)} height=${(r*2).toFixed(1)} rx=${(1.5*a).toFixed(1)} role="slider" aria-label="קצה שדה ראייה" @pointerdown=${h=>this.onHandlePointerDown(t,"right",h)} @click=${h=>h.stopPropagation()} />
      <circle class="handle" cx=${c.x.toFixed(1)} cy=${c.y.toFixed(1)} r=${(8*a).toFixed(1)} role="slider" aria-label="כיוון מבט" @pointerdown=${h=>this.onHandlePointerDown(t,"dir",h)} @click=${h=>h.stopPropagation()} />
      <circle class="handle range" cx=${n(e,i).x.toFixed(1)} cy=${n(e,i).y.toFixed(1)} r=${(6.5*a).toFixed(1)} role="slider" aria-label="טווח כיסוי" data-cov-range @pointerdown=${h=>this.onRangePointerDown(t,h)} />
    `}static rad(t){return(t-90)*Math.PI/180}fovPath(t,e,s){const i=f.rad(t-e/2),a=f.rad(t+e/2),n=Math.cos(i)*s,o=Math.sin(i)*s,l=Math.cos(a)*s,c=Math.sin(a)*s;return`M0 0 L${n.toFixed(1)} ${o.toFixed(1)} A${s} ${s} 0 ${e>180?1:0} 1 ${l.toFixed(1)} ${c.toFixed(1)} Z`}clustered(){if(this.editable||this.placing||!this.clusterThreshold)return{singles:this.markers,clusters:[]};const t=[...this.selectedId?[this.selectedId]:[],...this.selectedIds,...this.highlightIds];return ge(this.markers,{planWidth:this.planWidth,planHeight:this.planHeight,scale:this.scale,threshold:this.clusterThreshold,keepIds:t})}expandCluster(t,e){if(this.dragMoved)return;e.stopPropagation();const s=fe(t);this.zoomToBox(s.x0,s.y0,s.x1,s.y1,72),this.updateComplete.then(()=>{this.focusMarker(t.members[0].id)||this.renderRoot.querySelector("g.marker.cluster")?.focus()})}renderCluster(t){const e=1/this.scale,s=t.members.length,i=s>=100?20:s>=10?17:14,a=V[t.state]??V.neutral,n=Object.entries(t.byState).map(([o,l])=>`${l} ${A(`states.${o}`)}`).join(", ");return d`
      <g class="marker cluster ${t.state}" transform="translate(${t.x*this.planWidth} ${t.y*this.planHeight})" data-cluster=${t.id} data-count=${s} data-state=${t.state}
         tabindex="0" role="button" aria-label=${`${A("floor.cluster")}: ${s} - ${n}`}
         @click=${o=>this.expandCluster(t,o)}
         @keydown=${o=>{(o.key==="Enter"||o.key===" ")&&(o.preventDefault(),this.expandCluster(t,o))}}>
        <g transform="scale(${e})">
          <circle class="halo" r=${i+9} />
          <circle class="ring" r=${i+4} />
          <circle class="pin" r=${i} fill=${a} />
          <text class="count">${s}</text>
        </g>
      </g>`}renderMarker(t){const e=this.dragging?.id===t.id?this.dragging:t,s=this.orienting?.id===t.id?this.orienting:null,i=s?s.rotation:t.rotation??0,a=s?s.fov:t.fov,n=e.x*this.planWidth,o=e.y*this.planHeight,l=1/this.scale,c=t.kind==="camera",r=V[t.state]??V.neutral,h=this.selectedId===t.id||this.selectedIds.includes(t.id),p=this.alwaysLabel||h||this.hoverId===t.id,u=Math.max(44,t.label.length*6.5+16),y=this.dimEntities&&!c,b=c?13:11;return d`
      <g class="marker ${t.state} ${h?"selected":""} ${y?"dimmed":""} ${this.editable?"editable":""}"
         transform="translate(${n} ${o})" data-id=${t.id}
         tabindex="0" role="button" aria-label=${t.label} aria-pressed=${h}
         @mouseenter=${()=>this.hoverId=t.id} @mouseleave=${()=>this.hoverId=null}
         @pointerdown=${w=>this.onMarkerPointerDown(t,w)}
         @click=${w=>this.placing?void 0:this.editable?w.stopPropagation():this.select(t,w)}
         @keydown=${w=>(w.key==="Enter"||w.key===" ")&&this.select(t,w)}>
        ${c&&a&&t.state!=="forbidden"?(()=>{const w=this.polygonPath(t);if(w)return d`<polygon class="fov ${t.state==="offline"?"off":""}" data-cov-polygon points=${w} />`;const k=this.clippedCoverage(t,e,i,a);return k?d`<polygon class="fov ${t.state==="offline"?"off":""}" data-cov-clipped points=${k} />`:d`<path class="fov ${t.state==="offline"?"off":""}" d=${this.fovPath(i,a,this.radiusOf(t))} />`})():v}
        ${c&&a&&this.editable&&h&&!this.dragging?this.polygonPath(t)?this.renderPolygonHandles(t):this.renderHandles(t,i,a):v}
        <g transform="scale(${l})">
          <circle class="halo" r=${b+9} />
          <circle class="pin" r=${b} fill=${r} />
          <g class="icon" transform="scale(${c?.85:.75})">${We[t.kind]}</g>
          ${t.state==="offline"?d`<line x1="-9" y1="-9" x2="9" y2="9" stroke="#fff" stroke-width="2.5" />`:v}
          ${t.state==="forbidden"?d`<g transform="translate(8 -8)"><circle r="6.5" fill="#fff" /><g fill="none" stroke="var(--sw-forbidden)" stroke-width="1.5" transform="scale(0.45)"><rect x="-6" y="-2" width="12" height="9" rx="2"/><path d="M-3.5 -2v-3a3.5 3.5 0 0 1 7 0v3"/></g></g>`:v}
          ${p?d`<g transform="translate(${f.labelOffset(t.labelPos,b,u).x.toFixed(1)} ${f.labelOffset(t.labelPos,b,u).y.toFixed(1)})" data-label-pos=${t.labelPos??"auto"}>
                <rect class="lbl-bg" x=${-u/2} y="-10" width=${u} height="20" rx="6" />
                <text class="lbl" y="3.5">${t.label}</text>
              </g>`:v}
        </g>
      </g>
    `}primitives(t){const e=this.primCache;if(e&&e.doc===t&&e.w===this.planWidth&&e.h===this.planHeight&&e.level===this.structureLevel&&e.catalog===this.catalog&&_e(e.anchors,this.anchorPositions))return e.prims;const s=Object.keys(this.anchorPositions).length?qt(t,this.anchorPositions):t,i=tt(s,this.planWidth,this.planHeight,this.structureLevel,this.catalog??void 0);return this.primCache={doc:t,w:this.planWidth,h:this.planHeight,level:this.structureLevel,catalog:this.catalog,anchors:this.anchorPositions,prims:i},i}circuitTokens(){const t=this.geometry;if(!t)return new Map;if(this.circuitCache?.doc!==t){const e=new Map;for(const s of t.circuits){const i=Jt(s.color_token);i&&e.set(s.id,i)}this.circuitCache={doc:t,tokens:e}}return this.circuitCache.tokens}stairOf(t){const e=this.geometry;if(!e)return null;const s=this.stairCache;if(!s||s.doc!==e||s.w!==this.planWidth||s.h!==this.planHeight){const{scale:i}=Qt(e),a=new Map,n=new Map(e.levels.map(l=>[l.id,l])),o=te(e);for(const l of e.connectors)a.set(l.id,ee(l,this.planWidth,this.planHeight,i,{descending:se(n,l,o)<0}));this.stairCache={doc:e,w:this.planWidth,h:this.planHeight,plans:a}}return this.stairCache.plans.get(t)??null}renderStair(t,e,s,i){const a=e.walk[0];return d`<g class="conn stair ${s}" data-connector=${t.id} data-kind=${t.ckind} data-shape=${e.shape} data-flights=${e.flights.map(n=>n.steps).join("+")}>
      ${e.landings.map(n=>d`<polygon class="slanding" data-stair-landing points=${L(n)} stroke-width=${1.2*i} />`)}
      ${e.flights.map((n,o)=>d`<g data-stair-flight=${o}><polygon class="sflight" points=${L(n.outline)} stroke-width=${1.2*i} />
        ${n.treads.map(([l,c])=>d`<line class="stread" x1=${l[0]} y1=${l[1]} x2=${c[0]} y2=${c[1]} stroke-width=${.8*i} />`)}</g>`)}
      ${e.breakLine?d`<line class="sbreak" data-stair-break x1=${e.breakLine[0][0]} y1=${e.breakLine[0][1]} x2=${e.breakLine[1][0]} y2=${e.breakLine[1][1]} stroke-width=${1.4*i} />`:v}
      <polyline class="swalk" points=${L(e.walk)} stroke-width=${1.4*i} marker-end="url(#sw-arrow)" />
      ${a?d`<circle class="sstart" cx=${a[0]} cy=${a[1]} r=${3*i} />`:v}
      <text class="clabel" data-conn-text x=${t.lx} y=${t.ly-7*i} font-size=${12*i}>${t.label}</text>
      ${e.caption?d`<text class="clabel scap" data-stair-caption x=${t.lx} y=${t.ly+8*i} font-size=${10.5*i}>${e.caption}</text>`:v}
    </g>`}renderStructure(){const t=this.geometry;if(!t)return v;const e=1/this.scale,s=new Set(this.issueIds),i=this.highlightSet,a=this.primitives(t).filter(n=>n.kind==="object"?!this.hideObjects:n.kind==="connector"?!this.hideConnectors:!this.hideStructure);return d`<g class="structure" data-structure style=${`--inv: ${e}`}>${a.map(n=>this.renderPrimitive(n,e,s,i))}</g>`}renderPrimitive(t,e,s,i=new Set){const a=`${t.id===this.selectedGeomId||i.has(t.id)?"sel":""} ${s.has(t.id)?"issue":""}`;switch(t.kind){case"wall":{if(!t.glass)return d`<g class="wall-g ${a}" data-wall=${t.id}><polyline class="wall" points=${L(t.points)} stroke-width=${t.width} /></g>`;const{band:n}=ne(t.width),o=L(t.points);return d`<g class="wall-g glasswall ${a}" data-wall=${t.id} data-wall-glass>
          <polyline class="wall gframe" points=${o} stroke-width=${t.width} />
          <polyline class="gpane" points=${o} stroke-width=${n} />
          <polyline class="gline" points=${o} stroke-width=${Math.min(n*.5,1.2*e)} />
        </g>`}case"glazing":return d`<g class="glazing ${a}" data-glazing=${t.id} data-panels=${t.panels.length}>
          ${t.mullions.map(([n,o])=>d`<line class="mullion" x1=${n[0]} y1=${n[1]} x2=${o[0]} y2=${o[1]} stroke-width=${Math.max(t.mullion,1.2*e)} />`)}
          ${t.panels.filter(n=>n.operation).map(n=>d`<line class="operable" data-operable=${n.index} data-operation=${n.operation??""} x1=${n.a[0]} y1=${n.a[1]} x2=${n.b[0]} y2=${n.b[1]}
            stroke-width=${1.4*e} stroke-dasharray=${`${3*e} ${2*e}`} />${this.renderOpenMark(ie(t.id,n.index),[n.a,n.b],e)}`)}
        </g>`;case"door":return d`<g class="opening ${a}" data-opening=${t.id} data-kind="door">
          ${t.leaves.map(([n,o])=>d`<line class="leaf" x1=${n[0]} y1=${n[1]} x2=${o[0]} y2=${o[1]} stroke-width=${1.6*e} />`)}
          ${t.arcs.map(n=>d`<path class="arc" d=${`M ${n.from[0]} ${n.from[1]} A ${n.r} ${n.r} 0 0 ${n.sweep} ${n.to[0]} ${n.to[1]}`} stroke-width=${1.1*e} stroke-dasharray=${`${4*e} ${3*e}`} />`)}
          ${this.renderOpenMark(t.id,t.gap,e,t)}
        </g>`;case"window":return d`<g class="opening ${a}" data-opening=${t.id} data-kind="window">${t.lines.map(([n,o])=>d`<line class="glass" x1=${n[0]} y1=${n[1]} x2=${o[0]} y2=${o[1]} stroke-width=${1.6*e} />`)}${this.renderOpenMark(t.id,t.gap,e)}</g>`;case"passage":return d`<g class="opening ${a}" data-opening=${t.id} data-kind="passage"><line class="gapline" x1=${t.gap[0][0]} y1=${t.gap[0][1]} x2=${t.gap[1][0]} y2=${t.gap[1][1]} stroke-width=${e} stroke-dasharray=${`${2*e} ${3*e}`} /></g>`;case"connector":{const n=this.stairOf(t.id);return n?this.renderStair(t,n,a,e):d`<g class="conn ${a}" data-connector=${t.id} data-kind=${t.ckind}>
          <path class="cbody" d=${`M ${t.points.map(o=>`${o[0]} ${o[1]}`).join(" L ")}`} stroke-width=${t.width} />
          <path class="carrow" d=${`M ${t.arrow.from[0]} ${t.arrow.from[1]} L ${t.arrow.to[0]} ${t.arrow.to[1]}`} stroke-width=${2*e} marker-end="url(#sw-arrow)" />
          <text class="clabel" data-conn-text x=${t.lx} y=${t.ly} font-size=${12*e}>${t.label}</text>
        </g>`}case"object":{const n=t.anchor?.startsWith("ha_entity:")?t.anchor.slice(10):null,o=t.circuit_id!==null&&this.circuitStates[t.circuit_id]==="on"||n!==null&&this.entityStates[n]==="on",l=t.circuit_id!==null?this.circuitTokens().get(t.circuit_id):void 0,c=Math.min(3,Math.max(.35,Math.min(t.w,t.h)*.6/24));return d`<g class="obj ${a} ${o?"glow":""}" data-object=${t.id} data-item=${t.item_id} data-shape=${t.shape} data-circuit=${t.circuit_id??v} ?data-glow=${o}
             style=${`--oc: var(--sw-obj-${t.color});${l?` --kc: var(--sw-${l});`:""}`}>
          ${t.shape==="cylinder"?d`<ellipse class="fp" cx=${t.cx} cy=${t.cy} rx=${t.w/2} ry=${t.h/2} transform=${`rotate(${t.rotation} ${t.cx} ${t.cy})`} stroke-width=${1.2*e} />`:d`<polygon class="fp" points=${L(t.corners)} stroke-width=${1.2*e} />`}
          ${t.steps.map(([r,h])=>d`<line class="step" x1=${r[0]} y1=${r[1]} x2=${h[0]} y2=${h[1]} stroke-width=${e} />`)}
          <g class="sym" transform=${`translate(${t.cx} ${t.cy}) rotate(${t.rotation}) scale(${c}) translate(-12 -12)`} stroke-width=${1.6/c}>${ve(t.icon)}</g>
          ${t.label&&this.scale>=.6?d`<text class="olabel" x=${t.cx} y=${t.cy+t.h/2+12*e} font-size=${11*e}>${t.label}</text>`:v}
        </g>`}case"label":return d`<text class="glabel ${a}" data-label=${t.id} x=${t.x} y=${t.y} font-size=${t.size}>${t.text}</text>`}}queueHover(t){const e=this.getBoundingClientRect(),s=this.toPlan(t.clientX-e.left,t.clientY-e.top),i=t.composedPath()[0],a=i instanceof Element&&!!i.closest("[data-hit-opening], [data-hit-label]")&&!this.nearCorner(t.clientX,t.clientY);this.hoverEvent={x:s.x,y:s.y,shift:t.shiftKey,item:a},!this.hoverFrame&&(this.hoverFrame=requestAnimationFrame(()=>{this.hoverFrame=0;const n=this.hoverEvent;n&&this.dispatchEvent(new CustomEvent("plan-hover",{detail:n,bubbles:!0,composed:!0}))}))}pickGeom(t,e){this.panActive||(e.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("geom-select",{detail:{id:t,kind:"wall",add:nt(e)},bubbles:!0,composed:!0})))}pickConnector(t,e){this.panActive||(e.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("geom-select",{detail:{id:t,kind:"connector"},bubbles:!0,composed:!0})))}renderObjectHandles(t,e){const s=r=>[(t.corners[r][0]+t.corners[(r+1)%4][0])/2,(t.corners[r][1]+t.corners[(r+1)%4][1])/2],i=s(0),a=i[0]-t.cx,n=i[1]-t.cy,o=Math.hypot(a,n)||1,l=[i[0]+a/o*18*e,i[1]+n/o*18*e],c=5*e;return d`<g class="ohandles">
      <line class="handle-line" x1=${i[0]} y1=${i[1]} x2=${l[0]} y2=${l[1]} />
      ${[0,1,2,3].map(r=>{const h=s(r);return d`<rect class="handle" data-object-stretch=${r} x=${h[0]-c} y=${h[1]-c} width=${c*2} height=${c*2} rx=${1.5*e} role="slider" aria-label="מתיחה"
          @pointerdown=${p=>this.onGeomDragStart("object-stretch",t.id,r,p)} @click=${p=>p.stopPropagation()} />`})}
      <circle class="handle" data-object-rotate cx=${l[0]} cy=${l[1]} r=${7*e} role="slider" aria-label="סיבוב" @pointerdown=${r=>this.onGeomDragStart("object-rotate",t.id,0,r)} @click=${r=>r.stopPropagation()} />
    </g>`}nearCorner(t,e){const s=this.geometry,i=this.cornerSnapPx;if(!s||!(i>0))return!1;const a=this.getBoundingClientRect(),n=this.toPlan(t-a.left,e-a.top);return s.walls.some(o=>o.polyline.some(l=>Math.hypot((l[0]-n.x)*this.planWidth,(l[1]-n.y)*this.planHeight)*this.scale<=i))}releaseFieldFocus(){let t=document.activeElement;for(;t?.shadowRoot?.activeElement;)t=t.shadowRoot.activeElement;(t instanceof HTMLInputElement||t instanceof HTMLSelectElement||t instanceof HTMLTextAreaElement)&&t.blur()}touchPick(t,e,s){s.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("geom-select",{detail:{id:t,kind:e,add:nt(s)},bubbles:!0,composed:!0}))}touchLocked(t){return this.coarse&&t!==this.selectedGeomId&&!(this.multiDrag&&this.highlightSet.has(t))}onGeomDragStart(t,e,s,i){const a=t.startsWith("object")||t.startsWith("connector");if(this.panActive||i.button!==0||this.geomDrag==="none"||(t==="vertex"||t==="segment"||t==="wall"||t==="zone")&&this.geomDrag!=="all"||a&&this.geomDrag==="items"||!a&&this.geomDrag==="objects"||t!=="vertex"&&t!=="segment"&&t!=="curve-point"&&this.nearCorner(i.clientX,i.clientY))return;i.stopPropagation(),i.preventDefault(),this.releaseFieldFocus();const n=this.getBoundingClientRect(),o=this.toPlan(i.clientX-n.left,i.clientY-n.top);let l=!1,c=o,r={shift:i.shiftKey,alt:i.altKey,ctrl:i.ctrlKey||i.metaKey};const h=P=>({kind:t,id:e,index:s,x:+P.x.toFixed(5),y:+P.y.toFixed(5),sx:+o.x.toFixed(5),sy:+o.y.toFixed(5),...r}),p=(P,M)=>this.dispatchEvent(new CustomEvent(P,{detail:M,bubbles:!0,composed:!0}));this.geomPress=!0,this.viewport.setPointerCapture(i.pointerId);const u=P=>{r={shift:P.shiftKey,alt:P.altKey,ctrl:P.ctrlKey||P.metaKey};const M=this.toPlan(P.clientX-n.left,P.clientY-n.top);!l&&Math.hypot((M.x-o.x)*this.planWidth,(M.y-o.y)*this.planHeight)*this.scale<3||(l=!0,c=M,this.geomDragAt={x:M.x,y:M.y},p("geom-drag-move",h(M)))},y=()=>{this.viewport.removeEventListener("pointermove",u),this.viewport.removeEventListener("pointerup",w),this.viewport.removeEventListener("pointercancel",k),this.geomDragAt=null,this.geomPress=!1,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0)},b=i.shiftKey,w=()=>{y(),l?p("geom-drag",h(c)):t==="zone"?p("zone-select",{id:e,add:b}):t==="segment"?p("geom-select",{id:e,kind:"wall",segment:s,add:b}):p("geom-select",t==="vertex"||t==="curve-point"?{id:e,kind:"wall",vertex:s,add:b}:{id:e,kind:t.startsWith("object")?"object":t.startsWith("connector")?"connector":t,add:b})},k=()=>{y(),l&&p("geom-drag-cancel",h(c))};this.viewport.addEventListener("pointermove",u),this.viewport.addEventListener("pointerup",w),this.viewport.addEventListener("pointercancel",k)}renderGeomHits(){const t=this.geometry,e=this.geomDrag;if(!t||e==="none")return v;const s=1/this.scale,i=this.planWidth,a=this.planHeight,n=this.primitives(t),o=e==="all"?n.filter(g=>g.kind==="wall"):[],l=e==="objects"?[]:n.filter(g=>g.kind==="door"||g.kind==="window"||g.kind==="passage"),c=e==="objects"?[]:n.filter(g=>g.kind==="label"),r=new Map;for(const g of n)g.kind==="wall"&&r.set(g.id,Math.max(r.get(g.id)??0,g.width));const h=new Map(t.openings.map(g=>[g.id,g.wall_id])),p=e==="all"?t.walls.find(g=>g.id===this.selectedGeomId):void 0,u=this.curvePointHandles&&(e==="all"||e==="items")?t.walls.find(g=>g.id===this.selectedGeomId):void 0,y=u?q(u):null,b=this.coarse?je:12,w=this.geomDragAt,k=e==="all"||e==="objects",P=k?n.filter(g=>g.kind==="object"&&!this.hideObjects):[],M=k?n.filter(g=>g.kind==="connector"&&!this.hideConnectors):[],E=k&&!w?P.find(g=>g.id===this.selectedGeomId):void 0,D=k?t.connectors.find(g=>g.id===this.selectedGeomId):void 0,j=this.multiDrag?this.highlightSet:new Set,z=g=>g===this.selectedGeomId||j.has(g);return d`<g class="geom-hits">
      ${M.map(g=>d`<path class="hit" data-hit-connector=${g.id} d=${`M ${g.points.map(x=>`${x[0]} ${x[1]}`).join(" L ")}`} stroke-width=${Math.max(g.width,12*s)}
          @pointerdown=${x=>g.id===this.selectedGeomId&&D&&!D.object_id?this.onGeomDragStart("connector",g.id,0,x):void 0}
          @click=${x=>this.pickConnector(g.id,x)} />`)}
      ${o.filter(g=>!z(g.id)).map(g=>d`<polyline class="hit" data-hit-wall=${g.id} points=${L(g.points)} stroke-width=${Math.max(g.width,b*s)} @click=${x=>this.pickGeom(g.id,x)} />`)}
      ${oe(P,this.selectedGeomId).map(g=>d`<polygon class="hit ohit" data-hit-object=${g.id} points=${L(ae(g,ze*s))}
          @pointerdown=${x=>this.touchLocked(g.id)?void 0:this.onGeomDragStart(x.altKey?"object-duplicate":"object",g.id,0,x)}
          @click=${x=>this.touchLocked(g.id)?this.touchPick(g.id,"object",x):x.stopPropagation()} />`)}
      ${D&&!D.object_id?D.polyline.map((g,x)=>d`<circle class="gvtx" data-connector-vertex=${x} cx=${g[0]*i} cy=${g[1]*a} r=${6*s} stroke-width=${1.6*s} aria-label=${`פינת מחבר ${x+1}`}
          @pointerdown=${C=>this.onGeomDragStart("connector-vertex",D.id,x,C)} @click=${C=>C.stopPropagation()} />`):v}
      ${E?this.renderObjectHandles(E,s):v}
      ${o.filter(g=>z(g.id)).map(g=>d`<polyline class="hit whit" data-hit-wall=${g.id} data-wall-body points=${L(g.points)} stroke-width=${Math.max(g.width,b*s)}
          @pointerdown=${x=>this.onGeomDragStart("wall",g.id,0,x)} @click=${x=>x.stopPropagation()} />`)}
      ${l.map(g=>d`<line class="hit" data-hit-opening=${g.id} x1=${g.gap[0][0]} y1=${g.gap[0][1]} x2=${g.gap[1][0]} y2=${g.gap[1][1]} stroke-width=${Math.max(28*s,r.get(h.get(g.id)??"")??0)}
          @pointerdown=${x=>this.touchLocked(g.id)?void 0:this.onGeomDragStart("opening",g.id,0,x)} @click=${x=>this.touchLocked(g.id)?this.touchPick(g.id,"opening",x):this.itemClick(x)} />`)}
      ${c.map(g=>d`<circle class="hit" data-hit-label=${g.id} cx=${g.x} cy=${g.y} r=${Math.max(g.size,10*s)}
          @pointerdown=${x=>this.touchLocked(g.id)?void 0:this.onGeomDragStart("label",g.id,0,x)} @click=${x=>this.touchLocked(g.id)?this.touchPick(g.id,"label",x):this.itemClick(x)} />`)}
      ${u&&y?y.map((g,x)=>{const C=u.polyline[g];return d`<circle class="gvtx gpt ${g===this.selectedVertex?"on":""}" data-curve-point=${x} data-wall-vertex=${g} cx=${C[0]*i} cy=${C[1]*a} r=${(this.coarse?9:6.5)*s} stroke-width=${1.8*s}
          role="slider" aria-label=${`${wt("pointHandle")} ${x+1}`} @pointerdown=${S=>this.onGeomDragStart("curve-point",u.id,g,S)} @click=${S=>S.stopPropagation()} />`}):v}
      ${p&&!(y&&u?.id===p.id)?(J(p.polyline)?p.polyline.slice(0,-1):p.polyline).map((g,x)=>d`<circle class="gvtx ${x===this.selectedVertex?"on":""}" data-wall-vertex=${x} cx=${g[0]*i} cy=${g[1]*a} r=${6*s} stroke-width=${1.6*s} aria-label=${`פינת קיר ${x+1}`}
          @pointerdown=${C=>this.onGeomDragStart("vertex",p.id,x,C)} @click=${C=>C.stopPropagation()} />`):v}
      ${p&&this.curveHandles?p.polyline.slice(1).map((g,x)=>{const C=Ce(p,x,i,a),S=5.5*s;return d`<rect class="gseg ${x===this.selectedSegment?"on":""}" data-wall-segment=${x} x=${C[0]*i-S} y=${C[1]*a-S} width=${2*S} height=${2*S}
          transform=${`rotate(45 ${C[0]*i} ${C[1]*a})`} stroke-width=${1.6*s} aria-label=${`${wt("segmentHandle")} ${x+1}`}
          @pointerdown=${Q=>this.onGeomDragStart("segment",p.id,x,Q)} @click=${Q=>Q.stopPropagation()} />`}):v}
      ${w?d`<circle class="gdrag" cx=${w.x*i} cy=${w.y*a} r=${5*s} stroke-width=${1.5*s} />`:v}
    </g>`}candidatePrims(t){const e=this.geometry;if(!e)return[];const s=this.candCache;if(s&&s.set===t&&s.doc===e&&s.w===this.planWidth&&s.h===this.planHeight&&s.catalog===this.catalog)return s.prims;const i=tt(le(e,t),this.planWidth,this.planHeight,null,this.catalog??void 0);return this.candCache={set:t,doc:e,w:this.planWidth,h:this.planHeight,catalog:this.catalog,prims:i},i}candConfidence(t,e){return t.walls.find(s=>s.id===e)?.confidence??t.openings.find(s=>s.id===e)?.confidence??t.objects.find(s=>s.id===e)?.confidence??0}candAnchor(t,e){const s=t.find(i=>i.id===e);if(!s)return null;if(s.kind==="wall"){const i=s.points[0],a=s.points[s.points.length-1];return[(i[0]+a[0])/2,(i[1]+a[1])/2]}return s.kind==="door"||s.kind==="window"||s.kind==="passage"?[(s.gap[0][0]+s.gap[1][0])/2,(s.gap[0][1]+s.gap[1][1])/2]:null}renderCandidates(){const t=this.candidates;if(!t)return v;const e=this.candidatePrims(t),s=1/this.scale,i=r=>`cand ${this.candidateStates[r]??"accepted"} ${r===this.selectedCandidateId?"sel":""} ${et(t,r)?"outside":""}`,a=r=>({state:this.candidateStates[r]??"accepted",score:this.candConfidence(t,r).toFixed(2)}),n=this.candHover??this.selectedCandidateId,o=n?this.candAnchor(e,n):null,l=n?`ביטחון ${this.candConfidence(t,n).toFixed(2)}${et(t,n)?` · ${$t}`:""}`:"",c=(l.length*7+16)*s;return d`<g class="candidates" data-candidates>
      ${e.map(r=>{const h=a(r.id);switch(r.kind){case"wall":return et(t,r.id)?d`<g class=${i(r.id)} data-candidate=${r.id} data-kind="wall" data-state=${h.state} data-score=${h.score} data-outside-main><title>${$t}</title><polyline class="cwall" points=${L(r.points)} stroke-width=${r.width} /></g>`:d`<g class=${i(r.id)} data-candidate=${r.id} data-kind="wall" data-state=${h.state} data-score=${h.score}><polyline class="cwall" points=${L(r.points)} stroke-width=${r.width} /></g>`;case"door":return d`<g class=${i(r.id)} data-candidate=${r.id} data-kind="door" data-state=${h.state} data-score=${h.score}>
              ${r.leaves.map(([p,u])=>d`<line class="cleaf" x1=${p[0]} y1=${p[1]} x2=${u[0]} y2=${u[1]} stroke-width=${1.6*s} />`)}
              ${r.arcs.map(p=>d`<path class="carc" d=${`M ${p.from[0]} ${p.from[1]} A ${p.r} ${p.r} 0 0 ${p.sweep} ${p.to[0]} ${p.to[1]}`} stroke-width=${1.1*s} />`)}
            </g>`;case"window":return d`<g class=${i(r.id)} data-candidate=${r.id} data-kind="window" data-state=${h.state} data-score=${h.score}>${r.lines.map(([p,u])=>d`<line class="cglass" x1=${p[0]} y1=${p[1]} x2=${u[0]} y2=${u[1]} stroke-width=${1.6*s} />`)}</g>`;case"passage":return d`<g class=${i(r.id)} data-candidate=${r.id} data-kind="passage" data-state=${h.state} data-score=${h.score}><line class="cgap" x1=${r.gap[0][0]} y1=${r.gap[0][1]} x2=${r.gap[1][0]} y2=${r.gap[1][1]} stroke-width=${s} /></g>`;case"object":return d`<g class=${i(r.id)} data-candidate=${r.id} data-kind="object" data-item=${r.item_id} data-state=${h.state} data-score=${h.score} aria-label=${ce(r.item_id)}>
              <polygon class="cobj" points=${L(r.corners)} stroke-width=${1.6*s} />
              ${r.steps.map(([p,u])=>d`<line class="crow" x1=${p[0]} y1=${p[1]} x2=${u[0]} y2=${u[1]} stroke-width=${s} />`)}
            </g>`;default:return v}})}
      ${o?d`<g class="cand-score" data-cand-score data-cand-score-for=${n??""}><rect x=${o[0]-c/2} y=${o[1]-22*s} width=${c} height=${20*s} rx=${10*s} stroke-width=${s} /><text x=${o[0]} y=${o[1]-12*s} font-size=${12*s}>${l}</text></g>`:v}
    </g>`}pickCandidate(t,e){e.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("candidate-select",{detail:{id:t},bubbles:!0,composed:!0}))}onCandDragStart(t,e,s){if(!this.candidateEditable||s.button!==0)return;s.stopPropagation(),s.preventDefault(),this.releaseFieldFocus();const i=this.getBoundingClientRect(),a=this.toPlan(s.clientX-i.left,s.clientY-i.top);let n=!1,o=a;this.viewport.setPointerCapture(s.pointerId);const l=p=>{const u=this.toPlan(p.clientX-i.left,p.clientY-i.top);!n&&Math.hypot((u.x-a.x)*this.planWidth,(u.y-a.y)*this.planHeight)*this.scale<3||(n=!0,o=u,this.candDrag={x:u.x,y:u.y})},c=()=>{this.viewport.removeEventListener("pointermove",l),this.viewport.removeEventListener("pointerup",r),this.viewport.removeEventListener("pointercancel",h),this.candDrag=null,this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0)},r=()=>{c(),n&&this.dispatchEvent(new CustomEvent("candidate-drag",{detail:{id:t,index:e,x:+o.x.toFixed(5),y:+o.y.toFixed(5)},bubbles:!0,composed:!0}))},h=()=>c();this.viewport.addEventListener("pointermove",l),this.viewport.addEventListener("pointerup",r),this.viewport.addEventListener("pointercancel",h)}renderCandidateHits(){const t=this.candidates;if(!t)return v;const e=this.candidatePrims(t),s=1/this.scale,i=this.planWidth,a=this.planHeight,n=t.walls.find(l=>l.id===this.selectedCandidateId),o=this.candDrag;return d`<g class="cand-hits">
      ${e.map(l=>{const c=()=>this.candHover=l.id,r=()=>this.candHover=null;return l.kind==="wall"?d`<polyline class="hit" data-cand-hit=${l.id} points=${L(l.points)} stroke-width=${Math.max(l.width,12*s)} @click=${h=>this.pickCandidate(l.id,h)} @pointerenter=${c} @pointerleave=${r} />`:l.kind==="door"||l.kind==="window"||l.kind==="passage"?d`<line class="hit" data-cand-hit=${l.id} x1=${l.gap[0][0]} y1=${l.gap[0][1]} x2=${l.gap[1][0]} y2=${l.gap[1][1]} stroke-width=${14*s} @click=${h=>this.pickCandidate(l.id,h)} @pointerenter=${c} @pointerleave=${r} />`:v})}
      ${n&&this.candidateEditable?n.polyline.map((l,c)=>d`<circle class="cvtx" data-cand-vertex=${c} cx=${l[0]*i} cy=${l[1]*a} r=${6*s} stroke-width=${1.6*s} aria-label=${`קצה מועמד ${c+1}`}
          @pointerdown=${r=>this.onCandDragStart(n.id,c,r)} @click=${r=>r.stopPropagation()} />`):v}
      ${o?d`<circle class="gdrag" cx=${o.x*i} cy=${o.y*a} r=${5*s} stroke-width=${1.5*s} />`:v}
    </g>`}renderGhost(){const t=this.ghost;if(!t)return v;const e=tt(t,this.planWidth,this.planHeight),s=1/this.scale,i=this.planWidth,a=this.planHeight,n=e.find(h=>h.kind==="door"),o=t.walls.find(h=>h.id.startsWith("ghost-wall")),l=this.ghostNote,c=(l.length*7+18)*s;let r=null;if(n){const h=[(n.gap[0][0]+n.gap[1][0])/2,(n.gap[0][1]+n.gap[1][1])/2],p=n.leaves[0]?.[1]??h,u=n.gap[1][0]-n.gap[0][0],y=n.gap[1][1]-n.gap[0][1],b=Math.hypot(u,y)||1;let w=-y/b,k=u/b;(p[0]-h[0])*w+(p[1]-h[1])*k>0&&(w=-w,k=-k);const M=Math.max(0,...e.filter(E=>E.kind==="wall").map(E=>E.width))/2+Math.abs(w)*(c/2+8*s)+Math.abs(k)*18*s;r=[h[0]+w*M,h[1]+k*M+10*s]}return d`<g class="ghost" data-door-ghost data-ghost-new-wall=${o?"yes":"no"}>
        ${e.filter(h=>h.kind==="wall"&&!!o&&h.id===o.id).map(h=>d`<polyline class="gwall" points=${L(h.points)} stroke-width=${Math.max(h.width,2*s)} />`)}
        ${n?d`<line class="ggap" x1=${n.gap[0][0]} y1=${n.gap[0][1]} x2=${n.gap[1][0]} y2=${n.gap[1][1]} stroke-width=${1.2*s} />
          ${n.leaves.map(([h,p])=>d`<line class="gleaf" data-ghost-leaf x1=${h[0]} y1=${h[1]} x2=${p[0]} y2=${p[1]} stroke-width=${2*s} />`)}
          ${n.arcs.map(h=>d`<path class="garc" d=${`M ${h.from[0]} ${h.from[1]} A ${h.r} ${h.r} 0 0 ${h.sweep} ${h.to[0]} ${h.to[1]}`} stroke-width=${1.4*s} />`)}`:v}
        ${r&&l?d`<g class="ghost-note ${this.ghostWarn?"warn":""}" data-ghost-note><rect x=${r[0]-c/2} y=${r[1]-34*s} width=${c} height=${20*s} rx=${10*s} stroke-width=${s} /><text x=${r[0]} y=${r[1]-24*s} font-size=${12*s}>${l}</text></g>`:v}
      </g>
      <g class="ghost-hits">
        ${n?d`<line class="hit" data-ghost-accept x1=${n.gap[0][0]} y1=${n.gap[0][1]} x2=${n.gap[1][0]} y2=${n.gap[1][1]} stroke-width=${24*s}
            @pointerdown=${h=>h.stopPropagation()} @click=${h=>this.ghostEvent(h,{id:"accept",phase:"click"})}><title>אישור הדלת (Enter)</title></line>`:v}
        ${this.ghostHandles.map(h=>{const p=h.at[0]*i,u=h.at[1]*a;if(h.id==="width"){const y=6*s;return d`<rect class="ghandle drag" data-ghost-handle="width" x=${p-y} y=${u-y} width=${2*y} height=${2*y} stroke-width=${1.6*s} role="slider" aria-label=${h.label}
              @pointerdown=${b=>this.onGhostDrag(b)} @click=${b=>b.stopPropagation()}><title>${h.label}</title></rect>`}return d`<g data-ghost-handle=${h.id}><circle class="ghandle" cx=${p} cy=${u} r=${9*s} stroke-width=${1.6*s} role="button" aria-label=${h.label}
              @pointerdown=${y=>y.stopPropagation()} @click=${y=>this.ghostEvent(y,{id:h.id,phase:"click"})}><title>${h.label}</title></circle>
            <text class="gglyph" x=${p} y=${u} font-size=${11*s}>${h.id==="hinge"?"⇄":"⇅"}</text></g>`})}
      </g>`}ghostEvent(t,e){t.stopPropagation(),!this.dragMoved&&this.dispatchEvent(new CustomEvent("ghost-handle",{detail:e,bubbles:!0,composed:!0}))}onGhostDrag(t){if(t.button!==0)return;t.stopPropagation(),t.preventDefault(),this.releaseFieldFocus();const e=this.getBoundingClientRect();let s=!1;this.viewport.setPointerCapture(t.pointerId);const i=(o,l)=>{const c=this.toPlan(l.clientX-e.left,l.clientY-e.top);this.dispatchEvent(new CustomEvent("ghost-handle",{detail:{id:"width",phase:o,x:+c.x.toFixed(5),y:+c.y.toFixed(5)},bubbles:!0,composed:!0}))},a=o=>{s=!0,i("move",o)},n=o=>{this.viewport.removeEventListener("pointermove",a),this.viewport.removeEventListener("pointerup",n),this.viewport.removeEventListener("pointercancel",n),s&&i("end",o),this.dragMoved=!0,setTimeout(()=>this.dragMoved=!1,0)};this.viewport.addEventListener("pointermove",a),this.viewport.addEventListener("pointerup",n),this.viewport.addEventListener("pointercancel",n)}renderWallDraft(){const t=this.wallDraft,e=this.hoverPoint,s=this.arcPreview,i=this.curveDraft;if(!t.length&&!e&&!s.length&&!i.length)return v;const a=1/this.scale,n=this.planWidth,o=this.planHeight,l=[...t,...e&&t.length?[e]:[]].map(c=>`${c[0]*n},${c[1]*o}`).join(" ");return d`<g class="wdraft" pointer-events="none">
      ${s.length?d`<polyline data-arc-preview data-curve-preview points=${s.map(c=>`${c[0]*n},${c[1]*o}`).join(" ")} stroke-width=${2*a} stroke-dasharray=${`${6*a} ${4*a}`} />`:v}
      ${i.map((c,r)=>d`<circle data-curve-draft-point=${r} cx=${c[0]*n} cy=${c[1]*o} r=${(r===0&&i.length>=3?6:4)*a} stroke-width=${1.5*a} />`)}
      ${t.length?d`<polyline points=${l} stroke-width=${2*a} stroke-dasharray=${`${6*a} ${4*a}`} />`:v}
      ${t.map(c=>d`<circle cx=${c[0]*n} cy=${c[1]*o} r=${3.5*a} stroke-width=${1.5*a} />`)}
      ${e?d`<circle class="snap" data-hover-point cx=${e[0]*n} cy=${e[1]*o} r=${4.5*a} stroke-width=${1.5*a} />`:v}
    </g>`}renderGrid(){const t=this.gridStep,e=this.planWidth,s=this.planHeight;if(!(t>0)||!(e>0)||!(s>0))return v;let i=1;for(;t*i*this.scale<Ae&&i<1024;)i*=2;const a=`${t}:${i}:${e}:${s}`;if(this.gridCache?.key!==a){const n=t*i,o=[];for(let l=0;l*n<=e+1e-6;l++)o.push(`M${+(l*n).toFixed(2)} 0V${s}`);for(let l=0;l*n<=s+1e-6;l++)o.push(`M0 ${+(l*n).toFixed(2)}H${e}`);this.gridCache={key:a,d:o.join(""),every:i}}return d`<path class="grid" data-grid data-grid-px=${String(t)} data-grid-every=${String(this.gridCache.every)} d=${this.gridCache.d} />`}renderGuides(){if(!this.guides.length)return v;const t=this.planWidth,e=this.planHeight;return d`<g class="guides" pointer-events="none">${this.guides.map(s=>s.axis==="x"?d`<line class="guide" data-guide="x" data-at=${String(s.at)} x1=${s.at} y1="0" x2=${s.at} y2=${e} />`:d`<line class="guide" data-guide="y" data-at=${String(s.at)} x1="0" y1=${s.at} x2=${t} y2=${s.at} />`)}</g>`}renderRulers(){if(!this.rulers.length)return v;const t=1/this.scale,e=this.planWidth,s=this.planHeight;return d`<g class="rulers" pointer-events="none">
      ${this.rulers.map(i=>{const a=i.a[0]*e,n=i.a[1]*s,o=i.b[0]*e,l=i.b[1]*s,c=(a+o)/2,r=(n+l)/2,h=(i.label.length*7+14)*t;return d`<g class="ruler ${i.tone}" data-ruler>
          <line x1=${a} y1=${n} x2=${o} y2=${l} stroke-width=${2*t} stroke-dasharray=${i.tone==="muted"?`${4*t} ${3*t}`:v} />
          <circle cx=${a} cy=${n} r=${3.5*t} stroke-width=${1.5*t} />
          <circle cx=${o} cy=${l} r=${3.5*t} stroke-width=${1.5*t} />
          ${i.label?d`<rect x=${c-h/2} y=${r-11*t} width=${h} height=${22*t} rx=${11*t} stroke-width=${t} /><text x=${c} y=${r} font-size=${12*t}>${i.label}</text>`:v}
        </g>`})}
    </g>`}renderFloorImage(){const t=this.floorImage;if(!t||this.hideFloorImage||!t.off&&!t.on)return v;const e=this.planWidth,s=this.planHeight,i=De(rt(t.corners,e,s)),a=t.off??t.on,n=t.off&&t.on?this.zones.filter(l=>this.roomStates?.rooms[l.id]?.lit):[],o=`fi-lit-${this.floorImageSeq}`;return d`<g data-floor-image class="floor-image" opacity=${t.opacity??1} transform=${i}>
      <image data-floor-image-off href=${a} x="0" y="0" width=${e} height=${s} preserveAspectRatio="none" />
      ${n.length?d`<clipPath id=${o} clipPathUnits="userSpaceOnUse">${n.map(l=>d`<polygon points=${this.litClipPoints(l)} />`)}</clipPath>
        <image data-floor-image-on href=${t.on} x="0" y="0" width=${e} height=${s} preserveAspectRatio="none" clip-path="url(#${o})" />`:v}
    </g>`}litClipPoints(t){const e=this.floorImage,s=rt(e.corners,this.planWidth,this.planHeight),i=s.a*s.d-s.b*s.c||1;return t.polygon.map(a=>{const n=a.x*this.planWidth-s.e,o=a.y*this.planHeight-s.f;return`${((s.d*n-s.c*o)/i).toFixed(1)},${((-s.b*n+s.a*o)/i).toFixed(1)}`}).join(" ")}render(){return jt`
      <div class="viewport ${this.placing?"placing":""} ${this.boxSelect?"boxing":""} ${this.marquee?"marquee":""} ${this.panActive?"spacepan":""}" data-space-pan=${this.panActive?"on":v} @wheel=${this.onWheel} @pointerdown=${this.onPointerDown} @pointermove=${this.onPointerMove}
           @pointerup=${this.onPointerUp} @pointercancel=${this.onPointerUp} @click=${this.onBackgroundClick}>
        <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="תוכנית קומה">
          <defs><marker id="sw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path class="carrowhead" d="M0 0L10 5L0 10z" /></marker>
            <pattern id="sw-glass-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><rect class="glass-hatch-bg" width="4" height="4" /><line class="glass-hatch-line" x1="0" y1="0" x2="0" y2="4" /></pattern></defs>
          <g transform="translate(${this.tx} ${this.ty}) scale(${this.scale})">
            ${this.imageUrl&&!this.hideImage?d`<image data-plan-image href=${this.imageUrl} x="0" y="0" width=${this.planWidth} height=${this.planHeight} preserveAspectRatio="none" />`:this.imageUrl?d`<rect class="sheet" data-plan-sheet x="0" y="0" width=${this.planWidth} height=${this.planHeight} />`:v}
            ${this.plan??v}
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
          ${this.box?d`<rect class="box" data-box x=${this.box.x0.toFixed(1)} y=${this.box.y0.toFixed(1)} width=${(this.box.x1-this.box.x0).toFixed(1)} height=${(this.box.y1-this.box.y0).toFixed(1)} />`:v}
        </svg>
      </div>
      <div class="zoomdock">
        <div class="controls" role="group" aria-label="זום">
          <sw-button variant="ghost" size="sm" iconOnly icon="plus" label=${A("floor.zoomIn")} @click=${()=>this.zoomBy(1.25)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="minus" label=${A("floor.zoomOut")} @click=${()=>this.zoomBy(.8)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="fit" label=${A("floor.fit")} @click=${()=>{this.fitted=!1,this.fit()}}></sw-button>
        </div>
        <div class="scale" aria-live="polite">${Math.round(this.scale*100)}%</div>
      </div>
    `}};f.styles=Ht`
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
  `;$([m({type:Number})],f.prototype,"planWidth",2);$([m({type:Number})],f.prototype,"planHeight",2);$([m({attribute:!1})],f.prototype,"plan",2);$([m({attribute:!1})],f.prototype,"markers",2);$([m({type:Number})],f.prototype,"clusterThreshold",2);$([m()],f.prototype,"selectedId",2);$([m({attribute:!1})],f.prototype,"selectedIds",2);$([m({type:Boolean})],f.prototype,"dimEntities",2);$([m({type:Boolean})],f.prototype,"alwaysLabel",2);$([m()],f.prototype,"imageUrl",2);$([m({type:Boolean})],f.prototype,"editable",2);$([m({type:Boolean})],f.prototype,"placing",2);$([m({type:Number})],f.prototype,"coneRadius",2);$([m({attribute:!1})],f.prototype,"zones",2);$([m()],f.prototype,"selectedZoneId",2);$([m({attribute:!1})],f.prototype,"selectedZoneVertex",2);$([m({type:Boolean})],f.prototype,"zoneLabels",2);$([m({attribute:!1})],f.prototype,"roomStates",2);$([m({attribute:!1})],f.prototype,"draftPoints",2);$([m({type:Boolean})],f.prototype,"boxSelect",2);$([m({attribute:!1})],f.prototype,"geometry",2);$([m()],f.prototype,"structureLevel",2);$([m({attribute:!1})],f.prototype,"issueIds",2);$([m()],f.prototype,"selectedGeomId",2);$([m({attribute:!1})],f.prototype,"highlightIds",2);$([m({type:Boolean})],f.prototype,"multiDrag",2);$([m({type:Boolean})],f.prototype,"marquee",2);$([m({type:Boolean})],f.prototype,"panMode",2);$([m({attribute:!1})],f.prototype,"catalog",2);$([m({attribute:!1})],f.prototype,"anchorPositions",2);$([m({attribute:!1})],f.prototype,"circuitStates",2);$([m({attribute:!1})],f.prototype,"entityStates",2);$([m({type:Boolean})],f.prototype,"hideStructure",2);$([m({type:Boolean})],f.prototype,"hideObjects",2);$([m({type:Boolean})],f.prototype,"hideConnectors",2);$([m({type:Boolean})],f.prototype,"hideImage",2);$([m({attribute:!1})],f.prototype,"floorImage",2);$([m({type:Boolean})],f.prototype,"hideFloorImage",2);$([m({type:Boolean})],f.prototype,"clipCoverage",2);$([m()],f.prototype,"geomDrag",2);$([m({attribute:!1})],f.prototype,"selectedVertex",2);$([m({type:Boolean})],f.prototype,"curveHandles",2);$([m({attribute:!1})],f.prototype,"selectedSegment",2);$([m({attribute:!1})],f.prototype,"arcPreview",2);$([m({attribute:!1})],f.prototype,"curveDraft",2);$([m({type:Boolean})],f.prototype,"curvePointHandles",2);$([m({type:Number})],f.prototype,"cornerSnapPx",2);$([m({attribute:!1})],f.prototype,"wallDraft",2);$([m({attribute:!1})],f.prototype,"hoverPoint",2);$([m({attribute:!1})],f.prototype,"rulers",2);$([m({type:Number})],f.prototype,"gridStep",2);$([m({attribute:!1})],f.prototype,"guides",2);$([m({attribute:!1})],f.prototype,"candidates",2);$([m({attribute:!1})],f.prototype,"candidateStates",2);$([m()],f.prototype,"selectedCandidateId",2);$([m({type:Boolean})],f.prototype,"candidateEditable",2);$([m({attribute:!1})],f.prototype,"ghost",2);$([m()],f.prototype,"ghostNote",2);$([m({type:Boolean})],f.prototype,"ghostWarn",2);$([m({attribute:!1})],f.prototype,"ghostHandles",2);$([I()],f.prototype,"candHover",2);$([I()],f.prototype,"candDrag",2);$([I()],f.prototype,"geomDragAt",2);$([I()],f.prototype,"box",2);$([I()],f.prototype,"spacePan",2);$([I()],f.prototype,"scale",2);$([I()],f.prototype,"tx",2);$([I()],f.prototype,"ty",2);$([I()],f.prototype,"hoverId",2);$([I()],f.prototype,"dragging",2);$([I()],f.prototype,"orienting",2);$([I()],f.prototype,"shaping",2);$([I()],f.prototype,"zoneDraft",2);$([It(".viewport")],f.prototype,"viewport",2);f=$([Wt("sw-plan-canvas")],f);export{qe as M,rt as a,De as b,ns as c,Le as d,Je as e,is as f,wt as g,Qe as h,ss as i,Ge as j,rs as k,Ze as l,os as m,Ne as n,Ve as o,ts as p,Re as q,es as r,as as s,ve as t,Ft as u,Xe as v,Ye as w,Ue as x,Ke as y};
//# sourceMappingURL=sw-plan-canvas-B9n2aid1.js.map
